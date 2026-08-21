import type { ReactNode } from 'react';
import { ResponsiveTable } from './ui/ResponsiveTable';

interface EntityTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

interface EntityTableProps<T> {
  columns: EntityTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  getRowClassName?: (row: T) => string | undefined;
  ariaLabel?: string;
}

export function EntityTable<T>({ columns, rows, getRowKey, getRowClassName, ariaLabel = 'Records' }: EntityTableProps<T>) {
  return (
    <ResponsiveTable
      ariaLabel={ariaLabel}
      columns={columns.map((column, index) => ({ ...column, primary: index === 0 }))}
      rows={rows}
      getRowKey={getRowKey}
      getRowClassName={getRowClassName}
    />
  );
}
