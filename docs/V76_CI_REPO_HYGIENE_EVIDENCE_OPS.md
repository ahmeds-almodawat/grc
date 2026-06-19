# v7.6 CI, Repo Hygiene, and Evidence Operations Pack

## Purpose

v7.6 strengthens the GRC Control Center project around CI, repository hygiene, evidence operations, and reviewer handover.

This pack is intentionally operational. It does **not** change application runtime behavior, approval files, RLS policies, Supabase migrations, or the final human signoff gate.

## Current status respected by this pack

The project remains:

```text
Technical controlled-pilot readiness: strong
Human signoff: pending
Production readiness: not yet
```

`proof:all` may still report `16 passed / 1 failed` while `v66:strict-proof` waits for real Management/Admin, IT, and Quality approvals plus OVR confidentiality confirmation.

## What v7.6 adds

- Script inventory and script debt visibility.
- Repo hygiene audit for tracked ZIPs, build outputs, local secrets, and generated evidence noise.
- CI readiness audit for GitHub Actions and static build validation.
- Evidence operations dashboard for release/proof artifacts.
- Repo health command for CI-safe checks.
- Review pack generation for technical reviewers.
- Documentation for script policy, evidence retention, branch review, and CI expansion.

## What v7.6 does not do

- Does not fake human approvals.
- Does not edit approval JSON files.
- Does not mark the platform production ready.
- Does not bypass `v66:strict-proof`.
- Does not rewrite Git history.
- Does not remove historical scripts.
- Does not modify migrations, RLS policies, or runtime bridge code.

## New commands

```powershell
npm run v76:all
npm run repo:health
```

`repo:health` runs `ci:static` and v7.6 repository/evidence checks. It is safe before human signoff because it does not require `proof:all` to fully pass.

## Recommended use

Run v7.6 before every pilot review meeting:

```powershell
npm run repo:health
code release\v76\v76-review-pack.md
```

Then use the output to separate:

- Technical readiness.
- Human signoff readiness.
- Evidence completeness.
- Repo/CI hygiene.
- Production blockers.
