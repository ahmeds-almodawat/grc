import fs from 'node:fs';
import path from 'node:path';
import {
  client,
  datasetTag,
  escapeMarkdown,
  expectedUserCount,
  loadDefinitions,
  localStatus,
  roleCoverage,
  root,
  sharedPassword,
} from './v99-bulk-uat-user-utils.mjs';

const releaseDir = path.join(root, 'release', 'v99');
const matrixPath = path.join(releaseDir, 'uat-user-matrix.md');
const coveragePath = path.join(releaseDir, 'scenario-coverage-map.md');
fs.mkdirSync(releaseDir, { recursive: true });

const status = localStatus();
const admin = client(status.API_URL, status.SERVICE_ROLE_KEY);
const {
  definitions,
  organization,
  departments,
  externalOrganization,
} = await loadDefinitions(admin, { createSupportData: false });
const generatedAt = new Date().toISOString();

const matrixRows = definitions.map((definition) => [
  definition.sequence,
  definition.category.replaceAll('_', ' '),
  definition.email,
  definition.role,
  definition.scope,
  definition.organizationName,
  definition.departmentCode || '-',
  definition.scenario,
].map(escapeMarkdown).join(' | '));

fs.writeFileSync(matrixPath, `# v9.9A Synthetic UAT User Matrix

- Generated: ${generatedAt}
- Environment: **Local Supabase Docker / controlled pilot only**
- Synthetic users: **${definitions.length}/${expectedUserCount}**
- Dataset tag: \`${datasetTag}\`
- Shared local password: \`${sharedPassword}\`
- Production readiness: **Not asserted**

All accounts are synthetic. Do not reuse this password or these identities outside the local controlled-pilot environment.

## Login matrix

| # | Category | Email | Role | Scope | Organization | Department | Primary manual test |
|---:|---|---|---|---|---|---|---|
${matrixRows.map((row) => `| ${row} |`).join('\n')}

## Usage

1. Start the app with \`npm run dev\`.
2. Choose the account matching the workflow under test.
3. Sign in with the shared local password above.
4. Use only synthetic/non-confidential test records.
5. Run \`npm run v99:cleanup-bulk-users\` when the UAT identity pack is no longer needed.
`, 'utf8');

const coreRows = definitions
  .filter((definition) => definition.category === 'core_role')
  .map((definition) => (
    `| ${escapeMarkdown(definition.role)} | ${escapeMarkdown(definition.email)} | `
    + `${escapeMarkdown(definition.scenario)} | ${escapeMarkdown(definition.expected)} |`
  ))
  .join('\n');
const departmentRows = departments.map((department) => {
  const manager = definitions.find(
    (definition) =>
      definition.category === 'department_user'
      && definition.departmentId === department.id
      && definition.role === 'department_manager',
  );
  const employee = definitions.find(
    (definition) =>
      definition.category === 'department_user'
      && definition.departmentId === department.id
      && definition.role === 'employee',
  );
  return `| ${escapeMarkdown(department.code)} | ${escapeMarkdown(department.name_en)} | `
    + `${escapeMarkdown(manager?.email)} | ${escapeMarkdown(employee?.email)} | `
    + 'Manager sees relevant department/team work; employee sees own/assigned work. |';
}).join('\n');
const externalRows = definitions
  .filter((definition) => definition.category === 'external_denial')
  .map((definition) => (
    `| ${escapeMarkdown(definition.email)} | ${escapeMarkdown(definition.role)} | `
    + `${escapeMarkdown(definition.scenario)} | ${escapeMarkdown(definition.expected)} |`
  ))
  .join('\n');

fs.writeFileSync(coveragePath, `# v9.9A Scenario Coverage Map

- Generated: ${generatedAt}
- Primary organization: ${escapeMarkdown(organization.name_en)}
- External denial organization: ${escapeMarkdown(externalOrganization.name_en)}
- Active departments covered: **${departments.length}/9**
- Application roles covered: **${roleCoverage(definitions).length}/12**
- Production readiness: **Not asserted**

## Core role coverage

| Role | Login | Scenario | Expected boundary |
|---|---|---|---|
${coreRows}

## Department pair coverage

| Code | Department | Manager login | Employee login | Expected boundary |
|---|---|---|---|---|
${departmentRows}

Recommended pair tests:

- Manager reviews a synthetic department OVR; employee submits and sees their own OVR.
- Manager attempts another department's records and should be denied.
- Employee attempts Admin Hub, Access Control, export, and backup functions and should be denied.
- Use two department pairs to test cross-department Quality referral and response.

## External organization denial coverage

| Login | Role | Scenario | Expected boundary |
|---|---|---|---|
${externalRows}

The external accounts belong to a separate synthetic organization. They should authenticate successfully but receive no primary-organization records through RLS.

## Security and governance notes

- No service-role key is exposed to the browser.
- The generator is local operator tooling only.
- Human approvals are not created, modified, inferred, or marked verified.
- These accounts do not make the platform production ready.
`, 'utf8');

console.log('v9.9A UAT user matrix generated.');
console.log(JSON.stringify({
  matrix: path.relative(root, matrixPath),
  coverage_map: path.relative(root, coveragePath),
  users_documented: definitions.length,
  shared_local_password: sharedPassword,
}, null, 2));
