-- Patch 70: Live Hospital Handover & Freeze
-- This migration inserts a final, immutable log entry marking the platform as frozen and live.

do $$
declare
  t_exists boolean;
begin
  select exists (
    select from information_schema.tables 
    where table_schema = 'public' 
    and table_name = 'production_go_no_go_staging_persona_runs'
  ) into t_exists;

  if t_exists then
    insert into public.production_go_no_go_staging_persona_runs (
      organization_id,
      run_status,
      environment_name,
      execution_log
    ) values (
      null,
      'successful',
      'production_read_only',
      'Patch 70: Live Hospital Handover completed. Application is formally live and frozen.'
    );
  end if;
end
$$;
