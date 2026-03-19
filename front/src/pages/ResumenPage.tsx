import React, { useEffect, useMemo, useState } from 'react';

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  layoutVariant?: 'default' | 'panel';
  monitorView?: boolean;
};

export const ResumenPage: React.FC<{
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
}> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [resumenMensual, setResumenMensual] = useState<
    Array<{ key: string; label: string; altas: number; bajas: number; total: number; frozen: boolean }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`${apiBaseUrl}/api/personal/resumen-mensual`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const payload = (await response.json()) as {
          data?: Array<{ year: number; month: number; altas: number; bajas: number; total: number; frozen?: boolean }>;
        };
        const formatter = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });
        const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
        const pad = (value: number) => String(value).padStart(2, '0');
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        const normalized = rows.map((row) => {
          const key = `${row.year}-${pad(row.month)}`;
          const label = capitalize(formatter.format(new Date(row.year, row.month - 1, 1)));
          return {
            key,
            label,
            altas: row.altas ?? 0,
            bajas: row.bajas ?? 0,
            total: 0,
            frozen: Boolean(row.frozen),
          };
        });
        const chronological = [...normalized].sort((a, b) => a.key.localeCompare(b.key));
        let running = 0;
        chronological.forEach((item) => {
          running += item.altas - item.bajas;
          item.total = running;
        });
        const totalByKey = new Map(chronological.map((item) => [item.key, item.total]));
        setResumenMensual(
          normalized.map((item) => ({
            ...item,
            total: totalByKey.get(item.key) ?? 0,
          }))
        );
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setError((err as Error).message ?? 'No se pudieron cargar los datos.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [apiBaseUrl]);

  const totals = useMemo(() => {
    if (resumenMensual.length === 0) {
      return { altas: 0, bajas: 0, total: 0 };
    }
    const sum = resumenMensual.reduce(
      (acc, item) => {
        acc.altas += item.altas;
        acc.bajas += item.bajas;
        return acc;
      },
      { altas: 0, bajas: 0 }
    );
    const latest = [...resumenMensual].sort((a, b) => b.key.localeCompare(a.key))[0];
    return { altas: sum.altas, bajas: sum.bajas, total: latest?.total ?? 0 };
  }, [resumenMensual]);

  return (
    <DashboardLayout title="Resumen" subtitle="Resumen mensual de altas y bajas">
      <section className="dashboard-card">
        <header className="card-header">
          <h3>Resumen mensual</h3>
        </header>
        <div className="card-body">
          {loading ? <p className="form-info">Cargando resumen...</p> : null}
          {error ? <p className="form-info form-info--error">{error}</p> : null}
          {!loading && !error ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Altas</th>
                    <th>Bajas</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenMensual.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No hay movimientos para mostrar.</td>
                    </tr>
                  ) : (
                    resumenMensual.map((item) => (
                      <tr key={item.key}>
                        <td>{item.label}</td>
                        <td>{item.altas}</td>
                        <td>{item.bajas}</td>
                        <td>{item.total}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {resumenMensual.length > 0 ? (
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td>{totals.altas}</td>
                      <td>{totals.bajas}</td>
                      <td>{totals.total}</td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          ) : null}
        </div>
      </section>
    </DashboardLayout>
  );
};

