import { supabase } from './supabase';
import {
  isPatch83uCredentialGovernanceEnabled,
  PATCH83U_FRONTEND_CONTRACT_VERSION,
} from '../config/featureFlags';

export interface PrivilegedActionOptions {
  signal?: AbortSignal;
  accessToken?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export class PrivilegedActionError extends Error {
  readonly code: string | null;
  readonly status: number | null;
  readonly detail: string | null;
  readonly retryable: boolean;

  constructor(input: {
    message: string;
    code?: string | null;
    status?: number | null;
    detail?: string | null;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = 'PrivilegedActionError';
    this.code = input.code ?? null;
    this.status = input.status ?? null;
    this.detail = input.detail ?? null;
    this.retryable = input.retryable ?? false;
  }
}

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
  options: PrivilegedActionOptions = {},
): Promise<T> {
  if (!supabase) {
    throw new PrivilegedActionError({
      message: 'Supabase is not configured. The privileged server bridge is unavailable.',
      code: 'SUPABASE_NOT_CONFIGURED',
    });
  }

  const headers: Record<string, string> = {
    ...(isPatch83uCredentialGovernanceEnabled()
      ? { 'x-patch83u-frontend-contract-version': PATCH83U_FRONTEND_CONTRACT_VERSION }
      : {}),
    ...options.headers,
  };
  const accessToken = options.accessToken?.trim();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let data: any;
  let error: any;
  try {
    const response = await supabase.functions.invoke('privileged-action', {
      body: { action, payload },
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.timeout ? { timeout: options.timeout } : {}),
    });
    data = response.data;
    error = response.error;
  } catch (invokeError) {
    const aborted = options.signal?.aborted === true
      || (invokeError instanceof DOMException && invokeError.name === 'AbortError');
    throw new PrivilegedActionError({
      message: aborted
        ? 'The privileged action was cancelled.'
        : 'The privileged server bridge could not be reached.',
      code: aborted ? 'REQUEST_ABORTED' : 'PRIVILEGED_ACTION_TRANSPORT_ERROR',
      retryable: !aborted,
      cause: invokeError,
    });
  }

  if (error) {
    let message = error.message;
    let code: string | null = null;
    let detail: string | null = null;
    let status: number | null = null;
    const context = 'context' in error ? error.context : null;
    if (context instanceof Response) {
      status = context.status;
      try {
        const body = await context.clone().json() as {
          error?: string;
          code?: string;
          detail?: string;
        };
        message = body.error || message;
        code = typeof body.code === 'string' && body.code.trim() ? body.code.trim() : null;
        detail = typeof body.detail === 'string' && body.detail.trim() ? body.detail.trim() : null;
      } catch {
        // Keep the SDK error when the response is not JSON.
      }
    }
    throw new PrivilegedActionError({
      message,
      code,
      status,
      detail,
      retryable: status === null || status === 408 || status === 425 || status === 429 || status >= 500,
      cause: error,
    });
  }
  if (!data?.ok) {
    const status = typeof data?.status === 'number' ? data.status : null;
    throw new PrivilegedActionError({
      message: data?.error || `Privileged action ${action} failed.`,
      code: typeof data?.code === 'string' ? data.code : null,
      status,
      detail: typeof data?.detail === 'string' ? data.detail : null,
      retryable: status === null || status === 408 || status === 425 || status === 429 || status >= 500,
    });
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
