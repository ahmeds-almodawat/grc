import { v220CapaExecutionWorkflow } from '../../lib/v220ControlTestingCapaModel';
import '../../styles/v220-control-testing-capa.css';

export function CapaExecutionPanel() {
  return (
    <section className="panel v220-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">v22 CAPA execution</p>
          <h4>Failed test to CAPA closure discipline</h4>
          <p className="muted">Findings and failed controls should move through management response, CAPA, evidence, retest and independent closure.</p>
        </div>
      </div>
      <div className="v220-capa-list">
        {v220CapaExecutionWorkflow.map(step => (
          <article className={`v220-capa-card ${step.status}`} key={step.id}>
            <div>
              <strong>{step.title}</strong>
              <span>{step.owner}</span>
            </div>
            <p>{step.trigger}</p>
            <ul>
              <li><b>Before closure:</b> {step.requiredBeforeClosure}</li>
              <li><b>Escalation:</b> {step.escalationRule}</li>
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
