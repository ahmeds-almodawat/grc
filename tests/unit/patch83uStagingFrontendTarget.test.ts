import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PATCH83U_PRODUCTION_PROJECT_REF,
  PATCH83U_STAGING_ORIGIN,
  PATCH83U_STAGING_PROJECT_REF,
  createStagingLaunchPlan,
  extractStagingProjectRef,
  parseStagingEnv,
  prepareStagingFrontendLaunch,
  validateStagingFrontendConfig,
} from '../../scripts/start-patch83u-staging-frontend.mjs';

const publicBrowserKey = 'sb_publishable_local_test_value_not_a_real_key';
const stagingUrl = `https://${PATCH83U_STAGING_PROJECT_REF}.supabase.co`;
const validConfig = () => ({
  VITE_SUPABASE_URL: stagingUrl,
  VITE_SUPABASE_ANON_KEY: publicBrowserKey,
  VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: 'true',
});

describe('Patch 83U staging-only frontend target', () => {
  it('accepts only the exact staging Supabase URL', () => {
    expect(extractStagingProjectRef(stagingUrl)).toBe(PATCH83U_STAGING_PROJECT_REF);
    expect(validateStagingFrontendConfig(validConfig()).projectRef)
      .toBe(PATCH83U_STAGING_PROJECT_REF);
  });

  it('rejects the production Supabase URL', () => {
    expect(() => extractStagingProjectRef(
      `https://${PATCH83U_PRODUCTION_PROJECT_REF}.supabase.co`,
    )).toThrow(/PATCH83U_STAGING_FRONTEND_PRODUCTION_REF_REFUSED/);
  });

  it('rejects an unknown Supabase project', () => {
    expect(() => extractStagingProjectRef(
      'https://abcdefghijklmnopqrst.supabase.co',
    )).toThrow(/PATCH83U_STAGING_FRONTEND_UNKNOWN_PROJECT_REFUSED/);
  });

  it('rejects malformed and missing Supabase URLs', () => {
    expect(() => extractStagingProjectRef('not-a-url'))
      .toThrow(/PATCH83U_STAGING_FRONTEND_URL_INVALID/);
    expect(() => extractStagingProjectRef(''))
      .toThrow(/PATCH83U_STAGING_FRONTEND_URL_REQUIRED/);
    expect(() => validateStagingFrontendConfig({
      VITE_SUPABASE_ANON_KEY: publicBrowserKey,
    })).toThrow(/PATCH83U_STAGING_FRONTEND_URL_REQUIRED/);
  });

  it('recursively rejects a production ref hidden in another browser configuration value', () => {
    expect(() => validateStagingFrontendConfig({
      ...validConfig(),
      VITE_DIAGNOSTIC_LABEL: {
        nested: `forbidden-${PATCH83U_PRODUCTION_PROJECT_REF}`,
      },
    })).toThrow(/PATCH83U_STAGING_FRONTEND_PRODUCTION_REF_REFUSED/);
  });

  it('uses only staging-file VITE values and never inherits default production VITE config', () => {
    const plan = createStagingLaunchPlan(validConfig(), {
      PATH: 'safe-path',
      VITE_SUPABASE_URL: `https://${PATCH83U_PRODUCTION_PROJECT_REF}.supabase.co`,
      VITE_SUPABASE_ANON_KEY: 'production-public-key-must-not-survive',
      VITE_UNRELATED_DEFAULT: PATCH83U_PRODUCTION_PROJECT_REF,
    });
    const child = plan.childEnvironment();
    expect(child.VITE_SUPABASE_URL).toBe(stagingUrl);
    expect(child.VITE_SUPABASE_ANON_KEY).toBe(publicBrowserKey);
    expect(child.VITE_UNRELATED_DEFAULT).toBeUndefined();
    expect(JSON.stringify(child)).not.toContain(PATCH83U_PRODUCTION_PROJECT_REF);
  });

  it('serializes and logs only a safe launch summary', async () => {
    const plan = await prepareStagingFrontendLaunch({
      readEnvironmentFile: async () => [
        `VITE_SUPABASE_URL=${stagingUrl}`,
        `VITE_SUPABASE_ANON_KEY=${publicBrowserKey}`,
      ].join('\n'),
      parentEnv: {},
    });
    const serialized = JSON.stringify(plan);
    expect(serialized).toContain(PATCH83U_STAGING_PROJECT_REF);
    expect(serialized).toContain(PATCH83U_STAGING_ORIGIN);
    expect(serialized).not.toContain(publicBrowserKey);
    expect(serialized).not.toMatch(/authorization|cookie|token/i);
  });

  it('keeps dev:staging isolated and performs no hosted request in tests', () => {
    const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
    const viteConfig = readFileSync(resolve('vite.config.ts'), 'utf8');
    expect(packageJson.scripts.dev).toBe('vite');
    expect(packageJson.scripts['dev:staging'])
      .toBe('node scripts/start-patch83u-staging-frontend.mjs');
    expect(viteConfig).toContain("envDir: stagingMode ? false : undefined");
    expect(viteConfig).toContain('PATCH83U_STAGING_FRONTEND_VERIFIED');
    expect(viteConfig).not.toContain('fetch(');
  });

  it('parses the intended staging env format without expansion or fallback', () => {
    expect(parseStagingEnv([
      '# local staging browser config',
      `VITE_SUPABASE_URL="${stagingUrl}"`,
      `VITE_SUPABASE_ANON_KEY='${publicBrowserKey}'`,
    ].join('\n'))).toEqual({
      VITE_SUPABASE_URL: stagingUrl,
      VITE_SUPABASE_ANON_KEY: publicBrowserKey,
    });
  });
});
