import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  auth: {
    profile: {
      organizationName: 'Almodawat Specialized Medical Company',
      fullNameEn: 'Local Super Admin',
      fullNameAr: 'مسؤول محلي',
      email: 'local@example.invalid',
    },
    roles: [{ role: 'super_admin', scope: 'global' }],
    primaryRole: 'super_admin',
    isLocalBypass: false,
    signOut: vi.fn(),
  },
}));

vi.mock('../../src/auth/AuthProvider', () => ({ useAuth: () => runtime.auth }));
vi.mock('../../src/i18n/I18nContext', () => ({
  useI18n: () => ({
    language: 'en',
    direction: 'ltr',
    toggleLanguage: vi.fn(),
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));
vi.mock('../../src/theme/ThemeContext', () => ({
  useTheme: () => ({ preference: 'light', setPreference: vi.fn() }),
}));
vi.mock('../../src/lib/scenarioLab', () => ({ isScenarioLabEnabled: () => false }));
vi.mock('../../src/components/ControlledPilotBanner', () => ({
  ControlledPilotBanner: () => null,
}));
vi.mock('../../src/components/BrandLogo', () => ({
  BrandLogo: () => <div aria-label="ACC brand" />,
}));

import { Layout } from '../../src/components/Layout';
import { Modal } from '../../src/components/Modal';
import { getActiveBodyScrollLocksForTest } from '../../src/hooks/useBodyScrollLock';

describe('GRC v1.3 D2 interactive stabilization', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    runtime.auth.signOut.mockClear();
    document.body.removeAttribute('style');
    delete document.body.dataset.scrollLocked;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('makes the modal a labelled dialog and gives focus to its close control', () => {
    render(<Modal open title="Governed workspace" onClose={vi.fn()}>Content</Modal>);

    expect(screen.getByRole('dialog', { name: 'Governed workspace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.close' })).toHaveFocus();
  });

  it('locks document scrolling while a modal is open and restores it on close', () => {
    const { rerender } = render(
      <Modal open title="Governed workspace" onClose={vi.fn()}>Content</Modal>,
    );

    expect(document.body.dataset.scrollLocked).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(getActiveBodyScrollLocksForTest()).toBe(1);

    rerender(<Modal open={false} title="Governed workspace" onClose={vi.fn()}>Content</Modal>);
    expect(document.body.dataset.scrollLocked).toBeUndefined();
    expect(document.body.style.overflow).toBe('');
    expect(getActiveBodyScrollLocksForTest()).toBe(0);
  });

  it('closes the modal on Escape without changing its content contract', () => {
    const onClose = vi.fn();
    render(<Modal open title="Governed workspace" onClose={onClose}>Content</Modal>);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('opens and closes the authorized navigation tree without duplicating routes', () => {
    const navigateToPage = vi.fn();
    render(<Layout page="home" navigateToPage={navigateToPage}>Page</Layout>);

    const drawer = document.getElementById('primary-navigation-drawer');
    expect(drawer).toHaveAttribute('data-mobile-open', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(drawer).toHaveAttribute('data-mobile-open', 'true');
    expect(document.body.dataset.scrollLocked).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(drawer).toHaveAttribute('data-mobile-open', 'false');
    expect(document.body.dataset.scrollLocked).toBeUndefined();
    expect(navigateToPage).not.toHaveBeenCalled();
  });

  it('closes the mobile navigation on Escape and returns focus to the trigger', () => {
    render(<Layout page="home" navigateToPage={vi.fn()}>Page</Layout>);
    const trigger = screen.getByRole('button', { name: 'Open navigation' });

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(document.getElementById('primary-navigation-drawer')).toHaveAttribute(
      'data-mobile-open',
      'false',
    );
    expect(trigger).toHaveFocus();
  });
});
