# Operations Support Model

## Support objective

Ensure pilot users have clear support channels, triage rules, and escalation paths during the controlled pilot.

## Support roles

| Role | Responsibility |
|---|---|
| Pilot coordinator | First point of contact for user questions and test coordination. |
| IT support | Technical access, environment, build, restore, and security concerns. |
| Quality support | OVR workflow, confidentiality, and process interpretation. |
| Management/Admin sponsor | Scope decisions, go/no-go decisions, user limit approvals. |

## Support channels

Define before pilot start:

```text
Primary support channel:
Backup support channel:
Daily review time:
Emergency contact for confidentiality breach:
```

## Triage categories

| Category | Examples | Owner |
|---|---|---|
| Access issue | User cannot access assigned module; role mismatch | IT |
| Workflow issue | OVR/risk/audit flow unclear or blocked | Quality + IT |
| Data concern | Potential real data or confidential data entered | Quality + IT |
| UI/UX issue | Layout, Arabic/RTL, wording, navigation | Pilot coordinator |
| Evidence issue | Proof output missing or unclear | IT |

## SLA guidance for pilot

| Severity | Response target | Resolution target |
|---|---:|---:|
| Critical | Same day | Pause pilot until contained |
| High | Same day | 1–2 pilot days |
| Medium | 2 pilot days | Track for next patch |
| Low | Weekly review | Backlog |

## Daily issue log fields

```text
Issue ID
Date
Reporter
Role
Module
Severity
Description
Synthetic record ID
Data confidentiality confirmed? yes/no
Owner
Status
Resolution
```

## Pilot closure support review

At pilot end, review:

- Total issues by severity.
- Repeated user pain points.
- Access or role problems.
- Confidentiality incidents.
- Evidence generation problems.
- Recommended fixes before wider rollout.
