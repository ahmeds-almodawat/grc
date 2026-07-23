import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PRODUCTION_PROJECT_REF,
  STAGING_PROJECT_REF,
} from '../../scripts/patch83u-staging-multisession-reset-proof.mjs';
import { loadRun008BrowserConfiguration } from '../../scripts/patch83u-run008-dpapi-credentials.mjs';

const freezeContractTests = [
  'tests/unit/patch83uExecutionFreezeContract.test.ts',
  'tests/unit/patch83uRun008ExecutionFreezeContract.test.ts',
  'tests/unit/patch83uRun009ExecutionFreezeContract.test.ts',
];

class SyntheticSecret {
  clear() {}
}

afterEach(() => vi.unstubAllGlobals());

describe('Patch 83U hermetic release fixtures', () => {
  it('never reads ignored runtime checkpoint paths from freeze contract tests', () => {
    for (const path of freezeContractTests) {
      const source = readFileSync(resolve(path), 'utf8');
      expect(source).not.toContain(
        'release/patch83u/reset-proof-run-003/checkpoints',
      );
      expect(source).not.toContain('01-before-employee-sessions.json');
      expect(source).toContain('createSyntheticPatch83uCheckpointFixture');
    }
  });

  it('loads only process-injected synthetic browser configuration without network access', async () => {
    const hostedCall = vi.fn();
    vi.stubGlobal('fetch', hostedCall);
    const readEnvironment = vi.fn().mockResolvedValue(
      `VITE_SUPABASE_URL=https://${STAGING_PROJECT_REF}.supabase.co\n`
      + 'VITE_SUPABASE_ANON_KEY=sb_publishable_synthetic_unit_test_only\n',
    );
    const configuration = await loadRun008BrowserConfiguration({
      environmentPath: 'synthetic-process-only',
      readEnvironment,
      secretFactory: () => new SyntheticSecret(),
    });
    expect(configuration.projectRef).toBe(STAGING_PROJECT_REF);
    expect(readEnvironment).toHaveBeenCalledWith(
      'synthetic-process-only',
      'utf8',
    );
    expect(hostedCall).not.toHaveBeenCalled();
  });

  it('continues to reject production and secret-shaped configuration', async () => {
    for (const value of [
      `VITE_SUPABASE_URL=https://${PRODUCTION_PROJECT_REF}.supabase.co\n`
        + 'VITE_SUPABASE_ANON_KEY=sb_publishable_synthetic_unit_test_only\n',
      `VITE_SUPABASE_URL=https://${STAGING_PROJECT_REF}.supabase.co\n`
        + 'VITE_SUPABASE_ANON_KEY=sb_secret_synthetic_rejection_fixture\n',
    ]) {
      await expect(loadRun008BrowserConfiguration({
        environmentPath: 'synthetic-process-only',
        readEnvironment: async () => value,
        secretFactory: () => new SyntheticSecret(),
      })).rejects.toThrow();
    }
  });
});
