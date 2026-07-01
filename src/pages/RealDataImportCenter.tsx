import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ClipboardCopy,
  DatabaseBackup,
  FileCheck2,
  FileWarning,
  Link as LinkIcon,
  ShieldCheck,
  UploadCloud,
  Users,
} from 'lucide-react';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { isLive, type LiveResult } from '../lib/liveResult';
import {
  buildPatch20ApplyCommand,
  buildPatch20DryRunCommand,
  getPatch20LatestRuns,
  getPatch20PendingAuthUsers,
  getPatch20ReportBundle,
  realDataImportFiles,
  realDataImportInputFolder,
  realDataImportReportPaths,
  type Patch20CsvRow,
  type Patch20ImportRunRow,
  type Patch20PendingAuthUserRow,
  type Patch20ReportFile,
} from '../lib/realDataImportApi';

type CenterTab = 'overview' | 'files' | 'dryRun' | 'errors' | 'warnings' | 'pendingAuth' | 'apply' | 'rollback' | 'readiness';

type ReportBundle = Awaited<ReturnType<typeof getPatch20ReportBundle>>;

const emptyReportBundle: ReportBundle = {
  dryRunSummary: { path: realDataImportReportPaths.dryRunSummary, status: 'loading', data: null },
  applySummary: { path: realDataImportReportPaths.applySummary, status: 'loading', data: null },
  importPlan: { path: realDataImportReportPaths.importPlan, status: 'loading', data: null },
  validationErrors: { path: realDataImportReportPaths.validationErrors, status: 'loading', data: [] },
  validationWarnings: { path: realDataImportReportPaths.validationWarnings, status: 'loading', data: [] },
  pendingAuthUsers: { path: realDataImportReportPaths.pendingAuthUsers, status: 'loading', data: [] },
  generatedEmailReview: { path: realDataImportReportPaths.generatedEmailReview, status: 'loading', data: [] },
  payrollDepartments: { path: realDataImportReportPaths.payrollDepartments, status: 'loading', data: [] },
  createdRecords: { path: realDataImportReportPaths.createdRecords, status: 'loading', data: [] },
  updatedRecords: { path: realDataImportReportPaths.updatedRecords, status: 'loading', data: [] },
  skippedRecords: { path: realDataImportReportPaths.skippedRecords, status: 'loading', data: [] },
  pendingAuthAfterApply: { path: realDataImportReportPaths.pendingAuthAfterApply, status: 'loading', data: [] },
  preImportSnapshot: { path: realDataImportReportPaths.preImportSnapshot, status: 'loading', data: null },
  postImportChecks: { path: realDataImportReportPaths.postImportChecks, status: 'loading', data: null },
};

const emptyRuns: LiveResult<Patch20ImportRunRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No Patch 20 import runs loaded yet.',
};

const emptyPendingAuth: LiveResult<Patch20PendingAuthUserRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No pending auth-user records loaded yet.',
};

const tabs: Array<{ id: CenterTab; label: string; icon: ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <UploadCloud size={16} /> },
  { id: 'files', label: 'File Checklist', icon: <FileCheck2 size={16} /> },
  { id: 'dryRun', label: 'Dry Run', icon: <ShieldCheck size={16} /> },
  { id: 'errors', label: 'Validation Errors', icon: <FileWarning size={16} /> },
  { id: 'warnings', label: 'Warnings', icon: <AlertTriangle size={16} /> },
  { id: 'pendingAuth', label: 'Pending Auth Users', icon: <Users size={16} /> },
  { id: 'apply', label: 'Apply Results', icon: <UploadCloud size={16} /> },
  { id: 'rollback', label: 'Rollback / Snapshot', icon: <DatabaseBackup size={16} /> },
  { id: 'readiness', label: 'Production Readiness', icon: <LinkIcon size={16} /> },
];

function reportStatusText<T>(report: Patch20ReportFile<T>) {
  if (report.status === 'found') return 'Loaded';
  if (report.status === 'missing') return 'Not generated';
  if (report.status === 'error') return 'Read error';
  return 'Loading';
}

function reportTone<T>(report: Patch20ReportFile<T>): 'neutral' | 'good' | 'warning' | 'danger' {
  if (report.status === 'found') return 'good';
  if (report.status === 'missing') return 'warning';
  if (report.status === 'error') return 'danger';
  return 'neutral';
}

