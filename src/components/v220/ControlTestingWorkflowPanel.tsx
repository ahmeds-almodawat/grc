import { v220ControlTestingChain, v220ControlTestingWorkflow } from '../../lib/v220ControlTestingCapaModel';
import '../../styles/v220-control-testing-capa.css';

export function ControlTestingWorkflowPanel() {
  return (
    <section className="panel v220-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">v22 control testing</p>
          <h4>Control testing execution workflow</h4>
          <p className="muted">{v220ControlTestingChain}</p>
        </div>
      </div>
      <div className="v220-workflow-grid">
        {v220ControlTestingWorkflow.map((step, index) => (
          <article className={`v220-workflow-card ${step.status}`} key={step.id}>
            <span className="v220-step-number">{index + 1}</span>
            <h5>{step.title}</h5>
            <p>{step.objective}</p>
            <dl>
              <div><dt>Owner</dt><dd>{step.owner}</dd></div>
              <div><dt>Evidence</dt><dd>{step.requiredEvidence}</dd></div>
              <div><dt>Output</dt><dd>{step.output}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
