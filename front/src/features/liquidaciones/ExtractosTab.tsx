import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  DimensionTarifaValor,
  EsquemaTarifario,
  LiqClienteLiq,
  LineaTarifa,
  LiquidacionCliente,
  LiquidacionClienteEstado,
  Operacion,
  OperacionEstado,
} from './types';
import {
  LIQ_CLIENTE_ESTADO_LABEL,
  OPERACION_ESTADO_COLOR,
  OPERACION_ESTADO_LABEL,
  formatFecha,
  formatPeso,
} from './types';

type Props = {
  apiBaseUrl: string;
  buildActorHeaders: () => Record<string, string>;
};

type PeriodoForm = {
  clienteId: string;
  periodoDesde: string;
  periodoHasta: string;
  sucursalTarifa: string;
};

const EXTRACTOS_FORM_STORAGE_KEY = 'liq.extractos.form.v1';
const EXTRACTOS_SELECTED_RUN_ID_STORAGE_KEY = 'liq.extractos.selected_run_id.v1';

const readStoredExtractosForm = (): PeriodoForm => {
  const defaults: PeriodoForm = { clienteId: '', periodoDesde: '', periodoHasta: '', sucursalTarifa: '' };
  try {
    const raw = localStorage.getItem(EXTRACTOS_FORM_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<PeriodoForm>;
    return {
      clienteId: typeof parsed.clienteId === 'string' ? parsed.clienteId : defaults.clienteId,
      periodoDesde: typeof parsed.periodoDesde === 'string' ? parsed.periodoDesde : defaults.periodoDesde,
      periodoHasta: typeof parsed.periodoHasta === 'string' ? parsed.periodoHasta : defaults.periodoHasta,
      sucursalTarifa:
        typeof parsed.sucursalTarifa === 'string' ? parsed.sucursalTarifa : defaults.sucursalTarifa,
    };
  } catch {
    return defaults;
  }
};

const readStoredSelectedRunId = (): number | null => {
  try {
    const raw = localStorage.getItem(EXTRACTOS_SELECTED_RUN_ID_STORAGE_KEY);
    if (!raw) return null;
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
};

const readApiErrorMessage = async (res: Response): Promise<string> => {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) return body.message;
    } catch {
      // ignore
    }
  }

  let text = '';
  try {
    text = (await res.text()) ?? '';
  } catch {
    // ignore
  }

  if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
    return `La API devolvió HTML (status ${res.status}) en ${res.url}. Revisar apiBaseUrl / sesión.`;
  }

  const suffix = text ? ` ${text.slice(0, 160)}` : '';
  return `Error HTTP ${res.status}.${suffix}`;
};

const readJsonOrThrow = async <T,>(res: Response): Promise<T> => {
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(await readApiErrorMessage(res));
  }
  return (await res.json()) as T;
};

const ESTADO_BADGE_STYLE: Record<LiquidacionClienteEstado, React.CSSProperties> = {
  pendiente: { background: '#fef3c7', color: '#92400e' },
  en_proceso: { background: '#dbeafe', color: '#1e40af' },
  auditada: { background: '#e0f2fe', color: '#0369a1' },
  aprobada: { background: '#d1fae5', color: '#065f46' },
  rechazada: { background: '#fee2e2', color: '#991b1b' },
};

const OPERACION_ESTADOS: OperacionEstado[] = [
  'ok',
  'diferencia',
  'sin_tarifa',
  'sin_distribuidor',
  'duplicado',
  'observado',
];

// ─── Resumen estadístico de un run ──────────────────────────────────────────

const RunResumen: React.FC<{ run: LiquidacionCliente; operaciones: Operacion[] }> = ({
  run,
  operaciones,
}) => {
  const operacionesActivas = operaciones.filter((o) => !o.excluida);
  const excluidasCount = operaciones.length - operacionesActivas.length;

  const countByEstado = OPERACION_ESTADOS.reduce<Record<string, number>>(
    (acc, e) => ({ ...acc, [e]: operacionesActivas.filter((o) => o.estado === e).length }),
    {},
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: 12,
        marginBottom: 20,
      }}
    >
      <StatCard label="Total operaciones" value={run.total_operaciones} />
      <StatCard
        label="Importe cliente"
        value={formatPeso(run.total_importe_cliente)}
        mono
      />
      <StatCard
        label="Importe correcto"
        value={formatPeso(run.total_importe_correcto)}
        mono
      />
      <StatCard
        label="Diferencia total"
        value={formatPeso(run.total_diferencia)}
        mono
        color={run.total_diferencia !== 0 ? '#d97706' : '#059669'}
      />
      {OPERACION_ESTADOS.filter((e) => countByEstado[e] > 0).map((e) => (
        <StatCard
          key={e}
          label={OPERACION_ESTADO_LABEL[e]}
          value={countByEstado[e]}
          color={OPERACION_ESTADO_COLOR[e]}
        />
      ))}
      {excluidasCount > 0 && <StatCard label="Excluidas" value={excluidasCount} color="#6b7280" />}
    </div>
  );
};

const StatCard: React.FC<{
  label: string;
  value: string | number;
  mono?: boolean;
  color?: string;
}> = ({ label, value, mono, color }) => (
  <div
    style={{
      background: '#f9fafb',
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      padding: '10px 14px',
    }}
  >
    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{label}</div>
    <div
      style={{
        fontSize: 18,
        fontWeight: 700,
        fontFamily: mono ? 'monospace' : undefined,
        color: color ?? '#111827',
      }}
    >
      {value}
    </div>
  </div>
);

// ─── Tabla de operaciones ────────────────────────────────────────────────────

