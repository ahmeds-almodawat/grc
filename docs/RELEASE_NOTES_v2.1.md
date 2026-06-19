# GRC Control Center v2.1 — Ultra Enterprise Intelligence Patch

This patch adds the enterprise reporting and intelligence layer:

- Board Pack Center
- Advanced Report Builder
- Evidence Vault
- Department Scorecards
- Backup Scheduler Center
- Scenario Planning Center
- Executive Mobile Command view
- Evidence versioning and retention review metadata
- Scheduled backup plan metadata and run history
- Department KPI targets and scorecard notes
- Board pack snapshots and executive briefing notes
- Risk scenario matrix
- New migration: `023_enterprise_intelligence_reporting.sql`

Notes:
- Backup scheduling is metadata/control tracking only. Real automated backups should run server-side.
- Evidence Vault tracks metadata/version health and does not replace Supabase Storage permissions.
- Board pack snapshots capture summary metadata; attached PDF generation can be added in a later server-side phase.
