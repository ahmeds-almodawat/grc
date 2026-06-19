
import { supabase } from './supabase';

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

async function selectView<T>(viewName: string, fallback: T[], options?: { order?: string; ascending?: boolean; limit?: number }) {
  if (!supabase) return fallback;
  let query = supabase.from(viewName).select('*');
  if (options?.order) query = query.order(options.order, { ascending: options.ascending ?? false });
  if (options?.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) {
    console.warn(`[${viewName}] using fallback`, error.message);
    return fallback;
  }
  return (data ?? []).map(row => camel<T>(row));
}

const fallbackSummary: AutomationSummary = {
  organizationId: 'demo-org',
  activeRules: 12,
  reviewsDue7Days: 9,
  overdueReviews: 3,
  kriBreaches30Days: 7,
  criticalKriBreaches30Days: 2,
  executiveExceptionRules: 5,
  automationRuns7Days: 4
};

const fallbackAppetite: RiskAppetiteRow[] = [
  { id: 'app-1', organizationId: 'demo-org', appetiteCode: 'FIN-CASH', titleEn: 'Cash flow tolerance', titleAr: 'حدود تحمل التدفق النقدي', category: 'financial', maxResidualScore: 12, maxCriticalRisks: 0, maxHighRisks: 3, criticalOpenRisks: 1, highOpenRisks: 4, actualMaxResidualScore: 20, actualAvgResidualScore: 13.4, appetiteStatus: 'critical', reviewDueDate: '2026-07-15', isActive: true },
  { id: 'app-2', organizationId: 'demo-org', appetiteCode: 'CLIN-SAFE', titleEn: 'Patient safety appetite', titleAr: 'شهية مخاطر سلامة المرضى', category: 'patient_safety', maxResidualScore: 10, maxCriticalRisks: 0, maxHighRisks: 2, criticalOpenRisks: 0, highOpenRisks: 2, actualMaxResidualScore: 10, actualAvgResidualScore: 7.2, appetiteStatus: 'normal', reviewDueDate: '2026-07-01', isActive: true },
  { id: 'app-3', organizationId: 'demo-org', appetiteCode: 'COMP-LIC', titleEn: 'Regulatory compliance appetite', titleAr: 'شهية مخاطر الامتثال التنظيمي', category: 'compliance', maxResidualScore: 8, maxCriticalRisks: 0, maxHighRisks: 1, criticalOpenRisks: 0, highOpenRisks: 2, actualMaxResidualScore: 12, actualAvgResidualScore: 8.8, appetiteStatus: 'warning', reviewDueDate: '2026-06-30', isActive: true }
];

const fallbackKriBreaches: KriBreachRow[] = [
  { id: 'kri-obs-1', organizationId: 'demo-org', kriId: 'kri-1', kriCode: 'DSO', titleEn: 'Days sales outstanding', titleAr: 'أيام التحصيل', category: 'financial', departmentNameEn: 'Finance', departmentNameAr: 'المالية', unitLabel: 'days', direction: 'higher_is_worse', observedAt: '2026-06-17', value: 234, watchThreshold: 160, warningThreshold: 190, criticalThreshold: 220, breachLevel: 'critical', ownerNameEn: 'Finance Manager', ownerNameAr: 'مدير المالية', notes: 'Government payer delay pressure.' },
  { id: 'kri-obs-2', organizationId: 'demo-org', kriId: 'kri-2', kriCode: 'OVR-MAJOR', titleEn: 'Major OVR count', titleAr: 'عدد بلاغات OVR الجسيمة', category: 'patient_safety', departmentNameEn: 'Quality', departmentNameAr: 'الجودة', unitLabel: 'count', direction: 'higher_is_worse', observedAt: '2026-06-17', value: 2, watchThreshold: 1, warningThreshold: 2, criticalThreshold: 3, breachLevel: 'warning', ownerNameEn: 'Quality Manager', ownerNameAr: 'مدير الجودة', notes: 'Monitor repeated categories.' },
  { id: 'kri-obs-3', organizationId: 'demo-org', kriId: 'kri-3', kriCode: 'BACKUP-AGE', titleEn: 'Backup age', titleAr: 'عمر آخر نسخة', category: 'it_cybersecurity', departmentNameEn: 'IT', departmentNameAr: 'تقنية المعلومات', unitLabel: 'days', direction: 'higher_is_worse', observedAt: '2026-06-17', value: 9, watchThreshold: 7, warningThreshold: 14, criticalThreshold: 30, breachLevel: 'watch', ownerNameEn: 'IT Manager', ownerNameAr: 'مدير تقنية المعلومات', notes: 'Restore dry-run should be scheduled.' }
];

