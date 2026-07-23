import type { Session } from '@supabase/supabase-js';
import { createElement } from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  startAutoRefresh: vi.fn(),
}));
const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
}));
const sessionValidationMocks = vi.hoisted(() => ({
  isCurrentSupabaseSessionUsable: vi.fn(),
}));
const credentialMocks = vi.hoisted(() => ({
  credentialGateDecision: vi.fn(),
  getCurrentUserCredentialState: vi.fn(),
  getPatch83uCapabilities: vi.fn(),
  patch83uCapabilityCompatibilityIssue: vi.fn(),
  patch83uRuntimeAllowsStableExistingAccess: vi.fn(),
}));

vi.mock('../../src/lib/supabase', () => ({
  isCurrentSupabaseSessionUsable: sessionValidationMocks.isCurrentSupabaseSessionUsable,
  isSupabaseConfigured: true,
  supabase: { auth: authMocks, from: supabaseMocks.from },
  supabaseAuthStorageKey: 'grc-control-center-auth',
}));
vi.mock('../../src/config/featureFlags', () => ({
  isPatch83uCredentialGovernanceEnabled: () => true,
}));
vi.mock('../../src/lib/userCredentialApi', () => credentialMocks);

import {
  AuthProvider,
  clearPersistedSessionIfStillMatches,
  readDeferredAuthSessionIfStillCurrent,
  useAuth,
} from '../../src/auth/AuthProvider';

function session(accessToken: string): Session {
  return {
    access_token: accessToken,
    refresh_token: `${accessToken}-refresh`,
  } as Session;
}

const TEST_USER_ID = '00000000-0000-4000-8000-000000000001';
const TEST_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000002';

function authenticatedSession(accessToken: string): Session {
  return {
    ...session(accessToken),
    user: {
      id: TEST_USER_ID,
      email: '000001@almodawat.sa',
    },
  } as Session;
}

function activeCredentialState(version = 1) {
  return {
    credential_state: 'active',
    credential_version: version,
    message: null,
  };
}

function deferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return {
    promise,
    resolve(value: T) {
      if (!resolve) throw new Error('Deferred promise was not initialized.');
      resolve(value);
    },
  };
}

function mockActiveAuthorizationQueries() {
  supabaseMocks.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        abortSignal: vi.fn(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: TEST_USER_ID,
            email: '000001@almodawat.sa',
            full_name_en: 'Test User',
            full_name_ar: null,
            organization_id: TEST_ORGANIZATION_ID,
            division_id: null,
            department_id: null,
            unit_id: null,
            is_active: true,
            user_status: 'active',
            organizations: { name_en: 'Test Organization' },
          },
          error: null,
        }),
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      query.abortSignal.mockReturnValue(query);
      return query;
    }

    if (table === 'user_roles') {
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        abortSignal: vi.fn(),
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      query.abortSignal.mockResolvedValue({
        data: [{
          role: 'super_admin',
          scope: 'global',
          organization_id: TEST_ORGANIZATION_ID,
          division_id: null,
          department_id: null,
          unit_id: null,
          is_active: true,
        }],
        error: null,
      });
      return query;
    }

    throw new Error(`Unexpected table: ${table}`);
  });
}

