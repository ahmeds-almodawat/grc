
import { supabase } from './supabase';
import { emptyLiveObject, emptyLiveArray } from './liveData';
import { requireServerBridge } from './privilegedAction';

export type AutomationSummary = {
  organizationId: string;
  activeRules: number;
  reviewsDue7Days: number;
  overdueReviews: number;
  kriBreaches30Days: number;
  criticalKriBreaches30Days: number;
  executiveExceptionRules: number;
  automationRuns7Days: number;
};

export type RiskAppetiteRow = {
  id: string;
  organizationId: string;
  appetiteCode: string;
  titleEn: string;
  titleAr: string;
  category: string;
  maxResidualScore: number;
  maxCriticalRisks: number;
  maxHighRisks: number;
  criticalOpenRisks: number;
  highOpenRisks: number;
  actualMaxResidualScore: number;
  actualAvgResidualScore: number;
  appetiteStatus: 'normal' | 'watch' | 'warning' | 'critical';
  reviewDueDate: string | null;
  isActive: boolean;
};

export type KriBreachRow = {
  id: string;
  organizationId: string;
  kriId: string;
  kriCode: string;
  titleEn: string;
  titleAr: string;
  category: string;
  departmentNameEn: string | null;
  departmentNameAr: string | null;
  unitLabel: string | null;
  direction: string;
  observedAt: string;
  value: number;
  watchThreshold: number | null;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  breachLevel: 'watch' | 'warning' | 'critical';
  ownerNameEn: string | null;
  ownerNameAr: string | null;
  notes: string | null;
};

export type RecurringReviewRow = {
  id: string;
  organizationId: string;
  reviewCode: string;
  titleEn: string;
  titleAr: string;
  area: string;
  departmentNameEn: string | null;
  departmentNameAr: string | null;
  ownerNameEn: string | null;
  ownerNameAr: string | null;
  reviewerNameEn: string | null;
  reviewerNameAr: string | null;
  frequency: string;
  nextDueDate: string;
  reminderDaysBefore: number;
  computedStatus: 'scheduled' | 'due_soon' | 'due' | 'overdue' | 'completed' | 'cancelled';
  daysOverdue: number;
  lastCompletedAt: string | null;
  notes: string | null;
};

export type AutomationRuleRow = {
  id: string;
  organizationId: string;
  ruleCode: string;
  titleEn: string;
  titleAr: string;
  ruleType: string;
  actionType: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  appliesToScope: string;
  departmentNameEn: string | null;
  departmentNameAr: string | null;
  conditionJson: Record<string, unknown>;
  actionJson: Record<string, unknown>;
  isActive: boolean;
  lastRunAt: string | null;
  runCount: number;
  ruleHealth: 'never_run' | 'stale' | 'healthy';
};

export type CommitteeAutomationRow = {
  id: string;
  organizationId: string;
  decisionCode: string | null;
  title: string;
  decisionText: string;
  committeeName: string | null;
  meetingDate: string | null;
  departmentNameEn: string | null;
  departmentNameAr: string | null;
  ownerNameEn: string | null;
  ownerNameAr: string | null;
  dueDate: string | null;
  priority: string;
  riskLevel: string;
  status: string;
  daysOverdue: number;
  automationSignal: 'closed' | 'overdue' | 'due_soon' | 'needs_project_or_evidence' | 'on_track';
  linkedProjectId: string | null;
};

export type ExecutiveExceptionRow = {
  id: string;
  organizationId: string;
  exceptionCode: string;
  titleEn: string;
  titleAr: string;
  area: string;
  triggerDescriptionEn: string | null;
  triggerDescriptionAr: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  responseSlaHours: number | null;
  requiresCeoVisibility: boolean;
  requiresActionPlan: boolean;
  isActive: boolean;
  commandWeight: number;
};

type DbRow = Record<string, any>;

function toCamelKey(key: string) {
  return key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

function camel<T>(row: DbRow): T {
  const mapped: DbRow = {};
  Object.entries(row).forEach(([key, value]) => {
    mapped[toCamelKey(key)] = value;
  });
  return mapped as T;
}

async function selectView<T>(viewName: string, emptyRows: T[], options?: { order?: string; ascending?: boolean; limit?: number }) {
  if (!supabase) return emptyRows;
  let query = supabase.from(viewName).select('*');
  if (options?.order) query = query.order(options.order, { ascending: options.ascending ?? false });
  if (options?.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) {
    console.warn(`[${viewName}] returning empty live data`, error.message);
    return emptyRows;
  }
  return (data ?? []).map(row => camel<T>(row));
}

const liveEmptySummary: AutomationSummary = emptyLiveObject<AutomationSummary>('liveEmptySummary');

const liveEmptyAppetite: RiskAppetiteRow[] = emptyLiveArray<RiskAppetiteRow>();

const liveEmptyKriBreaches: KriBreachRow[] = emptyLiveArray<KriBreachRow>();

const liveEmptyReviews: RecurringReviewRow[] = emptyLiveArray<RecurringReviewRow>();

const liveEmptyRules: AutomationRuleRow[] = emptyLiveArray<AutomationRuleRow>();

const liveEmptyCommittee: CommitteeAutomationRow[] = emptyLiveArray<CommitteeAutomationRow>();

const liveEmptyExceptions: ExecutiveExceptionRow[] = emptyLiveArray<ExecutiveExceptionRow>();

export async function getAutomationSummary() {
  const rows = await selectView<AutomationSummary>('v_automation_command_summary', [liveEmptySummary], { limit: 1 });
  return rows[0] ?? liveEmptySummary;
}

export async function getRiskAppetiteDashboard() {
  return selectView<RiskAppetiteRow>('v_risk_appetite_dashboard', liveEmptyAppetite, { order: 'appetite_status', ascending: true, limit: 100 });
}

export async function getKriBreachRegister() {
  return selectView<KriBreachRow>('v_kri_breach_register', liveEmptyKriBreaches, { order: 'observed_at', ascending: false, limit: 100 });
}

export async function getRecurringReviewQueue() {
  return selectView<RecurringReviewRow>('v_recurring_review_queue', liveEmptyReviews, { order: 'next_due_date', ascending: true, limit: 100 });
}

export async function getAutomationRules() {
  return selectView<AutomationRuleRow>('v_automation_rule_catalog', liveEmptyRules, { order: 'priority', ascending: true, limit: 100 });
}

export async function getCommitteeAutomation() {
  return selectView<CommitteeAutomationRow>('v_committee_action_automation', liveEmptyCommittee, { order: 'due_date', ascending: true, limit: 100 });
}

export async function getExecutiveExceptions() {
  return selectView<ExecutiveExceptionRow>('v_executive_exception_dashboard', liveEmptyExceptions, { order: 'command_weight', ascending: false, limit: 100 });
}

export async function refreshAutomationIntelligence() {
  if (!supabase) {
    throw new Error('Automation intelligence refresh requires a live Supabase connection.');
  }

  return requireServerBridge(
    'Automation intelligence refresh',
    'refresh_automation_intelligence',
  );
}
