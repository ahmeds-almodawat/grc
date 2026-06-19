# v7.3.1 Module Acceptance Evidence Hotfix

This hotfix updates `scripts/v73-module-acceptance.mjs` only.

## Why

The first v7.3 script treated any occurrence of words like `FAIL`/`FAILED` inside SQL evidence text as a failed SQL proof. Some SQL/evidence outputs may include field names or test labels such as `failed_count` even when the capture wrapper already reports the SQL evidence as PASSED.

## Fix

The hotfix now treats the existing proof artifacts as authoritative:

- `proof:all` passed entries for v672/v662/v661
- v66 SQL evidence attachment presence and explicit pass markers
- v7.2 persona proof
- v7.0 runtime bridge proof

It still blocks Priority 1 modules if those proof signals are missing. It does not fill human approvals.

## Run

```powershell
npm run v73:all
npm run proof:all
```

Expected result: `v73:all` should pass or pass with warnings. `proof:all` should still only fail on `v66:strict-proof` until real Management/Admin, IT and Quality approvals are entered.
