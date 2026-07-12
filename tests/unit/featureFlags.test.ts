import { describe, expect, it } from "vitest";
import {
  isDepartmentImportExecutionEligible,
  isDepartmentImportExecutionEnabled,
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
