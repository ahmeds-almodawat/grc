import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Building2,
  CheckCircle2,
  Download,
  Eye,
  FileDown,
  FileUp,
  KeyRound,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  UploadCloud,
  UserCog,
  Users,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { DataState } from "../components/DataState";
import { Modal } from "../components/Modal";
import { KpiTile, ModernCard, StatusPill } from "../components/ModernCard";
import { isPatch83tUserExcelImportEnabled } from "../config/featureFlags";
import { useI18n } from "../i18n/I18nContext";
import { humanize } from "../lib/format";
import {
  getLiveResultMessage,
  isLive,
  type LiveResult,
} from "../lib/liveResult";
import {
  applyImportBatch,
  USER_IMPORT_EXECUTION_CONFIRMATION,
  archiveUser,
  deactivateUser,
  getUserManagementDepartments,
  getUserManagementSummary,
  getUserManagementUser,
  listUsersWithFilters,
  readAuditHistory,
  reactivateUser,
  unarchiveUser,
  updateUserDepartment,
  updateUserProfile,
  updateUserRole,
  userRoleOptions,
  userStatusOptions,
  userTypeOptions,
  validateImportRows,
  type DepartmentLookup,
  type UserImportValidationResult,
  type UserManagementAuditRow,
  type UserManagementSummary,
  type UserManagementUserRow,
  type UserStatus,
  type UserType,
} from "../lib/userManagementApi";
import {
  adminResetPassword,
  ADMIN_RESET_CONFIRMATION_TEXT,
  listProvisioning,
  provisionAccount,
  reconcileCredentialState,
  reconcileProvisioning,
  type UserProvisioningRow,
} from "../lib/userCredentialApi";
import { PrivilegedActionError } from "../lib/privilegedAction";
import {
  createPatch83tUserImportCapabilitySingleFlight,
  getPatch83tUserImportCapabilities,
  isPatch83tDeploymentCompatibilityError,
  isPatch83tUserImportCapabilityCompatible,
  PATCH83T_USER_IMPORT_DEPLOYMENT_MESSAGE,
  PATCH83T_USER_IMPORT_FEATURE_DISABLED_MESSAGE,
  type Patch83tUserImportCapabilities,
} from "../lib/userImportCompatibility";
import type { AccessScope, AppRole } from "../types/domain";
import {
  createUserImportTemplate,
  createUserRosterWorkbook,
  createUserValidationErrorsWorkbook,
  parseUserWorkbook,
} from "../utils/userWorkbook";

type LifecycleAction = "deactivate" | "reactivate" | "archive" | "unarchive";
type ImportCompatibilityStatus =
  | "disabled"
  | "checking"
  | "compatible"
  | "incompatible";

const emptySummary: LiveResult<UserManagementSummary> = {
  status: "empty",
  data: null,
  source: "system",
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: "No user management summary loaded yet.",
};

const emptyUsers: LiveResult<UserManagementUserRow[]> = {
  status: "empty",
  data: null,
  source: "system",
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: "No user roster loaded yet.",
};

const emptyDepartments: LiveResult<DepartmentLookup[]> = {
  status: "empty",
  data: null,
  source: "system",
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: "No departments loaded yet.",
};

function statusTone(
  status?: string | null,
): "neutral" | "good" | "warning" | "danger" {
  if (!status) return "neutral";
  if (status === "active") return "good";
  if (status === "archived" || status === "inactive" || status === "locked")
    return "danger";
  if (status === "invited") return "warning";
  return "neutral";
}

function roleSummary(user: UserManagementUserRow): string {
  const roles = user.roles?.filter((role) => role.is_active) ?? [];
  return roles.length
    ? roles.map((role) => humanize(role.role)).join(", ")
    : "No active role";
}

function activeRoleTotal(user: UserManagementUserRow): number {
  const activeRoles = user.roles?.filter((role) => role.is_active).length ?? 0;
  return Math.max(user.active_role_count ?? 0, activeRoles);
}

export function isPostPasswordRoleActivationRecoveryCandidate(
  row: UserProvisioningRow,
  user: UserManagementUserRow | null | undefined,
  organizationId: string | null | undefined,
): boolean {
  if (!user || !organizationId) return false;
  const matchingRoles = user.roles.filter((role) =>
    role.role === "employee" &&
    role.scope === "assigned_only" &&
    role.organization_id === organizationId &&
    role.division_id === null &&
    role.department_id === null &&
    role.unit_id === null,
  );

  return row.provisioning_status === "initial_change_required" &&
    row.requested_role === "employee" &&
    row.requested_scope === "assigned_only" &&
    row.requested_lifecycle === "active" &&
    row.profile_id === user.user_id &&
    row.employee_id === user.employee_no &&
    row.auth_email === user.auth_email &&
    row.last_error_code === null &&
    row.last_error_message === null &&
    user.organization_id === organizationId &&
    user.user_status === "invited" &&
    user.is_active === true &&
    user.credential_proof_available === true &&
    user.credential_state === "active" &&
    Number.isInteger(user.credential_version) &&
    Number(user.credential_version) >= 1 &&
    user.must_change_password === false &&
    user.provisioning_state === "initial_change_required" &&
    activeRoleTotal(user) === 0 &&
    matchingRoles.length === 1 &&
    matchingRoles[0].is_active === false;
}

function linkedRecordCount(user: UserManagementUserRow): number {
  return (
    user.linked_project_count +
    user.linked_task_count +
    user.linked_approval_count +
    user.linked_evidence_count
  );
}

