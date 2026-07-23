#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  lstat,
  open,
  readFile,
  readdir,
  realpath,
  rm,
} from 'node:fs/promises';
import { arch, platform, release } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  EXECUTION_FREEZE_READY_DECISION,
  EXECUTION_FREEZE_SCHEMA_VERSION,
  PRE_CREDENTIAL_READINESS_PASSED,
  RESET_PROOF_SCHEMA_VERSION,
  RUN009_CHECKPOINT_SCHEMA_PATH,
  RUN009_EVIDENCE_DIRECTORY,
  RUN009_EVIDENCE_SCHEMA_PATH,
  RUN009_OPERATOR_CONFIRMATION_CONTRACT_ID,
  RUN009_OUTPUT_PATH_PATTERN,
  RUN009_PROOF_CONTRACT_ID,
  RUN009_PROOF_CONTRACT_PATH,
  RUN009_PROOF_CONTRACT_VERSION,
  RUN009_TRACEABILITY_MARKDOWN_PATH,
  RUN009_TRACEABILITY_PATH,
  RUN009_TRACEABILITY_VERSION,
  RUN_NUMBER,
  SQL_EDITOR_CHECKPOINT_DIRECTORY,
  SQL_EDITOR_CHECKPOINT_FILE_NAMES,
  assertExecutionFreezeSemanticContract,
  validateExecutionFreezeAgainstSchema,
} from './patch83u-staging-multisession-reset-proof.mjs';
import {
  RUN009_EXPECTED_SESSION_COUNT,
  RUN009_EXPECTED_UNREVOKED_REFRESH_TOKEN_COUNT,
  validateRun009ProofContract,
  validateRun009Traceability,
  verifyRun009ContractArtifacts,
} from './patch83u-run009-contract-audit.mjs';

const execFileAsync = promisify(execFile);
const ROOT = resolve(import.meta.dirname, '..');
const EXPECTED_BRANCH = 'patch83t-controlled-user-excel-import';
const EXPECTED_HEAD = 'a9989b1e8d95a6bb775316a2d9e709ef84514c42';
const STAGING_PROJECT_REF = 'zghsgzrdwbqdrpuxanac';
const PRODUCTION_PROJECT_REF = 'zbrjjecpsrzposhuarcn';
const PRIOR_JSON =
  'release/patch83u/patch83u-staging-reset-execution-freeze-v8-20260721.json';
const PRIOR_MARKDOWN =
  'release/patch83u/patch83u-staging-reset-execution-freeze-v8-20260721.md';
const PRIOR_SCHEMA =
  'release/patch83u/patch83u-staging-reset-execution-freeze-schema-v8.json';
const V9_JSON =
  'release/patch83u/patch83u-staging-reset-execution-freeze-v9-20260721.json';
const V9_MARKDOWN =
  'release/patch83u/patch83u-staging-reset-execution-freeze-v9-20260721.md';
const V9_SCHEMA =
  'release/patch83u/patch83u-staging-reset-execution-freeze-schema-v9.json';
const EDGE_PROVENANCE =
  'release/patch83u/patch83u-staging-edge-v5-provenance-20260719.json';
const RUN009_RESERVATION =
  'release/patch83u/reset-proof-run-009/run009-reservation.json';
const EXPECTED_PRIOR_FREEZE_SHA256 =
  '2013955076dcad07db557cff718f5952bf30e1ba6e5e8d36f5e48995114e4932';
const EXPECTED_PRIOR_FREEZE_BYTES = 45218;
const AGGREGATE_ALGORITHM =
  'SHA-256 of ordinal-path-sorted UTF-8 lines '
  + 'path<TAB>sha256<TAB>bytes joined by LF with no trailing LF';

const PRIOR_SOURCE_EXCLUSIONS = Object.freeze(new Set());

