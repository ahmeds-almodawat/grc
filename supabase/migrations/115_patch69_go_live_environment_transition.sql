-- Patch 69: Go-Live Environment Transition
-- This migration permanently locks staging and proof tables to prevent further modifications.

create or replace function public.trg_enforce_live_environment_lock()
returns trigger as $$
begin
  raise exception 'This staging/proof table is locked in the live production environment.';
end;
$$ language plpgsql;

do $$
declare
  t text;
  tables text[] := array[
    'employee_import_staging',
    'staging_validation_cycles',
    'staging_validation_check_results',
    'patch13_sql_proof_runs',
    'patch14_staging_persona_sql_runs',
    'patch14_backup_restore_proof_runs',
    'production_go_no_go_staging_persona_runs',
    'staging_migration_evidence_runs',
    'staging_migration_evidence_events'
  ];
begin
  foreach t in array tables loop
    execute format('
      drop trigger if exists trg_lock_%1$s on public.%1$s;
      create trigger trg_lock_%1$s
      before insert or update or delete on public.%1$s
      for each row execute function public.trg_enforce_live_environment_lock();
    ', t);
  end loop;
end
$$;
