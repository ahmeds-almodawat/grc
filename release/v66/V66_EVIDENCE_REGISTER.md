# v6.6 Controlled Pilot Evidence Register

```json
{
  "generated_at": "2026-06-18T20:24:33.087Z",
  "automated_total": 4,
  "automated_verified_or_present": 3,
  "manual_total": 6,
  "manual_verified": 0,
  "manual_required_remaining": 6,
  "pilot_evidence_status": "manual_evidence_required"
}
```

## Manual evidence items

- [ ] **fresh_staging_migrations_001_044** — Fresh staging Supabase migrations applied through 044 — status: `manual_required`
- [ ] **staging_persona_sql_v64** — v64 persona SQL tests passed in staging — status: `manual_required`
- [ ] **staging_workflow_sql_v65** — v65 workflow SQL smoke tests passed in staging — status: `manual_required`
- [ ] **backup_restore_dryrun** — Backup and restore dry-run completed in staging — status: `manual_required`
- [ ] **ovr_confidentiality_no_real_patient_data** — OVR confidentiality rule confirmed for pilot — status: `manual_required`
- [ ] **pilot_signoff_it_quality_admin** — IT, Quality, and Admin pilot signoff completed — status: `manual_required`

Edit `release/v66/v66-manual-evidence.json` and set required items to `verified` only after real staging evidence is attached.
