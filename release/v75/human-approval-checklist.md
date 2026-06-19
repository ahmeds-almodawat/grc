# v7.5 Human Approval Checklist

Generated: 2026-06-19T21:02:59.306Z

## Current latest signoff status

```json
{
  "signoff_valid": false,
  "confidentiality_valid": false,
  "strict_passed": false
}
```

## Do not fake approval

Approval files must be completed only after real Management/Admin, IT, and Quality review. Do not auto-fill names, roles, dates, or decisions.

## Recommended controlled pilot scope

```text
Controlled internal pilot for GRC Control Center using synthetic/non-confidential data only. Pilot limited to 5–15 internal users. No real patient identifiers. No confidential OVR details. No production rollout.
```

## Pilot signoff required fields

| Field | Required | Notes |
| --- | --- | --- |
| management_admin.name | Yes |  |
| management_admin.role | Yes |  |
| management_admin.date | Yes | YYYY-MM-DD, not future |
| management_admin.decision | Yes | approved / approve / go / accepted |
| management_admin.scope | Yes | Must identify controlled internal pilot scope |
| it.name | Yes |  |
| it.role | Yes |  |
| it.date | Yes | YYYY-MM-DD, not future |
| it.decision | Yes | approved / approve / go / accepted |
| it.scope | Yes | Must identify controlled internal pilot scope |
| quality.name | Yes |  |
| quality.role | Yes |  |
| quality.date | Yes | YYYY-MM-DD, not future |
| quality.decision | Yes | approved / approve / go / accepted |
| quality.scope | Yes | Must identify controlled internal pilot scope |
| pilot_scope | Yes | Must identify controlled internal pilot scope |
| maximum_pilot_users | Yes |  |
| reviewed_evidence.local_staging_sql_proofs_reviewed | Yes | Must be explicitly true after real review |
| reviewed_evidence.restore_integrity_dryrun_reviewed | Yes | Must be explicitly true after real review |
| reviewed_evidence.security_definer_audit_reviewed | Yes | Must be explicitly true after real review |

## Confidentiality confirmation required fields

| Field | Required | Notes |
| --- | --- | --- |
| it_reviewer.name | Yes |  |
| it_reviewer.role | Yes |  |
| it_reviewer.date | Yes | YYYY-MM-DD, not future |
| it_reviewer.decision | Yes | confirmed / approved / accepted |
| it_reviewer.scope | Yes | Must identify controlled internal pilot scope |
| quality_reviewer.name | Yes |  |
| quality_reviewer.role | Yes |  |
| quality_reviewer.date | Yes | YYYY-MM-DD, not future |
| quality_reviewer.decision | Yes | confirmed / approved / accepted |
| quality_reviewer.scope | Yes | Must identify controlled internal pilot scope |
| statements.no_real_patient_identifiers | Yes | Must be explicitly true after real review |
| statements.no_confidential_ovr_details | Yes | Must be explicitly true after real review |
| statements.controlled_pilot_users_only | Yes | Must be explicitly true after real review |
| statements.local_staging_proof_reviewed | Yes | Must be explicitly true after real review |
| scope | Yes | Must identify controlled internal pilot scope |

## Approval files to open

```powershell
code release\v674\approvals\pilot-signoff.json
code release\v674\approvals\ovr-confidentiality-confirmation.json
```

## Validation after real approval

```powershell
npm run v674:signoff-check
npm run v674:sync-manual-evidence
npm run v66:strict-proof
npm run proof:all
```

## Expected result after valid real approval

```text
v674:signoff-check = strict_passed true
v66:strict-proof = passed
proof:all = fully passed
```

