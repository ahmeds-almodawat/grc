import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const arg = (name, required = true) => {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (required && !value) throw new Error(`GATE11R_ARGUMENT_REQUIRED:${name}`);
  return value;
};

function assertNoSecretMaterial(value) {
  const prohibited = [
    /zbrjjecpsrzposhuarcn/i,
    /sb_secret_[A-Za-z0-9_-]+/,
    /service_role\s*[:=]\s*[A-Za-z0-9._-]{20,}/i,
    /postgres(?:ql)?:\/\/[^\s'";]+/i,
    /(?:SUPABASE_DB_PASSWORD|DATABASE_URL|JWT_SECRET|SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*['"]?[^\s'"]+/i,
  ];
  if (prohibited.some((pattern) => pattern.test(value))) throw new Error('GATE11R_WORKDIR_SECRET_MATERIAL_REFUSED');
}

export function buildReleaseBaselineWorkdir(options) {
  const baselinePath = resolve(options.baselinePath);
  const manifestPath = resolve(options.manifestPath);
  const configPath = resolve(options.configPath);
  const output = resolve(options.output);
  const repoRoot = resolve(options.repoRoot);
  const rel = relative(repoRoot, output);
  if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))) {
    throw new Error('GATE11R_WORKDIR_MUST_BE_OUTSIDE_REPOSITORY');
  }
  if (existsSync(output) && readdirSync(output).length > 0) throw new Error('GATE11R_WORKDIR_NOT_EMPTY');

  const baseline = readFileSync(baselinePath);
  const manifestText = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestText);
  const baselineHash = sha256(baseline);
  const ceiling = Number(manifest.source_migration_ceiling);
  const firstFuture = Number(manifest.first_future_migration_number);
  if (manifest.sql_sha256 !== baselineHash || ![185, 187].includes(ceiling)
      || firstFuture !== ceiling + 1) {
    throw new Error('GATE11R_BASELINE_MANIFEST_BINDING_FAILED');
  }
  if (manifest.release_status !== 'release_approved' && !options.allowCandidate) {
    throw new Error('GATE11R_BASELINE_NOT_RELEASE_APPROVED');
  }

  let config = readFileSync(configPath, 'utf8');
  config = config.replace(/^project_id\s*=\s*"[^"]+"/m, `project_id = "${options.projectId}"`);
  config = config.replace(/(\[db\.seed\][\s\S]*?\benabled\s*=\s*)true/, '$1false');
  assertNoSecretMaterial(config);
  assertNoSecretMaterial(baseline.toString('utf8'));

  const supabaseDir = join(output, 'supabase');
  const migrationsDir = join(supabaseDir, 'migrations');
  mkdirSync(migrationsDir, { recursive: true });
  writeFileSync(join(supabaseDir, 'config.toml'), config, 'utf8');
  const baselineVersion = ceiling === 187 ? 3 : 2;
  copyFileSync(baselinePath, join(migrationsDir, `${ceiling}_grc_platform_baseline_v${baselineVersion}.sql`));

  const copiedFuture = [];
  if (options.futureMigrationsDir) {
    for (const name of readdirSync(options.futureMigrationsDir).sort()) {
      const match = name.match(/^(\d+).*\.sql$/i);
      if (!match || Number(match[1]) < firstFuture) continue;
      copyFileSync(join(options.futureMigrationsDir, name), join(migrationsDir, name));
      copiedFuture.push(name);
    }
  }
  const names = readdirSync(migrationsDir).sort();
  if (names.some((name) => Number(name.match(/^(\d+)/)?.[1]) < ceiling)
      || names.filter((name) => name.startsWith(`${ceiling}_`)).length !== 1) {
    throw new Error('GATE11R_HISTORICAL_MIGRATION_LEAK_IN_BASELINE_WORKDIR');
  }

  const lineage = {
    schema_version: baselineVersion === 3
      ? 'gate13br3-release-baseline-workdir-v1'
      : 'gate11r-release-baseline-workdir-v1',
    project_id: options.projectId,
    lineage: baselineVersion === 3 ? 'baseline_v3_lineage' : 'baseline_v2_lineage',
    baseline_migration_version: String(ceiling),
    first_future_migration: firstFuture,
    baseline_sql_sha256: baselineHash,
    baseline_manifest_sha256: sha256(Buffer.from(manifestText, 'utf8')),
    normalized_catalog_sha256: manifest.normalized_target_catalog_sha256,
    future_migrations: copiedFuture,
    migration_files: names.map((name) => ({
      name,
      bytes: statSync(join(migrationsDir, name)).size,
      sha256: sha256(readFileSync(join(migrationsDir, name))),
    })),
    credentials_included: false,
  };
  writeFileSync(join(output, '.release-lineage.json'), `${JSON.stringify(lineage, null, 2)}\n`, 'utf8');
  return lineage;
}

function runCli() {
  const output = arg('output');
  const result = buildReleaseBaselineWorkdir({
    baselinePath: arg('baseline'), manifestPath: arg('manifest'), configPath: arg('config'),
    output, repoRoot: arg('repo-root'), futureMigrationsDir: arg('future-migrations', false),
    projectId: arg('project-id', false) ?? `grc-release-baseline-${randomUUID().slice(0, 12)}`,
    allowCandidate: process.argv.includes('--allow-candidate-for-validation'),
  });
  process.stdout.write(`${JSON.stringify({ output: resolve(output), ...result })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCli();
