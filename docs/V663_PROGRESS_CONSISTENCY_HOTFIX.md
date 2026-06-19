# v6.6.3 Progress Consistency Hotfix

This is a safety/consistency patch after reviewing the uploaded latest project ZIP.

It fixes two local inconsistencies:

1. `v662-staging-command-pack.mjs` looked for SQL files under names that did not match the v6.6.1 generated names. The hotfix now copies the SQL files into `release/v662/staging-sql/` with clear run-order names.
2. Installing Vitest/Playwright added caret (`^`) ranges to test dev dependencies. The hotfix pins those package versions from `package-lock.json` so `v61:pin-strict` can remain clean.

It also adds a progress consistency audit that reports:

- package pin status,
- migration prefix status,
- staging SQL pack completeness,
- remaining manual evidence,
- v6.0/v6.2 no-mock status,
- v6.4 database security status.

## Run

```powershell
node scripts/v663-install-progress-consistency-scripts.mjs
npm run v663:all
```

## Important

This patch does not remove remaining runtime fallback/demo paths. The stricter v6.2 audit may still show blockers. That should be handled as a separate, targeted no-mock API conversion patch, not an aggressive bulk rewrite.
