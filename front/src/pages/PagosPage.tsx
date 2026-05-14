import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiqApi } from '../features/liquidaciones/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
};

type AuthUser = {
  id: number;
  name: string | null;
  email: string | null;
  role?: string | null;
  token?: string | null;
  permissions?: string[] | null;
};

type Props = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  buildActorHeaders: (user: unknown) => Record<string, string>;
  formatCurrency?: (n: number) => string;
};

type LiqRow = {
  id: number;
  fuente: 'EXTRACTO' | 'LEGACY';
  fuente_id: number | null;
  archivo_id: number | null;
  persona_id: number;
  cliente_nombre: string;
  sucursal: string;
  periodo: string;
  periodo_sort: string;
  distribuidor_nombre: string;
  cobrador_nombre: string | null;
  importe: number;
  enviada: boolean;
  facturado: boolean;
  factura_doc_id: number | null;
  pagado: boolean;
  estado_liquidacion: string;
  estado_pago: string | null;
  op_numero_display: string | null;
  op_id: number | null;
  tiene_op_activa: boolean;
  medio_pago: string | null;
  // Para descargar PDFs
  pdf_url_tipo: string;
  pdf_liq_dist_id?: number;
  pdf_persona_id?: number;
  pdf_archivo_id?: number;
};

type Concepto = {
  id: number;
  nombre: string;
  codigo: string;
  ultimo_numero: number;
  activo: boolean;
};

type ValidacionResult = {
  validas: Array<{
    fuente: string;
    fuente_id: number | null;
    archivo_id: number | null;
    persona_id: number;
    distribuidor_id: number;
    distribuidor_nombre: string;
    beneficiario_tipo: string;
    beneficiario_id: number;
    beneficiario_nombre: string;
    beneficiario_cuil: string;
    beneficiario_cbu: string;
    total_a_pagar: number;
  }>;
  errores: Array<{
    item?: unknown;
    distribuidor_id?: number;
    distribuidor_nombre?: string;
    beneficiario_tipo?: string;
    beneficiario_nombre?: string;
    motivos: string[];
  }>;
};

type OrdenPago = {
  id: number;
  concepto: string | null;
  concepto_codigo: string | null;
  numero: number;
  numero_display: string;
  anio: number;
  mes: number;
  fecha_emision: string | null;
  beneficiario_tipo: string;
  beneficiario_nombre: string;
  total_a_pagar: string | number;
  estado: string;
  agrupacion: string;
  usuario: string | null;
  created_at: string | null;
};

type OpResumen = {
  id: number;
  numero_display: string;
  fecha_emision: string;
  concepto: string;
  anio: number;
  mes: number;
  estado: string;
  agrupacion: string;
  beneficiario: { tipo: string; nombre: string; cuil: string; cbu: string };
  cantidad_liquidaciones: number;
  subtotal: string | number;
  total_descuentos: string | number;
  total_a_pagar: string | number;
  observaciones: string | null;
  usuario: string | null;
  detalles: Array<{
    id: number;
    liquidacion_distribuidor_id: number;
    cliente_nombre: string;
    sucursal: string;
    periodo: string;
    distribuidor_nombre: string;
    cobrador_nombre: string | null;
    subtotal_liquidacion: string | number;
    gastos_admin: string | number;
    descuento_combustible: string | number;
    descuento_paquete: string | number;
    descuento_ajuste: string | number;
    otros_descuentos: string | number;
    detalle_otros_descuentos: string | null;
    importe_final: string | number;
  }>;
};

type PreviewDetalle = {
  liquidacion_id: number;
  cliente_nombre: string;
  sucursal: string;
  periodo: string;
  distribuidor_nombre: string;
  cobrador_nombre: string | null;
  beneficiario_cuil: string;
  beneficiario_cbu: string;
  subtotal_liquidacion: number;
  gastos_admin: number;
  descuento_combustible: number;
  descuento_paquete: number;
  descuento_ajuste: number;
  otros_descuentos: number;
  importe_final: number;
};

type PreviewOrden = {
  numero_display: string;
  concepto: string;
  anio: number;
  mes: number;
  beneficiario_tipo: string;
  beneficiario_nombre: string;
  beneficiario_cuil: string;
  beneficiario_cbu: string;
  subtotal: number;
  total_descuentos: number;
  total_a_pagar: number;
  cantidad_liquidaciones: number;
  detalles: PreviewDetalle[];
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const num = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

const fmtCurrency = (v: number, formatter?: (n: number) => string): string => {
  if (formatter) return formatter(v);
  return v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
};

const ESTADO_PAGO_COLORS: Record<string, string> = {
  BORRADOR: '#6b7280',
  PENDIENTE_PAGO: '#e2a300',
  ENVIADA_BANCO: '#2563eb',
  CONFIRMADA: '#16a34a',
  RECHAZADA: '#dc2626',
  ANULADA: '#9ca3af',
};

const ESTADO_PAGO_LABELS: Record<string, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_PAGO: 'Pendiente',
  ENVIADA_BANCO: 'Enviada',
  CONFIRMADA: 'Confirmada',
  RECHAZADA: 'Rechazada',
  ANULADA: 'Anulada',
};

const ESTADO_LIQ_COLORS: Record<string, string> = {
  generada: '#6b7280',
  aprobada: '#2563eb',
  pagada: '#16a34a',
  anulada: '#9ca3af',
};

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const MEDIOS_PAGO = ['Transferencia', 'Remesa', 'Pago 24', 'Pago 24 David', 'Deposito Bancario', 'Efectivo'];

