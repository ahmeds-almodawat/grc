# v7.4 Repo Hardening

## Summary

v7.4 improves repository professionalism, documentation, and CI readiness without changing security logic, approval gates, migrations, or production readiness status.

This update responds to repo-level concerns such as weak README documentation, unclear versioning, missing CI workflow, and the need to distinguish controlled-pilot evidence from production readiness.

## What changed

Added or updated:

```text
README.md
docs/ARCHITECTURE.md
docs/RELEASE_POLICY.md
docs/V74_REPO_HARDENING.md
.github/workflows/ci.yml
scripts/v74-install-package-scripts.mjs
```

The installer script adds this safe wrapper if missing:

```json
"ci:static": "npm run typecheck && npm run build"
```

## What did not change

v7.4 does not:

- Modify human approval files.
- Fake Management/Admin, IT, or Quality signoff.
- Mark the system production ready.
- Bypass `v66:strict-proof`.
- Change RLS policies.
- Change runtime bridge logic.
- Rewrite database migrations.
- Remove historical proof scripts.
- Rewrite Git history.

## Current expected proof result

Until real signoff is completed, this remains acceptable:

```text
npm run proof:all
status: failed_review_required
passed_count: 16
failed_count: 1
failed_commands: ["v66:strict-proof"]
```

The failure is expected because real human signoff and OVR confidentiality confirmation are still missing.

## Why this update exists

The platform has strong controlled-pilot technical evidence, but the repository needed better handover quality.

v7.4 makes the repo easier for Management/Admin, IT, Quality, auditors, or external developers to understand without changing the actual release gate.

## CI behavior

The new GitHub Actions workflow runs on:

```text
push
pull_request
```

It performs:

```text
npm install
npm run typecheck
npm run build
```

It intentionally does not run `proof:all` yet, because `proof:all` is expected to fail until real human signoff is completed.

## Repo hygiene note

If ZIP files are tracked in Git, they should be reviewed separately.

Recommended check:

```powershell
git ls-files "*.zip"
```

Do not run `git filter-repo` or rewrite history as part of v7.4. If ZIP files are not required, remove them later in a normal reviewed commit first.

## Remaining blockers

Before controlled pilot:

- Complete real `release/v674/approvals/pilot-signoff.json`.
- Complete real `release/v674/approvals/ovr-confidentiality-confirmation.json`.
- Run `npm run v674:signoff-check`.
- Run `npm run v674:sync-manual-evidence`.
- Run `npm run v66:strict-proof`.
- Run `npm run proof:all` until fully passed.

Before production:

- Perform staging/live Supabase validation.
- Run real authenticated persona/RLS proof in staging.
- Document deployment and rollback.
- Confirm backup/restore in target environment.
- Obtain production approval.

## Recommended next phase

After v7.4 is merged and signoff is resolved, the next phase should be:

```text
v7.5 Controlled Pilot Signoff Completion
```

or, if signoff is delayed:

```text
v7.5 Staging Validation Plan
```
