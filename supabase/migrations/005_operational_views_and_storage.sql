-- =========================================================
-- GRC Control Center - Migration 005
-- Operational views, evidence storage bucket, and dashboard helpers
-- =========================================================

-- Evidence bucket for Supabase Storage.
-- Run after Supabase Storage is enabled in the project.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'grc-evidence',
  'grc-evidence',
  false,
  52428800,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-excel',
    'text/plain'
  ]
)
on conflict (id) do nothing;

-- Users can read evidence objects when they can access their organization.
-- Folder convention: grc-evidence/<organization_id>/<module>/<record_id>/<filename>
drop policy if exists evidence_storage_read on storage.objects;
create policy evidence_storage_read
on storage.objects for select
using (
  bucket_id = 'grc-evidence'
  and public.can_access_org((storage.foldername(name))[1]::uuid)
);

-- Controlled users can upload evidence under their own organization folder.
drop policy if exists evidence_storage_insert on storage.objects;
create policy evidence_storage_insert
on storage.objects for insert
with check (
  bucket_id = 'grc-evidence'
  and public.can_access_org((storage.foldername(name))[1]::uuid)
);

-- Only GRC managers can update/delete evidence objects.
drop policy if exists evidence_storage_update on storage.objects;
create policy evidence_storage_update
on storage.objects for update
using (
  bucket_id = 'grc-evidence'
  and public.can_manage_grc()
)
with check (
  bucket_id = 'grc-evidence'
  and public.can_manage_grc()
);

drop policy if exists evidence_storage_delete on storage.objects;
create policy evidence_storage_delete
on storage.objects for delete
using (
  bucket_id = 'grc-evidence'
  and public.can_manage_grc()
);

-- Critical attention view used by the React dashboard.
create or replace view v_critical_attention_items as
select * from (
  select
    p.id,
    p.organization_id,
    'project'::text as item_type,
    p.title,
    d.name_en as department_name,
    pr.full_name_en as owner_name,
    p.target_end_date as due_date,
    p.status::text as status,
    p.risk_level,
    p.progress_percent,
    case
      when p.risk_level = 'critical' then 1
      when p.risk_level = 'high' then 2
      when p.status = 'delayed' then 3
      else 8
    end as sort_rank
  from projects p
  left join departments d on d.id = p.department_id
  left join profiles pr on pr.id = p.owner_id
  where p.status not in ('closed', 'cancelled')
    and (
      p.risk_level in ('critical', 'high')
      or p.status in ('delayed', 'at_risk', 'completed_pending_evidence', 'completed_pending_approval')
      or (p.target_end_date is not null and p.target_end_date < current_date)
    )

  union all

  select
    r.id,
    r.organization_id,
    'risk'::text as item_type,
    r.title,
    d.name_en as department_name,
    pr.full_name_en as owner_name,
    r.next_review_date as due_date,
    r.status::text as status,
    r.risk_level,
    null::numeric as progress_percent,
    case when r.risk_level = 'critical' then 1 when r.risk_level = 'high' then 2 else 8 end as sort_rank
  from risks r
  left join departments d on d.id = r.department_id
  left join profiles pr on pr.id = r.owner_id
  where r.status not in ('closed', 'cancelled')
    and r.risk_level in ('critical', 'high')

  union all

  select
    c.id,
    c.organization_id,
    'compliance'::text as item_type,
    c.title,
    d.name_en as department_name,
    pr.full_name_en as owner_name,
    coalesce(c.expiry_date, c.due_date) as due_date,
    c.status::text as status,
    c.risk_level,
    null::numeric as progress_percent,
    case
      when c.expiry_date is not null and c.expiry_date <= current_date + interval '7 days' then 1
      when c.risk_level = 'critical' then 2
      else 5
    end as sort_rank
  from compliance_items c
  left join departments d on d.id = c.department_id
  left join profiles pr on pr.id = c.owner_id
  where c.status not in ('closed', 'cancelled')
    and (
      c.risk_level in ('critical', 'high')
      or (c.expiry_date is not null and c.expiry_date <= current_date + interval '30 days')
      or (c.due_date is not null and c.due_date < current_date)
    )

  union all

  select
    af.id,
    af.organization_id,
    'audit_finding'::text as item_type,
    af.title,
    d.name_en as department_name,
    pr.full_name_en as owner_name,
    af.due_date,
    af.status::text as status,
    af.risk_level,
    null::numeric as progress_percent,
    case
      when af.due_date is not null and af.due_date < current_date then 1
      when af.risk_level = 'critical' then 2
      else 4
    end as sort_rank
  from audit_findings af
  left join departments d on d.id = af.department_id
  left join profiles pr on pr.id = af.owner_id
  where af.status not in ('closed', 'cancelled')
    and (
      af.risk_level in ('critical', 'high')
      or (af.due_date is not null and af.due_date < current_date)
    )

  union all

  select
    cd.id,
    cd.organization_id,
    'governance_decision'::text as item_type,
    cd.title,
    d.name_en as department_name,
    pr.full_name_en as owner_name,
    cd.due_date,
    cd.status::text as status,
    cd.risk_level,
    null::numeric as progress_percent,
    case
      when cd.status = 'delayed' then 1
      when cd.priority = 'critical' then 2
      else 6
    end as sort_rank
  from committee_decisions cd
  left join departments d on d.id = cd.department_id
  left join profiles pr on pr.id = cd.owner_id
  where cd.status not in ('closed', 'cancelled')
    and (
      cd.priority in ('critical', 'high')
      or cd.risk_level in ('critical', 'high')
      or cd.status in ('delayed', 'pending_evidence', 'pending_approval')
    )
) q
order by sort_rank asc, due_date asc nulls last;

-- My work view for future employee workspace.
create or replace view v_my_open_work as
select
  t.id,
  t.organization_id,
  'task'::text as item_type,
  t.title,
  t.due_date,
  t.status::text as status,
  t.progress_percent,
  t.owner_id,
  t.assigned_to,
  t.project_id,
  t.milestone_id
from tasks t
where t.status not in ('closed', 'cancelled', 'approved')
  and (t.assigned_to = auth.uid() or t.owner_id = auth.uid())
union all
select
  m.id,
  m.organization_id,
  'milestone'::text as item_type,
  m.title,
  m.due_date,
  m.status::text as status,
  m.progress_percent,
  m.owner_id,
  null::uuid as assigned_to,
  m.project_id,
  null::uuid as milestone_id
from milestones m
where m.status not in ('closed', 'cancelled', 'approved')
  and m.owner_id = auth.uid();
