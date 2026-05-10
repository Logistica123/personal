import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Poliza } from '../features/polizas/types';

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
};

type Props = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
};

const FORMATTER_FECHA = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function parseFecha(s: string): Date {
  // Tolera 'YYYY-MM-DD' (cast date local) o 'YYYY-MM-DDTHH:mm:ssZ' (cast date Laravel prod).
  return new Date(s.slice(0, 10) + 'T00:00:00');
}

function diasHastaVencimiento(vigenciaHasta: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = parseFecha(vigenciaHasta);
  return Math.round((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function badgeVigencia(p: Poliza): { label: string; cssClass: string } {
  const dias = diasHastaVencimiento(p.vigencia_hasta);
  if (dias < 0)        return { label: `Vencida hace ${-dias}d`, cssClass: 'estado-badge--baja' };
  if (dias <= p.alerta_dias_antes_vencimiento) return { label: `Vence en ${dias}d`, cssClass: 'estado-badge--pendiente' };
  return { label: 'Vigente', cssClass: 'estado-badge--activo' };
}

type PersonaResumen = {
  id: number;
  nombre_completo: string;
  cuil: string | null;
  estado_actual: string;
};

// ADDENDUM 12 Parte A — KPIs del dashboard.
type DashboardAlertas = {
  polizas_por_vencer: Array<{ id: number; nombre: string; numero_poliza: string; vigencia_hasta: string; dias_restantes: number }>;
  solicitudes_sin_respuesta: number;
  asegurados_sin_persona: number;
  estados_inconsistentes: number;
};

export const PolizasPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [polizas, setPolizas] = useState<Poliza[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ADDENDUM 10 sub-fase 2 — banner cuando se llega desde "Solicitar alta AP"
  // del expand de choferes (`?solicitar_alta_persona=N`).
  const [searchParams] = useSearchParams();
  const altaPersonaId = useMemo(() => {
    const raw = searchParams.get('solicitar_alta_persona');
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);
  const [personaResumen, setPersonaResumen] = useState<PersonaResumen | null>(null);
  const [alertas, setAlertas] = useState<DashboardAlertas | null>(null);

  useEffect(() => {
    if (!altaPersonaId) { setPersonaResumen(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`${apiBaseUrl}/api/personal/${altaPersonaId}`, { cache: 'no-store' });
        if (!resp.ok || cancelled) return;
        const payload = await resp.json();
        const d = payload?.data ?? payload?.personalRecord ?? payload;
        setPersonaResumen({
          id: d.id ?? altaPersonaId,
          nombre_completo: (d.nombre as string) ?? `Persona #${altaPersonaId}`,
          cuil: d.cuil ?? null,
          estado_actual: d.estado ?? '—',
        });
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [altaPersonaId, apiBaseUrl]);

  const fetchPolizas = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await fetch(`${apiBaseUrl}/api/polizas`, { signal, cache: 'no-store' });
      if (!resp.ok) throw new Error(`Error ${resp.status}: ${resp.statusText}`);
      const payload = (await resp.json()) as { data: Poliza[] };
      setPolizas(payload.data ?? []);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPolizas(controller.signal);
    return () => controller.abort();
  }, [fetchPolizas]);

  // ADDENDUM 12 Parte A — KPIs del dashboard. Se cargan en paralelo con las
  // pólizas pero no bloquean el render si fallan.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`${apiBaseUrl}/api/polizas/dashboard/alertas`, { cache: 'no-store' });
        if (!resp.ok || cancelled) return;
        const { data } = (await resp.json()) as { data: DashboardAlertas };
        setAlertas(data);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [apiBaseUrl]);

  // En modo "solicitar alta para persona X" mostramos solo pólizas AP activas.
  // Las pólizas vehículo no aplican porque el chofer maneja el vehículo del titular,
  // no necesita su propia póliza vehículo.
  const polizasFiltradas = altaPersonaId
    ? polizas.filter((p) => p.activa && p.ramo === 'accidentes_personales')
    : polizas;

  return (
    <DashboardLayout title="Pólizas" subtitle="Gestión de pólizas de seguros (MAPFRE / San Cristóbal / La Segunda)">
      {/* ADDENDUM 13 — accesos rápidos al inbox / auditoría / discrepancias */}
      {!altaPersonaId && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <button type="button" onClick={() => navigate('/polizas/inbox')}
            className="secondary-action secondary-action--ghost">📬 Inbox</button>
          <button type="button" onClick={() => navigate('/polizas/auditoria')}
            className="secondary-action secondary-action--ghost">📋 Auditoría</button>
          <button type="button" onClick={() => navigate('/polizas/discrepancias-globales')}
            className="secondary-action secondary-action--ghost">⚠ Discrepancias</button>
          <button type="button" onClick={() => navigate('/polizas/solicitudes')}
            className="secondary-action secondary-action--ghost">📨 Solicitudes</button>
        </div>
      )}
      {/* ADDENDUM 10 sub-fase 2 — banner alta AP de chofer. */}
      {altaPersonaId && (
        <div style={{
          padding: '0.9rem 1.1rem', marginBottom: '1rem', borderRadius: 12,
          background: '#eef4ff', border: '1px solid #1d74f5',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: '0.9rem' }}>
            <b>Solicitar alta AP para:</b>{' '}
            {personaResumen?.nombre_completo ?? `Persona #${altaPersonaId}`}
            {personaResumen?.cuil && <small style={{ color: '#666' }}> · CUIL {personaResumen.cuil}</small>}
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 2 }}>
              Elegí en qué póliza de Accidentes Personales dar de alta a esta persona. Click en una card para abrir el wizard pre-cargado.
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/polizas', { replace: true })}
            className="secondary-action secondary-action--ghost"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ADDENDUM 12 Parte A — KPIs del dashboard. No aparecen en modo "alta persona". */}
      {!altaPersonaId && alertas && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}>
          <DashboardKpi
            titulo="Pólizas por vencer"
            valor={alertas.polizas_por_vencer.length}
            descripcion="Próximas 30 días"
            color={alertas.polizas_por_vencer.length > 0 ? '#c70' : '#0a8c3a'}
            tooltip={alertas.polizas_por_vencer.map((p) => `${p.nombre} (${p.dias_restantes}d)`).join('\n')}
          />
          <DashboardKpi
            titulo="Solicitudes sin respuesta"
            valor={alertas.solicitudes_sin_respuesta}
            descripcion="Más allá del umbral configurado"
            color={alertas.solicitudes_sin_respuesta > 0 ? '#c70' : '#0a8c3a'}
            link={alertas.solicitudes_sin_respuesta > 0 ? '/polizas/solicitudes?estado=enviado' : null}
          />
          {/* ADDENDUM 13 Parte C — drilldown global a /polizas/discrepancias-globales */}
          <DashboardKpi
            titulo="Asegurados sin persona"
            valor={alertas.asegurados_sin_persona}
            descripcion="'Fantasmas' — sin match en el maestro"
            color={alertas.asegurados_sin_persona > 0 ? '#c4392a' : '#0a8c3a'}
            link={alertas.asegurados_sin_persona > 0 ? '/polizas/discrepancias-globales?tab=sin_persona' : null}
          />
          <DashboardKpi
            titulo="Estados inconsistentes"
            valor={alertas.estados_inconsistentes}
            descripcion="Persona en baja/suspendida con cobertura activa"
            color={alertas.estados_inconsistentes > 0 ? '#c4392a' : '#0a8c3a'}
            link={alertas.estados_inconsistentes > 0 ? '/polizas/discrepancias-globales?tab=estado_inconsistente' : null}
          />
        </div>
      )}

      {loading && <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando pólizas…</div>}
      {error && (
        <div style={{ padding: '1rem', background: '#fee', color: '#900', borderRadius: 12, margin: '1rem 0' }}>
          {error}
        </div>
      )}
      {!loading && !error && polizasFiltradas.length === 0 && !altaPersonaId && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          No hay pólizas cargadas. Verificar que el seeder se haya corrido.
        </div>
      )}
      {!loading && !error && polizasFiltradas.length === 0 && altaPersonaId && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          No hay pólizas AP activas disponibles para dar de alta.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {polizasFiltradas.map((p) => {
          const badge = badgeVigencia(p);
          // En modo "solicitar alta AP" cada card abre directo el wizard con la persona.
          const targetUrl = altaPersonaId
            ? `/polizas/${p.id}/solicitar?tipo=alta&persona_id=${altaPersonaId}`
            : `/polizas/${p.id}`;
          return (
            <div
              key={p.id}
              className="dashboard-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(targetUrl)}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(targetUrl); }}
              style={{ cursor: 'pointer', padding: '1.25rem', gap: '0.75rem' }}
            >
              <div className="card-header" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {p.aseguradora?.nombre ?? '?'}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 4 }}>
                    {p.nombre_descriptivo}
                  </div>
                </div>
                <span className={`estado-badge ${badge.cssClass}`}>{badge.label}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div>
                  <div style={{ color: '#888', fontSize: '0.7rem' }}>N° póliza</div>
                  <div style={{ fontWeight: 600 }}>{p.numero_poliza}</div>
                </div>
                <div>
                  <div style={{ color: '#888', fontSize: '0.7rem' }}>Tipo</div>
                  <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{p.tipo_asegurado}</div>
                </div>
                <div>
                  <div style={{ color: '#888', fontSize: '0.7rem' }}>Vigencia</div>
                  <div>
                    {FORMATTER_FECHA.format(parseFecha(p.vigencia_desde))}
                    {' → '}
                    {FORMATTER_FECHA.format(parseFecha(p.vigencia_hasta))}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#888', fontSize: '0.7rem' }}>Asegurados activos</div>
                  <div style={{ fontWeight: 600 }}>{p.asegurados_activos_count ?? 0}</div>
                </div>
              </div>

              {p.clausulas_especiales && (
                <div className="chip chip--muted" style={{ alignSelf: 'flex-start' }}>
                  {p.clausulas_especiales}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
};

// ─── KPI card del dashboard (ADDENDUM 12 Parte A) ────────────────────────────

const DashboardKpi: React.FC<{
  titulo: string;
  valor: number;
  descripcion: string;
  color: string;
  link?: string | null;
  tooltip?: string;
}> = ({ titulo, valor, descripcion, color, link, tooltip }) => {
  const navigate = useNavigate();
  const onClick = link ? () => navigate(link) : undefined;
  return (
    <div
      role={link ? 'button' : undefined}
      tabIndex={link ? 0 : undefined}
      onClick={onClick}
      onKeyDown={link ? (e) => { if (e.key === 'Enter') navigate(link); } : undefined}
      title={tooltip}
      style={{
        background: '#fff',
        border: `1px solid ${color}33`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 10,
        padding: '0.75rem 1rem',
        cursor: link ? 'pointer' : 'default',
      }}
    >
      <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {titulo}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color, marginTop: '0.15rem' }}>{valor}</div>
      <div style={{ fontSize: '0.75rem', color: '#888' }}>{descripcion}</div>
    </div>
  );
};
