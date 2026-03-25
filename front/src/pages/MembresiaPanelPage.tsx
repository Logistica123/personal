import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  layoutVariant?: 'default' | 'panel';
  monitorView?: boolean;
};

type AuthUser = {
  id: number;
  name: string | null;
  email: string | null;
  role?: string | null;
  token?: string | null;
  permissions?: string[] | null;
};

type MembresiaPanelPageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  buildActorHeaders: (authUser: AuthUser | null | undefined) => Record<string, string>;
};

type PersonaInfo = {
  id: number;
  nombre: string;
  membresiaDesde: string | null;
  mesesActivos: number;
};

type Cuota = {
  id: number | null;
  periodo: string;
  monto: number | null;
  pagado: boolean;
  fechaPago: string | null;
  observaciones: string | null;
};

type BeneficioUso = {
  id: number;
  tramo: string;
  beneficioKey: string;
  beneficioLabel: string;
  fechaUso: string;
  observaciones: string | null;
};

type MembresiaData = {
  persona: PersonaInfo;
  cuotas: Cuota[];
  beneficioUsos: BeneficioUso[];
};

type CuotaFormState = {
  monto: string;
  pagado: boolean;
  fecha_pago: string;
  observaciones: string;
};

type BeneficioFormState = {
  tramo: string;
  beneficio_key: string;
  beneficio_label: string;
  fecha_uso: string;
  observaciones: string;
  customLabel: string;
  useCustomLabel: boolean;
};

const BENEFICIOS_POR_TRAMO: Record<string, Array<{ key: string; label: string }>> = {
  mes_1: [
    { key: 'descuento_combustible_3', label: '-3% en cuenta corriente de combustible' },
    { key: 'descuento_poliza_20', label: '-20% en póliza de seguro' },
    { key: 'cashback_repuestos_10', label: '-10% de cashback en repuestos y cubiertas' },
  ],
  mes_3: [
    { key: 'service_basico', label: '1 service básico gratuito (1/2 usos)' },
    { key: 'botella_agua', label: '1 botella de agua metálica de la empresa' },
  ],
  mes_6: [
    { key: 'descuento_combustible_5', label: '-5% en cuenta corriente de combustible' },
    { key: 'service_adicional_6', label: '1 service adicional gratuito (1/2 usos)' },
    { key: 'set_termo_mate', label: 'Set de termo y mate corporativo' },
    { key: 'cubierta_2x1', label: '1 cubierta o promo 2x1 en cubiertas' },
  ],
  mes_12: [
    { key: 'descuento_combustible_8', label: '-8% en cuenta corriente de combustible' },
    { key: 'service_adicional_12', label: '1 service adicional gratuito' },
    { key: 'eleccion_regalo', label: 'Elección: termo / vaso térmico / herramientas para vehículo' },
    { key: 'cubiertas_3x4', label: '2 cubiertas o promo 3x4 en cubiertas' },
  ],
};

const TRAMO_LABELS: Record<string, string> = {
  mes_1: 'Mes 1',
  mes_3: 'Mes 3',
  mes_6: 'Mes 6',
  mes_12: 'Mes 12',
};

function getTramo(mesesActivos: number): string {
  if (mesesActivos >= 12) return 'mes_12';
  if (mesesActivos >= 6) return 'mes_6';
  if (mesesActivos >= 3) return 'mes_3';
  if (mesesActivos >= 1) return 'mes_1';
  return '';
}

function getTramoLabel(tramo: string): string {
  const labels: Record<string, string> = {
    mes_1: 'Mes 1 ★',
    mes_3: 'Mes 3 ★★',
    mes_6: 'Mes 6 ★★★',
    mes_12: 'Mes 12 ★★★★',
  };
  return labels[tramo] ?? '-';
}

function formatPeriodo(periodo: string): string {
  const match = periodo.match(/^(\d{4})-(\d{2})$/);
  if (!match) return periodo;
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthIndex = parseInt(match[2], 10) - 1;
  return `${months[monthIndex] ?? match[2]} ${match[1]}`;
}

const defaultCuotaForm = (): CuotaFormState => ({
  monto: '',
  pagado: false,
  fecha_pago: '',
  observaciones: '',
});

const defaultBeneficioForm = (): BeneficioFormState => ({
  tramo: 'mes_1',
  beneficio_key: '',
  beneficio_label: '',
  fecha_uso: '',
  observaciones: '',
  customLabel: '',
  useCustomLabel: false,
});

