# v9.2 Approval Field Map

Generated: 2026-06-20T17:21:38.308Z

## Status

| Item | Value |
| --- | --- |
| Required fields | 35 |
| Fields with visible values | 8 |
| Production ready | No |
| Approval gate bypassed | No |

## Field map

| File | Field | Requirement | Current visible status |
| --- | --- | --- | --- |
| pilot-signoff.json | management_admin.name | Real Management/Admin approver name | Missing or placeholder |
| pilot-signoff.json | management_admin.role | Real Management/Admin role | Missing or placeholder |
| pilot-signoff.json | management_admin.date | Real approval date, YYYY-MM-DD, not future | Missing or placeholder |
| pilot-signoff.json | management_admin.decision | approved / approve / go / accepted | Missing or placeholder |
| pilot-signoff.json | management_admin.scope | Controlled pilot scope | Missing or placeholder |
| pilot-signoff.json | it.name | Real IT approver name | Missing or placeholder |
| pilot-signoff.json | it.role | Real IT role | Missing or placeholder |
| pilot-signoff.json | it.date | Real approval date, YYYY-MM-DD, not future | Missing or placeholder |
| pilot-signoff.json | it.decision | approved / approve / go / accepted | Missing or placeholder |
| pilot-signoff.json | it.scope | Controlled pilot scope | Missing or placeholder |
| pilot-signoff.json | quality.name | Real Quality approver name | Missing or placeholder |
| pilot-signoff.json | quality.role | Real Quality role | Missing or placeholder |
| pilot-signoff.json | quality.date | Real approval date, YYYY-MM-DD, not future | Missing or placeholder |
| pilot-signoff.json | quality.decision | approved / approve / go / accepted | Missing or placeholder |
| pilot-signoff.json | quality.scope | Controlled pilot scope | Missing or placeholder |
| pilot-signoff.json | pilot_scope | Controlled internal pilot scope | Missing or placeholder |
| pilot-signoff.json | maximum_pilot_users | Integer from 1 to 15 | Present |
| pilot-signoff.json | reviewed_evidence.local_staging_sql_proofs_reviewed | Must be true | Present |
| pilot-signoff.json | reviewed_evidence.restore_integrity_dryrun_reviewed | Must be true | Present |
| pilot-signoff.json | reviewed_evidence.security_definer_audit_reviewed | Must be true | Present |
| ovr-confidentiality-confirmation.json | it_reviewer.name | Real IT reviewer name | Missing or placeholder |
| ovr-confidentiality-confirmation.json | it_reviewer.role | Real IT reviewer role | Missing or placeholder |
| ovr-confidentiality-confirmation.json | it_reviewer.date | Real confirmation date, YYYY-MM-DD, not future | Missing or placeholder |
| ovr-confidentiality-confirmation.json | it_reviewer.decision | confirmed / approved / accepted | Missing or placeholder |
| ovr-confidentiality-confirmation.json | it_reviewer.scope | Controlled pilot scope | Missing or placeholder |
| ovr-confidentiality-confirmation.json | quality_reviewer.name | Real Quality reviewer name | Missing or placeholder |
| ovr-confidentiality-confirmation.json | quality_reviewer.role | Real Quality reviewer role | Missing or placeholder |
| ovr-confidentiality-confirmation.json | quality_reviewer.date | Real confirmation date, YYYY-MM-DD, not future | Missing or placeholder |
| ovr-confidentiality-confirmation.json | quality_reviewer.decision | confirmed / approved / accepted | Missing or placeholder |
| ovr-confidentiality-confirmation.json | quality_reviewer.scope | Controlled pilot scope | Missing or placeholder |
| ovr-confidentiality-confirmation.json | statements.no_real_patient_identifiers | Must be true | Present |
| ovr-confidentiality-confirmation.json | statements.no_confidential_ovr_details | Must be true | Present |
| ovr-confidentiality-confirmation.json | statements.controlled_pilot_users_only | Must be true | Present |
| ovr-confidentiality-confirmation.json | statements.local_staging_proof_reviewed | Must be true | Present |
| ovr-confidentiality-confirmation.json | scope | Controlled internal pilot scope | Missing or placeholder |

## Reminder

This map is not the authority for final acceptance. The authoritative validator remains npm run v674:signoff-check.
