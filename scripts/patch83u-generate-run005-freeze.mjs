#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  lstat,
  open,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { arch, platform, release } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  EXECUTION_FREEZE_READY_DECISION,
  EXECUTION_FREEZE_SCHEMA_VERSION,
  PRE_CREDENTIAL_READINESS_PASSED,
  RESET_PROOF_SCHEMA_VERSION,
  RUN005_EVIDENCE_DIRECTORY,
  RUN005_EVIDENCE_SCHEMA_PATH,
  RUN005_OPERATOR_CONFIRMATION_CONTRACT_ID,
  RUN005_OUTPUT_PATH_PATTERN,
  SQL_EDITOR_CHECKPOINT_DIRECTORY,
  SQL_EDITOR_CHECKPOINT_FILE_NAMES,
  assertExecutionFreezeSemanticContract,
  validateExecutionFreezeAgainstSchema,
} from './patch83u-staging-multisession-reset-proof.mjs';

const execFileAsync = promisify(execFile);
const ROOT = resolve(import.meta.dirname, '..');
const EXPECTED_BRANCH = 'patch83t-controlled-user-excel-import';
const EXPECTED_HEAD = 'a9989b1e8d95a6bb775316a2d9e709ef84514c42';
const STAGING_PROJECT_REF = 'zghsgzrdwbqdrpuxanac';
const PRODUCTION_PROJECT_REF = 'zbrjjecpsrzposhuarcn';
const V5_JSON =
  'release/patch83u/patch83u-staging-reset-execution-freeze-v5-20260720.json';
const V5_MARKDOWN =
  'release/patch83u/patch83u-staging-reset-execution-freeze-v5-20260720.md';
const V5_SCHEMA =
  'release/patch83u/patch83u-staging-reset-execution-freeze-schema-v5.json';
const V4_JSON =
  'release/patch83u/patch83u-staging-reset-execution-freeze-v4-20260720.json';
const EDGE_PROVENANCE =
  'release/patch83u/patch83u-staging-edge-v5-provenance-20260719.json';
const EXPECTED_PRIOR_AGGREGATE =
  '8dc04ec626a7cd308878ce9e5f17859783603eec0666bea9f898a7d6eeeae397';
const EXPECTED_PRIOR_BYTES = 181740;
const EXPECTED_PRIOR_COUNT = 28;

const PRIOR_EVIDENCE_PATHS = Object.freeze([
  'release/patch83u/patch83u-staging-reset-execution-freeze-20260718.json',
  'release/patch83u/patch83u-staging-reset-execution-freeze-20260718.md',
  'release/patch83u/patch83u-staging-reset-execution-freeze-20260719.json',
  'release/patch83u/patch83u-staging-reset-execution-freeze-20260719.md',
  'release/patch83u/patch83u-staging-reset-execution-freeze-v2-20260719.json',
  'release/patch83u/patch83u-staging-reset-execution-freeze-v2-20260719.md',
  'release/patch83u/patch83u-staging-reset-execution-freeze-v3-20260720.json',
  'release/patch83u/patch83u-staging-reset-execution-freeze-v3-20260720.md',
  'release/patch83u/patch83u-staging-reset-execution-freeze-v4-20260720.json',
  'release/patch83u/patch83u-staging-reset-execution-freeze-v4-20260720.md',
  'release/patch83u/patch83u-staging-authorization-regression-proof.json',
  'release/patch83u/patch83u-staging-forced-password-change-proof.json',
  'release/patch83u/patch83u-staging-multisession-before-reset.txt',
  'release/patch83u/patch83u-staging-network-console-redacted.json',
  'release/patch83u/patch83u-staging-refresh-replay-negative-proof.json',
  'release/patch83u/patch83u-staging-reset-final-report.md',
  'release/patch83u/patch83u-staging-reset-final-results.json',
  'release/patch83u/patch83u-staging-session-revocation-after-reset.txt',
  'release/patch83u/patch83u-staging-super-admin-reset-browser-proof.json',
  'release/patch83u/reset-proof-run-002/README.md',
  'release/patch83u/reset-proof-run-002/patch83u-staging-reset-final-results-attempt-003.json',
  'release/patch83u/reset-proof-run-002/patch83u-staging-reset-final-results-attempt-004.json',
  'release/patch83u/reset-proof-run-002/patch83u-staging-reset-final-results.json',
  'release/patch83u/reset-proof-run-003/README.md',
  'release/patch83u/reset-proof-run-003/checkpoints/01-before-employee-sessions.json',
  'release/patch83u/reset-proof-run-004/README.md',
  'release/patch83u/reset-proof-run-004/checkpoints/README.md',
  'release/patch83u/reset-proof-run-004/run004-reservation.json',
].sort());

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

