interface StatusBadgeProps {
  status: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';
}

const STATUS_TONES: Array<{ tone: NonNullable<StatusBadgeProps['tone']>; values: string[] }> = [
  { tone: 'success', values: ['approved', 'active', 'completed', 'closed', 'compliant', 'effective', 'verified', 'published'] },
  { tone: 'warning', values: ['pending', 'under-review', 'in-review', 'in-progress', 'partially-compliant', 'due-soon'] },
  { tone: 'danger', values: ['rejected', 'overdue', 'expired', 'critical', 'non-compliant', 'failed', 'blocked'] },
  { tone: 'info', values: ['draft', 'open', 'scheduled', 'planned', 'submitted'] },
  { tone: 'purple', values: ['needs-review', 'changes-requested', 'waiver', 'exception'] },
];

export function StatusBadge({ status, tone }: StatusBadgeProps) {
  const normalized = status.toLowerCase().replaceAll(' ', '-').replaceAll('_', '-');
  const resolvedTone = tone ?? STATUS_TONES.find((entry) => entry.values.some((value) => normalized.includes(value)))?.tone ?? 'neutral';
  return <span className={`status-badge status-${normalized}`} data-tone={resolvedTone}>{status}</span>;
}
