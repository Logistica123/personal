import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { readTicketsFromStorage, writeTicketsToStorage } from '../features/ticketera/storage';
import {
  HR_EMAIL,
  HR_USER_ID,
  TICKET_CATEGORIES,
  type FacturaAttachment,
  type TicketCategory,
  type TicketRequest,
  type TicketRequestApi,
  type TicketStatus,
} from '../features/ticketera/types';

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

type TicketeraPersonalMeta = {
  agentes: Array<{ id: number; name: string | null }>;
};

type TicketeraPageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  getUserRole: (authUser: AuthUser | null | undefined) => string;
  buildActorHeaders: (authUser: AuthUser | null | undefined) => Record<string, string>;
  isElevatedRole: (role: string | null | undefined) => boolean;
};

const uniqueKey = () => Math.random().toString(36).slice(2);

const normalizeEmail = (email: string | null | undefined): string | null => {
  const normalized = email?.trim().toLowerCase() ?? '';
  return normalized.length > 0 ? normalized : null;
};

export const TicketeraPage: React.FC<TicketeraPageProps> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  getUserRole,
  buildActorHeaders,
  isElevatedRole,
}) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const authUser = useStoredAuthUser();
  const userRole = useMemo(() => getUserRole(authUser), [authUser, getUserRole]);
  const actorHeaders = useMemo(() => buildActorHeaders(authUser), [authUser, buildActorHeaders]);
  const [meta, setMeta] = useState<TicketeraPersonalMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<TicketRequest[]>(() => readTicketsFromStorage());
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedTickets, setExpandedTickets] = useState<Set<number>>(() => new Set());
  const [filters, setFilters] = useState({ estado: '', onlyMine: true, search: '' });
  const [handoffTargets, setHandoffTargets] = useState<Record<number, string>>({});
  const [facturaFiles, setFacturaFiles] = useState<FacturaAttachment[]>([]);
  const [formValues, setFormValues] = useState({
    titulo: '',
    categoria: 'Insumos varios' as TicketCategory,
    insumos: '',
    cantidad: '1',
    notas: '',
    legajo: '',
    monto: '',
    facturaMonto: '',
    destinatarioId: '',
    destinatarioNombreManual: '',
    responsableId: '',
    responsableNombreManual: '',
    finalApproverId: '',
    finalApproverNombreManual: '',
    destinoLabel: 'Administración 2',
  });
  const [editingTicket, setEditingTicket] = useState<TicketRequest | null>(null);
  const [editForm, setEditForm] = useState({
    titulo: '',
    categoria: 'Insumos varios' as TicketCategory,
    insumos: '',
    cantidad: '1',
    monto: '',
    facturaMonto: '',
    notas: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const parseAmount = (raw: string): number | null | undefined => {
    const cleaned = raw.replace(/\s+/g, '').replace(/\./g, '').replace(/,/g, '.');
    if (cleaned.length === 0) {
      return null;
    }
    const parsed = Number(cleaned);
    if (Number.isNaN(parsed)) {
      return undefined;
    }
    return Number(parsed.toFixed(2));
  };

  useEffect(() => {
    writeTicketsToStorage(tickets);
  }, [tickets]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchMeta = async () => {
      try {
        setMetaLoading(true);
        setMetaError(null);
        const response = await fetch(`${apiBaseUrl}/api/personal-meta`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as TicketeraPersonalMeta;
        setMeta(payload);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setMetaError((err as Error).message ?? 'No se pudieron cargar los agentes.');
      } finally {
        setMetaLoading(false);
      }
    };

    fetchMeta();

    return () => controller.abort();
  }, [apiBaseUrl]);

  const resolveEndpoint = useCallback(
    (path: string) => `${apiBaseUrl.replace(/\/+$/, '')}${path}`,
    [apiBaseUrl]
  );

  const resolveAgenteNombre = useCallback(
    (id: number | null) => {
      if (!id || !meta?.agentes) {
        return null;
      }
      const match = meta.agentes.find((agente) => Number(agente.id) === Number(id));
      return match?.name ?? null;
    },
    [meta?.agentes]
  );

const adaptTicketFromApi = useCallback(
  (ticket: TicketRequestApi): TicketRequest => {
    const normalizedCategory = TICKET_CATEGORIES.includes(ticket.categoria as TicketCategory)
      ? (ticket.categoria as TicketCategory)
      : 'Insumos varios';
    const baseUrl = apiBaseUrl.replace(/\/+$/, '');
    const facturaArchivos = Array.isArray(ticket.factura_archivos)
      ? ticket.factura_archivos.map((file, index) => {
          const filePath = (file?.path ?? '').replace(/^\/+/, '');
          const rawUrl = file?.dataUrl ?? (filePath ? `${baseUrl}/storage/${filePath}` : '');
          const fileUrl =
            rawUrl && !/^https?:\/\//i.test(rawUrl)
              ? `${baseUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`
              : rawUrl;
          return {
            id: filePath || file?.name || `${ticket.id}-factura-${index}`,
            name: file?.name ?? `Adjunto ${index + 1}`,
            size: Number(file?.size ?? 0),
            type: file?.type ?? null,
            dataUrl: fileUrl,
          };
        })
      : [];
      const createdAt = ticket.created_at ?? new Date().toISOString();
      const updatedAt = ticket.updated_at ?? createdAt;
      return {
        id: ticket.id,
        titulo: ticket.titulo ?? 'Pedido de insumos',
        categoria: normalizedCategory,
        insumos: ticket.insumos ?? '',
        cantidad: ticket.cantidad ?? '1',
        notas: ticket.notas ?? '',
        monto: ticket.monto != null ? String(ticket.monto) : '',
        facturaMonto: ticket.factura_monto != null ? String(ticket.factura_monto) : '',
        facturaArchivos,
        destinatarioId: ticket.destinatario_id ?? null,
        destinatarioNombre: resolveAgenteNombre(ticket.destinatario_id ?? null),
        responsableId: ticket.responsable_id ?? null,
        responsableNombre: resolveAgenteNombre(ticket.responsable_id ?? null),
        finalApproverId: null,
        finalApproverNombre: null,
        destinoLabel: 'RRHH',
        estado: ticket.estado ?? 'pendiente_responsable',
        solicitanteId: ticket.solicitante_id ?? null,
        solicitanteNombre: ticket.solicitante_id ? `Usuario #${ticket.solicitante_id}` : null,
        createdAt,
        updatedAt,
        historial: [],
      };
    },
    [apiBaseUrl, resolveAgenteNombre]
  );

  const fetchTickets = useCallback(
    async (options?: { signal?: AbortSignal }) => {
      try {
        setTicketsLoading(true);
        setTicketsError(null);
        const url = resolveEndpoint('/api/tickets');
        const response = await fetch(url, {
          signal: options?.signal,
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Error ${response.status} en ${url}: ${response.statusText || text}`);
        }
        const payload = (await response.json()) as { data?: TicketRequestApi[] };
        const mapped = Array.isArray(payload?.data) ? payload.data.map(adaptTicketFromApi) : [];
        setTickets(mapped);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setTicketsError((err as Error).message ?? 'No se pudieron cargar los tickets.');
      } finally {
        setTicketsLoading(false);
      }
    },
    [adaptTicketFromApi, resolveEndpoint]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchTickets({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchTickets]);

  useEffect(() => {
    setTickets((prev) =>
      prev.map((ticket) => ({
        ...ticket,
        responsableNombre:
          ticket.responsableId != null
            ? resolveAgenteNombre(ticket.responsableId) ?? ticket.responsableNombre
            : ticket.responsableNombre,
        destinatarioNombre:
          ticket.destinatarioId != null
            ? resolveAgenteNombre(ticket.destinatarioId) ?? ticket.destinatarioNombre
            : ticket.destinatarioNombre,
      }))
    );
  }, [resolveAgenteNombre]);

  const isHrUser = useMemo(() => {
    const normalized = normalizeEmail(authUser?.email);
    return normalized === normalizeEmail(HR_EMAIL) || isElevatedRole(userRole);
  }, [authUser?.email, isElevatedRole, userRole]);

  const makeHistoryEntry = useCallback(
    (mensaje: string) => ({
      id: uniqueKey(),
      mensaje,
      fecha: new Date().toISOString(),
      actor: authUser?.name ?? authUser?.email ?? null,
    }),
    [authUser?.email, authUser?.name]
  );

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleFacturaFilesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    try {
      const attachments = await Promise.all(
        files.map(async (file) => ({
          id: uniqueKey(),
          name: file.name,
          size: file.size,
          type: file.type || null,
          dataUrl: await readFileAsDataUrl(file),
        }))
      );
      setFacturaFiles((prev) => [...attachments, ...prev]);
    } catch (err) {
      setFlash({ type: 'error', message: 'No se pudo leer el archivo de factura.' });
    } finally {
      event.target.value = '';
    }
  };

  const handleRemoveFacturaFile = (id: string) => {
    setFacturaFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const downloadTicketFactura = useCallback(async (file: FacturaAttachment) => {
    if (!file.dataUrl) {
      setFlash({ type: 'error', message: 'No se pudo determinar la URL del archivo.' });
      return;
    }

    if (file.dataUrl.startsWith('data:')) {
      const anchor = document.createElement('a');
      anchor.href = file.dataUrl;
      anchor.download = file.name || 'factura';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return;
    }

    try {
      const response = await fetch(file.dataUrl);
      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = await response.json();
          if (typeof payload?.message === 'string') {
            message = payload.message;
          }
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = file.name || 'factura';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setFlash({ type: 'error', message: (err as Error).message ?? 'No se pudo descargar la factura.' });
    }
  }, [setFlash]);

  const getEstadoLabel = (estado: TicketStatus) => {
    switch (estado) {
      case 'pendiente_responsable':
        return 'Pendiente responsable';
      case 'pendiente_rrhh':
        return 'Pendiente RRHH';
      case 'pendiente_compra':
        return 'Pendiente compra';
      case 'aprobado':
        return 'Aprobado';
      case 'rechazado':
        return 'Rechazado';
      default:
        return estado;
    }
  };

  const getEstadoClass = (estado: TicketStatus) => {
    switch (estado) {
      case 'aprobado':
        return 'estado-badge--activo';
      case 'rechazado':
        return 'estado-badge--baja';
      case 'pendiente_compra':
        return 'estado-badge--suspendido';
      case 'pendiente_responsable':
      case 'pendiente_rrhh':
      default:
        return 'estado-badge--default';
    }
  };

  const sendNotification = useCallback(
    async (
      userId: number | null,
      message: string,
      metadata?: Record<string, unknown>,
      targetEmail?: string | null
    ) => {
      if (!userId && !targetEmail) {
        return;
      }
      try {
        await fetch(`${apiBaseUrl}/api/notificaciones`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...actorHeaders,
          },
          body: JSON.stringify({
            userId: userId ?? undefined,
            userEmail: targetEmail ?? undefined,
            message,
            metadata: {
              ...metadata,
              ticketera: true,
            },
          }),
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error enviando notificación de ticketera', err);
      }
    },
    [actorHeaders, apiBaseUrl]
  );

  const notifyHr = useCallback(
    async (ticket: TicketRequest, message: string) => {
      // Enviamos por ID (si lo tenemos) y también por email para evitar filtros de rol.
      await sendNotification(
        HR_USER_ID,
        message,
        {
          ticketId: ticket.id,
          destino: 'RRHH',
        },
        HR_EMAIL
      );
      await sendNotification(
        null,
        message,
        {
          ticketId: ticket.id,
          destino: 'RRHH',
        },
        HR_EMAIL
      );
    },
    [sendNotification]
  );

  const persistTicketUpdate = useCallback(
    async (ticketId: number, payload: { estado?: TicketStatus; responsableId?: number | null }) => {
      const response = await fetch(`${apiBaseUrl}/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...actorHeaders,
        },
        body: JSON.stringify({
          estado: payload.estado,
          responsableId: payload.responsableId ?? undefined,
        }),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const errorPayload = await response.json();
          if (typeof errorPayload?.message === 'string') {
            message = errorPayload.message;
          }
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }

      const payloadJson = (await response.json()) as { data: TicketRequestApi };
      return adaptTicketFromApi(payloadJson.data);
    },
    [actorHeaders, adaptTicketFromApi, apiBaseUrl]
  );

  const toggleExpanded = (ticketId: number) => {
    setExpandedTickets((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  };

  const openEditTicket = (ticket: TicketRequest) => {
    setEditingTicket(ticket);
    setEditError(null);
    setEditForm({
      titulo: ticket.titulo,
      categoria: ticket.categoria,
      insumos: ticket.insumos,
      cantidad: ticket.cantidad,
      monto: ticket.monto,
      facturaMonto: ticket.facturaMonto,
      notas: ticket.notas,
    });
  };

  const handleEditTicket = async () => {
    if (!editingTicket) return;
    try {
      setEditSaving(true);
      setEditError(null);
      const parsedMonto = parseAmount(editForm.monto);
      if (parsedMonto === undefined) {
        throw new Error('Monto estimado inválido. Usá números, puntos o comas.');
      }
      const parsedFacturaMonto = parseAmount(editForm.facturaMonto);
      if (parsedFacturaMonto === undefined) {
        throw new Error('Monto factura inválido. Usá números, puntos o comas.');
      }

      const response = await fetch(resolveEndpoint(`/api/tickets/${editingTicket.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...actorHeaders,
        },
        body: JSON.stringify({
          titulo: editForm.titulo.trim() || 'Pedido de insumos',
          categoria: editForm.categoria,
          insumos: editForm.insumos.trim(),
          cantidad: editForm.cantidad.trim() || '1',
          notas: editForm.notas.trim(),
          monto: parsedMonto,
          facturaMonto: parsedFacturaMonto,
        }),
      });
      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = await response.json();
          if (payload?.message) message = payload.message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      const payload = (await response.json()) as { data: TicketRequestApi };
      const updated = adaptTicketFromApi(payload.data);
      setTickets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditingTicket(null);
      setFlash({ type: 'success', message: 'Pedido actualizado.' });
    } catch (err) {
      setEditError((err as Error).message ?? 'No se pudo actualizar el ticket.');
    } finally {
      setEditSaving(false);
    }
  };

  const createTicket = async (autoApprove: boolean) => {
    const responsableId = formValues.responsableId ? Number(formValues.responsableId) : null;
    const destinatarioId = formValues.destinatarioId ? Number(formValues.destinatarioId) : null;
    const destinatarioNombre =
      formValues.destinatarioNombreManual.trim() || resolveAgenteNombre(destinatarioId) || null;
    const responsableNombre =
      formValues.responsableNombreManual.trim() || resolveAgenteNombre(responsableId) || null;

    if (!responsableNombre) {
      setFlash({ type: 'error', message: 'Asigná un agente responsable.' });
      return;
    }

    const parsedMonto = parseAmount(formValues.monto);
    if (parsedMonto === undefined) {
      setFlash({ type: 'error', message: 'Monto estimado inválido. Usá números, puntos o comas.' });
      return;
    }
    const parsedFacturaMonto = parseAmount(formValues.facturaMonto);
    if (parsedFacturaMonto === undefined) {
      setFlash({ type: 'error', message: 'Monto factura inválido. Usá números, puntos o comas.' });
      return;
    }

    try {
      setSaving(true);
      setFlash(null);
      const url = resolveEndpoint('/api/tickets');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...actorHeaders,
        },
        body: JSON.stringify({
          titulo: formValues.titulo.trim() || 'Pedido de insumos',
          categoria: formValues.categoria,
          insumos: formValues.insumos.trim(),
          cantidad: formValues.cantidad.trim() || null,
          notas: formValues.notas.trim(),
          monto: parsedMonto,
          facturaMonto: parsedFacturaMonto,
          destinatarioId,
          responsableId,
          solicitanteId: authUser?.id ?? null,
          facturaArchivos: facturaFiles.map((file) => ({
            name: file.name,
            dataUrl: file.dataUrl,
          })),
        }),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText || 'No se pudo crear el ticket.'}`;
        try {
          const payload = await response.json();
          if (payload && typeof payload === 'object' && typeof payload.message === 'string') {
            message = payload.message;
          } else if (typeof payload === 'string' && payload.trim()) {
            message = payload;
          }
        } catch {
          const text = await response.text().catch(() => '');
          if (text) {
            message = text;
          }
        }
        throw new Error(`${message} (${url})`);
      }

      const payload = (await response.json()) as { data: TicketRequestApi };
      let created = adaptTicketFromApi(payload.data);

      if (autoApprove) {
        try {
          created = await persistTicketUpdate(created.id, {
            estado: 'aprobado',
            responsableId: created.responsableId ?? HR_USER_ID ?? null,
          });
        } catch (err) {
          setFlash({
            type: 'error',
            message: (err as Error).message ?? 'No se pudo aprobar el pedido.',
          });
        }
      }

      const creationHistory = makeHistoryEntry(
        autoApprove ? 'Pedido creado y aprobado.' : 'Pedido creado y enviado al responsable.'
      );
      created = {
        ...created,
        solicitanteNombre: created.solicitanteNombre ?? authUser?.name ?? authUser?.email ?? null,
        solicitanteId: created.solicitanteId ?? authUser?.id ?? null,
        historial: [creationHistory, ...created.historial],
        responsableNombre: responsableNombre ?? created.responsableNombre,
        destinatarioNombre: destinatarioNombre ?? created.destinatarioNombre,
      };

      setTickets((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setFormValues((prev) => ({
        ...prev,
        titulo: '',
        insumos: '',
        cantidad: '1',
        notas: '',
        monto: '',
        facturaMonto: '',
        responsableId: '',
        responsableNombreManual: '',
        destinatarioId: '',
        destinatarioNombreManual: '',
        finalApproverId: '',
        finalApproverNombreManual: '',
      }));
      setFacturaFiles([]);
      setFlash({
        type: 'success',
        message: autoApprove ? 'Pedido creado y aprobado.' : 'Pedido registrado y notificado al responsable.',
      });
      await sendNotification(responsableId, `Nuevo pedido: ${created.titulo}`, {
        ticketId: created.id,
        destino: created.destinoLabel,
      });
      if (destinatarioId) {
        await sendNotification(destinatarioId, `Pedido para vos: ${created.titulo}`, {
          ticketId: created.id,
          destino: 'Destinatario',
        });
      }
      if (autoApprove) {
        await sendNotification(responsableId, `Pedido aprobado: ${created.titulo}`, {
          ticketId: created.id,
        });
      }
    } catch (err) {
      const localTicket: TicketRequest = {
        id: Date.now(),
        titulo: formValues.titulo.trim() || 'Pedido de insumos',
        categoria: formValues.categoria,
        insumos: formValues.insumos.trim(),
        cantidad: formValues.cantidad.trim() || '1',
        notas: formValues.notas.trim(),
        monto: formValues.monto.trim(),
        facturaMonto: formValues.facturaMonto.trim(),
        facturaArchivos: facturaFiles,
        destinatarioId,
        destinatarioNombre,
        responsableId,
        responsableNombre,
        finalApproverId: null,
        finalApproverNombre: null,
        destinoLabel: 'RRHH',
        estado: autoApprove ? 'aprobado' : 'pendiente_responsable',
        solicitanteId: authUser?.id ?? null,
        solicitanteNombre: authUser?.name ?? authUser?.email ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        historial: [
          makeHistoryEntry(
            autoApprove ? 'Pedido creado offline (aprobado).' : 'Pedido creado offline. Intentará sincronizar.'
          ),
        ],
      };
      setTickets((prev) => [localTicket, ...prev]);
      setFlash({
        type: 'error',
        message: `${(err as Error).message ?? 'No se pudo crear el ticket.'} (guardado localmente)`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createTicket(false);
  };

  const resolveHandoffId = (ticket: TicketRequest): number | null => {
    const selected = handoffTargets[ticket.id];
    if (selected && !Number.isNaN(Number(selected))) {
      return Number(selected);
    }
    if (ticket.estado === 'pendiente_rrhh' || ticket.estado === 'pendiente_compra') {
      return ticket.responsableId ?? null;
    }
    return null;
  };

  const handleApproveResponsable = async (ticket: TicketRequest) => {
    const nowIso = new Date().toISOString();
    const hrNombre = resolveAgenteNombre(HR_USER_ID);
    const nextResponsibleIdRaw = handoffTargets[ticket.id];
    const nextResponsibleId =
      nextResponsibleIdRaw && !Number.isNaN(Number(nextResponsibleIdRaw))
        ? Number(nextResponsibleIdRaw)
        : null;
    try {
      const updated = await persistTicketUpdate(ticket.id, {
        estado: 'pendiente_rrhh',
        responsableId: HR_USER_ID ?? ticket.responsableId ?? null,
      });
      const enriched: TicketRequest = {
        ...updated,
        responsableNombre: hrNombre ?? updated.responsableNombre ?? 'RRHH',
        historial: [makeHistoryEntry('Responsable aprobó y envió a RRHH.'), ...ticket.historial],
        updatedAt: nowIso,
      };
      setTickets((prev) => prev.map((item) => (item.id === ticket.id ? enriched : item)));
      setFlash({ type: 'success', message: 'Enviado a RRHH.' });
    } catch (err) {
      setFlash({ type: 'error', message: (err as Error).message ?? 'No se pudo actualizar el ticket.' });
      return;
    }
    await sendNotification(ticket.responsableId, `Tu pedido pasó a RRHH: ${ticket.titulo}`, {
      ticketId: ticket.id,
      destino: 'RRHH',
    });
    await notifyHr(ticket, `Pedido pendiente en RRHH: ${ticket.titulo}`);
    if (nextResponsibleId) {
      await sendNotification(
        nextResponsibleId,
        `Próximo responsable para compra (cuando RRHH apruebe): ${ticket.titulo}`,
        { ticketId: ticket.id, destino: 'Compra' }
      );
    }
  };

  const handleApproveRrhh = async (ticket: TicketRequest) => {
    const nowIso = new Date().toISOString();
    const targetId = resolveHandoffId(ticket);
    const targetNombre = resolveAgenteNombre(targetId);
    try {
      const updated = await persistTicketUpdate(ticket.id, {
        estado: 'pendiente_compra',
        responsableId: targetId ?? ticket.responsableId ?? HR_USER_ID ?? null,
      });
      const enriched: TicketRequest = {
        ...updated,
        responsableId: updated.responsableId ?? targetId ?? ticket.responsableId ?? null,
        responsableNombre: targetNombre ?? updated.responsableNombre,
        historial: [makeHistoryEntry('RRHH aprobó y envió a responsable para compra.'), ...ticket.historial],
        updatedAt: nowIso,
      };
      setTickets((prev) => prev.map((item) => (item.id === ticket.id ? enriched : item)));
      setFlash({ type: 'success', message: 'Enviado a responsable para compra.' });
    } catch (err) {
      setFlash({ type: 'error', message: (err as Error).message ?? 'No se pudo actualizar el ticket.' });
      return;
    }
    await sendNotification(
      targetId ?? ticket.responsableId ?? HR_USER_ID,
      `Pedido listo para comprar: ${ticket.titulo}`,
      {
        ticketId: ticket.id,
        destino: 'Compra',
      }
    );
  };

  const uploadFactura = async (ticket: TicketRequest, files: FileList | null) => {
    if (!files || files.length === 0) {
      setFlash({ type: 'error', message: 'Seleccioná al menos un archivo de factura.' });
      return;
    }
    try {
      const attachments = await Promise.all(
        Array.from(files).map(async (file) => ({
          name: file.name,
          dataUrl: await readFileAsDataUrl(file),
        }))
      );
      const response = await fetch(resolveEndpoint(`/api/tickets/${ticket.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...actorHeaders,
        },
        body: JSON.stringify({
          estado: ticket.estado,
          facturaArchivos: attachments,
        }),
      });
      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = await response.json();
          if (payload?.message) {
            message = payload.message;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      const payload = (await response.json()) as { data: TicketRequestApi };
      const updated = adaptTicketFromApi(payload.data);
      setTickets((prev) => prev.map((item) => (item.id === ticket.id ? updated : item)));
      setFlash({ type: 'success', message: 'Factura adjuntada correctamente.' });
    } catch (err) {
      setFlash({ type: 'error', message: (err as Error).message ?? 'No se pudo adjuntar la factura.' });
    }
  };

  const handleApproveFinal = async (ticket: TicketRequest) => {
    const nowIso = new Date().toISOString();
    try {
      const updated = await persistTicketUpdate(ticket.id, { estado: 'aprobado' });
      const enriched: TicketRequest = {
        ...updated,
        historial: [makeHistoryEntry('Compra aprobada.'), ...ticket.historial],
        updatedAt: nowIso,
      };
      setTickets((prev) => prev.map((item) => (item.id === ticket.id ? enriched : item)));
      setFlash({ type: 'success', message: 'Pedido aprobado.' });
    } catch (err) {
      setFlash({ type: 'error', message: (err as Error).message ?? 'No se pudo actualizar el ticket.' });
      return;
    }
    await sendNotification(ticket.responsableId, `Pedido aprobado: ${ticket.titulo}`, {
      ticketId: ticket.id,
    });
    if (ticket.solicitanteId && ticket.solicitanteId !== ticket.responsableId) {
      await sendNotification(ticket.solicitanteId, `Tu pedido fue aprobado: ${ticket.titulo}`, {
        ticketId: ticket.id,
      });
    }
  };

  const handleReject = async (ticket: TicketRequest) => {
    const reason = window.prompt('Motivo del rechazo (opcional):', '') ?? '';
    const nowIso = new Date().toISOString();
    try {
      const updated = await persistTicketUpdate(ticket.id, { estado: 'rechazado' });
      const enriched: TicketRequest = {
        ...updated,
        historial: [
          makeHistoryEntry(`Rechazado${reason.trim() ? `: ${reason.trim()}` : ''}`),
          ...ticket.historial,
        ],
        updatedAt: nowIso,
      };
      setTickets((prev) => prev.map((item) => (item.id === ticket.id ? enriched : item)));
      setFlash({ type: 'error', message: 'Pedido rechazado.' });
    } catch (err) {
      setFlash({ type: 'error', message: (err as Error).message ?? 'No se pudo rechazar el ticket.' });
      return;
    }
    const suffix = reason.trim() ? ` Motivo: ${reason.trim()}` : '';
    await sendNotification(ticket.responsableId, `Pedido rechazado: ${ticket.titulo}.${suffix}`, {
      ticketId: ticket.id,
    });
    if (ticket.solicitanteId && ticket.solicitanteId !== ticket.responsableId) {
      await sendNotification(ticket.solicitanteId, `Rechazaron tu pedido: ${ticket.titulo}.${suffix}`, {
        ticketId: ticket.id,
      });
    }
  };

  const filteredTickets = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    return [...tickets]
      .filter((ticket) => {
        if (!filters.estado) {
          return true;
        }
        return ticket.estado === filters.estado;
      })
      .filter((ticket) => {
        if (!filters.onlyMine || !authUser?.id) {
          return true;
        }
        return (
          ticket.responsableId === authUser.id ||
          ticket.finalApproverId === authUser.id ||
          ticket.solicitanteId === authUser.id
        );
      })
      .filter((ticket) => {
        if (!normalizedSearch) {
          return true;
        }
        return [ticket.titulo, ticket.insumos, ticket.notas, ticket.responsableNombre, ticket.finalApproverNombre]
          .filter(Boolean)
          .some((value) => (value ?? '').toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => {
        const aTime = Date.parse(a.updatedAt || a.createdAt);
        const bTime = Date.parse(b.updatedAt || b.createdAt);
        return bTime - aTime;
      });
  }, [tickets, filters.estado, filters.onlyMine, filters.search, authUser?.id]);

  const agenteOptions = useMemo(() => meta?.agentes ?? [], [meta?.agentes]);
  const canOperateAsResponsable = (ticket: TicketRequest) => {
    if (ticket.estado !== 'pendiente_responsable') {
      return false;
    }
    if (!authUser?.id) {
      return false;
    }
    return ticket.responsableId === authUser.id || isElevatedRole(userRole);
  };

  const canOperateAsRrhh = (ticket: TicketRequest) => {
    if (ticket.estado !== 'pendiente_rrhh') {
      return false;
    }
    return isHrUser;
  };

  const canOperateAsFinal = (ticket: TicketRequest) => {
    if (ticket.estado !== 'pendiente_compra') {
      return false;
    }
    if (!authUser?.id) {
      return isElevatedRole(userRole);
    }
    if (isElevatedRole(userRole)) {
      return true;
    }
    return ticket.finalApproverId === authUser.id;
  };

  return (
    <DashboardLayout title="Ticketera" subtitle="Pedidos de insumos con dos aprobaciones">
      {flash ? (
        <div
          className={`flash-message${flash.type === 'error' ? ' flash-message--error' : ''}`}
          role="alert"
        >
          <span>{flash.message}</span>
          <button type="button" onClick={() => setFlash(null)} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      ) : null}

      <section className="panel-grid">
        <div className="card">
          <div className="card-header">
            <h3>Crear pedido</h3>
            <p className="card-subtitle">
              Carga el insumo, asigna un responsable y define si lo aprueba administración 2 o contable.
            </p>
          </div>
          <form className="card-body form-grid" onSubmit={handleSubmit}>
            <label className="input-control">
              <span>Categoría</span>
              <select
                value={formValues.categoria}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    categoria: event.target.value as TicketCategory,
                  }))
                }
              >
                {TICKET_CATEGORIES.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Título</span>
              <input
                type="text"
                placeholder="Ej: Cajas, etiquetas, EPP..."
                value={formValues.titulo}
                onChange={(event) => setFormValues((prev) => ({ ...prev, titulo: event.target.value }))}
              />
            </label>
            <label className="input-control">
              <span>Insumos / Detalle</span>
              <textarea
                rows={3}
                placeholder="Detalle del pedido"
                value={formValues.insumos}
                onChange={(event) => setFormValues((prev) => ({ ...prev, insumos: event.target.value }))}
              />
            </label>
            <label className="input-control">
              <span>Cantidad</span>
              <input
                type="text"
                value={formValues.cantidad}
                onChange={(event) => setFormValues((prev) => ({ ...prev, cantidad: event.target.value }))}
              />
            </label>
            <div className="form-grid two-columns">
              <label className="input-control">
                <span>Monto factura</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={formValues.monto}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, monto: event.target.value }))}
                />
              </label>
              <label className="input-control">
                <span>Monto estimado</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={formValues.facturaMonto}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, facturaMonto: event.target.value }))}
                />
              </label>
            </div>
            <div className="form-grid two-columns">
              <label className="input-control">
                <span>Agente responsable</span>
                <select
                  value={formValues.responsableId}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, responsableId: event.target.value }))}
                  disabled={metaLoading}
                >
                  <option value="">Seleccionar</option>
                  {agenteOptions.map((agente) => (
                    <option key={agente.id} value={agente.id ?? ''}>
                      {agente.name ?? `Agente #${agente.id}`}
                    </option>
                  ))}
                </select>
                <small>Si no aparece en la lista, completalo abajo.</small>
                <input
                  type="text"
                  placeholder="Responsable (manual)"
                  value={formValues.responsableNombreManual}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, responsableNombreManual: event.target.value }))
                  }
                />
              </label>
              <div />
            </div>
            <div className="form-grid two-columns">
              <label className="input-control">
                <span>¿Para quién es el pedido?</span>
                <select
                  value={formValues.destinatarioId}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, destinatarioId: event.target.value }))}
                  disabled={metaLoading}
                >
                  <option value="">Seleccionar</option>
                  {agenteOptions.map((agente) => (
                    <option key={agente.id} value={agente.id ?? ''}>
                      {agente.name ?? `Agente #${agente.id}`}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Destinatario (manual)"
                  value={formValues.destinatarioNombreManual}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, destinatarioNombreManual: event.target.value }))
                  }
                />
              </label>
              <div />
            </div>

            <label className="input-control">
              <span>Factura (imágenes)</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFacturaFilesChange}
              />
              {facturaFiles.length > 0 ? (
                <div className="chip-list">
                  {facturaFiles.map((file) => (
                    <span key={file.id} className="chip">
                      <span>{file.name}</span>
                      <button type="button" onClick={() => handleRemoveFacturaFile(file.id)} aria-label={`Quitar ${file.name}`}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <small>Podés adjuntar fotos de la factura.</small>
              )}
            </label>

            <label className="input-control">
              <span>Notas</span>
              <textarea
                rows={2}
                placeholder="Instrucciones, links de compra o presupuestos"
                value={formValues.notas}
                onChange={(event) => setFormValues((prev) => ({ ...prev, notas: event.target.value }))}
              />
            </label>
            {metaError ? <p className="form-info form-info--error">{metaError}</p> : null}
            {metaLoading ? <p className="form-info">Cargando agentes...</p> : null}
            <div className="form-actions">
              <button type="submit" className="primary-action" disabled={saving}>
                {saving ? 'Guardando...' : 'Registrar pedido'}
              </button>
              <button
                type="button"
                className="secondary-action"
                disabled={saving}
                onClick={() => {
                  void createTicket(true);
                }}
              >
                {saving ? 'Guardando...' : 'Aprobar pedido'}
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Pedidos y aprobaciones</h3>
            <p className="card-subtitle">
              Filtra por estado o quedate con los tickets donde sos parte.
            </p>
            <div className="form-grid two-columns">
              <label className="input-control">
                <span>Buscar</span>
                <input
                  type="search"
                  placeholder="Título, insumo, responsable..."
                  value={filters.search}
                  onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                />
              </label>
              <label className="input-control">
                <span>Estado</span>
                <select
                  value={filters.estado}
                  onChange={(event) => setFilters((prev) => ({ ...prev, estado: event.target.value }))}
                >
                  <option value="">Todos</option>
                  <option value="pendiente_responsable">Pendiente responsable</option>
                  <option value="pendiente_rrhh">Pendiente RRHH</option>
                  <option value="pendiente_compra">Pendiente compra</option>
                  <option value="aprobado">Aprobado</option>
                  <option value="rechazado">Rechazado</option>
                </select>
              </label>
              <label className="input-control">
                <span>Mostrar solo mis tickets</span>
                <div className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={filters.onlyMine}
                    onChange={(event) => setFilters((prev) => ({ ...prev, onlyMine: event.target.checked }))}
                  />
                  <span>Como solicitante, responsable o aprobador final</span>
                </div>
              </label>
            </div>
          </div>
          <div className="card-body">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Categoría</th>
                    <th>Monto</th>
                    <th>Responsable</th>
                    <th>Admin/Contable</th>
                    <th>Enviar a</th>
                    <th>Estado</th>
                    <th>Actualizado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketsLoading ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center' }}>
                        Cargando tickets...
                      </td>
                    </tr>
                  ) : null}
                  {ticketsError && !ticketsLoading ? (
                    <tr>
                      <td colSpan={9} className="error-cell">
                        {ticketsError}
                      </td>
                    </tr>
                  ) : null}
                  {!ticketsLoading && !ticketsError && filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center' }}>
                        No hay pedidos cargados.
                      </td>
                    </tr>
                  ) : null}
                  {!ticketsLoading &&
                    !ticketsError &&
                    filteredTickets.map((ticket) => {
                      const updatedLabel = ticket.updatedAt
                        ? new Date(ticket.updatedAt).toLocaleString('es-AR')
                        : ticket.createdAt
                        ? new Date(ticket.createdAt).toLocaleString('es-AR')
                        : '—';
                      const canApprove = canOperateAsResponsable(ticket);
                      const canFinalApprove = canOperateAsFinal(ticket);
                      const canRrhhApprove = canOperateAsRrhh(ticket);
                      const handoffValue =
                        handoffTargets[ticket.id] ??
                        (resolveHandoffId(ticket) != null ? String(resolveHandoffId(ticket)) : '');

                      return (
                        <React.Fragment key={ticket.id}>
                          <tr>
                            <td>
                              <div className="table-title">
                                <strong>{ticket.titulo}</strong>
                              </div>
                              <div className="small-text">{ticket.insumos || 'Sin detalle'}</div>
                            </td>
                            <td>{ticket.categoria}</td>
                            <td>{ticket.monto && Number(ticket.monto) ? Number(ticket.monto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }) : ticket.monto || '—'}</td>
                            <td>
                              <div>{ticket.responsableNombre ?? '—'}</div>
                              {ticket.solicitanteNombre ? (
                                <div className="small-text">Solicitado por {ticket.solicitanteNombre}</div>
                              ) : null}
                            </td>
                            <td>
                              <div>{ticket.finalApproverNombre ?? ticket.destinoLabel ?? '—'}</div>
                              <div className="small-text">{ticket.destinoLabel}</div>
                            </td>
                            <td>
                              {(canApprove || canRrhhApprove || canFinalApprove) ? (
                                <select
                                  value={handoffValue}
                                  onChange={(event) =>
                                    setHandoffTargets((prev) => ({
                                      ...prev,
                                      [ticket.id]: event.target.value,
                                    }))
                                  }
                                >
                                  <option value="">Seleccionar</option>
                                  {agenteOptions.map((agente) => (
                                    <option key={agente.id} value={agente.id ?? ''}>
                                      {agente.name ?? `Agente #${agente.id}`}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="small-text">—</span>
                              )}
                            </td>
                            <td>
                              <span className={`estado-badge ${getEstadoClass(ticket.estado)}`}>
                                {getEstadoLabel(ticket.estado)}
                              </span>
                              {ticket.facturaArchivos?.length ? (
                                <div className="small-text" style={{ marginTop: '0.25rem' }}>
                                  📎 Factura adjunta
                                </div>
                              ) : null}
                            </td>
                            <td>{updatedLabel}</td>
                            <td>
                              <div className="action-buttons">
                                <button
                                  type="button"
                                  onClick={() => toggleExpanded(ticket.id)}
                                  aria-label="Ver detalle"
                                >
                                  {expandedTickets.has(ticket.id) ? 'Ocultar' : 'Detalle'}
                                </button>
                                {(ticket.solicitanteId === authUser?.id || ticket.responsableId === authUser?.id || isElevatedRole(userRole)) ? (
                                  <button
                                    type="button"
                                    className="secondary-action"
                                    onClick={() => openEditTicket(ticket)}
                                  >
                                    Editar
                                  </button>
                                ) : null}
                                {ticket.estado === 'pendiente_responsable' && canApprove ? (
                                  <button
                                    type="button"
                                    className="primary-action"
                                    onClick={() => handleApproveResponsable(ticket)}
                                  >
                                    Enviar a RRHH
                                  </button>
                                ) : null}
                                {ticket.estado === 'pendiente_rrhh' && canRrhhApprove ? (
                                  <button
                                    type="button"
                                    className="primary-action"
                                    onClick={() => handleApproveRrhh(ticket)}
                                  >
                                    RRHH: Enviar a responsable
                                  </button>
                                ) : null}
                                {ticket.estado === 'pendiente_compra' && canFinalApprove ? (
                                  <button
                                    type="button"
                                    className="primary-action"
                                    onClick={() => handleApproveFinal(ticket)}
                                  >
                                    Aprobar compra
                                  </button>
                                ) : null}
                                {ticket.estado === 'pendiente_compra' && canFinalApprove ? (
                                  <button
                                    type="button"
                                    className="secondary-action"
                                    onClick={async () => {
                                      const targetId = resolveHandoffId(ticket);
                                      if (!targetId) {
                                        setFlash({ type: 'error', message: 'Elegí un responsable en "Enviar a".' });
                                        return;
                                      }
                                      try {
                                        const updated = await persistTicketUpdate(ticket.id, {
                                          estado: ticket.estado,
                                          responsableId: targetId,
                                        });
                                        const enriched: TicketRequest = {
                                          ...updated,
                                          responsableId: targetId,
                                          responsableNombre: resolveAgenteNombre(targetId) ?? updated.responsableNombre,
                                          historial: [makeHistoryEntry('Reenvío a responsable para compra.'), ...ticket.historial],
                                        };
                                        setTickets((prev) =>
                                          prev.map((item) => (item.id === ticket.id ? enriched : item))
                                        );
                                        setFlash({ type: 'success', message: 'Reenviado al responsable para compra.' });
                                      } catch (err) {
                                        setFlash({
                                          type: 'error',
                                          message: (err as Error).message ?? 'No se pudo reenviar el pedido.',
                                        });
                                        return;
                                      }
                                      await sendNotification(targetId, `Pedido reenviado para compra: ${ticket.titulo}`, {
                                        ticketId: ticket.id,
                                      });
                                    }}
                                  >
                                    Volver a enviar
                                  </button>
                                ) : null}
                                {(ticket.estado === 'pendiente_responsable' && canApprove) ||
                                (ticket.estado === 'pendiente_rrhh' && canRrhhApprove) ||
                                (ticket.estado === 'pendiente_compra' && canFinalApprove) ? (
                                  <button
                                    type="button"
                                    className="secondary-action"
                                    onClick={() => handleReject(ticket)}
                                  >
                                    Rechazar
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                          {expandedTickets.has(ticket.id) ? (
                            <tr>
                              <td colSpan={9}>
                                <div
                                  style={{
                                    background: '#f7f9fc',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                                    gap: '16px',
                                  }}
                                >
                                  <div style={{ display: 'grid', gap: '8px' }}>
                                    <div>
                                      <strong>Detalle</strong>
                                      <p>{ticket.insumos || 'Sin detalle'}</p>
                                    </div>
                                    <div>
                                      <strong>Categoría</strong>
                                      <p>{ticket.categoria}</p>
                                    </div>
                                    <div>
                                      <strong>Para</strong>
                                      <p>{ticket.destinatarioNombre ?? 'No indicado'}</p>
                                    </div>
                                    <div>
                                      <strong>Notas</strong>
                                      <p>{ticket.notas || '—'}</p>
                                    </div>
                                  </div>

                                  <div style={{ display: 'grid', gap: '8px' }}>
                                    <div>
                                      <strong>Montos</strong>
                                      <p>
                                        Monto estimado:{' '}
                                        {ticket.monto && Number(ticket.monto)
                                          ? Number(ticket.monto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
                                          : ticket.monto || '—'}
                                      </p>
                                      <p>
                                        Monto factura:{' '}
                                        {ticket.facturaMonto && Number(ticket.facturaMonto)
                                          ? Number(ticket.facturaMonto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
                                          : ticket.facturaMonto || '—'}
                                      </p>
                                    </div>
                                    <div>
                                      <strong>Historial</strong>
                                      {ticket.historial.length === 0 ? (
                                        <p className="small-text">Sin movimientos.</p>
                                      ) : (
                                        <ul className="history-list">
                                          {ticket.historial.map((item) => (
                                            <li key={item.id}>
                                              <strong>{item.actor ?? 'Sistema'}: </strong>
                                              {item.mensaje}{' '}
                                              <span className="small-text">
                                                {item.fecha ? new Date(item.fecha).toLocaleString('es-AR') : '—'}
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </div>

                                  <div style={{ display: 'grid', gap: '8px' }}>
                                    <div>
                                      <strong>Factura adjunta</strong>
                                      {ticket.facturaArchivos?.length ? (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                          {ticket.facturaArchivos.map((file) => (
                                            <button
                                              type="button"
                                              key={file.id}
                                              className="chip"
                                              onClick={() => downloadTicketFactura(file)}
                                            >
                                              {file.name} <span className="small-text">({Math.round(file.size / 1024)} KB)</span>
                                            </button>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="small-text">Sin adjuntos.</p>
                                      )}
                                      <p className="small-text">Archivos disponibles para descargar.</p>
                                    </div>

                                    {(ticket.estado === 'pendiente_rrhh' && canRrhhApprove) ||
                                    (ticket.estado === 'aprobado' && isHrUser) ? (
                                      <div>
                                        <strong>Factura (RRHH)</strong>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          multiple
                                          onChange={(event) => uploadFactura(ticket, event.target.files)}
                                        />
                                        <p className="small-text">
                                          Solo RRHH puede adjuntar o reemplazar la factura{ticket.estado === 'aprobado' ? ' (incluso luego de aprobada)' : ''}.
                                        </p>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {editingTicket ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>Editar pedido</h3>
              <button type="button" className="secondary-action" onClick={() => setEditingTicket(null)}>
                ×
              </button>
            </div>
            {editError ? <p className="form-info form-info--error">{editError}</p> : null}
            <div className="form-grid">
              <label className="input-control">
                <span>Título</span>
                <input
                  type="text"
                  value={editForm.titulo}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, titulo: e.target.value }))}
                />
              </label>
              <label className="input-control">
                <span>Categoría</span>
                <select
                  value={editForm.categoria}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, categoria: e.target.value as TicketCategory }))}
                >
                  {TICKET_CATEGORIES.map((categoria) => (
                    <option key={categoria} value={categoria}>
                      {categoria}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="input-control">
              <span>Insumos / Detalle</span>
              <textarea
                rows={3}
                value={editForm.insumos}
                onChange={(e) => setEditForm((prev) => ({ ...prev, insumos: e.target.value }))}
              />
            </label>
            <div className="form-grid two-columns">
              <label className="input-control">
                <span>Cantidad</span>
                <input
                  type="text"
                  value={editForm.cantidad}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, cantidad: e.target.value }))}
                />
              </label>
              <label className="input-control">
                <span>Notas</span>
                <input
                  type="text"
                  value={editForm.notas}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, notas: e.target.value }))}
                />
              </label>
            </div>
            <div className="form-grid two-columns">
              <label className="input-control">
                <span>Monto factura</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editForm.monto}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, monto: e.target.value }))}
                />
              </label>
              <label className="input-control">
                <span>Monto estimado</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editForm.facturaMonto}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, facturaMonto: e.target.value }))}
                />
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="secondary-action" onClick={() => setEditingTicket(null)} disabled={editSaving}>
                Cancelar
              </button>
              <button type="button" className="primary-action" onClick={handleEditTicket} disabled={editSaving}>
                {editSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
};
