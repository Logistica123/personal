import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Cliente } from '../features/clientes/types';

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  layoutVariant?: 'default' | 'panel';
  monitorView?: boolean;
};

type AuthUser = {
  id: number;
  name: string | null;
  email: string | null;
  role?: string | null;
  token?: string | null;
  permissions?: string[] | null;
};

type RecibosPageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  buildActorHeaders: (user: AuthUser | null) => Record<string, string> | null | undefined;
  parseJsonSafe: (response: Response) => Promise<any>;
  formatDateTime: (value?: string | null) => string;
};

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const parseDateTimeValue = (value: string): Date | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map((chunk) => Number(chunk));
    if (!year || !month || !day) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  const mysqlMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (mysqlMatch) {
    const [, y, m, d, hh, mm, ss] = mysqlMatch;
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      ss ? Number(ss) : 0
    );
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

type ReciboComprobante = {
  id: string;
  fecha: string;
  numeroFactura: string;
  totalFactura: string;
  imputado: string;
};

type ReciboDraft = {
  puntoVenta: string;
  numeroRecibo: string;
  autoNumeroRecibo: boolean;
  autoNumeroFactura: boolean;
  fecha: string;
  empresaNombre: string;
  empresaDireccion1: string;
  empresaDireccion2: string;
  empresaIva: string;
  empresaCuit: string;
  empresaInicioActividad: string;
  clienteId: string;
  clienteNombre: string;
  clienteDireccion1: string;
  clienteDireccion2: string;
  clienteCuit: string;
  clienteIva: string;
  fechaCobro: string;
  detalleCobro: string;
  importeRecibido: string;
  retencionesIva: string;
  retencionesIibb: string;
  retencionesGanancias: string;
  comprobantes: ReciboComprobante[];
};

type LiquidacionReciboEstado = 'emitido' | 'anulado';

type LiquidacionReciboRecord = {
  id: number;
  puntoVenta: string;
  numeroRecibo: string;
  serial: string;
  fecha: string | null;
  estado: LiquidacionReciboEstado;
  totalCobro: number | string | null;
  totalImputado: number | string | null;
  emitidoPor?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  anuladoAt?: string | null;
  anuladoPor?: string | null;
  anuladoLeyenda?: string | null;
  anuladoMotivo?: string | null;
  clienteNombre?: string | null;
  draft?: Partial<ReciboDraft> | null;
};

type TaxProfileRecord = {
  ivaCondition?: string | null;
};

const RECIBOS_STORAGE_KEY = 'liquidaciones.recibosDraft';

