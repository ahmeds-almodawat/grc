# Patch 22 Risk Workflow Hardening Checklist

## Scope

- [x] Additive migration created at `supabase/migrations/084_patch22_risk_workflow_hardening.sql`.
- [x] Existing `risks` table preserved and extended without dropping columns or tables.
- [x] Risk owner, control owner, treatment owner, and executive sponsor fields added.
- [x] Appetite, treatment, acceptance, review, closure, escalation, duplicate, and source-linkage fields added.
- [x] KRI indicators, reassessment history, and workflow events tables added.
- [x] Workflow queue, appetite breach, treatment queue, KRI alert, executive escalation, and closure blocker views added.
- [x] Governed workflow actions routed through the existing authenticated privileged-action bridge.
- [x] Risk page upgraded with workflow queues, warning panels, detail modal, action buttons, history, and workflow events.
- [x] TypeScript compatibility preserved for existing `RiskRow` consumers.
- [x] Patch 22 proof scripts and package aliases added.

## Safety

- [x] No database reset.
- [x] No destructive table drops.
- [x] No browser service-role operation.
- [x] No Patch 20 import logic changes.
- [x] No Patch 21 OVR workflow rewrite.
- [x] No payroll-sensitive fields touched.
- [x] Existing Risk route and page remain available.

## Validation Gates

- [x] `npm run typecheck`
- [x] `npm run build`
- [x] `npm run patch22:all`
- [ ] `npm run proof:all` completed but broader legacy proof gates remain blocked.
- [ ] `npm run v700:runtime-security` completed with exit code 0 but report status remains `critical_remediation_required`.
