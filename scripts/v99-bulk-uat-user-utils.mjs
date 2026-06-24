import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

export const root = process.cwd();
export const datasetTag = 'V99_BULK_UAT_USERS';
export const emailDomain = 'local.test';
export const sharedPassword = 'V99-UAT-Local-Only!990A';
export const externalOrganizationName = 'V99 Synthetic External Organization';
export const divisionName = 'V99 Synthetic UAT Division';
export const divisionCode = 'V99UAT';
export const expectedUserCount = 30;

const corePersonas = [
  {
    key: 'core.super-admin',
    label: 'Core Super Admin',
    role: 'super_admin',
    scope: 'global',
    departmentCode: 'IT',
    scenario: 'Admin Hub, user creation, department setup, access control, Scenario Lab, import/export.',
    expected: 'Full controlled-pilot administration inside the primary organization.',
  },
  {
    key: 'core.executive',
    label: 'Core Executive',
    role: 'executive',
    scope: 'global',
    departmentCode: null,
    scenario: 'Executive Hub, dashboards, board packs, analytics, escalations.',
    expected: 'Organization-wide executive read access without user/role administration.',
  },
  {
    key: 'core.governance-admin',
    label: 'Core Governance Admin',
    role: 'governance_admin',
    scope: 'global',
    departmentCode: 'GOVCOMP',
    scenario: 'GRC, Quality validation, governance workflows, controlled administration.',
    expected: 'Governance and Quality administration without replacing human approvals.',
  },
  {
    key: 'core.division-head',
    label: 'Core Division Head',
    role: 'division_head',
    scope: 'division',
    departmentCode: 'ENG',
    scenario: 'Division-scoped work execution, risk visibility, projects and escalations.',
    expected: 'Only the dedicated synthetic division scope plus explicitly owned work.',
  },
  {
    key: 'core.project-owner',
    label: 'Core Project Owner',
    role: 'project_owner',
    scope: 'assigned_only',
    departmentCode: 'ENG',
    scenario: 'Open assigned projects, update project status, add milestones and evidence.',
    expected: 'Assigned/owned project access; no broad administration.',
  },
  {
    key: 'core.milestone-owner',
    label: 'Core Milestone Owner',
    role: 'milestone_owner',
    scope: 'assigned_only',
    departmentCode: 'ENG',
    scenario: 'Milestone ownership, progress updates, evidence submission.',
    expected: 'Assigned milestone and related project context only.',
  },
  {
    key: 'core.task-owner',
    label: 'Core Task Owner',
    role: 'task_owner',
    scope: 'assigned_only',
    departmentCode: 'ENG',
    scenario: 'My Work, assigned tasks, progress, evidence and delay reasons.',
    expected: 'Assigned task context only.',
  },
  {
    key: 'core.auditor',
    label: 'Core Auditor',
    role: 'auditor',
    scope: 'global',
    departmentCode: 'AUDIT',
    scenario: 'Audit follow-up, security evidence, organization-wide read-only OVR review.',
    expected: 'Broad assurance visibility with no OVR workflow mutation.',
  },
  {
    key: 'core.compliance-officer',
    label: 'Core Compliance Officer',
    role: 'compliance_officer',
    scope: 'global',
    departmentCode: 'QUALITY',
    scenario: 'Compliance calendar, Quality validation, OVR final review and evidence.',
    expected: 'Compliance/Quality workflow access, not user administration.',
  },
  {
    key: 'core.viewer',
    label: 'Core Viewer',
    role: 'viewer',
    scope: 'global',
    departmentCode: null,
    scenario: 'Read-only reports, dashboards and controlled-pilot visibility checks.',
    expected: 'Organization-wide viewing where RLS permits; no mutation actions.',
  },
];

function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll('&', 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function localStatus() {
  const supabaseCli = path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
  const result = spawnSync(process.execPath, [supabaseCli, 'status', '-o', 'json'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Local Supabase status failed.');
  }
  const start = result.stdout.indexOf('{');
  const end = result.stdout.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error('Local Supabase status did not return JSON.');
  }
  const status = JSON.parse(result.stdout.slice(start, end + 1));
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(status.API_URL || '')) {
    throw new Error(`Refusing non-local Supabase API target: ${status.API_URL || '(missing)'}`);
  }
  return status;
}

