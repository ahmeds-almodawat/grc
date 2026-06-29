import '../../styles/v250-live-grc-operating.css';
import { v250DataBridgeItems, type V250ReadinessState } from '../../lib/v250LiveGrcOperatingModel';

function stateLabel(state: V250ReadinessState) {
  return state.replace(/_/g, ' ');
}

export function DataBridgeGovernancePanel() {
  return (
    <section className="v250-panel v250-data-bridge" aria-label="v25 data bridge governance panel">
      <div className="v250-panel-heading compact">
        <p className="eyebrow">Data bridge governance</p>
        <h3>Live-readiness rules for moving from static proof to operational reliance</h3>
        <p>
          Each live data bridge must have a source, target, reviewer and control point before it can support management reporting,
          assurance opinions or external auditor exports.
        </p>
      </div>

      <div className="v250-bridge-table" role="table" aria-label="v25 data bridge readiness">
        <div className="v250-bridge-row head" role="row">
          <span>Source</span><span>Target</span><span>Reviewer</span><span>Status</span>
        </div>
        {v250DataBridgeItems.map(item => (
          <div className={`v250-bridge-row ${item.bridgeStatus}`} role="row" key={`${item.source}-${item.target}`}>
            <span>{item.source}</span>
            <span>{item.target}<small>{item.controlPoint}</small></span>
            <span>{item.reviewer}</span>
            <span><b>{stateLabel(item.bridgeStatus)}</b></span>
          </div>
        ))}
      </div>
    </section>
  );
}
