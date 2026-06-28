import { v180ExecutiveMetrics, v180RatingClass, v180TraceabilityGaps } from '../../lib/v180GrcTraceabilityModel';
import '../../styles/v180-grc-traceability.css';

export function TraceabilityGapPanel() {
  return (
    <section className="panel v180-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Traceability gaps</p>
          <h4>Go/no-go linkage warnings</h4>
          <p>These are not fake UAT results. They are professional closure rules that must be proven with real pilot evidence.</p>
        </div>
      </div>

      <div className="v180-metrics-grid">
        {v180ExecutiveMetrics.map((metric) => (
          <div className="mini-card v180-metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.hint}</small>
          </div>
        ))}
      </div>

      <div className="v180-gap-list">
        {v180TraceabilityGaps.map((gap) => (
          <article className={`v180-gap-card ${v180RatingClass(gap.severity)}`} key={gap.id}>
            <div className="v180-gap-title">
              <strong>{gap.gap}</strong>
              <span>{gap.severity}</span>
            </div>
            <p>{gap.impact}</p>
            <div className="v180-gap-remediation">
              <span>Owner: {gap.owner}</span>
              <span>Remediation: {gap.remediation}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