const OperacionesTable: React.FC<{
  operaciones: Operacion[];
  editable: boolean;
  onUpdateExclusion: (
    operacionId: number,
    excluida: boolean,
    motivo?: string | null,
  ) => Promise<void>;
  onOpenAssignTarifa: (operacion: Operacion) => void;
}> = ({ operaciones, editable, onUpdateExclusion, onOpenAssignTarifa }) => {
  const [filtroEstado, setFiltroEstado] = useState<OperacionEstado | ''>('');
  const [buscar, setBuscar] = useState('');
  const [ocultarExcluidas, setOcultarExcluidas] = useState(false);
  const [pagina, setPagina] = useState(0);
  const POR_PAGINA = 50;

  const filtradas = operaciones.filter((o) => {
    if (ocultarExcluidas && o.excluida) return false;
    if (filtroEstado && o.estado !== filtroEstado) return false;
    if (buscar) {
      const q = buscar.toLowerCase();
      return (
        (o.dominio ?? '').toLowerCase().includes(q) ||
        (o.concepto ?? '').toLowerCase().includes(q) ||
        (o.distribuidor_nombre ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPaginas = Math.ceil(filtradas.length / POR_PAGINA);
  const pagina_clamp = Math.min(pagina, Math.max(0, totalPaginas - 1));
  const visibles = filtradas.slice(pagina_clamp * POR_PAGINA, (pagina_clamp + 1) * POR_PAGINA);
  const excluidasCount = operaciones.filter((o) => o.excluida).length;

  return (
    <div>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          style={inputStyle}
          type="text"
          placeholder="Buscar patente, concepto, distribuidor…"
          value={buscar}
          onChange={(e) => {
            setBuscar(e.target.value);
            setPagina(0);
          }}
        />
        <select
          style={inputStyle}
          value={filtroEstado}
          onChange={(e) => {
            setFiltroEstado(e.target.value as OperacionEstado | '');
            setPagina(0);
          }}
        >
          <option value="">Todos los estados</option>
          {OPERACION_ESTADOS.map((e) => (
            <option key={e} value={e}>
              {OPERACION_ESTADO_LABEL[e]}
            </option>
          ))}
        </select>
        <label
          style={{
            alignSelf: 'center',
            display: 'flex',
            gap: 6,
            fontSize: 13,
            color: '#374151',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={ocultarExcluidas}
            onChange={(e) => {
              setOcultarExcluidas(e.target.checked);
              setPagina(0);
            }}
          />
          Ocultar excluidas
        </label>
        <span style={{ alignSelf: 'center', color: '#6b7280', fontSize: 13 }}>
          {filtradas.length} operaciones{excluidasCount > 0 ? ` · ${excluidasCount} excluidas` : ''}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th style={thStyle}>Patente</th>
              <th style={thStyle}>Distribuidor</th>
              <th style={thStyle}>Concepto</th>
              <th style={thStyle}>Valor cliente</th>
              <th style={thStyle}>Tarifa original</th>
              <th style={thStyle}>Val. distribuidor</th>
              <th style={thStyle}>Diferencia</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Obs.</th>
              <th style={thStyle}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((o) => (
              <tr
                key={o.id}
                style={{
                  borderBottom: '1px solid #f3f4f6',
                  background: o.excluida ? '#f9fafb' : undefined,
                  opacity: o.excluida ? 0.75 : 1,
                }}
              >
                <td style={tdStyle}>{o.dominio ?? '—'}</td>
                <td style={tdStyle}>{o.distribuidor_nombre ?? '—'}</td>
                <td style={tdStyle}>{o.concepto ?? '—'}</td>
                <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                  {formatPeso(o.valor_cliente)}
                </td>
                <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                  {o.valor_tarifa_original != null ? formatPeso(o.valor_tarifa_original) : '—'}
                </td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600 }}>
                  {o.valor_tarifa_distribuidor != null
                    ? formatPeso(o.valor_tarifa_distribuidor)
                    : '—'}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontFamily: 'monospace',
                    color:
                      o.diferencia_cliente != null && o.diferencia_cliente !== 0
                        ? '#d97706'
                        : undefined,
                  }}
                >
                  {o.diferencia_cliente != null ? formatPeso(o.diferencia_cliente) : '—'}
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      background: OPERACION_ESTADO_COLOR[o.estado] + '22',
                      color: OPERACION_ESTADO_COLOR[o.estado],
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {OPERACION_ESTADO_LABEL[o.estado]}
                  </span>
                  {o.excluida && (
                    <span
                      style={{
                        marginLeft: 8,
                        background: '#6b728022',
                        color: '#6b7280',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                      title={o.motivo_exclusion ?? ''}
                    >
                      Excluida
                    </span>
                  )}
                </td>
                <td style={tdStyle} title={(o.excluida ? o.motivo_exclusion : o.observacion) ?? ''}>
                  {o.excluida
                    ? o.motivo_exclusion
                      ? o.motivo_exclusion.length > 40
                        ? o.motivo_exclusion.slice(0, 40) + '…'
                        : o.motivo_exclusion
                      : '—'
                    : o.observacion
                      ? o.observacion.length > 40
                        ? o.observacion.slice(0, 40) + '…'
                        : o.observacion
                      : '—'}
                </td>
                <td style={tdStyle}>
                  {!editable && <span style={{ color: '#9ca3af' }}>—</span>}
                  {editable && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        style={{
                          ...btnSmallStyle,
                          background: o.excluida ? '#ecfdf5' : '#fef2f2',
                          borderColor: o.excluida ? '#a7f3d0' : '#fecaca',
                          color: o.excluida ? '#065f46' : '#991b1b',
                          fontWeight: 700,
                        }}
                        onClick={() => {
                          if (o.excluida) {
                            const ok = window.confirm('¿Incluir esta operación nuevamente?');
                            if (!ok) return;
                            void onUpdateExclusion(o.id, false, null);
                            return;
                          }
                          const motivo = window.prompt('Motivo de exclusión (opcional):') ?? '';
                          void onUpdateExclusion(o.id, true, motivo.trim() || null);
                        }}
                        title={o.excluida ? 'Incluir operación' : 'Excluir operación'}
                      >
                        {o.excluida ? 'Incluir' : 'Excluir'}
                      </button>

                      {(o.linea_tarifa_id == null || o.estado === 'sin_tarifa') && (
                        <button
                          type="button"
                          style={{
                            ...btnSmallStyle,
                            background: '#eff6ff',
                            borderColor: '#bfdbfe',
                            color: '#1d4ed8',
                            fontWeight: 700,
                          }}
                          onClick={() => onOpenAssignTarifa(o)}
                          title="Asigna una línea de tarifa manualmente a esta operación"
                        >
                          Asignar tarifa
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
          <button
            style={btnSmallStyle}
            disabled={pagina_clamp === 0}
            onClick={() => setPagina((p) => p - 1)}
          >
            ← Anterior
          </button>
          <span style={{ alignSelf: 'center', fontSize: 13, color: '#6b7280' }}>
            {pagina_clamp + 1} / {totalPaginas}
          </span>
          <button
            style={btnSmallStyle}
            disabled={pagina_clamp >= totalPaginas - 1}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Componente principal ────────────────────────────────────────────────────

export const ExtractosTab: React.FC<Props> = ({ apiBaseUrl, buildActorHeaders }) => {
  const [clientes, setClientes] = useState<LiqClienteLiq[]>([]);
  const [runs, setRuns] = useState<LiquidacionCliente[]>([]);
  const [runSeleccionado, setRunSeleccionado] = useState<LiquidacionCliente | null>(null);
  const [selectedRunIdFromStorage] = useState<number | null>(() => readStoredSelectedRunId());
  const [operaciones, setOperaciones] = useState<Operacion[]>([]);
  const [cargandoRuns, setCargandoRuns] = useState(false);
  const [cargandoOps, setCargandoOps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accionando, setAccionando] = useState(false);
  const [accionMsg, setAccionMsg] = useState<string | null>(null);
  const [missingConcepts, setMissingConcepts] = useState<Array<{ concepto: string; count: number }>>(
    [],
  );

  // Asignación manual de tarifa (por operación)
  const [tarifaModalOp, setTarifaModalOp] = useState<Operacion | null>(null);
  const [tarifaEsquema, setTarifaEsquema] = useState<EsquemaTarifario | null>(null);
  const [tarifaLineas, setTarifaLineas] = useState<LineaTarifa[]>([]);
  const [tarifaSelectedId, setTarifaSelectedId] = useState<number | null>(null);
  const [tarifaQuery, setTarifaQuery] = useState('');
  const [tarifaSoloSucursal, setTarifaSoloSucursal] = useState(true);
  const [tarifaMotivo, setTarifaMotivo] = useState('');
  const [tarifaLoading, setTarifaLoading] = useState(false);
  const [tarifaError, setTarifaError] = useState<string | null>(null);

  // Formulario de carga
  const [form, setForm] = useState<PeriodoForm>(() => readStoredExtractosForm());
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Opciones para autocompletar "Sucursal tarifa" (según mapeos del cliente + runs existentes)
  const [sucursalOptionsFromTarifas, setSucursalOptionsFromTarifas] = useState<string[]>([]);
  const [sucursalOptionsFromMapeos, setSucursalOptionsFromMapeos] = useState<string[]>([]);
  const sucursalOptions = useMemo(() => {
    if (sucursalOptionsFromTarifas.length > 0) return sucursalOptionsFromTarifas;

    const set = new Set<string>();
    for (const s of sucursalOptionsFromMapeos) {
      const v = s.trim();
      if (v) set.add(v);
    }
    for (const r of runs) {
      if (form.clienteId && String(r.cliente_id) !== String(form.clienteId)) continue;
      const v = String(r.sucursal_tarifa ?? '').trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [form.clienteId, runs, sucursalOptionsFromMapeos]);

  // Persistir el formulario para que al ir/volver no se "borre" todo
  useEffect(() => {
    try {
      localStorage.setItem(EXTRACTOS_FORM_STORAGE_KEY, JSON.stringify(form));
    } catch {
      // ignore
    }
  }, [form]);

  // Persistir el extracto seleccionado
  useEffect(() => {
    try {
      if (runSeleccionado?.id) {
        localStorage.setItem(EXTRACTOS_SELECTED_RUN_ID_STORAGE_KEY, String(runSeleccionado.id));
      } else {
        localStorage.removeItem(EXTRACTOS_SELECTED_RUN_ID_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [runSeleccionado]);

  // ── Cargar clientes ──────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/liq/clientes`, {
          credentials: 'include',
          headers: { ...buildActorHeaders(), Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(await readApiErrorMessage(res));
        const data = await readJsonOrThrow<{ data?: LiqClienteLiq[] }>(res);
        setClientes(data.data ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los clientes.');
      }
    };
    void load();
  }, [apiBaseUrl, buildActorHeaders]);

  // Si hay un único cliente activo y no hay selección previa, autoseleccionar
  useEffect(() => {
    if (form.clienteId) return;
    if (clientes.length !== 1) return;
    setForm((p) => ({ ...p, clienteId: String(clientes[0]!.id) }));
  }, [clientes, form.clienteId]);

  // ── Cargar opciones de sucursal (desde tarifas: dimensión "sucursal") ──
  useEffect(() => {
    const clienteId = form.clienteId;
    if (!clienteId) {
      setSucursalOptionsFromTarifas([]);
      return;
    }

    const load = async () => {
      try {
        const resEsquemas = await fetch(`${apiBaseUrl}/api/liq/clientes/${clienteId}/esquemas`, {
          credentials: 'include',
          headers: { ...buildActorHeaders(), Accept: 'application/json' },
        });
        if (!resEsquemas.ok) return;
        const dataEsq = await readJsonOrThrow<{ data?: EsquemaTarifario[] }>(resEsquemas);
        const lista = dataEsq.data ?? [];
        const activo = lista.find((e) => e.activo) ?? lista[0];
        if (!activo?.id) return;

        const resDim = await fetch(`${apiBaseUrl}/api/liq/esquemas/${activo.id}/dimensiones`, {
          credentials: 'include',
          headers: { ...buildActorHeaders(), Accept: 'application/json' },
        });
        if (!resDim.ok) return;
        const dataDim = await readJsonOrThrow<{ data?: DimensionTarifaValor[] }>(resDim);
        const valores = (dataDim.data ?? [])
          .filter((v) => String(v.nombre_dimension ?? '').toLowerCase() === 'sucursal')
          .filter((v) => v.activo)
          .map((v) => String(v.valor ?? '').trim())
          .filter(Boolean);

        const uniq = Array.from(new Set(valores)).sort((a, b) => a.localeCompare(b));
        setSucursalOptionsFromTarifas(uniq);
      } catch {
        // ignore (autocompletado opcional)
      }
    };

    void load();
  }, [apiBaseUrl, buildActorHeaders, form.clienteId]);

  // ── Cargar opciones de sucursal (mapeos) ───────────────────────────────
  useEffect(() => {
    const clienteId = form.clienteId;
    if (!clienteId) {
      setSucursalOptionsFromMapeos([]);
      return;
    }

    const load = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/liq/clientes/${clienteId}/mapeos-sucursal`, {
          credentials: 'include',
          headers: { ...buildActorHeaders(), Accept: 'application/json' },
        });
        if (!res.ok) return;
        const data = await readJsonOrThrow<{ data?: Array<{ sucursal_tarifa?: string | null }> }>(res);
        const opts = (data.data ?? [])
          .map((m) => String(m.sucursal_tarifa ?? '').trim())
          .filter(Boolean);
        setSucursalOptionsFromMapeos(Array.from(new Set(opts)).sort((a, b) => a.localeCompare(b)));
      } catch {
        // ignore (autocompletado opcional)
      }
    };

    void load();
  }, [apiBaseUrl, buildActorHeaders, form.clienteId]);

  // ── Cargar runs ──────────────────────────────────────────────────────────
  const cargarRuns = useCallback(async () => {
    setCargandoRuns(true);
    try {
      const params = new URLSearchParams();
      if (form.clienteId) params.set('cliente_id', form.clienteId);
      const res = await fetch(`${apiBaseUrl}/api/liq/liquidaciones?${params.toString()}`, {
        credentials: 'include',
        headers: { ...buildActorHeaders(), Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await readJsonOrThrow<{ data?: LiquidacionCliente[] }>(res);
      setRuns(data.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los extractos.');
    } finally {
      setCargandoRuns(false);
    }
  }, [apiBaseUrl, buildActorHeaders, form.clienteId]);

  useEffect(() => {
    void cargarRuns();
  }, [cargarRuns]);

  // ── Restaurar selección desde storage (si existe) ───────────────────────
  useEffect(() => {
    if (runSeleccionado) return;
    if (!selectedRunIdFromStorage) return;
    const found = runs.find((r) => r.id === selectedRunIdFromStorage);
    if (found) setRunSeleccionado(found);
  }, [runSeleccionado, runs, selectedRunIdFromStorage]);

  // ── Cargar operaciones cuando se selecciona un run ───────────────────────
  useEffect(() => {
    if (!runSeleccionado) {
      setOperaciones([]);
      return;
    }
    const load = async () => {
      setCargandoOps(true);
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/liq/liquidaciones/${runSeleccionado.id}/operaciones`,
          { credentials: 'include', headers: { ...buildActorHeaders(), Accept: 'application/json' } },
        );
        if (!res.ok) throw new Error(await readApiErrorMessage(res));
        const data = await readJsonOrThrow<{ data?: Operacion[] }>(res);
        setOperaciones(data.data ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar las operaciones.');
      } finally {
        setCargandoOps(false);
      }
    };
    void load();
  }, [apiBaseUrl, buildActorHeaders, runSeleccionado]);

  // ── Subir archivo ────────────────────────────────────────────────────────
  const handleSubir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivo || !form.clienteId || !form.periodoDesde || !form.periodoHasta) return;

    setSubiendo(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('archivo', archivo);
      fd.append('cliente_id', form.clienteId);
      fd.append('periodo_desde', form.periodoDesde);
      fd.append('periodo_hasta', form.periodoHasta);
      if (form.sucursalTarifa) fd.append('sucursal_tarifa', form.sucursalTarifa);

      const res = await fetch(`${apiBaseUrl}/api/liq/liquidaciones/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...buildActorHeaders(), Accept: 'application/json' },
        body: fd,
      });

      if (!res.ok) throw new Error(await readApiErrorMessage(res));

      const data = await readJsonOrThrow<{ data?: LiquidacionCliente }>(res);
      if (data.data) {
        setRuns((prev) => [data.data!, ...prev]);
        setRunSeleccionado(data.data);
      }

      setArchivo(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setForm((p) => ({ ...p, sucursalTarifa: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo.');
    } finally {
      setSubiendo(false);
    }
  };

  // ── Aprobar run ──────────────────────────────────────────────────────────
  const handleAprobar = async () => {
    if (!runSeleccionado) return;
    setAccionando(true);
    setAccionMsg(null);
    setMissingConcepts([]);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/liq/liquidaciones/${runSeleccionado.id}/aprobar`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { ...buildActorHeaders(), Accept: 'application/json' },
        },
      );
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await readJsonOrThrow<{ data?: LiquidacionCliente; message?: string }>(res);
      if (data.data) {
        setRunSeleccionado((prev) =>
          prev && prev.id === data.data!.id ? ({ ...prev, ...data.data! } as LiquidacionCliente) : data.data!,
        );
        setRuns((prev) =>
          prev.map((r) => (r.id === data.data!.id ? ({ ...r, ...data.data! } as LiquidacionCliente) : r)),
        );
      }
      setAccionMsg(data.message ?? 'Extracto aprobado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al aprobar.');
    } finally {
      setAccionando(false);
    }
  };

  // ── Borrar run ──────────────────────────────────────────────────────────
  const handleBorrar = async () => {
    if (!runSeleccionado) return;
    const label = runSeleccionado.archivo_origen
      ? `${runSeleccionado.archivo_origen} (#${runSeleccionado.id})`
      : `Extracto #${runSeleccionado.id}`;
    const ok = window.confirm(
      `¿Borrar ${label}?\n\nEsto elimina también sus operaciones y liquidaciones por distribuidor (si existieran).`,
    );
    if (!ok) return;

    setAccionando(true);
    setAccionMsg(null);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/liq/liquidaciones/${runSeleccionado.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { ...buildActorHeaders(), Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      await readJsonOrThrow<{ message?: string }>(res);

      setRuns((prev) => prev.filter((r) => r.id !== runSeleccionado.id));
      setRunSeleccionado(null);
      setOperaciones([]);
      setAccionMsg('Extracto borrado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al borrar.');
    } finally {
      setAccionando(false);
    }
  };

  // ── Recalcular cruce tarifario ───────────────────────────────────────────
  const handleRecalcular = async () => {
    if (!runSeleccionado) return;
    setAccionando(true);
    setAccionMsg(null);
    setError(null);
    setMissingConcepts([]);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/liq/liquidaciones/${runSeleccionado.id}/recalcular`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { ...buildActorHeaders(), Accept: 'application/json' },
        },
      );
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await readJsonOrThrow<{
        data?: { liquidacion?: LiquidacionCliente; missing_concepts?: Array<{ concepto: string; count: number }> };
        message?: string;
      }>(res);

      const updated = data.data?.liquidacion;
      if (updated) {
        setRunSeleccionado(updated);
        setRuns((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      }

      // Recargar operaciones visibles
      const opsRes = await fetch(
        `${apiBaseUrl}/api/liq/liquidaciones/${runSeleccionado.id}/operaciones`,
        { credentials: 'include', headers: { ...buildActorHeaders(), Accept: 'application/json' } },
      );
      if (opsRes.ok) {
        const opsData = await readJsonOrThrow<{ data?: Operacion[] }>(opsRes);
        setOperaciones(opsData.data ?? []);
      }

      const missing = data.data?.missing_concepts ?? [];
      setMissingConcepts(missing);
      if (missing.length > 0) {
        const top = missing.slice(0, 3).map((m) => `${m.concepto} (${m.count})`).join(' · ');
        setAccionMsg(`Recalculo realizado. Faltan mapeos: ${top}${missing.length > 3 ? '…' : ''}`);
      } else {
        setAccionMsg(data.message ?? 'Recalculo realizado.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al recalcular.');
    } finally {
      setAccionando(false);
    }
  };

  // ── Excluir/Incluir operación ────────────────────────────────────────────
  const handleUpdateExclusion = useCallback(
    async (operacionId: number, excluida: boolean, motivo?: string | null) => {
      if (!runSeleccionado) return;
      setAccionando(true);
      setAccionMsg(null);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/api/liq/operaciones/${operacionId}/exclusion`, {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            ...buildActorHeaders(),
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ excluida, motivo: motivo ?? null }),
        });
        if (!res.ok) throw new Error(await readApiErrorMessage(res));
        const data = await readJsonOrThrow<{
          data?: { operacion?: Operacion; liquidacion?: LiquidacionCliente };
          message?: string;
        }>(res);

        const updatedOp = data.data?.operacion;
        const updatedLiq = data.data?.liquidacion;

        if (updatedOp) {
          setOperaciones((prev) => prev.map((o) => (o.id === updatedOp.id ? updatedOp : o)));
        }
        if (updatedLiq) {
          setRunSeleccionado(updatedLiq);
          setRuns((prev) => prev.map((r) => (r.id === updatedLiq.id ? updatedLiq : r)));
        }

        setAccionMsg(data.message ?? (excluida ? 'Operación excluida.' : 'Operación incluida.'));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al actualizar la operación.');
      } finally {
        setAccionando(false);
      }
    },
    [apiBaseUrl, buildActorHeaders, runSeleccionado],
  );

  const handleOpenAssignTarifa = useCallback(
    async (operacion: Operacion) => {
      if (!runSeleccionado) return;

      setTarifaModalOp(operacion);
      setTarifaSelectedId(null);
      setTarifaQuery('');
      setTarifaMotivo('');
      setTarifaError(null);
      setTarifaEsquema(null);
      setTarifaLineas([]);
      setTarifaSoloSucursal(Boolean(runSeleccionado.sucursal_tarifa));
      setTarifaLoading(true);

      try {
        const esquemasRes = await fetch(
          `${apiBaseUrl}/api/liq/clientes/${runSeleccionado.cliente_id}/esquemas`,
          {
            credentials: 'include',
            headers: { ...buildActorHeaders(), Accept: 'application/json' },
          },
        );
        if (!esquemasRes.ok) throw new Error(await readApiErrorMessage(esquemasRes));
        const esquemasData = await readJsonOrThrow<{ data?: EsquemaTarifario[] }>(esquemasRes);

        const esquemaActivo =
          (esquemasData.data ?? []).find((e) => e.activo) ?? null;
        if (!esquemaActivo) {
          throw new Error('El cliente no tiene un esquema tarifario activo.');
        }

        setTarifaEsquema(esquemaActivo);

        const lineasRes = await fetch(
          `${apiBaseUrl}/api/liq/esquemas/${esquemaActivo.id}/lineas`,
          {
            credentials: 'include',
            headers: { ...buildActorHeaders(), Accept: 'application/json' },
          },
        );
        if (!lineasRes.ok) throw new Error(await readApiErrorMessage(lineasRes));
        const lineasData = await readJsonOrThrow<{ data?: LineaTarifa[] }>(lineasRes);

        const aprobadasActivas = (lineasData.data ?? []).filter(
          (l) => Boolean(l.activo) && l.aprobado_por != null,
        );
        setTarifaLineas(aprobadasActivas);
      } catch (e) {
        setTarifaError(e instanceof Error ? e.message : 'No se pudieron cargar las tarifas.');
      } finally {
        setTarifaLoading(false);
      }
    },
    [apiBaseUrl, buildActorHeaders, runSeleccionado],
  );

  const handleAssignTarifa = useCallback(async () => {
    if (!tarifaModalOp || !tarifaSelectedId) return;
    if (!runSeleccionado) return;

    setAccionando(true);
    setAccionMsg(null);
    setError(null);
    setTarifaError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/liq/operaciones/${tarifaModalOp.id}/asignar-tarifa`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          ...buildActorHeaders(),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          linea_tarifa_id: tarifaSelectedId,
          motivo: tarifaMotivo.trim() || null,
        }),
      });

      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await readJsonOrThrow<{
        data?: { operacion?: Operacion; liquidacion?: LiquidacionCliente };
        message?: string;
      }>(res);

      const updatedOp = data.data?.operacion;
      const updatedLiq = data.data?.liquidacion;

      if (updatedOp) {
        setOperaciones((prev) => prev.map((o) => (o.id === updatedOp.id ? updatedOp : o)));
      }
      if (updatedLiq) {
        setRunSeleccionado(updatedLiq);
        setRuns((prev) => prev.map((r) => (r.id === updatedLiq.id ? updatedLiq : r)));
      }

      setAccionMsg(data.message ?? 'Tarifa asignada.');
      setTarifaModalOp(null);
    } catch (e) {
      setTarifaError(e instanceof Error ? e.message : 'No se pudo asignar la tarifa.');
    } finally {
      setAccionando(false);
    }
  }, [apiBaseUrl, buildActorHeaders, runSeleccionado, tarifaModalOp, tarifaMotivo, tarifaSelectedId]);

  // ── Generar liquidaciones por distribuidor ───────────────────────────────
  const handleGenerarDistribuidores = async () => {
    if (!runSeleccionado) return;
    setAccionando(true);
    setAccionMsg(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/liq/liquidaciones/${runSeleccionado.id}/generar-distribuidores`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { ...buildActorHeaders(), Accept: 'application/json' },
        },
      );
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await readJsonOrThrow<{ message?: string; count?: number }>(res);
      setAccionMsg(
        data.message ?? `Se generaron ${data.count ?? 0} liquidaciones por distribuidor.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar.');
    } finally {
      setAccionando(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const tarifaSucursalPref = (runSeleccionado?.sucursal_tarifa ?? '').trim();
  const tarifaLineasFiltradas = tarifaLineas
    .filter((l) => {
      if (!tarifaSoloSucursal || !tarifaSucursalPref) return true;
      const suc = (l.dimensiones_valores?.sucursal ?? '').toString().trim();
      return suc.toLowerCase() === tarifaSucursalPref.toLowerCase();
    })
    .filter((l) => {
      const q = tarifaQuery.trim().toLowerCase();
      if (!q) return true;
      const dims = Object.entries(l.dimensiones_valores ?? {})
        .map(([k, v]) => `${k}:${v}`)
        .join(' | ')
        .toLowerCase();
      return (
        dims.includes(q) ||
        String(l.precio_original ?? '').toLowerCase().includes(q) ||
        String(l.precio_distribuidor ?? '').toLowerCase().includes(q)
      );
    })
    .slice(0, 250);

  return (
    <div style={panelStyle}>
      <h2 style={sectionTitleStyle}>Extractos BI/ERP</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
        Cargá los archivos Excel enviados por cada cliente. El sistema normaliza, cruza con la
        tarifa e identifica diferencias automáticamente.
      </p>

      {error && (
        <div style={errorBoxStyle}>
          {error}
          <button style={{ marginLeft: 12, fontSize: 12 }} onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
        {/* ── Panel izquierdo: carga + lista de runs ── */}
        <div>
          {/* Formulario de carga */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Cargar archivo</h3>
            <form onSubmit={(e) => void handleSubir(e)}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={formFieldStyle}>
                  <label style={labelStyle}>Cliente *</label>
                  <select
                    style={inputStyle}
                    required
                    value={form.clienteId}
                    onChange={(e) => setForm((p) => ({ ...p, clienteId: e.target.value }))}
                  >
                    <option value="">— Seleccionar —</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre_corto}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={formFieldStyle}>
                  <label style={labelStyle}>Período desde *</label>
                  <input
                    style={inputStyle}
                    type="date"
                    required
                    value={form.periodoDesde}
                    onChange={(e) => setForm((p) => ({ ...p, periodoDesde: e.target.value }))}
                  />
                </div>

                <div style={formFieldStyle}>
                  <label style={labelStyle}>Período hasta *</label>
                  <input
                    style={inputStyle}
                    type="date"
                    required
                    value={form.periodoHasta}
                    onChange={(e) => setForm((p) => ({ ...p, periodoHasta: e.target.value }))}
                  />
                </div>

                <div style={formFieldStyle}>
                  <label style={labelStyle}>Sucursal tarifa</label>
                  <input
                    style={inputStyle}
                    type="text"
                    list="liq-sucursal-tarifa-options"
                    placeholder="Ej: AMBA, Rosario…"
                    value={form.sucursalTarifa}
                    onChange={(e) => setForm((p) => ({ ...p, sucursalTarifa: e.target.value }))}
                  />
                  <datalist id="liq-sucursal-tarifa-options">
                    {sucursalOptions.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>
                    Opcional. Se detecta automáticamente desde el nombre del archivo.
                  </span>
                </div>

                <div style={formFieldStyle}>
                  <label style={labelStyle}>Archivo Excel (.xlsx) *</label>
                  <input
                    ref={fileInputRef}
                    style={inputStyle}
                    type="file"
                    accept=".xlsx,.xls"
                    required
                    onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                  />
                </div>

                <button
                  type="submit"
                  style={{ ...btnPrimaryStyle, width: '100%' }}
                  disabled={subiendo}
                >
                  {subiendo ? 'Procesando…' : 'Cargar y procesar'}
                </button>
              </div>
            </form>
          </div>

          {/* Lista de extractos */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
              Extractos cargados
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div />
              <button
                type="button"
                style={{ ...btnSmallStyle, marginBottom: 10 }}
                disabled={cargandoRuns}
                onClick={() => void cargarRuns()}
                title="Vuelve a consultar la API"
              >
                {cargandoRuns ? 'Cargando…' : 'Refrescar'}
              </button>
            </div>
            {cargandoRuns && <p style={{ color: '#6b7280', fontSize: 13 }}>Cargando…</p>}
            {!cargandoRuns && runs.length === 0 && (
              <p style={{ color: '#9ca3af', fontSize: 13 }}>Sin extractos para los filtros seleccionados.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {runs.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  style={{
                    textAlign: 'left',
                    background: runSeleccionado?.id === r.id ? '#eff6ff' : '#f9fafb',
                    border:
                      runSeleccionado?.id === r.id
                        ? '1px solid #2563eb'
                        : '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                  onClick={() => setRunSeleccionado(r)}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                    {r.archivo_origen ? `${r.archivo_origen} · #${r.id}` : `Extracto #${r.id}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {r.cliente_nombre ?? `Cliente ${r.cliente_id}`} ·{' '}
                    {formatFecha(r.periodo_desde)} – {formatFecha(r.periodo_hasta)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <span
                      style={{
                        ...ESTADO_BADGE_STYLE[r.estado],
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '1px 7px',
                        borderRadius: 4,
                      }}
                    >
                      {LIQ_CLIENTE_ESTADO_LABEL[r.estado]}
                    </span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>
                      {r.total_operaciones} ops.
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Panel derecho: detalle del run seleccionado ── */}
        <div>
          {!runSeleccionado && (
            <div
              style={{
                ...cardStyle,
                textAlign: 'center',
                color: '#9ca3af',
                padding: 60,
              }}
            >
              Seleccioná un extracto de la lista para ver su detalle.
            </div>
          )}

          {runSeleccionado && (
            <>
              {/* Header del run */}
              <div style={{ ...cardStyle, background: '#f0f9ff' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>
                      {(runSeleccionado.archivo_origen ?? 'Extracto') + ` · #${runSeleccionado.id}`}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>
                      {runSeleccionado.cliente_nombre} · Período{' '}
                      {formatFecha(runSeleccionado.periodo_desde)} –{' '}
                      {formatFecha(runSeleccionado.periodo_hasta)}
                      {runSeleccionado.sucursal_tarifa && (
                        <> · Sucursal: <strong>{runSeleccionado.sucursal_tarifa}</strong></>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        ...ESTADO_BADGE_STYLE[runSeleccionado.estado],
                        padding: '4px 12px',
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      {LIQ_CLIENTE_ESTADO_LABEL[runSeleccionado.estado]}
                    </span>

                    {runSeleccionado.estado === 'auditada' && (
                      <button
                        type="button"
                        style={{ ...btnPrimaryStyle, background: '#0ea5e9' }}
                        disabled={accionando}
                        onClick={() => void handleRecalcular()}
                        title="Recalcula el cruce con mapeos/tarifas actuales (sin re-subir Excel)"
                      >
                        {accionando ? '…' : '↻ Recalcular'}
                      </button>
                    )}

                    {runSeleccionado.estado === 'auditada' && (
                      <button
                        type="button"
                        style={btnPrimaryStyle}
                        disabled={accionando}
                        onClick={() => void handleAprobar()}
                      >
                        {accionando ? '…' : '✓ Aprobar'}
                      </button>
                    )}

                    <button
                      type="button"
                      style={{
                        ...btnPrimaryStyle,
                        background: '#dc2626',
                      }}
                      disabled={accionando}
                      onClick={() => void handleBorrar()}
                      title="Borra el extracto y sus datos derivados"
                    >
                      {accionando ? '…' : '🗑 Borrar'}
                    </button>

                    {runSeleccionado.estado === 'aprobada' && (
                      <button
                        type="button"
                        style={{ ...btnPrimaryStyle, background: '#059669' }}
                        disabled={accionando}
                        onClick={() => void handleGenerarDistribuidores()}
                      >
                        {accionando ? '…' : 'Generar liquidaciones'}
                      </button>
                    )}
                  </div>
                </div>

                {accionMsg && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: '8px 12px',
                      background: '#d1fae5',
                      borderRadius: 6,
                      color: '#065f46',
                      fontSize: 13,
                    }}
                  >
                    {accionMsg}
                  </div>
                )}
                {!accionMsg && missingConcepts.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 13, color: '#92400e' }}>
                    Faltan mapeos de concepto: {missingConcepts[0]?.concepto}…
                  </div>
                )}
              </div>

              {/* Resumen estadístico */}
              {cargandoOps && <p style={{ color: '#6b7280' }}>Cargando operaciones…</p>}
              {!cargandoOps && operaciones.length > 0 && (
                <>
                  <RunResumen run={runSeleccionado} operaciones={operaciones} />
                  <div style={cardStyle}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
                      Detalle de operaciones
                    </h3>
                    <OperacionesTable
                      operaciones={operaciones}
                      editable={!accionando && !['aprobada', 'rechazada'].includes(runSeleccionado.estado)}
                      onUpdateExclusion={handleUpdateExclusion}
                      onOpenAssignTarifa={(op) => void handleOpenAssignTarifa(op)}
                    />
                  </div>
                </>
              )}
              {!cargandoOps && operaciones.length === 0 && (
                <div style={{ ...cardStyle, color: '#9ca3af', textAlign: 'center' }}>
                  Sin operaciones procesadas todavía.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal: asignar tarifa manual */}
      {tarifaModalOp && (
        <div
          style={modalOverlayStyle}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setTarifaModalOp(null);
          }}
        >
          <div style={modalCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Asignar tarifa</div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>
                  Operación #{tarifaModalOp.id} · {tarifaModalOp.dominio ?? '—'} · {tarifaModalOp.concepto ?? '—'}
                  {tarifaEsquema?.nombre ? ` · ${tarifaEsquema.nombre}` : ''}
                </div>
              </div>
              <button
                type="button"
                style={btnSmallStyle}
                onClick={() => setTarifaModalOp(null)}
                disabled={accionando}
              >
                ✕
              </button>
            </div>

            {tarifaError && (
              <div style={{ ...errorBoxStyle, marginTop: 12, marginBottom: 0 }}>
                {tarifaError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
              <input
                style={{ ...inputStyle, flex: 1, minWidth: 220 }}
                value={tarifaQuery}
                onChange={(e) => setTarifaQuery(e.target.value)}
                placeholder="Buscar por dimensiones (ej: concepto:ut. mediano)…"
              />
              {tarifaSucursalPref && (
                <label style={{ alignSelf: 'center', display: 'flex', gap: 6, fontSize: 13, color: '#374151' }}>
                  <input
                    type="checkbox"
                    checked={tarifaSoloSucursal}
                    onChange={(e) => setTarifaSoloSucursal(e.target.checked)}
                  />
                  Solo {tarifaSucursalPref}
                </label>
              )}
            </div>

            <div style={{ marginTop: 10, maxHeight: 340, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={thStyle}></th>
                    <th style={thStyle}>Dimensiones</th>
                    <th style={thStyle}>Precio orig.</th>
                    <th style={thStyle}>% Ag.</th>
                    <th style={thStyle}>Precio dist.</th>
                    <th style={thStyle}>Vigencia</th>
                  </tr>
                </thead>
                <tbody>
                  {tarifaLoading && (
                    <tr>
                      <td colSpan={6} style={{ padding: 16, color: '#6b7280' }}>Cargando tarifas…</td>
                    </tr>
                  )}
                  {!tarifaLoading && tarifaLineasFiltradas.map((l) => {
                    const dimsLabel = Object.entries(l.dimensiones_valores ?? {})
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' · ');
                    const vig = `${formatFecha(String(l.vigencia_desde))}${l.vigencia_hasta ? ` → ${formatFecha(String(l.vigencia_hasta))}` : ''}`;
                    const selected = tarifaSelectedId === l.id;
                    return (
                      <tr
                        key={l.id}
                        style={{
                          borderBottom: '1px solid #f3f4f6',
                          background: selected ? '#eff6ff' : undefined,
                          cursor: 'pointer',
                        }}
                        onClick={() => setTarifaSelectedId(l.id)}
                      >
                        <td style={{ ...tdStyle, width: 30 }}>
                          <input type="radio" checked={selected} readOnly />
                        </td>
                        <td style={tdStyle}>{dimsLabel || `#${l.id}`}</td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{formatPeso(Number(l.precio_original ?? 0))}</td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{Number(l.porcentaje_agencia ?? 0).toFixed(2)}%</td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 700 }}>{formatPeso(Number(l.precio_distribuidor ?? 0))}</td>
                        <td style={tdStyle}>{vig}</td>
                      </tr>
                    );
                  })}
                  {!tarifaLoading && tarifaLineasFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: 16, color: '#9ca3af' }}>
                        Sin líneas para el filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 10 }}>
              <label style={{ ...labelStyle, marginBottom: 4 }}>Motivo (opcional)</label>
              <input
                style={inputStyle}
                value={tarifaMotivo}
                onChange={(e) => setTarifaMotivo(e.target.value)}
                placeholder="Ej: Ajuste manual por caso especial…"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                style={btnSmallStyle}
                onClick={() => setTarifaModalOp(null)}
                disabled={accionando}
              >
                Cancelar
              </button>
              <button
                type="button"
                style={{ ...btnPrimaryStyle, background: '#1d4ed8' }}
                onClick={() => void handleAssignTarifa()}
                disabled={accionando || !tarifaSelectedId}
              >
                {accionando ? '…' : 'Asignar'}
              </button>
            </div>
          </div>
        </div>
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
const btnSmallStyle: React.CSSProperties = {
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 5,
  padding: '4px 12px',
  fontSize: 13,
  cursor: 'pointer',
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 50,
};

const modalCardStyle: React.CSSProperties = {
  width: 'min(980px, 100%)',
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 18px 40px rgba(0,0,0,0.25)',
  padding: 16,
};
