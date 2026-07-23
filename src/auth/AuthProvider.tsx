import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import {
  isCurrentSupabaseSessionUsable,
  isSupabaseConfigured,
  supabase,
  supabaseAuthStorageKey,
} from '../lib/supabase';
import {
  credentialGateDecision,
  getCurrentUserCredentialState,
  getPatch83uCapabilities,
  patch83uCapabilityCompatibilityIssue,
  patch83uRuntimeAllowsStableExistingAccess,
  type Patch83uCapabilities,
} from '../lib/userCredentialApi';
import { PrivilegedActionError } from '../lib/privilegedAction';
import { isPatch83uCredentialGovernanceEnabled } from '../config/featureFlags';
import {
  getLoginCaptchaSubmissionError,
  loginCaptchaConfig,
  normalizeLoginCaptchaToken,
} from './loginCaptcha';
import type {
  AccessScope,
  AuthProfile,
  AuthRole,
  AuthRoleAssignment,
  AuthUserState,
  AuthUserStatus,
} from './authTypes';

export const PATCH83U_DEPLOYMENT_ERROR_MESSAGE =
  'Your login was successful, but credential governance is not fully deployed. No application data has been opened. Contact the system administrator.';
export const PATCH83U_PASSWORD_CHANGED_NOTICE =
  'Password changed. Sign in again using your new password.';
export const PATCH83U_COMPATIBILITY_RETRY_LIMIT = 3;
export const PATCH83U_COMPATIBILITY_RETRY_COOLDOWN_MS = 5_000;
export const AUTH_BACKGROUND_REVALIDATION_COOLDOWN_MS = 1_000;

interface AuthContextValue extends AuthUserState {
  session: Session | null;
  isRevalidating: boolean;
  signIn: (
    email: string,
    password: string,
    captchaToken?: string | null,
  ) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
  retryCompatibility: () => Promise<void>;
  completeRequiredPasswordChange: (
    outcome?:
      | 'active'
      | 'session_revocation_review_required'
      | 'recovery_required'
      | 'unconfirmed'
      | 'password_policy_rejected_after_revocation',
  ) => Promise<void>;
}

interface PipelineOptions {
  generation?: number;
  force?: boolean;
  preserveRetry?: boolean;
  backgroundRevalidation?: boolean;
}

