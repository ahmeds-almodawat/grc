# Module Acceptance Remediation Plan

## Purpose

v7.3 module acceptance passed with warnings and no blocking failures. This plan converts warnings into a structured remediation backlog without blocking controlled pilot unless a warning is reclassified as high or critical.

## Warning categories

| Category | Meaning | Action |
|---|---|---|
| Pilot warning | Acceptable for controlled pilot with monitoring | Track in pilot issue log |
| Documentation warning | Needs SOP/help text/process clarification | Assign documentation owner |
| UX warning | Navigation/layout/wording issue | Assign UI owner |
| Evidence warning | Needs stronger proof/report output | Assign evidence owner |
| Security review warning | Needs IT review before wider rollout | Assign IT owner |

## Remediation rules

- Do not hide warnings.
- Do not convert warnings to passed without evidence.
- Do not block controlled pilot unless the warning affects Priority 1 safety, confidentiality, or access control.
- Track each accepted warning with an owner and target phase.

## Recommended remediation table

```text
Module:
Issue:
Severity:
Pilot impact:
Owner:
Target phase: pilot / post-pilot / production-readiness
Decision:
Evidence needed:
```

## Commands

View warnings:

```powershell
Import-Csv release\v73\module-issues.csv |
  Where-Object { $_.severity -eq "warning" } |
  Select-Object module,issue,detail |
  Format-Table -AutoSize
```

Generate v7.5 review pack:

```powershell
npm run v75:all
```
