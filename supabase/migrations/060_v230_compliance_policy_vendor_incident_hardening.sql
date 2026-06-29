-- v23.0 Compliance, Policy, Vendor + Incident Hardening Pack
-- Add-only professional compliance hardening schema. Live access stays blocked until reviewed org-scoped policies or Edge bridges are added.

create table if not exists public.v230_policy_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  policy_code text not null,
  title text not null,
  owner_role text not null,
  status text not null default 'draft' check (status in ('draft','under_review','approved','retired')),
  current_version text not null default '1.0',
  required_audience text,
  framework_refs text[] not null default '{}',
  next_review_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v230_policy_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  policy_document_id uuid not null references public.v230_policy_documents(id) on delete cascade,
  version text not null,
  change_summary text,
  approved_by uuid,
  approved_at timestamptz,
  approval_evidence_id uuid,
  immutable_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (policy_document_id, version)
);

create table if not exists public.v230_policy_attestations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  policy_document_id uuid not null references public.v230_policy_documents(id) on delete cascade,
  policy_version_id uuid references public.v230_policy_versions(id) on delete set null,
  audience_role text not null,
  user_id uuid,
  status text not null default 'pending' check (status in ('pending','acknowledged','overdue','exception','not_required')),
  due_date date,
  acknowledged_at timestamptz,
  exception_reason text,
  evidence_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v230_regulatory_changes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  source_name text not null,
  requirement_summary text not null,
  impact_area text not null,
  owner_role text not null,
  status text not null default 'assessment_required' check (status in ('assessment_required','in_progress','implemented','not_applicable','overdue','closed')),
  due_date date,
  linked_requirement_id uuid,
  linked_control_id uuid,
  linked_evidence_id uuid,
  management_decision text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v230_vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  vendor_name text not null,
  service_scope text not null,
  criticality text not null default 'standard' check (criticality in ('strategic','critical','standard','low_risk')),
  inherent_risk text not null default 'medium' check (inherent_risk in ('low','medium','high','critical')),
  due_diligence_status text not null default 'review_required' check (due_diligence_status in ('review_required','in_progress','approved','rejected','expired')),
  contract_expiry date,
  business_owner_role text,
  evidence_required text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v230_vendor_due_diligence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  vendor_id uuid not null references public.v230_vendors(id) on delete cascade,
  review_type text not null,
  review_status text not null default 'pending' check (review_status in ('pending','passed','failed','waived','expired')),
  reviewer_role text,
  review_date date,
  expiry_date date,
  evidence_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.v230_compliance_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  incident_type text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status text not null default 'triage' check (status in ('triage','contained','root_cause_review','notification_review','capa_open','closed')),
  detected_at timestamptz not null default now(),
  owner_role text not null,
  regulatory_notification_required boolean not null default false,
  regulatory_notification_due_at timestamptz,
  root_cause text,
  containment_action text,
  linked_risk_id uuid,
  linked_control_id uuid,
  linked_capa_id uuid,
  closure_evidence_id uuid,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists v230_policy_documents_org_idx on public.v230_policy_documents(organization_id);
create index if not exists v230_policy_attestations_policy_idx on public.v230_policy_attestations(policy_document_id, status);
create index if not exists v230_regulatory_changes_org_status_idx on public.v230_regulatory_changes(organization_id, status);
create index if not exists v230_vendors_org_risk_idx on public.v230_vendors(organization_id, inherent_risk, due_diligence_status);
create index if not exists v230_incidents_org_status_idx on public.v230_compliance_incidents(organization_id, severity, status);

alter table public.v230_policy_documents enable row level security;
alter table public.v230_policy_versions enable row level security;
alter table public.v230_policy_attestations enable row level security;
alter table public.v230_regulatory_changes enable row level security;
alter table public.v230_vendors enable row level security;
alter table public.v230_vendor_due_diligence enable row level security;
alter table public.v230_compliance_incidents enable row level security;

