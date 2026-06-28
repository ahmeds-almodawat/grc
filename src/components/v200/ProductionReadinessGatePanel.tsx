import { getV200ReadinessSummary, v200ReadinessGates } from '../../lib/v200ProductionReadinessModel';
import '../../styles/v200-production-readiness.css';

interface ProductionReadinessGatePanelProps {
  context?: 'release' | 'proof' | 'command' | 'uat';
}

const tone = (status: string) => status === 'passed' ? 'passed' : status === 'blocked' ? 'blocked' : 'review-required';

export function ProductionReadinessGatePanel({ context = 'release' }: ProductionReadinessGatePanelProps) {
  const summary = getV200ReadinessSummary();

  return (
    <section className={`v200-panel v200-gate-panel ${context}`}>
      <div className="v200-panel-header">
        <div>
          <p className="v200-eyebrow">v20.0 production hardening</p>
          <h3>Production go/no-go checklist</h3>
          <p>{summary.reason}</p>
        </div>
        <div className={`v200-recommendation ${summary.blockingIssues ? 'blocked' : 'review-required'}`}>{summary.recommendation}</div>
      </div>

      <div className="v200-gate-grid">
        {v200ReadinessGates.map(gate => (
          <article className={`v200-gate-card ${tone(gate.status)}`} key={gate.id}>
            <div className="v200-gate-head"><strong>{gate.title}</strong><span>{gate.status.replaceAll('_', ' ')}</span></div>
            <p>{gate.purpose}</p>
            <small>Owner: {gate.owner}</small>
            <ul>
              {gate.requiredEvidence.map(evidence => <li key={evidence}>{evidence}</li>)}
            </ul>
            <em>{gate.productionImpact}</em>
          </article>
        ))}
      </div>
    </section>
  );
}
