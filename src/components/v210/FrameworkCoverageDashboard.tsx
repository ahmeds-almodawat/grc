import {
  v210CoverageMetrics,
  v210Frameworks,
  v210ProfessionalTraceabilityChain,
} from '../../lib/v210FrameworkCrosswalkModel';
import '../../styles/v210-framework-crosswalk.css';

export function FrameworkCoverageDashboard() {
  const partial = v210Frameworks.filter(item => item.coverageStatus === 'partial').length;
  const planned = v210Frameworks.filter(item => item.coverageStatus === 'planned').length;

  return (
    <section className="v210-crosswalk-panel v210-dashboard-panel" aria-label="v21 framework coverage dashboard">
      <div className="v210-crosswalk-hero">
        <div>
          <p className="eyebrow">Framework coverage dashboard</p>
          <h3>International accreditation crosswalk readiness</h3>
          <p>{v210ProfessionalTraceabilityChain}</p>
        </div>
        <div className="v210-dashboard-score">
          <strong>{partial}</strong>
          <span>frameworks partially covered</span>
        </div>
        <div className="v210-dashboard-score planned">
          <strong>{planned}</strong>
          <span>frameworks planned</span>
        </div>
      </div>
      <div className="v210-metric-grid">
        {v210CoverageMetrics.map(metric => (
          <article className={`v210-metric-card ${metric.status}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
