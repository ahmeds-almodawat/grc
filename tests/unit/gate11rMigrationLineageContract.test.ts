import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildReleaseBaselineWorkdir } from '../../scripts/build-release-baseline-workdir.mjs';
import { classifyReleaseLineage } from '../../scripts/verify-release-migration-lineage.mjs';

const manifest = {
  sql_sha256: 'baseline-sql',
  normalized_target_catalog_sha256: 'catalog',
};
const manifestText = `${JSON.stringify(manifest)}\n`;
const manifestHash = createHash('sha256').update(manifestText).digest('hex');
const contract = {
  baseline_manifest_sha256: manifestHash,
  baseline_sql_sha256: 'baseline-sql',
  normalized_catalog_sha256: 'catalog',
  legacy_history_versions: ['001', '173', '174', '175', '176', '177', '178', '179', '180', '181', '182', '183', '184', '185'],
};
const common = { normalized_catalog_sha256: 'catalog', baseline_manifest_sha256: manifestHash };

describe('Gate 11R migration lineage contract', () => {
  it('classifies exact legacy history and the shared future chain', () => {
    expect(classifyReleaseLineage({ evidence: { ...common, migration_versions: [...contract.legacy_history_versions, '186'], expected_forward_versions: ['186'] }, manifest, manifestText, contract }).lineage)
      .toBe('legacy_upgrade_lineage');
  });

  it('classifies baseline history only when the baseline SQL is bound', () => {
    expect(classifyReleaseLineage({ evidence: { ...common, migration_versions: ['185', '186'], expected_forward_versions: ['186'], baseline_sql_sha256: 'baseline-sql' }, manifest, manifestText, contract }).lineage)
      .toBe('baseline_v2_lineage');
  });

  it.each([
    ['wrong manifest hash', { ...common, baseline_manifest_sha256: 'wrong', migration_versions: ['185'], baseline_sql_sha256: 'baseline-sql' }],
    ['wrong catalog', { ...common, normalized_catalog_sha256: 'wrong', migration_versions: ['185'], baseline_sql_sha256: 'baseline-sql' }],
    ['wrong baseline SQL', { ...common, migration_versions: ['185'], baseline_sql_sha256: 'wrong' }],
    ['unexpected history', { ...common, migration_versions: ['184', '185'], baseline_sql_sha256: 'baseline-sql' }],
  ])('refuses %s', (_label, evidence) => {
    expect(() => classifyReleaseLineage({ evidence, manifest, manifestText, contract })).toThrow(/GATE11R_/);
  });

  it('refuses a production reference recursively', () => {
    expect(() => classifyReleaseLineage({ evidence: { ...common, migration_versions: ['185'], baseline_sql_sha256: 'baseline-sql', nested: { ref: 'zbrjjecpsrzposhuarcn' } }, manifest, manifestText, contract }))
      .toThrow('GATE11R_PRODUCTION_REFERENCE_REFUSED');
  });

  it('materializes only baseline 185 and future migrations outside the repository', () => {
    const root = mkdtempSync(join(tmpdir(), 'gate11r-lineage-test-'));
    const repo = join(root, 'repo');
    const future = join(repo, 'migrations');
    const output = join(root, 'output');
    mkdirSync(future, { recursive: true });
    const baselinePath = join(repo, 'baseline.sql');
    const manifestPath = join(repo, 'manifest.json');
    const configPath = join(repo, 'config.toml');
    const sql = 'select 185;\n';
    writeFileSync(baselinePath, sql);
    writeFileSync(manifestPath, `${JSON.stringify({
      sql_sha256: createHash('sha256').update(sql).digest('hex'),
      release_status: 'validation_pending',
      source_migration_ceiling: 185,
      first_future_migration_number: 186,
      normalized_target_catalog_sha256: 'catalog',
    })}\n`);
    writeFileSync(configPath, 'project_id = "source"\n[db.seed]\nenabled = true\n');
    writeFileSync(join(future, '001_historical.sql'), 'select 1;\n');
    writeFileSync(join(future, '186_future.sql'), 'select 186;\n');
    const result = buildReleaseBaselineWorkdir({ baselinePath, manifestPath, configPath, output, repoRoot: repo, futureMigrationsDir: future, projectId: 'gate11r-test', allowCandidate: true });
    expect(result.migration_files.map((entry) => entry.name)).toEqual(['185_grc_platform_baseline_v2.sql', '186_future.sql']);
    expect(readFileSync(join(output, 'supabase', 'config.toml'), 'utf8')).toContain('enabled = false');
  });
});
