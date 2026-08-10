-- GRC v1.1 OVR Phase 2 P2 - immutable verdict and governance closure.
-- Additive only. Released v98 workflow functions, grants, triggers, and browser
-- behavior remain unchanged until a separately reviewed v1.1 cutover.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Structural keys bind the represented actor to the exact P1 assignment and
-- the reporter response to the reporter recorded on the OVR.
create unique index if not exists uq_ovr_assignments_context_reviewer_id
  on public.ovr_reviewer_assignments (
    organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
    reviewer_profile_id, id
  );

create unique index if not exists uq_ovr_reports_context_reporter
  on public.ovr_reports (organization_id, id, reported_by);

create table if not exists public.ovr_separation_policies (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  allow_same_actor_ordinary boolean not null default false,
  configured_by uuid not null,
  configuration_reason text not null check (
    length(btrim(configuration_reason)) between 1 and 500
  ),
  configured_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint ovr_separation_policies_actor_org_fkey
    foreign key (organization_id, configured_by)
    references public.profiles(organization_id, id) on delete restrict
);

create index if not exists idx_ovr_separation_policies_configured_by
  on public.ovr_separation_policies (organization_id, configured_by);

create table if not exists public.ovr_final_verdicts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ovr_report_id uuid not null,
  review_cycle_id uuid not null,
  stage_instance_id uuid not null,
  reviewer_assignment_id uuid not null,
  issued_by uuid not null,
  verdict text not null check (length(btrim(verdict)) between 1 and 2000),
  effective_severity public.ovr_severity_level not null,
  corrective_action_required boolean not null,
  issued_at timestamptz not null default statement_timestamp(),
  supersedes_verdict_id uuid,
  idempotency_key text not null check (
    length(idempotency_key) between 1 and 128
    and idempotency_key ~ '^[A-Za-z0-9._:-]+$'
  ),
  semantic_request_digest text not null check (
    semantic_request_digest ~ '^[0-9a-f]{64}$'
  ),
  immutable_response jsonb not null check (jsonb_typeof(immutable_response) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  constraint ovr_final_verdicts_stage_context_fkey
    foreign key (organization_id, ovr_report_id, review_cycle_id, stage_instance_id)
    references public.ovr_stage_instances(
      organization_id, ovr_report_id, review_cycle_id, id
    ) on delete restrict,
  constraint ovr_final_verdicts_assignment_context_fkey
    foreign key (
      organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
      issued_by, reviewer_assignment_id
    ) references public.ovr_reviewer_assignments(
      organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
      reviewer_profile_id, id
    ) on delete restrict,
  constraint ovr_final_verdicts_org_cycle_key unique (
    organization_id, ovr_report_id, review_cycle_id
  ),
  constraint ovr_final_verdicts_org_idempotency_key unique (
    organization_id, idempotency_key
  ),
  constraint ovr_final_verdicts_context_id_key unique (
    organization_id, ovr_report_id, review_cycle_id, stage_instance_id, id
  ),
  constraint ovr_final_verdicts_cycle_id_key unique (
    organization_id, ovr_report_id, review_cycle_id, id
  ),
  constraint ovr_final_verdicts_ovr_id_key unique (
    organization_id, ovr_report_id, id
  ),
  constraint ovr_final_verdicts_no_self_supersession check (
    supersedes_verdict_id is null or supersedes_verdict_id <> id
  )
);

alter table public.ovr_final_verdicts
  add constraint ovr_final_verdicts_supersedes_context_fkey
  foreign key (organization_id, ovr_report_id, supersedes_verdict_id)
  references public.ovr_final_verdicts(organization_id, ovr_report_id, id)
  on delete restrict;

create index if not exists idx_ovr_final_verdicts_assignment
  on public.ovr_final_verdicts (reviewer_assignment_id);
create index if not exists idx_ovr_final_verdicts_issuer
  on public.ovr_final_verdicts (organization_id, issued_by, issued_at desc);
create index if not exists idx_ovr_final_verdicts_supersedes
  on public.ovr_final_verdicts (supersedes_verdict_id)
  where supersedes_verdict_id is not null;
create index if not exists idx_ovr_final_verdicts_assignment_context
  on public.ovr_final_verdicts (
    organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
    issued_by, reviewer_assignment_id
  );
create index if not exists idx_ovr_final_verdicts_supersedes_context
  on public.ovr_final_verdicts (
    organization_id, ovr_report_id, supersedes_verdict_id
  ) where supersedes_verdict_id is not null;
create unique index if not exists uq_ovr_final_verdicts_one_direct_successor
  on public.ovr_final_verdicts (supersedes_verdict_id)
  where supersedes_verdict_id is not null;

create table if not exists public.ovr_governance_closures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ovr_report_id uuid not null,
  review_cycle_id uuid not null,
  stage_instance_id uuid not null,
  closer_assignment_id uuid not null,
  final_verdict_id uuid not null,
  closed_by uuid not null,
  closed_at timestamptz not null default statement_timestamp(),
  separation_policy_applied jsonb not null check (
    jsonb_typeof(separation_policy_applied) = 'object'
  ),
  evidence_gate_snapshot jsonb not null check (
    jsonb_typeof(evidence_gate_snapshot) = 'object'
  ),
  idempotency_key text not null check (
    length(idempotency_key) between 1 and 128
    and idempotency_key ~ '^[A-Za-z0-9._:-]+$'
  ),
  semantic_request_digest text not null check (
    semantic_request_digest ~ '^[0-9a-f]{64}$'
  ),
  immutable_response jsonb not null check (jsonb_typeof(immutable_response) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  constraint ovr_governance_closures_stage_context_fkey
    foreign key (organization_id, ovr_report_id, review_cycle_id, stage_instance_id)
    references public.ovr_stage_instances(
      organization_id, ovr_report_id, review_cycle_id, id
    ) on delete restrict,
  constraint ovr_governance_closures_assignment_context_fkey
    foreign key (
      organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
      closed_by, closer_assignment_id
    ) references public.ovr_reviewer_assignments(
      organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
      reviewer_profile_id, id
    ) on delete restrict,
  constraint ovr_governance_closures_verdict_context_fkey
    foreign key (organization_id, ovr_report_id, review_cycle_id, final_verdict_id)
    references public.ovr_final_verdicts(
      organization_id, ovr_report_id, review_cycle_id, id
    ) on delete restrict,
  constraint ovr_governance_closures_org_cycle_key unique (
    organization_id, ovr_report_id, review_cycle_id
  ),
  constraint ovr_governance_closures_final_verdict_key unique (final_verdict_id),
  constraint ovr_governance_closures_org_idempotency_key unique (
    organization_id, idempotency_key
  ),
  constraint ovr_governance_closures_context_id_key unique (
    organization_id, ovr_report_id, review_cycle_id, stage_instance_id, id
  ),
  constraint ovr_governance_closures_origin_verdict_context_key unique (
    organization_id, ovr_report_id, id, final_verdict_id
  ),
  constraint ovr_governance_closures_ovr_id_key unique (
    organization_id, ovr_report_id, id
  )
);

create index if not exists idx_ovr_governance_closures_assignment
  on public.ovr_governance_closures (closer_assignment_id);
create index if not exists idx_ovr_governance_closures_actor
  on public.ovr_governance_closures (organization_id, closed_by, closed_at desc);
create index if not exists idx_ovr_governance_closures_assignment_context
  on public.ovr_governance_closures (
    organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
    closed_by, closer_assignment_id
  );
create index if not exists idx_ovr_governance_closures_verdict_context
  on public.ovr_governance_closures (
    organization_id, ovr_report_id, review_cycle_id, final_verdict_id
  );

create table if not exists public.ovr_reporter_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ovr_report_id uuid not null,
  governance_closure_id uuid not null,
  reporter_profile_id uuid not null,
  response_type text not null check (response_type in ('acknowledged', 'disputed')),
  response_reason text,
  responded_at timestamptz not null default statement_timestamp(),
  idempotency_key text not null check (
    length(idempotency_key) between 1 and 128
    and idempotency_key ~ '^[A-Za-z0-9._:-]+$'
  ),
  semantic_request_digest text not null check (
    semantic_request_digest ~ '^[0-9a-f]{64}$'
  ),
  immutable_response jsonb not null check (jsonb_typeof(immutable_response) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  constraint ovr_reporter_responses_closure_context_fkey
    foreign key (organization_id, ovr_report_id, governance_closure_id)
    references public.ovr_governance_closures(organization_id, ovr_report_id, id)
    on delete restrict,
  constraint ovr_reporter_responses_reporter_context_fkey
    foreign key (organization_id, ovr_report_id, reporter_profile_id)
    references public.ovr_reports(organization_id, id, reported_by)
    on delete restrict,
  constraint ovr_reporter_responses_reason_contract check (
    (response_type = 'acknowledged' and response_reason is null)
    or (
      response_type = 'disputed'
      and length(btrim(coalesce(response_reason, ''))) between 1 and 2000
    )
  ),
  constraint ovr_reporter_responses_one_per_closure unique (
    organization_id, ovr_report_id, governance_closure_id
  ),
  constraint ovr_reporter_responses_org_idempotency_key unique (
    organization_id, idempotency_key
  ),
  constraint ovr_reporter_responses_context_id_key unique (
    organization_id, ovr_report_id, governance_closure_id, id
  ),
  constraint ovr_reporter_responses_ovr_id_key unique (
    organization_id, ovr_report_id, id
  )
);

