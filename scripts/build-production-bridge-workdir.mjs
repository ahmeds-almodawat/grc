import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const BRIDGE_NAMES = [
  '186_legacy_role_scope_reconciliation.sql',
  '187_legacy_runtime_and_post185_reconciliation.sql',
];
const PROHIBITED_REFS = new Set([
  'zbrjjecpsrzposhuarcn',
  'zghsgzrdwbqdrpuxanac',
]);

const assertOutsideRepo = (repoRoot, output) => {
  const rel = relative(repoRoot, output);
  if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))) {
    throw new Error('GATE13BR_BRIDGE_WORKDIR_MUST_BE_OUTSIDE_REPOSITORY');
  }
};

const assertSafeTargetRef = (value) => {
  const normalized = String(value ?? '').trim();
  if (!/^[a-z]{20}$/.test(normalized) || PROHIBITED_REFS.has(normalized)) {
    throw new Error('GATE13BR_BRIDGE_TARGET_REF_REFUSED');
  }
  return normalized;
};

const assertSafeText = (value) => {
  const prohibited = [
    /zbrjjecpsrzposhuarcn/i,
    /zghsgzrdwbqdrpuxanac/i,
    /sb_secret_[A-Za-z0-9_-]+/,
    /service_role\s*[:=]\s*[A-Za-z0-9._-]{20,}/i,
    /postgres(?:ql)?:\/\/[^\s'";]+/i,
    /(?:DATABASE_URL|DB_PASSWORD|JWT_SECRET|SERVICE_ROLE_KEY)\s*[:=]/i,
  ];
  if (prohibited.some((pattern) => pattern.test(value))) {
    throw new Error('GATE13BR_BRIDGE_WORKDIR_SECRET_OR_PROHIBITED_MATERIAL_REFUSED');
  }
};

const parseMigration = (name) => {
  const match = name.match(/^(\d+)_(.+)\.sql$/);
  return match ? { version: match[1], migrationName: match[2], name } : null;
};

const exactVersionNameDigest = (entries) => sha256(Buffer.from(
  entries.map((entry) => `${entry.version}:${entry.migrationName}\n`).join(''),
  'utf8',
));

const assertReleasePathUnchanged = ({ repoRoot, releaseCommit, relativePath }) => {
  try {
    execFileSync('git', [
      '-C', repoRoot, 'diff', '--quiet', '--no-ext-diff', releaseCommit, '--', relativePath,
    ], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } catch {
    throw new Error(`GATE13BR_HISTORICAL_MIGRATION_HASH_DRIFT:${parseMigration(
      relativePath.split('/').at(-1),
    )?.version ?? 'unknown'}`);
  }
};

const loadObject = (value, label) => {
  const object = typeof value === 'string'
    ? JSON.parse(readFileSync(resolve(value), 'utf8'))
    : value;
  if (!object) throw new Error(`GATE13BR_${label}_MISSING`);
  return object;
};

export function buildProductionBridgeWorkdir(options) {
  const repoRoot = resolve(options.repoRoot);
  const sourceDir = resolve(options.migrationsDir ?? join(repoRoot, 'supabase/migrations'));
  const output = resolve(options.output);
  const targetProjectRef = assertSafeTargetRef(options.targetProjectRef);
  const releaseCommit = String(options.releaseCommit ?? '').trim();
  if (!/^[0-9a-f]{40}$/.test(releaseCommit)) {
    throw new Error('GATE13BR_RELEASE_COMMIT_INVALID');
  }
  assertOutsideRepo(repoRoot, output);
  if (existsSync(output) && readdirSync(output).length > 0) {
    throw new Error('GATE13BR_BRIDGE_WORKDIR_NOT_EMPTY');
  }
  if (options.futureMigrationsDir) {
    throw new Error('GATE13BR_FUTURE_MIGRATIONS_REFUSED');
  }

  const hashManifest = loadObject(options.hashManifest, 'BRIDGE_HASH_MANIFEST');
  if (hashManifest.schema_version !== 'gate13b-migration-hashes-v1') {
    throw new Error('GATE13BR_BRIDGE_HASH_MANIFEST_INVALID');
  }
  const lineageContract = loadObject(options.lineageContract, 'LINEAGE_CONTRACT');
  const historyShape = lineageContract.history_shapes?.production_bridge_lineage;
  if (!Array.isArray(historyShape)) {
    throw new Error('GATE13BR_PRODUCTION_BRIDGE_LINEAGE_MISSING');
  }
  const expectedHistoricalVersions = historyShape
    .map(String)
    .filter((version) => Number(version) <= 180);
  if (new Set(expectedHistoricalVersions).size !== expectedHistoricalVersions.length
      || expectedHistoricalVersions.length === 0) {
    throw new Error('GATE13BR_HISTORICAL_VERSION_INVENTORY_INVALID');
  }

  const localMigrations = readdirSync(sourceDir)
    .map(parseMigration)
    .filter(Boolean);
  const localHistorical = localMigrations
    .filter((entry) => Number(entry.version) <= 180);
  const unexpectedHistorical = localHistorical.filter(
    (entry) => !expectedHistoricalVersions.includes(entry.version),
  );
  if (unexpectedHistorical.length > 0) {
    throw new Error(`GATE13BR_UNEXPECTED_LOCAL_HISTORICAL_VERSION:${unexpectedHistorical[0].version}`);
  }

  const historicalEntries = expectedHistoricalVersions.map((version) => {
    const matches = localHistorical.filter((entry) => entry.version === version);
    if (matches.length !== 1) {
      throw new Error(`GATE13BR_HISTORICAL_MIGRATION_MISSING_OR_DUPLICATE:${version}`);
    }
    const entry = matches[0];
    const relativePath = `supabase/migrations/${entry.name}`;
    const currentBytes = readFileSync(join(sourceDir, entry.name));
    if (options.releaseBlobReader) {
      const releaseBytes = Buffer.from(options.releaseBlobReader(relativePath));
      if (!currentBytes.equals(releaseBytes)) {
        throw new Error(`GATE13BR_HISTORICAL_MIGRATION_HASH_DRIFT:${version}`);
      }
    } else {
      assertReleasePathUnchanged({ repoRoot, releaseCommit, relativePath });
    }
    assertSafeText(currentBytes.toString('utf8'));
    return {
      ...entry,
      path: relativePath,
      bytes: currentBytes,
      sha256: sha256(currentBytes),
      source_classification: 'historical_prefix',
      inclusion_reason: 'exact accepted clone ledger version through 180',
    };
  });

  const expectedLedgerDigest = String(options.cloneLedgerVersionNameSha256 ?? '');
  const observedLedgerDigest = exactVersionNameDigest(historicalEntries);
  if (!/^[0-9a-f]{64}$/.test(expectedLedgerDigest)
      || observedLedgerDigest !== expectedLedgerDigest) {
    throw new Error('GATE13BR_CLONE_LEDGER_VERSION_NAME_DIGEST_MISMATCH');
  }

  const bridgeEntries = BRIDGE_NAMES.map((name) => {
    const parsed = parseMigration(name);
    const path = join(sourceDir, name);
    const bytes = readFileSync(path);
    const expected = hashManifest.migrations?.find(
      (entry) => String(entry.version) === parsed.version,
    );
    if (!expected || expected.path !== `supabase/migrations/${name}`
        || expected.sha256 !== sha256(bytes) || expected.bytes !== bytes.length) {
      throw new Error(`GATE13BR_BRIDGE_MIGRATION_HASH_MISMATCH:${parsed.version}`);
    }
    assertSafeText(bytes.toString('utf8'));
    return {
      ...parsed,
      path: `supabase/migrations/${name}`,
      bytes,
      sha256: expected.sha256,
      source_classification: 'legacy_bridge',
      inclusion_reason: 'reviewed Gate 13B bridge migration',
    };
  });

  const selected = [...historicalEntries, ...bridgeEntries];
  if (selected.some((entry) =>
    Number(entry.version) >= 181 && Number(entry.version) <= 185)
      || selected.some((entry) => Number(entry.version) > 187)) {
    throw new Error('GATE13BR_BRIDGE_WORKDIR_EXCLUDED_VERSION_PRESENT');
  }
  if (selected.slice(-2).map((entry) => entry.version).join('|') !== '186|187') {
    throw new Error('GATE13BR_BRIDGE_WORKDIR_ORDER_INVALID');
  }

  const config = [
    `project_id = "${options.projectId ?? `grc-gate13br-bridge-${randomUUID().slice(0, 12)}`}"`,
    '',
    '[db.seed]',
    'enabled = false',
    'sql_paths = []',
    '',
  ].join('\n');
  assertSafeText(config);

  const migrationsDir = join(output, 'supabase/migrations');
  mkdirSync(migrationsDir, { recursive: true });
  writeFileSync(join(output, 'supabase/config.toml'), config, 'utf8');
  for (const entry of selected) {
    writeFileSync(join(migrationsDir, entry.name), entry.bytes);
  }

  const outputNames = readdirSync(migrationsDir).sort();
  const expectedNames = selected.map((entry) => entry.name).sort();
  if (JSON.stringify(outputNames) !== JSON.stringify(expectedNames)
      || outputNames.some((name) => /^(181|182|183|184|185)_/.test(name))
      || outputNames.some((name) => Number(parseMigration(name)?.version) > 187)) {
    throw new Error('GATE13BR_BRIDGE_WORKDIR_CONTENT_DRIFT');
  }

  const migrationFiles = selected.map((entry) => ({
    path: entry.path,
    version: entry.version,
    bytes: entry.bytes.length,
    sha256: entry.sha256,
    source_classification: entry.source_classification,
    inclusion_reason: entry.inclusion_reason,
  }));
  const historicalPrefixAggregate = sha256(Buffer.from(
    migrationFiles.filter((entry) => entry.source_classification === 'historical_prefix')
      .map((entry) => `${entry.path}\0${entry.bytes}\0${entry.sha256}\n`).join(''),
    'utf8',
  ));
  const aggregate = sha256(Buffer.from(migrationFiles.map((entry) =>
    `${entry.path}\0${entry.bytes}\0${entry.sha256}\0${entry.source_classification}\n`).join(''), 'utf8'));
  const lineage = {
    schema_version: 'gate13br-production-bridge-workdir-v2',
    lineage: 'production_bridge_lineage',
    target_project_ref: targetProjectRef,
    release_commit: releaseCommit,
    source_migration_ceiling: 180,
    historical_migration_count: historicalEntries.length,
    bridge_migration_count: bridgeEntries.length,
    total_migration_count: selected.length,
    historical_ordered_version_name_sha256: observedLedgerDigest,
    historical_prefix_aggregate_sha256: historicalPrefixAggregate,
    intentionally_absent_versions: [181, 182, 183, 184, 185],
    bridge_versions: [186, 187],
    first_shared_forward_migration: 188,
    migration_files: migrationFiles,
    migration_aggregate_sha256: aggregate,
    release_manifest_sha256: hashManifest.release_manifest_sha256,
    normalized_target_catalog_sha256: hashManifest.normalized_target_catalog_sha256,
    credentials_included: false,
    environment_files_included: false,
    seed_enabled: false,
  };
  writeFileSync(join(output, '.release-lineage.json'), `${JSON.stringify(lineage, null, 2)}\n`);
  return { output, ...lineage };
}

const arg = (name, requiredArg = true) => {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (requiredArg && !value) throw new Error(`GATE13BR_ARGUMENT_REQUIRED:${name}`);
  return value;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = buildProductionBridgeWorkdir({
    repoRoot: arg('repo-root'),
    output: arg('output'),
    migrationsDir: arg('migrations', false),
    hashManifest: arg('hash-manifest'),
    lineageContract: arg('lineage-contract'),
    cloneLedgerVersionNameSha256: arg('clone-ledger-version-name-sha256'),
    releaseCommit: arg('release-commit'),
    targetProjectRef: arg('target-ref'),
    projectId: arg('project-id', false),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
