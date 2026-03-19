import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { persistTransportistasToCache } from '../features/reclamos/storage';
import type { ReclamoMeta, ReclamoRecord, TransportistaDetail } from '../features/reclamos/types';
import {
  formatReclamoTipoLabel,
  isReclamoAdelantoType,
  normalizeReclamosTipoQueryParam,
} from '../features/reclamos/utils';

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

type ReclamoNuevoPageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
};

export const ReclamoNuevoPage: React.FC<ReclamoNuevoPageProps> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [meta, setMeta] = useState<ReclamoMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState({
    detalle: '',
    agenteId: '',
    creatorId: '',
    transportistaId: '',
    tipoId: '',
    status: '',
    pagado: 'false',
    fechaReclamo: '',
    clienteNombre: '',
    sucursalNombre: '',
    distribuidorNombre: '',
    emisorFactura: '',
    importeSolicitado: '',
    cuitCobrador: '',
    medioPago: '',
    concepto: '',
    fechaCompromisoPago: '',
  });
  const authUser = useStoredAuthUser();
  const normalizedUserName = useMemo(
    () => authUser?.name?.trim().toLowerCase() ?? authUser?.email?.trim().toLowerCase() ?? '',
    [authUser?.name, authUser?.email]
  );
  const requestedTipoParam = useMemo(() => normalizeReclamosTipoQueryParam(location.search), [location.search]);
  const shouldAutoselectAdelantoTipo =
    requestedTipoParam === 'adelanto' || requestedTipoParam === 'reclamos-y-adelantos';
  const isAdelantoQuickCreateMode = shouldAutoselectAdelantoTipo;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [transportistaSearch, setTransportistaSearch] = useState('');
  const [transportistaDetail, setTransportistaDetail] = useState<TransportistaDetail | null>(null);
  const [transportistaDetailLoading, setTransportistaDetailLoading] = useState(false);
  const [transportistaDetailError, setTransportistaDetailError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [selectedTransportistas, setSelectedTransportistas] = useState<TransportistaDetail[]>([]);
  const attachmentSummary = useMemo(() => {
    if (attachments.length === 0) {
      return null;
    }
    if (attachments.length === 1) {
      return attachments[0].name;
    }
    if (attachments.length <= 3) {
      return attachments.map((file) => file.name).join(', ');
    }

    return `${attachments.length} archivos seleccionados`;
  }, [attachments]);

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

        setMetaError((err as Error).message ?? 'No se pudo cargar la información necesaria.');
      } finally {
        setMetaLoading(false);
      }
    };

    fetchMeta();

    return () => controller.abort();
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!meta || !shouldAutoselectAdelantoTipo) {
      return;
    }

    const adelantoTipo = meta.tipos.find((tipo) => isReclamoAdelantoType(tipo));
    if (!adelantoTipo?.id) {
      return;
    }

    setFormValues((prev) => {
      const adelantoTipoId = String(adelantoTipo.id);
      if (prev.tipoId === adelantoTipoId) {
        return prev;
      }
      return { ...prev, tipoId: adelantoTipoId };
    });
  }, [meta, shouldAutoselectAdelantoTipo]);

  useEffect(() => {
    if (!meta) {
      return;
    }

    setFormValues((prev) => {
      if (prev.status && prev.creatorId) {
        return prev;
      }

      const preferredStatus =
        meta.estados.find((estado) => estado.value === 'creado')?.value ?? meta.estados[0]?.value ?? '';

      if (!preferredStatus) {
        return prev;
      }

      const matchingCreator = meta.creadores.find((creator) => {
        const normalizedCreatorName = creator.nombre?.trim().toLowerCase() ?? '';
        return normalizedCreatorName && normalizedCreatorName === normalizedUserName;
      });

      const defaultCreatorId =
        prev.creatorId ||
        (matchingCreator?.id
          ? String(matchingCreator.id)
          : meta.creadores[0]?.id
          ? String(meta.creadores[0].id)
          : '');

      return {
        ...prev,
        status: preferredStatus,
        creatorId: defaultCreatorId,
      };
    });
  }, [meta, normalizedUserName]);

  const creatorSelection = useMemo(() => {
    if (!meta) {
      return [];
    }
    const matchingCreator = meta.creadores.find((creator) => {
      const normalizedCreatorName = creator.nombre?.trim().toLowerCase() ?? '';
      return normalizedCreatorName && normalizedCreatorName === normalizedUserName;
    });
    if (matchingCreator) {
      return [matchingCreator];
    }
    return meta.creadores;
  }, [meta, normalizedUserName]);

  const selectedTipo = useMemo(
    () => meta?.tipos.find((tipo) => String(tipo.id) === formValues.tipoId) ?? null,
    [meta?.tipos, formValues.tipoId]
  );
  const isReclamoAdelantoSelected = useMemo(() => isReclamoAdelantoType(selectedTipo), [selectedTipo]);

  const transportistaOptions = useMemo(() => {
    if (!meta) {
      return [] as Array<{ id: number; label: string }>;
    }

    const counts = meta.transportistas.reduce<Record<string, number>>((acc, transportista) => {
      const baseName =
        (transportista.nombre ?? `Transportista #${transportista.id}`).trim() || `Transportista #${transportista.id}`;
      acc[baseName] = (acc[baseName] ?? 0) + 1;
      return acc;
    }, {});

    return meta.transportistas.map((transportista) => {
      const baseName =
        (transportista.nombre ?? `Transportista #${transportista.id}`).trim() || `Transportista #${transportista.id}`;
      const label = counts[baseName] > 1 ? `${baseName} (#${transportista.id})` : baseName;

      return { id: transportista.id, label };
    });
  }, [meta]);

  const transportistaLookup = useMemo(() => {
    const map = new Map<string, { id: number; label: string }>();
    transportistaOptions.forEach((option) => {
      map.set(option.label.toLowerCase(), option);
    });
    return map;
  }, [transportistaOptions]);

  const handleTransportistaSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setTransportistaSearch(value);

    const normalized = value.trim().toLowerCase();
    const match = normalized.length > 0 ? transportistaLookup.get(normalized) : undefined;

    if (match) {
      setFormValues((prev) => {
        if (prev.transportistaId === String(match.id)) {
          return prev;
        }
        return { ...prev, transportistaId: String(match.id) };
      });
      return;
    }

    if (value.trim().length === 0) {
      setFormValues((prev) => {
        if (!prev.transportistaId) {
          return prev;
        }
        return { ...prev, transportistaId: '' };
      });
    } else {
      setFormValues((prev) => {
        if (!prev.transportistaId) {
          return prev;
        }
        return { ...prev, transportistaId: '' };
      });
    }
  };

  const handleDistribuidorSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    const normalized = value.trim().toLowerCase();
    const match = normalized.length > 0 ? transportistaLookup.get(normalized) : undefined;

    setFormValues((prev) => {
      const nextTransportistaId = match ? String(match.id) : '';

      if (prev.distribuidorNombre === value && prev.transportistaId === nextTransportistaId) {
        return prev;
      }

      return {
        ...prev,
        distribuidorNombre: value,
        transportistaId: nextTransportistaId,
      };
    });

    if (match) {
      setTransportistaSearch(match.label);
      return;
    }

    if (normalized.length === 0) {
      setTransportistaSearch('');
      setTransportistaDetail(null);
      setTransportistaDetailError(null);
    }
  };

  const handleClearTransportista = () => {
    setTransportistaSearch('');
    setTransportistaDetail(null);
    setTransportistaDetailError(null);
    setFormValues((prev) => ({
      ...prev,
      transportistaId: '',
      agenteId: '',
      creatorId: meta?.creadores[0]?.id ? String(meta.creadores[0].id) : '',
    }));
  };

  const clearTransportistaSelectionState = () => {
    setTransportistaSearch('');
    setTransportistaDetail(null);
    setTransportistaDetailError(null);
    setFormValues((prev) => ({
      ...prev,
      transportistaId: '',
    }));
  };

  const handleAddTransportistaToList = () => {
    if (!transportistaDetail) {
      window.alert('Seleccioná un transportista antes de agregarlo al reclamo.');
      return;
    }

    setSelectedTransportistas((prev) => {
      if (prev.some((item) => item.id === transportistaDetail.id)) {
        window.alert('Este transportista ya fue agregado.');
        return prev;
      }
      return [...prev, transportistaDetail];
    });

    clearTransportistaSelectionState();
  };

  const handleRemoveTransportistaFromList = (id: number) => {
    setSelectedTransportistas((prev) => prev.filter((item) => item.id !== id));
  };

  useEffect(() => {
    const transportistaId = formValues.transportistaId;
    if (!transportistaId) {
      setTransportistaDetail(null);
      setTransportistaDetailError(null);
      setTransportistaDetailLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchTransportista = async () => {
      try {
        setTransportistaDetailLoading(true);
        setTransportistaDetailError(null);

        const response = await fetch(`${apiBaseUrl}/api/personal/${transportistaId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: TransportistaDetail };
        if (!payload?.data) {
          throw new Error('Formato de respuesta inesperado');
        }

        setTransportistaDetail(payload.data);
        setFormValues((prev) => {
          const next = { ...prev };
          let changed = false;

          if (!prev.agenteId && payload.data.agenteId != null) {
            next.agenteId = String(payload.data.agenteId);
            changed = true;
          }

          if (!prev.creatorId && payload.data.agenteId != null) {
            next.creatorId = String(payload.data.agenteId);
            changed = true;
          }

          return changed ? next : prev;
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }

        setTransportistaDetailError((err as Error).message ?? 'No se pudo cargar el transportista.');
        setTransportistaDetail(null);
      } finally {
        setTransportistaDetailLoading(false);
      }
    };

    fetchTransportista();

    return () => controller.abort();
  }, [formValues.transportistaId, apiBaseUrl]);

  useEffect(() => {
    if (!transportistaDetail || !isReclamoAdelantoSelected) {
      return;
    }

    const nombreCompleto = `${transportistaDetail.nombres ?? ''} ${transportistaDetail.apellidos ?? ''}`.trim() || '';

    setFormValues((prev) => ({
      ...prev,
      clienteNombre: prev.clienteNombre || transportistaDetail.cliente || '',
      sucursalNombre: prev.sucursalNombre || transportistaDetail.sucursal || '',
      distribuidorNombre: prev.distribuidorNombre || nombreCompleto || '',
      emisorFactura: prev.emisorFactura || nombreCompleto || '',
      cuitCobrador: prev.cuitCobrador || transportistaDetail.cuil || '',
    }));
  }, [transportistaDetail, isReclamoAdelantoSelected]);

  useEffect(() => {
    if (!formValues.transportistaId) {
      return;
    }

    const selected = transportistaOptions.find((option) => option.id === Number(formValues.transportistaId));

    if (selected && transportistaSearch !== selected.label) {
      setTransportistaSearch(selected.label);
    }
  }, [formValues.transportistaId, transportistaOptions, transportistaSearch]);

  const handleFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files ? Array.from(event.target.files) : [];

    if (selectedFiles.length > 0) {
      setAttachments((prev) => {
        const existingKeys = new Set(prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
        const merged = [...prev];

        selectedFiles.forEach((file) => {
          const key = `${file.name}-${file.size}-${file.lastModified}`;
          if (!existingKeys.has(key)) {
            merged.push(file);
            existingKeys.add(key);
          }
        });

        return merged;
      });
    }

    if (event.target) {
      event.target.value = '';
    }
  };

  const handleClearAttachments = () => {
    setAttachments([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const transportistaIds =
      selectedTransportistas.length > 0
        ? selectedTransportistas.map((item) => item.id)
        : formValues.transportistaId
        ? [Number(formValues.transportistaId)]
        : [];

    if (!formValues.tipoId || !formValues.status || (!isAdelantoQuickCreateMode && transportistaIds.length === 0)) {
      setSubmitError('Completa los campos obligatorios.');
      return;
    }

    if (isReclamoAdelantoSelected || isAdelantoQuickCreateMode) {
      const requiredAdelantoFields: Array<{ key: keyof typeof formValues; label: string }> = [
        { key: 'clienteNombre', label: 'Cliente' },
        { key: 'sucursalNombre', label: 'Sucursal' },
        { key: 'distribuidorNombre', label: 'Nombre distribuidor' },
        { key: 'emisorFactura', label: 'Dueño / emisor de factura' },
        { key: 'importeSolicitado', label: 'Importe solicitado' },
        { key: 'cuitCobrador', label: 'CUIT cobrador' },
        { key: 'medioPago', label: 'Medio de pago' },
        { key: 'concepto', label: 'Concepto' },
      ];

      const missingField = requiredAdelantoFields.find((field) => !(formValues[field.key] ?? '').trim());
      if (missingField) {
        setSubmitError(`Completa el campo obligatorio: ${missingField.label}.`);
        return;
      }
    }

    try {
      setSubmitError(null);
      setSuccessMessage(null);
      setSaving(true);

      const mapTransportistaForPayload = (transportista: TransportistaDetail) => ({
        id: transportista.id,
        agenteId: transportista.agenteId ?? null,
        agente: transportista.agente ?? null,
        cliente: transportista.cliente ?? null,
        sucursal: transportista.sucursal ?? null,
        unidad: transportista.unidad ?? null,
        unidadDetalle: transportista.unidadDetalle ?? null,
        patente: transportista.patente ?? null,
      });

      const transportistasPayload =
        selectedTransportistas.length > 0
          ? selectedTransportistas.map(mapTransportistaForPayload)
          : transportistaDetail && formValues.transportistaId
          ? [mapTransportistaForPayload(transportistaDetail)]
          : transportistaIds.map((id) => ({ id, agenteId: null }));

      const requestBody: Record<string, unknown> = {
        detalle: formValues.detalle.trim() || null,
        agenteId: formValues.agenteId ? Number(formValues.agenteId) : null,
        creatorId: formValues.creatorId ? Number(formValues.creatorId) : null,
        tipoId: Number(formValues.tipoId),
        status: formValues.status,
        pagado: formValues.pagado === 'true',
        fechaReclamo: formValues.fechaReclamo || null,
        clienteNombre: formValues.clienteNombre.trim() || null,
        sucursalNombre: formValues.sucursalNombre.trim() || null,
        distribuidorNombre: formValues.distribuidorNombre.trim() || null,
        emisorFactura: formValues.emisorFactura.trim() || null,
        importeSolicitado: formValues.importeSolicitado.trim() || null,
        cuitCobrador: formValues.cuitCobrador.trim() || null,
        medioPago: formValues.medioPago.trim() || null,
        concepto: formValues.concepto.trim() || null,
        fechaCompromisoPago: formValues.fechaCompromisoPago || null,
      };

      if (transportistaIds.length > 0) {
        requestBody.transportistaId = transportistaIds[0];
        requestBody.transportistaIds = transportistaIds;
        requestBody.transportistas = transportistasPayload;
      }

      const response = await fetch(`${apiBaseUrl}/api/reclamos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;

        try {
          const errorPayload = await response.json();
          if (typeof errorPayload?.message === 'string') {
            message = errorPayload.message;
          } else if (errorPayload?.errors) {
            const firstError = Object.values(errorPayload.errors)[0];
            if (Array.isArray(firstError) && firstError[0]) {
              message = firstError[0] as string;
            }
          }
        } catch {
          // ignore
        }

        throw new Error(message);
      }

      const payload = (await response.json()) as { message?: string; data: ReclamoRecord };
      const createdReclamo = payload.data;
      if (selectedTransportistas.length > 0) {
        createdReclamo.transportistas = selectedTransportistas.map((item) => ({
          id: item.id ?? null,
          nombre: `${item.nombres ?? ''} ${item.apellidos ?? ''}`.trim() || item.cliente || `Transportista #${item.id}`,
          cliente: item.cliente ?? null,
          patente: item.patente ?? item.unidad ?? null,
          unidad: item.unidadDetalle ?? item.unidad ?? null,
        }));
        if (!createdReclamo.transportista && createdReclamo.transportistas.length > 0) {
          createdReclamo.transportista = createdReclamo.transportistas[0].nombre;
        }
      } else if (transportistaDetail && formValues.transportistaId) {
        createdReclamo.transportistas = [
          {
            id: transportistaDetail.id ?? Number(formValues.transportistaId),
            nombre:
              `${transportistaDetail.nombres ?? ''} ${transportistaDetail.apellidos ?? ''}`.trim() ||
              transportistaDetail.cliente ||
              createdReclamo.transportista,
            cliente: transportistaDetail.cliente ?? null,
            patente: transportistaDetail.patente ?? transportistaDetail.unidad ?? null,
            unidad: transportistaDetail.unidadDetalle ?? transportistaDetail.unidad ?? null,
          },
        ];
      }
      const newReclamoId = createdReclamo?.id ?? null;
      const currentAttachments = attachments.length > 0 ? [...attachments] : [];

      if (newReclamoId) {
        persistTransportistasToCache(newReclamoId, createdReclamo.transportistas ?? []);
      }

      if (currentAttachments.length > 0) {
        if (!newReclamoId) {
          setSubmitError('El reclamo se creó, pero no fue posible adjuntar los archivos automáticamente.');
          window.dispatchEvent(new CustomEvent('notifications:updated'));
          navigate('/reclamos');
          return;
        }

        try {
          const formData = new FormData();
          currentAttachments.forEach((file) => {
            formData.append('archivos[]', file);
            formData.append('nombres[]', file.name);
          });

          const attachmentActorId = formValues.creatorId
            ? Number(formValues.creatorId)
            : formValues.agenteId
            ? Number(formValues.agenteId)
            : authUser?.id ?? null;

          if (attachmentActorId) {
            formData.append('creatorId', String(attachmentActorId));
          }

          const uploadResponse = await fetch(`${apiBaseUrl}/api/reclamos/${newReclamoId}/documentos`, {
            method: 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            let message = `Error ${uploadResponse.status}: ${uploadResponse.statusText}`;

            try {
              const errorPayload = await uploadResponse.json();
              if (typeof errorPayload?.message === 'string') {
                message = errorPayload.message;
              } else if (errorPayload?.errors) {
                const firstError = Object.values(errorPayload.errors)[0];
                if (Array.isArray(firstError) && firstError[0]) {
                  message = firstError[0] as string;
                }
              }
            } catch {
              // ignore
            }

            throw new Error(message);
          }
        } catch (uploadError) {
          const baseMessage = 'El reclamo se creó correctamente, pero no se pudieron subir los archivos seleccionados.';
          const extraMessage =
            (uploadError as Error).message && (uploadError as Error).message !== baseMessage
              ? ` ${(uploadError as Error).message}`
              : '';

          setSubmitError(`${baseMessage}${extraMessage}`);
          setSuccessMessage(null);
          window.dispatchEvent(new CustomEvent('notifications:updated'));
          navigate(`/reclamos/${newReclamoId}`);
          return;
        }
      }

      const successText = payload.message ?? 'Reclamo creado correctamente.';
      const attachmentsNote =
        currentAttachments.length > 0
          ? ` Se adjuntaron ${currentAttachments.length} archivo${currentAttachments.length === 1 ? '' : 's'}.`
          : '';
      const flashPayload = {
        message: `${successText}${attachmentsNote} Responsable: ${createdReclamo.agente ?? 'Sin asignar'}. Creador: ${
          createdReclamo.creator ?? 'Sin asignar'
        }.`,
        reclamo: createdReclamo,
      };

      try {
        sessionStorage.setItem('recentReclamo', JSON.stringify(flashPayload));
      } catch {
        // ignore storage failures
      }

      setSuccessMessage(`${successText}${attachmentsNote}`);

      const defaultStatus = meta?.estados.find((estado) => estado.value === 'creado')?.value ?? meta?.estados[0]?.value ?? 'creado';

      setFormValues({
        detalle: '',
        agenteId: '',
        creatorId: meta?.creadores[0]?.id ? String(meta.creadores[0].id) : '',
        transportistaId: '',
        tipoId: '',
        status: defaultStatus,
        pagado: 'false',
        fechaReclamo: '',
        clienteNombre: '',
        sucursalNombre: '',
        distribuidorNombre: '',
        emisorFactura: '',
        importeSolicitado: '',
        cuitCobrador: '',
        medioPago: '',
        concepto: '',
        fechaCompromisoPago: '',
      });
      setTransportistaSearch('');
      setTransportistaDetail(null);
      setSelectedTransportistas([]);
      setAttachments([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      window.dispatchEvent(new CustomEvent('notifications:updated'));
      navigate('/reclamos');
    } catch (err) {
      setSubmitError((err as Error).message ?? 'No se pudo registrar el reclamo.');
    } finally {
      setSaving(false);
    }
  };

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/reclamos')}>
        ← Volver a reclamos
      </button>
    </div>
  );

  if (metaLoading) {
    return (
      <DashboardLayout title="Crear reclamo" subtitle="Registrar un nuevo reclamo" headerContent={headerContent}>
        <p className="form-info">Cargando información para el formulario...</p>
      </DashboardLayout>
    );
  }

  if (metaError) {
    return (
      <DashboardLayout title="Crear reclamo" subtitle="Registrar un nuevo reclamo" headerContent={headerContent}>
        <p className="form-info form-info--error">{metaError}</p>
      </DashboardLayout>
    );
  }

  if (!meta) {
    return (
      <DashboardLayout title="Crear reclamo" subtitle="Registrar un nuevo reclamo" headerContent={headerContent}>
        <p className="form-info form-info--error">No se encontró la información necesaria.</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Crear reclamo" subtitle="Registrar un nuevo reclamo" headerContent={headerContent}>
      <form className="edit-form" onSubmit={handleSubmit}>
        {!isAdelantoQuickCreateMode ? (
          <div className="reclamo-section">
            <div className="reclamo-section__header">
              <h3>Datos del transportista</h3>
            </div>

            <div className="transportista-search">
              <label className="input-control">
                <span>Buscar transportista</span>
                <div className="transportista-search__field">
                  <input
                    type="text"
                    list="transportistas-list"
                    placeholder="Escribe un nombre o selecciona de la lista"
                    value={transportistaSearch}
                    onChange={handleTransportistaSearchChange}
                  />
                  {transportistaSearch ? (
                    <button type="button" className="secondary-action secondary-action--ghost" onClick={handleClearTransportista}>
                      Limpiar
                    </button>
                  ) : null}
                </div>
              </label>
              <datalist id="transportistas-list">
                {transportistaOptions.map((option) => (
                  <option key={option.id} value={option.label} />
                ))}
              </datalist>
            </div>

            {transportistaDetailLoading ? <p className="section-helper">Cargando datos del transportista...</p> : null}

            {transportistaDetailError ? <p className="form-info form-info--error">{transportistaDetailError}</p> : null}

            <div className="form-grid">
              <label className="input-control">
                <span>Nombre</span>
                <input
                  type="text"
                  value={transportistaDetail ? transportistaDetail.nombres ?? '—' : ''}
                  placeholder="Selecciona un transportista"
                  readOnly
                  disabled={!transportistaDetail}
                />
              </label>
              <label className="input-control">
                <span>Apellido</span>
                <input
                  type="text"
                  value={transportistaDetail ? transportistaDetail.apellidos ?? '—' : ''}
                  placeholder="Selecciona un transportista"
                  readOnly
                  disabled={!transportistaDetail}
                />
              </label>
              <label className="input-control">
                <span>Cliente</span>
                <input
                  type="text"
                  value={transportistaDetail ? transportistaDetail.cliente ?? '—' : ''}
                  placeholder="Selecciona un transportista"
                  readOnly
                  disabled={!transportistaDetail}
                />
              </label>
              <label className="input-control">
                <span>Sucursal</span>
                <input
                  type="text"
                  value={transportistaDetail ? transportistaDetail.sucursal ?? '—' : ''}
                  placeholder="Selecciona un transportista"
                  readOnly
                  disabled={!transportistaDetail}
                />
              </label>
              <label className="input-control">
                <span>Agente</span>
                <input
                  type="text"
                  value={transportistaDetail ? transportistaDetail.agente ?? '—' : ''}
                  placeholder="Selecciona un transportista"
                  readOnly
                  disabled={!transportistaDetail}
                />
              </label>
              <label className="input-control">
                <span>Unidad</span>
                <input
                  type="text"
                  value={transportistaDetail ? transportistaDetail.unidadDetalle ?? '—' : ''}
                  placeholder="Selecciona un transportista"
                  readOnly
                  disabled={!transportistaDetail}
                />
              </label>
              <label className="input-control">
                <span>Patente</span>
                <input
                  type="text"
                  value={transportistaDetail ? transportistaDetail.patente ?? transportistaDetail.unidad ?? '—' : ''}
                  placeholder="Selecciona un transportista"
                  readOnly
                  disabled={!transportistaDetail}
                />
              </label>
              <label className="input-control">
                <span>Teléfono</span>
                <input
                  type="text"
                  value={transportistaDetail ? transportistaDetail.telefono ?? '—' : ''}
                  placeholder="Selecciona un transportista"
                  readOnly
                  disabled={!transportistaDetail}
                />
              </label>
              <label className="input-control">
                <span>Fecha de alta</span>
                <input
                  type="text"
                  value={transportistaDetail ? transportistaDetail.fechaAlta ?? '—' : ''}
                  placeholder="Selecciona un transportista"
                  readOnly
                  disabled={!transportistaDetail}
                />
              </label>
            </div>

            <div className="transportista-actions">
              <button type="button" className="secondary-action" onClick={handleAddTransportistaToList} disabled={!transportistaDetail}>
                Agregar transportista al reclamo
              </button>
              <small>Podés agregar más de un transportista para este reclamo.</small>
            </div>

            <div className="transportista-selected">
              <div className="transportista-selected__header">
                <span>Transportistas añadidos</span>
                <span className="transportista-selected__counter">{selectedTransportistas.length}</span>
              </div>

              {selectedTransportistas.length === 0 ? (
                <p className="section-helper">Todavía no agregaste transportistas a este reclamo.</p>
              ) : (
                <ul className="transportista-selected__list">
                  {selectedTransportistas.map((item) => (
                    <li key={item.id} className="transportista-selected__item">
                      <div>
                        <strong>{`${item.nombres ?? ''} ${item.apellidos ?? ''}`.trim() || `Transportista #${item.id}`}</strong>
                        <small>
                          {item.cliente ?? 'Cliente no registrado'} · {item.patente ?? item.unidad ?? 'Sin patente'}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="secondary-action secondary-action--ghost"
                        onClick={() => handleRemoveTransportistaFromList(item.id)}
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        {!isAdelantoQuickCreateMode ? (
          <div className="reclamo-section">
            <div className="reclamo-section__header">
              <h3>Detalle del reclamo</h3>
            </div>

            <div className="form-grid">
              <label className="input-control">
                <span>Tipo de reclamo</span>
                <select value={formValues.tipoId} onChange={(event) => setFormValues((prev) => ({ ...prev, tipoId: event.target.value }))} required>
                  <option value="">Seleccionar</option>
                  {meta.tipos.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>
                      {formatReclamoTipoLabel(tipo.nombre ?? `Tipo #${tipo.id}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-control">
                <span>Agente</span>
                <select value={formValues.agenteId} onChange={(event) => setFormValues((prev) => ({ ...prev, agenteId: event.target.value }))}>
                  <option value="">Seleccionar</option>
                  {meta.agentes.map((agente) => (
                    <option key={agente.id} value={agente.id}>
                      {agente.nombre ?? `Agente #${agente.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-control">
                <span>Agente creador</span>
                <select value={formValues.creatorId} onChange={(event) => setFormValues((prev) => ({ ...prev, creatorId: event.target.value }))}>
                  <option value="">Seleccionar</option>
                  {creatorSelection.map((creador) => (
                    <option key={creador.id} value={creador.id}>
                      {creador.nombre ?? `Agente #${creador.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-control">
                <span>Fecha de alta (opcional)</span>
                <input type="date" value={formValues.fechaReclamo} onChange={(event) => setFormValues((prev) => ({ ...prev, fechaReclamo: event.target.value }))} />
              </label>
            </div>

            <label className="input-control">
              <span>Detalle del reclamo</span>
              <textarea value={formValues.detalle} onChange={(event) => setFormValues((prev) => ({ ...prev, detalle: event.target.value }))} placeholder="Describe qué sucedió" rows={4} />
            </label>
          </div>
        ) : null}

        {isReclamoAdelantoSelected || isAdelantoQuickCreateMode ? (
          <div className="reclamo-section">
            <div className="reclamo-section__header">
              <h3>Datos de Reclamos y Adelantos</h3>
            </div>
            <div className="form-grid">
              <label className="input-control">
                <span>Cliente</span>
                <input type="text" value={formValues.clienteNombre} onChange={(event) => setFormValues((prev) => ({ ...prev, clienteNombre: event.target.value }))} required />
              </label>
              <label className="input-control">
                <span>Sucursal</span>
                <input type="text" value={formValues.sucursalNombre} onChange={(event) => setFormValues((prev) => ({ ...prev, sucursalNombre: event.target.value }))} required />
              </label>
              <label className="input-control">
                <span>Nombre distribuidor</span>
                <input type="text" list="reclamo-distribuidores-list" value={formValues.distribuidorNombre} onChange={handleDistribuidorSearchChange} required />
                <datalist id="reclamo-distribuidores-list">
                  {transportistaOptions.map((option) => (
                    <option key={`reclamo-distribuidor-${option.id}`} value={option.label} />
                  ))}
                </datalist>
              </label>
              <label className="input-control">
                <span>Agente responsable</span>
                <select value={formValues.agenteId} onChange={(event) => setFormValues((prev) => ({ ...prev, agenteId: event.target.value }))}>
                  <option value="">Seleccionar</option>
                  {meta.agentes.map((agente) => (
                    <option key={`reclamo-adelanto-agente-${agente.id}`} value={agente.id}>
                      {agente.nombre ?? `Agente #${agente.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-control">
                <span>Dueño / emisor factura</span>
                <input type="text" value={formValues.emisorFactura} onChange={(event) => setFormValues((prev) => ({ ...prev, emisorFactura: event.target.value }))} required />
              </label>
              <label className="input-control">
                <span>Importe solicitado</span>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={formValues.importeSolicitado} onChange={(event) => setFormValues((prev) => ({ ...prev, importeSolicitado: event.target.value }))} required />
              </label>
              <label className="input-control">
                <span>CUIT cobrador</span>
                <input type="text" value={formValues.cuitCobrador} onChange={(event) => setFormValues((prev) => ({ ...prev, cuitCobrador: event.target.value }))} required />
              </label>
              <label className="input-control">
                <span>Medio de pago</span>
                <input type="text" value={formValues.medioPago} onChange={(event) => setFormValues((prev) => ({ ...prev, medioPago: event.target.value }))} required />
              </label>
              <label className="input-control">
                <span>Fecha compromiso de pago</span>
                <input type="date" value={formValues.fechaCompromisoPago} onChange={(event) => setFormValues((prev) => ({ ...prev, fechaCompromisoPago: event.target.value }))} />
              </label>
            </div>
            <label className="input-control">
              <span>Concepto</span>
              <textarea value={formValues.concepto} onChange={(event) => setFormValues((prev) => ({ ...prev, concepto: event.target.value }))} rows={3} required />
            </label>
          </div>
        ) : null}

        <div className="reclamo-section">
          <div className="reclamo-section__header">
            <h3>Documentación del reclamo</h3>
            <p className="section-helper">Sube tus archivos y los procesaremos</p>
          </div>

          <div className="file-dropzone">
            <div className="file-dropzone__icon" aria-hidden="true">
              📎
            </div>
            <p className="file-dropzone__text">Arrastra y suelta tus archivos aquí o haz clic para seleccionarlos desde tu equipo</p>
            {attachmentSummary ? (
              <>
                <span className="file-dropzone__filename">{attachmentSummary}</span>
                {attachments.length > 1 ? (
                  <ul className="file-dropzone__list">
                    {attachments.map((file) => (
                      <li key={`${file.name}-${file.size}-${file.lastModified}`}>{file.name}</li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <span className="file-dropzone__hint">Formatos soportados: .pdf, .jpg, .jpeg, .png, .docx (máx. 2MB por archivo)</span>
            )}
            <button type="button" className="primary-action" onClick={handleFilePicker}>
              Seleccionar archivos
            </button>
            {attachments.length > 0 ? (
              <button type="button" className="secondary-action secondary-action--ghost" onClick={handleClearAttachments}>
                Quitar archivos
              </button>
            ) : null}
            <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} />
          </div>
        </div>

        {submitError ? <p className="form-info form-info--error">{submitError}</p> : null}
        {successMessage ? <p className="form-info form-info--success">{successMessage}</p> : null}

        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => navigate('/reclamos')}>
            Cancelar
          </button>
          <button type="submit" className="primary-action" disabled={saving}>
            {saving ? 'Registrando...' : 'Crear reclamo'}
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
};
