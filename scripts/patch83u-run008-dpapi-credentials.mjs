import { execFile } from 'node:child_process';
import {
  lstat,
  readdir,
  readFile,
  realpath,
  rm,
} from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import {
  parseStagingEnv,
  validateStagingFrontendConfig,
} from './start-patch83u-staging-frontend.mjs';

const execFileAsync = promisify(execFile);

export const RUN008_DPAPI_DIRECTORY_NAME = 'GRC-Run008-Secrets';
export const RUN008_DPAPI_ENTROPY_PREFIX = 'GRC-Run008-v1:';
export const RUN008_CREDENTIAL_FILES = Object.freeze({
  superAdminPassword: 'superadmin-password.dpapi',
  employeeCurrentPassword: 'employee-current-password.dpapi',
  employeeTemporaryPassword: 'employee-temporary-password.dpapi',
  employeeNewPassword: 'employee-new-password.dpapi',
});

const EXPECTED_FILE_NAMES = Object.freeze(Object.values(RUN008_CREDENTIAL_FILES));
const EXPECTED_FILE_SET = new Set(EXPECTED_FILE_NAMES);

function pathWithin(directory, candidate) {
  const value = relative(directory, candidate);
  return value === '' || (!value.startsWith(`..${sep}`) && value !== '..');
}

function safeCredentialError(code) {
  return new Error(code);
}

export function run008CredentialFileStatIsAllowed(stat) {
  return Boolean(
    stat
    && typeof stat.isFile === 'function'
    && typeof stat.isSymbolicLink === 'function'
    && stat.isFile()
    && !stat.isSymbolicLink()
  );
}

export function defaultRun008CredentialDirectory(environment = process.env) {
  const localAppData = environment.LOCALAPPDATA;
  if (typeof localAppData !== 'string' || !localAppData.trim()) {
    throw safeCredentialError('PATCH83U_RUN008_LOCALAPPDATA_REQUIRED');
  }
  return resolve(localAppData, RUN008_DPAPI_DIRECTORY_NAME);
}

export async function validateRun008CredentialDirectory(
  credentialDirectory,
  { environment = process.env } = {},
) {
  const expectedDirectory = defaultRun008CredentialDirectory(environment);
  const candidate = resolve(credentialDirectory ?? expectedDirectory);
  if (candidate.toLowerCase() !== expectedDirectory.toLowerCase()) {
    throw safeCredentialError('PATCH83U_RUN008_CREDENTIAL_DIRECTORY_REFUSED');
  }
  const directoryStat = await lstat(candidate).catch(() => null);
  if (!directoryStat?.isDirectory() || directoryStat.isSymbolicLink()) {
    throw safeCredentialError('PATCH83U_RUN008_CREDENTIAL_DIRECTORY_REFUSED');
  }
  const directoryRealPath = await realpath(candidate);
  if (directoryRealPath.toLowerCase() !== candidate.toLowerCase()) {
    throw safeCredentialError('PATCH83U_RUN008_CREDENTIAL_DIRECTORY_REFUSED');
  }
  const entries = await readdir(directoryRealPath, { withFileTypes: true });
  const names = entries.map((entry) => entry.name);
  if (
    names.length !== EXPECTED_FILE_NAMES.length
    || new Set(names).size !== names.length
    || names.some((name) => !EXPECTED_FILE_SET.has(name))
    || EXPECTED_FILE_NAMES.some((name) => !names.includes(name))
  ) {
    throw safeCredentialError('PATCH83U_RUN008_CREDENTIAL_FILE_SET_INVALID');
  }
  const paths = {};
  for (const [purpose, fileName] of Object.entries(RUN008_CREDENTIAL_FILES)) {
    if (fileName.includes('/') || fileName.includes('\\')) {
      throw safeCredentialError('PATCH83U_RUN008_CREDENTIAL_PATH_REFUSED');
    }
    const path = join(directoryRealPath, fileName);
    if (!pathWithin(directoryRealPath, path)) {
      throw safeCredentialError('PATCH83U_RUN008_CREDENTIAL_PATH_REFUSED');
    }
    const stat = await lstat(path);
    if (!run008CredentialFileStatIsAllowed(stat)) {
      throw safeCredentialError('PATCH83U_RUN008_CREDENTIAL_FILE_REFUSED');
    }
    const fileRealPath = await realpath(path);
    if (!pathWithin(directoryRealPath, fileRealPath)) {
      throw safeCredentialError('PATCH83U_RUN008_CREDENTIAL_PATH_REFUSED');
    }
    paths[purpose] = fileRealPath;
  }
  return Object.freeze({ directoryRealPath, paths: Object.freeze(paths) });
}

