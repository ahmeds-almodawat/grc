import { describe, expect, it } from "vitest";
import type { AuthRole, AuthRoleAssignment } from "../../src/auth/authTypes";
import { canAccessPageForUser } from "../../src/auth/authAccess";
import {
  legacyNavigationTree,
  productNavigationTree,
} from "../../src/components/Layout";
import {
  UI8_ADMIN_VIEWS,
  UI8_VISIBLE_ADMIN_VIEWS,
} from "../../src/lib/ui8AdministrationModel";
import {
  PAGE_LOCATION_REGISTRY,
  pageKeyFromLocationValue,
  resolveAuthorizedPage,
  type PageKey,
} from "../../src/routes/pageLocation";
import {
  PAGE_SURFACE_REGISTRY,
  isPageVisibleOnSurface,
  pagesInCategory,
} from "../../src/routes/pageSurfaceRegistry";

const REPRESENTATIVE_ROLES = {
  super_admin: "global",
  executive: "global",
  division_head: "division",
  department_manager: "department",
  employee: "assigned_only",
  viewer: "assigned_only",
} as const satisfies Partial<Record<AuthRole, AuthRoleAssignment["scope"]>>;

function assignments(role: keyof typeof REPRESENTATIVE_ROLES): AuthRoleAssignment[] {
  return [{ role, scope: REPRESENTATIVE_ROLES[role] }];
}

function visibleNavigationCount(
  tree: typeof productNavigationTree,
  role: keyof typeof REPRESENTATIVE_ROLES,
): number {
  const roles = assignments(role);
  return tree.reduce((count, group) => {
    const children = (group.children ?? []).filter(
      (item) => canAccessPageForUser(item.key, roles),
    );
    const groupAllowed = group.page
      ? canAccessPageForUser(group.page, roles)
      : false;
    return count + (groupAllowed || children.length > 0 ? 1 + children.length : 0);
  }, 0);
}

function homeDestinationCount(role: keyof typeof REPRESENTATIVE_ROLES): number {
  const roles = assignments(role);
  return (Object.keys(PAGE_SURFACE_REGISTRY) as PageKey[]).filter(
    (pageKey) => isPageVisibleOnSurface(pageKey, "home")
      && canAccessPageForUser(pageKey, roles),
  ).length;
}

