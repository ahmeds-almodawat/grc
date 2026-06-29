import '../../styles/v250-live-grc-operating.css';
import {
  v250LiveGrcOperatingChain,
  v250OperatingCycles,
  v250OperatingMetrics,
  type V250ReadinessState
} from '../../lib/v250LiveGrcOperatingModel';

function stateLabel(state: V250ReadinessState) {
  return state.replace(/_/g, ' ');
}

export function LiveOperatingCyclePanel() {
  return (
    <section className="v250-panel v250-operating-cycle" aria-label="v25 live GRC operating cycle panel">
      <div className="v250-panel-heading">
        <p className="eyebrow">v25.0 Live operating model</p>
        <h3>Professional GRC operating cycles and evidence gates</h3>
        <p>
          Defines how risk, compliance, control testing and auditor evidence cycles should operate before the platform is relied on
          for live accreditation, external review or executive assurance.
        </p>
      </div>

      <div className="v250-chain" title="Live GRC operating chain">
        {v250LiveGrcOperatingChain}
      </div>

      <div className="v250-metric-grid">
        {v250OperatingMetrics.map(metric => (
          <article className={`v250-metric-card ${metric.status}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <em>{stateLabel(metric.status)}</em>
            <p>{metric.note}</p>
          </article>
        ))}
      </div>

      <div className="v250-cycle-grid">
        {v250OperatingCycles.map(cycle => (
          <article className={`v250-cycle-card ${cycle.readiness}`} key={cycle.code}>
            <div className="v250-card-topline">
              <span>{cycle.code}</span>
              <b>{stateLabel(cycle.readiness)}</b>
            </div>
            <h4>{cycle.title}</h4>
            <dl>
              <div><dt>Cadence</dt><dd>{cycle.cadence}</dd></div>
              <div><dt>Owner</dt><dd>{cycle.owner}</dd></div>
              <div><dt>Evidence gate</dt><dd>{cycle.evidenceRule}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
