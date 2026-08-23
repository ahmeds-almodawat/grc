begin;

-- Keep the owner-level closure helper service-role-only. The browser-facing
-- security-invoker view derives the same boolean from its already RLS-scoped
-- finding and current-link rows instead of exposing an arbitrary-ID oracle.
create or replace view public.v_ui4_audit_criteria_contract
with (security_invoker = true)
as
select
  f.organization_id,
  f.id as audit_finding_id,
  f.finding_code,
  f.finding_classification,
  f.finding_date,
  f.audit_period_end_date,
  coalesce(f.audit_period_end_date, f.finding_date, f.created_at::date)
    as criteria_resolution_date,
  count(distinct l.link_id) filter (
    where l.decision_type = 'confirmed'
  )::integer as confirmed_criterion_count,
  count(distinct d.id)::integer as dispute_count,
  (
    f.finding_classification = 'advisory_observation'
    or count(distinct l.link_id) filter (
      where l.decision_type = 'confirmed'
        and l.target_criterion_type in (
          'policy',
          'policy_requirement',
          'sop',
          'sop_step',
          'compliance_obligation',
          'accreditation_clause',
          'control'
        )
    ) > 0
  ) as criterion_gate_satisfied
from public.audit_findings f
left join public.v_current_governance_criteria_links l
  on l.source_entity_type = 'audit_finding'
 and l.source_entity_id = f.id
left join public.audit_finding_criteria_disputes d
  on d.audit_finding_id = f.id
group by f.organization_id, f.id;

revoke all on table public.v_ui4_audit_criteria_contract
from public, anon;

grant select on table public.v_ui4_audit_criteria_contract
to authenticated, service_role;

revoke all on function
  public.ui4_audit_finding_has_legitimate_criterion(uuid)
from public, anon, authenticated;

grant execute on function
  public.ui4_audit_finding_has_legitimate_criterion(uuid)
to service_role;

commit;