const createReciboComprobante = (seed?: Partial<ReciboComprobante>): ReciboComprobante => ({
  id: seed?.id ?? `comp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  fecha: seed?.fecha ?? '',
  numeroFactura: seed?.numeroFactura ?? '',
  totalFactura: seed?.totalFactura ?? '',
  imputado: seed?.imputado ?? '',
});

const createDefaultReciboDraft = (): ReciboDraft => ({
  puntoVenta: '0001',
  numeroRecibo: '00000005',
  autoNumeroRecibo: true,
  autoNumeroFactura: true,
  fecha: '2025-10-01',
  empresaNombre: 'LOGISTICA ARGENTINA SRL',
  empresaDireccion1: 'SAN CAYETANO 3470',
  empresaDireccion2: 'SAN CAYETANO - CORRIENTES',
  empresaIva: 'I.V.A. RESPONSABLE INSCRIPTO',
  empresaCuit: '30-71706098-5',
  empresaInicioActividad: '2020-08-11',
  clienteId: '',
  clienteNombre: '',
  clienteDireccion1: '',
  clienteDireccion2: '',
  clienteCuit: '',
  clienteIva: '',
  fechaCobro: '2025-07-15',
  detalleCobro: 'ECHEQ BANCO SUPERVIELLE',
  importeRecibido: '8406974,86',
  retencionesIva: '',
  retencionesIibb: '288033,40',
  retencionesGanancias: '18002,09',
  comprobantes: [
    createReciboComprobante({
      fecha: '2025-05-31',
      numeroFactura: '00002-00000167',
      totalFactura: '8713010,35',
      imputado: '8713010,35',
    }),
  ],
});

const parseLocalizedDecimal = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let normalized = trimmed.replace(/\s+/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatReciboAmount = (
  value: string | number | null | undefined,
  options?: { emptyAsZero?: boolean; withCurrency?: boolean }
): string => {
  const numeric = parseLocalizedDecimal(value);
  if (numeric === null) {
    if (options?.emptyAsZero) {
      return options?.withCurrency ? currencyFormatter.format(0) : numberFormatter.format(0);
    }
    return '—';
  }
  return options?.withCurrency ? currencyFormatter.format(numeric) : numberFormatter.format(numeric);
};

const formatReciboDate = (value: string | null | undefined): string => {
  if (!value) {
    return '—';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '—';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-');
    return `${day}/${month}/${year}`;
  }
  const parsed = parseDateTimeValue(trimmed);
  if (!parsed) {
    return trimmed;
  }
  return parsed.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatReciboSerial = (value: string, size: number): string => {
  const digits = value.replace(/\D+/g, '');
  if (!digits) {
    return ''.padStart(size, '0');
  }
  return digits.slice(-size).padStart(size, '0');
};

const incrementFormattedNumber = (value: string, fallbackSize = 1): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return String(1).padStart(fallbackSize, '0');
  }

  const match = trimmed.match(/(\d+)(?!.*\d)/);
  if (!match || match.index == null) {
    return trimmed;
  }

  const digits = match[1];
  const nextValue = String(Number(digits) + 1).padStart(digits.length, '0');
  return `${trimmed.slice(0, match.index)}${nextValue}${trimmed.slice(match.index + digits.length)}`;
};

const normalizeTextValue = (value: string | null | undefined): string => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const buildReciboClienteDraft = (cliente: Cliente, ivaCondition?: string | null) => {
  const direccionCliente = normalizeTextValue(cliente.direccion);
  const preferredSucursal =
    cliente.sucursales.find((item) => normalizeTextValue(item.direccion) || normalizeTextValue(item.nombre)) ?? null;
  const sucursalDireccion = normalizeTextValue(preferredSucursal?.direccion);
  const sucursalNombre = normalizeTextValue(preferredSucursal?.nombre);
  const clienteNombre = normalizeTextValue(cliente.nombre);
  const clienteCuit = normalizeTextValue(cliente.documento_fiscal);
  const clienteIva = normalizeTextValue(ivaCondition);
  const clienteDireccion1 = direccionCliente || sucursalDireccion;
  const clienteDireccion2 =
    [sucursalDireccion, sucursalNombre].find((value) => value && value !== clienteDireccion1) ?? '';

  return {
    clienteId: String(cliente.id),
    clienteNombre,
    clienteDireccion1,
    clienteDireccion2,
    clienteCuit,
    clienteIva,
  };
};

const applyReciboEmpresaDefaults = (draft: ReciboDraft): ReciboDraft => {
  const fallback = createDefaultReciboDraft();
  const next: ReciboDraft = { ...draft };

  (
    [
      'puntoVenta',
      'fecha',
      'empresaNombre',
      'empresaDireccion1',
      'empresaDireccion2',
      'empresaIva',
      'empresaCuit',
      'empresaInicioActividad',
    ] as const
  ).forEach((field) => {
    const currentValue = normalizeTextValue(next[field]);
    if (!currentValue) {
      next[field] = fallback[field];
    }
  });

  return next;
};

const normalizeReciboDraft = (raw?: Partial<ReciboDraft> | null): ReciboDraft => {
  const fallback = createDefaultReciboDraft();
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const comprobantes = Array.isArray(raw.comprobantes)
    ? raw.comprobantes
        .filter((item) => Boolean(item) && typeof item === 'object')
        .map((item) => createReciboComprobante(item as Partial<ReciboComprobante>))
    : fallback.comprobantes;

  return {
    ...fallback,
    ...raw,
    comprobantes: comprobantes.length > 0 ? comprobantes : fallback.comprobantes,
  };
};

const readStoredReciboDraft = (): ReciboDraft => {
  if (typeof window === 'undefined') {
    return createDefaultReciboDraft();
  }

  try {
    const raw = window.localStorage.getItem(RECIBOS_STORAGE_KEY);
    if (!raw) {
      return createDefaultReciboDraft();
    }

    const parsed = JSON.parse(raw) as Partial<ReciboDraft> | null;
    return applyReciboEmpresaDefaults(normalizeReciboDraft(parsed));
  } catch {
    return createDefaultReciboDraft();
  }
};

const buildNextReciboDraft = (draft: ReciboDraft): ReciboDraft => ({
  ...draft,
  numeroRecibo: draft.autoNumeroRecibo ? incrementFormattedNumber(draft.numeroRecibo, 8) : draft.numeroRecibo,
  comprobantes: draft.autoNumeroFactura
    ? draft.comprobantes.map((item) => ({
        ...item,
        numeroFactura: item.numeroFactura ? incrementFormattedNumber(item.numeroFactura) : incrementFormattedNumber('', 8),
      }))
    : draft.comprobantes,
});

const buildReciboWatermarkText = (recibo: LiquidacionReciboRecord | null): string | null => {
  if (!recibo || recibo.estado !== 'anulado') {
    return null;
  }

  const customLabel = recibo.anuladoLeyenda?.trim();
  return customLabel && customLabel.length > 0 ? customLabel : 'RECIBO ANULADO';
};

const buildReciboPrintHtml = (
  draft: ReciboDraft,
  options: {
    pointOfSaleLabel: string;
    receiptNumberLabel: string;
    totalCobro: number;
    totalImputado: number;
    watermarkText?: string | null;
  }
): string => {
  const logoUrl = typeof window !== 'undefined' ? `${window.location.origin}/logo-empresa.png` : '/logo-empresa.png';
  const rowsHtml = draft.comprobantes
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(formatReciboDate(item.fecha))}</td>
          <td>${escapeHtml(item.numeroFactura || '—')}</td>
          <td style="text-align:right;">${escapeHtml(formatReciboAmount(item.totalFactura))}</td>
          <td style="text-align:right;">${escapeHtml(formatReciboAmount(item.imputado))}</td>
        </tr>
      `
    )
    .join('');
  const watermarkHtml = options.watermarkText
    ? `<div class="recibo-print__watermark"><span>${escapeHtml(options.watermarkText)}</span></div>`
    : '';

  return `<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Recibo ${options.pointOfSaleLabel}-${options.receiptNumberLabel}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #111827;
            font-family: Arial, Helvetica, sans-serif;
            background: #ffffff;
          }
          .recibo-print {
            position: relative;
            width: 100%;
            overflow: hidden;
            border: 1px solid #111827;
          }
          .recibo-print__watermark {
            position: absolute;
            inset: 0;
            z-index: 5;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
          }
          .recibo-print__watermark span {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: min(62%, 540px);
            max-width: calc(100% - 144px);
            padding: 18px 26px;
            border: 6px solid rgba(220, 38, 38, 0.72);
            color: rgba(220, 38, 38, 0.34);
            font-size: 42px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            line-height: 0.92;
            text-align: center;
            transform: rotate(-28deg);
            white-space: normal;
          }
          .recibo-print__top {
            display: grid;
            grid-template-columns: 1.4fr 0.42fr 0.88fr;
            border-bottom: 1px solid #111827;
          }
          .recibo-print__company,
          .recibo-print__voucher,
          .recibo-print__meta,
          .recibo-print__client,
          .recibo-print__amounts,
          .recibo-print__table,
          .recibo-print__footer {
            padding: 10px 12px;
          }
          .recibo-print__company {
            min-height: 158px;
          }
          .recibo-print__voucher {
            border-left: 1px solid #111827;
            border-right: 1px solid #111827;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
            text-align: center;
          }
          .recibo-print__voucher-letter {
            font-size: 70px;
            line-height: 1;
          }
          .recibo-print__voucher-text {
            font-size: 14px;
            font-weight: 700;
            line-height: 1.4;
          }
          .recibo-print__meta-title {
            font-size: 24px;
            font-weight: 800;
            letter-spacing: 0.04em;
            text-align: center;
          }
          .recibo-print__meta-serial {
            margin-top: 4px;
            font-size: 18px;
            text-align: center;
          }
          .recibo-print__meta-grid,
          .recibo-print__client-grid,
          .recibo-print__amount-grid {
            display: grid;
            gap: 6px 16px;
          }
          .recibo-print__meta-grid {
            grid-template-columns: 1fr auto;
            margin-top: 18px;
          }
          .recibo-print__client {
            display: grid;
            grid-template-columns: 1.8fr 0.9fr;
            gap: 24px;
            border-bottom: 1px solid #111827;
          }
          .recibo-print__amounts {
            padding-top: 14px;
            padding-bottom: 16px;
          }
          .recibo-print__amount-grid {
            grid-template-columns: 1fr auto;
            max-width: 560px;
          }
          .recibo-print__amount-grid--total {
            font-weight: 800;
            margin-top: 2px;
          }
          .recibo-print__label {
            font-weight: 700;
          }
          .recibo-print__value-right {
            text-align: right;
          }
          .recibo-print__logo {
            max-width: 230px;
            max-height: 86px;
            display: block;
            margin-bottom: 10px;
          }
          .recibo-print__company-lines {
            display: flex;
            flex-direction: column;
            gap: 2px;
            font-size: 13px;
            line-height: 1.25;
          }
          .recibo-print__company-lines strong {
            font-size: 14px;
          }
          .recibo-print__table {
            border-top: 1px solid #111827;
          }
          .recibo-print__table-title {
            margin-bottom: 2px;
            font-size: 14px;
            font-weight: 800;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            background: #ffffff;
          }
          th, td {
            padding: 4px 6px;
            border: 1px solid #111827;
          }
          th {
            text-align: left;
          }
          .recibo-print__footer {
            display: flex;
            justify-content: flex-end;
            gap: 14px;
            border-top: 1px solid #111827;
            font-size: 15px;
            font-weight: 800;
          }
        </style>
      </head>
      <body>
        <article class="recibo-print">
          ${watermarkHtml}
          <section class="recibo-print__top">
            <div class="recibo-print__company">
              <img class="recibo-print__logo" src="${escapeHtml(logoUrl)}" alt="Logo empresa" />
              <div class="recibo-print__company-lines">
                <strong>${escapeHtml(draft.empresaNombre)}</strong>
                <span>${escapeHtml(draft.empresaDireccion1)}</span>
                <span>${escapeHtml(draft.empresaDireccion2)}</span>
                <span>${escapeHtml(draft.empresaIva)}</span>
              </div>
            </div>
            <div class="recibo-print__voucher">
              <div class="recibo-print__voucher-letter">X</div>
              <div class="recibo-print__voucher-text">DOCUMENTO<br />NO VALIDO<br />COMO FACTURA</div>
            </div>
            <div class="recibo-print__meta">
              <div class="recibo-print__meta-title">RECIBO</div>
              <div class="recibo-print__meta-serial">${escapeHtml(options.pointOfSaleLabel)} - ${escapeHtml(options.receiptNumberLabel)}</div>
              <div class="recibo-print__meta-grid">
                <span class="recibo-print__label">FECHA:</span>
                <span>${escapeHtml(formatReciboDate(draft.fecha))}</span>
                <span class="recibo-print__label">CUIT:</span>
                <span>${escapeHtml(draft.empresaCuit || '—')}</span>
                <span class="recibo-print__label">INICIO DE ACT.:</span>
                <span>${escapeHtml(formatReciboDate(draft.empresaInicioActividad))}</span>
              </div>
            </div>
          </section>
          <section class="recibo-print__client">
            <div class="recibo-print__client-grid">
              <span><span class="recibo-print__label">CLIENTE</span> ${escapeHtml(draft.clienteNombre || '—')}</span>
              <span><span class="recibo-print__label">DIRECCION</span> ${escapeHtml(draft.clienteDireccion1 || '—')}</span>
              <span>${escapeHtml(draft.clienteDireccion2 || '')}</span>
            </div>
            <div class="recibo-print__client-grid">
              <span><span class="recibo-print__label">CUIT</span> ${escapeHtml(draft.clienteCuit || '—')}</span>
              <span><span class="recibo-print__label">IVA</span> ${escapeHtml(draft.clienteIva || '—')}</span>
            </div>
          </section>
          <section class="recibo-print__amounts">
            <div class="recibo-print__amount-grid">
              <span class="recibo-print__label">FECHA DEL COBRO</span>
              <span class="recibo-print__value-right">${escapeHtml(formatReciboDate(draft.fechaCobro))}</span>
              <span class="recibo-print__label">DETALLE DEL COBRO</span>
              <span class="recibo-print__value-right">${escapeHtml(draft.detalleCobro || '—')}</span>
              <span class="recibo-print__label">IMPORTE RECIBIDO</span>
              <span class="recibo-print__value-right">${escapeHtml(formatReciboAmount(draft.importeRecibido, { emptyAsZero: true }))}</span>
              <span class="recibo-print__label">RETENCIONES IVA</span>
              <span class="recibo-print__value-right">${escapeHtml(formatReciboAmount(draft.retencionesIva, { emptyAsZero: true }))}</span>
              <span class="recibo-print__label">RETENCIONES IIBB</span>
              <span class="recibo-print__value-right">${escapeHtml(formatReciboAmount(draft.retencionesIibb, { emptyAsZero: true }))}</span>
              <span class="recibo-print__label">RETENCIONES GANANCIAS</span>
              <span class="recibo-print__value-right">${escapeHtml(formatReciboAmount(draft.retencionesGanancias, { emptyAsZero: true }))}</span>
              <span class="recibo-print__label recibo-print__amount-grid--total">TOTAL COBRO</span>
              <span class="recibo-print__value-right recibo-print__amount-grid--total">${escapeHtml(formatReciboAmount(options.totalCobro, { emptyAsZero: true }))}</span>
            </div>
          </section>
          <section class="recibo-print__table">
            <div class="recibo-print__table-title">DETALLE DE COMPROBANTES IMPUTADOS</div>
            <table>
              <thead>
                <tr>
                  <th>FECHA</th>
                  <th>N° FACT</th>
                  <th>TOTAL FACT</th>
                  <th>IMPUTADO</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colspan="4">Sin comprobantes imputados.</td></tr>'}
              </tbody>
            </table>
          </section>
          <section class="recibo-print__footer">
            <span>TOTAL IMPUTADO</span>
            <span>${escapeHtml(formatReciboAmount(options.totalImputado, { emptyAsZero: true }))}</span>
          </section>
        </article>
      </body>
    </html>`;
};

