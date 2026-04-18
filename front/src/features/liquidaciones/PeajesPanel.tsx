import React, { useCallback, useEffect, useState } from 'react';

type ApiLike = {
  get: (path: string) => Promise<any>;
  post: (path: string, body: unknown) => Promise<any>;
};

type ResumenDistrib = {
  distribuidor_id: number;
  distribuidor: string | null;
  patente?: string | null;
  sucursales: string[];
  ops_con_peajes: number;
  ops_totales: number;
  total_peajes_pdf: number;
  total_peajes_autorizado: number;
  total_tarifa: number;
  pendientes: number;
  autorizadas: number;
  rechazadas: number;
  estado: 'pendiente' | 'autorizado' | 'rechazado' | 'mixto';
};

type OpPeaje = {
  id: number;
  fecha: string | null;
  id_operacion_cliente: string | null;
  ruta: string | null;
  importe_total: number;
  importe_gravado: number;
  importe_no_gravado: number;
  peaje_autorizado: boolean;
  peaje_monto_ajustado: number | null;
  peaje_motivo: string | null;
};

type Resolucion = {
  operacion_id: number;
  accion: 'autorizar' | 'rechazar' | 'ajustar';
  monto_ajustado?: number;
  motivo?: string;
};

const fmtMoney = (v: number | null | undefined) =>
  `$${Number(v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const badgeStyle = (estado: string): React.CSSProperties => {
  const colors: Record<string, [string, string]> = {
    pendiente:  ['#fef3c7', '#92400e'],
    autorizado: ['#dcfce7', '#166534'],
    rechazado:  ['#fee2e2', '#991b1b'],
    mixto:      ['#e0e7ff', '#3730a3'],
  };
  const [bg, fg] = colors[estado] || ['#e5e7eb', '#374151'];
  return {
    background: bg,
    color: fg,
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
  };
};

export function PeajesPanel({
  api,
  liquidacionId,
  onChanged,
}: {
  api: ApiLike;
  liquidacionId: number;
  onChanged?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenDistrib[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [ops, setOps] = useState<Record<number, OpPeaje[]>>({});
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [bulkMotivo, setBulkMotivo] = useState('');
  const [ajusteModal, setAjusteModal] = useState<OpPeaje | null>(null);
  const [ajusteMonto, setAjusteMonto] = useState('');
  const [ajusteMotivo, setAjusteMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const loadResumen = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get(`/liquidaciones/${liquidacionId}/peajes`);
      setResumen(r.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar peajes');
    } finally {
      setLoading(false);
    }
  }, [api, liquidacionId]);

  const loadOps = useCallback(async (distribuidorId: number) => {
    try {
      const r = await api.get(`/liquidaciones/${liquidacionId}/peajes/distribuidor/${distribuidorId}`);
      setOps(prev => ({ ...prev, [distribuidorId]: r.data ?? [] }));
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar operaciones');
    }
  }, [api, liquidacionId]);

  useEffect(() => {
    void loadResumen();
  }, [loadResumen]);

  const handleExpand = (distId: number) => {
    if (expandedId === distId) {
      setExpandedId(null);
    } else {
      setExpandedId(distId);
      if (!ops[distId]) void loadOps(distId);
    }
  };

  const submitResoluciones = useCallback(async (resoluciones: Resolucion[]) => {
    if (resoluciones.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/liquidaciones/${liquidacionId}/peajes/autorizar`, { resoluciones });
      setSelected({});
      await loadResumen();
      const distribIds: number[] = [];
      resoluciones.forEach(r => {
        const all = Object.entries(ops).find(([, list]) => list.some(o => o.id === r.operacion_id));
        if (all?.[0]) {
          const id = Number(all[0]);
          if (!distribIds.includes(id)) distribIds.push(id);
        }
      });
      for (const d of distribIds) {
        await loadOps(d);
      }
      onChanged?.();
    } catch (e: any) {
      setError(e?.message ?? 'Error al autorizar');
    } finally {
      setSaving(false);
    }
  }, [api, liquidacionId, loadResumen, loadOps, ops, onChanged]);

  const getSelectedOps = (distId: number): OpPeaje[] => {
    const list = ops[distId] ?? [];
    return list.filter(o => selected[o.id]);
  };

  const bulkAutorizar = (distId: number) => {
    const sel = getSelectedOps(distId);
    if (sel.length === 0) return;
    void submitResoluciones(sel.map(o => ({
      operacion_id: o.id, accion: 'autorizar', motivo: bulkMotivo || 'Autorizado en lote',
    })));
  };

  const bulkRechazar = (distId: number) => {
    const sel = getSelectedOps(distId);
    if (sel.length === 0) return;
    if (!bulkMotivo.trim()) {
      setError('Ingresá un motivo para rechazar');
      return;
    }
    void submitResoluciones(sel.map(o => ({
      operacion_id: o.id, accion: 'rechazar', motivo: bulkMotivo,
    })));
  };

  const autorizarTodo = (distId: number) => {
    const list = (ops[distId] ?? []).filter(o => !o.peaje_autorizado && !o.peaje_motivo);
    if (list.length === 0) return;
    void submitResoluciones(list.map(o => ({
      operacion_id: o.id, accion: 'autorizar', motivo: 'Autorizado en bloque',
    })));
  };

  const openAjuste = (op: OpPeaje) => {
    setAjusteModal(op);
    setAjusteMonto(String(op.peaje_monto_ajustado ?? op.importe_no_gravado));
    setAjusteMotivo(op.peaje_motivo ?? '');
  };

  const guardarAjuste = () => {
    if (!ajusteModal) return;
    const monto = parseFloat(ajusteMonto.replace(',', '.'));
    if (!(monto >= 0)) {
      setError('Monto inválido');
      return;
    }
    if (!ajusteMotivo.trim()) {
      setError('Motivo obligatorio para ajustar');
      return;
    }
    void submitResoluciones([{
      operacion_id: ajusteModal.id,
      accion: 'ajustar',
      monto_ajustado: monto,
      motivo: ajusteMotivo,
    }]).then(() => {
      setAjusteModal(null);
      setAjusteMonto('');
      setAjusteMotivo('');
    });
  };

  const totalPendientes = resumen.reduce((s, r) => s + r.pendientes, 0);
  const totalAutorizadas = resumen.reduce((s, r) => s + r.autorizadas, 0);
  const totalRechazadas = resumen.reduce((s, r) => s + r.rechazadas, 0);
  const totalAutorizado = resumen.reduce((s, r) => s + r.total_peajes_autorizado, 0);
  const totalBruto = resumen.reduce((s, r) => s + r.total_peajes_pdf, 0);

  return (
    <div className="dashboard-card" style={{ marginTop: 16 }}>
      <header className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Autorización de peajes (OCASA / Imp. No Gravado)</h3>
        <button type="button" className="btn-sm" onClick={() => void loadResumen()} disabled={loading}>
          ↻ Refrescar
        </button>
      </header>

      {error && <div style={{ color: '#991b1b', background: '#fee2e2', padding: 8, borderRadius: 6, margin: '8px 0' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
        <div style={{ background: '#f9fafb', padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: '#6b7280' }}>Peajes bruto (TMS)</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{fmtMoney(totalBruto)}</div>
        </div>
        <div style={{ background: '#dcfce7', padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: '#166534' }}>Autorizado</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#166534' }}>{fmtMoney(totalAutorizado)}</div>
        </div>
        <div style={{ background: '#fef3c7', padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: '#92400e' }}>Pendientes</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#92400e' }}>{totalPendientes}</div>
        </div>
        <div style={{ background: '#dbeafe', padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: '#1e40af' }}>Autorizadas</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1e40af' }}>{totalAutorizadas}</div>
        </div>
        <div style={{ background: '#fee2e2', padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: '#991b1b' }}>Rechazadas</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#991b1b' }}>{totalRechazadas}</div>
        </div>
      </div>

      {loading && <div style={{ padding: 12 }}>Cargando...</div>}
      {!loading && resumen.length === 0 && (
        <div style={{ padding: 12, color: '#6b7280' }}>
          No se detectaron operaciones con peajes para esta liquidación.
        </div>
      )}

      {resumen.length > 0 && (
        <table className="data-table" style={{ width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              <th></th>
              <th>Distribuidor</th>
              <th>Patente</th>
              <th>Sucursales</th>
              <th style={{ textAlign: 'right' }}>Ops c/ peajes</th>
              <th style={{ textAlign: 'right' }}>Bruto</th>
              <th style={{ textAlign: 'right' }}>Autorizado</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {resumen.map((r) => (
              <React.Fragment key={r.distribuidor_id}>
                <tr style={{ cursor: 'pointer' }} onClick={() => handleExpand(r.distribuidor_id)}>
                  <td style={{ width: 24 }}>{expandedId === r.distribuidor_id ? '▼' : '▶'}</td>
                  <td>{r.distribuidor ?? `#${r.distribuidor_id}`}</td>
                  <td>{r.patente ?? '—'}</td>
                  <td style={{ fontSize: 11, color: '#6b7280' }}>{r.sucursales.join(', ') || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{r.ops_con_peajes} / {r.ops_totales}</td>
                  <td style={{ textAlign: 'right' }}>{fmtMoney(r.total_peajes_pdf)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtMoney(r.total_peajes_autorizado)}</td>
                  <td><span style={badgeStyle(r.estado)}>{r.estado}</span></td>
                </tr>
                {expandedId === r.distribuidor_id && (
                  <tr>
                    <td colSpan={8} style={{ background: '#f9fafb', padding: 12 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Motivo (obligatorio para rechazar)"
                          value={bulkMotivo}
                          onChange={(e) => setBulkMotivo(e.target.value)}
                          style={{ flex: 1, minWidth: 200, fontSize: 12 }}
                        />
                        <button type="button" className="btn-sm"
                          style={{ background: '#dcfce7', color: '#166534' }}
                          disabled={saving || getSelectedOps(r.distribuidor_id).length === 0}
                          onClick={() => bulkAutorizar(r.distribuidor_id)}
                        >
                          ✓ Autorizar seleccionadas ({getSelectedOps(r.distribuidor_id).length})
                        </button>
                        <button type="button" className="btn-sm"
                          style={{ background: '#fee2e2', color: '#991b1b' }}
                          disabled={saving || getSelectedOps(r.distribuidor_id).length === 0}
                          onClick={() => bulkRechazar(r.distribuidor_id)}
                        >
                          ✗ Rechazar seleccionadas
                        </button>
                        <button type="button" className="btn-sm"
                          style={{ background: '#dbeafe', color: '#1e40af' }}
                          disabled={saving || r.pendientes === 0}
                          onClick={() => autorizarTodo(r.distribuidor_id)}
                        >
                          ✓ Autorizar todas pendientes ({r.pendientes})
                        </button>
                      </div>

                      <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ width: 30 }}>
                              <input type="checkbox"
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  const list = ops[r.distribuidor_id] ?? [];
                                  setSelected(prev => {
                                    const next = { ...prev };
                                    list.forEach(o => { next[o.id] = checked; });
                                    return next;
                                  });
                                }}
                              />
                            </th>
                            <th>Fecha</th>
                            <th>ID Op</th>
                            <th>Ruta</th>
                            <th style={{ textAlign: 'right' }}>Gravado</th>
                            <th style={{ textAlign: 'right' }}>No Grav (peaje)</th>
                            <th>Estado</th>
                            <th>Motivo</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(ops[r.distribuidor_id] ?? []).map((op) => {
                            const estado = op.peaje_autorizado ? 'autorizado' : (op.peaje_motivo ? 'rechazado' : 'pendiente');
                            return (
                              <tr key={op.id}>
                                <td>
                                  <input type="checkbox"
                                    checked={!!selected[op.id]}
                                    onChange={(e) => setSelected(prev => ({ ...prev, [op.id]: e.target.checked }))}
                                  />
                                </td>
                                <td>{op.fecha ?? '—'}</td>
                                <td style={{ fontFamily: 'monospace' }}>{op.id_operacion_cliente ?? '—'}</td>
                                <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.ruta ?? '—'}</td>
                                <td style={{ textAlign: 'right' }}>{fmtMoney(op.importe_gravado)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                  {op.peaje_monto_ajustado !== null && op.peaje_monto_ajustado !== op.importe_no_gravado ? (
                                    <>
                                      <s style={{ color: '#9ca3af' }}>{fmtMoney(op.importe_no_gravado)}</s>{' '}
                                      <span style={{ color: '#2563eb' }}>{fmtMoney(op.peaje_monto_ajustado)}</span>
                                    </>
                                  ) : fmtMoney(op.importe_no_gravado)}
                                </td>
                                <td><span style={badgeStyle(estado)}>{estado}</span></td>
                                <td style={{ fontSize: 11, color: '#6b7280', maxWidth: 150 }}>{op.peaje_motivo ?? '—'}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button type="button" title="Autorizar" className="btn-sm"
                                      style={{ background: '#dcfce7', color: '#166534', padding: '2px 6px' }}
                                      disabled={saving}
                                      onClick={() => void submitResoluciones([{ operacion_id: op.id, accion: 'autorizar', motivo: 'Autorizado' }])}
                                    >✓</button>
                                    <button type="button" title="Rechazar" className="btn-sm"
                                      style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 6px' }}
                                      disabled={saving}
                                      onClick={() => {
                                        const m = prompt('Motivo del rechazo:');
                                        if (m && m.trim()) {
                                          void submitResoluciones([{ operacion_id: op.id, accion: 'rechazar', motivo: m }]);
                                        }
                                      }}
                                    >✗</button>
                                    <button type="button" title="Ajustar monto" className="btn-sm"
                                      style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 6px' }}
                                      disabled={saving}
                                      onClick={() => openAjuste(op)}
                                    >$</button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {(ops[r.distribuidor_id]?.length ?? 0) === 0 && (
                            <tr><td colSpan={9} style={{ padding: 10, color: '#6b7280', textAlign: 'center' }}>Sin operaciones con peajes</td></tr>
                          )}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}

      {ajusteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Ajustar monto de peaje</h3>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
              Op #{ajusteModal.id} — {ajusteModal.ruta ?? ajusteModal.id_operacion_cliente}
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Monto original: {fmtMoney(ajusteModal.importe_no_gravado)}</label>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Nuevo monto</label>
              <input type="text" inputMode="decimal" className="form-input" value={ajusteMonto}
                onChange={(e) => setAjusteMonto(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Motivo (obligatorio)</label>
              <textarea className="form-input" rows={2} value={ajusteMotivo}
                onChange={(e) => setAjusteMotivo(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn-sm" onClick={() => setAjusteModal(null)}>Cancelar</button>
              <button type="button" className="btn-primary" disabled={saving} onClick={guardarAjuste}>Guardar ajuste</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
