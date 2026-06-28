import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, Bug, CheckCircle2, ClipboardList, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { ControlledPilotBanner } from '../components/ControlledPilotBanner';
import { ModuleHeader } from '../components/ModuleHeader';
import {
  createUatIssue,
  listRecentUatIssues,
  type UatIssueRow,
  type UatIssueSeverity,
  type UatIssueStatus,
} from '../lib/uatIssueApi';
import { isScenarioLabEnabled } from '../lib/scenarioLab';

const moduleOptions = [
  'Home / Navigation',
  'OVR',
  'Risks',
  'Controls',
  'Evidence',
  'Corrective Actions / Projects',
  'Reports',
  'Access Control / Admin',
  'Scenario Lab / UAT Tools',
  'Authentication / Roles',
  'Other',
];

const initialForm = {
  title: '',
  module: 'OVR',
  roleAccountUsed: '',
  stepsToReproduce: '',
  expectedResult: '',
  actualResult: '',
  screenshotAvailable: false,
  screenshotNote: '',
  ownerName: '',
  severity: 'medium' as UatIssueSeverity,
  status: 'open' as UatIssueStatus,
};

function isRequiredFilled(value: string) {
  return value.trim().length >= 3;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function UatIssueCapture() {
  const auth = useAuth();
  const [form, setForm] = useState(initialForm);
  const [issues, setIssues] = useState<UatIssueRow[]>([]);
  const [loading, setLoading] = useState(isScenarioLabEnabled);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const defaultRoleAccount = useMemo(() => {
    const role = auth.primaryRole || 'unknown role';
    const email = auth.profile?.email || 'unknown account';
    return `${role} / ${email}`;
  }, [auth.primaryRole, auth.profile?.email]);

  useEffect(() => {
    setForm(current => (
      current.roleAccountUsed
        ? current
        : { ...current, roleAccountUsed: defaultRoleAccount }
    ));
  }, [defaultRoleAccount]);

  async function refreshIssues() {
    if (!isScenarioLabEnabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setIssues(await listRecentUatIssues());
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : 'Unable to load recent UAT issues.';
      setError(`${detail} If this is a first run after pulling v9.10, apply pending Supabase migrations locally before testing issue capture.`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshIssues();
  }, []);

  const canSubmit = [
    form.title,
    form.module,
    form.roleAccountUsed,
    form.stepsToReproduce,
    form.expectedResult,
    form.actualResult,
  ].every(isRequiredFilled);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const saved = await createUatIssue(form);
      setMessage(`Issue captured: ${saved.title}`);
      setForm({
        ...initialForm,
        roleAccountUsed: defaultRoleAccount,
      });
      await refreshIssues();
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : 'Unable to save UAT issue.';
      setError(`${detail} Do not paste real patient identifiers or confidential OVR narratives into this form.`);
    } finally {
      setSaving(false);
    }
  }

  if (!isScenarioLabEnabled) {
    return (
      <section className="page-section">
        <div className="panel error-panel">
          UAT issue capture is available only in local development or explicitly controlled pilot mode.
        </div>
      </section>
    );
  }

  return (
    <section className="page-section uat-issue-page">
      <ControlledPilotBanner />
      <ModuleHeader
        eyebrow="v9.10 controlled pilot"
        title="UAT issue capture"
        subtitle="Record manual testing bugs and usability gaps using synthetic/non-confidential details only."
        action={(
          <button className="ghost-button" type="button" onClick={() => void refreshIssues()}>
            <RefreshCw size={16} />
            Refresh issues
          </button>
        )}
      />

      <div className="notice-banner scenario-warning">
        <AlertTriangle size={20} />
        <div>
          <strong>Do not enter real patient identifiers or confidential OVR details.</strong>
          <span>Use role/account names, synthetic record references, and screenshot notes only.</span>
        </div>
      </div>

      <div className="two-column uat-issue-layout">
        <form className="panel uat-issue-form" onSubmit={event => void onSubmit(event)}>
          <div className="panel-header">
            <div>
              <h4>Report a UAT issue</h4>
              <p>Fields are structured so IT, Quality, and Admin can triage consistently.</p>
            </div>
            <Bug size={24} />
          </div>

          <div className="form-grid two">
            <label>
              Title
              <input
                value={form.title}
                onChange={event => setForm({ ...form, title: event.target.value })}
                placeholder="Short issue title"
                maxLength={160}
                required
              />
            </label>
            <label>
              Module
              <select value={form.module} onChange={event => setForm({ ...form, module: event.target.value })}>
                {moduleOptions.map(option => <option value={option} key={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Role/account used
              <input
                value={form.roleAccountUsed}
                onChange={event => setForm({ ...form, roleAccountUsed: event.target.value })}
                placeholder="Role / synthetic email"
                required
              />
            </label>
            <label>
              Severity
              <select
                value={form.severity}
                onChange={event => setForm({ ...form, severity: event.target.value as UatIssueSeverity })}
              >
                <option value="blocker">Blocker</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={event => setForm({ ...form, status: event.target.value as UatIssueStatus })}
              >
                <option value="open">Open</option>
                <option value="reviewing">Reviewing</option>
                <option value="fixed">Fixed</option>
                <option value="deferred">Deferred</option>
              </select>
            </label>
            <label>
              Owner
              <input
                value={form.ownerName}
                onChange={event => setForm({ ...form, ownerName: event.target.value })}
                placeholder="Owner or triage lead"
              />
            </label>
            <label>
              Screenshot available
              <select
                value={form.screenshotAvailable ? 'yes' : 'no'}
                onChange={event => setForm({ ...form, screenshotAvailable: event.target.value === 'yes' })}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
            <label>
              Screenshot note
              <input
                value={form.screenshotNote}
                onChange={event => setForm({ ...form, screenshotNote: event.target.value })}
                placeholder="Filename or short note; no upload required"
              />
            </label>
          </div>

          <div className="form-grid">
            <label>
              Steps to reproduce
              <textarea
                value={form.stepsToReproduce}
                onChange={event => setForm({ ...form, stepsToReproduce: event.target.value })}
                placeholder="1. Sign in as... 2. Open... 3. Click..."
                rows={4}
                required
              />
            </label>
            <label>
              Expected result
              <textarea
                value={form.expectedResult}
                onChange={event => setForm({ ...form, expectedResult: event.target.value })}
                placeholder="What should have happened?"
                rows={3}
                required
              />
            </label>
            <label>
              Actual result
              <textarea
                value={form.actualResult}
                onChange={event => setForm({ ...form, actualResult: event.target.value })}
                placeholder="What happened instead?"
                rows={3}
                required
              />
            </label>
          </div>

          {error ? <div className="form-error">{error}</div> : null}
          {message ? <div className="success-banner"><CheckCircle2 size={16} /> {message}</div> : null}

          <button className="primary-button" type="submit" disabled={!canSubmit || saving}>
            {saving ? 'Saving...' : 'Capture UAT issue'}
          </button>
        </form>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h4>Recent controlled-pilot issues</h4>
              <p>Newest authenticated issue records visible through RLS.</p>
            </div>
            <ClipboardList size={24} />
          </div>
          {loading ? <p className="muted">Loading recent issues...</p> : null}
          {!loading && !issues.length && !error ? (
            <div className="professional-empty-state">
              <strong>No records yet</strong>
              <p>Start by capturing UAT issues from manual testing. Keep entries synthetic and non-confidential.</p>
            </div>
          ) : null}
          <div className="uat-issue-list">
            {issues.map(issue => (
              <article key={issue.id} className="uat-issue-list__item">
                <div>
                  <strong>{issue.issue_code || issue.id.slice(0, 8)} - {issue.title}</strong>
                  <span>{issue.module || 'Module not specified'} | {issue.role_account_used || 'Role not specified'}</span>
                  <span>Owner: {issue.owner_name || 'Unassigned'}</span>
                  <small>{formatDate(issue.created_at)}</small>
                </div>
                <div className="uat-issue-list__badges">
                  <span className={`status-pill ${issue.severity}`}>{issue.severity}</span>
                  <span className={`status-pill ${issue.status}`}>{issue.status}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
