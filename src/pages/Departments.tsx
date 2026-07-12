import { useMemo, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { DataState } from "../components/DataState";
import { EntityTable } from "../components/EntityTable";
import { Modal } from "../components/Modal";
import { ModuleHeader } from "../components/ModuleHeader";
import { useAsyncData } from "../hooks/useAsyncData";
import {
  isDepartmentImportExecutionEligible,
  isDepartmentImportExecutionEnabled,
} from "../config/featureFlags";
import {
  createDepartment,
  getDepartmentExecutionSummary,
  executeDepartmentImport
} from "../lib/grcApi";

import { Download, UploadCloud, FileSpreadsheet, FileWarning } from "lucide-react";
import { supabase } from "../lib/supabase";
import { validateImportText, parseDelimitedText } from "../utils/departmentImportValidation";
import type { DepartmentExecutionSummary } from "../types/domain";

type DepartmentFilter =
  "all" | "active" | "overdueProjects" | "overdueTasks" | "criticalRisks";
type DrilldownFilter = DepartmentFilter | "compliance" | "audit" | "nextAction";


type ParsedRow = Record<string, string>;

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

export function Departments({ setPage }: { setPage?: (page: string) => void }) {
  const auth = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importValidation, setImportValidation] = useState<{
    headers: string[];
    rows: ParsedRow[];
    errorsByRow: Record<number, string[]>;
    validRows: number;
    invalidRows: number;
  } | null>(null);
  const [importSaving, setImportSaving] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [importMode, setImportMode] = useState<'create_only' | 'create_and_update'>('create_only');
  const isExecutionEnabledByConfiguration = isDepartmentImportExecutionEnabled();
  const [refData, setRefData] = useState<{ orgs: Set<string>; divs: Set<string>; depts: Set<string>; managers: Map<string, any> } | null>(null);
  const hasAuthorizedImportRole =
    !auth.isLocalBypass &&
    auth.roles.some(
      (assignment) =>
        assignment.role === "super_admin" ||
        assignment.role === "governance_admin",
    );
  const hasBlockingImportErrors = Boolean(
    importValidation &&
      (importValidation.invalidRows > 0 ||
        Object.values(importValidation.errorsByRow).some(
          (errors) => errors.length > 0,
        )),
  );
  const departmentImportExecutionEligible =
    isDepartmentImportExecutionEligible({
      featureEnabled: isExecutionEnabledByConfiguration,
      roles: auth.roles.map((assignment) => assignment.role),
      previewExists: importValidation !== null,
      validRowCount: importValidation?.validRows ?? 0,
      hasBlockingValidationErrors: hasBlockingImportErrors,
      organizationId: auth.profile?.organizationId,
      importMode,
    });

  const fetchReferenceData = async () => {
    if (!supabase) return;
    try {
      const [{ data: orgs }, { data: divs }, { data: depts }, { data: profiles }] = await Promise.all([
        supabase.from('organizations').select('organization_code, id'),
        supabase.from('divisions').select('division_code, organization_id, id'),
        supabase.from('departments').select('department_code, division_id, organization_id'),
        supabase.from('profiles').select('email, id, user_status, organization_id')
      ]);
      setRefData({
        orgs: new Set((orgs || []).map((o: any) => o.organization_code?.toUpperCase())),
        divs: new Set((divs || []).map((d: any) => {
          const orgCode = orgs?.find(o => o.id === d.organization_id)?.organization_code || '';
          return `${orgCode.toUpperCase()}|${d.division_code?.toUpperCase()}`;
        })),
        depts: new Set((depts || []).map((d: any) => {
          const orgCode = orgs?.find(o => o.id === d.organization_id)?.organization_code || '';
          return `${orgCode.toUpperCase()}|${d.department_code?.toUpperCase()}`;
        })),
        managers: new Map((profiles || []).map((p: any) => {
          const orgCode = orgs?.find(o => o.id === p.organization_id)?.organization_code || '';
          return [p.email?.toLowerCase(), { ...p, organization_code: orgCode.toUpperCase() }];
        }))
      });
    } catch (e) {
      console.error("Failed to fetch reference data", e);
    }
  };

  const handleValidation = (text: string) => {
    const result = validateImportText(text, refData);
    setImportValidation(result);
  };

  const continueToConfirmation = () => {
    if (!importValidation || hasBlockingImportErrors || importValidation.validRows === 0) return;
    setShowConfirmation(true);
    setImportSuccess(null);
    setImportError(null);
  };

  const handleExecuteImport = async () => {
    if (!isExecutionEnabledByConfiguration) {
      setImportError("Execution is disabled by deployment configuration.");
      return;
    }

    if (!hasAuthorizedImportRole) {
      setImportError("Execution is available only to authorized administrators.");
      return;
    }

    if (!departmentImportExecutionEligible || !importValidation) {
      setImportError("Execution requirements are not satisfied. Revalidate the preview, organization, and import mode.");
      return;
    }

    const orgId = auth?.profile?.organizationId;
    if (!orgId) {
      setImportError("Organization ID not found");
      return;
    }

    setImportSaving(true);
    setImportError(null);
    try {
      const response = await executeDepartmentImport({
        organization_id: orgId,
        source_filename: 'departments_import.csv',
        import_mode: importMode,
        rows: importValidation.rows.map((r: any) => ({
          row_number: r.row_number,
          raw_data: r.raw_data
        }))
      });

      if (response.status === 'success') {
        setImportSuccess(`Department import executed successfully. Created: ${response.created_count}, Updated: ${response.updated_count}.`);
        setTimeout(() => {
          setImportOpen(false);
          setImportText("");
          setImportValidation(null);
          setImportSuccess(null);
          setShowConfirmation(false);
          departments.refresh();
        }, 3000);
      } else {
        setImportError(`Department import rejected. Failed rows: ${response.failed_count}`);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to execute import batch');
    } finally {
      setImportSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = ['organization_code', 'division_code', 'department_code', 'department_name_en', 'department_name_ar', 'department_type', 'manager_email', 'status'];
    const sample = ['ALMODAWAT', 'MED', 'NUR', 'Nursing', 'التمريض', 'clinical', 'nursing.manager@almodawat.sa', 'active'];
    const instructions = [
      '# Department Import Template',
      '# Accepted columns: ' + headers.join(', '),
      '# Required columns: organization_code, department_code, department_name_en',
      '# Status: active | inactive',
      '# Department Types: clinical | administrative | support',
      ''
    ];
    downloadFile('departments_template.csv', [...instructions, headers.join(','), sample.join(',')].join('\n'));
  };

  const [activeFilter, setActiveFilter] = useState<DepartmentFilter>("all");
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] =
    useState<DepartmentExecutionSummary | null>(null);
  const [drilldownContext, setDrilldownContext] = useState<{
    filter: DrilldownFilter;
    department: DepartmentExecutionSummary;
  } | null>(null);
  const [manageDepartment, setManageDepartment] =
    useState<DepartmentExecutionSummary | null>(null);
  const departments = useAsyncData(getDepartmentExecutionSummary, []);
  const rows = departments.data || [];
  const filteredRows = useMemo(() => {
    const query = departmentSearch.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "active" && Number(row.active_projects || 0) > 0) ||
        (activeFilter === "overdueProjects" &&
          Number(row.overdue_projects || 0) > 0) ||
        (activeFilter === "overdueTasks" &&
          Number(row.overdue_tasks || 0) > 0) ||
        (activeFilter === "criticalRisks" &&
          Number(row.critical_risks || 0) > 0);
      const matchesQuery =
        !query ||
        [row.department_name].some((value) =>
          value?.toLowerCase().includes(query),
        );
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, departmentSearch, rows]);
  const canManageDepartments = hasAuthorizedImportRole;
  const totals = rows.reduce(
    (acc, row) => {
      acc.activeProjects += Number(row.active_projects || 0);
      acc.overdueProjects += Number(row.overdue_projects || 0);
      acc.overdueTasks += Number(row.overdue_tasks || 0);
      acc.criticalRisks += Number(row.critical_risks || 0);
      return acc;
    },
    {
      activeProjects: 0,
      overdueProjects: 0,
      overdueTasks: 0,
      criticalRisks: 0,
    },
  );

  const resetForm = () => {
    setNameEn("");
    setNameAr("");
    setCode("");
    setActionError(null);
  };
  const resetDashboardFilters = () => {
    setActiveFilter("all");
    setDepartmentSearch("");
    setSelectedDepartment(null);
    setDrilldownContext(null);
  };

  const handleMetricClick = (
    filter: DrilldownFilter,
    row: DepartmentExecutionSummary,
  ) => {
    sessionStorage.setItem(
      "grc.departmentContext",
      JSON.stringify({
        departmentId: row.department_id,
        departmentName: row.department_name,
        metric: filter,
        source: "department-execution-summary",
      }),
    );

    if (filter === "criticalRisks") {
      setPage?.("ovrRisk");
    } else {
      setPage?.("operations");
    }
  };

  const submitDepartment = async () => {
    setActionError(null);
    setMessage(null);
    if (!nameEn.trim()) {
      setActionError("English department name is required.");
      return;
    }
    if (!/^[A-Za-z0-9_-]{2,24}$/.test(code.trim())) {
      setActionError(
        "Code must be 2-24 letters, numbers, underscores, or hyphens.",
      );
      return;
    }

    setSaving(true);
    try {
      const created = await createDepartment({
        name_en: nameEn,
        name_ar: nameAr,
        code,
      });
      setMessage(`Department ${created.name_en} (${created.code}) created.`);
      setFormOpen(false);
      resetForm();
      await departments.refresh();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not create department.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Department control room"
        title="Master tracking across departments"
        subtitle="Use this page to see which departments are delayed, exposed to critical risk, or need management follow-up."
        action={
          canManageDepartments ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="ghost-button"
                onClick={() => {
                  setImportError(null);
                  setImportSuccess(null);
                  setImportText("");
                  setImportValidation(null);
                  setImportOpen(true);
                  fetchReferenceData();
                }}
              >
                <UploadCloud size={16} /> Prepare Import Batch
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  setActionError(null);
                  setFormOpen(true);
                }}
              >
                <Plus size={16} /> Create department
              </button>
            </div>
          ) : null
        }
      />

      {auth.isLocalBypass ? (
        <div className="notice-banner">
          Department creation requires a real authenticated Supabase session.
          Set <code>VITE_AUTH_BYPASS_LOCAL=false</code> and sign in.
        </div>
      ) : null}
      {message ? <div className="notice-banner">{message}</div> : null}

      {rows.length ? (
        <div className="stats-grid">
          {[
            {
              key: "all" as const,
              label: "Departments tracked",
              value: rows.length,
              tone: "normal" as const,
            },
            {
              key: "active" as const,
              label: "Active projects",
              value: totals.activeProjects,
              tone: "normal" as const,
            },
            {
              key: "overdueProjects" as const,
              label: "Overdue projects",
              value: totals.overdueProjects,
              tone: "danger" as const,
            },
            {
              key: "overdueTasks" as const,
              label: "Overdue tasks",
              value: totals.overdueTasks,
              tone: "warning" as const,
            },
            {
              key: "criticalRisks" as const,
              label: "Critical risks",
              value: totals.criticalRisks,
              tone: "danger" as const,
            },
          ].map((card) => (
            <button
              key={card.key}
              type="button"
              className={`stat-card ${card.tone} ${activeFilter === card.key ? "active" : ""}`}
              onClick={() => setActiveFilter(card.key)}
            >
              <div className="stat-value">{card.value}</div>
              <div className="stat-label">{card.label}</div>
            </button>
          ))}
        </div>
      ) : null}

      <div className="panel">
        <div className="split-header">
          <div className="panel-header">
            <h4>Department dashboard filters</h4>
            <p>
              Showing {filteredRows.length} of {rows.length} departments. Click
              a department name for execution details.
            </p>
          </div>
          <button
            className="ghost-button"
            type="button"
            onClick={resetDashboardFilters}
          >
            Reset filters
          </button>
        </div>
        <div className="toolbar">
          <span className="status-badge status-info">
            Active filter:{" "}
            {activeFilter === "all"
              ? "All departments"
              : activeFilter.replace(/([A-Z])/g, " $1")}
          </span>
          <input
            value={departmentSearch}
            onChange={(event) => setDepartmentSearch(event.target.value)}
            placeholder="Search department"
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4>
            <Building2 size={18} /> Department execution summary
          </h4>
          <p>
            Live department execution and risk indicators for the organization
            and role currently in scope.
          </p>
        </div>
        <DataState
          loading={departments.loading}
          error={departments.error}
          empty={!filteredRows.length}
          emptyTitle="No department execution data"
          emptyMessage={
            activeFilter !== "all" || departmentSearch
              ? "No departments match the selected filter. Reset filters or broaden the search."
              : canManageDepartments
                ? "Create or activate departments, then add controlled work to populate this summary."
                : "No department summary is available for your current role and scope."
          }
        >
          <EntityTable<DepartmentExecutionSummary>
            rows={filteredRows}
            getRowKey={(row) => row.department_id}
            columns={[
              {
                key: "department",
                header: "Department",
                render: (row) => <strong>{row.department_name}</strong>,
              },
              {
                key: "active",
                header: "Active projects",
                render: (row) =>
                  row.active_projects ? (
                    <button
                      type="button"
                      className="ghost-button small"
                      aria-label={`Open ${row.active_projects} active projects for ${row.department_name}`}
                      onClick={() => handleMetricClick("active", row)}
                    >
                      {row.active_projects}
                    </button>
                  ) : (
                    "0"
                  ),
              },
              {
                key: "overdueProjects",
                header: "Overdue projects",
                render: (row) =>
                  row.overdue_projects ? (
                    <button
                      type="button"
                      className="ghost-button small danger-text"
                      aria-label={`Open ${row.overdue_projects} overdue projects for ${row.department_name}`}
                      onClick={() => handleMetricClick("overdueProjects", row)}
                    >
                      {row.overdue_projects}
                    </button>
                  ) : (
                    "0"
                  ),
              },
              {
                key: "overdueMilestones",
                header: "Overdue milestones",
                render: (row) => row.overdue_milestones,
              },
              {
                key: "overdueTasks",
                header: "Overdue tasks",
                render: (row) =>
                  row.overdue_tasks ? (
                    <button
                      type="button"
                      className="ghost-button small warning-text"
                      aria-label={`Open ${row.overdue_tasks} overdue tasks for ${row.department_name}`}
                      onClick={() => handleMetricClick("overdueTasks", row)}
                    >
                      {row.overdue_tasks}
                    </button>
                  ) : (
                    "0"
                  ),
              },
              {
                key: "risks",
                header: "Critical risks",
                render: (row) =>
                  row.critical_risks ? (
                    <button
                      type="button"
                      className="risk-pill critical"
                      aria-label={`Open ${row.critical_risks} critical risks for ${row.department_name}`}
                      onClick={() => handleMetricClick("criticalRisks", row)}
                    >
                      {row.critical_risks}
                    </button>
                  ) : (
                    "0"
                  ),
              },
              {
                key: "audit",
                header: "Overdue audit",
                render: (row) =>
                  row.overdue_audit_findings ? (
                    <button
                      type="button"
                      className="ghost-button small warning-text"
                      aria-label={`Open ${row.overdue_audit_findings} overdue audit findings for ${row.department_name}`}
                      onClick={() => handleMetricClick("audit", row)}
                    >
                      {row.overdue_audit_findings}
                    </button>
                  ) : (
                    "0"
                  ),
              },
              {
                key: "compliance",
                header: "Compliance expiring",
                render: (row) =>
                  row.compliance_expiring_30_days ? (
                    <button
                      type="button"
                      className="ghost-button small warning-text"
                      aria-label={`Open ${row.compliance_expiring_30_days} compliance items for ${row.department_name}`}
                      onClick={() => handleMetricClick("compliance", row)}
                    >
                      {row.compliance_expiring_30_days}
                    </button>
                  ) : (
                    "0"
                  ),
              },
            ]}
          />
        </DataState>
        {selectedDepartment ? (
          <div className="detail-panel">
            <div className="split-header">
              <div>
                <h4>Selected department drilldown</h4>
                <p>
                  Showing result(s) for {selectedDepartment.department_name}{" "}
                  {activeFilter !== "all"
                    ? `/ ${activeFilter
                        .replace(/([A-Z])/g, " $1")
                        .trim()
                        .toLowerCase()}`
                    : ""}
                </p>
              </div>
              <button
                className="ghost-button small"
                type="button"
                onClick={() => setSelectedDepartment(null)}
              >
                Clear selection
              </button>
            </div>
            <div className="stats-grid mt-4">
              <div className="panel muted-panel">
                <div className="stat-label">Active projects</div>
                <div className="stat-value">
                  {selectedDepartment.active_projects}
                </div>
              </div>
              <button
                type="button"
                className="stat-card danger"
                disabled={!selectedDepartment.overdue_projects}
                onClick={() =>
                  handleMetricClick("overdueProjects", selectedDepartment)
                }
              >
                <div className="stat-value">
                  {selectedDepartment.overdue_projects}
                </div>
                <div className="stat-label">Overdue projects</div>
              </button>
              <div className="panel muted-panel">
                <div className="stat-label">Overdue milestones</div>
                <div className="stat-value">
                  {selectedDepartment.overdue_milestones}
                </div>
              </div>
              <button
                type="button"
                className="stat-card warning"
                disabled={!selectedDepartment.overdue_tasks}
                onClick={() =>
                  handleMetricClick("overdueTasks", selectedDepartment)
                }
              >
                <div className="stat-value">
                  {selectedDepartment.overdue_tasks}
                </div>
                <div className="stat-label">Overdue tasks</div>
              </button>
              <button
                type="button"
                className="stat-card danger"
                disabled={!selectedDepartment.critical_risks}
                onClick={() =>
                  handleMetricClick("criticalRisks", selectedDepartment)
                }
              >
                <div className="stat-value">
                  {selectedDepartment.critical_risks}
                </div>
                <div className="stat-label">Critical risks</div>
              </button>
              <button
                type="button"
                className="stat-card warning"
                disabled={!selectedDepartment.overdue_audit_findings}
                onClick={() => handleMetricClick("audit", selectedDepartment)}
              >
                <div className="stat-value">
                  {selectedDepartment.overdue_audit_findings}
                </div>
                <div className="stat-label">Overdue audit</div>
              </button>
              <button
                type="button"
                className="stat-card warning"
                disabled={!selectedDepartment.compliance_expiring_30_days}
                onClick={() =>
                  handleMetricClick("compliance", selectedDepartment)
                }
              >
                <div className="stat-value">
                  {selectedDepartment.compliance_expiring_30_days}
                </div>
                <div className="stat-label">Compliance expiring</div>
              </button>
              <button
                type="button"
                className="stat-card primary"
                onClick={() =>
                  handleMetricClick("nextAction", selectedDepartment)
                }
              >
                <div className="stat-value">
                  {Number(selectedDepartment.overdue_projects || 0) +
                    Number(selectedDepartment.overdue_tasks || 0) +
                    Number(selectedDepartment.critical_risks || 0) >
                  0
                    ? "Follow-up"
                    : "Clear"}
                </div>
                <div className="stat-label">Next action</div>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        open={!!manageDepartment}
        title={`Manage ${manageDepartment?.department_name}`}
        onClose={() => setManageDepartment(null)}
      >
        <div className="page-section">
          <div className="panel">
            <div className="panel-header">
              <h4>Department Details</h4>
              <p>ID: {manageDepartment?.department_id}</p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                margin: "16px 0",
              }}
            >
              <div>
                <strong>Active Projects:</strong>{" "}
                {manageDepartment?.active_projects}
              </div>
              <div>
                <strong>Overdue Projects:</strong>{" "}
                {manageDepartment?.overdue_projects}
              </div>
              <div>
                <strong>Overdue Tasks:</strong>{" "}
                {manageDepartment?.overdue_tasks}
              </div>
              <div>
                <strong>Critical Risks:</strong>{" "}
                {manageDepartment?.critical_risks}
              </div>
              <div>
                <strong>Overdue Audit:</strong>{" "}
                {manageDepartment?.overdue_audit_findings}
              </div>
              <div>
                <strong>Compliance Expiring:</strong>{" "}
                {manageDepartment?.compliance_expiring_30_days}
              </div>
            </div>
            <div
              className="workflow-actions mt-4"
              style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
            >
              <button
                className="primary-button"
                type="button"
                onClick={() =>
                  manageDepartment && handleMetricClick("all", manageDepartment)
                }
              >
                Open Operations with this department
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() =>
                  manageDepartment &&
                  handleMetricClick("criticalRisks", manageDepartment)
                }
              >
                Open OVR Risk Indicators with this department
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setManageDepartment(null);
                  setPage?.("reportsHub");
                }}
              >
                Open Department Scorecards
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={formOpen}
        title="Create department"
        onClose={() => {
          if (!saving) {
            setFormOpen(false);
            resetForm();
          }
        }}
      >
        <div className="form-grid">
          {actionError ? (
            <div className="form-error full-width">{actionError}</div>
          ) : null}
          <label className="field full-width">
            English name
            <input
              value={nameEn}
              onChange={(event) => setNameEn(event.target.value)}
              placeholder="Information Technology"
            />
          </label>
          <label className="field full-width">
            Arabic name
            <input
              value={nameAr}
              onChange={(event) => setNameAr(event.target.value)}
              placeholder="Optional"
              dir="rtl"
            />
          </label>
          <label className="field full-width">
            Department code
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="IT"
              maxLength={24}
            />
          </label>
          <div className="form-actions full-width">
            <button
              className="ghost-button"
              type="button"
              disabled={saving}
              onClick={() => {
                setFormOpen(false);
                resetForm();
              }}
            >
              Cancel
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={saving}
              onClick={submitDepartment}
            >
              <Plus size={16} /> {saving ? "Creating…" : "Create department"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        title="Prepare Department Import"
        onClose={() => {
          if (!importSaving) {
            setImportOpen(false);
            setImportText("");
            setImportValidation(null);
          }
        }}
      >
        <div className="form-grid" style={{ minWidth: '600px' }}>
          {importError && <div className="form-error full-width">{importError}</div>}
          {importSuccess && <div className="notice-banner success full-width">{importSuccess}</div>}

          <div className="full-width" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p className="eyebrow">Paste CSV or Excel data</p>
              <p className="muted">Preview does not modify data.</p>
            </div>
            <button type="button" className="ghost-button small" onClick={handleDownloadTemplate}>
              <Download size={14} /> Download template
            </button>
          </div>

          <label className="field full-width">
            <textarea
              style={{ minHeight: '200px', fontFamily: 'monospace', whiteSpace: 'pre' }}
              placeholder="division_code,department_code,department_name_en..."
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                handleValidation(e.target.value);
              }}
            />
          </label>

          {importValidation && (
            <div className="full-width">
              <div className="stats-grid" style={{ marginBottom: '16px' }}>
                <div className="stat-card">
                  <div className="stat-value">{importValidation.rows.length}</div>
                  <div className="stat-label">Total rows</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{importValidation.validRows}</div>
                  <div className="stat-label">Valid rows</div>
                </div>
                <div className={`stat-card ${importValidation.invalidRows > 0 || importValidation.errorsByRow[0] ? 'danger' : ''}`}>
                  <div className="stat-value">{importValidation.invalidRows + (importValidation.errorsByRow[0] ? 1 : 0)}</div>
                  <div className="stat-label">Invalid rows</div>
                </div>
              </div>

              {importValidation.errorsByRow[0] && (
                <div className="notice-banner warning">
                  <FileWarning size={16} /> {importValidation.errorsByRow[0].join(', ')}
                </div>
              )}
            </div>
          )}

          <div className="form-actions full-width" style={{ marginTop: '24px' }}>
            <button
              className="ghost-button"
              type="button"
              disabled={importSaving}
              onClick={() => {
                setImportOpen(false);
                setImportText("");
                setImportValidation(null);
                setShowConfirmation(false);
              }}
            >
              Cancel
            </button>
            {!showConfirmation ? (
              <button
                className="primary-button"
                type="button"
                disabled={importSaving || !importValidation || importValidation.invalidRows > 0 || !!importValidation.errorsByRow[0] || importValidation.validRows === 0}
                onClick={continueToConfirmation}
              >
                Continue to Confirmation
              </button>
            ) : (
              <button
                className="primary-button"
                type="button"
                disabled={importSaving || !departmentImportExecutionEligible}
                onClick={handleExecuteImport}
              >
                <FileSpreadsheet size={16} /> {importSaving ? "Executing..." : "Execute " + "Import"}
              </button>
            )}
          </div>

          {showConfirmation && !isExecutionEnabledByConfiguration && (
            <div className="notice-banner warning" style={{ marginTop: '16px' }}>
              <FileWarning size={16} /> Execution is disabled by deployment configuration.
            </div>
          )}

          {showConfirmation && isExecutionEnabledByConfiguration && (
            <div className="notice-banner info" style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                <strong>Confirm Execution</strong>
                <p>Execution is available only to authorized administrators.</p>
                <p>You are about to execute the import batch containing {importValidation?.validRows} valid rows.</p>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="importMode" checked={importMode === 'create_only'} onChange={() => setImportMode('create_only')} />
                  Create Only (Fail if departments already exist)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="importMode" checked={importMode === 'create_and_update'} onChange={() => setImportMode('create_and_update')} />
                  Create & Update (Update matching departments)
                </label>
              </div>
            </div>
          )}
        </div>
      </Modal>

    </section>
  );
}
