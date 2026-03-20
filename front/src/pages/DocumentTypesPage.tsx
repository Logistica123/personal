import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { PersonalDocumentType } from '../features/documentos/types';

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  layoutVariant?: 'default' | 'panel';
  monitorView?: boolean;
};

type DocumentTypesPageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
};

export const DocumentTypesPage: React.FC<DocumentTypesPageProps> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const navigate = useNavigate();
  const location = useLocation();
  const [types, setTypes] = useState<PersonalDocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchTypes = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${apiBaseUrl}/api/personal/documentos/tipos`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: PersonalDocumentType[] };
        setTypes(payload?.data ?? []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setError((err as Error).message ?? 'No se pudieron cargar los tipos de documento.');
      } finally {
        setLoading(false);
      }
    };

    fetchTypes();

    return () => controller.abort();
  }, [apiBaseUrl]);

  useEffect(() => {
    const state = location.state as { message?: string } | null;
    if (state?.message) {
      setFlashMessage(state.message);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return types;
    }
    return types.filter((item) => (item.nombre ?? '').toLowerCase().includes(term));
  }, [types, searchTerm]);

  const handleEditType = (tipo: PersonalDocumentType) => {
    navigate(`/documentos/${tipo.id}/editar`);
  };

  const headerContent = (
    <div className="filters-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <div className="search-wrapper" style={{ flex: '1 1 260px' }}>
        <input
          type="search"
          placeholder="Buscar"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>
      <button className="primary-action" type="button" onClick={() => navigate('/documentos/nuevo')}>
        Nuevo tipo
      </button>
    </div>
  );

  return (
    <DashboardLayout title="Documentos" subtitle="Tipos de archivo" headerContent={headerContent}>
      {flashMessage ? (
        <div className="flash-message" role="alert">
          <span>{flashMessage}</span>
          <button type="button" onClick={() => setFlashMessage(null)} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      ) : null}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: '80px' }}>ID</th>
              <th>Nombre</th>
              <th style={{ width: '120px' }}>Vence</th>
              <th style={{ width: '150px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>Cargando tipos de documento...</td>
              </tr>
            ) : null}

            {error && !loading ? (
              <tr>
                <td colSpan={4} className="error-cell">
                  {error}
                </td>
              </tr>
            ) : null}

            {!loading && !error && filtered.length === 0 ? (
              <tr>
                <td colSpan={4}>No hay tipos de documento para mostrar.</td>
              </tr>
            ) : null}

            {!loading && !error
              ? filtered.map((tipo) => (
                  <tr key={tipo.id}>
                    <td>{tipo.id}</td>
                    <td>{tipo.nombre ?? '—'}</td>
                    <td>{tipo.vence ? 'Sí' : 'No'}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          aria-label={`Editar tipo ${tipo.nombre ?? ''}`}
                          onClick={() => handleEditType(tipo)}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          aria-label={`Eliminar tipo ${tipo.nombre ?? ''}`}
                          onClick={() => window.alert('Funcionalidad en construcción.')}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
};

