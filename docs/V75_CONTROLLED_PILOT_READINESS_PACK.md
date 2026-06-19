# v7.5 Controlled-Pilot Readiness Pack

## Purpose

v7.5 turns the existing technical proof work into a usable **controlled-pilot operating pack**. It is designed for Management/Admin, IT, Quality, and pilot coordinators who need to understand what is ready, what remains blocked, and how to run a safe internal pilot without using real patient identifiers or confidential OVR details.

## Current position

The project has strong technical controlled-pilot evidence, but the final human gate remains intentionally blocked until real signoff is completed.

Known status before v7.5:

```text
Technical controlled-pilot readiness: strong / passed
Module acceptance evidence: passed with warnings
Runtime security bridge: passed
Authenticated persona proof: passed
Restore dry-run: passed
SQL evidence capture: passed
Human approval: still pending
Production readiness: not yet
```

## What v7.5 adds

### Documentation and operating model

- `docs/PILOT_RUNBOOK.md`
- `docs/PILOT_APPROVAL_SOP.md`
- `docs/OVR_CONFIDENTIALITY_SOP.md`
- `docs/DATA_HANDLING_POLICY.md`
- `docs/SECURITY_REVIEW_GUIDE.md`
- `docs/UAT_PLAN.md`
- `docs/OPERATIONS_SUPPORT_MODEL.md`
- `docs/CHANGE_CONTROL_SOP.md`
- `docs/INCIDENT_RESPONSE_PLAYBOOK.md`
- `docs/POST_PILOT_EXIT_CRITERIA.md`
- `docs/PILOT_RACI.md`
- `docs/MODULE_ACCEPTANCE_REMEDIATION_PLAN.md`
- `docs/STAGING_VALIDATION_PLAN.md`
- `docs/EXECUTIVE_READOUT_TEMPLATE.md`

### Generated release outputs

The new v7.5 scripts generate a structured review pack under `release/v75/`:

- `controlled-pilot-readiness-dashboard.json`
- `controlled-pilot-readiness-dashboard.md`
- `human-approval-checklist.json`
- `human-approval-checklist.md`
- `executive-controlled-pilot-readout.json`
- `executive-controlled-pilot-readout.md`
- `v75-controlled-pilot-review-pack.md`

### New npm scripts

The installer adds:

```json
"v75:pilot-dashboard": "node scripts/v75-generate-pilot-dashboard.mjs",
"v75:approval-checklist": "node scripts/v75-generate-approval-checklist.mjs",
"v75:executive-readout": "node scripts/v75-generate-executive-readout.mjs",
"v75:review-pack": "node scripts/v75-generate-review-pack.mjs",
"v75:all": "npm run v75:pilot-dashboard && npm run v75:approval-checklist && npm run v75:executive-readout && npm run v75:review-pack",
"pilot:readiness": "npm run ci:static && npm run v75:all"
```

## What v7.5 does not change

v7.5 does **not**:

- Modify `release/v674/approvals/pilot-signoff.json`.
- Modify `release/v674/approvals/ovr-confidentiality-confirmation.json`.
- Auto-fill human names, dates, decisions, or approval fields.
- Mark the platform production ready.
- Bypass `v66:strict-proof`.
- Change RLS policies.
- Change runtime bridge logic.
- Change database migrations.
- Change service-role or Edge bridge behavior.
- Remove any proof gate.

## Correct next step after v7.5

Run:

```powershell
npm run ci:static
npm run v75:all
```

Then review:

```powershell
code release\v75\v75-controlled-pilot-review-pack.md
code release\v75\human-approval-checklist.md
```

After real approvals are obtained, run:

```powershell
npm run v674:signoff-check
npm run v674:sync-manual-evidence
npm run v66:strict-proof
npm run proof:all
```

## Final rule

A controlled pilot may proceed only after real Management/Admin, IT, and Quality approval plus IT/Quality confidentiality confirmation. Production readiness remains a separate future gate.
