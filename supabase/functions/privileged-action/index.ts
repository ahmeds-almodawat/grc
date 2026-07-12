import { createClient } from 'npm:@supabase/supabase-js@2.108.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const patch22RiskActions = new Set([
  'update_risk_assessment',
  'request_risk_acceptance',
  'approve_risk_acceptance',
  'reject_risk_acceptance',
  'update_risk_treatment',
  'complete_risk_treatment',
  'request_risk_closure',
  'approve_risk_closure',
  'reopen_risk_with_reason',
  'link_risk_source',
  'mark_duplicate_risk',
]);

const patch23EvidenceActions = new Set([
  'create_evidence_requirement',
  'link_evidence_to_item',
  'submit_evidence_for_review',
  'accept_evidence',
  'reject_evidence',
  'request_evidence_revision',
  'supersede_evidence',
  'lock_evidence',
  'request_evidence_gate_waiver',
  'approve_evidence_gate_waiver',
  'reject_evidence_gate_waiver',
  'check_evidence_gate_status',
  'generate_evidence_pack_index',
]);

const patch24AuditActions = new Set([
  'issue_audit_finding',
  'submit_management_response',
  'accept_management_response',
  'reject_management_response',
  'submit_corrective_action_plan',
  'accept_corrective_action_plan',
  'reject_corrective_action_plan',
  'request_audit_finding_extension',
  'approve_audit_finding_extension',
  'reject_audit_finding_extension',
  'request_audit_finding_closure',
  'validate_audit_finding_closure',
  'reject_audit_finding_closure',
  'reopen_audit_finding_with_reason',
  'escalate_audit_finding',
  'mark_repeat_audit_finding',
  'link_audit_finding_to_risk',
  'link_audit_finding_to_compliance',
  'generate_audit_closure_pack_index',
]);

const patch68EvidenceClosureActions = new Set([
  'record_production_evidence_closure_action',
  'get_production_evidence_closure_action_history',
]);

const patch76CutoverDecisionActions = new Set([
  'create_controlled_production_cutover_decision',
  'record_controlled_production_cutover_decision_event',
]);

const patch77LivePilotActions = new Set([
  'create_live_pilot_session',
  'update_live_pilot_session_status',
  'create_live_pilot_issue',
  'update_live_pilot_issue_status',
  'record_live_pilot_department_acceptance',
]);

const patch78IdentityIntegrityActions = new Set([
  'create_identity_role_integrity_review',
  'update_identity_role_integrity_review_status',
  'record_identity_role_integrity_finding',
  'update_identity_role_integrity_finding_status',
  'record_privileged_role_recertification',
]);

const patch79OperationsGovernanceActions = new Set([
  'create_production_hypercare_window',
  'update_production_hypercare_window_status',
  'record_production_hypercare_item',
  'update_production_hypercare_item_status',
  'create_executive_governance_board_pack',
  'update_executive_governance_board_pack_status',
]);

const patch83mDepartmentImportActions = new Set([
  'department_import_execute',
]);

const patch83q1ProductionReadinessActions = new Set([
  'create_pilot_go_no_go_review',
  'update_pilot_go_no_go_review_status',
  'record_pilot_go_no_go_event',
  'record_executive_production_signoff',
]);

const patch83rDepartmentLifecycleActions = new Set([
  'department_lifecycle_preview',
  'department_lifecycle_rename',
  'department_lifecycle_archive',
  'department_lifecycle_restore',
]);

const allowedActions = new Set([
  'list_user_management_roster',
  'create_board_pack_snapshot',
  'acknowledge_escalation_event',
  'resolve_escalation_event',
  'assign_user_role',
  'deactivate_user_role',
  'create_department',
  'create_user',
  'update_ovr_workflow',
  'create_ovr_corrective_action_project',
  'v99_create_scenario',
  'v99_cleanup_scenarios',
  'v99_scenario_status',
  'patch19_update_user_profile',
  'patch19_update_user_department',
  'patch19_assign_user_role',
  'patch19_deactivate_user',
  'patch19_reactivate_user',
  'patch19_archive_user',
  'patch19_unarchive_user',
  'patch19_apply_import_batch',
  ...patch22RiskActions,
  ...patch23EvidenceActions,
  ...patch24AuditActions,
  ...patch68EvidenceClosureActions,
  ...patch76CutoverDecisionActions,
  ...patch77LivePilotActions,
  ...patch78IdentityIntegrityActions,
  ...patch79OperationsGovernanceActions,
  ...patch83q1ProductionReadinessActions,
  ...patch83rDepartmentLifecycleActions,
]);

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(
  error: string,
  status: number,
  code: string,
  detail: string,
  extra: Record<string, unknown> = {},
) {
  return jsonResponse({
    ok: false,
    error,
    code,
    detail,
    ...extra,
  }, status);
}

const userRoleOptions = new Set([
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
]);

const userTypeOptions = new Set(['employee', 'contractor', 'vendor', 'external_auditor', 'service_account']);
const accessScopeOptions = new Set(['global', 'division', 'department', 'unit', 'assigned_only']);

function safeString(value: unknown, fallback = '') {
  return value === null || value === undefined ? fallback : String(value);
}

function normalizeRole(value: unknown) {
  const role = String(value ?? 'employee');
  return userRoleOptions.has(role) ? role : 'employee';
}

function normalizeScope(value: unknown) {
  const scope = String(value ?? 'assigned_only');
  return accessScopeOptions.has(scope) ? scope : 'assigned_only';
}

