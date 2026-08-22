import type { GovernanceCriteriaLink } from './governanceCriteriaLinkageApi';
import type { Ui4AuditCriteriaContract, Ui4CapaClosureBlocker, Ui4CapaRecord } from './ui4AuditCapaApi';
import type { AuditClosureGateStatusRow, AuditFindingRow } from '../types/domain';

export type Ui4GateTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface Ui4GateEvaluation {
  passed: boolean;
  blockers: string[];
  criterionException: boolean;
}

export function auditCriteriaResolutionDate(finding: Pick<AuditFindingRow, 'audit_period_end_date' | 'finding_date'>): string | null {
  return finding.audit_period_end_date || finding.finding_date || null;
}

export function evaluateUi4AuditClosureGate(
  finding: AuditFindingRow,
  criteria: Ui4AuditCriteriaContract | null,
  patch24Gate: AuditClosureGateStatusRow | null,
): Ui4GateEvaluation {
  const advisory = finding.finding_classification === 'advisory_observation';
  const blockers: string[] = [];
  if (!advisory && !criteria?.criterion_gate_satisfied) blockers.push('A confirmed legitimate governance criterion is required.');
  if (patch24Gate && !patch24Gate.can_close) blockers.push(patch24Gate.closure_blocker || 'The Patch 24 closure gate is not satisfied.');
  return { passed: blockers.length === 0, blockers, criterionException: advisory };
}

export function ui4CapaProgress(capa: Ui4CapaRecord): number {
  if (capa.capa_status === 'closed') return 100;
  if (capa.action_item_count > 0) return Math.round((capa.completed_action_item_count / capa.action_item_count) * 100);
  const stage: Record<string, number> = {
    draft: 5,
    assigned: 12,
    action_plan_required: 18,
    action_plan_submitted: 25,
    action_plan_approved: 35,
    in_progress: 50,
    evidence_required: 60,
    completion_submitted: 68,
    validation_pending: 72,
    validation_rejected: 55,
    effectiveness_review_pending: 82,
    effectiveness_review_passed: 90,
    effectiveness_review_failed: 62,
    closure_requested: 95,
    reopened: 40,
  };
  return stage[capa.capa_status] ?? 10;
}

export function ui4CapaStatusTone(status: string): Ui4GateTone {
  if (status === 'closed' || status.includes('approved') || status.includes('passed')) return 'success';
  if (status.includes('rejected') || status.includes('failed') || status === 'overdue' || status === 'escalated') return 'danger';
  if (status === 'draft' || status === 'cancelled') return 'neutral';
  return 'warning';
}

export function evaluateUi4CapaClosure(blocker: Ui4CapaClosureBlocker | null): Ui4GateEvaluation {
  if (!blocker) return { passed: false, blockers: ['Closure contract is unavailable.'], criterionException: false };
  const blockers: string[] = [];
  if (blocker.has_incomplete_action_items) blockers.push('Action items are incomplete.');
  if (blocker.has_evidence_blocker) blockers.push('Required evidence is not accepted.');
  if (blocker.has_validation_blocker) blockers.push('Independent validation is required.');
  if (blocker.has_effectiveness_blocker) blockers.push('Effectiveness verification has not passed.');
  return { passed: blocker.can_close && blockers.length === 0, blockers, criterionException: false };
}

export function countsAsGovernanceViolation(link: Pick<GovernanceCriteriaLink, 'inherited' | 'significance' | 'adherence_status'>): boolean {
  return !link.inherited
    && ['primary', 'contributing'].includes(link.significance ?? '')
    && ['noncompliance', 'procedure_not_followed'].includes(link.adherence_status ?? '');
}
