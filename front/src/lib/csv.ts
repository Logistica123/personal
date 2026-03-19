const escapeCsvValue = (value: string | number | null | undefined, delimiter = ','): string => {
  if (value === null || value === undefined) {
    return '""';
  }
  const stringValue = String(value);
  const needsQuotes = new RegExp(`[\\"\\n${delimiter}]`).test(stringValue);
  if (needsQuotes) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export const downloadCsv = (filename: string, rows: Array<Array<string | number | null | undefined>>) => {
  const prefersSemicolon = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);
  const delimiter = prefersSemicolon ? ';' : ',';
  const csvBody = rows
    .map((row) => row.map((value) => escapeCsvValue(value, delimiter)).join(delimiter))
    .join('\r\n');
  const separatorHint = prefersSemicolon ? `sep=${delimiter}\r\n` : '';
  const csv = `\ufeff${separatorHint}${csvBody}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

