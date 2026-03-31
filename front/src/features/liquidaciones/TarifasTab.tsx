import React, { useCallback, useEffect, useState } from 'react';
import type {
  DimensionTarifaValor,
  EsquemaTarifario,
  LiqClienteLiq,
  LineaTarifa,
  LineaTarifaForm,
} from './types';
import { formatFecha, formatPeso, lineaTarifaFormVacia } from './types';

type Props = {
  apiBaseUrl: string;
  buildActorHeaders: () => Record<string, string>;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const calcPrecioDistribuidor = (original: number, pct: number): number =>
  original * (1 - pct / 100);

// ─── Subcomponente: tabla de líneas de tarifa ────────────────────────────────

const LineasTable: React.FC<{
  lineas: LineaTarifa[];
  dimensiones: string[];
  onAprobar: (id: number) => void;
  aprobando: number | null;
}> = ({ lineas, dimensiones, onAprobar, aprobando }) => {
  if (lineas.length === 0) {
    return (
      <p style={{ color: '#6b7280', padding: '12px 0' }}>
        No hay líneas de tarifa cargadas.
      </p>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
            {dimensiones.map((d) => (
              <th key={d} style={thStyle}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </th>
            ))}
            <th style={thStyle}>Precio original</th>
            <th style={thStyle}>% Agencia</th>
            <th style={thStyle}>Precio distribuidor</th>
            <th style={thStyle}>Vigencia desde</th>
            <th style={thStyle}>Vigencia hasta</th>
            <th style={thStyle}>Estado</th>
            <th style={thStyle}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l) => (
            <tr
              key={l.id}
              style={{
                borderBottom: '1px solid #e5e7eb',
                background: l.activo ? undefined : '#fafafa',
                opacity: l.activo ? 1 : 0.6,
              }}
            >
              {dimensiones.map((d) => (
                <td key={d} style={tdStyle}>
                  {l.dimensiones_valores[d] ?? '—'}
                </td>
              ))}
              <td style={tdStyle}>{formatPeso(l.precio_original)}</td>
              <td style={tdStyle}>{l.porcentaje_agencia}%</td>
              <td style={{ ...tdStyle, fontWeight: 600 }}>
                {formatPeso(l.precio_distribuidor)}
              </td>
              <td style={tdStyle}>{formatFecha(l.vigencia_desde)}</td>
              <td style={tdStyle}>
                {l.vigencia_hasta ? formatFecha(l.vigencia_hasta) : '—'}
              </td>
              <td style={tdStyle}>
                {l.aprobado_por ? (
                  <span style={badgeStyle('#d1fae5', '#065f46')}>Aprobada</span>
                ) : (
                  <span style={badgeStyle('#fef3c7', '#92400e')}>Pendiente</span>
                )}
              </td>
              <td style={tdStyle}>
                {!l.aprobado_por && l.activo && (
                  <button
                    style={btnSmallStyle}
                    disabled={aprobando === l.id}
                    onClick={() => onAprobar(l.id)}
                  >
                    {aprobando === l.id ? 'Aprobando…' : 'Aprobar'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Subcomponente: formulario nueva línea ───────────────────────────────────

const NuevaLineaForm: React.FC<{
  dimensiones: string[];
  valoresPorDimension: Record<string, DimensionTarifaValor[]>;
  onGuardar: (form: LineaTarifaForm) => Promise<void>;
  guardando: boolean;
  error: string | null;
}> = ({ dimensiones, valoresPorDimension, onGuardar, guardando, error }) => {
  const [form, setForm] = useState<LineaTarifaForm>(lineaTarifaFormVacia());

  const precioOriginal = parseFloat(form.precio_original.replace(',', '.')) || 0;
  const pctAgencia = parseFloat(form.porcentaje_agencia.replace(',', '.')) || 0;
  const precioDistribuidor = calcPrecioDistribuidor(precioOriginal, pctAgencia);

  const handleDimension = (dim: string, valor: string) => {
    setForm((prev) => ({
      ...prev,
      dimensiones_valores: { ...prev.dimensiones_valores, [dim]: valor },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onGuardar(form);
    setForm(lineaTarifaFormVacia());
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} style={{ marginTop: 16 }}>
      <div style={formGridStyle}>
        {dimensiones.map((dim) => (
          <div key={dim} style={formFieldStyle}>
            <label style={labelStyle}>
              {dim.charAt(0).toUpperCase() + dim.slice(1)}
            </label>
            <select
              style={inputStyle}
              required
              value={form.dimensiones_valores[dim] ?? ''}
              onChange={(e) => handleDimension(dim, e.target.value)}
            >
              <option value="">— Seleccionar —</option>
              {(valoresPorDimension[dim] ?? [])
                .filter((v) => v.activo)
                .sort((a, b) => a.orden_display - b.orden_display)
                .map((v) => (
                  <option key={v.id} value={v.valor}>
                    {v.valor}
                  </option>
                ))}
            </select>
          </div>
        ))}

        <div style={formFieldStyle}>
          <label style={labelStyle}>Precio original ($)</label>
          <input
            style={inputStyle}
            type="text"
            inputMode="decimal"
            placeholder="100000"
            required
            value={form.precio_original}
            onChange={(e) => setForm((p) => ({ ...p, precio_original: e.target.value }))}
          />
        </div>

        <div style={formFieldStyle}>
          <label style={labelStyle}>% Agencia</label>
          <input
            style={inputStyle}
            type="text"
            inputMode="decimal"
            placeholder="10"
            required
            value={form.porcentaje_agencia}
            onChange={(e) => setForm((p) => ({ ...p, porcentaje_agencia: e.target.value }))}
          />
        </div>

        <div style={formFieldStyle}>
          <label style={labelStyle}>Precio distribuidor (calculado)</label>
          <input
            style={{ ...inputStyle, background: '#f3f4f6', color: '#374151', fontWeight: 600 }}
            type="text"
            readOnly
            value={precioOriginal > 0 ? formatPeso(precioDistribuidor) : '—'}
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

      {error && (
        <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>
      )}

      <button type="submit" style={btnPrimaryStyle} disabled={guardando}>
        {guardando ? 'Guardando…' : '+ Agregar línea'}
      </button>
    </form>
  );
};

// ─── Subcomponente: gestión de valores de una dimensión ─────────────────────

const DimensionPanel: React.FC<{
  nombre: string;
  valores: DimensionTarifaValor[];
  onAgregar: (nombre: string, valor: string) => Promise<void>;
}> = ({ nombre, valores, onAgregar }) => {
  const [nuevoValor, setNuevoValor] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  const handleAgregar = async () => {
    if (!nuevoValor.trim()) return;
    setGuardando(true);
    try {
      await onAgregar(nombre, nuevoValor.trim());
      setNuevoValor('');
    } finally {
      setGuardando(false);
    }
  };

  const activos = valores.filter((v) => v.activo);

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8 }}>
      <button
        type="button"
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '10px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          fontWeight: 600,
          fontSize: 14,
        }}
        onClick={() => setAbierto((p) => !p)}
      >
        <span>
          {nombre.charAt(0).toUpperCase() + nombre.slice(1)}
          <span style={{ marginLeft: 8, color: '#6b7280', fontWeight: 400, fontSize: 12 }}>
            ({activos.length} valores)
          </span>
        </span>
        <span>{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {activos
              .sort((a, b) => a.orden_display - b.orden_display)
              .map((v) => (
                <span key={v.id} style={badgeStyle('#e0f2fe', '#0369a1')}>
                  {v.valor}
                </span>
              ))}
            {activos.length === 0 && (
              <span style={{ color: '#9ca3af', fontSize: 13 }}>Sin valores</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1, maxWidth: 300 }}
              type="text"
              placeholder={`Nuevo valor para ${nombre}`}
              value={nuevoValor}
              onChange={(e) => setNuevoValor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAgregar();
                }
              }}
            />
            <button
              style={btnSmallStyle}
              type="button"
              disabled={guardando || !nuevoValor.trim()}
              onClick={() => void handleAgregar()}
            >
              {guardando ? '…' : 'Agregar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Componente principal ────────────────────────────────────────────────────

export const TarifasTab: React.FC<Props> = ({ apiBaseUrl, buildActorHeaders }) => {
  // — Estado global del tab —
  const [clientes, setClientes] = useState<LiqClienteLiq[]>([]);
  const [clienteId, setClienteId] = useState<number | null>(null);

  // — Esquema activo —
  const [esquemas, setEsquemas] = useState<EsquemaTarifario[]>([]);
  const [esquemaId, setEsquemaId] = useState<number | null>(null);

  // — Datos del esquema seleccionado —
  const [valoresPorDimension, setValoresPorDimension] = useState<
    Record<string, DimensionTarifaValor[]>
  >({});
  const [lineas, setLineas] = useState<LineaTarifa[]>([]);

  // — UI —
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorLinea, setErrorLinea] = useState<string | null>(null);
  const [guardandoLinea, setGuardandoLinea] = useState(false);
  const [aprobando, setAprobando] = useState<number | null>(null);

  // — Nuevo esquema —
  const [mostrarFormEsquema, setMostrarFormEsquema] = useState(false);
  const [nuevoEsquema, setNuevoEsquema] = useState({
    nombre: '',
    descripcion: '',
    dimensiones: '',
  });

  const esquemaActual = esquemas.find((e) => e.id === esquemaId) ?? null;

  // ── Cargar clientes ──────────────────────────────────────────────────────
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
        setError('No se pudieron cargar los clientes.');
      }
    };
    void load();
  }, [apiBaseUrl, buildActorHeaders]);

  // ── Cargar esquemas cuando cambia el cliente ─────────────────────────────
  useEffect(() => {
    if (!clienteId) {
      setEsquemas([]);
      setEsquemaId(null);
      return;
    }
    const load = async () => {
      try {
        setCargando(true);
        const res = await fetch(`${apiBaseUrl}/api/liq/clientes/${clienteId}/esquemas`, {
          credentials: 'include',
          headers: buildActorHeaders(),
        });
        const data = (await res.json()) as { data?: EsquemaTarifario[] };
        const lista = data.data ?? [];
        setEsquemas(lista);
        const activo = lista.find((e) => e.activo);
        setEsquemaId(activo?.id ?? lista[0]?.id ?? null);
      } catch {
        setError('No se pudieron cargar los esquemas.');
      } finally {
        setCargando(false);
      }
    };
    void load();
  }, [apiBaseUrl, buildActorHeaders, clienteId]);

  // ── Cargar dimensiones y líneas cuando cambia el esquema ─────────────────
  useEffect(() => {
    if (!esquemaId) {
      setValoresPorDimension({});
      setLineas([]);
      return;
    }
    const load = async () => {
      try {
        setCargando(true);
        const [resDim, resLineas] = await Promise.all([
          fetch(`${apiBaseUrl}/api/liq/esquemas/${esquemaId}/dimensiones`, {
            credentials: 'include',
            headers: buildActorHeaders(),
          }),
          fetch(`${apiBaseUrl}/api/liq/esquemas/${esquemaId}/lineas`, {
            credentials: 'include',
            headers: buildActorHeaders(),
          }),
        ]);
        const dataDim = (await resDim.json()) as { data?: DimensionTarifaValor[] };
        const dataLineas = (await resLineas.json()) as { data?: LineaTarifa[] };

        const valores = dataDim.data ?? [];
        const grouped: Record<string, DimensionTarifaValor[]> = {};
        valores.forEach((v) => {
          if (!grouped[v.nombre_dimension]) grouped[v.nombre_dimension] = [];
          grouped[v.nombre_dimension].push(v);
        });
        setValoresPorDimension(grouped);
        setLineas(dataLineas.data ?? []);
      } catch {
        setError('No se pudieron cargar los datos del esquema.');
      } finally {
        setCargando(false);
      }
    };
    void load();
  }, [apiBaseUrl, buildActorHeaders, esquemaId]);

  // ── Agregar valor de dimensión ───────────────────────────────────────────
  const handleAgregarValor = useCallback(
    async (nombreDimension: string, valor: string) => {
      if (!esquemaId) return;
      const res = await fetch(`${apiBaseUrl}/api/liq/esquemas/${esquemaId}/dimensiones`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildActorHeaders() },
        body: JSON.stringify({ nombre_dimension: nombreDimension, valor }),
      });
      if (!res.ok) throw new Error('No se pudo agregar el valor.');
      const data = (await res.json()) as { data?: DimensionTarifaValor };
      const nuevo = data.data;
      if (!nuevo) return;
      setValoresPorDimension((prev) => {
        const lista = [...(prev[nombreDimension] ?? []), nuevo];
        return { ...prev, [nombreDimension]: lista };
      });
    },
    [apiBaseUrl, buildActorHeaders, esquemaId],
  );

  // ── Guardar nueva línea de tarifa ────────────────────────────────────────
  const handleGuardarLinea = useCallback(
    async (form: LineaTarifaForm) => {
      if (!esquemaId) return;
      setGuardandoLinea(true);
      setErrorLinea(null);
      try {
        const body = {
          dimensiones_valores: form.dimensiones_valores,
          precio_original: parseFloat(form.precio_original.replace(',', '.')),
          porcentaje_agencia: parseFloat(form.porcentaje_agencia.replace(',', '.')),
          vigencia_desde: form.vigencia_desde,
          vigencia_hasta: form.vigencia_hasta || null,
        };
        const res = await fetch(`${apiBaseUrl}/api/liq/esquemas/${esquemaId}/lineas`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...buildActorHeaders() },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = (await res.json()) as { message?: string };
          throw new Error(err.message ?? 'Error al guardar.');
        }
        const data = (await res.json()) as { data?: LineaTarifa };
        if (data.data) setLineas((prev) => [...prev, data.data!]);
      } catch (e) {
        setErrorLinea(e instanceof Error ? e.message : 'Error al guardar la línea.');
      } finally {
        setGuardandoLinea(false);
      }
    },
    [apiBaseUrl, buildActorHeaders, esquemaId],
  );

  // ── Aprobar línea ────────────────────────────────────────────────────────
  const handleAprobar = useCallback(
    async (lineaId: number) => {
      setAprobando(lineaId);
      try {
        const res = await fetch(`${apiBaseUrl}/api/liq/lineas/${lineaId}/aprobar`, {
          method: 'PUT',
          credentials: 'include',
          headers: buildActorHeaders(),
        });
        if (!res.ok) throw new Error('No se pudo aprobar.');
        const data = (await res.json()) as { data?: LineaTarifa };
        if (data.data) {
          setLineas((prev) => prev.map((l) => (l.id === lineaId ? data.data! : l)));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al aprobar.');
      } finally {
        setAprobando(null);
      }
    },
    [apiBaseUrl, buildActorHeaders],
  );

  // ── Crear nuevo esquema ──────────────────────────────────────────────────
  const handleCrearEsquema = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId) return;
    try {
      const dimensiones = nuevoEsquema.dimensiones
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);
      const res = await fetch(`${apiBaseUrl}/api/liq/clientes/${clienteId}/esquemas`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildActorHeaders() },
        body: JSON.stringify({
          nombre: nuevoEsquema.nombre,
          descripcion: nuevoEsquema.descripcion,
          dimensiones,
        }),
      });
      if (!res.ok) throw new Error('No se pudo crear el esquema.');
      const data = (await res.json()) as { data?: EsquemaTarifario };
      if (data.data) {
        setEsquemas((prev) => [...prev, data.data!]);
        setEsquemaId(data.data.id);
      }
      setMostrarFormEsquema(false);
      setNuevoEsquema({ nombre: '', descripcion: '', dimensiones: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear el esquema.');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={panelStyle}>
      <h2 style={sectionTitleStyle}>Gestión de Tarifas</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
        Las tarifas se cargan manualmente. Cada cliente tiene su propio esquema con dimensiones
        flexibles.
      </p>

      {error && (
        <div style={errorBoxStyle}>
          {error}
          <button style={{ marginLeft: 12, fontSize: 12 }} onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      {/* ── Selector de cliente ── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap' }}>
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

        {clienteId && esquemas.length > 1 && (
          <div style={formFieldStyle}>
            <label style={labelStyle}>Esquema tarifario</label>
            <select
              style={{ ...inputStyle, minWidth: 200 }}
              value={esquemaId ?? ''}
              onChange={(e) => setEsquemaId(e.target.value ? Number(e.target.value) : null)}
            >
              {esquemas.map((es) => (
                <option key={es.id} value={es.id}>
                  {es.nombre} {es.activo ? '(activo)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {clienteId && (
          <button
            style={btnSecondaryStyle}
            type="button"
            onClick={() => setMostrarFormEsquema((p) => !p)}
          >
            + Nuevo esquema
          </button>
        )}
      </div>

      {/* ── Formulario nuevo esquema ── */}
      {mostrarFormEsquema && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Crear esquema tarifario</h3>
          <form onSubmit={(e) => void handleCrearEsquema(e)}>
            <div style={formGridStyle}>
              <div style={formFieldStyle}>
                <label style={labelStyle}>Nombre</label>
                <input
                  style={inputStyle}
                  type="text"
                  required
                  placeholder="Ej: Tarifa Loginter 2026"
                  value={nuevoEsquema.nombre}
                  onChange={(e) => setNuevoEsquema((p) => ({ ...p, nombre: e.target.value }))}
                />
              </div>
              <div style={formFieldStyle}>
                <label style={labelStyle}>Dimensiones (separadas por coma)</label>
                <input
                  style={inputStyle}
                  type="text"
                  required
                  placeholder="sucursal, concepto"
                  value={nuevoEsquema.dimensiones}
                  onChange={(e) =>
                    setNuevoEsquema((p) => ({ ...p, dimensiones: e.target.value }))
                  }
                />
              </div>
              <div style={{ ...formFieldStyle, gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Descripción (opcional)</label>
                <input
                  style={inputStyle}
                  type="text"
                  value={nuevoEsquema.descripcion}
                  onChange={(e) =>
                    setNuevoEsquema((p) => ({ ...p, descripcion: e.target.value }))
                  }
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="submit" style={btnPrimaryStyle}>
                Crear esquema
              </button>
              <button
                type="button"
                style={btnSecondaryStyle}
                onClick={() => setMostrarFormEsquema(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Contenido del esquema seleccionado ── */}
      {cargando && <p style={{ color: '#6b7280' }}>Cargando…</p>}

      {esquemaActual && !cargando && (
        <>
          {/* Info del esquema */}
          <div style={{ ...cardStyle, background: '#f0f9ff', marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Esquema</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{esquemaActual.nombre}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Dimensiones</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {esquemaActual.dimensiones.map((d) => (
                    <span key={d} style={badgeStyle('#dbeafe', '#1e40af')}>
                      {d}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Total líneas activas</div>
                <div style={{ fontWeight: 700 }}>
                  {lineas.filter((l) => l.activo).length}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Pendientes de aprobación</div>
                <div style={{ fontWeight: 700, color: '#d97706' }}>
                  {lineas.filter((l) => l.activo && !l.aprobado_por).length}
                </div>
              </div>
            </div>
          </div>

          {/* Dimensiones */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={subSectionTitleStyle}>Valores por dimensión</h3>
            {esquemaActual.dimensiones.map((dim) => (
              <DimensionPanel
                key={dim}
                nombre={dim}
                valores={valoresPorDimension[dim] ?? []}
                onAgregar={handleAgregarValor}
              />
            ))}
          </div>

          {/* Tabla de líneas */}
          <div>
            <h3 style={subSectionTitleStyle}>Líneas de tarifa</h3>
            <LineasTable
              lineas={lineas}
              dimensiones={esquemaActual.dimensiones}
              onAprobar={handleAprobar}
              aprobando={aprobando}
            />

            {/* Formulario nueva línea */}
            <div style={{ ...cardStyle, marginTop: 20 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                Agregar nueva línea
              </h4>
              <NuevaLineaForm
                dimensiones={esquemaActual.dimensiones}
                valoresPorDimension={valoresPorDimension}
                onGuardar={handleGuardarLinea}
                guardando={guardandoLinea}
                error={errorLinea}
              />
            </div>
          </div>
        </>
      )}

      {clienteId && !cargando && esquemas.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', color: '#6b7280' }}>
          <p>Este cliente no tiene esquemas tarifarios. Creá uno para comenzar.</p>
        </div>
      )}

      {!clienteId && (
        <div style={{ ...cardStyle, textAlign: 'center', color: '#9ca3af', padding: 40 }}>
          Seleccioná un cliente para ver o cargar su tarifa.
        </div>
      )}
    </div>
  );
};

// ─── Estilos compartidos ─────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = { padding: '0 0 40px' };
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  marginBottom: 6,
};
const subSectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  marginBottom: 10,
  color: '#374151',
};
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
const btnSecondaryStyle: React.CSSProperties = {
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  padding: '8px 14px',
  fontSize: 14,
  cursor: 'pointer',
};
const btnSmallStyle: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 5,
  padding: '4px 10px',
  fontSize: 12,
  cursor: 'pointer',
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