export function MembresiaPanelPage({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  buildActorHeaders,
}: MembresiaPanelPageProps) {
  const { personaId } = useParams<{ personaId: string }>();
  const navigate = useNavigate();
  const authUser = useStoredAuthUser();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const actorHeaders = useMemo(() => buildActorHeaders(authUser), [authUser, buildActorHeaders]);

  const [data, setData] = useState<MembresiaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [expandedCuota, setExpandedCuota] = useState<string | null>(null);
  const [cuotaForms, setCuotaForms] = useState<Record<string, CuotaFormState>>({});
  const [cuotaSaving, setCuotaSaving] = useState<Record<string, boolean>>({});
  const [cuotaErrors, setCuotaErrors] = useState<Record<string, string>>({});

  const [beneficioForm, setBeneficioForm] = useState<BeneficioFormState>(defaultBeneficioForm);
  const [beneficioSaving, setBeneficioSaving] = useState(false);
  const [beneficioError, setBeneficioError] = useState<string | null>(null);
  const [deletingBeneficioId, setDeletingBeneficioId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!personaId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/personal/${personaId}/membresia`, {
        headers: { ...actorHeaders },
      });
      if (!resp.ok) {
        throw new Error(`Error ${resp.status}`);
      }
      const json: MembresiaData = await resp.json();
      setData(json);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Error al cargar membresía');
    } finally {
      setLoading(false);
    }
  }, [personaId, apiBaseUrl, actorHeaders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleCuota = useCallback(
    (periodo: string, cuota: Cuota) => {
      if (expandedCuota === periodo) {
        setExpandedCuota(null);
        return;
      }
      setExpandedCuota(periodo);
      setCuotaForms((prev) => ({
        ...prev,
        [periodo]: {
          monto: cuota.monto !== null ? String(cuota.monto) : '',
          pagado: cuota.pagado,
          fecha_pago: cuota.fechaPago ?? '',
          observaciones: cuota.observaciones ?? '',
        },
      }));
      setCuotaErrors((prev) => ({ ...prev, [periodo]: '' }));
    },
    [expandedCuota],
  );

  const handleSaveCuota = useCallback(
    async (periodo: string) => {
      if (!personaId) return;
      const form = cuotaForms[periodo] ?? defaultCuotaForm();
      setCuotaSaving((prev) => ({ ...prev, [periodo]: true }));
      setCuotaErrors((prev) => ({ ...prev, [periodo]: '' }));
      try {
        const body: Record<string, unknown> = {
          periodo,
          pagado: form.pagado,
        };
        if (form.monto !== '') {
          body.monto = parseFloat(form.monto);
        }
        if (form.fecha_pago) {
          body.fecha_pago = form.fecha_pago;
        }
        if (form.observaciones) {
          body.observaciones = form.observaciones;
        }
        const resp = await fetch(`${apiBaseUrl}/api/personal/${personaId}/membresia/cuotas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...actorHeaders },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData?.message ?? `Error ${resp.status}`);
        }
        const updated: Cuota = await resp.json();
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            cuotas: prev.cuotas.map((c) =>
              c.periodo === periodo
                ? {
                    id: updated.id,
                    periodo: updated.periodo,
                    monto: updated.monto,
                    pagado: updated.pagado,
                    fechaPago: updated.fechaPago,
                    observaciones: updated.observaciones,
                  }
                : c,
            ),
          };
        });
        setExpandedCuota(null);
      } catch (err: unknown) {
        setCuotaErrors((prev) => ({
          ...prev,
          [periodo]: err instanceof Error ? err.message : 'Error al guardar',
        }));
      } finally {
        setCuotaSaving((prev) => ({ ...prev, [periodo]: false }));
      }
    },
    [personaId, cuotaForms, apiBaseUrl, actorHeaders],
  );

  const handleSaveBeneficio = useCallback(async () => {
    if (!personaId) return;
    const { tramo, beneficio_key, beneficio_label, customLabel, useCustomLabel, fecha_uso, observaciones } =
      beneficioForm;
    const finalKey = useCustomLabel ? 'custom' : beneficio_key;
    const finalLabel = useCustomLabel ? customLabel : beneficio_label;
    if (!finalKey || !finalLabel || !fecha_uso) {
      setBeneficioError('Completá beneficio, clave y fecha.');
      return;
    }
    setBeneficioSaving(true);
    setBeneficioError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/personal/${personaId}/membresia/beneficios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...actorHeaders },
        body: JSON.stringify({
          tramo,
          beneficio_key: finalKey,
          beneficio_label: finalLabel,
          fecha_uso,
          observaciones: observaciones || null,
        }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData?.message ?? `Error ${resp.status}`);
      }
      const created: BeneficioUso = await resp.json();
      setData((prev) => {
        if (!prev) return prev;
        return { ...prev, beneficioUsos: [created, ...prev.beneficioUsos] };
      });
      setBeneficioForm(defaultBeneficioForm());
    } catch (err: unknown) {
      setBeneficioError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setBeneficioSaving(false);
    }
  }, [personaId, beneficioForm, apiBaseUrl, actorHeaders]);

  const handleDeleteBeneficio = useCallback(
    async (usoId: number) => {
      if (!personaId) return;
      if (!window.confirm('¿Eliminar este beneficio entregado?')) return;
      setDeletingBeneficioId(usoId);
      try {
        const resp = await fetch(`${apiBaseUrl}/api/personal/${personaId}/membresia/beneficios/${usoId}`, {
          method: 'DELETE',
          headers: { ...actorHeaders },
        });
        if (!resp.ok) {
          throw new Error(`Error ${resp.status}`);
        }
        setData((prev) => {
          if (!prev) return prev;
          return { ...prev, beneficioUsos: prev.beneficioUsos.filter((u) => u.id !== usoId) };
        });
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Error al eliminar');
      } finally {
        setDeletingBeneficioId(null);
      }
    },
    [personaId, apiBaseUrl, actorHeaders],
  );

  const tramoActual = useMemo(() => (data ? getTramo(data.persona.mesesActivos) : ''), [data]);
  const beneficiosTramoActual = useMemo(() => BENEFICIOS_POR_TRAMO[tramoActual] ?? [], [tramoActual]);

  const beneficioOptions = useMemo(() => {
    return BENEFICIOS_POR_TRAMO[beneficioForm.tramo] ?? [];
  }, [beneficioForm.tramo]);

  const headerContent = (
    <div className="card-header card-header--compact">
      <button
        type="button"
        className="secondary-action"
        onClick={() => navigate(`/personal/${personaId}/editar`)}
      >
        ← Volver
      </button>
    </div>
  );

  const personaNombre = data?.persona.nombre ?? '';

  return (
    <DashboardLayout title="Membresía" subtitle={personaNombre} headerContent={headerContent}>
      {loading && (
        <div className="dashboard-card">
          <div className="card-body">
            <p>Cargando...</p>
          </div>
        </div>
      )}
      {!loading && loadError && (
        <div className="dashboard-card">
          <div className="card-body">
            <p style={{ color: 'var(--danger, #e53e3e)' }}>{loadError}</p>
            <button type="button" className="secondary-action" onClick={loadData}>
              Reintentar
            </button>
          </div>
        </div>
      )}
      {!loading && !loadError && data && (
        <>
          {/* Header card */}
          <div className="dashboard-card">
            <div className="card-header">
              <h2 className="card-title">{data.persona.nombre}</h2>
            </div>
            <div className="card-body">
              <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #718096)', marginBottom: '0.25rem' }}>
                    Miembro desde
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {data.persona.membresiaDesde
                      ? new Date(data.persona.membresiaDesde + 'T00:00:00').toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #718096)', marginBottom: '0.25rem' }}>
                    Meses activos
                  </div>
                  <div style={{ fontWeight: 600 }}>{data.persona.mesesActivos}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #718096)', marginBottom: '0.25rem' }}>
                    Tramo actual
                  </div>
                  {tramoActual ? (
                    <span className="badge badge--success">{getTramoLabel(tramoActual)}</span>
                  ) : (
                    <span className="badge">Sin tramo</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cuotas */}
          <div className="dashboard-card">
            <div className="card-header">
              <h2 className="card-title">Cuotas mensuales</h2>
            </div>
            <div className="card-body">
              {data.cuotas.length === 0 ? (
                <p style={{ color: 'var(--text-muted, #718096)' }}>No hay cuotas generadas. Verificá que la membresía tenga fecha de inicio.</p>
              ) : (
                <div className="table-wrapper">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted, #718096)' }}>Período</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted, #718096)' }}>Monto ($)</th>
                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted, #718096)' }}>Estado</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted, #718096)' }}>Fecha de pago</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted, #718096)' }}>Observaciones</th>
                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted, #718096)' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.cuotas.map((cuota) => {
                        const isExpanded = expandedCuota === cuota.periodo;
                        const form = cuotaForms[cuota.periodo] ?? defaultCuotaForm();
                        const saving = cuotaSaving[cuota.periodo] ?? false;
                        const error = cuotaErrors[cuota.periodo] ?? '';
                        return (
                          <React.Fragment key={cuota.periodo}>
                            <tr style={{ borderTop: '1px solid var(--border, #e2e8f0)' }}>
                              <td style={{ padding: '0.5rem', fontWeight: 500 }}>{formatPeriodo(cuota.periodo)}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                {cuota.monto !== null ? `$${Number(cuota.monto).toFixed(2)}` : '—'}
                              </td>
                              <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                {cuota.pagado ? (
                                  <span className="badge badge--success">Pagado</span>
                                ) : (
                                  <span className="badge badge--danger">Pendiente</span>
                                )}
                              </td>
                              <td style={{ padding: '0.5rem' }}>
                                {cuota.fechaPago
                                  ? new Date(cuota.fechaPago + 'T00:00:00').toLocaleDateString('es-AR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                    })
                                  : '—'}
                              </td>
                              <td style={{ padding: '0.5rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {cuota.observaciones ?? '—'}
                              </td>
                              <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="secondary-action"
                                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                                  onClick={() => handleToggleCuota(cuota.periodo, cuota)}
                                >
                                  {isExpanded ? 'Cancelar' : cuota.pagado ? 'Editar' : 'Registrar pago'}
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr style={{ backgroundColor: 'var(--surface-2, #f7fafc)', borderTop: '1px solid var(--border, #e2e8f0)' }}>
                                <td colSpan={6} style={{ padding: '0.75rem 1rem' }}>
                                  <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                                    <div>
                                      <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Monto ($)</label>
                                      <input
                                        type="number"
                                        className="input-control"
                                        value={form.monto}
                                        onChange={(e) =>
                                          setCuotaForms((prev) => ({ ...prev, [cuota.periodo]: { ...form, monto: e.target.value } }))
                                        }
                                        step="0.01"
                                        min="0"
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Fecha de pago</label>
                                      <input
                                        type="date"
                                        className="input-control"
                                        value={form.fecha_pago}
                                        onChange={(e) =>
                                          setCuotaForms((prev) => ({ ...prev, [cuota.periodo]: { ...form, fecha_pago: e.target.value } }))
                                        }
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Observaciones</label>
                                      <input
                                        type="text"
                                        className="input-control"
                                        value={form.observaciones}
                                        onChange={(e) =>
                                          setCuotaForms((prev) => ({ ...prev, [cuota.periodo]: { ...form, observaciones: e.target.value } }))
                                        }
                                      />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.25rem' }}>
                                      <input
                                        type="checkbox"
                                        id={`pagado-${cuota.periodo}`}
                                        checked={form.pagado}
                                        onChange={(e) =>
                                          setCuotaForms((prev) => ({ ...prev, [cuota.periodo]: { ...form, pagado: e.target.checked } }))
                                        }
                                      />
                                      <label htmlFor={`pagado-${cuota.periodo}`} style={{ fontSize: '0.85rem' }}>
                                        Pagado
                                      </label>
                                    </div>
                                    <div style={{ paddingTop: '1.25rem' }}>
                                      <button
                                        type="button"
                                        className="primary-action"
                                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}
                                        disabled={saving}
                                        onClick={() => handleSaveCuota(cuota.periodo)}
                                      >
                                        {saving ? 'Guardando...' : 'Guardar'}
                                      </button>
                                    </div>
                                  </div>
                                  {error && (
                                    <p style={{ color: 'var(--danger, #e53e3e)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</p>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Beneficios */}
          <div className="dashboard-card">
            <div className="card-header">
              <h2 className="card-title">Beneficios</h2>
            </div>
            <div className="card-body">
              {/* A. Beneficios del tramo actual */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                  Beneficios del tramo actual
                  {tramoActual ? ` — ${getTramoLabel(tramoActual)}` : ''}
                </h3>
                {beneficiosTramoActual.length === 0 ? (
                  <p style={{ color: 'var(--text-muted, #718096)', fontSize: '0.85rem' }}>
                    Sin tramo activo o membresía no iniciada.
                  </p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                    {beneficiosTramoActual.map((b) => (
                      <li key={b.key} style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        {b.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* B. Historial */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                  Historial de beneficios entregados
                </h3>
                {data.beneficioUsos.length === 0 ? (
                  <p style={{ color: 'var(--text-muted, #718096)', fontSize: '0.85rem' }}>No se registraron entregas aún.</p>
                ) : (
                  <div className="table-wrapper">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted, #718096)' }}>Tramo</th>
                          <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted, #718096)' }}>Beneficio</th>
                          <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted, #718096)' }}>Fecha</th>
                          <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted, #718096)' }}>Notas</th>
                          <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted, #718096)' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.beneficioUsos.map((uso) => (
                          <tr key={uso.id} style={{ borderTop: '1px solid var(--border, #e2e8f0)' }}>
                            <td style={{ padding: '0.5rem' }}>
                              <span className="badge">{TRAMO_LABELS[uso.tramo] ?? uso.tramo}</span>
                            </td>
                            <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{uso.beneficioLabel}</td>
                            <td style={{ padding: '0.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                              {new Date(uso.fechaUso + 'T00:00:00').toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </td>
                            <td style={{ padding: '0.5rem', fontSize: '0.85rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {uso.observaciones ?? '—'}
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                className="secondary-action"
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', color: 'var(--danger, #e53e3e)', borderColor: 'var(--danger, #e53e3e)' }}
                                disabled={deletingBeneficioId === uso.id}
                                onClick={() => handleDeleteBeneficio(uso.id)}
                              >
                                {deletingBeneficioId === uso.id ? '...' : 'Eliminar'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* C. Registrar nuevo beneficio */}
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                  Registrar entrega de beneficio
                </h3>
                <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Tramo</label>
                    <select
                      className="input-control"
                      value={beneficioForm.tramo}
                      onChange={(e) => {
                        const newTramo = e.target.value;
                        setBeneficioForm((prev) => ({
                          ...prev,
                          tramo: newTramo,
                          beneficio_key: '',
                          beneficio_label: '',
                          useCustomLabel: false,
                          customLabel: '',
                        }));
                      }}
                    >
                      {Object.entries(TRAMO_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Beneficio</label>
                    {!beneficioForm.useCustomLabel ? (
                      <select
                        className="input-control"
                        value={beneficioForm.beneficio_key}
                        onChange={(e) => {
                          const key = e.target.value;
                          if (key === '__custom__') {
                            setBeneficioForm((prev) => ({ ...prev, useCustomLabel: true, beneficio_key: '', beneficio_label: '' }));
                            return;
                          }
                          const found = beneficioOptions.find((b) => b.key === key);
                          setBeneficioForm((prev) => ({
                            ...prev,
                            beneficio_key: key,
                            beneficio_label: found?.label ?? '',
                          }));
                        }}
                      >
                        <option value="">— Seleccionar —</option>
                        {beneficioOptions.map((b) => (
                          <option key={b.key} value={b.key}>{b.label}</option>
                        ))}
                        <option value="__custom__">Otro (ingresar manualmente)...</option>
                      </select>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="Descripción del beneficio"
                          value={beneficioForm.customLabel}
                          onChange={(e) =>
                            setBeneficioForm((prev) => ({ ...prev, customLabel: e.target.value }))
                          }
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="secondary-action"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                          onClick={() => setBeneficioForm((prev) => ({ ...prev, useCustomLabel: false, customLabel: '', beneficio_key: '', beneficio_label: '' }))}
                        >
                          Lista
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Fecha de uso</label>
                    <input
                      type="date"
                      className="input-control"
                      value={beneficioForm.fecha_uso}
                      onChange={(e) => setBeneficioForm((prev) => ({ ...prev, fecha_uso: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Observaciones</label>
                    <input
                      type="text"
                      className="input-control"
                      value={beneficioForm.observaciones}
                      onChange={(e) => setBeneficioForm((prev) => ({ ...prev, observaciones: e.target.value }))}
                    />
                  </div>
                  <div style={{ paddingTop: '1.25rem' }}>
                    <button
                      type="button"
                      className="primary-action"
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}
                      disabled={beneficioSaving}
                      onClick={handleSaveBeneficio}
                    >
                      {beneficioSaving ? 'Guardando...' : 'Registrar'}
                    </button>
                  </div>
                </div>
                {beneficioError && (
                  <p style={{ color: 'var(--danger, #e53e3e)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{beneficioError}</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
