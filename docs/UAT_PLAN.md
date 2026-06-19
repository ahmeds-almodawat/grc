# User Acceptance Test Plan

## Objective

Validate that pilot users can complete priority GRC workflows safely using synthetic/non-confidential data.

## Test principles

- Test behavior, not production data.
- Capture issues clearly.
- Separate blockers from warnings.
- Confirm role boundaries.
- Include Arabic/English and RTL review where relevant.

## Priority 1 scenarios

| Scenario | Expected result | Evidence |
|---|---|---|
| Login and role recognition | User sees correct role-specific menu/scope | Screenshot without real data or test note |
| Create synthetic risk | Risk is created and visible only to authorized users | Record ID / test note |
| Create synthetic control | Control links to proper area | Record ID / test note |
| Create synthetic audit item | Audit workflow starts without access leakage | Test note |
| Create synthetic OVR | OVR routes according to workflow | Synthetic OVR ID |
| Quality validation of OVR | Quality reviewer can validate/refer/finalize within scope | Test note |
| Evidence upload with dummy file | File attaches and can be reviewed by authorized persona | Dummy file name |
| Approval workflow | Approval status updates correctly | Test note |
| Reporting dashboard | Dashboard loads with synthetic records | Screenshot without real data |
| Restore/export awareness | Pilot coordinator understands recovery evidence | Checklist confirmation |

## Priority 2 scenarios

- Cross-department synthetic OVR routing.
- Corrective action project creation.
- Board pack snapshot creation with synthetic metrics.
- Global search with permitted scope only.
- Arabic interface review.
- RTL layout review.
- User role assignment through permitted workflow.

## Defect severity

| Severity | Definition | Pilot impact |
|---|---|---|
| Critical | Confidentiality/access breach or data loss risk | Stop pilot |
| High | Blocks Priority 1 workflow | Fix before continuing that scenario |
| Medium | Workaround exists | Track for remediation |
| Low | Cosmetic or wording issue | Track for later |

## Test record format

```text
Scenario:
Tester:
Role:
Date:
Data used: Synthetic / non-confidential
Result: Pass / Fail / Warning
Issue ID:
Evidence:
Reviewer:
```

## Exit criteria

- No critical defects open.
- No unresolved high defects for Priority 1 scenarios.
- All confidentiality rules followed.
- Signoff review pack complete.
