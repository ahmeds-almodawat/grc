import '../../styles/v240-assurance-sod-auditor.css';
import { v240AuditorPackItems, v240EvidenceIntegrityItems } from '../../lib/v240AssuranceSodAuditorModel';

function statusClass(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function AuditorEvidencePackPanel() {
  return (
    <section className="v240-panel" aria-label="v24 auditor evidence pack panel">
      <div className="v240-panel-heading compact">
        <p className="eyebrow">Auditor evidence workspace</p>
        <h3>Evidence integrity index and read-only auditor packs</h3>
        <p>Auditors should be able to trace framework coverage to tested controls, accepted evidence, open findings and CAPA closure without receiving edit access.</p>
      </div>

      <div className="v240-table" role="table" aria-label="Evidence integrity index table">
        <div className="v240-row v240-head" role="row">
          <span>Evidence</span>
          <span>Source</span>
          <span>Status</span>
          <span>Required metadata</span>
        </div>
        {v240EvidenceIntegrityItems.map(item => (
          <div className="v240-row" role="row" key={item.id}>
            <span><strong>{item.evidenceType}</strong><small>{item.auditorNote}</small></span>
            <span>{item.sourceModule}</span>
            <span><mark className={`v240-status ${statusClass(item.integrityStatus)}`}>{item.integrityStatus.replace(/_/g, ' ')}</mark></span>
            <span>{item.requiredMetadata.join(' · ')}</span>
          </div>
        ))}
      </div>

      <div className="v240-pack-grid">
        {v240AuditorPackItems.map(pack => (
          <article className={`v240-pack-card ${statusClass(pack.readiness)}`} key={pack.id}>
            <span>{pack.framework}</span>
            <strong>{pack.packName}</strong>
            <p>{pack.contents.join(' · ')}</p>
            <div><mark>{pack.accessMode.replace(/_/g, ' ')}</mark><mark>{pack.readiness.replace(/_/g, ' ')}</mark></div>
          </article>
        ))}
      </div>
    </section>
  );
}
