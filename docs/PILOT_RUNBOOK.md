# Controlled Pilot Runbook

## 1. Pilot objective

Run a controlled internal pilot of the GRC Control Center using synthetic or non-confidential records only. The goal is to prove workflow usability, role access, evidence capture, reporting, OVR handling patterns, and operational support readiness without exposing patient identifiers or confidential incident content.

## 2. Pilot boundaries

The pilot is limited to:

- 5 to 15 internal users.
- Synthetic/non-confidential data only.
- No real patient identifiers.
- No confidential OVR details.
- No production rollout.
- No reliance on the system for official regulatory reporting.
- No irreversible business decisions based only on pilot data.

## 3. Required roles

| Role | Pilot responsibility |
|---|---|
| Management/Admin sponsor | Approves pilot scope and controlled limits. |
| IT reviewer | Confirms technical evidence, access model, restore proof, and operating support. |
| Quality reviewer | Confirms Quality/OVR workflow suitability and confidentiality boundaries. |
| Pilot coordinator | Runs daily pilot checklist and collects feedback. |
| Module testers | Perform UAT scenarios with synthetic data. |
| Support owner | Tracks incidents, issues, and change requests. |

## 4. Entry criteria

The pilot may start only when all of the following are true:

- `npm run ci:static` passes.
- `npm run v75:all` generates the v7.5 review pack.
- `npm run proof:all` passes fully after real signoff.
- Management/Admin signoff is real and dated.
- IT signoff is real and dated.
- Quality signoff is real and dated.
- IT confidentiality confirmation is real and dated.
- Quality confidentiality confirmation is real and dated.
- Pilot users are named and limited.
- A rollback/export plan is understood.

## 5. Daily pilot routine

### Start of day

1. Confirm pilot user list.
2. Confirm no real patient data is being entered.
3. Confirm OVR examples are synthetic or anonymized training examples.
4. Check open high-priority issues from the previous day.
5. Confirm any planned changes are documented.

### During the day

1. Record usability issues.
2. Record access/role issues.
3. Record workflow blocking points.
4. Keep screenshots only when they contain no real patient/confidential data.
5. Escalate any confidentiality breach immediately.

### End of day

1. Export issue log.
2. Review access anomalies.
3. Update remediation tracker.
4. Confirm no unauthorized data was used.
5. Summarize pilot findings for Management/Admin, IT, and Quality.

## 6. Stop conditions

Pause the pilot immediately if any of these occur:

- Real patient identifiers are entered.
- Confidential OVR content is entered.
- A user sees records outside their authorized scope.
- Service-role behavior appears exposed to frontend/browser code.
- Restore/export evidence cannot be reproduced.
- A critical workflow produces misleading compliance output.
- Management/Admin, IT, or Quality withdraws approval.

## 7. Pilot completion criteria

The pilot can be considered successful when:

- Priority 1 modules complete UAT without blocking defects.
- OVR confidentiality controls are respected in practice.
- Role/persona access behaves as expected.
- Support procedures are workable.
- Known warnings are documented with owners.
- Exit report is approved by Management/Admin, IT, and Quality.

## 8. Production readiness warning

Pilot success does not equal production readiness. Production requires a separate staging/live validation, deployment proof, security review, backup/restore proof, support ownership, and formal go-live approval.
