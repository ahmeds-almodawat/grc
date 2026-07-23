import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('Patch 83U frontend authentication contract', () => {
  it('preserves Employee ID normalization and never carries the login password to forced change', () => {
    const login = source('src/pages/LoginPage.tsx');
    const forced = source('src/pages/ForcedPasswordChange.tsx');
    expect(login).toMatch(/trim\(\)[\s\S]*includes\(['"]@['"]\)[\s\S]*toLowerCase\(\)/);
    expect(login).toContain('@almodawat.sa');
    expect(forced).toContain("useState('')");
    expect(forced).not.toMatch(/loginPassword|sessionStorage|localStorage/);
  });

  it('routes every authenticated gate before the protected Layout', () => {
    const app = source('src/App.tsx');
    const layout = app.indexOf('<Layout page=');
    for (const status of [
      'authenticated_password_change_required',
      'authenticated_deployment_incompatible',
      'authenticated_reconciliation_required',
      'authenticated_access_denied',
    ]) {
      expect(app.indexOf(status)).toBeGreaterThan(-1);
      expect(app.indexOf(status)).toBeLessThan(layout);
    }
    expect(app).toContain('auth.status !== "authenticated_active"');
  });

  it('orders capability, credential, profile, and roles and exposes explicit states', () => {
    const provider = source('src/auth/AuthProvider.tsx');
    const capability = provider.indexOf('getPatch83uCapabilities({');
    const credential = provider.indexOf('getCurrentUserCredentialState({', capability);
    const stableRuntimeAccess = provider.indexOf('patch83uRuntimeAllowsStableExistingAccess(', credential);
    const profile = provider.indexOf(".from('profiles')");
    const roles = provider.indexOf(".from('user_roles')");
    expect(capability).toBeGreaterThan(-1);
    expect(credential).toBeGreaterThan(capability);
    expect(stableRuntimeAccess).toBeGreaterThan(credential);
    expect(provider.indexOf('credentialGateDecision(credential)', stableRuntimeAccess)).toBeGreaterThan(stableRuntimeAccess);
    // Profile loader is declared separately, but it is invoked only after the
    // capability/credential decisions in the pipeline.
    expect(provider.indexOf('loadProfileAuthorization(', credential)).toBeGreaterThan(credential);
    expect(profile).toBeGreaterThan(-1);
    expect(roles).toBeGreaterThan(profile);
    for (const status of [
      'authenticating',
      'authenticated_checking_capabilities',
      'authenticated_checking_credential_state',
      'authenticated_password_change_required',
      'authenticated_active',
      'authenticated_deployment_incompatible',
      'authenticated_reconciliation_required',
      'signing_out',
    ]) expect(provider).toContain(status);
  });

  it('keeps deployment failures authenticated and contains race protections', () => {
    const provider = source('src/auth/AuthProvider.tsx');
    const deploymentBlock = provider.split("'authenticated_deployment_incompatible'")[1] ?? '';
    expect(deploymentBlock).not.toMatch(/signOut\(\{ scope: 'global' \}\)/);
    expect(provider).toContain('generationRef');
    expect(provider).toContain('AbortController');
    expect(provider).toContain('capabilityFlightRef');
    expect(provider).toContain('credentialFlightRef');
    expect(provider).toContain('BroadcastChannel');
    expect(provider).toContain('currentSessionRef.current?.access_token === expectedSession.access_token');
    expect(provider).toContain('pendingSignInCountRef.current > 0 || generationRef.current !== bootstrapGeneration');
    expect(provider).toContain('readUsableAuthSession');
    expect(provider).toContain('isCurrentSupabaseSessionUsable(nextSession)');
    expect(provider).toMatch(/postSignOutNoticeRef\.current = notice;[\s\S]*clearAuthenticatedState\(notice\)/);
    const staleCleanup = provider.split('function clearLocalAuthSessionIfStillMatches')[1]
      ?.split('export async function clearPersistedSessionIfStillMatches')[0] ?? '';
    expect(staleCleanup).toContain('removePersistedSessionIfStillMatches(expectedAccessToken)');
    expect(staleCleanup).not.toContain('.auth.signOut');
    expect(staleCleanup).not.toContain('.auth.getSession');
    expect(provider).toMatch(/generationRef\.current !== generation[\s\S]*clearPersistedSessionIfStillMatches\(data\.session\)/);
    const overlapGuard = provider.indexOf('if (pendingSignInCountRef.current > 0)');
    const passwordAuth = provider.indexOf('supabase.auth.signInWithPassword({', overlapGuard);
    expect(overlapGuard).toBeGreaterThan(-1);
    expect(passwordAuth).toBeGreaterThan(overlapGuard);
    expect(provider).toContain('A sign-in attempt is already in progress.');
    expect(provider).not.toContain('restorePersistedSessionIfAbsent');
    expect(provider).toContain("pendingSignInCountRef.current > 0 && event !== 'SIGNED_OUT'");
    expect(provider).toContain('deferredAuthEventRef.current = true');
    expect(provider).toMatch(/pendingSignInCountRef\.current === 0[\s\S]*deferredAuthEventRef\.current[\s\S]*readUsableAuthSession[\s\S]*runAuthenticatedPipeline\(latestSession\)/);
    expect(provider).toContain('profileRow.is_active === true');
    expect(provider).toContain("userStatus === 'active'");
  });

  it('uses exact feature, capability, CAPTCHA, request-ID, and completion contracts', () => {
    const flags = source('src/config/featureFlags.ts');
    const api = source('src/lib/userCredentialApi.ts');
    const forced = source('src/pages/ForcedPasswordChange.tsx');
    expect(flags).toContain('VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED');
    expect(flags).toContain('return value === "true"');
    expect(api).toContain("'patch83u_get_capabilities'");
    expect(api).toContain('frontend_contract_version: PATCH83U_FRONTEND_CONTRACT_VERSION');
    expect(api).toContain('captcha_token: captchaToken');
    expect(api).toContain('request_id: requestId');
    expect(forced).toContain('requestIdRef');
    expect(forced).toContain('passwordChangeFailureDisposition(changeError)');
    expect(api).toContain("'PRIVILEGED_ACTION_TRANSPORT_ERROR'");
    expect(api).toContain("'PATCH83U_PASSWORD_CHANGE_BEGIN_FAILED'");
    expect(api).toContain("'PATCH83U_PASSWORD_CHANGE_FINALIZE_FAILED'");
    expect(api).toContain("'PATCH83U_PASSWORD_CHANGE_FAILED'");
    expect(forced).toContain("failureDisposition !== 'retry_in_current_session'");
    expect(forced).toContain("'password_policy_rejected_after_revocation'");
    expect(forced).toContain(": 'unconfirmed'");
    expect(api).toContain("'PATCH83U_PASSWORD_CHANGE_RESULT_INVALID'");
    expect(forced).toContain('TurnstileCaptcha');
    expect(forced).toContain('completeRequiredPasswordChange');
  });

  it('adds the frontend contract only at protected data boundaries, not Auth', () => {
    const client = source('src/lib/supabase.ts');
    const protectedBoundary = client.indexOf('const isProtectedDataBoundary');
    const headerWrite = client.indexOf("headers.set('x-patch83u-frontend-contract-version'", protectedBoundary);
    expect(protectedBoundary).toBeGreaterThan(-1);
    expect(client.slice(protectedBoundary, headerWrite)).toContain("pathname.startsWith('/rest/v1/')");
    expect(client.slice(protectedBoundary, headerWrite)).toContain("pathname.startsWith('/storage/v1/')");
    expect(client.slice(protectedBoundary, headerWrite)).not.toContain('/auth/v1');
    expect(client.indexOf('if (!isProtectedDataBoundary) return globalThis.fetch', protectedBoundary))
      .toBeLessThan(headerWrite);
    expect(client).toContain('detectSessionInUrl: false');
    expect(client).toContain('storageKey: supabaseAuthStorageKey');
    expect(client).toContain('storage: authStorage');
  });

  it('requires a live session for authenticated screens while preserving fail-closed profile denial', () => {
    const app = source('src/App.tsx');
    const provider = source('src/auth/AuthProvider.tsx');
    expect(app).toContain('auth.status.startsWith("authenticated_") && !auth.session?.user');
    expect(provider).toContain("'authenticated_access_denied'");
    expect(provider).toContain('Signed-in user has no profile record.');
  });

  it('preserves the validated frontend contract across global-search caller-JWT RLS', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const incomingContractCheck = edge.indexOf(
      'frontendContractHeader !== PATCH83U_FRONTEND_CONTRACT_VERSION',
    );
    const searchStart = edge.indexOf("if (action === 'search_grc_global')");
    const searchEnd = edge.indexOf("if (action === 'patch83t_user_import_identity_references')", searchStart);
    const searchBlock = edge.slice(searchStart, searchEnd);

    expect(incomingContractCheck).toBeGreaterThan(-1);
    expect(searchStart).toBeGreaterThan(incomingContractCheck);
    expect(searchBlock).toContain('Authorization: `Bearer ${token}`');
    expect(searchBlock).toContain(
      "'x-patch83u-frontend-contract-version': PATCH83U_FRONTEND_CONTRACT_VERSION",
    );
    expect(searchBlock).toContain("rlsClient.rpc('search_grc_global'");
  });
});
