import { useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatCard } from '../components/StatCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { createDepartment, getDepartmentExecutionSummary } from '../lib/grcApi';
import type { DepartmentExecutionSummary } from '../types/domain';

export function Departments() {
  const auth = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const departments = useAsyncData(getDepartmentExecutionSummary, []);
  const rows = departments.data || [];
  const canManageDepartments = !auth.isLocalBypass && auth.roles.some(
    assignment => assignment.role === 'super_admin' || assignment.role === 'governance_admin'
  );
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

  const resetForm = () => {
    setNameEn('');
    setNameAr('');
    setCode('');
    setActionError(null);
  };

  const submitDepartment = async () => {
    setActionError(null);
    setMessage(null);
    if (!nameEn.trim()) {
      setActionError('English department name is required.');
      return;
    }
    if (!/^[A-Za-z0-9_-]{2,24}$/.test(code.trim())) {
      setActionError('Code must be 2-24 letters, numbers, underscores, or hyphens.');
      return;
    }

    setSaving(true);
    try {
      const created = await createDepartment({
        name_en: nameEn,
        name_ar: nameAr,
        code
      });
      setMessage(`Department ${created.name_en} (${created.code}) created.`);
      setFormOpen(false);
      resetForm();
      await departments.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not create department.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Department control room"
        title="Master tracking across departments"
        subtitle="Use this page to see which departments are delayed, exposed to critical risk, or need management follow-up."
        action={canManageDepartments ? (
          <button className="primary-button" onClick={() => {
            setActionError(null);
            setFormOpen(true);
          }}>
            <Plus size={16} /> Create department
          </button>
        ) : null}
      />

      {auth.isLocalBypass ? (
        <div className="notice-banner">
          Department creation requires a real authenticated Supabase session. Set <code>VITE_AUTH_BYPASS_LOCAL=false</code> and sign in.
        </div>
      ) : null}
      {message ? <div className="notice-banner">{message}</div> : null}

      {rows.length ? (
        <div className="stats-grid">
          <StatCard label="Departments tracked" value={rows.length} />
          <StatCard label="Active projects" value={totals.activeProjects} />
          <StatCard label="Overdue projects" value={totals.overdueProjects} tone="danger" />
          <StatCard label="Overdue tasks" value={totals.overdueTasks} tone="warning" />
          <StatCard label="Critical risks" value={totals.criticalRisks} tone="danger" />
        </div>
      ) : null}

      <div className="panel">
        <div className="panel-header">
          <h4><Building2 size={18} /> Department execution summary</h4>
          <p>Live department execution and risk indicators for the organization and role currently in scope.</p>
        </div>
        <DataState
          loading={departments.loading}
          error={departments.error}
          empty={!rows.length}
          emptyTitle="No department execution data"
          emptyMessage={
            canManageDepartments
              ? 'Create or activate departments, then add controlled work to populate this summary.'
              : 'No department summary is available for your current role and scope.'
          }
        >
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

      <Modal open={formOpen} title="Create department" onClose={() => {
        if (!saving) {
          setFormOpen(false);
          resetForm();
        }
      }}>
        <div className="form-grid">
          {actionError ? <div className="form-error full-width">{actionError}</div> : null}
          <label className="field full-width">
            English name
            <input value={nameEn} onChange={event => setNameEn(event.target.value)} placeholder="Information Technology" />
          </label>
          <label className="field full-width">
            Arabic name
            <input value={nameAr} onChange={event => setNameAr(event.target.value)} placeholder="Optional" dir="rtl" />
          </label>
          <label className="field full-width">
            Department code
            <input value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="IT" maxLength={24} />
          </label>
          <div className="form-actions full-width">
            <button className="ghost-button" type="button" disabled={saving} onClick={() => {
              setFormOpen(false);
              resetForm();
            }}>Cancel</button>
            <button className="primary-button" type="button" disabled={saving} onClick={submitDepartment}>
              <Plus size={16} /> {saving ? 'Creating…' : 'Create department'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
