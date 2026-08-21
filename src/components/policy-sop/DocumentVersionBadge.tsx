interface DocumentVersionBadgeProps {
  versionLabel?: string | null;
  versionNumber?: number | null;
  isCurrent?: boolean;
  className?: string;
}

export function DocumentVersionBadge({ versionLabel, versionNumber, isCurrent, className = '' }: DocumentVersionBadgeProps) {
  const label = versionLabel || (versionNumber !== null && versionNumber !== undefined ? String(versionNumber) : '—');

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium ${isCurrent ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800' : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'} ${className}`}>
      {label}
      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" title="Current Published Version" />}
    </span>
  );
}
