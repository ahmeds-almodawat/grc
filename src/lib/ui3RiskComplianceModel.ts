import type { GovernanceCriteriaLink, GovernanceLinkageReview } from './governanceCriteriaLinkageApi';
import type { RiskRow } from '../types/domain';

export type Ui3ComplianceResult =
  | 'not_assessed'
  | 'compliant'
  | 'partial_compliance'
  | 'noncompliant'
  | 'not_applicable'
  | 'insufficient_evidence';

export interface Ui3RiskGovernanceGate {
  required: boolean;
  complete: boolean;
  outcome: string | null;
  rationalePresent: boolean;
  canApprove: boolean;
  reason: string | null;
}

export function riskScoreLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 20) return 'critical';
  if (score >= 12) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

export function buildRiskMatrix(rows: RiskRow[]) {
  return Array.from({ length: 5 }, (_, likelihoodIndex) => {
    const likelihood = 5 - likelihoodIndex;
    return Array.from({ length: 5 }, (_, impactIndex) => {
      const impact = impactIndex + 1;
      return {
        likelihood,
        impact,
        score: likelihood * impact,
        level: riskScoreLevel(likelihood * impact),
        count: rows.filter((row) => {
          const rowLikelihood = row.residual_likelihood ?? row.likelihood;
          const rowImpact = row.residual_impact ?? row.impact;
          return rowLikelihood === likelihood && rowImpact === impact;
        }).length,
      };
    });
  });
}

export function isCompletedGovernanceReview(review: GovernanceLinkageReview | null | undefined) {
  return Boolean(
    review
    && review.review_status === 'completed'
    && review.review_outcome
    && (review.review_rationale?.trim().length ?? 0) >= 3,
  );
}

export function evaluateRiskGovernanceGate(
  risk: Pick<RiskRow, 'risk_level'>,
  review: GovernanceLinkageReview | null | undefined,
): Ui3RiskGovernanceGate {
  const required = risk.risk_level === 'high' || risk.risk_level === 'critical';
  const complete = isCompletedGovernanceReview(review);
  const rationalePresent = (review?.review_rationale?.trim().length ?? 0) >= 3;
  return {
    required,
    complete,
    outcome: review?.review_outcome ?? null,
    rationalePresent,
    canApprove: !required || complete,
    reason: required && !complete ? 'Governance Context review must be completed before approval.' : null,
  };
}

export function confirmedGovernanceLinks(links: GovernanceCriteriaLink[]) {
  return links.filter((link) => link.decision_type === 'confirmed');
}

export function governanceGapCount(links: GovernanceCriteriaLink[]) {
  return confirmedGovernanceLinks(links).filter((link) => [
    'unclear',
    'incomplete',
    'conflicting',
    'obsolete_version_used',
    'missing_policy',
    'missing_sop',
    'implementation_gap',
    'training_competency_gap',
    'control_failed_despite_compliance',
  ].includes(link.adequacy_status ?? '')).length;
}

export function resultTone(result: Ui3ComplianceResult | string | null | undefined) {
  if (result === 'compliant') return 'success';
  if (result === 'partial_compliance' || result === 'insufficient_evidence') return 'warning';
  if (result === 'noncompliant') return 'danger';
  return 'neutral';
}

export function isFindingAllowed(result: Ui3ComplianceResult | string) {
  return ['partial_compliance', 'noncompliant', 'insufficient_evidence'].includes(result);
}

export function isRestrictedGovernanceLink(link: Pick<GovernanceCriteriaLink, 'target_display_label'>) {
  return link.target_display_label === '[restricted]';
}

export function versionResolutionLabel(status: string) {
  const labels: Record<string, string> = {
    exactly_one: 'Exact approved version resolved',
    exactly_one_with_approved_exception: 'Exact version resolved with approved exception',
    missing_source_date: 'Applicability date is required',
    zero_candidates: 'No applicable approved version',
    expired_version: 'Only expired versions are available',
    superseded_or_obsolete_version: 'Only obsolete or superseded versions match',
    department_not_applicable: 'Document version does not apply to this department',
    overlapping_candidates: 'Overlapping approved versions require review',
  };
  return labels[status] ?? status.replaceAll('_', ' ');
}
