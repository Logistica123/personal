import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { PolizaAsegurado } from '../features/polizas/types';

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

type AseguradoConPoliza = PolizaAsegurado & {
  poliza: {
    id: number;
    nombre_descriptivo: string;
    numero_poliza: string;
    vigencia_desde: string;
    vigencia_hasta: string;
    activa: boolean;
    tipo_asegurado: 'persona' | 'vehiculo';
    aseguradora: { id: number; nombre: string; parser_perfil: string };
  };
};

type PersonaInfo = {
  id: number;
  apellidos: string | null;
  nombres: string | null;
  cuil: string | null;
  patente: string | null;
};

const ESTADO_BADGE: Record<string, string> = {
  activo: 'estado-badge--activo',
  alta_solicitada: 'estado-badge--pendiente',
  baja_solicitada: 'estado-badge--pendiente',
  dado_de_baja: 'estado-badge--baja',
  no_matcheado: 'estado-badge--default',
};

const fmtDate = (s: string): string => new Date(s + 'T00:00:00').toLocaleDateString('es-AR');

export const PersonaPolizasPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const { personaId } = useParams<{ personaId: string }>();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [persona, setPersona] = useState<PersonaInfo | null>(null);
  const [asegurados, setAsegurados] = useState<AseguradoConPoliza[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personaId) return;
    const ctrl = new AbortController();
    setLoading(true);

    Promise.all([
      fetch(`${apiBaseUrl}/api/personal/${personaId}`, { signal: ctrl.signal, cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Persona no encontrada'))))
        .then((p) => setPersona(p?.data ?? p)),
      fetch(`${apiBaseUrl}/api/personal/${personaId}/polizas`, { signal: ctrl.signal, cache: 'no-store' })
        .then((r) => r.json())
        .then(({ data }) => setAsegurados(data ?? [])),
    ])
      .catch((e) => { if ((e as Error).name !== 'AbortError') setError((e as Error).message); })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [personaId, apiBaseUrl]);

  const nombreCompleto = persona
    ? `${persona.apellidos ?? ''}, ${persona.nombres ?? ''}`.replace(/^,\s|,\s*$/, '').trim() || 'Proveedor'
    : 'Proveedor';

  const activos = asegurados.filter((a) => a.estado === 'activo');
  const otros = asegurados.filter((a) => a.estado !== 'activo');

  return (
    <DashboardLayout
      title={`Pólizas de ${nombreCompleto}`}
      subtitle={persona ? `CUIL: ${persona.cuil ?? '—'} · Patente: ${persona.patente ?? '—'}` : ''}
      headerContent={
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to={`/personal/${personaId}/editar`} className="secondary-action secondary-action--ghost">
            ← Editar proveedor
          </Link>
          <Link to="/polizas" className="secondary-action secondary-action--ghost">
            Pólizas
          </Link>
        </div>
      }
    >
      {loading && <div style={{ padding: '2rem' }}>Cargando…</div>}
      {error && (
        <div style={{ padding: '1rem', background: '#fee', color: '#900', borderRadius: 12 }}>{error}</div>
      )}

      {!loading && !error && asegurados.length === 0 && (
        <div className="dashboard-card">
          <h3 style={{ margin: 0 }}>Sin cobertura</h3>
          <p style={{ margin: 0, color: '#666' }}>
            Este proveedor no figura como asegurado en ninguna póliza activa.
            Si debería estar cubierto, hacé una solicitud de alta desde la póliza correspondiente.
          </p>
        </div>
      )}

      {activos.length > 0 && (
        <Section
          title={`✓ Activas (${activos.length})`}
          asegurados={activos}
          accion="baja"
        />
      )}

      {otros.length > 0 && (
        <Section
          title={`Histórico / pendientes (${otros.length})`}
          asegurados={otros}
          accion={null}
        />
      )}
    </DashboardLayout>
  );
};

type SectionProps = {
  title: string;
  asegurados: AseguradoConPoliza[];
  accion: 'alta' | 'baja' | null;
};

const Section: React.FC<SectionProps> = ({ title, asegurados, accion }) => (
  <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
    <div className="card-header"><h3 style={{ margin: 0 }}>{title}</h3></div>
    <div className="table-wrapper">
      <table className="bdd-activos-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Aseguradora</th>
            <th>Póliza</th>
            <th>Tipo</th>
            <th>Identificador</th>
            <th>Vigencia</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {asegurados.map((a) => (
            <tr key={a.id}>
              <td>{a.poliza.aseguradora.nombre}</td>
              <td><Link to={`/polizas/${a.poliza.id}`}>{a.poliza.nombre_descriptivo}</Link></td>
              <td style={{ textTransform: 'capitalize' }}>{a.poliza.tipo_asegurado}</td>
              <td><code>{a.identificador}</code></td>
              <td>{fmtDate(a.poliza.vigencia_desde)} → {fmtDate(a.poliza.vigencia_hasta)}</td>
              <td><span className={`estado-badge ${ESTADO_BADGE[a.estado] ?? 'estado-badge--default'}`}>{a.estado}</span></td>
              <td>
                {accion === 'baja' && (
                  <Link
                    to={`/polizas/${a.poliza.id}/solicitar?tipo=baja`}
                    className="secondary-action"
                    style={{ background: '#c4392a', color: '#fff', padding: '0.3rem 0.7rem', borderRadius: 6, textDecoration: 'none', fontSize: '0.8rem' }}
                  >
                    Solicitar baja
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