create index if not exists idx_ovr_reporter_responses_reporter
  on public.ovr_reporter_responses (
    organization_id, reporter_profile_id, responded_at desc
  );
create index if not exists idx_ovr_reporter_responses_reporter_context
  on public.ovr_reporter_responses (
    organization_id, ovr_report_id, reporter_profile_id
  );

create table if not exists public.ovr_post_closure_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ovr_report_id uuid not null,
  originating_closure_id uuid not null,
  originating_verdict_id uuid not null,
  opened_from_reporter_response_id uuid not null,
  review_cycle_id uuid not null,
  status text not null default 'open' check (
    status in ('open', 'under_review', 'completed', 'cancelled')
  ),
  opened_by uuid not null,
  opened_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  resulting_verdict_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint ovr_post_closure_reviews_closure_context_fkey
    foreign key (organization_id, ovr_report_id, originating_closure_id)
    references public.ovr_governance_closures(organization_id, ovr_report_id, id)
    on delete restrict,
  constraint ovr_post_closure_reviews_origin_verdict_context_fkey
    foreign key (organization_id, ovr_report_id, originating_verdict_id)
    references public.ovr_final_verdicts(organization_id, ovr_report_id, id)
    on delete restrict,
  constraint ovr_post_closure_reviews_closure_verdict_context_fkey
    foreign key (
      organization_id, ovr_report_id, originating_closure_id,
      originating_verdict_id
    ) references public.ovr_governance_closures(
      organization_id, ovr_report_id, id, final_verdict_id
    ) on delete restrict,
  constraint ovr_post_closure_reviews_response_context_fkey
    foreign key (
      organization_id, ovr_report_id, originating_closure_id,
      opened_from_reporter_response_id
    ) references public.ovr_reporter_responses(
      organization_id, ovr_report_id, governance_closure_id, id
    ) on delete restrict,
  constraint ovr_post_closure_reviews_cycle_context_fkey
    foreign key (organization_id, ovr_report_id, review_cycle_id)
    references public.ovr_review_cycles(organization_id, ovr_report_id, id)
    on delete restrict,
  constraint ovr_post_closure_reviews_opened_by_org_fkey
    foreign key (organization_id, opened_by)
    references public.profiles(organization_id, id) on delete restrict,
  constraint ovr_post_closure_reviews_result_verdict_context_fkey
    foreign key (
      organization_id, ovr_report_id, review_cycle_id, resulting_verdict_id
    ) references public.ovr_final_verdicts(
      organization_id, ovr_report_id, review_cycle_id, id
    )
    on delete restrict,
  constraint ovr_post_closure_reviews_completion_contract check (
    (status = 'completed' and completed_at is not null and resulting_verdict_id is not null)
    or (status <> 'completed' and completed_at is null)
  ),
  constraint ovr_post_closure_reviews_one_response unique (
    opened_from_reporter_response_id
  ),
  constraint ovr_post_closure_reviews_one_cycle unique (
    organization_id, ovr_report_id, review_cycle_id
  ),
  constraint ovr_post_closure_reviews_context_id_key unique (
    organization_id, ovr_report_id, review_cycle_id, id
  )
);

create index if not exists idx_ovr_post_closure_reviews_origin_closure
  on public.ovr_post_closure_reviews (originating_closure_id);
create index if not exists idx_ovr_post_closure_reviews_origin_verdict
  on public.ovr_post_closure_reviews (originating_verdict_id);
create index if not exists idx_ovr_post_closure_reviews_result_verdict
  on public.ovr_post_closure_reviews (resulting_verdict_id)
  where resulting_verdict_id is not null;
create index if not exists idx_ovr_post_closure_reviews_status
  on public.ovr_post_closure_reviews (organization_id, status, opened_at);
create index if not exists idx_ovr_post_closure_reviews_opened_by
  on public.ovr_post_closure_reviews (organization_id, opened_by);
create index if not exists idx_ovr_post_closure_reviews_response_context
  on public.ovr_post_closure_reviews (
    organization_id, ovr_report_id, originating_closure_id,
    opened_from_reporter_response_id
  );
create index if not exists idx_ovr_post_closure_reviews_origin_verdict_context
  on public.ovr_post_closure_reviews (
    organization_id, ovr_report_id, originating_verdict_id
  );
create index if not exists idx_ovr_post_closure_reviews_result_verdict_context
  on public.ovr_post_closure_reviews (
    organization_id, ovr_report_id, review_cycle_id, resulting_verdict_id
  ) where resulting_verdict_id is not null;

create table if not exists public.ovr_workflow_events_v11 (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ovr_report_id uuid not null,
  review_cycle_id uuid,
  stage_instance_id uuid,
  actor_id uuid not null,
  event_type text not null check (event_type in (
    'final_verdict_issued', 'governance_closed', 'reporter_acknowledged',
    'reporter_disputed', 'post_closure_cycle_opened',
    'superseding_verdict_issued', 'superseding_decision_closed'
  )),
  final_verdict_id uuid,
  governance_closure_id uuid,
  reporter_response_id uuid,
  post_closure_review_id uuid,
  idempotency_key text check (
    idempotency_key is null
    or (
      length(idempotency_key) between 1 and 128
      and idempotency_key ~ '^[A-Za-z0-9._:-]+$'
    )
  ),
  idempotency_operation text check (
    idempotency_operation is null
    or idempotency_operation in (
      'issue_final_verdict', 'perform_governance_closure',
      'reporter_acknowledge', 'reporter_dispute'
    )
  ),
  semantic_request_digest text check (
    semantic_request_digest is null
    or semantic_request_digest ~ '^[0-9a-f]{64}$'
  ),
  immutable_response jsonb check (
    immutable_response is null or jsonb_typeof(immutable_response) = 'object'
  ),
  event_payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(event_payload) = 'object'
  ),
  occurred_at timestamptz not null default statement_timestamp(),
  constraint ovr_workflow_events_v11_ovr_org_fkey
    foreign key (organization_id, ovr_report_id)
    references public.ovr_reports(organization_id, id) on delete restrict,
  constraint ovr_workflow_events_v11_actor_org_fkey
    foreign key (organization_id, actor_id)
    references public.profiles(organization_id, id) on delete restrict,
  constraint ovr_workflow_events_v11_stage_context_fkey
    foreign key (organization_id, ovr_report_id, review_cycle_id, stage_instance_id)
    references public.ovr_stage_instances(
      organization_id, ovr_report_id, review_cycle_id, id
    ) on delete restrict,
  constraint ovr_workflow_events_v11_verdict_context_fkey
    foreign key (organization_id, ovr_report_id, final_verdict_id)
    references public.ovr_final_verdicts(organization_id, ovr_report_id, id)
    on delete restrict,
  constraint ovr_workflow_events_v11_closure_context_fkey
    foreign key (organization_id, ovr_report_id, governance_closure_id)
    references public.ovr_governance_closures(organization_id, ovr_report_id, id)
    on delete restrict,
  constraint ovr_workflow_events_v11_response_context_fkey
    foreign key (organization_id, ovr_report_id, reporter_response_id)
    references public.ovr_reporter_responses(organization_id, ovr_report_id, id)
    on delete restrict,
  constraint ovr_workflow_events_v11_review_context_fkey
    foreign key (
      organization_id, ovr_report_id, review_cycle_id,
      post_closure_review_id
    ) references public.ovr_post_closure_reviews(
      organization_id, ovr_report_id, review_cycle_id, id
    ) on delete restrict,
  constraint ovr_workflow_events_v11_idempotency_contract check (
    (
      idempotency_key is null
      and idempotency_operation is null
      and semantic_request_digest is null
      and immutable_response is null
    ) or (
      idempotency_key is not null
      and idempotency_operation is not null
      and semantic_request_digest is not null
      and immutable_response is not null
    )
  )
);

