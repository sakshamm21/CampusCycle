import Papa from 'papaparse';

export interface CsvColumn<T> {
  key: keyof T;
  header: string;
}

export function exportCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns?: (keyof T | CsvColumn<T>)[],
) {
  let dataToExport: Record<string, unknown>[] = rows;

  if (columns) {
    dataToExport = rows.map((row) => {
      const formatted: Record<string, unknown> = {};
      for (const col of columns) {
        if (typeof col === 'object') {
          formatted[col.header] = row[col.key];
        } else {
          formatted[String(col)] = row[col];
        }
      }
      return formatted;
    });
  }

  const csv = Papa.unparse(dataToExport);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
