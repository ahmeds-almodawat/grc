import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { ModuleHeader } from '../components/ModuleHeader';
import { getDepartments, getProfiles } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { DepartmentOption, ProfileOption } from '../types/domain';

export function Admin() {
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Admin and organization"
        title="Company hierarchy, users, roles and access scopes"
        subtitle="For 1,000 employees, access must be scoped: global, division, department, unit, or assigned only."
      />

      <div className="panel">
        <div className="panel-header">
          <h4>Role model</h4>
          <p>Normal employees should only see assigned work. Executives and governance admins see the control dashboard.</p>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Role</th><th>Recommended Scope</th><th>Purpose</th></tr></thead>
            <tbody>
              <tr><td>Super Admin</td><td>Global</td><td>System setup, users, roles, migrations, full control.</td></tr>
              <tr><td>Executive</td><td>Global</td><td>Dashboards, approvals, escalations and critical risks.</td></tr>
              <tr><td>Governance Admin</td><td>Global / Division</td><td>Manage GRC workflows, policies, decisions and controls.</td></tr>
              <tr><td>Department Manager</td><td>Department</td><td>Manage department actions and staff assignments.</td></tr>
              <tr><td>Auditor</td><td>Global / Department</td><td>Create findings and approve/reject closure evidence.</td></tr>
              <tr><td>Employee</td><td>Assigned Only</td><td>Only assigned tasks and evidence requests.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel two-column align-start">
        <div>
          <div className="panel-header"><h4>Departments</h4></div>
          <DataState loading={departments.loading} error={departments.error} empty={!departments.data?.length}>
            <EntityTable<DepartmentOption>
              rows={departments.data || []}
              getRowKey={row => row.id}
              columns={[
                { key: 'name_en', header: 'English Name', render: row => row.name_en },
                { key: 'name_ar', header: 'Arabic Name', render: row => row.name_ar || '—' }
              ]}
            />
          </DataState>
        </div>
        <div>
          <div className="panel-header"><h4>People</h4></div>
          <DataState loading={profiles.loading} error={profiles.error} empty={!profiles.data?.length}>
            <EntityTable<ProfileOption>
              rows={profiles.data || []}
              getRowKey={row => row.id}
              columns={[
                { key: 'name', header: 'Name', render: row => row.full_name_en },
                { key: 'email', header: 'Email', render: row => row.email }
              ]}
            />
          </DataState>
        </div>
      </div>
    </section>
  );
}
