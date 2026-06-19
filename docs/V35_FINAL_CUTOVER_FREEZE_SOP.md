# v3.5 Final Cutover Freeze SOP

## Goal
Prevent uncontrolled changes during final pilot preparation.

## Freeze windows
Use `cutover_freeze_windows` to record periods where structural changes are not allowed.

## During freeze
Do not change:

- departments
- units/stations
- role scopes
- OVR routing rules
- RLS policies
- migration files
- production backup strategy

Allowed only with approval:

- critical defect fixes
- data repair corrections
- pilot access issues
- backup/restore evidence updates

## Exit criteria
The freeze can end only when:

1. backup evidence exists
2. restore dry-run is documented
3. critical defects are closed
4. pilot users can log in
5. OVR workflow passes
6. executive sponsor approves
