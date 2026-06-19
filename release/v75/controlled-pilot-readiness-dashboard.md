# v7.5 Controlled-Pilot Readiness Dashboard

Generated: 2026-06-19T21:02:58.743Z

## Overall status

`technical_ready_pending_human_approval`

## Production readiness

`not_ready`

This dashboard is for controlled-pilot readiness review only. It does not approve production use and does not bypass human signoff.

## Gate summary

| Gate | Status | Basis |
| --- | --- | --- |
| Typecheck and build | ✅ passed | Run npm run ci:static locally before committing v7.5. |
| Module acceptance evidence | ✅ passed_with_warnings | status=passed_with_warnings, strict_passed=true |
| Runtime security bridge | ✅ passed | status=passed, service_role_only_rpc_called_by_frontend=0 |
| Security definer execute grants | ✅ passed | remaining_broad_execute_grants=0, strict_passed=true |
| Authenticated persona proof | ✅ passed | authenticated_personas=8, required_scenarios=same organization access allowed,cross organization denial,cross department denial,confidential OVR denial,evidence access scope,self approval prevention,role administration authorization,export and backup denial for normal users,anonymous access denial |
| Restore integrity dry-run | ✅ passed | strict_passed=true, counts_matched=true, smoke_passed=true |
| SQL evidence capture | 🟡 pending | capture_status=captured_pending_human_approval, sql_passed=unknown/unknown |
| Human pilot signoff | 🟡 pending | signoff_valid=unknown |
| OVR confidentiality confirmation | 🟡 pending | confidentiality_valid=unknown |
| Full proof suite | 🟡 failed_review_required | status=failed_review_required, passed=16, failed=1, failed_commands=v66:strict-proof |
| Production readiness | ❌ not_ready | Controlled pilot evidence is not production proof. Production requires separate staging/live validation and approval. |

## Interpretation

- ✅ Passed: evidence exists and the relevant check indicates readiness for controlled-pilot review.
- 🟡 Pending/review required: a human or contextual approval remains required.
- ❌ Not ready: cannot be treated as ready for that gate.

## Correct next commands

After real human approval files are completed:

```powershell
npm run v674:signoff-check
npm run v674:sync-manual-evidence
npm run v66:strict-proof
npm run proof:all
```

## Non-bypass statement

v7.5 intentionally does not modify approval files, bypass `v66:strict-proof`, change RLS, change runtime bridge logic, or mark the system production ready.

