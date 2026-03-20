import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { FacturaAuditoriaItem, FacturaDetalleDto } from '../../features/facturacion/types';
import { formatDateOnly, parseNumberOrZero } from '../../features/facturacion/utils';
import type { FacturacionPageContext } from './pageContext';

export const createFacturacionDetailPage = (ctx: FacturacionPageContext) => {
  const { FacturacionShell, useFacturacionApi, buildDownloadUrl, formatCurrency, formatDateTime } = ctx;

  const FacturacionDetailPage: React.FC = () => {
    const { apiBaseUrl, requestJson, requestText } = useFacturacionApi();
    const { facturaId } = useParams();
    const [factura, setFactura] = useState<FacturaDetalleDto | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cobranzaFeedback, setCobranzaFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [auditoria, setAuditoria] = useState<FacturaAuditoriaItem[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditError, setAuditError] = useState<string | null>(null);
    const [xmlRequestText, setXmlRequestText] = useState<string | null>(null);
    const [xmlResponseText, setXmlResponseText] = useState<string | null>(null);
    const [xmlError, setXmlError] = useState<string | null>(null);
    const [xmlLoading, setXmlLoading] = useState({ request: false, response: false });
    const [showXmlRequest, setShowXmlRequest] = useState(false);
    const [showXmlResponse, setShowXmlResponse] = useState(false);
    const [cobranzaForm, setCobranzaForm] = useState({
      fecha_aprox_cobro: '',
      fecha_pago_manual: '',
      monto_pagado_manual: '',
      observaciones_cobranza: '',
    });

    useEffect(() => {
      const id = Number(facturaId);
      if (!id) {
        setError('Factura inválida.');
        return;
      }
      const loadFactura = async () => {
        try {
          setLoading(true);
          const payload = (await requestJson(`/api/facturas/${id}`)) as { data?: FacturaDetalleDto };
          const data = payload?.data ?? null;
          setFactura(data);
          setCobranzaForm({
            fecha_aprox_cobro: data?.fecha_aprox_cobro ?? '',
            fecha_pago_manual: data?.fecha_pago_manual ?? '',
            monto_pagado_manual: data?.monto_pagado_manual?.toString() ?? '',
            observaciones_cobranza: data?.observaciones_cobranza ?? '',
          });
        } catch (err) {
          setError((err as Error).message ?? 'No se pudo cargar la factura.');
        } finally {
          setLoading(false);
        }
      };
      void loadFactura();
    }, [facturaId, requestJson]);

    useEffect(() => {
      if (!factura?.id) {
        return;
      }
      const loadAuditoria = async () => {
        try {
          setAuditLoading(true);
          setAuditError(null);
          const payload = (await requestJson(`/api/facturas/${factura.id}/auditoria`)) as { data?: FacturaAuditoriaItem[] };
          setAuditoria(Array.isArray(payload?.data) ? payload.data : []);
        } catch (err) {
          setAuditError((err as Error).message ?? 'No se pudo cargar la auditoría.');
        } finally {
          setAuditLoading(false);
        }
      };
      void loadAuditoria();
    }, [factura?.id, requestJson]);

    const loadXmlRequest = async () => {
      if (!factura?.id || xmlLoading.request) {
        return;
      }
      try {
        setXmlLoading((prev) => ({ ...prev, request: true }));
        setXmlError(null);
        const text = await requestText(`/api/facturas/${factura.id}/xml-request`);
        setXmlRequestText(text);
      } catch (err) {
        setXmlError((err as Error).message ?? 'No se pudo cargar el XML request.');
      } finally {
        setXmlLoading((prev) => ({ ...prev, request: false }));
      }
    };

    const loadXmlResponse = async () => {
      if (!factura?.id || xmlLoading.response) {
        return;
      }
      try {
        setXmlLoading((prev) => ({ ...prev, response: true }));
        setXmlError(null);
        const text = await requestText(`/api/facturas/${factura.id}/xml-response`);
        setXmlResponseText(text);
      } catch (err) {
        setXmlError((err as Error).message ?? 'No se pudo cargar el XML response.');
      } finally {
        setXmlLoading((prev) => ({ ...prev, response: false }));
      }
    };

    const handleUpdateCobranza = async () => {
      if (!factura) {
        return;
      }
      const hasInput =
        Boolean(cobranzaForm.fecha_aprox_cobro) ||
        Boolean(cobranzaForm.fecha_pago_manual) ||
        Boolean(cobranzaForm.monto_pagado_manual) ||
        Boolean(cobranzaForm.observaciones_cobranza);
      if (!hasInput) {
        setCobranzaFeedback({ type: 'error', message: 'Ingresá al menos un dato de cobranza.' });
        return;
      }
      if (cobranzaForm.fecha_pago_manual && cobranzaForm.fecha_aprox_cobro) {
        const pago = new Date(cobranzaForm.fecha_pago_manual);
        const aprox = new Date(cobranzaForm.fecha_aprox_cobro);
        if (pago.getTime() < aprox.getTime()) {
          setCobranzaFeedback({
            type: 'error',
            message: 'La fecha de pago manual debe ser posterior o igual a la fecha aproximada de cobro.',
          });
          return;
        }
      }
      try {
        setLoading(true);
        setCobranzaFeedback(null);
        await requestJson(`/api/facturas/${factura.id}/actualizar-cobranza`, {
          method: 'POST',
          body: JSON.stringify({
            fecha_aprox_cobro: cobranzaForm.fecha_aprox_cobro || null,
            fecha_pago_manual: cobranzaForm.fecha_pago_manual || null,
            monto_pagado_manual: cobranzaForm.monto_pagado_manual ? parseNumberOrZero(cobranzaForm.monto_pagado_manual) : null,
            observaciones_cobranza: cobranzaForm.observaciones_cobranza || null,
          }),
        });
        const refreshed = await requestJson(`/api/facturas/${factura.id}`) as { data?: FacturaDetalleDto };
        setFactura(refreshed?.data ?? null);
        setCobranzaFeedback({ type: 'success', message: 'Cobranza actualizada.' });
      } catch (err) {
        setCobranzaFeedback({ type: 'error', message: (err as Error).message ?? 'No se pudo actualizar la cobranza.' });
      } finally {
        setLoading(false);
      }
    };

    if (error) {
      return (
        <FacturacionShell title="Detalle de factura">
          <p className="form-info form-info--error">{error}</p>
        </FacturacionShell>
      );
    }

    if (loading || !factura) {
      return (
        <FacturacionShell title="Detalle de factura">
          <p className="form-info">Cargando factura...</p>
        </FacturacionShell>
      );
    }

    const pdfUrl = buildDownloadUrl(apiBaseUrl, factura.pdf_url);
    const xmlRequestUrl = buildDownloadUrl(apiBaseUrl, factura.xml_request_url);
    const xmlResponseUrl = buildDownloadUrl(apiBaseUrl, factura.xml_response_url);

    return (
      <FacturacionShell title={`Factura ${factura.id}`} subtitle={`Estado fiscal: ${factura.estado}`}>
        <section className="dashboard-card facturacion-section">
          <div className="facturacion-detail-header">
            <div>
              <h3>Comprobante</h3>
              <p>
                {factura.cbte_tipo}-{String(factura.pto_vta).padStart(4, '0')}-
                {String(factura.cbte_numero ?? 0).padStart(8, '0')}
              </p>
              <p>CAE: {factura.cae ?? '—'} · Vto CAE: {formatDateOnly(factura.cae_vto)}</p>
            </div>
            <div className="facturacion-detail-actions">
              {pdfUrl ? (
                <a className="primary-action" href={pdfUrl} target="_blank" rel="noreferrer">
                  Descargar PDF
                </a>
              ) : null}
              {xmlRequestUrl ? (
                <a className="secondary-action" href={xmlRequestUrl} target="_blank" rel="noreferrer">
                  XML request
                </a>
              ) : null}
              {xmlResponseUrl ? (
                <a className="secondary-action" href={xmlResponseUrl} target="_blank" rel="noreferrer">
                  XML response
                </a>
              ) : null}
            </div>
          </div>

          <div className="facturacion-detail-grid">
            <div>
              <h4>Cliente</h4>
              <p>{factura.cliente_nombre}</p>
              <p>CUIT: {factura.doc_nro}</p>
              <p>Domicilio: {factura.cliente_domicilio ?? '—'}</p>
            </div>
            <div>
              <h4>Período</h4>
              <p>{factura.anio_facturado}/{String(factura.mes_facturado).padStart(2, '0')} {factura.periodo_facturado}</p>
              <p>Fecha emisión: {formatDateOnly(factura.fecha_cbte)}</p>
              <p>Vto pago: {formatDateOnly(factura.fecha_vto_pago)}</p>
            </div>
            <div>
              <h4>Importes</h4>
              <p>Neto gravado: {formatCurrency(parseNumberOrZero(factura.imp_neto))}</p>
              <p>No gravado: {formatCurrency(parseNumberOrZero(factura.imp_tot_conc) + parseNumberOrZero(factura.imp_op_ex))}</p>
              <p>IVA: {formatCurrency(parseNumberOrZero(factura.imp_iva))}</p>
              <p>Total: {formatCurrency(parseNumberOrZero(factura.imp_total))}</p>
            </div>
          </div>
        </section>

        <section className="dashboard-card facturacion-section">
          <h3>Detalle PDF</h3>
          <div className="table-wrapper facturacion-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Descripción</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>Subtotal</th>
                  <th>IVA %</th>
                  <th>Subtotal c/IVA</th>
                </tr>
              </thead>
              <tbody>
                {(factura.detalle_pdf ?? []).map((row) => (
                  <tr key={row.orden}>
                    <td>{row.orden}</td>
                    <td>{row.descripcion}</td>
                    <td>{row.cantidad}</td>
                    <td>{formatCurrency(row.precio_unitario)}</td>
                    <td>{formatCurrency(row.subtotal)}</td>
                    <td>{row.alicuota_iva_pct ?? 0}%</td>
                    <td>{formatCurrency(row.subtotal_con_iva)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-card facturacion-section">
          <h3>XML ARCA</h3>
          {xmlError ? <p className="form-info form-info--error">{xmlError}</p> : null}
          <div className="form-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                const next = !showXmlRequest;
                setShowXmlRequest(next);
                if (next && !xmlRequestText) {
                  void loadXmlRequest();
                }
              }}
              disabled={!xmlRequestUrl || xmlLoading.request}
            >
              {showXmlRequest ? 'Ocultar XML request' : 'Ver XML request'}
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                const next = !showXmlResponse;
                setShowXmlResponse(next);
                if (next && !xmlResponseText) {
                  void loadXmlResponse();
                }
              }}
              disabled={!xmlResponseUrl || xmlLoading.response}
            >
              {showXmlResponse ? 'Ocultar XML response' : 'Ver XML response'}
            </button>
          </div>
          {showXmlRequest ? (
            <pre className="facturacion-xml">
              {xmlLoading.request ? 'Cargando XML request...' : xmlRequestText ?? 'Sin XML request.'}
            </pre>
          ) : null}
          {showXmlResponse ? (
            <pre className="facturacion-xml">
              {xmlLoading.response ? 'Cargando XML response...' : xmlResponseText ?? 'Sin XML response.'}
            </pre>
          ) : null}
        </section>

        <section className="dashboard-card facturacion-section">
          <h3>Cobranza</h3>
          {cobranzaFeedback ? (
            <p className={`form-info ${cobranzaFeedback.type === 'error' ? 'form-info--error' : 'form-info--success'}`}>
              {cobranzaFeedback.message}
            </p>
          ) : null}
          <div className="filters-grid facturacion-grid">
            <label className="input-control">
              <span>Fecha aprox. cobro</span>
              <input
                type="date"
                value={cobranzaForm.fecha_aprox_cobro}
                onChange={(event) => setCobranzaForm((prev) => ({ ...prev, fecha_aprox_cobro: event.target.value }))}
              />
            </label>
            <label className="input-control">
              <span>Fecha pago manual</span>
              <input
                type="date"
                value={cobranzaForm.fecha_pago_manual}
                onChange={(event) => setCobranzaForm((prev) => ({ ...prev, fecha_pago_manual: event.target.value }))}
              />
            </label>
            <label className="input-control">
              <span>Monto pago manual</span>
              <input
                value={cobranzaForm.monto_pagado_manual}
                onChange={(event) => setCobranzaForm((prev) => ({ ...prev, monto_pagado_manual: event.target.value }))}
              />
            </label>
            <label className="input-control">
              <span>Observaciones</span>
              <input
                value={cobranzaForm.observaciones_cobranza}
                onChange={(event) => setCobranzaForm((prev) => ({ ...prev, observaciones_cobranza: event.target.value }))}
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="primary-action" onClick={handleUpdateCobranza} disabled={loading}>
              Guardar cobranza
            </button>
          </div>
        </section>

        <section className="dashboard-card facturacion-section">
          <h3>Auditoría</h3>
          {auditError ? <p className="form-info form-info--error">{auditError}</p> : null}
          {auditLoading ? <p className="form-info">Cargando auditoría...</p> : null}
          <div className="table-wrapper facturacion-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Evento</th>
                  <th>Usuario</th>
                  <th>IP</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {auditoria.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Sin eventos de auditoría.</td>
                  </tr>
                ) : (
                  auditoria.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDateTime(item.created_at ?? '')}</td>
                      <td>{item.evento}</td>
                      <td>{item.usuario?.name ?? item.usuario?.email ?? '—'}</td>
                      <td>{item.ip ?? '—'}</td>
                      <td>
                        {item.payload_before || item.payload_after ? (
                          <details>
                            <summary>Ver payload</summary>
                            {item.payload_before ? (
                              <pre className="facturacion-xml">{JSON.stringify(item.payload_before, null, 2)}</pre>
                            ) : null}
                            {item.payload_after ? (
                              <pre className="facturacion-xml">{JSON.stringify(item.payload_after, null, 2)}</pre>
                            ) : null}
                          </details>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-card facturacion-section">
          <h3>Historial de cobranza</h3>
          <div className="table-wrapper facturacion-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Estado anterior</th>
                  <th>Estado nuevo</th>
                  <th>Pago</th>
                  <th>Monto</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {(factura.historial_cobranza ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6}>Sin movimientos de cobranza.</td>
                  </tr>
                ) : (
                  (factura.historial_cobranza ?? []).map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.fecha_evento ?? '')}</td>
                      <td>{row.estado_anterior ?? '—'}</td>
                      <td>{row.estado_nuevo ?? '—'}</td>
                      <td>{formatDateOnly(row.fecha_pago_nueva)}</td>
                      <td>{formatCurrency(row.monto_pagado_nuevo ?? 0)}</td>
                      <td>{row.usuario?.name ?? row.usuario?.email ?? '—'}</td>
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

  return FacturacionDetailPage;
};
