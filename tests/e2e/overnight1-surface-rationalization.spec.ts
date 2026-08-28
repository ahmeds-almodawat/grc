import { expect, test, type Page } from "@playwright/test";
import { PAGE_LOCATION_REGISTRY, type PageKey } from "../../src/routes/pageLocation";
import { startPatch83uTestServer, type Patch83uTestServer } from "./patch83uTestServer";
import {
  installPatch83vBackend,
  waitForActivePatch83vUser,
  type Patch83vRole,
} from "./patch83vTestHarness";

let server: Patch83uTestServer | null = null;
let baseUrl = "";

async function openAs(page: Page, role: Patch83vRole, pageKey: PageKey) {
  const backend = await installPatch83vBackend(page, role);
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
    expect(backend.proof.writeRequests).toEqual([]);
  });

  test("keeps the existing unauthorized deep-link behavior", async ({ page }) => {
    const backend = await openAs(page, "employee", "productionReadiness");

    await expect.poll(() => new URL(page.url()).searchParams.get("page"))
      .toBe(PAGE_LOCATION_REGISTRY.home);
    await expect(page.locator(".modern-main-content"))
      .toHaveAttribute("data-page-key", "home");
    await expect(page.locator(".legacy-active-banner")).toHaveCount(0);
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
});
