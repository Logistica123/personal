import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  layoutVariant?: 'default' | 'panel';
  monitorView?: boolean;
};

type DocumentTypeCreatePageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
};

export const DocumentTypeCreatePage: React.FC<DocumentTypeCreatePageProps> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [vence, setVence] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = nombre.trim();
    if (!trimmed) {
      setSubmitError('Ingresá un nombre para el tipo.');
      return;
    }

    try {
      setSaving(true);
      setSubmitError(null);

      const response = await fetch(`${apiBaseUrl}/api/personal/documentos/tipos`, {
        method: 'POST',
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
        replace: true,
        state: {
          message: 'Tipo de documento creado correctamente.',
        },
      });
    } catch (err) {
      setSubmitError((err as Error).message ?? 'No se pudo crear el tipo de documento.');
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

  return (
    <DashboardLayout title="Nuevo tipo de archivo" subtitle="Crear tipo" headerContent={headerContent}>
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
            {saving ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
};

