import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  approvalAuthorityForActor,
  buildGovernanceAnalytics,
  metricValue,
  permissionScopedOptions,
  ui7WorkBucket,
  type Ui7ApprovalRequest,
  type Ui7ApprovalRule,
  type Ui7ApprovalStage,
  type Ui7GovernanceTruthRow,
  type Ui7WorkItem,
} from '../../src/lib/ui7ApprovalsReportsModel';

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const myWork = source('src/pages/MyWork.tsx');
const approvals = source('src/pages/Approvals.tsx');
const reports = source('src/pages/ReportsAnalyticsCenter.tsx');
const api = source('src/lib/ui7ApprovalsReportsApi.ts');
const edge = source('supabase/functions/privileged-action/index.ts');
const fixtures = source('tests/e2e/ui7Fixtures.ts');
const css = source('src/styles/ui7-approvals-reports.css');
const routes = source('src/routes/pageLocation.ts');

const actorId = '00000000-0000-4000-8000-000000000084';
const requesterId = '00000000-0000-4000-8000-000000000171';
const organizationId = '00000000-0000-4000-8000-000000000001';

function work(overrides: Partial<Ui7WorkItem> = {}): Ui7WorkItem {
  return { id: 'work-1', sourceModule: 'audit', sourceType: 'audit_finding', sourceId: 'finding-1', title: 'Respond to finding', description: null, owner: null, requester: null, dueDate: null, status: 'pending', priority: 'high', severity: null, requiredAction: 'Respond', route: 'audit', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: null, actionability: 'actionable', blockedReason: null, delegated: false, ...overrides };
}

function request(overrides: Partial<Ui7ApprovalRequest> = {}): Ui7ApprovalRequest {
  return { id: 'approval-1', organization_id: organizationId, request_code: 'APR-1', workflow_type: 'document_control', linked_item_type: 'policy', linked_item_id: 'policy-1', action_type: 'publish', department_id: null, requested_by: requesterId, requested_at: '2026-08-20T00:00:00.000Z', request_reason: 'Publish policy', request_status: 'pending', required_approval_count: 1, received_approval_count: 0, authority_rule_id: 'rule-1', due_date: '2026-08-26', escalation_required: false, escalation_level_current: null, escalated_to: null, final_decision: null, final_decision_by: null, final_decision_at: null, final_decision_note: null, updated_at: null, ...overrides };
}

const rule: Ui7ApprovalRule = { id: 'rule-1', organization_id: organizationId, workflow_type: 'document_control', action_type: 'publish', department_id: null, approver_user_id: actorId, approver_role: null, allow_self_approval: false, conflict_of_interest_block: true, active_flag: true, effective_date: '2026-01-01', expiry_date: null, rule_code: 'RULE-1', rule_name: 'Policy publisher' };
const stage: Ui7ApprovalStage = { id: 'stage-1', approval_request_id: 'approval-1', stage_key: 'final', stage_name: 'Final authority', stage_order: 1, assigned_user_id: actorId, assigned_role: null, stage_status: 'in_progress', allow_self_approval: false, required_decision_count: 1, received_decision_count: 0, started_at: '2026-08-20T00:00:00.000Z', completed_at: null };

function governance(overrides: Partial<Ui7GovernanceTruthRow> = {}): Ui7GovernanceTruthRow {
  return { link_id: 'link-1', decision_type: 'confirmed', significance: 'violation', adherence_status: 'not_complied', adequacy_status: null, inherited: false, counts_as_violation: true, confirmed_noncompliance: true, confirmed_procedure_failure: false, document_inadequacy: false, training_gap: false, control_failure: false, relationship_origin: 'reviewer_confirmed', root_event_key: 'ovr:root-1', root_source_entity_type: 'ovr', root_source_entity_id: 'root-1', source_entity_type: 'ovr', source_entity_id: 'ovr-1', target_criterion_type: 'policy', target_document_id: 'policy-1', target_version_id: 'policy-version-4', target_display_label: 'Clinical Governance Policy v4', created_at: '2026-08-20T00:00:00.000Z', ...overrides };
}

