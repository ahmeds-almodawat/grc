# v6.5 Phase Runner

```json
{
  "generated_at": "2026-06-18T19:38:12.468Z",
  "phases_run": 8,
  "phases_passed": 8,
  "phases_warning": 0,
  "phases_failed": 0,
  "overall_passed": true,
  "results": [
    {
      "id": 1,
      "name": "TypeScript foundation",
      "command": "npm run typecheck",
      "status": "passed",
      "exit_code": 0
    },
    {
      "id": 2,
      "name": "Production build",
      "command": "npm run build",
      "status": "passed",
      "exit_code": 0
    },
    {
      "id": 3,
      "name": "No-mock strict audit",
      "command": "npm run v60:strict",
      "status": "passed",
      "exit_code": 0
    },
    {
      "id": 4,
      "name": "Database security static proof",
      "command": "npm run v64:strict-all",
      "status": "passed",
      "exit_code": 0
    },
    {
      "id": 5,
      "name": "Test assets audit",
      "command": "npm run v65:assets",
      "status": "passed",
      "exit_code": 0
    },
    {
      "id": 6,
      "name": "Auth security smoke",
      "command": "npm run v65:auth",
      "status": "passed",
      "exit_code": 0
    },
    {
      "id": 7,
      "name": "Workflow contract tests",
      "command": "npm run v65:workflow",
      "status": "passed",
      "exit_code": 0
    },
    {
      "id": 8,
      "name": "Pilot readiness gate",
      "command": "npm run v65:pilot",
      "status": "passed",
      "exit_code": 0
    }
  ]
}
```
