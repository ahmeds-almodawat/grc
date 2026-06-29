import { expect, test } from '@playwright/test';

const workflowPages = [
  { path: '/', label: /workspace|dashboard|login|sign in|دخول|اللوحة/i },
  { path: '/ovr', label: /ovr|occurrence|quality|incident|دخول|login|sign in|بلاغ/i },
  { path: '/approvals', label: /approval|approve|reject|دخول|login|sign in|موافقة/i },
  { path: '/evidence', label: /evidence|upload|review|دخول|login|sign in|دليل/i },
  { path: '/projects', label: /project|milestone|task|دخول|login|sign in|مشروع/i }
];

test.describe('v6.5 core workflow smoke', () => {
  for (const item of workflowPages) {
    test(`${item.path} renders without crashing`, async ({ page }) => {
      await page.goto(item.path);
      await expect(page.locator('body')).toBeVisible();
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).toMatch(item.label);
    });
  }
});
