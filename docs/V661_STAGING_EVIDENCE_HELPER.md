# v6.6.1 Staging Evidence Helper Pack

This pack is add-only. It does not change runtime code, package lock, migrations, pages, or authentication behavior.

## Purpose

v6.6 proved the local build, no-mock strict audit, static database security, unit tests, and Playwright smoke tests. The remaining blocker is manual staging proof.

This helper pack creates the run order and evidence attachment checks needed to move from:

`controlled internal testing ready`

to:

`controlled pilot review ready`

## Commands

```bash
node scripts/v661-install-staging-evidence-helper-scripts.mjs
npm run v661:all
```

After staging evidence is attached:

```bash
npm run v661:strict-proof
```

## Evidence folder

Attach evidence files under:

```text
release/v66/evidence-attachments/
```

Recommended files:

```text
staging-migration-log.txt
01-v64-persona-sql-output.txt
02-v65-workflow-sql-output.txt
03-v66-pilot-evidence-sql-output.txt
restore-dryrun-evidence.txt
pilot-signoff.md
```

## Important

Passing this helper does not mean full company-wide production. It supports only a controlled pilot review with 5-15 trusted users after IT / Quality / Admin signoff.
