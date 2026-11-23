# Operational overview, design exploration 02

## Scope

The first implementation covers the workspace shell and Overview. It keeps the existing mock data and browser repositories. It does not add server authentication, tenant authorization, evidence uploads, production storage, or a backend connection.

## Included

- Direct navigation to Inspections, Corrective actions and Forms, with one All apps entry.
- Operational brief, next eligible review, one priority-sorted work queue and site action comparison.
- Separate personal and explicitly labeled workspace queues. Empty personal work never falls back to unrelated company records.
- Current demo-stage review eligibility, no self-review, overdue-first sorting, site filters and text search.
- Saved views scoped to workspace and demo role in this browser, up to five, with deletion.
- Record preview drawer reusing the existing focus-trapped dialog and full-record links.
- English and Arabic labels, RTL, mobile task rows and reduced-motion treatment.
- Explicit loading, empty, no-access and unreadable-storage states. Corrupt saved data is not overwritten.

## Intentional differences from the visual concept

Counts and records come from the current repositories and demo role rather than the illustrative mockup. The button opens the existing inspection page instead of pretending a new-inspection dialog was built. Inspection detail redesign is not included in this first slice. Existing demo-role controls remain visible. Search is labeled as Overview work, not global search. Site bars compare open corrective actions, not safety scores. Activity uses the existing recorded demo events and is not a live audit feed. The wider application remains a demo; browser filters and hidden controls are not authorization.

## Verification

- `npm run typecheck`
- `npm test`: 61 passing tests, including seven Overview model tests.
- `npm run build`: production build passes.
- `git diff --check`
- The project has no lint script or lint configuration. `npm run lint` reports a missing script.
- Local browser checks exercised saved-view reload, role changes, review eligibility, search/no-match, keyboard search focus, preview/Escape, Arabic mobile navigation, platform-role no-access and corrupt-storage alert.
- Rendered desktop and Arabic mobile were inspected. Width checks at 320, 390, 1000 and 1440 pixels found no horizontal page overflow.

These checks do not establish production readiness or server-side security. Backend integration and the redesigned Inspection detail remain separate work.
