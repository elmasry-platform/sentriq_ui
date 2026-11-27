# Lost MFA device: recovery for Owner and Sub-owner

Applies when operator two-step verification (TOTP) is on (`NEXT_PUBLIC_OPERATOR_MFA=on` and the database requires aal2).

## Before it is needed
- Enrol every operator. Keep at least two active operators, so one can help the other.
- Each operator can keep a backup: scan the same QR code on a second device when enrolling (the code is shown once).
- Mohamed owns this process and the Supabase project access.

## When someone loses their device
1. The operator tells the other operator (or Mohamed) by a channel that is not the platform, for example a call. Do not accept a request by email alone.
2. The other operator confirms it is really that person (voice or video).
3. Backend removes the lost factor for that user only. Today this is a manual step, there is no button in the app:
   - Supabase dashboard: Authentication, Users, the user, remove the TOTP factor; or
   - the Auth admin API (delete factor), run from a trusted server with the service key. The service key never goes in the app or in chat.
4. The operator signs in with the password. The app shows the enrol screen. They scan the new QR code and enter the first code.
5. Backend records who asked, who confirmed, who removed the factor, and when.

## If the Owner is locked out and no other operator can confirm
Mohamed does step 3 through the Supabase dashboard after confirming the person himself.

## Gaps to decide
- There is no in-app reset by the other operator yet. It needs a backend function (audited, Owner or Sub-owner only, never on yourself) and then a button. Not built.
- Decide the rule for a lost device of the last remaining Owner.
