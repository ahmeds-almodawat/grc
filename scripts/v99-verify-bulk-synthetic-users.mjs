import {
  client,
  datasetTag,
  expectedUserCount,
  listAllAuthUsers,
  loadDefinitions,
  localStatus,
  must,
  roleCoverage,
  sharedPassword,
} from './v99-bulk-uat-user-utils.mjs';

const requiredRoles = [
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
].sort();

const status = localStatus();
const admin = client(status.API_URL, status.SERVICE_ROLE_KEY);
const anonKey = status.ANON_KEY;
const {
  definitions,
  departments,
  organization,
} = await loadDefinitions(admin, { createSupportData: false });
const expectedEmails = new Set(definitions.map((definition) => definition.email));
const authUsers = await listAllAuthUsers(admin);
const taggedAuthUsers = authUsers.filter(
  (user) => user.email?.startsWith('v99.')
    && user.user_metadata?.test_dataset_tag === datasetTag
    && user.user_metadata?.synthetic_uat_user === true,
);
const taggedByEmail = new Map(
  taggedAuthUsers.map((user) => [user.email.toLowerCase(), user]),
);

const profiles = await must(
  admin
    .from('profiles')
    .select('id,email,employee_no,full_name_en,organization_id,division_id,department_id,is_active')
    .in('email', [...expectedEmails]),
  'Load UAT profiles',
);
const profileByEmail = new Map(profiles.map((profile) => [profile.email, profile]));
const userIds = profiles.map((profile) => profile.id);
const roles = userIds.length
  ? await must(
    admin
      .from('user_roles')
      .select('id,user_id,role,scope,organization_id,division_id,department_id,is_active')
      .in('user_id', userIds),
    'Load UAT roles',
  )
  : [];
const rolesByUser = new Map();
for (const role of roles) {
  const existing = rolesByUser.get(role.user_id) || [];
  existing.push(role);
  rolesByUser.set(role.user_id, existing);
}

const failures = [];
for (const definition of definitions) {
  const authUser = taggedByEmail.get(definition.email);
  const profile = profileByEmail.get(definition.email);
  const assignments = profile ? rolesByUser.get(profile.id) || [] : [];
  const matchingRoles = assignments.filter(
    (assignment) =>
      assignment.is_active
      && assignment.role === definition.role
      && assignment.scope === definition.scope
      && assignment.organization_id === definition.organizationId
      && assignment.division_id === definition.divisionId
      && assignment.department_id === (
        definition.scope === 'department' ? definition.departmentId : null
      ),
  );

  if (!authUser) failures.push(`${definition.email}: Auth user missing or metadata tag invalid.`);
  if (
    authUser
    && (
      authUser.user_metadata?.persona_key !== definition.key
      || authUser.user_metadata?.employee_no !== definition.employeeNo
      || !authUser.email_confirmed_at
    )
  ) {
    failures.push(`${definition.email}: Auth metadata/email confirmation mismatch.`);
  }
  if (
    !profile
    || profile.employee_no !== definition.employeeNo
    || profile.full_name_en !== definition.fullNameEn
    || profile.organization_id !== definition.organizationId
    || profile.division_id !== definition.divisionId
    || profile.department_id !== definition.departmentId
    || !profile.is_active
  ) {
    failures.push(`${definition.email}: profile marker or scope mismatch.`);
  }
  if (assignments.length !== 1 || matchingRoles.length !== 1) {
    failures.push(`${definition.email}: expected exactly one active matching role assignment.`);
  }
}

const unexpectedTagged = taggedAuthUsers.filter((user) => !expectedEmails.has(user.email));
if (unexpectedTagged.length) {
  failures.push(`Unexpected tagged Auth users: ${unexpectedTagged.map((user) => user.email).join(', ')}`);
}
if (taggedAuthUsers.length !== expectedUserCount) {
  failures.push(`Expected ${expectedUserCount} tagged Auth users; found ${taggedAuthUsers.length}.`);
}
if (profiles.length !== expectedUserCount) {
  failures.push(`Expected ${expectedUserCount} profiles; found ${profiles.length}.`);
}
if (definitions.filter((definition) => definition.category === 'core_role').length !== 10) {
  failures.push('Core role user count is not 10.');
}
if (definitions.filter((definition) => definition.category === 'department_user').length !== 18) {
  failures.push('Department user count is not 18.');
}
if (definitions.filter((definition) => definition.category === 'external_denial').length !== 2) {
  failures.push('External denial user count is not 2.');
}
if (
  JSON.stringify(roleCoverage(definitions))
  !== JSON.stringify(requiredRoles)
) {
  failures.push('Required role coverage is incomplete.');
}

for (const department of departments) {
  const departmentUsers = definitions.filter(
    (definition) =>
      definition.category === 'department_user'
      && definition.departmentId === department.id,
  );
  const departmentRoles = departmentUsers.map((definition) => definition.role).sort();
  if (
    departmentUsers.length !== 2
    || JSON.stringify(departmentRoles) !== JSON.stringify(['department_manager', 'employee'])
  ) {
    failures.push(`${department.code}: expected one manager and one employee.`);
  }
}

const loginSamples = [
  definitions.find((definition) => definition.key === 'core.super-admin'),
  definitions.find((definition) => definition.category === 'department_user' && definition.role === 'department_manager'),
  definitions.find((definition) => definition.category === 'department_user' && definition.role === 'employee'),
  definitions.find((definition) => definition.key === 'external.employee'),
].filter(Boolean);
const loginResults = [];
for (const definition of loginSamples) {
  const personaClient = client(status.API_URL, anonKey);
  const login = await personaClient.auth.signInWithPassword({
    email: definition.email,
    password: sharedPassword,
  });
  const passed = !login.error && login.data.user?.email === definition.email;
  let primaryOrganizationDenied = null;
  if (passed && definition.category === 'external_denial') {
    const organizationAttempt = await personaClient
      .from('organizations')
      .select('id')
      .eq('id', organization.id);
    const projectAttempt = await personaClient
      .from('projects')
      .select('id')
      .eq('organization_id', organization.id)
      .limit(1);
    primaryOrganizationDenied = (
      !organizationAttempt.error
      && organizationAttempt.data.length === 0
      && !projectAttempt.error
      && projectAttempt.data.length === 0
    );
    if (!primaryOrganizationDenied) {
      failures.push(`${definition.email}: primary-organization denial proof failed.`);
    }
  }
  loginResults.push({
    email: definition.email,
    passed,
    primary_organization_denied: primaryOrganizationDenied,
    error: login.error?.message || null,
  });
  if (!passed) failures.push(`${definition.email}: representative login failed.`);
  await personaClient.auth.signOut();
}

const passed = failures.length === 0;
console.log('v9.9A bulk synthetic UAT verification complete.');
console.log(JSON.stringify({
  passed,
  exact_user_count: taggedAuthUsers.length,
  core_role_users: definitions.filter((definition) => definition.category === 'core_role').length,
  department_users: definitions.filter((definition) => definition.category === 'department_user').length,
  external_denial_users: definitions.filter((definition) => definition.category === 'external_denial').length,
  active_departments_covered: departments.length,
  role_coverage: roleCoverage(definitions),
  representative_logins: loginResults,
  failures,
}, null, 2));

if (!passed) process.exit(1);
