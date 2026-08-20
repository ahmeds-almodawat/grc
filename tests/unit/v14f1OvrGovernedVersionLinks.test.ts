import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  F1_OVR_GOVERNED_VERSION_LINK_CONTRACT,
  hasExactF1GlobalGovernanceRole,
  hasExactF1OvrGovernedVersionCapability,
  isF1Migration210CapabilityUnavailable,
  mapF1OvrGovernedVersionError,
} from '../../supabase/functions/_shared/v14f1OvrGovernedVersionBridge.ts';
import { canManageF1OvrGovernedVersionLinks } from '../../src/lib/f1OvrGovernedVersionModel';

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const migration = source('supabase/migrations/210_f1_ovr_governed_version_links.sql');
const edge = source('supabase/functions/privileged-action/index.ts');
const config = source('supabase/config.toml');
const frontend = source('src/pages/OVR.tsx');
const frontendApi = source('src/lib/f1OvrGovernedVersionApi.ts');
const translations = source('src/i18n/I18nContext.tsx');
const edgeRoute = edge.match(
  /if \(f1OvrGovernedVersionActions\.has\(action\)\) \{[\s\S]*?\n  if \(action === 'record_document_acknowledgment'\)/,
)?.[0] ?? '';

describe('GRC v1.4-F1 database exact-version contract', () => {
  it('reuses document_links and creates only Migration210', () => {
    expect(migration).toContain('public.document_links');
    expect(migration).not.toMatch(/create table[^;]+ovr[^;]+link/i);
    expect(fs.existsSync(path.join(root, 'supabase/migrations/211_f1_ovr_governed_version_links.sql'))).toBe(false);
  });

  it('fails closed on existing drift and enforces shape, uniqueness, and trigger validation', () => {
    expect(migration).toContain('F1_EXISTING_OVR_LINK_DRIFT_DETECTED');
    expect(migration).toContain('document_links_f1_ovr_shape_check');
    expect(migration).toContain('document_links_f1_ovr_exact_version_uniq');
    expect(migration).toContain('trg_validate_f1_ovr_governed_version_link');
    for (const error of [
      'F1_OVR_NOT_FOUND',
      'F1_DOCUMENT_VERSION_NOT_FOUND',
      'F1_DOCUMENT_VERSION_MISMATCH',
      'F1_CROSS_ORGANIZATION_LINK_DENIED',
      'F1_POLICY_OR_SOP_REQUIRED',
      'F1_APPROVED_VERSION_REQUIRED',
      'F1_IMMUTABLE_VERSION_REQUIRED',
    ]) expect(migration).toContain(error);
  });

  it('allows approved locked current or historical versions without current retargeting', () => {
    expect(migration).toContain('v.approved_at is not null');
    expect(migration).toContain('v.locked_at is not null');
    expect(migration).not.toMatch(/where[\s\S]{0,200}is_current_version\s*=\s*true/i);
    expect(migration).toContain('l.version_id');
    expect(migration).toContain('v.superseded_by_version_id');
    expect(migration).toContain('is_historical_version');
  });

  it('blocks every authenticated OVR mutation shape while preserving non-OVR rows', () => {
    for (const operation of ['insert', 'update', 'delete']) {
      expect(migration).toContain(`as restrictive for ${operation} to authenticated`);
    }
    expect(migration.match(/linked_item_type <> 'ovr'/g)?.length).toBeGreaterThanOrEqual(5);
    expect(migration).toContain("linked_item_type = 'ovr'");
  });

  it('makes F1 SELECT depend on the existing OVR RLS path and keeps the Patch83U gate intact', () => {
    expect(migration).toContain('document_links_f1_ovr_select_guard');
    expect(migration).toMatch(/exists \(\s*select 1\s*from public\.ovr_reports o/);
    expect(migration).not.toContain('drop policy if exists patch83u_credential_gate');
  });

  it('uses security-invoker views with exact version metadata', () => {
    expect(migration.match(/with \(security_invoker = true\)/g)).toHaveLength(2);
    for (const field of [
      'version_id', 'version_number', 'version_label', 'approved_at',
      'effective_date', 'is_current_version', 'superseded_by_version_id',
    ]) expect(migration).toContain(field);
  });

  it('keeps capability/link/unlink RPCs service-role only with fixed search paths', () => {
    for (const fn of [
      'get_f1_ovr_governed_version_link_capabilities',
      'link_ovr_governed_document_version',
      'unlink_ovr_governed_document_version',
    ]) {
      expect(migration).toContain(`function public.${fn}`);
      expect(migration).toContain(`grant execute on function public.${fn}`);
    }
    expect(migration.match(/security definer/g)?.length).toBeGreaterThanOrEqual(4);
    expect(migration.match(/set search_path = public, pg_temp/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('requires exact active global same-org governance authority with no null fallback', () => {
    for (const role of ['super_admin', 'governance_admin', 'compliance_officer']) {
      expect(migration).toContain(`'${role}'`);
    }
    expect(migration).toContain("ur.scope::text = 'global'");
    expect(migration).toContain('ur.organization_id = p_organization_id');
    expect(migration).not.toMatch(/ur\.organization_id is null\s+or/i);
  });

  it('is idempotent and audits only new links, then audits unlink before delete', () => {
    expect(migration).toContain('on conflict (linked_item_id, version_id)');
    expect(migration).toContain("'created', v_created");
    expect(migration).toContain('ovr_governed_version_linked');
    expect(migration).toContain('ovr_governed_version_link_removed');
    expect(migration.indexOf("'ovr_governed_version_link_removed'")).toBeLessThan(
      migration.indexOf('delete from public.document_links where id = p_link_id'),
    );
  });
});

describe('GRC v1.4-F1 privileged-action Edge v16', () => {
  it('recognizes only the exact Migration210 capability contract', () => {
    expect(hasExactF1OvrGovernedVersionCapability(F1_OVR_GOVERNED_VERSION_LINK_CONTRACT)).toBe(true);
    expect(hasExactF1OvrGovernedVersionCapability({
      ...F1_OVR_GOVERNED_VERSION_LINK_CONTRACT,
      schema_version: 209,
    })).toBe(false);
    expect(hasExactF1OvrGovernedVersionCapability({
      ...F1_OVR_GOVERNED_VERSION_LINK_CONTRACT,
      extra: true,
    })).toBe(false);
  });

  it('maps DB209 capability absence to the required 409 contract', () => {
    expect(isF1Migration210CapabilityUnavailable({
      code: 'PGRST202',
      message: 'Could not find get_f1_ovr_governed_version_link_capabilities',
    })).toBe(true);
    expect(edgeRoute).toContain('F1_MIGRATION_210_REQUIRED');
    expect(edgeRoute).toContain('409');
  });

  it('does no DB210 read or mutation before capability validation', () => {
    const capability = edgeRoute.indexOf("'get_f1_ovr_governed_version_link_capabilities'");
    const capabilityValidation = edgeRoute.indexOf('hasExactF1OvrGovernedVersionCapability');
    for (const marker of [
      ".from('v_f1_ovr_governed_version_links')",
      "rpc('link_ovr_governed_document_version'",
      "rpc('unlink_ovr_governed_document_version'",
    ]) expect(edgeRoute.indexOf(marker)).toBeGreaterThan(capabilityValidation);
    expect(capabilityValidation).toBeGreaterThan(capability);
  });

  it('binds actor identity and rejects aliases or unknown keys', () => {
    expect(edgeRoute).toContain('p_actor_id: userData.user.id');
    for (const alias of [
      'actor_id', 'p_actor_id', 'user_id', 'organization_id', 'document_id',
      'acting_user_id', 'authenticated_user_id', 'target_user_id',
    ]) expect(edgeRoute).toContain(`'${alias}'`);
    expect(edgeRoute).toContain("new Set(['ovr_id', 'version_id', 'note'])");
    expect(edgeRoute).toContain("new Set(['link_id', 'reason'])");
  });

  it('enforces exact global active same-org roles and denies all noncanonical personas', () => {
    const org = 'org-a';
    for (const role of ['super_admin', 'governance_admin', 'compliance_officer']) {
      expect(hasExactF1GlobalGovernanceRole([
        { role, scope: 'global', is_active: true, organization_id: org },
      ], org)).toBe(true);
    }
    for (const role of ['employee', 'department_manager', 'division_head', 'executive', 'auditor']) {
      expect(hasExactF1GlobalGovernanceRole([
        { role, scope: 'global', is_active: true, organization_id: org },
      ], org)).toBe(false);
    }
    expect(hasExactF1GlobalGovernanceRole([
      { role: 'governance_admin', scope: 'global', is_active: true, organization_id: null },
    ], org)).toBe(false);
    expect(hasExactF1GlobalGovernanceRole([
      { role: 'governance_admin', scope: 'global', is_active: true, organization_id: 'org-b' },
    ], org)).toBe(false);
  });

  it('maps validation, authority, missing resources, and conflicts deterministically', () => {
    expect(mapF1OvrGovernedVersionError(new Error('REQUIRED_REASON'))).toMatchObject({ status: 400 });
    expect(mapF1OvrGovernedVersionError(new Error('F1_EXACT_GLOBAL_GOVERNANCE_ROLE_REQUIRED'))).toMatchObject({ status: 403 });
    expect(mapF1OvrGovernedVersionError(new Error('F1_OVR_NOT_FOUND'))).toMatchObject({ status: 404 });
    expect(mapF1OvrGovernedVersionError(new Error('F1_APPROVED_VERSION_REQUIRED'))).toMatchObject({ status: 409 });
  });

  it('preserves E2B2/E2B3 routes and verify_jwt=true', () => {
    for (const action of [
      'publish_sop_training_obligations',
      'reconcile_sop_training_population',
      'record_document_acknowledgment',
    ]) expect(edge).toContain(action);
    expect(config).toMatch(/\[functions\.privileged-action\][\s\S]*?verify_jwt\s*=\s*true/);
  });
});

describe('GRC v1.4-F1 OVR frontend', () => {
  it('renders exact version and current, historical, or superseded state', () => {
    expect(frontend).toContain("t('ovr.governedVersions.title')");
    expect(frontend).toContain("t('ovr.governedVersions.exactVersion')");
    expect(frontend).toContain("? 'superseded'");
    expect(frontend).toContain("? 'historical'");
    expect(frontend).toContain(": 'current'");
  });

  it('shows mutation controls only to exact-org global governance candidates', () => {
    const org = 'org-a';
    expect(canManageF1OvrGovernedVersionLinks([
      { role: 'governance_admin', scope: 'global', organizationId: org },
    ], org)).toBe(true);
    for (const role of ['executive', 'auditor', 'department_manager', 'employee']) {
      expect(canManageF1OvrGovernedVersionLinks([
        { role, scope: 'global', organizationId: org },
      ], org)).toBe(false);
    }
    expect(canManageF1OvrGovernedVersionLinks([
      { role: 'super_admin', scope: 'global', organizationId: null },
    ], org)).toBe(false);
  });

  it('uses security-invoker views for reads and privileged action for exact payload mutations', () => {
    expect(frontendApi).toContain(".from('v_f1_ovr_governed_version_links')");
    expect(frontendApi).toContain(".from('v_f1_linkable_governed_document_versions')");
    expect(frontendApi).toContain("invokePrivilegedAction('link_ovr_governed_document_version'");
    expect(frontendApi).toContain("invokePrivilegedAction('unlink_ovr_governed_document_version'");
    expect(frontendApi).toContain('ovr_id: input.ovrId');
    expect(frontendApi).toContain('version_id: input.versionId');
    expect(frontendApi).toContain('link_id: input.linkId');
    expect(frontendApi).toContain('reason: input.reason.trim()');
    expect(frontendApi).not.toMatch(/from\(['"]document_links['"]\)\s*\.(insert|update|delete)/);
  });

  it('requires deliberate selection, reason, immutable warning EN/AR, and refreshes both mutations', () => {
    expect(frontend).toContain("useState('')");
    expect(frontend).toContain('type="radio"');
    expect(frontend).not.toContain('setSelectedGovernedVersionId(filteredLinkableGovernedVersions[0]');
    expect(frontend).toContain('governedVersionRemoveReason.trim().length < 3');
    expect(frontend.match(/await governedVersionLinks\.refresh\(\)/g)).toHaveLength(2);
    expect(translations).toContain('This relationship records the exact governed version and will not automatically move when the document is revised.');
    expect(translations).toContain('يسجل هذا الارتباط الإصدار المحكوم المحدد ولن ينتقل تلقائياً عند تعديل المستند.');
  });
});
