# v11.0 Enterprise GRC Program Suite Report

- Generated: 2026-06-28T13:21:45.169Z
- Status: **controlled enterprise foundation ready for UAT after migration apply**
- Production readiness: **not asserted**
- Patient/confidential data requirement: **none**

## Modules added

1. **Policy & Document Control** — Documents, versions, review dates, approval status, linked risks/controls/obligations, attestation requirement.
2. **Policy Attestation** — User/department acknowledgements, overdue status, waiver reason, due dates.
3. **Training & Compliance Learning** — Courses, recurring assignments, completion status, evidence link.
4. **Third-Party / Vendor Risk** — Vendor criticality, data access level, assessment cadence, inherent/residual risk, linked issues/CAPA.
5. **KRI / KPI Monitoring** — KRI definitions, measurements, thresholds, trend, red/amber/green ratings.
6. **Regulatory Change Management** — Source, effective date, impact, obligation/control/policy mapping, action tracking.
7. **Risk Acceptance / Exceptions** — Temporary deviations, policy/control exceptions, compensating controls, expiry dates.
8. **Business Continuity / Resilience** — Business impact process register, RTO/RPO, continuity plans, drills/exercises.
9. **Audit Follow-up** — Finding/CAPA/issue follow-up reviews, management update, validation result.
10. **Board Pack Readiness** — Security-invoker views summarizing maturity, overdue items, high risk vendors, red KRIs.

## Operating model

This pack extends v10.0 rather than replacing it. v10.0 created the CAPA/risk-control foundation. v11.0 adds the enterprise program layer around it: policy, attestation, training, vendor risk, KRI, regulatory change, exceptions, BCP, audit follow-up, and board reporting readiness.

## Safety controls

- New tables have RLS enabled.
- Authenticated users receive select/insert/update only; no delete grant is introduced.
- Executive/security views are declared with security_invoker.
- No service-role browser usage is introduced.
- The v66 human approval gate is not modified or bypassed.

## Manual review required

- Confirm the migration applies cleanly after v10.0 in local Docker Supabase.
- Confirm representative role visibility for super_admin, governance_admin, compliance_officer, auditor, department_manager, employee, viewer, and external-denial users.
- Confirm Arabic/RTL labels once UI pages are later added for these data objects.
- Keep this as controlled UAT until real Management/Admin, IT, and Quality approvals are completed.
