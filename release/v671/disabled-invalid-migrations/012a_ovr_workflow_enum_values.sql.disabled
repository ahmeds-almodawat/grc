-- =========================================================
-- GRC Control Center - Migration 012a
-- OVR workflow enum values for v1.0 stabilization
-- Run before 012b.
-- =========================================================

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'ovr_status'
      and e.enumlabel = 'returned_for_clarification'
  ) then
    alter type public.ovr_status add value 'returned_for_clarification' after 'under_quality_review';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'ovr_status'
      and e.enumlabel = 'quality_closure_review'
  ) then
    alter type public.ovr_status add value 'quality_closure_review' after 'evidence_submitted';
  end if;
end $$;
