import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Building2,
  Bug,
  ClipboardList,
  FileCheck2,
  FolderKanban,
  GitBranch,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Users,
  WandSparkles,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { ControlledPilotBanner } from '../components/ControlledPilotBanner';
import type { PageKey } from '../components/Layout';
import { ModuleHeader } from '../components/ModuleHeader';
import {
  cleanupScenarioLabDataset,
  createScenarioLabScenario,
  getScenarioLabStatus,
  isScenarioLabEnabled,
  V99_SCENARIO_TAG,
  type ScenarioLabResult,
  type ScenarioLabStatus,
  type V99ScenarioCode,
} from '../lib/scenarioLab';

interface ScenarioCardDefinition {
  letter: string;
  title: string;
  description: string;
  scenario?: V99ScenarioCode;
  targetPage?: PageKey;
  tone?: 'danger' | 'warning';
  icon: ReactNode;
  cleanup?: boolean;
}

interface UatActionDefinition {
  title: string;
  description: string;
  command?: string;
  targetPage?: PageKey;
  toggleChecklist?: boolean;
  icon: ReactNode;
}

const scenarios: ScenarioCardDefinition[] = [
  {
    letter: 'A',
    title: 'Create OVR same-department test record',
    description: 'Creates a submitted synthetic OVR and completes manager review in the same department.',
    scenario: 'ovr_same_department',
    targetPage: 'ovr',
    icon: <Building2 size={20} />,
  },
  {
    letter: 'B',
    title: 'Create OVR cross-department test record',
    description: 'Exercises validation, referral, response, final verdict, evidence, acceptance, and closure.',
    scenario: 'ovr_cross_department',
    targetPage: 'ovr',
    icon: <GitBranch size={20} />,
  },
  {
    letter: 'C',
    title: 'Fill OVR: high severity',
    description: 'Creates a synthetic sentinel drill and exercises controlled escalation.',
    scenario: 'ovr_high_severity',
    targetPage: 'ovr',
    tone: 'danger',
    icon: <AlertTriangle size={20} />,
  },
  {
    letter: 'D',
    title: 'Fill OVR: returned for clarification',
    description: 'Creates a returned synthetic report with a clear test-only clarification reason.',
    scenario: 'ovr_returned_clarification',
    targetPage: 'ovr',
    icon: <RotateCcw size={20} />,
  },
  {
    letter: 'E',
    title: 'Fill OVR: disputed and reopened',
    description: 'Exercises dispute, Quality reopening, re-review, evidence, and final closure.',
    scenario: 'ovr_disputed_reopened',
    targetPage: 'ovr',
    tone: 'warning',
    icon: <RefreshCw size={20} />,
  },
  {
    letter: 'F',
    title: 'Fill Risk',
    description: 'Creates one tagged synthetic operational risk.',
    scenario: 'risk',
    targetPage: 'risks',
    icon: <ShieldAlert size={20} />,
  },
  {
    letter: 'G',
    title: 'Fill Control',
    description: 'Creates one tagged synthetic risk and linked preventive control.',
    scenario: 'control',
    targetPage: 'risks',
    icon: <Sparkles size={20} />,
  },
  {
    letter: 'H',
    title: 'Fill Evidence',
    description: 'Creates test-only evidence metadata linked to a synthetic project.',
    scenario: 'evidence',
    targetPage: 'evidence',
    icon: <FileCheck2 size={20} />,
  },
  {
    letter: 'I',
    title: 'Fill Project / Corrective Action',
    description: 'Creates one tagged synthetic controlled action plan.',
    scenario: 'project',
    targetPage: 'projects',
    icon: <FolderKanban size={20} />,
  },
  {
    letter: 'J',
    title: 'Create full pilot dataset',
    description: 'Creates all scenario types in one controlled transaction.',
    scenario: 'full',
    icon: <WandSparkles size={20} />,
  },
  {
    letter: 'K',
    title: 'Cleanup only V99 synthetic records',
    description: `Deletes only exact records registered with ${V99_SCENARIO_TAG}.`,
    tone: 'danger',
    cleanup: true,
    icon: <Trash2 size={20} />,
  },
];

const uatActions: UatActionDefinition[] = [
  {
    title: 'Create/verify 30 UAT users',
    description: 'Run the idempotent local user pack before manual UAT starts.',
    command: 'npm run pilot:bulk-uat-users',
    icon: <Users size={20} />,
  },
  {
    title: 'Generate UAT user matrix',
    description: 'Refresh the tester login matrix and scenario coverage map.',
    command: 'npm run v99:uat-user-matrix',
    icon: <ClipboardList size={20} />,
  },
  {
    title: 'Open manual UAT checklist',
    description: 'Show the checklist testers should follow during the controlled pilot.',
    toggleChecklist: true,
    icon: <ClipboardList size={20} />,
  },
  {
    title: 'Report UAT issue',
    description: 'Capture a structured bug/usability record without patient identifiers.',
    targetPage: 'uatIssueCapture',
    icon: <Bug size={20} />,
  },
];

const uatChecklist = [
  'Sign in with the assigned v99 synthetic UAT account.',
  'Confirm the controlled pilot banner is visible.',
  'Open only modules allowed for that role.',
  'Create or inspect synthetic OVR, risk, control, evidence, or project records.',
  'Verify denied pages show a safe unauthorized state.',
  'Capture any issue through UAT issue capture with no real patient/confidential data.',
];

