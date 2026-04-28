/**
 * SPEC v4.4 · UI Tarifas Contrato Cliente (cliente → LA).
 *
 * Pantalla CRUD para liq_tarifas_contrato_cliente — fuente del detector subpago.
 * Permite a Liquidaciones administrar tarifas contractuales sin SQL.
 *
 * Ubicación: Liquidaciones → Configuración → Tarifas Contrato Cliente
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Cliente = { id: number; nombre_corto?: string | null; razon_social?: string | null };

type Tarifa = {
  id: number;
  cliente_id: number;
  cliente?: Cliente | null;
  sucursal: string;
  capacidad_vehiculo: number;
  concepto: string;
  importe_contrato: string | number;
  vigencia_desde: string;
  vigencia_hasta: string | null;
  notas: string | null;
};

type Catalogos = {
  clientes: Cliente[];
  capacidades: number[];
  conceptos: string[];
};

type ApiShape = {
  get: (path: string) => Promise<any>;
  post: (path: string, body: unknown) => Promise<any>;
  put: (path: string, body?: unknown) => Promise<any>;
  delete: (path: string) => Promise<any>;
  postForm: (path: string, fd: FormData) => Promise<any>;
  downloadFile?: (path: string, filename: string) => Promise<void>;
};

type Props = {
  api: ApiShape;
};

const fmtMoney = (n: number | string) => {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(v);
};

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-AR');
  } catch {
    return d;
  }
};

const isVigente = (t: Tarifa, hoy = new Date()): boolean => {
  const desde = new Date(t.vigencia_desde);
  if (desde > hoy) return false;
  if (!t.vigencia_hasta) return true;
  const hasta = new Date(t.vigencia_hasta);
  return hasta >= hoy;
};

const FORM_INICIAL = {
  cliente_id: '',
  sucursal: '',
  capacidad_vehiculo: '',
  concepto: '',
  importe_contrato: '',
  vigencia_desde: new Date().toISOString().substring(0, 10),
  vigencia_hasta: '',
  notas: '',
};

export function TarifasContratoPanel({ api }: Props) {
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [catalogos, setCatalogos] = useState<Catalogos>({ clientes: [], capacidades: [], conceptos: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filtros
  const [filtroCliente, setFiltroCliente] = useState<string>('');
  const [filtroSucursal, setFiltroSucursal] = useState<string>('');
  const [filtroCapacidad, setFiltroCapacidad] = useState<string>('');
  const [soloVigentes, setSoloVigentes] = useState(true);

  // Modal de crear/editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<typeof FORM_INICIAL>(FORM_INICIAL);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filtroCliente) params.set('cliente_id', filtroCliente);
      if (filtroSucursal) params.set('sucursal', filtroSucursal);
      if (filtroCapacidad) params.set('capacidad', filtroCapacidad);
      if (soloVigentes) params.set('vigentes', '1');
      const qs = params.toString() ? `?${params.toString()}` : '';
      const r = await api.get(`/tarifas-contrato-cliente${qs}`);
      const d = r?.data ?? {};
      setTarifas(d.tarifas ?? []);
      setCatalogos(d.catalogos ?? { clientes: [], capacidades: [], conceptos: [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando tarifas');
    } finally {
      setLoading(false);
    }
  }, [api, filtroCliente, filtroSucursal, filtroCapacidad, soloVigentes]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Sucursales detectadas (autocomplete)
  const sucursalesUnicas = useMemo(() => {
    const set = new Set<string>();
    tarifas.forEach((t) => set.add(t.sucursal));
    return Array.from(set).sort();
  }, [tarifas]);

  const tarifasFiltradas = tarifas; // ya filtradas en backend

  const abrirNuevo = () => {
    setEditingId(null);
    setForm({ ...FORM_INICIAL, cliente_id: filtroCliente || (catalogos.clientes[0]?.id?.toString() ?? '') });
    setModalOpen(true);
  };

  const abrirEditar = (t: Tarifa) => {
    setEditingId(t.id);
    setForm({
      cliente_id: t.cliente_id.toString(),
      sucursal: t.sucursal,
      capacidad_vehiculo: t.capacidad_vehiculo.toString(),
      concepto: t.concepto,
      importe_contrato: t.importe_contrato.toString(),
      vigencia_desde: t.vigencia_desde?.substring(0, 10) ?? '',
      vigencia_hasta: t.vigencia_hasta?.substring(0, 10) ?? '',
      notas: t.notas ?? '',
    });
    setModalOpen(true);
  };

  const guardar = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        cliente_id: Number(form.cliente_id),
        sucursal: form.sucursal.trim(),
        capacidad_vehiculo: Number(form.capacidad_vehiculo),
        concepto: form.concepto.trim(),
        importe_contrato: Number(form.importe_contrato),
        vigencia_desde: form.vigencia_desde,
        vigencia_hasta: form.vigencia_hasta || null,
        notas: form.notas?.trim() || null,
      };
      if (editingId) {
        await api.put(`/tarifas-contrato-cliente/${editingId}`, payload);
        setSuccess('Tarifa actualizada');
      } else {
        await api.post('/tarifas-contrato-cliente', payload);
        setSuccess('Tarifa creada');
      }
      setModalOpen(false);
      await cargar();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando tarifa');
    } finally {
      setSubmitting(false);
    }
  };

  const darDeBaja = async (t: Tarifa) => {
    if (!window.confirm(`¿Dar de baja la tarifa ${t.sucursal} cap=${t.capacidad_vehiculo} ${t.concepto}? (vigencia_hasta = hoy, no se borra)`)) return;
    try {
      await api.delete(`/tarifas-contrato-cliente/${t.id}`);
      setSuccess('Tarifa dada de baja');
      await cargar();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error dando de baja');
    }
  };

  const importarExcel = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    if (!filtroCliente && catalogos.clientes.length > 1) {
      setError('Antes de importar, seleccioná un cliente en el filtro');
      return;
    }
    const clienteId = filtroCliente || catalogos.clientes[0]?.id?.toString();
    if (!clienteId) {
      setError('Sin cliente para importar');
      return;
    }
    const fd = new FormData();
    fd.append('archivo', file);
    fd.append('cliente_id', clienteId);
    try {
      const r = await api.postForm('/tarifas-contrato-cliente/import-excel', fd);
      setSuccess(r?.message ?? 'Excel importado');
      if (r?.errores?.length > 0) {
        setError('Algunas filas dieron error: ' + r.errores.slice(0, 3).join(' · '));
      }
      await cargar();
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setSuccess(null), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error importando Excel');
    }
  };

  const exportarExcel = async () => {
    if (!api.downloadFile) {
      setError('Función de descarga no disponible');
      return;
    }
    try {
      const params = new URLSearchParams();
      if (filtroCliente) params.set('cliente_id', filtroCliente);
      if (filtroSucursal) params.set('sucursal', filtroSucursal);
      if (filtroCapacidad) params.set('capacidad', filtroCapacidad);
      if (soloVigentes) params.set('vigentes', '1');
      const qs = params.toString() ? `?${params.toString()}` : '';
      await api.downloadFile(`/tarifas-contrato-cliente/export-excel${qs}`, 'Tarifas_Contrato_Cliente.xlsx');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error exportando Excel');
    }
  };

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>Tarifas Contrato Cliente</h3>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            Lo que el cliente debería pagarnos por (sucursal × capacidad × concepto). Fuente del detector subpago.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={abrirNuevo}>+ Nueva tarifa</button>
          <label style={{ background: '#10b981', color: 'white', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            ↑ Importar Excel
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={() => void importarExcel()}
            />
          </label>
          <button type="button" className="btn-secondary" onClick={() => void exportarExcel()} style={{ background: '#10b981', color: 'white' }}>
            ↓ Exportar Excel
          </button>
        </div>
      </header>

      {error && (
        <div style={{ padding: 10, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, color: '#991b1b', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: 10, background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 6, color: '#065f46', fontSize: 13, marginBottom: 12 }}>
          {success}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, padding: 10, background: '#f9fafb', borderRadius: 6 }}>
        <select value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} style={{ padding: '4px 8px', fontSize: 13 }}>
          <option value="">Cliente: todos</option>
          {catalogos.clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre_corto ?? c.razon_social}</option>
          ))}
        </select>
        <input
          list="sucursales-list"
          value={filtroSucursal}
          onChange={(e) => setFiltroSucursal(e.target.value)}
          placeholder="Sucursal"
          style={{ padding: '4px 8px', fontSize: 13, width: 180 }}
        />
        <datalist id="sucursales-list">
          {sucursalesUnicas.map((s) => (<option key={s} value={s} />))}
        </datalist>
        <select value={filtroCapacidad} onChange={(e) => setFiltroCapacidad(e.target.value)} style={{ padding: '4px 8px', fontSize: 13 }}>
          <option value="">Capacidad: todas</option>
          {catalogos.capacidades.map((c) => (<option key={c} value={c}>{c} kg</option>))}
        </select>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={soloVigentes} onChange={(e) => setSoloVigentes(e.target.checked)} />
          Solo vigentes
        </label>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
          {tarifasFiltradas.length} tarifas
        </span>
      </div>

      {/* Tabla */}
      {loading && tarifas.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Cargando…</div>
      ) : (
        <table className="table" style={{ width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Sucursal</th>
              <th style={{ textAlign: 'right' }}>Cap.</th>
              <th>Concepto</th>
              <th style={{ textAlign: 'right' }}>Importe</th>
              <th>Vigencia desde</th>
              <th>Vigencia hasta</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {tarifasFiltradas.map((t) => {
              const vigente = isVigente(t);
              return (
                <tr key={t.id}>
                  <td>{t.cliente?.nombre_corto ?? t.cliente?.razon_social ?? '—'}</td>
                  <td style={{ fontWeight: 500 }}>{t.sucursal}</td>
                  <td style={{ textAlign: 'right' }}>{t.capacidad_vehiculo}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{t.concepto}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtMoney(t.importe_contrato)}</td>
                  <td>{fmtDate(t.vigencia_desde)}</td>
                  <td>{fmtDate(t.vigencia_hasta)}</td>
                  <td>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                      background: vigente ? '#d1fae5' : '#e5e7eb',
                      color: vigente ? '#065f46' : '#6b7280',
                    }}>
                      {vigente ? 'Vigente' : 'Vencida'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button type="button" className="btn-sm" onClick={() => abrirEditar(t)} style={{ fontSize: 11 }}>✏ Editar</button>
                    {vigente && (
                      <button type="button" className="btn-sm" onClick={() => void darDeBaja(t)} style={{ fontSize: 11, color: '#991b1b' }}>🗑 Baja</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {tarifasFiltradas.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>Sin tarifas con esos filtros</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* Modal crear/editar */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => !submitting && setModalOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 8, padding: 20, width: 500, maxWidth: '90vw' }}>
            <h4 style={{ margin: '0 0 12px 0' }}>{editingId ? 'Editar tarifa' : 'Nueva tarifa contrato'}</h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ fontSize: 12 }}>
                Cliente
                <select
                  value={form.cliente_id}
                  onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                  disabled={!!editingId}
                  style={{ width: '100%', padding: 6, fontSize: 13 }}
                >
                  <option value="">— elegir —</option>
                  {catalogos.clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre_corto ?? c.razon_social}</option>
                  ))}
                </select>
              </label>

              <label style={{ fontSize: 12 }}>
                Sucursal
                <input
                  list="sucursales-list-modal"
                  value={form.sucursal}
                  onChange={(e) => setForm({ ...form, sucursal: e.target.value.toUpperCase() })}
                  placeholder="Ej: TORTUGUITAS"
                  style={{ width: '100%', padding: 6, fontSize: 13 }}
                />
                <datalist id="sucursales-list-modal">
                  {sucursalesUnicas.map((s) => (<option key={s} value={s} />))}
                </datalist>
              </label>

              <label style={{ fontSize: 12 }}>
                Capacidad (kg)
                <select
                  value={form.capacidad_vehiculo}
                  onChange={(e) => setForm({ ...form, capacidad_vehiculo: e.target.value })}
                  style={{ width: '100%', padding: 6, fontSize: 13 }}
                >
                  <option value="">— elegir —</option>
                  {catalogos.capacidades.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </label>

              <label style={{ fontSize: 12 }}>
                Concepto
                <select
                  value={form.concepto}
                  onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                  style={{ width: '100%', padding: 6, fontSize: 13 }}
                >
                  <option value="">— elegir —</option>
                  {catalogos.conceptos.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </label>

              <label style={{ fontSize: 12, gridColumn: '1 / -1' }}>
                Importe contrato (lo que cliente debería pagar)
                <input
                  type="number"
                  step="0.01"
                  value={form.importe_contrato}
                  onChange={(e) => setForm({ ...form, importe_contrato: e.target.value })}
                  placeholder="89460.47"
                  style={{ width: '100%', padding: 6, fontSize: 13 }}
                />
              </label>

              <label style={{ fontSize: 12 }}>
                Vigencia desde
                <input
                  type="date"
                  value={form.vigencia_desde}
                  onChange={(e) => setForm({ ...form, vigencia_desde: e.target.value })}
                  style={{ width: '100%', padding: 6, fontSize: 13 }}
                />
              </label>

              <label style={{ fontSize: 12 }}>
                Vigencia hasta (opcional)
                <input
                  type="date"
                  value={form.vigencia_hasta}
                  onChange={(e) => setForm({ ...form, vigencia_hasta: e.target.value })}
                  style={{ width: '100%', padding: 6, fontSize: 13 }}
                />
              </label>

              <label style={{ fontSize: 12, gridColumn: '1 / -1' }}>
                Notas (opcional)
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  rows={2}
                  style={{ width: '100%', padding: 6, fontSize: 13, resize: 'vertical' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={submitting}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={() => void guardar()} disabled={submitting || !form.cliente_id || !form.sucursal || !form.capacidad_vehiculo || !form.concepto || !form.importe_contrato || !form.vigencia_desde}>
                {submitting ? 'Guardando…' : (editingId ? 'Actualizar' : 'Crear')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
