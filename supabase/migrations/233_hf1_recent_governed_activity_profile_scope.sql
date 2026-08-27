-- HF-1: resolve governed activity organization scope from the active profile.
-- This keeps the trusted view security-invoker and preserves every existing
-- source/target readability predicate and the restrictive credential gate.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

drop policy if exists controlled_documents_org_read_patch26
  on public.controlled_documents;
create policy controlled_documents_org_read_patch26
on public.controlled_documents
for select to authenticated
using (organization_id = public.current_user_org_id());

drop policy if exists governance_criteria_links_read
  on public.governance_criteria_links;
create policy governance_criteria_links_read
on public.governance_criteria_links
for select to authenticated
using (
  organization_id = public.current_user_org_id()
  and public.governance_linkage_source_readable(
    organization_id, source_entity_type, source_entity_id
  )
  and public.governance_linkage_target_readable(
    organization_id, target_criterion_type, target_document_id, target_version_id,
    target_policy_requirement_id, target_sop_step_id, target_compliance_obligation_id,
    target_accreditation_clause_id, target_control_id
  )
);

drop policy if exists governance_criteria_decisions_read
  on public.governance_criteria_link_decisions;
create policy governance_criteria_decisions_read
on public.governance_criteria_link_decisions
for select to authenticated
using (
  organization_id = public.current_user_org_id()
  and exists (
    select 1
    from public.governance_criteria_links l
    where l.id = governance_criteria_link_decisions.link_id
  )
);

comment on policy controlled_documents_org_read_patch26
  on public.controlled_documents is
  'HF-1 profile-derived organization read boundary; Patch83U restrictive credential policy remains enforced.';
comment on policy governance_criteria_links_read
  on public.governance_criteria_links is
  'HF-1 profile-derived organization boundary with canonical source and target readability checks.';
comment on policy governance_criteria_decisions_read
  on public.governance_criteria_link_decisions is
  'HF-1 profile-derived organization boundary with governed-link visibility required.';

commit;
