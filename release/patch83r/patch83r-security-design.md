# Patch 83R security design

The browser invokes only four fixed `privileged-action` names. The Edge Function validates the JWT, derives the actor from the verified session, requires an active global `super_admin` or `governance_admin` assignment scoped to the actor organization, validates UUIDs and bounded text, and maps each action to one exact RPC contract.

All four database functions require `auth.role() = service_role`, repeat the active actor, role, scope, and organization checks, and have execution revoked from `PUBLIC`, `anon`, and `authenticated`. Only `service_role` receives execute permission. The browser contains no direct RPC call to these functions, no arbitrary RPC name can be supplied, and database errors are mapped to stable structured lifecycle codes without raw detail leakage.

Migration 171 does not disable RLS, drop policies, alter migration 170, or expose service-role credentials.
