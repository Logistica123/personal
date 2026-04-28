import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLiqApi } from '../features/liquidaciones/api';
import { TarifasImportPanel, TarifasImportLogList } from '../features/liquidaciones/TarifasImportPanel';
import { TarifasContratoPanel } from '../features/liquidaciones/TarifasContratoPanel';
import { LineaTarifaEditModal } from '../features/liquidaciones/LineaTarifaEditModal';
import type {
  LiqCliente,
  LiqEsquemaTarifario,
  LiqDimensionValor,
  LiqLineaTarifa,
  LiqTarifaPatente,
  LiqMapeoConcepto,
  LiqMapeoSucursal,
  LiqConfiguracionGastos,
} from '../features/liquidaciones/types';

type Props = {
  DashboardLayout: React.ComponentType<{ title: string; subtitle?: string; children: React.ReactNode }>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => unknown;
  buildActorHeaders: (user: unknown) => Record<string, string>;
  formatCurrency?: (n: number) => string;
  formatDateOnly?: (s: string) => string;
};

type Tab = 'clientes' | 'esquema' | 'mapeos' | 'gastos' | 'tarifas_contrato' | 'historial';
type BaseClienteOption = { id: number; codigo?: string | null; nombre?: string | null; documento_fiscal?: string | null };
const SUPPORTED_EXTRA_UPLOAD_TYPES = ['TARIFARIO', 'BASE_DISTRIB', 'VARIABLES'] as const;
const SUPPORTED_DISTRIBUTOR_MATCHING = ['patente', 'cuil', 'legajo', 'nombre_exacto', 'nombre_fuzzy'] as const;

