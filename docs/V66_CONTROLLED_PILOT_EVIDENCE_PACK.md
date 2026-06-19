# v6.6 Controlled Pilot Evidence Pack

This pack is the final squashed step before a limited controlled pilot. It does not claim production readiness. It creates the evidence register, restore dry-run checklist, pilot issue log, roster template, and go/no-go gate.

## Required manual evidence

The pilot remains blocked until these are verified:

1. Fresh staging Supabase migrations applied through 044/045.
2. `supabase/tests/v64_persona_security_tests.sql` passed in staging.
3. `supabase/tests/v65_workflow_smoke_tests.sql` passed in staging.
4. Restore dry-run completed and documented.
5. OVR confidentiality rule confirmed: no real patient identifiers/confidential OVR data during pilot until proof is complete.
6. IT, Quality, and Admin signoff attached.

## Commands

```bash
node scripts/v66-install-controlled-pilot-scripts.mjs
npm run v66:all
```

Strict go/no-go after manual evidence is attached:

```bash
npm run v66:strict-proof
```

## Generated outputs

- `release/v66/v66-evidence-register.json`
- `release/v66/v66-manual-evidence.json`
- `release/v66/V66_EVIDENCE_REGISTER.md`
- `release/v66/V66_RESTORE_DRYRUN_EVIDENCE.md`
- `release/v66/v66-pilot-issue-log.csv`
- `release/v66/v66-pilot-roster-template.csv`
- `release/v66/V66_CONTROLLED_PILOT_SIGNOFF.md`
- `release/v66/V66_DAY1_RUNBOOK.md`
- `release/v66/V66_GO_NO_GO_GATE.md`

## Evidence editing rule

Only change `release/v66/v66-manual-evidence.json` from `manual_required` to `verified` when real staging output or signed evidence exists.
