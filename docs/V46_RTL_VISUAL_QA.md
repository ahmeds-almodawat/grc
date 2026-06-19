# v4.6 RTL Visual QA

Purpose: make Arabic screens visually production-worthy.

QA areas:

- Sidebar alignment.
- Executive dashboard cards.
- OVR form layout.
- OVR bilingual print layout.
- Table scrolling.
- Long modals with sticky actions.
- Mobile card stacking.

Run:

```bash
npm run v46:rtl
```

Then use the database QA registry:

```sql
select seed_v46_ovr_bilingual_rtl_defaults();
select * from v_v46_language_rtl_readiness;
select * from v_v46_production_hardening_scorecard;
```

The SQL registry stores manual QA results. It does not replace human visual review.
