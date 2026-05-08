import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
};

type Props = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
};

/**
 * Bloque B — pantalla CRUD para administrar permisos del módulo Pólizas.
 *
 * Solo accesible para users con rol `admin` (super-admin del sistema). El
 * backend valida 403 si no lo es. Cada fila representa un user con sus 8
 * flags granulares (cargar PDF, solicitar alta/baja, confirmar respuesta,
 * editar email config, gestionar cláusulas, notificar distribuidores,
 * recibir alertas vencimiento).
 */

const FLAGS: Array<{ key: PermFlag; label: string; descripcion: string }> = [
  { key: 'puede_cargar_pdf',                label: 'Cargar PDF',          descripcion: 'Subir constancias / endosos al sistema.' },
  { key: 'puede_solicitar_alta',            label: 'Solicitar alta',      descripcion: 'Crear solicitudes de alta a aseguradoras.' },
  { key: 'puede_solicitar_baja',            label: 'Solicitar baja',      descripcion: 'Crear solicitudes de baja a aseguradoras.' },
  { key: 'puede_confirmar_respuesta',       label: 'Confirmar respuesta', descripcion: 'Cerrar solicitudes con la respuesta de la aseguradora.' },
  { key: 'puede_editar_email_config',       label: 'Editar email config', descripcion: 'Modificar destinatarios y templates de email por póliza.' },
  { key: 'puede_gestionar_clausulas',       label: 'Gestionar cláusulas', descripcion: 'CRUD del catálogo de cláusulas + aplicarlas a pólizas.' },
  { key: 'puede_notificar_distribuidores',  label: 'Notificar distribuidores', descripcion: 'Enviar email al distribuidor cuando se confirma alta.' },
  { key: 'recibe_alertas_vencimiento',      label: 'Recibe alertas',      descripcion: 'Recibe email diario de vencimientos próximos / solicitudes pendientes.' },
];

type PermFlag =
  | 'puede_cargar_pdf'
  | 'puede_solicitar_alta'
  | 'puede_solicitar_baja'
  | 'puede_confirmar_respuesta'
  | 'puede_editar_email_config'
  | 'puede_gestionar_clausulas'
  | 'puede_notificar_distribuidores'
  | 'recibe_alertas_vencimiento';

type AdminRow = {
  id: number;
  user_id: number;
  notas: string | null;
  user: { id: number; name: string | null; email: string | null; role: string | null };
} & Record<PermFlag, boolean>;

type UsuarioOpt = { id: number; name: string | null; email: string | null; role: string | null };

