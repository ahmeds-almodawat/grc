import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { credentialGateDecision, getCurrentUserCredentialState } from '../lib/userCredentialApi';
import {
  getLoginCaptchaSubmissionError,
  loginCaptchaConfig,
  normalizeLoginCaptchaToken,
} from './loginCaptcha';
import type { AuthProfile, AuthRole, AuthRoleAssignment, AuthUserState, AuthUserStatus } from './authTypes';

interface AuthContextValue extends AuthUserState {
  session: Session | null;
  signIn: (email: string, password: string, captchaToken?: string | null) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const LOCAL_BYPASS_ENABLED = import.meta.env.DEV && import.meta.env.VITE_AUTH_BYPASS_LOCAL === 'true';
const PROFILE_SELECT_WITH_PATCH19_STATUS = 'id,email,full_name_en,full_name_ar,organization_id,division_id,department_id,unit_id,is_active,user_status,organizations(name_en)';
const PROFILE_SELECT_LEGACY = 'id,email,full_name_en,full_name_ar,organization_id,division_id,department_id,unit_id,is_active,organizations(name_en)';
const PATCH19_BLOCKING_STATUSES: AuthUserStatus[] = ['inactive', 'archived', 'locked'];

function isAuthRole(value: unknown): value is AuthRole {
  return typeof value === 'string' && [
    'super_admin',
    'executive',
    'governance_admin',
    'division_head',
    'department_manager',
    'project_owner',
    'milestone_owner',
    'task_owner',
    'auditor',
    'compliance_officer',
    'viewer',
    'employee',
  ].includes(value);
}

function toAuthRole(value: unknown): AuthRole {
  return isAuthRole(value) ? value : 'employee';
}

function isKnownAuthUserStatus(value: unknown): value is AuthUserStatus {
  return typeof value === 'string' && ['active', 'inactive', 'archived', 'invited', 'locked'].includes(value);
}

function normalizePatch19UserStatus(value: unknown): AuthUserStatus {
  // Recovery note: Patch 19 status is additive. Missing/null/unknown status must default
  // to active so existing authenticated admins are not locked out before migration 080 lands.
  return isKnownAuthUserStatus(value) ? value : 'active';
}

function isMissingPatch19StatusColumn(error: { code?: string; message?: string; details?: string | null } | null): boolean {
  if (!error) return false;
  const text = `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return text.includes('user_status')
    && (text.includes('does not exist') || text.includes('could not find') || text.includes('schema cache') || text.includes('42703') || text.includes('pgrst204'));
}

function localBypassState(): AuthUserState {
  return {
    status: 'authenticated',
    profile: {
      id: 'local-dev-user',
      email: 'local.dev@grc.local',
      fullNameEn: 'Local Development User',
      fullNameAr: 'مستخدم التطوير المحلي',
      isActive: true,
      userStatus: 'active',
    },
    roles: [{ role: 'super_admin', scope: 'global' }],
    primaryRole: 'super_admin',
    credentialState: 'legacy_unmanaged',
    credentialVersion: 0,
    isLocalBypass: true,
    message: 'Local auth bypass is enabled for development only.',
  };
}

async function loadAuthState(session: Session | null): Promise<AuthUserState> {
  if (LOCAL_BYPASS_ENABLED) return localBypassState();

  if (!isSupabaseConfigured || !supabase) {
    return {
      status: 'configuration_error',
      profile: null,
      roles: [],
      primaryRole: null,
      message: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    };
  }

  if (!session?.user) {
    return { status: 'unauthenticated', profile: null, roles: [], primaryRole: null };
  }

  const user = session.user;
  let credentialDecision: ReturnType<typeof credentialGateDecision>;
  try {
    credentialDecision = credentialGateDecision(await getCurrentUserCredentialState());
  } catch (error) {
    return {
      status: 'error',
      profile: null,
      roles: [],
      primaryRole: null,
      credentialState: 'blocked',
      message: error instanceof Error
        ? `Credential-state verification failed. ${error.message}`
        : 'Credential-state verification failed. Access was denied.',
    };
  }

  const credentialVersion = credentialDecision.state.credential_version;
  if (credentialDecision.gate === 'password_change_required') {
    return {
      status: 'password_change_required',
      profile: null,
      roles: [],
      primaryRole: null,
      credentialState: 'password_change_required',
      credentialVersion,
      message: credentialDecision.state.message
        ?? 'You must change your temporary password before accessing the application.',
    };
  }
  if (credentialDecision.gate === 'blocked') {
    return {
      status: 'inactive',
      profile: null,
      roles: [],
      primaryRole: null,
      credentialState: 'blocked',
      credentialVersion,
      message: credentialDecision.state.message
        ?? 'This credential is not permitted to access the application. Ask a Super Admin to review it.',
    };
  }

  const credentialState = credentialDecision.gate === 'legacy_unmanaged'
    ? 'legacy_unmanaged' as const
    : 'active' as const;
  const profileResult = await supabase
    .from('profiles')
    .select(PROFILE_SELECT_WITH_PATCH19_STATUS)
    .eq('id', user.id)
    .maybeSingle();

  let profileRow = profileResult.data as any | null;
  let profileError = profileResult.error;

  if (isMissingPatch19StatusColumn(profileError)) {
    const legacyProfileResult = await supabase
      .from('profiles')
      .select(PROFILE_SELECT_LEGACY)
      .eq('id', user.id)
      .maybeSingle();
    profileRow = legacyProfileResult.data as any | null;
    profileError = legacyProfileResult.error;
  }

  if (profileError) {
    return {
      status: 'error',
      profile: null,
      roles: [],
      primaryRole: null,
      credentialState,
      credentialVersion,
      message: profileError.message,
    };
  }

  if (!profileRow) {
    return {
      status: 'profile_missing',
      profile: null,
      roles: [],
      primaryRole: null,
      credentialState,
      credentialVersion,
      message: 'Signed-in user has no active profile record. Ask an administrator to create the profile and role assignment.',
    };
  }

  const userStatus = normalizePatch19UserStatus(profileRow.user_status);
  const profileIsActive = profileRow.is_active !== false
    && !PATCH19_BLOCKING_STATUSES.includes(userStatus);
  const profile: AuthProfile = {
    id: String(profileRow.id),
    email: String(profileRow.email ?? user.email ?? ''),
    fullNameEn: String(profileRow.full_name_en ?? user.email ?? 'User'),
    fullNameAr: profileRow.full_name_ar as string | null | undefined,
    organizationId: profileRow.organization_id as string | null | undefined,
    organizationName: (profileRow.organizations as { name_en?: string } | null | undefined)?.name_en ?? null,
    divisionId: profileRow.division_id as string | null | undefined,
    departmentId: profileRow.department_id as string | null | undefined,
    unitId: profileRow.unit_id as string | null | undefined,
    isActive: profileIsActive,
    userStatus,
  };

  if (!profileIsActive) {
    const lifecycleLabel = userStatus === 'locked'
      ? 'locked'
      : userStatus === 'archived'
        ? 'archived'
        : 'inactive';
    return {
      status: 'inactive',
      profile,
      roles: [],
      primaryRole: null,
      credentialState,
      credentialVersion,
      message: `This user profile is ${lifecycleLabel}. Ask an administrator to review the account lifecycle state.`,
    };
  }

  const { data: roleRows, error: roleError } = await supabase
    .from('user_roles')
    .select('role,scope,organization_id,division_id,department_id,unit_id,is_active')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (roleError) {
    return {
      status: 'error',
      profile,
      roles: [],
      primaryRole: null,
      credentialState,
      credentialVersion,
      message: roleError.message,
    };
  }

  const roles: AuthRoleAssignment[] = ((roleRows ?? []) as any[]).map((row: any) => ({
    role: toAuthRole(row.role),
    scope: (row.scope as AuthRoleAssignment['scope']) ?? 'assigned_only',
    organizationId: row.organization_id as string | null | undefined,
    divisionId: row.division_id as string | null | undefined,
    departmentId: row.department_id as string | null | undefined,
    unitId: row.unit_id as string | null | undefined,
  }));

  return {
    status: 'authenticated',
    profile,
    roles,
    primaryRole: roles[0]?.role ?? null,
    credentialState,
    credentialVersion,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<AuthUserState>({
    status: 'loading',
    profile: null,
    roles: [],
    primaryRole: null,
  });

  const refresh = useCallback(async (nextSession?: Session | null) => {
    setState((previous: AuthUserState) => ({ ...previous, status: 'loading' }));
    const effectiveSession = nextSession === undefined ? session : nextSession;
    const nextState = await loadAuthState(effectiveSession);
    setState(nextState);
  }, [session]);

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      if (LOCAL_BYPASS_ENABLED) {
        if (isMounted) setState(localBypassState());
        return;
      }

      if (!isSupabaseConfigured || !supabase) {
        if (isMounted) setState(await loadAuthState(null));
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setSession(data.session);
      setState(await loadAuthState(data.session));
    }

    boot();

    if (!supabase || LOCAL_BYPASS_ENABLED) {
      return () => {
        isMounted = false;
      };
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
      setSession(nextSession);
      loadAuthState(nextSession).then(nextState => {
        if (isMounted) setState(nextState);
      });
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || !supabase || LOCAL_BYPASS_ENABLED) return undefined;

    let isMounted = true;
    let revalidationInFlight = false;
    const revalidate = async () => {
      if (revalidationInFlight) return;
      revalidationInFlight = true;
      try {
        const nextState = await loadAuthState(session);
        if (isMounted) setState(nextState);
      } catch (error) {
        if (isMounted) {
          setState({
            status: 'error',
            profile: null,
            roles: [],
            primaryRole: null,
            credentialState: 'blocked',
            message: error instanceof Error
              ? `Session revalidation failed. ${error.message}`
              : 'Session revalidation failed. Access was denied.',
          });
        }
      } finally {
        revalidationInFlight = false;
      }
    };
    const onFocus = () => void revalidate();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void revalidate();
    };
    const interval = window.setInterval(() => void revalidate(), 60_000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [session]);

  const signIn = useCallback(async (email: string, password: string, captchaToken?: string | null) => {
    const captchaError = getLoginCaptchaSubmissionError(loginCaptchaConfig, captchaToken);
    if (captchaError) return { ok: false, message: captchaError };

    if (!supabase) {
      const message = 'Supabase is not configured. Login cannot continue.';
      setState({ status: 'configuration_error', profile: null, roles: [], primaryRole: null, message });
      return { ok: false, message };
    }

    const normalizedCaptchaToken = normalizeLoginCaptchaToken(captchaToken);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      ...(normalizedCaptchaToken ? { options: { captchaToken: normalizedCaptchaToken } } : {}),
    });
    if (error) return { ok: false, message: error.message };

    setSession(data.session);
    const nextState = await loadAuthState(data.session);
    if (nextState.status === 'authenticated' || nextState.status === 'password_change_required') {
      setState(nextState);
      return { ok: true };
    }

    const message = nextState.message ?? 'Login succeeded but profile authorization failed.';
    let revocationError: string | null = null;
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        revocationError = error.message;
        await supabase.auth.signOut({ scope: 'local' });
      }
    } catch (error) {
      revocationError = error instanceof Error ? error.message : 'Unknown session revocation error.';
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
    setSession(null);
    setState(nextState);
    return {
      ok: false,
      message: revocationError
        ? `${message} Global session revocation could not be confirmed: ${revocationError}`
        : message,
    };
  }, []);

  const signOut = useCallback(async () => {
    if (LOCAL_BYPASS_ENABLED) return;
    let revocationError: Error | null = null;
    if (supabase) {
      try {
        const { error } = await supabase.auth.signOut({ scope: 'global' });
        if (error) {
          revocationError = error;
          await supabase.auth.signOut({ scope: 'local' });
        }
      } catch (error) {
        revocationError = error instanceof Error ? error : new Error('Global session revocation failed.');
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      }
    }
    setSession(null);
    setState({ status: 'unauthenticated', profile: null, roles: [], primaryRole: null });
    if (revocationError) throw revocationError;
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    session,
    signIn,
    signOut,
    reload: () => refresh(),
  }), [state, session, signIn, signOut, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
