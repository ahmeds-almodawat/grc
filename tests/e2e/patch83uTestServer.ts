import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';

export type Patch83uTestServer = {
  baseUrl: string;
  stop: () => void;
  output: () => string;
};

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(url: string, output: () => string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The isolated Vite process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Patch 83U test server did not start.\n${output()}`);
}

export async function startPatch83uTestServer(
  environment: Record<string, string>,
): Promise<Patch83uTestServer> {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const viteBin = path.resolve(process.cwd(), 'node_modules/vite/bin/vite.js');
  let serverOutput = '';
  const child: ChildProcess = spawn(
    process.execPath,
    [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_ANON_KEY: 'patch83u-browser-test-public-anon-key',
        VITE_AUTH_BYPASS_LOCAL: 'false',
        VITE_AUTH_CAPTCHA_REQUIRED: 'false',
        VITE_AUTH_CAPTCHA_SITE_KEY: '',
        ...environment,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  const collect = (chunk: Buffer) => {
    serverOutput = `${serverOutput}${chunk.toString()}`.slice(-20_000);
  };
  child.stdout?.on('data', collect);
  child.stderr?.on('data', collect);
  const output = () => serverOutput;
  await waitForServer(baseUrl, output);

  return {
    baseUrl,
    output,
    stop: () => child.kill(),
  };
}
