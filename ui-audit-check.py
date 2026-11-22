from playwright.sync_api import sync_playwright
import json
JS=r"""()=>{
const vis=e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0};
const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return {r:p[0],g:p[1],b:p[2],a:p[3]===undefined?1:p[3]}};
const lum=({r,g,b})=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
const bgOf=e=>{let bg={r:255,g:255,b:255};const st=[];let n=e;while(n){const c=parse(getComputedStyle(n).backgroundColor);if(c&&c.a>0)st.push(c);if(c&&c.a>=1)break;n=n.parentElement}for(const c of st.reverse())bg={r:c.r*c.a+bg.r*(1-c.a),g:c.g*c.a+bg.g*(1-c.a),b:c.b*c.a+bg.b*(1-c.a)};return bg};
let total=0,fail=0;const fs=[];
document.querySelectorAll('body *').forEach(e=>{if(e.children.length>0)return;const t=e.textContent.trim();if(!t||!vis(e))return;const cs=getComputedStyle(e);const fg=parse(cs.color);if(!fg)return;const bg=bgOf(e);const f={r:fg.r*fg.a+bg.r*(1-fg.a),g:fg.g*fg.a+bg.g*(1-fg.a),b:fg.b*fg.a+bg.b*(1-fg.a)};const L1=lum(f),L2=lum(bg);const cr=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);const s=parseFloat(cs.fontSize);fs.push(s);const large=s>=24||(s>=18.66&&parseInt(cs.fontWeight)>=700);total++;if(cr<(large?3:4.5))fail++});
const it=[...document.querySelectorAll('button,[role=button],a[href],select,input:not([type=hidden])')].filter(vis);
const mb=document.querySelector('.mobile-menu-button');
const off=it.filter(b=>{const x=b.getBoundingClientRect();return x.width<24||x.height<24}).slice(0,6).map(b=>b.tagName+'.'+String(b.className).split(' ')[0]+' '+Math.round(b.getBoundingClientRect().width)+'x'+Math.round(b.getBoundingClientRect().height));
return {off,hscroll:document.documentElement.scrollWidth-document.documentElement.clientWidth,textEls:total,contrastFail:fail,minFont:Math.min(...fs),lt12:fs.filter(x=>x<12).length,interactive:it.length,lt24:it.filter(b=>{const x=b.getBoundingClientRect();return x.width<24||x.height<24}).length,lt32:it.filter(b=>{const x=b.getBoundingClientRect();return x.width<32||x.height<32}).length,skipLink:!!document.querySelector('a[href="#main-content"],a.skip-link,a[href^="#main"]'),menuAriaExpanded:mb?mb.getAttribute('aria-expanded'):'n/a',htmlDir:document.documentElement.dir,htmlLang:document.documentElement.lang}}"""
out={}
pages=["/app/dashboard","/app/forms","/app/admin","/app/my-work","/app/inspections","/app/reviews","/app/actions"]
with sync_playwright() as p:
    b=p.chromium.launch()
    for vn,(w,h) in {"desktop":(1440,900),"tablet":(820,1100),"mobile":(390,844)}.items():
        pg=b.new_context(viewport={"width":w,"height":h}).new_page()
        for u in pages:
            pg.goto("http://localhost:3100"+u,wait_until="networkidle"); pg.wait_for_timeout(300)
            r=pg.evaluate(JS); out[f"{vn}{u}"]=r if vn=="desktop" else {"hscroll":r["hscroll"],"lt24":r["lt24"]}
    b.close()
for k,v in out.items(): print(k, json.dumps(v))
