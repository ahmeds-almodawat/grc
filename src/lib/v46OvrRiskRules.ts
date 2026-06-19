export type OvrSeverity = 'level_1' | 'level_2' | 'level_3' | 'level_4' | 'sentinel' | null | undefined;

export interface OvrRiskInput {
  severityLevel?: OvrSeverity;
  recurrence30d?: number;
  ageDays?: number;
  isClosed?: boolean;
  evidenceAccepted?: boolean;
}

export interface OvrRiskResult {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  executiveAlert: boolean;
  reasons: string[];
}

const severityWeights: Record<Exclude<OvrSeverity, null | undefined>, number> = {
  level_1: 1,
  level_2: 2,
  level_3: 3,
  level_4: 5,
  sentinel: 8
};

export function calculateV46OvrRisk(input: OvrRiskInput): OvrRiskResult {
  const severity = input.severityLevel ? severityWeights[input.severityLevel] ?? 1 : 1;
  const recurrence = Math.max(0, input.recurrence30d ?? 0);
  const ageDays = Math.max(0, input.ageDays ?? 0);
  const delayWeight = !input.isClosed && ageDays > 7 ? Math.min(5, Math.floor((ageDays - 7) / 7) + 1) : 0;
  const evidencePenalty = input.isClosed || input.evidenceAccepted ? 0 : 1;
  const score = severity + Math.min(10, recurrence * 1.5) + delayWeight + evidencePenalty;
  const level = score >= 12 ? 'critical' : score >= 8 ? 'high' : score >= 4 ? 'medium' : 'low';
  const reasons: string[] = [];
  if (input.severityLevel === 'sentinel' || input.severityLevel === 'level_4') reasons.push('major_or_sentinel_event');
  if (recurrence >= 3) reasons.push('recurring_category_signal');
  if (delayWeight > 0) reasons.push('closure_delay_signal');
  if (evidencePenalty > 0) reasons.push('accepted_evidence_missing');
  return {
    score: Number(score.toFixed(2)),
    level,
    executiveAlert: level === 'critical' || input.severityLevel === 'sentinel' || input.severityLevel === 'level_4',
    reasons
  };
}
