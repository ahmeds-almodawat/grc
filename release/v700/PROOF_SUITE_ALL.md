# v7.0 Proof Suite: all

```json
{
  "generated_at": "2026-07-02T00:16:53.856Z",
  "mode": "all",
  "status": "failed_review_required",
  "passed_count": 13,
  "failed_count": 4,
  "skipped_count": 0,
  "failed_commands": [
    "v673:security-definer-audit",
    "v672:capture",
    "v662:strict-proof",
    "v66:strict-proof"
  ],
  "skipped_commands": [],
  "note": "This consolidated suite archives version-specific proof commands behind proof:* entry points. Skipped commands mean the current branch does not contain that legacy script.",
  "results": [
    {
      "group": "technical",
      "script": "typecheck",
      "status": "passed",
      "exit_code": 0
    },
    {
      "group": "technical",
      "script": "build",
      "status": "passed",
      "exit_code": 0
    },
    {
      "group": "technical",
      "script": "v62:static-strict",
      "status": "passed",
      "exit_code": 0
    },
    {
      "group": "technical",
      "script": "v64:strict-all",
      "status": "passed",
      "exit_code": 0
    },
    {
      "group": "technical",
      "script": "v673:security-definer-audit",
      "status": "failed",
      "exit_code": 1
    },
    {
      "group": "technical",
      "script": "v700:v65-audit",
      "status": "passed",
      "exit_code": 0
    },
    {
      "group": "runtime-security",
      "script": "v700:rpc-inventory",
      "status": "passed",
      "exit_code": 0
    },
    {
      "group": "runtime-security",
      "script": "v700:runtime-security",
      "status": "passed",
      "exit_code": 0
    },
    {
      "group": "personas",
      "script": "v72:persona-proof",
      "status": "passed",
      "exit_code": 0
    },
    {
      "group": "personas",
      "script": "v700:persona-gap",
      "status": "passed",
      "exit_code": 0
    },
    {
      "group": "restore",
      "script": "v674:restore-dryrun",
      "status": "passed",
      "exit_code": 0
    },
    {
      "group": "restore",
      "script": "v674:signoff-check",
      "status": "passed",
      "exit_code": 0
    },
    {
      "group": "pilot",
      "script": "v672:capture",
      "status": "failed",
      "exit_code": 1
    },
    {
      "group": "pilot",
      "script": "v662:strict-proof",
      "status": "failed",
      "exit_code": 1
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