function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function xlsxBlob(content: ArrayBuffer) {
  return new Blob([content], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  return `${(size / 1024).toFixed(size < 1024 * 100 ? 1 : 0)} KB`;
}

function nowFileStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function patch83uRequestId(action: string) {
  return `patch83u:${action}:${crypto.randomUUID()}`;
}

export function UserManagementCenter() {
  const auth = useAuth();
  const { language, direction, t } = useI18n();
  const [summary, setSummary] =
    useState<LiveResult<UserManagementSummary>>(emptySummary);
  const [users, setUsers] =
    useState<LiveResult<UserManagementUserRow[]>>(emptyUsers);
  const [departments, setDepartments] =
    useState<LiveResult<DepartmentLookup[]>>(emptyDepartments);
  const [auditRows, setAuditRows] = useState<UserManagementAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "all" | "missing">(
    "all",
  );
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<UserType | "all">("all");
  const [missingDepartment, setMissingDepartment] = useState(false);
  const [missingRole, setMissingRole] = useState(false);
  const [neverLoggedIn, setNeverLoggedIn] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [actionMenuUser, setActionMenuUser] =
    useState<UserManagementUserRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailUser, setDetailUser] = useState<UserManagementUserRow | null>(
    null,
  );
  const [editUser, setEditUser] = useState<UserManagementUserRow | null>(null);
  const [departmentUser, setDepartmentUser] =
    useState<UserManagementUserRow | null>(null);
  const [roleUser, setRoleUser] = useState<UserManagementUserRow | null>(null);
  const [lifecycle, setLifecycle] = useState<{
    action: LifecycleAction;
    users: UserManagementUserRow[];
  } | null>(null);
  const [reason, setReason] = useState("");
  const [profileDraft, setProfileDraft] = useState({
    fullNameEn: "",
    fullNameAr: "",
    employeeNo: "",
    contactEmail: "",
    phone: "",
    jobTitle: "",
    userType: "employee" as UserType,
  });
  const [departmentDraft, setDepartmentDraft] = useState("");
  const [roleDraft, setRoleDraft] = useState<AppRole>("employee");
  const [scopeDraft, setScopeDraft] = useState<AccessScope>("assigned_only");
  const [roleDepartmentDraft, setRoleDepartmentDraft] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<{ name: string; size: number } | null>(null);
  const [importParseError, setImportParseError] = useState<string | null>(null);
  const [importParsing, setImportParsing] = useState(false);
  const [importValidation, setImportValidation] =
    useState<UserImportValidationResult | null>(null);
  const [importConfirmation, setImportConfirmation] = useState("");
  const [importCompatibilityStatus, setImportCompatibilityStatus] =
    useState<ImportCompatibilityStatus>("disabled");
  const [importCapabilities, setImportCapabilities] =
    useState<Patch83tUserImportCapabilities | null>(null);
  const [importCompatibilityMessage, setImportCompatibilityMessage] =
    useState<string | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const importSelectedFileRef = useRef<File | null>(null);
  const importSelectionId = useRef(0);
  const importCompatibilityGeneration = useRef(0);
  const importCapabilityCheckRef = useRef<
    ReturnType<typeof createPatch83tUserImportCapabilitySingleFlight> | null
  >(null);
  if (!importCapabilityCheckRef.current) {
    importCapabilityCheckRef.current =
      createPatch83tUserImportCapabilitySingleFlight(
        getPatch83tUserImportCapabilities,
      );
  }
  const [provisioningOpen, setProvisioningOpen] = useState(false);
  const [provisioningLoading, setProvisioningLoading] = useState(false);
  const [provisioningRows, setProvisioningRows] = useState<UserProvisioningRow[]>([]);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const [provisioningTarget, setProvisioningTarget] = useState<{
    row: UserProvisioningRow;
    action: "provision" | "reconcile";
  } | null>(null);
  const [provisioningConfirmation, setProvisioningConfirmation] = useState("");
  const [provisioningRequestId, setProvisioningRequestId] = useState("");
  const [resetUser, setResetUser] = useState<UserManagementUserRow | null>(null);
  const [resetRequestId, setResetRequestId] = useState("");
  const [credentialReconcileUser, setCredentialReconcileUser] = useState<UserManagementUserRow | null>(null);
  const [credentialReconcileConfirmation, setCredentialReconcileConfirmation] = useState("");
  const [credentialReconcileRequestId, setCredentialReconcileRequestId] = useState("");
  const [resetDraft, setResetDraft] = useState({
    temporaryPassword: "",
    confirmPassword: "",
    employeeIdConfirmation: "",
    resetConfirmation: "",
    reason: "",
  });
  const [bulkDepartment, setBulkDepartment] = useState("");
  const [bulkRole, setBulkRole] = useState<AppRole>("employee");

  const canonicalGlobalAdminRoles = auth.roles.filter((role) =>
    ["super_admin", "governance_admin"].includes(role.role) &&
    role.scope === "global" &&
    (role.organizationId === null ||
      role.organizationId === auth.profile?.organizationId) &&
    !role.divisionId &&
    !role.departmentId &&
    !role.unitId,
  );
  const canModify = Boolean(auth.isLocalBypass) || canonicalGlobalAdminRoles.length > 0;
  const readOnly =
    !canModify ||
    (auth.roles.some((role) => ["auditor", "viewer"].includes(role.role)) &&
      canonicalGlobalAdminRoles.length === 0);
  const hasAuthorizedImportRole =
    !auth.isLocalBypass &&
    Boolean(auth.profile?.organizationId) &&
    canonicalGlobalAdminRoles.length > 0;
  const userImportFeatureEnabled = isPatch83tUserExcelImportEnabled();
  const importUploadDisabled =
    !userImportFeatureEnabled
    || importCompatibilityStatus !== "compatible"
    || importParsing;
  const importUploadStateDescriptionId = importParsing
    ? "user-workbook-parsing-status"
    : importCompatibilityStatus === "compatible"
      ? null
      : "user-workbook-compatibility-status";
  const importUploadDescribedBy = [
    "user-workbook-input-description",
    importUploadStateDescriptionId,
  ].filter(Boolean).join(" ");
  const hasAuthorizedSuperAdmin =
    !auth.isLocalBypass &&
    Boolean(auth.session?.user.id) &&
    Boolean(auth.profile?.organizationId) &&
    auth.roles.some((role) =>
      role.role === "super_admin" &&
      role.scope === "global" &&
      (role.organizationId === null ||
        role.organizationId === auth.profile?.organizationId) &&
      !role.divisionId &&
      !role.departmentId &&
      !role.unitId,
    );
  const patch83uRuntimeEnforced =
    auth.patch83uCapabilities?.runtime_enforcement_state === "enforced";
  const patch83uProvisioningAvailable = Boolean(
    patch83uRuntimeEnforced &&
    auth.patch83uCapabilities?.provisioning_action_available,
  );
  const patch83uResetAvailable = Boolean(
    patch83uRuntimeEnforced &&
    auth.patch83uCapabilities?.reset_action_available,
  );
  const canUsePatch83uProvisioning =
    hasAuthorizedSuperAdmin && patch83uProvisioningAvailable;
  const canUsePatch83uReset = hasAuthorizedSuperAdmin && patch83uResetAvailable;
  const resetReasonContainsTemporaryPassword = Boolean(
    resetDraft.temporaryPassword
    && resetDraft.reason.includes(resetDraft.temporaryPassword),
  );

  const rosterFilters = {
    search,
    departmentId: departmentFilter,
    role: roleFilter,
    status: statusFilter,
    userType: typeFilter,
    missingDepartment,
    missingRole,
    neverLoggedIn,
    page,
    pageSize,
  };

  const loadRoster = async () => {
    setLoading(true);
    setActionError(null);
    const usersResult = await listUsersWithFilters(rosterFilters);
    setUsers(usersResult);
    setLoading(false);
  };

  const loadReferences = async () => {
    const [summaryResult, departmentResult] = await Promise.all([
      getUserManagementSummary(),
      getUserManagementDepartments(),
    ]);
    setSummary(summaryResult);
    setDepartments(departmentResult);
  };

  const load = async () => {
    await Promise.all([loadRoster(), loadReferences()]);
  };

  const refreshAffectedRows = async (userIds: string[]) => {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    if (!uniqueUserIds.length || uniqueUserIds.length > 10) {
      await load();
      return;
    }
    const [freshRows, summaryResult] = await Promise.all([
      Promise.all(uniqueUserIds.map(userId => getUserManagementUser(userId))),
      getUserManagementSummary(),
    ]);
    if (freshRows.some(row => !row)) {
      await load();
      return;
    }
    const replacements = new Map(freshRows.filter(Boolean).map(row => [row!.user_id, row!]));
    setUsers(current => isLive(current)
      ? { ...current, data: current.data.map(row => replacements.get(row.user_id) ?? row), generatedAt: new Date().toISOString() }
      : current);
    setSummary(summaryResult);
  };

  useEffect(() => {
    void loadReferences();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRoster(), search.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [search, departmentFilter, roleFilter, statusFilter, typeFilter, missingDepartment, missingRole, neverLoggedIn, page]);

  useEffect(() => {
    setPage(1);
  }, [search, departmentFilter, roleFilter, statusFilter, typeFilter, missingDepartment, missingRole, neverLoggedIn]);

  const userRows = isLive(users) ? users.data : [];
  const departmentRows = isLive(departments) ? departments.data : [];
  const summaryData = isLive(summary) ? summary.data : null;
  const blockedLifecycleCount =
    (summaryData?.inactive_users ?? 0) +
    (summaryData?.archived_users ?? 0) +
    (summaryData?.locked_users ?? 0);
  const compatibilityMode = [summary.message, users.message].some((item) =>
    item?.includes("existing People/profiles"),
  );
  const writeDisabled = readOnly;

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return userRows.filter((user) => {
      const roleNames = roleSummary(user).toLowerCase();
      const inCurrentDepartment =
        !auth.roles.some((role) => role.role === "department_manager") ||
        canModify ||
        !auth.profile?.departmentId ||
        user.department_id === auth.profile.departmentId;
      const matchesSearch =
        !query ||
        [
          user.full_name_en,
          user.full_name_ar,
          user.email,
          user.auth_email,
          user.contact_email,
          user.phone,
          user.synthetic_auth_email,
          user.employee_no,
          user.department_name,
          user.job_title,
          roleNames,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesDepartment =
        !departmentFilter || user.department_id === departmentFilter;
      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "missing"
          ? activeRoleTotal(user) === 0
          : user.roles?.some(
              (role) => role.is_active && role.role === roleFilter,
            ));
      const matchesStatus =
        statusFilter === "all" || user.user_status === statusFilter;
      const matchesType = typeFilter === "all" || user.user_type === typeFilter;
      return (
        inCurrentDepartment &&
        matchesSearch &&
        matchesDepartment &&
        matchesRole &&
        matchesStatus &&
        matchesType &&
        (!missingDepartment || !user.department_id) &&
        (!missingRole || activeRoleTotal(user) === 0) &&
        (!neverLoggedIn || !user.last_login_at)
      );
    });
  }, [
    auth.profile?.departmentId,
    auth.roles,
    canModify,
    departmentFilter,
    missingDepartment,
    missingRole,
    neverLoggedIn,
    roleFilter,
    search,
    statusFilter,
    typeFilter,
    userRows,
  ]);

  const selectedUsers = visibleUsers.filter((user) =>
    selectedIds.has(user.user_id),
  );
  const visibleUserIds = visibleUsers.map((user) => user.user_id);
  const allVisibleSelected =
    visibleUserIds.length > 0 &&
    visibleUserIds.every((userId) => selectedIds.has(userId));

  const toggleSelected = (userId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (allVisibleSelected)
        visibleUserIds.forEach((userId) => next.delete(userId));
      else visibleUserIds.forEach((userId) => next.add(userId));
      return next;
    });
  };

  const openDetails = async (user: UserManagementUserRow) => {
    setDetailUser(user);
    const result = await readAuditHistory(user.user_id);
    setAuditRows(isLive(result) ? result.data : []);
  };

  const openEdit = (user: UserManagementUserRow) => {
    setProfileDraft({
      fullNameEn: user.full_name_en,
      fullNameAr: user.full_name_ar ?? "",
      employeeNo: user.employee_no ?? "",
      contactEmail: user.contact_email ?? "",
      phone: user.phone ?? "",
      jobTitle: user.job_title ?? "",
      userType: user.user_type,
    });
    setReason("Routine profile maintenance");
    setEditUser(user);
  };

  const openDepartment = (user: UserManagementUserRow) => {
    setDepartmentDraft(user.department_id ?? "");
    setReason("Department assignment review");
    setDepartmentUser(user);
  };

  const openRole = (user: UserManagementUserRow) => {
    const activeRole = user.roles?.find((role) => role.is_active);
    setRoleDraft(activeRole?.role ?? "employee");
    setScopeDraft(activeRole?.scope ?? "assigned_only");
    setRoleDepartmentDraft(
      activeRole?.department_id ?? user.department_id ?? "",
    );
    setReason("Role assignment review");
    setRoleUser(user);
  };

  const runAction = async (
    operation: () => Promise<void>,
    success: string,
    affectedUserIds: string[] = [],
  ): Promise<boolean> => {
    setSaving(true);
    setActionError(null);
    setMessage(null);
    try {
      await operation();
      setMessage(success);
      await refreshAffectedRows(affectedUserIds);
      return true;
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "User management action failed.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitProfile = async () => {
    if (!editUser) return;
    const saved = await runAction(
      () =>
        updateUserProfile({
          userId: editUser.user_id,
          fullNameEn: profileDraft.fullNameEn,
          fullNameAr: profileDraft.fullNameAr,
          employeeNo: profileDraft.employeeNo,
          contactEmail: profileDraft.contactEmail,
          phone: profileDraft.phone,
          jobTitle: profileDraft.jobTitle,
          userType: profileDraft.userType,
          reason,
        }),
      "Profile updated.",
      [editUser.user_id],
    );
    if (saved) setEditUser(null);
  };

  const submitDepartment = async () => {
    const targets = departmentUser ? [departmentUser] : selectedUsers;
    if (!targets.length) {
      setActionError("Select at least one user.");
      return;
    }
    const saved = await runAction(
      async () => {
        await Promise.all(
          targets.map((user) =>
            updateUserDepartment({
              userId: user.user_id,
              departmentId: departmentDraft || null,
              reason,
            }),
          ),
        );
      },
      `${targets.length} department assignment${targets.length === 1 ? "" : "s"} updated.`,
      targets.map(user => user.user_id),
    );
    if (saved) setDepartmentUser(null);
  };

  const submitRole = async () => {
    const targets = roleUser ? [roleUser] : selectedUsers;
    if (!targets.length) {
      setActionError("Select at least one user.");
      return;
    }
    const saved = await runAction(
      async () => {
        await Promise.all(
          targets.map((user) =>
            updateUserRole({
              userId: user.user_id,
              role: roleDraft,
              scope: scopeDraft,
              departmentId:
                scopeDraft === "department"
                  ? roleDepartmentDraft || user.department_id
                  : null,
              reason,
            }),
          ),
        );
      },
      `${targets.length} role assignment${targets.length === 1 ? "" : "s"} updated.`,
      targets.map(user => user.user_id),
    );
    if (saved) setRoleUser(null);
  };

  const submitLifecycle = async () => {
    if (!lifecycle || !reason.trim()) {
      setActionError("A reason is required before changing user status.");
      return;
    }
    const action = lifecycle.action;
    const targets = lifecycle.users;
    const actionMap: Record<
      LifecycleAction,
      (user: UserManagementUserRow, reasonText: string) => Promise<void>
    > = {
      deactivate: (user, reasonText) =>
        deactivateUser(user.user_id, reasonText, user.roles),
      reactivate: (user, reasonText) =>
        reactivateUser(user.user_id, reasonText),
      archive: (user, reasonText) =>
        archiveUser(user.user_id, reasonText, user.roles),
      unarchive: (user, reasonText) => unarchiveUser(user.user_id, reasonText),
    };
    const saved = await runAction(
      async () => {
        await Promise.all(
          targets.map((user) => actionMap[action](user, reason)),
        );
      },
      `${targets.length} user${targets.length === 1 ? "" : "s"} ${action}d.`,
      targets.map(user => user.user_id),
    );
    if (saved) {
      setLifecycle(null);
      setReason("");
    }
  };

  const loadProvisioningQueue = async () => {
    if (!canUsePatch83uProvisioning) {
      setProvisioningError(
        t("userManagement.provisioningQueue.unavailableError"),
      );
      return;
    }
    setProvisioningLoading(true);
    setProvisioningError(null);
    try {
      const result = await listProvisioning();
      setProvisioningRows(result.rows);
    } catch (error) {
      setProvisioningRows([]);
      setProvisioningError(
        error instanceof Error
          ? error.message
          : t("userManagement.provisioningQueue.loadError"),
      );
    } finally {
      setProvisioningLoading(false);
    }
  };

  const openProvisioningQueue = () => {
    if (!canUsePatch83uProvisioning) return;
    setProvisioningOpen(true);
    setProvisioningTarget(null);
    setProvisioningConfirmation("");
    setProvisioningRequestId("");
    void loadProvisioningQueue();
  };

  const chooseProvisioningAction = (
    row: UserProvisioningRow,
    action: "provision" | "reconcile",
  ) => {
    setProvisioningTarget({ row, action });
    setProvisioningConfirmation("");
    setProvisioningRequestId(patch83uRequestId(action));
    setProvisioningError(null);
  };

  const submitProvisioningAction = async () => {
    if (!provisioningTarget || !canUsePatch83uProvisioning) return;
    const { row, action } = provisioningTarget;
    if (provisioningConfirmation !== row.employee_id) {
      setProvisioningError(
        t("userManagement.provisioningQueue.exactEmployeeIdError"),
      );
      return;
    }
    setSaving(true);
    setProvisioningError(null);
    try {
      const command = {
        provisioningId: row.id,
        employeeIdConfirmation: provisioningConfirmation,
        requestId: provisioningRequestId,
      };
      if (action === "provision") {
        const result = await provisionAccount(command);
        setMessage(
          `Account provisioning completed for ${row.employee_id}. Profile ${result.profileId} requires a first-login password change.`,
        );
      } else {
        const result = await reconcileProvisioning(command);
        setMessage(`Provisioning reconciliation for ${row.employee_id}: ${result.outcome}.`);
      }
      setProvisioningTarget(null);
      setProvisioningConfirmation("");
      setProvisioningRequestId("");
      await Promise.all([loadProvisioningQueue(), load()]);
    } catch (error) {
      setProvisioningError(
        error instanceof Error ? error.message : "The controlled provisioning action failed.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openPasswordReset = (user: UserManagementUserRow) => {
    if (!canUsePatch83uReset) {
      setActionError("Password reset is unavailable until credential governance is fully enforced.");
      return;
    }
    if (
      !user.credential_proof_available
      || !user.auth_email
      || !['employee_id_managed', 'legacy_verified'].includes(user.identity_mode ?? '')
    ) {
      setActionError("Verified credential identity is unavailable. Reset is blocked until the protected credential roster is restored.");
      return;
    }
    setResetUser(user);
    setResetRequestId(patch83uRequestId("admin-reset"));
    setResetDraft({
      temporaryPassword: user.employee_no ?? "",
      confirmPassword: user.employee_no ?? "",
      employeeIdConfirmation: "",
      resetConfirmation: "",
      reason: "",
    });
    setActionError(null);
  };

  const closePasswordReset = () => {
    setResetUser(null);
    setResetRequestId("");
    setResetDraft({
      temporaryPassword: "",
      confirmPassword: "",
      employeeIdConfirmation: "",
      resetConfirmation: "",
      reason: "",
    });
  };

  const submitPasswordReset = async () => {
    if (!resetUser || !canUsePatch83uReset) return;
    if (!resetUser.employee_no) {
      setActionError("This user has no Employee ID. Resolve the identity record before resetting credentials.");
      return;
    }
    if (
      !resetUser.credential_proof_available
      || !resetUser.auth_email
      || !['employee_id_managed', 'legacy_verified'].includes(resetUser.identity_mode ?? '')
    ) {
      setActionError("Verified credential identity is unavailable. Password reset is blocked.");
      return;
    }
    if (resetDraft.employeeIdConfirmation !== resetUser.employee_no) {
      setActionError("Type the target Employee ID exactly before resetting the password.");
      return;
    }
    if (resetDraft.temporaryPassword !== resetDraft.confirmPassword) {
      setActionError("Temporary password confirmation does not match.");
      return;
    }
    if (
      !resetDraft.temporaryPassword
      || resetDraft.temporaryPassword !== resetDraft.temporaryPassword.trim()
      || resetDraft.temporaryPassword.length > 256
    ) {
      setActionError("Enter a non-empty temporary password without surrounding whitespace.");
      return;
    }
    if (resetDraft.resetConfirmation !== ADMIN_RESET_CONFIRMATION_TEXT) {
      setActionError(`Type ${ADMIN_RESET_CONFIRMATION_TEXT} exactly before resetting the password.`);
      return;
    }
    if (!resetDraft.reason.trim() || resetDraft.reason.trim().length > 500) {
      setActionError("A reset reason of 1-500 characters is required.");
      return;
    }
    if (resetReasonContainsTemporaryPassword) {
      setActionError("Enter a reset reason that contains no credential material.");
      return;
    }
    setSaving(true);
    setActionError(null);
    setMessage(null);
    try {
      const result = await adminResetPassword({
        userId: resetUser.user_id,
        temporaryPassword: resetDraft.temporaryPassword,
        confirmTemporaryPassword: resetDraft.confirmPassword,
        employeeIdConfirmation: resetDraft.employeeIdConfirmation,
        confirmationText: resetDraft.resetConfirmation,
        reason: resetDraft.reason,
        requestId: resetRequestId,
      });
      const employeeId = resetUser.employee_no;
      closePasswordReset();
      if (result.status === "admin_reset_change_required") {
        setMessage(
          `Temporary password reset completed for ${employeeId}. Existing sessions were revoked and a password change is required at next sign-in.`,
        );
      } else if (result.status === "session_revocation_review_required") {
        setMessage(
          `The temporary password changed for ${employeeId}, but session revocation requires protected administrator review. Application access remains blocked.`,
        );
      } else {
        setMessage(
          `The password-reset operation for ${employeeId} entered protected recovery. Application access remains blocked until credential reconciliation is completed.`,
        );
      }
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The temporary password reset failed.");
      const ambiguous = error instanceof PrivilegedActionError && (
        error.retryable || [
          "PATCH83U_ADMIN_RESET_BEGIN_FAILED",
          "PATCH83U_ADMIN_RESET_FINALIZE_FAILED",
          "PATCH83U_ADMIN_RESET_FAILED",
          "PATCH83U_ADMIN_RESET_ALREADY_IN_PROGRESS",
        ].includes(error.code ?? "")
      );
      if (!ambiguous) {
        setResetRequestId(patch83uRequestId("admin-reset"));
        setResetDraft((draft) => ({
          ...draft,
          temporaryPassword: resetUser.employee_no ?? "",
          confirmPassword: resetUser.employee_no ?? "",
          employeeIdConfirmation: "",
          resetConfirmation: "",
        }));
      }
    } finally {
      setSaving(false);
    }
  };

  const openCredentialReconciliation = (user: UserManagementUserRow) => {
    if (!canUsePatch83uProvisioning) {
      setActionError("Credential reconciliation is unavailable until credential governance is fully enforced.");
      return;
    }
    if (
      !user.credential_proof_available
      || !user.auth_email
      || !['employee_id_managed', 'legacy_verified'].includes(user.identity_mode ?? '')
    ) {
      setActionError("Verified credential identity is unavailable. Reconciliation is blocked until the protected credential roster is restored.");
      return;
    }
    setCredentialReconcileUser(user);
    setCredentialReconcileConfirmation("");
    setCredentialReconcileRequestId(patch83uRequestId("credential-reconcile"));
    setActionError(null);
  };

  const closeCredentialReconciliation = () => {
    setCredentialReconcileUser(null);
    setCredentialReconcileConfirmation("");
    setCredentialReconcileRequestId("");
  };

  const submitCredentialReconciliation = async () => {
    if (!credentialReconcileUser || !canUsePatch83uProvisioning) return;
    if (
      !credentialReconcileUser.credential_proof_available
      || !credentialReconcileUser.auth_email
      || !['employee_id_managed', 'legacy_verified'].includes(credentialReconcileUser.identity_mode ?? '')
      ||
      !credentialReconcileUser.employee_no ||
      credentialReconcileConfirmation !== credentialReconcileUser.employee_no
    ) {
      setActionError("Type the target Employee ID exactly before reconciling credential state.");
      return;
    }
    setSaving(true);
    setActionError(null);
    setMessage(null);
    try {
      const result = await reconcileCredentialState({
        userId: credentialReconcileUser.user_id,
        employeeIdConfirmation: credentialReconcileConfirmation,
        requestId: credentialReconcileRequestId,
      });
      const employeeId = credentialReconcileUser.employee_no;
      closeCredentialReconciliation();
      setMessage(`Credential reconciliation for ${employeeId}: ${result.outcome}.`);
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Credential reconciliation failed.");
    } finally {
      setSaving(false);
    }
  };

  const markImportIncompatible = () => {
    // Invalidate any parser/reference result that is still in flight while
    // retaining the selected File object and its visible metadata for Retry.
    importSelectionId.current += 1;
    setImportCapabilities(null);
    setImportCompatibilityStatus("incompatible");
    setImportCompatibilityMessage(PATCH83T_USER_IMPORT_DEPLOYMENT_MESSAGE);
    setImportParseError(null);
    setImportParsing(false);
    setImportConfirmation("");
  };

  const resetImportFile = () => {
    importSelectionId.current += 1;
    importSelectedFileRef.current = null;
    setImportFile(null);
    setImportParseError(null);
    setImportParsing(false);
    setImportValidation(null);
    setImportConfirmation("");
    if (importFileInputRef.current) importFileInputRef.current.value = "";
  };

  const closeImport = () => {
    importCompatibilityGeneration.current += 1;
    setImportOpen(false);
    setImportCompatibilityStatus("disabled");
    setImportCapabilities(null);
    setImportCompatibilityMessage(null);
    resetImportFile();
  };

  const processImportFile = async (
    file: File,
    capabilityProof: Patch83tUserImportCapabilities,
  ) => {
    const selectionId = importSelectionId.current + 1;
    importSelectionId.current = selectionId;
    importSelectedFileRef.current = file;
    setImportConfirmation("");
    setImportFile({ name: file.name, size: file.size });
    setImportParseError(null);
    setImportValidation(null);
    setImportParsing(true);
    setActionError(null);
    try {
      const parsed = await parseUserWorkbook(file);
      const validation = await validateImportRows(
        parsed.rows,
        parsed.errorsByRow,
        capabilityProof,
      );
      if (selectionId !== importSelectionId.current) return;
      setImportValidation(validation);
    } catch (error) {
      if (selectionId !== importSelectionId.current) return;
      if (isPatch83tDeploymentCompatibilityError(error)) {
        markImportIncompatible();
        return;
      }
      setImportParseError(
        error instanceof Error
          ? error.message
          : "The user workbook could not be parsed.",
      );
    } finally {
      if (selectionId === importSelectionId.current) setImportParsing(false);
    }
  };

  const checkImportCompatibility = async (
    revalidateSelectedFile = false,
  ): Promise<Patch83tUserImportCapabilities | null> => {
    if (!userImportFeatureEnabled) {
      importCompatibilityGeneration.current += 1;
      setImportCapabilities(null);
      setImportCompatibilityStatus("disabled");
      setImportCompatibilityMessage(PATCH83T_USER_IMPORT_FEATURE_DISABLED_MESSAGE);
      return null;
    }
    const generation = importCompatibilityGeneration.current + 1;
    importCompatibilityGeneration.current = generation;
    setImportCompatibilityStatus("checking");
    setImportCompatibilityMessage(null);
    try {
      const capabilities = await importCapabilityCheckRef.current!();
      if (generation !== importCompatibilityGeneration.current) return null;
      if (!isPatch83tUserImportCapabilityCompatible(capabilities)) {
        markImportIncompatible();
        return null;
      }
      setImportCapabilities(capabilities);
      setImportCompatibilityStatus("compatible");
      setImportCompatibilityMessage(null);
      const selectedFile = importSelectedFileRef.current;
      if (revalidateSelectedFile && selectedFile) {
        await processImportFile(selectedFile, capabilities);
      }
      return capabilities;
    } catch {
      if (generation !== importCompatibilityGeneration.current) return null;
      markImportIncompatible();
      return null;
    }
  };

  const openImport = () => {
    setActionError(null);
    setImportOpen(true);
    if (!userImportFeatureEnabled) {
      importCompatibilityGeneration.current += 1;
      setImportCapabilities(null);
      setImportCompatibilityStatus("disabled");
      setImportCompatibilityMessage(PATCH83T_USER_IMPORT_FEATURE_DISABLED_MESSAGE);
      return;
    }
    void checkImportCompatibility();
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    const capabilityProof = importCapabilities;
    if (
      importCompatibilityStatus !== "compatible"
      || !isPatch83tUserImportCapabilityCompatible(capabilityProof)
    ) {
      return;
    }
    await processImportFile(file, capabilityProof);
  };

  const applyImport = async () => {
    if (!importValidation) return;
    const capabilityProof = importCapabilities;
    if (
      !userImportFeatureEnabled
      || importCompatibilityStatus !== "compatible"
      || !isPatch83tUserImportCapabilityCompatible(capabilityProof)
    ) {
      markImportIncompatible();
      return;
    }
    if (!hasAuthorizedImportRole) {
      setActionError(
        "User Excel Import execution requires an authenticated Super Admin or Governance Admin.",
      );
      return;
    }
    if (importConfirmation !== USER_IMPORT_EXECUTION_CONFIRMATION) {
      setActionError(
        `Type ${USER_IMPORT_EXECUTION_CONFIRMATION} exactly before executing the import.`,
      );
      return;
    }
    let databaseProofMessage = "";
    const saved = await runAction(async () => {
      const executionResult = await applyImportBatch(
        importFile?.name || "user-management-import.xlsx",
        importValidation,
        importConfirmation,
        capabilityProof,
      ).catch((error) => {
        if (isPatch83tDeploymentCompatibilityError(error)) {
          markImportIncompatible();
        }
        throw error;
      });
      const proof = executionResult.database_proof;
      databaseProofMessage = `Import batch ${executionResult.batch_id} applied with database proof: ${proof.import_row_count} import rows, ${proof.provisioning_record_count} protected provisioning records, and ${proof.audit_record_count} profile audit records. Payload SHA-256: ${proof.payload_sha256}. No account was provisioned automatically.`;
    }, "Import batch applied. Existing profiles were updated; unknown accounts were tracked for account creation.");
    if (saved) {
      if (databaseProofMessage) setMessage(databaseProofMessage);
      closeImport();
    }
  };

  const downloadUserTemplate = async () => {
    setActionError(null);
    try {
      downloadBlob(
        "user-management-import-template.xlsx",
        xlsxBlob(await createUserImportTemplate()),
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to create the Excel template.");
    }
  };

  const downloadValidationErrors = async () => {
    if (!importValidation) return;
    setActionError(null);
    try {
      downloadBlob(
        `user-import-validation-${nowFileStamp()}.xlsx`,
        xlsxBlob(await createUserValidationErrorsWorkbook(importValidation.rows)),
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to create the validation workbook.");
    }
  };

  const exportSelected = async (rows: UserManagementUserRow[]) => {
    if (!rows.length) {
      setActionError("Select at least one user to export.");
      return;
    }
    setActionError(null);
    try {
      downloadBlob(
        `user-management-${nowFileStamp()}.xlsx`,
        xlsxBlob(await createUserRosterWorkbook(rows)),
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to create the user roster workbook.");
    }
  };

  return (
    <section className="page-stack user-management-center compact-control-page">
      <section className="compact-page-header user-management-compact-header">
        <div className="compact-page-heading">
          <p className="compact-breadcrumb">
            {t('userManagement.breadcrumb')}
          </p>
          <h1>{t('userManagement.title')}</h1>
          <p className="section-subtitle">
            {t('userManagement.subtitle')}
          </p>
        </div>
        <div className="inline-actions compact-header-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={16} /> {t('userManagement.refresh')}
          </button>
          {loading && isLive(users) ? <span className="roster-refreshing" role="status">{t('userManagement.refreshing')}</span> : null}
          <button
            type="button"
            className="ghost-button"
            onClick={() => void downloadUserTemplate()}
          >
            <FileDown size={16} /> {t('userManagement.excelTemplate')}
          </button>
          {hasAuthorizedSuperAdmin && auth.patch83uCapabilities ? (
            <button
              type="button"
              className="ghost-button"
              onClick={openProvisioningQueue}
              disabled={!canUsePatch83uProvisioning}
              title={
                canUsePatch83uProvisioning
                  ? t("userManagement.provisioningQueue.openTitle")
                  : t("userManagement.provisioningQueue.unavailableTitle")
              }
            >
              <ShieldCheck size={16} />{" "}
              {t("userManagement.provisioningQueue.open")}
            </button>
          ) : null}
          <button
            type="button"
            className="primary-button"
            onClick={openImport}
            disabled={writeDisabled}
            title={
              userImportFeatureEnabled
                ? "Open the controlled User Excel Import preview"
                : PATCH83T_USER_IMPORT_FEATURE_DISABLED_MESSAGE
            }
          >
            <UploadCloud size={16} /> {t('userManagement.importExcel')}
          </button>
        </div>
      </section>

      {readOnly ? (
        <div className="notice-banner">
          Read-only mode is active for this role. User changes require Super
          Admin or Governance Admin access.
        </div>
      ) : null}
      {!userImportFeatureEnabled ? (
        <div className="notice-banner">
          {PATCH83T_USER_IMPORT_FEATURE_DISABLED_MESSAGE}
        </div>
      ) : null}
      {compatibilityMode ? (
        <div className="notice-banner">
          {t('userManagement.compatibilityNotice')}
        </div>
      ) : null}
      {blockedLifecycleCount > 0 ? (
        <div className="notice-banner">
          {blockedLifecycleCount} user account
          {blockedLifecycleCount === 1 ? "" : "s"} marked inactive, archived, or
          locked. Patch 19 keeps login recovery separate from lifecycle status;
          review assignments, workflow ownership, and signoffs before
          reactivation or reassignment.
        </div>
      ) : null}
      {message ? <div className="notice-banner">{message}</div> : null}
      {actionError ? <div className="form-error">{actionError}</div> : null}

      <DataState
        loading={loading && !summaryData}
        empty={!loading && !summaryData}
        emptyTitle="User management summary is not available"
        emptyMessage={getLiveResultMessage(summary)}
      >
        <div className="compact-kpi-row user-management-kpis">
          <article className="reference-kpi-card kpi-blue">
            <span className="reference-kpi-icon">
              <Users size={19} />
            </span>
            <span className="reference-kpi-label">{t('userManagement.totalUsers')}</span>
            <strong>{summaryData?.total_users ?? 0}</strong>
            <small>{t('userManagement.totalUsersHint')}</small>
          </article>
          <article className="reference-kpi-card kpi-green">
            <span className="reference-kpi-icon">
              <CheckCircle2 size={19} />
            </span>
            <span className="reference-kpi-label">{t('userManagement.activeUsers')}</span>
            <strong>{summaryData?.active_users ?? 0}</strong>
            <small>{t('userManagement.activeUsersHint')}</small>
          </article>
          <article className="reference-kpi-card kpi-orange">
            <span className="reference-kpi-icon">
              <AlertTriangle size={19} />
            </span>
            <span className="reference-kpi-label">{t('userManagement.inactiveUsers')}</span>
            <strong>{summaryData?.inactive_users ?? 0}</strong>
            <small>{t('userManagement.inactiveUsersHint')}</small>
          </article>
          <article className="reference-kpi-card kpi-purple">
            <span className="reference-kpi-icon">
              <Building2 size={19} />
            </span>
            <span className="reference-kpi-label">{t('userManagement.withoutDepartment')}</span>
            <strong>{summaryData?.missing_department_users ?? 0}</strong>
            <small>{t('userManagement.withoutDepartmentHint')}</small>
          </article>
          <article className="reference-kpi-card kpi-red">
            <span className="reference-kpi-icon">
              <ShieldCheck size={19} />
            </span>
            <span className="reference-kpi-label">{t('userManagement.withoutRole')}</span>
            <strong>{summaryData?.missing_role_users ?? 0}</strong>
            <small>{t('userManagement.withoutRoleHint')}</small>
          </article>
        </div>
      </DataState>

      <section className="compact-filters-container" aria-label={t('userManagement.filters')}>
        <button
          className="compact-filters-toggle"
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
        >
          <span>
            <strong>{t('userManagement.filters')}</strong>
            <small>{t('userManagement.filtersHint')}</small>
          </span>
          <span className="compact-filter-count">
            {visibleUsers.length} {t('userManagement.shown')}
          </span>
        </button>
        {filtersOpen ? (
          <div className="compact-filters-grid">
            <label className="field">
              {t('common.search')}
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('userManagement.searchPlaceholder')}
              />
            </label>
            <label className="field">
              {t('common.department')}
              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
              >
                <option value="">{t('userManagement.allDepartments')}</option>
                {departmentRows.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name_en}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              {t('userManagement.role')}
              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(
                    event.target.value as AppRole | "all" | "missing",
                  )
                }
              >
                <option value="all">{t('userManagement.allRoles')}</option>
                <option value="missing">{t('userManagement.missingRole')}</option>
                {userRoleOptions.map((role) => (
                  <option key={role} value={role}>
                    {t(`role.${role}`, humanize(role))}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              {t('common.status')}
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as UserStatus | "all")
                }
              >
                <option value="all">{t('userManagement.allStatuses')}</option>
                {userStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {t(`status.${status}`, humanize(status))}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              {t('userManagement.userType')}
              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value as UserType | "all")
                }
              >
                <option value="all">{t('userManagement.allTypes')}</option>
                {userTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {humanize(type)}
                  </option>
                ))}
              </select>
            </label>
            <div className="field checkbox-field compact-checkboxes">
              <label>
                <input
                  type="checkbox"
                  checked={missingDepartment}
                  onChange={(event) =>
                    setMissingDepartment(event.target.checked)
                  }
                />{" "}
                {t('userManagement.missingDepartment')}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={missingRole}
                  onChange={(event) => setMissingRole(event.target.checked)}
                />{" "}
                {t('userManagement.missingRole')}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={neverLoggedIn}
                  onChange={(event) => setNeverLoggedIn(event.target.checked)}
                />{" "}
                {t('userManagement.neverLoggedIn')}
              </label>
            </div>
          </div>
        ) : null}
      </section>

      <ModernCard
        title={t('userManagement.bulkActions')}
        subtitle={t('userManagement.bulkActionsHint')}
        className="user-management-bulk-card"
      >
        <div className="bulk-actions-toolbar">
          <div className="bulk-actions-selects">
            <label className="field">
              {t('userManagement.bulkDepartment')}
              <select
                value={bulkDepartment}
                onChange={(event) => setBulkDepartment(event.target.value)}
                disabled={writeDisabled}
              >
                <option value="">{t('userManagement.noDepartment')}</option>
                {departmentRows.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name_en}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              {t('userManagement.bulkRole')}
              <select
                value={bulkRole}
                onChange={(event) => setBulkRole(event.target.value as AppRole)}
                disabled={writeDisabled}
              >
                {userRoleOptions.map((role) => (
                  <option key={role} value={role}>
                    {t(`role.${role}`, humanize(role))}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="bulk-actions-buttons">
            <button
              className="ghost-button"
              onClick={() =>
                setSelectedIds(
                  new Set(visibleUsers.map((user) => user.user_id)),
                )
              }
            >
              {t('userManagement.selectFiltered')}
            </button>
            <button
              className="ghost-button"
              onClick={() => setSelectedIds(new Set())}
            >
              {t('userManagement.clear')}
            </button>
            <button
              className="ghost-button"
              onClick={() => exportSelected(selectedUsers)}
            >
              <Download size={16} /> {t('userManagement.exportSelected')}
            </button>
            <button
              className="ghost-button"
              disabled={writeDisabled || !selectedUsers.length}
              onClick={() => {
                void runAction(
                  async () => {
                    await Promise.all(
                      selectedUsers.map((user) =>
                        updateUserDepartment({
                          userId: user.user_id,
                          departmentId: bulkDepartment || null,
                          reason: "Bulk department assignment",
                        }),
                      ),
                    );
                  },
                  `${selectedUsers.length} department assignment${selectedUsers.length === 1 ? "" : "s"} updated.`,
                  selectedUsers.map(user => user.user_id),
                );
              }}
            >
              {t('userManagement.assignDepartment')}
            </button>
            <button
              className="ghost-button"
              disabled={writeDisabled || !selectedUsers.length}
              onClick={() => {
                void runAction(
                  async () => {
                    await Promise.all(
                      selectedUsers.map((user) =>
                        updateUserRole({
                          userId: user.user_id,
                          role: bulkRole,
                          scope: bulkDepartment
                            ? "department"
                            : "assigned_only",
                          departmentId: bulkDepartment || user.department_id,
                          reason: "Bulk role assignment",
                        }),
                      ),
                    );
                  },
                  `${selectedUsers.length} role assignment${selectedUsers.length === 1 ? "" : "s"} updated.`,
                  selectedUsers.map(user => user.user_id),
                );
              }}
            >
              {t('userManagement.assignRole')}
            </button>
            <button
              className="ghost-button"
              disabled={writeDisabled || !selectedUsers.length}
              onClick={() => {
                setReason("");
                setLifecycle({ action: "deactivate", users: selectedUsers });
              }}
            >
              <ShieldOff size={16} /> {t('userManagement.deactivate')}
            </button>
            <button
              className="ghost-button"
              disabled={writeDisabled || !selectedUsers.length}
              onClick={() => {
                setReason("");
                setLifecycle({ action: "archive", users: selectedUsers });
              }}
            >
              <Archive size={16} /> {t('userManagement.archive')}
            </button>
          </div>
        </div>
      </ModernCard>

      <ModernCard
        title={t('userManagement.userRoster')}
        subtitle={`${visibleUsers.length} ${t('userManagement.shown')}.`}
        className="user-roster-card"
      >
        <DataState
          loading={false}
          empty={!loading && visibleUsers.length === 0}
          emptyTitle={t('userManagement.noMatch')}
          emptyMessage={getLiveResultMessage(users)}
        >
          <div className="user-roster-scroll" tabIndex={0}>
            <table className="entity-table user-roster-table">
              <thead>
                <tr>
                  <th>
                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        aria-label={t('userManagement.selectAll')}
                      />
                      {t('userManagement.all')}
                    </label>
                  </th>
                  <th>{t('userManagement.name')}</th>
                  <th>{t('userManagement.signInIdentity')}</th>
                  <th>{t('userManagement.contactPhone')}</th>
                  <th>{t('common.department')}</th>
                  <th>{t('userManagement.jobTitle')}</th>
                  <th>{t('userManagement.roles')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('userManagement.lastLogin')}</th>
                  <th>{t('userManagement.created')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading && !isLive(users) ? Array.from({ length: 8 }, (_, index) => (
                  <tr className="roster-skeleton-row" key={`skeleton-${index}`} aria-hidden="true">
                    {Array.from({ length: 11 }, (__, cell) => <td key={cell}><span className="roster-skeleton-bar" /></td>)}
                  </tr>
                )) : null}
                {visibleUsers.map((user) => (
                  <tr key={user.user_id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(user.user_id)}
                        onChange={() => toggleSelected(user.user_id)}
                      />
                    </td>
                    <td className="user-roster-name">
                      <strong>{user.full_name_en}</strong>
                      <br />
                      <span className="muted">
                        {user.full_name_ar ||
                          user.employee_no ||
                          t('userManagement.noArabicOrEmployeeId')}
                      </span>
                    </td>
                    <td className="user-roster-email">
                      <strong>
                        {!user.credential_proof_available
                          ? "Identity mode unavailable"
                          : user.managed_identity
                            ? user.employee_no ?? "Missing Employee Login ID"
                            : user.identity_mode === "legacy_verified"
                              ? user.auth_email ?? "Verified Auth email unavailable"
                              : "Unverified credential identity"}
                      </strong>
                      <div className="muted">
                        {!user.credential_proof_available
                          ? "Protected Auth identity unavailable"
                          : user.managed_identity
                            ? user.synthetic_auth_email ?? "Missing synthetic Auth email"
                            : user.identity_mode === "legacy_verified"
                              ? `Legacy profile Employee reference: ${user.employee_no ?? "Not provided"}`
                              : "Credential reconciliation required"}
                      </div>
                    </td>
                    <td>
                      <div>{user.contact_email ?? t('userManagement.provisioningQueue.noContactEmail')}</div>
                      <div className="muted">{user.phone ?? t('userManagement.provisioningQueue.noPhone')}</div>
                    </td>
                    <td>
                      {user.department_name ?? (
                        <span className="warning-text">{t('userManagement.missingDepartment')}</span>
                      )}
                    </td>
                    <td>{user.job_title ?? t('userManagement.noJobTitle')}</td>
                    <td>
                      {activeRoleTotal(user) ? (
                        roleSummary(user)
                      ) : (
                        <span className="warning-text">{t('userManagement.missingRole')}</span>
                      )}
                    </td>
                    <td>
                      <StatusPill tone={statusTone(user.user_status)}>
                        {t(`status.${user.user_status}`, humanize(user.user_status))}
                      </StatusPill>
                    </td>
                    <td>{user.last_login_at ?? t('userManagement.neverAvailable')}</td>
                    <td>{user.created_at?.slice(0, 10)}</td>
                    <td className="user-roster-actions-cell">
                      <div className="user-row-actions user-row-actions--compact">
                        <button
                          className="ghost-button compact-button row-primary-action"
                          title={t('userManagement.view')}
                          aria-label={`View ${user.full_name_en}`}
                          onClick={() => void openDetails(user)}
                        >
                          <Eye size={14} /> {t('userManagement.view')}
                        </button>
                        <button
                          className="ghost-button compact-button row-primary-action"
                          title={t('userManagement.edit')}
                          aria-label={`Edit ${user.full_name_en}`}
                          disabled={writeDisabled}
                          onClick={() => openEdit(user)}
                        >
                          <UserCog size={14} /> {t('userManagement.edit')}
                        </button>
                        <div className="row-more-actions-wrap">
                          <button
                            className="ghost-button compact-button icon-button row-more-actions-button"
                            title={t('userManagement.moreActions')}
                            aria-label={`More actions for ${user.full_name_en}`}
                            onClick={() => setActionMenuUser(user)}
                            type="button"
                          >
                            <MoreHorizontal size={15} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="roster-pagination" aria-label="User roster pagination">
            <button className="ghost-button compact-button" type="button" disabled={loading || page === 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button>
            <span>Page {page} · up to {pageSize} users</span>
            <button className="ghost-button compact-button" type="button" disabled={loading || userRows.length < pageSize} onClick={() => setPage(value => value + 1)}>Next</button>
          </div>
        </DataState>
      </ModernCard>

      <Modal
        open={Boolean(detailUser)}
        title="User details"
        onClose={() => setDetailUser(null)}
      >
        {detailUser ? (
          <div className="page-stack">
            <div className="kpi-grid">
              <KpiTile
                label="Open projects"
                value={detailUser.open_project_count}
              />
              <KpiTile label="Open tasks" value={detailUser.open_task_count} />
              <KpiTile
                label="Pending approvals"
                value={detailUser.pending_approval_count}
              />
              <KpiTile
                label="Linked records"
                value={linkedRecordCount(detailUser)}
                tone={linkedRecordCount(detailUser) ? "warning" : "neutral"}
              />
            </div>
            <div className="panel">
              <h4>{detailUser.full_name_en}</h4>
              <p>
                {!detailUser.credential_proof_available
                  ? "Identity mode: Unavailable (credential proof required)"
                  : detailUser.managed_identity
                    ? `Employee Login ID: ${detailUser.employee_no ?? "Missing"}`
                    : detailUser.identity_mode === "legacy_verified"
                      ? `Profile Employee Reference: ${detailUser.employee_no ?? "Missing"}`
                      : "Identity mode: Unverified"}
              </p>
              <p>
                {!detailUser.credential_proof_available
                  ? "Auth identity: Unavailable (credential proof required)"
                  : detailUser.managed_identity
                    ? `Synthetic Auth Email: ${detailUser.synthetic_auth_email ?? "Missing"}`
                    : detailUser.identity_mode === "legacy_verified"
                      ? `Legacy Auth Email: ${detailUser.auth_email ?? "Missing"}`
                      : "Auth identity: Unverified; reconciliation required"}
              </p>
              <p>Contact Email: {detailUser.contact_email ?? "Not provided"}</p>
              <p>Phone: {detailUser.phone ?? "Not provided"}</p>
              <p>Credential State: {detailUser.credential_state ? humanize(detailUser.credential_state) : "Unavailable"}</p>
              <p>Must Change Password: {detailUser.must_change_password ? "Yes" : "No"}</p>
              <p>Last Password Reset: {detailUser.last_password_reset_at ?? "Never / unavailable"}</p>
              <p>Provisioning State: {detailUser.provisioning_state ? humanize(detailUser.provisioning_state) : "Not provisioned by Patch 83U"}</p>
              <p>
                Department: {detailUser.department_name ?? "Missing department"}
              </p>
              <p>Role(s): {roleSummary(detailUser)}</p>
              <p>Status: {humanize(detailUser.user_status)}</p>
            </div>
            <div className="panel">
              <h4>Lifecycle audit history</h4>
              <DataState
                empty={!auditRows.length}
                emptyMessage="No Patch 19 user-management audit entries yet."
              >
                <div className="table-scroll">
                  <table className="entity-table">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Reason</th>
                        <th>Linked records</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditRows.map((row) => (
                        <tr key={row.id}>
                          <td>{humanize(row.action)}</td>
                          <td>{row.reason ?? "Not recorded"}</td>
                          <td>{row.linked_record_count}</td>
                          <td>{row.created_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DataState>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(editUser)}
        title="Edit profile"
        onClose={() => setEditUser(null)}
      >
        <div className="form-grid">
          <label className="field">
            English name
            <input
              value={profileDraft.fullNameEn}
              onChange={(event) =>
                setProfileDraft({
                  ...profileDraft,
                  fullNameEn: event.target.value,
                })
              }
            />
          </label>
          <label className="field">
            Arabic name
            <input
              value={profileDraft.fullNameAr}
              onChange={(event) =>
                setProfileDraft({
                  ...profileDraft,
                  fullNameAr: event.target.value,
                })
              }
              dir="rtl"
            />
          </label>
          <label className="field">
            Employee ID
            <input
              value={profileDraft.employeeNo}
              disabled={editUser?.managed_identity === true}
              onChange={(event) =>
                setProfileDraft({
                  ...profileDraft,
                  employeeNo: event.target.value,
                })
              }
            />
          </label>
          <label className="field">
            Contact email (optional)
            <input
              type="email"
              value={profileDraft.contactEmail}
              onChange={(event) =>
                setProfileDraft({
                  ...profileDraft,
                  contactEmail: event.target.value,
                })
              }
            />
            {editUser?.managed_identity ? (
              <span className="muted">Managed Employee IDs are immutable; use credential reconciliation for identity conflicts.</span>
            ) : null}
          </label>
          <label className="field">
            Phone
            <input
              type="tel"
              value={profileDraft.phone}
              onChange={(event) =>
                setProfileDraft({
                  ...profileDraft,
                  phone: event.target.value,
                })
              }
            />
          </label>
          <label className="field">
            Job title
            <input
              value={profileDraft.jobTitle}
              onChange={(event) =>
                setProfileDraft({
                  ...profileDraft,
                  jobTitle: event.target.value,
                })
              }
            />
          </label>
          <label className="field">
            User type
            <select
              value={profileDraft.userType}
              onChange={(event) =>
                setProfileDraft({
                  ...profileDraft,
                  userType: event.target.value as UserType,
                })
              }
            >
              {userTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {humanize(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="field full-width">
            Reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="form-actions full-width">
            <button type="button" className="ghost-button" onClick={() => setEditUser(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={saving || writeDisabled}
              onClick={() => void submitProfile()}
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(departmentUser)}
        title="Assign/change department"
        onClose={() => setDepartmentUser(null)}
      >
        <div className="form-grid">
          <label className="field full-width">
            Department
            <select
              value={departmentDraft}
              onChange={(event) => setDepartmentDraft(event.target.value)}
            >
              <option value="">No department</option>
              {departmentRows.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name_en}
                </option>
              ))}
            </select>
          </label>
          <label className="field full-width">
            Reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="form-actions full-width">
            <button
              type="button"
              className="ghost-button"
              onClick={() => setDepartmentUser(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={saving || writeDisabled}
              onClick={() => void submitDepartment()}
            >
              {saving ? "Saving..." : "Save department"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(roleUser)}
        title="Assign/change role"
        onClose={() => setRoleUser(null)}
      >
        <div className="form-grid">
          <label className="field">
            Role
            <select
              value={roleDraft}
              onChange={(event) => setRoleDraft(event.target.value as AppRole)}
            >
              {userRoleOptions.map((role) => (
                <option key={role} value={role}>
                  {humanize(role)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Scope
            <select
              value={scopeDraft}
              onChange={(event) =>
                setScopeDraft(event.target.value as AccessScope)
              }
            >
              <option value="assigned_only">Assigned only</option>
              <option value="department">Department</option>
              <option value="global">Global</option>
            </select>
          </label>
          {scopeDraft === "department" ? (
            <label className="field full-width">
              Department
              <select
                value={roleDepartmentDraft}
                onChange={(event) => setRoleDepartmentDraft(event.target.value)}
              >
                {departmentRows.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name_en}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field full-width">
            Reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="notice-banner full-width">
            This action assigns the selected role through the server bridge and
            preserves the existing access model.
          </div>
          <div className="form-actions full-width">
            <button type="button" className="ghost-button" onClick={() => setRoleUser(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={saving || writeDisabled}
              onClick={() => void submitRole()}
            >
              {saving ? "Saving..." : "Save role"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(actionMenuUser)}
        title={`Actions for ${actionMenuUser?.full_name_en ?? ""}`}
        onClose={() => setActionMenuUser(null)}
      >
        {actionMenuUser ? (
          <div className="action-sheet-list">
            <button
              type="button"
              className="ghost-button action-sheet-item"
              disabled={writeDisabled}
              onClick={() => {
                openRole(actionMenuUser);
                setActionMenuUser(null);
              }}
            >
              <KeyRound size={14} /> Assign role
            </button>
            {hasAuthorizedSuperAdmin &&
            auth.patch83uCapabilities &&
            actionMenuUser.user_id !== auth.session?.user.id ? (
              <>
                <button
                  type="button"
                  className="ghost-button action-sheet-item"
                  disabled={!canUsePatch83uReset || !actionMenuUser.employee_no || !actionMenuUser.auth_email || !actionMenuUser.credential_proof_available || !['employee_id_managed', 'legacy_verified'].includes(actionMenuUser.identity_mode ?? '')}
                  onClick={() => {
                    openPasswordReset(actionMenuUser);
                    setActionMenuUser(null);
                  }}
                >
                  <KeyRound size={14} /> Reset temporary password
                </button>
                <button
                  type="button"
                  className="ghost-button action-sheet-item"
                  disabled={!canUsePatch83uProvisioning || !actionMenuUser.employee_no || !actionMenuUser.auth_email || !actionMenuUser.credential_proof_available || !['employee_id_managed', 'legacy_verified'].includes(actionMenuUser.identity_mode ?? '')}
                  onClick={() => {
                    openCredentialReconciliation(actionMenuUser);
                    setActionMenuUser(null);
                  }}
                >
                  <ShieldCheck size={14} /> Reconcile credential state
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="ghost-button action-sheet-item"
              disabled={writeDisabled}
              onClick={() => {
                openDepartment(actionMenuUser);
                setActionMenuUser(null);
              }}
            >
              <Building2 size={14} /> Assign department
            </button>
            {actionMenuUser.user_status === "active" ||
            actionMenuUser.user_status === "invited" ? (
              <button
                type="button"
                className="ghost-button action-sheet-item"
                disabled={writeDisabled}
                onClick={() => {
                  setReason("");
                  setLifecycle({ action: "deactivate", users: [actionMenuUser] });
                  setActionMenuUser(null);
                }}
              >
                <ShieldOff size={14} /> Deactivate user
              </button>
            ) : actionMenuUser.user_status === "inactive" ||
              actionMenuUser.user_status === "locked" ? (
              <button
                type="button"
                className="ghost-button action-sheet-item"
                disabled={writeDisabled}
                onClick={() => {
                  setReason("Reactivation after admin review");
                  setLifecycle({ action: "reactivate", users: [actionMenuUser] });
                  setActionMenuUser(null);
                }}
              >
                <RotateCcw size={14} /> Reactivate user
              </button>
            ) : null}
            {actionMenuUser.user_status === "archived" ? (
              <button
                type="button"
                className="ghost-button action-sheet-item"
                disabled={writeDisabled}
                onClick={() => {
                  setReason("Unarchive after admin review");
                  setLifecycle({ action: "unarchive", users: [actionMenuUser] });
                  setActionMenuUser(null);
                }}
              >
                <RotateCcw size={14} /> Unarchive user
              </button>
            ) : (
              <button
                type="button"
                className="ghost-button action-sheet-item"
                disabled={writeDisabled}
                onClick={() => {
                  setReason("");
                  setLifecycle({ action: "archive", users: [actionMenuUser] });
                  setActionMenuUser(null);
                }}
              >
                <Archive size={14} /> Archive user
              </button>
            )}
            <button
              type="button"
              className="ghost-button action-sheet-item"
              onClick={() => {
                exportSelected([actionMenuUser]);
                setActionMenuUser(null);
              }}
            >
              <Download size={14} /> Export user
            </button>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={provisioningOpen}
        title={t("userManagement.provisioningQueue.title")}
        className="provisioning-queue-dialog"
        closeLabel={t("userManagement.provisioningQueue.close")}
        direction={direction}
        headerDescription={
          <span className="provisioning-queue-warning">
            {t("userManagement.provisioningQueue.warning")}
          </span>
        }
        onClose={() => {
          if (saving) return;
          setProvisioningOpen(false);
          setProvisioningTarget(null);
          setProvisioningConfirmation("");
          setProvisioningRequestId("");
          setProvisioningError(null);
        }}
      >
        <div className="provisioning-queue-modal">
          <div className="inline-actions provisioning-queue-toolbar">
            <button
              type="button"
              className="ghost-button"
              disabled={provisioningLoading || saving || !canUsePatch83uProvisioning}
              onClick={() => void loadProvisioningQueue()}
            >
              <RefreshCw size={16} />{" "}
              {t("userManagement.provisioningQueue.refresh")}
            </button>
            <span className="muted">
              {provisioningRows.length}{" "}
              {t(
                provisioningRows.length === 1
                  ? "userManagement.provisioningQueue.record"
                  : "userManagement.provisioningQueue.records",
              )}
            </span>
          </div>
          {provisioningLoading ? (
            <div className="notice-banner provisioning-queue-state" role="status">
              {t("userManagement.provisioningQueue.loading")}
            </div>
          ) : null}
          {provisioningError ? (
            <div className="form-error provisioning-queue-state" role="alert">
              {provisioningError}
            </div>
          ) : null}
          {provisioningTarget ? (
            <div className="panel form-grid provisioning-queue-confirmation">
              <div className="full-width">
                <strong>
                  {t(
                    provisioningTarget.action === "provision"
                      ? "userManagement.provisioningQueue.confirmProvision"
                      : "userManagement.provisioningQueue.confirmReconcile",
                  )}{" "}
                  {language === "ar" && provisioningTarget.row.full_name_ar
                    ? provisioningTarget.row.full_name_ar
                    : provisioningTarget.row.full_name_en}
                </strong>
                <p className="muted">
                  {t("userManagement.provisioningQueue.authEmailPrefix")}{" "}
                  <bdi>{provisioningTarget.row.auth_email}</bdi>.{" "}
                  {t(
                    "userManagement.provisioningQueue.initialPasswordNotice",
                  )}
                </p>
              </div>
              <label className="field full-width">
                {t("userManagement.provisioningQueue.confirmEmployeeId")}{" "}
                <bdi>{provisioningTarget.row.employee_id}</bdi>
                <input
                  aria-label={t(
                    "userManagement.provisioningQueue.confirmEmployeeIdAria",
                  )}
                  value={provisioningConfirmation}
                  onChange={(event) => setProvisioningConfirmation(event.target.value)}
                  autoComplete="off"
                />
              </label>
              <div className="form-actions full-width">
                <button
                  type="button"
                  className="ghost-button"
                  disabled={saving}
                  onClick={() => {
                    setProvisioningTarget(null);
                    setProvisioningConfirmation("");
                    setProvisioningRequestId("");
                  }}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    saving ||
                    !canUsePatch83uProvisioning ||
                    provisioningConfirmation !== provisioningTarget.row.employee_id
                  }
                  onClick={() => void submitProvisioningAction()}
                >
                  {saving
                    ? t("userManagement.provisioningQueue.processing")
                    : provisioningTarget.action === "provision"
                      ? t(
                          "userManagement.provisioningQueue.provisionAccount",
                        )
                      : t(
                          "userManagement.provisioningQueue.reconcileAccount",
                        )}
                </button>
              </div>
            </div>
          ) : null}
          {!provisioningLoading && provisioningRows.length === 0 ? (
            <div className="notice-banner provisioning-queue-state">
              {t("userManagement.provisioningQueue.empty")}
            </div>
          ) : null}
          {provisioningRows.length ? (
            <div
              className="provisioning-queue-table-scroll"
              role="region"
              aria-label={t("userManagement.provisioningQueue.ariaLabel")}
              tabIndex={0}
            >
              <table className="entity-table provisioning-queue-table">
                <thead>
                  <tr>
                    <th className="provisioning-queue-employee">
                      {t("userManagement.provisioningQueue.header.employee")}
                    </th>
                    <th className="provisioning-queue-employee-id">
                      {t("userManagement.provisioningQueue.header.employeeId")}
                    </th>
                    <th className="provisioning-queue-auth-email">
                      {t("userManagement.provisioningQueue.header.authEmail")}
                    </th>
                    <th className="provisioning-queue-department">
                      {t("userManagement.provisioningQueue.header.department")}
                    </th>
                    <th className="provisioning-queue-access">
                      {t(
                        "userManagement.provisioningQueue.header.requestedAccess",
                      )}
                    </th>
                    <th className="provisioning-queue-account-action">
                      {t(
                        "userManagement.provisioningQueue.header.accountAction",
                      )}
                    </th>
                    <th className="provisioning-queue-lifecycle">
                      {t("userManagement.provisioningQueue.header.lifecycle")}
                    </th>
                    <th className="provisioning-queue-status">
                      {t("userManagement.provisioningQueue.header.status")}
                    </th>
                    <th className="provisioning-queue-attempts">
                      {t("userManagement.provisioningQueue.header.attempts")}
                    </th>
                    <th className="provisioning-queue-controlled-action">
                      {t(
                        "userManagement.provisioningQueue.header.controlledAction",
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {provisioningRows.map((row) => {
                    const linkedUser = users.data?.find(
                      (user) => user.user_id === row.profile_id,
                    );
                    const canProvision = [
                      "queued",
                      "retryable_failed",
                      "policy_blocked",
                      "auth_created_pending_finalize",
                    ].includes(row.provisioning_status);
                    const canReconcilePostPasswordRoleActivation =
                      isPostPasswordRoleActivationRecoveryCandidate(
                        row,
                        linkedUser,
                        auth.profile?.organizationId,
                      );
                    const canReconcile = [
                      "provisioning",
                      "reconciliation_required",
                    ].includes(row.provisioning_status) ||
                      canReconcilePostPasswordRoleActivation;
                    return (
                      <tr key={row.id}>
                        <td className="provisioning-queue-employee">
                          <strong>
                            {language === "ar" && row.full_name_ar
                              ? row.full_name_ar
                              : row.full_name_en}
                          </strong>
                          {row.full_name_ar ? (
                            <div className="muted">
                              {language === "ar"
                                ? row.full_name_en
                                : row.full_name_ar}
                            </div>
                          ) : null}
                          <div className="muted provisioning-queue-contact">
                            <span>
                              {row.contact_email ??
                                t(
                                  "userManagement.provisioningQueue.noContactEmail",
                                )}
                            </span>
                            <span dir="ltr">
                              {row.phone ??
                                t(
                                  "userManagement.provisioningQueue.noPhone",
                                )}
                            </span>
                          </div>
                        </td>
                        <td className="provisioning-queue-employee-id">
                          <bdi>{row.employee_id}</bdi>
                        </td>
                        <td className="provisioning-queue-auth-email">
                          <span
                            className="provisioning-queue-email"
                            dir="ltr"
                            title={row.auth_email}
                          >
                            {row.auth_email}
                          </span>
                        </td>
                        <td className="provisioning-queue-department">
                          <bdi>{row.department_code}</bdi>
                        </td>
                        <td className="provisioning-queue-access">
                          {t(
                            `userManagement.provisioningQueue.role.${row.requested_role}`,
                            humanize(row.requested_role),
                          )}{" "}
                          ·{" "}
                          {t(
                            `userManagement.provisioningQueue.scope.${row.requested_scope}`,
                            humanize(row.requested_scope),
                          )}
                        </td>
                        <td className="provisioning-queue-account-action">
                          {t(
                            `userManagement.provisioningQueue.accountAction.${row.account_action}`,
                            humanize(row.account_action),
                          )}
                        </td>
                        <td className="provisioning-queue-lifecycle">
                          {t(
                            `userManagement.provisioningQueue.lifecycle.${row.requested_lifecycle}`,
                            humanize(row.requested_lifecycle),
                          )}
                        </td>
                        <td className="provisioning-queue-status">
                          <StatusPill tone={row.provisioning_status.includes("failed") || row.provisioning_status === "reconciliation_required" ? "danger" : row.provisioning_status === "completed" ? "good" : "warning"}>
                            {t(
                              `userManagement.provisioningQueue.status.${row.provisioning_status}`,
                              humanize(row.provisioning_status),
                            )}
                          </StatusPill>
                          {row.last_error_code ? <div className="muted">{row.last_error_code}</div> : null}
                        </td>
                        <td className="provisioning-queue-attempts">
                          {row.attempt_count}
                        </td>
                        <td className="provisioning-queue-controlled-action">
                          {!canUsePatch83uProvisioning ? (
                            <span className="muted">
                              {t(
                                "userManagement.provisioningQueue.action.none",
                              )}
                            </span>
                          ) : canProvision ? (
                            <button
                              type="button"
                              className="ghost-button small"
                              disabled={saving}
                              onClick={() => chooseProvisioningAction(row, "provision")}
                            >
                              {t(
                                "userManagement.provisioningQueue.action.provision",
                              )}
                            </button>
                          ) : canReconcile ? (
                            <button
                              type="button"
                              className="ghost-button small"
                              disabled={saving}
                              onClick={() => chooseProvisioningAction(row, "reconcile")}
                            >
                              {t(
                                "userManagement.provisioningQueue.action.reconcile",
                              )}
                            </button>
                          ) : (
                            <span className="muted">
                              {t(
                                "userManagement.provisioningQueue.action.none",
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(resetUser)}
        title="Super Admin temporary password reset"
        onClose={() => {
          if (!saving) closePasswordReset();
        }}
      >
        {resetUser ? (
          <div className="form-grid">
            <div className="notice-banner full-width">
              Both password fields default to the exact Employee ID. You may keep that value or enter another temporary password accepted by the hosted Supabase Auth policy. The action advances the credential version, blocks normal application access until the password is changed, and attempts to revoke existing sessions. Role rows and lifecycle state are preserved.
            </div>
            <div className="panel full-width">
              <strong>{resetUser.full_name_en}</strong>
              <p className="muted">Employee ID: {resetUser.employee_no ?? "Missing"}</p>
              <p className="muted">
                {resetUser.managed_identity ? "Synthetic Auth email" : "Auth email"}: {resetUser.synthetic_auth_email ?? resetUser.auth_email ?? "Unavailable"}
              </p>
            </div>
            <label className="field">
              Temporary password
              <input
                type="password"
                autoComplete="new-password"
                maxLength={256}
                value={resetDraft.temporaryPassword}
                onChange={(event) => setResetDraft((draft) => ({ ...draft, temporaryPassword: event.target.value }))}
              />
            </label>
            <label className="field">
              Confirm temporary password
              <input
                type="password"
                autoComplete="new-password"
                maxLength={256}
                value={resetDraft.confirmPassword}
                onChange={(event) => setResetDraft((draft) => ({ ...draft, confirmPassword: event.target.value }))}
              />
            </label>
            <label className="field full-width">
              Type {ADMIN_RESET_CONFIRMATION_TEXT} exactly
              <input
                aria-label="Reset password action confirmation"
                autoComplete="off"
                value={resetDraft.resetConfirmation}
                onChange={(event) => setResetDraft((draft) => ({ ...draft, resetConfirmation: event.target.value }))}
              />
            </label>
            <label className="field full-width">
              Type Employee ID {resetUser.employee_no ?? ""} exactly
              <input
                aria-label="Reset Employee ID confirmation"
                autoComplete="off"
                value={resetDraft.employeeIdConfirmation}
                onChange={(event) => setResetDraft((draft) => ({ ...draft, employeeIdConfirmation: event.target.value }))}
              />
            </label>
            <label className="field full-width">
              Reset reason
              <textarea
                value={resetDraft.reason}
                onChange={(event) => setResetDraft((draft) => ({ ...draft, reason: event.target.value }))}
              />
            </label>
            {resetReasonContainsTemporaryPassword ? (
              <div className="form-error full-width">
                The reset reason must not contain the temporary password.
              </div>
            ) : null}
            {actionError ? <div className="form-error full-width">{actionError}</div> : null}
            <div className="form-actions full-width">
              <button type="button" className="ghost-button" disabled={saving} onClick={closePasswordReset}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={
                  saving ||
                  !canUsePatch83uReset ||
                  !resetUser.employee_no ||
                  !resetDraft.temporaryPassword ||
                  resetDraft.temporaryPassword !== resetDraft.temporaryPassword.trim() ||
                  resetDraft.temporaryPassword !== resetDraft.confirmPassword ||
                  resetDraft.employeeIdConfirmation !== resetUser.employee_no ||
                  resetDraft.resetConfirmation !== ADMIN_RESET_CONFIRMATION_TEXT ||
                  !resetDraft.reason.trim() ||
                  resetReasonContainsTemporaryPassword
                }
                onClick={() => void submitPasswordReset()}
              >
                {saving ? "Resetting…" : "Reset password and revoke sessions"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(credentialReconcileUser)}
        title="Reconcile credential state"
        onClose={() => {
          if (!saving) closeCredentialReconciliation();
        }}
      >
        {credentialReconcileUser ? (
          <div className="form-grid">
            <div className="notice-banner full-width">
              This fail-closed recovery action compares protected Auth and database version evidence. It never changes or reveals a password and cannot activate ambiguous state.
            </div>
            <div className="panel full-width">
              <strong>{credentialReconcileUser.full_name_en}</strong>
              <p className="muted">Employee ID: {credentialReconcileUser.employee_no ?? "Missing"}</p>
            </div>
            <label className="field full-width">
              Type Employee ID {credentialReconcileUser.employee_no ?? ""} exactly
              <input
                aria-label="Credential reconciliation Employee ID confirmation"
                autoComplete="off"
                value={credentialReconcileConfirmation}
                onChange={(event) => setCredentialReconcileConfirmation(event.target.value)}
              />
            </label>
            {actionError ? <div className="form-error full-width">{actionError}</div> : null}
            <div className="form-actions full-width">
              <button type="button" className="ghost-button" disabled={saving} onClick={closeCredentialReconciliation}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={
                  saving ||
                  !canUsePatch83uProvisioning ||
                  !credentialReconcileUser.employee_no ||
                  credentialReconcileConfirmation !== credentialReconcileUser.employee_no
                }
                onClick={() => void submitCredentialReconciliation()}
              >
                {saving ? "Reconciling…" : "Reconcile from protected proof"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(lifecycle)}
        title="Confirm user lifecycle action"
        onClose={() => setLifecycle(null)}
      >
        {lifecycle ? (
          <div className="form-grid">
            <div className="notice-banner full-width">
              This uses app-level {lifecycle.action}. Hard user deletion is not
              used. Active role assignments are disabled for deactivate/archive
              actions.
            </div>
            <div className="panel full-width">
              <strong>
                {lifecycle.users.length} user
                {lifecycle.users.length === 1 ? "" : "s"} selected
              </strong>
              <p className="muted">
                Linked evidence/workflow records detected:{" "}
                {lifecycle.users.reduce(
                  (sum, user) => sum + linkedRecordCount(user),
                  0,
                )}
              </p>
            </div>
            <label className="field full-width">
              Reason required
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <div className="form-actions full-width">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setLifecycle(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={saving || writeDisabled || !reason.trim()}
                onClick={() => void submitLifecycle()}
              >
                {saving ? "Saving..." : `Confirm ${lifecycle.action}`}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={importOpen}
        title="Preview User Excel Import"
        onClose={closeImport}
      >
        <div className="page-stack user-workbook-modal">
          <div className="notice-banner">
            Excel import is preview-first. Existing profiles can be updated only
            through the authenticated privileged-action bridge. Unknown accounts
            are reported for separate controlled creation and are never created
            from the browser.
          </div>
          <div className="inline-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => void downloadUserTemplate()}
            >
              <FileDown size={16} /> Download Excel template
            </button>
            {importValidation ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => void downloadValidationErrors()}
              >
                <FileDown size={16} /> Export validation errors
              </button>
            ) : null}
          </div>
          <div className="user-workbook-upload" aria-disabled={importUploadDisabled}>
            <div className="field">
              <span>Upload User Excel File</span>
              <span id="user-workbook-input-description" className="muted">
                Accepts only a real .xlsx workbook. Previewing does not modify user data.
              </span>
            </div>
            <input
              ref={importFileInputRef}
              id="user-workbook-input"
              className="visually-hidden"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label="User Excel workbook file input"
              aria-disabled={importUploadDisabled}
              aria-describedby={importUploadDescribedBy}
              disabled={importUploadDisabled}
              tabIndex={-1}
              onChange={(event) => {
                void handleImportFile(event.target.files?.[0] ?? null);
              }}
            />
            {!importFile ? (
              <div className="inline-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => importFileInputRef.current?.click()}
                  aria-disabled={importUploadDisabled}
                  aria-describedby={importUploadDescribedBy}
                  disabled={importUploadDisabled}
                >
                  <UploadCloud size={16} /> Choose .xlsx workbook
                </button>
              </div>
            ) : (
              <div className="user-workbook-file">
                <div>
                  <strong>{importFile.name}</strong>
                  <span className="muted">{formatFileSize(importFile.size)}</span>
                </div>
                <div className="inline-actions">
                  <button
                    type="button"
                    className="ghost-button small"
                    onClick={() => importFileInputRef.current?.click()}
                    aria-disabled={importUploadDisabled}
                    aria-describedby={importUploadDescribedBy}
                    disabled={importUploadDisabled}
                  >
                    Replace file
                  </button>
                  <button
                    type="button"
                    className="ghost-button small"
                    onClick={resetImportFile}
                    disabled={importParsing}
                  >
                    Remove file
                  </button>
                </div>
              </div>
            )}
          </div>
          {importCompatibilityStatus === "disabled" ? (
            <div
              id="user-workbook-compatibility-status"
              className="notice-banner"
              role="status"
            >
              {importCompatibilityMessage ?? PATCH83T_USER_IMPORT_FEATURE_DISABLED_MESSAGE}
            </div>
          ) : null}
          {importCompatibilityStatus === "checking" ? (
            <div
              id="user-workbook-compatibility-status"
              className="notice-banner"
              role="status"
            >
              Checking User Excel Import backend compatibility...
            </div>
          ) : null}
          {importCompatibilityStatus === "incompatible" ? (
            <div
              id="user-workbook-compatibility-status"
              className="notice-banner"
              role="alert"
            >
              <div>
                {importCompatibilityMessage ?? PATCH83T_USER_IMPORT_DEPLOYMENT_MESSAGE}
              </div>
              <div className="inline-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void checkImportCompatibility(true)}
                >
                  <RefreshCw size={16} /> Retry compatibility check
                </button>
              </div>
            </div>
          ) : null}
          {importParsing ? (
            <div
              id="user-workbook-parsing-status"
              className="notice-banner"
              role="status"
            >
              Parsing and validating workbook…
            </div>
          ) : null}
          {importParseError ? <div className="form-error">{importParseError}</div> : null}
          {importValidation ? (
            <>
              <div className="notice-banner">
                For existing profiles, the workbook role and role scope are authoritative. Review each row warning for active assignments that execution will deactivate.
              </div>
              <div className="kpi-grid user-import-kpis">
                <KpiTile label="Total rows" value={importValidation.rowCount} />
                <KpiTile
                  label="Valid rows"
                  value={importValidation.validCount}
                  tone="good"
                />
                <KpiTile
                  label="Invalid rows"
                  value={importValidation.invalidCount}
                  tone={importValidation.invalidCount ? "danger" : "good"}
                />
                <KpiTile
                  label="Duplicate Employee IDs"
                  value={importValidation.duplicateEmployeeIdCount}
                  tone={importValidation.duplicateEmployeeIdCount ? "danger" : "good"}
                />
                <KpiTile
                  label="Duplicate contact emails"
                  value={importValidation.duplicateContactEmailCount}
                  tone={
                    importValidation.duplicateContactEmailCount ? "warning" : "good"
                  }
                />
                <KpiTile
                  label="Unknown departments"
                  value={importValidation.unknownDepartmentCount}
                  tone={
                    importValidation.unknownDepartmentCount ? "danger" : "good"
                  }
                />
                <KpiTile
                  label="Unknown roles"
                  value={importValidation.unknownRoleCount}
                  tone={importValidation.unknownRoleCount ? "danger" : "good"}
                />
                <KpiTile
                  label="Invalid phone numbers"
                  value={importValidation.invalidPhoneCount}
                  tone={importValidation.invalidPhoneCount ? "danger" : "good"}
                />
                <KpiTile
                  label="Existing users to update"
                  value={importValidation.existingUserUpdateCount}
                  tone="warning"
                />
                <KpiTile
                  label="Accounts pending controlled creation"
                  value={importValidation.pendingAccountCreationCount}
                  tone="neutral"
                />
              </div>
              {importValidation.rowCount > 50 ? (
                <div className="muted user-workbook-preview-note">
                  Showing the first 50 of {importValidation.rowCount} rows. All validated rows remain included in the controlled execution.
                </div>
              ) : null}
              <div className="table-scroll user-workbook-preview" aria-label="User Excel import preview">
                <table className="entity-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Employee ID</th>
                      <th>English name</th>
                      <th>Arabic name</th>
                      <th>Synthetic Auth email</th>
                      <th>Contact email</th>
                      <th>Original phone</th>
                      <th>Normalized phone</th>
                      <th>Department</th>
                      <th>Job title</th>
                      <th>Role</th>
                      <th>Role scope</th>
                      <th>Status</th>
                      <th>User type</th>
                      <th>Account action</th>
                      <th>Matched profile</th>
                      <th>Matched Auth identity</th>
                      <th>Matched provisioning</th>
                      <th>Planned action</th>
                      <th>Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importValidation.rows.slice(0, 50).map((row) => (
                      <tr key={row.row_number}>
                        <td>{row.row_number}</td>
                        <td>{row.employee_no}</td>
                        <td>{row.full_name_en}</td>
                        <td>{row.full_name_ar || "—"}</td>
                        <td>{row.synthetic_auth_email}</td>
                        <td>{row.contact_email || "—"}</td>
                        <td>{row.phone_original || "—"}</td>
                        <td>{row.phone_normalized || "—"}</td>
                        <td>
                          <strong>{row.department}</strong>
                          <div className="muted">{row.department_name}</div>
                        </td>
                        <td>{row.job_title}</td>
                        <td>{row.role}</td>
                        <td>{row.role_scope}</td>
                        <td>{row.status}</td>
                        <td>{row.user_type}</td>
                        <td>{row.account_action}</td>
                        <td>{row.matched_user_label || "No existing profile"}</td>
                        <td>{row.matched_auth_identity_label || "No Auth identity"}</td>
                        <td>{row.matched_provisioning_label || "No open provisioning identity"}</td>
                        <td>
                          <StatusPill
                            tone={
                              row.planned_action === "rejected"
                                ? "danger"
                                : row.planned_action === "update_existing_profile"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {row.planned_action}
                          </StatusPill>
                        </td>
                        <td>
                          <StatusPill
                            tone={
                              row.validation_status === "valid"
                                ? "good"
                                : "danger"
                            }
                          >
                            {row.validation_status}
                          </StatusPill>
                          <div className="muted">
                            {[
                              ...(row.validation_errors ?? []),
                              ...(row.validation_warnings ?? []),
                            ].join(" ")}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label className="field full-width">
                Exact execution confirmation
                <input
                  aria-label="Exact execution confirmation"
                  value={importConfirmation}
                  onChange={(event) => setImportConfirmation(event.target.value)}
                  placeholder={USER_IMPORT_EXECUTION_CONFIRMATION}
                  autoComplete="off"
                />
                <span className="muted">
                  Type <strong>{USER_IMPORT_EXECUTION_CONFIRMATION}</strong> exactly. This confirmation is rechecked by the protected database operation before any write.
                </span>
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={resetImportFile}
                >
                  Remove file
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    !userImportFeatureEnabled ||
                    importCompatibilityStatus !== "compatible" ||
                    !isPatch83tUserImportCapabilityCompatible(importCapabilities) ||
                    !hasAuthorizedImportRole ||
                    saving ||
                    importValidation.invalidCount > 0 ||
                    importValidation.validCount === 0 ||
                    importConfirmation !== USER_IMPORT_EXECUTION_CONFIRMATION
                  }
                  onClick={() => void applyImport()}
                >
                  <FileUp size={16} /> Execute User Import
                </button>
              </div>
              {!hasAuthorizedImportRole ? (
                <div className="notice-banner">
                  Execution requires an authenticated, organization-aligned global Super Admin or Governance Admin. Upload and preview remain non-mutating.
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </Modal>
    </section>
  );
}
