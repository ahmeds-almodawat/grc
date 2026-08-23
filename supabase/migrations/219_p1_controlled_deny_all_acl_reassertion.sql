begin;

-- Reassert the final ACL state after RLS so the service-managed Patch83 tables
-- have an ordered, auditable deny-all contract for every browser role.
alter table public.patch83b_release_migration_events enable row level security;
alter table public.patch83b_release_migration_events force row level security;
alter table public.patch83u_runtime_control enable row level security;
alter table public.patch83u_runtime_control force row level security;
alter table public.user_account_provisioning enable row level security;
alter table public.user_account_provisioning force row level security;
alter table public.user_credential_events enable row level security;
alter table public.user_credential_events force row level security;
alter table public.user_credential_states enable row level security;
alter table public.user_credential_states force row level security;
alter table public.user_credential_suspended_roles enable row level security;
alter table public.user_credential_suspended_roles force row level security;

revoke all privileges on table
  public.patch83b_release_migration_events,
  public.patch83u_runtime_control,
  public.user_account_provisioning,
  public.user_credential_events,
  public.user_credential_states,
  public.user_credential_suspended_roles
from public, anon, authenticated, service_role;

-- Restore only the trusted service-role privileges already established by the
-- canonical migrations. No browser role receives table access.
grant select on table
  public.patch83b_release_migration_events,
  public.patch83u_runtime_control,
  public.user_credential_states
to service_role;

grant select, insert, update on table public.user_account_provisioning to service_role;

commit;
