import React, { useCallback, useEffect, useMemo, useState } from 'react';

type ApiLike = {
  get: (path: string) => Promise<any>;
};

type SucursalRow = {
  codigo: string;
  nombre: string | null;
  operaciones: number;
  ops_sin_split: number;
  importe_total: number;
  gravado: number;
  no_gravado: number;
  iva_21: number;
  total_factura: number;
  consistencia_diff: number;
  consistente: boolean;
};

type SplitResponse = {
  data: {
    cliente: string;
    cliente_id: number;
    periodo: string;
    iva_rate: number;
    sucursales: SucursalRow[];
    totales: {
      operaciones: number;
      ops_sin_split: number;
      importe_total: number;
      gravado: number;
      no_gravado: number;
      iva_21: number;
      total_factura: number;
      consistente: boolean;
    };
  };
};

const fmtMoney = (v: number | null | undefined): string => {
  const n = Number(v ?? 0);
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
};

const currentYYYYMM = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * BUGFIX 26 Feature 26.2: Split Fiscal por Sucursal (OCASA y clientes con flag split_fiscal_por_sucursal=true).
 *
 * Muestra una tabla con el desglose Gravado / No Gravado / IVA / Total Factura por sucursal
 * + export CSV. Usado para emitir la factura LA → cliente con el split correcto.
 */
export function SplitFiscalPorSucursal({
  api,
  clienteId,
  clienteNombre,
  initialPeriodo,
  onExportCsv,
}: {
  api: ApiLike;
  clienteId: number;
  clienteNombre?: string;
  initialPeriodo?: string;           // 'YYYY-MM'
  onExportCsv?: (filename: string, rows: string[][]) => void;
}) {
  const [periodo, setPeriodo] = useState(initialPeriodo || currentYYYYMM());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SplitResponse['data'] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const yyyymm = periodo.replace('-', '');
      const res = await api.get(`/facturacion-clientes/${clienteId}/periodo/${yyyymm}/split-por-sucursal`);
      setData(res.data ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar el split fiscal');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [api, clienteId, periodo]);

  useEffect(() => { void load(); }, [load]);

  const exportCsv = useCallback(() => {
    if (!data) return;
    const header = ['Código', 'Sucursal', 'Ops', 'Importe', 'Gravado', 'No Gravado', 'IVA 21%', 'Total Factura', 'Consistente'];
    const rows: string[][] = [header];
    for (const s of data.sucursales) {
      rows.push([
        s.codigo ?? '',
        s.nombre ?? '',
        String(s.operaciones),
        s.importe_total.toFixed(2),
        s.gravado.toFixed(2),
        s.no_gravado.toFixed(2),
        s.iva_21.toFixed(2),
        s.total_factura.toFixed(2),
        s.consistente ? 'OK' : `DIFF ${s.consistencia_diff.toFixed(2)}`,
      ]);
    }
    rows.push([
      '', 'TOTAL',
      String(data.totales.operaciones),
      data.totales.importe_total.toFixed(2),
      data.totales.gravado.toFixed(2),
      data.totales.no_gravado.toFixed(2),
      data.totales.iva_21.toFixed(2),
      data.totales.total_factura.toFixed(2),
      data.totales.consistente ? 'OK' : 'REVISAR',
    ]);

    const filename = `split_fiscal_${(data.cliente ?? 'cliente').toLowerCase()}_${data.periodo}.csv`;
    if (onExportCsv) {
      onExportCsv(filename, rows);
      return;
    }
    // Default export inline
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, onExportCsv]);

  const warningSinSplit = useMemo(() => (data?.totales.ops_sin_split ?? 0) > 0, [data]);

  return (
    <section className="dashboard-card" style={{ marginBottom: 20 }}>
      <header className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>Split Fiscal por Sucursal{clienteNombre ? ` · ${clienteNombre}` : ''}</h3>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            Imp. Gravado + IVA 21% + Imp. No Gravado = Total a facturar
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="form-input"
            style={{ height: 34 }}
          />
          <button type="button" className="btn-sm" onClick={() => void load()} disabled={loading}>↻ Refrescar</button>
          <button type="button" className="btn-primary" onClick={exportCsv} disabled={!data || loading}>↓ Exportar CSV</button>
        </div>
      </header>

      {error && <div style={{ color: '#991b1b', background: '#fee2e2', padding: 10, borderRadius: 6, margin: 12 }}>{error}</div>}
      {loading && <div style={{ padding: 20 }}>Cargando…</div>}

      {!loading && data && (
        <>
          {warningSinSplit && (
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', padding: 10, borderRadius: 6, margin: 12, fontSize: 13 }}>
              ⚠ <strong>{data.totales.ops_sin_split}</strong> operaciones del período no tienen split gravado/no gravado cargado. Reparseá los PDFs de OCASA para poblarlas.
            </div>
          )}
          {!data.totales.consistente && (
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: 10, borderRadius: 6, margin: 12, fontSize: 13 }}>
              ⚠ La identidad aritmética <code>gravado + no_gravado = importe</code> no se cumple globalmente (diferencia mayor a $1). Revisar las sucursales en rojo.
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Cód.</th>
                  <th>Sucursal</th>
                  <th style={{ textAlign: 'right' }}>Ops</th>
                  <th style={{ textAlign: 'right' }}>Importe</th>
                  <th style={{ textAlign: 'right' }}>Gravado</th>
                  <th style={{ textAlign: 'right' }}>No Gravado</th>
                  <th style={{ textAlign: 'right' }}>IVA 21%</th>
                  <th style={{ textAlign: 'right' }}>Total Factura</th>
                </tr>
              </thead>
              <tbody>
                {data.sucursales.map((s) => (
                  <tr key={s.codigo ?? Math.random()} style={!s.consistente ? { background: '#fef2f2' } : undefined}>
                    <td style={{ fontFamily: 'monospace' }}>{s.codigo ?? '—'}</td>
                    <td>{s.nombre ?? <span style={{ color: '#9ca3af' }}>(sin nombre)</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      {s.operaciones}
                      {s.ops_sin_split > 0 && (
                        <span title={`${s.ops_sin_split} sin split`} style={{ marginLeft: 4, color: '#92400e' }}>⚠</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(s.importe_total)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(s.gravado)}</td>
                    <td style={{ textAlign: 'right', fontWeight: s.no_gravado > 0 ? 600 : 400 }}>{fmtMoney(s.no_gravado)}</td>
                    <td style={{ textAlign: 'right', color: '#1e40af' }}>{fmtMoney(s.iva_21)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(s.total_factura)}</td>
                  </tr>
                ))}
                {data.sucursales.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: '#6b7280', padding: 16 }}>Sin operaciones en el período</td></tr>
                )}
              </tbody>
              {data.sucursales.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
                    <td colSpan={2}>TOTAL</td>
                    <td style={{ textAlign: 'right' }}>{data.totales.operaciones}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(data.totales.importe_total)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(data.totales.gravado)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(data.totales.no_gravado)}</td>
                    <td style={{ textAlign: 'right', color: '#1e40af' }}>{fmtMoney(data.totales.iva_21)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(data.totales.total_factura)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </section>
  );
}
