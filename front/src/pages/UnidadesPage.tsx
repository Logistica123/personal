import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Unidad } from '../features/unidades/types';

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  layoutVariant?: 'default' | 'panel';
  monitorView?: boolean;
};

export const UnidadesPage: React.FC<{
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  parseJsonSafe: (response: Response) => Promise<unknown>;
}> = ({ DashboardLayout, resolveApiBaseUrl, parseJsonSafe }) => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingUnidadId, setDeletingUnidadId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchUnidades = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${apiBaseUrl}/api/unidades`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: Unidad[] };
        if (!payload || !Array.isArray(payload.data)) {
          throw new Error('Formato de respuesta inesperado');
        }

        setUnidades(payload.data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setError((err as Error).message ?? 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    void fetchUnidades();

    return () => controller.abort();
  }, [apiBaseUrl]);

  const filteredUnidades = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term.length === 0) {
      return unidades;
    }

    return unidades.filter((unidad) => {
      const fields = [unidad.matricula, unidad.marca, unidad.modelo, unidad.anio, unidad.observacion];

      return fields.some((field) => field?.toLowerCase().includes(term));
    });
  }, [unidades, searchTerm]);

  const footerLabel = useMemo(() => {
    if (loading) {
      return 'Cargando unidades...';
    }

    if (error) {
      return 'No se pudieron cargar las unidades';
    }

    if (filteredUnidades.length === 0) {
      return 'No hay unidades para mostrar.';
    }

    if (filteredUnidades.length === unidades.length) {
      return `Mostrando ${unidades.length} unidad${unidades.length === 1 ? '' : 'es'}`;
    }

    return `Mostrando ${filteredUnidades.length} de ${unidades.length} unidades`;
  }, [loading, error, filteredUnidades.length, unidades.length]);

  const headerContent = (
    <div className="card-header">
      <div className="search-wrapper">
        <input
          type="search"
          placeholder="Buscar"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>
      <button className="primary-action" type="button" onClick={() => navigate('/unidades/nuevo')}>
        Registrar unidad
      </button>
    </div>
  );

  const handleDeleteUnidad = async (unidad: Unidad) => {
    if (!window.confirm(`¿Seguro que deseas eliminar la unidad "${unidad.matricula ?? unidad.id}"?`)) {
      return;
    }

    try {
      setDeletingUnidadId(unidad.id);
      const response = await fetch(`${apiBaseUrl}/api/unidades/${unidad.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = (await parseJsonSafe(response).catch(() => null)) as { message?: string } | null;
          if (typeof payload?.message === 'string') {
            message = payload.message;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      setUnidades((prev) => prev.filter((item) => item.id !== unidad.id));
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo eliminar la unidad.');
    } finally {
      setDeletingUnidadId(null);
    }
  };

  return (
    <DashboardLayout title="Gestionar unidades" subtitle="Gestionar unidades" headerContent={headerContent}>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Matrícula</th>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Año</th>
              <th>Observación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6}>Cargando unidades...</td>
              </tr>
            )}

            {error && !loading && (
              <tr>
                <td colSpan={6} className="error-cell">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && filteredUnidades.length === 0 && (
              <tr>
                <td colSpan={6}>No hay unidades para mostrar.</td>
              </tr>
            )}

            {!loading &&
              !error &&
              filteredUnidades.map((unidad) => (
                <tr key={unidad.id}>
                  <td>{unidad.matricula ?? '—'}</td>
                  <td>{unidad.marca ?? '—'}</td>
                  <td>{unidad.modelo ?? '—'}</td>
                  <td>{unidad.anio ?? '—'}</td>
                  <td>{unidad.observacion ?? '—'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        type="button"
                        aria-label={`Editar unidad ${unidad.matricula ?? ''}`}
                        onClick={() => navigate(`/unidades/${unidad.id}/editar`)}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        aria-label={`Eliminar unidad ${unidad.matricula ?? ''}`}
                        onClick={() => void handleDeleteUnidad(unidad)}
                        disabled={deletingUnidadId === unidad.id}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <footer className="table-footer">
        <span>{footerLabel}</span>
        <div className="pagination">
          <button disabled aria-label="Anterior">
            ‹
          </button>
          <button disabled aria-label="Siguiente">
            ›
          </button>
        </div>
      </footer>
    </DashboardLayout>
  );
};

