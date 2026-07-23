import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  afterAll,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createSyntheticPatch83uCheckpointFixture } from './helpers/patch83uHermeticCheckpointFixture';
import {
  EDGE_FUNCTION_NAME,
  EDGE_PROVENANCE_CLASSIFICATION,
  EDGE_PROVENANCE_SCHEMA_VERSION,
  EXECUTION_FREEZE_CONSUMED_JSON_POINTERS,
  EXECUTION_FREEZE_READY_DECISION,
  EXECUTION_FREEZE_SCHEMA_VERSION,
  EXPECTED_EDGE_CONTRACT,
  EXPECTED_FINAL_SESSION_COUNT,
  EXPECTED_FINAL_UNREVOKED_REFRESH_TOKEN_COUNT,
  EXPECTED_FRONTEND_CONTRACT,
  EXPECTED_SCHEMA_VERSION,
  FINALIZER_RPC,
  PRE_CREDENTIAL_READINESS_PASSED,
  PRODUCTION_PROJECT_REF,
  REQUIRED_MIGRATIONS,
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
  STAGING_APPLICATION_ORIGIN,
  STAGING_PROJECT_REF,
  STAGING_SUPABASE_ORIGIN,
  assertExecutionFreezeConsumedFields,
  assertExecutionFreezeSemanticContract,
  canonicalUtcFromUnixMs,
  validateExecutionFreezeAgainstSchema,
} from '../../scripts/patch83u-staging-multisession-reset-proof.mjs';
import {
  validateRun009ProofContract,
  validateRun009Traceability,
  verifyRun009ContractArtifacts,
} from '../../scripts/patch83u-run009-contract-audit.mjs';

const freezeSchema = JSON.parse(
  readFileSync(
    resolve(
      'release/patch83u/'
        + 'patch83u-staging-reset-execution-freeze-schema-v9.json',
    ),
    'utf8',
  ),
);

const syntheticCheckpointFixture = createSyntheticPatch83uCheckpointFixture();
const SYNTHETIC_CHECKPOINT_MANIFEST_PATH =
  'tests/fixtures/patch83u/synthetic-before-employee-sessions.json';
const PRIOR_EVIDENCE_PATHS = Object.freeze([
  'release/patch83u/patch83u-staging-authorization-regression-proof.json',
  'release/patch83u/patch83u-staging-forced-password-change-proof.json',
  'release/patch83u/patch83u-staging-multisession-before-reset.txt',
  'release/patch83u/patch83u-staging-network-console-redacted.json',
  'release/patch83u/patch83u-staging-refresh-replay-negative-proof.json',
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
  'release/patch83u/patch83u-staging-reset-final-report.md',
  'release/patch83u/patch83u-staging-reset-final-results.json',
  'release/patch83u/patch83u-staging-session-revocation-after-reset.txt',
  'release/patch83u/patch83u-staging-super-admin-reset-browser-proof.json',
  'release/patch83u/reset-proof-run-002/'
    + 'patch83u-staging-reset-final-results-attempt-003.json',
  'release/patch83u/reset-proof-run-002/'
    + 'patch83u-staging-reset-final-results-attempt-004.json',
  'release/patch83u/reset-proof-run-002/'
    + 'patch83u-staging-reset-final-results.json',
  'release/patch83u/reset-proof-run-002/README.md',
  SYNTHETIC_CHECKPOINT_MANIFEST_PATH,
  'release/patch83u/reset-proof-run-003/README.md',
  'release/patch83u/reset-proof-run-004/checkpoints/README.md',
  'release/patch83u/reset-proof-run-004/README.md',
  'release/patch83u/reset-proof-run-004/run004-reservation.json',
].sort());

const AGGREGATE_ALGORITHM =
  'SHA-256 of ordinal-path-sorted UTF-8 lines '
  + 'path<TAB>sha256<TAB>bytes joined by LF with no trailing LF';
