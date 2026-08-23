import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  'supabase/migrations/222_p2_audit_criteria_read_contract.sql',
  'utf8',
)
const proof = readFileSync(
  'tests/sql/p2_migration222_audit_criteria_read_contract_proof.sql',
  'utf8',
)

describe('P2 Audit criteria read contract', () => {
  it('keeps the Audit contract RLS-scoped and derives its boolean inline', () => {
    expect(migration).toContain(
      'create or replace view public.v_ui4_audit_criteria_contract',
    )
    expect(migration).toContain('with (security_invoker = true)')
    expect(migration).toContain("f.finding_classification = 'advisory_observation'")
    expect(migration).toContain("l.target_criterion_type in (")
  })

  it('does not expose the owner-level helper to browser roles', () => {
    expect(migration).toMatch(
      /revoke all on function[\s\S]+from public, anon, authenticated;/i,
    )
    expect(migration).toMatch(
      /grant execute on function[\s\S]+to service_role;/i,
    )
    expect(proof).toContain('P2_MIGRATION_222_OWNER_HELPER_EXPOSED')
    expect(proof).toContain('P2_MIGRATION_222_VIEW_STILL_CALLS_OWNER_HELPER')
  })

  it('grants read-only view access without anonymous or mutation grants', () => {
    expect(migration).toMatch(
      /grant select on table public\.v_ui4_audit_criteria_contract[\s\S]+to authenticated, service_role;/i,
    )
    expect(migration).not.toMatch(/grant\s+(insert|update|delete|all)/i)
    expect(proof).toContain('P2_MIGRATION_222_ANON_VIEW_READ_EXPOSED')
  })
})
