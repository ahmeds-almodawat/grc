import type { ReactNode } from 'react';

interface EntityTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

interface EntityTableProps<T> {
  columns: EntityTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
}

export function EntityTable<T>({ columns, rows, getRowKey }: EntityTableProps<T>) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {columns.map(column => <th key={column.key}>{column.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={getRowKey(row)}>
              {columns.map(column => <td key={column.key}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