const fallbackReviews: RecurringReviewRow[] = [
  { id: 'rev-1', organizationId: 'demo-org', reviewCode: 'RISK-CASH-MONTHLY', titleEn: 'Monthly cash-flow risk review', titleAr: 'مراجعة شهرية لمخاطر التدفق النقدي', area: 'risk', departmentNameEn: 'Finance', departmentNameAr: 'المالية', ownerNameEn: 'Finance Manager', ownerNameAr: 'مدير المالية', reviewerNameEn: 'CFO', reviewerNameAr: 'المدير المالي', frequency: 'monthly', nextDueDate: '2026-06-20', reminderDaysBefore: 7, computedStatus: 'due_soon', daysOverdue: 0, lastCompletedAt: '2026-05-20', notes: 'Include DSO and cash runway.' },
  { id: 'rev-2', organizationId: 'demo-org', reviewCode: 'POLICY-QMS-Q', titleEn: 'Quarterly Quality policy review', titleAr: 'مراجعة ربع سنوية لسياسات الجودة', area: 'policy', departmentNameEn: 'Quality', departmentNameAr: 'الجودة', ownerNameEn: 'Quality Manager', ownerNameAr: 'مدير الجودة', reviewerNameEn: 'Governance Admin', reviewerNameAr: 'مسؤول الحوكمة', frequency: 'quarterly', nextDueDate: '2026-06-10', reminderDaysBefore: 14, computedStatus: 'overdue', daysOverdue: 7, lastCompletedAt: null, notes: 'OVR policy and patient safety forms.' },
  { id: 'rev-3', organizationId: 'demo-org', reviewCode: 'ACCESS-Q2', titleEn: 'Quarterly sensitive access review', titleAr: 'مراجعة ربع سنوية للصلاحيات الحساسة', area: 'access_review', departmentNameEn: 'IT', departmentNameAr: 'تقنية المعلومات', ownerNameEn: 'IT Manager', ownerNameAr: 'مدير تقنية المعلومات', reviewerNameEn: 'Internal Audit', reviewerNameAr: 'المراجعة الداخلية', frequency: 'quarterly', nextDueDate: '2026-06-30', reminderDaysBefore: 14, computedStatus: 'due_soon', daysOverdue: 0, lastCompletedAt: '2026-03-30', notes: 'Focus global roles and inactive users.' }
];

const fallbackRules: AutomationRuleRow[] = [
  { id: 'rule-1', organizationId: 'demo-org', ruleCode: 'OVERDUE_CRITICAL_ACTION', titleEn: 'Critical overdue action escalation', titleAr: 'تصعيد إجراء حرج متأخر', ruleType: 'overdue_escalation', actionType: 'notify_executive', priority: 'critical', appliesToScope: 'global', departmentNameEn: null, departmentNameAr: null, conditionJson: { risk_level: 'critical', days_overdue: 1 }, actionJson: { create_escalation: true }, isActive: true, lastRunAt: '2026-06-17', runCount: 6, ruleHealth: 'healthy' },
  { id: 'rule-2', organizationId: 'demo-org', ruleCode: 'KRI_CRITICAL_BREACH', titleEn: 'Critical KRI breach follow-up', titleAr: 'متابعة اختراق KRI حرج', ruleType: 'kri_breach', actionType: 'require_action_plan', priority: 'critical', appliesToScope: 'global', departmentNameEn: null, departmentNameAr: null, conditionJson: { breach_level: 'critical' }, actionJson: { create_project: true }, isActive: true, lastRunAt: null, runCount: 0, ruleHealth: 'never_run' },
  { id: 'rule-3', organizationId: 'demo-org', ruleCode: 'POLICY_REVIEW_DUE', titleEn: 'Policy review due reminder', titleAr: 'تذكير استحقاق مراجعة سياسة', ruleType: 'recurring_review_due', actionType: 'notify_owner', priority: 'medium', appliesToScope: 'global', departmentNameEn: null, departmentNameAr: null, conditionJson: { days_before_due: 14 }, actionJson: { notification: true }, isActive: true, lastRunAt: '2026-06-01', runCount: 2, ruleHealth: 'stale' }
];

