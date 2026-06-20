# v9.4 Approval JSON Shape Audit

## Summary

| Metric | Value |
| --- | --- |
| Required fields | 35 |
| Passed fields | 0 |
| Missing or invalid fields | 35 |
| Approval lint status | manual_approval_pending |
| Production ready | No |

## Required field map

| File | Field | Required evidence | Status |
| --- | --- | --- | --- |
| pilot-signoff | management_admin.name | Real Management/Admin name | missing_or_invalid |
| pilot-signoff | management_admin.role | Real Management/Admin role | missing_or_invalid |
| pilot-signoff | management_admin.date | Management/Admin approval date, YYYY-MM-DD, not future | missing_or_invalid |
| pilot-signoff | management_admin.decision | Management/Admin decision: approved/approve/go/accepted | missing_or_invalid |
| pilot-signoff | management_admin.scope | Management/Admin controlled internal pilot scope | missing_or_invalid |
| pilot-signoff | it.name | Real IT approver name | missing_or_invalid |
| pilot-signoff | it.role | Real IT approver role | missing_or_invalid |
| pilot-signoff | it.date | IT approval date, YYYY-MM-DD, not future | missing_or_invalid |
| pilot-signoff | it.decision | IT decision: approved/approve/go/accepted | missing_or_invalid |
| pilot-signoff | it.scope | IT controlled internal pilot scope | missing_or_invalid |
| pilot-signoff | quality.name | Real Quality approver name | missing_or_invalid |
| pilot-signoff | quality.role | Real Quality approver role | missing_or_invalid |
| pilot-signoff | quality.date | Quality approval date, YYYY-MM-DD, not future | missing_or_invalid |
| pilot-signoff | quality.decision | Quality decision: approved/approve/go/accepted | missing_or_invalid |
| pilot-signoff | quality.scope | Quality controlled internal pilot scope | missing_or_invalid |
| pilot-signoff | pilot_scope | Overall controlled internal pilot scope | missing_or_invalid |
| pilot-signoff | maximum_pilot_users | Maximum pilot users from 1 to 15 | missing_or_invalid |
| pilot-signoff | reviewed_evidence.local_staging_sql_proofs_reviewed | Local staging SQL proofs reviewed | missing_or_invalid |
| pilot-signoff | reviewed_evidence.restore_integrity_dryrun_reviewed | Restore integrity dry-run reviewed | missing_or_invalid |
| pilot-signoff | reviewed_evidence.security_definer_audit_reviewed | Security definer audit reviewed | missing_or_invalid |
| confidentiality | it_reviewer.name | Real IT confidentiality reviewer name | missing_or_invalid |
| confidentiality | it_reviewer.role | Real IT confidentiality reviewer role | missing_or_invalid |
| confidentiality | it_reviewer.date | IT confidentiality review date, YYYY-MM-DD, not future | missing_or_invalid |
| confidentiality | it_reviewer.decision | IT confidentiality decision: confirmed/approved/accepted | missing_or_invalid |
| confidentiality | it_reviewer.scope | IT confidentiality controlled internal pilot scope | missing_or_invalid |
| confidentiality | quality_reviewer.name | Real Quality confidentiality reviewer name | missing_or_invalid |
| confidentiality | quality_reviewer.role | Real Quality confidentiality reviewer role | missing_or_invalid |
| confidentiality | quality_reviewer.date | Quality confidentiality review date, YYYY-MM-DD, not future | missing_or_invalid |
| confidentiality | quality_reviewer.decision | Quality confidentiality decision: confirmed/approved/accepted | missing_or_invalid |
| confidentiality | quality_reviewer.scope | Quality confidentiality controlled internal pilot scope | missing_or_invalid |
| confidentiality | statements.no_real_patient_identifiers | No real patient identifiers statement | missing_or_invalid |
| confidentiality | statements.no_confidential_ovr_details | No confidential OVR details statement | missing_or_invalid |
| confidentiality | statements.controlled_pilot_users_only | Controlled pilot users only statement | missing_or_invalid |
| confidentiality | statements.local_staging_proof_reviewed | Local staging proof reviewed statement | missing_or_invalid |
| confidentiality | scope | Overall confidentiality controlled internal pilot scope | missing_or_invalid |

## Safety boundary

This audit only reads approval files. It does not fill, infer, or fake approval values.