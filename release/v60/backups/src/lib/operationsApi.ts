import { supabase } from './supabase';

export type OperationalSummary = {
  organization_id: string;
  unread_notifications: number;
  pending_approvals: number;
  pending_evidence_reviews: number;
  active_escalations: number;
  overdue_projects: number;
  overdue_milestones: number;
  overdue_tasks: number;
  open_ovr_workflow: number;
  generated_at: string;
};

export type ReminderQueueItem = {
  organization_id: string;
  item_type: string;
  item_id: string;
  title: string;
  owner_id: string | null;
  department_id: string | null;
  due_date: string | null;
  reminder_type: 'overdue' | 'due_soon' | 'scheduled' | 'ovr_followup' | 'pending_approval' | string;
  priority: string | null;
  risk_level: string | null;
  status: string | null;
  days_overdue: number;
  action_path: string | null;
};

export type NotificationDigestRow = {
  organization_id: string;
  user_id: string;
  full_name_en: string | null;
  full_name_ar: string | null;
  email: string | null;
  unread_notifications: number;
  overdue_assigned_items: number;
  due_soon_assigned_items: number;
  pending_approvals: number;
  last_notification_at: string | null;
};

export type ActivityTimelineRow = {
  organization_id: string | null;
  event_source: string;
  item_type: string;
  item_id: string | null;
  event_title: string;
  actor_name_en: string | null;
  actor_name_ar: string | null;
  created_at: string;
  payload: Record<string, unknown> | null;
};

export type ManagerInboxRow = {
  organization_id: string;
  department_id: string | null;
  department_name_en: string | null;
  department_name_ar: string | null;
  item_type: string;
  item_id: string;
  title: string;
  owner_id: string | null;
  owner_name_en: string | null;
  owner_name_ar: string | null;
  due_date: string | null;
  reminder_type: string;
  priority: string | null;
  risk_level: string | null;
  status: string | null;
  days_overdue: number;
  action_path: string | null;
};

const now = new Date().toISOString();

const fallbackSummary: OperationalSummary = {
  organization_id: 'demo',
  unread_notifications: 14,
  pending_approvals: 7,
  pending_evidence_reviews: 11,
  active_escalations: 5,
  overdue_projects: 2,
  overdue_milestones: 6,
  overdue_tasks: 18,
  open_ovr_workflow: 4,
  generated_at: now
};

const fallbackReminders: ReminderQueueItem[] = [
  {
    organization_id: 'demo',
    item_type: 'project',
    item_id: 'demo-project-1',
    title: 'Authority matrix implementation',
    owner_id: 'demo-owner',
    department_id: 'governance',
    due_date: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
    reminder_type: 'overdue',
    priority: 'critical',
    risk_level: 'high',
    status: 'active',
    days_overdue: 3,
    action_path: '/projects'
  },
  {
    organization_id: 'demo',
    item_type: 'ovr',
    item_id: 'demo-ovr-1',
    title: 'OVR-2026-00021 - Quality closure review pending',
    owner_id: 'quality-demo',
    department_id: 'quality',
    due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    reminder_type: 'ovr_followup',
    priority: 'high',
    risk_level: 'critical',
    status: 'quality_closure_review',
    days_overdue: 0,
    action_path: '/ovr'
  },
  {
    organization_id: 'demo',
    item_type: 'approval',
    item_id: 'demo-approval-1',
    title: 'Pending closure approval for corrective action',
    owner_id: 'exec-demo',
    department_id: null,
    due_date: new Date().toISOString().slice(0, 10),
    reminder_type: 'pending_approval',
    priority: 'medium',
    risk_level: 'medium',
    status: 'pending',
    days_overdue: 0,
    action_path: '/approvals'
  }
];

const fallbackDigest: NotificationDigestRow[] = [
  {
    organization_id: 'demo',
    user_id: 'exec-demo',
    full_name_en: 'Executive Sponsor',
    full_name_ar: 'الراعي التنفيذي',
    email: 'executive@almodawat.sa',
    unread_notifications: 5,
    overdue_assigned_items: 1,
    due_soon_assigned_items: 2,
    pending_approvals: 4,
    last_notification_at: now
  },
  {
    organization_id: 'demo',
    user_id: 'quality-demo',
    full_name_en: 'Quality Manager',
    full_name_ar: 'مدير الجودة',
    email: 'quality@almodawat.sa',
    unread_notifications: 7,
    overdue_assigned_items: 2,
    due_soon_assigned_items: 3,
    pending_approvals: 1,
    last_notification_at: now
  }
];

