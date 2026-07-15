import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getLoginCaptchaSubmissionError,
  normalizeLoginCaptchaToken,
  resolveLoginCaptchaConfig,
} from '../../src/auth/loginCaptcha';

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Patch 83U login CAPTCHA release gate', () => {
  it('requires an exact feature flag and fails closed on invalid configuration', () => {
    expect(resolveLoginCaptchaConfig({ requiredFlag: 'true', siteKey: 'public-site-key' })).toMatchObject({
      required: true,
      siteKey: 'public-site-key',
      configurationError: null,
    });
    expect(resolveLoginCaptchaConfig({ requiredFlag: 'TRUE', siteKey: 'public-site-key' }))
      .toMatchObject({ required: true });
    expect(resolveLoginCaptchaConfig({ requiredFlag: 'TRUE', siteKey: 'public-site-key' }).configurationError)
      .toMatch(/must be exactly true or false/i);
    expect(resolveLoginCaptchaConfig({ requiredFlag: 'true' }).configurationError)
      .toMatch(/public site key is unavailable/i);
  });

  it('keeps local development controlled by the same explicit flag', () => {
    const localDefault = resolveLoginCaptchaConfig({});
    const localRequired = resolveLoginCaptchaConfig({ requiredFlag: 'true', siteKey: 'local-public-site-key' });
    const explicitlyDisabled = resolveLoginCaptchaConfig({ requiredFlag: 'false', siteKey: 'unused-site-key' });

    expect(localDefault).toMatchObject({ required: false, configurationError: null });
    expect(localRequired).toMatchObject({ required: true, configurationError: null });
    expect(explicitlyDisabled).toMatchObject({ required: false, configurationError: null });
  });

  it('blocks missing tokens and accepts a trimmed token whenever CAPTCHA is required', () => {
    const required = resolveLoginCaptchaConfig({ requiredFlag: 'true', siteKey: 'public-site-key' });

    expect(getLoginCaptchaSubmissionError(required, null)).toMatch(/complete the captcha/i);
    expect(getLoginCaptchaSubmissionError(required, '   ')).toMatch(/complete the captcha/i);
    expect(getLoginCaptchaSubmissionError(required, '  accepted-token  ')).toBeNull();
    expect(normalizeLoginCaptchaToken('  accepted-token  ')).toBe('accepted-token');
  });

  it('passes the token through the installed Supabase password-sign-in API with no identifier bypass', () => {
    const provider = source('src/auth/AuthProvider.tsx');
    const login = source('src/pages/LoginPage.tsx');
    const sdk = source('node_modules/@supabase/auth-js/src/lib/types.ts');

    expect(sdk).toMatch(/SignInWithPasswordCredentials[\s\S]*captchaToken\?: string/);
    expect(provider).toContain('options: { captchaToken: normalizedCaptchaToken }');
    expect(provider.indexOf('getLoginCaptchaSubmissionError')).toBeLessThan(provider.indexOf('signInWithPassword'));
    expect(login).toContain('auth.signIn(normalizeLoginIdentifier(loginIdentifier), password, captchaToken)');
    expect(provider).not.toMatch(/captcha[\s\S]{0,200}(employee|identifier|@almodawat\.sa)/i);
  });

  it('contains only a public CAPTCHA site key in frontend configuration', () => {
    const captcha = source('src/auth/loginCaptcha.ts');
    const widget = source('src/auth/TurnstileLoginCaptcha.tsx');
    const provider = source('src/auth/AuthProvider.tsx');
    const login = source('src/pages/LoginPage.tsx');
    const frontend = `${captcha}\n${widget}\n${provider}\n${login}`;

    expect(frontend).toContain('VITE_AUTH_CAPTCHA_SITE_KEY');
    expect(frontend).not.toMatch(/VITE_[A-Z0-9_]*(SECRET|PRIVATE|ACCESS_TOKEN)/);
    expect(frontend).not.toMatch(/siteverify|CLOUDFLARE_SECRET|HCAPTCHA_SECRET/);
  });

  it('sanitizes the read-only Management API response to only requested evidence', async () => {
    const { buildAuthSettingsEvidence } = await import('../../scripts/patch83u-auth-settings-preflight.mjs');
    const evidence = buildAuthSettingsEvidence({
      security_captcha_enabled: true,
      security_captcha_provider: 'turnstile',
      security_captcha_secret: 'must-never-be-recorded',
      smtp_pass: 'must-never-be-recorded-either',
      site_url: 'https://internal.example.test',
      rate_limit_anonymous_users: 30,
      rate_limit_email_sent: 4,
      rate_limit_sms_sent: 5,
      rate_limit_token_refresh: 150,
      rate_limit_verify: 30,
      rate_limit_otp: 30,
      rate_limit_web3: 30,
      rate_limit_future_endpoint: 12,
      rate_limit_future_secret: 'must-never-be-recorded-rate-secret',
      password_min_length: 5,
      password_required_characters: 'abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789',
      password_hibp_enabled: true,
      jwt_exp: 3600,
      sessions_timebox: 28_800,
      sessions_inactivity_timeout: 1800,
      sessions_single_per_user: true,
    }, 'zyxwvutsrqponmlkjihg', new Date('2026-07-15T00:00:00.000Z'));

    expect(evidence.settings.captcha.enabled).toEqual({ observed: true, value: true });
    expect(evidence.settings.auth_endpoint_rate_limits.rate_limit_future_endpoint)
      .toEqual({ observed: true, value: 12 });
    expect(evidence.settings.auth_endpoint_rate_limits.rate_limit_future_secret)
      .toEqual({ observed: true, value: null });
    expect(evidence.settings.password_policy.leaked_password_protection_enabled.value).toBe(true);
    expect(evidence.settings.jwt.expiry_seconds.value).toBe(3600);
    expect(evidence.settings.sessions.single_session_per_user.value).toBe(true);
    expect(evidence.completeness.all_requested_fields_observed).toBe(true);

    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toContain('must-never-be-recorded');
    expect(serialized).not.toContain('internal.example.test');
    expect(serialized).not.toContain('zyxwvutsrqponmlkjihg');
    expect(serialized).not.toContain('security_captcha_secret');
    expect(serialized).not.toContain('smtp_pass');
  });

  it('pins the hosted preflight to one read-only GET and reports missing evidence fields', async () => {
    const script = source('scripts/patch83u-auth-settings-preflight.mjs');
    const { AUTH_CONFIG_HTTP_METHOD, AUTH_CONFIG_ENDPOINT_TEMPLATE, buildAuthSettingsEvidence } =
      await import('../../scripts/patch83u-auth-settings-preflight.mjs');
    const evidence = buildAuthSettingsEvidence({}, 'abcdefghijklmnopqrst');

    expect(AUTH_CONFIG_HTTP_METHOD).toBe('GET');
    expect(AUTH_CONFIG_ENDPOINT_TEMPLATE).toBe(
      'https://api.supabase.com/v1/projects/{project-ref}/config/auth',
    );
    expect(script).not.toMatch(/method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/);
    expect(script).not.toMatch(/security_captcha_secret[\s\S]{0,100}evidenceValue/);
    expect(evidence.completeness.all_requested_fields_observed).toBe(false);
    expect(evidence.completeness.missing_fields).toContain('security_captcha_enabled');
    expect(evidence.completeness.missing_fields).toContain('sessions_single_per_user');
  });
});
