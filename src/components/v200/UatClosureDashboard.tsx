import { getV200ReadinessSummary, v200ControlledProductionScope, v200ProductionReadinessChain, v200ScenarioClosureItems } from '../../lib/v200ProductionReadinessModel';
import '../../styles/v200-production-readiness.css';

export function UatClosureDashboard() {
  const summary = getV200ReadinessSummary();
  const ready = v200ScenarioClosureItems.filter(item => item.status === 'ready_for_execution').length;

  return (
    <section className="v200-panel v200-uat-panel">
      <div className="v200-panel-header">
        <div>
          <p className="v200-eyebrow">v20.0 UAT closure</p>
          <h3>Controlled pilot closure dashboard</h3>
          <p>{v200ControlledProductionScope.statement}</p>
        </div>
        <div className="v200-recommendation review-required">{summary.recommendation}</div>
      </div>

      <div className="v200-chain">{v200ProductionReadinessChain}</div>

      <div className="v200-kpi-grid">
        <article><span>Scenario scripts</span><strong>{v200ScenarioClosureItems.length}</strong><small>Ready for controlled UAT execution</small></article>
        <article><span>Ready to execute</span><strong>{ready}</strong><small>No pass is claimed until testers complete UAT</small></article>
        <article><span>Maximum pilot users</span><strong>{v200ControlledProductionScope.maxUsers}</strong><small>{v200ControlledProductionScope.dataRule}</small></article>
        <article><span>Review items</span><strong>{summary.reviewRequiredItems}</strong><small>Need real closure evidence</small></article>
      </div>

      <div className="v200-scenario-grid">
        {v200ScenarioClosureItems.map(item => (
          <article className="v200-scenario-card" key={item.id}>
            <div><strong>{item.persona}</strong><span>{item.status.replaceAll('_', ' ')}</span></div>
            <p>{item.scenario}</p>
            <small>{item.expectedEvidence}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
