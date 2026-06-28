import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { ControlledPilotBanner } from '../components/ControlledPilotBanner';
import type { PageKey } from '../components/Layout';
import { ModuleHeader } from '../components/ModuleHeader';
import { isScenarioLabEnabled } from '../lib/scenarioLab';
import { listRecentUatIssues, type UatIssueRow } from '../lib/uatIssueApi';
import { UatClosureDashboard } from '../components/v200/UatClosureDashboard';

type ScenarioStatus = 'not_tested' | 'passed' | 'failed' | 'blocked';

interface DayOneScenario {
  id: string;
  title: string;
  persona: string;
  module: string;
  objective: string;
  expected: string;
  targetPage?: PageKey;
}

const scopeStatement = 'Controlled internal pilot using synthetic and non-confidential operational data only. No real patient identifiers. No confidential OVR details. No production-wide rollout.';

const dayOneScenarios: DayOneScenario[] = [
  {
    id: 'UAT-D1-01',
    title: 'Super Admin login',
    persona: 'Super Admin',
    module: 'Authentication / Admin',
    objective: 'Confirm first-run admin can sign in and see admin/UAT tools.',
    expected: 'Admin Hub, Access Control, Departments, Scenario Lab, and UAT workbench are visible.',
    targetPage: 'adminHub',
  },
  {
    id: 'UAT-D1-02',
    title: 'Governance Admin login',
    persona: 'Governance Admin',
    module: 'Governance',
    objective: 'Confirm governance pilot user can access GRC workspaces without super-admin-only shortcuts.',
    expected: 'Governance, risks, controls, evidence, Scenario Lab, and UAT issue tools follow role scope.',
    targetPage: 'grcHub',
  },
  {
    id: 'UAT-D1-03',
    title: 'Quality user login',
    persona: 'Quality / Patient Safety',
    module: 'Quality / OVR',
    objective: 'Confirm Quality can validate OVRs and manage final verdict work.',
    expected: 'Quality Safety Hub and OVR workflow are available inside controlled pilot boundaries.',
    targetPage: 'qualityHub',
  },
  {
    id: 'UAT-D1-04',
    title: 'Auditor login',
    persona: 'Auditor',
    module: 'Audit',
    objective: 'Confirm auditor can review evidence and audit data without privileged writes.',
    expected: 'Audit and read-only assurance surfaces are available; admin/write shortcuts are denied.',
    targetPage: 'audit',
  },
  {
    id: 'UAT-D1-05',
    title: 'Department Manager login',
    persona: 'Department Manager',
    module: 'Department work',
    objective: 'Confirm manager can see relevant department/team work and OVRs.',
    expected: 'Work Hub and department-scoped items are visible without unrelated admin controls.',
    targetPage: 'workHub',
  },
  {
    id: 'UAT-D1-06',
    title: 'Employee login',
    persona: 'Employee',
    module: 'My Work / OVR',
    objective: 'Confirm employee can access own work and submit synthetic OVR records.',
    expected: 'Employee sees personal work/OVR tools and restricted pages show safe unauthorized states.',
    targetPage: 'myWork',
  },
  {
    id: 'UAT-D1-07',
    title: 'Same-department OVR',
    persona: 'Reporter + Manager',
    module: 'OVR',
    objective: 'Create a synthetic same-department OVR and complete manager review.',
    expected: 'Reporter submission and manager review are captured without cross-department notification.',
    targetPage: 'scenarioTestConsole',
  },
  {
    id: 'UAT-D1-08',
    title: 'Cross-department OVR',
    persona: 'Reporter + Quality + Referred Department',
    module: 'OVR',
    objective: 'Create a synthetic cross-department OVR through the guided Scenario Lab.',
    expected: 'Cross-department referral waits for Quality validation before referred-party visibility.',
    targetPage: 'scenarioTestConsole',
  },
  {
    id: 'UAT-D1-09',
    title: 'Quality validation',
    persona: 'Quality',
    module: 'OVR',
    objective: 'Validate a synthetic OVR before referral or final handling.',
    expected: 'Validation state is visible and prevents premature cross-department notification.',
    targetPage: 'ovr',
  },
  {
    id: 'UAT-D1-10',
    title: 'Referred department reply',
    persona: 'Referred Department',
    module: 'OVR',
    objective: 'Confirm referred party sees only assigned/referred synthetic OVRs and can respond.',
    expected: 'Response is attached to the referred OVR only; unrelated OVRs remain hidden.',
    targetPage: 'ovr',
  },
  {
    id: 'UAT-D1-11',
    title: 'Quality close/escalate',
    persona: 'Quality',
    module: 'OVR',
    objective: 'Confirm Quality can close or escalate only after required verdict/evidence/action checks.',
    expected: 'Closure without required evidence/action is blocked or clearly flagged.',
    targetPage: 'ovr',
  },
  {
    id: 'UAT-D1-12',
    title: 'CAPA from OVR',
    persona: 'Quality / Governance',
    module: 'Corrective Actions / Projects',
    objective: 'Confirm an OVR can lead to a corrective action/project record.',
    expected: 'CAPA/action record is traceable back to the synthetic OVR source.',
    targetPage: 'projects',
  },
  {
    id: 'UAT-D1-13',
    title: 'Risk creation',
    persona: 'Governance Admin',
    module: 'Risks',
    objective: 'Create a synthetic operational risk with owner and scoring.',
    expected: 'Risk appears in the risk register with controlled-pilot data only.',
    targetPage: 'risks',
  },
  {
    id: 'UAT-D1-14',
    title: 'Control linked to risk',
    persona: 'Governance Admin',
    module: 'Controls',
    objective: 'Create or verify a control linked to the synthetic risk.',
    expected: 'Control relationship is visible from risk/control workspaces.',
    targetPage: 'risks',
  },
  {
    id: 'UAT-D1-15',
    title: 'Control test',
    persona: 'Auditor / Governance',
    module: 'Control testing',
    objective: 'Record or verify a synthetic control test outcome.',
    expected: 'Control test result is visible to authorized reviewers and does not expose unrelated data.',
    targetPage: 'audit',
  },
  {
    id: 'UAT-D1-16',
    title: 'Auditor read-only confirmation',
    persona: 'Auditor',
    module: 'Audit / Evidence',
    objective: 'Confirm auditor cannot perform privileged write/admin actions.',
    expected: 'Read-only review succeeds; write/admin actions are denied safely.',
    targetPage: 'audit',
  },
  {
    id: 'UAT-D1-17',
    title: 'Employee restricted access confirmation',
    persona: 'Employee',
    module: 'Access control',
    objective: 'Confirm employee cannot access admin, import/export, or unrelated records.',
    expected: 'Restricted pages are hidden or show safe unauthorized states.',
    targetPage: 'home',
  },
  {
    id: 'UAT-D1-18',
    title: 'External/unauthorized denial confirmation',
    persona: 'External synthetic denial user',
    module: 'Access control',
    objective: 'Confirm external synthetic organization user cannot see primary organization records.',
    expected: 'External user sees only allowed pilot scope and no Al Modawat internal records.',
    targetPage: 'home',
  },
];

