import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { PersonalRecord } from '../features/personal/types';

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

type PersonalDetail = {
  id: number;
  documents: any[];
  comments: any[];
  history: any[];
  [key: string]: any;
};

type PersonalDocumentType = {
  id: number;
  nombre: string | null;
  vence: boolean;
};

type PersonalMeta = {
  perfiles: Array<{ value: number; label: string }>;
  clientes: Array<{ id: number; nombre: string | null }>;
  sucursales: Array<{ id: number; cliente_id: number | null; nombre: string | null }>;
  agentes: Array<{ id: number; name: string | null }>;
  unidades: Array<{ id: number; matricula: string | null; marca: string | null; modelo: string | null }>;
  estados: Array<{ id: number; nombre: string | null }>;
  documentTypes?: PersonalDocumentType[];
};

type AltaAttachmentItem = {
  id: string;
  file: File;
  typeId: string;
  typeName: string;
  vence: string | null;
  positionLabel: string | null;
  previewUrl?: string | null;
};

type AltaRequestForm = {
  perfilValue: number;
  nombres: string;
  apellidos: string;
  telefono: string;
  email: string;
  tarifaEspecial: boolean;
  observacionTarifa: string;
  cuil: string;
  cbuAlias: string;
  pago: string;
  esCobrador: boolean;
  cobradorNombre: string;
  cobradorEmail: string;
  cobradorCuil: string;
  cobradorCbuAlias: string;
  combustible: boolean;
  fechaAlta: string;
  patente: string;
  clienteId: string;
  sucursalId: string;
  agenteId: string;
  agenteResponsableId: string;
  agenteResponsableIds: string[];
  unidadId: string;
  estadoId: string;
  fechaAltaVinculacion: string;
  observaciones: string;
  duenoNombre: string;
  duenoFechaNacimiento: string;
  duenoEmail: string;
  duenoCuil: string;
  duenoCuilCobrador: string;
  duenoCbuAlias: string;
  duenoTelefono: string;
  duenoObservaciones: string;
};

type AltaSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type CombustibleRequestForm = {
  empresaId: string;
  sucursalId: string;
  nombreCompleto: string;
  dni: string;
  serviClubEmail: string;
  patente: string;
  marca: string;
  modelo: string;
  kilometraje: string;
  observaciones: string;
  agenteId: string;
};

type AdelantoRequestForm = {
  empresaId: string;
  sucursalId: string;
  transportista: string;
  monto: string;
  fechaSolicitud: string;
  motivo: string;
  observaciones: string;
  agenteId: string;
  destinatarioIds: string[];
  estado: string;
};

type PrestamoRequestForm = {
  solicitanteNombre: string;
  numeroOrden: string;
  montoSolicitado: string;
  cantidadCuotas: string;
  cuotasPagadas: string;
  fechaNecesaria: string;
  destinatarioIds: string[];
  observaciones: string;
  estado: string;
};

type VacacionesRequestForm = {
  empleadoId: string;
  empleadoNombre: string;
  fechaDesde: string;
  fechaHasta: string;
  diasHabiles: string;
  motivo: string;
  estado: string;
  destinatarioIds: string[];
};

type AumentoCombustibleForm = {
  empresaId: string;
  sucursalId: string;
  nombreCompleto: string;
  dni: string;
  serviClubEmail: string;
  patente: string;
  marca: string;
  modelo: string;
  kilometraje: string;
  litrosActuales: string;
  litrosSolicitados: string;
  motivo: string;
  agenteId: string;
};

type PolizaRequestForm = {
  polizaFile: File | null;
  comprobanteFile: File | null;
  observaciones: string;
  agenteId: string;
};

type AltaEditableField = Exclude<
  keyof AltaRequestForm,
  'tarifaEspecial' | 'combustible' | 'perfilValue' | 'agenteResponsableIds' | 'esCobrador'
>;

const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const LOCAL_SOLICITUDES_STORAGE_KEY = 'approvals:localSolicitudes';
const SOLICITUD_CREATED_CACHE_KEY = 'personal:solicitudes:createdAt';
const RECHAZADOS_STORAGE_KEY = 'personal:rechazados';

const readRejectedIds = (): Set<number> => {
  if (typeof window === 'undefined') {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(RECHAZADOS_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.map((value) => Number(value)).filter((id) => Number.isFinite(id)));
  } catch {
    return new Set();
  }
};

const writeRejectedIds = (ids: Set<number>) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(RECHAZADOS_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore
  }
};

const readSolicitudCreatedCache = (): Map<number, string> => {
  if (typeof window === 'undefined') {
    return new Map();
  }
  try {
    const raw = window.localStorage.getItem(SOLICITUD_CREATED_CACHE_KEY);
    if (!raw) {
      return new Map();
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const entries = Object.entries(parsed)
        .map(([key, value]) => [Number(key), String(value)] as [number, string])
        .filter(([id, value]) => Number.isFinite(id) && value.trim().length > 0);
      return new Map(entries);
    }
  } catch {
    // ignore
  }
  return new Map();
};

const writeSolicitudCreatedCache = (cache: Map<number, string>) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const payload: Record<string, string> = {};
    cache.forEach((value, key) => {
      if (value) {
        payload[String(key)] = value;
      }
    });
    window.localStorage.setItem(SOLICITUD_CREATED_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
};

const getSolicitudEstadoBadgeClass = (estado?: string | null) => {
  const normalized = (estado ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (normalized.startsWith('aprob')) {
    return 'estado-badge--aprobado';
  }
  if (normalized.startsWith('rechaz')) {
    return 'estado-badge--rechazado';
  }
  if (normalized === 'enviado') {
    return 'estado-badge--enviado';
  }
  if (normalized === 'pagado') {
    return 'estado-badge--pagado';
  }
  if (normalized === 'pendiente') {
    return 'estado-badge--pendiente';
  }

  return 'estado-badge--default';
};

export type ApprovalsRequestsPageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  buildActorHeaders: (authUser: AuthUser | null | undefined) => Record<string, string>;
  parseJsonSafe: (response: Response) => Promise<any>;
  resolveApiUrl: (baseUrl: string, target?: string | null) => string | null;
  getUserRole: (authUser: AuthUser | null | undefined) => string;
  isPersonalEditor: (authUser: AuthUser | null | undefined) => boolean;
  getPerfilDisplayLabel: (perfilValue: number | null, perfil?: string) => string;
  formatPagoLabel: (value: string | null | undefined) => string;
  serializePagoValue: (value: string | number | boolean | null | undefined) => number | null;
  formatCurrency: (value: string | number | null | undefined) => string;
  createImagePreviewUrl: (file: File) => string | null;
  revokeImagePreviewUrl: (url?: string | null) => void;
  writeCachedSolicitudData: (id: number | null | undefined, data: unknown) => void;
  PAGO_SELECT_OPTIONS: Array<{ value: string; label: string }>;
  PERSON_TAX_ID_LABEL: string;
  COLLECTOR_TAX_ID_LABEL: string;
  OWNER_TAX_ID_LABEL: string;
  OWNER_COLLECTOR_TAX_ID_LABEL: string;
};