interface InFlight<T> {
  key: string;
  promise: Promise<T>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const LOCAL_BYPASS_ENABLED = import.meta.env.DEV && import.meta.env.VITE_AUTH_BYPASS_LOCAL === 'true';
const PATCH83U_ENABLED = isPatch83uCredentialGovernanceEnabled();
const AUTH_BROADCAST_CHANNEL = 'grc-patch83u-auth-state-v1';
const AUTH_STORAGE_KEY = supabaseAuthStorageKey;
const PROFILE_SELECT_WITH_PATCH19_STATUS = 'id,email,full_name_en,full_name_ar,organization_id,division_id,department_id,unit_id,is_active,user_status,organizations(name_en)';
const PROFILE_SELECT_LEGACY = 'id,email,full_name_en,full_name_ar,organization_id,division_id,department_id,unit_id,is_active,organizations(name_en)';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const AUTH_ROLES: readonly AuthRole[] = [
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
];
const ACCESS_SCOPES: readonly AccessScope[] = [
  'global',
  'division',
  'department',
  'unit',
  'assigned_only',
];

function emptyState(status: AuthUserState['status'], message?: string): AuthUserState {
  return {
    status,
    profile: null,
    roles: [],
    primaryRole: null,
    ...(message ? { message } : {}),
  };
}

function isAuthRole(value: unknown): value is AuthRole {
  return typeof value === 'string' && AUTH_ROLES.includes(value as AuthRole);
}

function isAccessScope(value: unknown): value is AccessScope {
  return typeof value === 'string' && ACCESS_SCOPES.includes(value as AccessScope);
}

function isRoleScopeAllowed(role: AuthRole, scope: AccessScope): boolean {
  if (['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer'].includes(role)) {
    return scope === 'global';
  }
  if (role === 'division_head') return scope === 'division';
  if (role === 'department_manager') return scope === 'department';
  return ['project_owner', 'milestone_owner', 'task_owner', 'viewer', 'employee'].includes(role)
    && scope === 'assigned_only';
}

function isKnownAuthUserStatus(value: unknown): value is AuthUserStatus {
  return typeof value === 'string' && ['active', 'inactive', 'archived', 'invited', 'locked'].includes(value);
}

function isMissingPatch19StatusColumn(error: { code?: string; message?: string; details?: string | null } | null): boolean {
  if (!error) return false;
  const text = `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return text.includes('user_status')
    && (text.includes('does not exist') || text.includes('could not find') || text.includes('schema cache') || text.includes('42703') || text.includes('pgrst204'));
}

function normalizeOptionalUuid(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === undefined || value === '') return { ok: true, value: null };
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) return { ok: false };
  return { ok: true, value: value.toLowerCase() };
}

function parseRoleAssignment(row: unknown, profileOrganizationId: string): AuthRoleAssignment | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const source = row as Record<string, unknown>;
  if (!isAuthRole(source.role) || !isAccessScope(source.scope)) return null;
  if (!isRoleScopeAllowed(source.role, source.scope)) return null;

  const organizationId = normalizeOptionalUuid(source.organization_id);
  const divisionId = normalizeOptionalUuid(source.division_id);
  const departmentId = normalizeOptionalUuid(source.department_id);
  const unitId = normalizeOptionalUuid(source.unit_id);
  if (!organizationId.ok || !divisionId.ok || !departmentId.ok || !unitId.ok) return null;
  if (source.scope === 'global') {
    if (
      (organizationId.value !== null && organizationId.value !== profileOrganizationId)
      || divisionId.value !== null
      || departmentId.value !== null
      || unitId.value !== null
    ) return null;
  } else {
    if (organizationId.value !== profileOrganizationId) return null;
    if (
      source.scope === 'division'
      && (!divisionId.value || departmentId.value !== null || unitId.value !== null)
    ) return null;
    if (source.scope === 'department' && (!departmentId.value || unitId.value !== null)) return null;
    if (source.scope === 'unit' && (!departmentId.value || !unitId.value)) return null;
    if (
      source.scope === 'assigned_only'
      && (divisionId.value !== null || departmentId.value !== null || unitId.value !== null)
    ) return null;
  }

  return {
    role: source.role,
    scope: source.scope,
    organizationId: organizationId.value,
    divisionId: divisionId.value,
    departmentId: departmentId.value,
    unitId: unitId.value,
  };
}

function localBypassState(): AuthUserState {
  return {
    status: 'authenticated_active',
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

function sessionKey(session: Session): string {
  return `${session.user.id}:${session.access_token}`;
}

function isAbortError(error: unknown): boolean {
  return (error instanceof PrivilegedActionError && error.code === 'REQUEST_ABORTED')
    || (error instanceof DOMException && error.name === 'AbortError');
}

function deploymentErrorCode(error: unknown): string {
  if (error instanceof PrivilegedActionError && error.code) return error.code;
  return 'PATCH83U_CREDENTIAL_STATE_UNAVAILABLE';
}

function loginErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error
    ? String(error.code)
    : '';
  const message = typeof error === 'object' && error && 'message' in error
    ? String(error.message)
    : '';
  if (code === 'captcha_failed' || /captcha/i.test(message)) {
    return 'CAPTCHA verification failed. Complete a fresh challenge and try again.';
  }
  return 'Sign-in failed. Check your credentials, then try again.';
}

function removePersistedSessionIfStillMatches(expectedAccessToken: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const persisted = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!persisted) return;
    const parsed = JSON.parse(persisted) as { access_token?: unknown };
    if (parsed.access_token !== expectedAccessToken) return;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`);
  } catch {
    // Never remove an unparseable or token-mismatched entry: it may belong to
    // a newer sign-in that must survive stale-request cleanup.
  }
}

function clearLocalAuthSessionIfStillMatches(expectedAccessToken: string): void {
  // auth.signOut() re-reads the shared current session under its own lock. A
  // newer cross-tab sign-in between a prior token check and that lock would be
  // signed out. Use one synchronous compare-and-remove against the configured
  // storage key instead; no password or session is restored through raw
  // storage, and a different/newer token is never touched.
  removePersistedSessionIfStillMatches(expectedAccessToken);
}

export async function clearPersistedSessionIfStillMatches(staleSession: Session): Promise<void> {
  clearLocalAuthSessionIfStillMatches(staleSession.access_token);
}

export async function readDeferredAuthSessionIfStillCurrent(
  readSession: () => Promise<Session | null>,
  isStillCurrent: () => boolean,
): Promise<
  | { status: 'current'; session: Session | null }
  | { status: 'superseded' }
> {
  const session = await readSession();
  return isStillCurrent()
    ? { status: 'current', session }
    : { status: 'superseded' };
}

