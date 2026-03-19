import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
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

const AUTH_STORAGE_KEY = 'authUser';

export const UsuariosPage: React.FC<{
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  normalizeUserRole: (role: string | null | undefined) => string;
  formatRoleLabel: (role: string | null | undefined) => string;
  USER_ROLE_OPTIONS: Array<{ value: string; label: string }>;
  USER_PERMISSION_OPTIONS: Array<{ value: string; label: string }>;
}> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  normalizeUserRole,
  formatRoleLabel,
  USER_ROLE_OPTIONS,
  USER_PERMISSION_OPTIONS,
}) => {
  const authUser = useStoredAuthUser();
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deletingUsuarioId, setDeletingUsuarioId] = useState<number | null>(null);
  const [roleUpdatingIds, setRoleUpdatingIds] = useState<Set<number>>(() => new Set());
  const [permissionsModalUser, setPermissionsModalUser] = useState<Usuario | null>(null);
  const [permissionsDraft, setPermissionsDraft] = useState<Set<string>>(new Set());
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const isAdmin = useMemo(() => (authUser?.role?.toLowerCase() ?? '').includes('admin'), [authUser?.role]);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchUsuarios = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${apiBaseUrl}/api/usuarios`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: Usuario[] };
        if (!payload || !Array.isArray(payload.data)) {
          throw new Error('Formato de respuesta inesperado');
        }

        setUsuarios(payload.data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setError((err as Error).message ?? 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    void fetchUsuarios();

    return () => controller.abort();
  }, [apiBaseUrl, isAdmin]);

  const filteredUsuarios = useMemo(() => {
    const roleTarget = roleFilter ? normalizeUserRole(roleFilter) : null;
    const term = searchTerm.trim().toLowerCase();
    if (term.length === 0 && !roleTarget) {
      return usuarios;
    }

    return usuarios.filter((usuario) => {
      if (roleTarget && normalizeUserRole(usuario.role) !== roleTarget) {
        return false;
      }
      const fields = [
        usuario.name,
        usuario.email,
        usuario.created_at?.toString(),
        formatRoleLabel(usuario.role ?? null),
        usuario.role,
      ];
      return fields.some((field) => field?.toLowerCase().includes(term));
    });
  }, [formatRoleLabel, normalizeUserRole, roleFilter, searchTerm, usuarios]);

  const footerLabel = useMemo(() => {
    if (loading) {
      return 'Cargando usuarios...';
    }

    if (error) {
      return 'No se pudieron cargar los usuarios';
    }

    if (filteredUsuarios.length === 0) {
      return 'No hay usuarios para mostrar.';
    }

    if (filteredUsuarios.length === usuarios.length) {
      return `Mostrando ${usuarios.length} usuario${usuarios.length === 1 ? '' : 's'}`;
    }

    return `Mostrando ${filteredUsuarios.length} de ${usuarios.length} usuarios`;
  }, [loading, error, filteredUsuarios.length, usuarios.length]);

  const handleDeleteUsuario = async (usuario: Usuario) => {
    if (!window.confirm(`¿Seguro que deseas eliminar al usuario "${usuario.name ?? usuario.email ?? usuario.id}"?`)) {
      return;
    }

    try {
      setDeletingUsuarioId(usuario.id);
      const response = await fetch(`${apiBaseUrl}/api/usuarios/${usuario.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = await response.json();
          if (typeof payload?.message === 'string') {
            message = payload.message;
          }
        } catch {
          // ignore
        }

        throw new Error(message);
      }

      setUsuarios((prev) => prev.filter((item) => item.id !== usuario.id));
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo eliminar el usuario.');
    } finally {
      setDeletingUsuarioId(null);
    }
  };

  const handleRoleChange = async (usuario: Usuario, nextRole: string) => {
    const normalizedRole = normalizeUserRole(nextRole);
    const currentRole = normalizeUserRole(usuario.role);
    if (normalizedRole === currentRole) {
      return;
    }

    try {
      setRoleUpdatingIds((prev) => new Set(prev).add(usuario.id));
      const response = await fetch(`${apiBaseUrl}/api/usuarios/${usuario.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: normalizedRole }),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = await response.json();
          if (typeof payload?.message === 'string') {
            message = payload.message;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const payload = (await response.json()) as { data?: Usuario };
      const updatedRole = payload?.data?.role ?? normalizedRole;
      setUsuarios((prev) => prev.map((item) => (item.id === usuario.id ? { ...item, role: updatedRole } : item)));
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo actualizar el rol.');
    } finally {
      setRoleUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(usuario.id);
        return next;
      });
    }
  };

  const openPermissionsModal = (usuario: Usuario) => {
    const initial = Array.isArray(usuario.permissions) ? usuario.permissions : [];
    setPermissionsDraft(new Set(initial));
    setPermissionsModalUser(usuario);
  };

  const closePermissionsModal = () => {
    setPermissionsModalUser(null);
    setPermissionsDraft(new Set());
    setPermissionsSaving(false);
  };

  const togglePermission = (value: string) => {
    setPermissionsDraft((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const savePermissions = async () => {
    if (!permissionsModalUser) {
      return;
    }

    try {
      setPermissionsSaving(true);
      const response = await fetch(`${apiBaseUrl}/api/usuarios/${permissionsModalUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permissions: Array.from(permissionsDraft) }),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = await response.json();
          if (typeof payload?.message === 'string') {
            message = payload.message;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const payload = (await response.json()) as { data?: Usuario };
      const updatedPermissions = payload?.data?.permissions ?? Array.from(permissionsDraft);
      setUsuarios((prev) =>
        prev.map((item) => (item.id === permissionsModalUser.id ? { ...item, permissions: updatedPermissions } : item))
      );
      if (authUser?.id === permissionsModalUser.id) {
        const updatedAuth: AuthUser = {
          id: authUser.id,
          name: authUser.name ?? null,
          email: authUser.email ?? null,
          role: authUser.role ?? null,
          token: authUser.token ?? null,
          permissions: updatedPermissions,
        };
        try {
          const serialized = JSON.stringify(updatedAuth);
          const hasLocal = Boolean(window.localStorage.getItem(AUTH_STORAGE_KEY));
          const hasSession = Boolean(window.sessionStorage.getItem(AUTH_STORAGE_KEY));
          if (hasLocal) {
            window.localStorage.setItem(AUTH_STORAGE_KEY, serialized);
          }
          if (hasSession || (!hasLocal && !hasSession)) {
            window.sessionStorage.setItem(AUTH_STORAGE_KEY, serialized);
          }
          window.dispatchEvent(new CustomEvent('auth:updated'));
        } catch {
          // ignore
        }
      }
      closePermissionsModal();
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudieron guardar los permisos.');
      setPermissionsSaving(false);
    }
  };

  const headerContent = (
    <div className="card-header">
      <div className="filters-actions" style={{ flex: 1 }}>
        <div className="search-wrapper">
          <input
            type="search"
            placeholder="Buscar"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <label className="filter-field" style={{ minWidth: '200px' }}>
          <span>Rol</span>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">Todos los roles</option>
            {USER_ROLE_OPTIONS.map((option) => (
              <option key={`role-filter-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="primary-action" type="button" onClick={() => navigate('/usuarios/nuevo')}>
        Registrar usuario
      </button>
    </div>
  );

  if (!authUser?.role) {
    return (
      <DashboardLayout title="Gestionar usuarios" subtitle="Gestionar usuarios" headerContent={headerContent}>
        <p className="form-info">Verificando permisos...</p>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/clientes" replace />;
  }

  return (
    <DashboardLayout title="Gestionar usuarios" subtitle="Gestionar usuarios" headerContent={headerContent}>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Creado</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7}>Cargando usuarios...</td>
              </tr>
            )}

            {error && !loading && (
              <tr>
                <td colSpan={7} className="error-cell">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && filteredUsuarios.length === 0 && (
              <tr>
                <td colSpan={7}>No hay usuarios para mostrar.</td>
              </tr>
            )}

            {!loading &&
              !error &&
              filteredUsuarios.map((usuario) => {
                const statusValue = (usuario.status ?? 'activo').toLowerCase();
                const statusLabel = statusValue === 'inactivo' ? 'Inactivo' : 'Activo';
                const normalizedRole = normalizeUserRole(usuario.role);

                return (
                  <tr key={usuario.id}>
                    <td>{usuario.id}</td>
                    <td>{usuario.name ?? '—'}</td>
                    <td>{usuario.email ?? '—'}</td>
                    <td>{usuario.created_at ?? '—'}</td>
                    <td>
                      <select
                        value={normalizedRole}
                        onChange={(event) => void handleRoleChange(usuario, event.target.value)}
                        disabled={roleUpdatingIds.has(usuario.id)}
                      >
                        {USER_ROLE_OPTIONS.map((option) => (
                          <option key={`user-role-${usuario.id}-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`status-badge${statusValue === 'inactivo' ? ' is-inactive' : ''}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          aria-label={`Permisos de ${usuario.name ?? usuario.email ?? ''}`}
                          onClick={() => openPermissionsModal(usuario)}
                        >
                          🔑
                        </button>
                        <button
                          type="button"
                          aria-label={`Editar usuario ${usuario.name ?? ''}`}
                          onClick={() => navigate(`/usuarios/${usuario.id}/editar`)}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          aria-label={`Eliminar usuario ${usuario.name ?? ''}`}
                          onClick={() => void handleDeleteUsuario(usuario)}
                          disabled={deletingUsuarioId === usuario.id}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
      {permissionsModalUser ? (
        <div className="permissions-modal" role="dialog" aria-modal="true">
          <div className="permissions-modal__backdrop" onClick={closePermissionsModal} />
          <div className="permissions-modal__content">
            <div className="permissions-modal__header">
              <div>
                <h3>Permisos de usuario</h3>
                <p>{permissionsModalUser.name ?? permissionsModalUser.email ?? `Usuario #${permissionsModalUser.id}`}</p>
              </div>
              <button type="button" onClick={closePermissionsModal} aria-label="Cerrar">
                ×
              </button>
            </div>
            <div className="permissions-modal__body">
              <div className="permissions-grid">
                {USER_PERMISSION_OPTIONS.map((option) => (
                  <label key={`perm-${permissionsModalUser.id}-${option.value}`} className="permissions-option">
                    <input
                      type="checkbox"
                      checked={permissionsDraft.has(option.value)}
                      onChange={() => togglePermission(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="permissions-modal__actions">
              <button type="button" className="secondary-action" onClick={closePermissionsModal}>
                Cancelar
              </button>
              <button type="button" className="primary-action" onClick={() => void savePermissions()} disabled={permissionsSaving}>
                {permissionsSaving ? 'Guardando...' : 'Guardar permisos'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
};

