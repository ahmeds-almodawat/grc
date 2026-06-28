# v10.0 Unified CAPA + Risk-Control Foundation Report

- Generated: 2026-06-28T12:47:00.972Z
- Status: **patch generated / static-audit ready**
- Production readiness: **not asserted**
- Approval gates: **unchanged**
- Patient identifiers: **not required**

## What v10.0 adds

| Module | Database objects | Purpose |
|---|---|---|
| Unified CAPA | `capa_cases + capa_action_items` | OVR, risk, control test, audit finding, compliance, policy, UAT issue sources can converge into CAPA. |
| Risk Register lifecycle | `risks extended` | Risk statement, causes, consequences, appetite, treatment owner/due date, KRI/control/assurance summaries. |
| Controls Library | `control_library_items + risk_control_mappings` | Reusable controls can be mapped to multiple risks and obligations. |
| Control Testing | `control_tests` | Design/operating effectiveness, samples, exceptions, evidence summaries, remediation linkage. |
| Compliance Obligations | `compliance_obligations + compliance_obligation_mappings` | Requirements mapped to controls, risks, evidence, policies, and CAPA. |
| Issue/Finding Register | `grc_issue_register` | Shared register for OVR gaps, risk issues, control gaps, audit findings, compliance gaps and UAT bugs. |
| Audit Program Foundation | `audit_universe_items + audit_engagements + audit_workpapers` | Audit universe, engagements, workpapers, fieldwork/reporting/follow-up statuses. |
| Executive Views | `v100_* views` | Risk/control/CAPA dashboard, overdue CAPA actions, control-test effectiveness summary. |

## Safe scope

This patch strengthens the GRC foundation while keeping light production scope controlled. It does not claim full enterprise GRC production readiness by itself.

Recommended operational scope after UAT and approvals:

1. OVR / Quality workflow.
2. CAPA from OVR, audit findings, control-test failures, risk and compliance gaps.
3. Risk register with treatment and appetite review.
4. Controls library and evidence-backed control testing.
5. Audit and compliance foundation in controlled pilot mode.

## Non-goals

- No fake approvals.
- No v66 bypass.
- No service-role key in browser.
- No patient identifiers.
- No full vendor risk / BCP / training rollout yet.

## Recommended validation commands

```powershell
npm run v100:foundation-audit
npm run v100:foundation-report
npm run v100:final-proof
npm run typecheck
npm run build
npm run pilot:uat-readiness
npm run proof:all
```

## Manual review checklist

- [ ] Apply migration to local Supabase first.
- [ ] Confirm new tables have RLS enabled.
- [ ] Confirm no delete grants are exposed to normal authenticated users.
- [ ] Login as Governance Admin and verify risk/control/CAPA records are visible only in allowed scope.
- [ ] Login as Auditor and verify audit surfaces behave as intended.
- [ ] Login as Employee and verify no admin/global data leakage.
- [ ] Confirm v66 still blocks until real approval files are completed.
