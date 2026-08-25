import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  BellRing,
  Building2,
  CheckCircle2,
  ChevronRight,
  Database,
  FileClock,
  FileSpreadsheet,
  History,
  KeyRound,
  LockKeyhole,
  Network,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  ShieldX,
  SlidersHorizontal,
  UploadCloud,
  UserCog,
  Users,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { Modal } from '../components/Modal';
import { isPatch83uCredentialGovernanceEnabled } from '../config/featureFlags';
import { useI18n } from '../i18n/I18nContext';
import { formatDate, humanize } from '../lib/format';
import {
  loadUi8AdministrationSnapshot,
  type Ui8AdministrationSnapshot,
  type Ui8DepartmentRow,
} from '../lib/ui8AdministrationApi';
import {
  UI8_ADMIN_VIEWS,
  UI8_RELEASE_BASELINE,
  UI8_ROLE_DEFINITIONS,
  activeUserRoles,
  countActiveRoleAssignments,
  countActiveSuperAdmins,
  ui8Actionability,
  ui8AdminPermissions,
  type Ui8Actionability,
  type Ui8AdminView,
} from '../lib/ui8AdministrationModel';
import type { UserManagementUserRow } from '../lib/userManagementApi';
import type { PageKey } from '../routes/pageLocation';

type Bilingual = { en: string; ar: string };

const VIEW_COPY: Record<Ui8AdminView, Bilingual> = {
  overview: { en: 'System Overview', ar: 'نظرة عامة على النظام' },
  users: { en: 'Users & Access', ar: 'المستخدمون والوصول' },
  roles: { en: 'Roles & Permissions', ar: 'الأدوار والصلاحيات' },
  organization: { en: 'Organizations', ar: 'الهيكل التنظيمي' },
  integrations: { en: 'Integrations', ar: 'التكاملات' },
  settings: { en: 'System Settings', ar: 'إعدادات النظام' },
  notifications: { en: 'Notifications', ar: 'الإشعارات' },
  audit: { en: 'Audit Logs', ar: 'سجلات التدقيق' },
  data: { en: 'Data Management', ar: 'إدارة البيانات' },
  system: { en: 'System Information', ar: 'معلومات النظام' },
};

const VIEW_ICONS: Record<Ui8AdminView, ReactNode> = {
  overview: <Activity size={17} />,
  users: <Users size={17} />,
  roles: <KeyRound size={17} />,
  organization: <Building2 size={17} />,
  integrations: <Network size={17} />,
  settings: <Settings2 size={17} />,
  notifications: <BellRing size={17} />,
  audit: <History size={17} />,
  data: <Database size={17} />,
  system: <SlidersHorizontal size={17} />,
};

const ACTION_COPY: Record<Ui8Actionability, Bilingual> = {
  connected: { en: 'Connected', ar: 'متصل' },
  permission_gated: { en: 'Permission-gated', ar: 'مقيد بالصلاحية' },
  disabled_with_reason: { en: 'Unavailable', ar: 'غير متاح' },
  not_applicable: { en: 'Not applicable', ar: 'غير منطبق' },
};

function statusTone(status: string) {
  if (status === 'active' || status === 'connected' || status === 'compatible') return 'success';
  if (status === 'inactive' || status === 'archived' || status === 'disabled_with_reason') return 'neutral';
  if (status === 'locked' || status === 'permission_gated') return 'danger';
  return 'warning';
}

const ARABIC_AUDIT_ACTIONS: Record<string, string> = {
  credential_provisioning_prepared: 'تم إعداد تزويد بيانات الاعتماد',
  role_assigned: 'تم تعيين الدور',
  role_removed: 'تمت إزالة الدور',
  role_reviewed: 'تمت مراجعة الدور',
  user_activated: 'تم تفعيل المستخدم',
  user_deactivated: 'تم تعطيل المستخدم',
  user_archived: 'تمت أرشفة المستخدم',
  department_changed: 'تم تغيير الإدارة',
  profile_updated: 'تم تحديث الملف',
  credential_reset: 'تمت إعادة ضبط بيانات الاعتماد',
  import_executed: 'تم تنفيذ الاستيراد',
};

function auditActionLabel(action: string, language: 'en' | 'ar') {
  return language === 'ar' ? ARABIC_AUDIT_ACTIONS[action] ?? humanize(action, language) : humanize(action, language);
}

function StateChip({ state, label }: { state: Ui8Actionability; label: string }) {
  return (
    <span className={`ui8-state ui8-state--${statusTone(state)}`} data-actionability={state}>
      <span aria-hidden="true" />
      {label}
    </span>
  );
}

