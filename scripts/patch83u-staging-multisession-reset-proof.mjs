#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  lstat,
  mkdtemp,
  open,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { verifyRun009ContractArtifacts as verifyRun007ContractArtifacts } from './patch83u-run009-contract-audit.mjs';
import {
  clearRun008CredentialBundle,
  deleteRun008EncryptedCredentialFiles,
  loadRun008BrowserConfiguration,
  loadRun008CredentialBundle,
} from './patch83u-run008-dpapi-credentials.mjs';

export const STAGING_PROJECT_REF = 'zghsgzrdwbqdrpuxanac';
export const PRODUCTION_PROJECT_REF = 'zbrjjecpsrzposhuarcn';
export const STAGING_APPLICATION_ORIGIN = 'http://localhost:5173';
export const STAGING_SUPABASE_ORIGIN = `https://${STAGING_PROJECT_REF}.supabase.co`;
export const STAGING_SUPABASE_REALTIME_ORIGIN = `wss://${STAGING_PROJECT_REF}.supabase.co`;
export const STAGING_AUTH_STORAGE_KEY = `grc-control-center-auth:${STAGING_PROJECT_REF}`;
export const TARGET_USER_ID = '2a276bdb-cf51-4303-846e-6b7fecf38b0c';
export const TARGET_EMPLOYEE_ID = '11111';
export const DESIGNATED_SUPER_ADMIN_ID = '83d92a59-6909-44e7-80f3-aff60a6734fb';
export const EXPECTED_EDGE_CONTRACT = 'patch83u-edge-auth-first-v1';
export const EXPECTED_FRONTEND_CONTRACT = 'patch83u-frontend-auth-first-v1';
export const EXPECTED_SCHEMA_VERSION = '174.2-auth-first';
export const FINALIZER_RPC = 'patch83u_finalize_password_change_after_revocation';
export const REQUIRED_MIGRATIONS = Object.freeze(['174', '176', '177']);
export const INITIAL_CREDENTIAL_VERSION = 4;
export const POST_RESET_CREDENTIAL_VERSION = 5;
export const FINAL_CREDENTIAL_VERSION = 6;
export const EDGE_FUNCTION_NAME = 'privileged-action';
export const EXECUTION_FREEZE_SCHEMA_VERSION =
  'patch83u-staging-reset-execution-freeze-v9';
export const EXECUTION_FREEZE_READY_DECISION =
  'READY FOR AUTOMATED RUN 009 AUTHORIZATION';
export const EXECUTION_FREEZE_SCHEMA_PATH =
  'release/patch83u/patch83u-staging-reset-execution-freeze-schema-v9.json';
export const EXECUTION_FREEZE_PATH =
  'release/patch83u/patch83u-staging-reset-execution-freeze-v9-20260721.json';
export const EDGE_PROVENANCE_SCHEMA_VERSION =
  'patch83u-staging-edge-v5-provenance-v1';
export const EDGE_PROVENANCE_CLASSIFICATION =
  'VERSION 5 SOURCE IDENTICAL TO FROZEN REVIEWED SOURCE';
export const RUN007_OPERATOR_CONFIRMATION_CONTRACT_ID =
  'patch83u-run009-reset-confirmation-v1';
export const RUN_NUMBER = 9;
export const PRE_CREDENTIAL_READINESS_PASSED =
  'PATCH83U PRE-CREDENTIAL READINESS PASSED';
export const PRE_CREDENTIAL_READINESS_FAILED =
  'PATCH83U PRE-CREDENTIAL READINESS FAILED';
export const EDGE_DEPLOYMENT_GATE_CHECK_NAMES = Object.freeze([
  'edge_freeze_hash_exact',
  'edge_freeze_schema_exact',
  'edge_freeze_schema_contract_valid',
  'edge_freeze_readiness_authorized',
  'edge_staging_project_exact',
  'edge_production_ref_recorded',
  'edge_application_origin_exact',
  'edge_run_contract_exact',
  'edge_repository_state_exact',
  'edge_frozen_inventory_shape_exact',
  'edge_frozen_files_exact',
  'edge_frozen_aggregate_exact',
  'edge_prior_evidence_integrity_exact',
  'edge_run007_proof_contract_complete',
  'edge_contracts_exact',
  'edge_function_exact',
  'edge_version_exact',
  'edge_status_active',
  'edge_verify_jwt_true',
  'edge_artifact_hash_exact',
  'edge_provenance_hash_exact',
  'edge_provenance_identity_exact',
  'edge_provenance_metadata_exact',
  'edge_source_hash_exact',
  'edge_live_downloaded_source_exact',
  'edge_source_security_markers_exact',
  'edge_operator_confirmation_contract_exact',
]);
export const ADMIN_RESET_ACTION = 'patch83u_admin_reset_password';
export const REQUIRED_PASSWORD_CHANGE_ACTION = 'patch83u_change_required_password';
export const RESET_CONFIRMATION_TEXT = 'RESET USER PASSWORD';
export const PASSWORD_CHANGE_MAX_ATTEMPTS = 3;
export const PERMANENT_PASSWORD_POLICY_ERROR_CODE =
  'PATCH83U_PERMANENT_PASSWORD_POLICY_REJECTED';
export const SQL_EDITOR_EVIDENCE_CHANNEL = 'sql-editor';
export const SQL_EDITOR_PROJECT_CONFIRMATION_GATE_ID =
  'patch83u-sql-editor-project-confirmation-v1';
export const SQL_EDITOR_EVIDENCE_MAX_AGE_MS = 5 * 60 * 1_000;
export const SQL_EDITOR_EVIDENCE_MAX_FUTURE_SKEW_MS = 30 * 1_000;
export const SQL_EDITOR_CHECKPOINTS = Object.freeze([
  'before_employee_sessions',
  'immediately_before_reset',
  'immediately_after_reset',
  'before_required_password_change',
  'immediately_after_password_change_finalization',
  'after_fresh_employee_login',
]);
export const SQL_EDITOR_CHECKPOINT_DIRECTORY =
  'release/patch83u/reset-proof-run-009/checkpoints';
export const RUN007_EVIDENCE_DIRECTORY =
  'release/patch83u/reset-proof-run-009';
export const RUN007_OUTPUT_PATH_PATTERN =
  'release/patch83u/reset-proof-run-009/'
  + 'patch83u-staging-reset-final-results-attempt-NNN.json';
export const RUN007_EVIDENCE_SCHEMA_PATH =
  'release/patch83u/patch83u-staging-reset-harness-schema-v8.json';
export const RUN007_CHECKPOINT_SCHEMA_PATH =
  'release/patch83u/patch83u-staging-checkpoint-file-schema-v3.json';
export const RUN007_PROOF_CONTRACT_PATH =
  'release/patch83u/patch83u-run009-proof-contract.json';
export const RUN007_TRACEABILITY_PATH =
  'release/patch83u/patch83u-run009-proof-traceability.json';
export const RUN007_TRACEABILITY_MARKDOWN_PATH =
  'release/patch83u/patch83u-run009-proof-traceability.md';
export const SQL_EDITOR_CHECKPOINT_MAX_BYTES = 256 * 1_024;
export const SQL_EDITOR_CHECKPOINT_WAIT_TIMEOUT_MS = 30 * 60 * 1_000;
export const SQL_EDITOR_CHECKPOINT_FILE_NAMES = Object.freeze({
  before_employee_sessions: '01-before-employee-sessions.json',
  immediately_before_reset: '02-immediately-before-reset.json',
  immediately_after_reset: '03-immediately-after-reset.json',
  before_required_password_change: '04-before-required-password-change.json',
  immediately_after_password_change_finalization:
    '05-immediately-after-password-change-finalization.json',
  after_fresh_employee_login: '06-after-fresh-employee-login.json',
});
export const RESET_PROOF_SCHEMA_VERSION = 'patch83u-staging-reset-proof-v8';
export const RUN007_PROOF_CONTRACT_VERSION = 'patch83u-run009-proof-contract-v1';
export const RUN007_PROOF_CONTRACT_ID = 'patch83u-hosted-reset-proof-run-009';
export const RUN007_TRACEABILITY_VERSION = 'patch83u-run009-proof-traceability-v1';
// Run 009 uses new artifacts while retaining legacy export names temporarily
// for historical test/evidence readers.
export const RUN008_OPERATOR_CONFIRMATION_CONTRACT_ID =
  RUN007_OPERATOR_CONFIRMATION_CONTRACT_ID;
export const RUN008_EVIDENCE_DIRECTORY = RUN007_EVIDENCE_DIRECTORY;
export const RUN008_OUTPUT_PATH_PATTERN = RUN007_OUTPUT_PATH_PATTERN;
export const RUN008_EVIDENCE_SCHEMA_PATH = RUN007_EVIDENCE_SCHEMA_PATH;
export const RUN008_CHECKPOINT_SCHEMA_PATH = RUN007_CHECKPOINT_SCHEMA_PATH;
export const RUN008_PROOF_CONTRACT_PATH = RUN007_PROOF_CONTRACT_PATH;
export const RUN008_TRACEABILITY_PATH = RUN007_TRACEABILITY_PATH;
export const RUN008_TRACEABILITY_MARKDOWN_PATH = RUN007_TRACEABILITY_MARKDOWN_PATH;
export const RUN008_PROOF_CONTRACT_VERSION = RUN007_PROOF_CONTRACT_VERSION;
export const RUN008_PROOF_CONTRACT_ID = RUN007_PROOF_CONTRACT_ID;
export const RUN008_TRACEABILITY_VERSION = RUN007_TRACEABILITY_VERSION;
export const RUN009_OPERATOR_CONFIRMATION_CONTRACT_ID =
  RUN007_OPERATOR_CONFIRMATION_CONTRACT_ID;
export const RUN009_EVIDENCE_DIRECTORY = RUN007_EVIDENCE_DIRECTORY;
export const RUN009_OUTPUT_PATH_PATTERN = RUN007_OUTPUT_PATH_PATTERN;
export const RUN009_EVIDENCE_SCHEMA_PATH = RUN007_EVIDENCE_SCHEMA_PATH;
export const RUN009_CHECKPOINT_SCHEMA_PATH = RUN007_CHECKPOINT_SCHEMA_PATH;
export const RUN009_PROOF_CONTRACT_PATH = RUN007_PROOF_CONTRACT_PATH;
export const RUN009_TRACEABILITY_PATH = RUN007_TRACEABILITY_PATH;
export const RUN009_TRACEABILITY_MARKDOWN_PATH = RUN007_TRACEABILITY_MARKDOWN_PATH;
export const RUN009_PROOF_CONTRACT_VERSION = RUN007_PROOF_CONTRACT_VERSION;
export const RUN009_PROOF_CONTRACT_ID = RUN007_PROOF_CONTRACT_ID;
export const RUN009_TRACEABILITY_VERSION = RUN007_TRACEABILITY_VERSION;
export const EXPECTED_FINAL_SESSION_COUNT = 1;
export const EXPECTED_FINAL_UNREVOKED_REFRESH_TOKEN_COUNT = 1;
export const EXPECTED_TEMPORARY_SESSION_COUNT = 1;
export const EXPECTED_TEMPORARY_UNREVOKED_REFRESH_TOKEN_COUNT = 1;
export const CONTROLLED_EMPLOYEE_CONTEXT_LABELS = Object.freeze([
  'employee_context_1',
  'employee_context_2',
]);
export const CONTROLLED_EMPLOYEE_REDIRECT_PAGE = 'home';
// `my-work` is the canonical URL value for the `myWork` page key.
export const FORCED_PASSWORD_CHANGE_PROTECTED_ROUTES = Object.freeze([
  'home',
  'my-work',
  'admin',
]);

export const BROWSER_EVIDENCE_OPTIONS = Object.freeze({
  recordHar: undefined,
  recordVideo: undefined,
  storageState: undefined,
  trace: false,
  automaticScreenshots: false,
  verboseNetworkLogging: false,
});

export const EXECUTION_FREEZE_CONSUMED_JSON_POINTERS = Object.freeze([
  '/schema_version',
  '/captured_at_utc',
  '/readiness_decision',
  '/decision_is_execution_authorization',
  '/supersedes/path',
  '/supersedes/sha256',
  '/supersedes/bytes',
  '/supersedes/prior_authorization_reusable',
  '/repository/branch',
  '/repository/head',
  '/repository/working_tree_dirty',
  '/repository/tracked_modified_count',
  '/repository/untracked_count_after_manifest_creation',
  '/repository/porcelain_entry_count_after_manifest_creation',
  '/repository/staged_file_count',
  '/targets/allowed_staging_project_ref',
  '/targets/prohibited_production_project_ref',
  '/targets/staging_supabase_origin',
  '/targets/application_origin',
  '/targets/production_accessed',
  '/runtime_contract/schema_version',
  '/runtime_contract/enforcement_state',
  '/runtime_contract/state_version',
  '/runtime_contract/expected_edge_contract',
  '/runtime_contract/compatible_edge_contract',
  '/runtime_contract/expected_frontend_contract',
  '/runtime_contract/compatible_frontend_contract',
  '/runtime_contract/applied_migrations',
  '/runtime_contract/finalizer/name',
  '/runtime_contract/finalizer/name_bytes',
  '/runtime_contract/finalizer/security_definer',
  '/runtime_contract/finalizer/service_role_execute',
  '/runtime_contract/finalizer/authenticated_execute',
  '/runtime_contract/finalizer/anon_execute',
  '/runtime_contract/finalizer/public_execute',
  '/operator_confirmation_contract/contract_id',
  '/operator_confirmation_contract/run_number',
  '/operator_confirmation_contract/exact_phrase',
  '/operator_confirmation_contract/case_sensitive',
  '/operator_confirmation_contract/cli_override_supported',
  '/operator_confirmation_contract/required_immediately_before_reset',
  '/operator_confirmation_contract/evidence_retention',
  '/active_edge_provenance/identity/project_ref',
  '/active_edge_provenance/identity/function_name',
  '/active_edge_provenance/metadata/version',
  '/active_edge_provenance/metadata/status',
  '/active_edge_provenance/metadata/verify_jwt',
  '/active_edge_provenance/metadata/hosted_ezbr_sha256',
  '/active_edge_provenance/metadata/created_at_unix_ms',
  '/active_edge_provenance/metadata/created_at_utc',
  '/active_edge_provenance/metadata/updated_at_unix_ms',
  '/active_edge_provenance/metadata/updated_at_utc',
  '/active_edge_provenance/provenance_record/path',
  '/active_edge_provenance/provenance_record/sha256',
  '/active_edge_provenance/provenance_record/bytes',
  '/active_edge_provenance/source/downloaded/sha256',
  '/active_edge_provenance/source/downloaded/bytes',
  '/active_edge_provenance/source/local/path',
  '/active_edge_provenance/source/local/sha256',
  '/active_edge_provenance/source/local/bytes',
  '/active_edge_provenance/source/byte_identical',
  '/active_edge_provenance/source/production_ref_absent',
  '/active_edge_provenance/bundle_binding/raw_entrypoint_binding_proven',
  '/active_edge_provenance/bundle_binding/complete_deployment_bundle_binding_proven',
  '/active_edge_provenance/bundle_binding/hosted_hash_meaning_as_raw_source_hash_proven',
  '/run_contract/run_number',
  '/run_contract/evidence_directory',
  '/run_contract/checkpoint_directory',
  '/run_contract/checkpoint_files',
  '/run_contract/output_path_pattern',
  '/run_contract/exclusive_create_required',
  '/run_contract/evidence_schema_path',
  '/run_contract/evidence_schema_sha256',
  '/run_contract/evidence_schema_bytes',
  '/run_contract/evidence_schema_version',
  '/run_contract/sql_editor_project_ref_option',
  '/run_contract/sql_editor_project_confirmation_gate_id',
  '/run_contract/precredential_no_secret_fixture_flag',
  '/run_contract/frontend_mode',
  '/run_contract/precredential_mode_flag',
  '/run_contract/precredential_success_output',
  '/proof_contract/path',
  '/proof_contract/sha256',
  '/proof_contract/bytes',
  '/proof_contract/schema_version',
  '/proof_contract/contract_id',
  '/proof_contract/requirement_count',
  '/checkpoint_schema/path',
  '/checkpoint_schema/sha256',
  '/checkpoint_schema/bytes',
  '/checkpoint_schema/schema_version',
  '/traceability/json_path',
  '/traceability/json_sha256',
  '/traceability/json_bytes',
  '/traceability/markdown_path',
  '/traceability/markdown_sha256',
  '/traceability/markdown_bytes',
  '/traceability/schema_version',
  '/traceability/requirement_count',
  '/traceability/mapped_requirement_count',
  '/traceability/coverage_percent',
  '/traceability/complete',
  '/final_session_contract/checkpoint',
  '/final_session_contract/expected_session_count',
  '/final_session_contract/expected_unrevoked_refresh_token_count',
  '/final_session_contract/enforcement',
  '/final_session_contract/cli_override_supported',
  '/final_session_contract/justification_basis',
  '/frozen_source/hash_algorithm',
  '/frozen_source/aggregate_algorithm',
  '/frozen_source/file_count',
  '/frozen_source/total_bytes',
  '/frozen_source/aggregate_sha256',
  '/frozen_source/files',
  '/prior_evidence_integrity/hash_algorithm',
  '/prior_evidence_integrity/aggregate_algorithm',
  '/prior_evidence_integrity/file_count',
  '/prior_evidence_integrity/total_bytes',
  '/prior_evidence_integrity/aggregate_sha256',
  '/prior_evidence_integrity/files',
  '/prior_evidence_integrity/run005_absence_assertions/checkpoint_files_absent',
  '/prior_evidence_integrity/run005_absence_assertions/attempt_output_files_absent',
  '/run005_stop_state/authorization_consumed',
  '/run005_stop_state/credentials_entered',
  '/run005_stop_state/login_performed',
  '/run005_stop_state/employee_sessions_created',
  '/run005_stop_state/sql_checkpoints_executed',
  '/run005_stop_state/reset_request_id_generated',
  '/run005_stop_state/reset_submitted',
  '/run005_stop_state/password_change_submitted',
  '/run005_stop_state/credential_or_auth_state_changed',
  '/run005_stop_state/recovery_or_reconciliation_required',
  '/run005_stop_state/super_admin_untouched',
  '/run005_stop_state/production_accessed',
]);

const PROHIBITED_ARGUMENT_PATTERNS = [
  /^--.*password/i,
  /^--.*token/i,
  /^--.*secret/i,
  /^--.*cookie/i,
  /^--.*authorization/i,
  /^--.*service-role/i,
  /^--.*database-url/i,
];
const PROHIBITED_KEY_FRAGMENTS = Object.freeze([
  'password',
  'accesstoken',
  'authorization',
  'cookie',
  'servicerole',
  'sessionid',
  'storagestate',
  'requestbody',
  'responsebody',
  'encryptedpassword',
  'secret',
  'apikey',
  'jwt',
  'email',
  'phone',
  'rawappmetadata',
  'rawusermetadata',
  'usermetadata',
  'connectionstring',
  'databaseurl',
]);
const SAFE_REFRESH_KEYS = new Set([
  'unrevoked_refresh_token_count',
  'expected_unrevoked_refresh_token_count',
  'refresh_replay_results',
  'refresh_replay_failed',
]);
const SAFE_PASSWORD_KEYS = new Set([
  'forced_password_change_gate',
  'password_change',
  'after_password_change',
  'password_changed_at_set',
]);
const SAFE_SERVICE_ROLE_KEYS = new Set([
  'service_role_execute_only',
  'wrapper_service_role_execute_only',
  'implementation_not_callable_by_service_role',
]);
const SECRET_VALUE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/i,
  /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\b/,
  /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{12,}\b/i,
];
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const execFileAsync = promisify(execFile);
const CHECKPOINT_DIRECTORY_HANDLE = Symbol('patch83uCheckpointDirectoryHandle');

function normalizedEvidenceKey(key) {
  return String(key).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function evidenceKeyIsProhibited(key) {
  if (
    SAFE_PASSWORD_KEYS.has(key)
    || SAFE_SERVICE_ROLE_KEYS.has(key)
    || SAFE_REFRESH_KEYS.has(key)
  ) {
    return false;
  }
  const normalized = normalizedEvidenceKey(key);
  return PROHIBITED_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment))
    || normalized.includes('refreshtoken');
}

function walk(value, visit, path = '$') {
  visit(value, path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, `${path}[${index}]`));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      visit(key, `${path}.${key}`, true);
      walk(child, visit, `${path}.${key}`);
    });
  }
}

export function assertStagingConfiguration(values) {
  const candidates = [];
  walk(values, (value, path, isKey) => {
    if (!isKey && typeof value === 'string') candidates.push({ value, path });
  });
  for (const candidate of candidates) {
    if (candidate.value.includes(PRODUCTION_PROJECT_REF)) {
      throw new Error(`PATCH83U_PRODUCTION_TARGET_REFUSED:${candidate.path}`);
    }
  }
  for (const { value, path } of candidates.filter(({ path }) => /project.*ref/i.test(path))) {
    if (value !== STAGING_PROJECT_REF) {
      throw new Error(`PATCH83U_NON_STAGING_PROJECT_REF_REFUSED:${path}`);
    }
  }
  const supabaseUrls = candidates.filter(({ value, path }) =>
    /supabase.*url/i.test(path) || /\.supabase\.(?:co|net)(?:[:/]|$)/i.test(value));
  if (supabaseUrls.length === 0) throw new Error('PATCH83U_STAGING_SUPABASE_URL_REQUIRED');
  for (const { value, path } of supabaseUrls) {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`PATCH83U_INVALID_SUPABASE_URL:${path}`);
    }
    if (
      parsed.origin !== STAGING_SUPABASE_ORIGIN
      || parsed.pathname !== '/'
      || parsed.search
      || parsed.hash
      || parsed.username
      || parsed.password
    ) {
      throw new Error(`PATCH83U_NON_STAGING_SUPABASE_URL_REFUSED:${path}`);
    }
  }
  const applicationUrls = candidates.filter(({ path }) => /app.*url/i.test(path));
  if (applicationUrls.length === 0) throw new Error('PATCH83U_STAGING_APPLICATION_ORIGIN_REQUIRED');
  for (const { value, path } of applicationUrls) {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`PATCH83U_INVALID_APPLICATION_ORIGIN:${path}`);
    }
    if (
      parsed.origin !== STAGING_APPLICATION_ORIGIN
      || parsed.pathname !== '/'
      || parsed.search
      || parsed.hash
      || parsed.username
      || parsed.password
    ) {
      throw new Error(`PATCH83U_NON_STAGING_APPLICATION_ORIGIN_REFUSED:${path}`);
    }
  }
  return true;
}

function pathWithinDirectory(directory, candidate) {
  const pathFromDirectory = relative(directory, candidate);
  return pathFromDirectory !== ''
    && !pathFromDirectory.startsWith('..')
    && !isAbsolute(pathFromDirectory);
}

function resolvePatch83uReleaseArtifact(candidate, errorCode) {
  if (typeof candidate !== 'string' || candidate.trim() === '') {
    throw new Error(errorCode);
  }
  const repositoryRoot = resolve(process.cwd());
  const patch83uReleaseDirectory = resolve(repositoryRoot, 'release', 'patch83u');
  const resolved = resolve(repositoryRoot, candidate);
  if (!pathWithinDirectory(patch83uReleaseDirectory, resolved)) {
    throw new Error(errorCode);
  }
  return resolved;
}

function resolveRepositoryArtifact(candidate) {
  if (typeof candidate !== 'string' || candidate.trim() === '' || isAbsolute(candidate)) {
    throw new Error('PATCH83U_FROZEN_SOURCE_PATH_REFUSED');
  }
  const repositoryRoot = resolve(process.cwd());
  const resolved = resolve(repositoryRoot, candidate);
  if (!pathWithinDirectory(repositoryRoot, resolved)) {
    throw new Error('PATCH83U_FROZEN_SOURCE_PATH_REFUSED');
  }
  return resolved;
}