create unique index if not exists uq_ovr_workflow_events_v11_idempotency
  on public.ovr_workflow_events_v11 (organization_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists idx_ovr_workflow_events_v11_ovr_time
  on public.ovr_workflow_events_v11 (
    organization_id, ovr_report_id, occurred_at desc
  );
create index if not exists idx_ovr_workflow_events_v11_cycle_time
  on public.ovr_workflow_events_v11 (
    organization_id, review_cycle_id, occurred_at desc
  ) where review_cycle_id is not null;
create index if not exists idx_ovr_workflow_events_v11_actor
  on public.ovr_workflow_events_v11 (organization_id, actor_id, occurred_at desc);
create index if not exists idx_ovr_workflow_events_v11_verdict
  on public.ovr_workflow_events_v11 (final_verdict_id)
  where final_verdict_id is not null;
create index if not exists idx_ovr_workflow_events_v11_closure
  on public.ovr_workflow_events_v11 (governance_closure_id)
  where governance_closure_id is not null;
create index if not exists idx_ovr_workflow_events_v11_response
  on public.ovr_workflow_events_v11 (reporter_response_id)
  where reporter_response_id is not null;
create index if not exists idx_ovr_workflow_events_v11_stage
  on public.ovr_workflow_events_v11 (stage_instance_id)
  where stage_instance_id is not null;
create index if not exists idx_ovr_workflow_events_v11_post_review
  on public.ovr_workflow_events_v11 (post_closure_review_id)
  where post_closure_review_id is not null;
create index if not exists idx_ovr_workflow_events_v11_stage_context
  on public.ovr_workflow_events_v11 (
    organization_id, ovr_report_id, review_cycle_id, stage_instance_id
  ) where stage_instance_id is not null;
create index if not exists idx_ovr_workflow_events_v11_review_context
  on public.ovr_workflow_events_v11 (
    organization_id, ovr_report_id, review_cycle_id, post_closure_review_id
  ) where post_closure_review_id is not null;
create index if not exists idx_ovr_workflow_events_v11_verdict_context
  on public.ovr_workflow_events_v11 (
    organization_id, ovr_report_id, final_verdict_id
  ) where final_verdict_id is not null;
create index if not exists idx_ovr_workflow_events_v11_closure_context
  on public.ovr_workflow_events_v11 (
    organization_id, ovr_report_id, governance_closure_id
  ) where governance_closure_id is not null;
create index if not exists idx_ovr_workflow_events_v11_response_context
  on public.ovr_workflow_events_v11 (
    organization_id, ovr_report_id, reporter_response_id
  ) where reporter_response_id is not null;

-- Immutable-history and controlled-lifecycle guards.
create or replace function ovr_v11_private.guard_immutable_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
begin
  raise exception using errcode = 'P0001', message = 'OVR_V11_IMMUTABLE_HISTORY';
end;
$$;

revoke all on function ovr_v11_private.guard_immutable_history()
from public, anon, authenticated, service_role;

drop trigger if exists trg_ovr_final_verdicts_immutable on public.ovr_final_verdicts;
create trigger trg_ovr_final_verdicts_immutable
before update or delete on public.ovr_final_verdicts
for each statement execute function ovr_v11_private.guard_immutable_history();

drop trigger if exists trg_ovr_governance_closures_immutable on public.ovr_governance_closures;
create trigger trg_ovr_governance_closures_immutable
before update or delete on public.ovr_governance_closures
for each statement execute function ovr_v11_private.guard_immutable_history();

drop trigger if exists trg_ovr_reporter_responses_immutable on public.ovr_reporter_responses;
create trigger trg_ovr_reporter_responses_immutable
before update or delete on public.ovr_reporter_responses
for each statement execute function ovr_v11_private.guard_immutable_history();

drop trigger if exists trg_ovr_workflow_events_v11_immutable on public.ovr_workflow_events_v11;
create trigger trg_ovr_workflow_events_v11_immutable
before update or delete on public.ovr_workflow_events_v11
for each statement execute function ovr_v11_private.guard_immutable_history();

create or replace function ovr_v11_private.guard_separation_policy()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'OVR_V11_SEPARATION_POLICY_DELETE_DENIED';
  end if;
  if new.organization_id is distinct from old.organization_id
    or new.configured_by is distinct from old.configured_by
    or new.configured_at is distinct from old.configured_at
  then
    raise exception using errcode = 'P0001', message = 'OVR_V11_SEPARATION_POLICY_IDENTITY_IMMUTABLE';
  end if;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function ovr_v11_private.guard_separation_policy()
from public, anon, authenticated, service_role;

drop trigger if exists trg_ovr_separation_policy_guard on public.ovr_separation_policies;
create trigger trg_ovr_separation_policy_guard
before update or delete on public.ovr_separation_policies
for each row execute function ovr_v11_private.guard_separation_policy();

create or replace function ovr_v11_private.guard_post_closure_review()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'OVR_V11_POST_CLOSURE_REVIEW_DELETE_DENIED';
  end if;
  if new.organization_id is distinct from old.organization_id
    or new.ovr_report_id is distinct from old.ovr_report_id
    or new.originating_closure_id is distinct from old.originating_closure_id
    or new.originating_verdict_id is distinct from old.originating_verdict_id
    or new.opened_from_reporter_response_id is distinct from old.opened_from_reporter_response_id
    or new.review_cycle_id is distinct from old.review_cycle_id
    or new.opened_by is distinct from old.opened_by
    or new.opened_at is distinct from old.opened_at
  then
    raise exception using errcode = 'P0001', message = 'OVR_V11_POST_CLOSURE_REVIEW_IDENTITY_IMMUTABLE';
  end if;
  if old.status in ('completed', 'cancelled') and new is distinct from old then
    raise exception using errcode = 'P0001', message = 'OVR_V11_POST_CLOSURE_REVIEW_IMMUTABLE';
  end if;
  if old.status = 'open' and new.status not in ('open', 'under_review', 'completed', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'OVR_V11_POST_CLOSURE_REVIEW_TRANSITION_DENIED';
  end if;
  if old.status = 'under_review' and new.status not in ('under_review', 'completed', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'OVR_V11_POST_CLOSURE_REVIEW_TRANSITION_DENIED';
  end if;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function ovr_v11_private.guard_post_closure_review()
from public, anon, authenticated, service_role;

drop trigger if exists trg_ovr_post_closure_review_guard on public.ovr_post_closure_reviews;
create trigger trg_ovr_post_closure_review_guard
before update or delete on public.ovr_post_closure_reviews
for each row execute function ovr_v11_private.guard_post_closure_review();

-- Private contract helpers. All public operations still prove the represented
-- actor after requiring the service execution identity.
create or replace function ovr_v11_private.validate_idempotency_key(p_key text)
returns void
language plpgsql
immutable
security invoker
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
begin
  if p_key is null
    or length(p_key) not between 1 and 128
    or p_key !~ '^[A-Za-z0-9._:-]+$'
  then
    raise exception using errcode = 'P0001', message = 'OVR_V11_IDEMPOTENCY_KEY_INVALID';
  end if;
end;
$$;

revoke all on function ovr_v11_private.validate_idempotency_key(text)
from public, anon, authenticated, service_role;

create or replace function ovr_v11_private.semantic_digest(p_payload jsonb)
returns text
language sql
immutable
security invoker
set search_path = pg_catalog, public, ovr_v11_private, extensions, pg_temp
as $$
  select encode(
    extensions.digest(convert_to(p_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );
$$;

revoke all on function ovr_v11_private.semantic_digest(jsonb)
from public, anon, authenticated, service_role;

create or replace function ovr_v11_private.active_actor_organization(p_actor_id uuid)
returns uuid
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
declare
  v_organization_id uuid;
begin
  select p.organization_id into v_organization_id
  from public.profiles p
  join public.user_credential_states cs
    on cs.user_id = p.id
   and cs.organization_id = p.organization_id
  where p.id = p_actor_id
    and p.organization_id is not null
    and p.is_active
    and p.user_status = 'active'
    and cs.credential_state = 'active'
    and cs.identity_mode in ('legacy_verified', 'employee_id_managed');

  if v_organization_id is null then
    raise exception using errcode = 'P0001', message = 'OVR_V11_ACTIVE_ACTOR_REQUIRED';
  end if;
  return v_organization_id;
end;
$$;

revoke all on function ovr_v11_private.active_actor_organization(uuid)
from public, anon, authenticated, service_role;

create or replace function ovr_v11_private.assert_assigned_action_actor(
  p_organization_id uuid,
  p_ovr_report_id uuid,
  p_review_cycle_id uuid,
  p_stage_instance_id uuid,
  p_actor_id uuid,
  p_capability text
)
returns public.ovr_reviewer_assignments
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
declare
  v_assignment public.ovr_reviewer_assignments%rowtype;
  v_role_count integer;
begin
  select a.* into v_assignment
  from public.ovr_reviewer_assignments a
  join public.ovr_reviewer_pool_memberships m
    on m.id = a.reviewer_membership_id
   and m.organization_id = a.organization_id
   and m.profile_id = a.reviewer_profile_id
  where a.organization_id = p_organization_id
    and a.ovr_report_id = p_ovr_report_id
    and a.review_cycle_id = p_review_cycle_id
    and a.stage_instance_id = p_stage_instance_id
    and a.reviewer_profile_id = p_actor_id
    and a.status = 'active'
    and m.capability = p_capability
    and m.is_active
    and m.valid_from <= statement_timestamp()
    and (m.valid_to is null or m.valid_to > statement_timestamp());

  if not found then
    raise exception using errcode = 'P0001', message = 'OVR_V11_ACTIVE_EXACT_ASSIGNMENT_REQUIRED';
  end if;

  select count(*)::integer into v_role_count
  from public.user_roles ur
  where ur.user_id = p_actor_id
    and ur.is_active
    and ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
    and ur.scope = 'global'
    and public.patch83u_role_assignment_valid(
      p_organization_id, ur.scope, ur.organization_id,
      ur.division_id, ur.department_id, ur.unit_id
    );

  if v_role_count <> 1 then
    raise exception using errcode = 'P0001', message = 'OVR_V11_ASSIGNED_ACTOR_ROLE_REQUIRED';
  end if;
  return v_assignment;
end;
$$;

revoke all on function ovr_v11_private.assert_assigned_action_actor(uuid,uuid,uuid,uuid,uuid,text)
from public, anon, authenticated, service_role;

create or replace function ovr_v11_private.assert_not_conflicted(
  p_organization_id uuid,
  p_ovr_report_id uuid,
  p_actor_id uuid,
  p_protected_action text
)
returns void
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
begin
  if exists (
    select 1
    from ovr_v11_private.current_conflicts(
      p_organization_id, p_ovr_report_id, p_protected_action,
      statement_timestamp()
    ) c
    where c.affected_profile_id = p_actor_id
  ) then
    raise exception using errcode = 'P0001', message = 'OVR_V11_ACTOR_CONFLICTED';
  end if;
end;
$$;

revoke all on function ovr_v11_private.assert_not_conflicted(uuid,uuid,uuid,text)
from public, anon, authenticated, service_role;

create or replace function ovr_v11_private.evidence_gate_snapshot(
  p_organization_id uuid,
  p_ovr_report_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
declare
  v_ovr public.ovr_reports%rowtype;
  v_accepted_current integer;
  v_closed_project boolean;
  v_legacy_gate boolean;
  v_satisfied boolean;
begin
  select * into v_ovr
  from public.ovr_reports
  where organization_id = p_organization_id
    and id = p_ovr_report_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'OVR_V11_OVR_NOT_FOUND';
  end if;

  select count(*)::integer into v_accepted_current
  from public.evidence_files e
  where e.organization_id = p_organization_id
    and e.ovr_report_id = p_ovr_report_id
    and e.status::text = 'accepted'
    and e.review_status = 'accepted'
    and e.is_current_version
    and e.superseded_by_evidence_id is null
    and (e.expiry_date is null or e.expiry_date >= current_date);

  select exists (
    select 1 from public.projects p
    where p.organization_id = p_organization_id
      and p.id = v_ovr.linked_project_id
      and p.status::text = 'closed'
  ) into v_closed_project;

  v_legacy_gate := public.can_close_ovr(p_ovr_report_id);
  v_satisfied := not v_ovr.evidence_required
    or v_accepted_current > 0
    or v_closed_project;
  return jsonb_build_object(
    'gate_version', 'ovr-v11-strict-evidence-v2',
    'satisfied', v_satisfied,
    'evidence_required', v_ovr.evidence_required,
    'strict_accepted_current_evidence_count', v_accepted_current,
    'authoritative_corrective_project_gate', v_closed_project,
    'legacy_can_close_result', v_legacy_gate,
    'evaluated_at', statement_timestamp()
  );
end;
$$;

revoke all on function ovr_v11_private.evidence_gate_snapshot(uuid,uuid)
from public, anon, authenticated, service_role;

create or replace function ovr_v11_private.separation_policy_snapshot(
  p_organization_id uuid,
  p_ovr_report_id uuid,
  p_verdict_issuer uuid,
  p_closer uuid,
  p_effective_severity public.ovr_severity_level
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
declare
  v_sensitivity text;
  v_allow_same boolean := false;
  v_configured boolean := false;
  v_mandatory boolean;
  v_basis text[] := '{}'::text[];
begin
  select sensitivity into v_sensitivity
  from public.ovr_relationship_state
  where organization_id = p_organization_id
    and ovr_report_id = p_ovr_report_id;
  if v_sensitivity is null then
    raise exception using errcode = 'P0001', message = 'OVR_V11_RELATIONSHIP_STATE_REQUIRED';
  end if;

  select true, allow_same_actor_ordinary
    into v_configured, v_allow_same
  from public.ovr_separation_policies
  where organization_id = p_organization_id;

  if p_effective_severity = 'level_4' then v_basis := array_append(v_basis, 'level_4'); end if;
  if p_effective_severity = 'sentinel' then v_basis := array_append(v_basis, 'sentinel'); end if;
  if v_sensitivity = 'confidential' then v_basis := array_append(v_basis, 'confidential'); end if;
  if v_sensitivity = 'retaliation_sensitive' then v_basis := array_append(v_basis, 'retaliation_sensitive'); end if;
  v_mandatory := cardinality(v_basis) > 0;

  if p_verdict_issuer = p_closer and (v_mandatory or not (v_configured and v_allow_same)) then
    raise exception using errcode = 'P0001', message = 'OVR_V11_MANDATORY_SEPARATION_REQUIRED';
  end if;

  return jsonb_build_object(
    'policy_version', 'ovr-v11-sod-v1',
    'mandatory_distinct', v_mandatory,
    'mandatory_basis', to_jsonb(v_basis),
    'ordinary_same_actor_explicitly_configured', v_configured and v_allow_same,
    'verdict_issuer', p_verdict_issuer,
    'governance_closer', p_closer,
    'satisfied', p_verdict_issuer <> p_closer or (not v_mandatory and v_configured and v_allow_same)
  );
end;
$$;

revoke all on function ovr_v11_private.separation_policy_snapshot(uuid,uuid,uuid,uuid,public.ovr_severity_level)
from public, anon, authenticated, service_role;

create or replace function ovr_v11_private.replay_response(
  p_organization_id uuid,
  p_idempotency_key text,
  p_operation text,
  p_actor_id uuid,
  p_ovr_report_id uuid,
  p_digest text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
declare
  v_event public.ovr_workflow_events_v11%rowtype;
begin
  select * into v_event
  from public.ovr_workflow_events_v11
  where organization_id = p_organization_id
    and idempotency_key = p_idempotency_key;
  if not found then
    return null;
  end if;
  if v_event.idempotency_operation is distinct from p_operation
    or v_event.actor_id is distinct from p_actor_id
    or v_event.ovr_report_id is distinct from p_ovr_report_id
    or v_event.semantic_request_digest is distinct from p_digest
  then
    raise exception using errcode = 'P0001', message = 'OVR_V11_IDEMPOTENCY_KEY_REUSE_DENIED';
  end if;
  return v_event.immutable_response;
end;
$$;

revoke all on function ovr_v11_private.replay_response(uuid,text,text,uuid,uuid,text)
from public, anon, authenticated, service_role;

-- Resolve the sole authoritative leaf from immutable verdict lineage. Callers
-- never nominate a current verdict; ambiguity or corruption fails closed.
create or replace function ovr_v11_private.current_verdict(
  p_organization_id uuid,
  p_ovr_report_id uuid
)
returns public.ovr_final_verdicts
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
declare
  v_leaf_count integer;
  v_verdict public.ovr_final_verdicts%rowtype;
begin
  select count(*)::integer into v_leaf_count
  from public.ovr_final_verdicts candidate
  where candidate.organization_id = p_organization_id
    and candidate.ovr_report_id = p_ovr_report_id
    and not exists (
      select 1
      from public.ovr_final_verdicts successor
      where successor.organization_id = candidate.organization_id
        and successor.ovr_report_id = candidate.ovr_report_id
        and successor.supersedes_verdict_id = candidate.id
    );

  if v_leaf_count = 0 then
    raise exception using errcode = 'P0001', message = 'OVR_V11_FINAL_VERDICT_REQUIRED';
  elsif v_leaf_count <> 1 then
    raise exception using errcode = 'P0001', message = 'OVR_V11_CURRENT_VERDICT_AMBIGUOUS';
  end if;

  select candidate.* into strict v_verdict
  from public.ovr_final_verdicts candidate
  where candidate.organization_id = p_organization_id
    and candidate.ovr_report_id = p_ovr_report_id
    and not exists (
      select 1
      from public.ovr_final_verdicts successor
      where successor.organization_id = candidate.organization_id
        and successor.ovr_report_id = candidate.ovr_report_id
        and successor.supersedes_verdict_id = candidate.id
    );
  return v_verdict;
end;
$$;

revoke all on function ovr_v11_private.current_verdict(uuid,uuid)
from public, anon, authenticated, service_role;

-- Issue an immutable verdict from the exact active P1 final-verdict assignment.
create or replace function public.ovr_v11_issue_final_verdict(
  p_actor_id uuid,
  p_ovr_report_id uuid,
  p_stage_instance_id uuid,
  p_verdict text,
  p_effective_severity public.ovr_severity_level,
  p_corrective_action_required boolean,
  p_idempotency_key text,
  p_supersedes_verdict_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, extensions, pg_temp
as $$
declare
  v_actor_org uuid;
  v_replay_org uuid;
  v_replay_cycle_id uuid;
  v_ovr public.ovr_reports%rowtype;
  v_cycle public.ovr_review_cycles%rowtype;
  v_stage public.ovr_stage_instances%rowtype;
  v_assignment public.ovr_reviewer_assignments%rowtype;
  v_prior public.ovr_final_verdicts%rowtype;
  v_post_review public.ovr_post_closure_reviews%rowtype;
  v_verdict text := nullif(btrim(p_verdict), '');
  v_digest text;
  v_replay jsonb;
  v_verdict_id uuid := gen_random_uuid();
  v_issued_at timestamptz := statement_timestamp();
  v_response jsonb;
begin
  perform ovr_v11_private.assert_service_caller();
  perform ovr_v11_private.validate_idempotency_key(p_idempotency_key);
  if p_actor_id is null or p_ovr_report_id is null or p_stage_instance_id is null
    or p_effective_severity is null or p_corrective_action_required is null
    or v_verdict is null or length(v_verdict) > 2000
  then
    raise exception using errcode = 'P0001', message = 'OVR_V11_VERDICT_PAYLOAD_INVALID';
  end if;

  -- A completed immutable operation is replayable even if the actor, credential,
  -- assignment, or workflow lifecycle changed after the original commit.
  select organization_id into v_replay_org
  from public.ovr_reports
  where id = p_ovr_report_id;
  if v_replay_org is not null then
    select review_cycle_id into v_replay_cycle_id
    from public.ovr_stage_instances
    where id = p_stage_instance_id
      and organization_id = v_replay_org
      and ovr_report_id = p_ovr_report_id;
    v_digest := ovr_v11_private.semantic_digest(jsonb_build_object(
      'operation','issue_final_verdict','organization_id',v_replay_org,
      'ovr_report_id',p_ovr_report_id,'review_cycle_id',v_replay_cycle_id,
      'stage_instance_id',p_stage_instance_id,'actor_id',p_actor_id,
      'verdict',v_verdict,'effective_severity',p_effective_severity,
      'corrective_action_required',p_corrective_action_required,
      'supersedes_verdict_id',p_supersedes_verdict_id
    ));
    v_replay := ovr_v11_private.replay_response(
      v_replay_org,p_idempotency_key,'issue_final_verdict',p_actor_id,
      p_ovr_report_id,v_digest
    );
    if v_replay is not null then return v_replay; end if;
  end if;

  v_actor_org := ovr_v11_private.active_actor_organization(p_actor_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'ovr-v11-route:' || v_actor_org::text || ':' || p_ovr_report_id::text, 0
  ));

  select * into v_ovr from public.ovr_reports where id = p_ovr_report_id for update;
  if not found then raise exception using errcode='P0001', message='OVR_V11_OVR_NOT_FOUND'; end if;
  if v_ovr.organization_id is distinct from v_actor_org then
    raise exception using errcode='P0001', message='OVR_V11_CROSS_ORGANIZATION_DENIED';
  end if;

  select c.* into v_cycle
  from public.ovr_stage_instances s
  join public.ovr_review_cycles c
    on c.id=s.review_cycle_id and c.organization_id=s.organization_id
   and c.ovr_report_id=s.ovr_report_id
  where s.id=p_stage_instance_id and s.organization_id=v_actor_org
    and s.ovr_report_id=p_ovr_report_id
  for update of c;
  if not found then raise exception using errcode='P0001', message='OVR_V11_STAGE_NOT_FOUND'; end if;

  perform 1 from public.ovr_relationship_state
  where organization_id=v_actor_org and ovr_report_id=p_ovr_report_id
  for share;
  if not found then raise exception using errcode='P0001', message='OVR_V11_RELATIONSHIP_STATE_REQUIRED'; end if;

  perform 1 from public.ovr_reviewer_assignments a
  where a.organization_id=v_actor_org and a.ovr_report_id=p_ovr_report_id
    and a.review_cycle_id=v_cycle.id and a.stage_instance_id=p_stage_instance_id
  order by a.id for update;

  select * into v_stage from public.ovr_stage_instances
  where id=p_stage_instance_id and organization_id=v_actor_org
    and ovr_report_id=p_ovr_report_id and review_cycle_id=v_cycle.id
  for update;
  if not found then raise exception using errcode='P0001', message='OVR_V11_STAGE_NOT_FOUND'; end if;

  v_digest := ovr_v11_private.semantic_digest(jsonb_build_object(
    'operation','issue_final_verdict','organization_id',v_actor_org,
    'ovr_report_id',p_ovr_report_id,'review_cycle_id',v_cycle.id,
    'stage_instance_id',p_stage_instance_id,'actor_id',p_actor_id,
    'verdict',v_verdict,'effective_severity',p_effective_severity,
    'corrective_action_required',p_corrective_action_required,
    'supersedes_verdict_id',p_supersedes_verdict_id
  ));
  v_replay := ovr_v11_private.replay_response(
    v_actor_org,p_idempotency_key,'issue_final_verdict',p_actor_id,
    p_ovr_report_id,v_digest
  );
  if v_replay is not null then return v_replay; end if;

  select * into v_post_review from public.ovr_post_closure_reviews
  where organization_id=v_actor_org and ovr_report_id=p_ovr_report_id
    and review_cycle_id=v_cycle.id and status in ('open','under_review');

  perform ovr_v11_private.assert_not_conflicted(
    v_actor_org,p_ovr_report_id,p_actor_id,'final_verdict'
  );
  if v_cycle.status <> 'active' or v_stage.stage_type <> 'final_verdict'
    or v_stage.lifecycle_status <> 'assigned'
  then
    raise exception using errcode='P0001', message='OVR_V11_ACTIVE_FINAL_VERDICT_STAGE_REQUIRED';
  end if;
  if v_post_review.id is null and v_ovr.status::text <> 'quality_final_review' then
    raise exception using errcode='P0001', message='OVR_V11_FINAL_REVIEW_LIFECYCLE_REQUIRED';
  end if;
  if v_post_review.id is not null and v_ovr.status::text <> 'closed' then
    raise exception using errcode='P0001', message='OVR_V11_POST_CLOSURE_OVR_MUST_REMAIN_CLOSED';
  end if;

  v_assignment := ovr_v11_private.assert_assigned_action_actor(
    v_actor_org,p_ovr_report_id,v_cycle.id,p_stage_instance_id,p_actor_id,'final_verdict'
  );

  if p_supersedes_verdict_id is null and v_post_review.id is not null then
    raise exception using errcode='P0001', message='OVR_V11_SUPERSEDED_VERDICT_REQUIRED';
  elsif p_supersedes_verdict_id is not null then
    v_prior := ovr_v11_private.current_verdict(v_actor_org,p_ovr_report_id);
    if v_prior.id is distinct from p_supersedes_verdict_id
      or v_post_review.id is null
      or v_post_review.originating_verdict_id is distinct from v_prior.id
    then
      raise exception using errcode='P0001', message='OVR_V11_SUPERSESSION_CONTEXT_INVALID';
    end if;
  end if;

  v_response := jsonb_build_object(
    'status','issued','final_verdict_id',v_verdict_id,
    'ovr_report_id',p_ovr_report_id,'review_cycle_id',v_cycle.id,
    'issued_at',v_issued_at,'supersedes_verdict_id',p_supersedes_verdict_id
  );
  insert into public.ovr_final_verdicts(
    id,organization_id,ovr_report_id,review_cycle_id,stage_instance_id,
    reviewer_assignment_id,issued_by,verdict,effective_severity,
    corrective_action_required,issued_at,supersedes_verdict_id,
    idempotency_key,semantic_request_digest,immutable_response
  ) values (
    v_verdict_id,v_actor_org,p_ovr_report_id,v_cycle.id,p_stage_instance_id,
    v_assignment.id,p_actor_id,v_verdict,p_effective_severity,
    p_corrective_action_required,v_issued_at,p_supersedes_verdict_id,
    p_idempotency_key,v_digest,v_response
  );

  update public.ovr_reviewer_assignments
  set status='completed',ended_at=v_issued_at,termination_reason='final_verdict_issued',
      updated_at=v_issued_at
  where id=v_assignment.id;
  update public.ovr_stage_instances
  set lifecycle_status='completed',completed_at=v_issued_at,routing_block_reason=null
  where id=v_stage.id;

  if v_post_review.id is not null then
    update public.ovr_post_closure_reviews
    set status='under_review', resulting_verdict_id=v_verdict_id
    where id=v_post_review.id;
  end if;

  insert into public.ovr_workflow_events_v11(
    organization_id,ovr_report_id,review_cycle_id,stage_instance_id,actor_id,
    event_type,final_verdict_id,post_closure_review_id,idempotency_key,
    idempotency_operation,semantic_request_digest,immutable_response,event_payload
  ) values (
    v_actor_org,p_ovr_report_id,v_cycle.id,p_stage_instance_id,p_actor_id,
    case when p_supersedes_verdict_id is null then 'final_verdict_issued' else 'superseding_verdict_issued' end,
    v_verdict_id,v_post_review.id,p_idempotency_key,'issue_final_verdict',
    v_digest,v_response,jsonb_build_object(
      'effective_severity',p_effective_severity,
      'corrective_action_required',p_corrective_action_required
    )
  );
  return v_response;
end;
$$;

-- Perform governance closure from the exact P1 closure assignment. For an
-- original cycle this closes the released OVR row using fields required by the
-- existing v98 guard. A later review cycle never rewrites original closure data.
create or replace function public.ovr_v11_perform_governance_closure(
  p_actor_id uuid,
  p_ovr_report_id uuid,
  p_stage_instance_id uuid,
  p_final_verdict_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, extensions, pg_temp
as $$
declare
  v_actor_org uuid;
  v_replay_org uuid;
  v_replay_cycle_id uuid;
  v_ovr public.ovr_reports%rowtype;
  v_cycle public.ovr_review_cycles%rowtype;
  v_stage public.ovr_stage_instances%rowtype;
  v_assignment public.ovr_reviewer_assignments%rowtype;
  v_verdict public.ovr_final_verdicts%rowtype;
  v_post_review public.ovr_post_closure_reviews%rowtype;
  v_evidence jsonb;
  v_separation jsonb;
  v_digest text;
  v_replay jsonb;
  v_closure_id uuid := gen_random_uuid();
  v_closed_at timestamptz := statement_timestamp();
  v_response jsonb;
begin
  perform ovr_v11_private.assert_service_caller();
  perform ovr_v11_private.validate_idempotency_key(p_idempotency_key);
  if p_actor_id is null or p_ovr_report_id is null or p_stage_instance_id is null
    or p_final_verdict_id is null
  then raise exception using errcode='P0001', message='OVR_V11_CLOSURE_IDENTIFIERS_REQUIRED'; end if;

  select organization_id into v_replay_org
  from public.ovr_reports
  where id = p_ovr_report_id;
  if v_replay_org is not null then
    select review_cycle_id into v_replay_cycle_id
    from public.ovr_stage_instances
    where id = p_stage_instance_id
      and organization_id = v_replay_org
      and ovr_report_id = p_ovr_report_id;
    v_digest := ovr_v11_private.semantic_digest(jsonb_build_object(
      'operation','perform_governance_closure','organization_id',v_replay_org,
      'ovr_report_id',p_ovr_report_id,'review_cycle_id',v_replay_cycle_id,
      'stage_instance_id',p_stage_instance_id,'actor_id',p_actor_id,
      'final_verdict_id',p_final_verdict_id
    ));
    v_replay := ovr_v11_private.replay_response(
      v_replay_org,p_idempotency_key,'perform_governance_closure',p_actor_id,
      p_ovr_report_id,v_digest
    );
    if v_replay is not null then return v_replay; end if;
  end if;

  v_actor_org := ovr_v11_private.active_actor_organization(p_actor_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'ovr-v11-route:' || v_actor_org::text || ':' || p_ovr_report_id::text, 0
  ));
  select * into v_ovr from public.ovr_reports where id=p_ovr_report_id for update;
  if not found then raise exception using errcode='P0001', message='OVR_V11_OVR_NOT_FOUND'; end if;
  if v_ovr.organization_id is distinct from v_actor_org then
    raise exception using errcode='P0001', message='OVR_V11_CROSS_ORGANIZATION_DENIED';
  end if;

  select c.* into v_cycle
  from public.ovr_stage_instances s
  join public.ovr_review_cycles c
    on c.id=s.review_cycle_id and c.organization_id=s.organization_id
   and c.ovr_report_id=s.ovr_report_id
  where s.id=p_stage_instance_id and s.organization_id=v_actor_org
    and s.ovr_report_id=p_ovr_report_id
  for update of c;
  if not found then raise exception using errcode='P0001', message='OVR_V11_STAGE_NOT_FOUND'; end if;

  perform 1 from public.ovr_relationship_state
  where organization_id=v_actor_org and ovr_report_id=p_ovr_report_id
  for share;
  if not found then raise exception using errcode='P0001', message='OVR_V11_RELATIONSHIP_STATE_REQUIRED'; end if;

  perform 1 from public.ovr_reviewer_assignments a
  where a.organization_id=v_actor_org and a.ovr_report_id=p_ovr_report_id
    and a.review_cycle_id=v_cycle.id and a.stage_instance_id=p_stage_instance_id
  order by a.id for update;
  select * into v_stage from public.ovr_stage_instances
  where id=p_stage_instance_id and organization_id=v_actor_org
    and ovr_report_id=p_ovr_report_id and review_cycle_id=v_cycle.id
  for update;
  if not found then raise exception using errcode='P0001', message='OVR_V11_STAGE_NOT_FOUND'; end if;

  v_digest := ovr_v11_private.semantic_digest(jsonb_build_object(
    'operation','perform_governance_closure','organization_id',v_actor_org,
    'ovr_report_id',p_ovr_report_id,'review_cycle_id',v_cycle.id,
    'stage_instance_id',p_stage_instance_id,'actor_id',p_actor_id,
    'final_verdict_id',p_final_verdict_id
  ));
  v_replay := ovr_v11_private.replay_response(
    v_actor_org,p_idempotency_key,'perform_governance_closure',p_actor_id,
    p_ovr_report_id,v_digest
  );
  if v_replay is not null then return v_replay; end if;

  select * into v_post_review from public.ovr_post_closure_reviews
  where organization_id=v_actor_org and ovr_report_id=p_ovr_report_id
    and review_cycle_id=v_cycle.id and status='under_review';

  perform ovr_v11_private.assert_not_conflicted(
    v_actor_org,p_ovr_report_id,p_actor_id,'governance_closure'
  );
  if v_cycle.status <> 'active' or v_stage.stage_type <> 'governance_closure'
    or v_stage.lifecycle_status <> 'assigned'
  then raise exception using errcode='P0001', message='OVR_V11_ACTIVE_CLOSURE_STAGE_REQUIRED'; end if;
  if v_post_review.id is null and v_ovr.status::text <> 'quality_final_review' then
    raise exception using errcode='P0001', message='OVR_V11_FINAL_REVIEW_LIFECYCLE_REQUIRED';
  end if;
  if v_post_review.id is not null and v_ovr.status::text <> 'closed' then
    raise exception using errcode='P0001', message='OVR_V11_POST_CLOSURE_OVR_MUST_REMAIN_CLOSED';
  end if;

  v_assignment := ovr_v11_private.assert_assigned_action_actor(
    v_actor_org,p_ovr_report_id,v_cycle.id,p_stage_instance_id,p_actor_id,'governance_closure'
  );

  v_verdict := ovr_v11_private.current_verdict(v_actor_org,p_ovr_report_id);
  if v_verdict.id is distinct from p_final_verdict_id
    or v_verdict.review_cycle_id is distinct from v_cycle.id
  then
    raise exception using errcode='P0001', message='OVR_V11_FINAL_VERDICT_REQUIRED';
  end if;

  v_evidence := ovr_v11_private.evidence_gate_snapshot(v_actor_org,p_ovr_report_id);
  if not coalesce((v_evidence->>'satisfied')::boolean,false) then
    raise exception using errcode='P0001', message='OVR_V11_EVIDENCE_GATE_NOT_SATISFIED';
  end if;
  v_separation := ovr_v11_private.separation_policy_snapshot(
    v_actor_org,p_ovr_report_id,v_verdict.issued_by,p_actor_id,
    v_verdict.effective_severity
  );

  v_response := jsonb_build_object(
    'status','closed','governance_closure_id',v_closure_id,
    'final_verdict_id',v_verdict.id,'ovr_report_id',p_ovr_report_id,
    'review_cycle_id',v_cycle.id,'closed_at',v_closed_at,
    'post_closure_cycle',v_post_review.id is not null
  );
  insert into public.ovr_governance_closures(
    id,organization_id,ovr_report_id,review_cycle_id,stage_instance_id,
    closer_assignment_id,final_verdict_id,closed_by,closed_at,
    separation_policy_applied,evidence_gate_snapshot,idempotency_key,
    semantic_request_digest,immutable_response
  ) values (
    v_closure_id,v_actor_org,p_ovr_report_id,v_cycle.id,p_stage_instance_id,
    v_assignment.id,v_verdict.id,p_actor_id,v_closed_at,v_separation,v_evidence,
    p_idempotency_key,v_digest,v_response
  );

  update public.ovr_reviewer_assignments
  set status='completed',ended_at=v_closed_at,termination_reason='governance_closed',
      updated_at=v_closed_at
  where id=v_assignment.id;
  update public.ovr_stage_instances
  set lifecycle_status='completed',completed_at=v_closed_at,routing_block_reason=null
  where id=v_stage.id;
  update public.ovr_review_cycles
  set status='completed',closed_at=v_closed_at,closed_by=p_actor_id
  where id=v_cycle.id;

  if v_post_review.id is null then
    update public.ovr_reports
    set status='closed',
        final_verdict=v_verdict.verdict,
        final_quality_classification=v_verdict.verdict,
        final_verdict_at=v_verdict.issued_at,
        final_severity_level=v_verdict.effective_severity,
        corrective_action_required=v_verdict.corrective_action_required,
        quality_closed_by=v_verdict.issued_by,
        quality_closed_at=v_verdict.issued_at,
        closed_by=p_actor_id,
        closed_at=v_closed_at,
        updated_by=p_actor_id,
        updated_at=v_closed_at
    where id=p_ovr_report_id;
  else
    update public.ovr_post_closure_reviews
    set status='completed',completed_at=v_closed_at,
        resulting_verdict_id=v_verdict.id
    where id=v_post_review.id;
  end if;

  insert into public.ovr_workflow_events_v11(
    organization_id,ovr_report_id,review_cycle_id,stage_instance_id,actor_id,
    event_type,final_verdict_id,governance_closure_id,
    post_closure_review_id,idempotency_key,idempotency_operation,
    semantic_request_digest,immutable_response,event_payload
  ) values (
    v_actor_org,p_ovr_report_id,v_cycle.id,p_stage_instance_id,p_actor_id,
    case when v_post_review.id is null then 'governance_closed' else 'superseding_decision_closed' end,
    v_verdict.id,v_closure_id,v_post_review.id,p_idempotency_key,
    'perform_governance_closure',v_digest,v_response,
    jsonb_build_object('separation_policy',v_separation,'evidence_gate',v_evidence)
  );
  return v_response;
end;
$$;

-- Reporter acknowledgment is a distinct append-only action; it never closes.
create or replace function public.ovr_v11_reporter_acknowledge(
  p_actor_id uuid,
  p_ovr_report_id uuid,
  p_governance_closure_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, extensions, pg_temp
as $$
declare
  v_actor_org uuid;
  v_replay_org uuid;
  v_ovr public.ovr_reports%rowtype;
  v_closure public.ovr_governance_closures%rowtype;
  v_digest text;
  v_replay jsonb;
  v_response_id uuid := gen_random_uuid();
  v_responded_at timestamptz := statement_timestamp();
  v_response jsonb;
begin
  perform ovr_v11_private.assert_service_caller();
  perform ovr_v11_private.validate_idempotency_key(p_idempotency_key);
  select organization_id into v_replay_org
  from public.ovr_reports
  where id = p_ovr_report_id;
  if v_replay_org is not null then
    v_digest := ovr_v11_private.semantic_digest(jsonb_build_object(
      'operation','reporter_acknowledge','organization_id',v_replay_org,
      'ovr_report_id',p_ovr_report_id,
      'governance_closure_id',p_governance_closure_id,
      'actor_id',p_actor_id
    ));
    v_replay := ovr_v11_private.replay_response(
      v_replay_org,p_idempotency_key,'reporter_acknowledge',p_actor_id,
      p_ovr_report_id,v_digest
    );
    if v_replay is not null then return v_replay; end if;
  end if;
  v_actor_org := ovr_v11_private.active_actor_organization(p_actor_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'ovr-v11-route:' || v_actor_org::text || ':' || p_ovr_report_id::text,0
  ));
  select * into v_ovr from public.ovr_reports where id=p_ovr_report_id for update;
  if not found then raise exception using errcode='P0001', message='OVR_V11_OVR_NOT_FOUND'; end if;
  if v_ovr.organization_id is distinct from v_actor_org then
    raise exception using errcode='P0001', message='OVR_V11_CROSS_ORGANIZATION_DENIED';
  end if;
  if v_ovr.reported_by is distinct from p_actor_id then
    raise exception using errcode='P0001', message='OVR_V11_REPORTER_ONLY';
  end if;
  select * into v_closure from public.ovr_governance_closures
  where id=p_governance_closure_id and organization_id=v_actor_org
    and ovr_report_id=p_ovr_report_id for share;
  if not found or v_ovr.status::text <> 'closed' then
    raise exception using errcode='P0001', message='OVR_V11_GOVERNANCE_CLOSURE_REQUIRED';
  end if;
  v_digest := ovr_v11_private.semantic_digest(jsonb_build_object(
    'operation','reporter_acknowledge','organization_id',v_actor_org,
    'ovr_report_id',p_ovr_report_id,'governance_closure_id',v_closure.id,
    'actor_id',p_actor_id
  ));
  v_replay := ovr_v11_private.replay_response(
    v_actor_org,p_idempotency_key,'reporter_acknowledge',p_actor_id,
    p_ovr_report_id,v_digest
  );
  if v_replay is not null then return v_replay; end if;
  if exists(
    select 1 from public.ovr_reporter_responses
    where organization_id = v_actor_org
      and ovr_report_id = p_ovr_report_id
      and governance_closure_id = v_closure.id
  ) then
    raise exception using errcode='P0001', message='OVR_V11_REPORTER_RESPONSE_ALREADY_EXISTS';
  end if;
  v_response := jsonb_build_object(
    'status','recorded','response_type','acknowledged',
    'reporter_response_id',v_response_id,
    'governance_closure_id',v_closure.id,'responded_at',v_responded_at
  );
  insert into public.ovr_reporter_responses(
    id,organization_id,ovr_report_id,governance_closure_id,
    reporter_profile_id,response_type,response_reason,responded_at,
    idempotency_key,semantic_request_digest,immutable_response
  ) values (
    v_response_id,v_actor_org,p_ovr_report_id,v_closure.id,p_actor_id,
    'acknowledged',null,v_responded_at,p_idempotency_key,v_digest,v_response
  );
  insert into public.ovr_workflow_events_v11(
    organization_id,ovr_report_id,review_cycle_id,actor_id,event_type,
    final_verdict_id,governance_closure_id,reporter_response_id,
    idempotency_key,idempotency_operation,semantic_request_digest,
    immutable_response,event_payload
  ) values (
    v_actor_org,p_ovr_report_id,v_closure.review_cycle_id,p_actor_id,
    'reporter_acknowledged',v_closure.final_verdict_id,v_closure.id,
    v_response_id,p_idempotency_key,'reporter_acknowledge',v_digest,
    v_response,'{}'::jsonb
  );
  return v_response;
end;
$$;

-- Reporter dispute preserves the closed OVR and opens one separate P1 cycle.
create or replace function public.ovr_v11_reporter_dispute(
  p_actor_id uuid,
  p_ovr_report_id uuid,
  p_governance_closure_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, extensions, pg_temp
as $$
declare
  v_actor_org uuid;
  v_replay_org uuid;
  v_ovr public.ovr_reports%rowtype;
  v_closure public.ovr_governance_closures%rowtype;
  v_reason text := nullif(btrim(p_reason),'');
  v_digest text;
  v_replay jsonb;
  v_response_id uuid := gen_random_uuid();
  v_review_id uuid := gen_random_uuid();
  v_cycle_id uuid := gen_random_uuid();
  v_cycle_number integer;
  v_responded_at timestamptz := statement_timestamp();
  v_response jsonb;
begin
  perform ovr_v11_private.assert_service_caller();
  perform ovr_v11_private.validate_idempotency_key(p_idempotency_key);
  if v_reason is null or length(v_reason) > 2000 then
    raise exception using errcode='P0001', message='OVR_V11_DISPUTE_REASON_REQUIRED';
  end if;
  select organization_id into v_replay_org
  from public.ovr_reports
  where id = p_ovr_report_id;
  if v_replay_org is not null then
    v_digest := ovr_v11_private.semantic_digest(jsonb_build_object(
      'operation','reporter_dispute','organization_id',v_replay_org,
      'ovr_report_id',p_ovr_report_id,
      'governance_closure_id',p_governance_closure_id,
      'actor_id',p_actor_id,'reason',v_reason
    ));
    v_replay := ovr_v11_private.replay_response(
      v_replay_org,p_idempotency_key,'reporter_dispute',p_actor_id,
      p_ovr_report_id,v_digest
    );
    if v_replay is not null then return v_replay; end if;
  end if;
  v_actor_org := ovr_v11_private.active_actor_organization(p_actor_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'ovr-v11-route:' || v_actor_org::text || ':' || p_ovr_report_id::text,0
  ));
  select * into v_ovr from public.ovr_reports where id=p_ovr_report_id for update;
  if not found then raise exception using errcode='P0001', message='OVR_V11_OVR_NOT_FOUND'; end if;
  if v_ovr.organization_id is distinct from v_actor_org then
    raise exception using errcode='P0001', message='OVR_V11_CROSS_ORGANIZATION_DENIED';
  end if;
  if v_ovr.reported_by is distinct from p_actor_id then
    raise exception using errcode='P0001', message='OVR_V11_REPORTER_ONLY';
  end if;
  select * into v_closure from public.ovr_governance_closures
  where id=p_governance_closure_id and organization_id=v_actor_org
    and ovr_report_id=p_ovr_report_id for share;
  if not found or v_ovr.status::text <> 'closed' then
    raise exception using errcode='P0001', message='OVR_V11_GOVERNANCE_CLOSURE_REQUIRED';
  end if;
  v_digest := ovr_v11_private.semantic_digest(jsonb_build_object(
    'operation','reporter_dispute','organization_id',v_actor_org,
    'ovr_report_id',p_ovr_report_id,'governance_closure_id',v_closure.id,
    'actor_id',p_actor_id,'reason',v_reason
  ));
  v_replay := ovr_v11_private.replay_response(
    v_actor_org,p_idempotency_key,'reporter_dispute',p_actor_id,
    p_ovr_report_id,v_digest
  );
  if v_replay is not null then return v_replay; end if;
  if exists(
    select 1 from public.ovr_reporter_responses
    where organization_id = v_actor_org
      and ovr_report_id = p_ovr_report_id
      and governance_closure_id = v_closure.id
  ) then
    raise exception using errcode='P0001', message='OVR_V11_REPORTER_RESPONSE_ALREADY_EXISTS';
  end if;

  select coalesce(max(cycle_number),0)+1 into v_cycle_number
  from public.ovr_review_cycles
  where organization_id=v_actor_org and ovr_report_id=p_ovr_report_id;
  v_response := jsonb_build_object(
    'status','review_opened','response_type','disputed',
    'reporter_response_id',v_response_id,'post_closure_review_id',v_review_id,
    'review_cycle_id',v_cycle_id,'governance_closure_id',v_closure.id,
    'responded_at',v_responded_at
  );
  insert into public.ovr_reporter_responses(
    id,organization_id,ovr_report_id,governance_closure_id,
    reporter_profile_id,response_type,response_reason,responded_at,
    idempotency_key,semantic_request_digest,immutable_response
  ) values (
    v_response_id,v_actor_org,p_ovr_report_id,v_closure.id,p_actor_id,
    'disputed',v_reason,v_responded_at,p_idempotency_key,v_digest,v_response
  );
  insert into public.ovr_review_cycles(
    id,organization_id,ovr_report_id,cycle_number,status,cycle_reason,
    opened_at,opened_by
  ) values (
    v_cycle_id,v_actor_org,p_ovr_report_id,v_cycle_number,'active',
    'reporter_dispute_post_closure_review',v_responded_at,p_actor_id
  );
  insert into public.ovr_post_closure_reviews(
    id,organization_id,ovr_report_id,originating_closure_id,
    originating_verdict_id,opened_from_reporter_response_id,review_cycle_id,
    status,opened_by,opened_at
  ) values (
    v_review_id,v_actor_org,p_ovr_report_id,v_closure.id,
    v_closure.final_verdict_id,v_response_id,v_cycle_id,'open',p_actor_id,
    v_responded_at
  );
  insert into public.ovr_workflow_events_v11(
    organization_id,ovr_report_id,review_cycle_id,actor_id,event_type,
    final_verdict_id,governance_closure_id,reporter_response_id,
    post_closure_review_id,idempotency_key,idempotency_operation,
    semantic_request_digest,immutable_response,event_payload
  ) values (
    v_actor_org,p_ovr_report_id,v_cycle_id,p_actor_id,'reporter_disputed',
    v_closure.final_verdict_id,v_closure.id,v_response_id,v_review_id,
    p_idempotency_key,'reporter_dispute',v_digest,v_response,
    jsonb_build_object('reason_length',length(v_reason))
  );
  insert into public.ovr_workflow_events_v11(
    organization_id,ovr_report_id,review_cycle_id,actor_id,event_type,
    final_verdict_id,governance_closure_id,reporter_response_id,
    post_closure_review_id,event_payload
  ) values (
    v_actor_org,p_ovr_report_id,v_cycle_id,p_actor_id,
    'post_closure_cycle_opened',v_closure.final_verdict_id,v_closure.id,
    v_response_id,v_review_id,jsonb_build_object('cycle_number',v_cycle_number)
  );
  return v_response;
end;
$$;

-- Fail-closed data surfaces. The service functions execute as the expected
-- postgres owner; service_role receives only the table privileges needed for
-- controlled inspection, never runtime policy configuration or browser access.
alter table public.ovr_separation_policies enable row level security;
alter table public.ovr_separation_policies force row level security;
alter table public.ovr_final_verdicts enable row level security;
alter table public.ovr_final_verdicts force row level security;
alter table public.ovr_governance_closures enable row level security;
alter table public.ovr_governance_closures force row level security;
alter table public.ovr_reporter_responses enable row level security;
alter table public.ovr_reporter_responses force row level security;
alter table public.ovr_post_closure_reviews enable row level security;
alter table public.ovr_post_closure_reviews force row level security;
alter table public.ovr_workflow_events_v11 enable row level security;
alter table public.ovr_workflow_events_v11 force row level security;

revoke all on table public.ovr_separation_policies from public,anon,authenticated,service_role;
revoke all on table public.ovr_final_verdicts from public,anon,authenticated,service_role;
revoke all on table public.ovr_governance_closures from public,anon,authenticated,service_role;
revoke all on table public.ovr_reporter_responses from public,anon,authenticated,service_role;
revoke all on table public.ovr_post_closure_reviews from public,anon,authenticated,service_role;
revoke all on table public.ovr_workflow_events_v11 from public,anon,authenticated,service_role;

grant select on table public.ovr_separation_policies to service_role;
grant select on table public.ovr_final_verdicts to service_role;
grant select on table public.ovr_governance_closures to service_role;
grant select on table public.ovr_reporter_responses to service_role;
grant select on table public.ovr_post_closure_reviews to service_role;
grant select on table public.ovr_workflow_events_v11 to service_role;

revoke all on function public.ovr_v11_issue_final_verdict(uuid,uuid,uuid,text,public.ovr_severity_level,boolean,text,uuid)
from public,anon,authenticated,service_role;
revoke all on function public.ovr_v11_perform_governance_closure(uuid,uuid,uuid,uuid,text)
from public,anon,authenticated,service_role;
revoke all on function public.ovr_v11_reporter_acknowledge(uuid,uuid,uuid,text)
from public,anon,authenticated,service_role;
revoke all on function public.ovr_v11_reporter_dispute(uuid,uuid,uuid,text,text)
from public,anon,authenticated,service_role;

grant execute on function public.ovr_v11_issue_final_verdict(uuid,uuid,uuid,text,public.ovr_severity_level,boolean,text,uuid)
to service_role;
grant execute on function public.ovr_v11_perform_governance_closure(uuid,uuid,uuid,uuid,text)
to service_role;
grant execute on function public.ovr_v11_reporter_acknowledge(uuid,uuid,uuid,text)
to service_role;
grant execute on function public.ovr_v11_reporter_dispute(uuid,uuid,uuid,text,text)
to service_role;

alter function ovr_v11_private.guard_immutable_history() owner to postgres;
alter function ovr_v11_private.guard_separation_policy() owner to postgres;
alter function ovr_v11_private.guard_post_closure_review() owner to postgres;
alter function ovr_v11_private.validate_idempotency_key(text) owner to postgres;
alter function ovr_v11_private.semantic_digest(jsonb) owner to postgres;
alter function ovr_v11_private.active_actor_organization(uuid) owner to postgres;
alter function ovr_v11_private.assert_assigned_action_actor(uuid,uuid,uuid,uuid,uuid,text) owner to postgres;
alter function ovr_v11_private.assert_not_conflicted(uuid,uuid,uuid,text) owner to postgres;
alter function ovr_v11_private.evidence_gate_snapshot(uuid,uuid) owner to postgres;
alter function ovr_v11_private.separation_policy_snapshot(uuid,uuid,uuid,uuid,public.ovr_severity_level) owner to postgres;
alter function ovr_v11_private.replay_response(uuid,text,text,uuid,uuid,text) owner to postgres;
alter function ovr_v11_private.current_verdict(uuid,uuid) owner to postgres;
alter function public.ovr_v11_issue_final_verdict(uuid,uuid,uuid,text,public.ovr_severity_level,boolean,text,uuid) owner to postgres;
alter function public.ovr_v11_perform_governance_closure(uuid,uuid,uuid,uuid,text) owner to postgres;
alter function public.ovr_v11_reporter_acknowledge(uuid,uuid,uuid,text) owner to postgres;
alter function public.ovr_v11_reporter_dispute(uuid,uuid,uuid,text,text) owner to postgres;

comment on table public.ovr_final_verdicts is
  'GRC v1.1 immutable final verdict lineage. One authoritative verdict per review cycle; later outcomes supersede by reference only.';
comment on table public.ovr_governance_closures is
  'GRC v1.1 immutable governance closure with exact P1 assignment, risk separation, and versioned evidence-gate snapshot.';
comment on table public.ovr_reporter_responses is
  'GRC v1.1 reporter acknowledgment/dispute responses; responses never perform or rewrite governance closure.';
comment on table public.ovr_post_closure_reviews is
  'GRC v1.1 separate post-closure review cycle opened by an immutable reporter dispute while the original OVR remains closed.';
comment on table public.ovr_workflow_events_v11 is
  'GRC v1.1 append-only verdict, governance closure, reporter-response, and supersession events; released v98 history is untouched.';
comment on table public.ovr_separation_policies is
  'GRC v1.1 migration-controlled organization separation policy. Runtime service and browser roles are read-only or denied; future administration requires a separately reviewed audited control path.';

commit;
