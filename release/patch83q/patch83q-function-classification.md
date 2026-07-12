# Patch 83Q focused function classification

Live source: schema-only dump from linked project `zbrjjecpsrzposhuarcn`; no table rows were captured.

| Exact signature | Owner | Explicit PUBLIC | Explicit anon | Explicit authenticated | service_role | Browser usage | Edge usage | Behavior and scope | Final category |
|---|---|---:|---:|---:|---:|---|---|---|---|
| `public.create_pilot_go_no_go_review(text, uuid)` | postgres | no; PUBLIC revoked | yes | no | yes | no direct RPC found | frontend intends `privileged-action`; checked-in allowlist missing | write; accepts actor id, no organization check | `confirmed_unsafe_browser_exposure` |
| `public.current_user_org_id()` | postgres | no; PUBLIC revoked | no | yes | yes | indirect RLS/default helper | no | read-only; `auth.uid()` scoped, null caller returns null | `browser_safe_authenticated_read_only` |
| `public.has_any_role(text[])` | postgres | no; PUBLIC implicit default | yes | yes | yes | indirect RLS helper | no | read-only; `auth.uid()` scoped, null caller returns false | `browser_safe_authenticated_read_only` |
| `public.record_executive_production_signoff(uuid, text, text, text)` | postgres | no; PUBLIC revoked | yes | yes | yes | no active direct RPC found | registry says bridge; checked-in allowlist missing | privileged governance write; trusts caller-supplied actor id and lacks organization scope | `confirmed_unsafe_browser_exposure` |
| `public.record_pilot_go_no_go_event(uuid, text, text, uuid)` | postgres | no; PUBLIC revoked | yes | no | yes | no direct RPC found | frontend intends `privileged-action`; checked-in allowlist missing | governance write; accepts actor id, no organization check | `confirmed_unsafe_browser_exposure` |
| `public.update_pilot_go_no_go_review_status(uuid, text, text, uuid)` | postgres | no; PUBLIC revoked | yes | no | yes | no direct RPC found | frontend intends `privileged-action`; checked-in allowlist missing | governance write; accepts actor id, no organization check | `confirmed_unsafe_browser_exposure` |

`public.search_grc_global(text, integer)` is not one of the six: it is owner `postgres`, language SQL, stable, SECURITY INVOKER, read-only, and the only direct browser RPC. Its view/RLS-scoped authenticated design remains classified `read_only_search`; Patch 83Q does not revoke it.

Classification totals for the six: 4 confirmed unsafe browser exposures, 2 browser-safe authenticated read-only helpers, 0 managed observations, 0 overload false positives. The `has_any_role(app_role[])`/`has_any_role(text[])` distinction explains one prior overload mismatch but does not remove the real `text[]` privileges.

Post-migration result: the four `confirmed_unsafe_browser_exposure` overloads now have PUBLIC, anon, and authenticated execution denied and service_role preserved. The two read-only helpers are intentionally unchanged. Post-migration browser-executable total is 2 and unsafe total is 0.