export const ApprovalsRequestsPage: React.FC<ApprovalsRequestsPageProps> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  buildActorHeaders,
  parseJsonSafe,
  resolveApiUrl,
  getUserRole,
  isPersonalEditor,
  getPerfilDisplayLabel,
  formatPagoLabel,
  serializePagoValue,
  formatCurrency,
  createImagePreviewUrl,
  revokeImagePreviewUrl,
  writeCachedSolicitudData,
  PAGO_SELECT_OPTIONS,
  PERSON_TAX_ID_LABEL,
  COLLECTOR_TAX_ID_LABEL,
  OWNER_TAX_ID_LABEL,
  OWNER_COLLECTOR_TAX_ID_LABEL,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const authUser = useStoredAuthUser();
  const userRole = useMemo(() => getUserRole(authUser), [authUser]);
  const isAdmin = userRole === 'admin' || userRole === 'admin2';
  const canManagePersonal = useMemo(() => isPersonalEditor(authUser), [authUser]);
  const actorHeaders = useMemo(() => buildActorHeaders(authUser), [authUser]);
  const isSolicitudPersonalView = location.pathname === '/solicitud-personal';
  const [activeTab, setActiveTab] = useState<
    | 'list'
    | 'altas'
    | 'combustible'
    | 'aumento_combustible'
    | 'adelanto'
    | 'poliza'
    | 'prestamo'
    | 'vacaciones'
    | 'cambio_asignacion'
  >('list');
  const splitRazonSocial = useCallback((razonSocial: string | null | undefined) => {
    if (!razonSocial) {
      return null;
    }
    const raw = razonSocial.trim();
    if (!raw) {
      return null;
    }
    const parts = raw.split(',');
    if (parts.length >= 2) {
      return { apellidos: parts[0].trim(), nombres: parts.slice(1).join(' ').trim() };
    }
    const tokens = raw.split(/\s+/);
    if (tokens.length >= 2) {
      return { apellidos: tokens[0], nombres: tokens.slice(1).join(' ').trim() };
    }
    return { apellidos: '', nombres: raw };
  }, []);
  const parseNosisXml = useCallback((payload: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(payload, 'application/xml');

      const getText = (selector: string) => doc.getElementsByTagName(selector)?.[0]?.textContent?.trim() ?? '';
      const contenido = doc.getElementsByTagName('Contenido')?.[0] ?? null;
      const resultado = contenido?.getElementsByTagName('Resultado')?.[0] ?? null;
      const datos = contenido?.getElementsByTagName('Datos')?.[0] ?? null;
      const persona = datos?.getElementsByTagName('Persona')?.[0] ?? null;
      const cbuNode = datos?.getElementsByTagName('Cbu')?.[0] ?? null;

      const razonSocial = persona ? (persona.getElementsByTagName('RazonSocial')[0]?.textContent?.trim() ?? '') : '';
      const documento = persona ? (persona.getElementsByTagName('Documento')[0]?.textContent?.trim() ?? '') : '';
      const fechaNacimiento = persona ? (persona.getElementsByTagName('FechaNacimiento')[0]?.textContent?.trim() ?? '') : '';
      const cbuEstado = cbuNode ? (cbuNode.getElementsByTagName('Estado')[0]?.textContent?.trim() ?? '') : '';
      const cbuNovedad = cbuNode ? (cbuNode.getElementsByTagName('Novedad')[0]?.textContent?.trim() ?? '') : '';
      const resultadoEstado = resultado ? (resultado.getElementsByTagName('Estado')[0]?.textContent?.trim() ?? '') : '';
      const resultadoNovedad = resultado ? (resultado.getElementsByTagName('Novedad')[0]?.textContent?.trim() ?? '') : '';

      const pieces = [resultadoNovedad, cbuNovedad, cbuEstado].filter(Boolean);
      const message = pieces.length > 0 ? pieces.join(' · ') : getText('Novedad') || payload;

      const valid = resultadoEstado === '200' && ['aprobado', 'validado'].some((needle) =>
        (cbuEstado || resultadoNovedad || '').toLowerCase().includes(needle)
      );

      return {
        message,
        valid,
        razonSocial,
        documento,
        fechaNacimiento,
        cbuEstado,
      };
    } catch {
      return null;
    }
  }, []);
  const normalizeNosisDate = useCallback((value: string | null | undefined): string => {
    const raw = (value ?? '').trim();
    if (!raw) {
      return '';
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }
    const slashMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      return `${year}-${month}-${day}`;
    }
    return '';
  }, []);
  const [meta, setMeta] = useState<PersonalMeta | null>(null);
  const [rejectedIds, setRejectedIds] = useState<Set<number>>(() => readRejectedIds());
  const [solicitudCreatedCache, setSolicitudCreatedCache] = useState<Map<number, string>>(
    () => readSolicitudCreatedCache()
  );
  const cacheSolicitudCreated = useCallback(
    (id: number | null | undefined, created: string | null | undefined) => {
      if (id == null || !Number.isFinite(Number(id)) || !created) {
        return;
      }
      setSolicitudCreatedCache((prev) => {
        const prevValue = prev.get(Number(id));
        if (prevValue === created) {
          return prev;
        }
        const next = new Map(prev);
        next.set(Number(id), created);
        writeSolicitudCreatedCache(next);
        return next;
      });
    },
    []
  );
  const allowedAltaPerfiles = useMemo(() => {
    const perfiles = meta?.perfiles ?? [];
    const filtered = perfiles.filter((perfil) => perfil.value !== 2);
    return filtered.length > 0 ? filtered : perfiles;
  }, [meta?.perfiles]);
  const resolveSolicitudAgenteId = useCallback((detail: PersonalDetail | PersonalRecord | null | undefined) => {
    if (!detail) {
      return null;
    }
    const fromDetail = detail.agenteId ?? (detail as any)?.agente_id ?? null;
    if (fromDetail != null && !Number.isNaN(Number(fromDetail))) {
      return Number(fromDetail);
    }
    const data = detail.solicitudData as { form?: { agenteId?: string | number | null } } | undefined;
    const fromForm = data?.form?.agenteId ?? null;
    if (fromForm != null && !Number.isNaN(Number(fromForm))) {
      return Number(fromForm);
    }
    return null;
  }, []);
  const resolveSolicitudFullName = useCallback((detail: PersonalDetail | PersonalRecord | null | undefined) => {
    if (!detail) {
      return '';
    }
    const parts = [detail.nombres ?? (detail as any)?.nombre, detail.apellidos];
    const joined = parts.filter((part) => part && String(part).trim().length > 0).join(' ').trim();
    const nombreAlt = (detail as PersonalRecord).nombre ?? (detail as any)?.nombre ?? '';
    return joined || nombreAlt || '';
  }, []);
  const sendRejectionNotification = useCallback(
    async (detail: PersonalDetail | PersonalRecord) => {
      const targetUserId = resolveSolicitudAgenteId(detail);
      if (!targetUserId) {
        return;
      }
      const personaNombre = resolveSolicitudFullName(detail);
      const message = personaNombre
        ? `La solicitud de ${personaNombre} fue rechazada.`
        : 'Una de tus solicitudes fue rechazada.';
      try {
        await fetch(`${apiBaseUrl}/api/notificaciones`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...actorHeaders,
          },
          body: JSON.stringify({
            userId: targetUserId,
            message,
            personaId: detail.id,
            personaNombre,
            metadata: {
              persona_full_name: personaNombre || null,
              agente_nombre: authUser?.name ?? null,
            },
          }),
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error enviando notificación de rechazo', err);
      }
    },
    [actorHeaders, apiBaseUrl, authUser?.name, resolveSolicitudAgenteId, resolveSolicitudFullName]
  );
  const isExplicitRejection = useCallback(
    (estadoId?: number | null, estado?: string | null) => {
      const normalizedEstado = (estado ?? '').toLowerCase();
      if (normalizedEstado.includes('rechaz')) {
        return true;
      }
      if (estadoId && meta?.estados) {
        const match = meta.estados.find((item) => Number(item.id) === Number(estadoId));
        const matchNombre = (match?.nombre ?? '').toLowerCase();
        if (matchNombre.includes('rechaz')) {
          return true;
        }
      }
      return false;
    },
    [meta?.estados]
  );
  const resolveEstadoNombre = useCallback(
    (estadoId?: number | null, estado?: string | null) => {
      const normalized = (estado ?? '').trim();
      if (normalized) {
        return normalized;
      }
      if (!meta?.estados || estadoId == null) {
        return normalized || null;
      }
      const match = meta.estados.find((item) => Number(item.id) === Number(estadoId));
      const matchNombre = (match?.nombre ?? '').trim();
      return matchNombre || null;
    },
    [meta?.estados]
  );
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [backendSolicitudes, setBackendSolicitudes] = useState<PersonalRecord[]>([]);
  const [personalSolicitudes, setPersonalSolicitudes] = useState<PersonalRecord[]>([]);
  const estadoOptionsWithRechazo = useMemo(() => {
    const estados = meta?.estados ?? [];
    const hasRechazo = estados.some((estado) => (estado.nombre ?? '').toLowerCase().includes('rechaz'));
    if (hasRechazo) {
      return estados;
    }
    return [...estados, { id: 'synthetic_rechazado' as unknown as number, nombre: 'Rechazado' }];
  }, [meta?.estados]);
  const normalizeSolicitudRecord = (
    record: PersonalRecord & { created_at?: string | null; created_at_label?: string | null; solicitudData?: any }
  ): PersonalRecord => {
    const numericId = Number(record.id);
    const resolveRawCreated = () => {
      const data = record.solicitudData as any;

      const primaryCandidates: Array<string | null | undefined> = [
        record.createdAt,
        (record as any).created_at,
        (record as any).created,
        (record as any).fechaCreacion,
        (record as any).fecha_creacion,
        data?.createdAt,
        data?.created_at,
        data?.created,
        data?.fechaCreacion,
        data?.fecha_creacion,
        data?.form?.createdAt,
        data?.form?.created_at,
        data?.form?.fechaSolicitud,
        data?.form?.fecha,
      ];

      const foundPrimary = primaryCandidates.find((value) => typeof value === 'string' && value.trim().length > 0);
      if (foundPrimary) {
        return foundPrimary;
      }

      const cached = Number.isFinite(numericId) ? solicitudCreatedCache.get(numericId) : null;
      if (cached) {
        return cached;
      }
      return null;
    };

    const rawCreated = resolveRawCreated();
    const parsed = rawCreated ? new Date(rawCreated) : null;
    const parsedValid = parsed && !Number.isNaN(parsed.getTime());
    const isSynthetic = Number.isFinite(numericId) && numericId < 0;

    let resolvedCreated = parsedValid ? parsed.toISOString() : rawCreated ?? null;

    // Para solicitudes locales (ID negativo) inventamos fecha y la cacheamos.
    if (!resolvedCreated && isSynthetic) {
      const cached = solicitudCreatedCache.get(numericId);
      if (cached) {
        resolvedCreated = cached;
      } else {
        const nowIso = new Date().toISOString();
        resolvedCreated = nowIso;
        setSolicitudCreatedCache((prev) => {
          const next = new Map(prev);
          next.set(numericId, nowIso);
          writeSolicitudCreatedCache(next);
          return next;
        });
      }
    }

    // Para solicitudes reales, no inventamos; usamos cache si ya la teníamos.
    if (!resolvedCreated && Number.isFinite(numericId) && numericId > 0) {
      const cached = solicitudCreatedCache.get(numericId);
      if (cached) {
        resolvedCreated = cached;
      }
    }

    // Si viene creada desde el backend, la guardamos en cache para próximos renders.
    if (resolvedCreated && Number.isFinite(numericId) && numericId > 0) {
      cacheSolicitudCreated(numericId, resolvedCreated);
    }
    const createdAt = resolvedCreated;
    const createdAtLabel = createdAt ? new Date(createdAt).toLocaleString('es-AR') : null;
    const isLocallyRejected = rejectedIds.has(Number(record.id));
    const estadoNombreBase = resolveEstadoNombre(record.estadoId, record.estado);
    const estadoNombre = (() => {
      const estadoLower = (estadoNombreBase ?? '').toLowerCase();
      const isRejectionByName =
        estadoLower.includes('rechaz') || estadoLower.includes('baja') || estadoLower.includes('suspend');
      if (record.esSolicitud && (isExplicitRejection(record.estadoId, record.estado) || isLocallyRejected || isRejectionByName)) {
        return 'Rechazado';
      }
      if (record.esSolicitud && isLocallyRejected) {
        return 'Rechazado';
      }
      return estadoNombreBase ?? record.estado ?? null;
    })();

    return {
      ...record,
      estado: estadoNombre ?? record.estado ?? null,
      createdAt,
      createdAtLabel,
    };
  };

  const mapSolicitudPersonalToRecord = (
    item: {
    id: number;
    tipo: string;
    estado?: string | null;
    form?: any;
    solicitanteId?: number | null;
    solicitanteNombre?: string | null;
    destinatarioId?: number | null;
    destinatarioIds?: Array<number | string> | null;
    destinatarioNombre?: string | null;
    destinatarioNombres?: string[] | null;
    createdAt?: string | null;
    },
    origin: 'solicitud-personal' | 'aprobaciones-solicitud-personal' = 'solicitud-personal'
  ): PersonalRecord => {
    const tipo = item.tipo as PersonalRecord['solicitudTipo'];
    const perfilLabel =
      tipo === 'prestamo'
        ? 'Solicitud de préstamo'
        : tipo === 'adelanto'
        ? 'Adelanto de pago'
        : tipo === 'vacaciones'
        ? 'Solicitud de vacaciones'
        : tipo === 'cambio_asignacion'
        ? 'Cambio de asignación'
        : 'Solicitud personal';
    const createdAt = item.createdAt ?? null;
    const createdAtLabel = createdAt
      ? new Date(createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
      : null;
    const destinatarioIds = Array.isArray(item.destinatarioIds)
      ? item.destinatarioIds.map((value) => String(value))
      : item.destinatarioId != null
      ? [String(item.destinatarioId)]
      : [];
    const destinatarioNombres = Array.isArray(item.destinatarioNombres)
      ? item.destinatarioNombres
      : item.destinatarioNombre
      ? [item.destinatarioNombre]
      : [];
    const personaNombre =
      item.form?.personaNombre
      ?? item.form?.transportista
      ?? item.solicitanteNombre
      ?? null;
    const clienteLabel =
      item.form?.clienteNombreNuevo
      ?? item.form?.clienteNombreActual
      ?? null;
    const sucursalLabel =
      item.form?.sucursalNombreNueva
      ?? item.form?.sucursalNombreActual
      ?? null;
    const base: PersonalRecord = {
      id: item.id,
      nombre: tipo === 'cambio_asignacion' ? personaNombre : (item.solicitanteNombre ?? null),
      cuil: tipo === 'cambio_asignacion' ? (item.form?.personaCuil ?? null) : null,
      telefono: null,
      email: null,
      cliente: tipo === 'cambio_asignacion' ? clienteLabel : null,
      unidad: null,
      unidadDetalle: null,
      sucursal: tipo === 'cambio_asignacion' ? sucursalLabel : null,
      fechaAlta: null,
      perfil: perfilLabel,
      perfilValue: null,
      agente:
        destinatarioNombres.length > 0
          ? destinatarioNombres.join(', ')
          : item.destinatarioNombre ?? null,
      estado: item.estado ?? 'Pendiente',
      combustible: null,
      combustibleValue: false,
      tarifaEspecial: null,
      tarifaEspecialValue: false,
      aprobado: false,
      aprobadoAt: null,
      aprobadoPor: null,
      esSolicitud: true,
      solicitudTipo: tipo,
      solicitudData: {
        form: {
          ...(item.form ?? {}),
          solicitanteId: item.solicitanteId ?? (item.form?.solicitanteId ?? null),
          destinatarioIds:
            destinatarioIds.length > 0 ? destinatarioIds : (item.form?.destinatarioIds ?? []),
          solicitanteNombre: item.solicitanteNombre ?? item.form?.solicitanteNombre ?? null,
          empleadoNombre: item.form?.empleadoNombre ?? null,
        },
        origin,
      },
      createdAt,
      createdAtLabel,
    };
    return base;
  };
  const [localSolicitudes, setLocalSolicitudes] = useState<PersonalRecord[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const raw = window.localStorage.getItem(LOCAL_SOLICITUDES_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => typeof item === 'object' && item !== null)
          .map((item) => normalizeSolicitudRecord(item as PersonalRecord));
      }
    } catch {
      // ignore parse errors
    }

    return [];
  });
  useEffect(() => {
    writeRejectedIds(rejectedIds);
  }, [rejectedIds]);
  useEffect(() => {
    writeSolicitudCreatedCache(solicitudCreatedCache);
  }, [solicitudCreatedCache]);
  const [solicitudesLoading, setSolicitudesLoading] = useState(true);
  const [solicitudesError, setSolicitudesError] = useState<string | null>(null);
  const [solicitudesSearchTerm, setSolicitudesSearchTerm] = useState('');
  const [solicitudesTipoFilter, setSolicitudesTipoFilter] = useState('');
  const [solicitudesPerfilFilter, setSolicitudesPerfilFilter] = useState('');
  const [solicitudesAgenteFilter, setSolicitudesAgenteFilter] = useState('');
  const [solicitudesEstadoFilter, setSolicitudesEstadoFilter] = useState('');
  const [solicitudesClienteFilter, setSolicitudesClienteFilter] = useState('');
  const [solicitudesSucursalFilter, setSolicitudesSucursalFilter] = useState('');
  const [solicitudesFechaPreset, setSolicitudesFechaPreset] = useState('');
  const [solicitudesFechaFrom, setSolicitudesFechaFrom] = useState('');
  const [solicitudesFechaTo, setSolicitudesFechaTo] = useState('');
  const [bulkRejectingSolicitudes, setBulkRejectingSolicitudes] = useState(false);
  const [updatingSolicitudEstadoIds, setUpdatingSolicitudEstadoIds] = useState<Set<number>>(() => new Set());
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deletingSolicitudId, setDeletingSolicitudId] = useState<number | null>(null);
  const perfilNames: Record<number, string> = useMemo(
    () => ({
      1: getPerfilDisplayLabel(1),
      2: getPerfilDisplayLabel(2),
      3: getPerfilDisplayLabel(3),
    }),
    []
  );
  const createSyntheticId = () => -Math.floor(Date.now() + Math.random() * 1000);
  const appendLocalSolicitud = (record: PersonalRecord) => {
    const withCreated = normalizeSolicitudRecord({
      ...record,
      createdAt: record.createdAt ?? new Date().toISOString(),
    });
    setLocalSolicitudes((prev) => [withCreated, ...prev]);
  };

  const agentesPorId = useMemo(() => {
    const map = new Map<number, string>();
    (meta?.agentes ?? []).forEach((agente) => {
      map.set(agente.id, agente.name ?? `Agente #${agente.id}`);
    });
    return map;
  }, [meta?.agentes]);

  const resolveAgenteNombre = (value: string | null | undefined) => {
    if (!value) {
      return null;
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return null;
    }
    return agentesPorId.get(numeric) ?? null;
  };

  const APPROVER_IDS = [22, 15, 41];
  const approverOptions = useMemo(
    () =>
      APPROVER_IDS.map((id) => {
        const match = (meta?.agentes ?? []).find((agente) => Number(agente.id) === id);
        const fallbackName =
          id === 22 ? 'David Gimenez' : id === 15 ? 'Sebastian Cabrera' : id === 41 ? 'Matias Sanches' : null;
        return { id: String(id), label: match?.name ?? fallbackName ?? `Usuario #${id}` };
      }),
    [meta?.agentes]
  );
  const resolveApproverName = (value: string | null | undefined) => {
    if (!value) {
      return null;
    }
    const match = approverOptions.find((option) => option.id === String(value));
    return match?.label ?? null;
  };
  const resolveApproverNames = (values: string[] | null | undefined) => {
    if (!values || values.length === 0) {
      return null;
    }
    const labels = values
      .map((value) => resolveApproverName(value))
      .filter((label): label is string => Boolean(label));
    return labels.length > 0 ? labels.join(', ') : null;
  };
  const isUserDestinatario = useCallback(
    (values: string[] | null | undefined) => {
      if (!authUser?.id || !values || values.length === 0) {
        return false;
      }
      return values.some((value) => String(value) === String(authUser.id));
    },
    [authUser?.id]
  );

  const canEditEstadoPersonal = APPROVER_IDS.includes(authUser?.id ?? -1);

  const getSolicitudById = (id: number | null) => {
    if (id == null) {
      return null;
    }
    const source = isSolicitudPersonalView ? personalSolicitudes : [...localSolicitudes, ...backendSolicitudes];
    return source.find((registro) => registro.id === id) ?? null;
  };

  const getPrestamoOrden = (record: PersonalRecord): number | null => {
    const data = record.solicitudData as { form?: { numeroOrden?: string | number | null } } | null | undefined;
    const raw = data?.form?.numeroOrden ?? (record as any)?.numeroOrden ?? null;
    if (raw == null) {
      return null;
    }
    const numeric = Number(raw);
    return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : null;
  };

  const resolveNextPrestamoOrden = (excludeId?: number | null): number => {
    const registros = isSolicitudPersonalView ? personalSolicitudes : [...localSolicitudes, ...backendSolicitudes];
    let max = 0;
    registros.forEach((registro) => {
      if (registro.solicitudTipo !== 'prestamo') {
        return;
      }
      if (excludeId != null && registro.id === excludeId) {
        return;
      }
      const current = getPrestamoOrden(registro);
      if (current && current > max) {
        max = current;
      }
    });
    return max + 1;
  };

  const parseMonto = (raw: string): number | null => {
    const cleaned = raw.replace(/\s+/g, '').replace(/\./g, '').replace(/,/g, '.');
    if (!cleaned) {
      return null;
    }
    const numeric = Number(cleaned);
    if (Number.isNaN(numeric)) {
      return null;
    }
    return Number(numeric.toFixed(2));
  };

  const updateLocalSolicitud = (id: number, updater: (prev: PersonalRecord) => PersonalRecord) => {
    setLocalSolicitudes((prev) =>
      prev.map((item) => (item.id === id ? normalizeSolicitudRecord(updater(item)) : item))
    );
  };

  const SOLICITUD_ESTADO_OPTIONS = ['Pendiente', 'Enviado', 'Aprobado', 'Pagado', 'Rechazado'];
  const VACACIONES_ESTADO_OPTIONS = ['Pendiente', 'Enviado', 'Aprobado', 'Rechazado'];

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(LOCAL_SOLICITUDES_STORAGE_KEY, JSON.stringify(localSolicitudes));
    } catch {
      // ignore storage errors
    }
  }, [localSolicitudes]);

  const [reviewPersonaDetail, setReviewPersonaDetail] = useState<PersonalDetail | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [approvalEstadoId, setApprovalEstadoId] = useState('');
  const [reviewCommentText, setReviewCommentText] = useState('');
  const [reviewCommentSaving, setReviewCommentSaving] = useState(false);
  const [reviewCommentError, setReviewCommentError] = useState<string | null>(null);
  const [reviewCommentInfo, setReviewCommentInfo] = useState<string | null>(null);
  const [reviewChatOpen, setReviewChatOpen] = useState(false);
  const [reviewEditMode, setReviewEditMode] = useState(false);
  const [selectedCambioAsignacion, setSelectedCambioAsignacion] = useState<PersonalRecord | null>(null);
  const [resolvingCambioAsignacion, setResolvingCambioAsignacion] = useState(false);
  const [reviewDeletingDocumentIds, setReviewDeletingDocumentIds] = useState<Set<number>>(() => new Set());
  const personaIdFromQuery = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const value = searchParams.get('personaId') ?? searchParams.get('personalId');
    return value && value.trim().length > 0 ? value : null;
  }, [location.search]);
  const [altaSubmitting, setAltaSubmitting] = useState(false);
  const [altaAttachmentsSaving, setAltaAttachmentsSaving] = useState(false);
  const [combustibleSubmitting, setCombustibleSubmitting] = useState(false);
  const [aumentoSubmitting, setAumentoSubmitting] = useState(false);
  const [adelantoSubmitting, setAdelantoSubmitting] = useState(false);
  const [prestamoSubmitting, setPrestamoSubmitting] = useState(false);
  const [vacacionesSubmitting, setVacacionesSubmitting] = useState(false);
  const [polizaSubmitting, setPolizaSubmitting] = useState(false);
  const [altaAttachments, setAltaAttachments] = useState<AltaAttachmentItem[]>([]);
  const [altaFilesVersion, setAltaFilesVersion] = useState(0);
  const [altaDocumentType, setAltaDocumentType] = useState('');
  const [altaDocumentExpiry, setAltaDocumentExpiry] = useState('');
  const [altaPreviewModalImage, setAltaPreviewModalImage] = useState<{ url: string; label: string } | null>(null);
  const altaAttachmentPreviewUrlsRef = useRef<string[]>([]);
  const altaSelectedDocumentType = useMemo(() => {
    if (!meta?.documentTypes || !altaDocumentType) {
      return null;
    }

    const numericId = Number(altaDocumentType);
    if (!Number.isNaN(numericId)) {
      const byId = meta.documentTypes.find((tipo) => tipo.id === numericId);
      if (byId) {
        return byId;
      }
    }

    const normalizedTarget = altaDocumentType.trim().toLowerCase();
    return (
      meta.documentTypes.find((tipo) => (tipo.nombre ?? '').trim().toLowerCase() === normalizedTarget) ?? null
    );
  }, [meta?.documentTypes, altaDocumentType]);
  const altaDocumentTypeId = useMemo(() => {
    if (altaSelectedDocumentType?.id != null) {
      return String(altaSelectedDocumentType.id);
    }

    if (!altaDocumentType) {
      return '';
    }

    return altaDocumentType.trim().toLowerCase();
  }, [altaDocumentType, altaSelectedDocumentType?.id]);
  const canEditSolicitud = useMemo(() => {
    if (!reviewPersonaDetail) {
      return canManagePersonal;
    }
    const isPendingSolicitud = (reviewPersonaDetail.esSolicitud ?? false) && reviewPersonaDetail.aprobado !== true;
    return canManagePersonal || isPendingSolicitud;
  }, [canManagePersonal, reviewPersonaDetail]);
  const altaDocumentTypeName = useMemo(() => {
    if (altaSelectedDocumentType?.nombre) {
      return altaSelectedDocumentType.nombre;
    }

    if (!altaDocumentType) {
      return '';
    }

    if (!Number.isNaN(Number(altaDocumentType))) {
      return `Documento #${altaDocumentType}`;
    }

    return altaDocumentType;
  }, [altaDocumentType, altaSelectedDocumentType]);
  const altaDocumentRequiresExpiry = altaSelectedDocumentType?.vence ?? false;
  const isAltaCedulaVerde = useMemo(() => {
    if (!altaDocumentTypeName) {
      return false;
    }

    const normalized = altaDocumentTypeName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return normalized.includes('cedula verde');
  }, [altaDocumentTypeName]);
  const openAltaPreviewModal = useCallback((url: string, label: string) => {
    setAltaPreviewModalImage({ url, label });
  }, []);
  const closeAltaPreviewModal = useCallback(() => {
    setAltaPreviewModalImage(null);
  }, []);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAltaPreviewModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeAltaPreviewModal]);
  const altaAttachmentsForCurrentType = useMemo(() => {
    if (!altaDocumentTypeId) {
      return [];
    }

    return altaAttachments.filter((item) => item.typeId === altaDocumentTypeId);
  }, [altaAttachments, altaDocumentTypeId]);
  const altaImagePreviews = useMemo(
    () =>
      altaAttachments.filter(
        (item): item is AltaAttachmentItem & { previewUrl: string } => Boolean(item.previewUrl)
      ),
    [altaAttachments]
  );
  useEffect(() => {
    const currentUrls = altaAttachments
      .map((item) => item.previewUrl)
      .filter((url): url is string => Boolean(url));
    const removedUrls = altaAttachmentPreviewUrlsRef.current.filter((url) => !currentUrls.includes(url));
    if (altaPreviewModalImage?.url && removedUrls.includes(altaPreviewModalImage.url)) {
      closeAltaPreviewModal();
    }
    removedUrls.forEach((url) => revokeImagePreviewUrl(url));
    altaAttachmentPreviewUrlsRef.current = currentUrls;
  }, [altaAttachments, altaPreviewModalImage?.url, closeAltaPreviewModal]);
  useEffect(() => {
    return () => {
      altaAttachmentPreviewUrlsRef.current.forEach((url) => revokeImagePreviewUrl(url));
    };
  }, []);
  const [combustibleAttachments, setCombustibleAttachments] = useState<File[]>([]);
  const [combustibleFilesVersion, setCombustibleFilesVersion] = useState(0);
  const [aumentoAttachments, setAumentoAttachments] = useState<File[]>([]);
  const [aumentoFilesVersion, setAumentoFilesVersion] = useState(0);
  const [adelantoAttachments, setAdelantoAttachments] = useState<File[]>([]);
  const [adelantoFilesVersion, setAdelantoFilesVersion] = useState(0);
  const altaNosisTitularLastLookupRef = useRef<string | null>(null);
  const altaNosisCobradorLastLookupRef = useRef<string | null>(null);
  const [altaNosisTitularLoading, setAltaNosisTitularLoading] = useState(false);
  const [altaNosisTitularError, setAltaNosisTitularError] = useState<string | null>(null);
  const [altaNosisTitularInfo, setAltaNosisTitularInfo] = useState<string | null>(null);
  const [altaNosisCobradorLoading, setAltaNosisCobradorLoading] = useState(false);
  const [altaNosisCobradorError, setAltaNosisCobradorError] = useState<string | null>(null);
  const [altaNosisCobradorInfo, setAltaNosisCobradorInfo] = useState<string | null>(null);
  const [altaForm, setAltaForm] = useState<AltaRequestForm>(() => ({
    perfilValue: 0,
    nombres: '',
    apellidos: '',
    telefono: '',
    email: '',
    tarifaEspecial: false,
    observacionTarifa: '',
    cuil: '',
    cbuAlias: '',
    pago: '',
    esCobrador: true,
    cobradorNombre: '',
    cobradorEmail: '',
    cobradorCuil: '',
    cobradorCbuAlias: '',
    combustible: false,
    fechaAlta: '',
    patente: '',
    clienteId: '',
    sucursalId: '',
    agenteId: '',
    agenteResponsableId: '',
    agenteResponsableIds: [],
    unidadId: '',
    estadoId: '',
    fechaAltaVinculacion: '',
    observaciones: '',
    duenoNombre: '',
    duenoFechaNacimiento: '',
    duenoEmail: '',
    duenoCuil: '',
    duenoCuilCobrador: '',
    duenoCbuAlias: '',
    duenoTelefono: '',
    duenoObservaciones: '',
  }));
  const [combustibleForm, setCombustibleForm] = useState<CombustibleRequestForm>(() => ({
    empresaId: '',
    sucursalId: '',
    nombreCompleto: '',
    dni: '',
    serviClubEmail: '',
    patente: '',
    marca: '',
    modelo: '',
    kilometraje: '',
    observaciones: '',
    agenteId: '',
  }));
  const [aumentoCombustibleForm, setAumentoCombustibleForm] = useState<AumentoCombustibleForm>(() => ({
    empresaId: '',
    sucursalId: '',
    nombreCompleto: '',
    dni: '',
    serviClubEmail: '',
    patente: '',
    marca: '',
    modelo: '',
    kilometraje: '',
    litrosActuales: '',
    litrosSolicitados: '',
    motivo: '',
    agenteId: '',
  }));
  const [polizaForm, setPolizaForm] = useState<PolizaRequestForm>(() => ({
    polizaFile: null,
    comprobanteFile: null,
    observaciones: '',
    agenteId: '',
  }));
  const [polizaInputsVersion, setPolizaInputsVersion] = useState(0);
  const [adelantoForm, setAdelantoForm] = useState<AdelantoRequestForm>(() => ({
    empresaId: '',
    sucursalId: '',
    transportista: '',
    monto: '',
    fechaSolicitud: '',
    motivo: '',
    observaciones: '',
    agenteId: '',
    destinatarioIds: [],
    estado: 'Pendiente',
  }));
  const [prestamoForm, setPrestamoForm] = useState<PrestamoRequestForm>(() => ({
    solicitanteNombre: authUser?.name ?? '',
    numeroOrden: '',
    montoSolicitado: '',
    cantidadCuotas: '',
    cuotasPagadas: '0',
    fechaNecesaria: '',
    destinatarioIds: [],
    observaciones: '',
    estado: 'Pendiente',
  }));
  const [vacacionesForm, setVacacionesForm] = useState<VacacionesRequestForm>(() => ({
    empleadoId: '',
    empleadoNombre: authUser?.name ?? '',
    fechaDesde: '',
    fechaHasta: '',
    diasHabiles: '',
    motivo: '',
    estado: 'Pendiente',
    destinatarioIds: [],
  }));
  const [editingSolicitudId, setEditingSolicitudId] = useState<number | null>(null);
  const [editingSolicitudTipo, setEditingSolicitudTipo] = useState<PersonalRecord['solicitudTipo'] | null>(null);
  const canEditPrestamoEstado = useMemo(() => {
    if (!canEditEstadoPersonal) {
      return false;
    }
    if (!prestamoForm.destinatarioIds || prestamoForm.destinatarioIds.length === 0) {
      return false;
    }
    return isUserDestinatario(prestamoForm.destinatarioIds);
  }, [canEditEstadoPersonal, isUserDestinatario, prestamoForm.destinatarioIds]);
  const canEditAdelantoEstado = useMemo(() => {
    if (!canEditEstadoPersonal) {
      return false;
    }
    if (!isSolicitudPersonalView) {
      return true;
    }
    if (!adelantoForm.destinatarioIds || adelantoForm.destinatarioIds.length === 0) {
      return false;
    }
    return isUserDestinatario(adelantoForm.destinatarioIds);
  }, [adelantoForm.destinatarioIds, canEditEstadoPersonal, isSolicitudPersonalView, isUserDestinatario]);
  const canEditVacacionesEstado = useMemo(() => {
    if (!canEditEstadoPersonal) {
      return false;
    }
    if (!isSolicitudPersonalView) {
      return true;
    }
    if (!vacacionesForm.destinatarioIds || vacacionesForm.destinatarioIds.length === 0) {
      return false;
    }
    return isUserDestinatario(vacacionesForm.destinatarioIds);
  }, [canEditEstadoPersonal, isSolicitudPersonalView, isUserDestinatario, vacacionesForm.destinatarioIds]);
  const canEditAdelantoSolicitud = useMemo(() => {
    const isEditingAdelanto = isSolicitudPersonalView && Boolean(editingSolicitudId && editingSolicitudTipo === 'adelanto');
    return !isEditingAdelanto || canEditAdelantoEstado;
  }, [canEditAdelantoEstado, editingSolicitudId, editingSolicitudTipo, isSolicitudPersonalView]);
  const canEditPrestamoSolicitud = useMemo(() => {
    const isEditingPrestamo = isSolicitudPersonalView && Boolean(editingSolicitudId && editingSolicitudTipo === 'prestamo');
    return !isEditingPrestamo || canEditPrestamoEstado;
  }, [canEditPrestamoEstado, editingSolicitudId, editingSolicitudTipo, isSolicitudPersonalView]);
  const canEditVacacionesSolicitud = useMemo(() => {
    const isEditingVacaciones = isSolicitudPersonalView && Boolean(editingSolicitudId && editingSolicitudTipo === 'vacaciones');
    return !isEditingVacaciones || canEditVacacionesEstado;
  }, [canEditVacacionesEstado, editingSolicitudId, editingSolicitudTipo, isSolicitudPersonalView]);
  const [vacacionesDiasDisponibles, setVacacionesDiasDisponibles] = useState<Record<string, number>>({});
  const [vacacionesConfigForm, setVacacionesConfigForm] = useState<{ empleadoId: string; dias: string }>({
    empleadoId: '',
    dias: '',
  });
  const [altaFormDirty, setAltaFormDirty] = useState(false);
  const [personalLookup, setPersonalLookup] = useState<PersonalRecord[]>([]);
  const [personalLookupLoading, setPersonalLookupLoading] = useState(false);
  const [personalLookupError, setPersonalLookupError] = useState<string | null>(null);
  const [altaLookupTerm, setAltaLookupTerm] = useState('');

  useEffect(() => {
    if (!authUser?.name) {
      return;
    }
    setPrestamoForm((prev) =>
      prev.solicitanteNombre.trim().length > 0 ? prev : { ...prev, solicitanteNombre: authUser.name ?? '' }
    );
    setVacacionesForm((prev) =>
      prev.empleadoNombre.trim().length > 0 ? prev : { ...prev, empleadoNombre: authUser.name ?? '' }
    );
  }, [authUser?.name]);

  useEffect(() => {
    if (!authUser?.id || vacacionesForm.empleadoId) {
      return;
    }
    const match = (meta?.agentes ?? []).find((agente) => Number(agente.id) === Number(authUser.id));
    if (!match) {
      return;
    }
    setVacacionesForm((prev) => ({
      ...prev,
      empleadoId: String(authUser.id),
      empleadoNombre: match.name ?? prev.empleadoNombre ?? authUser.name ?? '',
    }));
  }, [authUser?.id, authUser?.name, meta?.agentes, vacacionesForm.empleadoId]);

  useEffect(() => {
    if (!isSolicitudPersonalView) {
      return;
    }
    setActiveTab((prev) => (prev === 'list' || prev === 'adelanto' || prev === 'prestamo' || prev === 'vacaciones' ? prev : 'list'));
  }, [isSolicitudPersonalView]);

  useEffect(() => {
    if (!personaIdFromQuery) {
      setReviewPersonaDetail(null);
      setReviewError(null);
      setApprovalEstadoId('');
      setReviewCommentText('');
      setReviewCommentError(null);
      setReviewCommentInfo(null);
      setReviewLoading(false);
      setReviewEditMode(false);
      setAltaFormDirty(false);
      return;
    }
    setReviewDeletingDocumentIds(new Set());

    const personaIdNumeric = Number(personaIdFromQuery);
    if (Number.isNaN(personaIdNumeric)) {
      setReviewPersonaDetail(null);
      setReviewError('Identificador de solicitud inválido.');
      setApprovalEstadoId('');
      setReviewCommentText('');
      setReviewCommentError(null);
      setReviewCommentInfo(null);
      setReviewLoading(false);
      setReviewEditMode(false);
      setAltaFormDirty(false);
      return;
    }

    setActiveTab('altas');
    setReviewEditMode(false);
    setAltaFormDirty(false);
    const controller = new AbortController();

    const fetchLookup = async () => {
      try {
        setPersonalLookupLoading(true);
        setPersonalLookupError(null);
        const response = await fetch(`${apiBaseUrl}/api/personal?includePending=1`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const payload = (await response.json()) as { data: PersonalRecord[] };
        if (!payload || !Array.isArray(payload.data)) {
          throw new Error('Formato de respuesta inesperado');
        }
        setPersonalLookup(payload.data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setPersonalLookupError((err as Error).message ?? 'No se pudo cargar el listado de personal.');
      } finally {
        setPersonalLookupLoading(false);
      }
    };

    const fetchDetail = async () => {
      try {
        setReviewLoading(true);
        setReviewError(null);

        const response = await fetch(`${apiBaseUrl}/api/personal/${personaIdNumeric}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: PersonalDetail };
        const resolvedEstado =
          resolveEstadoNombre(payload.data.estadoId, payload.data.estado) ??
          ((isExplicitRejection(payload.data.estadoId, payload.data.estado) ||
            rejectedIds.has(payload.data.id)) &&
          payload.data.esSolicitud
            ? 'Rechazado'
            : payload.data.estado ?? null);
        setReviewPersonaDetail({
          ...payload.data,
          estado: resolvedEstado,
          comments: Array.isArray(payload.data.comments) ? payload.data.comments : [],
          documentsDownloadAllUrl: payload.data.documentsDownloadAllUrl ?? null,
          documentsDownloadAllAbsoluteUrl: payload.data.documentsDownloadAllAbsoluteUrl ?? null,
        });
        setApprovalEstadoId(payload.data.estadoId ? String(payload.data.estadoId) : '');
        setReviewCommentText('');
        setReviewCommentError(null);
        setReviewCommentInfo(null);
        setReviewEditMode(false);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setReviewPersonaDetail(null);
        setReviewError((err as Error).message ?? 'No se pudo cargar la solicitud.');
        setApprovalEstadoId('');
        setReviewCommentText('');
        setReviewCommentError(null);
        setReviewCommentInfo(null);
        setReviewEditMode(false);
      } finally {
        if (!controller.signal.aborted) {
          setReviewLoading(false);
        }
      }
    };

    fetchLookup();
    fetchDetail();

    return () => controller.abort();
  }, [apiBaseUrl, personaIdFromQuery]);

  const personalLookupFetchedRef = useRef(false);

  useEffect(() => {
    if (personalLookupFetchedRef.current || personalLookup.length > 0) {
      return;
    }

    const controller = new AbortController();

    const fetchLookup = async () => {
      try {
        setPersonalLookupLoading(true);
        setPersonalLookupError(null);
        const response = await fetch(`${apiBaseUrl}/api/personal?includePending=1`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const payload = (await response.json()) as { data: PersonalRecord[] };
        if (!payload || !Array.isArray(payload.data)) {
          throw new Error('Formato de respuesta inesperado');
        }
        setPersonalLookup(payload.data);
        personalLookupFetchedRef.current = true;
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setPersonalLookupError((err as Error).message ?? 'No se pudo cargar el listado de personal.');
      } finally {
        setPersonalLookupLoading(false);
      }
    };

    fetchLookup();

    return () => controller.abort();
  }, [apiBaseUrl, personalLookup.length]);

  const altaLookupResults = useMemo(() => {
    const term = altaLookupTerm.trim().toLowerCase();
    if (!term) {
      return [] as PersonalRecord[];
    }
    const scored = personalLookup
      .map((item) => {
        const fields = [
          item.nombre,
          item.cuil,
          item.email,
          item.cliente,
          item.sucursal,
          item.unidadDetalle,
          item.unidad,
          String(item.id ?? ''),
        ]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase());
        const match = fields.some((field) => field.includes(term));
        return match ? item : null;
      })
      .filter((item): item is PersonalRecord => Boolean(item));
    return scored.slice(0, 10);
  }, [altaLookupTerm, personalLookup]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchMeta = async () => {
      try {
        setLoadingMeta(true);
        setMetaError(null);

        const response = await fetch(`${apiBaseUrl}/api/personal-meta`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as PersonalMeta;
        setMeta(payload);
        const firstAvailable = payload.perfiles.find((perfil) => perfil.value !== 2) ?? payload.perfiles[0];
        setAltaForm((prev) => ({
          ...prev,
          perfilValue: prev.perfilValue !== 0 ? prev.perfilValue : firstAvailable?.value ?? prev.perfilValue,
        }));
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setMetaError((err as Error).message ?? 'No se pudieron cargar los datos iniciales.');
      } finally {
        setLoadingMeta(false);
      }
    };

    fetchMeta();

    return () => controller.abort();
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!meta?.estados || meta.estados.length === 0) {
      return;
    }

    setBackendSolicitudes((prev) => prev.map((item) => normalizeSolicitudRecord(item)));
    setLocalSolicitudes((prev) => prev.map((item) => normalizeSolicitudRecord(item)));
    setReviewPersonaDetail((prev) =>
      prev
        ? {
            ...prev,
            estado:
              resolveEstadoNombre(prev.estadoId, prev.estado) ??
              ((isExplicitRejection(prev.estadoId, prev.estado) || rejectedIds.has(prev.id)) && prev.esSolicitud
                ? 'Rechazado'
                : prev.estado ?? null),
          }
        : prev
    );
  }, [meta?.estados, isExplicitRejection, resolveEstadoNombre, rejectedIds]);

  useEffect(() => {
    if (!authUser?.id || personaIdFromQuery) {
      return;
    }

    const authId = String(authUser.id);
    setAltaForm((prev) => {
      if (prev.agenteId && prev.agenteId === authId) {
        return prev;
      }
      return { ...prev, agenteId: authId };
    });
  }, [authUser?.id, personaIdFromQuery]);

  const fetchSolicitudes = useCallback(
    async (options?: { signal?: AbortSignal }) => {
      try {
        setSolicitudesLoading(true);
        setSolicitudesError(null);

        if (isSolicitudPersonalView) {
          const response = await fetch(`${apiBaseUrl}/api/solicitud-personal`, {
            signal: options?.signal,
          });

          if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
          }

          const payload = (await response.json()) as { data: any[] };
          if (!payload || !Array.isArray(payload.data)) {
            throw new Error('Formato de respuesta inesperado');
          }

          setPersonalSolicitudes(payload.data.map((item) => mapSolicitudPersonalToRecord(item)));
          return;
        }

        const personalResponse = await fetch(`${apiBaseUrl}/api/personal?esSolicitud=1`, {
          signal: options?.signal,
        });

        if (!personalResponse.ok) {
          throw new Error(`Error ${personalResponse.status}: ${personalResponse.statusText}`);
        }

        const personalPayload = (await personalResponse.json()) as { data: PersonalRecord[] };
        if (!personalPayload || !Array.isArray(personalPayload.data)) {
          throw new Error('Formato de respuesta inesperado');
        }

        let cambioAsignacionRecords: PersonalRecord[] = [];
        try {
          const solicitudesResponse = await fetch(`${apiBaseUrl}/api/solicitud-personal?scope=assigned`, {
            signal: options?.signal,
            headers: {
              Accept: 'application/json',
              ...actorHeaders,
            },
          });

          if (solicitudesResponse.ok) {
            const solicitudesPayload = (await solicitudesResponse.json()) as { data?: any[] };
            if (Array.isArray(solicitudesPayload?.data)) {
              cambioAsignacionRecords = solicitudesPayload.data
                .filter((item) => (item?.tipo ?? '') === 'cambio_asignacion')
                .map((item) => mapSolicitudPersonalToRecord(item, 'aprobaciones-solicitud-personal'))
                .map((item) => normalizeSolicitudRecord(item));
            }
          }
        } catch {
          // Si falla el listado auxiliar, seguimos mostrando las solicitudes principales.
        }

        setBackendSolicitudes([
          ...personalPayload.data.map((item) => normalizeSolicitudRecord(item)),
          ...cambioAsignacionRecords,
        ]);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setSolicitudesError((err as Error).message ?? 'No se pudieron cargar las solicitudes.');
      } finally {
        setSolicitudesLoading(false);
      }
    },
    [apiBaseUrl, actorHeaders, isSolicitudPersonalView]
  );

  const fetchVacacionesDias = useCallback(
    async (options?: { signal?: AbortSignal }) => {
      try {
        if (!isSolicitudPersonalView) {
          return;
        }
        const response = await fetch(`${apiBaseUrl}/api/vacaciones-dias`, {
          signal: options?.signal,
          headers: {
            Accept: 'application/json',
            ...actorHeaders,
          },
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: Array<{ userId?: number | string; dias?: number }> };
        if (!payload || !Array.isArray(payload.data)) {
          throw new Error('Formato de respuesta inesperado');
        }

        const next: Record<string, number> = {};
        payload.data.forEach((item) => {
          const userId = item?.userId;
          if (userId == null) {
            return;
          }
          const dias = Number(item?.dias);
          next[String(userId)] = Number.isFinite(dias) ? dias : 0;
        });
        setVacacionesDiasDisponibles(next);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setFlash({ type: 'error', message: (err as Error).message ?? 'No se pudieron cargar los días hábiles.' });
      }
    },
    [apiBaseUrl, actorHeaders, isSolicitudPersonalView]
  );

  useEffect(() => {
    if (isSolicitudPersonalView && !authUser?.id) {
      return;
    }
    const controller = new AbortController();
    fetchSolicitudes({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchSolicitudes, isSolicitudPersonalView, authUser?.id]);

  useEffect(() => {
    if (!isSolicitudPersonalView) {
      return;
    }
    const controller = new AbortController();
    fetchVacacionesDias({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchVacacionesDias, isSolicitudPersonalView]);

  useEffect(() => {
    setReviewDeletingDocumentIds(new Set());

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ persona?: PersonalRecord }>;
      const persona = customEvent.detail?.persona;

      if (persona) {
        setBackendSolicitudes((prev) => {
          const withoutPersona = prev.filter((item) => item.id !== persona.id);
          if (persona.esSolicitud) {
            return [normalizeSolicitudRecord(persona), ...withoutPersona];
          }
          return withoutPersona;
        });
        return;
      }

      fetchSolicitudes();
    };

    window.addEventListener('personal:updated', handler as EventListener);
    return () => window.removeEventListener('personal:updated', handler as EventListener);
  }, [fetchSolicitudes]);

  const populateAltaFormFromReview = useCallback(() => {
    if (!reviewPersonaDetail) {
      return;
    }

    const responsableIdsFromDetail =
      reviewPersonaDetail.agentesResponsablesIds && reviewPersonaDetail.agentesResponsablesIds.length > 0
        ? reviewPersonaDetail.agentesResponsablesIds
        : reviewPersonaDetail.agenteResponsableId
        ? [reviewPersonaDetail.agenteResponsableId]
        : [];

    const cobradorNombre = reviewPersonaDetail.cobradorNombre ?? reviewPersonaDetail.duenoNombre ?? reviewPersonaDetail.nombres ?? '';
    const cobradorEmail = reviewPersonaDetail.cobradorEmail ?? reviewPersonaDetail.duenoEmail ?? reviewPersonaDetail.email ?? '';
    const cobradorCuil =
      reviewPersonaDetail.cobradorCuil
      ?? reviewPersonaDetail.duenoCuilCobrador
      ?? reviewPersonaDetail.duenoCuil
      ?? reviewPersonaDetail.cuil
      ?? '';
    const cobradorCbuAlias =
      reviewPersonaDetail.cobradorCbuAlias
      ?? reviewPersonaDetail.duenoCbuAlias
      ?? reviewPersonaDetail.cbuAlias
      ?? '';

    setAltaForm((prev) => ({
      ...prev,
      perfilValue: reviewPersonaDetail.perfilValue ?? prev.perfilValue,
      nombres: reviewPersonaDetail.nombres ?? '',
      apellidos: reviewPersonaDetail.apellidos ?? '',
      telefono: reviewPersonaDetail.telefono ?? '',
      email: reviewPersonaDetail.email ?? '',
      tarifaEspecial: Boolean(reviewPersonaDetail.tarifaEspecialValue),
      observacionTarifa: reviewPersonaDetail.observacionTarifa ?? '',
      cuil: reviewPersonaDetail.cuil ?? '',
      cbuAlias: reviewPersonaDetail.cbuAlias ?? '',
      pago: reviewPersonaDetail.pago ?? '',
      esCobrador: Boolean(
        reviewPersonaDetail.esCobrador
        ?? reviewPersonaDetail.perfilValue === 2
        ?? cobradorNombre
        ?? cobradorEmail
        ?? cobradorCuil
        ?? cobradorCbuAlias
      ),
      cobradorNombre,
      cobradorEmail,
      cobradorCuil,
      cobradorCbuAlias,
      combustible: Boolean(reviewPersonaDetail.combustibleValue),
      fechaAlta: reviewPersonaDetail.fechaAlta ?? '',
      fechaAltaVinculacion:
        reviewPersonaDetail.fechaAltaVinculacion ?? reviewPersonaDetail.fechaAlta ?? '',
      patente: reviewPersonaDetail.patente ?? '',
      clienteId: reviewPersonaDetail.clienteId ? String(reviewPersonaDetail.clienteId) : '',
      sucursalId: reviewPersonaDetail.sucursalId ? String(reviewPersonaDetail.sucursalId) : '',
      agenteId: reviewPersonaDetail.agenteId ? String(reviewPersonaDetail.agenteId) : '',
      agenteResponsableId: reviewPersonaDetail.agenteResponsableId
        ? String(reviewPersonaDetail.agenteResponsableId)
        : '',
      agenteResponsableIds: responsableIdsFromDetail.map((id: unknown) => String(id)),
      unidadId: reviewPersonaDetail.unidadId ? String(reviewPersonaDetail.unidadId) : '',
      estadoId: reviewPersonaDetail.estadoId ? String(reviewPersonaDetail.estadoId) : '',
      observaciones: reviewPersonaDetail.observaciones ?? '',
      duenoNombre: reviewPersonaDetail.duenoNombre ?? '',
      duenoFechaNacimiento: reviewPersonaDetail.duenoFechaNacimiento ?? '',
      duenoEmail: reviewPersonaDetail.duenoEmail ?? '',
      duenoCuil: reviewPersonaDetail.duenoCuil ?? '',
      duenoCuilCobrador: reviewPersonaDetail.duenoCuilCobrador ?? '',
      duenoCbuAlias: reviewPersonaDetail.duenoCbuAlias ?? '',
      duenoTelefono: reviewPersonaDetail.duenoTelefono ?? '',
      duenoObservaciones: reviewPersonaDetail.duenoObservaciones ?? '',
    }));
  }, [reviewPersonaDetail]);

  useEffect(() => {
    if (altaFormDirty) {
      return;
    }
    populateAltaFormFromReview();
  }, [populateAltaFormFromReview, altaFormDirty]);

  const headerContent = (
    <div className="card-header card-header--compact">
      <button
        type="button"
        className="secondary-action"
        onClick={() => {
          if (isSolicitudPersonalView) {
            setActiveTab('list');
            navigate('/solicitud-personal');
            return;
          }
          navigate('/personal');
        }}
      >
        {isSolicitudPersonalView ? '← Volver a solicitudes pendientes' : '← Volver a proveedores'}
      </button>
    </div>
  );

const sucursalOptions = useMemo(() => {
  if (!meta) {
    return [] as PersonalMeta['sucursales'];
  }

  if (!altaForm.clienteId) {
    return meta.sucursales;
  }

  const clienteId = Number(altaForm.clienteId);
  return meta.sucursales.filter((sucursal) => sucursal.cliente_id === clienteId);
}, [meta, altaForm.clienteId]);

  const combustibleSucursalOptions = useMemo(() => {
    if (!meta) {
      return [] as PersonalMeta['sucursales'];
    }
    if (!combustibleForm.empresaId) {
      return meta.sucursales;
    }
    const empresaId = Number(combustibleForm.empresaId);
    return meta.sucursales.filter((sucursal) => sucursal.cliente_id === empresaId);
  }, [meta, combustibleForm.empresaId]);

  const aumentoSucursalOptions = useMemo(() => {
    if (!meta) {
      return [] as PersonalMeta['sucursales'];
    }
    if (!aumentoCombustibleForm.empresaId) {
      return meta.sucursales;
    }
    const empresaId = Number(aumentoCombustibleForm.empresaId);
    return meta.sucursales.filter((sucursal) => sucursal.cliente_id === empresaId);
  }, [meta, aumentoCombustibleForm.empresaId]);

  const adelantoSucursalOptions = useMemo(() => {
    if (!meta) {
      return [] as PersonalMeta['sucursales'];
    }
    if (!adelantoForm.empresaId) {
      return meta.sucursales;
    }
    const empresaId = Number(adelantoForm.empresaId);
    return meta.sucursales.filter((sucursal) => sucursal.cliente_id === empresaId);
  }, [meta, adelantoForm.empresaId]);

  const handleAltaFieldChange =
    (field: AltaEditableField) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setAltaFormDirty(true);
      setAltaForm((prev) => ({
        ...prev,
        [field]: value,
        ...(field === 'clienteId' ? { sucursalId: '' } : {}),
      }));
    };

  const lookupAltaNosisByDocumento = useCallback(
    async (target: 'titular' | 'cobrador', showValidationError = true) => {
      const isTitular = target === 'titular';
      const rawValue = isTitular ? altaForm.cuil : altaForm.cobradorCuil;
      const documento = rawValue.replace(/\D+/g, '');
      const setLoading = isTitular ? setAltaNosisTitularLoading : setAltaNosisCobradorLoading;
      const setError = isTitular ? setAltaNosisTitularError : setAltaNosisCobradorError;
      const setInfo = isTitular ? setAltaNosisTitularInfo : setAltaNosisCobradorInfo;
      const currentLoading = isTitular ? altaNosisTitularLoading : altaNosisCobradorLoading;
      const lastLookupRef = isTitular ? altaNosisTitularLastLookupRef : altaNosisCobradorLastLookupRef;

      if (currentLoading) {
        return;
      }

      if (!documento) {
        if (showValidationError) {
          setError(`Ingresá un ${PERSON_TAX_ID_LABEL} para consultar en Nosis.`);
        }
        return;
      }

      if (documento.length !== 11) {
        if (showValidationError) {
          setError(`Ingresá un ${PERSON_TAX_ID_LABEL} válido de 11 dígitos.`);
        }
        return;
      }

      if (!showValidationError && lastLookupRef.current === documento) {
        return;
      }

      const url = new URL(`${apiBaseUrl}/api/nosis/consultar-documento`);
      url.searchParams.set('documento', documento);

      try {
        setLoading(true);
        setError(null);
        setInfo(null);

        const response = await fetch(url.toString(), {
          headers: {
            Accept: 'application/json',
            ...actorHeaders,
          },
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = await response.json();
        const raw = payload?.data?.raw;
        const parsed = payload?.data?.parsed ?? (typeof raw === 'string' ? parseNosisXml(raw) : null);
        const razonSocial = parsed?.razonSocial ?? '';
        const razonSplit = splitRazonSocial(razonSocial);
        const fullName = razonSocial.trim() || [razonSplit?.nombres ?? '', razonSplit?.apellidos ?? ''].filter(Boolean).join(' ').trim();
        const nombresFromNosis = razonSplit?.nombres ?? '';
        const apellidosFromNosis = razonSplit?.apellidos ?? '';
        const documentoFromNosis = (parsed?.documento ?? '').replace(/\D+/g, '');
        const fechaNacimientoFromNosis = normalizeNosisDate(parsed?.fechaNacimiento ?? '');

        setAltaFormDirty(true);
        setAltaForm((prev) => {
          const next = { ...prev };
          if (isTitular) {
            const profileIsCobrador = prev.perfilValue === 2;
            if (!prev.nombres.trim()) {
              if (profileIsCobrador) {
                if (fullName) {
                  next.nombres = fullName;
                }
              } else if (nombresFromNosis) {
                next.nombres = nombresFromNosis;
              }
            }
            if (!profileIsCobrador && !prev.apellidos.trim() && apellidosFromNosis) {
              next.apellidos = apellidosFromNosis;
            }
            if (!prev.cuil.trim() && documentoFromNosis) {
              next.cuil = documentoFromNosis;
            }
          } else {
            if (!prev.cobradorNombre.trim() && fullName) {
              next.cobradorNombre = fullName;
            }
            if (!prev.cobradorCuil.trim() && documentoFromNosis) {
              next.cobradorCuil = documentoFromNosis;
            }
          }

          if (!prev.duenoFechaNacimiento && fechaNacimientoFromNosis) {
            next.duenoFechaNacimiento = fechaNacimientoFromNosis;
          }

          return next;
        });

        lastLookupRef.current = documento;
        setInfo(parsed?.message || payload?.message || 'Datos consultados en Nosis.');
      } catch (err) {
        setError((err as Error).message ?? 'No se pudo consultar Nosis.');
      } finally {
        setLoading(false);
      }
    },
    [
      actorHeaders,
      altaForm.cobradorCuil,
      altaForm.cuil,
      altaNosisCobradorLoading,
      altaNosisTitularLoading,
      apiBaseUrl,
      normalizeNosisDate,
      parseNosisXml,
      splitRazonSocial,
    ]
  );

  const filesFromEvent = (fileList: FileList | null) => (fileList ? Array.from(fileList) : []);

  const buildPersonalUploadRequestInit = useCallback(
    (formData: FormData): RequestInit => {
      const init: RequestInit = {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json', ...actorHeaders },
      };

      if (typeof window !== 'undefined') {
        try {
          const targetOrigin = new URL(apiBaseUrl).origin;
          if (targetOrigin === window.location.origin) {
            init.credentials = 'include';
          }
        } catch {
          // ignore malformed URLs
        }
      }

      return init;
    },
    [actorHeaders, apiBaseUrl]
  );

  const resolveAltaUploadErrorMessage = useCallback(async (response: Response, fileName: string): Promise<string> => {
    if (response.status === 413) {
      return `${fileName}: el archivo supera el límite permitido por el servidor.`;
    }

    try {
      const uploadPayload = await parseJsonSafe(response);
      if (typeof uploadPayload?.message === 'string' && uploadPayload.message.trim().length > 0) {
        return `${fileName}: ${uploadPayload.message}`;
      }

      if (uploadPayload?.errors) {
        const firstUploadError = Object.values(uploadPayload.errors)[0];
        if (Array.isArray(firstUploadError) && firstUploadError[0]) {
          return `${fileName}: ${firstUploadError[0]}`;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.trim() : '';
      if (message.length > 0) {
        return `${fileName}: ${message}`;
      }
    }

    return `${fileName}: Error ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
  }, []);

  const handleAltaFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = filesFromEvent(event.target.files);

    if (files.length === 0) {
      return;
    }

    if (!altaDocumentTypeId) {
      setFlash({
        type: 'error',
        message: 'Seleccioná el tipo de documento antes de adjuntar archivos.',
      });
      event.target.value = '';
      return;
    }

    if (altaDocumentRequiresExpiry && !altaDocumentExpiry) {
      setFlash({
        type: 'error',
        message: 'Este tipo de documento requiere fecha de vencimiento.',
      });
      event.target.value = '';
      return;
    }

    const typeLabel = altaDocumentTypeName.trim().length > 0 ? altaDocumentTypeName.trim() : `Documento #${altaDocumentTypeId}`;
    const oversized: string[] = files
      .filter((file) => file.size > MAX_UPLOAD_SIZE_BYTES)
      .map((file) => `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`);
    if (oversized.length > 0) {
      setFlash({
        type: 'error',
        message: `Estos archivos superan ${Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024))} MB: ${oversized.join(' | ')}`,
      });
    }
    const allowedFiles = files.filter((file) => file.size <= MAX_UPLOAD_SIZE_BYTES);
    if (allowedFiles.length === 0) {
      event.target.value = '';
      return;
    }

    setAltaAttachments((prev) => {
      const currentCount = prev.filter((item) => item.typeId === altaDocumentTypeId).length;

      const newItems = allowedFiles.map((file, index) => {
        const absoluteIndex = currentCount + index;
        let positionLabel: string | null = null;

        if (isAltaCedulaVerde) {
          if (absoluteIndex === 0) {
            positionLabel = 'Frente';
          } else if (absoluteIndex === 1) {
            positionLabel = 'Dorso';
          } else {
            positionLabel = `Página ${absoluteIndex + 1}`;
          }
        }

        return {
          id: `${altaDocumentTypeId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          typeId: altaDocumentTypeId,
          typeName: typeLabel,
          vence: altaDocumentRequiresExpiry ? altaDocumentExpiry || null : null,
          positionLabel,
          previewUrl: createImagePreviewUrl(file),
        } as AltaAttachmentItem;
      });

      return [...prev, ...newItems];
    });

    setFlash((prev) => (prev?.type === 'error' ? null : prev));
    event.target.value = '';
  };

  const handleAltaAttachmentsSave = async () => {
    if (altaAttachments.length === 0) {
      setFlash({ type: 'error', message: 'No hay archivos para guardar.' });
      return;
    }

    try {
      setAltaAttachmentsSaving(true);
      setFlash(null);

      let personaId = reviewPersonaDetail?.id ?? null;

      if (!personaId) {
        if (!validateAltaRequiredFields(altaForm)) {
          return;
        }

        const requestPayload = {
          ...buildAltaRequestPayload(altaForm),
          estadoId: null,
          esSolicitud: true,
        };

        const response = await fetch(`${apiBaseUrl}/api/personal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...actorHeaders,
          },
          body: JSON.stringify(requestPayload),
        });

        if (!response.ok) {
          let message = `Error ${response.status}: ${response.statusText}`;
          const errorPayload = (await parseJsonSafe(response).catch(() => null)) as
            | { message?: string; errors?: Record<string, unknown> }
            | null;
          if (typeof errorPayload?.message === 'string') {
            message = errorPayload.message;
          } else if (errorPayload?.errors) {
            const firstError = Object.values(errorPayload.errors)[0];
            if (Array.isArray(firstError) && firstError[0]) {
              message = firstError[0] as string;
            }
          }
          throw new Error(message);
        }

        const payload = (await parseJsonSafe(response)) as { message?: string; data?: { id?: number } };
        personaId = payload.data?.id ?? null;
        if (personaId) {
          cacheSolicitudCreated(personaId, new Date().toISOString());
          writeCachedSolicitudData(personaId, { form: altaForm });
        }
      }

      if (!personaId) {
        throw new Error('No se pudo identificar la solicitud para guardar archivos.');
      }

      const uploadErrors: string[] = [];
      const completedUploadIds: string[] = [];

      for (const item of altaAttachments) {
        const tipoArchivoId = Number(item.typeId);
        if (Number.isNaN(tipoArchivoId)) {
          uploadErrors.push(`${item.file.name}: el tipo de documento no es válido.`);
          continue;
        }

        if (item.file.size > MAX_UPLOAD_SIZE_BYTES) {
          uploadErrors.push(
            `${item.file.name}: supera los ${Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024))} MB permitidos.`
          );
          continue;
        }

        const formData = new FormData();
        formData.append('archivo', item.file, item.file.name);
        formData.append('tipoArchivoId', String(tipoArchivoId));

        const nombrePartes: string[] = [];
        if (item.typeName.trim().length > 0) {
          nombrePartes.push(item.typeName.trim());
        }
        if (item.positionLabel) {
          nombrePartes.push(item.positionLabel);
        }
        if (nombrePartes.length > 0) {
          formData.append('nombre', nombrePartes.join(' – '));
        }
        if (item.vence) {
          formData.append('fechaVencimiento', item.vence);
        }

        try {
          const uploadResponse = await fetch(
            `${apiBaseUrl}/api/personal/${personaId}/documentos`,
            buildPersonalUploadRequestInit(formData)
          );

          if (!uploadResponse.ok) {
            uploadErrors.push(await resolveAltaUploadErrorMessage(uploadResponse, item.file.name));
            continue;
          }

          completedUploadIds.push(item.id);
        } catch (uploadErr) {
          // eslint-disable-next-line no-console
          console.error('Error subiendo documento de alta', uploadErr);
          uploadErrors.push(
            `${item.file.name}: ${(uploadErr as Error).message ?? 'No se pudo subir el archivo.'}`
          );
        }
      }

      if (completedUploadIds.length > 0) {
        setAltaAttachments((prev) => prev.filter((item) => !completedUploadIds.includes(item.id)));
        setAltaFilesVersion((value) => value + 1);
      }

      if (uploadErrors.length > 0) {
        setFlash({
          type: 'error',
          message: `Se guardaron algunos archivos, pero hubo errores: ${uploadErrors.join(' | ')}.`,
        });
      } else {
        setFlash({ type: 'success', message: 'Archivos guardados correctamente.' });
      }

      try {
        const response = await fetch(`${apiBaseUrl}/api/personal/${personaId}`);
        if (response.ok) {
          const payload = (await response.json()) as { data: PersonalDetail };
          const resolvedEstado =
            resolveEstadoNombre(payload.data.estadoId, payload.data.estado) ??
            ((isExplicitRejection(payload.data.estadoId, payload.data.estado) ||
              rejectedIds.has(payload.data.id)) &&
            payload.data.esSolicitud
              ? 'Rechazado'
              : payload.data.estado ?? null);
          setReviewPersonaDetail({
            ...payload.data,
            estado: resolvedEstado,
            comments: Array.isArray(payload.data.comments) ? payload.data.comments : [],
            documentsDownloadAllUrl: payload.data.documentsDownloadAllUrl ?? null,
            documentsDownloadAllAbsoluteUrl: payload.data.documentsDownloadAllAbsoluteUrl ?? null,
          });
          setApprovalEstadoId(payload.data.estadoId ? String(payload.data.estadoId) : '');
        }
      } catch {
        // ignore refresh errors
      }
    } catch (err) {
      setFlash({
        type: 'error',
        message: (err as Error).message ?? 'No se pudieron guardar los archivos.',
      });
    } finally {
      setAltaAttachmentsSaving(false);
    }
  };

  const handleAltaCheckboxChange = (field: 'tarifaEspecial' | 'combustible') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setAltaFormDirty(true);
    setAltaForm((prev) => ({ ...prev, [field]: checked }));
  };

  const handleAltaCobradorToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setAltaFormDirty(true);
    setAltaForm((prev) => ({
      ...prev,
      esCobrador: checked,
    }));
  };

  const handleAltaLookupSelect = (registro: PersonalRecord) => {
    setAltaLookupTerm('');
    navigate(`/aprobaciones?personaId=${registro.id}`);
    setActiveTab('altas');
    setReviewEditMode(false);
    setAltaFormDirty(false);
  };

  const handleAltaPerfilChange = (perfilValue: number) => {
    setAltaForm((prev) => ({
      ...prev,
      perfilValue,
      ...(perfilValue === 2
        ? { esCobrador: true }
        : { esCobrador: prev.esCobrador }),
    }));
  };

  const buildAltaRequestPayload = (form: AltaRequestForm) => {
    const hasCobradorFields = [
      form.cobradorNombre,
      form.cobradorEmail,
      form.cobradorCuil,
      form.cobradorCbuAlias,
    ].some((value) => (value ?? '').trim().length > 0);
    const esCobrador = form.esCobrador || form.perfilValue === 2 || hasCobradorFields;
    const cobradorNombre = form.cobradorNombre.trim() || null;
    const cobradorEmail = form.cobradorEmail.trim() || null;
    const cobradorCuil = form.cobradorCuil.trim() || null;
    const cobradorCbuAlias = form.cobradorCbuAlias.trim() || null;

    const duenoNombre = esCobrador ? cobradorNombre : form.duenoNombre.trim() || null;
    const duenoEmail = esCobrador ? cobradorEmail : form.duenoEmail.trim() || null;
    const duenoCuilCobrador = esCobrador ? cobradorCuil : form.duenoCuilCobrador.trim() || null;
    const duenoCbuAlias = esCobrador ? cobradorCbuAlias : form.duenoCbuAlias.trim() || null;

    return {
      perfilValue: form.perfilValue,
      nombres: form.nombres.trim(),
      apellidos: form.apellidos.trim(),
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      tarifaEspecial: form.tarifaEspecial,
      observacionTarifa: form.observacionTarifa.trim() || null,
      cuil: form.cuil.trim() || null,
      cbuAlias: form.cbuAlias.trim() || null,
      esCobrador,
      cobradorNombre: esCobrador ? cobradorNombre : null,
      cobradorEmail: esCobrador ? cobradorEmail : null,
      cobradorCuil: esCobrador ? cobradorCuil : null,
      cobradorCbuAlias: esCobrador ? cobradorCbuAlias : null,
      pago: serializePagoValue(form.pago),
      combustible: form.combustible,
      fechaAlta: form.fechaAlta || null,
      fechaAltaVinculacion: form.fechaAltaVinculacion || null,
      patente: form.patente.trim() || null,
      clienteId: form.clienteId ? Number(form.clienteId) : null,
      sucursalId: form.sucursalId ? Number(form.sucursalId) : null,
      agenteId: form.agenteId ? Number(form.agenteId) : null,
      agenteResponsableId: (() => {
        if (form.agenteResponsableId) {
          return Number(form.agenteResponsableId);
        }
        const first = form.agenteResponsableIds?.[0];
        return first ? Number(first) : null;
      })(),
      agenteResponsableIds: (() => {
        const selected = Array.isArray(form.agenteResponsableIds)
          ? form.agenteResponsableIds
          : form.agenteResponsableId
          ? [form.agenteResponsableId]
          : [];

        const unique = Array.from(
          new Set(
            selected
              .map((value) => Number(value))
              .filter((num) => !Number.isNaN(num))
          )
        );

        return unique.length > 0 ? unique : null;
      })(),
      unidadId: form.unidadId ? Number(form.unidadId) : null,
      estadoId: form.estadoId ? Number(form.estadoId) : null,
      observaciones: form.observaciones.trim() || null,
      duenoNombre,
      duenoEmail,
      duenoCuilCobrador,
      duenoCbuAlias,
      duenoFechaNacimiento: form.duenoFechaNacimiento || null,
      duenoCuil: form.duenoCuil.trim() || null,
      duenoTelefono: form.duenoTelefono.trim() || null,
      duenoObservaciones: form.duenoObservaciones.trim() || null,
      esSolicitud: true,
    };
  };

  const hasAltaRequiredFields = (form: AltaRequestForm) => {
    const trimmedCuil = form.cuil.trim();
    const trimmedPatente = form.patente.trim();
    const clienteId = Number(form.clienteId);
    const sucursalId = Number(form.sucursalId);

    return (
      trimmedCuil.length > 0
      && trimmedPatente.length > 0
      && Number.isFinite(clienteId)
      && clienteId > 0
      && Number.isFinite(sucursalId)
      && sucursalId > 0
    );
  };

  const validateAltaRequiredFields = (form: AltaRequestForm) => {
    if (!hasAltaRequiredFields(form)) {
      setFlash({
        type: 'error',
        message: `Completá ${PERSON_TAX_ID_LABEL}, Patente, Cliente y Sucursal antes de enviar la solicitud.`,
      });
      return false;
    }

    const shouldRequireCobrador =
      form.esCobrador
      || form.perfilValue === 2
      || [
        form.cobradorNombre,
        form.cobradorEmail,
        form.cobradorCuil,
        form.cobradorCbuAlias,
      ].some((value) => (value ?? '').trim().length > 0);

    if (shouldRequireCobrador) {
      const missing: string[] = [];
      if (!form.cobradorNombre.trim()) {
        missing.push('nombre del cobrador');
      }
      if (!form.cobradorEmail.trim()) {
        missing.push('correo del cobrador');
      }
      if (!form.cobradorCuil.trim()) {
        missing.push('CUIT/CUIL del cobrador');
      }
      if (!form.cobradorCbuAlias.trim()) {
        missing.push('CBU/Alias del cobrador');
      }

      if (missing.length > 0) {
        setFlash({
          type: 'error',
          message: `Completá los datos del cobrador para enviar la solicitud: ${missing.join(', ')}.`,
        });
        return false;
      }
    }

    return true;
  };

  const handleAltaSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateAltaRequiredFields(altaForm)) {
      return;
    }

    try {
      setAltaSubmitting(true);
      setFlash(null);

      const requestPayload = {
        ...buildAltaRequestPayload(altaForm),
        estadoId: null,
        esSolicitud: true,
      };

      const response = await fetch(`${apiBaseUrl}/api/personal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...actorHeaders,
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;

        try {
          const errorPayload = (await parseJsonSafe(response).catch(() => null)) as {
            message?: string;
            errors?: Record<string, unknown>;
          } | null;
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

      const payload = (await parseJsonSafe(response)) as { message?: string; data?: { id?: number } };
      const personaId = payload.data?.id ?? null;
      // Algunos backends no devuelven created_at; guardamos el timestamp de creación apenas recibimos el ID.
      if (personaId) {
        cacheSolicitudCreated(personaId, new Date().toISOString());
      }

      const uploadErrors: string[] = [];
      const completedUploadIds: string[] = [];

      if (personaId && altaAttachments.length > 0) {
        for (const item of altaAttachments) {
          const tipoArchivoId = Number(item.typeId);
          if (Number.isNaN(tipoArchivoId)) {
            uploadErrors.push(`${item.file.name}: el tipo de documento no es válido.`);
            continue;
          }

          if (item.file.size > MAX_UPLOAD_SIZE_BYTES) {
            uploadErrors.push(
              `${item.file.name}: supera los ${Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024))} MB permitidos.`
            );
            continue;
          }

          if (item.file.size > MAX_UPLOAD_SIZE_BYTES) {
            uploadErrors.push(
              `${item.file.name}: supera los ${Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024))} MB permitidos.`
            );
            continue;
          }

          const formData = new FormData();
          formData.append('archivo', item.file, item.file.name);
          formData.append('tipoArchivoId', String(tipoArchivoId));

          const nombrePartes: string[] = [];
          if (item.typeName.trim().length > 0) {
            nombrePartes.push(item.typeName.trim());
          }
          if (item.positionLabel) {
            nombrePartes.push(item.positionLabel);
          }
          if (nombrePartes.length > 0) {
            formData.append('nombre', nombrePartes.join(' – '));
          }
          if (item.vence) {
            formData.append('fechaVencimiento', item.vence);
          }

        try {
          const uploadResponse = await fetch(
              `${apiBaseUrl}/api/personal/${personaId}/documentos`,
              buildPersonalUploadRequestInit(formData)
            );

            if (!uploadResponse.ok) {
              uploadErrors.push(await resolveAltaUploadErrorMessage(uploadResponse, item.file.name));
              continue;
            }

            completedUploadIds.push(item.id);
          } catch (uploadErr) {
            // Surface network errors (CORS, tamaño, etc.)
            // eslint-disable-next-line no-console
            console.error('Error subiendo documento de alta', uploadErr);
            uploadErrors.push(
              `${item.file.name}: ${(uploadErr as Error).message ?? 'No se pudo subir el archivo.'}`
            );
          }
        }
      }

      if (uploadErrors.length > 0 && completedUploadIds.length > 0) {
        setAltaAttachments((prev) => prev.filter((item) => !completedUploadIds.includes(item.id)));
      }

      if (uploadErrors.length > 0) {
        setFlash({
          type: 'error',
          message: `${payload.message ?? 'La solicitud se registró.'} Sin embargo, no se pudieron subir algunos archivos: ${uploadErrors.join(
            ' | '
          )}.`,
        });
        return;
      }

      setFlash({
        type: 'success',
        message: payload.message ?? 'Solicitud de alta registrada correctamente.',
      });

      if (personaId) {
        writeCachedSolicitudData(personaId, { form: altaForm });
      }
      setAltaFormDirty(false);

      const defaultPerfilValue =
        (meta?.perfiles ?? []).find((perfil) => perfil.value !== 2)?.value
        ?? meta?.perfiles?.[0]?.value
        ?? 0;

      setAltaForm((prev) => ({
        perfilValue: defaultPerfilValue,
        nombres: '',
        apellidos: '',
        telefono: '',
        email: '',
        tarifaEspecial: false,
        observacionTarifa: '',
        cuil: '',
        cbuAlias: '',
        pago: '',
        esCobrador: true,
        cobradorNombre: '',
        cobradorEmail: '',
        cobradorCuil: '',
        cobradorCbuAlias: '',
        combustible: false,
        fechaAlta: '',
        patente: '',
        clienteId: '',
        sucursalId: '',
        agenteId: '',
        agenteResponsableId: '',
        agenteResponsableIds: [],
        unidadId: '',
        estadoId: '',
        fechaAltaVinculacion: '',
        observaciones: '',
        duenoNombre: '',
        duenoFechaNacimiento: '',
        duenoEmail: '',
        duenoCuil: '',
        duenoCuilCobrador: '',
        duenoCbuAlias: '',
        duenoTelefono: '',
        duenoObservaciones: '',
      }));
      setAltaAttachments([]);
      setAltaFilesVersion((value) => value + 1);
      setAltaDocumentType('');
      setAltaDocumentExpiry('');
      setReviewPersonaDetail(null);
      setApprovalEstadoId('');
      setReviewCommentText('');
      setReviewCommentError(null);
      setReviewCommentInfo(null);
      setActiveTab('altas');
      fetchSolicitudes();
    } catch (err) {
      setFlash({
        type: 'error',
        message: (err as Error).message ?? 'No se pudo enviar la solicitud.',
      });
    } finally {
      setAltaSubmitting(false);
    }
  };

  const handleAltaUpdateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!reviewPersonaDetail) {
      return;
    }

    if (!validateAltaRequiredFields(altaForm)) {
      return;
    }

    try {
      setAltaSubmitting(true);
      setFlash(null);

      const requestPayload = {
        ...buildAltaRequestPayload(altaForm),
        esSolicitud: true,
      };

      const requestInit: RequestInit = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...actorHeaders,
        },
        body: JSON.stringify(requestPayload),
      };
      let response = await fetch(`${apiBaseUrl}/api/personal/${reviewPersonaDetail.id}`, requestInit);
      if (response.status === 405) {
        response = await fetch(`${apiBaseUrl}/api/personal/${reviewPersonaDetail.id}`, {
          ...requestInit,
          method: 'POST',
        });
      }

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = (await parseJsonSafe(response).catch(() => null)) as {
            message?: string;
          } | null;
          if (typeof payload?.message === 'string') {
            message = payload.message;
          }
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }

      const payload = (await parseJsonSafe(response)) as {
        message?: string;
        data?: PersonalDetail;
      };

      if (payload.data) {
        setReviewPersonaDetail({
          ...payload.data,
          comments: Array.isArray(payload.data.comments)
            ? payload.data.comments
            : reviewPersonaDetail.comments ?? [],
        });
      } else {
        populateAltaFormFromReview();
      }
      setAltaFormDirty(false);

      const personaId = payload.data?.id ?? reviewPersonaDetail.id;

      if (personaId && altaAttachments.length > 0) {
        const uploadErrors: string[] = [];
        const completedUploadIds: string[] = [];

        for (const item of altaAttachments) {
          const tipoArchivoId = Number(item.typeId);
          if (Number.isNaN(tipoArchivoId)) {
            uploadErrors.push(`${item.file.name}: el tipo de documento no es válido.`);
            continue;
          }

          const formData = new FormData();
          formData.append('archivo', item.file, item.file.name);
          formData.append('tipoArchivoId', String(tipoArchivoId));

          const nombrePartes: string[] = [];
          if (item.typeName.trim().length > 0) {
            nombrePartes.push(item.typeName.trim());
          }
          if (item.positionLabel) {
            nombrePartes.push(item.positionLabel);
          }
          if (nombrePartes.length > 0) {
            formData.append('nombre', nombrePartes.join(' – '));
          }
          if (item.vence) {
            formData.append('fechaVencimiento', item.vence);
          }

          try {
            const uploadResponse = await fetch(
              `${apiBaseUrl}/api/personal/${personaId}/documentos`,
              buildPersonalUploadRequestInit(formData)
            );

            if (!uploadResponse.ok) {
              uploadErrors.push(await resolveAltaUploadErrorMessage(uploadResponse, item.file.name));
              continue;
            }

            completedUploadIds.push(item.id);
          } catch (uploadErr) {
            // eslint-disable-next-line no-console
            console.error('Error subiendo documento de alta', uploadErr);
            uploadErrors.push(
              `${item.file.name}: ${(uploadErr as Error).message ?? 'No se pudo subir el archivo.'}`
            );
          }
        }

        if (uploadErrors.length > 0 && completedUploadIds.length > 0) {
          setAltaAttachments((prev) => prev.filter((item) => !completedUploadIds.includes(item.id)));
        }

        if (uploadErrors.length > 0) {
          setFlash({
            type: 'error',
            message: `${payload.message ?? 'Los datos se guardaron.'} Sin embargo, no se pudieron subir algunos archivos: ${uploadErrors.join(
              ' | '
            )}.`,
          });
          return;
        }
      }

      setFlash({
        type: 'success',
        message: payload.message ?? 'Cambios guardados correctamente.',
      });

      setReviewEditMode(false);
      setAltaAttachments([]);
      setAltaFilesVersion((value) => value + 1);
      setAltaDocumentType('');
      setAltaDocumentExpiry('');
      fetchSolicitudes();
    } catch (err) {
      setFlash({
        type: 'error',
        message: (err as Error).message ?? 'No se pudieron guardar los cambios.',
      });
    } finally {
      setAltaSubmitting(false);
    }
  };

  const handleApproveSolicitud = async (forcedEstadoId?: number) => {
    if (!reviewPersonaDetail) {
      return;
    }

    if (!canEditSolicitud) {
      setFlash({ type: 'error', message: 'Solo se puede aprobar o rechazar una solicitud pendiente.' });
      return;
    }

    const resolvedDefaultEstadoId = (() => {
      const estados = meta?.estados ?? [];
      const preActivoMatch = estados.find((estado) => {
        const normalized = (estado.nombre ?? '')
          .trim()
          .toLowerCase()
          .replace(/[_-]+/g, ' ')
          .replace(/\s+/g, ' ');
        return normalized === 'pre activo' || normalized === 'preactivo';
      });

      if (preActivoMatch?.id) {
        return String(preActivoMatch.id);
      }

      const activoMatch = estados.find(
        (estado) => (estado.nombre ?? '').trim().toLowerCase() === 'activo'
      );

      return activoMatch?.id ? String(activoMatch.id) : '';
    })();

    try {
      setApproveLoading(true);
      setFlash(null);

      const payloadBody: Record<string, unknown> = {
        userId: authUser?.id ?? null,
      };

      const parsedApprovalEstadoId =
        approvalEstadoId && !Number.isNaN(Number(approvalEstadoId)) ? Number(approvalEstadoId) : null;

      const effectiveEstadoId =
        forcedEstadoId ??
        (parsedApprovalEstadoId
          ? parsedApprovalEstadoId
          : resolvedDefaultEstadoId
          ? Number(resolvedDefaultEstadoId)
          : null);

      const normalizeEstadoLabel = (value: string | null | undefined) =>
        (value ?? '')
          .trim()
          .toLowerCase()
          .replace(/[_-]+/g, ' ')
          .replace(/\s+/g, ' ');

      const selectedEstadoNombre = effectiveEstadoId
        ? meta?.estados?.find((estado) => String(estado.id) === String(effectiveEstadoId))?.nombre ?? null
        : null;
      const isEstadoEnviadoSelected = normalizeEstadoLabel(selectedEstadoNombre) === 'enviado';

      if (isEstadoEnviadoSelected && effectiveEstadoId) {
        const endpoint = `${apiBaseUrl}/api/personal/${reviewPersonaDetail.id}`;
        const requestInit: RequestInit = {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...actorHeaders,
          },
          body: JSON.stringify({ estadoId: effectiveEstadoId }),
        };
        let response = await fetch(endpoint, requestInit);
        if (
          response.status === 405 ||
          (response.ok &&
            !((response.headers.get('content-type') ?? '').toLowerCase().includes('application/json')))
        ) {
          response = await fetch(endpoint, { ...requestInit, method: 'POST' });
        }

        if (!response.ok) {
          let message = `Error ${response.status}: ${response.statusText}`;
          const payload = (await parseJsonSafe(response).catch(() => null)) as { message?: string } | null;
          if (typeof payload?.message === 'string') {
            message = payload.message;
          }

          throw new Error(message);
        }

        const payload = (await parseJsonSafe(response)) as { message?: string; data?: PersonalDetail };
        const estadoEnviadoNombre = payload.data?.estado ?? selectedEstadoNombre ?? 'Enviado';
        const payloadComments = Array.isArray(payload.data?.comments)
          ? payload.data?.comments ?? []
          : null;
        const updatedRecord = {
          ...reviewPersonaDetail,
          ...payload.data,
          nombre:
            [
              payload.data?.nombres ?? reviewPersonaDetail.nombres,
              payload.data?.apellidos ?? reviewPersonaDetail.apellidos,
            ]
              .filter((part) => part && part.trim().length > 0)
              .join(' ')
              .trim() || null,
          estadoId: effectiveEstadoId,
          estado: estadoEnviadoNombre,
          esSolicitud: true,
          aprobado: false,
          aprobadoAt: null,
          aprobadoPor: null,
          aprobadoPorId: null,
          aprobadoPorNombre: null,
        } as unknown as PersonalRecord;

        setReviewPersonaDetail((prev) =>
          prev
            ? {
                ...prev,
                ...payload.data,
                estadoId: effectiveEstadoId,
                estado: estadoEnviadoNombre,
                esSolicitud: true,
                aprobado: false,
                aprobadoAt: null,
                aprobadoPor: null,
                aprobadoPorId: null,
                aprobadoPorNombre: null,
                comments: payloadComments
                  ? payloadComments
                  : Array.isArray(prev.comments)
                  ? prev.comments
                  : [],
              }
            : prev
        );
        setBackendSolicitudes((prev) =>
          prev.map((item) =>
            item.id === reviewPersonaDetail.id
              ? {
                  ...item,
                  estadoId: effectiveEstadoId,
                  estado: estadoEnviadoNombre,
                  esSolicitud: true,
                  aprobado: false,
                  aprobadoAt: null,
                  aprobadoPor: null,
                }
              : item
          )
        );
        setLocalSolicitudes((prev) =>
          prev.map((item) =>
            item.id === reviewPersonaDetail.id
              ? {
                  ...item,
                  estadoId: effectiveEstadoId,
                  estado: estadoEnviadoNombre,
                  esSolicitud: true,
                  aprobado: false,
                  aprobadoAt: null,
                  aprobadoPor: null,
                }
              : item
          )
        );
        setRejectedIds((prev) => {
          const next = new Set(prev);
          next.delete(reviewPersonaDetail.id);
          return next;
        });

        setFlash({
          type: 'success',
          message: payload.message ?? 'Solicitud marcada como enviada.',
        });
        window.dispatchEvent(
          new CustomEvent('personal:updated', {
            detail: { persona: updatedRecord },
          })
        );
        return;
      }

      if (effectiveEstadoId) {
        payloadBody.estadoId = effectiveEstadoId;
      }

      const response = await fetch(`${apiBaseUrl}/api/personal/${reviewPersonaDetail.id}/aprobar`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...actorHeaders,
        },
        body: JSON.stringify(payloadBody),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        const payload = (await parseJsonSafe(response).catch(() => null)) as { message?: string } | null;
        if (typeof payload?.message === 'string') {
          message = payload.message;
        }

        throw new Error(message);
      }

      const payload = (await parseJsonSafe(response)) as {
        message?: string;
        data?: {
          aprobadoAt?: string | null;
          aprobadoPorId?: number | null;
          aprobadoPorNombre?: string | null;
          esSolicitud?: boolean;
          personalRecord?: PersonalRecord;
        };
      };

      const resolvedEstadoId = (() => {
        if (effectiveEstadoId) {
          return effectiveEstadoId;
        }
        return reviewPersonaDetail.estadoId ?? payload.data?.personalRecord?.estadoId ?? null;
      })();

      const estadoActualizadoNombre = (() => {
        if (effectiveEstadoId) {
          const targetId = String(effectiveEstadoId);
          return (
            meta?.estados?.find((estado) => String(estado.id) === targetId)?.nombre ??
            payload.data?.personalRecord?.estado ??
            reviewPersonaDetail.estado
          );
        }
        return payload.data?.personalRecord?.estado ?? reviewPersonaDetail.estado;
      })();

      const resolvedFechaAlta =
        payload.data?.personalRecord?.fechaAlta ??
        reviewPersonaDetail.fechaAlta ??
        null;

      const resolvedAprobadoPorId =
        payload.data?.aprobadoPorId ?? reviewPersonaDetail.aprobadoPorId ?? (authUser?.id ?? null);
      const resolvedAprobadoPorNombre =
        payload.data?.aprobadoPorNombre ??
        (resolvedAprobadoPorId === authUser?.id && authUser?.name
          ? authUser.name
          : reviewPersonaDetail.aprobadoPorNombre);
      const resolvedAprobadoAt =
        payload.data?.aprobadoAt ??
        payload.data?.personalRecord?.aprobadoAt ??
        reviewPersonaDetail.aprobadoAt ??
        null;

      const fullNameFromReview = [reviewPersonaDetail.nombres, reviewPersonaDetail.apellidos]
        .filter((part) => part && part.trim().length > 0)
        .join(' ')
        .trim();

      const solicitudAltaForm = (
        reviewPersonaDetail.solicitudData as { form?: AltaRequestForm } | null | undefined
      )?.form;

      const normalizeCobradorValue = (value: string | null | undefined) => {
        const trimmed = (value ?? '').trim();
        return trimmed.length > 0 ? trimmed : null;
      };

      const fallbackNombreCompletoSolicitud = solicitudAltaForm
        ? [solicitudAltaForm.nombres, solicitudAltaForm.apellidos].filter(Boolean).join(' ').trim()
        : '';
      const fallbackEmailSolicitud = solicitudAltaForm?.email ?? '';
      const fallbackCuilSolicitud = solicitudAltaForm?.cuil ?? '';
      const fallbackCbuAliasSolicitud = solicitudAltaForm?.cbuAlias ?? '';

      const fallbackCobradorNombre =
        normalizeCobradorValue(solicitudAltaForm?.cobradorNombre) ??
        normalizeCobradorValue(reviewPersonaDetail.cobradorNombre) ??
        normalizeCobradorValue(reviewPersonaDetail.duenoNombre) ??
        normalizeCobradorValue(fallbackNombreCompletoSolicitud) ??
        normalizeCobradorValue(fullNameFromReview);
      const fallbackCobradorEmail =
        normalizeCobradorValue(solicitudAltaForm?.cobradorEmail) ??
        normalizeCobradorValue(reviewPersonaDetail.cobradorEmail) ??
        normalizeCobradorValue(reviewPersonaDetail.duenoEmail) ??
        normalizeCobradorValue(fallbackEmailSolicitud);
      const fallbackCobradorCuil =
        normalizeCobradorValue(solicitudAltaForm?.cobradorCuil) ??
        normalizeCobradorValue(reviewPersonaDetail.cobradorCuil) ??
        normalizeCobradorValue(reviewPersonaDetail.duenoCuilCobrador) ??
        normalizeCobradorValue(reviewPersonaDetail.duenoCuil) ??
        normalizeCobradorValue(fallbackCuilSolicitud);
      const fallbackCobradorCbuAlias =
        normalizeCobradorValue(solicitudAltaForm?.cobradorCbuAlias) ??
        normalizeCobradorValue(reviewPersonaDetail.cobradorCbuAlias) ??
        normalizeCobradorValue(reviewPersonaDetail.duenoCbuAlias) ??
        normalizeCobradorValue(fallbackCbuAliasSolicitud);

      const resolvedEsCobrador =
        payload.data?.personalRecord?.esCobrador
        ?? reviewPersonaDetail.esCobrador
        ?? solicitudAltaForm?.esCobrador
        ?? false;
      const resolvedCobradorNombre =
        payload.data?.personalRecord?.cobradorNombre ??
        fallbackCobradorNombre;
      const resolvedCobradorEmail =
        payload.data?.personalRecord?.cobradorEmail ??
        fallbackCobradorEmail;
      const resolvedCobradorCuil =
        payload.data?.personalRecord?.cobradorCuil ??
        fallbackCobradorCuil;
      const resolvedCobradorCbuAlias =
        payload.data?.personalRecord?.cobradorCbuAlias ??
        fallbackCobradorCbuAlias;

      const resolvedPersonalRecord = {
        ...reviewPersonaDetail,
        ...payload.data?.personalRecord,
        solicitudData: reviewPersonaDetail.solicitudData ?? payload.data?.personalRecord?.solicitudData,
        nombre:
          payload.data?.personalRecord?.nombre ??
          (() => {
            const fromDetail = [reviewPersonaDetail.nombres, reviewPersonaDetail.apellidos]
              .filter((part) => part && part.trim().length > 0)
              .join(' ')
              .trim();
            if (fromDetail) {
              return fromDetail;
            }
            if (fallbackNombreCompletoSolicitud) {
              return fallbackNombreCompletoSolicitud;
            }
            return null;
          })(),
        nombres: payload.data?.personalRecord?.nombres ?? reviewPersonaDetail.nombres ?? solicitudAltaForm?.nombres ?? null,
        apellidos:
          payload.data?.personalRecord?.apellidos ?? reviewPersonaDetail.apellidos ?? solicitudAltaForm?.apellidos ?? null,
        cuil: payload.data?.personalRecord?.cuil ?? reviewPersonaDetail.cuil ?? solicitudAltaForm?.cuil ?? null,
        email: payload.data?.personalRecord?.email ?? reviewPersonaDetail.email ?? solicitudAltaForm?.email ?? null,
        cbuAlias:
          payload.data?.personalRecord?.cbuAlias ??
          reviewPersonaDetail.cbuAlias ??
          solicitudAltaForm?.cbuAlias ??
          null,
        telefono:
          payload.data?.personalRecord?.telefono ?? reviewPersonaDetail.telefono ?? solicitudAltaForm?.telefono ?? null,
        aprobado: true,
        aprobadoAt: resolvedAprobadoAt,
        aprobadoPor: payload.data?.personalRecord?.aprobadoPor ?? resolvedAprobadoPorNombre ?? null,
        aprobadoPorId: resolvedAprobadoPorId,
        aprobadoPorNombre: resolvedAprobadoPorNombre ?? payload.data?.personalRecord?.aprobadoPorNombre ?? null,
        estadoId: resolvedEstadoId ?? reviewPersonaDetail.estadoId ?? null,
        estado: estadoActualizadoNombre,
        fechaAlta: resolvedFechaAlta,
        combustible: payload.data?.personalRecord?.combustible ?? reviewPersonaDetail.combustible ?? null,
        tarifaEspecial: payload.data?.personalRecord?.tarifaEspecial ?? reviewPersonaDetail.tarifaEspecial ?? null,
        esCobrador: resolvedEsCobrador,
        cobradorNombre: resolvedCobradorNombre,
        cobradorEmail: resolvedCobradorEmail,
        cobradorCuil: resolvedCobradorCuil,
        cobradorCbuAlias: resolvedCobradorCbuAlias,
        esSolicitud: false,
      } as unknown as PersonalRecord;

      setReviewPersonaDetail((prev) => {
        if (!prev) {
          return prev;
        }

        const esCobradorActualizado =
          payload.data?.personalRecord?.esCobrador ?? prev.esCobrador ?? false;
        const fullNameFromPrev = [prev.nombres, prev.apellidos]
          .filter((part) => part && part.trim().length > 0)
          .join(' ')
          .trim();
        const normalizePrevCobrador = (value: string | null | undefined) => {
          const trimmed = (value ?? '').trim();
          return trimmed.length > 0 ? trimmed : null;
        };
        const fallbackPrevNombre =
          normalizePrevCobrador(prev.cobradorNombre) ??
          normalizePrevCobrador(prev.duenoNombre) ??
          normalizePrevCobrador(fullNameFromPrev);
        const fallbackPrevEmail =
          normalizePrevCobrador(prev.cobradorEmail) ??
          normalizePrevCobrador(prev.duenoEmail);
        const fallbackPrevCuil =
          normalizePrevCobrador(prev.cobradorCuil) ??
          normalizePrevCobrador(prev.duenoCuilCobrador) ??
          normalizePrevCobrador(prev.duenoCuil);
        const fallbackPrevCbuAlias =
          normalizePrevCobrador(prev.cobradorCbuAlias) ??
          normalizePrevCobrador(prev.duenoCbuAlias);
        const cobradorNombreActualizado =
          payload.data?.personalRecord?.cobradorNombre ??
          fallbackPrevNombre;
        const cobradorEmailActualizado =
          payload.data?.personalRecord?.cobradorEmail ??
          fallbackPrevEmail;
        const cobradorCuilActualizado =
          payload.data?.personalRecord?.cobradorCuil ??
          fallbackPrevCuil;
        const cobradorCbuAliasActualizado =
          payload.data?.personalRecord?.cobradorCbuAlias ??
          fallbackPrevCbuAlias;

        return {
          ...prev,
          ...payload.data?.personalRecord,
          aprobado: true,
          aprobadoAt: resolvedAprobadoAt,
          aprobadoPorId: resolvedAprobadoPorId,
          aprobadoPorNombre: resolvedAprobadoPorNombre,
          estadoId: resolvedEstadoId ?? prev.estadoId,
          estado: estadoActualizadoNombre,
          fechaAlta: resolvedFechaAlta,
          esCobrador: esCobradorActualizado,
          cobradorNombre: cobradorNombreActualizado,
          cobradorEmail: cobradorEmailActualizado,
          cobradorCuil: cobradorCuilActualizado,
          cobradorCbuAlias: cobradorCbuAliasActualizado,
        comments: Array.isArray(prev.comments) ? prev.comments : [],
        esSolicitud: false,
      };
    });

      const rejectionMatch = meta?.estados?.find((estado) => {
        const normalized = (estado.nombre ?? '').trim().toLowerCase();
        return effectiveEstadoId ? String(estado.id) === String(effectiveEstadoId) : normalized.includes('rechaz');
      });
      const isRejection = Boolean(rejectionMatch);
      if (!isRejection && resolvedPersonalRecord?.id) {
        setRejectedIds((prev) => {
          const next = new Set(prev);
          next.delete(resolvedPersonalRecord.id);
          return next;
        });
      }

      setFlash({
        type: 'success',
        message: payload.message ?? (isRejection ? 'Solicitud rechazada correctamente.' : 'Solicitud aprobada correctamente.'),
      });

      const personaNombreCompleto =
        resolvedPersonalRecord.nombre ??
        [reviewPersonaDetail.nombres, reviewPersonaDetail.apellidos]
          .filter((part) => part && part.trim().length > 0)
          .join(' ')
          .trim();
      const agenteNombre =
        resolvedPersonalRecord.agente && resolvedPersonalRecord.agente.trim().length > 0
          ? resolvedPersonalRecord.agente.trim()
          : authUser?.name ?? null;

      if (!isRejection) {
        window.dispatchEvent(
          new CustomEvent('celebration:trigger', {
            detail: {
              title: '¡Felicitaciones!',
              message: agenteNombre
                ? `${agenteNombre}, ¡la solicitud fue aprobada con éxito!`
                : '¡La solicitud fue aprobada con éxito!',
              detail: personaNombreCompleto
                ? `El alta de ${personaNombreCompleto} ya está activa.`
                : undefined,
            },
          })
        );
      }

      window.dispatchEvent(new CustomEvent('notifications:updated'));

      if (reviewPersonaDetail.solicitudData) {
        writeCachedSolicitudData(resolvedPersonalRecord.id, reviewPersonaDetail.solicitudData);
      }

      window.dispatchEvent(
        new CustomEvent('personal:updated', {
          detail: { persona: resolvedPersonalRecord },
        })
      );

      if (!isRejection) {
        navigate(`/personal/${resolvedPersonalRecord.id}/editar`);
      }
    } catch (err) {
      setFlash({
        type: 'error',
        message: (err as Error).message ?? 'No se pudo aprobar la solicitud.',
      });
    } finally {
      setApproveLoading(false);
    }
  };

  const handleRejectSolicitud = async () => {
    if (!reviewPersonaDetail) {
      return;
    }
    if (!canEditSolicitud) {
      setFlash({ type: 'error', message: 'Solo se puede aprobar o rechazar una solicitud pendiente.' });
      return;
    }

    const estados = meta?.estados ?? [];
    const { rechazoEstadoId, rechazoDisplayNameFallback } = (() => {
      const result: { rechazoEstadoId: number | null; rechazoDisplayNameFallback: string | null } = {
        rechazoEstadoId: null,
        rechazoDisplayNameFallback: null,
      };

      const parsedApprovalEstadoId =
        approvalEstadoId && !Number.isNaN(Number(approvalEstadoId)) ? Number(approvalEstadoId) : null;
      const approvalIsSynthetic = approvalEstadoId === 'synthetic_rechazado';

      if (parsedApprovalEstadoId) {
        result.rechazoEstadoId = parsedApprovalEstadoId;
        return result;
      }
      if (approvalIsSynthetic) {
        result.rechazoDisplayNameFallback = 'Rechazado';
      }
      const normalizedEstados = estados.map((estado) => ({
        id: estado.id,
        nombre: (estado.nombre ?? '').toLowerCase(),
      }));
      const matchRechazo = normalizedEstados.find((estado) => estado.nombre.includes('rechaz'));
      if (matchRechazo?.id) {
        result.rechazoEstadoId = Number(matchRechazo.id);
        result.rechazoDisplayNameFallback = null;
        return result;
      }

      const matchBaja = normalizedEstados.find(
        (estado) => estado.nombre.includes('baja') || estado.nombre.includes('suspend')
      );
      if (matchBaja?.id) {
        result.rechazoEstadoId = Number(matchBaja.id);
        result.rechazoDisplayNameFallback = 'Rechazado';
        return result;
      }

      return result;
    })();

    if (!rechazoEstadoId) {
      setFlash({
        type: 'error',
        message:
          'No hay un estado de rechazo disponible. Elegí uno manualmente en "Actualizar estado" o agregá uno en la administración de estados.',
      });
      return;
    }

    const applyLocalRejection = (estadoNombre: string) => {
      setReviewPersonaDetail((prev) =>
        prev
          ? {
              ...prev,
              estadoId: rechazoEstadoId,
              estado: estadoNombre,
              esSolicitud: true,
              aprobado: false,
              aprobadoAt: null,
              aprobadoPor: null,
              aprobadoPorId: null,
              aprobadoPorNombre: null,
            }
          : prev
      );
      setRejectedIds((prev) => {
        const next = new Set(prev);
        next.add(reviewPersonaDetail.id);
        return next;
      });
      setBackendSolicitudes((prev) =>
        prev.map((item) =>
          item.id === reviewPersonaDetail.id
            ? {
                ...item,
                estadoId: rechazoEstadoId,
                estado: estadoNombre,
                esSolicitud: true,
                aprobado: false,
                aprobadoAt: null,
                aprobadoPor: null,
              }
            : item
        )
      );
      setLocalSolicitudes((prev) =>
        prev.map((item) =>
          item.id === reviewPersonaDetail.id
            ? {
                ...item,
                estadoId: rechazoEstadoId,
                estado: estadoNombre,
                esSolicitud: true,
                aprobado: false,
                aprobadoAt: null,
                aprobadoPor: null,
              }
            : item
        )
      );
    };

    if (!Number.isFinite(Number(reviewPersonaDetail.id)) || Number(reviewPersonaDetail.id) <= 0) {
      const fallbackName = rechazoDisplayNameFallback ?? 'Rechazado';
      applyLocalRejection(fallbackName);
      setFlash({
        type: 'success',
        message: 'Solicitud rechazada correctamente.',
      });
      return;
    }

    try {
      setApproveLoading(true);
      setFlash(null);
      const endpoint = `${apiBaseUrl}/api/personal/${reviewPersonaDetail.id}`;
      const isJsonResponse = (targetResponse: Response) =>
        (targetResponse.headers.get('content-type') ?? '').toLowerCase().includes('application/json');

      const requestInit: RequestInit = {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...actorHeaders,
        },
        body: JSON.stringify({ estadoId: rechazoEstadoId }),
      };

      let response = await fetch(endpoint, requestInit);
      if (response.status === 405 || (response.ok && !isJsonResponse(response))) {
        response = await fetch(endpoint, {
          ...requestInit,
          method: 'POST',
        });
      }

      if (!response.ok) {
        if (response.status === 404) {
          const fallbackName = rechazoDisplayNameFallback ?? 'Rechazado';
          applyLocalRejection(fallbackName);
          setFlash({
            type: 'error',
            message: 'La solicitud no existe en el servidor. Se actualizó el estado local.',
          });
          fetchSolicitudes();
          return;
        }
        let message = `Error ${response.status}: ${response.statusText}`;
        const payload = (await parseJsonSafe(response).catch(() => null)) as { message?: string } | null;
        if (typeof payload?.message === 'string') {
          message = payload.message;
        }
        throw new Error(message);
      }

      const payload = (await parseJsonSafe(response)) as { message?: string; data?: PersonalDetail };

      if (payload.data) {
        const chosenNombre =
          estados.find((estado) => Number(estado.id) === rechazoEstadoId)?.nombre ??
          payload.data.estado ??
          null;
        const estadoNombre = (() => {
          if (rechazoDisplayNameFallback) {
            return rechazoDisplayNameFallback;
          }
          const normalized = (chosenNombre ?? '').toLowerCase();
          if (normalized.includes('baja') || normalized.includes('suspend')) {
            return 'Rechazado';
          }
          return chosenNombre ?? 'Rechazado';
        })();
        const updatedDetail = {
          ...payload.data,
          estadoId: rechazoEstadoId,
          estado: estadoNombre,
          esSolicitud: true,
          aprobado: false,
          aprobadoAt: null,
          aprobadoPor: null,
          aprobadoPorId: null,
          aprobadoPorNombre: null,
        };
        setReviewPersonaDetail(updatedDetail);
        setRejectedIds((prev) => {
          const next = new Set(prev);
          next.add(updatedDetail.id);
          return next;
        });
        sendRejectionNotification(updatedDetail);
        window.dispatchEvent(
          new CustomEvent('personal:updated', {
            detail: { persona: updatedDetail },
          })
        );
        window.dispatchEvent(new CustomEvent('notifications:updated'));
      }

      setFlash({
        type: 'success',
        message: payload.message ?? 'Solicitud rechazada correctamente.',
      });
    } catch (err) {
      setFlash({
        type: 'error',
        message: (err as Error).message ?? 'No se pudo rechazar la solicitud.',
      });
    } finally {
      setApproveLoading(false);
    }
  };

  const handleReviewCommentSubmit = async () => {
    if (!reviewPersonaDetail) {
      return;
    }

    const trimmed = reviewCommentText.trim();
    if (trimmed.length === 0) {
      setReviewCommentError('Escribe un mensaje antes de enviarlo.');
      return;
    }

    try {
      setReviewCommentSaving(true);
      setReviewCommentError(null);
      setReviewCommentInfo(null);

      const response = await fetch(`${apiBaseUrl}/api/personal/${reviewPersonaDetail.id}/comentarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmed,
          userId: authUser?.id ?? null,
        }),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = (await parseJsonSafe(response).catch(() => null)) as {
            message?: string;
          } | null;
          if (typeof payload?.message === 'string') {
            message = payload.message;
          }
        } catch {
          // ignore
        }

        throw new Error(message);
      }

      const payload = (await response.json()) as {
        message?: string;
        data: {
          id: number;
          message: string | null;
          userId: number | null;
          userName: string | null;
          createdAt: string | null;
          createdAtLabel: string | null;
        };
      };

      setReviewPersonaDetail((prev) => {
        if (!prev) {
          return prev;
        }

        const existing = Array.isArray(prev.comments) ? prev.comments : [];
        return {
          ...prev,
          comments: [payload.data, ...existing],
        };
      });

      setReviewCommentText('');
      setReviewCommentInfo(payload.message ?? 'Comentario agregado.');
      window.dispatchEvent(new CustomEvent('notifications:updated'));
    } catch (err) {
      setReviewCommentError((err as Error).message ?? 'No se pudo enviar el comentario.');
    } finally {
      setReviewCommentSaving(false);
    }
  };

  const handleCombustibleFieldChange =
    (field: keyof CombustibleRequestForm) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setCombustibleForm((prev) => ({
        ...prev,
        [field]: value,
        ...(field === 'empresaId' ? { sucursalId: '' } : {}),
      }));
    };

  const handleCombustibleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCombustibleAttachments(filesFromEvent(event.target.files));
  };

  const handleCombustibleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setCombustibleSubmitting(true);
      setFlash(null);

      const formSnapshot = { ...combustibleForm };
      const attachmentNames = combustibleAttachments.map((file) => file.name);
      const clienteNombre =
        formSnapshot.empresaId && meta?.clientes
          ? meta.clientes.find((cliente) => cliente.id === Number(formSnapshot.empresaId))?.nombre ?? null
          : null;
      const sucursalNombre =
        formSnapshot.sucursalId && meta?.sucursales
          ? meta.sucursales.find((sucursal) => sucursal.id === Number(formSnapshot.sucursalId))?.nombre ?? null
          : null;
      const unidadDetalle = [formSnapshot.marca, formSnapshot.modelo].filter(Boolean).join(' · ') || null;
      const todayLabel = new Date().toISOString().slice(0, 10);

      const agenteNombre = resolveAgenteNombre(formSnapshot.agenteId);

      const newRecord: PersonalRecord = {
        id: createSyntheticId(),
        nombre: formSnapshot.nombreCompleto || null,
        cuil: null,
        telefono: null,
        email: formSnapshot.serviClubEmail || null,
        cliente: clienteNombre,
        unidad: formSnapshot.patente || null,
        unidadDetalle,
        sucursal: sucursalNombre,
        fechaAlta: todayLabel,
        perfil: 'Solicitud de combustible',
        perfilValue: null,
        agente: agenteNombre,
        estado: 'Pendiente',
        combustible: null,
        combustibleValue: false,
        tarifaEspecial: null,
        tarifaEspecialValue: false,
        aprobado: false,
        aprobadoAt: null,
        aprobadoPor: null,
        esSolicitud: true,
        solicitudTipo: 'combustible',
        solicitudData: {
          form: formSnapshot,
          adjuntos: attachmentNames,
        },
      };
      appendLocalSolicitud(newRecord);

      setFlash({
        type: 'success',
        message: 'Solicitud de combustible registrada (modo demostración).',
      });

      setCombustibleForm({
        empresaId: '',
        sucursalId: '',
        nombreCompleto: '',
        dni: '',
        serviClubEmail: '',
        patente: '',
        marca: '',
        modelo: '',
        kilometraje: '',
        observaciones: '',
        agenteId: '',
      });
      setCombustibleAttachments([]);
      setCombustibleFilesVersion((value) => value + 1);
      handleGoToList();
    } catch (err) {
      setFlash({
        type: 'error',
        message: (err as Error).message ?? 'No se pudo registrar la solicitud de combustible.',
      });
    } finally {
      setCombustibleSubmitting(false);
    }
  };

  const handleAumentoFieldChange =
    (field: keyof AumentoCombustibleForm) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setAumentoCombustibleForm((prev) => ({
        ...prev,
        [field]: value,
        ...(field === 'empresaId' ? { sucursalId: '' } : {}),
      }));
    };

  const handleAumentoFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAumentoAttachments(filesFromEvent(event.target.files));
  };

  const handleAumentoSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setAumentoSubmitting(true);
      setFlash(null);

      const formSnapshot = { ...aumentoCombustibleForm };
      const attachmentNames = aumentoAttachments.map((file) => file.name);
      const clienteNombre =
        formSnapshot.empresaId && meta?.clientes
          ? meta.clientes.find((cliente) => cliente.id === Number(formSnapshot.empresaId))?.nombre ?? null
          : null;
      const sucursalNombre =
        formSnapshot.sucursalId && meta?.sucursales
          ? meta.sucursales.find((sucursal) => sucursal.id === Number(formSnapshot.sucursalId))?.nombre ?? null
          : null;
      const unidadDetalle = [formSnapshot.marca, formSnapshot.modelo].filter(Boolean).join(' · ') || null;
      const agenteNombre = resolveAgenteNombre(formSnapshot.agenteId);

      const newRecord: PersonalRecord = {
        id: createSyntheticId(),
        nombre: formSnapshot.nombreCompleto || null,
        cuil: null,
        telefono: null,
        email: formSnapshot.serviClubEmail || null,
        cliente: clienteNombre,
        unidad: formSnapshot.patente || null,
        unidadDetalle,
        sucursal: sucursalNombre,
        fechaAlta: null,
        perfil: 'Aumento de combustible',
        perfilValue: null,
        agente: agenteNombre,
        estado: 'Pendiente',
        combustible: null,
        combustibleValue: false,
        tarifaEspecial: null,
        tarifaEspecialValue: false,
        aprobado: false,
        aprobadoAt: null,
        aprobadoPor: null,
        esSolicitud: true,
        solicitudTipo: 'aumento_combustible',
        solicitudData: {
          form: formSnapshot,
          adjuntos: attachmentNames,
        },
      };

      appendLocalSolicitud(newRecord);

      setFlash({
        type: 'success',
        message: 'Solicitud de aumento de combustible registrada (modo demostración).',
      });
      setAumentoCombustibleForm({
        empresaId: '',
        sucursalId: '',
        nombreCompleto: '',
        dni: '',
        serviClubEmail: '',
        patente: '',
        marca: '',
        modelo: '',
        kilometraje: '',
        litrosActuales: '',
        litrosSolicitados: '',
        motivo: '',
        agenteId: '',
      });
      setAumentoAttachments([]);
      setAumentoFilesVersion((value) => value + 1);
      handleGoToList();
    } catch (err) {
      setFlash({
        type: 'error',
        message: (err as Error).message ?? 'No se pudo registrar el aumento de combustible.',
      });
    } finally {
      setAumentoSubmitting(false);
    }
  };

  const handlePolizaObservacionesChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = event.target;
    setPolizaForm((prev) => ({ ...prev, observaciones: value }));
  };

  const handlePolizaFileChange =
    (field: 'polizaFile' | 'comprobanteFile') => (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      setPolizaForm((prev) => ({ ...prev, [field]: file }));
    };

  const handlePolizaSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setPolizaSubmitting(true);
      setFlash(null);

      const formSnapshot = {
        observaciones: polizaForm.observaciones,
        polizaArchivo: polizaForm.polizaFile?.name ?? null,
        comprobanteArchivo: polizaForm.comprobanteFile?.name ?? null,
        agenteId: polizaForm.agenteId,
      };

      const agenteNombre = resolveAgenteNombre(polizaForm.agenteId);

      const newRecord: PersonalRecord = {
        id: createSyntheticId(),
        nombre: 'Solicitud de póliza',
        cuil: null,
        telefono: null,
        email: null,
        cliente: null,
        unidad: null,
        unidadDetalle: null,
        sucursal: null,
        fechaAlta: new Date().toISOString().slice(0, 10),
        perfil: 'Solicitud de póliza',
        perfilValue: null,
        agente: agenteNombre,
        estado: 'Pendiente',
        combustible: null,
        combustibleValue: false,
        tarifaEspecial: null,
        tarifaEspecialValue: false,
        aprobado: false,
        aprobadoAt: null,
        aprobadoPor: null,
        esSolicitud: true,
        solicitudTipo: 'poliza',
        solicitudData: {
          form: formSnapshot,
        },
      };

      appendLocalSolicitud(newRecord);

      setFlash({
        type: 'success',
        message: 'Solicitud de póliza registrada (modo demostración).',
      });
      setPolizaForm({
        polizaFile: null,
        comprobanteFile: null,
        observaciones: '',
        agenteId: '',
      });
      setPolizaInputsVersion((value) => value + 1);
      handleGoToList();
    } catch (err) {
      setFlash({
        type: 'error',
        message: (err as Error).message ?? 'No se pudo registrar la solicitud de póliza.',
      });
    } finally {
      setPolizaSubmitting(false);
    }
  };

  const handleAdelantoFieldChange =
    (field: keyof AdelantoRequestForm) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setAdelantoForm((prev) => ({
        ...prev,
        [field]: value,
        ...(field === 'empresaId' ? { sucursalId: '' } : {}),
      }));
    };
  const handleAdelantoDestinatariosChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(event.target.selectedOptions).map((option) => option.value);
    setAdelantoForm((prev) => ({
      ...prev,
      destinatarioIds: values,
    }));
  };
  const handleAdelantoSelectAllDestinatarios = () => {
    const allIds = approverOptions.map((option) => option.id);
    setAdelantoForm((prev) => ({
      ...prev,
      destinatarioIds: allIds,
    }));
  };
  const handleAdelantoClearDestinatarios = () => {
    setAdelantoForm((prev) => ({
      ...prev,
      destinatarioIds: [],
    }));
  };

  const handleAdelantoFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAdelantoAttachments(filesFromEvent(event.target.files));
  };

  const handleAdelantoSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setAdelantoSubmitting(true);
      setFlash(null);

      const formSnapshot = {
        ...adelantoForm,
        solicitanteId: authUser?.id ?? null,
        transportista: adelantoForm.transportista || authUser?.name || '',
      };
      if (isSolicitudPersonalView && editingSolicitudId && !canEditAdelantoSolicitud) {
        throw new Error('Solo los destinatarios pueden editar esta solicitud.');
      }
      if (isSolicitudPersonalView && (!formSnapshot.destinatarioIds || formSnapshot.destinatarioIds.length === 0)) {
        throw new Error('Seleccioná a quién enviar la solicitud.');
      }
      if (!canEditAdelantoEstado) {
        const existing = getSolicitudById(editingSolicitudId);
        formSnapshot.estado = existing?.estado ?? 'Pendiente';
      }
      const attachmentNames = adelantoAttachments.map((file) => file.name);
      const clienteNombre =
        formSnapshot.empresaId && meta?.clientes
          ? meta.clientes.find((cliente) => cliente.id === Number(formSnapshot.empresaId))?.nombre ?? null
          : null;
      const sucursalNombre =
        formSnapshot.sucursalId && meta?.sucursales
          ? meta.sucursales.find((sucursal) => sucursal.id === Number(formSnapshot.sucursalId))?.nombre ?? null
          : null;
      const agenteNombre = isSolicitudPersonalView
        ? resolveApproverNames(formSnapshot.destinatarioIds)
        : resolveAgenteNombre(formSnapshot.agenteId);

      const newRecord: PersonalRecord = {
        id: createSyntheticId(),
        nombre: formSnapshot.transportista || null,
        cuil: null,
        telefono: null,
        email: null,
        cliente: clienteNombre,
        unidad: null,
        unidadDetalle: null,
        sucursal: sucursalNombre,
        fechaAlta: formSnapshot.fechaSolicitud || null,
        perfil: 'Adelanto de pago',
        perfilValue: null,
        agente: agenteNombre,
        estado: formSnapshot.estado || 'Pendiente',
        combustible: null,
        combustibleValue: false,
        tarifaEspecial: null,
        tarifaEspecialValue: false,
        aprobado: false,
        aprobadoAt: null,
        aprobadoPor: null,
        esSolicitud: true,
        solicitudTipo: 'adelanto',
        solicitudData: {
          form: formSnapshot,
          origin: isSolicitudPersonalView ? 'solicitud-personal' : 'aprobaciones',
          adjuntos: attachmentNames,
        },
      };

      if (isSolicitudPersonalView) {
        await persistSolicitudPersonal(
          {
            tipo: 'adelanto',
            estado: formSnapshot.estado,
            destinatarioIds: formSnapshot.destinatarioIds,
            form: formSnapshot,
          },
          editingSolicitudId
        );
        setFlash({
          type: 'success',
          message: editingSolicitudId ? 'Solicitud de adelanto actualizada.' : 'Solicitud de adelanto registrada.',
        });
      } else if (editingSolicitudId && editingSolicitudTipo === 'adelanto') {
        if (editingSolicitudId > 0) {
          throw new Error('No se puede actualizar una solicitud ya registrada en el servidor.');
        }
        updateLocalSolicitud(editingSolicitudId, (prev) => ({
          ...prev,
          ...newRecord,
          id: prev.id,
          createdAt: prev.createdAt ?? new Date().toISOString(),
        }));
        setFlash({
          type: 'success',
          message: 'Solicitud de adelanto actualizada.',
        });
      } else {
        appendLocalSolicitud(newRecord);
        setFlash({
          type: 'success',
          message: 'Solicitud de adelanto registrada (modo demostración).',
        });
      }

      setAdelantoForm({
        empresaId: '',
        sucursalId: '',
        transportista: '',
        monto: '',
        fechaSolicitud: '',
        motivo: '',
        observaciones: '',
        agenteId: '',
        destinatarioIds: [],
        estado: 'Pendiente',
      });
      setAdelantoAttachments([]);
      setAdelantoFilesVersion((value) => value + 1);
      setEditingSolicitudId(null);
      setEditingSolicitudTipo(null);
      handleGoToList();
    } catch (err) {
      setFlash({
        type: 'error',
        message: (err as Error).message ?? 'No se pudo registrar el adelanto de pago.',
      });
    } finally {
      setAdelantoSubmitting(false);
    }
  };

  const handlePrestamoFieldChange =
    (field: keyof PrestamoRequestForm) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setPrestamoForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    };
  const handlePrestamoDestinatariosChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(event.target.selectedOptions).map((option) => option.value);
    setPrestamoForm((prev) => ({
      ...prev,
      destinatarioIds: values,
    }));
  };
  const handlePrestamoSelectAllDestinatarios = () => {
    const allIds = approverOptions.map((option) => option.id);
    setPrestamoForm((prev) => ({
      ...prev,
      destinatarioIds: allIds,
    }));
  };
  const handlePrestamoClearDestinatarios = () => {
    setPrestamoForm((prev) => ({
      ...prev,
      destinatarioIds: [],
    }));
  };

  const persistSolicitudPersonal = async (
    payload: {
      tipo: 'prestamo' | 'adelanto' | 'vacaciones' | 'cambio_asignacion';
      estado?: string | null;
      destinatarioIds?: Array<string | number> | null;
      form?: Record<string, any>;
    },
    id?: number | null
  ) => {
    const method = id && id > 0 ? 'PUT' : 'POST';
    const url = id && id > 0 ? `${apiBaseUrl}/api/solicitud-personal/${id}` : `${apiBaseUrl}/api/solicitud-personal`;
    const requestInit: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...actorHeaders,
      },
      body: JSON.stringify({
        tipo: payload.tipo,
        estado: payload.estado ?? 'Pendiente',
        destinatarioIds: payload.destinatarioIds
          ? payload.destinatarioIds
              .map((value) => Number(value))
              .filter((value) => Number.isFinite(value))
          : [],
        form: payload.form ?? {},
      }),
    };
    let response = await fetch(url, requestInit);
    if (response.status === 405 && method === 'PUT') {
      response = await fetch(url, {
        ...requestInit,
        method: 'POST',
      });
    }
    if (!response.ok) {
      let message = `Error ${response.status}: ${response.statusText}`;
      try {
        const data = await response.json();
        if (typeof data?.message === 'string') {
          message = data.message;
        }
      } catch {
        // ignore
      }
      throw new Error(message);
    }
    const payloadResponse = (await response.json()) as { data: any; message?: string };
    if (!payloadResponse?.data) {
      throw new Error('Formato de respuesta inesperado');
    }
    const record = mapSolicitudPersonalToRecord(payloadResponse.data);
    setPersonalSolicitudes((prev) => {
      const exists = prev.some((item) => item.id === record.id);
      if (exists) {
        return prev.map((item) => (item.id === record.id ? record : item));
      }
      return [record, ...prev];
    });
    return payloadResponse;
  };

  const resetPrestamoForm = () => {
    setPrestamoForm({
      solicitanteNombre: authUser?.name ?? '',
      numeroOrden: '',
      montoSolicitado: '',
      cantidadCuotas: '',
      cuotasPagadas: '0',
      fechaNecesaria: '',
      destinatarioIds: [],
      observaciones: '',
      estado: 'Pendiente',
    });
    setEditingSolicitudId(null);
    setEditingSolicitudTipo(null);
  };

  const handlePrestamoSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setPrestamoSubmitting(true);
      setFlash(null);

      const formSnapshot = { ...prestamoForm, solicitanteId: authUser?.id ?? null };
      if (isSolicitudPersonalView && editingSolicitudId && !canEditPrestamoSolicitud) {
        throw new Error('Solo los destinatarios pueden editar esta solicitud.');
      }
      const numeroOrden = formSnapshot.numeroOrden?.trim() || String(resolveNextPrestamoOrden(editingSolicitudId));
      formSnapshot.numeroOrden = numeroOrden;
      if (!formSnapshot.cantidadCuotas.trim()) {
        throw new Error('Ingresá la cantidad de cuotas.');
      }
      const cuotasRaw = Number(formSnapshot.cantidadCuotas);
      if (Number.isNaN(cuotasRaw) || cuotasRaw < 1 || cuotasRaw > 12) {
        throw new Error('La cantidad de cuotas debe estar entre 1 y 12.');
      }
      if (!formSnapshot.destinatarioIds || formSnapshot.destinatarioIds.length === 0) {
        throw new Error('Seleccioná a quién enviar la solicitud.');
      }
      if (!canEditPrestamoEstado) {
        const existing = getSolicitudById(editingSolicitudId);
        formSnapshot.estado = existing?.estado ?? 'Pendiente';
      }
      const monto = parseMonto(formSnapshot.montoSolicitado) ?? 0;
      const cuotas = Math.min(Math.max(cuotasRaw, 1), 12);
      const cuotasPagadas = Math.min(Math.max(Number(formSnapshot.cuotasPagadas) || 0, 0), cuotas);
      const interes = monto * 0.04 * cuotas;
      const totalConInteres = monto + interes;
      const valorCuota = cuotas > 0 ? totalConInteres / cuotas : 0;
      const cuotasRestantes = Math.max(cuotas - cuotasPagadas, 0);
      const destinatarioNombre = resolveApproverNames(formSnapshot.destinatarioIds);

      const recordBase: PersonalRecord = {
        id: createSyntheticId(),
        nombre: formSnapshot.solicitanteNombre || null,
        cuil: null,
        telefono: null,
        email: null,
        cliente: null,
        unidad: null,
        unidadDetalle: null,
        sucursal: null,
        fechaAlta: formSnapshot.fechaNecesaria || null,
        perfil: 'Solicitud de préstamo',
        perfilValue: null,
        agente: destinatarioNombre,
        estado: formSnapshot.estado || 'Pendiente',
        combustible: null,
        combustibleValue: false,
        tarifaEspecial: null,
        tarifaEspecialValue: false,
        aprobado: false,
        aprobadoAt: null,
        aprobadoPor: null,
        esSolicitud: true,
        solicitudTipo: 'prestamo',
        solicitudData: {
          form: {
            ...formSnapshot,
            numeroOrden,
            cantidadCuotas: String(cuotas),
            cuotasPagadas: String(cuotasPagadas),
          },
          origin: isSolicitudPersonalView ? 'solicitud-personal' : 'aprobaciones',
          resumen: {
            monto,
            cuotas,
            interes,
            totalConInteres,
            valorCuota,
            cuotasRestantes,
          },
        },
      };

      if (isSolicitudPersonalView) {
        await persistSolicitudPersonal(
          {
            tipo: 'prestamo',
            estado: formSnapshot.estado,
            destinatarioIds: formSnapshot.destinatarioIds,
            form: {
              ...formSnapshot,
              numeroOrden,
              cantidadCuotas: String(cuotas),
              cuotasPagadas: String(cuotasPagadas),
            },
          },
          editingSolicitudId
        );
        setFlash({
          type: 'success',
          message: editingSolicitudId ? 'Solicitud de préstamo actualizada.' : 'Solicitud de préstamo registrada.',
        });
      } else if (editingSolicitudId && editingSolicitudTipo === 'prestamo') {
        if (editingSolicitudId > 0) {
          throw new Error('No se puede actualizar una solicitud ya registrada en el servidor.');
        }
        updateLocalSolicitud(editingSolicitudId, (prev) => ({
          ...prev,
          ...recordBase,
          id: prev.id,
          createdAt: prev.createdAt ?? new Date().toISOString(),
        }));
        setFlash({ type: 'success', message: 'Solicitud de préstamo actualizada.' });
      } else {
        appendLocalSolicitud(recordBase);
        setFlash({ type: 'success', message: 'Solicitud de préstamo registrada.' });
      }

      resetPrestamoForm();
      handleGoToList();
    } catch (err) {
      setFlash({
        type: 'error',
        message: (err as Error).message ?? 'No se pudo registrar el préstamo.',
      });
    } finally {
      setPrestamoSubmitting(false);
    }
  };

  const handleVacacionesFieldChange =
    (field: keyof VacacionesRequestForm) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setVacacionesForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    };
  const handleVacacionesDestinatariosChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(event.target.selectedOptions).map((option) => option.value);
    setVacacionesForm((prev) => ({
      ...prev,
      destinatarioIds: values,
    }));
  };
  const handleVacacionesSelectAllDestinatarios = () => {
    const allIds = approverOptions.map((option) => option.id);
    setVacacionesForm((prev) => ({
      ...prev,
      destinatarioIds: allIds,
    }));
  };
  const handleVacacionesClearDestinatarios = () => {
    setVacacionesForm((prev) => ({
      ...prev,
      destinatarioIds: [],
    }));
  };

  const handleVacacionesEmpleadoChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    const nombre = resolveAgenteNombre(value);
    setVacacionesForm((prev) => ({
      ...prev,
      empleadoId: value,
      empleadoNombre: nombre ?? prev.empleadoNombre,
    }));
  };

  const resetVacacionesForm = () => {
    setVacacionesForm({
      empleadoId: '',
      empleadoNombre: authUser?.name ?? '',
      fechaDesde: '',
      fechaHasta: '',
      diasHabiles: '',
      motivo: '',
      estado: 'Pendiente',
      destinatarioIds: [],
    });
    setEditingSolicitudId(null);
    setEditingSolicitudTipo(null);
  };

  const updateVacacionesDias = useCallback(
    async (userId: string, dias: number) => {
      const response = await fetch(`${apiBaseUrl}/api/vacaciones-dias`, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...actorHeaders,
        },
        body: JSON.stringify({ userId: Number(userId), dias }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Error ${response.status}: ${response.statusText}`);
      }

      const payload = (await response.json()) as { data?: { dias?: number } };
      const finalDias = Number(payload?.data?.dias);
      return Number.isFinite(finalDias) ? finalDias : dias;
    },
    [apiBaseUrl, actorHeaders]
  );

  const handleVacacionesConfigSave = async () => {
    const empleadoId = vacacionesConfigForm.empleadoId.trim();
    if (!empleadoId) {
      setFlash({ type: 'error', message: 'Seleccioná un usuario para cargar los días.' });
      return;
    }
    const dias = Number(vacacionesConfigForm.dias);
    if (!Number.isFinite(dias) || dias < 0) {
      setFlash({ type: 'error', message: 'Ingresá un número de días válido.' });
      return;
    }
    try {
      const stored = await updateVacacionesDias(empleadoId, Math.floor(dias));
      setVacacionesDiasDisponibles((prev) => ({
        ...prev,
        [empleadoId]: stored,
      }));
      setFlash({ type: 'success', message: 'Días hábiles actualizados.' });
      setVacacionesConfigForm((prev) => ({ ...prev, dias: '' }));
    } catch (err) {
      setFlash({
        type: 'error',
        message: (err as Error).message ?? 'No se pudieron actualizar los días hábiles.',
      });
    }
  };

  const handleVacacionesSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setVacacionesSubmitting(true);
      setFlash(null);

      const formSnapshot = { ...vacacionesForm, solicitanteId: authUser?.id ?? null };
      if (isSolicitudPersonalView && editingSolicitudId && !canEditVacacionesSolicitud) {
        throw new Error('Solo los destinatarios pueden editar esta solicitud.');
      }
      const diasSolicitados = Math.max(Number(formSnapshot.diasHabiles) || 0, 0);
      const empleadoNombre =
        formSnapshot.empleadoNombre || resolveAgenteNombre(formSnapshot.empleadoId) || 'Empleado';
      if (!empleadoNombre.trim()) {
        throw new Error('Ingresá el nombre del empleado.');
      }
      const prevRecord = getSolicitudById(editingSolicitudId);
      const prevEstado = prevRecord?.estado ?? null;
      if (isSolicitudPersonalView && (!formSnapshot.destinatarioIds || formSnapshot.destinatarioIds.length === 0)) {
        throw new Error('Seleccioná a quién enviar la solicitud.');
      }
      if (!canEditVacacionesEstado) {
        const existing = getSolicitudById(editingSolicitudId);
        formSnapshot.estado = existing?.estado ?? 'Pendiente';
      }

      const recordBase: PersonalRecord = {
        id: createSyntheticId(),
        nombre: empleadoNombre || null,
        cuil: null,
        telefono: null,
        email: null,
        cliente: null,
        unidad: null,
        unidadDetalle: null,
        sucursal: null,
        fechaAlta: formSnapshot.fechaDesde || null,
        perfil: 'Solicitud de vacaciones',
        perfilValue: null,
        agente: null,
        estado: formSnapshot.estado || 'Pendiente',
        combustible: null,
        combustibleValue: false,
        tarifaEspecial: null,
        tarifaEspecialValue: false,
        aprobado: false,
        aprobadoAt: null,
        aprobadoPor: null,
        esSolicitud: true,
        solicitudTipo: 'vacaciones',
        solicitudData: {
          form: formSnapshot,
          origin: isSolicitudPersonalView ? 'solicitud-personal' : 'aprobaciones',
          resumen: {
            diasSolicitados,
            diasDisponibles:
              formSnapshot.empleadoId && vacacionesDiasDisponibles[formSnapshot.empleadoId] != null
                ? vacacionesDiasDisponibles[formSnapshot.empleadoId]
                : null,
          },
        },
      };

      if (isSolicitudPersonalView) {
        await persistSolicitudPersonal(
          {
            tipo: 'vacaciones',
            estado: formSnapshot.estado,
            destinatarioIds: formSnapshot.destinatarioIds ?? [],
            form: formSnapshot,
          },
          editingSolicitudId
        );
        if (formSnapshot.estado === 'Aprobado' && prevEstado !== 'Aprobado' && formSnapshot.empleadoId) {
          const current = vacacionesDiasDisponibles[formSnapshot.empleadoId];
          if (Number.isFinite(current)) {
            const nextValue = Math.max(current - diasSolicitados, 0);
            const stored = await updateVacacionesDias(formSnapshot.empleadoId, nextValue);
            setVacacionesDiasDisponibles((prev) => ({ ...prev, [formSnapshot.empleadoId]: stored }));
          }
        }
        setFlash({
          type: 'success',
          message: editingSolicitudId ? 'Solicitud de vacaciones actualizada.' : 'Solicitud de vacaciones registrada.',
        });
      } else if (editingSolicitudId && editingSolicitudTipo === 'vacaciones') {
        if (editingSolicitudId > 0) {
          throw new Error('No se puede actualizar una solicitud ya registrada en el servidor.');
        }
        updateLocalSolicitud(editingSolicitudId, (prev) => ({
          ...prev,
          ...recordBase,
          id: prev.id,
          createdAt: prev.createdAt ?? new Date().toISOString(),
        }));
        setFlash({ type: 'success', message: 'Solicitud de vacaciones actualizada.' });
      } else {
        appendLocalSolicitud(recordBase);
        setFlash({ type: 'success', message: 'Solicitud de vacaciones registrada.' });
      }

      resetVacacionesForm();
      handleGoToList();
    } catch (err) {
      setFlash({
        type: 'error',
        message: (err as Error).message ?? 'No se pudo registrar la solicitud de vacaciones.',
      });
    } finally {
      setVacacionesSubmitting(false);
    }
  };

  const renderAltaInput = (
    label: string,
    field: AltaEditableField,
    required = false,
    type: 'text' | 'email' | 'number' | 'date' | 'tel' = 'text',
    placeholder?: string
  ) => {
    const finalPlaceholder = placeholder ?? (type === 'date' ? 'dd/mm/aaaa' : 'Ingresar');
    return (
      <label className="input-control">
        <span>{label}</span>
        <input
          type={type}
          value={altaForm[field]}
          onChange={handleAltaFieldChange(field)}
          placeholder={finalPlaceholder}
          required={required}
        />
      </label>
    );
  };

  const renderAltaCuilInput = (
    label: string,
    field: 'cuil' | 'cobradorCuil',
    target: 'titular' | 'cobrador',
    required = false,
    disabled = false
  ) => {
    const isTitular = target === 'titular';
    const loading = isTitular ? altaNosisTitularLoading : altaNosisCobradorLoading;
    const error = isTitular ? altaNosisTitularError : altaNosisCobradorError;
    const info = isTitular ? altaNosisTitularInfo : altaNosisCobradorInfo;

    return (
      <label className="input-control">
        <span>{label}</span>
        <input
          type="text"
          value={altaForm[field]}
          onChange={(event) => {
            const nextValue = event.target.value.replace(/\D+/g, '').slice(0, 11);
            setAltaFormDirty(true);
            setAltaForm((prev) => ({ ...prev, [field]: nextValue }));
            if (isTitular) {
              setAltaNosisTitularError(null);
              setAltaNosisTitularInfo(null);
              altaNosisTitularLastLookupRef.current = null;
            } else {
              setAltaNosisCobradorError(null);
              setAltaNosisCobradorInfo(null);
              altaNosisCobradorLastLookupRef.current = null;
            }
          }}
          placeholder="Ingresar"
          required={required}
          inputMode="numeric"
          maxLength={11}
          disabled={disabled}
        />
        <button
          type="button"
          className="secondary-action"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => {
            void lookupAltaNosisByDocumento(target, true);
          }}
          disabled={disabled || loading}
        >
          {loading ? 'Consultando...' : 'Autocompletar'}
        </button>
        {error ? <span className="form-info form-info--error">{error}</span> : null}
        {!error && info ? <span className="form-info form-info--success">{info}</span> : null}
      </label>
    );
  };

  const renderAltaCheckbox = (label: string, field: 'tarifaEspecial' | 'combustible', text: string) => (
    <label className="input-control">
      <span>{label}</span>
      <div className="checkbox-control">
        <input type="checkbox" checked={altaForm[field]} onChange={handleAltaCheckboxChange(field)} />
        {text}
      </div>
    </label>
  );

  const renderAltaSelect = (
    label: string,
    field: AltaEditableField,
    options: AltaSelectOption[],
    { placeholder = 'Seleccionar', disabled = false }: { placeholder?: string; disabled?: boolean } = {}
  ) => (
    <label className="input-control">
      <span>{label}</span>
      <select value={altaForm[field]} onChange={handleAltaFieldChange(field)} disabled={disabled}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  const renderAltaDisabledInput = (label: string, type: 'text' | 'email' | 'date' | 'number' = 'text') => (
    <label className="input-control">
      <span>{label}</span>
      <input type={type} disabled placeholder="—" />
    </label>
  );

  const renderAttachmentList = (files: File[]) =>
    files.length > 0 ? (
      <ul className="file-list">
        {files.map((file) => (
          <li key={file.name}>{file.name}</li>
        ))}
      </ul>
    ) : null;

  const renderAltaAttachmentList = () => {
    if (altaAttachments.length === 0) {
      return null;
    }

    return (
      <ul className="file-list">
        {altaAttachments.map((item) => {
          const parts: string[] = [];
          const typeLabel = item.typeName.trim().length > 0 ? item.typeName : `Documento #${item.typeId}`;
          parts.push(typeLabel);

          if (item.positionLabel) {
            parts.push(item.positionLabel);
          }

          let description = parts.length > 0 ? `${parts.join(' – ')} · ${item.file.name}` : item.file.name;

          if (item.vence) {
            description = `${description} · Vence: ${item.vence}`;
          }

          return <li key={item.id}>{description}</li>;
        })}
      </ul>
    );
  };

  const combinedSolicitudes = useMemo(
    () => (isSolicitudPersonalView ? personalSolicitudes : [...localSolicitudes, ...backendSolicitudes]),
    [isSolicitudPersonalView, localSolicitudes, backendSolicitudes, personalSolicitudes]
  );

  const resolveSolicitudTipoMeta = useCallback((registro: PersonalRecord): { key: string; label: string } => {
    if (!registro.esSolicitud) {
      return { key: 'registro_personal', label: 'Registro de personal' };
    }

    switch (registro.solicitudTipo) {
      case 'alta':
        return { key: 'alta', label: 'Solicitud de alta' };
      case 'combustible':
        return { key: 'combustible', label: 'Solicitud de combustible' };
      case 'aumento_combustible':
        return { key: 'aumento_combustible', label: 'Aumento de combustible' };
      case 'adelanto':
        return { key: 'adelanto', label: 'Adelanto de pago' };
      case 'poliza':
        return { key: 'poliza', label: 'Solicitud de póliza' };
      case 'prestamo':
        return { key: 'prestamo', label: 'Solicitud de préstamo' };
      case 'vacaciones':
        return { key: 'vacaciones', label: 'Solicitud de vacaciones' };
      case 'cambio_asignacion':
        return { key: 'cambio_asignacion', label: 'Cambio de asignación' };
      default:
        return { key: 'solicitud_registrada', label: 'Solicitud registrada' };
    }
  }, []);

  const solicitudesTipoOptions = useMemo(() => {
    const labels = new Map<string, string>();
    combinedSolicitudes.forEach((registro) => {
      const meta = resolveSolicitudTipoMeta(registro);
      labels.set(meta.key, meta.label);
    });
    return Array.from(labels.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es-AR'));
  }, [combinedSolicitudes, resolveSolicitudTipoMeta]);

  const solicitudesPerfilOptions = useMemo(() => {
    const labels = new Set<string>();
    combinedSolicitudes.forEach((registro) => {
      const label = perfilNames[registro.perfilValue ?? 0] ?? registro.perfil ?? '';
      if (label) {
        labels.add(label);
      }
    });
    return Array.from(labels).sort((a, b) => a.localeCompare(b));
  }, [combinedSolicitudes, perfilNames]);

  const solicitudesAgenteOptions = useMemo(() => {
    const labels = new Set<string>();
    combinedSolicitudes.forEach((registro) => {
      if (registro.agente) {
        labels.add(registro.agente);
      }
    });
    return Array.from(labels).sort((a, b) => a.localeCompare(b));
  }, [combinedSolicitudes]);

  const solicitudesEstadoOptions = useMemo(() => {
    const labels = new Set<string>();
    combinedSolicitudes.forEach((registro) => {
      if (registro.estado) {
        labels.add(registro.estado);
      }
    });
    return Array.from(labels).sort((a, b) => a.localeCompare(b));
  }, [combinedSolicitudes]);

  const solicitudesClienteOptions = useMemo(() => {
    const labels = new Set<string>();
    combinedSolicitudes.forEach((registro) => {
      if (registro.cliente) {
        labels.add(registro.cliente);
      }
    });
    return Array.from(labels).sort((a, b) => a.localeCompare(b));
  }, [combinedSolicitudes]);

  const solicitudesSucursalOptions = useMemo(() => {
    const labels = new Set<string>();
    combinedSolicitudes.forEach((registro) => {
      if (registro.sucursal) {
        labels.add(registro.sucursal);
      }
    });
    return Array.from(labels).sort((a, b) => a.localeCompare(b));
  }, [combinedSolicitudes]);

  const resolveSolicitudCreated = useCallback((registro: PersonalRecord): string | null => {
    const data = registro.solicitudData as any;
    const candidates: Array<string | null | undefined> = [
      registro.createdAt,
      (registro as any).created_at,
      (registro as any).created,
      (registro as any).fechaCreacion,
      (registro as any).fecha_creacion,
      data?.createdAt,
      data?.created_at,
      data?.created,
      data?.fechaCreacion,
      data?.fecha_creacion,
      data?.form?.createdAt,
      data?.form?.created_at,
      data?.form?.fechaSolicitud,
      data?.form?.fecha,
    ];
    const found = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    if (found) {
      return String(found);
    }
    const numericId = Number(registro.id);
    if (Number.isFinite(numericId)) {
      const cached = solicitudCreatedCache.get(numericId);
      if (cached) {
        return cached;
      }
    }
    return null;
  }, [solicitudCreatedCache]);

  const filteredSolicitudes = useMemo(() => {
    const term = solicitudesSearchTerm.trim().toLowerCase();
    const parseDateOnlyUtc = (value: string | null | undefined): number | null => {
      if (!value) {
        return null;
      }
      const normalized = value.trim();
      if (!normalized) {
        return null;
      }
      const parsed = new Date(normalized);
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }
      return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
    };
    const msInDay = 24 * 60 * 60 * 1000;
    const today = new Date();
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfWeekUtc = todayUtc - ((today.getUTCDay() + 6) % 7) * msInDay;
    const startOfMonthUtc = Date.UTC(today.getFullYear(), today.getMonth(), 1);

    const matchesCreationDate = (registro: PersonalRecord): boolean => {
      const rawCreated = resolveSolicitudCreated(registro);
      const target = parseDateOnlyUtc(rawCreated);

      const presetOk = (() => {
        if (!solicitudesFechaPreset) {
          return true;
        }
        if (target === null) {
          return false;
        }
        switch (solicitudesFechaPreset) {
          case 'today':
            return target === todayUtc;
          case 'week':
            return target >= startOfWeekUtc && target <= todayUtc;
          case 'month':
            return target >= startOfMonthUtc && target <= todayUtc;
          default:
            return true;
        }
      })();

      const rangeOk = (() => {
        const fromUtc = parseDateOnlyUtc(solicitudesFechaFrom);
        const toUtc = parseDateOnlyUtc(solicitudesFechaTo);
        if (fromUtc === null && toUtc === null) {
          return true;
        }
        if (target === null) {
          return false;
        }
        if (fromUtc !== null && target < fromUtc) {
          return false;
        }
        if (toUtc !== null && target > toUtc) {
          return false;
        }
        return true;
      })();

      return presetOk && rangeOk;
    };

    return combinedSolicitudes.filter((registro) => {
      const data = registro.solicitudData as any;
      const origin = data?.origin ?? null;
      const solicitudTipoMeta = resolveSolicitudTipoMeta(registro);
      if (!isSolicitudPersonalView) {
        if (origin === 'solicitud-personal') {
          return false;
        }
        if (registro.solicitudTipo === 'prestamo' || registro.solicitudTipo === 'vacaciones') {
          return false;
        }
      }
      if (isSolicitudPersonalView) {
        if (origin !== 'solicitud-personal') {
          return false;
        }
        const form = data?.form ?? {};
        const solicitanteId = form?.solicitanteId ?? form?.requesterId ?? null;
        const empleadoId = form?.empleadoId ?? null;
        const destinatarioIds = Array.isArray(form?.destinatarioIds)
          ? form.destinatarioIds
          : form?.destinatarioId
          ? [form.destinatarioId]
          : [];
        const authId = authUser?.id ?? null;
        const isRequester =
          authId != null &&
          (String(solicitanteId) === String(authId) || String(empleadoId) === String(authId));
        const isDestinatario = authId != null && destinatarioIds.some((id: string | number) => String(id) === String(authId));
        if (!isRequester && !isDestinatario) {
          return false;
        }
      }
      const perfilLabel = perfilNames[registro.perfilValue ?? 0] ?? registro.perfil ?? '';

      if (solicitudesTipoFilter && solicitudTipoMeta.key !== solicitudesTipoFilter) {
        return false;
      }

      if (solicitudesPerfilFilter && perfilLabel !== solicitudesPerfilFilter) {
        return false;
      }

      if (solicitudesAgenteFilter && registro.agente !== solicitudesAgenteFilter) {
        return false;
      }

      if (solicitudesEstadoFilter && registro.estado !== solicitudesEstadoFilter) {
        return false;
      }

      if (solicitudesClienteFilter && registro.cliente !== solicitudesClienteFilter) {
        return false;
      }

      if (solicitudesSucursalFilter && registro.sucursal !== solicitudesSucursalFilter) {
        return false;
      }

      if (!matchesCreationDate(registro)) {
        return false;
      }

      if (term.length === 0) {
        return true;
      }

      const fields = [
        registro.nombre,
        registro.cuil,
        registro.telefono,
        registro.email,
        registro.cliente,
        registro.sucursal,
        registro.unidadDetalle,
        registro.unidad,
        solicitudTipoMeta.label,
        perfilLabel,
        registro.agente,
        registro.estado,
      ];

      return fields.some((field) => field?.toLowerCase().includes(term));
    });
  }, [
    combinedSolicitudes,
    solicitudesSearchTerm,
    solicitudesTipoFilter,
    solicitudesPerfilFilter,
    solicitudesAgenteFilter,
    solicitudesEstadoFilter,
    solicitudesClienteFilter,
    solicitudesSucursalFilter,
    solicitudesFechaPreset,
    solicitudesFechaFrom,
    solicitudesFechaTo,
    perfilNames,
    resolveSolicitudTipoMeta,
    resolveSolicitudCreated,
    authUser?.id,
    isSolicitudPersonalView,
  ]);

  const solicitudesFooterLabel = useMemo(() => {
    if (solicitudesLoading) {
      return 'Cargando solicitudes...';
    }

    if (solicitudesError) {
      return 'No se pudieron cargar las solicitudes';
    }

    if (filteredSolicitudes.length === 0) {
      return 'No hay solicitudes pendientes.';
    }

    if (filteredSolicitudes.length === combinedSolicitudes.length) {
      return `Mostrando ${combinedSolicitudes.length} solicitud${combinedSolicitudes.length === 1 ? '' : 'es'}`;
    }

    return `Mostrando ${filteredSolicitudes.length} de ${combinedSolicitudes.length} solicitudes`;
  }, [filteredSolicitudes.length, combinedSolicitudes.length, solicitudesLoading, solicitudesError]);

  const handleSolicitudesReset = () => {
    setSolicitudesSearchTerm('');
    setSolicitudesTipoFilter('');
    setSolicitudesPerfilFilter('');
    setSolicitudesAgenteFilter('');
    setSolicitudesEstadoFilter('');
    setSolicitudesClienteFilter('');
    setSolicitudesSucursalFilter('');
    setSolicitudesFechaPreset('');
    setSolicitudesFechaFrom('');
    setSolicitudesFechaTo('');
  };

  const applyInlineSolicitudEstadoUpdate = (solicitudId: number, estado: string) => {
    const apply = (item: PersonalRecord): PersonalRecord => {
      if (item.id !== solicitudId) {
        return item;
      }
      const data = (item.solicitudData as any) ?? {};
      const form = typeof data?.form === 'object' && data.form !== null ? data.form : {};
      return normalizeSolicitudRecord({
        ...item,
        estado,
        solicitudData: {
          ...data,
          form: {
            ...form,
            estado,
          },
        },
      } as PersonalRecord);
    };

    setPersonalSolicitudes((prev) => prev.map(apply));
    setBackendSolicitudes((prev) => prev.map(apply));
    updateLocalSolicitud(solicitudId, (prev) => apply(prev));
  };

  const resolveSolicitudDestinatarioIds = (registro: PersonalRecord): string[] => {
    const data = registro.solicitudData as any;
    if (Array.isArray(data?.form?.destinatarioIds)) {
      return data.form.destinatarioIds.map((value: string | number) => String(value));
    }
    if (data?.form?.destinatarioId != null) {
      return [String(data.form.destinatarioId)];
    }
    return [];
  };

  const handleInlineSolicitudEstadoChange = async (registro: PersonalRecord, nextEstado: string) => {
    if (!isSolicitudPersonalView) {
      return;
    }

    const solicitudId = registro.id;
    const currentEstado = (registro.estado ?? 'Pendiente').trim();
    const normalizedNext = (nextEstado ?? '').trim();
    if (!normalizedNext || normalizedNext === currentEstado) {
      return;
    }

    if (updatingSolicitudEstadoIds.has(solicitudId)) {
      return;
    }

    const destinatarioIds = resolveSolicitudDestinatarioIds(registro);
    if (!isUserDestinatario(destinatarioIds) || registro.solicitudTipo === 'cambio_asignacion') {
      setFlash({ type: 'error', message: 'No tenés permisos para cambiar el estado de esta solicitud.' });
      return;
    }

    setUpdatingSolicitudEstadoIds((prev) => {
      const next = new Set(prev);
      next.add(solicitudId);
      return next;
    });

    setFlash(null);
    applyInlineSolicitudEstadoUpdate(solicitudId, normalizedNext);

    try {
      const endpoint = `${apiBaseUrl}/api/solicitud-personal/${solicitudId}`;
      const requestInit: RequestInit = {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...actorHeaders,
        },
        body: JSON.stringify({ estado: normalizedNext }),
      };

      let response = await fetch(endpoint, requestInit);
      if (response.status === 405) {
        response = await fetch(endpoint, { ...requestInit, method: 'POST' });
      }

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        const payload = (await parseJsonSafe(response).catch(() => null)) as { message?: string } | null;
        if (typeof payload?.message === 'string') {
          message = payload.message;
        }
        throw new Error(message);
      }

      const payload = (await parseJsonSafe(response)) as {
        message?: string;
        data?: Parameters<typeof mapSolicitudPersonalToRecord>[0];
      };

      const origin = ((registro.solicitudData as any)?.origin ?? 'solicitud-personal') as
        | 'solicitud-personal'
        | 'aprobaciones-solicitud-personal';

      if (payload?.data) {
        const updated = normalizeSolicitudRecord(mapSolicitudPersonalToRecord(payload.data, origin));
        setPersonalSolicitudes((prev) => prev.map((item) => (item.id === solicitudId ? updated : item)));
      }
    } catch (err) {
      applyInlineSolicitudEstadoUpdate(solicitudId, currentEstado);
      setFlash({ type: 'error', message: (err as Error).message ?? 'No se pudo actualizar el estado.' });
    } finally {
      setUpdatingSolicitudEstadoIds((prev) => {
        const next = new Set(prev);
        next.delete(solicitudId);
        return next;
      });
    }
  };

  const isSolicitudPendiente = useCallback((estado?: string | null) => {
    return (estado ?? '').trim().toLowerCase() === 'pendiente';
  }, []);

  const rejectableSolicitudes = useMemo(() => {
    if (!isSolicitudPersonalView) {
      return [] as PersonalRecord[];
    }

    return filteredSolicitudes.filter((registro) => {
      if (!isSolicitudPendiente(registro.estado)) {
        return false;
      }

      const data = registro.solicitudData as any;
      const destinatarioIds = Array.isArray(data?.form?.destinatarioIds)
        ? data.form.destinatarioIds.map((value: string | number) => String(value))
        : data?.form?.destinatarioId != null
        ? [String(data.form.destinatarioId)]
        : [];

      return isUserDestinatario(destinatarioIds);
    });
  }, [filteredSolicitudes, isSolicitudPersonalView, isSolicitudPendiente, isUserDestinatario]);

  const handleRejectAllSolicitudes = async () => {
    if (bulkRejectingSolicitudes) {
      return;
    }

    if (!isSolicitudPersonalView) {
      return;
    }

    if (rejectableSolicitudes.length === 0) {
      setFlash({
        type: 'error',
        message: 'No hay solicitudes pendientes visibles para rechazar.',
      });
      return;
    }

    const confirmed = window.confirm(
      `¿Rechazar ${rejectableSolicitudes.length} solicitud${rejectableSolicitudes.length === 1 ? '' : 'es'} pendiente${rejectableSolicitudes.length === 1 ? '' : 's'} visibles?`
    );
    if (!confirmed) {
      return;
    }

    try {
      setBulkRejectingSolicitudes(true);
      setFlash(null);

      const results = await Promise.all(
        rejectableSolicitudes.map(async (registro) => {
          const endpoint = `${apiBaseUrl}/api/solicitud-personal/${registro.id}`;
          const requestInit: RequestInit = {
            method: 'PUT',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              ...actorHeaders,
            },
            body: JSON.stringify({ estado: 'Rechazado' }),
          };

          let response = await fetch(endpoint, requestInit);
          if (response.status === 405) {
            response = await fetch(endpoint, { ...requestInit, method: 'POST' });
          }

          if (!response.ok) {
            const payload = (await parseJsonSafe(response).catch(() => null)) as { message?: string } | null;
            return {
              id: registro.id,
              ok: false,
              message: payload?.message ?? `Error ${response.status}`,
            };
          }

          return { id: registro.id, ok: true, message: null as string | null };
        })
      );

      const successIds = results.filter((item) => item.ok).map((item) => item.id);
      const failed = results.filter((item) => !item.ok);

      if (successIds.length > 0) {
        const successSet = new Set(successIds);
        setPersonalSolicitudes((prev) =>
          prev.map((item) => {
            if (!successSet.has(item.id)) {
              return item;
            }
            const data = item.solicitudData as any;
            return normalizeSolicitudRecord({
              ...item,
              estado: 'Rechazado',
              solicitudData: {
                ...data,
                form: {
                  ...(data?.form ?? {}),
                  estado: 'Rechazado',
                },
              },
            });
          })
        );
      }

      if (failed.length === 0) {
        setFlash({
          type: 'success',
          message: `Se rechazaron ${successIds.length} solicitud${successIds.length === 1 ? '' : 'es'} correctamente.`,
        });
      } else {
        const firstError = failed[0]?.message ?? 'Error desconocido';
        setFlash({
          type: successIds.length > 0 ? 'success' : 'error',
          message:
            successIds.length > 0
              ? `Se rechazaron ${successIds.length}. No se pudieron rechazar ${failed.length}. Detalle: ${firstError}`
              : `No se pudieron rechazar las solicitudes. Detalle: ${firstError}`,
        });
      }

      fetchSolicitudes();
    } catch (err) {
      setFlash({
        type: 'error',
        message: (err as Error).message ?? 'No se pudo rechazar en lote.',
      });
    } finally {
      setBulkRejectingSolicitudes(false);
    }
  };

  const handleDeleteSolicitud = async (registro: PersonalRecord) => {
    if (deletingSolicitudId !== null) {
      return;
    }

    const nameLabel = registro.nombre ? `"${registro.nombre}"` : `#${registro.id}`;
    const confirmed = window.confirm(`¿Eliminar la solicitud ${nameLabel}?`);
    if (!confirmed) {
      return;
    }

    if (registro.id < 0) {
      setDeletingSolicitudId(registro.id);
      setLocalSolicitudes((prev) => prev.filter((item) => item.id !== registro.id));
      setRejectedIds((prev) => {
        const next = new Set(prev);
        next.delete(registro.id);
        return next;
      });
      setDeletingSolicitudId(null);
      setFlash({ type: 'success', message: 'Solicitud eliminada correctamente.' });
      return;
    }

    try {
      setDeletingSolicitudId(registro.id);
      const solicitudData = registro.solicitudData as { origin?: string } | null | undefined;
      const isSolicitudPersonalBacked =
        isSolicitudPersonalView || solicitudData?.origin === 'aprobaciones-solicitud-personal';

      const deleteUrl = isSolicitudPersonalBacked
        ? `${apiBaseUrl}/api/solicitud-personal/${registro.id}`
        : `${apiBaseUrl}/api/personal/${registro.id}`;

      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { Accept: 'application/json', ...actorHeaders },
      });

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

      if (isSolicitudPersonalBacked) {
        setPersonalSolicitudes((prev) => prev.filter((item) => item.id !== registro.id));
      }
      setBackendSolicitudes((prev) => prev.filter((item) => item.id !== registro.id));
      setRejectedIds((prev) => {
        const next = new Set(prev);
        next.delete(registro.id);
        return next;
      });
      setFlash({ type: 'success', message: 'Solicitud eliminada correctamente.' });
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo eliminar la solicitud.');
    } finally {
      setDeletingSolicitudId(null);
    }
  };

  const handleGoToList = () => {
    setActiveTab('list');
    setSelectedCambioAsignacion(null);
    setReviewPersonaDetail(null);
    setReviewError(null);
    setApprovalEstadoId('');
    setReviewCommentText('');
    setReviewCommentError(null);
    setReviewCommentInfo(null);
    setReviewLoading(false);
    setReviewEditMode(false);
    setEditingSolicitudId(null);
    setEditingSolicitudTipo(null);
    if (personaIdFromQuery) {
      navigate(isSolicitudPersonalView ? '/solicitud-personal' : '/aprobaciones', { replace: true });
    }
  };

  const handleOpenSolicitud = (registro: PersonalRecord) => {
    setReviewPersonaDetail(null);
    setReviewError(null);
    setApprovalEstadoId('');
    setReviewCommentText('');
    setReviewCommentError(null);
    setReviewCommentInfo(null);
    setSelectedCambioAsignacion(null);

    switch (registro.solicitudTipo) {
      case 'cambio_asignacion': {
        setSelectedCambioAsignacion(registro);
        setActiveTab('cambio_asignacion');
        return;
      }
      case 'combustible': {
        setActiveTab('combustible');
        const data = (registro.solicitudData as { form?: CombustibleRequestForm }) ?? {};
        if (data.form) {
          setCombustibleForm(data.form);
        }
        setCombustibleAttachments([]);
        setCombustibleFilesVersion((value) => value + 1);
        return;
      }
      case 'aumento_combustible': {
        setActiveTab('aumento_combustible');
        const data = (registro.solicitudData as { form?: AumentoCombustibleForm }) ?? {};
        if (data.form) {
          setAumentoCombustibleForm(data.form);
        }
        setAumentoAttachments([]);
        setAumentoFilesVersion((value) => value + 1);
        return;
      }
      case 'adelanto': {
        setActiveTab('adelanto');
        const data = (registro.solicitudData as { form?: AdelantoRequestForm }) ?? {};
        setEditingSolicitudId(registro.id);
        setEditingSolicitudTipo('adelanto');
        if (data.form) {
          setAdelantoForm({
            empresaId: data.form.empresaId ?? '',
            sucursalId: data.form.sucursalId ?? '',
            transportista: data.form.transportista ?? '',
            monto: data.form.monto ?? '',
            fechaSolicitud: data.form.fechaSolicitud ?? '',
            motivo: data.form.motivo ?? '',
            observaciones: data.form.observaciones ?? '',
            agenteId: data.form.agenteId ?? '',
            destinatarioIds: Array.isArray(data.form.destinatarioIds)
              ? data.form.destinatarioIds
              : (data.form as any)?.destinatarioId
              ? [String((data.form as any)?.destinatarioId)]
              : [],
            estado: data.form.estado ?? registro.estado ?? 'Pendiente',
          });
        } else {
          setAdelantoForm({
            empresaId: '',
            sucursalId: '',
            transportista: '',
            monto: '',
            fechaSolicitud: '',
            motivo: '',
            observaciones: '',
            agenteId: '',
            destinatarioIds: [],
            estado: registro.estado ?? 'Pendiente',
          });
        }
        setAdelantoAttachments([]);
        setAdelantoFilesVersion((value) => value + 1);
        return;
      }
      case 'prestamo': {
        setActiveTab('prestamo');
        setEditingSolicitudId(registro.id);
        setEditingSolicitudTipo('prestamo');
        const data = (registro.solicitudData as { form?: PrestamoRequestForm }) ?? {};
        setPrestamoForm({
          solicitanteNombre: data.form?.solicitanteNombre ?? registro.nombre ?? authUser?.name ?? '',
          numeroOrden: data.form?.numeroOrden ?? '',
          montoSolicitado: data.form?.montoSolicitado ?? '',
          cantidadCuotas: data.form?.cantidadCuotas ?? '',
          cuotasPagadas: data.form?.cuotasPagadas ?? '0',
          fechaNecesaria: data.form?.fechaNecesaria ?? registro.fechaAlta ?? '',
          destinatarioIds: Array.isArray(data.form?.destinatarioIds)
            ? data.form?.destinatarioIds ?? []
            : (data.form as any)?.destinatarioId
            ? [String((data.form as any)?.destinatarioId)]
            : [],
          observaciones: data.form?.observaciones ?? '',
          estado: data.form?.estado ?? registro.estado ?? 'Pendiente',
        });
        return;
      }
      case 'vacaciones': {
        setActiveTab('vacaciones');
        setEditingSolicitudId(registro.id);
        setEditingSolicitudTipo('vacaciones');
        const data = (registro.solicitudData as { form?: VacacionesRequestForm }) ?? {};
        setVacacionesForm({
          empleadoId: data.form?.empleadoId ?? '',
          empleadoNombre: data.form?.empleadoNombre ?? registro.nombre ?? authUser?.name ?? '',
          fechaDesde: data.form?.fechaDesde ?? registro.fechaAlta ?? '',
          fechaHasta: data.form?.fechaHasta ?? '',
          diasHabiles: data.form?.diasHabiles ?? '',
          motivo: data.form?.motivo ?? '',
          estado: data.form?.estado ?? registro.estado ?? 'Pendiente',
          destinatarioIds: Array.isArray(data.form?.destinatarioIds)
            ? data.form?.destinatarioIds ?? []
            : (data.form as any)?.destinatarioId
            ? [String((data.form as any)?.destinatarioId)]
            : [],
        });
        return;
      }
      case 'poliza': {
        setActiveTab('poliza');
        const data = (registro.solicitudData as { form?: { observaciones?: string; agenteId?: string } }) ?? {};
        setPolizaForm({
          polizaFile: null,
          comprobanteFile: null,
          observaciones: data.form?.observaciones ?? '',
          agenteId: data.form?.agenteId ?? '',
        });
        setPolizaInputsVersion((value) => value + 1);
        return;
      }
      case 'alta':
      default: {
        setActiveTab('altas');
        if (registro.id > 0) {
          if (personaIdFromQuery !== String(registro.id)) {
            navigate(`/aprobaciones?personaId=${registro.id}`);
          }
        }
      }
    }
  };

  const selectedCambioAsignacionForm = useMemo(() => {
    const data = selectedCambioAsignacion?.solicitudData as { form?: Record<string, any> } | null | undefined;
    if (!data || typeof data.form !== 'object' || data.form === null) {
      return {} as Record<string, any>;
    }
    return data.form;
  }, [selectedCambioAsignacion]);

  const handleResolverCambioAsignacion = async (action: 'aprobar' | 'rechazar') => {
    if (!selectedCambioAsignacion) {
      return;
    }

    if (selectedCambioAsignacion.id <= 0) {
      setFlash({
        type: 'error',
        message: 'La solicitud seleccionada no tiene un identificador válido.',
      });
      return;
    }

    const confirmMessage =
      action === 'aprobar'
        ? '¿Aprobar este cambio de asignación?'
        : '¿Rechazar este cambio de asignación?';
    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) {
      return;
    }

    let motivoRechazo: string | null = null;
    if (action === 'rechazar') {
      const promptValue = window.prompt('Motivo del rechazo (opcional):', '');
      motivoRechazo = promptValue != null ? promptValue.trim() : null;
    }

    try {
      setResolvingCambioAsignacion(true);
      setFlash(null);

      const endpoint = `${apiBaseUrl}/api/solicitud-personal/${selectedCambioAsignacion.id}/${action}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...actorHeaders,
        },
        body: JSON.stringify(
          action === 'rechazar'
            ? {
                motivo: motivoRechazo,
              }
            : {}
        ),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        const payload = (await parseJsonSafe(response).catch(() => null)) as { message?: string } | null;
        if (typeof payload?.message === 'string') {
          message = payload.message;
        }
        throw new Error(message);
      }

      const payload = (await parseJsonSafe(response)) as { message?: string };
      setFlash({
        type: 'success',
        message:
          payload?.message
          ?? (action === 'aprobar'
            ? 'Cambio de asignación aprobado correctamente.'
            : 'Cambio de asignación rechazado.'),
      });

      setBackendSolicitudes((prev) => prev.filter((item) => item.id !== selectedCambioAsignacion.id));
      setSelectedCambioAsignacion(null);
      setActiveTab('list');
      window.dispatchEvent(new CustomEvent('personal:updated'));
      fetchSolicitudes();
    } catch (err) {
      setFlash({
        type: 'error',
        message: (err as Error).message ?? 'No se pudo resolver la solicitud.',
      });
    } finally {
      setResolvingCambioAsignacion(false);
    }
  };

  const renderCambioAsignacionTab = () => {
    if (!selectedCambioAsignacion) {
      return (
        <section className="approvals-section">
          <p className="form-info">Seleccioná una solicitud de cambio de asignación desde la lista.</p>
        </section>
      );
    }

    const form = selectedCambioAsignacionForm;
    const documentos = Array.isArray(form.documentos) ? form.documentos : [];
    const nombreProveedor = selectedCambioAsignacion.nombre ?? form.personaNombre ?? '—';
    const cuilProveedor = selectedCambioAsignacion.cuil ?? form.personaCuil ?? '—';
    const clienteActual = form.clienteNombreActual ?? '—';
    const sucursalActual = form.sucursalNombreActual ?? '—';
    const clienteNuevo = form.clienteNombreNuevo ?? '—';
    const sucursalNueva = form.sucursalNombreNueva ?? '—';
    const responsable =
      selectedCambioAsignacion.agente
      ?? form.agenteResponsableNombre
      ?? '—';
    const creada = selectedCambioAsignacion.createdAt
      ? new Date(selectedCambioAsignacion.createdAt).toLocaleString('es-AR', {
          dateStyle: 'short',
          timeStyle: 'short',
        })
      : '—';

    return (
      <section className="approvals-section approvals-section--review">
        <h2>Revisión de cambio de asignación</h2>
        <div className="personal-section">
          <div className="review-summary-grid">
            <p><strong>Solicitud:</strong> #{selectedCambioAsignacion.id}</p>
            <p><strong>Proveedor:</strong> {nombreProveedor}</p>
            <p><strong>{PERSON_TAX_ID_LABEL}:</strong> {cuilProveedor}</p>
            <p><strong>ID Proveedor:</strong> {form.personaId ?? '—'}</p>
            <p><strong>Responsable:</strong> {responsable}</p>
            <p><strong>Creada:</strong> {creada}</p>
            <p>
              <strong>Estado:</strong>{' '}
              <span className={`estado-badge ${getSolicitudEstadoBadgeClass(selectedCambioAsignacion.estado ?? 'Pendiente')}`}>
                {selectedCambioAsignacion.estado ?? 'Pendiente'}
              </span>
            </p>
          </div>

          <div className="review-text-group">
            <div className="review-text">
              <strong>Asignación actual</strong>
              <p>Cliente: {clienteActual}</p>
              <p>Sucursal: {sucursalActual}</p>
            </div>
            <div className="review-text">
              <strong>Asignación solicitada</strong>
              <p>Cliente: {clienteNuevo}</p>
              <p>Sucursal: {sucursalNueva}</p>
            </div>
          </div>

          <div className="review-documents">
            <h3>Documentación del proveedor (snapshot)</h3>
            {documentos.length === 0 ? (
              <p className="form-info">No se adjuntó detalle de documentación en esta solicitud.</p>
            ) : (
              <ul className="file-list">
                {documentos.map((doc, index) => {
                  const nombre = doc?.nombre ?? doc?.name ?? `Documento ${index + 1}`;
                  const tipo = doc?.tipoNombre ?? doc?.tipo ?? 'Sin tipo';
                  const vencimiento = doc?.fechaVencimiento ?? null;
                  return (
                    <li key={`${nombre}-${index}`}>
                      {tipo} - {nombre}{vencimiento ? ` (Vence: ${vencimiento})` : ''}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="review-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={handleGoToList}
              disabled={resolvingCambioAsignacion}
            >
              Volver a lista
            </button>
            <button
              type="button"
              className="primary-action"
              onClick={() => handleResolverCambioAsignacion('aprobar')}
              disabled={resolvingCambioAsignacion}
            >
              {resolvingCambioAsignacion ? 'Procesando...' : 'Aprobar cambio'}
            </button>
            <button
              type="button"
              className="danger-action"
              onClick={() => handleResolverCambioAsignacion('rechazar')}
              disabled={resolvingCambioAsignacion}
            >
              Rechazar cambio
            </button>
          </div>
        </div>
      </section>
    );
  };

  const renderSolicitudesList = () => {
    const listColSpan = isSolicitudPersonalView ? 11 : 11;
    return (
      <div className="approvals-list">
      <div className="card-header card-header--compact">
        <div className="search-wrapper">
          <input
            type="search"
            placeholder="Buscar"
            value={solicitudesSearchTerm}
            onChange={(event) => setSolicitudesSearchTerm(event.target.value)}
          />
        </div>
        <div className="filters-actions">
          <button type="button" className="secondary-action" onClick={() => fetchSolicitudes()}>
            Actualizar
          </button>
          {isSolicitudPersonalView ? (
            <button
              type="button"
              className="secondary-action"
              onClick={handleRejectAllSolicitudes}
              disabled={bulkRejectingSolicitudes || rejectableSolicitudes.length === 0}
            >
              {bulkRejectingSolicitudes ? 'Rechazando...' : 'Rechazar todos'}
            </button>
          ) : null}
          <button type="button" className="secondary-action" onClick={handleSolicitudesReset}>
            Limpiar
          </button>
        </div>
      </div>

      <div className="filters-bar filters-bar--reclamos">
        <div className="filters-grid filters-grid--reclamos">
          <label className="filter-field">
            <span>Tipo solicitud</span>
            <select
              value={solicitudesTipoFilter}
              onChange={(event) => setSolicitudesTipoFilter(event.target.value)}
            >
              <option value="">Tipo</option>
              {solicitudesTipoOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Perfil</span>
            <select
              value={solicitudesPerfilFilter}
              onChange={(event) => setSolicitudesPerfilFilter(event.target.value)}
            >
              <option value="">Perfil</option>
              {solicitudesPerfilOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {!isSolicitudPersonalView ? (
            <label className="filter-field">
              <span>Cliente</span>
              <select
                value={solicitudesClienteFilter}
                onChange={(event) => setSolicitudesClienteFilter(event.target.value)}
              >
                <option value="">Cliente</option>
                {solicitudesClienteOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {!isSolicitudPersonalView ? (
            <label className="filter-field">
              <span>Sucursal</span>
              <select
                value={solicitudesSucursalFilter}
                onChange={(event) => setSolicitudesSucursalFilter(event.target.value)}
              >
                <option value="">Sucursal</option>
                {solicitudesSucursalOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="filter-field">
            <span>Agente</span>
            <select
              value={solicitudesAgenteFilter}
              onChange={(event) => setSolicitudesAgenteFilter(event.target.value)}
            >
              <option value="">Agente</option>
              {solicitudesAgenteOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Estado</span>
            <select
              value={solicitudesEstadoFilter}
              onChange={(event) => setSolicitudesEstadoFilter(event.target.value)}
            >
              <option value="">Estado</option>
              {solicitudesEstadoOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Creada</span>
            <select
              value={solicitudesFechaPreset}
              onChange={(event) => setSolicitudesFechaPreset(event.target.value)}
            >
              <option value="">Todas</option>
              <option value="today">Hoy</option>
              <option value="week">Esta semana</option>
              <option value="month">Este mes</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Creada desde</span>
            <input
              type="date"
              value={solicitudesFechaFrom}
              onChange={(event) => setSolicitudesFechaFrom(event.target.value)}
            />
          </label>
          <label className="filter-field">
            <span>Creada hasta</span>
            <input
              type="date"
              value={solicitudesFechaTo}
              onChange={(event) => setSolicitudesFechaTo(event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>ID</th>
              <th>Nombre</th>
              {isSolicitudPersonalView ? <th>Solicitante</th> : null}
              {isSolicitudPersonalView ? <th>Enviada a</th> : null}
              <th>Perfil</th>
              {!isSolicitudPersonalView ? <th>Cliente</th> : null}
              {!isSolicitudPersonalView ? <th>Sucursal</th> : null}
              <th>Agente</th>
              <th>Estado</th>
              {isSolicitudPersonalView ? <th>Importe</th> : null}
              <th>Creada</th>
              {!isSolicitudPersonalView ? <th>Fecha alta</th> : null}
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {solicitudesLoading ? (
              <tr>
                <td colSpan={listColSpan}>Cargando solicitudes...</td>
              </tr>
            ) : solicitudesError ? (
              <tr>
                <td colSpan={listColSpan} className="error-cell">
                  {solicitudesError}
                </td>
              </tr>
            ) : filteredSolicitudes.length === 0 ? (
              <tr>
                <td colSpan={listColSpan}>No hay solicitudes pendientes.</td>
              </tr>
            ) : (
              filteredSolicitudes.map((registro) => {
                const perfilLabel = perfilNames[registro.perfilValue ?? 0] ?? registro.perfil ?? '—';
                const solicitudTipoLabel = resolveSolicitudTipoMeta(registro).label;
                const data = registro.solicitudData as any;
                const solicitanteLabel =
                  data?.form?.solicitanteNombre ??
                  data?.form?.empleadoNombre ??
                  data?.form?.transportista ??
                  registro.nombre ??
                  '—';
                const destinatarioIds = Array.isArray(data?.form?.destinatarioIds)
                  ? data?.form?.destinatarioIds
                  : data?.form?.destinatarioId
                  ? [String(data?.form?.destinatarioId)]
                  : [];
                const destinatarioLabel =
                  resolveApproverNames(destinatarioIds) ??
                  registro.agente ??
                  '—';
                const importeSolicitado = (() => {
                  if (!isSolicitudPersonalView) {
                    return null;
                  }
                  switch (registro.solicitudTipo) {
                    case 'adelanto':
                      return data?.form?.monto ?? null;
                    case 'prestamo':
                      return data?.form?.montoSolicitado ?? null;
                    default:
                      return null;
                  }
                })();
                return (
                  <tr key={registro.id}>
                    <td>{solicitudTipoLabel}</td>
                    <td>{registro.id}</td>
                    <td>{registro.nombre ?? '—'}</td>
                    {isSolicitudPersonalView ? <td>{solicitanteLabel}</td> : null}
                    {isSolicitudPersonalView ? <td>{destinatarioLabel}</td> : null}
                    <td>{perfilLabel}</td>
                    {!isSolicitudPersonalView ? <td>{registro.cliente ?? '—'}</td> : null}
                    {!isSolicitudPersonalView ? <td>{registro.sucursal ?? '—'}</td> : null}
                    <td>{registro.agente ?? '—'}</td>
                    <td>
                      {(() => {
                        const estadoValue = (registro.estado ?? 'Pendiente').trim();
                        if (isSolicitudPersonalView) {
                          if (registro.solicitudTipo === 'cambio_asignacion') {
                            return registro.estado ? (
                              <span className={`estado-badge ${getSolicitudEstadoBadgeClass(registro.estado)}`}>
                                {registro.estado}
                              </span>
                            ) : (
                              '—'
                            );
                          }

                          const estadoOptionsBase =
                            registro.solicitudTipo === 'vacaciones' ? VACACIONES_ESTADO_OPTIONS : SOLICITUD_ESTADO_OPTIONS;
                          const estadoOptions = estadoOptionsBase.includes(estadoValue)
                            ? estadoOptionsBase
                            : [estadoValue, ...estadoOptionsBase];
                          const canEditRow = isUserDestinatario(destinatarioIds);
                          const isUpdating = updatingSolicitudEstadoIds.has(registro.id);
                          return (
                            <select
                              className="solicitud-inline-select"
                              value={estadoValue}
                              onChange={(event) => handleInlineSolicitudEstadoChange(registro, event.target.value)}
                              disabled={!canEditRow || isUpdating}
                              aria-label={`Cambiar estado de solicitud #${registro.id}`}
                            >
                              {estadoOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          );
                        }

                        return registro.estado ? (
                          <span className={`estado-badge ${getSolicitudEstadoBadgeClass(registro.estado)}`}>
                            {registro.estado}
                          </span>
                        ) : (
                          '—'
                        );
                      })()}
                    </td>
                    {isSolicitudPersonalView ? <td>{formatCurrency(importeSolicitado)}</td> : null}
                    <td>
                      {(() => {
                        const created = resolveSolicitudCreated(registro);
                        if (!created) {
                          return '—';
                        }
                        const parsed = new Date(created);
                        if (Number.isNaN(parsed.getTime())) {
                          return created;
                        }
                        return parsed.toLocaleString('es-AR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        });
                      })()}
                    </td>
                    {!isSolicitudPersonalView ? <td>{registro.fechaAlta ?? '—'}</td> : null}
                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          aria-label={`Abrir solicitud ${registro.nombre ?? registro.id}`}
                        onClick={() => handleOpenSolicitud(registro)}
                      >
                        {registro.solicitudTipo && registro.solicitudTipo !== 'alta' ? '↗' : '👁️'}
                      </button>
                      <button
                        type="button"
                        aria-label={`Eliminar solicitud ${registro.nombre ?? registro.id}`}
                        onClick={() => handleDeleteSolicitud(registro)}
                        disabled={deletingSolicitudId === registro.id}
                      >
                        {deletingSolicitudId === registro.id ? '…' : '🗑️'}
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <footer className="table-footer">
        <span>{solicitudesFooterLabel}</span>
        <div className="pagination">
          <button disabled aria-label="Anterior">
            ‹
          </button>
          <button disabled aria-label="Siguiente">
            ›
          </button>
        </div>
      </footer>
    </div>
    );
  };

  const renderAltaPerfilSection = () => {
    switch (altaForm.perfilValue) {
      case 1:
        return (
          <div className="personal-section">
            <h3>Transportista</h3>
            <div className="form-grid">
              {renderAltaInput('Nombres', 'nombres', true)}
              {renderAltaInput('Apellidos', 'apellidos', true)}
              {renderAltaInput('Teléfono', 'telefono', false, 'tel')}
              {renderAltaInput('Correo electrónico', 'email', true, 'email')}
              {renderAltaCheckbox('Tarifa especial', 'tarifaEspecial', 'Tiene tarifa especial')}
              {renderAltaInput('Observación tarifa', 'observacionTarifa')}
              {renderAltaCuilInput(PERSON_TAX_ID_LABEL, 'cuil', 'titular')}
              {renderAltaInput('CBU/Alias', 'cbuAlias')}
              {renderAltaSelect('Pago', 'pago', PAGO_SELECT_OPTIONS, { placeholder: 'S/N factura' })}
              {renderAltaInput('Fecha de nacimiento', 'duenoFechaNacimiento', false, 'date')}
              {renderAltaCheckbox('Combustible', 'combustible', 'Cuenta corrientes combustible')}
              {renderAltaInput('Fecha de alta', 'fechaAlta', false, 'date')}
              {renderAltaInput('Patente', 'patente', true)}
            </div>

            <div className="personal-subsection" style={{ marginTop: '1rem' }}>
              <h4>Datos de cobrador</h4>
              <div className="form-grid">
                <label className="input-control">
                  <span>¿Es cobrador?</span>
                  <div className="checkbox-control">
                    <input type="checkbox" checked={altaForm.esCobrador} onChange={handleAltaCobradorToggle} />
                    Marcar si los datos pertenecen a un cobrador
                  </div>
                </label>
                {renderAltaInput('Nombre completo del cobrador', 'cobradorNombre', altaForm.esCobrador)}
                {renderAltaInput('Correo del cobrador', 'cobradorEmail', false, 'email')}
                {renderAltaCuilInput(COLLECTOR_TAX_ID_LABEL, 'cobradorCuil', 'cobrador', altaForm.esCobrador, !altaForm.esCobrador)}
                {renderAltaInput('CBU/Alias del cobrador', 'cobradorCbuAlias', altaForm.esCobrador)}
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="personal-section personal-section--chofer">
            <h3>Cobrador</h3>
            <div className="form-grid form-grid--chofer">
              {renderAltaInput('Nombre completo', 'nombres', true)}
              {renderAltaInput('Correo electrónico', 'email', true, 'email')}
              {renderAltaInput('Teléfono', 'telefono', false, 'tel')}
              {renderAltaCheckbox('Tarifa especial', 'tarifaEspecial', 'Tiene tarifa especial')}
              {renderAltaInput('Observación tarifa', 'observacionTarifa')}
              {renderAltaCuilInput(PERSON_TAX_ID_LABEL, 'cuil', 'titular')}
              {renderAltaInput('CBU/Alias', 'cbuAlias')}
              {renderAltaSelect('Pago', 'pago', PAGO_SELECT_OPTIONS, { placeholder: 'S/N factura' })}
              {renderAltaInput('Fecha de nacimiento', 'duenoFechaNacimiento', false, 'date')}
              {renderAltaCheckbox('Combustible', 'combustible', 'Cuenta corrientes combustible')}
              {renderAltaInput('Fecha de alta', 'fechaAlta', false, 'date')}
              {renderAltaInput('Patente', 'patente', true)}
              {renderAltaSelect(
                'Cliente',
                'clienteId',
                (meta?.clientes ?? []).map((cliente) => ({
                  value: String(cliente.id),
                  label: cliente.nombre ?? `Cliente #${cliente.id}`,
                }))
              )}
              {renderAltaSelect(
                'Sucursal',
                'sucursalId',
                sucursalOptions.map((sucursal) => ({
                  value: String(sucursal.id),
                  label: sucursal.nombre ?? `Sucursal #${sucursal.id}`,
                })),
                { disabled: sucursalOptions.length === 0 }
              )}
              {renderAltaSelect(
                'Agente',
                'agenteId',
                (meta?.agentes ?? []).map((agente) => ({
                  value: String(agente.id),
                  label: agente.name ?? `Agente #${agente.id}`,
                }))
              )}
              <label className="input-control">
                <span>Agente responsable</span>
                <div className="checkbox-list" style={{ maxHeight: '8rem', overflowY: 'auto', padding: '0.25rem 0' }}>
                  {(meta?.agentes ?? []).map((agente) => {
                    const value = String(agente.id);
                    const checked = (altaForm.agenteResponsableIds ?? []).includes(value);
                    return (
                      <label key={value} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.15rem 0' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setAltaFormDirty(true);
                            setAltaForm((prev) => {
                              const current = new Set(prev.agenteResponsableIds ?? []);
                              if (current.has(value)) {
                                current.delete(value);
                              } else {
                                current.add(value);
                              }
                              const nextIds = Array.from(current);
                              return {
                                ...prev,
                                agenteResponsableIds: nextIds,
                                agenteResponsableId: nextIds[0] ?? '',
                              };
                            });
                          }}
                        />
                        <span>{agente.name ?? `Agente #${agente.id}`}</span>
                      </label>
                    );
                  })}
                </div>
                <small>Podés seleccionar uno o varios.</small>
              </label>
              {renderAltaSelect(
                'Unidad',
                'unidadId',
                (meta?.unidades ?? []).map((unidad) => ({
                  value: String(unidad.id),
                  label:
                    [unidad.matricula, unidad.marca, unidad.modelo].filter(Boolean).join(' · ') ||
                    `Unidad #${unidad.id}`,
                }))
              )}
              {renderAltaSelect(
                'Estado',
                'estadoId',
                (meta?.estados ?? []).map((estado) => ({
                  value: String(estado.id),
                  label: estado.nombre ?? `Estado #${estado.id}`,
                }))
              )}
              {renderAltaInput('Fecha de alta vinculación', 'fechaAltaVinculacion', false, 'date')}
              <label className="input-control" style={{ gridColumn: '1 / -1' }}>
                <span>Observaciones</span>
                <textarea
                  rows={4}
                  value={altaForm.observaciones}
                  onChange={handleAltaFieldChange('observaciones')}
                  placeholder="Agregar observaciones"
                />
              </label>
            </div>

            <h3>Dueño de la unidad</h3>
            <div className="form-grid form-grid--chofer">
              {renderAltaInput('Nombre completo (Dueño)', 'duenoNombre')}
              {renderAltaInput('Fecha de nacimiento', 'duenoFechaNacimiento', false, 'date')}
              {renderAltaInput('Correo (Dueño)', 'duenoEmail', false, 'email')}
              {renderAltaInput(OWNER_TAX_ID_LABEL, 'duenoCuil')}
              {renderAltaInput(OWNER_COLLECTOR_TAX_ID_LABEL, 'duenoCuilCobrador')}
              {renderAltaInput('CBU/Alias (Dueño)', 'duenoCbuAlias')}
              {renderAltaInput('Teléfono (Dueño)', 'duenoTelefono', false, 'tel')}
              <label className="input-control" style={{ gridColumn: '1 / -1' }}>
                <span>Observaciones</span>
                <textarea
                  rows={2}
                  value={altaForm.duenoObservaciones}
                  onChange={handleAltaFieldChange('duenoObservaciones')}
                  placeholder="Agregar observaciones"
                />
              </label>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="personal-section">
            <h3>Servicios</h3>
            <div className="form-grid">
              {renderAltaInput('Nombres', 'nombres', true)}
              {renderAltaInput('Apellidos', 'apellidos', true)}
              {renderAltaCuilInput(PERSON_TAX_ID_LABEL, 'cuil', 'titular')}
              {renderAltaInput('Correo electrónico', 'email', true, 'email')}
              {renderAltaInput('Teléfono', 'telefono', false, 'tel')}
              {renderAltaCheckbox('Combustible', 'combustible', 'Cuenta corrientes combustible')}
              {renderAltaCheckbox('Tarifa especial', 'tarifaEspecial', 'Tiene tarifa especial')}
              {renderAltaInput('Observación tarifa', 'observacionTarifa')}
              {renderAltaInput('Fecha de alta', 'fechaAlta', false, 'date')}
              {renderAltaInput('Patente', 'patente', true)}
              {renderAltaInput('Fecha de nacimiento', 'duenoFechaNacimiento', false, 'date')}
            </div>

            <div className="placeholder-grid">
              {renderAltaDisabledInput('Guía/Remito')}
              {renderAltaDisabledInput('Valor del viaje', 'number')}
              {renderAltaDisabledInput('Origen')}
              {renderAltaDisabledInput('Destino')}
              <label className="input-control" style={{ gridColumn: '1 / -1' }}>
                <span>Observación</span>
                <textarea disabled rows={2} placeholder="—" />
              </label>
            </div>
          </div>
        );
      default:
        return (
          <div className="personal-section">
            <h3>Perfil seleccionado</h3>
            <div className="form-grid">
              {renderAltaInput('Nombres', 'nombres')}
              {renderAltaInput('Apellidos', 'apellidos')}
              {renderAltaInput('Teléfono', 'telefono', false, 'tel')}
              {renderAltaInput('Correo electrónico', 'email', true, 'email')}
              {renderAltaCheckbox('Tarifa especial', 'tarifaEspecial', 'Tiene tarifa especial')}
              {renderAltaInput('Observación tarifa', 'observacionTarifa')}
              {renderAltaCuilInput(PERSON_TAX_ID_LABEL, 'cuil', 'titular')}
              {renderAltaInput('CBU/Alias', 'cbuAlias')}
              {renderAltaSelect('Pago', 'pago', PAGO_SELECT_OPTIONS, { placeholder: 'S/N factura' })}
              {renderAltaCheckbox('Combustible', 'combustible', 'Cuenta corrientes combustible')}
              {renderAltaInput('Fecha de alta', 'fechaAlta', false, 'date')}
              {renderAltaInput('Fecha de nacimiento', 'duenoFechaNacimiento', false, 'date')}
              {renderAltaInput('Patente', 'patente', true)}
            </div>
          </div>
        );
    }
  };

  const selectedApprovalEstadoNombre = useMemo(() => {
    if (!approvalEstadoId || Number.isNaN(Number(approvalEstadoId))) {
      return null;
    }
    return meta?.estados?.find((estado) => String(estado.id) === String(approvalEstadoId))?.nombre ?? null;
  }, [approvalEstadoId, meta?.estados]);

  const isSelectedApprovalEstadoEnviado = useMemo(() => {
    const normalized = (selectedApprovalEstadoNombre ?? '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');
    return normalized === 'enviado';
  }, [selectedApprovalEstadoNombre]);

  const renderReviewSection = () => {
    if (!personaIdFromQuery) {
      return null;
    }

    const normalizeReviewValue = (value: string | null | undefined): string | null => {
      if (value === null || value === undefined) {
        return null;
      }
      const trimmed = String(value).trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const formatReviewBoolean = (value: boolean | null | undefined): string | null => {
      if (value === null || value === undefined) {
        return null;
      }
      return value ? 'Sí' : 'No';
    };

    const renderReviewProfileGroup = (
      title: string,
      fields: Array<{ label: string; value: string | null | undefined }>
    ) => {
      const visibleFields = fields
        .map(({ label, value }) => {
          const normalized = normalizeReviewValue(value);
          return normalized ? { label, value: normalized } : null;
        })
        .filter((item): item is { label: string; value: string } => Boolean(item));

      if (visibleFields.length === 0) {
        return null;
      }

      return (
        <div className="review-profile-section">
          <h3>{title}</h3>
          <div className="review-profile-grid">
            {visibleFields.map(({ label, value }) => (
              <div key={label} className="review-profile-field">
                <span className="review-profile-label">{label}</span>
                <span className="review-profile-value">{value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    };

    const renderReviewProfileDetails = () => {
      if (!reviewPersonaDetail) {
        return null;
      }

      const commonFields = [
        { label: 'Nombres', value: reviewPersonaDetail.nombres },
        { label: 'Apellidos', value: reviewPersonaDetail.apellidos },
        { label: PERSON_TAX_ID_LABEL, value: reviewPersonaDetail.cuil },
        { label: 'Teléfono', value: reviewPersonaDetail.telefono },
        { label: 'Correo electrónico', value: reviewPersonaDetail.email },
        { label: 'Pago', value: formatPagoLabel(reviewPersonaDetail.pago) || reviewPersonaDetail.pago },
        { label: 'CBU/Alias', value: reviewPersonaDetail.cbuAlias },
        { label: 'Patente', value: reviewPersonaDetail.patente },
        {
          label: 'Tarifa especial',
          value: formatReviewBoolean(reviewPersonaDetail.tarifaEspecialValue),
        },
        {
          label: 'Combustible',
          value: formatReviewBoolean(reviewPersonaDetail.combustibleValue),
        },
        { label: 'Observación tarifa', value: reviewPersonaDetail.observacionTarifa },
        { label: 'Fecha de alta', value: reviewPersonaDetail.fechaAlta },
        { label: 'Fecha de alta vinculación', value: reviewPersonaDetail.fechaAltaVinculacion },
      ];

      const ownerFields = [
        { label: 'Nombre completo (Dueño)', value: reviewPersonaDetail.duenoNombre },
        { label: 'Fecha de nacimiento', value: reviewPersonaDetail.duenoFechaNacimiento },
        { label: 'Correo (Dueño)', value: reviewPersonaDetail.duenoEmail },
        { label: 'Teléfono (Dueño)', value: reviewPersonaDetail.duenoTelefono },
        { label: OWNER_TAX_ID_LABEL, value: reviewPersonaDetail.duenoCuil },
        { label: OWNER_COLLECTOR_TAX_ID_LABEL, value: reviewPersonaDetail.duenoCuilCobrador },
        { label: 'CBU/Alias (Dueño)', value: reviewPersonaDetail.duenoCbuAlias },
        { label: 'Observaciones (Dueño)', value: reviewPersonaDetail.duenoObservaciones },
      ];

      switch (reviewPersonaDetail.perfilValue) {
        case 1:
          return renderReviewProfileGroup('Datos del transportista', commonFields);
        case 2:
          return (
            <>
              {renderReviewProfileGroup('Datos del cobrador', commonFields)}
              {renderReviewProfileGroup('Dueño de la unidad', ownerFields)}
            </>
          );
        case 3:
          return renderReviewProfileGroup('Datos de servicios', commonFields);
        default:
          return renderReviewProfileGroup('Datos del perfil', commonFields);
      }
    };

    return (
      <section className="approvals-section approvals-section--review">
        <h2>Revisión de solicitud de alta</h2>
        <div className="personal-section">
          {reviewLoading ? (
            <p className="form-info">Cargando detalles de la solicitud...</p>
          ) : reviewError ? (
            <p className="form-info form-info--error">{reviewError}</p>
          ) : reviewPersonaDetail ? (
              <>
                <div className="review-summary-grid">
                  {(() => {
                    const nombreCompleto = [reviewPersonaDetail.nombres, reviewPersonaDetail.apellidos]
                      .filter(Boolean)
                    .join(' ');
                  const aprobadoLabel = reviewPersonaDetail.aprobadoAt
                    ? new Date(reviewPersonaDetail.aprobadoAt).toLocaleString('es-AR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : null;
                  const agentesResponsablesLabel =
                    (reviewPersonaDetail.agentesResponsables ?? []).filter(Boolean).length > 0
                      ? (reviewPersonaDetail.agentesResponsables ?? []).filter(Boolean).join(', ')
                      : reviewPersonaDetail.agenteResponsable || reviewPersonaDetail.agente || '—';

                  return (
                    <>
                      <p><strong>Nombre completo:</strong> {nombreCompleto || '—'}</p>
                      <p><strong>Correo:</strong> {reviewPersonaDetail.email || '—'}</p>
                      <p><strong>Teléfono:</strong> {reviewPersonaDetail.telefono || '—'}</p>
                      <p><strong>Cliente:</strong> {reviewPersonaDetail.cliente || '—'}</p>
                      <p><strong>Sucursal:</strong> {reviewPersonaDetail.sucursal || '—'}</p>
                      <p>
                        <strong>Estado actual:</strong>{' '}
                        <span className={`estado-badge ${getSolicitudEstadoBadgeClass(reviewPersonaDetail.estado || 'Sin estado')}`}>
                          {reviewPersonaDetail.estado || 'Sin estado'}
                        </span>
                      </p>
                      <p><strong>Agente responsable:</strong> {agentesResponsablesLabel}</p>
                      <p><strong>Fecha de alta:</strong> {reviewPersonaDetail.fechaAlta || '—'}</p>
                      {reviewPersonaDetail.aprobado ? (
                        <p><strong>Aprobado el:</strong> {aprobadoLabel ?? 'Fecha no registrada'}</p>
                      ) : null}
                    </>
                  );
                })()}
                </div>

                {renderReviewProfileDetails()}

                {(reviewPersonaDetail.observaciones && reviewPersonaDetail.observaciones.trim().length > 0) ||
                (reviewPersonaDetail.observacionTarifa && reviewPersonaDetail.observacionTarifa.trim().length > 0) ? (
                  <div className="review-text-group">
                    {reviewPersonaDetail.observaciones && reviewPersonaDetail.observaciones.trim().length > 0 ? (
                      <div className="review-text">
                        <strong>Observaciones internas</strong>
                        <p>{reviewPersonaDetail.observaciones}</p>
                      </div>
                    ) : null}
                    {reviewPersonaDetail.observacionTarifa && reviewPersonaDetail.observacionTarifa.trim().length > 0 ? (
                      <div className="review-text">
                        <strong>Observación sobre tarifa</strong>
                        <p>{reviewPersonaDetail.observacionTarifa}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="review-documents">
                <h3>Documentación cargada</h3>
                {reviewPersonaDetail.documents.length > 0
                  ? (() => {
                      const downloadAllUrl = resolveApiUrl(
                        apiBaseUrl,
                        reviewPersonaDetail.documentsDownloadAllAbsoluteUrl
                          ?? reviewPersonaDetail.documentsDownloadAllUrl
                          ?? (reviewPersonaDetail
                            ? `/api/personal/${reviewPersonaDetail.id}/documentos/descargar-todos`
                            : null)
                      );

                      return (
                        <>
                          {downloadAllUrl ? (
                            <div className="review-documents-actions">
                              <a className="secondary-action" href={downloadAllUrl} download>
                                Descargar todos
                              </a>
                            </div>
                          ) : null}
                          <ul className="file-list">
                            {reviewPersonaDetail.documents.map((documento) => {
                              const labelParts = [documento.tipoNombre ?? `Documento #${documento.id}`];
                              if (documento.nombre && documento.nombre !== labelParts[0]) {
                                labelParts.push(documento.nombre);
                              }
                              const label = labelParts.join(' – ');
                              const resolvedDownloadUrl = resolveReviewDocumentUrl(documento);
                              const isDeleting = reviewDeletingDocumentIds.has(documento.id);
                              return (
                                <li key={documento.id}>
                                  <div className="file-list__row">
                                    <div className="file-list__info">
                                      {resolvedDownloadUrl ? (
                                        <a href={resolvedDownloadUrl} target="_blank" rel="noopener noreferrer">
                                          {label}
                                        </a>
                                      ) : (
                                        <span>{label}</span>
                                      )}
                                      {documento.fechaVencimiento ? (
                                        <small>Vence: {documento.fechaVencimiento}</small>
                                      ) : null}
                                    </div>
                                    <button
                                      type="button"
                                      className="file-list__delete"
                                      onClick={() => handleReviewDeleteDocument(documento)}
                                      disabled={isDeleting}
                                    >
                                      {isDeleting ? 'Eliminando…' : 'Eliminar'}
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                          {reviewImageDocuments.length > 0 ? (
                            <div className="pending-upload-previews">
                              {reviewImageDocuments.map((doc) => (
                                <button
                                  type="button"
                                  key={doc.id}
                                  className="pending-upload-previews__item"
                                  onClick={() => openAltaPreviewModal(doc.url, doc.label)}
                                >
                                  <img
                                    src={doc.url}
                                    alt={`Vista previa de ${doc.label}`}
                                    className="pending-upload-previews__image"
                                  />
                                  <span>{doc.label}</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </>
                      );
                    })()
                  : (
                    <p className="form-info">No hay documentos cargados para esta solicitud.</p>
                  )}
              </div>

              <div className="review-comments">
                <div className="review-comments__header">
                  <h3>Chat interno</h3>
                  {Array.isArray(reviewPersonaDetail.comments) && reviewPersonaDetail.comments.length > 3 ? (
                    <button
                      type="button"
                      className="secondary-action secondary-action--ghost"
                      onClick={() => setReviewChatOpen((prev) => !prev)}
                    >
                      {reviewChatOpen ? 'Ocultar' : 'Ver todo'}
                    </button>
                  ) : null}
                </div>
                {Array.isArray(reviewPersonaDetail.comments) && reviewPersonaDetail.comments.length > 0 ? (
                  <div className={`review-comments__body${reviewChatOpen ? ' is-open' : ''}`}>
                    <ul className="review-comment-list">
                      {reviewPersonaDetail.comments.map((comment) => (
                        <li key={comment.id} className="review-comment-item">
                          <div className="review-comment-header">
                            <span>{comment.userName ?? 'Usuario'}</span>
                            <span>
                              {(() => {
                                const raw = comment.createdAt ?? comment.createdAtLabel;
                                if (!raw) {
                                  return '—';
                                }
                                const parsed = new Date(raw);
                                if (Number.isNaN(parsed.getTime())) {
                                  return comment.createdAtLabel ?? raw;
                                }
                                return parsed.toLocaleString('es-AR', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                });
                              })()}
                            </span>
                          </div>
                          <p>{comment.message ?? ''}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="form-info">Todavía no hay comentarios internos.</p>
                )}

                <div className="review-comment-form">
                  <label className="input-control">
                    <span>Agregar comentario</span>
                    <textarea
                      rows={3}
                      value={reviewCommentText}
                      onChange={(event) => {
                        setReviewCommentText(event.target.value);
                        if (reviewCommentError) {
                          setReviewCommentError(null);
                        }
                      }}
                      placeholder="Escribe un mensaje para tu equipo"
                      disabled={reviewCommentSaving}
                    />
                  </label>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => {
                        setReviewCommentText('');
                        setReviewCommentError(null);
                        setReviewCommentInfo(null);
                      }}
                      disabled={reviewCommentSaving}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="primary-action"
                      onClick={handleReviewCommentSubmit}
                      disabled={reviewCommentSaving}
                    >
                      {reviewCommentSaving ? 'Enviando...' : 'Enviar'}
                    </button>
                  </div>
                  {reviewCommentError ? (
                    <p className="form-info form-info--error">{reviewCommentError}</p>
                  ) : null}
                  {reviewCommentInfo ? (
                    <p className="form-info form-info--success">{reviewCommentInfo}</p>
                  ) : null}
                </div>
              </div>

              <div className="review-actions">
                {!canEditSolicitud ? (
                  <p className="form-info">
                    Solo los usuarios autorizados pueden editar o aprobar personal. Estás en modo lectura.
                  </p>
                ) : null}
                {!reviewEditMode ? (
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => {
                      populateAltaFormFromReview();
                      setReviewEditMode(true);
                    }}
                    disabled={!canEditSolicitud}
                  >
                    Editar datos
                  </button>
                ) : null}
                <label className="input-control">
                  <span>Actualizar estado</span>
                  <select
                    value={approvalEstadoId}
                    onChange={(event) => setApprovalEstadoId(event.target.value)}
                    disabled={
                      reviewPersonaDetail.aprobado || reviewEditMode || (meta?.estados?.length ?? 0) === 0
                    }
                  >
                    <option value="">Mantener estado actual</option>
                    {estadoOptionsWithRechazo.map((estado) => (
                      <option key={estado.id} value={estado.id}>
                        {estado.nombre ?? `Estado #${estado.id}`}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => handleApproveSolicitud()}
                  disabled={
                    approveLoading || reviewPersonaDetail.aprobado || reviewEditMode || !canEditSolicitud
                  }
                  title={
                    canEditSolicitud
                      ? undefined
                      : 'Solo los usuarios autorizados pueden aprobar personal.'
                  }
                >
                  {reviewPersonaDetail.aprobado
                    ? 'Solicitud aprobada'
                    : approveLoading
                    ? (isSelectedApprovalEstadoEnviado ? 'Guardando...' : 'Aprobando...')
                    : (isSelectedApprovalEstadoEnviado ? 'Marcar enviado' : 'Aprobar solicitud')}
                </button>
                <button
                  type="button"
                  className="danger-action"
                  onClick={handleRejectSolicitud}
                  disabled={approveLoading || reviewPersonaDetail.aprobado || reviewEditMode || !canEditSolicitud}
                >
                  Rechazado
                </button>
              </div>

              {reviewPersonaDetail.aprobado && reviewPersonaDetail.aprobadoPorNombre ? (
                <p className="form-info">Aprobada por {reviewPersonaDetail.aprobadoPorNombre}.</p>
              ) : null}
            </>
          ) : (
            <p className="form-info">No se encontró información para la solicitud indicada.</p>
          )}
        </div>
      </section>
    );
  };

  const isReviewMode = Boolean(personaIdFromQuery);
  const resolveReviewDocumentUrl = useCallback(
    (documento: PersonalDetail['documents'][number]) => {
      const fallbackPath = reviewPersonaDetail
        ? `/api/personal/${reviewPersonaDetail.id}/documentos/${documento.id}/descargar`
        : null;

      return resolveApiUrl(
        apiBaseUrl,
        documento.absoluteDownloadUrl ?? documento.downloadUrl ?? fallbackPath ?? null
      );
    },
    [apiBaseUrl, reviewPersonaDetail]
  );
  const reviewImageDocuments = useMemo(() => {
    if (!reviewPersonaDetail) {
      return [];
    }

    return reviewPersonaDetail.documents
      .map((documento) => {
        if (!documento.mime?.startsWith('image/')) {
          return null;
        }

        const previewUrl = resolveReviewDocumentUrl(documento);
        if (!previewUrl) {
          return null;
        }

        const labelParts = [documento.tipoNombre ?? `Documento #${documento.id}`];
        if (documento.nombre && documento.nombre !== labelParts[0]) {
          labelParts.push(documento.nombre);
        }
        return {
          id: documento.id,
          url: previewUrl,
          label: labelParts.join(' – '),
        };
      })
      .filter((item): item is { id: number; url: string; label: string } => Boolean(item));
  }, [resolveReviewDocumentUrl, reviewPersonaDetail]);
  const handleReviewDeleteDocument = useCallback(
    async (documento: PersonalDetail['documents'][number]) => {
      if (!reviewPersonaDetail) {
        return;
      }
      const docId = documento.id;
      if (docId == null) {
        window.alert('No se pudo identificar el documento a eliminar.');
        return;
      }

      const confirmed = window.confirm(
        `¿Eliminar "${documento.nombre ?? documento.tipoNombre ?? 'este documento'}"? Esta acción no se puede deshacer.`
      );
      if (!confirmed) {
        return;
      }

      setReviewDeletingDocumentIds((prev) => {
        const next = new Set(prev);
        next.add(docId);
        return next;
      });

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/personal/${reviewPersonaDetail.id}/documentos/${docId}`,
          { method: 'DELETE' }
        );

        if (!response.ok) {
          let message = `Error ${response.status}: ${response.statusText}`;
          try {
            const payload = await response.json();
            if (typeof payload?.message === 'string') {
              message = payload.message;
            } else if (payload?.errors) {
              const firstError = Object.values(payload.errors)[0];
              if (Array.isArray(firstError) && typeof firstError[0] === 'string') {
                message = firstError[0];
              }
            }
          } catch {
            // ignore parse errors
          }
          throw new Error(message);
        }

        setReviewPersonaDetail((prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            documents: prev.documents.filter((doc) => doc.id !== docId),
          };
        });
        setFlash({ type: 'success', message: 'Documento eliminado correctamente.' });
      } catch (err) {
        const message = (err as Error).message ?? 'No se pudo eliminar el documento.';
        setFlash({ type: 'error', message });
        window.alert(message);
      } finally {
        setReviewDeletingDocumentIds((prev) => {
          const next = new Set(prev);
          next.delete(docId);
          return next;
        });
      }
    },
    [apiBaseUrl, reviewPersonaDetail, setFlash]
  );

  const renderAltaEditorSections = () => (
    <>
      <section className="approvals-section">
        <h2>Datos personales</h2>
        <div className="radio-group">
          <span>Seleccionar perfil</span>
          <div className="radio-options">
            {allowedAltaPerfiles.map((perfil) => (
              <label
                key={perfil.value}
                className={`radio-option${altaForm.perfilValue === perfil.value ? ' is-active' : ''}`}
              >
                <input
                  type="radio"
                  name="perfil"
                  value={perfil.value}
                  checked={altaForm.perfilValue === perfil.value}
                  onChange={() => handleAltaPerfilChange(perfil.value)}
                />
                {getPerfilDisplayLabel(perfil.value, perfil.label)}
              </label>
            ))}
          </div>
        </div>

        {renderAltaPerfilSection()}
      </section>

      {altaForm.perfilValue !== 2 && (
        <section className="approvals-section">
          <h2>Datos de vinculación</h2>
          <div className="personal-section">
            <div className="form-grid">
              <label className="input-control">
                <span>Cliente</span>
                <select value={altaForm.clienteId} onChange={handleAltaFieldChange('clienteId')}>
                  <option value="">Seleccionar</option>
                  {(meta?.clientes ?? []).map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre ?? `Cliente #${cliente.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-control">
                <span>Sucursal</span>
                <select value={altaForm.sucursalId} onChange={handleAltaFieldChange('sucursalId')}>
                  <option value="">Seleccionar</option>
                  {sucursalOptions.map((sucursal) => (
                    <option key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre ?? `Sucursal #${sucursal.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-control">
                <span>Agente</span>
                <select value={altaForm.agenteId} onChange={handleAltaFieldChange('agenteId')}>
                  <option value="">Seleccionar</option>
                  {(meta?.agentes ?? []).map((agente) => (
                    <option key={agente.id} value={agente.id}>
                      {agente.name ?? `Agente #${agente.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-control">
                <span>Agente responsable</span>
                <div className="checkbox-list" style={{ maxHeight: '8rem', overflowY: 'auto', padding: '0.25rem 0' }}>
                  {(meta?.agentes ?? []).map((agente) => {
                    const value = String(agente.id);
                    const checked = (altaForm.agenteResponsableIds ?? []).includes(value);
                    return (
                      <label
                        key={value}
                        style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.15rem 0' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setAltaFormDirty(true);
                            setAltaForm((prev) => {
                              const current = new Set(prev.agenteResponsableIds ?? []);
                              if (current.has(value)) {
                                current.delete(value);
                              } else {
                                current.add(value);
                              }
                              const nextIds = Array.from(current);
                              return {
                                ...prev,
                                agenteResponsableIds: nextIds,
                                agenteResponsableId: nextIds[0] ?? '',
                              };
                            });
                          }}
                        />
                        <span>{agente.name ?? `Agente #${agente.id}`}</span>
                      </label>
                    );
                  })}
                </div>
                <small>Podés seleccionar uno o varios.</small>
              </label>
              <label className="input-control">
                <span>Unidad</span>
                <select value={altaForm.unidadId} onChange={handleAltaFieldChange('unidadId')}>
                  <option value="">Seleccionar</option>
                  {(meta?.unidades ?? []).map((unidad) => {
                    const label = [unidad.matricula, unidad.marca, unidad.modelo].filter(Boolean).join(' · ');
                    return (
                      <option key={unidad.id} value={unidad.id}>
                        {label.length > 0 ? label : `Unidad #${unidad.id}`}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="input-control">
                <span>Estado</span>
                <select value={altaForm.estadoId} onChange={handleAltaFieldChange('estadoId')}>
                  <option value="">Seleccionar</option>
                  {(meta?.estados ?? []).map((estado) => (
                    <option key={estado.id} value={estado.id}>
                      {estado.nombre ?? `Estado #${estado.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-control">
                <span>Fecha de alta</span>
                <input
                  type="date"
                  value={altaForm.fechaAltaVinculacion}
                  onChange={handleAltaFieldChange('fechaAltaVinculacion')}
                  placeholder="dd/mm/aaaa"
                />
              </label>
            </div>
            <label className="input-control">
              <span>Observaciones</span>
              <textarea
                rows={4}
                value={altaForm.observaciones}
                onChange={handleAltaFieldChange('observaciones')}
                placeholder="Agregar observaciones"
              />
            </label>
          </div>
        </section>
      )}

      <section className="approvals-section">
        <h2>Historial de sanciones</h2>
        <div className="personal-section">
          <p className="form-info">No hay historial disponible para esta solicitud.</p>
        </div>
      </section>

      <section className="approvals-section">
        <h2>Documentos</h2>
        <div className="personal-section">
          <div className="form-grid">
            <label className="input-control">
              <span>Documentos</span>
              <select disabled>
                <option value="">Seleccionar documento</option>
              </select>
            </label>
          </div>
          <p className="form-info">No hay documentos disponibles para esta solicitud.</p>
        </div>
      </section>

      <section className="approvals-section">
        <h2>Carga de documentos</h2>
        <div className="personal-section">
          <div className="form-grid">
            <label className="input-control">
              <span>Tipo de documento</span>
              <select value={altaDocumentType} onChange={(event) => setAltaDocumentType(event.target.value)}>
                <option value="">Seleccionar documento</option>
                {(meta?.documentTypes ?? []).map((tipo) => (
                  <option key={tipo.id} value={tipo.id ?? tipo.nombre ?? ''}>
                    {tipo.nombre ?? `Documento #${tipo.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Fecha de vencimiento</span>
              <input
                type="date"
                value={altaDocumentExpiry}
                onChange={(event) => setAltaDocumentExpiry(event.target.value)}
                placeholder="dd/mm/aaaa"
              />
            </label>
          </div>
          <div className="file-dropzone">
            <span className="file-dropzone__icon">📄</span>
            <p className="file-dropzone__text">Arrastra y suelta archivos aquí o selecciona desde tu equipo.</p>
            <div className="file-dropzone__actions">
              <label className="secondary-action secondary-action--ghost">
                Seleccionar archivos
                <input
                  key={`alta-files-${altaFilesVersion}`}
                  type="file"
                  multiple
                  accept="application/pdf,.pdf,image/*"
                  onChange={handleAltaFilesChange}
                  style={{ display: 'none' }}
                />
              </label>
              <button
                type="button"
                className="secondary-action"
                onClick={handleAltaAttachmentsSave}
                disabled={altaAttachmentsSaving || altaSubmitting || altaAttachments.length === 0}
                title="Guardar archivos en la solicitud"
              >
                {altaAttachmentsSaving ? 'Guardando...' : 'Guardar archivos'}
              </button>
            </div>
            {altaImagePreviews.length > 0 ? (
              <div className="pending-upload-previews">
                {altaImagePreviews.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className="pending-upload-previews__item"
                    onClick={() => item.previewUrl && openAltaPreviewModal(item.previewUrl, item.file.name)}
                  >
                    <img
                      src={item.previewUrl}
                      alt={`Vista previa de ${item.file.name}`}
                      className="pending-upload-previews__image"
                    />
                    <span>{item.file.name}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {renderAltaAttachmentList()}
            {isAltaCedulaVerde && altaAttachmentsForCurrentType.length < 2 ? (
              <p className="form-info">Recordá subir frente y dorso de la cédula verde.</p>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );

  const handleCancelAltaEdit = () => {
    populateAltaFormFromReview();
    setAltaAttachments([]);
    setAltaFilesVersion((value) => value + 1);
    setAltaDocumentType('');
    setAltaDocumentExpiry('');
    setReviewEditMode(false);
    setAltaFormDirty(false);
  };

  const renderAltasTab = () => {
    const renderLookupBox = () => (
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="filters-bar">
          <div className="filters-grid">
            <label className="filter-field" style={{ gridColumn: '1 / -1' }}>
              <span>Buscar personal existente</span>
              <input
                type="search"
                placeholder="Nombre, CUIT/CUIL, cliente, sucursal o ID"
                value={altaLookupTerm}
                onChange={(event) => setAltaLookupTerm(event.target.value)}
              />
            </label>
          </div>
        </div>
        {personalLookupLoading ? <p className="form-info">Cargando personal...</p> : null}
        {personalLookupError ? <p className="form-info form-info--error">{personalLookupError}</p> : null}
        {altaLookupTerm.trim() && altaLookupResults.length === 0 && !personalLookupLoading ? (
          <p className="form-info">No se encontraron coincidencias.</p>
        ) : null}
        {altaLookupResults.length > 0 ? (
          <ul className="review-comment-list" style={{ marginTop: '0.5rem' }}>
            {altaLookupResults.map((item) => (
              <li key={item.id} className="review-comment-item" style={{ cursor: 'pointer' }} onClick={() => handleAltaLookupSelect(item)}>
                <div className="review-comment-header">
                  <span>{item.nombre ?? `Personal #${item.id}`}</span>
                  <span>{item.cuil ?? '—'}</span>
                </div>
                <p style={{ marginBottom: 0, display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span>Cliente: {item.cliente ?? '—'}</span>
                  <span>Sucursal: {item.sucursal ?? '—'}</span>
                  <span>Perfil: {getPerfilDisplayLabel(item.perfilValue ?? null, item.perfil ?? '—') || '—'}</span>
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );

    if (isReviewMode) {
      if (reviewEditMode && reviewPersonaDetail) {
        return (
          <form className="approvals-form" onSubmit={handleAltaUpdateSubmit}>
            {renderLookupBox()}
            {renderAltaEditorSections()}
            <div className="form-actions">
              <button type="button" className="secondary-action" onClick={handleCancelAltaEdit} disabled={altaSubmitting}>
                Cancelar
              </button>
              <button type="submit" className="primary-action" disabled={altaSubmitting}>
                {altaSubmitting ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        );
      }

      return (
        <div className="approvals-form">
          {renderLookupBox()}
          {renderReviewSection()}
        </div>
      );
    }

    return (
      <form className="approvals-form" onSubmit={handleAltaSubmit}>
        {renderLookupBox()}
        {renderAltaEditorSections()}
        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => navigate('/personal')} disabled={altaSubmitting}>
            Cancelar
          </button>
          <button type="submit" className="primary-action" disabled={altaSubmitting || !hasAltaRequiredFields(altaForm)}>
            {altaSubmitting ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </div>
        {!hasAltaRequiredFields(altaForm) ? (
          <p className="form-info form-info--error">Requerido para enviar: CUIT/CUIL, Patente, Cliente y Sucursal.</p>
        ) : null}
      </form>
    );
  };

  const renderCombustibleTab = () => (
    <form className="approvals-form" onSubmit={handleCombustibleSubmit}>
      <section className="personal-section">
        <h3>Solicitud de combustible</h3>
        <div className="form-grid">
          <label className="input-control">
            <span>Empresa</span>
            <select value={combustibleForm.empresaId} onChange={handleCombustibleFieldChange('empresaId')}>
              <option value="">Seleccionar</option>
              {(meta?.clientes ?? []).map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre ?? `Cliente #${cliente.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="input-control">
            <span>Sucursal</span>
            <select value={combustibleForm.sucursalId} onChange={handleCombustibleFieldChange('sucursalId')}>
              <option value="">Seleccionar</option>
              {combustibleSucursalOptions.map((sucursal) => (
                <option key={sucursal.id} value={sucursal.id}>
                  {sucursal.nombre ?? `Sucursal #${sucursal.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="input-control">
            <span>Agente responsable</span>
            <select value={combustibleForm.agenteId} onChange={handleCombustibleFieldChange('agenteId')}>
              <option value="">Seleccionar</option>
              {(meta?.agentes ?? []).map((agente) => (
                <option key={agente.id} value={agente.id}>
                  {agente.name ?? `Agente #${agente.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="input-control">
            <span>Nombre completo</span>
            <input
              type="text"
              value={combustibleForm.nombreCompleto}
              onChange={handleCombustibleFieldChange('nombreCompleto')}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>DNI</span>
            <input
              type="text"
              value={combustibleForm.dni}
              onChange={handleCombustibleFieldChange('dni')}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Mail de Servi Club</span>
            <input
              type="email"
              value={combustibleForm.serviClubEmail}
              onChange={handleCombustibleFieldChange('serviClubEmail')}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Patente</span>
            <input
              type="text"
              value={combustibleForm.patente}
              onChange={handleCombustibleFieldChange('patente')}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Marca del vehículo</span>
            <input
              type="text"
              value={combustibleForm.marca}
              onChange={handleCombustibleFieldChange('marca')}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Modelo</span>
            <input
              type="text"
              value={combustibleForm.modelo}
              onChange={handleCombustibleFieldChange('modelo')}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Kilometraje aproximado</span>
            <input
              type="number"
              min="0"
              value={combustibleForm.kilometraje}
              onChange={handleCombustibleFieldChange('kilometraje')}
              placeholder="Ingresar"
            />
          </label>
        </div>
        <label className="input-control">
          <span>Observaciones</span>
          <textarea
            rows={4}
            value={combustibleForm.observaciones}
            onChange={handleCombustibleFieldChange('observaciones')}
            placeholder="Agregar observaciones"
          />
        </label>
        <label className="input-control">
          <span>Adjuntar archivos</span>
          <input
            key={`combustible-files-${combustibleFilesVersion}`}
            type="file"
            multiple
            onChange={handleCombustibleFilesChange}
          />
          {renderAttachmentList(combustibleAttachments)}
        </label>
      </section>
      <div className="form-actions">
        <button
          type="button"
          className="secondary-action"
          onClick={() => {
            setCombustibleForm({
              empresaId: '',
              sucursalId: '',
              nombreCompleto: '',
              dni: '',
              serviClubEmail: '',
              patente: '',
              marca: '',
              modelo: '',
              kilometraje: '',
              observaciones: '',
              agenteId: '',
            });
            setCombustibleAttachments([]);
            setCombustibleFilesVersion((value) => value + 1);
          }}
        >
          Limpiar
        </button>
        <button type="submit" className="primary-action" disabled={combustibleSubmitting}>
          {combustibleSubmitting ? 'Enviando...' : 'Enviar solicitud'}
        </button>
      </div>
    </form>
  );

  const renderAumentoCombustibleTab = () => (
    <form className="approvals-form" onSubmit={handleAumentoSubmit}>
      <section className="personal-section">
        <h3>Aumento de combustible</h3>
        <div className="form-grid">
          <label className="input-control">
            <span>Empresa</span>
            <select value={aumentoCombustibleForm.empresaId} onChange={handleAumentoFieldChange('empresaId')}>
              <option value="">Seleccionar</option>
              {(meta?.clientes ?? []).map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre ?? `Cliente #${cliente.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="input-control">
            <span>Sucursal</span>
            <select value={aumentoCombustibleForm.sucursalId} onChange={handleAumentoFieldChange('sucursalId')}>
              <option value="">Seleccionar</option>
              {aumentoSucursalOptions.map((sucursal) => (
                <option key={sucursal.id} value={sucursal.id}>
                  {sucursal.nombre ?? `Sucursal #${sucursal.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="input-control">
            <span>Agente responsable</span>
            <select value={aumentoCombustibleForm.agenteId} onChange={handleAumentoFieldChange('agenteId')}>
              <option value="">Seleccionar</option>
              {(meta?.agentes ?? []).map((agente) => (
                <option key={agente.id} value={agente.id}>
                  {agente.name ?? `Agente #${agente.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="input-control">
            <span>Nombre completo</span>
            <input
              type="text"
              value={aumentoCombustibleForm.nombreCompleto}
              onChange={handleAumentoFieldChange('nombreCompleto')}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>DNI</span>
            <input
              type="text"
              value={aumentoCombustibleForm.dni}
              onChange={handleAumentoFieldChange('dni')}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Mail de Servi Club</span>
            <input
              type="email"
              value={aumentoCombustibleForm.serviClubEmail}
              onChange={handleAumentoFieldChange('serviClubEmail')}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Patente</span>
            <input
              type="text"
              value={aumentoCombustibleForm.patente}
              onChange={handleAumentoFieldChange('patente')}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Marca del vehículo</span>
            <input
              type="text"
              value={aumentoCombustibleForm.marca}
              onChange={handleAumentoFieldChange('marca')}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Modelo</span>
            <input
              type="text"
              value={aumentoCombustibleForm.modelo}
              onChange={handleAumentoFieldChange('modelo')}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Kilometraje aproximado</span>
            <input
              type="number"
              min="0"
              value={aumentoCombustibleForm.kilometraje}
              onChange={handleAumentoFieldChange('kilometraje')}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Litros actuales</span>
            <input
              type="number"
              min="0"
              value={aumentoCombustibleForm.litrosActuales}
              onChange={handleAumentoFieldChange('litrosActuales')}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Litros solicitados</span>
            <input
              type="number"
              min="0"
              value={aumentoCombustibleForm.litrosSolicitados}
              onChange={handleAumentoFieldChange('litrosSolicitados')}
              placeholder="Ingresar"
            />
          </label>
        </div>
        <label className="input-control">
          <span>Motivo del aumento</span>
          <textarea
            rows={4}
            value={aumentoCombustibleForm.motivo}
            onChange={handleAumentoFieldChange('motivo')}
            placeholder="Explica el motivo del aumento solicitado"
          />
        </label>
        <label className="input-control">
          <span>Adjuntar archivos</span>
          <input
            key={`aumento-files-${aumentoFilesVersion}`}
            type="file"
            multiple
            onChange={handleAumentoFilesChange}
          />
          {renderAttachmentList(aumentoAttachments)}
        </label>
      </section>
      <div className="form-actions">
        <button
          type="button"
          className="secondary-action"
          disabled={aumentoSubmitting}
          onClick={() => {
            setAumentoCombustibleForm({
              empresaId: '',
              sucursalId: '',
              nombreCompleto: '',
              dni: '',
              serviClubEmail: '',
              patente: '',
              marca: '',
              modelo: '',
              kilometraje: '',
              litrosActuales: '',
              litrosSolicitados: '',
              motivo: '',
              agenteId: '',
            });
            setAumentoAttachments([]);
            setAumentoFilesVersion((value) => value + 1);
          }}
        >
          Limpiar
        </button>
        <button type="submit" className="primary-action" disabled={aumentoSubmitting}>
          {aumentoSubmitting ? 'Enviando...' : 'Enviar solicitud'}
        </button>
      </div>
    </form>
  );

  const renderPolizaTab = () => (
    <form className="approvals-form" onSubmit={handlePolizaSubmit}>
      <section className="personal-section">
        <h3>Solicitud de póliza</h3>
        <p className="section-helper">
          Adjunta la póliza vigente y el comprobante de pago para continuar con la validación.
        </p>
        <div className="form-grid">
          <label className="input-control">
            <span>Póliza actual</span>
            <input
              key={`poliza-${polizaInputsVersion}-file`}
              type="file"
              onChange={handlePolizaFileChange('polizaFile')}
            />
            <small className="form-hint">
              {polizaForm.polizaFile ? polizaForm.polizaFile.name : 'Selecciona el archivo de la póliza vigente'}
            </small>
          </label>
          <label className="input-control">
            <span>Comprobante de pago</span>
            <input
              key={`poliza-${polizaInputsVersion}-comprobante`}
              type="file"
              onChange={handlePolizaFileChange('comprobanteFile')}
            />
            <small className="form-hint">
              {polizaForm.comprobanteFile ? polizaForm.comprobanteFile.name : 'Adjunta el comprobante de pago vigente'}
            </small>
          </label>
          <label className="input-control">
            <span>Agente responsable</span>
            <select
              value={polizaForm.agenteId}
              onChange={(event) =>
                setPolizaForm((prev) => ({ ...prev, agenteId: event.target.value }))
              }
            >
              <option value="">Seleccionar</option>
              {(meta?.agentes ?? []).map((agente) => (
                <option key={agente.id} value={agente.id}>
                  {agente.name ?? `Agente #${agente.id}`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="input-control">
          <span>Observaciones</span>
          <textarea
            rows={4}
            value={polizaForm.observaciones}
            onChange={handlePolizaObservacionesChange}
            placeholder="Agregar observaciones relevantes"
          />
        </label>
      </section>
      <div className="form-actions">
        <button
          type="button"
          className="secondary-action"
          disabled={polizaSubmitting}
          onClick={() => {
            setPolizaForm({
              polizaFile: null,
              comprobanteFile: null,
              observaciones: '',
              agenteId: '',
            });
            setPolizaInputsVersion((value) => value + 1);
          }}
        >
          Limpiar
        </button>
        <button type="submit" className="primary-action" disabled={polizaSubmitting}>
          {polizaSubmitting ? 'Enviando...' : 'Enviar solicitud'}
        </button>
      </div>
    </form>
  );

  const renderAdelantoTab = () => {
    const isEditing = Boolean(editingSolicitudId && editingSolicitudTipo === 'adelanto');
    return (
      <form className="approvals-form" onSubmit={handleAdelantoSubmit}>
        <section className="personal-section">
          <h3>Adelanto de pago</h3>
          <p className="section-helper">Tenés tiempo hasta el jueves para pedir adelantos.</p>
          {isSolicitudPersonalView && isEditing && !canEditAdelantoSolicitud ? (
            <p className="form-info">Solo los destinatarios pueden editar esta solicitud.</p>
          ) : null}
        <div className="form-grid">
          {!isSolicitudPersonalView ? (
            <>
              <label className="input-control">
                <span>Empresa</span>
                <select value={adelantoForm.empresaId} onChange={handleAdelantoFieldChange('empresaId')}>
                  <option value="">Seleccionar</option>
                  {(meta?.clientes ?? []).map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre ?? `Cliente #${cliente.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-control">
                <span>Sucursal</span>
                <select value={adelantoForm.sucursalId} onChange={handleAdelantoFieldChange('sucursalId')}>
                  <option value="">Seleccionar</option>
                  {adelantoSucursalOptions.map((sucursal) => (
                    <option key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre ?? `Sucursal #${sucursal.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-control">
                <span>Agente responsable</span>
                <select value={adelantoForm.agenteId} onChange={handleAdelantoFieldChange('agenteId')}>
                  <option value="">Seleccionar</option>
                  {(meta?.agentes ?? []).map((agente) => (
                    <option key={agente.id} value={agente.id}>
                      {agente.name ?? `Agente #${agente.id}`}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <label className="input-control">
              <span>Enviar solicitud a</span>
              <select
                multiple
                size={3}
                value={adelantoForm.destinatarioIds}
                onChange={handleAdelantoDestinatariosChange}
                disabled={!canEditAdelantoSolicitud}
              >
                {approverOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="destinatarios-quick-actions">
                <button
                  type="button"
                  className="secondary-action secondary-action--ghost"
                  onClick={handleAdelantoSelectAllDestinatarios}
                  disabled={approverOptions.length === 0 || !canEditAdelantoSolicitud}
                >
                  Seleccionar los 3
                </button>
                <button
                  type="button"
                  className="secondary-action secondary-action--ghost"
                  onClick={handleAdelantoClearDestinatarios}
                  disabled={adelantoForm.destinatarioIds.length === 0 || !canEditAdelantoSolicitud}
                >
                  Limpiar selección
                </button>
              </div>
              <small className="form-hint">Podés seleccionar uno, dos o los tres destinatarios.</small>
            </label>
          )}
          <label className="input-control">
            <span>{isSolicitudPersonalView ? 'Solicitante' : 'Transportista'}</span>
            <input
              type="text"
              value={adelantoForm.transportista}
              onChange={handleAdelantoFieldChange('transportista')}
              placeholder="Ingresar"
              disabled={!canEditAdelantoSolicitud}
            />
          </label>
          <label className="input-control">
            <span>Monto solicitado</span>
            <input
              type="number"
              value={adelantoForm.monto}
              onChange={handleAdelantoFieldChange('monto')}
              placeholder="Ingresar"
              min="0"
              disabled={!canEditAdelantoSolicitud}
            />
          </label>
          <label className="input-control">
            <span>Fecha de solicitud</span>
            <input
              type="date"
              value={adelantoForm.fechaSolicitud}
              onChange={handleAdelantoFieldChange('fechaSolicitud')}
              placeholder="dd/mm/aaaa"
              disabled={!canEditAdelantoSolicitud}
            />
          </label>
          {canEditAdelantoEstado ? (
            <label className="input-control">
              <span>Estado</span>
              <select value={adelantoForm.estado} onChange={handleAdelantoFieldChange('estado')}>
                {SOLICITUD_ESTADO_OPTIONS.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="input-control">
              <span>Estado</span>
              <input type="text" value={adelantoForm.estado || 'Pendiente'} disabled />
            </label>
          )}
          <label className="input-control">
            <span>Motivo</span>
            <input
              type="text"
              value={adelantoForm.motivo}
              onChange={handleAdelantoFieldChange('motivo')}
              placeholder="Ingresar"
              disabled={!canEditAdelantoSolicitud}
            />
          </label>
        </div>
        <label className="input-control">
          <span>Observaciones</span>
          <textarea
            rows={4}
            value={adelantoForm.observaciones}
            onChange={handleAdelantoFieldChange('observaciones')}
            placeholder="Agregar observaciones adicionales"
            disabled={!canEditAdelantoSolicitud}
          />
        </label>
        <label className="input-control">
          <span>Adjuntar archivos</span>
          <input
            key={`adelanto-files-${adelantoFilesVersion}`}
            type="file"
            multiple
            onChange={handleAdelantoFilesChange}
            disabled={!canEditAdelantoSolicitud}
          />
          {renderAttachmentList(adelantoAttachments)}
        </label>
        </section>
        <div className="form-actions">
          <button
            type="button"
            className="secondary-action"
            disabled={!canEditAdelantoSolicitud}
            onClick={() => {
              setAdelantoForm({
                empresaId: '',
                sucursalId: '',
                transportista: '',
                monto: '',
                fechaSolicitud: '',
                motivo: '',
                observaciones: '',
                agenteId: '',
                destinatarioIds: [],
                estado: 'Pendiente',
              });
              setAdelantoAttachments([]);
              setAdelantoFilesVersion((value) => value + 1);
              setEditingSolicitudId(null);
              setEditingSolicitudTipo(null);
            }}
          >
            Limpiar
          </button>
          <button type="submit" className="primary-action" disabled={adelantoSubmitting || !canEditAdelantoSolicitud}>
            {adelantoSubmitting ? 'Enviando...' : isEditing ? 'Guardar cambios' : 'Enviar solicitud'}
          </button>
        </div>
      </form>
    );
  };

  const renderPrestamoTab = () => {
    const monto = parseMonto(prestamoForm.montoSolicitado) ?? 0;
    const cuotasRaw = Number(prestamoForm.cantidadCuotas);
    const cuotas =
      prestamoForm.cantidadCuotas.trim().length > 0 && Number.isFinite(cuotasRaw)
        ? Math.min(Math.max(cuotasRaw, 1), 12)
        : 0;
    const cuotasPagadas = Math.min(Math.max(Number(prestamoForm.cuotasPagadas) || 0, 0), cuotas);
    const interes = monto * 0.04 * cuotas;
    const totalConInteres = monto + interes;
    const valorCuota = cuotas > 0 ? totalConInteres / cuotas : 0;
    const cuotasRestantes = Math.max(cuotas - cuotasPagadas, 0);
    const isEditing = Boolean(editingSolicitudId && editingSolicitudTipo === 'prestamo');
    const formatAmount = (value: number) =>
      value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
      <form className="approvals-form" onSubmit={handlePrestamoSubmit}>
        <section className="personal-section">
          <h3>Solicitud de préstamo personal</h3>
          <p className="section-helper">Cada cuota agrega 4% sobre el valor total del préstamo.</p>
          {isSolicitudPersonalView && isEditing && !canEditPrestamoSolicitud ? (
            <p className="form-info">Solo los destinatarios pueden editar esta solicitud.</p>
          ) : null}
          <div className="form-grid">
            <label className="input-control">
              <span>Solicitante</span>
              <input
                type="text"
                value={prestamoForm.solicitanteNombre}
                onChange={handlePrestamoFieldChange('solicitanteNombre')}
                placeholder="Ingresar"
                disabled={!canEditPrestamoSolicitud || (!isAdmin && Boolean(authUser?.name))}
              />
            </label>
            <label className="input-control">
              <span>Número de orden</span>
              <input
                type="text"
                value={prestamoForm.numeroOrden || String(resolveNextPrestamoOrden(editingSolicitudId))}
                disabled
              />
            </label>
            <label className="input-control">
              <span>Préstamo solicitado</span>
              <input
                type="number"
                min="0"
                value={prestamoForm.montoSolicitado}
                onChange={handlePrestamoFieldChange('montoSolicitado')}
                placeholder="Ingresar"
                disabled={!canEditPrestamoSolicitud}
              />
            </label>
            <label className="input-control">
              <span>Cantidad de cuotas (1 a 12)</span>
              <input
                type="number"
                min="1"
                max="12"
                value={prestamoForm.cantidadCuotas}
                onChange={handlePrestamoFieldChange('cantidadCuotas')}
                placeholder="Ingresar"
                disabled={!canEditPrestamoSolicitud}
              />
            </label>
            {isAdmin ? (
              <label className="input-control">
                <span>Cuotas pagadas</span>
                <input
                  type="number"
                  min="0"
                  max={String(Math.max(cuotas, 0))}
                  value={prestamoForm.cuotasPagadas}
                  onChange={handlePrestamoFieldChange('cuotasPagadas')}
                  placeholder="0"
                  disabled={!canEditPrestamoSolicitud}
                />
              </label>
            ) : (
              <label className="input-control">
                <span>Cuotas pagadas</span>
                <input type="number" value={prestamoForm.cuotasPagadas || '0'} disabled />
              </label>
            )}
            <label className="input-control">
              <span>Fecha en la que necesita el préstamo</span>
              <input
                type="date"
                value={prestamoForm.fechaNecesaria}
                onChange={handlePrestamoFieldChange('fechaNecesaria')}
                disabled={!canEditPrestamoSolicitud}
              />
            </label>
            <label className="input-control">
              <span>Enviar solicitud a</span>
              <select
                multiple
                size={3}
                value={prestamoForm.destinatarioIds}
                onChange={handlePrestamoDestinatariosChange}
                disabled={!canEditPrestamoSolicitud}
              >
                {approverOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="destinatarios-quick-actions">
                <button
                  type="button"
                  className="secondary-action secondary-action--ghost"
                  onClick={handlePrestamoSelectAllDestinatarios}
                  disabled={approverOptions.length === 0 || !canEditPrestamoSolicitud}
                >
                  Seleccionar los 3
                </button>
                <button
                  type="button"
                  className="secondary-action secondary-action--ghost"
                  onClick={handlePrestamoClearDestinatarios}
                  disabled={prestamoForm.destinatarioIds.length === 0 || !canEditPrestamoSolicitud}
                >
                  Limpiar selección
                </button>
              </div>
              <small className="form-hint">Podés seleccionar uno, dos o los tres destinatarios.</small>
            </label>
            {canEditPrestamoEstado ? (
              <label className="input-control">
                <span>Estado</span>
                <select value={prestamoForm.estado} onChange={handlePrestamoFieldChange('estado')}>
                  {SOLICITUD_ESTADO_OPTIONS.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="input-control">
                <span>Estado</span>
                <input type="text" value={prestamoForm.estado || 'Pendiente'} disabled />
              </label>
            )}
          </div>
          <div className="form-grid">
            <label className="input-control">
              <span>Total con interés</span>
              <input type="text" value={formatAmount(totalConInteres)} disabled />
            </label>
            <label className="input-control">
              <span>Valor de cada cuota</span>
              <input type="text" value={formatAmount(valorCuota)} disabled />
            </label>
            <label className="input-control">
              <span>Cuotas restantes</span>
              <input type="text" value={String(cuotasRestantes)} disabled />
            </label>
          </div>
          <label className="input-control">
            <span>Observaciones</span>
            <textarea
              rows={4}
              value={prestamoForm.observaciones}
              onChange={handlePrestamoFieldChange('observaciones')}
              placeholder="Agregar observaciones"
              disabled={!canEditPrestamoSolicitud}
            />
          </label>
        </section>
        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={resetPrestamoForm} disabled={!canEditPrestamoSolicitud}>
            Limpiar
          </button>
          <button type="submit" className="primary-action" disabled={prestamoSubmitting || !canEditPrestamoSolicitud}>
            {prestamoSubmitting ? 'Enviando...' : isEditing ? 'Guardar cambios' : 'Enviar solicitud'}
          </button>
        </div>
      </form>
    );
  };

  const renderVacacionesTab = () => {
    const diasDisponibles =
      vacacionesForm.empleadoId && vacacionesDiasDisponibles[vacacionesForm.empleadoId] != null
        ? vacacionesDiasDisponibles[vacacionesForm.empleadoId]
        : null;
    const diasSolicitados = Math.max(Number(vacacionesForm.diasHabiles) || 0, 0);
    const diasRestantes = diasDisponibles != null ? diasDisponibles - diasSolicitados : null;
    const isEditing = Boolean(editingSolicitudId && editingSolicitudTipo === 'vacaciones');

    return (
      <form className="approvals-form" onSubmit={handleVacacionesSubmit}>
        {isAdmin ? (
          <section className="personal-section">
            <h3>Días hábiles disponibles</h3>
            <div className="form-grid">
              <label className="input-control">
                <span>Empleado</span>
                <select
                  value={vacacionesConfigForm.empleadoId}
                  onChange={(event) =>
                    setVacacionesConfigForm((prev) => ({ ...prev, empleadoId: event.target.value }))
                  }
                >
                  <option value="">Seleccionar</option>
                  {(meta?.agentes ?? []).map((agente) => (
                    <option key={agente.id} value={agente.id}>
                      {agente.name ?? `Agente #${agente.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-control">
                <span>Días hábiles</span>
                <input
                  type="number"
                  min="0"
                  value={vacacionesConfigForm.dias}
                  onChange={(event) =>
                    setVacacionesConfigForm((prev) => ({ ...prev, dias: event.target.value }))
                  }
                  placeholder="Ingresar"
                />
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="secondary-action" onClick={handleVacacionesConfigSave}>
                Guardar días
              </button>
            </div>
          </section>
        ) : null}
        <section className="personal-section">
          <h3>Solicitud de vacaciones</h3>
          {isSolicitudPersonalView && isEditing && !canEditVacacionesSolicitud ? (
            <p className="form-info">Solo los destinatarios pueden editar esta solicitud.</p>
          ) : null}
          <div className="form-grid">
            {isAdmin ? (
              <label className="input-control">
                <span>Empleado</span>
                <select value={vacacionesForm.empleadoId} onChange={handleVacacionesEmpleadoChange} disabled={!canEditVacacionesSolicitud}>
                  <option value="">Seleccionar</option>
                  {(meta?.agentes ?? []).map((agente) => (
                    <option key={agente.id} value={agente.id}>
                      {agente.name ?? `Agente #${agente.id}`}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="input-control">
                <span>Empleado</span>
                <input type="text" value={vacacionesForm.empleadoNombre || authUser?.name || ''} disabled />
              </label>
            )}
            {isAdmin ? (
              <label className="input-control">
                <span>Nombre (si no está en la lista)</span>
                <input
                  type="text"
                  value={vacacionesForm.empleadoNombre}
                  onChange={handleVacacionesFieldChange('empleadoNombre')}
                  placeholder="Ingresar"
                  disabled={!canEditVacacionesSolicitud}
                />
              </label>
            ) : null}
            <label className="input-control">
              <span>Desde</span>
              <input
                type="date"
                value={vacacionesForm.fechaDesde}
                onChange={handleVacacionesFieldChange('fechaDesde')}
                disabled={!canEditVacacionesSolicitud}
              />
            </label>
            <label className="input-control">
              <span>Hasta</span>
              <input
                type="date"
                value={vacacionesForm.fechaHasta}
                onChange={handleVacacionesFieldChange('fechaHasta')}
                disabled={!canEditVacacionesSolicitud}
              />
            </label>
            <label className="input-control">
              <span>Días hábiles solicitados</span>
              <input
                type="number"
                min="0"
                value={vacacionesForm.diasHabiles}
                onChange={handleVacacionesFieldChange('diasHabiles')}
                placeholder="Ingresar"
                disabled={!canEditVacacionesSolicitud}
              />
              <small className="form-hint">
                {diasDisponibles != null
                  ? `Disponibles: ${diasDisponibles} · Restantes: ${diasRestantes ?? diasDisponibles}`
                  : 'Días disponibles sin configurar'}
              </small>
            </label>
            {isSolicitudPersonalView ? (
              <label className="input-control">
                <span>Enviar solicitud a</span>
                <select
                  multiple
                  size={3}
                  value={vacacionesForm.destinatarioIds}
                  onChange={handleVacacionesDestinatariosChange}
                  disabled={!canEditVacacionesSolicitud}
                >
                  {approverOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="destinatarios-quick-actions">
                  <button
                    type="button"
                    className="secondary-action secondary-action--ghost"
                    onClick={handleVacacionesSelectAllDestinatarios}
                    disabled={approverOptions.length === 0 || !canEditVacacionesSolicitud}
                  >
                    Seleccionar los 3
                  </button>
                  <button
                    type="button"
                    className="secondary-action secondary-action--ghost"
                    onClick={handleVacacionesClearDestinatarios}
                    disabled={vacacionesForm.destinatarioIds.length === 0 || !canEditVacacionesSolicitud}
                  >
                    Limpiar selección
                  </button>
                </div>
                <small className="form-hint">Podés seleccionar uno, dos o los tres destinatarios.</small>
              </label>
            ) : null}
            {canEditVacacionesEstado ? (
              <label className="input-control">
                <span>Estado</span>
                <select value={vacacionesForm.estado} onChange={handleVacacionesFieldChange('estado')}>
                  {VACACIONES_ESTADO_OPTIONS.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="input-control">
                <span>Estado</span>
                <input type="text" value={vacacionesForm.estado || 'Pendiente'} disabled />
              </label>
            )}
          </div>
          <label className="input-control">
            <span>Motivo</span>
            <textarea
              rows={4}
              value={vacacionesForm.motivo}
              onChange={handleVacacionesFieldChange('motivo')}
              placeholder="Agregar motivo"
              disabled={!canEditVacacionesSolicitud}
            />
          </label>
        </section>
        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={resetVacacionesForm} disabled={!canEditVacacionesSolicitud}>
            Limpiar
          </button>
          <button type="submit" className="primary-action" disabled={vacacionesSubmitting || !canEditVacacionesSolicitud}>
            {vacacionesSubmitting ? 'Enviando...' : isEditing ? 'Guardar cambios' : 'Enviar solicitud'}
          </button>
        </div>
      </form>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'list':
        return renderSolicitudesList();
      case 'combustible':
        return renderCombustibleTab();
      case 'aumento_combustible':
        return renderAumentoCombustibleTab();
      case 'adelanto':
        return renderAdelantoTab();
      case 'prestamo':
        return renderPrestamoTab();
      case 'vacaciones':
        return renderVacacionesTab();
      case 'cambio_asignacion':
        return renderCambioAsignacionTab();
      case 'poliza':
        return renderPolizaTab();
      case 'altas':
      default:
        return renderAltasTab();
    }
  };

  const pageTitle = isSolicitudPersonalView ? 'Solicitud personal' : 'Aprobaciones y solicitudes';
  const pageSubtitle = isSolicitudPersonalView
    ? 'Prestamos, adelantos y vacaciones'
    : 'Gestiona las solicitudes pendientes';

  if (loadingMeta) {
    return (
      <DashboardLayout
        title={pageTitle}
        subtitle={pageSubtitle}
        headerContent={headerContent}
      >
        <p className="form-info">Cargando información necesaria...</p>
      </DashboardLayout>
    );
  }

  if (metaError) {
    return (
      <DashboardLayout
        title={pageTitle}
        subtitle={pageSubtitle}
        headerContent={headerContent}
      >
        <p className="form-info form-info--error">{metaError}</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={pageTitle}
      subtitle={pageSubtitle}
      headerContent={headerContent}
    >
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

      <div className="approvals-tabs">
        {isSolicitudPersonalView ? (
          <>
            <button
              type="button"
              className={`approvals-tab${activeTab === 'list' ? ' is-active' : ''}`}
              onClick={handleGoToList}
            >
              Solicitudes pendientes
            </button>
            <button
              type="button"
              className={`approvals-tab${activeTab === 'prestamo' ? ' is-active' : ''}`}
              onClick={() => {
                resetPrestamoForm();
                setActiveTab('prestamo');
              }}
            >
              Préstamo personal
            </button>
            <button
              type="button"
              className={`approvals-tab${activeTab === 'adelanto' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('adelanto')}
            >
              Adelanto de pago
            </button>
            <button
              type="button"
              className={`approvals-tab${activeTab === 'vacaciones' ? ' is-active' : ''}`}
              onClick={() => {
                resetVacacionesForm();
                setActiveTab('vacaciones');
              }}
            >
              Vacaciones
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`approvals-tab${activeTab === 'list' ? ' is-active' : ''}`}
              onClick={handleGoToList}
            >
              Solicitudes pendientes
            </button>
            <button
              type="button"
              className={`approvals-tab${activeTab === 'altas' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('altas')}
            >
              Solicitud de altas
            </button>
            <button
              type="button"
              className={`approvals-tab${activeTab === 'combustible' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('combustible')}
            >
              Solicitud de combustible
            </button>
            <button
              type="button"
              className={`approvals-tab${activeTab === 'aumento_combustible' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('aumento_combustible')}
            >
              Aumento de combustible
            </button>
            <button
              type="button"
              className={`approvals-tab${activeTab === 'adelanto' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('adelanto')}
            >
              Adelanto de pago
            </button>
            <button
              type="button"
              className={`approvals-tab${activeTab === 'poliza' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('poliza')}
            >
              Solicitud de póliza
            </button>
            {selectedCambioAsignacion ? (
              <button
                type="button"
                className={`approvals-tab${activeTab === 'cambio_asignacion' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('cambio_asignacion')}
              >
                Cambio de asignación
              </button>
            ) : null}
          </>
        )}
      </div>

      <div className="approvals-panel">{renderTabContent()}</div>

      {altaPreviewModalImage ? (
        <div
          className="preview-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Vista previa de ${altaPreviewModalImage.label}`}
          onClick={closeAltaPreviewModal}
        >
          <div className="preview-modal__content" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="preview-modal__close"
              aria-label="Cerrar vista previa"
              onClick={closeAltaPreviewModal}
            >
              ×
            </button>
            <img
              src={altaPreviewModalImage.url}
              alt={`Vista ampliada de ${altaPreviewModalImage.label}`}
              className="preview-modal__image"
            />
            <p className="preview-modal__caption">{altaPreviewModalImage.label}</p>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
};
