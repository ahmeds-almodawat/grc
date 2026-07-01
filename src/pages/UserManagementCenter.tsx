import { useEffect, useMemo, useState } from 'react';
import { Archive, Building2, Download, Eye, FileDown, FileUp, KeyRound, RefreshCw, RotateCcw, ShieldOff, UploadCloud, UserCog } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { Modal } from '../components/Modal';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { humanize } from '../lib/format';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';
import {
  applyImportBatch,
  archiveUser,
  deactivateUser,
  exportUserImportTemplate,
  exportUsers,
  exportValidationErrors,
  getUserManagementDepartments,
  getUserManagementSummary,
  listUsersWithFilters,
  parseUserImportCsv,
  readAuditHistory,
  reactivateUser,
  unarchiveUser,
  updateUserDepartment,
  updateUserProfile,
  updateUserRole,
  userRoleOptions,
  userStatusOptions,
  userTypeOptions,
  validateImportRows,
  type DepartmentLookup,
  type UserImportValidationResult,
  type UserManagementAuditRow,
  type UserManagementSummary,
  type UserManagementUserRow,
  type UserStatus,
  type UserType,
} from '../lib/userManagementApi';
import type { AccessScope, AppRole } from '../types/domain';

type LifecycleAction = 'deactivate' | 'reactivate' | 'archive' | 'unarchive';

const emptySummary: LiveResult<UserManagementSummary> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No user management summary loaded yet.',
};

const emptyUsers: LiveResult<UserManagementUserRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No user roster loaded yet.',
};

const emptyDepartments: LiveResult<DepartmentLookup[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No departments loaded yet.',
};

function statusTone(status?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!status) return 'neutral';
  if (status === 'active') return 'good';
  if (status === 'archived' || status === 'inactive' || status === 'locked') return 'danger';
  if (status === 'invited') return 'warning';
  return 'neutral';
}

function roleSummary(user: UserManagementUserRow): string {
  const roles = user.roles?.filter(role => role.is_active) ?? [];
  return roles.length ? roles.map(role => humanize(role.role)).join(', ') : 'No active role';
}

function activeRoleTotal(user: UserManagementUserRow): number {
  const activeRoles = user.roles?.filter(role => role.is_active).length ?? 0;
  return Math.max(user.active_role_count ?? 0, activeRoles);
}

function linkedRecordCount(user: UserManagementUserRow): number {
  return user.linked_project_count + user.linked_task_count + user.linked_approval_count + user.linked_evidence_count;
}

function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function nowFileStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

