import { useMemo, useState } from 'react';
import {
  Archive,
  ClipboardList,
  DatabaseBackup,
  Download,
  FileJson,
  FileSpreadsheet,
  RefreshCcw,
  Save,
  ShieldCheck
} from 'lucide-react';
import { ModuleHeader } from '../components/ModuleHeader';
import {
  buildBackupPackage,
  getCustomReportDefinitions,
  getExportCenterSummary,
  getExportDataset,
  getOrganizations,
  logDataExport,
  saveBulkImportBatch,
  saveCustomReportDefinition
} from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import type { CustomReportDefinition, ExportDatasetKey } from '../types/domain';
import { isEmptyLiveObject } from '../lib/liveData';

type TemplateKey = 'divisions' | 'departments' | 'units' | 'employees' | 'projects';
type CenterTab = 'import' | 'export' | 'reports' | 'backup';
type ParsedRow = Record<string, string>;

interface ValidationResult {
  rows: ParsedRow[];
  headers: string[];
  errorsByRow: Record<number, string[]>;
  warningsByRow: Record<number, string[]>;
  validRows: number;
  invalidRows: number;
}

interface DatasetOption {
  key: ExportDatasetKey;
  en: string;
  ar: string;
  sensitivity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

const roleOptions = [
  'super_admin',
  'executive',
  'governance_admin',
  'division_head',
  'department_manager',
  'project_owner',
  'milestone_owner',
  'task_owner',
  'auditor',
  'compliance_officer',
  'viewer',
  'employee'
];

const scopeOptions = ['global', 'division', 'department', 'unit', 'assigned_only'];

const templates: Record<TemplateKey, { title: string; purpose: string; headers: string[]; required: string[]; sample: string[] }> = {
  divisions: {
    title: 'Divisions template',
    purpose: 'Create the company high-level structure before departments and units.',
    headers: ['division_code', 'division_name_en', 'division_name_ar', 'is_active'],
    required: ['division_code', 'division_name_en'],
    sample: ['MED', 'Medical Division', 'القطاع الطبي', 'true']
  },
  departments: {
    title: 'Departments template',
    purpose: 'Prepare an authorized department master list with normalized duplicate-code checks.',
    headers: ['division_code', 'department_code', 'department_name_en', 'department_name_ar', 'manager_email', 'is_active'],
    required: ['department_code', 'department_name_en'],
    sample: ['MED', 'NUR', 'Nursing', 'التمريض', 'nursing.manager@almodawat.sa', 'true']
  },
  units: {
    title: 'Units / stations template',
    purpose: 'Prepare units, stations, wards and clinics under each department.',
    headers: ['department_code', 'unit_code', 'unit_name_en', 'unit_name_ar', 'manager_email', 'is_active'],
    required: ['department_code', 'unit_code', 'unit_name_en'],
    sample: ['NUR', 'ICU', 'Intensive Care Unit', 'العناية المركزة', 'icu.manager@almodawat.sa', 'true']
  },
  employees: {
    title: 'Employee staging template',
    purpose: 'Prepare authorized employee records for staged review before creating auth users and role assignments.',
    headers: ['employee_no', 'full_name_en', 'full_name_ar', 'email', 'job_title', 'division_code', 'department_code', 'unit_code', 'primary_role', 'role_scope', 'is_active'],
    required: ['employee_no', 'full_name_en', 'email', 'department_code', 'primary_role', 'role_scope'],
    sample: ['10001', 'Finance Manager', 'مدير المالية', 'finance.manager@almodawat.sa', 'Finance Manager', 'ADM', 'FIN', '', 'department_manager', 'department', 'true']
  },
  projects: {
    title: 'Major projects / action plans template',
    purpose: 'Bulk prepare major controlled initiatives without turning the platform into daily to-do tracking.',
    headers: ['title', 'category', 'source_type', 'department_code', 'owner_email', 'sponsor_email', 'start_date', 'target_end_date', 'priority', 'risk_level', 'evidence_required'],
    required: ['title', 'category', 'source_type', 'priority', 'risk_level'],
    sample: ['Authority Matrix Implementation', 'governance', 'ceo_decision', 'GOV', 'governance.manager@almodawat.sa', 'ceo@almodawat.sa', '2026-07-01', '2026-08-15', 'high', 'high', 'true']
  }
};

const exportDatasets: DatasetOption[] = [
  { key: 'projects', en: 'Projects & action plans', ar: 'المشاريع وخطط العمل', sensitivity: 'medium', description: 'Major controlled initiatives, owners, dates, status and risk level.' },
  { key: 'milestones', en: 'Milestones', ar: 'المعالم', sensitivity: 'medium', description: 'Timeline milestones and evidence requirements.' },
  { key: 'tasks', en: 'Tasks', ar: 'المهام', sensitivity: 'medium', description: 'Assigned task-level work and delay reasons.' },
  { key: 'risks', en: 'Risk register', ar: 'سجل المخاطر', sensitivity: 'high', description: 'Inherent/residual risk scoring and owners.' },
  { key: 'compliance', en: 'Compliance calendar', ar: 'تقويم الالتزام', sensitivity: 'high', description: 'Regulatory obligations, expiry dates and owners.' },
  { key: 'audit_findings', en: 'Audit findings', ar: 'ملاحظات المراجعة', sensitivity: 'high', description: 'Audit findings, corrective actions and closure status.' },
  { key: 'ovr_reports', en: 'OVR reports', ar: 'بلاغات OVR', sensitivity: 'critical', description: 'Confidential incident reports and Quality workflow status.' },
  { key: 'ovr_risk_indicators', en: 'OVR risk indicators', ar: 'مؤشرات مخاطر OVR', sensitivity: 'high', description: 'Department OVR risk scores, recurrence and corrective-action pressure.' },
  { key: 'approvals', en: 'Approvals', ar: 'الموافقات', sensitivity: 'medium', description: 'Pending and completed approval workflow rows.' },
  { key: 'evidence', en: 'Evidence queue', ar: 'قائمة الأدلة', sensitivity: 'high', description: 'Evidence review metadata; file binaries are not included in client exports.' },
  { key: 'escalations', en: 'Escalations', ar: 'التصعيدات', sensitivity: 'high', description: 'Open and resolved escalation events.' },
  { key: 'departments', en: 'Departments', ar: 'الإدارات', sensitivity: 'low', description: 'Department master list.' },
  { key: 'users', en: 'User access matrix', ar: 'مصفوفة صلاحيات المستخدمين', sensitivity: 'critical', description: 'Employee access, roles and workload counters.' },
  { key: 'kpi_scorecard', en: 'KPI scorecard', ar: 'بطاقة مؤشرات الأداء', sensitivity: 'medium', description: 'Executive KPI summary.' },
  { key: 'department_heatmap', en: 'Department heatmap', ar: 'الخريطة الحرارية للإدارات', sensitivity: 'medium', description: 'Department pressure scores for reporting packs.' }
];

const reportPresets: Array<{ key: string; en: string; ar: string; description: string; datasets: ExportDatasetKey[] }> = [
  {
    key: 'executive_grc_pack',
    en: 'Executive GRC pack',
    ar: 'حزمة الحوكمة التنفيذية',
    description: 'Board/CEO weekly pack: KPIs, heatmap, projects, risks, compliance, audit and OVR indicators.',
    datasets: ['kpi_scorecard', 'department_heatmap', 'projects', 'risks', 'compliance', 'audit_findings', 'ovr_risk_indicators']
  },
  {
    key: 'quality_ovr_pack',
    en: 'Quality & OVR pack',
    ar: 'حزمة الجودة و OVR',
    description: 'Quality pack: OVR reports, OVR risk indicators, evidence queue and corrective-action tracking.',
    datasets: ['ovr_reports', 'ovr_risk_indicators', 'evidence', 'projects']
  },
  {
    key: 'department_control_pack',
    en: 'Department control pack',
    ar: 'حزمة تحكم الإدارات',
    description: 'Execution report: projects, milestones, tasks, escalations and department heatmap.',
    datasets: ['department_heatmap', 'projects', 'milestones', 'tasks', 'escalations']
  },
  {
    key: 'audit_compliance_pack',
    en: 'Audit & compliance pack',
    ar: 'حزمة المراجعة والالتزام',
    description: 'Audit/compliance report: compliance calendar, audit findings, risks and evidence queue.',
    datasets: ['compliance', 'audit_findings', 'risks', 'evidence']
  }
];

const sourceTypes = ['manual', 'ceo_decision', 'committee_decision', 'risk', 'audit_finding', 'compliance_requirement', 'policy_gap', 'department_kpi', 'incident_ovr', 'strategic_goal'];
const riskPriorityLevels = ['critical', 'high', 'medium', 'low'];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function rowsToCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
}

