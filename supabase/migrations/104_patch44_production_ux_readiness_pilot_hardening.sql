-- Migration: 104_patch44_production_ux_readiness_pilot_hardening.sql
-- Description: Patch 44 UX and Pilot Go/No-Go Hardening
-- Safety: No destructive operations. Additive only.

BEGIN;

-- 1. Tables for Pilot Go/No-Go
CREATE TABLE IF NOT EXISTS public.pilot_go_no_go_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_title text NOT NULL,
    review_status text NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'ready_for_review', 'approved_for_controlled_pilot', 'approved_with_limitations', 'blocked', 'rejected')),
    readiness_score numeric,
    blocker_count integer NOT NULL DEFAULT 0,
    accepted_limitation_count integer NOT NULL DEFAULT 0,
    open_limitation_count integer NOT NULL DEFAULT 0,
    backup_restore_status text,
    proof_suite_status text,
    runtime_security_status text,
    bilingual_readiness_status text,
    navigation_readiness_status text,
    reviewer_user_id uuid REFERENCES auth.users(id),
    reviewed_at timestamptz,
    review_notes text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.pilot_go_no_go_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pilot_go_no_go_reviews_select_all" ON public.pilot_go_no_go_reviews FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.pilot_go_no_go_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id uuid REFERENCES public.pilot_go_no_go_reviews(id),
    event_type text NOT NULL,
    event_summary text NOT NULL,
    actor_user_id uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.pilot_go_no_go_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pilot_go_no_go_events_select_all" ON public.pilot_go_no_go_events FOR SELECT USING (true);


-- 2. Views (security_invoker = true)
CREATE OR REPLACE VIEW public.v_patch44_role_landing_matrix WITH (security_invoker = true) AS
SELECT 
    'regular' as role_category, 'Unified My Work' as landing_page
UNION ALL SELECT 'department_manager', 'Department Work / My Work'
UNION ALL SELECT 'quality', 'Quality & Safety'
UNION ALL SELECT 'accreditation_owner', 'Accreditation War Room'
UNION ALL SELECT 'auditor', 'Audit Execution'
UNION ALL SELECT 'executive', 'Executive Summary / Go-No-Go'
UNION ALL SELECT 'admin', 'Production Readiness / System Control';

CREATE OR REPLACE VIEW public.v_patch44_navigation_readiness_map WITH (security_invoker = true) AS
SELECT * FROM public.v_patch40_navigation_simplification_register;

CREATE OR REPLACE VIEW public.v_patch44_production_readiness_summary WITH (security_invoker = true) AS
SELECT * FROM public.v_patch40_production_readiness_signoff_register;

CREATE OR REPLACE VIEW public.v_patch44_backup_restore_readiness_summary WITH (security_invoker = true) AS
SELECT * FROM public.v_patch40_backup_restore_operations_dashboard;

CREATE OR REPLACE VIEW public.v_patch44_known_limitations_summary WITH (security_invoker = true) AS
SELECT * FROM public.v_patch40_known_limitations_register;

CREATE OR REPLACE VIEW public.v_patch44_bilingual_readiness_summary WITH (security_invoker = true) AS
SELECT * FROM public.v_patch40_bilingual_readiness_dashboard;

CREATE OR REPLACE VIEW public.v_patch44_pilot_blocker_register WITH (security_invoker = true) AS
SELECT * FROM public.v_patch40_blocking_limitations;

CREATE OR REPLACE VIEW public.v_patch44_pilot_go_no_go_dashboard WITH (security_invoker = true) AS
SELECT
    COALESCE((SELECT COUNT(*) FROM public.pilot_go_no_go_reviews WHERE review_status LIKE 'approved%'), 0) as approved_reviews,
    COALESCE((SELECT COUNT(*) FROM public.v_patch44_pilot_blocker_register), 0) as blocking_issues,
    CASE WHEN (SELECT COUNT(*) FROM public.v_patch44_pilot_blocker_register) > 0 THEN 0.0 ELSE 100.0 END as readiness_percentage;

CREATE OR REPLACE VIEW public.v_patch44_executive_readiness_summary WITH (security_invoker = true) AS
SELECT * FROM public.v_patch40_executive_production_readiness_summary;

