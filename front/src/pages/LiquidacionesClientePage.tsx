import React, { useState, useEffect, useCallback } from 'react';
import { useLiqApi } from '../features/liquidaciones/api';
import type {
  LiqCliente,
  LiqEsquemaTarifario,
  LiqDimensionValor,
  LiqLineaTarifa,
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

type Tab = 'clientes' | 'esquema' | 'mapeos' | 'gastos';
type BaseClienteOption = { id: number; codigo?: string | null; nombre?: string | null; documento_fiscal?: string | null };

export function LiquidacionesClientePage({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  buildActorHeaders,
  formatCurrency,
  formatDateOnly,
}: Props) {
  const authUser = useStoredAuthUser();
  const api = useLiqApi({ resolveApiBaseUrl, buildActorHeaders, authUser });

  const [activeTab, setActiveTab] = useState<Tab>('clientes');
  const [clientes, setClientes] = useState<LiqCliente[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<LiqCliente | null>(null);
  const [esquemas, setEsquemas] = useState<LiqEsquemaTarifario[]>([]);
  const [selectedEsquema, setSelectedEsquema] = useState<LiqEsquemaTarifario | null>(null);
  const [dimensiones, setDimensiones] = useState<Record<string, LiqDimensionValor[]>>({});
  const [lineas, setLineas] = useState<LiqLineaTarifa[]>([]);
  const [mapeosConcepto, setMapeosConcepto] = useState<LiqMapeoConcepto[]>([]);
  const [mapeosSucursal, setMapeosSucursal] = useState<LiqMapeoSucursal[]>([]);
  const [gastos, setGastos] = useState<LiqConfiguracionGastos[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showEnableClientForm, setShowEnableClientForm] = useState(false);
  const [baseClienteQuery, setBaseClienteQuery] = useState('');
  const [baseClienteOptions, setBaseClienteOptions] = useState<BaseClienteOption[]>([]);
  const [baseClienteLoading, setBaseClienteLoading] = useState(false);
  const [selectedBaseClienteId, setSelectedBaseClienteId] = useState<string>('');
  const [enablingClient, setEnablingClient] = useState(false);

  // New dimension form
  const [newDimNombre, setNewDimNombre] = useState('');
  const [newDimValor, setNewDimValor] = useState('');

  // New tariff line form
  const [newLineaDims, setNewLineaDims] = useState<Record<string, string>>({});
  const [newLineaPrecio, setNewLineaPrecio] = useState('');
  const [newLineaPctAg, setNewLineaPctAg] = useState('10');
  const [newLineaVigDesde, setNewLineaVigDesde] = useState('');
  const [newLineaVigHasta, setNewLineaVigHasta] = useState('');
  const [newLineaMotivo, setNewLineaMotivo] = useState('Carga inicial');

  // New gasto form
  const [newGastoConcepto, setNewGastoConcepto] = useState('Administración');
  const [newGastoMonto, setNewGastoMonto] = useState('');
  const [newGastoTipo, setNewGastoTipo] = useState<'fijo' | 'porcentual'>('fijo');
  const [newGastoVigDesde, setNewGastoVigDesde] = useState('');

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
      const actorHeaders = buildActorHeaders(authUser);
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
  }, [authUser, buildActorHeaders, resolveApiBaseUrl]);

  useEffect(() => {
    if (!showEnableClientForm) return;
    const handle = window.setTimeout(() => {
      void loadBaseClientes(baseClienteQuery);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [showEnableClientForm, baseClienteQuery, loadBaseClientes]);

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
      const [dimRes, lineasRes] = await Promise.all([
        api.get(`/esquemas/${esquema.id}/dimensiones`),
        api.get(`/esquemas/${esquema.id}/lineas`),
      ]);
      setDimensiones(dimRes.data ?? {});
      setLineas(lineasRes.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando esquema');
    }
  }, [api]);

  const refreshEsquemas = useCallback(async () => {
    if (!selectedCliente) return;
    try {
      const esqRes = await api.get(`/clientes/${selectedCliente.id}/esquemas`);
      setEsquemas(esqRes.data ?? []);
    } catch { /* silent */ }
  }, [api, selectedCliente]);

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
    const precio = parseFloat(newLineaPrecio);
    const pct = parseFloat(newLineaPctAg);
    if (isNaN(precio) || precio <= 0) { setError('Precio inválido'); return; }
    if (isNaN(pct) || pct <= 0 || pct >= 100) { setError('% agencia inválido (0 a 100)'); return; }
    if (!newLineaVigDesde) { setError('Vigencia desde es obligatoria'); return; }
    if (!newLineaMotivo || newLineaMotivo.trim().length < 3) { setError('Motivo es obligatorio'); return; }
    const dimsFaltantes = (selectedEsquema.dimensiones ?? []).filter((d) => !(newLineaDims[d] ?? '').trim());
    if (dimsFaltantes.length > 0) { setError(`Faltan dimensiones: ${dimsFaltantes.join(', ')}`); return; }
    try {
      await api.post(`/esquemas/${selectedEsquema.id}/lineas`, {
        dimensiones_valores: newLineaDims,
        precio_original: precio,
        porcentaje_agencia: pct,
        vigencia_desde: newLineaVigDesde,
        vigencia_hasta: newLineaVigHasta || null,
        motivo: newLineaMotivo,
      });
      setNewLineaDims({});
      setNewLineaPrecio('');
      const res = await api.get(`/esquemas/${selectedEsquema.id}/lineas`);
      setLineas(res.data ?? []);
      showSuccess('Línea creada');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }, [api, selectedEsquema, newLineaDims, newLineaPrecio, newLineaPctAg, newLineaVigDesde, newLineaVigHasta, newLineaMotivo]);

  const aprobarLinea = useCallback(async (id: number) => {
    try {
      await api.put(`/lineas/${id}/aprobar`, { motivo: 'Aprobación manual' });
      if (selectedEsquema) {
        const res = await api.get(`/esquemas/${selectedEsquema.id}/lineas`);
        setLineas(res.data ?? []);
      }
      showSuccess('Línea aprobada');
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
      });
      setNewGastoMonto('');
      const res = await api.get(`/clientes/${selectedCliente.id}/gastos`);
      setGastos(res.data ?? []);
      showSuccess('Gasto guardado');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }, [api, selectedCliente, newGastoConcepto, newGastoMonto, newGastoTipo, newGastoVigDesde]);

  const precioDistribuidor = () => {
    const p = parseFloat(newLineaPrecio);
    const pct = parseFloat(newLineaPctAg);
    if (isNaN(p) || isNaN(pct)) return null;
    return p * (1 - pct / 100);
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
        {(['clientes', 'esquema', 'mapeos', 'gastos'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            role="tab"
            aria-selected={activeTab === t}
            className={`tab-btn${activeTab === t ? ' is-active' : ''}`}
          >
            {{ clientes: 'Clientes', esquema: 'Esquema Tarifario', mapeos: 'Mapeos', gastos: 'Gastos' }[t]}
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
	                    <tr key={c.id} style={{ cursor: 'pointer', background: selectedCliente?.id === c.id ? '#eff6ff' : undefined }}>
	                      <td>{c.id}</td>
	                      <td><strong>{c.nombre_corto}</strong></td>
	                      <td style={{ fontSize: 12 }}>{c.razon_social}</td>
	                      <td>{c.cuit ?? '—'}</td>
	                      <td>{getTolerancia(c)}</td>
	                      <td>{c.esquemas_count ?? 0}</td>
	                      <td>
	                        <button type="button" className="btn-sm btn-primary" onClick={() => { selectCliente(c); setActiveTab('esquema'); }}>
	                          Configurar
	                        </button>
	                      </td>
	                    </tr>
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
                    <header className="card-header"><h3>Líneas de tarifa</h3></header>
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
                            <input type="number" className="form-input" value={newLineaPrecio} onChange={(e) => setNewLineaPrecio(e.target.value)} placeholder="0.00" min="0.01" step="0.01" />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>% Agencia</label>
                            <input type="number" className="form-input" value={newLineaPctAg} onChange={(e) => setNewLineaPctAg(e.target.value)} min="0" max="99.99" step="0.01" />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Precio distribuidor</label>
                            <input type="text" className="form-input" readOnly value={precioDistribuidor() != null ? fmt(precioDistribuidor()!) : '—'} style={{ background: '#f3f4f6', color: '#374151' }} />
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
                        <button type="button" className="btn-primary" onClick={addLinea}>Guardar línea</button>
                      </div>

                      {/* Lines table */}
                      <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              {selectedEsquema.dimensiones.map((d) => <th key={d} style={{ textTransform: 'capitalize' }}>{d}</th>)}
                              <th>Original</th><th>% Ag.</th><th>Distribuidor</th>
                              <th>Vigencia</th><th>Estado</th><th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {lineas.map((l) => (
                              <tr key={l.id} style={{ opacity: l.activo ? 1 : 0.5 }}>
                                {selectedEsquema.dimensiones.map((d) => (
                                  <td key={d}>{l.dimensiones_valores[d] ?? '—'}</td>
                                ))}
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
                                <td style={{ display: 'flex', gap: 4 }}>
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
                  </div>
                  <button type="button" className="btn-primary" onClick={addGasto}>Guardar gasto</button>
                </div>

                <table className="data-table">
                  <thead><tr><th>Concepto</th><th>Monto</th><th>Tipo</th><th>Vigencia desde</th><th>Vigencia hasta</th><th>Activo</th></tr></thead>
                  <tbody>
                    {gastos.map((g) => (
                      <tr key={g.id} style={{ opacity: g.activo ? 1 : 0.5 }}>
                        <td>{g.concepto_gasto}</td>
                        <td>{fmt(parseFloat(g.monto))}</td>
                        <td>{g.tipo}</td>
                        <td>{fmtDate(g.vigencia_desde)}</td>
                        <td>{g.vigencia_hasta ? fmtDate(g.vigencia_hasta) : '—'}</td>
                        <td>{g.activo ? '✓' : '—'}</td>
                      </tr>
                    ))}
                    {gastos.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#6b7280' }}>Sin gastos configurados</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