describe("v1.4.1 product surface registry", () => {
  it("classifies every canonical route without changing the 75-route contract", () => {
    const routeKeys = Object.keys(PAGE_LOCATION_REGISTRY);
    const surfaceKeys = Object.keys(PAGE_SURFACE_REGISTRY);

    expect(routeKeys).toHaveLength(75);
    expect(surfaceKeys).toEqual(routeKeys);
    expect(new Set(Object.values(PAGE_LOCATION_REGISTRY))).toHaveLength(75);
  });

  it("keeps internal and superseded routes registered while removing discovery", () => {
    const internalPages = pagesInCategory("D_INTERNAL_ENGINEERING");
    const legacyPages = pagesInCategory("E_LEGACY_SUPERSEDED");

    expect(internalPages.length).toBeGreaterThan(20);
    expect(legacyPages.length).toBeGreaterThanOrEqual(5);
    for (const pageKey of [...internalPages, ...legacyPages]) {
      expect(pageKeyFromLocationValue(PAGE_LOCATION_REGISTRY[pageKey])).toBe(pageKey);
      expect(isPageVisibleOnSurface(pageKey, "navigation")).toBe(false);
      expect(isPageVisibleOnSurface(pageKey, "mobile")).toBe(false);
      expect(isPageVisibleOnSurface(pageKey, "home")).toBe(false);
      expect(isPageVisibleOnSurface(pageKey, "search")).toBe(false);
    }
  });

  it("renders only centrally visible pages in the product navigation", () => {
    const destinations = productNavigationTree.flatMap((group) => [
      ...(group.page ? [group.page] : []),
      ...(group.children ?? []).map((item) => item.key),
    ]);

    expect(new Set(destinations).size).toBe(destinations.length);
    expect(destinations.every((pageKey) => isPageVisibleOnSurface(pageKey, "navigation"))).toBe(true);
    expect(destinations).not.toContain("productionReadiness");
    expect(destinations).not.toContain("migrationRunbook");
    expect(destinations).not.toContain("scenarioTestConsole");
    expect(destinations).not.toContain("executiveHub");
    expect(destinations).not.toContain("evidenceHub");
  });

  it("substantially reduces role-aware sidebar and home discovery counts", () => {
    const expected = {
      super_admin: { sidebarBefore: 78, sidebarAfter: 35, homeAfter: 9 },
      executive: { sidebarBefore: 36, sidebarAfter: 30, homeAfter: 8 },
      division_head: { sidebarBefore: 33, sidebarAfter: 27, homeAfter: 8 },
      department_manager: { sidebarBefore: 33, sidebarAfter: 27, homeAfter: 8 },
      employee: { sidebarBefore: 9, sidebarAfter: 9, homeAfter: 4 },
      viewer: { sidebarBefore: 15, sidebarAfter: 13, homeAfter: 4 },
    } as const;

    for (const role of Object.keys(expected) as Array<keyof typeof expected>) {
      expect(visibleNavigationCount(legacyNavigationTree, role)).toBe(expected[role].sidebarBefore);
      expect(visibleNavigationCount(productNavigationTree, role)).toBe(expected[role].sidebarAfter);
      expect(homeDestinationCount(role)).toBe(expected[role].homeAfter);
    }
  });

  it("applies the final owner adjudication without deleting secondary capabilities", () => {
    expect(PAGE_SURFACE_REGISTRY.scenarioPlanning).toMatchObject({
      category: "B_ROLE_SPECIFIC_BUSINESS",
      businessTier: "secondary_business",
    });
    expect(PAGE_SURFACE_REGISTRY.riskAppetiteKri).toMatchObject({
      category: "B_ROLE_SPECIFIC_BUSINESS",
      businessTier: "secondary_business",
    });
    expect(PAGE_SURFACE_REGISTRY.userGuide).toMatchObject({
      category: "A_CORE_BUSINESS",
      businessTier: "secondary_help",
    });
    expect(PAGE_SURFACE_REGISTRY.automationIntelligence).toMatchObject({
      category: "D_INTERNAL_ENGINEERING",
      businessTier: "internal",
    });

    for (const pageKey of ["scenarioPlanning", "riskAppetiteKri", "userGuide"] as const) {
      expect(isPageVisibleOnSurface(pageKey, "navigation")).toBe(false);
      expect(isPageVisibleOnSurface(pageKey, "mobile")).toBe(false);
      expect(isPageVisibleOnSurface(pageKey, "home")).toBe(false);
      expect(isPageVisibleOnSurface(pageKey, "search")).toBe(true);
      expect(isPageVisibleOnSurface(pageKey, "hub")).toBe(true);
    }

    for (const surface of ["navigation", "mobile", "home", "search", "hub"] as const) {
      expect(isPageVisibleOnSurface("automationIntelligence", surface)).toBe(false);
    }
    expect(pagesInCategory("F_UNCERTAIN")).toEqual([]);
  });

  it("preserves authorization independently of visibility", () => {
    const superAdmin = assignments("super_admin");
    const employee = assignments("employee");

    expect(isPageVisibleOnSurface("productionReadiness", "navigation")).toBe(false);
    expect(canAccessPageForUser("productionReadiness", superAdmin)).toBe(true);
    expect(canAccessPageForUser("productionReadiness", employee)).toBe(false);
    expect(resolveAuthorizedPage(
      "productionReadiness",
      (pageKey) => canAccessPageForUser(pageKey, superAdmin),
      "home",
    )).toEqual({ page: "productionReadiness", shouldReplace: false, reason: "allowed" });
    expect(resolveAuthorizedPage(
      "productionReadiness",
      (pageKey) => canAccessPageForUser(pageKey, employee),
      "home",
    )).toEqual({ page: "home", shouldReplace: true, reason: "unauthorized" });

    for (const pageKey of [
      "scenarioPlanning",
      "automationIntelligence",
      "riskAppetiteKri",
      "userGuide",
    ] as const) {
      expect(canAccessPageForUser(pageKey, superAdmin)).toBe(true);
      expect(resolveAuthorizedPage(
        pageKey,
        (candidate) => canAccessPageForUser(candidate, superAdmin),
        "home",
      )).toEqual({ page: pageKey, shouldReplace: false, reason: "allowed" });
    }

    for (const pageKey of [
      "scenarioPlanning",
      "automationIntelligence",
      "riskAppetiteKri",
    ] as const) {
      expect(canAccessPageForUser(pageKey, employee)).toBe(false);
      expect(resolveAuthorizedPage(
        pageKey,
        (candidate) => canAccessPageForUser(candidate, employee),
        "home",
      )).toEqual({ page: "home", shouldReplace: true, reason: "unauthorized" });
    }
    expect(canAccessPageForUser("userGuide", employee)).toBe(true);
  });

  it("hides technical admin subviews without deleting their implementation model", () => {
    expect(UI8_ADMIN_VIEWS).toHaveLength(10);
    expect(UI8_VISIBLE_ADMIN_VIEWS).toEqual([
      "overview",
      "users",
      "roles",
      "organization",
      "audit",
      "data",
    ]);
    expect(UI8_ADMIN_VIEWS).toContain("system");
    expect(UI8_VISIBLE_ADMIN_VIEWS).not.toContain("system");
    expect(UI8_VISIBLE_ADMIN_VIEWS).not.toContain("integrations");
  });
});