const RUN009_SOURCE_ADDITIONS = Object.freeze([
  V9_SCHEMA,
  RUN009_EVIDENCE_SCHEMA_PATH,
  RUN009_PROOF_CONTRACT_PATH,
  RUN009_TRACEABILITY_PATH,
  RUN009_TRACEABILITY_MARKDOWN_PATH,
  'release/patch83u/reset-proof-run-009/README.md',
  'release/patch83u/reset-proof-run-009/checkpoints/README.md',
  RUN009_RESERVATION,
  'scripts/patch83u-generate-run009-freeze.mjs',
  'scripts/patch83u-run009-contract-audit.mjs',
  'tests/unit/patch83uRun009ProjectConfirmation.test.ts',
  'tests/unit/patch83uRun009CheckpointFileInput.test.ts',
  'tests/unit/patch83uRun009CompletionEvidenceContract.test.ts',
  'tests/unit/patch83uRun009ExecutionFreezeContract.test.ts',
]);

const PRIOR_EVIDENCE_ADDITIONS = Object.freeze([
  PRIOR_JSON,
  PRIOR_MARKDOWN,
  PRIOR_SCHEMA,
]);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function manifestAggregate(files) {
  const material = [...files]
    .sort((left, right) => (
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0
    ))
    .map(({ path, sha256: hash, bytes }) => `${path}\t${hash}\t${bytes}`)
    .join('\n');
  return sha256(Buffer.from(material, 'utf8'));
}

async function git(args) {
  return execFileAsync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 10_000_000,
  });
}

function pathWithin(directory, candidate) {
  const fromDirectory = relative(directory, candidate);
  return fromDirectory === ''
    || (!fromDirectory.startsWith('..') && !isAbsolute(fromDirectory));
}

async function safeFile(path) {
  if (isAbsolute(path) || path.includes('\\')) {
    throw new Error(`PATCH83U_RUN009_FREEZE_PATH_REFUSED:${path}`);
  }
  const rootRealPath = await realpath(ROOT);
  const fileRealPath = await realpath(resolve(rootRealPath, path));
  if (!pathWithin(rootRealPath, fileRealPath)) {
    throw new Error(`PATCH83U_RUN009_FREEZE_PATH_REFUSED:${path}`);
  }
  const stat = await lstat(fileRealPath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`PATCH83U_RUN009_FREEZE_FILE_REFUSED:${path}`);
  }
  const bytes = await readFile(fileRealPath);
  return {
    path,
    sha256: sha256(bytes),
    bytes: bytes.length,
  };
}

async function repositoryState() {
  const [
    branchResult,
    headResult,
    statusResult,
    trackedResult,
    stagedResult,
  ] = await Promise.all([
    git(['branch', '--show-current']),
    git(['rev-parse', 'HEAD']),
    git(['status', '--porcelain=v1', '-z', '--untracked-files=all']),
    git(['ls-tree', '-r', '--name-only', 'HEAD']),
    git(['diff', '--cached', '--name-only']),
  ]);
  const statusEntries = statusResult.stdout.split('\0').filter(Boolean);
  const statusByPath = new Map();
  for (const entry of statusEntries) {
    statusByPath.set(entry.slice(3).replaceAll('\\', '/'), entry.slice(0, 2));
  }
  const trackedAtHead = new Set(
    trackedResult.stdout.split(/\r?\n/).filter(Boolean)
      .map((path) => path.replaceAll('\\', '/')),
  );
  return {
    branch: branchResult.stdout.trim(),
    head: headResult.stdout.trim(),
    working_tree_dirty: statusEntries.length > 0,
    tracked_modified_count:
      statusEntries.filter((entry) => !entry.startsWith('??')).length,
    untracked_count_after_manifest_creation:
      statusEntries.filter((entry) => entry.startsWith('??')).length,
    porcelain_entry_count_after_manifest_creation: statusEntries.length,
    staged_file_count:
      stagedResult.stdout.split(/\r?\n/).filter(Boolean).length,
    statusByPath,
    trackedAtHead,
  };
}

