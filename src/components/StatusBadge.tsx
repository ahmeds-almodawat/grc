interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toLowerCase().replaceAll(' ', '-').replaceAll('_', '-');
  return <span className={`status-badge status-${normalized}`}>{status}</span>;
}
