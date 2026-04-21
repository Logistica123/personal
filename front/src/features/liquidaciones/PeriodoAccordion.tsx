import React, { useMemo, useState, useEffect } from 'react';

/**
 * BUGFIX 27.3 — Accordion por período para la vista Gestionar liquidaciones del personal.
 *
 * Agrupa las liquidaciones de distribuidor por {cliente, mes, quincena}. Cada grupo
 * se colapsa/expande independientemente y muestra:
 *   Colapsado: cliente, período, badge estado, subtotal, total, cantidad de ops.
 *   Expandido: tabla con cada extracto/liquidación del período + acciones por fila
 *              (Marcar Preparado, Anular, Borrar, Ver extracto, Editar).
 *
 * Se apoya en los datos y handlers que ya tiene LiquidacionesPage.tsx — no hace fetch propio.
 */

type LiqRow = {
  id: number;
  liquidacion_cliente_id: number;
  distribuidor_id: number;
  periodo_desde: string;
  periodo_hasta: string;
  cantidad_operaciones: number;
  subtotal: string | number;
  gastos_administrativos: string | number;
  total_a_pagar: string | number;
  estado: string;
  documento_id?: number | null;
  documento_es_pdf?: boolean;
  liquidacion_cliente?: {
    id: number;
    cliente?: { id: number; nombre_corto: string; razon_social: string };
  };
};

/**
 * SPEC INTEGRAL Fase B — Elementos mixtos opcionales en el expandido.
 * Si se pasa `adjuntosPorGrupo`, el accordion muestra una sección "Otros del período"
 * con legacy docs, ajustes manuales y descuentos de combustible del mismo {cliente, mes, quincena}.
 * Si no se pasa, comportamiento idéntico a BUGFIX 27.3.
 */
export type AdjuntoPeriodo = {
  tipo: 'legacy' | 'ajuste' | 'combustible' | 'otro';
  label: string;
  importe?: number | null;
  fecha?: string | null;
  meta?: string | null;
  onClick?: () => void;
};

type Props = {
  rows: LiqRow[];
  materializingIds: Set<number>;
  formatCurrency: (n: number) => string;
  onVerExtracto: (liqClienteId: number) => void;
  onPreparar: (liqDistId: number) => void | Promise<void>;
  onAnular: (liqDistId: number) => void | Promise<void>;
  onBorrar: (liqDistId: number) => void | Promise<void>;
  onMaterializarPdf: (liqDistId: number) => void | Promise<unknown>;
  onEditar: (row: LiqRow) => void;
  /** Opcional: mapa groupKey → lista de elementos mixtos del mismo período */
  adjuntosPorGrupo?: Map<string, AdjuntoPeriodo[]>;
};

type Grupo = {
  key: string;
  clienteLabel: string;
  periodoLabel: string;
  periodoOrden: string;          // YYYY-MM-DD-q para ordenar desc
  rows: LiqRow[];
  subtotal: number;
  gastos: number;
  total: number;
  ops: number;
  estadoDominante: string;
};

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const parseDate = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const onlyDate = String(s).slice(0, 10);
  const d = new Date(onlyDate + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
};

