-- P3-R1 release compatibility bridge.
--
-- This is deliberately outside supabase/migrations. It normalizes the one
-- supported post-187 view shape immediately before original migration 217.
-- Execute it only through invoke-p3-pre217-critical-attention-compatibility.ps1.

do $bridge$
declare
  v_ceiling text;
  v_ledger_count integer;
  v_forward_count integer;
  v_columns text[];
  v_risk_type text;
  v_risk_type_schema text;
  v_risk_typtype "char";
  v_owner text;
  v_reloptions text[];
  v_acl text;
  v_definition_md5 text;
  v_dependency_count integer;
begin
  perform set_config('lock_timeout', '5s', true);
  perform set_config('statement_timeout', '120s', true);

  select max(version), count(*)::integer,
    count(*) filter (where version between '188' and '216')::integer
  into v_ceiling, v_ledger_count, v_forward_count
  from supabase_migrations.schema_migrations;

  if v_ceiling is distinct from '216'
    or v_ledger_count <> 171
    or v_forward_count <> 29
    or exists (
      select 1 from supabase_migrations.schema_migrations where version >= '217'
    )
  then
    raise exception 'P3_PRE217_LEDGER_PRECONDITION_FAILED ceiling=% count=% forward_count=%',
      v_ceiling, v_ledger_count, v_forward_count;
  end if;

  if to_regclass('public.v_critical_attention_items') is null then
    raise exception 'P3_PRE217_VIEW_REQUIRED';
  end if;

  select
    pg_get_userbyid(c.relowner),
    coalesce(c.reloptions, array[]::text[]),
    c.relacl::text,
    md5(pg_get_viewdef(c.oid, true))
  into v_owner, v_reloptions, v_acl, v_definition_md5
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'v_critical_attention_items'
    and c.relkind = 'v';

  if v_owner is distinct from 'postgres' then
    raise exception 'P3_PRE217_OWNER_PRECONDITION_FAILED owner=%', v_owner;
  end if;

  if not (v_reloptions @> array['security_invoker=true']) then
    raise exception 'P3_PRE217_SECURITY_INVOKER_REQUIRED';
  end if;

  select array_agg(
    a.attname::text || ':' || format_type(a.atttypid, a.atttypmod)
    order by a.attnum
  )
  into v_columns
  from pg_attribute a
  where a.attrelid = 'public.v_critical_attention_items'::regclass
    and a.attnum > 0
    and not a.attisdropped;

  if v_columns is distinct from array[
    'id:uuid',
    'organization_id:uuid',
    'item_type:text',
    'title:text',
    'department_name:text',
    'owner_name:text',
    'due_date:date',
    'status:text',
    case
      when v_columns[9] = 'risk_level:public.risk_level' then 'risk_level:public.risk_level'
      when v_columns[9] = 'risk_level:risk_level' then 'risk_level:risk_level'
      when v_columns[9] = 'risk_level:text' then 'risk_level:text'
      else '__unsupported__'
    end,
    'progress_percent:numeric',
    'sort_rank:integer'
  ] then
    raise exception 'P3_PRE217_COLUMN_SHAPE_UNSUPPORTED columns=%', v_columns;
  end if;

  select format_type(a.atttypid, a.atttypmod), n.nspname, t.typtype
  into v_risk_type, v_risk_type_schema, v_risk_typtype
  from pg_attribute a
  join pg_type t on t.oid = a.atttypid
  join pg_namespace n on n.oid = t.typnamespace
  where a.attrelid = 'public.v_critical_attention_items'::regclass
    and a.attname = 'risk_level'
    and a.attnum > 0
    and not a.attisdropped;

  select count(*)::integer
  into v_dependency_count
  from (
    select distinct dependent_class.oid
    from pg_depend d
    join pg_rewrite r on r.oid = d.objid
    join pg_class dependent_class on dependent_class.oid = r.ev_class
    where d.refobjid = 'public.v_critical_attention_items'::regclass
      and dependent_class.oid <> d.refobjid
    union
    select distinct dependent_function.oid
    from pg_depend d
    join pg_proc dependent_function on dependent_function.oid = d.objid
    where d.refobjid = 'public.v_critical_attention_items'::regclass
  ) dependencies;

  if v_dependency_count <> 0 then
    raise exception 'P3_PRE217_DEPENDENCIES_UNSUPPORTED count=%', v_dependency_count;
  end if;

  if v_risk_type = 'risk_level'
    and v_risk_type_schema = 'public'
    and v_risk_typtype = 'e'
  then
    if v_definition_md5 <> 'df6a444271d323bb97cf12f062486e6f' then
      raise exception 'P3_PRE217_LEGACY_DEFINITION_UNSUPPORTED md5=%', v_definition_md5;
    end if;

    if v_acl is distinct from
      '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'
    then
      raise exception 'P3_PRE217_LEGACY_ACL_UNSUPPORTED acl=%', v_acl;
    end if;

    execute 'drop view public.v_critical_attention_items';
    execute $view$
      create view public.v_critical_attention_items
      with (security_invoker = true)
      as
      select * from (
        select
          p.id,
          p.organization_id,
          'project'::text as item_type,
          p.title,
          d.name_en as department_name,
          owner.full_name_en as owner_name,
          p.target_end_date as due_date,
          p.status::text as status,
          p.risk_level::text as risk_level,
          p.progress_percent,
          case
            when p.risk_level::text = 'critical' then 1
            when p.risk_level::text = 'high' then 2
            when p.status::text = 'delayed' then 3
            else 8
          end as sort_rank
        from public.projects p
        left join public.departments d on d.id = p.department_id
        left join public.profiles owner on owner.id = p.owner_id
        where p.status::text not in ('closed','cancelled')
          and (
            p.risk_level::text in ('critical','high')
            or p.status::text in ('delayed','at_risk','completed_pending_evidence','completed_pending_approval')
            or (p.target_end_date is not null and p.target_end_date < current_date)
          )

        union all
        select
          r.id, r.organization_id, 'risk'::text, r.title, d.name_en, owner.full_name_en,
          r.next_review_date, r.status::text, r.risk_level::text, null::numeric,
          case when r.risk_level::text = 'critical' then 1 when r.risk_level::text = 'high' then 2 else 8 end
        from public.risks r
        left join public.departments d on d.id = r.department_id
        left join public.profiles owner on owner.id = r.owner_id
        where r.status::text not in ('closed','cancelled') and r.risk_level::text in ('critical','high')

        union all
        select
          c.id, c.organization_id, 'compliance'::text, c.title, d.name_en, owner.full_name_en,
          c.next_review_date, c.status::text, c.risk_level::text, null::numeric,
          case
            when c.next_review_date is not null and c.next_review_date < current_date then 1
            when c.risk_level::text = 'critical' then 2
            else 5
          end
        from public.compliance_obligations c
        left join public.departments d on d.id = c.department_id
        left join public.profiles owner on owner.id = c.owner_id
        where c.status::text not in ('closed','cancelled')
          and (
            c.risk_level::text in ('critical','high')
            or (c.next_review_date is not null and c.next_review_date <= current_date + 30)
          )

        union all
        select
          a.id, a.organization_id, 'audit_finding'::text, a.title, d.name_en, owner.full_name_en,
          coalesce(a.revised_due_date, a.corrective_action_due_date, a.due_date),
          coalesce(a.finding_status, a.status::text),
          coalesce(a.severity_level, a.risk_level::text), null::numeric,
          case
            when coalesce(a.revised_due_date, a.corrective_action_due_date, a.due_date) < current_date then 1
            when coalesce(a.severity_level, a.risk_level::text) = 'critical' then 2
            else 4
          end
        from public.audit_findings a
        left join public.departments d on d.id = coalesce(a.responsible_department_id, a.department_id)
        left join public.profiles owner on owner.id = coalesce(a.responsible_owner_id, a.finding_owner_id, a.owner_id)
        where coalesce(a.finding_status, a.status::text) not in ('closed','cancelled')
          and (
            coalesce(a.severity_level, a.risk_level::text) in ('critical','high')
            or coalesce(a.revised_due_date, a.corrective_action_due_date, a.due_date) < current_date
          )

        union all
        select
          c.id, c.organization_id, 'capa'::text, c.capa_title, d.name_en, owner.full_name_en,
          coalesce(c.revised_due_date, c.completion_due_date, c.due_date), c.capa_status,
          coalesce(c.severity_level, c.risk_level), null::numeric,
          case
            when coalesce(c.revised_due_date, c.completion_due_date, c.due_date) < current_date then 1
            when coalesce(c.severity_level, c.risk_level) = 'critical' then 2
            else 4
          end
        from public.capa_action_plans c
        left join public.departments d on d.id = c.department_id
        left join public.profiles owner on owner.id = coalesce(c.capa_owner_id, c.action_owner_id)
        where c.capa_status not in ('closed','cancelled')
          and (
            coalesce(c.severity_level, c.risk_level) in ('critical','high')
            or coalesce(c.revised_due_date, c.completion_due_date, c.due_date) < current_date
          )

        union all
        select
          g.id, g.organization_id, 'governance_decision'::text, g.title, d.name_en, owner.full_name_en,
          g.due_date, g.status::text, g.risk_level::text, null::numeric,
          case when g.status::text = 'delayed' then 1 when g.priority::text = 'critical' then 2 else 6 end
        from public.committee_decisions g
        left join public.departments d on d.id = g.department_id
        left join public.profiles owner on owner.id = g.owner_id
        where g.status::text not in ('closed','cancelled')
          and (
            g.priority::text in ('critical','high')
            or g.risk_level::text in ('critical','high')
            or g.status::text in ('delayed','pending_evidence','pending_approval')
          )

        union all
        select
          o.id, o.organization_id, 'ovr'::text,
          coalesce(o.ovr_number, o.logging_number, 'OVR') || ' - ' || left(o.brief_description, 90),
          d.name_en, owner.full_name_en,
          coalesce(o.corrective_action_due_date, o.quality_due_date, o.supervisor_due_date),
          o.status::text,
          coalesce(o.final_severity_level::text, o.quality_confirmed_severity, o.severity_level::text),
          null::numeric,
          case
            when coalesce(o.final_severity_level::text, o.quality_confirmed_severity, o.severity_level::text)
              in ('level_4','sentinel','critical') then 1
            when coalesce(o.corrective_action_due_date, o.quality_due_date, o.supervisor_due_date) < current_date then 2
            else 4
          end
        from public.ovr_reports o
        left join public.departments d on d.id = o.department_id
        left join public.profiles owner on owner.id = o.owner_id
        where o.status::text not in ('closed','cancelled')
          and (
            coalesce(o.final_severity_level::text, o.quality_confirmed_severity, o.severity_level::text)
              in ('level_4','sentinel','critical','high')
            or coalesce(o.corrective_action_due_date, o.quality_due_date, o.supervisor_due_date) < current_date
            or o.status::text in ('returned_for_clarification','evidence_submitted','quality_closure_review')
          )
      ) attention
      order by sort_rank, due_date nulls last
    $view$;
  elsif v_risk_type = 'text' and v_risk_type_schema = 'pg_catalog' then
    if v_definition_md5 <> 'a332a995c7c7b46ea23325a2c807c9c6' then
      raise exception 'P3_PRE217_CANONICAL_DEFINITION_UNSUPPORTED md5=%', v_definition_md5;
    end if;
  else
    raise exception 'P3_PRE217_RISK_TYPE_UNSUPPORTED schema=% type=% typtype=%',
      v_risk_type_schema, v_risk_type, v_risk_typtype;
  end if;

  execute 'alter view public.v_critical_attention_items owner to postgres';
  execute 'revoke all privileges on public.v_critical_attention_items from public, anon, authenticated, service_role';
  execute 'grant select on public.v_critical_attention_items to authenticated, service_role';
  execute $comment$
    comment on view public.v_critical_attention_items is
      'P1 canonical role-scoped critical-attention feed backed by RLS-protected platform records.'
  $comment$;

  select max(version) into v_ceiling from supabase_migrations.schema_migrations;
  select md5(pg_get_viewdef('public.v_critical_attention_items'::regclass, true))
    into v_definition_md5;
  select format_type(a.atttypid, a.atttypmod)
    into v_risk_type
  from pg_attribute a
  where a.attrelid = 'public.v_critical_attention_items'::regclass
    and a.attname = 'risk_level'
    and a.attnum > 0
    and not a.attisdropped;

  if v_ceiling is distinct from '216' then
    raise exception 'P3_PRE217_BRIDGE_CHANGED_LEDGER ceiling=%', v_ceiling;
  end if;
  if v_definition_md5 <> 'a332a995c7c7b46ea23325a2c807c9c6'
    or v_risk_type <> 'text'
  then
    raise exception 'P3_PRE217_CANONICAL_ASSERTION_FAILED md5=% risk_type=%',
      v_definition_md5, v_risk_type;
  end if;
  if has_table_privilege('anon', 'public.v_critical_attention_items', 'SELECT')
    or not has_table_privilege('authenticated', 'public.v_critical_attention_items', 'SELECT')
    or not has_table_privilege('service_role', 'public.v_critical_attention_items', 'SELECT')
  then
    raise exception 'P3_PRE217_ACL_ASSERTION_FAILED';
  end if;
end;
$bridge$;
