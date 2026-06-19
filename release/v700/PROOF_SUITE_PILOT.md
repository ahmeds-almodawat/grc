# v7.0 Proof Suite: pilot

```json
{
  "generated_at": "2026-06-19T14:10:44.176Z",
  "mode": "pilot",
  "status": "failed_review_required",
  "passed_count": 4,
  "failed_count": 1,
  "skipped_count": 0,
  "failed_commands": [
    "v66:strict-proof"
  ],
  "skipped_commands": [],
  "note": "This consolidated suite archives version-specific proof commands behind proof:* entry points. Skipped commands mean the current branch does not contain that legacy script.",
  "results": [
    {
      "group": "pilot",
      "script": "v672:capture",
      "status": "passed",
      "exit_code": 0
    },
    {
      "group": "pilot",
      "script": "v662:strict-proof",
      "status": "passed",
      "exit_code": 0
    },
    {
      "group": "pilot",
      "script": "v661:strict-proof",
      "status": "passed",
      "exit_code": 0
    },
    {
      "group": "pilot",
      "script": "v66:strict-proof",
      "status": "failed",
      "exit_code": 1
    },
    {
      "group": "pilot",
      "script": "v663:progress-audit",
      "status": "passed",
      "exit_code": 0
    }
  ]
}
```
