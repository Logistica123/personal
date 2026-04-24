import React, { useCallback, useEffect, useState } from 'react';

/**
 * SPEC v3 · BUG B — Panel de reclamos OCASA (subpagos detectados).
 *
 * Muestra los registros de liq_reclamos_ocasa para una liquidación cliente:
 *   - Cabecera con totales (cantidad, subpago, sobrepago, neto reclamable)
 *   - Agrupación por sucursal con totales
 *   - Tabla de reclamos individuales con op/patente/ruta/diferencia
 *   - Botones por fila: marcar reclamado / ajustado / cerrado
 *
 * Si no hay reclamos detectados, muestra hint para correr el botón
 * "Reclamos OCASA" del header.
 */

type Reclamo = {
  id: number;
  op_id: number;
  patente: string | null;
  sucursal: string | null;
  ruta: string | null;
  distancia_km: number | null;
  capacidad_vehiculo_kg: number | null;
  concepto_contrato: string;
  importe_tms: number;
  importe_esperado: number;
  diferencia: number;
  estado: 'pendiente_reclamo' | 'reclamado' | 'ajustado' | 'cerrado';
  motivo_detectado: string | null;
  distribuidor: string | null;
  creado_at: string;
  reclamado_at: string | null;
  resuelto_at: string | null;
};

type PorSucursal = {
  sucursal: string | null;
  ops: number;
  diferencia_total: number;
};

type Totales = {
  cantidad: number;
  total_subpago: number;
  total_sobrepago: number;
  neto_reclamable: number;
};

type ApiShape = {
  get: (path: string) => Promise<any>;
  patch: (path: string, body: unknown) => Promise<any>;
};

type Props = {
  liqId: number;
  api: ApiShape;
  refreshKey?: number; // bump para forzar recarga (ej después de detectar)
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n);

const colorEstado = (e: Reclamo['estado']) => {
  switch (e) {
    case 'pendiente_reclamo': return { bg: '#fef3c7', fg: '#92400e', label: 'Pendiente' };
    case 'reclamado':          return { bg: '#dbeafe', fg: '#1e40af', label: 'Reclamado' };
    case 'ajustado':           return { bg: '#d1fae5', fg: '#065f46', label: 'Ajustado' };
    case 'cerrado':            return { bg: '#e5e7eb', fg: '#374151', label: 'Cerrado' };
    default: return { bg: '#f3f4f6', fg: '#6b7280', label: e };
  }
};

