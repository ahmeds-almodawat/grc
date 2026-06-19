import { supabase } from './supabase';

export class ServerBridgeRequiredError extends Error {
  readonly code = 'SERVER_BRIDGE_REQUIRED';

  constructor(action: string, rpcName: string) {
    super(
      `${action} is restricted to trusted server/operator tooling. `
      + `The browser call to ${rpcName} has been blocked until an authorized server bridge is implemented.`,
    );
    this.name = 'ServerBridgeRequiredError';
  }
}

export function requireServerBridge(action: string, rpcName: string): never {
  throw new ServerBridgeRequiredError(action, rpcName);
}

export async function invokePrivilegedAction<T>(
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  if (!supabase) {
    throw new Error('Supabase is not configured. The privileged server bridge is unavailable.');
  }

  const { data, error } = await supabase.functions.invoke('privileged-action', {
    body: { action, payload },
  });

  if (error) {
    let message = error.message;
    const context = 'context' in error ? error.context : null;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json() as { error?: string };
        message = body.error || message;
      } catch {
        // Keep the SDK error when the response is not JSON.
      }
    }
    throw new Error(message);
  }
  if (!data?.ok) {
    throw new Error(data?.error || `Privileged action ${action} failed.`);
  }
  return data.result as T;
}

export function actionErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String(error.message);
  }
  return 'The action could not be completed. Ask an authorized administrator to review the server bridge.';
}

export function throwRpcActionError(
  error: unknown,
  action: string,
  rpcName: string,
): never {
  const message = actionErrorMessage(error);
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String(error.code)
      : '';
  if (
    code === '42501'
    || code.startsWith('PGRST')
    || /permission denied|not find the function|not executable/i.test(message)
  ) {
    return requireServerBridge(action, rpcName);
  }
  throw new Error(message);
}
