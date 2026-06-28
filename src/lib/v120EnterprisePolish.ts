export type V120Health = 'excellent' | 'good' | 'watch' | 'attention' | 'critical' | 'unknown';
export type V120Priority = 'critical' | 'high' | 'medium' | 'low';

export interface V120EnterpriseModule {
  key: string;
  title: string;
  titleAr: string;
  group: 'quality' | 'risk' | 'controls' | 'assurance' | 'policy' | 'vendor' | 'resilience' | 'reporting';
  route: string;
  pilotReady: boolean;
  maturityTarget: number;
  polishFocus: string;
}

export const V120_ENTERPRISE_MODULES: V120EnterpriseModule[] = [
  {
    key: 'ovr-quality',
    title: 'OVR / Quality Workflow',
    titleAr: 'بلاغات الجودة و OVR',
    group: 'quality',
    route: '/ovr',
    pilotReady: true,
    maturityTarget: 85,
    polishFocus: 'Keep workflow clear, role-gated, and confidentiality-safe.'
  },
  {
    key: 'capa-actions',
    title: 'CAPA / Corrective Actions',
    titleAr: 'الإجراءات التصحيحية CAPA',
    group: 'quality',
    route: '/projects',
    pilotReady: true,
    maturityTarget: 75,
    polishFocus: 'Show source, owner, due date, evidence, and closure quality.'
  },
  {
    key: 'risk-register',
    title: 'Risk Register',
    titleAr: 'سجل المخاطر',
    group: 'risk',
    route: '/risks',
    pilotReady: true,
    maturityTarget: 80,
    polishFocus: 'Make inherent/residual risk, owner, appetite, KRI, and review date obvious.'
  },
  {
    key: 'control-library',
    title: 'Controls Library',
    titleAr: 'مكتبة الضوابط',
    group: 'controls',
    route: '/governance',
    pilotReady: true,
    maturityTarget: 75,
    polishFocus: 'Connect every material risk to preventive, detective, and corrective controls.'
  },
  {
    key: 'control-testing',
    title: 'Control Testing',
    titleAr: 'اختبار الضوابط',
    group: 'assurance',
    route: '/audit',
    pilotReady: false,
    maturityTarget: 65,
    polishFocus: 'Prepare design effectiveness, operating effectiveness, evidence sampling, and remediation UX.'
  },
  {
    key: 'policy-control',
    title: 'Policy & Document Control',
    titleAr: 'السياسات والوثائق',
    group: 'policy',
    route: '/policies',
    pilotReady: false,
    maturityTarget: 65,
    polishFocus: 'Provide owner, version, approval, review date, and attestation clarity.'
  },
  {
    key: 'vendor-risk',
    title: 'Third-Party Risk',
    titleAr: 'مخاطر الموردين',
    group: 'vendor',
    route: '/compliance',
    pilotReady: false,
    maturityTarget: 55,
    polishFocus: 'Keep as later phase until vendor owners and risk appetite are agreed.'
  },
  {
    key: 'bcp-resilience',
    title: 'BCP / Resilience',
    titleAr: 'استمرارية الأعمال والمرونة',
    group: 'resilience',
    route: '/compliance',
    pilotReady: false,
    maturityTarget: 55,
    polishFocus: 'Keep as later phase until BIA, RTO/RPO, and drill evidence are agreed.'
  }
];

export const V120_POLISH_GUARDRAILS = [
  'No patient identifiers in pilot records.',
  'No confidential OVR details in test evidence.',
  'No delete action for v12.0 program configuration tables during controlled UAT.',
  'Do not bypass v66 human approval gates.',
  'Show empty states honestly instead of fabricated counts.',
  'Keep Arabic/RTL labels paired with English labels for executive/department usage.'
] as const;

export function v120ScoreToHealth(score: number | null | undefined): V120Health {
  if (typeof score !== 'number' || Number.isNaN(score)) return 'unknown';
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'watch';
  if (score >= 40) return 'attention';
  return 'critical';
}

export function v120PriorityRank(priority: V120Priority): number {
  const ranks: Record<V120Priority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };
  return ranks[priority];
}
