# v6.6.2 Staging Evidence Capture Guide

This pack helps collect real staging evidence without touching runtime code.

## What this pack does

- Generates the staging run order.
- Generates evidence templates outside the official evidence folder.
- Creates a stricter quality gate for evidence attachments.
- Rejects placeholder/template evidence during strict proof.

## What this pack does not do

- It does not change the app.
- It does not change migrations.
- It does not create fake pass evidence.
- It does not approve pilot automatically.

## Required evidence folder

```text
release/v66/evidence-attachments/
```

Required files:

```text
staging-migration-log.txt
01-v64-persona-sql-output.txt
02-v65-workflow-sql-output.txt
03-v66-pilot-evidence-sql-output.txt
restore-dryrun-evidence.txt
pilot-signoff.md
```

## Commands

```bash
node scripts/v662-install-evidence-capture-scripts.mjs
npm run v662:all
```

After real evidence is attached:

```bash
npm run v662:strict-proof
```

## Evidence rule

The strict proof checks that each required evidence file exists, is not empty, does not contain template/TODO language, and contains a clear pass/success/verified signal. Human review is still required before actual pilot approval.
