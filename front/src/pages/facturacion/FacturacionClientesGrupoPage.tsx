import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import type { FacturaSummaryDto } from '../../features/facturacion/types';
import { formatDateOnly, parseNumberOrZero } from '../../features/facturacion/utils';
import type { FacturacionPageContext } from './pageContext';

export const createFacturacionClientesGrupoPage = (ctx: FacturacionPageContext) => {
  const { FacturacionShell, useFacturacionApi, formatCurrency } = ctx;

  const FacturacionClientesGrupoPage: React.FC = () => {
    const { requestJson } = useFacturacionApi();
    const { grupoId } = useParams();
    const [facturas, setFacturas] = useState<FacturaSummaryDto[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const loadGroup = async () => {
        if (!grupoId) {
          setError('Grupo inválido.');
          return;
        }
        try {
          const payload = (await requestJson(`/api/clientes-facturacion/grupo/${grupoId}`)) as {
            data?: FacturaSummaryDto[];
          };
          setFacturas(Array.isArray(payload?.data) ? payload.data : []);
        } catch (err) {
          setError((err as Error).message ?? 'No se pudo cargar el grupo.');
        }
      };
      void loadGroup();
    }, [grupoId, requestJson]);

    const totals = useMemo(() => {
      return facturas.reduce(
        (acc, factura) => {
          acc.total += parseNumberOrZero(factura.imp_total);
          return acc;
        },
        { total: 0 }
      );
    }, [facturas]);

    return (
      <FacturacionShell title="Detalle de grupo" subtitle="Facturas del grupo seleccionado">
        {error ? <p className="form-info form-info--error">{error}</p> : null}
        <section className="summary-grid">
          <div className="summary-card summary-card--info">
            <span className="summary-card__label">Total grupo</span>
            <strong className="summary-card__value">{formatCurrency(totals.total)}</strong>
          </div>
        </section>
        <section className="dashboard-card facturacion-section">
          <div className="table-wrapper facturacion-table">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Sucursal</th>
                  <th>Comprobante</th>
                  <th>Emisión</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturas.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No hay facturas en este grupo.</td>
                  </tr>
                ) : (
                  facturas.map((factura) => (
                    <tr key={factura.id}>
                      <td>{factura.cliente_nombre}</td>
                      <td>{factura.sucursal_nombre ?? '—'}</td>
                      <td>
                        {factura.cbte_tipo}-{String(factura.pto_vta).padStart(4, '0')}-
                        {String(factura.cbte_numero ?? 0).padStart(8, '0')}
                      </td>
                      <td>{formatDateOnly(factura.fecha_cbte)}</td>
                      <td>{formatCurrency(parseNumberOrZero(factura.imp_total))}</td>
                      <td>{factura.estado}</td>
                      <td>
                        <NavLink
                          className="secondary-action secondary-action--ghost"
                          to={`/facturacion/facturas/${factura.id}`}
                        >
                          Ver detalle
                        </NavLink>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </FacturacionShell>
    );
  };

  return FacturacionClientesGrupoPage;
};

