import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { PersonalDocumentType } from '../features/documentos/types';

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  layoutVariant?: 'default' | 'panel';
  monitorView?: boolean;
};

type DocumentTypeEditPageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
};

export const DocumentTypeEditPage: React.FC<DocumentTypeEditPageProps> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const { tipoId } = useParams<{ tipoId: string }>();
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [nombre, setNombre] = useState('');
  const [vence, setVence] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!tipoId) {
      setLoadError('Identificador de tipo inválido.');
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchType = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const response = await fetch(`${apiBaseUrl}/api/personal/documentos/tipos/${tipoId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: PersonalDocumentType };
        if (!payload?.data) {
          throw new Error('Formato de respuesta inesperado');
        }

        setNombre(payload.data.nombre ?? '');
        setVence(Boolean(payload.data.vence));
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setLoadError((err as Error).message ?? 'No se pudo cargar el tipo de documento.');
      } finally {
        setLoading(false);
      }
    };

    fetchType();

    return () => controller.abort();
  }, [apiBaseUrl, tipoId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!tipoId) {
      setSubmitError('Identificador de tipo inválido.');
      return;
    }

    const trimmed = nombre.trim();
    if (!trimmed) {
      setSubmitError('Ingresá un nombre para el tipo.');
      return;
    }

    try {
      setSaving(true);
      setSubmitError(null);

      const response = await fetch(`${apiBaseUrl}/api/personal/documentos/tipos/${tipoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nombre: trimmed, vence }),
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

      navigate('/documentos', {
        state: {
          message: 'Tipo de documento actualizado correctamente.',
        },
        replace: true,
      });
    } catch (err) {
      setSubmitError((err as Error).message ?? 'No se pudo actualizar el tipo de documento.');
    } finally {
      setSaving(false);
    }
  };

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/documentos')}>
        ← Volver a documentos
      </button>
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout title="Editar tipo de archivo" subtitle="Editar tipo" headerContent={headerContent}>
        <p className="form-info">Cargando información del tipo...</p>
      </DashboardLayout>
    );
  }

  if (loadError) {
    return (
      <DashboardLayout title="Editar tipo de archivo" subtitle="Editar tipo" headerContent={headerContent}>
        <p className="form-info form-info--error">{loadError}</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Editar tipo de archivo" subtitle="Editar tipo" headerContent={headerContent}>
      <form className="edit-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="input-control" style={{ gridColumn: '1 / -1' }}>
            <span>Nombre</span>
            <input
              type="text"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Ingresar nombre"
              required
            />
          </label>
        </div>

        <div className="radio-group">
          <span>Vence</span>
          <div className="radio-options">
            <label className={`radio-option${vence ? ' is-active' : ''}`}>
              <input
                type="radio"
                name="vence"
                value="true"
                checked={vence === true}
                onChange={() => setVence(true)}
              />
              Sí
            </label>
            <label className={`radio-option${!vence ? ' is-active' : ''}`}>
              <input
                type="radio"
                name="vence"
                value="false"
                checked={vence === false}
                onChange={() => setVence(false)}
              />
              No
            </label>
          </div>
        </div>

        {submitError ? <p className="form-info form-info--error">{submitError}</p> : null}

        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => navigate('/documentos')}>
            Cancelar
          </button>
          <button type="submit" className="primary-action" disabled={saving}>
            {saving ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
};

