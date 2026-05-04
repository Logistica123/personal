import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

export const PolizasPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [polizas, setPolizas] = useState<Poliza[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <DashboardLayout title="Pólizas" subtitle="Gestión de pólizas de seguros (MAPFRE / San Cristóbal / La Segunda)">
      {loading && <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando pólizas…</div>}
      {error && (
        <div style={{ padding: '1rem', background: '#fee', color: '#900', borderRadius: 12, margin: '1rem 0' }}>
          {error}
        </div>
      )}
      {!loading && !error && polizas.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          No hay pólizas cargadas. Verificar que el seeder se haya corrido.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {polizas.map((p) => {
          const badge = badgeVigencia(p);
          return (
            <div
              key={p.id}
              className="dashboard-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/polizas/${p.id}`)}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/polizas/${p.id}`); }}
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
