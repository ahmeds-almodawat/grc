import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  ADMIN_RESET_ACTION,
  CONTROLLED_EMPLOYEE_CONTEXT_LABELS,
  DESIGNATED_SUPER_ADMIN_ID,
  EDGE_DEPLOYMENT_GATE_CHECK_NAMES,
  EXPECTED_EDGE_CONTRACT,
  EXPECTED_FRONTEND_CONTRACT,
  EXPECTED_SCHEMA_VERSION,
  FINALIZER_RPC,
  PASSWORD_CHANGE_MAX_ATTEMPTS,
  PERMANENT_PASSWORD_POLICY_ERROR_CODE,
  PRODUCTION_PROJECT_REF,
  RESET_CONFIRMATION_TEXT,
  RUN_NUMBER,
  RUN007_OPERATOR_CONFIRMATION_CONTRACT_ID,
  STAGING_APPLICATION_ORIGIN,
  STAGING_PROJECT_REF,
  STAGING_SUPABASE_ORIGIN,
  TARGET_EMPLOYEE_ID,
  TARGET_USER_ID,
  ResetSubmissionController,
  SecretValue,
  assertBothControlledRefreshesAggregate,
  assertBothStaleContextsDeniedAggregate,
  assertCheckpoint1ReadOnlyAggregate,
  assertCheckpoint3AlwaysAggregate,
  assertFinalizerAndRecoveryReadyAggregate,
  assertFrontendOriginExactAggregate,
  assertInitialEmployeeStateAggregate,
  assertNetworkConsoleSafeAggregate,
  assertOneShotResetAggregate,
  assertProtectedStateFailClosedAggregate,
  assertRuntimeAndContractsExactAggregate,
  assertSecretAndPolicyControlsAggregate,
  assertStableResetRequestCorrelationAggregate,
  assertStagingAndProductionBoundaryAggregate,
  browserRequestIsAllowed,
  createSafeBrowserContext,
  createSafeBrowserDiagnosticsState,
  evaluateResetProgression,
  hashRequestId,
  markIntentionalBrowserRequestAbort,
  promptHidden,
} from '../../scripts/patch83u-staging-multisession-reset-proof.mjs';

const SQL_SOURCE = `
-- CHECKPOINT 1
-- FILE: 01-before-employee-sessions.json
BEGIN READ ONLY;
SELECT true;
ROLLBACK;
-- CHECKPOINT 3
-- FILE: 03-immediately-after-reset.json
BEGIN READ ONLY;
SELECT true;
ROLLBACK;
`;

function edgeChecks() {
  return Object.fromEntries(
    EDGE_DEPLOYMENT_GATE_CHECK_NAMES.map((name) => [name, true]),
  );
}

