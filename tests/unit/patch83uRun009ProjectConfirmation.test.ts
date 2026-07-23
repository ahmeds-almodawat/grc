import { describe, expect, it, vi } from 'vitest';
import {
  PRODUCTION_PROJECT_REF,
  SQL_EDITOR_PROJECT_CONFIRMATION_GATE_ID,
  STAGING_APPLICATION_ORIGIN,
  STAGING_PROJECT_REF,
  assertSqlEditorProjectConfirmation,
  createExecutionPlan,
  parseCliArguments,
  runPreCredentialReadiness,
  runSqlEditorEvidence,
} from '../../scripts/patch83u-staging-multisession-reset-proof.mjs';

const stagingUrl = `https://${STAGING_PROJECT_REF}.supabase.co`;
const freeze = {
  targets: {
    allowed_staging_project_ref: STAGING_PROJECT_REF,
    prohibited_production_project_ref: PRODUCTION_PROJECT_REF,
  },
};

function executionArgs(extra: string[] = []) {
  return parseCliArguments([
    '--precredential-readiness-only',
    '--precredential-inert-fixture',
    '--app-url', STAGING_APPLICATION_ORIGIN,
    '--supabase-url', stagingUrl,
    '--evidence-channel', 'sql-editor',
    '--sql-editor-project-ref', STAGING_PROJECT_REF,
    '--out',
    'release/patch83u/reset-proof-run-009/patch83u-staging-reset-final-results-attempt-001.json',
    '--checkpoint-dir', 'release/patch83u/reset-proof-run-009/checkpoints',
    '--execution-freeze',
    'release/patch83u/patch83u-staging-reset-execution-freeze-v9-20260721.json',
    '--execution-freeze-sha256', 'a'.repeat(64),
    ...extra,
  ]);
}

