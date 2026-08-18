import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('GRC v1.4-E1-R2 Edge v13 Governed SOP & Document Control Bridge Architecture', () => {
  const rootDir = process.cwd();
  const edgeIndexPath = path.resolve(
    rootDir,
    'supabase/functions/privileged-action/index.ts'
  );
  const edgeSource = fs.readFileSync(edgeIndexPath, 'utf8');

  it('01 exact seven-action family defined in v14e1rGovernedDocumentActions', () => {
    const expectedActions = [
      'v14e1r_configure_approval_authority_rule_stages',
      'v14e1r_create_governed_sop_draft',
      'v14e1r_save_governed_sop_draft',
      'v14e1r_start_governed_document_revision',
      'v14e1r_submit_governed_document_for_review',
      'v14e1r_record_governed_document_approval_decision',
      'v14e1r_finalize_governed_document_approval',
    ];

    expect(edgeSource).toContain('const v14e1rGovernedDocumentActions = new Set([');
    for (const act of expectedActions) {
      expect(edgeSource).toContain(`'${act}'`);
    }
  });

  it('02 family included in allowedActions allowlist', () => {
    expect(edgeSource).toContain('...v14e1rGovernedDocumentActions,');
  });

  it('03 no generic RPC forwarding', () => {
    expect(edgeSource).not.toMatch(/serviceClient\.rpc\(action,/);
    expect(edgeSource).not.toMatch(/serviceClient\.rpc\(requestBody\.action,/);
    expect(edgeSource).not.toMatch(/serviceClient\.rpc\(payload\.rpc_name,/);
  });

  it('04 actor ID always authenticated user ID for all 7 actions', () => {
    expect(edgeSource).toContain("p_actor_id: userData.user.id");
    expect(edgeSource).toContain("p_approver_id: userData.user.id");
  });

  it('05 client actor override rejected', () => {
    expect(edgeSource).toContain("assertNoIdentityOverrides(payload, ['actor_id', 'p_actor_id'");
  });

  it('06 client organization override rejected', () => {
    expect(edgeSource).toContain("'organization_id', 'p_organization_id'");
  });

  it('07 stage selection fields rejected for record decision', () => {
    expect(edgeSource).toContain("'stage_id', 'request_stage_id'");
  });

  it('08 invalid UUID rejected via requireCanonicalUuid helper', () => {
    expect(edgeSource).toContain('function isCanonicalUuid(');
    expect(edgeSource).toContain('function requireCanonicalUuid(');
    expect(edgeSource).toContain('INVALID_UUID_');
  });

  it('09 invalid decision rejected via enum validation', () => {
    expect(edgeSource).toContain("if (!['approved', 'rejected', 'returned', 'abstained'].includes(decision))");
    expect(edgeSource).toContain("throw new Error('INVALID_DECISION');");
  });

  it('10 invalid stage selector rejected via XOR assertion', () => {
    expect(edgeSource).toContain("if ((reviewerUserId && reviewerRole) || (!reviewerUserId && !reviewerRole))");
    expect(edgeSource).toContain("throw new Error('PATCH206_INVALID_STAGE_AUTH_SELECTOR');");
  });

  it('11 stage count bounds strictly enforced 1 to 20', () => {
    expect(edgeSource).toContain("if (!Array.isArray(payload.stages) || payload.stages.length === 0 || payload.stages.length > 20)");
    expect(edgeSource).toContain("throw new Error('PATCH206_EMPTY_STAGE_CONFIGURATION');");
  });

  it('12 payload byte bound enforced at 1 MiB', () => {
    expect(edgeSource).toContain('const MAX_E1R2_PAYLOAD_BYTES = 1024 * 1024;');
    expect(edgeSource).toContain('PAYLOAD_BYTE_BOUND_EXCEEDED');
  });

  it('13 SOP nested collection bounds strictly defined', () => {
    expect(edgeSource).toContain("if (sections.length > 100) throw new Error('MAX_COUNT_EXCEEDED_PROCEDURE_SECTIONS');");
    expect(edgeSource).toContain("if (steps.length > 500) throw new Error('MAX_COUNT_EXCEEDED_PROCEDURE_STEPS');");
    expect(edgeSource).toContain("if (deptScopes.length > 250) throw new Error('MAX_COUNT_EXCEEDED_DEPARTMENT_SCOPES');");
    expect(edgeSource).toContain("if (roleScopes.length > 250) throw new Error('MAX_COUNT_EXCEEDED_ROLE_SCOPES');");
    expect(edgeSource).toContain("if (definitions.length > 250) throw new Error('MAX_COUNT_EXCEEDED_DEFINITIONS');");
    expect(edgeSource).toContain("if (roleResponsibilities.length > 250) throw new Error('MAX_COUNT_EXCEEDED_ROLE_RESPONSIBILITIES');");
    expect(edgeSource).toContain("if (monitoringKpis.length > 250) throw new Error('MAX_COUNT_EXCEEDED_MONITORING_KPIS');");
    expect(edgeSource).toContain("if (riskLinks.length > 250) throw new Error('MAX_COUNT_EXCEEDED_RISK_LINKS');");
    expect(edgeSource).toContain("if (accreditationLinks.length > 250) throw new Error('MAX_COUNT_EXCEEDED_ACCREDITATION_LINKS');");
    expect(edgeSource).toContain("if (versionLinks.length > 250) throw new Error('MAX_COUNT_EXCEEDED_VERSION_LINKS');");
  });

  it('14 create authoritative organization derivation via profiles lookup', () => {
    expect(edgeSource).toContain(".from('profiles')");
    expect(edgeSource).toContain("p_organization_id: actorProfile.organization_id");
  });

  it('15 save fixed RPC mapping', () => {
    expect(edgeSource).toContain("await serviceClient.rpc('save_governed_sop_draft', {");
  });

  it('16 revision fixed RPC mapping', () => {
    expect(edgeSource).toContain("await serviceClient.rpc('start_governed_document_revision', {");
  });

  it('17 submit fixed RPC mapping', () => {
    expect(edgeSource).toContain("await serviceClient.rpc('submit_governed_document_for_review', {");
  });

  it('18 Path-B unstaged request rejected by Edge preflight', () => {
    expect(edgeSource).toContain("if (stageErr || !stageRows || stageRows.length === 0)");
    expect(edgeSource).toContain("PATCH206_NO_STAGES_INSTANTIATED");
  });

  it('19 staged document_control request accepted by preflight', () => {
    expect(edgeSource).toContain("if (reqRow.workflow_type !== 'document_control' || reqRow.linked_item_type !== 'document_version')");
    expect(edgeSource).toContain("PATCH206_INVALID_WORKFLOW_TYPE");
  });

  it('20 pending request accepted in decision preflight', () => {
    expect(edgeSource).toContain("['pending', 'partially_approved'].includes(reqRow.request_status)");
  });

  it('21 partially_approved request accepted in decision preflight', () => {
    expect(edgeSource).toContain("['pending', 'partially_approved'].includes(reqRow.request_status)");
  });

  it('22 closed request rejected in decision preflight', () => {
    expect(edgeSource).toContain("if (!['pending', 'partially_approved'].includes(reqRow.request_status))");
    expect(edgeSource).toContain("PATCH206_REQUEST_NOT_OPEN");
  });

  it('23 exactly-zero in-progress stages rejected in decision preflight', () => {
    expect(edgeSource).toContain("if (inProgressStages.length !== 1)");
    expect(edgeSource).toContain("PATCH206_INVALID_STAGE_STATE");
  });

  it('24 multiple in-progress stages rejected in decision preflight', () => {
    expect(edgeSource).toContain("if (inProgressStages.length !== 1)");
  });

  it('25 linked_item_type must document_version', () => {
    expect(edgeSource).toContain("reqRow.linked_item_type !== 'document_version'");
  });

  it('26 workflow_type must document_control', () => {
    expect(edgeSource).toContain("reqRow.workflow_type !== 'document_control'");
  });

  it('27 linked document organization verified against actor profile org', () => {
    expect(edgeSource).toContain("if (docOrg !== actorProfile.organization_id)");
    expect(edgeSource).toContain("PATCH202_ACTOR_CROSS_ORG_FORBIDDEN");
  });

  it('28 client cannot supply approver role', () => {
    expect(edgeSource).toContain("'approver_role', 'p_approver_role'");
  });

  it('29 decision RPC sends p_approver_role = null', () => {
    expect(edgeSource).toContain("p_approver_role: null");
  });

  it('30 decision response requires status=ok', () => {
    expect(edgeSource).toContain("if (resObj.status !== 'ok' || resObj.approval_request_id !== approvalRequestId");
  });

  it('31 submit response requires status=under_review', () => {
    expect(edgeSource).toContain("resObj.status !== 'under_review'");
  });

  it('32 save/create do not require success field', () => {
    expect(edgeSource).toContain("if (!resObj.document_id || !resObj.version_id || !resObj.document_code");
    expect(edgeSource).toContain("if (!resObj.document_id || resObj.version_id !== versionId");
  });

  it('33 revision validates version_number, not new_version_number', () => {
    expect(edgeSource).toContain("typeof resObj.version_number !== 'number'");
    expect(edgeSource).toContain("resObj.status !== 'draft'");
  });

  it('34 finalization normal response proof', () => {
    expect(edgeSource).toContain("if (!resObj.document_id || resObj.version_id !== versionId || !resObj.approved_by || resObj.status !== 'approved')");
  });

  it('35 finalization already-approved response proof', () => {
    expect(edgeSource).toContain("if (resObj.already_approved === true)");
    expect(edgeSource).toContain("if (resObj.success !== true || resObj.version_id !== versionId)");
  });

  it('36 safe DB error mapping maps known PATCH codes to appropriate HTTP codes', () => {
    expect(edgeSource).toContain("function mapV14e1rDatabaseError(action: string, error: unknown)");
    expect(edgeSource).toContain("PATCH202_ACTOR_NOT_AUTHORIZED");
    expect(edgeSource).toContain("PATCH206_ACTOR_UNAUTHORIZED_FOR_STAGE_CONFIG");
    expect(edgeSource).toContain("status = 403;");
    expect(edgeSource).toContain("status = 404;");
    expect(edgeSource).toContain("status = 400;");
    expect(edgeSource).toContain("status = 409;");
  });

  it('37 unknown DB errors do not expose raw details', () => {
    expect(edgeSource).toContain("safeDetail = 'The governed document operation could not be completed.';");
  });

  it('38 credential gate occurs before E1-R2 handler', () => {
    const authCheckIdx = edgeSource.indexOf('authClient.auth.getUser');
    const capCheckIdx = edgeSource.indexOf('serviceClient.rpc(\'patch83u_get_capabilities\'');
    const e1r2HandlerIdx = edgeSource.indexOf("if (action === 'v14e1r_create_governed_sop_draft')");

    expect(authCheckIdx).toBeGreaterThan(0);
    expect(capCheckIdx).toBeGreaterThan(authCheckIdx);
    expect(e1r2HandlerIdx).toBeGreaterThan(capCheckIdx);
  });

  it('39 missing Bearer remains 401', () => {
    expect(edgeSource).toContain("AUTH_TOKEN_REQUIRED");
  });

  it('40 invalid Bearer remains 401', () => {
    expect(edgeSource).toContain("AUTH_TOKEN_INVALID");
  });

  it('41 unsupported action behavior unchanged', () => {
    expect(edgeSource).toContain("UNSUPPORTED_PRIVILEGED_ACTION");
  });

  it('42 OPTIONS behavior unchanged', () => {
    expect(edgeSource).toContain("if (request.method === 'OPTIONS') {");
  });

  it('43 Patch83U action family unchanged', () => {
    expect(edgeSource).toContain("patch83uActions = new Set([");
  });

  it('44 Patch83T family unchanged', () => {
    expect(edgeSource).toContain("patch83tUserImportActions = new Set([");
  });

  it('45 Patch22/23/24 families unchanged', () => {
    expect(edgeSource).toContain("patch22RiskActions = new Set([");
    expect(edgeSource).toContain("patch23EvidenceActions = new Set([");
    expect(edgeSource).toContain("patch24AuditActions = new Set([");
  });

  it('46 Patch26/29 families unchanged', () => {
    expect(edgeSource).toContain("patch26DocumentActions = new Set([");
    expect(edgeSource).toContain("patch29TrainingActions = new Set([");
  });

  it('47 F1-R2 family unchanged', () => {
    expect(edgeSource).toContain("f1r2BusinessCycleActions = new Set([");
  });

  it('48 no new direct browser DB execution grant in migrations', () => {
    const migration206Path = path.resolve(rootDir, 'supabase/migrations/206_governed_sop_template_alignment_and_raci.sql');
    const m206Sql = fs.readFileSync(migration206Path, 'utf8');
    expect(m206Sql).not.toContain('grant execute on function public.create_governed_sop_draft to authenticated');
    expect(m206Sql).not.toContain('grant execute on function public.save_governed_sop_draft to authenticated');
    expect(m206Sql).not.toContain('grant execute on function public.submit_governed_document_for_review to authenticated');
    expect(m206Sql).not.toContain('grant execute on function public.finalize_governed_document_approval to authenticated');
  });

  it('49 no Migration 207', () => {
    const migrations = fs.readdirSync(path.resolve(rootDir, 'supabase/migrations'));
    const m207 = migrations.find(f => f.startsWith('207'));
    expect(m207).toBeUndefined();
  });

  it('50 verify_jwt deployment requirement remains true', () => {
    expect(edgeSource).not.toContain('verify_jwt: false');
  });
});
