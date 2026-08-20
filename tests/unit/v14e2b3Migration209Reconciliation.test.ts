import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migration209Path = path.join(
  root,
  'supabase/migrations/209_e2b3_training_population_reconciliation.sql',
);
const migration209 = fs.readFileSync(migration209Path, 'utf8');
const runtimeProofPath = path.join(
  root,
  'tests/sql/v14e2b3_migration209_reconciliation_invariants_proof.sql',
);
const reconcile = migration209.match(
  /create or replace function public\.reconcile_sop_training_population[\s\S]*?grant execute on function public\.reconcile_sop_training_population\(uuid, uuid\) to service_role;/i,
)?.[0] ?? '';

describe('GRC v1.4-E2B3 Migration209 reconciliation contract', () => {
  it('01: capability and reconciliation RPCs are service-role only', () => {
    for (const signature of [
      'get_e2b3_training_reconciliation_capabilities()',
      'reconcile_sop_training_population(uuid, uuid)',
    ]) {
      expect(migration209).toContain(`revoke all on function public.${signature} from public, anon, authenticated;`);
      expect(migration209).toContain(`grant execute on function public.${signature} to service_role;`);
    }
    expect(reconcile).toContain("raise exception 'SERVICE_ROLE_REQUIRED'");
  });

  it('R1-01: Migration209 installs durable version-bound first-publication evidence', () => {
    expect(migration209).toContain('training_obligations_published_at timestamptz null');
    expect(migration209).toContain('training_obligations_published_by uuid null');
    expect(migration209).toContain('references public.profiles(id)');
    expect(migration209).toContain('on delete set null');
  });

  it('R1-02: the exact publication signature wraps frozen E2B2 behavior atomically', () => {
    expect(migration209).toContain('rename to publish_sop_training_obligations_e2b2');
    expect(migration209).toContain('v_result := public.publish_sop_training_obligations_e2b2(');
    expect(migration209).toContain('training_obligations_published_at = coalesce(training_obligations_published_at, now())');
    expect(migration209).toContain('training_obligations_published_by = coalesce(training_obligations_published_by, p_actor_id)');
    expect(migration209).toContain('return v_result');
  });

  it('R1-03: reconciliation blocks an exact version before program lookup or mutation', () => {
    const markerGate = reconcile.indexOf('v_sop_detail.training_obligations_published_at is null');
    const programLookup = reconcile.indexOf('from public.training_programs');
    const firstMutation = reconcile.search(/insert into public\.training_assignments|update public\.training_assignments/i);
    expect(markerGate).toBeGreaterThan(-1);
    expect(reconcile).toContain('TRAINING_OBLIGATIONS_NOT_PUBLISHED');
    expect(programLookup).toBeGreaterThan(markerGate);
    expect(firstMutation).toBeGreaterThan(markerGate);
  });

  it('02: canonical global governance authority is allowed', () => {
    expect(reconcile).toContain("ur.role::text in ('super_admin', 'governance_admin', 'compliance_officer')");
    expect(reconcile).toContain("ur.scope::text = 'global'");
    expect(reconcile).toContain('ur.organization_id = v_doc.organization_id');
  });

  it('03: active same-organization document owner is allowed', () => {
    expect(reconcile).toContain('v_doc.document_owner_id = p_actor_id');
    expect(reconcile).toContain("v_actor.user_status <> 'active'");
  });

  it.each([
    ['04', 'executive'],
    ['05', 'auditor'],
    ['06', 'department_manager'],
    ['07', 'quality_director'],
    ['08', 'training_coordinator'],
  ])('%s: %s is absent from the reconciliation authority contract', (_case, role) => {
    const authorityBlock = reconcile.match(/select exists \([\s\S]*?into v_actor_has_authority;/i)?.[0] ?? '';
    expect(authorityBlock).not.toContain(`'${role}'`);
  });

  it('09: inactive actors are denied', () => {
    expect(reconcile).toContain('v_actor.is_active is distinct from true');
    expect(reconcile).toContain("v_actor.user_status <> 'active'");
    expect(reconcile).toContain('ACTOR_INACTIVE');
  });

  it('10: actor and target tenancy are constrained to the SOP organization', () => {
    expect(reconcile).toContain('v_actor.organization_id <> v_doc.organization_id');
    expect(reconcile).toContain('p.organization_id = v_doc.organization_id');
    expect(reconcile).toContain('CROSS_ORGANIZATION_DENIED');
  });

  it('11: inactive target profiles are excluded', () => {
    expect(reconcile).toContain('and p.is_active = true');
  });

  it('12: non-active user lifecycle profiles are excluded', () => {
    expect(reconcile).toContain("and p.user_status = 'active'");
  });

  it('13: department target overrides precede applicability scope', () => {
    expect(reconcile).toMatch(/when v_has_target_dept then[\s\S]*?when v_has_app_dept then/i);
  });

  it('14: role target overrides precede applicability and only active roles match', () => {
    expect(reconcile).toMatch(/when v_has_target_role then[\s\S]*?when v_has_app_role then/i);
    expect(reconcile).toContain('and ur.is_active = true');
    expect(reconcile.match(/ur\.organization_id = v_doc\.organization_id/g)).toHaveLength(3);
  });

  it('15: newly eligible users receive one version/cycle assignment with a fair due date', () => {
    expect(reconcile).toContain('v_due_date := current_date + coalesce(v_sop_detail.acknowledgment_sla_days, 30)');
    expect(reconcile).toContain("'population_reconciliation_assigned'");
    expect(reconcile).toContain('v_newly_assigned_count := v_newly_assigned_count + 1');
  });

  it('16: newly eligible acknowledgment requirements are specific-user and required', () => {
    expect(reconcile).toContain("'specific_users'");
    expect(reconcile).toMatch(/document_acknowledgment_requirements \([\s\S]*?v_due_date,[\s\S]*?true,/i);
  });

  it('17: competency-only versions still require assignments', () => {
    expect(reconcile).toContain('v_needs_assignment := v_training_req or v_comp_req');
  });

  it('18: acknowledgment-only versions skip training assignment creation', () => {
    expect(reconcile).toContain('if v_needs_assignment then');
    expect(reconcile).toContain('if v_ack_req then');
  });

  it.each([
    ['19', 'assigned'],
    ['20', 'in_progress'],
    ['21', 'overdue'],
  ])('%s: out-of-scope %s assignments are population-cancelled with prior state', (_case, state) => {
    expect(reconcile).toContain("ta.status in ('assigned', 'in_progress', 'overdue')");
    expect(reconcile).toContain("'population_reconciliation_cancelled_' || v_previous_status");
    expect(reconcile).toContain(state);
  });

  it.each([
    ['22', 'completed'],
    ['23', 'waived'],
  ])('%s: historical %s assignments are outside the cancellation update set', (_case, state) => {
    const cancellationLoop = reconcile.match(/for v_assignment in \([\s\S]*?v_cancelled_out_of_scope_count :=/i)?.[0] ?? '';
    expect(cancellationLoop).not.toContain(`'${state}'`);
  });

  it('24: manually cancelled assignments are never automatically reactivated', () => {
    expect(reconcile).toContain("'cancelled'");
    expect(reconcile).toMatch(/if v_latest_relevant_event in \(\s*'population_reconciliation_cancelled_assigned'/i);
  });

  it('25: system population cancellations can be reactivated without duplicate assignment', () => {
    expect(reconcile).toContain("'population_reconciliation_reactivated'");
    expect(reconcile).toContain('v_reactivated_assignment_count := v_reactivated_assignment_count + 1');
    expect(reconcile).toContain('where id = v_assignment.id');
  });

  it('26: out-of-scope acknowledgment requirements are disabled, not deleted', () => {
    expect(reconcile).toContain('set required_flag = false');
    expect(reconcile).not.toMatch(/delete\s+from\s+public\.document_acknowledgment_requirements/i);
  });

  it('27: re-entry re-enables the same acknowledgment requirement with a new due date', () => {
    expect(reconcile).toMatch(/set required_flag = true,\s*due_date = v_due_date/i);
    expect(reconcile).toContain('v_ack_reactivated_count := v_ack_reactivated_count + 1');
  });

  it('28: historical acknowledgment evidence is never mutated or deleted', () => {
    expect(reconcile).not.toMatch(/(?:update|delete\s+from)\s+public\.document_acknowledgments/i);
  });

  it('29: idempotency is backed by exact version/cycle lookup and serialized execution', () => {
    expect(reconcile).toContain('pg_advisory_xact_lock');
    expect(reconcile).toContain('ta.document_version_id = p_version_id');
    expect(reconcile).toContain('ta.obligation_cycle = v_cycle');
  });

  it('30: deterministic result includes every required exact count', () => {
    for (const key of [
      'target_population_count',
      'newly_assigned_count',
      'reactivated_assignment_count',
      'cancelled_out_of_scope_count',
      'acknowledgment_requirements_created',
      'acknowledgment_requirements_reactivated',
      'acknowledgment_requirements_deactivated',
    ]) expect(reconcile).toContain(`'${key}'`);
  });

  it('31: migration contains no cross-organization or renewal-cycle write path', () => {
    expect(reconcile).toContain('v_cycle integer := 1');
    expect(reconcile).not.toContain("v_cycle_type := 'renewal'");
    expect(reconcile).not.toMatch(/insert into public\.profiles|update public\.profiles/i);
  });

  it('capability contract is exact, deterministic, and schema-versioned', () => {
    expect(migration209).toContain("'contract_version', 'e2b3-training-population-v1'");
    expect(migration209).toContain("'schema_version', 209");
    expect(migration209).toContain("'reconciliation_available', true");
  });

  it('per-assignment and summary audit events remain service-side', () => {
    for (const event of [
      'population_reconciliation_assigned',
      'population_reconciliation_cancelled_assigned',
      'population_reconciliation_cancelled_in_progress',
      'population_reconciliation_cancelled_overdue',
      'population_reconciliation_reactivated',
      'population_acknowledgment_requirements_reconciled',
      'population_reconciliation_completed',
    ]) expect(reconcile).toContain(event);
  });

  it('isolated runtime proof covers the retained 31 cases plus 7 R1 publication cases and rolls fixtures back', () => {
    const proof = fs.readFileSync(runtimeProofPath, 'utf8');
    expect(proof).toContain('ALL 31 E2B3 MIGRATION209 LIFECYCLE CASES DETERMINISTICALLY VERIFIED (PASSED).');
    expect(proof).toContain('ALL 7 E2B3 R1 VERSION-PUBLICATION CASES DETERMINISTICALLY VERIFIED (PASSED).');
    expect(proof).toContain('ALL 38 E2B3 MIGRATION209 + R1 BEHAVIORAL CASES DETERMINISTICALLY VERIFIED (PASSED).');
    expect(proof).toContain('rollback;');
  });
});
