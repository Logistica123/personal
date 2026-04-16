import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLiqApi } from '../features/liquidaciones/api';
import type {
  LiqCliente,
  LiqLiquidacionCliente,
  LiqArchivoEntrada,
  LiqOperacion,
  LiqLiquidacionDistribuidor,
  LiqEsquemaTarifario,
  LiqMapeoSucursal,
  LiqVinculacionOca,
  OcaResumen,
  OcaTarifaDetectada,
  OcaPersonaBusqueda,
} from '../features/liquidaciones/types';
import {
  ESTADO_OPERACION_LABELS,
  ESTADO_OPERACION_COLOR,
  ESTADO_LIQ_LABELS,
  ESTADO_OCA_LABELS,
  ESTADO_OCA_COLOR,
  ESTADO_TARIFA_COLOR,
  ESTADO_TARIFA_LABEL,
} from '../features/liquidaciones/types';

type Props = {
  DashboardLayout: React.ComponentType<{ title: string; subtitle?: string; children: React.ReactNode }>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => unknown;
  buildActorHeaders: (user: unknown) => Record<string, string>;
};

type Step = 'lista' | 'detalle';
const SUPPORTED_UPLOAD_TYPES = ['DATA_CLIENTE', 'DETALLE_SUCURSAL', 'TARIFARIO', 'BASE_DISTRIB', 'VARIABLES'] as const;

