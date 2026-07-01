# v6.7.3 Security Definer Execute Audit

<<<<<<< Updated upstream
Generated: 2026-07-01T17:28:58.189Z
=======
Generated: 2026-07-01T23:08:38.767Z
>>>>>>> Stashed changes

- SECURITY DEFINER functions: **44**
- Remaining broad execute grants: **0**
- Strict passed: **yes**

## Findings

- None.

## Policy

No public SECURITY DEFINER function may be executable by public, anon, or authenticated. Trusted owner-level execution is service_role-only.
