# v4.9 Production Backup Strategy

Browser export is not a full production backup.

A production backup strategy must include:

- Database backup
- Supabase Storage evidence backup
- Auth/user recovery plan
- Backup owner
- Backup frequency
- Backup location
- Restore dry-run evidence
- Escalation if backup fails

Run:

```bash
npm run v50:backup
```
