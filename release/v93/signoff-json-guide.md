# v9.3 Signoff JSON Guide

| File | Field | Expected content |
| --- | --- | --- |
| pilot-signoff.json | management_admin.name | Real approver name |
| pilot-signoff.json | management_admin.role | Real role/title |
| pilot-signoff.json | management_admin.date | YYYY-MM-DD, not future |
| pilot-signoff.json | management_admin.decision | approved / approve / go / accepted |
| pilot-signoff.json | management_admin.scope | Explicit controlled internal pilot scope |
| pilot-signoff.json | it.name / role / date / decision / scope | Same validation rules |
| pilot-signoff.json | quality.name / role / date / decision / scope | Same validation rules |
| pilot-signoff.json | pilot_scope | Explicit controlled internal pilot |
| pilot-signoff.json | maximum_pilot_users | Integer from 1 to 15 |
| pilot-signoff.json | reviewed_evidence.* | Required values true |
| ovr-confidentiality-confirmation.json | it_reviewer.* | Real IT reviewer and confirmed/approved/accepted decision |
| ovr-confidentiality-confirmation.json | quality_reviewer.* | Real Quality reviewer and confirmed/approved/accepted decision |
| ovr-confidentiality-confirmation.json | statements.* | Required confidentiality values true |
| ovr-confidentiality-confirmation.json | scope | Explicit controlled internal pilot scope |

## Recommended scope text

Controlled internal pilot for GRC Control Center using synthetic/non-confidential data only. Pilot limited to 5–15 internal users. No real patient identifiers. No confidential OVR details. No production rollout.