function normalizeUserType(value: unknown) {
  const userType = String(value ?? 'employee');
  return userTypeOptions.has(userType) ? userType : 'employee';
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pilotReviewStatuses = new Set([
  'draft',
  'ready_for_review',
  'approved_for_controlled_pilot',
  'approved_with_limitations',
  'blocked',
  'rejected',
]);
const pilotEventTypePattern = /^[a-z][a-z0-9_]{1,63}$/;

async function authorizePatch83q1Actor(
  serviceClient: any,
  actorId: string,
  allowedRoles: string[],
) {
  const { data: actorProfile, error: actorProfileError } = await serviceClient
    .from('profiles')
    .select('organization_id,is_active')
    .eq('id', actorId)
    .maybeSingle();
  if (actorProfileError) throw new Error('PATCH83Q1_ACTOR_PROFILE_LOOKUP_FAILED');
  if (!actorProfile?.organization_id || actorProfile.is_active === false) return false;

  const { data: actorRoles, error: actorRolesError } = await serviceClient
    .from('user_roles')
    .select('role,organization_id')
    .eq('user_id', actorId)
    .eq('is_active', true);
  if (actorRolesError) throw new Error('PATCH83Q1_ACTOR_ROLE_LOOKUP_FAILED');

  return (actorRoles ?? []).some((assignment: any) =>
    allowedRoles.includes(String(assignment.role))
    && (
      assignment.organization_id === null
      || assignment.organization_id === actorProfile.organization_id
    )
  );
}

async function authorizePatch83rActor(serviceClient: any, actorId: string): Promise<string | null> {
  const { data: actorProfile, error: actorProfileError } = await serviceClient
    .from('profiles')
    .select('organization_id,is_active,user_status')
    .eq('id', actorId)
    .maybeSingle();
  if (actorProfileError) throw new Error('PATCH83R_ACTOR_PROFILE_LOOKUP_FAILED');
  if (
    !actorProfile?.organization_id
    || actorProfile.is_active === false
    || (actorProfile.user_status && actorProfile.user_status !== 'active')
  ) return null;

  const { data: actorRoles, error: actorRolesError } = await serviceClient
    .from('user_roles')
    .select('role,scope,organization_id')
    .eq('user_id', actorId)
    .eq('is_active', true);
  if (actorRolesError) throw new Error('PATCH83R_ACTOR_ROLE_LOOKUP_FAILED');

  const authorized = (actorRoles ?? []).some((assignment: any) =>
    ['super_admin', 'governance_admin'].includes(String(assignment.role))
    && assignment.scope === 'global'
    && (
      assignment.organization_id === null
      || assignment.organization_id === actorProfile.organization_id
    )
  );
  return authorized ? String(actorProfile.organization_id) : null;
}

function normalizedDepartmentValue(value: unknown) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
    : '';
}

