-- ==============================================================================
-- GRC v1.4 — E2B2-EDGE-V14-R1
-- DB207 / DB208 Edge v14 Service-Role Projection Smoke Proof
-- ==============================================================================
-- Validates that all PostgreSQL tables and views queried by Edge Function v14
-- adhere strictly to the real database schema contracts on both DB207 and DB208.
-- ==============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- 1. Profiles projection
SELECT id, organization_id, department_id, division_id, is_active, user_status
FROM public.profiles
LIMIT 0;

-- 2. User Roles projection
SELECT id, role, scope, organization_id, division_id, department_id, is_active
FROM public.user_roles
LIMIT 0;

-- 3. Controlled Documents projection
SELECT id, organization_id, document_owner_id
FROM public.controlled_documents
LIMIT 0;

-- 4. Document Versions projection
SELECT id, document_id, version_number, supersedes_version_id
FROM public.document_versions
LIMIT 0;

-- 5. Document Acknowledgment Requirements projection
SELECT id, document_id, version_id, requirement_scope, user_id, department_id, role_name, required_flag
FROM public.document_acknowledgment_requirements
LIMIT 0;

-- 6. Training Assignments projections (NO organization_id)
SELECT id, program_id, assigned_to_user_id, status, document_version_id, cycle_type
FROM public.training_assignments
LIMIT 0;

SELECT id, assigned_to_user_id, status
FROM public.training_assignments
LIMIT 0;

-- 7. Training Programs projection (owner_user_id, NO program_owner_id, NO organization_id)
SELECT id, owner_user_id, linked_document_id, linked_sop_id, department_id, created_by, training_type
FROM public.training_programs
LIMIT 0;

-- 8. Governed SOP Details projection
SELECT version_id, training_required, retraining_required, competency_assessment_required, competency_reassessment_required
FROM public.governed_sop_details
LIMIT 0;

-- 9. Departments projection
SELECT id, organization_id
FROM public.departments
LIMIT 0;

COMMIT;

-- Output confirmation
DO $$
BEGIN
  RAISE NOTICE 'E2B2 Edge v14 service-role projection smoke test PASSED.';
END $$;
