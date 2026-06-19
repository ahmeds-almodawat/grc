# Pilot Incident Response Playbook

## Purpose

Define immediate actions for confidentiality, access, evidence, or system incidents during controlled pilot.

## Incident types

| Type | Examples |
|---|---|
| Confidentiality | Real patient identifier entered; confidential OVR data uploaded. |
| Access control | User sees records outside authorized scope. |
| Data integrity | Records lost, duplicated, or corrupted. |
| Evidence integrity | Proof output inconsistent or cannot be reproduced. |
| Availability | Pilot system unavailable. |
| Misleading output | Dashboard/report suggests false compliance status. |

## Immediate response

1. Stop the affected workflow.
2. Do not spread sensitive content.
3. Notify IT and Quality.
4. Preserve minimal safe metadata.
5. Remove/quarantine sensitive content if required.
6. Document issue without repeating confidential details.
7. Decide whether to pause entire pilot.

## Severity levels

| Severity | Meaning | Action |
|---|---|---|
| Critical | Confidentiality breach, access leakage, major data loss | Pause pilot immediately |
| High | Priority workflow blocked or evidence invalid | Pause affected scenario |
| Medium | Workaround exists | Track and remediate |
| Low | Cosmetic or minor issue | Backlog |

## Safe incident log format

```text
Incident ID:
Date/time:
Reporter:
Module:
Severity:
Type:
Summary without confidential detail:
Synthetic/non-confidential data confirmed? yes/no
Immediate action:
Owner:
Status:
Final decision:
```

## Restart criteria

A paused pilot can resume only after:

- Root cause is understood.
- Confidential data is removed/quarantined if applicable.
- IT confirms technical control.
- Quality confirms confidentiality/process safety.
- Management/Admin approves continuation for critical incidents.