export function ReclamosOcasaPanel({ liqId, api, refreshKey = 0 }: Props) {
  const [loading, setLoading] = useState(false);
  const [reclamos, setReclamos] = useState<Reclamo[]>([]);
  const [totales, setTotales] = useState<Totales | null>(null);
  const [porSucursal, setPorSucursal] = useState<PorSucursal[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get(`/liquidaciones/${liqId}/reclamos-ocasa`);
      const d = r?.data ?? {};
      setReclamos(d.reclamos ?? []);
      setTotales(d.totales ?? null);
      setPorSucursal(d.por_sucursal ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando reclamos');
    } finally {
      setLoading(false);
    }
  }, [api, liqId]);

  useEffect(() => { void cargar(); }, [cargar, refreshKey]);

  const cambiarEstado = useCallback(async (id: number, estado: Reclamo['estado']) => {
    try {
      await api.patch(`/reclamos-ocasa/${id}/estado`, { estado });
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error actualizando estado');
    }
  }, [api, cargar]);

  if (loading && reclamos.length === 0) {
    return <div className="dashboard-card"><div className="card-body">Cargando reclamos…</div></div>;
  }

  if (!loading && reclamos.length === 0) {
    return (
      <div className="dashboard-card">
        <header className="card-header"><h3 style={{ margin: 0 }}>Reclamos OCASA (subpagos detectados)</h3></header>
        <div className="card-body" style={{ fontSize: 13, color: '#6b7280' }}>
          Sin reclamos detectados en esta liquidación. Click "Reclamos OCASA" arriba para correr la detección.
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-card">
      <header className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Reclamos OCASA (subpagos detectados)</h3>
        <button type="button" className="btn-sm" onClick={() => void cargar()} disabled={loading}>
          Refrescar
        </button>
      </header>

      <div className="card-body">
        {error && (
          <div style={{ padding: 10, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, color: '#991b1b', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* Totales */}
        {totales && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#fef3c7', padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#92400e' }}>Cantidad reclamos</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#92400e' }}>{totales.cantidad}</div>
            </div>
            <div style={{ background: '#fee2e2', padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#991b1b' }}>Total subpago</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#991b1b' }}>{fmtMoney(totales.total_subpago)}</div>
            </div>
            <div style={{ background: '#e0e7ff', padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#3730a3' }}>Total sobrepago</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#3730a3' }}>{fmtMoney(totales.total_sobrepago)}</div>
            </div>
            <div style={{ background: '#d1fae5', padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#065f46' }}>Neto reclamable a OCASA</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#065f46' }}>{fmtMoney(totales.neto_reclamable)}</div>
            </div>
          </div>
        )}

        {/* Por sucursal */}
        {porSucursal.length > 0 && (
          <details style={{ marginBottom: 16 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Agrupado por sucursal ({porSucursal.length})
            </summary>
            <table className="table" style={{ width: '100%', marginTop: 8, fontSize: 12 }}>
              <thead>
                <tr><th>Sucursal</th><th style={{ textAlign: 'right' }}>Ops</th><th style={{ textAlign: 'right' }}>Diferencia total</th></tr>
              </thead>
              <tbody>
                {porSucursal.map((s) => (
                  <tr key={s.sucursal ?? '—'}>
                    <td>{s.sucursal ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>{s.ops}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: s.diferencia_total > 0 ? '#991b1b' : '#3730a3' }}>{fmtMoney(s.diferencia_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}

        {/* Tabla de reclamos */}
        <table className="table" style={{ width: '100%', fontSize: 12 }}>
          <thead>
            <tr>
              <th>Op</th>
              <th>Sucursal</th>
              <th>Patente</th>
              <th>Distribuidor</th>
              <th>Ruta</th>
              <th>Concepto</th>
              <th style={{ textAlign: 'right' }}>TMS</th>
              <th style={{ textAlign: 'right' }}>Contrato</th>
              <th style={{ textAlign: 'right' }}>Δ</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {reclamos.map((r) => {
              const st = colorEstado(r.estado);
              return (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace' }}>#{r.op_id}</td>
                  <td>{r.sucursal ?? '—'}</td>
                  <td>{r.patente ?? '—'}</td>
                  <td>{r.distribuidor?.trim() ?? '—'}</td>
                  <td>{r.ruta ?? '—'}</td>
                  <td style={{ fontSize: 11 }}>{r.concepto_contrato}</td>
                  <td style={{ textAlign: 'right' }}>{fmtMoney(Number(r.importe_tms))}</td>
                  <td style={{ textAlign: 'right' }}>{fmtMoney(Number(r.importe_esperado))}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: Number(r.diferencia) > 0 ? '#991b1b' : '#3730a3' }}>{fmtMoney(Number(r.diferencia))}</td>
                  <td>
                    <span style={{ background: st.bg, color: st.fg, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                      {st.label}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    {r.estado === 'pendiente_reclamo' && (
                      <button type="button" className="btn-sm" style={{ fontSize: 11 }} onClick={() => void cambiarEstado(r.id, 'reclamado')} title="Marcar como reclamado a OCASA">Reclamar</button>
                    )}
                    {r.estado === 'reclamado' && (
                      <>
                        <button type="button" className="btn-sm" style={{ fontSize: 11 }} onClick={() => void cambiarEstado(r.id, 'ajustado')} title="OCASA ajustó el pago">Ajustado</button>
                        <button type="button" className="btn-sm" style={{ fontSize: 11 }} onClick={() => void cambiarEstado(r.id, 'cerrado')} title="Cerrar sin ajuste (ej: aceptado)">Cerrar</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
