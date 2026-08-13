import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = (file: string) => readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const styles = source('src/styles.css');
const layout = source('src/components/Layout.tsx');
const modal = source('src/components/Modal.tsx');
const i18n = source('src/i18n/I18nContext.tsx');

describe('GRC v1.3 D2 visual-stabilization contracts', () => {
  it('defines complete purpose-based Light and Dark surface tokens', () => {
    for (const token of [
      '--color-page',
      '--color-surface',
      '--color-surface-elevated',
      '--color-text-primary',
      '--color-text-secondary',
      '--color-text-muted',
      '--color-border',
      '--color-input-background',
      '--color-table-header',
      '--color-focus-ring',
    ]) {
      expect(styles.match(new RegExp(token, 'g'))?.length ?? 0).toBeGreaterThanOrEqual(2);
    }
    expect(styles).toContain(':root[data-theme="dark"]');
  });

  it('maps established shared primitives onto semantic surface tokens', () => {
    expect(styles).toContain('--ui-surface-solid: var(--color-surface)');
    expect(styles).toContain('--ui-ink: var(--color-text-primary)');
    expect(styles).toContain('--surface: var(--color-surface)');
    expect(styles).toContain('background: var(--color-surface-elevated) !important');
  });

  it('governs forms, focus, disabled state and browser autofill in both themes', () => {
    expect(styles).toContain('background: var(--color-input-background)');
    expect(styles).toContain('outline: 3px solid color-mix(in srgb, var(--color-focus-ring)');
    expect(styles).toContain(':-webkit-autofill');
    expect(styles).toContain('var(--color-text-disabled)');
  });

  it('governs shared table headers, alternating rows, hover and selection states', () => {
    expect(styles).toContain('background: var(--color-table-header)');
    expect(styles).toContain('background: var(--color-table-row-alt)');
    expect(styles).toContain('background: var(--color-table-hover)');
    expect(styles).toContain('background: var(--color-table-selected)');
  });

  it('makes every shared modal flex-owned with a scrollable body and fixed chrome', () => {
    expect(styles).toMatch(/\/\* Shared modal\/workspace sizing[\s\S]*?\.modal-card\s*\{[\s\S]*?display:\s*flex;[\s\S]*?max-height:\s*min\(92dvh,\s*960px\)/);
    expect(styles).toMatch(/\.modal-body\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?overflow:\s*auto;/);
    expect(styles).toContain('.modal-header,\n.modal-footer');
    expect(modal).toContain('useBodyScrollLock(open)');
    expect(modal).toContain("event.key === 'Escape'");
  });

  it('uses one route-filtered navigation tree for desktop and the mobile drawer', () => {
    expect(layout).toContain('const allowedNavTree = useMemo');
    expect(layout).toContain('(group.children ?? []).filter((item) =>');
    expect(layout).toContain('canOpen(item.key)');
    expect(layout).toContain('id="primary-navigation-drawer"');
    expect(layout).not.toContain('mobileNavTree');
  });

  it('keeps the closed mobile drawer non-interactive and restores it as an overlay', () => {
    expect(styles).toContain('width: min(88vw, 360px)');
    expect(styles).toContain('position: fixed !important');
    expect(styles).toContain('height: 100dvh !important');
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr) !important');
    expect(styles).toContain('visibility: hidden');
    expect(styles).toContain('pointer-events: none');
    expect(styles).toContain('.modern-sidebar.mobile-nav-open');
    expect(styles).toContain('visibility: visible');
    expect(styles).toContain('background: var(--color-backdrop)');
  });

  it('supports RTL drawer placement and logical sticky table identity columns', () => {
    expect(styles).toContain('.rtl-shell .modern-sidebar');
    expect(styles).toMatch(/\.rtl-shell \.modern-sidebar\s*\{[\s\S]*?inset-inline-start:\s*0;[\s\S]*?inset-inline-end:\s*auto;/);
    expect(styles).toContain(':where(th:first-child, td:first-child)');
  });

  it('keeps governed print output deliberately white and isolated from screen theme', () => {
    expect(styles).toContain('/* Print remains intentional white A4 output regardless of screen theme. */');
    expect(styles).toMatch(/@media print\s*\{[\s\S]*?\.governed-print-root[\s\S]*?background:\s*#ffffff !important/);
  });

  it('provides audited English and Arabic mobile-navigation labels', () => {
    for (const key of ['nav.menu', 'nav.openMenu', 'nav.closeMenu']) {
      expect(i18n).toContain(`'${key}': { en:`);
      expect(i18n).toContain("ar: '");
    }
    expect(i18n).toContain("'navTree.group.internal'");
    expect(i18n).toContain("'navTree.group.admin'");
  });

  it('has an audited translation entry for every authorized navigation child', () => {
    const tree = layout.slice(layout.indexOf('const navTree:'), layout.indexOf('export const legacyNavItems'));
    const childKeys = [...tree.matchAll(/key:\s*"([^"]+)"/g)].map(match => match[1]);
    expect(childKeys.length).toBeGreaterThan(40);
    for (const key of new Set(childKeys)) {
      expect(i18n, `missing navTree.item.${key}`).toContain(`'navTree.item.${key}': { en:`);
    }
  });
});