export function LiquidacionesExtractosPage({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  buildActorHeaders,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const authUser = useStoredAuthUser();
  const api = useLiqApi({ resolveApiBaseUrl, buildActorHeaders, authUser });

  const [step, setStep] = useState<Step>('lista');
  const [liquidaciones, setLiquidaciones] = useState<LiqLiquidacionCliente[]>([]);
  const [selectedLiq, setSelectedLiq] = useState<LiqLiquidacionCliente | null>(null);
  const [archivos, setArchivos] = useState<LiqArchivoEntrada[]>([]);
  const [archivoSucursalEdit, setArchivoSucursalEdit] = useState<Record<number, string>>({});
  const [operaciones, setOperaciones] = useState<LiqOperacion[]>([]);
  const [distribuidores, setDistribuidores] = useState<LiqLiquidacionDistribuidor[]>([]);
  const [estadosCounts, setEstadosCounts] = useState<Record<string, number>>({});
  const [clientes, setClientes] = useState<LiqCliente[]>([]);
  const [esquemas, setEsquemas] = useState<LiqEsquemaTarifario[]>([]);
  const [mapeosSucursal, setMapeosSucursal] = useState<LiqMapeoSucursal[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [opFiltroEstado, setOpFiltroEstado] = useState('');
  const [opPage, setOpPage] = useState<{ current: number; last: number }>({ current: 1, last: 1 });
  const [selectedLiqIds, setSelectedLiqIds] = useState<Record<number, boolean>>({});
  const [selectedArchivoIds, setSelectedArchivoIds] = useState<Record<number, boolean>>({});
  const [selectedOpIds, setSelectedOpIds] = useState<Record<number, boolean>>({});
  const [pdfGenerating, setPdfGenerating] = useState<Record<number, boolean>>({});
  const [hotMapOp, setHotMapOp] = useState<LiqOperacion | null>(null);
  const [hotMapValorTarifa, setHotMapValorTarifa] = useState('');
  const [hotMapDim, setHotMapDim] = useState('concepto');
  const [hotMapValorCliente, setHotMapValorCliente] = useState('');

  type AuditoriaData = {
    resumen: {
      total_operaciones: number;
      estados: Record<string, { cantidad: number; total_cliente: number; total_correcto: number; total_diferencia: number }>;
      total_importe_cliente: number;
      total_diferencia: number;
      total_margen_agencia: number;
      total_importe_distribuidor: number;
    };
    diferencias: Array<{ id: number; dominio: string | null; concepto: string | null; sucursal_tarifa: string | null; valor_cliente: string; valor_tarifa_original: string | null; diferencia_cliente: string | null; distribuidor?: { apellidos: string; nombres: string; patente: string } | null }>;
    sin_tarifa_agrupado: Array<{ concepto: string | null; dimension_fallida: string | null; sucursal_tarifa: string | null; cantidad: number; total_cliente: number }>;
    sin_distribuidor_agrupado: Array<{ dominio: string | null; cantidad: number; total_cliente: number }>;
    duplicados: Array<{ id: number; dominio: string | null; concepto: string | null; valor_cliente: string; distribuidor?: { apellidos: string; nombres: string; patente: string } | null }>;
    por_distribuidor: Array<{ distribuidor_id: number; nombre: string; patente: string; cantidad: number; total_cliente: number; total_correcto: number; total_distribuidor: number; total_diferencia: number; margen_agencia: number }>;
    por_sucursal: Array<{ sucursal: string; total: number; ok: number; diferencia: number; sin_tarifa: number; sin_distribuidor: number; total_cliente: number; total_correcto: number; total_diferencia: number }>;
  };
  const [auditoria, setAuditoria] = useState<AuditoriaData | null>(null);
  const [auditoriaLoading, setAuditoriaLoading] = useState(false);
  const [showAuditoria, setShowAuditoria] = useState(false);
  const [auditoriaSecciones, setAuditoriaSecciones] = useState<Record<string, boolean>>({});

  // New liq form
  const [newLiqClienteId, setNewLiqClienteId] = useState('');
  const [newLiqDesde, setNewLiqDesde] = useState('');
  const [newLiqHasta, setNewLiqHasta] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  // Upload form
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSucursal, setUploadSucursal] = useState('');
  const [uploadTipo, setUploadTipo] = useState('');

  // OCASA upload state (3 zonas)
  const [ocasaTmsFile, setOcasaTmsFile] = useState<File | null>(null);
  const [ocasaYcc1File, setOcasaYcc1File] = useState<File | null>(null);
  const [ocasaPdfFiles, setOcasaPdfFiles] = useState<File[]>([]);
  const [ocasaResumen, setOcasaResumen] = useState<any>(null);

  // OCA state
  const [ocaMainPdf, setOcaMainPdf] = useState<File | null>(null);
  const [ocaDistribPdfs, setOcaDistribPdfs] = useState<File[]>([]);
  const [ocaSucursal, setOcaSucursal] = useState('');
  const [ocaVinculaciones, setOcaVinculaciones] = useState<LiqVinculacionOca[]>([]);
  const [ocaResumen, setOcaResumen] = useState<OcaResumen | null>(null);
  const [ocaHealth, setOcaHealth] = useState<boolean | null>(null);
  const [ocaVincPage, setOcaVincPage] = useState<{ current: number; last: number }>({ current: 1, last: 1 });
  const [ocaVincFiltro, setOcaVincFiltro] = useState('');
  const [ocaTarifas, setOcaTarifas] = useState<OcaTarifaDetectada[]>([]);
  const [ocaMapeo, setOcaMapeo] = useState<OcaTarifaDetectada | null>(null);
  const [ocaMapeoModo, setOcaMapeoModo] = useState<'porcentaje' | 'fijo'>('fijo');
  const [ocaMapeoValor, setOcaMapeoValor] = useState('');
  const [ocaMapeoSaving, setOcaMapeoSaving] = useState(false);
  const [ocaMapeoPersonaId, setOcaMapeoPersonaId] = useState<number | null>(null);
  const [ocaMapeoPersonaLabel, setOcaMapeoPersonaLabel] = useState('');
  const [ocaPersonasSearch, setOcaPersonasSearch] = useState('');
  const [ocaPersonasResults, setOcaPersonasResults] = useState<OcaPersonaBusqueda[]>([]);
  const [ocaPersonasLoading, setOcaPersonasLoading] = useState(false);

  // Duplicados
  const [duplicados, setDuplicados] = useState<any[]>([]);
  const [duplicadosLoading, setDuplicadosLoading] = useState(false);

  // Feature A+B: OCA PDF-imagen / carga manual
  const [ocaUploadFailed, setOcaUploadFailed] = useState(false);
  const [showManualOcaForm, setShowManualOcaForm] = useState(false);
  const [manualOcaRows, setManualOcaRows] = useState<Array<{ fecha: string; nro_planilla: string; cod_contrato: string; descripcion: string; precio_unitario: string; cantidad: string }>>([
    { fecha: '', nro_planilla: '', cod_contrato: '', descripcion: '', precio_unitario: '', cantidad: '' },
  ]);
  const [manualOcaSaving, setManualOcaSaving] = useState(false);

  // Feature D: Liquidacion manual distribuidor
  const [showLiqManualForm, setShowLiqManualForm] = useState(false);
  const [liqManualDistribId, setLiqManualDistribId] = useState<number | null>(null);
  const [liqManualDistribLabel, setLiqManualDistribLabel] = useState('');
  const [liqManualDistribSearch, setLiqManualDistribSearch] = useState('');
  const [liqManualDistribResults, setLiqManualDistribResults] = useState<Array<{ id: number; label: string }>>([]);
  const [liqManualRefExterna, setLiqManualRefExterna] = useState('');
  const [liqManualObs, setLiqManualObs] = useState('');
  const [liqManualLineas, setLiqManualLineas] = useState<Array<{ concepto: string; descripcion: string; cantidad: string; tarifa: string }>>([
    { concepto: '', descripcion: '', cantidad: '1', tarifa: '' },
  ]);
  const [liqManualSaving, setLiqManualSaving] = useState(false);

  // Feature C: Vinculacion manual distribuidores
  const [showAsignarDistrib, setShowAsignarDistrib] = useState(false);
  const [asignarDistribSucursal, setAsignarDistribSucursal] = useState('');
  const [asignarDistribPersonaId, setAsignarDistribPersonaId] = useState<number | null>(null);
  const [asignarDistribRecordar, setAsignarDistribRecordar] = useState(true);
  const [asignarDistribEsUnico, setAsignarDistribEsUnico] = useState(true);
  const [asignarDistribSearch, setAsignarDistribSearch] = useState('');
  const [asignarDistribResults, setAsignarDistribResults] = useState<Array<{ id: number; label: string }>>([]);

  // Mini-modal mapeo Origen (Loginter)
  const [origenesSinMapear, setOrigenesSinMapear] = useState<string[]>([]);
  const [showOrigenModal, setShowOrigenModal] = useState<string | null>(null);
  const [origenSucursalCode, setOrigenSucursalCode] = useState('');

  // OCA: detectar si el cliente seleccionado es OCA (formato PDF_DUAL)
  const isOcaClient = useMemo(() => {
    if (!selectedLiq) return false;
    const cfg = clientes.find((c) => c.id === selectedLiq.cliente_id)?.configuracion_excel;
    return (cfg as any)?.formato_entrada === 'PDF_DUAL';
  }, [selectedLiq, clientes]);

  // OCASA: detectar si el cliente usa formato excel_triple (TMS + YCC1 + PDF)
  const isOcasaClient = useMemo(() => {
    if (!selectedLiq) return false;
    const cfg = clientes.find((c) => c.id === selectedLiq.cliente_id)?.configuracion_excel;
    return (cfg as any)?.tipo_archivo === 'excel_triple';
  }, [selectedLiq, clientes]);

  const ocaSucursalOptions = useMemo(() => {
    if (!selectedLiq) return [];
    const cfg = clientes.find((c) => c.id === selectedLiq.cliente_id)?.configuracion_excel;
    const sucursales = (cfg as any)?.sucursales;
    if (!Array.isArray(sucursales)) return [];
    return sucursales.map((s: any) => ({ codigo: s.codigo as string, nombre: s.nombre as string }));
  }, [selectedLiq, clientes]);

  const sucursalTarifaOptions = useMemo(() => {
    const values = mapeosSucursal
      .filter((m) => m.activo)
      .map((m) => (m.sucursal_tarifa ?? '').trim())
      .filter((v) => v.length > 0);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [mapeosSucursal]);

  const uploadTipoOptions = useMemo(() => {
    // Por defecto mostramos solo los tipos que usamos en el módulo de extractos.
    // Se puede ampliar por cliente vía configuracion_excel.allowed_tipos_archivo.
    const base: Array<{ value: string; label: string }> = [
      { value: 'DATA_CLIENTE', label: 'DATA_CLIENTE' },
      { value: 'DETALLE_SUCURSAL', label: 'DETALLE_SUCURSAL' },
    ];

    const cfg = clientes.find((c) => c.id === selectedLiq?.cliente_id)?.configuracion_excel;
    const extraRaw = (cfg as any)?.allowed_tipos_archivo ?? (cfg as any)?.tipos_archivo ?? [];
    const extra = Array.isArray(extraRaw)
      ? extraRaw
          .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
          .map((v) => v.trim().toUpperCase())
          .filter((v) => SUPPORTED_UPLOAD_TYPES.includes(v as typeof SUPPORTED_UPLOAD_TYPES[number]))
      : [];

    const seen = new Set(base.map((b) => b.value));
    const merged = [...base];
    for (const v of extra) {
      if (!seen.has(v)) {
        merged.push({ value: v, label: v });
        seen.add(v);
      }
    }
    return merged;
  }, [selectedLiq, clientes]);

  const autoOpenLiqId = useMemo(() => {
    const params = new URLSearchParams(location.search ?? '');
    const raw = params.get('liq');
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [location.search]);
  const autoOpenedRef = useRef<number | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const loadLiquidaciones = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/liquidaciones');
      setLiquidaciones(res.data?.data ?? res.data ?? []);
      setSelectedLiqIds({});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [api]);

  const eliminarLiquidacion = useCallback(async (id: number) => {
    if (!window.confirm(`¿Eliminar la liquidación #${id} y TODO su contenido? (No se puede deshacer)`)) return;
    try {
      const res = await api.delete(`/liquidaciones/${id}`);
      showSuccess(res.message ?? 'Liquidación eliminada');
      await loadLiquidaciones();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error eliminando liquidación');
    }
  }, [api, loadLiquidaciones]);

  const eliminarLiquidacionesSeleccionadas = useCallback(async () => {
    const ids = Object.entries(selectedLiqIds)
      .filter(([, v]) => v)
      .map(([k]) => parseInt(k, 10))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (ids.length === 0) return;
    if (!window.confirm(`¿Eliminar ${ids.length} liquidación(es) seleccionada(s) y TODO su contenido? (No se puede deshacer)`)) return;

    setBulkDeleting(true);
    try {
      const errors: Array<{ id: number; message: string }> = [];
      let okCount = 0;
      for (const id of ids) {
        try {
          await api.delete(`/liquidaciones/${id}`);
          okCount += 1;
        } catch (e: unknown) {
          errors.push({ id, message: e instanceof Error ? e.message : 'Error' });
        }
      }
      await loadLiquidaciones();
      setSelectedLiqIds({});
      if (errors.length === 0) {
        showSuccess(`${okCount} liquidación(es) eliminada(s)`);
      } else {
        setError(`${okCount} eliminada(s), ${errors.length} con error. Ej: #${errors[0].id} — ${errors[0].message}`);
      }
    } finally {
      setBulkDeleting(false);
    }
  }, [api, selectedLiqIds, loadLiquidaciones]);

  const eliminarLiquidacionDesdeDetalle = useCallback(async () => {
    if (!selectedLiq) return;
    const id = selectedLiq.id;
    await eliminarLiquidacion(id);
    setSelectedLiq(null);
    setArchivos([]);
    setOperaciones([]);
    setDistribuidores([]);
    setEstadosCounts({});
    setStep('lista');
  }, [selectedLiq, eliminarLiquidacion]);

  const loadClientes = useCallback(async () => {
    try {
      const res = await api.get('/clientes');
      setClientes(res.data ?? []);
    } catch { /* silent */ }
  }, [api]);

  // ── OCA load functions (declared before openLiq so they can be referenced) ──
  const checkOcaHealth = useCallback(async () => {
    try {
      const res = await api.get('/oca/health');
      setOcaHealth(res.available === true);
    } catch {
      setOcaHealth(false);
    }
  }, [api]);

  const loadOcaVinculaciones = useCallback(async (liqId: number, page = 1, estado = '') => {
    try {
      let path = `/oca/${liqId}/vinculaciones?page=${page}`;
      if (estado) path += `&estado=${estado}`;
      const res = await api.get(path);
      const paginated = res.data ?? {};
      setOcaVinculaciones(paginated.data ?? []);
      setOcaVincPage({ current: paginated.current_page ?? 1, last: paginated.last_page ?? 1 });
    } catch {
      setOcaVinculaciones([]);
    }
  }, [api]);

  const loadOcaResumen = useCallback(async (liqId: number) => {
    try {
      const res = await api.get(`/oca/${liqId}/resumen`);
      setOcaResumen(res);
    } catch {
      setOcaResumen(null);
    }
  }, [api]);

  const loadDuplicados = useCallback(async (liqId: number) => {
    try {
      const res = await api.get(`/liquidaciones/${liqId}/duplicados`);
      setDuplicados(res.data ?? []);
    } catch {
      setDuplicados([]);
    }
  }, [api]);

  const resolverDuplicadosMasivo = useCallback(async (accion: string, filtro?: (d: any) => boolean) => {
    if (!selectedLiq) return;
    const items = filtro ? duplicados.filter(filtro) : duplicados;
    if (items.length === 0) return;
    if (!window.confirm(`¿Aplicar "${accion}" a ${items.length} operaciones?`)) return;
    setDuplicadosLoading(true);
    try {
      await api.post(`/liquidaciones/${selectedLiq.id}/resolver-duplicados`, {
        resoluciones: items.map((d: any) => ({ operacion_duplicada_id: d.id, accion })),
      });
      showSuccess(`${items.length} duplicados resueltos`);
      await loadDuplicados(selectedLiq.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error resolviendo duplicados');
    } finally {
      setDuplicadosLoading(false);
    }
  }, [api, selectedLiq, duplicados, loadDuplicados]);

  const resolverDuplicadoUno = useCallback(async (opId: number, accion: string) => {
    if (!selectedLiq) return;
    try {
      await api.post(`/liquidaciones/${selectedLiq.id}/resolver-duplicados`, {
        resoluciones: [{ operacion_duplicada_id: opId, accion }],
      });
      showSuccess('Duplicado resuelto');
      await loadDuplicados(selectedLiq.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }, [api, selectedLiq, loadDuplicados]);

  const loadOrigenesSinMapear = useCallback(async (liqId: number) => {
    try {
      const res = await api.get(`/liquidaciones/${liqId}/origenes-sin-mapear`);
      setOrigenesSinMapear(res.data ?? []);
    } catch {
      setOrigenesSinMapear([]);
    }
  }, [api]);

  const guardarMapeoOrigen = useCallback(async () => {
    if (!showOrigenModal || !origenSucursalCode.trim() || !selectedLiq) return;
    try {
      await api.post(`/clientes/${selectedLiq.cliente_id}/mapeos-sucursal`, {
        mapeos: [{ patron_archivo: showOrigenModal, sucursal_tarifa: origenSucursalCode.trim().toUpperCase() }],
      });
      setShowOrigenModal(null);
      setOrigenSucursalCode('');
      showSuccess(`Origen "${showOrigenModal}" mapeado a ${origenSucursalCode.toUpperCase()}`);
      await loadOrigenesSinMapear(selectedLiq.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando mapeo');
    }
  }, [api, showOrigenModal, origenSucursalCode, selectedLiq, loadOrigenesSinMapear]);

  const buscarPersonasOca = useCallback(async (q: string) => {
    if (q.length < 2) { setOcaPersonasResults([]); return; }
    setOcaPersonasLoading(true);
    try {
      const res = await api.get(`/oca/buscar-personas?q=${encodeURIComponent(q)}`);
      setOcaPersonasResults(res.data ?? []);
    } catch {
      setOcaPersonasResults([]);
    } finally {
      setOcaPersonasLoading(false);
    }
  }, [api]);

  const loadOcaTarifas = useCallback(async (liqId: number) => {
    try {
      const res = await api.get(`/oca/${liqId}/tarifas-detectadas`);
      setOcaTarifas(res.data ?? []);
    } catch {
      setOcaTarifas([]);
    }
  }, [api]);

  const guardarMapeoOca = useCallback(async () => {
    if (!ocaMapeo || !selectedLiq) return;
    setOcaMapeoSaving(true);
    try {
      const precioOca = ocaMapeo.precio_recibido;
      let precioDistribuidor: number;
      if (ocaMapeoModo === 'porcentaje') {
        const pct = parseFloat(ocaMapeoValor.replace(',', '.'));
        precioDistribuidor = Math.round(precioOca * (1 - pct / 100) * 100) / 100;
      } else {
        precioDistribuidor = parseFloat(ocaMapeoValor.replace(',', '.'));
      }
      if (!precioDistribuidor || precioDistribuidor <= 0) {
        setError('Precio distribuidor inválido');
        setOcaMapeoSaving(false);
        return;
      }
      await api.post(`/oca/${selectedLiq.id}/mapear-tarifa`, {
        sucursal: ocaMapeo.sucursal,
        cod_contrato: ocaMapeo.cod_contrato,
        precio_original: precioOca,
        aceptar_tarifa: true,
        modo_calculo: ocaMapeoModo,
        valor_referencia: parseFloat(ocaMapeoValor.replace(',', '.')),
        precio_distribuidor: precioDistribuidor,
        distribuidor_nombre: ocaMapeo.distribuidor_nombre ?? '',
        persona_id: ocaMapeoPersonaId,
      });
      setOcaMapeo(null);
      setOcaMapeoValor('');
      showSuccess('Tarifa mapeada');
      await loadOcaTarifas(selectedLiq.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error mapeando tarifa');
    } finally {
      setOcaMapeoSaving(false);
    }
  }, [api, ocaMapeo, ocaMapeoModo, ocaMapeoValor, selectedLiq, loadOcaTarifas]);

  const generarOperacionesOca = useCallback(async () => {
    if (!selectedLiq) return;
    const sinMapear = ocaTarifas.filter(t => t.estado === 'nueva' || t.estado === 'sin_vincular');
    if (sinMapear.length > 0) {
      setError(`Hay ${sinMapear.length} fila(s) sin mapear o sin vincular. Mapeá todas antes de generar operaciones.`);
      return;
    }
    if (!window.confirm('¿Generar operaciones OCA? Esto reemplaza operaciones previas.')) return;
    try {
      const res = await api.post(`/oca/${selectedLiq.id}/generar-operaciones`, {});
      showSuccess(res.message ?? 'Operaciones generadas');
      // Refrescar operaciones y tarifas
      const opRes = await api.get(`/liquidaciones/${selectedLiq.id}/operaciones`);
      setOperaciones(opRes.data?.data ?? opRes.data ?? []);
      setOpPage({ current: opRes.data?.current_page ?? 1, last: opRes.data?.last_page ?? 1 });
      await loadOcaTarifas(selectedLiq.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error generando operaciones');
    }
  }, [api, selectedLiq, ocaTarifas]);

  useEffect(() => {
    loadLiquidaciones();
    loadClientes();
  }, [loadLiquidaciones, loadClientes]);

  const openLiq = useCallback(async (liq: LiqLiquidacionCliente) => {
    setSelectedLiq(liq);
    setStep('detalle');
    setOpFiltroEstado('');
    setSelectedArchivoIds({});
    setSelectedOpIds({});
    try {
      const [archRes, opRes, distRes, detRes, esqRes, mapSucRes] = await Promise.all([
        api.get(`/liquidaciones/${liq.id}/archivos`),
        api.get(`/liquidaciones/${liq.id}/operaciones`),
        api.get(`/liquidaciones/${liq.id}/distribuidores`),
        api.get(`/liquidaciones/${liq.id}`),
        api.get(`/clientes/${liq.cliente_id}/esquemas`),
        api.get(`/clientes/${liq.cliente_id}/mapeos-sucursal`),
      ]);
      const archList = (archRes.data ?? []) as LiqArchivoEntrada[];
      setArchivos(archList);
      setArchivoSucursalEdit((prev) => {
        const next = { ...prev };
        for (const a of archList) {
          next[a.id] = typeof next[a.id] === 'string' ? next[a.id] : (a.sucursal ?? '');
        }
        return next;
      });
      setOperaciones(opRes.data?.data ?? opRes.data ?? []);
      setOpPage({ current: opRes.data?.current_page ?? 1, last: opRes.data?.last_page ?? 1 });
      setDistribuidores(distRes.data ?? []);
      setEstadosCounts(detRes.estados ?? {});
      setSelectedLiq((prev) => (prev ? { ...prev, ...detRes.data } : detRes.data));
      // Mantener la lista sincronizada (evita ver totales viejos al volver)
      setLiquidaciones((prev) => {
        const updated = detRes.data as LiqLiquidacionCliente;
        return prev.map((row) => (row.id === updated.id ? { ...row, ...updated, cliente: row.cliente ?? updated.cliente } : row));
      });
      setEsquemas(esqRes.data ?? []);
      setMapeosSucursal(mapSucRes.data ?? []);

      // OCA: cargar vinculaciones y resumen si es cliente OCA
      const cfg = (detRes.data?.cliente as any)?.configuracion_excel ?? {};
      const clienteCfg = clientes.find((c) => c.id === liq.cliente_id)?.configuracion_excel;
      const esOca = (cfg as any)?.formato_entrada === 'PDF_DUAL' || (clienteCfg as any)?.formato_entrada === 'PDF_DUAL';
      if (esOca) {
        loadOcaVinculaciones(liq.id).catch(() => {});
        loadOcaResumen(liq.id).catch(() => {});
        loadOcaTarifas(liq.id).catch(() => {});
        checkOcaHealth().catch(() => {});
      } else {
        setOcaVinculaciones([]);
        setOcaResumen(null);
      }

      // Cargar orígenes sin mapear (Loginter) + duplicados
      loadOrigenesSinMapear(liq.id).catch(() => {});
      loadDuplicados(liq.id).catch(() => {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando detalle');
    }
  }, [api, clientes, loadOcaVinculaciones, loadOcaResumen, loadOcaTarifas, checkOcaHealth, loadOrigenesSinMapear, loadDuplicados]);

  useEffect(() => {
    if (!autoOpenLiqId) return;
    if (autoOpenedRef.current === autoOpenLiqId) return;
    const liq = liquidaciones.find((l) => l.id === autoOpenLiqId);
    if (!liq) return;
    autoOpenedRef.current = autoOpenLiqId;
    void openLiq(liq);
  }, [autoOpenLiqId, liquidaciones, openLiq]);

  const loadOps = useCallback(async (liqId: number, estado: string, page: number) => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (estado) params.set('estado', estado);
      const res = await api.get(`/liquidaciones/${liqId}/operaciones?${params}`);
      setOperaciones(res.data?.data ?? res.data ?? []);
      setOpPage({ current: res.data?.current_page ?? 1, last: res.data?.last_page ?? 1 });
      setSelectedOpIds({});
    } catch { /* silent */ }
  }, [api]);

  const guardarSucursalArchivo = useCallback(async (archivoId: number) => {
    const suc = (archivoSucursalEdit[archivoId] ?? '').trim();
    if (!suc) { setError('Sucursal es obligatoria'); return; }
    try {
      await api.patch(`/archivos/${archivoId}/sucursal`, { sucursal: suc });
      if (selectedLiq) await openLiq(selectedLiq);
      showSuccess('Sucursal guardada');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando sucursal');
    }
  }, [api, archivoSucursalEdit, selectedLiq, openLiq]);

  const reprocesarArchivo = useCallback(async (archivoId: number) => {
    if (!selectedLiq) return;
    if (!window.confirm('¿Reprocesar este archivo con los mapeos/tarifas actuales?')) return;
    try {
      const res = await api.post(`/archivos/${archivoId}/reprocesar`, {});
      showSuccess(res.message ?? 'Archivo reprocesado');
      await openLiq(selectedLiq);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error reprocesando archivo');
    }
  }, [api, selectedLiq, openLiq]);

  const eliminarArchivo = useCallback(async (archivoId: number) => {
    if (!selectedLiq) return;
    if (!window.confirm('¿Eliminar este archivo y sus operaciones? (No se puede deshacer)')) return;
    try {
      const res = await api.delete(`/archivos/${archivoId}`);
      showSuccess(res.message ?? 'Archivo eliminado');
      await openLiq(selectedLiq);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error eliminando archivo');
    }
  }, [api, selectedLiq, openLiq]);

  const eliminarArchivosSeleccionados = useCallback(async () => {
    if (!selectedLiq) return;
    const ids = Object.entries(selectedArchivoIds)
      .filter(([, v]) => v)
      .map(([k]) => parseInt(k, 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length === 0) return;
    if (!window.confirm(`¿Eliminar ${ids.length} archivo(s) seleccionado(s) y sus operaciones? (No se puede deshacer)`)) return;

    setBulkDeleting(true);
    try {
      const errors: Array<{ id: number; message: string }> = [];
      let okCount = 0;
      for (const id of ids) {
        try {
          await api.delete(`/archivos/${id}`);
          okCount += 1;
        } catch (e: unknown) {
          errors.push({ id, message: e instanceof Error ? e.message : 'Error' });
        }
      }
      await openLiq(selectedLiq);
      setSelectedArchivoIds({});
      if (errors.length === 0) {
        showSuccess(`${okCount} archivo(s) eliminado(s)`);
      } else {
        setError(`${okCount} eliminado(s), ${errors.length} con error. Ej: #${errors[0].id} — ${errors[0].message}`);
      }
    } finally {
      setBulkDeleting(false);
    }
  }, [api, selectedLiq, selectedArchivoIds, openLiq]);

  const eliminarOperaciones = useCallback(async () => {
    if (!selectedLiq) return;
    if (!window.confirm('¿Eliminar TODAS las operaciones de esta liquidación? (Mantiene archivos cargados)')) return;
    try {
      const res = await api.delete(`/liquidaciones/${selectedLiq.id}/operaciones`);
      showSuccess(res.message ?? 'Operaciones eliminadas');
      await openLiq(selectedLiq);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error eliminando operaciones');
    }
  }, [api, selectedLiq, openLiq]);

  const eliminarOperacion = useCallback(async (opId: number) => {
    if (!selectedLiq) return;
    if (!window.confirm('¿Eliminar esta operación?')) return;
    try {
      const res = await api.delete(`/operaciones/${opId}`);
      showSuccess(res.message ?? 'Operación eliminada');
      await openLiq(selectedLiq);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error eliminando operación');
    }
  }, [api, selectedLiq, openLiq]);

  const eliminarOperacionesSeleccionadas = useCallback(async () => {
    if (!selectedLiq) return;
    const ids = Object.entries(selectedOpIds)
      .filter(([, v]) => v)
      .map(([k]) => parseInt(k, 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length === 0) return;
    if (!window.confirm(`¿Eliminar ${ids.length} operación(es) seleccionada(s)? (No se puede deshacer)`)) return;

    setBulkDeleting(true);
    try {
      const errors: Array<{ id: number; message: string }> = [];
      let okCount = 0;
      for (const id of ids) {
        try {
          await api.delete(`/operaciones/${id}`);
          okCount += 1;
        } catch (e: unknown) {
          errors.push({ id, message: e instanceof Error ? e.message : 'Error' });
        }
      }
      await openLiq(selectedLiq);
      setSelectedOpIds({});
      if (errors.length === 0) {
        showSuccess(`${okCount} operación(es) eliminada(s)`);
      } else {
        setError(`${okCount} eliminada(s), ${errors.length} con error. Ej: #${errors[0].id} — ${errors[0].message}`);
      }
    } finally {
      setBulkDeleting(false);
    }
  }, [api, selectedLiq, selectedOpIds, openLiq]);

  const activarEsquema = useCallback(async (esquemaId: number) => {
    if (!selectedLiq) return;
    try {
      const res = await api.put(`/esquemas/${esquemaId}/activar`, {});
      showSuccess(res.message ?? 'Esquema activado');
      await openLiq(selectedLiq);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error activando esquema');
    }
  }, [api, selectedLiq, openLiq]);

  const crearLiquidacion = useCallback(async () => {
    try {
      await api.post('/liquidaciones', {
        cliente_id: parseInt(newLiqClienteId),
        periodo_desde: newLiqDesde,
        periodo_hasta: newLiqHasta,
      });
      setShowNewForm(false);
      setNewLiqClienteId('');
      setNewLiqDesde('');
      setNewLiqHasta('');
      await loadLiquidaciones();
      showSuccess('Liquidación creada');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }, [api, newLiqClienteId, newLiqDesde, newLiqHasta, loadLiquidaciones]);

  // OCASA: upload de los 3 archivos
  const subirArchivosOcasa = useCallback(async () => {
    if (!ocasaTmsFile || !selectedLiq) return;
    setUploading(true);
    setOcasaResumen(null);
    try {
      const fd = new FormData();
      fd.append('liquidacion_cliente_id', String(selectedLiq.id));
      fd.append('tms_file', ocasaTmsFile);
      if (ocasaYcc1File) fd.append('ycc1_file', ocasaYcc1File);
      for (const pdf of ocasaPdfFiles) fd.append('pdf_files[]', pdf);
      const res = await api.postForm('/liquidaciones/upload-ocasa', fd);
      setOcasaTmsFile(null);
      setOcasaYcc1File(null);
      setOcasaPdfFiles([]);
      setOcasaResumen(res.data);
      await openLiq(selectedLiq);
      const totalOps = res.data?.vinculacion?.ops_total ?? res.data?.archivos?.tms?.operaciones ?? 0;
      showSuccess(`OCASA procesado: ${totalOps} operaciones`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error procesando archivos OCASA');
    } finally {
      setUploading(false);
    }
  }, [api, ocasaTmsFile, ocasaYcc1File, ocasaPdfFiles, selectedLiq, openLiq]);

  const subirArchivo = useCallback(async () => {
    if (!uploadFile || !selectedLiq) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('archivo', uploadFile);
      fd.append('liquidacion_cliente_id', String(selectedLiq.id));
      if (uploadSucursal) fd.append('sucursal', uploadSucursal);
      if (uploadTipo) fd.append('tipo_archivo', uploadTipo);
      const res = await api.postForm('/liquidaciones/upload', fd);
      setUploadFile(null);
      setUploadSucursal('');
      setUploadTipo('');
      await openLiq(selectedLiq);
      showSuccess(`Archivo procesado: ${res.data?.total_filas ?? 0} filas`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error subiendo archivo');
    } finally {
      setUploading(false);
    }
  }, [api, uploadFile, selectedLiq, uploadSucursal, uploadTipo, openLiq]);

  // ── OCA upload function ──────────────────────────────────────────────────
  const subirArchivosOca = useCallback(async () => {
    if (!ocaMainPdf || ocaDistribPdfs.length === 0 || !selectedLiq || !ocaSucursal) return;
    setUploading(true);
    setOcaUploadFailed(false);
    try {
      const fd = new FormData();
      fd.append('liquidacion_cliente_id', String(selectedLiq.id));
      fd.append('sucursal', ocaSucursal);
      fd.append('main_pdf', ocaMainPdf);
      for (const pdf of ocaDistribPdfs) {
        fd.append('distrib_pdfs[]', pdf);
      }
      const res = await api.postForm('/oca/upload', fd);
      const totalPlanillas = res.data?.total_planillas ?? 0;
      if (totalPlanillas === 0) {
        // Feature A: PDF-imagen detectado (0 operaciones extraidas)
        setOcaUploadFailed(true);
        setError('El PDF principal no contiene texto seleccionable (posible imagen escaneada). Usa OCR o carga manual.');
      } else {
        setOcaMainPdf(null);
        setOcaDistribPdfs([]);
        showSuccess(
          `OCA procesado: ${totalPlanillas} planillas, ` +
          `${res.data?.total_distribuidores ?? 0} distribuidores, ` +
          `${res.data?.exactos ?? 0} exactos`
        );
      }
      await openLiq(selectedLiq);
      await loadOcaVinculaciones(selectedLiq.id);
      await loadOcaResumen(selectedLiq.id);
    } catch (e: unknown) {
      setOcaUploadFailed(true);
      setError(e instanceof Error ? e.message : 'Error procesando PDFs OCA');
    } finally {
      setUploading(false);
    }
  }, [api, ocaMainPdf, ocaDistribPdfs, selectedLiq, ocaSucursal, openLiq, loadOcaVinculaciones, loadOcaResumen]);

  // Feature A: Intentar OCR
  const intentarOcr = useCallback(async () => {
    if (!ocaMainPdf || ocaDistribPdfs.length === 0 || !selectedLiq || !ocaSucursal) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('liquidacion_cliente_id', String(selectedLiq.id));
      fd.append('sucursal', ocaSucursal);
      fd.append('main_pdf', ocaMainPdf);
      for (const pdf of ocaDistribPdfs) {
        fd.append('distrib_pdfs[]', pdf);
      }
      const res = await api.postForm('/oca/upload-ocr', fd);
      setOcaMainPdf(null);
      setOcaDistribPdfs([]);
      setOcaUploadFailed(false);
      showSuccess(
        `OCA (OCR): ${res.data?.total_planillas ?? 0} planillas extraidas, ` +
        `${res.data?.exactos ?? 0} exactos`
      );
      await openLiq(selectedLiq);
      await loadOcaVinculaciones(selectedLiq.id);
      await loadOcaResumen(selectedLiq.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error procesando con OCR');
    } finally {
      setUploading(false);
    }
  }, [api, ocaMainPdf, ocaDistribPdfs, selectedLiq, ocaSucursal, openLiq, loadOcaVinculaciones, loadOcaResumen]);

  // Feature B: Guardar operaciones manuales OCA
  const guardarOperacionesManualesOca = useCallback(async () => {
    if (!selectedLiq || !ocaSucursal) return;
    const validRows = manualOcaRows.filter(r => r.fecha && r.nro_planilla && r.cod_contrato && r.precio_unitario && r.cantidad);
    if (validRows.length === 0) { setError('Completa al menos una operacion'); return; }
    setManualOcaSaving(true);
    try {
      const res = await api.post(`/oca/${selectedLiq.id}/operaciones-manuales`, {
        sucursal: ocaSucursal,
        operaciones: validRows.map(r => ({
          fecha: r.fecha,
          nro_planilla: r.nro_planilla,
          cod_contrato: r.cod_contrato,
          descripcion: r.descripcion || null,
          precio_unitario: parseFloat(r.precio_unitario.replace(/\./g, '').replace(',', '.')) || 0,
          cantidad: parseFloat(r.cantidad.replace(/\./g, '').replace(',', '.')) || 0,
        })),
      });
      showSuccess(res.message ?? 'Operaciones cargadas');
      setShowManualOcaForm(false);
      setOcaUploadFailed(false);
      setManualOcaRows([{ fecha: '', nro_planilla: '', cod_contrato: '', descripcion: '', precio_unitario: '', cantidad: '' }]);
      await loadOcaVinculaciones(selectedLiq.id);
      await loadOcaResumen(selectedLiq.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando operaciones');
    } finally {
      setManualOcaSaving(false);
    }
  }, [api, selectedLiq, ocaSucursal, manualOcaRows, loadOcaVinculaciones, loadOcaResumen]);

  // Feature D: Buscar distribuidores para liq manual
  const buscarDistribLiqManual = useCallback(async (q: string) => {
    setLiqManualDistribSearch(q);
    if (q.length < 2) { setLiqManualDistribResults([]); return; }
    try {
      const res = await api.get(`/oca/buscar-personas?q=${encodeURIComponent(q)}`);
      setLiqManualDistribResults((res.data ?? []).map((p: any) => ({ id: p.id, label: p.label })));
    } catch { setLiqManualDistribResults([]); }
  }, [api]);

  // Feature D: Guardar liquidacion manual
  const guardarLiqManual = useCallback(async () => {
    if (!selectedLiq || !liqManualDistribId) { setError('Selecciona un distribuidor'); return; }
    const validLineas = liqManualLineas.filter(l => l.concepto && l.cantidad && l.tarifa);
    if (validLineas.length === 0) { setError('Agrega al menos una linea'); return; }
    setLiqManualSaving(true);
    try {
      const res = await api.post('/liquidaciones-distribuidor/manual', {
        cliente_id: selectedLiq.cliente_id,
        distribuidor_id: liqManualDistribId,
        periodo_desde: selectedLiq.periodo_desde,
        periodo_hasta: selectedLiq.periodo_hasta,
        referencia_externa: liqManualRefExterna || null,
        observaciones: liqManualObs || null,
        lineas: validLineas.map(l => ({
          concepto: l.concepto,
          descripcion: l.descripcion || null,
          cantidad: parseFloat(l.cantidad.replace(/\./g, '').replace(',', '.')) || 1,
          tarifa_unitaria: parseFloat(l.tarifa.replace(/\./g, '').replace(',', '.')) || 0,
        })),
      });
      showSuccess(res.message ?? 'Liquidacion manual creada');
      setShowLiqManualForm(false);
      setLiqManualLineas([{ concepto: '', descripcion: '', cantidad: '1', tarifa: '' }]);
      setLiqManualDistribId(null);
      setLiqManualDistribSearch('');
      setLiqManualRefExterna('');
      setLiqManualObs('');
      // Refresh distribuidores
      const distRes = await api.get(`/liquidaciones/${selectedLiq.id}/distribuidores`);
      setDistribuidores(distRes.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error creando liquidacion manual');
    } finally {
      setLiqManualSaving(false);
    }
  }, [api, selectedLiq, liqManualDistribId, liqManualLineas, liqManualRefExterna, liqManualObs]);

  // Feature C: Buscar distribuidores para asignacion
  const buscarDistribAsignar = useCallback(async (q: string) => {
    setAsignarDistribSearch(q);
    if (q.length < 2) { setAsignarDistribResults([]); return; }
    try {
      const res = await api.get(`/oca/buscar-personas?q=${encodeURIComponent(q)}`);
      setAsignarDistribResults((res.data ?? []).map((p: any) => ({ id: p.id, label: p.label })));
    } catch { setAsignarDistribResults([]); }
  }, [api]);

  // Feature C: Asignar distribuidor masivo a sucursal
  const asignarDistribuidorMasivo = useCallback(async () => {
    if (!selectedLiq || !asignarDistribSucursal || !asignarDistribPersonaId) return;
    try {
      const res = await api.post(`/liquidaciones/${selectedLiq.id}/asignar-distribuidor-masivo`, {
        sucursal: asignarDistribSucursal,
        persona_id: asignarDistribPersonaId,
        recordar: asignarDistribRecordar,
        es_unico: asignarDistribEsUnico,
      });
      showSuccess(res.message ?? 'Distribuidor asignado');
      setShowAsignarDistrib(false);
      setAsignarDistribPersonaId(null);
      setAsignarDistribSearch('');
      await openLiq(selectedLiq);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error asignando distribuidor');
    }
  }, [api, selectedLiq, asignarDistribSucursal, asignarDistribPersonaId, asignarDistribRecordar, asignarDistribEsUnico, openLiq]);

  const generarLiquidaciones = useCallback(async () => {
    if (!selectedLiq) return;
    if (!window.confirm('¿Generar liquidaciones para todos los distribuidores con operaciones válidas?')) return;
    try {
      const res = await api.post(`/liquidaciones/${selectedLiq.id}/generar`, {});
      // Refrescar lista de liquidaciones por distribuidor y redirigir si es una sola
      const distRes = await api.get(`/liquidaciones/${selectedLiq.id}/distribuidores`);
      const distList = (distRes.data ?? []) as LiqLiquidacionDistribuidor[];
      setDistribuidores(distList);

      showSuccess(res.message ?? 'Liquidaciones generadas');
      await openLiq(selectedLiq);

      if (distList.length === 1) {
        navigate(`/liquidaciones/${distList[0].distribuidor_id}?liqDist=${distList[0].id}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }, [api, selectedLiq, openLiq, navigate]);

  const cambiarEstado = useCallback(async (nuevoEstado: LiqLiquidacionCliente['estado']) => {
    if (!selectedLiq) return;
    if (!window.confirm(`¿Cambiar estado a "${nuevoEstado}"?`)) return;
    try {
      const res = await api.patch(`/liquidaciones/${selectedLiq.id}/estado`, { estado: nuevoEstado });
      const updated = (res.data ?? {}) as LiqLiquidacionCliente;
      setSelectedLiq((prev) => prev ? { ...prev, ...updated } : prev);
      setLiquidaciones((prev) => prev.map((l) => l.id === selectedLiq.id ? { ...l, estado: nuevoEstado } : l));
      showSuccess(res.message ?? 'Estado actualizado');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cambiando estado');
    }
  }, [api, selectedLiq]);

  const excluirOperacion = useCallback(async (opId: number) => {
    if (!selectedLiq) return;
    const motivo = window.prompt('Motivo de exclusión (opcional):', 'Excluida manualmente');
    if (motivo === null) return;
    try {
      const res = await api.put(`/operaciones/${opId}/excluir`, { motivo: motivo.trim() || 'Excluida manualmente' });
      showSuccess(res.message ?? 'Operación excluida');
      await openLiq(selectedLiq);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error excluyendo operación');
    }
  }, [api, selectedLiq, openLiq]);

  const incluirOperacion = useCallback(async (opId: number) => {
    if (!selectedLiq) return;
    if (!window.confirm('¿Incluir nuevamente esta operación?')) return;
    try {
      const res = await api.put(`/operaciones/${opId}/incluir`);
      showSuccess(res.message ?? 'Operación incluida');
      await openLiq(selectedLiq);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error incluyendo operación');
    }
  }, [api, selectedLiq, openLiq]);

  const guardarHotMapeo = useCallback(async () => {
    if (!selectedLiq || !hotMapOp) return;
    const concepto = (hotMapOp.concepto ?? '').trim();
    const valorInput = hotMapValorTarifa.trim().replace(',', '.');
    const modo = hotMapDim; // 'fijo' o 'porcentaje'

    if (!concepto) { setError('El concepto no puede ser vacío'); return; }
    if (!valorInput || isNaN(parseFloat(valorInput))) { setError('Ingresá un valor numérico válido'); return; }

    const valorNum = parseFloat(valorInput);
    if (valorNum <= 0) { setError('El valor debe ser mayor a 0'); return; }

    try {
      // Endpoint genérico — funciona para TODOS los clientes (Loginter, OCA, futuros)
      const res = await api.post(`/liquidaciones/${selectedLiq.id}/mapear-tarifa`, {
        operacion_id: hotMapOp.id,
        patente: hotMapOp.dominio ?? '',
        persona_id: hotMapOp.distribuidor_id,
        sucursal: hotMapOp.sucursal_tarifa ?? '',
        concepto: concepto,
        valor_cliente: parseFloat(hotMapValorCliente.replace(',', '.')) || Number(hotMapOp.valor_cliente),
        modo_calculo: modo,
        valor_referencia: valorNum,
        dimension_destino: 'concepto',
      });

      setHotMapOp(null);
      setHotMapValorTarifa('');
      const pd = res.precio_distribuidor ?? 0;
      const pct = res.porcentaje_agencia ?? 0;
      showSuccess(`Tarifa mapeada: ${concepto} → distrib $${Number(pd).toLocaleString('es-AR', { minimumFractionDigits: 2 })} (${Number(pct).toFixed(2)}%). Reprocesá el archivo.`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando mapeo');
    }
  }, [api, selectedLiq, hotMapOp, hotMapValorTarifa, hotMapDim, hotMapValorCliente]);

  const generarPdf = useCallback(async (liqDistId: number) => {
    setPdfGenerating((prev) => ({ ...prev, [liqDistId]: true }));
    try {
      const res = await api.post(`/liquidaciones-distribuidor/${liqDistId}/documento`, {});
      showSuccess(res.message ?? 'PDF generado');
      // Refresh distributor list to get updated pdf_path
      if (selectedLiq) {
        const distRes = await api.get(`/liquidaciones/${selectedLiq.id}/distribuidores`);
        setDistribuidores(distRes.data ?? []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error generando PDF');
    } finally {
      setPdfGenerating((prev) => ({ ...prev, [liqDistId]: false }));
    }
  }, [api, selectedLiq]);

  const generarYSubirTodas = useCallback(async () => {
    const pendientes = distribuidores.filter(d => d.distribuidor_id && !d.pdf_path);
    const total = pendientes.length;
    if (total === 0) {
      setError('No hay liquidaciones pendientes de generar PDF');
      return;
    }
    if (!window.confirm(`¿Generar y subir PDF de ${total} liquidaciones?`)) return;
    let ok = 0;
    let errores = 0;
    for (const d of pendientes) {
      try {
        await api.post(`/liquidaciones-distribuidor/${d.id}/documento`, {});
        ok++;
      } catch {
        errores++;
      }
    }
    showSuccess(`${ok} PDFs generados y subidos${errores ? `, ${errores} errores` : ''}`);
    if (selectedLiq) {
      const distRes = await api.get(`/liquidaciones/${selectedLiq.id}/distribuidores`);
      setDistribuidores(distRes.data ?? []);
    }
  }, [api, distribuidores, selectedLiq]);

  const loadAuditoria = useCallback(async () => {
    if (!selectedLiq) return;
    setAuditoriaLoading(true);
    try {
      const res = await api.get(`/liquidaciones/${selectedLiq.id}/auditoria`);
      setAuditoria(res.data ?? null);
      setShowAuditoria(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando auditoría');
    } finally {
      setAuditoriaLoading(false);
    }
  }, [api, selectedLiq]);

  const toggleSeccion = (key: string) =>
    setAuditoriaSecciones((prev) => ({ ...prev, [key]: !prev[key] }));

  const fmt = (n: string | number | null) => {
    if (n == null) return '—';
    const num = typeof n === 'string' ? parseFloat(n) : n;
    return `$${num.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  const fmtDate = (s: string) => s?.slice(0, 10) ?? '';

  return (
    <DashboardLayout title="Liquidaciones" subtitle="Control de Extractos">
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

      {step === 'lista' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Liquidaciones</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {Object.values(selectedLiqIds).some(Boolean) && (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={eliminarLiquidacionesSeleccionadas}
                  disabled={bulkDeleting}
                >
                  Eliminar seleccionadas ({Object.values(selectedLiqIds).filter(Boolean).length})
                </button>
              )}
              <button type="button" className="btn-primary" onClick={() => setShowNewForm((p) => !p)} disabled={bulkDeleting}>
                {showNewForm ? 'Cancelar' : '+ Nueva liquidación'}
              </button>
            </div>
          </div>

          {showNewForm && (
            <div className="dashboard-card" style={{ marginBottom: 16 }}>
              <header className="card-header"><h3>Nueva liquidación</h3></header>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Cliente</label>
	                    <select className="form-input" value={newLiqClienteId} onChange={(e) => setNewLiqClienteId(e.target.value)}>
	                      <option value="">— Seleccionar —</option>
	                      {clientes.map((c) => (
	                        <option key={c.id} value={c.id}>
	                          {c.nombre_corto}{c.razon_social ? ` — ${c.razon_social}` : ''}
	                        </option>
	                      ))}
	                    </select>
	                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Período desde</label>
                    <input type="date" className="form-input" value={newLiqDesde} onChange={(e) => setNewLiqDesde(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Período hasta</label>
                    <input type="date" className="form-input" value={newLiqHasta} onChange={(e) => setNewLiqHasta(e.target.value)} />
                  </div>
                </div>
                <button type="button" className="btn-primary" onClick={crearLiquidacion} disabled={!newLiqClienteId || !newLiqDesde || !newLiqHasta}>
                  Crear
                </button>
              </div>
            </div>
          )}

          <div className="dashboard-card">
            <header className="card-header"><h3>Todas las liquidaciones</h3></header>
            <div className="card-body">
              {loading ? <p>Cargando…</p> : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 34 }}>
                        <input
                          type="checkbox"
                          aria-label="Seleccionar todo"
                          checked={liquidaciones.length > 0 && liquidaciones.every((l) => !!selectedLiqIds[l.id])}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedLiqIds((prev) => {
                              const next = { ...prev };
                              for (const l of liquidaciones) next[l.id] = checked;
                              return next;
                            });
                          }}
                        />
                      </th>
                      <th>ID</th><th>Cliente</th><th>Período</th><th>Estado</th><th>Operaciones</th><th>Total cliente</th><th>Diferencia</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {liquidaciones.map((l) => (
	                      <tr key={l.id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Seleccionar liquidación ${l.id}`}
                              checked={!!selectedLiqIds[l.id]}
                              onChange={(e) => setSelectedLiqIds((prev) => ({ ...prev, [l.id]: e.target.checked }))}
                            />
                          </td>
	                        <td>{l.id}</td>
	                        <td><strong>{l.cliente?.nombre_corto ?? l.cliente?.razon_social ?? `Cliente ${l.cliente_id}`}</strong></td>
	                        <td style={{ fontSize: 13 }}>{fmtDate(l.periodo_desde)} → {fmtDate(l.periodo_hasta)}</td>
                        <td>
                          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, background: '#e5e7eb', color: '#374151' }}>
                            {ESTADO_LIQ_LABELS[l.estado]}
                          </span>
                        </td>
                        <td>{l.total_operaciones}</td>
                        <td>{fmt(l.total_importe_cliente)}</td>
                        <td style={{ color: parseFloat(l.total_diferencia) !== 0 ? '#d97706' : '#16a34a' }}>{fmt(l.total_diferencia)}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button type="button" className="btn-sm btn-primary" onClick={() => openLiq(l)}>
                            Ver detalle
                          </button>
                          <button
                            type="button"
                            className="btn-sm btn-danger"
                            style={{ marginLeft: 8 }}
                            onClick={() => eliminarLiquidacion(l.id)}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {liquidaciones.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: '#6b7280' }}>Sin liquidaciones</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

	      {step === 'detalle' && selectedLiq && (
	        <>
	          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
		            <button
                  type="button"
                  className="btn-sm"
                  onClick={() => {
                    setStep('lista');
                    loadLiquidaciones();
                  }}
                >
                  ← Volver
                </button>
		            <h2 style={{ margin: 0 }}>
		              {selectedLiq.cliente?.nombre_corto ?? selectedLiq.cliente?.razon_social ?? `Cliente ${selectedLiq.cliente_id}`} — {fmtDate(selectedLiq.periodo_desde)} al {fmtDate(selectedLiq.periodo_hasta)}
		            </h2>
	            <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 12, background: '#e5e7eb' }}>
	              {ESTADO_LIQ_LABELS[selectedLiq.estado]}
	            </span>
            {selectedLiq.estado === 'pendiente' && (
              <button type="button" className="btn-sm" style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd' }} onClick={() => void cambiarEstado('en_proceso')}>
                → En proceso
              </button>
            )}
            {selectedLiq.estado === 'en_proceso' && (
              <>
                <button type="button" className="btn-sm" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }} onClick={() => void cambiarEstado('auditada')}>
                  → Auditada
                </button>
                <button type="button" className="btn-sm" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }} onClick={() => void cambiarEstado('rechazada')}>
                  Rechazar
                </button>
              </>
            )}
            {selectedLiq.estado === 'auditada' && (
              <>
                <button type="button" className="btn-sm" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #86efac', fontWeight: 700 }} onClick={() => void cambiarEstado('aprobada')}>
                  ✓ Aprobar
                </button>
                <button type="button" className="btn-sm" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }} onClick={() => void cambiarEstado('rechazada')}>
                  Rechazar
                </button>
                <button type="button" className="btn-sm" onClick={() => void cambiarEstado('en_proceso')}>
                  ← Volver a proceso
                </button>
              </>
            )}
            {selectedLiq.estado === 'rechazada' && (
              <button type="button" className="btn-sm" onClick={() => void cambiarEstado('en_proceso')}>
                ← Reabrir
              </button>
            )}
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-sm"
                  style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc' }}
                  onClick={() => { if (showAuditoria) { setShowAuditoria(false); } else { void loadAuditoria(); } }}
                  disabled={auditoriaLoading}
                >
                  {auditoriaLoading ? 'Cargando…' : showAuditoria ? 'Ocultar auditoría' : 'Ver auditoría'}
                </button>
                <button type="button" className="btn-sm btn-danger" onClick={eliminarLiquidacionDesdeDetalle}>
                  Eliminar liquidación
                </button>
                <button type="button" className="btn-sm btn-danger" onClick={eliminarOperaciones}>
                  Eliminar operaciones
                </button>
              </span>
	          </div>

          {esquemas.length > 0 && (
            <div className="dashboard-card" style={{ marginBottom: 16 }}>
              <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 13 }}>Esquema activo:</strong>
                <span style={{ fontSize: 13 }}>
                  {esquemas.find((e) => e.activo)?.nombre ?? '—'} ({(esquemas.find((e) => e.activo)?.dimensiones ?? []).join(', ')})
                </span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="form-input"
                    style={{ width: 320 }}
                    value={String(esquemas.find((e) => e.activo)?.id ?? esquemas[0]?.id ?? '')}
                    onChange={(e) => {
                      const id = parseInt(e.target.value, 10);
                      if (!isNaN(id)) activarEsquema(id);
                    }}
                  >
                    {esquemas.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre} ({e.dimensiones.join(', ')}){e.activo ? ' ✓' : ''}
                      </option>
                    ))}
                  </select>
                </span>
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
            {Object.entries(estadosCounts).map(([estado, count]) => (
              <div key={estado} className="dashboard-card" style={{ padding: 12 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{ESTADO_OPERACION_LABELS[estado as LiqOperacion['estado']] ?? estado}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: ESTADO_OPERACION_COLOR[estado as LiqOperacion['estado']] ?? '#374151' }}>{count}</div>
              </div>
            ))}
          </div>

          {/* Auditoría panel */}
          {showAuditoria && auditoria && (
            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
              {/* Resumen ejecutivo */}
              <div className="dashboard-card">
                <header className="card-header"><h3>Resumen de auditoría</h3></header>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
                    {[
                      { label: 'Total operaciones', value: auditoria.resumen.total_operaciones, color: '#374151' },
                      { label: 'Importe cliente', value: fmt(auditoria.resumen.total_importe_cliente), color: '#1d4ed8' },
                      { label: 'Importe distribuidor', value: fmt(auditoria.resumen.total_importe_distribuidor), color: '#0369a1' },
                      { label: 'Margen agencia', value: fmt(auditoria.resumen.total_margen_agencia), color: '#16a34a' },
                      { label: 'Diferencia total', value: fmt(auditoria.resumen.total_diferencia), color: auditoria.resumen.total_diferencia !== 0 ? '#d97706' : '#16a34a' },
                    ].map((c) => (
                      <div key={c.label} style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{c.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Por sucursal */}
                  {auditoria.por_sucursal.length > 0 && (
                    <>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: 13, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSeccion('sucursal')}>
                        {auditoriaSecciones['sucursal'] ? '▾' : '▸'} Resumen por sucursal ({auditoria.por_sucursal.length})
                      </h4>
                      {auditoriaSecciones['sucursal'] && (
                        <div style={{ overflowX: 'auto' }}>
                          <table className="data-table">
                            <thead><tr><th>Sucursal</th><th>Total</th><th>OK</th><th>Diferencia</th><th>Sin tarifa</th><th>Sin distrib.</th><th>Importe cliente</th><th>Importe correcto</th><th>Diferencia $</th></tr></thead>
                            <tbody>
                              {auditoria.por_sucursal.map((s) => (
                                <tr key={s.sucursal}>
                                  <td><strong>{s.sucursal}</strong></td>
                                  <td>{s.total}</td>
                                  <td style={{ color: '#16a34a' }}>{s.ok}</td>
                                  <td style={{ color: s.diferencia > 0 ? '#d97706' : '#6b7280' }}>{s.diferencia}</td>
                                  <td style={{ color: s.sin_tarifa > 0 ? '#dc2626' : '#6b7280' }}>{s.sin_tarifa}</td>
                                  <td style={{ color: s.sin_distribuidor > 0 ? '#7c3aed' : '#6b7280' }}>{s.sin_distribuidor}</td>
                                  <td>{fmt(s.total_cliente)}</td>
                                  <td>{fmt(s.total_correcto)}</td>
                                  <td style={{ color: s.total_diferencia !== 0 ? '#d97706' : '#16a34a' }}>{fmt(s.total_diferencia)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Por distribuidor */}
              {auditoria.por_distribuidor.length > 0 && (
                <div className="dashboard-card">
                  <header className="card-header" style={{ cursor: 'pointer' }} onClick={() => toggleSeccion('distribuidor')}>
                    <h3>{auditoriaSecciones['distribuidor'] ? '▾' : '▸'} Resumen por distribuidor ({auditoria.por_distribuidor.length})</h3>
                  </header>
                  {auditoriaSecciones['distribuidor'] && (
                    <div className="card-body" style={{ overflowX: 'auto' }}>
                      <table className="data-table">
                        <thead><tr><th>Distribuidor</th><th>Patente</th><th>Ops</th><th>Importe cliente</th><th>Importe correcto</th><th>Importe distrib.</th><th>Margen agencia</th><th>Diferencia</th></tr></thead>
                        <tbody>
                          {auditoria.por_distribuidor.map((d) => (
                            <tr key={d.distribuidor_id}>
                              <td><strong>{d.nombre}</strong></td>
                              <td><code>{d.patente}</code></td>
                              <td>{d.cantidad}</td>
                              <td>{fmt(d.total_cliente)}</td>
                              <td>{fmt(d.total_correcto)}</td>
                              <td>{fmt(d.total_distribuidor)}</td>
                              <td style={{ color: '#16a34a' }}>{fmt(d.margen_agencia)}</td>
                              <td style={{ color: d.total_diferencia !== 0 ? '#d97706' : '#16a34a' }}>{fmt(d.total_diferencia)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Diferencias */}
              {auditoria.diferencias.length > 0 && (
                <div className="dashboard-card">
                  <header className="card-header" style={{ cursor: 'pointer' }} onClick={() => toggleSeccion('diferencias')}>
                    <h3 style={{ color: '#d97706' }}>{auditoriaSecciones['diferencias'] ? '▾' : '▸'} Diferencias fuera de tolerancia ({auditoria.diferencias.length})</h3>
                  </header>
                  {auditoriaSecciones['diferencias'] && (
                    <div className="card-body" style={{ overflowX: 'auto' }}>
                      <table className="data-table">
                        <thead><tr><th>Dominio</th><th>Distribuidor</th><th>Concepto</th><th>Sucursal</th><th>Valor cliente</th><th>Tarifa correcta</th><th>Diferencia</th></tr></thead>
                        <tbody>
                          {auditoria.diferencias.map((op) => (
                            <tr key={op.id}>
                              <td><code>{op.dominio ?? '—'}</code></td>
                              <td style={{ fontSize: 12 }}>{op.distribuidor ? `${op.distribuidor.apellidos}, ${op.distribuidor.nombres}` : '—'}</td>
                              <td style={{ fontSize: 12 }}>{op.concepto ?? '—'}</td>
                              <td style={{ fontSize: 12 }}>{op.sucursal_tarifa ?? '—'}</td>
                              <td>{fmt(op.valor_cliente)}</td>
                              <td>{op.valor_tarifa_original ? fmt(op.valor_tarifa_original) : '—'}</td>
                              <td style={{ color: '#d97706', fontWeight: 600 }}>{op.diferencia_cliente ? fmt(op.diferencia_cliente) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Sin tarifa agrupado */}
              {auditoria.sin_tarifa_agrupado.length > 0 && (
                <div className="dashboard-card">
                  <header className="card-header" style={{ cursor: 'pointer' }} onClick={() => toggleSeccion('sinTarifa')}>
                    <h3 style={{ color: '#dc2626' }}>{auditoriaSecciones['sinTarifa'] ? '▾' : '▸'} Sin tarifa ({auditoria.sin_tarifa_agrupado.reduce((s, x) => s + x.cantidad, 0)} ops · {auditoria.sin_tarifa_agrupado.length} conceptos únicos)</h3>
                  </header>
                  {auditoriaSecciones['sinTarifa'] && (
                    <div className="card-body">
                      <table className="data-table">
                        <thead><tr><th>Concepto (Excel)</th><th>Dimensión fallida</th><th>Sucursal</th><th>Cantidad</th><th>Total cliente</th></tr></thead>
                        <tbody>
                          {auditoria.sin_tarifa_agrupado.map((s, i) => (
                            <tr key={i}>
                              <td><code>{s.concepto ?? '—'}</code></td>
                              <td style={{ color: '#dc2626', fontSize: 12 }}>{s.dimension_fallida ?? '—'}</td>
                              <td style={{ fontSize: 12 }}>{s.sucursal_tarifa ?? '—'}</td>
                              <td>{s.cantidad}</td>
                              <td>{fmt(s.total_cliente)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Sin distribuidor agrupado + Feature C: vinculacion manual */}
              {auditoria.sin_distribuidor_agrupado.length > 0 && (
                <div className="dashboard-card">
                  <header className="card-header" style={{ cursor: 'pointer' }} onClick={() => toggleSeccion('sinDistrib')}>
                    <h3 style={{ color: '#7c3aed' }}>{auditoriaSecciones['sinDistrib'] ? '▾' : '▸'} Sin distribuidor ({auditoria.sin_distribuidor_agrupado.reduce((s, x) => s + x.cantidad, 0)} ops · {auditoria.sin_distribuidor_agrupado.length} patentes unicas)</h3>
                  </header>
                  {auditoriaSecciones['sinDistrib'] && (
                    <div className="card-body">
                      <table className="data-table">
                        <thead><tr><th>Dominio / Patente</th><th>Sucursal</th><th>Cantidad</th><th>Total cliente</th><th></th></tr></thead>
                        <tbody>
                          {auditoria.sin_distribuidor_agrupado.map((s: any, i: number) => (
                            <tr key={i}>
                              <td><code>{s.dominio ?? '-'}</code></td>
                              <td>{s.sucursal_tarifa ?? '-'}</td>
                              <td>{s.cantidad}</td>
                              <td>{fmt(s.total_cliente)}</td>
                              <td>
                                <button type="button" className="btn-sm" style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd', fontSize: 11 }}
                                  onClick={() => { setShowAsignarDistrib(true); setAsignarDistribSucursal(s.sucursal_tarifa ?? s.dominio ?? ''); }}>
                                  Asignar distribuidor
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Feature C: Modal asignacion masiva */}
                      {showAsignarDistrib && (
                        <div style={{ marginTop: 16, padding: 16, background: '#f5f3ff', borderRadius: 8, border: '1px solid #c4b5fd' }}>
                          <h4 style={{ margin: '0 0 12px', color: '#6d28d9', fontSize: 14 }}>
                            Asignar distribuidor a sucursal: <strong>{asignarDistribSucursal}</strong>
                          </h4>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
                            <div style={{ flex: 1, minWidth: 250 }}>
                              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Buscar distribuidor</label>
                              <input type="text" className="form-input" placeholder="Nombre, patente o CUIL..." value={asignarDistribSearch}
                                onChange={e => buscarDistribAsignar(e.target.value)} style={{ width: '100%' }} />
                              {asignarDistribResults.length > 0 && (
                                <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, maxHeight: 160, overflowY: 'auto', marginTop: 4 }}>
                                  {asignarDistribResults.map(p => (
                                    <div key={p.id} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f3f4f6', background: asignarDistribPersonaId === p.id ? '#ede9fe' : undefined }}
                                      onClick={() => { setAsignarDistribPersonaId(p.id); setAsignarDistribSearch(p.label); setAsignarDistribResults([]); }}>
                                      {p.label}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input type="checkbox" checked={asignarDistribRecordar} onChange={e => setAsignarDistribRecordar(e.target.checked)} />
                              Recordar para proxima vez
                            </label>
                            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input type="checkbox" checked={asignarDistribEsUnico} onChange={e => setAsignarDistribEsUnico(e.target.checked)} />
                              Es unico distrib. de esta sucursal
                            </label>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="btn-primary" onClick={asignarDistribuidorMasivo} disabled={!asignarDistribPersonaId}>
                              Asignar a todas las ops de {asignarDistribSucursal}
                            </button>
                            <button type="button" className="btn-sm" onClick={() => setShowAsignarDistrib(false)}>Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Duplicados */}
              {auditoria.duplicados.length > 0 && (
                <div className="dashboard-card">
                  <header className="card-header" style={{ cursor: 'pointer' }} onClick={() => toggleSeccion('duplicados')}>
                    <h3 style={{ color: '#db2777' }}>{auditoriaSecciones['duplicados'] ? '▾' : '▸'} Duplicados detectados ({auditoria.duplicados.length})</h3>
                  </header>
                  {auditoriaSecciones['duplicados'] && (
                    <div className="card-body" style={{ overflowX: 'auto' }}>
                      <table className="data-table">
                        <thead><tr><th>ID Op.</th><th>Dominio</th><th>Concepto</th><th>Valor cliente</th><th>Distribuidor</th></tr></thead>
                        <tbody>
                          {auditoria.duplicados.map((op) => (
                            <tr key={op.id}>
                              <td>{op.id}</td>
                              <td><code>{op.dominio ?? '—'}</code></td>
                              <td style={{ fontSize: 12 }}>{op.concepto ?? '—'}</td>
                              <td>{fmt(op.valor_cliente)}</td>
                              <td style={{ fontSize: 12 }}>{op.distribuidor ? `${op.distribuidor.apellidos}, ${op.distribuidor.nombres}` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Upload file - condicional: OCA (dual PDF) vs genérico */}
          {isOcaClient ? (
            <div className="dashboard-card" style={{ marginBottom: 16 }}>
              <header className="card-header">
                <h3>Cargar PDFs OCA</h3>
                {ocaHealth !== null && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: ocaHealth ? '#dcfce7' : '#fee2e2', color: ocaHealth ? '#16a34a' : '#dc2626' }}>
                    Motor Python: {ocaHealth ? 'Conectado' : 'No disponible'}
                  </span>
                )}
              </header>
              <div className="card-body">
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Sucursal</label>
                    <select className="form-input" value={ocaSucursal} onChange={(e) => setOcaSucursal(e.target.value)} style={{ width: 200 }}>
                      <option value="">Seleccionar...</option>
                      {ocaSucursalOptions.map((s) => (
                        <option key={s.codigo} value={s.codigo}>{s.codigo} - {s.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>PDF Principal ({ocaSucursal || 'SUCURSAL'}.pdf)</label>
                    <input type="file" accept=".pdf" onChange={(e) => setOcaMainPdf(e.target.files?.[0] ?? null)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>PDFs Distribuidores (individuales o desglose)</label>
                    <input type="file" accept=".pdf" multiple onChange={(e) => setOcaDistribPdfs(Array.from(e.target.files ?? []))} />
                  </div>
                </div>
                {ocaDistribPdfs.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                    {ocaDistribPdfs.length} archivo(s) seleccionado(s): {ocaDistribPdfs.map(f => f.name).join(', ')}
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={subirArchivosOca}
                    disabled={!ocaMainPdf || ocaDistribPdfs.length === 0 || !ocaSucursal || uploading || ocaHealth === false}
                  >
                    {uploading ? 'Procesando PDFs…' : 'Subir y vincular'}
                  </button>
                  {ocaHealth === false && (
                    <span style={{ marginLeft: 12, fontSize: 12, color: '#dc2626' }}>
                      El motor Python no esta disponible. Inicialo con: cd python && uvicorn app.main:app --port 8100
                    </span>
                  )}
                </div>

                {/* Feature A: Alerta PDF-imagen */}
                {ocaUploadFailed && (
                  <div style={{ marginTop: 16, padding: 16, background: '#fef3c7', borderRadius: 8, border: '1px solid #fcd34d' }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, color: '#92400e' }}>
                      PDF sin texto detectado (posible imagen escaneada)
                    </div>
                    <p style={{ fontSize: 13, color: '#78350f', marginBottom: 12 }}>
                      El parser no pudo extraer operaciones del PDF principal. Esto suele pasar con PDFs generados por CamScanner u otras apps de escaneo.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn-primary" onClick={intentarOcr} disabled={uploading || !ocaMainPdf}>
                        {uploading ? 'Procesando OCR...' : 'Intentar OCR'}
                      </button>
                      <button type="button" className="btn-sm" style={{ background: '#fff', border: '1px solid #d1d5db' }} onClick={() => { setShowManualOcaForm(true); setOcaUploadFailed(false); }}>
                        Cargar manualmente
                      </button>
                    </div>
                  </div>
                )}

                {/* Feature B: Formulario carga manual OCA */}
                {showManualOcaForm && (
                  <div style={{ marginTop: 16, padding: 16, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h4 style={{ margin: 0, color: '#0369a1' }}>Carga manual de operaciones OCA — {ocaSucursal}</h4>
                      <button type="button" className="btn-sm" onClick={() => setShowManualOcaForm(false)} style={{ background: '#e0f2fe' }}>Cerrar</button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ width: 110 }}>Fecha</th>
                            <th style={{ width: 100 }}>Nro Planilla</th>
                            <th style={{ width: 140 }}>Contrato</th>
                            <th>Descripcion</th>
                            <th style={{ width: 120 }}>Importe unit.</th>
                            <th style={{ width: 90 }}>Cantidad</th>
                            <th style={{ width: 120, textAlign: 'right' }}>Total</th>
                            <th style={{ width: 70 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {manualOcaRows.map((row, idx) => {
                            const precio = parseFloat(row.precio_unitario.replace(/\./g, '').replace(',', '.')) || 0;
                            const cant = parseFloat(row.cantidad.replace(/\./g, '').replace(',', '.')) || 0;
                            const total = precio * cant;
                            return (
                              <tr key={idx}>
                                <td><input type="date" className="form-input" style={{ fontSize: 11, width: '100%' }} value={row.fecha} onChange={e => { const rows = [...manualOcaRows]; rows[idx].fecha = e.target.value; setManualOcaRows(rows); }} /></td>
                                <td><input type="text" className="form-input" style={{ fontSize: 11, width: '100%' }} value={row.nro_planilla} onChange={e => { const rows = [...manualOcaRows]; rows[idx].nro_planilla = e.target.value; setManualOcaRows(rows); }} /></td>
                                <td>
                                  <select className="form-input" style={{ fontSize: 11, width: '100%' }} value={row.cod_contrato} onChange={e => { const rows = [...manualOcaRows]; rows[idx].cod_contrato = e.target.value; setManualOcaRows(rows); }}>
                                    <option value="">Seleccionar...</option>
                                    <option value="198">198 - GRAL PAQ. INTERIOR</option>
                                    <option value="200">200 - GRAL KM UTILITARIO</option>
                                    <option value="195">195 - ADG PICKUP PRINC</option>
                                    <option value="197">197 - GRAL PAQ. BS AS</option>
                                    <option value="199">199 - GRAL PAQ. BS AS KM</option>
                                  </select>
                                </td>
                                <td><input type="text" className="form-input" style={{ fontSize: 11, width: '100%' }} value={row.descripcion} onChange={e => { const rows = [...manualOcaRows]; rows[idx].descripcion = e.target.value; setManualOcaRows(rows); }} placeholder="Paq. entregado" /></td>
                                <td><input type="text" inputMode="decimal" className="form-input" style={{ fontSize: 11, width: '100%' }} value={row.precio_unitario} onChange={e => { const rows = [...manualOcaRows]; rows[idx].precio_unitario = e.target.value; setManualOcaRows(rows); }} placeholder="1.820.000" /></td>
                                <td><input type="text" inputMode="decimal" className="form-input" style={{ fontSize: 11, width: '100%' }} value={row.cantidad} onChange={e => { const rows = [...manualOcaRows]; rows[idx].cantidad = e.target.value; setManualOcaRows(rows); }} placeholder="45" /></td>
                                <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 11 }}>{total > 0 ? `$ ${total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}` : '-'}</td>
                                <td>
                                  <button type="button" className="btn-sm" style={{ fontSize: 10, marginRight: 2 }} onClick={() => { const rows = [...manualOcaRows]; rows.splice(idx + 1, 0, { ...row }); setManualOcaRows(rows); }} title="Duplicar">Dup</button>
                                  {manualOcaRows.length > 1 && (
                                    <button type="button" className="btn-sm btn-danger" style={{ fontSize: 10 }} onClick={() => { const rows = [...manualOcaRows]; rows.splice(idx, 1); setManualOcaRows(rows); }} title="Eliminar">X</button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600 }}>Total:</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                              $ {manualOcaRows.reduce((sum, r) => {
                                const p = parseFloat(r.precio_unitario.replace(/\./g, '').replace(',', '.')) || 0;
                                const c = parseFloat(r.cantidad.replace(/\./g, '').replace(',', '.')) || 0;
                                return sum + p * c;
                              }, 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                      <button type="button" className="btn-sm" onClick={() => setManualOcaRows(prev => [...prev, { fecha: prev[prev.length - 1]?.fecha || '', nro_planilla: '', cod_contrato: '', descripcion: '', precio_unitario: '', cantidad: '' }])}>
                        + Agregar fila
                      </button>
                      <button type="button" className="btn-primary" onClick={guardarOperacionesManualesOca} disabled={manualOcaSaving}>
                        {manualOcaSaving ? 'Guardando...' : 'Confirmar carga'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : isOcasaClient ? (
            /* ── OCASA: Formulario de 3 zonas ───────────────────────── */
            <div className="dashboard-card" style={{ marginBottom: 16 }}>
              <header className="card-header"><h3>Cargar archivos OCASA</h3></header>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  {/* Zona TMS */}
                  <div style={{ padding: 14, background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#1e40af' }}>TMS (obligatorio)</div>
                    <input type="file" accept=".xlsx,.xls" onChange={(e) => setOcasaTmsFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12 }} />
                    {ocasaTmsFile && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#1e40af' }}>
                        {ocasaTmsFile.name}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 6 }}>
                      Excel con operaciones: Transporte, CostoFijo, CostoKm, CostoProd, Distancia, Licencia
                    </div>
                  </div>

                  {/* Zona YCC1 */}
                  <div style={{ padding: 14, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#166534' }}>YCC1 (opcional)</div>
                    <input type="file" accept=".xlsx,.xls" onChange={(e) => setOcasaYcc1File(e.target.files?.[0] ?? null)} style={{ fontSize: 12 }} />
                    {ocasaYcc1File && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#166534' }}>
                        {ocasaYcc1File.name}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 6 }}>
                      Excel de detalle por parada/bulto. Vincula con TMS por Transporte.
                    </div>
                  </div>

                  {/* Zona PDFs */}
                  <div style={{ padding: 14, background: '#fefce8', borderRadius: 8, border: '1px solid #fde68a' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#854d0e' }}>PDFs facturas (opcional)</div>
                    <input type="file" accept=".pdf" multiple onChange={(e) => setOcasaPdfFiles(Array.from(e.target.files ?? []))} style={{ fontSize: 12 }} />
                    {ocasaPdfFiles.length > 0 && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#854d0e' }}>
                        {ocasaPdfFiles.length} PDF(s): {ocasaPdfFiles.map(f => f.name).join(', ')}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 6 }}>
                      PDFs del cliente con split Imp.Gravado / Imp.NoGravado por operacion.
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button type="button" className="btn-primary" onClick={subirArchivosOcasa} disabled={!ocasaTmsFile || uploading}>
                    {uploading ? 'Procesando archivos OCASA...' : 'Subir y procesar'}
                  </button>
                  {!ocasaTmsFile && <span style={{ fontSize: 11, color: '#6b7280' }}>Selecciona al menos el archivo TMS para continuar</span>}
                  {ocasaTmsFile && !ocasaYcc1File && !ocasaPdfFiles.length && (
                    <span style={{ fontSize: 11, color: '#d97706' }}>Solo TMS seleccionado. YCC1 y PDFs son opcionales pero recomendados.</span>
                  )}
                </div>

                {/* Bug B: Panel de resumen de procesamiento */}
                {ocasaResumen && (
                  <div style={{ marginTop: 16, padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>Resultado del procesamiento</h4>

                    {/* Estado de archivos */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                      <div style={{ padding: 8, borderRadius: 6, background: ocasaResumen.archivos?.tms?.estado === 'ok' ? '#dcfce7' : '#fee2e2' }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>TMS</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{ocasaResumen.archivos?.tms?.operaciones ?? 0}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>operaciones</div>
                      </div>
                      <div style={{ padding: 8, borderRadius: 6, background: ocasaResumen.archivos?.ycc1?.estado === 'ok' ? '#dcfce7' : ocasaResumen.archivos?.ycc1?.estado === 'no_cargado' ? '#fefce8' : '#fee2e2' }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>YCC1</div>
                        {ocasaResumen.archivos?.ycc1?.estado === 'ok' ? (
                          <>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>{ocasaResumen.archivos.ycc1.filas?.toLocaleString('es-AR') ?? 0}</div>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>filas vinculadas</div>
                          </>
                        ) : (
                          <div style={{ fontSize: 12, color: '#92400e' }}>No cargado</div>
                        )}
                      </div>
                      <div style={{ padding: 8, borderRadius: 6, background: ocasaResumen.archivos?.pdfs?.estado === 'ok' ? '#dcfce7' : ocasaResumen.archivos?.pdfs?.estado === 'no_cargado' ? '#fefce8' : '#fee2e2' }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>PDFs</div>
                        {ocasaResumen.archivos?.pdfs?.estado === 'ok' ? (
                          <>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>{ocasaResumen.archivos.pdfs.facturas ?? 0}</div>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{ocasaResumen.archivos.pdfs.ops_con_gravado ?? 0} ops con gravado</div>
                          </>
                        ) : (
                          <div style={{ fontSize: 12, color: '#92400e' }}>No cargado</div>
                        )}
                      </div>
                    </div>

                    {/* Modelos de tarifa */}
                    {ocasaResumen.modelos && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Modelos de tarifa detectados</div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                          {[['JORNADA', 'Jornada', '#dbeafe', '#1e40af'], ['JORNADA_KM', 'Jornada+KM', '#fef3c7', '#92400e'], ['PRODUCTIVIDAD', 'Productividad', '#d1fae5', '#065f46']].map(([key, label, bg, color]) => {
                            const m = ocasaResumen.modelos[key];
                            return m?.cantidad > 0 ? (
                              <span key={key} style={{ padding: '3px 10px', borderRadius: 6, background: bg as string, color: color as string, fontWeight: 600 }}>
                                {label}: {m.cantidad} ({m.porcentaje}%)
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}

                    {/* Fracciones */}
                    {ocasaResumen.fracciones && Object.keys(ocasaResumen.fracciones).length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Fracciones de jornada</div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                          {Object.entries(ocasaResumen.fracciones as Record<string, { cantidad: number; porcentaje: number }>).sort(([a], [b]) => parseFloat(b) - parseFloat(a)).map(([frac, data]) => {
                            const f = parseFloat(frac);
                            const label = Math.abs(f - 1.0) < 0.01 ? '1/1' : Math.abs(f - 0.75) < 0.01 ? '3/4' : Math.abs(f - 0.5) < 0.01 ? '1/2' : Math.abs(f - 0.25) < 0.01 ? '1/4' : `${Math.round(f * 100)}%`;
                            return (
                              <span key={frac} style={{ padding: '2px 8px', borderRadius: 4, background: '#f3f4f6' }}>
                                {label}: {data.cantidad} ({data.porcentaje}%)
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Vinculacion */}
                    {ocasaResumen.vinculacion && (
                      <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
                        <div>
                          <span style={{ color: '#6b7280' }}>Distribuidores: </span>
                          <strong style={{ color: '#16a34a' }}>{ocasaResumen.vinculacion.distribuidores_ok}</strong>
                          {ocasaResumen.vinculacion.distribuidores_sin_match > 0 && (
                            <span style={{ color: '#dc2626' }}> ({ocasaResumen.vinculacion.distribuidores_sin_match} sin match)</span>
                          )}
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>Con tarifa: </span>
                          <strong style={{ color: '#16a34a' }}>{ocasaResumen.vinculacion.ops_con_tarifa}</strong>
                          <span style={{ color: '#6b7280' }}> / {ocasaResumen.vinculacion.ops_total}</span>
                          {ocasaResumen.vinculacion.ops_sin_tarifa > 0 && (
                            <span style={{ color: '#dc2626' }}> ({ocasaResumen.vinculacion.ops_sin_tarifa} sin tarifa)</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Errores */}
                    {ocasaResumen.errores?.length > 0 && (
                      <div style={{ marginTop: 10, padding: 8, background: '#fee2e2', borderRadius: 6, fontSize: 11, color: '#991b1b' }}>
                        {ocasaResumen.errores.map((e: string, i: number) => <div key={i}>{e}</div>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Formulario generico (OCA, Urbano, Loginter, etc.) ── */
            <div className="dashboard-card" style={{ marginBottom: 16 }}>
              <header className="card-header"><h3>Cargar archivo de entrada</h3></header>
              <div className="card-body">
                <datalist id="liq-sucursal-options">
                  {sucursalTarifaOptions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Archivo</label>
                    <input type="file" accept=".xlsx,.xls,.pdf" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Sucursal (opcional)</label>
                    <input
                      type="text"
                      list="liq-sucursal-options"
                      className="form-input"
                      value={uploadSucursal}
                      onChange={(e) => setUploadSucursal(e.target.value)}
                      placeholder="ej: AMBA"
                      style={{ width: 180 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Tipo archivo (opcional)</label>
                    <select className="form-input" value={uploadTipo} onChange={(e) => setUploadTipo(e.target.value)} style={{ width: 180 }}>
                      <option value="">---</option>
                      {uploadTipoOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', minWidth: 220 }}>
                    Soporta Excel y PDF. Para PDF, el cliente debe tener configurado `pdf_operacion_regex`.
                  </div>
                  <button type="button" className="btn-primary" onClick={subirArchivo} disabled={!uploadFile || uploading}>
                    {uploading ? 'Procesando...' : 'Subir y procesar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Files uploaded */}
	          {archivos.length > 0 && (
	            <div className="dashboard-card" style={{ marginBottom: 16 }}>
	              <header className="card-header">
                  <h3>Archivos cargados</h3>
                  {Object.values(selectedArchivoIds).some(Boolean) && (
                    <button type="button" className="btn-sm btn-danger" onClick={eliminarArchivosSeleccionados} disabled={bulkDeleting}>
                      Eliminar seleccionados ({Object.values(selectedArchivoIds).filter(Boolean).length})
                    </button>
                  )}
                </header>
		              <div className="card-body">
		                <table className="data-table">
		                  <thead>
                        <tr>
                          <th style={{ width: 34 }}>
                            <input
                              type="checkbox"
                              aria-label="Seleccionar todo"
                              checked={archivos.length > 0 && archivos.every((a) => !!selectedArchivoIds[a.id])}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSelectedArchivoIds((prev) => {
                                  const next = { ...prev };
                                  for (const a of archivos) next[a.id] = checked;
                                  return next;
                                });
                              }}
                            />
                          </th>
                          <th>Archivo</th><th>Sucursal</th><th>Tipo</th><th>Registros</th><th></th>
                        </tr>
                      </thead>
		                  <tbody>
		                    {archivos.map((a) => (
		                      <tr key={a.id}>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Seleccionar archivo ${a.id}`}
                                checked={!!selectedArchivoIds[a.id]}
                                onChange={(e) => setSelectedArchivoIds((prev) => ({ ...prev, [a.id]: e.target.checked }))}
                              />
                            </td>
		                        <td>{a.nombre_original}</td>
		                        <td>
	                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
	                              <input
                                className="form-input"
                                style={{ width: 160 }}
                                placeholder="Ej: AMBA"
                                list="liq-sucursal-options"
                                value={archivoSucursalEdit[a.id] ?? (a.sucursal ?? '')}
                                onChange={(e) => setArchivoSucursalEdit((prev) => ({ ...prev, [a.id]: e.target.value }))}
                              />
                              <button type="button" className="btn-sm btn-primary" onClick={() => guardarSucursalArchivo(a.id)}>
                                Guardar
                              </button>
                            </div>
                          </td>
		                        <td>{a.tipo_archivo ?? '—'}</td>
		                        <td>{a.operaciones_count ?? a.cant_registros ?? '—'}</td>
	                          <td style={{ textAlign: 'right' }}>
	                            <button type="button" className="btn-sm" onClick={() => reprocesarArchivo(a.id)}>
	                              Reprocesar
	                            </button>
                            <button type="button" className="btn-sm btn-danger" onClick={() => eliminarArchivo(a.id)} style={{ marginLeft: 8 }}>
                              Eliminar
                            </button>
                          </td>
		                      </tr>
		                    ))}
		                  </tbody>
		                </table>
		              </div>
	            </div>
	          )}

          {/* Orígenes sin mapear (Loginter) */}
          {origenesSinMapear.length > 0 && (
            <div className="dashboard-card" style={{ marginBottom: 16, border: '2px solid #f59e0b' }}>
              <header className="card-header" style={{ background: '#fef9c3' }}>
                <h3 style={{ color: '#92400e' }}>Orígenes sin mapear ({origenesSinMapear.length})</h3>
              </header>
              <div className="card-body">
                <p style={{ fontSize: 12, color: '#92400e', marginBottom: 8 }}>
                  Se detectaron orígenes en el Excel que no tienen sucursal asignada. Mapeá cada uno para que las operaciones se procesen correctamente.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {origenesSinMapear.map((origen) => (
                    <button
                      key={origen}
                      type="button"
                      className="btn-sm"
                      style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e', fontWeight: 600 }}
                      onClick={() => { setShowOrigenModal(origen); setOrigenSucursalCode(''); }}
                    >
                      {origen}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mini-modal mapeo Origen */}
          {showOrigenModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Mapear Origen Nuevo</h3>
                <div style={{ fontSize: 13, marginBottom: 12 }}>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ color: '#6b7280' }}>Origen del Excel:</span>
                    <span style={{ fontWeight: 600, marginLeft: 8 }}>"{showOrigenModal}"</span>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Código de sucursal (ej: NEU, CDO, TUC)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={origenSucursalCode}
                      onChange={(e) => setOrigenSucursalCode(e.target.value.toUpperCase())}
                      placeholder="Ej: NEU"
                      maxLength={10}
                      style={{ fontSize: 14, fontWeight: 600, width: 120 }}
                      autoFocus
                    />
                  </div>
                  {sucursalTarifaOptions.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                      Sucursales existentes: {sucursalTarifaOptions.join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-sm" onClick={() => setShowOrigenModal(null)}>Cancelar</button>
                  <button type="button" className="btn-primary" onClick={guardarMapeoOrigen} disabled={!origenSucursalCode.trim()}>
                    Guardar mapeo
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Duplicados detectados */}
          {duplicados.length > 0 && (
            <div className="dashboard-card" style={{ marginBottom: 16, border: '2px solid #dc2626' }}>
              <header className="card-header" style={{ background: '#fee2e2' }}>
                <h3 style={{ color: '#991b1b' }}>Operaciones duplicadas ({duplicados.length})</h3>
              </header>
              <div className="card-body">
                <p style={{ fontSize: 12, color: '#991b1b', marginBottom: 12 }}>
                  Se detectaron operaciones que ya existen en liquidaciones anteriores. Resolvé cada caso antes de continuar.
                </p>

                {/* Botones masivos */}
                {duplicados.length > 3 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {(() => { const exactos = duplicados.filter(d => d.diferencia === 0); return exactos.length > 0 ? (
                      <button type="button" className="btn-sm" style={{ background: '#dcfce7', border: '1px solid #16a34a', color: '#166534' }} onClick={() => resolverDuplicadosMasivo('ignorar', d => d.diferencia === 0)} disabled={duplicadosLoading}>
                        Ignorar todos los exactos ({exactos.length})
                      </button>
                    ) : null; })()}
                    {(() => { const noPagados = duplicados.filter(d => d.diferencia !== 0 && d.existente?.estado !== 'pagada'); return noPagados.length > 0 ? (
                      <button type="button" className="btn-sm" style={{ background: '#dbeafe', border: '1px solid #2563eb', color: '#1e40af' }} onClick={() => resolverDuplicadosMasivo('actualizar', d => d.diferencia !== 0 && d.existente?.estado !== 'pagada')} disabled={duplicadosLoading}>
                        Actualizar todos no pagados ({noPagados.length})
                      </button>
                    ) : null; })()}
                  </div>
                )}

                <div style={{ overflowX: 'auto' }}>
                  <table className="table-sm" style={{ width: '100%', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>ID Op.</th>
                        <th>Distribuidor</th>
                        <th style={{ textAlign: 'right' }}>Imp. previo</th>
                        <th style={{ textAlign: 'right' }}>Imp. nuevo</th>
                        <th style={{ textAlign: 'right' }}>Diferencia</th>
                        <th>Estado previo</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {duplicados.map((d) => (
                        <tr key={d.id} style={{ background: d.diferencia === 0 ? '#f0fdf4' : '#fef9c3' }}>
                          <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{d.id_operacion_cliente}</td>
                          <td style={{ fontSize: 11 }}>{d.distribuidor ?? d.dominio ?? '—'}</td>
                          <td style={{ textAlign: 'right' }}>{d.existente ? `$${Number(d.existente.importe).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}</td>
                          <td style={{ textAlign: 'right' }}>${Number(d.importe_nuevo).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: d.diferencia === 0 ? '#16a34a' : '#d97706' }}>
                            {d.diferencia === 0 ? '$0' : `${d.diferencia > 0 ? '+' : ''}$${Number(d.diferencia).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                          </td>
                          <td style={{ fontSize: 11 }}>{d.existente?.estado ?? '—'}</td>
                          <td style={{ display: 'flex', gap: 4 }}>
                            {d.diferencia === 0 ? (
                              <button type="button" className="btn-sm" style={{ background: '#dcfce7', fontSize: 10 }} onClick={() => resolverDuplicadoUno(d.id, 'ignorar')}>Ignorar</button>
                            ) : (
                              <>
                                <button type="button" className="btn-sm" style={{ background: '#dbeafe', fontSize: 10 }} onClick={() => resolverDuplicadoUno(d.id, 'actualizar')}>Actualizar</button>
                                <button type="button" className="btn-sm" style={{ background: '#fef3c7', fontSize: 10 }} onClick={() => resolverDuplicadoUno(d.id, 'ajuste')}>Ajuste</button>
                                <button type="button" className="btn-sm" style={{ background: '#f3f4f6', fontSize: 10 }} onClick={() => resolverDuplicadoUno(d.id, 'ignorar')}>Ignorar</button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* OCA Vinculaciones */}
          {isOcaClient && (ocaResumen || ocaVinculaciones.length > 0) && (
            <div className="dashboard-card" style={{ marginBottom: 16 }}>
              <header className="card-header">
                <h3>Vinculaciones OCA (subset-sum)</h3>
              </header>
              <div className="card-body">
                {/* Resumen OCA */}
                {ocaResumen && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                      {ocaResumen.por_estado.map((e) => (
                        <div key={e.estado} style={{ padding: '6px 14px', borderRadius: 8, background: ESTADO_OCA_COLOR[e.estado as keyof typeof ESTADO_OCA_COLOR] ?? '#6b7280', color: '#fff', fontSize: 13, fontWeight: 600 }}>
                          {ESTADO_OCA_LABELS[e.estado as keyof typeof ESTADO_OCA_LABELS] ?? e.estado}: {e.cantidad} planillas (${Number(e.total_importe).toLocaleString('es-AR', { minimumFractionDigits: 2 })})
                        </div>
                      ))}
                    </div>

                    {/* Por distribuidor */}
                    {ocaResumen.por_distribuidor.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Por distribuidor</h4>
                        <table className="table-sm" style={{ width: '100%', fontSize: 12 }}>
                          <thead>
                            <tr><th>Distribuidor</th><th style={{ textAlign: 'right' }}>Planillas</th><th style={{ textAlign: 'right' }}>Cantidad</th><th style={{ textAlign: 'right' }}>Importe</th></tr>
                          </thead>
                          <tbody>
                            {ocaResumen.por_distribuidor.map((d, i) => (
                              <tr key={i}>
                                <td>{d.distribuidor_nombre}</td>
                                <td style={{ textAlign: 'right' }}>{d.planillas}</td>
                                <td style={{ textAlign: 'right' }}>{Number(d.total_qty).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</td>
                                <td style={{ textAlign: 'right' }}>${Number(d.total_importe).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tabla de vinculaciones */}
                {ocaVinculaciones.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Detalle planillas</h4>
                      <select
                        className="form-input"
                        value={ocaVincFiltro}
                        onChange={(e) => {
                          setOcaVincFiltro(e.target.value);
                          if (selectedLiq) loadOcaVinculaciones(selectedLiq.id, 1, e.target.value);
                        }}
                        style={{ width: 160, fontSize: 12 }}
                      >
                        <option value="">Todos los estados</option>
                        <option value="EXACTO">Exacto</option>
                        <option value="APROXIMADO">Aproximado</option>
                        <option value="SIN_ASIGNAR">Sin asignar</option>
                      </select>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="table-sm" style={{ width: '100%', fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Planilla</th>
                            <th>Contrato</th>
                            <th>Descripcion</th>
                            <th style={{ textAlign: 'right' }}>Cantidad</th>
                            <th style={{ textAlign: 'right' }}>Precio orig.</th>
                            <th style={{ textAlign: 'right' }}>Importe</th>
                            <th>Distribuidor</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ocaVinculaciones.map((v) => (
                            <tr key={v.id}>
                              <td>{v.fecha}</td>
                              <td>{v.nro_planilla}</td>
                              <td>{v.cod_contrato}</td>
                              <td>{v.descripcion ?? '—'}</td>
                              <td style={{ textAlign: 'right' }}>{Number(v.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</td>
                              <td style={{ textAlign: 'right' }}>${Number(v.precio_original).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                              <td style={{ textAlign: 'right' }}>${Number(v.importe_original).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                              <td>{v.distribuidor_nombre ?? '—'}</td>
                              <td>
                                <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: (ESTADO_OCA_COLOR[v.estado] ?? '#6b7280') + '18', color: ESTADO_OCA_COLOR[v.estado] ?? '#6b7280' }}>
                                  {ESTADO_OCA_LABELS[v.estado] ?? v.estado}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Paginación */}
                    {ocaVincPage.last > 1 && (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8, fontSize: 12 }}>
                        <button type="button" className="btn-sm" disabled={ocaVincPage.current <= 1} onClick={() => selectedLiq && loadOcaVinculaciones(selectedLiq.id, ocaVincPage.current - 1, ocaVincFiltro)}>Anterior</button>
                        <span>Página {ocaVincPage.current} de {ocaVincPage.last}</span>
                        <button type="button" className="btn-sm" disabled={ocaVincPage.current >= ocaVincPage.last} onClick={() => selectedLiq && loadOcaVinculaciones(selectedLiq.id, ocaVincPage.current + 1, ocaVincFiltro)}>Siguiente</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OCA Tarifas Detectadas */}
          {isOcaClient && ocaTarifas.length > 0 && (
            <div className="dashboard-card" style={{ marginBottom: 16 }}>
              <header className="card-header"><h3>Tarifas Detectadas</h3></header>
              <div className="card-body">
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-sm" style={{ width: '100%', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Sucursal</th>
                        <th>Contrato</th>
                        <th>Distribuidor (PDF)</th>
                        <th>Proveedor</th>
                        <th style={{ textAlign: 'right' }}>Tarifa OCA</th>
                        <th style={{ textAlign: 'right' }}>Tarifa Distrib.</th>
                        <th style={{ textAlign: 'right' }}>Planillas</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ocaTarifas.map((t, i) => (
                        <tr key={i} style={{ background: ESTADO_TARIFA_COLOR[t.estado] }}>
                          <td>{t.sucursal}</td>
                          <td>{t.cod_contrato}</td>
                          <td style={{ fontSize: 11 }}>{t.distribuidor_nombre ?? '—'}</td>
                          <td style={{ fontSize: 11 }}>{t.proveedor_nombre ? <span title={t.proveedor_patente ?? ''}>{t.proveedor_nombre}</span> : <span style={{ color: '#dc2626', fontWeight: 600 }}>Sin vincular</span>}</td>
                          <td style={{ textAlign: 'right' }}>${t.precio_recibido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right' }}>{t.precio_distribuidor != null ? `$${t.precio_distribuidor.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : <span style={{ color: '#9ca3af' }}>—</span>}</td>
                          <td style={{ textAlign: 'right' }}>{t.cant_planillas}</td>
                          <td>
                            <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                              {ESTADO_TARIFA_LABEL[t.estado]}
                            </span>
                          </td>
                          <td>
                            <button type="button" className="btn-sm btn-primary" onClick={() => {
                              setOcaMapeo(t);
                              setOcaMapeoModo('fijo');
                              setOcaMapeoValor(t.precio_distribuidor != null ? String(t.precio_distribuidor) : '');
                              setOcaMapeoPersonaId(t.distribuidor_id);
                              setOcaMapeoPersonaLabel(t.proveedor_nombre ?? '');
                              setOcaPersonasSearch('');
                              setOcaPersonasResults([]);
                            }}>
                              Mapear
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={generarOperacionesOca}
                    disabled={ocaTarifas.some(t => t.estado === 'nueva' || t.estado === 'sin_vincular')}
                  >
                    Generar operaciones con tarifa
                  </button>
                  {ocaTarifas.some(t => t.estado === 'nueva' || t.estado === 'sin_vincular') && (
                    <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                      Hay tarifas sin mapear o distribuidores sin vincular.
                    </span>
                  )}
                  {!ocaTarifas.some(t => t.estado === 'nueva' || t.estado === 'sin_vincular') && ocaTarifas.length > 0 && (
                    <span style={{ fontSize: 12, color: '#16a34a' }}>
                      Todas las tarifas mapeadas. Listo para generar operaciones.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Modal Mapeo OCA */}
          {ocaMapeo && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 520, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Mapear Tarifa — {ocaMapeo.sucursal} / {ocaMapeo.cod_contrato}</h3>

                {/* Sección A: Tarifa OCA */}
                <div style={{ marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>Tarifa Original (OCA)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                    <div>Tarifa recibida (PDF):</div>
                    <div style={{ fontWeight: 600 }}>${ocaMapeo.precio_recibido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                    <div>Tarifa registrada:</div>
                    <div>{ocaMapeo.tarifa_registrada != null ? `$${ocaMapeo.tarifa_registrada.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : <span style={{ color: '#d97706' }}>Sin registro</span>}</div>
                    <div>Planillas afectadas:</div>
                    <div>{ocaMapeo.cant_planillas}</div>
                  </div>
                </div>

                {/* Sección B: Tarifa Distribuidor */}
                <div style={{ marginBottom: 16, padding: 12, background: '#f0f9ff', borderRadius: 8 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>Tarifa Distribuidor</h4>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                      <input type="radio" checked={ocaMapeoModo === 'fijo'} onChange={() => { setOcaMapeoModo('fijo'); setOcaMapeoValor(ocaMapeo.precio_distribuidor != null ? String(ocaMapeo.precio_distribuidor) : ''); }} />
                      Valor fijo
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                      <input type="radio" checked={ocaMapeoModo === 'porcentaje'} onChange={() => { setOcaMapeoModo('porcentaje'); setOcaMapeoValor(''); }} />
                      Porcentaje descuento
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'center', fontSize: 13 }}>
                    {ocaMapeoModo === 'fijo' ? (
                      <>
                        <div>Precio distribuidor:</div>
                        <input type="text" inputMode="decimal" className="form-input" value={ocaMapeoValor} onChange={(e) => setOcaMapeoValor(e.target.value)} placeholder="Ej: 1800" style={{ fontSize: 13 }} />
                        <div>% Agencia (calc.):</div>
                        <div style={{ color: '#6b7280' }}>
                          {(() => {
                            const v = parseFloat(ocaMapeoValor.replace(',', '.'));
                            return v > 0 ? `${((1 - v / ocaMapeo.precio_recibido) * 100).toFixed(2)}%` : '—';
                          })()}
                        </div>
                      </>
                    ) : (
                      <>
                        <div>Descuento %:</div>
                        <input type="text" inputMode="decimal" className="form-input" value={ocaMapeoValor} onChange={(e) => setOcaMapeoValor(e.target.value)} placeholder="Ej: 17" style={{ fontSize: 13 }} />
                        <div>Precio distribuidor (calc.):</div>
                        <div style={{ fontWeight: 600 }}>
                          {(() => {
                            const pct = parseFloat(ocaMapeoValor.replace(',', '.'));
                            return pct > 0 ? `$${(ocaMapeo.precio_recibido * (1 - pct / 100)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—';
                          })()}
                        </div>
                      </>
                    )}
                    <div>Margen por unidad:</div>
                    <div style={{ fontWeight: 600, color: '#16a34a' }}>
                      {(() => {
                        let dist: number;
                        if (ocaMapeoModo === 'fijo') {
                          dist = parseFloat(ocaMapeoValor.replace(',', '.'));
                        } else {
                          const pct = parseFloat(ocaMapeoValor.replace(',', '.'));
                          dist = ocaMapeo.precio_recibido * (1 - (pct || 0) / 100);
                        }
                        return dist > 0 ? `$${(ocaMapeo.precio_recibido - dist).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—';
                      })()}
                    </div>
                  </div>
                </div>

                {/* Sección C: Vincular distribuidor */}
                <div style={{ marginBottom: 16, padding: 12, background: '#fdf2f8', borderRadius: 8 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>Distribuidor Asignado</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, alignItems: 'center' }}>
                    <div>Nombre en PDF:</div>
                    <div style={{ fontWeight: 600 }}>{ocaMapeo.distribuidor_nombre ?? '—'}</div>
                    <div>Proveedor vinculado:</div>
                    <div>
                      {ocaMapeoPersonaId ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, color: '#16a34a' }}>{ocaMapeoPersonaLabel}</span>
                          <button type="button" style={{ fontSize: 10, color: '#dc2626', cursor: 'pointer', border: 'none', background: 'none' }} onClick={() => { setOcaMapeoPersonaId(null); setOcaMapeoPersonaLabel(''); }}>x</button>
                        </div>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            className="form-input"
                            value={ocaPersonasSearch}
                            onChange={(e) => { setOcaPersonasSearch(e.target.value); buscarPersonasOca(e.target.value); }}
                            placeholder="Buscar por nombre, patente, CUIL..."
                            style={{ fontSize: 12, width: '100%' }}
                          />
                          {ocaPersonasResults.length > 0 && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, maxHeight: 200, overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                              {ocaPersonasResults.map((p) => (
                                <div key={p.id} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}
                                  onMouseDown={() => {
                                    setOcaMapeoPersonaId(p.id);
                                    setOcaMapeoPersonaLabel(p.label);
                                    setOcaPersonasSearch('');
                                    setOcaPersonasResults([]);
                                  }}
                                >
                                  <strong>{p.apellidos} {p.nombres}</strong>
                                  {p.patente && <span style={{ color: '#6b7280' }}> — {p.patente}</span>}
                                  {p.cuil && <span style={{ color: '#9ca3af' }}> — {p.cuil}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          {ocaPersonasLoading && <span style={{ fontSize: 10, color: '#6b7280' }}>Buscando...</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-sm" onClick={() => setOcaMapeo(null)}>Cancelar</button>
                  <button type="button" className="btn-primary" onClick={guardarMapeoOca} disabled={ocaMapeoSaving || !ocaMapeoValor}>
                    {ocaMapeoSaving ? 'Guardando...' : 'Guardar mapeo'}
                  </button>
                </div>
              </div>
            </div>
          )}

	          {/* Operations */}
	          <div className="dashboard-card" style={{ marginBottom: 16 }}>
	            <header className="card-header">
	              <h3>Operaciones</h3>
	              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {Object.values(selectedOpIds).some(Boolean) && (
                    <button type="button" className="btn-sm btn-danger" onClick={eliminarOperacionesSeleccionadas} disabled={bulkDeleting}>
                      Eliminar seleccionadas ({Object.values(selectedOpIds).filter(Boolean).length})
                    </button>
                  )}
	                <select className="form-input" style={{ width: 160 }} value={opFiltroEstado} onChange={(e) => {
	                  setOpFiltroEstado(e.target.value);
	                  if (selectedLiq) loadOps(selectedLiq.id, e.target.value, 1);
	                }}>
                  <option value="">Todos los estados</option>
                  {Object.entries(ESTADO_OPERACION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </header>
            <div className="card-body" style={{ overflowX: 'auto' }}>
	              <table className="data-table">
	                <thead>
	                  <tr>
                      <th style={{ width: 34 }}>
                        <input
                          type="checkbox"
                          aria-label="Seleccionar todo"
                          checked={operaciones.length > 0 && operaciones.every((op) => !!selectedOpIds[op.id])}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedOpIds((prev) => {
                              const next = { ...prev };
                              for (const op of operaciones) next[op.id] = checked;
                              return next;
                            });
                          }}
                        />
                      </th>
                      <th>Dominio</th><th>Distribuidor</th><th>Fecha</th><th>Concepto</th><th>Sucursal</th><th>Valor cliente</th>
                      {isOcasaClient && <><th>Modelo</th><th>Fraccion</th></>}
                      <th>Tarifa orig.</th><th>Distribuidor</th><th>Diferencia</th><th>Estado</th><th></th>
                    </tr>
	                </thead>
	                <tbody>
	                  {operaciones.map((op) => (
	                    <tr key={op.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar operación ${op.id}`}
                            checked={!!selectedOpIds[op.id]}
                            onChange={(e) => setSelectedOpIds((prev) => ({ ...prev, [op.id]: e.target.checked }))}
                          />
                        </td>
	                      <td><code>{op.dominio ?? '—'}</code></td>
	                      <td style={{ fontSize: 12 }}>{op.distribuidor ? `${op.distribuidor.apellidos}, ${op.distribuidor.nombres}` : '—'}</td>
	                      <td style={{ fontSize: 12 }}>{(() => { const raw = (op.campos_originales as any)?.fecha ?? (op.campos_originales as any)?.fecha_viaje ?? (op.campos_originales as any)?.FechaViaje; if (!raw) return '—'; const s = String(raw); const dateOnly = s.includes('T') ? s.split('T')[0] : s.slice(0, 10); const parts = dateOnly.split('-'); return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : s; })()}</td>
	                      <td style={{ fontSize: 12 }}>{op.concepto ?? '—'}</td>
	                      <td style={{ fontSize: 12 }}>{op.sucursal_tarifa ?? '—'}</td>
                      <td>{fmt(op.valor_cliente)}</td>
                      {isOcasaClient && (
                        <>
                          <td style={{ fontSize: 11 }}>
                            {op.modelo_tarifa ? (
                              <span style={{ padding: '1px 6px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: op.modelo_tarifa === 'JORNADA' ? '#dbeafe' : op.modelo_tarifa === 'JORNADA_KM' ? '#fef3c7' : '#d1fae5', color: op.modelo_tarifa === 'JORNADA' ? '#1e40af' : op.modelo_tarifa === 'JORNADA_KM' ? '#92400e' : '#065f46' }}>
                                {op.modelo_tarifa === 'JORNADA' ? 'Jornada' : op.modelo_tarifa === 'JORNADA_KM' ? 'J+KM' : 'Prod'}
                              </span>
                            ) : '-'}
                          </td>
                          <td style={{ fontSize: 11, textAlign: 'center' }}>
                            {op.fraccion_jornada ? (() => {
                              const f = parseFloat(op.fraccion_jornada);
                              if (Math.abs(f - 0.25) < 0.01) return '1/4';
                              if (Math.abs(f - 0.5) < 0.01) return '1/2';
                              if (Math.abs(f - 0.75) < 0.01) return '3/4';
                              if (Math.abs(f - 1.0) < 0.01) return '1/1';
                              return `${Math.round(f * 100)}%`;
                            })() : '-'}
                          </td>
                        </>
                      )}
                      <td>{op.valor_tarifa_original ? fmt(op.valor_tarifa_original) : '—'}</td>
                      <td>{op.valor_tarifa_distribuidor ? fmt(op.valor_tarifa_distribuidor) : '—'}</td>
                      <td style={{ color: op.diferencia_cliente && parseFloat(op.diferencia_cliente) !== 0 ? '#d97706' : '#16a34a' }}>
                        {op.diferencia_cliente ? fmt(op.diferencia_cliente) : '—'}
                      </td>
                      <td>
                        <span
                          title={op.observaciones ?? undefined}
                          style={{ padding: '1px 7px', borderRadius: 8, fontSize: 11, background: '#f3f4f6', color: ESTADO_OPERACION_COLOR[op.estado] ?? '#374151', fontWeight: 600 }}
                        >
                          {ESTADO_OPERACION_LABELS[op.estado]}
                          {op.estado === 'sin_tarifa' && op.dimension_fallida ? ` (${op.dimension_fallida})` : ''}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {(op.estado === 'sin_tarifa' || op.estado === 'diferencia') && !op.excluida && (
                          <button type="button" className="btn-sm" style={{ marginRight: 4, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}
                            onClick={() => { setHotMapOp(op); setHotMapValorTarifa(''); setHotMapDim((isOcaClient || isOcasaClient) ? 'fijo' : 'porcentaje'); setHotMapValorCliente(String(op.valor_cliente)); }}>
                            + Mapeo
                          </button>
                        )}
                        {!op.excluida ? (
                          <button type="button" className="btn-sm" style={{ marginRight: 4 }} onClick={() => excluirOperacion(op.id)}>
                            Excluir
                          </button>
                        ) : (
                          <button type="button" className="btn-sm" style={{ marginRight: 4, background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }} onClick={() => incluirOperacion(op.id)}>
                            Incluir
                          </button>
                        )}
                        <button type="button" className="btn-sm btn-danger" onClick={() => eliminarOperacion(op.id)}>
                          Eliminar
                        </button>
                      </td>
	                    </tr>
	                  ))}
	                  {operaciones.length === 0 && <tr><td colSpan={isOcasaClient ? 15 : 13} style={{ textAlign: 'center', color: '#6b7280' }}>Sin operaciones</td></tr>}
	                </tbody>
	              </table>
              {/* Modal de Mapeo Completo (3 secciones) */}
              {hotMapOp && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 540, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Mapear Operación — {hotMapOp.concepto}</h3>

                    {/* Sección 1: Tarifa Original (Cliente) */}
                    <div style={{ marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>Tarifa Original (Cliente)</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
                        <div>Concepto:</div><div style={{ fontWeight: 600 }}>{hotMapOp.concepto ?? '—'}</div>
                        <div>Valor cliente:</div><div><input type="text" inputMode="decimal" className="form-input" value={hotMapValorCliente} onChange={(e) => setHotMapValorCliente(e.target.value)} style={{ fontSize: 13, fontWeight: 600, width: 140 }} /></div>
                        <div>Sucursal:</div><div>{hotMapOp.sucursal_tarifa ?? '—'}</div>
                        <div>Patente:</div><div style={{ fontWeight: 600 }}>{hotMapOp.dominio ?? '—'}</div>
                      </div>
                    </div>

                    {/* Sección 2: Tarifa Distribuidor */}
                    <div style={{ marginBottom: 16, padding: 12, background: '#f0f9ff', borderRadius: 8 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>Tarifa Distribuidor</h4>
                      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                          <input type="radio" checked={hotMapDim === 'fijo'} onChange={() => setHotMapDim('fijo')} /> Valor fijo
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                          <input type="radio" checked={hotMapDim === 'porcentaje'} onChange={() => setHotMapDim('porcentaje')} /> Porcentaje descuento
                        </label>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13, alignItems: 'center' }}>
                        {hotMapDim === 'fijo' ? (
                          <>
                            <div>Precio distribuidor:</div>
                            <input type="text" inputMode="decimal" className="form-input" value={hotMapValorTarifa} onChange={(e) => setHotMapValorTarifa(e.target.value)} placeholder="Ej: 181374" style={{ fontSize: 13 }} />
                            <div>% Agencia (calc.):</div>
                            <div style={{ color: '#6b7280' }}>{(() => { const v = parseFloat(hotMapValorTarifa.replace(',', '.')); const c = parseFloat(hotMapValorCliente.replace(',', '.')) || Number(hotMapOp.valor_cliente); return v > 0 && c > 0 ? `${((1 - v / c) * 100).toFixed(2)}%` : '—'; })()}</div>
                          </>
                        ) : (
                          <>
                            <div>Descuento %:</div>
                            <input type="text" inputMode="decimal" className="form-input" value={hotMapValorTarifa} onChange={(e) => setHotMapValorTarifa(e.target.value)} placeholder="Ej: 15" style={{ fontSize: 13 }} />
                            <div>Precio distrib. (calc.):</div>
                            <div style={{ fontWeight: 600 }}>{(() => { const pct = parseFloat(hotMapValorTarifa.replace(',', '.')); const c = parseFloat(hotMapValorCliente.replace(',', '.')) || Number(hotMapOp.valor_cliente); return pct > 0 && c > 0 ? `$${(c * (1 - pct / 100)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'; })()}</div>
                          </>
                        )}
                        <div>Margen:</div>
                        <div style={{ fontWeight: 600, color: '#16a34a' }}>{(() => {
                          const c = parseFloat(hotMapValorCliente.replace(',', '.')) || Number(hotMapOp.valor_cliente);
                          let d: number;
                          if (hotMapDim === 'fijo') d = parseFloat(hotMapValorTarifa.replace(',', '.'));
                          else { const pct = parseFloat(hotMapValorTarifa.replace(',', '.')); d = c * (1 - (pct || 0) / 100); }
                          return d > 0 ? `$${(c - d).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—';
                        })()}</div>
                      </div>
                    </div>

                    {/* Sección 3: Distribuidor Asignado */}
                    <div style={{ marginBottom: 16, padding: 12, background: '#fdf2f8', borderRadius: 8 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>Distribuidor Asignado</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13, alignItems: 'center' }}>
                        <div>Nombre en archivo:</div>
                        <div style={{ fontWeight: 600 }}>{hotMapOp.distribuidor ? `${hotMapOp.distribuidor.apellidos} ${hotMapOp.distribuidor.nombres}` : (hotMapOp.campos_originales as any)?.conductor ?? (hotMapOp.campos_originales as any)?.nombre ?? '—'}</div>
                        <div>Patente:</div>
                        <div style={{ fontWeight: 600 }}>{hotMapOp.dominio ?? '—'}</div>
                        <div>Proveedor vinculado:</div>
                        <div>
                          {hotMapOp.distribuidor_id ? (
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>{hotMapOp.distribuidor ? `${hotMapOp.distribuidor.apellidos} ${hotMapOp.distribuidor.nombres}` : `ID ${hotMapOp.distribuidor_id}`}</span>
                          ) : (
                            <span style={{ color: '#dc2626' }}>Sin vincular — usar Mapeo de Distribuidores en la sección de arriba</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mapeo de concepto */}
                    <div style={{ marginBottom: 16, padding: 12, background: '#fffbeb', borderRadius: 8 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>Mapeo de Concepto</h4>
                      <div style={{ fontSize: 12, color: '#92400e', marginBottom: 8 }}>Concepto del Excel → dimensión de tarifa en el esquema</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13, alignItems: 'center' }}>
                        <div>Valor en Excel:</div>
                        <div style={{ fontWeight: 600 }}>{hotMapOp.concepto}</div>
                        <div>Dimensión destino:</div>
                        <div>concepto</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button type="button" className="btn-sm" onClick={() => setHotMapOp(null)}>Cancelar</button>
                      <button type="button" className="btn-primary" onClick={() => void guardarHotMapeo()}>Guardar mapeo</button>
                    </div>
                    <p style={{ margin: '8px 0 0 0', fontSize: 11, color: '#6b7280' }}>
                      Después de guardar, usá <strong>Reprocesar</strong> en el archivo para recalcular.
                    </p>
                  </div>
                </div>
              )}
              {opPage.last > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                  <button type="button" className="btn-sm" disabled={opPage.current === 1} onClick={() => { const p = opPage.current - 1; setOpPage((prev) => ({ ...prev, current: p })); if (selectedLiq) loadOps(selectedLiq.id, opFiltroEstado, p); }}>←</button>
                  <span style={{ fontSize: 13, alignSelf: 'center' }}>Página {opPage.current} de {opPage.last}</span>
                  <button type="button" className="btn-sm" disabled={opPage.current === opPage.last} onClick={() => { const p = opPage.current + 1; setOpPage((prev) => ({ ...prev, current: p })); if (selectedLiq) loadOps(selectedLiq.id, opFiltroEstado, p); }}>→</button>
                </div>
              )}
            </div>
          </div>

          {/* Distributor liquidations */}
          <div className="dashboard-card">
            <header className="card-header">
              <h3>Liquidaciones por distribuidor</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn-primary" onClick={generarLiquidaciones}>
                  Generar liquidaciones
                </button>
                <button type="button" className="btn-sm" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }} onClick={() => setShowLiqManualForm(true)}>
                  + Crear manual
                </button>
                {distribuidores.length > 0 && distribuidores.some(d => !d.pdf_path) && (
                  <button type="button" className="btn-primary" style={{ background: '#7c3aed' }} onClick={generarYSubirTodas}>
                    Generar y Subir Todas ({distribuidores.filter(d => d.distribuidor_id && !d.pdf_path).length})
                  </button>
                )}
              </div>
            </header>
            <div className="card-body">
              <table className="data-table">
                <thead>
                  <tr><th>Distribuidor</th><th>Patente</th><th>Alta</th><th>Baja</th><th>Operaciones</th><th>Subtotal</th><th>Gastos</th><th>Total a pagar</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {distribuidores.map((d) => (
                    <tr key={d.id}>
                      <td><strong>{d.distribuidor ? `${d.distribuidor.apellidos}, ${d.distribuidor.nombres}` : `ID ${d.distribuidor_id}`}</strong></td>
                      <td><code>{d.distribuidor?.patente ?? '—'}</code></td>
                      <td style={{ fontSize: 12 }}>{d.distribuidor?.fecha_alta ? new Date(d.distribuidor.fecha_alta).toLocaleDateString('es-AR') : '—'}</td>
                      <td style={{ fontSize: 12, color: d.distribuidor?.fecha_baja ? '#dc2626' : undefined }}>{d.distribuidor?.fecha_baja ? new Date(d.distribuidor.fecha_baja).toLocaleDateString('es-AR') : '—'}</td>
                      <td>{d.cantidad_operaciones}</td>
                      <td>{fmt(d.subtotal)}</td>
                      <td style={{ color: '#dc2626' }}>{fmt(d.gastos_administrativos)}</td>
                      <td><strong>{fmt(d.total_a_pagar)}</strong></td>
                      <td style={{ fontSize: 12 }}>{d.estado}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap', display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn-sm"
                          style={{ background: '#f3f4f6' }}
                          onClick={() => void generarPdf(d.id)}
                          disabled={pdfGenerating[d.id]}
                        >
                          {pdfGenerating[d.id] ? 'Generando…' : d.pdf_path ? 'Regenerar y Subir' : 'Generar y Subir PDF'}
                        </button>
                        {d.pdf_path && (
                          <a
                            href={`${resolveApiBaseUrl()}/api/liq/liquidaciones-distribuidor/${d.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-sm btn-primary"
                            style={{ textDecoration: 'none' }}
                          >
                            Ver PDF
                          </a>
                        )}
                        <button type="button" className="btn-sm btn-primary" onClick={() => navigate(`/liquidaciones/${d.distribuidor_id}`)}>
                          Ir a proveedor
                        </button>
                      </td>
                    </tr>
                  ))}
                  {distribuidores.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', color: '#6b7280' }}>Sin liquidaciones generadas aun</td></tr>}
                </tbody>
              </table>

              {/* Feature D: Modal liquidacion manual */}
              {showLiqManualForm && (
                <div style={{ marginTop: 16, padding: 20, background: '#fffbeb', borderRadius: 8, border: '1px solid #fcd34d' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h4 style={{ margin: 0, color: '#92400e' }}>Crear liquidacion manual</h4>
                    <button type="button" className="btn-sm" onClick={() => setShowLiqManualForm(false)}>Cerrar</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Distribuidor</label>
                      <input type="text" className="form-input" placeholder="Buscar por nombre, patente o CUIL..." value={liqManualDistribSearch}
                        onChange={e => buscarDistribLiqManual(e.target.value)} style={{ width: '100%' }} />
                      {liqManualDistribResults.length > 0 && (
                        <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, maxHeight: 150, overflowY: 'auto', marginTop: 4 }}>
                          {liqManualDistribResults.map(p => (
                            <div key={p.id} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f3f4f6', background: liqManualDistribId === p.id ? '#fef3c7' : undefined }}
                              onClick={() => { setLiqManualDistribId(p.id); setLiqManualDistribSearch(p.label); setLiqManualDistribResults([]); }}>
                              {p.label}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Referencia externa</label>
                      <input type="text" className="form-input" placeholder="Nro liq, factura, etc." value={liqManualRefExterna}
                        onChange={e => setLiqManualRefExterna(e.target.value)} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Observaciones</label>
                      <input type="text" className="form-input" placeholder="Motivo de carga manual" value={liqManualObs}
                        onChange={e => setLiqManualObs(e.target.value)} style={{ width: '100%' }} />
                    </div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Lineas de detalle</div>
                  <table className="data-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Concepto</th>
                        <th>Descripcion</th>
                        <th style={{ width: 90 }}>Cantidad</th>
                        <th style={{ width: 120 }}>Tarifa unit.</th>
                        <th style={{ width: 120, textAlign: 'right' }}>Total</th>
                        <th style={{ width: 60 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {liqManualLineas.map((linea, idx) => {
                        const cant = parseFloat(linea.cantidad.replace(/\./g, '').replace(',', '.')) || 0;
                        const tarifa = parseFloat(linea.tarifa.replace(/\./g, '').replace(',', '.')) || 0;
                        const total = cant * tarifa;
                        return (
                          <tr key={idx}>
                            <td><input type="text" className="form-input" style={{ fontSize: 11, width: '100%' }} value={linea.concepto} placeholder="Ej: Transporte" onChange={e => { const l = [...liqManualLineas]; l[idx].concepto = e.target.value; setLiqManualLineas(l); }} /></td>
                            <td><input type="text" className="form-input" style={{ fontSize: 11, width: '100%' }} value={linea.descripcion} onChange={e => { const l = [...liqManualLineas]; l[idx].descripcion = e.target.value; setLiqManualLineas(l); }} /></td>
                            <td><input type="text" inputMode="decimal" className="form-input" style={{ fontSize: 11, width: '100%' }} value={linea.cantidad} onChange={e => { const l = [...liqManualLineas]; l[idx].cantidad = e.target.value; setLiqManualLineas(l); }} /></td>
                            <td><input type="text" inputMode="decimal" className="form-input" style={{ fontSize: 11, width: '100%' }} value={linea.tarifa} onChange={e => { const l = [...liqManualLineas]; l[idx].tarifa = e.target.value; setLiqManualLineas(l); }} /></td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{total > 0 ? `$ ${total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}` : '-'}</td>
                            <td>
                              <button type="button" className="btn-sm" style={{ fontSize: 10, marginRight: 2 }} onClick={() => { const l = [...liqManualLineas]; l.splice(idx + 1, 0, { ...linea }); setLiqManualLineas(l); }}>Dup</button>
                              {liqManualLineas.length > 1 && <button type="button" className="btn-sm btn-danger" style={{ fontSize: 10 }} onClick={() => { const l = [...liqManualLineas]; l.splice(idx, 1); setLiqManualLineas(l); }}>X</button>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600 }}>Total:</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                          $ {liqManualLineas.reduce((sum, l) => {
                            const c = parseFloat(l.cantidad.replace(/\./g, '').replace(',', '.')) || 0;
                            const t = parseFloat(l.tarifa.replace(/\./g, '').replace(',', '.')) || 0;
                            return sum + c * t;
                          }, 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <button type="button" className="btn-sm" onClick={() => setLiqManualLineas(prev => [...prev, { concepto: '', descripcion: '', cantidad: '1', tarifa: '' }])}>
                      + Agregar linea
                    </button>
                    <button type="button" className="btn-primary" onClick={guardarLiqManual} disabled={liqManualSaving || !liqManualDistribId}>
                      {liqManualSaving ? 'Creando...' : 'Crear liquidacion manual'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
