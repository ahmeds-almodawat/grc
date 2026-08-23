import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  'supabase/migrations/221_p2_my_work_read_contract.sql',
  'utf8',
)
const proof = readFileSync(
  'tests/sql/p2_migration221_my_work_read_contract_proof.sql',
  'utf8',
)

describe('P2 My Work read contract', () => {
  it('restores authenticated reads for every missing RLS source', () => {
    const sources = [
      'accreditation_clauses',
      'accreditation_review_cycles',
      'audit_execution_engagements',
      'audit_execution_findings',
      'audit_execution_programs',
      'audit_execution_signoffs',
      'audit_execution_test_steps',
      'capa_action_items',
      'clinical_governance_escalations',
      'evidence_bridge_links',
      'evidence_collection_requests',
      'ovr_rca_cases',
    ]

    sources.forEach((source) => {
      expect(migration).toContain(`public.${source}`)
      expect(proof).toContain(`'${source}'`)
    })
    expect(migration).toMatch(/grant select on table[\s\S]+to authenticated;/i)
  })

  it('does not weaken policies or grant anonymous or browser DML access', () => {
    expect(migration).not.toMatch(/\b(insert|update|delete|truncate)\b/i)
    expect(migration).not.toMatch(/create\s+policy|alter\s+policy|disable\s+row\s+level/i)
    expect(migration).not.toMatch(/grant\s+.+\s+to\s+(public|anon)/i)
    expect(proof).toContain('P2_MIGRATION_221_ANON_READ_EXPOSED')
  })

  it('proves the security-invoker queue compiles for an authenticated actor', () => {
    expect(proof).toContain("'v_patch38_unified_work_queue', 'v_patch38_my_work_queue'")
    expect(proof).toContain("@> array['security_invoker=true']")
    expect(proof).toContain('from public.v_patch38_my_work_queue')
  })
})
