import { supabase } from './supabase';
import { emptyLiveObject, emptyLiveArray } from './liveData';
import { requireServerBridge } from './privilegedAction';

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

const liveEmptySummary: OperationalSummary = emptyLiveObject<OperationalSummary>('liveEmptySummary');

const liveEmptyReminders: ReminderQueueItem[] = emptyLiveArray<ReminderQueueItem>();

const liveEmptyDigest: NotificationDigestRow[] = emptyLiveArray<NotificationDigestRow>();

const liveEmptyTimeline: ActivityTimelineRow[] = emptyLiveArray<ActivityTimelineRow>();

const liveEmptyInbox: ManagerInboxRow[] = emptyLiveArray<ManagerInboxRow>();

function logFallback(label: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.warn(`[GRC operations emptyRows] ${label}`, error);
}

export async function getOperationalSummary(): Promise<OperationalSummary> {
  if (!supabase) return emptyLiveObject<OperationalSummary>('getOperationalSummary');
  try {
    const { data, error } = await supabase
      .from('v_operational_followup_summary')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as OperationalSummary) ?? liveEmptySummary;
  } catch (error) {
    logFallback('operational summary', error);
    return emptyLiveObject<OperationalSummary>('getOperationalSummary');
  }
}

export async function getReminderQueue(): Promise<ReminderQueueItem[]> {
  if (!supabase) return emptyLiveArray<any>();
  try {
    const { data, error } = await supabase
      .from('v_due_reminder_queue')
      .select('*')
      .order('days_overdue', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data as ReminderQueueItem[])?.length ? (data as ReminderQueueItem[]) : liveEmptyReminders;
  } catch (error) {
    logFallback('reminder queue', error);
    return emptyLiveArray<any>();
  }
}

export async function getNotificationDigest(): Promise<NotificationDigestRow[]> {
  if (!supabase) return emptyLiveArray<any>();
  try {
    const { data, error } = await supabase
      .from('v_notification_digest')
      .select('*')
      .order('unread_notifications', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data as NotificationDigestRow[])?.length ? (data as NotificationDigestRow[]) : liveEmptyDigest;
  } catch (error) {
    logFallback('notification digest', error);
    return emptyLiveArray<any>();
  }
}

export async function getActivityTimeline(): Promise<ActivityTimelineRow[]> {
  if (!supabase) return emptyLiveArray<any>();
  try {
    const { data, error } = await supabase
      .from('v_activity_timeline')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(80);
    if (error) throw error;
    return (data as ActivityTimelineRow[])?.length ? (data as ActivityTimelineRow[]) : liveEmptyTimeline;
  } catch (error) {
    logFallback('activity timeline', error);
    return emptyLiveArray<any>();
  }
}

export async function getManagerInbox(): Promise<ManagerInboxRow[]> {
  if (!supabase) return emptyLiveArray<any>();
  try {
    const { data, error } = await supabase
      .from('v_manager_inbox')
      .select('*')
      .order('days_overdue', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data as ManagerInboxRow[])?.length ? (data as ManagerInboxRow[]) : liveEmptyInbox;
  } catch (error) {
    logFallback('manager inbox', error);
    return emptyLiveArray<any>();
  }
}

export async function generateDueReminders(): Promise<number> {
  if (!supabase) return liveEmptyReminders.length;
  return requireServerBridge(
    'Due-reminder generation',
    'generate_due_reminders',
  );
}
