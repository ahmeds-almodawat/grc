# v9.8 OVR Workflow Verification

- Generated: 2026-06-21T08:20:08.206Z
- Environment: Local Supabase Docker staging
- Database container: supabase_db_grc-control-center
- Status: **PASSED**
- Blocking failures: 0
- Data policy: synthetic/de-identified pilot data only
- Production readiness: **Not asserted**

| Verification | Result | Evidence |
|---|---|---|
| OVR table exists | PASS | public.ovr_reports is present |
| Required workflow statuses | PASS | Found: draft, submitted, under_supervisor_review, under_quality_review, returned_for_clarification, action_plan_required, corrective_action_in_progress, evidence_submitted, quality_closure_review, closed, rejected, cancelled, major_escalation, rca_required, manager_review, quality_validation, referred_party_response, quality_final_review, disputed, reopened, escalated |
| Required workflow columns | PASS | Required columns found: 18/18 |
| Workflow functions | PASS | Functions: can_close_ovr, v98_update_ovr_workflow, v98_initialize_ovr_submission, v98_notify_ovr_submission |
| Workflow/risk views | PASS | Views: v_ovr_summary, v_ovr_workflow_queue, v_ovr_workflow_control_summary, v_ovr_risk_indicator_summary, v_ovr_risk_indicators_by_department |
| Submission initializes 24-hour manager due date | PASS | Submission trigger sets the due date to current_date + 1 |
| Quality validation gates referral notification | PASS | Referral notification is emitted only inside the post-validation referral transition |
| Reporter accept/dispute and reopen support | PASS | Controlled transition function contains reporter dispute, Quality reopen, and reporter acceptance closure |
| Closure requires verdict and evidence/action | PASS | Final verdict and can_close_ovr guard are both enforced |
| Audit is read-only | PASS | No authenticated auditor update policy; server bridge explicitly rejects auditor-only actors |
| Role-scoped visibility | PASS | RLS covers reporter, assigned/referral parties, relevant managers, Quality/Admin, and Audit |
| Secure server bridge | PASS | Browser calls authenticated Edge Function; service-role database function is not directly browser-executable |
| Frontend lifecycle controls | PASS | OVR page includes role-aware controls for the pilot lifecycle |
| API payload supports referrals/verdict | PASS | grcApi sends structured referral and verdict fields |
| No broad SECURITY DEFINER execution | PASS | Remaining broad grants: 0 |
| OVR audit trigger exists | PASS | Row-change audit trigger is attached |

## Conclusion

The controlled-pilot OVR workflow structures and security controls are present. Run the synthetic E2E proof to validate behavior with real authenticated personas.

