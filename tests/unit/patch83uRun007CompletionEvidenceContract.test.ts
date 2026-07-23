import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  BROWSER_EVIDENCE_OPTIONS,
  ADMIN_RESET_ACTION,
  CONTROLLED_EMPLOYEE_CONTEXT_LABELS,
  DESIGNATED_SUPER_ADMIN_ID,
  EDGE_DEPLOYMENT_GATE_CHECK_NAMES,
  EXPECTED_FINAL_SESSION_COUNT,
  EXPECTED_FINAL_UNREVOKED_REFRESH_TOKEN_COUNT,
  EXPECTED_TEMPORARY_SESSION_COUNT,
  EXPECTED_TEMPORARY_UNREVOKED_REFRESH_TOKEN_COUNT,
  FINALIZER_RPC,
  FORCED_PASSWORD_CHANGE_PROTECTED_ROUTES,
  PASSWORD_CHANGE_MAX_ATTEMPTS,
  PERMANENT_PASSWORD_POLICY_ERROR_CODE,
  PRODUCTION_PROJECT_REF,
  RUN_NUMBER,
  RUN007_OPERATOR_CONFIRMATION_CONTRACT_ID as CURRENT_OPERATOR_CONFIRMATION_CONTRACT_ID,
  RESET_CONFIRMATION_TEXT,
  SQL_EDITOR_CHECKPOINTS,
  STAGING_APPLICATION_ORIGIN,
  STAGING_PROJECT_REF,
  STAGING_SUPABASE_ORIGIN,
  TARGET_USER_ID,
  TARGET_EMPLOYEE_ID,
  ResetSubmissionController,
  SecretValue,
  assertAfterPasswordChangeAggregate,
  assertAdminContextReadinessProof,
  assertBeforeRequiredPasswordChangeAggregate,
  assertBothControlledRefreshesAggregate,
  assertBothStaleContextsDeniedAggregate,
  assertBrowserDiagnosticsSafe,
  assertCheckpoint1ReadOnlyAggregate,
  assertCheckpoint3AlwaysAggregate,
  assertCompletedExecutionEvidence as assertCurrentCompletedExecutionEvidence,
  assertControlledEmployeeContextProofs,
  assertControlledEmployeeSessionSetupProof,
  assertEvidenceMatchesSchemaContract,
  assertFinalizerAndRecoveryReadyAggregate,
  assertFinalEmployeeAuthorizationProof,
  assertFinalFreshLoginAggregate,
  assertFrontendOriginExactAggregate,
  assertFreshPermanentLoginProof,
  assertInitialEmployeeStateAggregate,
  assertNetworkConsoleSafeAggregate,
  assertNonpersistentBrowserContext,
  assertOneShotResetAggregate,
  assertPasswordChangeCompletionProof,
  assertPostResetSuccessAggregate,
  assertPreResetCheckpointAggregate,
  assertProtectedStateFailClosedAggregate,
  assertRuntimeAndContractsExactAggregate,
  assertSecretAndPolicyControlsAggregate,
  assertStableResetRequestCorrelationAggregate,
  assertStagingAndProductionBoundaryAggregate,
  assertExactResetConfirmationsProof,
  assertTemporaryPasswordRestrictedLoginProof,
  assertTemporaryPasswordSessionCounts,
  browserRequestAbortWasIntentional,
  browserRequestIsAllowed,
  buildPassedPreflightEvidence,
  createSafeBrowserContext,
  createSafeBrowserDiagnosticsState,
  evaluateResetProgression,
  evaluateForcedPasswordChangeSurfaceProof,
  markIntentionalBrowserRequestAbort,
  parseCliArguments,
  promptHidden,
  recordSafeBrowserDiagnostic,
  safeBrowserDiagnosticsEvidence,
  serializeRedactedEvidence,
} from '../../scripts/patch83u-staging-multisession-reset-proof.mjs';
import {
  RUN007_CONFIRMATION_CONTRACT_ID,
} from '../../scripts/patch83u-run007-contract-audit.mjs';

const evidenceSchema = JSON.parse(
  readFileSync(
    resolve('release/patch83u/patch83u-staging-reset-harness-schema-v6.json'),
    'utf8',
  ),
);
const checkpointSchema = JSON.parse(
  readFileSync(
    resolve('release/patch83u/patch83u-staging-checkpoint-file-schema-v3.json'),
    'utf8',
  ),
);
const harnessSource = readFileSync(
  resolve('scripts/patch83u-staging-multisession-reset-proof.mjs'),
  'utf8',
);
const sqlEditorSource = readFileSync(
  resolve('scripts/patch83u-staging-sql-editor-evidence.sql'),
  'utf8',
);

async function createRegisteredNonpersistentContext() {
  const context = {
    on: vi.fn(),
    route: vi.fn(async () => undefined),
  };
  const browser = {
    newContext: vi.fn(async () => context),
  };
  await createSafeBrowserContext(
    browser,
    {
      baseURL: 'http://localhost:5173',
      recordHar: undefined,
      recordVideo: undefined,
      storageState: undefined,
    },
    {
      violation: null,
      diagnostics: createSafeBrowserDiagnosticsState(),
    },
  );
  return context;
}

function checkpointInputs() {
  return SQL_EDITOR_CHECKPOINTS.map((checkpoint, index) => ({
    checkpoint,
    source: 'sql_editor_checkpoint_file',
    checkpoint_file_sha256: String(index + 1).repeat(64),
    checkpoint_file_bytes: 1_000 + index,
    project_ref_exact: true,
    transaction_read_only: true,
    prohibited_fields_absent: true,
    observed_at: `2026-07-20T10:0${index}:00.000Z`,
  }));
}

function credentialProof({
  state,
  version,
  sessionCount,
  refreshCount,
}: {
  state: string;
  version: number;
  sessionCount: number;
  refreshCount: number;
}) {
  return {
    credential_state: state,
    database_credential_version: version,
    auth_credential_version: version,
    requested_lifecycle: 'active',
    session_count: sessionCount,
    unrevoked_refresh_token_count: refreshCount,
    role: 'employee',
    scope: 'assigned_only',
    observed_at: '2026-07-20T10:10:00.000Z',
  };
}

function employeeContextProof(label: string) {
  return {
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
  };
}

function staleContextProof(label: string) {
  return {
    label,
    authenticated_user_absent: true,
    sign_in_visible: true,
    employee_content_absent: true,
    admin_content_absent: true,
    protected_route_access_denied: true,
  };
}

function run007OperatorConfirmationContract() {
  return {
    contract_id: RUN007_CONFIRMATION_CONTRACT_ID,
    run_number: 7,
    exact_phrase: 'EXECUTE RUN 007 RESET NOW',
    case_sensitive: true,
    cli_override_supported: false,
    required_immediately_before_reset: true,
    evidence_retention: 'boolean_and_contract_id_only',
  };
}

function currentOperatorConfirmationContract() {
  return {
    ...run007OperatorConfirmationContract(),
    contract_id: CURRENT_OPERATOR_CONFIRMATION_CONTRACT_ID,
    run_number: RUN_NUMBER,
    exact_phrase: `EXECUTE RUN ${String(RUN_NUMBER).padStart(3, '0')} RESET NOW`,
  };
}

function assertCompletedExecutionEvidence(evidence: Record<string, unknown>) {
  const adapted = structuredClone(evidence) as Record<string, any>;
  if (adapted.operator_confirmation) {
    adapted.operator_confirmation.contract_id = CURRENT_OPERATOR_CONFIRMATION_CONTRACT_ID;
  }
  return assertCurrentCompletedExecutionEvidence(adapted);
}

