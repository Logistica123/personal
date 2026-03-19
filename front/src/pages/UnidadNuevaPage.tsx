import React, { useMemo, useState } from 'react';
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

export const UnidadNuevaPage: React.FC<{
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
}> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [formValues, setFormValues] = useState({
    matricula: '',
    marca: '',
    modelo: '',
    anio: '',
    observacion: '',
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSubmitError(null);
      setSuccessMessage(null);
      setSaving(true);

      const response = await fetch(`${apiBaseUrl}/api/unidades`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matricula: formValues.matricula.trim() || null,
          marca: formValues.marca.trim() || null,
          modelo: formValues.modelo.trim() || null,
          anio: formValues.anio.trim() || null,
          observacion: formValues.observacion.trim() || null,
        }),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;

        try {
          const errorPayload = await response.json();
          if (typeof errorPayload?.message === 'string') {
            message = errorPayload.message;
          } else if (errorPayload?.errors) {
            const firstError = Object.values(errorPayload.errors)[0];
            if (Array.isArray(firstError) && firstError[0]) {
              message = firstError[0] as string;
            }
          }
        } catch {
          // ignore
        }

        throw new Error(message);
      }

      const payload = (await response.json()) as {
        message?: string;
        data: Unidad;
      };

      setSuccessMessage(payload.message ?? 'Unidad registrada correctamente.');
      setFormValues({
        matricula: payload.data.matricula ?? '',
        marca: payload.data.marca ?? '',
        modelo: payload.data.modelo ?? '',
        anio: payload.data.anio ?? '',
        observacion: payload.data.observacion ?? '',
      });
    } catch (err) {
      setSubmitError((err as Error).message ?? 'No se pudo registrar la unidad.');
    } finally {
      setSaving(false);
    }
  };

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/unidades')}>
        ← Volver a unidades
      </button>
    </div>
  );

  return (
    <DashboardLayout title="Crear unidad" subtitle="Registrar una nueva unidad" headerContent={headerContent}>
      <form className="edit-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="input-control">
            <span>Matrícula</span>
            <input
              type="text"
              value={formValues.matricula}
              onChange={(event) => setFormValues((prev) => ({ ...prev, matricula: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Marca</span>
            <input
              type="text"
              value={formValues.marca}
              onChange={(event) => setFormValues((prev) => ({ ...prev, marca: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Modelo</span>
            <input
              type="text"
              value={formValues.modelo}
              onChange={(event) => setFormValues((prev) => ({ ...prev, modelo: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Año</span>
            <input
              type="text"
              value={formValues.anio}
              onChange={(event) => setFormValues((prev) => ({ ...prev, anio: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
        </div>

        <label className="input-control">
          <span>Observación</span>
          <input
            type="text"
            value={formValues.observacion}
            onChange={(event) => setFormValues((prev) => ({ ...prev, observacion: event.target.value }))}
            placeholder="Ingresar"
          />
        </label>

        {submitError ? <p className="form-info form-info--error">{submitError}</p> : null}
        {successMessage ? <p className="form-info form-info--success">{successMessage}</p> : null}

        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => navigate('/unidades')}>
            Cancelar
          </button>
          <button type="submit" className="primary-action" disabled={saving}>
            {saving ? 'Registrando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
};

