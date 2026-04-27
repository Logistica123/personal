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

type MotivoCategoria =
  | 'sin_tarifa_contrato'
  | 'tarifa_capacidad_inferior'
  | 'concepto_mal_clasificado'
  | 'motivo_mal_etiquetado'
  | 'material_mal_clasificado'
  | 'zona_mal_asignada'
  | 'multibulto_no_aplicado'
  | 'bajo_tolerancia'
  | 'otra'
  | string;

type Reclamo = {
  id: number;
  op_id: number;
  parada_num: number | null;
  patente: string | null;
  sucursal: string | null;
  ruta: string | null;
  distancia_km: number | null;
  capacidad_vehiculo_kg: number | null;
  modelo_calculo: string | null;
  concepto_contrato: string | null;
  importe_tms: number;
  importe_esperado: number;
  diferencia: number;
  estado: 'pendiente_reclamo' | 'reclamado' | 'ajustado' | 'cerrado';
  motivo_detectado: string | null;
  motivo_categoria: MotivoCategoria | null;
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

type PorCategoria = {
  categoria: MotivoCategoria;
  cantidad: number;
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

// SPEC v4.3 · Mapping de motivo_categoria a etiqueta visual.
const colorMotivo = (c: MotivoCategoria | null): { bg: string; fg: string; label: string } => {
  switch (c) {
    case 'sin_tarifa_contrato':       return { bg: '#fee2e2', fg: '#991b1b', label: 'Sin tarifa' };
    case 'tarifa_capacidad_inferior': return { bg: '#fde68a', fg: '#92400e', label: 'Cap. inferior' };
    case 'concepto_mal_clasificado':  return { bg: '#fed7aa', fg: '#9a3412', label: 'Concepto' };
    case 'motivo_mal_etiquetado':     return { bg: '#fbcfe8', fg: '#9d174d', label: 'Motivo' };
    case 'material_mal_clasificado':  return { bg: '#ddd6fe', fg: '#5b21b6', label: 'Material' };
    case 'zona_mal_asignada':         return { bg: '#bfdbfe', fg: '#1e3a8a', label: 'Zona' };
    case 'multibulto_no_aplicado':    return { bg: '#a7f3d0', fg: '#065f46', label: 'Multibulto' };
    case 'bajo_tolerancia':           return { bg: '#e5e7eb', fg: '#374151', label: 'Tolerancia' };
    case 'otra':
    default:                          return { bg: '#f3f4f6', fg: '#6b7280', label: c ?? 'Otra' };
  }
};

export function ReclamosOcasaPanel({ liqId, api, refreshKey = 0 }: Props) {
  const [loading, setLoading] = useState(false);
  const [reclamos, setReclamos] = useState<Reclamo[]>([]);
  const [totales, setTotales] = useState<Totales | null>(null);
  const [porSucursal, setPorSucursal] = useState<PorSucursal[]>([]);
  const [porCategoria, setPorCategoria] = useState<PorCategoria[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState<MotivoCategoria | 'todas'>('todas');
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
      setPorCategoria(d.por_categoria ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando reclamos');
    } finally {
      setLoading(false);
    }
  }, [api, liqId]);

  const reclamosFiltrados = filtroCategoria === 'todas'
    ? reclamos
    : reclamos.filter((r) => (r.motivo_categoria ?? 'otra') === filtroCategoria);

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
          <details style={{ marginBottom: 12 }}>
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

        {/* SPEC v4.3 · Filtro y agrupación por motivo (categoría) */}
        {porCategoria.length > 0 && (
          <div style={{ marginBottom: 12, padding: 10, background: '#f9fafb', borderRadius: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Filtrar por motivo:
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setFiltroCategoria('todas')}
                style={{
                  padding: '4px 10px', borderRadius: 4, fontSize: 11,
                  background: filtroCategoria === 'todas' ? '#1e40af' : '#e5e7eb',
                  color: filtroCategoria === 'todas' ? '#fff' : '#374151',
                  border: 'none', cursor: 'pointer', fontWeight: 600,
                }}
              >
                Todas ({reclamos.length})
              </button>
              {porCategoria.map((c) => {
                const col = colorMotivo(c.categoria);
                const activo = filtroCategoria === c.categoria;
                return (
                  <button
                    key={c.categoria}
                    type="button"
                    onClick={() => setFiltroCategoria(c.categoria)}
                    title={`${c.cantidad} reclamos · ${fmtMoney(c.diferencia_total)}`}
                    style={{
                      padding: '4px 10px', borderRadius: 4, fontSize: 11,
                      background: activo ? col.fg : col.bg,
                      color: activo ? '#fff' : col.fg,
                      border: 'none', cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    {col.label} ({c.cantidad})
                  </button>
                );
              })}
            </div>
          </div>
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
              <th>Tipo</th>
              <th>Motivo</th>
              <th style={{ textAlign: 'right' }}>OCASA</th>
              <th style={{ textAlign: 'right' }}>Esperado</th>
              <th style={{ textAlign: 'right' }}>Δ</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {reclamosFiltrados.map((r) => {
              const st = colorEstado(r.estado);
              const cm = colorMotivo(r.motivo_categoria);
              const esProductividad = r.modelo_calculo === 'PRODUCTIVIDAD';
              return (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace' }}>
                    #{r.op_id}{r.parada_num != null && <span style={{ color: '#6b7280' }}> · p{r.parada_num}</span>}
                  </td>
                  <td>{r.sucursal ?? '—'}</td>
                  <td>{r.patente ?? '—'}</td>
                  <td>{r.distribuidor?.trim() ?? '—'}</td>
                  <td>{r.ruta ?? '—'}</td>
                  <td style={{ fontSize: 11, color: esProductividad ? '#7c3aed' : '#1f2937' }}>
                    {esProductividad ? 'Prod.' : (r.concepto_contrato ?? 'Jornada')}
                  </td>
                  <td>
                    <span
                      title={r.motivo_detectado ?? undefined}
                      style={{ background: cm.bg, color: cm.fg, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}
                    >
                      {cm.label}
                    </span>
                  </td>
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