function summaryTone(blocking = 0, warnings = 0, inputAvailable = true): 'neutral' | 'good' | 'warning' | 'danger' {
  if (blocking > 0) return 'danger';
  if (!inputAvailable || warnings > 0) return 'warning';
  return 'good';
}

function countRows(report: Patch20ReportFile<Patch20CsvRow[]>) {
  return report.data?.filter(row => Object.values(row).some(Boolean)).length ?? 0;
}

function commandBlock(command: string, label: string, onCopy: (command: string) => void) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <pre><code>{command}</code></pre>
      <button className="ghost-button" type="button" onClick={() => onCopy(command)}><ClipboardCopy size={16} /> Copy</button>
    </div>
  );
}

function GenericCsvTable({ rows, emptyMessage }: { rows: Patch20CsvRow[]; emptyMessage: string }) {
  const visibleRows = rows.filter(row => Object.values(row).some(Boolean)).slice(0, 25);
  const headers = Array.from(new Set(visibleRows.flatMap(row => Object.keys(row)))).slice(0, 8);
  if (!visibleRows.length) {
    return <div className="professional-empty-state"><strong>{emptyMessage}</strong><p>No rows are available in the latest generated report.</p></div>;
  }
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead>
          <tr>{headers.map(header => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {visibleRows.map((row, index) => (
            <tr key={`${row.file_name ?? 'row'}-${row.row_number ?? index}`}>
              {headers.map(header => <td key={header}>{row[header] || '-'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RealDataImportCenter() {
  const [activeTab, setActiveTab] = useState<CenterTab>('overview');
  const [reports, setReports] = useState<ReportBundle>(emptyReportBundle);
  const [runs, setRuns] = useState<LiveResult<Patch20ImportRunRow[]>>(emptyRuns);
  const [pendingAuthRows, setPendingAuthRows] = useState<LiveResult<Patch20PendingAuthUserRow[]>>(emptyPendingAuth);
  const [loading, setLoading] = useState(true);
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const [reportBundle, runRows, pendingRows] = await Promise.all([
        getPatch20ReportBundle(),
        getPatch20LatestRuns(),
        getPatch20PendingAuthUsers(),
      ]);
      if (!mounted) return;
      setReports(reportBundle);
      setRuns(runRows);
      setPendingAuthRows(pendingRows);
      setLoading(false);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const dryRun = reports.dryRunSummary.data;
  const applySummary = reports.applySummary.data;
  const importPlanRows = reports.importPlan.data ?? [];
  const runRows = isLive(runs) ? runs.data : [];
  const databasePendingAuthRows = isLive(pendingAuthRows) ? pendingAuthRows.data : [];
  const dryRunCommand = useMemo(() => buildPatch20DryRunCommand(), []);
  const applyCommand = useMemo(() => buildPatch20ApplyCommand(false), []);
  const authApplyCommand = useMemo(() => buildPatch20ApplyCommand(true), []);
  const blockingErrors = dryRun?.blocking_error_count ?? countRows(reports.validationErrors);
  const warningCount = dryRun?.warning_count ?? countRows(reports.validationWarnings);
  const pendingAuthCount = applySummary?.pending_auth_user_count
    ?? (countRows(reports.pendingAuthAfterApply) || countRows(reports.pendingAuthUsers) || databasePendingAuthRows.length);

  const copyCommand = async (command: string) => {
    if (!navigator.clipboard) {
      setCopyMessage('Clipboard is not available in this browser.');
      return;
    }
    await navigator.clipboard.writeText(command);
    setCopyMessage('Command copied.');
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'files':
        return (
          <ModernCard title="Required file checklist" subtitle="The orchestrator reads all files as one dependency-aware pack.">
            <div className="table-scroll">
              <table className="entity-table">
                <thead>
                  <tr><th>Order</th><th>Required file</th><th>Area</th><th>Target</th><th>Latest dry-run</th></tr>
                </thead>
                <tbody>
                  {realDataImportFiles.map(file => {
                    const reportFile = dryRun?.files?.find(item => item.file === file.file);
                    return (
                      <tr key={file.file}>
                        <td>{file.order}</td>
                        <td>{file.file}</td>
                        <td>{file.area}</td>
                        <td>{file.target}</td>
                        <td><StatusPill tone={reportFile?.present ? 'good' : 'warning'}>{reportFile?.present ? `${reportFile.row_count} rows` : 'Missing / not checked'}</StatusPill></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ModernCard>
        );
      case 'dryRun':
        return (
          <div className="page-stack">
            <ModernCard title="Dry-run command" subtitle="Dry-run validates the pack and writes report files without changing database data.">
              {commandBlock(dryRunCommand, 'PowerShell', copyCommand)}
            </ModernCard>
            <ModernCard title="Latest dry-run summary" subtitle={reports.dryRunSummary.path}>
              <div className="kpi-grid">
                <KpiTile label="Report" value={reportStatusText(reports.dryRunSummary)} tone={reportTone(reports.dryRunSummary)} />
                <KpiTile label="Input folder" value={dryRun?.input_available ? 'Visible' : 'Not visible'} tone={dryRun?.input_available ? 'good' : 'warning'} />
                <KpiTile label="Files present" value={`${dryRun?.present_file_count ?? 0}/${dryRun?.required_file_count ?? realDataImportFiles.length}`} />
                <KpiTile label="Rows read" value={dryRun?.total_rows ?? 0} />
                <KpiTile label="Blocking errors" value={blockingErrors} tone={blockingErrors ? 'danger' : 'good'} />
                <KpiTile label="Warnings" value={warningCount} tone={warningCount ? 'warning' : 'good'} />
              </div>
              {dryRun?.note ? <div className="notice-banner">{dryRun.note}</div> : null}
            </ModernCard>
            <ModernCard title="Import dependency order" subtitle="This is the sequence apply mode follows after a clean dry-run.">
              <GenericCsvTable rows={importPlanRows.map(row => ({ order: String(row.order), file: row.file, dataset_key: row.dataset_key, label: row.label, target_table: row.target_table, dependency_note: row.dependency_note }))} emptyMessage="No import plan report is available." />
            </ModernCard>
          </div>
        );
      case 'errors':
        return (
          <ModernCard title="Validation errors" subtitle="Apply mode refuses to run when blocking errors exist.">
            <GenericCsvTable rows={reports.validationErrors.data ?? []} emptyMessage="No blocking validation errors reported." />
          </ModernCard>
        );
      case 'warnings':
        return (
          <div className="page-stack">
            <ModernCard title="Validation warnings" subtitle="Warnings require review before production import.">
              <GenericCsvTable rows={reports.validationWarnings.data ?? []} emptyMessage="No validation warnings reported." />
            </ModernCard>
            <ModernCard title="Generated email review" subtitle="Generated-looking emails must be reviewed before account creation or invitations.">
              <GenericCsvTable rows={reports.generatedEmailReview.data ?? []} emptyMessage="No generated-looking emails reported." />
            </ModernCard>
            <ModernCard title="Payroll-discovered departments" subtitle="Payroll-sensitive fields are excluded; discovered departments require human review.">
              <GenericCsvTable rows={reports.payrollDepartments.data ?? []} emptyMessage="No payroll-discovered departments reported." />
            </ModernCard>
          </div>
        );
      case 'pendingAuth':
        return (
          <div className="page-stack">
            <ModernCard title="Pending auth users from reports" subtitle="Default apply behavior writes pending account creation rows instead of creating auth users.">
              <GenericCsvTable rows={reports.pendingAuthAfterApply.data?.length ? reports.pendingAuthAfterApply.data : reports.pendingAuthUsers.data ?? []} emptyMessage="No pending auth users reported." />
            </ModernCard>
            <ModernCard title="Pending auth users from RLS-scoped table" subtitle="Admins can review records from patch20_pending_auth_users when migration 081 is applied.">
              {databasePendingAuthRows.length ? (
                <div className="table-scroll">
                  <table className="entity-table">
                    <thead><tr><th>Email</th><th>Name</th><th>Employee</th><th>Department</th><th>Role</th><th>Status</th></tr></thead>
                    <tbody>
                      {databasePendingAuthRows.map(row => (
                        <tr key={row.id}>
                          <td>{row.email}</td>
                          <td>{row.full_name_en ?? '-'}</td>
                          <td>{row.employee_no ?? '-'}</td>
                          <td>{row.department_code ?? '-'}</td>
                          <td>{row.requested_role ?? '-'}</td>
                          <td><StatusPill tone={row.status === 'pending_review' ? 'warning' : 'neutral'}>{row.status}</StatusPill></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="professional-empty-state"><strong>{pendingAuthRows.message}</strong><p>The browser does not create auth users directly.</p></div>}
            </ModernCard>
          </div>
        );
      case 'apply':
        return (
          <div className="page-stack">
            <ModernCard title="Apply commands" subtitle="Apply is CLI/server-side only. Keep account creation disabled unless emails are reviewed and the server environment is ready.">
              <div className="page-stack">
                {commandBlock(applyCommand, 'Apply without auth-user creation', copyCommand)}
                {commandBlock(authApplyCommand, 'Apply with explicit auth-user creation', copyCommand)}
              </div>
            </ModernCard>
            <ModernCard title="Latest apply summary" subtitle={reports.applySummary.path}>
              <div className="kpi-grid">
                <KpiTile label="Report" value={reportStatusText(reports.applySummary)} tone={reportTone(reports.applySummary)} />
                <KpiTile label="Created" value={applySummary?.created_count ?? countRows(reports.createdRecords)} tone={(applySummary?.created_count ?? countRows(reports.createdRecords)) > 0 ? 'warning' : 'neutral'} />
                <KpiTile label="Updated" value={applySummary?.updated_count ?? countRows(reports.updatedRecords)} />
                <KpiTile label="Skipped / staged" value={(applySummary?.skipped_count ?? 0) + (applySummary?.staged_count ?? countRows(reports.skippedRecords))} />
                <KpiTile label="Pending auth" value={pendingAuthCount} tone={pendingAuthCount ? 'warning' : 'good'} />
                <KpiTile label="Failed" value={applySummary?.failed_count ?? 0} tone={(applySummary?.failed_count ?? 0) ? 'danger' : 'good'} />
              </div>
            </ModernCard>
            <ModernCard title="Created / updated / skipped records" subtitle="Review these before production signoff.">
              <div className="kpi-grid">
                <KpiTile label="Created records file" value={countRows(reports.createdRecords)} hint={reports.createdRecords.path} />
                <KpiTile label="Updated records file" value={countRows(reports.updatedRecords)} hint={reports.updatedRecords.path} />
                <KpiTile label="Skipped records file" value={countRows(reports.skippedRecords)} hint={reports.skippedRecords.path} />
              </div>
            </ModernCard>
          </div>
        );
      case 'rollback':
        return (
          <div className="page-stack">
            <ModernCard title="Snapshot and rollback evidence" subtitle="Rollback is manual and report-driven; no hard-delete rollback is generated.">
              <div className="kpi-grid">
                <KpiTile label="Pre-import snapshot" value={reportStatusText(reports.preImportSnapshot)} hint={reports.preImportSnapshot.path} tone={reportTone(reports.preImportSnapshot)} />
                <KpiTile label="Post-import checks" value={reportStatusText(reports.postImportChecks)} hint={reports.postImportChecks.path} tone={reportTone(reports.postImportChecks)} />
                <KpiTile label="Run ledger rows" value={runRows.length} hint={isLive(runs) ? 'Loaded through RLS' : runs.message} />
              </div>
              <div className="notice-banner">
                Use the pre-import snapshot with created and updated record reports to reverse specific rows through approved maintenance tooling. The importer never hard-deletes.
              </div>
            </ModernCard>
            <ModernCard title="Latest import run ledger" subtitle="RLS-scoped patch20_real_import_runs records, when migration 081 is applied.">
              {runRows.length ? (
                <div className="table-scroll">
                  <table className="entity-table">
                    <thead><tr><th>Created</th><th>Mode</th><th>Status</th><th>Input</th><th>Blocking</th><th>Warnings</th><th>Completed</th></tr></thead>
                    <tbody>
                      {runRows.map(row => (
                        <tr key={row.id}>
                          <td>{row.created_at}</td>
                          <td>{row.mode}</td>
                          <td><StatusPill tone={row.status === 'applied' || row.status === 'validated' ? 'good' : row.status === 'failed' || row.status === 'blocked' ? 'danger' : 'warning'}>{row.status}</StatusPill></td>
                          <td>{row.input_available ? 'Visible' : 'Unavailable'}</td>
                          <td>{row.dry_run_blocking_error_count}</td>
                          <td>{row.warning_count}</td>
                          <td>{row.completed_at ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="professional-empty-state"><strong>{runs.message}</strong><p>CLI apply writes the durable import ledger.</p></div>}
            </ModernCard>
          </div>
        );
      case 'readiness':
        return (
          <div className="page-stack">
            <ModernCard title="Production readiness handoff" subtitle="Patch 20 feeds the existing activation, UAT, and go/no-go workflows.">
              <div className="table-scroll">
                <table className="entity-table">
                  <thead><tr><th>Destination</th><th>Use Patch 20 evidence for</th><th>Readiness</th></tr></thead>
                  <tbody>
                    <tr><td>Real Data Activation</td><td>Source-load evidence, validation, approval, reconciliation, cutover readiness.</td><td><StatusPill tone="warning">Review dry-run/apply reports</StatusPill></td></tr>
                    <tr><td>Real UAT Execution</td><td>Imported UAT scenarios, findings, retests, SQL proof, screenshots, and signoffs.</td><td><StatusPill tone="warning">Run after clean import</StatusPill></td></tr>
                    <tr><td>Production Go/No-Go</td><td>Attach dry-run, apply, pending auth, snapshot, rollback, and post-import checks.</td><td><StatusPill tone={dryRun?.can_apply ? 'good' : 'warning'}>{dryRun?.can_apply ? 'Dry-run clean' : 'Dry-run needed'}</StatusPill></td></tr>
                  </tbody>
                </table>
              </div>
            </ModernCard>
            <ModernCard title="Reports to review before production" subtitle="Do not approve production import until these are reviewed.">
              <GenericCsvTable rows={Object.values(realDataImportReportPaths).map(path => ({ report: path, status: path.includes('apply') ? 'After apply' : 'Before apply / dry-run' }))} emptyMessage="No report list available." />
            </ModernCard>
          </div>
        );
      case 'overview':
      default:
        return (
          <div className="page-stack">
            <ModernCard title="Import pack overview" subtitle="One staged import workflow for the complete reviewed GRC pack.">
              <div className="kpi-grid">
                <KpiTile label="Required files" value={realDataImportFiles.length} hint="One pack, not one-by-one imports" />
                <KpiTile label="Dry-run status" value={dryRun?.environment_precheck_only ? 'Precheck only' : reports.dryRunSummary.status === 'found' ? 'Report loaded' : 'No report'} tone={summaryTone(blockingErrors, warningCount, dryRun?.input_available ?? false)} />
                <KpiTile label="Blocking errors" value={blockingErrors} tone={blockingErrors ? 'danger' : 'good'} />
                <KpiTile label="Warnings" value={warningCount} tone={warningCount ? 'warning' : 'good'} />
                <KpiTile label="Pending auth users" value={pendingAuthCount} tone={pendingAuthCount ? 'warning' : 'good'} />
                <KpiTile label="Apply failures" value={applySummary?.failed_count ?? 0} tone={(applySummary?.failed_count ?? 0) ? 'danger' : 'good'} />
              </div>
            </ModernCard>
            <div className="notice-banner">
              <ShieldCheck size={18} /> The browser page is a control center for status, reports, commands, warnings, and readiness. Database apply and auth-user creation stay in the CLI/server script.
            </div>
            {dryRun?.environment_precheck_only ? (
              <div className="notice-banner warning">
                <AlertTriangle size={18} /> Latest dry-run was an environment precheck because {realDataImportInputFolder} was not visible to the process.
              </div>
            ) : null}
          </div>
        );
    }
  };

  return (
    <div className="page-stack real-data-import-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Patch 20 - real data import center</p>
          <h1>Real Data Import Center</h1>
          <p className="section-subtitle">
            Staging-first control center for the complete real GRC import pack, dry-run reports, CLI commands,
            pending account creation, rollback evidence, and production readiness.
          </p>
        </div>
      </section>

      <div className="toolbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`ghost-button ${activeTab === tab.id ? 'active' : ''}`}
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? <div className="notice-banner">Loading Patch 20 report status...</div> : null}
      {copyMessage ? <div className="notice-banner">{copyMessage}</div> : null}

      {renderActiveTab()}
    </div>
  );
}
