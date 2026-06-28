import { v180RatingClass, v180TraceabilityChain, v180TraceabilityNodes } from '../../lib/v180GrcTraceabilityModel';
import '../../styles/v180-grc-traceability.css';

interface GrcTraceabilityMapProps {
  context?: 'governance' | 'evidence' | 'executive';
}

export function GrcTraceabilityMap({ context = 'governance' }: GrcTraceabilityMapProps) {
  const contextLabel = {
    governance: 'Governance traceability view',
    evidence: 'Evidence closure traceability',
    executive: 'Executive assurance traceability',
  }[context];

  return (
    <section className="panel v180-panel v180-traceability-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">v18.0 Traceability + assurance map</p>
          <h4>{contextLabel}</h4>
          <p>{v180TraceabilityChain}</p>
        </div>
        <span className="v180-badge">Connected GRC engine</span>
      </div>

      <div className="v180-chain-grid">
        {v180TraceabilityNodes.map((node, index) => (
          <article className={`v180-chain-node ${v180RatingClass(node.status)}`} key={node.id}>
            <div className="v180-node-index">{index + 1}</div>
            <div>
              <div className="v180-node-title">
                <strong>{node.label}</strong>
                <span>{node.status}</span>
              </div>
              <p>{node.description}</p>
              <dl>
                <div><dt>Owner</dt><dd>{node.owner}</dd></div>
                <div><dt>Evidence</dt><dd>{node.evidenceRequired}</dd></div>
              </dl>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