const CREATED_AT_UNIX_MS = 1_784_213_509_236;
const UPDATED_AT_UNIX_MS = 1_784_325_647_510;
const HOSTED_EZBR_SHA256 =
  '7fee99f2d77590f48026ddb0aaec5d540403d7c85fda462aece5154492852762';
const REVIEWED_SOURCE_SHA256 =
  'f4a53ddfd0167ca62661c3c9acc6b7b320a0e43f4b96efc821308e1db73caf87';

type JsonObject = Record<string, unknown>;

function sha256(bytes: Uint8Array | string) {
  return createHash('sha256').update(bytes).digest('hex');
}

function manifestAggregate(
  files: Array<{ path: string; sha256: string; bytes: number }>,
) {
  const payload = [...files]
    .sort((left, right) => (
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0
    ))
    .map((file) => `${file.path}\t${file.sha256}\t${file.bytes}`)
    .join('\n');
  return sha256(payload);
}

function localFileManifest(path: string) {
  const bytes = readFileSync(
    path === SYNTHETIC_CHECKPOINT_MANIFEST_PATH
      ? syntheticCheckpointFixture.path
      : resolve(path),
  );
  return {
    path,
    sha256: sha256(bytes),
    bytes: bytes.length,
  };
}

function priorEvidenceManifest() {
  const files = PRIOR_EVIDENCE_PATHS.map((path) => ({
    ...localFileManifest(path),
    immutable: true,
  }));
  return {
    hash_algorithm: 'sha256',
    aggregate_algorithm: AGGREGATE_ALGORITHM,
    file_count: files.length,
    total_bytes: files.reduce((total, file) => total + file.bytes, 0),
    aggregate_sha256: manifestAggregate(files),
    files,
    run005_absence_assertions: {
      checkpoint_files_absent: true,
      attempt_output_files_absent: true,
    },
  };
}

