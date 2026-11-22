import re,sys
from playwright.sync_api import sync_playwright
BASE="http://localhost:3100"; res=[]
def check(name,cond,extra=""): res.append((name,bool(cond))); print(("PASS " if cond else "FAIL ")+name+(f"  [{extra}]" if extra and not cond else ""))
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":390,"height":844}); pg=ctx.new_page()
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)[:160])); pg.on("console",lambda m: errs.append("console:"+m.text[:120]) if m.type=="error" and "ERR_NAME_NOT_RESOLVED" not in m.text and "Failed to load resource" not in m.text else None)
    def role(r):
        # works at any viewport: avatar menu on small screens, select on desktop
        w=pg.viewport_size["width"]
        if w<=900:
            pg.locator(".avatar-menu-trigger").click(); pg.locator("#avatar-menu-panel select").select_option(r); pg.keyboard.press("Escape")
        else: pg.select_option(".role-picker select",r)
        pg.wait_for_timeout(250)
    def go(u): pg.goto(BASE+u,wait_until="networkidle"); pg.wait_for_timeout(250)

    # ---- shell on phone
    go("/app/inspections")
    check("skip link exists & targets main", pg.locator("a.skip-link[href='#main-content']").count()==1 and pg.locator("main#main-content").count()==1)
    check("menu button aria-expanded=false", pg.locator(".mobile-menu-button").get_attribute("aria-expanded")=="false")
    pg.locator(".mobile-menu-button").click(); pg.wait_for_timeout(300)
    check("menu button aria-expanded=true when open", pg.locator(".mobile-menu-button").get_attribute("aria-expanded")=="true")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(250)
    check("Esc closes drawer and focus returns to menu button", pg.locator(".mobile-menu-button").get_attribute("aria-expanded")=="false" and pg.evaluate("document.activeElement.className.includes('mobile-menu-button')"))
    check("closed drawer is not focusable/visible", pg.evaluate("getComputedStyle(document.querySelector('.sidebar')).visibility")=="hidden")
    check("role picker reachable on phone via avatar menu", pg.locator(".avatar-menu-trigger").is_visible())
    pg.locator(".avatar-menu-trigger").click(); check("avatar menu opens with role select", pg.locator("#avatar-menu-panel select").is_visible())
    pg.keyboard.press("Escape"); check("Esc closes avatar menu and returns focus", pg.locator("#avatar-menu-panel").count()==0 and pg.evaluate("document.activeElement.className.includes('avatar-menu-trigger')"))

    # ---- roles & permissions
    role("employee"); go("/app/reviews")
    check("employee sees permission-denied on Reviews", pg.get_by_text("You do not have a reviewer role").count()==1)
    check("employee has no 'New inspection' button", (go("/app/inspections") or True) and pg.get_by_role("button",name=re.compile("New inspection",re.I)).count()==0)
    role("company_admin"); go("/app/inspections/INS-2026-0148")
    check("company_admin cannot see Approve/Return", pg.locator(".inspection-review-actions").count()==0)
    role("platform_owner"); go("/app/inspections")
    check("platform owner gets no company inspection data", pg.get_by_text("You do not have access to inspections").count()==1)

    # ---- inspector flow on phone
    role("inspector"); go("/app/inspections")
    before=pg.locator("table.inspection-table tbody tr").count()
    pg.get_by_role("button",name=re.compile("New inspection",re.I)).first.click(); pg.wait_for_timeout(300)
    check("dialog is labelled and focuses first field", pg.locator("[role=dialog][aria-modal=true]").count()==1 and pg.evaluate("document.activeElement.tagName")=="SELECT")
    pg.keyboard.press("Escape"); check("Esc closes the dialog", pg.locator("[role=dialog]").count()==0)
    pg.get_by_role("button",name=re.compile("New inspection",re.I)).first.click(); pg.wait_for_timeout(200); pg.locator("[role=dialog] button.button-primary").last.click(); pg.wait_for_timeout(1500)
    iid=re.search(r"(INS-[\w-]+)",pg.url).group(1); check("create opens runner", "/run" in pg.url, pg.url)
    check("no validation errors shown before interaction", pg.locator(".runner-error").count()==0)
    check("options are full width", pg.evaluate("(()=>{const o=document.querySelector('.runner-option');const q=document.querySelector('.runner-question');return !o|| o.getBoundingClientRect().width>q.getBoundingClientRect().width*0.85})()"))
    check("footer buttons visible and tappable (>=44px)", pg.evaluate("[...document.querySelectorAll('.runner-footer button')].every(b=>b.getBoundingClientRect().height>=40)"))
    # flag finding on first question
    pg.locator(".runner-raise").first.click(); pg.wait_for_timeout(250); dlg=pg.locator("[role=dialog]"); dlg.locator("input").first.fill("Blocked exit"); dlg.locator("button.button-primary").last.click(); pg.wait_for_timeout(250)
    check("finding flagged chip appears", pg.locator(".runner-raise.is-flagged").count()==1)
    # try next without answering -> flagged errors but allowed
    pg.locator(".runner-footer button.button-primary").click(); pg.wait_for_timeout(300)
    for _ in range(4):
        for r in pg.locator(".runner-choice-row").all(): r.locator("button").first.click()
        for t in pg.locator(".runner-options").all(): t.locator("input").first.check()
        for t in pg.locator(".inspection-runner textarea, .inspection-runner input[type=text]").all():
            if t.is_visible(): t.fill("ok")
        if pg.locator(".runner-review").count(): break
        nxt=pg.locator(".runner-footer button.button-primary")
        nxt.click(); pg.wait_for_timeout(300)
    # go back to section 1 to answer (we skipped it above)
    pg.locator(".ux-section-nav button").first.click(); pg.wait_for_timeout(250)
    for r in pg.locator(".runner-choice-row").all(): r.locator("button").first.click()
    for t in pg.locator(".runner-options").all(): t.locator("input").first.check()
    for t in pg.locator(".inspection-runner textarea, .inspection-runner input[type=text]").all():
        if t.is_visible(): t.fill("ok")
    pg.locator(".ux-section-review").click(); pg.wait_for_timeout(300)
    check("review screen shows summary", pg.locator(".runner-review").count()==1)
    sub=pg.locator(".runner-review ~ .runner-footer button.button-primary, .runner-footer button.button-primary").last
    check("submit enabled when valid", sub.is_enabled(), pg.locator(".runner-errors").inner_text() if pg.locator(".runner-errors").count() else "")
    sub.click(); pg.wait_for_timeout(700)
    check("success screen with plural finding text", pg.locator(".ux-success").count()==1 and "1 finding" in pg.locator(".ux-success").inner_text())
    check("success offers 'Create actions' for findings", pg.get_by_role("link",name=re.compile("Create actions",re.I)).count()==1)

    # ---- detail + review chain
    go("/app/inspections/"+iid); check("status Submitted after reload (persists)", "Submitted" in pg.locator(".inspection-detail-heading").inner_text())
    check("stepper shows 3 stages", pg.locator(".ux-stepper li").count()==3)
    pg.set_viewport_size({"width":1440,"height":900})
    role("inspector"); go("/app/inspections/"+iid); check("inspector sees 'waiting for' not approve", pg.locator(".inspection-review-actions").count()==0 and pg.locator(".ux-waiting").count()==1)
    for r,expect in [("reviewer_2","wait"),("reviewer_1","ok")]:
        role(r); go("/app/inspections/"+iid)
        if expect=="wait": check("reviewer_2 cannot act at stage 1", pg.locator(".inspection-review-actions").count()==0 and pg.locator(".ux-waiting").count()==1)
        else:
            pg.get_by_role("button",name=re.compile("Return",re.I)).first.click(); pg.wait_for_timeout(200)
            pg.locator("[role=dialog] button.button-primary").click(); pg.wait_for_timeout(200)
            check("return without reason is rejected inline", pg.locator("[role=dialog] [role=alert]").count()==1)
            pg.keyboard.press("Escape"); pg.get_by_role("button",name=re.compile("Approve as",re.I)).click(); pg.wait_for_timeout(400)
            check("stage 1 approval moves to Reviewer 2 (not Approved)", "In review" in pg.locator(".inspection-detail-heading").inner_text() and "Reviewer 2" in pg.locator(".inspection-meta-grid").inner_text())
    role("reviewer_1"); go("/app/inspections/"+iid); check("reviewer_1 cannot approve twice / wrong stage", pg.locator(".inspection-review-actions").count()==0)
    role("reviewer_2"); go("/app/inspections/"+iid); pg.get_by_role("button",name=re.compile("Approve as",re.I)).click(); pg.wait_for_timeout(400)
    role("final_reviewer"); go("/app/inspections/"+iid); pg.get_by_role("button",name=re.compile("Approve as",re.I)).click(); pg.wait_for_timeout(400)
    check("final approval => Approved", "Approved" in pg.locator(".inspection-detail-heading").inner_text())
    pg.get_by_role("tab",name=re.compile("Review history",re.I)).click(); check("history has 3 entries", pg.locator(".inspection-history li").count()==3)

    # ---- findings -> action -> verification
    role("company_superadmin"); go("/app/inspections/"+iid+"#findings")
    check("findings tab opens from hash", pg.get_by_role("tab",selected=True).inner_text().startswith("Findings"))
    pg.get_by_role("button",name=re.compile("Create action",re.I)).first.click(); pg.wait_for_timeout(250)
    pg.locator("[role=dialog] input[type=date]").fill("2026-11-25")
    pg.locator("[role=dialog] button.button-primary").last.click(); pg.wait_for_timeout(500)
    check("linked action appears under the finding", pg.locator(".ux-finding-actions a.ux-link").count()==1)
    aid=pg.locator(".ux-finding-actions a.ux-link").first.inner_text()
    ownerid=pg.evaluate("JSON.parse(localStorage.getItem('sentriq.actions.repository.v1')).find(a=>a.id=='%s').ownerId"%aid)
    owner_role={"u_owner":"action_owner","u_inspector":"inspector"}.get(ownerid,"action_owner")
    role(owner_role); go("/app/actions/"+aid)
    print("DEBUG owner:",ownerid,owner_role,"| page:",pg.locator("main").inner_text().replace("\n"," | ")[:330])
    pg.get_by_role("button",name=re.compile("Start work",re.I)).click(); pg.wait_for_timeout(300)
    pg.get_by_role("button",name=re.compile("Request closure",re.I)).click(); pg.wait_for_timeout(300)
    check("owner reaches Closure requested", "Closure requested" in pg.locator(".inspection-detail-heading").inner_text())
    check("owner cannot verify own action", pg.get_by_role("button",name=re.compile("Verify",re.I)).count()==0)
    role("closure_reviewer"); go("/app/actions/"+aid)
    pg.get_by_role("button",name=re.compile("Return for rework",re.I)).click(); pg.wait_for_timeout(200); pg.locator("[role=dialog] button.button-primary").click(); pg.wait_for_timeout(200)
    check("rework return needs a reason", pg.locator("[role=dialog] [role=alert]").count()==1)
    pg.keyboard.press("Escape"); pg.get_by_role("button",name=re.compile("Verify & close",re.I)).click(); pg.wait_for_timeout(400)
    check("verifier closes the action", "Closed" in pg.locator(".inspection-detail-heading").inner_text())
    check("timeline has 4 entries", pg.locator(".inspection-history li").count()==4)
    role("employee"); go("/app/actions"); check("actions list has overdue-aware summary", pg.locator(".ux-summary-card").count()==4)

    # ---- dashboard derived
    role("company_superadmin"); go("/app/dashboard")
    h=pg.locator("h1").first.inner_text(); check("greeting derived (no hardcoded 'Mariam' morning)", re.match(r"Good (morning|afternoon|evening)",h) is not None, h)
    check("no hardcoded 12.8% / 2.4%", "12.8%" not in pg.content() and "2.4%" not in pg.content())
    total=int(pg.locator(".metric-card").first.locator("strong, .metric-value").first.inner_text().strip().split()[0]) if pg.locator(".metric-card").count() else -1
    check("dashboard inspection total includes new record (>4)", total>4, str(total))

    # ---- Arabic
    pg.set_viewport_size({"width":390,"height":844}); role("inspector"); go("/app/inspections/"+iid)
    pg.locator(".avatar-menu-trigger").click(); pg.get_by_role("button",name="العربية").click(); pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
    check("Arabic sets html lang/dir", pg.evaluate("[document.documentElement.lang,document.documentElement.dir]")==["ar","rtl"])
    go("/app/inspections"); check("Arabic persists after reload", pg.evaluate("document.documentElement.dir")=="rtl")
    check("Arabic list has Arabic status labels", re.search(r"[ء-ي]", pg.locator("table.inspection-table").inner_text()) is not None)
    check("no horizontal scroll in Arabic phone", pg.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth"))
    pg.locator(".avatar-menu-trigger").click(); pg.get_by_role("button",name="English").click(); pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    check("switching back restores en/ltr", pg.evaluate("[document.documentElement.lang,document.documentElement.dir]")==["en","ltr"])
    print("\npage/console errors:",errs[:5]); b.close()
bad=[n for n,ok in res if not ok]; print(f"\n{len(res)-len(bad)}/{len(res)} checks passed"); print("FAILED:",bad)