async function readUserManagementRoster(serviceClient: any, actorId: string) {
  const { data: actorProfile, error: actorProfileError } = await serviceClient
    .from('profiles')
    .select('id,organization_id,is_active')
    .eq('id', actorId)
    .maybeSingle();
  if (actorProfileError || !actorProfile?.is_active || !actorProfile.organization_id) {
    throw new Error('USER_MANAGEMENT_ACTIVE_ACTOR_REQUIRED');
  }

  const { data: actorRoles, error: actorRolesError } = await serviceClient
    .from('user_roles')
    .select('role,organization_id,is_active')
    .eq('user_id', actorId)
    .eq('is_active', true);
  if (actorRolesError) throw new Error(actorRolesError.message);

  const authorized = (actorRoles ?? []).some((assignment: any) =>
    ['super_admin', 'governance_admin'].includes(String(assignment.role))
    && (
      assignment.organization_id === null
      || assignment.organization_id === actorProfile.organization_id
    )
  );
  if (!authorized) throw new Error('USER_MANAGEMENT_ADMIN_REQUIRED');

  const patch19Select = 'id,organization_id,employee_no,full_name_en,full_name_ar,email,phone,job_title,division_id,department_id,unit_id,is_active,created_at,updated_at,user_status,user_type,last_login_at,last_reviewed_at,deactivated_at,deactivated_by,deactivation_reason';
  const legacySelect = 'id,organization_id,employee_no,full_name_en,full_name_ar,email,phone,job_title,division_id,department_id,unit_id,is_active,created_at,updated_at';
  let profileResult = await serviceClient
    .from('profiles')
    .select(patch19Select)
    .eq('organization_id', actorProfile.organization_id)
    .order('full_name_en', { ascending: true })
    .limit(5000);

  if (profileResult.error) {
    profileResult = await serviceClient
      .from('profiles')
      .select(legacySelect)
      .eq('organization_id', actorProfile.organization_id)
      .order('full_name_en', { ascending: true })
      .limit(5000);
  }
  if (profileResult.error) throw new Error(profileResult.error.message);

  const profiles = profileResult.data ?? [];
  const userIds = profiles.map((profile: any) => safeString(profile.id)).filter(Boolean);
  const [departmentResult, divisionResult, unitResult, roleResult] = await Promise.all([
    serviceClient.from('departments').select('id,code,name_en,name_ar').eq('organization_id', actorProfile.organization_id).limit(5000),
    serviceClient.from('divisions').select('id,name_en').eq('organization_id', actorProfile.organization_id).limit(5000),
    serviceClient.from('units').select('id,name_en').eq('organization_id', actorProfile.organization_id).limit(5000),
    userIds.length
      ? serviceClient
        .from('user_roles')
        .select('id,user_id,role,scope,organization_id,department_id,is_active,assigned_at')
        .or(`organization_id.is.null,organization_id.eq.${actorProfile.organization_id}`)
        .limit(20000)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (departmentResult.error) throw new Error(departmentResult.error.message);
  if (divisionResult.error) throw new Error(divisionResult.error.message);
  if (unitResult.error) throw new Error(unitResult.error.message);
  if (roleResult.error) throw new Error(roleResult.error.message);

  const departments = new Map((departmentResult.data ?? []).map((row: any) => [row.id, row]));
  const divisions = new Map((divisionResult.data ?? []).map((row: any) => [row.id, row]));
  const units = new Map((unitResult.data ?? []).map((row: any) => [row.id, row]));
  const rolesByUser = new Map<string, any[]>();
  const visibleUserIds = new Set(userIds);
  for (const row of roleResult.data ?? []) {
    const userId = safeString(row.user_id);
    if (!visibleUserIds.has(userId)) continue;
    const role = {
      user_role_id: safeString(row.id),
      role: normalizeRole(row.role),
      scope: normalizeScope(row.scope),
      organization_id: row.organization_id ?? null,
      department_id: row.department_id ?? null,
      is_active: row.is_active !== false,
      assigned_at: row.assigned_at ?? null,
    };
    rolesByUser.set(userId, [...(rolesByUser.get(userId) ?? []), role]);
  }

  return profiles.map((profile: any) => {
    const userId = safeString(profile.id);
    const roles = rolesByUser.get(userId) ?? [];
    const roleDepartmentId = roles.find((role: any) => role.is_active && role.department_id)?.department_id ?? null;
    const resolvedDepartmentId = profile.department_id ?? roleDepartmentId;
    const department = resolvedDepartmentId ? departments.get(resolvedDepartmentId) as any | undefined : undefined;
    const division = profile.division_id ? divisions.get(profile.division_id) as any | undefined : undefined;
    const unit = profile.unit_id ? units.get(profile.unit_id) as any | undefined : undefined;
    const active = profile.is_active !== false;
    const userStatus = typeof profile.user_status === 'string'
      ? profile.user_status
      : active ? 'active' : 'inactive';

    return {
      organization_id: profile.organization_id ?? null,
      user_id: userId,
      employee_no: profile.employee_no ?? null,
      full_name_en: safeString(profile.full_name_en, profile.email ?? 'User'),
      full_name_ar: profile.full_name_ar ?? null,
      email: safeString(profile.email),
      phone: profile.phone ?? null,
      job_title: profile.job_title ?? null,
      user_type: normalizeUserType(profile.user_type),
      user_status: userStatus,
      is_active: active,
      created_at: profile.created_at ?? new Date(0).toISOString(),
      updated_at: profile.updated_at ?? null,
      last_login_at: profile.last_login_at ?? null,
      last_reviewed_at: profile.last_reviewed_at ?? null,
      deactivated_at: profile.deactivated_at ?? null,
      deactivated_by: profile.deactivated_by ?? null,
      deactivation_reason: profile.deactivation_reason ?? null,
      division_id: profile.division_id ?? null,
      division_name: division?.name_en ?? null,
      department_id: resolvedDepartmentId ?? null,
      department_code: department?.code ?? null,
      department_name: department?.name_en ?? null,
      department_name_ar: department?.name_ar ?? null,
      unit_id: profile.unit_id ?? null,
      unit_name: unit?.name_en ?? null,
      active_role_count: roles.filter((role: any) => role.is_active).length,
      roles,
      linked_project_count: 0,
      linked_task_count: 0,
      linked_approval_count: 0,
      linked_evidence_count: 0,
      open_project_count: 0,
      open_task_count: 0,
      pending_approval_count: 0,
    };
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return errorResponse(
      'Method not allowed.',
      405,
      'METHOD_NOT_ALLOWED',
      'Privileged actions only accept POST requests.',
    );
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return errorResponse(
      'Authenticated user token required.',
      401,
      'AUTH_TOKEN_REQUIRED',
      'Send a valid Authorization Bearer token from the signed-in Supabase session.',
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return errorResponse(
      'Edge Function environment is incomplete.',
      500,
      'EDGE_ENV_INCOMPLETE',
      'Required server-side Supabase environment variables are not configured.',
    );
  }

  let requestBody: { action?: string; payload?: Record<string, unknown> };
  try {
    requestBody = await request.json();
  } catch {
    return errorResponse(
      'A JSON request body is required.',
      400,
      'JSON_BODY_REQUIRED',
      'Send a JSON body containing the privileged action name and payload.',
    );
  }

  const action = requestBody.action ?? '';
  if (
    !allowedActions.has(action) &&
    !patch83mDepartmentImportActions.has(action)
  ) {
    return errorResponse(
      `Unsupported privileged action: ${action}`,
      400,
      'UNSUPPORTED_PRIVILEGED_ACTION',
      'The requested privileged action is not registered on this server bridge.',
      { action },
    );
  }

  const token = authorization.slice('Bearer '.length);
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    return errorResponse(
      'Invalid or expired authenticated user token.',
      401,
      'AUTH_TOKEN_INVALID',
      'Supabase Auth could not validate the caller session token.',
    );
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === 'list_user_management_roster') {
    try {
      const roster = await readUserManagementRoster(serviceClient, userData.user.id);
      return jsonResponse({ ok: true, action, result: roster }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load user management roster.';
      return jsonResponse({
        ok: false,
        error: message,
        action,
      }, /REQUIRED|NOT_AUTHORIZED|DENIED/i.test(message) ? 403 : 409);
    }
  }

  if (action.startsWith('v99_')) {
    const localRuntime = /(^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$)|(^https?:\/\/kong(:\d+)?$)/i
      .test(supabaseUrl);
    const controlledPilotEnabled = Deno.env.get('V99_SCENARIO_LAB_ENABLED') === 'true';
    if (!localRuntime && !controlledPilotEnabled) {
      return jsonResponse({
        ok: false,
        error: 'Scenario Lab is disabled outside local development or an explicitly enabled controlled pilot.',
        action,
      }, 403);
    }

    const confirmation = String(requestBody.payload?.test_dataset_tag ?? '');
    if (confirmation !== 'V99_SCENARIO_LAB') {
      return jsonResponse({
        ok: false,
        error: 'Exact V99_SCENARIO_LAB dataset confirmation is required.',
        action,
      }, 400);
    }

    const rpcName = action === 'v99_create_scenario'
      ? 'v99_create_scenario'
      : action === 'v99_cleanup_scenarios'
        ? 'v99_cleanup_scenarios'
        : 'v99_scenario_status';
    const rpcArgs = action === 'v99_create_scenario'
      ? {
          p_actor_id: userData.user.id,
          p_scenario: requestBody.payload?.scenario,
          p_confirmation: confirmation,
        }
      : {
          p_actor_id: userData.user.id,
          p_confirmation: confirmation,
        };
    const { data, error } = await serviceClient.rpc(rpcName, rpcArgs);

    if (error) {
      const authorizationFailure =
        /SERVICE_ROLE|ADMIN_REQUIRED|ACTIVE_ACTOR|ORGANIZATION_MISMATCH|CONFIRMATION_REQUIRED/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (action.startsWith('patch19_')) {
    const { data, error } = await serviceClient.rpc('patch19_user_management_bridge', {
      p_actor_id: userData.user.id,
      p_action: action,
      p_payload: requestBody.payload ?? {},
    });

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|CROSS_ORG|ADMIN|LAST_SUPER_ADMIN|SELF_DEACTIVATION/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch22RiskActions.has(action)) {
    const { data, error } = await serviceClient.rpc('patch22_risk_workflow_bridge', {
      p_actor_id: userData.user.id,
      p_action: action,
      p_payload: requestBody.payload ?? {},
    });

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|CROSS_ORGANIZATION|APPROVER|RANGE|REASON|EXPIRY|BLOCKED/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch23EvidenceActions.has(action)) {
    const { data, error } = await serviceClient.rpc('patch23_evidence_governance_bridge', {
      p_actor_id: userData.user.id,
      p_action: action,
      p_payload: requestBody.payload ?? {},
    });

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|CROSS_ORGANIZATION|REVIEWER|ADMIN|LOCKED|CLASSIFICATION|WAIVER/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch24AuditActions.has(action)) {
    const { data, error } = await serviceClient.rpc('patch24_audit_finding_workflow_bridge', {
      p_actor_id: userData.user.id,
      p_action: action,
      p_payload: requestBody.payload ?? {},
    });

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|CROSS_ORGANIZATION|REVIEWER|VALIDATOR|APPROVER|ADMIN|BLOCKED|EVIDENCE|WAIVER|REASON/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch68EvidenceClosureActions.has(action)) {
    const rpcName = action;
    const rpcArgs = action === 'record_production_evidence_closure_action'
      ? {
          p_actor_id: userData.user.id,
          p_evidence_id: requestBody.payload?.evidence_id,
          p_action_type: requestBody.payload?.action_type,
          p_action_reason: requestBody.payload?.action_reason ?? null,
          p_action_note: requestBody.payload?.action_note ?? null,
          p_previous_state: requestBody.payload?.previous_state ?? null,
          p_has_blocker: Boolean(requestBody.payload?.has_blocker),
          p_metadata: requestBody.payload?.metadata ?? {},
        }
      : {
          p_actor_id: userData.user.id,
          p_evidence_id: requestBody.payload?.evidence_id,
        };
    const { data, error } = await serviceClient.rpc(rpcName, rpcArgs);

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|ORGANIZATION|ROLE|REASON|BLOCKER|AUTHORIZED/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch76CutoverDecisionActions.has(action)) {
    const rpcName = action;
    const rpcArgs = action === 'create_controlled_production_cutover_decision'
      ? {
          p_actor_id: userData.user.id,
          p_decision_state: requestBody.payload?.decision_state,
          p_decision_title: requestBody.payload?.decision_title,
          p_decision_summary: requestBody.payload?.decision_summary ?? null,
          p_critical_blockers_count: requestBody.payload?.critical_blockers_count ?? 0,
          p_limitations_count: requestBody.payload?.limitations_count ?? 0,
          p_limitations_reviewed: Boolean(requestBody.payload?.limitations_reviewed),
          p_cutover_checklist_complete: Boolean(requestBody.payload?.cutover_checklist_complete),
          p_evidence_gate_snapshot: requestBody.payload?.evidence_gate_snapshot ?? {},
          p_decision_rationale: requestBody.payload?.decision_rationale,
        }
      : {
          p_actor_id: userData.user.id,
          p_decision_id: requestBody.payload?.decision_id,
          p_event_type: requestBody.payload?.event_type,
          p_event_summary: requestBody.payload?.event_summary,
          p_event_payload: requestBody.payload?.event_payload ?? {},
        };
    const { data, error } = await serviceClient.rpc(rpcName, rpcArgs);

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|ORGANIZATION|ROLE|AUTHORIZED|BLOCKERS|CHECKLIST|LIMITATION|RATIONALE/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch77LivePilotActions.has(action)) {
    const rpcName = action;
    const payload = requestBody.payload ?? {};
    const rpcArgs = action === 'create_live_pilot_session'
      ? {
          p_actor_id: userData.user.id,
          p_session_title: payload.session_title,
          p_department_id: payload.department_id ?? null,
          p_participant_count: payload.participant_count ?? 0,
        }
      : action === 'update_live_pilot_session_status'
        ? {
            p_actor_id: userData.user.id,
            p_session_id: payload.session_id,
            p_session_status: payload.session_status,
            p_exit_review_notes: payload.exit_review_notes ?? null,
            p_exit_criteria_met: Boolean(payload.exit_criteria_met),
          }
        : action === 'create_live_pilot_issue'
          ? {
              p_actor_id: userData.user.id,
              p_pilot_session_id: payload.pilot_session_id,
              p_issue_title: payload.issue_title,
              p_issue_description: payload.issue_description ?? null,
              p_severity: payload.severity ?? 'medium',
              p_owner_id: payload.owner_id ?? null,
              p_department_id: payload.department_id ?? null,
              p_due_date: payload.due_date ?? null,
              p_retest_required: payload.retest_required ?? true,
            }
          : action === 'update_live_pilot_issue_status'
            ? {
                p_actor_id: userData.user.id,
                p_issue_id: payload.issue_id,
                p_issue_status: payload.issue_status,
                p_retest_status: payload.retest_status ?? null,
                p_retest_evidence_summary: payload.retest_evidence_summary ?? null,
                p_closure_summary: payload.closure_summary ?? null,
              }
            : {
                p_actor_id: userData.user.id,
                p_pilot_session_id: payload.pilot_session_id,
                p_department_id: payload.department_id,
                p_acceptance_status: payload.acceptance_status,
                p_acceptance_notes: payload.acceptance_notes ?? null,
                p_open_blockers_count: payload.open_blockers_count ?? 0,
                p_training_confirmed: Boolean(payload.training_confirmed),
                p_issue_burndown_confirmed: Boolean(payload.issue_burndown_confirmed),
              };
    const { data, error } = await serviceClient.rpc(rpcName, rpcArgs);

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|ORGANIZATION|ROLE|AUTHORIZED|RETEST|BLOCKERS|TRAINING|BURN-DOWN|CRITERIA|ACCEPTANCE/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch78IdentityIntegrityActions.has(action)) {
    const rpcName = action;
    const payload = requestBody.payload ?? {};
    const rpcArgs = action === 'create_identity_role_integrity_review'
      ? {
          p_actor_id: userData.user.id,
          p_review_title: payload.review_title,
          p_review_notes: payload.review_notes ?? null,
          p_sso_mfa_readiness_status: payload.sso_mfa_readiness_status ?? 'review_required',
          p_access_export_status: payload.access_export_status ?? 'not_ready',
        }
      : action === 'update_identity_role_integrity_review_status'
        ? {
            p_actor_id: userData.user.id,
            p_review_id: payload.review_id,
            p_review_status: payload.review_status,
            p_review_notes: payload.review_notes ?? null,
            p_sso_mfa_readiness_status: payload.sso_mfa_readiness_status ?? null,
            p_access_export_status: payload.access_export_status ?? null,
          }
        : action === 'record_identity_role_integrity_finding'
          ? {
              p_actor_id: userData.user.id,
              p_review_id: payload.review_id,
              p_finding_type: payload.finding_type,
              p_severity: payload.severity ?? 'medium',
              p_entity_type: payload.entity_type ?? 'user',
              p_finding_title: payload.finding_title,
              p_finding_summary: payload.finding_summary ?? null,
              p_entity_id: payload.entity_id ?? null,
              p_department_id: payload.department_id ?? null,
              p_owner_id: payload.owner_id ?? null,
              p_due_date: payload.due_date ?? null,
            }
          : action === 'update_identity_role_integrity_finding_status'
            ? {
                p_actor_id: userData.user.id,
                p_finding_id: payload.finding_id,
                p_finding_status: payload.finding_status,
                p_resolution_summary: payload.resolution_summary ?? null,
              }
            : {
                p_actor_id: userData.user.id,
                p_review_id: payload.review_id,
                p_user_id: payload.user_id,
                p_role_name: payload.role_name,
                p_recertification_status: payload.recertification_status,
                p_recertification_rationale: payload.recertification_rationale ?? null,
                p_department_id: payload.department_id ?? null,
              };
    const { data, error } = await serviceClient.rpc(rpcName, rpcArgs);

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|ORGANIZATION|ROLE|AUTHORIZED|HIGH-RISK|RECERTIFICATION|OWNER|REVIEWER|EXPORT|RATIONALE|LIMITATION/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch79OperationsGovernanceActions.has(action)) {
    const rpcName = action;
    const payload = requestBody.payload ?? {};
    const rpcArgs = action === 'create_production_hypercare_window'
      ? {
          p_actor_id: userData.user.id,
          p_hypercare_title: payload.hypercare_title,
          p_exit_review_notes: payload.exit_review_notes ?? null,
        }
      : action === 'update_production_hypercare_window_status'
        ? {
            p_actor_id: userData.user.id,
            p_hypercare_window_id: payload.hypercare_window_id,
            p_hypercare_status: payload.hypercare_status,
            p_day_30_status: payload.day_30_status ?? null,
            p_day_60_status: payload.day_60_status ?? null,
            p_day_90_status: payload.day_90_status ?? null,
            p_evidence_pack_status: payload.evidence_pack_status ?? null,
            p_board_pack_status: payload.board_pack_status ?? null,
            p_exit_review_notes: payload.exit_review_notes ?? null,
          }
        : action === 'record_production_hypercare_item'
          ? {
              p_actor_id: userData.user.id,
              p_hypercare_window_id: payload.hypercare_window_id,
              p_item_type: payload.item_type,
              p_item_title: payload.item_title,
              p_severity: payload.severity ?? 'medium',
              p_item_summary: payload.item_summary ?? null,
              p_department_id: payload.department_id ?? null,
              p_owner_id: payload.owner_id ?? null,
              p_due_date: payload.due_date ?? null,
            }
          : action === 'update_production_hypercare_item_status'
            ? {
                p_actor_id: userData.user.id,
                p_item_id: payload.item_id,
                p_item_status: payload.item_status,
                p_evidence_summary: payload.evidence_summary ?? null,
                p_closure_summary: payload.closure_summary ?? null,
              }
            : action === 'create_executive_governance_board_pack'
              ? {
                  p_actor_id: userData.user.id,
                  p_pack_title: payload.pack_title,
                  p_reporting_period: payload.reporting_period,
                  p_hypercare_window_id: payload.hypercare_window_id ?? null,
                  p_executive_summary: payload.executive_summary ?? null,
                }
              : {
                  p_actor_id: userData.user.id,
                  p_board_pack_id: payload.board_pack_id,
                  p_pack_status: payload.pack_status,
                  p_board_review_notes: payload.board_review_notes ?? null,
                };
    const { data, error } = await serviceClient.rpc(rpcName, rpcArgs);

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|ORGANIZATION|ROLE|AUTHORIZED|HYPERCARE|BOARD|CRITICAL|SUPPORT|EVIDENCE|CLOSURE|LIMITATION/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch83rDepartmentLifecycleActions.has(action)) {
    const payload = requestBody.payload ?? {};
    let actorOrganizationId: string | null = null;
    try {
      actorOrganizationId = await authorizePatch83rActor(serviceClient, userData.user.id);
    } catch {
      return errorResponse(
        'Unable to verify department lifecycle authority.',
        500,
        'DEPARTMENT_LIFECYCLE_AUTHORIZATION_FAILED',
        'The server could not safely verify the authenticated actor profile and organization-scoped role.',
        { action },
      );
    }
    if (!actorOrganizationId) {
      return errorResponse(
        'Department lifecycle authority required.',
        403,
        'DEPARTMENT_LIFECYCLE_ROLE_REQUIRED',
        'An active global super_admin or governance_admin role in the authenticated actor organization is required.',
        { action },
      );
    }

    const departmentId = typeof payload.department_id === 'string' ? payload.department_id.trim() : '';
    const successorDepartmentId = payload.successor_department_id === null || payload.successor_department_id === undefined
      ? null
      : typeof payload.successor_department_id === 'string' ? payload.successor_department_id.trim() : '';
    const nameEn = typeof payload.name_en === 'string' ? payload.name_en.trim() : '';
    const nameAr = typeof payload.name_ar === 'string' ? payload.name_ar.trim() : '';
    const archiveReason = typeof payload.archive_reason === 'string' ? payload.archive_reason.trim() : '';
    const requestId = payload.request_id === null || payload.request_id === undefined
      ? null
      : typeof payload.request_id === 'string' ? payload.request_id.trim() : '';

    if (!uuidPattern.test(departmentId)) {
      return errorResponse('A valid department UUID is required.', 400, 'DEPARTMENT_UUID_INVALID',
        'The department_id must be a canonical UUID.', { action });
    }
    if (successorDepartmentId !== null && !uuidPattern.test(successorDepartmentId)) {
      return errorResponse('A valid successor department UUID is required.', 400, 'SUCCESSOR_DEPARTMENT_UUID_INVALID',
        'When provided, successor_department_id must be a canonical UUID.', { action });
    }
    if (requestId !== null && (!requestId || requestId.length > 128 || !/^[a-zA-Z0-9:._-]+$/.test(requestId))) {
      return errorResponse('Invalid lifecycle request identifier.', 400, 'DEPARTMENT_REQUEST_ID_INVALID',
        'When provided, request_id must use safe identifier characters and be no longer than 128 characters.', { action });
    }
    if (action === 'department_lifecycle_rename' && ((!nameEn && !nameAr) || nameEn.length > 180 || nameAr.length > 180)) {
      return errorResponse('Valid department names are required.', 400, 'DEPARTMENT_NAMES_INVALID',
        'Provide at least one non-empty Arabic or English name; each name may be at most 180 characters.', { action });
    }
    if (action === 'department_lifecycle_archive' && (!archiveReason || archiveReason.length > 1000)) {
      return errorResponse('A valid archive reason is required.', 400, 'DEPARTMENT_ARCHIVE_REASON_INVALID',
        'Provide a non-empty archive reason no longer than 1,000 characters.', { action });
    }
    if (action === 'department_lifecycle_archive' && successorDepartmentId === departmentId) {
      return errorResponse('A department cannot succeed itself.', 400, 'DEPARTMENT_SUCCESSOR_SELF_DENIED',
        'Choose a different active department as the successor.', { action });
    }

    let rpcResult: { data: unknown; error: any };
    if (action === 'department_lifecycle_preview') {
      rpcResult = await serviceClient.rpc('department_lifecycle_preview', {
        p_actor_id: userData.user.id,
        p_department_id: departmentId,
      });
    } else if (action === 'department_lifecycle_rename') {
      rpcResult = await serviceClient.rpc('department_lifecycle_rename', {
        p_actor_id: userData.user.id,
        p_department_id: departmentId,
        p_name_en: nameEn,
        p_name_ar: nameAr,
        p_request_id: requestId,
      });
    } else if (action === 'department_lifecycle_archive') {
      rpcResult = await serviceClient.rpc('department_lifecycle_archive', {
        p_actor_id: userData.user.id,
        p_department_id: departmentId,
        p_archive_reason: archiveReason,
        p_successor_department_id: successorDepartmentId,
        p_request_id: requestId,
      });
    } else {
      rpcResult = await serviceClient.rpc('department_lifecycle_restore', {
        p_actor_id: userData.user.id,
        p_department_id: departmentId,
        p_request_id: requestId,
      });
    }

    const { data, error } = rpcResult;
    if (error) {
      const message = String(error.message ?? '');
      const knownCode = [
        'PATCH83R_ADMIN_ROLE_REQUIRED',
        'PATCH83R_DEPARTMENT_NOT_FOUND',
        'PATCH83R_DEPARTMENT_NAME_REQUIRED',
        'PATCH83R_DEPARTMENT_NAME_TOO_LONG',
        'PATCH83R_ARCHIVED_DEPARTMENT_RENAME_DENIED',
        'PATCH83R_ACTIVE_DEPARTMENT_NAME_CONFLICT',
        'PATCH83R_ARCHIVE_REASON_REQUIRED',
        'PATCH83R_ARCHIVE_REASON_TOO_LONG',
        'PATCH83R_DEPARTMENT_ALREADY_ARCHIVED',
        'PATCH83R_SUCCESSOR_SELF_DENIED',
        'PATCH83R_ACTIVE_USERS_REQUIRE_SUCCESSOR',
        'PATCH83R_ACTIVE_SUCCESSOR_REQUIRED',
        'PATCH83R_USER_REASSIGNMENT_INCOMPLETE',
        'PATCH83R_DEPARTMENT_NOT_ARCHIVED',
      ].find((code) => message.includes(code));
      return errorResponse(
        knownCode === 'PATCH83R_ADMIN_ROLE_REQUIRED'
          ? 'Department lifecycle authority was denied.'
          : 'The department lifecycle action could not be completed.',
        knownCode === 'PATCH83R_ADMIN_ROLE_REQUIRED' ? 403 : knownCode === 'PATCH83R_DEPARTMENT_NOT_FOUND' ? 404 : 409,
        knownCode ?? 'DEPARTMENT_LIFECYCLE_ACTION_FAILED',
        knownCode
          ? 'The fixed lifecycle operation rejected the validated request without changing historical references.'
          : 'The database rejected the fixed lifecycle operation. No raw database detail is exposed.',
        { action },
      );
    }
    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch83q1ProductionReadinessActions.has(action)) {
    const payload = requestBody.payload ?? {};
    const allowedRoles = action === 'record_executive_production_signoff'
      ? ['governance_admin', 'super_admin']
      : ['governance_admin', 'executive'];

    let authorized = false;
    try {
      authorized = await authorizePatch83q1Actor(serviceClient, userData.user.id, allowedRoles);
    } catch {
      return errorResponse(
        'Unable to verify production-readiness authority.',
        500,
        'PRODUCTION_READINESS_AUTHORIZATION_FAILED',
        'The server could not safely verify the authenticated actor profile and organization-scoped role.',
        { action },
      );
    }
    if (!authorized) {
      return errorResponse(
        'Production-readiness authority required.',
        403,
        'PRODUCTION_READINESS_ROLE_REQUIRED',
        action === 'record_executive_production_signoff'
          ? 'An active governance_admin or super_admin role in the authenticated actor organization is required.'
          : 'An active governance_admin or executive role in the authenticated actor organization is required.',
        { action },
      );
    }

    const reviewId = typeof payload.review_id === 'string' ? payload.review_id.trim() : '';
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    const status = typeof payload.status === 'string' ? payload.status.trim() : '';
    const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
    const eventType = typeof payload.event_type === 'string' ? payload.event_type.trim() : '';
    const eventSummary = typeof payload.event_summary === 'string' ? payload.event_summary.trim() : '';
    const decision = typeof payload.decision === 'string' ? payload.decision.trim() : '';
    const snapshotHash = payload.snapshot_hash === null || payload.snapshot_hash === undefined
      ? null
      : typeof payload.snapshot_hash === 'string' ? payload.snapshot_hash.trim() : '';

    if (action === 'create_pilot_go_no_go_review' && (!title || title.length > 200)) {
      return errorResponse(
        'A valid pilot review title is required.',
        400,
        'PILOT_REVIEW_TITLE_INVALID',
        'Provide a non-empty title no longer than 200 characters.',
        { action },
      );
    }
    if (
      (action === 'update_pilot_go_no_go_review_status' || action === 'record_pilot_go_no_go_event')
      && !uuidPattern.test(reviewId)
    ) {
      return errorResponse(
        'A valid pilot review UUID is required.',
        400,
        'PILOT_REVIEW_UUID_INVALID',
        'The review_id must be a canonical UUID.',
        { action },
      );
    }
    if (action === 'update_pilot_go_no_go_review_status' && !pilotReviewStatuses.has(status)) {
      return errorResponse(
        'Unsupported pilot review status.',
        400,
        'PILOT_REVIEW_STATUS_INVALID',
        'Use a status defined by the live pilot_go_no_go_reviews constraint.',
        { action },
      );
    }
    if (action === 'update_pilot_go_no_go_review_status' && (!notes || notes.length > 4000)) {
      return errorResponse(
        'Valid pilot review notes are required.',
        400,
        'PILOT_REVIEW_NOTES_INVALID',
        'Provide non-empty review notes no longer than 4,000 characters.',
        { action },
      );
    }
    if (action === 'record_pilot_go_no_go_event' && !pilotEventTypePattern.test(eventType)) {
      return errorResponse(
        'Invalid pilot review event type.',
        400,
        'PILOT_EVENT_TYPE_INVALID',
        'Use a lowercase snake_case event type between 2 and 64 characters.',
        { action },
      );
    }
    if (action === 'record_pilot_go_no_go_event' && (!eventSummary || eventSummary.length > 2000)) {
      return errorResponse(
        'A valid pilot event summary is required.',
        400,
        'PILOT_EVENT_SUMMARY_INVALID',
        'Provide a non-empty event summary no longer than 2,000 characters.',
        { action },
      );
    }
    if (action === 'record_executive_production_signoff' && decision !== 'approved') {
      return errorResponse(
        'Invalid executive production decision.',
        400,
        'EXECUTIVE_PRODUCTION_DECISION_INVALID',
        'The live RPC and table constraint permit only the approved decision.',
        { action },
      );
    }
    if (action === 'record_executive_production_signoff' && (!notes || notes.length > 4000)) {
      return errorResponse(
        'Valid executive authorization notes are required.',
        400,
        'EXECUTIVE_PRODUCTION_NOTES_INVALID',
        'Provide non-empty authorization notes no longer than 4,000 characters.',
        { action },
      );
    }
    if (
      action === 'record_executive_production_signoff'
      && snapshotHash !== null
      && (!snapshotHash || snapshotHash.length > 256 || !/^[a-zA-Z0-9:_-]+$/.test(snapshotHash))
    ) {
      return errorResponse(
        'Invalid production snapshot hash.',
        400,
        'EXECUTIVE_PRODUCTION_SNAPSHOT_HASH_INVALID',
        'When provided, snapshot_hash must contain only letters, digits, colons, underscores, or hyphens and be no longer than 256 characters.',
        { action },
      );
    }

    if (reviewId) {
      const { data: review, error: reviewError } = await serviceClient
        .from('pilot_go_no_go_reviews')
        .select('id')
        .eq('id', reviewId)
        .maybeSingle();
      if (reviewError) {
        return errorResponse(
          'Unable to verify the pilot review.',
          500,
          'PILOT_REVIEW_LOOKUP_FAILED',
          'The server could not safely verify the requested pilot review.',
          { action },
        );
      }
      if (!review) {
        return errorResponse(
          'Pilot review not found.',
          404,
          'PILOT_REVIEW_NOT_FOUND',
          'No pilot go/no-go review exists for the supplied review_id.',
          { action },
        );
      }
    }

    let rpcResult: { data: unknown; error: any };
    if (action === 'create_pilot_go_no_go_review') {
      rpcResult = await serviceClient.rpc('create_pilot_go_no_go_review', {
        p_title: title,
        p_actor_id: userData.user.id,
      });
    } else if (action === 'update_pilot_go_no_go_review_status') {
      rpcResult = await serviceClient.rpc('update_pilot_go_no_go_review_status', {
        p_review_id: reviewId,
        p_status: status,
        p_notes: notes,
        p_actor_id: userData.user.id,
      });
    } else if (action === 'record_pilot_go_no_go_event') {
      rpcResult = await serviceClient.rpc('record_pilot_go_no_go_event', {
        p_review_id: reviewId,
        p_event_type: eventType,
        p_event_summary: eventSummary,
        p_actor_id: userData.user.id,
      });
    } else {
      rpcResult = await serviceClient.rpc('record_executive_production_signoff', {
        p_actor_id: userData.user.id,
        p_decision: decision,
        p_notes: notes,
        p_snapshot_hash: snapshotHash,
      });
    }

    if (rpcResult.error) {
      const authorizationFailure = /UNAUTHORIZED|DENIED|REQUIRED|ACTIVE_ACTOR|ORGANIZATION|ROLE/i
        .test(rpcResult.error.message ?? '');
      return errorResponse(
        authorizationFailure
          ? 'Production-readiness authority was denied.'
          : 'The production-readiness action could not be completed.',
        authorizationFailure ? 403 : 409,
        authorizationFailure ? 'PRODUCTION_READINESS_AUTHORITY_DENIED' : 'PRODUCTION_READINESS_ACTION_FAILED',
        'The fixed production-readiness RPC rejected the validated request.',
        { action },
      );
    }

    return jsonResponse({ ok: true, action, result: rpcResult.data }, 200);
  }

  if (action === 'create_department') {
    const { data, error } = await serviceClient.rpc('v98_create_department', {
      p_actor_id: userData.user.id,
      p_name_en: requestBody.payload?.name_en,
      p_name_ar: requestBody.payload?.name_ar ?? null,
      p_code: requestBody.payload?.code,
    });

    if (error) {
      const authorizationFailure = /NOT_AUTHORIZED|REQUIRES_SUPER_ADMIN|SERVICE_ROLE_REQUIRED|ACTIVE_ACTOR_REQUIRED/i
        .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (action === 'create_user') {
    const email = String(requestBody.payload?.email ?? '').trim().toLowerCase();
    const password = String(requestBody.payload?.password ?? '');
    const fullNameEn = String(requestBody.payload?.full_name_en ?? '').trim();
    const fullNameAr = requestBody.payload?.full_name_ar
      ? String(requestBody.payload.full_name_ar).trim()
      : null;
    const departmentId = requestBody.payload?.department_id
      ? String(requestBody.payload.department_id)
      : null;
    const role = String(requestBody.payload?.role ?? 'employee');
    const scope = String(requestBody.payload?.scope ?? 'assigned_only');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ ok: false, error: 'A valid user email is required.', action }, 400);
    }
    if (password.length < 10) {
      return jsonResponse({ ok: false, error: 'Temporary password must contain at least 10 characters.', action }, 400);
    }
    if (!fullNameEn || fullNameEn.length > 180) {
      return jsonResponse({ ok: false, error: 'A valid English full name is required.', action }, 400);
    }

    const { data: actorProfile, error: actorProfileError } = await serviceClient
      .from('profiles')
      .select('organization_id,is_active')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (actorProfileError || !actorProfile?.is_active || !actorProfile.organization_id) {
      return jsonResponse({ ok: false, error: 'An active administrator profile and organization are required.', action }, 403);
    }

    const { data: actorRoles, error: actorRolesError } = await serviceClient
      .from('user_roles')
      .select('organization_id')
      .eq('user_id', userData.user.id)
      .eq('role', 'super_admin')
      .eq('is_active', true);
    const authorizedActor = !actorRolesError && (actorRoles ?? []).some(
      (assignment) => assignment.organization_id === null
        || assignment.organization_id === actorProfile.organization_id,
    );
    if (!authorizedActor) {
      return jsonResponse({ ok: false, error: 'User creation requires an active super-admin role.', action }, 403);
    }

    const { data: createdUser, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name_en: fullNameEn,
        full_name_ar: fullNameAr,
        controlled_pilot: true,
      },
    });

    if (createError || !createdUser.user) {
      return jsonResponse({
        ok: false,
        error: createError?.message || 'Supabase Auth did not return a created user.',
        action,
      }, 409);
    }

    const { data, error } = await serviceClient.rpc('v98_finalize_created_user', {
      p_actor_id: userData.user.id,
      p_user_id: createdUser.user.id,
      p_email: email,
      p_full_name_en: fullNameEn,
      p_full_name_ar: fullNameAr,
      p_department_id: departmentId,
      p_role: role,
      p_scope: scope,
    });

    if (error) {
      const rollback = await serviceClient.auth.admin.deleteUser(createdUser.user.id);
      return jsonResponse({
        ok: false,
        error: rollback.error
          ? `${error.message}. Auth rollback also failed: ${rollback.error.message}`
          : error.message,
        code: error.code,
        action,
      }, /NOT_AUTHORIZED|REQUIRES_SUPER_ADMIN|SERVICE_ROLE_REQUIRED|ACTIVE_ACTOR_REQUIRED/i.test(error.message) ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (action === 'update_ovr_workflow') {
    const { data, error } = await serviceClient.rpc('v98_update_ovr_workflow', {
      p_actor_id: userData.user.id,
      p_ovr_report_id: requestBody.payload?.ovr_report_id,
      p_next_status: requestBody.payload?.next_status,
      p_payload: requestBody.payload ?? {},
    });

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|READ_ONLY|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|CROSS_ORGANIZATION/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (action === 'create_ovr_corrective_action_project') {
    const reportId = String(requestBody.payload?.ovr_report_id ?? '');
    const { data: report, error: reportError } = await serviceClient
      .from('ovr_reports')
      .select('organization_id,department_id,referred_user_id,referred_department_id')
      .eq('id', reportId)
      .maybeSingle();
    const { data: actorRoles, error: actorRolesError } = await serviceClient
      .from('user_roles')
      .select('role,scope,organization_id,department_id')
      .eq('user_id', userData.user.id)
      .eq('is_active', true);

    const authorized = !reportError && report && !actorRolesError && (actorRoles ?? []).some((assignment) => {
      if (
        ['super_admin', 'governance_admin', 'compliance_officer'].includes(assignment.role)
        && (assignment.organization_id === null || assignment.organization_id === report.organization_id)
      ) return true;
      return assignment.role === 'department_manager'
        && assignment.organization_id === report.organization_id
        && (
          assignment.scope === 'global'
          || assignment.department_id === report.department_id
          || assignment.department_id === report.referred_department_id
        );
    });

    if (!authorized) {
      return jsonResponse({
        ok: false,
        error: 'OVR corrective-action project creation requires Quality/Admin or a relevant department manager.',
        action,
      }, 403);
    }
  }

  if (action === 'department_import_execute') {
    const payload = requestBody.payload ?? {};
    const rows = payload.rows;
    if (!Array.isArray(rows)) {
      return jsonResponse({ ok: false, error: 'Rows array is required', action }, 400);
    }
    if (rows.length > 5000) {
      return jsonResponse({ ok: false, error: 'Maximum 5,000 rows allowed per import batch', action }, 400);
    }
    const payloadSize = new TextEncoder().encode(JSON.stringify(payload)).length;
    if (payloadSize > 5 * 1024 * 1024) {
      return jsonResponse({ ok: false, error: 'Payload exceeds 5MB limit', action }, 400);
    }

    let actorOrganizationId: string | null = null;
    try {
      actorOrganizationId = await authorizePatch83rActor(serviceClient, userData.user.id);
    } catch {
      return errorResponse('Unable to verify department import authority.', 500,
        'DEPARTMENT_IMPORT_AUTHORIZATION_FAILED',
        'The server could not safely verify the authenticated actor organization and role.', { action });
    }
    if (!actorOrganizationId || payload.organization_id !== actorOrganizationId) {
      return errorResponse('Department import organization scope denied.', 403,
        'DEPARTMENT_IMPORT_ORGANIZATION_SCOPE_DENIED',
        'The import organization must match the authenticated administrator organization.', { action });
    }

    const { data: archivedDepartments, error: archivedLookupError } = await serviceClient
      .from('departments')
      .select('id,code,name_en,name_ar')
      .eq('organization_id', actorOrganizationId)
      .eq('is_active', false)
      .not('archived_at', 'is', null)
      .limit(5000);
    if (archivedLookupError) {
      return errorResponse('Unable to verify archived department matches.', 500,
        'DEPARTMENT_IMPORT_ARCHIVED_LOOKUP_FAILED',
        'The server could not safely complete the archived department preflight.', { action });
    }
    const archivedKeys = new Set<string>();
    for (const department of archivedDepartments ?? []) {
      const code = normalizedDepartmentValue(department.code);
      const nameEn = normalizedDepartmentValue(department.name_en);
      const nameAr = normalizedDepartmentValue(department.name_ar);
      if (code) archivedKeys.add(`code:${code}`);
      if (nameEn) archivedKeys.add(`name:${nameEn}`);
      if (nameAr) archivedKeys.add(`name:${nameAr}`);
    }
    const archivedMatchRows = rows.flatMap((row: any, index: number) => {
      const raw = row && typeof row === 'object' && row.raw_data && typeof row.raw_data === 'object'
        ? row.raw_data : {};
      const code = normalizedDepartmentValue(raw.department_code);
      const nameEn = normalizedDepartmentValue(raw.department_name_en);
      const nameAr = normalizedDepartmentValue(raw.department_name_ar);
      const matched = (code && archivedKeys.has(`code:${code}`))
        || (nameEn && archivedKeys.has(`name:${nameEn}`))
        || (nameAr && archivedKeys.has(`name:${nameAr}`));
      return matched ? [Number(row?.row_number ?? index + 1)] : [];
    });
    if (archivedMatchRows.length) {
      return errorResponse('Department import contains an archived department match.', 409,
        'archived_department_match',
        'Restore the matching department explicitly from Department Management before importing it.',
        { action, row_numbers: archivedMatchRows });
    }

    const { data, error } = await serviceClient.rpc('apply_department_import_batch', {
      p_actor_id: userData.user.id,
      p_organization_id: payload.organization_id,
      p_source_filename: payload.source_filename,
      p_import_mode: payload.import_mode,
      p_rows: rows,
    });

    if (error) {
      const authFailure = /unauthorized|service_role_required|active_actor_required|organization_scope_denied|division_scope_denied/i.test(error.message);
      return jsonResponse({ ok: false, error: error.message, action }, authFailure ? 403 : 409);
    }
    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  const { data, error } = await serviceClient.rpc('v72_execute_privileged_action', {
    p_actor_id: userData.user.id,
    p_action: action,
    p_payload: requestBody.payload ?? {},
  });

  if (error) {
    const authorizationFailure =
      /NOT_AUTHORIZED|DENIED|REQUIRES_SUPER_ADMIN|SERVICE_ROLE_REQUIRED|ACTIVE_ACTOR_REQUIRED/i
        .test(error.message);
    return jsonResponse({
      ok: false,
      error: error.message,
      code: error.code,
      action,
    }, authorizationFailure ? 403 : 409);
  }

  return jsonResponse({ ok: true, action, result: data }, 200);
});
