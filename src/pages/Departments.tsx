import { Building2 } from 'lucide-react';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatCard } from '../components/StatCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { getDepartmentExecutionSummary } from '../lib/grcApi';
import type { DepartmentExecutionSummary } from '../types/domain';

export function Departments() {
  const departments = useAsyncData(getDepartmentExecutionSummary, []);
  const rows = departments.data || [];
  const totals = rows.reduce(
    (acc, row) => {
      acc.activeProjects += Number(row.active_projects || 0);
      acc.overdueProjects += Number(row.overdue_projects || 0);
      acc.overdueTasks += Number(row.overdue_tasks || 0);
      acc.criticalRisks += Number(row.critical_risks || 0);
      return acc;
    },
    { activeProjects: 0, overdueProjects: 0, overdueTasks: 0, criticalRisks: 0 }
  );

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Department control room"
        title="Master tracking across departments"
        subtitle="Use this page to see which departments are delayed, exposed to critical risk, or need management follow-up."
      />

      <div className="stats-grid">
        <StatCard label="Departments tracked" value={rows.length} />
        <StatCard label="Active projects" value={totals.activeProjects} />
        <StatCard label="Overdue projects" value={totals.overdueProjects} tone="danger" />
        <StatCard label="Overdue tasks" value={totals.overdueTasks} tone="warning" />
        <StatCard label="Critical risks" value={totals.criticalRisks} tone="danger" />
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4><Building2 size={18} /> Department execution summary</h4>
          <p>For full rollout, this view becomes the control room for 50 departments and all assigned action plans.</p>
        </div>
        <DataState loading={departments.loading} error={departments.error} empty={!rows.length}>
          <EntityTable<DepartmentExecutionSummary>
            rows={rows}
            getRowKey={row => row.department_id}
            columns={[
              { key: 'department', header: 'Department', render: row => <strong>{row.department_name}</strong> },
              { key: 'active', header: 'Active projects', render: row => row.active_projects },
              { key: 'overdueProjects', header: 'Overdue projects', render: row => row.overdue_projects ? <span className="danger-text">{row.overdue_projects}</span> : '0' },
              { key: 'overdueMilestones', header: 'Overdue milestones', render: row => row.overdue_milestones },
              { key: 'overdueTasks', header: 'Overdue tasks', render: row => row.overdue_tasks ? <span className="warning-text">{row.overdue_tasks}</span> : '0' },
              { key: 'risks', header: 'Critical risks', render: row => row.critical_risks ? <span className="risk-pill critical">{row.critical_risks}</span> : '0' },
              { key: 'audit', header: 'Overdue audit', render: row => row.overdue_audit_findings },
              { key: 'compliance', header: 'Compliance expiring', render: row => row.compliance_expiring_30_days }
            ]}
          />
        </DataState>
      </div>
    </section>
  );
}