function pathsEqual(left, right) {
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

async function defaultCheckpointPathIgnored(repositoryRoot, relativePath) {
  try {
    await execFileAsync('git', ['check-ignore', '--quiet', '--', relativePath], {
      cwd: repositoryRoot,
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

async function defaultCheckpointPathTracked(repositoryRoot, relativePath) {
  try {
    await execFileAsync('git', ['ls-files', '--error-unmatch', '--', relativePath], {
      cwd: repositoryRoot,
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

export function checkpointFileName(checkpoint) {
  const fileName = SQL_EDITOR_CHECKPOINT_FILE_NAMES[checkpoint];
  if (!fileName || !SQL_EDITOR_CHECKPOINTS.includes(checkpoint)) {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_UNKNOWN');
  }
  return fileName;
}

export async function resolveSqlEditorCheckpointDirectory(
  candidate,
  {
    repositoryRoot = process.cwd(),
    isIgnored = defaultCheckpointPathIgnored,
    isTracked = defaultCheckpointPathTracked,
  } = {},
) {
  if (
    typeof candidate !== 'string'
    || candidate.trim() === ''
    || isAbsolute(candidate)
    || candidate.replaceAll('\\', '/') !== SQL_EDITOR_CHECKPOINT_DIRECTORY
  ) {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_DIRECTORY_REFUSED');
  }
  const repositoryRealPath = await realpath(resolve(repositoryRoot));
  const expectedDirectory = resolve(repositoryRealPath, SQL_EDITOR_CHECKPOINT_DIRECTORY);
  if (!pathWithinDirectory(repositoryRealPath, expectedDirectory)) {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_DIRECTORY_REFUSED');
  }
  let current = repositoryRealPath;
  for (const segment of SQL_EDITOR_CHECKPOINT_DIRECTORY.split('/')) {
    current = resolve(current, segment);
    let pathStat;
    try {
      pathStat = await lstat(current);
    } catch {
      throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_DIRECTORY_MISSING');
    }
    if (!pathStat.isDirectory() || pathStat.isSymbolicLink()) {
      throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_DIRECTORY_REFUSED');
    }
  }
  const directoryRealPath = await realpath(expectedDirectory);
  if (!pathsEqual(directoryRealPath, expectedDirectory)) {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_DIRECTORY_REFUSED');
  }
  for (const fileName of Object.values(SQL_EDITOR_CHECKPOINT_FILE_NAMES)) {
    const repositoryRelativePath =
      `${SQL_EDITOR_CHECKPOINT_DIRECTORY}/${fileName}`;
    if (
      !(await isIgnored(repositoryRealPath, repositoryRelativePath))
      || await isTracked(repositoryRealPath, repositoryRelativePath)
    ) {
      throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_PATH_NOT_IGNORED');
    }
  }
  return Object.freeze({
    [CHECKPOINT_DIRECTORY_HANDLE]: true,
    absolutePath: directoryRealPath,
  });
}

export function assertRun007OutputCandidate(candidate) {
  const normalized = typeof candidate === 'string'
    ? candidate.replaceAll('\\', '/')
    : '';
  if (
    isAbsolute(String(candidate ?? ''))
    || !new RegExp(
      `^${RUN007_EVIDENCE_DIRECTORY.replaceAll('/', '\\/')}\\/`
      + 'patch83u-staging-reset-final-results-attempt-[0-9]{3}\\.json$',
    ).test(normalized)
  ) {
    throw new Error('PATCH83U_RUN007_OUTPUT_PATH_REFUSED');
  }
  return true;
}

export async function resolveRun007OutputPath(
  candidate,
  { repositoryRoot = process.cwd() } = {},
) {
  assertRun007OutputCandidate(candidate);
  const repositoryRealPath = await realpath(resolve(repositoryRoot));
  let current = repositoryRealPath;
  for (const segment of RUN007_EVIDENCE_DIRECTORY.split('/')) {
    current = resolve(current, segment);
    let pathStat;
    try {
      pathStat = await lstat(current);
    } catch {
      throw new Error('PATCH83U_RUN007_OUTPUT_DIRECTORY_MISSING');
    }
    if (!pathStat.isDirectory() || pathStat.isSymbolicLink()) {
      throw new Error('PATCH83U_RUN007_OUTPUT_PATH_REFUSED');
    }
  }
  const directoryRealPath = await realpath(current);
  if (!pathsEqual(directoryRealPath, current)) {
    throw new Error('PATCH83U_RUN007_OUTPUT_PATH_REFUSED');
  }
  const outputPath = resolve(repositoryRealPath, candidate);
  if (!pathWithinDirectory(directoryRealPath, outputPath)) {
    throw new Error('PATCH83U_RUN007_OUTPUT_PATH_REFUSED');
  }
  try {
    await lstat(outputPath);
    throw new Error('PATCH83U_RUN007_OUTPUT_ALREADY_EXISTS');
  } catch (error) {
    if (error?.message === 'PATCH83U_RUN007_OUTPUT_ALREADY_EXISTS') throw error;
    if (error?.code !== 'ENOENT') {
      throw new Error('PATCH83U_RUN007_OUTPUT_PATH_REFUSED');
    }
  }
  return outputPath;
}

function checkpointFileStateIsValid(state) {
  return state
    && Number.isInteger(state.nextIndex)
    && state.nextIndex >= 0
    && state.nextIndex <= SQL_EDITOR_CHECKPOINTS.length
    && state.usedHashes instanceof Set
    && Number.isFinite(state.runStartedAtMs)
    && (state.latestSnapshot === null || typeof state.latestSnapshot === 'object');
}

export function createCheckpointFileState({ runStartedAtMs = Date.now() } = {}) {
  if (!Number.isFinite(runStartedAtMs)) {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_STATE_INVALID');
  }
  return {
    nextIndex: 0,
    usedHashes: new Set(),
    latestSnapshot: null,
    runStartedAtMs,
  };
}

function stableFileStatMatches(left, right) {
  return left.size === right.size
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs
    && left.dev === right.dev
    && left.ino === right.ino;
}

async function readStableCheckpointBytes(checkpointDirectory, checkpoint) {
  if (checkpointDirectory?.[CHECKPOINT_DIRECTORY_HANDLE] !== true) {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_DIRECTORY_REFUSED');
  }
  const filePath = resolve(
    checkpointDirectory.absolutePath,
    checkpointFileName(checkpoint),
  );
  if (!pathWithinDirectory(checkpointDirectory.absolutePath, filePath)) {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_PATH_REFUSED');
  }
  let pathStat;
  try {
    pathStat = await lstat(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_FILE_MISSING');
    }
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_FILE_UNREADABLE');
  }
  if (!pathStat.isFile() || pathStat.isSymbolicLink()) {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_FILE_NOT_REGULAR');
  }
  const fileRealPath = await realpath(filePath);
  if (
    !pathWithinDirectory(checkpointDirectory.absolutePath, fileRealPath)
    || !pathsEqual(fileRealPath, filePath)
  ) {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_PATH_REFUSED');
  }
  if (pathStat.size <= 0) {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_FILE_EMPTY');
  }
  if (pathStat.size > SQL_EDITOR_CHECKPOINT_MAX_BYTES) {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_FILE_TOO_LARGE');
  }
  const fileHandle = await open(filePath, 'r');
  try {
    const openedBefore = await fileHandle.stat();
    if (!stableFileStatMatches(pathStat, openedBefore)) {
      throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_FILE_CHANGED_DURING_READ');
    }
    const bytes = await fileHandle.readFile();
    const openedAfter = await fileHandle.stat();
    let finalPathStat;
    try {
      finalPathStat = await lstat(filePath);
    } catch {
      throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_FILE_CHANGED_DURING_READ');
    }
    if (
      bytes.length !== openedBefore.size
      || !stableFileStatMatches(openedBefore, openedAfter)
      || !stableFileStatMatches(openedAfter, finalPathStat)
    ) {
      throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_FILE_CHANGED_DURING_READ');
    }
    return {
      bytes,
      mtimeMs: finalPathStat.mtimeMs,
    };
  } finally {
    await fileHandle.close();
  }
}

export async function readSqlEditorCheckpointFile({
  checkpoint,
  checkpointDirectory,
  state,
  checkpointSchema,
  operatorProjectRef = STAGING_PROJECT_REF,
  nowMs = Date.now(),
}) {
  if (!checkpointFileStateIsValid(state)) {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_STATE_INVALID');
  }
  const expectedCheckpoint = SQL_EDITOR_CHECKPOINTS[state.nextIndex];
  const requestedIndex = SQL_EDITOR_CHECKPOINTS.indexOf(checkpoint);
  if (requestedIndex < state.nextIndex) {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_REUSE_REFUSED');
  }
  if (checkpoint !== expectedCheckpoint) {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_ORDER_REFUSED');
  }
  const { bytes, mtimeMs } = await readStableCheckpointBytes(
    checkpointDirectory,
    checkpoint,
  );
  if (mtimeMs < state.runStartedAtMs) {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_FILE_PREEXISTS_RUN');
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (state.usedHashes.has(sha256)) {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_REUSE_REFUSED');
  }
  let serialized;
  try {
    serialized = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_UTF8_INVALID');
  }
  let snapshot;
  try {
    snapshot = JSON.parse(serialized);
  } catch {
    throw new Error('PATCH83U_SQL_EDITOR_EVIDENCE_JSON_INVALID');
  }
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('PATCH83U_SQL_EDITOR_EVIDENCE_OBJECT_REQUIRED');
  }
  if (checkpoint === 'immediately_after_password_change_finalization') {
    assertPasswordChangeFinalizationProof(snapshot);
  }
  if (checkpointSchema) {
    assertEvidenceMatchesSchemaContract(snapshot, checkpointSchema);
  }
  const normalized = assertSqlEditorEvidenceSnapshot(
    snapshot,
    checkpoint,
    operatorProjectRef,
    nowMs,
  );
  if (Date.parse(normalized.captured_at) < state.runStartedAtMs) {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_CAPTURE_PREEXISTS_RUN');
  }
  assertCheckpointChronology(state.latestSnapshot, normalized);
  state.usedHashes.add(sha256);
  state.latestSnapshot = normalized;
  state.nextIndex += 1;
  return {
    snapshot: normalized,
    evidence: {
      checkpoint,
      source: 'sql_editor_checkpoint_file',
      checkpoint_file_sha256: sha256,
      checkpoint_file_bytes: bytes.length,
      project_confirmation_passed: true,
      project_ref: operatorProjectRef,
      project_confirmation_gate_id: SQL_EDITOR_PROJECT_CONFIRMATION_GATE_ID,
      transaction_read_only: true,
      prohibited_fields_absent: true,
      observed_at: normalized.captured_at,
    },
  };
}

export async function waitForSqlEditorCheckpointFile({
  checkpoint,
  checkpointDirectory,
  state,
  checkpointSchema,
  operatorProjectRef,
  timeoutMs = SQL_EDITOR_CHECKPOINT_WAIT_TIMEOUT_MS,
  pollIntervalMs = 1_000,
  now = Date.now,
  sleep = (delayMs) => new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs)),
  onWaiting = () => {},
}) {
  const startedAt = now();
  let waitingAnnounced = false;
  while (true) {
    try {
      return await readSqlEditorCheckpointFile({
        checkpoint,
        checkpointDirectory,
        state,
        checkpointSchema,
        operatorProjectRef,
        nowMs: now(),
      });
    } catch (error) {
      if (
        error?.message !== 'PATCH83U_SQL_EDITOR_CHECKPOINT_FILE_MISSING'
        && error?.message !== 'PATCH83U_SQL_EDITOR_CHECKPOINT_FILE_PREEXISTS_RUN'
      ) {
        throw error;
      }
      if (!waitingAnnounced) {
        onWaiting({
          checkpoint,
          expected_file: checkpointFileName(checkpoint),
        });
        waitingAnnounced = true;
      }
      if (now() - startedAt >= timeoutMs) {
        throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_FILE_WAIT_TIMEOUT');
      }
      await sleep(Math.min(pollIntervalMs, Math.max(1, timeoutMs)));
    }
  }
}

export function assertCheckpointFilesReadyForReset(state) {
  if (
    !checkpointFileStateIsValid(state)
    || state.nextIndex !== 2
    || state.usedHashes.size !== 2
    || state.latestSnapshot?.checkpoint !== 'immediately_before_reset'
  ) {
    throw new Error('PATCH83U_CHECKPOINT_FILES_NOT_READY_FOR_RESET');
  }
  return true;
}

export function assertCheckpointInputEvidenceSequence(
  inputs,
  { executionStatus = null } = {},
) {
  if (!Array.isArray(inputs) || inputs.length > SQL_EDITOR_CHECKPOINTS.length) {
    throw new Error('PATCH83U_CHECKPOINT_INPUT_EVIDENCE_INVALID');
  }
  if (
    executionStatus === 'completed'
    && inputs.length !== SQL_EDITOR_CHECKPOINTS.length
  ) {
    throw new Error('PATCH83U_COMPLETED_CHECKPOINT_INPUTS_INCOMPLETE');
  }
  const hashes = new Set();
  inputs.forEach((entry, index) => {
    if (
      entry?.checkpoint !== SQL_EDITOR_CHECKPOINTS[index]
      || entry?.source !== 'sql_editor_checkpoint_file'
      || !SHA256_PATTERN.test(String(entry?.checkpoint_file_sha256 ?? ''))
      || !Number.isSafeInteger(entry?.checkpoint_file_bytes)
      || entry.checkpoint_file_bytes < 1
      || entry.checkpoint_file_bytes > SQL_EDITOR_CHECKPOINT_MAX_BYTES
      || entry?.project_confirmation_passed !== true
      || entry?.project_ref !== STAGING_PROJECT_REF
      || entry?.project_confirmation_gate_id
        !== SQL_EDITOR_PROJECT_CONFIRMATION_GATE_ID
      || entry?.transaction_read_only !== true
      || entry?.prohibited_fields_absent !== true
      || !Number.isFinite(Date.parse(entry?.observed_at))
      || hashes.has(entry.checkpoint_file_sha256)
    ) {
      throw new Error('PATCH83U_CHECKPOINT_INPUT_EVIDENCE_INVALID');
    }
    hashes.add(entry.checkpoint_file_sha256);
  });
  return true;
}

function frozenSourceAggregate(files) {
  const lines = [...files]
    .sort((left, right) => (
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0
    ))
    .map(({ path, sha256, bytes }) => `${path}\t${sha256}\t${bytes}`);
  return createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex');
}

function decodeJsonPointerSegment(segment) {
  return segment.replaceAll('~1', '/').replaceAll('~0', '~');
}

export function readExecutionFreezePointer(value, pointer) {
  if (pointer === '') return { present: true, value };
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) {
    throw new Error('PATCH83U_EXECUTION_FREEZE_POINTER_INVALID');
  }
  let current = value;
  for (const rawSegment of pointer.slice(1).split('/')) {
    const segment = decodeJsonPointerSegment(rawSegment);
    if (
      current === null
      || typeof current !== 'object'
      || !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return { present: false, value: undefined };
    }
    current = current[segment];
  }
  return { present: true, value: current };
}

function schemaRefTarget(rootSchema, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) {
    throw new Error('PATCH83U_EXECUTION_FREEZE_SCHEMA_REF_REFUSED');
  }
  const target = readExecutionFreezePointer(rootSchema, ref.slice(1));
  if (!target.present || !target.value || typeof target.value !== 'object') {
    throw new Error('PATCH83U_EXECUTION_FREEZE_SCHEMA_REF_INVALID');
  }
  return target.value;
}

function jsonValueEquals(left, right) {
  if (Object.is(left, right)) return true;
  if (
    left === null
    || right === null
    || typeof left !== 'object'
    || typeof right !== 'object'
  ) {
    return false;
  }
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) {
    return left.length === right.length
      && left.every((value, index) => jsonValueEquals(value, right[index]));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => (
      key === rightKeys[index] && jsonValueEquals(left[key], right[key])
    ));
}

function valueMatchesSchemaType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null
    && typeof value === 'object'
    && !Array.isArray(value);
  if (type === 'integer') return Number.isSafeInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function validateFreezeSchemaNode(value, schema, rootSchema, pointer, errors) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    errors.push(`${pointer}:schema`);
    return;
  }
  if (schema.$ref !== undefined) {
    validateFreezeSchemaNode(
      value,
      schemaRefTarget(rootSchema, schema.$ref),
      rootSchema,
      pointer,
      errors,
    );
    return;
  }
  if (schema.type !== undefined) {
    const acceptedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!acceptedTypes.some((type) => valueMatchesSchemaType(value, type))) {
      errors.push(`${pointer}:type`);
      return;
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(schema, 'const')
    && !jsonValueEquals(value, schema.const)
  ) {
    errors.push(`${pointer}:const`);
  }
  if (
    Array.isArray(schema.enum)
    && !schema.enum.some((candidate) => jsonValueEquals(value, candidate))
  ) {
    errors.push(`${pointer}:enum`);
  }
  if (typeof value === 'string') {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) {
      errors.push(`${pointer}:minLength`);
    }
    if (typeof schema.pattern === 'string' && !(new RegExp(schema.pattern, 'u')).test(value)) {
      errors.push(`${pointer}:pattern`);
    }
  }
  if (typeof value === 'number' && Number.isFinite(schema.minimum) && value < schema.minimum) {
    errors.push(`${pointer}:minimum`);
  }
  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
      errors.push(`${pointer}:minItems`);
    }
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) {
      errors.push(`${pointer}:maxItems`);
    }
    if (
      schema.uniqueItems === true
      && value.some((candidate, index) => (
        value.slice(0, index).some((earlier) => jsonValueEquals(candidate, earlier))
      ))
    ) {
      errors.push(`${pointer}:uniqueItems`);
    }
    const prefixItems = Array.isArray(schema.prefixItems) ? schema.prefixItems : [];
    prefixItems.forEach((itemSchema, index) => {
      if (index < value.length) {
        validateFreezeSchemaNode(
          value[index],
          itemSchema,
          rootSchema,
          `${pointer}/${index}`,
          errors,
        );
      }
    });
    if (schema.items === false && value.length > prefixItems.length) {
      errors.push(`${pointer}:items`);
    } else if (schema.items && typeof schema.items === 'object') {
      value.slice(prefixItems.length).forEach((item, offset) => {
        const index = prefixItems.length + offset;
        validateFreezeSchemaNode(
          item,
          schema.items,
          rootSchema,
          `${pointer}/${index}`,
          errors,
        );
      });
    }
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties && typeof schema.properties === 'object'
      ? schema.properties
      : {};
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const property of required) {
      if (!Object.prototype.hasOwnProperty.call(value, property)) {
        errors.push(`${pointer}/${property}:required`);
      }
    }
    if (schema.additionalProperties === false) {
      for (const property of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(properties, property)) {
          errors.push(`${pointer}/${property}:additionalProperties`);
        }
      }
    }
    for (const [property, propertySchema] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(value, property)) {
        validateFreezeSchemaNode(
          value[property],
          propertySchema,
          rootSchema,
          `${pointer}/${property}`,
          errors,
        );
      }
    }
  }
}

export function validateExecutionFreezeAgainstSchema(freeze, schema) {
  const errors = [];
  validateFreezeSchemaNode(freeze, schema, schema, '', errors);
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function assertExecutionFreezeConsumedFields(freeze) {
  for (const pointer of EXECUTION_FREEZE_CONSUMED_JSON_POINTERS) {
    if (!readExecutionFreezePointer(freeze, pointer).present) {
      throw new Error(`PATCH83U_EXECUTION_FREEZE_CONSUMED_FIELD_MISSING:${pointer}`);
    }
  }
  return true;
}

export function canonicalUtcFromUnixMs(unixMs) {
  if (!Number.isSafeInteger(unixMs)) {
    throw new Error('PATCH83U_EDGE_TIMESTAMP_UNIX_MS_INVALID');
  }
  const canonical = new Date(unixMs).toISOString();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(canonical)) {
    throw new Error('PATCH83U_EDGE_TIMESTAMP_CANONICALIZATION_FAILED');
  }
  return canonical;
}

function timestampRepresentsUnixMs(value, unixMs) {
  return typeof value === 'string'
    && Number.isFinite(Date.parse(value))
    && Date.parse(value) === unixMs;
}

export function assertExecutionFreezeSemanticContract(freeze) {
  assertExecutionFreezeConsumedFields(freeze);
  assertRun007ConfirmationAndFinalSessionContracts({
    operatorConfirmationContract: freeze.operator_confirmation_contract,
    finalSessionContract: freeze.final_session_contract,
  });
  const metadata = freeze.active_edge_provenance.metadata;
  if (
    canonicalUtcFromUnixMs(metadata.created_at_unix_ms) !== metadata.created_at_utc
    || canonicalUtcFromUnixMs(metadata.updated_at_unix_ms) !== metadata.updated_at_utc
  ) {
    throw new Error('PATCH83U_EXECUTION_FREEZE_EDGE_TIMESTAMP_NOT_CANONICAL');
  }
  if (
    freeze.targets.application_origin !== STAGING_APPLICATION_ORIGIN
    || freeze.targets.staging_supabase_origin !== STAGING_SUPABASE_ORIGIN
    || freeze.run_contract.run_number !== RUN_NUMBER
    || freeze.run_contract.evidence_directory !== RUN007_EVIDENCE_DIRECTORY
    || freeze.run_contract.checkpoint_directory !== SQL_EDITOR_CHECKPOINT_DIRECTORY
    || freeze.run_contract.output_path_pattern !== RUN007_OUTPUT_PATH_PATTERN
    || freeze.run_contract.evidence_schema_path !== RUN007_EVIDENCE_SCHEMA_PATH
    || freeze.run_contract.evidence_schema_version !== RESET_PROOF_SCHEMA_VERSION
    || freeze.proof_contract.path !== RUN007_PROOF_CONTRACT_PATH
    || freeze.proof_contract.schema_version !== RUN007_PROOF_CONTRACT_VERSION
    || freeze.proof_contract.contract_id !== RUN007_PROOF_CONTRACT_ID
    || freeze.checkpoint_schema.path !== RUN007_CHECKPOINT_SCHEMA_PATH
    || freeze.checkpoint_schema.schema_version
      !== 'patch83u-staging-sql-editor-checkpoint-file-v3'
    || freeze.traceability.json_path !== RUN007_TRACEABILITY_PATH
    || freeze.traceability.markdown_path !== RUN007_TRACEABILITY_MARKDOWN_PATH
    || freeze.traceability.schema_version !== RUN007_TRACEABILITY_VERSION
    || freeze.traceability.complete !== true
    || freeze.traceability.coverage_percent !== 100
    || freeze.traceability.requirement_count !== freeze.proof_contract.requirement_count
    || freeze.traceability.mapped_requirement_count !== freeze.proof_contract.requirement_count
    || !SHA256_PATTERN.test(String(freeze.proof_contract.sha256 ?? ''))
    || !SHA256_PATTERN.test(String(freeze.checkpoint_schema.sha256 ?? ''))
    || !SHA256_PATTERN.test(String(freeze.traceability.json_sha256 ?? ''))
    || !SHA256_PATTERN.test(String(freeze.traceability.markdown_sha256 ?? ''))
  ) {
    throw new Error('PATCH83U_EXECUTION_FREEZE_RUN_CONTRACT_MISMATCH');
  }
  if (
    frozenSourceAggregate(freeze.frozen_source.files)
      !== freeze.frozen_source.aggregate_sha256
    || freeze.frozen_source.files.reduce((total, file) => total + file.bytes, 0)
      !== freeze.frozen_source.total_bytes
    || freeze.frozen_source.files.length !== freeze.frozen_source.file_count
    || frozenSourceAggregate(freeze.prior_evidence_integrity.files)
      !== freeze.prior_evidence_integrity.aggregate_sha256
    || freeze.prior_evidence_integrity.files.reduce(
      (total, file) => total + file.bytes,
      0,
    ) !== freeze.prior_evidence_integrity.total_bytes
    || freeze.prior_evidence_integrity.files.length
      !== freeze.prior_evidence_integrity.file_count
  ) {
    throw new Error('PATCH83U_EXECUTION_FREEZE_MANIFEST_CONTRACT_MISMATCH');
  }
  return true;
}

async function verifyRepositoryFileManifest(manifest) {
  const files = Array.isArray(manifest?.files) ? manifest.files : [];
  const paths = files.map((file) => file?.path);
  const sortedPaths = [...paths].sort();
  const shapeExact =
    files.length > 0
    && manifest?.file_count === files.length
    && new Set(paths).size === files.length
    && paths.every((path, index) => path === sortedPaths[index])
    && files.every((file) => (
      typeof file?.path === 'string'
      && SHA256_PATTERN.test(String(file?.sha256 ?? ''))
      && Number.isSafeInteger(file?.bytes)
      && file.bytes >= 0
    ));
  if (!shapeExact) {
    return {
      inventory_shape_exact: false,
      inventory_files_exact: false,
      inventory_aggregate_exact: false,
    };
  }
  const repositoryRoot = resolve(process.cwd());
  const repositoryRealPath = await realpath(repositoryRoot);
  const observed = [];
  let filesExact = true;
  for (const expected of files) {
    try {
      const resolvedPath = resolveRepositoryArtifact(expected.path);
      const resolvedRealPath = await realpath(resolvedPath);
      if (!pathWithinDirectory(repositoryRealPath, resolvedRealPath)) {
        filesExact = false;
        continue;
      }
      const bytes = await readFile(resolvedPath);
      const actual = {
        path: expected.path,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        bytes: bytes.length,
      };
      observed.push(actual);
      if (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes) {
        filesExact = false;
      }
    } catch {
      filesExact = false;
    }
  }
  const observedTotalBytes = observed.reduce((total, file) => total + file.bytes, 0);
  const aggregateExact =
    observed.length === files.length
    && observedTotalBytes === manifest.total_bytes
    && SHA256_PATTERN.test(String(manifest.aggregate_sha256 ?? ''))
    && frozenSourceAggregate(observed) === manifest.aggregate_sha256;
  return {
    inventory_shape_exact: true,
    inventory_files_exact: filesExact && observed.length === files.length,
    inventory_aggregate_exact: aggregateExact,
  };
}

function run007OperatorConfirmationContractIsValid(contract) {
  const runNumber = contract?.run_number;
  const derivedPhrase = Number.isInteger(runNumber)
    ? `EXECUTE RUN ${String(runNumber).padStart(3, '0')} RESET NOW`
    : null;
  return contract?.contract_id === RUN007_OPERATOR_CONFIRMATION_CONTRACT_ID
    && runNumber === RUN_NUMBER
    && contract?.exact_phrase === derivedPhrase
    && contract?.case_sensitive === true
    && contract?.cli_override_supported === false
    && contract?.required_immediately_before_reset === true
    && contract?.evidence_retention === 'boolean_and_contract_id_only';
}

export function assertRun007OperatorConfirmationContract(contract) {
  if (!run007OperatorConfirmationContractIsValid(contract)) {
    throw new Error('PATCH83U_RUN007_OPERATOR_CONFIRMATION_CONTRACT_INVALID');
  }
  return Object.freeze({
    contract_id: contract.contract_id,
    run_number: contract.run_number,
    exact_phrase: contract.exact_phrase,
    case_sensitive: true,
    cli_override_supported: false,
    required_immediately_before_reset: true,
    evidence_retention: 'boolean_and_contract_id_only',
  });
}

export function assertFreezeBoundOperatorConfirmation(candidate, contract) {
  const verifiedContract = assertRun007OperatorConfirmationContract(contract);
  if (
    typeof candidate !== 'string'
    || candidate !== verifiedContract.exact_phrase
  ) {
    throw new Error('PATCH83U_EXACT_RESET_CONFIRMATION_FAILED');
  }
  return {
    contract_id: verifiedContract.contract_id,
    exact_match: true,
  };
}

export function assertRun007ConfirmationAndFinalSessionContracts({
  operatorConfirmationContract,
  finalSessionContract,
}) {
  try {
    return Object.freeze({
      operatorConfirmationContract:
        assertRun007OperatorConfirmationContract(operatorConfirmationContract),
      finalSessionContract:
        assertRun007FinalSessionContract(finalSessionContract),
    });
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_RUN008_CONFIRMATION_AND_FINAL_SESSION_CONTRACTS_FAILED',
      error,
    );
  }
}

export const assertRun008ConfirmationAndFinalSessionContracts =
  assertRun007ConfirmationAndFinalSessionContracts;

async function verifyFrozenSourceInventory(freeze) {
  return verifyRepositoryFileManifest(freeze?.frozen_source);
}

async function pathExists(candidate) {
  try {
    await lstat(candidate);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function verifyRun005OutputAbsence() {
  const run005Directory = resolve(
    process.cwd(),
    'release',
    'patch83u',
    'reset-proof-run-005',
  );
  const checkpointDirectory = resolve(run005Directory, 'checkpoints');
  const checkpointFilesAbsent = (
    await Promise.all(
      Object.values(SQL_EDITOR_CHECKPOINT_FILE_NAMES).map(
        (fileName) => pathExists(resolve(checkpointDirectory, fileName)),
      ),
    )
  ).every((exists) => !exists);
  let attemptOutputFilesAbsent = false;
  try {
    const entries = await readdir(run005Directory, { withFileTypes: true });
    attemptOutputFilesAbsent = entries.every((entry) => (
      !entry.isFile()
      || !/^patch83u-staging-reset-final-results-attempt-[0-9]{3}\.json$/.test(
        entry.name,
      )
    ));
  } catch {
    attemptOutputFilesAbsent = false;
  }
  return {
    checkpoint_files_absent: checkpointFilesAbsent,
    attempt_output_files_absent: attemptOutputFilesAbsent,
  };
}

async function verifyPriorEvidenceIntegrity(freeze) {
  const manifestVerification = await verifyRepositoryFileManifest(
    freeze?.prior_evidence_integrity,
  );
  const actualAbsence = await verifyRun005OutputAbsence();
  const expectedAbsence =
    freeze?.prior_evidence_integrity?.run005_absence_assertions;
  return {
    ...manifestVerification,
    run005_absence_exact:
      expectedAbsence?.checkpoint_files_absent === true
      && expectedAbsence?.attempt_output_files_absent === true
      && actualAbsence.checkpoint_files_absent === true
      && actualAbsence.attempt_output_files_absent === true,
  };
}

async function readRepositoryStateViaGit() {
  try {
    const [branchResult, headResult, stagedResult, statusResult] = await Promise.all([
      execFileAsync('git', ['branch', '--show-current'], {
        encoding: 'utf8',
        windowsHide: true,
      }),
      execFileAsync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
        windowsHide: true,
      }),
      execFileAsync('git', ['diff', '--cached', '--name-only'], {
        encoding: 'utf8',
        windowsHide: true,
      }),
      execFileAsync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
        encoding: 'utf8',
        windowsHide: true,
      }),
    ]);
    const stagedFiles = stagedResult.stdout.split(/\r?\n/).filter(Boolean);
    const statusLines = statusResult.stdout.split(/\r?\n/).filter(Boolean);
    const untrackedCount = statusLines.filter((line) => line.startsWith('??')).length;
    return {
      branch: branchResult.stdout.trim(),
      head: headResult.stdout.trim(),
      working_tree_dirty: statusLines.length > 0,
      tracked_modified_count: statusLines.length - untrackedCount,
      untracked_count: untrackedCount,
      porcelain_entry_count: statusLines.length,
      staged_file_count: stagedFiles.length,
    };
  } catch {
    throw new Error('PATCH83U_REPOSITORY_STATE_READ_FAILED');
  }
}

export function evaluateEdgeDeploymentGate({
  freeze,
  freezeFileSha256,
  authorizedFreezeFileSha256,
  freezeSchemaValidation = {},
  provenance,
  provenanceFileSha256,
  provenanceFileBytes,
  observedMetadata,
  observedDownloadedSource,
  localSource,
  frozenSourceVerification = {},
  priorEvidenceVerification = {},
  evidenceSchemaVerification = {},
  run007ContractVerification = {},
  repositoryState = {},
}) {
  const edge = freeze?.active_edge_provenance;
  const identity = edge?.identity;
  const metadata = edge?.metadata;
  const source = edge?.source;
  const contract = freeze?.runtime_contract;
  const runContract = freeze?.run_contract;
  const comparison = provenance?.comparison;
  const downloaded = provenance?.downloaded_source;
  const reviewedLocal = provenance?.local_source;
  const provenanceScope = provenance?.scope;
  const provenanceMetadata = provenance?.active_metadata;
  const securityContract = provenance?.security_contract;
  const checks = {
    edge_freeze_hash_exact:
      SHA256_PATTERN.test(String(freezeFileSha256 ?? ''))
      && freezeFileSha256 === authorizedFreezeFileSha256,
    edge_freeze_schema_exact:
      freeze?.schema_version === EXECUTION_FREEZE_SCHEMA_VERSION,
    edge_freeze_schema_contract_valid:
      freezeSchemaValidation?.valid === true,
    edge_freeze_readiness_authorized:
      freeze?.readiness_decision === EXECUTION_FREEZE_READY_DECISION
      && freeze?.decision_is_execution_authorization === false,
    edge_staging_project_exact:
      freeze?.targets?.allowed_staging_project_ref === STAGING_PROJECT_REF
      && identity?.project_ref === STAGING_PROJECT_REF
      && observedMetadata?.project_ref === STAGING_PROJECT_REF,
    edge_production_ref_recorded:
      freeze?.targets?.prohibited_production_project_ref === PRODUCTION_PROJECT_REF
      && freeze?.targets?.production_accessed === false,
    edge_application_origin_exact:
      freeze?.targets?.application_origin === STAGING_APPLICATION_ORIGIN
      && freeze?.targets?.staging_supabase_origin === STAGING_SUPABASE_ORIGIN,
    edge_run_contract_exact:
      runContract?.run_number === RUN_NUMBER
      && runContract?.evidence_directory === RUN007_EVIDENCE_DIRECTORY
      && runContract?.checkpoint_directory === SQL_EDITOR_CHECKPOINT_DIRECTORY
      && jsonValueEquals(
        runContract?.checkpoint_files,
        Object.values(SQL_EDITOR_CHECKPOINT_FILE_NAMES),
      )
      && runContract?.output_path_pattern === RUN007_OUTPUT_PATH_PATTERN
      && runContract?.exclusive_create_required === true
      && runContract?.evidence_schema_path === RUN007_EVIDENCE_SCHEMA_PATH
      && runContract?.evidence_schema_version === RESET_PROOF_SCHEMA_VERSION
      && runContract?.frontend_mode === 'staging'
      && runContract?.sql_editor_project_ref_option
        === '--sql-editor-project-ref'
      && runContract?.sql_editor_project_confirmation_gate_id
        === SQL_EDITOR_PROJECT_CONFIRMATION_GATE_ID
      && runContract?.precredential_no_secret_fixture_flag
        === '--precredential-inert-fixture'
      && runContract?.precredential_mode_flag === '--precredential-readiness-only'
      && runContract?.precredential_success_output === PRE_CREDENTIAL_READINESS_PASSED
      && evidenceSchemaVerification?.exact === true,
    edge_repository_state_exact:
      freeze?.repository?.branch === repositoryState?.branch
      && freeze?.repository?.head === repositoryState?.head
      && freeze?.repository?.working_tree_dirty === repositoryState?.working_tree_dirty
      && freeze?.repository?.tracked_modified_count === repositoryState?.tracked_modified_count
      && freeze?.repository?.untracked_count_after_manifest_creation
        === repositoryState?.untracked_count
      && freeze?.repository?.porcelain_entry_count_after_manifest_creation
        === repositoryState?.porcelain_entry_count
      && freeze?.repository?.staged_file_count === 0
      && repositoryState?.staged_file_count === 0,
    edge_frozen_inventory_shape_exact:
      frozenSourceVerification?.inventory_shape_exact === true,
    edge_frozen_files_exact:
      frozenSourceVerification?.inventory_files_exact === true,
    edge_frozen_aggregate_exact:
      frozenSourceVerification?.inventory_aggregate_exact === true,
    edge_prior_evidence_integrity_exact:
      priorEvidenceVerification?.inventory_shape_exact === true
      && priorEvidenceVerification?.inventory_files_exact === true
      && priorEvidenceVerification?.inventory_aggregate_exact === true
      && priorEvidenceVerification?.run005_absence_exact === true,
    edge_run007_proof_contract_complete:
      run007ContractVerification?.passed === true
      && Number.isSafeInteger(run007ContractVerification?.requirement_count)
      && run007ContractVerification.requirement_count > 0
      && run007ContractVerification.mapped_count
        === run007ContractVerification.requirement_count
      && run007ContractVerification.coverage_percent === 100,
    edge_contracts_exact:
      contract?.schema_version === EXPECTED_SCHEMA_VERSION
      && contract?.enforcement_state === 'enforced'
      && contract?.state_version === 5
      && contract?.expected_edge_contract === EXPECTED_EDGE_CONTRACT
      && contract?.compatible_edge_contract === EXPECTED_EDGE_CONTRACT
      && contract?.expected_frontend_contract === EXPECTED_FRONTEND_CONTRACT
      && contract?.compatible_frontend_contract === EXPECTED_FRONTEND_CONTRACT
      && jsonValueEquals(contract?.applied_migrations, REQUIRED_MIGRATIONS)
      && contract?.finalizer?.name === FINALIZER_RPC
      && securityContract?.edge_contract === EXPECTED_EDGE_CONTRACT,
    edge_function_exact:
      identity?.function_name === EDGE_FUNCTION_NAME
      && observedMetadata?.function_name === EDGE_FUNCTION_NAME,
    edge_version_exact:
      Number.isInteger(metadata?.version)
      && observedMetadata?.version === metadata.version,
    edge_status_active:
      metadata?.status === 'ACTIVE'
      && observedMetadata?.status === 'ACTIVE',
    edge_verify_jwt_true:
      metadata?.verify_jwt === true
      && observedMetadata?.verify_jwt === true,
    edge_artifact_hash_exact:
      SHA256_PATTERN.test(String(metadata?.hosted_ezbr_sha256 ?? ''))
      && observedMetadata?.ezbr_sha256 === metadata.hosted_ezbr_sha256
      && provenance?.active_metadata?.hosted_ezbr_sha256
        === metadata.hosted_ezbr_sha256,
    edge_provenance_hash_exact:
      SHA256_PATTERN.test(String(edge?.provenance_record?.sha256 ?? ''))
      && provenanceFileSha256 === edge.provenance_record.sha256
      && provenanceFileBytes === edge.provenance_record.bytes,
    edge_provenance_identity_exact:
      provenance?.schema_version === EDGE_PROVENANCE_SCHEMA_VERSION
      && provenance?.classification === EDGE_PROVENANCE_CLASSIFICATION
      && provenanceScope?.project_ref === STAGING_PROJECT_REF
      && provenanceScope?.function_name === EDGE_FUNCTION_NAME
      && provenanceScope?.production_project_ref === PRODUCTION_PROJECT_REF
      && provenanceScope?.production_accessed === false
      && provenanceScope?.mutation_performed === false,
    edge_provenance_metadata_exact:
      provenanceMetadata?.version === metadata?.version
      && provenanceMetadata?.status === metadata?.status
      && provenanceMetadata?.verify_jwt === true
      && provenanceMetadata?.hosted_ezbr_sha256 === metadata?.hosted_ezbr_sha256
      && provenanceMetadata?.created_at_unix_ms === metadata?.created_at_unix_ms
      && provenanceMetadata?.updated_at_unix_ms === metadata?.updated_at_unix_ms
      && timestampRepresentsUnixMs(
        provenanceMetadata?.created_at_utc,
        metadata?.created_at_unix_ms,
      )
      && timestampRepresentsUnixMs(
        provenanceMetadata?.updated_at_utc,
        metadata?.updated_at_unix_ms,
      )
      && canonicalUtcFromUnixMs(metadata?.created_at_unix_ms)
        === metadata?.created_at_utc
      && canonicalUtcFromUnixMs(metadata?.updated_at_unix_ms)
        === metadata?.updated_at_utc
      && observedMetadata?.created_at_unix_ms === metadata?.created_at_unix_ms
      && observedMetadata?.updated_at_unix_ms === metadata?.updated_at_unix_ms
      && observedMetadata?.created_at_utc === metadata?.created_at_utc
      && observedMetadata?.updated_at_utc === metadata?.updated_at_utc,
    edge_source_hash_exact:
      SHA256_PATTERN.test(String(source?.downloaded?.sha256 ?? ''))
      && source?.downloaded?.sha256 === source?.local?.sha256
      && source?.downloaded?.bytes === source?.local?.bytes
      && downloaded?.sha256 === source?.downloaded?.sha256
      && downloaded?.bytes === source?.downloaded?.bytes
      && reviewedLocal?.sha256 === source?.local?.sha256
      && reviewedLocal?.bytes === source?.local?.bytes
      && localSource?.sha256 === source?.local?.sha256
      && localSource?.bytes === source?.local?.bytes
      && comparison?.byte_identical === true
      && source?.byte_identical === true
      && source?.production_ref_absent === true,
    edge_live_downloaded_source_exact:
      observedDownloadedSource?.sha256 === source?.downloaded?.sha256
      && observedDownloadedSource?.bytes === source?.downloaded?.bytes
      && observedDownloadedSource?.production_ref_absent === true,
    edge_source_security_markers_exact:
      securityContract?.admin_reset_action_present === true
      && securityContract?.required_password_change_action_present === true
      && securityContract?.stable_finalizer_present === true
      && securityContract?.runtime_enforcement_present === true
      && securityContract?.credential_version_checks_present === true
      && securityContract?.session_revocation_proof_present === true
      && securityContract?.service_role_environment_access_is_server_side === true
      && securityContract?.fail_closed_paths_present === true
      && securityContract?.verify_jwt_true_in_hosted_metadata === true
      && securityContract?.verify_jwt_true_in_local_config === true
      && securityContract?.production_ref_absent === true
      && securityContract?.deployed_secret_value_patterns_absent === true
      && securityContract?.required_markers_pass === true
      && edge?.bundle_binding?.raw_entrypoint_binding_proven === true
      && edge?.bundle_binding?.complete_deployment_bundle_binding_proven === false
      && edge?.bundle_binding?.hosted_hash_meaning_as_raw_source_hash_proven === false,
    edge_operator_confirmation_contract_exact:
      run007OperatorConfirmationContractIsValid(
        freeze?.operator_confirmation_contract,
      ),
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    failed: Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name),
  };
}

