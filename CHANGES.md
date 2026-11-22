# SENTRIQ UI — implementation patch

**Base:** `sentriq_ui` `main` @ `1d212bc` (PR #11 merged).
**Result:** 22 files changed, ~2,000 lines added. `tsc` clean, `next build` OK, **54/54 unit tests**, **48/48 end-to-end checks**.
Verified by applying the patch to a fresh clone of `main`, running `npm ci`, `tsc`, `npm test`, and `next build`.

## Apply

```bash
git checkout -b ux/inspections-actions-a11y origin/main
git apply sentriq-ui-improvements.patch        # or unzip sentriq-ui-changed-files.zip over the repo
npm ci && npm test && npx tsc --noEmit && npx next build
```

## What is in it

**Permissions (demo-only, deny by default)** — `lib/sentriq/demo-permissions.ts`
Every role in the picker has an entry. A management level never implies a reviewer role (company admin and superadmin cannot review), employees cannot create/execute, platform operators see no company records, reviewers can act only on their own stage.

**Review workflow** — `lib/inspections/repository.ts`
Three stages (reviewer 1 → reviewer 2 → final reviewer → approved), return at any stage with a reason, resubmission restarts at stage 1, separation of duties (inspector cannot review own inspection, nobody approves twice per cycle), per-template stage override, stable error codes.

**Corrective actions (new)** — `lib/actions/repository.ts`, `components/sentriq/actions.tsx`
Finding → action with owner/priority/due date; open → in progress → closure requested → closed (verifier only, owner cannot verify own action; return needs a reason); overdue derived, never stored; list, filters, detail, evidence (client-side names only), timeline. Routes `/app/actions` and `/app/actions/[id]`.

**Inspection screens rebuilt** — `components/sentriq/inspections.tsx`, `inspection-runner.tsx`, `inspection-shared.tsx`
Status summary cards and counts, stage dots, due date and overdue state, review inbox filtered by stage, detail with stage stepper / answers / findings with linked actions / review history / audit trail, return dialog with inline validation, phone cards for tables.
Runner: full-width options, validation only after interaction (not on first paint), section navigator, compact "Flag issue", review screen with jump-to-section, sticky footer with save state, conflict handling, success screen with next steps ("Create actions for N findings").

**Shell and accessibility** — `components/sentriq/app-shell.tsx`, `dialog.tsx`, `states.tsx`, `app/sentriq-polish.css`
Skip link, `aria-expanded`/`aria-controls` on the menu, Esc closes drawer and menu and returns focus, closed drawer no longer focusable or casting a shadow, account menu on phones/tablets (the demo role picker was unreachable at 390px), accessible dialog (labelled, focus trap, Esc, focus return), shared loading / empty / error / permission-denied states, notification dot driven by real records, language persisted, breadcrumb fixed for nested routes.

**Dashboard honesty** — `components/sentriq/overview-dashboard.tsx`
Greeting and date derived from the clock; no hardcoded `12.8%` / `2.4%`; counts, findings, chart series and reviewer avatars come from the same repositories the screens use (a new inspection changes the dashboard); synthetic sparkline removed.

**i18n** — `lib/sentriq/format.ts`, `inspections-i18n.ts`
Six Arabic plural categories ("ملاحظة واحدة / ملاحظتان / 3 ملاحظات …"), error codes mapped to EN/AR messages, EN/AR dictionary key parity test.

## Measured on the patched build (Chromium, production build)

| Check | Result |
|---|---|
| Horizontal page overflow at 390 / 820 / 1440 on Dashboard, Forms, Admin, My Work, Inspections, Reviews, Actions | 0 everywhere |
| Interactive elements < 24px | 0 on every page |
| Text < 12px | 0 |
| AA contrast failures (desktop, EN) | 0 on every page |
| End-to-end flow (phone, 7 roles, Arabic) | 48/48 |

`ui-e2e-check.py` and `ui-audit-check.py` are the scripts used (Python Playwright; start `npx next start -p 3100` first).

## Not in this patch (still open)

- Admin Center: hardcoded overview numbers ("24 companies", "42 members"), the Suspend-superadmin rule, grant/invitation dialogs with real pickers.
- Form builder UX (field palette, live preview, save status).
- Notification center, command palette (⌘K), saved views / shared DataTable, role-aware KPI dashboards.
- CI workflow and Playwright config inside the repo; Arabic screens were checked automatically (lang/dir/overflow/labels) but not reviewed visually.
- Offline mode is a banner only; no service worker. Everything remains a demo simulation: permissions are enforced by the Laravel API and the database, not by this UI.
