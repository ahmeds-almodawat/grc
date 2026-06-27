# v9.8 OVR Workflow Gap Report

- Generated: 2026-06-24T07:22:33.744Z
- Scope: controlled internal pilot
- Synthetic/de-identified data only
- Production readiness: **Not asserted**

| Workflow requirement | Classification | Evidence / remaining proof |
|---|---|---|
| 1. Reporter submits OVR | **implemented** | Authenticated reporter insert with factual report form and confidential-data warning. |
| 2. Manager review within 24 hours | **implemented** | Submission trigger sets 24-hour due date; relevant department manager transition is role-gated. |
| 3. Quality validates before referral notification | **implemented** | Referral transition rejects unvalidated OVRs; notification is created only after validation. |
| 4. Referred party responds | **implemented** | Structured referred user/department and response fields with RLS visibility. |
| 5. Quality issues final verdict | **implemented** | Quality-only final-review branch records verdict and notifies reporter. |
| 6. Reporter accepts or disputes | **implemented** | Only the original reporter may dispute or accept/close after final review. |
| 7. Dispute reopens OVR | **implemented** | Quality/Admin reopens a disputed OVR and clears stale closure state. |
| 8. Closure requires verdict and evidence/action | **implemented** | Final verdict plus accepted evidence or a closed linked action project are enforced. |
| 9. Admin sees all | **implemented** | Organization-scoped/global super-admin SELECT access remains explicit. |
| 10. Audit sees all read-only | **implemented** | Audit is included in SELECT policy and explicitly denied workflow mutation. |
| 11. Quality manages validation/final verdict | **implemented** | Quality pilot roles are explicit in the server-side transition function. |
| 12. Reporter sees own OVRs | **implemented** | RLS explicitly permits own-report visibility. |
| 13. Referred party sees assigned referrals only | **implemented** | RLS exposes the OVR only after structured referral assignment. |
| 14. Department manager sees relevant OVRs | **implemented** | Origin and referred department manager scopes are explicit. |
| In-app notifications/reminders | **implemented** | Manager, Quality, referral, and final-verdict in-app notifications exist; external email/SMS is outside this pilot scope. |
| Browser interaction proof | **not proven** | Controls are implemented and compiled; authenticated browser click-through still requires a pilot password/session. |

## Totals

- Implemented: 15
- Partial: 0
- Missing: 0
- Not proven: 1

## Focused changes

- Added the missing business statuses without removing legacy statuses.
- Replaced free-text referral enforcement with structured department/user assignments.
- Added server-side transition authorization and made Audit read-only.
- Added referral timing, final verdict, reporter dispute/acceptance, reopen, escalation, and evidence-gated closure.
- Kept external notification delivery and production approval outside this controlled-pilot patch.