export function assertEdgeDeploymentGate(input) {
  const result = evaluateEdgeDeploymentGate(input);
  if (result.passed) return result;
  const failureCodes = {
    edge_freeze_hash_exact: 'PATCH83U_EXECUTION_FREEZE_HASH_MISMATCH',
    edge_freeze_schema_exact: 'PATCH83U_EXECUTION_FREEZE_SCHEMA_MISMATCH',
    edge_freeze_schema_contract_valid: 'PATCH83U_EXECUTION_FREEZE_SCHEMA_CONTRACT_INVALID',
    edge_freeze_readiness_authorized: 'PATCH83U_EXECUTION_FREEZE_NOT_READY',
    edge_staging_project_exact: 'PATCH83U_EDGE_STAGING_PROJECT_MISMATCH',
    edge_production_ref_recorded: 'PATCH83U_EXECUTION_FREEZE_TARGET_MISMATCH',
    edge_application_origin_exact: 'PATCH83U_EXECUTION_FREEZE_APPLICATION_ORIGIN_MISMATCH',
    edge_run_contract_exact: 'PATCH83U_EXECUTION_FREEZE_RUN_CONTRACT_MISMATCH',
    edge_repository_state_exact: 'PATCH83U_EXECUTION_REPOSITORY_STATE_MISMATCH',
    edge_frozen_inventory_shape_exact: 'PATCH83U_FROZEN_SOURCE_INVENTORY_INVALID',
    edge_frozen_files_exact: 'PATCH83U_FROZEN_SOURCE_FILE_MISMATCH',
    edge_frozen_aggregate_exact: 'PATCH83U_FROZEN_SOURCE_AGGREGATE_MISMATCH',
    edge_prior_evidence_integrity_exact: 'PATCH83U_PRIOR_EVIDENCE_INTEGRITY_MISMATCH',
    edge_run007_proof_contract_complete: 'PATCH83U_RUN007_PROOF_CONTRACT_INCOMPLETE',
    edge_contracts_exact: 'PATCH83U_EDGE_CONTRACT_MISMATCH',
    edge_function_exact: 'PATCH83U_EDGE_FUNCTION_MISMATCH',
    edge_version_exact: 'PATCH83U_EDGE_VERSION_MISMATCH',
    edge_status_active: 'PATCH83U_EDGE_STATUS_NOT_ACTIVE',
    edge_verify_jwt_true: 'PATCH83U_EDGE_VERIFY_JWT_REQUIRED',
    edge_artifact_hash_exact: 'PATCH83U_EDGE_ARTIFACT_HASH_MISMATCH',
    edge_provenance_hash_exact: 'PATCH83U_EDGE_PROVENANCE_HASH_MISMATCH',
    edge_provenance_identity_exact: 'PATCH83U_EDGE_PROVENANCE_IDENTITY_MISMATCH',
    edge_provenance_metadata_exact: 'PATCH83U_EDGE_PROVENANCE_METADATA_MISMATCH',
    edge_source_hash_exact: 'PATCH83U_EDGE_SOURCE_HASH_MISMATCH',
    edge_live_downloaded_source_exact: 'PATCH83U_EDGE_LIVE_SOURCE_MISMATCH',
    edge_source_security_markers_exact: 'PATCH83U_EDGE_SOURCE_SECURITY_MARKERS_MISMATCH',
    edge_operator_confirmation_contract_exact:
      'PATCH83U_RUN007_OPERATOR_CONFIRMATION_CONTRACT_INVALID',
  };
  throw new Error(failureCodes[result.failed[0]] ?? 'PATCH83U_EDGE_DEPLOYMENT_GATE_FAILED');
}

async function readActiveEdgeMetadataViaSupportedCli({ projectRef, functionName }) {
  if (projectRef !== STAGING_PROJECT_REF || functionName !== EDGE_FUNCTION_NAME) {
    throw new Error('PATCH83U_EDGE_METADATA_TARGET_REFUSED');
  }
  let stdout;
  try {
    ({ stdout } = await execFileAsync(
      'supabase',
      [
        'functions',
        'list',
        '--project-ref',
        STAGING_PROJECT_REF,
        '-o',
        'json',
      ],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30_000,
        maxBuffer: 1_000_000,
      },
    ));
  } catch {
    throw new Error('PATCH83U_EDGE_METADATA_READ_FAILED');
  }
  let rows;
  try {
    rows = JSON.parse(stdout);
  } catch {
    throw new Error('PATCH83U_EDGE_METADATA_JSON_INVALID');
  }
  const matches = Array.isArray(rows)
    ? rows.filter((row) => row?.slug === EDGE_FUNCTION_NAME || row?.name === EDGE_FUNCTION_NAME)
    : [];
  if (matches.length !== 1) {
    throw new Error('PATCH83U_EDGE_METADATA_FUNCTION_NOT_UNIQUE');
  }
  const row = matches[0];
  const createdAtUnixMs = Number(row.created_at);
  const updatedAtUnixMs = Number(row.updated_at);
  return {
    project_ref: STAGING_PROJECT_REF,
    function_name: EDGE_FUNCTION_NAME,
    version: row.version,
    status: row.status,
    verify_jwt: row.verify_jwt,
    ezbr_sha256: row.ezbr_sha256,
    created_at_unix_ms: createdAtUnixMs,
    created_at_utc: canonicalUtcFromUnixMs(createdAtUnixMs),
    updated_at_unix_ms: updatedAtUnixMs,
    updated_at_utc: canonicalUtcFromUnixMs(updatedAtUnixMs),
  };
}

async function downloadActiveEdgeSourceViaSupportedCli({
  projectRef,
  functionName,
}) {
  if (projectRef !== STAGING_PROJECT_REF || functionName !== EDGE_FUNCTION_NAME) {
    throw new Error('PATCH83U_EDGE_SOURCE_DOWNLOAD_TARGET_REFUSED');
  }
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'patch83u-edge-source-readonly-'),
  );
  try {
    try {
      await execFileAsync(
        'supabase',
        [
          'functions',
          'download',
          EDGE_FUNCTION_NAME,
          '--project-ref',
          STAGING_PROJECT_REF,
          '--use-api',
          '--workdir',
          temporaryDirectory,
          '--yes',
        ],
        {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 60_000,
          maxBuffer: 1_000_000,
        },
      );
    } catch {
      throw new Error('PATCH83U_EDGE_SOURCE_DOWNLOAD_FAILED');
    }
    const candidatePaths = [
      join(
        temporaryDirectory,
        'supabase',
        'functions',
        EDGE_FUNCTION_NAME,
        'index.ts',
      ),
      join(temporaryDirectory, 'functions', EDGE_FUNCTION_NAME, 'index.ts'),
    ];
    let sourceBytes = null;
    for (const candidatePath of candidatePaths) {
      try {
        const candidateRealPath = await realpath(candidatePath);
        if (!pathWithinDirectory(temporaryDirectory, candidateRealPath)) {
          throw new Error('PATCH83U_EDGE_SOURCE_DOWNLOAD_PATH_REFUSED');
        }
        const candidateStat = await lstat(candidateRealPath);
        if (!candidateStat.isFile() || candidateStat.isSymbolicLink()) {
          throw new Error('PATCH83U_EDGE_SOURCE_DOWNLOAD_PATH_REFUSED');
        }
        sourceBytes = await readFile(candidateRealPath);
        break;
      } catch (error) {
        if (
          error?.code !== 'ENOENT'
          && error?.message !== 'PATCH83U_EDGE_SOURCE_DOWNLOAD_PATH_REFUSED'
        ) {
          throw error;
        }
        if (error?.message === 'PATCH83U_EDGE_SOURCE_DOWNLOAD_PATH_REFUSED') {
          throw error;
        }
      }
    }
    if (!sourceBytes) {
      throw new Error('PATCH83U_EDGE_SOURCE_DOWNLOAD_ENTRYPOINT_MISSING');
    }
    return {
      sha256: createHash('sha256').update(sourceBytes).digest('hex'),
      bytes: sourceBytes.length,
      production_ref_absent:
        !sourceBytes.toString('utf8').includes(PRODUCTION_PROJECT_REF),
    };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function loadEdgeGateArtifactsFromRepository(args) {
  if (
    args.executionFreeze.replaceAll('\\', '/') !== EXECUTION_FREEZE_PATH
  ) {
    throw new Error('PATCH83U_EXECUTION_FREEZE_PATH_REFUSED');
  }
  const freezePath = resolvePatch83uReleaseArtifact(
    args.executionFreeze,
    'PATCH83U_EXECUTION_FREEZE_PATH_REFUSED',
  );
  const freezeBytes = await readFile(freezePath);
  const freezeFileSha256 = createHash('sha256').update(freezeBytes).digest('hex');
  let freeze;
  try {
    freeze = JSON.parse(freezeBytes.toString('utf8'));
  } catch {
    throw new Error('PATCH83U_EXECUTION_FREEZE_JSON_INVALID');
  }
  const freezeSchemaPath = resolvePatch83uReleaseArtifact(
    EXECUTION_FREEZE_SCHEMA_PATH,
    'PATCH83U_EXECUTION_FREEZE_SCHEMA_PATH_REFUSED',
  );
  let freezeSchema;
  try {
    freezeSchema = JSON.parse(await readFile(freezeSchemaPath, 'utf8'));
  } catch {
    throw new Error('PATCH83U_EXECUTION_FREEZE_SCHEMA_JSON_INVALID');
  }
  const freezeSchemaValidation = validateExecutionFreezeAgainstSchema(
    freeze,
    freezeSchema,
  );
  if (!freezeSchemaValidation.valid) {
    throw new Error(
      `PATCH83U_EXECUTION_FREEZE_SCHEMA_CONTRACT_INVALID:`
      + `${freezeSchemaValidation.errors[0] ?? 'UNKNOWN'}`,
    );
  }
  assertExecutionFreezeSemanticContract(freeze);
  const provenancePath = resolvePatch83uReleaseArtifact(
    freeze?.active_edge_provenance?.provenance_record?.path,
    'PATCH83U_EDGE_PROVENANCE_PATH_REFUSED',
  );
  const provenanceBytes = await readFile(provenancePath);
  const provenanceFileSha256 =
    createHash('sha256').update(provenanceBytes).digest('hex');
  let provenance;
  try {
    provenance = JSON.parse(provenanceBytes.toString('utf8'));
  } catch {
    throw new Error('PATCH83U_EDGE_PROVENANCE_JSON_INVALID');
  }
  const localSourceBytes = await readFile(
    resolve(process.cwd(), 'supabase', 'functions', EDGE_FUNCTION_NAME, 'index.ts'),
  );
  const localSource = {
    sha256: createHash('sha256').update(localSourceBytes).digest('hex'),
    bytes: localSourceBytes.length,
  };
  const evidenceSchemaPath = resolvePatch83uReleaseArtifact(
    freeze?.run_contract?.evidence_schema_path,
    'PATCH83U_RESET_EVIDENCE_SCHEMA_PATH_REFUSED',
  );
  const evidenceSchemaBytes = await readFile(evidenceSchemaPath);
  let evidenceSchema;
  try {
    evidenceSchema = JSON.parse(evidenceSchemaBytes.toString('utf8'));
  } catch {
    throw new Error('PATCH83U_RESET_EVIDENCE_SCHEMA_JSON_INVALID');
  }
  const evidenceSchemaVerification = {
    exact:
      createHash('sha256').update(evidenceSchemaBytes).digest('hex')
        === freeze?.run_contract?.evidence_schema_sha256
      && evidenceSchemaBytes.length === freeze?.run_contract?.evidence_schema_bytes
      && evidenceSchema?.properties?.schema_version?.const
        === freeze?.run_contract?.evidence_schema_version,
  };
  const run007ContractVerification = await verifyRun007ContractArtifacts({
    freeze,
    repositoryRoot: process.cwd(),
  });
  const [
    frozenSourceVerification,
    priorEvidenceVerification,
    repositoryState,
  ] = await Promise.all([
    verifyFrozenSourceInventory(freeze),
    verifyPriorEvidenceIntegrity(freeze),
    readRepositoryStateViaGit(),
  ]);
  return {
    freeze,
    freezeFileSha256,
    authorizedFreezeFileSha256: args.executionFreezeSha256,
    freezeSchemaValidation,
    provenance,
    provenanceFileSha256,
    provenanceFileBytes: provenanceBytes.length,
    localSource,
    frozenSourceVerification,
    priorEvidenceVerification,
    evidenceSchemaVerification,
    run007ContractVerification,
    repositoryState,
  };
}

export async function prepareEdgeDeploymentGate(args, adapters = {}) {
  const loadEdgeGateArtifacts =
    adapters.loadEdgeGateArtifacts ?? loadEdgeGateArtifactsFromRepository;
  const artifactInputs = await loadEdgeGateArtifacts(args);
  const readActiveEdgeMetadata =
    adapters.readActiveEdgeMetadata ?? readActiveEdgeMetadataViaSupportedCli;
  const downloadActiveEdgeSource =
    adapters.downloadActiveEdgeSource ?? downloadActiveEdgeSourceViaSupportedCli;
  const [observedMetadata, observedDownloadedSource] = await Promise.all([
    readActiveEdgeMetadata({
      projectRef: STAGING_PROJECT_REF,
      functionName: EDGE_FUNCTION_NAME,
    }),
    downloadActiveEdgeSource({
      projectRef: STAGING_PROJECT_REF,
      functionName: EDGE_FUNCTION_NAME,
    }),
  ]);
  const result = assertEdgeDeploymentGate({
    ...artifactInputs,
    observedMetadata,
    observedDownloadedSource,
  });
  const projectConfirmation = assertSqlEditorProjectConfirmation({
    projectRef: args.sqlEditorProjectRef,
    supabaseUrl: args.supabaseUrl,
    freeze: artifactInputs.freeze,
  });
  const {
    operatorConfirmationContract,
    finalSessionContract,
  } = assertRun007ConfirmationAndFinalSessionContracts({
    operatorConfirmationContract:
      artifactInputs.freeze?.operator_confirmation_contract,
    finalSessionContract: artifactInputs.freeze?.final_session_contract,
  });
  return {
    ...result,
    operatorConfirmationContract,
    finalSessionContract,
    projectConfirmation,
    observed_at: new Date().toISOString(),
  };
}

export function hashRequestId(requestId) {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(requestId)) {
    throw new Error('PATCH83U_UNSAFE_REQUEST_ID');
  }
  return createHash('sha256').update(requestId, 'utf8').digest('hex');
}

export function inspectResetActionEnvelope(body) {
  const payload = body?.payload;
  if (
    body?.action !== ADMIN_RESET_ACTION
    || !payload
    || typeof payload !== 'object'
    || payload.user_id !== TARGET_USER_ID
    || payload.employee_id_confirmation !== TARGET_EMPLOYEE_ID
    || payload.confirmation !== 'PATCH83U_RESET_USER_PASSWORD'
    || typeof payload.request_id !== 'string'
  ) {
    throw new Error('PATCH83U_RESET_REQUEST_CONTRACT_REFUSED');
  }
  hashRequestId(payload.request_id);
  return payload.request_id;
}

export function inspectRequiredPasswordChangeEnvelope(
  body,
  { currentPassword, newPassword },
) {
  const payload = body?.payload;
  if (
    body?.action !== REQUIRED_PASSWORD_CHANGE_ACTION
    || !payload
    || typeof payload !== 'object'
    || typeof payload.current_password !== 'string'
    || typeof payload.new_password !== 'string'
    || typeof payload.confirm_new_password !== 'string'
    || payload.current_password !== currentPassword
    || payload.new_password !== newPassword
    || payload.confirm_new_password !== newPassword
    || payload.current_password === payload.new_password
    || typeof payload.request_id !== 'string'
  ) {
    throw new Error('PATCH83U_PASSWORD_CHANGE_REQUEST_CONTRACT_REFUSED');
  }
  hashRequestId(payload.request_id);
  return payload.request_id;
}

export function assertSqlEditorEvidenceSnapshot(
  snapshot,
  checkpoint,
  operatorProjectRef,
  nowMs = Date.now(),
) {
  if (!SQL_EDITOR_CHECKPOINTS.includes(checkpoint)) {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_UNKNOWN');
  }
  if (operatorProjectRef === PRODUCTION_PROJECT_REF) {
    throw new Error('PATCH83U_PRODUCTION_SQL_EDITOR_TARGET_REFUSED');
  }
  if (operatorProjectRef !== STAGING_PROJECT_REF) {
    throw new Error('PATCH83U_STAGING_SQL_EDITOR_TARGET_NOT_CONFIRMED');
  }
  assertSecretSafeEvidence(snapshot);
  walk(snapshot, (value, path, isKey) => {
    if (!isKey && typeof value === 'string' && value.includes(PRODUCTION_PROJECT_REF)) {
      throw new Error(`PATCH83U_PRODUCTION_SQL_EDITOR_EVIDENCE_REFUSED:${path}`);
    }
  });
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('PATCH83U_SQL_EDITOR_EVIDENCE_OBJECT_REQUIRED');
  }
  if (
    snapshot.checkpoint !== checkpoint
    || snapshot.expected_project_ref !== STAGING_PROJECT_REF
    || snapshot.operator_project_confirmation_required !== true
    || snapshot.transaction_read_only !== true
  ) {
    throw new Error('PATCH83U_SQL_EDITOR_EVIDENCE_GATE_FAILED');
  }
  const capturedAt = Date.parse(snapshot.captured_at);
  if (!Number.isFinite(capturedAt)) {
    throw new Error('PATCH83U_SQL_EDITOR_EVIDENCE_TIMESTAMP_INVALID');
  }
  if (
    !Number.isFinite(nowMs)
    || capturedAt < nowMs - SQL_EDITOR_EVIDENCE_MAX_AGE_MS
    || capturedAt > nowMs + SQL_EDITOR_EVIDENCE_MAX_FUTURE_SKEW_MS
  ) {
    throw new Error('PATCH83U_SQL_EDITOR_EVIDENCE_NOT_FRESH');
  }
  const normalized = {
    ...snapshot,
    project_ref: operatorProjectRef,
    database_target_verified_by_operator: true,
  };
  assertSecretSafeEvidence(normalized);
  return normalized;
}

export function assertCheckpointChronology(previous, current) {
  if (!previous) return true;
  const previousAt = Date.parse(previous.captured_at);
  const currentAt = Date.parse(current.captured_at);
  if (!Number.isFinite(previousAt) || !Number.isFinite(currentAt) || currentAt < previousAt) {
    throw new Error('PATCH83U_SQL_EDITOR_EVIDENCE_CHRONOLOGY_FAILED');
  }
  return true;
}

function normalizedKnownSecrets(knownSecrets) {
  return knownSecrets
    .map((secret) => secret instanceof SecretValue ? secret.reveal() : String(secret ?? ''))
    .filter(Boolean);
}

export function assertSecretSafeEvidence(value, { knownSecrets = [] } = {}) {
  const secretValues = normalizedKnownSecrets(knownSecrets);
  walk(value, (candidate, path, isKey) => {
    if (isKey) {
      if (evidenceKeyIsProhibited(candidate)) {
        throw new Error(`PATCH83U_PROHIBITED_EVIDENCE_KEY:${path}`);
      }
      return;
    }
    if (typeof candidate !== 'string') return;
    if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(candidate))) {
      throw new Error(`PATCH83U_SECRET_SHAPED_VALUE_REFUSED:${path}`);
    }
    if (secretValues.some((secret) => secret.length > 0 && candidate.includes(secret))) {
      throw new Error(`PATCH83U_KNOWN_SECRET_REFUSED:${path}`);
    }
  });
  return true;
}

export function serializeRedactedEvidence(value, options = {}) {
  assertSecretSafeEvidence(value, options);
  return `${JSON.stringify(value, null, 2)}\n`;
}

function resolveSchemaReference(schema, root) {
  if (!schema?.$ref) return schema;
  if (!schema.$ref.startsWith('#/')) throw new Error('PATCH83U_EXTERNAL_SCHEMA_REF_REFUSED');
  return schema.$ref.slice(2).split('/').reduce((node, part) => node?.[part], root);
}

