-- v6.6 controlled pilot evidence smoke tests for staging.
-- Run after migrations through 045 are applied.

select 'controlled_pilot_runs_exists' as test_name, to_regclass('public.controlled_pilot_runs') is not null as passed;
select 'controlled_pilot_evidence_items_exists' as test_name, to_regclass('public.controlled_pilot_evidence_items') is not null as passed;
select 'controlled_pilot_issues_exists' as test_name, to_regclass('public.controlled_pilot_issues') is not null as passed;
select 'controlled_pilot_signoffs_exists' as test_name, to_regclass('public.controlled_pilot_signoffs') is not null as passed;

select 'controlled_pilot_runs_rls_enabled' as test_name, relrowsecurity as passed
from pg_class where oid = 'public.controlled_pilot_runs'::regclass;
select 'controlled_pilot_evidence_items_rls_enabled' as test_name, relrowsecurity as passed
from pg_class where oid = 'public.controlled_pilot_evidence_items'::regclass;
select 'controlled_pilot_issues_rls_enabled' as test_name, relrowsecurity as passed
from pg_class where oid = 'public.controlled_pilot_issues'::regclass;
select 'controlled_pilot_signoffs_rls_enabled' as test_name, relrowsecurity as passed
from pg_class where oid = 'public.controlled_pilot_signoffs'::regclass;