describe('authenticated sign-in race cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    authMocks.startAutoRefresh.mockResolvedValue(undefined);
    sessionValidationMocks.isCurrentSupabaseSessionUsable
      .mockImplementation((value: Session | null) => Boolean(value?.user));
    credentialMocks.getPatch83uCapabilities.mockResolvedValue({
      contract_version: 'patch83u-v1',
      runtime_activation_state: 'enforced',
    });
    credentialMocks.patch83uCapabilityCompatibilityIssue.mockReturnValue(null);
    credentialMocks.getCurrentUserCredentialState.mockResolvedValue(activeCredentialState());
    credentialMocks.patch83uRuntimeAllowsStableExistingAccess.mockReturnValue(false);
    credentialMocks.credentialGateDecision.mockImplementation((credential: { credential_state?: string }) => ({
      gate: credential.credential_state === 'password_change_required'
        ? 'password_change_required'
        : credential.credential_state === 'reconciliation_required'
          ? 'reconciliation_required'
          : credential.credential_state === 'blocked'
            ? 'blocked'
            : 'active',
      state: credential,
    }));
    localStorage.removeItem('grc-control-center-auth');
    localStorage.removeItem('grc-control-center-auth-code-verifier');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('settles a missing bootstrap session as atomically signed out', async () => {
    let capturedAuth: ReturnType<typeof useAuth> | undefined;
    function CaptureAuth() {
      capturedAuth = useAuth();
      return null;
    }

    render(createElement(AuthProvider, null, createElement(CaptureAuth)));

    await waitFor(() => expect(capturedAuth?.status).toBe('unauthenticated'));
    expect(capturedAuth?.session).toBeNull();
    expect(capturedAuth?.profile).toBeNull();
    expect(capturedAuth?.roles).toEqual([]);
    expect(capturedAuth?.primaryRole).toBeNull();
    expect(supabaseMocks.from).not.toHaveBeenCalled();
  });

  it('keeps a real authenticated user with no profile fail closed', async () => {
    const initialSession = authenticatedSession('missing-profile-token');
    authMocks.getSession.mockResolvedValue({ data: { session: initialSession }, error: null });
    supabaseMocks.from.mockImplementation((table: string) => {
      if (table !== 'profiles') throw new Error(`Unexpected table: ${table}`);
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        abortSignal: vi.fn(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      query.abortSignal.mockReturnValue(query);
      return query;
    });

    let capturedAuth: ReturnType<typeof useAuth> | undefined;
    function CaptureAuth() {
      capturedAuth = useAuth();
      return null;
    }
    render(createElement(AuthProvider, null, createElement(CaptureAuth)));

    await waitFor(() => expect(capturedAuth?.status).toBe('authenticated_access_denied'));
    expect(capturedAuth?.session?.user.id).toBe(TEST_USER_ID);
    expect(capturedAuth?.profile).toBeNull();
    expect(capturedAuth?.message)
      .toBe('Signed-in user has no profile record. Ask an administrator to reconcile the account.');
  });

  it('clears session, profile, roles and credential state when Auth changes from user to null', async () => {
    const initialSession = authenticatedSession('active-token');
    let onAuthStateChange: ((event: string, nextSession: Session | null) => void) | undefined;
    authMocks.getSession.mockResolvedValue({ data: { session: initialSession }, error: null });
    authMocks.onAuthStateChange.mockImplementation((handler) => {
      onAuthStateChange = handler;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mockActiveAuthorizationQueries();

    let capturedAuth: ReturnType<typeof useAuth> | undefined;
    function CaptureAuth() {
      capturedAuth = useAuth();
      return null;
    }
    render(createElement(AuthProvider, null, createElement(CaptureAuth)));
    await waitFor(() => expect(capturedAuth?.status).toBe('authenticated_active'));

    act(() => onAuthStateChange?.('SIGNED_OUT', null));

    await waitFor(() => expect(capturedAuth?.status).toBe('unauthenticated'));
    expect(capturedAuth?.session).toBeNull();
    expect(capturedAuth?.profile).toBeNull();
    expect(capturedAuth?.roles).toEqual([]);
    expect(capturedAuth?.primaryRole).toBeNull();
    expect(capturedAuth?.credentialState).toBeUndefined();
    expect(capturedAuth?.credentialVersion).toBeUndefined();
    expect(capturedAuth?.isRevalidating).toBe(false);
  });

  it('prevents a late profile result from restoring state after a null Auth event', async () => {
    const initialSession = authenticatedSession('late-profile-token');
    const profileResult = deferred<{ data: null; error: null }>();
    let onAuthStateChange: ((event: string, nextSession: Session | null) => void) | undefined;
    authMocks.getSession.mockResolvedValue({ data: { session: initialSession }, error: null });
    authMocks.onAuthStateChange.mockImplementation((handler) => {
      onAuthStateChange = handler;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    supabaseMocks.from.mockImplementation((table: string) => {
      if (table !== 'profiles') throw new Error(`Unexpected table: ${table}`);
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        abortSignal: vi.fn(),
        maybeSingle: vi.fn().mockReturnValue(profileResult.promise),
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      query.abortSignal.mockReturnValue(query);
      return query;
    });

    let capturedAuth: ReturnType<typeof useAuth> | undefined;
    function CaptureAuth() {
      capturedAuth = useAuth();
      return null;
    }
    render(createElement(AuthProvider, null, createElement(CaptureAuth)));
    await waitFor(() => expect(capturedAuth?.status).toBe('authenticated_loading_authorization'));

    act(() => onAuthStateChange?.('SIGNED_OUT', null));
    profileResult.resolve({ data: null, error: null });

    await waitFor(() => expect(capturedAuth?.status).toBe('unauthenticated'));
    expect(capturedAuth?.session).toBeNull();
    expect(capturedAuth?.profile).toBeNull();
    expect(capturedAuth?.message).toBeUndefined();
  });

  it('rejects an unusable session before any profile or credential query', async () => {
    const invalidSession = authenticatedSession('invalid-session-token');
    authMocks.getSession.mockResolvedValue({ data: { session: invalidSession }, error: null });
    sessionValidationMocks.isCurrentSupabaseSessionUsable.mockReturnValue(false);

    let capturedAuth: ReturnType<typeof useAuth> | undefined;
    function CaptureAuth() {
      capturedAuth = useAuth();
      return null;
    }
    render(createElement(AuthProvider, null, createElement(CaptureAuth)));

    await waitFor(() => expect(capturedAuth?.status).toBe('unauthenticated'));
    expect(capturedAuth?.session).toBeNull();
    expect(supabaseMocks.from).not.toHaveBeenCalled();
    expect(credentialMocks.getPatch83uCapabilities).not.toHaveBeenCalled();
  });

  it('clears a stale sign-in only while that exact access token remains persisted', async () => {
    localStorage.setItem('grc-control-center-auth', JSON.stringify(session('stale-token')));

    await clearPersistedSessionIfStillMatches(session('stale-token'));

    expect(localStorage.getItem('grc-control-center-auth')).toBeNull();
  });

  it('never clears a newer login that replaced the stale access token', async () => {
    localStorage.setItem('grc-control-center-auth', JSON.stringify(session('newer-token')));

    await clearPersistedSessionIfStillMatches(session('stale-token'));

    expect(localStorage.getItem('grc-control-center-auth')).toContain('newer-token');
  });

  it('uses no SDK sign-out during stale cleanup, avoiding a check-then-sign-out race', async () => {
    localStorage.setItem('grc-control-center-auth', JSON.stringify(session('newer-token')));

    await clearPersistedSessionIfStillMatches(session('stale-token'));

    expect(authMocks.getSession).not.toHaveBeenCalled();
    expect(localStorage.getItem('grc-control-center-auth')).toContain('newer-token');
  });

  it('discards a deferred session snapshot when a newer auth event wins during the read', async () => {
    let resolveRead: ((value: Session | null) => void) | undefined;
    let authEventEpoch = 7;
    const pendingRead = new Promise<Session | null>((resolve) => {
      resolveRead = resolve;
    });

    const reconciliation = readDeferredAuthSessionIfStillCurrent(
      () => pendingRead,
      () => authEventEpoch === 7,
    );

    authEventEpoch += 1;
    resolveRead?.(session('stale-token'));

    await expect(reconciliation).resolves.toEqual({ status: 'superseded' });
  });

  it('cleans a successful sign-in that resolves after the provider unmounts without starting a data pipeline', async () => {
    let capturedAuth: ReturnType<typeof useAuth> | undefined;
    let resolveSignIn: ((value: {
      data: { session: Session; user: Session['user'] };
      error: null;
    }) => void) | undefined;
    const lateSession = {
      ...session('late-token'),
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: '000001@almodawat.sa',
      },
    } as Session;
    authMocks.signInWithPassword.mockReturnValue(new Promise((resolve) => {
      resolveSignIn = resolve;
    }));

    function CaptureAuth() {
      capturedAuth = useAuth();
      return null;
    }

    const view = render(createElement(
      AuthProvider,
      null,
      createElement(CaptureAuth),
    ));
    await waitFor(() => expect(capturedAuth).toBeDefined());

    let pendingSignIn: ReturnType<ReturnType<typeof useAuth>['signIn']> | undefined;
    await act(async () => {
      pendingSignIn = capturedAuth?.signIn('000001@almodawat.sa', 'existing-password');
      await Promise.resolve();
    });
    await waitFor(() => expect(authMocks.signInWithPassword).toHaveBeenCalledTimes(1));

    localStorage.setItem('grc-control-center-auth', JSON.stringify(lateSession));
    view.unmount();
    resolveSignIn?.({ data: { session: lateSession, user: lateSession.user }, error: null });

    await expect(pendingSignIn).resolves.toEqual({
      ok: false,
      message: 'The sign-in attempt was cancelled.',
    });
    expect(localStorage.getItem('grc-control-center-auth')).toBeNull();
    expect(authMocks.startAutoRefresh).not.toHaveBeenCalled();
    expect(supabaseMocks.from).not.toHaveBeenCalled();
  });

  it('keeps the active user state mounted and deduplicates focus and visibility revalidation', async () => {
    const initialSession = authenticatedSession('active-token');
    authMocks.getSession.mockResolvedValue({ data: { session: initialSession }, error: null });
    mockActiveAuthorizationQueries();

    let capturedAuth: ReturnType<typeof useAuth> | undefined;
    const statusHistory: string[] = [];
    function CaptureAuth() {
      capturedAuth = useAuth();
      statusHistory.push(capturedAuth.status);
      return null;
    }

    const initialCapabilities = deferred<{
      contract_version: string;
      runtime_activation_state: string;
    }>();
    credentialMocks.getPatch83uCapabilities.mockReturnValueOnce(initialCapabilities.promise);
    render(createElement(AuthProvider, null, createElement(CaptureAuth)));
    await waitFor(() => expect(capturedAuth?.status).toBe('authenticated_checking_capabilities'));
    initialCapabilities.resolve({
      contract_version: 'patch83u-v1',
      runtime_activation_state: 'enforced',
    });
    await waitFor(() => expect(capturedAuth?.status).toBe('authenticated_active'));
    expect(statusHistory).toContain('authenticated_checking_capabilities');
    expect(capturedAuth?.profile?.id).toBe(TEST_USER_ID);
    expect(capturedAuth?.roles).toHaveLength(1);

    const backgroundCredential = deferred<ReturnType<typeof activeCredentialState>>();
    credentialMocks.getCurrentUserCredentialState.mockReturnValueOnce(backgroundCredential.promise);
    const historyStart = statusHistory.length;
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');

    act(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(credentialMocks.getCurrentUserCredentialState).toHaveBeenCalledTimes(2));
    expect(capturedAuth?.isRevalidating).toBe(true);
    expect(capturedAuth?.status).toBe('authenticated_active');
    expect(capturedAuth?.profile?.id).toBe(TEST_USER_ID);
    expect(capturedAuth?.roles).toHaveLength(1);
    expect(statusHistory.slice(historyStart).length).toBeGreaterThan(0);
    expect(statusHistory.slice(historyStart).every((status) => status === 'authenticated_active')).toBe(true);

    backgroundCredential.resolve(activeCredentialState(2));
    await waitFor(() => expect(capturedAuth?.isRevalidating).toBe(false));
    expect(capturedAuth?.status).toBe('authenticated_active');
    expect(capturedAuth?.credentialVersion).toBe(2);

    act(() => window.dispatchEvent(new Event('focus')));
    await act(async () => Promise.resolve());
    expect(credentialMocks.getCurrentUserCredentialState).toHaveBeenCalledTimes(2);
  });

  it('preserves active UI while pending but commits a confirmed adverse credential result', async () => {
    const initialSession = authenticatedSession('active-token');
    authMocks.getSession.mockResolvedValue({ data: { session: initialSession }, error: null });
    mockActiveAuthorizationQueries();

    let capturedAuth: ReturnType<typeof useAuth> | undefined;
    function CaptureAuth() {
      capturedAuth = useAuth();
      return null;
    }

    render(createElement(AuthProvider, null, createElement(CaptureAuth)));
    await waitFor(() => expect(capturedAuth?.status).toBe('authenticated_active'));

    const adverseCredential = deferred<ReturnType<typeof activeCredentialState>>();
    credentialMocks.getCurrentUserCredentialState.mockReturnValueOnce(adverseCredential.promise);
    act(() => window.dispatchEvent(new Event('focus')));

    await waitFor(() => expect(capturedAuth?.isRevalidating).toBe(true));
    expect(capturedAuth?.status).toBe('authenticated_active');
    expect(capturedAuth?.profile?.id).toBe(TEST_USER_ID);

    adverseCredential.resolve({
      credential_state: 'password_change_required',
      credential_version: 2,
      message: null,
    });

    await waitFor(() => expect(capturedAuth?.status).toBe('authenticated_password_change_required'));
    expect(capturedAuth?.isRevalidating).toBe(false);
    expect(capturedAuth?.profile).toBeNull();
    expect(capturedAuth?.roles).toEqual([]);
  });

  it('keeps same-user token refresh non-blocking and rejects a stale adverse response', async () => {
    const initialSession = authenticatedSession('active-token');
    const refreshedSession = authenticatedSession('refreshed-token');
    let onAuthStateChange: ((event: string, nextSession: Session | null) => void) | undefined;
    authMocks.getSession.mockResolvedValue({ data: { session: initialSession }, error: null });
    authMocks.onAuthStateChange.mockImplementation((handler) => {
      onAuthStateChange = handler;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mockActiveAuthorizationQueries();

    let capturedAuth: ReturnType<typeof useAuth> | undefined;
    const statusHistory: string[] = [];
    function CaptureAuth() {
      capturedAuth = useAuth();
      statusHistory.push(capturedAuth.status);
      return null;
    }

    render(createElement(AuthProvider, null, createElement(CaptureAuth)));
    await waitFor(() => expect(capturedAuth?.status).toBe('authenticated_active'));

    const staleCredential = deferred<ReturnType<typeof activeCredentialState>>();
    credentialMocks.getCurrentUserCredentialState.mockReturnValueOnce(staleCredential.promise);
    const historyStart = statusHistory.length;
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(credentialMocks.getCurrentUserCredentialState).toHaveBeenCalledTimes(2));

    credentialMocks.getCurrentUserCredentialState.mockResolvedValueOnce(activeCredentialState(3));
    act(() => onAuthStateChange?.('TOKEN_REFRESHED', refreshedSession));

    await waitFor(() => {
      expect(capturedAuth?.session?.access_token).toBe('refreshed-token');
      expect(capturedAuth?.credentialVersion).toBe(3);
      expect(capturedAuth?.isRevalidating).toBe(false);
    });
    expect(statusHistory.slice(historyStart).length).toBeGreaterThan(0);
    expect(statusHistory.slice(historyStart).every((status) => status === 'authenticated_active')).toBe(true);

    staleCredential.resolve({
      credential_state: 'password_change_required',
      credential_version: 99,
      message: null,
    });
    await act(async () => Promise.resolve());

    expect(capturedAuth?.status).toBe('authenticated_active');
    expect(capturedAuth?.credentialVersion).toBe(3);
    expect(capturedAuth?.session?.access_token).toBe('refreshed-token');
  });

});
