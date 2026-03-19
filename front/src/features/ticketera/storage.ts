import type { FacturaAttachment, TicketRequest, TicketStatus } from './types';

const TICKETS_STORAGE_KEY = 'ticketera:requests';

export const readTicketsFromStorage = (): TicketRequest[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(TICKETS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => typeof item === 'object' && item !== null)
      .map((item) => {
        const rawEstado = String((item as TicketRequest).estado ?? '');
        const normalizedEstado = (() => {
          if (rawEstado === 'pendiente_final' || rawEstado === 'pendiente_admin2') {
            return 'pendiente_compra' as TicketStatus;
          }
          return rawEstado as TicketStatus;
        })();
        const withDefaults: TicketRequest = {
          categoria: (item as TicketRequest).categoria ?? 'Insumos varios',
          monto: (item as TicketRequest).monto ?? '',
          facturaMonto: (item as TicketRequest).facturaMonto ?? '',
          facturaArchivos: Array.isArray((item as TicketRequest).facturaArchivos)
            ? ((item as TicketRequest).facturaArchivos as FacturaAttachment[])
            : [],
          destinatarioId: (item as TicketRequest).destinatarioId ?? null,
          destinatarioNombre: (item as TicketRequest).destinatarioNombre ?? null,
          estado: normalizedEstado,
          ...item,
          historial: Array.isArray((item as TicketRequest).historial) ? (item as TicketRequest).historial : [],
        } as TicketRequest;
        return withDefaults;
      });
  } catch {
    return [];
  }
};

export const writeTicketsToStorage = (tickets: TicketRequest[]) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(tickets));
  } catch {
    // ignore storage errors
  }
};

