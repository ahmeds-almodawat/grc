import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = (file: string) => readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const styles = source('src/styles.css');
const layout = source('src/components/Layout.tsx');
const theme = source('src/theme/ThemeContext.tsx');
const staticAudit = source('scripts/d2-static-theme-audit.mjs');

describe('GRC v1.3 D2-R2 final theme consistency', () => {
  it('defines resolved-theme navigation tokens for Light and Dark', () => {
    for (const token of [
      '--nav-background',
      '--nav-surface',
      '--nav-text',
      '--nav-text-muted',
      '--nav-border',
      '--nav-hover',
      '--nav-active-background',
      '--nav-active-text',
      '--nav-focus',
      '--nav-control-background',
    ]) {
      expect(styles.match(new RegExp(token, 'g'))?.length ?? 0).toBeGreaterThanOrEqual(3);
    }
    expect(styles).toMatch(/\.modern-sidebar\s*\{[\s\S]*?var\(--nav-surface\)[\s\S]*?var\(--nav-background\)/);
    expect(styles).toContain(':root[data-theme="dark"] .modern-sidebar');
  });

  it('uses the same semantic navigation shell for desktop, mobile and RTL', () => {
    expect(layout).toContain('id="primary-navigation-drawer"');
    expect(layout).toContain('className={`sidebar modern-sidebar');
    expect(styles).toContain('.rtl-shell .modern-sidebar');
    expect(styles).toContain('.modern-sidebar .language-toggle');
    expect(styles).toContain('.modern-sidebar .mobile-nav-close');
    expect(styles).toContain('.modern-sidebar .nav-group-trigger');
    expect(styles).toContain('.modern-sidebar .nav-child-item');
    expect(styles).toContain('var(--nav-active-background)');
  });

  it('keeps System preference live-bound to OS color-scheme changes', () => {
    expect(theme).toContain("media.addEventListener('change', update)");
    expect(theme).toContain("preference === 'system' ? system : preference");
    expect(theme).toContain('applyResolvedTheme(resolvedTheme)');
  });

  it('maps global and vault search wrappers to shared field semantics', () => {
    expect(styles).toContain(':where(.search-input-wrap, .search-mini)');
    expect(styles).toContain('background: var(--color-input-background)');
    expect(styles).toContain('border-color: var(--color-input-border)');
    expect(styles).toContain(':focus-within');
    expect(styles).toContain(':root[data-theme="dark"] .modern-main-content input:not([type="checkbox"])');
  });

  it('maps controlled UAT scenario rows to semantic elevated surfaces', () => {
    expect(styles).toMatch(/\.modern-main-content \.controlled-uat-scenario\s*\{[\s\S]*?background:\s*var\(--color-surface-elevated\)/);
    expect(styles).toContain(':root[data-theme="dark"] .modern-main-content .controlled-uat-scenario');
  });

  it('does not exempt navigation, search or workbench classes from the static audit', () => {
    const exceptionLine = staticAudit.split('\n').find(line => line.includes('cssExceptionSelector')) ?? '';
    expect(exceptionLine).not.toContain('\\.nav-');
    expect(staticAudit).toContain('scenario|search|navigation|sidebar|drawer');
  });
});
