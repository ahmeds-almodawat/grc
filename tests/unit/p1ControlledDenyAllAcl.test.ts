import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  'supabase/migrations/219_p1_controlled_deny_all_acl_reassertion.sql',
  'utf8',
)

describe('P1 migration 219 controlled deny-all ACL', () => {
  it('reasserts forced RLS and revokes every tracked role before minimal service grants', () => {
    expect(migration.match(/force row level security/gi)).toHaveLength(6)
    expect(migration).toMatch(
      /revoke all privileges on table[\s\S]*from public, anon, authenticated, service_role;/i,
    )
    expect(migration).toMatch(
      /grant select on table[\s\S]*patch83b_release_migration_events[\s\S]*patch83u_runtime_control[\s\S]*user_credential_states[\s\S]*to service_role;/i,
    )
    expect(migration).toContain(
      'grant select, insert, update on table public.user_account_provisioning to service_role;',
    )
    expect(migration).not.toMatch(/grant\s+.+\s+to\s+(public|anon|authenticated)/i)
  })
})
