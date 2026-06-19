import type { ReactNode } from 'react';
import type { RiskLevel } from '../../types/domain';

export interface TrendPoint {
  label: string;
  [key: string]: string | number | null;
}

export interface TrendSeries {
  key: string;
  label: string;
}

interface KpiGaugeProps {
  label: string;
  value: number;
  hint?: string;
  inverse?: boolean;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function levelFromScore(value: number, inverse = false): RiskLevel {
  const score = clamp(value);
  if (inverse) {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }
  if (score < 35) return 'critical';
  if (score < 60) return 'high';
  if (score < 80) return 'medium';
  return 'low';
}

export function KpiGauge({ label, value, hint, inverse = false }: KpiGaugeProps) {
  const score = clamp(value);
  const level = levelFromScore(score, inverse);
  return (
    <div className={`analytics-card gauge-card risk-${level}`}>
      <div className="gauge-topline">
        <span>{label}</span>
        <strong>{Math.round(score)}</strong>
      </div>
      <div className="gauge-track" aria-label={`${label}: ${Math.round(score)}`}>
        <span style={{ width: `${score}%` }} />
      </div>
      {hint ? <p>{hint}</p> : null}
    </div>
  );
}

interface MiniLineChartProps {
  title: string;
  description?: string;
  data: TrendPoint[];
  series: TrendSeries[];
}

export function MiniLineChart({ title, description, data, series }: MiniLineChartProps) {
  const width = 640;
  const height = 260;
  const padding = 34;
  const numericValues = data.flatMap(row => series.map(item => Number(row[item.key] || 0)));
  const max = Math.max(1, ...numericValues);
  const xStep = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
  const toY = (value: number) => height - padding - (value / max) * (height - padding * 2);

  return (
    <div className="analytics-panel chart-panel">
      <div className="panel-header">
        <h4>{title}</h4>
        {description ? <p>{description}</p> : null}
      </div>
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        {[0, 0.25, 0.5, 0.75, 1].map(step => {
          const y = padding + step * (height - padding * 2);
          return <line key={step} x1={padding} x2={width - padding} y1={y} y2={y} className="chart-gridline" />;
        })}
        {series.map((item, seriesIndex) => {
          const points = data.map((row, index) => {
            const x = padding + index * xStep;
            const y = toY(Number(row[item.key] || 0));
            return `${x},${y}`;
          }).join(' ');
          return <polyline key={item.key} points={points} className={`line-series series-${seriesIndex + 1}`} />;
        })}
        {data.map((row, index) => {
          const x = padding + index * xStep;
          return (
            <text key={row.label} x={x} y={height - 8} className="chart-x-label" textAnchor="middle">
              {row.label}
            </text>
          );
        })}
      </svg>
      <div className="chart-legend">
        {series.map((item, index) => (
          <span key={item.key}><i className={`legend-dot series-${index + 1}`} />{item.label}</span>
        ))}
      </div>
    </div>
  );
}

interface BarChartProps {
  title: string;
  description?: string;
  data: Array<{ label: string; value: number; level?: RiskLevel }>;
}

export function HorizontalBarChart({ title, description, data }: BarChartProps) {
  const max = Math.max(1, ...data.map(row => row.value));
  return (
    <div className="analytics-panel">
      <div className="panel-header">
        <h4>{title}</h4>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="horizontal-bars">
        {data.map(row => (
          <div className="hbar-row" key={row.label}>
            <span className="hbar-label">{row.label}</span>
            <div className="hbar-track"><span className={`hbar-fill risk-${row.level || 'medium'}`} style={{ width: `${(row.value / max) * 100}%` }} /></div>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

interface HeatmapProps<T> {
  title: string;
  description?: string;
  rows: T[];
  rowLabel: (row: T) => string;
  cells: Array<{ key: string; label: string; value: (row: T) => number }>;
}

function heatClass(value: number) {
  if (value >= 75) return 'heat-4';
  if (value >= 50) return 'heat-3';
  if (value >= 25) return 'heat-2';
  if (value > 0) return 'heat-1';
  return 'heat-0';
}

export function Heatmap<T>({ title, description, rows, rowLabel, cells }: HeatmapProps<T>) {
  return (
    <div className="analytics-panel heatmap-panel">
      <div className="panel-header">
        <h4>{title}</h4>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="heatmap-scroll">
        <div className="heatmap-grid" style={{ gridTemplateColumns: `minmax(150px, 1.2fr) repeat(${cells.length}, minmax(92px, 1fr))` }}>
          <div className="heatmap-head">Department</div>
          {cells.map(cell => <div key={cell.key} className="heatmap-head">{cell.label}</div>)}
          {rows.map(row => (
            <FragmentRow key={rowLabel(row)}>
              <div className="heatmap-row-label">{rowLabel(row)}</div>
              {cells.map(cell => {
                const value = cell.value(row);
                return <div key={cell.key} className={`heat-cell ${heatClass(value)}`} title={`${cell.label}: ${Math.round(value)}`}>{Math.round(value)}</div>;
              })}
            </FragmentRow>
          ))}
        </div>
      </div>
    </div>
  );
}

function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export interface RadarAxis {
  label: string;
  value: number;
}

interface RadarChartProps {
  title: string;
  description?: string;
  axes: RadarAxis[];
}

export function RadarChart({ title, description, axes }: RadarChartProps) {
  const size = 320;
  const center = size / 2;
  const radius = 112;
  const safeAxes = axes.length ? axes : [{ label: 'No data', value: 0 }];
  const angleStep = (Math.PI * 2) / safeAxes.length;

  const pointFor = (index: number, value = 100) => {
    const angle = -Math.PI / 2 + index * angleStep;
    const r = radius * (clamp(value) / 100);
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r];
  };

  const polygon = safeAxes.map((axis, index) => pointFor(index, axis.value).join(',')).join(' ');
  const rings = [25, 50, 75, 100].map(level => safeAxes.map((_axis, index) => pointFor(index, level).join(',')).join(' '));

  return (
    <div className="analytics-panel radar-panel">
      <div className="panel-header">
        <h4>{title}</h4>
        {description ? <p>{description}</p> : null}
      </div>
      <svg className="radar-chart" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
        {rings.map(points => <polygon key={points} points={points} className="radar-ring" />)}
        {safeAxes.map((axis, index) => {
          const [x, y] = pointFor(index, 100);
          const [lx, ly] = pointFor(index, 116);
          return (
            <g key={axis.label}>
              <line x1={center} y1={center} x2={x} y2={y} className="radar-axis" />
              <text x={lx} y={ly} className="radar-label" textAnchor={lx < center - 8 ? 'end' : lx > center + 8 ? 'start' : 'middle'}>{axis.label}</text>
            </g>
          );
        })}
        <polygon points={polygon} className="radar-area" />
        {safeAxes.map((axis, index) => {
          const [x, y] = pointFor(index, axis.value);
          return <circle key={`${axis.label}-point`} cx={x} cy={y} r="4" className="radar-point" />;
        })}
      </svg>
    </div>
  );
}
