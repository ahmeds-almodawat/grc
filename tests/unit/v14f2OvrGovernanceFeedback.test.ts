import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  F2_OVR_GOVERNANCE_FEEDBACK_CONTRACT,
  hasExactF2GlobalGovernanceRole,
  hasExactF2OvrGovernanceFeedbackCapability,
  isF2Migration211CapabilityUnavailable,
  mapF2OvrGovernanceFeedbackError,
} from '../../supabase/functions/_shared/v14f2OvrGovernanceFeedbackBridge.ts';
import { canManageF2OvrGovernanceFeedback } from '../../src/lib/f2OvrGovernanceFeedbackModel';

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const migration = source('supabase/migrations/211_f2_ovr_governance_feedback_loop.sql');
const edge = source('supabase/functions/privileged-action/index.ts');
const frontend = source('src/pages/OVR.tsx');
const api = source('src/lib/f2OvrGovernanceFeedbackApi.ts');
const i18n = source('src/i18n/I18nContext.tsx');
const config = source('supabase/config.toml');
const edgeRoute = edge.slice(
  edge.indexOf('if (f2OvrGovernanceFeedbackActions.has(action))'),
  edge.indexOf("if (action === 'record_document_acknowledgment')"),
);

describe('GRC v1.4-F2 Migration211 governance feedback contract', () => {
  it('creates only migration 211 and reuses canonical review, project, link, and document-link structures', () => {
    expect(migration).toContain('public.governed_document_review_triggers');
    expect(migration).toContain('public.projects');
    expect(migration).toContain('public.ovr_capa_evidence_links');
    expect(migration).toContain('public.document_links');
    expect(migration).not.toMatch(/create table/i);
    expect(fs.existsSync(path.join(root, 'supabase/migrations/212_f2_ovr_governance_feedback_loop.sql'))).toBe(false);
  });

  it('extends reviews with nullable F2 trace fields and safe foreign keys', () => {
    for (const field of ['source_document_link_id', 'corrective_action_project_id', 'resulting_version_id']) {
      expect(migration).toContain(`add column if not exists ${field} uuid`);
    }
    expect(migration.match(/on delete set null/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('preserves the exact F1 source version and conflicts on a different open source version', () => {
    expect(migration).toContain("l.linked_item_type = 'ovr'");
    expect(migration).toContain("l.link_type = 'governed_version'");
    expect(migration).toContain('v_trigger.version_id is distinct from v_version_id');
    expect(migration).toContain('F2_OPEN_REVIEW_VERSION_CONFLICT');
    expect(migration).toMatch(/v_document_id, v_version_id, 'ovr'/);
  });

  it('branches revisions from the current governed version while retaining trigger.version_id', () => {
    expect(migration).toContain('v_revision_base_id := coalesce(v_current_version_id, v_trigger.version_id)');
    expect(migration).toContain('public.start_governed_document_revision');
    expect(migration).toContain('supersedes_version_id = coalesce(supersedes_version_id, v_revision_base_id)');
    expect(migration).toContain('resulting_version_id = v_resulting_version_id');
    expect(migration).not.toMatch(/set\s+version_id\s*=/i);
  });

  it('remediates the inherited lifecycle operation for exact-org global compliance authority', () => {
    expect(migration).toContain('create or replace function public.start_governed_document_revision');
    expect(migration).toMatch(/ur\.role = 'compliance_officer'[\s\S]*?ur\.scope = 'global'[\s\S]*?ur\.organization_id = v_org_id/);
    expect(migration).toContain('grant execute on function public.start_governed_document_revision(uuid, uuid, text, text)');
  });

  it('requires approved locked policy or SOP versions and a legitimate fallback lifecycle base', () => {
    expect(migration).toContain("v_document_type not in ('policy', 'sop')");
    expect(migration).toContain('F2_APPROVED_SOURCE_VERSION_REQUIRED');
    expect(migration).toContain('F2_IMMUTABLE_SOURCE_VERSION_REQUIRED');
    expect(migration).toContain('F2_CURRENT_REVISION_BASE_REQUIRED');
  });

  it('enforces exact active same-org global governance authority with no null-org fallback', () => {
    const authority = migration.slice(
      migration.indexOf('create or replace function public.f2_require_exact_governance_authority'),
      migration.indexOf('create or replace function public.initiate_ovr_governance_feedback_review'),
    );
    expect(migration).toContain("ur.role::text in ('super_admin', 'governance_admin', 'compliance_officer')");
    expect(authority).toContain("ur.scope::text = 'global'");
    expect(authority).toContain('ur.organization_id = p_organization_id');
    expect(authority).toContain('v_actor.organization_id is null');
    expect(authority).not.toMatch(/organization_id\s+is\s+null\s+or\s+ur\.organization_id/i);
  });

  it('keeps all mutation and capability RPCs service-role only', () => {
    for (const routine of [
      'initiate_ovr_governance_feedback_review(uuid, uuid, uuid, date, text)',
      'complete_ovr_governance_feedback_review(uuid, uuid, text, text)',
      'sync_ovr_corrective_action_capa_link(uuid, uuid)',
      'get_f2_ovr_governance_feedback_capabilities()',
    ]) {
      expect(migration).toContain(`grant execute on function public.${routine}`);
    }
    expect(migration.match(/F2_SERVICE_ROLE_REQUIRED/g)?.length).toBe(3);
    expect(migration).toContain('revoke all on function public.f2_require_exact_governance_authority(uuid, uuid)');
  });

  it('validates required rationale, note, due window, and exact completion outcomes', () => {
    expect(migration).toContain('char_length(v_rationale) < 3');
    expect(migration).toContain('p_due_date > current_date + 365');
    expect(migration).toContain("p_outcome not in ('no_change', 'minor_revision', 'major_revision', 'retire')");
    expect(migration).toContain('char_length(v_note) < 3');
  });

  it('writes opened/completed document events only on state changes', () => {
    expect(migration).toContain("'ovr_feedback_review_opened'");
    expect(migration).toContain("'ovr_feedback_review_completed'");
    expect(migration).toMatch(/else\s+v_created := true;\s+perform public\.patch26_write_document_event/s);
  });

  it('uses restrictive OVR-aware review visibility and browser DML guards', () => {
    expect(migration).toContain('review_triggers_f2_ovr_select_guard');
    expect(migration).toMatch(/trigger_type <> 'ovr'\s+or exists \(\s+select 1 from public\.ovr_reports/s);
    for (const operation of ['insert', 'update', 'delete']) {
      expect(migration).toContain(`review_triggers_f2_ovr_${operation}_guard`);
    }
  });

  it('fails on CAPA drift and uses historical-preserving OVR FK semantics', () => {
    expect(migration).toContain('F2_EXISTING_OVR_CAPA_LINK_DRIFT_DETECTED');
    expect(migration).toContain('foreign key (ovr_id) references public.ovr_reports(id) on delete restrict');
  });

  it('validates canonical CAPA project organization, source type, and exact OVR reference', () => {
    expect(migration).toContain("new.linked_entity_type <> 'capa'");
    expect(migration).toContain("v_project_source_type <> 'incident_ovr'");
    expect(migration).toContain('v_project_source_reference_id is distinct from new.ovr_id');
    expect(migration).toContain('F2_CAPA_CROSS_ORGANIZATION_DENIED');
  });

  it('makes CAPA sync idempotent, reactivates only inactive links, and fails closed on every other state', () => {
    const sync = migration.slice(
      migration.indexOf('create or replace function public.sync_ovr_corrective_action_capa_link'),
      migration.indexOf('create or replace view public.v_f2_ovr_governance_feedback'),
    );
    expect(migration).toContain('ovr_capa_evidence_links_f2_canonical_uniq');
    expect(migration).toContain('F2_CONFLICTING_CORRECTIVE_PROJECT_POINTERS');
    expect(sync).toMatch(/when 'active' then[\s\S]*return jsonb_build_object/);
    expect(sync).toMatch(/when 'inactive' then[\s\S]*set link_status = 'active'/);
    expect(sync).toContain("raise exception 'F2_CAPA_LINK_STATUS_CONFLICT'");
    expect(sync).not.toMatch(/if v_link\.link_status <> 'active'/);
    expect(sync).toContain("'reactivated', v_reactivated");
  });

  it('locks canonical CAPA browser writes and delegates reads to OVR RLS', () => {
    for (const operation of ['insert', 'update', 'delete', 'select']) {
      expect(migration).toContain(`ovr_capa_links_f2_${operation}_guard`);
    }
    expect(migration).toMatch(/linked_entity_type <> 'capa'\s+or exists \(\s+select 1 from public\.ovr_reports/s);
  });

  it('writes CAPA audit evidence only for creation or reactivation and associates reviews', () => {
    expect(migration).toContain('public.record_clinical_governance_event');
    expect(migration).toContain('ovr_corrective_action_capa_link_created');
    expect(migration).toContain('ovr_corrective_action_capa_link_reactivated');
    expect(migration).toContain('set corrective_action_project_id = v_project_id');
  });

  it('publishes the exact security-invoker non-narrative view', () => {
    expect(migration).toContain('create or replace view public.v_f2_ovr_governance_feedback');
    expect(migration).toContain('with (security_invoker = true)');
    for (const field of ['source_version_id', 'source_version_is_current', 'current_version_id', 'resulting_version_id', 'capa_link_id']) {
      expect(migration).toContain(field);
    }
    expect(migration).not.toMatch(/brief_description|incident_description|narrative/i);
  });
});

describe('GRC v1.4-F2 privileged-action Edge v17', () => {
  it('accepts only the exact five-key migration 211 capability contract', () => {
    expect(hasExactF2OvrGovernanceFeedbackCapability(F2_OVR_GOVERNANCE_FEEDBACK_CONTRACT)).toBe(true);
    expect(hasExactF2OvrGovernanceFeedbackCapability({ ...F2_OVR_GOVERNANCE_FEEDBACK_CONTRACT, extra: true })).toBe(false);
    expect(hasExactF2OvrGovernanceFeedbackCapability({ ...F2_OVR_GOVERNANCE_FEEDBACK_CONTRACT, schema_version: 210 })).toBe(false);
  });

  it('maps DB210 capability absence to the required migration 211 response', () => {
    expect(isF2Migration211CapabilityUnavailable({ code: 'PGRST202', message: 'missing' })).toBe(true);
    expect(edgeRoute).toContain('F2_MIGRATION_211_REQUIRED');
    expect(edgeRoute).toContain('409');
  });

  it('performs no migration 211 view or mutation access before exact capability validation', () => {
    const validation = edgeRoute.indexOf('hasExactF2OvrGovernanceFeedbackCapability(capabilityProbe.data)');
    expect(validation).toBeGreaterThan(edgeRoute.indexOf("'get_f2_ovr_governance_feedback_capabilities'"));
    for (const marker of [
      ".from('v_f2_ovr_governance_feedback')",
      "rpc('initiate_ovr_governance_feedback_review'",
      "rpc('complete_ovr_governance_feedback_review'",
      "rpc('sync_ovr_corrective_action_capa_link'",
    ]) expect(edgeRoute.indexOf(marker)).toBeGreaterThan(validation);
  });

  it('binds actor to JWT and rejects every identity or resource override', () => {
    for (const alias of ['actor_id', 'p_actor_id', 'user_id', 'organization_id', 'acting_user_id', 'authenticated_user_id', 'target_user_id', 'triggered_by', 'review_owner_id', 'document_id', 'version_id', 'project_id']) {
      expect(edgeRoute).toContain(`'${alias}'`);
    }
    expect(edgeRoute).toContain('p_actor_id: userData.user.id');
  });

  it('uses exact payload allowlists and does not accept project identity', () => {
    expect(edgeRoute).toContain("new Set(['ovr_id', 'document_link_id', 'due_date', 'rationale'])");
    expect(edgeRoute).toContain("new Set(['trigger_id', 'outcome', 'outcome_note'])");
    expect(edgeRoute).toContain("new Set(['ovr_id'])");
  });

  it('preflights active actor, target tenancy, exact global role, and historical link metadata', () => {
    const actorContext = edge.slice(
      edge.indexOf('const loadTrainingActorContext = async'),
      edge.indexOf("if (action === 'decide_sop_rollout_requirements')"),
    );
    const validation = edgeRoute.indexOf('hasExactF2OvrGovernanceFeedbackCapability(capabilityProbe.data)');
    const actorPreflight = edgeRoute.indexOf('loadTrainingActorContext(userData.user.id)');
    expect(edgeRoute).toContain('loadTrainingActorContext(userData.user.id)');
    expect(actorContext).toContain('!actorProfile.is_active');
    expect(actorContext).toContain("actorProfile.user_status !== 'active'");
    expect(actorPreflight).toBeGreaterThan(validation);
    for (const marker of [
      ".from('v_f1_ovr_governed_version_links')",
      ".from('v_f2_ovr_governance_feedback')",
      ".from('ovr_reports')",
    ]) expect(edgeRoute.indexOf(marker)).toBeGreaterThan(actorPreflight);
    expect(edgeRoute).toContain('hasExactF2GlobalGovernanceRole');
    expect(edgeRoute).toContain('is_historical_version');
    expect(edgeRoute).toContain('actorProfile.organization_id !== targetOrganizationId');
  });

  it('preserves F1, E2B2, E2B3 routes and JWT verification', () => {
    expect(edge).toContain('f1OvrGovernedVersionActions');
    expect(edge).toContain('publish_sop_training_obligations');
    expect(edge).toContain('reconcile_sop_training_population');
    expect(config).toMatch(/\[functions\.privileged-action\][\s\S]*?verify_jwt\s*=\s*true/);
  });

  it('maps malformed, authority, missing, and conflict errors deterministically', () => {
    expect(mapF2OvrGovernanceFeedbackError(new Error('F2_REVIEW_OUTCOME_INVALID')).status).toBe(400);
    expect(mapF2OvrGovernanceFeedbackError(new Error('F2_EXACT_GLOBAL_GOVERNANCE_ROLE_REQUIRED')).status).toBe(403);
    expect(mapF2OvrGovernanceFeedbackError(new Error('F2_OVR_NOT_FOUND')).status).toBe(404);
    expect(mapF2OvrGovernanceFeedbackError(new Error('F2_OPEN_REVIEW_VERSION_CONFLICT')).status).toBe(409);
    expect(mapF2OvrGovernanceFeedbackError(new Error('F2_CAPA_LINK_STATUS_CONFLICT')).status).toBe(409);
  });
});

describe('GRC v1.4-F2 OVR frontend', () => {
  const org = '00000000-0000-4000-8000-000000000001';
  const exactRole = { role: 'governance_admin', scope: 'global', is_active: true, organization_id: org };

  it('shows actions only for exact-org global canonical governance personas', () => {
    expect(hasExactF2GlobalGovernanceRole([exactRole], org)).toBe(true);
    expect(hasExactF2GlobalGovernanceRole([{ ...exactRole, organization_id: null }], org)).toBe(false);
    expect(hasExactF2GlobalGovernanceRole([{ ...exactRole, scope: 'department' }], org)).toBe(false);
    expect(canManageF2OvrGovernanceFeedback([{ role: 'compliance_officer', scope: 'global', organizationId: org }], org)).toBe(true);
    for (const role of ['executive', 'auditor', 'department_manager', 'employee']) {
      expect(canManageF2OvrGovernanceFeedback([{ role, scope: 'global', organizationId: org }], org)).toBe(false);
    }
  });

  it('renders incident and current versions separately with historical-source context', () => {
    expect(frontend).toContain("t('ovr.feedback.incidentSourceVersion')");
    expect(frontend).toContain("t('ovr.feedback.currentVersion')");
    expect(frontend).toContain('historical-source-badge');
    expect(frontend).toContain("t('ovr.feedback.historicalRevisionWarning')");
  });

  it('supplies EN and AR warnings for exact-source and current-base behavior', () => {
    expect(i18n).toContain('The review remains tied to the exact version associated with the OVR.');
    expect(i18n).toContain('Any new revision will be based on the current governed version.');
    expect(i18n).toContain('تظل المراجعة مرتبطة بالإصدار المحدد');
    expect(i18n).toContain('وسيعتمد أي إصدار جديد على الإصدار المحكوم الحالي');
  });

  it('uses privileged actions with minimal browser payloads and no direct governance DML', () => {
    expect(api).toContain("invokePrivilegedAction('initiate_ovr_governance_feedback_review'");
    expect(api).toContain("invokePrivilegedAction('complete_ovr_governance_feedback_review'");
    expect(api).toContain("invokePrivilegedAction('sync_ovr_corrective_action_capa_link', { ovr_id: ovrId })");
    expect(api).not.toMatch(/\.from\('governed_document_review_triggers'\)[\s\S]*?\.(insert|update|delete)/);
    expect(api).not.toMatch(/\.from\('ovr_capa_evidence_links'\)[\s\S]*?\.(insert|update|delete)/);
  });

  it('does not automatically initiate reviews or create projects and refreshes after mutation', () => {
    expect(frontend).not.toMatch(/useEffect\([\s\S]{0,500}initiateF2OvrGovernanceFeedbackReview/);
    expect(api).not.toContain('create_project');
    expect(frontend.match(/await governanceFeedback\.refresh\(\)/g)?.length).toBe(3);
  });
});