const DPAPI_SCRIPT = String.raw`& {
param([string]$inputPath, [string]$fileName)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
if ([string]::IsNullOrWhiteSpace($inputPath) -or [string]::IsNullOrWhiteSpace($fileName)) { throw 'input' }
$cipher = [IO.File]::ReadAllBytes($inputPath)
$entropy = [Text.Encoding]::UTF8.GetBytes('GRC-Run008-v1:' + $fileName)
$plain = $null
try {
  $plain = [Security.Cryptography.ProtectedData]::Unprotect(
    $cipher,
    $entropy,
    [Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  if ($plain.Length -eq 0) { throw 'empty' }
  $stdout = [Console]::OpenStandardOutput()
  $stdout.Write($plain, 0, $plain.Length)
  $stdout.Flush()
} finally {
  if ($plain) { [Array]::Clear($plain, 0, $plain.Length) }
  if ($entropy) { [Array]::Clear($entropy, 0, $entropy.Length) }
  if ($cipher) { [Array]::Clear($cipher, 0, $cipher.Length) }
}
} `;

export async function decryptRun008DpapiFile(
  path,
  fileName,
  { execFileImpl = execFileAsync } = {},
) {
  if (!EXPECTED_FILE_SET.has(fileName)) {
    throw safeCredentialError('PATCH83U_RUN008_CREDENTIAL_NAME_REFUSED');
  }
  let result;
  try {
    result = await execFileImpl(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        DPAPI_SCRIPT,
        path,
        fileName,
      ],
      {
        encoding: 'buffer',
        windowsHide: true,
        maxBuffer: 64 * 1024,
      },
    );
  } catch {
    throw safeCredentialError('PATCH83U_RUN008_DPAPI_DECRYPTION_FAILED');
  }
  const plaintext = Buffer.from(result.stdout ?? []);
  if (plaintext.length === 0) {
    plaintext.fill(0);
    throw safeCredentialError('PATCH83U_RUN008_EMPTY_DECRYPTED_VALUE_REFUSED');
  }
  return plaintext;
}

export async function loadRun008CredentialBundle({
  credentialDirectory,
  environment,
  decryptFile = decryptRun008DpapiFile,
  secretFactory,
} = {}) {
  if (typeof secretFactory !== 'function') {
    throw safeCredentialError('PATCH83U_RUN008_SECRET_FACTORY_REQUIRED');
  }
  const validated = await validateRun008CredentialDirectory(
    credentialDirectory,
    { environment },
  );
  const credentials = {};
  try {
    for (const [purpose, fileName] of Object.entries(RUN008_CREDENTIAL_FILES)) {
      const plaintext = await decryptFile(validated.paths[purpose], fileName);
      try {
        if (!Buffer.isBuffer(plaintext) || plaintext.length === 0) {
          throw safeCredentialError('PATCH83U_RUN008_EMPTY_DECRYPTED_VALUE_REFUSED');
        }
        credentials[purpose] = secretFactory(plaintext, purpose);
      } finally {
        plaintext?.fill?.(0);
      }
    }
    const values = Object.values(credentials);
    if (values.some((value) => !value || typeof value.equals !== 'function')) {
      throw safeCredentialError('PATCH83U_RUN008_SECRET_BINDING_FAILED');
    }
    if (
      credentials.employeeCurrentPassword.equals(credentials.employeeTemporaryPassword)
      || credentials.employeeTemporaryPassword.equals(credentials.employeeNewPassword)
      || credentials.employeeCurrentPassword.equals(credentials.employeeNewPassword)
    ) {
      throw safeCredentialError('PATCH83U_RUN008_PASSWORD_EQUALITY_REFUSED');
    }
    return Object.freeze({
      ...credentials,
      directoryRealPath: validated.directoryRealPath,
      validated: true,
    });
  } catch (error) {
    Object.values(credentials).forEach((value) => value?.clear?.());
    throw error;
  }
}

export function clearRun008CredentialBundle(bundle) {
  for (const purpose of Object.keys(RUN008_CREDENTIAL_FILES)) {
    bundle?.[purpose]?.clear?.();
  }
}

export async function deleteRun008EncryptedCredentialFiles(bundle) {
  const validated = await validateRun008CredentialDirectory(bundle?.directoryRealPath);
  for (const purpose of Object.keys(RUN008_CREDENTIAL_FILES)) {
    await rm(validated.paths[purpose]);
  }
  return true;
}

export async function loadRun008BrowserConfiguration({
  environmentPath = resolve(process.cwd(), '.env.staging.local'),
  readEnvironment = readFile,
  secretFactory,
} = {}) {
  if (typeof secretFactory !== 'function') {
    throw safeCredentialError('PATCH83U_RUN008_SECRET_FACTORY_REQUIRED');
  }
  const parsed = parseStagingEnv(await readEnvironment(environmentPath, 'utf8'));
  const selected = {
    VITE_SUPABASE_URL: parsed.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: parsed.VITE_SUPABASE_ANON_KEY,
  };
  const validation = validateStagingFrontendConfig(selected);
  const publicApiKey = secretFactory(Buffer.from(selected.VITE_SUPABASE_ANON_KEY, 'utf8'));
  return Object.freeze({
    projectRef: validation.projectRef,
    supabaseUrl: selected.VITE_SUPABASE_URL,
    publicApiKey,
  });
}