CREATE OR REPLACE VIEW public.v_patch44_daily_operations_landing_summary WITH (security_invoker = true) AS
SELECT 
    COUNT(*) as queue_size
FROM public.v_patch42_my_operations_queue;


-- 3. Functions
CREATE OR REPLACE FUNCTION public.record_pilot_go_no_go_event(
    p_review_id uuid,
    p_event_type text,
    p_event_summary text,
    p_actor_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.pilot_go_no_go_events (review_id, event_type, event_summary, actor_user_id)
    VALUES (p_review_id, p_event_type, p_event_summary, p_actor_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_pilot_go_no_go_review(
    p_title text,
    p_actor_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO public.pilot_go_no_go_reviews (review_title, created_by)
    VALUES (p_title, p_actor_id)
    RETURNING id INTO v_id;
    
    PERFORM public.record_pilot_go_no_go_event(v_id, 'review_created', 'Pilot review created', p_actor_id);
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_pilot_go_no_go_review_status(
    p_review_id uuid,
    p_status text,
    p_notes text,
    p_actor_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.pilot_go_no_go_reviews
    SET 
        review_status = p_status,
        review_notes = p_notes,
        reviewer_user_id = p_actor_id,
        reviewed_at = now()
    WHERE id = p_review_id;
    
    PERFORM public.record_pilot_go_no_go_event(p_review_id, 'status_updated', 'Review status updated to ' || p_status, p_actor_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pilot_go_no_go_dashboard()
RETURNS json
LANGUAGE sql
SECURITY INVOKER
AS $$
    SELECT row_to_json(v) FROM public.v_patch44_pilot_go_no_go_dashboard v LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_executive_readiness_summary()
RETURNS json
LANGUAGE sql
SECURITY INVOKER
AS $$
    SELECT row_to_json(v) FROM public.v_patch44_executive_readiness_summary v LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_operations_landing_summary()
RETURNS json
LANGUAGE sql
SECURITY INVOKER
AS $$
    SELECT row_to_json(v) FROM public.v_patch44_daily_operations_landing_summary v LIMIT 1;
$$;


-- Explicit read grants
GRANT SELECT ON public.pilot_go_no_go_reviews TO authenticated;
GRANT SELECT ON public.pilot_go_no_go_events TO authenticated;

-- View grants
GRANT SELECT ON public.v_patch44_role_landing_matrix TO authenticated;
GRANT SELECT ON public.v_patch44_navigation_readiness_map TO authenticated;
GRANT SELECT ON public.v_patch44_production_readiness_summary TO authenticated;
GRANT SELECT ON public.v_patch44_backup_restore_readiness_summary TO authenticated;
GRANT SELECT ON public.v_patch44_known_limitations_summary TO authenticated;
GRANT SELECT ON public.v_patch44_bilingual_readiness_summary TO authenticated;
GRANT SELECT ON public.v_patch44_pilot_blocker_register TO authenticated;
GRANT SELECT ON public.v_patch44_pilot_go_no_go_dashboard TO authenticated;
GRANT SELECT ON public.v_patch44_executive_readiness_summary TO authenticated;
GRANT SELECT ON public.v_patch44_daily_operations_landing_summary TO authenticated;

-- Function grants for authenticated edge bridge compatibility (or revoke and grant only to service_role)
-- The user requested: "Use SECURITY DEFINER only if consistent with existing service-role-gated bridge pattern."
-- Revoking execute from public to enforce edge bridge pattern for mutating functions.
REVOKE EXECUTE ON FUNCTION public.record_pilot_go_no_go_event(uuid, text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_pilot_go_no_go_event(uuid, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_pilot_go_no_go_event(uuid, text, text, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_pilot_go_no_go_review(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_pilot_go_no_go_review(text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_pilot_go_no_go_review(text, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_pilot_go_no_go_review_status(uuid, text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_pilot_go_no_go_review_status(uuid, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_pilot_go_no_go_review_status(uuid, text, text, uuid) TO service_role;

-- Getter functions are security invoker, safe for authenticated.
GRANT EXECUTE ON FUNCTION public.get_pilot_go_no_go_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_executive_readiness_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_operations_landing_summary() TO authenticated;

COMMIT;
