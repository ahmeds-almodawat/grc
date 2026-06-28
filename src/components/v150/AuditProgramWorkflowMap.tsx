import { v150AuditProgramWorkflowChain, v150AuditWorkflow } from '../../lib/v150AuditProgramModel';
import '../../styles/v150-audit-program.css';

interface AuditProgramWorkflowMapProps {
  highlight?: string;
}

export function AuditProgramWorkflowMap({ highlight }: AuditProgramWorkflowMapProps) {
  return (
    <section className="v150-panel v150-workflow-panel" aria-label="Audit program execution workflow">
      <div className="v150-panel-header">
        <span className="v150-eyebrow">v15.0 audit program execution</span>
        <h3>{v150AuditProgramWorkflowChain}</h3>
        <p>
          This layer turns audit from a findings tracker into a repeatable internal audit lifecycle with
          universe coverage, engagement planning, workpapers, evidence requests, findings, management response,
          follow-up and assurance reporting.
        </p>
      </div>

      <div className="v150-workflow-chain">
        {v150AuditWorkflow.map((step, index) => (
          <article
            key={step.id}
            className={`v150-workflow-step ${highlight === step.id ? 'is-highlighted' : ''}`}
          >
            <span className="v150-step-index">{String(index + 1).padStart(2, '0')}</span>
            <strong>{step.title}</strong>
            <p>{step.objective}</p>
            <small><b>Output:</b> {step.output}</small>
            <small><b>Owner:</b> {step.owner}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
