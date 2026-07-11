# Patch 83H: First Narrow RLS Remediation

## Statement of Intent
This patch is intended for local/staging validation only. It is **not applied to production**. No supabase db push has been performed. This is a one-table scope only remediation, and makes no production-readiness claims.
- migration has not been applied anywhere
- runtime RLS testing is still pending

## 1. Selected Table
**Table:** `public.document_center_items`
**Why selected (Low Risk):**
- It contains clear ownership fields (`organization_id`, `department_id`, `owner_id`).
- It is not a high-risk privileged action or auth/security table.
- It had an excessively broad `using (true)` read policy that required tightening.
- It relies entirely on standard read access semantics without complex cross-table joining.

## 2. Verified Schema Columns
- `organization_id` (uuid)
- `division_id` (uuid)
- `department_id` (uuid)
- `owner_id` (uuid)

## 3. Existing Policy Inventory
- `document_center_items_read`: `FOR SELECT TO authenticated USING (true);`
- `document_center_items_write`: Uses `exists (select 1 from user_roles ...)` (Left untouched).

## 4. Existing Application Access Patterns
- The frontend document center renders tables filtered by the user's current organization context in UI logic.
- Tightening RLS to strictly enforce this at the database level does not break the UI because the UI was already visually filtering by department/org context.

## 5. Access Behavior Before Migration
Any authenticated user could read all `document_center_items` across the entire platform, bypassing organization and department separation.

## 6. Access Behavior After Migration
An authenticated user can only read a document if:
- They are the explicit `owner_id`.
- They belong to the matching `organization_id` / `department_id` (via `public.can_access_scope`).
- They possess the `super_admin` role.

Specifically:
- auditor access is scope-controlled, not global
- governance and compliance roles are scope-controlled
- executive access is scope-controlled
- only super_admin has the explicit global bypass

## 7. Positive Test Cases
- User in `Dept A` can view documents belonging to `Dept A`.
- `owner_id` can view their own document regardless of department association.
- `super_admin` can read all documents platform-wide.

## 8. Negative Test Cases
- User in `Dept A` receives 0 rows when querying documents for `Dept B`.
- Auditor in `Dept A` receives 0 rows when querying documents for `Dept B`.
- Anonymous requests receive 0 rows (table requires authenticated).

## 9. Cross-Department / Cross-Organization Denial
- A user explicitly queries `SELECT * FROM document_center_items WHERE department_id = 'foreign-dept-uuid'`. The result is empty, denied natively by PostgreSQL RLS.

## 10. Auditor / Read-Only Behavior
- Auditor access is scope-controlled, not global. They rely on `public.can_access_scope`.

## 11. Service-Role Behavior
- Untouched. Service-role inherently bypasses RLS and maintains full access.

## 12. Rollback SQL
```sql
BEGIN;
DROP POLICY IF EXISTS document_center_items_read_scoped ON public.document_center_items;
CREATE POLICY document_center_items_read ON public.document_center_items
FOR SELECT TO authenticated USING (true);
COMMIT;
```

## 13. Known Limitations
- Relies on correct data seeding in staging to fully validate `can_access_scope` behavior.
- Runtime performance impact of `can_access_scope` evaluated positively in theory, but requires staging observation.
