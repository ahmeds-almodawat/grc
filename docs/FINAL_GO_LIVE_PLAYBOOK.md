# GRC Control Center — Final Go-Live Playbook

This playbook is the fastest safe route to move from patched staging work to a controlled pilot launch.

## Rule 1: do not launch to all employees first
Start with a controlled pilot: Governance, Quality, Finance, HR, IT, Internal Audit, and selected department managers. Normal employees are added only after access tests and workflow tests pass.

## T-7 days
- Apply all patches into one clean codebase.
- Freeze database migrations after `026_finish_fast_release_sprint.sql`.
- Run `npm install`, `npm run typecheck`, and `npm run build`.
- Run the migration verifier in a fresh Supabase staging project.
- Export the migration run evidence.

## T-3 days
- Create a browser export package from the Export Center.
- Create a real database backup/dump outside the browser.
- Export or back up Supabase Storage evidence files.
- Perform a restore dry-run in a non-production environment.
- Record restore proof in Restore Dry-run Center.

## T-1 day
- Run the final acceptance test script.
- Run RLS persona tests with real users.
- Review Arabic/RTL on Home, Executive Command, My Work, OVR, Reports, and Admin.
- Confirm OVR workflow with Quality.
- Confirm pilot access list.

## Go-live day
- Enable only pilot users.
- Do not import all 1,000 employees yet.
- Monitor Operations Follow-up, Security & Audit, OVR Risk Indicators, and Performance Center.
- Export a go-live day backup package after initial configuration.

## T+7 days
- Review access warnings.
- Review OVRs and delayed actions.
- Review performance signals.
- Decide whether to open wave 2.

## Stop conditions
Stop rollout if any of these are true:
- Fresh migration run fails.
- RLS persona test fails for employee, department manager, Quality, Audit, or Executive.
- OVR closure can happen without Quality/evidence.
- Backup restore dry-run is not documented.
- Critical Arabic/RTL screens are unusable.
- Large dataset testing creates unacceptable slowness.
