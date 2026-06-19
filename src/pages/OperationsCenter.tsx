import { useEffect, useMemo, useState } from 'react';
import { BellRing, CalendarClock, CheckCircle2, Clock3, History, Inbox, RefreshCcw, Send, UsersRound } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import {
  generateDueReminders,
  getActivityTimeline,
  getManagerInbox,
  getNotificationDigest,
  getOperationalSummary,
  getReminderQueue,
  type ActivityTimelineRow,
  type ManagerInboxRow,
  type NotificationDigestRow,
  type OperationalSummary,
  type ReminderQueueItem
} from '../lib/operationsApi';
import { actionErrorMessage } from '../lib/privilegedAction';

type TabKey = 'inbox' | 'reminders' | 'digest' | 'timeline';

type LoadState = {
  summary: OperationalSummary | null;
  reminders: ReminderQueueItem[];
  digest: NotificationDigestRow[];
  timeline: ActivityTimelineRow[];
  inbox: ManagerInboxRow[];
};

const initialState: LoadState = {
  summary: null,
  reminders: [],
  digest: [],
  timeline: [],
  inbox: []
};

function toneForReminder(type: string, risk?: string | null) {
  if (type === 'overdue' || risk === 'critical') return 'danger';
  if (type === 'pending_approval' || type === 'ovr_followup') return 'warning';
  return 'success';
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(new Date(value));
  } catch {
    return value;
  }
}

function labelize(value?: string | null) {
  if (!value) return '—';
  return value.replaceAll('_', ' ');
}

