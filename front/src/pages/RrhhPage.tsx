import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { RrhhUserDocument } from '../features/rrhh/types';
import type { Usuario } from '../features/usuarios/types';

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

export const RrhhPage: React.FC<{
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  buildActorHeaders: (authUser: AuthUser | null | undefined) => Record<string, string>;
  parseJsonSafe: (response: Response) => Promise<unknown>;
  resolveApiUrl: (baseUrl: string, target?: string | null) => string | null;
  withAuthToken: (url: string | null) => string | null;
  RRHH_DOCUMENT_CATEGORY_OPTIONS: Array<{ value: string; label: string }>;
}> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  buildActorHeaders,
  parseJsonSafe,
  resolveApiUrl,
  withAuthToken,
  RRHH_DOCUMENT_CATEGORY_OPTIONS,
}) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const authUser = useStoredAuthUser();
  const actorHeaders = useMemo(() => buildActorHeaders(authUser), [authUser, buildActorHeaders]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(true);
  const [usuariosError, setUsuariosError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [documents, setDocuments] = useState<RrhhUserDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState({
    category: 'FICHA_MEDICA',
    title: '',
    description: '',
    fechaVencimiento: '',
    file: null as File | null,
  });

  const selectedUser = useMemo(
    () => usuarios.find((item) => String(item.id) === selectedUserId) ?? null,
    [usuarios, selectedUserId]
  );

  const formatDateCell = useCallback((value?: string | null) => {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString('es-AR');
  }, []);

  const formatFileSize = useCallback((size?: number | null) => {
    if (size == null || !Number.isFinite(size) || size <= 0) {
      return '—';
    }
    if (size < 1024) {
      return `${size} B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  const loadDocuments = useCallback(
    async (userIdRaw: string) => {
      if (!userIdRaw) {
        setDocuments([]);
        return;
      }
      setDocumentsLoading(true);
      setDocumentsError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/api/usuarios/${userIdRaw}/documentos`, {
          headers: {
            Accept: 'application/json',
            ...actorHeaders,
          },
          credentials: 'include',
        });
        const payload = (await parseJsonSafe(response)) as { data?: RrhhUserDocument[]; message?: string };
        if (!response.ok) {
          throw new Error(payload?.message ?? 'No se pudieron cargar los documentos de RRHH.');
        }
        setDocuments(Array.isArray(payload?.data) ? payload.data : []);
      } catch (err) {
        setDocuments([]);
        setDocumentsError(err instanceof Error ? err.message : 'No se pudieron cargar los documentos de RRHH.');
      } finally {
        setDocumentsLoading(false);
      }
    },
    [actorHeaders, apiBaseUrl, parseJsonSafe]
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const loadUsuarios = async () => {
      setUsuariosLoading(true);
      setUsuariosError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/api/usuarios`, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            ...actorHeaders,
          },
          credentials: 'include',
        });
        const payload = (await parseJsonSafe(response)) as { data?: Usuario[]; message?: string };
        if (!response.ok) {
          throw new Error(payload?.message ?? 'No se pudieron cargar los usuarios.');
        }
        if (cancelled) {
          return;
        }
        const list = Array.isArray(payload?.data) ? payload.data : [];
        setUsuarios(list);
        setSelectedUserId((prev) => {
          if (prev && list.some((item) => String(item.id) === prev)) {
            return prev;
          }
          return list[0] ? String(list[0].id) : '';
        });
      } catch (err) {
        if (!cancelled) {
          setUsuarios([]);
          setUsuariosError(err instanceof Error ? err.message : 'No se pudieron cargar los usuarios.');
        }
      } finally {
        if (!cancelled) {
          setUsuariosLoading(false);
        }
      }
    };

    void loadUsuarios();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [actorHeaders, apiBaseUrl, parseJsonSafe]);

  useEffect(() => {
    void loadDocuments(selectedUserId);
  }, [loadDocuments, selectedUserId]);

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionMessage(null);
    setActionError(null);
    if (!selectedUserId) {
      setActionError('Seleccioná un usuario para cargar el documento.');
      return;
    }
    if (!formValues.title.trim()) {
      setActionError('Ingresá un título del documento.');
      return;
    }
    if (!formValues.file) {
      setActionError('Seleccioná un archivo.');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('category', formValues.category);
      formData.append('title', formValues.title.trim());
      if (formValues.description.trim()) {
        formData.append('description', formValues.description.trim());
      }
      if (formValues.fechaVencimiento) {
        formData.append('fechaVencimiento', formValues.fechaVencimiento);
      }
      formData.append('archivo', formValues.file);

      const response = await fetch(`${apiBaseUrl}/api/usuarios/${selectedUserId}/documentos`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...actorHeaders,
        },
        body: formData,
        credentials: 'include',
      });
      const payload = (await parseJsonSafe(response)) as { message?: string };
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo cargar el documento.');
      }

      setActionMessage(payload?.message ?? 'Documento cargado correctamente.');
      setFormValues((current) => ({
        ...current,
        title: '',
        description: '',
        fechaVencimiento: '',
        file: null,
      }));
      await loadDocuments(selectedUserId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo cargar el documento.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDocument = async (documento: RrhhUserDocument) => {
    if (!selectedUserId || !documento.id) {
      return;
    }
    if (!window.confirm(`¿Eliminar "${documento.title ?? documento.originalName ?? `Documento #${documento.id}`}"?`)) {
      return;
    }

    setActionMessage(null);
    setActionError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/usuarios/${selectedUserId}/documentos/${documento.id}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...actorHeaders,
        },
        credentials: 'include',
      });
      const payload = (await parseJsonSafe(response)) as { message?: string };
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo eliminar el documento.');
      }
      setActionMessage(payload?.message ?? 'Documento eliminado correctamente.');
      await loadDocuments(selectedUserId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo eliminar el documento.');
    }
  };

  const handleDownloadDocument = (documento: RrhhUserDocument) => {
    const fallbackPath =
      selectedUserId && documento.id ? `/api/usuarios/${selectedUserId}/documentos/${documento.id}/descargar` : null;
    const resolved = resolveApiUrl(apiBaseUrl, documento.downloadUrl ?? fallbackPath);
    const downloadUrl = withAuthToken(resolved);
    if (!downloadUrl) {
      window.alert('No se encontró URL de descarga para el documento.');
      return;
    }
    window.open(downloadUrl, '_blank', 'noopener');
  };

  return (
    <DashboardLayout title="RRHH" subtitle="Legajo documental por usuario">
      <section className="dashboard-card">
        <header className="card-header">
          <h3>Usuario</h3>
        </header>
        <div className="card-body">
          <div className="form-grid">
            <label className="input-control">
              <span>Seleccionar empleado/usuario</span>
              <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                {usuarios.length === 0 ? <option value="">Sin usuarios</option> : null}
                {usuarios.map((usuario) => (
                  <option key={`rrhh-user-${usuario.id}`} value={String(usuario.id)}>
                    {usuario.name ?? usuario.email ?? `Usuario #${usuario.id}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="helper-text">
            {selectedUser
              ? `Legajo seleccionado: ${selectedUser.name ?? selectedUser.email ?? `Usuario #${selectedUser.id}`}`
              : 'Seleccioná un usuario para gestionar su documentación.'}
          </p>
          {usuariosLoading ? <p className="helper-text">Cargando usuarios...</p> : null}
          {usuariosError ? <p className="form-info form-info--error">{usuariosError}</p> : null}
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <h3>Cargar documento RRHH</h3>
        </header>
        <div className="card-body">
          <form onSubmit={(event) => void handleUpload(event)}>
            <div className="form-grid">
              <label className="input-control">
                <span>Categoría</span>
                <select
                  value={formValues.category}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, category: event.target.value }))}
                >
                  {RRHH_DOCUMENT_CATEGORY_OPTIONS.map((option) => (
                    <option key={`rrhh-cat-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-control">
                <span>Título</span>
                <input
                  value={formValues.title}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Ej: Contrato 2026"
                />
              </label>
              <label className="input-control">
                <span>Vencimiento (opcional)</span>
                <input
                  type="date"
                  value={formValues.fechaVencimiento}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, fechaVencimiento: event.target.value }))}
                />
              </label>
              <label className="input-control">
                <span>Archivo</span>
                <input
                  type="file"
                  onChange={(event) => setFormValues((prev) => ({ ...prev, file: event.target.files?.[0] ?? null }))}
                />
              </label>
            </div>
            <label className="input-control">
              <span>Descripción (opcional)</span>
              <textarea
                rows={2}
                value={formValues.description}
                onChange={(event) => setFormValues((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Observaciones internas..."
              />
            </label>

            <div className="filters-actions">
              <button type="submit" className="primary-action" disabled={saving || !selectedUserId}>
                {saving ? 'Subiendo...' : 'Subir documento'}
              </button>
              <span className="helper-text">Máximo 50MB por archivo.</span>
            </div>
          </form>
          {actionMessage ? <p className="form-info form-info--success">{actionMessage}</p> : null}
          {actionError ? <p className="form-info form-info--error">{actionError}</p> : null}
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <h3>Documentos cargados</h3>
        </header>
        <div className="card-body">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Categoría</th>
                  <th>Título</th>
                  <th>Archivo</th>
                  <th>Vencimiento</th>
                  <th>Subido</th>
                  <th>Tamaño</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {documentsLoading ? (
                  <tr>
                    <td colSpan={8}>Cargando documentos...</td>
                  </tr>
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={8}>No hay documentos de RRHH para este usuario.</td>
                  </tr>
                ) : (
                  documents.map((documento) => (
                    <tr key={`rrhh-doc-${documento.id}`}>
                      <td>{documento.id}</td>
                      <td>{documento.category ?? 'OTRO'}</td>
                      <td>{documento.title ?? '—'}</td>
                      <td>{documento.originalName ?? '—'}</td>
                      <td>{documento.fechaVencimiento ?? '—'}</td>
                      <td>{formatDateCell(documento.createdAt)}</td>
                      <td>{formatFileSize(documento.size)}</td>
                      <td>
                        <div className="action-buttons">
                          <button type="button" onClick={() => handleDownloadDocument(documento)}>
                            ⬇️
                          </button>
                          <button type="button" onClick={() => void handleDeleteDocument(documento)}>
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {documentsError ? <p className="form-info form-info--error">{documentsError}</p> : null}
        </div>
      </section>
    </DashboardLayout>
  );
};