function schemaTypeMatches(value, expected) {
  if (expected === 'null') return value === null;
  if (expected === 'array') return Array.isArray(value);
  if (expected === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (expected === 'integer') return Number.isInteger(value);
  return typeof value === expected;
}

function validateSchemaNode(value, unresolvedSchema, root, path) {
  const schema = resolveSchemaReference(unresolvedSchema, root);
  if (!schema) throw new Error(`PATCH83U_SCHEMA_REFERENCE_INVALID:${path}`);
  if (Array.isArray(schema.oneOf)) {
    let matchingBranches = 0;
    for (const branch of schema.oneOf) {
      try {
        validateSchemaNode(value, branch, root, path);
        matchingBranches += 1;
      } catch {
        // A oneOf branch is expected to fail when it does not describe this phase.
      }
    }
    if (matchingBranches !== 1) {
      throw new Error(`PATCH83U_SCHEMA_ONE_OF_FAILED:${path}`);
    }
  }
  if ('const' in schema && value !== schema.const) {
    throw new Error(`PATCH83U_SCHEMA_CONST_FAILED:${path}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    throw new Error(`PATCH83U_SCHEMA_ENUM_FAILED:${path}`);
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => schemaTypeMatches(value, type))) {
      throw new Error(`PATCH83U_SCHEMA_TYPE_FAILED:${path}`);
    }
  }
  if (typeof value === 'string') {
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) {
      throw new Error(`PATCH83U_SCHEMA_PATTERN_FAILED:${path}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      throw new Error(`PATCH83U_SCHEMA_MAX_LENGTH_FAILED:${path}`);
    }
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      throw new Error(`PATCH83U_SCHEMA_MINIMUM_FAILED:${path}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      throw new Error(`PATCH83U_SCHEMA_MAXIMUM_FAILED:${path}`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      throw new Error(`PATCH83U_SCHEMA_MIN_ITEMS_FAILED:${path}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      throw new Error(`PATCH83U_SCHEMA_MAX_ITEMS_FAILED:${path}`);
    }
    if (schema.items) {
      value.forEach((item, index) => validateSchemaNode(item, schema.items, root, `${path}[${index}]`));
    }
  } else if (value && typeof value === 'object') {
    for (const required of schema.required ?? []) {
      if (!(required in value)) throw new Error(`PATCH83U_SCHEMA_REQUIRED_FAILED:${path}.${required}`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties?.[key]) {
        validateSchemaNode(child, schema.properties[key], root, `${path}.${key}`);
      } else if (schema.additionalProperties === false) {
        throw new Error(`PATCH83U_SCHEMA_ADDITIONAL_PROPERTY_REFUSED:${path}.${key}`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        validateSchemaNode(child, schema.additionalProperties, root, `${path}.${key}`);
      }
    }
  }
}

function completedCredentialProofMatches(
  proof,
  {
    credentialState,
    credentialVersion,
    sessionCount,
    refreshCount,
  },
) {
  return proof?.credential_state === credentialState
    && proof?.database_credential_version === credentialVersion
    && proof?.auth_credential_version === credentialVersion
    && proof?.requested_lifecycle === 'active'
    && proof?.session_count === sessionCount
    && proof?.unrevoked_refresh_token_count === refreshCount
    && proof?.role === 'employee'
    && proof?.scope === 'assigned_only'
    && Number.isFinite(Date.parse(proof?.observed_at));
}

export function assertCompletedExecutionEvidence(evidence) {
  const requiredBlocks = [
    'preflight',
    'reset',
    'revocation',
    'forced_password_change_gate',
    'password_change',
    'fresh_login',
    'audit',
    'employee_contexts_before_reset',
    'operator_confirmation',
    'browser_diagnostics',
  ];
  if (
    evidence?.execution_status !== 'completed'
    || !SHA256_PATTERN.test(String(evidence?.request_id_hash ?? ''))
    || requiredBlocks.some((key) => !evidence?.[key])
  ) {
    throw new Error('PATCH83U_COMPLETED_EVIDENCE_CONTRACT_FAILED');
  }

  const preflightChecks = Object.values(evidence.preflight?.checks ?? {});
  if (
    evidence.preflight?.passed !== true
    || !Array.isArray(evidence.preflight?.failed)
    || evidence.preflight.failed.length !== 0
    || preflightChecks.length === 0
    || preflightChecks.some((passed) => passed !== true)
  ) {
    throw new Error('PATCH83U_COMPLETED_PREFLIGHT_NOT_PROVEN');
  }

  assertControlledEmployeeContextProofs(evidence.employee_contexts_before_reset);
  if (
    evidence.operator_confirmation?.contract_id
      !== RUN007_OPERATOR_CONFIRMATION_CONTRACT_ID
    || evidence.operator_confirmation?.exact_match !== true
  ) {
    throw new Error('PATCH83U_COMPLETED_OPERATOR_CONFIRMATION_NOT_PROVEN');
  }

  const reset = evidence.reset;
  if (
    reset?.submitted !== true
    || reset?.submission_count !== 1
    || !Number.isSafeInteger(reset?.http_status)
    || reset.http_status < 200
    || reset.http_status >= 300
    || reset?.safe_error_code !== null
    || reset?.edge_success_confirmed !== true
    || reset?.checkpoint_classification !== 'admin_reset_change_required'
    || reset?.checkpoint_success_confirmed !== true
    || reset?.protected_transition_completed !== true
    || reset?.request_correlation_proven !== true
    || reset?.post_submission_cleanup_succeeded !== true
    || reset?.progression_allowed !== true
    || !completedCredentialProofMatches(reset?.terminal_proof, {
      credentialState: 'admin_reset_change_required',
      credentialVersion: POST_RESET_CREDENTIAL_VERSION,
      sessionCount: 0,
      refreshCount: 0,
    })
  ) {
    throw new Error('PATCH83U_COMPLETED_RESET_PROOF_INVALID');
  }

  const revocation = evidence.revocation;
  const refreshReplayLabels = Array.isArray(revocation?.refresh_replay_results)
    ? revocation.refresh_replay_results.map((result) => result?.label)
    : [];
  if (
    revocation?.old_permanent_login_failed !== true
    || revocation?.stale_context_1_denied !== true
    || revocation?.stale_context_2_denied !== true
    || !Number.isSafeInteger(revocation?.old_permanent_login_http_status)
    || revocation.old_permanent_login_http_status < 400
    || revocation.old_permanent_login_http_status >= 500
    || typeof revocation?.old_permanent_login_safe_error_code !== 'string'
    || revocation?.database_session_count !== 0
    || revocation?.unrevoked_refresh_token_count !== 0
    || refreshReplayLabels.length !== CONTROLLED_EMPLOYEE_CONTEXT_LABELS.length
    || new Set(refreshReplayLabels).size !== CONTROLLED_EMPLOYEE_CONTEXT_LABELS.length
    || CONTROLLED_EMPLOYEE_CONTEXT_LABELS.some(
      (label) => !refreshReplayLabels.includes(label),
    )
  ) {
    throw new Error('PATCH83U_COMPLETED_REVOCATION_PROOF_INVALID');
  }
  assertRejectedRefreshReplays(revocation.refresh_replay_results);
  if (!evaluateStaleEmployeeContextProofs(revocation.stale_contexts).passed) {
    throw new Error('PATCH83U_COMPLETED_STALE_CONTEXT_PROOF_INVALID');
  }

  const forcedGate = evidence.forced_password_change_gate;
  const forcedSurfaceProof = evaluateForcedPasswordChangeSurfaceProof(forcedGate);
  if (
    forcedGate?.temporary_login_succeeded !== true
    || forcedGate?.forced_change_only !== true
    || forcedGate?.normal_application_access_denied !== true
    || forcedGate?.nonpersistent_context !== true
    || forcedGate?.authenticated_user_id !== TARGET_USER_ID
    || !forcedSurfaceProof.passed
  ) {
    throw new Error('PATCH83U_COMPLETED_FORCED_CHANGE_GATE_INVALID');
  }

  const passwordChange = evidence.password_change;
  assertPasswordChangeFinalizationProof({ target: passwordChange });
  if (
    passwordChange?.submitted !== true
    || !Number.isSafeInteger(passwordChange?.submission_count)
    || passwordChange.submission_count < 1
    || passwordChange.submission_count > PASSWORD_CHANGE_MAX_ATTEMPTS
    || passwordChange?.attempt_count !== passwordChange.submission_count
    || passwordChange?.policy_rejection_count !== passwordChange.attempt_count - 1
    || !Array.isArray(passwordChange?.policy_error_codes)
    || passwordChange.policy_error_codes.length
      !== passwordChange.policy_rejection_count
    || passwordChange.policy_error_codes.some(
      (code) => code !== PERMANENT_PASSWORD_POLICY_ERROR_CODE,
    )
    || !Number.isSafeInteger(passwordChange?.http_status)
    || passwordChange.http_status < 200
    || passwordChange.http_status >= 300
    || passwordChange?.safe_error_code !== null
    || passwordChange?.browser_signed_out !== true
    || !completedCredentialProofMatches(passwordChange?.terminal_proof, {
      credentialState: 'active',
      credentialVersion: FINAL_CREDENTIAL_VERSION,
      sessionCount: 0,
      refreshCount: 0,
    })
  ) {
    throw new Error('PATCH83U_COMPLETED_PASSWORD_CHANGE_PROOF_INVALID');
  }
  assertPasswordChangeCompletionProof({
    passwordChange,
    audit: evidence.audit?.after_password_change,
  });

  const freshLogin = evidence.fresh_login;
  assertFinalEmployeeAuthorizationProof({
    authentication_succeeded: freshLogin?.permanent_login_succeeded,
    permitted_employee_page_accessible:
      freshLogin?.permitted_employee_page_accessible,
    admin_route_denied: freshLogin?.admin_route_denied,
    admin_redirect_destination_permitted:
      freshLogin?.admin_redirect_destination_permitted,
    admin_navigation_absent: freshLogin?.admin_navigation_absent,
    user_management_absent: freshLogin?.user_management_absent,
    access_control_absent: freshLogin?.access_control_absent,
    provisioning_controls_absent: freshLogin?.provisioning_controls_absent,
  });
  assertFinalFreshLoginCounts(
    {
      target: {
        session_count: freshLogin?.database_session_count,
        unrevoked_refresh_token_count:
          freshLogin?.unrevoked_refresh_token_count,
      },
    },
    {
      checkpoint: 'after_fresh_employee_login',
      expected_session_count: EXPECTED_FINAL_SESSION_COUNT,
      expected_unrevoked_refresh_token_count:
        EXPECTED_FINAL_UNREVOKED_REFRESH_TOKEN_COUNT,
      enforcement: 'exact_integer_equality',
      cli_override_supported: false,
    },
  );
  if (
    freshLogin?.nonpersistent_context !== true
    || freshLogin?.authenticated_user_id !== TARGET_USER_ID
    || freshLogin?.role !== 'employee'
    || freshLogin?.scope !== 'assigned_only'
    || freshLogin?.database_credential_version !== FINAL_CREDENTIAL_VERSION
    || freshLogin?.auth_credential_version !== FINAL_CREDENTIAL_VERSION
    || freshLogin?.authorized_route !== CONTROLLED_EMPLOYEE_REDIRECT_PAGE
    || !Number.isFinite(Date.parse(freshLogin?.observed_at))
  ) {
    throw new Error('PATCH83U_COMPLETED_FRESH_LOGIN_PROOF_INVALID');
  }

  if (
    !evidence.audit?.after_reset
    || !evidence.audit?.after_password_change
    || !SHA256_PATTERN.test(
      String(evidence.password_change?.request_id_hash ?? ''),
    )
  ) {
    throw new Error('PATCH83U_COMPLETED_AUDIT_PROOF_INCOMPLETE');
  }
  assertAuditCheckpoint(
    { audit: evidence.audit.after_reset },
    {
      kind: 'admin_reset',
      requestIdHash: evidence.request_id_hash,
    },
  );
  assertAuditCheckpoint(
    { audit: evidence.audit.after_password_change },
    {
      kind: 'password_change',
      requestIdHash: evidence.password_change.request_id_hash,
    },
  );
  if (evidence.browser_diagnostics?.safe !== true) {
    throw new Error('PATCH83U_COMPLETED_BROWSER_DIAGNOSTICS_NOT_CLEAN');
  }
  assertBrowserDiagnosticsSafe({ diagnostics: evidence.browser_diagnostics });
  return true;
}

export function assertEvidenceMatchesSchemaContract(evidence, schema, options = {}) {
  assertSecretSafeEvidence(evidence, options);
  validateSchemaNode(evidence, schema, schema, '$');
  if (
    schema?.properties?.schema_version?.const === RESET_PROOF_SCHEMA_VERSION
    && Object.hasOwn(evidence ?? {}, 'checkpoint_inputs')
  ) {
    assertCheckpointInputEvidenceSequence(
      evidence.checkpoint_inputs,
      { executionStatus: evidence.execution_status },
    );
    if (evidence.execution_status === 'completed') {
      assertCompletedExecutionEvidence(evidence);
    }
  }
  return true;
}

export class SecretValue {
  #bytes;

  constructor(value) {
    if (!(typeof value === 'string' || Buffer.isBuffer(value)) || value.length === 0) {
      throw new Error('PATCH83U_EMPTY_SECRET_REFUSED');
    }
    this.#bytes = Buffer.from(value);
  }

  reveal() {
    if (!this.#bytes) throw new Error('PATCH83U_SECRET_ALREADY_CLEARED');
    return this.#bytes.toString('utf8');
  }

  equals(other) {
    return other instanceof SecretValue && this.reveal() === other.reveal();
  }

  clear() {
    if (this.#bytes) this.#bytes.fill(0);
    this.#bytes = undefined;
  }
}

export async function promptHidden(label, { input = process.stdin, output = process.stderr } = {}) {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('PATCH83U_INTERACTIVE_TTY_REQUIRED');
  }
  output.write(label);
  const bytes = [];
  const previousRaw = input.isRaw;
  input.setRawMode(true);
  input.resume();
  try {
    await new Promise((resolve, reject) => {
      const onData = (chunk) => {
        for (const byte of chunk) {
          if (byte === 3) {
            cleanup();
            reject(new Error('PATCH83U_OPERATOR_CANCELLED'));
            return;
          }
          if (byte === 13 || byte === 10) {
            cleanup();
            resolve();
            return;
          }
          if (byte === 8 || byte === 127) bytes.pop();
          else if (byte >= 32) bytes.push(byte);
        }
      };
      const cleanup = () => input.off('data', onData);
      input.on('data', onData);
    });
  } finally {
    input.setRawMode(Boolean(previousRaw));
    input.pause();
    output.write('\n');
  }
  const result = Buffer.from(bytes);
  bytes.fill(0);
  if (result.length === 0) {
    result.fill(0);
    throw new Error('PATCH83U_EMPTY_SECRET_REFUSED');
  }
  const secret = new SecretValue(result.toString('utf8'));
  result.fill(0);
  return secret;
}

export function assertResetReasonSafe(reason, secrets) {
  const trimmed = String(reason ?? '').trim();
  if (trimmed.length < 1 || trimmed.length > 500) {
    throw new Error('PATCH83U_RESET_REASON_INVALID');
  }
  const lowerReason = trimmed.toLocaleLowerCase();
  for (const secret of secrets) {
    const value = secret instanceof SecretValue ? secret.reveal() : String(secret ?? '');
    if (value && lowerReason.includes(value.toLocaleLowerCase())) {
      throw new Error('PATCH83U_RESET_REASON_CONTAINS_CREDENTIAL');
    }
  }
  return trimmed;
}

function exactRoleScope(subject, role, scope) {
  return subject?.role === role && subject?.scope === scope && subject?.active_role_count === 1;
}

export function evaluateControlledEmployeeContextProofs(proofs) {
  const requiredBooleanFields = [
    'nonpersistent_context',
    'authentication_succeeded',
    'refresh_succeeded',
    'permitted_employee_page_accessible',
    'admin_route_denied',
    'admin_redirect_destination_permitted',
    'admin_navigation_absent',
    'user_management_absent',
    'access_control_absent',
    'provisioning_controls_absent',
  ];
  const labels = Array.isArray(proofs) ? proofs.map((proof) => proof?.label) : [];
  const checks = {
    exact_context_count: Array.isArray(proofs) && proofs.length === 2,
    exact_unique_context_labels:
      labels.length === CONTROLLED_EMPLOYEE_CONTEXT_LABELS.length
      && new Set(labels).size === CONTROLLED_EMPLOYEE_CONTEXT_LABELS.length
      && CONTROLLED_EMPLOYEE_CONTEXT_LABELS.every((label) => labels.includes(label)),
  };
  for (const label of CONTROLLED_EMPLOYEE_CONTEXT_LABELS) {
    const proof = Array.isArray(proofs)
      ? proofs.find((candidate) => candidate?.label === label)
      : null;
    for (const field of requiredBooleanFields) {
      checks[`${label}_${field}`] = proof?.[field] === true;
    }
  }
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    failed: Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name),
  };
}

export function assertControlledEmployeeContextProofs(proofs) {
  const result = evaluateControlledEmployeeContextProofs(proofs);
  if (!result.passed) {
    throw new Error('PATCH83U_CONTROLLED_EMPLOYEE_CONTEXT_PROOF_FAILED');
  }
  return result;
}

export function assertFinalEmployeeAuthorizationProof(proof) {
  const requiredBooleanFields = [
    'authentication_succeeded',
    'permitted_employee_page_accessible',
    'admin_route_denied',
    'admin_redirect_destination_permitted',
    'admin_navigation_absent',
    'user_management_absent',
    'access_control_absent',
    'provisioning_controls_absent',
  ];
  if (requiredBooleanFields.some((field) => proof?.[field] !== true)) {
    throw new Error('PATCH83U_FINAL_EMPLOYEE_AUTHORIZATION_PROOF_FAILED');
  }
  return true;
}

export function evaluateStaleEmployeeContextProofs(proofs) {
  const requiredBooleanFields = [
    'authenticated_user_absent',
    'sign_in_visible',
    'employee_content_absent',
    'admin_content_absent',
    'protected_route_access_denied',
  ];
  const labels = Array.isArray(proofs) ? proofs.map((proof) => proof?.label) : [];
  const checks = {
    exact_context_count: Array.isArray(proofs) && proofs.length === 2,
    exact_unique_context_labels:
      labels.length === CONTROLLED_EMPLOYEE_CONTEXT_LABELS.length
      && new Set(labels).size === CONTROLLED_EMPLOYEE_CONTEXT_LABELS.length
      && CONTROLLED_EMPLOYEE_CONTEXT_LABELS.every((label) => labels.includes(label)),
  };
  for (const label of CONTROLLED_EMPLOYEE_CONTEXT_LABELS) {
    const proof = Array.isArray(proofs)
      ? proofs.find((candidate) => candidate?.label === label)
      : null;
    for (const field of requiredBooleanFields) {
      checks[`${label}_${field}`] = proof?.[field] === true;
    }
  }
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    failed: Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name),
  };
}

export function evaluateReadinessGates(snapshot, runtime = {}) {
  const employeeContextEvaluation =
    evaluateControlledEmployeeContextProofs(runtime.employeeContextProofs);
  const employeeContextProofs = Array.isArray(runtime.employeeContextProofs)
    ? runtime.employeeContextProofs
    : [];
  const checks = {
    staging_project_confirmed:
      snapshot?.expected_project_ref === STAGING_PROJECT_REF,
    production_project_absent: runtime.productionProjectAbsent === true,
    schema_version_exact: snapshot?.runtime?.schema_version === EXPECTED_SCHEMA_VERSION,
    runtime_enforced: snapshot?.runtime?.enforcement_state === 'enforced',
    state_version_reviewed: snapshot?.runtime?.state_version === 5,
    edge_contract_exact: snapshot?.runtime?.edge_contract === EXPECTED_EDGE_CONTRACT,
    frontend_contract_exact:
      snapshot?.runtime?.frontend_contract === EXPECTED_FRONTEND_CONTRACT,
    ...Object.fromEntries(
      EDGE_DEPLOYMENT_GATE_CHECK_NAMES.map((name) => [
        name,
        runtime.edgeDeploymentChecks?.[name] === true,
      ]),
    ),
    runtime_designated_super_admin_exact:
      snapshot?.runtime?.designated_super_admin_id === DESIGNATED_SUPER_ADMIN_ID,
    request_hash_function_available:
      snapshot?.runtime?.request_hash_function_available === true,
    required_migrations_applied:
      REQUIRED_MIGRATIONS.every((version) => snapshot?.applied_migrations?.includes(version)),
    stable_finalizer_present:
      snapshot?.finalizer?.name === FINALIZER_RPC
      && snapshot?.finalizer?.name_bytes === 50
      && snapshot?.finalizer?.exists === true
      && snapshot?.finalizer?.routine_kind_function === true
      && snapshot?.finalizer?.destination_name_unique === true
      && snapshot?.finalizer?.old_or_truncated_name_absent === true
      && snapshot?.finalizer?.security_definer === true
      && snapshot?.finalizer?.restricted_search_path === true
      && snapshot?.finalizer?.service_role_execute_only === true,
    emergency_recovery_route_available:
      snapshot?.recovery?.wrapper_exists === true
      && snapshot?.recovery?.implementation_exists === true
      && snapshot?.recovery?.standard_implementation_exists === true
      && snapshot?.recovery?.wrapper_security_definer === true
      && snapshot?.recovery?.wrapper_restricted_search_path === true
      && snapshot?.recovery?.wrapper_service_role_execute_only === true
      && snapshot?.recovery?.implementation_not_callable_by_service_role === true
      && snapshot?.recovery?.standard_implementation_owner_only === true,
    target_identity_exact: snapshot?.target?.user_id === TARGET_USER_ID,
    target_active_v4:
      snapshot?.target?.profile_state === 'active'
      && snapshot?.target?.profile_active === true
      && snapshot?.target?.same_organization_as_designated_admin === true
      && snapshot?.target?.credential_state === 'active'
      && snapshot?.target?.credential_version === INITIAL_CREDENTIAL_VERSION
      && snapshot?.target?.auth_credential_version === INITIAL_CREDENTIAL_VERSION
      && snapshot?.target?.requested_lifecycle === 'active',
    target_role_scope_exact: exactRoleScope(snapshot?.target, 'employee', 'assigned_only'),
    target_no_pending_operation:
      snapshot?.target?.pending_operation === false
      && snapshot?.target?.pending_operation_count === 0,
    designated_admin_exact: snapshot?.admin?.user_id === DESIGNATED_SUPER_ADMIN_ID,
    designated_admin_active:
      snapshot?.admin?.profile_state === 'active'
      && snapshot?.admin?.profile_active === true
      && snapshot?.admin?.credential_state === 'active'
      && snapshot?.admin?.credential_version === 1
      && snapshot?.admin?.auth_credential_version === 1,
    designated_admin_role_scope_exact: exactRoleScope(snapshot?.admin, 'super_admin', 'global'),
    designated_admin_no_pending_operation:
      snapshot?.admin?.pending_operation === false
      && snapshot?.admin?.pending_operation_count === 0,
    administrator_is_not_reset_target: snapshot?.admin?.user_id !== snapshot?.target?.user_id,
    exactly_one_eligible_super_admin: snapshot?.eligible_super_admin_count === 1,
    original_admin_context_available: runtime.originalAdminContextAvailable === true,
    secondary_admin_reauthenticated: runtime.secondaryAdminReauthenticated === true,
    two_controlled_employee_sessions:
      Number(runtime.controlledEmployeeSessionCount) >= 2
      && runtime.controlledEmployeeRefreshValuesInMemory === true
      && employeeContextProofs.every((proof) => proof?.authentication_succeeded === true)
      && Number(snapshot?.target?.session_count) >= 2
      && Number(snapshot?.target?.unrevoked_refresh_token_count) >= 2,
    both_controlled_employee_refreshes_proven:
      employeeContextProofs.length === 2
      && employeeContextProofs.every((proof) => proof?.refresh_succeeded === true),
    both_employee_context_authorization_proofs: employeeContextEvaluation.passed,
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    failed: Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name),
  };
}

export function evaluatePreCredentialDatabaseGates(
  snapshot,
  {
    edgeDeploymentChecks = {},
  } = {},
) {
  const result = evaluateReadinessGates(snapshot, {
    productionProjectAbsent: true,
    edgeDeploymentChecks,
    originalAdminContextAvailable: false,
    secondaryAdminReauthenticated: false,
    controlledEmployeeSessionCount: 0,
    controlledEmployeeRefreshValuesInMemory: false,
    employeeContextProofs: [],
  });
  const deferred = new Set([
    'original_admin_context_available',
    'secondary_admin_reauthenticated',
    'two_controlled_employee_sessions',
    'both_controlled_employee_refreshes_proven',
    'both_employee_context_authorization_proofs',
  ]);
  const failed = result.failed.filter((name) => !deferred.has(name));
  return {
    passed: failed.length === 0,
    checks: result.checks,
    failed,
  };
}

export function assertRuntimeSnapshotStable(reference, current) {
  if (
    current?.runtime?.schema_version !== EXPECTED_SCHEMA_VERSION
    || current?.runtime?.enforcement_state !== 'enforced'
    || current?.runtime?.state_version !== reference?.runtime?.state_version
    || current?.runtime?.edge_contract !== EXPECTED_EDGE_CONTRACT
    || current?.runtime?.frontend_contract !== EXPECTED_FRONTEND_CONTRACT
    || current?.runtime?.request_hash_function_available !== true
    || current?.runtime?.designated_super_admin_id !== DESIGNATED_SUPER_ADMIN_ID
    || current?.runtime?.designated_super_admin_id
      !== reference?.runtime?.designated_super_admin_id
  ) {
    throw new Error('PATCH83U_RUNTIME_OR_CONTRACT_TRANSITION');
  }
  return true;
}

export function assertPasswordChangeFinalizationReady(snapshot) {
  if (snapshot?.target?.credential_state !== 'admin_reset_change_required') {
    throw new Error('PATCH83U_RESET_FINALIZATION_NOT_CONFIRMED');
  }
  if (snapshot?.target?.session_count !== 0) {
    throw new Error('PATCH83U_NONZERO_SESSIONS_BLOCK_PASSWORD_CHANGE');
  }
  if (snapshot?.target?.unrevoked_refresh_token_count !== 0) {
    throw new Error('PATCH83U_UNREVOKED_REFRESH_ROWS_BLOCK_PASSWORD_CHANGE');
  }
  if (
    snapshot?.target?.credential_version !== POST_RESET_CREDENTIAL_VERSION
    || snapshot?.target?.auth_credential_version !== POST_RESET_CREDENTIAL_VERSION
  ) {
    throw new Error('PATCH83U_RESET_CREDENTIAL_VERSION_MISMATCH');
  }
  return true;
}

export function assertTargetGovernanceCheckpoint(
  snapshot,
  {
    credentialState,
    credentialVersion,
    requireZeroSessions = false,
    requireFreshSession = false,
  },
) {
  const target = snapshot?.target;
  if (
    target?.user_id !== TARGET_USER_ID
    || target?.profile_state !== 'active'
    || target?.profile_active !== true
    || target?.same_organization_as_designated_admin !== true
    || target?.requested_lifecycle !== 'active'
    || !exactRoleScope(target, 'employee', 'assigned_only')
    || target?.pending_operation !== false
    || target?.pending_operation_count !== 0
    || target?.credential_state !== credentialState
    || target?.credential_version !== credentialVersion
    || target?.auth_credential_version !== credentialVersion
  ) {
    throw new Error('PATCH83U_TARGET_GOVERNANCE_CHECKPOINT_FAILED');
  }
  if (
    requireZeroSessions
    && (
      target.session_count !== 0
      || target.unrevoked_refresh_token_count !== 0
    )
  ) {
    throw new Error('PATCH83U_ZERO_SESSION_CHECKPOINT_FAILED');
  }
  if (
    requireFreshSession
    && (
      Number(target.session_count) < 1
      || Number(target.unrevoked_refresh_token_count) < 1
    )
  ) {
    throw new Error('PATCH83U_FRESH_SESSION_CHECKPOINT_FAILED');
  }
  return true;
}

export function assertPasswordChangeFinalizationProof(snapshot) {
  const target = snapshot?.target;
  if (target?.password_changed_at_set !== true) {
    throw new Error('PATCH83U_PASSWORD_CHANGED_AT_SET_NOT_PROVEN');
  }
  if (target?.sessions_revoked_at_set !== true) {
    throw new Error('PATCH83U_SESSIONS_REVOKED_AT_SET_NOT_PROVEN');
  }
  if (target?.reconciliation_auth_changed !== false) {
    throw new Error('PATCH83U_RECONCILIATION_AUTH_CHANGED_NOT_CLEARED');
  }
  return true;
}

export function assertPasswordChangeCompletionProof({
  passwordChange,
  audit,
}) {
  const requestIdHash = passwordChange?.request_id_hash;
  if (
    passwordChange?.submitted !== true
    || passwordChange?.edge_success_confirmed !== true
    || !Number.isSafeInteger(passwordChange?.http_status)
    || passwordChange.http_status < 200
    || passwordChange.http_status >= 300
    || passwordChange?.safe_error_code !== null
    || passwordChange?.finalizer_rpc !== FINALIZER_RPC
    || passwordChange?.browser_signed_out !== true
    || passwordChange?.password_changed_at_set !== true
    || passwordChange?.sessions_revoked_at_set !== true
    || passwordChange?.reconciliation_auth_changed !== false
    || !SHA256_PATTERN.test(String(requestIdHash ?? ''))
    || !completedCredentialProofMatches(passwordChange?.terminal_proof, {
      credentialState: 'active',
      credentialVersion: FINAL_CREDENTIAL_VERSION,
      sessionCount: 0,
      refreshCount: 0,
    })
  ) {
    throw new Error('PATCH83U_PASSWORD_CHANGE_COMPLETION_PROOF_FAILED');
  }
  assertAuditCheckpoint(
    { audit },
    { kind: 'password_change', requestIdHash },
  );
  return true;
}

export function assertTemporaryPasswordSessionCounts(snapshot) {
  const target = snapshot?.target;
  if (
    !Number.isSafeInteger(target?.session_count)
    || !Number.isSafeInteger(target?.unrevoked_refresh_token_count)
    || target.session_count !== EXPECTED_TEMPORARY_SESSION_COUNT
    || target.unrevoked_refresh_token_count
      !== EXPECTED_TEMPORARY_UNREVOKED_REFRESH_TOKEN_COUNT
  ) {
    throw new Error('PATCH83U_TEMPORARY_SESSION_COUNT_CONTRACT_FAILED');
  }
  return true;
}

export function assertRun007FinalSessionContract(contract) {
  if (
    contract?.expected_session_count !== EXPECTED_FINAL_SESSION_COUNT
    || contract?.expected_unrevoked_refresh_token_count
      !== EXPECTED_FINAL_UNREVOKED_REFRESH_TOKEN_COUNT
    || contract?.checkpoint !== 'after_fresh_employee_login'
    || contract?.enforcement !== 'exact_integer_equality'
    || contract?.cli_override_supported !== false
  ) {
    throw new Error('PATCH83U_RUN007_FINAL_SESSION_CONTRACT_INVALID');
  }
  return Object.freeze({
    checkpoint: contract.checkpoint,
    expected_session_count: contract.expected_session_count,
    expected_unrevoked_refresh_token_count:
      contract.expected_unrevoked_refresh_token_count,
    enforcement: contract.enforcement,
    cli_override_supported: false,
  });
}

export function assertFinalFreshLoginCounts(snapshot, contract) {
  const verifiedContract = assertRun007FinalSessionContract(contract);
  const sessionCount = snapshot?.target?.session_count;
  const refreshCount = snapshot?.target?.unrevoked_refresh_token_count;
  if (!Number.isSafeInteger(sessionCount)) {
    throw new Error('PATCH83U_FINAL_SESSION_COUNT_PROOF_INVALID');
  }
  if (sessionCount !== verifiedContract.expected_session_count) {
    throw new Error('PATCH83U_FINAL_SESSION_COUNT_MISMATCH');
  }
  if (!Number.isSafeInteger(refreshCount)) {
    throw new Error('PATCH83U_FINAL_UNREVOKED_REFRESH_COUNT_PROOF_INVALID');
  }
  if (refreshCount !== verifiedContract.expected_unrevoked_refresh_token_count) {
    throw new Error('PATCH83U_FINAL_UNREVOKED_REFRESH_COUNT_MISMATCH');
  }
  return true;
}

export function assertSoleSuperAdminCheckpoint(snapshot) {
  const admin = snapshot?.admin;
  if (
    snapshot?.runtime?.designated_super_admin_id !== DESIGNATED_SUPER_ADMIN_ID
    || admin?.user_id !== DESIGNATED_SUPER_ADMIN_ID
    || admin?.profile_state !== 'active'
    || admin?.profile_active !== true
    || admin?.credential_state !== 'active'
    || admin?.credential_version !== 1
    || admin?.auth_credential_version !== 1
    || !exactRoleScope(admin, 'super_admin', 'global')
    || admin?.pending_operation !== false
    || admin?.pending_operation_count !== 0
    || snapshot?.eligible_super_admin_count !== 1
    || admin.user_id === snapshot?.target?.user_id
  ) {
    throw new Error('PATCH83U_SOLE_SUPER_ADMIN_CHECKPOINT_FAILED');
  }
  return true;
}

function throwAggregateProofFailure(code, cause) {
  const error = new Error(code);
  error.cause = cause;
  throw error;
}

export function assertStagingAndProductionBoundaryAggregate({
  configuration,
  targetGuard,
}) {
  try {
    assertStagingConfiguration(configuration);
    if (
      !targetGuard
      || typeof targetGuard !== 'object'
      || targetGuard.violation !== null
      || !targetGuard.diagnostics
      || typeof targetGuard.diagnostics !== 'object'
    ) {
      throw new Error('target_guard_not_clean');
    }
    assertBrowserTargetGuard(targetGuard);
    return true;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_STAGING_AND_PRODUCTION_BOUNDARY_FAILED',
      error,
    );
  }
}

export function assertFrontendOriginExactAggregate({
  appUrl,
  launchPlan,
  loadedAttestation,
}) {
  try {
    if (
      appUrl !== STAGING_APPLICATION_ORIGIN
      || launchPlan?.origin !== STAGING_APPLICATION_ORIGIN
      || launchPlan?.projectRef !== STAGING_PROJECT_REF
      || launchPlan?.mode !== 'staging'
    ) {
      throw new Error('frontend_origin_or_launch_plan_mismatch');
    }
    assertFrontendProjectAttestation(loadedAttestation);
    return true;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_FRONTEND_ORIGIN_EXACT_PROOF_FAILED',
      error,
    );
  }
}

export function assertRuntimeAndContractsExactAggregate({
  snapshot,
  edgeDeploymentChecks,
}) {
  try {
    const readiness = evaluatePreCredentialDatabaseGates(snapshot, {
      edgeDeploymentChecks,
    });
    if (
      !readiness.passed
      || snapshot?.runtime?.state_version !== 5
      || EDGE_DEPLOYMENT_GATE_CHECK_NAMES.some(
        (name) => readiness.checks?.[name] !== true,
      )
      || readiness.checks?.schema_version_exact !== true
      || readiness.checks?.runtime_enforced !== true
      || readiness.checks?.edge_contract_exact !== true
      || readiness.checks?.frontend_contract_exact !== true
      || readiness.checks?.required_migrations_applied !== true
      || readiness.checks?.stable_finalizer_present !== true
      || readiness.checks?.emergency_recovery_route_available !== true
    ) {
      throw new Error('runtime_or_contract_readiness_incomplete');
    }
    return readiness;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_RUNTIME_AND_CONTRACTS_EXACT_PROOF_FAILED',
      error,
    );
  }
}

function assertCheckpointSqlReadOnlyTransaction(sqlSource, checkpoint) {
  const fileName = SQL_EDITOR_CHECKPOINT_FILE_NAMES[checkpoint];
  if (typeof sqlSource !== 'string' || !fileName) {
    throw new Error('checkpoint_sql_source_invalid');
  }
  const marker = `-- FILE: ${fileName}`;
  const start = sqlSource.indexOf(marker);
  if (start < 0) throw new Error('checkpoint_sql_marker_missing');
  const nextMarker = sqlSource.indexOf('\n-- FILE:', start + marker.length);
  const block = sqlSource.slice(
    start,
    nextMarker < 0 ? sqlSource.length : nextMarker,
  );
  const beginMatches = block.match(/^\s*BEGIN READ ONLY;\s*$/gim) ?? [];
  const rollbackMatches = block.match(/^\s*ROLLBACK;\s*$/gim) ?? [];
  if (
    beginMatches.length !== 1
    || rollbackMatches.length !== 1
    || block.indexOf(beginMatches[0]) >= block.lastIndexOf(rollbackMatches[0])
  ) {
    throw new Error('checkpoint_sql_read_only_transaction_invalid');
  }
  return true;
}

export function assertCheckpoint1ReadOnlyAggregate({
  snapshot,
  sqlSource,
}) {
  try {
    if (
      snapshot?.checkpoint !== 'before_employee_sessions'
      || snapshot?.expected_project_ref !== STAGING_PROJECT_REF
      || snapshot?.transaction_read_only !== true
    ) {
      throw new Error('checkpoint_1_read_only_snapshot_invalid');
    }
    assertCheckpointSqlReadOnlyTransaction(
      sqlSource,
      'before_employee_sessions',
    );
    return true;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_CHECKPOINT1_READ_ONLY_PROOF_FAILED',
      error,
    );
  }
}

export function assertInitialEmployeeStateAggregate(snapshot) {
  try {
    assertTargetGovernanceCheckpoint(snapshot, {
      credentialState: 'active',
      credentialVersion: INITIAL_CREDENTIAL_VERSION,
    });
    if (
      snapshot?.checkpoint !== 'before_employee_sessions'
      || snapshot?.target?.session_count !== 0
      || snapshot?.target?.unrevoked_refresh_token_count !== 0
    ) {
      throw new Error('initial_employee_session_state_invalid');
    }
    return true;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_INITIAL_EMPLOYEE_STATE_PROOF_FAILED',
      error,
    );
  }
}

