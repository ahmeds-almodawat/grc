# v7.1 v65 Strength Audit

```json
{
  "generated_at": "2026-06-29T17:12:26.140Z",
  "status": "passed_with_warnings",
  "canonical_file": "supabase/tests/v65_workflow_smoke_tests.sql",
  "generated_copies_checked": 3,
  "high_findings": 0,
  "medium_findings": 1,
  "findings": [
    {
      "severity": "medium",
      "file": "release/v661/staging-sql/02_v65_workflow_smoke_tests.sql",
      "issue": "stale_generated_v65_copy",
      "recommendation": "Run npm run v672:capture or synchronize the staging SQL copy."
    }
  ]
}
```
