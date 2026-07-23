import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  ADMIN_RESET_ACTION,
  BROWSER_EVIDENCE_OPTIONS,
  CONTROLLED_EMPLOYEE_CONTEXT_LABELS,
  CONTROLLED_EMPLOYEE_REDIRECT_PAGE,
  DESIGNATED_SUPER_ADMIN_ID,
  EDGE_DEPLOYMENT_GATE_CHECK_NAMES,
  EDGE_FUNCTION_NAME,
  EDGE_PROVENANCE_CLASSIFICATION,
  EDGE_PROVENANCE_SCHEMA_VERSION,
  EXPECTED_EDGE_CONTRACT,
  EXPECTED_FRONTEND_CONTRACT,
  EXPECTED_FINAL_SESSION_COUNT,
  EXPECTED_FINAL_UNREVOKED_REFRESH_TOKEN_COUNT,
  EXPECTED_SCHEMA_VERSION,
  EXECUTION_FREEZE_READY_DECISION,
  EXECUTION_FREEZE_SCHEMA_VERSION,
  FINALIZER_RPC,
  PASSWORD_CHANGE_MAX_ATTEMPTS,
  PERMANENT_PASSWORD_POLICY_ERROR_CODE,
  PRE_CREDENTIAL_READINESS_FAILED,
  PRE_CREDENTIAL_READINESS_PASSED,
  PRODUCTION_PROJECT_REF,
  RESET_PROOF_SCHEMA_VERSION,
  ResetSubmissionController,
  RUN_NUMBER,
  RUN007_EVIDENCE_DIRECTORY,
  RUN007_EVIDENCE_SCHEMA_PATH,
  RUN007_OPERATOR_CONFIRMATION_CONTRACT_ID,
  RUN007_OUTPUT_PATH_PATTERN,
  SQL_EDITOR_CHECKPOINTS,
  SQL_EDITOR_CHECKPOINT_DIRECTORY,
  SQL_EDITOR_CHECKPOINT_FILE_NAMES,
  SQL_EDITOR_EVIDENCE_CHANNEL,
  SQL_EDITOR_EVIDENCE_MAX_AGE_MS,
  SQL_EDITOR_PROJECT_CONFIRMATION_GATE_ID,
  SecretValue,
  STAGING_AUTH_STORAGE_KEY,
  STAGING_PROJECT_REF,
  STAGING_APPLICATION_ORIGIN,
  STAGING_SUPABASE_ORIGIN,
  TARGET_EMPLOYEE_ID,
  TARGET_USER_ID,
  assertCheckpointChronology,
  assertControlledEmployeeContextProofs,
  assertDesignatedBrowserIdentities,
  assertEdgeDeploymentGate,
  assertAuditCheckpoint,
  assertEvidenceMatchesSchemaContract,
  assertFrontendProjectAttestation,
  assertFreezeBoundOperatorConfirmation,
  assertFinalFreshLoginCounts,
  assertPasswordChangeFinalizationProof,
  assertPasswordChangeFinalizationReady,
  assertRejectedRefreshReplays,
  assertResetReasonSafe,
  assertRun007FinalSessionContract,
  assertRun007OperatorConfirmationContract,
  assertRuntimeSnapshotStable,
  assertSecretSafeEvidence,
  assertSoleSuperAdminCheckpoint,
  assertSqlEditorEvidenceSnapshot,
  assertStagingConfiguration,
  assertTargetGovernanceCheckpoint,
  browserRequestIsAllowed,
  controlledEmployeeAdminRedirectIsDenied,
  classifyPasswordChangeEdgeResult,
  classifyPostResetCheckpoint,
  classifyResetEdgeResult,
  createExecutionPlan,
  evaluateControlledEmployeeContextProofs,
  evaluateStaleEmployeeContextProofs,
  evaluatePreCredentialDatabaseGates,
  evaluateReadinessGates,
  evaluateResetProgression,
  executeOneShotResetAndCollectCheckpoint,
  hashRequestId,
  inspectRequiredPasswordChangeEnvelope,
  inspectResetActionEnvelope,
  main,
  operatorGuidanceForState,
  parseCliArguments,
  prepareEdgeDeploymentGate,
  runPreCredentialReadiness,
  runBoundedPasswordPolicyAttempts,
  safeRefreshReplayResult,
  serializeRedactedEvidence,
} from '../../scripts/patch83u-staging-multisession-reset-proof.mjs';

const schema = JSON.parse(
  readFileSync(
    resolve('release/patch83u/patch83u-staging-reset-harness-schema-v8.json'),
    'utf8',
  ),
);
const harnessSource = readFileSync(
  resolve('scripts/patch83u-staging-multisession-reset-proof.mjs'),
  'utf8',
);
const evidenceSql = readFileSync(
  resolve('scripts/patch83u-staging-reset-evidence.sql'),
  'utf8',
);
const sqlEditorEvidence = readFileSync(
  resolve('scripts/patch83u-staging-sql-editor-evidence.sql'),
  'utf8',
);

if (schema.properties.schema_version.const !== RESET_PROOF_SCHEMA_VERSION) {
  throw new Error('Patch 83U reset evidence schema fixture version mismatch');
}

function readySnapshot() {
  return {
    expected_project_ref: STAGING_PROJECT_REF,
    captured_at: '2026-07-18T10:00:00.000Z',
    runtime: {
      schema_version: EXPECTED_SCHEMA_VERSION,
      enforcement_state: 'enforced',
      state_version: 5,
      edge_contract: EXPECTED_EDGE_CONTRACT,
      frontend_contract: EXPECTED_FRONTEND_CONTRACT,
      designated_super_admin_id: DESIGNATED_SUPER_ADMIN_ID,
      request_hash_function_available: true,
    },
    applied_migrations: ['174', '176', '177'],
    finalizer: {
      name: FINALIZER_RPC,
      name_bytes: 50,
      exists: true,
      routine_kind_function: true,
      destination_name_unique: true,
      old_or_truncated_name_absent: true,
      security_definer: true,
      restricted_search_path: true,
      service_role_execute_only: true,
    },
    recovery: {
      wrapper_exists: true,
      implementation_exists: true,
      standard_implementation_exists: true,
      wrapper_security_definer: true,
      wrapper_restricted_search_path: true,
      wrapper_service_role_execute_only: true,
      implementation_not_callable_by_service_role: true,
      standard_implementation_owner_only: true,
    },
    target: {
      user_id: TARGET_USER_ID,
      profile_state: 'active',
      profile_active: true,
      same_organization_as_designated_admin: true,
      credential_state: 'active',
      credential_version: 4,
      auth_credential_version: 4,
      requested_lifecycle: 'active',
      role: 'employee',
      scope: 'assigned_only',
      active_role_count: 1,
      pending_operation: false,
      pending_operation_count: 0,
      session_count: 2,
      unrevoked_refresh_token_count: 2,
    },
    admin: {
      user_id: DESIGNATED_SUPER_ADMIN_ID,
      profile_state: 'active',
      profile_active: true,
      credential_state: 'active',
      credential_version: 1,
      auth_credential_version: 1,
      role: 'super_admin',
      scope: 'global',
      active_role_count: 1,
      pending_operation: false,
      pending_operation_count: 0,
    },
    eligible_super_admin_count: 1,
  };
}

function sqlEditorSnapshot(checkpoint = SQL_EDITOR_CHECKPOINTS[0]) {
  const snapshot = readySnapshot();
  return {
    ...snapshot,
    checkpoint,
    expected_project_ref: STAGING_PROJECT_REF,
    operator_project_confirmation_required: true,
    transaction_read_only: true,
  };
}

function runtimeProof() {
  return {
    productionProjectAbsent: true,
    originalAdminContextAvailable: true,
    secondaryAdminReauthenticated: true,
    controlledEmployeeSessionCount: 2,
    controlledEmployeeRefreshValuesInMemory: true,
    employeeContextProofs: controlledEmployeeContextProofs(),
    edgeDeploymentChecks: readyEdgeDeploymentChecks(),
  };
}

function controlledEmployeeContextProofs() {
  return CONTROLLED_EMPLOYEE_CONTEXT_LABELS.map((label) => ({
    label,
    nonpersistent_context: true,
    authentication_succeeded: true,
    refresh_succeeded: true,
    permitted_employee_page_accessible: true,
    admin_route_denied: true,
    admin_redirect_destination_permitted: true,
    admin_navigation_absent: true,
    user_management_absent: true,
    access_control_absent: true,
    provisioning_controls_absent: true,
  }));
}

function staleEmployeeContextProofs() {
  return CONTROLLED_EMPLOYEE_CONTEXT_LABELS.map((label) => ({
    label,
    authenticated_user_absent: true,
    sign_in_visible: true,
    employee_content_absent: true,
    admin_content_absent: true,
    protected_route_access_denied: true,
  }));
}

function operatorConfirmationContract() {
  return {
    contract_id: RUN007_OPERATOR_CONFIRMATION_CONTRACT_ID,
    run_number: RUN_NUMBER,
    exact_phrase: `EXECUTE RUN ${String(RUN_NUMBER).padStart(3, '0')} RESET NOW`,
    case_sensitive: true,
    cli_override_supported: false,
    required_immediately_before_reset: true,
    evidence_retention: 'boolean_and_contract_id_only',
  };
}

function finalSessionContract() {
  return {
    checkpoint: 'after_fresh_employee_login',
    expected_session_count: EXPECTED_FINAL_SESSION_COUNT,
    expected_unrevoked_refresh_token_count:
      EXPECTED_FINAL_UNREVOKED_REFRESH_TOKEN_COUNT,
    enforcement: 'exact_integer_equality',
    cli_override_supported: false,
  };
}

async function armResetController(
  controller: ResetSubmissionController,
  readiness = evaluateReadinessGates(readySnapshot(), runtimeProof()),
) {
  await controller.prepareResetForm(readiness, true, vi.fn());
  controller.authorizeOperatorConfirmation(
    `EXECUTE RUN ${String(RUN_NUMBER).padStart(3, '0')} RESET NOW`,
    operatorConfirmationContract(),
  );
}

function readyEdgeDeploymentChecks() {
  return Object.fromEntries(
    EDGE_DEPLOYMENT_GATE_CHECK_NAMES.map((name) => [name, true]),
  );
}

