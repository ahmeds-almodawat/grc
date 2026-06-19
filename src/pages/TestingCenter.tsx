import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, Bug, CheckCircle2, ClipboardList, Download, PlayCircle, RefreshCcw, ShieldCheck, XCircle } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import {
  exportRowsAsCsv,
  getDeploymentGates,
  getPermissionPersonas,
  getQaReadinessSummary,
  getQaRuns,
  getQaTestCases,
  seedDefaultQaTestPlan,
  type DeploymentGate,
  type PermissionPersona,
  type QaReadinessSummary,
  type QaRun,
  type QaTestCase
} from '../lib/testingApi';
import { actionErrorMessage } from '../lib/privilegedAction';

type TabKey = 'readiness' | 'testPlan' | 'permissions' | 'deployment' | 'runs';

type PageState = {
  summary: QaReadinessSummary | null;
  gates: DeploymentGate[];
  cases: QaTestCase[];
  personas: PermissionPersona[];
  runs: QaRun[];
};

const initialState: PageState = {
  summary: null,
  gates: [],
  cases: [],
  personas: [],
  runs: []
};

function toneForStatus(status: string) {
  if (status === 'passed' || status === 'completed') return 'success';
  if (status === 'blocked' || status === 'failed') return 'danger';
  if (status === 'warning' || status === 'in_progress') return 'warning';
  return 'neutral';
}

function severityIcon(status: string) {
  if (status === 'passed') return <CheckCircle2 size={18} />;
  if (status === 'blocked') return <XCircle size={18} />;
  if (status === 'warning') return <AlertTriangle size={18} />;
  return <ClipboardList size={18} />;
}

function localize(language: 'en' | 'ar', en: string | null | undefined, ar: string | null | undefined) {
  return language === 'ar' ? ar || en || '—' : en || ar || '—';
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  } catch {
    return value;
  }
}