function assertHistoricalConfirmationAndFinalSessionContracts(input: any) {
  const confirmation = input?.operatorConfirmationContract;
  const sessions = input?.finalSessionContract;
  if (
    confirmation?.contract_id !== RUN007_CONFIRMATION_CONTRACT_ID
    || confirmation?.run_number !== 7
    || confirmation?.exact_phrase !== 'EXECUTE RUN 007 RESET NOW'
    || confirmation?.cli_override_supported !== false
    || sessions?.expected_session_count !== 1
    || sessions?.expected_unrevoked_refresh_token_count !== 1
    || sessions?.cli_override_supported !== false
  ) {
    throw new Error('PATCH83U_RUN007_CONFIRMATION_AND_FINAL_SESSION_CONTRACTS_FAILED');
  }
  return input;
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

function finalAuthorizationProof() {
  return {
    authentication_succeeded: true,
    permitted_employee_page_accessible: true,
    admin_route_denied: true,
    admin_redirect_destination_permitted: true,
    admin_navigation_absent: true,
    user_management_absent: true,
    access_control_absent: true,
    provisioning_controls_absent: true,
  };
}

function auditSnapshot(
  kind: 'admin_reset' | 'password_change',
  requestIdHash = 'a'.repeat(64),
) {
  const passwordChange = kind === 'password_change';
  return {
    credential_event_count: 1,
    latest_event_type: passwordChange
      ? 'password_change_completed'
      : 'admin_reset_completed',
    latest_event_code: passwordChange
      ? 'PATCH83U_PASSWORD_CHANGE_COMPLETED'
      : 'PATCH83U_ADMIN_RESET_COMPLETED',
    latest_event_credential_version: passwordChange ? 6 : 5,
    latest_event_request_id_hash: requestIdHash,
    latest_event_at: '2026-07-20T10:10:00.000Z',
    operation_count: 1,
    latest_operation_type: kind,
    latest_operation_status: 'completed',
    latest_operation_current_version: passwordChange ? 5 : 4,
    latest_operation_next_version: passwordChange ? 6 : 5,
    latest_operation_resulting_state: passwordChange
      ? 'active'
      : 'admin_reset_change_required',
    latest_operation_auth_changed: true,
    latest_operation_revocation_confirmed: true,
    latest_operation_request_id_hash: requestIdHash,
    latest_operation_completed_at: '2026-07-20T10:10:00.000Z',
  };
}

function completedEvidence() {
  return {
    schema_version: evidenceSchema.properties.schema_version.const,
    generated_at: '2026-07-20T10:10:00.000Z',
    execution_status: 'completed',
    project_ref: STAGING_PROJECT_REF,
    subject_user_id: TARGET_USER_ID,
    request_id_hash: 'a'.repeat(64),
    checkpoint_inputs: checkpointInputs(),
    preflight: {
      passed: true,
      checks: {
        staging_project_confirmed: true,
        runtime_enforced: true,
      },
      failed: [],
    },
    reset: {
      submitted: true,
      submission_count: 1,
      http_status: 200,
      safe_error_code: null,
      terminal_proof: credentialProof({
        state: 'admin_reset_change_required',
        version: 5,
        sessionCount: 0,
        refreshCount: 0,
      }),
      edge_success_confirmed: true,
      checkpoint_classification: 'admin_reset_change_required',
      checkpoint_success_confirmed: true,
      protected_transition_completed: true,
      request_correlation_proven: true,
      post_submission_cleanup_succeeded: true,
      progression_allowed: true,
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
        observed_at: '2026-07-20T10:10:00.000Z',
      })),
      stale_context_1_denied: true,
      stale_context_2_denied: true,
      stale_contexts: CONTROLLED_EMPLOYEE_CONTEXT_LABELS.map(staleContextProof),
      database_session_count: 0,
      unrevoked_refresh_token_count: 0,
      observed_at: '2026-07-20T10:10:00.000Z',
    },
    forced_password_change_gate: {
      temporary_login_succeeded: true,
      forced_change_only: true,
      normal_application_access_denied: true,
      nonpersistent_context: true,
      authenticated_user_id: TARGET_USER_ID,
      forced_change_visible: true,
      forced_change_visible_after_protected_navigation: true,
      application_shell_absent: true,
      sidebar_absent: true,
      employee_content_absent: true,
      admin_content_absent: true,
      provisioning_controls_absent: true,
      observed_at: '2026-07-20T10:10:00.000Z',
    },
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
      finalizer_rpc: FINALIZER_RPC,
      terminal_proof: credentialProof({
        state: 'active',
        version: 6,
        sessionCount: 0,
        refreshCount: 0,
      }),
      browser_signed_out: true,
      password_changed_at_set: true,
      sessions_revoked_at_set: true,
      reconciliation_auth_changed: false,
    },
    fresh_login: {
      permanent_login_succeeded: true,
      nonpersistent_context: true,
      authenticated_user_id: TARGET_USER_ID,
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
      observed_at: '2026-07-20T10:10:00.000Z',
    },
    audit: {
      after_reset: auditSnapshot('admin_reset'),
      after_password_change: auditSnapshot('password_change', 'b'.repeat(64)),
    },
    employee_contexts_before_reset:
      CONTROLLED_EMPLOYEE_CONTEXT_LABELS.map(employeeContextProof),
    operator_confirmation: {
      contract_id: RUN007_CONFIRMATION_CONTRACT_ID,
      exact_match: true,
    },
    browser_diagnostics: {
      safe: true,
      console_error_count: 0,
      page_error_count: 0,
      request_failure_count: 0,
      server_error_response_count: 0,
    },
    events: [],
    operator_guidance: [],
  };
}

function checkpoint4Snapshot() {
  return {
    checkpoint: 'before_required_password_change',
    expected_project_ref: STAGING_PROJECT_REF,
    operator_project_confirmation_required: true,
    transaction_read_only: true,
    captured_at: '2026-07-20T10:10:00.000Z',
    runtime: {
      schema_version: '174.2-auth-first',
      enforcement_state: 'enforced',
      state_version: 5,
      edge_contract: 'patch83u-edge-auth-first-v1',
      frontend_contract: 'patch83u-frontend-auth-first-v1',
      designated_super_admin_id: '83d92a59-6909-44e7-80f3-aff60a6734fb',
      request_hash_function_available: true,
    },
    target: {
      user_id: TARGET_USER_ID,
      profile_state: 'active',
      profile_active: true,
      same_organization_as_designated_admin: true,
      credential_state: 'admin_reset_change_required',
      credential_version: 5,
      auth_credential_version: 5,
      requested_lifecycle: 'active',
      role: 'employee',
      scope: 'assigned_only',
      active_role_count: 1,
      pending_operation: false,
      pending_operation_count: 0,
      session_count: EXPECTED_TEMPORARY_SESSION_COUNT,
      unrevoked_refresh_token_count:
        EXPECTED_TEMPORARY_UNREVOKED_REFRESH_TOKEN_COUNT,
      updated_at: '2026-07-20T10:10:00.000Z',
    },
    admin: {
      user_id: '83d92a59-6909-44e7-80f3-aff60a6734fb',
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
      updated_at: '2026-07-20T10:10:00.000Z',
    },
    audit: {},
    eligible_super_admin_count: 1,
  };
}

function fullInitialCatalogProof() {
  return {
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
  };
}

function checkpointSnapshot(
  checkpoint:
    | 'before_employee_sessions'
    | 'immediately_before_reset'
    | 'immediately_after_reset'
    | 'before_required_password_change'
    | 'immediately_after_password_change_finalization'
    | 'after_fresh_employee_login',
) {
  const snapshot: any = structuredClone(checkpoint4Snapshot());
  snapshot.checkpoint = checkpoint;
  if (checkpoint === 'before_employee_sessions') {
    Object.assign(snapshot.target, {
      credential_state: 'active',
      credential_version: 4,
      auth_credential_version: 4,
      session_count: 0,
      unrevoked_refresh_token_count: 0,
    });
    Object.assign(snapshot, fullInitialCatalogProof());
  } else if (checkpoint === 'immediately_before_reset') {
    Object.assign(snapshot.target, {
      credential_state: 'active',
      credential_version: 4,
      auth_credential_version: 4,
      session_count: 2,
      unrevoked_refresh_token_count: 2,
    });
    Object.assign(snapshot, fullInitialCatalogProof());
  } else if (checkpoint === 'immediately_after_reset') {
    Object.assign(snapshot.target, {
      credential_state: 'admin_reset_change_required',
      credential_version: 5,
      auth_credential_version: 5,
      session_count: 0,
      unrevoked_refresh_token_count: 0,
      reconciliation_auth_changed: false,
    });
  } else if (checkpoint === 'immediately_after_password_change_finalization') {
    Object.assign(snapshot.target, {
      credential_state: 'active',
      credential_version: 6,
      auth_credential_version: 6,
      session_count: 0,
      unrevoked_refresh_token_count: 0,
      password_changed_at_set: true,
      sessions_revoked_at_set: true,
      reconciliation_auth_changed: false,
    });
  } else if (checkpoint === 'after_fresh_employee_login') {
    Object.assign(snapshot.target, {
      credential_state: 'active',
      credential_version: 6,
      auth_credential_version: 6,
      session_count: 1,
      unrevoked_refresh_token_count: 1,
    });
  }
  return snapshot;
}

function stagingConfiguration() {
  return {
    project_ref: STAGING_PROJECT_REF,
    supabase_url: STAGING_SUPABASE_ORIGIN,
    app_url: STAGING_APPLICATION_ORIGIN,
  };
}

function cleanTargetGuard() {
  return {
    violation: null,
    diagnostics: createSafeBrowserDiagnosticsState(),
  };
}

function exactEdgeDeploymentChecks() {
  return Object.fromEntries(
    EDGE_DEPLOYMENT_GATE_CHECK_NAMES.map((name) => [name, true]),
  );
}

function resetEnvelope(requestId = 'patch83u-run007-request-001') {
  return {
    action: ADMIN_RESET_ACTION,
    payload: {
      user_id: TARGET_USER_ID,
      employee_id_confirmation: TARGET_EMPLOYEE_ID,
      confirmation: 'PATCH83U_RESET_USER_PASSWORD',
      request_id: requestId,
    },
  };
}

