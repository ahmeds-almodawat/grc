# P3 Hosted Staging UAT Matrix

## Authenticated Smoke

| Persona / area | Result | Evidence |
| --- | --- | --- |
| Super Admin Auth/Patch83U/profile/RBAC | PASS | Normal CAPTCHA login, forced password transition, fresh login, Home loaded |
| Super Admin application routes | PASS | Home, Executive, Governance, Policy, SOP, Risk, Compliance, Audit, CAPA, Training, OVR, Projects, Evidence, My Work, Reports, Admin rendered without fatal error |
| Executive Auth/Patch83U/profile/RBAC | PASS | Normal CAPTCHA login, forced password transition, fresh login |
| Executive positive routes | PASS | Home, Executive Dashboard, Reports |
| Executive negative routes | PASS | Direct Admin and Access Control navigation rejected |
| Division Head | BLOCKED | Turnstile widget unavailable before Auth submission |
| Department Manager | NOT RUN | Dependent on CAPTCHA recovery |
| Contributor / Reporter | NOT RUN | Dependent on CAPTCHA recovery |
| Read-only external auditor | NOT RUN | Dependent on CAPTCHA recovery |

No fatal browser console errors, authentication loops, unexpected 5xx, or new
profile-bootstrap errors were observed in the completed hosted smoke.

## Workflow Coverage

| Workflow | Hosted read smoke | Rollback-safe contract proof | Hosted mutation UAT |
| --- | --- | --- | --- |
| Policy | PASS | PASS | NOT COMPLETE |
| SOP | PASS | PASS | NOT COMPLETE |
| Risk | PASS | PASS | NOT COMPLETE |
| Compliance | PASS | PASS | NOT COMPLETE |
| Audit | PASS | PASS | NOT COMPLETE |
| CAPA | PASS | PASS | NOT COMPLETE |
| Training | PASS | PASS | NOT COMPLETE |
| OVR | PASS | PASS | NOT COMPLETE |
| Projects | PASS | PASS | NOT COMPLETE |
| Evidence | PASS | PASS | NOT COMPLETE |
| My Work / Approvals | PASS | PASS | NOT COMPLETE |
| Reports / analytics | PASS | PASS | Read/drill-down regression PASS; hosted persona matrix incomplete |
| Admin / import | PASS as Super Admin | PASS | No import executed; staging flag remains disabled |

## Governance Linkage

The final rollback-safe proof suite passes suggested/confirmed/rejected links,
Policy plus SOP, exact versions, Requirement/Step, Risk, Audit, Compliance,
CAPA inheritance/provenance, analytics truth, and initiate-only review triggers.
All required staging views and RPCs exist.

Hosted mutation UAT is NOT COMPLETE and the local/SQL evidence is not being
substituted for the missing multi-persona staging run.

## Disposable Persona Cleanup

- Six staging-only personas were created through governed provisioning.
- Super Admin and Executive reached completed provisioning, then were
  deactivated through `patch83u_apply_user_lifecycle`; credentials are disabled
  and active roles are zero.
- Four personas remain in `initial_change_required` because the canonical
  lifecycle function forbids deactivation while provisioning is open. They
  retain zero active roles and cannot bootstrap application authorization.
- The temporary credential file was deleted and no credential is recorded in
  Git or release evidence.