export function assertFinalizerAndRecoveryReadyAggregate(snapshot) {
  try {
    const checks = evaluateReadinessGates(snapshot, {}).checks;
    if (
      checks.required_migrations_applied !== true
      || checks.stable_finalizer_present !== true
      || checks.emergency_recovery_route_available !== true
    ) {
      throw new Error('finalizer_or_recovery_not_ready');
    }
    return true;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_FINALIZER_AND_RECOVERY_READY_PROOF_FAILED',
      error,
    );
  }
}

export function assertBothControlledRefreshesAggregate({
  employeeUserIds,
  refreshSucceededByContext,
  employeeContextProofs,
}) {
  try {
    const proofEvaluation =
      assertControlledEmployeeContextProofs(employeeContextProofs);
    if (
      !Array.isArray(employeeUserIds)
      || employeeUserIds.length !== CONTROLLED_EMPLOYEE_CONTEXT_LABELS.length
      || employeeUserIds.some((userId) => userId !== TARGET_USER_ID)
      || !Array.isArray(refreshSucceededByContext)
      || refreshSucceededByContext.length !== CONTROLLED_EMPLOYEE_CONTEXT_LABELS.length
      || refreshSucceededByContext.some((succeeded) => succeeded !== true)
      || proofEvaluation.passed !== true
      || CONTROLLED_EMPLOYEE_CONTEXT_LABELS.some((label, index) => {
        const proof = employeeContextProofs[index];
        return proof?.label !== label
          || proof?.authentication_succeeded !== true
          || proof?.refresh_succeeded !== refreshSucceededByContext[index];
      })
    ) {
      throw new Error('controlled_refresh_identity_or_outcome_invalid');
    }
    return true;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_BOTH_CONTROLLED_REFRESHES_PROOF_FAILED',
      error,
    );
  }
}

export function assertOneShotResetAggregate({
  controller,
  submissionCount,
  requestEnvelope,
  userManagementActionPrepared,
}) {
  try {
    const requestId = inspectResetActionEnvelope(requestEnvelope);
    if (
      !(controller instanceof ResetSubmissionController)
      || controller.submissionStarted !== true
      || controller.ambiguous !== false
      || submissionCount !== 1
      || userManagementActionPrepared !== true
    ) {
      throw new Error('one_shot_reset_state_invalid');
    }
    return requestId;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_ONE_SHOT_RESET_PROOF_FAILED',
      error,
    );
  }
}

export function assertStableResetRequestCorrelationAggregate({
  controller,
  envelopeRequestId,
  evidenceRequestIdHash,
  submissionCount,
}) {
  try {
    const expectedHash = hashRequestId(envelopeRequestId);
    if (
      !(controller instanceof ResetSubmissionController)
      || controller.submissionStarted !== true
      || controller.requestIdObservationCount !== 1
      || submissionCount !== 1
      || controller.requestIdHash !== expectedHash
      || evidenceRequestIdHash !== expectedHash
    ) {
      throw new Error('reset_request_correlation_not_stable');
    }
    return expectedHash;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_STABLE_RESET_REQUEST_CORRELATION_PROOF_FAILED',
      error,
    );
  }
}

export function assertCheckpoint3AlwaysAggregate({
  snapshot,
  sqlSource,
  resetSubmissionStarted,
  edgeOutcome,
  checkpointOutcome,
}) {
  try {
    if (
      resetSubmissionStarted !== true
      || !edgeOutcome
      || typeof edgeOutcome !== 'object'
      || !checkpointOutcome
      || typeof checkpointOutcome !== 'object'
      || snapshot?.checkpoint !== 'immediately_after_reset'
      || snapshot?.expected_project_ref !== STAGING_PROJECT_REF
      || snapshot?.transaction_read_only !== true
    ) {
      throw new Error('checkpoint_3_collection_not_proven');
    }
    assertCheckpointSqlReadOnlyTransaction(
      sqlSource,
      'immediately_after_reset',
    );
    return true;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_CHECKPOINT3_ALWAYS_PROOF_FAILED',
      error,
    );
  }
}

export function assertProtectedStateFailClosedAggregate({
  edgeOutcome,
  checkpointOutcome,
  progression,
  automaticRecoveryActions,
  postSubmissionCleanupSucceeded,
}) {
  try {
    const supportedClassifications = new Set([
      'admin_reset_change_required',
      'ambiguous_edge_response',
      'reset_not_started',
      'reset_aborted_without_auth_change',
      'reset_in_progress',
      'session_revocation_review_required',
      'recovery_required',
      'credential_version_mismatch',
      'runtime_transition',
      'sole_super_admin_drift',
      'authorization_drift',
      'nonzero_sessions_after_reset',
      'unexpected_protected_state',
    ]);
    const expectedProgression =
      evaluateResetProgression(edgeOutcome, checkpointOutcome);
    const expectedAllowed =
      expectedProgression.allowed && postSubmissionCleanupSucceeded === true;
    if (
      !supportedClassifications.has(checkpointOutcome?.classification)
      || progression?.allowed !== expectedAllowed
      || progression?.edge_success_confirmed
        !== expectedProgression.edge_success_confirmed
      || progression?.checkpoint_success_confirmed
        !== expectedProgression.checkpoint_success_confirmed
      || (
        checkpointOutcome.classification !== 'admin_reset_change_required'
        && progression.allowed !== false
      )
      || !Array.isArray(automaticRecoveryActions)
      || automaticRecoveryActions.length !== 0
      || typeof postSubmissionCleanupSucceeded !== 'boolean'
    ) {
      throw new Error('protected_state_not_fail_closed');
    }
    return true;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_PROTECTED_STATE_FAIL_CLOSED_PROOF_FAILED',
      error,
    );
  }
}

export function assertBothStaleContextsDeniedAggregate({
  staleContextProofs,
  staleContext1Denied,
  staleContext2Denied,
}) {
  try {
    const evaluation = evaluateStaleEmployeeContextProofs(staleContextProofs);
    if (
      evaluation.passed !== true
      || staleContext1Denied !== true
      || staleContext2Denied !== true
    ) {
      throw new Error('stale_context_denial_incomplete');
    }
    return evaluation;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_BOTH_STALE_CONTEXTS_DENIED_PROOF_FAILED',
      error,
    );
  }
}

export function assertSecretAndPolicyControlsAggregate({
  credentialValues,
  knownSecrets,
  temporaryPassword,
  newPermanentPassword,
  hiddenPrompt,
  credentialsPersisted,
  maxAttempts,
  passwordChangeRun = null,
}) {
  try {
    if (
      !Array.isArray(credentialValues)
      || credentialValues.length < 2
      || credentialValues.some((value) => !(value instanceof SecretValue))
      || new Set(credentialValues).size !== credentialValues.length
      || !Array.isArray(knownSecrets)
      || credentialValues.some((value) => !knownSecrets.includes(value))
      || !(temporaryPassword instanceof SecretValue)
      || !(newPermanentPassword instanceof SecretValue)
      || temporaryPassword.equals(newPermanentPassword)
      || hiddenPrompt !== promptHidden
      || credentialsPersisted !== false
      || maxAttempts !== PASSWORD_CHANGE_MAX_ATTEMPTS
      || (
        passwordChangeRun !== null
        && (
          !(passwordChangeRun?.candidate instanceof SecretValue)
          || !knownSecrets.includes(passwordChangeRun.candidate)
          || !Number.isSafeInteger(passwordChangeRun?.attempt_count)
          || passwordChangeRun.attempt_count < 1
          || passwordChangeRun.attempt_count > PASSWORD_CHANGE_MAX_ATTEMPTS
          || passwordChangeRun?.policy_rejection_count
            !== passwordChangeRun.attempt_count - 1
          || !Array.isArray(passwordChangeRun?.policy_error_codes)
          || passwordChangeRun.policy_error_codes.length
            !== passwordChangeRun.policy_rejection_count
          || passwordChangeRun.policy_error_codes.some(
            (code) => code !== PERMANENT_PASSWORD_POLICY_ERROR_CODE,
          )
        )
      )
    ) {
      throw new Error('secret_or_policy_control_invalid');
    }
    return true;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_SECRET_AND_POLICY_CONTROLS_PROOF_FAILED',
      error,
    );
  }
}

export function assertNetworkConsoleSafeAggregate({
  configuration,
  targetGuard,
  productionProjectAbsent,
}) {
  try {
    assertStagingConfiguration(configuration);
    if (
      productionProjectAbsent !== true
      || targetGuard?.violation !== null
    ) {
      throw new Error('production_absence_not_proven');
    }
    assertBrowserTargetGuard(targetGuard);
    const diagnostics = safeBrowserDiagnosticsEvidence(targetGuard);
    if (
      diagnostics.safe !== true
      || diagnostics.console_error_count !== 0
      || diagnostics.page_error_count !== 0
      || diagnostics.request_failure_count !== 0
      || diagnostics.server_error_response_count !== 0
    ) {
      throw new Error('network_or_console_diagnostics_not_clean');
    }
    return diagnostics;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_NETWORK_CONSOLE_SAFE_PROOF_FAILED',
      error,
    );
  }
}

export function buildPassedPreflightEvidence(readiness) {
  if (
    readiness?.passed !== true
    || !readiness?.checks
    || typeof readiness.checks !== 'object'
    || Array.isArray(readiness.checks)
    || Object.keys(readiness.checks).length === 0
    || Object.values(readiness.checks).some((value) => value !== true)
    || !Array.isArray(readiness?.failed)
    || readiness.failed.length !== 0
  ) {
    throw new Error('PATCH83U_PASSED_PREFLIGHT_EVIDENCE_INVALID');
  }
  return {
    passed: true,
    checks: { ...readiness.checks },
    failed: [],
  };
}

export function assertControlledEmployeeSessionSetupProof({
  employeeContextProofs,
  controlledRefreshValues,
  knownSecrets,
}) {
  try {
    assertControlledEmployeeContextProofs(employeeContextProofs);
    if (
      !Array.isArray(controlledRefreshValues)
      || controlledRefreshValues.length !== 2
      || controlledRefreshValues.some((value) => !(value instanceof SecretValue))
      || new Set(controlledRefreshValues).size !== 2
      || !Array.isArray(knownSecrets)
      || controlledRefreshValues.some((value) => !knownSecrets.includes(value))
    ) {
      throw new Error('refresh_identity_registration_invalid');
    }
    return true;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_CONTROLLED_EMPLOYEE_SESSION_SETUP_PROOF_FAILED',
      error,
    );
  }
}

export function assertPreResetCheckpointAggregate({
  referenceSnapshot,
  snapshot,
}) {
  try {
    assertTargetGovernanceCheckpoint(snapshot, {
      credentialState: 'active',
      credentialVersion: INITIAL_CREDENTIAL_VERSION,
    });
    if (
      !Number.isSafeInteger(snapshot?.target?.session_count)
      || snapshot.target.session_count < 2
      || !Number.isSafeInteger(snapshot?.target?.unrevoked_refresh_token_count)
      || snapshot.target.unrevoked_refresh_token_count < 2
    ) {
      throw new Error('controlled_session_minimum_not_proven');
    }
    assertSoleSuperAdminCheckpoint(snapshot);
    assertRuntimeSnapshotStable(referenceSnapshot, snapshot);
    return true;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_PRE_RESET_CHECKPOINT_AGGREGATE_FAILED',
      error,
    );
  }
}

export function assertExactResetConfirmationsProof({
  employeeIdConfirmation,
  uiConfirmation,
  backendConfirmation,
  operatorConfirmation,
  operatorConfirmationContract,
}) {
  try {
    const verifiedContract =
      assertRun007OperatorConfirmationContract(operatorConfirmationContract);
    if (
      employeeIdConfirmation !== TARGET_EMPLOYEE_ID
      || uiConfirmation !== RESET_CONFIRMATION_TEXT
      || backendConfirmation !== 'PATCH83U_RESET_USER_PASSWORD'
      || operatorConfirmation?.contract_id !== verifiedContract.contract_id
      || operatorConfirmation?.exact_match !== true
    ) {
      throw new Error('confirmation_value_mismatch');
    }
    return true;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_EXACT_RESET_CONFIRMATIONS_PROOF_FAILED',
      error,
    );
  }
}

export function assertPostResetSuccessAggregate({
  referenceSnapshot,
  snapshot,
  requestIdHash,
}) {
  try {
    assertPasswordChangeFinalizationReady(snapshot);
    assertTargetGovernanceCheckpoint(snapshot, {
      credentialState: 'admin_reset_change_required',
      credentialVersion: POST_RESET_CREDENTIAL_VERSION,
      requireZeroSessions: true,
    });
    if (snapshot?.target?.reconciliation_auth_changed !== false) {
      throw new Error('reset_reconciliation_state_not_cleared');
    }
    assertSoleSuperAdminCheckpoint(snapshot);
    assertRuntimeSnapshotStable(referenceSnapshot, snapshot);
    assertAuditCheckpoint(snapshot, {
      kind: 'admin_reset',
      requestIdHash,
    });
    return true;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_POST_RESET_SUCCESS_AGGREGATE_FAILED',
      error,
    );
  }
}

export function assertBeforeRequiredPasswordChangeAggregate({
  referenceSnapshot,
  snapshot,
}) {
  try {
    assertTargetGovernanceCheckpoint(snapshot, {
      credentialState: 'admin_reset_change_required',
      credentialVersion: POST_RESET_CREDENTIAL_VERSION,
      requireFreshSession: true,
    });
    assertTemporaryPasswordSessionCounts(snapshot);
    assertSoleSuperAdminCheckpoint(snapshot);
    assertRuntimeSnapshotStable(referenceSnapshot, snapshot);
    return true;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_BEFORE_PASSWORD_CHANGE_AGGREGATE_FAILED',
      error,
    );
  }
}

export function assertAfterPasswordChangeAggregate({
  referenceSnapshot,
  snapshot,
  requestIdHash,
  browserSignedOut,
}) {
  try {
    assertTargetGovernanceCheckpoint(snapshot, {
      credentialState: 'active',
      credentialVersion: FINAL_CREDENTIAL_VERSION,
      requireZeroSessions: true,
    });
    assertPasswordChangeFinalizationProof(snapshot);
    assertSoleSuperAdminCheckpoint(snapshot);
    assertRuntimeSnapshotStable(referenceSnapshot, snapshot);
    assertAuditCheckpoint(snapshot, {
      kind: 'password_change',
      requestIdHash,
    });
    if (browserSignedOut !== true) {
      throw new Error('browser_global_signout_not_proven');
    }
    return true;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_AFTER_PASSWORD_CHANGE_AGGREGATE_FAILED',
      error,
    );
  }
}

export function assertFinalFreshLoginAggregate({
  referenceSnapshot,
  snapshot,
  finalSessionContract,
  context,
  authenticatedUserId: observedUserId,
  authorizationProof,
}) {
  try {
    assertFreshPermanentLoginProof({
      context,
      authenticatedUserId: observedUserId,
      authorizationProof,
    });
    assertTargetGovernanceCheckpoint(snapshot, {
      credentialState: 'active',
      credentialVersion: FINAL_CREDENTIAL_VERSION,
    });
    assertFinalFreshLoginCounts(snapshot, finalSessionContract);
    assertSoleSuperAdminCheckpoint(snapshot);
    assertRuntimeSnapshotStable(referenceSnapshot, snapshot);
    return true;
  } catch (error) {
    return throwAggregateProofFailure(
      'PATCH83U_FINAL_FRESH_LOGIN_AGGREGATE_FAILED',
      error,
    );
  }
}

export function assertAuditCheckpoint(snapshot, { kind, requestIdHash }) {
  const audit = snapshot?.audit;
  const expected = kind === 'admin_reset'
    ? {
        eventType: 'admin_reset_completed',
        eventCode: 'PATCH83U_ADMIN_RESET_COMPLETED',
        currentVersion: INITIAL_CREDENTIAL_VERSION,
        nextVersion: POST_RESET_CREDENTIAL_VERSION,
        resultingState: 'admin_reset_change_required',
      }
    : kind === 'password_change'
      ? {
          eventType: 'password_change_completed',
          eventCode: 'PATCH83U_PASSWORD_CHANGE_COMPLETED',
          currentVersion: POST_RESET_CREDENTIAL_VERSION,
          nextVersion: FINAL_CREDENTIAL_VERSION,
          resultingState: 'active',
        }
      : null;
  if (
    !expected
    || !/^[a-f0-9]{64}$/.test(requestIdHash ?? '')
    || !Number.isInteger(audit?.credential_event_count)
    || audit.credential_event_count < 1
    || !Number.isInteger(audit?.operation_count)
    || audit.operation_count < 1
    || audit.latest_event_type !== expected.eventType
    || audit.latest_event_code !== expected.eventCode
    || audit.latest_event_credential_version !== expected.nextVersion
    || audit.latest_event_request_id_hash !== requestIdHash
    || !Number.isFinite(Date.parse(audit.latest_event_at))
    || audit.latest_operation_type !== kind
    || audit.latest_operation_status !== 'completed'
    || audit.latest_operation_current_version !== expected.currentVersion
    || audit.latest_operation_next_version !== expected.nextVersion
    || audit.latest_operation_resulting_state !== expected.resultingState
    || audit.latest_operation_auth_changed !== true
    || audit.latest_operation_revocation_confirmed !== true
    || audit.latest_operation_request_id_hash !== requestIdHash
    || !Number.isFinite(Date.parse(audit.latest_operation_completed_at))
  ) {
    throw new Error('PATCH83U_AUDIT_CHECKPOINT_NOT_PROVEN');
  }
  return true;
}

export function safeRefreshReplayResult({ failed, httpStatus, errorCode, at = new Date() }) {
  return {
    failed: failed === true,
    http_status: Number.isInteger(httpStatus) ? httpStatus : null,
    safe_error_code:
      typeof errorCode === 'string' && /^[A-Z0-9_.:-]{1,100}$/i.test(errorCode)
        ? errorCode
        : 'UNCLASSIFIED_AUTH_FAILURE',
    observed_at: at.toISOString(),
  };
}

export function assertRejectedRefreshReplays(results) {
  if (
    !Array.isArray(results)
    || results.length !== 2
    || results.some((result) =>
      result?.failed !== true
      || ![400, 401, 403].includes(result?.http_status)
      || result?.safe_error_code === 'NETWORK_ERROR'
      || result?.safe_error_code === 'UNEXPECTED_REFRESH_ACCEPTED')
  ) {
    throw new Error('PATCH83U_REFRESH_REPLAY_REVOCATION_NOT_PROVEN');
  }
  return true;
}

function safeEdgeCode(value, fallback) {
  return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(value)
    ? value
    : fallback;
}

export function classifyResetEdgeResult({
  ok,
  httpStatus,
  body,
  requestIdHash,
}) {
  const result = body?.result;
  const resultRequestIdHash =
    typeof result?.requestId === 'string'
      ? (() => {
          try {
            return hashRequestId(result.requestId);
          } catch {
            return null;
          }
        })()
      : null;
  const safeErrorCode = safeEdgeCode(
    body?.code,
    ok === true ? null : 'EDGE_RESPONSE_NOT_OK',
  );
  const exactSuccess =
    ok === true
    && Number.isInteger(httpStatus)
    && httpStatus >= 200
    && httpStatus < 300
    && body?.ok === true
    && body?.action === ADMIN_RESET_ACTION
    && result?.userId === TARGET_USER_ID
    && resultRequestIdHash !== null
    && resultRequestIdHash === requestIdHash
    && result?.status === 'admin_reset_change_required'
    && result?.credentialVersion === POST_RESET_CREDENTIAL_VERSION
    && result?.mustChangePassword === true
    && result?.mustReauthenticate === true
    && result?.reconciliationRequired === false
    && result?.sessionRevocationReviewRequired === false
    && result?.idempotentReplay === false;
  let classification = 'ambiguous_edge_response';
  if (exactSuccess) classification = 'admin_reset_change_required';
  else if (result?.status === 'reset_in_progress') classification = 'reset_in_progress';
  else if (result?.status === 'session_revocation_review_required') {
    classification = 'session_revocation_review_required';
  } else if (result?.status === 'recovery_required') {
    classification = 'recovery_required';
  } else if (safeErrorCode === 'PATCH83U_RESET_CREDENTIAL_VERSION_MISMATCH') {
    classification = 'credential_version_mismatch';
  }
  return {
    confirmed_success: exactSuccess,
    classification,
    http_status: Number.isInteger(httpStatus) ? httpStatus : null,
    safe_error_code: exactSuccess ? null : safeErrorCode,
    request_correlation_proven:
      resultRequestIdHash !== null && resultRequestIdHash === requestIdHash,
  };
}

export function classifyPasswordChangeEdgeResult({
  ok,
  httpStatus,
  safeErrorCode,
}) {
  if (
    ok === true
    && Number.isInteger(httpStatus)
    && httpStatus >= 200
    && httpStatus < 300
  ) {
    return {
      outcome: 'success',
      retry_allowed: false,
      http_status: httpStatus,
      safe_error_code: null,
    };
  }
  const code = safeEdgeCode(safeErrorCode, 'EDGE_RESPONSE_NOT_OK');
  const policyRejected =
    httpStatus === 409
    && code === PERMANENT_PASSWORD_POLICY_ERROR_CODE;
  return {
    outcome: policyRejected ? 'policy_rejected' : 'blocked',
    retry_allowed: policyRejected,
    http_status: Number.isInteger(httpStatus) ? httpStatus : null,
    safe_error_code: code,
  };
}

function postResetCheckpointResult(snapshot, classification, extras = {}) {
  return {
    classification,
    expected_success: false,
    protected_transition_completed: false,
    request_correlation_proven: false,
    terminal_proof: credentialProof(snapshot),
    ...extras,
  };
}

const SAFE_AUDIT_COMPARISON_FIELDS = Object.freeze([
  'credential_event_count',
  'latest_event_type',
  'latest_event_code',
  'latest_event_credential_version',
  'latest_event_request_id_hash',
  'latest_event_at',
  'operation_count',
  'latest_operation_type',
  'latest_operation_status',
  'latest_operation_current_version',
  'latest_operation_next_version',
  'latest_operation_resulting_state',
  'latest_operation_auth_changed',
  'latest_operation_revocation_confirmed',
  'latest_operation_request_id_hash',
  'latest_operation_completed_at',
]);

function safeAuditEvidenceUnchanged(referenceSnapshot, currentSnapshot) {
  return SAFE_AUDIT_COMPARISON_FIELDS.every((field) =>
    (referenceSnapshot?.audit?.[field] ?? null)
      === (currentSnapshot?.audit?.[field] ?? null));
}

export function classifyPostResetCheckpoint(
  snapshot,
  { referenceSnapshot, requestIdHash = null } = {},
) {
  try {
    assertRuntimeSnapshotStable(referenceSnapshot, snapshot);
  } catch {
    return postResetCheckpointResult(snapshot, 'runtime_transition');
  }
  try {
    assertSoleSuperAdminCheckpoint(snapshot);
  } catch {
    return postResetCheckpointResult(snapshot, 'sole_super_admin_drift');
  }
  const target = snapshot?.target;
  if (
    target?.user_id !== TARGET_USER_ID
    || target?.profile_state !== 'active'
    || target?.profile_active !== true
    || target?.same_organization_as_designated_admin !== true
    || target?.requested_lifecycle !== 'active'
    || !exactRoleScope(target, 'employee', 'assigned_only')
  ) {
    return postResetCheckpointResult(snapshot, 'authorization_drift');
  }
  if (target.credential_version !== target.auth_credential_version) {
    return postResetCheckpointResult(snapshot, 'credential_version_mismatch');
  }
  if (
    target.credential_state === 'active'
    && target.credential_version === INITIAL_CREDENTIAL_VERSION
    && target.pending_operation === false
    && target.pending_operation_count === 0
  ) {
    const audit = snapshot?.audit;
    const currentRequestRecorded =
      SHA256_PATTERN.test(String(requestIdHash ?? ''))
      && audit?.latest_event_request_id_hash === requestIdHash
      && audit?.latest_operation_request_id_hash === requestIdHash;
    const resetAbortedWithoutAuthChange =
      currentRequestRecorded
      && audit?.latest_event_type === 'admin_reset_aborted'
      && audit?.latest_event_credential_version === INITIAL_CREDENTIAL_VERSION
      && audit?.latest_operation_type === 'admin_reset'
      && audit?.latest_operation_status === 'aborted'
      && audit?.latest_operation_current_version === INITIAL_CREDENTIAL_VERSION
      && audit?.latest_operation_next_version === POST_RESET_CREDENTIAL_VERSION
      && audit?.latest_operation_resulting_state === 'active'
      && audit?.latest_operation_auth_changed === false;
    if (resetAbortedWithoutAuthChange) {
      return postResetCheckpointResult(
        snapshot,
        'reset_aborted_without_auth_change',
        { request_correlation_proven: true },
      );
    }
    const resetNotStartedEvidenceUnchanged =
      target.session_count === referenceSnapshot?.target?.session_count
      && target.unrevoked_refresh_token_count
        === referenceSnapshot?.target?.unrevoked_refresh_token_count
      && safeAuditEvidenceUnchanged(referenceSnapshot, snapshot);
    return postResetCheckpointResult(
      snapshot,
      resetNotStartedEvidenceUnchanged
        ? 'reset_not_started'
        : 'unexpected_protected_state',
    );
  }
  if (target.credential_state === 'session_revocation_review_required') {
    return postResetCheckpointResult(snapshot, 'session_revocation_review_required');
  }
  if (target.credential_state === 'recovery_required') {
    return postResetCheckpointResult(snapshot, 'recovery_required');
  }
  if (
    target.credential_state === 'reset_in_progress'
    || target.pending_operation === true
    || target.pending_operation_count > 0
  ) {
    return postResetCheckpointResult(snapshot, 'reset_in_progress');
  }
  if (
    target.credential_state === 'admin_reset_change_required'
    && target.credential_version === POST_RESET_CREDENTIAL_VERSION
  ) {
    if (
      target.session_count !== 0
      || target.unrevoked_refresh_token_count !== 0
    ) {
      return postResetCheckpointResult(snapshot, 'nonzero_sessions_after_reset');
    }
    const audit = snapshot?.audit;
    const protectedTransitionCompleted =
      audit?.latest_event_type === 'admin_reset_completed'
      && audit?.latest_event_code === 'PATCH83U_ADMIN_RESET_COMPLETED'
      && audit?.latest_event_credential_version === POST_RESET_CREDENTIAL_VERSION
      && audit?.latest_operation_type === 'admin_reset'
      && audit?.latest_operation_status === 'completed'
      && audit?.latest_operation_current_version === INITIAL_CREDENTIAL_VERSION
      && audit?.latest_operation_next_version === POST_RESET_CREDENTIAL_VERSION
      && audit?.latest_operation_resulting_state === 'admin_reset_change_required'
      && audit?.latest_operation_auth_changed === true
      && audit?.latest_operation_revocation_confirmed === true;
    let requestCorrelationProven = false;
    if (SHA256_PATTERN.test(String(requestIdHash ?? ''))) {
      try {
        assertAuditCheckpoint(snapshot, {
          kind: 'admin_reset',
          requestIdHash,
        });
        requestCorrelationProven = true;
      } catch {
        requestCorrelationProven = false;
      }
    }
    const expectedSuccess =
      protectedTransitionCompleted
      && requestCorrelationProven
      && target.pending_operation === false
      && target.pending_operation_count === 0;
    return postResetCheckpointResult(snapshot, 'admin_reset_change_required', {
      expected_success: expectedSuccess,
      protected_transition_completed: protectedTransitionCompleted,
      request_correlation_proven: requestCorrelationProven,
    });
  }
  if (![INITIAL_CREDENTIAL_VERSION, POST_RESET_CREDENTIAL_VERSION]
    .includes(target.credential_version)) {
    return postResetCheckpointResult(snapshot, 'credential_version_mismatch');
  }
  return postResetCheckpointResult(snapshot, 'unexpected_protected_state');
}

export function evaluateResetProgression(edgeOutcome, checkpointOutcome) {
  const allowed =
    edgeOutcome?.confirmed_success === true
    && checkpointOutcome?.expected_success === true;
  return {
    allowed,
    edge_success_confirmed: edgeOutcome?.confirmed_success === true,
    checkpoint_success_confirmed: checkpointOutcome?.expected_success === true,
  };
}

export async function executeOneShotResetAndCollectCheckpoint({
  controller,
  readiness,
  submitter,
  inspectEdgeResponse,
  afterSubmissionAttempt = async () => {},
  readCheckpoint3,
  classifyCheckpoint3,
}) {
  const automaticRecoveryActions = [];
  let response = null;
  let submissionError = false;
  try {
    response = await controller.submit(readiness, submitter);
  } catch {
    submissionError = true;
    controller.markAmbiguous();
  }
  let edgeOutcome;
  if (response) {
    try {
      edgeOutcome = await inspectEdgeResponse(response);
    } catch {
      edgeOutcome = {
        confirmed_success: false,
        classification: 'ambiguous_edge_response',
        http_status: null,
        safe_error_code: 'EDGE_RESPONSE_UNREADABLE',
        request_correlation_proven: false,
      };
      controller.markAmbiguous();
    }
  } else {
    edgeOutcome = {
      confirmed_success: false,
      classification: 'ambiguous_edge_response',
      http_status: null,
      safe_error_code: submissionError
        ? 'EDGE_RESPONSE_UNAVAILABLE'
        : 'EDGE_RESPONSE_MISSING',
      request_correlation_proven: false,
    };
  }
  let postSubmissionCleanupSucceeded = true;
  try {
    await afterSubmissionAttempt();
  } catch {
    postSubmissionCleanupSucceeded = false;
    controller.markAmbiguous();
  }
  const checkpoint = await readCheckpoint3();
  const checkpointOutcome = classifyCheckpoint3(checkpoint);
  const progression = evaluateResetProgression(edgeOutcome, checkpointOutcome);
  if (!postSubmissionCleanupSucceeded) progression.allowed = false;
  if (!progression.allowed) controller.markAmbiguous();
  return {
    response,
    edgeOutcome,
    checkpoint,
    checkpointOutcome,
    progression,
    postSubmissionCleanupSucceeded,
    automaticRecoveryActions,
  };
}