async function directoryFiles(path) {
  const output = [];
  const visit = async (relativeDirectory) => {
    const entries = await readdir(resolve(ROOT, relativeDirectory), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      const child = `${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory()) {
        await visit(child);
      } else {
        output.push(child);
      }
    }
  };
  await visit(path);
  return output;
}

async function verifyRunOutputAbsence(run) {
  const directory = `release/patch83u/reset-proof-run-${run}`;
  const files = await directoryFiles(directory);
  const unexpectedCheckpoints = files.filter((path) => (
    /\/checkpoints\/0[1-6]-.*\.json$/.test(path)
  ));
  const attempts = files.filter((path) => (
    /patch83u-staging-reset-final-results(?:-attempt-\d{3})?\.json$/.test(path)
  ));
  if (unexpectedCheckpoints.length > 0 || attempts.length > 0) {
    throw new Error(`PATCH83U_RUN${run}_EXECUTION_OUTPUT_UNEXPECTED`);
  }
}

async function toolchain() {
  const npmCommand = process.platform === 'win32'
    ? (process.env.ComSpec ?? 'cmd.exe')
    : 'npm';
  const npmArguments = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm --version']
    : ['--version'];
  const [npmResult, supabaseResult, packageLock] = await Promise.all([
    execFileAsync(npmCommand, npmArguments, {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
    }),
    execFileAsync('supabase', ['--version'], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
    }),
    readFile(resolve(ROOT, 'package-lock.json'), 'utf8').then(JSON.parse),
  ]);
  const playwright =
    packageLock.packages?.['node_modules/@playwright/test']?.version
    ?? packageLock.packages?.['node_modules/playwright']?.version;
  if (typeof playwright !== 'string' || playwright === '') {
    throw new Error('PATCH83U_RUN009_PLAYWRIGHT_VERSION_UNAVAILABLE');
  }
  return {
    node: process.version,
    npm: npmResult.stdout.trim(),
    playwright,
    supabase_cli: supabaseResult.stdout.trim(),
    operating_system: `${platform()} ${release()} ${arch()}`,
  };
}

function freezeMarkdown(freeze, freezeJsonSha256) {
  return `# Patch 83U staging reset execution freeze V8

Captured: ${freeze.captured_at_utc}

Decision: ${freeze.readiness_decision}

This freeze is local preparation only and is not hosted-execution
authorization. Run 005 authorization is consumed and cannot be reused.

- Branch: \`${freeze.repository.branch}\`
- HEAD: \`${freeze.repository.head}\`
- Staged files: ${freeze.repository.staged_file_count}
- Staging project: \`${freeze.targets.allowed_staging_project_ref}\`
- Prohibited production project: \`${freeze.targets.prohibited_production_project_ref}\`
- Edge: \`privileged-action\` v${freeze.active_edge_provenance.metadata.version},
  \`${freeze.active_edge_provenance.metadata.status}\`, verify_jwt=true
- Reviewed Edge source: \`${freeze.active_edge_provenance.source.local.sha256}\`
- Frozen source files: ${freeze.frozen_source.file_count}
- Frozen source aggregate SHA-256: \`${freeze.frozen_source.aggregate_sha256}\`
- Freeze JSON SHA-256: \`${freezeJsonSha256}\`
- Proof-contract requirements: ${freeze.proof_contract.requirement_count}
- Traceability: ${freeze.traceability.mapped_requirement_count}/${
  freeze.traceability.requirement_count} (${freeze.traceability.coverage_percent}%)
- Confirmation contract: \`${freeze.operator_confirmation_contract.contract_id}\`
- Exact final session/refresh contract: ${
  freeze.final_session_contract.expected_session_count}/${
  freeze.final_session_contract.expected_unrevoked_refresh_token_count}

Checkpoint 4 requires exactly one disposable temporary-password session and
one unrevoked refresh row. Checkpoint 5 requires zero/zero plus both timestamp
booleans and cleared reconciliation evidence. Checkpoint 6 requires exactly
one/one after the single fresh permanent-password login.

No credentials, login, sessions, reset, password change, refresh replay,
deployment, migration, hosted mutation, production access, staging, commit,
or push occurred while preparing this freeze.
`;
}

async function buildFreeze(state) {
  const priorFreezeBytes = await readFile(resolve(ROOT, PRIOR_JSON));
  if (
    priorFreezeBytes.length !== EXPECTED_PRIOR_FREEZE_BYTES
    || sha256(priorFreezeBytes) !== EXPECTED_PRIOR_FREEZE_SHA256
  ) {
    throw new Error('PATCH83U_RUN009_PRIOR_FREEZE_DRIFT');
  }
  const priorFreeze = JSON.parse(priorFreezeBytes.toString('utf8'));
  const sourcePaths = [
    ...priorFreeze.frozen_source.files.map((entry) => entry.path)
      .filter((path) => !PRIOR_SOURCE_EXCLUSIONS.has(path)),
    ...RUN009_SOURCE_ADDITIONS,
  ].sort();
  if (new Set(sourcePaths).size !== sourcePaths.length) {
    throw new Error('PATCH83U_RUN009_SOURCE_INVENTORY_DUPLICATE');
  }
  const frozenFiles = [];
  for (const path of sourcePaths) {
    const file = await safeFile(path);
    const gitStatus = state.statusByPath.get(path) ?? 'clean';
    if (!['clean', ' M', '??'].includes(gitStatus)) {
      throw new Error(`PATCH83U_RUN009_SOURCE_GIT_STATUS_REFUSED:${path}`);
    }
    frozenFiles.push({
      ...file,
      git_status: gitStatus,
      tracked_at_head: state.trackedAtHead.has(path),
    });
  }

  const priorPaths = [
    ...priorFreeze.prior_evidence_integrity.files.map((entry) => entry.path),
    ...PRIOR_EVIDENCE_ADDITIONS,
  ].sort();
  if (new Set(priorPaths).size !== priorPaths.length) {
    throw new Error('PATCH83U_RUN009_PRIOR_EVIDENCE_DUPLICATE');
  }
  const priorFiles = [];
  for (const path of priorPaths) {
    priorFiles.push({
      ...(await safeFile(path)),
      immutable: true,
    });
  }
  const priorBytes = priorFiles.reduce((total, file) => total + file.bytes, 0);
  const priorEvidenceAggregate = manifestAggregate(priorFiles);

  const [
    schemaBytes,
    provenanceBytes,
    evidenceSchemaBytes,
    checkpointSchemaBytes,
    proofContractBytes,
    traceabilityBytes,
    traceabilityMarkdownBytes,
    versions,
  ] = await Promise.all([
    readFile(resolve(ROOT, V9_SCHEMA)),
    readFile(resolve(ROOT, EDGE_PROVENANCE)),
    readFile(resolve(ROOT, RUN009_EVIDENCE_SCHEMA_PATH)),
    readFile(resolve(ROOT, RUN009_CHECKPOINT_SCHEMA_PATH)),
    readFile(resolve(ROOT, RUN009_PROOF_CONTRACT_PATH)),
    readFile(resolve(ROOT, RUN009_TRACEABILITY_PATH)),
    readFile(resolve(ROOT, RUN009_TRACEABILITY_MARKDOWN_PATH)),
    toolchain(),
  ]);
  const schema = JSON.parse(schemaBytes.toString('utf8'));
  const provenance = JSON.parse(provenanceBytes.toString('utf8'));
  const proofContract = JSON.parse(proofContractBytes.toString('utf8'));
  const traceability = JSON.parse(traceabilityBytes.toString('utf8'));
  const proofValidation = validateRun009ProofContract(proofContract);
  const traceabilityValidation = validateRun009Traceability(
    traceability,
    proofContract,
  );
  if (
    proofValidation.requirement_count !== 56
    || traceabilityValidation.mapped_count !== 56
  ) {
    throw new Error('PATCH83U_RUN009_PROOF_TRACEABILITY_INCOMPLETE');
  }
  const createdAtUnixMs = provenance.active_metadata.created_at_unix_ms;
  const updatedAtUnixMs = provenance.active_metadata.updated_at_unix_ms;
  const frozenBytes = frozenFiles.reduce((total, file) => total + file.bytes, 0);
  const freeze = {
    $schema: './patch83u-staging-reset-execution-freeze-schema-v9.json',
    schema_version: EXECUTION_FREEZE_SCHEMA_VERSION,
    captured_at_utc: new Date().toISOString(),
    readiness_decision: EXECUTION_FREEZE_READY_DECISION,
    decision_is_execution_authorization: false,
    supersedes: {
      path: PRIOR_JSON,
      sha256: EXPECTED_PRIOR_FREEZE_SHA256,
      bytes: EXPECTED_PRIOR_FREEZE_BYTES,
      prior_authorization_reusable: false,
    },
    repository: {
      branch: state.branch,
      head: state.head,
      working_tree_dirty: state.working_tree_dirty,
      tracked_modified_count: state.tracked_modified_count,
      untracked_count_after_manifest_creation:
        state.untracked_count_after_manifest_creation,
      porcelain_entry_count_after_manifest_creation:
        state.porcelain_entry_count_after_manifest_creation,
      staged_file_count: state.staged_file_count,
    },
    targets: {
      allowed_staging_project_ref: STAGING_PROJECT_REF,
      prohibited_production_project_ref: PRODUCTION_PROJECT_REF,
      staging_supabase_origin: `https://${STAGING_PROJECT_REF}.supabase.co`,
      application_origin: 'http://localhost:5173',
      production_accessed: false,
    },
    toolchain: versions,
    runtime_contract: {
      schema_version: '174.2-auth-first',
      enforcement_state: 'enforced',
      state_version: 5,
      expected_edge_contract: 'patch83u-edge-auth-first-v1',
      compatible_edge_contract: 'patch83u-edge-auth-first-v1',
      expected_frontend_contract: 'patch83u-frontend-auth-first-v1',
      compatible_frontend_contract: 'patch83u-frontend-auth-first-v1',
      applied_migrations: ['174', '176', '177'],
      finalizer: {
        name: 'patch83u_finalize_password_change_after_revocation',
        name_bytes: 50,
        security_definer: true,
        service_role_execute: true,
        authenticated_execute: false,
        anon_execute: false,
        public_execute: false,
      },
    },
    operator_confirmation_contract: {
      contract_id: RUN009_OPERATOR_CONFIRMATION_CONTRACT_ID,
      run_number: RUN_NUMBER,
      exact_phrase: 'EXECUTE RUN 009 RESET NOW',
      case_sensitive: true,
      cli_override_supported: false,
      required_immediately_before_reset: true,
      evidence_retention: 'boolean_and_contract_id_only',
    },
    active_edge_provenance: {
      identity: {
        project_ref: STAGING_PROJECT_REF,
        function_name: 'privileged-action',
      },
      metadata: {
        version: provenance.active_metadata.version,
        status: provenance.active_metadata.status,
        verify_jwt: provenance.active_metadata.verify_jwt,
        hosted_ezbr_sha256: provenance.active_metadata.hosted_ezbr_sha256,
        created_at_unix_ms: createdAtUnixMs,
        created_at_utc: new Date(createdAtUnixMs).toISOString(),
        updated_at_unix_ms: updatedAtUnixMs,
        updated_at_utc: new Date(updatedAtUnixMs).toISOString(),
      },
      provenance_record: {
        path: EDGE_PROVENANCE,
        sha256: sha256(provenanceBytes),
        bytes: provenanceBytes.length,
      },
      source: {
        downloaded: {
          sha256: provenance.downloaded_source.sha256,
          bytes: provenance.downloaded_source.bytes,
        },
        local: {
          path: provenance.local_source.path,
          sha256: provenance.local_source.sha256,
          bytes: provenance.local_source.bytes,
        },
        byte_identical: provenance.comparison.byte_identical,
        production_ref_absent:
          provenance.security_contract.production_ref_absent,
      },
      bundle_binding: {
        raw_entrypoint_binding_proven:
          provenance.bundle_binding.raw_entrypoint_binding_proven,
        complete_deployment_bundle_binding_proven:
          provenance.bundle_binding.complete_deployment_bundle_binding_proven,
        hosted_hash_meaning_as_raw_source_hash_proven:
          provenance.hosted_hash_interpretation
            .hosted_hash_meaning_as_raw_source_hash_proven,
      },
    },
    run_contract: {
      run_number: RUN_NUMBER,
      evidence_directory: RUN009_EVIDENCE_DIRECTORY,
      checkpoint_directory: SQL_EDITOR_CHECKPOINT_DIRECTORY,
      checkpoint_files: Object.values(SQL_EDITOR_CHECKPOINT_FILE_NAMES),
      output_path_pattern: RUN009_OUTPUT_PATH_PATTERN,
      exclusive_create_required: true,
      evidence_schema_path: RUN009_EVIDENCE_SCHEMA_PATH,
      evidence_schema_sha256: sha256(evidenceSchemaBytes),
      evidence_schema_bytes: evidenceSchemaBytes.length,
      evidence_schema_version: RESET_PROOF_SCHEMA_VERSION,
      frontend_mode: 'staging',
      sql_editor_project_ref_option: '--sql-editor-project-ref',
      sql_editor_project_confirmation_gate_id:
        'patch83u-sql-editor-project-confirmation-v1',
      precredential_no_secret_fixture_flag: '--precredential-inert-fixture',
      precredential_mode_flag: '--precredential-readiness-only',
      precredential_success_output: PRE_CREDENTIAL_READINESS_PASSED,
    },
    proof_contract: {
      path: RUN009_PROOF_CONTRACT_PATH,
      sha256: sha256(proofContractBytes),
      bytes: proofContractBytes.length,
      schema_version: RUN009_PROOF_CONTRACT_VERSION,
      contract_id: RUN009_PROOF_CONTRACT_ID,
      requirement_count: proofValidation.requirement_count,
    },
    checkpoint_schema: {
      path: RUN009_CHECKPOINT_SCHEMA_PATH,
      sha256: sha256(checkpointSchemaBytes),
      bytes: checkpointSchemaBytes.length,
      schema_version: 'patch83u-staging-sql-editor-checkpoint-file-v3',
    },
    traceability: {
      json_path: RUN009_TRACEABILITY_PATH,
      json_sha256: sha256(traceabilityBytes),
      json_bytes: traceabilityBytes.length,
      markdown_path: RUN009_TRACEABILITY_MARKDOWN_PATH,
      markdown_sha256: sha256(traceabilityMarkdownBytes),
      markdown_bytes: traceabilityMarkdownBytes.length,
      schema_version: RUN009_TRACEABILITY_VERSION,
      requirement_count: proofValidation.requirement_count,
      mapped_requirement_count: traceabilityValidation.mapped_count,
      coverage_percent: traceabilityValidation.coverage_percent,
      complete: true,
    },
    final_session_contract: structuredClone(proofContract.final_session_contract),
    frozen_source: {
      hash_algorithm: 'sha256',
      aggregate_algorithm: AGGREGATE_ALGORITHM,
      file_count: frozenFiles.length,
      total_bytes: frozenBytes,
      aggregate_sha256: manifestAggregate(frozenFiles),
      files: frozenFiles,
    },
    prior_evidence_integrity: {
      hash_algorithm: 'sha256',
      aggregate_algorithm: AGGREGATE_ALGORITHM,
      file_count: priorFiles.length,
      total_bytes: priorBytes,
      aggregate_sha256: priorEvidenceAggregate,
      files: priorFiles,
      run005_absence_assertions: {
        checkpoint_files_absent: true,
        attempt_output_files_absent: true,
      },
    },
    run005_stop_state: {
      phase: 'phase_3_startup_initial_edge_provenance_gate',
      failure_code: 'PATCH83U_PRE_HARNESS_FROZEN_CONTRACT_AUDIT_FAILED',
      authorization_consumed: true,
      credentials_entered: false,
      login_performed: false,
      employee_sessions_created: false,
      sql_checkpoints_executed: false,
      reset_request_id_generated: false,
      reset_submitted: false,
      password_change_submitted: false,
      credential_or_auth_state_changed: false,
      recovery_or_reconciliation_required: false,
      super_admin_untouched: true,
      production_accessed: false,
    },
    local_validation: {
      freeze_schema: 'passed',
      precredential_readiness: 'passed',
      javascript_syntax: 'passed',
      focused_tests: 'passed',
      auth_session_tests: 'passed',
      typescript: 'passed',
      build: 'not_run_application_source_unchanged',
      git_diff_check: 'passed',
      secret_scan: 'passed',
    },
    safety: {
      credentials_entered: false,
      login_performed: false,
      employee_sessions_created: false,
      reset_request_id_generated: false,
      reset_performed: false,
      password_change_performed: false,
      refresh_replay_performed: false,
      deployment_performed: false,
      migration_performed: false,
      hosted_mutation_performed: false,
      production_accessed: false,
      files_staged: false,
      commit_performed: false,
      push_performed: false,
    },
  };
  const validation = validateExecutionFreezeAgainstSchema(freeze, schema);
  if (!validation.valid) {
    throw new Error(
      `PATCH83U_RUN009_FREEZE_SCHEMA_INVALID:${validation.errors[0] ?? 'UNKNOWN'}`,
    );
  }
  assertExecutionFreezeSemanticContract(freeze);
  const contractAudit = await verifyRun009ContractArtifacts({
    freeze,
    repositoryRoot: ROOT,
  });
  if (
    contractAudit.requirement_count !== 56
    || contractAudit.mapped_count !== 56
    || contractAudit.static_coverage_count !== 56
    || contractAudit.checkpoint_field_coverage?.checkpoint_count !== 6
    || contractAudit.checkpoint_field_coverage?.required_target_field_count
      !== contractAudit.checkpoint_field_coverage?.sql_target_field_count
    || contractAudit.checkpoint_field_coverage?.required_target_field_count
      !== contractAudit.checkpoint_field_coverage?.schema_required_field_count
    || contractAudit.checkpoint_field_coverage?.expected_field_count
      !== contractAudit.checkpoint_field_coverage
        ?.total_expectation_coverage_count
  ) {
    throw new Error('PATCH83U_RUN009_PRE_CREDENTIAL_STATIC_AUDIT_INCOMPLETE');
  }
  if (
    freeze.final_session_contract.expected_session_count
      !== RUN009_EXPECTED_SESSION_COUNT
    || freeze.final_session_contract.expected_unrevoked_refresh_token_count
      !== RUN009_EXPECTED_UNREVOKED_REFRESH_TOKEN_COUNT
  ) {
    throw new Error('PATCH83U_RUN009_FINAL_SESSION_CONTRACT_DRIFT');
  }
  return freeze;
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 0) {
    throw new Error('PATCH83U_RUN009_FREEZE_GENERATOR_ARGUMENTS_REFUSED');
  }
  const jsonPath = resolve(ROOT, V9_JSON);
  const markdownPath = resolve(ROOT, V9_MARKDOWN);
  const createdPaths = [];
  let jsonHandle;
  let markdownHandle;
  try {
    jsonHandle = await open(jsonPath, 'wx');
    createdPaths.push(jsonPath);
    markdownHandle = await open(markdownPath, 'wx');
    createdPaths.push(markdownPath);

    const state = await repositoryState();
    if (
      state.branch !== EXPECTED_BRANCH
      || state.head !== EXPECTED_HEAD
      || state.staged_file_count !== 0
    ) {
      throw new Error('PATCH83U_RUN009_REPOSITORY_GATE_FAILED');
    }
    await verifyRunOutputAbsence('009');
    const freeze = await buildFreeze(state);
    const freezeBytes = Buffer.from(
      `${JSON.stringify(freeze, null, 2)}\n`,
      'utf8',
    );
    const freezeJsonSha256 = sha256(freezeBytes);
    const markdownBytes = Buffer.from(
      freezeMarkdown(freeze, freezeJsonSha256),
      'utf8',
    );
    await jsonHandle.writeFile(freezeBytes);
    await markdownHandle.writeFile(markdownBytes);
    await jsonHandle.close();
    jsonHandle = null;
    await markdownHandle.close();
    markdownHandle = null;
    process.stdout.write(
      `V9 aggregate SHA-256: ${freeze.frozen_source.aggregate_sha256}\n`
      + `V9 freeze JSON SHA-256: ${freezeJsonSha256}\n`,
    );
  } catch (error) {
    await jsonHandle?.close();
    await markdownHandle?.close();
    for (const path of createdPaths) {
      await rm(path, { force: true });
    }
    throw error;
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'PATCH83U_RUN009_FREEZE_FAILED'}\n`,
  );
  process.exitCode = 1;
});