export function client(url, key) {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function must(resultPromise, label) {
  const result = await resultPromise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

export async function listAllAuthUsers(admin) {
  const users = [];
  for (let page = 1; page <= 10; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) throw new Error(`List Auth users: ${result.error.message}`);
    users.push(...result.data.users);
    if (result.data.users.length < 1000) break;
  }
  return users;
}

export function assertMarkers({ email, employeeNo, fullNameEn }) {
  if (!email.startsWith('v99.')) {
    throw new Error(`Unsafe email marker: ${email}`);
  }
  if (!employeeNo.startsWith('V99-UAT-')) {
    throw new Error(`Unsafe employee number marker: ${employeeNo}`);
  }
  if (!fullNameEn.startsWith('V99 Synthetic')) {
    throw new Error(`Unsafe full-name marker: ${fullNameEn}`);
  }
}

export async function loadPilotStructure(admin) {
  const profiles = await must(
    admin
      .from('profiles')
      .select('id,organization_id,email')
      .eq('email', 'pilot.admin@almodawat.test')
      .eq('is_active', true)
      .limit(1),
    'Load pilot administrator',
  );
  const pilotAdmin = profiles[0];
  if (!pilotAdmin?.organization_id) {
    throw new Error(
      'Active pilot administrator profile not found. Run: npm run pilot:first-run-bootstrap',
    );
  }

  const organizations = await must(
    admin
      .from('organizations')
      .select('id,name_en,is_active')
      .eq('id', pilotAdmin.organization_id)
      .eq('is_active', true)
      .limit(1),
    'Load primary organization',
  );
  const organization = organizations[0];
  if (!organization) throw new Error('Primary pilot organization is not active.');

  const departments = await must(
    admin
      .from('departments')
      .select('id,organization_id,code,name_en,is_active')
      .eq('organization_id', organization.id)
      .eq('is_active', true)
      .order('code'),
    'Load active departments',
  );
  if (departments.length !== 9) {
    throw new Error(
      `Expected exactly 9 active departments in the primary organization; found ${departments.length}.`,
    );
  }
  if (departments.some((department) => !department.code?.trim())) {
    throw new Error('Every active department needs a code before bulk UAT users can be generated.');
  }

  return { pilotAdmin, organization, departments };
}

export async function ensureSyntheticSupportData(admin, organizationId) {
  const existingDivisions = await must(
    admin
      .from('divisions')
      .select('id,organization_id,name_en,code,is_active')
      .eq('organization_id', organizationId)
      .eq('code', divisionCode)
      .limit(2),
    'Find synthetic division',
  );
  if (
    existingDivisions.length
    && existingDivisions.some((division) => division.name_en !== divisionName)
  ) {
    throw new Error(`Division code collision for ${divisionCode}.`);
  }
  const division = existingDivisions[0] || (await must(
    admin
      .from('divisions')
      .insert({
        organization_id: organizationId,
        name_en: divisionName,
        code: divisionCode,
        is_active: true,
      })
      .select('id,organization_id,name_en,code,is_active')
      .single(),
    'Create synthetic UAT division',
  ));
  if (!division.is_active) {
    await must(
      admin.from('divisions').update({ is_active: true }).eq('id', division.id),
      'Reactivate synthetic UAT division',
    );
    division.is_active = true;
  }

  const externalOrganizations = await must(
    admin
      .from('organizations')
      .select('id,name_en,is_active')
      .eq('name_en', externalOrganizationName)
      .limit(2),
    'Find external synthetic organization',
  );
  const externalOrganization = externalOrganizations[0] || (await must(
    admin
      .from('organizations')
      .insert({ name_en: externalOrganizationName, is_active: true })
      .select('id,name_en,is_active')
      .single(),
    'Create external synthetic organization',
  ));
  if (!externalOrganization.is_active) {
    await must(
      admin.from('organizations').update({ is_active: true }).eq('id', externalOrganization.id),
      'Reactivate external synthetic organization',
    );
    externalOrganization.is_active = true;
  }

  return { division, externalOrganization };
}

export function buildDefinitions({
  organization,
  departments,
  division,
  externalOrganization,
}) {
  const departmentByCode = new Map(
    departments.map((department) => [department.code.toUpperCase(), department]),
  );
  const definitions = [];
  let sequence = 1;

  for (const persona of corePersonas) {
    const department = persona.departmentCode
      ? departmentByCode.get(persona.departmentCode)
      : null;
    if (persona.departmentCode && !department) {
      throw new Error(`Required department code not found: ${persona.departmentCode}`);
    }
    const employeeNo = `V99-UAT-${String(sequence).padStart(3, '0')}`;
    const fullNameEn = `V99 Synthetic ${persona.label}`;
    const email = `v99.uat.${persona.key.replace('core.', 'core.')}@${emailDomain}`;
    assertMarkers({ email, employeeNo, fullNameEn });
    definitions.push({
      sequence,
      category: 'core_role',
      key: persona.key,
      email,
      employeeNo,
      fullNameEn,
      fullNameAr: `V99 Synthetic ${persona.label}`,
      jobTitle: `V99 UAT ${persona.label}`,
      role: persona.role,
      scope: persona.scope,
      organizationId: organization.id,
      organizationName: organization.name_en,
      divisionId: persona.scope === 'division' ? division.id : null,
      departmentId: department?.id || null,
      departmentCode: department?.code || null,
      departmentName: department?.name_en || null,
      scenario: persona.scenario,
      expected: persona.expected,
    });
    sequence += 1;
  }

  for (const department of departments) {
    const departmentSlug = slug(department.code);
    for (const kind of ['manager', 'employee']) {
      const isManager = kind === 'manager';
      const label = `${department.name_en} ${isManager ? 'Manager' : 'Employee'}`;
      const employeeNo = `V99-UAT-${String(sequence).padStart(3, '0')}`;
      const fullNameEn = `V99 Synthetic ${label}`;
      const email = `v99.uat.dept.${departmentSlug}.${kind}@${emailDomain}`;
      assertMarkers({ email, employeeNo, fullNameEn });
      definitions.push({
        sequence,
        category: 'department_user',
        key: `department.${departmentSlug}.${kind}`,
        email,
        employeeNo,
        fullNameEn,
        fullNameAr: `V99 Synthetic ${label}`,
        jobTitle: `V99 UAT ${label}`,
        role: isManager ? 'department_manager' : 'employee',
        scope: isManager ? 'department' : 'assigned_only',
        organizationId: organization.id,
        organizationName: organization.name_en,
        divisionId: null,
        departmentId: department.id,
        departmentCode: department.code,
        departmentName: department.name_en,
        scenario: isManager
          ? `Review ${department.name_en} projects, team work, and department OVR queue.`
          : `Submit an OVR and test own-work visibility inside ${department.name_en}.`,
        expected: isManager
          ? 'Relevant department/team records only; unrelated departments denied.'
          : 'Own/assigned records only; administration and other departments denied.',
      });
      sequence += 1;
    }
  }

  const externalDefinitions = [
    {
      key: 'external.viewer',
      label: 'External Organization Viewer',
      role: 'viewer',
      scope: 'global',
      scenario: 'Attempt to read primary-organization projects, OVRs, evidence, and reports.',
      expected: 'Primary-organization records must be denied by organization isolation.',
    },
    {
      key: 'external.employee',
      label: 'External Organization Employee',
      role: 'employee',
      scope: 'assigned_only',
      scenario: 'Attempt normal-user access against the primary organization.',
      expected: 'No primary-organization data; no admin, export, backup, or Quality access.',
    },
  ];

  for (const persona of externalDefinitions) {
    const employeeNo = `V99-UAT-${String(sequence).padStart(3, '0')}`;
    const fullNameEn = `V99 Synthetic ${persona.label}`;
    const email = `v99.uat.${persona.key}@${emailDomain}`;
    assertMarkers({ email, employeeNo, fullNameEn });
    definitions.push({
      sequence,
      category: 'external_denial',
      key: persona.key,
      email,
      employeeNo,
      fullNameEn,
      fullNameAr: `V99 Synthetic ${persona.label}`,
      jobTitle: `V99 UAT ${persona.label}`,
      role: persona.role,
      scope: persona.scope,
      organizationId: externalOrganization.id,
      organizationName: externalOrganization.name_en,
      divisionId: null,
      departmentId: null,
      departmentCode: null,
      departmentName: null,
      scenario: persona.scenario,
      expected: persona.expected,
    });
    sequence += 1;
  }

  if (definitions.length !== expectedUserCount) {
    throw new Error(`Definition error: expected ${expectedUserCount}, built ${definitions.length}.`);
  }
  return definitions;
}

export async function loadDefinitions(admin, { createSupportData = true } = {}) {
  const structure = await loadPilotStructure(admin);
  let support;
  if (createSupportData) {
    support = await ensureSyntheticSupportData(admin, structure.organization.id);
  } else {
    const divisions = await must(
      admin
        .from('divisions')
        .select('id,organization_id,name_en,code,is_active')
        .eq('organization_id', structure.organization.id)
        .eq('code', divisionCode)
        .eq('name_en', divisionName)
        .limit(1),
      'Load synthetic UAT division',
    );
    const externalOrganizations = await must(
      admin
        .from('organizations')
        .select('id,name_en,is_active')
        .eq('name_en', externalOrganizationName)
        .limit(1),
      'Load external synthetic organization',
    );
    if (!divisions[0] || !externalOrganizations[0]) {
      throw new Error('Bulk UAT support data is missing. Run: npm run v99:create-bulk-users');
    }
    support = {
      division: divisions[0],
      externalOrganization: externalOrganizations[0],
    };
  }
  return {
    ...structure,
    ...support,
    definitions: buildDefinitions({ ...structure, ...support }),
  };
}

export function roleCoverage(definitions) {
  return [...new Set(definitions.map((definition) => definition.role))].sort();
}

export function escapeMarkdown(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\r?\n/g, ' ');
}
