import { fireEvent, render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { isDepartmentImportExecutionEnabled, isPatch83tUserExcelImportEnabled } from '../../src/config/featureFlags';
import { TextField } from '../../src/components/ui/FormControls';
import { Pagination, ResponsiveTable } from '../../src/components/ui/ResponsiveTable';

const root = process.cwd();
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('P3.5 final non-human coverage contract', () => {
  it('keeps import execution disabled unless the exact deployment flag is enabled', () => {
    for (const value of [undefined, null, '', 'TRUE', '1', true]) {
      expect(isDepartmentImportExecutionEnabled(value)).toBe(false);
      expect(isPatch83tUserExcelImportEnabled(value)).toBe(false);
    }
    expect(isDepartmentImportExecutionEnabled('true')).toBe(true);
    expect(isPatch83tUserExcelImportEnabled('true')).toBe(true);
  });

  it('enforces pagination boundaries and exposes current-page semantics', () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <Pagination page={1} pageCount={3} onPageChange={onPageChange} summary="Page 1 of 3" />,
    );

    expect((screen.getByRole('button', { name: 'Previous page' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(screen.getByRole('button', { name: '1' }).getAttribute('aria-current')).toBe('page');

    rerender(<Pagination page={3} pageCount={3} onPageChange={onPageChange} summary="Page 3 of 3" />);
    expect((screen.getByRole('button', { name: 'Next page' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    expect(screen.getByRole('button', { name: '3' }).getAttribute('aria-current')).toBe('page');
  });

  it('preserves labeled form errors and semantic responsive tables', () => {
    render(
      <>
        <TextField label="Record title" error="A title is required" />
        <ResponsiveTable
          ariaLabel="Governed records"
          columns={[{ key: 'name', header: 'Name', primary: true, render: (row: { id: string; name: string }) => row.name }]}
          rows={[{ id: 'one', name: 'First record' }]}
          getRowKey={(row) => row.id}
        />
      </>,
    );

    expect(screen.getByLabelText('Record title').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('A title is required');
    expect(screen.getByRole('region', { name: 'Governed records' })).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeTruthy();
  });

  it('keeps notification administration unavailable and keyboard focus visibly governed', () => {
    const administration = source('src/pages/AdministrationCenter.tsx');
    const modal = source('src/components/Modal.tsx');
    const styles = source('src/styles.css');

    expect(administration).toContain('No mutable, audited administration contract is currently exposed.');
    expect(administration).toContain("state: 'disabled_with_reason'");
    expect(modal).toContain("if (event.key !== 'Tab' || !dialogRef.current) return;");
    expect(modal).toContain('restoreFocusRef.current?.focus()');
    expect(styles).toContain(':focus-visible');
    expect(styles).toContain('[aria-invalid="true"]');
  });
});
