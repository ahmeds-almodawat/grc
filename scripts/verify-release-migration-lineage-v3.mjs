import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const normalizeVersions = (values) => [...new Set((values ?? []).map(String))]
  .sort((a, b) => Number(a) - Number(b));
const same = (left, right) => JSON.stringify(normalizeVersions(left))
  === JSON.stringify(normalizeVersions(right));
const exact = (left, right) => JSON.stringify((left ?? []).map(String))
  === JSON.stringify((right ?? []).map(String));

const assertUniqueOrderedVersions = (values, label) => {
  const versions = (values ?? []).map(String);
  if (versions.length === 0 || new Set(versions).size !== versions.length
      || versions.some((version) => !/^\d+$/.test(version))) {
    throw new Error(`GATE13BR_${label}_INVALID`);
  }
  return versions;
};

const assertNoProhibitedRef = (value) => {
  if (JSON.stringify(value).includes('zbrjjecpsrzposhuarcn')) {
    throw new Error('GATE13B_PRODUCTION_REFERENCE_REFUSED');
  }
};

const assertBinding = ({ evidence, manifest, manifestText, contract }) => {
  const manifestHash = sha256(Buffer.from(manifestText, 'utf8'));
  if (manifestHash !== contract.release_manifest_sha256
      || evidence.release_manifest_sha256 !== manifestHash) {
    throw new Error('GATE13B_RELEASE_MANIFEST_BINDING_FAILED');
  }
  const manifestCatalog = manifest.normalized_target_catalog_sha256
    ?? manifest.target?.normalized_target_catalog_sha256;
  if (evidence.normalized_catalog_sha256 !== contract.normalized_post187_catalog_sha256
      || manifestCatalog !== contract.normalized_post187_catalog_sha256) {
    throw new Error('GATE13B_CATALOG_FINGERPRINT_DRIFT');
  }
  for (const version of ['186', '187']) {
    if (evidence.migration_hashes?.[version] !== contract.migration_hashes?.[version]) {
      throw new Error(`GATE13B_MIGRATION_HASH_DRIFT:${version}`);
    }
  }
};

const assertCredentialTransition = (evidence, lineage) => {
  const state = evidence.credential_transition_state;
  const allowed = {
    modern_legacy_lineage: ['not_applicable'],
    production_bridge_lineage: ['mandatory_rotation_required', 'mandatory_rotation_completed'],
    baseline_v3_lineage: ['not_initialized'],
  }[lineage];
  if (!allowed?.includes(state)) {
    throw new Error('GATE13B_CREDENTIAL_TRANSITION_STATE_MISMATCH');
  }
  return state;
};

export function classifyReleaseLineageV3({ evidence, manifest, manifestText, contract }) {
  assertNoProhibitedRef({ evidence, manifest, contract });
  assertBinding({ evidence, manifest, manifestText, contract });

  const versions = normalizeVersions(evidence.migration_versions);
  const future = normalizeVersions(evidence.expected_forward_versions);
  if (future.some((version) => Number(version) < 188)) {
    throw new Error('GATE13B_INVALID_FUTURE_MIGRATION_VERSION');
  }
  if (versions.includes('187') && evidence.requested_migration_versions?.some(
    (version) => Number(version) >= 181 && Number(version) <= 185
  )) {
    throw new Error('GATE13B_POST187_HISTORICAL_MIGRATION_APPLICATION_REFUSED');
  }

  const shapes = contract.history_shapes;
  const modern = [...shapes.modern_legacy_lineage, ...future];
  const bridge = [...shapes.production_bridge_lineage, ...future];
  const baseline = [...shapes.baseline_v3_lineage, ...future];

  if (same(versions, modern)) {
    if (evidence.lineage_attestation !== 'modern_legacy_lineage'
        || evidence.baseline_sql_sha256
        || evidence.requested_workdir !== 'historical-modern') {
      throw new Error('GATE13B_MODERN_LINEAGE_ATTESTATION_MISMATCH');
    }
    return { lineage: 'modern_legacy_lineage', credential_transition_state: assertCredentialTransition(evidence, 'modern_legacy_lineage'), workdir: 'historical-modern', first_shared_forward_migration: 188 };
  }
  if (same(versions, bridge)) {
    if (evidence.lineage_attestation !== 'production_bridge_lineage'
        || evidence.baseline_sql_sha256
        || evidence.requested_workdir !== 'production-bridge'
        || versions.some((version) => Number(version) >= 181 && Number(version) <= 185)) {
      throw new Error('GATE13B_BRIDGE_LINEAGE_ATTESTATION_MISMATCH');
    }
    return { lineage: 'production_bridge_lineage', credential_transition_state: assertCredentialTransition(evidence, 'production_bridge_lineage'), workdir: 'production-bridge', first_shared_forward_migration: 188 };
  }
  if (same(versions, baseline)) {
    if (evidence.lineage_attestation !== 'baseline_v3_lineage'
        || evidence.baseline_sql_sha256 !== contract.baseline_v3_sql_sha256
        || contract.baseline_v3_sql_sha256 === 'to_be_generated_after_authorized_clone_rehearsal'
        || evidence.requested_workdir !== 'baseline-v3') {
      throw new Error('GATE13B_BASELINE_V3_BINDING_FAILED');
    }
    return { lineage: 'baseline_v3_lineage', credential_transition_state: assertCredentialTransition(evidence, 'baseline_v3_lineage'), workdir: 'baseline-v3', first_shared_forward_migration: 188 };
  }
  throw new Error('GATE13B_UNKNOWN_MIXED_OR_DRIFTED_LINEAGE');
}

export function reconcileProductionBridgeWorkdir({
  remoteVersions,
  workdirVersions,
  pendingVersions,
}) {
  const remote = assertUniqueOrderedVersions(remoteVersions, 'REMOTE_LEDGER');
  const workdir = assertUniqueOrderedVersions(workdirVersions, 'WORKDIR_LEDGER');
  const pending = assertUniqueOrderedVersions(pendingVersions, 'PENDING_LEDGER');
  if (Number(remote.at(-1)) !== 180
      || remote.some((version) => Number(version) >= 181)) {
    throw new Error('GATE13BR_REMOTE_LEDGER_CEILING_MISMATCH');
  }
  const historical = workdir.filter((version) => Number(version) <= 180);
  if (!exact(remote, historical)) {
    throw new Error('GATE13BR_REMOTE_HISTORY_MISSING_FROM_WORKDIR');
  }
  if (workdir.some((version) => Number(version) >= 181 && Number(version) <= 185)
      || workdir.some((version) => Number(version) > 187)
      || !exact(workdir.slice(-2), ['186', '187'])) {
    throw new Error('GATE13BR_WORKDIR_VERSION_SET_REFUSED');
  }
  if (!exact(pending, ['186', '187'])) {
    throw new Error('GATE13BR_PENDING_VERSION_SET_REFUSED');
  }
  return {
    result: 'BRIDGE WORKDIR LEDGER RECONCILED',
    remote_historical_count: remote.length,
    workdir_historical_count: historical.length,
    workdir_total_count: workdir.length,
    pending_versions: pending,
    exact_order_match: true,
  };
}

const arg = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`GATE13B_ARGUMENT_REQUIRED:${name}`);
  return process.argv[index + 1];
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifestText = readFileSync(arg('manifest'), 'utf8');
  const result = classifyReleaseLineageV3({
    evidence: JSON.parse(readFileSync(arg('evidence'), 'utf8')),
    manifest: JSON.parse(manifestText), manifestText,
    contract: JSON.parse(readFileSync(arg('contract'), 'utf8')),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