async function safeFile(path) {
  const absolutePath = resolve(ROOT, path);
  const rootRealPath = await realpath(ROOT);
  const fileRealPath = await realpath(absolutePath);
  const relativePath = fileRealPath.slice(rootRealPath.length);
  if (
    fileRealPath !== rootRealPath
    && !relativePath.startsWith('\\')
    && !relativePath.startsWith('/')
  ) {
    throw new Error(`PATCH83U_FREEZE_PATH_REFUSED:${path}`);
  }
  const stat = await lstat(fileRealPath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`PATCH83U_FREEZE_FILE_REFUSED:${path}`);
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
  const branch = branchResult.stdout.trim();
  const head = headResult.stdout.trim();
  const statusEntries = statusResult.stdout.split('\0').filter(Boolean);
  const statusByPath = new Map();
  for (const entry of statusEntries) {
    statusByPath.set(entry.slice(3).replaceAll('\\', '/'), entry.slice(0, 2));
  }
  const trackedAtHead = new Set(
    trackedResult.stdout.split(/\r?\n/).filter(Boolean).map(
      (path) => path.replaceAll('\\', '/'),
    ),
  );
  return {
    branch,
    head,
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

async function verifyRun004HasNoExecutionOutput() {
  const checkpointPaths = Object.values(SQL_EDITOR_CHECKPOINT_FILE_NAMES).map(
    (fileName) => (
      `release/patch83u/reset-proof-run-004/checkpoints/${fileName}`
    ),
  );
  for (const path of checkpointPaths) {
    try {
      await lstat(resolve(ROOT, path));
      throw new Error('PATCH83U_RUN004_CHECKPOINT_EVIDENCE_UNEXPECTED');
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  const { stdout } = await git([
    'status',
    '--short',
    '--untracked-files=all',
    '--',
    'release/patch83u/reset-proof-run-004',
  ]);
  if (/patch83u-staging-reset-final-results-attempt-\d{3}\.json/.test(stdout)) {
    throw new Error('PATCH83U_RUN004_ATTEMPT_OUTPUT_UNEXPECTED');
  }
}

async function toolchain() {
  const [npmResult, supabaseResult] = await Promise.all([
    execFileAsync(
      process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'npm',
      process.platform === 'win32'
        ? ['/d', '/s', '/c', 'npm --version']
        : ['--version'],
      {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      },
    ),
    execFileAsync('supabase', ['--version'], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
    }),
  ]);
  const packageLock = JSON.parse(await readFile(resolve(ROOT, 'package-lock.json'), 'utf8'));
  const playwright =
    packageLock.packages?.['node_modules/@playwright/test']?.version
    ?? packageLock.packages?.['node_modules/playwright']?.version;
  if (typeof playwright !== 'string') {
    throw new Error('PATCH83U_PLAYWRIGHT_VERSION_UNAVAILABLE');
  }
  return {
    node: process.version,
    npm: npmResult.stdout.trim(),
    playwright,
    supabase_cli: supabaseResult.stdout.trim(),
    operating_system: `${platform()} ${release()} ${arch()}`,
  };
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 0) {
    throw new Error('PATCH83U_RUN005_FREEZE_GENERATOR_ARGUMENTS_REFUSED');
  }
  const jsonPath = resolve(ROOT, V5_JSON);
  const markdownPath = resolve(ROOT, V5_MARKDOWN);
  let jsonHandle;
  let markdownHandle;
  let created = false;
  try {
    jsonHandle = await open(jsonPath, 'wx');
    await jsonHandle.close();
    jsonHandle = null;
    markdownHandle = await open(markdownPath, 'wx');
    await markdownHandle.close();
    markdownHandle = null;
    created = true;

    const state = await repositoryState();
    if (
      state.branch !== EXPECTED_BRANCH
      || state.head !== EXPECTED_HEAD
      || state.staged_file_count !== 0
    ) {
      throw new Error('PATCH83U_RUN005_REPOSITORY_GATE_FAILED');
    }
    await verifyRun004HasNoExecutionOutput();

    const v4 = JSON.parse(await readFile(resolve(ROOT, V4_JSON), 'utf8'));
    const excludedWorkspaceFiles = new Set([
      'release/patch83u/reset-proof-run-004/README.md',
      'release/patch83u/reset-proof-run-004/checkpoints/README.md',
      'release/patch83u/reset-proof-run-004/run004-reservation.json',
    ]);
    const addedSourceFiles = [
      V5_SCHEMA,
      RUN005_EVIDENCE_SCHEMA_PATH,
      'release/patch83u/reset-proof-run-005/README.md',
      'release/patch83u/reset-proof-run-005/checkpoints/README.md',
      'release/patch83u/reset-proof-run-005/run005-reservation.json',
      'scripts/patch83u-generate-run005-freeze.mjs',
      'tests/unit/patch83uExecutionFreezeContract.test.ts',
    ];
    const sourcePaths = [
      ...v4.frozen_source.files.map((entry) => entry.path)
        .filter((path) => !excludedWorkspaceFiles.has(path)),
      ...addedSourceFiles,
    ].sort();
    if (new Set(sourcePaths).size !== sourcePaths.length) {
      throw new Error('PATCH83U_RUN005_SOURCE_INVENTORY_DUPLICATE');
    }
    const frozenFiles = [];
    for (const path of sourcePaths) {
      const file = await safeFile(path);
      const rawStatus = state.statusByPath.get(path) ?? 'clean';
      if (!['clean', ' M', '??'].includes(rawStatus)) {
        throw new Error(`PATCH83U_RUN005_SOURCE_GIT_STATUS_REFUSED:${path}`);
      }
      frozenFiles.push({
        ...file,
        git_status: rawStatus,
        tracked_at_head: state.trackedAtHead.has(path),
      });
    }

    const priorFiles = [];
    for (const path of PRIOR_EVIDENCE_PATHS) {
      priorFiles.push({ ...(await safeFile(path)), immutable: true });
    }
    const priorBytes = priorFiles.reduce((total, file) => total + file.bytes, 0);
    if (
      priorFiles.length !== EXPECTED_PRIOR_COUNT
      || priorBytes !== EXPECTED_PRIOR_BYTES
      || manifestAggregate(priorFiles) !== EXPECTED_PRIOR_AGGREGATE
    ) {
      throw new Error('PATCH83U_PRIOR_EVIDENCE_BASELINE_MISMATCH');
    }

    const [schemaBytes, provenanceBytes, evidenceSchemaBytes, versions] =
      await Promise.all([
        readFile(resolve(ROOT, V5_SCHEMA)),
        readFile(resolve(ROOT, EDGE_PROVENANCE)),
        readFile(resolve(ROOT, RUN005_EVIDENCE_SCHEMA_PATH)),
        toolchain(),
      ]);
    const schema = JSON.parse(schemaBytes.toString('utf8'));
    const provenance = JSON.parse(provenanceBytes.toString('utf8'));
    const createdAtUnixMs = provenance.active_metadata.created_at_unix_ms;
    const updatedAtUnixMs = provenance.active_metadata.updated_at_unix_ms;
    const capturedAtUtc = new Date().toISOString();
    const frozenBytes = frozenFiles.reduce((total, file) => total + file.bytes, 0);
    const freeze = {
      $schema: './patch83u-staging-reset-execution-freeze-schema-v5.json',
      schema_version: EXECUTION_FREEZE_SCHEMA_VERSION,
      captured_at_utc: capturedAtUtc,
      readiness_decision: EXECUTION_FREEZE_READY_DECISION,
      decision_is_execution_authorization: false,
      supersedes: {
        path: V4_JSON,
        sha256: '8e81321e13460a69af61104d14ce486c2a103518375447f8f44907ccd3a69bd7',
        bytes: 30592,
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
        contract_id: RUN005_OPERATOR_CONFIRMATION_CONTRACT_ID,
        run_number: 5,
        exact_phrase: 'EXECUTE RUN 005 RESET NOW',
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
          hosted_ezbr_sha256:
            provenance.active_metadata.hosted_ezbr_sha256,
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
        run_number: 5,
        evidence_directory: RUN005_EVIDENCE_DIRECTORY,
        checkpoint_directory: SQL_EDITOR_CHECKPOINT_DIRECTORY,
        checkpoint_files: Object.values(SQL_EDITOR_CHECKPOINT_FILE_NAMES),
        output_path_pattern: RUN005_OUTPUT_PATH_PATTERN,
        exclusive_create_required: true,
        evidence_schema_path: RUN005_EVIDENCE_SCHEMA_PATH,
        evidence_schema_sha256: sha256(evidenceSchemaBytes),
        evidence_schema_bytes: evidenceSchemaBytes.length,
        evidence_schema_version: RESET_PROOF_SCHEMA_VERSION,
        frontend_mode: 'staging',
        precredential_mode_flag: '--precredential-readiness-only',
        precredential_success_output: PRE_CREDENTIAL_READINESS_PASSED,
      },
      frozen_source: {
        hash_algorithm: 'sha256',
        aggregate_algorithm:
          'SHA-256 of ordinal-path-sorted UTF-8 lines '
          + 'path<TAB>sha256<TAB>bytes joined by LF with no trailing LF',
        file_count: frozenFiles.length,
        total_bytes: frozenBytes,
        aggregate_sha256: manifestAggregate(frozenFiles),
        files: frozenFiles,
      },
      prior_evidence_integrity: {
        hash_algorithm: 'sha256',
        aggregate_algorithm:
          'SHA-256 of ordinal-path-sorted UTF-8 lines '
          + 'path<TAB>sha256<TAB>bytes joined by LF with no trailing LF',
        file_count: priorFiles.length,
        total_bytes: priorBytes,
        aggregate_sha256: manifestAggregate(priorFiles),
        files: priorFiles,
        run004_absence_assertions: {
          checkpoint_files_absent: true,
          attempt_output_files_absent: true,
        },
      },
      run004_stop_state: {
        phase: 'phase_3_startup_initial_edge_provenance_gate',
        failure_code: 'PATCH83U_EDGE_PROVENANCE_METADATA_MISMATCH',
        authorization_consumed: true,
        credentials_entered: false,
        login_performed: false,
        employee_sessions_created: false,
        checkpoint_files_created: false,
        reset_submitted: false,
        request_id_exists: false,
        credential_or_auth_state_changed: false,
        recovery_or_reconciliation_required: false,
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
        `PATCH83U_RUN005_FREEZE_SCHEMA_INVALID:${validation.errors[0] ?? 'UNKNOWN'}`,
      );
    }
    assertExecutionFreezeSemanticContract(freeze);
    const freezeBytes = Buffer.from(`${JSON.stringify(freeze, null, 2)}\n`, 'utf8');
    await writeFile(jsonPath, freezeBytes, { flag: 'r+' });
    process.stdout.write(
      `V5 aggregate SHA-256: ${freeze.frozen_source.aggregate_sha256}\n`
      + `V5 freeze JSON SHA-256: ${sha256(freezeBytes)}\n`,
    );
  } catch (error) {
    await jsonHandle?.close();
    await markdownHandle?.close();
    if (created) {
      await rm(jsonPath, { force: true });
      await rm(markdownPath, { force: true });
    }
    throw error;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'PATCH83U_FREEZE_FAILED'}\n`);
  process.exitCode = 1;
});