const fallbackTimeline: ActivityTimelineRow[] = [
  {
    organization_id: 'demo',
    event_source: 'audit_log',
    item_type: 'ovr_reports',
    item_id: 'demo-ovr-1',
    event_title: 'OVR moved to Quality closure review',
    actor_name_en: 'Quality Officer',
    actor_name_ar: 'مسؤول الجودة',
    created_at: now,
    payload: { status: 'quality_closure_review' }
  },
  {
    organization_id: 'demo',
    event_source: 'followup_note',
    item_type: 'project',
    item_id: 'demo-project-1',
    event_title: 'Requested delay reason and evidence upload before next governance meeting',
    actor_name_en: 'Governance Admin',
    actor_name_ar: 'مسؤول الحوكمة',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    payload: { followup_date: new Date().toISOString().slice(0, 10) }
  },
  {
    organization_id: 'demo',
    event_source: 'notification',
    item_type: 'notification',
    item_id: 'demo-note-1',
    event_title: 'Overdue task reminder generated',
    actor_name_en: 'System',
    actor_name_ar: 'النظام',
    created_at: new Date(Date.now() - 3600000 * 10).toISOString(),
    payload: { is_read: false }
  }
];

const fallbackInbox: ManagerInboxRow[] = fallbackReminders.map(item => ({
  ...item,
  department_name_en: item.department_id === 'quality' ? 'Quality' : item.department_id === 'governance' ? 'Governance' : null,
  department_name_ar: item.department_id === 'quality' ? 'الجودة' : item.department_id === 'governance' ? 'الحوكمة' : null,
  owner_name_en: item.owner_id === 'quality-demo' ? 'Quality Manager' : item.owner_id === 'exec-demo' ? 'Executive Sponsor' : 'Governance Owner',
  owner_name_ar: item.owner_id === 'quality-demo' ? 'مدير الجودة' : item.owner_id === 'exec-demo' ? 'الراعي التنفيذي' : 'مسؤول الحوكمة'
}));

function logFallback(label: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.warn(`[GRC operations fallback] ${label}`, error);
}

export async function getOperationalSummary(): Promise<OperationalSummary> {
  if (!supabase) return fallbackSummary;
  try {
    const { data, error } = await supabase
      .from('v_operational_followup_summary')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as OperationalSummary) ?? fallbackSummary;
  } catch (error) {
    logFallback('operational summary', error);
    return fallbackSummary;
  }
}

export async function getReminderQueue(): Promise<ReminderQueueItem[]> {
  if (!supabase) return fallbackReminders;
  try {
    const { data, error } = await supabase
      .from('v_due_reminder_queue')
      .select('*')
      .order('days_overdue', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data as ReminderQueueItem[])?.length ? (data as ReminderQueueItem[]) : fallbackReminders;
  } catch (error) {
    logFallback('reminder queue', error);
    return fallbackReminders;
  }
}

export async function getNotificationDigest(): Promise<NotificationDigestRow[]> {
  if (!supabase) return fallbackDigest;
  try {
    const { data, error } = await supabase
      .from('v_notification_digest')
      .select('*')
      .order('unread_notifications', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data as NotificationDigestRow[])?.length ? (data as NotificationDigestRow[]) : fallbackDigest;
  } catch (error) {
    logFallback('notification digest', error);
    return fallbackDigest;
  }
}

export async function getActivityTimeline(): Promise<ActivityTimelineRow[]> {
  if (!supabase) return fallbackTimeline;
  try {
    const { data, error } = await supabase
      .from('v_activity_timeline')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(80);
    if (error) throw error;
    return (data as ActivityTimelineRow[])?.length ? (data as ActivityTimelineRow[]) : fallbackTimeline;
  } catch (error) {
    logFallback('activity timeline', error);
    return fallbackTimeline;
  }
}

export async function getManagerInbox(): Promise<ManagerInboxRow[]> {
  if (!supabase) return fallbackInbox;
  try {
    const { data, error } = await supabase
      .from('v_manager_inbox')
      .select('*')
      .order('days_overdue', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data as ManagerInboxRow[])?.length ? (data as ManagerInboxRow[]) : fallbackInbox;
  } catch (error) {
    logFallback('manager inbox', error);
    return fallbackInbox;
  }
}

export async function generateDueReminders(): Promise<number> {
  if (!supabase) return fallbackReminders.length;
  try {
    const { data, error } = await supabase.rpc('generate_due_reminders');
    if (error) throw error;
    return typeof data === 'number' ? data : 0;
  } catch (error) {
    logFallback('generate due reminders', error);
    return 0;
  }
}
