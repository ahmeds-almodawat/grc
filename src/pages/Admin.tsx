import { DataState } from '../components/DataState';
import { ControlledPilotBanner } from '../components/ControlledPilotBanner';
import { EntityTable } from '../components/EntityTable';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatCard } from '../components/StatCard';
import { getDepartments, getPilotUiCounts, getProfiles } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { DepartmentOption, ProfileOption } from '../types/domain';

export function Admin() {
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);
  const counts = useAsyncData(getPilotUiCounts, []);
  const countValue = (value: number | null | undefined) => typeof value === 'number' ? value : 'Not configured';

  return (
    <section className="page-section">
      <ControlledPilotBanner />
      <ModuleHeader
        eyebrow="Admin and organization"
        title="Company hierarchy, users, roles and access scopes"
        subtitle="Access is controlled by role and scope: global, division, department, unit, or assigned only."
      />

      <div className="stats-grid">
        <StatCard label="Active profiles in scope" value={countValue(counts.data?.activeProfiles)} />
        <StatCard label="Active departments" value={countValue(counts.data?.activeDepartments)} />
      </div>

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
          <DataState
            loading={departments.loading}
            error={departments.error}
            empty={!departments.data?.length}
            emptyTitle="No active departments"
            emptyMessage="Create the organization structure from Admin Hub when authorized, then refresh this view."
          >
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
          <DataState
            loading={profiles.loading}
            error={profiles.error}
            empty={!profiles.data?.length}
            emptyTitle="No active profiles"
            emptyMessage="Bootstrap or create an authorized pilot user before assigning roles and department access."
          >
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
