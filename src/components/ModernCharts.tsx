import type { CSSProperties } from 'react';
import type { DepartmentHeatmapRow, RadarProfileRow } from '../lib/hardeningApi';

export function RiskHeatmap({
  rows,
  language = 'en',
}: {
  rows: DepartmentHeatmapRow[];
  language?: 'en' | 'ar';
}) {
  const data = rows.length
    ? rows
    : [
        { department_name_en: 'Nursing', department_name_ar: 'التمريض', risk_score: 82, overdue_items: 12 },
        { department_name_en: 'Pharmacy', department_name_ar: 'الصيدلية', risk_score: 66, overdue_items: 6 },
        { department_name_en: 'Quality', department_name_ar: 'الجودة', risk_score: 38, overdue_items: 2 },
        { department_name_en: 'Finance', department_name_ar: 'المالية', risk_score: 54, overdue_items: 4 },
      ];

  const maxScore = Math.max(...data.map((row) => Number(row.risk_score ?? row.total_score ?? 0)), 1);

  return (
    <div className="heatmap-grid">
      {data.map((row, index) => {
        const score = Number(row.risk_score ?? row.total_score ?? 0);
        const intensity = Math.max(0.12, Math.min(1, score / maxScore));
        const name = language === 'ar'
          ? row.department_name_ar || row.department || row.department_name_en || '—'
          : row.department_name_en || row.department || row.department_name_ar || '—';
        return (
          <div
            key={`${name}-${index}`}
            className="heatmap-cell"
            style={{ '--heat': intensity } as CSSProperties}
          >
            <span>{name}</span>
            <strong>{score}</strong>
            <small>{language === 'ar' ? 'نقاط المخاطر' : 'Risk score'}</small>
          </div>
        );
      })}
    </div>
  );
}

export function RadarMiniChart({
  rows,
  language = 'en',
}: {
  rows: RadarProfileRow[];
  language?: 'en' | 'ar';
}) {
  const data = rows.length
    ? rows
    : [
        { dimension_en: 'Evidence', dimension_ar: 'الأدلة', score: 72 },
        { dimension_en: 'Approvals', dimension_ar: 'الاعتمادات', score: 58 },
        { dimension_en: 'Risk', dimension_ar: 'المخاطر', score: 66 },
        { dimension_en: 'OVR', dimension_ar: 'OVR', score: 81 },
        { dimension_en: 'Compliance', dimension_ar: 'الامتثال', score: 61 },
        { dimension_en: 'Audit', dimension_ar: 'التدقيق', score: 49 },
      ];

  const size = 280;
  const center = size / 2;
  const radius = 94;
  const points = data.map((row, index) => {
    const angle = (Math.PI * 2 * index) / data.length - Math.PI / 2;
    const score = Math.max(0, Math.min(100, Number(row.score ?? row.value ?? 0)));
    return {
      label: language === 'ar' ? row.dimension_ar || row.dimension_en || row.dimension || '' : row.dimension_en || row.dimension || row.dimension_ar || '',
      score,
      x: center + Math.cos(angle) * radius * (score / 100),
      y: center + Math.sin(angle) * radius * (score / 100),
      labelX: center + Math.cos(angle) * (radius + 34),
      labelY: center + Math.sin(angle) * (radius + 34),
    };
  });

  const polygon = points.map((point) => `${point.x},${point.y}`).join(' ');
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="radar-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="radar-svg" role="img" aria-label="Control maturity radar">
        {rings.map((ring) => (
          <circle key={ring} cx={center} cy={center} r={radius * ring} className="radar-ring" />
        ))}
        {points.map((point, index) => (
          <line key={index} x1={center} y1={center} x2={point.labelX} y2={point.labelY} className="radar-axis" />
        ))}
        <polygon points={polygon} className="radar-polygon" />
        {points.map((point, index) => (
          <g key={index}>
            <circle cx={point.x} cy={point.y} r="4" className="radar-dot" />
            <text x={point.labelX} y={point.labelY} className="radar-label" textAnchor="middle">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