const statusLabels: Record<ScenarioStatus, string> = {
  not_tested: 'Not tested',
  passed: 'Passed',
  failed: 'Failed',
  blocked: 'Blocked',
};

const terminalIssueStatuses = new Set(['fixed', 'resolved', 'closed']);

function getStoredStatuses(): Record<string, ScenarioStatus> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem('v140-uat-scenario-statuses');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ScenarioStatus>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => ['not_tested', 'passed', 'failed', 'blocked'].includes(value)),
    );
  } catch {
    return {};
  }
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

function severityLabel(severity: UatIssueRow['severity']) {
  if (severity === 'critical') return 'Blocker';
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function ControlledUatWorkbench({ setPage }: { setPage: (page: PageKey) => void }) {
  const auth = useAuth();
  const [scenarioStatuses, setScenarioStatuses] = useState<Record<string, ScenarioStatus>>({});
  const [issues, setIssues] = useState<UatIssueRow[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  useEffect(() => {
    setScenarioStatuses(getStoredStatuses());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('v140-uat-scenario-statuses', JSON.stringify(scenarioStatuses));
  }, [scenarioStatuses]);

  async function refreshIssues() {
    if (!isScenarioLabEnabled) return;
    setLoadingIssues(true);
    setIssueError(null);
    try {
      setIssues(await listRecentUatIssues());
    } catch (caught) {
      setIssueError(caught instanceof Error ? caught.message : 'Unable to load UAT issues.');
    } finally {
      setLoadingIssues(false);
    }
  }

  useEffect(() => {
    void refreshIssues();
  }, []);

  const counts = useMemo(() => {
    const statusFor = (scenario: DayOneScenario) => scenarioStatuses[scenario.id] ?? 'not_tested';
    const passed = dayOneScenarios.filter(scenario => statusFor(scenario) === 'passed').length;
    const failed = dayOneScenarios.filter(scenario => ['failed', 'blocked'].includes(statusFor(scenario))).length;
    const blockerHighIssues = issues.filter(issue => {
      const open = !terminalIssueStatuses.has(String(issue.status));
      return open && ['blocker', 'critical', 'high'].includes(String(issue.severity));
    }).length;
    const ready = passed === dayOneScenarios.length && failed === 0 && blockerHighIssues === 0;
    return {
      total: dayOneScenarios.length,
      passed,
      failed,
      notTested: dayOneScenarios.length - passed - failed,
      blockerHighIssues,
      ready,
    };
  }, [issues, scenarioStatuses]);

  const persona = auth.primaryRole ? `${auth.primaryRole} / ${auth.profile?.email ?? 'current user'}` : auth.profile?.email ?? 'current user';

  if (!isScenarioLabEnabled) {
    return (
      <section className="page-section">
      <UatClosureDashboard />
        <div className="panel error-panel">
          Controlled UAT execution tools are available only in local development or explicitly controlled pilot mode.
        </div>
      </section>
    );
  }

  return (
    <section className="page-section controlled-uat-page">
      <ControlledPilotBanner />
      <ModuleHeader
        eyebrow="v14.0 controlled UAT execution"
        title="Controlled UAT Workbench"
        subtitle="Run Day 1 UAT, capture structured issues, and keep the pilot go/no-go signal honest."
        action={(
          <button className="ghost-button" type="button" onClick={() => void refreshIssues()}>
            <RefreshCw size={16} />
            Refresh issue log
          </button>
        )}
      />

      <div className="notice-banner controlled-uat-scope">
        <ShieldCheck size={22} />
        <div>
          <strong>Current pilot scope</strong>
          <span>{scopeStatement}</span>
        </div>
      </div>

      <div className="controlled-uat-kpi-grid">
        <article className="panel controlled-uat-kpi">
          <span>Total scenarios</span>
          <strong>{counts.total}</strong>
        </article>
        <article className="panel controlled-uat-kpi good">
          <span>Passed scenarios</span>
          <strong>{counts.passed}</strong>
        </article>
        <article className={`panel controlled-uat-kpi ${counts.failed ? 'danger' : ''}`}>
          <span>Failed / blocked scenarios</span>
          <strong>{counts.failed}</strong>
        </article>
        <article className={`panel controlled-uat-kpi ${counts.blockerHighIssues ? 'danger' : 'good'}`}>
          <span>Open blocker/high issues</span>
          <strong>{counts.blockerHighIssues}</strong>
        </article>
        <article className={`panel controlled-uat-recommendation ${counts.ready ? 'ready' : 'not-ready'}`}>
          {counts.ready ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
          <div>
            <span>Go/no-go recommendation</span>
            <strong>{counts.ready ? 'Ready for controlled pilot go/no-go review' : 'Not ready - complete UAT evidence first'}</strong>
            <small>{counts.notTested} scenarios still not tested.</small>
          </div>
        </article>
      </div>

      <div className="two-column controlled-uat-layout">
        <div className="panel controlled-uat-scenarios">
          <div className="panel-header">
            <div>
              <h4>Guided Day 1 UAT scenario checklist</h4>
              <p>Mark results only after real manual testing. The default is intentionally not tested.</p>
            </div>
            <ClipboardCheck size={24} />
          </div>
          <div className="controlled-uat-scenario-list">
            {dayOneScenarios.map((scenario) => {
              const status = scenarioStatuses[scenario.id] ?? 'not_tested';
              return (
                <article className={`controlled-uat-scenario ${status}`} key={scenario.id}>
                  <div className="controlled-uat-scenario__main">
                    <strong>{scenario.id} - {scenario.title}</strong>
                    <span>{scenario.persona} | {scenario.module}</span>
                    <p>{scenario.objective}</p>
                    <small>Expected: {scenario.expected}</small>
                  </div>
                  <div className="controlled-uat-scenario__actions">
                    <select
                      value={status}
                      aria-label={`Status for ${scenario.id}`}
                      onChange={event => setScenarioStatuses(current => ({
                        ...current,
                        [scenario.id]: event.target.value as ScenarioStatus,
                      }))}
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    {scenario.targetPage ? (
                      <button className="ghost-button" type="button" onClick={() => setPage(scenario.targetPage!)}>
                        Open <ExternalLink size={14} />
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="controlled-uat-side-stack">
          <div className="panel controlled-uat-actions">
            <div className="panel-header">
              <div>
                <h4>Execution shortcuts</h4>
                <p>Use existing safe tools. Terminal commands must still be run deliberately.</p>
              </div>
              <ClipboardList size={24} />
            </div>
            <div className="uat-action-grid controlled-uat-action-grid">
              <button className="uat-action-card" type="button" onClick={() => setPage('scenarioTestConsole')}>
                <ClipboardList size={20} />
                <strong>Open Scenario Lab</strong>
                <p>Create same/cross-department OVR, risk, control, evidence, and project synthetic records.</p>
              </button>
              <button className="uat-action-card" type="button" onClick={() => setPage('uatIssueCapture')}>
                <Bug size={20} />
                <strong>Report UAT issue</strong>
                <p>Capture issue id, date, persona, module, severity, status, owner, and reproduction details.</p>
              </button>
            </div>
            <div className="professional-empty-state">
              <strong>PowerShell helper commands</strong>
              <p>Run these outside the browser when needed:</p>
              <code>npm run pilot:bulk-uat-users</code>
              <code>npm run v99:uat-user-matrix</code>
              <code>npm run pilot:v140-uat-execution</code>
            </div>
          </div>

          <div className="panel controlled-uat-issue-log">
            <div className="panel-header">
              <div>
                <h4>UAT issue log</h4>
                <p>Recent authenticated controlled-pilot issues. Current tester: {persona}</p>
              </div>
              <Bug size={24} />
            </div>
            {issueError ? (
              <div className="form-error">
                {issueError} Apply local migrations before testing issue capture if this is a fresh database.
              </div>
            ) : null}
            {loadingIssues ? <p className="muted">Loading issue log...</p> : null}
            {!loadingIssues && !issues.length && !issueError ? (
              <div className="professional-empty-state">
                <strong>No UAT issues logged yet</strong>
                <p>That is not a pass signal. It only means no issues have been captured in this browser session/database.</p>
              </div>
            ) : null}
            {issues.length ? (
              <div className="controlled-uat-issue-table">
                <div className="controlled-uat-issue-table__head">
                  <span>Issue ID</span>
                  <span>Date</span>
                  <span>User/persona</span>
                  <span>Module</span>
                  <span>Severity</span>
                  <span>Status</span>
                  <span>Owner</span>
                </div>
                {issues.map(issue => (
                  <div className="controlled-uat-issue-table__row" key={issue.id}>
                    <span>{issue.issue_code || issue.id.slice(0, 8)}</span>
                    <span>{formatDate(issue.created_at)}</span>
                    <span>{issue.role_account_used || '-'}</span>
                    <span>{issue.module || '-'}</span>
                    <span className={`status-pill ${issue.severity}`}>{severityLabel(issue.severity)}</span>
                    <span className={`status-pill ${issue.status}`}>{String(issue.status)}</span>
                    <span>{issue.owner_name || 'Unassigned'}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {counts.blockerHighIssues ? (
        <div className="notice-banner danger">
          <AlertTriangle size={18} />
          <span>Do not recommend go until blocker/high UAT issues are fixed, deferred by named decision, or accepted through the approved governance path.</span>
        </div>
      ) : null}
    </section>
  );
}
