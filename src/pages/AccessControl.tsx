import { useMemo, useState } from 'react';
import { ShieldCheck, UserPlus, UserX, AlertTriangle, Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  assignUserRole,
  createAdminUser,
  deactivateUserRole,
  getAccessControlSummary,
  getAccessControlUsers,
  getAccessControlWarnings,
  getDepartments,
  getOrganizations
} from '../lib/grcApi';
import { humanize } from '../lib/format';
import type { AccessControlUserRow, AccessScope, AppRole } from '../types/domain';

const roleOptions: AppRole[] = [
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
  'employee'
];

const scopeOptions: AccessScope[] = ['global', 'division', 'department', 'unit', 'assigned_only'];

function roleSummary(row: AccessControlUserRow) {
  if (!row.roles?.length) return 'No active role';
  return row.roles
    .filter(role => role.is_active)
    .map(role => `${humanize(role.role)} / ${humanize(role.scope)}`)
    .join(', ');
}

function RoleBadges({ row }: { row: AccessControlUserRow }) {
  const activeRoles = row.roles?.filter(role => role.is_active) || [];
  if (!activeRoles.length) return <span className="warning-text">No active role</span>;
  return (
    <div className="role-badge-wrap">
      {activeRoles.map(role => (
        <span key={role.user_role_id} className="role-badge">
          {humanize(role.role)} <small>{humanize(role.scope)}</small>
        </span>
      ))}
    </div>
  );
}

