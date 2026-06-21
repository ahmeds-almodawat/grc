# v9.7 Approval Record Integrity / Evidence Lock Pack

## Purpose

This pack supports the final controlled-pilot approval gate by creating integrity checks, evidence-lock manifests, post-signoff proof capture references, and release-freeze templates.

## Boundary

This is an approval-support and evidence-governance pack only. It does not fill or alter approval decisions, does not bypass strict proof, and does not make the system production ready.

## Required human action remains

Complete real approvals in:

- `release/v674/approvals/pilot-signoff.json`
- `release/v674/approvals/ovr-confidentiality-confirmation.json`

Then run:

```powershell
npm run v674:signoff-check
npm run v674:sync-manual-evidence
npm run v66:strict-proof
npm run proof:all
```
