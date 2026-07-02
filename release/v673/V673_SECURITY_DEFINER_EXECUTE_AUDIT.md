# v6.7.3 Security Definer Execute Audit

Generated: 2026-07-02T16:29:50.012Z

- SECURITY DEFINER functions: **50**
- Remaining broad execute grants: **0**
- Strict passed: **yes**

## Findings

- None.

## Policy

No public SECURITY DEFINER function may be executable by public, anon, or authenticated. Trusted owner-level execution is service_role-only.
