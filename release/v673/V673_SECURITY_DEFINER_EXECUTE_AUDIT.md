# v6.7.3 Security Definer Execute Audit

Generated: 2026-07-02T00:16:22.278Z

- SECURITY DEFINER functions: **52**
- Remaining broad execute grants: **14**
- Strict passed: **no**

## Findings

- `can_access_org(uuid)` is executable by `authenticated`.
- `can_manage_grc()` is executable by `authenticated`.
- `patch21_actor_is_owner(uuid,uuid)` is executable by `anon`.
- `patch21_actor_is_owner(uuid,uuid)` is executable by `authenticated`.
- `patch21_actor_is_owner(uuid,uuid)` is executable by `public`.
- `patch21_actor_is_quality(uuid,uuid)` is executable by `anon`.
- `patch21_actor_is_quality(uuid,uuid)` is executable by `authenticated`.
- `patch21_actor_is_quality(uuid,uuid)` is executable by `public`.
- `patch21_can_close_ovr(uuid,uuid,text)` is executable by `anon`.
- `patch21_can_close_ovr(uuid,uuid,text)` is executable by `authenticated`.
- `patch21_can_close_ovr(uuid,uuid,text)` is executable by `public`.
- `patch21_write_ovr_audit_event(uuid,uuid,text,text,jsonb,jsonb)` is executable by `anon`.
- `patch21_write_ovr_audit_event(uuid,uuid,text,text,jsonb,jsonb)` is executable by `authenticated`.
- `patch21_write_ovr_audit_event(uuid,uuid,text,text,jsonb,jsonb)` is executable by `public`.

## Policy

No public SECURITY DEFINER function may be executable by public, anon, or authenticated. Trusted owner-level execution is service_role-only.
