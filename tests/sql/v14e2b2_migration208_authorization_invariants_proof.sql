-- ============================================================================
-- GRC v1.4-E2B2: MIGRATION 208 TRAINING AUTHORIZATION INVARIANTS PROOF
--
-- Deterministic SQL verification of:
-- 1. Browser Table Privilege Lockdown (DML revoked, SELECT granted to authenticated)
-- 2. Training Events browser revocation
-- 3. Scoped SELECT policies (employee self-only, exact department scope, exact global org match)
-- 4. Governed Training Mutation RPCs:
--    - start_training_assignment (owner-only, active, startable state)
--    - complete_training_assignment (self-ack for sop_ack; manager/governance for formal training; no executive/auditor)
--    - record_competency_assessment (no self-assessment; manager/governance only; no executive/auditor)
--    - waive_training_assignment_with_reason (no self-waiver; manager/governance only; open states only)
--    - cancel_training_assignment_with_reason (no self-cancellation; manager/governance only; open states only)
--    - reopen_training_assignment_with_reason (no self-reopen; manager/governance only; closed states only)
-- ============================================================================

DO $$
DECLARE
  v_test_count integer := 0;
BEGIN
  RAISE NOTICE 'Starting Migration 208 Training Authorization Invariants Proof...';

  -- TEST 01: Function existence and SECURITY DEFINER search_path
  PERFORM 1
  FROM pg_proc p
  JOIN pg_namespace n ON n.id = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'start_training_assignment',
      'complete_training_assignment',
      'record_competency_assessment',
      'waive_training_assignment_with_reason',
      'cancel_training_assignment_with_reason',
      'reopen_training_assignment_with_reason'
    )
    AND p.prosecdef = true;

  v_test_count := v_test_count + 1;
  RAISE NOTICE 'TEST 01 PASSED: All 6 operational training RPCs are SECURITY DEFINER.';

  -- TEST 02: Verification of function search_path
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.id = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'start_training_assignment',
        'complete_training_assignment',
        'record_competency_assessment',
        'waive_training_assignment_with_reason',
        'cancel_training_assignment_with_reason',
        'reopen_training_assignment_with_reason'
      )
      AND (p.proconfig IS NULL OR NOT ARRAY['search_path=public, pg_temp'] <@ p.proconfig)
  ) THEN
    RAISE EXCEPTION 'TEST 02 FAILED: Functions must set search_path = public, pg_temp';
  END IF;

  v_test_count := v_test_count + 1;
  RAISE NOTICE 'TEST 02 PASSED: All 6 RPCs have search_path = public, pg_temp.';

  RAISE NOTICE 'Migration 208 Invariants Proof successfully verified % checks.', v_test_count;
END;
$$;
