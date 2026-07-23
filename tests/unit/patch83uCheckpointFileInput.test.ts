import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  PRODUCTION_PROJECT_REF,
  RESET_PROOF_SCHEMA_VERSION,
  RUN007_EVIDENCE_DIRECTORY,
  SQL_EDITOR_PROJECT_CONFIRMATION_GATE_ID,
  SQL_EDITOR_CHECKPOINT_DIRECTORY,
  SQL_EDITOR_CHECKPOINT_FILE_NAMES,
  SQL_EDITOR_CHECKPOINT_MAX_BYTES,
  STAGING_PROJECT_REF,
  assertCheckpointFilesReadyForReset,
  assertCheckpointInputEvidenceSequence,
  assertEvidenceMatchesSchemaContract,
  assertRun007OutputCandidate,
  assertSecretSafeEvidence,
  checkpointFileName,
  createCheckpointFileState as createHarnessCheckpointFileState,
  createExecutionPlan,
  parseCliArguments,
  readSqlEditorCheckpointFile,
  resolveRun007OutputPath,
  resolveSqlEditorCheckpointDirectory,
  waitForSqlEditorCheckpointFile,
} from '../../scripts/patch83u-staging-multisession-reset-proof.mjs';

const checkpointSchema = JSON.parse(readFileSync(
  resolve('release/patch83u/patch83u-staging-checkpoint-file-schema-v3.json'),
  'utf8',
));
const resetEvidenceSchema = JSON.parse(readFileSync(
  resolve('release/patch83u/patch83u-staging-reset-harness-schema-v8.json'),
  'utf8',
));
const harnessSource = readFileSync(
  resolve('scripts/patch83u-staging-multisession-reset-proof.mjs'),
  'utf8',
);
const gitignoreSource = readFileSync(resolve('.gitignore'), 'utf8');

function createCheckpointFileState() {
  return createHarnessCheckpointFileState({ runStartedAtMs: 0 });
}

function checkpointSnapshot(
  checkpoint = 'before_employee_sessions',
  capturedAt = '2026-07-20T10:00:00.000Z',
) {
  const immediatelyBeforeReset = checkpoint === 'immediately_before_reset';
  const immediatelyAfterReset = checkpoint === 'immediately_after_reset';
  const beforeRequiredPasswordChange =
    checkpoint === 'before_required_password_change';
  const afterPasswordChangeFinalization =
    checkpoint === 'immediately_after_password_change_finalization';
  const afterFreshEmployeeLogin = checkpoint === 'after_fresh_employee_login';
  const versionThree =
    immediatelyAfterReset || beforeRequiredPasswordChange;
  const versionFour =
    afterPasswordChangeFinalization || afterFreshEmployeeLogin;
  const oneSession =
    beforeRequiredPasswordChange || afterFreshEmployeeLogin;
  return {
    checkpoint,
    expected_project_ref: STAGING_PROJECT_REF,
    operator_project_confirmation_required: true,
    transaction_read_only: true,
    captured_at: capturedAt,
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
      user_id: '2a276bdb-cf51-4303-846e-6b7fecf38b0c',
      profile_state: 'active',
      profile_active: true,
      same_organization_as_designated_admin: true,
      credential_state: versionThree
        ? 'admin_reset_change_required'
        : 'active',
      credential_version: versionFour ? 6 : versionThree ? 5 : 4,
      auth_credential_version: versionFour ? 6 : versionThree ? 5 : 4,
      requested_lifecycle: 'active',
      role: 'employee',
      scope: 'assigned_only',
      active_role_count: 1,
      pending_operation: false,
      pending_operation_count: 0,
      session_count: immediatelyBeforeReset ? 2 : oneSession ? 1 : 0,
      unrevoked_refresh_token_count:
        immediatelyBeforeReset ? 2 : oneSession ? 1 : 0,
      updated_at: '2026-07-20T09:59:00.000Z',
      ...(immediatelyAfterReset ? {
        reconciliation_auth_changed: false,
      } : {}),
      ...(afterPasswordChangeFinalization ? {
        password_changed_at_set: true,
        sessions_revoked_at_set: true,
        reconciliation_auth_changed: false,
      } : {}),
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
      updated_at: '2026-07-20T09:59:00.000Z',
    },
    audit: {},
    eligible_super_admin_count: 1,
    ...(
      checkpoint === 'before_employee_sessions' || immediatelyBeforeReset
        ? {
            applied_migrations: ['174', '176', '177'],
            finalizer: {
              name: 'patch83u_finalize_password_change_after_revocation',
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
          }
        : {}
    ),
  };
}

