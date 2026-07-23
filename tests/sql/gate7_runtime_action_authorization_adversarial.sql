-- Run only in a disposable post-182 validation database.
-- Synthetic rows are rolled back; no hosted environment is permitted.
begin;

select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.runtime_action_reviews (
  action_name, action_transport, module_name, risk_level, classification, review_status
) values
  ('gate7-approved-without-signoff', 'authenticated_edge_bridge', 'Gate 7', 'high', 'privileged_admin', 'approved'),
  ('gate7-approved-with-signoff', 'authenticated_edge_bridge', 'Gate 7', 'high', 'privileged_admin', 'approved'),
  ('gate7-pending-review', 'authenticated_edge_bridge', 'Gate 7', 'high', 'privileged_admin', 'pending_review');

insert into public.runtime_action_review_signoffs (
  action_name, reviewer_role, signoff_status, evidence_reference
) values
  ('gate7-approved-with-signoff', 'governance_admin', 'approved', 'synthetic-gate7-evidence'),
  ('gate7-pending-review', 'governance_admin', 'approved', 'synthetic-gate7-evidence');

do $test$
begin
  if public.patch83v_runtime_action_authorized('gate7-unknown', 'authenticated_edge_bridge') then
    raise exception 'GATE7_UNKNOWN_ACTION_WAS_AUTHORIZED';
  end if;
  if public.patch83v_runtime_action_authorized('gate7-approved-without-signoff', 'authenticated_edge_bridge') then
    raise exception 'GATE7_UNSIGNED_ACTION_WAS_AUTHORIZED';
  end if;
  if public.patch83v_runtime_action_authorized('gate7-pending-review', 'authenticated_edge_bridge') then
    raise exception 'GATE7_PENDING_ACTION_WAS_AUTHORIZED';
  end if;
  if not public.patch83v_runtime_action_authorized('gate7-approved-with-signoff', 'authenticated_edge_bridge') then
    raise exception 'GATE7_CLOSED_ACTION_WAS_NOT_AUTHORIZED';
  end if;
end;
$test$;

rollback;
