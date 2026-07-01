import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardCopy, FileCheck2, ShieldCheck, UploadCloud } from 'lucide-react';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';

const inputFolder = 'C:\\Users\\molte\\Downloads\\grc_import_ready_pack_after_review';

const expectedFiles = [
  '01_departments.csv',
  '02_committees.csv',
  '03_role_matrix.csv',
  '04_users_owners.csv',
  '05_evidence_taxonomy.csv',
  '06_control_library.csv',
  '07_kpi_indicators.csv',
  '08_tracer_templates.csv',
  '09_audit_universe.csv',
  '10_compliance_obligations.csv',
  '11_document_register.csv',
  '12_standards_metadata.csv',
  '13_uat_scenarios.csv',
  '14_go_no_go_signoffs.csv',
  '15_payroll_department_map.csv',
];

const reportPaths = [
  'release/import/patch20-dry-run-summary.json',
  'release/import/patch20-validation-errors.csv',
  'release/import/patch20-validation-warnings.csv',
  'release/import/patch20-pending-auth-users.csv',
  'release/import/patch20-generated-email-review.csv',
  'release/import/patch20-payroll-discovered-departments-review.csv',
  'release/import/patch20-import-plan.json',
  'release/import/patch20-apply-summary.json',
  'release/import/patch20-post-import-checks.json',
];

type ImportReport = {
  generated_at?: string;
  mode?: string;
  input_available?: boolean;
  environment_precheck_only?: boolean;
  can_apply?: boolean;
  present_file_count?: number;
  required_file_count?: number;
  total_rows?: number;
  blocking_error_count?: number;
  warning_count?: number;
  created_count?: number;
  updated_count?: number;
  staged_count?: number;
  pending_auth_user_count?: number;
  failed_count?: number;
  status?: string;
  error?: string;
};

type ReportState = {
  status: 'loading' | 'found' | 'missing';
  path: string;
  data: ImportReport | null;
  error: string | null;
};

