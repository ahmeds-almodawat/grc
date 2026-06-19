# OVR Confidentiality SOP

## Purpose

OVR and incident workflows can involve sensitive operational, clinical, patient-related, or staff-related information. During controlled pilot, the platform must not contain real patient identifiers or confidential incident details.

## Pilot data rule

Only use:

- Synthetic OVR records.
- Training examples with no real patient names, IDs, MRNs, national IDs, phone numbers, dates of birth, or room/bed traces.
- Non-confidential workflow placeholders.
- Dummy attachments that contain no real information.

Do not use:

- Real patient identifiers.
- Real incident narratives.
- Real staff disciplinary details.
- Real attachments from clinical operations.
- Screenshots containing sensitive records.

## OVR example format

Acceptable synthetic example:

```text
A simulated medication delay was reported in Training Department A. No patient identifier is used. The workflow is used only to test notification routing and corrective action creation.
```

Unacceptable example:

```text
Patient name, MRN, exact room, date, physician name, medication name, and real event timeline.
```

## Access rules during pilot

- Users should only access their assigned pilot scope.
- Cross-department OVR scenarios must use synthetic departments and dummy records.
- Quality review must confirm the scenario does not reveal real confidential content.
- Attachments must be dummy files.

## Confidentiality breach process

If real confidential data is entered:

1. Pause pilot use immediately.
2. Capture minimal metadata only; do not spread the content.
3. Notify IT and Quality reviewers.
4. Remove or quarantine the data according to IT policy.
5. Record the incident in the pilot issue log without repeating the sensitive data.
6. Revalidate before resuming the pilot.

## Evidence handling

When collecting proof:

- Prefer generated JSON/Markdown summaries.
- Avoid screenshots with real data.
- Do not email confidential details.
- Store review packs in controlled access locations.

## Exit requirement

The pilot cannot be approved unless IT and Quality confirm:

```text
No real patient identifiers were used.
No confidential OVR details were used.
Pilot users were controlled.
Local/staging proof was reviewed.
```
