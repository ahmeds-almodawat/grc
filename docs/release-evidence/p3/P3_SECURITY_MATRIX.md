# P3 Staging Security Matrix

| Control | Result | Evidence |
| --- | --- | --- |
| Patch83U frontend contract | PASS | Authenticated Super Admin and Executive bootstrap passed |
| Browser direct RPC | PASS | 0 direct RPC calls; authenticated Edge bridge used |
| Privileged Edge | PASS | `privileged-action` version 6 ACTIVE, JWT required |
| Unauthenticated privileged Edge | PASS | Returns 401 |
| Critical view | PASS | Canonical text projection, security invoker, anon denied |
| Sensitive-table RLS | PASS | Enabled on profiles, roles, risks, compliance, audit, CAPA, training, OVR, projects, evidence, documents, approvals |
| Anonymous governed reads | PASS | Anonymous risk read denied with `permission denied` |
| Governance linkage | PASS | Required views/RPCs present; 23-case foundation proof and P1/P2 proofs pass |
| Read-only persona mutation denial | BLOCKED | Hosted persona activation blocked by CAPTCHA |
| Division/department isolation | BLOCKED | Hosted persona activation blocked by CAPTCHA |
| Cross-organization denial | BLOCKED | Hosted persona activation blocked by CAPTCHA |
| Last-Super-Admin protection | PASS (contract) | Patch83U SQL/E2E regression passes; no hosted destructive attempt |
| Service-role browser exposure | PASS | No browser service-role credential or direct privileged DML |
| Critical/high findings | 0 in completed gates | Hosted multi-persona gate remains incomplete |

CAPTCHA was not disabled or bypassed. The blank external challenge preserved a
fail-closed Sign in control and is the certification blocker.

