import { useMemo, useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { useAsyncData } from '../hooks/useAsyncData';
import { createDepartment, getDepartmentExecutionSummary } from '../lib/grcApi';
import type { DepartmentExecutionSummary } from '../types/domain';

type DepartmentFilter = 'all' | 'active' | 'overdueProjects' | 'overdueTasks' | 'criticalRisks';

export function Departments() {
  const auth = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<DepartmentFilter>('all');
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentExecutionSummary | null>(null);
  const departments = useAsyncData(getDepartmentExecutionSummary, []);
  const rows = departments.data || [];
  const filteredRows = useMemo(() => {
    const query = departmentSearch.trim().toLowerCase();
    return rows.filter(row => {
      const matchesFilter =
        activeFilter === 'all'
        || (activeFilter === 'active' && Number(row.active_projects || 0) > 0)
        || (activeFilter === 'overdueProjects' && Number(row.overdue_projects || 0) > 0)
        || (activeFilter === 'overdueTasks' && Number(row.overdue_tasks || 0) > 0)
        || (activeFilter === 'criticalRisks' && Number(row.critical_risks || 0) > 0);
      const matchesQuery = !query || [row.department_name].some(value => value?.toLowerCase().includes(query));
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, departmentSearch, rows]);
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
  const resetDashboardFilters = () => {
    setActiveFilter('all');
    setDepartmentSearch('');
    setSelectedDepartment(null);
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
          {[
            { key: 'all' as const, label: 'Departments tracked', value: rows.length, tone: 'normal' as const },
            { key: 'active' as const, label: 'Active projects', value: totals.activeProjects, tone: 'normal' as const },
            { key: 'overdueProjects' as const, label: 'Overdue projects', value: totals.overdueProjects, tone: 'danger' as const },
            { key: 'overdueTasks' as const, label: 'Overdue tasks', value: totals.overdueTasks, tone: 'warning' as const },
            { key: 'criticalRisks' as const, label: 'Critical risks', value: totals.criticalRisks, tone: 'danger' as const }
          ].map(card => (
            <button key={card.key} type="button" className={`stat-card ${card.tone} ${activeFilter === card.key ? 'active' : ''}`} onClick={() => setActiveFilter(card.key)}>
              <div className="stat-value">{card.value}</div>
              <div className="stat-label">{card.label}</div>
            </button>
          ))}
        </div>
      ) : null}

      <div className="panel">
        <div className="split-header">
          <div className="panel-header">
            <h4>Department dashboard filters</h4>
            <p>Showing {filteredRows.length} of {rows.length} departments. Click a department name for execution details.</p>
          </div>
          <button className="ghost-button" type="button" onClick={resetDashboardFilters}>Reset filters</button>
        </div>
        <div className="toolbar">
          <span className="status-badge status-info">Active filter: {activeFilter === 'all' ? 'All departments' : activeFilter.replace(/([A-Z])/g, ' $1')}</span>
          <input value={departmentSearch} onChange={event => setDepartmentSearch(event.target.value)} placeholder="Search department" />
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4><Building2 size={18} /> Department execution summary</h4>
          <p>Live department execution and risk indicators for the organization and role currently in scope.</p>
        </div>
        <DataState
          loading={departments.loading}
          error={departments.error}
          empty={!filteredRows.length}
          emptyTitle="No department execution data"
          emptyMessage={
            activeFilter !== 'all' || departmentSearch
              ? 'No departments match the selected filter. Reset filters or broaden the search.'
              : canManageDepartments
              ? 'Create or activate departments, then add controlled work to populate this summary.'
              : 'No department summary is available for your current role and scope.'
          }
        >
          <EntityTable<DepartmentExecutionSummary>
            rows={filteredRows}
            getRowKey={row => row.department_id}
            columns={[
              { key: 'department', header: 'Department', render: row => <button className="link-button" type="button" onClick={() => setSelectedDepartment(row)}><strong>{row.department_name}</strong></button> },
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
        {selectedDepartment ? (
          <div className="detail-panel">
            <div className="split-header">
              <div>
                <h4>Selected department drilldown</h4>
                <p>{selectedDepartment.department_name}</p>
              </div>
              <button className="ghost-button small" type="button" onClick={() => setSelectedDepartment(null)}>Clear selection</button>
            </div>
            <div className="detail-grid">
              <div><span>Active projects</span><strong>{selectedDepartment.active_projects}</strong></div>
              <div><span>Overdue projects</span><strong>{selectedDepartment.overdue_projects}</strong></div>
              <div><span>Overdue milestones</span><strong>{selectedDepartment.overdue_milestones}</strong></div>
              <div><span>Overdue tasks</span><strong>{selectedDepartment.overdue_tasks}</strong></div>
              <div><span>Critical risks</span><strong>{selectedDepartment.critical_risks}</strong></div>
              <div><span>Overdue audit</span><strong>{selectedDepartment.overdue_audit_findings}</strong></div>
              <div><span>Compliance expiring</span><strong>{selectedDepartment.compliance_expiring_30_days}</strong></div>
              <div><span>Next action</span><strong>{Number(selectedDepartment.overdue_projects || 0) + Number(selectedDepartment.overdue_tasks || 0) + Number(selectedDepartment.critical_risks || 0) > 0 ? 'Management follow-up required.' : 'No dashboard blocker currently recorded.'}</strong></div>
            </div>
          </div>
        ) : null}
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
