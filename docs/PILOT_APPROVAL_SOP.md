# Pilot Approval SOP

## Purpose

This SOP defines how real human approval must be collected for the controlled internal pilot. Approval is not a technical checkbox; it is a management and governance decision.

## Files involved

```text
release/v674/approvals/pilot-signoff.json
release/v674/approvals/ovr-confidentiality-confirmation.json
```

## Rules

- Do not use placeholder names.
- Do not auto-fill names.
- Do not approve on behalf of another person.
- Do not use future dates.
- Do not change scripts to bypass approval.
- Do not mark production ready.

## Required pilot signoff parties

| Party | Required fields |
|---|---|
| Management/Admin | name, role, date, decision, scope |
| IT | name, role, date, decision, scope |
| Quality | name, role, date, decision, scope |

Allowed pilot decisions:

```text
approved
approve
go
accepted
```

## Required confidentiality confirmation parties

| Party | Required fields |
|---|---|
| IT reviewer | name, role, date, decision, scope |
| Quality reviewer | name, role, date, decision, scope |

Allowed confidentiality decisions:

```text
confirmed
approved
accepted
```

## Required scope text

Recommended scope:

```text
Controlled internal pilot for GRC Control Center using synthetic/non-confidential data only. Pilot limited to 5–15 internal users. No real patient identifiers. No confidential OVR details. No production rollout.
```

## Required evidence confirmations

The following must be explicitly true only after real review:

```text
reviewed_evidence.local_staging_sql_proofs_reviewed = true
reviewed_evidence.restore_integrity_dryrun_reviewed = true
reviewed_evidence.security_definer_audit_reviewed = true
statements.no_real_patient_identifiers = true
statements.no_confidential_ovr_details = true
statements.controlled_pilot_users_only = true
statements.local_staging_proof_reviewed = true
```

## Validation commands

After real approvals are entered:

```powershell
npm run v674:signoff-check
npm run v674:sync-manual-evidence
npm run v66:strict-proof
npm run proof:all
```

## Expected result after valid approval

```text
v674:signoff-check = strict_passed true
v66:strict-proof = passed
proof:all = fully passed
```

## Audit note

The system is intentionally designed to fail strict proof until real approval exists. This is a strength, not a defect.
