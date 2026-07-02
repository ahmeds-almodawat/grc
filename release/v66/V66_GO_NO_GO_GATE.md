# v6.6 Go / No-Go Gate

```json
{
  "generated_at": "2026-07-02T00:16:53.004Z",
  "controlled_pilot_status": "not_ready_manual_evidence_required",
  "strict_passed": false,
  "gates": [
    {
      "id": "local_typecheck_build",
      "status": "passed"
    },
    {
      "id": "v60_no_mock_strict",
      "status": "evidence_present"
    },
    {
      "id": "v64_static_security",
      "status": "evidence_present"
    },
    {
      "id": "v65_real_tests",
      "status": "evidence_present"
    },
    {
      "id": "manual_staging_evidence",
      "status": "manual_required"
    }
  ],
  "missing_manual_evidence": [
    {
      "id": "staging_persona_sql_v64",
      "title": "v64 persona SQL tests passed in staging",
      "status": "manual_required",
      "evidence_needed": "Result/output from supabase/tests/v64_persona_security_tests.sql."
    },
    {
      "id": "staging_workflow_sql_v65",
      "title": "v65 workflow SQL smoke tests passed in staging",
      "status": "manual_required",
      "evidence_needed": "Result/output from supabase/tests/v65_workflow_smoke_tests.sql."
    }
  ],
  "recommendation": "Use only for controlled internal testing until missing manual staging evidence is attached."
}
```
