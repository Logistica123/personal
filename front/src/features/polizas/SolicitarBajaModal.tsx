import React, { useCallback, useState } from 'react';

/**
 * ADDENDUM 15 Bloque 1.B — Modal "Solicitar baja" reutilizable.
 *
 * POST a la bandeja de pendientes. No envía correos: crea una solicitud que
 * un administrativo va a revisar y procesar después desde
 * `/polizas/bandeja-bajas-pendientes`.
 *
 * Compartido entre:
 *   - PersonaPolizasPage (`/personal/:id/polizas`)
 *   - PolizasDelProveedorSection (`/personal/:id/editar` → tab Pólizas)
 */

export type PolizaActivaModal = {
  asegurado_id: number;
  identificador: string;
  poliza_id: number;
  poliza_nombre: string;
  aseguradora_nombre: string;
};

type Props = {
  apiBaseUrl: string;
  personaId: number;
  nombreCompleto: string;
  polizasActivas: PolizaActivaModal[];
  onClose: () => void;
  onCreada: () => void;
};

export const SolicitarBajaModal: React.FC<Props> = ({
  apiBaseUrl, personaId, nombreCompleto, polizasActivas, onClose, onCreada,
}) => {
  const [motivo, setMotivo] = useState('');
  const [comentarios, setComentarios] = useState('');
  // Por default todas las pólizas activas vienen sugeridas (el admin afina al procesar).
  const [polizasSugeridas, setPolizasSugeridas] = useState<Set<number>>(
    new Set(polizasActivas.map((p) => p.poliza_id))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const togglePoliza = useCallback((id: number) => {
    setPolizasSugeridas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const submit = useCallback(async () => {
    if (motivo.trim().length < 3) {
      setError('El motivo es obligatorio (mínimo 3 caracteres).');
      return;
    }
    setLoading(true); setError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/bandeja-bajas-pendientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona_id: personaId,
          motivo_baja: motivo,
          polizas_sugeridas: Array.from(polizasSugeridas),
          comentarios_adicionales: comentarios || undefined,
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      setOk(true);
      setTimeout(onCreada, 1500);
    } catch (e) {
      setError(`Error: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, personaId, motivo, comentarios, polizasSugeridas, onCreada]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(15, 23, 42, 0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: 8, maxWidth: '36rem', width: '100%',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
      }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Solicitar baja — {nombreCompleto}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.2rem' }}>✕</button>
        </div>

        <div style={{ padding: '1rem 1.25rem', fontSize: '0.875rem', color: '#475569' }}>
          {ok ? (
            <div style={{ padding: '1rem', background: '#f0fdf4', color: '#166534', borderRadius: 6, border: '1px solid #bbf7d0' }}>
              ✓ Solicitud creada. Un administrativo la va a revisar desde la bandeja de Pólizas.
            </div>
          ) : (
            <>
              <p style={{ marginTop: 0, padding: '0.5rem 0.75rem', background: '#fffbeb', borderRadius: 6, border: '1px solid #fcd34d', color: '#78350f' }}>
                ⚠ Esto <strong>NO envía correos</strong> a las aseguradoras todavía. Crea una solicitud
                en la <strong>bandeja de bajas pendientes</strong> para que un administrativo
                la revise y procese.
              </p>

              {error && <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', color: '#991b1b', borderRadius: 6, marginBottom: '0.75rem', whiteSpace: 'pre-wrap' }}>{error}</div>}

              <label style={{ display: 'block', marginBottom: '0.75rem' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Motivo (obligatorio)</span>
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
                  placeholder='Ej: "Renuncia voluntaria, comunicado por Whatsapp el 09/05"'
                  style={{ width: '100%', borderRadius: 6, borderColor: '#cbd5e1' }} />
              </label>

              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                  Pólizas sugeridas a dar de baja (el admin confirma al procesar):
                </div>
                {polizasActivas.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>
                    Sin pólizas activas — la solicitud se crea igual pero queda sin acción para el admin.
                  </div>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {polizasActivas.map((p) => (
                      <li key={p.poliza_id} style={{ padding: '0.25rem 0' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input type="checkbox" checked={polizasSugeridas.has(p.poliza_id)}
                            onChange={() => togglePoliza(p.poliza_id)} />
                          <span>
                            <strong>{p.aseguradora_nombre}</strong> — {p.poliza_nombre}
                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}> ({p.identificador})</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                  Comentarios adicionales (opcional)
                </span>
                <textarea value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows={2}
                  style={{ width: '100%', borderRadius: 6, borderColor: '#cbd5e1' }} />
              </label>
            </>
          )}
        </div>

        {!ok && (
          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button onClick={onClose} className="secondary-action secondary-action--ghost">Cancelar</button>
            <button onClick={submit} disabled={loading || motivo.length < 3}
              className="secondary-action"
              style={{ background: loading ? '#94a3b8' : '#c4392a', color: '#fff' }}>
              {loading ? 'Creando…' : 'Crear solicitud de baja ▶'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