export function ScenarioTestConsole({ setPage }: { setPage: (page: PageKey) => void }) {
  const auth = useAuth();
  const [status, setStatus] = useState<ScenarioLabStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScenarioLabResult | null>(null);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const authorized = useMemo(
    () => auth.roles.some((role) => ['super_admin', 'governance_admin'].includes(role.role)),
    [auth.roles],
  );

  async function refreshStatus() {
    if (!authorized || !isScenarioLabEnabled) return;
    try {
      setStatus(await getScenarioLabStatus());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load Scenario Lab status.');
    }
  }

  useEffect(() => {
    void refreshStatus();
  }, [authorized]);

  async function runScenario(card: ScenarioCardDefinition) {
    if (!card.scenario && !card.cleanup) return;
    setBusy(card.letter);
    setMessage(null);
    setLastResult(null);
    try {
      if (card.cleanup) {
        const cleanup = await cleanupScenarioLabDataset();
        setMessage(`Cleanup complete. Removed ${cleanup.deleted.registry_rows ?? 0} exact tagged registry rows.`);
      } else if (card.scenario) {
        const result = await createScenarioLabScenario(card.scenario);
        setLastResult(result);
        setMessage(
          result.record_count
            ? `Created ${result.record_count} synthetic scenario groups.`
            : `Created ${result.record_type ?? 'synthetic record'}${result.status ? ` (${result.status})` : ''}.`,
        );
      }
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Scenario action failed.');
    } finally {
      setBusy(null);
    }
  }

  async function copyCommand(command: string) {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(command);
      setMessage(`Copied command: ${command}`);
    } catch {
      setMessage(`Copy this command in PowerShell: ${command}`);
    }
  }

  if (!isScenarioLabEnabled || !authorized) {
    return (
      <section className="page-section">
        <div className="panel error-panel">
          Scenario Lab is available only to super administrators or governance administrators
          in local development or explicitly controlled pilot mode.
        </div>
      </section>
    );
  }

  return (
    <section className="page-section">
      <ControlledPilotBanner />
      <ModuleHeader
        eyebrow="v9.9 controlled pilot"
        title="Scenario Lab"
        subtitle="Create cleanup-safe synthetic records for fast UI and manual workflow testing."
        action={(
          <button className="ghost-button" type="button" onClick={() => void refreshStatus()}>
            <RefreshCw size={16} />
            Refresh
          </button>
        )}
      />

      <div className="notice-banner danger scenario-warning">
        <AlertTriangle size={20} />
        <div>
          <strong>Synthetic data only.</strong>
          <span>
            No patient identifiers. No confidential OVR narratives. Not production approval.
            Not for real incident reporting.
          </span>
        </div>
      </div>

      <div className="panel uat-command-panel">
        <div className="panel-header">
          <div>
            <h4>UAT setup shortcuts</h4>
            <p>Browser buttons guide the workflow; terminal-only steps are shown as copyable commands.</p>
          </div>
          <ClipboardList size={24} />
        </div>
        <div className="uat-action-grid">
          {uatActions.map(action => (
            <article className="uat-action-card" key={action.title}>
              <span className="workspace-card__icon">{action.icon}</span>
              <strong>{action.title}</strong>
              <p>{action.description}</p>
              {action.command ? <code>{action.command}</code> : null}
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  if (action.command) void copyCommand(action.command);
                  if (action.targetPage) setPage(action.targetPage);
                  if (action.toggleChecklist) setShowChecklist(current => !current);
                }}
              >
                {action.command
                  ? copiedCommand === action.command ? 'Command copied' : 'Copy command'
                  : action.targetPage ? 'Open page' : showChecklist ? 'Hide checklist' : 'Open checklist'}
              </button>
            </article>
          ))}
        </div>
        {showChecklist ? (
          <div className="professional-empty-state uat-checklist-preview">
            <strong>Manual UAT checklist</strong>
            <ul>
              {uatChecklist.map(item => <li key={item}>{item}</li>)}
            </ul>
            <p>Full generated copy: <code>release/v910/uat-readiness-checklist.md</code></p>
          </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h4>Tagged dataset status</h4>
            <p>Exact cleanup marker: <code>{V99_SCENARIO_TAG}</code></p>
          </div>
          <strong>{status?.total_records ?? 0} registered records</strong>
        </div>
        {status && Object.keys(status.by_table).length ? (
          <div className="scenario-status-list">
            {Object.entries(status.by_table).map(([table, count]) => (
              <span key={table}>{table}: <strong>{count}</strong></span>
            ))}
          </div>
        ) : <p className="muted">No v9.9 synthetic records are currently registered.</p>}
      </div>

      {message ? (
        <div className="notice-banner">
          <Sparkles size={18} />
          <span>{message}</span>
          {lastResult?.id ? <code>{lastResult.id}</code> : null}
        </div>
      ) : null}

      <div className="scenario-card-grid">
        {scenarios.map((card) => (
          <article
            className={`scenario-card ${card.tone ? `scenario-card--${card.tone}` : ''}`}
            key={card.letter}
          >
            <div className="scenario-card__heading">
              <span className="scenario-card__letter">{card.letter}</span>
              {card.icon}
            </div>
            <h4>{card.title}</h4>
            <p>{card.description}</p>
            <div className="scenario-card__actions">
              <button
                className={card.cleanup ? 'ghost-button' : 'primary-button'}
                type="button"
                disabled={busy !== null}
                onClick={() => void runScenario(card)}
              >
                {busy === card.letter
                  ? 'Working…'
                  : card.cleanup
                    ? 'Cleanup only V99 records'
                    : card.scenario?.startsWith('ovr_')
                      ? 'Create OVR test record'
                      : 'Create synthetic record'}
              </button>
              {card.targetPage ? (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setPage(card.targetPage!)}
                >
                  Open module
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
