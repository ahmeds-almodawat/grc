# UI-10 Final Discrepancy Register

## Acceptance Summary

- Final UI acceptance blockers: **NONE**
- Material UI defects remaining: **NONE**
- Product source changes required by UI-10: **NONE**
- Backend, schema, RLS, Auth, environment, and deployment changes: **NONE**

## Classified Discrepancies

| ID | Classification | Item | UI acceptance blocker | Recommended later phase |
| --- | --- | --- | --- | --- |
| UI10-01 | A - Match | Shell geometry, information hierarchy, component language, dense registers, details, builders, timelines, dialogs, mobile navigation, dark theme, and RTL presentation match the locked system closely. | No | None |
| UI10-02 | B - Acceptable governed deviation | Live counts and record content are role-, organization-, and RLS-scoped rather than copied from illustrative reference values. | No | None; retain governed reads |
| UI10-03 | B - Acceptable governed deviation | `?page=home` remains the all-role Workspace/Home surface; Executive views remain separate and permission-scoped. | No | None; this is required behavior |
| UI10-04 | B - Acceptable governed deviation | Approved/effective version actions, confidentiality treatment, and workflow actions reflect immutable governed state instead of every illustrative reference action. | No | None; retain workflow controls |
| UI10-05 | B - Acceptable governed deviation | Browser-ineligible administration/provider operations are disabled with an explicit reason rather than exposing secrets or presenting a nonfunctional action. | No | None; retain the security boundary |
| UI10-06 | B - Acceptable governed deviation | Super Admin sees accepted controlled release, UAT, and recovery tools beyond the illustrative administration board. | No | None; retain RBAC gating |
| UI10-07 | D - Reference illustrative | Generated reference counts, sample names, copy variants, and mock record values are visual examples, not business-data authority. | No | None |
| UI10-08 | E - Deferred backend/data contract | The local authenticated My Work read for `accreditation_clause_review_tasks` is denied. The UI fails closed and reports the exact governed read limitation. | No | Backend governed-read contract remediation |
| UI10-09 | E - Deferred backend/data contract | A trusted accreditation readiness aggregate is not available in the accepted local contract. No runtime data is fabricated. | No | Accreditation data-contract phase |
| UI10-10 | E - Deferred backend/data contract | A trusted Recent Governed Activity feed is not available in the accepted local contract. The UI renders an honest empty state. | No | Governance activity-feed contract phase |
| UI10-11 | E - Deferred release contract | Previously accepted release-authorization and production-readiness views are unavailable in the local review stack and remain fail-closed/empty. | No | Release authorization/data-contract closure |
| UI10-12 | Post-UI functional backlog | Shared Policy/SOP governance linkage across OVR, Risk, Audit Finding, Compliance Finding, and CAPA is approved for a future governed implementation. | No | Dedicated post-UI governance-link phase |

## Governance-Link Architecture Backlog

The future shared Policy/SOP governance-link implementation must support each of the following independently:

- Policy links
- Policy Requirement links
- SOP links
- SOP Procedure Step links
- Multiple simultaneous links
- Exact governed document and version linkage
- Reporter suggestions separated from investigator confirmation
- Relationship classifications
- Inherited links into CAPA
- Recurrence and severity analytics
- Governance review triggers

The accepted UI architecture has reusable details, tabs, relationship surfaces, status components, and permission gates. It does not block this future implementation.

## Closure

No item in this register requires a UI-10 product correction. Deferred items remain bounded to later backend, data-contract, release, or governed functional phases.
