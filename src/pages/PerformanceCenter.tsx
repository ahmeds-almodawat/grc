import { useEffect, useMemo, useState } from 'react';
import { Activity, Gauge, MonitorSmartphone, RefreshCcw, Save, Smartphone, TabletSmartphone, Zap } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import {
  getBrowserSnapshot,
  getMobileReadinessGates,
  getModulePressureRows,
  getUiPerformanceSummary,
  logUiPerformanceEvent,
  type MobileReadinessGate,
  type ModulePressureRow,
  type UiPerformanceSummary
} from '../lib/performanceApi';

type PageState = {
  summary: UiPerformanceSummary | null;
  gates: MobileReadinessGate[];
  pressure: ModulePressureRow[];
};

const initialState: PageState = {
  summary: null,
  gates: [],
  pressure: []
};

function localize(language: 'en' | 'ar', en: string | null | undefined, ar: string | null | undefined) {
  return language === 'ar' ? ar || en || '—' : en || ar || '—';
}

function statusTone(status: string) {
  if (status === 'passed') return 'success';
  if (status === 'blocked') return 'danger';
  if (status === 'warning') return 'warning';
  return 'neutral';
}

function number(value: number | null | undefined) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value ?? 0);
}

export function PerformanceCenter() {
  const { t, language } = useI18n();
  const [state, setState] = useState<PageState>(initialState);
  const [loading, setLoading] = useState(true);
  const [savedSignal, setSavedSignal] = useState<string | null>(null);
  const browser = useMemo(() => getBrowserSnapshot(), []);

  const load = async () => {
    setLoading(true);
    try {
      const [summary, gates, pressure] = await Promise.all([
        getUiPerformanceSummary(),
        getMobileReadinessGates(),
        getModulePressureRows()
      ]);
      setState({ summary, gates, pressure });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSaveSignal = async () => {
    const ok = await logUiPerformanceEvent({
      page_key: 'performance_center',
      event_type: 'manual_signal',
      load_ms: browser.load_ms,
      viewport_width: browser.viewport_width,
      viewport_height: browser.viewport_height,
      device_category: browser.device_category,
      language,
      details: {
        user_agent: navigator.userAgent,
        saved_from: 'performance_center'
      }
    });
    setSavedSignal(ok ? t('perf.signalSaved') : t('perf.signalDemo'));
    await load();
  };

  const blocked = state.gates.filter(item => item.status === 'blocked').length;
  const warnings = state.gates.filter(item => item.status === 'warning').length;
  const passed = state.gates.filter(item => item.status === 'passed').length;
  const summary = state.summary;

  return (
    <div className="page-section performance-page">
      <div className="section-heading modern-gradient-panel performance-hero">
        <div>
          <p className="eyebrow">{t('perf.eyebrow')}</p>
          <h3>{t('perf.title')}</h3>
          <p className="section-subtitle">{t('perf.subtitle')}</p>
        </div>
        <div className="toolbar">
          <button className="ghost-button" onClick={() => void load()} disabled={loading}>
            <RefreshCcw size={16} />
            {t('perf.refresh')}
          </button>
          <button className="primary-button" onClick={handleSaveSignal}>
            <Save size={16} />
            {t('perf.saveSignal')}
          </button>
        </div>
      </div>

      {savedSignal && <div className="success-banner"><Zap size={16} /> {savedSignal}</div>}

      <div className="kpi-grid performance-kpi-grid">
        <div className="stat-card modern-kpi-card">
          <p>{t('perf.score')}</p>
          <strong>{summary?.performance_score ?? 0}%</strong>
          <span>{t('perf.scoreHint')}</span>
        </div>
        <div className="stat-card modern-kpi-card">
          <p>{t('perf.avgLoad')}</p>
          <strong>{number(summary?.avg_load_ms)} ms</strong>
          <span>{t('perf.avgLoadHint')}</span>
        </div>
        <div className="stat-card modern-kpi-card warning">
          <p>{t('perf.p95Load')}</p>
          <strong>{number(summary?.p95_load_ms)} ms</strong>
          <span>{t('perf.p95Hint')}</span>
        </div>
        <div className="stat-card modern-kpi-card">
          <p>{t('perf.mobileSignals')}</p>
          <strong>{number(summary?.mobile_events)}</strong>
          <span>{t('perf.mobileHint')}</span>
        </div>
      </div>

      <div className="two-column-grid performance-layout-grid">
        <div className="content-card device-preview-card">
          <div className="card-header-row">
            <h4><MonitorSmartphone size={18} /> {t('perf.deviceSnapshot')}</h4>
            <span className="pill">{browser.device_category}</span>
          </div>
          <div className="device-preview-frame">
            <div className="device-topbar" />
            <div className="device-screen-lines">
              <span />
              <span />
              <span />
            </div>
            <div className="device-card-grid">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="mini-metric-grid">
            <div>
              <span>{t('perf.viewport')}</span>
              <strong>{browser.viewport_width} × {browser.viewport_height}</strong>
            </div>
            <div>
              <span>{t('perf.localLoad')}</span>
              <strong>{number(browser.load_ms)} ms</strong>
            </div>
            <div>
              <span>{t('perf.device')}</span>
              <strong>{browser.device_category}</strong>
            </div>
          </div>
        </div>

        <div className="content-card">
          <div className="card-header-row">
            <h4><Gauge size={18} /> {t('perf.mobileReadiness')}</h4>
            <div className="readiness-pills">
              <span className="pill success">{passed} {t('perf.passed')}</span>
              <span className="pill warning">{warnings} {t('perf.warnings')}</span>
              <span className="pill danger">{blocked} {t('perf.blocked')}</span>
            </div>
          </div>
          <div className="issue-list compact-issue-list">
            {state.gates.map(gate => (
              <div key={gate.gate_key} className={`issue-row ${statusTone(gate.status)}-row`}>
                <TabletSmartphone size={18} />
                <div>
                  <strong>{localize(language, gate.title_en, gate.title_ar)}</strong>
                  <p>{localize(language, gate.details_en, gate.details_ar)}</p>
                </div>
                <span className={`pill ${statusTone(gate.status)}`}>{gate.record_count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="content-card module-pressure-card">
        <div className="card-header-row">
          <h4><Activity size={18} /> {t('perf.modulePressure')}</h4>
          <span className="muted-text">{t('perf.modulePressureHint')}</span>
        </div>
        <div className="module-pressure-list">
          {state.pressure.map(row => (
            <div key={row.module_key} className="module-pressure-row">
              <div>
                <strong>{localize(language, row.module_name_en, row.module_name_ar)}</strong>
                <p>{row.open_items} {t('perf.open')} · {row.overdue_items} {t('perf.overdue')} · {row.critical_items} {t('perf.critical')}</p>
              </div>
              <div className="pressure-bar-wrap" aria-label={`${row.pressure_score}%`}>
                <span style={{ width: `${Math.min(row.pressure_score, 100)}%` }} />
              </div>
              <strong>{row.pressure_score}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="responsive-checklist-grid">
        <div className="content-card guidance-card">
          <Smartphone size={22} />
          <h4>{t('perf.mobileFirstRules')}</h4>
          <ul>
            <li>{t('perf.rule.one')}</li>
            <li>{t('perf.rule.two')}</li>
            <li>{t('perf.rule.three')}</li>
            <li>{t('perf.rule.four')}</li>
          </ul>
        </div>
        <div className="content-card guidance-card">
          <Gauge size={22} />
          <h4>{t('perf.performanceRules')}</h4>
          <ul>
            <li>{t('perf.rule.five')}</li>
            <li>{t('perf.rule.six')}</li>
            <li>{t('perf.rule.seven')}</li>
            <li>{t('perf.rule.eight')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
