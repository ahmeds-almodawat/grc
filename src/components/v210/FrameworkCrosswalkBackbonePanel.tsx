import {
  v210BackboneTables,
  v210CoverageMetrics,
  v210Frameworks,
  v210PanelForContext,
  v210ProfessionalTraceabilityChain,
  v210TraceabilitySteps,
  type V210ContextPanel,
} from '../../lib/v210FrameworkCrosswalkModel';
import '../../styles/v210-framework-crosswalk.css';

interface FrameworkCrosswalkBackbonePanelProps {
  context?: V210ContextPanel['context'];
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

export function FrameworkCrosswalkBackbonePanel({ context = 'governance' }: FrameworkCrosswalkBackbonePanelProps) {
  const panel = v210PanelForContext(context);
  const priorityFrameworks = v210Frameworks.slice(0, 4);
  const optionalFrameworks = v210Frameworks.slice(4);

  return (
    <section className="v210-crosswalk-panel" aria-label="v21 framework crosswalk backbone">
      <div className="v210-crosswalk-hero">
        <div>
          <p className="eyebrow">v21 Framework Crosswalk + Live GRC Backbone</p>
          <h3>{panel.title}</h3>
          <p>{panel.objective}</p>
        </div>
        <div className="v210-chain-card">
          <span>Professional assurance chain</span>
          <strong>{v210ProfessionalTraceabilityChain}</strong>
        </div>
      </div>

      <div className="v210-context-grid">
        <article className="v210-context-card">
          <span>Primary assurance question</span>
          <strong>{panel.primaryQuestion}</strong>
        </article>
        <article className="v210-context-card">
          <span>Required live links</span>
          <div className="v210-chip-row">
            {panel.requiredLinks.map(link => <small key={link}>{link}</small>)}
          </div>
        </article>
      </div>

      <div className="v210-framework-grid">
        {priorityFrameworks.map(framework => (
          <article className={`v210-framework-card ${framework.coverageStatus}`} key={framework.code}>
            <div>
              <strong>{framework.code}</strong>
              <span>{statusLabel(framework.coverageStatus)}</span>
            </div>
            <h4>{framework.name}</h4>
            <p>{framework.professionalUse}</p>
            <ul>
              {framework.requiredBackbone.slice(0, 3).map(item => <li key={item}>{item}</li>)}
            </ul>
          </article>
        ))}
      </div>

      <div className="v210-two-column">
        <div className="v210-card">
          <div className="panel-header">
            <h4>Traceability workflow</h4>
            <p>Every closure claim should move through this chain before board or external-audit reporting.</p>
          </div>
          <div className="v210-workflow">
            {v210TraceabilitySteps.map((step, index) => (
              <div className="v210-workflow-step" key={step.id}>
                <span>{index + 1}</span>
                <div>
                  <strong>{step.label}</strong>
                  <p>{step.assuranceQuestion}</p>
                  <small>{step.requiredEvidence}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="v210-card">
          <div className="panel-header">
            <h4>Backbone tables</h4>
            <p>Add-only database contract for framework coverage and relationship mapping.</p>
          </div>
          <div className="v210-table-stack">
            {v210BackboneTables.map(table => (
              <article key={table.table}>
                <strong>{table.table}</strong>
                <span>{table.liveUse}</span>
                <small>{table.closureRule}</small>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="v210-metric-grid">
        {v210CoverageMetrics.map(metric => (
          <div className={`v210-metric-card ${metric.status}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.note}</p>
          </div>
        ))}
      </div>

      <details className="v210-details">
        <summary>Optional framework expansion</summary>
        <div className="v210-chip-row">
          {optionalFrameworks.map(framework => (
            <small key={framework.code}>{framework.code} · {framework.name}</small>
          ))}
        </div>
      </details>
    </section>
  );
}
