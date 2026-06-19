# v6.5 Auth Security Smoke

```json
{
  "generated_at": "2026-06-18T19:38:11.234Z",
  "checks_total": 7,
  "failed_count": 0,
  "strict_passed": true,
  "note": "Static auth smoke only. Full proof still requires browser tests with real session/personas."
}
```

## Checks

- ✅ AUTH_PROVIDER_FILE: AuthProvider.tsx exists.
- ✅ AUTH_PROVIDER_USED: App uses AuthProvider or auth context.
- ✅ LOGIN_PAGE_FILE: LoginPage.tsx exists.
- ✅ UNAUTHORIZED_PAGE_FILE: UnauthorizedPage.tsx exists.
- ✅ ROLE_ACCESS_HELPER: Role/route access helper exists.
- ✅ LAYOUT_AUTH_AWARE: Layout appears auth-aware.
- ✅ PROD_BYPASS_DISABLED: Production auth bypass is disabled in env example.
