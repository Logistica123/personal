import React, { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

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

export const UsuarioNuevoPage: React.FC<{
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  USER_ROLE_OPTIONS: Array<{ value: string; label: string }>;
}> = ({ DashboardLayout, resolveApiBaseUrl, useStoredAuthUser, USER_ROLE_OPTIONS }) => {
  const authUser = useStoredAuthUser();
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [formValues, setFormValues] = useState({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    role: 'operator',
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isAdmin = useMemo(() => (authUser?.role?.toLowerCase() ?? '').includes('admin'), [authUser?.role]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSubmitError(null);
      setSuccessMessage(null);
      setSaving(true);

      const response = await fetch(`${apiBaseUrl}/api/usuarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formValues.name.trim(),
          email: formValues.email.trim(),
          password: formValues.password,
          password_confirmation: formValues.password_confirmation,
          role: formValues.role || 'operator',
        }),
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

      const payload = (await response.json()) as { message?: string };
      setSuccessMessage(payload.message ?? 'Usuario registrado correctamente.');
      setFormValues((prev) => ({
        ...prev,
        password: '',
        password_confirmation: '',
        role: 'operator',
      }));
    } catch (err) {
      setSubmitError((err as Error).message ?? 'No se pudo registrar el usuario.');
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
      <DashboardLayout title="Crear usuario" subtitle="Registrar un nuevo usuario" headerContent={headerContent}>
        <p className="form-info">Verificando permisos...</p>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/clientes" replace />;
  }

  return (
    <DashboardLayout title="Crear usuario" subtitle="Registrar un nuevo usuario" headerContent={headerContent}>
      <form className="edit-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="input-control">
            <span>Nombre</span>
            <input
              type="text"
              value={formValues.name}
              onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Ingresar"
              required
            />
          </label>
          <label className="input-control">
            <span>Email</span>
            <input
              type="email"
              value={formValues.email}
              onChange={(event) => setFormValues((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="Ingresar"
              required
            />
          </label>
          <label className="input-control">
            <span>Contraseña</span>
            <input
              type="password"
              value={formValues.password}
              onChange={(event) => setFormValues((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Ingresar"
              required
            />
          </label>
          <label className="input-control">
            <span>Confirmar contraseña</span>
            <input
              type="password"
              value={formValues.password_confirmation}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, password_confirmation: event.target.value }))
              }
              placeholder="Ingresar"
              required
            />
          </label>
        </div>

        <label className="input-control">
          <span>Rol</span>
          <select
            value={formValues.role}
            onChange={(event) => setFormValues((prev) => ({ ...prev, role: event.target.value }))}
          >
            {USER_ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {submitError ? <p className="form-info form-info--error">{submitError}</p> : null}
        {successMessage ? <p className="form-info form-info--success">{successMessage}</p> : null}

        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => navigate('/usuarios')}>
            Cancelar
          </button>
          <button type="submit" className="primary-action" disabled={saving}>
            {saving ? 'Registrando...' : 'Registrar usuario'}
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
};

