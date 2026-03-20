import type { FacturacionBankMovement } from './types';

export const uniqueKey = () => Math.random().toString(36).slice(2);

export const parseDateTimeValue = (value: string): Date | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const dayFirstMatch = trimmed.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (dayFirstMatch) {
    const day = Number(dayFirstMatch[1]);
    const month = Number(dayFirstMatch[2]);
    const yearRaw = Number(dayFirstMatch[3]);
    const hour = Number(dayFirstMatch[4] ?? '0');
    const minute = Number(dayFirstMatch[5] ?? '0');
    const second = Number(dayFirstMatch[6] ?? '0');
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const parsed = new Date(year, month - 1, day, hour, minute, second);
    if (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day &&
      parsed.getHours() === hour &&
      parsed.getMinutes() === minute &&
      parsed.getSeconds() === second
    ) {
      return parsed;
    }
  }

  const normalized = trimmed.replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDateOnly = (value: string | null | undefined): string => {
  if (!value) {
    return '—';
  }
  const parsed = parseDateTimeValue(value);
  if (!parsed) {
    return value;
  }
  return parsed.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const normalizeFacturacionFormatoCode = (value: string | null | undefined): string => {
  const raw = (value ?? '').trim();
  if (!raw) {
    return '';
  }
  const digits = raw.replace(/\D+/g, '');
  if (!digits) {
    return raw.toUpperCase();
  }
  return digits.padStart(2, '0');
};

export const normalizeFacturacionToken = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const parseFacturacionAmountValue = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const cleaned = raw
    .replace(/\s+/g, '')
    .replace(/\$/g, '')
    .replace(/ars/gi, '')
    .replace(/usd/gi, '');
  const isNegative = cleaned.startsWith('-') || (cleaned.startsWith('(') && cleaned.endsWith(')'));
  const unsigned = cleaned.replace(/[-()]/g, '');

  let normalized = unsigned;
  if (unsigned.includes(',') && unsigned.includes('.')) {
    if (unsigned.lastIndexOf(',') > unsigned.lastIndexOf('.')) {
      normalized = unsigned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = unsigned.replace(/,/g, '');
    }
  } else if (unsigned.includes(',')) {
    normalized = unsigned.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(unsigned)) {
    normalized = unsigned.replace(/\./g, '');
  } else {
    normalized = unsigned.replace(/,/g, '');
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return isNegative ? -Math.abs(numeric) : numeric;
};

export const parseNumberOrZero = (value: string | number | null | undefined): number => {
  const parsed = parseFacturacionAmountValue(value);
  return parsed === null ? 0 : parsed;
};

export const splitFacturacionDelimitedLine = (line: string, delimiter: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

export const detectFacturacionDelimiter = (line: string): string => {
  const candidates = [';', ',', '\t'];
  const scored = candidates
    .map((delimiter) => ({ delimiter, count: line.split(delimiter).length - 1 }))
    .sort((a, b) => b.count - a.count);
  return scored[0]?.count > 0 ? scored[0].delimiter : ';';
};

export const parseFacturacionBankMovements = (content: string): FacturacionBankMovement[] => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const firstLine = lines[0].replace(/^\uFEFF/, '');
  const delimiter = detectFacturacionDelimiter(firstLine);
  const rows = [firstLine, ...lines.slice(1)].map((line) => splitFacturacionDelimitedLine(line, delimiter));
  const normalizedHeaders = rows[0].map((value) => normalizeFacturacionToken(value));
  const hasHeader = normalizedHeaders.some((value) =>
    ['fecha', 'date', 'descripcion', 'detalle', 'concepto', 'referencia', 'monto', 'importe', 'amount'].includes(value)
  );

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const findHeaderIndex = (aliases: string[]) =>
    normalizedHeaders.findIndex((header) => aliases.some((alias) => header === alias || header.includes(alias)));

  const dateIndex = findHeaderIndex(['fecha', 'date']);
  const descriptionIndex = findHeaderIndex(['descripcion', 'detalle', 'concepto']);
  const referenceIndex = findHeaderIndex(['referencia', 'ref', 'comprobante', 'operacion', 'operacion id']);
  const amountIndex = findHeaderIndex(['monto', 'importe', 'amount', 'credito', 'haber', 'abono']);

  const parsed: FacturacionBankMovement[] = [];
  dataRows.forEach((columns, index) => {
    if (columns.length === 0) {
      return;
    }
    const rawAmount = amountIndex >= 0 ? columns[amountIndex] : columns[columns.length - 1];
    const amount = parseFacturacionAmountValue(rawAmount);
    if (amount === null) {
      return;
    }

    const dateValue =
      (dateIndex >= 0 ? columns[dateIndex] : columns[0]) || new Date().toISOString().slice(0, 10);
    const descriptionValue =
      (descriptionIndex >= 0 ? columns[descriptionIndex] : columns[1]) ||
      columns[0] ||
      `Movimiento ${index + 1}`;
    const referenceValue = (referenceIndex >= 0 ? columns[referenceIndex] : columns[2]) || '';

    parsed.push({
      id: `mov-${Date.now()}-${index}-${uniqueKey()}`,
      fecha: dateValue,
      descripcion: descriptionValue,
      referencia: referenceValue,
      monto: amount,
    });
  });

  return parsed;
};

export const buildFacturacionInvoiceNumber = () => {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const random = Math.floor(1000 + Math.random() * 9000);
  return `FA-MOCK-${stamp}-${random}`;
};