export function AccessControl() {
  const auth = useAuth();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [role, setRole] = useState<AppRole>('employee');
  const [scope, setScope] = useState<AccessScope>('assigned_only');
  const [departmentId, setDepartmentId] = useState('');
  const [reason, setReason] = useState('Initial rollout role assignment');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserNameEn, setNewUserNameEn] = useState('');
  const [newUserNameAr, setNewUserNameAr] = useState('');
  const [newUserDepartmentId, setNewUserDepartmentId] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('employee');
  const [newUserScope, setNewUserScope] = useState<AccessScope>('assigned_only');
  const [createUserError, setCreateUserError] = useState<string | null>(null);

  const summary = useAsyncData(getAccessControlSummary, []);
  const users = useAsyncData(getAccessControlUsers, []);
  const warnings = useAsyncData(getAccessControlWarnings, []);
  const organizations = useAsyncData(getOrganizations, []);
  const departments = useAsyncData(getDepartments, []);

  const organizationId = organizations.data?.[0]?.id || 'demo-org';
  const userRows = users.data || [];

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return userRows;
    return userRows.filter(row =>
      [row.full_name_en, row.full_name_ar, row.email, row.employee_no, row.department_name, roleSummary(row)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [search, userRows]);

  const selectedUser = userRows.find(row => row.user_id === selectedUserId);
  const isSuperAdmin = !auth.isLocalBypass && auth.roles.some(assignment => assignment.role === 'super_admin');

  const resetCreateUser = () => {
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserNameEn('');
    setNewUserNameAr('');
    setNewUserDepartmentId('');
    setNewUserRole('employee');
    setNewUserScope('assigned_only');
    setCreateUserError(null);
  };

  const submitNewUser = async () => {
    setCreateUserError(null);
    setMessage(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUserEmail.trim())) {
      setCreateUserError('Enter a valid email address.');
      return;
    }
    if (!newUserNameEn.trim()) {
      setCreateUserError('English full name is required.');
      return;
    }
    if (newUserPassword.length < 10) {
      setCreateUserError('Temporary password must contain at least 10 characters.');
      return;
    }
    if (newUserScope === 'department' && !newUserDepartmentId) {
      setCreateUserError('Department scope requires a department.');
      return;
    }

    setSaving(true);
    try {
      await createAdminUser({
        email: newUserEmail,
        password: newUserPassword,
        full_name_en: newUserNameEn,
        full_name_ar: newUserNameAr,
        department_id: newUserDepartmentId || null,
        role: newUserRole,
        scope: newUserScope
      });
      setCreateUserOpen(false);
      resetCreateUser();
      setMessage(`User ${newUserEmail.trim().toLowerCase()} created with ${humanize(newUserRole)} access.`);
      await Promise.all([users.refresh(), summary.refresh(), warnings.refresh()]);
    } catch (error) {
      setCreateUserError(error instanceof Error ? error.message : 'Could not create user.');
    } finally {
      setSaving(false);
    }
  };

  const submitRole = async () => {
    setActionError(null);
    setMessage(null);
    if (!selectedUserId) {
      setActionError('Select a user first.');
      return;
    }
    if (scope === 'department' && !departmentId) {
      setActionError('Department scope requires a department.');
      return;
    }
    setSaving(true);
    try {
      await assignUserRole({
        user_id: selectedUserId,
        role,
        scope,
        organization_id: organizationId,
        department_id: scope === 'department' ? departmentId : null,
        reason
      });
      setMessage('Role assigned. Refresh the page or reload this view to see the updated matrix.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not assign role.');
    } finally {
      setSaving(false);
    }
  };

  const removeRole = async (userRoleId: string) => {
    setActionError(null);
    setMessage(null);
    setSaving(true);
    try {
      await deactivateUserRole(userRoleId, 'Removed from Access Control Center');
      setMessage('Role deactivated. Refresh the page or reload this view to see the updated matrix.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not deactivate role.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Admin Governance"
        title="Access Control Center"
        subtitle="Manage role assignments safely for a 1,000-employee rollout. This page shows broad access, missing roles, scope issues, and operational workload per user."
        action={
          <div className="inline-actions">
            {isSuperAdmin ? (
              <button className="primary-button" onClick={() => {
                setCreateUserError(null);
                setCreateUserOpen(true);
              }}><Plus size={16} /> Create user</button>
            ) : null}
            <button className="ghost-button" onClick={() => users.refresh()}><ShieldCheck size={16} /> Refresh matrix</button>
          </div>
        }
      />

      {auth.isLocalBypass ? (
        <div className="notice-banner">
          User creation and role changes require a real authenticated Supabase session. Set <code>VITE_AUTH_BYPASS_LOCAL=false</code> and sign in.
        </div>
      ) : null}

      <DataState loading={summary.loading} error={summary.error} empty={!summary.data}>
        {summary.data ? (
          <div className="stats-grid">
            <StatCard label="Active users" value={summary.data.active_users} tone="success" />
            <StatCard label="Active role assignments" value={summary.data.active_role_assignments} />
            <StatCard label="Global roles" value={summary.data.global_role_assignments} tone="warning" />
            <StatCard label="Access warnings" value={summary.data.access_warnings} tone={summary.data.access_warnings ? 'danger' : 'success'} />
            <StatCard label="Users without roles" value={summary.data.active_users_without_roles} tone={summary.data.active_users_without_roles ? 'warning' : 'success'} />
            <StatCard label="Inactive users" value={summary.data.inactive_users} />
          </div>
        ) : null}
      </DataState>

      <div className="two-column align-start">
        <div className="panel">
          <div className="panel-header">
            <h4>Role assignment</h4>
            <p>Use RPC-controlled assignment instead of direct table edits. Scope validation protects global and department access.</p>
          </div>
          {actionError ? <div className="form-error">{actionError}</div> : null}
          {message ? <div className="notice-banner">{message}</div> : null}
          <div className="form-grid">
            <label className="field full-width">
              User
              <select value={selectedUserId} onChange={event => setSelectedUserId(event.target.value)}>
                <option value="">Select user</option>
                {userRows.map(user => (
                  <option key={user.user_id} value={user.user_id}>{user.full_name_en} — {user.email}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Role
              <select value={role} onChange={event => setRole(event.target.value as AppRole)}>
                {roleOptions.map(option => <option key={option} value={option}>{humanize(option)}</option>)}
              </select>
            </label>
            <label className="field">
              Scope
              <select value={scope} onChange={event => setScope(event.target.value as AccessScope)}>
                {scopeOptions.map(option => <option key={option} value={option}>{humanize(option)}</option>)}
              </select>
            </label>
            {scope === 'department' ? (
              <label className="field full-width">
                Department
                <select value={departmentId} onChange={event => setDepartmentId(event.target.value)}>
                  <option value="">Select department</option>
                  {(departments.data || []).map(department => (
                    <option key={department.id} value={department.id}>{department.name_en}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="field full-width">
              Reason / control note
              <textarea value={reason} onChange={event => setReason(event.target.value)} />
            </label>
            <div className="form-actions full-width">
              <button className="primary-button" onClick={submitRole} disabled={saving}>
                <UserPlus size={16} /> {saving ? 'Saving…' : 'Assign role'}
              </button>
            </div>
          </div>
          {selectedUser ? (
            <div className="mini-card access-selected-card">
              <span>Selected user current access</span>
              <strong>{selectedUser.full_name_en}</strong>
              <p className="muted">{roleSummary(selectedUser)}</p>
            </div>
          ) : null}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h4>Access warnings</h4>
            <p>Warnings do not block work, but they highlight risky access setups for review.</p>
          </div>
          <DataState loading={warnings.loading} error={warnings.error} empty={!warnings.data?.length} emptyMessage="No access warnings found.">
            <div className="warning-stack">
              {(warnings.data || []).map(warning => (
                <div key={warning.id} className="warning-card">
                  <div className="warning-title"><AlertTriangle size={16} /> {humanize(warning.warning_type)}</div>
                  <strong>{warning.full_name_en}</strong>
                  <p>{warning.warning_message}</p>
                  <StatusBadge status={warning.severity} />
                </div>
              ))}
            </div>
          </DataState>
        </div>
      </div>

      <div className="panel">
        <div className="split-header">
          <div>
            <h4>User access matrix</h4>
            <p className="muted">Search by name, email, employee number, department, role, or scope.</p>
          </div>
          <div className="toolbar">
            <input placeholder="Search access matrix…" value={search} onChange={event => setSearch(event.target.value)} />
          </div>
        </div>

        <DataState loading={users.loading} error={users.error} empty={!filteredUsers.length}>
          <EntityTable
            rows={filteredUsers}
            getRowKey={row => row.user_id}
            columns={[
              {
                key: 'user',
                header: 'User',
                render: row => <><strong>{row.full_name_en}</strong><br /><span className="muted">{row.employee_no || 'No employee no.'} · {row.email}</span></>
              },
              {
                key: 'org',
                header: 'Org scope',
                render: row => <>{row.division_name || '—'}<br /><span className="muted">{row.department_name || 'No department'}{row.unit_name ? ` / ${row.unit_name}` : ''}</span></>
              },
              {
                key: 'roles',
                header: 'Active roles',
                render: row => <RoleBadges row={row} />
              },
              {
                key: 'workload',
                header: 'Workload',
                render: row => <>{row.owned_open_projects} projects<br /><span className="muted">{row.open_tasks} tasks · {row.pending_approvals} approvals</span></>
              },
              {
                key: 'actions',
                header: 'Actions',
                render: row => (
                  <div className="inline-actions">
                    <button className="ghost-button compact-button" onClick={() => setSelectedUserId(row.user_id)}>Select</button>
                    {(row.roles || []).filter(item => item.is_active).slice(0, 3).map(item => (
                      <button key={item.user_role_id} className="ghost-button compact-button" onClick={() => removeRole(item.user_role_id)} disabled={saving}>
                        <UserX size={13} /> Remove {humanize(item.role)}
                      </button>
                    ))}
                  </div>
                )
              }
            ]}
          />
        </DataState>
      </div>

      <Modal open={createUserOpen} title="Create controlled pilot user" onClose={() => {
        if (!saving) {
          setCreateUserOpen(false);
          resetCreateUser();
        }
      }}>
        <div className="form-grid">
          {createUserError ? <div className="form-error full-width">{createUserError}</div> : null}
          <div className="notice-banner full-width">
            This creates a Supabase Auth user through the authenticated server bridge. The service-role key is never exposed to the browser.
          </div>
          <label className="field">
            English full name
            <input value={newUserNameEn} onChange={event => setNewUserNameEn(event.target.value)} />
          </label>
          <label className="field">
            Arabic full name
            <input value={newUserNameAr} onChange={event => setNewUserNameAr(event.target.value)} dir="rtl" />
          </label>
          <label className="field">
            Email
            <input type="email" value={newUserEmail} onChange={event => setNewUserEmail(event.target.value)} autoComplete="off" />
          </label>
          <label className="field">
            Temporary password
            <input type="password" value={newUserPassword} onChange={event => setNewUserPassword(event.target.value)} autoComplete="new-password" />
          </label>
          <label className="field">
            Department
            <select value={newUserDepartmentId} onChange={event => setNewUserDepartmentId(event.target.value)}>
              <option value="">No department</option>
              {(departments.data || []).map(department => (
                <option key={department.id} value={department.id}>{department.name_en}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Role
            <select value={newUserRole} onChange={event => setNewUserRole(event.target.value as AppRole)}>
              {roleOptions.map(option => <option key={option} value={option}>{humanize(option)}</option>)}
            </select>
          </label>
          <label className="field full-width">
            Scope
            <select value={newUserScope} onChange={event => setNewUserScope(event.target.value as AccessScope)}>
              <option value="assigned_only">Assigned only</option>
              <option value="department">Department</option>
              <option value="global">Global</option>
            </select>
          </label>
          <div className="form-actions full-width">
            <button className="ghost-button" type="button" disabled={saving} onClick={() => {
              setCreateUserOpen(false);
              resetCreateUser();
            }}>Cancel</button>
            <button className="primary-button" type="button" disabled={saving} onClick={submitNewUser}>
              <UserPlus size={16} /> {saving ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
