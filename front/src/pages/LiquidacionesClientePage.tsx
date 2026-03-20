import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { Cliente } from '../features/clientes/types';
import { downloadCsv } from '../lib/csv';

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

type LiquidacionesClientePageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  buildActorHeaders: (user: AuthUser | null) => Record<string, string> | null | undefined;
  resolveApiUrl: (baseUrl: string, target?: string | null) => string | null;
  parseJsonSafe: (response: Response) => Promise<any>;
  formatCurrency: (value: number | null | undefined) => string;
  formatDateOnly: (value: string) => string;
};

const TARIFA_MONTH_OPTIONS = [
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

const uniqueKey = () => Math.random().toString(36).slice(2);

const parseFacturacionAmountValue = (value: string | number | null | undefined): number | null => {
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

type EstadoCuentaRow = {
  row_type?: 'factura' | 'manual';
  manual_id?: number | null;
  factura_id: number | null;
  cliente_id: number;
  cliente_nombre: string | null;
  sucursal_id: number | null;
  sucursal_nombre: string | null;
  anio_facturado: number;
  mes_facturado: number;
  periodo_facturado: string;
  quincena_label?: string | null;
  neto_gravado: number;
  no_gravado: number;
  iva: number;
  importe_a_cobrar: number;
  observaciones?: string | null;
  observaciones_cobranza?: string | null;
  numero_factura: string;
  fecha_fact?: string | null;
  fecha_cobro?: string | null;
  importe_cobrado?: number | null;
  retenciones_gcias?: number | null;
  otras_retenciones?: number | null;
  op_cobro_recibo?: string | null;
  op_cobro_archivo_nombre?: string | null;
  op_cobro_archivo_url?: string | null;
  forma_cobro?: string | null;
  op_cobro_recibo_manual?: string | null;
  forma_cobro_manual?: string | null;
  retenciones_gcias_manual?: number | null;
  otras_retenciones_manual?: number | null;
  diferencia?: number | null;
  estado_cobranza?: string | null;
  estado?: string | null;
};

const LIQ_CLIENTE_PERIODOS = [
  { value: '', label: 'Todos' },
  { value: 'PRIMERA_QUINCENA', label: '1Q' },
  { value: 'SEGUNDA_QUINCENA', label: '2Q' },
  { value: 'MES_COMPLETO', label: 'MC' },
];

const COBRO_FORMA_OPTIONS = [
  { value: 'Echeq', label: 'Echeq' },
  { value: 'Transferencia', label: 'Transferencia' },
  { value: 'Efectivo', label: 'Efectivo' },
  { value: 'Echeq/Transferencia', label: 'Echeq/Transferencia' },
];

const toPeriodoLabel = (anio: number, mes: number): string => {
  const formatter = new Intl.DateTimeFormat('es-AR', { month: 'short' });
  const monthShort = formatter.format(new Date(anio, Math.max(0, mes - 1), 1)).replace('.', '');
  const yearShort = String(anio).slice(-2);
  return `${monthShort}-${yearShort}`;
};

export const LiquidacionesClientePage: React.FC<LiquidacionesClientePageProps> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  buildActorHeaders,
  resolveApiUrl,
  parseJsonSafe,
  formatCurrency,
  formatDateOnly,
}) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const authUser = useStoredAuthUser();
  const actorHeaders = useMemo(() => buildActorHeaders(authUser), [authUser]);
  const location = useLocation();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientesLoading, setClientesLoading] = useState(true);
  const [clientesError, setClientesError] = useState<string | null>(null);
  const [clienteLogoStatus, setClienteLogoStatus] = useState<Record<number, 'loaded' | 'error'>>({});
  const [rows, setRows] = useState<EstadoCuentaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editCobranzaRow, setEditCobranzaRow] = useState<EstadoCuentaRow | null>(null);
  const [editCobranzaDraft, setEditCobranzaDraft] = useState({
    fecha_cobro: '',
    importe_cobrado: '',
    retenciones_gcias: '',
    otras_retenciones: '',
    op_cobro_recibo: '',
    forma_cobro: '',
    observaciones: '',
  });
  const [editCobranzaArchivo, setEditCobranzaArchivo] = useState<File | null>(null);
  const [editCobranzaSaving, setEditCobranzaSaving] = useState(false);
  const [editCobranzaError, setEditCobranzaError] = useState<string | null>(null);
  const [manualRowEditor, setManualRowEditor] = useState<EstadoCuentaRow | null>(null);
  const [manualRowDraft, setManualRowDraft] = useState({
    sucursal_id: '',
    anio_facturado: '',
    mes_facturado: '',
    periodo_facturado: 'PRIMERA_QUINCENA',
    estado_cobranza: 'PENDIENTE',
    neto_gravado: '',
    no_gravado: '',
    iva: '',
    importe_a_cobrar: '',
    observaciones: '',
    numero_factura: '',
    fecha_fact: '',
    fecha_cobro: '',
    importe_cobrado: '',
    retenciones_gcias: '',
    otras_retenciones: '',
    op_cobro_recibo: '',
    forma_cobro: '',
  });
  const [manualRowArchivo, setManualRowArchivo] = useState<File | null>(null);
  const [manualRowSaving, setManualRowSaving] = useState(false);
  const [manualRowError, setManualRowError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    cliente_id: '',
    sucursal_id: '',
    anio: '',
    mes: '',
    periodo: '',
    estado_cobranza: '',
  });
  const [queryFilters, setQueryFilters] = useState(filters);
  const hydratedFromUrlRef = useRef(false);

  useEffect(() => {
    if (hydratedFromUrlRef.current) return;
    const params = new URLSearchParams(location.search);
    const clienteId = (params.get('cliente_id') ?? '').trim();
    if (!clienteId) return;

    hydratedFromUrlRef.current = true;
    const next = {
      cliente_id: clienteId,
      sucursal_id: (params.get('sucursal_id') ?? '').trim(),
      anio: (params.get('anio') ?? '').trim(),
      mes: (params.get('mes') ?? '').trim(),
      periodo: (params.get('periodo') ?? '').trim(),
      estado_cobranza: (params.get('estado_cobranza') ?? '').trim(),
    };
    setFilters(next);
    setQueryFilters(next);
  }, [location.search]);

  const requestJson = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const url = resolveApiUrl(apiBaseUrl, path) ?? `${apiBaseUrl}${path}`;
      const headers: HeadersInit = {
        Accept: 'application/json',
        ...(actorHeaders ?? {}),
        ...(options.headers ?? {}),
      };

      const response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers,
      });

      const payload = (await parseJsonSafe(response).catch(() => null)) as any;
      if (!response.ok) {
        const message =
          typeof payload?.message === 'string' ? payload.message : `Error ${response.status}: ${response.statusText}`;
        throw new Error(message);
      }
      return payload;
    },
    [actorHeaders, apiBaseUrl]
  );

  const requestFormData = useCallback(
    async (path: string, form: FormData, method: string) => {
      const url = resolveApiUrl(apiBaseUrl, path) ?? `${apiBaseUrl}${path}`;
      const headers: HeadersInit = {
        Accept: 'application/json',
        ...(actorHeaders ?? {}),
      };

      const response = await fetch(url, {
        credentials: 'include',
        method,
        headers,
        body: form,
      });

      const payload = (await parseJsonSafe(response).catch(() => null)) as any;
      if (!response.ok) {
        const message =
          typeof payload?.message === 'string' ? payload.message : `Error ${response.status}: ${response.statusText}`;
        throw new Error(message);
      }
      return payload;
    },
    [actorHeaders, apiBaseUrl]
  );

  useEffect(() => {
    const controller = new AbortController();
    const loadClientes = async () => {
      try {
        setClientesLoading(true);
        setClientesError(null);
        const response = await fetch(`${apiBaseUrl}/api/clientes`, {
          signal: controller.signal,
          headers: { Accept: 'application/json', ...(actorHeaders ?? {}) },
          credentials: 'include',
        });
        const payload = (await parseJsonSafe(response)) as { data?: Cliente[]; message?: string };
        if (!response.ok) {
          throw new Error(payload?.message ?? `Error ${response.status}: ${response.statusText}`);
        }
        setClientes(Array.isArray(payload?.data) ? payload.data : []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setClientes([]);
        setClientesError((err as Error).message ?? 'No se pudieron cargar los clientes.');
      } finally {
        setClientesLoading(false);
      }
    };
    void loadClientes();
    return () => controller.abort();
  }, [actorHeaders, apiBaseUrl]);

  const selectedCliente = useMemo(() => {
    const id = Number(queryFilters.cliente_id);
    if (!id) return null;
    return clientes.find((cliente) => cliente.id === id) ?? null;
  }, [clientes, queryFilters.cliente_id]);

  const selectedClienteDraft = useMemo(() => {
    const id = Number(filters.cliente_id);
    if (!id) return null;
    return clientes.find((cliente) => cliente.id === id) ?? null;
  }, [clientes, filters.cliente_id]);

  const sucursales = useMemo(() => selectedClienteDraft?.sucursales ?? selectedCliente?.sucursales ?? [], [selectedCliente, selectedClienteDraft]);

  const loadEstadoCuenta = useCallback(async (overrideFilters?: typeof queryFilters) => {
    const activeFilters = overrideFilters ?? queryFilters;
    const clienteId = activeFilters.cliente_id.trim();
    if (!clienteId) {
      setRows([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      Object.entries(activeFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      params.set('include_recibos', '1');
      params.set('include_manual', '1');
      const payload = (await requestJson(`/api/clientes-facturacion/estado-cuenta?${params.toString()}`)) as {
        data?: EstadoCuentaRow[];
      };
      setRows(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      setError((err as Error).message ?? 'No se pudo cargar el estado de cuenta.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [queryFilters, requestJson]);

  useEffect(() => {
    void loadEstadoCuenta();
  }, [loadEstadoCuenta]);

  const openCobranzaEditor = useCallback((row: EstadoCuentaRow) => {
    if (!row.factura_id) {
      return;
    }
    setEditCobranzaError(null);
    setEditCobranzaArchivo(null);
    setEditCobranzaRow(row);
    setEditCobranzaDraft({
      fecha_cobro: row.fecha_cobro ?? '',
      importe_cobrado: row.importe_cobrado != null ? String(row.importe_cobrado) : '',
      retenciones_gcias: row.retenciones_gcias != null ? String(row.retenciones_gcias) : '',
      otras_retenciones: row.otras_retenciones != null ? String(row.otras_retenciones) : '',
      op_cobro_recibo: row.op_cobro_recibo ?? '',
      forma_cobro: row.forma_cobro ?? '',
      observaciones: row.observaciones_cobranza ?? row.observaciones ?? '',
    });
  }, []);

  const closeCobranzaEditor = useCallback(() => {
    if (editCobranzaSaving) return;
    setEditCobranzaRow(null);
    setEditCobranzaError(null);
    setEditCobranzaArchivo(null);
  }, [editCobranzaSaving]);

  const normalizeNumberInput = useCallback((value: string): number | null => {
    const parsed = parseFacturacionAmountValue(value);
    return parsed === null ? null : Math.round(parsed * 100) / 100;
  }, []);

  const handleSaveCobranza = useCallback(async () => {
    if (!editCobranzaRow || editCobranzaSaving) return;
    if (!editCobranzaRow.factura_id) return;

    try {
      setEditCobranzaSaving(true);
      setEditCobranzaError(null);

      const payload = {
        fecha_pago_manual: editCobranzaDraft.fecha_cobro.trim() || null,
        monto_pagado_manual: normalizeNumberInput(editCobranzaDraft.importe_cobrado),
        observaciones_cobranza: editCobranzaDraft.observaciones.trim() || null,
        retenciones_gcias_manual: normalizeNumberInput(editCobranzaDraft.retenciones_gcias),
        otras_retenciones_manual: normalizeNumberInput(editCobranzaDraft.otras_retenciones),
        op_cobro_recibo_manual: editCobranzaDraft.op_cobro_recibo.trim() || null,
        forma_cobro_manual: editCobranzaDraft.forma_cobro.trim() || null,
      };

      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        form.append(key, value === null ? '' : String(value));
      });
      if (editCobranzaArchivo) {
        form.append('op_cobro_archivo', editCobranzaArchivo);
      }

      await requestFormData(`/api/facturas/${editCobranzaRow.factura_id}/actualizar-cobranza`, form, 'POST');

      setEditCobranzaRow(null);
      setEditCobranzaArchivo(null);
      await loadEstadoCuenta();
    } catch (err) {
      setEditCobranzaError((err as Error).message ?? 'No se pudo guardar la cobranza.');
    } finally {
      setEditCobranzaSaving(false);
    }
  }, [editCobranzaArchivo, editCobranzaDraft, editCobranzaRow, editCobranzaSaving, loadEstadoCuenta, normalizeNumberInput, requestFormData]);

  const handleExportCsv = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const clienteLabel = selectedCliente?.nombre ? selectedCliente.nombre.replace(/\s+/g, '-').toLowerCase() : 'cliente';
    const filename = `estado-cuenta-${clienteLabel}-${today}.csv`;

    const header = [
      'Sucursal',
      'Periodo',
      'Quincena',
      'NETO GRAVADO',
      'NO GRAV',
      'IVA',
      'Importe a cobrar',
      'Observaciones',
      'N° FACTURA',
      'FECHA FACT',
      'Fecha Cobro',
      'Importe Cobrado',
      'Retenciones GCIAS',
      'Otras retenc',
      'N° OP COBRO/RECIBO',
      'Forma Cobro',
      'Diferencia',
      'N°',
    ];

    const dataRows = rows.map((row, index) => [
      row.sucursal_nombre ?? '—',
      toPeriodoLabel(row.anio_facturado, row.mes_facturado),
      row.quincena_label ?? '—',
      row.neto_gravado,
      row.no_gravado,
      row.iva,
      row.importe_a_cobrar,
      row.observaciones ?? '',
      row.numero_factura,
      row.fecha_fact ?? '',
      row.fecha_cobro ?? '',
      row.importe_cobrado ?? 0,
      row.retenciones_gcias ?? '',
      row.otras_retenciones ?? '',
      row.op_cobro_recibo ?? '',
      row.forma_cobro ?? '',
      row.diferencia ?? '',
      index + 1,
    ]);

    downloadCsv(filename, [header, ...dataRows]);
  }, [rows, selectedCliente?.nombre]);

  const logoClientes = useMemo(() => {
    return [...clientes].sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? ''));
  }, [clientes]);

  const resolveClientLogoSrc = useCallback((raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return '';
    }
    const normalized = trimmed.replace(/\\/g, '/');
    const candidates = [
      { prefix: 'front/public/', strip: 'front/public/' },
      { prefix: 'front/', strip: 'front/' },
      { prefix: './', strip: './' },
    ];
    for (const item of candidates) {
      if (normalized.toLowerCase().startsWith(item.prefix)) {
        const rest = normalized.slice(item.strip.length);
        return rest.startsWith('/') ? rest : `/${rest}`;
      }
    }
    if (normalized.toLowerCase().startsWith('logos/')) {
      return `/${normalized}`;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
      return trimmed;
    }
    return `/${normalized}`;
  }, []);

  const openManualRowCreate = useCallback(() => {
    if (!filters.cliente_id) {
      return;
    }
    setManualRowError(null);
    setManualRowArchivo(null);
    setManualRowEditor({ row_type: 'manual', manual_id: null, factura_id: null } as EstadoCuentaRow);
    setManualRowDraft((prev) => ({
      ...prev,
      sucursal_id: filters.sucursal_id || '',
      anio_facturado: filters.anio || String(new Date().getFullYear()),
      mes_facturado: filters.mes || '',
      periodo_facturado: filters.periodo || 'PRIMERA_QUINCENA',
      estado_cobranza: filters.estado_cobranza || 'PENDIENTE',
    }));
  }, [filters]);

  const openManualRowEdit = useCallback((row: EstadoCuentaRow) => {
    if (row.row_type !== 'manual' || !row.manual_id) {
      return;
    }
    setManualRowError(null);
    setManualRowArchivo(null);
    setManualRowEditor(row);
    setManualRowDraft({
      sucursal_id: row.sucursal_id ? String(row.sucursal_id) : '',
      anio_facturado: String(row.anio_facturado ?? ''),
      mes_facturado: String(row.mes_facturado ?? ''),
      periodo_facturado: (row.periodo_facturado as any) || 'PRIMERA_QUINCENA',
      estado_cobranza: (row.estado_cobranza as any) || 'PENDIENTE',
      neto_gravado: row.neto_gravado != null ? String(row.neto_gravado) : '',
      no_gravado: row.no_gravado != null ? String(row.no_gravado) : '',
      iva: row.iva != null ? String(row.iva) : '',
      importe_a_cobrar: row.importe_a_cobrar != null ? String(row.importe_a_cobrar) : '',
      observaciones: row.observaciones ?? '',
      numero_factura: row.numero_factura ?? '',
      fecha_fact: row.fecha_fact ?? '',
      fecha_cobro: row.fecha_cobro ?? '',
      importe_cobrado: row.importe_cobrado != null ? String(row.importe_cobrado) : '',
      retenciones_gcias: row.retenciones_gcias != null ? String(row.retenciones_gcias) : '',
      otras_retenciones: row.otras_retenciones != null ? String(row.otras_retenciones) : '',
      op_cobro_recibo: row.op_cobro_recibo ?? '',
      forma_cobro: row.forma_cobro ?? '',
    });
  }, []);

  const closeManualRowEditor = useCallback(() => {
    if (manualRowSaving) return;
    setManualRowEditor(null);
    setManualRowError(null);
    setManualRowArchivo(null);
  }, [manualRowSaving]);

  const handleSaveManualRow = useCallback(async () => {
    if (!manualRowEditor || manualRowSaving) return;
    const clienteId = Number(filters.cliente_id);
    if (!clienteId) {
      setManualRowError('Seleccioná un cliente para cargar una fila manual.');
      return;
    }

    const anio = Number(manualRowDraft.anio_facturado);
    const mes = Number(manualRowDraft.mes_facturado);
    if (!anio || !mes) {
      setManualRowError('Completá año y mes.');
      return;
    }

    try {
      setManualRowSaving(true);
      setManualRowError(null);

      const payload = {
        cliente_id: clienteId,
        sucursal_id: manualRowDraft.sucursal_id ? Number(manualRowDraft.sucursal_id) : null,
        anio_facturado: anio,
        mes_facturado: mes,
        periodo_facturado: manualRowDraft.periodo_facturado,
        estado_cobranza: manualRowDraft.estado_cobranza,
        neto_gravado: normalizeNumberInput(manualRowDraft.neto_gravado) ?? 0,
        no_gravado: normalizeNumberInput(manualRowDraft.no_gravado) ?? 0,
        iva: normalizeNumberInput(manualRowDraft.iva) ?? 0,
        importe_a_cobrar: normalizeNumberInput(manualRowDraft.importe_a_cobrar) ?? 0,
        observaciones: manualRowDraft.observaciones.trim() || null,
        numero_factura: manualRowDraft.numero_factura.trim() || null,
        fecha_fact: manualRowDraft.fecha_fact.trim() || null,
        fecha_cobro: manualRowDraft.fecha_cobro.trim() || null,
        importe_cobrado: normalizeNumberInput(manualRowDraft.importe_cobrado),
        retenciones_gcias: normalizeNumberInput(manualRowDraft.retenciones_gcias),
        otras_retenciones: normalizeNumberInput(manualRowDraft.otras_retenciones),
        op_cobro_recibo: manualRowDraft.op_cobro_recibo.trim() || null,
        forma_cobro: manualRowDraft.forma_cobro.trim() || null,
      };

      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        form.append(key, value === null ? '' : String(value));
      });
      if (manualRowArchivo) {
        form.append('op_cobro_archivo', manualRowArchivo);
      }

      if (manualRowEditor.manual_id) {
        form.append('_method', 'PUT');
        await requestFormData(`/api/clientes-facturacion/estado-cuenta/manual/${manualRowEditor.manual_id}`, form, 'POST');
      } else {
        await requestFormData('/api/clientes-facturacion/estado-cuenta/manual', form, 'POST');
      }

      setManualRowEditor(null);
      setManualRowArchivo(null);
      if (!queryFilters.cliente_id) {
        const appliedFilters = {
          ...filters,
          cliente_id: String(clienteId),
          sucursal_id: manualRowDraft.sucursal_id || '',
          anio: String(anio),
          mes: String(mes),
          periodo: manualRowDraft.periodo_facturado,
          estado_cobranza: manualRowDraft.estado_cobranza,
        };
        setFilters(appliedFilters);
        setQueryFilters(appliedFilters);
        await loadEstadoCuenta(appliedFilters);
        return;
      }
      await loadEstadoCuenta(queryFilters);
    } catch (err) {
      setManualRowError((err as Error).message ?? 'No se pudo guardar la fila manual.');
    } finally {
      setManualRowSaving(false);
    }
  }, [filters, loadEstadoCuenta, manualRowArchivo, manualRowDraft, manualRowEditor, manualRowSaving, normalizeNumberInput, queryFilters, requestFormData]);

  const handleDeleteManualRow = useCallback(async () => {
    if (!manualRowEditor?.manual_id || manualRowSaving) return;
    if (!window.confirm('¿Eliminar esta fila manual?')) return;

    try {
      setManualRowSaving(true);
      setManualRowError(null);
      await requestJson(`/api/clientes-facturacion/estado-cuenta/manual/${manualRowEditor.manual_id}`, {
        method: 'DELETE',
      });
      setManualRowEditor(null);
      const refreshFilters = queryFilters.cliente_id ? queryFilters : filters;
      if (!queryFilters.cliente_id) {
        setQueryFilters(filters);
      }
      await loadEstadoCuenta(refreshFilters);
    } catch (err) {
      setManualRowError((err as Error).message ?? 'No se pudo eliminar la fila manual.');
    } finally {
      setManualRowSaving(false);
    }
  }, [filters, loadEstadoCuenta, manualRowEditor, manualRowSaving, queryFilters, requestJson]);

  return (
    <DashboardLayout title="Liquidaciones" subtitle="Cliente - Estado de cuenta">
      <section className="dashboard-card">
        <header className="card-header">
          <h3>Estado de cuenta</h3>
          <div className="card-header__buttons">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setQueryFilters(filters)}
              disabled={loading}
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={openManualRowCreate}
              disabled={!filters.cliente_id}
            >
              + Fila manual
            </button>
            <button type="button" className="secondary-action" onClick={handleExportCsv} disabled={rows.length === 0}>
              Exportar CSV
            </button>
          </div>
        </header>

        <div className="card-body">
          {clientesLoading ? <p className="helper-text">Cargando clientes...</p> : null}
          {clientesError ? <p className="form-info form-info--error">{clientesError}</p> : null}

          {!clientesLoading && !clientesError ? (
            <div className="cliente-logo-strip" aria-label="Filtrar por cliente">
              {logoClientes.length === 0 ? <p className="helper-text">No hay clientes cargados.</p> : null}
              {logoClientes.map((cliente) => {
                const isActive = String(cliente.id) === filters.cliente_id;
                const title = cliente.nombre ?? cliente.codigo ?? `Cliente #${cliente.id}`;
                const logo = cliente.logo_url ? resolveClientLogoSrc(cliente.logo_url) : null;
                const logoSrc = logo ?? undefined;
                const logoStatus = clienteLogoStatus[cliente.id] ?? null;
                const logoAvailable = Boolean(logoSrc) && logoStatus !== 'error';
                const debugLogoRaw = (cliente.logo_url ?? '').trim();
                const debugLogoResolved = logoSrc ?? '';
                const buttonTitle = debugLogoRaw
                  ? `${title}\nLogo: ${debugLogoRaw}${debugLogoResolved && debugLogoResolved !== debugLogoRaw ? `\nResuelto: ${debugLogoResolved}` : ''}`
                  : `${title}\nSin logo configurado`;
                const initials = (cliente.nombre ?? cliente.codigo ?? 'C')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((chunk) => chunk[0]?.toUpperCase())
                  .join('');

                return (
                  <button
                    key={cliente.id}
                    type="button"
                    className={`cliente-logo-btn${isActive ? ' is-active' : ''}`}
                    title={buttonTitle}
                    onClick={() => {
                      const next = {
                        ...filters,
                        cliente_id: String(cliente.id),
                        sucursal_id: '',
                      };
                      setFilters(next);
                      setQueryFilters(next);
                    }}
                  >
                    {!logoAvailable || logoStatus !== 'loaded' ? (
                      <span className="cliente-logo-fallback">{initials || 'CL'}</span>
                    ) : null}
                    {logoAvailable ? (
                      <img
                        src={logoSrc}
                        alt={title}
                        loading="eager"
                        decoding="async"
                        onLoad={() =>
                          setClienteLogoStatus((prev) => {
                            if (prev[cliente.id] === 'loaded') {
                              return prev;
                            }
                            return { ...prev, [cliente.id]: 'loaded' };
                          })
                        }
                        onError={() =>
                          setClienteLogoStatus((prev) => ({ ...prev, [cliente.id]: 'error' }))
                        }
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="filters-grid" style={{ marginTop: '1rem' }}>
            <label className="input-control">
              <span>Cliente</span>
              <select
                value={filters.cliente_id}
                onChange={(event) =>
                  (() => {
                    const next = {
                      ...filters,
                      cliente_id: event.target.value,
                      sucursal_id: '',
                    };
                    setFilters(next);
                    setQueryFilters(next);
                  })()
                }
              >
                <option value="">Seleccionar...</option>
                {logoClientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre ?? cliente.codigo ?? `Cliente #${cliente.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Sucursal</span>
              <select
                value={filters.sucursal_id}
                onChange={(event) => setFilters((prev) => ({ ...prev, sucursal_id: event.target.value }))}
                disabled={!filters.cliente_id}
              >
                <option value="">Todas</option>
                {sucursales.map((sucursal) => (
                  <option key={sucursal.id ?? uniqueKey()} value={sucursal.id ?? ''}>
                    {sucursal.nombre ?? `Sucursal #${sucursal.id ?? ''}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Año</span>
              <input value={filters.anio} onChange={(event) => setFilters((prev) => ({ ...prev, anio: event.target.value }))} placeholder="2026" />
            </label>
            <label className="input-control">
              <span>Mes</span>
              <select value={filters.mes} onChange={(event) => setFilters((prev) => ({ ...prev, mes: event.target.value }))}>
                <option value="">Todos</option>
                {TARIFA_MONTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Período</span>
              <select value={filters.periodo} onChange={(event) => setFilters((prev) => ({ ...prev, periodo: event.target.value }))}>
                {LIQ_CLIENTE_PERIODOS.map((periodo) => (
                  <option key={periodo.value || 'all'} value={periodo.value}>
                    {periodo.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Estado cobranza</span>
              <select value={filters.estado_cobranza} onChange={(event) => setFilters((prev) => ({ ...prev, estado_cobranza: event.target.value }))}>
                <option value="">Todos</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="A_VENCER">A vencer</option>
                <option value="VENCIDA">Vencida</option>
                <option value="PARCIAL">Parcial</option>
                <option value="COBRADA">Cobrada</option>
              </select>
            </label>
          </div>

          {loading ? <p className="helper-text" style={{ marginTop: '0.75rem' }}>Cargando estado de cuenta...</p> : null}
          {error ? <p className="form-info form-info--error">{error}</p> : null}

          <div className="table-wrapper" style={{ marginTop: '1rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Sucursal</th>
                  <th>Periodo</th>
                  <th>Quincena</th>
                  <th>NETO</th>
                  <th>NO GRAV</th>
                  <th>IVA</th>
                  <th>Importe</th>
                  <th>Obs.</th>
                  <th>N° Factura</th>
                  <th>Fecha Fact</th>
                  <th>Fecha Cobro</th>
                  <th>Imp. Cobrado</th>
                  <th>Ret. Gcias</th>
                  <th>Otras ret.</th>
                  <th>OP/Recibo</th>
                  <th>Forma cobro</th>
                  <th>Diferencia</th>
                  <th>Editar</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={18}>
                      {queryFilters.cliente_id ? 'Sin resultados para los filtros seleccionados.' : 'Seleccioná un cliente para ver su estado de cuenta.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const rowKey =
                      row.row_type === 'manual'
                        ? `manual-${row.manual_id ?? uniqueKey()}`
                        : `factura-${row.factura_id ?? uniqueKey()}`;

                    return (
                    <tr key={rowKey}>
                      <td>{row.sucursal_nombre ?? '—'}</td>
                      <td>{toPeriodoLabel(row.anio_facturado, row.mes_facturado)}</td>
                      <td>{row.quincena_label ?? '—'}</td>
                      <td className="value-right">{formatCurrency(row.neto_gravado)}</td>
                      <td className="value-right">{formatCurrency(row.no_gravado)}</td>
                      <td className="value-right">{formatCurrency(row.iva)}</td>
                      <td className="value-right">{formatCurrency(row.importe_a_cobrar)}</td>
                      <td>{row.observaciones ?? '—'}</td>
                      <td>{row.numero_factura}</td>
                      <td>{row.fecha_fact ? formatDateOnly(row.fecha_fact) : '—'}</td>
                      <td>{row.fecha_cobro ? formatDateOnly(row.fecha_cobro) : '—'}</td>
                      <td className="value-right">{formatCurrency(row.importe_cobrado ?? null)}</td>
                      <td className="value-right">{formatCurrency(row.retenciones_gcias ?? null)}</td>
                      <td className="value-right">{formatCurrency(row.otras_retenciones ?? null)}</td>
                      <td>
                        {row.op_cobro_recibo ? <div>{row.op_cobro_recibo}</div> : <div>—</div>}
                        {row.op_cobro_archivo_url ? (
                          <div style={{ marginTop: 4 }}>
                            <a href={row.op_cobro_archivo_url} target="_blank" rel="noreferrer">
                              {row.op_cobro_archivo_nombre ?? 'Adjunto'}
                            </a>
                          </div>
                        ) : null}
                      </td>
                      <td>{row.forma_cobro ?? '—'}</td>
                      <td className="value-right">{formatCurrency(row.diferencia ?? null)}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary-action secondary-action--ghost"
                          onClick={() => {
                            if (row.row_type === 'manual') {
                              openManualRowEdit(row);
                              return;
                            }
                            openCobranzaEditor(row);
                          }}
                        >
                          ✏️
                        </button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {editCobranzaRow ? (
        <div className="permissions-modal" role="dialog" aria-modal="true">
          <div className="permissions-modal__backdrop" onClick={closeCobranzaEditor} />
          <div className="permissions-modal__content">
            <div className="permissions-modal__header">
              <div>
                <h3>Editar cobro</h3>
                <p>{editCobranzaRow.numero_factura} · {editCobranzaRow.sucursal_nombre ?? 'Sucursal'}</p>
              </div>
              <button type="button" aria-label="Cerrar" onClick={closeCobranzaEditor}>
                ×
              </button>
            </div>
            <div className="permissions-modal__body">
              <div className="form-grid">
                <label className="input-control">
                  <span>Fecha cobro</span>
                  <input
                    type="date"
                    value={editCobranzaDraft.fecha_cobro}
                    onChange={(event) => setEditCobranzaDraft((prev) => ({ ...prev, fecha_cobro: event.target.value }))}
                    disabled={editCobranzaSaving}
                  />
                </label>
                <label className="input-control">
                  <span>Importe cobrado</span>
                  <input
                    value={editCobranzaDraft.importe_cobrado}
                    onChange={(event) => setEditCobranzaDraft((prev) => ({ ...prev, importe_cobrado: event.target.value }))}
                    disabled={editCobranzaSaving}
                    placeholder="0,00"
                  />
                </label>
                <label className="input-control">
                  <span>Retenciones Gcias</span>
                  <input
                    value={editCobranzaDraft.retenciones_gcias}
                    onChange={(event) => setEditCobranzaDraft((prev) => ({ ...prev, retenciones_gcias: event.target.value }))}
                    disabled={editCobranzaSaving}
                    placeholder="0,00"
                  />
                </label>
                <label className="input-control">
                  <span>Otras retenciones</span>
                  <input
                    value={editCobranzaDraft.otras_retenciones}
                    onChange={(event) => setEditCobranzaDraft((prev) => ({ ...prev, otras_retenciones: event.target.value }))}
                    disabled={editCobranzaSaving}
                    placeholder="0,00"
                  />
                </label>
                <label className="input-control">
                  <span>N° OP Cobro / Recibo</span>
                  <input
                    value={editCobranzaDraft.op_cobro_recibo}
                    onChange={(event) => setEditCobranzaDraft((prev) => ({ ...prev, op_cobro_recibo: event.target.value }))}
                    disabled={editCobranzaSaving}
                    placeholder="0001-00000123"
                  />
                </label>
                <label className="input-control">
                  <span>Adjunto OP</span>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    disabled={editCobranzaSaving}
                    onChange={(event) => setEditCobranzaArchivo(event.target.files?.[0] ?? null)}
                  />
                  {editCobranzaArchivo ? (
                    <small className="helper-text">Seleccionado: {editCobranzaArchivo.name}</small>
                  ) : editCobranzaRow.op_cobro_archivo_url ? (
                    <small className="helper-text">
                      Actual:{' '}
                      <a href={editCobranzaRow.op_cobro_archivo_url} target="_blank" rel="noreferrer">
                        {editCobranzaRow.op_cobro_archivo_nombre ?? 'Adjunto'}
                      </a>
                    </small>
                  ) : (
                    <small className="helper-text">Sin archivo</small>
                  )}
                </label>
                <label className="input-control">
                  <span>Forma cobro</span>
                  <select
                    value={editCobranzaDraft.forma_cobro}
                    onChange={(event) => setEditCobranzaDraft((prev) => ({ ...prev, forma_cobro: event.target.value }))}
                    disabled={editCobranzaSaving}
                  >
                    <option value="">(Sin definir)</option>
                    {editCobranzaDraft.forma_cobro &&
                    !COBRO_FORMA_OPTIONS.some((option) => option.value === editCobranzaDraft.forma_cobro) ? (
                      <option value={editCobranzaDraft.forma_cobro}>{editCobranzaDraft.forma_cobro} (actual)</option>
                    ) : null}
                    {COBRO_FORMA_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="input-control" style={{ gridColumn: 'span 2' }}>
                  <span>Observaciones</span>
                  <textarea
                    rows={3}
                    value={editCobranzaDraft.observaciones}
                    onChange={(event) => setEditCobranzaDraft((prev) => ({ ...prev, observaciones: event.target.value }))}
                    disabled={editCobranzaSaving}
                    style={{ resize: 'vertical' }}
                  />
                </label>
              </div>

              {editCobranzaError ? <p className="form-info form-info--error">{editCobranzaError}</p> : null}
              <p className="form-info">
                Estos valores son manuales y se guardan en la factura. Si existe un recibo, el manual tiene prioridad.
              </p>
            </div>
            <div className="permissions-modal__actions">
              <button type="button" className="secondary-action" onClick={closeCobranzaEditor} disabled={editCobranzaSaving}>
                Cancelar
              </button>
              <button type="button" className="primary-action" onClick={handleSaveCobranza} disabled={editCobranzaSaving}>
                {editCobranzaSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {manualRowEditor ? (
        <div className="permissions-modal" role="dialog" aria-modal="true">
          <div className="permissions-modal__backdrop" onClick={closeManualRowEditor} />
          <div className="permissions-modal__content">
            <div className="permissions-modal__header">
              <div>
                <h3>{manualRowEditor.manual_id ? 'Editar fila manual' : 'Nueva fila manual'}</h3>
                <p>
                  {selectedClienteDraft?.nombre ?? selectedCliente?.nombre ?? 'Cliente'} · {manualRowDraft.anio_facturado || 'Año'} ·{' '}
                  {manualRowDraft.mes_facturado || 'Mes'} · {manualRowDraft.periodo_facturado}
                </p>
              </div>
              <button type="button" aria-label="Cerrar" onClick={closeManualRowEditor}>
                ×
              </button>
            </div>

            <div className="permissions-modal__body">
              <div className="form-grid">
                <label className="input-control">
                  <span>Sucursal</span>
                  <select
                    value={manualRowDraft.sucursal_id}
                    onChange={(event) => setManualRowDraft((prev) => ({ ...prev, sucursal_id: event.target.value }))}
                    disabled={manualRowSaving}
                  >
                    <option value="">(Sin sucursal)</option>
                    {sucursales.map((sucursal) => (
                      <option key={sucursal.id ?? uniqueKey()} value={sucursal.id ?? ''}>
                        {sucursal.nombre ?? `Sucursal #${sucursal.id ?? ''}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="input-control">
                  <span>Año</span>
                  <input
                    value={manualRowDraft.anio_facturado}
                    onChange={(event) => setManualRowDraft((prev) => ({ ...prev, anio_facturado: event.target.value }))}
                    disabled={manualRowSaving}
                    placeholder="2026"
                  />
                </label>
                <label className="input-control">
                  <span>Mes</span>
                  <select
                    value={manualRowDraft.mes_facturado}
                    onChange={(event) => setManualRowDraft((prev) => ({ ...prev, mes_facturado: event.target.value }))}
                    disabled={manualRowSaving}
                  >
                    <option value="">Seleccionar...</option>
                    {TARIFA_MONTH_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="input-control">
                  <span>Período</span>
                  <select
                    value={manualRowDraft.periodo_facturado}
                    onChange={(event) => setManualRowDraft((prev) => ({ ...prev, periodo_facturado: event.target.value }))}
                    disabled={manualRowSaving}
                  >
                    {LIQ_CLIENTE_PERIODOS.filter((item) => item.value).map((periodo) => (
                      <option key={periodo.value} value={periodo.value}>
                        {periodo.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="input-control">
                  <span>Estado cobranza</span>
                  <select
                    value={manualRowDraft.estado_cobranza}
                    onChange={(event) => setManualRowDraft((prev) => ({ ...prev, estado_cobranza: event.target.value }))}
                    disabled={manualRowSaving}
                  >
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="A_VENCER">A vencer</option>
                    <option value="VENCIDA">Vencida</option>
                    <option value="PARCIAL">Parcial</option>
                    <option value="COBRADA">Cobrada</option>
                  </select>
                </label>

                <label className="input-control">
                  <span>Neto gravado</span>
                  <input
                    value={manualRowDraft.neto_gravado}
                    onChange={(event) => setManualRowDraft((prev) => ({ ...prev, neto_gravado: event.target.value }))}
                    disabled={manualRowSaving}
                    placeholder="0,00"
                  />
                </label>
                <label className="input-control">
                  <span>No gravado</span>
                  <input
                    value={manualRowDraft.no_gravado}
                    onChange={(event) => setManualRowDraft((prev) => ({ ...prev, no_gravado: event.target.value }))}
                    disabled={manualRowSaving}
                    placeholder="0,00"
                  />
                </label>
                <label className="input-control">
                  <span>IVA</span>
                  <input
                    value={manualRowDraft.iva}
                    onChange={(event) => setManualRowDraft((prev) => ({ ...prev, iva: event.target.value }))}
                    disabled={manualRowSaving}
                    placeholder="0,00"
                  />
                </label>
                <label className="input-control">
                  <span>Importe a cobrar</span>
                  <input
                    value={manualRowDraft.importe_a_cobrar}
                    onChange={(event) => setManualRowDraft((prev) => ({ ...prev, importe_a_cobrar: event.target.value }))}
                    disabled={manualRowSaving}
                    placeholder="0,00"
                  />
                </label>

                <label className="input-control">
                  <span>N° Factura</span>
                  <input
                    value={manualRowDraft.numero_factura}
                    onChange={(event) => setManualRowDraft((prev) => ({ ...prev, numero_factura: event.target.value }))}
                    disabled={manualRowSaving}
                    placeholder="0001-00000123"
                  />
                </label>
                <label className="input-control">
                  <span>Fecha fact</span>
                  <input
                    type="date"
                    value={manualRowDraft.fecha_fact}
                    onChange={(event) => setManualRowDraft((prev) => ({ ...prev, fecha_fact: event.target.value }))}
                    disabled={manualRowSaving}
                  />
                </label>

                <label className="input-control">
                  <span>Fecha cobro</span>
                  <input
                    type="date"
                    value={manualRowDraft.fecha_cobro}
                    onChange={(event) => setManualRowDraft((prev) => ({ ...prev, fecha_cobro: event.target.value }))}
                    disabled={manualRowSaving}
                  />
                </label>
                <label className="input-control">
                  <span>Importe cobrado</span>
                  <input
                    value={manualRowDraft.importe_cobrado}
                    onChange={(event) => setManualRowDraft((prev) => ({ ...prev, importe_cobrado: event.target.value }))}
                    disabled={manualRowSaving}
                    placeholder="0,00"
                  />
                </label>
                <label className="input-control">
                  <span>Retenciones Gcias</span>
                  <input
                    value={manualRowDraft.retenciones_gcias}
                    onChange={(event) => setManualRowDraft((prev) => ({ ...prev, retenciones_gcias: event.target.value }))}
                    disabled={manualRowSaving}
                    placeholder="0,00"
                  />
                </label>
                <label className="input-control">
                  <span>Otras retenciones</span>
                  <input
                    value={manualRowDraft.otras_retenciones}
                    onChange={(event) => setManualRowDraft((prev) => ({ ...prev, otras_retenciones: event.target.value }))}
                    disabled={manualRowSaving}
                    placeholder="0,00"
                  />
                </label>
                <label className="input-control">
                  <span>OP/Recibo</span>
                  <input
                    value={manualRowDraft.op_cobro_recibo}
                    onChange={(event) => setManualRowDraft((prev) => ({ ...prev, op_cobro_recibo: event.target.value }))}
                    disabled={manualRowSaving}
                  />
                </label>
                <label className="input-control">
                  <span>Adjunto OP</span>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    disabled={manualRowSaving}
                    onChange={(event) => setManualRowArchivo(event.target.files?.[0] ?? null)}
                  />
                  {manualRowArchivo ? (
                    <small className="helper-text">Seleccionado: {manualRowArchivo.name}</small>
                  ) : manualRowEditor?.op_cobro_archivo_url ? (
                    <small className="helper-text">
                      Actual:{' '}
                      <a href={manualRowEditor.op_cobro_archivo_url} target="_blank" rel="noreferrer">
                        {manualRowEditor.op_cobro_archivo_nombre ?? 'Adjunto'}
                      </a>
                    </small>
                  ) : (
                    <small className="helper-text">Sin archivo</small>
                  )}
                </label>
                <label className="input-control">
                  <span>Forma cobro</span>
                  <select
                    value={manualRowDraft.forma_cobro}
                    onChange={(event) => setManualRowDraft((prev) => ({ ...prev, forma_cobro: event.target.value }))}
                    disabled={manualRowSaving}
                  >
                    <option value="">(Sin definir)</option>
                    {manualRowDraft.forma_cobro &&
                    !COBRO_FORMA_OPTIONS.some((option) => option.value === manualRowDraft.forma_cobro) ? (
                      <option value={manualRowDraft.forma_cobro}>{manualRowDraft.forma_cobro} (actual)</option>
                    ) : null}
                    {COBRO_FORMA_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="input-control" style={{ gridColumn: 'span 2' }}>
                  <span>Observaciones</span>
                  <textarea
                    rows={3}
                    value={manualRowDraft.observaciones}
                    onChange={(event) => setManualRowDraft((prev) => ({ ...prev, observaciones: event.target.value }))}
                    disabled={manualRowSaving}
                    style={{ resize: 'vertical' }}
                  />
                </label>
              </div>

              {manualRowError ? <p className="form-info form-info--error">{manualRowError}</p> : null}
            </div>

            <div className="permissions-modal__actions">
              {manualRowEditor.manual_id ? (
                <button type="button" className="secondary-action" onClick={handleDeleteManualRow} disabled={manualRowSaving}>
                  Eliminar
                </button>
              ) : null}
              <button type="button" className="secondary-action" onClick={closeManualRowEditor} disabled={manualRowSaving}>
                Cancelar
              </button>
              <button type="button" className="primary-action" onClick={handleSaveManualRow} disabled={manualRowSaving}>
                {manualRowSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
};
