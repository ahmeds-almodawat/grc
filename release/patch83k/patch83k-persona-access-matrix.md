# Patch 83K: Persona Access Matrix

**Status:** **BLOCKED**

| persona | active_roles | organization | division | department | ownership_relationship | test_scope | expected_select | actual_select | pass_fail | evidence_reference |
|---------|--------------|--------------|----------|------------|------------------------|------------|-----------------|---------------|-----------|--------------------|
| owner | N/A | N/A | N/A | N/A | Owner | In-scope | Allowed | BLOCKED | BLOCKED | N/A |
| same-scope | None | OrgA | DivA | DeptA1 | None | In-scope | Allowed | BLOCKED | BLOCKED | N/A |
| different-dept | None | OrgA | DivA | DeptA2 | None | Out-of-scope | Denied | BLOCKED | BLOCKED | N/A |
| cross-org | None | OrgB | DivB | DeptB1 | None | Out-of-scope | explicitly unsupported with evidence (blocked) | BLOCKED | BLOCKED | N/A |
| dept manager | manager | OrgA | DivA | DeptA1 | None | In-scope | Allowed | BLOCKED | BLOCKED | N/A |
| auditor (in) | auditor | OrgA | DivA | DeptA1 | None | In-scope | Allowed | BLOCKED | BLOCKED | N/A |
| auditor (out)| auditor | OrgA | DivA | DeptA2 | None | Out-of-scope | Denied | BLOCKED | BLOCKED | N/A |
| exec (in) | executive | OrgA | DivA | DeptA1 | None | In-scope | Allowed | BLOCKED | BLOCKED | N/A |
| exec (out) | executive | OrgA | DivA | DeptA2 | None | Out-of-scope | Denied | BLOCKED | BLOCKED | N/A |
| comp_off (in)| compliance | OrgA | DivA | DeptA1 | None | In-scope | Allowed | BLOCKED | BLOCKED | N/A |
| comp_off (out)| compliance | OrgA | DivA | DeptA2 | None | Out-of-scope | Denied | BLOCKED | BLOCKED | N/A |
| gov_admin (in)| gov_admin | OrgA | DivA | DeptA1 | None | In-scope | Allowed | BLOCKED | BLOCKED | N/A |
| gov_admin (out)| gov_admin | OrgA | DivA | DeptA2 | None | Out-of-scope | Denied | BLOCKED | BLOCKED | N/A |
| super_admin | super_admin | N/A | N/A | N/A | None | Global | Allowed | BLOCKED | BLOCKED | N/A |
| anonymous | N/A | N/A | N/A | N/A | None | Global | Denied | BLOCKED | BLOCKED | N/A |