async function loadReport(path: string): Promise<ReportState> {
  try {
    const response = await fetch(`/${path}`, { cache: 'no-store' });
    if (!response.ok) {
      return { status: 'missing', path, data: null, error: `HTTP ${response.status}` };
    }
    return { status: 'found', path, data: await response.json() as ImportReport, error: null };
  } catch (error) {
    return {
      status: 'missing',
      path,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function reportTone(report: ImportReport | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!report) return 'neutral';
  if ((report.failed_count ?? 0) > 0 || (report.blocking_error_count ?? 0) > 0 || report.status === 'failed') return 'danger';
  if (report.environment_precheck_only || !report.input_available || (report.warning_count ?? 0) > 0) return 'warning';
  return 'good';
}

function reportStatusLabel(report: ImportReport | null, emptyLabel: string) {
  if (!report) return emptyLabel;
  if (report.environment_precheck_only) return 'Precheck only';
  if ((report.blocking_error_count ?? 0) > 0) return 'Blocked';
  if ((report.failed_count ?? 0) > 0) return 'Failed';
  if (report.can_apply) return 'Apply ready';
  if (report.mode === 'apply') return report.status ?? 'Applied';
  return 'Validated';
}

export function RealDataImportRunner() {
  const [dryRun, setDryRun] = useState<ReportState>({
    status: 'loading',
    path: reportPaths[0],
    data: null,
    error: null,
  });
  const [apply, setApply] = useState<ReportState>({
    status: 'loading',
    path: 'release/import/patch20-apply-summary.json',
    data: null,
    error: null,
  });
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [dryRunReport, applyReport] = await Promise.all([
        loadReport('release/import/patch20-dry-run-summary.json'),
        loadReport('release/import/patch20-apply-summary.json'),
      ]);
      if (!mounted) return;
      setDryRun(dryRunReport);
      setApply(applyReport);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const dryRunCommand = useMemo(
    () => `node scripts/import-real-grc-pack.mjs --dry-run --folder "${inputFolder}"`,
    [],
  );
  const applyCommand = useMemo(
    () => `node scripts/import-real-grc-pack.mjs --apply --folder "${inputFolder}" --organization-id <organization_uuid> --skip-auth-user-creation`,
    [],
  );
  const authApplyCommand = useMemo(
    () => `node scripts/import-real-grc-pack.mjs --apply --folder "${inputFolder}" --organization-id <organization_uuid> --create-auth-users true`,
    [],
  );

  const copyCommand = async (command: string) => {
    if (!navigator.clipboard) {
      setCopyMessage('Clipboard is not available in this browser.');
      return;
    }
    await navigator.clipboard.writeText(command);
    setCopyMessage('Command copied.');
  };

  return (
    <div className="page-stack real-data-import-runner">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Patch 20 - real data import orchestrator</p>
          <h1>Staging-first import runner for the reviewed GRC pack</h1>
          <p className="section-subtitle">
            Coordinates departments, users, committees, role matrix, evidence taxonomy, controls, KPIs, tracers,
            audit universe, obligations, documents, standards metadata, UAT, go/no-go signoffs, and payroll department mapping.
          </p>
        </div>
      </section>

      <div className="notice-banner">
        <ShieldCheck size={18} /> Browser-side imports do not run service-role operations. Apply mode is CLI/server-side only, dry-run first, and production requires explicit confirmation.
      </div>

      <div className="kpi-grid">
        <KpiTile label="Pack files" value={expectedFiles.length} hint="Expected CSV inputs" />
        <KpiTile
          label="Dry-run status"
          value={dryRun.status === 'loading' ? 'Loading' : reportStatusLabel(dryRun.data, dryRun.status === 'found' ? 'Loaded' : 'No report')}
          hint={dryRun.data?.generated_at ?? dryRun.error ?? 'Run dry-run to create reports'}
          tone={reportTone(dryRun.data)}
        />
        <KpiTile
          label="Blocking errors"
          value={dryRun.data?.blocking_error_count ?? 0}
          hint="Must be zero before apply"
          tone={(dryRun.data?.blocking_error_count ?? 0) > 0 ? 'danger' : 'good'}
        />
        <KpiTile
          label="Warnings"
          value={dryRun.data?.warning_count ?? 0}
          hint="Review before production import"
          tone={(dryRun.data?.warning_count ?? 0) > 0 ? 'warning' : 'good'}
        />
        <KpiTile
          label="Rows read"
          value={dryRun.data?.total_rows ?? 0}
          hint={dryRun.data?.input_available === false ? 'Input folder not visible here' : 'Latest dry-run total'}
        />
        <KpiTile
          label="Apply result"
          value={apply.status === 'found' ? reportStatusLabel(apply.data, 'Loaded') : 'Not run'}
          hint={apply.data?.generated_at ?? 'Apply reports appear after CLI apply'}
          tone={reportTone(apply.data)}
        />
      </div>

      <ModernCard title="Expected pack files" subtitle="Dependency order is fixed so departments and identities are validated before downstream workflow data.">
        <div className="table-scroll">
          <table className="entity-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>File</th>
                <th>Import area</th>
              </tr>
            </thead>
            <tbody>
              {expectedFiles.map((file, index) => (
                <tr key={file}>
                  <td>{index + 1}</td>
                  <td>{file}</td>
                  <td>{file.replace(/^\d+_/, '').replace('.csv', '').replaceAll('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ModernCard>

      <ModernCard title="Operator commands" subtitle="Run from the repository root after the reviewed folder is available.">
        <div className="page-stack">
          <div>
            <p className="eyebrow">Dry-run</p>
            <pre><code>{dryRunCommand}</code></pre>
            <button className="ghost-button" type="button" onClick={() => void copyCommand(dryRunCommand)}><ClipboardCopy size={16} /> Copy dry-run</button>
          </div>
          <div>
            <p className="eyebrow">Apply without auth-user creation</p>
            <pre><code>{applyCommand}</code></pre>
            <button className="ghost-button" type="button" onClick={() => void copyCommand(applyCommand)}><UploadCloud size={16} /> Copy apply</button>
          </div>
          <div>
            <p className="eyebrow">Apply with explicit auth-user creation</p>
            <pre><code>{authApplyCommand}</code></pre>
            <button className="ghost-button" type="button" onClick={() => void copyCommand(authApplyCommand)}><FileCheck2 size={16} /> Copy auth apply</button>
          </div>
          {copyMessage ? <div className="notice-banner">{copyMessage}</div> : null}
        </div>
      </ModernCard>

      <ModernCard title="Reports to review" subtitle="Dry-run reports are required before apply; apply reports become the rollback and reconciliation trail.">
        <div className="table-scroll">
          <table className="entity-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {reportPaths.map(path => (
                <tr key={path}>
                  <td>{path}</td>
                  <td>{path.includes('dry-run') ? 'Validation summary' : path.includes('errors') ? 'Blocking validation rows' : path.includes('warnings') ? 'Review warnings' : path.includes('pending-auth') ? 'Account creation queue' : path.includes('post-import') ? 'Post-import reconciliation' : 'Import evidence'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ModernCard>

      <ModernCard title="Connected production workflow" subtitle="Patch 20 feeds the existing real-data activation and release decision controls.">
        <div className="table-scroll">
          <table className="entity-table">
            <thead>
              <tr>
                <th>Step</th>
                <th>Control point</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Real Data Activation</td>
                <td>Use dry-run and apply outputs as source-load evidence for validation, approval, reconciliation, and cutover readiness.</td>
                <td><StatusPill tone="warning">Review required</StatusPill></td>
              </tr>
              <tr>
                <td>Production Go/No-Go</td>
                <td>Attach the dry-run, apply, pending auth, and rollback reports before approving production import.</td>
                <td><StatusPill tone={dryRun.data?.can_apply ? 'good' : 'warning'}>{dryRun.data?.can_apply ? 'Dry-run clean' : 'Dry-run needed'}</StatusPill></td>
              </tr>
              <tr>
                <td>Safety boundary</td>
                <td>No hard-delete path, no payroll-sensitive field import, no browser service-role key, and no copyrighted standards text load.</td>
                <td><StatusPill tone="good">Guarded</StatusPill></td>
              </tr>
            </tbody>
          </table>
        </div>
      </ModernCard>

      {dryRun.data?.environment_precheck_only ? (
        <div className="notice-banner warning">
          <AlertTriangle size={18} /> Latest dry-run was an environment precheck because the input folder was not visible to this process.
        </div>
      ) : null}
    </div>
  );
}
