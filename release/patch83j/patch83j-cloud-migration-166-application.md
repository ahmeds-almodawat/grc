# Patch 83J: Controlled Cloud Application of Migration 166

## Application Details
- **Exact application method:** Supabase CLI `supabase db push`. Migration 166 was the only unapplied migration globally and was pushed successfully without triggering the application of any other migration files.
- **Migration history state:** The remote Supabase migration history table successfully recorded `166_patch83h_first_narrow_rls_remediation.sql` as applied (`166 | 166 | 166`).
- **Unrelated migrations applied:** false.
- **Migration repair executed:** false.
- **db reset executed:** false.

## Policy State
- **Pre-policy state:** `document_center_items_read` existed as a broad `USING (true)` policy.
- **Post-policy state:**
  - `document_center_items_read` was dropped.
  - `document_center_items_read_scoped` was created.
- **Exact SQL applied:**
  ```sql
  DROP POLICY IF EXISTS document_center_items_read ON public.document_center_items;

  CREATE POLICY document_center_items_read_scoped ON public.document_center_items
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.can_access_scope(organization_id, division_id, department_id, null)
    OR public.has_any_role(array['super_admin']::public.app_role[])
  );
  ```
- **Write policy unchanged:** Yes. The migration only targets the `SELECT` policy and explicitly scopes read access.
- **RLS state:** Enabled.

## Rollback Readiness and Errors
- **Errors:** None. The CLI pushed the migration smoothly and the transaction committed.
- **Rollback readiness:** Rollback would be achieved via dropping `document_center_items_read_scoped` and recreating the old `USING (true)` `document_center_items_read` policy. The state exactly matches what a manual rollback script would expect.
- **Production data changed:** false. (Only policy metadata was modified).

## Next Steps
- **Patch 83K persona tests required next:** Yes.
- **Production-Readiness:** No production-readiness claim is made. This patch was a targeted application of a single schema remediation.