function initialSnapshot() {
  return {
    checkpoint: 'before_employee_sessions',
    expected_project_ref: STAGING_PROJECT_REF,
    project_ref: STAGING_PROJECT_REF,
    transaction_read_only: true,
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
      session_count: 0,
      unrevoked_refresh_token_count: 0,
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

function cleanTargetGuard() {
  return {
    violation: null,
    diagnostics: createSafeBrowserDiagnosticsState(),
  };
}

function stagingConfiguration() {
  return {
    project_ref: STAGING_PROJECT_REF,
    supabase_url: STAGING_SUPABASE_ORIGIN,
    app_url: STAGING_APPLICATION_ORIGIN,
  };
}

function employeeProof(label: string) {
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

function staleProof(label: string) {
  return {
    label,
    authenticated_user_absent: true,
    sign_in_visible: true,
    employee_content_absent: true,
    admin_content_absent: true,
    protected_route_access_denied: true,
  };
}

function operatorContract() {
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

async function armController(controller: ResetSubmissionController) {
  await controller.prepareResetForm({ passed: true }, true, async () => {});
  controller.authorizeOperatorConfirmation(
    operatorContract().exact_phrase,
    operatorContract(),
  );
}

function resetEnvelope(requestId = 'patch83u-run007-request') {
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

describe('Patch 83U Run 007 substantive aggregate contracts', () => {
  it('P01 binds exact staging configuration to a clean browser target guard', () => {
    const valid = {
      configuration: stagingConfiguration(),
      targetGuard: cleanTargetGuard(),
    };
    expect(assertStagingAndProductionBoundaryAggregate(valid)).toBe(true);
    const drifts = [
      { configuration: { ...valid.configuration, project_ref: 'unknown' } },
      {
        configuration: {
          ...valid.configuration,
          supabase_url: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
        },
      },
      { targetGuard: { ...valid.targetGuard, violation: 'blocked' } },
      { targetGuard: { violation: null } },
    ];
    for (const drift of drifts) {
      expect(() => assertStagingAndProductionBoundaryAggregate({
        ...valid,
        ...drift,
      })).toThrow(/PATCH83U_STAGING_AND_PRODUCTION_BOUNDARY_FAILED/);
    }
    expect(browserRequestIsAllowed(
      `${STAGING_APPLICATION_ORIGIN}/asset?ref=${PRODUCTION_PROJECT_REF}`,
    )).toBe(false);
  });

  it('P01 binds the exact local origin to the loaded staging bundle attestation', () => {
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
    const drifts = [
      { appUrl: 'http://localhost:5174' },
      { launchPlan: { ...valid.launchPlan, origin: 'http://localhost:5174' } },
      { launchPlan: { ...valid.launchPlan, projectRef: 'unknown' } },
      { launchPlan: { ...valid.launchPlan, mode: 'development' } },
      {
        loadedAttestation: {
          ...valid.loadedAttestation,
          applicationOriginMatches: false,
        },
      },
      {
        loadedAttestation: {
          ...valid.loadedAttestation,
          stagingProjectPresent: false,
        },
      },
      {
        loadedAttestation: {
          ...valid.loadedAttestation,
          productionProjectPresent: true,
        },
      },
    ];
    for (const drift of drifts) {
      expect(() => assertFrontendOriginExactAggregate({
        ...valid,
        ...drift,
      })).toThrow(/PATCH83U_FRONTEND_ORIGIN_EXACT_PROOF_FAILED/);
    }
  });

  it('P01 requires exact runtime, contracts, migrations, catalog, recovery, and Edge gates', () => {
    const valid = {
      snapshot: initialSnapshot(),
      edgeDeploymentChecks: edgeChecks(),
    };
    expect(assertRuntimeAndContractsExactAggregate(valid).passed).toBe(true);
    const mutations = [
      (proof: any) => {
        proof.snapshot.runtime.schema_version = 'unexpected';
      },
      (proof: any) => {
        proof.snapshot.runtime.enforcement_state = 'emergency_suspended';
      },
      (proof: any) => {
        proof.snapshot.runtime.state_version = 6;
      },
      (proof: any) => {
        proof.snapshot.runtime.edge_contract = 'unexpected';
      },
      (proof: any) => {
        proof.snapshot.runtime.frontend_contract = 'unexpected';
      },
      (proof: any) => {
        proof.snapshot.applied_migrations = ['174', '176'];
      },
      (proof: any) => {
        proof.snapshot.finalizer.security_definer = false;
      },
      (proof: any) => {
        proof.snapshot.recovery.wrapper_exists = false;
      },
      (proof: any) => {
        proof.edgeDeploymentChecks[EDGE_DEPLOYMENT_GATE_CHECK_NAMES[0]] = false;
      },
    ];
    for (const mutate of mutations) {
      const proof = {
        snapshot: structuredClone(initialSnapshot()),
        edgeDeploymentChecks: edgeChecks(),
      };
      mutate(proof);
      expect(() => assertRuntimeAndContractsExactAggregate(proof)).toThrow(
        /PATCH83U_RUNTIME_AND_CONTRACTS_EXACT_PROOF_FAILED/,
      );
    }
  });

  it('P02 proves Checkpoint 1 is runtime-read-only and statically transactional', () => {
    const valid = { snapshot: initialSnapshot(), sqlSource: SQL_SOURCE };
    expect(assertCheckpoint1ReadOnlyAggregate(valid)).toBe(true);
    const drifts = [
      { snapshot: { ...valid.snapshot, transaction_read_only: false } },
      { snapshot: { ...valid.snapshot, checkpoint: 'immediately_before_reset' } },
      { snapshot: { ...valid.snapshot, expected_project_ref: 'unknown' } },
      { sqlSource: SQL_SOURCE.replace('BEGIN READ ONLY;', 'BEGIN;') },
      { sqlSource: SQL_SOURCE.replace('ROLLBACK;', 'COMMIT;') },
    ];
    for (const drift of drifts) {
      expect(() => assertCheckpoint1ReadOnlyAggregate({
        ...valid,
        ...drift,
      })).toThrow(/PATCH83U_CHECKPOINT1_READ_ONLY_PROOF_FAILED/);
    }
  });

  it('P02 proves the complete initial Employee state before sessions', () => {
    expect(assertInitialEmployeeStateAggregate(initialSnapshot())).toBe(true);
    const mutations = [
      (snapshot: any) => { snapshot.target.user_id = 'wrong'; },
      (snapshot: any) => { snapshot.target.profile_active = false; },
      (snapshot: any) => {
        snapshot.target.same_organization_as_designated_admin = false;
      },
      (snapshot: any) => { snapshot.target.credential_version = 3; },
      (snapshot: any) => { snapshot.target.auth_credential_version = 3; },
      (snapshot: any) => { snapshot.target.requested_lifecycle = 'suspended'; },
      (snapshot: any) => { snapshot.target.role = 'super_admin'; },
      (snapshot: any) => { snapshot.target.scope = 'global'; },
      (snapshot: any) => { snapshot.target.pending_operation = true; },
      (snapshot: any) => { snapshot.target.session_count = 1; },
      (snapshot: any) => { snapshot.target.unrevoked_refresh_token_count = 1; },
    ];
    for (const mutate of mutations) {
      const snapshot = structuredClone(initialSnapshot());
      mutate(snapshot);
      expect(() => assertInitialEmployeeStateAggregate(snapshot)).toThrow(
        /PATCH83U_INITIAL_EMPLOYEE_STATE_PROOF_FAILED/,
      );
    }
  });

  it('P02 proves every finalizer and recovery catalog component', () => {
    expect(assertFinalizerAndRecoveryReadyAggregate(initialSnapshot())).toBe(true);
    const catalogFields = [
      ...Object.keys(initialSnapshot().finalizer).map(
        (field) => ['finalizer', field] as const,
      ),
      ...Object.keys(initialSnapshot().recovery).map(
        (field) => ['recovery', field] as const,
      ),
    ];
    for (const [section, field] of catalogFields) {
      const snapshot: any = structuredClone(initialSnapshot());
      snapshot[section][field] =
        typeof snapshot[section][field] === 'boolean' ? false : 'unexpected';
      expect(() => assertFinalizerAndRecoveryReadyAggregate(snapshot)).toThrow(
        /PATCH83U_FINALIZER_AND_RECOVERY_READY_PROOF_FAILED/,
      );
    }
    const missingMigration: any = structuredClone(initialSnapshot());
    missingMigration.applied_migrations = ['174', '176'];
    expect(() => assertFinalizerAndRecoveryReadyAggregate(
      missingMigration,
    )).toThrow(/PATCH83U_FINALIZER_AND_RECOVERY_READY_PROOF_FAILED/);
  });

  it('P03 binds both exact Employee identities to both successful refresh outcomes', () => {
    const valid = {
      employeeUserIds: [TARGET_USER_ID, TARGET_USER_ID],
      refreshSucceededByContext: [true, true],
      employeeContextProofs:
        CONTROLLED_EMPLOYEE_CONTEXT_LABELS.map(employeeProof),
    };
    expect(assertBothControlledRefreshesAggregate(valid)).toBe(true);
    const drifts = [
      { employeeUserIds: [TARGET_USER_ID, 'wrong'] },
      { employeeUserIds: [TARGET_USER_ID] },
      { refreshSucceededByContext: [true, false] },
      { refreshSucceededByContext: [true] },
      {
        employeeContextProofs: valid.employeeContextProofs.map(
          (proof, index) => ({
            ...proof,
            refresh_succeeded: index === 0 ? false : true,
          }),
        ),
      },
      {
        employeeContextProofs: valid.employeeContextProofs.map(
          (proof, index) => ({
            ...proof,
            label: index === 0 ? 'wrong' : proof.label,
          }),
        ),
      },
    ];
    for (const drift of drifts) {
      expect(() => assertBothControlledRefreshesAggregate({
        ...valid,
        ...drift,
      })).toThrow(/PATCH83U_BOTH_CONTROLLED_REFRESHES_PROOF_FAILED/);
    }
  });

  it('P05 binds the real reset envelope and prepared UI to one controller submission', async () => {
    const controller = new ResetSubmissionController();
    await armController(controller);
    const envelope = resetEnvelope();
    await controller.submit({ passed: true }, async () => {
      expect(assertOneShotResetAggregate({
        controller,
        submissionCount: 1,
        requestEnvelope: envelope,
        userManagementActionPrepared: true,
      })).toBe(envelope.payload.request_id);
    });
    await expect(controller.submit({ passed: true }, vi.fn())).rejects.toThrow(
      /PATCH83U_RESET_RETRY_REFUSED/,
    );
    for (const drift of [
      { submissionCount: 2 },
      { requestEnvelope: { ...envelope, action: 'wrong' } },
      { userManagementActionPrepared: false },
      { controller: new ResetSubmissionController() },
    ]) {
      expect(() => assertOneShotResetAggregate({
        controller,
        submissionCount: 1,
        requestEnvelope: envelope,
        userManagementActionPrepared: true,
        ...drift,
      })).toThrow(/PATCH83U_ONE_SHOT_RESET_PROOF_FAILED/);
    }
  });

  it('P05 proves one request ID is observed at submission and one hash remains stable', async () => {
    const controller = new ResetSubmissionController();
    await armController(controller);
    const requestId = 'patch83u-run007-stable-request';
    const expectedHash = hashRequestId(requestId);
    await controller.submit({ passed: true }, async () => {
      const observedHash = controller.observeRequestId(requestId);
      expect(assertStableResetRequestCorrelationAggregate({
        controller,
        envelopeRequestId: requestId,
        evidenceRequestIdHash: observedHash,
        submissionCount: 1,
      })).toBe(expectedHash);
    });
    const valid = {
      controller,
      envelopeRequestId: requestId,
      evidenceRequestIdHash: expectedHash,
      submissionCount: 1,
    };
    for (const drift of [
      { envelopeRequestId: 'patch83u-run007-other-request' },
      { evidenceRequestIdHash: 'b'.repeat(64) },
      { submissionCount: 2 },
      { controller: new ResetSubmissionController() },
    ]) {
      expect(() => assertStableResetRequestCorrelationAggregate({
        ...valid,
        ...drift,
      })).toThrow(
        /PATCH83U_STABLE_RESET_REQUEST_CORRELATION_PROOF_FAILED/,
      );
    }
  });

  it('P06 proves Checkpoint 3 exists after submission with its read-only SQL contract', () => {
    const snapshot: any = {
      ...initialSnapshot(),
      checkpoint: 'immediately_after_reset',
    };
    const valid = {
      snapshot,
      sqlSource: SQL_SOURCE,
      resetSubmissionStarted: true,
      edgeOutcome: { confirmed_success: false },
      checkpointOutcome: { classification: 'reset_in_progress' },
    };
    expect(assertCheckpoint3AlwaysAggregate(valid)).toBe(true);
    for (const drift of [
      { resetSubmissionStarted: false },
      { edgeOutcome: null },
      { checkpointOutcome: null },
      { snapshot: { ...snapshot, transaction_read_only: false } },
      { snapshot: { ...snapshot, checkpoint: 'before_employee_sessions' } },
      {
        sqlSource: SQL_SOURCE.replace(
          '-- CHECKPOINT 3\n-- FILE: 03-immediately-after-reset.json\nBEGIN READ ONLY;',
          '-- CHECKPOINT 3\n-- FILE: 03-immediately-after-reset.json\nBEGIN;',
        ),
      },
    ]) {
      expect(() => assertCheckpoint3AlwaysAggregate({
        ...valid,
        ...drift,
      })).toThrow(/PATCH83U_CHECKPOINT3_ALWAYS_PROOF_FAILED/);
    }
  });

  it('P06 keeps every protected state fail closed and performs no automatic recovery', () => {
    const edgeOutcome = { confirmed_success: true };
    const checkpointOutcome = {
      classification: 'admin_reset_change_required',
      expected_success: true,
    };
    const valid = {
      edgeOutcome,
      checkpointOutcome,
      progression: evaluateResetProgression(edgeOutcome, checkpointOutcome),
      automaticRecoveryActions: [],
      postSubmissionCleanupSucceeded: true,
    };
    expect(assertProtectedStateFailClosedAggregate(valid)).toBe(true);
    const protectedOutcome = {
      classification: 'recovery_required',
      expected_success: false,
    };
    expect(assertProtectedStateFailClosedAggregate({
      edgeOutcome,
      checkpointOutcome: protectedOutcome,
      progression: evaluateResetProgression(edgeOutcome, protectedOutcome),
      automaticRecoveryActions: [],
      postSubmissionCleanupSucceeded: true,
    })).toBe(true);
    for (const drift of [
      { checkpointOutcome: { classification: 'unknown', expected_success: false } },
      { progression: { ...valid.progression, allowed: false } },
      {
        progression: {
          ...valid.progression,
          edge_success_confirmed: false,
        },
      },
      { automaticRecoveryActions: ['patch83u_abort_admin_reset'] },
      { postSubmissionCleanupSucceeded: false },
    ]) {
      expect(() => assertProtectedStateFailClosedAggregate({
        ...valid,
        ...drift,
      })).toThrow(/PATCH83U_PROTECTED_STATE_FAIL_CLOSED_PROOF_FAILED/);
    }
  });

  it('P08 requires complete independent denial proof for both stale contexts', () => {
    const proofs = CONTROLLED_EMPLOYEE_CONTEXT_LABELS.map(staleProof);
    const valid = {
      staleContextProofs: proofs,
      staleContext1Denied: true,
      staleContext2Denied: true,
    };
    expect(assertBothStaleContextsDeniedAggregate(valid).passed).toBe(true);
    for (const drift of [
      { staleContext1Denied: false },
      { staleContext2Denied: false },
      { staleContextProofs: proofs.slice(0, 1) },
      {
        staleContextProofs: proofs.map((proof, index) => ({
          ...proof,
          authenticated_user_absent: index === 0 ? false : true,
        })),
      },
      {
        staleContextProofs: proofs.map((proof, index) => ({
          ...proof,
          protected_route_access_denied: index === 1 ? false : true,
        })),
      },
    ]) {
      expect(() => assertBothStaleContextsDeniedAggregate({
        ...valid,
        ...drift,
      })).toThrow(/PATCH83U_BOTH_STALE_CONTEXTS_DENIED_PROOF_FAILED/);
    }
  });

  it('P11 binds hidden in-memory secrets, password inequality, and bounded policy retries', () => {
    const temporary = new SecretValue('temporary-value');
    const permanent = new SecretValue('permanent-value');
    const other = new SecretValue('other-value');
    const credentialValues = [temporary, permanent, other];
    const valid = {
      credentialValues,
      knownSecrets: [...credentialValues],
      temporaryPassword: temporary,
      newPermanentPassword: permanent,
      hiddenPrompt: promptHidden,
      credentialsPersisted: false,
      maxAttempts: PASSWORD_CHANGE_MAX_ATTEMPTS,
      passwordChangeRun: {
        candidate: permanent,
        attempt_count: 2,
        policy_rejection_count: 1,
        policy_error_codes: [PERMANENT_PASSWORD_POLICY_ERROR_CODE],
      },
    };
    try {
      expect(assertSecretAndPolicyControlsAggregate(valid)).toBe(true);
      for (const drift of [
        { credentialValues: [temporary, {}] },
        { knownSecrets: [temporary, other] },
        { newPermanentPassword: temporary },
        { hiddenPrompt: vi.fn() },
        { credentialsPersisted: true },
        { maxAttempts: PASSWORD_CHANGE_MAX_ATTEMPTS + 1 },
        {
          passwordChangeRun: {
            ...valid.passwordChangeRun,
            attempt_count: 4,
          },
        },
        {
          passwordChangeRun: {
            ...valid.passwordChangeRun,
            policy_error_codes: ['UNEXPECTED_POLICY_CODE'],
          },
        },
      ]) {
        expect(() => assertSecretAndPolicyControlsAggregate({
          ...valid,
          ...drift,
        })).toThrow(/PATCH83U_SECRET_AND_POLICY_CONTROLS_PROOF_FAILED/);
      }
    } finally {
      temporary.clear();
      permanent.clear();
      other.clear();
    }
  });

  it('P13 combines production absence with exact zero network and console diagnostics', () => {
    const valid = {
      configuration: stagingConfiguration(),
      targetGuard: cleanTargetGuard(),
      productionProjectAbsent: true,
    };
    expect(assertNetworkConsoleSafeAggregate(valid)).toMatchObject({
      safe: true,
      console_error_count: 0,
      request_failure_count: 0,
    });
    const diagnosticFields = [
      'console_error_count',
      'page_error_count',
      'request_failure_count',
      'server_error_response_count',
    ];
    for (const field of diagnosticFields) {
      const targetGuard: any = cleanTargetGuard();
      targetGuard.diagnostics[field] = 1;
      expect(() => assertNetworkConsoleSafeAggregate({
        ...valid,
        targetGuard,
      })).toThrow(/PATCH83U_NETWORK_CONSOLE_SAFE_PROOF_FAILED/);
    }
    for (const drift of [
      { productionProjectAbsent: false },
      { targetGuard: { ...cleanTargetGuard(), violation: 'blocked' } },
      {
        configuration: {
          ...stagingConfiguration(),
          app_url: `${STAGING_APPLICATION_ORIGIN}/${PRODUCTION_PROJECT_REF}`,
        },
      },
    ]) {
      expect(() => assertNetworkConsoleSafeAggregate({
        ...valid,
        ...drift,
      })).toThrow(/PATCH83U_NETWORK_CONSOLE_SAFE_PROOF_FAILED/);
    }
  });

  it('P13 counts an unexpected ERR_ABORTED failure but ignores an intentional harness abort', async () => {
    const createContext = async () => {
      const listeners: Record<string, (value: any) => void> = {};
      const context = {
        on: vi.fn((event: string, listener: (value: any) => void) => {
          listeners[event] = listener;
        }),
        route: vi.fn(async () => undefined),
      };
      const targetGuard = cleanTargetGuard();
      await createSafeBrowserContext(
        { newContext: vi.fn(async () => context) },
        {
          baseURL: STAGING_APPLICATION_ORIGIN,
          recordHar: undefined,
          recordVideo: undefined,
          storageState: undefined,
        },
        targetGuard,
      );
      return { listeners, targetGuard };
    };
    const unexpected = await createContext();
    unexpected.listeners.requestfailed({
      failure: () => ({ errorText: 'net::ERR_ABORTED' }),
    });
    expect(() => assertNetworkConsoleSafeAggregate({
      configuration: stagingConfiguration(),
      targetGuard: unexpected.targetGuard,
      productionProjectAbsent: true,
    })).toThrow(/PATCH83U_NETWORK_CONSOLE_SAFE_PROOF_FAILED/);

    const intentional = await createContext();
    const request = {
      failure: () => ({ errorText: 'net::ERR_ABORTED' }),
    };
    markIntentionalBrowserRequestAbort(intentional.targetGuard, request);
    intentional.listeners.requestfailed(request);
    expect(assertNetworkConsoleSafeAggregate({
      configuration: stagingConfiguration(),
      targetGuard: intentional.targetGuard,
      productionProjectAbsent: true,
    })).toMatchObject({ safe: true, request_failure_count: 0 });
  });

  it('performs no hosted call while evaluating all substantive aggregates', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      expect(assertInitialEmployeeStateAggregate(initialSnapshot())).toBe(true);
      expect(assertFinalizerAndRecoveryReadyAggregate(initialSnapshot())).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
