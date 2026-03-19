import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { downloadCsv } from '../lib/csv';
import { loadTransportistasFromCache, persistTransportistasToCache } from '../features/reclamos/storage';
import type {
  ReclamoDetail,
  ReclamoDocumentItem,
  ReclamoHistoryItem,
  ReclamoMeta,
  ReclamoTransportistaSummary,
} from '../features/reclamos/types';
import { formatCurrency, formatReclamoTipoLabel } from '../features/reclamos/utils';

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  layoutVariant?: 'default' | 'panel';
  monitorView?: boolean;
};

type AuthUser = {
  id: number;
  name: string | null;
  email: string | null;
  role?: string | null;
  token?: string | null;
  permissions?: string[] | null;
};

type ReclamoDetallePageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  buildActorHeaders: (authUser: AuthUser | null | undefined) => Record<string, string>;
  PERSON_TAX_ID_LABEL: string;
};

export const ReclamoDetallePage: React.FC<ReclamoDetallePageProps> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  buildActorHeaders,
  PERSON_TAX_ID_LABEL,
}) => {
  const { reclamoId } = useParams<{ reclamoId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { transportistas?: ReclamoTransportistaSummary[] } | undefined;
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const authUser = useStoredAuthUser();
  const actorHeaders = useMemo(() => buildActorHeaders(authUser), [authUser, buildActorHeaders]);
  const canViewReclamoImportes = true;
  const [detail, setDetail] = useState<ReclamoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ReclamoMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState({
    agenteId: '',
    clienteNombre: '',
    status: '',
    pagado: 'false',
    fechaReclamo: '',
    detalle: '',
    importePagado: '',
    importeFacturado: '',
    fechaCompromisoPago: '',
    aprobacionEstado: '',
    aprobacionMotivo: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentInfo, setCommentInfo] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSaving, setCommentSaving] = useState(false);
  const fileUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentDeletingId, setDocumentDeletingId] = useState<number | null>(null);
  const [documentMessage, setDocumentMessage] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const transportistaInfo = detail?.transportistaDetail;
  const isReclamoAdelanto = Boolean(detail?.isReclamoAdelanto);
  const isReclamoLocked = Boolean(detail?.enRevision);
  const clienteOptions = useMemo(() => {
    const names = new Set<string>();
    (meta?.clientes ?? []).forEach((cliente) => {
      const normalized = (cliente.nombre ?? '').trim();
      if (normalized) {
        names.add(normalized);
      }
    });
    const fromDetail = (detail?.clienteNombre ?? detail?.cliente ?? '').trim();
    if (fromDetail) {
      names.add(fromDetail);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [meta?.clientes, detail?.clienteNombre, detail?.cliente]);
  const responsableClienteValue = useMemo(() => {
    if (formValues.agenteId) {
      return `agente:${formValues.agenteId}`;
    }
    const cliente = formValues.clienteNombre.trim();
    if (cliente) {
      return `cliente:${cliente}`;
    }
    return '';
  }, [formValues.agenteId, formValues.clienteNombre]);
  const initialTransportistasRef = useRef<ReclamoTransportistaSummary[] | undefined>(locationState?.transportistas);

  const shouldRefreshFormRef = useRef(true);

  const applyDetail = useCallback(
    (data: ReclamoDetail, options?: { refreshForm?: boolean }) => {
      if (options && Object.prototype.hasOwnProperty.call(options, 'refreshForm')) {
        shouldRefreshFormRef.current = !!options.refreshForm;
      } else {
        shouldRefreshFormRef.current = true;
      }
      const apiTransportistas = Array.isArray(data.transportistas) ? data.transportistas : [];
      const fallbackFromState =
        initialTransportistasRef.current && initialTransportistasRef.current.length > 0 ? initialTransportistasRef.current : [];
      const cachedTransportistas = data.id != null ? loadTransportistasFromCache(data.id) ?? [] : [];

      const normalizedTransportistas: ReclamoTransportistaSummary[] = (() => {
        let candidate = apiTransportistas;

        if (fallbackFromState.length > candidate.length) {
          candidate = fallbackFromState;
        }

        if (cachedTransportistas.length > candidate.length) {
          candidate = cachedTransportistas;
        }

        return candidate;
      })();

      initialTransportistasRef.current = undefined;
      if (data.id != null) {
        persistTransportistasToCache(data.id, normalizedTransportistas);
      }

      setDetail({
        ...data,
        transportistas: normalizedTransportistas,
        documents: data.documents ?? [],
      });
    },
    [initialTransportistasRef]
  );

  useEffect(() => {
    if (!reclamoId) {
      setLoadError('Identificador de reclamo inválido.');
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchDetail = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const response = await fetch(`${apiBaseUrl}/api/reclamos/${reclamoId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: ReclamoDetail };

        if (!payload?.data) {
          throw new Error('Formato de respuesta inesperado');
        }

        applyDetail(payload.data);
        setSaveSuccess(null);
        setSaveError(null);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }

        setLoadError((err as Error).message ?? 'No se pudo cargar el reclamo.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();

    return () => controller.abort();
  }, [reclamoId, apiBaseUrl, applyDetail]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchMeta = async () => {
      try {
        setMetaLoading(true);
        setMetaError(null);

        const response = await fetch(`${apiBaseUrl}/api/reclamos/meta`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: ReclamoMeta };
        if (!payload?.data) {
          throw new Error('Formato de respuesta inesperado');
        }

        setMeta(payload.data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }

        setMetaError((err as Error).message ?? 'No se pudieron cargar las opciones.');
      } finally {
        setMetaLoading(false);
      }
    };

    fetchMeta();

    return () => controller.abort();
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!detail) {
      return;
    }

    if (!shouldRefreshFormRef.current) {
      return;
    }

    const fallbackStatus = detail.status ?? meta?.estados[0]?.value ?? '';
    setFormValues({
      agenteId: detail.agenteId ? String(detail.agenteId) : '',
      clienteNombre: detail.clienteNombre ?? detail.cliente ?? '',
      status: fallbackStatus,
      pagado: detail.pagado ? 'true' : 'false',
      fechaReclamo: detail.fechaReclamo ?? '',
      detalle: detail.detalle ?? '',
      importePagado: detail.pagado ? detail.importePagado ?? '' : '',
      importeFacturado: detail.importeFacturado ?? '',
      fechaCompromisoPago: detail.fechaCompromisoPago ?? '',
      aprobacionEstado: detail.aprobacionEstado ?? '',
      aprobacionMotivo: detail.aprobacionMotivo ?? '',
    });
    shouldRefreshFormRef.current = false;
  }, [detail, meta]);

  const handleResetForm = () => {
    if (!detail) {
      return;
    }

    setFormValues({
      agenteId: detail.agenteId ? String(detail.agenteId) : '',
      clienteNombre: detail.clienteNombre ?? detail.cliente ?? '',
      status: detail.status ?? '',
      pagado: detail.pagado ? 'true' : 'false',
      fechaReclamo: detail.fechaReclamo ?? '',
      detalle: detail.detalle ?? '',
      importePagado: detail.pagado ? detail.importePagado ?? '' : '',
      importeFacturado: detail.importeFacturado ?? '',
      fechaCompromisoPago: detail.fechaCompromisoPago ?? '',
      aprobacionEstado: detail.aprobacionEstado ?? '',
      aprobacionMotivo: detail.aprobacionMotivo ?? '',
    });
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!detail || !reclamoId) {
      return;
    }

    if (detail.enRevision) {
      setSaveError('Este reclamo está marcado en checklist. Desmarcalo en el listado para poder editarlo.');
      return;
    }

    const targetStatus = formValues.status || detail.status || meta?.estados[0]?.value || '';

    if (!targetStatus) {
      setSaveError('Selecciona un estado para el reclamo.');
      return;
    }

    let normalizedImporte: number | null = null;
    if (formValues.pagado === 'true' && canViewReclamoImportes) {
      const trimmedImporte = formValues.importePagado.trim();
      if (!trimmedImporte) {
        setSaveError('Ingresa el importe pagado.');
        return;
      }

      const parsed = Number(trimmedImporte.replace(',', '.'));
      if (Number.isNaN(parsed)) {
        setSaveError('Ingresa un importe pagado válido.');
        return;
      }

      if (parsed < 0) {
        setSaveError('El importe pagado debe ser mayor o igual a 0.');
        return;
      }

      normalizedImporte = Number(parsed.toFixed(2));
    }

    const isFinalizado = (formValues.status || detail.status || '').trim().toLowerCase() === 'finalizado';
    const canEditFacturado = isFinalizado && canViewReclamoImportes;

    let normalizedImporteFacturado: number | null | undefined = undefined;
    if (canEditFacturado) {
      normalizedImporteFacturado = null;
      if (formValues.importeFacturado.trim()) {
        const parsedFact = Number(formValues.importeFacturado.replace(',', '.'));
        if (Number.isNaN(parsedFact) || parsedFact < 0) {
          setSaveError('Ingresa un importe facturado válido (mayor o igual a 0).');
          return;
        }
        normalizedImporteFacturado = Number(parsedFact.toFixed(2));
      }
    }

    if (isReclamoAdelanto && formValues.aprobacionEstado === 'no_aprobado' && !formValues.aprobacionMotivo.trim()) {
      setSaveError('Ingresa un motivo cuando la aprobación es "No aprobado".');
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(null);

      const requestInit: RequestInit = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...actorHeaders,
        },
        body: JSON.stringify({
          detalle: formValues.detalle.trim() || null,
          agenteId: formValues.agenteId ? Number(formValues.agenteId) : null,
          creatorId: detail.creatorId,
          transportistaId: detail.transportistaId,
          tipoId: detail.tipoId,
          status: targetStatus,
          pagado: formValues.pagado === 'true',
          ...(canViewReclamoImportes ? { importePagado: normalizedImporte } : {}),
          ...(normalizedImporteFacturado !== undefined ? { importeFacturado: normalizedImporteFacturado } : {}),
          fechaReclamo: formValues.fechaReclamo || null,
          clienteNombre: formValues.clienteNombre.trim() || null,
          sucursalNombre: detail.sucursalNombre ?? null,
          distribuidorNombre: detail.distribuidorNombre ?? null,
          emisorFactura: detail.emisorFactura ?? null,
          importeSolicitado: detail.importeSolicitado ?? null,
          cuitCobrador: detail.cuitCobrador ?? null,
          medioPago: detail.medioPago ?? null,
          concepto: detail.concepto ?? null,
          fechaCompromisoPago: formValues.fechaCompromisoPago || null,
          aprobacionEstado: formValues.aprobacionEstado || null,
          aprobacionMotivo: formValues.aprobacionMotivo.trim() || null,
        }),
      };

      let response = await fetch(`${apiBaseUrl}/api/reclamos/${reclamoId}`, requestInit);
      if (response.status === 405) {
        response = await fetch(`${apiBaseUrl}/api/reclamos/${reclamoId}`, {
          ...requestInit,
          method: 'POST',
        });
      }

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;

        try {
          const payload = await response.json();
          if (typeof payload?.message === 'string') {
            message = payload.message;
          } else if (payload?.errors) {
            const firstError = Object.values(payload.errors)[0];
            if (Array.isArray(firstError) && firstError[0]) {
              message = firstError[0] as string;
            }
          }
        } catch {
          // ignore
        }

        throw new Error(message);
      }

      const payload = (await response.json()) as { message?: string; data: ReclamoDetail };

      applyDetail(payload.data);
      setSaveSuccess(payload.message ?? 'Reclamo actualizado correctamente.');
      window.dispatchEvent(new CustomEvent('notifications:updated'));
    } catch (err) {
      setSaveError((err as Error).message ?? 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const handleDocumentButtonClick = () => {
    setDocumentError(null);
    setDocumentMessage(null);
    fileUploadInputRef.current?.click();
  };

  const handleDocumentChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!reclamoId || !detail) {
      return;
    }

    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) {
      return;
    }

    try {
      setDocumentUploading(true);
      setDocumentError(null);
      setDocumentMessage(null);

      const formData = new FormData();
      files.forEach((file) => {
        formData.append('archivos[]', file);
        formData.append('nombres[]', file.name);
      });
      const actorId = detail.agenteId ?? detail.creatorId;
      if (actorId) {
        formData.append('creatorId', String(actorId));
      }

      const response = await fetch(`${apiBaseUrl}/api/reclamos/${reclamoId}/documentos`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = await response.json();
          if (typeof payload?.message === 'string') {
            message = payload.message;
          } else if (payload?.errors) {
            const firstError = Object.values(payload.errors)[0];
            if (Array.isArray(firstError) && firstError[0]) {
              message = firstError[0] as string;
            }
          }
        } catch {
          // ignore
        }

        throw new Error(message);
      }

      const payload = (await response.json()) as { message?: string; data: ReclamoDetail };
      applyDetail(payload.data, { refreshForm: false });
      const successMessage =
        payload.message ??
        (files.length === 1 ? 'Documento cargado correctamente.' : 'Documentos cargados correctamente.');
      setDocumentMessage(successMessage);
    } catch (err) {
      setDocumentError((err as Error).message ?? 'No se pudo subir el documento.');
    } finally {
      setDocumentUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleDocumentDownload = useCallback(
    async (doc: ReclamoDocumentItem) => {
      if (!reclamoId) {
        window.alert('Identificador de reclamo inválido.');
        return;
      }

      try {
        setDocumentError(null);

        const downloadEndpoint = `${apiBaseUrl}/api/reclamos/${reclamoId}/documentos/${doc.id}/descargar`;
        const response = await fetch(downloadEndpoint, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}`);
        }

        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = doc.nombre ?? `documento-${doc.id ?? 'reclamo'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error descargando documento', err);
        try {
          window.open(`${apiBaseUrl}/api/reclamos/${reclamoId}/documentos/${doc.id}/descargar`, '_blank', 'noopener');
        } catch {
          // ignore if the fallback cannot be opened
        }
        setDocumentError('No se pudo descargar el documento. Inténtalo nuevamente.');
      }
    },
    [apiBaseUrl, reclamoId, setDocumentError]
  );

  const handleDocumentDelete = useCallback(
    async (doc: ReclamoDocumentItem) => {
      if (!reclamoId || !detail) {
        return;
      }

      const confirmed = window.confirm('¿Seguro que deseas eliminar este documento?');
      if (!confirmed) {
        return;
      }

      try {
        setDocumentError(null);
        setDocumentMessage(null);
        setDocumentDeletingId(doc.id ?? null);

        const actorId = detail.agenteId ?? detail.creatorId;
        const response = await fetch(`${apiBaseUrl}/api/reclamos/${reclamoId}/documentos/${doc.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(actorId ? { creatorId: actorId } : {}),
        });

        if (!response.ok) {
          let message = `Error ${response.status}: ${response.statusText}`;
          try {
            const payload = await response.json();
            if (typeof payload?.message === 'string') {
              message = payload.message;
            }
          } catch {
            // ignore
          }
          throw new Error(message);
        }

        const payload = (await response.json()) as { message?: string; data: ReclamoDetail };
        applyDetail(payload.data, { refreshForm: false });
        setDocumentMessage(payload.message ?? 'Documento eliminado correctamente.');
      } catch (err) {
        setDocumentError((err as Error).message ?? 'No se pudo eliminar el documento.');
      } finally {
        setDocumentDeletingId(null);
      }
    },
    [apiBaseUrl, reclamoId, detail, applyDetail]
  );

  const handleCommentSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!reclamoId || !detail) {
      return;
    }

    const trimmed = commentText.trim();
    if (trimmed.length === 0) {
      setCommentError('Ingresa un comentario para enviarlo.');
      return;
    }

    try {
      setCommentSaving(true);
      setCommentError(null);
      setCommentInfo(null);

      const response = await fetch(`${apiBaseUrl}/api/reclamos/${reclamoId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmed,
          creatorId: detail.agenteId ?? detail.creatorId ?? null,
        }),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = await response.json();
          if (typeof payload?.message === 'string') {
            message = payload.message;
          } else if (payload?.errors) {
            const firstError = Object.values(payload.errors)[0];
            if (Array.isArray(firstError) && firstError[0]) {
              message = firstError[0] as string;
            }
          }
        } catch {
          // ignore
        }

        throw new Error(message);
      }

      const payload = (await response.json()) as { message?: string; data: ReclamoDetail };
      applyDetail(payload.data, { refreshForm: false });
      setCommentText('');
      setCommentInfo(payload.message ?? 'Comentario agregado correctamente.');
    } catch (err) {
      setCommentError((err as Error).message ?? 'No se pudo agregar el comentario.');
    } finally {
      setCommentSaving(false);
    }
  };

  const handleExportTransportista = useCallback(() => {
    if (!detail) {
      return;
    }

    const info = detail.transportistaDetail;
    const rows = [
      ['Campo', 'Valor'],
      ['ID transportista', info?.id ?? detail.transportistaId ?? ''],
      ['Nombre completo', info?.nombreCompleto ?? detail.transportista ?? ''],
      [PERSON_TAX_ID_LABEL, info?.cuil ?? ''],
      ['Cliente', info?.cliente ?? detail.cliente ?? ''],
      ['Sucursal', info?.sucursal ?? ''],
      ['Unidad', info?.unidadDetalle ?? info?.unidad ?? ''],
      ['Patente', info?.patente ?? ''],
      ['Agente del alta', detail.creator ?? info?.agente ?? ''],
      ['Responsable actual', detail.agente ?? ''],
      ['Pagado', detail.pagado ? 'Sí' : 'No'],
      ...(canViewReclamoImportes
        ? ([
            ['Importe pagado', detail.pagado ? detail.importePagadoLabel ?? formatCurrency(detail.importePagado) : ''],
            [
              'Importe facturado',
              detail.importeFacturadoLabel ?? (detail.importeFacturado ? formatCurrency(detail.importeFacturado) : ''),
            ],
          ] as Array<[string, string]>)
        : []),
      ['Fecha del alta', info?.fechaAlta ?? ''],
      ['Fecha del reclamo', detail.fechaReclamo ?? ''],
      ['Fecha compromiso pago', detail.fechaCompromisoPago ?? ''],
      ['Aprobación', detail.aprobacionEstadoLabel ?? ''],
      ['Motivo aprobación', detail.aprobacionMotivo ?? ''],
      ['Cliente (sector)', detail.clienteNombre ?? ''],
      ['Sucursal (sector)', detail.sucursalNombre ?? ''],
      ['Nombre distribuidor', detail.distribuidorNombre ?? ''],
      ['Dueño / emisor factura', detail.emisorFactura ?? ''],
      ['Importe solicitado', detail.importeSolicitadoLabel ?? detail.importeSolicitado ?? ''],
      ['CUIT cobrador', detail.cuitCobrador ?? ''],
      ['Medio de pago', detail.medioPago ?? ''],
      ['Concepto', detail.concepto ?? ''],
      ['Teléfono', info?.telefono ?? ''],
      ['Email', info?.email ?? ''],
    ];

    const filename = `transportista-${detail.transportistaId ?? detail.id ?? 'reclamo'}.csv`;
    downloadCsv(filename, rows);
  }, [PERSON_TAX_ID_LABEL, canViewReclamoImportes, detail]);

  const renderReadOnlyField = (label: string, value: string | null) => (
    <label className="input-control">
      <span>{label}</span>
      <input type="text" value={value ?? ''} placeholder="—" readOnly />
    </label>
  );

  const renderHistoryItem = (item: ReclamoHistoryItem) => {
    if (item.type === 'status_change') {
      return (
        <div key={item.id} className="reclamo-history-item reclamo-history-item--status">
          <div>
            <strong>{item.actor ?? 'Sistema'}</strong>
            <p>{item.message}</p>
          </div>
          <span className="reclamo-history-item__time">{item.timestampLabel ?? ''}</span>
        </div>
      );
    }

    return (
      <div key={item.id} className="reclamo-history-item">
        <div>
          <strong>{item.author ?? 'Comentario'}</strong>
          <p>{item.message}</p>
        </div>
        <span className="reclamo-history-item__time">{item.timestampLabel ?? ''}</span>
      </div>
    );
  };

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/reclamos')}>
        ← Volver a reclamos
      </button>
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout title="Detalle de reclamo" subtitle="Reclamos" headerContent={headerContent}>
        <p className="form-info">Cargando información del reclamo...</p>
      </DashboardLayout>
    );
  }

  if (loadError || !detail) {
    return (
      <DashboardLayout title="Detalle de reclamo" subtitle="Reclamos" headerContent={headerContent}>
        <p className="form-info form-info--error">{loadError ?? 'No se encontraron datos del reclamo.'}</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Detalle de reclamo" subtitle={detail.codigo ?? `Reclamo #${detail.id}`} headerContent={headerContent}>
      {metaError ? <p className="form-info form-info--error">{metaError}</p> : null}
      {saveError ? <p className="form-info form-info--error">{saveError}</p> : null}
      {saveSuccess ? <p className="form-info form-info--success">{saveSuccess}</p> : null}

      <div className="reclamo-detail">
        <div className="reclamo-detail-main">
          <section className="reclamo-card">
            <div className="reclamo-card-header">
              <h3>Datos del transportista</h3>
              <button type="button" className="secondary-action" onClick={handleExportTransportista} disabled={!detail}>
                Descargar datos
              </button>
            </div>
            {Array.isArray(detail.transportistas) && detail.transportistas.length > 1 ? (
              <div className="transportista-associated-list">
                <p className="section-helper">{`Este reclamo incluye ${detail.transportistas.length} transportistas.`}</p>
                <ul>
                  {detail.transportistas.map((item, index) => (
                    <li key={item.id ?? `${item.nombre ?? 'transportista'}-${index}`}>
                      <span>{item.nombre ?? `Transportista #${item.id ?? index + 1}`}</span>
                      <small>
                        {item.cliente ?? 'Cliente no registrado'}
                        {item.patente ? ` · ${item.patente}` : item.unidad ? ` · ${item.unidad}` : ''}
                      </small>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="reclamo-card-grid">
              {renderReadOnlyField('Nombre completo', transportistaInfo?.nombreCompleto ?? detail.transportista)}
              {renderReadOnlyField(PERSON_TAX_ID_LABEL, transportistaInfo?.cuil ?? '')}
              {renderReadOnlyField('Cliente', transportistaInfo?.cliente ?? detail.cliente ?? '')}
              {renderReadOnlyField('Sucursal', transportistaInfo?.sucursal ?? '')}
              {renderReadOnlyField('Unidad', transportistaInfo?.unidadDetalle ?? transportistaInfo?.unidad ?? '')}
              {renderReadOnlyField('Patente', transportistaInfo?.patente ?? '')}
              {renderReadOnlyField('Agente del alta', detail.creator ?? transportistaInfo?.agente ?? '')}
              {renderReadOnlyField('Responsable actual', detail.agente ?? '')}
              {renderReadOnlyField('Fecha del alta', transportistaInfo?.fechaAlta ?? '')}
              {renderReadOnlyField('Fecha del reclamo', formValues.fechaReclamo || detail.fechaReclamo || '')}
              {isReclamoAdelanto ? renderReadOnlyField('Cliente (sector)', detail.clienteNombre ?? '') : null}
              {isReclamoAdelanto ? renderReadOnlyField('Sucursal (sector)', detail.sucursalNombre ?? '') : null}
              {isReclamoAdelanto ? renderReadOnlyField('Nombre distribuidor', detail.distribuidorNombre ?? '') : null}
              {isReclamoAdelanto ? renderReadOnlyField('Dueño / emisor factura', detail.emisorFactura ?? '') : null}
              {isReclamoAdelanto ? renderReadOnlyField('Importe solicitado', detail.importeSolicitadoLabel ?? detail.importeSolicitado ?? '') : null}
              {isReclamoAdelanto ? renderReadOnlyField('CUIT cobrador', detail.cuitCobrador ?? '') : null}
              {isReclamoAdelanto ? renderReadOnlyField('Medio de pago', detail.medioPago ?? '') : null}
              {canViewReclamoImportes && detail.pagado ? renderReadOnlyField('Importe pagado', detail.importePagadoLabel ?? detail.importePagado ?? '') : null}
              {canViewReclamoImportes && (detail.status ?? '').trim().toLowerCase() === 'finalizado'
                ? renderReadOnlyField('Importe facturado', detail.importeFacturadoLabel ?? (detail.importeFacturado ? formatCurrency(detail.importeFacturado) : ''))
                : null}
              {renderReadOnlyField('Teléfono', transportistaInfo?.telefono ?? '')}
              {renderReadOnlyField('Email', transportistaInfo?.email ?? '')}
              {renderReadOnlyField('Tipo de reclamo', formatReclamoTipoLabel(detail.tipo) || '—')}
            </div>
            {isReclamoAdelanto ? (
              <label className="input-control">
                <span>Concepto</span>
                <textarea value={detail.concepto ?? ''} rows={3} readOnly />
              </label>
            ) : null}
          </section>

          <section className="reclamo-card">
            <h3>Descripción del reclamo</h3>
            <label className="input-control">
              <span>Detalle</span>
              <textarea
                value={formValues.detalle}
                onChange={(event) => setFormValues((prev) => ({ ...prev, detalle: event.target.value }))}
                rows={4}
                disabled={isReclamoLocked}
              />
            </label>
          </section>

          <section className="reclamo-card">
            <div className="reclamo-card-header">
              <h3>Carga de documentos</h3>
              <button type="button" className="primary-action" onClick={handleDocumentButtonClick} disabled={documentUploading}>
                {documentUploading ? 'Subiendo...' : 'Subir archivos'}
              </button>
              <input ref={fileUploadInputRef} type="file" multiple onChange={handleDocumentChange} style={{ display: 'none' }} />
            </div>
            {documentMessage ? <p className="form-info form-info--success">{documentMessage}</p> : null}
            {documentError ? <p className="form-info form-info--error">{documentError}</p> : null}
            {detail.documents && detail.documents.length > 0 ? (
              <ul className="reclamo-documents">
                {detail.documents.map((document) => (
                  <li key={document.id}>
                    <div>
                      <strong>{document.nombre ?? `Documento #${document.id}`}</strong>
                      <span>{document.uploadedAtLabel ?? ''}</span>
                    </div>
                    <div className="reclamo-document-actions">
                      {document.downloadUrl ? (
                        <button type="button" className="secondary-action secondary-action--ghost" onClick={() => handleDocumentDownload(document)}>
                          Descargar
                        </button>
                      ) : (
                        <span className="section-helper">Sin enlace</span>
                      )}
                      <button
                        type="button"
                        className="secondary-action secondary-action--danger"
                        onClick={() => handleDocumentDelete(document)}
                        disabled={documentDeletingId === document.id}
                      >
                        {documentDeletingId === document.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="section-helper">No hay archivos adjuntos.</p>
            )}
          </section>

          <section className="reclamo-card">
            <h3>Historial del reclamo</h3>
            <div className="reclamo-history">
              {detail.history.length === 0 ? <p className="section-helper">No hay historial disponible.</p> : detail.history.map((item) => renderHistoryItem(item))}
            </div>

            <form className="reclamo-comment-form" onSubmit={handleCommentSubmit}>
              <label className="input-control">
                <span>Agregar comentario</span>
                <textarea
                  value={commentText}
                  onChange={(event) => {
                    setCommentText(event.target.value);
                    if (commentError) {
                      setCommentError(null);
                    }
                  }}
                  placeholder="Escribe un comentario..."
                  rows={3}
                  disabled={commentSaving}
                />
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    setCommentText('');
                    setCommentError(null);
                    setCommentInfo(null);
                  }}
                  disabled={commentSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="primary-action" disabled={commentSaving}>
                  {commentSaving ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
            {commentError ? <p className="form-info form-info--error">{commentError}</p> : null}
            {commentInfo ? <p className="form-info form-info--success">{commentInfo}</p> : null}
          </section>
        </div>

        <aside className="reclamo-detail-sidebar">
          <form className="reclamo-card reclamo-status-card" onSubmit={handleUpdate}>
            <div className="reclamo-card-header">
              <h3>Estado del reclamo</h3>
              <span className="status-pill">{detail.statusLabel ?? detail.status ?? '—'}</span>
            </div>
            {isReclamoLocked ? (
              <p className="form-info">El checklist está activo. Desmarcalo desde el listado para volver a editar este reclamo.</p>
            ) : null}

            <fieldset className="reclamo-status-fieldset" disabled={saving || isReclamoLocked}>
              <label className="input-control">
                <span>Responsable / Cliente</span>
                <select
                  value={responsableClienteValue}
                  onChange={(event) => {
                    const rawValue = event.target.value;
                    if (!rawValue) {
                      setFormValues((prev) => ({ ...prev, agenteId: '', clienteNombre: '' }));
                      return;
                    }

                    if (rawValue.startsWith('agente:')) {
                      const agenteId = rawValue.slice('agente:'.length);
                      setFormValues((prev) => ({ ...prev, agenteId, clienteNombre: '' }));
                      return;
                    }

                    if (rawValue.startsWith('cliente:')) {
                      const clienteNombre = rawValue.slice('cliente:'.length);
                      setFormValues((prev) => ({
                        ...prev,
                        agenteId: '',
                        clienteNombre,
                      }));
                    }
                  }}
                  disabled={metaLoading}
                >
                  <option value="">Sin asignar</option>
                  <optgroup label="Agentes responsables">
                    {(meta?.agentes ?? []).map((agente) => (
                      <option key={agente.id} value={`agente:${agente.id}`}>
                        {agente.nombre ?? `Agente #${agente.id}`}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Clientes">
                    {clienteOptions.map((cliente) => (
                      <option key={`cliente-${cliente}`} value={`cliente:${cliente}`}>
                        {cliente}
                      </option>
                    ))}
                  </optgroup>
                  {(meta?.agentes ?? []).length === 0 ? (
                    <option value="" disabled>
                      No hay agentes disponibles
                    </option>
                  ) : null}
                </select>
              </label>
              <p className="section-helper">Al asignar un responsable se notificará el cambio.</p>

              <label className="input-control">
                <span>Estado</span>
                <select value={formValues.status} onChange={(event) => setFormValues((prev) => ({ ...prev, status: event.target.value }))} disabled={metaLoading}>
                  <option value="">Seleccionar</option>
                  {(meta?.estados ?? []).map((estado) => (
                    <option key={estado.value} value={estado.value}>
                      {estado.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="input-control">
                <span>Pagado</span>
                <select
                  value={formValues.pagado}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setFormValues((prev) => ({
                      ...prev,
                      pagado: nextValue,
                      importePagado: nextValue === 'true' ? prev.importePagado : '',
                    }));
                  }}
                  disabled={!canViewReclamoImportes}
                >
                  <option value="false">No</option>
                  <option value="true">Sí</option>
                </select>
              </label>

              {canViewReclamoImportes && formValues.pagado === 'true' ? (
                <label className="input-control">
                  <span>Importe pagado</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={formValues.importePagado}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, importePagado: event.target.value }))}
                  />
                </label>
              ) : null}

              {(formValues.status || detail.status || '').trim().toLowerCase() === 'finalizado' && canViewReclamoImportes ? (
                <label className="input-control">
                  <span>Importe facturado</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={formValues.importeFacturado}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, importeFacturado: event.target.value }))}
                  />
                </label>
              ) : null}

              <label className="input-control">
                <span>Fecha del reclamo</span>
                <input type="date" value={formValues.fechaReclamo} onChange={(event) => setFormValues((prev) => ({ ...prev, fechaReclamo: event.target.value }))} />
              </label>

              {isReclamoAdelanto ? (
                <label className="input-control">
                  <span>Fecha compromiso de pago</span>
                  <input type="date" value={formValues.fechaCompromisoPago} onChange={(event) => setFormValues((prev) => ({ ...prev, fechaCompromisoPago: event.target.value }))} />
                </label>
              ) : null}

              {isReclamoAdelanto ? (
                <label className="input-control">
                  <span>Aprobado / No aprobado</span>
                  <select value={formValues.aprobacionEstado} onChange={(event) => setFormValues((prev) => ({ ...prev, aprobacionEstado: event.target.value }))}>
                    <option value="">Sin definir</option>
                    <option value="aprobado">Aprobado</option>
                    <option value="no_aprobado">No aprobado</option>
                  </select>
                </label>
              ) : null}

              {isReclamoAdelanto ? (
                <label className="input-control">
                  <span>Motivo</span>
                  <textarea rows={3} value={formValues.aprobacionMotivo} onChange={(event) => setFormValues((prev) => ({ ...prev, aprobacionMotivo: event.target.value }))} />
                </label>
              ) : null}

              <div className="form-actions">
                <button type="button" className="secondary-action" onClick={handleResetForm} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="primary-action" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </fieldset>
          </form>
        </aside>
      </div>
    </DashboardLayout>
  );
};

