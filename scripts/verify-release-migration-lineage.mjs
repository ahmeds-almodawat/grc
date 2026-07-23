import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const sorted = (values) => [...new Set(values.map(String))].sort((a, b) => Number(a) - Number(b));
const same = (left, right) => JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));

export function classifyReleaseLineage({ evidence, manifest, manifestText, contract }) {
  const serialized = JSON.stringify(evidence);
  if (serialized.includes('zbrjjecpsrzposhuarcn')) throw new Error('GATE11R_PRODUCTION_REFERENCE_REFUSED');
  if (evidence.normalized_catalog_sha256 !== manifest.normalized_target_catalog_sha256
      || evidence.normalized_catalog_sha256 !== contract.normalized_catalog_sha256) {
    throw new Error('GATE11R_CATALOG_FINGERPRINT_DRIFT');
  }
  const manifestHash = sha256(Buffer.from(manifestText, 'utf8'));
  if (evidence.baseline_manifest_sha256 !== manifestHash
      || contract.baseline_manifest_sha256 !== manifestHash
      || contract.baseline_sql_sha256 !== manifest.sql_sha256) {
    throw new Error('GATE11R_RELEASE_MANIFEST_BINDING_FAILED');
  }

  const versions = sorted(evidence.migration_versions ?? []);
  const future = sorted(evidence.expected_forward_versions ?? []);
  if (future.some((version) => Number(version) < 186)) throw new Error('GATE11R_INVALID_FUTURE_MIGRATION_VERSION');
  const legacyShape = sorted([...contract.legacy_history_versions, ...future]);
  const baselineShape = sorted(['185', ...future]);

  if (same(versions, legacyShape)) {
    if (evidence.baseline_sql_sha256) throw new Error('GATE11R_BASELINE_ARTIFACT_ON_LEGACY_LINEAGE');
    return { lineage: 'legacy_upgrade_lineage', workdir: 'historical', first_shared_forward_migration: 186 };
  }
  if (same(versions, baselineShape)) {
    if (evidence.baseline_sql_sha256 !== manifest.sql_sha256) throw new Error('GATE11R_BASELINE_SQL_HASH_DRIFT');
    return { lineage: 'baseline_v2_lineage', workdir: 'baseline_v2', first_shared_forward_migration: 186 };
  }
  throw new Error('GATE11R_UNKNOWN_OR_DRIFTED_LINEAGE');
}

function requireArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`GATE11R_ARGUMENT_REQUIRED:${name}`);
  return process.argv[index + 1];
}

function runCli() {
  const manifestText = readFileSync(requireArg('manifest'), 'utf8');
  const result = classifyReleaseLineage({
    evidence: JSON.parse(readFileSync(requireArg('evidence'), 'utf8')),
    manifest: JSON.parse(manifestText), manifestText,
    contract: JSON.parse(readFileSync(requireArg('contract'), 'utf8')),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCli();
