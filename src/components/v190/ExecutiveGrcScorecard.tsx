import '../../styles/v190-executive-reporting.css';
import { v190ExecutiveMetrics, v190ExecutiveReportingChain, v190ManagementViews } from '../../lib/v190ExecutiveGrcReportingModel';

interface ExecutiveGrcScorecardProps {
  context?: 'command-center' | 'board-pack' | 'governance';
}

export function ExecutiveGrcScorecard({ context = 'command-center' }: ExecutiveGrcScorecardProps) {
  return (
    <section className={`v190-panel v190-panel-${context}`} aria-label="v19 executive GRC scorecard">
      <div className="v190-panel-header">
        <p className="eyebrow">v19 Executive Reporting</p>
        <h4>Executive GRC scorecard</h4>
        <p>
          Converts GRC activity into management-ready visibility across risk, KRI, controls, evidence,
          CAPA, audit, compliance, committee action and board reporting.
        </p>
      </div>

      <div className="v190-chain" aria-label="Executive reporting chain">
        {v190ExecutiveReportingChain.split(' → ').map((step) => (
          <span key={step}>{step}</span>
        ))}
      </div>

      <div className="v190-scorecard-grid">
        {v190ExecutiveMetrics.map((metric) => (
          <article className={`v190-card v190-signal-${metric.signal}`} key={metric.id}>
            <div className="v190-card-head">
              <strong>{metric.label}</strong>
              <span>{metric.signal}</span>
            </div>
            <p>{metric.value}</p>
            <small>{metric.interpretation}</small>
            <div className="v190-rule">{metric.escalationRule}</div>
          </article>
        ))}
      </div>

      <div className="v190-management-grid">
        {v190ManagementViews.map((view) => (
          <article className={`v190-management-view v190-status-${view.status}`} key={view.id}>
            <div>
              <strong>{view.title}</strong>
              <span>{view.status}</span>
            </div>
            <p>{view.rationale}</p>
            <ul>
              {view.requiredInputs.map((input) => <li key={input}>{input}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
