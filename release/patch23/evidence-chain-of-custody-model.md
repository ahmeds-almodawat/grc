# Patch 23 Evidence Chain Of Custody Model

`evidence_review_events` is the custody ledger for Patch 23.

## Event Types
- `uploaded`
- `linked`
- `submitted_for_review`
- `accepted`
- `rejected`
- `needs_revision`
- `superseded`
- `locked`
- `expired`
- `renewed`
- `downloaded`
- `viewed`
- `waiver_requested`
- `waiver_approved`
- `waiver_rejected`

## Event Fields
- Evidence id and organization id.
- Event type.
- Previous and new review status.
- Actor id.
- Note.
- Metadata JSON for linked item, requirement, waiver or generated pack details.
- Created timestamp.

The chain is append-only through the governed bridge. Review, lock, supersede, link, waiver and pack-index actions write events so audit reviewers can see how evidence became accepted or waived.