export const PolizaAdminsPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [rows, setRows] = useState<AdminRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const fetchRows = useCallback(async () => {
    setError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/admins`, { cache: 'no-store' });
      if (resp.status === 403) {
        setError('Solo los administradores del sistema pueden ver esta pantalla.');
        setRows([]);
        return;
      }
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const { data } = (await resp.json()) as { data: AdminRow[] };
      setRows(data ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [apiBaseUrl]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const togglePerm = async (row: AdminRow, flag: PermFlag) => {
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/admins/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [flag]: !row[flag] }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      await fetchRows();
    } catch (e) {
      window.alert('No se pudo actualizar: ' + (e as Error).message);
    }
  };

  const eliminar = async (row: AdminRow) => {
    if (!window.confirm(`¿Quitar a ${row.user.name ?? row.user.email} como admin del módulo Pólizas?\n\n` +
      'Sus pólizas existentes y su histórico se preservan; solo pierde los flags de permiso.')) return;
    const resp = await fetch(`${apiBaseUrl}/api/polizas/admins/${row.id}`, { method: 'DELETE' });
    if (resp.ok) fetchRows();
    else window.alert('No se pudo eliminar.');
  };

  return (
    <DashboardLayout
      title="Admins del módulo Pólizas"
      subtitle="Asignación de permisos granulares por usuario"
      headerContent={
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/polizas" className="secondary-action secondary-action--ghost">← Pólizas</Link>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            style={{
              background: '#1d74f5', color: '#fff', padding: '0.5rem 1rem',
              borderRadius: 8, border: 0, cursor: 'pointer', fontSize: '0.85rem',
            }}
          >
            + Agregar admin
          </button>
        </div>
      }
    >
      {error && (
        <div style={{ padding: '1rem', background: '#fee', color: '#900', borderRadius: 12, margin: '1rem 0' }}>
          {error}
        </div>
      )}

      <div className="dashboard-card">
        <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
          Cada admin tiene un set de flags. <b>Auditor</b> = todos los flags en false (puede ver, no editar).
          Los users con rol <code>admin</code> del sistema pasan todos los flags automáticamente, no necesitan figurar acá.
        </div>

        {rows === null && <div style={{ padding: '0.5rem', color: '#888' }}>Cargando…</div>}
        {rows !== null && rows.length === 0 && !error && (
          <div style={{ padding: '0.5rem', color: '#888' }}>
            No hay admins asignados todavía. Agregá uno con "+ Agregar admin".
          </div>
        )}

        {rows !== null && rows.length > 0 && (
          <div className="table-wrapper">
            <table className="bdd-activos-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Usuario</th>
                  {FLAGS.map((f) => (
                    <th key={f.key} title={f.descripcion} style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', minWidth: 32 }}>
                      {f.label}
                    </th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.user.name ?? '—'}</div>
                      <small style={{ color: '#888' }}>{row.user.email ?? '—'}</small>
                      {row.user.role === 'admin' && (
                        <span style={{
                          marginLeft: '0.4rem', background: '#0a8c3a', color: '#fff',
                          fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: 4,
                        }}>
                          super-admin
                        </span>
                      )}
                    </td>
                    {FLAGS.map((f) => (
                      <td key={f.key} style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={row[f.key]}
                          onChange={() => togglePerm(row, f.key)}
                          aria-label={`${row.user.name ?? row.user.email} - ${f.label}`}
                          title={f.descripcion}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        onClick={() => eliminar(row)}
                        style={{
                          background: 'transparent', color: '#c4392a',
                          border: '1px solid #c4392a', padding: '0.2rem 0.5rem',
                          borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer',
                        }}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <AgregarAdminModal
          apiBaseUrl={apiBaseUrl}
          existingUserIds={(rows ?? []).map((r) => r.user_id)}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); fetchRows(); }}
        />
      )}
    </DashboardLayout>
  );
};

// ─── Modal "Agregar admin" ───────────────────────────────────────────────────

type ModalProps = {
  apiBaseUrl: string;
  existingUserIds: number[];
  onClose: () => void;
  onAdded: () => void;
};

const AgregarAdminModal: React.FC<ModalProps> = ({ apiBaseUrl, existingUserIds, onClose, onAdded }) => {
  const [users, setUsers] = useState<UsuarioOpt[] | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [perms, setPerms] = useState<Record<PermFlag, boolean>>(
    Object.fromEntries(FLAGS.map((f) => [f.key, false])) as Record<PermFlag, boolean>
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/admins/usuarios`, { cache: 'no-store' });
      if (!resp.ok || cancelled) return;
      const { data } = (await resp.json()) as { data: UsuarioOpt[] };
      setUsers((data ?? []).filter((u) => !existingUserIds.includes(u.id)));
    })();
    return () => { cancelled = true; };
  }, [apiBaseUrl, existingUserIds]);

  const guardar = async () => {
    if (!userId) { setError('Elegí un usuario.'); return; }
    setSaving(true); setError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: Number(userId), ...perms }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      onAdded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const aplicarPreset = (preset: 'admin' | 'operador' | 'auditor') => {
    const allOn = Object.fromEntries(FLAGS.map((f) => [f.key, true])) as Record<PermFlag, boolean>;
    const allOff = Object.fromEntries(FLAGS.map((f) => [f.key, false])) as Record<PermFlag, boolean>;
    if (preset === 'admin') setPerms(allOn);
    else if (preset === 'auditor') setPerms(allOff);
    else if (preset === 'operador') {
      setPerms({
        ...allOff,
        puede_cargar_pdf: true,
        puede_solicitar_alta: true,
        puede_solicitar_baja: true,
      });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div className="dashboard-card" style={{ width: 'min(640px, 92vw)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Agregar admin del módulo Pólizas</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ background: 'transparent', border: 0, fontSize: '1.4rem', cursor: 'pointer' }}
          >×</button>
        </div>

        <label className="input-control" style={{ display: 'block', marginTop: '0.75rem' }}>
          <span>Usuario</span>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} disabled={!users}>
            <option value="">— Seleccionar —</option>
            {(users ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? '—'} ({u.email ?? '—'}) {u.role === 'admin' ? ' [super-admin]' : ''}
              </option>
            ))}
          </select>
        </label>

        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
          <span style={{ color: '#666' }}>Preset rápido:</span>
          <button type="button" onClick={() => aplicarPreset('admin')} className="secondary-action secondary-action--ghost">
            Admin (todos)
          </button>
          <button type="button" onClick={() => aplicarPreset('operador')} className="secondary-action secondary-action--ghost">
            Operador (cargar + solicitar)
          </button>
          <button type="button" onClick={() => aplicarPreset('auditor')} className="secondary-action secondary-action--ghost">
            Auditor (solo lectura)
          </button>
        </div>

        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {FLAGS.map((f) => (
            <label key={f.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={perms[f.key]}
                onChange={(e) => setPerms((p) => ({ ...p, [f.key]: e.target.checked }))}
              />
              <div>
                <b>{f.label}</b>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>{f.descripcion}</div>
              </div>
            </label>
          ))}
        </div>

        {error && (
          <div style={{ background: '#fee', color: '#900', padding: '0.5rem', borderRadius: 6, marginTop: '0.5rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button type="button" onClick={onClose} className="secondary-action secondary-action--ghost">Cancelar</button>
          <button
            type="button"
            onClick={guardar}
            disabled={saving || !userId}
            style={{
              background: saving || !userId ? '#aaa' : '#0a8c3a', color: '#fff',
              padding: '0.5rem 1rem', borderRadius: 8, border: 0, cursor: 'pointer',
            }}
          >
            {saving ? 'Guardando…' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
};
