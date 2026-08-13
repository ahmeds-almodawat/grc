import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ThemeProvider,
  initializeTheme,
  useTheme,
} from '../../src/theme/ThemeContext';

function installMatchMedia(initialDark: boolean) {
  let matches = initialDark;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({
      get matches() {
        return matches;
      },
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    }),
  });
  return {
    setDark(next: boolean) {
      matches = next;
      const event = { matches: next, media: '(prefers-color-scheme: dark)' } as MediaQueryListEvent;
      for (const listener of listeners) listener(event);
    },
  };
}

function ThemeProbe() {
  const theme = useTheme();
  return (
    <div>
      <output aria-label="theme state">{theme.preference}:{theme.resolvedTheme}</output>
      <button type="button" onClick={() => theme.setPreference('light')}>Light</button>
      <button type="button" onClick={() => theme.setPreference('dark')}>Dark</button>
      <button type="button" onClick={() => theme.setPreference('system')}>System</button>
    </div>
  );
}

describe('GRC v1.3 D2 ThemeContext behavior', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
  });

  it('defaults to Light even when the operating system prefers Dark', () => {
    installMatchMedia(true);
    initializeTheme();
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    expect(screen.getByLabelText('theme state').textContent).toBe('light:light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('persists an explicit Dark selection', () => {
    installMatchMedia(false);
    const first = render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    first.unmount();
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    expect(screen.getByLabelText('theme state').textContent).toBe('dark:dark');
  });

  it('keeps System functional and responds to operating-system changes', () => {
    const media = installMatchMedia(false);
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'System' }));
    expect(screen.getByLabelText('theme state').textContent).toBe('system:light');
    act(() => media.setDark(true));
    expect(screen.getByLabelText('theme state').textContent).toBe('system:dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('allows explicit Dark to override an OS Light preference', () => {
    installMatchMedia(false);
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(screen.getByLabelText('theme state').textContent).toBe('dark:dark');
  });

  it('allows explicit Light to override an OS Dark preference', () => {
    installMatchMedia(true);
    window.localStorage.setItem('grc-theme', 'dark');
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(screen.getByLabelText('theme state').textContent).toBe('light:light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