async function loadProfileAuthorization(
  session: Session,
  signal: AbortSignal,
  credentialState: AuthUserState['credentialState'],
  credentialVersion: number | undefined,
): Promise<AuthUserState> {
  if (!supabase) return emptyState('configuration_error', 'Supabase is not configured.');
  const user = session.user;

  const profileQuery = supabase
    .from('profiles')
    .select(PROFILE_SELECT_WITH_PATCH19_STATUS)
    .eq('id', user.id)
    .abortSignal(signal);
  const profileResult = await profileQuery.maybeSingle();

  let profileRow = profileResult.data as Record<string, unknown> | null;
  let profileError = profileResult.error;
  let usedLegacyProfileSelect = false;
  if (isMissingPatch19StatusColumn(profileError)) {
    usedLegacyProfileSelect = true;
    const legacyQuery = supabase
      .from('profiles')
      .select(PROFILE_SELECT_LEGACY)
      .eq('id', user.id)
      .abortSignal(signal);
    const legacyResult = await legacyQuery.maybeSingle();
    profileRow = legacyResult.data as Record<string, unknown> | null;
    profileError = legacyResult.error;
  }

  if (profileError || !profileRow) {
    return {
      ...emptyState(
        'authenticated_access_denied',
        profileError
          ? 'Authorization data could not be verified. No application data has been opened.'
          : 'Signed-in user has no profile record. Ask an administrator to reconcile the account.',
      ),
      credentialState,
      credentialVersion,
    };
  }

  const profileId = typeof profileRow.id === 'string' ? profileRow.id.toLowerCase() : '';
  const organizationId = normalizeOptionalUuid(profileRow.organization_id);
  const divisionId = normalizeOptionalUuid(profileRow.division_id);
  const departmentId = normalizeOptionalUuid(profileRow.department_id);
  const unitId = normalizeOptionalUuid(profileRow.unit_id);
  if (
    profileId !== user.id.toLowerCase()
    || !organizationId.ok
    || !organizationId.value
    || !divisionId.ok
    || !departmentId.ok
    || !unitId.ok
  ) {
    return {
      ...emptyState('authenticated_access_denied', 'The user profile contains invalid authorization references.'),
      credentialState,
      credentialVersion,
    };
  }
  const profileOrganizationId = organizationId.value as string;

  if (!usedLegacyProfileSelect && !isKnownAuthUserStatus(profileRow.user_status)) {
    return {
      ...emptyState('authenticated_access_denied', 'The user profile contains an invalid lifecycle state.'),
      credentialState,
      credentialVersion,
    };
  }
  const userStatus: AuthUserStatus = usedLegacyProfileSelect
    ? 'active'
    : profileRow.user_status as AuthUserStatus;
  const profileIsActive = profileRow.is_active === true && userStatus === 'active';
  const organization = profileRow.organizations && typeof profileRow.organizations === 'object'
    ? profileRow.organizations as Record<string, unknown>
    : null;
  const profile: AuthProfile = {
    id: profileId,
    email: String(profileRow.email ?? user.email ?? ''),
    fullNameEn: String(profileRow.full_name_en ?? user.email ?? 'User'),
    fullNameAr: typeof profileRow.full_name_ar === 'string' ? profileRow.full_name_ar : null,
    organizationId: profileOrganizationId,
    organizationName: typeof organization?.name_en === 'string' ? organization.name_en : null,
    divisionId: divisionId.value,
    departmentId: departmentId.value,
    unitId: unitId.value,
    isActive: profileIsActive,
    userStatus,
  };

  if (!profileIsActive) {
    return {
      status: 'authenticated_access_denied',
      profile: null,
      roles: [],
      primaryRole: null,
      credentialState,
      credentialVersion,
      message: 'This authenticated account is not active. Ask an administrator to review its lifecycle state.',
    };
  }

  let roleQuery = supabase
    .from('user_roles')
    .select('role,scope,organization_id,division_id,department_id,unit_id,is_active')
    .eq('user_id', user.id)
    .eq('is_active', true);
  roleQuery = roleQuery.abortSignal(signal);
  const { data: roleRows, error: roleError } = await roleQuery;
  if (roleError) {
    return {
      ...emptyState('authenticated_access_denied', 'Role assignments could not be verified. No application data has been opened.'),
      credentialState,
      credentialVersion,
    };
  }

  const parsedRoles = (roleRows ?? []).map((role) => parseRoleAssignment(role, profileOrganizationId));
  if (parsedRoles.length === 0 || parsedRoles.some((role) => role === null)) {
    return {
      ...emptyState(
        'authenticated_access_denied',
        parsedRoles.length === 0
          ? 'This authenticated account has no active role assignment.'
          : 'One or more role assignments contain invalid role, scope, or reference data.',
      ),
      credentialState,
      credentialVersion,
    };
  }
  const roles = (parsedRoles as AuthRoleAssignment[])
    .sort((left, right) => AUTH_ROLES.indexOf(left.role) - AUTH_ROLES.indexOf(right.role));

  return {
    status: 'authenticated_active',
    profile,
    roles,
    primaryRole: roles[0].role,
    credentialState,
    credentialVersion,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialState = LOCAL_BYPASS_ENABLED ? localBypassState() : emptyState('initializing');
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<AuthUserState>(initialState);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const stateRef = useRef<AuthUserState>(initialState);
  const mountedRef = useRef(true);
  const currentSessionRef = useRef<Session | null>(null);
  const generationRef = useRef(0);
  const activeControllerRef = useRef<AbortController | null>(null);
  const pipelineFlightRef = useRef<InFlight<void> | null>(null);
  const capabilityFlightRef = useRef<InFlight<Awaited<ReturnType<typeof getPatch83uCapabilities>>> | null>(null);
  const credentialFlightRef = useRef<InFlight<Awaited<ReturnType<typeof getCurrentUserCredentialState>>> | null>(null);
  const retryFlightRef = useRef<Promise<void> | null>(null);
  const retryCountRef = useRef(0);
  const retryAvailableAtRef = useRef(0);
  const validatedCapabilitiesRef = useRef<Patch83uCapabilities | null>(null);
  const pendingSignInCountRef = useRef(0);
  const deferredAuthEventRef = useRef(false);
  const authEventEpochRef = useRef(0);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const postSignOutNoticeRef = useRef<string | null>(null);
  const lastFocusRevalidationRef = useRef<{ userId: string; startedAt: number } | null>(null);

  const commitState = useCallback((nextState: AuthUserState) => {
    stateRef.current = nextState;
    if (mountedRef.current) setState(nextState);
  }, []);

  const commitRevalidating = useCallback((nextValue: boolean) => {
    if (mountedRef.current) setIsRevalidating(nextValue);
  }, []);

  const abortActiveOperation = useCallback(() => {
    activeControllerRef.current?.abort();
    activeControllerRef.current = null;
    pipelineFlightRef.current = null;
    capabilityFlightRef.current = null;
    credentialFlightRef.current = null;
    commitRevalidating(false);
  }, [commitRevalidating]);

  const invalidateProviderOnUnmount = useCallback(() => {
    mountedRef.current = false;
    generationRef.current += 1;
    authEventEpochRef.current += 1;
    currentSessionRef.current = null;
    validatedCapabilitiesRef.current = null;
    deferredAuthEventRef.current = false;
    retryFlightRef.current = null;
    abortActiveOperation();
  }, [abortActiveOperation]);

  const isCurrentOperation = useCallback((
    generation: number,
    expectedSession: Session,
    controller: AbortController,
  ) => mountedRef.current
    && !controller.signal.aborted
    && generationRef.current === generation
    && currentSessionRef.current?.user.id === expectedSession.user.id
    && currentSessionRef.current?.access_token === expectedSession.access_token, []);

  const runAuthenticatedPipeline = useCallback((
    nextSession: Session,
    options: PipelineOptions = {},
  ): Promise<void> => {
    // A caller may still hold a sign-in callback while this provider is being
    // destroyed. Never perform even the synchronous session/ref writes below
    // after cleanup has invalidated the provider generation.
    if (!mountedRef.current) return Promise.resolve();

    const key = sessionKey(nextSession);
    if (pipelineFlightRef.current?.key === key) {
      return pipelineFlightRef.current.promise;
    }
    if (
      !options.force
      && currentSessionRef.current
      && sessionKey(currentSessionRef.current) === key
      && [
        'authenticated_active',
        'authenticated_password_change_required',
        'authenticated_deployment_incompatible',
        'authenticated_reconciliation_required',
        'authenticated_access_denied',
      ].includes(stateRef.current.status)
    ) {
      return Promise.resolve();
    }

    const backgroundRevalidation = options.backgroundRevalidation === true
      && stateRef.current.status === 'authenticated_active'
      && stateRef.current.profile?.id === nextSession.user.id
      && currentSessionRef.current?.user.id === nextSession.user.id;

    const generation = options.generation ?? generationRef.current + 1;
    if (options.generation !== undefined && generationRef.current !== options.generation) {
      return Promise.resolve();
    }
    generationRef.current = generation;
    abortActiveOperation();
    if (backgroundRevalidation) commitRevalidating(true);
    const controller = new AbortController();
    activeControllerRef.current = controller;
    currentSessionRef.current = nextSession;
    setSession(nextSession);
    if (!options.preserveRetry) {
      retryCountRef.current = 0;
      retryAvailableAtRef.current = 0;
    }
    if (PATCH83U_ENABLED) validatedCapabilitiesRef.current = null;

    if (!backgroundRevalidation) {
      commitState(emptyState(
        PATCH83U_ENABLED
          ? 'authenticated_checking_capabilities'
          : 'authenticated_loading_authorization',
      ));
    }

    let ownedCapabilityPromise: Promise<Awaited<ReturnType<typeof getPatch83uCapabilities>>> | null = null;
    let ownedCredentialPromise: Promise<Awaited<ReturnType<typeof getCurrentUserCredentialState>>> | null = null;
    let ownedPipelinePromise: Promise<void> | null = null;
    const promise = (async () => {
      try {
        let credentialState: AuthUserState['credentialState'] = 'legacy_unmanaged';
        let credentialVersion: number | undefined = 0;

        if (PATCH83U_ENABLED) {
          let capabilityPromise: Promise<Awaited<ReturnType<typeof getPatch83uCapabilities>>>;
          if (capabilityFlightRef.current?.key === key) {
            capabilityPromise = capabilityFlightRef.current.promise;
          } else {
            capabilityPromise = getPatch83uCapabilities({
              signal: controller.signal,
              accessToken: nextSession.access_token,
            });
            ownedCapabilityPromise = capabilityPromise;
            capabilityFlightRef.current = { key, promise: capabilityPromise };
          }
          const capabilities = await capabilityPromise;
          if (!isCurrentOperation(generation, nextSession, controller)) return;
          const compatibilityIssue = patch83uCapabilityCompatibilityIssue(capabilities);
          if (compatibilityIssue) {
            commitState({
              ...emptyState('authenticated_deployment_incompatible', PATCH83U_DEPLOYMENT_ERROR_MESSAGE),
              deploymentErrorCode: compatibilityIssue,
              compatibilityRetryCount: retryCountRef.current,
              compatibilityRetryAvailableAt: retryAvailableAtRef.current,
            });
            return;
          }
          validatedCapabilitiesRef.current = capabilities;

          if (!backgroundRevalidation) {
            commitState(emptyState('authenticated_checking_credential_state'));
          }
          let credentialPromise: Promise<Awaited<ReturnType<typeof getCurrentUserCredentialState>>>;
          if (credentialFlightRef.current?.key === key) {
            credentialPromise = credentialFlightRef.current.promise;
          } else {
            credentialPromise = getCurrentUserCredentialState({
              signal: controller.signal,
              accessToken: nextSession.access_token,
            });
            ownedCredentialPromise = credentialPromise;
            credentialFlightRef.current = { key, promise: credentialPromise };
          }
          const credential = await credentialPromise;
          if (!isCurrentOperation(generation, nextSession, controller)) return;
          credentialVersion = credential.credential_version;
          if (!patch83uRuntimeAllowsStableExistingAccess(capabilities, credential)) {
            const decision = credentialGateDecision(credential);
            if (decision.gate === 'password_change_required') {
              commitState({
                ...emptyState(
                  'authenticated_password_change_required',
                  credential.message ?? 'You must change your temporary password before accessing the application.',
                ),
                credentialState: 'password_change_required',
                credentialVersion,
                patch83uCapabilities: capabilities,
              });
              return;
            }
            if (decision.gate === 'reconciliation_required') {
              commitState({
                ...emptyState(
                  'authenticated_reconciliation_required',
                  credential.message ?? 'Credential reconciliation is required before application access.',
                ),
                credentialState: 'reconciliation_required',
                credentialVersion,
                patch83uCapabilities: capabilities,
              });
              return;
            }
            if (decision.gate === 'blocked') {
              commitState({
                ...emptyState(
                  'authenticated_access_denied',
                  credential.message ?? 'This credential is not permitted to access the application.',
                ),
                credentialState: 'blocked',
                credentialVersion,
                patch83uCapabilities: capabilities,
              });
              return;
            }
            credentialState = decision.gate === 'legacy_unmanaged' ? 'legacy_unmanaged' : 'active';
          } else {
            credentialState = 'active';
          }
        }

        if (!isCurrentOperation(generation, nextSession, controller)) return;
        if (!backgroundRevalidation) {
          commitState({
            ...emptyState('authenticated_loading_authorization'),
            credentialState,
            credentialVersion,
          });
        }
        const authorizedState = await loadProfileAuthorization(
          nextSession,
          controller.signal,
          credentialState,
          credentialVersion,
        );
        if (isCurrentOperation(generation, nextSession, controller)) {
          commitState({
            ...authorizedState,
            ...(validatedCapabilitiesRef.current
              ? { patch83uCapabilities: validatedCapabilitiesRef.current }
              : {}),
          });
        }
      } catch (error) {
        if (isAbortError(error) || !isCurrentOperation(generation, nextSession, controller)) return;
        if (PATCH83U_ENABLED) {
          commitState({
            ...emptyState('authenticated_deployment_incompatible', PATCH83U_DEPLOYMENT_ERROR_MESSAGE),
            deploymentErrorCode: deploymentErrorCode(error),
            compatibilityRetryCount: retryCountRef.current,
            compatibilityRetryAvailableAt: retryAvailableAtRef.current,
          });
        } else {
          commitState(emptyState(
            'authenticated_access_denied',
            'Authorization data could not be verified. No application data has been opened.',
          ));
        }
      } finally {
        if (ownedPipelinePromise && pipelineFlightRef.current?.promise === ownedPipelinePromise) {
          pipelineFlightRef.current = null;
        }
        if (ownedCapabilityPromise && capabilityFlightRef.current?.promise === ownedCapabilityPromise) {
          capabilityFlightRef.current = null;
        }
        if (ownedCredentialPromise && credentialFlightRef.current?.promise === ownedCredentialPromise) {
          credentialFlightRef.current = null;
        }
        if (activeControllerRef.current === controller) {
          activeControllerRef.current = null;
          if (backgroundRevalidation) commitRevalidating(false);
        }
      }
    })();

    ownedPipelinePromise = promise;
    pipelineFlightRef.current = { key, promise };
    return promise;
  }, [abortActiveOperation, commitRevalidating, commitState, isCurrentOperation]);

  const clearAuthenticatedState = useCallback((notice?: string) => {
    generationRef.current += 1;
    abortActiveOperation();
    currentSessionRef.current = null;
    validatedCapabilitiesRef.current = null;
    setSession(null);
    commitState({
      ...emptyState('unauthenticated'),
      ...(notice ? { notice } : {}),
    });
  }, [abortActiveOperation, commitState]);

  const readUsableAuthSession = useCallback(async (): Promise<Session | null> => {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.user || !isCurrentSupabaseSessionUsable(data.session)) {
        return null;
      }
      return data.session;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (LOCAL_BYPASS_ENABLED || !supabase) {
      if (!LOCAL_BYPASS_ENABLED) {
        commitState(emptyState(
          'configuration_error',
          'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
        ));
      }
      return () => {
        invalidateProviderOnUnmount();
      };
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, nextSession: Session | null) => {
      if (!mountedRef.current) return;
      authEventEpochRef.current += 1;
      if (pendingSignInCountRef.current > 0 && event !== 'SIGNED_OUT') {
        // signInWithPassword emits its own SIGNED_IN event before its promise
        // resolves. Defer non-terminal events and reconcile once the Auth call
        // and post-auth pipeline settle. SIGNED_OUT is never deferred.
        deferredAuthEventRef.current = true;
        return;
      }
      if (
        event === 'SIGNED_OUT'
        || !nextSession?.user
        || !isCurrentSupabaseSessionUsable(nextSession)
      ) {
        if (stateRef.current.status !== 'signing_out') {
          clearAuthenticatedState(postSignOutNoticeRef.current ?? undefined);
        }
        return;
      }
      if (
        event === 'TOKEN_REFRESHED'
        && currentSessionRef.current?.user.id === nextSession.user.id
        && stateRef.current.status === 'authenticated_password_change_required'
      ) {
        currentSessionRef.current = nextSession;
        setSession(nextSession);
        return;
      }
      const activeSession = currentSessionRef.current;
      const isSameActiveUser = stateRef.current.status === 'authenticated_active'
        && stateRef.current.profile?.id === nextSession.user.id
        && activeSession?.user.id === nextSession.user.id;
      void runAuthenticatedPipeline(nextSession, isSameActiveUser
        ? {
            force: true,
            preserveRetry: true,
            backgroundRevalidation: true,
          }
        : undefined);
    });

    const bootstrapGeneration = generationRef.current;
    void readUsableAuthSession().then((nextSession) => {
      if (!mountedRef.current) return;
      if (pendingSignInCountRef.current > 0 || generationRef.current !== bootstrapGeneration) return;
      if (nextSession) {
        void runAuthenticatedPipeline(nextSession);
      } else {
        clearAuthenticatedState();
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
      invalidateProviderOnUnmount();
    };
  }, [
    clearAuthenticatedState,
    commitState,
    invalidateProviderOnUnmount,
    readUsableAuthSession,
    runAuthenticatedPipeline,
  ]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined' || LOCAL_BYPASS_ENABLED) return undefined;
    const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    broadcastRef.current = channel;
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data;
      if (!message || typeof message !== 'object' || Array.isArray(message)) return;
      const row = message as Record<string, unknown>;
      if (!['credential-invalidated', 'signed-out'].includes(String(row.type))) return;
      const activeSession = currentSessionRef.current;
      const activeUserId = activeSession?.user.id;
      if (!activeUserId || row.userId !== activeUserId) return;
      const notice = 'Your credentials changed in another browser tab. Sign in again.';
      postSignOutNoticeRef.current = notice;
      clearAuthenticatedState(notice);
      if (activeSession) void clearPersistedSessionIfStillMatches(activeSession);
    };
    return () => {
      channel.close();
      if (broadcastRef.current === channel) broadcastRef.current = null;
    };
  }, [clearAuthenticatedState]);

  useEffect(() => {
    if (LOCAL_BYPASS_ENABLED || !supabase) return undefined;
    const revalidate = () => {
      if (!stateRef.current.status.startsWith('authenticated_')) return;
      const activeSession = currentSessionRef.current;
      if (!activeSession) {
        clearAuthenticatedState();
        return;
      }

      const now = Date.now();
      const lastRevalidation = lastFocusRevalidationRef.current;
      if (
        lastRevalidation?.userId === activeSession.user.id
        && now - lastRevalidation.startedAt < AUTH_BACKGROUND_REVALIDATION_COOLDOWN_MS
      ) return;

      lastFocusRevalidationRef.current = {
        userId: activeSession.user.id,
        startedAt: now,
      };
      const reconciliationGeneration = generationRef.current;
      const reconciliationEventEpoch = authEventEpochRef.current;
      void readDeferredAuthSessionIfStillCurrent(
        readUsableAuthSession,
        () => mountedRef.current
          && generationRef.current === reconciliationGeneration
          && authEventEpochRef.current === reconciliationEventEpoch,
      ).then((snapshot) => {
        if (snapshot.status !== 'current') return;
        const latestSession = snapshot.session;
        if (!latestSession) {
          clearAuthenticatedState();
          return;
        }

        const currentSession = currentSessionRef.current;
        const sameSession = currentSession?.user.id === latestSession.user.id
          && currentSession.access_token === latestSession.access_token;
        if (stateRef.current.status === 'authenticated_active' && sameSession) {
          void runAuthenticatedPipeline(latestSession, {
            force: true,
            preserveRetry: true,
            backgroundRevalidation: true,
          });
        } else if (!sameSession) {
          void runAuthenticatedPipeline(latestSession);
        }
      });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') revalidate();
    };
    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', revalidate);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [clearAuthenticatedState, readUsableAuthSession, runAuthenticatedPipeline]);

  const signIn = useCallback(async (
    email: string,
    password: string,
    captchaToken?: string | null,
  ) => {
    const captchaError = getLoginCaptchaSubmissionError(loginCaptchaConfig, captchaToken);
    if (captchaError) return { ok: false, message: captchaError };
    if (!supabase) {
      const message = 'Supabase is not configured. Login cannot continue.';
      commitState(emptyState('configuration_error', message));
      return { ok: false, message };
    }
    if (!mountedRef.current) {
      return { ok: false, message: 'The sign-in attempt was cancelled.' };
    }
    // Supabase Auth persists each successful sign-in on the shared client. Do
    // not allow overlapping password requests whose out-of-order responses
    // could overwrite storage or broadcast a stale auth event to other tabs.
    if (pendingSignInCountRef.current > 0) {
      return { ok: false, message: 'A sign-in attempt is already in progress.' };
    }

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    abortActiveOperation();
    currentSessionRef.current = null;
    validatedCapabilitiesRef.current = null;
    setSession(null);
    postSignOutNoticeRef.current = null;
    retryCountRef.current = 0;
    retryAvailableAtRef.current = 0;
    commitState(emptyState('authenticating'));
    pendingSignInCountRef.current += 1;

    try {
      const normalizedCaptchaToken = normalizeLoginCaptchaToken(captchaToken);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        ...(normalizedCaptchaToken ? { options: { captchaToken: normalizedCaptchaToken } } : {}),
      });
      if (!mountedRef.current || generationRef.current !== generation) {
        if (data.session) {
          await clearPersistedSessionIfStillMatches(data.session);
        }
        return { ok: false, message: 'The sign-in attempt was cancelled.' };
      }
      if (error) {
        const message = loginErrorMessage(error);
        commitState(emptyState('unauthenticated'));
        return { ok: false, message };
      }
      if (
        !data.session?.user
        || !data.user
        || data.session.user.id !== data.user.id
        || !isCurrentSupabaseSessionUsable(data.session)
      ) {
        const message = 'Sign-in could not establish a valid session. Try again.';
        commitState(emptyState('unauthenticated'));
        if (data.session) await clearPersistedSessionIfStillMatches(data.session);
        return { ok: false, message };
      }

      currentSessionRef.current = data.session;
      setSession(data.session);
      void supabase.auth.startAutoRefresh().catch(() => undefined);
      await runAuthenticatedPipeline(data.session, { generation });
      return { ok: true };
    } catch (error) {
      if (!mountedRef.current || generationRef.current !== generation) {
        return { ok: false, message: 'The sign-in attempt was cancelled.' };
      }
      const message = loginErrorMessage(error);
      commitState(emptyState('unauthenticated'));
      return { ok: false, message };
    } finally {
      pendingSignInCountRef.current = Math.max(0, pendingSignInCountRef.current - 1);
      if (
        mountedRef.current
        && pendingSignInCountRef.current === 0
        && deferredAuthEventRef.current
        && supabase
      ) {
        deferredAuthEventRef.current = false;
        try {
          const reconciliationEventEpoch = authEventEpochRef.current;
          const reconciliationGeneration = generationRef.current;
          const snapshot = await readDeferredAuthSessionIfStillCurrent(
            readUsableAuthSession,
            () => mountedRef.current
              && authEventEpochRef.current === reconciliationEventEpoch
              && generationRef.current === reconciliationGeneration,
          );
          if (snapshot.status === 'current') {
            const latestSession = snapshot.session;
            if (
              latestSession?.user
              && currentSessionRef.current?.access_token !== latestSession.access_token
            ) {
              await runAuthenticatedPipeline(latestSession);
            } else if (
              !latestSession
              && currentSessionRef.current
              && stateRef.current.status !== 'signing_out'
            ) {
              clearAuthenticatedState();
            }
          }
        } catch {
          // The explicit sign-in result/pipeline remains authoritative. A later
          // focus, visibility, or Auth event will retry session reconciliation.
        }
      }
    }
  }, [
    abortActiveOperation,
    clearAuthenticatedState,
    commitState,
    readUsableAuthSession,
    runAuthenticatedPipeline,
  ]);

  const signOut = useCallback(async () => {
    if (LOCAL_BYPASS_ENABLED) return;
    const activeSession = currentSessionRef.current;
    const userId = activeSession?.user.id ?? null;
    postSignOutNoticeRef.current = null;
    generationRef.current += 1;
    abortActiveOperation();
    currentSessionRef.current = null;
    validatedCapabilitiesRef.current = null;
    setSession(null);
    commitState(emptyState('signing_out'));
    if (userId) broadcastRef.current?.postMessage({ type: 'signed-out', userId });

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
    if (activeSession) await clearPersistedSessionIfStillMatches(activeSession);
    commitState(emptyState('unauthenticated'));
    if (revocationError) throw revocationError;
  }, [abortActiveOperation, commitState]);

  const completeRequiredPasswordChange = useCallback(async (
    outcome:
      | 'active'
      | 'session_revocation_review_required'
      | 'recovery_required'
      | 'unconfirmed'
      | 'password_policy_rejected_after_revocation' = 'active',
  ) => {
    const activeSession = currentSessionRef.current;
    const userId = activeSession?.user.id ?? null;
    generationRef.current += 1;
    abortActiveOperation();
    currentSessionRef.current = null;
    validatedCapabilitiesRef.current = null;
    setSession(null);
    const notice = outcome === 'password_policy_rejected_after_revocation'
      ? 'The new password was rejected by the Auth policy after the protected transition began. This browser session was closed. Sign in again with your current password and choose a different new password.'
      : outcome === 'unconfirmed'
      ? 'The password-change result could not be confirmed. This browser session was closed. Do not retry or sign in until a protected administrator reconciles the credential state.'
      : outcome === 'recovery_required'
      ? 'The password-change operation entered recovery. The old session was closed; protected administrator reconciliation is required before application access.'
      : outcome === 'session_revocation_review_required'
        ? `${PATCH83U_PASSWORD_CHANGED_NOTICE} Session revocation requires protected administrator review.`
        : PATCH83U_PASSWORD_CHANGED_NOTICE;
    postSignOutNoticeRef.current = notice;
    commitState(emptyState('signing_out'));
    if (userId) broadcastRef.current?.postMessage({ type: 'credential-invalidated', userId });
    if (activeSession) await clearPersistedSessionIfStillMatches(activeSession);
    commitState({
      ...emptyState('unauthenticated'),
      notice,
    });
  }, [abortActiveOperation, commitState]);

  const reload = useCallback(async () => {
    const reconciliationGeneration = generationRef.current;
    const reconciliationEventEpoch = authEventEpochRef.current;
    const snapshot = await readDeferredAuthSessionIfStillCurrent(
      readUsableAuthSession,
      () => mountedRef.current
        && generationRef.current === reconciliationGeneration
        && authEventEpochRef.current === reconciliationEventEpoch,
    );
    if (snapshot.status !== 'current') return;
    if (!snapshot.session) {
      clearAuthenticatedState();
      return;
    }
    await runAuthenticatedPipeline(snapshot.session, { force: true, preserveRetry: true });
  }, [clearAuthenticatedState, readUsableAuthSession, runAuthenticatedPipeline]);

  const retryCompatibility = useCallback((): Promise<void> => {
    if (retryFlightRef.current) return retryFlightRef.current;
    if (stateRef.current.status !== 'authenticated_deployment_incompatible') return Promise.resolve();
    const activeSession = currentSessionRef.current;
    if (!activeSession) return Promise.resolve();
    if (
      retryCountRef.current >= PATCH83U_COMPATIBILITY_RETRY_LIMIT
      || Date.now() < retryAvailableAtRef.current
    ) {
      return Promise.resolve();
    }

    retryCountRef.current += 1;
    retryAvailableAtRef.current = Date.now() + PATCH83U_COMPATIBILITY_RETRY_COOLDOWN_MS;
    const promise = runAuthenticatedPipeline(activeSession, { force: true, preserveRetry: true })
      .finally(() => {
        if (retryFlightRef.current === promise) retryFlightRef.current = null;
      });
    retryFlightRef.current = promise;
    return promise;
  }, [runAuthenticatedPipeline]);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    session,
    isRevalidating,
    signIn,
    signOut,
    reload,
    retryCompatibility,
    completeRequiredPasswordChange,
  }), [
    state,
    session,
    isRevalidating,
    signIn,
    signOut,
    reload,
    retryCompatibility,
    completeRequiredPasswordChange,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
