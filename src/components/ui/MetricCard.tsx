import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

export type MetricTone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';

export function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = 'brand',
  trend,
  trendDirection = 'flat',
  onClick,
  loading = false,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: MetricTone;
  trend?: ReactNode;
  trendDirection?: 'up' | 'down' | 'flat';
  onClick?: () => void;
  loading?: boolean;
}) {
  const TrendIcon = trendDirection === 'up' ? ArrowUpRight : trendDirection === 'down' ? ArrowDownRight : Minus;
  const content = (
    <>
      <span className="platform-metric-card__top">
        {icon ? <span className="platform-metric-card__icon" aria-hidden="true">{icon}</span> : null}
        <span className="platform-metric-card__label">{label}</span>
      </span>
      {loading ? <span className="platform-skeleton platform-skeleton--metric" aria-hidden="true" /> : <strong>{value}</strong>}
      {trend || detail ? (
        <span className="platform-metric-card__footer">
          {trend ? <span className={`platform-metric-card__trend is-${trendDirection}`}><TrendIcon size={13} />{trend}</span> : null}
          {detail ? <small>{detail}</small> : null}
        </span>
      ) : null}
    </>
  );

  return onClick ? (
    <button type="button" className={`platform-metric-card is-${tone}`} onClick={onClick} aria-busy={loading}>{content}</button>
  ) : (
    <div className={`platform-metric-card is-${tone}`} aria-busy={loading}>{content}</div>
  );
}