const buildPeriodoLabel = (desde: string, hasta: string): { label: string; orden: string; monthKey: string; quincena: 'Q1' | 'Q2' | 'MC' } => {
  const d = parseDate(desde);
  const h = parseDate(hasta);
  if (!d || !h) return { label: `${desde} → ${hasta}`, orden: `${desde}-MC`, monthKey: String(desde).slice(0, 7), quincena: 'MC' };
  const mes = MESES[d.getMonth()];
  const anio = d.getFullYear();
  const monthKey = `${anio}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  let quincena: 'Q1' | 'Q2' | 'MC' = 'MC';
  let label = `${mes} ${anio}`;
  if (d.getDate() === 1 && h.getDate() >= 28 && d.getMonth() === h.getMonth()) {
    label = `${mes} ${anio}`;
    quincena = 'MC';
  } else if (d.getDate() === 1 && h.getDate() <= 15) {
    label = `1ra Quincena de ${mes} ${anio}`;
    quincena = 'Q1';
  } else if (d.getDate() >= 16) {
    label = `2da Quincena de ${mes} ${anio}`;
    quincena = 'Q2';
  }
  const orden = `${anio}-${String(d.getMonth() + 1).padStart(2, '0')}-${quincena}`;
  return { label, orden, monthKey, quincena };
};

const badgeStyle = (estado: string): React.CSSProperties => {
  const colors: Record<string, [string, string]> = {
    generada:  ['#dbeafe', '#1e40af'],
    preparada: ['#fef3c7', '#92400e'],
    aprobada:  ['#dcfce7', '#166534'],
    pagada:    ['#bbf7d0', '#14532d'],
    anulada:   ['#e5e7eb', '#6b7280'],
  };
  const [bg, fg] = colors[estado] || ['#e5e7eb', '#374151'];
  return { background: bg, color: fg, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const };
};

export function PeriodoAccordion({
  rows,
  materializingIds,
  formatCurrency,
  onVerExtracto,
  onPreparar,
  onAnular,
  onBorrar,
  onMaterializarPdf,
  onEditar,
  adjuntosPorGrupo,
}: Props) {
  const grupos: Grupo[] = useMemo(() => {
    const map = new Map<string, Grupo>();
    for (const r of rows) {
      const cliNombre = r.liquidacion_cliente?.cliente?.nombre_corto
        || r.liquidacion_cliente?.cliente?.razon_social
        || '—';
      const { label: periodoLabel, orden, monthKey, quincena } = buildPeriodoLabel(r.periodo_desde, r.periodo_hasta);
      const key = `${cliNombre}::${monthKey}::${quincena}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          clienteLabel: cliNombre,
          periodoLabel,
          periodoOrden: orden,
          rows: [],
          subtotal: 0,
          gastos: 0,
          total: 0,
          ops: 0,
          estadoDominante: r.estado,
        };
        map.set(key, g);
      }
      g.rows.push(r);
      g.subtotal += Number(r.subtotal ?? 0);
      g.gastos += Number(r.gastos_administrativos ?? 0);
      g.total += Number(r.total_a_pagar ?? 0);
      g.ops += Number(r.cantidad_operaciones ?? 0);
    }
    // Estado dominante = el más común entre las rows del grupo
    const arr = Array.from(map.values());
    arr.forEach((g) => {
      const freq: Record<string, number> = {};
      for (const r of g.rows) freq[r.estado] = (freq[r.estado] ?? 0) + 1;
      g.estadoDominante = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? g.rows[0]?.estado ?? '—';
    });
    return arr.sort((a, b) => b.periodoOrden.localeCompare(a.periodoOrden));
  }, [rows]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  // Expandir automáticamente si hay un solo grupo
  useEffect(() => {
    if (grupos.length === 1) setExpanded(new Set([grupos[0].key]));
  }, [grupos.length, grupos]);

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (grupos.length === 0) {
    return (
      <section className="dashboard-card" style={{ marginTop: '1rem' }}>
        <div className="card-body" style={{ color: '#6b7280', textAlign: 'center', padding: 16 }}>
          Sin liquidaciones generadas para este personal todavía.
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-card" style={{ marginTop: '1rem' }}>
      <header className="card-header">
        <h3 style={{ margin: 0 }}>Liquidaciones por período</h3>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          {grupos.length} período(s) · {rows.length} liquidacion(es) de distribuidor
        </div>
      </header>

      <div className="card-body" style={{ padding: 0 }}>
        {grupos.map((g) => {
          const isOpen = expanded.has(g.key);
          return (
            <div key={g.key} style={{ borderTop: '1px solid #e5e7eb' }}>
              {/* Header plegable */}
              <button
                type="button"
                onClick={() => toggle(g.key)}
                style={{
                  width: '100%', display: 'grid',
                  gridTemplateColumns: '20px minmax(120px, 1fr) minmax(180px, 1.5fr) 100px repeat(3, minmax(120px, 1fr))',
                  gap: 10, alignItems: 'center',
                  padding: '10px 14px', background: isOpen ? '#f9fafb' : '#fff',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 12, color: '#6b7280' }}>{isOpen ? '▼' : '▶'}</span>
                <span style={{ fontWeight: 600 }}>{g.clienteLabel}</span>
                <span style={{ color: '#374151' }}>{g.periodoLabel}</span>
                <span><span style={badgeStyle(g.estadoDominante)}>{g.estadoDominante}</span></span>
                <span style={{ textAlign: 'right', fontSize: 12, color: '#6b7280' }}>
                  {g.ops} ops · {g.rows.length} liq
                </span>
                <span style={{ textAlign: 'right' }}>{formatCurrency(g.subtotal)}</span>
                <span style={{ textAlign: 'right', fontWeight: 700, color: '#1F3864' }}>{formatCurrency(g.total)}</span>
              </button>

              {/* Body expandido */}
              {isOpen && (
                <div style={{ background: '#fafafa', padding: '10px 14px 14px', borderTop: '1px solid #f3f4f6' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th>LiqDist ID</th>
                          <th>Ops</th>
                          <th style={{ textAlign: 'right' }}>Subtotal</th>
                          <th style={{ textAlign: 'right' }}>Gastos</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th>Estado</th>
                          <th>Doc PDF</th>
                          <th style={{ width: 320 }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((r) => {
                          const isMat = materializingIds.has(r.id);
                          const hasPdf = Boolean(r.documento_id && r.documento_es_pdf);
                          return (
                            <tr key={`accordion-row-${r.id}`}>
                              <td><code>#{r.id}</code></td>
                              <td>{r.cantidad_operaciones}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(Number(r.subtotal))}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(Number(r.gastos_administrativos))}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(Number(r.total_a_pagar))}</td>
                              <td><span style={badgeStyle(r.estado)}>{r.estado}</span></td>
                              <td>{hasPdf ? '✓ listo' : (r.documento_id ? 'pendiente' : '—')}</td>
                              <td>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  <button type="button" className="btn-sm"
                                    onClick={() => onVerExtracto(r.liquidacion_cliente_id)}
                                    style={{ fontSize: 11 }}
                                    title="Ir al extracto origen"
                                  >Ver extracto</button>
                                  {!hasPdf && (
                                    <button type="button" className="btn-sm"
                                      onClick={() => void onMaterializarPdf(r.id)}
                                      disabled={isMat}
                                      style={{ fontSize: 11 }}
                                      title="Generar PDF del distribuidor"
                                    >{isMat ? '…' : (r.documento_id ? 'Convertir PDF' : 'Generar PDF')}</button>
                                  )}
                                  {r.estado === 'generada' && (
                                    <button type="button" className="btn-sm"
                                      onClick={() => void onPreparar(r.id)}
                                      style={{ fontSize: 11, background: '#166534', color: '#fff' }}
                                      title="Promueve a liquidación oficial (BUGFIX 27.1)"
                                    >Preparar</button>
                                  )}
                                  {r.estado !== 'pagada' && (
                                    <button type="button" className="btn-sm"
                                      onClick={() => onEditar(r)}
                                      style={{ fontSize: 11 }}
                                    >Editar</button>
                                  )}
                                  {!['anulada', 'pagada'].includes(r.estado) && (
                                    <button type="button" className="btn-sm"
                                      onClick={() => void onAnular(r.id)}
                                      style={{ fontSize: 11, color: '#92400e' }}
                                    >Anular</button>
                                  )}
                                  {!['aprobada', 'pagada'].includes(r.estado) && (
                                    <button type="button" className="btn-sm"
                                      onClick={() => void onBorrar(r.id)}
                                      style={{ fontSize: 11, color: '#991b1b' }}
                                    >Borrar</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* SPEC Fase B: Otros elementos del mismo período (legacy, ajustes, combustible) */}
                  {(() => {
                    const adjuntos = adjuntosPorGrupo?.get(g.key) ?? [];
                    if (adjuntos.length === 0) return null;
                    const iconoTipo: Record<AdjuntoPeriodo['tipo'], string> = {
                      legacy: '📄', ajuste: '✏️', combustible: '⛽', otro: '•',
                    };
                    const colorTipo: Record<AdjuntoPeriodo['tipo'], string> = {
                      legacy: '#6366f1', ajuste: '#f59e0b', combustible: '#ef4444', otro: '#6b7280',
                    };
                    return (
                      <div style={{ marginTop: 10, padding: '10px 14px', background: '#fff', border: '1px dashed #d1d5db', borderRadius: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                          Otros elementos del período ({adjuntos.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {adjuntos.map((a, i) => (
                            <div key={`adj-${g.key}-${i}`}
                              onClick={a.onClick}
                              style={{
                                display: 'grid', gridTemplateColumns: '24px minmax(140px, 1fr) minmax(160px, 2fr) 120px 120px',
                                gap: 8, alignItems: 'center', fontSize: 12,
                                padding: '4px 6px', borderRadius: 4,
                                cursor: a.onClick ? 'pointer' : 'default',
                                background: i % 2 === 0 ? '#f9fafb' : '#fff',
                              }}
                            >
                              <span style={{ color: colorTipo[a.tipo] }}>{iconoTipo[a.tipo]}</span>
                              <span style={{ color: '#6b7280', textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5 }}>{a.tipo}</span>
                              <span style={{ color: '#111827' }}>{a.label}</span>
                              <span style={{ color: '#6b7280', fontSize: 11, textAlign: 'right' }}>{a.fecha ?? ''}</span>
                              <span style={{ textAlign: 'right', fontWeight: 600 }}>
                                {a.importe != null ? formatCurrency(a.importe) : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Resumen al pie del período */}
                  <div style={{
                    marginTop: 10, padding: '10px 14px',
                    background: '#F2F2F2', borderTop: '2px solid #1F3864',
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13,
                  }}>
                    <div style={{ color: '#4b5563' }}>Subtotal operaciones</div>
                    <div style={{ textAlign: 'right' }}>{formatCurrency(g.subtotal)}</div>
                    <div style={{ color: '#4b5563' }}>Gastos administrativos</div>
                    <div style={{ textAlign: 'right' }}>{formatCurrency(g.gastos)}</div>
                    <div style={{ color: '#1F3864', fontWeight: 700, fontSize: 14, paddingTop: 4, borderTop: '1px dashed #bfbfbf' }}>Total a facturar</div>
                    <div style={{ textAlign: 'right', fontWeight: 700, color: '#1F3864', fontSize: 14, paddingTop: 4, borderTop: '1px dashed #bfbfbf' }}>{formatCurrency(g.total)}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