describe('Patch 83U Run 009 SQL Editor project confirmation', () => {
  it('accepts only the exact staging ref bound to URL and freeze', () => {
    expect(assertSqlEditorProjectConfirmation({
      projectRef: STAGING_PROJECT_REF,
      supabaseUrl: stagingUrl,
      freeze,
    })).toEqual({
      passed: true,
      project_ref: STAGING_PROJECT_REF,
      gate_id: SQL_EDITOR_PROJECT_CONFIRMATION_GATE_ID,
    });
  });

  it.each([
    [undefined, 'PATCH83U_SQL_EDITOR_PROJECT_REF_REQUIRED'],
    ['', 'PATCH83U_SQL_EDITOR_PROJECT_REF_REQUIRED'],
    ['bad ref', 'PATCH83U_SQL_EDITOR_PROJECT_REF_MALFORMED'],
    [PRODUCTION_PROJECT_REF, 'PATCH83U_PRODUCTION_SQL_EDITOR_TARGET_REFUSED'],
    ['aaaaaaaaaaaaaaaaaaaa', 'PATCH83U_STAGING_SQL_EDITOR_TARGET_NOT_CONFIRMED'],
    [stagingUrl, 'PATCH83U_SQL_EDITOR_PROJECT_REF_MALFORMED'],
    [`user@${STAGING_PROJECT_REF}`, 'PATCH83U_SQL_EDITOR_PROJECT_REF_MALFORMED'],
  ])('rejects unsafe project ref %s', (projectRef, code) => {
    expect(() => assertSqlEditorProjectConfirmation({
      projectRef,
      supabaseUrl: stagingUrl,
      freeze,
    })).toThrow(code);
  });

  it('rejects URL and freeze target mismatches', () => {
    expect(() => assertSqlEditorProjectConfirmation({
      projectRef: STAGING_PROJECT_REF,
      supabaseUrl: 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',
      freeze,
    })).toThrow('PATCH83U_SQL_EDITOR_PROJECT_REF_URL_MISMATCH');
    expect(() => assertSqlEditorProjectConfirmation({
      projectRef: STAGING_PROJECT_REF,
      supabaseUrl: stagingUrl,
      freeze: {
        targets: {
          allowed_staging_project_ref: 'aaaaaaaaaaaaaaaaaaaa',
          prohibited_production_project_ref: PRODUCTION_PROJECT_REF,
        },
      },
    })).toThrow('PATCH83U_SQL_EDITOR_PROJECT_REF_FREEZE_MISMATCH');
  });

  it('requires the option once and only with the SQL Editor channel', () => {
    expect(() => parseCliArguments([
      '--sql-editor-project-ref', STAGING_PROJECT_REF,
      '--sql-editor-project-ref', STAGING_PROJECT_REF,
    ])).toThrow('PATCH83U_DUPLICATE_ARGUMENT_REFUSED');
    expect(() => createExecutionPlan({
      ...executionArgs(),
      evidenceChannel: 'postgres',
    })).toThrow('PATCH83U_SQL_EDITOR_PROJECT_REF_CHANNEL_REFUSED');
    expect(() => createExecutionPlan({
      ...executionArgs(),
      sqlEditorProjectRef: undefined,
    })).toThrow('PATCH83U_SQL_EDITOR_PROJECT_REF_REQUIRED');
  });

  it('passes the exact validated ref to checkpoint validation without a hidden prompt', async () => {
    const waitForCheckpoint = vi.fn(async (input) => input);
    const result = await runSqlEditorEvidence('before_employee_sessions', {
      projectConfirmation: assertSqlEditorProjectConfirmation({
        projectRef: STAGING_PROJECT_REF,
        supabaseUrl: stagingUrl,
        freeze,
      }),
      waitForCheckpoint,
      checkpointDirectory: 'unused',
      checkpointState: {},
      checkpointSchema: {},
    });
    expect(result.operatorProjectRef).toBe(STAGING_PROJECT_REF);
    expect(waitForCheckpoint).toHaveBeenCalledOnce();
  });

  it('runs real precredential orchestration past the former TTY gate without credentials or hosted calls', async () => {
    const loadCredentialBundle = vi.fn();
    const hostedCall = vi.fn();
    const projectConfirmation = assertSqlEditorProjectConfirmation({
      projectRef: STAGING_PROJECT_REF,
      supabaseUrl: stagingUrl,
      freeze,
    });
    const browserKey = { clear: vi.fn() };
    const result = await runPreCredentialReadiness(executionArgs(), {
      resolveOutputPath: async () => 'unused-output',
      resolveCheckpointDirectory: async () => 'unused-checkpoints',
      loadStagingFrontendLaunch: async () => ({
        projectRef: STAGING_PROJECT_REF,
        origin: STAGING_APPLICATION_ORIGIN,
        mode: 'staging',
      }),
      fetchApplication: async () => ({
        ok: true,
        url: `${STAGING_APPLICATION_ORIGIN}/`,
        body: { cancel: async () => {} },
      }),
      prepareEdgeDeploymentGate: async () => ({
        projectConfirmation,
        observed_at: new Date().toISOString(),
      }),
      runCleanBrowserReadiness: async () => ({
        signed_out_before_reload: true,
        signed_out_after_reload: true,
        staging_project_exact: true,
        production_request_absent: true,
      }),
      loadRun008BrowserConfiguration: async () => ({
        projectRef: STAGING_PROJECT_REF,
        supabaseUrl: stagingUrl,
        publicApiKey: browserKey,
      }),
      loadRun008CredentialBundle: loadCredentialBundle,
      hostedCall,
    });
    expect(result.noSecretFixture).toBe(true);
    expect(result.projectConfirmation).toEqual(projectConfirmation);
    expect(loadCredentialBundle).not.toHaveBeenCalled();
    expect(hostedCall).not.toHaveBeenCalled();
  });

  it('keeps sensitive hidden prompts and one-shot reset gates in source', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) =>
      readFile('scripts/patch83u-staging-multisession-reset-proof.mjs', 'utf8'));
    expect(source).toContain('export async function promptHidden');
    expect(source).toContain('PATCH83U_RESET_RETRY_REFUSED');
    expect(source).toContain('PATCH83U_RUN007_OPERATOR_CONFIRMATION_REQUIRED');
    const checkpointFunction = source.slice(
      source.indexOf('export async function runSqlEditorEvidence'),
      source.indexOf('export function assertFrontendProjectAttestation'),
    );
    expect(checkpointFunction).not.toContain('promptHidden(');
  });
});