function flattenRow(row: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  Object.entries(row).forEach(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(output, flattenRow(value as Record<string, unknown>, nextKey));
    } else {
      output[nextKey] = Array.isArray(value) ? JSON.stringify(value) : value;
    }
  });
  return output;
}

function datasetToCsv(rows: Record<string, unknown>[]) {
  const flatRows = rows.map(row => flattenRow(row));
  const headers = Array.from(new Set(flatRows.flatMap(row => Object.keys(row))));
  return rowsToCsv(headers, flatRows.map(row => headers.map(header => row[header])));
}

function downloadFile(fileName: string, content: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseDelimitedLine(line: string, delimiter: string) {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === delimiter && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseDelimitedText(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) return { headers: [], rows: [] };

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = parseDelimitedLine(lines[0], delimiter).map(header => header.trim());
  const rows = lines.slice(1).map(line => {
    const values = parseDelimitedLine(line, delimiter);
    return headers.reduce<ParsedRow>((acc, header, index) => {
      acc[header] = values[index] || '';
      return acc;
    }, {});
  });

  return { headers, rows };
}

function validateRows(templateKey: TemplateKey, text: string): ValidationResult {
  const config = templates[templateKey];
  const { headers, rows } = parseDelimitedText(text);
  const errorsByRow: Record<number, string[]> = {};
  const warningsByRow: Record<number, string[]> = {};

  const missingHeaders = config.required.filter(required => !headers.includes(required));
  if (missingHeaders.length) errorsByRow[0] = [`Missing required columns: ${missingHeaders.join(', ')}`];

  const addError = (rowNumber: number, error: string) => {
    errorsByRow[rowNumber] = [...(errorsByRow[rowNumber] || []), error];
  };

  const addWarning = (rowNumber: number, warning: string) => {
    warningsByRow[rowNumber] = [...(warningsByRow[rowNumber] || []), warning];
  };

  config.required.forEach(required => {
    rows.forEach((row, index) => {
      if (!row[required]?.trim()) addError(index + 1, `${required} is required`);
    });
  });

  const duplicateChecks: Array<{ field: string; label: string }> = [];
  if (templateKey === 'divisions') duplicateChecks.push({ field: 'division_code', label: 'Division code' });
  if (templateKey === 'departments') duplicateChecks.push({ field: 'department_code', label: 'Department code' });
  if (templateKey === 'units') duplicateChecks.push({ field: 'unit_code', label: 'Unit code' });
  if (templateKey === 'employees') duplicateChecks.push({ field: 'employee_no', label: 'Employee number' }, { field: 'email', label: 'Email' });

  duplicateChecks.forEach(check => {
    const seen = new Map<string, number>();
    rows.forEach((row, index) => {
      const value = normalize(row[check.field] || '');
      if (!value) return;
      const firstRow = seen.get(value);
      if (firstRow !== undefined) addError(index + 1, `${check.label} duplicates row ${firstRow}`);
      else seen.set(value, index + 1);
    });
  });

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    ['email', 'manager_email', 'owner_email', 'sponsor_email'].forEach(field => {
      const value = row[field]?.trim();
      if (value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) addError(rowNumber, `${field} has invalid email format`);
    });

    const isActive = row.is_active?.trim().toLowerCase();
    if (isActive && !['true', 'false', 'yes', 'no', '1', '0'].includes(isActive)) addWarning(rowNumber, 'is_active should be true/false');

    if (templateKey === 'employees') {
      const role = normalize(row.primary_role || '');
      const scope = normalize(row.role_scope || '');
      if (role && !roleOptions.includes(role)) addError(rowNumber, `primary_role must be one of: ${roleOptions.join(', ')}`);
      if (scope && !scopeOptions.includes(scope)) addError(rowNumber, `role_scope must be one of: ${scopeOptions.join(', ')}`);
    }

    if (templateKey === 'projects') {
      const sourceType = normalize(row.source_type || '');
      const priority = normalize(row.priority || '');
      const riskLevel = normalize(row.risk_level || '');
      if (sourceType && !sourceTypes.includes(sourceType)) addError(rowNumber, `source_type must be one of: ${sourceTypes.join(', ')}`);
      if (priority && !riskPriorityLevels.includes(priority)) addError(rowNumber, 'priority must be critical/high/medium/low');
      if (riskLevel && !riskPriorityLevels.includes(riskLevel)) addError(rowNumber, 'risk_level must be critical/high/medium/low');
    }
  });

  const invalidRowNumbers = new Set(Object.keys(errorsByRow).map(Number).filter(row => row > 0));
  return { headers, rows, errorsByRow, warningsByRow, validRows: rows.length - invalidRowNumbers.size, invalidRows: invalidRowNumbers.size };
}

