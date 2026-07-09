import { useMemo, useState } from "react";
import { AlertTriangle, Activity, Repeat2, ShieldAlert } from "lucide-react";
import { DataState } from "../components/DataState";
import { EmptySupabaseNotice } from "../components/EmptySupabaseNotice";
import { EntityTable } from "../components/EntityTable";
import { ModuleHeader } from "../components/ModuleHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAsyncData } from "../hooks/useAsyncData";
import {
  getOvrRepeatedCategoryAlerts,
  getOvrRiskIndicatorsByDepartment,
  getOvrRiskIndicatorSummary,
} from "../lib/grcApi";
import { humanize } from "../lib/format";
import { useI18n } from "../i18n/I18nContext";
import type {
  OvrRepeatedCategoryAlert,
  OvrRiskDepartmentIndicator,
} from "../types/domain";
import { OvrRcaCenter } from "./OvrRcaCenter";

type RiskSignalFilter = "all" | "low" | "medium" | "high" | "critical";
type RiskSortKey = "score" | "major" | "overdue" | "ovrs";

function signalTone(
  level: string,
): "normal" | "warning" | "danger" | "success" {
  if (level === "critical" || level === "high") return "danger";
  if (level === "medium") return "warning";
  if (level === "low") return "success";
  return "normal";
}