export function TestingCenter() {
  const { t, language } = useI18n();
  const [state, setState] = useState<PageState>(initialState);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('readiness');
  const [category, setCategory] = useState('all');
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [summary, gates, cases, personas, runs] = await Promise.all([
        getQaReadinessSummary(),
        getDeploymentGates(),
        getQaTestCases(),
        getPermissionPersonas(),
        getQaRuns()
      ]);
      setState({ summary, gates, cases, personas, runs });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const categories = useMemo(() => ['all', ...Array.from(new Set(state.cases.map(item => item.category)))], [state.cases]);
  const filteredCases = useMemo(() => category === 'all' ? state.cases : state.cases.filter(item => item.category === category), [category, state.cases]);
  const blockedGates = state.gates.filter(gate => gate.status === 'blocked');
  const warningGates = state.gates.filter(gate => gate.status === 'warning');
  const summary = state.summary;

  const handleSeedPlan = async () => {
    setLastAction(null);
    setActionError(null);
    try {
      const count = await seedDefaultQaTestPlan();
      setLastAction(`${count} ${t('qa.seededSuffix')}`);
      await load();
    } catch (actionFailure) {
      setActionError(actionErrorMessage(actionFailure));
    }
  };

  const exportCurrent = () => {
    if (tab === 'deployment') exportRowsAsCsv('deployment-readiness-gates.csv', state.gates as unknown as Array<Record<string, unknown>>);
    if (tab === 'testPlan') exportRowsAsCsv('qa-test-plan.csv', filteredCases as unknown as Array<Record<string, unknown>>);
    if (tab === 'permissions') exportRowsAsCsv('permission-persona-tests.csv', state.personas as unknown as Array<Record<string, unknown>>);
    if (tab === 'runs') exportRowsAsCsv('qa-test-runs.csv', state.runs as unknown as Array<Record<string, unknown>>);
  };

  return (
    <div className="page-section qa-page">
      <div className="section-heading qa-hero modern-gradient-panel">
        <div>
          <p className="eyebrow">{t('qa.eyebrow')}</p>
          <h3>{t('qa.title')}</h3>
          <p className="section-subtitle">{t('qa.subtitle')}</p>
        </div>
        <div className="toolbar">
          <button className="ghost-button" onClick={() => void load()} disabled={loading}>
            <RefreshCcw size={16} />
            {t('qa.refresh')}
          </button>
          <button className="primary-button" onClick={handleSeedPlan}>
            <PlayCircle size={16} />
            {t('qa.seedPlan')}
          </button>
        </div>
      </div>

      {lastAction && <div className="success-banner"><BadgeCheck size={16} /> {lastAction}</div>}
      {actionError && <div className="notice-banner danger">{actionError}</div>}

      <div className="kpi-grid qa-score-grid">
        <div className="stat-card modern-kpi-card">
          <p>{t('qa.readinessScore')}</p>
          <strong>{summary?.readiness_score ?? 0}%</strong>
          <span>{t('qa.productionGate')}</span>
        </div>
        <div className="stat-card modern-kpi-card danger">
          <p>{t('qa.blockedGates')}</p>
          <strong>{summary?.blocked_gates ?? 0}</strong>
          <span>{t('qa.mustClear')}</span>
        </div>
        <div className="stat-card modern-kpi-card warning">
          <p>{t('qa.permissionWarnings')}</p>
          <strong>{summary?.permission_warnings ?? 0}</strong>
          <span>{t('qa.scopeReview')}</span>
        </div>
        <div className="stat-card modern-kpi-card">
          <p>{t('qa.workflowBlockers')}</p>
          <strong>{summary?.workflow_blockers ?? 0}</strong>
          <span>{t('qa.evidenceDelayRules')}</span>
        </div>
      </div>

      <div className="segmented-tabs qa-tabs">
        {(['readiness', 'testPlan', 'permissions', 'deployment', 'runs'] as TabKey[]).map(item => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
            {t(`qa.tab.${item}`)}
          </button>
        ))}
      </div>

      {tab !== 'readiness' && (
        <div className="toolbar qa-export-toolbar">
          {tab === 'testPlan' && (
            <select value={category} onChange={event => setCategory(event.target.value)}>
              {categories.map(item => <option key={item} value={item}>{item === 'all' ? t('qa.allCategories') : item.replaceAll('_', ' ')}</option>)}
            </select>
          )}
          <button className="ghost-button" onClick={exportCurrent}>
            <Download size={16} />
            {t('qa.exportCurrent')}
          </button>
        </div>
      )}

      {tab === 'readiness' && (
        <div className="two-column-grid qa-readiness-grid">
          <div className="content-card">
            <div className="card-header-row">
              <h4>{t('qa.blockingIssues')}</h4>
              <span className="pill danger">{blockedGates.length}</span>
            </div>
            <div className="issue-list">
              {blockedGates.length === 0 && <p className="muted-text">{t('qa.noBlocked')}</p>}
              {blockedGates.map(gate => (
                <div key={gate.gate_key} className="issue-row danger-row">
                  {severityIcon(gate.status)}
                  <div>
                    <strong>{localize(language, gate.title_en, gate.title_ar)}</strong>
                    <p>{localize(language, gate.details_en, gate.details_ar)}</p>
                  </div>
                  <span>{gate.record_count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="content-card">
            <div className="card-header-row">
              <h4>{t('qa.warningIssues')}</h4>
              <span className="pill warning">{warningGates.length}</span>
            </div>
            <div className="issue-list">
              {warningGates.length === 0 && <p className="muted-text">{t('qa.noWarnings')}</p>}
              {warningGates.map(gate => (
                <div key={gate.gate_key} className="issue-row warning-row">
                  {severityIcon(gate.status)}
                  <div>
                    <strong>{localize(language, gate.title_en, gate.title_ar)}</strong>
                    <p>{localize(language, gate.details_en, gate.details_ar)}</p>
                  </div>
                  <span>{gate.record_count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'testPlan' && (
        <div className="qa-card-grid">
          {filteredCases.map(testCase => (
            <article key={testCase.id} className="content-card qa-test-card">
              <div className="card-header-row">
                <span className={`pill ${testCase.priority === 'critical' ? 'danger' : testCase.priority === 'high' ? 'warning' : ''}`}>{testCase.priority}</span>
                <span className="mini-label">{testCase.test_type.replaceAll('_', ' ')}</span>
              </div>
              <h4>{localize(language, testCase.title_en, testCase.title_ar)}</h4>
              <p>{localize(language, testCase.description_en, testCase.description_ar)}</p>
              <div className="expected-box">
                <strong>{t('qa.expected')}</strong>
                <span>{localize(language, testCase.expected_result_en, testCase.expected_result_ar)}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === 'permissions' && (
        <div className="table-card qa-table-card">
          <table>
            <thead>
              <tr>
                <th>{t('qa.persona')}</th>
                <th>{t('qa.expectedVisibility')}</th>
                <th>{t('qa.mustBlock')}</th>
                <th>{t('qa.testSteps')}</th>
              </tr>
            </thead>
            <tbody>
              {state.personas.map(persona => (
                <tr key={persona.persona_key}>
                  <td>
                    <strong>{persona.role_name}</strong>
                    <span>{persona.scope_name}</span>
                  </td>
                  <td>{localize(language, persona.expected_visibility_en, persona.expected_visibility_ar)}</td>
                  <td>{localize(language, persona.must_block_en, persona.must_block_ar)}</td>
                  <td>{localize(language, persona.test_steps_en, persona.test_steps_ar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'deployment' && (
        <div className="table-card qa-table-card">
          <table>
            <thead>
              <tr>
                <th>{t('qa.gate')}</th>
                <th>{t('qa.category')}</th>
                <th>{t('qa.status')}</th>
                <th>{t('qa.records')}</th>
                <th>{t('qa.details')}</th>
              </tr>
            </thead>
            <tbody>
              {state.gates.map(gate => (
                <tr key={gate.gate_key}>
                  <td><strong>{localize(language, gate.title_en, gate.title_ar)}</strong></td>
                  <td>{gate.category}</td>
                  <td><span className={`pill ${toneForStatus(gate.status)}`}>{gate.status}</span></td>
                  <td>{gate.record_count}</td>
                  <td>{localize(language, gate.details_en, gate.details_ar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'runs' && (
        <div className="qa-card-grid compact">
          {state.runs.map(run => (
            <article key={run.id} className="content-card qa-run-card">
              <div className="card-header-row">
                <h4>{run.title}</h4>
                <span className={`pill ${toneForStatus(run.status)}`}>{run.status}</span>
              </div>
              <p>{run.scope}</p>
              <div className="mini-kpi-row">
                <span><ShieldCheck size={15} /> {run.passed_cases}/{run.total_cases} {t('qa.passed')}</span>
                <span><Bug size={15} /> {run.failed_cases} {t('qa.failed')}</span>
              </div>
              <p className="muted-text">{t('qa.started')}: {formatDate(run.started_at)}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
