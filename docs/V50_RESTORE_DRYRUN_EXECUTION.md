# v5.0 Restore Dry-run Execution

A backup is not valid until a restore is tested.

Minimum restore test:

1. Confirm backup source exists.
2. Restore database to staging.
3. Verify critical table counts.
4. Verify evidence storage samples.
5. Run app smoke test.
6. Document issues and sign off.

Run:

```bash
npm run v50:restore
```

Then track the execution in Supabase using:

```sql
select * from v_v50_restore_dryrun_queue;
```
