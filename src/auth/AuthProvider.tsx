import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { AuthProfile, AuthRole, AuthRoleAssignment, AuthUserState } from './authTypes';

interface AuthContextValue extends AuthUserState {
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const LOCAL_BYPASS_ENABLED = import.meta.env.DEV && import.meta.env.VITE_AUTH_BYPASS_LOCAL === 'true';

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

function localBypassState(): AuthUserState {
  return {
    status: 'authenticated',
    profile: {
      id: 'local-dev-user',
      email: 'local.dev@grc.local',
      fullNameEn: 'Local Development User',
      fullNameAr: 'مستخدم التطوير المحلي',
      isActive: true,
    },
    roles: [{ role: 'super_admin', scope: 'global' }],
    primaryRole: 'super_admin',
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
  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('id,email,full_name_en,full_name_ar,organization_id,division_id,department_id,unit_id,is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return {
      status: 'error',
      profile: null,
      roles: [],
      primaryRole: null,
      message: profileError.message,
    };
  }

  if (!profileRow) {
    return {
      status: 'profile_missing',
      profile: null,
      roles: [],
      primaryRole: null,
      message: 'Signed-in user has no active profile record. Ask an administrator to create the profile and role assignment.',
    };
  }

  const profile: AuthProfile = {
    id: String(profileRow.id),
    email: String(profileRow.email ?? user.email ?? ''),
    fullNameEn: String(profileRow.full_name_en ?? user.email ?? 'User'),
    fullNameAr: profileRow.full_name_ar as string | null | undefined,
    organizationId: profileRow.organization_id as string | null | undefined,
    divisionId: profileRow.division_id as string | null | undefined,
    departmentId: profileRow.department_id as string | null | undefined,
    unitId: profileRow.unit_id as string | null | undefined,
    isActive: Boolean(profileRow.is_active),
  };

  if (!profile.isActive) {
    return {
      status: 'inactive',
      profile,
      roles: [],
      primaryRole: null,
      message: 'Your user profile is inactive. Contact the system administrator.',
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

  if (roles.length === 0) {
    return {
      status: 'profile_missing',
      profile,
      roles: [],
      primaryRole: null,
      message: 'Your profile has no active role assignment. Ask an administrator to assign a role.',
    };
  }

  return {
    status: 'authenticated',
    profile,
    roles,
    primaryRole: roles[0]?.role ?? null,
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

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      const message = 'Supabase is not configured. Login cannot continue.';
      setState({ status: 'configuration_error', profile: null, roles: [], primaryRole: null, message });
      return { ok: false, message };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: error.message };

    setSession(data.session);
    const nextState = await loadAuthState(data.session);
    setState(nextState);
    return nextState.status === 'authenticated'
      ? { ok: true }
      : { ok: false, message: nextState.message ?? 'Login succeeded but profile authorization failed.' };
  }, []);

  const signOut = useCallback(async () => {
    if (LOCAL_BYPASS_ENABLED) return;
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setState({ status: 'unauthenticated', profile: null, roles: [], primaryRole: null });
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
