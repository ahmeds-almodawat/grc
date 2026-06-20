# v9.1 Approval Readiness Lint

Generated: 2026-06-20T08:09:29.360Z

| Item | Value |
| --- | --- |
| Status | manual_approval_pending |
| Production ready | No |
| Issues | 35 |
| Warnings | 0 |

## Issues

- pilot.management_admin.name missing or placeholder
- pilot.management_admin.role missing or placeholder
- pilot.management_admin.date must be real YYYY-MM-DD and not future
- pilot.management_admin.decision must be one of: approved, approve, go, accepted
- pilot.management_admin.scope must identify controlled internal pilot scope
- pilot.it.name missing or placeholder
- pilot.it.role missing or placeholder
- pilot.it.date must be real YYYY-MM-DD and not future
- pilot.it.decision must be one of: approved, approve, go, accepted
- pilot.it.scope must identify controlled internal pilot scope
- pilot.quality.name missing or placeholder
- pilot.quality.role missing or placeholder
- pilot.quality.date must be real YYYY-MM-DD and not future
- pilot.quality.decision must be one of: approved, approve, go, accepted
- pilot.quality.scope must identify controlled internal pilot scope
- pilot.pilot_scope must identify controlled internal pilot
- pilot.maximum_pilot_users must be integer from 1 to 15
- pilot.reviewed_evidence.local_staging_sql_proofs_reviewed must be true after review
- pilot.reviewed_evidence.restore_integrity_dryrun_reviewed must be true after review
- pilot.reviewed_evidence.security_definer_audit_reviewed must be true after review
- confidentiality.it_reviewer.name missing or placeholder
- confidentiality.it_reviewer.role missing or placeholder
- confidentiality.it_reviewer.date must be real YYYY-MM-DD and not future
- confidentiality.it_reviewer.decision must be one of: confirmed, approved, accepted
- confidentiality.it_reviewer.scope must identify controlled internal pilot scope
- confidentiality.quality_reviewer.name missing or placeholder
- confidentiality.quality_reviewer.role missing or placeholder
- confidentiality.quality_reviewer.date must be real YYYY-MM-DD and not future
- confidentiality.quality_reviewer.decision must be one of: confirmed, approved, accepted
- confidentiality.quality_reviewer.scope must identify controlled internal pilot scope
- confidentiality.scope must identify controlled internal pilot
- confidentiality.statements.no_real_patient_identifiers must be true after review
- confidentiality.statements.no_confidential_ovr_details must be true after review
- confidentiality.statements.controlled_pilot_users_only must be true after review
- confidentiality.statements.local_staging_proof_reviewed must be true after review

## Recommended scope

Controlled internal pilot for GRC Control Center using synthetic/non-confidential data only. Pilot limited to 5–15 internal users. No real patient identifiers. No confidential OVR details. No production rollout.

## Next commands after real approval

- npm run v674:signoff-check
- npm run v674:sync-manual-evidence
- npm run v66:strict-proof
- npm run proof:all
