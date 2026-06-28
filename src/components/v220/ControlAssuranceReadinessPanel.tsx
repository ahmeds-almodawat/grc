import { v220AssuranceMetrics, v220RequiredEvidence } from '../../lib/v220ControlTestingCapaModel';
import '../../styles/v220-control-testing-capa.css';

export function ControlAssuranceReadinessPanel() {
  return (
    <section className="panel v220-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">v22 assurance readiness</p>
          <h4>Control assurance and closure readiness</h4>
          <p className="muted">This panel defines what external audit or accreditation review will expect for control testing evidence.</p>
        </div>
      </div>
      <div className="v220-metric-grid">
        {v220AssuranceMetrics.map(metric => (
          <article className={`v220-metric-card ${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.explanation}</p>
          </article>
        ))}
      </div>
      <div className="v220-evidence-strip">
        {v220RequiredEvidence.map(item => <span key={item}>{item}</span>)}
      </div>
    </section>
  );
}