export function UserManagementCenter() {
  const auth = useAuth();
  const [summary, setSummary] = useState<LiveResult<UserManagementSummary>>(emptySummary);
  const [users, setUsers] = useState<LiveResult<UserManagementUserRow[]>>(emptyUsers);
  const [departments, setDepartments] = useState<LiveResult<DepartmentLookup[]>>(emptyDepartments);
  const [auditRows, setAuditRows] = useState<UserManagementAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<AppRole | 'all' | 'missing'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<UserType | 'all'>('all');
  const [missingDepartment, setMissingDepartment] = useState(false);
  const [missingRole, setMissingRole] = useState(false);
  const [neverLoggedIn, setNeverLoggedIn] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailUser, setDetailUser] = useState<UserManagementUserRow | null>(null);
  const [editUser, setEditUser] = useState<UserManagementUserRow | null>(null);
  const [departmentUser, setDepartmentUser] = useState<UserManagementUserRow | null>(null);
  const [roleUser, setRoleUser] = useState<UserManagementUserRow | null>(null);
  const [lifecycle, setLifecycle] = useState<{ action: LifecycleAction; users: UserManagementUserRow[] } | null>(null);
  const [reason, setReason] = useState('');
  const [profileDraft, setProfileDraft] = useState({
    fullNameEn: '',
    fullNameAr: '',
    employeeNo: '',
    jobTitle: '',
    userType: 'employee' as UserType,
  });
  const [departmentDraft, setDepartmentDraft] = useState('');
  const [roleDraft, setRoleDraft] = useState<AppRole>('employee');
  const [scopeDraft, setScopeDraft] = useState<AccessScope>('assigned_only');
  const [roleDepartmentDraft, setRoleDepartmentDraft] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importValidation, setImportValidation] = useState<UserImportValidationResult | null>(null);
  const [bulkDepartment, setBulkDepartment] = useState('');
  const [bulkRole, setBulkRole] = useState<AppRole>('employee');

  const canModify = Boolean(auth.isLocalBypass) || auth.roles.some(role => ['super_admin', 'governance_admin'].includes(role.role));
  const readOnly = !canModify || auth.roles.some(role => ['auditor', 'viewer'].includes(role.role))
    && !auth.roles.some(role => ['super_admin', 'governance_admin'].includes(role.role));

  const load = async () => {
    setLoading(true);
    setActionError(null);
    const [summaryResult, usersResult, departmentResult] = await Promise.all([
      getUserManagementSummary(),
      listUsersWithFilters({}),
      getUserManagementDepartments(),
    ]);
    setSummary(summaryResult);
    setUsers(usersResult);
    setDepartments(departmentResult);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const userRows = isLive(users) ? users.data : [];
  const departmentRows = isLive(departments) ? departments.data : [];
  const summaryData = isLive(summary) ? summary.data : null;
  const blockedLifecycleCount = (summaryData?.inactive_users ?? 0) + (summaryData?.archived_users ?? 0) + (summaryData?.locked_users ?? 0);
  const compatibilityMode = [summary.message, users.message].some(item => item?.includes('existing People/profiles'));
  const writeDisabled = readOnly;

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return userRows.filter(user => {
      const roleNames = roleSummary(user).toLowerCase();
      const inCurrentDepartment = !auth.roles.some(role => role.role === 'department_manager') || canModify
        || !auth.profile?.departmentId
        || user.department_id === auth.profile.departmentId;
      const matchesSearch = !query || [
        user.full_name_en,
        user.full_name_ar,
        user.email,
        user.employee_no,
        user.department_name,
        user.job_title,
        roleNames,
      ].filter(Boolean).join(' ').toLowerCase().includes(query);
      const matchesDepartment = !departmentFilter || user.department_id === departmentFilter;
      const matchesRole = roleFilter === 'all'
        || (roleFilter === 'missing' ? activeRoleTotal(user) === 0 : user.roles?.some(role => role.is_active && role.role === roleFilter));
      const matchesStatus = statusFilter === 'all' || user.user_status === statusFilter;
      const matchesType = typeFilter === 'all' || user.user_type === typeFilter;
      return inCurrentDepartment
        && matchesSearch
        && matchesDepartment
        && matchesRole
        && matchesStatus
        && matchesType
        && (!missingDepartment || !user.department_id)
        && (!missingRole || activeRoleTotal(user) === 0)
        && (!neverLoggedIn || !user.last_login_at);
    });
  }, [auth.profile?.departmentId, auth.roles, canModify, departmentFilter, missingDepartment, missingRole, neverLoggedIn, roleFilter, search, statusFilter, typeFilter, userRows]);

  const selectedUsers = visibleUsers.filter(user => selectedIds.has(user.user_id));
  const visibleUserIds = visibleUsers.map(user => user.user_id);
  const allVisibleSelected = visibleUserIds.length > 0 && visibleUserIds.every(userId => selectedIds.has(userId));

  const toggleSelected = (userId: string) => {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (allVisibleSelected) visibleUserIds.forEach(userId => next.delete(userId));
      else visibleUserIds.forEach(userId => next.add(userId));
      return next;
    });
  };

  const openDetails = async (user: UserManagementUserRow) => {
    setDetailUser(user);
    const result = await readAuditHistory(user.user_id);
    setAuditRows(isLive(result) ? result.data : []);
  };

  const openEdit = (user: UserManagementUserRow) => {
    setProfileDraft({
      fullNameEn: user.full_name_en,
      fullNameAr: user.full_name_ar ?? '',
      employeeNo: user.employee_no ?? '',
      jobTitle: user.job_title ?? '',
      userType: user.user_type,
    });
    setReason('Routine profile maintenance');
    setEditUser(user);
  };

  const openDepartment = (user: UserManagementUserRow) => {
    setDepartmentDraft(user.department_id ?? '');
    setReason('Department assignment review');
    setDepartmentUser(user);
  };

  const openRole = (user: UserManagementUserRow) => {
    setRoleDraft('employee');
    setScopeDraft('assigned_only');
    setRoleDepartmentDraft(user.department_id ?? '');
    setReason('Role assignment review');
    setRoleUser(user);
  };

  const runAction = async (operation: () => Promise<void>, success: string) => {
    setSaving(true);
    setActionError(null);
    setMessage(null);
    try {
      await operation();
      setMessage(success);
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'User management action failed.');
    } finally {
      setSaving(false);
    }
  };

  const submitProfile = async () => {
    if (!editUser) return;
    await runAction(
      () => updateUserProfile({
        userId: editUser.user_id,
        fullNameEn: profileDraft.fullNameEn,
        fullNameAr: profileDraft.fullNameAr,
        employeeNo: profileDraft.employeeNo,
        jobTitle: profileDraft.jobTitle,
        userType: profileDraft.userType,
        reason,
      }),
      'Profile updated.',
    );
    setEditUser(null);
  };

  const submitDepartment = async () => {
    const targets = departmentUser ? [departmentUser] : selectedUsers;
    if (!targets.length) {
      setActionError('Select at least one user.');
      return;
    }
    await runAction(
      async () => {
        await Promise.all(targets.map(user => updateUserDepartment({
          userId: user.user_id,
          departmentId: departmentDraft || null,
          reason,
        })));
      },
      `${targets.length} department assignment${targets.length === 1 ? '' : 's'} updated.`,
    );
    setDepartmentUser(null);
  };

  const submitRole = async () => {
    const targets = roleUser ? [roleUser] : selectedUsers;
    if (!targets.length) {
      setActionError('Select at least one user.');
      return;
    }
    await runAction(
      async () => {
        await Promise.all(targets.map(user => updateUserRole({
          userId: user.user_id,
          role: roleDraft,
          scope: scopeDraft,
          departmentId: scopeDraft === 'department' ? roleDepartmentDraft || user.department_id : null,
          reason,
        })));
      },
      `${targets.length} role assignment${targets.length === 1 ? '' : 's'} updated.`,
    );
    setRoleUser(null);
  };

  const submitLifecycle = async () => {
    if (!lifecycle || !reason.trim()) {
      setActionError('A reason is required before changing user status.');
      return;
    }
    const action = lifecycle.action;
    const targets = lifecycle.users;
    const actionMap: Record<LifecycleAction, (user: UserManagementUserRow, reasonText: string) => Promise<void>> = {
      deactivate: (user, reasonText) => deactivateUser(user.user_id, reasonText, user.roles),
      reactivate: (user, reasonText) => reactivateUser(user.user_id, reasonText),
      archive: (user, reasonText) => archiveUser(user.user_id, reasonText, user.roles),
      unarchive: (user, reasonText) => unarchiveUser(user.user_id, reasonText),
    };
    await runAction(
      async () => {
        await Promise.all(targets.map(user => actionMap[action](user, reason)));
      },
      `${targets.length} user${targets.length === 1 ? '' : 's'} ${action}d.`,
    );
    setLifecycle(null);
    setReason('');
  };

  const handleImportFile = async (file: File) => {
    setImportFileName(file.name);
    setActionError(null);
    const text = await file.text();
    const parsedRows = parseUserImportCsv(text);
    const validation = await validateImportRows(parsedRows);
    setImportValidation(validation);
  };

  const applyImport = async () => {
    if (!importValidation) return;
    await runAction(
      async () => {
        await applyImportBatch(importFileName || 'user-management-import.csv', importValidation);
      },
      'Import batch applied. Existing profiles were updated; unknown accounts were tracked for account creation.',
    );
    setImportOpen(false);
    setImportValidation(null);
  };

  const exportSelected = (rows: UserManagementUserRow[]) => {
    if (!rows.length) {
      setActionError('Select at least one user to export.');
      return;
    }
    downloadCsv(`user-management-${nowFileStamp()}.csv`, exportUsers(rows));
  };

  return (
    <section className="page-stack user-management-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Patch 19 · Professional user administration</p>
          <h1>User Management Center</h1>
          <p className="section-subtitle">
            Manage hospital rollout users with app-level deactivation, archive controls, preview-first CSV import,
            role/department assignment, and lifecycle audit history. User records are never hard-deleted here.
          </p>
        </div>
        <div className="inline-actions">
          <button className="ghost-button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> Refresh</button>
          <button className="ghost-button" onClick={() => downloadCsv('user-management-import-template.csv', exportUserImportTemplate())}><FileDown size={16} /> Export template</button>
          <button className="primary-button" onClick={() => setImportOpen(true)} disabled={writeDisabled}><UploadCloud size={16} /> Import CSV</button>
        </div>
      </section>

      {readOnly ? (
        <div className="notice-banner">Read-only mode is active for this role. User changes require Super Admin or Governance Admin access.</div>
      ) : null}
      {compatibilityMode ? (
        <div className="notice-banner">
          Showing existing People/profile records because Patch 19 user management views are not available yet. Actions use compatibility mode through existing profile RLS and role bridges; apply migration 080 to enable Patch 19 lifecycle audit history and import batch tracking.
        </div>
      ) : null}
      {blockedLifecycleCount > 0 ? (
        <div className="notice-banner">
          {blockedLifecycleCount} user account{blockedLifecycleCount === 1 ? '' : 's'} marked inactive, archived, or locked. Patch 19 keeps login recovery separate from lifecycle status; review assignments, workflow ownership, and signoffs before reactivation or reassignment.
        </div>
      ) : null}
      {message ? <div className="notice-banner">{message}</div> : null}
      {actionError ? <div className="form-error">{actionError}</div> : null}

      <DataState
        loading={loading}
        empty={!loading && !summaryData}
        emptyTitle="User management summary is not available"
        emptyMessage={getLiveResultMessage(summary)}
      >
        <div className="kpi-grid">
          <KpiTile label="Total users" value={summaryData?.total_users ?? 0} />
          <KpiTile label="Active users" value={summaryData?.active_users ?? 0} tone="good" />
          <KpiTile label="Inactive users" value={summaryData?.inactive_users ?? 0} tone={summaryData?.inactive_users ? 'warning' : 'neutral'} />
          <KpiTile label="Archived users" value={summaryData?.archived_users ?? 0} tone={summaryData?.archived_users ? 'danger' : 'neutral'} />
          <KpiTile label="Missing department" value={summaryData?.missing_department_users ?? 0} tone={summaryData?.missing_department_users ? 'warning' : 'good'} />
          <KpiTile label="Missing role" value={summaryData?.missing_role_users ?? 0} tone={summaryData?.missing_role_users ? 'warning' : 'good'} />
          <KpiTile label="Pending setup" value={summaryData?.pending_setup_users ?? 0} tone={summaryData?.pending_setup_users ? 'warning' : 'good'} />
        </div>
      </DataState>

      <ModernCard title="Advanced filters" subtitle="Filter by identity, department, role, status, type, setup gaps, and login availability.">
        <div className="form-grid">
          <label className="field">
            Search
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, email, employee ID, department, role" />
          </label>
          <label className="field">
            Department
            <select value={departmentFilter} onChange={event => setDepartmentFilter(event.target.value)}>
              <option value="">All departments</option>
              {departmentRows.map(department => (
                <option key={department.id} value={department.id}>{department.name_en}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Role
            <select value={roleFilter} onChange={event => setRoleFilter(event.target.value as AppRole | 'all' | 'missing')}>
              <option value="all">All roles</option>
              <option value="missing">Missing role</option>
              {userRoleOptions.map(role => <option key={role} value={role}>{humanize(role)}</option>)}
            </select>
          </label>
          <label className="field">
            Status
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as UserStatus | 'all')}>
              <option value="all">All statuses</option>
              {userStatusOptions.map(status => <option key={status} value={status}>{humanize(status)}</option>)}
            </select>
          </label>
          <label className="field">
            User type
            <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as UserType | 'all')}>
              <option value="all">All types</option>
              {userTypeOptions.map(type => <option key={type} value={type}>{humanize(type)}</option>)}
            </select>
          </label>
          <div className="field checkbox-field">
            <label><input type="checkbox" checked={missingDepartment} onChange={event => setMissingDepartment(event.target.checked)} /> Missing department</label>
            <label><input type="checkbox" checked={missingRole} onChange={event => setMissingRole(event.target.checked)} /> Missing role</label>
            <label><input type="checkbox" checked={neverLoggedIn} onChange={event => setNeverLoggedIn(event.target.checked)} /> Never logged in</label>
          </div>
        </div>
      </ModernCard>

      <ModernCard title="Bulk actions" subtitle="Selected users can be exported or updated through safe app-level actions." className="user-management-bulk-card">
        <div className="form-grid">
          <label className="field">
            Bulk department
            <select value={bulkDepartment} onChange={event => setBulkDepartment(event.target.value)} disabled={writeDisabled}>
              <option value="">No department</option>
              {departmentRows.map(department => (
                <option key={department.id} value={department.id}>{department.name_en}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Bulk role
            <select value={bulkRole} onChange={event => setBulkRole(event.target.value as AppRole)} disabled={writeDisabled}>
              {userRoleOptions.map(role => <option key={role} value={role}>{humanize(role)}</option>)}
            </select>
          </label>
          <div className="form-actions full-width">
            <button className="ghost-button" onClick={() => setSelectedIds(new Set(visibleUsers.map(user => user.user_id)))}>Select filtered</button>
            <button className="ghost-button" onClick={() => setSelectedIds(new Set())}>Clear</button>
            <button className="ghost-button" onClick={() => exportSelected(selectedUsers)}><Download size={16} /> Export selected</button>
            <button className="ghost-button" disabled={writeDisabled || !selectedUsers.length} onClick={() => {
              void runAction(
                async () => {
                  await Promise.all(selectedUsers.map(user => updateUserDepartment({
                    userId: user.user_id,
                    departmentId: bulkDepartment || null,
                    reason: 'Bulk department assignment',
                  })));
                },
                `${selectedUsers.length} department assignment${selectedUsers.length === 1 ? '' : 's'} updated.`,
              );
            }}>Bulk assign department</button>
            <button className="ghost-button" disabled={writeDisabled || !selectedUsers.length} onClick={() => {
              void runAction(
                async () => {
                  await Promise.all(selectedUsers.map(user => updateUserRole({
                    userId: user.user_id,
                    role: bulkRole,
                    scope: bulkDepartment ? 'department' : 'assigned_only',
                    departmentId: bulkDepartment || user.department_id,
                    reason: 'Bulk role assignment',
                  })));
                },
                `${selectedUsers.length} role assignment${selectedUsers.length === 1 ? '' : 's'} updated.`,
              );
            }}>Bulk assign role</button>
            <button className="ghost-button" disabled={writeDisabled || !selectedUsers.length} onClick={() => {
              setReason('');
              setLifecycle({ action: 'deactivate', users: selectedUsers });
            }}><ShieldOff size={16} /> Bulk deactivate</button>
            <button className="ghost-button" disabled={writeDisabled || !selectedUsers.length} onClick={() => {
              setReason('');
              setLifecycle({ action: 'archive', users: selectedUsers });
            }}><Archive size={16} /> Bulk archive</button>
          </div>
        </div>
      </ModernCard>

      <ModernCard title="User roster" subtitle={`${visibleUsers.length} user${visibleUsers.length === 1 ? '' : 's'} shown.`} className="user-roster-card">
        <DataState
          loading={loading}
          empty={!loading && visibleUsers.length === 0}
          emptyTitle="No users match the selected filters"
          emptyMessage={getLiveResultMessage(users)}
        >
          <div className="user-roster-scroll" tabIndex={0}>
            <table className="entity-table user-roster-table">
              <thead>
                <tr>
                  <th>
                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        aria-label="Select all visible users"
                      />
                      All
                    </label>
                  </th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Job title</th>
                  <th>Role(s)</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map(user => (
                  <tr key={user.user_id}>
                    <td><input type="checkbox" checked={selectedIds.has(user.user_id)} onChange={() => toggleSelected(user.user_id)} /></td>
                    <td className="user-roster-name"><strong>{user.full_name_en}</strong><br /><span className="muted">{user.full_name_ar || user.employee_no || 'No Arabic name / employee ID'}</span></td>
                    <td className="user-roster-email">{user.email}</td>
                    <td>{user.department_name ?? <span className="warning-text">Missing department</span>}</td>
                    <td>{user.job_title ?? 'Not set'}</td>
                    <td>{activeRoleTotal(user) ? roleSummary(user) : <span className="warning-text">Missing role</span>}</td>
                    <td><StatusPill tone={statusTone(user.user_status)}>{humanize(user.user_status)}</StatusPill></td>
                    <td>{user.last_login_at ?? 'Never / unavailable'}</td>
                    <td>{user.created_at?.slice(0, 10)}</td>
                    <td className="user-roster-actions-cell">
                      <div className="user-row-actions">
                        <button className="ghost-button compact-button icon-button" title="View details" aria-label={`View ${user.full_name_en}`} onClick={() => void openDetails(user)}><Eye size={14} /></button>
                        <button className="ghost-button compact-button icon-button" title="Edit profile" aria-label={`Edit ${user.full_name_en}`} disabled={writeDisabled} onClick={() => openEdit(user)}><UserCog size={14} /></button>
                        <button className="ghost-button compact-button icon-button" title="Assign role" aria-label={`Assign role to ${user.full_name_en}`} disabled={writeDisabled} onClick={() => openRole(user)}><KeyRound size={14} /></button>
                        <button className="ghost-button compact-button icon-button" title="Assign department" aria-label={`Assign department to ${user.full_name_en}`} disabled={writeDisabled} onClick={() => openDepartment(user)}><Building2 size={14} /></button>
                        {user.user_status === 'active' || user.user_status === 'invited' ? (
                          <button className="ghost-button compact-button icon-button" title="Deactivate user" aria-label={`Deactivate ${user.full_name_en}`} disabled={writeDisabled} onClick={() => {
                            setReason('');
                            setLifecycle({ action: 'deactivate', users: [user] });
                          }}><ShieldOff size={14} /></button>
                        ) : (
                          <button className="ghost-button compact-button icon-button" title="Reactivate user" aria-label={`Reactivate ${user.full_name_en}`} disabled={writeDisabled} onClick={() => {
                            setReason('Reactivation after admin review');
                            setLifecycle({ action: 'reactivate', users: [user] });
                          }}><RotateCcw size={14} /></button>
                        )}
                        {user.user_status === 'archived' ? (
                          <button className="ghost-button compact-button icon-button" title="Unarchive user" aria-label={`Unarchive ${user.full_name_en}`} disabled={writeDisabled} onClick={() => {
                            setReason('Unarchive after admin review');
                            setLifecycle({ action: 'unarchive', users: [user] });
                          }}><RotateCcw size={14} /></button>
                        ) : (
                          <button className="ghost-button compact-button icon-button" title="Archive user" aria-label={`Archive ${user.full_name_en}`} disabled={writeDisabled} onClick={() => {
                            setReason('');
                            setLifecycle({ action: 'archive', users: [user] });
                          }}><Archive size={14} /></button>
                        )}
                        <button className="ghost-button compact-button icon-button" title="Export user" aria-label={`Export ${user.full_name_en}`} onClick={() => exportSelected([user])}><Download size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </ModernCard>

      <Modal open={Boolean(detailUser)} title="User details" onClose={() => setDetailUser(null)}>
        {detailUser ? (
          <div className="page-stack">
            <div className="kpi-grid">
              <KpiTile label="Open projects" value={detailUser.open_project_count} />
              <KpiTile label="Open tasks" value={detailUser.open_task_count} />
              <KpiTile label="Pending approvals" value={detailUser.pending_approval_count} />
              <KpiTile label="Linked records" value={linkedRecordCount(detailUser)} tone={linkedRecordCount(detailUser) ? 'warning' : 'neutral'} />
            </div>
            <div className="panel">
              <h4>{detailUser.full_name_en}</h4>
              <p className="muted">{detailUser.email}</p>
              <p>Department: {detailUser.department_name ?? 'Missing department'}</p>
              <p>Role(s): {roleSummary(detailUser)}</p>
              <p>Status: {humanize(detailUser.user_status)}</p>
            </div>
            <div className="panel">
              <h4>Lifecycle audit history</h4>
              <DataState empty={!auditRows.length} emptyMessage="No Patch 19 user-management audit entries yet.">
                <div className="table-scroll">
                  <table className="entity-table">
                    <thead><tr><th>Action</th><th>Reason</th><th>Linked records</th><th>Date</th></tr></thead>
                    <tbody>
                      {auditRows.map(row => (
                        <tr key={row.id}>
                          <td>{humanize(row.action)}</td>
                          <td>{row.reason ?? 'Not recorded'}</td>
                          <td>{row.linked_record_count}</td>
                          <td>{row.created_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DataState>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(editUser)} title="Edit profile" onClose={() => setEditUser(null)}>
        <div className="form-grid">
          <label className="field">English name<input value={profileDraft.fullNameEn} onChange={event => setProfileDraft({ ...profileDraft, fullNameEn: event.target.value })} /></label>
          <label className="field">Arabic name<input value={profileDraft.fullNameAr} onChange={event => setProfileDraft({ ...profileDraft, fullNameAr: event.target.value })} dir="rtl" /></label>
          <label className="field">Employee ID<input value={profileDraft.employeeNo} onChange={event => setProfileDraft({ ...profileDraft, employeeNo: event.target.value })} /></label>
          <label className="field">Job title<input value={profileDraft.jobTitle} onChange={event => setProfileDraft({ ...profileDraft, jobTitle: event.target.value })} /></label>
          <label className="field">User type<select value={profileDraft.userType} onChange={event => setProfileDraft({ ...profileDraft, userType: event.target.value as UserType })}>{userTypeOptions.map(type => <option key={type} value={type}>{humanize(type)}</option>)}</select></label>
          <label className="field full-width">Reason<textarea value={reason} onChange={event => setReason(event.target.value)} /></label>
          <div className="form-actions full-width">
            <button className="ghost-button" onClick={() => setEditUser(null)}>Cancel</button>
            <button className="primary-button" disabled={saving || writeDisabled} onClick={() => void submitProfile()}>{saving ? 'Saving...' : 'Save profile'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(departmentUser)} title="Assign/change department" onClose={() => setDepartmentUser(null)}>
        <div className="form-grid">
          <label className="field full-width">
            Department
            <select value={departmentDraft} onChange={event => setDepartmentDraft(event.target.value)}>
              <option value="">No department</option>
              {departmentRows.map(department => <option key={department.id} value={department.id}>{department.name_en}</option>)}
            </select>
          </label>
          <label className="field full-width">Reason<textarea value={reason} onChange={event => setReason(event.target.value)} /></label>
          <div className="form-actions full-width">
            <button className="ghost-button" onClick={() => setDepartmentUser(null)}>Cancel</button>
            <button className="primary-button" disabled={saving || writeDisabled} onClick={() => void submitDepartment()}>{saving ? 'Saving...' : 'Save department'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(roleUser)} title="Assign/change role" onClose={() => setRoleUser(null)}>
        <div className="form-grid">
          <label className="field">Role<select value={roleDraft} onChange={event => setRoleDraft(event.target.value as AppRole)}>{userRoleOptions.map(role => <option key={role} value={role}>{humanize(role)}</option>)}</select></label>
          <label className="field">Scope<select value={scopeDraft} onChange={event => setScopeDraft(event.target.value as AccessScope)}><option value="assigned_only">Assigned only</option><option value="department">Department</option><option value="global">Global</option></select></label>
          {scopeDraft === 'department' ? (
            <label className="field full-width">Department<select value={roleDepartmentDraft} onChange={event => setRoleDepartmentDraft(event.target.value)}>{departmentRows.map(department => <option key={department.id} value={department.id}>{department.name_en}</option>)}</select></label>
          ) : null}
          <label className="field full-width">Reason<textarea value={reason} onChange={event => setReason(event.target.value)} /></label>
          <div className="notice-banner full-width">This action assigns the selected role through the server bridge and preserves the existing access model.</div>
          <div className="form-actions full-width">
            <button className="ghost-button" onClick={() => setRoleUser(null)}>Cancel</button>
            <button className="primary-button" disabled={saving || writeDisabled} onClick={() => void submitRole()}>{saving ? 'Saving...' : 'Save role'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(lifecycle)} title="Confirm user lifecycle action" onClose={() => setLifecycle(null)}>
        {lifecycle ? (
          <div className="form-grid">
            <div className="notice-banner full-width">
              This uses app-level {lifecycle.action}. Hard user deletion is not used. Active role assignments are disabled for deactivate/archive actions.
            </div>
            <div className="panel full-width">
              <strong>{lifecycle.users.length} user{lifecycle.users.length === 1 ? '' : 's'} selected</strong>
              <p className="muted">Linked evidence/workflow records detected: {lifecycle.users.reduce((sum, user) => sum + linkedRecordCount(user), 0)}</p>
            </div>
            <label className="field full-width">Reason required<textarea value={reason} onChange={event => setReason(event.target.value)} /></label>
            <div className="form-actions full-width">
              <button className="ghost-button" onClick={() => setLifecycle(null)}>Cancel</button>
              <button className="primary-button" disabled={saving || writeDisabled || !reason.trim()} onClick={() => void submitLifecycle()}>{saving ? 'Saving...' : `Confirm ${lifecycle.action}`}</button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={importOpen} title="Preview CSV import" onClose={() => setImportOpen(false)}>
        <div className="page-stack">
          <div className="notice-banner">
            CSV import is preview-first and Excel-compatible. Existing profiles can be updated; new Supabase Auth accounts are tracked for administrator creation and are not created from the browser.
          </div>
          <div className="inline-actions">
            <button className="ghost-button" onClick={() => downloadCsv('user-management-import-template.csv', exportUserImportTemplate())}><FileDown size={16} /> Template</button>
            {importValidation ? <button className="ghost-button" onClick={() => downloadCsv(`user-import-validation-${nowFileStamp()}.csv`, exportValidationErrors(importValidation.rows))}><FileDown size={16} /> Validation errors</button> : null}
          </div>
          <label className="field">
            Upload CSV
            <input type="file" accept=".csv,text/csv" onChange={event => {
              const file = event.target.files?.[0];
              if (file) void handleImportFile(file);
            }} />
          </label>
          {importValidation ? (
            <>
              <div className="kpi-grid">
                <KpiTile label="Rows" value={importValidation.rowCount} />
                <KpiTile label="Valid" value={importValidation.validCount} tone="good" />
                <KpiTile label="Invalid" value={importValidation.invalidCount} tone={importValidation.invalidCount ? 'danger' : 'good'} />
                <KpiTile label="Duplicate emails" value={importValidation.duplicateEmailCount} tone={importValidation.duplicateEmailCount ? 'danger' : 'good'} />
                <KpiTile label="Unknown departments" value={importValidation.unknownDepartmentCount} tone={importValidation.unknownDepartmentCount ? 'danger' : 'good'} />
                <KpiTile label="Unknown roles" value={importValidation.unknownRoleCount} tone={importValidation.unknownRoleCount ? 'danger' : 'good'} />
              </div>
              <div className="table-scroll">
                <table className="entity-table">
                  <thead><tr><th>Row</th><th>Name</th><th>Email</th><th>Department</th><th>Role</th><th>Status</th><th>Validation</th></tr></thead>
                  <tbody>
                    {importValidation.rows.slice(0, 50).map(row => (
                      <tr key={row.row_number}>
                        <td>{row.row_number}</td>
                        <td>{row.full_name_en}</td>
                        <td>{row.email}</td>
                        <td>{row.department}</td>
                        <td>{row.role}</td>
                        <td>{row.status}</td>
                        <td>
                          <StatusPill tone={row.validation_status === 'valid' ? 'good' : 'danger'}>{row.validation_status}</StatusPill>
                          <div className="muted">{[...(row.validation_errors ?? []), ...(row.validation_warnings ?? [])].join(' ')}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="form-actions">
                <button className="ghost-button" onClick={() => setImportValidation(null)}>Clear preview</button>
                <button className="primary-button" disabled={writeDisabled || saving || importValidation.invalidCount > 0} onClick={() => void applyImport()}><FileUp size={16} /> Apply validated import</button>
              </div>
            </>
          ) : null}
        </div>
      </Modal>
    </section>
  );
}
