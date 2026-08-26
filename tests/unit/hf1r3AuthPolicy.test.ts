import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  passwordPolicyError,
  passwordRequirementState,
} from '../../src/auth/passwordPolicy';

const root = process.cwd();
const source = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('HF-1-R3 canonical authentication policy', () => {
  it.each(['office123', 'hospital8', 'modawat99', 'test2026a'])(
    'accepts approved password example %s',
    (password) => {
      expect(passwordRequirementState(password).valid).toBe(true);
      expect(passwordPolicyError(password)).toBeNull();
    },
  );

  it.each([
    ['abcdefgh', 'Password must contain at least one number.'],
    ['12345678', 'Password must contain at least one letter.'],
    ['abc123', 'Password must be at least 8 characters.'],
  ])('rejects %s with the exact failed rule', (password, message) => {
    expect(passwordRequirementState(password).valid).toBe(false);
    expect(passwordPolicyError(password)).toBe(message);
  });

  it('requires neither uppercase nor symbols and adds no identifier or leaked-password check', () => {
    const validator = source('src/auth/passwordPolicy.ts');
    const edge = source('supabase/functions/privileged-action/index.ts');

    expect(passwordRequirementState('employee99').valid).toBe(true);
    expect(passwordRequirementState('username8').valid).toBe(true);
    expect(validator).not.toMatch(/uppercase|symbol|dictionary|leaked|employee.?id|local.?part/i);
    expect(edge).not.toContain('PATCH83U_PERMANENT_PASSWORD_MANAGED_IDENTITY_REUSE_DENIED');
    expect(edge).not.toContain('normalizedNewPassword');
    expect(edge).not.toContain('authEmailLocalPart');
  });

  it('removes the retired challenge from active login, forced-change, and Edge runtime paths', () => {
    const runtime = [
      source('src/pages/LoginPage.tsx'),
      source('src/pages/ForcedPasswordChange.tsx'),
      source('src/auth/AuthProvider.tsx'),
      source('src/lib/userCredentialApi.ts'),
      source('supabase/functions/privileged-action/index.ts'),
    ].join('\n');

    expect(runtime).not.toMatch(/Turnstile|CAPTCHA|captchaToken|captcha_token|loginCaptcha/i);
    expect(source('src/pages/LoginPage.tsx')).toContain(
      'auth.signIn(normalizeLoginIdentifier(loginIdentifier), password)',
    );
    expect(source('src/auth/AuthProvider.tsx')).toMatch(
      /signInWithPassword\(\{\s*email,\s*password,\s*\}\)/,
    );
    expect(source('src/pages/ForcedPasswordChange.tsx')).toContain('PasswordRequirements');
  });

  it('records the canonical hosted policy without retaining secret configuration', async () => {
    const {
      buildAuthSettingsEvidence,
      PASSWORD_REQUIRED_CHARACTERS_LETTERS_DIGITS,
    } = await import('../../scripts/patch83u-auth-settings-preflight.mjs');
    const evidence = buildAuthSettingsEvidence({
      security_captcha_enabled: false,
      security_captcha_provider: 'turnstile',
      security_captcha_secret: 'must-never-be-recorded',
      rate_limit_anonymous_users: 30,
      rate_limit_email_sent: 4,
      rate_limit_sms_sent: 5,
      rate_limit_token_refresh: 150,
      rate_limit_verify: 30,
      rate_limit_otp: 30,
      rate_limit_web3: 30,
      password_min_length: 8,
      password_required_characters: PASSWORD_REQUIRED_CHARACTERS_LETTERS_DIGITS,
      password_hibp_enabled: false,
      jwt_exp: 3600,
      sessions_timebox: 28_800,
      sessions_inactivity_timeout: 1800,
      sessions_single_per_user: true,
    }, 'zyxwvutsrqponmlkjihg', new Date('2026-08-27T00:00:00.000Z'));

    expect(evidence.settings.captcha.enabled.value).toBe(false);
    expect(evidence.settings.password_policy.minimum_length.value).toBe(8);
    expect(evidence.settings.password_policy.required_characters.value)
      .toBe(PASSWORD_REQUIRED_CHARACTERS_LETTERS_DIGITS);
    expect(evidence.settings.password_policy.leaked_password_protection_enabled.value).toBe(false);
    expect(evidence.policy_compliance.compliant).toBe(true);
    expect(JSON.stringify(evidence)).not.toContain('must-never-be-recorded');
  });
});
