import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = (file: string) => readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

describe('ACC platform branding contract', () => {
  it('pins the exact approved platform logo artwork', () => {
    const logo = readFileSync(path.join(root, 'public/brand/almodawat-acc-logo.png'));
    expect(createHash('sha256').update(logo).digest('hex')).toBe(
      'edd27ce833d372018fc39dd0863c9e063a2634952481972ed8609ca659960112',
    );
  });

  it('uses one accessible logo component on every existing visual brand surface', () => {
    const component = source('src/components/BrandLogo.tsx');
    expect(component).toContain("const ACC_LOGO_PATH = '/brand/almodawat-acc-logo.png'");
    expect(component).toContain("const ACC_LOGO_ALT = 'Almodawat Assurance Control Center'");
    expect(source('src/components/Layout.tsx')).toContain('<BrandLogo variant="sidebar" />');
    expect(source('src/pages/LoginPage.tsx')).toContain('<BrandLogo variant="auth" />');
    expect(source('src/App.tsx')).toContain('<BrandLogo variant="loading" />');
  });

  it('installs the ACC browser title and standard favicon references', () => {
    const html = source('index.html');
    expect(html).toContain('<title>Almodawat Assurance Control Center</title>');
    expect(html).toContain('href="/favicon.ico"');
    expect(html).toContain('href="/favicon-32x32.png"');
    expect(html).toContain('href="/favicon-16x16.png"');
  });

  it('updates only platform-brand labels while preserving GRC domain language', () => {
    const i18n = source('src/i18n/I18nContext.tsx');
    expect(i18n).toContain("'app.title': { en: 'Almodawat Assurance Control Center', ar: 'مركز المداواة للضمان والرقابة' }");
    expect(i18n).toContain("'app.shortTitle': { en: 'ACC', ar: 'ACC' }");
    expect(i18n).toContain("'app.tagline': { en: 'Governance · Risk · Action'");
    expect(source('src/pages/LoginPage.tsx')).toContain('Governance, Risk and Compliance platform');
  });

  it('contains the approved artwork without distortion at responsive brand surfaces', () => {
    const styles = source('src/styles.css');
    expect(styles).toContain('object-fit: contain');
    expect(styles).toContain('.acc-brand-logo--sidebar');
    expect(styles).toContain('.acc-brand-logo--auth');
    expect(styles).toContain('.acc-brand-logo--loading');
    expect(styles).toContain('@media (max-width: 640px)');
  });
});