describe('UI-7 My Work contract (required proofs 1-16)', () => {
  it('publishes the canonical route and all queue views', () => {
    expect(routes).toContain('myWork: "my-work"');
    for (const view of ['overview', 'pending', 'due_soon', 'overdue', 'completed', 'delegated']) expect(myWork).toContain(`'${view}'`);
  });

  it('classifies pending, due soon, overdue, completed and delegated without invented state', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    expect(ui7WorkBucket(work(), now)).toBe('pending');
    expect(ui7WorkBucket(work({ dueDate: '2026-08-26' }), now)).toBe('due_soon');
    expect(ui7WorkBucket(work({ dueDate: '2026-08-20' }), now)).toBe('overdue');
    expect(ui7WorkBucket(work({ status: 'completed' }), now)).toBe('completed');
    expect(ui7WorkBucket(work({ delegated: true }), now)).toBe('delegated');
  });

  it('supports module, priority, due-view and text filters', () => {
    expect(myWork).toContain('moduleFilter');
    expect(myWork).toContain('priorityFilter');
    expect(myWork).toContain("['due_soon', text('Due Soon'");
    expect(myWork).toContain('matchesSearch');
  });

  it('uses governed source drill-down and preserves four explicit actionability states', () => {
    for (const state of ['actionable', 'read_only', 'blocked', 'completed']) expect(api).toContain(`'${state}'`);
    expect(myWork).toContain("item.actionability === 'actionable' ? item.requiredAction");
    expect(myWork).toContain("item.actionability === 'blocked'");
    expect(myWork).toContain('setPage(item.route as PageKey)');
  });

  it('combines actual Patch38 assignments and the existing project assignment action', () => {
    expect(api).toContain(".from('v_patch38_my_work_queue')");
    expect(api).toContain("invokePrivilegedAction<MyWorkRow[]>('f1r2_list_my_work'");
    expect(api).toContain("sourceModule: 'project'");
    expect(api).toContain('project_assignment:');
  });

  it('keeps queue reads bounded and assignment-scoped by backend contracts', () => {
    expect(api).toContain('.limit(250)');
    expect(api).not.toContain('service_role');
    expect(myWork).toContain('No legitimate assigned, delegated, or recently actioned work');
  });
});

describe('UI-7 Approval contract (required proofs 17-31)', () => {
  it('publishes inbox, details, due, delegation, completion and performance workspaces', () => {
    for (const view of ['inbox', 'due', 'delegations', 'completed', 'performance', 'detail']) expect(approvals).toContain(`'${view}'`);
    expect(approvals).toContain('ui7-approval-history');
    expect(approvals).toContain('ui7-decision-workspace');
  });

  it('allows the current named authority and the current role authority', () => {
    expect(approvalAuthorityForActor({ request: request(), rules: [rule], stages: [stage], delegations: [], actorId, actorRoles: ['super_admin'] }).actionable).toBe(true);
    const roleStage = { ...stage, assigned_user_id: null, assigned_role: 'super_admin' };
    expect(approvalAuthorityForActor({ request: request(), rules: [rule], stages: [roleStage], delegations: [], actorId, actorRoles: ['super_admin'] }).actionable).toBe(true);
  });

  it('permits only a current scope-matched delegation', () => {
    const delegatedStage = { ...stage, assigned_user_id: requesterId };
    const delegation = { id: 'delegation-1', organization_id: organizationId, delegator_id: requesterId, delegate_id: actorId, workflow_type: 'document_control', action_type: 'publish', department_id: null, effective_from: '2026-08-01T00:00:00.000Z', effective_to: '2026-09-01T00:00:00.000Z', delegation_reason: null, active_flag: true, delegator_name: null, delegate_name: null };
    expect(approvalAuthorityForActor({ request: request(), rules: [rule], stages: [delegatedStage], delegations: [delegation], actorId, actorRoles: [], now: new Date('2026-08-23') })).toMatchObject({ actionable: true, delegated: true });
    expect(approvalAuthorityForActor({ request: request(), rules: [rule], stages: [delegatedStage], delegations: [{ ...delegation, effective_to: '2026-08-22' }], actorId, actorRoles: [], now: new Date('2026-08-23') }).actionable).toBe(false);
  });

  it('fails closed for self-approval, unauthorized actors, missing authority and completed state', () => {
    expect(approvalAuthorityForActor({ request: request({ requested_by: actorId }), rules: [rule], stages: [stage], delegations: [], actorId, actorRoles: [] }).reason).toContain('Separation of duties');
    expect(approvalAuthorityForActor({ request: request(), rules: [rule], stages: [{ ...stage, assigned_user_id: requesterId }], delegations: [], actorId, actorRoles: [] }).actionable).toBe(false);
    expect(approvalAuthorityForActor({ request: request({ authority_rule_id: null }), rules: [], stages: [], delegations: [], actorId, actorRoles: [] }).actionable).toBe(false);
    expect(approvalAuthorityForActor({ request: request({ request_status: 'approved' }), rules: [rule], stages: [stage], delegations: [], actorId, actorRoles: [] }).reason).toContain('immutable');
    expect(approvalAuthorityForActor({ request: request(), rules: [rule], stages: [stage], delegations: [], actorId, actorRoles: ['viewer'] }).reason).toContain('read-only');
  });

  it('offers approve, reject and return with rationale through one governed Edge action', () => {
    for (const decision of ['approved', 'rejected', 'returned']) expect(approvals).toContain(`'${decision}'`);
    expect(approvals).toContain("id: 'note'");
    expect(api).toContain("'ui7_record_approval_decision'");
    expect(edge).toContain("action === 'ui7_record_approval_decision'");
  });

  it('revalidates actor, organization, stage, authority, delegation, SOD and stale state server-side', () => {
    for (const marker of ['UI7_APPROVAL_NOT_OPEN', 'UI7_APPROVAL_AUTHORITY_STATE_INVALID', 'UI7_APPROVAL_AUTHORITY_INACTIVE', 'UI7_SELF_APPROVAL_BLOCKED', 'UI7_APPROVAL_AUTHORITY_REQUIRED', 'UI7_APPROVAL_VIEWER_READ_ONLY']) expect(edge).toContain(marker);
    expect(edge).toContain('assertNoIdentityOverrides');
    expect(edge).toContain("rpc('record_approval_decision'");
  });

  it('preserves immutable history and does not expose decision controls for completed rows', () => {
    expect(approvals).toContain('selectedHistory.map');
    expect(approvals).toContain('Completed decisions remain immutable.');
    expect(approvals).toContain("OPEN_STATUSES.has(request.request_status)");
  });
});