-- Deny-by-default authenticated policies. Reviewed org-scoped policies or Edge bridges should replace these when live writes are implemented.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_policy_documents' and policyname = 'v230_policy_documents authenticated read blocked pending bridge') then
    create policy "v230_policy_documents authenticated read blocked pending bridge" on public.v230_policy_documents for select to authenticated using (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_policy_documents' and policyname = 'v230_policy_documents authenticated insert blocked pending bridge') then
    create policy "v230_policy_documents authenticated insert blocked pending bridge" on public.v230_policy_documents for insert to authenticated with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_policy_documents' and policyname = 'v230_policy_documents authenticated update blocked pending bridge') then
    create policy "v230_policy_documents authenticated update blocked pending bridge" on public.v230_policy_documents for update to authenticated using (false) with check (false);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_policy_versions' and policyname = 'v230_policy_versions authenticated read blocked pending bridge') then
    create policy "v230_policy_versions authenticated read blocked pending bridge" on public.v230_policy_versions for select to authenticated using (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_policy_versions' and policyname = 'v230_policy_versions authenticated insert blocked pending bridge') then
    create policy "v230_policy_versions authenticated insert blocked pending bridge" on public.v230_policy_versions for insert to authenticated with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_policy_versions' and policyname = 'v230_policy_versions authenticated update blocked pending bridge') then
    create policy "v230_policy_versions authenticated update blocked pending bridge" on public.v230_policy_versions for update to authenticated using (false) with check (false);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_policy_attestations' and policyname = 'v230_policy_attestations authenticated read blocked pending bridge') then
    create policy "v230_policy_attestations authenticated read blocked pending bridge" on public.v230_policy_attestations for select to authenticated using (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_policy_attestations' and policyname = 'v230_policy_attestations authenticated insert blocked pending bridge') then
    create policy "v230_policy_attestations authenticated insert blocked pending bridge" on public.v230_policy_attestations for insert to authenticated with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_policy_attestations' and policyname = 'v230_policy_attestations authenticated update blocked pending bridge') then
    create policy "v230_policy_attestations authenticated update blocked pending bridge" on public.v230_policy_attestations for update to authenticated using (false) with check (false);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_regulatory_changes' and policyname = 'v230_regulatory_changes authenticated read blocked pending bridge') then
    create policy "v230_regulatory_changes authenticated read blocked pending bridge" on public.v230_regulatory_changes for select to authenticated using (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_regulatory_changes' and policyname = 'v230_regulatory_changes authenticated insert blocked pending bridge') then
    create policy "v230_regulatory_changes authenticated insert blocked pending bridge" on public.v230_regulatory_changes for insert to authenticated with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_regulatory_changes' and policyname = 'v230_regulatory_changes authenticated update blocked pending bridge') then
    create policy "v230_regulatory_changes authenticated update blocked pending bridge" on public.v230_regulatory_changes for update to authenticated using (false) with check (false);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_vendors' and policyname = 'v230_vendors authenticated read blocked pending bridge') then
    create policy "v230_vendors authenticated read blocked pending bridge" on public.v230_vendors for select to authenticated using (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_vendors' and policyname = 'v230_vendors authenticated insert blocked pending bridge') then
    create policy "v230_vendors authenticated insert blocked pending bridge" on public.v230_vendors for insert to authenticated with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_vendors' and policyname = 'v230_vendors authenticated update blocked pending bridge') then
    create policy "v230_vendors authenticated update blocked pending bridge" on public.v230_vendors for update to authenticated using (false) with check (false);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_vendor_due_diligence' and policyname = 'v230_vendor_due_diligence authenticated read blocked pending bridge') then
    create policy "v230_vendor_due_diligence authenticated read blocked pending bridge" on public.v230_vendor_due_diligence for select to authenticated using (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_vendor_due_diligence' and policyname = 'v230_vendor_due_diligence authenticated insert blocked pending bridge') then
    create policy "v230_vendor_due_diligence authenticated insert blocked pending bridge" on public.v230_vendor_due_diligence for insert to authenticated with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_vendor_due_diligence' and policyname = 'v230_vendor_due_diligence authenticated update blocked pending bridge') then
    create policy "v230_vendor_due_diligence authenticated update blocked pending bridge" on public.v230_vendor_due_diligence for update to authenticated using (false) with check (false);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_compliance_incidents' and policyname = 'v230_compliance_incidents authenticated read blocked pending bridge') then
    create policy "v230_compliance_incidents authenticated read blocked pending bridge" on public.v230_compliance_incidents for select to authenticated using (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_compliance_incidents' and policyname = 'v230_compliance_incidents authenticated insert blocked pending bridge') then
    create policy "v230_compliance_incidents authenticated insert blocked pending bridge" on public.v230_compliance_incidents for insert to authenticated with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'v230_compliance_incidents' and policyname = 'v230_compliance_incidents authenticated update blocked pending bridge') then
    create policy "v230_compliance_incidents authenticated update blocked pending bridge" on public.v230_compliance_incidents for update to authenticated using (false) with check (false);
  end if;
end $$;

comment on table public.v230_policy_documents is 'v23 professional policy register. Access is blocked pending reviewed org-scoped policies or Edge bridges.';
comment on table public.v230_regulatory_changes is 'v23 regulatory change tracker for compliance management system hardening.';
comment on table public.v230_vendors is 'v23 lightweight vendor risk register for accreditation evidence.';
comment on table public.v230_compliance_incidents is 'v23 compliance/security incident register with notification and closure evidence fields.';
