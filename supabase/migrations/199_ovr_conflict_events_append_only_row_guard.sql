-- Migration 199: Refine ovr_conflict_events append-only trigger from statement-level to row-level guard.
-- Preserves strict append-only semantics (blocking UPDATE and DELETE on actual rows with OVR_V11_CONFLICT_EVENTS_APPEND_ONLY)
-- while allowing zero-row foreign key cascade deletes from parent ovr_reports to proceed safely without false-positive trigger execution.

drop trigger if exists trg_ovr_conflict_events_append_only on public.ovr_conflict_events;

create trigger trg_ovr_conflict_events_append_only
before update or delete on public.ovr_conflict_events
for each row execute function ovr_v11_private.guard_append_only();