function validFreezeFixture() {
  const frozenFiles = [{
    path: 'tests/fixtures/patch83u-freeze-contract-source.txt',
    sha256: '1'.repeat(64),
    bytes: 17,
    git_status: 'clean',
    tracked_at_head: true,
  }];
  const evidenceSchema = localFileManifest(RUN009_EVIDENCE_SCHEMA_PATH);
  const proofContract = localFileManifest(RUN009_PROOF_CONTRACT_PATH);
  const checkpointSchema = localFileManifest(RUN009_CHECKPOINT_SCHEMA_PATH);
  const traceabilityJson = localFileManifest(RUN009_TRACEABILITY_PATH);
  const traceabilityMarkdown = localFileManifest(
    RUN009_TRACEABILITY_MARKDOWN_PATH,
  );
  const proofDocument = JSON.parse(
    readFileSync(resolve(RUN009_PROOF_CONTRACT_PATH), 'utf8'),
  );
  const requirementCount = proofDocument.phases.reduce(
    (
      count: number,
      phase: { requirements: unknown[] },
    ) => count + phase.requirements.length,
    0,
  );
  return {
    $schema: './patch83u-staging-reset-execution-freeze-schema-v9.json',
    schema_version: EXECUTION_FREEZE_SCHEMA_VERSION,
    captured_at_utc: '2026-07-20T00:00:00.000Z',
    readiness_decision: EXECUTION_FREEZE_READY_DECISION,
    decision_is_execution_authorization: false,
    supersedes: {
      path:
        'release/patch83u/'
        + 'patch83u-staging-reset-execution-freeze-v8-20260721.json',
      sha256:
        '8e81321e13460a69af61104d14ce486c2a103518375447f8f44907ccd3a69bd7',
      bytes: 30_592,
      prior_authorization_reusable: false,
    },
    repository: {
      branch: 'patch83t-controlled-user-excel-import',
      head: 'a9989b1e8d95a6bb775316a2d9e709ef84514c42',
      working_tree_dirty: true,
      tracked_modified_count: 7,
      untracked_count_after_manifest_creation: 11,
      porcelain_entry_count_after_manifest_creation: 18,
      staged_file_count: 0,
    },
    targets: {
      allowed_staging_project_ref: STAGING_PROJECT_REF,
      prohibited_production_project_ref: PRODUCTION_PROJECT_REF,
      staging_supabase_origin: STAGING_SUPABASE_ORIGIN,
      application_origin: STAGING_APPLICATION_ORIGIN,
      production_accessed: false,
    },
    toolchain: {
      node: 'v24.4.1',
      npm: '11.4.2',
      playwright: '1.61.0',
      supabase_cli: '2.72.7',
      operating_system: 'Windows',
    },
    runtime_contract: {
      schema_version: EXPECTED_SCHEMA_VERSION,
      enforcement_state: 'enforced',
      state_version: 5,
      expected_edge_contract: EXPECTED_EDGE_CONTRACT,
      compatible_edge_contract: EXPECTED_EDGE_CONTRACT,
      expected_frontend_contract: EXPECTED_FRONTEND_CONTRACT,
      compatible_frontend_contract: EXPECTED_FRONTEND_CONTRACT,
      applied_migrations: [...REQUIRED_MIGRATIONS],
      finalizer: {
        name: FINALIZER_RPC,
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
        function_name: EDGE_FUNCTION_NAME,
      },
      metadata: {
        version: 5,
        status: 'ACTIVE',
        verify_jwt: true,
        hosted_ezbr_sha256: HOSTED_EZBR_SHA256,
        created_at_unix_ms: CREATED_AT_UNIX_MS,
        created_at_utc: canonicalUtcFromUnixMs(CREATED_AT_UNIX_MS),
        updated_at_unix_ms: UPDATED_AT_UNIX_MS,
        updated_at_utc: canonicalUtcFromUnixMs(UPDATED_AT_UNIX_MS),
      },
      provenance_record: {
        path:
          'release/patch83u/'
          + 'patch83u-staging-edge-v5-provenance-20260719.json',
        sha256:
          '959bcab302c4a12857005b39e2f19ff35d27a6872eb25596ce24eb80c947ca74',
        bytes: 4_495,
      },
      source: {
        downloaded: {
          sha256: REVIEWED_SOURCE_SHA256,
          bytes: 157_176,
        },
        local: {
          path: 'supabase/functions/privileged-action/index.ts',
          sha256: REVIEWED_SOURCE_SHA256,
          bytes: 157_176,
        },
        byte_identical: true,
        production_ref_absent: true,
      },
      bundle_binding: {
        raw_entrypoint_binding_proven: true,
        complete_deployment_bundle_binding_proven: false,
        hosted_hash_meaning_as_raw_source_hash_proven: false,
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
      evidence_schema_sha256: evidenceSchema.sha256,
      evidence_schema_bytes: evidenceSchema.bytes,
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
      sha256: proofContract.sha256,
      bytes: proofContract.bytes,
      schema_version: RUN009_PROOF_CONTRACT_VERSION,
      contract_id: RUN009_PROOF_CONTRACT_ID,
      requirement_count: requirementCount,
    },
    checkpoint_schema: {
      path: RUN009_CHECKPOINT_SCHEMA_PATH,
      sha256: checkpointSchema.sha256,
      bytes: checkpointSchema.bytes,
      schema_version: 'patch83u-staging-sql-editor-checkpoint-file-v3',
    },
    traceability: {
      json_path: RUN009_TRACEABILITY_PATH,
      json_sha256: traceabilityJson.sha256,
      json_bytes: traceabilityJson.bytes,
      markdown_path: RUN009_TRACEABILITY_MARKDOWN_PATH,
      markdown_sha256: traceabilityMarkdown.sha256,
      markdown_bytes: traceabilityMarkdown.bytes,
      schema_version: RUN009_TRACEABILITY_VERSION,
      requirement_count: requirementCount,
      mapped_requirement_count: requirementCount,
      coverage_percent: 100,
      complete: true,
    },
    final_session_contract: {
      checkpoint: 'after_fresh_employee_login',
      expected_session_count: EXPECTED_FINAL_SESSION_COUNT,
      expected_unrevoked_refresh_token_count:
        EXPECTED_FINAL_UNREVOKED_REFRESH_TOKEN_COUNT,
      enforcement: 'exact_integer_equality',
      cli_override_supported: false,
      justification_basis:
        'Checkpoint 5 proves zero active sessions and zero unrevoked refresh '
        + 'rows after global revocation and atomic finalization; exactly one '
        + 'fresh nonpersistent Employee login occurs before Checkpoint 6.',
    },
    frozen_source: {
      hash_algorithm: 'sha256',
      aggregate_algorithm: AGGREGATE_ALGORITHM,
      file_count: frozenFiles.length,
      total_bytes: frozenFiles.reduce((total, file) => total + file.bytes, 0),
      aggregate_sha256: manifestAggregate(frozenFiles),
      files: frozenFiles,
    },
    prior_evidence_integrity: priorEvidenceManifest(),
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
}

function cloneFixture() {
  return structuredClone(validFreezeFixture());
}

function pointerSegments(pointer: string) {
  return pointer
    .slice(1)
    .split('/')
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'));
}

function deletePointerValue(value: JsonObject, pointer: string) {
  const segments = pointerSegments(pointer);
  let parent: JsonObject = value;
  for (const segment of segments.slice(0, -1)) {
    parent = parent[segment] as JsonObject;
  }
  delete parent[segments.at(-1)!];
}

function resolveLocalSchemaRef(ref: string) {
  let node: unknown = freezeSchema;
  for (const segment of pointerSegments(ref.slice(1))) {
    node = (node as JsonObject)[segment];
  }
  return node as JsonObject;
}

function dereferenceSchema(node: JsonObject) {
  return typeof node.$ref === 'string'
    ? resolveLocalSchemaRef(node.$ref)
    : node;
}

function assertSchemaRequiresPointer(pointer: string) {
  let node = freezeSchema as JsonObject;
  for (const segment of pointerSegments(pointer)) {
    node = dereferenceSchema(node);
    expect(
      node.required,
      `${pointer}: parent schema must require ${segment}`,
    ).toContain(segment);
    const properties = node.properties as JsonObject;
    expect(
      properties,
      `${pointer}: schema must declare ${segment}`,
    ).toHaveProperty(segment);
    node = properties[segment] as JsonObject;
  }
}

function assertCompleteFreezeContract(freeze: unknown) {
  const validation = validateExecutionFreezeAgainstSchema(freeze, freezeSchema);
  if (!validation.valid) {
    throw new Error(
      `PATCH83U_TEST_FREEZE_SCHEMA_REJECTED:${validation.errors.join(',')}`,
    );
  }
  assertExecutionFreezeConsumedFields(freeze);
  assertExecutionFreezeSemanticContract(freeze);
}

function setPointerValue(value: JsonObject, pointer: string, nextValue: unknown) {
  const segments = pointerSegments(pointer);
  let parent: JsonObject = value;
  for (const segment of segments.slice(0, -1)) {
    parent = parent[segment] as JsonObject;
  }
  parent[segments.at(-1)!] = nextValue;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(() => syntheticCheckpointFixture.dispose());

describe('Patch 83U V9 execution-freeze contract', () => {
  it('accepts a complete fixture without performing a hosted call', () => {
    const hostedCall = vi.fn();
    vi.stubGlobal('fetch', hostedCall);

    expect(() => assertCompleteFreezeContract(validFreezeFixture())).not.toThrow();
    expect(hostedCall).not.toHaveBeenCalled();
  });

  it('cryptographically binds the Run 009 proof and traceability artifacts', async () => {
    const hostedCall = vi.fn();
    vi.stubGlobal('fetch', hostedCall);
    const fixture = validFreezeFixture();

    await expect(verifyRun009ContractArtifacts({
      freeze: fixture,
      repositoryRoot: process.cwd(),
    })).resolves.toMatchObject({
      passed: true,
      requirement_count: 56,
      mapped_count: 56,
      coverage_percent: 100,
    });

    const drifted = structuredClone(fixture);
    drifted.proof_contract.sha256 = '0'.repeat(64);
    await expect(verifyRun009ContractArtifacts({
      freeze: drifted,
      repositoryRoot: process.cwd(),
    })).rejects.toThrow('PATCH83U_RUN009_PROOF_CONTRACT_HASH_MISMATCH');
    expect(hostedCall).not.toHaveBeenCalled();
  });

  it('rejects any incomplete Run 009 traceability row', () => {
    const proofContract = JSON.parse(
      readFileSync(resolve(RUN009_PROOF_CONTRACT_PATH), 'utf8'),
    );
    const traceability = JSON.parse(
      readFileSync(resolve(RUN009_TRACEABILITY_PATH), 'utf8'),
    );
    expect(validateRun009ProofContract(proofContract)).toMatchObject({
      passed: true,
      phase_count: 14,
      requirement_count: 56,
    });
    expect(validateRun009Traceability(
      traceability,
      proofContract,
    )).toMatchObject({
      passed: true,
      requirement_count: 56,
      mapped_count: 56,
      coverage_percent: 100,
    });

    const incomplete = structuredClone(traceability);
    incomplete.requirements[0].unit_test = '';
    expect(() => validateRun009Traceability(
      incomplete,
      proofContract,
    )).toThrow('PATCH83U_RUN009_TRACEABILITY_TEST_MISSING');
  });

  it('declares every harness-consumed JSON pointer present and required', () => {
    const fixture = validFreezeFixture();

    expect(new Set(EXECUTION_FREEZE_CONSUMED_JSON_POINTERS).size).toBe(
      EXECUTION_FREEZE_CONSUMED_JSON_POINTERS.length,
    );
    expect(
      EXECUTION_FREEZE_CONSUMED_JSON_POINTERS.length,
    ).toBeGreaterThanOrEqual(90);
    for (const pointer of EXECUTION_FREEZE_CONSUMED_JSON_POINTERS) {
      expect(() => assertSchemaRequiresPointer(pointer)).not.toThrow();
    }
    expect(() => assertExecutionFreezeConsumedFields(fixture)).not.toThrow();
  });

  it.each(
    EXECUTION_FREEZE_CONSUMED_JSON_POINTERS.map((pointer) => [pointer]),
  )('rejects deep deletion of consumed pointer %s', (pointer) => {
    const fixture = cloneFixture() as JsonObject;
    deletePointerValue(fixture, pointer);

    expect(
      validateExecutionFreezeAgainstSchema(fixture, freezeSchema).valid,
      pointer,
    ).toBe(false);
    expect(
      () => assertExecutionFreezeConsumedFields(fixture),
    ).toThrow(`PATCH83U_EXECUTION_FREEZE_CONSUMED_FIELD_MISSING:${pointer}`);
    expect(() => assertExecutionFreezeSemanticContract(fixture)).toThrow();
  });

  it('canonicalizes the hosted millisecond timestamps exactly', () => {
    expect(canonicalUtcFromUnixMs(CREATED_AT_UNIX_MS))
      .toBe('2026-07-16T14:51:49.236Z');
    expect(canonicalUtcFromUnixMs(UPDATED_AT_UNIX_MS))
      .toBe('2026-07-17T22:00:47.510Z');
    expect(() => canonicalUtcFromUnixMs(Number.NaN))
      .toThrow('PATCH83U_EDGE_TIMESTAMP_UNIX_MS_INVALID');
  });

  it('rejects missing created and updated canonical UTC fields', () => {
    for (const pointer of [
      '/active_edge_provenance/metadata/created_at_utc',
      '/active_edge_provenance/metadata/updated_at_utc',
    ]) {
      const fixture = cloneFixture() as JsonObject;
      deletePointerValue(fixture, pointer);
      expect(
        validateExecutionFreezeAgainstSchema(fixture, freezeSchema).valid,
        pointer,
      ).toBe(false);
      expect(() => assertExecutionFreezeConsumedFields(fixture))
        .toThrow(`PATCH83U_EXECUTION_FREEZE_CONSUMED_FIELD_MISSING:${pointer}`);
    }
  });

  it.each([
    ['malformed timestamp', '2026-07-16 14:51:49Z'],
    ['noncanonical fractional precision', '2026-07-16T14:51:49.2360000Z'],
  ])('rejects a %s', (_label, timestamp) => {
    const fixture = cloneFixture() as JsonObject;
    setPointerValue(
      fixture,
      '/active_edge_provenance/metadata/created_at_utc',
      timestamp,
    );

    expect(validateExecutionFreezeAgainstSchema(fixture, freezeSchema).valid)
      .toBe(false);
    expect(() => assertExecutionFreezeSemanticContract(fixture))
      .toThrow('PATCH83U_EXECUTION_FREEZE_EDGE_TIMESTAMP_NOT_CANONICAL');
  });

  it('rejects a canonical-looking timestamp that mismatches its Unix milliseconds', () => {
    const fixture = cloneFixture() as JsonObject;
    setPointerValue(
      fixture,
      '/active_edge_provenance/metadata/created_at_utc',
      '2026-07-16T14:51:49.237Z',
    );

    expect(validateExecutionFreezeAgainstSchema(fixture, freezeSchema).valid)
      .toBe(false);
    expect(() => assertExecutionFreezeSemanticContract(fixture))
      .toThrow('PATCH83U_EXECUTION_FREEZE_EDGE_TIMESTAMP_NOT_CANONICAL');
  });

  it('rejects an unknown critical Edge provenance field', () => {
    const fixture = cloneFixture() as JsonObject;
    const provenance = fixture.active_edge_provenance as JsonObject;
    const metadata = provenance.metadata as JsonObject;
    metadata.unreviewed_deployment_identity = 'refused';

    const result = validateExecutionFreezeAgainstSchema(fixture, freezeSchema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '/active_edge_provenance/metadata/'
        + 'unreviewed_deployment_identity:additionalProperties',
    );
    expect(() => assertCompleteFreezeContract(fixture)).toThrow();
  });

  it('freeze-binds exact final fresh-login session and refresh counts', () => {
    expect(() => assertCompleteFreezeContract(validFreezeFixture())).not.toThrow();

    for (const [pointer, value] of [
      ['/final_session_contract/expected_session_count', 0],
      ['/final_session_contract/expected_session_count', 2],
      ['/final_session_contract/expected_session_count', 1.5],
      ['/final_session_contract/expected_unrevoked_refresh_token_count', 0],
      ['/final_session_contract/expected_unrevoked_refresh_token_count', 2],
      ['/final_session_contract/expected_unrevoked_refresh_token_count', '1'],
    ] as const) {
      const fixture = cloneFixture() as JsonObject;
      setPointerValue(fixture, pointer, value);
      expect(
        validateExecutionFreezeAgainstSchema(fixture, freezeSchema).valid,
        pointer,
      ).toBe(false);
      expect(() => assertExecutionFreezeSemanticContract(fixture)).toThrow(
        'PATCH83U_RUN008_CONFIRMATION_AND_FINAL_SESSION_CONTRACTS_FAILED',
      );
    }

    for (const pointer of [
      '/final_session_contract/expected_session_count',
      '/final_session_contract/expected_unrevoked_refresh_token_count',
    ]) {
      const fixture = cloneFixture() as JsonObject;
      deletePointerValue(fixture, pointer);
      expect(
        validateExecutionFreezeAgainstSchema(fixture, freezeSchema).valid,
        pointer,
      ).toBe(false);
      expect(() => assertExecutionFreezeConsumedFields(fixture)).toThrow(
        `PATCH83U_EXECUTION_FREEZE_CONSUMED_FIELD_MISSING:${pointer}`,
      );
    }
  });

  it('rejects Run 009 confirmation and final 1/1 count drift without hosted calls', () => {
    const hostedCall = vi.fn(() => {
      throw new Error('hosted call refused in unit test');
    });
    vi.stubGlobal('fetch', hostedCall);

    const confirmationDrift = cloneFixture() as JsonObject;
    setPointerValue(
      confirmationDrift,
      '/operator_confirmation_contract/exact_phrase',
      'EXECUTE RUN 005 RESET NOW',
    );
    expect(() => assertExecutionFreezeSemanticContract(
      confirmationDrift,
    )).toThrow(
      'PATCH83U_RUN008_CONFIRMATION_AND_FINAL_SESSION_CONTRACTS_FAILED',
    );

    for (const pointer of [
      '/final_session_contract/expected_session_count',
      '/final_session_contract/expected_unrevoked_refresh_token_count',
    ]) {
      const countDrift = cloneFixture() as JsonObject;
      setPointerValue(countDrift, pointer, 2);
      expect(() => assertExecutionFreezeSemanticContract(countDrift)).toThrow(
        'PATCH83U_RUN008_CONFIRMATION_AND_FINAL_SESSION_CONTRACTS_FAILED',
      );
    }
    expect(hostedCall).not.toHaveBeenCalled();
  });

  it('rejects incomplete or partially mapped Run 009 traceability', () => {
    for (const [pointer, value] of [
      ['/traceability/complete', false],
      ['/traceability/coverage_percent', 99],
      ['/traceability/mapped_requirement_count', 55],
      ['/traceability/requirement_count', 55],
    ] as const) {
      const fixture = cloneFixture() as JsonObject;
      setPointerValue(fixture, pointer, value);
      expect(
        validateExecutionFreezeAgainstSchema(fixture, freezeSchema).valid,
        pointer,
      ).toBe(false);
      expect(() => assertExecutionFreezeSemanticContract(fixture)).toThrow(
        'PATCH83U_EXECUTION_FREEZE_RUN_CONTRACT_MISMATCH',
      );
    }
  });

  it.each([
    [
      'Edge version',
      '/active_edge_provenance/metadata/version',
      6,
    ],
    [
      'Edge status',
      '/active_edge_provenance/metadata/status',
      'INACTIVE',
    ],
    [
      'Edge JWT verification',
      '/active_edge_provenance/metadata/verify_jwt',
      false,
    ],
    [
      'hosted artifact hash',
      '/active_edge_provenance/metadata/hosted_ezbr_sha256',
      '0'.repeat(64),
    ],
    [
      'downloaded/local source equality',
      '/active_edge_provenance/source/local/sha256',
      '0'.repeat(64),
    ],
    [
      'source byte-identical attestation',
      '/active_edge_provenance/source/byte_identical',
      false,
    ],
    [
      'operator confirmation phrase',
      '/operator_confirmation_contract/exact_phrase',
      'EXECUTE RUN 005 RESET NOW',
    ],
    [
      'operator confirmation contract',
      '/operator_confirmation_contract/contract_id',
      'patch83u-run005-reset-confirmation-v1',
    ],
    [
      'Run number',
      '/run_contract/run_number',
      5,
    ],
    [
      'Run evidence workspace',
      '/run_contract/evidence_directory',
      'release/patch83u/reset-proof-run-005',
    ],
    [
      'checkpoint workspace',
      '/run_contract/checkpoint_directory',
      'release/patch83u/reset-proof-run-005/checkpoints',
    ],
    [
      'output workspace pattern',
      '/run_contract/output_path_pattern',
      'release/patch83u/reset-proof-run-005/result-NNN.json',
    ],
    [
      'application workspace origin',
      '/targets/application_origin',
      'http://localhost:4173',
    ],
    [
      'repository workspace branch',
      '/repository/branch',
      'main',
    ],
  ])('rejects a %s mismatch', (_label, pointer, value) => {
    const hostedCall = vi.fn();
    vi.stubGlobal('fetch', hostedCall);
    const fixture = cloneFixture() as JsonObject;
    setPointerValue(fixture, pointer, value);

    expect(validateExecutionFreezeAgainstSchema(fixture, freezeSchema).valid)
      .toBe(false);
    expect(() => assertCompleteFreezeContract(fixture)).toThrow();
    expect(hostedCall).not.toHaveBeenCalled();
  });
});
