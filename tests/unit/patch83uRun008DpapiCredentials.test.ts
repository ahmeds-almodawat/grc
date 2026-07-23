import {
  mkdtemp,
  mkdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RUN008_CREDENTIAL_FILES,
  clearRun008CredentialBundle,
  loadRun008BrowserConfiguration,
  loadRun008CredentialBundle,
  run008CredentialFileStatIsAllowed,
} from '../../scripts/patch83u-run008-dpapi-credentials.mjs';
import {
  PRODUCTION_PROJECT_REF,
  STAGING_PROJECT_REF,
  browserRequestIsAllowed,
  classifyBrowserRequest,
  sanitizeBrowserRequestDescriptor,
} from '../../scripts/patch83u-staging-multisession-reset-proof.mjs';

class TestSecret {
  #bytes: Buffer | null;

  constructor(bytes: Buffer) {
    this.#bytes = Buffer.from(bytes);
  }

  equals(other: TestSecret) {
    return other instanceof TestSecret
      && this.#bytes !== null
      && other.#bytes !== null
      && this.#bytes.equals(other.#bytes);
  }

  clear() {
    this.#bytes?.fill(0);
    this.#bytes = null;
  }
}

const created: string[] = [];

async function fixture() {
  const localAppData = await mkdtemp(join(tmpdir(), 'patch83u-run008-'));
  created.push(localAppData);
  const directory = join(localAppData, 'GRC-Run008-Secrets');
  await mkdir(directory);
  for (const fileName of Object.values(RUN008_CREDENTIAL_FILES)) {
    await writeFile(join(directory, fileName), Buffer.from([1, 2, 3]));
  }
  return { directory, environment: { LOCALAPPDATA: localAppData } };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function decryptByName(_path: string, fileName: string) {
  return Promise.resolve(Buffer.from(`mock-${fileName}`, 'utf8'));
}

describe('Patch 83U Run 008 named DPAPI credential loading', () => {
  it('binds every filename to its exact purpose even when directory enumeration is reordered', async () => {
    const { directory, environment } = await fixture();
    const seen: Array<[string, string]> = [];
    const bundle = await loadRun008CredentialBundle({
      credentialDirectory: directory,
      environment,
      decryptFile: async (path, fileName) => {
        seen.push([path, fileName]);
        return decryptByName(path, fileName);
      },
      secretFactory: (bytes) => new TestSecret(bytes),
    });
    expect(seen.map((entry) => entry[1])).toEqual(Object.values(RUN008_CREDENTIAL_FILES));
    expect(bundle.validated).toBe(true);
    clearRun008CredentialBundle(bundle);
  });

  it.each([
    'incorrect entropy',
    'wrong Windows user',
  ])('fails closed when DPAPI decryption fails: %s', async () => {
    const { directory, environment } = await fixture();
    await expect(loadRun008CredentialBundle({
      credentialDirectory: directory,
      environment,
      decryptFile: async () => { throw new Error('mock DPAPI refusal'); },
      secretFactory: (bytes) => new TestSecret(bytes),
    })).rejects.toThrow('mock DPAPI refusal');
  });

  it('rejects missing and unexpected duplicate-purpose files', async () => {
    const { directory, environment } = await fixture();
    await rm(join(directory, RUN008_CREDENTIAL_FILES.employeeNewPassword));
    await expect(loadRun008CredentialBundle({
      credentialDirectory: directory,
      environment,
      decryptFile: decryptByName,
      secretFactory: (bytes) => new TestSecret(bytes),
    })).rejects.toThrow(/PATCH83U_RUN008_CREDENTIAL_FILE_SET_INVALID/);
    await writeFile(join(directory, 'renamed-copy.dpapi'), Buffer.from([1]));
    await expect(loadRun008CredentialBundle({
      credentialDirectory: directory,
      environment,
      decryptFile: decryptByName,
      secretFactory: (bytes) => new TestSecret(bytes),
    })).rejects.toThrow(/PATCH83U_RUN008_CREDENTIAL_FILE_SET_INVALID/);
  });

  it('rejects path traversal and symbolic-link credential files', async () => {
    const { directory, environment } = await fixture();
    await expect(loadRun008CredentialBundle({
      credentialDirectory: join(directory, '..'),
      environment,
      decryptFile: decryptByName,
      secretFactory: (bytes) => new TestSecret(bytes),
    })).rejects.toThrow(/PATCH83U_RUN008_CREDENTIAL_DIRECTORY_REFUSED/);
    expect(run008CredentialFileStatIsAllowed({
      isFile: () => true,
      isSymbolicLink: () => true,
    })).toBe(false);
  });

  it('rejects empty plaintext and all prohibited password equalities', async () => {
    const { directory, environment } = await fixture();
    await expect(loadRun008CredentialBundle({
      credentialDirectory: directory,
      environment,
      decryptFile: async () => Buffer.alloc(0),
      secretFactory: (bytes) => new TestSecret(bytes),
    })).rejects.toThrow(/PATCH83U_RUN008_EMPTY_DECRYPTED_VALUE_REFUSED/);
    await expect(loadRun008CredentialBundle({
      credentialDirectory: directory,
      environment,
      decryptFile: async (_path, fileName) => Buffer.from(
        fileName === RUN008_CREDENTIAL_FILES.superAdminPassword ? 'admin' : 'same',
      ),
      secretFactory: (bytes) => new TestSecret(bytes),
    })).rejects.toThrow(/PATCH83U_RUN008_PASSWORD_EQUALITY_REFUSED/);
  });

  it('does not emit or serialize plaintext and performs no hosted call', async () => {
    const { directory, environment } = await fixture();
    const stdout = vi.spyOn(process.stdout, 'write');
    const stderr = vi.spyOn(process.stderr, 'write');
    const hosted = vi.fn();
    const bundle = await loadRun008CredentialBundle({
      credentialDirectory: directory,
      environment,
      decryptFile: decryptByName,
      secretFactory: (bytes) => new TestSecret(bytes),
    });
    expect(JSON.stringify(bundle)).not.toContain('mock-');
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();
    expect(hosted).not.toHaveBeenCalled();
    clearRun008CredentialBundle(bundle);
  });
});

describe('Patch 83U Run 008 browser boundary', () => {
  it('accepts only the staging browser configuration and rejects production or privileged keys', async () => {
    const valid = `VITE_SUPABASE_URL=https://${STAGING_PROJECT_REF}.supabase.co\nVITE_SUPABASE_ANON_KEY=sb_publishable_mock_browser_key_1234567890\n`;
    const loaded = await loadRun008BrowserConfiguration({
      readEnvironment: async () => valid,
      secretFactory: (bytes) => new TestSecret(bytes),
    });
    expect(loaded.projectRef).toBe(STAGING_PROJECT_REF);
    loaded.publicApiKey.clear();
    await expect(loadRun008BrowserConfiguration({
      readEnvironment: async () => valid.replace(STAGING_PROJECT_REF, PRODUCTION_PROJECT_REF),
      secretFactory: (bytes) => new TestSecret(bytes),
    })).rejects.toThrow(/PRODUCTION_REF_REFUSED/);
    await expect(loadRun008BrowserConfiguration({
      readEnvironment: async () => valid.replace(
        'sb_publishable_mock_browser_key_1234567890',
        'sb_secret_mock_privileged_key_1234567890',
      ),
      secretFactory: (bytes) => new TestSecret(bytes),
    })).rejects.toThrow(/SECRET_KEY_REFUSED/);
  });

  it('allows the authenticated staging realtime request but blocks unrelated hosts', () => {
    const realtime = `wss://${STAGING_PROJECT_REF}.supabase.co/realtime/v1/websocket?apikey=redacted`;
    expect(classifyBrowserRequest(realtime)).toBe('expected staging Supabase request');
    expect(browserRequestIsAllowed(realtime)).toBe(true);
    expect(browserRequestIsAllowed('https://telemetry.example.test/collect')).toBe(false);
    const descriptor = sanitizeBrowserRequestDescriptor({
      url: () => realtime,
      method: () => 'GET',
      resourceType: () => 'websocket',
    }, 'admin_authentication');
    expect(descriptor).toEqual({
      scheme: 'wss',
      hostname: `${STAGING_PROJECT_REF}.supabase.co`,
      port: null,
      pathname: '/realtime/v1/websocket',
      method: 'GET',
      resource_type: 'websocket',
      execution_phase: 'admin_authentication',
      classification: 'expected staging Supabase request',
    });
    expect(JSON.stringify(descriptor)).not.toContain('apikey');
  });
});
