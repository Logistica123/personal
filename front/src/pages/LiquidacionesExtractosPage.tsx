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
} from '../features/liquidaciones/types';
import {
  ESTADO_OPERACION_LABELS,
  ESTADO_OPERACION_COLOR,
  ESTADO_LIQ_LABELS,
} from '../features/liquidaciones/types';

type Props = {
  DashboardLayout: React.ComponentType<{ title: string; subtitle?: string; children: React.ReactNode }>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => unknown;
  buildActorHeaders: (user: unknown) => Record<string, string>;
};

type Step = 'lista' | 'detalle';

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

  // New liq form
  const [newLiqClienteId, setNewLiqClienteId] = useState('');
  const [newLiqDesde, setNewLiqDesde] = useState('');
  const [newLiqHasta, setNewLiqHasta] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  // Upload form
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSucursal, setUploadSucursal] = useState('');
  const [uploadTipo, setUploadTipo] = useState('');

  const uploadTipoOptions = useMemo(() => {
    // Por defecto mostramos solo los tipos que usamos en el módulo de extractos.
    // Se puede ampliar por cliente vía configuracion_excel.allowed_tipos_archivo.
    const base: Array<{ value: string; label: string }> = [
      { value: 'DATA_CLIENTE', label: 'DATA_CLIENTE' },
      { value: 'DETALLE_SUCURSAL', label: 'DETALLE_SUCURSAL' },
    ];

    const cfg = clientes.find((c) => c.id === selectedLiq?.cliente_id)?.configuracion_excel;
    const extraRaw = (cfg as any)?.allowed_tipos_archivo ?? (cfg as any)?.tipos_archivo ?? [];
    const extra = Array.isArray(extraRaw) ? extraRaw.filter((v) => typeof v === 'string' && v.trim()) as string[] : [];

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
      const [archRes, opRes, distRes, detRes, esqRes] = await Promise.all([
        api.get(`/liquidaciones/${liq.id}/archivos`),
        api.get(`/liquidaciones/${liq.id}/operaciones`),
        api.get(`/liquidaciones/${liq.id}/distribuidores`),
        api.get(`/liquidaciones/${liq.id}`),
        api.get(`/clientes/${liq.cliente_id}/esquemas`),
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando detalle');
    }
  }, [api]);

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
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
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

          {/* Upload file */}
          <div className="dashboard-card" style={{ marginBottom: 16 }}>
            <header className="card-header"><h3>Cargar archivo Excel</h3></header>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Archivo</label>
                  <input type="file" accept=".xlsx,.xls" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
                </div>
                <div>
	                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Sucursal (opcional)</label>
	                  <input type="text" className="form-input" value={uploadSucursal} onChange={(e) => setUploadSucursal(e.target.value)} placeholder="ej: AMBA" style={{ width: 140 }} />
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
                <button type="button" className="btn-primary" onClick={subirArchivo} disabled={!uploadFile || uploading}>
                  {uploading ? 'Procesando…' : 'Subir y procesar'}
                </button>
              </div>
            </div>
          </div>

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
                      <th>Dominio</th><th>Distribuidor</th><th>Concepto</th><th>Sucursal</th><th>Valor cliente</th><th>Tarifa orig.</th><th>Distribuidor</th><th>Diferencia</th><th>Estado</th><th></th>
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
	                      <td style={{ textAlign: 'right' }}>
	                        <button type="button" className="btn-sm btn-danger" onClick={() => eliminarOperacion(op.id)}>
	                          Eliminar
	                        </button>
	                      </td>
	                    </tr>
	                  ))}
	                  {operaciones.length === 0 && <tr><td colSpan={11} style={{ textAlign: 'center', color: '#6b7280' }}>Sin operaciones</td></tr>}
	                </tbody>
	              </table>
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
                  <tr><th>Distribuidor</th><th>Patente</th><th>Operaciones</th><th>Subtotal</th><th>Gastos</th><th>Total a pagar</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {distribuidores.map((d) => (
                    <tr key={d.id}>
                      <td><strong>{d.distribuidor ? `${d.distribuidor.apellidos}, ${d.distribuidor.nombres}` : `ID ${d.distribuidor_id}`}</strong></td>
                      <td><code>{d.distribuidor?.patente ?? '—'}</code></td>
                      <td>{d.cantidad_operaciones}</td>
                      <td>{fmt(d.subtotal)}</td>
                      <td style={{ color: '#dc2626' }}>{fmt(d.gastos_administrativos)}</td>
                      <td><strong>{fmt(d.total_a_pagar)}</strong></td>
                      <td style={{ fontSize: 12 }}>{d.estado}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button type="button" className="btn-sm btn-primary" onClick={() => navigate(`/liquidaciones/${d.distribuidor_id}`)}>
                          Ir a proveedor
                        </button>
                      </td>
                    </tr>
                  ))}
                  {distribuidores.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#6b7280' }}>Sin liquidaciones generadas aún</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
