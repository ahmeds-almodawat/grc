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
]);

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
    return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ ok: false, error: 'Authenticated user token required.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Edge Function environment is incomplete.' }, 500);
  }

  let requestBody: { action?: string; payload?: Record<string, unknown> };
  try {
    requestBody = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'A JSON request body is required.' }, 400);
  }

  const action = requestBody.action ?? '';
  if (!allowedActions.has(action)) {
    return jsonResponse({ ok: false, error: `Unsupported privileged action: ${action}` }, 400);
  }

  const token = authorization.slice('Bearer '.length);
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    return jsonResponse({ ok: false, error: 'Invalid or expired authenticated user token.' }, 401);
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
