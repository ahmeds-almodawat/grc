import { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { DataState } from '../components/DataState';
import { StatusBadge } from '../components/StatusBadge';
import { searchGlobal, type GlobalSearchResult } from '../lib/commandCenterApi';
import { useI18n } from '../i18n/I18nContext';

export function GlobalSearch() {
  const { t } = useI18n();
  const [query, setQuery] = useState('medication');
  const [results, setResults] = useState<GlobalSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      setResults(await searchGlobal(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page-section search-page">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">{t('search.eyebrow')}</p>
          <h3>{t('search.title')}</h3>
          <p className="section-subtitle">{t('search.subtitle')}</p>
        </div>
      </div>

      <div className="panel search-command-box">
        <div className="search-input-wrap">
          <Search size={22} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('search.placeholder')} onKeyDown={event => { if (event.key === 'Enter') void runSearch(); }} />
          <button className="primary-button" onClick={() => void runSearch()} disabled={!query.trim() || loading}>{t('common.search')}</button>
        </div>
        <p className="muted"><Sparkles size={15} /> {t('search.hint')}</p>
      </div>

      <DataState loading={loading} error={error} empty={results !== null && results.length === 0} emptyMessage={t('common.noData')}>
        {results && (
          <div className="panel">
            <div className="panel-header"><h4>{t('search.results')}</h4><p>{results.length} {t('search.matches')}</p></div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>{t('search.type')}</th><th>{t('search.result')}</th><th>{t('common.department')}</th><th>{t('common.owner')}</th><th>{t('common.status')}</th><th>{t('common.risk')}</th></tr></thead>
                <tbody>
                  {results.map(row => (
                    <tr key={`${row.sourceTable}-${row.id}`}>
                      <td><span className="status-badge">{row.sourceType}</span></td>
                      <td><strong>{row.title}</strong><p className="muted">{row.subtitle}</p></td>
                      <td>{row.department}</td>
                      <td>{row.owner}</td>
                      <td><StatusBadge status={row.status} /></td>
                      <td><span className={`risk-pill ${row.riskLevel}`}>{row.riskLevel}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DataState>
    </section>
  );
}