export async function runBoundedPasswordPolicyAttempts({
  initialCandidate,
  temporaryPassword,
  submitAttempt,
  promptReplacement,
  maxAttempts = PASSWORD_CHANGE_MAX_ATTEMPTS,
}) {
  if (
    !(initialCandidate instanceof SecretValue)
    || !(temporaryPassword instanceof SecretValue)
    || typeof submitAttempt !== 'function'
    || typeof promptReplacement !== 'function'
    || maxAttempts !== PASSWORD_CHANGE_MAX_ATTEMPTS
  ) {
    throw new Error('PATCH83U_PASSWORD_POLICY_RETRY_CONTRACT_INVALID');
  }
  if (initialCandidate.equals(temporaryPassword)) {
    throw new Error('PATCH83U_REPLACEMENT_PASSWORD_CONFIRMATION_REFUSED');
  }
  const priorCandidates = [initialCandidate];
  const policyErrorCodes = [];
  let candidate = initialCandidate;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const submitted = await submitAttempt({ candidate, attempt });
    const classified = classifyPasswordChangeEdgeResult(submitted);
    if (classified.outcome === 'success') {
      return {
        candidate,
        attempt_count: attempt,
        policy_rejection_count: policyErrorCodes.length,
        policy_error_codes: [...policyErrorCodes],
        final_result: submitted,
      };
    }
    if (!classified.retry_allowed) {
      throw new Error(
        `PATCH83U_PASSWORD_CHANGE_NOT_RETRYABLE:${classified.safe_error_code}`,
      );
    }
    policyErrorCodes.push(classified.safe_error_code);
    if (attempt === maxAttempts) {
      const error = new Error('PATCH83U_PASSWORD_POLICY_RETRY_LIMIT_REACHED');
      error.attemptCount = attempt;
      error.policyErrorCodes = [...policyErrorCodes];
      throw error;
    }
    const replacement = await promptReplacement({
      nextAttempt: attempt + 1,
      priorCandidates: [...priorCandidates],
    });
    if (
      !(replacement?.candidate instanceof SecretValue)
      || !(replacement?.confirmation instanceof SecretValue)
      || !replacement.candidate.equals(replacement.confirmation)
      || replacement.candidate.equals(temporaryPassword)
      || priorCandidates.some((prior) => replacement.candidate.equals(prior))
    ) {
      throw new Error('PATCH83U_REPLACEMENT_PASSWORD_CONFIRMATION_REFUSED');
    }
    candidate = replacement.candidate;
    priorCandidates.push(candidate);
  }
  throw new Error('PATCH83U_PASSWORD_POLICY_RETRY_LIMIT_REACHED');
}

export function operatorGuidanceForState(state, details = {}) {
  const guidance = {
    ambiguous_edge_response:
      'Do not resubmit. Preserve the original request-ID hash, obtain fresh read-only database evidence, and inspect the protected operation state.',
    reset_in_progress:
      'Do not retry or invent a new request ID. Stop and obtain protected operation/database evidence.',
    session_revocation_review_required:
      'Stop before password change. Escalate for protected session-revocation review; do not invoke abort or reconciliation automatically.',
    recovery_required:
      'Stop all credential actions for the target and follow the separately authorized protected recovery runbook.',
    credential_version_mismatch:
      'Stop. Compare database and Auth versions using read-only evidence; do not attempt a second credential mutation.',
    runtime_transition:
      'Stop immediately because runtime state/version changed during execution. Re-run the full read-only readiness review.',
    temporary_password_rejected:
      'Stop and inspect the finalized protected state. Do not reset again or expose the temporary credential.',
    permanent_password_policy_rejected:
      'Remain in Forced Password Change and request a different compliant permanent password through a hidden prompt.',
    network_interruption:
      'Treat the result as ambiguous. Do not resubmit; preserve the original request-ID hash and obtain fresh read-only evidence.',
    repeated_request_id:
      'Do not invoke again. Treat the existing request ID as the sole correlation and inspect its protected operation result.',
    reset_not_started:
      'Checkpoint 3 proves the protected reset did not start. Do not resubmit under this run; preserve the exhausted one-shot boundary and obtain a new authorization.',
    reset_aborted_without_auth_change:
      'Checkpoint 3 proves this request started but was aborted before any Auth change. Do not resubmit under this run; preserve the request correlation and obtain a new authorization.',
    admin_reset_change_required:
      'Checkpoint 3 shows the protected reset transition completed, but progression is blocked unless the Edge response was also exact. Do not resubmit, abort, reconcile, or continue automatically.',
    nonzero_sessions_after_reset:
      'Checkpoint 3 found remaining sessions or refresh rows. Stop before password change and use protected read-only review; never resubmit the reset.',
    authorization_drift:
      'Stop because target role, scope, lifecycle, identity, or organization alignment drifted. Do not perform another credential action.',
    sole_super_admin_drift:
      'Stop because the sole-Super-Admin safety state changed. Keep the administrator contexts available and perform a fresh read-only review.',
    finalization_proof_incomplete:
      'Stop because the finalization checkpoint did not prove all protected credential timestamps and reconciliation state. Do not attempt another credential action.',
    final_session_contract_mismatch:
      'Stop because the fresh-login session or refresh-row count differs from the exact freeze-bound contract. Do not widen or override the expected count.',
    unexpected_protected_state:
      'Stop at Checkpoint 3. Preserve the one-shot request correlation and obtain protected operator review for the exact hosted state.',
  };
  return {
    code: state,
    guidance: guidance[state] ?? 'Stop and obtain a protected read-only state review before any further credential action.',
    observed_state: details.observedState ?? null,
  };
}

function guidanceCodeForError(error) {
  const message = String(error instanceof Error ? error.message : error);
  const resetOutcome = message.match(
    /PATCH83U_RESET_OUTCOME_NOT_UNEQUIVOCAL:([a-z0-9_]+)/,
  )?.[1];
  if (resetOutcome) return resetOutcome;
  if (/RUNTIME_TRANSITION/.test(message)) return 'runtime_transition';
  if (/SESSION_REVOCATION_REVIEW_REQUIRED/.test(message)) return 'session_revocation_review_required';
  if (/RECOVERY_REQUIRED/.test(message)) return 'recovery_required';
  if (/RESET_IN_PROGRESS|PENDING.*OPERATION/.test(message)) return 'reset_in_progress';
  if (/CREDENTIAL_VERSION|VERSION_MISMATCH/.test(message)) return 'credential_version_mismatch';
  if (/NONZERO_SESSIONS|UNREVOKED_REFRESH/.test(message)) return 'nonzero_sessions_after_reset';
  if (/TEMPORARY_PASSWORD_REJECTED/.test(message)) return 'temporary_password_rejected';
  if (/PERMANENT_PASSWORD_POLICY/.test(message)) return 'permanent_password_policy_rejected';
  if (/PASSWORD_CHANGED_AT_SET|SESSIONS_REVOKED_AT_SET|RECONCILIATION_AUTH_CHANGED/.test(message)) {
    return 'finalization_proof_incomplete';
  }
  if (/FINAL_SESSION_COUNT|FINAL_UNREVOKED_REFRESH_COUNT/.test(message)) {
    return 'final_session_contract_mismatch';
  }
  if (/RETRY_REFUSED|REPEATED_REQUEST/.test(message)) return 'repeated_request_id';
  if (/timeout|network|CORRELATION_UNAVAILABLE|AMBIGUOUS/i.test(message)) {
    return 'ambiguous_edge_response';
  }
  return 'network_interruption';
}

export class ResetSubmissionController {
  #submitted = false;
  #ambiguous = false;
  #requestIdHash = null;
  #requestIdObservationCount = 0;
  #formPrepared = false;
  #operatorConfirmationAuthorized = false;

  get requestIdHash() {
    return this.#requestIdHash;
  }

  get requestIdObservationCount() {
    return this.#requestIdObservationCount;
  }

  get submissionStarted() {
    return this.#submitted;
  }

  get ambiguous() {
    return this.#ambiguous;
  }

  async prepareResetForm(readiness, browserTargetValidated, interactor) {
    if (!readiness?.passed) throw new Error('PATCH83U_RESET_READINESS_GATES_FAILED');
    if (browserTargetValidated !== true) {
      throw new Error('PATCH83U_RESET_BROWSER_TARGET_NOT_VALIDATED');
    }
    if (
      this.#submitted
      || this.#ambiguous
      || this.#formPrepared
      || typeof interactor !== 'function'
    ) {
      throw new Error('PATCH83U_RESET_FORM_PREPARATION_REFUSED');
    }
    await interactor();
    this.#formPrepared = true;
    return true;
  }

  authorizeOperatorConfirmation(candidate, contract) {
    if (!this.#formPrepared || this.#submitted || this.#ambiguous) {
      throw new Error('PATCH83U_RESET_CONFIRMATION_SEQUENCE_REFUSED');
    }
    const evidence = assertFreezeBoundOperatorConfirmation(candidate, contract);
    this.#operatorConfirmationAuthorized = true;
    return evidence;
  }

  observeRequestId(requestId) {
    if (!this.#submitted) {
      throw new Error('PATCH83U_RESET_REQUEST_ID_BEFORE_SUBMISSION_REFUSED');
    }
    this.#requestIdObservationCount += 1;
    const observedHash = hashRequestId(requestId);
    if (this.#requestIdHash && this.#requestIdHash !== observedHash) {
      this.#ambiguous = true;
      throw new Error('PATCH83U_RESET_REQUEST_ID_CHANGED');
    }
    this.#requestIdHash = observedHash;
    return observedHash;
  }

  async submit(readiness, submitter) {
    if (!readiness?.passed) throw new Error('PATCH83U_RESET_READINESS_GATES_FAILED');
    if (!this.#formPrepared) throw new Error('PATCH83U_RESET_FORM_NOT_PREPARED');
    if (!this.#operatorConfirmationAuthorized) {
      throw new Error('PATCH83U_RUN007_OPERATOR_CONFIRMATION_REQUIRED');
    }
    if (this.#submitted || this.#ambiguous) throw new Error('PATCH83U_RESET_RETRY_REFUSED');
    this.#submitted = true;
    try {
      return await submitter();
    } catch (error) {
      this.#ambiguous = true;
      throw error;
    }
  }

  markAmbiguous() {
    this.#ambiguous = true;
  }
}

export function parseCliArguments(argv) {
  for (const argument of argv) {
    if (PROHIBITED_ARGUMENT_PATTERNS.some((pattern) => pattern.test(argument))) {
      throw new Error('PATCH83U_SECRET_COMMAND_LINE_ARGUMENT_REFUSED');
    }
  }
  const result = {
    execute: false,
    precredentialReadinessOnly: false,
    precredentialNoSecretFixture: false,
  };
  const seenOptions = new Set();
  const readValue = (index) => {
    const candidate = argv[index + 1];
    if (
      typeof candidate !== 'string'
      || candidate.trim() === ''
      || candidate.startsWith('--')
    ) {
      throw new Error('PATCH83U_CLI_ARGUMENT_VALUE_REQUIRED');
    }
    return candidate;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (seenOptions.has(value)) {
      throw new Error('PATCH83U_DUPLICATE_ARGUMENT_REFUSED');
    }
    seenOptions.add(value);
    if (value === '--execute-hosted-proof') result.execute = true;
    else if (value === '--precredential-readiness-only') {
      result.precredentialReadinessOnly = true;
    }
    else if (value === '--precredential-inert-fixture') {
      result.precredentialNoSecretFixture = true;
    }
    else if (value === '--app-url') result.appUrl = readValue(index++);
    else if (value === '--supabase-url') result.supabaseUrl = readValue(index++);
    else if (value === '--evidence-channel') result.evidenceChannel = readValue(index++);
    else if (value === '--sql-editor-project-ref') {
      result.sqlEditorProjectRef = readValue(index++);
    }
    else if (value === '--out') result.out = readValue(index++);
    else if (value === '--execution-freeze') result.executionFreeze = readValue(index++);
    else if (value === '--checkpoint-dir') result.checkpointDir = readValue(index++);
    else if (value === '--execution-freeze-sha256') {
      result.executionFreezeSha256 = readValue(index++);
    }
    else throw new Error('PATCH83U_UNKNOWN_ARGUMENT_REFUSED');
  }
  if (result.execute && result.precredentialReadinessOnly) {
    throw new Error('PATCH83U_EXECUTION_MODE_CONFLICT');
  }
  if (
    result.precredentialNoSecretFixture
    && (!result.precredentialReadinessOnly || result.execute)
  ) {
    throw new Error('PATCH83U_NO_SECRET_FIXTURE_MODE_REFUSED');
  }
  return result;
}

export function deriveSupabaseProjectRef(supabaseUrl) {
  let parsed;
  try {
    parsed = new URL(supabaseUrl);
  } catch {
    throw new Error('PATCH83U_SUPABASE_URL_INVALID');
  }
  const match = /^([a-z0-9]{20})\.supabase\.co$/i.exec(parsed.hostname);
  if (
    parsed.protocol !== 'https:'
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.port !== ''
    || parsed.pathname !== '/'
    || parsed.search !== ''
    || parsed.hash !== ''
    || !match
  ) {
    throw new Error('PATCH83U_SUPABASE_URL_INVALID');
  }
  return match[1].toLowerCase();
}

export function assertSqlEditorProjectConfirmation({
  projectRef,
  supabaseUrl,
  freeze = null,
}) {
  if (typeof projectRef !== 'string' || projectRef.trim() === '') {
    throw new Error('PATCH83U_SQL_EDITOR_PROJECT_REF_REQUIRED');
  }
  if (projectRef.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error('PATCH83U_PRODUCTION_SQL_EDITOR_TARGET_REFUSED');
  }
  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new Error('PATCH83U_SQL_EDITOR_PROJECT_REF_MALFORMED');
  }
  if (projectRef !== STAGING_PROJECT_REF) {
    throw new Error('PATCH83U_STAGING_SQL_EDITOR_TARGET_NOT_CONFIRMED');
  }
  if (deriveSupabaseProjectRef(supabaseUrl) !== projectRef) {
    throw new Error('PATCH83U_SQL_EDITOR_PROJECT_REF_URL_MISMATCH');
  }
  if (freeze) {
    const frozenAllowedRef = freeze?.targets?.allowed_staging_project_ref;
    const frozenProhibitedRef = freeze?.targets?.prohibited_production_project_ref;
    if (
      frozenAllowedRef !== projectRef
      || frozenProhibitedRef !== PRODUCTION_PROJECT_REF
    ) {
      throw new Error('PATCH83U_SQL_EDITOR_PROJECT_REF_FREEZE_MISMATCH');
    }
  }
  return Object.freeze({
    passed: true,
    project_ref: projectRef,
    gate_id: SQL_EDITOR_PROJECT_CONFIRMATION_GATE_ID,
  });
}

export function createExecutionPlan(args, adapters = {}) {
  assertStagingConfiguration({
    project_ref: STAGING_PROJECT_REF,
    supabase_url: args.supabaseUrl,
    app_url: args.appUrl,
  });
  if (!args.execute && !args.precredentialReadinessOnly) {
    return {
      executable: false,
      reason: 'PATCH83U_EXPLICIT_EXECUTION_FLAG_REQUIRED',
      hostedCallCount: adapters.hostedCallCount?.() ?? 0,
    };
  }
  if (args.evidenceChannel !== SQL_EDITOR_EVIDENCE_CHANNEL) {
    if (args.sqlEditorProjectRef !== undefined) {
      throw new Error('PATCH83U_SQL_EDITOR_PROJECT_REF_CHANNEL_REFUSED');
    }
    throw new Error('PATCH83U_SQL_EDITOR_EVIDENCE_CHANNEL_AND_OUTPUT_REQUIRED');
  }
  if (!args.out) {
    throw new Error('PATCH83U_SQL_EDITOR_EVIDENCE_CHANNEL_AND_OUTPUT_REQUIRED');
  }
  const projectConfirmation = assertSqlEditorProjectConfirmation({
    projectRef: args.sqlEditorProjectRef,
    supabaseUrl: args.supabaseUrl,
  });
  assertRun007OutputCandidate(args.out);
  if (typeof args.checkpointDir !== 'string' || args.checkpointDir.trim() === '') {
    throw new Error('PATCH83U_SQL_EDITOR_CHECKPOINT_DIRECTORY_REQUIRED');
  }
  if (
    typeof args.executionFreeze !== 'string'
    || !SHA256_PATTERN.test(String(args.executionFreezeSha256 ?? ''))
  ) {
    throw new Error('PATCH83U_EXECUTION_FREEZE_AND_HASH_REQUIRED');
  }
  return {
    executable: args.execute === true,
    precredentialReadiness: args.precredentialReadinessOnly === true,
    projectConfirmation,
  };
}

export async function runSqlEditorEvidence(checkpoint, context) {
  const projectConfirmation = context.projectConfirmation;
  if (
    projectConfirmation?.passed !== true
    || projectConfirmation?.gate_id !== SQL_EDITOR_PROJECT_CONFIRMATION_GATE_ID
    || projectConfirmation?.project_ref !== STAGING_PROJECT_REF
  ) {
    throw new Error('PATCH83U_SQL_EDITOR_PROJECT_CONFIRMATION_GATE_REQUIRED');
  }
  const waitForCheckpoint = context.waitForCheckpoint
    ?? waitForSqlEditorCheckpointFile;
  return waitForCheckpoint({
    checkpoint,
    checkpointDirectory: context.checkpointDirectory,
    state: context.checkpointState,
    checkpointSchema: context.checkpointSchema,
    operatorProjectRef: projectConfirmation.project_ref,
    onWaiting: ({ checkpoint: label, expected_file: expectedFile }) => {
      process.stderr.write(
        `Waiting for SQL Editor checkpoint ${label} in ${expectedFile}.\n`,
      );
    },
  });
}

export function assertFrontendProjectAttestation(attestation) {
  if (attestation?.productionProjectPresent === true) {
    throw new Error('PATCH83U_PRODUCTION_FRONTEND_BUNDLE_REFUSED');
  }
  if (
    attestation?.stagingProjectPresent !== true
    || attestation?.applicationOriginMatches !== true
  ) {
    throw new Error('PATCH83U_STAGING_FRONTEND_PROJECT_NOT_PROVEN');
  }
  return true;
}

async function attestLoadedFrontend(page, appUrl, targetGuard) {
  assertBrowserTargetGuard(targetGuard);
  const expectedOrigin = new URL(appUrl).origin;
  const attestation = await page.evaluate(
    async ({ stagingProjectRef, productionProjectRef, expectedApplicationOrigin }) => {
      const resourceUrls = new Set([
        ...Array.from(document.scripts, (script) => script.src).filter(Boolean),
        ...performance.getEntriesByType('resource').map((entry) => entry.name),
      ]);
      const sameOriginSourceUrls = Array.from(resourceUrls).filter((value) => {
        try {
          const url = new URL(value, globalThis.location.href);
          return url.origin === globalThis.location.origin
            && /\.(?:[cm]?[jt]sx?)(?:\?|$)/i.test(url.pathname + url.search);
        } catch {
          return false;
        }
      });
      const sourceTexts = await Promise.all(sameOriginSourceUrls.map(async (url) => {
        try {
          const response = await fetch(url, { credentials: 'omit', redirect: 'error' });
          return response.ok ? response.text() : '';
        } catch {
          return '';
        }
      }));
      const joinedSource = sourceTexts.join('\n');
      return {
        applicationOriginMatches: globalThis.location.origin === expectedApplicationOrigin,
        stagingProjectPresent: joinedSource.includes(stagingProjectRef),
        productionProjectPresent: joinedSource.includes(productionProjectRef),
      };
    },
    {
      stagingProjectRef: STAGING_PROJECT_REF,
      productionProjectRef: PRODUCTION_PROJECT_REF,
      expectedApplicationOrigin: expectedOrigin,
    },
  );
  assertBrowserTargetGuard(targetGuard);
  assertFrontendProjectAttestation(attestation);
}

function isPasswordTokenResponse(candidate) {
  try {
    const url = new URL(candidate.url());
    return candidate.request().method() === 'POST'
      && url.origin === STAGING_SUPABASE_ORIGIN
      && url.pathname === '/auth/v1/token'
      && url.searchParams.get('grant_type') === 'password';
  } catch {
    return false;
  }
}

async function safeRejectedAuthResult(response) {
  if (response.ok()) {
    return {
      failed: false,
      http_status: response.status(),
      safe_error_code: 'UNEXPECTED_AUTH_ACCEPTED',
    };
  }
  let safeCode = 'AUTH_PASSWORD_REJECTED';
  try {
    const body = await response.json();
    if (typeof body?.error_code === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(body.error_code)) {
      safeCode = body.error_code;
    } else if (typeof body?.code === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(body.code)) {
      safeCode = body.code;
    }
  } catch {
    // No response content is retained or emitted.
  }
  return {
    failed: true,
    http_status: response.status(),
    safe_error_code: safeCode,
  };
}

async function login(page, appUrl, identifier, secret, targetGuard) {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await attestLoadedFrontend(page, appUrl, targetGuard);
  await page.getByLabel(/Email or Employee ID|البريد الإلكتروني أو رقم الموظف/i).fill(identifier.reveal());
  const passwordField = page.getByLabel(/^Password$|^كلمة المرور$/i);
  await passwordField.fill(secret.reveal());
  const authResponsePromise = page.waitForResponse(isPasswordTokenResponse, { timeout: 45_000 });
  await page.getByRole('button', { name: /Sign in|تسجيل الدخول/i }).click();
  const authResponse = await authResponsePromise;
  if (await passwordField.isVisible()) await passwordField.fill('');
  if (!authResponse.ok()) {
    throw new Error(`PATCH83U_AUTHENTICATION_REJECTED:${authResponse.status()}`);
  }
  await page.waitForLoadState('networkidle');
  return authResponse.status();
}

async function loginRejected(page, appUrl, identifier, secret, targetGuard) {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await attestLoadedFrontend(page, appUrl, targetGuard);
  await page.getByLabel(/Email or Employee ID|البريد الإلكتروني أو رقم الموظف/i).fill(identifier.reveal());
  const passwordField = page.getByLabel(/^Password$|^كلمة المرور$/i);
  await passwordField.fill(secret.reveal());
  const authResponsePromise = page.waitForResponse(isPasswordTokenResponse, { timeout: 45_000 });
  await page.getByRole('button', { name: /Sign in|تسجيل الدخول/i }).click();
  const authResponse = await authResponsePromise;
  if (await passwordField.isVisible()) await passwordField.fill('');
  return safeRejectedAuthResult(authResponse);
}

async function authenticatedUserId(page) {
  return page.evaluate(async () => {
    const client = await import('/src/lib/supabase.ts');
    const { data, error } = await client.supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  });
}

export function assertDesignatedBrowserIdentities({
  originalAdminUserId,
  secondaryAdminUserId,
  employeeUserIds,
}) {
  if (
    originalAdminUserId !== DESIGNATED_SUPER_ADMIN_ID
    || secondaryAdminUserId !== DESIGNATED_SUPER_ADMIN_ID
  ) {
    throw new Error('PATCH83U_DESIGNATED_ADMIN_BROWSER_IDENTITY_FAILED');
  }
  if (
    !Array.isArray(employeeUserIds)
    || employeeUserIds.length !== 2
    || employeeUserIds.some((userId) => userId !== TARGET_USER_ID)
  ) {
    throw new Error('PATCH83U_EMPLOYEE_BROWSER_IDENTITY_FAILED');
  }
  return true;
}

export function assertAdminContextReadinessProof({
  originalContext,
  secondaryContext,
  originalAdminUserId,
  secondaryAdminUserId,
  originalContextAvailable,
  secondaryReauthenticated,
}) {
  assertNonpersistentBrowserContext(originalContext);
  assertNonpersistentBrowserContext(secondaryContext);
  if (
    originalAdminUserId !== DESIGNATED_SUPER_ADMIN_ID
    || secondaryAdminUserId !== DESIGNATED_SUPER_ADMIN_ID
    || originalContextAvailable !== true
    || secondaryReauthenticated !== true
  ) {
    throw new Error('PATCH83U_ADMIN_CONTEXT_READINESS_PROOF_FAILED');
  }
  return true;
}

async function locatorHasNoMatches(locator) {
  return (await locator.count()) === 0;
}

export function evaluateForcedPasswordChangeSurfaceProof(observation) {
  const required = [
    'forced_change_visible',
    'forced_change_visible_after_protected_navigation',
    'application_shell_absent',
    'sidebar_absent',
    'employee_content_absent',
    'admin_content_absent',
    'provisioning_controls_absent',
  ];
  const checks = Object.fromEntries(
    required.map((field) => [field, observation?.[field] === true]),
  );
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
  };
}

export function assertTemporaryPasswordRestrictedLoginProof({
  context,
  authenticatedUserId: observedUserId,
  surfaceProof,
}) {
  assertNonpersistentBrowserContext(context);
  if (
    observedUserId !== TARGET_USER_ID
    || surfaceProof?.passed !== true
  ) {
    throw new Error('PATCH83U_TEMPORARY_PASSWORD_RESTRICTED_LOGIN_NOT_PROVEN');
  }
  return true;
}

export function assertFreshPermanentLoginProof({
  context,
  authenticatedUserId: observedUserId,
  authorizationProof,
}) {
  assertNonpersistentBrowserContext(context);
  if (observedUserId !== TARGET_USER_ID) {
    throw new Error('PATCH83U_FRESH_PERMANENT_LOGIN_IDENTITY_NOT_PROVEN');
  }
  assertFinalEmployeeAuthorizationProof(authorizationProof);
  return true;
}

async function inspectForcedPasswordChangeSurface(page) {
  const forcedChangeVisible = await page.getByRole('heading', {
    name: /Password change required|تغيير كلمة المرور مطلوب/i,
  }).isVisible().catch(() => false);
  const applicationShellAbsent = await locatorHasNoMatches(
    page.locator('.app-shell'),
  );
  const sidebarAbsent = await locatorHasNoMatches(
    page.locator('nav.sidebar-nav-tree'),
  );
  const employeeContentAbsent = await locatorHasNoMatches(
    page.locator('section.workspace-home, main.main-content'),
  );
  const adminContentAbsent =
    await locatorHasNoMatches(
      page.getByText(/User Management|إدارة المستخدمين/i),
    )
    && await locatorHasNoMatches(
      page.getByText(/Access Control|صلاحيات المستخدمين/i),
    );
  const provisioningControlsAbsent = await locatorHasNoMatches(
    page.getByRole('button', {
      name: /Provisioning Queue|Provisioning queue|Reset temporary password|Reset password and revoke sessions|قائمة تجهيز حسابات المستخدمين|Provision account|Reconcile account|تجهيز الحساب|مطابقة الحساب/i,
    }),
  );
  return {
    forced_change_visible: forcedChangeVisible,
    application_shell_absent: applicationShellAbsent,
    sidebar_absent: sidebarAbsent,
    employee_content_absent: employeeContentAbsent,
    admin_content_absent: adminContentAbsent,
    provisioning_controls_absent: provisioningControlsAbsent,
  };
}

export function controlledEmployeeAdminRedirectIsDenied({
  url,
  employeeContentVisible,
  authenticatedUserId: observedUserId,
}) {
  try {
    const destination = new URL(url);
    return destination.origin === STAGING_APPLICATION_ORIGIN
      && (destination.searchParams.get('page') ?? CONTROLLED_EMPLOYEE_REDIRECT_PAGE)
        === CONTROLLED_EMPLOYEE_REDIRECT_PAGE
      && employeeContentVisible === true
      && observedUserId === TARGET_USER_ID;
  } catch {
    return false;
  }
}

export async function proveControlledEmployeeContextAuthorization({
  context,
  page,
  label,
  appUrl,
  targetGuard,
  refreshSucceeded,
}) {
  if (!CONTROLLED_EMPLOYEE_CONTEXT_LABELS.includes(label)) {
    throw new Error('PATCH83U_CONTROLLED_EMPLOYEE_CONTEXT_LABEL_REFUSED');
  }
  const nonpersistentContext = assertNonpersistentBrowserContext(context);
  await page.goto(`${appUrl}?page=home`, { waitUntil: 'networkidle' });
  await attestLoadedFrontend(page, appUrl, targetGuard);
  const authenticationSucceeded =
    await authenticatedUserId(page) === TARGET_USER_ID;
  const permittedEmployeePageAccessible =
    await page.locator('section.workspace-home').isVisible().catch(() => false);
  const sidebar = page.locator('nav.sidebar-nav-tree');
  const adminNavigationAbsent = await locatorHasNoMatches(
    sidebar.getByText(/Admin & Organization|الإعدادات والهيكل التنظيمي/i),
  );
  const userManagementAbsent = await locatorHasNoMatches(
    sidebar.getByText(/User Management|إدارة المستخدمين/i),
  );
  const accessControlAbsent = await locatorHasNoMatches(
    sidebar.getByText(/Access Control|صلاحيات المستخدمين/i),
  );
  const provisioningControlsAbsent = await locatorHasNoMatches(
    page.getByRole('button', {
      name: /Provisioning Queue|Provisioning queue|قائمة تجهيز حسابات المستخدمين|Provision account|Reconcile account|تجهيز الحساب|مطابقة الحساب/i,
    }),
  );
  await page.goto(`${appUrl}?page=admin`, { waitUntil: 'networkidle' });
  let adminRouteDenied = false;
  let adminRedirectDestinationPermitted = false;
  try {
    await page.waitForURL((candidate) => {
      const url = new URL(candidate.toString());
      return url.origin === STAGING_APPLICATION_ORIGIN
        && (url.searchParams.get('page') ?? CONTROLLED_EMPLOYEE_REDIRECT_PAGE)
          === CONTROLLED_EMPLOYEE_REDIRECT_PAGE;
    }, { timeout: 15_000 });
    const redirectedEmployeeContentVisible =
      await page.locator('section.workspace-home').isVisible().catch(() => false);
    const redirectedUserId = await authenticatedUserId(page);
    adminRedirectDestinationPermitted = controlledEmployeeAdminRedirectIsDenied({
      url: page.url(),
      employeeContentVisible: redirectedEmployeeContentVisible,
      authenticatedUserId: redirectedUserId,
    });
    adminRouteDenied = adminRedirectDestinationPermitted;
  } catch {
    adminRouteDenied = false;
    adminRedirectDestinationPermitted = false;
  }
  assertBrowserTargetGuard(targetGuard);
  return {
    label,
    nonpersistent_context: nonpersistentContext,
    authentication_succeeded: authenticationSucceeded,
    refresh_succeeded: refreshSucceeded === true,
    permitted_employee_page_accessible: permittedEmployeePageAccessible,
    admin_route_denied: adminRouteDenied,
    admin_redirect_destination_permitted: adminRedirectDestinationPermitted,
    admin_navigation_absent: adminNavigationAbsent,
    user_management_absent: userManagementAbsent,
    access_control_absent: accessControlAbsent,
    provisioning_controls_absent: provisioningControlsAbsent,
  };
}

export async function proveStaleEmployeeContextDenied({
  page,
  label,
  appUrl,
  targetGuard,
}) {
  if (!CONTROLLED_EMPLOYEE_CONTEXT_LABELS.includes(label)) {
    throw new Error('PATCH83U_CONTROLLED_EMPLOYEE_CONTEXT_LABEL_REFUSED');
  }
  await page.reload({ waitUntil: 'networkidle' });
  const authenticatedUserAbsent = await authenticatedUserId(page) === null;
  const signInVisible =
    await page.getByRole('button', { name: /Sign in|تسجيل الدخول/i })
      .isVisible()
      .catch(() => false);
  const employeeContentAbsent =
    !await page.locator('section.workspace-home').isVisible().catch(() => false);
  await page.goto(`${appUrl}?page=admin`, { waitUntil: 'networkidle' });
  const authenticatedUserStillAbsent = await authenticatedUserId(page) === null;
  const protectedRouteSignInVisible =
    await page.getByRole('button', { name: /Sign in|تسجيل الدخول/i })
      .isVisible()
      .catch(() => false);
  const adminContentAbsent =
    await locatorHasNoMatches(
      page.getByText(/User Management|إدارة المستخدمين/i),
    )
    && await locatorHasNoMatches(
      page.getByRole('button', {
        name: /Provisioning Queue|Reset temporary password|Reset password and revoke sessions|قائمة تجهيز حسابات المستخدمين/i,
      }),
    );
  assertBrowserTargetGuard(targetGuard);
  return {
    label,
    authenticated_user_absent:
      authenticatedUserAbsent && authenticatedUserStillAbsent,
    sign_in_visible: signInVisible && protectedRouteSignInVisible,
    employee_content_absent: employeeContentAbsent,
    admin_content_absent: adminContentAbsent,
    protected_route_access_denied:
      authenticatedUserStillAbsent
      && protectedRouteSignInVisible
      && adminContentAbsent,
  };
}

