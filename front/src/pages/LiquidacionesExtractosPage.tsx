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
} from '../features/liquidaciones/types';
import {
  ESTADO_OPERACION_LABELS,
  ESTADO_OPERACION_COLOR,
  ESTADO_LIQ_LABELS,
  ESTADO_OCA_LABELS,
  ESTADO_OCA_COLOR,
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

  // OCA state
  const [ocaMainPdf, setOcaMainPdf] = useState<File | null>(null);
  const [ocaDistribPdfs, setOcaDistribPdfs] = useState<File[]>([]);
  const [ocaSucursal, setOcaSucursal] = useState('');
  const [ocaVinculaciones, setOcaVinculaciones] = useState<LiqVinculacionOca[]>([]);
  const [ocaResumen, setOcaResumen] = useState<OcaResumen | null>(null);
  const [ocaHealth, setOcaHealth] = useState<boolean | null>(null);
  const [ocaVincPage, setOcaVincPage] = useState<{ current: number; last: number }>({ current: 1, last: 1 });
  const [ocaVincFiltro, setOcaVincFiltro] = useState('');

  // OCA: detectar si el cliente seleccionado es OCA (formato PDF_DUAL)
  const isOcaClient = useMemo(() => {
    if (!selectedLiq) return false;
    const cfg = clientes.find((c) => c.id === selectedLiq.cliente_id)?.configuracion_excel;
    return (cfg as any)?.formato_entrada === 'PDF_DUAL';
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
        checkOcaHealth().catch(() => {});
      } else {
        setOcaVinculaciones([]);
        setOcaResumen(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando detalle');
    }
  }, [api, clientes, loadOcaVinculaciones, loadOcaResumen, checkOcaHealth]);

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
    try {
      const fd = new FormData();
      fd.append('liquidacion_cliente_id', String(selectedLiq.id));
      fd.append('sucursal', ocaSucursal);
      fd.append('main_pdf', ocaMainPdf);
      for (const pdf of ocaDistribPdfs) {
        fd.append('distrib_pdfs[]', pdf);
      }
      const res = await api.postForm('/oca/upload', fd);
      setOcaMainPdf(null);
      setOcaDistribPdfs([]);
      showSuccess(
        `OCA procesado: ${res.data?.total_planillas ?? 0} planillas, ` +
        `${res.data?.total_distribuidores ?? 0} distribuidores, ` +
        `${res.data?.exactos ?? 0} exactos`
      );
      await openLiq(selectedLiq);
      await loadOcaVinculaciones(selectedLiq.id);
      await loadOcaResumen(selectedLiq.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error procesando PDFs OCA');
    } finally {
      setUploading(false);
    }
  }, [api, ocaMainPdf, ocaDistribPdfs, selectedLiq, ocaSucursal, openLiq, loadOcaVinculaciones, loadOcaResumen]);

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
    const valorTarifa = hotMapValorTarifa.trim();
    const dim = hotMapDim.trim();
    if (!concepto) { setError('El concepto no puede ser vacío'); return; }
    if (!valorTarifa) { setError('El valor tarifa es obligatorio'); return; }
    if (!dim) { setError('La dimensión es obligatoria'); return; }
    try {
      await api.post(`/clientes/${selectedLiq.cliente_id}/mapeos-concepto`, {
        mapeos: [{ valor_excel: concepto, dimension_destino: dim, valor_tarifa: valorTarifa }],
      });
      setHotMapOp(null);
      setHotMapValorTarifa('');
      showSuccess('Mapeo guardado. Reprocesá el archivo para aplicarlo.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando mapeo');
    }
  }, [api, selectedLiq, hotMapOp, hotMapValorTarifa, hotMapDim]);

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

              {/* Sin distribuidor agrupado */}
              {auditoria.sin_distribuidor_agrupado.length > 0 && (
                <div className="dashboard-card">
                  <header className="card-header" style={{ cursor: 'pointer' }} onClick={() => toggleSeccion('sinDistrib')}>
                    <h3 style={{ color: '#7c3aed' }}>{auditoriaSecciones['sinDistrib'] ? '▾' : '▸'} Sin distribuidor ({auditoria.sin_distribuidor_agrupado.reduce((s, x) => s + x.cantidad, 0)} ops · {auditoria.sin_distribuidor_agrupado.length} patentes únicas)</h3>
                  </header>
                  {auditoriaSecciones['sinDistrib'] && (
                    <div className="card-body">
                      <table className="data-table">
                        <thead><tr><th>Dominio / Patente</th><th>Cantidad</th><th>Total cliente</th></tr></thead>
                        <tbody>
                          {auditoria.sin_distribuidor_agrupado.map((s, i) => (
                            <tr key={i}>
                              <td><code>{s.dominio ?? '—'}</code></td>
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
                      El motor Python no está disponible. Inicialo con: cd python && uvicorn app.main:app --port 8100
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
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
                      <option value="">—</option>
                      {uploadTipoOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', minWidth: 220 }}>
                    Soporta Excel y PDF. Para PDF, el cliente debe tener configurado `pdf_operacion_regex`.
                  </div>
                  <button type="button" className="btn-primary" onClick={subirArchivo} disabled={!uploadFile || uploading}>
                    {uploading ? 'Procesando…' : 'Subir y procesar'}
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
                      <th>Dominio</th><th>Distribuidor</th><th>Alta</th><th>Baja</th><th>Concepto</th><th>Sucursal</th><th>Valor cliente</th><th>Tarifa orig.</th><th>Distribuidor</th><th>Diferencia</th><th>Estado</th><th></th>
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
	                      <td style={{ fontSize: 12 }}>{op.distribuidor?.fecha_alta ? new Date(op.distribuidor.fecha_alta).toLocaleDateString('es-AR') : '—'}</td>
	                      <td style={{ fontSize: 12, color: op.distribuidor?.fecha_baja ? '#dc2626' : undefined }}>{op.distribuidor?.fecha_baja ? new Date(op.distribuidor.fecha_baja).toLocaleDateString('es-AR') : '—'}</td>
	                      <td style={{ fontSize: 12 }}>{op.concepto ?? '—'}</td>
	                      <td style={{ fontSize: 12 }}>{op.sucursal_tarifa ?? '—'}</td>
                      <td>{fmt(op.valor_cliente)}</td>
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
                        {op.estado === 'sin_tarifa' && !op.excluida && (
                          <button type="button" className="btn-sm" style={{ marginRight: 4, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}
                            onClick={() => { setHotMapOp(op); setHotMapValorTarifa(''); setHotMapDim('concepto'); }}>
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
	                  {operaciones.length === 0 && <tr><td colSpan={13} style={{ textAlign: 'center', color: '#6b7280' }}>Sin operaciones</td></tr>}
	                </tbody>
	              </table>
              {hotMapOp && (
                <div style={{ margin: '12px 0', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: 16 }}>
                  <h4 style={{ margin: '0 0 12px 0', color: '#92400e' }}>Crear mapeo para: <code>{hotMapOp.concepto}</code></h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.5fr auto auto', gap: 10, alignItems: 'end' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Valor en Excel (concepto)</label>
                      <input type="text" className="form-input" value={hotMapOp.concepto ?? ''} readOnly style={{ background: '#f3f4f6' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Dimensión destino</label>
                      <input type="text" className="form-input" value={hotMapDim} onChange={(e) => setHotMapDim(e.target.value)} placeholder="concepto" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Valor tarifa (destino)</label>
                      <input type="text" className="form-input" value={hotMapValorTarifa} onChange={(e) => setHotMapValorTarifa(e.target.value)} placeholder="Ej: Ut. Corto AM" autoFocus />
                    </div>
                    <button type="button" className="btn-primary" onClick={() => void guardarHotMapeo()}>
                      Guardar mapeo
                    </button>
                    <button type="button" className="btn-sm" onClick={() => setHotMapOp(null)}>
                      Cancelar
                    </button>
                  </div>
                  <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#92400e' }}>
                    Después de guardar, usá el botón <strong>Reprocesar</strong> en el archivo correspondiente para re-calcular las operaciones con el nuevo mapeo.
                  </p>
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
              <button type="button" className="btn-primary" onClick={generarLiquidaciones}>
                Generar liquidaciones
              </button>
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
                          {pdfGenerating[d.id] ? 'Generando…' : d.pdf_path ? 'Regenerar PDF' : 'Generar PDF'}
                        </button>
                        {d.pdf_path && (
                          <a
                            href={`${resolveApiBaseUrl()}/storage/${d.pdf_path}`}
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
                  {distribuidores.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', color: '#6b7280' }}>Sin liquidaciones generadas aún</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
