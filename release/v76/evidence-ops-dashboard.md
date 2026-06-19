# v7.6 Evidence Operations Dashboard

Generated: 2026-06-19T21:50:40.722Z

Status: **technical_ready_pending_human_approval**

Proof suite status: **failed_review_required**

Failed commands: **v66:strict-proof**

| Gate | State | Evidence |
| --- | --- | --- |
| typecheck/build static command | expected via ci:static | manual/latest command output |
| v7.3 module acceptance | passed | release/v73/module-acceptance-results.json |
| runtime security bridge | passed | release/v700/runtime-security-bridge-audit.json |
| authenticated persona proof | passed | release/v72/real-authenticated-persona-proof.json |
| proof suite overall | failed_review_required | release/v700/proof-suite-all.json |
| signoff validity | pending | release/v674/v674-signoff-check.json |
| confidentiality validity | pending | release/v674/v674-signoff-check.json |
| v7.5 dashboard exists | present | release/v75/controlled-pilot-readiness-dashboard.md |
| human approval checklist exists | present | release/v75/human-approval-checklist.md |

## Interpretation

If the only failing proof command is `v66:strict-proof`, and signoff/confidentiality are pending, the remaining blocker is human approval rather than a new technical blocker.
