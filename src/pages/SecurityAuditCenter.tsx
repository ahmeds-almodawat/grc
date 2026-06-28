import { useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Download,
  FileClock,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  ShieldEllipsis,
  ShieldX,
  TimerReset
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatDate } from '../lib/format';
import {
  getDataRetentionReadiness,
  getSecurityAccessFindings,
  getSecurityGovernanceSummary,
  getSensitiveActivityTimeline,
  logSecurityReviewEvent,
  type DataRetentionReadiness,
  type SecurityAccessFinding,
  type SecurityGovernanceSummary,
  type SensitiveActivityTimeline
} from '../lib/securityApi';
import { SecurityBackupHardeningPanel } from '../components/v200/SecurityBackupHardeningPanel';

function localize(language: 'en' | 'ar', en: string | null | undefined, ar: string | null | undefined) {
  return language === 'ar' ? ar || en || '—' : en || ar || '—';
}

function number(value: number | null | undefined) {
  return new Intl.NumberFormat().format(value ?? 0);
}

function severityTone(value: string | null | undefined) {
  const normalized = (value ?? '').toLowerCase();
  if (normalized === 'critical') return 'danger';
  if (normalized === 'high') return 'warning';
  if (normalized === 'medium') return 'info';
  return 'success';
}

function exportRows(filename: string, rows: Record<string, unknown>[]) {
  const columns = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach(key => set.add(key));
    return set;
  }, new Set<string>()));
  const csv = [
    columns.join(','),
    ...rows.map(row => columns.map(column => JSON.stringify(row[column] ?? '')).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function SecurityScore({ score }: { score: number }) {
  return (
    <div className="security-score-ring" style={{ ['--score' as string]: `${score}%` }}>
      <div>
        <strong>{score}%</strong>
        <span>Secure</span>
      </div>
    </div>
  );
}

function SummaryCards({ summary }: { summary: SecurityGovernanceSummary | null }) {
  const { t } = useI18n();
  return (
    <div className="kpi-grid security-kpi-grid">
      <div className="stat-card modern-kpi-card success">
        <p>{t('security.activeRetentionRules')}</p>
        <strong>{number(summary?.retention_rules_active)}</strong>
        <span>{t('security.activeRetentionRulesHint')}</span>
      </div>
      <div className="stat-card modern-kpi-card warning">
        <p>{t('security.sensitiveRoles')}</p>
        <strong>{number(summary?.active_sensitive_roles)}</strong>
        <span>{t('security.sensitiveRolesHint')}</span>
      </div>
      <div className="stat-card modern-kpi-card danger">
        <p>{t('security.unresolvedWarnings')}</p>
        <strong>{number(summary?.unresolved_access_warnings)}</strong>
        <span>{t('security.unresolvedWarningsHint')}</span>
      </div>
      <div className="stat-card modern-kpi-card">
        <p>{t('security.pendingRetention')}</p>
        <strong>{number(summary?.pending_retention_actions)}</strong>
        <span>{t('security.pendingRetentionHint')}</span>
      </div>
    </div>
  );
}

function FindingList({ findings }: { findings: SecurityAccessFinding[] }) {
  const { language } = useI18n();
  return (
    <div className="issue-list security-finding-list">
      {findings.map(finding => (
        <div key={finding.finding_key} className={`issue-row ${severityTone(finding.severity)}-row`}>
          {finding.severity === 'critical' ? <ShieldX size={18} /> : <ShieldEllipsis size={18} />}
          <div>
            <strong>{localize(language, finding.title_en, finding.title_ar)}</strong>
            <p>{localize(language, finding.details_en, finding.details_ar)}</p>
          </div>
          <span>{number(finding.record_count)}</span>
        </div>
      ))}
    </div>
  );
}

function RetentionTable({ rows }: { rows: DataRetentionReadiness[] }) {
  const { language, t } = useI18n();
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>{t('security.rule')}</th>
            <th>{t('security.table')}</th>
            <th>{t('security.retention')}</th>
            <th>{t('security.pastRetention')}</th>
            <th>{t('security.nextReview')}</th>
            <th>{t('security.approval')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.rule_key}>
              <td><strong>{localize(language, row.title_en, row.title_ar)}</strong></td>
              <td>{row.target_table}</td>
              <td>{row.retention_months} {t('security.months')}</td>
              <td><span className={`pill ${row.records_past_retention > 0 ? 'warning' : 'success'}`}>{number(row.records_past_retention)}</span></td>
              <td>{formatDate(row.next_review_date)}</td>
              <td>{row.requires_approval ? t('security.required') : t('security.notRequired')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SensitiveTimeline({ rows }: { rows: SensitiveActivityTimeline[] }) {
  const { language } = useI18n();
  return (
    <div className="activity-timeline security-timeline">
      {rows.map(row => (
        <div key={row.id} className="timeline-item">
          <div className={`timeline-dot ${severityTone(row.severity)}`} />
          <div>
            <strong>{localize(language, row.summary_en, row.summary_ar)}</strong>
            <p>{row.actor_name || 'System'} · {row.activity_type} · {formatDate(row.created_at)}</p>
          </div>
          <span>{row.severity}</span>
        </div>
      ))}
    </div>
  );
}

export function SecurityAuditCenter() {
  const { language, t } = useI18n();
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const { data: summary, loading: summaryLoading, refresh: refreshSummary } = useAsyncData(getSecurityGovernanceSummary, []);
  const { data: findings, loading: findingsLoading, refresh: refreshFindings } = useAsyncData(getSecurityAccessFindings, []);
  const { data: retention, loading: retentionLoading, refresh: refreshRetention } = useAsyncData(getDataRetentionReadiness, []);
  const { data: timeline, loading: timelineLoading, refresh: refreshTimeline } = useAsyncData(getSensitiveActivityTimeline, []);

  const loading = summaryLoading || findingsLoading || retentionLoading || timelineLoading;

  const posture = useMemo(() => {
    const score = summary?.security_score ?? 0;
    if (score >= 85) return t('security.postureStrong');
    if (score >= 70) return t('security.postureControlled');
    return t('security.postureNeedsWork');
  }, [summary?.security_score, t]);

  const handleRefresh = async () => {
    await Promise.all([refreshSummary(), refreshFindings(), refreshRetention(), refreshTimeline()]);
  };

  const handleLogReview = async () => {
    const ok = await logSecurityReviewEvent({
      activity_type: 'manual_security_review',
      severity: 'medium',
      summary_en: 'Manual security and retention review recorded from Security & Audit Center.',
      summary_ar: 'تم تسجيل مراجعة أمنية ومراجعة احتفاظ يدوية من مركز الأمن والتدقيق.',
      metadata: { source: 'security_audit_center', language }
    });
    setSavedNote(ok ? t('security.reviewLogged') : t('security.demoReviewLogged'));
    await refreshTimeline();
  };

  const handleExport = () => {
    exportRows('security-retention-readiness.csv', (retention ?? []).map(row => ({
      rule: localize(language, row.title_en, row.title_ar),
      target_table: row.target_table,
      retention_months: row.retention_months,
      records_past_retention: row.records_past_retention,
      requires_approval: row.requires_approval,
      next_review_date: row.next_review_date
    })));
  };

  return (
    <section className="modern-page security-page">
      <SecurityBackupHardeningPanel context="security" />
      <div className="modern-hero security-hero">
        <div>
          <span className="modern-hero__eyebrow"><LockKeyhole size={14} /> {t('security.eyebrow')}</span>
          <h1>{t('security.title')}</h1>
          <p>{t('security.subtitle')}</p>
          <div className="hero-status-row">
            <span className="pill success"><ShieldCheck size={14} /> {posture}</span>
            <span className="pill">{t('security.lastReview')}: {formatDate(summary?.last_review_at)}</span>
          </div>
        </div>
        <div className="modern-hero__actions">
          <button className="ghost-button hero-button" onClick={handleRefresh} disabled={loading}>
            <RefreshCw size={16} />
            {t('security.refresh')}
          </button>
          <button className="primary-button hero-button" onClick={handleLogReview}>
            <CheckCircle2 size={16} />
            {t('security.logReview')}
          </button>
        </div>
      </div>

      {savedNote && <div className="success-banner"><ShieldCheck size={16} /> {savedNote}</div>}

      <div className="security-posture-grid">
        <div className="content-card security-score-card">
          <SecurityScore score={summary?.security_score ?? 0} />
          <div>
            <h3>{t('security.securityPosture')}</h3>
            <p>{t('security.securityPostureHint')}</p>
            <div className="security-mini-metrics">
              <span><KeyRound size={14} /> {number(summary?.stale_global_roles)} {t('security.staleGlobal')}</span>
              <span><FileClock size={14} /> {number(summary?.pending_security_reviews)} {t('security.pendingReviews')}</span>
              <span><ShieldX size={14} /> {number(summary?.high_risk_audit_events_30d)} {t('security.highRiskEvents')}</span>
            </div>
          </div>
        </div>
        <SummaryCards summary={summary} />
      </div>

      <div className="two-column-grid security-main-grid">
        <div className="content-card">
          <div className="card-header-row">
            <h4><ShieldEllipsis size={18} /> {t('security.accessFindings')}</h4>
            <span className="muted-text">{t('security.accessFindingsHint')}</span>
          </div>
          <FindingList findings={findings ?? []} />
        </div>

        <div className="content-card">
          <div className="card-header-row">
            <h4><TimerReset size={18} /> {t('security.sensitiveActivity')}</h4>
            <span className="muted-text">{t('security.sensitiveActivityHint')}</span>
          </div>
          <SensitiveTimeline rows={timeline ?? []} />
        </div>
      </div>

      <div className="content-card">
        <div className="card-header-row">
          <h4><Archive size={18} /> {t('security.retentionReadiness')}</h4>
          <button className="ghost-button" onClick={handleExport}>
            <Download size={16} />
            {t('security.exportRetention')}
          </button>
        </div>
        <p className="section-subtitle">{t('security.retentionHint')}</p>
        <RetentionTable rows={retention ?? []} />
      </div>

      <div className="security-rule-grid">
        <div className="content-card guidance-card">
          <LockKeyhole size={22} />
          <h4>{t('security.ruleLeastPrivilege')}</h4>
          <p>{t('security.ruleLeastPrivilegeText')}</p>
        </div>
        <div className="content-card guidance-card">
          <ShieldCheck size={22} />
          <h4>{t('security.ruleQuarterlyReview')}</h4>
          <p>{t('security.ruleQuarterlyReviewText')}</p>
        </div>
        <div className="content-card guidance-card">
          <Archive size={22} />
          <h4>{t('security.ruleRetentionApproval')}</h4>
          <p>{t('security.ruleRetentionApprovalText')}</p>
        </div>
      </div>
    </section>
  );
}
