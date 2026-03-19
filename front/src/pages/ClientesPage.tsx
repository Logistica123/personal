import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Cliente } from '../features/clientes/types';

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  layoutVariant?: 'default' | 'panel';
  monitorView?: boolean;
};

export const ClientesPage: React.FC<{
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  parseJsonSafe: (response: Response) => Promise<unknown>;
}> = ({ DashboardLayout, resolveApiBaseUrl, parseJsonSafe }) => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingClienteId, setDeletingClienteId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchClientes = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${apiBaseUrl}/api/clientes`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: Cliente[] };

        if (!payload || !Array.isArray(payload.data)) {
          throw new Error('Formato de respuesta inesperado');
        }

        setClientes(payload.data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }

        setError((err as Error).message ?? 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    void fetchClientes();

    return () => controller.abort();
  }, [apiBaseUrl]);

  const filteredClientes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term.length === 0) {
      return clientes;
    }

    return clientes.filter((cliente) => {
      const fields = [
        cliente.codigo,
        cliente.nombre,
        cliente.documento_fiscal,
        cliente.direccion,
        ...cliente.sucursales.flatMap((sucursal) => [
          sucursal.nombre,
          sucursal.direccion,
          sucursal.encargado_deposito ?? null,
        ]),
      ];

      return fields.some((field) => field?.toLowerCase().includes(term));
    });
  }, [clientes, searchTerm]);

  const footerLabel = useMemo(() => {
    if (loading) {
      return 'Cargando clientes...';
    }

    if (error) {
      return 'No se pudieron cargar los clientes';
    }

    if (filteredClientes.length === 0) {
      return 'No hay clientes para mostrar.';
    }

    if (filteredClientes.length === clientes.length) {
      return `Mostrando ${clientes.length} cliente${clientes.length === 1 ? '' : 's'}`;
    }

    return `Mostrando ${filteredClientes.length} de ${clientes.length} clientes`;
  }, [loading, error, filteredClientes.length, clientes.length]);

  const handleDeleteCliente = async (cliente: Cliente) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el cliente "${cliente.nombre ?? cliente.codigo ?? cliente.id}"?`)) {
      return;
    }

    try {
      setDeletingClienteId(cliente.id);
      const response = await fetch(`${apiBaseUrl}/api/clientes/${cliente.id}`, {
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

      setClientes((prev) => prev.filter((item) => item.id !== cliente.id));
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo eliminar el cliente.');
    } finally {
      setDeletingClienteId(null);
    }
  };

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
      <button className="primary-action" type="button" onClick={() => navigate('/clientes/nuevo')}>
        Registrar cliente
      </button>
    </div>
  );

  return (
    <DashboardLayout title="Gestionar clientes" subtitle="Gestionar clientes" headerContent={headerContent}>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>CUIT</th>
              <th>Dirección</th>
              <th>Sucursales</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6}>Cargando clientes...</td>
              </tr>
            )}

            {error && !loading && (
              <tr>
                <td colSpan={6} className="error-cell">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && filteredClientes.length === 0 && (
              <tr>
                <td colSpan={6}>No hay clientes para mostrar.</td>
              </tr>
            )}

            {!loading &&
              !error &&
              filteredClientes.map((cliente) => (
                <tr key={cliente.id}>
                  <td>{cliente.codigo ?? '—'}</td>
                  <td>{cliente.nombre ?? '—'}</td>
                  <td>{cliente.documento_fiscal ?? '—'}</td>
                  <td>{cliente.direccion ?? '—'}</td>
                  <td>
                    {cliente.sucursales.length > 0 ? (
                      <div className="tag-list">
                        {cliente.sucursales.map((sucursal, index) => (
                          <span key={`${cliente.id}-${sucursal.id ?? index}`} className="tag">
                            {sucursal.nombre ?? 'Sucursal'} - {sucursal.direccion ?? 'Sin direccion'}
                          </span>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        type="button"
                        aria-label={`Editar cliente ${cliente.nombre ?? ''}`}
                        onClick={() => navigate(`/clientes/${cliente.id}/editar`)}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        aria-label={`Eliminar cliente ${cliente.nombre ?? ''}`}
                        onClick={() => void handleDeleteCliente(cliente)}
                        disabled={deletingClienteId === cliente.id}
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

