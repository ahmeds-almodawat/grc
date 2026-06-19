# v6.7.4 Restore Integrity + Human Signoff Evidence Pack

This pack closes the remaining v66 governance items without fabricating approval.

## 1. Run the real local restore integrity test

```powershell
npm run v674:restore-dryrun
```

The helper:

- dumps the local `auth`, `public`, `storage`, and `supabase_migrations` schemas;
- restores them into `grc_v674_restore_verify`;
- compares key source and restored table counts;
- verifies evidence-related tables;
- runs a post-restore smoke query;
- deletes the temporary database and dump;
- marks only `backup_restore_dryrun` verified when every check passes.

Supabase-managed `realtime` and other service internals are outside this application-data restore proof.

## 2. Complete real human approval files

Edit:

- `release/v674/approvals/pilot-signoff.json`
- `release/v674/approvals/ovr-confidentiality-confirmation.json`

Do not use aliases or placeholder text. Each reviewer must enter a real name, role, date, decision, and controlled-pilot scope.

Allowed approval decisions:

- `approved`
- `approve`
- `go`
- `accepted`

Allowed confidentiality decisions:

- `confirmed`
- `approved`
- `accepted`

## 3. Verify and synchronize

```powershell
npm run v674:signoff-check
npm run v674:sync-manual-evidence
npm run v66:strict-proof
```

Or run:

```powershell
npm run v674:all
```

Until all explicit human fields are complete, `v674:all` ends at the unchanged v66 governance gate.
