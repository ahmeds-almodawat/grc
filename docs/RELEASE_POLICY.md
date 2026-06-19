# Release Policy

## Purpose

This document defines how GRC Control Center should handle internal evidence versions, public package versions, controlled-pilot releases, and future production releases.

## Current versioning reality

The repository currently contains multiple internal evidence/checkpoint names such as:

```text
v62, v64, v66, v672, v673, v674, v700, v72, v73
```

These are internal audit/proof milestones. They should not be confused with the npm package version in `package.json`.

The npm package version may still say something like:

```text
1.0.0
```

That does not mean the platform is production ready. Production readiness is controlled by evidence gates, staging/live validation, and real human approval.

## Internal evidence versions

Internal versions are used for:

- Static audit checkpoints.
- RLS/security proof checkpoints.
- Runtime bridge proof.
- Persona proof.
- Restore dry-run proof.
- Module acceptance evidence.
- Manual signoff gates.

These folders should remain available as audit evidence unless a deliberate archive plan is approved.

## Semantic versioning plan

Future public releases should use semantic versioning:

```text
MAJOR.MINOR.PATCH
```

Recommended interpretation:

- `0.x.x` — pre-production, pilot, staging, and validation releases.
- `1.0.0` — first production-approved release after full signoff, staging proof, and deployment proof.
- Patch releases — safe fixes that do not change core behavior or access rules.
- Minor releases — new modules or controlled feature additions.
- Major releases — breaking data model, permission, deployment, or migration changes.

## Controlled-pilot release gate

A controlled-pilot release requires:

1. `npm run typecheck` passes.
2. `npm run build` passes.
3. `npm run v73:all` or the current module acceptance command passes with no blocking failures.
4. Runtime security bridge proof passes.
5. Authenticated persona proof passes.
6. Restore dry-run proof passes.
7. SQL evidence capture passes.
8. Real Management/Admin, IT, and Quality signoff is completed.
9. OVR confidentiality confirmation is completed before OVR testing with any sensitive workflow.
10. `npm run proof:all` fully passes.

Before real signoff, `proof:all` is expected to fail on `v66:strict-proof`. That failure must not be bypassed.

## Production release gate

A production release requires all controlled-pilot gates plus:

1. Staging/live Supabase environment validation.
2. RLS/persona tests against real authenticated staging users.
3. No real patient identifiers used in test evidence unless governed by an approved production data policy.
4. CI/CD pipeline passing on GitHub.
5. Deployment process documented.
6. Rollback process documented and tested.
7. Backup and restore validation completed against the target environment.
8. Management/Admin, IT, and Quality production approval.

## Git policy

Recommended Git flow:

```text
main
  stable checkpoint branch; do not push unreviewed large changes directly
feature/vX-name
  focused branch for one patch or evidence update
pull request
  review point before merging to main
release tag
  created only for approved controlled-pilot or production release
```

## Script policy

The repository currently has many historical proof scripts. They should not be removed aggressively because they may be part of the audit trail.

Future cleanup should:

- Keep canonical commands documented.
- Archive historical commands instead of deleting them blindly.
- Avoid breaking existing evidence folders.
- Add wrapper commands for common flows.
- Reduce script noise only after controlled-pilot signoff is complete.

Canonical command targets should eventually include:

```text
npm run dev
npm run typecheck
npm run build
npm run test
npm run ci:static
npm run proof:all
npm run v73:all
```

## ZIP and generated artifact policy

Large binary ZIP files should generally not be committed to Git.

If tracked ZIP files already exist:

1. Do not immediately rewrite Git history.
2. Confirm whether they are required for evidence or recovery.
3. Remove them in a normal commit if safe.
4. Consider history cleanup only after a backup and with team agreement.

## Human approval policy

Human signoff files must only contain real approvals.

Do not:

- Auto-fill names.
- Use placeholder approvals.
- Mark unreviewed evidence as reviewed.
- Change decisions to make proof pass.
- Remove manual approval requirements.

Allowed pilot signoff decisions include:

```text
approved
approve
go
accepted
```

Allowed confidentiality decisions include:

```text
confirmed
approved
accepted
```
