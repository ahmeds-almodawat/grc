-- HF-1 migration 233 static policy proof.

do $$
declare
  v_policy record;
begin
  for v_policy in
    select tablename, policyname, qual
    from pg_policies
    where schemaname = 'public'
      and (tablename, policyname) in (
        ('controlled_documents', 'controlled_documents_org_read_patch26'),
        ('governance_criteria_links', 'governance_criteria_links_read'),
        ('governance_criteria_link_decisions', 'governance_criteria_decisions_read')
      )
  loop
    if v_policy.qual not like '%current_user_org_id()%' then
      raise exception 'HF1_PROFILE_ORG_SCOPE_MISSING:%', v_policy.policyname;
    end if;
    if v_policy.qual like '%auth.jwt()%' then
      raise exception 'HF1_STALE_JWT_ORG_SCOPE_PRESENT:%', v_policy.policyname;
    end if;
  end loop;

  if (select count(*) from pg_policies
      where schemaname = 'public'
        and (tablename, policyname) in (
          ('controlled_documents', 'controlled_documents_org_read_patch26'),
          ('governance_criteria_links', 'governance_criteria_links_read'),
          ('governance_criteria_link_decisions', 'governance_criteria_decisions_read')
        )) <> 3 then
    raise exception 'HF1_RECENT_ACTIVITY_POLICY_SET_INCOMPLETE';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'controlled_documents'
      and policyname = 'patch83u_credential_gate'
      and permissive = 'RESTRICTIVE'
  ) then
    raise exception 'HF1_PATCH83U_DOCUMENT_GATE_NOT_RESTRICTIVE';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'governance_criteria_links'
      and policyname = 'governance_criteria_links_read'
      and qual like '%governance_linkage_source_readable%'
      and qual like '%governance_linkage_target_readable%'
  ) then
    raise exception 'HF1_LINKAGE_READABILITY_GATES_MISSING';
  end if;
end;
$$;
