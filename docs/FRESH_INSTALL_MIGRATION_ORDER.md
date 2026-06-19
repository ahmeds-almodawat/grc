# Fresh Install Migration Order

Apply migrations in filename order from `001` through `026`.

Current final migration:

```text
026_finish_fast_release_sprint.sql
```

## Verification steps

1. Create a new Supabase project for staging.
2. Apply every migration in order.
3. Confirm no duplicate enum/table/function errors block execution.
4. Run these sanity queries:

```sql
select * from v_final_finish_fast_scorecard;
select count(*) from v_final_go_live_gateboard;
select count(*) from v_final_acceptance_tests;
select count(*) from v_final_cutover_plan;
select seed_final_release_defaults();
```

5. Open the app and navigate to **Finish Fast Center**.
6. Confirm scorecard, gates, tests, cutover tasks, and artifacts load.

## Important
Do not skip migrations. Later migrations depend on tables, enum values, views, and functions created by earlier files.
