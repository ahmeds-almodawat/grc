# v6.6 Go / No-Go Gate

```json
{
  "generated_at": "2026-06-28T23:32:17.271Z",
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
      "status": "not_verified"
    },
    {
      "id": "manual_staging_evidence",
      "status": "passed"
    }
  ],
  "missing_manual_evidence": [],
  "recommendation": "Use only for controlled internal testing until missing manual staging evidence is attached."
}
```
