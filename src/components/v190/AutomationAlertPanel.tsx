import '../../styles/v190-executive-reporting.css';
import { v190AutomationAlerts } from '../../lib/v190ExecutiveGrcReportingModel';

interface AutomationAlertPanelProps {
  context?: 'command-center' | 'committee' | 'board-pack';
}

export function AutomationAlertPanel({ context = 'command-center' }: AutomationAlertPanelProps) {
  return (
    <section className={`v190-panel v190-automation-${context}`} aria-label="v19 executive automation alerts">
      <div className="v190-panel-header">
        <p className="eyebrow">v19 Automation Rules</p>
        <h4>Executive escalation and aging alerts</h4>
        <p>
          A controlled automation layer for KRI breaches, overdue CAPA, audit aging, compliance aging and board-pack readiness.
        </p>
      </div>

      <div className="v190-alert-grid">
        {v190AutomationAlerts.map((alert) => (
          <article className={`v190-alert v190-signal-${alert.signal}`} key={alert.id}>
            <div className="v190-card-head">
              <strong>{alert.title}</strong>
              <span>{alert.signal}</span>
            </div>
            <p><b>Trigger:</b> {alert.trigger}</p>
            <p><b>Owner:</b> {alert.owner}</p>
            <p><b>Cadence:</b> {alert.cadence}</p>
            <div className="v190-rule">{alert.escalation}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