function edgeDeploymentGateFixture() {
  const freezeFileSha256 = 'a'.repeat(64);
  const hostedArtifactSha256 = 'b'.repeat(64);
  const sourceSha256 =
    'f4a53ddfd0167ca62661c3c9acc6b7b320a0e43f4b96efc821308e1db73caf87';
  const provenanceFileSha256 = 'c'.repeat(64);
  return {
    freeze: {
      schema_version: EXECUTION_FREEZE_SCHEMA_VERSION,
      readiness_decision: EXECUTION_FREEZE_READY_DECISION,
      decision_is_execution_authorization: false,
      repository: {
        branch: 'patch83t-controlled-user-excel-import',
        head: 'a'.repeat(40),
        working_tree_dirty: true,
        tracked_modified_count: 63,
        untracked_count_after_manifest_creation: 78,
        porcelain_entry_count_after_manifest_creation: 141,
        staged_file_count: 0,
      },
      targets: {
        allowed_staging_project_ref: STAGING_PROJECT_REF,
        prohibited_production_project_ref: PRODUCTION_PROJECT_REF,
        staging_supabase_origin: STAGING_SUPABASE_ORIGIN,
        application_origin: STAGING_APPLICATION_ORIGIN,
        production_accessed: false,
      },
      runtime_contract: {
        schema_version: EXPECTED_SCHEMA_VERSION,
        enforcement_state: 'enforced',
        state_version: 5,
        expected_edge_contract: EXPECTED_EDGE_CONTRACT,
        compatible_edge_contract: EXPECTED_EDGE_CONTRACT,
        expected_frontend_contract: EXPECTED_FRONTEND_CONTRACT,
        compatible_frontend_contract: EXPECTED_FRONTEND_CONTRACT,
        applied_migrations: ['174', '176', '177'],
        finalizer: {
          name: FINALIZER_RPC,
        },
      },
      final_session_contract: finalSessionContract(),
      operator_confirmation_contract: operatorConfirmationContract(),
      active_edge_provenance: {
        identity: {
          project_ref: STAGING_PROJECT_REF,
          function_name: EDGE_FUNCTION_NAME,
        },
        metadata: {
          version: 5,
          status: 'ACTIVE',
          verify_jwt: true,
          hosted_ezbr_sha256: hostedArtifactSha256,
          created_at_unix_ms: 1784213509236,
          created_at_utc: '2026-07-16T14:51:49.236Z',
          updated_at_unix_ms: 1784325647510,
          updated_at_utc: '2026-07-17T22:00:47.510Z',
        },
        provenance_record: {
          path: 'release/patch83u/patch83u-staging-edge-v5-provenance-20260719.json',
          sha256: provenanceFileSha256,
          bytes: 4495,
        },
        source: {
          downloaded: {
            sha256: sourceSha256,
            bytes: 157176,
          },
          local: {
            path: 'supabase/functions/privileged-action/index.ts',
            sha256: sourceSha256,
            bytes: 157176,
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
        evidence_directory: RUN007_EVIDENCE_DIRECTORY,
        checkpoint_directory: SQL_EDITOR_CHECKPOINT_DIRECTORY,
        checkpoint_files: Object.values(SQL_EDITOR_CHECKPOINT_FILE_NAMES),
        output_path_pattern: RUN007_OUTPUT_PATH_PATTERN,
        exclusive_create_required: true,
        evidence_schema_path: RUN007_EVIDENCE_SCHEMA_PATH,
        evidence_schema_version: RESET_PROOF_SCHEMA_VERSION,
        frontend_mode: 'staging',
        sql_editor_project_ref_option: '--sql-editor-project-ref',
        sql_editor_project_confirmation_gate_id:
          SQL_EDITOR_PROJECT_CONFIRMATION_GATE_ID,
        precredential_no_secret_fixture_flag: '--precredential-inert-fixture',
        precredential_mode_flag: '--precredential-readiness-only',
        precredential_success_output: 'PATCH83U PRE-CREDENTIAL READINESS PASSED',
      },
    },
    freezeFileSha256,
    authorizedFreezeFileSha256: freezeFileSha256,
    freezeSchemaValidation: { valid: true, errors: [] },
    provenance: {
      schema_version: EDGE_PROVENANCE_SCHEMA_VERSION,
      classification: EDGE_PROVENANCE_CLASSIFICATION,
      scope: {
        project_ref: STAGING_PROJECT_REF,
        function_name: EDGE_FUNCTION_NAME,
        production_project_ref: PRODUCTION_PROJECT_REF,
        production_accessed: false,
        mutation_performed: false,
      },
      active_metadata: {
        version: 5,
        status: 'ACTIVE',
        verify_jwt: true,
        hosted_ezbr_sha256: hostedArtifactSha256,
        created_at_unix_ms: 1784213509236,
        updated_at_unix_ms: 1784325647510,
        created_at_utc: '2026-07-16T14:51:49.2360000Z',
        updated_at_utc: '2026-07-17T22:00:47.5100000Z',
      },
      downloaded_source: {
        sha256: sourceSha256,
        bytes: 157176,
      },
      local_source: {
        sha256: sourceSha256,
        bytes: 157176,
      },
      comparison: {
        byte_identical: true,
      },
      security_contract: {
        edge_contract: EXPECTED_EDGE_CONTRACT,
        admin_reset_action_present: true,
        required_password_change_action_present: true,
        stable_finalizer_present: true,
        runtime_enforcement_present: true,
        credential_version_checks_present: true,
        session_revocation_proof_present: true,
        service_role_environment_access_is_server_side: true,
        fail_closed_paths_present: true,
        verify_jwt_true_in_hosted_metadata: true,
        verify_jwt_true_in_local_config: true,
        deployed_secret_value_patterns_absent: true,
        required_markers_pass: true,
        production_ref_absent: true,
      },
    },
    provenanceFileSha256,
    provenanceFileBytes: 4495,
    observedMetadata: {
      project_ref: STAGING_PROJECT_REF,
      function_name: EDGE_FUNCTION_NAME,
      version: 5,
      status: 'ACTIVE',
      verify_jwt: true,
      ezbr_sha256: hostedArtifactSha256,
      created_at_unix_ms: 1784213509236,
      created_at_utc: '2026-07-16T14:51:49.236Z',
      updated_at_unix_ms: 1784325647510,
      updated_at_utc: '2026-07-17T22:00:47.510Z',
    },
    observedDownloadedSource: {
      sha256: sourceSha256,
      bytes: 157176,
      production_ref_absent: true,
    },
    localSource: {
      sha256: sourceSha256,
      bytes: 157176,
    },
    frozenSourceVerification: {
      inventory_shape_exact: true,
      inventory_files_exact: true,
      inventory_aggregate_exact: true,
    },
    priorEvidenceVerification: {
      inventory_shape_exact: true,
      inventory_files_exact: true,
      inventory_aggregate_exact: true,
      run005_absence_exact: true,
    },
    evidenceSchemaVerification: {
      exact: true,
    },
    run007ContractVerification: {
      passed: true,
      requirement_count: 56,
      mapped_count: 56,
      coverage_percent: 100,
    },
    repositoryState: {
      branch: 'patch83t-controlled-user-excel-import',
      head: 'a'.repeat(40),
      working_tree_dirty: true,
      tracked_modified_count: 63,
      untracked_count: 78,
      porcelain_entry_count: 141,
      staged_file_count: 0,
    },
  };
}

function minimalEvidence() {
  return {
    schema_version: RESET_PROOF_SCHEMA_VERSION,
    generated_at: '2026-07-18T10:00:00.000Z',
    execution_status: 'readiness_failed',
    project_ref: STAGING_PROJECT_REF,
    subject_user_id: TARGET_USER_ID,
    request_id_hash: null,
    checkpoint_inputs: [],
    events: [],
    operator_guidance: [],
  };
}

function completedAfterResetSnapshot(requestIdHash: string) {
  const snapshot = readySnapshot();
  snapshot.target.credential_state = 'admin_reset_change_required';
  snapshot.target.credential_version = 5;
  snapshot.target.auth_credential_version = 5;
  snapshot.target.pending_operation = false;
  snapshot.target.pending_operation_count = 0;
  snapshot.target.session_count = 0;
  snapshot.target.unrevoked_refresh_token_count = 0;
  return {
    ...snapshot,
    audit: {
      credential_event_count: 1,
      latest_event_type: 'admin_reset_completed',
      latest_event_code: 'PATCH83U_ADMIN_RESET_COMPLETED',
      latest_event_credential_version: 5,
      latest_event_request_id_hash: requestIdHash,
      latest_event_at: '2026-07-18T10:00:00.000Z',
      operation_count: 1,
      latest_operation_type: 'admin_reset',
      latest_operation_status: 'completed',
      latest_operation_current_version: 4,
      latest_operation_next_version: 5,
      latest_operation_resulting_state: 'admin_reset_change_required',
      latest_operation_auth_changed: true,
      latest_operation_revocation_confirmed: true,
      latest_operation_request_id_hash: requestIdHash,
      latest_operation_completed_at: '2026-07-18T10:00:00.000Z',
    },
  };
}

describe('Patch 83U staging multi-session reset proof harness', () => {
  let blockedNetworkFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    blockedNetworkFetch = vi.fn(async () => {
      throw new Error('PATCH83U_UNIT_TEST_NETWORK_REFUSED');
    });
    vi.stubGlobal('fetch', blockedNetworkFetch);
  });

  afterEach(() => {
    expect(blockedNetworkFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('immediately refuses the production project reference', () => {
    expect(() => assertStagingConfiguration({
      project_ref: STAGING_PROJECT_REF,
      supabase_url: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
    })).toThrow(/PATCH83U_PRODUCTION_TARGET_REFUSED/);
  });

  it('requires every Supabase URL to be the staging project', () => {
    expect(() => assertStagingConfiguration({
      project_ref: STAGING_PROJECT_REF,
      supabase_url: 'https://another-project.supabase.co',
    })).toThrow(/PATCH83U_NON_STAGING_SUPABASE_URL_REFUSED/);
  });

  it('requires the exact canonical staging Supabase origin', () => {
    for (const value of [
      `http://${STAGING_PROJECT_REF}.supabase.co`,
      `https://${STAGING_PROJECT_REF}.attacker.invalid`,
      `https://${STAGING_PROJECT_REF}.extra.supabase.co`,
      `${STAGING_SUPABASE_ORIGIN}:444`,
      `${STAGING_SUPABASE_ORIGIN}/unexpected`,
      `${STAGING_SUPABASE_ORIGIN}?unexpected=1`,
    ]) {
      expect(() => assertStagingConfiguration({
        project_ref: STAGING_PROJECT_REF,
        supabase_url: value,
        app_url: STAGING_APPLICATION_ORIGIN,
      })).toThrow(/PATCH83U_NON_STAGING_SUPABASE_URL_REFUSED/);
    }
    expect(assertStagingConfiguration({
      project_ref: STAGING_PROJECT_REF,
      supabase_url: STAGING_SUPABASE_ORIGIN,
      app_url: STAGING_APPLICATION_ORIGIN,
    })).toBe(true);
  });

  it('allows browser traffic only to the local app, exact staging API, and Turnstile', () => {
    expect(browserRequestIsAllowed(`${STAGING_APPLICATION_ORIGIN}/src/main.tsx`)).toBe(true);
    expect(browserRequestIsAllowed(`${STAGING_SUPABASE_ORIGIN}/auth/v1/user`)).toBe(true);
    expect(browserRequestIsAllowed('https://challenges.cloudflare.com/turnstile/v0/api.js')).toBe(true);
    expect(browserRequestIsAllowed(`https://${PRODUCTION_PROJECT_REF}.supabase.co/auth/v1/user`)).toBe(false);
    expect(browserRequestIsAllowed(`https://${STAGING_PROJECT_REF}.attacker.invalid/auth/v1/token`)).toBe(false);
  });

  it('requires the exact local staging application origin', () => {
    expect(assertStagingConfiguration({
      project_ref: STAGING_PROJECT_REF,
      supabase_url: `https://${STAGING_PROJECT_REF}.supabase.co`,
      app_url: STAGING_APPLICATION_ORIGIN,
    })).toBe(true);
    expect(() => assertStagingConfiguration({
      project_ref: STAGING_PROJECT_REF,
      supabase_url: `https://${STAGING_PROJECT_REF}.supabase.co`,
      app_url: 'http://127.0.0.1:5173',
    })).toThrow(/PATCH83U_NON_STAGING_APPLICATION_ORIGIN_REFUSED/);
  });

  it('accepts active Edge version 5 only with the exact frozen metadata and source', () => {
    const result = assertEdgeDeploymentGate(edgeDeploymentGateFixture());
    expect(result).toMatchObject({
      passed: true,
      failed: [],
    });
    expect(Object.keys(result.checks).sort()).toEqual(
      [...EDGE_DEPLOYMENT_GATE_CHECK_NAMES].sort(),
    );
  });

  it.each([3, 6, 'unknown'])(
    'rejects active Edge version drift to %s',
    (version) => {
      const fixture = edgeDeploymentGateFixture();
      fixture.observedMetadata.version = version as number;
      expect(() => assertEdgeDeploymentGate(fixture)).toThrow(
        /PATCH83U_EDGE_VERSION_MISMATCH/,
      );
    },
  );

  it('rejects matching Edge metadata when the current source hash differs', () => {
    const fixture = edgeDeploymentGateFixture();
    fixture.localSource.sha256 = 'd'.repeat(64);
    expect(() => assertEdgeDeploymentGate(fixture)).toThrow(
      /PATCH83U_EDGE_SOURCE_HASH_MISMATCH/,
    );
  });

  it('rejects active Edge metadata when JWT verification is disabled', () => {
    const fixture = edgeDeploymentGateFixture();
    fixture.observedMetadata.verify_jwt = false;
    expect(() => assertEdgeDeploymentGate(fixture)).toThrow(
      /PATCH83U_EDGE_VERIFY_JWT_REQUIRED/,
    );
  });

  it('rejects inactive status, artifact drift, contract drift, and freeze-hash drift', () => {
    const inactive = edgeDeploymentGateFixture();
    inactive.observedMetadata.status = 'INACTIVE';
    expect(() => assertEdgeDeploymentGate(inactive)).toThrow(
      /PATCH83U_EDGE_STATUS_NOT_ACTIVE/,
    );

    const artifactDrift = edgeDeploymentGateFixture();
    artifactDrift.observedMetadata.ezbr_sha256 = 'e'.repeat(64);
    expect(() => assertEdgeDeploymentGate(artifactDrift)).toThrow(
      /PATCH83U_EDGE_ARTIFACT_HASH_MISMATCH/,
    );

    const contractDrift = edgeDeploymentGateFixture();
    contractDrift.freeze.runtime_contract.expected_edge_contract = 'unexpected';
    expect(() => assertEdgeDeploymentGate(contractDrift)).toThrow(
      /PATCH83U_EDGE_CONTRACT_MISMATCH/,
    );

    const freezeHashDrift = edgeDeploymentGateFixture();
    freezeHashDrift.authorizedFreezeFileSha256 = 'f'.repeat(64);
    expect(() => assertEdgeDeploymentGate(freezeHashDrift)).toThrow(
      /PATCH83U_EXECUTION_FREEZE_HASH_MISMATCH/,
    );
  });

  it('rejects a non-ready freeze, repository drift, and frozen source drift', () => {
    const notReady = edgeDeploymentGateFixture();
    notReady.freeze.readiness_decision = 'NOT READY FOR HOSTED EXECUTION';
    expect(() => assertEdgeDeploymentGate(notReady)).toThrow(
      /PATCH83U_EXECUTION_FREEZE_NOT_READY/,
    );

    const repositoryDrift = edgeDeploymentGateFixture();
    repositoryDrift.repositoryState.head = 'b'.repeat(40);
    expect(() => assertEdgeDeploymentGate(repositoryDrift)).toThrow(
      /PATCH83U_EXECUTION_REPOSITORY_STATE_MISMATCH/,
    );

    const fileDrift = edgeDeploymentGateFixture();
    fileDrift.frozenSourceVerification.inventory_files_exact = false;
    expect(() => assertEdgeDeploymentGate(fileDrift)).toThrow(
      /PATCH83U_FROZEN_SOURCE_FILE_MISMATCH/,
    );

    const aggregateDrift = edgeDeploymentGateFixture();
    aggregateDrift.frozenSourceVerification.inventory_aggregate_exact = false;
    expect(() => assertEdgeDeploymentGate(aggregateDrift)).toThrow(
      /PATCH83U_FROZEN_SOURCE_AGGREGATE_MISMATCH/,
    );
  });

  it('cross-binds provenance identity, metadata, and security markers', () => {
    const wrongSchema = edgeDeploymentGateFixture();
    wrongSchema.provenance.schema_version = 'unexpected';
    expect(() => assertEdgeDeploymentGate(wrongSchema)).toThrow(
      /PATCH83U_EDGE_PROVENANCE_IDENTITY_MISMATCH/,
    );

    const wrongVersion = edgeDeploymentGateFixture();
    wrongVersion.provenance.active_metadata.version = 4;
    expect(() => assertEdgeDeploymentGate(wrongVersion)).toThrow(
      /PATCH83U_EDGE_PROVENANCE_METADATA_MISMATCH/,
    );

    const wrongStatus = edgeDeploymentGateFixture();
    wrongStatus.provenance.active_metadata.status = 'INACTIVE';
    expect(() => assertEdgeDeploymentGate(wrongStatus)).toThrow(
      /PATCH83U_EDGE_PROVENANCE_METADATA_MISMATCH/,
    );

    const wrongJwt = edgeDeploymentGateFixture();
    wrongJwt.provenance.active_metadata.verify_jwt = false;
    expect(() => assertEdgeDeploymentGate(wrongJwt)).toThrow(
      /PATCH83U_EDGE_PROVENANCE_METADATA_MISMATCH/,
    );

    const liveTimestampDrift = edgeDeploymentGateFixture();
    liveTimestampDrift.observedMetadata.updated_at_unix_ms += 1;
    expect(() => assertEdgeDeploymentGate(liveTimestampDrift)).toThrow(
      /PATCH83U_EDGE_PROVENANCE_METADATA_MISMATCH/,
    );

    const weakenedMarker = edgeDeploymentGateFixture();
    weakenedMarker.provenance.security_contract.runtime_enforcement_present = false;
    expect(() => assertEdgeDeploymentGate(weakenedMarker)).toThrow(
      /PATCH83U_EDGE_SOURCE_SECURITY_MARKERS_MISMATCH/,
    );
  });

  it('prepares the full gate through injected local-only adapters', async () => {
    const fixture = edgeDeploymentGateFixture();
    const {
      observedMetadata,
      observedDownloadedSource,
      ...artifactInputs
    } = fixture;
    const loadEdgeGateArtifacts = vi.fn().mockResolvedValue(artifactInputs);
    const readActiveEdgeMetadata = vi.fn().mockResolvedValue(observedMetadata);
    const downloadActiveEdgeSource = vi.fn().mockResolvedValue(
      observedDownloadedSource,
    );

    const result = await prepareEdgeDeploymentGate({
      executionFreeze: 'not-read-by-the-injected-test-adapter',
      executionFreezeSha256: fixture.authorizedFreezeFileSha256,
      sqlEditorProjectRef: STAGING_PROJECT_REF,
      supabaseUrl: STAGING_SUPABASE_ORIGIN,
    }, {
      loadEdgeGateArtifacts,
      readActiveEdgeMetadata,
      downloadActiveEdgeSource,
    });

    expect(result.passed).toBe(true);
    expect(result.operatorConfirmationContract).toEqual(
      operatorConfirmationContract(),
    );
    expect(result.finalSessionContract).toEqual(finalSessionContract());
    expect(loadEdgeGateArtifacts).toHaveBeenCalledTimes(1);
    expect(readActiveEdgeMetadata).toHaveBeenCalledWith({
      projectRef: STAGING_PROJECT_REF,
      functionName: EDGE_FUNCTION_NAME,
    });
    expect(downloadActiveEdgeSource).toHaveBeenCalledWith({
      projectRef: STAGING_PROJECT_REF,
      functionName: EDGE_FUNCTION_NAME,
    });
  });

  it('requires every Edge deployment predicate in readiness', () => {
    const checks = readyEdgeDeploymentChecks();
    checks.edge_provenance_identity_exact = false;
    const result = evaluateReadinessGates(readySnapshot(), {
      ...runtimeProof(),
      edgeDeploymentChecks: checks,
    });
    expect(result.passed).toBe(false);
    expect(result.failed).toContain('edge_provenance_identity_exact');
  });

  it('blocks readiness when the Run 007 proof contract is incomplete', () => {
    const fixture = edgeDeploymentGateFixture();
    fixture.run007ContractVerification.mapped_count = 55;
    expect(() => assertEdgeDeploymentGate(fixture)).toThrow(
      /PATCH83U_RUN007_PROOF_CONTRACT_INCOMPLETE/,
    );
  });

  it('binds the exact Run 007 operator phrase to the verified freeze', () => {
    const contract = assertRun007OperatorConfirmationContract(
      operatorConfirmationContract(),
    );
    expect(assertFreezeBoundOperatorConfirmation(
      'EXECUTE RUN 009 RESET NOW',
      contract,
    )).toEqual({
      contract_id: RUN007_OPERATOR_CONFIRMATION_CONTRACT_ID,
      exact_match: true,
    });
    for (const refused of [
      `${STAGING_PROJECT_REF}:${TARGET_EMPLOYEE_ID}:${ADMIN_RESET_ACTION}`,
      'EXECUTE RUN 003 RESET NOW',
      'EXECUTE RUN 004 RESET NOW',
      'EXECUTE RUN 005 RESET NOW',
      'EXECUTE RUN 006 RESET NOW',
      'execute run 007 reset now',
      'EXECUTE RUN 009 RESET NOW ',
    ]) {
      expect(() => assertFreezeBoundOperatorConfirmation(
        refused,
        contract,
      )).toThrow(/PATCH83U_EXACT_RESET_CONFIRMATION_FAILED/);
    }

    const drifted = edgeDeploymentGateFixture();
    drifted.freeze.operator_confirmation_contract.exact_phrase =
      'EXECUTE RUN 005 RESET NOW';
    expect(() => assertEdgeDeploymentGate(drifted)).toThrow(
      /PATCH83U_RUN007_OPERATOR_CONFIRMATION_CONTRACT_INVALID/,
    );
  });

  it('does not accept an operator-controlled Edge version override', () => {
    expect(() => parseCliArguments(['--edge-version', '5'])).toThrow(
      /PATCH83U_UNKNOWN_ARGUMENT_REFUSED/,
    );
    expect(() => parseCliArguments([
      '--operator-confirmation',
      'EXECUTE RUN 009 RESET NOW',
    ])).toThrow(/PATCH83U_UNKNOWN_ARGUMENT_REFUSED/);
  });

  it('reasserts the browser target guard immediately before reset readiness', () => {
    expect(harnessSource).toContain(
      "assertPreResetCheckpointAggregate({\n      referenceSnapshot: initialSnapshot,\n      snapshot: preResetSnapshot,\n    });\n    assertBrowserTargetGuard(targetGuard);",
    );
    expect(harnessSource).toContain(
      'productionProjectAbsent: targetGuard.violation === null',
    );
  });

  it('refuses credential entry unless the loaded frontend proves staging', () => {
    expect(() => assertFrontendProjectAttestation({
      applicationOriginMatches: true,
      stagingProjectPresent: false,
      productionProjectPresent: true,
    })).toThrow(/PATCH83U_PRODUCTION_FRONTEND_BUNDLE_REFUSED/);
    expect(() => assertFrontendProjectAttestation({
      applicationOriginMatches: true,
      stagingProjectPresent: false,
      productionProjectPresent: false,
    })).toThrow(/PATCH83U_STAGING_FRONTEND_PROJECT_NOT_PROVEN/);
    expect(assertFrontendProjectAttestation({
      applicationOriginMatches: true,
      stagingProjectPresent: true,
      productionProjectPresent: false,
    })).toBe(true);
  });

  it('recursively rejects prohibited evidence key names', () => {
    expect(() => assertSecretSafeEvidence({
      safe: { nested: { authorization_header: 'redacted' } },
    })).toThrow(/PATCH83U_PROHIBITED_EVIDENCE_KEY/);
    expect(() => assertSecretSafeEvidence({
      safe: [{ refresh_token: 'redacted' }],
    })).toThrow(/PATCH83U_PROHIBITED_EVIDENCE_KEY/);
  });

  it('never serializes known secrets or token-shaped values', () => {
    const known = 'not-a-real-secret-value';
    expect(() => serializeRedactedEvidence(
      { safe_error_code: `failed:${known}` },
      { knownSecrets: [known] },
    )).toThrow(/PATCH83U_KNOWN_SECRET_REFUSED/);
    expect(() => serializeRedactedEvidence({
      safe_error_code: 'Bearer abcdefghijklmnopqrstuvwxyz',
    })).toThrow(/PATCH83U_SECRET_SHAPED_VALUE_REFUSED/);
  });

  it('accepts only exact, chronological staging SQL Editor snapshots', () => {
    const now = Date.parse('2026-07-18T10:02:00.000Z');
    const first = sqlEditorSnapshot('before_employee_sessions');
    const second = {
      ...sqlEditorSnapshot('immediately_before_reset'),
      captured_at: '2026-07-18T10:01:00.000Z',
    };
    expect(assertSqlEditorEvidenceSnapshot(
      first,
      'before_employee_sessions',
      STAGING_PROJECT_REF,
      now,
    )).toMatchObject({
      ...first,
      project_ref: STAGING_PROJECT_REF,
      database_target_verified_by_operator: true,
    });
    expect(assertCheckpointChronology(first, second)).toBe(true);

    expect(() => assertSqlEditorEvidenceSnapshot({
      ...first,
      transaction_read_only: false,
    }, 'before_employee_sessions', STAGING_PROJECT_REF, now)).toThrow(
      /PATCH83U_SQL_EDITOR_EVIDENCE_GATE_FAILED/,
    );
    expect(() => assertSqlEditorEvidenceSnapshot({
      ...first,
      unexpected_ref: PRODUCTION_PROJECT_REF,
    }, 'before_employee_sessions', STAGING_PROJECT_REF, now)).toThrow(
      /PATCH83U_PRODUCTION_SQL_EDITOR_EVIDENCE_REFUSED/,
    );
    expect(() => assertSqlEditorEvidenceSnapshot(
      first,
      'before_employee_sessions',
      PRODUCTION_PROJECT_REF,
      now,
    )).toThrow(/PATCH83U_PRODUCTION_SQL_EDITOR_TARGET_REFUSED/);
    expect(() => assertSqlEditorEvidenceSnapshot({
      ...first,
      captured_at: new Date(now - SQL_EDITOR_EVIDENCE_MAX_AGE_MS - 1).toISOString(),
    }, 'before_employee_sessions', STAGING_PROJECT_REF, now)).toThrow(
      /PATCH83U_SQL_EDITOR_EVIDENCE_NOT_FRESH/,
    );
    expect(() => assertSqlEditorEvidenceSnapshot({
      ...first,
      captured_at: new Date(now + 31_000).toISOString(),
    }, 'before_employee_sessions', STAGING_PROJECT_REF, now)).toThrow(
      /PATCH83U_SQL_EDITOR_EVIDENCE_NOT_FRESH/,
    );
    expect(() => assertCheckpointChronology(second, first)).toThrow(
      /PATCH83U_SQL_EDITOR_EVIDENCE_CHRONOLOGY_FAILED/,
    );
  });

  it('refuses secret-bearing command-line arguments', () => {
    expect(() => parseCliArguments(['--password=forbidden'])).toThrow(
      /PATCH83U_SECRET_COMMAND_LINE_ARGUMENT_REFUSED/,
    );
    expect(() => parseCliArguments(['--service-role-key', 'forbidden'])).toThrow(
      /PATCH83U_SECRET_COMMAND_LINE_ARGUMENT_REFUSED/,
    );
    const accidentalValue = 'standalone-sensitive-value';
    expect(() => parseCliArguments([accidentalValue])).toThrow(
      /^PATCH83U_UNKNOWN_ARGUMENT_REFUSED$/,
    );
    try {
      parseCliArguments([accidentalValue]);
    } catch (error) {
      expect(String(error)).not.toContain(accidentalValue);
    }
  });

  it('rejects a reset reason containing any entered credential', () => {
    const secret = new SecretValue('example-sensitive-value');
    try {
      expect(() => assertResetReasonSafe(
        'controlled proof example-sensitive-value',
        [secret],
      )).toThrow(/PATCH83U_RESET_REASON_CONTAINS_CREDENTIAL/);
    } finally {
      secret.clear();
    }
  });

  it('defines nonpersistent browser evidence settings and no capture facilities', () => {
    expect(BROWSER_EVIDENCE_OPTIONS).toEqual({
      recordHar: undefined,
      recordVideo: undefined,
      storageState: undefined,
      trace: false,
      automaticScreenshots: false,
      verboseNetworkLogging: false,
    });
    expect(harnessSource).not.toContain('tracing.start');
    expect(harnessSource).not.toContain('.screenshot(');
    expect(harnessSource).not.toContain('storageState(');
  });

  it('blocks reset until every readiness gate passes', async () => {
    const submitter = vi.fn();
    const controller = new ResetSubmissionController();
    const failed = evaluateReadinessGates(readySnapshot(), {
      ...runtimeProof(),
      secondaryAdminReauthenticated: false,
    });
    await expect(controller.submit(failed, submitter)).rejects.toThrow(
      /PATCH83U_RESET_READINESS_GATES_FAILED/,
    );
    expect(submitter).not.toHaveBeenCalled();
  });

  it('cannot populate the reset form before Checkpoint 2 readiness and browser validation', async () => {
    const controller = new ResetSubmissionController();
    const interactor = vi.fn();
    const failed = evaluateReadinessGates(readySnapshot(), {
      ...runtimeProof(),
      secondaryAdminReauthenticated: false,
    });
    await expect(controller.prepareResetForm(
      failed,
      true,
      interactor,
    )).rejects.toThrow(/PATCH83U_RESET_READINESS_GATES_FAILED/);
    expect(interactor).not.toHaveBeenCalled();

    const ready = evaluateReadinessGates(readySnapshot(), runtimeProof());
    await expect(controller.prepareResetForm(
      ready,
      false,
      interactor,
    )).rejects.toThrow(/PATCH83U_RESET_BROWSER_TARGET_NOT_VALIDATED/);
    expect(interactor).not.toHaveBeenCalled();
  });

  it('cannot submit before reset-form preparation and exact Run 007 confirmation', async () => {
    const readiness = evaluateReadinessGates(readySnapshot(), runtimeProof());
    const submitter = vi.fn();
    const controller = new ResetSubmissionController();
    await expect(controller.submit(readiness, submitter)).rejects.toThrow(
      /PATCH83U_RESET_FORM_NOT_PREPARED/,
    );
    await controller.prepareResetForm(readiness, true, vi.fn());
    await expect(controller.submit(readiness, submitter)).rejects.toThrow(
      /PATCH83U_RUN007_OPERATOR_CONFIRMATION_REQUIRED/,
    );
    expect(() => controller.authorizeOperatorConfirmation(
      'EXECUTE RUN 003 RESET NOW',
      operatorConfirmationContract(),
    )).toThrow(/PATCH83U_EXACT_RESET_CONFIRMATION_FAILED/);
    expect(submitter).not.toHaveBeenCalled();
  });

  it('orders Checkpoint 2 and every full gate before reset-modal interaction', () => {
    const checkpointIndex = harnessSource.indexOf(
      "readCheckpoint('immediately_before_reset')",
    );
    const checkpointGateIndex = harnessSource.indexOf(
      'assertCheckpointFilesReadyForReset(checkpointState)',
    );
    const edgeGateIndex = harnessSource.indexOf(
      'const preResetEdgeDeploymentGate = await prepareEdgeDeploymentGate',
    );
    const readinessIndex = harnessSource.indexOf(
      'const readiness = evaluateReadinessGates(preResetSnapshot',
    );
    const resetRouteGuardIndex = harnessSource.indexOf(
      "await adminPage.route('**/functions/v1/privileged-action', resetRequestGuard)",
      readinessIndex,
    );
    const formGateIndex = harnessSource.indexOf(
      'await controller.prepareResetForm(',
    );
    const targetRowIndex = harnessSource.indexOf(
      "adminPage.getByRole('row').filter({ hasText: TARGET_EMPLOYEE_ID })",
    );
    const sensitiveFillIndex = harnessSource.indexOf(
      ".getByLabel('Temporary password', { exact: true })",
    );
    const operatorPromptIndex = harnessSource.indexOf(
      'const exactConfirmation = await promptHidden(',
      formGateIndex,
    );
    const submitIndex = harnessSource.indexOf(
      'executeOneShotResetAndCollectCheckpoint({',
      formGateIndex,
    );
    const postSubmissionCleanupIndex = harnessSource.indexOf(
      'afterSubmissionAttempt: async () => {',
      submitIndex,
    );
    const checkpoint3Index = harnessSource.indexOf(
      "readCheckpoint3: () => readCheckpoint('immediately_after_reset')",
      postSubmissionCleanupIndex,
    );
    const routeCleanupIndex = harnessSource.indexOf(
      'if (resetRouteInstalled) {',
      checkpoint3Index,
    );
    expect(checkpointIndex).toBeGreaterThan(0);
    expect(checkpointIndex).toBeLessThan(checkpointGateIndex);
    expect(checkpointGateIndex).toBeLessThan(edgeGateIndex);
    expect(edgeGateIndex).toBeLessThan(readinessIndex);
    expect(readinessIndex).toBeLessThan(resetRouteGuardIndex);
    expect(resetRouteGuardIndex).toBeLessThan(formGateIndex);
    expect(formGateIndex).toBeLessThan(targetRowIndex);
    expect(targetRowIndex).toBeLessThan(sensitiveFillIndex);
    expect(sensitiveFillIndex).toBeLessThan(operatorPromptIndex);
    expect(operatorPromptIndex).toBeLessThan(submitIndex);
    expect(submitIndex).toBeLessThan(postSubmissionCleanupIndex);
    expect(postSubmissionCleanupIndex).toBeLessThan(checkpoint3Index);
    expect(checkpoint3Index).toBeLessThan(routeCleanupIndex);
    expect(
      harnessSource.slice(postSubmissionCleanupIndex, checkpoint3Index),
    ).not.toContain('.unroute(');
  });

  it('allows one reset submission and refuses a second', async () => {
    const readiness = evaluateReadinessGates(readySnapshot(), runtimeProof());
    const controller = new ResetSubmissionController();
    await armResetController(controller, readiness);
    const submitter = vi.fn().mockImplementation(async () => {
      controller.observeRequestId('patch83u:admin-reset:test-once');
      return { ok: true };
    });
    await expect(controller.submit(readiness, submitter)).resolves.toEqual({ ok: true });
    await expect(controller.submit(readiness, submitter)).rejects.toThrow(
      /PATCH83U_RESET_RETRY_REFUSED/,
    );
    expect(submitter).toHaveBeenCalledTimes(1);
  });

  it('locks an ambiguous submission and keeps the request correlation stable', async () => {
    const readiness = evaluateReadinessGates(readySnapshot(), runtimeProof());
    const requestId = 'patch83u:admin-reset:stable-correlation';
    const controller = new ResetSubmissionController();
    await armResetController(controller, readiness);
    let originalHash: string | null = null;
    await expect(controller.submit(readiness, async () => {
      originalHash = controller.observeRequestId(requestId);
      throw new Error('timeout');
    })).rejects.toThrow('timeout');
    expect(controller.requestIdHash).toBe(originalHash);
    expect(originalHash).toBe(hashRequestId(requestId));
    await expect(controller.submit(readiness, vi.fn())).rejects.toThrow(
      /PATCH83U_RESET_RETRY_REFUSED/,
    );
    expect(() => controller.observeRequestId('patch83u:admin-reset:different')).toThrow(
      /PATCH83U_RESET_REQUEST_ID_CHANGED/,
    );
  });

  it('collects Checkpoint 3 after an ambiguous reset and never permits a second reset', async () => {
    const readiness = evaluateReadinessGates(readySnapshot(), runtimeProof());
    const controller = new ResetSubmissionController();
    await armResetController(controller, readiness);
    const requestId = 'patch83u-run007-ambiguous-reset';
    const requestIdHash = hashRequestId(requestId);
    const readCheckpoint3 = vi.fn().mockResolvedValue(
      completedAfterResetSnapshot(requestIdHash),
    );
    const result = await executeOneShotResetAndCollectCheckpoint({
      controller,
      readiness,
      submitter: async () => {
        controller.observeRequestId(requestId);
        throw new Error('timeout');
      },
      inspectEdgeResponse: vi.fn(),
      afterSubmissionAttempt: vi.fn(),
      readCheckpoint3,
      classifyCheckpoint3: (snapshot) => classifyPostResetCheckpoint(snapshot, {
        referenceSnapshot: readySnapshot(),
        requestIdHash: controller.requestIdHash,
      }),
    });
    expect(readCheckpoint3).toHaveBeenCalledOnce();
    expect(result.checkpointOutcome).toMatchObject({
      classification: 'admin_reset_change_required',
      protected_transition_completed: true,
      expected_success: true,
    });
    expect(result.edgeOutcome.confirmed_success).toBe(false);
    expect(result.progression.allowed).toBe(false);
    expect(controller.requestIdHash).toBe(requestIdHash);
    await expect(controller.submit(readiness, vi.fn())).rejects.toThrow(
      /PATCH83U_RESET_RETRY_REFUSED/,
    );
  });

  it('still collects Checkpoint 3 when post-submission cleanup fails', async () => {
    const readiness = evaluateReadinessGates(readySnapshot(), runtimeProof());
    const controller = new ResetSubmissionController();
    await armResetController(controller, readiness);
    const requestId = 'patch83u-run007-cleanup-ambiguous-reset';
    const requestIdHash = hashRequestId(requestId);
    const readCheckpoint3 = vi.fn().mockResolvedValue(
      completedAfterResetSnapshot(requestIdHash),
    );
    const result = await executeOneShotResetAndCollectCheckpoint({
      controller,
      readiness,
      submitter: async () => {
        controller.observeRequestId(requestId);
        throw new Error('timeout');
      },
      inspectEdgeResponse: vi.fn(),
      afterSubmissionAttempt: vi.fn().mockRejectedValue(
        new Error('safe local cleanup failure'),
      ),
      readCheckpoint3,
      classifyCheckpoint3: (snapshot) => classifyPostResetCheckpoint(snapshot, {
        referenceSnapshot: readySnapshot(),
        requestIdHash: controller.requestIdHash,
      }),
    });
    expect(readCheckpoint3).toHaveBeenCalledOnce();
    expect(result.postSubmissionCleanupSucceeded).toBe(false);
    expect(result.checkpointOutcome).toMatchObject({
      classification: 'admin_reset_change_required',
      protected_transition_completed: true,
    });
    expect(result.progression.allowed).toBe(false);
    await expect(controller.submit(readiness, vi.fn())).rejects.toThrow(
      /PATCH83U_RESET_RETRY_REFUSED/,
    );
  });

  it('allows progression only when both the Edge result and Checkpoint 3 are exact', async () => {
    const readiness = evaluateReadinessGates(readySnapshot(), runtimeProof());
    const controller = new ResetSubmissionController();
    await armResetController(controller, readiness);
    const requestId = 'patch83u-run007-exact-reset';
    const requestIdHash = hashRequestId(requestId);
    const response = { marker: 'safe-mock-response' };
    const result = await executeOneShotResetAndCollectCheckpoint({
      controller,
      readiness,
      submitter: async () => {
        controller.observeRequestId(requestId);
        return response;
      },
      inspectEdgeResponse: vi.fn().mockResolvedValue(classifyResetEdgeResult({
        ok: true,
        httpStatus: 200,
        requestIdHash,
        body: {
          ok: true,
          action: ADMIN_RESET_ACTION,
          result: {
            userId: TARGET_USER_ID,
            requestId,
            status: 'admin_reset_change_required',
            credentialVersion: 5,
            mustChangePassword: true,
            mustReauthenticate: true,
            reconciliationRequired: false,
            sessionRevocationReviewRequired: false,
            idempotentReplay: false,
          },
        },
      })),
      readCheckpoint3: vi.fn().mockResolvedValue(
        completedAfterResetSnapshot(requestIdHash),
      ),
      classifyCheckpoint3: (snapshot) => classifyPostResetCheckpoint(snapshot, {
        referenceSnapshot: readySnapshot(),
        requestIdHash,
      }),
    });
    expect(result.progression).toEqual({
      allowed: true,
      edge_success_confirmed: true,
      checkpoint_success_confirmed: true,
    });
    expect(evaluateResetProgression(
      { confirmed_success: false },
      result.checkpointOutcome,
    ).allowed).toBe(false);
  });

  it.each([
    'reset_in_progress',
    'session_revocation_review_required',
    'recovery_required',
  ])('classifies %s from Checkpoint 3 and stops fail-closed', (state) => {
    const snapshot = readySnapshot();
    snapshot.target.credential_state = state;
    snapshot.target.pending_operation = state === 'reset_in_progress';
    snapshot.target.pending_operation_count = state === 'reset_in_progress' ? 1 : 0;
    const result = classifyPostResetCheckpoint(snapshot, {
      referenceSnapshot: readySnapshot(),
      requestIdHash: 'a'.repeat(64),
    });
    expect(result.classification).toBe(state);
    expect(result.expected_success).toBe(false);
    expect(evaluateResetProgression(
      { confirmed_success: true },
      result,
    ).allowed).toBe(false);
  });

  it.each([
    'session_revocation_review_required',
    'recovery_required',
  ])('preserves the exact %s classification even while an operation is pending', (state) => {
    const snapshot = readySnapshot();
    snapshot.target.credential_state = state;
    snapshot.target.pending_operation = true;
    snapshot.target.pending_operation_count = 1;
    const result = classifyPostResetCheckpoint(snapshot, {
      referenceSnapshot: readySnapshot(),
      requestIdHash: 'a'.repeat(64),
    });
    expect(result.classification).toBe(state);
    expect(result.expected_success).toBe(false);
  });

  it('classifies every other protected Checkpoint 3 stop state exactly', () => {
    expect(classifyPostResetCheckpoint(readySnapshot(), {
      referenceSnapshot: readySnapshot(),
      requestIdHash: 'a'.repeat(64),
    }).classification).toBe('reset_not_started');

    const aborted = {
      ...readySnapshot(),
      audit: {
        credential_event_count: 2,
        latest_event_type: 'admin_reset_aborted',
        latest_event_code: 'PATCH83U_EDGE_OPERATION_ABORTED',
        latest_event_credential_version: 4,
        latest_event_request_id_hash: 'a'.repeat(64),
        latest_event_at: '2026-07-20T10:00:00.000Z',
        operation_count: 2,
        latest_operation_type: 'admin_reset',
        latest_operation_status: 'aborted',
        latest_operation_current_version: 4,
        latest_operation_next_version: 5,
        latest_operation_resulting_state: 'active',
        latest_operation_auth_changed: false,
        latest_operation_revocation_confirmed: false,
        latest_operation_request_id_hash: 'a'.repeat(64),
        latest_operation_completed_at: '2026-07-20T10:00:00.000Z',
      },
    };
    expect(classifyPostResetCheckpoint(aborted, {
      referenceSnapshot: readySnapshot(),
      requestIdHash: 'a'.repeat(64),
    })).toMatchObject({
      classification: 'reset_aborted_without_auth_change',
      request_correlation_proven: true,
      protected_transition_completed: false,
    });
    const mismatchedAbortCorrelation = structuredClone(aborted);
    mismatchedAbortCorrelation.audit.latest_event_request_id_hash = 'b'.repeat(64);
    expect(classifyPostResetCheckpoint(mismatchedAbortCorrelation, {
      referenceSnapshot: readySnapshot(),
      requestIdHash: 'a'.repeat(64),
    })).toMatchObject({
      classification: 'unexpected_protected_state',
      request_correlation_proven: false,
    });

    const activeWithChangedSessionEvidence = readySnapshot();
    activeWithChangedSessionEvidence.target.session_count = 1;
    expect(classifyPostResetCheckpoint(activeWithChangedSessionEvidence, {
      referenceSnapshot: readySnapshot(),
      requestIdHash: 'a'.repeat(64),
    }).classification).toBe('unexpected_protected_state');

    const versionMismatch = readySnapshot();
    versionMismatch.target.auth_credential_version = 5;
    expect(classifyPostResetCheckpoint(versionMismatch, {
      referenceSnapshot: readySnapshot(),
      requestIdHash: 'a'.repeat(64),
    }).classification).toBe('credential_version_mismatch');

    const nonzeroSessions = completedAfterResetSnapshot('a'.repeat(64));
    nonzeroSessions.target.session_count = 1;
    expect(classifyPostResetCheckpoint(nonzeroSessions, {
      referenceSnapshot: readySnapshot(),
      requestIdHash: 'a'.repeat(64),
    }).classification).toBe('nonzero_sessions_after_reset');

    const unexpected = readySnapshot();
    unexpected.target.credential_state = 'password_change_in_progress';
    unexpected.target.credential_version = 5;
    unexpected.target.auth_credential_version = 5;
    expect(classifyPostResetCheckpoint(unexpected, {
      referenceSnapshot: readySnapshot(),
      requestIdHash: 'a'.repeat(64),
    }).classification).toBe('unexpected_protected_state');

    const runtimeDrift = readySnapshot();
    runtimeDrift.runtime.state_version = 6;
    expect(classifyPostResetCheckpoint(runtimeDrift, {
      referenceSnapshot: readySnapshot(),
      requestIdHash: 'a'.repeat(64),
    }).classification).toBe('runtime_transition');

    const adminDrift = readySnapshot();
    adminDrift.eligible_super_admin_count = 0;
    expect(classifyPostResetCheckpoint(adminDrift, {
      referenceSnapshot: readySnapshot(),
      requestIdHash: 'a'.repeat(64),
    }).classification).toBe('sole_super_admin_drift');

    const authorizationDrift = readySnapshot();
    authorizationDrift.target.scope = 'global';
    expect(classifyPostResetCheckpoint(authorizationDrift, {
      referenceSnapshot: readySnapshot(),
      requestIdHash: 'a'.repeat(64),
    }).classification).toBe('authorization_drift');
  });

  it('provides safe exact operator guidance and contains no automatic recovery actions', () => {
    for (const state of [
      'reset_not_started',
      'reset_aborted_without_auth_change',
      'reset_in_progress',
      'admin_reset_change_required',
      'session_revocation_review_required',
      'recovery_required',
      'credential_version_mismatch',
      'nonzero_sessions_after_reset',
      'unexpected_protected_state',
    ]) {
      const guidance = operatorGuidanceForState(state, { observedState: state });
      expect(guidance.code).toBe(state);
      expect(guidance.observed_state).toBe(state);
      expect(guidance.guidance.length).toBeGreaterThan(20);
    }
    for (const prohibitedAction of [
      'patch83u_abort_admin_reset',
      'patch83u_abort_required_password_change',
      'patch83u_reconcile_credential_state',
      'patch83u_reconcile_provisioning',
    ]) {
      expect(harnessSource).not.toContain(prohibitedAction);
    }
  });

  it('retries only one explicit permanent-password policy rejection and then succeeds', async () => {
    const temporary = new SecretValue('temporary-value');
    const initial = new SecretValue('first-candidate');
    const replacement = new SecretValue('second-candidate');
    const confirmation = new SecretValue('second-candidate');
    const submitAttempt = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        httpStatus: 409,
        safeErrorCode: PERMANENT_PASSWORD_POLICY_ERROR_CODE,
      })
      .mockResolvedValueOnce({
        ok: true,
        httpStatus: 200,
        safeErrorCode: null,
      });
    const promptReplacement = vi.fn().mockResolvedValue({
      candidate: replacement,
      confirmation,
    });
    try {
      const result = await runBoundedPasswordPolicyAttempts({
        initialCandidate: initial,
        temporaryPassword: temporary,
        submitAttempt,
        promptReplacement,
      });
      expect(result).toMatchObject({
        candidate: replacement,
        attempt_count: 2,
        policy_rejection_count: 1,
        policy_error_codes: [PERMANENT_PASSWORD_POLICY_ERROR_CODE],
      });
      expect(submitAttempt).toHaveBeenCalledTimes(2);
      expect(promptReplacement).toHaveBeenCalledOnce();
    } finally {
      temporary.clear();
      initial.clear();
      replacement.clear();
      confirmation.clear();
    }
  });

  it('guards the password-change action before populating any credential field', () => {
    const attemptIndex = harnessSource.indexOf(
      'submitAttempt: async ({ candidate, attempt }) => {',
    );
    const guardIndex = harnessSource.indexOf(
      'const changeRequestGuard = async (route) => {',
      attemptIndex,
    );
    const routeIndex = harnessSource.indexOf(
      "await forcedPage.route(\n            '**/functions/v1/privileged-action'",
      guardIndex,
    );
    const currentPasswordFillIndex = harnessSource.indexOf(
      'await currentPasswordField.fill(temporaryPassword.reveal())',
      routeIndex,
    );
    const authorizationIndex = harnessSource.indexOf(
      'passwordChangeSubmissionAuthorized = true',
      currentPasswordFillIndex,
    );
    const clickIndex = harnessSource.indexOf(
      ".getByRole('button', { name: /Change password|تغيير كلمة المرور/i })",
      authorizationIndex,
    );
    expect(attemptIndex).toBeGreaterThan(0);
    expect(attemptIndex).toBeLessThan(guardIndex);
    expect(guardIndex).toBeLessThan(routeIndex);
    expect(routeIndex).toBeLessThan(currentPasswordFillIndex);
    expect(currentPasswordFillIndex).toBeLessThan(authorizationIndex);
    expect(authorizationIndex).toBeLessThan(clickIndex);
    expect(
      harnessSource.slice(guardIndex, routeIndex),
    ).toContain('if (!passwordChangeSubmissionAuthorized)');
  });

  it('stops after three explicit policy rejections', async () => {
    const secrets = [
      new SecretValue('temporary-value'),
      new SecretValue('candidate-one'),
      new SecretValue('candidate-two'),
      new SecretValue('candidate-two'),
      new SecretValue('candidate-three'),
      new SecretValue('candidate-three'),
    ];
    const submitAttempt = vi.fn().mockResolvedValue({
      ok: false,
      httpStatus: 409,
      safeErrorCode: PERMANENT_PASSWORD_POLICY_ERROR_CODE,
    });
    const promptReplacement = vi.fn()
      .mockResolvedValueOnce({ candidate: secrets[2], confirmation: secrets[3] })
      .mockResolvedValueOnce({ candidate: secrets[4], confirmation: secrets[5] });
    try {
      await expect(runBoundedPasswordPolicyAttempts({
        initialCandidate: secrets[1],
        temporaryPassword: secrets[0],
        submitAttempt,
        promptReplacement,
      })).rejects.toThrow(/PATCH83U_PASSWORD_POLICY_RETRY_LIMIT_REACHED/);
      expect(submitAttempt).toHaveBeenCalledTimes(PASSWORD_CHANGE_MAX_ATTEMPTS);
      expect(promptReplacement).toHaveBeenCalledTimes(2);
    } finally {
      secrets.forEach((secret) => secret.clear());
    }
  });

  it('never retries an ambiguous or non-policy password-change response', async () => {
    const temporary = new SecretValue('temporary-value');
    const initial = new SecretValue('candidate-one');
    const submitAttempt = vi.fn().mockResolvedValue({
      ok: false,
      httpStatus: 504,
      safeErrorCode: 'EDGE_RESPONSE_NOT_OK',
    });
    const promptReplacement = vi.fn();
    try {
      await expect(runBoundedPasswordPolicyAttempts({
        initialCandidate: initial,
        temporaryPassword: temporary,
        submitAttempt,
        promptReplacement,
      })).rejects.toThrow(/PATCH83U_PASSWORD_CHANGE_NOT_RETRYABLE/);
      expect(submitAttempt).toHaveBeenCalledOnce();
      expect(promptReplacement).not.toHaveBeenCalled();
      expect(classifyPasswordChangeEdgeResult({
        ok: false,
        httpStatus: 409,
        safeErrorCode: 'PATCH83U_RECOVERY_REQUIRED',
      }).retry_allowed).toBe(false);
    } finally {
      temporary.clear();
      initial.clear();
    }
  });

  it('rejects unsafe initial and replacement permanent-password candidates', async () => {
    const runRejectedReplacement = async (
      replacementValue: string,
      confirmationValue: string,
    ) => {
      const temporary = new SecretValue('temporary-value');
      const initial = new SecretValue('candidate-one');
      const replacement = new SecretValue(replacementValue);
      const confirmation = new SecretValue(confirmationValue);
      const submitAttempt = vi.fn().mockResolvedValue({
        ok: false,
        httpStatus: 409,
        safeErrorCode: PERMANENT_PASSWORD_POLICY_ERROR_CODE,
      });
      try {
        await expect(runBoundedPasswordPolicyAttempts({
          initialCandidate: initial,
          temporaryPassword: temporary,
          submitAttempt,
          promptReplacement: vi.fn().mockResolvedValue({
            candidate: replacement,
            confirmation,
          }),
        })).rejects.toThrow(/PATCH83U_REPLACEMENT_PASSWORD_CONFIRMATION_REFUSED/);
        expect(submitAttempt).toHaveBeenCalledOnce();
      } finally {
        temporary.clear();
        initial.clear();
        replacement.clear();
        confirmation.clear();
      }
    };

    await runRejectedReplacement('temporary-value', 'temporary-value');
    await runRejectedReplacement('candidate-one', 'candidate-one');
    await runRejectedReplacement('candidate-two', 'candidate-three');

    const temporary = new SecretValue('same-value');
    const initial = new SecretValue('same-value');
    const submitAttempt = vi.fn();
    try {
      await expect(runBoundedPasswordPolicyAttempts({
        initialCandidate: initial,
        temporaryPassword: temporary,
        submitAttempt,
        promptReplacement: vi.fn(),
      })).rejects.toThrow(/PATCH83U_REPLACEMENT_PASSWORD_CONFIRMATION_REFUSED/);
      expect(submitAttempt).not.toHaveBeenCalled();
    } finally {
      temporary.clear();
      initial.clear();
    }
  });

  it('keeps the reset one-shot while password-policy attempts are independent', async () => {
    const readiness = evaluateReadinessGates(readySnapshot(), runtimeProof());
    const resetController = new ResetSubmissionController();
    await armResetController(resetController, readiness);
    await resetController.submit(readiness, async () => {
      resetController.observeRequestId('patch83u-reset-stable');
      return { ok: true };
    });
    const resetRequestIdHash = resetController.requestIdHash;

    const temporary = new SecretValue('temporary-value');
    const initial = new SecretValue('candidate-one');
    const replacement = new SecretValue('candidate-two');
    const confirmation = new SecretValue('candidate-two');
    try {
      await runBoundedPasswordPolicyAttempts({
        initialCandidate: initial,
        temporaryPassword: temporary,
        submitAttempt: vi.fn()
          .mockResolvedValueOnce({
            ok: false,
            httpStatus: 409,
            safeErrorCode: PERMANENT_PASSWORD_POLICY_ERROR_CODE,
          })
          .mockResolvedValueOnce({
            ok: true,
            httpStatus: 200,
            safeErrorCode: null,
          }),
        promptReplacement: vi.fn().mockResolvedValue({
          candidate: replacement,
          confirmation,
        }),
      });
      await expect(resetController.submit(readiness, vi.fn())).rejects.toThrow(
        /PATCH83U_RESET_RETRY_REFUSED/,
      );
      expect(resetController.requestIdHash).toBe(resetRequestIdHash);
    } finally {
      temporary.clear();
      initial.clear();
      replacement.clear();
      confirmation.clear();
    }
  });

  it('stores only safe failed refresh replay information', () => {
    const rejected = safeRefreshReplayResult({
      failed: true,
      httpStatus: 400,
      errorCode: 'refresh_token_not_found',
      at: new Date('2026-07-18T10:00:00.000Z'),
    });
    expect(rejected).toEqual({
      failed: true,
      http_status: 400,
      safe_error_code: 'refresh_token_not_found',
      observed_at: '2026-07-18T10:00:00.000Z',
    });
    expect(assertRejectedRefreshReplays([
      rejected,
      { ...rejected, http_status: 401 },
    ])).toBe(true);
    expect(() => assertRejectedRefreshReplays([
      { ...rejected, http_status: null, safe_error_code: 'NETWORK_ERROR' },
      rejected,
    ])).toThrow(/PATCH83U_REFRESH_REPLAY_REVOCATION_NOT_PROVEN/);
    expect(() => assertRejectedRefreshReplays([
      { ...rejected, http_status: 503 },
      rejected,
    ])).toThrow(/PATCH83U_REFRESH_REPLAY_REVOCATION_NOT_PROVEN/);
  });

  it('blocks role or scope drift', () => {
    const snapshot = readySnapshot();
    snapshot.target.scope = 'global';
    const result = evaluateReadinessGates(snapshot, runtimeProof());
    expect(result.passed).toBe(false);
    expect(result.failed).toContain('target_role_scope_exact');
  });

  it('blocks an inactive target profile before the reset boundary', () => {
    const snapshot = readySnapshot();
    snapshot.target.profile_active = false;
    const result = evaluateReadinessGates(snapshot, runtimeProof());
    expect(result.passed).toBe(false);
    expect(result.failed).toContain('target_active_v4');
    const crossOrganization = readySnapshot();
    crossOrganization.target.same_organization_as_designated_admin = false;
    expect(evaluateReadinessGates(
      crossOrganization,
      runtimeProof(),
    ).failed).toContain('target_active_v4');
  });

  it('blocks a pending designated administrator operation or unavailable original context', () => {
    const snapshot = readySnapshot();
    snapshot.admin.pending_operation = true;
    snapshot.admin.pending_operation_count = 1;
    const pendingResult = evaluateReadinessGates(snapshot, runtimeProof());
    expect(pendingResult.failed).toContain('designated_admin_no_pending_operation');

    const unavailableContext = evaluateReadinessGates(readySnapshot(), {
      ...runtimeProof(),
      originalAdminContextAvailable: false,
    });
    expect(unavailableContext.failed).toContain('original_admin_context_available');
  });

  it('blocks reset when recovery objects or pre-reset refresh proof are absent', () => {
    const snapshot = readySnapshot();
    snapshot.recovery.wrapper_exists = false;
    const recoveryResult = evaluateReadinessGates(snapshot, runtimeProof());
    expect(recoveryResult.failed).toContain('emergency_recovery_route_available');

    const refreshResult = evaluateReadinessGates(readySnapshot(), {
      ...runtimeProof(),
      employeeContextProofs: controlledEmployeeContextProofs().map((proof, index) => ({
        ...proof,
        refresh_succeeded: index === 0 ? false : proof.refresh_succeeded,
      })),
    });
    expect(refreshResult.failed).toContain('both_controlled_employee_refreshes_proven');

    const insufficientRefreshRows = readySnapshot();
    insufficientRefreshRows.target.unrevoked_refresh_token_count = 1;
    const refreshRowResult = evaluateReadinessGates(
      insufficientRefreshRows,
      runtimeProof(),
    );
    expect(refreshRowResult.failed).toContain('two_controlled_employee_sessions');
  });

  it('blocks any pending target credential operation', () => {
    const snapshot = readySnapshot();
    snapshot.target.pending_operation = true;
    snapshot.target.pending_operation_count = 1;
    const result = evaluateReadinessGates(snapshot, runtimeProof());
    expect(result.failed).toContain('target_no_pending_operation');
  });

  it('blocks pre-credential work on any database readiness drift', () => {
    const edgeDeploymentChecks = readyEdgeDeploymentChecks();
    expect(evaluatePreCredentialDatabaseGates(
      readySnapshot(),
      { edgeDeploymentChecks },
    ).passed).toBe(true);
    const drifted = readySnapshot();
    drifted.runtime.schema_version = 'unexpected';
    const result = evaluatePreCredentialDatabaseGates(
      drifted,
      { edgeDeploymentChecks },
    );
    expect(result.passed).toBe(false);
    expect(result.failed).toContain('schema_version_exact');
  });

  it('binds both administrator browsers and employee browsers to exact UUIDs', () => {
    expect(assertDesignatedBrowserIdentities({
      originalAdminUserId: DESIGNATED_SUPER_ADMIN_ID,
      secondaryAdminUserId: DESIGNATED_SUPER_ADMIN_ID,
      employeeUserIds: [TARGET_USER_ID, TARGET_USER_ID],
    })).toBe(true);
    expect(() => assertDesignatedBrowserIdentities({
      originalAdminUserId: DESIGNATED_SUPER_ADMIN_ID,
      secondaryAdminUserId: TARGET_USER_ID,
      employeeUserIds: [TARGET_USER_ID, TARGET_USER_ID],
    })).toThrow(/PATCH83U_DESIGNATED_ADMIN_BROWSER_IDENTITY_FAILED/);
  });

  it('requires the full authorization proof independently for both Employee contexts', () => {
    const valid = controlledEmployeeContextProofs();
    expect(assertControlledEmployeeContextProofs(valid).passed).toBe(true);
    const fields = [
      'authentication_succeeded',
      'refresh_succeeded',
      'permitted_employee_page_accessible',
      'admin_route_denied',
      'admin_redirect_destination_permitted',
      'admin_navigation_absent',
      'user_management_absent',
      'access_control_absent',
      'provisioning_controls_absent',
    ] as const;
    for (const contextIndex of [0, 1]) {
      for (const field of fields) {
        const drifted = structuredClone(valid);
        drifted[contextIndex][field] = false;
        const result = evaluateControlledEmployeeContextProofs(drifted);
        expect(result.passed).toBe(false);
        expect(evaluateReadinessGates(readySnapshot(), {
          ...runtimeProof(),
          employeeContextProofs: drifted,
        }).failed).toContain('both_employee_context_authorization_proofs');
      }
    }
    expect(() => assertControlledEmployeeContextProofs([
      valid[0],
      { ...valid[1], label: valid[0].label },
    ])).toThrow(/PATCH83U_CONTROLLED_EMPLOYEE_CONTEXT_PROOF_FAILED/);
  });

  it('accepts only the exact staging Home redirect as the Employee Admin denial destination', () => {
    expect(CONTROLLED_EMPLOYEE_REDIRECT_PAGE).toBe('home');
    expect(controlledEmployeeAdminRedirectIsDenied({
      url: `${STAGING_APPLICATION_ORIGIN}/?page=home`,
      employeeContentVisible: true,
      authenticatedUserId: TARGET_USER_ID,
    })).toBe(true);
    expect(controlledEmployeeAdminRedirectIsDenied({
      url: `${STAGING_APPLICATION_ORIGIN}/`,
      employeeContentVisible: true,
      authenticatedUserId: TARGET_USER_ID,
    })).toBe(true);
    for (const value of [
      `${STAGING_APPLICATION_ORIGIN}/?page=admin`,
      `${STAGING_APPLICATION_ORIGIN}/?page=reconciliation`,
      `https://${PRODUCTION_PROJECT_REF}.supabase.co/?page=home`,
    ]) {
      expect(controlledEmployeeAdminRedirectIsDenied({
        url: value,
        employeeContentVisible: true,
        authenticatedUserId: TARGET_USER_ID,
      })).toBe(false);
    }
    expect(controlledEmployeeAdminRedirectIsDenied({
      url: `${STAGING_APPLICATION_ORIGIN}/?page=home`,
      employeeContentVisible: false,
      authenticatedUserId: TARGET_USER_ID,
    })).toBe(false);
    expect(controlledEmployeeAdminRedirectIsDenied({
      url: `${STAGING_APPLICATION_ORIGIN}/?page=home`,
      employeeContentVisible: true,
      authenticatedUserId: null,
    })).toBe(false);
    expect(harnessSource).toContain("page.goto(`${appUrl}?page=admin`");
    expect(harnessSource).toContain('controlledEmployeeAdminRedirectIsDenied({');
  });

  it('never calls the reset submitter when either Employee context proof fails', async () => {
    for (const contextIndex of [0, 1]) {
      const proofs = controlledEmployeeContextProofs();
      proofs[contextIndex].admin_route_denied = false;
      const readiness = evaluateReadinessGates(readySnapshot(), {
        ...runtimeProof(),
        employeeContextProofs: proofs,
      });
      const submitter = vi.fn();
      const controller = new ResetSubmissionController();
      await expect(controller.submit(readiness, submitter)).rejects.toThrow(
        /PATCH83U_RESET_READINESS_GATES_FAILED/,
      );
      expect(submitter).not.toHaveBeenCalled();
    }
  });

  it('requires independent signed-out and protected-route denial proof for both stale contexts', () => {
    const valid = staleEmployeeContextProofs();
    expect(evaluateStaleEmployeeContextProofs(valid).passed).toBe(true);
    const fields = [
      'authenticated_user_absent',
      'sign_in_visible',
      'employee_content_absent',
      'admin_content_absent',
      'protected_route_access_denied',
    ] as const;
    for (const contextIndex of [0, 1]) {
      for (const field of fields) {
        const drifted = structuredClone(valid);
        drifted[contextIndex][field] = false;
        expect(evaluateStaleEmployeeContextProofs(drifted).passed).toBe(false);
      }
    }
  });

  it('enforces target lifecycle, role, scope, pending state, and session checkpoints', () => {
    const afterReset = readySnapshot();
    afterReset.target.credential_state = 'admin_reset_change_required';
    afterReset.target.credential_version = 5;
    afterReset.target.auth_credential_version = 5;
    afterReset.target.session_count = 0;
    afterReset.target.unrevoked_refresh_token_count = 0;
    expect(assertTargetGovernanceCheckpoint(afterReset, {
      credentialState: 'admin_reset_change_required',
      credentialVersion: 5,
      requireZeroSessions: true,
    })).toBe(true);

    const drifted = structuredClone(afterReset);
    drifted.target.scope = 'global';
    expect(() => assertTargetGovernanceCheckpoint(drifted, {
      credentialState: 'admin_reset_change_required',
      credentialVersion: 5,
      requireZeroSessions: true,
    })).toThrow(/PATCH83U_TARGET_GOVERNANCE_CHECKPOINT_FAILED/);

    const beforeChange = structuredClone(afterReset);
    beforeChange.target.session_count = 1;
    beforeChange.target.unrevoked_refresh_token_count = 1;
    expect(assertTargetGovernanceCheckpoint(beforeChange, {
      credentialState: 'admin_reset_change_required',
      credentialVersion: 5,
      requireFreshSession: true,
    })).toBe(true);
  });

  it('keeps the sole-Super-Admin and runtime contract gates active at every checkpoint', () => {
    const snapshot = readySnapshot();
    expect(assertSoleSuperAdminCheckpoint(snapshot)).toBe(true);
    const changedAdmin = structuredClone(snapshot);
    changedAdmin.eligible_super_admin_count = 0;
    expect(() => assertSoleSuperAdminCheckpoint(changedAdmin)).toThrow(
      /PATCH83U_SOLE_SUPER_ADMIN_CHECKPOINT_FAILED/,
    );

    const later = structuredClone(snapshot);
    later.runtime.state_version = 6;
    expect(() => assertRuntimeSnapshotStable(snapshot, later)).toThrow(
      /PATCH83U_RUNTIME_OR_CONTRACT_TRANSITION/,
    );
    const wrongDesignatedAdmin = structuredClone(snapshot);
    wrongDesignatedAdmin.runtime.designated_super_admin_id = TARGET_USER_ID;
    expect(evaluateReadinessGates(
      wrongDesignatedAdmin,
      runtimeProof(),
    ).failed).toContain('runtime_designated_super_admin_exact');
    expect(() => assertSoleSuperAdminCheckpoint(wrongDesignatedAdmin)).toThrow(
      /PATCH83U_SOLE_SUPER_ADMIN_CHECKPOINT_FAILED/,
    );
  });

  it('binds reset and password-change audit proof to the observed request hash', () => {
    const resetHash = hashRequestId('patch83u-reset-audit-correlation');
    const afterReset = {
      audit: {
        credential_event_count: 1,
        latest_event_type: 'admin_reset_completed',
        latest_event_code: 'PATCH83U_ADMIN_RESET_COMPLETED',
        latest_event_credential_version: 5,
        latest_event_request_id_hash: resetHash,
        latest_event_at: '2026-07-18T10:00:00.000Z',
        operation_count: 1,
        latest_operation_type: 'admin_reset',
        latest_operation_status: 'completed',
        latest_operation_current_version: 4,
        latest_operation_next_version: 5,
        latest_operation_resulting_state: 'admin_reset_change_required',
        latest_operation_auth_changed: true,
        latest_operation_revocation_confirmed: true,
        latest_operation_request_id_hash: resetHash,
        latest_operation_completed_at: '2026-07-18T10:00:00.000Z',
      },
    };
    expect(assertAuditCheckpoint(afterReset, {
      kind: 'admin_reset',
      requestIdHash: resetHash,
    })).toBe(true);
    const wrongCorrelation = structuredClone(afterReset);
    wrongCorrelation.audit.latest_operation_request_id_hash = '0'.repeat(64);
    expect(() => assertAuditCheckpoint(wrongCorrelation, {
      kind: 'admin_reset',
      requestIdHash: resetHash,
    })).toThrow(/PATCH83U_AUDIT_CHECKPOINT_NOT_PROVEN/);

    const changeHash = hashRequestId('patch83u-change-audit-correlation');
    const afterChange = structuredClone(afterReset);
    Object.assign(afterChange.audit, {
      latest_event_type: 'password_change_completed',
      latest_event_code: 'PATCH83U_PASSWORD_CHANGE_COMPLETED',
      latest_event_credential_version: 6,
      latest_event_request_id_hash: changeHash,
      latest_operation_type: 'password_change',
      latest_operation_current_version: 5,
      latest_operation_next_version: 6,
      latest_operation_resulting_state: 'active',
      latest_operation_request_id_hash: changeHash,
    });
    expect(assertAuditCheckpoint(afterChange, {
      kind: 'password_change',
      requestIdHash: changeHash,
    })).toBe(true);
  });

  it('blocks password-change finalization while sessions remain', () => {
    const snapshot = readySnapshot();
    snapshot.target.credential_state = 'admin_reset_change_required';
    snapshot.target.credential_version = 5;
    snapshot.target.auth_credential_version = 5;
    snapshot.target.session_count = 1;
    snapshot.target.unrevoked_refresh_token_count = 0;
    expect(() => assertPasswordChangeFinalizationReady(snapshot)).toThrow(
      /PATCH83U_NONZERO_SESSIONS_BLOCK_PASSWORD_CHANGE/,
    );
  });

  it('requires explicit Checkpoint 5 password-change finalization proof', () => {
    const valid = {
      target: {
        password_changed_at_set: true,
        sessions_revoked_at_set: true,
        reconciliation_auth_changed: false,
      },
    };
    expect(assertPasswordChangeFinalizationProof(valid)).toBe(true);

    for (const value of [undefined, false, 'true', 1, null]) {
      const snapshot = structuredClone(valid);
      if (value === undefined) {
        delete (
          snapshot.target as Partial<typeof snapshot.target>
        ).password_changed_at_set;
      } else {
        (
          snapshot.target as Record<string, unknown>
        ).password_changed_at_set = value;
      }
      expect(() => assertPasswordChangeFinalizationProof(snapshot)).toThrow(
        /PATCH83U_PASSWORD_CHANGED_AT_SET_NOT_PROVEN/,
      );
    }

    for (const value of [undefined, false, 'true', 1, null]) {
      const snapshot = structuredClone(valid);
      if (value === undefined) {
        delete (
          snapshot.target as Partial<typeof snapshot.target>
        ).sessions_revoked_at_set;
      } else {
        (
          snapshot.target as Record<string, unknown>
        ).sessions_revoked_at_set = value;
      }
      expect(() => assertPasswordChangeFinalizationProof(snapshot)).toThrow(
        /PATCH83U_SESSIONS_REVOKED_AT_SET_NOT_PROVEN/,
      );
    }

    for (const value of [undefined, true, 'false', 0, null]) {
      const snapshot = structuredClone(valid);
      if (value === undefined) {
        delete (
          snapshot.target as Partial<typeof snapshot.target>
        ).reconciliation_auth_changed;
      } else {
        (
          snapshot.target as Record<string, unknown>
        ).reconciliation_auth_changed = value;
      }
      expect(() => assertPasswordChangeFinalizationProof(snapshot)).toThrow(
        /PATCH83U_RECONCILIATION_AUTH_CHANGED_NOT_CLEARED/,
      );
    }
  });

  it('freeze-binds exact Run 007 final fresh-login session counts', () => {
    const contract = assertRun007FinalSessionContract(finalSessionContract());
    expect(contract).toEqual(finalSessionContract());
    expect(assertFinalFreshLoginCounts({
      target: {
        session_count: EXPECTED_FINAL_SESSION_COUNT,
        unrevoked_refresh_token_count:
          EXPECTED_FINAL_UNREVOKED_REFRESH_TOKEN_COUNT,
      },
    }, contract)).toBe(true);

    for (const value of [0, 2]) {
      expect(() => assertFinalFreshLoginCounts({
        target: {
          session_count: value,
          unrevoked_refresh_token_count:
            EXPECTED_FINAL_UNREVOKED_REFRESH_TOKEN_COUNT,
        },
      }, contract)).toThrow(/PATCH83U_FINAL_SESSION_COUNT_MISMATCH/);
    }
    for (const value of [undefined, '1', 1.5, null]) {
      expect(() => assertFinalFreshLoginCounts({
        target: {
          session_count: value,
          unrevoked_refresh_token_count:
            EXPECTED_FINAL_UNREVOKED_REFRESH_TOKEN_COUNT,
        },
      }, contract)).toThrow(/PATCH83U_FINAL_SESSION_COUNT_PROOF_INVALID/);
    }
    for (const value of [0, 2]) {
      expect(() => assertFinalFreshLoginCounts({
        target: {
          session_count: EXPECTED_FINAL_SESSION_COUNT,
          unrevoked_refresh_token_count: value,
        },
      }, contract)).toThrow(
        /PATCH83U_FINAL_UNREVOKED_REFRESH_COUNT_MISMATCH/,
      );
    }
    for (const value of [undefined, '1', 1.5, null]) {
      expect(() => assertFinalFreshLoginCounts({
        target: {
          session_count: EXPECTED_FINAL_SESSION_COUNT,
          unrevoked_refresh_token_count: value,
        },
      }, contract)).toThrow(
        /PATCH83U_FINAL_UNREVOKED_REFRESH_COUNT_PROOF_INVALID/,
      );
    }
  });

  it('rejects drift in every freeze-bound final-session contract field', () => {
    for (const [field, value] of [
      ['checkpoint', 'immediately_after_password_change_finalization'],
      ['expected_session_count', 2],
      ['expected_unrevoked_refresh_token_count', 2],
      ['enforcement', 'minimum'],
      ['cli_override_supported', true],
    ] as const) {
      expect(() => assertRun007FinalSessionContract({
        ...finalSessionContract(),
        [field]: value,
      })).toThrow(/PATCH83U_RUN007_FINAL_SESSION_CONTRACT_INVALID/);
    }
  });

  it('does not expose a CLI override for frozen final-session counts', () => {
    expect(() => parseCliArguments([
      '--expected-final-session-count',
      '2',
    ])).toThrow(/PATCH83U_UNKNOWN_ARGUMENT_REFUSED/);
    expect(() => parseCliArguments([
      '--expected-unrevoked-refresh-count',
      '2',
    ])).toThrow(/PATCH83U_UNKNOWN_ARGUMENT_REFUSED/);
  });

  it('has a schema that rejects password, token, header, and cookie fields', () => {
    const valid = minimalEvidence();
    expect(assertEvidenceMatchesSchemaContract(valid, schema)).toBe(true);
    for (const key of ['password', 'access_token', 'authorization_header', 'cookie']) {
      expect(() => assertEvidenceMatchesSchemaContract(
        { ...valid, [key]: 'forbidden' },
        schema,
      )).toThrow();
    }
  });

  it('schema-retains finalization booleans and exact final fresh-login counts', () => {
    const valid = {
      ...minimalEvidence(),
      execution_status: 'operator_stopped',
      password_change: {
        submitted: true,
        submission_count: 1,
        attempt_count: 1,
        policy_rejection_count: 0,
        policy_error_codes: [],
        http_status: 200,
        safe_error_code: null,
        request_id_hash: 'b'.repeat(64),
        edge_success_confirmed: true,
        finalizer_rpc:
          'patch83u_finalize_password_change_after_revocation',
        terminal_proof: {
          credential_state: 'active',
          database_credential_version: 6,
          auth_credential_version: 6,
          requested_lifecycle: 'active',
          session_count: 0,
          unrevoked_refresh_token_count: 0,
          role: 'employee',
          scope: 'assigned_only',
          observed_at: '2026-07-20T10:00:00.000Z',
        },
        browser_signed_out: true,
        password_changed_at_set: true,
        sessions_revoked_at_set: true,
        reconciliation_auth_changed: false,
      },
      fresh_login: {
        permanent_login_succeeded: true,
        nonpersistent_context: true,
        authenticated_user_id: '2a276bdb-cf51-4303-846e-6b7fecf38b0c',
        role: 'employee',
        scope: 'assigned_only',
        admin_route_denied: true,
        permitted_employee_page_accessible: true,
        admin_redirect_destination_permitted: true,
        admin_navigation_absent: true,
        user_management_absent: true,
        access_control_absent: true,
        provisioning_controls_absent: true,
        authorized_route: 'home',
        database_credential_version: 6,
        auth_credential_version: 6,
        database_session_count: EXPECTED_FINAL_SESSION_COUNT,
        unrevoked_refresh_token_count:
          EXPECTED_FINAL_UNREVOKED_REFRESH_TOKEN_COUNT,
        observed_at: '2026-07-20T10:00:00.000Z',
      },
    };
    expect(assertEvidenceMatchesSchemaContract(valid, schema)).toBe(true);

    for (const field of [
      'password_changed_at_set',
      'sessions_revoked_at_set',
    ] as const) {
      const missing = structuredClone(valid);
      delete (
        missing.password_change as Partial<typeof missing.password_change>
      )[field];
      expect(() => assertEvidenceMatchesSchemaContract(
        missing,
        schema,
      )).toThrow(/PATCH83U_SCHEMA_ONE_OF_FAILED/);

      const falseProof = structuredClone(valid);
      falseProof.password_change[field] = false;
      expect(() => assertEvidenceMatchesSchemaContract(
        falseProof,
        schema,
      )).toThrow(/PATCH83U_SCHEMA_ONE_OF_FAILED/);
    }

    for (const [field, value] of [
      ['database_session_count', 0],
      ['database_session_count', 2],
      ['unrevoked_refresh_token_count', 0],
      ['unrevoked_refresh_token_count', 2],
    ] as const) {
      const drifted = structuredClone(valid);
      drifted.fresh_login[field] = value;
      expect(() => assertEvidenceMatchesSchemaContract(
        drifted,
        schema,
      )).toThrow(/PATCH83U_SCHEMA_CONST_FAILED/);
    }
  });

  it('stores only the Run 007 confirmation boolean/id and separate context proofs', () => {
    const valid = {
      ...minimalEvidence(),
      operator_confirmation: {
        contract_id: RUN007_OPERATOR_CONFIRMATION_CONTRACT_ID,
        exact_match: true,
      },
      employee_contexts_before_reset: controlledEmployeeContextProofs(),
    };
    expect(assertEvidenceMatchesSchemaContract(valid, schema)).toBe(true);
    expect(() => assertEvidenceMatchesSchemaContract({
      ...valid,
      operator_confirmation: {
        ...valid.operator_confirmation,
        entered_phrase: 'redacted',
      },
    }, schema)).toThrow(/PATCH83U_SCHEMA_ADDITIONAL_PROPERTY_REFUSED/);
    expect(() => assertEvidenceMatchesSchemaContract({
      ...valid,
      employee_contexts_before_reset: [controlledEmployeeContextProofs()[0]],
    }, schema)).toThrow(/PATCH83U_SCHEMA_MIN_ITEMS_FAILED/);
  });

  it('accepts safe pre-submission password blocks and independent stale-context proof', () => {
    expect(assertEvidenceMatchesSchemaContract({
      ...minimalEvidence(),
      execution_status: 'password_change_blocked',
      password_change: {
        submitted: false,
        submission_count: 0,
        attempt_count: 0,
        policy_rejection_count: 0,
        policy_error_codes: [],
        http_status: null,
        safe_error_code: 'PATCH83U_PASSWORD_CHANGE_BLOCKED',
        browser_signed_out: false,
      },
      revocation: {
        old_permanent_login_failed: true,
        old_permanent_login_http_status: 400,
        old_permanent_login_safe_error_code: 'invalid_grant',
        refresh_replay_results: CONTROLLED_EMPLOYEE_CONTEXT_LABELS.map((label) => ({
          label,
          failed: true,
          http_status: 400,
          safe_error_code: 'refresh_token_not_found',
          observed_at: '2026-07-20T10:00:00.000Z',
        })),
        stale_context_1_denied: true,
        stale_context_2_denied: true,
        stale_contexts: staleEmployeeContextProofs(),
        database_session_count: 0,
        unrevoked_refresh_token_count: 0,
        observed_at: '2026-07-20T10:00:00.000Z',
      },
    }, schema)).toBe(true);
  });

  it('requires the reset evidence to record post-submission cleanup status', () => {
    const valid = {
      ...minimalEvidence(),
      execution_status: 'reset_finalization_unclear',
      request_id_hash: 'a'.repeat(64),
      reset: {
        submitted: true,
        submission_count: 1,
        http_status: null,
        safe_error_code: 'EDGE_RESPONSE_UNAVAILABLE',
        edge_success_confirmed: false,
        checkpoint_classification: 'reset_not_started',
        checkpoint_success_confirmed: false,
        protected_transition_completed: false,
        request_correlation_proven: false,
        post_submission_cleanup_succeeded: true,
        progression_allowed: false,
      },
    };
    expect(assertEvidenceMatchesSchemaContract(valid, schema)).toBe(true);
    const missingCleanup = structuredClone(valid);
    delete (missingCleanup.reset as Partial<typeof valid.reset>)
      .post_submission_cleanup_succeeded;
    expect(() => assertEvidenceMatchesSchemaContract(
      missingCleanup,
      schema,
    )).toThrow(/PATCH83U_SCHEMA_REQUIRED_FAILED/);
  });

  it('keeps the database helper read-only and omits sensitive Auth values', () => {
    expect(evidenceSql).toMatch(/begin read only;/i);
    expect(evidenceSql).toMatch(/rollback;/i);
    expect(evidenceSql).not.toMatch(/\b(?:insert|update|delete|alter|drop|create|grant|revoke|call)\b/i);
    expect(evidenceSql).not.toMatch(/\b(?:encrypted_password|token_hash|refresh_token|access_token|session_id)\b/i);
    expect(evidenceSql).not.toMatch(/\bselect\s+[^;]*\b(?:email|phone)\b/i);
  });

  it('defines six standalone safe SQL Editor checkpoint transactions', () => {
    expect(sqlEditorEvidence.match(/\bBEGIN READ ONLY;/g)).toHaveLength(6);
    expect(sqlEditorEvidence.match(/\bROLLBACK;/g)).toHaveLength(6);
    for (const checkpoint of SQL_EDITOR_CHECKPOINTS) {
      expect(sqlEditorEvidence).toContain(`'${checkpoint}'`);
      expect(harnessSource).toContain(`readCheckpoint('${checkpoint}')`);
      expect(sqlEditorEvidence).toContain(
        `-- FILE: ${SQL_EDITOR_CHECKPOINT_FILE_NAMES[checkpoint]}`,
      );
    }
    expect(sqlEditorEvidence).not.toContain('hidden harness prompt');
    expect(sqlEditorEvidence).not.toMatch(
      /^\s*(?:insert|update|delete|alter|drop|create|grant|revoke|call|commit)\b/im,
    );
    expect(sqlEditorEvidence).not.toMatch(
      /\b(?:encrypted_password|token_hash|access_token|session_id)\b/i,
    );
    expect(sqlEditorEvidence).not.toMatch(/\bselect\s+[^;]*\b(?:email|phone)\b/i);
  });

  it('uses SQL Editor evidence without a psql runtime dependency', () => {
    expect(createExecutionPlan({
      execute: true,
      appUrl: STAGING_APPLICATION_ORIGIN,
      supabaseUrl: STAGING_SUPABASE_ORIGIN,
      evidenceChannel: SQL_EDITOR_EVIDENCE_CHANNEL,
      sqlEditorProjectRef: STAGING_PROJECT_REF,
      out:
        `${RUN007_EVIDENCE_DIRECTORY}/`
        + 'patch83u-staging-reset-final-results-attempt-999.json',
      checkpointDir: SQL_EDITOR_CHECKPOINT_DIRECTORY,
      executionFreeze: 'release/patch83u/freeze.json',
      executionFreezeSha256: 'a'.repeat(64),
    })).toEqual({
      executable: true,
      precredentialReadiness: false,
      projectConfirmation: {
        passed: true,
        project_ref: STAGING_PROJECT_REF,
        gate_id: SQL_EDITOR_PROJECT_CONFIRMATION_GATE_ID,
      },
    });
    expect(() => createExecutionPlan({
      execute: true,
      appUrl: STAGING_APPLICATION_ORIGIN,
      supabaseUrl: STAGING_SUPABASE_ORIGIN,
      evidenceChannel: 'psql',
      out:
        `${RUN007_EVIDENCE_DIRECTORY}/`
        + 'patch83u-staging-reset-final-results-attempt-999.json',
      checkpointDir: SQL_EDITOR_CHECKPOINT_DIRECTORY,
      executionFreeze: 'release/patch83u/freeze.json',
      executionFreezeSha256: 'a'.repeat(64),
    })).toThrow(/PATCH83U_SQL_EDITOR_EVIDENCE_CHANNEL_AND_OUTPUT_REQUIRED/);
    expect(() => createExecutionPlan({
      execute: true,
      appUrl: STAGING_APPLICATION_ORIGIN,
      supabaseUrl: STAGING_SUPABASE_ORIGIN,
      evidenceChannel: SQL_EDITOR_EVIDENCE_CHANNEL,
      sqlEditorProjectRef: STAGING_PROJECT_REF,
      out:
        `${RUN007_EVIDENCE_DIRECTORY}/`
        + 'patch83u-staging-reset-final-results-attempt-999.json',
      checkpointDir: SQL_EDITOR_CHECKPOINT_DIRECTORY,
    })).toThrow(/PATCH83U_EXECUTION_FREEZE_AND_HASH_REQUIRED/);
    expect(harnessSource).not.toMatch(/\brunPsqlEvidence\b|\bspawn\('psql'/);
  });

  it('proves Auth outcomes and identities instead of relying on timing or route denial alone', () => {
    expect(harnessSource).toContain('page.waitForResponse(isPasswordTokenResponse');
    expect(harnessSource).toContain("candidate.request().method() === 'POST'");
    expect(harnessSource).toContain('assertFreshPermanentLoginProof({');
    expect(harnessSource).toContain('oldPasswordResult.failed !== true');
    expect(harnessSource).toContain('Password change required|تغيير كلمة المرور مطلوب');
    expect(harnessSource).not.toContain('page.waitForTimeout(1500)');
    expect(harnessSource).not.toContain('assert.equal(');
  });

  it('binds browser mutations to the two reviewed Edge action names', () => {
    expect(harnessSource).toContain("patch83u_admin_reset_password");
    expect(harnessSource).toContain("patch83u_change_required_password");
    expect(harnessSource).toContain("body?.action !== ADMIN_RESET_ACTION");
    expect(harnessSource).toContain("body?.action !== REQUIRED_PASSWORD_CHANGE_ACTION");
  });

  it('binds the reset transport envelope to the exact target before network continuation', () => {
    const requestId = 'patch83u-safe-request-1';
    expect(inspectResetActionEnvelope({
      action: ADMIN_RESET_ACTION,
      payload: {
        user_id: TARGET_USER_ID,
        employee_id_confirmation: TARGET_EMPLOYEE_ID,
        confirmation: 'PATCH83U_RESET_USER_PASSWORD',
        request_id: requestId,
      },
    })).toBe(requestId);
    expect(() => inspectResetActionEnvelope({
      action: ADMIN_RESET_ACTION,
      request_id: requestId,
    })).toThrow(/PATCH83U_RESET_REQUEST_CONTRACT_REFUSED/);
    expect(() => inspectResetActionEnvelope({
      action: ADMIN_RESET_ACTION,
      payload: {
        user_id: DESIGNATED_SUPER_ADMIN_ID,
        employee_id_confirmation: TARGET_EMPLOYEE_ID,
        confirmation: 'PATCH83U_RESET_USER_PASSWORD',
        request_id: requestId,
      },
    })).toThrow(/PATCH83U_RESET_REQUEST_CONTRACT_REFUSED/);
    expect(harnessSource).toContain("await route.abort('blockedbyclient')");
    expect(harnessSource).toContain('resetRequestCount !== 1');
  });

  it('binds the required-password-change envelope and permits one network submission', () => {
    const requestId = 'patch83u-safe-change-request-1';
    expect(inspectRequiredPasswordChangeEnvelope({
      action: 'patch83u_change_required_password',
      payload: {
        current_password: 'temporary-value',
        new_password: 'permanent-value',
        confirm_new_password: 'permanent-value',
        request_id: requestId,
      },
    }, {
      currentPassword: 'temporary-value',
      newPassword: 'permanent-value',
    })).toBe(requestId);
    expect(() => inspectRequiredPasswordChangeEnvelope({
      action: 'patch83u_change_required_password',
      payload: {
        current_password: 'temporary-value',
        new_password: 'different-value',
        confirm_new_password: 'different-value',
        request_id: requestId,
      },
    }, {
      currentPassword: 'temporary-value',
      newPassword: 'permanent-value',
    })).toThrow(/PATCH83U_PASSWORD_CHANGE_REQUEST_CONTRACT_REFUSED/);
    expect(harnessSource).toContain('attemptSubmissionCount !== 1');
  });

  it('reads only the project-scoped staging Auth storage slot', () => {
    expect(STAGING_AUTH_STORAGE_KEY).toBe(
      `grc-control-center-auth:${STAGING_PROJECT_REF}`,
    );
    expect(harnessSource).toContain(
      'globalThis.localStorage.getItem(storageKey)',
    );
    expect(harnessSource).not.toContain(
      "globalThis.localStorage.getItem('grc-control-center-auth')",
    );
  });

  it('runs every pre-credential gate through local/read-only adapters only', async () => {
    const fixture = edgeDeploymentGateFixture();
    const {
      observedMetadata,
      observedDownloadedSource,
      ...artifactInputs
    } = fixture;
    const loadEdgeGateArtifacts = vi.fn().mockResolvedValue(artifactInputs);
    const readActiveEdgeMetadata = vi.fn().mockResolvedValue(observedMetadata);
    const downloadActiveEdgeSource = vi.fn().mockResolvedValue(
      observedDownloadedSource,
    );
    const loadStagingFrontendLaunch = vi.fn().mockResolvedValue({
      projectRef: STAGING_PROJECT_REF,
      origin: STAGING_APPLICATION_ORIGIN,
      mode: 'staging',
    });
    const fetchApplication = vi.fn().mockResolvedValue({
      ok: true,
      url: STAGING_APPLICATION_ORIGIN,
      body: { cancel: vi.fn() },
    });
    const runCleanBrowserReadiness = vi.fn().mockResolvedValue({
      signed_out_before_reload: true,
      signed_out_after_reload: true,
      staging_project_exact: true,
      production_request_absent: true,
    });
    const resolveOutputPath = vi.fn().mockResolvedValue(
      'C:\\safe-mock\\run007-output.json',
    );
    const resolveCheckpointDirectory = vi.fn().mockResolvedValue(
      Object.freeze({ absolutePath: 'C:\\safe-mock\\checkpoints' }),
    );
    const loadRun008BrowserConfiguration = vi.fn().mockResolvedValue({
      projectRef: STAGING_PROJECT_REF,
      supabaseUrl: STAGING_SUPABASE_ORIGIN,
      publicApiKey: new SecretValue(
        Buffer.from('sb_publishable_synthetic_unit_test_only', 'utf8'),
      ),
    });

    const result = await runPreCredentialReadiness({
      precredentialReadinessOnly: true,
      precredentialNoSecretFixture: true,
      execute: false,
      appUrl: STAGING_APPLICATION_ORIGIN,
      supabaseUrl: STAGING_SUPABASE_ORIGIN,
      evidenceChannel: SQL_EDITOR_EVIDENCE_CHANNEL,
      sqlEditorProjectRef: STAGING_PROJECT_REF,
      out:
        `${RUN007_EVIDENCE_DIRECTORY}/`
        + 'patch83u-staging-reset-final-results-attempt-998.json',
      checkpointDir: SQL_EDITOR_CHECKPOINT_DIRECTORY,
      executionFreeze: 'not-read-by-the-injected-test-adapter',
      executionFreezeSha256: fixture.authorizedFreezeFileSha256,
    }, {
      loadEdgeGateArtifacts,
      readActiveEdgeMetadata,
      downloadActiveEdgeSource,
      loadStagingFrontendLaunch,
      fetchApplication,
      runCleanBrowserReadiness,
      resolveOutputPath,
      resolveCheckpointDirectory,
      loadRun008BrowserConfiguration,
    });

    expect(result.initialEdgeDeploymentGate.passed).toBe(true);
    expect(result.noSecretFixture).toBe(true);
    expect(loadStagingFrontendLaunch).toHaveBeenCalledOnce();
    expect(fetchApplication).toHaveBeenCalledOnce();
    expect(readActiveEdgeMetadata).toHaveBeenCalledOnce();
    expect(downloadActiveEdgeSource).toHaveBeenCalledOnce();
    expect(runCleanBrowserReadiness).toHaveBeenCalledOnce();
    expect(resolveOutputPath).toHaveBeenCalledOnce();
    expect(resolveCheckpointDirectory).toHaveBeenCalledOnce();
    expect(loadRun008BrowserConfiguration).toHaveBeenCalledOnce();
    result.browserConfiguration.publicApiKey.clear();
    const precredentialSource = runPreCredentialReadiness.toString();
    expect(precredentialSource).not.toContain('promptHidden');
    expect(precredentialSource).not.toContain('runSqlEditorEvidence');
    expect(precredentialSource).not.toContain('ResetSubmissionController');
    expect(precredentialSource).not.toContain('request_id');
    expect(precredentialSource).not.toContain('writeFile');
  });

  it('requires a distinct pre-credential mode and emits only the exact result phrase', async () => {
    expect(parseCliArguments(['--precredential-readiness-only'])).toMatchObject({
      execute: false,
      precredentialReadinessOnly: true,
    });
    expect(() => parseCliArguments([
      '--precredential-readiness-only',
      '--execute-hosted-proof',
    ])).toThrow(/PATCH83U_EXECUTION_MODE_CONFLICT/);

    const runReadiness = vi.fn().mockResolvedValue({ passed: true });
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await expect(main([
        '--precredential-readiness-only',
        '--app-url',
        STAGING_APPLICATION_ORIGIN,
        '--supabase-url',
        STAGING_SUPABASE_ORIGIN,
        '--evidence-channel',
        SQL_EDITOR_EVIDENCE_CHANNEL,
        '--sql-editor-project-ref',
        STAGING_PROJECT_REF,
        '--out',
        `${RUN007_EVIDENCE_DIRECTORY}/`
          + 'patch83u-staging-reset-final-results-attempt-997.json',
        '--checkpoint-dir',
        SQL_EDITOR_CHECKPOINT_DIRECTORY,
        '--execution-freeze',
        'release/patch83u/patch83u-staging-reset-execution-freeze-v6-20260720.json',
        '--execution-freeze-sha256',
        'a'.repeat(64),
      ], {
        runPreCredentialReadiness: runReadiness,
      })).resolves.toEqual({ passed: true });
      expect(stdout).toHaveBeenCalledTimes(1);
      expect(stdout).toHaveBeenCalledWith(`${PRE_CREDENTIAL_READINESS_PASSED}\n`);
      expect(runReadiness).toHaveBeenCalledOnce();
    } finally {
      stdout.mockRestore();
    }
  });

  it('emits only the exact fail-closed pre-credential phrase on failure', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await expect(main([
        '--precredential-readiness-only',
        '--app-url',
        STAGING_APPLICATION_ORIGIN,
        '--supabase-url',
        STAGING_SUPABASE_ORIGIN,
        '--evidence-channel',
        SQL_EDITOR_EVIDENCE_CHANNEL,
        '--sql-editor-project-ref',
        STAGING_PROJECT_REF,
        '--out',
        `${RUN007_EVIDENCE_DIRECTORY}/`
          + 'patch83u-staging-reset-final-results-attempt-996.json',
        '--checkpoint-dir',
        SQL_EDITOR_CHECKPOINT_DIRECTORY,
        '--execution-freeze',
        'release/patch83u/patch83u-staging-reset-execution-freeze-v6-20260720.json',
        '--execution-freeze-sha256',
        'a'.repeat(64),
      ], {
        runPreCredentialReadiness: vi.fn().mockRejectedValue(
          new Error('SAFE_MOCK_FAILURE'),
        ),
      })).rejects.toThrow(/PATCH83U_PRE_CREDENTIAL_READINESS_FAILED/);
      expect(stdout).toHaveBeenCalledTimes(1);
      expect(stdout).toHaveBeenCalledWith(`${PRE_CREDENTIAL_READINESS_FAILED}\n`);
    } finally {
      stdout.mockRestore();
    }
  });

  it('is inert without explicit execution and makes no hosted call in unit tests', () => {
    const hostedCall = vi.fn();
    const readActiveEdgeMetadata = vi.fn();
    const plan = createExecutionPlan({
      execute: false,
      appUrl: STAGING_APPLICATION_ORIGIN,
      supabaseUrl: `https://${STAGING_PROJECT_REF}.supabase.co`,
    }, {
      hostedCallCount: () => hostedCall.mock.calls.length,
      readActiveEdgeMetadata,
    });
    expect(plan).toEqual({
      executable: false,
      reason: 'PATCH83U_EXPLICIT_EXECUTION_FLAG_REQUIRED',
      hostedCallCount: 0,
    });
    expect(hostedCall).not.toHaveBeenCalled();
    expect(readActiveEdgeMetadata).not.toHaveBeenCalled();
    expect(harnessSource).toContain(ADMIN_RESET_ACTION);
  });
});
