import { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { DataState } from '../components/DataState';
import { StatusBadge } from '../components/StatusBadge';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchField } from '../components/ui/FilterBar';
import { ResponsiveTable, type ResponsiveTableColumn } from '../components/ui/ResponsiveTable';
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
      setError(err instanceof Error ? err.message : t('search.failed'));
    } finally {
      setLoading(false);
    }
  };

  const columns: ResponsiveTableColumn<GlobalSearchResult>[] = [
    { key: 'result', header: t('search.result'), primary: true, render: (row) => <div><strong>{row.title}</strong><p className="muted">{row.subtitle}</p></div> },
    { key: 'type', header: t('search.type'), render: (row) => <span className="status-badge">{row.sourceType}</span> },
    { key: 'department', header: t('common.department'), render: (row) => row.department },
    { key: 'owner', header: t('common.owner'), render: (row) => row.owner },
    { key: 'status', header: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
    { key: 'risk', header: t('common.risk'), render: (row) => <span className={`risk-pill ${row.riskLevel}`}>{row.riskLevel}</span> },
  ];

  return (
    <section className="page-section search-page">
      <PageHeader
        eyebrow={t('search.eyebrow')}
        title={t('search.title')}
        subtitle={t('search.subtitle')}
        breadcrumbs={[{ label: t('nav.home', 'Home') }, { label: t('search.title') }]}
        icon={<Search size={20} />}
      />

      <div className="panel search-command-box">
        <SearchField
          value={query}
          onChange={setQuery}
          onSubmit={() => void runSearch()}
          placeholder={t('search.placeholder')}
          label={t('search.title')}
          disabled={loading}
        />
        <div className="search-command-box__actions">
          <p><Sparkles size={15} aria-hidden="true" /> {t('search.hint')}</p>
          <button className="platform-primary-button" type="button" onClick={() => void runSearch()} disabled={!query.trim() || loading}>
            <Search size={15} aria-hidden="true" />{t('common.search')}
          </button>
        </div>
      </div>

      <DataState loading={loading} error={error} empty={results !== null && results.length === 0} emptyMessage={t('common.noData')}>
        {results ? (
          <section className="search-results-panel">
            <header><h2>{t('search.results')}</h2><span>{results.length} {t('search.matches')}</span></header>
            <ResponsiveTable
              ariaLabel={t('search.results')}
              columns={columns}
              rows={results}
              getRowKey={(row) => `${row.sourceTable}-${row.id}`}
            />
          </section>
        ) : null}
      </DataState>
    </section>
  );
}
