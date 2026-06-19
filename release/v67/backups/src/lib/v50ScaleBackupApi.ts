import { supabase } from './supabaseClient';

export type V50Status = 'not_started' | 'in_progress' | 'passed' | 'warning' | 'blocked' | 'waived';

export type V50ScaleScorecard = {
  total_controls: number;
  passed_controls: number;
  blocked_controls: number;
  warning_controls: number;
  readiness_percent: number;
};

export type V50BackupScorecard = {
  backup_controls: number;
  backup_passed: number;
  backup_blocked: number;
  backup_runs_last_7_days: number;
  restore_dryruns_passed: number;
  restore_dryruns_with_issues: number;
};

export type V50QueueItem = {
  id: string;
  object_name?: string;
  object_type?: string;
  page_or_module?: string;
  risk_reason?: string;
  recommendation?: string;
  priority?: string;
  status: V50Status;
  owner_name?: string | null;
};

const fallbackScale: V50ScaleScorecard = {
  total_controls: 3,
  passed_controls: 0,
  blocked_controls: 0,
  warning_controls: 0,
  readiness_percent: 0,
};

const fallbackBackup: V50BackupScorecard = {
  backup_controls: 5,
  backup_passed: 0,
  backup_blocked: 0,
  backup_runs_last_7_days: 0,
  restore_dryruns_passed: 0,
  restore_dryruns_with_issues: 0,
};

async function safeOne<T>(query: any, fallback: T): Promise<T> {
  try {
    const { data, error } = await query;
    if (error || !data) return fallback;
    return Array.isArray(data) ? (data[0] ?? fallback) : data;
  } catch {
    return fallback;
  }
}

async function safeList<T>(query: any, fallback: T[]): Promise<T[]> {
  try {
    const { data, error } = await query;
    if (error || !data) return fallback;
    return data as T[];
  } catch {
    return fallback;
  }
}

export async function getV50ScaleScorecard() {
  return safeOne<V50ScaleScorecard>(supabase.from('v_v50_scale_readiness_scorecard').select('*').limit(1).maybeSingle(), fallbackScale);
}

export async function getV50BackupScorecard() {
  return safeOne<V50BackupScorecard>(supabase.from('v_v50_backup_restore_scorecard').select('*').limit(1).maybeSingle(), fallbackBackup);
}

export async function getV50OptimizationQueue() {
  return safeList<V50QueueItem>(supabase.from('v_v50_query_optimization_queue').select('*').limit(50), []);
}

export async function getV50RestoreQueue() {
  return safeList<any>(supabase.from('v_v50_restore_dryrun_queue').select('*').limit(50), []);
}
