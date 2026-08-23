# P2 Deployment Plan

This plan is prepared only; P2 authorizes no deployment.

1. Inventory target migration ledger, schema drift, function versions, frontend
   artifact, Auth configuration, and environment-contract presence.
2. Confirm backup/restore readiness, maintenance window, owners, acceptance
   authority, and rollback decision channel.
3. Apply forward migrations in ledger order: 217-219 if absent, then 220-222.
   Never edit or replay an already-recorded historical migration.
4. Verify migration ceiling, views/functions, constraints/FKs/indexes, explicit
   grants, RLS, critical-attention/activity objects, and canonical readiness APIs.
5. Deploy the versioned privileged-action Edge Function because P1 changed its
   governed review-trigger bridge; verify anonymous denial and authenticated contract.
6. Verify, but do not invent, required Supabase Auth/CAPTCHA and feature-flag
   configuration against `P2_ENVIRONMENT_CONTRACT.md`.
7. Build and deploy the immutable frontend RC artifact with browser-safe values only.
8. Run fresh authenticated smoke for Patch83U, profile, RBAC, Home, and all core routes.
9. Run a reversible, explicitly identified safe-write smoke for governance-link
   suggestion/decision/inheritance and clean it up under the approved protocol.
10. Monitor Auth, Edge, PostgREST, database errors, isolation denials, and frontend
    runtime health; obtain acceptance evidence and owner signoff.
11. Invoke rollback/recovery on any migration-contract, Auth/bootstrap, isolation,
    security, data-integrity, or material route failure.

