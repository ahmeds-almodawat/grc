# v9.4 Approver Control Room

## Approver task board

| Owner | Task | Status |
| --- | --- | --- |
| Management/Admin | Review controlled pilot scope and approve or reject pilot-signoff.json | Pending real approval |
| IT | Confirm evidence review, access boundary, staging proof, and IT signoff fields | Pending real approval |
| Quality | Confirm quality scope, OVR confidentiality, and Quality signoff fields | Pending real approval |
| Pilot Lead | Prepare approval packet and ensure no placeholders remain | Action needed |
| Audit / Reviewer | Review v9.4 gate simulator and v9.3 command center outputs | Ready |
| Project Owner | Run post-approval proof protocol after real signoff | Pending approval completion |

## Approval readiness

| Metric | Value |
| --- | --- |
| Required approval fields | 35 |
| Passed fields | 0 |
| Missing or invalid fields | 35 |
| Lint status | manual_approval_pending |

## Rule

No person should approve unless the controlled internal pilot scope is understood and no real patient identifiers or confidential OVR details will be used.