import { describe, expect, it } from 'vitest';
import {
  assertNoRawRoleIdentifiers,
  buildStableCatalogFingerprint,
  normalizeCatalogLine,
  normalizeOwnerIdentifier,
  normalizeRoleIdentifiers,
} from '../../scripts/gate9-normalized-catalog-fingerprint.mjs';

const basePolicy = (roles: string, overrides = '') =>
  `policy|records|read_policy|cmd=r|permissive=true|roles=${roles}|using=organization_id = current_user_org_id()|check=${overrides}`;

describe('Gate 9 stable catalog fingerprint normalization', () => {
  it('normalizes fixture and hosted authenticated role OIDs to the same line and hash', () => {
    const fixture = buildStableCatalogFingerprint([basePolicy('16444')], { '16444': 'authenticated' });
    const hosted = buildStableCatalogFingerprint([basePolicy('16485')], { '16485': 'authenticated' });

    expect(fixture).toEqual(hosted);
    expect(fixture.canonical_lines[0]).toContain('roles=authenticated');
    expect(fixture.canonical_lines[0]).not.toMatch(/roles=\d+/);
  });

  it('deduplicates and sorts resolved role names', () => {
    const catalog = { '11': 'service_role', '12': 'authenticated', '13': 'authenticated' };
    expect(normalizeRoleIdentifiers(['11', '13', '12'], catalog)).toEqual([
      'authenticated',
      'service_role',
    ]);
    expect(normalizeCatalogLine(basePolicy('11,13,12'), catalog)).toContain(
      'roles=authenticated,service_role',
    );
  });

  it('uses stable owner names and rejects unresolved identifiers', () => {
    expect(normalizeOwnerIdentifier('10', { '10': 'postgres' })).toBe('postgres');
    expect(normalizeCatalogLine('table|records|owner=10|rls=true', { '10': 'postgres' }))
      .toBe('table|records|owner=postgres|rls=true');
    expect(() => normalizeRoleIdentifiers(['99999'], {})).toThrow('GATE9_UNRESOLVED_ROLE_IDENTIFIER');
    expect(() => normalizeOwnerIdentifier('99999', {})).toThrow('GATE9_UNRESOLVED_ROLE_IDENTIFIER');
  });

  it('fails closed for missing or empty policy roles', () => {
    expect(() => normalizeRoleIdentifiers([], {})).toThrow('GATE9_POLICY_ROLES_REQUIRED');
    expect(() => normalizeRoleIdentifiers([''], {})).toThrow('GATE9_EMPTY_ROLE_IDENTIFIER');
  });

  it('makes role names security-significant while ignoring role ordering', () => {
    const first = buildStableCatalogFingerprint([basePolicy('10,11')], {
      '10': 'authenticated',
      '11': 'service_role',
    });
    const reordered = buildStableCatalogFingerprint([basePolicy('11,10')], {
      '10': 'authenticated',
      '11': 'service_role',
    });
    const changed = buildStableCatalogFingerprint([basePolicy('10,11')], {
      '10': 'anon',
      '11': 'service_role',
    });

    expect(first.catalog_sha256).toBe(reordered.catalog_sha256);
    expect(first.catalog_sha256).not.toBe(changed.catalog_sha256);
  });

  it.each([
    ['command', basePolicy('10').replace('cmd=r', 'cmd=w')],
    ['permissiveness', basePolicy('10').replace('permissive=true', 'permissive=false')],
    ['using expression', basePolicy('10').replace('organization_id = current_user_org_id()', 'true')],
    ['with-check expression', basePolicy('10', 'organization_id = current_user_org_id()')],
    ['RLS state', `${basePolicy('10')}|rls=false`],
    ['ACL state', `${basePolicy('10')}|authenticated_insert=true`],
  ])('keeps %s security-significant', (_label, changedLine) => {
    const catalog = { '10': 'authenticated' };
    const baseline = buildStableCatalogFingerprint([basePolicy('10')], catalog);
    const changed = buildStableCatalogFingerprint([changedLine], catalog);
    expect(changed.catalog_sha256).not.toBe(baseline.catalog_sha256);
  });

  it('rejects raw role identifiers in the stable representation', () => {
    expect(() => assertNoRawRoleIdentifiers([basePolicy('16485')]))
      .toThrow('GATE9_RAW_ROLE_IDENTIFIER_IN_STABLE_FINGERPRINT');
    expect(() => assertNoRawRoleIdentifiers(['table|records|owner=10|rls=true']))
      .toThrow('GATE9_RAW_ROLE_IDENTIFIER_IN_STABLE_FINGERPRINT');
    expect(() => assertNoRawRoleIdentifiers([basePolicy('authenticated')])).not.toThrow();
  });
});
