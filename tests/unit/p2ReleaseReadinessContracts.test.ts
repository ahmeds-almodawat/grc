import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  'supabase/migrations/220_p2_release_readiness_contracts.sql',
  'utf8',
)
const proof = readFileSync(
  'tests/sql/p2_migration220_release_readiness_contracts_proof.sql',
  'utf8',
)

describe('P2 release-readiness contracts', () => {
  it('restores narrow authenticated reads behind existing RLS policies', () => {
    expect(migration).toContain('public.production_readiness_signoffs')
    expect(migration).toContain('public.release_candidate_gates')
    expect(migration).toContain('public.production_go_no_go_cycles')
    expect(migration).toMatch(/grant select on table[\s\S]+to authenticated;/i)
    expect(migration).not.toMatch(/grant\s+.+\s+to\s+(public|anon)/i)
  })

  it('makes every accepted readiness view security-invoker and authenticated-only', () => {
    expect(migration.match(/alter view public\./g)).toHaveLength(24)
    expect(migration).toContain(
      'alter view public.v_patch40_controlled_pilot_readiness_summary set (security_invoker = true);',
    )
    expect(migration).toContain('from public, anon;')
    expect(proof).toContain('P2_MIGRATION_220_ANON_VIEW_READ_EXPOSED')
  })

  it('does not create scores, approvals, or readiness rows', () => {
    expect(migration).not.toMatch(/\b(insert|update|delete)\b/i)
    expect(migration).not.toMatch(/create\s+(table|view|function)/i)
    expect(migration).toContain('no readiness value is fabricated')
  })
})
