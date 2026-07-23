#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PATCH83U_STAGING_PROJECT_REF = 'zghsgzrdwbqdrpuxanac';
export const PATCH83U_PRODUCTION_PROJECT_REF = 'zbrjjecpsrzposhuarcn';
export const PATCH83U_STAGING_ORIGIN = 'http://localhost:5173';
export const PATCH83U_STAGING_MODE = 'staging';
export const PATCH83U_STAGING_ENV_FILE = '.env.staging.local';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(ROOT, PATCH83U_STAGING_ENV_FILE);
const VITE_BIN = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const FORBIDDEN_BROWSER_KEY_NAME = /(?:service[_-]?role|secret|password|private[_-]?key|database[_-]?url)/i;

function walk(value, visitor, location = '$') {
  visitor(value, location);
  if (Array.isArray(value)) {
    value.forEach((child, index) => walk(child, visitor, `${location}[${index}]`));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      visitor(key, `${location}.${key}`, true);
      walk(child, visitor, `${location}.${key}`);
    });
  }
}

export function assertNoProductionReference(value) {
  walk(value, (candidate, location, isKey) => {
    if (!isKey && typeof candidate === 'string' && candidate.includes(PATCH83U_PRODUCTION_PROJECT_REF)) {
      throw new Error(`PATCH83U_STAGING_FRONTEND_PRODUCTION_REF_REFUSED:${location}`);
    }
  });
  return true;
}

export function parseStagingEnv(text) {
  if (typeof text !== 'string') throw new Error('PATCH83U_STAGING_ENV_INVALID');
  const result = {};
  for (const [index, sourceLine] of text.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = sourceLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) throw new Error(`PATCH83U_STAGING_ENV_LINE_INVALID:${index + 1}`);
    const [, key, rawValue] = match;
    if (Object.hasOwn(result, key)) {
      throw new Error(`PATCH83U_STAGING_ENV_DUPLICATE_KEY:${key}`);
    }
    let value = rawValue.trim();
    if (
      value.length >= 2
      && ((value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function extractStagingProjectRef(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error('PATCH83U_STAGING_FRONTEND_URL_REQUIRED');
  }
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('PATCH83U_STAGING_FRONTEND_URL_INVALID');
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || parsed.port
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash
  ) {
    throw new Error('PATCH83U_STAGING_FRONTEND_URL_INVALID');
  }
  const match = parsed.hostname.match(/^([a-z0-9]+)\.supabase\.co$/);
  if (!match) throw new Error('PATCH83U_STAGING_FRONTEND_URL_INVALID');
  if (match[1] === PATCH83U_PRODUCTION_PROJECT_REF) {
    throw new Error('PATCH83U_STAGING_FRONTEND_PRODUCTION_REF_REFUSED');
  }
  if (match[1] !== PATCH83U_STAGING_PROJECT_REF) {
    throw new Error('PATCH83U_STAGING_FRONTEND_UNKNOWN_PROJECT_REFUSED');
  }
  return match[1];
}

function assertPublicBrowserKey(key) {
  if (typeof key !== 'string' || !key.trim()) {
    throw new Error('PATCH83U_STAGING_PUBLIC_BROWSER_KEY_REQUIRED');
  }
  if (/^sb_secret_/i.test(key)) {
    throw new Error('PATCH83U_STAGING_SECRET_KEY_REFUSED');
  }
  const jwtParts = key.split('.');
  if (jwtParts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(jwtParts[1], 'base64url').toString('utf8'));
      if (payload?.role === 'service_role') {
        throw new Error('PATCH83U_STAGING_SERVICE_ROLE_KEY_REFUSED');
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'PATCH83U_STAGING_SERVICE_ROLE_KEY_REFUSED') {
        throw error;
      }
      // A non-JWT publishable key is valid; malformed JWT-shaped input is
      // rejected below by the minimum public-key shape requirement.
    }
  }
  if (key.trim().length < 20) {
    throw new Error('PATCH83U_STAGING_PUBLIC_BROWSER_KEY_INVALID');
  }
}

