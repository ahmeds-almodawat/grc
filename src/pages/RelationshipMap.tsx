import { GitBranch, Link2 } from 'lucide-react';
import { DataState } from '../components/DataState';
import { StatusBadge } from '../components/StatusBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { getRelationshipMap } from '../lib/commandCenterApi';
import { useI18n } from '../i18n/I18nContext';

export function RelationshipMap() {
  const { t } = useI18n();
  const relationships = useAsyncData(getRelationshipMap, []);

  return (
    <section className="page-section relationship-page">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">{t('relationships.eyebrow')}</p>
          <h3>{t('relationships.title')}</h3>
          <p className="section-subtitle">{t('relationships.subtitle')}</p>
        </div>
      </div>

      <div className="panel relationship-canvas">
        <div className="panel-header"><h4>{t('relationships.map')}</h4><p>{t('relationships.mapHint')}</p></div>
        <DataState loading={relationships.loading} error={relationships.error} empty={!relationships.data?.length}>
          <div className="relationship-list">
            {(relationships.data ?? []).map(row => (
              <article className="relationship-row" key={row.id}>
                <div className="relationship-node source">
                  <GitBranch size={18} />
                  <span>{row.sourceType}</span>
                  <strong>{row.sourceTitle}</strong>
                </div>
                <div className="relationship-arrow"><span>{row.relationshipType}</span><Link2 size={18} /></div>
                <div className="relationship-node target">
                  <GitBranch size={18} />
                  <span>{row.targetType}</span>
                  <strong>{row.targetTitle}</strong>
                </div>
                <div className="relationship-meta">
                  <StatusBadge status={row.status} />
                  <span className={`risk-pill ${row.riskLevel}`}>{row.riskLevel}</span>
                  <small>{row.department}</small>
                </div>
              </article>
            ))}
          </div>
        </DataState>
      </div>
    </section>
  );
}