export function OperationsCenter() {
  const { t, language } = useI18n();
  const [state, setState] = useState<LoadState>(initialState);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('inbox');
  const [search, setSearch] = useState('');
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [summary, reminders, digest, timeline, inbox] = await Promise.all([
        getOperationalSummary(),
        getReminderQueue(),
        getNotificationDigest(),
        getActivityTimeline(),
        getManagerInbox()
      ]);
      setState({ summary, reminders, digest, timeline, inbox });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredInbox = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return state.inbox;
    return state.inbox.filter(item => [
      item.title,
      item.owner_name_en,
      item.owner_name_ar,
      item.department_name_en,
      item.department_name_ar,
      item.item_type,
      item.status
    ].some(value => value?.toLowerCase().includes(q)));
  }, [state.inbox, search]);

  const filteredReminders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return state.reminders;
    return state.reminders.filter(item => [item.title, item.item_type, item.reminder_type, item.status].some(value => value?.toLowerCase().includes(q)));
  }, [state.reminders, search]);

  const handleGenerateReminders = async () => {
    setLastAction(null);
    setActionError(null);
    try {
      const count = await generateDueReminders();
      setLastAction(`${count} ${t('ops.generatedRemindersSuffix')}`);
      await load();
    } catch (actionFailure) {
      setActionError(actionErrorMessage(actionFailure));
    }
  };

  const summary = state.summary;

  return (
    <div className="page-section operations-page">
      <div className="section-heading operations-hero">
        <div>
          <p className="eyebrow">{t('ops.eyebrow')}</p>
          <h3>{t('ops.title')}</h3>
          <p className="section-subtitle">{t('ops.subtitle')}</p>
        </div>
        <div className="toolbar">
          <button className="ghost-button" onClick={load} disabled={loading}>
            <RefreshCcw size={16} /> {t('ops.refresh')}
          </button>
          <button className="primary-button" onClick={handleGenerateReminders} disabled={loading}>
            <Send size={16} /> {t('ops.generateReminders')}
          </button>
        </div>
      </div>

      {lastAction && <div className="notice-banner">{lastAction}</div>}
      {actionError && <div className="notice-banner danger">{actionError}</div>}

      <div className="stats-grid operations-kpi-grid">
        <div className="stat-card warning">
          <BellRing size={21} />
          <div className="stat-value">{summary?.unread_notifications ?? '—'}</div>
          <div className="stat-label">{t('ops.unreadNotifications')}</div>
        </div>
        <div className="stat-card danger">
          <CalendarClock size={21} />
          <div className="stat-value">{(summary?.overdue_projects ?? 0) + (summary?.overdue_milestones ?? 0) + (summary?.overdue_tasks ?? 0)}</div>
          <div className="stat-label">{t('ops.totalOverdue')}</div>
        </div>
        <div className="stat-card warning">
          <CheckCircle2 size={21} />
          <div className="stat-value">{summary?.pending_approvals ?? '—'}</div>
          <div className="stat-label">{t('ops.pendingApprovals')}</div>
        </div>
        <div className="stat-card">
          <Inbox size={21} />
          <div className="stat-value">{summary?.pending_evidence_reviews ?? '—'}</div>
          <div className="stat-label">{t('ops.pendingEvidence')}</div>
        </div>
        <div className="stat-card danger">
          <Clock3 size={21} />
          <div className="stat-value">{summary?.active_escalations ?? '—'}</div>
          <div className="stat-label">{t('ops.activeEscalations')}</div>
        </div>
        <div className="stat-card">
          <UsersRound size={21} />
          <div className="stat-value">{summary?.open_ovr_workflow ?? '—'}</div>
          <div className="stat-label">{t('ops.openOvrWorkflow')}</div>
        </div>
      </div>

      <div className="panel operations-control-panel">
        <div className="split-header">
          <div>
            <h4>{t('ops.followupWorkspace')}</h4>
            <p className="muted">{t('ops.followupWorkspaceHint')}</p>
          </div>
          <div className="toolbar">
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('common.search')} />
          </div>
        </div>

        <div className="segmented-tabs operations-tabs">
          {(['inbox', 'reminders', 'digest', 'timeline'] as TabKey[]).map(key => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {t(`ops.tab.${key}`)}
            </button>
          ))}
        </div>

        {tab === 'inbox' && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{t('ops.item')}</th>
                  <th>{t('common.department')}</th>
                  <th>{t('common.owner')}</th>
                  <th>{t('common.dueDate')}</th>
                  <th>{t('ops.reminderType')}</th>
                  <th>{t('common.risk')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredInbox.map(item => (
                  <tr key={`${item.item_type}-${item.item_id}`}>
                    <td>
                      <strong>{item.title}</strong>
                      <div className="muted">{labelize(item.item_type)}</div>
                    </td>
                    <td>{language === 'ar' ? item.department_name_ar ?? item.department_name_en ?? '—' : item.department_name_en ?? item.department_name_ar ?? '—'}</td>
                    <td>{language === 'ar' ? item.owner_name_ar ?? item.owner_name_en ?? '—' : item.owner_name_en ?? item.owner_name_ar ?? '—'}</td>
                    <td>{formatDate(item.due_date)}</td>
                    <td><span className={`status-badge status-${toneForReminder(item.reminder_type, item.risk_level)}`}>{labelize(item.reminder_type)}</span></td>
                    <td><span className={`risk-pill ${item.risk_level ?? 'medium'}`}>{labelize(item.risk_level)}</span></td>
                    <td>{labelize(item.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'reminders' && (
          <div className="operations-card-grid">
            {filteredReminders.map(item => (
              <div className={`work-card reminder-card ${toneForReminder(item.reminder_type, item.risk_level)}`} key={`${item.item_type}-${item.item_id}`}>
                <div className="work-card-header">
                  <span className={`status-badge status-${toneForReminder(item.reminder_type, item.risk_level)}`}>{labelize(item.reminder_type)}</span>
                  <span className={`risk-pill ${item.risk_level ?? 'medium'}`}>{labelize(item.risk_level)}</span>
                </div>
                <h5>{item.title}</h5>
                <p>{labelize(item.item_type)} · {labelize(item.status)} · {formatDate(item.due_date)}</p>
                {item.days_overdue > 0 && <strong className="danger-text">{item.days_overdue} {t('ops.daysOverdue')}</strong>}
              </div>
            ))}
          </div>
        )}

        {tab === 'digest' && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{t('common.owner')}</th>
                  <th>{t('ops.unread')}</th>
                  <th>{t('ops.overdueAssigned')}</th>
                  <th>{t('ops.dueSoonAssigned')}</th>
                  <th>{t('ops.pendingApprovals')}</th>
                  <th>{t('ops.lastNotification')}</th>
                </tr>
              </thead>
              <tbody>
                {state.digest.map(row => (
                  <tr key={row.user_id}>
                    <td>
                      <strong>{language === 'ar' ? row.full_name_ar ?? row.full_name_en : row.full_name_en ?? row.full_name_ar}</strong>
                      <div className="muted">{row.email}</div>
                    </td>
                    <td>{row.unread_notifications}</td>
                    <td>{row.overdue_assigned_items}</td>
                    <td>{row.due_soon_assigned_items}</td>
                    <td>{row.pending_approvals}</td>
                    <td>{formatDate(row.last_notification_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'timeline' && (
          <div className="activity-timeline">
            {state.timeline.map((event, index) => (
              <div className="timeline-item" key={`${event.event_source}-${event.item_id ?? index}-${event.created_at}`}>
                <div className="timeline-marker"><History size={15} /></div>
                <div>
                  <strong>{event.event_title}</strong>
                  <p>{language === 'ar' ? event.actor_name_ar ?? event.actor_name_en : event.actor_name_en ?? event.actor_name_ar} · {labelize(event.event_source)} · {formatDate(event.created_at)}</p>
                  <span>{labelize(event.item_type)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