export function LiquidacionesClientePage({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  buildActorHeaders,
  formatCurrency,
  formatDateOnly,
}: Props) {
  const authUser = useStoredAuthUser();
  const authUserRef = useRef(authUser);
  authUserRef.current = authUser;
  const api = useLiqApi({ resolveApiBaseUrl, buildActorHeaders, authUser });

  const [activeTab, setActiveTab] = useState<Tab>('clientes');
  const [clientes, setClientes] = useState<LiqCliente[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<LiqCliente | null>(null);
  const [esquemas, setEsquemas] = useState<LiqEsquemaTarifario[]>([]);
  const [selectedEsquema, setSelectedEsquema] = useState<LiqEsquemaTarifario | null>(null);
  const [dimensiones, setDimensiones] = useState<Record<string, LiqDimensionValor[]>>({});
  const [lineas, setLineas] = useState<LiqLineaTarifa[]>([]);
  const [tarifasPatente, setTarifasPatente] = useState<LiqTarifaPatente[]>([]);
  const [mapeosConcepto, setMapeosConcepto] = useState<LiqMapeoConcepto[]>([]);
  const [mapeosSucursal, setMapeosSucursal] = useState<LiqMapeoSucursal[]>([]);
  const [gastos, setGastos] = useState<LiqConfiguracionGastos[]>([]);
  const [historial, setHistorial] = useState<Array<{
    id: number;
    accion: string;
    motivo: string | null;
    created_at: string;
    usuario?: { id: number; name: string; email: string } | null;
    linea_tarifa?: {
      id: number;
      dimensiones_valores: Record<string, string>;
      precio_original: string;
      precio_distribuidor: string;
      esquema?: { nombre: string; dimensiones: string[] } | null;
    } | null;
    valores_anteriores: Record<string, unknown> | null;
    valores_nuevos: Record<string, unknown> | null;
  }>>([]);
  const [historialPage, setHistorialPage] = useState({ current: 1, last: 1 });
  const [historialLoading, setHistorialLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showEnableClientForm, setShowEnableClientForm] = useState(false);
  const [editingClienteId, setEditingClienteId] = useState<number | null>(null);
  const [editNombreCorto, setEditNombreCorto] = useState('');
  const [editCuit, setEditCuit] = useState('');
  const [editTolerancia, setEditTolerancia] = useState('');
  const [editHoja, setEditHoja] = useState('');
  const [editFilaDatos, setEditFilaDatos] = useState('');
  const [editMapeoColumnas, setEditMapeoColumnas] = useState('');
  const [editConceptosValorVariable, setEditConceptosValorVariable] = useState('');
  const [editAllowedTiposArchivo, setEditAllowedTiposArchivo] = useState<string[]>([]);
  const [editPdfRegex, setEditPdfRegex] = useState('');
  const [editPdfSkipPatterns, setEditPdfSkipPatterns] = useState('');
  const [editPdfMaxLineSpan, setEditPdfMaxLineSpan] = useState('');
  const [editPdfConceptoDefault, setEditPdfConceptoDefault] = useState('');
  const [editMatchingDistribuidor, setEditMatchingDistribuidor] = useState<string[]>([]);
  const [savingCliente, setSavingCliente] = useState(false);
  const [baseClienteQuery, setBaseClienteQuery] = useState('');
  const [baseClienteOptions, setBaseClienteOptions] = useState<BaseClienteOption[]>([]);
  const [baseClienteLoading, setBaseClienteLoading] = useState(false);
  const [selectedBaseClienteId, setSelectedBaseClienteId] = useState<string>('');
  const [enablingClient, setEnablingClient] = useState(false);

  // New schema form
  const [newEsqNombre, setNewEsqNombre] = useState('');
  const [newEsqDescripcion, setNewEsqDescripcion] = useState('');
  const [newEsqDims, setNewEsqDims] = useState('sucursal, concepto');

  // New dimension form
  const [newDimNombre, setNewDimNombre] = useState('');
  const [newDimValor, setNewDimValor] = useState('');

  // New tariff line form
  const [newLineaDims, setNewLineaDims] = useState<Record<string, string>>({});
  const [newLineaPrecio, setNewLineaPrecio] = useState('');
  const [newLineaPctAg, setNewLineaPctAg] = useState('');
  const [newLineaDistPrecio, setNewLineaDistPrecio] = useState('');
  const [newLineaVigDesde, setNewLineaVigDesde] = useState('');
  const [newLineaVigHasta, setNewLineaVigHasta] = useState('');
  const [newLineaMotivo, setNewLineaMotivo] = useState('Carga inicial');
  // OCASA tariff fields
  const [newLineaModeloTarifa, setNewLineaModeloTarifa] = useState<string>('JORNADA');
  const [newLineaCostoFijoBase, setNewLineaCostoFijoBase] = useState('');
  const [newLineaTarifaKmDistrib, setNewLineaTarifaKmDistrib] = useState('');
  const [newLineaTarifaKmOriginal, setNewLineaTarifaKmOriginal] = useState('');
  const [newLineaModoProd, setNewLineaModoProd] = useState<'porcentaje' | 'por_parada' | 'por_bulto'>('por_parada');
  const [newLineaTarifaParada, setNewLineaTarifaParada] = useState('');
  const [newLineaTarifaBulto, setNewLineaTarifaBulto] = useState('');
  const [newLineaUmbralKm, setNewLineaUmbralKm] = useState('240');
  const [newLineaCapacidadKg, setNewLineaCapacidadKg] = useState('');

  // Edit línea modal
  const [editingLineaId, setEditingLineaId] = useState<number | null>(null);

  // OCASA detection
  const isOcasaClient = useMemo(() => {
    if (!selectedCliente) return false;
    const cfg = selectedCliente.configuracion_excel;
    return (cfg as any)?.tipo_archivo === 'excel_triple';
  }, [selectedCliente]);

  // Tarifa por patente (override)
  const [newTPPatente, setNewTPPatente] = useState('');
  const [newTPDims, setNewTPDims] = useState<Record<string, string>>({});
  const [newTPLineaId, setNewTPLineaId] = useState<string>('');
  const [newTPVigDesde, setNewTPVigDesde] = useState('');
  const [newTPVigHasta, setNewTPVigHasta] = useState('');

  // Import tariff excel
  const [importTarifaFile, setImportTarifaFile] = useState<File | null>(null);
  const [importVigDesde, setImportVigDesde] = useState('');
  const [importVigHasta, setImportVigHasta] = useState('');
  const [importMotivo, setImportMotivo] = useState('Importación Excel');
  const [importingTarifa, setImportingTarifa] = useState(false);

  // Aumento porcentual
  const [aumentoPct, setAumentoPct] = useState('');
  const [aumentoSucursal, setAumentoSucursal] = useState('');
  const [aumentoMotivo, setAumentoMotivo] = useState('');
  const [aumentoPreview, setAumentoPreview] = useState<any>(null);
  const [aumentoLoading, setAumentoLoading] = useState(false);

  // New gasto form
  const [newGastoConcepto, setNewGastoConcepto] = useState('Administración');
  const [newGastoMonto, setNewGastoMonto] = useState('');
  const [newGastoTipo, setNewGastoTipo] = useState<'fijo' | 'porcentual'>('fijo');
  const [newGastoVigDesde, setNewGastoVigDesde] = useState('');
  const [newGastoVigHasta, setNewGastoVigHasta] = useState('');

  // New mapeo concepto form
  const [newMapExcel, setNewMapExcel] = useState('');
  const [newMapDim, setNewMapDim] = useState('concepto');
  const [newMapTarifa, setNewMapTarifa] = useState('');

  // New mapeo sucursal form
  const [newMapPatronArchivo, setNewMapPatronArchivo] = useState('');
  const [newMapSucursalTarifa, setNewMapSucursalTarifa] = useState('');
  const [newMapTipoOperacion, setNewMapTipoOperacion] = useState('');

  const fmt = formatCurrency ?? ((n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
  const fmtDate = formatDateOnly ?? ((s: string) => s);
  const parseMoneyInput = (raw: string): number | null => {
    let s = (raw ?? '').trim();
    if (s === '') return null;
    s = s.toLowerCase();
    s = s.replace(/ars|ar\$|\$/g, '');
    s = s.replace(/\s+/g, '');
    // keep digits, separators and sign
    s = s.replace(/[^0-9,.-]/g, '');
    if (s === '' || s === '-' || s === '.' || s === ',') return null;

    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma !== -1 && lastDot !== -1) {
      if (lastComma > lastDot) {
        // es-AR: 211.082,00
        s = s.replace(/\./g, '');
        s = s.replace(',', '.');
      } else {
        // en-US: 211,082.00
        s = s.replace(/,/g, '');
      }
    } else if (lastComma !== -1) {
      const decLen = s.length - lastComma - 1;
      if (decLen >= 1 && decLen <= 2) {
        s = s.replace(/\./g, '');
        s = s.replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else {
      s = s.replace(/,/g, '');
    }

    const v = Number(s);
    if (!Number.isFinite(v)) return null;
    return Math.round(v * 100) / 100;
  };

  const parsePercentInput = (raw: string): number | null => {
    let s = (raw ?? '').trim();
    if (s === '') return null;
    s = s.replace('%', '').replace(',', '.');
    s = s.replace(/[^0-9.-]/g, '');
    if (s === '' || s === '.' || s === '-') return null;
    const v = Number(s);
    if (!Number.isFinite(v)) return null;
    return Math.round(v * 100) / 100;
  };
  const getTolerancia = (c: LiqCliente): string => {
    const raw = c.configuracion_excel && typeof c.configuracion_excel === 'object' ? (c.configuracion_excel as any).tolerancia_porcentaje : null;
    if (typeof raw === 'number') return `${raw}%`;
    if (typeof raw === 'string' && raw.trim() !== '') return `${raw}%`;
    return '2%';
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const loadBaseClientes = useCallback(async (q: string) => {
    setBaseClienteLoading(true);
    try {
      const qs = new URLSearchParams();
      if (q.trim() !== '') qs.set('q', q.trim());
      qs.set('limit', '30');

      const baseUrl = resolveApiBaseUrl();
      const actorHeaders = buildActorHeaders(authUserRef.current);
      const r = await fetch(`${baseUrl}/api/clientes/select?${qs.toString()}`, {
        credentials: 'include',
        headers: { Accept: 'application/json', ...actorHeaders },
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = (json && typeof json === 'object' && (json.message || json.error))
          ? String(json.message || json.error)
          : `Error ${r.status}`;
        throw new Error(msg);
      }
      const items = (json?.data ?? []) as unknown;
      setBaseClienteOptions(Array.isArray(items) ? (items as BaseClienteOption[]) : []);
    } catch (e: unknown) {
      setBaseClienteOptions([]);
      setError(e instanceof Error ? e.message : 'Error cargando clientes');
    } finally {
      setBaseClienteLoading(false);
    }
  }, [buildActorHeaders, resolveApiBaseUrl]);

  useEffect(() => {
    if (!showEnableClientForm) return;
    const handle = window.setTimeout(() => {
      void loadBaseClientes(baseClienteQuery);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [showEnableClientForm, baseClienteQuery, loadBaseClientes]);

  const startEditCliente = useCallback((c: LiqCliente) => {
    setEditingClienteId(c.id);
    setEditNombreCorto(c.nombre_corto ?? '');
    setEditCuit(c.cuit ?? '');
    const cfg = c.configuracion_excel as Record<string, unknown> | null;
    const conceptosValorVariable: unknown[] = Array.isArray(cfg?.conceptos_valor_variable) ? (cfg?.conceptos_valor_variable ?? []) : [];
    const allowedTiposArchivo: unknown[] = Array.isArray(cfg?.allowed_tipos_archivo) ? (cfg?.allowed_tipos_archivo ?? []) : [];
    const pdfSkipPatterns: unknown[] = Array.isArray(cfg?.pdf_skip_line_patterns) ? (cfg?.pdf_skip_line_patterns ?? []) : [];
    const matchingDistribuidor: unknown[] = Array.isArray(cfg?.matching_distribuidor) ? (cfg?.matching_distribuidor ?? []) : [];
    setEditTolerancia(cfg?.tolerancia_porcentaje != null ? String(cfg.tolerancia_porcentaje) : '');
    setEditHoja(typeof cfg?.hoja === 'string' ? cfg.hoja : '');
    setEditFilaDatos(cfg?.fila_datos != null ? String(cfg.fila_datos) : '');
    setEditMapeoColumnas(
      cfg?.mapeo_columnas && typeof cfg.mapeo_columnas === 'object'
        ? JSON.stringify(cfg.mapeo_columnas, null, 2)
        : ''
    );
    setEditConceptosValorVariable(
      conceptosValorVariable.filter((v): v is string => typeof v === 'string' && v.trim() !== '').join(', ')
    );
    setEditAllowedTiposArchivo(
      allowedTiposArchivo
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim().toUpperCase())
        .filter((v) => SUPPORTED_EXTRA_UPLOAD_TYPES.includes(v as typeof SUPPORTED_EXTRA_UPLOAD_TYPES[number]))
    );
    setEditPdfRegex(typeof cfg?.pdf_operacion_regex === 'string' ? cfg.pdf_operacion_regex : '');
    setEditPdfSkipPatterns(
      pdfSkipPatterns.filter((v): v is string => typeof v === 'string' && v.trim() !== '').join(', ')
    );
    setEditPdfMaxLineSpan(cfg?.pdf_max_line_span != null ? String(cfg.pdf_max_line_span) : '');
    setEditPdfConceptoDefault(typeof cfg?.pdf_concepto_default === 'string' ? cfg.pdf_concepto_default : '');
    setEditMatchingDistribuidor(
      matchingDistribuidor
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim().toLowerCase())
        .filter((v) => SUPPORTED_DISTRIBUTOR_MATCHING.includes(v as typeof SUPPORTED_DISTRIBUTOR_MATCHING[number]))
    );
  }, []);

  const saveCliente = useCallback(async () => {
    if (editingClienteId == null) return;
    const nombreCorto = editNombreCorto.trim();
    if (!nombreCorto) { setError('Nombre corto es obligatorio'); return; }
    setSavingCliente(true);
    try {
      const toleranciaNum = editTolerancia.trim() !== '' ? parseFloat(editTolerancia.replace(',', '.')) : null;
      if (editTolerancia.trim() !== '' && (toleranciaNum == null || Number.isNaN(toleranciaNum))) {
        setError('Tolerancia inválida');
        return;
      }
      const filaDatosNum = editFilaDatos.trim() !== '' ? parseInt(editFilaDatos, 10) : null;
      if (editFilaDatos.trim() !== '' && (!Number.isFinite(filaDatosNum) || (filaDatosNum ?? 0) < 1)) {
        setError('Fila de datos inválida');
        return;
      }
      const pdfMaxLineSpanNum = editPdfMaxLineSpan.trim() !== '' ? parseInt(editPdfMaxLineSpan, 10) : null;
      if (editPdfMaxLineSpan.trim() !== '' && (!Number.isFinite(pdfMaxLineSpanNum) || (pdfMaxLineSpanNum ?? 0) < 1 || (pdfMaxLineSpanNum ?? 0) > 3)) {
        setError('pdf_max_line_span debe estar entre 1 y 3');
        return;
      }
      const body: Record<string, unknown> = { nombre_corto: nombreCorto, cuit: editCuit.trim() || null };
      // Merge configuracion_excel preserving existing keys
      const existingCfg = (clientes.find((c) => c.id === editingClienteId)?.configuracion_excel ?? {}) as Record<string, unknown>;
      const newCfg: Record<string, unknown> = { ...existingCfg };
      if (toleranciaNum != null && !Number.isNaN(toleranciaNum)) {
        newCfg.tolerancia_porcentaje = toleranciaNum;
      } else {
        delete newCfg.tolerancia_porcentaje;
      }
      if (editHoja.trim()) {
        newCfg.hoja = editHoja.trim();
      } else {
        delete newCfg.hoja;
      }
      if (filaDatosNum != null && Number.isFinite(filaDatosNum) && filaDatosNum >= 1) {
        newCfg.fila_datos = filaDatosNum;
      } else {
        delete newCfg.fila_datos;
      }
      if (editMapeoColumnas.trim()) {
        let parsedMapeoColumnas: unknown;
        try {
          parsedMapeoColumnas = JSON.parse(editMapeoColumnas);
        } catch {
          setError('mapeo_columnas debe ser un JSON válido');
          return;
        }
        if (!parsedMapeoColumnas || typeof parsedMapeoColumnas !== 'object' || Array.isArray(parsedMapeoColumnas)) {
          setError('mapeo_columnas debe ser un objeto JSON');
          return;
        }
        newCfg.mapeo_columnas = parsedMapeoColumnas;
      } else {
        delete newCfg.mapeo_columnas;
      }
      const conceptosValorVariable = editConceptosValorVariable
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter((s) => s !== '');
      if (conceptosValorVariable.length > 0) {
        newCfg.conceptos_valor_variable = Array.from(new Set(conceptosValorVariable));
      } else {
        delete newCfg.conceptos_valor_variable;
      }
      if (editAllowedTiposArchivo.length > 0) {
        newCfg.allowed_tipos_archivo = editAllowedTiposArchivo;
      } else {
        delete newCfg.allowed_tipos_archivo;
      }
      if (editPdfRegex.trim()) {
        newCfg.pdf_operacion_regex = editPdfRegex.trim();
      } else {
        delete newCfg.pdf_operacion_regex;
      }
      const pdfSkipPatterns = editPdfSkipPatterns
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter((s) => s !== '');
      if (pdfSkipPatterns.length > 0) {
        newCfg.pdf_skip_line_patterns = Array.from(new Set(pdfSkipPatterns));
      } else {
        delete newCfg.pdf_skip_line_patterns;
      }
      if (pdfMaxLineSpanNum != null && Number.isFinite(pdfMaxLineSpanNum) && pdfMaxLineSpanNum >= 1 && pdfMaxLineSpanNum <= 3) {
        newCfg.pdf_max_line_span = pdfMaxLineSpanNum;
      } else {
        delete newCfg.pdf_max_line_span;
      }
      if (editPdfConceptoDefault.trim()) {
        newCfg.pdf_concepto_default = editPdfConceptoDefault.trim();
      } else {
        delete newCfg.pdf_concepto_default;
      }
      if (editMatchingDistribuidor.length > 0) {
        newCfg.matching_distribuidor = editMatchingDistribuidor;
      } else {
        delete newCfg.matching_distribuidor;
      }
      body.configuracion_excel = newCfg;
      const res = await api.patch(`/clientes/${editingClienteId}`, body);
      setClientes((prev) => prev.map((c) => c.id === editingClienteId ? { ...c, ...(res.data ?? {}) } : c));
      if (selectedCliente?.id === editingClienteId) setSelectedCliente((prev) => prev ? { ...prev, ...(res.data ?? {}) } : prev);
      setEditingClienteId(null);
      showSuccess('Configuración guardada');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando configuración');
    } finally {
      setSavingCliente(false);
    }
  }, [api, clientes, editingClienteId, editAllowedTiposArchivo, editConceptosValorVariable, editCuit, editFilaDatos, editHoja, editMapeoColumnas, editMatchingDistribuidor, editNombreCorto, editPdfConceptoDefault, editPdfMaxLineSpan, editPdfRegex, editPdfSkipPatterns, editTolerancia, selectedCliente]);

  const toggleAllowedTipoArchivo = useCallback((tipo: string) => {
    setEditAllowedTiposArchivo((prev) => (
      prev.includes(tipo)
        ? prev.filter((item) => item !== tipo)
        : [...prev, tipo]
    ));
  }, []);

  const toggleMatchingDistribuidor = useCallback((strategy: string) => {
    setEditMatchingDistribuidor((prev) => (
      prev.includes(strategy)
        ? prev.filter((item) => item !== strategy)
        : [...prev, strategy]
    ));
  }, []);

  const loadClientes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/clientes');
      setClientes(res.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando clientes');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { loadClientes(); }, [loadClientes]);

  const selectCliente = useCallback(async (cliente: LiqCliente) => {
    setSelectedCliente(cliente);
    setSelectedEsquema(null);
    setDimensiones({});
    setLineas([]);
    try {
      const [esqRes, mapConRes, mapSucRes, gastosRes] = await Promise.all([
        api.get(`/clientes/${cliente.id}/esquemas`),
        api.get(`/clientes/${cliente.id}/mapeos-concepto`),
        api.get(`/clientes/${cliente.id}/mapeos-sucursal`),
        api.get(`/clientes/${cliente.id}/gastos`),
      ]);
      setEsquemas(esqRes.data ?? []);
      setMapeosConcepto(mapConRes.data ?? []);
      setMapeosSucursal(mapSucRes.data ?? []);
      setGastos(gastosRes.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando datos del cliente');
    }
  }, [api]);

  const enableCliente = useCallback(async () => {
    const id = Number(selectedBaseClienteId);
    if (!Number.isFinite(id) || id <= 0) {
      setError('Seleccioná un cliente válido.');
      return;
    }
    setEnablingClient(true);
    try {
      const res = await api.post('/clientes', { distriapp_cliente_id: id });
      showSuccess(res.message ?? 'Cliente habilitado');
      setShowEnableClientForm(false);
      setSelectedBaseClienteId('');
      setBaseClienteQuery('');
      await loadClientes();
      if (res?.data?.id) {
        await selectCliente(res.data as LiqCliente);
        setActiveTab('esquema');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error habilitando cliente');
    } finally {
      setEnablingClient(false);
    }
  }, [api, loadClientes, selectCliente, selectedBaseClienteId]);

  const refreshMapeos = useCallback(async () => {
    if (!selectedCliente) return;
    try {
      const [mapConRes, mapSucRes] = await Promise.all([
        api.get(`/clientes/${selectedCliente.id}/mapeos-concepto`),
        api.get(`/clientes/${selectedCliente.id}/mapeos-sucursal`),
      ]);
      setMapeosConcepto(mapConRes.data ?? []);
      setMapeosSucursal(mapSucRes.data ?? []);
    } catch { /* silent */ }
  }, [api, selectedCliente]);

  const addMapeoConcepto = useCallback(async () => {
    if (!selectedCliente) return;
    const valorExcel = newMapExcel.trim();
    const dimensionDestino = newMapDim.trim();
    const valorTarifa = newMapTarifa.trim();
    if (!valorExcel) { setError('Valor en Excel es obligatorio'); return; }
    if (!dimensionDestino) { setError('Dimensión destino es obligatoria'); return; }
    if (!valorTarifa) { setError('Valor tarifa es obligatorio'); return; }
    try {
      await api.post(`/clientes/${selectedCliente.id}/mapeos-concepto`, {
        mapeos: [{ valor_excel: valorExcel, dimension_destino: dimensionDestino, valor_tarifa: valorTarifa }],
      });
      setNewMapExcel('');
      setNewMapTarifa('');
      await refreshMapeos();
      showSuccess('Mapeo de concepto guardado');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando mapeo');
    }
  }, [api, selectedCliente, newMapExcel, newMapDim, newMapTarifa, refreshMapeos]);

  const desactivarMapeoConcepto = useCallback(async (id: number) => {
    if (!window.confirm('¿Desactivar este mapeo de concepto?')) return;
    try {
      await api.put(`/mapeos-concepto/${id}/desactivar`, {});
      await refreshMapeos();
      showSuccess('Mapeo desactivado');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desactivando mapeo');
    }
  }, [api, refreshMapeos]);

  const addMapeoSucursal = useCallback(async () => {
    if (!selectedCliente) return;
    const patron = newMapPatronArchivo.trim();
    const sucTarifa = newMapSucursalTarifa.trim();
    const tipoOp = newMapTipoOperacion.trim();
    if (!patron) { setError('Patrón de archivo es obligatorio'); return; }
    if (!sucTarifa) { setError('Sucursal tarifa es obligatoria'); return; }
    try {
      await api.post(`/clientes/${selectedCliente.id}/mapeos-sucursal`, {
        mapeos: [{ patron_archivo: patron, sucursal_tarifa: sucTarifa, tipo_operacion: tipoOp || null }],
      });
      setNewMapPatronArchivo('');
      setNewMapSucursalTarifa('');
      setNewMapTipoOperacion('');
      await refreshMapeos();
      showSuccess('Mapeo de sucursal guardado');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando mapeo');
    }
  }, [api, selectedCliente, newMapPatronArchivo, newMapSucursalTarifa, newMapTipoOperacion, refreshMapeos]);

  const desactivarMapeoSucursal = useCallback(async (id: number) => {
    if (!window.confirm('¿Desactivar este mapeo de sucursal?')) return;
    try {
      await api.put(`/mapeos-sucursal/${id}/desactivar`, {});
      await refreshMapeos();
      showSuccess('Mapeo desactivado');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desactivando mapeo');
    }
  }, [api, refreshMapeos]);

  const selectEsquema = useCallback(async (esquema: LiqEsquemaTarifario) => {
    setSelectedEsquema(esquema);
    try {
      const [dimRes, lineasRes, tpRes] = await Promise.all([
        api.get(`/esquemas/${esquema.id}/dimensiones`),
        api.get(`/esquemas/${esquema.id}/lineas`),
        api.get(`/esquemas/${esquema.id}/tarifas-patente`),
      ]);
      setDimensiones(dimRes.data ?? {});
      setLineas(lineasRes.data ?? []);
      setTarifasPatente(tpRes.data ?? []);
      setNewTPPatente('');
      setNewTPLineaId('');
      setNewTPVigDesde('');
      setNewTPVigHasta('');
      setNewTPDims({});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando esquema');
    }
  }, [api]);

  const refreshTarifasPatente = useCallback(async () => {
    if (!selectedEsquema) return;
    try {
      const r = await api.get(`/esquemas/${selectedEsquema.id}/tarifas-patente`);
      setTarifasPatente(r.data ?? []);
    } catch {
      // silent
    }
  }, [api, selectedEsquema]);

  const guardarTarifaPatente = useCallback(async () => {
    if (!selectedEsquema) return;
    const patente = newTPPatente.trim();
    const lineaId = Number(newTPLineaId);
    if (!patente) { setError('Patente es obligatoria'); return; }
    if (!Number.isFinite(lineaId) || lineaId <= 0) { setError('Seleccioná una línea destino'); return; }
    if (!newTPVigDesde) { setError('Vigencia desde es obligatoria'); return; }

    const dims: Record<string, string> = {};
    for (const d of selectedEsquema.dimensiones) {
      const v = (newTPDims[d] ?? '').trim();
      if (!v) { setError(`Falta la dimensión: ${d}`); return; }
      dims[d] = v;
    }

    try {
      await api.post(`/esquemas/${selectedEsquema.id}/tarifas-patente`, {
        patente,
        dimensiones_valores: dims,
        linea_tarifa_id: lineaId,
        vigencia_desde: newTPVigDesde,
        vigencia_hasta: newTPVigHasta || null,
      });
      setNewTPPatente('');
      setNewTPLineaId('');
      setNewTPVigDesde('');
      setNewTPVigHasta('');
      setNewTPDims({});
      await refreshTarifasPatente();
      showSuccess('Tarifa por patente guardada');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando tarifa por patente');
    }
  }, [api, newTPDims, newTPLineaId, newTPPatente, newTPVigDesde, newTPVigHasta, refreshTarifasPatente, selectedEsquema]);

  const desactivarTarifaPatente = useCallback(async (id: number) => {
    if (!window.confirm('¿Desactivar esta tarifa por patente?')) return;
    try {
      await api.put(`/tarifas-patente/${id}/desactivar`, {});
      await refreshTarifasPatente();
      showSuccess('Tarifa por patente desactivada');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desactivando');
    }
  }, [api, refreshTarifasPatente]);

  const refreshEsquemas = useCallback(async () => {
    if (!selectedCliente) return;
    try {
      const esqRes = await api.get(`/clientes/${selectedCliente.id}/esquemas`);
      setEsquemas(esqRes.data ?? []);
    } catch { /* silent */ }
  }, [api, selectedCliente]);

  const crearEsquema = useCallback(async () => {
    if (!selectedCliente) return;
    const nombre = newEsqNombre.trim();
    const dims = newEsqDims
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    const uniqDims = Array.from(new Set(dims));
    if (!nombre) {
      setError('Nombre del esquema es obligatorio');
      return;
    }
    if (uniqDims.length === 0) {
      setError('Ingresá al menos 1 dimensión (ej: sucursal, concepto)');
      return;
    }
    try {
      const res = await api.post(`/clientes/${selectedCliente.id}/esquemas`, { nombre, descripcion: newEsqDescripcion.trim() || null, dimensiones: uniqDims });
      setNewEsqNombre('');
      setNewEsqDescripcion('');
      showSuccess('Esquema creado');
      await refreshEsquemas();
      if (res?.data?.id) {
        await selectEsquema(res.data as LiqEsquemaTarifario);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error creando esquema');
    }
  }, [api, newEsqNombre, newEsqDescripcion, newEsqDims, refreshEsquemas, selectEsquema, selectedCliente]);

  const importarTarifaExcel = useCallback(async () => {
    if (!selectedEsquema) return;
    if (!importTarifaFile) { setError('Seleccioná un archivo Excel'); return; }
    if (!importVigDesde) { setError('Vigencia desde es obligatoria'); return; }
    if (!importMotivo.trim()) { setError('Motivo es obligatorio'); return; }

    setImportingTarifa(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('archivo', importTarifaFile);
      fd.append('vigencia_desde', importVigDesde);
      if (importVigHasta) fd.append('vigencia_hasta', importVigHasta);
      fd.append('motivo', importMotivo.trim());

      const res = await api.postForm(`/esquemas/${selectedEsquema.id}/importar-excel`, fd);
      showSuccess(res.message ?? 'Tarifa importada');
      setImportTarifaFile(null);
      await refreshEsquemas();
      await selectEsquema(selectedEsquema);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error importando tarifa');
    } finally {
      setImportingTarifa(false);
    }
  }, [api, importMotivo, importTarifaFile, importVigDesde, importVigHasta, refreshEsquemas, selectEsquema, selectedEsquema]);

  const importarTarifaOca = useCallback(async () => {
    if (!selectedEsquema) return;
    if (!importTarifaFile) { setError('Seleccioná un archivo Excel'); return; }
    if (!importVigDesde) { setError('Vigencia desde es obligatoria'); return; }
    if (!importMotivo.trim()) { setError('Motivo es obligatorio'); return; }

    setImportingTarifa(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('archivo', importTarifaFile);
      fd.append('vigencia_desde', importVigDesde);
      if (importVigHasta) fd.append('vigencia_hasta', importVigHasta);
      fd.append('motivo', importMotivo.trim());

      const res = await api.postForm(`/esquemas/${selectedEsquema.id}/importar-oca`, fd);
      showSuccess(res.message ?? 'Tarifa OCA importada');
      setImportTarifaFile(null);
      await refreshEsquemas();
      await selectEsquema(selectedEsquema);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error importando tarifa OCA');
    } finally {
      setImportingTarifa(false);
    }
  }, [api, importMotivo, importTarifaFile, importVigDesde, importVigHasta, refreshEsquemas, selectEsquema, selectedEsquema]);

  const previsualizarAumento = useCallback(async () => {
    if (!selectedEsquema || !aumentoPct) return;
    setAumentoLoading(true);
    try {
      const res = await api.post(`/esquemas/${selectedEsquema.id}/aumento-preview`, {
        porcentaje: parseFloat(aumentoPct.replace(',', '.')),
        sucursal: aumentoSucursal || null,
      });
      setAumentoPreview(res.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setAumentoLoading(false);
    }
  }, [api, selectedEsquema, aumentoPct, aumentoSucursal]);

  const aplicarAumento = useCallback(async () => {
    if (!selectedEsquema || !aumentoPreview || !aumentoMotivo.trim()) { setError('Motivo obligatorio'); return; }
    if (!window.confirm(`¿Aplicar aumento a ${aumentoPreview.lineas.length} líneas?`)) return;
    setAumentoLoading(true);
    try {
      const lineas = aumentoPreview.lineas.map((l: any) => ({
        linea_id: l.linea_id,
        precio_nuevo: l.precio_nuevo,
        overrides: (l.overrides ?? []).map((o: any) => ({
          id: o.id,
          accion: o._accion ?? 'mantener',
        })),
      }));
      const res = await api.post(`/esquemas/${selectedEsquema.id}/aumento-aplicar`, {
        motivo: aumentoMotivo,
        lineas,
      });
      showSuccess(res.message ?? 'Aumento aplicado');
      setAumentoPreview(null);
      setAumentoPct('');
      setAumentoMotivo('');
      if (selectedEsquema) await selectEsquema(selectedEsquema);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error aplicando aumento');
    } finally {
      setAumentoLoading(false);
    }
  }, [api, selectedEsquema, aumentoPreview, aumentoMotivo, selectEsquema]);

  const desactivarEsquema = useCallback(async (esquema: LiqEsquemaTarifario) => {
    if (!selectedCliente) return;
    if (!window.confirm(`¿Desactivar el esquema "${esquema.nombre}"? (No se borra, queda histórico)`)) return;
    try {
      await api.put(`/esquemas/${esquema.id}/desactivar`);
      if (selectedEsquema?.id === esquema.id) {
        setSelectedEsquema(null);
        setDimensiones({});
        setLineas([]);
      }
      await refreshEsquemas();
      showSuccess('Esquema desactivado');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desactivando esquema');
    }
  }, [api, selectedCliente, selectedEsquema?.id, refreshEsquemas]);

  const activarEsquema = useCallback(async (esquema: LiqEsquemaTarifario) => {
    if (!selectedCliente) return;
    if (!window.confirm(`¿Activar el esquema "${esquema.nombre}"? (Desactiva el resto)`)) return;
    try {
      await api.put(`/esquemas/${esquema.id}/activar`);
      await refreshEsquemas();
      showSuccess('Esquema activado');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error activando esquema');
    }
  }, [api, selectedCliente, refreshEsquemas]);

  const eliminarEsquema = useCallback(async (esquema: LiqEsquemaTarifario) => {
    if (!selectedCliente) return;
    if (esquema.activo) { setError('No se puede eliminar un esquema activo. Desactiválo primero.'); return; }
    if (!window.confirm(`¿Eliminar el esquema "${esquema.nombre}" definitivamente? (No se puede deshacer)`)) return;
    try {
      await api.delete(`/esquemas/${esquema.id}`);
      if (selectedEsquema?.id === esquema.id) {
        setSelectedEsquema(null);
        setDimensiones({});
        setLineas([]);
      }
      await refreshEsquemas();
      showSuccess('Esquema eliminado');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error eliminando esquema');
    }
  }, [api, selectedCliente, selectedEsquema?.id, refreshEsquemas]);

  const addDimension = useCallback(async () => {
    if (!selectedEsquema || !newDimNombre || !newDimValor) return;
    try {
      await api.post(`/esquemas/${selectedEsquema.id}/dimensiones`, {
        nombre_dimension: newDimNombre,
        valor: newDimValor,
      });
      setNewDimValor('');
      const res = await api.get(`/esquemas/${selectedEsquema.id}/dimensiones`);
      setDimensiones(res.data ?? {});
      showSuccess('Valor agregado');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }, [api, selectedEsquema, newDimNombre, newDimValor]);

  const addLinea = useCallback(async () => {
    if (!selectedEsquema) return;
    const precio = parseMoneyInput(newLineaPrecio);
    if (precio == null || precio <= 0) { setError('Precio original inválido'); return; }

    // Calcular % agencia: prioridad al precio distribuidor manual
    const distManual = parseMoneyInput(newLineaDistPrecio);
    let pct: number | null;
    if (distManual != null && distManual > 0) {
      pct = parseFloat(((1 - distManual / precio) * 100).toFixed(4));
    } else {
      pct = parsePercentInput(newLineaPctAg);
    }
    if (pct == null || pct < 0 || pct >= 100) { setError('Necesitás un % agencia o un precio distribuidor válido'); return; }

    if (!newLineaVigDesde) { setError('Vigencia desde es obligatoria'); return; }
    if (!newLineaMotivo || newLineaMotivo.trim().length < 3) { setError('Motivo es obligatorio'); return; }
    const dimsFaltantes = (selectedEsquema.dimensiones ?? []).filter((d) => !(newLineaDims[d] ?? '').trim());
    if (dimsFaltantes.length > 0) { setError(`Faltan dimensiones: ${dimsFaltantes.join(', ')}`); return; }
    try {
      const body: Record<string, unknown> = {
        dimensiones_valores: newLineaDims,
        precio_original: precio,
        porcentaje_agencia: pct,
        vigencia_desde: newLineaVigDesde,
        vigencia_hasta: newLineaVigHasta || null,
        motivo: newLineaMotivo,
      };
      // OCASA fields
      if (isOcasaClient) {
        body.modelo_tarifa = newLineaModeloTarifa || null;
        const costoFijoBase = parseMoneyInput(newLineaCostoFijoBase);
        if (costoFijoBase != null && costoFijoBase > 0) body.costo_fijo_base = costoFijoBase;
        if (newLineaModeloTarifa === 'JORNADA_KM') {
          const tarifaKmOrig = parseMoneyInput(newLineaTarifaKmOriginal);
          if (tarifaKmOrig != null) body.tarifa_km_original = tarifaKmOrig;
          const tarifaKm = parseMoneyInput(newLineaTarifaKmDistrib);
          if (tarifaKm != null) body.tarifa_km_distribuidor = tarifaKm;
          body.umbral_km = parseInt(newLineaUmbralKm, 10) || 240;
        }
        if (newLineaModeloTarifa === 'PRODUCTIVIDAD') {
          body.modo_productividad = newLineaModoProd;
          if (newLineaModoProd === 'por_parada') {
            const tp = parseMoneyInput(newLineaTarifaParada);
            if (tp != null) body.tarifa_parada_distrib = tp;
          } else if (newLineaModoProd === 'por_bulto') {
            const tb = parseMoneyInput(newLineaTarifaBulto);
            if (tb != null) body.tarifa_bulto_distrib = tb;
          }
        }
        if (newLineaCapacidadKg) body.capacidad_vehiculo_kg = parseInt(newLineaCapacidadKg, 10);
      }
      await api.post(`/esquemas/${selectedEsquema.id}/lineas`, body);
      setNewLineaDims({});
      setNewLineaPrecio('');
      setNewLineaPctAg('');
      setNewLineaDistPrecio('');
      setNewLineaCostoFijoBase('');
      setNewLineaTarifaKmDistrib('');
      setNewLineaTarifaKmOriginal('');
      setNewLineaTarifaParada('');
      setNewLineaTarifaBulto('');
      setNewLineaCapacidadKg('');
      const res = await api.get(`/esquemas/${selectedEsquema.id}/lineas`);
      setLineas(res.data ?? []);
      showSuccess('Línea creada');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }, [api, selectedEsquema, newLineaDims, newLineaPrecio, newLineaPctAg, newLineaDistPrecio, newLineaVigDesde, newLineaVigHasta, newLineaMotivo, isOcasaClient, newLineaModeloTarifa, newLineaCostoFijoBase, newLineaTarifaKmDistrib, newLineaTarifaKmOriginal, newLineaUmbralKm, newLineaCapacidadKg, newLineaModoProd, newLineaTarifaParada, newLineaTarifaBulto]);

  const aprobarLinea = useCallback(async (id: number) => {
    const motivo = window.prompt('Motivo de aprobación:', 'Aprobación manual');
    if (motivo === null) return;
    try {
      await api.put(`/lineas/${id}/aprobar`, { motivo: motivo.trim() || 'Aprobación manual' });
      if (selectedEsquema) {
        const res = await api.get(`/esquemas/${selectedEsquema.id}/lineas`);
        setLineas(res.data ?? []);
      }
      showSuccess('Línea aprobada');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }, [api, selectedEsquema]);

  const aprobarTodasLineas = useCallback(async () => {
    if (!selectedEsquema) return;
    if (!window.confirm('¿Aprobar todas las líneas pendientes de este esquema?')) return;
    try {
      await api.post(`/esquemas/${selectedEsquema.id}/lineas/aprobar-todas`, { motivo: 'Aprobación masiva' });
      const res = await api.get(`/esquemas/${selectedEsquema.id}/lineas`);
      setLineas(res.data ?? []);
      showSuccess('Líneas aprobadas');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }, [api, selectedEsquema]);

  const desactivarLinea = useCallback(async (id: number) => {
    if (!window.confirm('¿Desactivar esta línea de tarifa?')) return;
    try {
      await api.put(`/lineas/${id}/desactivar`, { motivo: 'Desactivación manual' });
      if (selectedEsquema) {
        const res = await api.get(`/esquemas/${selectedEsquema.id}/lineas`);
        setLineas(res.data ?? []);
      }
      showSuccess('Línea desactivada');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }, [api, selectedEsquema]);

  const addGasto = useCallback(async () => {
    if (!selectedCliente) return;
    try {
      await api.post(`/clientes/${selectedCliente.id}/gastos`, {
        concepto_gasto: newGastoConcepto,
        monto: parseFloat(newGastoMonto),
        tipo: newGastoTipo,
        vigencia_desde: newGastoVigDesde,
        vigencia_hasta: newGastoVigHasta || null,
      });
      setNewGastoMonto('');
      setNewGastoVigHasta('');
      const res = await api.get(`/clientes/${selectedCliente.id}/gastos`);
      setGastos(res.data ?? []);
      showSuccess('Gasto guardado');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }, [api, selectedCliente, newGastoConcepto, newGastoMonto, newGastoTipo, newGastoVigDesde, newGastoVigHasta]);

  const desactivarGasto = useCallback(async (id: number) => {
    if (!window.confirm('¿Desactivar este gasto?')) return;
    try {
      await api.put(`/gastos/${id}/desactivar`, {});
      if (selectedCliente) {
        const res = await api.get(`/clientes/${selectedCliente.id}/gastos`);
        setGastos(res.data ?? []);
      }
      showSuccess('Gasto desactivado');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desactivando gasto');
    }
  }, [api, selectedCliente]);

  const loadHistorial = useCallback(async (page = 1) => {
    if (!selectedCliente) return;
    setHistorialLoading(true);
    try {
      const res = await api.get(`/clientes/${selectedCliente.id}/tarifa/historial?page=${page}`);
      const paged = res.data;
      setHistorial(paged.data ?? []);
      setHistorialPage({ current: paged.current_page ?? 1, last: paged.last_page ?? 1 });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando historial');
    } finally {
      setHistorialLoading(false);
    }
  }, [api, selectedCliente]);

  const precioDistribuidor = (): number | null => {
    const dist = parseMoneyInput(newLineaDistPrecio);
    if (dist != null && dist > 0) return dist;
    const p = parseMoneyInput(newLineaPrecio);
    const pct = parsePercentInput(newLineaPctAg);
    if (p == null || pct == null) return null;
    return p * (1 - pct / 100);
  };

  const pctAgenciaCalculado = (): string => {
    const p = parseMoneyInput(newLineaPrecio);
    const dist = parseMoneyInput(newLineaDistPrecio);
    if (p != null && p > 0 && dist != null && dist > 0) {
      return ((1 - dist / p) * 100).toFixed(2);
    }
    return newLineaPctAg;
  };

  return (
    <DashboardLayout title="Liquidaciones" subtitle="Configuración de Clientes">
      {error && (
        <div className="dashboard-card" style={{ marginBottom: 12 }}>
          <div className="card-body" style={{ color: '#dc2626', padding: '8px 16px' }}>
            {error}{' '}
            <button type="button" onClick={() => setError(null)} style={{ marginLeft: 8, cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      )}
      {successMsg && (
        <div className="dashboard-card" style={{ marginBottom: 12 }}>
          <div className="card-body" style={{ color: '#16a34a', padding: '8px 16px' }}>{successMsg}</div>
        </div>
      )}

      {/* Tab bar */}
      <div className="liq-tabbar" role="tablist" aria-label="Configuración de liquidaciones" style={{ marginBottom: 16 }}>
        {(['clientes', 'esquema', 'mapeos', 'gastos', 'tarifas_contrato', 'historial'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setActiveTab(t); if (t === 'historial') void loadHistorial(1); }}
            role="tab"
            aria-selected={activeTab === t}
            className={`tab-btn${activeTab === t ? ' is-active' : ''}`}
          >
            {{ clientes: 'Clientes', esquema: 'Esquema Tarifario', mapeos: 'Mapeos', gastos: 'Gastos', tarifas_contrato: 'Tarifas Contrato', historial: 'Historial Tarifa' }[t]}
          </button>
        ))}
      </div>

      {/* Tab: Clientes */}
      {activeTab === 'clientes' && (
        <div className="dashboard-card">
          <header className="card-header"><h3>Clientes habilitados</h3></header>
	          <div className="card-body">
              <div className="liq-client-actions">
                <button
                  type="button"
                  className="btn-sm btn-primary"
                  onClick={() => {
                    setError(null);
                    setShowEnableClientForm((p) => !p);
                    if (!showEnableClientForm) {
                      setBaseClienteQuery('');
                      setBaseClienteOptions([]);
                      setSelectedBaseClienteId('');
                    }
                  }}
                >
                  {showEnableClientForm ? 'Cancelar' : '+ Habilitar cliente'}
                </button>
              </div>

              {showEnableClientForm ? (
                <div className="liq-enable-client">
                  <div className="liq-enable-client__row">
                    <label>
                      <span>Buscar cliente existente</span>
                      <input
                        type="text"
                        value={baseClienteQuery}
                        onChange={(e) => setBaseClienteQuery(e.target.value)}
                        placeholder="Nombre / código / CUIT..."
                      />
                    </label>
                    <label>
                      <span>Cliente</span>
                      <select
                        value={selectedBaseClienteId}
                        onChange={(e) => setSelectedBaseClienteId(e.target.value)}
                        disabled={baseClienteLoading}
                      >
                        <option value="">Seleccionar…</option>
                        {baseClienteOptions.map((opt) => (
                          <option key={`base-cli-${opt.id}`} value={String(opt.id)}>
                            {`${opt.nombre ?? 'Cliente'}${opt.codigo ? ` (${opt.codigo})` : ''}${opt.documento_fiscal ? ` - ${opt.documento_fiscal}` : ''}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="liq-enable-client__btns">
                      <button
                        type="button"
                        className="btn-sm btn-primary"
                        onClick={() => void enableCliente()}
                        disabled={enablingClient || !selectedBaseClienteId}
                      >
                        {enablingClient ? 'Habilitando...' : 'Habilitar'}
                      </button>
                    </div>
                  </div>
                  <p className="liq-enable-client__hint">
                    Esto crea un registro en <code>liq_clientes</code> vinculado al cliente base y lo deja listo para cargar esquemas/mapeos.
                  </p>
                </div>
              ) : null}

            {loading ? <p>Cargando…</p> : (
	              <table className="data-table">
	                <thead>
	                  <tr>
	                    <th>ID</th><th>Nombre corto</th><th>Razón social</th><th>CUIT</th><th>Tolerancia</th><th>Esquemas</th><th></th>
	                  </tr>
	                </thead>
	                <tbody>
	                  {clientes.map((c) => (
	                    <React.Fragment key={c.id}>
	                      <tr style={{ background: selectedCliente?.id === c.id ? '#eff6ff' : undefined }}>
	                        <td>{c.id}</td>
	                        <td><strong>{c.nombre_corto}</strong></td>
	                        <td style={{ fontSize: 12 }}>{c.razon_social}</td>
	                        <td>{c.cuit ?? '—'}</td>
	                        <td>{getTolerancia(c)}</td>
	                        <td>{c.esquemas_count ?? 0}</td>
	                        <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
	                          <button type="button" className="btn-sm" onClick={() => editingClienteId === c.id ? setEditingClienteId(null) : startEditCliente(c)}>
	                            {editingClienteId === c.id ? 'Cancelar' : 'Editar'}
	                          </button>
	                          <button type="button" className="btn-sm btn-primary" onClick={() => { void selectCliente(c); setActiveTab('esquema'); }}>
	                            Configurar
	                          </button>
	                        </td>
	                      </tr>
	                      {editingClienteId === c.id && (
	                        <tr>
	                          <td colSpan={7} style={{ padding: 0 }}>
	                            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, margin: '0 8px 8px', padding: 16 }}>
	                              <h4 style={{ margin: '0 0 12px 0', fontSize: 13 }}>Editar configuración — {c.nombre_corto}</h4>
		                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
		                                <div>
		                                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Nombre corto</label>
	                                  <input type="text" className="form-input" value={editNombreCorto} onChange={(e) => setEditNombreCorto(e.target.value)} />
	                                </div>
	                                <div>
	                                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>CUIT</label>
	                                  <input type="text" className="form-input" value={editCuit} onChange={(e) => setEditCuit(e.target.value)} placeholder="20-12345678-9" />
	                                </div>
	                                <div>
	                                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Tolerancia diferencia (%)</label>
	                                  <input type="text" className="form-input" value={editTolerancia} onChange={(e) => setEditTolerancia(e.target.value)} placeholder="2" />
	                                </div>
		                                <div>
		                                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Hoja Excel (nombre)</label>
		                                  <input type="text" className="form-input" value={editHoja} onChange={(e) => setEditHoja(e.target.value)} placeholder="Detalle" />
		                                </div>
		                                <div>
		                                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Fila de datos</label>
		                                  <input type="number" min="1" className="form-input" value={editFilaDatos} onChange={(e) => setEditFilaDatos(e.target.value)} placeholder="1" />
		                                </div>
		                              </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 12 }}>
                                    <div>
                                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Conceptos valor variable</label>
                                      <input
                                        type="text"
                                        className="form-input"
                                        value={editConceptosValorVariable}
                                        onChange={(e) => setEditConceptosValorVariable(e.target.value)}
                                        placeholder="Ej: Valor Viaje, Colecta"
                                      />
                                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                                        Separar por coma.
                                      </div>
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Mapeo de columnas (JSON)</label>
                                      <textarea
                                        className="form-input"
                                        value={editMapeoColumnas}
                                        onChange={(e) => setEditMapeoColumnas(e.target.value)}
                                        placeholder={'{\n  "patente": 0,\n  "concepto": 3,\n  "valor": 7\n}'}
                                        rows={5}
                                        style={{ width: '100%', resize: 'vertical' }}
                                      />
                                    </div>
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 12 }}>
                                    <div>
                                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Regex PDF operaciones</label>
                                      <textarea
                                        className="form-input"
                                        value={editPdfRegex}
                                        onChange={(e) => setEditPdfRegex(e.target.value)}
                                        placeholder={'/(?<patente>[A-Z]{2}\\d{3}[A-Z]{2}|[A-Z]{3}\\d{3}).*?(?<concepto>.*?)\\s+(?<valor>\\d[\\d\\.,]*)/iu'}
                                        rows={5}
                                        style={{ width: '100%', resize: 'vertical' }}
                                      />
                                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                                        Debe capturar al menos `patente` y `valor`. Opcionales: `concepto`, `cuil`, `legajo`, `nombre`, `id_viaje`.
                                      </div>
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>PDF: líneas a ignorar</label>
                                      <input
                                        type="text"
                                        className="form-input"
                                        value={editPdfSkipPatterns}
                                        onChange={(e) => setEditPdfSkipPatterns(e.target.value)}
                                        placeholder="Ej: TOTAL, SUBTOTAL, RESUMEN"
                                      />
                                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                                        Separar por coma. Se aplican además los defaults `TOTAL`, `SUBTOTAL`, `PAGINA`.
                                      </div>
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>PDF: span máximo de líneas</label>
                                      <input
                                        type="number"
                                        min="1"
                                        max="3"
                                        className="form-input"
                                        value={editPdfMaxLineSpan}
                                        onChange={(e) => setEditPdfMaxLineSpan(e.target.value)}
                                        placeholder="1"
                                      />
                                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                                        Usa 2 o 3 si una operación se parte en varias líneas del PDF.
                                      </div>
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>PDF: concepto default</label>
                                      <input
                                        type="text"
                                        className="form-input"
                                        value={editPdfConceptoDefault}
                                        onChange={(e) => setEditPdfConceptoDefault(e.target.value)}
                                        placeholder="Ej: Distribución"
                                      />
                                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                                        Se usa solo si el regex no captura `concepto`.
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{ marginBottom: 12 }}>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Tipos de archivo extra permitidos</label>
                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                      {SUPPORTED_EXTRA_UPLOAD_TYPES.map((tipo) => (
                                        <label key={tipo} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                                          <input
                                            type="checkbox"
                                            checked={editAllowedTiposArchivo.includes(tipo)}
                                            onChange={() => toggleAllowedTipoArchivo(tipo)}
                                          />
                                          <span>{tipo}</span>
                                        </label>
                                      ))}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                                      Los tipos base `DATA_CLIENTE` y `DETALLE_SUCURSAL` siempre están habilitados.
                                    </div>
                                  </div>
                                  <div style={{ marginBottom: 12 }}>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Matching de distribuidor</label>
                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                      {SUPPORTED_DISTRIBUTOR_MATCHING.map((strategy) => (
                                        <label key={strategy} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                                          <input
                                            type="checkbox"
                                            checked={editMatchingDistribuidor.includes(strategy)}
                                            onChange={() => toggleMatchingDistribuidor(strategy)}
                                          />
                                          <span>{strategy}</span>
                                        </label>
                                      ))}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                                      Si no definís nada, el backend usa defaults por cliente y siempre intenta primero por patente.
                                    </div>
                                  </div>
		                              <button type="button" className="btn-primary" onClick={() => void saveCliente()} disabled={savingCliente}>
		                                {savingCliente ? 'Guardando…' : 'Guardar'}
		                              </button>
	                            </div>
	                          </td>
	                        </tr>
	                      )}
	                    </React.Fragment>
	                  ))}
	                  {clientes.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#6b7280' }}>Sin clientes habilitados</td></tr>}
	                </tbody>
	              </table>
	            )}
	          </div>
	        </div>
	      )}

      {/* Tab: Esquema Tarifario */}
      {activeTab === 'esquema' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {!selectedCliente ? (
            <div className="dashboard-card"><div className="card-body" style={{ color: '#6b7280' }}>Seleccioná un cliente primero desde la pestaña Clientes.</div></div>
	          ) : (
	            <>
	              <div className="dashboard-card">
                <header className="card-header">
                  <h3>Esquemas de {selectedCliente.nombre_corto}</h3>
                </header>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.2fr auto', gap: 10, alignItems: 'end', marginBottom: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Nombre</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Tarifa Loginter 2026"
                        value={newEsqNombre}
                        onChange={(e) => setNewEsqNombre(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Descripción (opcional)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Ej: Tarifa Loginter vigente desde Ene 2026"
                        value={newEsqDescripcion}
                        onChange={(e) => setNewEsqDescripcion(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Dimensiones (separadas por coma)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="sucursal, concepto"
                        value={newEsqDims}
                        onChange={(e) => setNewEsqDims(e.target.value)}
                      />
                    </div>
                    <button type="button" className="btn-primary" onClick={crearEsquema}>Crear esquema</button>
                  </div>

                  <table className="data-table">
                    <thead><tr><th>Nombre</th><th>Dimensiones</th><th>Líneas</th><th>Activo</th><th></th></tr></thead>
                    <tbody>
                      {esquemas.map((e) => (
                        <tr key={e.id} style={{ background: selectedEsquema?.id === e.id ? '#eff6ff' : undefined }}>
                          <td><strong>{e.nombre}</strong></td>
                          <td>{e.dimensiones.join(', ')}</td>
                          <td>{e.lineas_tarifa_count ?? 0}</td>
                          <td>{e.activo ? '✓' : '—'}</td>
                          <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button type="button" className="btn-sm btn-primary" onClick={() => selectEsquema(e)}>Ver/Editar</button>
                            {e.activo ? (
                              <button
                                type="button"
                                className="btn-sm"
                                onClick={() => desactivarEsquema(e)}
                                style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}
                              >
                                Desactivar
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="btn-sm"
                                  onClick={() => activarEsquema(e)}
                                  style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}
                                >
                                  Activar
                                </button>
                                <button
                                  type="button"
                                  className="btn-sm btn-danger"
                                  onClick={() => eliminarEsquema(e)}
                                >
                                  Eliminar
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                      {esquemas.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#6b7280' }}>Sin esquemas</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedEsquema && (
                <>
                  {/* Importador unificado (v5): BASE + OVERRIDES + Motivos + Materiales con preview */}
                  <TarifasImportPanel
                    esquemaId={selectedEsquema.id}
                    clienteCodigo={selectedCliente?.codigo_corto || selectedCliente?.nombre_corto || 'OCASA'}
                    api={api}
                    apiBaseUrl={resolveApiBaseUrl()}
                    actorHeaders={buildActorHeaders(authUserRef.current)}
                    onSuccess={() => { void selectEsquema(selectedEsquema); void refreshEsquemas(); }}
                  />

                  {/* Import from Excel (legacy - base tariffs only) */}
                  <div className="dashboard-card">
                    <header className="card-header"><h3>Importar tarifa desde Excel (legacy)</h3></header>
                    <div className="card-body">
                      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.9fr 0.9fr 1.2fr auto', gap: 10, alignItems: 'end' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Archivo (.xlsx)</label>
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => setImportTarifaFile(e.target.files?.[0] ?? null)}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Vigencia desde</label>
                          <input type="date" className="form-input" value={importVigDesde} onChange={(e) => setImportVigDesde(e.target.value)} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Vigencia hasta</label>
                          <input type="date" className="form-input" value={importVigHasta} onChange={(e) => setImportVigHasta(e.target.value)} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Motivo</label>
                          <input type="text" className="form-input" value={importMotivo} onChange={(e) => setImportMotivo(e.target.value)} />
                        </div>
                        <button type="button" className="btn-primary" onClick={() => void importarTarifaExcel()} disabled={importingTarifa}>
                          {importingTarifa ? 'Importando...' : 'Importar'}
                        </button>
                        {((selectedCliente?.configuracion_excel as any)?.formato_entrada === 'PDF_DUAL' || selectedCliente?.codigo_corto === 'OCA' || selectedCliente?.nombre_corto === 'OCA') && (
                          <button type="button" className="btn-primary" style={{ background: '#7c3aed' }} onClick={() => void importarTarifaOca()} disabled={importingTarifa}>
                            {importingTarifa ? 'Importando...' : 'Importar OCA'}
                          </button>
                        )}
                      </div>
                      <p style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                        Carga dimensiones + líneas como <strong>borrador</strong> (pendiente de aprobación). Las filas sin precio o incompletas se omiten.
                        {((selectedCliente?.configuracion_excel as any)?.formato_entrada === 'PDF_DUAL' || selectedCliente?.codigo_corto === 'OCA' || selectedCliente?.nombre_corto === 'OCA') && (
                          <span style={{ display: 'block', marginTop: 4, color: '#7c3aed' }}>
                            <strong>OCA:</strong> Usá "Importar OCA" para Excels con formato multi-sección (Chasis, Ultima Milla, Interior). Lee todas las hojas y secciones automáticamente.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Aumento porcentual */}
                  <div className="dashboard-card">
                    <header className="card-header"><h3>Aumento porcentual</h3></header>
                    <div className="card-body">
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 10, alignItems: 'end' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Sucursal (opcional)</label>
                          <select className="form-input" value={aumentoSucursal} onChange={(e) => setAumentoSucursal(e.target.value)}>
                            <option value="">Todas</option>
                            {(dimensiones['sucursal'] ?? []).filter(d => d.activo).map(d => (
                              <option key={d.id} value={d.valor}>{d.valor}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Porcentaje (%)</label>
                          <input type="text" inputMode="decimal" className="form-input" value={aumentoPct} onChange={(e) => setAumentoPct(e.target.value)} placeholder="Ej: 15 o -5" />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Motivo</label>
                          <input type="text" className="form-input" value={aumentoMotivo} onChange={(e) => setAumentoMotivo(e.target.value)} placeholder="Ej: Aumento semestral julio 2026" />
                        </div>
                        <button type="button" className="btn-primary" onClick={previsualizarAumento} disabled={!aumentoPct || aumentoLoading}>
                          {aumentoLoading ? 'Cargando...' : 'Previsualizar'}
                        </button>
                      </div>

                      {/* Previsualización */}
                      {aumentoPreview && (
                        <div style={{ marginTop: 16 }}>
                          <div style={{ marginBottom: 8, fontSize: 13 }}>
                            <strong>{aumentoPreview.resumen.total_lineas}</strong> líneas afectadas.
                            {aumentoPreview.resumen.con_overrides > 0 && (
                              <span style={{ color: '#d97706', marginLeft: 8 }}>
                                {aumentoPreview.resumen.con_overrides} con overrides (revisar)
                              </span>
                            )}
                          </div>
                          <div style={{ overflowX: 'auto', maxHeight: 400, overflow: 'auto' }}>
                            <table className="data-table" style={{ fontSize: 12 }}>
                              <thead>
                                <tr>
                                  <th>Sucursal</th><th>Concepto</th>
                                  <th style={{ textAlign: 'right' }}>Actual</th>
                                  <th style={{ textAlign: 'right' }}>Nuevo</th>
                                  <th style={{ textAlign: 'right' }}>Var.</th>
                                  <th style={{ textAlign: 'right' }}>Distrib.</th>
                                  <th style={{ textAlign: 'center' }}>Overr.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {aumentoPreview.lineas.map((l: any, i: number) => (
                                  <tr key={i} style={{ background: l.overrides_count > 0 ? '#fef9c3' : undefined }}>
                                    <td>{l.sucursal}</td>
                                    <td>{l.concepto}</td>
                                    <td style={{ textAlign: 'right' }}>{fmt(l.precio_actual)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(l.precio_nuevo)}</td>
                                    <td style={{ textAlign: 'right', color: l.variacion_pct > 0 ? '#16a34a' : '#dc2626' }}>{l.variacion_pct > 0 ? '+' : ''}{l.variacion_pct}%</td>
                                    <td style={{ textAlign: 'right' }}>{fmt(l.precio_distribuidor_nuevo)}</td>
                                    <td style={{ textAlign: 'center' }}>
                                      {l.overrides_count > 0 ? (
                                        <span style={{ color: '#d97706', fontWeight: 600 }}>{l.overrides_count}</span>
                                      ) : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                            <button type="button" className="btn-primary" onClick={aplicarAumento} disabled={aumentoLoading || !aumentoMotivo.trim()}>
                              {aumentoLoading ? 'Aplicando...' : 'Aplicar cambios'}
                            </button>
                            <button type="button" className="btn-sm" onClick={() => setAumentoPreview(null)}>Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dimension values */}
                  <div className="dashboard-card">
                    <header className="card-header"><h3>Valores de dimensiones — {selectedEsquema.nombre}</h3></header>
                    <div className="card-body">
                      {selectedEsquema.dimensiones.map((dim) => (
                        <div key={dim} style={{ marginBottom: 16 }}>
                          <h4 style={{ marginBottom: 8, textTransform: 'capitalize' }}>{dim}</h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                            {(dimensiones[dim] ?? []).filter((d) => d.activo).map((d) => (
                              <span key={d.id} style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 10px', borderRadius: 12, fontSize: 13 }}>
                                {d.valor}
                              </span>
                            ))}
                          </div>
                          {/* Add value inline */}
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              type="text"
                              placeholder="Nuevo valor…"
                              value={newDimNombre === dim ? newDimValor : ''}
                              onChange={(e) => { setNewDimNombre(dim); setNewDimValor(e.target.value); }}
                              className="form-input"
                              style={{ width: 200 }}
                              onKeyDown={(e) => { if (e.key === 'Enter') addDimension(); }}
                            />
                            <button type="button" className="btn-sm btn-primary"
                              onClick={() => { setNewDimNombre(dim); addDimension(); }}>
                              + Agregar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tariff lines */}
                  <div className="dashboard-card">
                    <header className="card-header">
                      <h3>Líneas de tarifa</h3>
                      <div className="card-header__buttons">
                        {lineas.filter((l) => l.activo && !l.aprobado_por).length > 0 && (
                          <button type="button" className="btn-sm btn-primary" onClick={aprobarTodasLineas}>
                            Aprobar todas ({lineas.filter((l) => l.activo && !l.aprobado_por).length})
                          </button>
                        )}
                      </div>
                    </header>
                    <div className="card-body">
                      {/* Add line form */}
                      <div style={{ background: '#f9fafb', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                        <h4 style={{ marginBottom: 12 }}>Nueva línea</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
                          {selectedEsquema.dimensiones.map((dim) => (
                            <div key={dim}>
                              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, textTransform: 'capitalize' }}>{dim}</label>
                              <select
                                className="form-input"
                                value={newLineaDims[dim] ?? ''}
                                onChange={(e) => setNewLineaDims((prev) => ({ ...prev, [dim]: e.target.value }))}
                              >
                                <option value="">— Seleccionar —</option>
                                {(dimensiones[dim] ?? []).filter((d) => d.activo).map((d) => (
                                  <option key={d.id} value={d.valor}>{d.valor}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                          <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Precio original</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="form-input"
                              value={newLineaPrecio}
                              onChange={(e) => setNewLineaPrecio(e.target.value)}
                              placeholder="Ej: 211082 o 211.082,00"
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>% Agencia</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="form-input"
                              value={newLineaDistPrecio ? pctAgenciaCalculado() : newLineaPctAg}
                              onChange={(e) => { setNewLineaPctAg(e.target.value); setNewLineaDistPrecio(''); }}
                              placeholder="Se calcula si ponés distrib."
                              readOnly={!!newLineaDistPrecio}
                              style={newLineaDistPrecio ? { background: '#f3f4f6', color: '#374151' } : {}}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Precio distribuidor</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="form-input"
                              value={newLineaDistPrecio || (precioDistribuidor() != null && !newLineaDistPrecio ? fmt(precioDistribuidor()!) : '')}
                              onChange={(e) => { setNewLineaDistPrecio(e.target.value); setNewLineaPctAg(''); }}
                              placeholder="Ej: 1800 (manual)"
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Vigencia desde</label>
                            <input type="date" className="form-input" value={newLineaVigDesde} onChange={(e) => setNewLineaVigDesde(e.target.value)} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Vigencia hasta</label>
                            <input type="date" className="form-input" value={newLineaVigHasta} onChange={(e) => setNewLineaVigHasta(e.target.value)} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Motivo</label>
                            <input type="text" className="form-input" value={newLineaMotivo} onChange={(e) => setNewLineaMotivo(e.target.value)} />
                          </div>
                        </div>
                        {isOcasaClient && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 12, padding: '12px 0', borderTop: '1px dashed #d1d5db' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Modelo tarifa</label>
                              <select className="form-input" value={newLineaModeloTarifa} onChange={(e) => setNewLineaModeloTarifa(e.target.value)}>
                                <option value="JORNADA">Jornada</option>
                                <option value="JORNADA_KM">Jornada + KM</option>
                                <option value="PRODUCTIVIDAD">Productividad</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Costo fijo base OCASA</label>
                              <input type="text" inputMode="decimal" className="form-input" value={newLineaCostoFijoBase} onChange={(e) => setNewLineaCostoFijoBase(e.target.value)} placeholder="Jornada completa" />
                            </div>
                            {newLineaModeloTarifa === 'JORNADA_KM' && (
                              <>
                                <div>
                                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>$/KM original</label>
                                  <input type="text" inputMode="decimal" className="form-input" value={newLineaTarifaKmOriginal} onChange={(e) => setNewLineaTarifaKmOriginal(e.target.value)} placeholder="Ej: 275" />
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>$/KM distribuidor</label>
                                  <input type="text" inputMode="decimal" className="form-input" value={newLineaTarifaKmDistrib} onChange={(e) => setNewLineaTarifaKmDistrib(e.target.value)} placeholder="Ej: 223" />
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Umbral KM</label>
                                  <input type="text" inputMode="decimal" className="form-input" value={newLineaUmbralKm} onChange={(e) => setNewLineaUmbralKm(e.target.value)} placeholder="240" />
                                </div>
                              </>
                            )}
                            {newLineaModeloTarifa === 'PRODUCTIVIDAD' && (
                              <>
                                <div>
                                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Modo productividad</label>
                                  <select className="form-input" value={newLineaModoProd} onChange={(e) => setNewLineaModoProd(e.target.value as any)}>
                                    <option value="por_parada">Por parada</option>
                                    <option value="por_bulto">Por bulto</option>
                                    <option value="porcentaje">Porcentaje</option>
                                  </select>
                                </div>
                                {newLineaModoProd === 'por_parada' && (
                                  <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>$ por parada</label>
                                    <input type="text" inputMode="decimal" className="form-input" value={newLineaTarifaParada} onChange={(e) => setNewLineaTarifaParada(e.target.value)} placeholder="Ej: 850" />
                                  </div>
                                )}
                                {newLineaModoProd === 'por_bulto' && (
                                  <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>$ por bulto</label>
                                    <input type="text" inputMode="decimal" className="form-input" value={newLineaTarifaBulto} onChange={(e) => setNewLineaTarifaBulto(e.target.value)} placeholder="Ej: 150" />
                                  </div>
                                )}
                              </>
                            )}
                            <div>
                              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Capacidad veh. (kg)</label>
                              <select className="form-input" value={newLineaCapacidadKg} onChange={(e) => setNewLineaCapacidadKg(e.target.value)}>
                                <option value="">Sin especificar</option>
                                <option value="100">100 (Moto)</option>
                                <option value="700">700 (Furgon chico)</option>
                                <option value="2500">2500 (Utilitario)</option>
                                <option value="5000">5000 (Camion liviano)</option>
                                <option value="10000">10000 (Camion)</option>
                              </select>
                            </div>
                          </div>
                        )}
                        <button type="button" className="btn-primary" onClick={addLinea}>Guardar línea</button>
                      </div>

                      {/* Lines table */}
                      <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              {selectedEsquema.dimensiones.map((d) => <th key={d} style={{ textTransform: 'capitalize' }}>{d}</th>)}
                              <th>Original</th><th>% Ag.</th><th>Distribuidor</th>
                              <th>Vigencia</th><th>Estado</th><th style={{ textAlign: 'center' }}>Overr.</th><th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {lineas.map((l) => (
                              <tr key={l.id} style={{ opacity: l.activo ? 1 : 0.5 }}>
                                {selectedEsquema.dimensiones.map((d) => {
                                  let val: string | number | null | undefined = l.dimensiones_valores[d];
                                  if ((val == null || val === '') && d.toLowerCase().startsWith('capac') && l.capacidad_vehiculo_kg != null) {
                                    val = l.capacidad_vehiculo_kg;
                                  }
                                  return <td key={d}>{val != null && val !== '' ? val : '—'}</td>;
                                })}
                                <td>{fmt(parseFloat(l.precio_original))}</td>
                                <td>{l.porcentaje_agencia}%</td>
                                <td>{fmt(parseFloat(l.precio_distribuidor))}</td>
                                <td style={{ fontSize: 12 }}>
                                  {fmtDate(l.vigencia_desde)}{l.vigencia_hasta ? ` → ${fmtDate(l.vigencia_hasta)}` : ' →'}
                                </td>
                                <td>
                                  {l.activo ? (
                                    l.aprobado_por ? (
                                      <span style={{ color: '#16a34a', fontSize: 12 }}>✓ Aprobada</span>
                                    ) : (
                                      <span style={{ color: '#d97706', fontSize: 12 }}>Pendiente aprobación</span>
                                    )
                                  ) : (
                                    <span style={{ color: '#6b7280', fontSize: 12 }}>Inactiva</span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {(l as any).overrides_count > 0 ? (
                                    <span style={{ color: '#2563eb', fontWeight: 600, cursor: 'pointer' }} title="Distribuidores con tarifa especial">
                                      {(l as any).overrides_count}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#9ca3af' }}>0</span>
                                  )}
                                </td>
                                <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  {l.activo && (
                                    <button type="button" className="btn-sm" onClick={() => setEditingLineaId(l.id)}>Editar</button>
                                  )}
                                  {l.activo && !l.aprobado_por && (
                                    <button type="button" className="btn-sm btn-primary" onClick={() => aprobarLinea(l.id)}>Aprobar</button>
                                  )}
                                  {l.activo && (
                                    <button type="button" className="btn-sm btn-danger" onClick={() => desactivarLinea(l.id)}>Desactivar</button>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {lineas.length === 0 && <tr><td colSpan={selectedEsquema.dimensiones.length + 6} style={{ textAlign: 'center', color: '#6b7280' }}>Sin líneas</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {editingLineaId != null && (() => {
                    const l = lineas.find((x) => x.id === editingLineaId);
                    if (!l) return null;
                    return (
                      <LineaTarifaEditModal
                        api={api}
                        linea={l}
                        dimensiones={selectedEsquema.dimensiones}
                        isOcasa={isOcasaClient}
                        formatDate={fmtDate}
                        onClose={() => setEditingLineaId(null)}
                        onSaved={async () => {
                          setEditingLineaId(null);
                          if (selectedEsquema) {
                            const res = await api.get(`/esquemas/${selectedEsquema.id}/lineas`);
                            setLineas(res.data ?? []);
                          }
                          showSuccess('Línea actualizada');
                        }}
                      />
                    );
                  })()}

                  {/* Tarifa por patente (override) */}
                  <div className="dashboard-card">
                    <header className="card-header">
                      <h3>Tarifa por patente</h3>
                    </header>
                    <div className="card-body">
                      <div style={{ background: '#f9fafb', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                        <h4 style={{ marginTop: 0, marginBottom: 12 }}>Nueva vinculación</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 12, marginBottom: 12, alignItems: 'end' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Patente</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Ej: AE998QN"
                              value={newTPPatente}
                              onChange={(e) => setNewTPPatente(e.target.value)}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Línea destino (aprobada)</label>
                            <select
                              className="form-input"
                              value={newTPLineaId}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNewTPLineaId(val);
                                const id = Number(val);
                                const l = lineas.find((x) => x.id === id);
                                if (l && selectedEsquema) {
                                  setNewTPDims((prev) => {
                                    const next = { ...prev };
                                    for (const d of selectedEsquema.dimensiones) {
                                      if (!next[d] || next[d].trim() === '') {
                                        next[d] = l.dimensiones_valores[d] ?? '';
                                      }
                                    }
                                    return next;
                                  });
                                }
                              }}
                            >
                              <option value="">— Seleccionar —</option>
                              {lineas
                                .filter((l) => l.activo && !!l.aprobado_por)
                                .map((l) => {
                                  const dimsLabel = (selectedEsquema?.dimensiones ?? []).map((d) => l.dimensiones_valores[d]).filter(Boolean).join(' | ');
                                  return (
                                    <option key={l.id} value={String(l.id)}>
                                      #{l.id} — {dimsLabel} — {fmt(Number(l.precio_original))} — {l.porcentaje_agencia}%
                                    </option>
                                  );
                                })}
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Vigencia desde</label>
                            <input type="date" className="form-input" value={newTPVigDesde} onChange={(e) => setNewTPVigDesde(e.target.value)} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Vigencia hasta</label>
                            <input type="date" className="form-input" value={newTPVigHasta} onChange={(e) => setNewTPVigHasta(e.target.value)} />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
                          {(selectedEsquema?.dimensiones ?? []).map((d) => {
                            const safeId = `tp-dim-${d.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
                            const opts = (dimensiones[d] ?? []).filter((x) => x.activo).map((x) => x.valor);
                            return (
                              <div key={d}>
                                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                                  Dimensión (match): {d}
                                </label>
                                <input
                                  type="text"
                                  className="form-input"
                                  list={safeId}
                                  placeholder={d}
                                  value={newTPDims[d] ?? ''}
                                  onChange={(e) => setNewTPDims((prev) => ({ ...prev, [d]: e.target.value }))}
                                />
                                <datalist id={safeId}>
                                  {opts.map((v) => (
                                    <option key={v} value={v} />
                                  ))}
                                </datalist>
                              </div>
                            );
                          })}
                        </div>

                        <button type="button" className="btn-primary" onClick={guardarTarifaPatente}>
                          Guardar vinculación
                        </button>
                        <p style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                          Se usa primero la coincidencia por <strong>patente + dimensiones</strong> y luego la tarifa general. Útil para casos donde el concepto depende de la patente.
                        </p>
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Patente</th>
                              {(selectedEsquema?.dimensiones ?? []).map((d) => (
                                <th key={d} style={{ textTransform: 'capitalize' }}>{d}</th>
                              ))}
                              <th style={{ textAlign: 'right' }}>Precio Cli.</th>
                              <th style={{ textAlign: 'right' }}>Tarifa Dist.</th>
                              <th>Modo</th>
                              <th>Rev.</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {tarifasPatente.map((tp) => {
                              const tpAny = tp as any;
                              const precioOrig = tpAny.precio_original;
                              const modo = tpAny.modo_calculo;
                              const valorRef = tpAny.valor_referencia ? Number(tpAny.valor_referencia) : null;
                              const tarifaDist = modo === 'fijo' && valorRef ? valorRef : (precioOrig && valorRef ? precioOrig * (1 - valorRef / 100) : null);
                              const reqRev = tpAny.requiere_revision;
                              return (
                                <tr key={tp.id} style={{ opacity: tp.activo ? 1 : 0.5 }}>
                                  <td><strong>{tp.patente_norm}</strong></td>
                                  {(selectedEsquema?.dimensiones ?? []).map((d) => (
                                    <td key={d}>{tp.dimensiones_valores?.[d] ?? '—'}</td>
                                  ))}
                                  <td style={{ textAlign: 'right', color: precioOrig ? '#dc2626' : '#9ca3af', fontWeight: precioOrig ? 600 : 400 }}>
                                    {precioOrig ? fmt(Number(precioOrig)) : '—'}
                                  </td>
                                  <td style={{ textAlign: 'right' }}>{tarifaDist ? fmt(tarifaDist) : '—'}</td>
                                  <td style={{ fontSize: 11 }}>{modo ?? '—'}</td>
                                  <td>{reqRev ? <span style={{ color: '#d97706' }} title="Pendiente de revisión">⚠</span> : '—'}</td>
                                  <td style={{ textAlign: 'right' }}>
                                    {tp.activo && (
                                      <button type="button" className="btn-sm btn-danger" onClick={() => desactivarTarifaPatente(tp.id)}>
                                        Desactivar
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                            {tarifasPatente.length === 0 && (
                              <tr>
                                <td colSpan={(selectedEsquema?.dimensiones ?? []).length + 5} style={{ textAlign: 'center', color: '#6b7280' }}>
                                  Sin vinculaciones por patente
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: Mapeos */}
      {activeTab === 'mapeos' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {!selectedCliente ? (
            <div className="dashboard-card"><div className="card-body" style={{ color: '#6b7280' }}>Seleccioná un cliente primero.</div></div>
          ) : (
            <>
              <div className="dashboard-card">
                <header className="card-header"><h3>Mapeos de concepto — {selectedCliente.nombre_corto}</h3></header>
                <div className="card-body">
                  <div style={{ background: '#f9fafb', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                    <h4 style={{ marginTop: 0, marginBottom: 12 }}>Nuevo mapeo de concepto</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Valor en Excel</label>
                        <input type="text" className="form-input" value={newMapExcel} onChange={(e) => setNewMapExcel(e.target.value)} placeholder="Ej: Rango 0-100kms" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Dimensión destino</label>
                        <select className="form-input" value={newMapDim} onChange={(e) => setNewMapDim(e.target.value)}>
                          {(selectedEsquema?.dimensiones ?? ['concepto', 'sucursal']).map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Valor tarifa</label>
                        <input type="text" className="form-input" value={newMapTarifa} onChange={(e) => setNewMapTarifa(e.target.value)} placeholder="Ej: Ut. Mediano" />
                      </div>
                    </div>
                    <button type="button" className="btn-primary" onClick={addMapeoConcepto}>Guardar mapeo</button>
                  </div>
                  <table className="data-table">
                    <thead><tr><th>Valor en Excel</th><th>Dimensión destino</th><th>Valor tarifa</th><th>Activo</th><th></th></tr></thead>
                    <tbody>
                      {mapeosConcepto.map((m) => (
                        <tr key={m.id} style={{ opacity: m.activo ? 1 : 0.5 }}>
                          <td>{m.valor_excel}</td>
                          <td>{m.dimension_destino}</td>
                          <td>{m.valor_tarifa}</td>
                          <td>{m.activo ? '✓' : '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            {m.activo && (
                              <button type="button" className="btn-sm btn-danger" onClick={() => desactivarMapeoConcepto(m.id)}>
                                Desactivar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {mapeosConcepto.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#6b7280' }}>Sin mapeos de concepto</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="dashboard-card">
                <header className="card-header"><h3>Mapeos de sucursal</h3></header>
                <div className="card-body">
                  <div style={{ background: '#f9fafb', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                    <h4 style={{ marginTop: 0, marginBottom: 12 }}>Nuevo mapeo de sucursal</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Patrón de archivo</label>
                        <input type="text" className="form-input" value={newMapPatronArchivo} onChange={(e) => setNewMapPatronArchivo(e.target.value)} placeholder="Ej: BAHIA BLANCA" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Sucursal tarifa</label>
                        <input type="text" className="form-input" value={newMapSucursalTarifa} onChange={(e) => setNewMapSucursalTarifa(e.target.value)} placeholder="Ej: BAHIA BLANCA" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Tipo operación (opcional)</label>
                        <input type="text" className="form-input" value={newMapTipoOperacion} onChange={(e) => setNewMapTipoOperacion(e.target.value)} placeholder="Ej: ultima_milla" />
                      </div>
                    </div>
                    <button type="button" className="btn-primary" onClick={addMapeoSucursal}>Guardar mapeo</button>
                  </div>
                  <table className="data-table">
                    <thead><tr><th>Patrón archivo</th><th>Sucursal tarifa</th><th>Tipo operación</th><th>Activo</th><th></th></tr></thead>
                    <tbody>
                      {mapeosSucursal.map((m) => (
                        <tr key={m.id} style={{ opacity: m.activo ? 1 : 0.5 }}>
                          <td>{m.patron_archivo}</td>
                          <td>{m.sucursal_tarifa}</td>
                          <td>{m.tipo_operacion ?? '—'}</td>
                          <td>{m.activo ? '✓' : '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            {m.activo && (
                              <button type="button" className="btn-sm btn-danger" onClick={() => desactivarMapeoSucursal(m.id)}>
                                Desactivar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {mapeosSucursal.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#6b7280' }}>Sin mapeos de sucursal</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: Gastos */}
      {activeTab === 'gastos' && (
        <div className="dashboard-card">
          {!selectedCliente ? (
            <div className="card-body" style={{ color: '#6b7280' }}>Seleccioná un cliente primero.</div>
          ) : (
            <>
              <header className="card-header"><h3>Gastos administrativos — {selectedCliente.nombre_corto}</h3></header>
              <div className="card-body">
                {/* Add gasto form */}
                <div style={{ background: '#f9fafb', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Concepto</label>
                      <input type="text" className="form-input" value={newGastoConcepto} onChange={(e) => setNewGastoConcepto(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Monto</label>
                      <input type="number" className="form-input" value={newGastoMonto} onChange={(e) => setNewGastoMonto(e.target.value)} min="0" step="0.01" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Tipo</label>
                      <select className="form-input" value={newGastoTipo} onChange={(e) => setNewGastoTipo(e.target.value as 'fijo' | 'porcentual')}>
                        <option value="fijo">Fijo</option>
                        <option value="porcentual">Porcentual</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Vigencia desde</label>
                      <input type="date" className="form-input" value={newGastoVigDesde} onChange={(e) => setNewGastoVigDesde(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Vigencia hasta (opcional)</label>
                      <input type="date" className="form-input" value={newGastoVigHasta} onChange={(e) => setNewGastoVigHasta(e.target.value)} />
                    </div>
                  </div>
                  <button type="button" className="btn-primary" onClick={addGasto}>Guardar gasto</button>
                </div>

                <table className="data-table">
                  <thead><tr><th>Concepto</th><th>Monto</th><th>Tipo</th><th>Vigencia desde</th><th>Vigencia hasta</th><th>Activo</th><th></th></tr></thead>
                  <tbody>
                    {gastos.map((g) => (
                      <tr key={g.id} style={{ opacity: g.activo ? 1 : 0.5 }}>
                        <td>{g.concepto_gasto}</td>
                        <td>{fmt(parseFloat(g.monto))}</td>
                        <td>{g.tipo}</td>
                        <td>{fmtDate(g.vigencia_desde)}</td>
                        <td>{g.vigencia_hasta ? fmtDate(g.vigencia_hasta) : '—'}</td>
                        <td>{g.activo ? '✓' : '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          {g.activo && (
                            <button type="button" className="btn-sm btn-danger" onClick={() => desactivarGasto(g.id)}>
                              Desactivar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {gastos.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#6b7280' }}>Sin gastos configurados</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
      {/* Tab: Tarifas Contrato Cliente — SPEC v4.4 */}
      {activeTab === 'tarifas_contrato' && (
        <div className="dashboard-card">
          <div className="card-body">
            <TarifasContratoPanel api={api} />
          </div>
        </div>
      )}

      {/* Tab: Historial Tarifa */}
      {activeTab === 'historial' && (
        <div className="dashboard-card">
          {!selectedCliente ? (
            <div className="card-body" style={{ color: '#6b7280' }}>Seleccioná un cliente primero.</div>
          ) : (
            <>
              <header className="card-header">
                <h3>Historial de cambios de tarifa — {selectedCliente.nombre_corto}</h3>
                <button type="button" className="btn-sm btn-primary" onClick={() => void loadHistorial(historialPage.current)}>
                  Actualizar
                </button>
              </header>
              <div className="card-body" style={{ overflowX: 'auto' }}>
                {historialLoading ? (
                  <p>Cargando…</p>
                ) : (
                  <>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Acción</th>
                          <th>Usuario</th>
                          <th>Esquema</th>
                          <th>Línea</th>
                          <th>Motivo</th>
                          <th>Valores anteriores</th>
                          <th>Valores nuevos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historial.map((h) => {
                          const dims = h.linea_tarifa?.esquema?.dimensiones ?? [];
                          const dimsLabel = dims.length > 0
                            ? dims.map((d: string) => h.linea_tarifa?.dimensiones_valores?.[d]).filter(Boolean).join(' | ')
                            : `#${h.linea_tarifa?.id ?? '—'}`;
                          return (
                            <tr key={h.id}>
                              <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{h.created_at?.slice(0, 16).replace('T', ' ')}</td>
                              <td>
                                <span style={{
                                  padding: '1px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                  background: h.accion === 'aprobacion' ? '#dcfce7' : h.accion === 'desactivacion' ? '#fee2e2' : '#e0f2fe',
                                  color: h.accion === 'aprobacion' ? '#166534' : h.accion === 'desactivacion' ? '#991b1b' : '#0369a1',
                                }}>
                                  {h.accion}
                                </span>
                              </td>
                              <td style={{ fontSize: 12 }}>{h.usuario?.name ?? h.usuario?.email ?? '—'}</td>
                              <td style={{ fontSize: 12 }}>{h.linea_tarifa?.esquema?.nombre ?? '—'}</td>
                              <td style={{ fontSize: 12 }}>
                                {dimsLabel}
                                {h.linea_tarifa?.precio_original ? ` — ${fmt(parseFloat(h.linea_tarifa.precio_original))}` : ''}
                              </td>
                              <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {h.motivo ?? '—'}
                              </td>
                              <td style={{ fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }}>
                                {h.valores_anteriores ? JSON.stringify(h.valores_anteriores).slice(0, 80) : '—'}
                              </td>
                              <td style={{ fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }}>
                                {h.valores_nuevos ? JSON.stringify(h.valores_nuevos).slice(0, 80) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                        {historial.length === 0 && (
                          <tr><td colSpan={8} style={{ textAlign: 'center', color: '#6b7280' }}>Sin cambios registrados</td></tr>
                        )}
                      </tbody>
                    </table>
                    {historialPage.last > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                        <button type="button" className="btn-sm" disabled={historialPage.current === 1} onClick={() => void loadHistorial(historialPage.current - 1)}>←</button>
                        <span style={{ fontSize: 13, alignSelf: 'center' }}>Página {historialPage.current} de {historialPage.last}</span>
                        <button type="button" className="btn-sm" disabled={historialPage.current === historialPage.last} onClick={() => void loadHistorial(historialPage.current + 1)}>→</button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Log de importaciones xlsx */}
              <TarifasImportLogList api={api} clienteId={selectedCliente.id} />
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