export function validateStagingFrontendConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('PATCH83U_STAGING_ENV_INVALID');
  }
  assertNoProductionReference(config);
  for (const [key, value] of Object.entries(config)) {
    if (value && !key.startsWith('VITE_')) {
      throw new Error(`PATCH83U_STAGING_NON_BROWSER_ENV_REFUSED:${key}`);
    }
    if (value && FORBIDDEN_BROWSER_KEY_NAME.test(key)) {
      throw new Error(`PATCH83U_STAGING_SECRET_ENV_KEY_REFUSED:${key}`);
    }
  }
  const projectRef = extractStagingProjectRef(config.VITE_SUPABASE_URL);
  assertPublicBrowserKey(config.VITE_SUPABASE_ANON_KEY);
  return {
    projectRef,
    publicKeyFingerprint: createHash('sha256')
      .update(config.VITE_SUPABASE_ANON_KEY, 'utf8')
      .digest('hex')
      .slice(0, 12),
  };
}

export class StagingFrontendLaunchPlan {
  #childEnv;

  constructor({ childEnv, projectRef, publicKeyFingerprint }) {
    this.#childEnv = Object.freeze({ ...childEnv });
    this.projectRef = projectRef;
    this.publicKeyFingerprint = publicKeyFingerprint;
    this.origin = PATCH83U_STAGING_ORIGIN;
    this.mode = PATCH83U_STAGING_MODE;
    Object.freeze(this);
  }

  childEnvironment() {
    return { ...this.#childEnv };
  }

  toJSON() {
    return {
      project_ref: this.projectRef,
      origin: this.origin,
      mode: this.mode,
      public_key_present: true,
      public_key_sha256_prefix: this.publicKeyFingerprint,
    };
  }
}

export function createStagingLaunchPlan(config, parentEnv = process.env) {
  const verification = validateStagingFrontendConfig(config);
  const childEnv = {};
  for (const [key, value] of Object.entries(parentEnv)) {
    if (!key.startsWith('VITE_') && key !== 'PATCH83U_STAGING_FRONTEND_VERIFIED') {
      childEnv[key] = value;
    }
  }
  for (const [key, value] of Object.entries(config)) {
    if (key.startsWith('VITE_') && value) childEnv[key] = value;
  }
  childEnv.PATCH83U_STAGING_FRONTEND_VERIFIED = PATCH83U_STAGING_PROJECT_REF;
  assertNoProductionReference(
    Object.fromEntries(Object.entries(childEnv).filter(([key]) => key.startsWith('VITE_'))),
  );
  return new StagingFrontendLaunchPlan({
    childEnv,
    projectRef: verification.projectRef,
    publicKeyFingerprint: verification.publicKeyFingerprint,
  });
}

export async function prepareStagingFrontendLaunch({
  readEnvironmentFile = readFile,
  parentEnv = process.env,
} = {}) {
  let text;
  try {
    text = await readEnvironmentFile(ENV_PATH, 'utf8');
  } catch {
    throw new Error(`PATCH83U_STAGING_ENV_FILE_REQUIRED:${PATCH83U_STAGING_ENV_FILE}`);
  }
  return createStagingLaunchPlan(parseStagingEnv(text), parentEnv);
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length) throw new Error('PATCH83U_STAGING_FRONTEND_ARGUMENTS_REFUSED');
  const plan = await prepareStagingFrontendLaunch();
  process.stdout.write(`Verified staging Supabase project: ${plan.projectRef}\n`);
  const child = spawn(
    process.execPath,
    [VITE_BIN, '--mode', PATCH83U_STAGING_MODE, '--host', 'localhost', '--port', '5173', '--strictPort'],
    {
      cwd: ROOT,
      env: plan.childEnvironment(),
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
    },
  );
  child.once('error', (error) => {
    process.stderr.write(`PATCH83U_STAGING_FRONTEND_START_FAILED:${error.code ?? 'UNKNOWN'}\n`);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
}

const isEntrypoint = process.argv[1]
  && fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase();
if (isEntrypoint) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'PATCH83U_STAGING_FRONTEND_FAILED'}\n`);
    process.exitCode = 1;
  });
}
