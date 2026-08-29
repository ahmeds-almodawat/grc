import { expect, test, type Page } from "@playwright/test";
import { PAGE_LOCATION_REGISTRY, type PageKey } from "../../src/routes/pageLocation";
import { startPatch83uTestServer, type Patch83uTestServer } from "./patch83uTestServer";
import { installUi2FixtureData } from "./ui2Fixtures";
import { installUi8FixtureData } from "./ui8Fixtures";
import {
  installPatch83vBackend,
  waitForActivePatch83vUser,
  type Patch83vRole,
} from "./patch83vTestHarness";

let server: Patch83uTestServer | null = null;
let baseUrl = "";

const PAGE_SURFACE_LABELS = {
  scenarioPlanning: "Scenario Planning",
  automationIntelligence: "Automation Intelligence",
  riskAppetiteKri: "Risk Appetite & KRIs",
  userGuide: "User Guide",
} as const;

async function openAs(
  page: Page,
  role: Patch83vRole,
  pageKey: PageKey,
  beforeNavigate?: () => Promise<unknown>,
) {
  const backend = await installPatch83vBackend(page, role);
  await beforeNavigate?.();
  await page.addInitScript(() => {
    localStorage.setItem("grc-language", "en");
    localStorage.setItem("grc-theme", "light");
    localStorage.removeItem("grc-sidebar-collapsed");
  });
  await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY[pageKey]}`);
  if (role === "super_admin") {
    await waitForActivePatch83vUser(page);
  } else {
    await expect(page.locator(".auth-user-pill")).toBeVisible();
  }
  return backend;
}

test.describe("OVERNIGHT-1 product surface rationalization", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    server = await startPatch83uTestServer({
      VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: "true",
    });
    baseUrl = server.baseUrl;
  });

  test.afterAll(() => {
    server?.stop();
    server = null;
  });

  test("shows the business product without internal discovery", async ({ page }) => {
    const backend = await openAs(page, "super_admin", "home");
    const navigation = page.locator("#primary-navigation-drawer");

    await expect(navigation.getByText("Workspace", { exact: true })).toBeVisible();
    await expect(navigation.getByText("GRC", { exact: true })).toBeVisible();
    await expect(navigation.getByText("Quality & Safety", { exact: true })).toBeVisible();
    await expect(navigation.getByText("Management", { exact: true })).toBeVisible();
    await expect(navigation.getByText("Administration", { exact: true })).toBeVisible();

    for (const hiddenLabel of [
      "Internal / System Tools",
      "Production Readiness",
      "Migration Runbook",
      "Scenario Test Console",
      "Controlled UAT Workbench",
      "Load / Seed Center",
      "Evidence Vault",
      "Scenario Planning",
      "Automation Intelligence",
      "Risk Appetite & KRIs",
      "User Guide",
    ]) {
      await expect(navigation.getByText(hiddenLabel, { exact: true })).toHaveCount(0);
    }

    await expect(page.locator(".workspace-card")).toHaveCount(9);
    await expect(page.locator(".uat-tools-panel")).toHaveCount(0);
    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
  });

  test("preserves authorized direct access to a hidden internal route", async ({ page }) => {
    const backend = await openAs(page, "super_admin", "productionReadiness");

    await expect.poll(() => new URL(page.url()).searchParams.get("page"))
      .toBe(PAGE_LOCATION_REGISTRY.productionReadiness);
    await expect(page.locator(".modern-main-content"))
      .toHaveAttribute("data-page-key", "productionReadiness");
    await expect(page.locator(".legacy-active-banner"))
      .toContainText("Internal workspace");
    await expect(page.locator("#primary-navigation-drawer").getByText("Production Readiness", { exact: true }))
      .toHaveCount(0);

    await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY.evidenceHub}`);
    await expect.poll(() => new URL(page.url()).searchParams.get("page"))
      .toBe(PAGE_LOCATION_REGISTRY.evidenceHub);
    await expect(page.locator(".modern-main-content"))
      .toHaveAttribute("data-page-key", "evidenceHub");
    await expect(page.locator(".legacy-active-banner"))
      .toContainText("Legacy standalone page");

    for (const [pageKey, banner] of [
      ["scenarioPlanning", "Direct-access workspace"],
      ["automationIntelligence", "Internal workspace"],
      ["riskAppetiteKri", "Direct-access workspace"],
      ["userGuide", "Direct-access workspace"],
    ] as const) {
      await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY[pageKey]}`);
      await expect.poll(() => new URL(page.url()).searchParams.get("page"))
        .toBe(PAGE_LOCATION_REGISTRY[pageKey]);
      await expect(page.locator(".modern-main-content"))
        .toHaveAttribute("data-page-key", pageKey);
      await expect(page.locator(".legacy-active-banner")).toContainText(banner);
      await expect(page.locator("#primary-navigation-drawer").getByText(
        PAGE_SURFACE_LABELS[pageKey],
        { exact: true },
      )).toHaveCount(0);
    }
    expect(backend.proof.writeRequests).toEqual([]);
  });

  test("keeps the existing unauthorized deep-link behavior", async ({ page }) => {
    const backend = await openAs(page, "employee", "scenarioPlanning");

    await expect.poll(() => new URL(page.url()).searchParams.get("page"))
      .toBe(PAGE_LOCATION_REGISTRY.home);
    await expect(page.locator(".modern-main-content"))
      .toHaveAttribute("data-page-key", "home");
    await expect(page.locator(".legacy-active-banner")).toHaveCount(0);

    for (const pageKey of ["automationIntelligence", "riskAppetiteKri"] as const) {
      await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY[pageKey]}`);
      await expect.poll(() => new URL(page.url()).searchParams.get("page"))
        .toBe(PAGE_LOCATION_REGISTRY.home);
      await expect(page.locator(".modern-main-content"))
        .toHaveAttribute("data-page-key", "home");
    }
    expect(backend.proof.writeRequests).toEqual([]);
  });

  test("uses the same hidden-page classification at 390px and in RTL", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const backend = await openAs(page, "super_admin", "home");

    await page.locator(".mobile-nav-trigger").click();
    const drawer = page.locator("#primary-navigation-drawer");
    await expect(drawer).toHaveClass(/mobile-nav-open/);
    await expect(drawer.getByText("Internal / System Tools", { exact: true })).toHaveCount(0);
    await expect(drawer.getByText("Production Readiness", { exact: true })).toHaveCount(0);

    await page.locator(".sidebar-account .platform-icon-button").first().click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(drawer.getByText("إدارة النظام", { exact: true })).toBeVisible();
    await expect(drawer.getByText("جاهزية الإنتاج", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
      .toBe(true);
    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
  });

  test("captures the final Super Admin desktop and mobile navigation", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const backend = await openAs(page, "super_admin", "home");
    await page.screenshot({
      path: testInfo.outputPath("01-super-admin-home-desktop.png"),
      animations: "disabled",
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await waitForActivePatch83vUser(page);
    await page.locator(".mobile-nav-trigger").click();
    await expect(page.locator("#primary-navigation-drawer")).toHaveClass(/mobile-nav-open/);
    await page.screenshot({
      path: testInfo.outputPath("02-super-admin-mobile-390.png"),
      animations: "disabled",
      fullPage: false,
    });
    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
  });

  test("captures the final Executive dark dashboard", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const backend = await openAs(
      page,
      "executive",
      "dashboard",
      () => installUi2FixtureData(page, { analyticsMode: "privacy-suppressed" }),
    );
    await page.getByRole("combobox", { name: "Appearance theme" }).selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.screenshot({
      path: testInfo.outputPath("03-executive-dashboard-dark.png"),
      animations: "disabled",
      fullPage: true,
    });
    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
  });

  test("captures Department and Employee workspaces with RTL proof", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const departmentBackend = await openAs(page, "department_manager", "dailyOperationsHub");
    await page.screenshot({
      path: testInfo.outputPath("04-department-workspace-desktop.png"),
      animations: "disabled",
      fullPage: true,
    });
    expect(departmentBackend.proof.writeRequests).toEqual([]);

    const employeeBackend = await openAs(page, "employee", "myWork");
    await page.screenshot({
      path: testInfo.outputPath("05-employee-workspace-desktop.png"),
      animations: "disabled",
      fullPage: true,
    });
    await page.locator(".topbar-language").click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.screenshot({
      path: testInfo.outputPath("06-arabic-rtl-workspace.png"),
      animations: "disabled",
      fullPage: true,
    });
    expect(employeeBackend.proof.writeRequests).toEqual([]);
    expect(employeeBackend.proof.pageErrors).toEqual([]);
  });

  test("captures the final Administration attention state", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const backend = await openAs(
      page,
      "super_admin",
      "adminHub",
      () => installUi8FixtureData(page),
    );
    await expect(page.getByTestId("ui8-admin-overview")).toContainText("Locked user access");
    await expect(page.getByTestId("ui8-admin-overview")).toContainText("1 to review");
    await page.screenshot({
      path: testInfo.outputPath("07-administration-attention.png"),
      animations: "disabled",
      fullPage: true,
    });
    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
  });
});
