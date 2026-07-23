import { describe, expect, it } from "vitest";
import {
  isDepartmentImportExecutionEligible,
  isDepartmentImportExecutionEnabled,
  isPatch83tUserExcelImportEnabled,
  isPatch83uCredentialGovernanceEnabled,
  PATCH83T_EXPECTED_EDGE_CONTRACT_VERSION,
  PATCH83T_EXPECTED_MAXIMUM_ROWS,
  PATCH83T_FRONTEND_CONTRACT_VERSION,
  PATCH83U_EXPECTED_EDGE_CONTRACT_VERSION,
  PATCH83U_EXPECTED_SCHEMA_VERSION,
  PATCH83U_FRONTEND_CONTRACT_VERSION,
} from "../../src/config/featureFlags";

describe("department import execution feature flag", () => {
  it.each([
    [undefined, false],
    ["", false],
    ["false", false],
    ["TRUE", false],
    ["1", false],
    ["true", true],
  ])("maps %s to %s", (value, expected) => {
    expect(isDepartmentImportExecutionEnabled(value)).toBe(expected);
  });
});

describe("Patch 83T User Excel Import deployment feature flag", () => {
  it.each([
    [undefined, false],
    ["", false],
    ["false", false],
    ["TRUE", false],
    ["1", false],
    ["yes", false],
    ["on", false],
    ["enabled", false],
    ["true", true],
  ])("maps %s to %s", (value, expected) => {
    expect(isPatch83tUserExcelImportEnabled(value)).toBe(expected);
  });

  it("pins the Patch 83T browser and Edge compatibility contracts", () => {
    expect(PATCH83T_EXPECTED_EDGE_CONTRACT_VERSION).toBe("patch83t-edge-user-import-v1");
    expect(PATCH83T_FRONTEND_CONTRACT_VERSION).toBe("patch83t-frontend-user-import-v1");
    expect(PATCH83T_EXPECTED_MAXIMUM_ROWS).toBe(5000);
  });
});

describe("Patch 83U deployment compatibility feature flag", () => {
  it.each([
    [undefined, false],
    ["", false],
    ["false", false],
    ["TRUE", false],
    ["1", false],
    ["yes", false],
    ["enabled", false],
    ["true", true],
  ])("maps %s to %s", (value, expected) => {
    expect(isPatch83uCredentialGovernanceEnabled(value)).toBe(expected);
  });

  it("pins the frontend, Edge, and schema contracts", () => {
    expect(PATCH83U_EXPECTED_EDGE_CONTRACT_VERSION).toBe("patch83u-edge-auth-first-v1");
    expect(PATCH83U_FRONTEND_CONTRACT_VERSION).toBe("patch83u-frontend-auth-first-v1");
    expect(PATCH83U_EXPECTED_SCHEMA_VERSION).toBe(174);
  });
});

const eligibleInput = {
  featureEnabled: true,
  roles: ["governance_admin"],
  previewExists: true,
  validRowCount: 1,
  hasBlockingValidationErrors: false,
  organizationId: "organization-id",
  importMode: "create_only",
};

describe("department import execution eligibility", () => {
  it("allows an administrator with the enabled flag and a valid preview", () => {
    expect(isDepartmentImportExecutionEligible(eligibleInput)).toBe(true);
  });

  it("rejects a non-administrator even when the flag is enabled", () => {
    expect(isDepartmentImportExecutionEligible({ ...eligibleInput, roles: ["department_manager"] })).toBe(false);
  });

  it("rejects blocking validation errors", () => {
    expect(isDepartmentImportExecutionEligible({ ...eligibleInput, hasBlockingValidationErrors: true })).toBe(false);
  });

  it("rejects a preview with zero valid rows", () => {
    expect(isDepartmentImportExecutionEligible({ ...eligibleInput, validRowCount: 0 })).toBe(false);
  });

  it("rejects an invalid import mode", () => {
    expect(isDepartmentImportExecutionEligible({ ...eligibleInput, importMode: "replace_all" })).toBe(false);
  });
});
