import React, { useCallback, useEffect, useState } from 'react';
import type {
  ConfiguracionGastos,
  LiqClienteLiq,
  MapeoConcepto,
  MapeoSucursal,
} from './types';
import { formatFecha, formatPeso } from './types';

type Props = {
  apiBaseUrl: string;
  buildActorHeaders: () => Record<string, string>;
};

type SeccionActiva = 'mapeos_concepto' | 'mapeos_sucursal' | 'gastos';

// ─── Sección: Mapeos de Concepto ─────────────────────────────────────────────

const MapeosConceptoSection: React.FC<{
  clienteId: number;
  apiBaseUrl: string;
  buildActorHeaders: () => Record<string, string>;
}> = ({ clienteId, apiBaseUrl, buildActorHeaders }) => {
  const [mapeos, setMapeos] = useState<MapeoConcepto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [form, setForm] = useState({ valor_excel: '', dimension_destino: '', valor_tarifa: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setCargando(true);
      try {
        const res = await fetch(`${apiBaseUrl}/api/liq/clientes/${clienteId}/mapeos-concepto`, {
          credentials: 'include',
          headers: buildActorHeaders(),
        });
        const data = (await res.json()) as { data?: MapeoConcepto[] };
        setMapeos(data.data ?? []);
      } catch {
        setError('No se pudieron cargar los mapeos.');
      } finally {
        setCargando(false);
      }
    };
    void load();
  }, [apiBaseUrl, buildActorHeaders, clienteId]);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/liq/clientes/${clienteId}/mapeos-concepto`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildActorHeaders() },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? 'Error al guardar.');
      }
      const data = (await res.json()) as { data?: MapeoConcepto };
      if (data.data) {
        setMapeos((prev) => {
          const idx = prev.findIndex((m) => m.id === data.data!.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = data.data!;
            return next;
          }
          return [...prev, data.data!];
        });
      }
      setForm({ valor_excel: '', dimension_destino: '', valor_tarifa: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const handleDesactivar = async (id: number) => {
    try {
      await fetch(`${apiBaseUrl}/api/liq/mapeos-concepto/${id}/desactivar`, {
        method: 'PUT',
        credentials: 'include',
        headers: buildActorHeaders(),
      });
      setMapeos((prev) => prev.map((m) => (m.id === id ? { ...m, activo: false } : m)));
    } catch {
      setError('No se pudo desactivar el mapeo.');
    }
  };

  return (
    <div>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 14 }}>
        Traduce los conceptos que aparecen en el Excel del cliente al valor de dimensión
        correspondiente en la tarifa interna.
        <br />
        <strong>Ejemplo:</strong> "Rango 0-50 Km" → dimension "concepto" → "Ut. Corto AM"
      </p>

      {error && (
        <div style={errorBoxStyle}>
          {error}
          <button style={{ marginLeft: 8, fontSize: 12 }} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Tabla de mapeos */}
      {cargando ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Cargando…</p>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={thStyle}>Concepto en Excel</th>
                <th style={thStyle}>Dimensión destino</th>
                <th style={thStyle}>Valor en tarifa</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {mapeos.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: m.activo ? 1 : 0.5 }}>
                  <td style={tdStyle}><code style={codeStyle}>{m.valor_excel}</code></td>
                  <td style={tdStyle}>{m.dimension_destino}</td>
                  <td style={tdStyle}><code style={codeStyle}>{m.valor_tarifa}</code></td>
                  <td style={tdStyle}>
                    {m.activo ? (
                      <span style={badgeStyle('#d1fae5', '#065f46')}>Activo</span>
                    ) : (
                      <span style={badgeStyle('#f3f4f6', '#6b7280')}>Inactivo</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {m.activo && (
                      <button
                        style={btnDangerSmallStyle}
                        onClick={() => void handleDesactivar(m.id)}
                      >
                        Desactivar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {mapeos.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>
                    Sin mapeos configurados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Formulario nuevo mapeo */}
      <div style={cardStyle}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Agregar mapeo</h4>
        <form onSubmit={(e) => void handleGuardar(e)}>
          <div style={formGridStyle}>
            <div style={formFieldStyle}>
              <label style={labelStyle}>Concepto en el Excel del cliente</label>
              <input
                style={inputStyle}
                type="text"
                required
                placeholder="Ej: Rango 0-50 Km"
                value={form.valor_excel}
                onChange={(e) => setForm((p) => ({ ...p, valor_excel: e.target.value }))}
              />
            </div>
            <div style={formFieldStyle}>
              <label style={labelStyle}>Dimensión destino</label>
              <input
                style={inputStyle}
                type="text"
                required
                placeholder="Ej: concepto"
                value={form.dimension_destino}
                onChange={(e) => setForm((p) => ({ ...p, dimension_destino: e.target.value }))}
              />
            </div>
            <div style={formFieldStyle}>
              <label style={labelStyle}>Valor en la tarifa</label>
              <input
                style={inputStyle}
                type="text"
                required
                placeholder="Ej: Ut. Corto AM"
                value={form.valor_tarifa}
                onChange={(e) => setForm((p) => ({ ...p, valor_tarifa: e.target.value }))}
              />
            </div>
          </div>
          <button type="submit" style={{ ...btnPrimaryStyle, marginTop: 10 }} disabled={guardando}>
            {guardando ? 'Guardando…' : '+ Agregar mapeo'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ─── Sección: Mapeos de Sucursal ─────────────────────────────────────────────

const MapeosSucursalSection: React.FC<{
  clienteId: number;
  apiBaseUrl: string;
  buildActorHeaders: () => Record<string, string>;
}> = ({ clienteId, apiBaseUrl, buildActorHeaders }) => {
  const [mapeos, setMapeos] = useState<MapeoSucursal[]>([]);
  const [cargando, setCargando] = useState(false);
  const [form, setForm] = useState({ patron_archivo: '', sucursal_tarifa: '', tipo_operacion: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setCargando(true);
      try {
        const res = await fetch(`${apiBaseUrl}/api/liq/clientes/${clienteId}/mapeos-sucursal`, {
          credentials: 'include',
          headers: buildActorHeaders(),
        });
        const data = (await res.json()) as { data?: MapeoSucursal[] };
        setMapeos(data.data ?? []);
      } catch {
        setError('No se pudieron cargar los mapeos.');
      } finally {
        setCargando(false);
      }
    };
    void load();
  }, [apiBaseUrl, buildActorHeaders, clienteId]);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/liq/clientes/${clienteId}/mapeos-sucursal`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildActorHeaders() },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? 'Error al guardar.');
      }
      const data = (await res.json()) as { data?: MapeoSucursal };
      if (data.data) setMapeos((prev) => [...prev, data.data!]);
      setForm({ patron_archivo: '', sucursal_tarifa: '', tipo_operacion: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const handleDesactivar = async (id: number) => {
    try {
      await fetch(`${apiBaseUrl}/api/liq/mapeos-sucursal/${id}/desactivar`, {
        method: 'PUT',
        credentials: 'include',
        headers: buildActorHeaders(),
      });
      setMapeos((prev) => prev.map((m) => (m.id === id ? { ...m, activo: false } : m)));
    } catch {
      setError('No se pudo desactivar el mapeo.');
    }
  };

  return (
    <div>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 14 }}>
        Vincula el nombre del archivo Excel del cliente con la sucursal de la tarifa.
        El sistema detecta el mapeo automáticamente al cargar el archivo.
        <br />
        <strong>Ejemplo:</strong> "AMBA COLECTA" → sucursal "AMBA", tipo "Colecta"
      </p>

      {error && (
        <div style={errorBoxStyle}>
          {error}
          <button style={{ marginLeft: 8, fontSize: 12 }} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {cargando ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Cargando…</p>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={thStyle}>Patrón de archivo</th>
                <th style={thStyle}>Sucursal tarifa</th>
                <th style={thStyle}>Tipo operación</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {mapeos.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: m.activo ? 1 : 0.5 }}>
                  <td style={tdStyle}><code style={codeStyle}>{m.patron_archivo}</code></td>
                  <td style={tdStyle}><strong>{m.sucursal_tarifa}</strong></td>
                  <td style={tdStyle}>{m.tipo_operacion}</td>
                  <td style={tdStyle}>
                    {m.activo ? (
                      <span style={badgeStyle('#d1fae5', '#065f46')}>Activo</span>
                    ) : (
                      <span style={badgeStyle('#f3f4f6', '#6b7280')}>Inactivo</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {m.activo && (
                      <button
                        style={btnDangerSmallStyle}
                        onClick={() => void handleDesactivar(m.id)}
                      >
                        Desactivar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {mapeos.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>
                    Sin mapeos configurados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Formulario nuevo mapeo */}
      <div style={cardStyle}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Agregar mapeo de sucursal</h4>
        <form onSubmit={(e) => void handleGuardar(e)}>
          <div style={formGridStyle}>
            <div style={formFieldStyle}>
              <label style={labelStyle}>Patrón de archivo (nombre o parte del nombre)</label>
              <input
                style={inputStyle}
                type="text"
                required
                placeholder="Ej: AMBA COLECTA"
                value={form.patron_archivo}
                onChange={(e) => setForm((p) => ({ ...p, patron_archivo: e.target.value }))}
              />
            </div>
            <div style={formFieldStyle}>
              <label style={labelStyle}>Sucursal en la tarifa</label>
              <input
                style={inputStyle}
                type="text"
                required
                placeholder="Ej: AMBA"
                value={form.sucursal_tarifa}
                onChange={(e) => setForm((p) => ({ ...p, sucursal_tarifa: e.target.value }))}
              />
            </div>
            <div style={formFieldStyle}>
              <label style={labelStyle}>Tipo de operación</label>
              <input
                style={inputStyle}
                type="text"
                placeholder="Ej: Colecta, Ultima Milla"
                value={form.tipo_operacion}
                onChange={(e) => setForm((p) => ({ ...p, tipo_operacion: e.target.value }))}
              />
            </div>
          </div>
          <button type="submit" style={{ ...btnPrimaryStyle, marginTop: 10 }} disabled={guardando}>
            {guardando ? 'Guardando…' : '+ Agregar mapeo'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ─── Sección: Configuración de Gastos ────────────────────────────────────────

const GastosSection: React.FC<{
  clienteId: number;
  apiBaseUrl: string;
  buildActorHeaders: () => Record<string, string>;
}> = ({ clienteId, apiBaseUrl, buildActorHeaders }) => {
  const [gastos, setGastos] = useState<ConfiguracionGastos[]>([]);
  const [cargando, setCargando] = useState(false);
  const [form, setForm] = useState({
    concepto_gasto: '',
    monto: '',
    tipo: 'fijo' as 'fijo' | 'porcentual',
    vigencia_desde: '',
    vigencia_hasta: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setCargando(true);
      try {
        const res = await fetch(`${apiBaseUrl}/api/liq/clientes/${clienteId}/gastos`, {
          credentials: 'include',
          headers: buildActorHeaders(),
        });
        const data = (await res.json()) as { data?: ConfiguracionGastos[] };
        setGastos(data.data ?? []);
      } catch {
        setError('No se pudieron cargar los gastos.');
      } finally {
        setCargando(false);
      }
    };
    void load();
  }, [apiBaseUrl, buildActorHeaders, clienteId]);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/liq/clientes/${clienteId}/gastos`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildActorHeaders() },
        body: JSON.stringify({
          concepto_gasto: form.concepto_gasto,
          monto: parseFloat(form.monto.replace(',', '.')),
          tipo: form.tipo,
          vigencia_desde: form.vigencia_desde,
          vigencia_hasta: form.vigencia_hasta || null,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? 'Error al guardar.');
      }
      const data = (await res.json()) as { data?: ConfiguracionGastos };
      if (data.data) setGastos((prev) => [...prev, data.data!]);
      setForm({ concepto_gasto: '', monto: '', tipo: 'fijo', vigencia_desde: '', vigencia_hasta: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const gastosActivos = gastos.filter((g) => g.activo);

  return (
    <div>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 14 }}>
        Gastos administrativos descontados al distribuidor por período.
        <br />
        <strong>Loginter:</strong> $2.010 fijos por período por distribuidor.
      </p>

      {error && (
        <div style={errorBoxStyle}>
          {error}
          <button style={{ marginLeft: 8, fontSize: 12 }} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {cargando ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Cargando…</p>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={thStyle}>Concepto</th>
                <th style={thStyle}>Monto</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Vigencia desde</th>
                <th style={thStyle}>Vigencia hasta</th>
                <th style={thStyle}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((g) => (
                <tr key={g.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: g.activo ? 1 : 0.5 }}>
                  <td style={tdStyle}>{g.concepto_gasto}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                    {g.tipo === 'fijo' ? formatPeso(g.monto) : `${g.monto}%`}
                  </td>
                  <td style={tdStyle}>{g.tipo === 'fijo' ? 'Fijo' : 'Porcentual'}</td>
                  <td style={tdStyle}>{formatFecha(g.vigencia_desde)}</td>
                  <td style={tdStyle}>{g.vigencia_hasta ? formatFecha(g.vigencia_hasta) : 'Sin límite'}</td>
                  <td style={tdStyle}>
                    {g.activo ? (
                      <span style={badgeStyle('#d1fae5', '#065f46')}>Activo</span>
                    ) : (
                      <span style={badgeStyle('#f3f4f6', '#6b7280')}>Inactivo</span>
                    )}
                  </td>
                </tr>
              ))}
              {gastos.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>
                    Sin gastos configurados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {gastosActivos.length === 0 && !cargando && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e', marginBottom: 16 }}>
          ⚠ No hay gastos activos configurados. Las liquidaciones se generarán sin descuentos administrativos.
        </div>
      )}

      {/* Formulario */}
      <div style={cardStyle}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Agregar gasto</h4>
        <form onSubmit={(e) => void handleGuardar(e)}>
          <div style={formGridStyle}>
            <div style={formFieldStyle}>
              <label style={labelStyle}>Concepto</label>
              <input
                style={inputStyle}
                type="text"
                required
                placeholder="Ej: Gastos administrativos"
                value={form.concepto_gasto}
                onChange={(e) => setForm((p) => ({ ...p, concepto_gasto: e.target.value }))}
              />
            </div>
            <div style={formFieldStyle}>
              <label style={labelStyle}>Tipo</label>
              <select
                style={inputStyle}
                value={form.tipo}
                onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value as 'fijo' | 'porcentual' }))}
              >
                <option value="fijo">Fijo ($)</option>
                <option value="porcentual">Porcentual (%)</option>
              </select>
            </div>
            <div style={formFieldStyle}>
              <label style={labelStyle}>
                {form.tipo === 'fijo' ? 'Monto ($)' : 'Porcentaje (%)'}
              </label>
              <input
                style={inputStyle}
                type="text"
                inputMode="decimal"
                required
                placeholder={form.tipo === 'fijo' ? '2010' : '5'}
                value={form.monto}
                onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))}
              />
            </div>
            <div style={formFieldStyle}>
              <label style={labelStyle}>Vigencia desde</label>
              <input
                style={inputStyle}
                type="date"
                required
                value={form.vigencia_desde}
                onChange={(e) => setForm((p) => ({ ...p, vigencia_desde: e.target.value }))}
              />
            </div>
            <div style={formFieldStyle}>
              <label style={labelStyle}>Vigencia hasta (opcional)</label>
              <input
                style={inputStyle}
                type="date"
                value={form.vigencia_hasta}
                onChange={(e) => setForm((p) => ({ ...p, vigencia_hasta: e.target.value }))}
              />
            </div>
          </div>
          <button type="submit" style={{ ...btnPrimaryStyle, marginTop: 10 }} disabled={guardando}>
            {guardando ? 'Guardando…' : '+ Agregar gasto'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ─── Componente principal ────────────────────────────────────────────────────

export const ConfiguracionTab: React.FC<Props> = ({ apiBaseUrl, buildActorHeaders }) => {
  const [clientes, setClientes] = useState<LiqClienteLiq[]>([]);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [seccion, setSeccion] = useState<SeccionActiva>('mapeos_concepto');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/liq/clientes`, {
          credentials: 'include',
          headers: buildActorHeaders(),
        });
        const data = (await res.json()) as { data?: LiqClienteLiq[] };
        setClientes(data.data ?? []);
      } catch {
        // no block
      }
    };
    void load();
  }, [apiBaseUrl, buildActorHeaders]);

  const SECCIONES: Array<{ id: SeccionActiva; label: string }> = [
    { id: 'mapeos_concepto', label: 'Mapeos de concepto' },
    { id: 'mapeos_sucursal', label: 'Mapeos de archivo/sucursal' },
    { id: 'gastos', label: 'Gastos administrativos' },
  ];

  return (
    <div style={panelStyle}>
      <h2 style={sectionTitleStyle}>Configuración</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
        Parámetros de adaptación por cliente: mapeos de columnas del Excel, correspondencia de
        sucursales y gastos administrativos. Todo configurable sin cambios en código.
      </p>

      {/* Selector de cliente */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={formFieldStyle}>
          <label style={labelStyle}>Cliente</label>
          <select
            style={{ ...inputStyle, minWidth: 220 }}
            value={clienteId ?? ''}
            onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Seleccionar cliente —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre_corto}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!clienteId && (
        <div style={{ ...cardStyle, textAlign: 'center', color: '#9ca3af', padding: 40 }}>
          Seleccioná un cliente para ver su configuración.
        </div>
      )}

      {clienteId && (
        <>
          {/* Navegación de sección */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #e5e7eb', paddingBottom: 0 }}>
            {SECCIONES.map((s) => (
              <button
                key={s.id}
                type="button"
                style={{
                  padding: '8px 18px',
                  border: 'none',
                  borderBottom: seccion === s.id ? '2px solid #2563eb' : '2px solid transparent',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: seccion === s.id ? 700 : 400,
                  color: seccion === s.id ? '#2563eb' : '#6b7280',
                  marginBottom: '-2px',
                }}
                onClick={() => setSeccion(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Sección activa */}
          {seccion === 'mapeos_concepto' && (
            <MapeosConceptoSection
              clienteId={clienteId}
              apiBaseUrl={apiBaseUrl}
              buildActorHeaders={buildActorHeaders}
            />
          )}
          {seccion === 'mapeos_sucursal' && (
            <MapeosSucursalSection
              clienteId={clienteId}
              apiBaseUrl={apiBaseUrl}
              buildActorHeaders={buildActorHeaders}
            />
          )}
          {seccion === 'gastos' && (
            <GastosSection
              clienteId={clienteId}
              apiBaseUrl={apiBaseUrl}
              buildActorHeaders={buildActorHeaders}
            />
          )}
        </>
      )}
    </div>
  );
};

// ─── Estilos ─────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = { padding: '0 0 40px' };
const sectionTitleStyle: React.CSSProperties = { fontSize: 20, fontWeight: 700, marginBottom: 6 };
const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 16,
  marginBottom: 16,
};
const errorBoxStyle: React.CSSProperties = {
  background: '#fef2f2',
  border: '1px solid #fca5a5',
  borderRadius: 8,
  padding: '10px 14px',
  color: '#dc2626',
  fontSize: 14,
  marginBottom: 16,
};
const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: 12,
};
const formFieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151' };
const inputStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 14,
  outline: 'none',
  background: '#fff',
};
const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = { padding: '8px 10px', fontSize: 13 };
const btnPrimaryStyle: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '8px 18px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
const btnDangerSmallStyle: React.CSSProperties = {
  background: '#fef2f2',
  color: '#dc2626',
  border: '1px solid #fca5a5',
  borderRadius: 5,
  padding: '3px 8px',
  fontSize: 12,
  cursor: 'pointer',
};
const codeStyle: React.CSSProperties = {
  background: '#f3f4f6',
  borderRadius: 4,
  padding: '1px 6px',
  fontFamily: 'monospace',
  fontSize: 12,
};
const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
  background: bg,
  color,
  borderRadius: 4,
  padding: '2px 8px',
  fontSize: 12,
  fontWeight: 600,
  display: 'inline-block',
});
