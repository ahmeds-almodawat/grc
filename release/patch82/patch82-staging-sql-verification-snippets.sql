-- Patch 82 staging-only read-only verification snippets.
-- Run only against the approved staging project/reference.
-- Do not run destructive SQL from this file.

-- 1. Verify expected Patch 76-79 tables exist.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'controlled_production_cutover_decisions',
    'controlled_production_cutover_decision_events',
    'live_pilot_sessions',
    'live_pilot_issues',
    'live_pilot_department_acceptances',
    'identity_role_integrity_reviews',
    'identity_role_integrity_findings',
    'privileged_role_recertifications',
    'production_hypercare_windows',
    'production_hypercare_items',
    'executive_governance_board_packs'
  )
order by table_name;

-- 2. Verify RLS is enabled for new Patch 76-79 tables.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'controlled_production_cutover_decisions',
    'controlled_production_cutover_decision_events',
    'live_pilot_sessions',
    'live_pilot_issues',
    'live_pilot_department_acceptances',
    'identity_role_integrity_reviews',
    'identity_role_integrity_findings',
    'privileged_role_recertifications',
    'production_hypercare_windows',
    'production_hypercare_items',
    'executive_governance_board_packs'
  )
order by tablename;

-- 3. Verify expected privileged workflow functions exist.
select n.nspname as schema_name, p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_controlled_production_cutover_decision',
    'record_controlled_production_cutover_event',
    'create_live_pilot_session',
    'update_live_pilot_session_status',
    'create_live_pilot_issue',
    'update_live_pilot_issue_status',
    'record_live_pilot_department_acceptance',
    'create_identity_role_integrity_review',
    'update_identity_role_integrity_review_status',
    'record_identity_role_integrity_finding',
    'update_identity_role_integrity_finding_status',
    'record_privileged_role_recertification',
    'create_production_hypercare_window',
    'update_production_hypercare_window_status',
    'record_production_hypercare_item',
    'update_production_hypercare_item_status',
    'create_executive_governance_board_pack',
    'update_executive_governance_board_pack_status'
  )
order by function_name;

-- 4. Verify no broad public write policies exist on new Patch 76-79 tables.
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'controlled_production_cutover_decisions',
    'controlled_production_cutover_decision_events',
    'live_pilot_sessions',
    'live_pilot_issues',
    'live_pilot_department_acceptances',
    'identity_role_integrity_reviews',
    'identity_role_integrity_findings',
    'privileged_role_recertifications',
    'production_hypercare_windows',
    'production_hypercare_items',
    'executive_governance_board_packs'
  )
  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  and roles::text ilike '%public%'
order by tablename, policyname;

-- 5. Verify key status/check constraints exist where staged metadata exposes them.
select conrelid::regclass as table_name, conname, contype
from pg_constraint
where conrelid in (
  'public.controlled_production_cutover_decisions'::regclass,
  'public.live_pilot_sessions'::regclass,
  'public.live_pilot_issues'::regclass,
  'public.identity_role_integrity_reviews'::regclass,
  'public.production_hypercare_windows'::regclass,
  'public.executive_governance_board_packs'::regclass
)
  and contype in ('c', 'f', 'p')
order by table_name::text, conname;