function EmptyState({ icon, title, message }: { icon: ReactNode; title: string; message: string }) {
  return (
    <div className="ui8-empty" role="status">
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

export function AdministrationCenter({ setPage }: { setPage: (page: PageKey) => void }) {
  const auth = useAuth();
  const { language, direction } = useI18n();
  const [view, setView] = useState<Ui8AdminView>('overview');
  const [snapshot, setSnapshot] = useState<Ui8AdministrationSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<UserManagementUserRow | null>(null);

  const text = useCallback((copy: Bilingual) => copy[language], [language]);
  const permissions = useMemo(() => ui8AdminPermissions(auth.roles), [auth.roles]);
  const patch83uEnabled = isPatch83uCredentialGovernanceEnabled();
  const patch83uConnected = patch83uEnabled && Boolean(auth.patch83uCapabilities);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setSnapshot(await loadUi8AdministrationSnapshot(auth.profile?.organizationId));
    } catch {
      setSnapshot(null);
      setLoadError(language === 'ar'
        ? 'تعذر فتح حدود بيانات الإدارة المحكومة لهذه الجلسة.'
        : 'The governed administration data boundary could not be opened for this session.');
    } finally {
      setLoading(false);
    }
  }, [auth.profile?.organizationId, language]);

  useEffect(() => {
    void load();
  }, [load]);

  const users = snapshot?.users ?? [];
  const summary = snapshot?.summary;
  const activeSuperAdmins = countActiveSuperAdmins(users);
  const activeAssignments = countActiveRoleAssignments(users);
  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return users.filter((user) => {
      if (statusFilter !== 'all' && user.user_status !== statusFilter) return false;
      if (!needle) return true;
      return [user.full_name_en, user.full_name_ar, user.employee_no, user.department_name, user.job_title]
        .some((value) => value?.toLocaleLowerCase().includes(needle));
    });
  }, [search, statusFilter, users]);

  const userAudit = useMemo(() => (
    selectedUser
      ? (snapshot?.audit ?? []).filter((row) => row.target_user_id === selectedUser.user_id)
      : []
  ), [selectedUser, snapshot?.audit]);

  const departmentsByDivision = useMemo(() => {
    const grouped = new Map<string, Ui8DepartmentRow[]>();
    (snapshot?.departments ?? []).forEach((department) => {
      const key = department.division_id ?? 'unassigned';
      grouped.set(key, [...(grouped.get(key) ?? []), department]);
    });
    return grouped;
  }, [snapshot?.departments]);

  const openPage = (page: PageKey) => setPage(page);
  const isArabic = language === 'ar';
  const actionLabel = (state: Ui8Actionability) => text(ACTION_COPY[state]);

  const renderOverview = () => {
    const healthRows = [
      {
        label: text({ en: 'Authenticated data boundary', ar: 'حدود البيانات المصادق عليها' }),
        detail: text({ en: 'Organization-scoped reads are active', ar: 'القراءات المقيدة بالمنظمة نشطة' }),
        ok: Boolean(snapshot),
      },
      {
        label: 'Patch83U',
        detail: text({ en: 'Credential governance contract', ar: 'عقد حوكمة بيانات الاعتماد' }),
        ok: patch83uConnected,
      },
      {
        label: text({ en: 'Role scope integrity', ar: 'سلامة نطاق الأدوار' }),
        detail: text({ en: '12-role model and scoped assignments', ar: 'نموذج 12 دوراً وتعيينات محددة النطاق' }),
        ok: auth.roles.length > 0,
      },
    ];
    return (
      <div className="ui8-view" data-testid="ui8-admin-overview">
        <div className="ui8-kpi-grid">
          {[
            { icon: <Users />, label: text({ en: 'Total users', ar: 'إجمالي المستخدمين' }), value: summary?.total_users ?? users.length, tone: 'blue' },
            { icon: <CheckCircle2 />, label: text({ en: 'Active users', ar: 'المستخدمون النشطون' }), value: summary?.active_users ?? users.filter((user) => user.is_active).length, tone: 'green' },
            { icon: <KeyRound />, label: text({ en: 'Active role assignments', ar: 'تعيينات الأدوار النشطة' }), value: activeAssignments, tone: 'violet' },
            { icon: <ShieldX />, label: text({ en: 'Access attention', ar: 'حالات وصول تحتاج مراجعة' }), value: (summary?.missing_role_users ?? 0) + (summary?.locked_users ?? 0), tone: 'orange' },
          ].map((item) => (
            <article className={`ui8-kpi ui8-kpi--${item.tone}`} key={item.label}>
              <span>{item.icon}</span>
              <small>{item.label}</small>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>

        <div className="ui8-overview-grid">
          <section className="ui8-surface" aria-labelledby="ui8-health-title">
            <div className="ui8-section-heading">
              <div>
                <span>{text({ en: 'Runtime posture', ar: 'وضع التشغيل' })}</span>
                <h2 id="ui8-health-title">{text({ en: 'System health', ar: 'سلامة النظام' })}</h2>
              </div>
              <StateChip state={snapshot ? 'connected' : 'disabled_with_reason'} label={snapshot ? actionLabel('connected') : actionLabel('disabled_with_reason')} />
            </div>
            <div className="ui8-health-list">
              {healthRows.map((row) => (
                <div key={row.label}>
                  <span className={`ui8-health-icon ${row.ok ? 'ok' : 'blocked'}`}>
                    {row.ok ? <CheckCircle2 size={18} /> : <ShieldX size={18} />}
                  </span>
                  <span><strong>{row.label}</strong><small>{row.detail}</small></span>
                  <b>{row.ok ? text({ en: 'Pass', ar: 'ناجح' }) : text({ en: 'Unavailable', ar: 'غير متاح' })}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="ui8-surface" aria-labelledby="ui8-quick-title">
            <div className="ui8-section-heading">
              <div>
                <span>{text({ en: 'Governed paths', ar: 'المسارات المحكومة' })}</span>
                <h2 id="ui8-quick-title">{text({ en: 'Quick actions', ar: 'إجراءات سريعة' })}</h2>
              </div>
            </div>
            <div className="ui8-action-list">
              <button type="button" onClick={() => openPage('admin')}>
                <UserCog size={18} /><span><strong>{text({ en: 'Manage users', ar: 'إدارة المستخدمين' })}</strong><small>Patch19 / Patch83T / Patch83U</small></span><ChevronRight size={17} />
              </button>
              <button type="button" onClick={() => openPage('accessControl')}>
                <KeyRound size={18} /><span><strong>{text({ en: 'Review role assignments', ar: 'مراجعة تعيينات الأدوار' })}</strong><small>{text({ en: 'Scoped authority controls', ar: 'ضوابط الصلاحيات محددة النطاق' })}</small></span><ChevronRight size={17} />
              </button>
              <button type="button" onClick={() => openPage('departments')}>
                <Building2 size={18} /><span><strong>{text({ en: 'Organization structure', ar: 'الهيكل التنظيمي' })}</strong><small>Patch83R</small></span><ChevronRight size={17} />
              </button>
            </div>
          </section>
        </div>

        <section className="ui8-surface" aria-labelledby="ui8-activity-title">
          <div className="ui8-section-heading">
            <div>
              <span>{text({ en: 'Trusted source', ar: 'مصدر موثوق' })}</span>
              <h2 id="ui8-activity-title">{text({ en: 'Recent administrative activity', ar: 'النشاط الإداري الأخير' })}</h2>
              <p>{text({ en: 'User-governance history only; no fabricated cross-module feed.', ar: 'سجل حوكمة المستخدمين فقط، دون إنشاء سجل شامل غير موثوق.' })}</p>
            </div>
            <button type="button" className="ui8-link-button" onClick={() => setView('audit')}>{text({ en: 'View logs', ar: 'عرض السجلات' })}</button>
          </div>
          {(snapshot?.audit.length ?? 0) > 0 ? (
            <div className="ui8-activity-list">
              {snapshot!.audit.slice(0, 5).map((event) => (
                <div key={event.id}>
                  <span><FileClock size={17} /></span>
                  <span><strong>{auditActionLabel(event.action, language)}</strong><small>{event.reason || text({ en: 'No rationale recorded', ar: 'لم يسجل مبرر' })}</small></span>
                  <time>{formatDate(event.created_at)}</time>
                </div>
              ))}
            </div>
          ) : <EmptyState icon={<History />} title={text({ en: 'No activity available', ar: 'لا يوجد نشاط متاح' })} message={text({ en: 'The governed user history source returned no records.', ar: 'لم يُرجع مصدر سجل المستخدمين المحكوم أي سجلات.' })} />}
        </section>
      </div>
    );
  };

  const renderUsers = () => (
    <div className="ui8-view" data-testid="ui8-admin-users">
      <section className="ui8-surface">
        <div className="ui8-section-heading ui8-section-heading--actions">
          <div>
            <span>Patch19 / Patch83U</span>
            <h2>{text({ en: 'User register', ar: 'سجل المستخدمين' })}</h2>
            <p>{text({ en: 'Auth identity, profile, lifecycle, assignment, and safe credential metadata.', ar: 'هوية المصادقة والملف ودورة الحياة والتعيينات وبيانات الاعتماد الآمنة.' })}</p>
          </div>
          <div className="ui8-heading-actions">
            <button type="button" className="ui8-secondary-button" disabled title={text({ en: 'Single-user creation is not exposed by the current governed provisioning contract. Use controlled onboarding.', ar: 'إنشاء مستخدم منفرد غير متاح في عقد التزويد المحكوم الحالي. استخدم الاستيراد المنضبط.' })}>
              <UserCog size={16} />{text({ en: 'Create user', ar: 'إنشاء مستخدم' })}
            </button>
            <button type="button" className="ui8-primary-button" onClick={() => openPage('admin')}>
              <UploadCloud size={16} />{text({ en: 'Controlled onboarding', ar: 'التهيئة المنضبطة' })}
            </button>
          </div>
        </div>
        <div className="ui8-toolbar">
          <label className="ui8-search">
            <span className="sr-only">{text({ en: 'Search users', ar: 'البحث عن المستخدمين' })}</span>
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text({ en: 'Search name, Employee ID, department...', ar: 'البحث بالاسم أو رقم الموظف أو الإدارة...' })} />
          </label>
          <label>
            <span className="sr-only">{text({ en: 'Filter by lifecycle status', ar: 'تصفية حسب حالة دورة الحياة' })}</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">{text({ en: 'All statuses', ar: 'جميع الحالات' })}</option>
              {['active', 'inactive', 'archived', 'invited', 'locked'].map((status) => <option key={status} value={status}>{humanize(status, language)}</option>)}
            </select>
          </label>
          <span>{filteredUsers.length} {text({ en: 'users', ar: 'مستخدمين' })}</span>
        </div>
        {filteredUsers.length ? (
          <div className="ui8-table-wrap" tabIndex={0} aria-label={text({ en: 'User register table', ar: 'جدول سجل المستخدمين' })}>
            <table className="ui8-table">
              <thead><tr>
                <th>{text({ en: 'User', ar: 'المستخدم' })}</th><th>{text({ en: 'Employee ID', ar: 'رقم الموظف' })}</th><th>{text({ en: 'Organization scope', ar: 'نطاق المنظمة' })}</th><th>{text({ en: 'Roles / scope', ar: 'الأدوار والنطاق' })}</th><th>{text({ en: 'Credential state', ar: 'حالة بيانات الاعتماد' })}</th><th>{text({ en: 'Status', ar: 'الحالة' })}</th><th>{text({ en: 'Action', ar: 'الإجراء' })}</th>
              </tr></thead>
              <tbody>{filteredUsers.map((user) => (
                <tr key={user.user_id}>
                  <td data-label={text({ en: 'User', ar: 'المستخدم' })}><strong>{isArabic ? user.full_name_ar || user.full_name_en : user.full_name_en}</strong><small>{user.job_title || text({ en: 'No job title', ar: 'لا يوجد مسمى وظيفي' })}</small></td>
                  <td data-label={text({ en: 'Employee ID', ar: 'رقم الموظف' })}><code>{user.employee_no || text({ en: 'Missing', ar: 'مفقود' })}</code></td>
                  <td data-label={text({ en: 'Organization scope', ar: 'نطاق المنظمة' })}><strong>{isArabic ? user.department_name_ar || user.department_name : user.department_name}</strong><small>{user.division_name || text({ en: 'Division not assigned', ar: 'القطاع غير معين' })}</small></td>
                  <td data-label={text({ en: 'Roles / scope', ar: 'الأدوار والنطاق' })}><div className="ui8-chip-wrap">{activeUserRoles(user).length ? activeUserRoles(user).map((role) => <span className="ui8-role-chip" key={role.user_role_id}>{humanize(role.role, language)} · {humanize(role.scope, language)}</span>) : <span className="ui8-warning-text">{text({ en: 'No active role', ar: 'لا يوجد دور نشط' })}</span>}</div></td>
                  <td data-label={text({ en: 'Credential state', ar: 'حالة بيانات الاعتماد' })}><span className={`ui8-status ui8-status--${statusTone(user.credential_state || 'unavailable')}`}>{user.credential_proof_available ? humanize(user.credential_state || 'unavailable', language) : text({ en: 'Protected state unavailable', ar: 'الحالة المحمية غير متاحة' })}</span></td>
                  <td data-label={text({ en: 'Status', ar: 'الحالة' })}><span className={`ui8-status ui8-status--${statusTone(user.user_status)}`}>{humanize(user.user_status, language)}</span></td>
                  <td data-label={text({ en: 'Action', ar: 'الإجراء' })}><button type="button" className="ui8-row-button" onClick={() => setSelectedUser(user)}>{text({ en: 'View details', ar: 'عرض التفاصيل' })}</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState icon={<Users />} title={text({ en: 'No matching users', ar: 'لا يوجد مستخدمون مطابقون' })} message={text({ en: 'Change the search or lifecycle filter.', ar: 'غيّر البحث أو مرشح دورة الحياة.' })} />}
      </section>
    </div>
  );

  const renderRoles = () => {
    const assignments = users.flatMap((user) => activeUserRoles(user).map((role) => ({ user, role })));
    const lastAdminState = activeSuperAdmins === 1 ? 'permission_gated' : 'connected';
    return (
      <div className="ui8-view" data-testid="ui8-admin-roles">
        <div className="ui8-safety-band">
          <ShieldCheck size={21} />
          <span><strong>{text({ en: 'Super Admin safety is server-enforced', ar: 'حماية مدير النظام مفروضة من الخادم' })}</strong><small>{activeSuperAdmins === 1 ? text({ en: 'One active global Super Admin is visible. Removal and deactivation remain protected by the governed action.', ar: 'يوجد مدير نظام عالمي نشط واحد ظاهر. تظل الإزالة والتعطيل محميين بالإجراء المحكوم.' }) : text({ en: `${activeSuperAdmins} active global Super Admins are visible in the current organization.`, ar: `يوجد ${activeSuperAdmins} من مديري النظام العالميين النشطين في المنظمة الحالية.` })}</small></span>
          <StateChip state={lastAdminState} label={activeSuperAdmins === 1 ? text({ en: 'Last-admin protected', ar: 'آخر مدير محمي' }) : actionLabel('connected')} />
        </div>
        <section className="ui8-surface">
          <div className="ui8-section-heading ui8-section-heading--actions">
            <div><span>{text({ en: 'Authoritative model', ar: 'النموذج المعتمد' })}</span><h2>{text({ en: '12 roles and scoped authority', ar: '12 دوراً وصلاحيات محددة النطاق' })}</h2><p>{text({ en: 'Scope is part of every assignment. It is never reduced to a global checkbox.', ar: 'النطاق جزء من كل تعيين ولا يختزل أبداً في مربع اختيار عالمي.' })}</p></div>
            <button type="button" className="ui8-primary-button" onClick={() => openPage('accessControl')}><KeyRound size={16} />{text({ en: 'Open governed role controls', ar: 'فتح ضوابط الأدوار المحكومة' })}</button>
          </div>
          <div className="ui8-role-grid">
            {UI8_ROLE_DEFINITIONS.map((definition) => (
              <article key={definition.role}>
                <span className={`ui8-role-mark ui8-role-mark--${definition.authority}`}><KeyRound size={15} /></span>
                <strong>{humanize(definition.role, language)}</strong>
                <small>{definition.allowedScopes.map((scope) => humanize(scope, language)).join(', ')}</small>
                <span>{humanize(definition.authority, language)}</span>
              </article>
            ))}
          </div>
        </section>
        <section className="ui8-surface">
          <div className="ui8-section-heading"><div><span>{text({ en: 'Current organization', ar: 'المنظمة الحالية' })}</span><h2>{text({ en: 'Active assignments', ar: 'التعيينات النشطة' })}</h2><p>{text({ en: 'Cross-organization assignment remains denied by the current Edge and database contract.', ar: 'يظل التعيين عبر المنظمات مرفوضاً بموجب عقد Edge وقاعدة البيانات الحالي.' })}</p></div><strong>{assignments.length}</strong></div>
          {assignments.length ? <div className="ui8-table-wrap" tabIndex={0}><table className="ui8-table"><thead><tr><th>{text({ en: 'User', ar: 'المستخدم' })}</th><th>{text({ en: 'Role', ar: 'الدور' })}</th><th>{text({ en: 'Scope', ar: 'النطاق' })}</th><th>{text({ en: 'Scope target', ar: 'هدف النطاق' })}</th><th>{text({ en: 'Effective', ar: 'فعال' })}</th></tr></thead><tbody>{assignments.map(({ user, role }) => <tr key={`${user.user_id}-${role.user_role_id}`}><td data-label={text({ en: 'User', ar: 'المستخدم' })}><strong>{isArabic ? user.full_name_ar || user.full_name_en : user.full_name_en}</strong><small>{user.employee_no}</small></td><td data-label={text({ en: 'Role', ar: 'الدور' })}>{humanize(role.role, language)}</td><td data-label={text({ en: 'Scope', ar: 'النطاق' })}><span className="ui8-role-chip">{humanize(role.scope, language)}</span></td><td data-label={text({ en: 'Scope target', ar: 'هدف النطاق' })}>{role.scope === 'global' ? text({ en: 'Current organization', ar: 'المنظمة الحالية' }) : user.division_name || user.department_name || text({ en: 'Assigned records', ar: 'السجلات المعينة' })}</td><td data-label={text({ en: 'Effective', ar: 'فعال' })}><span className="ui8-status ui8-status--success">{text({ en: 'Active', ar: 'نشط' })}</span></td></tr>)}</tbody></table></div> : <EmptyState icon={<KeyRound />} title={text({ en: 'No assignments visible', ar: 'لا توجد تعيينات ظاهرة' })} message={text({ en: 'No active role assignments were returned for this organization.', ar: 'لم تعد أي تعيينات أدوار نشطة لهذه المنظمة.' })} />}
        </section>
      </div>
    );
  };

  const renderOrganization = () => (
    <div className="ui8-view" data-testid="ui8-admin-organization">
      <section className="ui8-org-banner">
        <span><Building2 size={22} /></span>
        <div><small>{text({ en: 'Current organization', ar: 'المنظمة الحالية' })}</small><h2>{isArabic ? snapshot?.organization?.name_ar || snapshot?.organization?.name_en : snapshot?.organization?.name_en}</h2><p>{text({ en: 'Organization', ar: 'المنظمة' })} → {text({ en: 'Division', ar: 'القطاع' })} → {text({ en: 'Department', ar: 'الإدارة' })}</p></div>
        <span className={`ui8-status ui8-status--${statusTone(snapshot?.organization?.is_active ? 'active' : 'inactive')}`}>{snapshot?.organization?.is_active ? text({ en: 'Active', ar: 'نشطة' }) : text({ en: 'Unavailable', ar: 'غير متاحة' })}</span>
      </section>
      <section className="ui8-surface">
        <div className="ui8-section-heading ui8-section-heading--actions"><div><span>Patch83R</span><h2>{text({ en: 'Division and department structure', ar: 'هيكل القطاعات والإدارات' })}</h2><p>{text({ en: 'Department lifecycle uses archive and restore, dependency preview, and governed import. No hard delete is exposed.', ar: 'تستخدم دورة حياة الإدارة الأرشفة والاستعادة ومعاينة التبعيات والاستيراد المحكوم، ولا يتاح الحذف النهائي.' })}</p></div><button type="button" className="ui8-primary-button" onClick={() => openPage('departments')}><Building2 size={16} />{text({ en: 'Open department controls', ar: 'فتح ضوابط الإدارات' })}</button></div>
        <div className="ui8-org-tree">
          {(snapshot?.divisions ?? []).map((division) => {
            const departments = departmentsByDivision.get(division.id) ?? [];
            return <article key={division.id}><header><span><Building2 size={17} /></span><div><strong>{isArabic ? division.name_ar || division.name_en : division.name_en}</strong><small>{division.code || text({ en: 'No division code', ar: 'لا يوجد رمز للقطاع' })}</small></div><span className={`ui8-status ui8-status--${statusTone(division.is_active ? 'active' : 'inactive')}`}>{division.is_active ? text({ en: 'Active', ar: 'نشط' }) : text({ en: 'Inactive', ar: 'غير نشط' })}</span></header><div>{departments.length ? departments.map((department) => <div className="ui8-department-row" key={department.id}><span><strong>{isArabic ? department.name_ar || department.name_en : department.name_en}</strong><small>{department.code || text({ en: 'No code', ar: 'لا يوجد رمز' })}</small></span><span className={`ui8-status ui8-status--${statusTone(department.is_active && !department.archived_at ? 'active' : 'archived')}`}>{department.is_active && !department.archived_at ? text({ en: 'Active', ar: 'نشطة' }) : text({ en: 'Archived', ar: 'مؤرشفة' })}</span></div>) : <p>{text({ en: 'No departments in this division.', ar: 'لا توجد إدارات في هذا القطاع.' })}</p>}</div></article>;
          })}
          {!snapshot?.divisions.length ? <EmptyState icon={<Building2 />} title={text({ en: 'No divisions visible', ar: 'لا توجد قطاعات ظاهرة' })} message={text({ en: 'The organization-scoped division source returned no rows.', ar: 'لم يرجع مصدر القطاعات المقيد بالمنظمة أي صفوف.' })} /> : null}
          {(departmentsByDivision.get('unassigned')?.length ?? 0) > 0 ? <article className="ui8-org-unassigned"><header><span><ShieldX size={17} /></span><div><strong>{text({ en: 'Division assignment required', ar: 'يلزم تعيين القطاع' })}</strong><small>{text({ en: 'Review before assigning scoped authority', ar: 'راجع قبل تعيين صلاحية محددة النطاق' })}</small></div></header><div>{departmentsByDivision.get('unassigned')!.map((department) => <div className="ui8-department-row" key={department.id}><span><strong>{department.name_en}</strong><small>{department.code}</small></span><span className="ui8-status ui8-status--warning">{text({ en: 'Unassigned', ar: 'غير معينة' })}</span></div>)}</div></article> : null}
        </div>
      </section>
    </div>
  );

  const statusSurface = (
    testId: string,
    eyebrow: string,
    title: string,
    description: string,
    items: Array<{ icon: ReactNode; title: string; detail: string; state: Ui8Actionability; reason?: string }>,
  ) => (
    <div className="ui8-view" data-testid={testId}>
      <section className="ui8-surface">
        <div className="ui8-section-heading"><div><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div></div>
        <div className="ui8-control-grid">
          {items.map((item) => <article key={item.title} data-actionability={item.state}><header><span>{item.icon}</span><StateChip state={item.state} label={actionLabel(item.state)} /></header><h3 className={item.title.startsWith('VITE_') ? 'ui8-technical-heading' : undefined}>{item.title}</h3><p>{item.detail}</p>{item.reason ? <div className="ui8-disabled-reason"><LockKeyhole size={15} /><span>{item.reason}</span></div> : null}</article>)}
        </div>
      </section>
    </div>
  );

  const renderIntegrations = () => statusSurface(
    'ui8-admin-integrations',
    text({ en: 'Safe metadata only', ar: 'بيانات وصفية آمنة فقط' }),
    text({ en: 'Integration status', ar: 'حالة التكاملات' }),
    text({ en: 'Secret values and secret editors are intentionally absent.', ar: 'قيم الأسرار ومحررات الأسرار غير معروضة عمداً.' }),
    [
      { icon: <Database size={19} />, title: text({ en: 'Supabase data boundary', ar: 'حدود بيانات Supabase' }), detail: text({ en: 'Authenticated organization-scoped reads through RLS.', ar: 'قراءات مصادق عليها ومقيدة بالمنظمة عبر RLS.' }), state: snapshot ? 'connected' : 'disabled_with_reason', reason: snapshot ? undefined : text({ en: 'No authenticated governed response is available.', ar: 'لا توجد استجابة محكومة مصادق عليها.' }) },
      { icon: <ShieldCheck size={19} />, title: 'Patch83U Edge governance', detail: text({ en: 'Credential capability and bootstrap contract.', ar: 'عقد قدرات بيانات الاعتماد والتهيئة.' }), state: patch83uConnected ? 'connected' : 'disabled_with_reason', reason: patch83uConnected ? undefined : text({ en: 'The current build/session did not establish the capability contract.', ar: 'لم يثبت الإصدار أو الجلسة الحالية عقد القدرات.' }) },
      { icon: <Network size={19} />, title: text({ en: 'External provider administration', ar: 'إدارة المزودات الخارجية' }), detail: text({ en: 'No governed secret-management workflow exists in this release.', ar: 'لا يوجد مسار محكوم لإدارة الأسرار في هذا الإصدار.' }), state: 'disabled_with_reason', reason: text({ en: 'Provider credentials cannot be viewed or edited in the browser.', ar: 'لا يمكن عرض بيانات اعتماد المزود أو تعديلها في المتصفح.' }) },
    ],
  );

  const renderSettings = () => statusSurface(
    'ui8-admin-settings',
    text({ en: 'Configuration posture', ar: 'وضع الإعدادات' }),
    text({ en: 'System settings', ar: 'إعدادات النظام' }),
    text({ en: 'Only settings backed by a governed runtime contract may be changed here.', ar: 'لا يمكن تغيير إلا الإعدادات المدعومة بعقد تشغيل محكوم.' }),
    [
      { icon: <ShieldCheck size={19} />, title: 'VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED', detail: patch83uEnabled ? text({ en: 'Enabled in the current build.', ar: 'مفعل في الإصدار الحالي.' }) : text({ en: 'Disabled in the current build.', ar: 'غير مفعل في الإصدار الحالي.' }), state: 'not_applicable', reason: text({ en: 'Build-time configuration is read-only and is not a runtime Admin toggle.', ar: 'إعداد وقت البناء للقراءة فقط وليس مفتاح إدارة أثناء التشغيل.' }) },
      { icon: <KeyRound size={19} />, title: text({ en: 'Employee ID sign-in', ar: 'تسجيل الدخول برقم الموظف' }), detail: text({ en: 'Normalization remains part of the authoritative authentication flow.', ar: 'تظل المعالجة جزءاً من مسار المصادقة المعتمد.' }), state: 'not_applicable', reason: text({ en: 'Authentication policy cannot be changed from this page.', ar: 'لا يمكن تغيير سياسة المصادقة من هذه الصفحة.' }) },
      { icon: <Settings2 size={19} />, title: text({ en: 'Mutable application settings', ar: 'إعدادات التطبيق القابلة للتغيير' }), detail: text({ en: 'No audited organization configuration contract is available in this release.', ar: 'لا يتوفر عقد إعدادات منظمة مدقق في هذا الإصدار.' }), state: 'disabled_with_reason', reason: text({ en: 'A frontend-only setting would not be authoritative or auditable.', ar: 'الإعداد المحفوظ في الواجهة فقط لن يكون معتمداً أو قابلاً للتدقيق.' }) },
    ],
  );

  const renderNotifications = () => statusSurface(
    'ui8-admin-notifications',
    text({ en: 'Delivery governance', ar: 'حوكمة التسليم' }),
    text({ en: 'Notification administration', ar: 'إدارة الإشعارات' }),
    text({ en: 'Personal notifications are separate from system-wide delivery configuration.', ar: 'الإشعارات الشخصية منفصلة عن إعدادات التسليم على مستوى النظام.' }),
    [
      { icon: <BellRing size={19} />, title: text({ en: 'System notification policy', ar: 'سياسة إشعارات النظام' }), detail: text({ en: 'No mutable, audited administration contract is currently exposed.', ar: 'لا يتوفر حالياً عقد إدارة قابل للتغيير ومدقق.' }), state: 'disabled_with_reason', reason: text({ en: 'Delivery rules cannot be simulated with browser-only state.', ar: 'لا يمكن محاكاة قواعد التسليم بحالة محفوظة في المتصفح فقط.' }) },
      { icon: <Network size={19} />, title: text({ en: 'Email / SMS providers', ar: 'مزودو البريد والرسائل' }), detail: text({ en: 'Provider secrets and delivery credentials are not browser-readable.', ar: 'أسرار المزود وبيانات اعتماد التسليم غير قابلة للقراءة من المتصفح.' }), state: 'not_applicable', reason: text({ en: 'Use the governed deployment process for provider configuration.', ar: 'استخدم عملية النشر المحكومة لإعداد المزود.' }) },
    ],
  );

  const renderAudit = () => (
    <div className="ui8-view" data-testid="ui8-admin-audit">
      <section className="ui8-surface">
        <div className="ui8-section-heading ui8-section-heading--actions"><div><span>{text({ en: 'Auditable administration', ar: 'إدارة قابلة للتدقيق' })}</span><h2>{text({ en: 'Administrative history', ar: 'السجل الإداري' })}</h2><p>{text({ en: 'This surface displays the trusted user-management audit source only.', ar: 'يعرض هذا السطح مصدر تدقيق إدارة المستخدمين الموثوق فقط.' })}</p></div>{permissions.canOpenSafetyConsole ? <button type="button" className="ui8-secondary-button" onClick={() => openPage('adminSafety')}><ShieldCheck size={16} />{text({ en: 'Open safety console', ar: 'فتح وحدة السلامة' })}</button> : <StateChip state="permission_gated" label={actionLabel('permission_gated')} />}</div>
        {(snapshot?.audit.length ?? 0) > 0 ? <div className="ui8-timeline">{snapshot!.audit.map((event) => <article key={event.id}><span><FileClock size={16} /></span><div><header><strong>{auditActionLabel(event.action, language)}</strong><time>{formatDate(event.created_at)}</time></header><p>{event.reason || text({ en: 'No rationale recorded', ar: 'لم يسجل مبرر' })}</p><small>{event.linked_record_count} {text({ en: 'linked records', ar: 'سجلات مرتبطة' })}</small></div></article>)}</div> : <EmptyState icon={<History />} title={text({ en: 'No administrative history', ar: 'لا يوجد سجل إداري' })} message={text({ en: 'No trusted user-management audit rows are visible for this scope.', ar: 'لا توجد صفوف تدقيق موثوقة لإدارة المستخدمين ظاهرة لهذا النطاق.' })} />}
      </section>
    </div>
  );

  const renderData = () => (
    <div className="ui8-view" data-testid="ui8-admin-data">
      <section className="ui8-surface">
        <div className="ui8-section-heading"><div><span>Patch83M / O / S / T</span><h2>{text({ en: 'Controlled import and onboarding', ar: 'الاستيراد والتهيئة المنضبطان' })}</h2><p>{text({ en: 'Preview, validation, duplicate detection, scope checks, and fail-closed execution remain in the established workflows.', ar: 'تظل المعاينة والتحقق واكتشاف التكرار وفحوص النطاق والتنفيذ المغلق عند الفشل ضمن المسارات المعتمدة.' })}</p></div></div>
        <div className="ui8-data-grid">
          <article><span><Users size={20} /></span><div><StateChip state={ui8Actionability(true, permissions.canManageUsers)} label={actionLabel(ui8Actionability(true, permissions.canManageUsers))} /><h3>{text({ en: 'User onboarding', ar: 'تهيئة المستخدمين' })}</h3><p>{text({ en: 'Patch83T Excel preview and protected provisioning queue. No browser-side Auth creation.', ar: 'معاينة Excel وفق Patch83T وقائمة التزويد المحمية، دون إنشاء هوية مصادقة من المتصفح.' })}</p><ul><li>{text({ en: 'Dry-run and validation', ar: 'معاينة والتحقق' })}</li><li>{text({ en: 'Role and department mapping', ar: 'ربط الأدوار والإدارات' })}</li><li>{text({ en: 'Explicit execution confirmation', ar: 'تأكيد صريح للتنفيذ' })}</li></ul><button type="button" onClick={() => openPage('admin')} disabled={!permissions.canManageUsers}><UploadCloud size={16} />{text({ en: 'Open user import', ar: 'فتح استيراد المستخدمين' })}</button></div></article>
          <article><span><Building2 size={20} /></span><div><StateChip state={ui8Actionability(true, permissions.canManageStructure)} label={actionLabel(ui8Actionability(true, permissions.canManageStructure))} /><h3>{text({ en: 'Department import', ar: 'استيراد الإدارات' })}</h3><p>{text({ en: 'Patch83R lifecycle and governed department workbook execution.', ar: 'دورة حياة Patch83R وتنفيذ ملف الإدارات المحكوم.' })}</p><ul><li>{text({ en: 'Organization-scoped validation', ar: 'تحقق مقيد بالمنظمة' })}</li><li>{text({ en: 'Active and archived reference checks', ar: 'فحص المراجع النشطة والمؤرشفة' })}</li><li>{text({ en: 'No hard delete', ar: 'لا يوجد حذف نهائي' })}</li></ul><button type="button" onClick={() => openPage('departments')} disabled={!permissions.canManageStructure}><FileSpreadsheet size={16} />{text({ en: 'Open department import', ar: 'فتح استيراد الإدارات' })}</button></div></article>
        </div>
      </section>
    </div>
  );

  const renderSystem = () => (
    <div className="ui8-view" data-testid="ui8-admin-system">
      <section className="ui8-surface">
        <div className="ui8-section-heading"><div><span>{text({ en: 'Non-secret metadata', ar: 'بيانات وصفية غير سرية' })}</span><h2>{text({ en: 'System information', ar: 'معلومات النظام' })}</h2><p>{text({ en: 'This page never displays keys, tokens, cookies, credentials, or private configuration.', ar: 'لا تعرض هذه الصفحة المفاتيح أو الرموز أو ملفات تعريف الارتباط أو بيانات الاعتماد أو الإعدادات الخاصة.' })}</p></div></div>
        <dl className="ui8-system-list">
          <div><dt>{text({ en: 'Application', ar: 'التطبيق' })}</dt><dd>Almodawat Assurance Control Center</dd></div>
          <div><dt>{text({ en: 'Release train', ar: 'مسار الإصدار' })}</dt><dd>GRC v1.4 / UI-8</dd></div>
          <div><dt>{text({ en: 'Repository migration ceiling', ar: 'سقف ترحيل المستودع' })}</dt><dd><code>{UI8_RELEASE_BASELINE}</code></dd></div>
          <div><dt>{text({ en: 'Authentication contract', ar: 'عقد المصادقة' })}</dt><dd>{text({ en: 'Employee ID managed with Patch83U capability bootstrap', ar: 'إدارة برقم الموظف مع تهيئة قدرات Patch83U' })}</dd></div>
          <div><dt>{text({ en: 'Routing contract', ar: 'عقد التوجيه' })}</dt><dd><code>?page=</code> {text({ en: 'canonical routes', ar: 'المسارات المعتمدة' })}</dd></div>
          <div><dt>{text({ en: 'Current organization', ar: 'المنظمة الحالية' })}</dt><dd>{auth.profile?.organizationName || text({ en: 'Unavailable', ar: 'غير متاحة' })}</dd></div>
          <div><dt>{text({ en: 'Patch83U frontend contract', ar: 'عقد واجهة Patch83U' })}</dt><dd><span className={`ui8-status ui8-status--${patch83uConnected ? 'success' : 'warning'}`}>{patch83uConnected ? text({ en: 'Established', ar: 'مثبت' }) : text({ en: 'Unavailable', ar: 'غير متاح' })}</span></dd></div>
        </dl>
      </section>
    </div>
  );

  const renderView = () => {
    switch (view) {
      case 'overview': return renderOverview();
      case 'users': return renderUsers();
      case 'roles': return renderRoles();
      case 'organization': return renderOrganization();
      case 'integrations': return renderIntegrations();
      case 'settings': return renderSettings();
      case 'notifications': return renderNotifications();
      case 'audit': return renderAudit();
      case 'data': return renderData();
      case 'system': return renderSystem();
    }
  };

  return (
    <section className="ui8-admin" dir={direction} data-testid="ui8-administration-center">
      <header className="ui8-header">
        <div>
          <span>{text({ en: 'Administration / Governed control plane', ar: 'الإدارة / مستوى تحكم محكوم' })}</span>
          <h1>{text({ en: 'Administration', ar: 'الإدارة' })}</h1>
          <p>{text({ en: 'Organization-scoped users, authority, structure, onboarding, and system posture.', ar: 'المستخدمون والصلاحيات والهيكل والتهيئة ووضع النظام ضمن نطاق المنظمة.' })}</p>
        </div>
        <div className="ui8-header-actions">
          <div><small>{text({ en: 'Signed-in authority', ar: 'صلاحية المستخدم الحالي' })}</small><strong>{humanize(auth.primaryRole, language)}</strong></div>
          <button type="button" className="ui8-icon-button" onClick={() => void load()} disabled={loading} title={text({ en: 'Refresh administration data', ar: 'تحديث بيانات الإدارة' })} aria-label={text({ en: 'Refresh administration data', ar: 'تحديث بيانات الإدارة' })}><RefreshCw size={18} className={loading ? 'spin' : undefined} /></button>
        </div>
      </header>

      <nav className="ui8-tabs" aria-label={text({ en: 'Administration views', ar: 'أقسام الإدارة' })}>
        {UI8_ADMIN_VIEWS.map((item) => <button type="button" key={item} className={view === item ? 'active' : undefined} aria-current={view === item ? 'page' : undefined} onClick={() => setView(item)}>{VIEW_ICONS[item]}<span>{text(VIEW_COPY[item])}</span></button>)}
      </nav>

      {snapshot?.messages.length ? <details className="ui8-data-notice"><summary>{text({ en: 'Some governed sources are unavailable', ar: 'بعض المصادر المحكومة غير متاحة' })}</summary><ul>{snapshot.messages.map((message) => <li key={message}>{isArabic ? 'تعذر تحميل أحد مصادر البيانات المحكومة لهذا النطاق.' : message}</li>)}</ul></details> : null}
      {loadError ? <div className="ui8-error" role="alert"><ShieldX size={18} /><span>{loadError}</span><button type="button" onClick={() => void load()}>{text({ en: 'Retry', ar: 'إعادة المحاولة' })}</button></div> : null}
      {loading && !snapshot ? <div className="ui8-loading" role="status"><RefreshCw size={20} className="spin" /><span>{text({ en: 'Loading governed administration data...', ar: 'جار تحميل بيانات الإدارة المحكومة...' })}</span></div> : renderView()}

      <Modal open={Boolean(selectedUser)} onClose={() => setSelectedUser(null)} title={text({ en: 'User details', ar: 'تفاصيل المستخدم' })} size="large">
        {selectedUser ? <div className="ui8-user-detail" data-testid="ui8-user-detail">
          <header><span><UserCog size={22} /></span><div><h3>{isArabic ? selectedUser.full_name_ar || selectedUser.full_name_en : selectedUser.full_name_en}</h3><p>{selectedUser.job_title || text({ en: 'No job title', ar: 'لا يوجد مسمى وظيفي' })}</p></div><span className={`ui8-status ui8-status--${statusTone(selectedUser.user_status)}`}>{humanize(selectedUser.user_status, language)}</span></header>
          <dl>
            <div><dt>{text({ en: 'Employee ID', ar: 'رقم الموظف' })}</dt><dd><code>{selectedUser.employee_no || text({ en: 'Missing', ar: 'مفقود' })}</code></dd></div>
            <div><dt>{text({ en: 'Identity mode', ar: 'نمط الهوية' })}</dt><dd>{selectedUser.credential_proof_available ? humanize(selectedUser.identity_mode || 'unverified', language) : text({ en: 'Protected identity unavailable', ar: 'الهوية المحمية غير متاحة' })}</dd></div>
            <div><dt>{text({ en: 'Division', ar: 'القطاع' })}</dt><dd>{selectedUser.division_name || text({ en: 'Not assigned', ar: 'غير معين' })}</dd></div>
            <div><dt>{text({ en: 'Department', ar: 'الإدارة' })}</dt><dd>{isArabic ? selectedUser.department_name_ar || selectedUser.department_name : selectedUser.department_name || text({ en: 'Not assigned', ar: 'غير معينة' })}</dd></div>
            <div><dt>{text({ en: 'Credential state', ar: 'حالة بيانات الاعتماد' })}</dt><dd>{selectedUser.credential_proof_available ? humanize(selectedUser.credential_state || 'unavailable', language) : text({ en: 'Protected state unavailable', ar: 'الحالة المحمية غير متاحة' })}</dd></div>
            <div><dt>{text({ en: 'Last login', ar: 'آخر تسجيل دخول' })}</dt><dd>{formatDate(selectedUser.last_login_at)}</dd></div>
          </dl>
          <section><h4>{text({ en: 'Role assignments', ar: 'تعيينات الأدوار' })}</h4><div className="ui8-detail-roles">{activeUserRoles(selectedUser).map((role) => <article key={role.user_role_id}><strong>{humanize(role.role, language)}</strong><span>{humanize(role.scope, language)}</span><small>{role.scope === 'global' ? text({ en: 'Current organization', ar: 'المنظمة الحالية' }) : selectedUser.department_name || selectedUser.division_name || text({ en: 'Assigned records', ar: 'السجلات المعينة' })}</small></article>)}</div></section>
          <section><h4>{text({ en: 'Administrative history', ar: 'السجل الإداري' })}</h4>{userAudit.length ? <div className="ui8-detail-history">{userAudit.slice(0, 6).map((event) => <div key={event.id}><span><History size={15} /></span><p><strong>{auditActionLabel(event.action, language)}</strong><small>{event.reason || text({ en: 'No rationale recorded', ar: 'لم يسجل مبرر' })}</small></p><time>{formatDate(event.created_at)}</time></div>)}</div> : <p className="ui8-muted">{text({ en: 'No trusted administrative history is visible for this user.', ar: 'لا يوجد سجل إداري موثوق ظاهر لهذا المستخدم.' })}</p>}</section>
          <div className="ui8-modal-actions"><button type="button" className="ui8-primary-button" onClick={() => openPage('admin')}><ShieldCheck size={16} />{text({ en: 'Open governed user controls', ar: 'فتح ضوابط المستخدم المحكومة' })}</button><button type="button" className="ui8-secondary-button" disabled title={text({ en: 'Session revocation is not exposed by the current general user-administration contract.', ar: 'إلغاء الجلسات غير متاح ضمن عقد إدارة المستخدم العام الحالي.' })}><LockKeyhole size={16} />{text({ en: 'Revoke sessions', ar: 'إلغاء الجلسات' })}</button></div>
        </div> : null}
      </Modal>
    </section>
  );
}
