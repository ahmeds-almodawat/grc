import { expect, test } from '@playwright/test';

function hasMeaningfulAuthOrAppShellText(bodyText: string): boolean {
  return /sign in|login|supabase|workspace|dashboard|governance|risk|quality|unauthorized|not authorized|دخول|تسجيل|اللوحة|الحوكمة|صلاحية|غير مصرح/i.test(bodyText);
}

test.describe('v6.5 auth/navigation smoke', () => {
  test('application responds and shows either login or protected workspace', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(20);
    expect(hasMeaningfulAuthOrAppShellText(bodyText)).toBeTruthy();
  });

  test('unauthorized route does not crash or show a blank page', async ({ page }) => {
    await page.goto('/unauthorized');
    await expect(page.locator('body')).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(20);
    expect(hasMeaningfulAuthOrAppShellText(bodyText)).toBeTruthy();
  });
});
