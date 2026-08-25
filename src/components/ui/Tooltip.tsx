import { useId, type ReactNode } from 'react';

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const tooltipId = useId();
  return (
    <span className="platform-tooltip" aria-describedby={tooltipId}>
      {children}
      <span className="platform-tooltip__content" id={tooltipId} role="tooltip">{label}</span>
    </span>
  );
}
