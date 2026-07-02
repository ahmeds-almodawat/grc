# Patch 23 Evidence Pack Generator Notes

The Patch 23 pack index is a governed candidate index rather than a binary archive builder.

## Included Fields
- Linked item type and id.
- Linked item title.
- Evidence file id, code, title, file name and type.
- Sensitivity level.
- Review status.
- Reviewer id and name.
- Review timestamp.
- Required-for flags for closure, acceptance, approval and treatment.
- Link timestamp.

## Pack Candidate Rules
- Evidence must be linked through `evidence_links`.
- Accepted evidence is the preferred proof candidate.
- Sensitive evidence remains visible through RLS-scoped views only.
- Expired evidence should be treated as not satisfying active gates unless a waiver exists.

Future file bundle generation should use this index as the manifest and keep actual file access behind the existing storage/RLS controls.
