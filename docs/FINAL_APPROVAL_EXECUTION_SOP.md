# Final Approval Execution SOP

## Objective

Complete real controlled-pilot approvals without weakening the proof gate.

## Required approvers

- Management/Admin
- IT
- Quality
- IT confidentiality reviewer
- Quality confidentiality reviewer

## Required scope

Controlled internal pilot for GRC Control Center using synthetic/non-confidential data only. Pilot limited to 5–15 internal users. No real patient identifiers. No confidential OVR details. No production rollout.

## Required commands after approval

```powershell
npm run v674:signoff-check
npm run v674:sync-manual-evidence
npm run v66:strict-proof
npm run proof:all
```