function sanitizeBrowserPathname(pathname) {
  return String(pathname || '/')
    .split('/')
    .map((segment) => (
      /^[0-9a-f]{24,}$/i.test(segment)
      || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)
      || segment.length > 80
        ? ':redacted'
        : segment
    ))
    .join('/');
}

export function classifyBrowserRequest(value) {
  if (typeof value !== 'string' || value.includes(PRODUCTION_PROJECT_REF)) {
    return 'production or unknown Supabase request';
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    return 'another exact safe classification';
  }
  if (url.protocol === 'data:' || url.protocol === 'blob:') {
    return 'required static/browser infrastructure request';
  }
  if (
    (url.protocol === 'http:' || url.protocol === 'ws:')
    && url.hostname === 'localhost'
    && url.port === '5173'
  ) {
    return 'local Vite/HMR request';
  }
  if (
    url.hostname === `${STAGING_PROJECT_REF}.supabase.co`
    && ((url.protocol === 'https:' && (!url.port || url.port === '443'))
      || (url.protocol === 'wss:' && (!url.port || url.port === '443')))
  ) {
    return 'expected staging Supabase request';
  }
  if (
    url.protocol === 'https:'
    && url.hostname === 'challenges.cloudflare.com'
    && (!url.port || url.port === '443')
  ) {
    return 'CAPTCHA/Turnstile request';
  }
  if (url.hostname.endsWith('.supabase.co')) {
    return 'production or unknown Supabase request';
  }
  return 'unnecessary third-party request';
}

export function sanitizeBrowserRequestDescriptor(request, executionPhase = 'unknown') {
  const rawUrl = typeof request === 'string' ? request : request?.url?.();
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return Object.freeze({
      scheme: 'invalid',
      hostname: 'invalid',
      port: null,
      pathname: '/',
      method: typeof request?.method === 'function' ? request.method() : 'UNKNOWN',
      resource_type:
        typeof request?.resourceType === 'function' ? request.resourceType() : 'unknown',
      execution_phase: executionPhase,
      classification: classifyBrowserRequest(rawUrl),
    });
  }
  return Object.freeze({
    scheme: url.protocol.slice(0, -1),
    hostname: url.hostname,
    port: url.port || null,
    pathname: sanitizeBrowserPathname(url.pathname),
    method: typeof request?.method === 'function' ? request.method() : 'GET',
    resource_type:
      typeof request?.resourceType === 'function' ? request.resourceType() : 'unknown',
    execution_phase: executionPhase,
    classification: classifyBrowserRequest(rawUrl),
  });
}

export function browserRequestIsAllowed(value) {
  return new Set([
    'expected staging Supabase request',
    'local Vite/HMR request',
    'CAPTCHA/Turnstile request',
    'required static/browser infrastructure request',
  ]).has(classifyBrowserRequest(value));
}

const BROWSER_DIAGNOSTIC_FIELDS = Object.freeze({
  console_error: 'console_error_count',
  page_error: 'page_error_count',
  request_failure: 'request_failure_count',
  server_error_response: 'server_error_response_count',
});

const BROWSER_DIAGNOSTIC_FAILURE_CODES = Object.freeze({
  console_error: 'PATCH83U_BROWSER_CONSOLE_ERROR_OBSERVED',
  page_error: 'PATCH83U_BROWSER_PAGE_ERROR_OBSERVED',
  request_failure: 'PATCH83U_BROWSER_REQUEST_FAILURE_OBSERVED',
  server_error_response: 'PATCH83U_BROWSER_SERVER_ERROR_RESPONSE_OBSERVED',
});

export function createSafeBrowserDiagnosticsState() {
  return {
    console_error_count: 0,
    page_error_count: 0,
    request_failure_count: 0,
    server_error_response_count: 0,
  };
}

export function recordSafeBrowserDiagnostic(state, kind) {
  const field = BROWSER_DIAGNOSTIC_FIELDS[kind];
  if (
    !field
    || !state
    || typeof state !== 'object'
    || !Number.isSafeInteger(state[field])
    || state[field] < 0
  ) {
    throw new Error('PATCH83U_BROWSER_DIAGNOSTICS_STATE_INVALID');
  }
  state[field] += 1;
  return BROWSER_DIAGNOSTIC_FAILURE_CODES[kind];
}

export function safeBrowserDiagnosticsEvidence(targetGuard) {
  const diagnostics = targetGuard?.diagnostics ?? createSafeBrowserDiagnosticsState();
  const values = Object.values(BROWSER_DIAGNOSTIC_FIELDS).map(
    (field) => diagnostics[field],
  );
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error('PATCH83U_BROWSER_DIAGNOSTICS_STATE_INVALID');
  }
  const evidence = {
    safe: values.every((value) => value === 0),
    console_error_count: diagnostics.console_error_count,
    page_error_count: diagnostics.page_error_count,
    request_failure_count: diagnostics.request_failure_count,
    server_error_response_count: diagnostics.server_error_response_count,
  };
  if (targetGuard?.refused_request) {
    evidence.refused_request = targetGuard.refused_request;
  }
  return evidence;
}

export function assertBrowserDiagnosticsSafe(targetGuard) {
  if (safeBrowserDiagnosticsEvidence(targetGuard).safe !== true) {
    throw new Error('PATCH83U_BROWSER_DIAGNOSTICS_NOT_CLEAN');
  }
  return true;
}

export function markIntentionalBrowserRequestAbort(targetGuard, request) {
  if (
    !targetGuard
    || typeof targetGuard !== 'object'
    || !request
    || (typeof request !== 'object' && typeof request !== 'function')
  ) {
    throw new Error('PATCH83U_INTENTIONAL_BROWSER_ABORT_INVALID');
  }
  targetGuard.intentionalRequestAborts ??= new WeakSet();
  targetGuard.intentionalRequestAborts.add(request);
  return true;
}

export function browserRequestAbortWasIntentional(targetGuard, request) {
  return targetGuard?.intentionalRequestAborts instanceof WeakSet
    && targetGuard.intentionalRequestAborts.has(request);
}

async function readRefreshValue(page) {
  const value = await page.evaluate((storageKey) => {
    const serialized = globalThis.localStorage.getItem(storageKey);
    if (!serialized) return null;
    const parsed = JSON.parse(serialized);
    return parsed?.refresh_token ?? parsed?.currentSession?.refresh_token ?? null;
  }, STAGING_AUTH_STORAGE_KEY);
  if (typeof value !== 'string' || !value) {
    throw new Error('PATCH83U_CONTROLLED_REFRESH_VALUE_UNAVAILABLE');
  }
  return new SecretValue(value);
}

async function refreshControlledBrowserSession(page) {
  return page.evaluate(async (targetUserId) => {
    const client = await import('/src/lib/supabase.ts');
    const { data, error } = await client.supabase.auth.refreshSession();
    return error === null
      && data.user?.id === targetUserId
      && data.session?.user?.id === targetUserId;
  }, TARGET_USER_ID);
}

async function replayRefreshValue(supabaseUrl, publicApiKey, refreshValue) {
  let response;
  try {
    response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: publicApiKey.reveal(),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshValue.reveal() }),
      redirect: 'error',
    });
  } catch {
    return safeRefreshReplayResult({
      failed: true,
      httpStatus: null,
      errorCode: 'NETWORK_ERROR',
    });
  }
  if (response.ok) {
    await response.body?.cancel();
    return safeRefreshReplayResult({
      failed: false,
      httpStatus: response.status,
      errorCode: 'UNEXPECTED_REFRESH_ACCEPTED',
    });
  }
  let safeCode = 'AUTH_REFRESH_REJECTED';
  try {
    const body = await response.json();
    if (typeof body?.error_code === 'string') safeCode = body.error_code;
    else if (typeof body?.code === 'string') safeCode = body.code;
  } catch {
    // The response body is neither retained nor emitted.
  }
  return safeRefreshReplayResult({
    failed: true,
    httpStatus: response.status,
    errorCode: safeCode,
  });
}