function buildValidationReport(result: ValidationResult) {
  const headers = ['row_number', 'status', 'errors', 'warnings', ...result.headers];
  const rows = result.rows.map((row, index) => {
    const rowNumber = index + 1;
    const errors = result.errorsByRow[rowNumber] || [];
    const warnings = result.warningsByRow[rowNumber] || [];
    return [String(rowNumber), errors.length ? 'invalid' : 'valid', errors.join(' | '), warnings.join(' | '), ...result.headers.map(header => row[header] || '')];
  });
  return rowsToCsv(headers, rows);
}

function todayStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

function asDatasetLabel(option: DatasetOption, language: 'en' | 'ar') {
  return language === 'ar' ? option.ar : option.en;
}

export function ImportExport() {
  const { language, t } = useI18n();
  const organizations = useAsyncData(getOrganizations, []);
  const exportSummary = useAsyncData(getExportCenterSummary, []);
  const customReports = useAsyncData(getCustomReportDefinitions, []);

  const [activeTab, setActiveTab] = useState<CenterTab>('export');
  const [templateKey, setTemplateKey] = useState<TemplateKey>('employees');
  const [pasteText, setPasteText] = useState('');
  const [saveState, setSaveState] = useState<string | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<ExportDatasetKey>('projects');
  const [selectedBackupDatasets, setSelectedBackupDatasets] = useState<ExportDatasetKey[]>(['projects', 'risks', 'compliance', 'audit_findings', 'ovr_reports', 'approvals', 'evidence']);
  const [selectedReport, setSelectedReport] = useState(reportPresets[0].key);
  const [customReportName, setCustomReportName] = useState('Custom executive report');
  const [selectedReportDatasets, setSelectedReportDatasets] = useState<ExportDatasetKey[]>(reportPresets[0].datasets);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);

  const config = templates[templateKey];
  const validation = useMemo(() => validateRows(templateKey, pasteText), [templateKey, pasteText]);
  const hasRows = validation.rows.length > 0;
  const canSave = hasRows && validation.invalidRows === 0 && !validation.errorsByRow[0];
  const organizationId = organizations.data?.[0]?.id;
  const hasLiveSummary = Boolean(exportSummary.data && !isEmptyLiveObject(exportSummary.data));
  const summaryValue = (value: number | null | undefined) => hasLiveSummary
    ? (typeof value === 'number' ? value : 0)
    : 'Not configured';

  const downloadTemplate = () => downloadFile(`grc_${templateKey}_template.csv`, rowsToCsv(config.headers, [config.sample]));
  const downloadReport = () => downloadFile(`grc_${templateKey}_validation_report.csv`, buildValidationReport(validation));

  const copyCleanCsv = async () => {
    const validRows = validation.rows.filter((_, index) => !validation.errorsByRow[index + 1]);
    await navigator.clipboard.writeText(rowsToCsv(validation.headers, validRows.map(row => validation.headers.map(header => row[header] || ''))));
    setSaveState('Valid rows copied to clipboard.');
  };

  const saveToStaging = async () => {
    try {
      setSaveState('Saving import batch...');
      if (!organizationId) throw new Error('No organization found. Create or seed the organization first.');
      const result = await saveBulkImportBatch({
        organization_id: organizationId,
        batch_type: templateKey,
        source_file_name: `pasted_${templateKey}.csv`,
        total_rows: validation.rows.length,
        valid_rows: validation.validRows,
        invalid_rows: validation.invalidRows,
        rows: validation.rows.map((row, index) => ({
          row_number: index + 1,
          raw_data: row,
          validation_status: validation.errorsByRow[index + 1]?.length ? 'invalid' : 'valid',
          validation_errors: validation.errorsByRow[index + 1] || [],
          validation_warnings: validation.warningsByRow[index + 1] || []
        }))
      });
      setSaveState(`Saved staging batch ${result.id}.`);
    } catch (error) {
      setSaveState(error instanceof Error ? error.message : 'Could not save import batch.');
    }
  };

  const exportOneDataset = async (format: 'csv' | 'json') => {
    try {
      setBusyMessage('Preparing export...');
      const payload = await getExportDataset(selectedDataset);
      const fileBase = `grc_${selectedDataset}_${todayStamp()}`;
      if (format === 'csv') downloadFile(`${fileBase}.csv`, datasetToCsv(payload.rows));
      else downloadFile(`${fileBase}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8;');
      if (organizationId) await logDataExport({ organization_id: organizationId, export_type: 'dataset', dataset_key: selectedDataset, export_format: format, file_name: `${fileBase}.${format}`, row_count: payload.rowCount });
      setBusyMessage(`Exported ${payload.rowCount} rows from ${payload.label}.`);
    } catch (error) {
      setBusyMessage(error instanceof Error ? error.message : 'Could not export dataset.');
    }
  };

  const runReportPreset = async (reportKey: string) => {
    try {
      setBusyMessage('Preparing custom report package...');
      const preset = reportPresets.find(report => report.key === reportKey) || reportPresets[0];
      const backup = await buildBackupPackage(preset.datasets);
      const fileName = `grc_report_${preset.key}_${todayStamp()}.json`;
      downloadFile(fileName, JSON.stringify({ report: preset, ...backup }, null, 2), 'application/json;charset=utf-8;');
      if (organizationId) await logDataExport({ organization_id: organizationId, export_type: 'report', export_format: 'report_json', file_name: fileName, row_count: backup.manifest.totalRows, filters: { datasets: preset.datasets } });
      setBusyMessage(`Report package generated with ${backup.manifest.totalRows} rows across ${preset.datasets.length} datasets.`);
    } catch (error) {
      setBusyMessage(error instanceof Error ? error.message : 'Could not create report package.');
    }
  };


  const runCustomReport = async () => {
    try {
      setBusyMessage('Preparing custom report package...');
      const backup = await buildBackupPackage(selectedReportDatasets);
      const fileName = `grc_report_custom_${todayStamp()}.json`;
      downloadFile(fileName, JSON.stringify({ report: { name: customReportName, datasets: selectedReportDatasets }, ...backup }, null, 2), 'application/json;charset=utf-8;');
      if (organizationId) await logDataExport({ organization_id: organizationId, export_type: 'report', export_format: 'report_json', file_name: fileName, row_count: backup.manifest.totalRows, filters: { datasets: selectedReportDatasets, custom: true } });
      setBusyMessage(`Custom report generated with ${backup.manifest.totalRows} rows across ${selectedReportDatasets.length} datasets.`);
    } catch (error) {
      setBusyMessage(error instanceof Error ? error.message : 'Could not create custom report package.');
    }
  };

  const saveReportDefinition = async () => {
    try {
      setBusyMessage('Saving custom report definition...');
      if (!organizationId) throw new Error('No organization found. Create or seed the organization first.');
      const safeKey = customReportName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `custom_${Date.now()}`;
      await saveCustomReportDefinition({
        organization_id: organizationId,
        report_key: safeKey,
        name_en: customReportName,
        name_ar: null,
        description: 'User-defined report package from Export Center.',
        datasets: selectedReportDatasets,
        filters: { created_from: 'export_center' },
        columns: null
      });
      setBusyMessage('Custom report definition saved. Refresh to see it in the saved report list.');
    } catch (error) {
      setBusyMessage(error instanceof Error ? error.message : 'Could not save custom report definition.');
    }
  };

  const runBackup = async () => {
    try {
      setBusyMessage('Preparing external backup package...');
      const backup = await buildBackupPackage(selectedBackupDatasets);
      const fileName = `grc_external_backup_${todayStamp()}.json`;
      downloadFile(fileName, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8;');
      if (organizationId) await logDataExport({ organization_id: organizationId, export_type: 'backup', export_format: 'backup_json', file_name: fileName, row_count: backup.manifest.totalRows, filters: { datasets: selectedBackupDatasets } });
      setBusyMessage(`Backup package created with ${backup.manifest.totalRows} rows. Evidence file binaries are not included.`);
    } catch (error) {
      setBusyMessage(error instanceof Error ? error.message : 'Could not create backup package.');
    }
  };

  const toggleBackupDataset = (key: ExportDatasetKey) => {
    setSelectedBackupDatasets(current => (current.includes(key) ? current.filter(item => item !== key) : [...current, key]));
  };

  const toggleReportDataset = (key: ExportDatasetKey) => {
    setSelectedReportDatasets(current => (current.includes(key) ? current.filter(item => item !== key) : [...current, key]));
  };

  const renderSummary = () => (
    <div className="stats-grid export-score-grid">
      <div className="stat-card"><div className="stat-value">{summaryValue(exportSummary.data?.available_datasets)}</div><div className="stat-label">{t('export.datasets')}</div></div>
      <div className="stat-card success"><div className="stat-value">{summaryValue(exportSummary.data?.exports_30d)}</div><div className="stat-label">{t('export.exports30')}</div></div>
      <div className="stat-card warning"><div className="stat-value">{summaryValue(exportSummary.data?.backups_30d)}</div><div className="stat-label">{t('export.backups30')}</div></div>
      <div className="stat-card"><div className="stat-value">{summaryValue(exportSummary.data?.custom_reports)}</div><div className="stat-label">{t('export.customReports')}</div></div>
    </div>
  );

  const renderImportTab = () => (
    <>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-value">{validation.rows.length}</div><div className="stat-label">Parsed rows</div></div>
        <div className="stat-card success"><div className="stat-value">{validation.validRows}</div><div className="stat-label">Valid rows</div></div>
        <div className="stat-card danger"><div className="stat-value">{validation.invalidRows}</div><div className="stat-label">Invalid rows</div></div>
      </div>

      <div className="panel two-column align-start">
        <div>
          <div className="panel-header"><h4>1) Choose template</h4><p>Use CSV from Excel or paste directly from Excel. The system validates required fields, duplicate codes and email format before staging.</p></div>
          <div className="template-grid">
            {(Object.keys(templates) as TemplateKey[]).map(key => (
              <button key={key} className={`template-card ${templateKey === key ? 'active' : ''}`} onClick={() => setTemplateKey(key)}>
                <FileSpreadsheet size={18} /><strong>{templates[key].title}</strong><span>{templates[key].purpose}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mini-card">
          <span>Required Columns</span>
          <strong>{config.required.join(', ')}</strong>
          <p className="muted import-help">This stages employee data only. Actual Supabase Auth user creation should later use a secure server/Edge Function with service-role access, not the browser.</p>
          <div className="inline-actions">
            <button className="ghost-button" onClick={downloadTemplate}><Download size={15} /> Template</button>
            <button className="ghost-button" onClick={downloadReport} disabled={!hasRows}><ClipboardList size={15} /> Report</button>
            <button className="ghost-button" onClick={copyCleanCsv} disabled={!hasRows}><ShieldCheck size={15} /> Copy Valid CSV</button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header split-header">
          <div><h4>2) Paste CSV / Excel rows</h4><p>Download the template, fill it in Excel, then paste the full sheet here including the header row.</p></div>
          <div className="toolbar">
            <button className="ghost-button" onClick={() => setPasteText(rowsToCsv(config.headers, [config.sample]))}>Load Example</button>
            <button className="ghost-button" onClick={() => setPasteText('')}>Clear</button>
            <button className="primary-button" onClick={saveToStaging} disabled={!canSave || organizations.loading}><Save size={16} /> Save Staging Batch</button>
          </div>
        </div>
        <textarea className="import-textarea" value={pasteText} onChange={event => setPasteText(event.target.value)} placeholder={rowsToCsv(config.headers, [config.sample])} />
        {validation.errorsByRow[0]?.length ? <div className="form-error">{validation.errorsByRow[0].join(' | ')}</div> : null}
        {saveState ? <div className="notice-banner">{saveState}</div> : null}
      </div>

      <div className="panel">
        <div className="panel-header"><h4>3) Validation preview</h4><p>Showing the first 20 rows. Download the validation report for the full result.</p></div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Row</th><th>Status</th><th>Errors / Warnings</th>{validation.headers.slice(0, 8).map(header => <th key={header}>{header}</th>)}</tr></thead>
            <tbody>
              {validation.rows.slice(0, 20).map((row, index) => {
                const rowNumber = index + 1;
                const errors = validation.errorsByRow[rowNumber] || [];
                const warnings = validation.warningsByRow[rowNumber] || [];
                return (
                  <tr key={`${rowNumber}-${row[validation.headers[0]] || 'row'}`}>
                    <td>{rowNumber}</td>
                    <td><span className={`status-badge ${errors.length ? 'status-rejected' : 'status-approved'}`}>{errors.length ? 'Invalid' : 'Valid'}</span></td>
                    <td>{errors.length ? <div className="danger-text">{errors.join(' | ')}</div> : null}{warnings.length ? <div className="warning-text">{warnings.join(' | ')}</div> : null}{!errors.length && !warnings.length ? '—' : null}</td>
                    {validation.headers.slice(0, 8).map(header => <td key={header}>{row[header] || '—'}</td>)}
                  </tr>
                );
              })}
              {!hasRows ? <tr><td colSpan={11} className="muted">Paste data or load the example to preview validation.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderExportTab = () => {
    const option = exportDatasets.find(item => item.key === selectedDataset) || exportDatasets[0];
    return (
      <div className="panel export-grid-panel">
        <div className="panel-header split-header">
          <div><h4>{t('export.singleDataset')}</h4><p>{t('export.singleDatasetHint')}</p></div>
          <div className="toolbar"><button className="ghost-button" onClick={() => exportOneDataset('json')}><FileJson size={16} /> JSON</button><button className="primary-button" onClick={() => exportOneDataset('csv')}><Download size={16} /> CSV</button></div>
        </div>
        <div className="dataset-card-grid">
          {exportDatasets.map(dataset => (
            <button key={dataset.key} className={`dataset-card ${selectedDataset === dataset.key ? 'active' : ''}`} onClick={() => setSelectedDataset(dataset.key)}>
              <span className={`risk-chip ${dataset.sensitivity}`}>{dataset.sensitivity}</span>
              <strong>{asDatasetLabel(dataset, language)}</strong>
              <small>{dataset.description}</small>
            </button>
          ))}
        </div>
        <div className="notice-banner"><strong>{asDatasetLabel(option, language)}</strong>: {option.description}</div>
      </div>
    );
  };

  const renderReportsTab = () => {
    const preset = reportPresets.find(report => report.key === selectedReport) || reportPresets[0];
    return (
      <div className="report-layout">
        <div className="panel">
          <div className="panel-header split-header"><div><h4>{t('export.reportPacks')}</h4><p>{t('export.reportPacksHint')}</p></div><button className="primary-button" onClick={() => runReportPreset(selectedReport)}><Archive size={16} /> {t('export.generateReport')}</button></div>
          <div className="template-grid">
            {reportPresets.map(report => (
              <button key={report.key} className={`template-card ${selectedReport === report.key ? 'active' : ''}`} onClick={() => { setSelectedReport(report.key); setSelectedReportDatasets(report.datasets); }}>
                <FileJson size={18} /><strong>{language === 'ar' ? report.ar : report.en}</strong><span>{report.description}</span>
              </button>
            ))}
          </div>
          <div className="notice-banner"><strong>{language === 'ar' ? preset.ar : preset.en}</strong>: {preset.datasets.join(', ')}</div>
        </div>

        <div className="panel">
          <div className="panel-header"><h4>{t('export.customBuilder')}</h4><p>{t('export.customBuilderHint')}</p></div>
          <label className="form-label">Report name</label>
          <input className="form-input" value={customReportName} onChange={event => setCustomReportName(event.target.value)} />
          <div className="dataset-check-grid">
            {exportDatasets.map(dataset => (
              <label key={dataset.key} className="dataset-check">
                <input type="checkbox" checked={selectedReportDatasets.includes(dataset.key)} onChange={() => toggleReportDataset(dataset.key)} />
                <span>{asDatasetLabel(dataset, language)}</span>
              </label>
            ))}
          </div>
          <div className="inline-actions"><button className="ghost-button" onClick={saveReportDefinition} disabled={!selectedReportDatasets.length}><Save size={15} /> {t('export.saveDefinition')}</button><button className="primary-button" onClick={runCustomReport} disabled={!selectedReportDatasets.length}><Download size={15} /> {t('export.exportCustom')}</button></div>
        </div>

        <div className="panel full-span">
          <div className="panel-header"><h4>{t('export.savedDefinitions')}</h4><p>{t('export.savedDefinitionsHint')}</p></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Report</th><th>Datasets</th><th>Description</th><th>Created</th></tr></thead>
              <tbody>
                {(customReports.data as CustomReportDefinition[] | undefined)?.map(report => (
                  <tr key={report.id}><td>{language === 'ar' && report.name_ar ? report.name_ar : report.name_en}</td><td>{report.datasets.join(', ')}</td><td>{report.description || '—'}</td><td>{report.created_at?.slice(0, 10)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderBackupTab = () => (
    <div className="panel">
      <div className="panel-header split-header">
        <div><h4>{t('export.externalBackup')}</h4><p>{t('export.externalBackupHint')}</p></div>
        <button className="primary-button" onClick={runBackup} disabled={!selectedBackupDatasets.length}><DatabaseBackup size={16} /> {t('export.createBackup')}</button>
      </div>
      <div className="notice-banner warning"><strong>{t('export.backupWarningTitle')}</strong> {t('export.backupWarning')}</div>
      <div className="dataset-check-grid backup-grid">
        {exportDatasets.map(dataset => (
          <label key={dataset.key} className="dataset-check">
            <input type="checkbox" checked={selectedBackupDatasets.includes(dataset.key)} onChange={() => toggleBackupDataset(dataset.key)} />
            <span>{asDatasetLabel(dataset, language)}</span>
            <small>{dataset.sensitivity}</small>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow={t('export.eyebrow')}
        title={t('export.title')}
        subtitle={t('export.subtitle')}
        action={<button className="ghost-button" onClick={() => window.location.reload()}><RefreshCcw size={16} /> {t('export.refresh')}</button>}
      />

      {renderSummary()}

      <div className="tab-strip">
        {(['import', 'export', 'reports', 'backup'] as CenterTab[]).map(tab => (
          <button key={tab} className={`tab-button ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{t(`export.tab.${tab}`)}</button>
        ))}
      </div>

      {busyMessage ? <div className="notice-banner export-message">{busyMessage}</div> : null}

      {activeTab === 'import' ? renderImportTab() : null}
      {activeTab === 'export' ? renderExportTab() : null}
      {activeTab === 'reports' ? renderReportsTab() : null}
      {activeTab === 'backup' ? renderBackupTab() : null}
    </section>
  );
}