const fallbackCommittee: CommitteeAutomationRow[] = [
  { id: 'dec-1', organizationId: 'demo-org', decisionCode: 'EXE-2026-014', title: 'Approve authority matrix update', decisionText: 'Finance and Governance to finalize updated approval authority matrix.', committeeName: 'Executive Committee', meetingDate: '2026-06-10', departmentNameEn: 'Finance', departmentNameAr: 'المالية', ownerNameEn: 'Governance Manager', ownerNameAr: 'مدير الحوكمة', dueDate: '2026-06-16', priority: 'high', riskLevel: 'high', status: 'in_progress', daysOverdue: 1, automationSignal: 'overdue', linkedProjectId: null },
  { id: 'dec-2', organizationId: 'demo-org', decisionCode: 'QPS-2026-009', title: 'OVR RCA review', decisionText: 'Quality to review repeated medication OVR root causes.', committeeName: 'Quality & Patient Safety', meetingDate: '2026-06-12', departmentNameEn: 'Quality', departmentNameAr: 'الجودة', ownerNameEn: 'Quality Manager', ownerNameAr: 'مدير الجودة', dueDate: '2026-06-22', priority: 'critical', riskLevel: 'critical', status: 'open', daysOverdue: 0, automationSignal: 'due_soon', linkedProjectId: 'project-demo' }
];

const fallbackExceptions: ExecutiveExceptionRow[] = [
  { id: 'ex-1', organizationId: 'demo-org', exceptionCode: 'ANY_MAJOR_OVR', titleEn: 'Any major OVR', titleAr: 'أي بلاغ OVR جسيم', area: 'OVR', triggerDescriptionEn: 'Any Level 4 / major OVR should appear immediately in executive command.', triggerDescriptionAr: 'أي بلاغ مستوى 4 / جسيم يجب أن يظهر فوراً في القيادة التنفيذية.', severity: 'critical', responseSlaHours: 4, requiresCeoVisibility: true, requiresActionPlan: true, isActive: true, commandWeight: 100 },
  { id: 'ex-2', organizationId: 'demo-org', exceptionCode: 'NO_RECENT_BACKUP', titleEn: 'No recent backup/export', titleAr: 'لا توجد نسخة تصدير حديثة', area: 'Backup', triggerDescriptionEn: 'No completed backup/export package within the approved interval.', triggerDescriptionAr: 'لا توجد حزمة تصدير/نسخ مكتملة ضمن الفترة المعتمدة.', severity: 'high', responseSlaHours: 48, requiresCeoVisibility: true, requiresActionPlan: true, isActive: true, commandWeight: 75 }
];

export async function getAutomationSummary() {
  const rows = await selectView<AutomationSummary>('v_automation_command_summary', [fallbackSummary], { limit: 1 });
  return rows[0] ?? fallbackSummary;
}

export async function getRiskAppetiteDashboard() {
  return selectView<RiskAppetiteRow>('v_risk_appetite_dashboard', fallbackAppetite, { order: 'appetite_status', ascending: true, limit: 100 });
}

export async function getKriBreachRegister() {
  return selectView<KriBreachRow>('v_kri_breach_register', fallbackKriBreaches, { order: 'observed_at', ascending: false, limit: 100 });
}

export async function getRecurringReviewQueue() {
  return selectView<RecurringReviewRow>('v_recurring_review_queue', fallbackReviews, { order: 'next_due_date', ascending: true, limit: 100 });
}

export async function getAutomationRules() {
  return selectView<AutomationRuleRow>('v_automation_rule_catalog', fallbackRules, { order: 'priority', ascending: true, limit: 100 });
}

export async function getCommitteeAutomation() {
  return selectView<CommitteeAutomationRow>('v_committee_action_automation', fallbackCommittee, { order: 'due_date', ascending: true, limit: 100 });
}

export async function getExecutiveExceptions() {
  return selectView<ExecutiveExceptionRow>('v_executive_exception_dashboard', fallbackExceptions, { order: 'command_weight', ascending: false, limit: 100 });
}

export async function refreshAutomationIntelligence() {
  if (!supabase) {
    return {
      organization_id: 'demo-org',
      due_reviews: fallbackReviews.length,
      kri_breaches_30_days: fallbackKriBreaches.length,
      committee_overdue: fallbackCommittee.filter(row => row.automationSignal === 'overdue').length,
      rules_touched: fallbackRules.length,
      refreshed_at: new Date().toISOString()
    };
  }
  const { data: org } = await supabase.from('organizations').select('id').limit(1).maybeSingle();
  const { data, error } = await supabase.rpc('refresh_automation_intelligence', { p_organization_id: org?.id ?? null });
  if (error) throw new Error(error.message);
  return data;
}