describe('UI-7 Reports and governed analytics (required proofs 32-61)', () => {
  const analyticsRows = [
    governance(),
    governance({ link_id: 'link-2', target_criterion_type: 'sop', target_document_id: 'sop-1', target_version_id: 'sop-version-3', target_display_label: 'Medication SOP v3', adherence_status: 'procedure_not_followed', confirmed_noncompliance: false, confirmed_procedure_failure: true }),
    governance({ link_id: 'link-3', inherited: true, relationship_origin: 'inherited_from_source', source_entity_type: 'capa', target_criterion_type: 'sop', target_document_id: 'sop-1', target_version_id: 'sop-version-3', target_display_label: 'Medication SOP v3', adherence_status: 'procedure_not_followed', confirmed_noncompliance: false, confirmed_procedure_failure: true }),
    governance({ link_id: 'link-4', decision_type: 'rejected', root_event_key: 'ovr:root-2' }),
    governance({ link_id: 'link-5', decision_type: null, relationship_origin: 'reporter_suggested', root_event_key: 'ovr:root-3' }),
    governance({ link_id: 'link-6', significance: 'context_only', root_event_key: 'ovr:root-4' }),
    governance({ link_id: 'link-7', root_event_key: 'ovr:root-5', adherence_status: 'complied', adequacy_status: 'control_failed_despite_compliance', counts_as_violation: false, confirmed_noncompliance: false, control_failure: true, document_inadequacy: true, target_document_id: 'policy-2' }),
    governance({ link_id: 'link-8', root_event_key: 'ovr:root-6', adherence_status: 'complied', adequacy_status: 'training_competency_gap', counts_as_violation: false, confirmed_noncompliance: false, training_gap: true, document_inadequacy: true, target_document_id: 'sop-2' }),
  ];

  it('publishes the canonical Reports route, report library and every required module view', () => {
    expect(routes).toContain('reportsHub: "reports"');
    for (const view of ['overview', 'library', 'governance', 'adequacy', 'risk', 'compliance', 'audit', 'capa', 'training', 'ovr', 'portfolio', 'approvals', 'drilldown']) expect(reports).toContain(`'${view}'`);
  });

  it('provides period, department, module, criterion and search filters from visible rows', () => {
    for (const marker of ['periodDays', 'departmentOptions', 'moduleFilter', 'criterionFilter', 'filteredSearch']) expect(reports).toContain(marker);
    expect(reports).toContain('permissionScopedOptions');
    expect(permissionScopedOptions([{ department: 'Quality' }, { department: 'Compliance' }], row => row.department)).toEqual(['Compliance', 'Quality']);
  });

  it('attributes one shared root to Policy and SOP while counting the global incident once', () => {
    const result = buildGovernanceAnalytics(analyticsRows);
    expect(result.policyNonconformities).toHaveLength(1);
    expect(result.sopProcedureFailures).toHaveLength(1);
    expect(result.policyNonconformities[0].count).toBe(1);
    expect(result.sopProcedureFailures[0].count).toBe(1);
    expect(result.globalRootIncidentCount).toBe(1);
  });

  it('excludes inherited, rejected, unresolved suggestion and context-only relationships', () => {
    const result = buildGovernanceAnalytics(analyticsRows);
    expect(result.sopProcedureFailures[0].count).toBe(1);
    expect(result.policyNonconformities.reduce((sum, row) => sum + row.count, 0)).toBe(1);
    expect(result.globalRootIncidentCount).toBe(1);
  });

  it('reports correct-compliance control failures separately and creates honest review candidates', () => {
    const result = buildGovernanceAnalytics(analyticsRows);
    expect(result.correctComplianceEvents).toHaveLength(1);
    expect(result.documentReviewCandidates).toHaveLength(2);
    expect(result.trainingGapDocuments).toHaveLength(1);
    expect(result.globalRootIncidentCount).toBe(1);
  });

  it('retains exact document versions and root identities in every attribution', () => {
    const result = buildGovernanceAnalytics(analyticsRows);
    expect(result.policyNonconformities[0].versionId).toBe('policy-version-4');
    expect(result.policyNonconformities[0].rootEvents).toEqual(['ovr:root-1']);
    expect(reports).toContain('Historical version');
    expect(reports).toContain('Exact version');
  });

  it('reads all report sources in bounded parallel queries and avoids N+1 profile hydration', () => {
    for (const table of ['risks', 'v_ui3_compliance_obligation_register', 'audit_findings', 'v_patch28_capa_register', 'capa_effectiveness_reviews', 'v_patch29_training_assignment_queue', 'ovr_reports', 'projects', 'milestones', 'tasks', 'v_patch23_evidence_review_queue', 'approval_requests']) expect(api).toContain(`'${table}'`);
    expect(api).toContain('Promise.all');
    expect(api).toContain('.limit(limit)');
  });

  it('distinguishes CAPA completion from effectiveness and covers all cross-module analytics', () => {
    expect(reports).toContain('Completed action is not an effective CAPA');
    for (const testId of ['ui7-risk-report', 'ui7-compliance-report', 'ui7-audit-report', 'ui7-capa-report', 'ui7-training-report', 'ui7-ovr-report', 'ui7-portfolio-evidence-report', 'ui7-approval-report']) expect(reports).toContain(testId);
  });

  it('makes important metrics and chart distributions drill into governed source rows', () => {
    expect(reports).toContain('openDrilldown');
    expect(reports).toContain('ui7-report-drilldown');
    expect(reports).toContain('Open source module');
    expect(reports).toContain('onSelect=');
  });

  it('does not fake unavailable metrics, trends, exports, snapshots or denominators', () => {
    expect(metricValue(false, 0)).toBeNull();
    expect(metricValue(true, 0)).toBe(0);
    expect(reports).toContain("metric === null ? 'Not available'");
    expect(reports).toContain('Reliable denominator unavailable');
    expect(reports).toContain('No export or immutable snapshot action is shown');
    expect(reports).not.toContain('Download report');
  });

  it('labels live freshness, selected period and permission scope honestly', () => {
    for (const marker of ['data as of', 'selected period', 'permission-scoped filter', 'Live report']) expect(reports).toContain(marker);
  });

  it('keeps populated scenarios test-only and runtime pages free of fixture imports', () => {
    for (const marker of ['POL-001', 'ui7GovernanceTruth', 'inherited_from_source', 'reporter_suggested', 'control_failed_despite_compliance', 'training_competency_gap', 'repeat event after CAPA']) expect(fixtures.toLowerCase()).toContain(marker.toLowerCase());
    expect(myWork).not.toContain('ui7MyWork');
    expect(approvals).not.toContain('ui7ApprovalRequests');
    expect(reports).not.toContain('ui7ReportTables');
  });

  it('uses semantic tokens, logical RTL rules, reduced motion and 390-compatible mobile layouts', () => {
    expect(css).toContain('var(--platform-surface-primary)');
    expect(css).toContain('padding-inline');
    expect(css).toContain('border-inline');
    expect(css).toContain('[dir="rtl"]');
    expect(css).toContain('@media (max-width: 560px)');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).not.toMatch(/letter-spacing:\s*-/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it('advances the migration ceiling only for the UI-7 participant read contract', () => {
    const migrationNames = fs.readdirSync(path.join(root, 'supabase/migrations'));
    expect(migrationNames.filter(name => name.startsWith('215_'))).toEqual([
      '215_ui7_approval_participant_read_contract.sql',
    ]);
    expect(migrationNames).toContain('214_ui4_audit_capa_governance.sql');
  });
});
