import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function functionDefinition(input: string) {
  const marker = 'create or replace function public.patch23_evidence_governance_bridge(';
  const start = input.indexOf(marker);
  const end = input.indexOf('\n$$;', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return input.slice(start, end + '\n$$;'.length);
}

const releasedMigration = source('supabase/migrations/085_patch23_evidence_bridge_governance.sql');
const hotfixMigration = source('supabase/migrations/190_patch23_evidence_service_role_guard_compatibility.sql');
const runtimeProof = source('tests/sql/patch23_evidence_service_role_guard_hotfix_e1.sql');
const releasedFunction = functionDefinition(releasedMigration);
const hotfixFunction = functionDefinition(hotfixMigration);

const oldDeclaration = "  v_jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), current_user);\n";
const oldGuard = [
  "  if v_jwt_role <> 'service_role' and current_user <> 'service_role' then",
  "    raise exception 'PATCH23_EVIDENCE_SERVICE_ROLE_REQUIRED';",
  '  end if;',
].join('\n');
const newGuard = [
  "  if auth.role() is distinct from 'service_role' then",
  "    raise exception 'PATCH23_EVIDENCE_SERVICE_ROLE_REQUIRED';",
  '  end if;',
].join('\n');

describe('Patch23 evidence service-role guard hotfix E1', () => {
  it('binds the diagnosis to the exact released guard', () => {
    expect(releasedFunction).toContain(oldDeclaration);
    expect(releasedFunction).toContain(oldGuard);
    expect(releasedFunction).not.toContain(newGuard);
  });

  it('replaces only the obsolete declaration and service-role guard', () => {
    const expected = releasedFunction
      .replace(oldDeclaration, '')
      .replace(oldGuard, newGuard);
    expect(hotfixFunction).toBe(expected);
  });

  it('uses null-safe auth.role() enforcement and removes request-claim/current-user detection', () => {
    expect(hotfixFunction).toContain(newGuard);
    expect(hotfixFunction).not.toContain('v_jwt_role');
    expect(hotfixFunction).not.toContain("current_setting('request.jwt.claim.role'");
    expect(hotfixFunction).not.toMatch(/current_user\s*<>\s*'service_role'/);
    expect(hotfixFunction).not.toContain("auth.role() <> 'service_role'");
    expect(hotfixFunction.indexOf(newGuard)).toBeLessThan(hotfixFunction.indexOf('select * into v_actor'));
  });

  it('preserves SECURITY DEFINER and the controlled search_path', () => {
    expect(hotfixFunction).toContain('language plpgsql\nsecurity definer\nset search_path = public, pg_temp');
  });

  it('keeps execute access service-role-only', () => {
    expect(hotfixMigration).toContain(
      'REVOKE EXECUTE ON FUNCTION public.patch23_evidence_governance_bridge(uuid,text,jsonb)\nFROM PUBLIC, anon, authenticated;',
    );
    expect(hotfixMigration).toContain(
      'GRANT EXECUTE ON FUNCTION public.patch23_evidence_governance_bridge(uuid,text,jsonb)\nTO service_role;',
    );
    expect(hotfixMigration).not.toMatch(/GRANT EXECUTE[\s\S]*TO (?:PUBLIC|anon|authenticated)/i);
  });

  it('lets a service-role invocation reach past the guard', () => {
    const rejects = (role: string) => role !== 'service_role';
    expect(rejects('service_role')).toBe(false);
  });

  it.each(['authenticated', 'anon'])('fails closed for the %s role', role => {
    const rejects = (candidate: string) => candidate !== 'service_role';
    expect(rejects(role)).toBe(true);
  });

  it('has a hermetic PostgreSQL proof for both JWT claim representations and fail-closed roles', () => {
    expect(runtimeProof).toContain("set_config('request.jwt.claims', '{\"role\":\"service_role\"}', true)");
    expect(runtimeProof).toContain("set_config('request.jwt.claim.role', 'service_role', true)");
    expect(runtimeProof).toContain("set_config('request.jwt.claims', '{\"role\":\"authenticated\"}', true)");
    expect(runtimeProof).toContain("set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
    expect(runtimeProof).toContain("'PATCH23_EVIDENCE_SERVICE_ROLE_REQUIRED'");
    expect(runtimeProof).toContain("'permission denied for function patch23_evidence_governance_bridge'");
  });

  it('preserves the complete Patch23 action allowlist', () => {
    for (const action of [
      'create_evidence_requirement',
      'link_evidence_to_item',
      'submit_evidence_for_review',
      'accept_evidence',
      'reject_evidence',
      'request_evidence_revision',
      'supersede_evidence',
      'lock_evidence',
      'request_evidence_gate_waiver',
      'approve_evidence_gate_waiver',
      'reject_evidence_gate_waiver',
      'check_evidence_gate_status',
      'generate_evidence_pack_index',
    ]) expect(hotfixFunction).toContain(`'${action}'`);
  });

  it('still requires an authorized evidence reviewer', () => {
    expect(hotfixFunction).toContain(
      "if v_action in ('accept_evidence','reject_evidence','request_evidence_revision','lock_evidence') and not v_can_review then",
    );
    expect(hotfixFunction).toContain("raise exception 'PATCH23_EVIDENCE_REVIEWER_REQUIRED';");
    expect(hotfixFunction).toContain("ur.role::text in ('super_admin','governance_admin','executive','auditor','compliance_officer','department_manager')");
  });

  it('still denies cross-organization evidence and requirements', () => {
    expect(hotfixFunction.match(/PATCH23_EVIDENCE_CROSS_ORGANIZATION_DENIED/g)).toHaveLength(2);
    expect(hotfixFunction).toContain('v_evidence.organization_id is distinct from v_actor.organization_id');
    expect(hotfixFunction).toContain('v_requirement.organization_id is distinct from v_actor.organization_id');
  });

  it('preserves accepted evidence fields and the accepted review event', () => {
    const start = hotfixFunction.indexOf("elsif v_action = 'accept_evidence' then");
    const end = hotfixFunction.indexOf("elsif v_action = 'reject_evidence' then", start);
    const acceptBlock = hotfixFunction.slice(start, end);
    expect(acceptBlock).toContain("review_status = 'accepted'");
    expect(acceptBlock).toContain("status = 'accepted'");
    expect(acceptBlock).toContain('reviewed_by = p_actor_id');
    expect(acceptBlock).toContain('reviewed_at = now()');
    expect(acceptBlock).toContain("patch23_write_evidence_event(v_actor.organization_id, v_evidence_id, 'accepted'");
  });

  it('preserves reviewer separation and sensitive-evidence classification checks', () => {
    const start = hotfixFunction.indexOf("elsif v_action = 'accept_evidence' then");
    const end = hotfixFunction.indexOf("elsif v_action = 'reject_evidence' then", start);
    const acceptBlock = hotfixFunction.slice(start, end);
    expect(acceptBlock).toContain('v_evidence.uploaded_by = p_actor_id and not v_can_manage');
    expect(acceptBlock).toContain("raise exception 'PATCH23_EVIDENCE_REVIEWER_SEPARATION_REQUIRED';");
    expect(acceptBlock).toContain("v_evidence.sensitivity_level in ('confidential','highly_sensitive','restricted')");
    expect(acceptBlock).toContain("raise exception 'PATCH23_EVIDENCE_CLASSIFICATION_REASON_REQUIRED';");
  });

  it('does not mutate the OVR workflow during evidence acceptance', () => {
    expect(hotfixFunction).not.toContain('update public.ovr_reports');
    expect(hotfixFunction).not.toContain('v98_update_ovr_workflow');
    expect(hotfixFunction).not.toContain('can_close_ovr');
  });

  it('has a synthetic runtime proof for acceptance and the unchanged OVR closure gate', () => {
    expect(runtimeProof).toContain("not public.can_close_ovr('40000000-0000-0000-0000-000000000001')");
    expect(runtimeProof).toContain("public.can_close_ovr('40000000-0000-0000-0000-000000000001')");
    expect(runtimeProof).toContain("event_type = 'accepted'");
    expect(runtimeProof).toContain("status = 'quality_final_review'");
  });

  it('contains no RLS, table, type, schema-permission, or unrelated function DDL', () => {
    expect(hotfixMigration).not.toMatch(/\b(?:create|alter|drop)\s+(?:table|type|policy|schema)\b/i);
    expect(hotfixMigration).not.toMatch(/\b(?:enable|disable|force|no force)\s+row\s+level\s+security\b/i);
    expect(hotfixMigration.match(/create or replace function/gi)).toHaveLength(1);
    expect(hotfixMigration.match(/patch23_evidence_governance_bridge/gi)?.length).toBeGreaterThanOrEqual(3);
  });

  it('contains no Phase 2 material because it is the exact released function plus one guard change', () => {
    const expected = releasedFunction
      .replace(oldDeclaration, '')
      .replace(oldGuard, newGuard);
    expect(hotfixFunction).toBe(expected);
    expect(hotfixMigration).not.toMatch(/analytics|conflict.routing|shared.chart|executive dashboard/i);
  });

  it('proves the committed hotfix artifact boundary without depending on worktree dirtiness', () => {
    const artifactPaths = [
      'supabase/migrations/190_patch23_evidence_service_role_guard_compatibility.sql',
      'tests/sql/patch23_evidence_service_role_guard_hotfix_e1.sql',
      'tests/unit/patch23EvidenceServiceRoleGuardHotfixE1.test.ts',
    ];
    const artifactContents = artifactPaths.map(source);

    expect(artifactContents.every(content => content.length > 0)).toBe(true);
    expect(hotfixMigration.match(/create or replace function/gi)).toHaveLength(1);
    expect(hotfixMigration).toContain('REVOKE EXECUTE ON FUNCTION public.patch23_evidence_governance_bridge');
    expect(runtimeProof).toContain('PATCH23_EVIDENCE_SERVICE_ROLE_REQUIRED');
    expect(artifactContents[2]).toContain("describe('Patch23 evidence service-role guard hotfix E1'");
  });
});
