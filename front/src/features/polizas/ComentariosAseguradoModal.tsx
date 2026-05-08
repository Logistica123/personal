import React, { useCallback, useEffect, useState } from 'react';
import type { ComentarioAsegurado } from './types';

type Props = {
  apiBaseUrl: string;
  asegurado: { id: number; identificador: string };
  onClose: () => void;
  /** Callback opcional cuando cambia el count (para refrescar el badge en la fila padre). */
  onChange?: (count: number) => void;
};

/**
 * ADDENDUM 10 Parte B — modal con histórico de comentarios por asegurado.
 *
 * Click en `[💬 N]` en el listado abre este modal con:
 *  - Form para agregar comentario nuevo (más reciente arriba al guardar).
 *  - Histórico cronológico (autor + fecha + texto).
 *  - Botón eliminar SOLO si el usuario logueado es el autor (validado server-side
 *    también — el endpoint rechaza con 403 si corresponde).
 */
export const ComentariosAseguradoModal: React.FC<Props> = ({ apiBaseUrl, asegurado, onClose, onChange }) => {
  const [items, setItems] = useState<ComentarioAsegurado[] | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const resp = await fetch(`${apiBaseUrl}/api/polizas/asegurados/${asegurado.id}/comentarios`, { cache: 'no-store' });
    if (!resp.ok) {
      setError('No se pudieron cargar los comentarios.');
      return;
    }
    const { data } = (await resp.json()) as { data: ComentarioAsegurado[] };
    setItems(data ?? []);
    onChange?.(data?.length ?? 0);
  }, [apiBaseUrl, asegurado.id, onChange]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const guardar = async () => {
    const txt = draft.trim();
    if (!txt) return;
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/asegurados/${asegurado.id}/comentarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comentario: txt }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      setDraft('');
      await fetchAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (id: number) => {
    if (!window.confirm('¿Eliminar este comentario?')) return;
    const resp = await fetch(`${apiBaseUrl}/api/polizas/asegurados/comentarios/${id}`, { method: 'DELETE' });
    if (!resp.ok) {
      const t = await resp.text();
      setError(t || 'No se pudo eliminar.');
      return;
    }
    await fetchAll();
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
      <div
        className="dashboard-card"
        style={{ width: 'min(640px, 92vw)', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Comentarios — {asegurado.identificador}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ background: 'transparent', border: 0, fontSize: '1.4rem', cursor: 'pointer' }}
          >×</button>
        </div>

        <div style={{
          background: '#f7f9fc', padding: '0.75rem', borderRadius: 8, marginTop: '0.75rem',
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>+ Agregar comentario</div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #d0d7e1', resize: 'vertical' }}
            placeholder="Escribí un comentario para el equipo…"
          />
          <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={guardar}
              disabled={!draft.trim() || saving}
              style={{
                background: !draft.trim() || saving ? '#aaa' : '#1d74f5',
                color: '#fff', padding: '0.4rem 1rem', borderRadius: 8, border: 0, cursor: 'pointer',
              }}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fee', color: '#900', padding: '0.5rem', borderRadius: 6, marginTop: '0.5rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#666' }}>
            Histórico {items ? `(${items.length})` : ''}
          </h4>
          {items === null && <div style={{ color: '#666' }}>Cargando…</div>}
          {items !== null && items.length === 0 && (
            <div style={{ color: '#888', fontStyle: 'italic' }}>Sin comentarios todavía.</div>
          )}
          {items !== null && items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {items.map((c) => (
                <div key={c.id} style={{ borderBottom: '1px solid #eef1f6', paddingBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#666' }}>
                    <span>
                      <b>{c.user?.name ?? '—'}</b>
                      {' · '}
                      {c.created_at ? new Date(c.created_at).toLocaleString('es-AR') : '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() => eliminar(c.id)}
                      title="Eliminar (sólo el autor)"
                      style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#c4392a', fontSize: '0.8rem' }}
                    >
                      Eliminar
                    </button>
                  </div>
                  <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>{c.comentario}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
