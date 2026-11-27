# Lost MFA device: recovery for Owner and Sub-owner

Applies once the database requires aal2 (not built yet); until then the screen is browser-only. It also needs operator two-step verification (TOTP) on (`NEXT_PUBLIC_OPERATOR_MFA=on`).

## Before it is needed
- Enrol every operator. Keep at least two active operators, so one can help the other.
- Each operator can keep a backup: scan the same QR code on a second device when enrolling (the code is shown once).
- Turn the flag on only after both operators are enrolled, and enrol in a private session. Until a factor exists, anyone with the password can enrol one.
- Mohamed owns this process and the Supabase project access.

## When someone loses their device
1. The operator tells the other operator (or Mohamed) by a channel that is not the platform, for example a call. Do not accept a request by email alone.
2. The other operator confirms it is really that person (voice or video).
3. Backend removes the lost factor for that user only. Today this is a manual step, there is no button in the app:
   - Supabase dashboard: Authentication, Users, the user, remove the TOTP factor; or
   - the Auth admin API (delete factor), run from a trusted server with the service key. The service key never goes in the app or in chat.
4. The operator signs in at once after the factor is removed, and the removing admin watches for the new enrolment. The app shows the enrol screen. the enrol screen. They scan the new QR code and enter the first code.
5. Backend records who asked, who confirmed, who removed the factor, and when.

## If the Owner is locked out and no other operator can confirm
Mohamed does step 3 through the Supabase dashboard after confirming the person himself.

## Gaps to decide
- There is no in-app reset by the other operator yet. It needs a backend function (audited, Owner or Sub-owner only, never on yourself) and then a button. Not built.
- Decide the rule for a lost device of the last remaining Owner.