async function responseBodyWithoutRetention(response) {
  try {
    const body = await response.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

async function readSafeResetEdgeOutcome(response, requestIdHash) {
  const body = await responseBodyWithoutRetention(response);
  return classifyResetEdgeResult({
    ok: response.ok(),
    httpStatus: response.status(),
    body,
    requestIdHash,
  });
}

async function readSafePasswordChangeEdgeOutcome(response, requestIdHash) {
  const body = await responseBodyWithoutRetention(response);
  const result = body?.result;
  let responseRequestIdHash = null;
  if (typeof result?.requestId === 'string') {
    try {
      responseRequestIdHash = hashRequestId(result.requestId);
    } catch {
      responseRequestIdHash = null;
    }
  }
  const exactSuccess =
    response.ok()
    && body?.ok === true
    && body?.action === REQUIRED_PASSWORD_CHANGE_ACTION
    && result?.userId === TARGET_USER_ID
    && responseRequestIdHash === requestIdHash
    && result?.status === 'active'
    && result?.credentialVersion === FINAL_CREDENTIAL_VERSION
    && result?.mustReauthenticate === true
    && result?.reconciliationRequired === false
    && result?.sessionRevocationReviewRequired === false
    && result?.idempotentReplay === false;
  return {
    ok: exactSuccess,
    httpStatus: response.status(),
    safeErrorCode: exactSuccess
      ? null
      : safeEdgeCode(
          body?.code,
          response.ok()
            ? 'PATCH83U_PASSWORD_CHANGE_EDGE_RESULT_INVALID'
            : 'EDGE_RESPONSE_NOT_OK',
        ),
    response,
    requestIdHash,
  };
}

const NONPERSISTENT_BROWSER_CONTEXTS = new WeakSet();

export function assertSafeBrowserContextCaptureOptions(options) {
  if (
    !options
    || typeof options !== 'object'
    || options.recordHar !== undefined
    || options.recordVideo !== undefined
    || options.storageState !== undefined
  ) {
    throw new Error('PATCH83U_BROWSER_CAPTURE_OPTIONS_UNSAFE');
  }
  return true;
}

export function assertNonpersistentBrowserContext(context) {
  if (
    !context
    || (typeof context !== 'object' && typeof context !== 'function')
    || !NONPERSISTENT_BROWSER_CONTEXTS.has(context)
  ) {
    throw new Error('PATCH83U_NONPERSISTENT_BROWSER_CONTEXT_NOT_PROVEN');
  }
  return true;
}

export async function createSafeBrowserContext(browser, options, targetGuard) {
  if (!targetGuard || typeof targetGuard !== 'object') {
    throw new Error('PATCH83U_BROWSER_TARGET_GUARD_REQUIRED');
  }
  assertSafeBrowserContextCaptureOptions(options);
  targetGuard.diagnostics ??= createSafeBrowserDiagnosticsState();
  const recordDiagnostic = (kind) => {
    const failureCode = recordSafeBrowserDiagnostic(targetGuard.diagnostics, kind);
    targetGuard.violation ??= failureCode;
  };
  const context = await browser.newContext(options);
  NONPERSISTENT_BROWSER_CONTEXTS.add(context);
  context.on('page', (page) => {
    page.on('console', (message) => {
      if (message.type() === 'error') recordDiagnostic('console_error');
    });
    page.on('pageerror', () => recordDiagnostic('page_error'));
  });
  context.on('requestfailed', (request) => {
    if (browserRequestAbortWasIntentional(targetGuard, request)) return;
    recordDiagnostic('request_failure');
  });
  context.on('response', (response) => {
    if (response.status() >= 500) recordDiagnostic('server_error_response');
  });
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (!browserRequestIsAllowed(url)) {
      targetGuard.refused_request ??= sanitizeBrowserRequestDescriptor(
        route.request(),
        targetGuard.currentPhase?.() ?? 'unknown',
      );
      targetGuard.violation = url.includes(PRODUCTION_PROJECT_REF)
        ? 'PATCH83U_PRODUCTION_BROWSER_REQUEST_REFUSED'
        : 'PATCH83U_UNAPPROVED_BROWSER_REQUEST_REFUSED';
      markIntentionalBrowserRequestAbort(targetGuard, route.request());
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
  return context;
}

function assertBrowserTargetGuard(targetGuard) {
  if (targetGuard.violation) throw new Error(targetGuard.violation);
  assertBrowserDiagnosticsSafe(targetGuard);
}

function credentialProof(snapshot) {
  return {
    credential_state: snapshot.target.credential_state,
    database_credential_version: snapshot.target.credential_version,
    auth_credential_version: snapshot.target.auth_credential_version,
    requested_lifecycle: snapshot.target.requested_lifecycle,
    session_count: snapshot.target.session_count,
    unrevoked_refresh_token_count: snapshot.target.unrevoked_refresh_token_count,
    role: snapshot.target.role,
    scope: snapshot.target.scope,
    observed_at: snapshot.captured_at,
  };
}

async function verifyStagingApplicationOrigin(appUrl, fetchApplication = fetch) {
  let applicationResponse;
  try {
    applicationResponse = await fetchApplication(appUrl, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error('PATCH83U_STAGING_APPLICATION_ORIGIN_UNREACHABLE');
  }
  if (
    !applicationResponse?.ok
    || new URL(applicationResponse.url).origin !== STAGING_APPLICATION_ORIGIN
  ) {
    await applicationResponse?.body?.cancel?.();
    throw new Error('PATCH83U_STAGING_APPLICATION_ORIGIN_UNREACHABLE');
  }
  await applicationResponse.body?.cancel?.();
  return true;
}

async function runCleanSignedOutBrowserReadiness(appUrl) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  const targetGuard = { violation: null };
  let context;
  try {
    context = await createSafeBrowserContext(
      browser,
      {
        baseURL: appUrl,
        serviceWorkers: 'block',
        recordHar: BROWSER_EVIDENCE_OPTIONS.recordHar,
        recordVideo: BROWSER_EVIDENCE_OPTIONS.recordVideo,
        storageState: BROWSER_EVIDENCE_OPTIONS.storageState,
      },
      targetGuard,
    );
    const page = await context.newPage();
    const verifySignedOutState = async () => {
      await attestLoadedFrontend(page, appUrl, targetGuard);
      const runtimeState = await page.evaluate(async () => {
        const client = await import('/src/lib/supabase.ts');
        const { data, error } = await client.supabase.auth.getSession();
        return {
          projectRef: client.supabaseProjectRef,
          sessionPresent: Boolean(data.session),
          sessionReadError: Boolean(error),
        };
      });
      if (
        runtimeState.projectRef !== STAGING_PROJECT_REF
        || runtimeState.sessionPresent
        || runtimeState.sessionReadError
      ) {
        throw new Error('PATCH83U_CLEAN_BROWSER_SIGNED_OUT_STATE_FAILED');
      }
      await page
        .getByRole('heading', { name: /^(Sign in|تسجيل الدخول)$/ })
        .waitFor({ state: 'visible' });
      const reconciliationVisible = await page
        .getByText(
          'Signed-in user has no profile record. Ask an administrator to reconcile the account.',
          { exact: true },
        )
        .isVisible()
        .catch(() => false);
      const accessDeniedVisible = await page
        .getByText(/Access denied|تعذر الوصول/i)
        .first()
        .isVisible()
        .catch(() => false);
      if (reconciliationVisible || accessDeniedVisible) {
        throw new Error('PATCH83U_CLEAN_BROWSER_SIGNED_OUT_SCREEN_FAILED');
      }
      assertBrowserTargetGuard(targetGuard);
    };
    const response = await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    if (!response?.ok()) {
      throw new Error('PATCH83U_CLEAN_BROWSER_APPLICATION_LOAD_FAILED');
    }
    await verifySignedOutState();
    const reloadResponse = await page.reload({ waitUntil: 'domcontentloaded' });
    if (!reloadResponse?.ok()) {
      throw new Error('PATCH83U_CLEAN_BROWSER_APPLICATION_RELOAD_FAILED');
    }
    await verifySignedOutState();
    return {
      signed_out_before_reload: true,
      signed_out_after_reload: true,
      staging_project_exact: true,
      production_request_absent: true,
    };
  } finally {
    await context?.close();
    await browser.close();
  }
}

export async function runPreCredentialReadiness(args, adapters = {}) {
  const resolveOutputPath =
    adapters.resolveOutputPath ?? resolveRun007OutputPath;
  const resolveCheckpointDirectory =
    adapters.resolveCheckpointDirectory ?? resolveSqlEditorCheckpointDirectory;
  const outputPath = await resolveOutputPath(
    args.out,
    adapters.outputPathAdapters,
  );
  const checkpointDirectory = await resolveCheckpointDirectory(
    args.checkpointDir,
    adapters.checkpointDirectoryAdapters,
  );
  const loadStagingFrontendLaunch = adapters.loadStagingFrontendLaunch
    ?? (async () => {
      const module = await import('./start-patch83u-staging-frontend.mjs');
      return module.prepareStagingFrontendLaunch();
    });
  const launchPlan = await loadStagingFrontendLaunch();
  if (
    launchPlan?.projectRef !== STAGING_PROJECT_REF
    || launchPlan?.origin !== STAGING_APPLICATION_ORIGIN
    || launchPlan?.mode !== 'staging'
  ) {
    throw new Error('PATCH83U_STAGING_FRONTEND_STARTUP_GUARD_FAILED');
  }
  let credentialBundle;
  let browserConfiguration;
  try {
    await verifyStagingApplicationOrigin(
      args.appUrl,
      adapters.fetchApplication ?? fetch,
    );
    const prepareDeploymentGate = adapters.prepareEdgeDeploymentGate
      ?? prepareEdgeDeploymentGate;
    const initialEdgeDeploymentGate = await prepareDeploymentGate(args, adapters);
    const { projectConfirmation } = initialEdgeDeploymentGate;
    const runCleanBrowserReadiness =
      adapters.runCleanBrowserReadiness ?? runCleanSignedOutBrowserReadiness;
    const cleanBrowser = await runCleanBrowserReadiness(args.appUrl);
    if (
      cleanBrowser?.signed_out_before_reload !== true
      || cleanBrowser?.signed_out_after_reload !== true
      || cleanBrowser?.staging_project_exact !== true
      || cleanBrowser?.production_request_absent !== true
    ) {
      throw new Error('PATCH83U_CLEAN_BROWSER_READINESS_FAILED');
    }
    assertFrontendOriginExactAggregate({
      appUrl: args.appUrl,
      launchPlan,
      loadedAttestation: {
        applicationOriginMatches: launchPlan.origin === args.appUrl,
        stagingProjectPresent: cleanBrowser.staging_project_exact,
        productionProjectPresent: cleanBrowser.production_request_absent !== true,
      },
    });
    const loadBrowserConfiguration = adapters.loadRun008BrowserConfiguration
      ?? loadRun008BrowserConfiguration;
    browserConfiguration = await loadBrowserConfiguration({
      secretFactory: (bytes) => new SecretValue(bytes),
    });
    if (
      browserConfiguration.projectRef !== STAGING_PROJECT_REF
      || browserConfiguration.supabaseUrl !== args.supabaseUrl
    ) {
      throw new Error('PATCH83U_RUN008_BROWSER_CONFIGURATION_REFUSED');
    }
    if (args.precredentialNoSecretFixture === true) {
      return Object.freeze({
        outputPath,
        checkpointDirectory,
        initialEdgeDeploymentGate,
        cleanBrowser,
        credentialBundle: null,
        browserConfiguration,
        projectConfirmation,
        noSecretFixture: true,
      });
    }
    const loadCredentialBundle = adapters.loadRun008CredentialBundle
      ?? loadRun008CredentialBundle;
    credentialBundle = await loadCredentialBundle({
      secretFactory: (bytes) => new SecretValue(bytes),
    });
    if (credentialBundle?.validated !== true) {
      throw new Error('PATCH83U_RUN008_CREDENTIAL_BUNDLE_NOT_VALIDATED');
    }
    return Object.freeze({
      outputPath,
      checkpointDirectory,
      initialEdgeDeploymentGate,
      cleanBrowser,
      credentialBundle,
      browserConfiguration,
      projectConfirmation,
    });
  } catch (error) {
    clearRun008CredentialBundle(credentialBundle);
    browserConfiguration?.publicApiKey?.clear?.();
    throw error;
  }
}

async function runHostedProof(args, adapters = {}, preCredentialReadiness = null) {
  const preCredential = preCredentialReadiness
    ?? await runPreCredentialReadiness(args, adapters);
  const {
    outputPath,
    checkpointDirectory,
    initialEdgeDeploymentGate,
    credentialBundle,
    browserConfiguration,
    projectConfirmation,
  } = preCredential;
  const checkpointState = createCheckpointFileState();
  const schemaPath = fileURLToPath(
    new URL(
      '../release/patch83u/patch83u-staging-reset-harness-schema-v2.json',
      import.meta.url,
    ),
  );
  const evidenceSchemaPath = resolve(process.cwd(), RUN007_EVIDENCE_SCHEMA_PATH);
  const checkpointSchemaPath = resolve(process.cwd(), RUN007_CHECKPOINT_SCHEMA_PATH);
  const sqlEditorPath = fileURLToPath(new URL('./patch83u-staging-sql-editor-evidence.sql', import.meta.url));
  const historicalEvidenceSchema = JSON.parse(await readFile(schemaPath, 'utf8'));
  if (
    historicalEvidenceSchema?.properties?.schema_version?.const
      !== 'patch83u-staging-reset-proof-v2'
  ) {
    throw new Error('PATCH83U_HISTORICAL_RESET_EVIDENCE_SCHEMA_DRIFT');
  }
  const evidenceSchema = JSON.parse(await readFile(evidenceSchemaPath, 'utf8'));
  const checkpointSchema = JSON.parse(await readFile(checkpointSchemaPath, 'utf8'));
  if (
    evidenceSchema?.properties?.schema_version?.const !== RESET_PROOF_SCHEMA_VERSION
  ) {
    throw new Error('PATCH83U_RESET_EVIDENCE_SCHEMA_VERSION_MISMATCH');
  }
  const sqlEditorSource = await readFile(sqlEditorPath, 'utf8');
  for (const checkpoint of SQL_EDITOR_CHECKPOINTS) {
    if (!sqlEditorSource.includes(`'${checkpoint}'`)) {
      throw new Error('PATCH83U_SQL_EDITOR_QUERY_PACK_INCOMPLETE');
    }
  }

  const evidence = {
    schema_version: RESET_PROOF_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    execution_status: 'readiness_failed',
    project_ref: STAGING_PROJECT_REF,
    subject_user_id: TARGET_USER_ID,
    request_id_hash: null,
    checkpoint_inputs: [],
    events: [],
    operator_guidance: [],
  };
  evidence.events.push({
    event: 'edge_deployment_gate_initial',
    result: true,
    observed_at: initialEdgeDeploymentGate.observed_at,
  });
  const knownSecrets = [];
  let browser;
  let targetGuard = null;
  let phase = 'readiness';
  const controlledRefreshValues = [];
  const readCheckpoint = async (checkpoint) => {
    const { snapshot, evidence: checkpointEvidence } = await runSqlEditorEvidence(
      checkpoint,
      {
        checkpointDirectory,
        checkpointState,
        checkpointSchema,
        projectConfirmation,
      },
    );
    evidence.checkpoint_inputs.push(checkpointEvidence);
    evidence.events.push({
      event: `sql_editor_${checkpoint}`,
      result: true,
      observed_at: snapshot.captured_at,
    });
    return snapshot;
  };
  const writeEvidence = async () => {
    if (targetGuard) {
      evidence.browser_diagnostics = safeBrowserDiagnosticsEvidence(targetGuard);
    }
    assertCheckpointInputEvidenceSequence(
      evidence.checkpoint_inputs,
      { executionStatus: evidence.execution_status },
    );
    assertEvidenceMatchesSchemaContract(evidence, evidenceSchema, { knownSecrets });
    await writeFile(
      outputPath,
      serializeRedactedEvidence(evidence, { knownSecrets }),
      { flag: 'wx' },
    );
  };
  try {
    const initialSnapshot = await readCheckpoint('before_employee_sessions');
    assertCheckpoint1ReadOnlyAggregate({
      snapshot: initialSnapshot,
      sqlSource: sqlEditorSource,
    });
    assertInitialEmployeeStateAggregate(initialSnapshot);
    assertFinalizerAndRecoveryReadyAggregate(initialSnapshot);
    const initialReadiness = assertRuntimeAndContractsExactAggregate({
      snapshot: initialSnapshot,
      edgeDeploymentChecks: initialEdgeDeploymentGate.checks,
    });
    if (!initialReadiness.passed) {
      evidence.preflight = {
        passed: false,
        checks: initialReadiness.checks,
        failed: initialReadiness.failed,
      };
      await writeEvidence();
      return;
    }
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: false });
    const contextOptions = {
      baseURL: args.appUrl,
      recordHar: BROWSER_EVIDENCE_OPTIONS.recordHar,
      recordVideo: BROWSER_EVIDENCE_OPTIONS.recordVideo,
      storageState: BROWSER_EVIDENCE_OPTIONS.storageState,
    };
    targetGuard = {
      violation: null,
      diagnostics: createSafeBrowserDiagnosticsState(),
      currentPhase: () => phase,
    };
    const stagingRuntimeConfiguration = {
      project_ref: STAGING_PROJECT_REF,
      supabase_url: args.supabaseUrl,
      app_url: args.appUrl,
    };
    assertStagingAndProductionBoundaryAggregate({
      configuration: stagingRuntimeConfiguration,
      targetGuard,
    });

    const collectSecret = async (label) => {
      const value = await promptHidden(label);
      knownSecrets.push(value);
      return value;
    };
    const adminIdentifier = await collectSecret('Staging Super Admin login (hidden): ');
    const adminPassword = credentialBundle.superAdminPassword;
    const oldPermanentPassword = credentialBundle.employeeCurrentPassword;
    const temporaryPassword = credentialBundle.employeeTemporaryPassword;
    const newPermanentPassword = credentialBundle.employeeNewPassword;
    const publicApiKey = browserConfiguration.publicApiKey;
    knownSecrets.push(
      adminPassword,
      oldPermanentPassword,
      temporaryPassword,
      newPermanentPassword,
      publicApiKey,
    );
    assertSecretAndPolicyControlsAggregate({
      credentialValues: [
        adminIdentifier,
        adminPassword,
        oldPermanentPassword,
        temporaryPassword,
        newPermanentPassword,
        publicApiKey,
      ],
      knownSecrets,
      temporaryPassword,
      newPermanentPassword,
      hiddenPrompt: promptHidden,
      credentialsPersisted: false,
      maxAttempts: PASSWORD_CHANGE_MAX_ATTEMPTS,
    });
    const resetReason = 'Patch 83U controlled staging multi-session revocation proof';
    assertResetReasonSafe(resetReason, [
      adminPassword,
      oldPermanentPassword,
      temporaryPassword,
      newPermanentPassword,
    ]);

    const originalAdminContext = await createSafeBrowserContext(browser, contextOptions, targetGuard);
    const secondaryAdminContext = await createSafeBrowserContext(browser, contextOptions, targetGuard);
    const employeeContextA = await createSafeBrowserContext(browser, contextOptions, targetGuard);
    const employeeContextB = await createSafeBrowserContext(browser, contextOptions, targetGuard);
    const originalAdminPage = await originalAdminContext.newPage();
    const adminPage = await secondaryAdminContext.newPage();
    const employeePageA = await employeeContextA.newPage();
    const employeePageB = await employeeContextB.newPage();

    await login(originalAdminPage, args.appUrl, adminIdentifier, adminPassword, targetGuard);
    await login(adminPage, args.appUrl, adminIdentifier, adminPassword, targetGuard);
    assertBrowserTargetGuard(targetGuard);
    await originalAdminPage.goto(`${args.appUrl}?page=admin`);
    await originalAdminPage.getByText(/User Management|إدارة المستخدمين/i).first().waitFor();
    await adminPage.goto(`${args.appUrl}?page=admin`);
    await adminPage.getByText(/User Management|إدارة المستخدمين/i).first().waitFor();
    const originalAdminUserId = await authenticatedUserId(originalAdminPage);
    const secondaryAdminUserId = await authenticatedUserId(adminPage);

    const employeeIdentifier = new SecretValue(TARGET_EMPLOYEE_ID);
    try {
      await login(employeePageA, args.appUrl, employeeIdentifier, oldPermanentPassword, targetGuard);
      await login(employeePageB, args.appUrl, employeeIdentifier, oldPermanentPassword, targetGuard);
      assertBrowserTargetGuard(targetGuard);
    } finally {
      employeeIdentifier.clear();
    }
    const employeeUserIds = [
      await authenticatedUserId(employeePageA),
      await authenticatedUserId(employeePageB),
    ];
    assertDesignatedBrowserIdentities({
      originalAdminUserId,
      secondaryAdminUserId,
      employeeUserIds,
    });
    const refreshPreflightSucceededByContext = [
      await refreshControlledBrowserSession(employeePageA),
      await refreshControlledBrowserSession(employeePageB),
    ];
    const controlledRefreshValueA = await readRefreshValue(employeePageA);
    const controlledRefreshValueB = await readRefreshValue(employeePageB);
    controlledRefreshValues.push(controlledRefreshValueA, controlledRefreshValueB);
    // The refresh values stay in process memory, and registering the same
    // SecretValue objects makes every evidence write reject accidental leakage.
    knownSecrets.push(controlledRefreshValueA, controlledRefreshValueB);
    const employeeContextProofs = [
      await proveControlledEmployeeContextAuthorization({
        context: employeeContextA,
        page: employeePageA,
        label: CONTROLLED_EMPLOYEE_CONTEXT_LABELS[0],
        appUrl: args.appUrl,
        targetGuard,
        refreshSucceeded: refreshPreflightSucceededByContext[0],
      }),
      await proveControlledEmployeeContextAuthorization({
        context: employeeContextB,
        page: employeePageB,
        label: CONTROLLED_EMPLOYEE_CONTEXT_LABELS[1],
        appUrl: args.appUrl,
        targetGuard,
        refreshSucceeded: refreshPreflightSucceededByContext[1],
      }),
    ];
    evidence.employee_contexts_before_reset = employeeContextProofs;
    assertBothControlledRefreshesAggregate({
      employeeUserIds,
      refreshSucceededByContext: refreshPreflightSucceededByContext,
      employeeContextProofs,
    });
    const employeeContextEvaluation =
      evaluateControlledEmployeeContextProofs(employeeContextProofs);
    if (!employeeContextEvaluation.passed) {
      evidence.preflight = {
        passed: false,
        checks: employeeContextEvaluation.checks,
        failed: employeeContextEvaluation.failed,
      };
      await writeEvidence();
      return;
    }
    assertControlledEmployeeSessionSetupProof({
      employeeContextProofs,
      controlledRefreshValues,
      knownSecrets,
    });
    const originalAdminContextAvailable =
      await authenticatedUserId(originalAdminPage) === DESIGNATED_SUPER_ADMIN_ID
      && originalAdminPage.url().includes('page=admin');
    const secondaryAdminReauthenticated =
      await authenticatedUserId(adminPage) === DESIGNATED_SUPER_ADMIN_ID
      && adminPage.url().includes('page=admin');
    assertAdminContextReadinessProof({
      originalContext: originalAdminContext,
      secondaryContext: secondaryAdminContext,
      originalAdminUserId,
      secondaryAdminUserId,
      originalContextAvailable: originalAdminContextAvailable,
      secondaryReauthenticated: secondaryAdminReauthenticated,
    });

    const preResetSnapshot = await readCheckpoint('immediately_before_reset');
    assertCheckpointFilesReadyForReset(checkpointState);
    assertPreResetCheckpointAggregate({
      referenceSnapshot: initialSnapshot,
      snapshot: preResetSnapshot,
    });
    assertBrowserTargetGuard(targetGuard);
    const preResetEdgeDeploymentGate = await prepareEdgeDeploymentGate(args, adapters);
    if (
      preResetEdgeDeploymentGate.operatorConfirmationContract.contract_id
        !== initialEdgeDeploymentGate.operatorConfirmationContract.contract_id
      || preResetEdgeDeploymentGate.operatorConfirmationContract.exact_phrase
        !== initialEdgeDeploymentGate.operatorConfirmationContract.exact_phrase
    ) {
      throw new Error('PATCH83U_RUN007_OPERATOR_CONFIRMATION_CONTRACT_TRANSITION');
    }
    evidence.events.push({
      event: 'edge_deployment_gate_before_reset',
      result: true,
      observed_at: preResetEdgeDeploymentGate.observed_at,
    });
    const readiness = evaluateReadinessGates(preResetSnapshot, {
      productionProjectAbsent: targetGuard.violation === null,
      edgeDeploymentChecks: preResetEdgeDeploymentGate.checks,
      originalAdminContextAvailable,
      secondaryAdminReauthenticated,
      controlledEmployeeSessionCount: controlledRefreshValues.length,
      controlledEmployeeRefreshValuesInMemory: true,
      employeeContextProofs,
    });
    if (!readiness.passed) {
      evidence.preflight = { passed: false, checks: readiness.checks, failed: readiness.failed };
      await writeEvidence();
      return;
    }
    evidence.preflight = buildPassedPreflightEvidence(readiness);

    const controller = new ResetSubmissionController();
    let resetRequestCount = 0;
    let userManagementActionPrepared = false;
    let observedResetUiConfirmation = null;
    let observedResetEmployeeIdConfirmation = null;
    const resetRequestGuard = async (route) => {
      const request = route.request();
      try {
        const body = request.postDataJSON();
        if (body?.action !== ADMIN_RESET_ACTION) {
          await route.fallback();
          return;
        }
        resetRequestCount += 1;
        if (resetRequestCount !== 1) {
          controller.markAmbiguous();
          markIntentionalBrowserRequestAbort(targetGuard, request);
          await route.abort('blockedbyclient');
          return;
        }
        const requestId = assertOneShotResetAggregate({
          controller,
          submissionCount: resetRequestCount,
          requestEnvelope: body,
          userManagementActionPrepared,
        });
        assertExactResetConfirmationsProof({
          employeeIdConfirmation: observedResetEmployeeIdConfirmation,
          uiConfirmation: observedResetUiConfirmation,
          backendConfirmation: body.payload.confirmation,
          operatorConfirmation: evidence.operator_confirmation,
          operatorConfirmationContract:
            preResetEdgeDeploymentGate.operatorConfirmationContract,
        });
        evidence.request_id_hash = controller.observeRequestId(requestId);
        assertStableResetRequestCorrelationAggregate({
          controller,
          envelopeRequestId: requestId,
          evidenceRequestIdHash: evidence.request_id_hash,
          submissionCount: resetRequestCount,
        });
        await route.fallback();
      } catch {
        controller.markAmbiguous();
        markIntentionalBrowserRequestAbort(targetGuard, request);
        await route.abort('blockedbyclient');
      }
    };
    await adminPage.route('**/functions/v1/privileged-action', resetRequestGuard);
    let resetRouteInstalled = true;
    await adminPage.goto(`${args.appUrl}?page=admin`, { waitUntil: 'networkidle' });
    await attestLoadedFrontend(adminPage, args.appUrl, targetGuard);
    assertBrowserTargetGuard(targetGuard);
    await controller.prepareResetForm(
      readiness,
      targetGuard.violation === null,
      async () => {
        const targetRow =
          adminPage.getByRole('row').filter({ hasText: TARGET_EMPLOYEE_ID }).first();
        await targetRow.getByRole('button', { name: /More actions/i }).click();
        await adminPage
          .getByRole('button', { name: 'Reset temporary password', exact: true })
          .click();
        await adminPage
          .getByLabel('Temporary password', { exact: true })
          .fill(temporaryPassword.reveal());
        await adminPage
          .getByLabel('Confirm temporary password', { exact: true })
          .fill(temporaryPassword.reveal());
        const resetUiConfirmation =
          adminPage.getByLabel('Reset password action confirmation');
        const resetEmployeeIdConfirmation =
          adminPage.getByLabel('Reset Employee ID confirmation');
        await resetUiConfirmation.fill(RESET_CONFIRMATION_TEXT);
        await resetEmployeeIdConfirmation.fill(TARGET_EMPLOYEE_ID);
        observedResetUiConfirmation = await resetUiConfirmation.inputValue();
        observedResetEmployeeIdConfirmation =
          await resetEmployeeIdConfirmation.inputValue();
        await adminPage.getByLabel('Reset reason').fill(resetReason);
        userManagementActionPrepared = true;
      },
    );
    const exactConfirmation = await promptHidden(
      `Type ${preResetEdgeDeploymentGate.operatorConfirmationContract.exact_phrase} to cross the one-shot reset boundary (hidden): `,
    );
    try {
      evidence.operator_confirmation = controller.authorizeOperatorConfirmation(
        exactConfirmation.reveal(),
        preResetEdgeDeploymentGate.operatorConfirmationContract,
      );
    } finally {
      exactConfirmation.clear();
    }

    phase = 'reset';
    let resetResolution;
    let resetRouteCleanupSucceeded = true;
    try {
      resetResolution = await executeOneShotResetAndCollectCheckpoint({
        controller,
        readiness,
        submitter: async () => {
          const responsePromise = adminPage.waitForResponse((candidate) => {
            if (candidate.url() !== `${STAGING_SUPABASE_ORIGIN}/functions/v1/privileged-action`) {
              return false;
            }
            try {
              return candidate.request().postDataJSON()?.action === ADMIN_RESET_ACTION;
            } catch {
              return false;
            }
          }, { timeout: 45_000 });
          await adminPage
            .getByRole('button', {
              name: 'Reset password and revoke sessions',
              exact: true,
            })
            .click();
          return responsePromise;
        },
        inspectEdgeResponse: (response) =>
          readSafeResetEdgeOutcome(response, controller.requestIdHash),
        afterSubmissionAttempt: async () => {
          const temporaryField =
            adminPage.getByLabel('Temporary password', { exact: true });
          const confirmationField =
            adminPage.getByLabel('Confirm temporary password', { exact: true });
          if (await temporaryField.isVisible().catch(() => false)) {
            await temporaryField.fill('');
          }
          if (await confirmationField.isVisible().catch(() => false)) {
            await confirmationField.fill('');
          }
        },
        readCheckpoint3: () => readCheckpoint('immediately_after_reset'),
        classifyCheckpoint3: (snapshot) => classifyPostResetCheckpoint(snapshot, {
          referenceSnapshot: preResetSnapshot,
          requestIdHash: controller.requestIdHash,
        }),
      });
    } finally {
      if (resetRouteInstalled) {
        try {
          await adminPage.unroute(
            '**/functions/v1/privileged-action',
            resetRequestGuard,
          );
        } catch {
          resetRouteCleanupSucceeded = false;
          controller.markAmbiguous();
        }
        resetRouteInstalled = false;
      }
    }
    const {
      edgeOutcome: resetEdgeOutcome,
      checkpointOutcome: resetCheckpointOutcome,
      progression: resetProgression,
      checkpoint: afterReset,
      postSubmissionCleanupSucceeded,
      automaticRecoveryActions,
    } = resetResolution;
    const resetCleanupSucceeded =
      postSubmissionCleanupSucceeded && resetRouteCleanupSucceeded;
    if (!resetCleanupSucceeded) resetProgression.allowed = false;
    assertCheckpoint3AlwaysAggregate({
      snapshot: afterReset,
      sqlSource: sqlEditorSource,
      resetSubmissionStarted: controller.submissionStarted,
      edgeOutcome: resetEdgeOutcome,
      checkpointOutcome: resetCheckpointOutcome,
    });
    assertProtectedStateFailClosedAggregate({
      edgeOutcome: resetEdgeOutcome,
      checkpointOutcome: resetCheckpointOutcome,
      progression: resetProgression,
      automaticRecoveryActions,
      postSubmissionCleanupSucceeded: resetCleanupSucceeded,
    });
    evidence.reset = {
      submitted: resetRequestCount === 1,
      submission_count: resetRequestCount === 1 ? 1 : 0,
      http_status: resetEdgeOutcome.http_status,
      safe_error_code: resetEdgeOutcome.safe_error_code,
      edge_success_confirmed: resetProgression.edge_success_confirmed,
      checkpoint_classification: resetCheckpointOutcome.classification,
      checkpoint_success_confirmed: resetProgression.checkpoint_success_confirmed,
      protected_transition_completed:
        resetCheckpointOutcome.protected_transition_completed,
      request_correlation_proven:
        resetEdgeOutcome.request_correlation_proven
        && resetCheckpointOutcome.request_correlation_proven,
      post_submission_cleanup_succeeded: resetCleanupSucceeded,
      progression_allowed: resetProgression.allowed,
      terminal_proof: resetCheckpointOutcome.terminal_proof,
    };
    evidence.audit = { after_reset: afterReset.audit };
    if (!resetProgression.allowed || resetRequestCount !== 1) {
      throw new Error(
        `PATCH83U_RESET_OUTCOME_NOT_UNEQUIVOCAL:${resetCheckpointOutcome.classification}`,
      );
    }
    assertPostResetSuccessAggregate({
      referenceSnapshot: preResetSnapshot,
      snapshot: afterReset,
      requestIdHash: controller.requestIdHash,
    });

    phase = 'revocation';
    const verificationContext = await createSafeBrowserContext(browser, contextOptions, targetGuard);
    const verificationPage = await verificationContext.newPage();
    const verificationIdentifier = new SecretValue(TARGET_EMPLOYEE_ID);
    let oldPasswordResult;
    try {
      oldPasswordResult = await loginRejected(
        verificationPage,
        args.appUrl,
        verificationIdentifier,
        oldPermanentPassword,
        targetGuard,
      );
    } finally {
      verificationIdentifier.clear();
    }
    const refreshReplayResults = [
      {
        label: CONTROLLED_EMPLOYEE_CONTEXT_LABELS[0],
        ...await replayRefreshValue(args.supabaseUrl, publicApiKey, controlledRefreshValues[0]),
      },
      {
        label: CONTROLLED_EMPLOYEE_CONTEXT_LABELS[1],
        ...await replayRefreshValue(args.supabaseUrl, publicApiKey, controlledRefreshValues[1]),
      },
    ];
    assertRejectedRefreshReplays(refreshReplayResults);
    const staleContextProofs = [
      await proveStaleEmployeeContextDenied({
        page: employeePageA,
        label: CONTROLLED_EMPLOYEE_CONTEXT_LABELS[0],
        appUrl: args.appUrl,
        targetGuard,
      }),
      await proveStaleEmployeeContextDenied({
        page: employeePageB,
        label: CONTROLLED_EMPLOYEE_CONTEXT_LABELS[1],
        appUrl: args.appUrl,
        targetGuard,
      }),
    ];
    const staleContextEvaluation =
      evaluateStaleEmployeeContextProofs(staleContextProofs);
    const staleContext1Denied =
      staleContextEvaluation.checks.employee_context_1_protected_route_access_denied
      === true;
    const staleContext2Denied =
      staleContextEvaluation.checks.employee_context_2_protected_route_access_denied
      === true;
    assertBothStaleContextsDeniedAggregate({
      staleContextProofs,
      staleContext1Denied,
      staleContext2Denied,
    });
    if (
      oldPasswordResult.failed !== true
      || !Number.isInteger(oldPasswordResult.http_status)
      || oldPasswordResult.http_status < 400
      || oldPasswordResult.http_status >= 500
      || !staleContextEvaluation.passed
    ) {
      throw new Error('PATCH83U_STALE_ACCESS_REVOCATION_PROOF_FAILED');
    }
    evidence.revocation = {
      old_permanent_login_failed: oldPasswordResult.failed,
      old_permanent_login_http_status: oldPasswordResult.http_status,
      old_permanent_login_safe_error_code: oldPasswordResult.safe_error_code,
      refresh_replay_results: refreshReplayResults,
      stale_context_1_denied: staleContext1Denied,
      stale_context_2_denied: staleContext2Denied,
      stale_contexts: staleContextProofs,
      database_session_count: afterReset.target.session_count,
      unrevoked_refresh_token_count: afterReset.target.unrevoked_refresh_token_count,
      observed_at: afterReset.captured_at,
    };

    phase = 'forced_password_change';
    const openForcedPasswordChangeContext = async () => {
      const context = await createSafeBrowserContext(browser, contextOptions, targetGuard);
      const page = await context.newPage();
      const identifier = new SecretValue(TARGET_EMPLOYEE_ID);
      try {
        await login(page, args.appUrl, identifier, temporaryPassword, targetGuard);
      } finally {
        identifier.clear();
      }
      const surfaces = [await inspectForcedPasswordChangeSurface(page)];
      for (const routeValue of FORCED_PASSWORD_CHANGE_PROTECTED_ROUTES) {
        await page.goto(
          `${args.appUrl}?page=${encodeURIComponent(routeValue)}`,
          { waitUntil: 'networkidle' },
        );
        surfaces.push(await inspectForcedPasswordChangeSurface(page));
      }
      const surfaceProof = evaluateForcedPasswordChangeSurfaceProof({
        ...surfaces[0],
        forced_change_visible_after_protected_navigation:
          surfaces.slice(1).every((surface) => surface.forced_change_visible),
        application_shell_absent:
          surfaces.every((surface) => surface.application_shell_absent),
        sidebar_absent:
          surfaces.every((surface) => surface.sidebar_absent),
        employee_content_absent:
          surfaces.every((surface) => surface.employee_content_absent),
        admin_content_absent:
          surfaces.every((surface) => surface.admin_content_absent),
        provisioning_controls_absent:
          surfaces.every((surface) => surface.provisioning_controls_absent),
      });
      const forcedAuthenticatedUserId = await authenticatedUserId(page);
      assertTemporaryPasswordRestrictedLoginProof({
        context,
        authenticatedUserId: forcedAuthenticatedUserId,
        surfaceProof,
      });
      assertBrowserTargetGuard(targetGuard);
      if (!surfaceProof.passed) {
        await context.close();
        throw new Error('PATCH83U_FORCED_CHANGE_ONLY_GATE_FAILED');
      }
      await page.goto(args.appUrl, { waitUntil: 'networkidle' });
      return {
        context,
        page,
        forcedChangeVisible: surfaceProof.checks.forced_change_visible
          && surfaceProof.checks.forced_change_visible_after_protected_navigation,
        normalAccessDenied: surfaceProof.passed,
        nonpersistentContext:
          assertNonpersistentBrowserContext(context),
        authenticatedUserId: forcedAuthenticatedUserId,
        surfaceChecks: surfaceProof.checks,
      };
    };
    let forcedSession = await openForcedPasswordChangeContext();
    evidence.forced_password_change_gate = {
      temporary_login_succeeded: true,
      forced_change_only: forcedSession.forcedChangeVisible,
      normal_application_access_denied: forcedSession.normalAccessDenied,
      nonpersistent_context: forcedSession.nonpersistentContext,
      authenticated_user_id: forcedSession.authenticatedUserId,
      ...forcedSession.surfaceChecks,
      observed_at: new Date().toISOString(),
    };

    const beforeChange = await readCheckpoint('before_required_password_change');
    assertBeforeRequiredPasswordChangeAggregate({
      referenceSnapshot: preResetSnapshot,
      snapshot: beforeChange,
    });

    phase = 'password_change';
    let changeSubmissionCount = 0;
    let lastPasswordChangeResult = null;
    const observedPolicyErrorCodes = [];
    let passwordChangeRun;
    try {
      passwordChangeRun = await runBoundedPasswordPolicyAttempts({
        initialCandidate: newPermanentPassword,
        temporaryPassword,
        submitAttempt: async ({ candidate, attempt }) => {
          if (attempt > 1) {
            await forcedSession.context.close();
            forcedSession = await openForcedPasswordChangeContext();
          }
          const forcedPage = forcedSession.page;
          const currentPasswordField =
            forcedPage.getByLabel(/Current password|كلمة المرور الحالية/i);
          const newPasswordField =
            forcedPage.getByLabel(/New password|كلمة المرور الجديدة/i);
          const confirmPasswordField =
            forcedPage.getByLabel(/Confirm new password|تأكيد كلمة المرور الجديدة/i);
          let attemptSubmissionCount = 0;
          let attemptRequestIdHash = null;
          let passwordChangeSubmissionAuthorized = false;
          let unauthorizedPasswordChangeBlocked = false;
          const changeRequestGuard = async (route) => {
            const request = route.request();
            try {
              const body = request.postDataJSON();
              if (body?.action !== REQUIRED_PASSWORD_CHANGE_ACTION) {
                await route.fallback();
                return;
              }
              if (!passwordChangeSubmissionAuthorized) {
                unauthorizedPasswordChangeBlocked = true;
                markIntentionalBrowserRequestAbort(targetGuard, request);
                await route.abort('blockedbyclient');
                return;
              }
              attemptSubmissionCount += 1;
              changeSubmissionCount += 1;
              if (
                attemptSubmissionCount !== 1
                || changeSubmissionCount > PASSWORD_CHANGE_MAX_ATTEMPTS
              ) {
                markIntentionalBrowserRequestAbort(targetGuard, request);
                await route.abort('blockedbyclient');
                return;
              }
              const requestId = inspectRequiredPasswordChangeEnvelope(body, {
                currentPassword: temporaryPassword.reveal(),
                newPassword: candidate.reveal(),
              });
              attemptRequestIdHash = hashRequestId(requestId);
              await route.fallback();
            } catch {
              markIntentionalBrowserRequestAbort(targetGuard, request);
              await route.abort('blockedbyclient');
            }
          };
          await forcedPage.route(
            '**/functions/v1/privileged-action',
            changeRequestGuard,
          );
          let changeResponse;
          let changeRouteCleanupSucceeded = true;
          try {
            await currentPasswordField.fill(temporaryPassword.reveal());
            await newPasswordField.fill(candidate.reveal());
            await confirmPasswordField.fill(candidate.reveal());
            if (unauthorizedPasswordChangeBlocked) {
              throw new Error('PATCH83U_PASSWORD_CHANGE_PREAUTH_REQUEST_REFUSED');
            }
            const changeResponsePromise = forcedPage.waitForResponse((response) => {
              if (response.url() !== `${STAGING_SUPABASE_ORIGIN}/functions/v1/privileged-action`) {
                return false;
              }
              try {
                return response.request().postDataJSON()?.action
                  === REQUIRED_PASSWORD_CHANGE_ACTION;
              } catch {
                return false;
              }
            }, { timeout: 45_000 });
            passwordChangeSubmissionAuthorized = true;
            await forcedPage
              .getByRole('button', { name: /Change password|تغيير كلمة المرور/i })
              .click();
            changeResponse = await changeResponsePromise;
          } finally {
            passwordChangeSubmissionAuthorized = false;
            try {
              await forcedPage.unroute(
                '**/functions/v1/privileged-action',
                changeRequestGuard,
              );
            } catch {
              changeRouteCleanupSucceeded = false;
            }
            try {
              if (await currentPasswordField.isVisible().catch(() => false)) {
                await currentPasswordField.fill('');
              }
              if (await newPasswordField.isVisible().catch(() => false)) {
                await newPasswordField.fill('');
              }
              if (await confirmPasswordField.isVisible().catch(() => false)) {
                await confirmPasswordField.fill('');
              }
            } catch {
              changeRouteCleanupSucceeded = false;
            }
          }
          if (!changeRouteCleanupSucceeded) {
            throw new Error('PATCH83U_PASSWORD_CHANGE_ROUTE_CLEANUP_FAILED');
          }
          if (attemptSubmissionCount !== 1 || !attemptRequestIdHash) {
            throw new Error('PATCH83U_PASSWORD_CHANGE_SUBMISSION_CONTRACT_INVALID');
          }
          const result = await readSafePasswordChangeEdgeOutcome(
            changeResponse,
            attemptRequestIdHash,
          );
          lastPasswordChangeResult = result;
          const classified = classifyPasswordChangeEdgeResult(result);
          if (classified.outcome === 'policy_rejected') {
            observedPolicyErrorCodes.push(classified.safe_error_code);
            await forcedPage
              .getByRole('button', { name: /Sign in|تسجيل الدخول/i })
              .waitFor({ timeout: 45_000 });
          }
          return result;
        },
        promptReplacement: async ({ nextAttempt }) => {
          const candidate = await collectSecret(
            `Replacement permanent password for attempt ${nextAttempt} (hidden): `,
          );
          const confirmation = await collectSecret(
            `Confirm replacement permanent password for attempt ${nextAttempt} (hidden): `,
          );
          assertResetReasonSafe(resetReason, [candidate, confirmation]);
          return { candidate, confirmation };
        },
      });
    } catch (error) {
      const browserSignedOut = await forcedSession.page
        .getByRole('button', { name: /Sign in|تسجيل الدخول/i })
        .isVisible()
        .catch(() => false);
      evidence.password_change = {
        submitted: changeSubmissionCount > 0,
        submission_count: changeSubmissionCount,
        attempt_count: changeSubmissionCount,
        policy_rejection_count: observedPolicyErrorCodes.length,
        policy_error_codes: observedPolicyErrorCodes,
        http_status: lastPasswordChangeResult?.httpStatus ?? null,
        safe_error_code: safeEdgeCode(
          error instanceof Error ? error.message.split(':')[0] : null,
          'PATCH83U_PASSWORD_CHANGE_BLOCKED',
        ),
        browser_signed_out: browserSignedOut,
      };
      throw error;
    }
    assertSecretAndPolicyControlsAggregate({
      credentialValues: [
        adminIdentifier,
        adminPassword,
        oldPermanentPassword,
        temporaryPassword,
        newPermanentPassword,
        publicApiKey,
      ],
      knownSecrets,
      temporaryPassword,
      newPermanentPassword,
      hiddenPrompt: promptHidden,
      credentialsPersisted: false,
      maxAttempts: PASSWORD_CHANGE_MAX_ATTEMPTS,
      passwordChangeRun,
    });
    const finalPermanentPassword = passwordChangeRun.candidate;
    const finalPasswordChangeResult = passwordChangeRun.final_result;
    const changeRequestIdHash = finalPasswordChangeResult.requestIdHash;
    if (
      !SHA256_PATTERN.test(String(changeRequestIdHash ?? ''))
      || evidence.request_id_hash !== controller.requestIdHash
    ) {
      throw new Error('PATCH83U_PASSWORD_CHANGE_SUBMISSION_CONTRACT_INVALID');
    }
    const afterChange = await readCheckpoint('immediately_after_password_change_finalization');
    const browserSignedOut =
      await forcedSession.page
        .getByRole('button', { name: /Sign in|تسجيل الدخول/i })
        .isVisible();
    assertAfterPasswordChangeAggregate({
      referenceSnapshot: preResetSnapshot,
      snapshot: afterChange,
      requestIdHash: changeRequestIdHash,
      browserSignedOut,
    });
    evidence.password_change = {
      submitted: true,
      submission_count: passwordChangeRun.attempt_count,
      attempt_count: passwordChangeRun.attempt_count,
      policy_rejection_count: passwordChangeRun.policy_rejection_count,
      policy_error_codes: passwordChangeRun.policy_error_codes,
      http_status: finalPasswordChangeResult.httpStatus,
      safe_error_code: null,
      request_id_hash: changeRequestIdHash,
      edge_success_confirmed: finalPasswordChangeResult.ok === true,
      finalizer_rpc: FINALIZER_RPC,
      terminal_proof: credentialProof(afterChange),
      password_changed_at_set: afterChange.target.password_changed_at_set,
      sessions_revoked_at_set: afterChange.target.sessions_revoked_at_set,
      reconciliation_auth_changed: afterChange.target.reconciliation_auth_changed,
      browser_signed_out: browserSignedOut,
    };
    evidence.audit.after_password_change = afterChange.audit;
    assertPasswordChangeCompletionProof({
      passwordChange: evidence.password_change,
      audit: evidence.audit.after_password_change,
    });

    phase = 'fresh_login';
    const freshContext = await createSafeBrowserContext(browser, contextOptions, targetGuard);
    const freshPage = await freshContext.newPage();
    const freshIdentifier = new SecretValue(TARGET_EMPLOYEE_ID);
    try {
      await login(freshPage, args.appUrl, freshIdentifier, finalPermanentPassword, targetGuard);
    } finally {
      freshIdentifier.clear();
    }
    const freshUserId = await authenticatedUserId(freshPage);
    const freshAuthorizationProof = await proveControlledEmployeeContextAuthorization({
      context: freshContext,
      page: freshPage,
      label: CONTROLLED_EMPLOYEE_CONTEXT_LABELS[0],
      appUrl: args.appUrl,
      targetGuard,
      refreshSucceeded: false,
    });
    assertFreshPermanentLoginProof({
      context: freshContext,
      authenticatedUserId: freshUserId,
      authorizationProof: freshAuthorizationProof,
    });
    const afterFreshLogin = await readCheckpoint('after_fresh_employee_login');
    assertFinalFreshLoginAggregate({
      referenceSnapshot: preResetSnapshot,
      snapshot: afterFreshLogin,
      finalSessionContract: initialEdgeDeploymentGate.finalSessionContract,
      context: freshContext,
      authenticatedUserId: freshUserId,
      authorizationProof: freshAuthorizationProof,
    });
    evidence.fresh_login = {
      permanent_login_succeeded: true,
      nonpersistent_context: freshAuthorizationProof.nonpersistent_context,
      authenticated_user_id: freshUserId,
      role: afterFreshLogin.target.role,
      scope: afterFreshLogin.target.scope,
      admin_route_denied: freshAuthorizationProof.admin_route_denied,
      permitted_employee_page_accessible:
        freshAuthorizationProof.permitted_employee_page_accessible,
      admin_redirect_destination_permitted:
        freshAuthorizationProof.admin_redirect_destination_permitted,
      admin_navigation_absent: freshAuthorizationProof.admin_navigation_absent,
      user_management_absent: freshAuthorizationProof.user_management_absent,
      access_control_absent: freshAuthorizationProof.access_control_absent,
      provisioning_controls_absent:
        freshAuthorizationProof.provisioning_controls_absent,
      authorized_route: new URL(freshPage.url()).searchParams.get('page') ?? 'home',
      database_credential_version: afterFreshLogin.target.credential_version,
      auth_credential_version: afterFreshLogin.target.auth_credential_version,
      database_session_count: afterFreshLogin.target.session_count,
      unrevoked_refresh_token_count: afterFreshLogin.target.unrevoked_refresh_token_count,
      observed_at: afterFreshLogin.captured_at,
    };
    assertNetworkConsoleSafeAggregate({
      configuration: stagingRuntimeConfiguration,
      targetGuard,
      productionProjectAbsent: targetGuard.violation === null,
    });
    evidence.execution_status = 'completed';
    await writeEvidence();
  } catch (error) {
    evidence.execution_status =
      phase === 'readiness'
        ? 'readiness_failed'
        : phase === 'password_change' || phase === 'forced_password_change'
          ? 'password_change_blocked'
          : phase === 'reset'
            ? 'reset_finalization_unclear'
            : 'operator_stopped';
    evidence.operator_guidance.push(
      operatorGuidanceForState(
        guidanceCodeForError(error),
        { observedState: error instanceof Error ? error.message.split(':')[0] : 'UNKNOWN' },
      ),
    );
    await writeEvidence();
    throw error;
  } finally {
    for (const value of controlledRefreshValues) value.clear();
    for (const secret of knownSecrets) secret.clear();
    clearRun008CredentialBundle(credentialBundle);
    browserConfiguration?.publicApiKey?.clear?.();
    if (credentialBundle) {
      await deleteRun008EncryptedCredentialFiles(credentialBundle);
    }
    await browser?.close();
  }
}

export async function main(argv = process.argv.slice(2), adapters = {}) {
  const args = parseCliArguments(argv);
  if (!args.execute && !args.precredentialReadinessOnly) {
    process.stdout.write(
      'Patch 83U staging reset proof harness is prepared but inert. '
      + 'Use the reviewed --execute-hosted-proof workflow only during a separately authorized execution window.\n',
    );
    return createExecutionPlan(
      {
        ...args,
        appUrl: args.appUrl ?? STAGING_APPLICATION_ORIGIN,
        supabaseUrl: args.supabaseUrl ?? `https://${STAGING_PROJECT_REF}.supabase.co`,
      },
      adapters,
    );
  }
  createExecutionPlan(args, adapters);
  if (args.precredentialReadinessOnly) {
    const runReadiness =
      adapters.runPreCredentialReadiness ?? runPreCredentialReadiness;
    try {
      const result = await runReadiness(args, adapters);
      process.stdout.write(`${PRE_CREDENTIAL_READINESS_PASSED}\n`);
      clearRun008CredentialBundle(result?.credentialBundle);
      result?.browserConfiguration?.publicApiKey?.clear?.();
      return result;
    } catch (error) {
      process.stdout.write(`${PRE_CREDENTIAL_READINESS_FAILED}\n`);
      const reported = new Error('PATCH83U_PRE_CREDENTIAL_READINESS_FAILED');
      reported.cause = error;
      reported.precredentialResultReported = true;
      throw reported;
    }
  }
  const preCredentialReadiness = await runPreCredentialReadiness(args, adapters);
  return runHostedProof(args, adapters, preCredentialReadiness);
}

const isEntrypoint = process.argv[1]
  && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase();
if (isEntrypoint) {
  main().catch((error) => {
    if (error?.precredentialResultReported !== true) {
      process.stderr.write(`${String(error instanceof Error ? error.message : error)}\n`);
    }
    process.exitCode = 1;
  });
}
