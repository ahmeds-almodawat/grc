import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusBadge } from '../../src/components/StatusBadge';
import { DataState } from '../../src/components/DataState';
import { Drawer } from '../../src/components/ui/Drawer';
import { NotificationCenter } from '../../src/components/ui/NotificationCenter';
import { ResponsiveTable } from '../../src/components/ui/ResponsiveTable';

vi.mock('../../src/i18n/I18nContext', () => ({
  useI18n: () => ({
    direction: 'ltr',
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

describe('UI-1 platform foundation', () => {
  afterEach(() => {
    document.body.removeAttribute('data-scroll-locked');
  });

  it('maps governed status text to a semantic tone without changing its label', () => {
    render(<StatusBadge status="Under Review" />);
    const badge = screen.getByText('Under Review');
    expect(badge.getAttribute('data-tone')).toBe('warning');
    expect(badge.className).toContain('status-under-review');
  });

  it('renders accessible loading, error and empty states through DataState', () => {
    const loading = render(<DataState loading><span>content</span></DataState>);
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
    loading.rerender(<DataState error="Network unavailable"><span>content</span></DataState>);
    expect(screen.getByRole('alert').textContent).toContain('Network unavailable');
    loading.rerender(<DataState empty emptyTitle="Nothing here" emptyMessage="No records"><span>content</span></DataState>);
    expect(screen.getByRole('status').textContent).toContain('Nothing here');
  });

  it('renders one responsive representation so record labels remain unique', () => {
    const rows = [{ id: 'POL-001', title: 'Information Security Policy', status: 'Approved' }];
    render(
      <ResponsiveTable
        ariaLabel="Policies"
        columns={[
          { key: 'title', header: 'Policy', primary: true, render: (row) => row.title },
          { key: 'status', header: 'Status', render: (row) => row.status },
        ]}
        rows={rows}
        getRowKey={(row) => row.id}
      />,
    );
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Policies' })).toBeTruthy();
    expect(screen.getByText('Information Security Policy')).toBeTruthy();
    expect(screen.queryByLabelText('Policies mobile records')).toBeNull();
  });

  it('closes the shared drawer on Escape and restores a connected close contract', () => {
    const onClose = vi.fn();
    render(<Drawer open title="Evidence details" onClose={onClose}><button type="button">View evidence</button></Drawer>);
    const drawer = screen.getByRole('dialog', { name: 'Evidence details' });
    fireEvent.keyDown(drawer, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Close drawer' })).toBeTruthy();
  });

  it('disables notification actions when no governed callback is supplied', () => {
    render(
      <NotificationCenter
        items={[{ id: 'notice-1', title: 'Approval pending', unread: true }]}
      />,
    );
    expect((screen.getByRole('button', { name: /Mark all as read/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Approval pending' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
