import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FACTURACION_COMPROBANTES_OPTIONS } from '../../facturacionComprobantes';
import {
  FACTURACION_ALICUOTA_PCT_OPTIONS,
  FACTURACION_CBTE_ASOC_OPTIONS,
  FACTURACION_CBTE_TIPO_FACTURA_A,
  FACTURACION_CBTE_TIPOS_REQUIEREN_ASOCIACION,
  FACTURACION_CONDICIONES_VENTA,
  FACTURACION_DEFAULT_AMBIENTE,
  FACTURACION_DEFAULT_PTO_VTA,
  FACTURACION_IVA_ALICUOTAS,
  FACTURACION_PERIODOS,
  TARIFA_MONTH_OPTIONS,
  FACTURACION_UNIDADES_MEDIDA_FALLBACK,
  FACTURACION_UNIDAD_MEDIDA_DEFAULT,
} from '../../features/facturacion/constants';
import type {
  ArcaEmisorDto,
  ClienteSelectOption,
  FacturaDetalleDto,
  FacturaSummaryDto,
  SucursalSelectOption,
} from '../../features/facturacion/types';
import { parseNumberOrZero, uniqueKey } from '../../features/facturacion/utils';
import type { FacturacionPageContext } from './pageContext';

export const createFacturacionCreatePage = (ctx: FacturacionPageContext) => {
  const { FacturacionShell, useFacturacionApi } = ctx;

  type FacturaDraftRow = {
    id: string;
    orden: string;
    descripcion: string;
    cantidad: string;
    unidad_medida: string;
    precio_unitario: string;
    bonificacion_pct: string;
    subtotal: string;
    alicuota_iva_pct: string;
    subtotal_con_iva: string;
  };

  type FacturaIvaDraft = {
    id: string;
    iva_id: string;
    base_imp: string;
    importe: string;
    auto?: boolean;
  };

  type FacturaTributoDraft = {
    id: string;
    tributo_id: string;
    descr: string;
    base_imp: string;
    alic: string;
    importe: string;
  };

  type FacturaCbteAsocDraft = {
    id: string;
    cbte_tipo: string;
    pto_vta: string;
    cbte_numero: string;
    fecha_emision: string;
  };

  type FacturaDraftForm = {
    emisor_id: string;
    ambiente: 'HOMO' | 'PROD';
    pto_vta: string;
    cbte_tipo: string;
    concepto: string;
    doc_tipo: string;
    doc_nro: string;
    cliente_id: string;
    sucursal_id: string;
    cliente_nombre: string;
    cliente_domicilio: string;
    fecha_cbte: string;
    fecha_serv_desde: string;
    fecha_serv_hasta: string;
    fecha_vto_pago: string;
    condiciones_venta: string[];
    moneda_id: string;
    moneda_cotiz: string;
    imp_total: string;
    imp_tot_conc: string;
    imp_neto: string;
    imp_op_ex: string;
    imp_iva: string;
    imp_trib: string;
    anio_facturado: string;
    mes_facturado: string;
    periodo_facturado: string;
    fecha_aprox_cobro: string;
    fecha_pago_manual: string;
    monto_pagado_manual: string;
    observaciones_cobranza: string;
  };

  const buildInitialFacturaForm = (): FacturaDraftForm => {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const plus30 = new Date(now);
    plus30.setDate(plus30.getDate() + 30);
    const toIso = (value: Date) => value.toISOString().slice(0, 10);
    return {
      emisor_id: '',
      ambiente: FACTURACION_DEFAULT_AMBIENTE,
      pto_vta: FACTURACION_DEFAULT_PTO_VTA,
      cbte_tipo: '1',
      concepto: '2',
      doc_tipo: '80',
      doc_nro: '',
      cliente_id: '',
      sucursal_id: '',
      cliente_nombre: '',
      cliente_domicilio: '',
      fecha_cbte: now.toISOString().slice(0, 10),
      fecha_serv_desde: toIso(startOfMonth),
      fecha_serv_hasta: toIso(endOfMonth),
      fecha_vto_pago: toIso(plus30),
      condiciones_venta: ['CUENTA_CORRIENTE'],
      moneda_id: 'PES',
      moneda_cotiz: '1',
      imp_total: '0',
      imp_tot_conc: '0',
      imp_neto: '0',
      imp_op_ex: '0',
      imp_iva: '0',
      imp_trib: '0',
      anio_facturado: year,
      mes_facturado: month,
      periodo_facturado: 'MES_COMPLETO',
      fecha_aprox_cobro: toIso(plus30),
      fecha_pago_manual: '',
      monto_pagado_manual: '',
      observaciones_cobranza: '',
    };
  };

  const createFacturaDetalleRow = (orden: number): FacturaDraftRow => ({
    id: uniqueKey(),
    orden: orden.toString(),
    descripcion: '',
    cantidad: '1',
    unidad_medida: FACTURACION_UNIDAD_MEDIDA_DEFAULT,
    precio_unitario: '0',
    bonificacion_pct: '0',
    subtotal: '0',
    alicuota_iva_pct: '0',
    subtotal_con_iva: '0',
  });

  const resolveFacturaIvaId = (baseImp: number, importe: number): number => {
    if (baseImp <= 0 || importe <= 0) {
      return 5;
    }
    const rate = (importe / baseImp) * 100;
    let best = FACTURACION_IVA_ALICUOTAS[0];
    let bestDiff = Math.abs(rate - best.rate);
    for (const candidate of FACTURACION_IVA_ALICUOTAS) {
      const diff = Math.abs(rate - candidate.rate);
      if (diff < bestDiff) {
        best = candidate;
        bestDiff = diff;
      }
    }
    return best.id;
  };

  const createFacturaIvaRow = (): FacturaIvaDraft => ({
    id: uniqueKey(),
    iva_id: '',
    base_imp: '0',
    importe: '0',
    auto: false,
  });

  const buildAutoFacturaIvaRow = (baseImp: number, importe: number): FacturaIvaDraft => ({
    id: uniqueKey(),
    iva_id: String(resolveFacturaIvaId(baseImp, importe)),
    base_imp: baseImp.toFixed(2),
    importe: importe.toFixed(2),
    auto: true,
  });

  const createFacturaTributoRow = (): FacturaTributoDraft => ({
    id: uniqueKey(),
    tributo_id: '',
    descr: '',
    base_imp: '0',
    alic: '0',
    importe: '0',
  });

  const FacturacionCreatePage: React.FC = () => {
    const { requestJson } = useFacturacionApi();
    const navigate = useNavigate();
    const [emisores, setEmisores] = useState<ArcaEmisorDto[]>([]);
    const [clientes, setClientes] = useState<ClienteSelectOption[]>([]);
    const [sucursales, setSucursales] = useState<SucursalSelectOption[]>([]);
    const [unidadMedidaOptions, setUnidadMedidaOptions] = useState<string[]>(FACTURACION_UNIDADES_MEDIDA_FALLBACK);
    const [form, setForm] = useState<FacturaDraftForm>(() => buildInitialFacturaForm());
    const [detallePdf, setDetallePdf] = useState<FacturaDraftRow[]>(() => [createFacturaDetalleRow(1)]);
    const [ivaItems, setIvaItems] = useState<FacturaIvaDraft[]>([]);
    const [tributos, setTributos] = useState<FacturaTributoDraft[]>([]);
    const [cbtesAsoc, setCbtesAsoc] = useState<FacturaCbteAsocDraft[]>([]);
    const [facturasAsociables, setFacturasAsociables] = useState<FacturaSummaryDto[]>([]);
    const [asociablesLoading, setAsociablesLoading] = useState(false);
    const [facturaId, setFacturaId] = useState<number | null>(null);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
    const [autoTotal, setAutoTotal] = useState(true);
    const [autoImportesDesdeDetalle, setAutoImportesDesdeDetalle] = useState(true);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    useEffect(() => {
      const loadInitial = async () => {
        setInitialLoading(true);
        try {
          const [emisoresPayload, clientesPayload] = await Promise.all([
            requestJson('/api/arca/emisores?with_relations=1') as Promise<{ data?: ArcaEmisorDto[] }>,
            requestJson('/api/clientes/select?limit=500') as Promise<{ data?: ClienteSelectOption[] }>,
          ]);
          setEmisores(Array.isArray(emisoresPayload?.data) ? emisoresPayload.data : []);
          setClientes(Array.isArray(clientesPayload?.data) ? clientesPayload.data : []);
        } catch (err) {
          setFeedback({ type: 'error', message: (err as Error).message ?? 'No se pudieron cargar datos iniciales.' });
        } finally {
          setInitialLoading(false);
        }
      };

      void loadInitial();
    }, [requestJson]);

    useEffect(() => {
      const emisor = emisores.find((item) => item.id === Number(form.emisor_id));
      if (emisor) {
        setForm((prev) => ({
          ...prev,
          ambiente: emisor.ambiente_default ?? prev.ambiente,
        }));
      }
    }, [emisores, form.emisor_id]);

    useEffect(() => {
      if (form.ambiente !== FACTURACION_DEFAULT_AMBIENTE) {
        setForm((prev) => ({ ...prev, ambiente: FACTURACION_DEFAULT_AMBIENTE }));
      }
    }, [form.ambiente]);

    useEffect(() => {
      if (!form.emisor_id && emisores.length === 1) {
        const onlyEmisor = emisores[0];
        setForm((prev) => ({
          ...prev,
          emisor_id: String(onlyEmisor.id),
          ambiente: onlyEmisor.ambiente_default ?? prev.ambiente,
        }));
      }
    }, [emisores, form.emisor_id]);

    useEffect(() => {
      const emisorId = Number(form.emisor_id);
      if (!emisorId) {
        return;
      }
      let active = true;
      const loadUnidades = async () => {
        try {
          const payload = (await requestJson(
            `/api/arca/emisores/${emisorId}/parametros/unidades?ambiente=${form.ambiente}`
          )) as { data?: Array<{ descripcion?: string | null; Desc?: string | null; desc?: string | null }> };
          const list = Array.isArray(payload?.data) ? payload.data : [];
          const labels = list
            .map((item) => String(item.descripcion ?? item.Desc ?? item.desc ?? '').trim())
            .filter((label) => label.length > 0);
          if (!active || labels.length === 0) {
            return;
          }
          const merged = labels.includes(FACTURACION_UNIDAD_MEDIDA_DEFAULT)
            ? labels
            : [FACTURACION_UNIDAD_MEDIDA_DEFAULT, ...labels];
          setUnidadMedidaOptions(merged);
        } catch {
          if (!active) {
            return;
          }
          setUnidadMedidaOptions((prev) => (prev.length > 0 ? prev : FACTURACION_UNIDADES_MEDIDA_FALLBACK));
        }
      };
      void loadUnidades();
      return () => {
        active = false;
      };
    }, [form.emisor_id, form.ambiente, requestJson]);

    useEffect(() => {
      setDetallePdf((prev) =>
        prev.map((row) => (row.unidad_medida ? row : { ...row, unidad_medida: FACTURACION_UNIDAD_MEDIDA_DEFAULT }))
      );
    }, [unidadMedidaOptions]);

    useEffect(() => {
      const clienteId = Number(form.cliente_id);
      if (!clienteId) {
        setSucursales([]);
        return;
      }
      const loadSucursales = async () => {
        try {
          const payload = (await requestJson(`/api/clientes/${clienteId}/sucursales`)) as { data?: SucursalSelectOption[] };
          setSucursales(Array.isArray(payload?.data) ? payload.data : []);
        } catch {
          setSucursales([]);
        }
      };
      void loadSucursales();
    }, [form.cliente_id, requestJson]);

    useEffect(() => {
      if (!autoTotal) {
        return;
      }
      const total =
        parseNumberOrZero(form.imp_tot_conc) +
        parseNumberOrZero(form.imp_neto) +
        parseNumberOrZero(form.imp_op_ex) +
        parseNumberOrZero(form.imp_iva) +
        parseNumberOrZero(form.imp_trib);
      const nextTotal = total.toFixed(2);
      if (form.imp_total !== nextTotal) {
        setForm((prev) => ({ ...prev, imp_total: nextTotal }));
      }
    }, [autoTotal, form.imp_tot_conc, form.imp_neto, form.imp_op_ex, form.imp_iva, form.imp_trib, form.imp_total]);

    useEffect(() => {
      if (!autoImportesDesdeDetalle) {
        return;
      }

      const neto = detallePdf.reduce((acc, row) => acc + parseNumberOrZero(row.subtotal), 0);
      const totalDetalle = detallePdf.reduce((acc, row) => acc + parseNumberOrZero(row.subtotal_con_iva), 0);
      const iva = Math.max(0, totalDetalle - neto);

      const nextNeto = neto.toFixed(2);
      const nextIva = iva.toFixed(2);

      // Para evitar inconsistencias con el validador, asumimos que el detalle PDF representa
      // el total sin tributos. Tributos se suman en cabecera vía `imp_trib`.
      const trib = parseNumberOrZero(form.imp_trib);
      const nextTotal = (totalDetalle + trib).toFixed(2);

      setForm((prev) => {
        const next = { ...prev };
        let changed = false;
        if (next.imp_tot_conc !== '0.00') {
          next.imp_tot_conc = '0.00';
          changed = true;
        }
        if (next.imp_op_ex !== '0.00') {
          next.imp_op_ex = '0.00';
          changed = true;
        }
        if (next.imp_neto !== nextNeto) {
          next.imp_neto = nextNeto;
          changed = true;
        }
        if (next.imp_iva !== nextIva) {
          next.imp_iva = nextIva;
          changed = true;
        }
        if (next.imp_total !== nextTotal) {
          next.imp_total = nextTotal;
          changed = true;
        }
        return changed ? next : prev;
      });
    }, [autoImportesDesdeDetalle, detallePdf, form.imp_trib]);

    useEffect(() => {
      const isFacturaA = form.cbte_tipo === FACTURACION_CBTE_TIPO_FACTURA_A;
      const impIva = parseNumberOrZero(form.imp_iva);
      const impNeto = parseNumberOrZero(form.imp_neto);

      if (!isFacturaA || impIva <= 0) {
        setIvaItems((prev) => {
          const autoIndex = prev.findIndex((item) => item.auto);
          if (autoIndex === -1) {
            return prev;
          }
          return prev.filter((_, index) => index !== autoIndex);
        });
        return;
      }

      setIvaItems((prev) => {
        if (prev.length === 0) {
          return [buildAutoFacturaIvaRow(impNeto, impIva)];
        }
        const autoIndex = prev.findIndex((item) => item.auto);
        if (autoIndex === -1) {
          return prev;
        }
        const next = [...prev];
        const nextIvaId = String(resolveFacturaIvaId(impNeto, impIva));
        const nextBase = impNeto.toFixed(2);
        const nextImporte = impIva.toFixed(2);
        const current = next[autoIndex];
        if (current.iva_id === nextIvaId && current.base_imp === nextBase && current.importe === nextImporte) {
          return prev;
        }
        next[autoIndex] = {
          ...current,
          iva_id: nextIvaId,
          base_imp: nextBase,
          importe: nextImporte,
          auto: true,
        };
        return next;
      });
    }, [form.cbte_tipo, form.imp_iva, form.imp_neto]);

    const selectedEmisor = useMemo(
      () => emisores.find((item) => item.id === Number(form.emisor_id)) ?? null,
      [emisores, form.emisor_id]
    );

    const activeCertificado = useMemo(() => {
      if (!selectedEmisor?.certificados) {
        return null;
      }
      return (
        selectedEmisor.certificados.find(
          (cert) => cert.activo && cert.ambiente === form.ambiente
        ) ?? null
      );
    }, [selectedEmisor, form.ambiente]);

    const puntosVenta = useMemo(() => {
      if (!selectedEmisor?.puntos_venta) {
        return [];
      }
      return selectedEmisor.puntos_venta.filter(
        (punto) => punto.ambiente === form.ambiente && punto.habilitado_para_erp
      );
    }, [selectedEmisor, form.ambiente]);

    const hasDefaultPtoVta = useMemo(
      () => puntosVenta.some((punto) => punto.nro === Number(FACTURACION_DEFAULT_PTO_VTA)),
      [puntosVenta]
    );

    useEffect(() => {
      const desired = FACTURACION_DEFAULT_PTO_VTA;
      if (form.pto_vta !== desired) {
        setForm((prev) => ({ ...prev, pto_vta: desired }));
      }
    }, [form.pto_vta]);

    const requiereCbtesAsoc = useMemo(
      () => FACTURACION_CBTE_TIPOS_REQUIEREN_ASOCIACION.has(Number(form.cbte_tipo)),
      [form.cbte_tipo]
    );

    const resolveDefaultCbteAsocTipo = useCallback((cbteTipo: number): number => {
      if ([7, 8, 207, 208].includes(cbteTipo)) {
        return 6; // Factura B
      }
      if ([12, 13, 212, 213].includes(cbteTipo)) {
        return 11; // Factura C
      }
      return 1; // Factura A
    }, []);

    const createCbteAsocRow = useCallback((): FacturaCbteAsocDraft => {
      const cbteTipo = Number(form.cbte_tipo);
      return {
        id: uniqueKey(),
        cbte_tipo: String(resolveDefaultCbteAsocTipo(cbteTipo)),
        pto_vta: form.pto_vta || FACTURACION_DEFAULT_PTO_VTA,
        cbte_numero: '',
        fecha_emision: '',
      };
    }, [form.cbte_tipo, form.pto_vta, resolveDefaultCbteAsocTipo]);

    useEffect(() => {
      if (!requiereCbtesAsoc) {
        if (cbtesAsoc.length > 0) {
          setCbtesAsoc([]);
        }
        return;
      }
      setCbtesAsoc((prev) => (prev.length > 0 ? prev : [createCbteAsocRow()]));
    }, [cbtesAsoc.length, createCbteAsocRow, requiereCbtesAsoc]);

    useEffect(() => {
      setFacturasAsociables([]);
    }, [form.cliente_id, form.sucursal_id, form.cbte_tipo]);

    const loadFacturasAsociables = async () => {
      const clienteId = Number(form.cliente_id);
      const sucursalId = Number(form.sucursal_id);
      if (!clienteId || !sucursalId) {
        setFeedback({ type: 'error', message: 'Seleccioná cliente y sucursal para buscar comprobantes asociados.' });
        return;
      }
      if (asociablesLoading) {
        return;
      }
      try {
        setAsociablesLoading(true);
        const desde = new Date();
        desde.setMonth(desde.getMonth() - 6);
        const fechaDesde = desde.toISOString().slice(0, 10);
        const payload = (await requestJson(
          `/api/facturas?cliente_id=${clienteId}&sucursal_id=${sucursalId}&fecha_desde=${fechaDesde}`
        )) as { data?: FacturaSummaryDto[] };
        const list = Array.isArray(payload?.data) ? payload.data : [];
        const filtered = list.filter(
          (item) =>
            Boolean(item.cbte_numero) &&
            (item.estado === 'PDF_GENERADO' || item.estado === 'AUTORIZADA')
        );
        setFacturasAsociables(filtered);
        if (filtered.length === 0) {
          setFeedback({ type: 'error', message: 'No se encontraron comprobantes emitidos para asociar en los últimos meses.' });
        }
      } catch (err) {
        setFeedback({ type: 'error', message: (err as Error).message ?? 'No se pudieron cargar comprobantes emitidos.' });
      } finally {
        setAsociablesLoading(false);
      }
    };

    const toggleCondicionVenta = (value: string) => {
      setForm((prev) => {
        const current = Array.isArray(prev.condiciones_venta) ? prev.condiciones_venta : [];
        const exists = current.includes(value);
        const next = exists ? current.filter((item) => item !== value) : [...current, value];
        return { ...prev, condiciones_venta: next };
      });
    };

    const handleDetalleChange = (index: number, field: keyof FacturaDraftRow, value: string) => {
      setDetallePdf((prev) => {
        const next = [...prev];
        const current = { ...next[index], [field]: value };
        const cantidad = parseNumberOrZero(current.cantidad);
        const precio = parseNumberOrZero(current.precio_unitario);
        const bonif = parseNumberOrZero(current.bonificacion_pct);
        const alic = parseNumberOrZero(current.alicuota_iva_pct);
        const subtotal = cantidad * precio * (1 - bonif / 100);
        const subtotalConIva = subtotal * (1 + alic / 100);
        current.subtotal = subtotal.toFixed(2);
        current.subtotal_con_iva = subtotalConIva.toFixed(2);
        next[index] = current;
        return next;
      });
    };

    const buildPayload = (): Record<string, unknown> => ({
      emisor_id: Number(form.emisor_id),
      ambiente: form.ambiente,
      pto_vta: Number(form.pto_vta),
      cbte_tipo: Number(form.cbte_tipo),
      concepto: Number(form.concepto),
      doc_tipo: Number(form.doc_tipo),
      doc_nro: Number(form.doc_nro),
      cliente_id: Number(form.cliente_id),
      sucursal_id: Number(form.sucursal_id),
      cliente_nombre: form.cliente_nombre,
      cliente_domicilio: form.cliente_domicilio,
      fecha_cbte: form.fecha_cbte,
      fecha_serv_desde: form.fecha_serv_desde || null,
      fecha_serv_hasta: form.fecha_serv_hasta || null,
      fecha_vto_pago: form.fecha_vto_pago || null,
      condiciones_venta: form.condiciones_venta,
      moneda_id: form.moneda_id,
      moneda_cotiz: parseNumberOrZero(form.moneda_cotiz),
      imp_total: parseNumberOrZero(form.imp_total),
      imp_tot_conc: parseNumberOrZero(form.imp_tot_conc),
      imp_neto: parseNumberOrZero(form.imp_neto),
      imp_op_ex: parseNumberOrZero(form.imp_op_ex),
      imp_iva: parseNumberOrZero(form.imp_iva),
      imp_trib: parseNumberOrZero(form.imp_trib),
      anio_facturado: Number(form.anio_facturado),
      mes_facturado: Number(form.mes_facturado),
      periodo_facturado: form.periodo_facturado,
      fecha_aprox_cobro: form.fecha_aprox_cobro || null,
      fecha_pago_manual: form.fecha_pago_manual || null,
      monto_pagado_manual: form.monto_pagado_manual ? parseNumberOrZero(form.monto_pagado_manual) : null,
      observaciones_cobranza: form.observaciones_cobranza || null,
      iva: ivaItems
        .filter((item) => item.iva_id)
        .map((item) => ({
          iva_id: Number(item.iva_id),
          base_imp: parseNumberOrZero(item.base_imp),
          importe: parseNumberOrZero(item.importe),
        })),
      tributos: tributos
        .filter((item) => item.tributo_id)
        .map((item) => ({
          tributo_id: Number(item.tributo_id),
          descr: item.descr || null,
          base_imp: item.base_imp ? parseNumberOrZero(item.base_imp) : null,
          alic: item.alic ? parseNumberOrZero(item.alic) : null,
          importe: parseNumberOrZero(item.importe),
        })),
      detalle_pdf: detallePdf.map((row, index) => ({
        orden: row.orden ? Number(row.orden) : index + 1,
        descripcion: row.descripcion,
        cantidad: parseNumberOrZero(row.cantidad),
        unidad_medida: row.unidad_medida || null,
        precio_unitario: parseNumberOrZero(row.precio_unitario),
        bonificacion_pct: parseNumberOrZero(row.bonificacion_pct),
        subtotal: parseNumberOrZero(row.subtotal),
        alicuota_iva_pct: parseNumberOrZero(row.alicuota_iva_pct),
        subtotal_con_iva: parseNumberOrZero(row.subtotal_con_iva),
      })),
      cbtes_asoc: requiereCbtesAsoc
        ? cbtesAsoc
            .filter((row) => row.cbte_numero.trim() !== '')
            .map((row) => ({
              cbte_tipo: Number(row.cbte_tipo),
              pto_vta: Number(row.pto_vta),
              cbte_numero: Number(row.cbte_numero),
              fecha_emision: row.fecha_emision ? row.fecha_emision : null,
            }))
        : [],
    });

    const handleSaveDraft = async () => {
      if (form.fecha_pago_manual && form.fecha_aprox_cobro) {
        const pago = new Date(form.fecha_pago_manual);
        const aprox = new Date(form.fecha_aprox_cobro);
        if (pago.getTime() < aprox.getTime()) {
          setFeedback({
            type: 'error',
            message: 'La fecha de pago manual debe ser posterior o igual a la fecha aproximada de cobro.',
          });
          return;
        }
      }
      setLoading(true);
      setFeedback(null);
      setValidationErrors({});
      try {
        const payload = buildPayload();
        const response = facturaId
          ? await requestJson(`/api/facturas/${facturaId}/borrador`, {
              method: 'PUT',
              body: JSON.stringify(payload),
            })
          : await requestJson('/api/facturas', {
              method: 'POST',
              body: JSON.stringify(payload),
            });
        const factura = (response as { data?: FacturaDetalleDto }).data;
        if (factura?.id) {
          setFacturaId(factura.id);
        }
        if (requiereCbtesAsoc) {
          const incoming = Array.isArray(factura?.cbtes_asoc) ? factura?.cbtes_asoc : [];
          setCbtesAsoc((prev) => {
            if (!incoming || incoming.length === 0) {
              return prev;
            }
            return incoming.map((item) => ({
              id: uniqueKey(),
              cbte_tipo: String(item.cbte_tipo),
              pto_vta: String(item.pto_vta),
              cbte_numero: String(item.cbte_numero),
              fecha_emision: item.fecha_emision ? String(item.fecha_emision).slice(0, 10) : '',
            }));
          });
        }
        setFeedback({ type: 'success', message: response?.message ?? 'Borrador guardado.' });
      } catch (err) {
        const error = err as Error & { payload?: any };
        setFeedback({ type: 'error', message: error.message ?? 'No se pudo guardar el borrador.' });
        if (error.payload?.errors) {
          setValidationErrors(error.payload.errors);
        }
      } finally {
        setLoading(false);
      }
    };

    const handleValidate = async () => {
      if (!facturaId) {
        setFeedback({ type: 'error', message: 'Guardá el borrador antes de validar.' });
        return;
      }
      setLoading(true);
      setFeedback(null);
      setValidationErrors({});
      try {
        const response = await requestJson(`/api/facturas/${facturaId}/validar`, { method: 'POST' });
        setFeedback({ type: 'success', message: response?.message ?? 'Factura validada.' });
      } catch (err) {
        const error = err as Error & { payload?: any };
        setFeedback({ type: 'error', message: error.message ?? 'La validación falló.' });
        if (error.payload?.errors) {
          setValidationErrors(error.payload.errors);
        }
      } finally {
        setLoading(false);
      }
    };

    const handleEmit = async () => {
      if (!facturaId) {
        setFeedback({ type: 'error', message: 'Guardá el borrador antes de emitir.' });
        return;
      }
      if (!selectedEmisor) {
        setFeedback({ type: 'error', message: 'Seleccioná un emisor.' });
        return;
      }
      if (!form.pto_vta) {
        setFeedback({ type: 'error', message: 'Seleccioná un punto de venta habilitado.' });
        return;
      }
      if (!activeCertificado) {
        setFeedback({ type: 'error', message: `No hay certificado activo para ambiente ${form.ambiente}.` });
        return;
      }
      setLoading(true);
      setFeedback(null);
      setValidationErrors({});
      try {
        const response = await requestJson(`/api/facturas/${facturaId}/emitir`, { method: 'POST' });
        const factura = (response as { data?: FacturaDetalleDto }).data;
        setFeedback({ type: 'success', message: response?.message ?? 'Factura emitida.' });
        if (factura?.id) {
          navigate(`/facturacion/facturas/${factura.id}`);
        }
      } catch (err) {
        const error = err as Error & { payload?: any };
        setFeedback({ type: 'error', message: error.message ?? 'No se pudo emitir.' });
        if (error.payload?.errors) {
          setValidationErrors(error.payload.errors);
        }
      } finally {
        setLoading(false);
      }
    };

    const handleClienteChange = (value: string) => {
      const cliente = clientes.find((item) => item.id === Number(value));
      const docDigits = (cliente?.documento_fiscal ?? '').replace(/\D+/g, '');
      setForm((prev) => ({
        ...prev,
        cliente_id: value,
        sucursal_id: '',
        cliente_nombre: cliente?.nombre ?? prev.cliente_nombre,
        doc_nro: prev.doc_nro || docDigits,
      }));
    };

    const handleSucursalChange = (value: string) => {
      const sucursal = sucursales.find((item) => item.id === Number(value));
      setForm((prev) => ({
        ...prev,
        sucursal_id: value,
        cliente_domicilio: sucursal?.direccion ?? prev.cliente_domicilio,
      }));
    };

    return (
      <FacturacionShell title="Nueva factura" subtitle="Alta de comprobantes ARCA">
        <section className="dashboard-card facturacion-section">
          {initialLoading ? <p className="form-info">Cargando datos iniciales...</p> : null}
          {!initialLoading && emisores.length === 0 ? (
            <p className="form-info form-info--warning">
              No hay emisores configurados. Creá uno en{' '}
              <NavLink to="/facturacion/configuracion-arca">Configuración ARCA</NavLink>.
            </p>
          ) : null}
          {selectedEmisor && !activeCertificado ? (
            <p className="form-info form-info--warning">
              El emisor seleccionado no tiene certificado activo para ambiente {form.ambiente}. Configuralo en{' '}
              <NavLink to="/facturacion/configuracion-arca">Configuración ARCA</NavLink>.
            </p>
          ) : null}
          {selectedEmisor && puntosVenta.length === 0 ? (
            <p className="form-info form-info--warning">
              No hay puntos de venta habilitados para ERP en ambiente {form.ambiente}. Sincronizá desde{' '}
              <NavLink to="/facturacion/configuracion-arca">Configuración ARCA</NavLink>.
            </p>
          ) : null}
          {selectedEmisor && puntosVenta.length > 0 && !hasDefaultPtoVta ? (
            <p className="form-info form-info--warning">
              El punto de venta 00011 no está disponible para este emisor. Verificá la sincronización en{' '}
              <NavLink to="/facturacion/configuracion-arca">Configuración ARCA</NavLink>.
            </p>
          ) : null}
          {form.cliente_id && sucursales.length === 0 ? (
            <p className="form-info form-info--warning">El cliente seleccionado no tiene sucursales configuradas.</p>
          ) : null}
          <div className="facturacion-form-grid">
            <div className="facturacion-form-block">
              <h3>Emisor / ARCA</h3>
              <div className="filters-grid facturacion-grid">
                <label className="input-control">
                  <span>Emisor</span>
                  <select value={form.emisor_id} onChange={(event) => setForm((prev) => ({ ...prev, emisor_id: event.target.value }))}>
                    <option value="">Seleccionar</option>
                    {emisores.map((emisor) => (
                      <option key={emisor.id} value={emisor.id}>
                        {emisor.razon_social}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="input-control">
                  <span>Ambiente</span>
                  <select value={form.ambiente} disabled>
                    <option value="PROD">PROD</option>
                  </select>
                </label>
                <label className="input-control">
                  <span>Punto de venta</span>
                  <select value={form.pto_vta} disabled>
                    {puntosVenta.length === 0 ? (
                      <option value={FACTURACION_DEFAULT_PTO_VTA}>{FACTURACION_DEFAULT_PTO_VTA.padStart(4, '0')}</option>
                    ) : (
                      puntosVenta.map((punto) => (
                        <option key={punto.id} value={punto.nro}>
                          {String(punto.nro).padStart(4, '0')} {punto.habilitado_para_erp ? '' : '(no ERP)'}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label className="input-control">
                  <span>Certificado activo</span>
                  <input type="text" value={activeCertificado ? activeCertificado.alias : 'Sin certificado activo'} disabled />
                </label>
              </div>
            </div>

            <div className="facturacion-form-block">
              <h3>Cliente / Receptor</h3>
              <div className="filters-grid facturacion-grid">
                <label className="input-control">
                  <span>Cliente</span>
                  <select value={form.cliente_id} onChange={(event) => handleClienteChange(event.target.value)}>
                    <option value="">Seleccionar</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nombre ?? `Cliente #${cliente.id}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="input-control">
                  <span>Sucursal</span>
                  <select value={form.sucursal_id} onChange={(event) => handleSucursalChange(event.target.value)} disabled={!form.cliente_id}>
                    <option value="">Seleccionar</option>
                    {sucursales.map((sucursal) => (
                      <option key={sucursal.id} value={sucursal.id}>
                        {sucursal.nombre ?? `Sucursal #${sucursal.id}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="input-control">
                  <span>CUIT receptor</span>
                  <input value={form.doc_nro} onChange={(event) => setForm((prev) => ({ ...prev, doc_nro: event.target.value }))} />
                </label>
                <label className="input-control">
                  <span>Tipo doc</span>
                  <select value={form.doc_tipo} onChange={(event) => setForm((prev) => ({ ...prev, doc_tipo: event.target.value }))}>
                    <option value="80">CUIT (80)</option>
                    <option value="96">DNI (96)</option>
                    <option value="99">Consumidor final (99)</option>
                  </select>
                </label>
                <label className="input-control">
                  <span>Razón social</span>
                  <input value={form.cliente_nombre} onChange={(event) => setForm((prev) => ({ ...prev, cliente_nombre: event.target.value }))} />
                </label>
                <label className="input-control">
                  <span>Domicilio</span>
                  <input value={form.cliente_domicilio} onChange={(event) => setForm((prev) => ({ ...prev, cliente_domicilio: event.target.value }))} />
                </label>
              </div>
            </div>

            <div className="facturacion-form-block">
              <h3>Comprobante</h3>
              <div className="filters-grid facturacion-grid">
                <label className="input-control">
                  <span>Tipo comprobante</span>
                  <select value={form.cbte_tipo} onChange={(event) => setForm((prev) => ({ ...prev, cbte_tipo: event.target.value }))}>
                    {FACTURACION_COMPROBANTES_OPTIONS.map((option) => (
                      <option key={option.code} value={Number(option.code)}>
                        {option.code} - {option.description}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="input-control">
                  <span>Concepto</span>
                  <select value={form.concepto} onChange={(event) => setForm((prev) => ({ ...prev, concepto: event.target.value }))}>
                    <option value="1">Productos</option>
                    <option value="2">Servicios</option>
                    <option value="3">Productos y servicios</option>
                  </select>
                </label>
                <label className="input-control">
                  <span>Fecha comprobante</span>
                  <input type="date" value={form.fecha_cbte} onChange={(event) => setForm((prev) => ({ ...prev, fecha_cbte: event.target.value }))} />
                </label>
                <label className="input-control">
                  <span>Fecha serv. desde</span>
                  <input type="date" value={form.fecha_serv_desde} onChange={(event) => setForm((prev) => ({ ...prev, fecha_serv_desde: event.target.value }))} />
                </label>
                <label className="input-control">
                  <span>Fecha serv. hasta</span>
                  <input type="date" value={form.fecha_serv_hasta} onChange={(event) => setForm((prev) => ({ ...prev, fecha_serv_hasta: event.target.value }))} />
                </label>
                <label className="input-control">
                  <span>Fecha vto. pago</span>
                  <input type="date" value={form.fecha_vto_pago} onChange={(event) => setForm((prev) => ({ ...prev, fecha_vto_pago: event.target.value }))} />
                </label>
              </div>
            </div>

            <div className="facturacion-form-block">
              <h3>Período comercial</h3>
              <div className="filters-grid facturacion-grid">
                <label className="input-control">
                  <span>Año</span>
                  <input type="number" value={form.anio_facturado} onChange={(event) => setForm((prev) => ({ ...prev, anio_facturado: event.target.value }))} />
                </label>
                <label className="input-control">
                  <span>Mes</span>
                  <select value={form.mes_facturado} onChange={(event) => setForm((prev) => ({ ...prev, mes_facturado: event.target.value }))}>
                    {TARIFA_MONTH_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="input-control">
                  <span>Período</span>
                  <select
                    value={form.periodo_facturado}
                    onChange={(event) => setForm((prev) => ({ ...prev, periodo_facturado: event.target.value }))}
                  >
                    {FACTURACION_PERIODOS.map((periodo) => (
                      <option key={periodo.value} value={periodo.value}>
                        {periodo.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="input-control">
                  <span>Fecha aprox. cobro</span>
                  <input
                    type="date"
                    value={form.fecha_aprox_cobro}
                    onChange={(event) => setForm((prev) => ({ ...prev, fecha_aprox_cobro: event.target.value }))}
                  />
                </label>
              </div>
            </div>

            <div className="facturacion-form-block">
              <h3>Importes</h3>
              <div className="filters-grid facturacion-grid">
                <label className="input-control">
                  <span>Moneda</span>
                  <input value={form.moneda_id} onChange={(event) => setForm((prev) => ({ ...prev, moneda_id: event.target.value }))} />
                </label>
                <label className="input-control">
                  <span>Cotización</span>
                  <input value={form.moneda_cotiz} onChange={(event) => setForm((prev) => ({ ...prev, moneda_cotiz: event.target.value }))} />
                </label>
                <label className="input-control">
                  <span>No gravado</span>
                  <input
                    value={form.imp_tot_conc}
                    onChange={(event) => setForm((prev) => ({ ...prev, imp_tot_conc: event.target.value }))}
                    disabled={autoImportesDesdeDetalle}
                  />
                </label>
                <label className="input-control">
                  <span>Neto gravado</span>
                  <input
                    value={form.imp_neto}
                    onChange={(event) => setForm((prev) => ({ ...prev, imp_neto: event.target.value }))}
                    disabled={autoImportesDesdeDetalle}
                  />
                </label>
                <label className="input-control">
                  <span>Exento</span>
                  <input
                    value={form.imp_op_ex}
                    onChange={(event) => setForm((prev) => ({ ...prev, imp_op_ex: event.target.value }))}
                    disabled={autoImportesDesdeDetalle}
                  />
                </label>
                <label className="input-control">
                  <span>IVA</span>
                  <input
                    value={form.imp_iva}
                    onChange={(event) => setForm((prev) => ({ ...prev, imp_iva: event.target.value }))}
                    disabled={autoImportesDesdeDetalle}
                  />
                </label>
                <label className="input-control">
                  <span>Tributos</span>
                  <input value={form.imp_trib} onChange={(event) => setForm((prev) => ({ ...prev, imp_trib: event.target.value }))} />
                </label>
                <label className="input-control">
                  <span>Total</span>
                  <input
                    value={form.imp_total}
                    onChange={(event) => setForm((prev) => ({ ...prev, imp_total: event.target.value }))}
                    disabled={autoImportesDesdeDetalle}
                  />
                </label>
                <label className="input-control facturacion-toggle">
                  <span>Auto total</span>
                  <input type="checkbox" checked={autoTotal} onChange={(event) => setAutoTotal(event.target.checked)} />
                </label>
                <label className="input-control facturacion-toggle">
                  <span>Auto importes (detalle)</span>
                  <input
                    type="checkbox"
                    checked={autoImportesDesdeDetalle}
                    onChange={(event) => setAutoImportesDesdeDetalle(event.target.checked)}
                  />
                </label>
              </div>
            </div>

            <div className="facturacion-form-block">
              <h3>Condiciones de venta</h3>
              <div className="filters-grid facturacion-grid">
                {FACTURACION_CONDICIONES_VENTA.map((option) => (
                  <label key={option.value} className="input-control facturacion-toggle">
                    <span>{option.label}</span>
                    <input
                      type="checkbox"
                      checked={form.condiciones_venta.includes(option.value)}
                      onChange={() => toggleCondicionVenta(option.value)}
                    />
                  </label>
                ))}
              </div>
            </div>

            {requiereCbtesAsoc ? (
              <div className="facturacion-form-block">
                <h3>Comprobantes asociados</h3>
                <p className="form-info">
                  Para notas de crédito/débito es obligatorio asociar el comprobante original (Tipo, Punto de venta y Número).
                </p>
                <div className="form-actions">
                  <button type="button" className="secondary-action" onClick={loadFacturasAsociables} disabled={asociablesLoading}>
                    {asociablesLoading ? 'Buscando...' : 'Buscar facturas emitidas'}
                  </button>
                </div>
                <div className="table-wrapper facturacion-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Factura emitida</th>
                        <th>Tipo</th>
                        <th>Pto Vta</th>
                        <th>Comprobante</th>
                        <th>Fecha emisión (opc.)</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cbtesAsoc.length === 0 ? (
                        <tr>
                          <td colSpan={6}>Agregá al menos un comprobante asociado.</td>
                        </tr>
                      ) : (
                        cbtesAsoc.map((row, index) => {
                          const matched =
                            facturasAsociables.find(
                              (item) =>
                                item.cbte_tipo === Number(row.cbte_tipo) &&
                                item.pto_vta === Number(row.pto_vta) &&
                                Number(item.cbte_numero ?? 0) === Number(row.cbte_numero || 0)
                            ) ?? null;
                          return (
                            <tr key={row.id}>
                              <td>
                                <select
                                  value={matched ? String(matched.id) : ''}
                                  onChange={(event) => {
                                    const selectedId = Number(event.target.value);
                                    const picked = facturasAsociables.find((item) => item.id === selectedId);
                                    if (!picked) {
                                      return;
                                    }
                                    setCbtesAsoc((prev) => {
                                      const next = [...prev];
                                      next[index] = {
                                        ...row,
                                        cbte_tipo: String(picked.cbte_tipo),
                                        pto_vta: String(picked.pto_vta),
                                        cbte_numero: String(picked.cbte_numero ?? ''),
                                        fecha_emision: picked.fecha_cbte ?? row.fecha_emision,
                                      };
                                      return next;
                                    });
                                  }}
                                >
                                  <option value="">Seleccionar...</option>
                                  {facturasAsociables.map((item) => {
                                    const desc =
                                      FACTURACION_COMPROBANTES_OPTIONS.find((opt) => Number(opt.code) === item.cbte_tipo)
                                        ?.description ?? `Cbte ${item.cbte_tipo}`;
                                    const nro = item.cbte_numero ? String(item.cbte_numero).padStart(8, '0') : '—';
                                    const pv = String(item.pto_vta).padStart(4, '0');
                                    const fecha = item.fecha_cbte ?? '';
                                    return (
                                      <option key={item.id} value={item.id}>
                                        {desc} {pv}-{nro} {fecha}
                                      </option>
                                    );
                                  })}
                                </select>
                              </td>
                              <td>
                                <select
                                  value={row.cbte_tipo}
                                  onChange={(event) =>
                                    setCbtesAsoc((prev) => {
                                      const next = [...prev];
                                      next[index] = { ...row, cbte_tipo: event.target.value };
                                      return next;
                                    })
                                  }
                                >
                                  {FACTURACION_CBTE_ASOC_OPTIONS.map((option) => (
                                    <option key={option.code} value={Number(option.code)}>
                                      {option.code} - {option.description}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  value={row.pto_vta}
                                  onChange={(event) =>
                                    setCbtesAsoc((prev) => {
                                      const next = [...prev];
                                      next[index] = { ...row, pto_vta: event.target.value };
                                      return next;
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  value={row.cbte_numero}
                                  onChange={(event) =>
                                    setCbtesAsoc((prev) => {
                                      const next = [...prev];
                                      next[index] = { ...row, cbte_numero: event.target.value };
                                      return next;
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="date"
                                  value={row.fecha_emision}
                                  onChange={(event) =>
                                    setCbtesAsoc((prev) => {
                                      const next = [...prev];
                                      next[index] = { ...row, fecha_emision: event.target.value };
                                      return next;
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="secondary-action secondary-action--ghost"
                                  onClick={() => setCbtesAsoc((prev) => prev.filter((item) => item.id !== row.id))}
                                >
                                  Quitar
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <button type="button" className="secondary-action" onClick={() => setCbtesAsoc((prev) => [...prev, createCbteAsocRow()])}>
                  Agregar comprobante
                </button>
              </div>
            ) : null}

            <div className="facturacion-form-block">
              <h3>Detalle PDF</h3>
              <div className="table-wrapper facturacion-table">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Descripción</th>
                      <th>Cantidad</th>
                      <th>Unidad</th>
                      <th>Precio</th>
                      <th>Bonif %</th>
                      <th>Subtotal</th>
                      <th>IVA %</th>
                      <th>Subtotal c/IVA</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detallePdf.map((row, index) => (
                      <tr key={row.id}>
                        <td>
                          <input
                            value={row.orden}
                            onChange={(event) => handleDetalleChange(index, 'orden', event.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            value={row.descripcion}
                            onChange={(event) => handleDetalleChange(index, 'descripcion', event.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            value={row.cantidad}
                            onChange={(event) => handleDetalleChange(index, 'cantidad', event.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            value={row.unidad_medida}
                            onChange={(event) => handleDetalleChange(index, 'unidad_medida', event.target.value)}
                          >
                            {unidadMedidaOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            value={row.precio_unitario}
                            onChange={(event) => handleDetalleChange(index, 'precio_unitario', event.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            value={row.bonificacion_pct}
                            onChange={(event) => handleDetalleChange(index, 'bonificacion_pct', event.target.value)}
                          />
                        </td>
                        <td>
                          <input value={row.subtotal} disabled />
                        </td>
                        <td>
                          <select
                            value={row.alicuota_iva_pct}
                            onChange={(event) => handleDetalleChange(index, 'alicuota_iva_pct', event.target.value)}
                          >
                            {FACTURACION_ALICUOTA_PCT_OPTIONS.map((option, optIndex) => (
                              <option key={`${option.value}-${option.label}-${optIndex}`} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input value={row.subtotal_con_iva} disabled />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="secondary-action secondary-action--ghost"
                            onClick={() => setDetallePdf((prev) => prev.filter((item) => item.id !== row.id))}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="secondary-action"
                onClick={() => setDetallePdf((prev) => [...prev, createFacturaDetalleRow(prev.length + 1)])}
              >
                Agregar ítem
              </button>
            </div>

            <div className="facturacion-form-block">
              <h3>IVA detalle</h3>
              <div className="table-wrapper facturacion-table">
                <table>
                  <thead>
                    <tr>
                      <th>IVA ID</th>
                      <th>Base imponible</th>
                      <th>Importe</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ivaItems.length === 0 ? (
                      <tr>
                        <td colSpan={4}>No hay IVA cargado.</td>
                      </tr>
                    ) : (
                      ivaItems.map((row, index) => (
                        <tr key={row.id}>
                          <td>
                            <input
                              value={row.iva_id}
                              onChange={(event) =>
                                setIvaItems((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...row, iva_id: event.target.value, auto: false };
                                  return next;
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={row.base_imp}
                              onChange={(event) =>
                                setIvaItems((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...row, base_imp: event.target.value, auto: false };
                                  return next;
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={row.importe}
                              onChange={(event) =>
                                setIvaItems((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...row, importe: event.target.value, auto: false };
                                  return next;
                                })
                              }
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="secondary-action secondary-action--ghost"
                              onClick={() => setIvaItems((prev) => prev.filter((item) => item.id !== row.id))}
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <button type="button" className="secondary-action" onClick={() => setIvaItems((prev) => [...prev, createFacturaIvaRow()])}>
                Agregar IVA
              </button>
            </div>

            <div className="facturacion-form-block">
              <h3>Tributos</h3>
              <div className="table-wrapper facturacion-table">
                <table>
                  <thead>
                    <tr>
                      <th>Tributo ID</th>
                      <th>Descripción</th>
                      <th>Base</th>
                      <th>Alic %</th>
                      <th>Importe</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tributos.length === 0 ? (
                      <tr>
                        <td colSpan={6}>No hay tributos cargados.</td>
                      </tr>
                    ) : (
                      tributos.map((row, index) => (
                        <tr key={row.id}>
                          <td>
                            <input
                              value={row.tributo_id}
                              onChange={(event) =>
                                setTributos((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...row, tributo_id: event.target.value };
                                  return next;
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={row.descr}
                              onChange={(event) =>
                                setTributos((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...row, descr: event.target.value };
                                  return next;
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={row.base_imp}
                              onChange={(event) =>
                                setTributos((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...row, base_imp: event.target.value };
                                  return next;
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={row.alic}
                              onChange={(event) =>
                                setTributos((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...row, alic: event.target.value };
                                  return next;
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={row.importe}
                              onChange={(event) =>
                                setTributos((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...row, importe: event.target.value };
                                  return next;
                                })
                              }
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="secondary-action secondary-action--ghost"
                              onClick={() => setTributos((prev) => prev.filter((item) => item.id !== row.id))}
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <button type="button" className="secondary-action" onClick={() => setTributos((prev) => [...prev, createFacturaTributoRow()])}>
                Agregar tributo
              </button>
            </div>

            <div className="facturacion-form-block">
              <h3>Cobranza</h3>
              <div className="filters-grid facturacion-grid">
                <label className="input-control">
                  <span>Fecha pago manual</span>
                  <input type="date" value={form.fecha_pago_manual} onChange={(event) => setForm((prev) => ({ ...prev, fecha_pago_manual: event.target.value }))} />
                </label>
                <label className="input-control">
                  <span>Monto pago manual</span>
                  <input value={form.monto_pagado_manual} onChange={(event) => setForm((prev) => ({ ...prev, monto_pagado_manual: event.target.value }))} />
                </label>
                <label className="input-control">
                  <span>Observaciones</span>
                  <input value={form.observaciones_cobranza} onChange={(event) => setForm((prev) => ({ ...prev, observaciones_cobranza: event.target.value }))} />
                </label>
              </div>
            </div>
          </div>

          {feedback ? (
            <p className={`form-info ${feedback.type === 'error' ? 'form-info--error' : 'form-info--success'}`}>
              {feedback.message}
            </p>
          ) : null}
          {Object.keys(validationErrors).length > 0 ? (
            <div className="form-info form-info--error">
              {Object.entries(validationErrors).map(([field, messages]) => (
                <p key={field}>
                  {field}: {Array.isArray(messages) ? messages.join(', ') : String(messages)}
                </p>
              ))}
            </div>
          ) : null}

          <div className="form-actions">
            <button type="button" className="primary-action" onClick={handleSaveDraft} disabled={loading}>
              Guardar borrador
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                const params = new URLSearchParams();
                if (form.cliente_id) params.set('cliente_id', form.cliente_id);
                if (form.sucursal_id) params.set('sucursal_id', form.sucursal_id);
                if (form.anio_facturado) params.set('anio', form.anio_facturado);
                if (form.mes_facturado) params.set('mes', form.mes_facturado);
                if (form.periodo_facturado) params.set('periodo', form.periodo_facturado);
                navigate(`/liquidaciones/cliente?${params.toString()}`);
              }}
              disabled={!form.cliente_id}
            >
              Ver estado de cuenta
            </button>
            <button type="button" className="secondary-action" onClick={handleValidate} disabled={loading || !facturaId}>
              Validar
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={handleEmit}
              disabled={loading || !facturaId || !form.emisor_id || !form.pto_vta || !activeCertificado}
            >
              Emitir ARCA
            </button>
          </div>
        </section>
      </FacturacionShell>
    );
  };

  return FacturacionCreatePage;
};
