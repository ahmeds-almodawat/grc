import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const AUTH_CONFIG_HTTP_METHOD = 'GET';
export const AUTH_CONFIG_ENDPOINT_TEMPLATE = 'https://api.supabase.com/v1/projects/{project-ref}/config/auth';

const KNOWN_RATE_LIMIT_FIELDS = [
  'rate_limit_anonymous_users',
  'rate_limit_email_sent',
  'rate_limit_sms_sent',
  'rate_limit_token_refresh',
  'rate_limit_verify',
  'rate_limit_otp',
  'rate_limit_web3',
];

const REQUESTED_FIELDS = [
  'security_captcha_enabled',
  'security_captcha_provider',
  'password_min_length',
  'password_required_characters',
  'password_hibp_enabled',
  'jwt_exp',
  'sessions_timebox',
  'sessions_inactivity_timeout',
  'sessions_single_per_user',
  ...KNOWN_RATE_LIMIT_FIELDS,
];

function evidenceValue(config, field) {
  const observed = Object.prototype.hasOwnProperty.call(config, field);
  const value = observed && ['string', 'number', 'boolean'].includes(typeof config[field])
    ? config[field]
    : null;
  return { observed, value };
}

function numericEvidenceValue(config, field) {
  const observed = Object.prototype.hasOwnProperty.call(config, field);
  const value = observed && typeof config[field] === 'number' && Number.isFinite(config[field])
    ? config[field]
    : null;
  return { observed, value };
}

function collectRateLimits(config) {
  const fields = new Set([
    ...KNOWN_RATE_LIMIT_FIELDS,
    ...Object.keys(config).filter((field) => /^rate_limit_[a-z0-9_]+$/.test(field)),
  ]);

  return Object.fromEntries(
    [...fields]
      .sort()
      .map((field) => [field, numericEvidenceValue(config, field)]),
  );
}

export function buildAuthSettingsEvidence(config, projectRef, generatedAt = new Date()) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Supabase returned an invalid Auth configuration payload.');
  }

  const missingFields = REQUESTED_FIELDS.filter(
    (field) => !Object.prototype.hasOwnProperty.call(config, field),
  );

  return {
    schema_version: 'patch83u-auth-settings-evidence-v1',
    generated_at: generatedAt.toISOString(),
    source: {
      kind: 'supabase_management_api_read_only',
      http_method: AUTH_CONFIG_HTTP_METHOD,
      endpoint: AUTH_CONFIG_ENDPOINT_TEMPLATE,
      project_ref_sha256: createHash('sha256').update(projectRef).digest('hex'),
      raw_response_retained: false,
      credentials_retained: false,
    },
    settings: {
      captcha: {
        enabled: evidenceValue(config, 'security_captcha_enabled'),
        provider: evidenceValue(config, 'security_captcha_provider'),
      },
      auth_endpoint_rate_limits: collectRateLimits(config),
      password_policy: {
        minimum_length: evidenceValue(config, 'password_min_length'),
        required_characters: evidenceValue(config, 'password_required_characters'),
        leaked_password_protection_enabled: evidenceValue(config, 'password_hibp_enabled'),
      },
      jwt: {
        expiry_seconds: evidenceValue(config, 'jwt_exp'),
      },
      sessions: {
        lifetime_seconds: evidenceValue(config, 'sessions_timebox'),
        inactivity_timeout_seconds: evidenceValue(config, 'sessions_inactivity_timeout'),
        single_session_per_user: evidenceValue(config, 'sessions_single_per_user'),
      },
    },
    completeness: {
      all_requested_fields_observed: missingFields.length === 0,
      missing_fields: missingFields,
    },
  };
}

function parseArguments(argv) {
  const result = { projectRef: process.env.SUPABASE_PROJECT_REF ?? '', outputPath: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--project-ref') {
      result.projectRef = argv[index + 1] ?? '';
      index += 1;
    } else if (argument === '--out') {
      result.outputPath = argv[index + 1] ?? '';
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return result;
}

export async function captureAuthSettingsEvidence({
  projectRef,
  accessToken,
  outputPath = '',
  fetchImpl = fetch,
}) {
  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new Error('A valid 20-character SUPABASE_PROJECT_REF is required.');
  }
  if (!accessToken) {
    throw new Error('SUPABASE_ACCESS_TOKEN is required and must be supplied only through the process environment.');
  }

  const endpoint = AUTH_CONFIG_ENDPOINT_TEMPLATE.replace('{project-ref}', encodeURIComponent(projectRef));
  const response = await fetchImpl(endpoint, {
    method: AUTH_CONFIG_HTTP_METHOD,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`Read-only Auth configuration request failed with HTTP ${response.status} ${response.statusText}.`);
  }

  const evidence = buildAuthSettingsEvidence(await response.json(), projectRef);
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;

  if (outputPath) {
    const absoluteOutputPath = path.resolve(outputPath);
    await mkdir(path.dirname(absoluteOutputPath), { recursive: true });
    await writeFile(absoluteOutputPath, serialized, { encoding: 'utf8', flag: 'wx' });
    return { evidence, outputPath: absoluteOutputPath };
  }

  process.stdout.write(serialized);
  return { evidence, outputPath: null };
}

async function main() {
  const { projectRef, outputPath } = parseArguments(process.argv.slice(2));
  await captureAuthSettingsEvidence({
    projectRef,
    accessToken: process.env.SUPABASE_ACCESS_TOKEN ?? '',
    outputPath,
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`Patch 83U Auth-settings preflight failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
