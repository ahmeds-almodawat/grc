-- Patch 83Q: close verified unsafe browser-role execution grants only.
-- This migration changes function EXECUTE ACLs only. Exact signatures are
-- intentional: PostgreSQL must fail if a reviewed overload is absent.

begin;

-- Pilot go/no-go writes are intended for the authenticated Edge bridge and
-- service-role dispatcher. Live catalog evidence showed explicit anon grants.
revoke all on function public.create_pilot_go_no_go_review(text, uuid) from public;
revoke execute on function public.create_pilot_go_no_go_review(text, uuid) from anon;
revoke execute on function public.create_pilot_go_no_go_review(text, uuid) from authenticated;
grant execute on function public.create_pilot_go_no_go_review(text, uuid) to service_role;

revoke all on function public.record_pilot_go_no_go_event(uuid, text, text, uuid) from public;
revoke execute on function public.record_pilot_go_no_go_event(uuid, text, text, uuid) from anon;
revoke execute on function public.record_pilot_go_no_go_event(uuid, text, text, uuid) from authenticated;
grant execute on function public.record_pilot_go_no_go_event(uuid, text, text, uuid) to service_role;

revoke all on function public.update_pilot_go_no_go_review_status(uuid, text, text, uuid) from public;
revoke execute on function public.update_pilot_go_no_go_review_status(uuid, text, text, uuid) from anon;
revoke execute on function public.update_pilot_go_no_go_review_status(uuid, text, text, uuid) from authenticated;
grant execute on function public.update_pilot_go_no_go_review_status(uuid, text, text, uuid) to service_role;

-- Executive production signoff is a privileged governance write. Live catalog
-- evidence showed explicit anon and authenticated grants.
revoke all on function public.record_executive_production_signoff(uuid, text, text, text) from public;
revoke execute on function public.record_executive_production_signoff(uuid, text, text, text) from anon;
revoke execute on function public.record_executive_production_signoff(uuid, text, text, text) from authenticated;
grant execute on function public.record_executive_production_signoff(uuid, text, text, text) to service_role;

commit;
