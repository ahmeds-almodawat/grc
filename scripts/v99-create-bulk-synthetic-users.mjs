import {
  client,
  datasetTag,
  expectedUserCount,
  listAllAuthUsers,
  loadDefinitions,
  localStatus,
  must,
  sharedPassword,
} from './v99-bulk-uat-user-utils.mjs';

const status = localStatus();
const admin = client(status.API_URL, status.SERVICE_ROLE_KEY);
const {
  pilotAdmin,
  definitions,
} = await loadDefinitions(admin, { createSupportData: true });
const existingUsers = await listAllAuthUsers(admin);
const authByEmail = new Map(
  existingUsers
    .filter((user) => user.email)
    .map((user) => [user.email.toLowerCase(), user]),
);

let createdCount = 0;
let reusedCount = 0;
const results = [];

for (const definition of definitions) {
  let authUser = authByEmail.get(definition.email);
  if (authUser) {
    if (authUser.user_metadata?.test_dataset_tag !== datasetTag) {
      throw new Error(
        `Refusing email collision with a non-v9.9A Auth user: ${definition.email}`,
      );
    }
    const updated = await admin.auth.admin.updateUserById(authUser.id, {
      password: sharedPassword,
      email_confirm: true,
      user_metadata: {
        ...authUser.user_metadata,
        test_dataset_tag: datasetTag,
        synthetic_uat_user: true,
        persona_key: definition.key,
        employee_no: definition.employeeNo,
      },
    });
    if (updated.error || !updated.data.user) {
      throw new Error(
        `Update Auth user ${definition.email}: ${updated.error?.message || 'user missing'}`,
      );
    }
    authUser = updated.data.user;
    reusedCount += 1;
  } else {
    const created = await admin.auth.admin.createUser({
      email: definition.email,
      password: sharedPassword,
      email_confirm: true,
      user_metadata: {
        test_dataset_tag: datasetTag,
        synthetic_uat_user: true,
        persona_key: definition.key,
        employee_no: definition.employeeNo,
      },
    });
    if (created.error || !created.data.user) {
      throw new Error(
        `Create Auth user ${definition.email}: ${created.error?.message || 'user missing'}`,
      );
    }
    authUser = created.data.user;
    createdCount += 1;
  }

  const conflictingProfiles = await must(
    admin
      .from('profiles')
      .select('id,email,employee_no,full_name_en')
      .eq('email', definition.email)
      .neq('id', authUser.id)
      .limit(1),
    `Check profile email collision ${definition.email}`,
  );
  if (conflictingProfiles.length) {
    throw new Error(`Profile email collision for ${definition.email}.`);
  }

  await must(
    admin
      .from('profiles')
      .upsert({
        id: authUser.id,
        organization_id: definition.organizationId,
        employee_no: definition.employeeNo,
        full_name_en: definition.fullNameEn,
        full_name_ar: definition.fullNameAr,
        email: definition.email,
        job_title: definition.jobTitle,
        division_id: definition.divisionId,
        department_id: definition.departmentId,
        unit_id: null,
        is_active: true,
      }, { onConflict: 'id' }),
    `Upsert profile ${definition.email}`,
  );

  await must(
    admin.from('user_roles').delete().eq('user_id', authUser.id),
    `Clear previous synthetic role ${definition.email}`,
  );
  await must(
    admin.from('user_roles').insert({
      user_id: authUser.id,
      role: definition.role,
      scope: definition.scope,
      organization_id: definition.organizationId,
      division_id: definition.divisionId,
      department_id: definition.scope === 'department'
        ? definition.departmentId
        : null,
      unit_id: null,
      is_active: true,
      assigned_by: pilotAdmin.id,
    }),
    `Create role ${definition.email}`,
  );

  results.push({
    email: definition.email,
    role: definition.role,
    scope: definition.scope,
    department: definition.departmentCode,
    status: authByEmail.has(definition.email) ? 'reused' : 'created',
  });
}

if (results.length !== expectedUserCount) {
  throw new Error(`Expected ${expectedUserCount} processed users; got ${results.length}.`);
}

console.log('v9.9A bulk synthetic UAT users complete.');
console.log(JSON.stringify({
  synthetic_data_only: true,
  exact_user_count: results.length,
  created_count: createdCount,
  reused_count: reusedCount,
  shared_local_password: sharedPassword,
  next_step: 'npm run v99:verify-bulk-users',
}, null, 2));
