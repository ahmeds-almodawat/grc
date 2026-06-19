# Controlled Pilot Data Handling Policy

## Data classification

| Classification | Pilot allowed? | Examples |
|---|---:|---|
| Synthetic data | Yes | Dummy users, fake OVRs, training risks, sample evidence. |
| Non-confidential operational data | Limited | Generic department names or non-sensitive process examples. |
| Confidential OVR data | No | Real incident narratives, real patient/staff details. |
| Patient identifiers | No | MRN, national ID, patient name, phone, DOB. |
| Production data | No | Live operational records, official audit evidence, real reports. |

## Minimum necessary principle

Only enter the minimum information needed to test workflow behavior. Pilot records should prove routing, permissions, evidence handling, reporting, and usability without exposing real information.

## Attachments

Allowed:

- Dummy PDFs.
- Dummy images.
- Synthetic evidence files.
- Generated test output files.

Not allowed:

- Clinical images.
- Patient documents.
- Real OVR attachments.
- HR disciplinary documents.
- Contracts or financial records unless specifically cleared and anonymized.

## Screenshots

Screenshots are allowed only when they contain:

- Synthetic data.
- Non-confidential UI states.
- No patient identifiers.
- No confidential incident details.

## Retention

Pilot evidence should be retained only for the pilot review period unless Management/Admin, IT, and Quality define a longer retention requirement.

## Deletion and cleanup

Before pilot closure:

1. Identify synthetic pilot data.
2. Confirm no real confidential data exists.
3. Export allowed pilot evidence.
4. Remove unnecessary test records if required.
5. Preserve final signoff and review pack.

## Ownership

| Area | Owner |
|---|---|
| Technical data handling | IT |
| OVR confidentiality | Quality |
| Pilot scope approval | Management/Admin |
| Daily compliance | Pilot coordinator |
