import { createClient } from 'npm:@supabase/supabase-js@2.108.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const allowedActions = new Set([
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
]);

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
