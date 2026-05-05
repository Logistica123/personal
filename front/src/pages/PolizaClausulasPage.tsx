import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Clausula } from '../features/polizas/types';

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

type FormState = {
  id?: number;
  nombre_corto: string;
  alias: string;
  cuit_titular: string;
  razon_social_titular: string;
  descripcion_corta: string;
  tipo: 'no_repeticion' | 'subrogacion' | 'otra';
  activa: boolean;
};

const FORM_VACIO: FormState = {
  nombre_corto: '', alias: '', cuit_titular: '', razon_social_titular: '',
  descripcion_corta: '', tipo: 'no_repeticion', activa: true,
};

export const PolizaClausulasPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [clausulas, setClausulas] = useState<Clausula[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null); // null = modal cerrado
  const [error, setError] = useState<string | null>(null);

  const fetchClausulas = useCallback(async () => {
    setLoading(true);
    const resp = await fetch(`${apiBaseUrl}/api/polizas/clausulas`, { cache: 'no-store' });
    if (resp.ok) {
      const { data } = (await resp.json()) as { data: Clausula[] };
      setClausulas(data ?? []);
    }
    setLoading(false);
  }, [apiBaseUrl]);

  useEffect(() => { fetchClausulas(); }, [fetchClausulas]);

  const guardar = async () => {
    if (!form) return;
    try {
      setError(null);
      const url = form.id
        ? `${apiBaseUrl}/api/polizas/clausulas/${form.id}`
        : `${apiBaseUrl}/api/polizas/clausulas`;
      const method = form.id ? 'PUT' : 'POST';
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(form),
      });
      if (!resp.ok) throw new Error(await resp.text());
      setForm(null);
      await fetchClausulas();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <DashboardLayout
      title="Cláusulas de no repetición"
      subtitle="Catálogo de cláusulas disponibles para aplicar a las pólizas"
      headerContent={
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/polizas" className="secondary-action secondary-action--ghost">← Pólizas</Link>
          <button
            type="button"
            onClick={() => setForm({ ...FORM_VACIO })}
            style={{ background: '#1d74f5', color: '#fff', padding: '0.5rem 0.9rem', borderRadius: 10, border: 0, cursor: 'pointer' }}
          >
            + Nueva cláusula
          </button>
        </div>
      }
    >
      {error && (
        <div style={{ padding: '1rem', background: '#fee', color: '#900', borderRadius: 12, margin: '1rem 0' }}>{error}</div>
      )}

      <div className="dashboard-card">
        {loading && <div style={{ padding: '1rem' }}>Cargando…</div>}
        {!loading && clausulas.length === 0 && (
          <div style={{ padding: '1rem', color: '#666' }}>No hay cláusulas cargadas.</div>
        )}
        {!loading && clausulas.length > 0 && (
          <div className="table-wrapper">
            <table className="bdd-activos-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Nombre corto</th>
                  <th>Alias</th>
                  <th>CUIT titular</th>
                  <th>Razón social</th>
                  <th>Descripción inline</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clausulas.map((c) => (
                  <tr key={c.id} style={c.activa ? undefined : { opacity: 0.5 }}>
                    <td><b>{c.nombre_corto}</b></td>
                    <td><code>{c.alias || '—'}</code></td>
                    <td><code>{c.cuit_titular}</code></td>
                    <td>{c.razon_social_titular}</td>
                    <td style={{ fontSize: '0.8rem', color: '#666', maxWidth: 350 }}>{c.descripcion_corta}</td>
                    <td>
                      <span className={`estado-badge ${c.activa ? 'estado-badge--activo' : 'estado-badge--baja'}`}>
                        {c.activa ? 'activa' : 'inactiva'}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="secondary-action secondary-action--ghost"
                        onClick={() => setForm({
                          id: c.id,
                          nombre_corto: c.nombre_corto,
                          alias: c.alias ?? '',
                          cuit_titular: c.cuit_titular,
                          razon_social_titular: c.razon_social_titular,
                          descripcion_corta: c.descripcion_corta ?? '',
                          tipo: c.tipo,
                          activa: c.activa,
                        })}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }} onClick={(e) => { if (e.target === e.currentTarget) setForm(null); }}>
          <div className="dashboard-card" style={{ maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: 0 }}>{form.id ? 'Editar cláusula' : 'Nueva cláusula'}</h3>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {([
                ['nombre_corto',        'Nombre corto *'],
                ['alias',               'Alias (para frases La Segunda)'],
                ['cuit_titular',        'CUIT titular *'],
                ['razon_social_titular','Razón social *'],
                ['descripcion_corta',   'Descripción inline (texto que aparece en email)'],
              ] as const).map(([key, label]) => (
                <label key={key} style={{ display: 'block', fontSize: '0.85rem' }}>
                  <span>{label}</span>
                  <input type="text" value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    style={{ width: '100%', padding: '0.4rem', border: '1px solid #ddd', borderRadius: 6 }}
                  />
                </label>
              ))}
              <label style={{ fontSize: '0.85rem' }}>
                <span>Tipo</span>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as FormState['tipo'] })}>
                  <option value="no_repeticion">No repetición</option>
                  <option value="subrogacion">Subrogación</option>
                  <option value="otra">Otra</option>
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} />
                Activa
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="secondary-action secondary-action--ghost" onClick={() => setForm(null)}>Cancelar</button>
              <button type="button" onClick={guardar}
                style={{ background: '#0a8c3a', color: '#fff', padding: '0.5rem 1rem', borderRadius: 10, border: 0, cursor: 'pointer' }}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
