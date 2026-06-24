import {
  client,
  datasetTag,
  divisionCode,
  divisionName,
  expectedUserCount,
  externalOrganizationName,
  listAllAuthUsers,
  localStatus,
  must,
} from './v99-bulk-uat-user-utils.mjs';

const status = localStatus();
const admin = client(status.API_URL, status.SERVICE_ROLE_KEY);
const authUsers = await listAllAuthUsers(admin);
const candidates = authUsers.filter(
  (user) => user.email?.startsWith('v99.')
    && user.user_metadata?.test_dataset_tag === datasetTag
    && user.user_metadata?.synthetic_uat_user === true,
);

if (candidates.length > expectedUserCount) {
  throw new Error(
    `Refusing cleanup: found ${candidates.length} tagged users; maximum expected is ${expectedUserCount}.`,
  );
}

const candidateIds = candidates.map((user) => user.id);
const profiles = candidateIds.length
  ? await must(
    admin
      .from('profiles')
      .select('id,email,employee_no,full_name_en,organization_id')
      .in('id', candidateIds),
    'Load cleanup profiles',
  )
  : [];
const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

for (const user of candidates) {
  const profile = profileById.get(user.id);
  if (
    !profile
    || profile.email !== user.email
    || !profile.email.startsWith('v99.')
    || !profile.employee_no?.startsWith('V99-UAT-')
    || !profile.full_name_en?.startsWith('V99 Synthetic')
  ) {
    throw new Error(`Refusing cleanup because synthetic markers do not align for ${user.email}.`);
  }
}

const roles = candidateIds.length
  ? await must(
    admin.from('user_roles').select('id,user_id').in('user_id', candidateIds),
    'Load synthetic role IDs',
  )
  : [];
const auditRecordIds = [...candidateIds, ...roles.map((role) => role.id)];
if (auditRecordIds.length) {
  await must(
    admin
      .from('audit_logs')
      .delete()
      .in('record_id', auditRecordIds),
    'Delete exact synthetic user audit records',
  );
}

for (const user of candidates) {
  const deleted = await admin.auth.admin.deleteUser(user.id);
  if (deleted.error) {
    throw new Error(`Delete Auth user ${user.email}: ${deleted.error.message}`);
  }
}

const divisions = await must(
  admin
    .from('divisions')
    .select('id,organization_id')
    .eq('code', divisionCode)
    .eq('name_en', divisionName),
  'Find exact synthetic division',
);
for (const division of divisions) {
  const linkedProfiles = await must(
    admin.from('profiles').select('id').eq('division_id', division.id).limit(1),
    'Check synthetic division references',
  );
  if (!linkedProfiles.length) {
    await must(
      admin.from('divisions').delete().eq('id', division.id),
      'Delete exact synthetic division',
    );
  }
}

const externalOrganizations = await must(
  admin
    .from('organizations')
    .select('id,name_en')
    .eq('name_en', externalOrganizationName),
  'Find exact external synthetic organization',
);
for (const organization of externalOrganizations) {
  const linkedProfiles = await must(
    admin.from('profiles').select('id').eq('organization_id', organization.id).limit(1),
    'Check external synthetic organization references',
  );
  if (!linkedProfiles.length) {
    await must(
      admin.from('audit_logs').delete().eq('record_id', organization.id),
      'Delete exact external organization audit records',
    );
    await must(
      admin.from('organizations').delete().eq('id', organization.id),
      'Delete exact external synthetic organization',
    );
  }
}

console.log('v9.9A bulk synthetic UAT cleanup complete.');
console.log(JSON.stringify({
  deleted_auth_users: candidates.length,
  exact_dataset_tag: datasetTag,
  safety: 'Only exact tagged Auth users with matching V99 email/profile markers were deleted.',
}, null, 2));
