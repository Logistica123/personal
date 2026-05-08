import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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

type ResultadoBusqueda = {
  encontrados: Array<{
    linea_input: string;
    asegurado_id: number;
    persona_id: number | null;
    identificador: string;
    nombre: string;
    cuil: string | null;
    estado: string;
  }>;
  no_encontrados: Array<{ linea_input: string; razon: string }>;
};

/**
 * ADDENDUM 12 Parte G — Baja masiva por bulk import.
 *
 * Pegás una lista de CUILs/DNIs (o patentes para vehículos) — el backend
 * busca cuáles son asegurados activos en esta póliza y devuelve encontrados
 * + no encontrados. Los encontrados se pueden mandar al wizard de "Solicitar
 * baja" pre-seleccionados con un click.
 */
export const PolizaBajaMasivaPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const { polizaId } = useParams<{ polizaId: string }>();
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);

  const [poliza, setPoliza] = useState<Poliza | null>(null);
  const [textoLista, setTextoLista] = useState('');
  const [resultado, setResultado] = useState<ResultadoBusqueda | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!polizaId) return;
    fetch(`${apiBaseUrl}/api/polizas/${polizaId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(({ data }) => setPoliza(data))
      .catch(() => undefined);
  }, [polizaId, apiBaseUrl]);

  const buscar = useCallback(async () => {
    const lineas = textoLista
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lineas.length === 0) {
      setError('Pegá al menos una línea con CUIL/DNI/patente.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/${polizaId}/buscar-asegurados-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineas }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const { data } = (await resp.json()) as { data: ResultadoBusqueda };
      setResultado(data);
      // Pre-seleccionar todos los encontrados.
      setSeleccionados(new Set(data.encontrados.map((e) => e.asegurado_id)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [textoLista, polizaId, apiBaseUrl]);

  const continuarBaja = () => {
    if (seleccionados.size === 0) return;
    // El wizard /solicitar acepta `tipo=baja` y consume `asegurado_ids[]` del state
    // de selección. Como hoy el wizard fetcha desde el backend, le pasamos la
    // lista de IDs vía sessionStorage para que SeleccionStep los pre-marque.
    sessionStorage.setItem('polizas:baja_masiva_pre_seleccion', JSON.stringify(Array.from(seleccionados)));
    navigate(`/polizas/${polizaId}/solicitar?tipo=baja&from=baja_masiva`);
  };

  const placeholderEjemplo = poliza?.tipo_asegurado === 'vehiculo'
    ? 'IWK373\nA009PHB\nAA788ZU'
    : '20-31675826-7\n27-26787470-6\n31675826';

  return (
    <DashboardLayout
      title={`Baja masiva — ${poliza?.nombre_descriptivo ?? 'Póliza'}`}
      subtitle={poliza ? `${poliza.aseguradora?.nombre} · N° ${poliza.numero_poliza}` : ''}
      headerContent={
        <Link to={polizaId ? `/polizas/${polizaId}` : '/polizas'} className="secondary-action secondary-action--ghost">
          ← Volver
        </Link>
      }
    >
      {error && (
        <div style={{ padding: '1rem', background: '#fee', color: '#900', borderRadius: 12, margin: '1rem 0' }}>
          {error}
        </div>
      )}

      <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>1. Pegá la lista</h3>
        <p style={{ color: '#666', fontSize: '0.85rem', margin: '0.25rem 0 0.5rem 0' }}>
          {poliza?.tipo_asegurado === 'vehiculo'
            ? 'Una patente por línea. Acepta formato viejo (ABC123) o Mercosur (AB123CD / A123BCD).'
            : 'Un CUIL o DNI por línea. Acepta CUIL con o sin guiones, o DNI de 8 dígitos.'}
        </p>
        <textarea
          value={textoLista}
          onChange={(e) => setTextoLista(e.target.value)}
          rows={10}
          placeholder={placeholderEjemplo}
          style={{
            width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #d0d7e1',
            fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical',
          }}
        />
        <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={buscar}
            disabled={loading || textoLista.trim() === ''}
            style={{
              background: loading ? '#aaa' : '#1d74f5', color: '#fff',
              padding: '0.5rem 1rem', borderRadius: 8, border: 0, cursor: 'pointer',
            }}
          >
            {loading ? 'Buscando…' : 'Buscar coincidencias ▶'}
          </button>
        </div>
      </div>

      {resultado && (
        <div className="dashboard-card">
          <h3 style={{ margin: 0 }}>2. Resultados</h3>

          {resultado.encontrados.length > 0 && (
            <>
              <h4 style={{ margin: '0.75rem 0 0.4rem 0', fontSize: '0.95rem', color: '#0a8c3a' }}>
                ✅ Encontrados ({resultado.encontrados.length})
              </h4>
              <div className="table-wrapper">
                <table className="bdd-activos-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}>
                        <input
                          type="checkbox"
                          checked={resultado.encontrados.length > 0
                            && resultado.encontrados.every((e) => seleccionados.has(e.asegurado_id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSeleccionados(new Set(resultado.encontrados.map((x) => x.asegurado_id)));
                            } else {
                              setSeleccionados(new Set());
                            }
                          }}
                          aria-label="Seleccionar todos los encontrados"
                        />
                      </th>
                      <th>Línea</th>
                      <th>Identificador</th>
                      <th>Nombre</th>
                      <th>CUIL</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.encontrados.map((e) => (
                      <tr key={e.asegurado_id}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={seleccionados.has(e.asegurado_id)}
                            onChange={() => {
                              setSeleccionados((prev) => {
                                const next = new Set(prev);
                                if (next.has(e.asegurado_id)) next.delete(e.asegurado_id);
                                else next.add(e.asegurado_id);
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td><code>{e.linea_input}</code></td>
                        <td><code>{e.identificador}</code></td>
                        <td>{e.nombre}</td>
                        <td><code style={{ fontSize: '0.78rem' }}>{e.cuil ?? '—'}</code></td>
                        <td>{e.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {resultado.no_encontrados.length > 0 && (
            <>
              <h4 style={{ margin: '0.75rem 0 0.4rem 0', fontSize: '0.95rem', color: '#c4392a' }}>
                ❌ No encontrados ({resultado.no_encontrados.length})
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.85rem' }}>
                {resultado.no_encontrados.map((n) => (
                  <li key={n.linea_input}>
                    <code>{n.linea_input}</code> — <span style={{ color: '#666' }}>{n.razon}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem' }}>
              <b>{seleccionados.size}</b> seleccionado{seleccionados.size !== 1 ? 's' : ''} para baja
            </span>
            <button
              type="button"
              onClick={continuarBaja}
              disabled={seleccionados.size === 0}
              style={{
                background: seleccionados.size === 0 ? '#aaa' : '#c4392a', color: '#fff',
                padding: '0.6rem 1.2rem', borderRadius: 10, border: 0, cursor: 'pointer',
              }}
            >
              Solicitar baja de {seleccionados.size} ▶
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
