# Branching and PR Review Policy

## Branch rules

Use feature branches for all meaningful changes.

Examples:

```text
v7.5-controlled-pilot-readiness
v7.6-ci-repo-hygiene-evidence-ops
```

## Main branch

`main` should represent the latest reviewed baseline. Avoid direct experimental changes on `main`.

## Review checklist

Before merging:

- `npm run ci:static` passes.
- For operational updates, `npm run v75:all` or `npm run v76:all` passes.
- No unintended release proof-output files are included.
- No approval files are faked or modified without real approval.
- No `.env`, ZIP backup, or build output files are staged accidentally.

## Pull request body template

```text
## Summary

## Validation
- [ ] npm run ci:static
- [ ] npm run v76:all

## Safety
- [ ] No fake approval files
- [ ] No production-ready claim
- [ ] No RLS/migration/runtime bridge changes
- [ ] No real patient data or confidential OVR data

## Evidence
```