import { X } from "lucide-react";
export function OvrRiskIndicators() {
  const [departmentContext, setDepartmentContext] = useState<{
    departmentId: string;
    departmentName: string;
    metric: string;
  } | null>(null);
  const { t } = useI18n();
  const summary = useAsyncData(getOvrRiskIndicatorSummary, []);
  const departments = useAsyncData(getOvrRiskIndicatorsByDepartment, []);
  const repeated = useAsyncData(getOvrRepeatedCategoryAlerts, []);
  const [activeSignal, setActiveSignal] = useState<RiskSignalFilter>("all");
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [sortKey, setSortKey] = useState<RiskSortKey>("score");
  const [selectedDepartment, setSelectedDepartment] =
    useState<OvrRiskDepartmentIndicator | null>(null);
  const summaryRow = summary.data;
  const filteredDepartments = useMemo(() => {
    const query = departmentSearch.trim().toLowerCase();
    const rows = (departments.data || []).filter((row) => {
      const matchesSignal =
        activeSignal === "all" || row.risk_signal_level === activeSignal;
      const matchesQuery =
        !query ||
        [
          row.department_name,
          row.repeated_categories,
          row.risk_signal_level,
        ].some((value) => value?.toLowerCase().includes(query));
      return matchesSignal && matchesQuery;
    });
    return [...rows].sort((a, b) => {
      if (sortKey === "major")
        return (
          Number(b.major_or_sentinel_ovrs_90d || 0) -
          Number(a.major_or_sentinel_ovrs_90d || 0)
        );
      if (sortKey === "overdue")
        return (
          Number(b.overdue_corrective_actions || 0) -
          Number(a.overdue_corrective_actions || 0)
        );
      if (sortKey === "ovrs")
        return Number(b.ovr_count_30d || 0) - Number(a.ovr_count_30d || 0);
      return (
        Number(b.weighted_score_30d || 0) - Number(a.weighted_score_30d || 0)
      );
    });
  }, [activeSignal, departmentSearch, departments.data, sortKey]);
  const resetRiskFilters = () => {
    setActiveSignal("all");
    setDepartmentSearch("");
    setSortKey("score");
    setSelectedDepartment(null);
  };
  const selectedSignalExplanation =
    activeSignal === "critical"
      ? "Critical signals need immediate Quality leadership review."
      : activeSignal === "high"
        ? "High signals show departments with concentrated safety exposure."
        : activeSignal === "medium"
          ? "Medium signals should be monitored for recurrence or delayed action."
          : activeSignal === "low"
            ? "Low signals are stable but remain visible for trend monitoring."
            : "All department risk signals are visible.";

  return (
    <section className="page-section">
      {departmentContext && (
        <div className="department-context-banner">
          <div>
            <strong>Department Context:</strong>{" "}
            {departmentContext.departmentName} /{" "}
            {departmentContext.metric
              .replace(/([A-Z])/g, " $1")
              .trim()
              .toLowerCase()}
          </div>
          <button
            className="ghost-button small"
            onClick={() => {
              sessionStorage.removeItem("grc.departmentContext");
              setDepartmentContext(null);
              setDepartmentSearch("");
            }}
          >
            <X size={14} /> Clear
          </button>
        </div>
      )}

      <EmptySupabaseNotice />
      <ModuleHeader
        eyebrow={t("ovrRisk.eyebrow")}
        title={t("ovrRisk.title")}
        subtitle={t("ovrRisk.subtitle")}
      />

      <DataState
        loading={summary.loading}
        error={summary.error}
        empty={!summaryRow}
      >
        {summaryRow ? (
          <div className="stats-grid">
            {[
              {
                label: t("ovrRisk.total30"),
                value: summaryRow.total_ovrs_30d,
                filter: "all" as RiskSignalFilter,
                tone: "normal" as const,
              },
              {
                label: t("ovrRisk.weighted30"),
                value: summaryRow.weighted_score_30d,
                filter: summaryRow.overall_signal_level as RiskSignalFilter,
                tone: signalTone(summaryRow.overall_signal_level),
              },
              {
                label: t("ovrRisk.major90"),
                value: summaryRow.major_or_sentinel_ovrs_90d,
                filter: "critical" as RiskSignalFilter,
                tone: "danger" as const,
              },
              {
                label: t("ovrRisk.repeated30"),
                value: summaryRow.repeated_category_alerts_30d,
                filter: "high" as RiskSignalFilter,
                tone: "warning" as const,
              },
              {
                label: t("ovrRisk.overdueActions"),
                value: summaryRow.overdue_corrective_actions,
                filter: "high" as RiskSignalFilter,
                tone: "danger" as const,
              },
              {
                label: t("ovrRisk.openOvr"),
                value: summaryRow.open_ovrs,
                filter: "medium" as RiskSignalFilter,
                tone: "warning" as const,
              },
            ].map((card) => (
              <button
                key={card.label}
                type="button"
                className={`stat-card ${card.tone} ${activeSignal === card.filter ? "active" : ""}`}
                onClick={() => setActiveSignal(card.filter)}
              >
                <div className="stat-value">{card.value}</div>
                <div className="stat-label">{card.label}</div>
              </button>
            ))}
          </div>
        ) : null}
      </DataState>

      <div className="panel">
        <div className="split-header">
          <div className="panel-header">
            <h4>Risk signal filters</h4>
            <p>
              {selectedSignalExplanation} Showing {filteredDepartments.length}{" "}
              of {(departments.data || []).length} departments.
            </p>
          </div>
          <button
            className="ghost-button"
            type="button"
            onClick={resetRiskFilters}
          >
            Reset filters
          </button>
        </div>
        <div className="toolbar">
          {(
            ["all", "low", "medium", "high", "critical"] as RiskSignalFilter[]
          ).map((signal) => (
            <button
              key={signal}
              type="button"
              className={`ghost-button small ${activeSignal === signal ? "active" : ""}`}
              onClick={() => setActiveSignal(signal)}
            >
              {humanize(signal)}
            </button>
          ))}
          <input
            value={departmentSearch}
            onChange={(event) => setDepartmentSearch(event.target.value)}
            placeholder="Search department or repeated category"
          />
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as RiskSortKey)}
          >
            <option value="score">Sort by score</option>
            <option value="major">Sort by major count</option>
            <option value="overdue">Sort by overdue CA</option>
            <option value="ovrs">Sort by OVRs 30D</option>
          </select>
        </div>
      </div>

      <div className="panel ovr-risk-explainer">
        <div className="panel-header">
          <h4>
            <Activity size={18} /> {t("ovrRisk.logicTitle")}
          </h4>
          <p>{t("ovrRisk.logicText")}</p>
        </div>
        <div className="module-grid">
          <div className="module-card danger">
            <strong>
              <ShieldAlert size={18} /> {t("ovrRisk.signalSeverity")}
            </strong>
            <span>{t("ovrRisk.signalSeverityText")}</span>
          </div>
          <div className="module-card warning">
            <strong>
              <Repeat2 size={18} /> {t("ovrRisk.signalRecurrence")}
            </strong>
            <span>{t("ovrRisk.signalRecurrenceText")}</span>
          </div>
          <div className="module-card warning">
            <strong>
              <AlertTriangle size={18} /> {t("ovrRisk.signalDelay")}
            </strong>
            <span>{t("ovrRisk.signalDelayText")}</span>
          </div>
          <div className="module-card">
            <strong>{t("ovrRisk.signalDepartment")}</strong>
            <span>{t("ovrRisk.signalDepartmentText")}</span>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4>{t("ovrRisk.departmentTable")}</h4>
          <p>{t("ovrRisk.departmentHint")}</p>
        </div>
        <DataState
          loading={departments.loading}
          error={departments.error}
          empty={!filteredDepartments.length}
          emptyTitle="No department risk records match the selected filter"
          emptyMessage="Reset filters or broaden the search to review all department risk signals."
        >
          <EntityTable<OvrRiskDepartmentIndicator>
            rows={filteredDepartments}
            getRowKey={(row) => row.department_id || "company-wide"}
            columns={[
              {
                key: "department",
                header: t("common.department"),
                render: (row) => (
                  <button
                    className="link-button"
                    type="button"
                    onClick={() => setSelectedDepartment(row)}
                  >
                    <strong>{row.department_name}</strong>
                  </button>
                ),
              },
              {
                key: "count30",
                header: t("ovrRisk.ovrs30"),
                render: (row) => row.ovr_count_30d,
              },
              {
                key: "score30",
                header: t("ovrRisk.score30"),
                render: (row) => row.weighted_score_30d,
              },
              {
                key: "major90",
                header: t("ovrRisk.major90Short"),
                render: (row) => row.major_or_sentinel_ovrs_90d || "0",
              },
              {
                key: "repeated",
                header: t("ovrRisk.repeatedCategories"),
                render: (row) => row.repeated_categories || "—",
              },
              {
                key: "overdue",
                header: t("ovrRisk.overdueActionsShort"),
                render: (row) =>
                  row.overdue_corrective_actions ? (
                    <span className="danger-text">
                      {row.overdue_corrective_actions}
                    </span>
                  ) : (
                    "0"
                  ),
              },
              {
                key: "closure",
                header: t("ovrRisk.avgClosure"),
                render: (row) =>
                  row.avg_closure_days === null
                    ? "—"
                    : `${row.avg_closure_days}d`,
              },
              {
                key: "signal",
                header: t("ovrRisk.signal"),
                render: (row) => (
                  <span className={`risk-pill ${row.risk_signal_level}`}>
                    {humanize(row.risk_signal_level)}
                  </span>
                ),
              },
            ]}
          />
        </DataState>
        {selectedDepartment ? (
          <div className="detail-panel">
            <div className="split-header">
              <div>
                <h4>Selected department risk details</h4>
                <p>
                  {selectedDepartment.department_name} ·{" "}
                  {humanize(selectedDepartment.risk_signal_level)}
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
            <div className="detail-grid">
              <div>
                <span>{t("ovrRisk.ovrs30")}</span>
                <strong>{selectedDepartment.ovr_count_30d}</strong>
              </div>
              <div>
                <span>{t("ovrRisk.score30")}</span>
                <strong>{selectedDepartment.weighted_score_30d}</strong>
              </div>
              <div>
                <span>{t("ovrRisk.major90Short")}</span>
                <strong>
                  {selectedDepartment.major_or_sentinel_ovrs_90d || 0}
                </strong>
              </div>
              <div>
                <span>{t("ovrRisk.overdueActionsShort")}</span>
                <strong>
                  {selectedDepartment.overdue_corrective_actions || 0}
                </strong>
              </div>
              <div>
                <span>{t("ovrRisk.repeatedCategories")}</span>
                <strong>
                  {selectedDepartment.repeated_categories ||
                    "No repeated category currently recorded."}
                </strong>
              </div>
              <div>
                <span>Why this matters</span>
                <strong>{selectedSignalExplanation}</strong>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4>{t("ovrRisk.repeatAlerts")}</h4>
          <p>{t("ovrRisk.repeatHint")}</p>
        </div>
        <DataState
          loading={repeated.loading}
          error={repeated.error}
          empty={!repeated.data?.length}
        >
          <EntityTable<OvrRepeatedCategoryAlert>
            rows={repeated.data || []}
            getRowKey={(row) =>
              `${row.department_id || "company"}-${row.occurrence_category}`
            }
            columns={[
              {
                key: "department",
                header: t("common.department"),
                render: (row) => row.department_name,
              },
              {
                key: "category",
                header: t("ovrRisk.category"),
                render: (row) => humanize(row.occurrence_category),
              },
              {
                key: "count",
                header: t("ovrRisk.count30"),
                render: (row) => row.category_count_30d,
              },
              {
                key: "maxSeverity",
                header: t("ovrRisk.maxSeverity"),
                render: (row) => (
                  <StatusBadge status={humanize(row.max_severity_level)} />
                ),
              },
              {
                key: "signal",
                header: t("ovrRisk.signal"),
                render: (row) => (
                  <span className={`risk-pill ${row.alert_level}`}>
                    {humanize(row.alert_level)}
                  </span>
                ),
              },
            ]}
          />
        </DataState>
      </div>

      <div className="mt-8">
        <OvrRcaCenter />
      </div>
    </section>
  );
}