export const RecibosPage: React.FC<RecibosPageProps> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  buildActorHeaders,
  parseJsonSafe,
  formatDateTime,
}) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const authUser = useStoredAuthUser();
  const actorHeaders = useMemo(() => buildActorHeaders(authUser) ?? {}, [authUser, buildActorHeaders]);
  const [draft, setDraft] = useState<ReciboDraft>(() => applyReciboEmpresaDefaults(readStoredReciboDraft()));
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [clientesError, setClientesError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<LiquidacionReciboRecord[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptsError, setReceiptsError] = useState<string | null>(null);
  const [receiptSearch, setReceiptSearch] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<LiquidacionReciboRecord | null>(null);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [annullingReceipt, setAnnullingReceipt] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);
  const clientIvaCacheRef = useRef<Record<number, string>>({});

  useEffect(() => {
    if (typeof window === 'undefined' || selectedReceipt) {
      return;
    }

    try {
      window.localStorage.setItem(RECIBOS_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // ignore storage failures
    }
  }, [draft, selectedReceipt]);

  const pointOfSaleLabel = useMemo(() => formatReciboSerial(draft.puntoVenta, 4), [draft.puntoVenta]);
  const receiptNumberLabel = useMemo(() => formatReciboSerial(draft.numeroRecibo, 8), [draft.numeroRecibo]);
  const totalCobro = useMemo(
    () =>
      (parseLocalizedDecimal(draft.importeRecibido) ?? 0) +
      (parseLocalizedDecimal(draft.retencionesIva) ?? 0) +
      (parseLocalizedDecimal(draft.retencionesIibb) ?? 0) +
      (parseLocalizedDecimal(draft.retencionesGanancias) ?? 0),
    [draft.importeRecibido, draft.retencionesGanancias, draft.retencionesIibb, draft.retencionesIva]
  );
  const totalImputado = useMemo(
    () => draft.comprobantes.reduce((sum, item) => sum + (parseLocalizedDecimal(item.imputado) ?? 0), 0),
    [draft.comprobantes]
  );
  const watermarkText = useMemo(() => buildReciboWatermarkText(selectedReceipt), [selectedReceipt]);
  const editorDisabled = Boolean(selectedReceipt);

  const loadReceipts = useCallback(
    async (searchText = '') => {
      try {
        setReceiptsLoading(true);
        setReceiptsError(null);

        const url = new URL(`${apiBaseUrl}/api/liquidaciones/recibos`);
        if (searchText.trim()) {
          url.searchParams.set('q', searchText.trim());
        }
        url.searchParams.set('per_page', '25');

        const response = await fetch(url.toString(), {
          headers: {
            Accept: 'application/json',
            ...actorHeaders,
          },
        });
        const payload = (await parseJsonSafe(response)) as {
          data?: LiquidacionReciboRecord[];
          message?: string;
        };

        if (!response.ok) {
          throw new Error(payload?.message ?? 'No se pudieron cargar los recibos emitidos.');
        }

        setReceipts(Array.isArray(payload?.data) ? payload.data : []);
      } catch (err) {
        setReceipts([]);
        setReceiptsError((err as Error).message ?? 'No se pudieron cargar los recibos emitidos.');
      } finally {
        setReceiptsLoading(false);
      }
    },
    [actorHeaders, apiBaseUrl, parseJsonSafe]
  );

  const loadClientes = useCallback(async () => {
    try {
      setClientesLoading(true);
      setClientesError(null);

      const response = await fetch(`${apiBaseUrl}/api/clientes`, {
        headers: {
          Accept: 'application/json',
          ...actorHeaders,
        },
      });
      const payload = (await parseJsonSafe(response)) as {
        data?: Cliente[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudieron cargar los clientes.');
      }

      setClientes(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      setClientes([]);
      setClientesError((err as Error).message ?? 'No se pudieron cargar los clientes.');
    } finally {
      setClientesLoading(false);
    }
  }, [actorHeaders, apiBaseUrl, parseJsonSafe]);

  const fetchClienteIvaCondition = useCallback(
    async (clienteId: number): Promise<string> => {
      if (!Number.isFinite(clienteId) || clienteId <= 0) {
        return '';
      }

      if (Object.prototype.hasOwnProperty.call(clientIvaCacheRef.current, clienteId)) {
        return clientIvaCacheRef.current[clienteId] ?? '';
      }

      const response = await fetch(`${apiBaseUrl}/api/clientes/${clienteId}/legajo-impositivo`, {
        headers: {
          Accept: 'application/json',
          ...actorHeaders,
        },
      });
      const payload = (await parseJsonSafe(response)) as {
        data?: TaxProfileRecord;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo cargar la condición impositiva del cliente.');
      }

      const ivaCondition = normalizeTextValue(payload?.data?.ivaCondition);
      clientIvaCacheRef.current[clienteId] = ivaCondition;
      return ivaCondition;
    },
    [actorHeaders, apiBaseUrl, parseJsonSafe]
  );

  useEffect(() => {
    void loadClientes();
  }, [loadClientes]);

  useEffect(() => {
    void loadReceipts();
  }, [loadReceipts]);

  useEffect(() => {
    if (clientes.length === 0) {
      return;
    }

    setDraft((prev) => {
      if (prev.clienteId) {
        return prev;
      }

      const normalizedNombre = normalizeTextValue(prev.clienteNombre).toLowerCase();
      if (!normalizedNombre) {
        return prev;
      }

      const matchedClient = clientes.find((cliente) => normalizeTextValue(cliente.nombre).toLowerCase() === normalizedNombre);
      if (!matchedClient) {
        return prev;
      }

      return {
        ...prev,
        clienteId: String(matchedClient.id),
      };
    });
  }, [clientes]);

  const handleFieldChange = useCallback(
    (field: keyof Omit<ReciboDraft, 'comprobantes' | 'autoNumeroRecibo' | 'autoNumeroFactura'>) =>
      (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const nextValue = event.target.value;
        setDraft((prev) => ({ ...prev, [field]: nextValue }));
      },
    []
  );

  const handleToggleChange = useCallback(
    (field: 'autoNumeroRecibo' | 'autoNumeroFactura') =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const nextValue = event.target.checked;
        setDraft((prev) => ({ ...prev, [field]: nextValue }));
      },
    []
  );

  const handleClienteNombreChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextNombre = event.target.value;
      const normalizedNombre = normalizeTextValue(nextNombre).toLowerCase();
      const matchedClient =
        normalizedNombre.length > 0
          ? clientes.find((cliente) => normalizeTextValue(cliente.nombre).toLowerCase() === normalizedNombre) ?? null
          : null;

      setDraft((prev) => {
        if (!matchedClient) {
          return {
            ...prev,
            clienteNombre: nextNombre,
            clienteId: normalizedNombre ? '' : prev.clienteId,
          };
        }

        return {
          ...prev,
          ...buildReciboClienteDraft(matchedClient),
        };
      });

      if (!matchedClient) {
        return;
      }

      try {
        setActionError(null);
        const ivaCondition = await fetchClienteIvaCondition(matchedClient.id);
        setDraft((prev) => {
          if (prev.clienteId !== String(matchedClient.id)) {
            return prev;
          }
          if (normalizeTextValue(prev.clienteIva)) {
            return prev;
          }
          return { ...prev, clienteIva: ivaCondition };
        });
      } catch (err) {
        setActionError((err as Error).message ?? 'No se pudo completar la condición impositiva del cliente.');
      }
    },
    [clientes, fetchClienteIvaCondition]
  );

  const handleComprobanteChange = useCallback((id: string, field: keyof Omit<ReciboComprobante, 'id'>, value: string) => {
    setDraft((prev) => ({
      ...prev,
      comprobantes: prev.comprobantes.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  }, []);

  const handleAddComprobante = useCallback(() => {
    setDraft((prev) => ({ ...prev, comprobantes: [...prev.comprobantes, createReciboComprobante()] }));
  }, []);

  const handleRemoveComprobante = useCallback((id: string) => {
    setDraft((prev) => {
      if (prev.comprobantes.length === 1) {
        return { ...prev, comprobantes: [createReciboComprobante()] };
      }
      return { ...prev, comprobantes: prev.comprobantes.filter((item) => item.id !== id) };
    });
  }, []);

  const handleReset = useCallback(() => {
    setSelectedReceipt(null);
    setDraft(createDefaultReciboDraft());
    setActionError(null);
    setActionInfo('Borrador restablecido.');
  }, []);

  const handleNewDraft = useCallback(() => {
    setSelectedReceipt(null);
    setDraft(readStoredReciboDraft());
    setActionError(null);
    setActionInfo(null);
  }, []);

  const openPrintWindow = useCallback((html: string) => {
    const win = window.open('', '_blank');
    if (!win) {
      window.alert('No se pudo abrir la vista de impresión.');
      return false;
    }

    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    return true;
  }, []);

  const handleSelectReceipt = useCallback((receipt: LiquidacionReciboRecord) => {
    setSelectedReceipt(receipt);
    setDraft(applyReciboEmpresaDefaults(normalizeReciboDraft(receipt.draft)));
    setActionError(null);
    setActionInfo(`Recibo ${receipt.serial} cargado para reimpresión.`);
  }, []);

  const handleSearchReceipts = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await loadReceipts(receiptSearch);
    },
    [loadReceipts, receiptSearch]
  );

  const previewHtml = useMemo(
    () =>
      buildReciboPrintHtml(draft, {
        pointOfSaleLabel,
        receiptNumberLabel,
        totalCobro,
        totalImputado,
        watermarkText,
      }),
    [draft, pointOfSaleLabel, receiptNumberLabel, totalCobro, totalImputado, watermarkText]
  );

  const handlePrint = useCallback(async () => {
    setActionError(null);
    setActionInfo(null);

    if (selectedReceipt) {
      if (openPrintWindow(previewHtml)) {
        setActionInfo(`Recibo ${selectedReceipt.serial} enviado a impresión.`);
      }
      return;
    }

    try {
      setSavingReceipt(true);
      const draftToSave = applyReciboEmpresaDefaults(draft);

      const response = await fetch(`${apiBaseUrl}/api/liquidaciones/recibos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...actorHeaders,
        },
        body: JSON.stringify({
          draft: draftToSave,
          totalCobro,
          totalImputado,
        }),
      });
      const payload = (await parseJsonSafe(response)) as {
        message?: string;
        data?: LiquidacionReciboRecord;
      };

      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo emitir el recibo.');
      }

      const savedReceipt = payload?.data;
      if (!savedReceipt) {
        throw new Error('No se recibió el recibo emitido desde el servidor.');
      }

      const savedDraft = applyReciboEmpresaDefaults(normalizeReciboDraft(savedReceipt.draft));
      const savedPointOfSaleLabel = formatReciboSerial(savedReceipt.puntoVenta || savedDraft.puntoVenta, 4);
      const savedReceiptNumberLabel = formatReciboSerial(savedReceipt.numeroRecibo || savedDraft.numeroRecibo, 8);
      const savedTotalCobro = parseLocalizedDecimal(savedReceipt.totalCobro) ?? totalCobro;
      const savedTotalImputado = parseLocalizedDecimal(savedReceipt.totalImputado) ?? totalImputado;
      openPrintWindow(
        buildReciboPrintHtml(savedDraft, {
          pointOfSaleLabel: savedPointOfSaleLabel,
          receiptNumberLabel: savedReceiptNumberLabel,
          totalCobro: savedTotalCobro,
          totalImputado: savedTotalImputado,
        })
      );

      setDraft((prev) => buildNextReciboDraft(applyReciboEmpresaDefaults(prev)));
      setActionInfo(payload?.message ?? `Recibo ${savedReceipt.serial} emitido correctamente.`);
      await loadReceipts(receiptSearch);
    } catch (err) {
      setActionError((err as Error).message ?? 'No se pudo emitir el recibo.');
    } finally {
      setSavingReceipt(false);
    }
  }, [actorHeaders, apiBaseUrl, draft, loadReceipts, openPrintWindow, parseJsonSafe, previewHtml, receiptSearch, selectedReceipt, totalCobro, totalImputado]);

  const handleAnular = useCallback(async () => {
    if (!selectedReceipt || selectedReceipt.estado === 'anulado') {
      return;
    }

    const leyendaInput = window.prompt('Leyenda de anulación', selectedReceipt.anuladoLeyenda?.trim() || 'RECIBO ANULADO');
    if (leyendaInput === null) {
      return;
    }
    const leyenda = leyendaInput.trim() || 'RECIBO ANULADO';
    const motivoInput = window.prompt('Motivo de anulación (opcional)', selectedReceipt.anuladoMotivo?.trim() || '');
    if (motivoInput === null) {
      return;
    }

    try {
      setAnnullingReceipt(true);
      setActionError(null);
      setActionInfo(null);

      const response = await fetch(`${apiBaseUrl}/api/liquidaciones/recibos/${selectedReceipt.id}/anular`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...actorHeaders,
        },
        body: JSON.stringify({
          leyenda,
          motivo: motivoInput.trim() || null,
        }),
      });
      const payload = (await parseJsonSafe(response)) as {
        message?: string;
        data?: LiquidacionReciboRecord;
      };

      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo anular el recibo.');
      }

      if (payload?.data) {
        setSelectedReceipt(payload.data);
        setDraft(normalizeReciboDraft(payload.data.draft));
      }
      setActionInfo(payload?.message ?? 'Recibo anulado correctamente.');
      await loadReceipts(receiptSearch);
    } catch (err) {
      setActionError((err as Error).message ?? 'No se pudo anular el recibo.');
    } finally {
      setAnnullingReceipt(false);
    }
  }, [actorHeaders, apiBaseUrl, loadReceipts, parseJsonSafe, receiptSearch, selectedReceipt]);

  return (
    <DashboardLayout
      title="Liquidaciones"
      subtitle="Recibos"
      headerContent={
        <div className="filters-actions">
          <button type="button" className="secondary-action" onClick={handleNewDraft}>
            Nuevo borrador
          </button>
          {!selectedReceipt ? (
            <button type="button" className="secondary-action" onClick={handleReset}>
              Restablecer ejemplo
            </button>
          ) : null}
          {selectedReceipt && selectedReceipt.estado !== 'anulado' ? (
            <button type="button" className="secondary-action" onClick={() => void handleAnular()} disabled={annullingReceipt}>
              {annullingReceipt ? 'Anulando...' : 'Anular recibo'}
            </button>
          ) : null}
          <button type="button" className="primary-action" onClick={() => void handlePrint()} disabled={savingReceipt}>
            {savingReceipt ? 'Emitiendo...' : selectedReceipt ? 'Reimprimir recibo' : 'Emitir e imprimir'}
          </button>
        </div>
      }
    >
      <div className="recibos-page">
        <section className="dashboard-card recibos-editor">
          <header className="card-header">
            <div>
              <h3>Datos editables</h3>
            </div>
          </header>
          <div className="card-body">
            <div className="recibos-editor__group">
              <div className="recibos-editor__table-header">
                <h4>Recibos emitidos</h4>
                <form className="recibos-history__search" onSubmit={handleSearchReceipts}>
                  <input
                    value={receiptSearch}
                    onChange={(event) => setReceiptSearch(event.target.value)}
                    placeholder="Buscar por número o cliente"
                  />
                  <button type="submit" className="secondary-action" disabled={receiptsLoading}>
                    Buscar
                  </button>
                </form>
              </div>
              <div className="recibos-history">
                {receiptsLoading ? <p className="helper-text">Cargando recibos emitidos...</p> : null}
                {!receiptsLoading && receiptsError ? <p className="form-info form-info--error">{receiptsError}</p> : null}
                {!receiptsLoading && !receiptsError && receipts.length === 0 ? (
                  <p className="helper-text">No hay recibos emitidos para el criterio actual.</p>
                ) : null}
                {!receiptsLoading && !receiptsError
                  ? receipts.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`recibos-history__item${selectedReceipt?.id === item.id ? ' is-active' : ''}`}
                        onClick={() => handleSelectReceipt(item)}
                      >
                        <div>
                          <strong>{item.serial}</strong>
                          <span>{item.clienteNombre || 'Sin cliente'}</span>
                        </div>
                        <div>
                          <span>{formatReciboDate(item.fecha)}</span>
                          <span className={`recibos-status recibos-status--${item.estado}`}>
                            {item.estado === 'anulado' ? 'Anulado' : 'Emitido'}
                          </span>
                        </div>
                      </button>
                    ))
                  : null}
              </div>
            </div>

            {actionError ? <p className="form-info form-info--error">{actionError}</p> : null}
            {!actionError && actionInfo ? <p className="form-info form-info--success">{actionInfo}</p> : null}

            {selectedReceipt ? (
              <div className="recibos-issued-banner">
                <strong>{selectedReceipt.serial}</strong>
                <span>
                  {selectedReceipt.estado === 'anulado'
                    ? `${buildReciboWatermarkText(selectedReceipt)}${selectedReceipt.anuladoAt ? ` · ${formatDateTime(selectedReceipt.anuladoAt)}` : ''}`
                    : `Emitido${selectedReceipt.createdAt ? ` · ${formatDateTime(selectedReceipt.createdAt)}` : ''}`}
                </span>
              </div>
            ) : (
              <p className="helper-text">
                El borrador actual se guarda localmente. Al emitir, el recibo queda persistido y luego se puede reimprimir o anular.
              </p>
            )}

            <fieldset className="recibos-editor__fieldset" disabled={editorDisabled}>
              <div className="recibos-editor__grid">
                <label className="input-control">
                  <span>Punto de venta</span>
                  <input value={draft.puntoVenta} onChange={handleFieldChange('puntoVenta')} placeholder="0001" />
                </label>
                <label className="input-control">
                  <span>Número de recibo</span>
                  <input value={draft.numeroRecibo} onChange={handleFieldChange('numeroRecibo')} placeholder="00000005" />
                </label>
                <label className="recibos-check">
                  <input type="checkbox" checked={draft.autoNumeroRecibo} onChange={handleToggleChange('autoNumeroRecibo')} />
                  <span>Auto incrementar recibo al imprimir</span>
                </label>
                <label className="input-control">
                  <span>Fecha recibo</span>
                  <input type="date" value={draft.fecha} onChange={handleFieldChange('fecha')} />
                </label>
                <label className="input-control">
                  <span>CUIT empresa</span>
                  <input value={draft.empresaCuit} onChange={handleFieldChange('empresaCuit')} />
                </label>
                <label className="input-control">
                  <span>Inicio de actividad</span>
                  <input type="date" value={draft.empresaInicioActividad} onChange={handleFieldChange('empresaInicioActividad')} />
                </label>
                <label className="input-control">
                  <span>Condición IVA empresa</span>
                  <input value={draft.empresaIva} onChange={handleFieldChange('empresaIva')} />
                </label>
              </div>

              <div className="recibos-editor__group">
                <h4>Empresa</h4>
                <div className="recibos-editor__grid">
                  <label className="input-control recibos-editor__field--wide">
                    <span>Razón social</span>
                    <input value={draft.empresaNombre} onChange={handleFieldChange('empresaNombre')} />
                  </label>
                  <label className="input-control">
                    <span>Dirección línea 1</span>
                    <input value={draft.empresaDireccion1} onChange={handleFieldChange('empresaDireccion1')} />
                  </label>
                  <label className="input-control">
                    <span>Dirección línea 2</span>
                    <input value={draft.empresaDireccion2} onChange={handleFieldChange('empresaDireccion2')} />
                  </label>
                </div>
              </div>

              <div className="recibos-editor__group">
                <h4>Cliente</h4>
                {clientesLoading ? <p className="helper-text">Cargando clientes...</p> : null}
                {!clientesLoading && clientesError ? <p className="form-info form-info--error">{clientesError}</p> : null}
                <div className="recibos-editor__grid">
                  <label className="input-control recibos-editor__field--wide">
                    <span>Cliente</span>
                    <input
                      type="text"
                      list="recibo-clientes-list"
                      value={draft.clienteNombre}
                      onChange={handleClienteNombreChange}
                      placeholder="Escribe un cliente o selecciona de la lista"
                    />
                    <datalist id="recibo-clientes-list">
                      {clientes.map((cliente) => {
                        const label = normalizeTextValue(cliente.nombre) || `Cliente #${cliente.id}`;
                        return <option key={`recibo-cliente-${cliente.id}`} value={label} />;
                      })}
                    </datalist>
                  </label>
                  <label className="input-control">
                    <span>CUIT cliente</span>
                    <input value={draft.clienteCuit} onChange={handleFieldChange('clienteCuit')} />
                  </label>
                  <label className="input-control">
                    <span>Condición IVA cliente</span>
                    <input value={draft.clienteIva} onChange={handleFieldChange('clienteIva')} />
                  </label>
                  <label className="input-control">
                    <span>Dirección línea 1</span>
                    <input value={draft.clienteDireccion1} onChange={handleFieldChange('clienteDireccion1')} />
                  </label>
                  <label className="input-control">
                    <span>Dirección línea 2</span>
                    <input value={draft.clienteDireccion2} onChange={handleFieldChange('clienteDireccion2')} />
                  </label>
                </div>
              </div>

              <div className="recibos-editor__group">
                <h4>Cobro</h4>
                <div className="recibos-editor__grid">
                  <label className="input-control">
                    <span>Fecha del cobro</span>
                    <input type="date" value={draft.fechaCobro} onChange={handleFieldChange('fechaCobro')} />
                  </label>
                  <label className="input-control recibos-editor__field--wide">
                    <span>Detalle del cobro</span>
                    <input value={draft.detalleCobro} onChange={handleFieldChange('detalleCobro')} />
                  </label>
                  <label className="input-control">
                    <span>Importe recibido</span>
                    <input value={draft.importeRecibido} onChange={handleFieldChange('importeRecibido')} placeholder="0,00" />
                  </label>
                  <label className="input-control">
                    <span>Retenciones IVA</span>
                    <input value={draft.retencionesIva} onChange={handleFieldChange('retencionesIva')} placeholder="0,00" />
                  </label>
                  <label className="input-control">
                    <span>Retenciones IIBB</span>
                    <input value={draft.retencionesIibb} onChange={handleFieldChange('retencionesIibb')} placeholder="0,00" />
                  </label>
                  <label className="input-control">
                    <span>Retenciones ganancias</span>
                    <input value={draft.retencionesGanancias} onChange={handleFieldChange('retencionesGanancias')} placeholder="0,00" />
                  </label>
                </div>
                <div className="recibos-summary">
                  <div className="summary-card">
                    <span className="summary-card__label">Total cobro</span>
                    <strong className="summary-card__value">{formatReciboAmount(totalCobro, { emptyAsZero: true })}</strong>
                  </div>
                  <div className="summary-card">
                    <span className="summary-card__label">Total imputado</span>
                    <strong className="summary-card__value">{formatReciboAmount(totalImputado, { emptyAsZero: true })}</strong>
                  </div>
                </div>
              </div>

              <div className="recibos-editor__group">
                <div className="recibos-editor__table-header">
                  <h4>Comprobantes imputados</h4>
                  <div className="recibos-editor__table-actions">
                    <label className="recibos-check">
                      <input type="checkbox" checked={draft.autoNumeroFactura} onChange={handleToggleChange('autoNumeroFactura')} />
                      <span>Auto incrementar facturas al imprimir</span>
                    </label>
                    <button type="button" className="secondary-action" onClick={handleAddComprobante}>
                      Agregar comprobante
                    </button>
                  </div>
                </div>
                <div className="table-wrapper recibos-editor__table">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>N° factura</th>
                        <th>Total factura</th>
                        <th>Imputado</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.comprobantes.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <input type="date" value={item.fecha} onChange={(event) => handleComprobanteChange(item.id, 'fecha', event.target.value)} />
                          </td>
                          <td>
                            <input value={item.numeroFactura} onChange={(event) => handleComprobanteChange(item.id, 'numeroFactura', event.target.value)} placeholder="00002-00000167" />
                          </td>
                          <td>
                            <input value={item.totalFactura} onChange={(event) => handleComprobanteChange(item.id, 'totalFactura', event.target.value)} placeholder="0,00" />
                          </td>
                          <td>
                            <input value={item.imputado} onChange={(event) => handleComprobanteChange(item.id, 'imputado', event.target.value)} placeholder="0,00" />
                          </td>
                          <td>
                            <button type="button" className="secondary-action" onClick={() => handleRemoveComprobante(item.id)}>
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </fieldset>
          </div>
        </section>

        <section className="dashboard-card recibos-preview-card">
          <header className="card-header">
            <div>
              <h3>Vista previa</h3>
            </div>
            <span className={`recibos-status recibos-status--${selectedReceipt?.estado ?? 'borrador'}`}>
              {selectedReceipt ? (selectedReceipt.estado === 'anulado' ? 'Anulado' : 'Emitido') : 'Borrador'}
            </span>
          </header>
          <div className="card-body">
            <div className="recibo-preview-shell">
              <article className={`recibo-document${watermarkText ? ' recibo-document--anulado' : ''}`}>
                {watermarkText ? (
                  <div className="recibo-document__watermark">
                    <span>{watermarkText}</span>
                  </div>
                ) : null}
                <section className="recibo-document__top">
                  <div className="recibo-document__company">
                    <img className="recibo-document__logo" src="/logo-empresa.png" alt="Logística Argentina" />
                    <div className="recibo-document__company-lines">
                      <strong>{draft.empresaNombre || '—'}</strong>
                      <span>{draft.empresaDireccion1 || '—'}</span>
                      <span>{draft.empresaDireccion2 || '—'}</span>
                      <span>{draft.empresaIva || '—'}</span>
                    </div>
                  </div>
                  <div className="recibo-document__voucher">
                    <div className="recibo-document__voucher-letter">X</div>
                    <div className="recibo-document__voucher-text">
                      DOCUMENTO
                      <br />
                      NO VALIDO
                      <br />
                      COMO FACTURA
                    </div>
                  </div>
                  <div className="recibo-document__meta">
                    <div className="recibo-document__title">RECIBO</div>
                    <div className="recibo-document__serial">
                      {pointOfSaleLabel} <span>-</span> {receiptNumberLabel}
                    </div>
                    <div className="recibo-document__meta-grid">
                      <span className="recibo-document__label">FECHA:</span>
                      <span>{formatReciboDate(draft.fecha)}</span>
                      <span className="recibo-document__label">CUIT</span>
                      <span>{draft.empresaCuit || '—'}</span>
                      <span className="recibo-document__label">INICIO DE ACT.</span>
                      <span>{formatReciboDate(draft.empresaInicioActividad)}</span>
                    </div>
                  </div>
                </section>

                <section className="recibo-document__client">
                  <div className="recibo-document__client-grid">
                    <span>
                      <span className="recibo-document__label">CLIENTE</span> {draft.clienteNombre || '—'}
                    </span>
                    <span>
                      <span className="recibo-document__label">DIRECCION</span> {draft.clienteDireccion1 || '—'}
                    </span>
                    <span>{draft.clienteDireccion2 || '—'}</span>
                  </div>
                  <div className="recibo-document__client-grid">
                    <span>
                      <span className="recibo-document__label">CUIT</span> {draft.clienteCuit || '—'}
                    </span>
                    <span>
                      <span className="recibo-document__label">IVA</span> {draft.clienteIva || '—'}
                    </span>
                  </div>
                </section>

                <section className="recibo-document__amounts">
                  <div className="recibo-document__amount-grid">
                    <span className="recibo-document__label">FECHA DEL COBRO</span>
                    <span className="recibo-document__value-right">{formatReciboDate(draft.fechaCobro)}</span>
                    <span className="recibo-document__label">DETALLE DEL COBRO</span>
                    <span className="recibo-document__value-right">{draft.detalleCobro || '—'}</span>
                    <span className="recibo-document__label">IMPORTE RECIBIDO</span>
                    <span className="recibo-document__value-right">{formatReciboAmount(draft.importeRecibido, { emptyAsZero: true })}</span>
                    <span className="recibo-document__label">RETENCIONES IVA</span>
                    <span className="recibo-document__value-right">{formatReciboAmount(draft.retencionesIva, { emptyAsZero: true })}</span>
                    <span className="recibo-document__label">RETENCIONES IIBB</span>
                    <span className="recibo-document__value-right">{formatReciboAmount(draft.retencionesIibb, { emptyAsZero: true })}</span>
                    <span className="recibo-document__label">RETENCIONES GANANCIAS</span>
                    <span className="recibo-document__value-right">{formatReciboAmount(draft.retencionesGanancias, { emptyAsZero: true })}</span>
                    <span className="recibo-document__label recibo-document__total-row">TOTAL COBRO</span>
                    <span className="recibo-document__value-right recibo-document__total-row">
                      {formatReciboAmount(totalCobro, { emptyAsZero: true })}
                    </span>
                  </div>
                </section>

                <section className="recibo-document__table">
                  <div className="recibo-document__table-title">DETALLE DE COMPROBANTES IMPUTADOS</div>
                  <table>
                    <thead>
                      <tr>
                        <th>FECHA</th>
                        <th>N° FACT</th>
                        <th>TOTAL FACT</th>
                        <th>IMPUTADO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.comprobantes.length > 0 ? (
                        draft.comprobantes.map((item) => (
                          <tr key={item.id}>
                            <td>{formatReciboDate(item.fecha)}</td>
                            <td>{item.numeroFactura || '—'}</td>
                            <td className="recibo-document__value-right">{formatReciboAmount(item.totalFactura)}</td>
                            <td className="recibo-document__value-right">{formatReciboAmount(item.imputado)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4}>Sin comprobantes imputados.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>

                <section className="recibo-document__footer">
                  <span>TOTAL IMPUTADO</span>
                  <span>{formatReciboAmount(totalImputado, { emptyAsZero: true })}</span>
                </section>
              </article>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};
