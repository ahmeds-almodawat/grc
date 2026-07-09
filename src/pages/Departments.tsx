import { useMemo, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { DataState } from "../components/DataState";
import { EntityTable } from "../components/EntityTable";
import { Modal } from "../components/Modal";
import { ModuleHeader } from "../components/ModuleHeader";
import { useAsyncData } from "../hooks/useAsyncData";
import { createDepartment, getDepartmentExecutionSummary } from "../lib/grcApi";
import type { DepartmentExecutionSummary } from "../types/domain";

type DepartmentFilter =
  "all" | "active" | "overdueProjects" | "overdueTasks" | "criticalRisks";
type DrilldownFilter = DepartmentFilter | "compliance" | "audit" | "nextAction";

export function Departments({ setPage }: { setPage?: (page: string) => void }) {
  const auth = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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
  const canManageDepartments =
    !auth.isLocalBypass &&
    auth.roles.some(
      (assignment) =>
        assignment.role === "super_admin" ||
        assignment.role === "governance_admin",
    );
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
            <button
              className="primary-button"
              onClick={() => {
                setActionError(null);
                setFormOpen(true);
              }}
            >
              <Plus size={16} /> Create department
            </button>
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
    </section>
  );
}
