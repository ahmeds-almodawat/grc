import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildProductionBridgeWorkdir } from '../../scripts/build-production-bridge-workdir.mjs';
import { buildReleaseBaselineWorkdir } from '../../scripts/build-release-baseline-workdir.mjs';
import { splitSqlStatements } from '../../scripts/generate-gate13b-migration187.mjs';
import {
  classifyReleaseLineageV3,
  reconcileProductionBridgeWorkdir,
} from '../../scripts/verify-release-migration-lineage-v3.mjs';
import { buildBaseline, buildCatalogFingerprint } from '../../scripts/gate11-immutable-baseline.mjs';

const root = resolve(__dirname, '../..');
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const versionNameDigest = (entries: ReadonlyArray<readonly [string, string]>) => sha256(Buffer.from(
  entries.map(([version, name]) => `${version}:${name}\n`).join(''),
));
const migration = (version: number) => readFileSync(join(
  root,
  `supabase/migrations/${version}_${version === 186
    ? 'legacy_role_scope_reconciliation'
    : 'legacy_runtime_and_post185_reconciliation'}.sql`,
));

describe('Gate 13B legacy bridge contract', () => {
  it('binds migration 187 to the exact immutable 181-185 sources', () => {
    const sql187 = migration(187).toString('utf8');
    for (const [version, name] of [
      [181, 'patch83tu_catalog_contract_attestation'],
      [182, 'legacy_public_table_rls_and_privilege_hardening'],
      [183, 'security_advisor_rls_reconciliation'],
      [184, 'security_definer_search_path_and_acl_hardening'],
      [185, 'pilot_go_no_go_anonymous_policy_reconciliation'],
    ] as const) {
      const source = readFileSync(join(root, `supabase/migrations/${version}_${name}.sql`));
      expect(sql187).toContain(`${version}: supabase/migrations/${version}_${name}.sql sha256=${sha256(source)}`);
    }
    expect(sql187).toContain('PATCH187_UNKNOWN_OR_MIXED_MIGRATION_LINEAGE');
    expect(sql187).toContain('PATCH187_TRUTHFUL_LEGACY_PROVENANCE_FAILED');
    expect(sql187).toContain('PATCH187_TRANSITIONAL_SUPER_ADMIN_CONTRACT_MISMATCH');
    expect(sql187).toContain("mandatory_super_admin_password_rotation = 'required'");
    expect(sql187).toContain("transitional_credential_state = 'existing_password_rotation_pending'");
    expect(sql187).toContain('transitional_database_credential_version = 0');
    expect(sql187).toContain('transitional_auth_credential_version = 0');
    expect(sql187).toContain('transitional_session_count = 0');
    expect(sql187).toContain('transitional_unrevoked_refresh_token_count = 0');
    expect(sql187).toContain('password_rotation_completed_claimed = false');
    expect(sql187).toMatch(/auth\.sessions[\s\S]*auth\.refresh_tokens/);
    expect(sql187).not.toMatch(/set\s+credential_state\s*=\s*'active'/i);
    expect(sql187).not.toMatch(/update\s+auth\.users/i);
    expect(sql187).not.toContain('zbrjjecpsrzposhuarcn');
    expect(sql187).not.toContain('zghsgzrdwbqdrpuxanac');
  });

  it('keeps the SQL splitter deterministic for functions, comments and quoted semicolons', () => {
    const sql = `-- one\nselect ';'::text;\ndo $x$ begin perform 1; end $x$;\nselect 3;`;
    expect(splitSqlStatements(sql)).toHaveLength(3);
  });

  it('normalizes PostgreSQL 17 random dump restriction guards out of catalog hashes', () => {
    const left = '\\restrict random-a\ncreate table public.example(id integer);\n\\unrestrict random-a\n';
    const right = '\\restrict random-b\ncreate table public.example(id integer);\n\\unrestrict random-b\n';
    expect(buildCatalogFingerprint(left).canonical_sql_sha256)
      .toBe(buildCatalogFingerprint(right).canonical_sql_sha256);
  });

  it('does not reproduce the platform-owned public schema in an application baseline', () => {
    const baseline = buildBaseline('create schema public;\ncomment on schema public is \'standard\';\ncreate table public.example(id integer);', {
      catalogSha256: 'a'.repeat(64), baselineVersion: 3, migrationCeiling: 187,
      firstFutureMigration: 188, tableCount: 1, viewCount: 0, functionCount: 0, policyCount: 0,
    });
    expect(baseline).not.toContain('create schema public;');
    expect(baseline).not.toContain('comment on schema public');
    expect(baseline).toContain('create table public.example');
  });

  it('builds the exact accepted historical prefix followed only by 186 and 187', () => {
    const temp = mkdtempSync(join(tmpdir(), 'gate13b-workdir-test-'));
    const repo = join(temp, 'repo');
    const migrationsDir = join(repo, 'supabase/migrations');
    mkdirSync(migrationsDir, { recursive: true });
    const history = [
      ['001', 'first'],
      ['002', 'second'],
      ['0165', 'special'],
      ['180', 'last'],
    ] as const;
    const releaseBlobs = new Map<string, Buffer>();
    for (const [version, name] of history) {
      const bytes = Buffer.from(`select ${Number(version)};\n`);
      const path = `supabase/migrations/${version}_${name}.sql`;
      writeFileSync(join(repo, path), bytes);
      releaseBlobs.set(path, bytes);
    }
    const sql186 = 'select 186;\n';
    const sql187 = 'select 187;\n';
    writeFileSync(join(migrationsDir, '181_forbidden.sql'), 'select 181;\n');
    writeFileSync(join(migrationsDir, '186_legacy_role_scope_reconciliation.sql'), sql186);
    writeFileSync(join(migrationsDir, '187_legacy_runtime_and_post185_reconciliation.sql'), sql187);
    writeFileSync(join(migrationsDir, '188_shared.sql'), 'select 188;\n');
    writeFileSync(join(repo, 'supabase/config.toml'), 'project_id = "source"\n[db.seed]\nenabled = true\n');
    const output = join(temp, 'output');
    const baseOptions = {
      repoRoot: repo, migrationsDir, projectId: 'gate13b-test',
      targetProjectRef: 'abcdefghijklmnopqrst',
      releaseCommit: 'a'.repeat(40),
      releaseBlobReader: (path: string) => releaseBlobs.get(path)!,
      cloneLedgerVersionNameSha256: versionNameDigest(history.map(([version, name]) => [version, name])),
      lineageContract: {
        history_shapes: {
          production_bridge_lineage: [...history.map(([version]) => version), '186', '187'],
        },
      },
      hashManifest: {
        schema_version: 'gate13b-migration-hashes-v1',
        release_manifest_sha256: 'release', normalized_target_catalog_sha256: 'catalog',
        migrations: [
          { version: '186', path: 'supabase/migrations/186_legacy_role_scope_reconciliation.sql', sha256: sha256(sql186), bytes: Buffer.byteLength(sql186) },
          { version: '187', path: 'supabase/migrations/187_legacy_runtime_and_post185_reconciliation.sql', sha256: sha256(sql187), bytes: Buffer.byteLength(sql187) },
        ],
      },
    };
    const result = buildProductionBridgeWorkdir({ ...baseOptions, output });
    expect(result.migration_files.map((entry) => entry.path)).toEqual([
      'supabase/migrations/001_first.sql',
      'supabase/migrations/002_second.sql',
      'supabase/migrations/0165_special.sql',
      'supabase/migrations/180_last.sql',
      'supabase/migrations/186_legacy_role_scope_reconciliation.sql',
      'supabase/migrations/187_legacy_runtime_and_post185_reconciliation.sql',
    ]);
    expect(result.intentionally_absent_versions).toEqual([181, 182, 183, 184, 185]);
    expect(result.historical_migration_count).toBe(4);
    expect(result.bridge_migration_count).toBe(2);
    expect(result.total_migration_count).toBe(6);
    expect(result.migration_files.map((entry) => entry.source_classification)).toEqual([
      'historical_prefix', 'historical_prefix', 'historical_prefix', 'historical_prefix',
      'legacy_bridge', 'legacy_bridge',
    ]);
    expect(readFileSync(join(output, 'supabase/config.toml'), 'utf8')).toContain('enabled = false');
    expect(() => buildProductionBridgeWorkdir({
      ...baseOptions,
      output: join(temp, 'incomplete'),
      futureMigrationsDir: migrationsDir,
    })).toThrow('GATE13BR_FUTURE_MIGRATIONS_REFUSED');
    releaseBlobs.set('supabase/migrations/002_second.sql', Buffer.from('select 999;\n'));
    expect(() => buildProductionBridgeWorkdir({
      ...baseOptions,
      output: join(temp, 'drifted'),
    })).toThrow('GATE13BR_HISTORICAL_MIGRATION_HASH_DRIFT:002');
    for (const prohibitedRef of ['zbrjjecpsrzposhuarcn', 'zghsgzrdwbqdrpuxanac']) {
      expect(() => buildProductionBridgeWorkdir({
        ...baseOptions,
        output: join(temp, `prohibited-${prohibitedRef}`),
        targetProjectRef: prohibitedRef,
      })).toThrow('GATE13BR_BRIDGE_TARGET_REF_REFUSED');
    }
  });

  it('reconciles the exact remote prefix and rejects incomplete or mixed workdirs', () => {
    const remote = ['001', '002', '0165', '180'];
    expect(reconcileProductionBridgeWorkdir({
      remoteVersions: remote,
      workdirVersions: [...remote, '186', '187'],
      pendingVersions: ['186', '187'],
    })).toMatchObject({
      result: 'BRIDGE WORKDIR LEDGER RECONCILED',
      remote_historical_count: 4,
      workdir_historical_count: 4,
      workdir_total_count: 6,
      exact_order_match: true,
    });
    expect(() => reconcileProductionBridgeWorkdir({
      remoteVersions: remote,
      workdirVersions: ['186', '187'],
      pendingVersions: ['186', '187'],
    })).toThrow('GATE13BR_REMOTE_HISTORY_MISSING_FROM_WORKDIR');
    expect(() => reconcileProductionBridgeWorkdir({
      remoteVersions: remote,
      workdirVersions: ['001', '002', '180', '186', '187'],
      pendingVersions: ['186', '187'],
    })).toThrow('GATE13BR_REMOTE_HISTORY_MISSING_FROM_WORKDIR');
    expect(() => reconcileProductionBridgeWorkdir({
      remoteVersions: remote,
      workdirVersions: [...remote, '181', '186', '187'],
      pendingVersions: ['186', '187'],
    })).toThrow('GATE13BR_WORKDIR_VERSION_SET_REFUSED');
    expect(() => reconcileProductionBridgeWorkdir({
      remoteVersions: remote,
      workdirVersions: [...remote, '186', '187'],
      pendingVersions: ['186'],
    })).toThrow('GATE13BR_PENDING_VERSION_SET_REFUSED');
  });

  it('does not use migration repair or manually mutate migration history', () => {
    const sources = [
      readFileSync(join(root, 'scripts/build-production-bridge-workdir.mjs'), 'utf8'),
      readFileSync(join(root, 'scripts/verify-release-migration-lineage-v3.mjs'), 'utf8'),
    ].join('\n');
    expect(sources).not.toMatch(/supabase\s+migration\s+repair/i);
    expect(sources).not.toMatch(
      /(?:insert\s+into|update|delete\s+from)\s+supabase_migrations\.schema_migrations/i,
    );
    expect(sources).not.toMatch(/supabase\s+db\s+pull/i);
  });

  it('classifies exact modern, bridge and baseline-v3 histories and rejects mixing', () => {
    const manifest = { normalized_target_catalog_sha256: 'catalog187' };
    const manifestText = `${JSON.stringify(manifest)}\n`;
    const contract = {
      release_manifest_sha256: sha256(manifestText),
      normalized_post187_catalog_sha256: 'catalog187',
      migration_hashes: { '186': 'h186', '187': 'h187' },
      baseline_v3_sql_sha256: 'baseline187',
      history_shapes: {
        modern_legacy_lineage: ['180','181','182','183','184','185','186','187'],
        production_bridge_lineage: ['180','186','187'],
        baseline_v3_lineage: ['187'],
      },
    };
    const common = {
      release_manifest_sha256: contract.release_manifest_sha256,
      normalized_catalog_sha256: 'catalog187',
      migration_hashes: contract.migration_hashes,
    };
    expect(classifyReleaseLineageV3({ evidence: {
      ...common, migration_versions: contract.history_shapes.modern_legacy_lineage,
      lineage_attestation: 'modern_legacy_lineage', requested_workdir: 'historical-modern',
      credential_transition_state: 'not_applicable',
    }, manifest, manifestText, contract }).workdir).toBe('historical-modern');
    expect(classifyReleaseLineageV3({ evidence: {
      ...common, migration_versions: contract.history_shapes.production_bridge_lineage,
      lineage_attestation: 'production_bridge_lineage', requested_workdir: 'production-bridge',
      credential_transition_state: 'mandatory_rotation_required',
    }, manifest, manifestText, contract }).workdir).toBe('production-bridge');
    expect(classifyReleaseLineageV3({ evidence: {
      ...common, migration_versions: contract.history_shapes.baseline_v3_lineage,
      lineage_attestation: 'baseline_v3_lineage', requested_workdir: 'baseline-v3',
      baseline_sql_sha256: 'baseline187',
      credential_transition_state: 'not_initialized',
    }, manifest, manifestText, contract }).workdir).toBe('baseline-v3');
    expect(() => classifyReleaseLineageV3({ evidence: {
      ...common, migration_versions: ['180','181','186','187'],
      lineage_attestation: 'production_bridge_lineage', requested_workdir: 'production-bridge',
    }, manifest, manifestText, contract })).toThrow('GATE13B_UNKNOWN_MIXED_OR_DRIFTED_LINEAGE');
    expect(() => classifyReleaseLineageV3({ evidence: {
      ...common, migration_versions: ['180','186','187'],
      requested_migration_versions: ['181'], lineage_attestation: 'production_bridge_lineage',
      requested_workdir: 'production-bridge',
    }, manifest, manifestText, contract })).toThrow('GATE13B_POST187_HISTORICAL_MIGRATION_APPLICATION_REFUSED');
    expect(() => classifyReleaseLineageV3({ evidence: {
      ...common, migration_versions: contract.history_shapes.production_bridge_lineage,
      lineage_attestation: 'production_bridge_lineage', requested_workdir: 'historical-modern',
    }, manifest, manifestText, contract })).toThrow('GATE13B_BRIDGE_LINEAGE_ATTESTATION_MISMATCH');
    expect(() => classifyReleaseLineageV3({ evidence: {
      ...common, migration_versions: contract.history_shapes.modern_legacy_lineage,
      lineage_attestation: 'modern_legacy_lineage', requested_workdir: 'production-bridge',
    }, manifest, manifestText, contract })).toThrow('GATE13B_MODERN_LINEAGE_ATTESTATION_MISMATCH');
    expect(() => classifyReleaseLineageV3({ evidence: {
      ...common, migration_hashes: { ...common.migration_hashes, '187': 'altered' },
      migration_versions: contract.history_shapes.production_bridge_lineage,
      lineage_attestation: 'production_bridge_lineage', requested_workdir: 'production-bridge',
    }, manifest, manifestText, contract })).toThrow('GATE13B_MIGRATION_HASH_DRIFT:187');
    expect(() => classifyReleaseLineageV3({ evidence: {
      ...common, migration_versions: contract.history_shapes.baseline_v3_lineage,
      lineage_attestation: 'baseline_v3_lineage', requested_workdir: 'baseline-v3',
      baseline_sql_sha256: 'to_be_generated_after_authorized_clone_rehearsal',
    }, manifest, manifestText, contract: {
      ...contract,
      baseline_v3_sql_sha256: 'to_be_generated_after_authorized_clone_rehearsal',
    } })).toThrow('GATE13B_BASELINE_V3_BINDING_FAILED');
    expect(() => classifyReleaseLineageV3({ evidence: {
      ...common, migration_versions: contract.history_shapes.production_bridge_lineage,
      lineage_attestation: 'production_bridge_lineage', requested_workdir: 'production-bridge',
      credential_transition_state: 'not_applicable',
    }, manifest, manifestText, contract })).toThrow('GATE13B_CREDENTIAL_TRANSITION_STATE_MISMATCH');
  });

  it('keeps migration 186 identity-free and narrowly scoped', () => {
    const sql186 = migration(186).toString('utf8');
    expect(sql186).toContain("ur.role::text = 'executive'");
    expect(sql186).toContain("set scope = 'global'::public.access_scope");
    expect(sql186).toContain('department_id = null');
    expect(sql186).toContain("message = 'PATCH186_LEGACY_ROLE_PRESTATE_MISMATCH'");
    expect(sql186).not.toMatch(/update\s+auth\./i);
    expect(sql186).not.toMatch(/(access_token|refresh_token|password)\s*=/i);
  });

  it('materializes baseline V3 only at 187 with future migrations starting at 188', () => {
    const temp = mkdtempSync(join(tmpdir(), 'gate13br3-baseline-workdir-'));
    const repo = join(temp, 'repo');
    const output = join(temp, 'output');
    const future = join(repo, 'future');
    mkdirSync(future, { recursive: true });
    const baselinePath = join(repo, 'baseline-v3.sql');
    const manifestPath = join(repo, 'manifest-v3.json');
    const configPath = join(repo, 'config.toml');
    const sql = 'select 187;\n';
    writeFileSync(baselinePath, sql);
    writeFileSync(manifestPath, `${JSON.stringify({
      sql_sha256: sha256(sql), release_status: 'release_approved',
      source_migration_ceiling: 187, first_future_migration_number: 188,
      normalized_target_catalog_sha256: 'catalog187',
    })}\n`);
    writeFileSync(configPath, 'project_id = "source"\n[db.seed]\nenabled = true\n');
    writeFileSync(join(future, '187_historical.sql'), 'select 187;\n');
    writeFileSync(join(future, '188_shared.sql'), 'select 188;\n');
    const result = buildReleaseBaselineWorkdir({
      baselinePath, manifestPath, configPath, output, repoRoot: repo,
      futureMigrationsDir: future, projectId: 'gate13br3-baseline-test',
    });
    expect(result.lineage).toBe('baseline_v3_lineage');
    expect(result.first_future_migration).toBe(188);
    expect(result.migration_files.map((entry) => entry.name))
      .toEqual(['187_grc_platform_baseline_v3.sql', '188_shared.sql']);
  });
});