describe('Patch 83U SQL Editor checkpoint-file input', () => {
  let repositoryRoot: string;
  let checkpointDirectory: Awaited<
    ReturnType<typeof resolveSqlEditorCheckpointDirectory>
  >;
  let blockedNetworkFetch: ReturnType<typeof vi.fn>;

  const nowMs = Date.parse('2026-07-20T10:01:00.000Z');
  const allowIgnoredPath = vi.fn(async () => true);
  const rejectTrackedPath = vi.fn(async () => false);

  async function resolveFixtureDirectory() {
    checkpointDirectory = await resolveSqlEditorCheckpointDirectory(
      SQL_EDITOR_CHECKPOINT_DIRECTORY,
      {
        repositoryRoot,
        isIgnored: allowIgnoredPath,
        isTracked: rejectTrackedPath,
      },
    );
  }

  function fixturePath(checkpoint: keyof typeof SQL_EDITOR_CHECKPOINT_FILE_NAMES) {
    return join(
      repositoryRoot,
      ...SQL_EDITOR_CHECKPOINT_DIRECTORY.split('/'),
      checkpointFileName(checkpoint),
    );
  }

  async function writeCheckpoint(
    checkpoint: keyof typeof SQL_EDITOR_CHECKPOINT_FILE_NAMES,
    value: unknown,
    multiline = false,
  ) {
    const destination = fixturePath(checkpoint);
    await writeFile(
      destination,
      multiline ? JSON.stringify(value, null, 2) : JSON.stringify(value),
      'utf8',
    );
    return destination;
  }

  beforeEach(async () => {
    blockedNetworkFetch = vi.fn(async () => {
      throw new Error('PATCH83U_UNIT_TEST_NETWORK_REFUSED');
    });
    vi.stubGlobal('fetch', blockedNetworkFetch);
    repositoryRoot = await mkdtemp(join(tmpdir(), 'patch83u-checkpoints-'));
    await mkdir(
      join(repositoryRoot, ...SQL_EDITOR_CHECKPOINT_DIRECTORY.split('/')),
      { recursive: true },
    );
    allowIgnoredPath.mockClear();
    rejectTrackedPath.mockClear();
    await resolveFixtureDirectory();
  });

  afterEach(async () => {
    expect(blockedNetworkFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    await rm(repositoryRoot, { recursive: true, force: true });
  });

  it('uses six exact deterministic Run 007 filenames', () => {
    expect(SQL_EDITOR_CHECKPOINT_FILE_NAMES).toEqual({
      before_employee_sessions: '01-before-employee-sessions.json',
      immediately_before_reset: '02-immediately-before-reset.json',
      immediately_after_reset: '03-immediately-after-reset.json',
      before_required_password_change: '04-before-required-password-change.json',
      immediately_after_password_change_finalization:
        '05-immediately-after-password-change-finalization.json',
      after_fresh_employee_login: '06-after-fresh-employee-login.json',
    });
    expect(allowIgnoredPath).toHaveBeenCalledTimes(6);
    expect(rejectTrackedPath).toHaveBeenCalledTimes(6);
    expect(gitignoreSource).not.toContain(
      '/release/patch83u/reset-proof-run-007/checkpoints/*.json',
    );
    for (const fileName of Object.values(SQL_EDITOR_CHECKPOINT_FILE_NAMES)) {
      expect(gitignoreSource).toContain(
        `/release/patch83u/reset-proof-run-007/checkpoints/${fileName}`,
      );
    }
  });

  it('accepts a valid compact checkpoint file and returns only safe provenance', async () => {
    const snapshot = checkpointSnapshot();
    await writeCheckpoint('before_employee_sessions', snapshot);
    const result = await readSqlEditorCheckpointFile({
      checkpoint: 'before_employee_sessions',
      checkpointDirectory,
      state: createCheckpointFileState(),
      checkpointSchema,
      nowMs,
    });
    expect(result.snapshot).toMatchObject({
      ...snapshot,
      project_ref: STAGING_PROJECT_REF,
      database_target_verified_by_operator: true,
    });
    expect(result.evidence).toMatchObject({
      checkpoint: 'before_employee_sessions',
      source: 'sql_editor_checkpoint_file',
      checkpoint_file_bytes: expect.any(Number),
      checkpoint_file_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      project_confirmation_passed: true,
      project_ref: STAGING_PROJECT_REF,
      project_confirmation_gate_id: SQL_EDITOR_PROJECT_CONFIRMATION_GATE_ID,
      transaction_read_only: true,
      prohibited_fields_absent: true,
      observed_at: snapshot.captured_at,
    });
    expect(JSON.stringify(result.evidence)).not.toContain(
      JSON.stringify(snapshot),
    );
    expect(assertEvidenceMatchesSchemaContract({
      schema_version: RESET_PROOF_SCHEMA_VERSION,
      generated_at: '2026-07-20T10:01:00.000Z',
      execution_status: 'operator_stopped',
      project_ref: STAGING_PROJECT_REF,
      subject_user_id: '2a276bdb-cf51-4303-846e-6b7fecf38b0c',
      request_id_hash: null,
      checkpoint_inputs: [result.evidence],
      events: [{
        event: 'sql_editor_before_employee_sessions',
        result: true,
        observed_at: result.evidence.observed_at,
      }],
      operator_guidance: [],
    }, resetEvidenceSchema)).toBe(true);
  });

  it('accepts multiline JSON', async () => {
    await writeCheckpoint(
      'before_employee_sessions',
      checkpointSnapshot(),
      true,
    );
    await expect(readSqlEditorCheckpointFile({
      checkpoint: 'before_employee_sessions',
      checkpointDirectory,
      state: createCheckpointFileState(),
      checkpointSchema,
      nowMs,
    })).resolves.toMatchObject({
      snapshot: { checkpoint: 'before_employee_sessions' },
    });
  });

  it('rejects unexpected checkpoint properties even when their names are globally safe', async () => {
    await writeCheckpoint('before_employee_sessions', {
      ...checkpointSnapshot(),
      password_change: 'opaque-value-that-must-never-enter-a-checkpoint-file',
    });
    await expect(readSqlEditorCheckpointFile({
      checkpoint: 'before_employee_sessions',
      checkpointDirectory,
      state: createCheckpointFileState(),
      checkpointSchema,
      nowMs,
    })).rejects.toThrow(/PATCH83U_SCHEMA_ONE_OF_FAILED/);

    await writeCheckpoint('before_employee_sessions', {
      ...checkpointSnapshot(),
      finalizer: {
        name: 'patch83u_finalize_password_change_after_revocation',
        name_bytes: 50,
        exists: true,
        routine_kind_function: true,
        destination_name_unique: true,
        old_or_truncated_name_absent: true,
        security_definer: true,
        restricted_search_path: true,
        service_role_execute_only: 'opaque-value',
      },
    });
    await expect(readSqlEditorCheckpointFile({
      checkpoint: 'before_employee_sessions',
      checkpointDirectory,
      state: createCheckpointFileState(),
      checkpointSchema,
      nowMs,
    })).rejects.toThrow(/PATCH83U_SCHEMA_ONE_OF_FAILED/);
  });

  it('requires the exact safe Checkpoint 5 finalization booleans', () => {
    const valid = checkpointSnapshot(
      'immediately_after_password_change_finalization',
    );
    expect(assertEvidenceMatchesSchemaContract(valid, checkpointSchema)).toBe(true);

    for (const field of [
      'password_changed_at_set',
      'sessions_revoked_at_set',
    ] as const) {
      const missing = structuredClone(valid);
      delete missing.target[field];
      expect(() => assertEvidenceMatchesSchemaContract(
        missing,
        checkpointSchema,
      )).toThrow(/PATCH83U_SCHEMA_ONE_OF_FAILED/);

      const falseProof = structuredClone(valid);
      falseProof.target[field] = false;
      expect(() => assertEvidenceMatchesSchemaContract(
        falseProof,
        checkpointSchema,
      )).toThrow(/PATCH83U_SCHEMA_ONE_OF_FAILED/);

      const wrongType = structuredClone(valid);
      wrongType.target[field] = 'true' as unknown as boolean;
      expect(() => assertEvidenceMatchesSchemaContract(
        wrongType,
        checkpointSchema,
      )).toThrow(/PATCH83U_SCHEMA_ONE_OF_FAILED/);
    }
  });

  it('requires Checkpoint 5 reconciliation evidence to be exactly false', () => {
    const valid = checkpointSnapshot(
      'immediately_after_password_change_finalization',
    );

    const missing = structuredClone(valid);
    delete missing.target.reconciliation_auth_changed;
    expect(() => assertEvidenceMatchesSchemaContract(
      missing,
      checkpointSchema,
    )).toThrow(/PATCH83U_SCHEMA_ONE_OF_FAILED/);

    for (const value of [true, 'false']) {
      const invalid = structuredClone(valid);
      invalid.target.reconciliation_auth_changed =
        value as unknown as boolean;
      expect(() => assertEvidenceMatchesSchemaContract(
        invalid,
        checkpointSchema,
      )).toThrow(/PATCH83U_SCHEMA_ONE_OF_FAILED/);
    }
  });

  it.each([
    'password_changed_at_set',
    'sessions_revoked_at_set',
    'reconciliation_auth_changed',
  ] as const)(
    'rejects the Checkpoint 5-only %s field in unrelated phases',
    (field) => {
      const unrelated = checkpointSnapshot('before_employee_sessions');
      (unrelated.target as Record<string, unknown>)[field] =
        field === 'reconciliation_auth_changed' ? false : true;
      expect(() => assertEvidenceMatchesSchemaContract(
        unrelated,
        checkpointSchema,
      )).toThrow(/PATCH83U_SCHEMA_ONE_OF_FAILED/);
    },
  );

  it('accepts only the exact Checkpoint 6 session and refresh counts', () => {
    const valid = checkpointSnapshot('after_fresh_employee_login');
    expect(assertEvidenceMatchesSchemaContract(valid, checkpointSchema)).toBe(true);

    const cases = [
      ['zero sessions', 'session_count', 0],
      ['excess sessions', 'session_count', 2],
      ['wrong-type sessions', 'session_count', '1'],
      ['zero refresh rows', 'unrevoked_refresh_token_count', 0],
      ['excess refresh rows', 'unrevoked_refresh_token_count', 2],
      ['wrong-type refresh rows', 'unrevoked_refresh_token_count', '1'],
    ] as const;
    for (const [_label, field, value] of cases) {
      const invalid = structuredClone(valid);
      (invalid.target as Record<string, unknown>)[field] = value;
      expect(() => assertEvidenceMatchesSchemaContract(
        invalid,
        checkpointSchema,
      )).toThrow(/PATCH83U_SCHEMA_ONE_OF_FAILED/);
    }
  });

  it('rejects malformed JSON without echoing file contents', async () => {
    const marker = 'do-not-echo-checkpoint-content';
    await writeFile(
      fixturePath('before_employee_sessions'),
      `{"checkpoint":"${marker}"`,
      'utf8',
    );
    try {
      await readSqlEditorCheckpointFile({
        checkpoint: 'before_employee_sessions',
        checkpointDirectory,
        state: createCheckpointFileState(),
        checkpointSchema,
        nowMs,
      });
      throw new Error('expected rejection');
    } catch (error) {
      expect(String(error)).toContain('PATCH83U_SQL_EDITOR_EVIDENCE_JSON_INVALID');
      expect(String(error)).not.toContain(marker);
    }
  });

  it.each([
    [
      'wrong checkpoint label',
      {
        ...checkpointSnapshot(),
        checkpoint: 'immediately_before_reset',
      },
      /PATCH83U_(?:SCHEMA_ONE_OF_FAILED|SQL_EDITOR_EVIDENCE_GATE_FAILED)/,
    ],
    [
      'wrong project',
      {
        ...checkpointSnapshot(),
        expected_project_ref: PRODUCTION_PROJECT_REF,
      },
      /PATCH83U_(?:SCHEMA_ONE_OF_FAILED|PRODUCTION_SQL_EDITOR_EVIDENCE_REFUSED)/,
    ],
    [
      'read-write transaction',
      {
        ...checkpointSnapshot(),
        transaction_read_only: false,
      },
      /PATCH83U_(?:SCHEMA_ONE_OF_FAILED|SQL_EDITOR_EVIDENCE_GATE_FAILED)/,
    ],
    [
      'recursive secret field',
      {
        ...checkpointSnapshot(),
        nested: { authorization_header: 'redacted' },
      },
      /PATCH83U_PROHIBITED_EVIDENCE_KEY/,
    ],
  ])('rejects %s', async (_label, snapshot, expectedError) => {
    await writeCheckpoint('before_employee_sessions', snapshot);
    await expect(readSqlEditorCheckpointFile({
      checkpoint: 'before_employee_sessions',
      checkpointDirectory,
      state: createCheckpointFileState(),
      checkpointSchema,
      nowMs,
    })).rejects.toThrow(expectedError);
  });

  it('recursively rejects camelCase and separator-free secret field names', () => {
    for (const key of [
      'accessToken',
      'refreshToken',
      'authorizationHeader',
      'serviceRole',
      'sessionId',
      'storageState',
      'requestBody',
      'apiKey',
      'databaseUrl',
    ]) {
      expect(() => assertSecretSafeEvidence({
        safe_parent: { [key]: 'redacted' },
      })).toThrow(/PATCH83U_PROHIBITED_EVIDENCE_KEY/);
    }
    expect(assertSecretSafeEvidence({
      audit: { after_password_change: { operation_count: 1 } },
    })).toBe(true);
  });

  it('rejects stale evidence', async () => {
    await writeCheckpoint(
      'before_employee_sessions',
      checkpointSnapshot(
        'before_employee_sessions',
        '2026-07-20T09:55:59.999Z',
      ),
    );
    await expect(readSqlEditorCheckpointFile({
      checkpoint: 'before_employee_sessions',
      checkpointDirectory,
      state: createCheckpointFileState(),
      checkpointSchema,
      nowMs,
    })).rejects.toThrow(/PATCH83U_SQL_EDITOR_EVIDENCE_NOT_FRESH/);
  });

  it('rejects oversized files before parsing', async () => {
    await writeFile(
      fixturePath('before_employee_sessions'),
      Buffer.alloc(SQL_EDITOR_CHECKPOINT_MAX_BYTES + 1, 0x20),
    );
    await expect(readSqlEditorCheckpointFile({
      checkpoint: 'before_employee_sessions',
      checkpointDirectory,
      state: createCheckpointFileState(),
      checkpointSchema,
      nowMs,
    })).rejects.toThrow(/PATCH83U_SQL_EDITOR_CHECKPOINT_FILE_TOO_LARGE/);
  });

  it('rejects path traversal and symlinked checkpoint directories', async () => {
    await expect(resolveSqlEditorCheckpointDirectory(
      `../${SQL_EDITOR_CHECKPOINT_DIRECTORY}`,
      {
        repositoryRoot,
        isIgnored: allowIgnoredPath,
        isTracked: rejectTrackedPath,
      },
    )).rejects.toThrow(/PATCH83U_SQL_EDITOR_CHECKPOINT_DIRECTORY_REFUSED/);

    const symlinkRoot = await mkdtemp(join(tmpdir(), 'patch83u-symlink-'));
    try {
      const expected = join(
        symlinkRoot,
        ...SQL_EDITOR_CHECKPOINT_DIRECTORY.split('/'),
      );
      const target = join(symlinkRoot, 'real-checkpoints');
      await mkdir(dirname(expected), { recursive: true });
      await mkdir(target, { recursive: true });
      try {
        await symlink(target, expected, process.platform === 'win32' ? 'junction' : 'dir');
        await expect(resolveSqlEditorCheckpointDirectory(
          SQL_EDITOR_CHECKPOINT_DIRECTORY,
          {
            repositoryRoot: symlinkRoot,
            isIgnored: allowIgnoredPath,
            isTracked: rejectTrackedPath,
          },
        )).rejects.toThrow(/PATCH83U_SQL_EDITOR_CHECKPOINT_DIRECTORY_REFUSED/);
      } catch (error) {
        if (!['EPERM', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) {
          throw error;
        }
        expect(harnessSource).toContain('pathStat.isSymbolicLink()');
      }
    } finally {
      await rm(symlinkRoot, { recursive: true, force: true });
    }
  });

  it('rejects wrong order and duplicate checkpoint reuse', async () => {
    const state = createCheckpointFileState();
    await expect(readSqlEditorCheckpointFile({
      checkpoint: 'immediately_before_reset',
      checkpointDirectory,
      state,
      checkpointSchema,
      nowMs,
    })).rejects.toThrow(/PATCH83U_SQL_EDITOR_CHECKPOINT_ORDER_REFUSED/);

    await writeCheckpoint(
      'before_employee_sessions',
      checkpointSnapshot('before_employee_sessions'),
    );
    await readSqlEditorCheckpointFile({
      checkpoint: 'before_employee_sessions',
      checkpointDirectory,
      state,
      checkpointSchema,
      nowMs,
    });
    await expect(readSqlEditorCheckpointFile({
      checkpoint: 'before_employee_sessions',
      checkpointDirectory,
      state,
      checkpointSchema,
      nowMs,
    })).rejects.toThrow(/PATCH83U_SQL_EDITOR_CHECKPOINT_REUSE_REFUSED/);
  });

  it('refuses a checkpoint file that predates the current harness run', async () => {
    await writeCheckpoint(
      'before_employee_sessions',
      checkpointSnapshot('before_employee_sessions'),
    );
    const state = createHarnessCheckpointFileState({
      runStartedAtMs: Date.now() + 1_000,
    });
    await expect(readSqlEditorCheckpointFile({
      checkpoint: 'before_employee_sessions',
      checkpointDirectory,
      state,
      checkpointSchema,
      nowMs,
    })).rejects.toThrow(/PATCH83U_SQL_EDITOR_CHECKPOINT_FILE_PREEXISTS_RUN/);
  });

  it('refuses a copied checkpoint whose database capture predates the current run', async () => {
    const runStartedAtMs = Date.now() - 60_000;
    const copiedCapture = new Date(runStartedAtMs - 60_000).toISOString();
    await writeCheckpoint(
      'before_employee_sessions',
      checkpointSnapshot(
        'before_employee_sessions',
        copiedCapture,
      ),
    );
    await expect(readSqlEditorCheckpointFile({
      checkpoint: 'before_employee_sessions',
      checkpointDirectory,
      state: createHarnessCheckpointFileState({ runStartedAtMs }),
      checkpointSchema,
      nowMs: runStartedAtMs + 60_000,
    })).rejects.toThrow(
      /PATCH83U_SQL_EDITOR_CHECKPOINT_CAPTURE_PREEXISTS_RUN/,
    );
  });

  it('times out waiting for a missing file before any credential or hosted adapter', async () => {
    const waiting = vi.fn();
    await expect(waitForSqlEditorCheckpointFile({
      checkpoint: 'before_employee_sessions',
      checkpointDirectory,
      state: createCheckpointFileState(),
      checkpointSchema,
      timeoutMs: 0,
      now: () => nowMs,
      sleep: vi.fn(),
      onWaiting: waiting,
    })).rejects.toThrow(/PATCH83U_SQL_EDITOR_CHECKPOINT_FILE_WAIT_TIMEOUT/);
    expect(waiting).toHaveBeenCalledOnce();
    expect(blockedNetworkFetch).not.toHaveBeenCalled();
    expect(harnessSource.indexOf(
      "readCheckpoint('before_employee_sessions')",
    )).toBeLessThan(harnessSource.indexOf('const collectSecret = async'));
  });

  it('cannot satisfy the reset checkpoint gate until checkpoints 1 and 2 validate', async () => {
    const state = createCheckpointFileState();
    expect(() => assertCheckpointFilesReadyForReset(state)).toThrow(
      /PATCH83U_CHECKPOINT_FILES_NOT_READY_FOR_RESET/,
    );
    await writeCheckpoint(
      'before_employee_sessions',
      checkpointSnapshot('before_employee_sessions'),
    );
    await readSqlEditorCheckpointFile({
      checkpoint: 'before_employee_sessions',
      checkpointDirectory,
      state,
      checkpointSchema,
      nowMs,
    });
    expect(() => assertCheckpointFilesReadyForReset(state)).toThrow(
      /PATCH83U_CHECKPOINT_FILES_NOT_READY_FOR_RESET/,
    );
    await writeCheckpoint(
      'immediately_before_reset',
      checkpointSnapshot(
        'immediately_before_reset',
        '2026-07-20T10:00:30.000Z',
      ),
    );
    await readSqlEditorCheckpointFile({
      checkpoint: 'immediately_before_reset',
      checkpointDirectory,
      state,
      checkpointSchema,
      nowMs,
    });
    expect(assertCheckpointFilesReadyForReset(state)).toBe(true);
  });

  it('requires one exact checkpoint directory argument for executable mode', () => {
    const baseArgs = {
      execute: true,
      appUrl: 'http://localhost:5173',
      supabaseUrl: `https://${STAGING_PROJECT_REF}.supabase.co`,
      evidenceChannel: 'sql-editor',
      sqlEditorProjectRef: STAGING_PROJECT_REF,
      out:
        `${RUN007_EVIDENCE_DIRECTORY}/`
        + 'patch83u-staging-reset-final-results-attempt-999.json',
      executionFreeze:
        'release/patch83u/patch83u-staging-reset-execution-freeze-v6-20260720.json',
      executionFreezeSha256: 'a'.repeat(64),
    };
    expect(() => createExecutionPlan(baseArgs)).toThrow(
      /PATCH83U_SQL_EDITOR_CHECKPOINT_DIRECTORY_REQUIRED/,
    );
    expect(createExecutionPlan({
      ...baseArgs,
      checkpointDir: SQL_EDITOR_CHECKPOINT_DIRECTORY,
    })).toEqual({
      executable: true,
      precredentialReadiness: false,
      projectConfirmation: {
        passed: true,
        project_ref: STAGING_PROJECT_REF,
        gate_id: SQL_EDITOR_PROJECT_CONFIRMATION_GATE_ID,
      },
    });
    expect(() => parseCliArguments([
      '--checkpoint-dir',
      SQL_EDITOR_CHECKPOINT_DIRECTORY,
      '--checkpoint-dir',
      SQL_EDITOR_CHECKPOINT_DIRECTORY,
    ])).toThrow(/PATCH83U_DUPLICATE_ARGUMENT_REFUSED/);
  });

  it('binds output to a new, non-checkpoint current-run attempt file', async () => {
    const valid =
      `${RUN007_EVIDENCE_DIRECTORY}/`
      + 'patch83u-staging-reset-final-results-attempt-999.json';
    expect(assertRun007OutputCandidate(valid)).toBe(true);
    await expect(resolveRun007OutputPath(valid, {
      repositoryRoot,
    })).resolves.toBe(resolve(repositoryRoot, valid));
    for (const refused of [
      'release/patch83u/reset-proof-run-002/result.json',
      'release/patch83u/reset-proof-run-003/patch83u-staging-reset-final-results-attempt-999.json',
      'release/patch83u/reset-proof-run-004/patch83u-staging-reset-final-results-attempt-999.json',
      'release/patch83u/reset-proof-run-005/patch83u-staging-reset-final-results-attempt-999.json',
      `${RUN007_EVIDENCE_DIRECTORY}/checkpoints/02-immediately-before-reset.json`,
      `${RUN007_EVIDENCE_DIRECTORY}/../result.json`,
      resolve(repositoryRoot, 'result.json'),
    ]) {
      expect(() => assertRun007OutputCandidate(refused)).toThrow(
        /PATCH83U_RUN007_OUTPUT_PATH_REFUSED/,
      );
    }
    await writeFile(resolve(repositoryRoot, valid), '{}\n', 'utf8');
    await expect(resolveRun007OutputPath(valid, {
      repositoryRoot,
    })).rejects.toThrow(/PATCH83U_RUN007_OUTPUT_ALREADY_EXISTS/);
  });

  it('requires ordered, true, hash-bound checkpoint provenance in output evidence', () => {
    const valid = {
      checkpoint: 'before_employee_sessions',
      source: 'sql_editor_checkpoint_file',
      checkpoint_file_sha256: 'a'.repeat(64),
      checkpoint_file_bytes: 100,
      project_confirmation_passed: true,
      project_ref: STAGING_PROJECT_REF,
      project_confirmation_gate_id: SQL_EDITOR_PROJECT_CONFIRMATION_GATE_ID,
      transaction_read_only: true,
      prohibited_fields_absent: true,
      observed_at: '2026-07-20T10:00:00.000Z',
    };
    expect(assertCheckpointInputEvidenceSequence([valid])).toBe(true);
    expect(() => assertCheckpointInputEvidenceSequence([
      { ...valid, project_confirmation_passed: false },
    ])).toThrow(/PATCH83U_CHECKPOINT_INPUT_EVIDENCE_INVALID/);
    expect(() => assertEvidenceMatchesSchemaContract({
      schema_version: 'patch83u-staging-reset-proof-v3',
      generated_at: '2026-07-20T10:01:00.000Z',
      execution_status: 'operator_stopped',
      project_ref: STAGING_PROJECT_REF,
      subject_user_id: '2a276bdb-cf51-4303-846e-6b7fecf38b0c',
      request_id_hash: null,
      checkpoint_inputs: [{ ...valid, transaction_read_only: false }],
      events: [],
      operator_guidance: [],
    }, resetEvidenceSchema)).toThrow(/PATCH83U_SCHEMA_CONST_FAILED/);
    expect(() => assertEvidenceMatchesSchemaContract({
      schema_version: RESET_PROOF_SCHEMA_VERSION,
      generated_at: '2026-07-20T10:01:00.000Z',
      execution_status: 'completed',
      project_ref: STAGING_PROJECT_REF,
      subject_user_id: '2a276bdb-cf51-4303-846e-6b7fecf38b0c',
      request_id_hash: 'b'.repeat(64),
      checkpoint_inputs: [],
      events: [],
      operator_guidance: [],
    }, resetEvidenceSchema)).toThrow(/PATCH83U_SCHEMA_ONE_OF_FAILED/);
  });

  it('keeps the package-facing harness inert and contains no checkpoint JSON prompt', () => {
    expect(resetEvidenceSchema.properties.schema_version.const).toBe(
      RESET_PROOF_SCHEMA_VERSION,
    );
    expect(harnessSource).toContain(
      "patch83u-staging-reset-harness-schema-v8.json",
    );
    expect(harnessSource).toContain(
      "patch83u-staging-checkpoint-file-schema-v3.json",
    );
    expect(harnessSource).toContain(
      "evidenceSchema?.properties?.schema_version?.const !== RESET_PROOF_SCHEMA_VERSION",
    );
    expect(harnessSource).not.toContain('paste the single JSON result');
    expect(harnessSource).toContain('assertCheckpointFilesReadyForReset(checkpointState)');
    expect(harnessSource.indexOf(
      "readCheckpoint('before_employee_sessions')",
    )).toBeLessThan(harnessSource.indexOf('const collectSecret = async'));
    expect(harnessSource.indexOf(
      "readCheckpoint('immediately_before_reset')",
    )).toBeLessThan(harnessSource.indexOf(
      'executeOneShotResetAndCollectCheckpoint({',
      harnessSource.indexOf("readCheckpoint('immediately_before_reset')"),
    ));
  });
});
