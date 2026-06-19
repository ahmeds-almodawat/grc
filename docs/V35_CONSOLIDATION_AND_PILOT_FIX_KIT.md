# v3.5 Consolidation & Pilot Fix Kit

## Purpose
v3.5 is not a feature-expansion patch. It is a final stabilization layer for converting the long patch chain into a safe pilot launch process.

It adds a single control room for:

- patch consolidation status
- critical defect tracking
- real data repair queue
- pilot fix sprints
- go-live SOP steps
- cutover freeze windows
- operator daily logs
- final blocker board

## Hard stop rules
Do not start a pilot if any of these are true:

1. Fresh Supabase migration proof is not complete.
2. RLS persona proof is not complete.
3. OVR end-to-end proof is not complete.
4. Backup and restore evidence is missing.
5. Critical consolidation defects remain open.
6. Real data import has unresolved high-risk issues.

## Recommended sequence

1. Apply all patches in order through v3.5.
2. Run migrations 001 through 031 on a fresh Supabase staging project.
3. Run seed function:

```sql
select seed_v35_consolidation_defaults();
```

4. Open `/v35-consolidation`.
5. Verify patch manifest and go-live SOP.
6. Add any discovered defects into the defect board.
7. Complete pilot fix sprint 1.
8. Export the v3.5 consolidation pack.
9. Hold executive go/no-go meeting.

## Route
Add this page:

```tsx
<Route path="/v35-consolidation" element={<V35ConsolidationPilotFixKit />} />
```

Suggested navigation label:

- EN: Consolidation & Pilot Fix
- AR: الدمج وإصلاح التجربة

## Database objects

Migration `031_consolidation_pilot_fix_kit.sql` adds:

- `consolidation_patch_manifest`
- `consolidation_defects`
- `real_data_repair_queue`
- `pilot_fix_sprints`
- `pilot_fix_sprint_items`
- `cutover_freeze_windows`
- `go_live_sop_steps`
- `production_operator_daily_log`
- `v35_consolidation_scorecard`
- `v35_final_blocker_board`
- `v35_data_quality_radar`
- `v35_operator_console`

## Outcome
After this patch, the project has a stronger finishing path: not just modules, but a controlled proof process for pilot launch.