type Tab = 'liquidaciones' | 'ordenes';
type PagoStep = 'idle' | 'validando' | 'config' | 'preview' | 'creando';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const PagosPage: React.FC<Props> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  buildActorHeaders,
  formatCurrency,
}) => {
  const authUser = useStoredAuthUser();
  const api = useLiqApi({ resolveApiBaseUrl, buildActorHeaders, authUser });
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Tab state ─────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'liquidaciones');

  // ── Liquidaciones state ───────────────────────────────────────────
  const [liquidaciones, setLiquidaciones] = useState<LiqRow[]>([]);
  const [clientesDisponibles, setClientesDisponibles] = useState<string[]>([]);
  const [loadingLiq, setLoadingLiq] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Filtros (inicializados desde query params) ─────────────────────
  const [filtroCliente, setFiltroCliente] = useState(searchParams.get('cliente') || '');
  const [filtroDistribuidor, setFiltroDistribuidor] = useState(searchParams.get('distribuidor') || '');
  const [filtroEstadoPago, setFiltroEstadoPago] = useState(searchParams.get('estadoPago') || '');
  const [filtroMes, setFiltroMes] = useState(searchParams.get('mes') || '');
  const [filtroAnio, setFiltroAnio] = useState(searchParams.get('anio') || String(new Date().getFullYear()));
  const [filtroQuincena, setFiltroQuincena] = useState(searchParams.get('quincena') || '');
  const [filtroFuente, setFiltroFuente] = useState(searchParams.get('fuente') || '');
  const [filtroFacturado, setFiltroFacturado] = useState(searchParams.get('facturado') || '');
  const [filtroPagado, setFiltroPagado] = useState(searchParams.get('pagado') ?? 'NO');
  const [filtroMedioPago, setFiltroMedioPago] = useState(searchParams.get('medio_pago') || '');

  // ── Ordenes state ─────────────────────────────────────────────────
  const [ordenes, setOrdenes] = useState<OrdenPago[]>([]);
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);
  const [filtroConceptoOp, setFiltroConceptoOp] = useState('');
  const [filtroEstadoOp, setFiltroEstadoOp] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // ── Conceptos ─────────────────────────────────────────────────────
  const [conceptos, setConceptos] = useState<Concepto[]>([]);

  // ── Flujo de pago ─────────────────────────────────────────────────
  const [pagoStep, setPagoStep] = useState<PagoStep>('idle');
  const [validacion, setValidacion] = useState<ValidacionResult | null>(null);
  const [pagoConceptoId, setPagoConceptoId] = useState<number>(0);
  const [pagoNumero, setPagoNumero] = useState<number | ''>('');
  const [pagoAgrupacion, setPagoAgrupacion] = useState<'INDIVIDUAL' | 'GLOBAL'>('INDIVIDUAL');
  const [pagoAnio, setPagoAnio] = useState(new Date().getFullYear());
  const [pagoMes, setPagoMes] = useState(new Date().getMonth() + 1);
  const [pagoObs, setPagoObs] = useState('');
  const [pagoError, setPagoError] = useState('');
  const [previewData, setPreviewData] = useState<PreviewOrden[]>([]);
  const [showNuevoConcepto, setShowNuevoConcepto] = useState(false);
  const [nuevoConceptoNombre, setNuevoConceptoNombre] = useState('');
  const [nuevoConceptoCodigo, setNuevoConceptoCodigo] = useState('');

  // ── Detalle de OP ─────────────────────────────────────────────────
  const [opDetalle, setOpDetalle] = useState<OpResumen | null>(null);
  const [showOpDetalle, setShowOpDetalle] = useState(false);

  // ── Mensajes ──────────────────────────────────────────────────────
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ── Fetch liquidaciones ───────────────────────────────────────────
  const fetchLiquidaciones = useCallback(async () => {
    setLoadingLiq(true);
    try {
      const params = new URLSearchParams();
      if (filtroCliente) params.set('cliente_nombre', filtroCliente);
      if (filtroDistribuidor) params.set('distribuidor', filtroDistribuidor);
      if (filtroMes) params.set('mes', filtroMes);
      if (filtroAnio) params.set('anio', filtroAnio);
      if (filtroQuincena) params.set('quincena', filtroQuincena);
      if (filtroFuente) params.set('fuente', filtroFuente);
      if (filtroFacturado) params.set('facturado', filtroFacturado);
      if (filtroPagado) params.set('pagado', filtroPagado);
      if (filtroMedioPago) params.set('medio_pago', filtroMedioPago);
      const qs = params.toString();
      const json = await api.get(`/pagos/liquidaciones-unificado${qs ? '?' + qs : ''}`);
      setLiquidaciones(json.data ?? []);
      if (json.clientes) setClientesDisponibles(json.clientes);
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setLoadingLiq(false);
    }
  }, [api, filtroCliente, filtroDistribuidor, filtroMes, filtroAnio, filtroQuincena, filtroFuente, filtroFacturado, filtroPagado, filtroMedioPago]);

  // ── Fetch ordenes ─────────────────────────────────────────────────
  const fetchOrdenes = useCallback(async () => {
    setLoadingOrdenes(true);
    try {
      const json = await api.get('/pagos/ordenes');
      setOrdenes(json.data ?? []);
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setLoadingOrdenes(false);
    }
  }, [api]);

  // ── Fetch conceptos ───────────────────────────────────────────────
  const fetchConceptos = useCallback(async () => {
    try {
      const json = await api.get('/pagos/conceptos');
      setConceptos(json.data ?? []);
    } catch {
      /* silent */
    }
  }, [api]);

  // ── Sync filtros a URL query params ────────────────────────────────
  useEffect(() => {
    const p = new URLSearchParams();
    if (tab !== 'liquidaciones') p.set('tab', tab);
    if (filtroCliente) p.set('cliente', filtroCliente);
    if (filtroMes) p.set('mes', filtroMes);
    if (filtroAnio && filtroAnio !== String(new Date().getFullYear())) p.set('anio', filtroAnio);
    if (filtroQuincena) p.set('quincena', filtroQuincena);
    if (filtroDistribuidor) p.set('distribuidor', filtroDistribuidor);
    if (filtroFuente) p.set('fuente', filtroFuente);
    if (filtroFacturado) p.set('facturado', filtroFacturado);
    if (filtroPagado && filtroPagado !== 'NO') p.set('pagado', filtroPagado);
    if (filtroEstadoPago) p.set('estadoPago', filtroEstadoPago);
    if (filtroMedioPago) p.set('medio_pago', filtroMedioPago);
    setSearchParams(p, { replace: true });
  }, [tab, filtroCliente, filtroMes, filtroAnio, filtroQuincena, filtroDistribuidor, filtroFuente, filtroFacturado, filtroPagado, filtroEstadoPago, filtroMedioPago, setSearchParams]);

  // ── Initial load ──────────────────────────────────────────────────
  useEffect(() => {
    fetchLiquidaciones();
    fetchConceptos();
  }, [fetchLiquidaciones, fetchConceptos]);

  // ── Crear concepto nuevo inline ───────────────────────────────────
  const handleCrearConcepto = useCallback(async () => {
    if (!nuevoConceptoNombre.trim() || !nuevoConceptoCodigo.trim()) return;
    try {
      const json = await api.post('/pagos/conceptos', {
        nombre: nuevoConceptoNombre.trim(),
        codigo: nuevoConceptoCodigo.trim().toUpperCase(),
      });
      const nuevo = json.data;
      await fetchConceptos();
      setPagoConceptoId(nuevo.id);
      setShowNuevoConcepto(false);
      setNuevoConceptoNombre('');
      setNuevoConceptoCodigo('');
    } catch (e: any) {
      setPagoError(e.message);
    }
  }, [nuevoConceptoNombre, nuevoConceptoCodigo, api, fetchConceptos]);

  useEffect(() => {
    if (tab === 'ordenes') fetchOrdenes();
  }, [tab, fetchOrdenes]);

  // ── Filtrado ──────────────────────────────────────────────────────
  const filteredLiq = useMemo(() => {
    // Los filtros principales ya se aplican en el backend; solo filtros locales rápidos aquí
    let rows = liquidaciones;
    if (filtroEstadoPago === 'SIN_OP') {
      rows = rows.filter((r) => !r.estado_pago);
    } else if (filtroEstadoPago) {
      rows = rows.filter((r) => r.estado_pago === filtroEstadoPago);
    }
    return rows;
  }, [liquidaciones, filtroEstadoPago]);

  const filteredOrdenes = useMemo(() => {
    let rows = ordenes;
    if (filtroConceptoOp) {
      rows = rows.filter((r) => r.concepto === filtroConceptoOp);
    }
    if (filtroEstadoOp) {
      rows = rows.filter((r) => r.estado === filtroEstadoOp);
    }
    return rows;
  }, [ordenes, filtroConceptoOp, filtroEstadoOp]);

  // ── Arbol jerarquico: Concepto > Anio > Mes > OPs ────────────────
  type TreeMes = { mes: number; label: string; ops: OrdenPago[]; total: number };
  type TreeAnio = { anio: number; meses: TreeMes[]; total: number; cantOps: number };
  type TreeConcepto = { concepto: string; anios: TreeAnio[]; total: number; cantOps: number };

  const ordenesTree = useMemo((): TreeConcepto[] => {
    const byConcepto = new Map<string, OrdenPago[]>();
    for (const op of filteredOrdenes) {
      const key = op.concepto ?? 'Sin concepto';
      if (!byConcepto.has(key)) byConcepto.set(key, []);
      byConcepto.get(key)!.push(op);
    }

    const tree: TreeConcepto[] = [];
    for (const [concepto, ops] of Array.from(byConcepto.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const byAnio = new Map<number, OrdenPago[]>();
      for (const op of ops) {
        if (!byAnio.has(op.anio)) byAnio.set(op.anio, []);
        byAnio.get(op.anio)!.push(op);
      }

      const anios: TreeAnio[] = [];
      for (const [anio, opsAnio] of Array.from(byAnio.entries()).sort((a, b) => b[0] - a[0])) {
        const byMes = new Map<number, OrdenPago[]>();
        for (const op of opsAnio) {
          if (!byMes.has(op.mes)) byMes.set(op.mes, []);
          byMes.get(op.mes)!.push(op);
        }

        const meses: TreeMes[] = [];
        for (const [mes, opsMes] of Array.from(byMes.entries()).sort((a, b) => b[0] - a[0])) {
          const sorted = opsMes.sort((a, b) => a.numero - b.numero);
          meses.push({
            mes,
            label: MESES[mes] ?? `Mes ${mes}`,
            ops: sorted,
            total: sorted.reduce((s, o) => s + num(o.total_a_pagar), 0),
          });
        }

        anios.push({
          anio,
          meses,
          total: opsAnio.reduce((s, o) => s + num(o.total_a_pagar), 0),
          cantOps: opsAnio.length,
        });
      }

      tree.push({
        concepto,
        anios,
        total: ops.reduce((s, o) => s + num(o.total_a_pagar), 0),
        cantOps: ops.length,
      });
    }

    return tree;
  }, [filteredOrdenes]);

  const toggleNode = (nodeKey: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) next.delete(nodeKey);
      else next.add(nodeKey);
      return next;
    });
  };

  const expandAll = () => {
    const keys = new Set<string>();
    for (const c of ordenesTree) {
      keys.add(`c:${c.concepto}`);
      for (const a of c.anios) {
        keys.add(`a:${c.concepto}:${a.anio}`);
        for (const m of a.meses) {
          keys.add(`m:${c.concepto}:${a.anio}:${m.mes}`);
        }
      }
    }
    setExpandedNodes(keys);
  };

  const collapseAll = () => setExpandedNodes(new Set());

  // ── Selection helpers ─────────────────────────────────────────────
  const disponibles = useMemo(() => filteredLiq.filter((r) => !r.tiene_op_activa && !r.pagado), [filteredLiq]);

  const rowKey = (r: LiqRow) => `${r.fuente}:${r.id}`;

  const toggleSelect = (r: LiqRow) => {
    const key = rowKey(r);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === disponibles.length && disponibles.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(disponibles.map((r) => rowKey(r))));
    }
  };

  const totalSeleccionado = useMemo(() => {
    return filteredLiq.filter((r) => selectedIds.has(`${r.fuente}:${r.id}`)).reduce((sum, r) => sum + num(r.importe), 0);
  }, [filteredLiq, selectedIds]);

  // ── Flujo PAGAR - Paso 2: Validar ────────────────────────────────
  // Construir items seleccionados para enviar al backend
  const buildSelectedItems = useCallback(() => {
    return filteredLiq
      .filter((r) => selectedIds.has(rowKey(r)))
      .map((r) => ({
        fuente: r.fuente,
        fuente_id: r.fuente_id,
        archivo_id: r.archivo_id,
        persona_id: r.persona_id,
        importe: r.importe,
      }));
  }, [filteredLiq, selectedIds]);

  const handlePagar = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setPagoStep('validando');
    setPagoError('');
    setMsg(null);

    try {
      const items = buildSelectedItems();
      const json: ValidacionResult = await api.post('/pagos/validar-beneficiarios', { items });
      setValidacion(json);

      // Abrir siempre el modal: si hay 0 válidas, el usuario necesita ver la lista de
      // motivos por distribuidor (sin CBU, ya en otra OP, etc.) que se renderiza dentro.
      setPagoStep('config');
      if (conceptos.length > 0 && !pagoConceptoId) {
        setPagoConceptoId(conceptos[0].id);
      }

      if (json.validas.length === 0) {
        const motivosUnicos = Array.from(
          new Set((json.errores ?? []).flatMap((e) => e.motivos ?? []))
        );
        const detalle = motivosUnicos.length > 0 ? ` (${motivosUnicos.join(' · ')})` : '';
        setPagoError(
          `Ninguna de las ${items.length} liquidaciones seleccionadas puede pagarse${detalle}. Revisá el detalle por distribuidor abajo.`
        );
      }
    } catch (e: any) {
      console.error('[handlePagar] validar-beneficiarios fallo', { status: e?.status, data: e?.data, message: e?.message });
      const detalle = e?.status ? ` (HTTP ${e.status})` : '';
      setMsg({ type: 'err', text: `No se pudo iniciar el pago${detalle}: ${e?.message ?? 'error desconocido'}` });
      setPagoError(e?.message ?? '');
      setPagoStep('idle');
    }
  }, [selectedIds, buildSelectedItems, api, conceptos, pagoConceptoId]);

  // ── Fetch proximo numero cuando cambia concepto ───────────────────
  useEffect(() => {
    if (pagoStep !== 'config' || !pagoConceptoId) return;
    (async () => {
      try {
        const json = await api.get(`/pagos/conceptos/${pagoConceptoId}/proximo-numero`);
        setPagoNumero(json.proximo_numero ?? 1);
      } catch {
        /* silent */
      }
    })();
  }, [pagoConceptoId, pagoStep, api]);

  // ── Flujo PAGAR - Paso 4: Ver Preview ──────────────────────────────
  const handleVerPreview = useCallback(async () => {
    if (!validacion || validacion.validas.length === 0 || !pagoConceptoId) return;
    setPagoError('');

    try {
      const json = await api.post('/pagos/preview', {
        concepto_id: pagoConceptoId,
        numero: pagoNumero || null,
        agrupacion: pagoAgrupacion,
        items: validacion.validas.map((v) => ({
          fuente: v.fuente, fuente_id: v.fuente_id, archivo_id: v.archivo_id,
          persona_id: v.persona_id ?? v.distribuidor_id, importe: v.total_a_pagar,
        })),
        anio: pagoAnio,
        mes: pagoMes,
        observaciones: pagoObs || null,
      });

      setPreviewData(json.ordenes_preview ?? []);
      setPagoStep('preview');
    } catch (e: any) {
      setPagoError(e.message);
    }
  }, [validacion, pagoConceptoId, pagoNumero, pagoAgrupacion, pagoAnio, pagoMes, pagoObs, api]);

  // ── Flujo PAGAR - Paso 5: Confirmar / Crear OP ───────────────────
  const handleConfirmarOP = useCallback(async () => {
    if (!validacion || validacion.validas.length === 0) return;
    setPagoStep('creando');
    setPagoError('');

    try {
      const json = await api.post('/pagos/ordenes', {
        concepto_id: pagoConceptoId,
        numero: pagoNumero || null,
        agrupacion: pagoAgrupacion,
        items: validacion.validas.map((v) => ({
          fuente: v.fuente, fuente_id: v.fuente_id, archivo_id: v.archivo_id,
          persona_id: v.persona_id ?? v.distribuidor_id, importe: v.total_a_pagar,
        })),
        anio: pagoAnio,
        mes: pagoMes,
        observaciones: pagoObs || null,
      });

      setMsg({ type: 'ok', text: json.message ?? 'OP(s) creada(s)' });
      setPagoStep('idle');
      setSelectedIds(new Set());
      setValidacion(null);
      fetchLiquidaciones();
      fetchOrdenes();
    } catch (e: any) {
      setPagoError(e.message);
      setPagoStep('config');
    }
  }, [validacion, pagoConceptoId, pagoNumero, pagoAgrupacion, pagoAnio, pagoMes, pagoObs, api, fetchLiquidaciones, fetchOrdenes]);

  // ── Cancelar flujo ────────────────────────────────────────────────
  const cancelarPago = () => {
    setPagoStep('idle');
    setValidacion(null);
    setPreviewData([]);
    setPagoError('');
  };

  // ── Ver detalle de OP ─────────────────────────────────────────────
  const verDetalleOp = useCallback(
    async (opId: number) => {
      try {
        const json = await api.get(`/pagos/ordenes/${opId}/resumen`);
        setOpDetalle(json.data);
        setShowOpDetalle(true);
      } catch (e: any) {
        setMsg({ type: 'err', text: e.message });
      }
    },
    [api]
  );

  // ── Cambiar estado de OP ──────────────────────────────────────────
  const cambiarEstadoOp = useCallback(
    async (opId: number, accion: 'confirmar' | 'anular') => {
      try {
        const json = await api.patch(`/pagos/ordenes/${opId}/estado`, { accion });
        setMsg({ type: 'ok', text: json.message });
        fetchOrdenes();
        if (showOpDetalle && opDetalle?.id === opId) {
          verDetalleOp(opId);
        }
      } catch (e: any) {
        setMsg({ type: 'err', text: e.message });
      }
    },
    [api, fetchOrdenes, showOpDetalle, opDetalle, verDetalleOp]
  );

  // ── Ejecutar pago bancario ────────────────────────────────────────
  const ejecutarPago = useCallback(
    async (opId: number) => {
      try {
        const json = await api.post(`/pagos/ordenes/${opId}/ejecutar-pago`, {});
        setMsg({ type: 'ok', text: `Transferencia: ${json.transferencia?.estado_ws ?? 'procesada'} - ${json.transferencia?.mensaje_respuesta ?? ''}` });
        fetchOrdenes();
        if (showOpDetalle && opDetalle?.id === opId) {
          verDetalleOp(opId);
        }
      } catch (e: any) {
        setMsg({ type: 'err', text: e.message });
      }
    },
    [api, fetchOrdenes, showOpDetalle, opDetalle, verDetalleOp]
  );

  // ── Eliminar OP (solo borrador) ───────────────────────────────────
  const eliminarOp = useCallback(
    async (opId: number) => {
      try {
        await api.delete(`/pagos/ordenes/${opId}`);
        setMsg({ type: 'ok', text: 'OP eliminada' });
        fetchOrdenes();
        fetchLiquidaciones();
        if (showOpDetalle && opDetalle?.id === opId) {
          setShowOpDetalle(false);
          setOpDetalle(null);
        }
      } catch (e: any) {
        setMsg({ type: 'err', text: e.message });
      }
    },
    [api, fetchOrdenes, fetchLiquidaciones, showOpDetalle, opDetalle]
  );

  // ── Descargar PDF ──────────────────────────────────────────────────
  const baseUrlRef = useRef(resolveApiBaseUrl());
  const descargarPdf = useCallback((opId: number, label: string) => {
    const url = `${baseUrlRef.current}/api/liq/pagos/ordenes/${opId}/pdf`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  }, []);

  // ── Escape para cerrar modales ────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showOpDetalle) { setShowOpDetalle(false); setOpDetalle(null); }
        else if (pagoStep !== 'idle') cancelarPago();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showOpDetalle, pagoStep]);

  // ── Render ────────────────────────────────────────────────────────
  const fmt = (v: number) => fmtCurrency(v, formatCurrency);

  return (
    <DashboardLayout title="Pagos" subtitle="Ordenes de pago y transferencias">
      {/* Mensaje global */}
      {msg ? (
        <div className={`pagos-msg pagos-msg--${msg.type}`} onClick={() => setMsg(null)}>
          {msg.text}
        </div>
      ) : null}

      {/* Tabs */}
      <div className="pagos-tabs">
        <button className={`pagos-tab${tab === 'liquidaciones' ? ' pagos-tab--active' : ''}`} onClick={() => setTab('liquidaciones')}>
          Liquidaciones para pagar
        </button>
        <button className={`pagos-tab${tab === 'ordenes' ? ' pagos-tab--active' : ''}`} onClick={() => setTab('ordenes')}>
          Ordenes de pago
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  TAB: Liquidaciones disponibles                               */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {tab === 'liquidaciones' ? (
        <div className="pagos-section">
          {/* Filtros */}
          <div className="filters-bar">
            <div className="filters-grid">
              <div className="filter-field">
                <label>Cliente</label>
                <select value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
                  <option value="">Todos</option>
                  {clientesDisponibles.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label>Mes</label>
                <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
                  <option value="">Todos</option>
                  {MESES.slice(1).map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label>Anio</label>
                <select value={filtroAnio} onChange={(e) => setFiltroAnio(e.target.value)}>
                  <option value="">Todos</option>
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label>Quincena</label>
                <select value={filtroQuincena} onChange={(e) => setFiltroQuincena(e.target.value)}>
                  <option value="">Todas</option>
                  <option value="1Q">1ra Quincena</option>
                  <option value="2Q">2da Quincena</option>
                  <option value="MC">Mes completo</option>
                </select>
              </div>
              <div className="filter-field">
                <label>Distribuidor</label>
                <input type="text" value={filtroDistribuidor} onChange={(e) => setFiltroDistribuidor(e.target.value)} placeholder="Buscar por nombre..." />
              </div>
              <div className="filter-field">
                <label>Fuente</label>
                <select value={filtroFuente} onChange={(e) => setFiltroFuente(e.target.value)}>
                  <option value="">Todas</option>
                  <option value="EXTRACTO">Extracto</option>
                  <option value="LEGACY">Legacy</option>
                </select>
              </div>
              <div className="filter-field">
                <label>Facturado</label>
                <select value={filtroFacturado} onChange={(e) => setFiltroFacturado(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="SI">SI</option>
                  <option value="NO">NO</option>
                </select>
              </div>
              <div className="filter-field">
                <label>Pagado</label>
                <select value={filtroPagado} onChange={(e) => setFiltroPagado(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="SI">SI</option>
                  <option value="NO">NO</option>
                </select>
              </div>
              <div className="filter-field">
                <label>Medio pago</label>
                <select value={filtroMedioPago} onChange={(e) => setFiltroMedioPago(e.target.value)}>
                  <option value="">Todos</option>
                  {MEDIOS_PAGO.map((mp) => (
                    <option key={mp} value={mp}>{mp}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label>Estado pago</label>
                <select value={filtroEstadoPago} onChange={(e) => setFiltroEstadoPago(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="SIN_OP">Sin OP</option>
                  <option value="BORRADOR">Borrador</option>
                  <option value="PENDIENTE_PAGO">Pendiente</option>
                  <option value="CONFIRMADA">Confirmada</option>
                  <option value="RECHAZADA">Rechazada</option>
                </select>
              </div>
            </div>
          </div>

          {/* Barra de acciones */}
          <div className="pagos-actions-bar">
            <div className="pagos-actions-left">
              <span>{filteredLiq.length} liquidaciones</span>
              {selectedIds.size > 0 ? (
                <span className="pagos-selection-badge">
                  {selectedIds.size} seleccionadas &mdash; Total: <strong>{fmt(totalSeleccionado)}</strong>
                </span>
              ) : null}
            </div>
            <div className="pagos-actions-right">
              <a className="pagos-action-btn" href={`${baseUrlRef.current}/api/liq/pagos/liquidaciones/exportar`} target="_blank" rel="noopener noreferrer">
                Exportar CSV
              </a>
              <button className="primary-action" disabled={selectedIds.size === 0 || pagoStep !== 'idle'} onClick={handlePagar}>
                Pagar ({selectedIds.size})
              </button>
            </div>
          </div>

          {/* Tabla de liquidaciones */}
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" checked={disponibles.length > 0 && selectedIds.size === disponibles.length} onChange={toggleSelectAll} />
                  </th>
                  <th>Fuente</th>
                  <th>Cliente</th>
                  <th>Periodo</th>
                  <th>Distribuidor</th>
                  <th style={{ textAlign: 'right' }}>Importe</th>
                  <th>Medio pago</th>
                  <th>Enviada</th>
                  <th>Facturado</th>
                  <th>Pagado</th>
                  <th>Estado Pago</th>
                  <th>OP</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loadingLiq ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: 24 }}>Cargando...</td>
                  </tr>
                ) : filteredLiq.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: 24, color: '#888' }}>No hay liquidaciones</td>
                  </tr>
                ) : (
                  filteredLiq.map((row) => {
                    const key = rowKey(row);
                    const selectable = !row.tiene_op_activa && !row.pagado;
                    return (
                      <tr key={key} className={selectedIds.has(key) ? 'row-selected' : ''}>
                        <td>
                          {selectable ? (
                            <input type="checkbox" checked={selectedIds.has(key)} onChange={() => toggleSelect(row)} />
                          ) : null}
                        </td>
                        <td>
                          <span className={`pagos-fuente-badge pagos-fuente-badge--${row.fuente.toLowerCase()}`}>
                            {row.fuente === 'EXTRACTO' ? 'Extracto' : 'Legacy'}
                          </span>
                        </td>
                        <td>{row.cliente_nombre}</td>
                        <td>{row.periodo}</td>
                        <td>{row.distribuidor_nombre}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(row.importe)}</td>
                        <td style={{ fontSize: '0.8rem' }}>{row.medio_pago ?? <span style={{ color: '#aaa' }}>-</span>}</td>
                        <td>
                          <span className={`pagos-sino pagos-sino--${row.enviada ? 'si' : 'no'}`}>
                            {row.enviada ? 'SI' : 'NO'}
                          </span>
                        </td>
                        <td>
                          <span className={`pagos-sino pagos-sino--${row.facturado ? 'si' : 'no'}`}>
                            {row.facturado ? 'SI' : 'NO'}
                          </span>
                        </td>
                        <td>
                          <span className={`pagos-sino pagos-sino--${row.pagado ? 'si' : 'pagado-no'}`}>
                            {row.pagado ? 'SI' : 'NO'}
                          </span>
                        </td>
                        <td>
                          {row.estado_pago ? (
                            <span className="status-badge" style={{ backgroundColor: ESTADO_PAGO_COLORS[row.estado_pago] ?? '#6b7280' }}>
                              {ESTADO_PAGO_LABELS[row.estado_pago] ?? row.estado_pago}
                            </span>
                          ) : (
                            <span style={{ color: '#aaa' }}>-</span>
                          )}
                        </td>
                        <td>
                          {row.op_id ? (
                            <button className="pagos-link-btn" onClick={() => verDetalleOp(row.op_id!)}>
                              {row.op_numero_display}
                            </button>
                          ) : null}
                        </td>
                        <td>
                          <div className="pagos-actions-cell">
                            {/* Ver Liquidación PDF (inline, no descarga) */}
                            <button
                              className="pagos-action-btn"
                              title="Ver PDF de liquidación"
                              onClick={() => {
                                if (row.pdf_url_tipo === 'extracto' && row.pdf_liq_dist_id) {
                                  window.open(`${baseUrlRef.current}/api/liq/liquidaciones-distribuidor/${row.pdf_liq_dist_id}/pdf`, '_blank');
                                } else if (row.pdf_persona_id && row.pdf_archivo_id) {
                                  window.open(`${baseUrlRef.current}/api/personal/${row.pdf_persona_id}/documentos/${row.pdf_archivo_id}/descargar?inline=1`, '_blank');
                                }
                              }}
                            >
                              Liq
                            </button>
                            {/* Ver Factura del distribuidor */}
                            <button
                              className={`pagos-action-btn${row.facturado ? ' pagos-action-btn--primary' : ''}`}
                              title={row.facturado ? 'Ver factura del distribuidor' : 'El distribuidor aun no subio su factura para este periodo'}
                              disabled={!row.facturado}
                              onClick={() => {
                                const liqParam = row.archivo_id ? `?liquidacion_id=${row.archivo_id}` : '';
                                window.open(`${baseUrlRef.current}/api/liq/pagos/factura-distribuidor/${row.persona_id}${liqParam}`, '_blank');
                              }}
                            >
                              Fac
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  TAB: Ordenes de pago - Vista jerarquica                      */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {tab === 'ordenes' ? (
        <div className="pagos-section">
          {/* Filtros */}
          <div className="filters-bar">
            <div className="filters-grid">
              <div className="filter-field">
                <label>Concepto</label>
                <select value={filtroConceptoOp} onChange={(e) => setFiltroConceptoOp(e.target.value)}>
                  <option value="">Todos</option>
                  {conceptos.map((c) => (
                    <option key={c.id} value={c.nombre}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label>Estado</label>
                <select value={filtroEstadoOp} onChange={(e) => setFiltroEstadoOp(e.target.value)}>
                  <option value="">Todos</option>
                  {Object.entries(ESTADO_PAGO_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Barra de acciones */}
          <div className="pagos-actions-bar">
            <span>{filteredOrdenes.length} ordenes de pago</span>
            <div className="pagos-actions-right">
              <a className="pagos-action-btn" href={`${baseUrlRef.current}/api/liq/pagos/ordenes/exportar`} target="_blank" rel="noopener noreferrer">
                Exportar CSV
              </a>
              <button className="pagos-action-btn" onClick={expandAll}>Expandir todo</button>
              <button className="pagos-action-btn" onClick={collapseAll}>Colapsar todo</button>
            </div>
          </div>

          {/* Arbol jerarquico */}
          {loadingOrdenes ? (
            <div style={{ textAlign: 'center', padding: 24 }}>Cargando...</div>
          ) : ordenesTree.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#888' }}>No hay ordenes de pago</div>
          ) : (
            <div className="op-tree">
              {ordenesTree.map((conceptoNode) => {
                const cKey = `c:${conceptoNode.concepto}`;
                const cExpanded = expandedNodes.has(cKey);

                return (
                  <div key={cKey} className="op-tree__concepto">
                    {/* Nivel 1: Concepto */}
                    <button className="op-tree__header op-tree__header--concepto" onClick={() => toggleNode(cKey)}>
                      <span className="op-tree__chevron">{cExpanded ? '\u25BC' : '\u25B6'}</span>
                      <span className="op-tree__title">{conceptoNode.concepto}</span>
                      <span className="op-tree__badge">{conceptoNode.cantOps} OP{conceptoNode.cantOps !== 1 ? 's' : ''}</span>
                      <span className="op-tree__total">{fmt(conceptoNode.total)}</span>
                    </button>

                    {cExpanded ? (
                      <div className="op-tree__children">
                        {conceptoNode.anios.map((anioNode) => {
                          const aKey = `a:${conceptoNode.concepto}:${anioNode.anio}`;
                          const aExpanded = expandedNodes.has(aKey);

                          return (
                            <div key={aKey} className="op-tree__anio">
                              {/* Nivel 2: Anio */}
                              <button className="op-tree__header op-tree__header--anio" onClick={() => toggleNode(aKey)}>
                                <span className="op-tree__chevron">{aExpanded ? '\u25BC' : '\u25B6'}</span>
                                <span className="op-tree__title">{anioNode.anio}</span>
                                <span className="op-tree__badge">{anioNode.cantOps} OP{anioNode.cantOps !== 1 ? 's' : ''}</span>
                                <span className="op-tree__total">{fmt(anioNode.total)}</span>
                              </button>

                              {aExpanded ? (
                                <div className="op-tree__children">
                                  {anioNode.meses.map((mesNode) => {
                                    const mKey = `m:${conceptoNode.concepto}:${anioNode.anio}:${mesNode.mes}`;
                                    const mExpanded = expandedNodes.has(mKey);

                                    return (
                                      <div key={mKey} className="op-tree__mes">
                                        {/* Nivel 3: Mes */}
                                        <button className="op-tree__header op-tree__header--mes" onClick={() => toggleNode(mKey)}>
                                          <span className="op-tree__chevron">{mExpanded ? '\u25BC' : '\u25B6'}</span>
                                          <span className="op-tree__title">{mesNode.label}</span>
                                          <span className="op-tree__badge">{mesNode.ops.length} OP{mesNode.ops.length !== 1 ? 's' : ''}</span>
                                          <span className="op-tree__total">{fmt(mesNode.total)}</span>
                                        </button>

                                        {/* Nivel 4: OPs del mes */}
                                        {mExpanded ? (
                                          <div className="op-tree__ops">
                                            <table>
                                              <thead>
                                                <tr>
                                                  <th>Numero</th>
                                                  <th>Beneficiario</th>
                                                  <th>Tipo</th>
                                                  <th style={{ textAlign: 'right' }}>Total</th>
                                                  <th>Estado</th>
                                                  <th>Usuario</th>
                                                  <th>Fecha</th>
                                                  <th>Acciones</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {mesNode.ops.map((op) => (
                                                  <tr key={op.id}>
                                                    <td>
                                                      <button className="pagos-link-btn" onClick={() => verDetalleOp(op.id)}>
                                                        {op.numero_display}
                                                      </button>
                                                    </td>
                                                    <td>{op.beneficiario_nombre}</td>
                                                    <td>{op.beneficiario_tipo}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(num(op.total_a_pagar))}</td>
                                                    <td>
                                                      <span className="status-badge" style={{ backgroundColor: ESTADO_PAGO_COLORS[op.estado] ?? '#6b7280' }}>
                                                        {ESTADO_PAGO_LABELS[op.estado] ?? op.estado}
                                                      </span>
                                                    </td>
                                                    <td>{op.usuario}</td>
                                                    <td>{op.created_at}</td>
                                                    <td>
                                                      <div className="pagos-actions-cell">
                                                        <button className="pagos-action-btn" onClick={() => descargarPdf(op.id, op.numero_display)}>PDF</button>
                                                        {op.estado === 'BORRADOR' ? (
                                                          <>
                                                            <button className="pagos-action-btn pagos-action-btn--confirm" onClick={() => cambiarEstadoOp(op.id, 'confirmar')}>Confirmar</button>
                                                            <button className="pagos-action-btn pagos-action-btn--danger" onClick={() => eliminarOp(op.id)}>Eliminar</button>
                                                          </>
                                                        ) : null}
                                                        {op.estado === 'PENDIENTE_PAGO' ? (
                                                          <>
                                                            <button className="pagos-action-btn pagos-action-btn--primary" onClick={() => ejecutarPago(op.id)}>Ejecutar pago</button>
                                                            <button className="pagos-action-btn pagos-action-btn--danger" onClick={() => cambiarEstadoOp(op.id, 'anular')}>Anular</button>
                                                          </>
                                                        ) : null}
                                                        {op.estado === 'RECHAZADA' ? (
                                                          <>
                                                            <button className="pagos-action-btn pagos-action-btn--primary" onClick={() => ejecutarPago(op.id)}>Reintentar</button>
                                                            <button className="pagos-action-btn pagos-action-btn--danger" onClick={() => cambiarEstadoOp(op.id, 'anular')}>Anular</button>
                                                          </>
                                                        ) : null}
                                                      </div>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  Modal: Configuracion de OP (Paso 3)                          */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {pagoStep === 'config' || pagoStep === 'creando' ? (
        <div className="pagos-modal-overlay" onClick={pagoStep === 'creando' ? undefined : cancelarPago}>
          <div className="pagos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pagos-modal__header">
              <h3>Generar Orden de Pago</h3>
              <button className="pagos-modal__close" onClick={cancelarPago}>&times;</button>
            </div>

            <div className="pagos-modal__body">
              {/* Mensaje principal cuando no hay liquidaciones válidas. */}
              {pagoError && validacion && validacion.validas.length === 0 ? (
                <div className="pagos-msg pagos-msg--err" style={{ marginBottom: 12 }}>
                  {pagoError}
                </div>
              ) : null}

              {/* Errores de validacion */}
              {validacion && validacion.errores.length > 0 ? (
                <div className="pagos-validacion-errores">
                  <strong>Liquidaciones excluidas ({validacion.errores.length}):</strong>
                  <ul>
                    {validacion.errores.map((e, i) => (
                      <li key={i}>
                        {e.distribuidor_nombre ?? 'Desconocido'}: {(e.motivos ?? []).join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="pagos-form-grid">
                <div className="pagos-form-field">
                  <label>Concepto</label>
                  {!showNuevoConcepto ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select value={pagoConceptoId} onChange={(e) => setPagoConceptoId(Number(e.target.value))} style={{ flex: 1 }}>
                        <option value={0}>Seleccionar...</option>
                        {conceptos.map((c) => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                      <button type="button" className="pagos-action-btn" onClick={() => setShowNuevoConcepto(true)} title="Crear nuevo concepto">+</button>
                    </div>
                  ) : (
                    <div className="pagos-nuevo-concepto">
                      <input type="text" placeholder="Nombre (ej: Honorarios)" value={nuevoConceptoNombre} onChange={(e) => setNuevoConceptoNombre(e.target.value)} />
                      <input type="text" placeholder="Codigo (ej: HON)" value={nuevoConceptoCodigo} onChange={(e) => setNuevoConceptoCodigo(e.target.value)} maxLength={20} style={{ width: 90 }} />
                      <button type="button" className="pagos-action-btn pagos-action-btn--confirm" onClick={handleCrearConcepto} disabled={!nuevoConceptoNombre.trim() || !nuevoConceptoCodigo.trim()}>Crear</button>
                      <button type="button" className="pagos-action-btn" onClick={() => setShowNuevoConcepto(false)}>X</button>
                    </div>
                  )}
                </div>
                <div className="pagos-form-field">
                  <label>Numero (sugerido)</label>
                  <input type="number" min={1} value={pagoNumero} onChange={(e) => setPagoNumero(e.target.value ? Number(e.target.value) : '')} />
                </div>
                <div className="pagos-form-field">
                  <label>Agrupacion</label>
                  <select value={pagoAgrupacion} onChange={(e) => setPagoAgrupacion(e.target.value as any)}>
                    <option value="INDIVIDUAL">Individual (1 OP por beneficiario)</option>
                    <option value="GLOBAL">Global (1 sola OP)</option>
                  </select>
                </div>
                <div className="pagos-form-field">
                  <label>Anio</label>
                  <input type="number" min={2020} max={2099} value={pagoAnio} onChange={(e) => setPagoAnio(Number(e.target.value))} />
                </div>
                <div className="pagos-form-field">
                  <label>Mes</label>
                  <select value={pagoMes} onChange={(e) => setPagoMes(Number(e.target.value))}>
                    {MESES.slice(1).map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pagos-form-field" style={{ marginTop: 12 }}>
                <label>Observaciones</label>
                <textarea value={pagoObs} onChange={(e) => setPagoObs(e.target.value)} rows={2} placeholder="Notas opcionales..." />
              </div>

              {/* Resumen rapido */}
              {validacion ? (
                <div className="pagos-preview-summary">
                  <div><strong>Liquidaciones validas:</strong> {validacion.validas.length}</div>
                  <div><strong>Total a pagar:</strong> {fmt(validacion.validas.reduce((s, v) => s + v.total_a_pagar, 0))}</div>
                  <div><strong>Beneficiarios:</strong> {new Set(validacion.validas.map((v) => v.beneficiario_id)).size}</div>
                </div>
              ) : null}

              {pagoError ? <div className="pagos-msg pagos-msg--err">{pagoError}</div> : null}
            </div>

            <div className="pagos-modal__footer">
              <button className="secondary-action" onClick={cancelarPago}>Cancelar</button>
              <button
                className="primary-action"
                onClick={handleVerPreview}
                disabled={!pagoConceptoId || !validacion || validacion.validas.length === 0}
                title={
                  !validacion || validacion.validas.length === 0
                    ? 'No hay liquidaciones válidas para incluir en la OP'
                    : undefined
                }
              >
                Ver resumen
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  Modal: Preview / Resumen de OP (Paso 4)                      */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {pagoStep === 'preview' || pagoStep === 'creando' ? (
        <div className="pagos-modal-overlay" onClick={pagoStep === 'creando' ? undefined : () => setPagoStep('config')}>
          <div className="pagos-modal pagos-modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="pagos-modal__header">
              <h3>Resumen — {previewData.length} Orden{previewData.length !== 1 ? 'es' : ''} de Pago</h3>
              <button className="pagos-modal__close" onClick={() => setPagoStep('config')}>&times;</button>
            </div>

            <div className="pagos-modal__body">
              {previewData.map((opPrev, idx) => (
                <div key={idx} className="pagos-preview-op">
                  {/* Cabecera de la OP */}
                  <div className="pagos-preview-op__header">
                    <h4>{opPrev.numero_display}</h4>
                    <span className="pagos-preview-op__meta">
                      {opPrev.concepto} &mdash; {MESES[opPrev.mes]} {opPrev.anio}
                    </span>
                  </div>

                  {/* Datos beneficiario */}
                  <div className="pagos-preview-beneficiario">
                    <div><strong>Beneficiario:</strong> {opPrev.beneficiario_nombre}</div>
                    <div><strong>Tipo:</strong> {opPrev.beneficiario_tipo}</div>
                    <div><strong>CUIL:</strong> {opPrev.beneficiario_cuil}</div>
                    <div><strong>CBU:</strong> {opPrev.beneficiario_cbu}</div>
                  </div>

                  {/* Tabla de detalles */}
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th>Sucursal</th>
                          <th>Periodo</th>
                          <th>Distribuidor</th>
                          <th>Cobrador</th>
                          <th>CUIL Benef.</th>
                          <th>CBU Benef.</th>
                          <th style={{ textAlign: 'right' }}>Subtotal</th>
                          <th style={{ textAlign: 'right' }}>Gastos Adm.</th>
                          <th style={{ textAlign: 'right' }}>Desc. Comb.</th>
                          <th style={{ textAlign: 'right' }}>Desc. Paq.</th>
                          <th style={{ textAlign: 'right' }}>Ajuste</th>
                          <th style={{ textAlign: 'right', fontWeight: 700 }}>Importe Final</th>
                        </tr>
                      </thead>
                      <tbody>
                        {opPrev.detalles.map((d, di) => (
                          <tr key={di}>
                            <td>{d.cliente_nombre}</td>
                            <td>{d.sucursal}</td>
                            <td>{d.periodo}</td>
                            <td>{d.distribuidor_nombre}</td>
                            <td>{d.cobrador_nombre ?? ''}</td>
                            <td style={{ fontSize: '0.8em' }}>{d.beneficiario_cuil}</td>
                            <td style={{ fontSize: '0.8em' }}>{d.beneficiario_cbu}</td>
                            <td style={{ textAlign: 'right' }}>{fmt(d.subtotal_liquidacion)}</td>
                            <td style={{ textAlign: 'right' }}>{fmt(d.gastos_admin)}</td>
                            <td style={{ textAlign: 'right' }}>{d.descuento_combustible ? fmt(d.descuento_combustible) : '-'}</td>
                            <td style={{ textAlign: 'right' }}>{d.descuento_paquete ? fmt(d.descuento_paquete) : '-'}</td>
                            <td style={{ textAlign: 'right' }}>{d.descuento_ajuste ? fmt(d.descuento_ajuste) : '-'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(d.importe_final)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'right', fontWeight: 700 }}>TOTAL</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(opPrev.subtotal)}</td>
                          <td colSpan={4} />
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.05em' }}>{fmt(opPrev.total_a_pagar)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))}

              {/* Errores de validacion */}
              {validacion && validacion.errores.length > 0 ? (
                <div className="pagos-validacion-errores" style={{ marginTop: 16 }}>
                  <strong>Liquidaciones excluidas ({validacion.errores.length}):</strong>
                  <ul>
                    {validacion.errores.map((e, i) => (
                      <li key={i}>
                        {e.distribuidor_nombre ?? 'Desconocido'}: {(e.motivos ?? []).join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {pagoError ? <div className="pagos-msg pagos-msg--err">{pagoError}</div> : null}
            </div>

            <div className="pagos-modal__footer">
              <button className="secondary-action" onClick={() => setPagoStep('config')} disabled={pagoStep === 'creando'}>
                Volver
              </button>
              <button
                className="primary-action"
                onClick={handleConfirmarOP}
                disabled={pagoStep === 'creando'}
              >
                {pagoStep === 'creando' ? 'Creando...' : 'Confirmar y crear OP'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  Modal: Detalle de OP                                         */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {showOpDetalle && opDetalle ? (
        <div className="pagos-modal-overlay" onClick={() => { setShowOpDetalle(false); setOpDetalle(null); }}>
          <div className="pagos-modal pagos-modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="pagos-modal__header">
              <h3>{opDetalle.numero_display}</h3>
              <button className="pagos-modal__close" onClick={() => { setShowOpDetalle(false); setOpDetalle(null); }}>&times;</button>
            </div>

            <div className="pagos-modal__body">
              {/* Cabecera */}
              <div className="pagos-op-header-grid">
                <div><strong>Fecha:</strong> {opDetalle.fecha_emision}</div>
                <div><strong>Concepto:</strong> {opDetalle.concepto}</div>
                <div><strong>Periodo:</strong> {MESES[opDetalle.mes]} {opDetalle.anio}</div>
                <div>
                  <strong>Estado:</strong>{' '}
                  <span className="status-badge" style={{ backgroundColor: ESTADO_PAGO_COLORS[opDetalle.estado] ?? '#6b7280' }}>
                    {ESTADO_PAGO_LABELS[opDetalle.estado] ?? opDetalle.estado}
                  </span>
                </div>
                <div><strong>Beneficiario:</strong> {opDetalle.beneficiario.nombre}</div>
                <div><strong>CUIL:</strong> {opDetalle.beneficiario.cuil}</div>
                <div><strong>CBU:</strong> {opDetalle.beneficiario.cbu}</div>
                <div><strong>Tipo:</strong> {opDetalle.beneficiario.tipo}</div>
              </div>

              {/* Tabla detalle */}
              <div className="table-wrapper" style={{ marginTop: 16 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Sucursal</th>
                      <th>Periodo</th>
                      <th>Distribuidor</th>
                      <th>Cobrador</th>
                      <th style={{ textAlign: 'right' }}>Subtotal</th>
                      <th style={{ textAlign: 'right' }}>Gastos</th>
                      <th style={{ textAlign: 'right' }}>Desc. Comb.</th>
                      <th style={{ textAlign: 'right' }}>Desc. Paq.</th>
                      <th style={{ textAlign: 'right' }}>Ajuste</th>
                      <th style={{ textAlign: 'right' }}>Otros</th>
                      <th style={{ textAlign: 'right', fontWeight: 700 }}>Importe Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opDetalle.detalles.map((d) => (
                      <tr key={d.id}>
                        <td>{d.cliente_nombre}</td>
                        <td>{d.sucursal}</td>
                        <td>{d.periodo}</td>
                        <td>{d.distribuidor_nombre}</td>
                        <td>{d.cobrador_nombre ?? ''}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(num(d.subtotal_liquidacion))}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(num(d.gastos_admin))}</td>
                        <td style={{ textAlign: 'right' }}>{num(d.descuento_combustible) !== 0 ? fmt(num(d.descuento_combustible)) : '-'}</td>
                        <td style={{ textAlign: 'right' }}>{num(d.descuento_paquete) !== 0 ? fmt(num(d.descuento_paquete)) : '-'}</td>
                        <td style={{ textAlign: 'right' }}>{num(d.descuento_ajuste) !== 0 ? fmt(num(d.descuento_ajuste)) : '-'}</td>
                        <td style={{ textAlign: 'right' }}>{num(d.otros_descuentos) !== 0 ? fmt(num(d.otros_descuentos)) : '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(num(d.importe_final))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700 }}>TOTAL</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(num(opDetalle.subtotal))}</td>
                      <td colSpan={5} />
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.05em' }}>{fmt(num(opDetalle.total_a_pagar))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {opDetalle.observaciones ? (
                <div style={{ marginTop: 12 }}>
                  <strong>Observaciones:</strong> {opDetalle.observaciones}
                </div>
              ) : null}
            </div>

            <div className="pagos-modal__footer">
              <button className="pagos-action-btn" onClick={() => descargarPdf(opDetalle.id, opDetalle.numero_display)}>Descargar PDF</button>
              {opDetalle.estado === 'BORRADOR' ? (
                <>
                  <button className="pagos-action-btn pagos-action-btn--confirm" onClick={() => cambiarEstadoOp(opDetalle.id, 'confirmar')}>Confirmar</button>
                  <button className="pagos-action-btn pagos-action-btn--danger" onClick={() => eliminarOp(opDetalle.id)}>Eliminar</button>
                </>
              ) : null}
              {opDetalle.estado === 'PENDIENTE_PAGO' ? (
                <>
                  <button className="pagos-action-btn pagos-action-btn--primary" onClick={() => ejecutarPago(opDetalle.id)}>Ejecutar pago</button>
                  <button className="pagos-action-btn pagos-action-btn--danger" onClick={() => cambiarEstadoOp(opDetalle.id, 'anular')}>Anular</button>
                </>
              ) : null}
              {opDetalle.estado === 'RECHAZADA' ? (
                <>
                  <button className="pagos-action-btn pagos-action-btn--primary" onClick={() => ejecutarPago(opDetalle.id)}>Reintentar pago</button>
                  <button className="pagos-action-btn pagos-action-btn--danger" onClick={() => cambiarEstadoOp(opDetalle.id, 'anular')}>Anular</button>
                </>
              ) : null}
              <button className="secondary-action" onClick={() => { setShowOpDetalle(false); setOpDetalle(null); }}>Cerrar</button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
};