describe('Patch 83U Run 007 completion evidence contract', () => {
  it('requires exactly one disposable temporary-password session and one unrevoked refresh row at Checkpoint 4', () => {
    const valid = checkpoint4Snapshot();
    expect(assertTemporaryPasswordSessionCounts(valid)).toBe(true);
    expect(assertEvidenceMatchesSchemaContract(valid, checkpointSchema)).toBe(true);

    for (const field of [
      'session_count',
      'unrevoked_refresh_token_count',
    ] as const) {
      for (const value of [0, 2, '1', null, undefined]) {
        const drifted = structuredClone(valid);
        if (value === undefined) {
          delete (drifted.target as Partial<typeof drifted.target>)[field];
        } else {
          (drifted.target as Record<string, unknown>)[field] = value;
        }
        expect(() => assertTemporaryPasswordSessionCounts(drifted)).toThrow(
          /PATCH83U_TEMPORARY_SESSION_COUNT_CONTRACT_FAILED/,
        );
        expect(() => assertEvidenceMatchesSchemaContract(
          drifted,
          checkpointSchema,
        )).toThrow(/PATCH83U_SCHEMA_ONE_OF_FAILED/);
      }
    }
  });

  it('rejects incomplete or semantically false completed evidence', () => {
    const valid = completedEvidence();
    expect(assertCompletedExecutionEvidence(valid)).toBe(true);
    expect(assertEvidenceMatchesSchemaContract(valid, evidenceSchema)).toBe(true);

    for (const block of [
      'preflight',
      'reset',
      'revocation',
      'forced_password_change_gate',
      'audit',
      'employee_contexts_before_reset',
      'operator_confirmation',
      'browser_diagnostics',
    ] as const) {
      const missing = structuredClone(valid);
      delete (missing as Partial<typeof valid>)[block];
      expect(() => assertCompletedExecutionEvidence(missing)).toThrow();
    }

    const resetNotSubmitted = structuredClone(valid);
    resetNotSubmitted.reset.submitted = false;
    expect(() => assertCompletedExecutionEvidence(resetNotSubmitted)).toThrow(
      /PATCH83U_COMPLETED_RESET_PROOF_INVALID/,
    );

    const freshLoginFailed = structuredClone(valid);
    freshLoginFailed.fresh_login.permanent_login_succeeded = false;
    expect(() => assertCompletedExecutionEvidence(freshLoginFailed)).toThrow(
      /PATCH83U_FINAL_EMPLOYEE_AUTHORIZATION_PROOF_FAILED/,
    );
  });

  it('requires every forced-password-change surface proof', () => {
    const valid = {
      forced_change_visible: true,
      forced_change_visible_after_protected_navigation: true,
      application_shell_absent: true,
      sidebar_absent: true,
      employee_content_absent: true,
      admin_content_absent: true,
      provisioning_controls_absent: true,
    };
    expect(evaluateForcedPasswordChangeSurfaceProof(valid).passed).toBe(true);
    for (const field of Object.keys(valid)) {
      expect(evaluateForcedPasswordChangeSurfaceProof({
        ...valid,
        [field]: false,
      }).passed).toBe(false);
    }
    expect(FORCED_PASSWORD_CHANGE_PROTECTED_ROUTES).toEqual([
      'home',
      'my-work',
      'admin',
    ]);
    for (const routeValue of FORCED_PASSWORD_CHANGE_PROTECTED_ROUTES) {
      expect(harnessSource).toContain(
        'for (const routeValue of FORCED_PASSWORD_CHANGE_PROTECTED_ROUTES)',
      );
      expect(typeof routeValue).toBe('string');
    }
  });

  it('requires the full final Employee authorization surface', () => {
    const valid = {
      authentication_succeeded: true,
      permitted_employee_page_accessible: true,
      admin_route_denied: true,
      admin_redirect_destination_permitted: true,
      admin_navigation_absent: true,
      user_management_absent: true,
      access_control_absent: true,
      provisioning_controls_absent: true,
    };
    expect(assertFinalEmployeeAuthorizationProof(valid)).toBe(true);
    for (const field of Object.keys(valid)) {
      expect(() => assertFinalEmployeeAuthorizationProof({
        ...valid,
        [field]: false,
      })).toThrow(/PATCH83U_FINAL_EMPLOYEE_AUTHORIZATION_PROOF_FAILED/);
    }
  });

  it('records only safe diagnostic counts and fails closed on any browser error', () => {
    const targetGuard = {
      violation: null,
      diagnostics: createSafeBrowserDiagnosticsState(),
    };
    expect(safeBrowserDiagnosticsEvidence(targetGuard)).toEqual({
      safe: true,
      console_error_count: 0,
      page_error_count: 0,
      request_failure_count: 0,
      server_error_response_count: 0,
    });
    expect(assertBrowserDiagnosticsSafe(targetGuard)).toBe(true);
    expect(recordSafeBrowserDiagnostic(
      targetGuard.diagnostics,
      'console_error',
    )).toBe('PATCH83U_BROWSER_CONSOLE_ERROR_OBSERVED');
    expect(() => assertBrowserDiagnosticsSafe(targetGuard)).toThrow(
      /PATCH83U_BROWSER_DIAGNOSTICS_NOT_CLEAN/,
    );
    expect(safeBrowserDiagnosticsEvidence(targetGuard)).toMatchObject({
      safe: false,
      console_error_count: 1,
    });
  });

  it('does not misclassify an intentional blocked-by-client request as an unexpected failure', () => {
    const request = {};
    const targetGuard = {
      violation: null,
      diagnostics: createSafeBrowserDiagnosticsState(),
    };
    expect(browserRequestAbortWasIntentional(targetGuard, request)).toBe(false);
    expect(markIntentionalBrowserRequestAbort(targetGuard, request)).toBe(true);
    expect(browserRequestAbortWasIntentional(targetGuard, request)).toBe(true);
    expect(safeBrowserDiagnosticsEvidence(targetGuard)).toEqual({
      safe: true,
      console_error_count: 0,
      page_error_count: 0,
      request_failure_count: 0,
      server_error_response_count: 0,
    });
  });

  it('proves temporary-password and fresh-login contexts use nonpersistent browser.newContext orchestration', async () => {
    const context = {
      on: vi.fn(),
      route: vi.fn(async () => undefined),
    };
    const browser = {
      newContext: vi.fn(async () => context),
      launchPersistentContext: vi.fn(() => {
        throw new Error('persistent context must not be used');
      }),
    };
    const targetGuard = {
      violation: null,
      diagnostics: createSafeBrowserDiagnosticsState(),
    };
    const safeOptions = {
      baseURL: 'http://localhost:5173',
      recordHar: BROWSER_EVIDENCE_OPTIONS.recordHar,
      recordVideo: BROWSER_EVIDENCE_OPTIONS.recordVideo,
      storageState: BROWSER_EVIDENCE_OPTIONS.storageState,
    };
    const created = await createSafeBrowserContext(
      browser,
      safeOptions,
      targetGuard,
    );
    expect(created).toBe(context);
    expect(browser.newContext).toHaveBeenCalledOnce();
    expect(browser.newContext).toHaveBeenCalledWith(safeOptions);
    expect(browser.launchPersistentContext).not.toHaveBeenCalled();
    expect(assertNonpersistentBrowserContext(created)).toBe(true);
    expect(() => assertNonpersistentBrowserContext({})).toThrow(
      /PATCH83U_NONPERSISTENT_BROWSER_CONTEXT_NOT_PROVEN/,
    );
    await expect(createSafeBrowserContext(
      browser,
      {
        ...safeOptions,
        storageState: 'forbidden-storage-state.json',
      },
      targetGuard,
    )).rejects.toThrow(/PATCH83U_BROWSER_CAPTURE_OPTIONS_UNSAFE/);
  });

  it('proves admin and Employee pre-reset contexts are nonpersistent and identity-bound', async () => {
    const originalContext = await createRegisteredNonpersistentContext();
    const secondaryContext = await createRegisteredNonpersistentContext();
    expect(assertAdminContextReadinessProof({
      originalContext,
      secondaryContext,
      originalAdminUserId: '83d92a59-6909-44e7-80f3-aff60a6734fb',
      secondaryAdminUserId: '83d92a59-6909-44e7-80f3-aff60a6734fb',
      originalContextAvailable: true,
      secondaryReauthenticated: true,
    })).toBe(true);
    expect(assertControlledEmployeeContextProofs(
      CONTROLLED_EMPLOYEE_CONTEXT_LABELS.map(employeeContextProof),
    ).passed).toBe(true);

    expect(() => assertAdminContextReadinessProof({
      originalContext,
      secondaryContext,
      originalAdminUserId: TARGET_USER_ID,
      secondaryAdminUserId: '83d92a59-6909-44e7-80f3-aff60a6734fb',
      originalContextAvailable: true,
      secondaryReauthenticated: true,
    })).toThrow(/PATCH83U_ADMIN_CONTEXT_READINESS_PROOF_FAILED/);

    const employeeProofs = CONTROLLED_EMPLOYEE_CONTEXT_LABELS.map(
      employeeContextProof,
    );
    employeeProofs[0].nonpersistent_context = false;
    expect(() => assertControlledEmployeeContextProofs(employeeProofs)).toThrow(
      /PATCH83U_CONTROLLED_EMPLOYEE_CONTEXT_PROOF_FAILED/,
    );
  });

  it('proves temporary-password login combines nonpersistent target identity and forced-only surface', async () => {
    const context = await createRegisteredNonpersistentContext();
    const surfaceProof = evaluateForcedPasswordChangeSurfaceProof({
      forced_change_visible: true,
      forced_change_visible_after_protected_navigation: true,
      application_shell_absent: true,
      sidebar_absent: true,
      employee_content_absent: true,
      admin_content_absent: true,
      provisioning_controls_absent: true,
    });
    expect(assertTemporaryPasswordRestrictedLoginProof({
      context,
      authenticatedUserId: TARGET_USER_ID,
      surfaceProof,
    })).toBe(true);
    expect(() => assertTemporaryPasswordRestrictedLoginProof({
      context,
      authenticatedUserId: '83d92a59-6909-44e7-80f3-aff60a6734fb',
      surfaceProof,
    })).toThrow(
      /PATCH83U_TEMPORARY_PASSWORD_RESTRICTED_LOGIN_NOT_PROVEN/,
    );
    expect(() => assertTemporaryPasswordRestrictedLoginProof({
      context,
      authenticatedUserId: TARGET_USER_ID,
      surfaceProof: { passed: false },
    })).toThrow(
      /PATCH83U_TEMPORARY_PASSWORD_RESTRICTED_LOGIN_NOT_PROVEN/,
    );
  });

  it('proves fresh permanent login combines nonpersistent target identity and final authorization', async () => {
    const context = await createRegisteredNonpersistentContext();
    const authorizationProof = finalAuthorizationProof();
    expect(assertFreshPermanentLoginProof({
      context,
      authenticatedUserId: TARGET_USER_ID,
      authorizationProof,
    })).toBe(true);
    expect(() => assertFreshPermanentLoginProof({
      context,
      authenticatedUserId: '83d92a59-6909-44e7-80f3-aff60a6734fb',
      authorizationProof,
    })).toThrow(/PATCH83U_FRESH_PERMANENT_LOGIN_IDENTITY_NOT_PROVEN/);
    expect(() => assertFreshPermanentLoginProof({
      context,
      authenticatedUserId: TARGET_USER_ID,
      authorizationProof: {
        ...authorizationProof,
        admin_route_denied: false,
      },
    })).toThrow(/PATCH83U_FINAL_EMPLOYEE_AUTHORIZATION_PROOF_FAILED/);
  });

  it('freeze-binds Run 007 confirmation and final 1/1 contracts together', () => {
    expect(assertHistoricalConfirmationAndFinalSessionContracts({
      operatorConfirmationContract: run007OperatorConfirmationContract(),
      finalSessionContract: finalSessionContract(),
    })).toMatchObject({
      operatorConfirmationContract: {
        cli_override_supported: false,
      },
      finalSessionContract: {
        expected_session_count: 1,
        expected_unrevoked_refresh_token_count: 1,
        cli_override_supported: false,
      },
    });
    for (const drift of [
      {
        operatorConfirmationContract: {
          ...run007OperatorConfirmationContract(),
          exact_phrase: 'EXECUTE RUN 005 RESET NOW',
        },
        finalSessionContract: finalSessionContract(),
      },
      {
        operatorConfirmationContract: run007OperatorConfirmationContract(),
        finalSessionContract: {
          ...finalSessionContract(),
          expected_session_count: 2,
        },
      },
      {
        operatorConfirmationContract: run007OperatorConfirmationContract(),
        finalSessionContract: {
          ...finalSessionContract(),
          expected_unrevoked_refresh_token_count: 2,
        },
      },
    ]) {
      expect(() => assertHistoricalConfirmationAndFinalSessionContracts(
        drift,
      )).toThrow(
        /PATCH83U_RUN007_CONFIRMATION_AND_FINAL_SESSION_CONTRACTS_FAILED/,
      );
    }
  });

  it('proves controlled Employee session setup as two nonpersistent proofs and registered in-memory refresh identities', () => {
    const refreshA = new SecretValue('controlled-refresh-a');
    const refreshB = new SecretValue('controlled-refresh-b');
    try {
      const employeeContextProofs =
        CONTROLLED_EMPLOYEE_CONTEXT_LABELS.map(employeeContextProof);
      expect(assertControlledEmployeeSessionSetupProof({
        employeeContextProofs,
        controlledRefreshValues: [refreshA, refreshB],
        knownSecrets: [refreshA, refreshB],
      })).toBe(true);

      const drifts = [
        {
          employeeContextProofs: employeeContextProofs.slice(0, 1),
          controlledRefreshValues: [refreshA, refreshB],
          knownSecrets: [refreshA, refreshB],
        },
        {
          employeeContextProofs: employeeContextProofs.map((proof, index) => ({
            ...proof,
            authentication_succeeded: index === 0 ? false : true,
          })),
          controlledRefreshValues: [refreshA, refreshB],
          knownSecrets: [refreshA, refreshB],
        },
        {
          employeeContextProofs,
          controlledRefreshValues: [refreshA],
          knownSecrets: [refreshA, refreshB],
        },
        {
          employeeContextProofs,
          controlledRefreshValues: [refreshA, refreshA],
          knownSecrets: [refreshA, refreshB],
        },
        {
          employeeContextProofs,
          controlledRefreshValues: [refreshA, {}],
          knownSecrets: [refreshA, refreshB],
        },
        {
          employeeContextProofs,
          controlledRefreshValues: [refreshA, refreshB],
          knownSecrets: [refreshA],
        },
      ];
      for (const drift of drifts) {
        expect(() => assertControlledEmployeeSessionSetupProof(drift)).toThrow(
          /PATCH83U_CONTROLLED_EMPLOYEE_SESSION_SETUP_PROOF_FAILED/,
        );
      }
    } finally {
      refreshA.clear();
      refreshB.clear();
    }
  });

  it('proves pre-reset checkpoint combines  v4 target, session minimum, admin, and runtime', () => {
    const referenceSnapshot = checkpointSnapshot('before_employee_sessions');
    const valid = checkpointSnapshot('immediately_before_reset');
    expect(assertPreResetCheckpointAggregate({
      referenceSnapshot,
      snapshot: valid,
    })).toBe(true);
    const drifts = [
      (snapshot: any) => {
        snapshot.target.credential_version = 3;
      },
      (snapshot: any) => {
        snapshot.target.session_count = 1;
      },
      (snapshot: any) => {
        snapshot.admin.credential_state = 'recovery_required';
      },
      (snapshot: any) => {
        snapshot.runtime.state_version = 6;
      },
    ];
    for (const mutate of drifts) {
      const drifted = checkpointSnapshot('immediately_before_reset');
      mutate(drifted);
      expect(() => assertPreResetCheckpointAggregate({
        referenceSnapshot,
        snapshot: drifted,
      })).toThrow(/PATCH83U_PRE_RESET_CHECKPOINT_AGGREGATE_FAILED/);
    }
  });

  it('proves exact reset confirmation aggregate rejects each of four confirmation drifts', () => {
    const valid = {
      employeeIdConfirmation: TARGET_EMPLOYEE_ID,
      uiConfirmation: RESET_CONFIRMATION_TEXT,
      backendConfirmation: 'PATCH83U_RESET_USER_PASSWORD',
      operatorConfirmation: {
        contract_id: CURRENT_OPERATOR_CONFIRMATION_CONTRACT_ID,
        exact_match: true,
      },
      operatorConfirmationContract: currentOperatorConfirmationContract(),
    };
    expect(assertExactResetConfirmationsProof(valid)).toBe(true);
    const drifts = [
      { employeeIdConfirmation: '00000' },
      { uiConfirmation: 'RESET PASSWORD' },
      { backendConfirmation: 'PATCH83U_RESET_PASSWORD' },
      { operatorConfirmation: { ...valid.operatorConfirmation, exact_match: false } },
    ];
    for (const drift of drifts) {
      expect(() => assertExactResetConfirmationsProof({
        ...valid,
        ...drift,
      })).toThrow(/PATCH83U_EXACT_RESET_CONFIRMATIONS_PROOF_FAILED/);
    }
  });

  it('proves post-reset success combines  v5 zero-session governance, audit, admin, runtime, and reconciliation', () => {
    const referenceSnapshot = checkpointSnapshot('immediately_before_reset');
    const valid = checkpointSnapshot('immediately_after_reset');
    valid.audit = auditSnapshot('admin_reset');
    expect(assertPostResetSuccessAggregate({
      referenceSnapshot,
      snapshot: valid,
      requestIdHash: 'a'.repeat(64),
    })).toBe(true);
    const drifts = [
      (snapshot: any) => {
        snapshot.target.session_count = 1;
      },
      (snapshot: any) => {
        snapshot.target.role = 'super_admin';
      },
      (snapshot: any) => {
        snapshot.target.reconciliation_auth_changed = true;
      },
      (snapshot: any) => {
        snapshot.admin.credential_version = 2;
      },
      (snapshot: any) => {
        snapshot.runtime.state_version = 6;
      },
      (snapshot: any) => {
        snapshot.audit.latest_operation_status = 'in_progress';
      },
    ];
    for (const mutate of drifts) {
      const drifted = checkpointSnapshot('immediately_after_reset');
      drifted.audit = auditSnapshot('admin_reset');
      mutate(drifted);
      expect(() => assertPostResetSuccessAggregate({
        referenceSnapshot,
        snapshot: drifted,
        requestIdHash: 'a'.repeat(64),
      })).toThrow(/PATCH83U_POST_RESET_SUCCESS_AGGREGATE_FAILED/);
    }
  });

  it('proves before-change checkpoint combines  v5 governance, exact temporary 1/1, admin, and runtime', () => {
    const referenceSnapshot = checkpointSnapshot('immediately_before_reset');
    const valid = checkpointSnapshot('before_required_password_change');
    expect(assertBeforeRequiredPasswordChangeAggregate({
      referenceSnapshot,
      snapshot: valid,
    })).toBe(true);
    const drifts = [
      (snapshot: any) => {
        snapshot.target.credential_version = 2;
      },
      (snapshot: any) => {
        snapshot.target.session_count = 0;
      },
      (snapshot: any) => {
        snapshot.target.role = 'super_admin';
      },
      (snapshot: any) => {
        snapshot.target.pending_operation = true;
      },
      (snapshot: any) => {
        snapshot.target.unrevoked_refresh_token_count = 2;
      },
      (snapshot: any) => {
        snapshot.admin.pending_operation = true;
      },
      (snapshot: any) => {
        snapshot.runtime.enforcement_state = 'emergency_suspended';
      },
    ];
    for (const mutate of drifts) {
      const drifted = checkpointSnapshot('before_required_password_change');
      mutate(drifted);
      expect(() => assertBeforeRequiredPasswordChangeAggregate({
        referenceSnapshot,
        snapshot: drifted,
      })).toThrow(/PATCH83U_BEFORE_PASSWORD_CHANGE_AGGREGATE_FAILED/);
    }
  });

  it('proves after-change checkpoint combines  v6 zero-session finalization, audit, admin, runtime, and signout', () => {
    const referenceSnapshot = checkpointSnapshot('immediately_before_reset');
    const valid = checkpointSnapshot(
      'immediately_after_password_change_finalization',
    );
    valid.audit = auditSnapshot('password_change', 'b'.repeat(64));
    expect(assertAfterPasswordChangeAggregate({
      referenceSnapshot,
      snapshot: valid,
      requestIdHash: 'b'.repeat(64),
      browserSignedOut: true,
    })).toBe(true);
    const drifts = [
      (snapshot: any, proof: any) => {
        snapshot.target.credential_version = 3;
      },
      (snapshot: any, proof: any) => {
        snapshot.target.session_count = 1;
      },
      (snapshot: any, proof: any) => {
        snapshot.target.requested_lifecycle = 'suspended';
      },
      (snapshot: any, proof: any) => {
        snapshot.target.role = 'super_admin';
      },
      (snapshot: any, proof: any) => {
        snapshot.target.pending_operation = true;
      },
      (snapshot: any, proof: any) => {
        snapshot.target.password_changed_at_set = false;
      },
      (snapshot: any, proof: any) => {
        snapshot.target.reconciliation_auth_changed = true;
      },
      (snapshot: any, proof: any) => {
        snapshot.admin.credential_version = 2;
      },
      (snapshot: any, proof: any) => {
        snapshot.runtime.state_version = 6;
      },
      (snapshot: any, proof: any) => {
        snapshot.audit.latest_event_code = 'PATCH83U_WRONG_EVENT';
      },
      (snapshot: any, proof: any) => {
        proof.browserSignedOut = false;
      },
    ];
    for (const mutate of drifts) {
      const drifted = checkpointSnapshot(
        'immediately_after_password_change_finalization',
      );
      drifted.audit = auditSnapshot('password_change', 'b'.repeat(64));
      const proof = {
        referenceSnapshot,
        snapshot: drifted,
        requestIdHash: 'b'.repeat(64),
        browserSignedOut: true,
      };
      mutate(drifted, proof);
      expect(() => assertAfterPasswordChangeAggregate(proof)).toThrow(
        /PATCH83U_AFTER_PASSWORD_CHANGE_AGGREGATE_FAILED/,
      );
    }
  });

  it('proves final checkpoint combines fresh authorization, active  v6 exact 1/1, admin, and runtime', async () => {
    const context = await createRegisteredNonpersistentContext();
    const referenceSnapshot = checkpointSnapshot('immediately_before_reset');
    const valid = checkpointSnapshot('after_fresh_employee_login');
    const base = {
      referenceSnapshot,
      snapshot: valid,
      finalSessionContract: finalSessionContract(),
      context,
      authenticatedUserId: TARGET_USER_ID,
      authorizationProof: finalAuthorizationProof(),
    };
    expect(assertFinalFreshLoginAggregate(base)).toBe(true);
    const drifts = [
      (proof: any) => {
        proof.authenticatedUserId = '83d92a59-6909-44e7-80f3-aff60a6734fb';
      },
      (proof: any) => {
        proof.authorizationProof.admin_route_denied = false;
      },
      (proof: any) => {
        proof.snapshot.target.credential_version = 3;
      },
      (proof: any) => {
        proof.snapshot.target.session_count = 2;
      },
      (proof: any) => {
        proof.snapshot.target.role = 'super_admin';
      },
      (proof: any) => {
        proof.snapshot.admin.credential_version = 2;
      },
      (proof: any) => {
        proof.snapshot.runtime.state_version = 6;
      },
    ];
    for (const mutate of drifts) {
      const proof = {
        ...base,
        snapshot: checkpointSnapshot('after_fresh_employee_login'),
        authorizationProof: finalAuthorizationProof(),
      };
      mutate(proof);
      expect(() => assertFinalFreshLoginAggregate(proof)).toThrow(
        /PATCH83U_FINAL_FRESH_LOGIN_AGGREGATE_FAILED/,
      );
    }
  });

  it('uses phase-specific checkpoint schemas and rejects cross-phase state drift', () => {
    const checkpoints = [
      'before_employee_sessions',
      'immediately_before_reset',
      'immediately_after_reset',
      'before_required_password_change',
      'immediately_after_password_change_finalization',
      'after_fresh_employee_login',
    ] as const;
    for (const checkpoint of checkpoints) {
      const valid = checkpointSnapshot(checkpoint);
      expect(assertEvidenceMatchesSchemaContract(valid, checkpointSchema)).toBe(true);
      const drifted = structuredClone(valid);
      drifted.target.role = 'super_admin';
      expect(() => assertEvidenceMatchesSchemaContract(
        drifted,
        checkpointSchema,
      )).toThrow(/PATCH83U_SCHEMA_ONE_OF_FAILED/);
    }

    const insufficientPreReset = checkpointSnapshot('immediately_before_reset');
    insufficientPreReset.target.session_count = 1;
    expect(() => assertEvidenceMatchesSchemaContract(
      insufficientPreReset,
      checkpointSchema,
    )).toThrow(/PATCH83U_SCHEMA_ONE_OF_FAILED/);

    const protectedResetOutcome = checkpointSnapshot('immediately_after_reset');
    Object.assign(protectedResetOutcome.target, {
      credential_state: 'session_revocation_review_required',
      credential_version: 5,
      auth_credential_version: 5,
      pending_operation: true,
      pending_operation_count: 1,
      session_count: 1,
      unrevoked_refresh_token_count: 1,
    });
    expect(assertEvidenceMatchesSchemaContract(
      protectedResetOutcome,
      checkpointSchema,
    )).toBe(true);

    const invariantDrifts = [
      (snapshot: any) => {
        snapshot.runtime.state_version = 6;
      },
      (snapshot: any) => {
        snapshot.runtime.request_hash_function_available = false;
      },
      (snapshot: any) => {
        snapshot.admin.credential_version = 2;
      },
      (snapshot: any) => {
        snapshot.admin.pending_operation = true;
      },
      (snapshot: any) => {
        snapshot.eligible_super_admin_count = 0;
      },
    ];
    for (const mutate of invariantDrifts) {
      const drifted = checkpointSnapshot('immediately_after_reset');
      mutate(drifted);
      expect(() => assertEvidenceMatchesSchemaContract(
        drifted,
        checkpointSchema,
      )).toThrow(/PATCH83U_SCHEMA_ONE_OF_FAILED/);
    }
  });

  it('requires request-correlated reset and password-change audits and clean diagnostics', () => {
    const valid = completedEvidence();
    expect(assertCompletedExecutionEvidence(valid)).toBe(true);

    for (const field of [
      'stale_context_1_denied',
      'stale_context_2_denied',
    ] as const) {
      const tampered = structuredClone(valid);
      tampered.revocation[field] = false;
      expect(() => assertCompletedExecutionEvidence(tampered)).toThrow(
        /PATCH83U_COMPLETED_REVOCATION_PROOF_INVALID/,
      );
    }

    const resetAuditTampered = structuredClone(valid);
    resetAuditTampered.audit.after_reset.latest_event_request_id_hash =
      'c'.repeat(64);
    expect(() => assertCompletedExecutionEvidence(resetAuditTampered)).toThrow(
      /PATCH83U_AUDIT_CHECKPOINT_NOT_PROVEN/,
    );

    const changeAuditTampered = structuredClone(valid);
    changeAuditTampered.audit.after_password_change
      .latest_operation_request_id_hash = 'c'.repeat(64);
    expect(() => assertCompletedExecutionEvidence(changeAuditTampered)).toThrow(
      /PATCH83U_AUDIT_CHECKPOINT_NOT_PROVEN/,
    );

    const missingChangeHash = structuredClone(valid);
    delete (missingChangeHash.password_change as {
      request_id_hash?: string;
    }).request_id_hash;
    expect(() => assertCompletedExecutionEvidence(missingChangeHash)).toThrow(
      /PATCH83U_PASSWORD_CHANGE_COMPLETION_PROOF_FAILED|PATCH83U_COMPLETED_AUDIT_PROOF_INCOMPLETE/,
    );

    const dirtyDiagnostics = structuredClone(valid);
    dirtyDiagnostics.browser_diagnostics.request_failure_count = 1;
    dirtyDiagnostics.browser_diagnostics.safe = false;
    expect(() => assertCompletedExecutionEvidence(dirtyDiagnostics)).toThrow(
      /PATCH83U_COMPLETED_BROWSER_DIAGNOSTICS_NOT_CLEAN/,
    );
    const falselyMarkedSafeDiagnostics = structuredClone(valid);
    falselyMarkedSafeDiagnostics.browser_diagnostics.request_failure_count = 1;
    expect(() => assertCompletedExecutionEvidence(
      falselyMarkedSafeDiagnostics,
    )).toThrow(/PATCH83U_BROWSER_DIAGNOSTICS_NOT_CLEAN/);
  });

  it('makes the evidence schema itself require every completed proof block', () => {
    const valid = completedEvidence();
    for (const block of [
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
    ] as const) {
      const missing = structuredClone(valid);
      delete (missing as Partial<typeof valid>)[block];
      expect(() => assertEvidenceMatchesSchemaContract(
        missing,
        evidenceSchema,
      )).toThrow(/PATCH83U_SCHEMA_ONE_OF_FAILED/);
    }
  });

  it('ties password-change completion to Edge success, finalizer, CP5, audit, and signout', () => {
    const valid = completedEvidence();
    expect(assertPasswordChangeCompletionProof({
      passwordChange: valid.password_change,
      audit: valid.audit.after_password_change,
    })).toBe(true);

    const mutations = [
      (evidence: ReturnType<typeof completedEvidence>) => {
        evidence.password_change.edge_success_confirmed = false;
      },
      (evidence: ReturnType<typeof completedEvidence>) => {
        evidence.password_change.finalizer_rpc = 'unexpected_finalizer';
      },
      (evidence: ReturnType<typeof completedEvidence>) => {
        evidence.password_change.terminal_proof.session_count = 1;
      },
      (evidence: ReturnType<typeof completedEvidence>) => {
        evidence.password_change.password_changed_at_set = false;
      },
      (evidence: ReturnType<typeof completedEvidence>) => {
        evidence.password_change.browser_signed_out = false;
      },
      (evidence: ReturnType<typeof completedEvidence>) => {
        evidence.audit.after_password_change.latest_event_request_id_hash =
          'c'.repeat(64);
      },
    ];
    for (const mutate of mutations) {
      const tampered = structuredClone(valid);
      mutate(tampered);
      expect(() => assertPasswordChangeCompletionProof({
        passwordChange: tampered.password_change,
        audit: tampered.audit.after_password_change,
      })).toThrow(
        /PATCH83U_PASSWORD_CHANGE_COMPLETION_PROOF_FAILED|PATCH83U_AUDIT_CHECKPOINT_NOT_PROVEN/,
      );
    }
  });

  it('proves staging configuration and every browser target reject production references', () => {
    const valid = {
      configuration: stagingConfiguration(),
      targetGuard: cleanTargetGuard(),
    };
    expect(assertStagingAndProductionBoundaryAggregate(valid)).toBe(true);
    expect(browserRequestIsAllowed(STAGING_APPLICATION_ORIGIN)).toBe(true);
    expect(browserRequestIsAllowed(STAGING_SUPABASE_ORIGIN)).toBe(true);
    expect(browserRequestIsAllowed(
      `${STAGING_APPLICATION_ORIGIN}/probe/${PRODUCTION_PROJECT_REF}`,
    )).toBe(false);
    expect(browserRequestIsAllowed(
      `${STAGING_APPLICATION_ORIGIN}/?project=${PRODUCTION_PROJECT_REF}`,
    )).toBe(false);

    expect(() => assertStagingAndProductionBoundaryAggregate({
      ...valid,
      configuration: {
        ...valid.configuration,
        app_url: `${STAGING_APPLICATION_ORIGIN}/?ref=${PRODUCTION_PROJECT_REF}`,
      },
    })).toThrow(/PATCH83U_STAGING_AND_PRODUCTION_BOUNDARY_FAILED/);
    expect(() => assertStagingAndProductionBoundaryAggregate({
      ...valid,
      targetGuard: {
        ...cleanTargetGuard(),
        violation: 'PATCH83U_PRODUCTION_BROWSER_REQUEST_REFUSED',
      },
    })).toThrow(/PATCH83U_STAGING_AND_PRODUCTION_BOUNDARY_FAILED/);
  });

  it('proves the exact local origin and loaded staging frontend together', () => {
    const valid = {
      appUrl: STAGING_APPLICATION_ORIGIN,
      launchPlan: {
        origin: STAGING_APPLICATION_ORIGIN,
        projectRef: STAGING_PROJECT_REF,
        mode: 'staging',
      },
      loadedAttestation: {
        applicationOriginMatches: true,
        stagingProjectPresent: true,
        productionProjectPresent: false,
      },
    };
    expect(assertFrontendOriginExactAggregate(valid)).toBe(true);
    for (const drift of [
      { ...valid, appUrl: 'http://localhost:5174' },
      {
        ...valid,
        launchPlan: { ...valid.launchPlan, projectRef: PRODUCTION_PROJECT_REF },
      },
      {
        ...valid,
        loadedAttestation: {
          ...valid.loadedAttestation,
          productionProjectPresent: true,
        },
      },
      {
        ...valid,
        loadedAttestation: {
          ...valid.loadedAttestation,
          stagingProjectPresent: false,
        },
      },
    ]) {
      expect(() => assertFrontendOriginExactAggregate(drift)).toThrow(
        /PATCH83U_FRONTEND_ORIGIN_EXACT_PROOF_FAILED/,
      );
    }
  });

  it('proves the complete exact runtime, migration, contract, finalizer, and recovery gate', () => {
    const snapshot = checkpointSnapshot('before_employee_sessions');
    const edgeDeploymentChecks = exactEdgeDeploymentChecks();
    expect(assertRuntimeAndContractsExactAggregate({
      snapshot,
      edgeDeploymentChecks,
    }).passed).toBe(true);
    const drifts = [
      (candidate: any) => {
        candidate.runtime.state_version = 6;
      },
      (candidate: any) => {
        candidate.applied_migrations = ['174', '176'];
      },
      (candidate: any) => {
        candidate.finalizer.service_role_execute_only = false;
      },
      (candidate: any) => {
        candidate.recovery.wrapper_exists = false;
      },
    ];
    for (const mutate of drifts) {
      const candidate = checkpointSnapshot('before_employee_sessions');
      mutate(candidate);
      expect(() => assertRuntimeAndContractsExactAggregate({
        snapshot: candidate,
        edgeDeploymentChecks,
      })).toThrow(/PATCH83U_RUNTIME_AND_CONTRACTS_EXACT_PROOF_FAILED/);
    }
    expect(() => assertRuntimeAndContractsExactAggregate({
      snapshot,
      edgeDeploymentChecks: {
        ...edgeDeploymentChecks,
        edge_version_exact: false,
      },
    })).toThrow(/PATCH83U_RUNTIME_AND_CONTRACTS_EXACT_PROOF_FAILED/);
    expect(() => parseCliArguments([
      '--review-newer-state-version',
    ])).toThrow(/PATCH83U_UNKNOWN_ARGUMENT_REFUSED/);
  });

  it('proves Checkpoint 1 combines a read-only snapshot with BEGIN READ ONLY and ROLLBACK', () => {
    const snapshot = checkpointSnapshot('before_employee_sessions');
    expect(assertCheckpoint1ReadOnlyAggregate({
      snapshot,
      sqlSource: sqlEditorSource,
    })).toBe(true);
    expect(() => assertCheckpoint1ReadOnlyAggregate({
      snapshot: { ...snapshot, transaction_read_only: false },
      sqlSource: sqlEditorSource,
    })).toThrow(/PATCH83U_CHECKPOINT1_READ_ONLY_PROOF_FAILED/);
    const checkpointStart = sqlEditorSource.indexOf(
      '-- FILE: 01-before-employee-sessions.json',
    );
    const rollbackIndex = sqlEditorSource.indexOf('ROLLBACK;', checkpointStart);
    const missingRollback = `${sqlEditorSource.slice(0, rollbackIndex)}`
      + `-- ROLLBACK intentionally removed by local unit fixture`
      + `${sqlEditorSource.slice(rollbackIndex + 'ROLLBACK;'.length)}`;
    expect(() => assertCheckpoint1ReadOnlyAggregate({
      snapshot,
      sqlSource: missingRollback,
    })).toThrow(/PATCH83U_CHECKPOINT1_READ_ONLY_PROOF_FAILED/);
  });

  it('proves the complete initial Employee  v4 governance state', () => {
    const valid = checkpointSnapshot('before_employee_sessions');
    expect(assertInitialEmployeeStateAggregate(valid)).toBe(true);
    for (const mutate of [
      (candidate: any) => {
        candidate.target.credential_version = 3;
      },
      (candidate: any) => {
        candidate.target.auth_credential_version = 3;
      },
      (candidate: any) => {
        candidate.target.role = 'admin';
      },
      (candidate: any) => {
        candidate.target.scope = 'global';
      },
      (candidate: any) => {
        candidate.target.pending_operation = true;
      },
      (candidate: any) => {
        candidate.target.session_count = 1;
      },
    ]) {
      const candidate = checkpointSnapshot('before_employee_sessions');
      mutate(candidate);
      expect(() => assertInitialEmployeeStateAggregate(candidate)).toThrow(
        /PATCH83U_INITIAL_EMPLOYEE_STATE_PROOF_FAILED/,
      );
    }
  });

  it('proves migrations 174 176 177, service-only finalizer, and recovery route together', () => {
    const valid = checkpointSnapshot('before_employee_sessions');
    expect(assertFinalizerAndRecoveryReadyAggregate(valid)).toBe(true);
    for (const mutate of [
      (candidate: any) => {
        candidate.applied_migrations = ['174', '176'];
      },
      (candidate: any) => {
        candidate.finalizer.restricted_search_path = false;
      },
      (candidate: any) => {
        candidate.finalizer.service_role_execute_only = false;
      },
      (candidate: any) => {
        candidate.recovery.wrapper_service_role_execute_only = false;
      },
      (candidate: any) => {
        candidate.recovery.standard_implementation_owner_only = false;
      },
    ]) {
      const candidate = checkpointSnapshot('before_employee_sessions');
      mutate(candidate);
      expect(() => assertFinalizerAndRecoveryReadyAggregate(candidate)).toThrow(
        /PATCH83U_FINALIZER_AND_RECOVERY_READY_PROOF_FAILED/,
      );
    }
  });

  it('proves both controlled Employee refreshes with exact identities and outcomes', () => {
    const employeeUserIds = [TARGET_USER_ID, TARGET_USER_ID];
    const refreshSucceededByContext = [true, true];
    const employeeContextProofs =
      CONTROLLED_EMPLOYEE_CONTEXT_LABELS.map(employeeContextProof);
    expect(assertBothControlledRefreshesAggregate({
      employeeUserIds,
      refreshSucceededByContext,
      employeeContextProofs,
    })).toBe(true);
    expect(() => assertBothControlledRefreshesAggregate({
      employeeUserIds,
      refreshSucceededByContext: [true, false],
      employeeContextProofs,
    })).toThrow(/PATCH83U_BOTH_CONTROLLED_REFRESHES_PROOF_FAILED/);
    expect(() => assertBothControlledRefreshesAggregate({
      employeeUserIds: [TARGET_USER_ID, DESIGNATED_SUPER_ADMIN_ID],
      refreshSucceededByContext,
      employeeContextProofs,
    })).toThrow(/PATCH83U_BOTH_CONTROLLED_REFRESHES_PROOF_FAILED/);
    expect(() => assertBothControlledRefreshesAggregate({
      employeeUserIds,
      refreshSucceededByContext,
      employeeContextProofs: employeeContextProofs.map((proof, index) => ({
        ...proof,
        refresh_succeeded: index === 0,
      })),
    })).toThrow(/PATCH83U_BOTH_CONTROLLED_REFRESHES_PROOF_FAILED/);
  });

  it('proves the real User Management reset envelope remains strictly one-shot', async () => {
    const controller = new ResetSubmissionController();
    await controller.prepareResetForm({ passed: true }, true, async () => undefined);
    controller.authorizeOperatorConfirmation(
      currentOperatorConfirmationContract().exact_phrase,
      currentOperatorConfirmationContract(),
    );
    await controller.submit({ passed: true }, async () => ({ ok: true }));
    const envelope = resetEnvelope();
    expect(assertOneShotResetAggregate({
      controller,
      submissionCount: 1,
      requestEnvelope: envelope,
      userManagementActionPrepared: true,
    })).toBe(envelope.payload.request_id);
    await expect(controller.submit(
      { passed: true },
      async () => ({ ok: true }),
    )).rejects.toThrow(/PATCH83U_RESET_RETRY_REFUSED/);
    expect(() => assertOneShotResetAggregate({
      controller,
      submissionCount: 2,
      requestEnvelope: envelope,
      userManagementActionPrepared: true,
    })).toThrow(/PATCH83U_ONE_SHOT_RESET_PROOF_FAILED/);
    expect(() => assertOneShotResetAggregate({
      controller,
      submissionCount: 1,
      requestEnvelope: { ...envelope, action: 'unsupported_action' },
      userManagementActionPrepared: true,
    })).toThrow(/PATCH83U_ONE_SHOT_RESET_PROOF_FAILED/);
  });

  it('proves the reset request correlation is generated at submission and remains one stable hash', async () => {
    const premature = new ResetSubmissionController();
    expect(() => premature.observeRequestId('patch83u-run007-request-001')).toThrow(
      /PATCH83U_RESET_REQUEST_ID_BEFORE_SUBMISSION_REFUSED/,
    );

    const controller = new ResetSubmissionController();
    await controller.prepareResetForm({ passed: true }, true, async () => undefined);
    controller.authorizeOperatorConfirmation(
      currentOperatorConfirmationContract().exact_phrase,
      currentOperatorConfirmationContract(),
    );
    await controller.submit({ passed: true }, async () => ({ ok: true }));
    const requestId = resetEnvelope().payload.request_id;
    const requestIdHash = controller.observeRequestId(requestId);
    expect(assertStableResetRequestCorrelationAggregate({
      controller,
      envelopeRequestId: requestId,
      evidenceRequestIdHash: requestIdHash,
      submissionCount: 1,
    })).toBe(requestIdHash);
    expect(() => assertStableResetRequestCorrelationAggregate({
      controller,
      envelopeRequestId: requestId,
      evidenceRequestIdHash: 'f'.repeat(64),
      submissionCount: 1,
    })).toThrow(/PATCH83U_STABLE_RESET_REQUEST_CORRELATION_PROOF_FAILED/);
    controller.observeRequestId(requestId);
    expect(() => assertStableResetRequestCorrelationAggregate({
      controller,
      envelopeRequestId: requestId,
      evidenceRequestIdHash: requestIdHash,
      submissionCount: 1,
    })).toThrow(/PATCH83U_STABLE_RESET_REQUEST_CORRELATION_PROOF_FAILED/);
  });

  it('proves Checkpoint 3 is collected read-only after every reset outcome class', () => {
    const snapshot = checkpointSnapshot('immediately_after_reset');
    for (const [edgeOutcome, checkpointOutcome] of [
      [
        { confirmed_success: true, classification: 'admin_reset_change_required' },
        { expected_success: true, classification: 'admin_reset_change_required' },
      ],
      [
        { confirmed_success: false, classification: 'ambiguous_edge_response' },
        { expected_success: false, classification: 'reset_in_progress' },
      ],
      [
        { confirmed_success: false, classification: 'recovery_required' },
        { expected_success: false, classification: 'recovery_required' },
      ],
    ] as const) {
      expect(assertCheckpoint3AlwaysAggregate({
        snapshot,
        sqlSource: sqlEditorSource,
        resetSubmissionStarted: true,
        edgeOutcome,
        checkpointOutcome,
      })).toBe(true);
    }
    expect(() => assertCheckpoint3AlwaysAggregate({
      snapshot: { ...snapshot, transaction_read_only: false },
      sqlSource: sqlEditorSource,
      resetSubmissionStarted: true,
      edgeOutcome: { confirmed_success: false },
      checkpointOutcome: { expected_success: false },
    })).toThrow(/PATCH83U_CHECKPOINT3_ALWAYS_PROOF_FAILED/);
    expect(() => assertCheckpoint3AlwaysAggregate({
      snapshot,
      sqlSource: sqlEditorSource,
      resetSubmissionStarted: false,
      edgeOutcome: { confirmed_success: false },
      checkpointOutcome: { expected_success: false },
    })).toThrow(/PATCH83U_CHECKPOINT3_ALWAYS_PROOF_FAILED/);
  });

  it('proves every protected reset state stops without automatic recovery actions', () => {
    for (const classification of [
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
    ]) {
      const edgeOutcome = {
        confirmed_success: false,
        classification,
      };
      const checkpointOutcome = {
        expected_success: false,
        classification,
      };
      const progression = evaluateResetProgression(edgeOutcome, checkpointOutcome);
      expect(assertProtectedStateFailClosedAggregate({
        edgeOutcome,
        checkpointOutcome,
        progression,
        automaticRecoveryActions: [],
        postSubmissionCleanupSucceeded: true,
      })).toBe(true);
    }
    const edgeOutcome = { confirmed_success: false, classification: 'recovery_required' };
    const checkpointOutcome = {
      expected_success: false,
      classification: 'recovery_required',
    };
    expect(() => assertProtectedStateFailClosedAggregate({
      edgeOutcome,
      checkpointOutcome,
      progression: { ...evaluateResetProgression(edgeOutcome, checkpointOutcome), allowed: true },
      automaticRecoveryActions: [],
      postSubmissionCleanupSucceeded: true,
    })).toThrow(/PATCH83U_PROTECTED_STATE_FAIL_CLOSED_PROOF_FAILED/);
    expect(() => assertProtectedStateFailClosedAggregate({
      edgeOutcome,
      checkpointOutcome,
      progression: evaluateResetProgression(edgeOutcome, checkpointOutcome),
      automaticRecoveryActions: ['abort'],
      postSubmissionCleanupSucceeded: true,
    })).toThrow(/PATCH83U_PROTECTED_STATE_FAIL_CLOSED_PROOF_FAILED/);
  });

  it('proves both stale contexts are independently signed out and denied protected access', () => {
    const staleContextProofs =
      CONTROLLED_EMPLOYEE_CONTEXT_LABELS.map(staleContextProof);
    expect(assertBothStaleContextsDeniedAggregate({
      staleContextProofs,
      staleContext1Denied: true,
      staleContext2Denied: true,
    }).passed).toBe(true);
    for (const index of [0, 1]) {
      const drifted = staleContextProofs.map((proof) => ({ ...proof }));
      drifted[index].authenticated_user_absent = false;
      expect(() => assertBothStaleContextsDeniedAggregate({
        staleContextProofs: drifted,
        staleContext1Denied: true,
        staleContext2Denied: true,
      })).toThrow(/PATCH83U_BOTH_STALE_CONTEXTS_DENIED_PROOF_FAILED/);
    }
    expect(() => assertBothStaleContextsDeniedAggregate({
      staleContextProofs,
      staleContext1Denied: true,
      staleContext2Denied: false,
    })).toThrow(/PATCH83U_BOTH_STALE_CONTEXTS_DENIED_PROOF_FAILED/);
  });

  it('proves password inputs stay hidden and in memory, differ, and keep bounded policy enforcement', () => {
    const temporaryPassword = new SecretValue('temporary-value-for-local-test');
    const newPermanentPassword = new SecretValue('permanent-value-for-local-test');
    try {
      const valid = {
        credentialValues: [temporaryPassword, newPermanentPassword],
        knownSecrets: [temporaryPassword, newPermanentPassword],
        temporaryPassword,
        newPermanentPassword,
        hiddenPrompt: promptHidden,
        credentialsPersisted: false,
        maxAttempts: PASSWORD_CHANGE_MAX_ATTEMPTS,
      };
      expect(assertSecretAndPolicyControlsAggregate(valid)).toBe(true);
      expect(assertSecretAndPolicyControlsAggregate({
        ...valid,
        passwordChangeRun: {
          candidate: newPermanentPassword,
          attempt_count: 2,
          policy_rejection_count: 1,
          policy_error_codes: [PERMANENT_PASSWORD_POLICY_ERROR_CODE],
        },
      })).toBe(true);
      for (const drift of [
        { ...valid, knownSecrets: [temporaryPassword] },
        { ...valid, hiddenPrompt: vi.fn() },
        { ...valid, credentialsPersisted: true },
        { ...valid, maxAttempts: PASSWORD_CHANGE_MAX_ATTEMPTS + 1 },
        {
          ...valid,
          newPermanentPassword: temporaryPassword,
          credentialValues: [temporaryPassword, temporaryPassword],
        },
        {
          ...valid,
          passwordChangeRun: {
            candidate: newPermanentPassword,
            attempt_count: 2,
            policy_rejection_count: 1,
            policy_error_codes: ['UNSAFE_POLICY_BYPASS'],
          },
        },
      ]) {
        expect(() => assertSecretAndPolicyControlsAggregate(drift)).toThrow(
          /PATCH83U_SECRET_AND_POLICY_CONTROLS_PROOF_FAILED/,
        );
      }
    } finally {
      temporaryPassword.clear();
      newPermanentPassword.clear();
    }
  });

  it('proves production traffic absence and zero safe browser diagnostics together', () => {
    const valid = {
      configuration: stagingConfiguration(),
      targetGuard: cleanTargetGuard(),
      productionProjectAbsent: true,
    };
    expect(assertNetworkConsoleSafeAggregate(valid)).toMatchObject({
      safe: true,
      console_error_count: 0,
      page_error_count: 0,
      request_failure_count: 0,
      server_error_response_count: 0,
    });
    expect(() => assertNetworkConsoleSafeAggregate({
      ...valid,
      productionProjectAbsent: false,
    })).toThrow(/PATCH83U_NETWORK_CONSOLE_SAFE_PROOF_FAILED/);
    const failedGuard = cleanTargetGuard();
    recordSafeBrowserDiagnostic(failedGuard.diagnostics, 'request_failure');
    expect(() => assertNetworkConsoleSafeAggregate({
      ...valid,
      targetGuard: failedGuard,
    })).toThrow(/PATCH83U_NETWORK_CONSOLE_SAFE_PROOF_FAILED/);
    expect(browserRequestIsAllowed(
      `${STAGING_SUPABASE_ORIGIN}/rest/v1/probe?forbidden=${PRODUCTION_PROJECT_REF}`,
    )).toBe(false);
  });

  it('records complete passed preflight evidence on the hosted success path', () => {
    const readiness = {
      passed: true,
      checks: {
        staging_project_confirmed: true,
        runtime_enforced: true,
        secondary_admin_reauthenticated: true,
        two_controlled_employee_sessions: true,
      },
      failed: [],
    };
    expect(buildPassedPreflightEvidence(readiness)).toEqual(readiness);
    for (const drift of [
      { ...readiness, passed: false },
      {
        ...readiness,
        checks: { ...readiness.checks, runtime_enforced: false },
      },
      { ...readiness, failed: ['runtime_enforced'] },
      { ...readiness, checks: {} },
    ]) {
      expect(() => buildPassedPreflightEvidence(drift)).toThrow(
        /PATCH83U_PASSED_PREFLIGHT_EVIDENCE_INVALID/,
      );
    }
    expect(harnessSource).toContain(
      'evidence.preflight = buildPassedPreflightEvidence(readiness);',
    );
  });

  it('registers controlled refresh values with the in-memory evidence leak guard', () => {
    expect(harnessSource).toContain(
      'knownSecrets.push(controlledRefreshValueA, controlledRefreshValueB)',
    );
    const controlledRefresh = new SecretValue(
      'opaque-controlled-refresh-value-that-does-not-match-token-regex',
    );
    try {
      expect(() => serializeRedactedEvidence(
        {
          operator_guidance: [{
            code: 'safe_code',
            guidance:
              'opaque-controlled-refresh-value-that-does-not-match-token-regex',
            observed_state: null,
          }],
        },
        { knownSecrets: [controlledRefresh] },
      )).toThrow(/PATCH83U_KNOWN_SECRET_REFUSED/);
    } finally {
      controlledRefresh.clear();
    }
  });

  it('performs no hosted calls while validating completion contracts', () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('hosted call refused in unit test');
    });
    vi.stubGlobal('fetch', fetchSpy);
    try {
      expect(assertCompletedExecutionEvidence(completedEvidence())).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
