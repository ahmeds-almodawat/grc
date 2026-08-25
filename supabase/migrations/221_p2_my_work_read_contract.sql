begin;

-- The accepted My Work queue is a security-invoker view. Its source tables
-- already enforce role, assignment, organization, and Patch83U visibility
-- through RLS; authenticated also needs the SQL read privilege to reach them.
grant select on table
  public.accreditation_clauses,
  public.accreditation_review_cycles,
  public.audit_execution_engagements,
  public.audit_execution_findings,
  public.audit_execution_programs,
  public.audit_execution_signoffs,
  public.audit_execution_test_steps,
  public.capa_action_items,
  public.clinical_governance_escalations,
  public.evidence_bridge_links,
  public.evidence_collection_requests,
  public.ovr_rca_cases
to authenticated;

commit;
