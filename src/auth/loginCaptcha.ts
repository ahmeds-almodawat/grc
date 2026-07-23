export const LOGIN_CAPTCHA_PROVIDER = 'turnstile' as const;

export interface LoginCaptchaConfigInput {
  requiredFlag?: string;
  siteKey?: string;
}

export interface LoginCaptchaConfig {
  provider: typeof LOGIN_CAPTCHA_PROVIDER;
  required: boolean;
  siteKey: string | null;
  configurationError: string | null;
}

const REQUIRED_FLAG_ERROR =
  'Login CAPTCHA configuration is invalid. VITE_AUTH_CAPTCHA_REQUIRED must be exactly true or false.';
const SITE_KEY_ERROR =
  'Login CAPTCHA is required, but its public site key is unavailable. Sign-in is blocked.';
const TOKEN_ERROR = 'Complete the CAPTCHA challenge before signing in.';

/**
 * Resolve the public browser configuration without accepting any provider secret.
 * The required flag has identical behavior for Employee-ID and full-email login.
 */
export function resolveLoginCaptchaConfig(input: LoginCaptchaConfigInput): LoginCaptchaConfig {
  const rawRequired = input.requiredFlag;
  const siteKey = input.siteKey?.trim() || null;

  if (rawRequired !== undefined && rawRequired !== '' && rawRequired !== 'true' && rawRequired !== 'false') {
    return {
      provider: LOGIN_CAPTCHA_PROVIDER,
      required: true,
      siteKey,
      configurationError: REQUIRED_FLAG_ERROR,
    };
  }

  const required = rawRequired === 'true';
  return {
    provider: LOGIN_CAPTCHA_PROVIDER,
    required,
    siteKey,
    configurationError: required && !siteKey ? SITE_KEY_ERROR : null,
  };
}

export function normalizeLoginCaptchaToken(token?: string | null): string | null {
  return token?.trim() || null;
}

export function getLoginCaptchaSubmissionError(
  config: LoginCaptchaConfig,
  token?: string | null,
): string | null {
  if (config.configurationError) return config.configurationError;
  if (config.required && !normalizeLoginCaptchaToken(token)) return TOKEN_ERROR;
  return null;
}

// Hosted Auth CAPTCHA applies to every password authentication, including the
// forced current-password reauthentication performed by Patch 83U.
export const getAuthCaptchaSubmissionError = getLoginCaptchaSubmissionError;
export const normalizeAuthCaptchaToken = normalizeLoginCaptchaToken;

export const loginCaptchaConfig = resolveLoginCaptchaConfig({
  requiredFlag: import.meta.env.VITE_AUTH_CAPTCHA_REQUIRED,
  siteKey: import.meta.env.VITE_AUTH_CAPTCHA_SITE_KEY,
});

export const authCaptchaConfig = loginCaptchaConfig;
