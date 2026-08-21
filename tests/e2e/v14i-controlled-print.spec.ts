import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { PAGE_LOCATION_REGISTRY } from '../../src/routes/pageLocation';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';
import { installPatch83vBackend, waitForActivePatch83vUser } from './patch83vTestHarness';

let server: Patch83uTestServer | null = null;
let baseUrl = '';

test.describe('GRC v1.4-I controlled print media', () => {
  test.beforeAll(async () => {
    server = await startPatch83uTestServer({
      VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: 'true',
    });
    baseUrl = server.baseUrl;
  });

  test.afterAll(() => {
    server?.stop();
    server = null;
  });

  test('isolates one active A4 RTL document and excludes screen controls', async ({ page }) => {
    const backend = await installPatch83vBackend(page);
    await page.setViewportSize({ width: 794, height: 1123 });
    await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY.evidence}`);
    await waitForActivePatch83vUser(page);

    await page.evaluate(() => {
      const main = document.querySelector('.modern-main-content');
      if (!main) throw new Error('Main content is unavailable.');

      const screenControl = document.createElement('button');
      screenControl.id = 'print-test-screen-control';
      screenControl.textContent = 'Screen only';
      main.appendChild(screenControl);

      const inactive = document.createElement('article');
      inactive.id = 'print-test-inactive';
      inactive.className = 'governed-print-root';
      inactive.textContent = 'Inactive print document';
      main.appendChild(inactive);

      const active = document.createElement('article');
      active.id = 'print-test-active';
      active.className = 'governed-print-root controlled-document-print';
      active.dataset.printActive = 'true';
      active.dir = 'rtl';
      active.innerHTML = `
        <header class="governed-print-header">
          <div><p>مركز المداواة للضمان والرقابة</p><h1>فهرس حزمة الأدلة المحكومة</h1><strong>OVR-2026-0042</strong></div>
        </header>
        <section class="controlled-document-print-record">
          <div><span>تسمية الإصدار الدقيقة</span><strong>v4.7</strong></div>
          <div><span>حالة الاعتماد</span><strong>الاعتماد مسجل</strong></div>
        </section>
        <table><thead><tr><th>الدليل</th><th>الحالة</th></tr></thead><tbody><tr><td>EV-0042</td><td>معتمد</td></tr></tbody></table>`;
      main.appendChild(active);
    });

    await expect(page.locator('#print-test-active')).toBeHidden();
    await page.emulateMedia({ media: 'print' });

    const proof = await page.evaluate(() => {
      const active = document.querySelector('#print-test-active') as HTMLElement;
      const inactive = document.querySelector('#print-test-inactive') as HTMLElement;
      const control = document.querySelector('#print-test-screen-control') as HTMLElement;
      const topbarControl = document.querySelector('.modern-topbar button') as HTMLElement;
      const activeStyle = getComputedStyle(active);
      return {
        activeVisibility: activeStyle.visibility,
        activeDisplay: activeStyle.display,
        activePosition: activeStyle.position,
        activeDirection: activeStyle.direction,
        activeFont: activeStyle.fontFamily,
        inactiveVisibility: getComputedStyle(inactive).visibility,
        controlVisibility: getComputedStyle(control).visibility,
        topbarControlDisplay: getComputedStyle(topbarControl).display,
      };
    });

    expect(proof.activeVisibility).toBe('visible');
    expect(proof.activeDisplay).toBe('block');
    expect(proof.activePosition).toBe('absolute');
    expect(proof.activeDirection).toBe('rtl');
    expect(proof.activeFont).toContain('Tahoma');
    expect(proof.inactiveVisibility).toBe('hidden');
    expect(proof.controlVisibility).toBe('hidden');
    expect(proof.topbarControlDisplay).toBe('none');

    const evidenceDir = process.env.V14I_EVIDENCE_DIR;
    if (evidenceDir) {
      mkdirSync(evidenceDir, { recursive: true });
      await page.screenshot({ path: join(evidenceDir, 'controlled-print-a4-rtl.png'), fullPage: true });
    }

    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.byteLength).toBeGreaterThan(5_000);

    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
  });
});
