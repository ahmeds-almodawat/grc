# v9.1 Post-Signoff Proof Runbook

Generated: 2026-06-20T08:09:31.539Z

## Run after real approvals are completed

1. npm run v674:signoff-check
2. npm run v674:sync-manual-evidence
3. npm run v66:strict-proof
4. npm run proof:all

## Expected final result

- v674 signoff check strict passed.
- v66 strict proof passed.
- proof:all fully passed.

## Current safety note

This runbook does not approve production. It closes only the controlled-pilot manual evidence blocker.

- Status: technical_ready_pending_human_approval
- Production ready: false
