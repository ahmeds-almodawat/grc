# Patch 83P Frontend Activation Readiness

- Activation decision: `ready_for_controlled_vercel_enablement`
- Frontend execution enabled in repository: `false`
- Production deployment executed: `false`
- Production environment modified: `false`
- Production readiness claim: `false`

The repository contains a fail-closed Vite feature flag. Only exact lowercase `true` enables Department Import execution; absent, empty, `false`, `TRUE`, `1`, and all other values disable it.

Preview remains available without the execution flag and does not modify data. Execution additionally requires a signed-in `super_admin` or `governance_admin`, a resolved organization, a validated preview with at least one valid row and no blocking errors, and either `create_only` or `create_and_update` mode.

The browser path invokes only privileged action `department_import_execute`. It does not directly call `apply_department_import_batch`, and no service-role credential is configured in client code. User Import is unchanged.

This package establishes controlled frontend activation readiness only. It does not claim production readiness.
