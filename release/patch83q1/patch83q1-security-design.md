# Patch 83Q.1 Security Design

Patch 83Q.1 adds exactly four allowlisted actions to `privileged-action`. Each action has a literal RPC name and an explicit argument object. No generic RPC executor or caller-controlled RPC name was added.

The existing Bearer-token requirement and Supabase Auth `getUser` validation run before dispatch. The bridge then requires an active profile with an organization and an active role assignment scoped either globally or to that same organization. Pilot review create, status update, and event recording allow `governance_admin` or the existing `executive` role. Executive production signoff allows `governance_admin` or `super_admin`.

UUIDs, the exact live review statuses, bounded event-type identifiers, titles, notes, event summaries, the fixed executive decision, and optional snapshot hashes are validated before RPC execution. Review-targeted calls also verify that the referenced review exists. Database errors are converted to stable bridge errors without returning raw database messages.

Migration 170 remains unchanged. PUBLIC, anon, and authenticated direct execute access remain revoked for all four RPCs, and service_role remains the only execute grantee. Browser code continues to call the authenticated Edge bridge and contains no direct RPC call for these actions.

Department Import remains mapped from `department_import_execute` to the fixed `apply_department_import_batch` RPC, and its frontend feature flag remains disabled by default. User Import remains mapped through `patch19_user_management_bridge`. Neither mapping was changed.
