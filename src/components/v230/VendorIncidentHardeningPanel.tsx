import '../../styles/v230-compliance-hardening.css';
import { v230Incidents, v230RegulatoryChanges, v230VendorRisks } from '../../lib/v230ComplianceHardeningModel';

function tone(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function VendorIncidentHardeningPanel() {
  return (
    <section className="v230-panel v230-three-zone" aria-label="v23 vendor incident and regulatory hardening">
      <div className="v230-panel-heading compact">
        <p className="eyebrow">Compliance operating registers</p>
        <h3>Regulatory change, vendor risk and incident readiness</h3>
        <p>These registers close common external-audit gaps without expanding into a full ERP vendor or ticketing system.</p>
      </div>

      <div className="v230-zone-grid">
        <div className="v230-zone">
          <h4>Regulatory change</h4>
          {v230RegulatoryChanges.map(item => (
            <article key={item.id} className={`v230-zone-card ${tone(item.status)}`}>
              <strong>{item.requirement}</strong>
              <p>{item.impactArea}</p>
              <small>{item.owner} · {item.dueDate}</small>
              <span>{item.linkedControl}</span>
            </article>
          ))}
        </div>

        <div className="v230-zone">
          <h4>Vendor risk lite</h4>
          {v230VendorRisks.map(vendor => (
            <article key={vendor.id} className={`v230-zone-card ${tone(vendor.inherentRisk)}`}>
              <strong>{vendor.vendorName}</strong>
              <p>{vendor.serviceScope}</p>
              <small>{vendor.tier} · {vendor.dueDiligenceStatus.replace(/_/g, ' ')}</small>
              <span>{vendor.evidenceRequired}</span>
            </article>
          ))}
        </div>

        <div className="v230-zone">
          <h4>Incident readiness</h4>
          {v230Incidents.map(incident => (
            <article key={incident.id} className={`v230-zone-card ${tone(incident.severity)}`}>
              <strong>{incident.incidentType}</strong>
              <p>{incident.closureRequirement}</p>
              <small>{incident.owner} · {incident.status.replace(/_/g, ' ')}</small>
              <span>{incident.regulatoryClock}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
