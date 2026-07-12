-- ==============================================================
-- PATCH 83H: FIRST NARROW RLS REMEDIATION
-- Target Table: public.document_center_items
-- Risk Level: Low (replaces excessively broad policy with explicit scope)
-- Rollback: See Patch 83H documentation for rollback instructions
-- ==============================================================

BEGIN;

-- 1. Drop the excessively broad authenticated read policy
DROP POLICY IF EXISTS document_center_items_read ON public.document_center_items;

-- 2. Create the tightened, scoped read policy
CREATE POLICY document_center_items_read_scoped ON public.document_center_items
FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR public.can_access_scope(organization_id, division_id, department_id, null)
  OR public.has_any_role(array['super_admin']::public.app_role[])
);

COMMIT;
