import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
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

export const UsuarioEditarPage: React.FC<{
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  normalizeUserRole: (role: string | null | undefined) => string;
  formatRoleLabel: (role: string | null | undefined) => string;
  USER_ROLE_OPTIONS: Array<{ value: string; label: string }>;
}> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  normalizeUserRole,
  formatRoleLabel,
  USER_ROLE_OPTIONS,
}) => {
  const { usuarioId } = useParams<{ usuarioId: string }>();
  const authUser = useStoredAuthUser();
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [role, setRole] = useState('operator');
  const isAdmin = useMemo(() => (authUser?.role?.toLowerCase() ?? '').includes('admin'), [authUser?.role]);

  useEffect(() => {
    if (!usuarioId) {
      setLoadError('Identificador de usuario inválido.');
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchUsuario = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const response = await fetch(`${apiBaseUrl}/api/usuarios/${usuarioId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: Usuario };

        if (!payload?.data) {
          throw new Error('Formato de respuesta inesperado');
        }

        setUserName(payload.data.name ?? payload.data.email ?? `Usuario #${usuarioId}`);
        setName(payload.data.name ?? '');
        setEmail(payload.data.email ?? '');
        setRole(normalizeUserRole(payload.data.role));
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }

        setLoadError((err as Error).message ?? 'No se pudo cargar el usuario.');
      } finally {
        setLoading(false);
      }
    };

    void fetchUsuario();

    return () => controller.abort();
  }, [apiBaseUrl, normalizeUserRole, usuarioId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!usuarioId) {
      setSubmitError('Identificador de usuario inválido.');
      return;
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setSubmitError('El nombre es obligatorio.');
      return;
    }
    if (!trimmedEmail) {
      setSubmitError('El email es obligatorio.');
      return;
    }

    try {
      setSubmitError(null);
      setSuccessMessage(null);
      setSaving(true);

      const payloadBody: Record<string, unknown> = {
        name: trimmedName,
        email: trimmedEmail,
        role,
      };
      if (password.trim().length > 0) {
        payloadBody.password = password;
        payloadBody.password_confirmation = passwordConfirmation;
      }

      const response = await fetch(`${apiBaseUrl}/api/usuarios/${usuarioId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadBody),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = await response.json();
          if (typeof payload?.message === 'string') {
            message = payload.message;
          } else if (payload?.errors) {
            const firstError = Object.values(payload.errors)[0];
            if (Array.isArray(firstError) && firstError[0]) {
              message = firstError[0] as string;
            }
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const payload = (await response.json()) as { message?: string; data?: Usuario };
      const resolvedRoleRaw = payload.data?.role ?? null;
      const normalizedRole = resolvedRoleRaw ? normalizeUserRole(resolvedRoleRaw) : role;

      const resolvedName = payload.data?.name ?? trimmedName;
      const resolvedEmail = payload.data?.email ?? trimmedEmail;
      setName(resolvedName);
      setEmail(resolvedEmail);

      if (payload.data?.name || payload.data?.email) {
        setUserName((prev) => payload.data?.name ?? payload.data?.email ?? prev);
      } else {
        setUserName(resolvedName || resolvedEmail || userName);
      }

      setRole(normalizedRole);

      const displayRoleLabel = formatRoleLabel(resolvedRoleRaw ?? normalizedRole);
      const defaultSuccessMessage = `Usuario actualizado correctamente. Rol actual: ${displayRoleLabel}.`;
      setSuccessMessage(payload.message ? `${payload.message} Rol actual: ${displayRoleLabel}.` : defaultSuccessMessage);

      if (password.trim().length > 0) {
        setPassword('');
        setPasswordConfirmation('');
      }
    } catch (err) {
      setSubmitError((err as Error).message ?? 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/usuarios')}>
        ← Volver a usuarios
      </button>
    </div>
  );

  if (!authUser?.role) {
    return (
      <DashboardLayout title="Editar usuario" subtitle={`Usuario #${usuarioId ?? ''}`} headerContent={headerContent}>
        <p className="form-info">Verificando permisos...</p>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/clientes" replace />;
  }

  if (loading) {
    return (
      <DashboardLayout title="Editar usuario" subtitle={`Usuario #${usuarioId ?? ''}`} headerContent={headerContent}>
        <p className="form-info">Cargando información del usuario...</p>
      </DashboardLayout>
    );
  }

  if (loadError) {
    return (
      <DashboardLayout title="Editar usuario" subtitle={`Usuario #${usuarioId ?? ''}`} headerContent={headerContent}>
        <p className="form-info form-info--error">{loadError}</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Editar usuario"
      subtitle={userName ? `Usuario: ${userName} · Rol actual: ${formatRoleLabel(role)}` : undefined}
      headerContent={headerContent}
    >
      <form className="edit-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="form-grid">
          <label className="input-control">
            <span>Nombre</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre completo"
              required
            />
          </label>
          <label className="input-control">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="correo@ejemplo.com"
              required
            />
          </label>
          <label className="input-control">
            <span>Nueva contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nueva contraseña"
              required={password.trim().length > 0}
            />
          </label>
          <label className="input-control">
            <span>Confirmar contraseña</span>
            <input
              type="password"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              placeholder="Confirmar contraseña"
              required={password.trim().length > 0}
            />
          </label>
          <label className="input-control">
            <span>Rol</span>
            <select value={role} onChange={(event) => setRole(normalizeUserRole(event.target.value))}>
              {USER_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {submitError ? <p className="form-info form-info--error">{submitError}</p> : null}
        {successMessage ? <p className="form-info form-info--success">{successMessage}</p> : null}

        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => navigate('/usuarios')}>
            Cancelar
          </button>
          <button type="submit" className="primary-action" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
};

