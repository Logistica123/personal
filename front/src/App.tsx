import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Routes,
  Route,
  NavLink,
  useNavigate,
  useParams,
  useLocation,
  Navigate,
} from 'react-router-dom';
import './App.css';

const resolveApiUrl = (baseUrl: string, target?: string | null): string | null => {
  if (!target) {
    return null;
  }

  try {
    return new URL(target).toString();
  } catch {
    const normalizedBase = baseUrl.replace(/\/+$/, '');
    const normalizedTarget = target.startsWith('/') ? target : `/${target}`;
    return `${normalizedBase}${normalizedTarget}`;
  }
};

type Sucursal = {
  id: number | null;
  nombre: string | null;
  direccion: string | null;
};

type Cliente = {
  id: number;
  codigo: string | null;
  nombre: string | null;
  direccion: string | null;
  documento_fiscal: string | null;
  sucursales: Sucursal[];
};

type Unidad = {
  id: number;
  matricula: string | null;
  marca: string | null;
  modelo: string | null;
  anio: string | null;
  observacion: string | null;
};

type Usuario = {
  id: number;
  name: string | null;
  email: string | null;
  created_at: string | null;
  status?: string | null;
  role?: string | null;
};

type PersonalHistoryChange = {
  field: string | null;
  label: string | null;
  oldValue: string | null;
  newValue: string | null;
};

type PersonalHistoryEntry = {
  id: number;
  authorId: number | null;
  authorName: string | null;
  description: string | null;
  createdAt: string | null;
  createdAtLabel: string | null;
  changes: PersonalHistoryChange[];
};

type PersonalRecord = {
  id: number;
  nombre: string | null;
  nombres?: string | null;
  apellidos?: string | null;
  cuil: string | null;
  telefono: string | null;
  email: string | null;
  cliente: string | null;
  clienteId?: number | null;
  unidad: string | null;
  unidadDetalle: string | null;
  unidadId?: number | null;
  fechaAltaVinculacion?: string | null;
  sucursal: string | null;
  sucursalId?: number | null;
  fechaAlta: string | null;
  perfil: string | null;
  perfilValue: number | null;
  agente: string | null;
  agenteId?: number | null;
  agenteResponsable?: string | null;
  agenteResponsableId?: number | null;
  estado: string | null;
  estadoId?: number | null;
  combustible: string | null;
  combustibleValue: boolean;
  tarifaEspecial: string | null;
  tarifaEspecialValue: boolean;
  pago?: string | null;
  cbuAlias?: string | null;
  patente?: string | null;
  observacionTarifa?: string | null;
  observaciones?: string | null;
  aprobado: boolean;
  aprobadoAt: string | null;
  aprobadoPor: string | null;
  aprobadoPorId?: number | null;
  esSolicitud: boolean;
  solicitudTipo?: 'alta' | 'combustible' | 'aumento_combustible' | 'adelanto' | 'poliza';
  solicitudData?: unknown;
  duenoNombre?: string | null;
  duenoFechaNacimiento?: string | null;
  duenoEmail?: string | null;
  duenoTelefono?: string | null;
  duenoCuil?: string | null;
  duenoCuilCobrador?: string | null;
  duenoCbuAlias?: string | null;
  duenoObservaciones?: string | null;
};

type PersonalDetail = {
  id: number;
  nombres: string | null;
  apellidos: string | null;
  cuil: string | null;
  telefono: string | null;
  email: string | null;
  perfil: string | null;
  perfilValue: number | null;
  agente: string | null;
  agenteId: number | null;
  agenteResponsable: string | null;
  agenteResponsableId: number | null;
  cliente: string | null;
  clienteId: number | null;
  sucursal: string | null;
  sucursalId: number | null;
  unidad: string | null;
  unidadId: number | null;
  unidadDetalle: string | null;
  patente: string | null;
  estado: string | null;
  estadoId: number | null;
  combustibleValue: boolean;
  tarifaEspecialValue: boolean;
  pago: string | null;
  cbuAlias: string | null;
  observacionTarifa: string | null;
  observaciones: string | null;
  fechaAlta: string | null;
  fechaAltaVinculacion: string | null;
  aprobado: boolean;
  aprobadoAt: string | null;
  aprobadoPorId: number | null;
  aprobadoPorNombre: string | null;
  esSolicitud: boolean;
  documentsDownloadAllUrl: string | null;
  documentsDownloadAllAbsoluteUrl?: string | null;
  duenoNombre: string | null;
  duenoFechaNacimiento: string | null;
  duenoEmail: string | null;
  duenoTelefono: string | null;
  duenoCuil: string | null;
  duenoCuilCobrador: string | null;
  duenoCbuAlias: string | null;
  duenoObservaciones: string | null;
  documents: Array<{
    id: number;
    nombre: string | null;
    downloadUrl: string | null;
    absoluteDownloadUrl?: string | null;
    mime: string | null;
    size: number | null;
    sizeLabel?: string | null;
    fechaCarga?: string | null;
    fechaCargaIso?: string | null;
    fechaVencimiento: string | null;
    tipoId: number | null;
    tipoNombre: string | null;
    requiereVencimiento: boolean;
    parentDocumentId: number | null;
    isAttachment: boolean;
  }>;
  comments: Array<{
    id: number;
    message: string | null;
    userId: number | null;
    userName: string | null;
    createdAt: string | null;
    createdAtLabel: string | null;
  }>;
  history: PersonalHistoryEntry[];
};

type PersonalDocumentType = {
  id: number;
  nombre: string | null;
  vence: boolean;
};

type PendingPersonalUpload = {
  id: string;
  file: File;
  typeId: number;
  typeName: string | null;
  fechaVencimiento: string | null;
  previewUrl?: string | null;
};

const createImagePreviewUrl = (file: File): string | null => {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    return null;
  }

  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return null;
  }

  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
};

const revokeImagePreviewUrl = (url?: string | null) => {
  if (!url) {
    return;
  }

  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') {
    return;
  }

  try {
    URL.revokeObjectURL(url);
  } catch {
    // ignore errors while revoking
  }
};

type LiquidacionDocument = PersonalDetail['documents'][number];

type LiquidacionGroup = {
  main: LiquidacionDocument;
  attachments: LiquidacionDocument[];
};

type LiquidacionFortnightSection = {
  monthKey: string;
  monthLabel: string;
  sections: Array<{
    key: string;
    label: string;
    rows: LiquidacionGroup[];
  }>;
};

const MONTH_FILTER_OPTIONS = [
  { value: '', label: 'Todos los meses' },
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
  { value: 'unknown', label: 'Sin fecha' },
];

const FORTNIGHT_FILTER_OPTIONS = [
  { value: '', label: 'Todas las quincenas' },
  { value: 'Q1', label: 'Primera quincena' },
  { value: 'Q2', label: 'Segunda quincena' },
  { value: 'NO_DATE', label: 'Sin quincena' },
];

type AltaAttachmentItem = {
  id: string;
  file: File;
  typeId: string;
  typeName: string;
  vence: string | null;
  positionLabel: string | null;
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
  combustible: boolean;
  fechaAlta: string;
  patente: string;
  clienteId: string;
  sucursalId: string;
  agenteId: string;
  agenteResponsableId: string;
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

type AltaEditableField = Exclude<keyof AltaRequestForm, 'tarifaEspecial' | 'combustible' | 'perfilValue'>;

type AttendanceRecord = {
  status: 'entrada' | 'salida';
  timestamp: string;
  userId?: number | null;
  userName?: string | null;
  userKey?: string;
};

type RemoteAttendanceApiRecord = {
  id: number;
  status: 'entrada' | 'salida';
  userId: number | null;
  userName: string | null;
  recordedAt: string | null;
  recordedAtLabel: string | null;
};

type WorkflowStatus = 'nueva' | 'proceso' | 'finalizado';

type WorkflowTaskRecord = {
  id: number;
  titulo: string;
  descripcion: string | null;
  status: WorkflowStatus;
  creatorId: number | null;
  creatorNombre: string | null;
  responsableId: number | null;
  responsableNombre: string | null;
  createdAt: string | null;
};

const formatRoleLabel = (role: string | null | undefined): string => {
  const normalized = role?.trim().toLowerCase();
  if (normalized === 'admin' || normalized === 'administrador') {
    return 'Administrador';
  }
  if (normalized === 'operator' || normalized === 'operador') {
    return 'Operador';
  }
  return 'Usuario';
};

type ReclamoRecord = {
  id: number;
  codigo: string | null;
  detalle: string | null;
  fechaReclamo: string | null;
  fechaReclamoIso: string | null;
  status: string | null;
  statusLabel: string | null;
  pagado: boolean;
  pagadoLabel: string | null;
  importePagado: string | null;
  importePagadoLabel: string | null;
  creator: string | null;
  creatorId: number | null;
  agente: string | null;
  agenteId: number | null;
  transportista: string | null;
  transportistaId: number | null;
  transportistas?: ReclamoTransportistaSummary[];
  cliente: string | null;
  tipo: string | null;
  tipoId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type ReclamoMeta = {
  agentes: Array<{ id: number; nombre: string | null }>;
  creadores: Array<{ id: number; nombre: string | null }>;
  transportistas: Array<{ id: number; nombre: string | null }>;
  tipos: Array<{ id: number; nombre: string | null }>;
  estados: Array<{ value: string; label: string }>;
};

type TransportistaDetail = {
  id: number;
  nombres: string | null;
  apellidos: string | null;
  cuil: string | null;
  telefono: string | null;
  email: string | null;
  cliente: string | null;
  sucursal: string | null;
  unidad: string | null;
  unidadDetalle: string | null;
  patente: string | null;
  agente: string | null;
  agenteId: number | null;
  fechaAlta: string | null;
};

type ReclamoTransportistaSummary = {
  id: number | null;
  nombre: string | null;
  cliente?: string | null;
  patente?: string | null;
  unidad?: string | null;
};

type ReclamoTransportistaDetail = {
  id: number;
  nombreCompleto: string | null;
  cuil: string | null;
  telefono: string | null;
  email: string | null;
  cliente: string | null;
  sucursal: string | null;
  unidad: string | null;
  unidadDetalle: string | null;
  patente: string | null;
  agente: string | null;
  agenteId: number | null;
  fechaAlta: string | null;
};

type ReclamoHistoryItem = {
  id: string;
  type: 'status_change' | 'comment';
  message: string | null;
  oldStatus?: string | null;
  oldStatusLabel?: string | null;
  newStatus?: string | null;
  newStatusLabel?: string | null;
  actor?: string | null;
  actorId?: number | null;
  author?: string | null;
  authorId?: number | null;
  meta?: unknown;
  timestamp?: string | null;
  timestampLabel?: string | null;
};

type ReclamoDocumentItem = {
  id: number;
  nombre: string | null;
  downloadUrl: string | null;
  mime: string | null;
  size: number | null;
  uploadedAt: string | null;
  uploadedAtLabel: string | null;
};

const TRANSPORTISTA_CACHE_KEY_PREFIX = 'reclamo-transportistas-';

const getTransportistaCacheKey = (reclamoId: number) => `${TRANSPORTISTA_CACHE_KEY_PREFIX}${reclamoId}`;

const loadTransportistasFromCache = (reclamoId: number): ReclamoTransportistaSummary[] | undefined => {
  try {
    const raw = sessionStorage.getItem(getTransportistaCacheKey(reclamoId));
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      sessionStorage.removeItem(getTransportistaCacheKey(reclamoId));
      return undefined;
    }

    return parsed as ReclamoTransportistaSummary[];
  } catch {
    return undefined;
  }
};

const persistTransportistasToCache = (reclamoId: number, transportistas: ReclamoTransportistaSummary[]) => {
  const key = getTransportistaCacheKey(reclamoId);
  if (transportistas.length === 0) {
    sessionStorage.removeItem(key);
    return;
  }

  try {
    sessionStorage.setItem(key, JSON.stringify(transportistas));
  } catch {
    // ignore storage failures
  }
};

type ReclamoDetail = ReclamoRecord & {
  history: ReclamoHistoryItem[];
  transportistaDetail: ReclamoTransportistaDetail | null;
  documents: ReclamoDocumentItem[];
};

type AuthUser = {
  id: number;
  name: string | null;
  email: string | null;
  role?: string | null;
};

type NotificationMetadata = {
  celebration?: boolean;
  celebration_title?: string | null;
  celebration_message?: string | null;
  celebration_detail?: string | null;
  persona_full_name?: string | null;
  agente_nombre?: string | null;
  [key: string]: unknown;
};

type NotificationRecord = {
  id: number;
  message: string | null;
  reclamoId: number | null;
  reclamoCodigo: string | null;
  reclamoEstado: string | null;
  personaId: number | null;
  personaNombre: string | null;
  workflowTaskId?: number | null;
  workflowTaskLabel?: string | null;
  readAt: string | null;
  createdAt: string | null;
  createdAtLabel?: string | null;
  metadata?: NotificationMetadata | null;
};

type ChatContact = {
  id: number;
  name: string;
  role: string;
  client?: string | null;
  status: 'online' | 'away' | 'offline';
  lastSeen: string;
  lastMessage: string;
  lastMessageAt?: string | null;
  avatar?: string | null;
  unread?: number;
};

type ChatMessage = {
  id: string;
  author: 'self' | 'contact';
  text: string;
  timestamp: string;
  imageData?: string | null;
  imageName?: string | null;
};

type StoredChatMessage = {
  id: string;
  senderId: number | null;
  recipientId: number | null;
  text: string;
  timestamp: string;
  imageData?: string | null;
  imageName?: string | null;
};

type GeneralInfoEntry = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  authorId: number | null;
  authorName: string | null;
  authorRole: string | null;
  imageData?: string | null;
  imageAlt?: string | null;
};

type EditableSucursal = {
  id: number | null;
  nombre: string;
  direccion: string;
  key: string;
};

const resolveApiBaseUrl = (): string => {
  return process.env.REACT_APP_API_BASE || 'https://apibasepersonal.distriapp.com.ar';
};


const uniqueKey = () => Math.random().toString(36).slice(2);

const readAuthUserFromStorage = (): AuthUser | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem('authUser') ?? window.sessionStorage.getItem('authUser');
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

const useStoredAuthUser = (): AuthUser | null => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => readAuthUserFromStorage());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncAuthUser = () => {
      setAuthUser(readAuthUserFromStorage());
    };

    const listener = syncAuthUser as EventListener;

    window.addEventListener('storage', syncAuthUser);
    window.addEventListener('auth:updated', listener);

    return () => {
      window.removeEventListener('storage', syncAuthUser);
      window.removeEventListener('auth:updated', listener);
    };
  }, []);

  return authUser;
};

const ATTENDANCE_RECORD_KEY = 'attendanceRecord';
const ATTENDANCE_LOG_KEY = 'attendanceLog';
const LOCAL_SOLICITUDES_STORAGE_KEY = 'approvals:localSolicitudes';
const GENERAL_INFO_STORAGE_KEY = 'generalInfo:entries';
const GENERAL_INFO_UPDATED_EVENT = 'general-info:updated';
const CHAT_LOG_STORAGE_KEY = 'dashboard-chat:log';
const CHAT_BADGE_STORAGE_KEY = 'dashboard-chat:badge';
const CHAT_BADGE_UPDATED_EVENT = 'dashboard-chat:badge-updated';
const CHAT_LAST_READ_STORAGE_KEY = 'dashboard-chat:last-read';
const CHAT_LAST_READ_UPDATED_EVENT = 'dashboard-chat:last-read-updated';

const buildChatStorageKey = (base: string, userId: number | null): string => {
  const suffix = userId != null ? userId.toString() : 'anon';
  return `${base}:${suffix}`;
};

const DEFAULT_GENERAL_INFO_ENTRIES: GeneralInfoEntry[] = [
  {
    id: 'seed-general-info-1',
    title: 'Bienvenidos al nuevo panel',
    body:
      'Usá este espacio para compartir recordatorios y novedades con tu equipo. ' +
      'La información que publiques acá será visible para todos los usuarios.',
    createdAt: '2024-03-10T12:00:00.000Z',
    authorId: null,
    authorName: 'Equipo Logística Argentina',
    authorRole: 'Sistema',
    imageData: null,
    imageAlt: null,
  },
  {
    id: 'seed-general-info-2',
    title: 'Recomendación semanal',
    body:
      'Recordá mantener actualizada la información de tus clientes y sucursales. ' +
      'Esto nos ayuda a planificar rutas de forma más precisa.',
    createdAt: '2024-03-17T15:30:00.000Z',
    authorId: null,
    authorName: 'Coordinación Operativa',
    authorRole: 'Sistema',
    imageData: null,
    imageAlt: null,
  },
];

const cloneGeneralInfoEntries = (entries: GeneralInfoEntry[]): GeneralInfoEntry[] =>
  entries.map((entry) => ({ ...entry }));

const readGeneralInfoEntriesFromStorage = (): GeneralInfoEntry[] => {
  if (typeof window === 'undefined') {
    return cloneGeneralInfoEntries(DEFAULT_GENERAL_INFO_ENTRIES);
  }

  const raw = window.localStorage.getItem(GENERAL_INFO_STORAGE_KEY);
  if (!raw) {
    return cloneGeneralInfoEntries(DEFAULT_GENERAL_INFO_ENTRIES);
  }

  try {
    const parsed = JSON.parse(raw) as GeneralInfoEntry[];
    if (!Array.isArray(parsed)) {
      return cloneGeneralInfoEntries(DEFAULT_GENERAL_INFO_ENTRIES);
    }
    return cloneGeneralInfoEntries(parsed);
  } catch {
    return cloneGeneralInfoEntries(DEFAULT_GENERAL_INFO_ENTRIES);
  }
};

const persistGeneralInfoEntriesToStorage = (entries: GeneralInfoEntry[]): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(GENERAL_INFO_STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(GENERAL_INFO_UPDATED_EVENT));
};

const deriveAttendanceUserKey = (authUser: AuthUser | null): string | null => {
  if (!authUser) {
    return null;
  }

  if (authUser.id != null) {
    return `id-${authUser.id}`;
  }

  const normalizedName = authUser.name?.trim().toLowerCase();
  if (normalizedName && normalizedName.length > 0) {
    return `name-${normalizedName}`;
  }

  const normalizedEmail = authUser.email?.trim().toLowerCase();
  if (normalizedEmail && normalizedEmail.length > 0) {
    return `email-${normalizedEmail}`;
  }

  return null;
};

const readAttendanceStore = (): Record<string, AttendanceRecord> => {
  if (typeof window === 'undefined') {
    return {};
  }
  const raw = window.localStorage.getItem(ATTENDANCE_RECORD_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    const entries = Object.entries(parsed)
      .filter((entry): entry is [string, AttendanceRecord] => {
        if (!Array.isArray(entry) || entry.length !== 2) {
          return false;
        }

        const value = entry[1] as Partial<AttendanceRecord> | undefined;
        if (!value) {
          return false;
        }

        const { status, timestamp } = value;

        return (
          (status === 'entrada' || status === 'salida') &&
          typeof timestamp === 'string'
        );
      })
      .map(([key, record]) => {
        const normalized: AttendanceRecord = {
          ...record,
          userKey: buildAttendanceUserKey(record),
        };
        return [key, normalized] as [string, AttendanceRecord];
      });
    return Object.fromEntries(entries);
  } catch {
    // ignore corrupted storage
  }
  return {};
};

const writeAttendanceStore = (store: Record<string, AttendanceRecord>) => {
  if (typeof window === 'undefined') {
    return;
  }
  const keys = Object.keys(store);
  if (keys.length === 0) {
    window.localStorage.removeItem(ATTENDANCE_RECORD_KEY);
    return;
  }
  const payload = keys.reduce<Record<string, AttendanceRecord>>((acc, key) => {
    const record = store[key];
    acc[key] = {
      ...record,
      userKey: buildAttendanceUserKey(record),
    };
    return acc;
  }, {});
  window.localStorage.setItem(ATTENDANCE_RECORD_KEY, JSON.stringify(payload));
};

const removeAttendanceRecordFromStorage = (userKey: string | null | undefined) => {
  if (!userKey) {
    return;
  }
  const store = readAttendanceStore();
  if (!store[userKey]) {
    return;
  }
  delete store[userKey];
  writeAttendanceStore(store);
};

const persistAttendanceRecord = (record: AttendanceRecord) => {
  const userKey = record.userKey ?? buildAttendanceUserKey(record);
  const store = readAttendanceStore();
  store[userKey] = {
    ...record,
    userKey,
  };
  writeAttendanceStore(store);
};

const readAttendanceRecordFromStorage = (expectedUserKey?: string | null): AttendanceRecord | null => {
  if (!expectedUserKey) {
    return null;
  }
  const store = readAttendanceStore();
  const record = store[expectedUserKey];
  if (!record) {
    return null;
  }
  return {
    ...record,
    userKey: buildAttendanceUserKey(record),
  };
};

const clearAttendanceStore = () => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(ATTENDANCE_RECORD_KEY);
};

const readAttendanceLogFromStorage = (): AttendanceRecord[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  const raw = window.localStorage.getItem(ATTENDANCE_LOG_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter(
          (item): item is AttendanceRecord =>
            item && (item.status === 'entrada' || item.status === 'salida') && typeof item.timestamp === 'string'
        )
        .map((item) => ({
          ...item,
          userKey: buildAttendanceUserKey(item),
        }));
    }
  } catch {
    // ignore
  }
  return [];
};

const appendAttendanceLog = (record: AttendanceRecord) => {
  if (typeof window === 'undefined') {
    return;
  }
  const current = readAttendanceLogFromStorage();
  const normalized: AttendanceRecord = {
    ...record,
    userKey: buildAttendanceUserKey(record),
  };
  current.push(normalized);
  const trimmed = current.slice(-200);
  window.localStorage.setItem(ATTENDANCE_LOG_KEY, JSON.stringify(trimmed));
};

const readStoredChatMessages = (currentUserId: number | null): StoredChatMessage[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(buildChatStorageKey(CHAT_LOG_STORAGE_KEY, currentUserId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as StoredChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistStoredChatMessages = (messages: StoredChatMessage[], currentUserId: number | null) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(
    buildChatStorageKey(CHAT_LOG_STORAGE_KEY, currentUserId),
    JSON.stringify(messages)
  );
};

const readChatLastRead = (currentUserId: number | null): Record<number, string> => {
  if (typeof window === 'undefined') {
    return {};
  }
  const raw = window.localStorage.getItem(buildChatStorageKey(CHAT_LAST_READ_STORAGE_KEY, currentUserId));
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.entries(parsed).reduce<Record<number, string>>((acc, [key, value]) => {
      const contactId = Number(key);
      if (!Number.isFinite(contactId) || typeof value !== 'string') {
        return acc;
      }
      acc[contactId] = value;
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const persistChatLastRead = (record: Record<number, string>, currentUserId: number | null) => {
  if (typeof window === 'undefined') {
    return;
  }
  const normalized = Object.entries(record).reduce<Record<string, string>>((acc, [key, value]) => {
    const contactId = Number(key);
    if (!Number.isFinite(contactId) || typeof value !== 'string') {
      return acc;
    }
    acc[contactId.toString()] = value;
    return acc;
  }, {});
  window.localStorage.setItem(
    buildChatStorageKey(CHAT_LAST_READ_STORAGE_KEY, currentUserId),
    JSON.stringify(normalized)
  );
  window.dispatchEvent(new CustomEvent(CHAT_LAST_READ_UPDATED_EVENT));
};

const computeUnreadForConversation = (
  conversation: ChatMessage[],
  contactId: number,
  lastReadMap: Record<number, string>
): number => {
  const lastRead = lastReadMap[contactId];
  const lastReadTime = lastRead ? Date.parse(lastRead) : null;
  return conversation.reduce((acc, message) => {
    if (message.author !== 'contact') {
      return acc;
    }
    if (!message.timestamp) {
      return acc;
    }
    const messageTime = Date.parse(message.timestamp);
    if (Number.isNaN(messageTime)) {
      return acc;
    }
    if (lastReadTime !== null && messageTime <= lastReadTime) {
      return acc;
    }
    return acc + 1;
  }, 0);
};

const readStoredChatBadge = (currentUserId: number | null): number => {
  if (typeof window === 'undefined') {
    return 0;
  }
  const raw = window.localStorage.getItem(buildChatStorageKey(CHAT_BADGE_STORAGE_KEY, currentUserId));
  if (!raw) {
    return 0;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.floor(parsed));
};

const persistStoredChatBadge = (messages: StoredChatMessage[], currentUserId: number | null) => {
  if (typeof window === 'undefined') {
    return;
  }
  if (currentUserId == null) {
    const key = buildChatStorageKey(CHAT_BADGE_STORAGE_KEY, currentUserId);
    window.localStorage.setItem(key, '0');
    window.dispatchEvent(new CustomEvent(CHAT_BADGE_UPDATED_EVENT, { detail: { value: 0, userId: null } }));
    return;
  }
  const lastReadMap = readChatLastRead(currentUserId);
  const count = messages.reduce((acc, entry) => {
    if (entry.recipientId !== currentUserId) {
      return acc;
    }
    if (entry.senderId == null || entry.senderId === currentUserId) {
      return acc;
    }
    const senderId = entry.senderId;
    const lastRead = senderId != null ? lastReadMap[senderId] : null;
    if (lastRead && entry.timestamp) {
      const lastReadTime = Date.parse(lastRead);
      const entryTime = Date.parse(entry.timestamp);
      if (!Number.isNaN(lastReadTime) && !Number.isNaN(entryTime) && entryTime <= lastReadTime) {
        return acc;
      }
    }
    return acc + 1;
  }, 0);
  const normalized = Math.max(0, Math.floor(count));
  const key = buildChatStorageKey(CHAT_BADGE_STORAGE_KEY, currentUserId);
  window.localStorage.setItem(key, normalized.toString());
  window.dispatchEvent(
    new CustomEvent(CHAT_BADGE_UPDATED_EVENT, {
      detail: { value: normalized, userId: currentUserId },
    })
  );
};

const appendStoredChatMessage = (entry: StoredChatMessage, currentUserId: number | null) => {
  const log = readStoredChatMessages(currentUserId);
  log.push(entry);
  const trimmed = log.slice(-500);
  persistStoredChatMessages(trimmed, currentUserId);
  persistStoredChatBadge(trimmed, currentUserId);
};

const computeInitials = (value: string | null | undefined): string => {
  if (!value) {
    return 'US';
  }

  const cleaned = value.trim();
  if (cleaned.length === 0) {
    return 'US';
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const firstWord = words[0];
    return firstWord.slice(0, 2).toUpperCase();
  }

  const first = words[0]?.charAt(0) ?? '';
  const second = words[1]?.charAt(0) ?? '';
  const initials = `${first}${second}`.trim();
  return initials.length > 0 ? initials.toUpperCase() : 'US';
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const ensureHtmlContent = (content: string): string => {
  if (!content) {
    return '';
  }
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return content;
  }
  const safeParagraphs = content
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`);
  return safeParagraphs.length > 0 ? safeParagraphs.join('') : `<p>${escapeHtml(content)}</p>`;
};

const truncateText = (text: string | null, maxLength: number): string => {
  if (!text) {
    return '—';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
};

const formatElapsedTime = (fromIso: string | null, toIso?: string | null): string => {
  if (!fromIso) {
    return '—';
  }

  const fromDate = new Date(fromIso);
  if (Number.isNaN(fromDate.getTime())) {
    return '—';
  }

  const target = toIso ? new Date(toIso) : new Date();
  if (Number.isNaN(target.getTime())) {
    return '—';
  }

  const diffMs = Math.max(0, target.getTime() - fromDate.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(diffMinutes / (60 * 24));
  const hours = Math.floor((diffMinutes - days * 24 * 60) / 60);
  const minutes = diffMinutes - days * 24 * 60 - hours * 60;

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 && parts.length < 2) {
    parts.push(`${minutes}m`);
  }

  return parts.length > 0 ? parts.join(' ') : '0m';
};

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (Number.isNaN(numeric)) {
    return '—';
  }

  return currencyFormatter.format(numeric);
};

const CELEBRATION_DISMISSED_STORAGE_KEY = 'celebrations:dismissed';
let cachedDismissedCelebrations: number[] | null = null;

const getDismissedCelebrations = (): number[] => {
  if (cachedDismissedCelebrations) {
    return cachedDismissedCelebrations;
  }

  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CELEBRATION_DISMISSED_STORAGE_KEY);
    if (!raw) {
      cachedDismissedCelebrations = [];
      return cachedDismissedCelebrations;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      cachedDismissedCelebrations = [];
      return cachedDismissedCelebrations;
    }
    cachedDismissedCelebrations = parsed
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value));
    return cachedDismissedCelebrations;
  } catch {
    cachedDismissedCelebrations = [];
    return cachedDismissedCelebrations;
  }
};

const persistDismissedCelebrations = (values: number[]) => {
  cachedDismissedCelebrations = values;
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(CELEBRATION_DISMISSED_STORAGE_KEY, JSON.stringify(values));
  } catch {
    // ignore storage errors
  }
};

const markCelebrationAsDismissed = (id: number | null | undefined) => {
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    return;
  }
  const current = getDismissedCelebrations();
  if (current.includes(id)) {
    return;
  }
  persistDismissedCelebrations([...current, id]);
};

const hasCelebrationBeenDismissed = (id: number): boolean => {
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    return false;
  }
  return getDismissedCelebrations().includes(id);
};

const resetCelebrationDismissedCache = () => {
  cachedDismissedCelebrations = null;
};


const escapeCsvValue = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) {
    return '""';
  }
  const stringValue = String(value);
  if (/["\n,]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const downloadCsv = (filename: string, rows: Array<Array<string | number | null | undefined>>) => {
  const csv = rows.map((row) => row.map((value) => escapeCsvValue(value)).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const buildAttendanceUserKey = (record: AttendanceRecord): string => {
  if (record.userKey && record.userKey.trim().length > 0) {
    return record.userKey.trim();
  }
  if (record.userId != null) {
    return `id-${record.userId}`;
  }
  const normalizedName = (record.userName ?? '').trim().toLowerCase();
  if (normalizedName.length > 0) {
    return `name-${normalizedName}`;
  }
  return 'anon';
};

const mapRemoteAttendance = (items: RemoteAttendanceApiRecord[]): AttendanceRecord[] => {
  return items
    .filter((item) => typeof item.recordedAt === 'string' && item.recordedAt.length > 0)
    .map((item) => ({
      status: item.status,
      timestamp: item.recordedAt as string,
      userId: item.userId ?? null,
      userName: item.userName ?? null,
      userKey: item.userId != null ? `id-${item.userId}` : undefined,
    }));
};

const formatMonthValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const formatDurationFromMs = (ms: number): string => {
  if (ms <= 0) {
    return '0m';
  }
  const base = new Date(0).toISOString();
  const target = new Date(ms).toISOString();
  return formatElapsedTime(base, target);
};

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setLoading(true);
      setLoginError(null);

      const response = await fetch(`${apiBaseUrl}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
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

      const payload = (await response.json()) as {
        message?: string;
        data: {
          id: number;
          name: string | null;
          email: string | null;
          role?: string | null;
        };
      };

      const storage = rememberMe ? window.localStorage : window.sessionStorage;
      const otherStorage = rememberMe ? window.sessionStorage : window.localStorage;
      const authPayload: AuthUser = {
        id: payload.data.id,
        name: payload.data.name ?? null,
        email: payload.data.email ?? null,
        role: payload.data.role ?? null,
      };
      storage.setItem('authUser', JSON.stringify(authPayload));
      otherStorage.removeItem('authUser');
      window.dispatchEvent(new CustomEvent('auth:updated'));

      navigate('/clientes', { replace: true });
    } catch (err) {
      setLoginError((err as Error).message ?? 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <img src="/logo-empresa.png" alt="Logo de la empresa" className="brand-logo" />
        </div>

        <div className="login-content">
          <header className="login-header">
            <h1>Iniciar sesión</h1>
            <p>Ingresa los datos para poder comenzar tu logística.</p>
          </header>

          <form className="login-form" onSubmit={handleSubmit}>
            {loginError ? <p className="form-info form-info--error">{loginError}</p> : null}
            <label className="field">
              <span className="field-label">Email</span>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Ingresa tu email"
                autoComplete="email"
                required
                disabled={loading}
              />
            </label>

            <label className="field">
              <span className="field-label">Contraseña</span>
              <input
                type="password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </label>

            <div className="form-meta">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  disabled={loading}
                />
                <span>¿Acuérdate de mí?</span>
              </label>

              <a className="forgot-password" href="#recuperar">
                Olvidé mi contraseña
              </a>
            </div>

            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </section>

      <section className="promo-panel">
        <div className="promo-decoration promo-decoration--top-left" />
        <div className="promo-decoration promo-decoration--top-right" />
        <div className="promo-decoration promo-decoration--bottom-left" />
        <div className="promo-decoration promo-decoration--bottom-right" />

        <div className="promo-content">
          <img src="/logo-empresa.png" alt="Logo de la empresa" className="promo-logo" />
          <h2>Panel de control fácil de usar para administrar su negocio.</h2>
          <p>
            Optimice la gestión de su negocio con nuestro panel de control
            intuitivo. Simplifique tareas complejas, monitoree métricas clave y
            tome decisiones informadas sin esfuerzo.
          </p>
        </div>
      </section>
    </main>
  );
};

const DashboardLayout: React.FC<{
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, headerContent, children }) => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => readAuthUserFromStorage());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatBadgeCount, setChatBadgeCount] = useState(() => readStoredChatBadge(authUser?.id ?? null));
  const [notificationsVersion, setNotificationsVersion] = useState(0);
  const [notificationToast, setNotificationToast] = useState<{ id: number; message: string; detail?: string | null } | null>(null);
  const notificationToastTimeoutRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastToastIdRef = useRef<number | null>(null);
  const unreadInitializedRef = useRef(false);
  const previousUnreadCountRef = useRef(0);
  const previousLatestNotificationIdRef = useRef<number | null>(null);
  const previousLatestNotificationTimestampRef = useRef<number | null>(null);
  const [celebration, setCelebration] = useState<{ title: string; message: string; detail?: string | null; notificationId?: number } | null>(null);
  const [fireworks, setFireworks] = useState<Array<{ id: number; left: number; top: number; delay: number; duration: number; color: string }>>([]);
  const celebrationTimeoutRef = useRef<number | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [attendanceRecord, setAttendanceRecord] = useState<AttendanceRecord | null>(() => {
    const storedUser = readAuthUserFromStorage();
    return readAttendanceRecordFromStorage(deriveAttendanceUserKey(storedUser));
  });
  const currentUserKey = useMemo(() => deriveAttendanceUserKey(authUser), [authUser]);
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebarVisibility = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);
  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);
  useEffect(() => {
    closeSidebar();
  }, [location.pathname, closeSidebar]);
  useEffect(() => {
    setAuthUser(readAuthUserFromStorage());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleAuthUpdate = () => {
      setAuthUser(readAuthUserFromStorage());
    };

    const listener = handleAuthUpdate as EventListener;

    window.addEventListener('auth:updated', listener);
    window.addEventListener('storage', listener);

    return () => {
      window.removeEventListener('auth:updated', listener);
      window.removeEventListener('storage', listener);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleBadgeStorage = (event: Event) => {
      const custom = event as CustomEvent<{ value?: number; userId?: number | null }>;
      if (custom.detail?.userId !== authUser?.id) {
        return;
      }
      setChatBadgeCount(
        custom.detail?.value ?? readStoredChatBadge(authUser?.id ?? null)
      );
    };
    window.addEventListener(CHAT_BADGE_UPDATED_EVENT, handleBadgeStorage);
    return () => {
      window.removeEventListener(CHAT_BADGE_UPDATED_EVENT, handleBadgeStorage);
    };
  }, [authUser?.id]);

  useEffect(() => {
    setChatBadgeCount(readStoredChatBadge(authUser?.id ?? null));
  }, [authUser?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleStorageEvent = (event: StorageEvent) => {
      if (
        event.key === buildChatStorageKey(CHAT_BADGE_STORAGE_KEY, authUser?.id ?? null)
      ) {
        setChatBadgeCount(readStoredChatBadge(authUser?.id ?? null));
      }
    };
    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [authUser?.id]);

  const currentActorId = useMemo(() => (authUser?.id != null ? Number(authUser.id) : null), [authUser?.id]);

  useEffect(() => {
    if (currentActorId == null) {
      return;
    }

    if (!currentUserKey) {
      return;
    }

    let cancelled = false;

    const syncLatestAttendance = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/attendance?userId=${currentActorId}&limit=1`);

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data?: RemoteAttendanceApiRecord[] };
        const remoteRecords = payload.data ? mapRemoteAttendance(payload.data) : [];
        const latest = remoteRecords[0] ?? null;

        if (cancelled) {
          return;
        }

        if (!latest) {
          setAttendanceRecord(null);
          removeAttendanceRecordFromStorage(currentUserKey);
          return;
        }

        setAttendanceRecord((prev) => {
          if (
            prev &&
            prev.status === latest.status &&
            prev.timestamp === latest.timestamp &&
            prev.userId === latest.userId
          ) {
            return prev;
          }

          return {
            ...latest,
            userKey: currentUserKey,
          };
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('No se pudo sincronizar el estado de asistencia actual', err);
      }
    };

    syncLatestAttendance();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, authUser?.id, currentUserKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleStorage = () => {
      resetCelebrationDismissedCache();
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (notificationToastTimeoutRef.current) {
        window.clearTimeout(notificationToastTimeoutRef.current);
      }
      if (celebrationTimeoutRef.current) {
        window.clearTimeout(celebrationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!currentUserKey) {
      return;
    }
    if (attendanceRecord) {
      persistAttendanceRecord({
        ...attendanceRecord,
        userKey: currentUserKey,
      });
    } else {
      removeAttendanceRecordFromStorage(currentUserKey);
    }
  }, [attendanceRecord, currentUserKey]);

  const playNotificationTone = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        const AudioContextConstructor =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextConstructor) {
          return;
        }
        audioContextRef.current = new AudioContextConstructor();
      }

      const context = audioContextRef.current;
      if (!context) {
        return;
      }

      const startTone = () => {
        const now = context.currentTime;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.1, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.65);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      };

      if (context.state === 'suspended') {
        context
          .resume()
          .then(() => {
            startTone();
          })
          .catch(() => {
            // ignore resume errors (likely due to missing user gesture)
          });
        return;
      }

      startTone();
    } catch {
      // ignore audio playback issues
    }
  }, []);

  const playCelebrationTone = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        const AudioContextConstructor =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextConstructor) {
          return;
        }
        audioContextRef.current = new AudioContextConstructor();
      }

      const context = audioContextRef.current;
      if (!context) {
        return;
      }

      const schedule = () => {
        const sequence = [
          { freq: 523.25, duration: 0.22, type: 'sine' },
          { freq: 587.33, duration: 0.18, type: 'sine' },
          { freq: 659.25, duration: 0.22, type: 'triangle' },
          { freq: 783.99, duration: 0.26, type: 'triangle' },
          { freq: 880.0, duration: 0.32, type: 'sine' },
        ];

        let start = context.currentTime;

        sequence.forEach((note, index) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = note.type as OscillatorType;
          oscillator.frequency.setValueAtTime(note.freq, start);
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(0.12, start + 0.06);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(start);
          oscillator.stop(start + note.duration + 0.05);
          oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
          };

          start += note.duration * (index < sequence.length - 1 ? 0.7 : 1);
        });
      };

      if (context.state === 'suspended') {
        context
          .resume()
          .then(() => {
            schedule();
          })
          .catch(() => {
            // ignore resume errors
          });
        return;
      }

      schedule();
    } catch {
      // ignore celebration tone issues
    }
  }, []);

  const closeCelebration = useCallback(() => {
    if (celebrationTimeoutRef.current) {
      window.clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = null;
    }

    if (celebration?.notificationId != null) {
      markCelebrationAsDismissed(celebration.notificationId);
    }

    setCelebration(null);
    setFireworks([]);
  }, [celebration]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ title?: string; message?: string; detail?: string | null; notificationId?: number }>;
      const detail = custom.detail ?? {};
      const colors = ['#ff6b81', '#f7b731', '#4cd4b0', '#778beb', '#a55eea', '#ff9f43'];
      const bursts = Array.from({ length: 12 }).map((_, index) => ({
        id: Date.now() + index,
        left: 5 + Math.random() * 90,
        top: 10 + Math.random() * 60,
        delay: Math.random() * 0.7,
        duration: 1.4 + Math.random() * 0.8,
        color: colors[index % colors.length],
      }));

      if (celebrationTimeoutRef.current) {
        window.clearTimeout(celebrationTimeoutRef.current);
        celebrationTimeoutRef.current = null;
      }

      setFireworks(bursts);
      setCelebration({
        title: detail.title ?? '¡Felicitaciones!',
        message: detail.message ?? '¡Gran trabajo, la solicitud fue aprobada con éxito!',
        detail: detail.detail ?? null,
        notificationId: detail.notificationId,
      });

      playCelebrationTone();

      celebrationTimeoutRef.current = window.setTimeout(() => {
        closeCelebration();
      }, 7000);
    };

    window.addEventListener('celebration:trigger', handler as EventListener);
    return () => {
      window.removeEventListener('celebration:trigger', handler as EventListener);
      if (celebrationTimeoutRef.current) {
        window.clearTimeout(celebrationTimeoutRef.current);
        celebrationTimeoutRef.current = null;
      }
    };
  }, [closeCelebration, playCelebrationTone]);

  useEffect(() => {
    if (!celebration) {
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCelebration();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [celebration, closeCelebration]);

  const showNotificationToast = useCallback(
    async (record: NotificationRecord) => {
      if (lastToastIdRef.current === record.id) {
        return;
      }

      let personaLabel = record.personaNombre?.trim().length ? record.personaNombre?.trim() ?? null : null;
      const metadata = record.metadata ?? null;

      if (
        (!personaLabel || personaLabel.length === 0) &&
        typeof metadata?.persona_full_name === 'string' &&
        metadata.persona_full_name.trim().length > 0
      ) {
        personaLabel = metadata.persona_full_name.trim();
      }

      if ((!personaLabel || personaLabel.length === 0) && record.personaId) {
        try {
          const response = await fetch(`${apiBaseUrl}/api/personal/${record.personaId}`);
          if (response.ok) {
            const payload = (await response.json()) as {
              data?: { nombres?: string | null; apellidos?: string | null };
            };
            const nombres = payload.data?.nombres?.trim() ?? '';
            const apellidos = payload.data?.apellidos?.trim() ?? '';
            const combined = [nombres, apellidos].filter(Boolean).join(' ');
            personaLabel = combined.length > 0 ? combined : null;
          }
        } catch {
          // ignore lookup errors
        }
      }

      const metadataMessage =
        typeof metadata?.celebration_message === 'string' && metadata.celebration_message.trim().length > 0
          ? metadata.celebration_message.trim()
          : null;

      const recordMessage =
        typeof record.message === 'string' && record.message.trim().length > 0 ? record.message.trim() : null;

      const baseMessage = metadataMessage ?? recordMessage;
      const shouldShowDetail = personaLabel
        ? !baseMessage || !baseMessage.toLowerCase().includes(personaLabel.toLowerCase())
        : false;
      const defaultDetail = shouldShowDetail && personaLabel ? `Responsable: ${personaLabel}` : null;

      const metadataDetail =
        typeof metadata?.celebration_detail === 'string' && metadata.celebration_detail.trim().length > 0
          ? metadata.celebration_detail.trim()
          : null;

      const finalMessage =
        baseMessage ?? (personaLabel ? `Llegó una notificación de ${personaLabel}.` : 'Llegó una nueva notificación.');
      const finalDetail = metadataDetail ?? defaultDetail;

      lastToastIdRef.current = record.id;
      setNotificationToast({ id: record.id, message: finalMessage, detail: finalDetail });

      playNotificationTone();
      if (notificationToastTimeoutRef.current) {
        window.clearTimeout(notificationToastTimeoutRef.current);
      }
      notificationToastTimeoutRef.current = window.setTimeout(() => {
        setNotificationToast(null);
        notificationToastTimeoutRef.current = null;
      }, 6000);
    },
    [apiBaseUrl, playNotificationTone]
  );

  const formattedClock = useMemo(
    () =>
      currentTime.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
    [currentTime]
  );

  const formattedAttendance = useMemo(() => {
    if (!attendanceRecord) {
      return 'Fuera del horario laboral';
    }

    if (attendanceRecord.status === 'entrada') {
      const workedTime = formatElapsedTime(attendanceRecord.timestamp, currentTime.toISOString());
      return `En horario laboral · ${workedTime}`;
    }

    const timestamp = new Date(attendanceRecord.timestamp);
    const dateLabel = timestamp.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const timeLabel = timestamp.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return `Última salida registrada · ${dateLabel} ${timeLabel}`;
  }, [attendanceRecord, currentTime]);

  const isWorking = attendanceRecord?.status === 'entrada';
  const entryButtonClassName = 'time-button time-button--in';
  const exitButtonClassName = 'time-button time-button--active-out';

  const displayName = useMemo(() => {
    if (authUser?.name && authUser.name.trim().length > 0) {
      return authUser.name.trim();
    }

    if (authUser?.email) {
      return authUser.email;
    }

    return 'Usuario invitado';
  }, [authUser]);

  const roleLabel = useMemo(() => {
    return formatRoleLabel(authUser?.role);
  }, [authUser]);

  const isAdmin = useMemo(() => {
    const normalized = authUser?.role?.toLowerCase() ?? '';
    return normalized.includes('admin');
  }, [authUser?.role]);

  const avatarInitials = useMemo(
    () => computeInitials(authUser?.name ?? authUser?.email),
    [authUser?.name, authUser?.email]
  );

  useEffect(() => {
    if (!currentUserKey) {
      setAttendanceRecord(null);
      return;
    }

    setAttendanceRecord(readAttendanceRecordFromStorage(currentUserKey));
  }, [currentUserKey]);

  useEffect(() => {
    const handler = (event: Event) => {
      setNotificationsVersion((value) => value + 1);
      const custom = event as CustomEvent<{ notification?: NotificationRecord | null }>;
      if (custom.detail?.notification) {
        void showNotificationToast(custom.detail.notification);
      }
    };
    window.addEventListener('notifications:updated', handler as EventListener);
    return () => window.removeEventListener('notifications:updated', handler as EventListener);
  }, [showNotificationToast]);

  useEffect(() => {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextConstructor) {
      return;
    }

    let disposed = false;

    const ensureAudioContext = () => {
      if (disposed) {
        return;
      }

      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new AudioContextConstructor();
        } catch {
          return;
        }
      }

      const context = audioContextRef.current;
      if (!context) {
        return;
      }

      if (context.state === 'suspended') {
        context
          .resume()
          .then(() => {
            if (disposed) {
              return;
            }
            document.removeEventListener('pointerdown', ensureAudioContext);
            document.removeEventListener('keydown', ensureAudioContext);
          })
          .catch(() => {
            // keep listeners to retry on next user interaction
          });
        return;
      }

      document.removeEventListener('pointerdown', ensureAudioContext);
      document.removeEventListener('keydown', ensureAudioContext);
    };

    document.addEventListener('pointerdown', ensureAudioContext);
    document.addEventListener('keydown', ensureAudioContext);

    // Attempt initialization for browsers that do not require a user gesture.
    ensureAudioContext();

    return () => {
      disposed = true;
      document.removeEventListener('pointerdown', ensureAudioContext);
      document.removeEventListener('keydown', ensureAudioContext);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {
          /* ignore close errors */
        });
        audioContextRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<AttendanceRecord | null | undefined>;
      if (custom.detail !== undefined) {
        if (custom.detail === null) {
          setAttendanceRecord(null);
          removeAttendanceRecordFromStorage(currentUserKey);
          return;
        }

        if (!currentUserKey || custom.detail.userKey !== currentUserKey) {
          return;
        }

        setAttendanceRecord(custom.detail);
        return;
      }

      if (!currentUserKey) {
        setAttendanceRecord(null);
        return;
      }

      setAttendanceRecord(readAttendanceRecordFromStorage(currentUserKey));
    };

    window.addEventListener('attendance:updated', handler as EventListener);
    return () => window.removeEventListener('attendance:updated', handler as EventListener);
  }, [currentUserKey]);

  useEffect(() => {
    if (!authUser?.id || authUser?.role) {
      return;
    }

    const controller = new AbortController();

    const fetchRole = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/usuarios/${authUser.id}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as {
          data?: { role?: string | null; name?: string | null; email?: string | null };
        };
        if (payload?.data?.role) {
          const updated: AuthUser = {
            id: authUser.id,
            name: payload.data.name ?? authUser.name ?? null,
            email: payload.data.email ?? authUser.email ?? null,
            role: payload.data.role,
          };
          setAuthUser(updated);
          try {
            const serialized = JSON.stringify(updated);
            const hasLocal = Boolean(window.localStorage.getItem('authUser'));
            const hasSession = Boolean(window.sessionStorage.getItem('authUser'));
            if (hasLocal) {
              window.localStorage.setItem('authUser', serialized);
            }
            if (hasSession || (!hasLocal && !hasSession)) {
              window.sessionStorage.setItem('authUser', serialized);
            }
            window.dispatchEvent(new CustomEvent('auth:updated'));
          } catch {
            // ignore storage errors
          }
        }
      } catch {
        // ignore network errors
      }
    };

    fetchRole();

    return () => controller.abort();
  }, [apiBaseUrl, authUser?.id, authUser?.role]);

  useEffect(() => {
    if (!authUser?.id) {
      setUnreadCount(0);
      unreadInitializedRef.current = false;
      previousUnreadCountRef.current = 0;
      setNotificationToast(null);
      previousLatestNotificationIdRef.current = null;
      previousLatestNotificationTimestampRef.current = null;
      lastToastIdRef.current = null;
      return;
    }

    let cancelled = false;
    let pollIntervalId: number | null = null;

    const fetchUnread = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/notificaciones?userId=${authUser.id}&onlyUnread=1`);

        if (!response.ok) {
          throw new Error(response.statusText);
        }

        const payload = (await response.json()) as { data: NotificationRecord[] };
        const sorted = [...payload.data].sort((a, b) => {
          const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
          const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
          return bTime - aTime;
        });

        if (cancelled) {
          return;
        }

        const count = sorted.length;
        setUnreadCount(count);

        const latestId = sorted.length > 0 ? sorted[0].id : null;
        let latestTimestamp: number | null = null;
        if (sorted.length > 0 && sorted[0].createdAt) {
          const parsed = Date.parse(sorted[0].createdAt);
          if (!Number.isNaN(parsed)) {
            latestTimestamp = parsed;
          }
        }

        if (!unreadInitializedRef.current) {
          unreadInitializedRef.current = true;
          previousUnreadCountRef.current = count;
          previousLatestNotificationIdRef.current = latestId;
          previousLatestNotificationTimestampRef.current = latestTimestamp;
          return;
        }

        const hadCountIncrease = count > previousUnreadCountRef.current;
        const hasNewerTimestamp =
          latestTimestamp !== null &&
          (previousLatestNotificationTimestampRef.current === null ||
            latestTimestamp > previousLatestNotificationTimestampRef.current);

        if (sorted.length > 0 && (hadCountIncrease || hasNewerTimestamp)) {
          await showNotificationToast(sorted[0]);
        }

        previousUnreadCountRef.current = count;
        previousLatestNotificationIdRef.current = latestId;
        previousLatestNotificationTimestampRef.current = latestTimestamp;
      } catch {
        if (cancelled) {
          return;
        }
        // ignore errors on header badge
      }
    };

    const runFetch = () => {
      void fetchUnread();
    };

    runFetch();
    pollIntervalId = window.setInterval(runFetch, 15000);

    return () => {
      cancelled = true;
      if (pollIntervalId !== null) {
        window.clearInterval(pollIntervalId);
      }
    };
  }, [apiBaseUrl, authUser?.id, notificationsVersion, showNotificationToast]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-chip') && !target.closest('.user-menu')) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => document.removeEventListener('click', handleClickOutside);
  }, [showUserMenu]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('authUser');
      window.sessionStorage.removeItem('authUser');
    }
    removeAttendanceRecordFromStorage(currentUserKey);
    setAttendanceRecord(null);
    setAuthUser(null);
    window.dispatchEvent(new CustomEvent('attendance:updated', { detail: null }));
    window.dispatchEvent(new CustomEvent('notifications:updated'));
    window.dispatchEvent(new CustomEvent('auth:updated'));
    window.location.href = '/';
  };

  const syncAttendanceRecord = useCallback(
    async (record: AttendanceRecord) => {
      try {
        await fetch(`${apiBaseUrl}/api/attendance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: record.status,
            timestamp: record.timestamp,
            userId: record.userId ?? null,
            userName: record.userName ?? null,
          }),
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('No se pudo sincronizar el registro de asistencia', err);
      }
    },
    [apiBaseUrl]
  );

  const handleMarkAttendance = (status: AttendanceRecord['status']) => {
    const currentlyWorking = attendanceRecord?.status === 'entrada';

    if (status === 'entrada' && currentlyWorking) {
      window.alert('Ya registraste la entrada. Marcá la salida cuando corresponda.');
      return;
    }

    if (status === 'salida' && !currentlyWorking) {
      window.alert('Todavía no registraste la entrada.');
      return;
    }

    if (!currentUserKey) {
      window.alert('No se pudo identificar al usuario actual.');
      return;
    }

    const confirmationMessage =
      status === 'entrada'
        ? '¿Estás seguro/a que querés registrar Entrada al horario laboral?'
        : '¿Estás seguro/a que querés registrar Salida del horario laboral?';

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    const operatorName =
      authUser?.name && authUser.name.trim().length > 0
        ? authUser.name.trim()
        : authUser?.email ?? 'Usuario';

    const record: AttendanceRecord = {
      status,
      timestamp: new Date().toISOString(),
      userId: authUser?.id ?? null,
      userName: operatorName,
      userKey: currentUserKey,
    };
    setAttendanceRecord(record);
    appendAttendanceLog(record);
    window.dispatchEvent(new CustomEvent('attendance:updated', { detail: record }));
    syncAttendanceRecord(record);
  };

  return (
    <>
      {celebration ? (
        <div className="celebration-overlay" role="alertdialog" aria-live="polite" onClick={closeCelebration}>
          <div className="celebration-fireworks">
            {fireworks.map((burst) => (
              <span
                key={burst.id}
                className="celebration-firework"
                style={{
                  left: `${burst.left}%`,
                  top: `${burst.top}%`,
                  animationDelay: `${burst.delay}s`,
                  animationDuration: `${burst.duration}s`,
                  background: `radial-gradient(circle, ${burst.color} 0%, rgba(255, 255, 255, 0) 70%)`,
                  boxShadow: '0 0 30px rgba(255, 255, 255, 0.6)',
                }}
              />
            ))}
          </div>
          <div
            className="celebration-card"
            role="document"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <h3>{celebration.title}</h3>
            <p>{celebration.message}</p>
            {celebration.detail ? <p className="celebration-card__detail">{celebration.detail}</p> : null}
            <button type="button" className="primary-action" onClick={closeCelebration}>
              ¡Genial!
            </button>
          </div>
        </div>
      ) : null}

      <div className={`dashboard-shell${isSidebarOpen ? ' is-sidebar-open' : ''}`}>
        <aside className="dashboard-sidebar">
          <button
            type="button"
            className="sidebar-close"
            aria-label="Cerrar menú"
            onClick={closeSidebar}
          >
            ×
          </button>
          <div className="sidebar-logo">
            <img src="/logo-empresa.png" alt="Logo de la empresa" className="brand-logo" />
          </div>

        <NavLink
          to="/informacion-general"
          className={({ isActive }) => `sidebar-info-card${isActive ? ' is-active' : ''}`}
        >
          <span className="sidebar-info-card__title">Información general</span>
        </NavLink>

        <nav className="sidebar-nav" onClick={closeSidebar}>
          <span className="sidebar-title">Acciones</span>
          <NavLink to="/clientes" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
            Gestión de clientes
          </NavLink>
          <NavLink to="/unidades" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
            Gestión de unidades
          </NavLink>
          {isAdmin ? (
            <NavLink to="/usuarios" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
              Gestión de usuarios
            </NavLink>
          ) : null}
          <NavLink to="/personal" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
            Personal
          </NavLink>
          <NavLink to="/reclamos" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
            Reclamos
          </NavLink>
          <NavLink to="/notificaciones" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
            Notificaciones
          </NavLink>
          {isAdmin ? (
            <NavLink to="/control-horario" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
              Control horario
            </NavLink>
          ) : null}
          <NavLink to="/flujo-trabajo" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
            Flujo de trabajo
          </NavLink>
          <NavLink to="/aprobaciones" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
            Aprobaciones/solicitudes
          </NavLink>
          <NavLink to="/liquidaciones" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
            Liquidaciones
          </NavLink>
          <a className="sidebar-link" href="#tarifas" onClick={(event) => event.preventDefault()}>
            Tarifas
          </a>
          <a className="sidebar-link" href="#bases" onClick={(event) => event.preventDefault()}>
            Bases de Distribución
          </a>

          <span className="sidebar-title">Sistema</span>
          <NavLink to="/documentos" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
            Documentos
          </NavLink>
          <a className="sidebar-link" href="#config" onClick={(event) => event.preventDefault()}>
            Configuración
          </a>
          <a className="sidebar-link" href="#ayuda" onClick={(event) => event.preventDefault()}>
            Ayuda
          </a>
        </nav>
      </aside>
      {isSidebarOpen ? (
        <div className="sidebar-backdrop" onClick={closeSidebar} aria-hidden="true" />
      ) : null}

      <main className="dashboard-content">
        <div className="mobile-controls">
          <button
            type="button"
            className="sidebar-toggle"
            aria-label="Alternar menú"
            onClick={toggleSidebarVisibility}
          >
            <span />
          </button>
          <div className="notification-anchor notification-anchor--mobile">
            <button
              className="topbar-button notification"
              type="button"
              aria-label="Notificaciones"
              onClick={() => navigate('/notificaciones')}
            >
              🔔
              {unreadCount > 0 ? (
                <span className="notification-count">{Math.min(unreadCount, 99)}</span>
              ) : null}
            </button>
            {notificationToast ? (
              <div className="notification-toast" role="status" aria-live="polite">
                <span className="notification-toast__icon" aria-hidden="true">🔔</span>
                <div className="notification-toast__content">
                  <strong>Nueva notificación</strong>
                  <p>{notificationToast.message}</p>
                  {notificationToast.detail ? (
                    <small className="notification-toast__detail">{notificationToast.detail}</small>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="notification-toast__close"
                  onClick={() => {
                    if (notificationToastTimeoutRef.current) {
                      window.clearTimeout(notificationToastTimeoutRef.current);
                      notificationToastTimeoutRef.current = null;
                    }
                    setNotificationToast(null);
                  }}
                  aria-label="Cerrar notificación"
                >
                  ×
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <header className="dashboard-topbar">
          <div>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="topbar-actions">
            <div className="time-tracker">
              <div className="time-tracker__display">
                <span className="time-tracker__clock">{formattedClock}</span>
                <small className="time-tracker__last">{formattedAttendance}</small>
              </div>
              <div className="time-tracker__actions">
                {attendanceRecord?.status === 'entrada' ? (
                  <button type="button" className={exitButtonClassName} onClick={() => handleMarkAttendance('salida')}>
                    Salida
                  </button>
                ) : (
                  <button type="button" className={entryButtonClassName} onClick={() => handleMarkAttendance('entrada')}>
                    Entrada
                  </button>
                )}
              </div>
            </div>
            <div className="notification-anchor notification-anchor--desktop">
              <button
                className="topbar-button notification"
                type="button"
                aria-label="Notificaciones"
                onClick={() => navigate('/notificaciones')}
              >
                🔔
                {unreadCount > 0 ? (
                  <span className="notification-count">{Math.min(unreadCount, 99)}</span>
                ) : null}
              </button>
              {notificationToast ? (
                <div className="notification-toast" role="status" aria-live="polite">
                  <span className="notification-toast__icon" aria-hidden="true">🔔</span>
                  <div className="notification-toast__content">
                    <strong>Nueva notificación</strong>
                    <p>{notificationToast.message}</p>
                    {notificationToast.detail ? (
                      <small className="notification-toast__detail">{notificationToast.detail}</small>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="notification-toast__close"
                    onClick={() => {
                      if (notificationToastTimeoutRef.current) {
                        window.clearTimeout(notificationToastTimeoutRef.current);
                        notificationToastTimeoutRef.current = null;
                      }
                      setNotificationToast(null);
                    }}
                    aria-label="Cerrar notificación"
                  >
                    ×
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="topbar-button topbar-button--chat"
              onClick={() => navigate('/chat')}
              aria-label={chatBadgeCount > 0 ? `Chat (${chatBadgeCount} mensajes)` : 'Chat'}
            >
              Chat
              {chatBadgeCount > 0 ? (
                <span className="topbar-button__badge" aria-hidden="true">
                  {chatBadgeCount > 99 ? '99+' : chatBadgeCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className={`user-chip${showUserMenu ? ' is-open' : ''}`}
              onClick={() => setShowUserMenu((prev) => !prev)}
            >
              <span className="avatar">{avatarInitials}</span>
              <div className="user-meta">
                <strong>{displayName}</strong>
                <small>{roleLabel}</small>
              </div>
            </button>
            {showUserMenu ? (
              <div className="user-menu" role="menu">
                <button type="button" onClick={handleLogout}>
                  Cerrar sesión
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <section className="dashboard-card">
          {headerContent}
          {children}
        </section>
      </main>
    </div>
    </>
  );
};

const GeneralInfoPage: React.FC = () => {
  const authUser = useStoredAuthUser();
  const [entries, setEntries] = useState<GeneralInfoEntry[]>(() => readGeneralInfoEntriesFromStorage());
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [formatState, setFormatState] = useState({
    bold: false,
    italic: false,
    underline: false,
    fontSize: '3',
  });

  const isAdmin = useMemo(() => {
    const normalized = authUser?.role?.toLowerCase() ?? '';
    return normalized.includes('admin');
  }, [authUser?.role]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === GENERAL_INFO_STORAGE_KEY) {
        setEntries(readGeneralInfoEntriesFromStorage());
      }
    };

    const handleCustomUpdate = () => setEntries(readGeneralInfoEntriesFromStorage());

    window.addEventListener('storage', handleStorage);
    window.addEventListener(GENERAL_INFO_UPDATED_EVENT, handleCustomUpdate as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(GENERAL_INFO_UPDATED_EVENT, handleCustomUpdate as EventListener);
    };
  }, []);

  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [entries]
  );

  const helperText = isAdmin
    ? 'Compartí comunicados, anuncios o recordatorios importantes con todo el equipo.'
    : 'Solo los administradores pueden publicar novedades. Igual vas a poder leer todas las actualizaciones disponibles.';

  const formatEntryDate = (value: string) => {
    try {
      return new Date(value).toLocaleString('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return value;
    }
  };

  const syncBodyWithEditor = () => {
    if (editorRef.current) {
      setBody(editorRef.current.innerHTML);
      updateFormatState();
    }
  };

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== body) {
      editorRef.current.innerHTML = body || '';
    }
    updateFormatState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);

  const updateFormatState = () => {
    if (typeof document === 'undefined') {
      return;
    }
    const bold = document.queryCommandState('bold');
    const italic = document.queryCommandState('italic');
    const underline = document.queryCommandState('underline');
    const fontSize = document.queryCommandValue('fontSize') || '3';
    setFormatState({
      bold,
      italic,
      underline,
      fontSize: typeof fontSize === 'string' ? fontSize : String(fontSize),
    });
  };

  const applyEditorCommand = (command: string, value?: string) => {
    if (!isAdmin || typeof document === 'undefined' || !editorRef.current) {
      return;
    }
    editorRef.current.focus();
    document.execCommand(command, false, value);
    syncBodyWithEditor();
    updateFormatState();
  };

  const handlePublish = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAdmin) {
      setFormError('Solo los administradores pueden publicar novedades.');
      setFormSuccess(null);
      return;
    }

    const trimmedTitle = title.trim();
    const editorHtml = editorRef.current?.innerHTML ?? body;
    const editorText = editorRef.current?.innerText?.replace(/\u200B/g, '').trim() ?? editorHtml.replace(/<[^>]*>/g, '').trim();

    if (!trimmedTitle || !editorText) {
      setFormError('Completá el título y la descripción para publicar.');
      setFormSuccess(null);
      return;
    }

    const normalizedBody = ensureHtmlContent(editorHtml);

    const newEntry: GeneralInfoEntry = {
      id: uniqueKey(),
      title: trimmedTitle,
      body: normalizedBody,
      createdAt: new Date().toISOString(),
      authorId: authUser?.id ?? null,
      authorName: (authUser?.name && authUser.name.trim().length > 0
        ? authUser.name.trim()
        : authUser?.email) ?? 'Administrador',
      authorRole: authUser?.role ?? 'Administrador',
      imageData,
      imageAlt: imageName ?? trimmedTitle,
    };

    const nextEntries = [newEntry, ...entries];
    setEntries(nextEntries);
    persistGeneralInfoEntriesToStorage(nextEntries);
    setTitle('');
    setBody('');
    setImageData(null);
    setImageName(null);
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setFormError(null);
    setFormSuccess('Publicación creada correctamente.');
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    setFormSuccess(null);
    const file = event.target.files?.[0];
    if (!file) {
      setImageData(null);
      setImageName(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setFormError('Seleccioná un archivo de imagen válido.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageData(typeof reader.result === 'string' ? reader.result : null);
      setImageName(file.name);
    };
    reader.onerror = () => {
      setFormError('No pudimos leer la imagen seleccionada.');
      setImageData(null);
      setImageName(null);
      event.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageData(null);
    setImageName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteEntry = (entry: GeneralInfoEntry) => {
    if (!isAdmin) {
      return;
    }
    if (!window.confirm(`¿Eliminar la publicación "${entry.title}"?`)) {
      return;
    }
    const nextEntries = entries.filter((item) => item.id !== entry.id);
    setEntries(nextEntries);
    persistGeneralInfoEntriesToStorage(nextEntries);
  };

  return (
    <DashboardLayout
      title="Información general"
      subtitle="Comparte novedades internas con el resto del equipo"
    >
      <div className="general-info-layout">
        <section className="general-info-panel">
          <div className="general-info-panel__header">
            <h2>Publicar novedad</h2>
            <p className="general-info-helper">{helperText}</p>
          </div>
          <form className="general-info-form" onSubmit={handlePublish}>
            <label>
              <span>Título</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej: Nueva base operativa en Rosario"
                disabled={!isAdmin}
              />
            </label>
            <div className="rich-editor">
              <div className="rich-editor__label">
                <span>Descripción</span>
                <small>Podés aplicar negritas, color o cambiar el tamaño del texto.</small>
              </div>
              <div className="rich-editor__toolbar">
                <button
                  type="button"
                  aria-label="Negrita"
                  className={formatState.bold ? 'toolbar-active' : undefined}
                  onClick={() => applyEditorCommand('bold')}
                  disabled={!isAdmin}
                >
                  B
                </button>
                <button
                  type="button"
                  aria-label="Itálica"
                  className={formatState.italic ? 'toolbar-active' : undefined}
                  onClick={() => applyEditorCommand('italic')}
                  disabled={!isAdmin}
                >
                  I
                </button>
                <button
                  type="button"
                  aria-label="Subrayado"
                  className={formatState.underline ? 'toolbar-active' : undefined}
                  onClick={() => applyEditorCommand('underline')}
                  disabled={!isAdmin}
                >
                  U
                </button>
                <select
                  aria-label="Tamaño de fuente"
                  onChange={(event) => applyEditorCommand('fontSize', event.target.value)}
                  disabled={!isAdmin}
                  value={formatState.fontSize}
                >
                  <option value="1">8</option>
                  <option value="2">10</option>
                  <option value="3">12</option>
                  <option value="4">14</option>
                  <option value="5">18</option>
                  <option value="6">24</option>
                  <option value="7">32</option>
                </select>
                <input
                  type="color"
                  aria-label="Color de texto"
                  onChange={(event) => applyEditorCommand('foreColor', event.target.value)}
                  disabled={!isAdmin}
                />
                <button type="button" aria-label="Limpiar formato" onClick={() => applyEditorCommand('removeFormat')} disabled={!isAdmin}>
                  Limpiar
                </button>
              </div>
              <div
                className="rich-editor__area"
                ref={editorRef}
                contentEditable={isAdmin}
                onInput={syncBodyWithEditor}
                onKeyUp={updateFormatState}
                onMouseUp={updateFormatState}
                data-placeholder="Detallá la novedad que querés compartir..."
                suppressContentEditableWarning
              />
            </div>
            <label className="general-info-upload">
              <span>Imagen (opcional)</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={!isAdmin}
                ref={fileInputRef}
              />
            </label>

            {imageData ? (
              <div className="general-info-preview">
                <img src={imageData} alt={imageName ?? 'Vista previa de la publicación'} />
                <div className="general-info-preview__meta">
                  <span>{imageName ?? 'Imagen seleccionada'}</span>
                  <button type="button" onClick={handleRemoveImage} className="secondary-action">
                    Quitar imagen
                  </button>
                </div>
              </div>
            ) : null}

            {formError ? <p className="form-info form-info--error">{formError}</p> : null}
            {formSuccess ? (
              <p className="form-info form-info--success">{formSuccess}</p>
            ) : null}
            <button type="submit" className="primary-action" disabled={!isAdmin}>
              Publicar
            </button>
          </form>
        </section>

        <section className="general-info-feed">
          <div className="general-info-feed__header">
            <h2>Publicaciones recientes</h2>
            <span>{sortedEntries.length} publicación{sortedEntries.length === 1 ? '' : 'es'}</span>
          </div>

          {sortedEntries.length === 0 ? (
            <p className="general-info-empty">Todavía no hay novedades publicadas.</p>
          ) : (
            <ul className="general-info-list">
              {sortedEntries.map((entry) => (
                <li key={entry.id} className="general-info-card">
                  <header className="general-info-card__meta">
                    <div>
                      <p className="general-info-card__title">{entry.title}</p>
                      <span className="general-info-card__author">
                        {entry.authorName ?? 'Equipo'} · {entry.authorRole ?? 'Administrador'}
                      </span>
                    </div>
                    <time dateTime={entry.createdAt}>{formatEntryDate(entry.createdAt)}</time>
                    {isAdmin ? (
                      <button
                        type="button"
                        className="general-info-card__delete"
                        onClick={() => handleDeleteEntry(entry)}
                        aria-label={`Eliminar publicación ${entry.title}`}
                      >
                        ×
                      </button>
                    ) : null}
                  </header>
                  {entry.imageData ? (
                    <figure className="general-info-card__media">
                      <img src={entry.imageData} alt={entry.imageAlt ?? entry.title} loading="lazy" />
                    </figure>
                  ) : null}
                  <div
                    className="general-info-card__content general-info-card__content--rich"
                    dangerouslySetInnerHTML={{ __html: ensureHtmlContent(entry.body) }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
};
const fallbackChatContacts: ChatContact[] = [
  {
    id: 101,
    name: 'Monica Fernandez',
    role: 'Administradora',
    client: 'QX',
    status: 'online',
    lastSeen: 'En línea',
    lastMessage: 'Listo, quedó asignado.',
    lastMessageAt: '2024-10-01T12:00:00.000Z',
    unread: 1,
  },
  {
    id: 102,
    name: 'Andrés Silva',
    role: 'Operador',
    client: 'Andreani',
    status: 'away',
    lastSeen: 'Visto hace 5 min',
    lastMessage: '¿Revisás el reclamo por favor?',
    lastMessageAt: '2024-09-30T15:40:00.000Z',
    unread: 0,
  },
];

const ChatPage: React.FC = () => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const authUser = useStoredAuthUser();
  const currentUserId = authUser?.id ?? null;
  const currentUserName =
    authUser?.name && authUser.name.trim().length > 0
      ? authUser.name.trim()
      : authUser?.email ?? 'Yo';
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [messagesByContact, setMessagesByContact] = useState<Record<number, ChatMessage[]>>({});
  const [messageInput, setMessageInput] = useState('');
  const [pendingImage, setPendingImage] = useState<{ data: string; name: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const quickEmojis = useMemo(
    () => [
      '😀',
      '😂',
      '😍',
      '👍',
      '🙏',
      '🚚',
      '✅',
      '🔥',
      '💬',
      '🎉',
      '🚀',
      '🌟',
      '🛠️',
      '💡',
      '🎁',
      '📦',
      '📢',
      '🎯',
      '👋',
      '🌍',
      '🧭',
      '📞',
      '🧾',
      '💬',
      '💼',
      '📍',
      '🌐',
      '🕒',
      '🎓',
      '🤝',
    ],
    []
  );
  const incomingAudioContextRef = useRef<AudioContext | null>(null);
  const lastMessageCountRef = useRef<Record<number, number>>({});

  const playIncomingTone = useCallback(() => {
    try {
      if (!incomingAudioContextRef.current) {
        const AudioContextConstructor =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextConstructor) {
          return;
        }
        incomingAudioContextRef.current = new AudioContextConstructor();
      }
      const context = incomingAudioContextRef.current;
      const scheduleNotes = (startOffset: number) => {
        const now = context.currentTime + startOffset;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(780, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.12, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.28);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      };

      const ensureContext = () => {
        if (context.state === 'suspended') {
          return context.resume().catch(() => Promise.resolve());
        }
        return Promise.resolve();
      };

      void ensureContext().then(() => {
        scheduleNotes(0);
        scheduleNotes(0.18);
      });
    } catch {
      // ignore audio errors
    }
  }, []);
  const navigate = useNavigate();
  const params = useParams<{ contactId?: string }>();
  const routeContactId = useMemo(() => {
    if (!params.contactId) {
      return null;
    }
    const parsed = Number(params.contactId);
    return Number.isNaN(parsed) ? null : parsed;
  }, [params.contactId]);
  const createDownloadLink = useCallback((dataUrl: string, filename?: string) => {
    if (!dataUrl) {
      return;
    }
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename ?? `archivo-${Date.now()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const mapUserToContact = useCallback(
    (usuario: Usuario, index: number): ChatContact => {
      const name =
        usuario.name?.trim().length
          ? usuario.name.trim()
          : usuario.email?.trim().length
          ? usuario.email.trim()
          : `Usuario #${usuario.id}`;
      const status: ChatContact['status'] = index % 3 === 0 ? 'away' : index % 2 === 0 ? 'offline' : 'online';
      const lastSeen =
        status === 'online'
          ? 'En línea'
          : status === 'away'
          ? 'Visto hace 5 min'
          : 'Visto hace 2 h';
      return {
        id: usuario.id,
        name,
        role: formatRoleLabel(usuario.role),
        client: usuario.email,
        status,
        lastSeen,
        lastMessage: 'Inicia una conversación',
        lastMessageAt: null,
        unread: status === 'online' ? 1 : 0,
      };
    },
    []
  );

  const mergeMessagesIntoState = useCallback(
    (log: StoredChatMessage[], seedContacts?: ChatContact[]) => {
      if (currentUserId == null) {
        return;
      }
      const lastReadMap = readChatLastRead(currentUserId);
      const grouped: Record<number, ChatMessage[]> = {};
      log.forEach((entry) => {
        const isSender = entry.senderId === currentUserId;
        const isRecipient = entry.recipientId === currentUserId;
        if (!isSender && !isRecipient) {
          return;
        }
        const contactId = isSender ? entry.recipientId : entry.senderId;
        if (contactId == null) {
          return;
        }
        const author: 'self' | 'contact' = isSender ? 'self' : 'contact';
        (grouped[contactId] ??= []).push({
          id: entry.id,
          author,
          text: entry.text,
          timestamp: entry.timestamp,
          imageData: entry.imageData,
          imageName: entry.imageName,
        });
      });
      Object.keys(grouped).forEach((idKey) => {
        grouped[Number(idKey)].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      });
      setMessagesByContact(grouped);
      setContacts((prev) => {
        const base = seedContacts ?? prev;
        let updated = base.map((contact) => {
          const conversation = grouped[contact.id] ?? [];
          const last = conversation[conversation.length - 1];
          const hasConversation = conversation.length > 0;
          const fallbackText =
            hasConversation && last
              ? last.text && last.text.trim().length > 0
                ? last.text
                : last.imageData
                ? '📷 Imagen'
                : contact.lastMessage
              : contact.lastMessage;
          const lastMessageAt = hasConversation
            ? last?.timestamp ?? contact.lastMessageAt ?? null
            : contact.lastMessageAt ?? null;
          const unreadCount = computeUnreadForConversation(conversation, contact.id, lastReadMap);
          return {
            ...contact,
            lastMessage: fallbackText ?? 'Nueva conversación',
            lastMessageAt,
            unread: unreadCount,
          };
        });
        Object.keys(grouped).forEach((idKey) => {
          const contactId = Number(idKey);
          if (!updated.some((contact) => contact.id === contactId)) {
            const conversation = grouped[contactId];
            const last = conversation[conversation.length - 1];
            const unreadCount = computeUnreadForConversation(conversation, contactId, lastReadMap);
            updated = [
              ...updated,
              {
                id: contactId,
                name: `Usuario #${contactId}`,
                role: 'Usuario',
                client: null,
                status: 'online',
                lastSeen: 'En línea',
                lastMessage:
                  (last?.text && last.text.trim().length > 0
                    ? last.text
                    : last?.imageData
                    ? '📷 Imagen'
                    : 'Nueva conversación') ?? 'Nueva conversación',
                lastMessageAt: last?.timestamp ?? null,
                unread: unreadCount,
              },
            ];
          }
        });
        updated = [...updated].sort((a, b) => {
          const aTime = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
          const bTime = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
          if (bTime !== aTime) {
            return bTime - aTime;
          }
          return a.name.localeCompare(b.name);
        });
        return updated;
      });
    },
    [currentUserId]
  );

  const syncMessagesFromStorage = useCallback(
    (seedContacts?: ChatContact[]) => {
      if (currentUserId == null) {
        return;
      }
      const log = readStoredChatMessages(currentUserId);
      persistStoredChatBadge(log, currentUserId);
      mergeMessagesIntoState(log, seedContacts);
    },
    [currentUserId, mergeMessagesIntoState]
  );

  const normalizeServerMessage = useCallback(
    (message: {
      id?: number | string;
      senderId?: number | null;
      recipientId?: number | null;
      text?: string | null;
      imageData?: string | null;
      imageName?: string | null;
      createdAt?: string | null;
    }): StoredChatMessage => {
      return {
        id: message.id != null ? String(message.id) : uniqueKey(),
        senderId: message.senderId ?? null,
        recipientId: message.recipientId ?? null,
        text: message.text ?? '',
        timestamp: message.createdAt ?? new Date().toISOString(),
        imageData: message.imageData ?? null,
        imageName: message.imageName ?? null,
      };
    },
    []
  );

  const fetchMessagesFromServer = useCallback(
    async (seedContacts?: ChatContact[]) => {
      if (currentUserId == null) {
        return;
      }
      const url = new URL(`${apiBaseUrl}/api/chat/messages`);
      url.searchParams.set('userId', currentUserId.toString());
      url.searchParams.set('limit', '200');

      try {
        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error('No se pudieron recuperar los mensajes.');
        }
        const payload = (await response.json()) as { data?: Array<Record<string, unknown>> };
        const entries = Array.isArray(payload?.data)
          ? payload.data.map((item) => normalizeServerMessage(item))
          : [];
        persistStoredChatMessages(entries, currentUserId);
        persistStoredChatBadge(entries, currentUserId);
        mergeMessagesIntoState(entries, seedContacts);
      } catch {
        mergeMessagesIntoState(readStoredChatMessages(currentUserId), seedContacts);
      }
    },
    [apiBaseUrl, currentUserId, mergeMessagesIntoState, normalizeServerMessage]
  );

  useEffect(() => {
    const controller = new AbortController();
    const fetchContacts = async () => {
      try {
        setContactsLoading(true);
        setContactsError(null);
        const response = await fetch(`${apiBaseUrl}/api/usuarios`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const payload = (await response.json()) as { data?: Usuario[] };
        if (!payload?.data || !Array.isArray(payload.data)) {
          throw new Error('Formato de usuarios inesperado');
        }
        const mapped = payload.data.map(mapUserToContact);
        setContacts(mapped);
        fetchMessagesFromServer(mapped);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setContactsError((err as Error).message ?? 'No se pudo cargar la lista de usuarios.');
          setContacts(fallbackChatContacts);
          syncMessagesFromStorage(fallbackChatContacts);
        }
      } finally {
        setContactsLoading(false);
      }
    };

    fetchContacts();

    return () => controller.abort();
  }, [apiBaseUrl, mapUserToContact, syncMessagesFromStorage]);

  useEffect(() => {
    setSelectedContactId(routeContactId);
  }, [routeContactId]);

  const markContactMessagesRead = useCallback(
    (contactId: number, upto?: string) => {
      if (currentUserId == null) {
        return;
      }
      const timestamp = upto ?? new Date().toISOString();
      const lastRead = readChatLastRead(currentUserId);
      const previous = lastRead[contactId];
      if (previous) {
        const previousTime = Date.parse(previous);
        const newTime = Date.parse(timestamp);
        if (!Number.isNaN(previousTime) && !Number.isNaN(newTime) && newTime <= previousTime) {
          return;
        }
      }
      persistChatLastRead({ ...lastRead, [contactId]: timestamp }, currentUserId);
      persistStoredChatBadge(readStoredChatMessages(currentUserId), currentUserId);
    },
    [currentUserId]
  );

  const setActiveContact = useCallback(
    (contactId: number) => {
      setSelectedContactId(contactId);
      const conversation = messagesByContact[contactId] ?? [];
      const lastTimestamp = conversation[conversation.length - 1]?.timestamp;
      markContactMessagesRead(contactId, lastTimestamp);
      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === contactId ? { ...contact, unread: 0, lastSeen: 'En línea' } : contact
        )
      );
    },
    [messagesByContact, markContactMessagesRead]
  );

  useEffect(() => {
    if (selectedContactId == null) {
      return;
    }
    setActiveContact(selectedContactId);
  }, [selectedContactId, setActiveContact]);

  useEffect(() => {
    if (contactsLoading || currentUserId == null) {
      return;
    }
    fetchMessagesFromServer();
  }, [contactsLoading, currentUserId, fetchMessagesFromServer]);

  useEffect(() => {
    if (contactsLoading || currentUserId == null) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      if (!contactsLoading) {
        fetchMessagesFromServer();
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [contactsLoading, currentUserId, fetchMessagesFromServer]);

  const chatLogStorageKey = useMemo(
    () => buildChatStorageKey(CHAT_LOG_STORAGE_KEY, currentUserId),
    [currentUserId]
  );

  useEffect(() => {
    if (currentUserId == null) {
      return undefined;
    }
    const handleStorageUpdate = (event: StorageEvent) => {
      if (event.key !== chatLogStorageKey) {
        return;
      }
      syncMessagesFromStorage();
    };
    window.addEventListener('storage', handleStorageUpdate);
    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, [chatLogStorageKey, currentUserId, syncMessagesFromStorage]);

  const chatMessagesRef = useRef<HTMLDivElement | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) ?? null,
    [contacts, selectedContactId]
  );

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term.length === 0) {
      return contacts;
    }
    return contacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(term) ||
        contact.role.toLowerCase().includes(term) ||
        (contact.client?.toLowerCase().includes(term) ?? false)
    );
  }, [contacts, search]);

  const formatMessageTime = (isoDate: string) => {
    try {
      return new Date(isoDate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoDate;
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageInput((prev) => `${prev}${emoji}`);
    setShowEmojiPicker(false);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      window.alert('Seleccioná un archivo de imagen válido.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPendingImage({
        data: typeof reader.result === 'string' ? reader.result : '',
        name: file.name,
      });
    };
    reader.onerror = () => {
      window.alert('No se pudo leer la imagen seleccionada.');
      event.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePendingImage = () => {
    setPendingImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async () => {
    if (!selectedContactId) {
      return;
    }
    if (currentUserId == null) {
      window.alert('No se pudo identificar al usuario actual para enviar el mensaje.');
      return;
    }
    const targetContact = contacts.find((contact) => contact.id === selectedContactId);
    if (!targetContact) {
      return;
    }
    const trimmed = messageInput.trim();
    const hasImage = Boolean(pendingImage?.data);
    if (trimmed.length === 0 && !hasImage) {
      return;
    }

    const timestamp = new Date().toISOString();
    const newMessage: ChatMessage = {
      id: uniqueKey(),
      author: 'self',
      text: trimmed,
      timestamp,
      imageData: pendingImage?.data,
      imageName: pendingImage?.name,
    };

    setMessagesByContact((prev) => {
      const current = prev[selectedContactId] ?? [];
      return { ...prev, [selectedContactId]: [...current, newMessage] };
    });
    setMessageInput('');
    setPendingImage(null);
    setShowEmojiPicker(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === selectedContactId
          ? {
              ...contact,
              lastMessage:
                trimmed.length > 0
                  ? trimmed
                  : hasImage
                  ? '📷 Imagen'
                  : contact.lastMessage ?? 'Mensaje enviado',
              unread: 0,
              lastSeen: 'En línea',
            }
          : contact
      )
    );
    const storedEntry: StoredChatMessage = {
      id: newMessage.id,
      senderId: currentUserId,
      recipientId: targetContact.id,
      text: trimmed,
      timestamp,
      imageData: pendingImage?.data ?? null,
      imageName: pendingImage?.name ?? null,
    };

    appendStoredChatMessage(storedEntry, currentUserId);
    appendStoredChatMessage(storedEntry, targetContact.id);
    syncMessagesFromStorage();

    try {
      await fetch(`${apiBaseUrl}/api/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderId: currentUserId,
          recipientId: targetContact.id,
          text: trimmed,
          imageData: pendingImage?.data ?? null,
          imageName: pendingImage?.name ?? null,
        }),
      });
    } catch {
      // ignorar errores de red y confiar en el fallback local
    } finally {
      void fetchMessagesFromServer();
    }
  };

  const openConversation = useCallback((contactId: number) => {
    navigate(`/chat/${contactId}`);
  }, [navigate]);
  const goBackToList = useCallback(() => {
    navigate('/chat');
  }, [navigate]);

  const selectedMessages = selectedContactId ? messagesByContact[selectedContactId] ?? [] : [];

  const layoutClasses = ['chat-layout'];
  if (routeContactId) {
    layoutClasses.push('chat-layout--conversation');
  }

  useEffect(() => {
    if (!messagesByContact) {
      return;
    }
    let tonePlayed = false;
    Object.entries(messagesByContact).forEach(([idKey, conversation]) => {
      const contactId = Number(idKey);
      const previousCount = lastMessageCountRef.current[contactId] ?? 0;
      if (conversation.length > previousCount) {
        const newMessages = conversation.slice(previousCount);
        if (!tonePlayed && newMessages.some((message) => message.author === 'contact')) {
          playIncomingTone();
          tonePlayed = true;
        }
      }
      lastMessageCountRef.current[contactId] = conversation.length;
    });
  }, [messagesByContact, playIncomingTone]);

  const watermarkStyle = useMemo(
    () =>
      ({
        '--chat-watermark': `url(${(process.env.PUBLIC_URL ?? '') + '/logo-empresa.png'})`,
      } as React.CSSProperties),
    []
  );

  const handleMessagesScroll = useCallback(() => {
    const container = chatMessagesRef.current;
    if (!container) {
      return;
    }
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShouldAutoScroll(distanceFromBottom <= 40);
  }, []);

  useEffect(() => {
    setShouldAutoScroll(true);
  }, [selectedContactId]);

  useEffect(() => {
    if (!chatMessagesRef.current) {
      return;
    }
    if (shouldAutoScroll) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [selectedMessages, shouldAutoScroll]);

  return (
    <DashboardLayout title="Chat" subtitle="Comunicate con tu equipo en tiempo real">
      <div className={layoutClasses.join(' ')}>
        <aside className="chat-sidebar">
          <div className="chat-sidebar__header">
            <h3>Conversaciones</h3>
            <span>{contactsLoading ? '...' : contacts.length}</span>
          </div>
          <label className="chat-search">
            <input
              type="search"
              placeholder="Buscar"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              disabled={contactsLoading || Boolean(contactsError)}
            />
          </label>
          <div className="chat-contact-list">
            {contactsError ? (
              <p className="form-info form-info--error">
                {contactsError} · mostrando contactos de referencia.
              </p>
            ) : null}
            {contactsLoading ? (
              <p className="section-helper">Cargando usuarios...</p>
            ) : filteredContacts.length === 0 ? (
              <p className="section-helper">No se encontraron contactos.</p>
            ) : (
              filteredContacts.map((contact) => {
                const isActive = contact.id === selectedContactId;
                return (
                  <button
                    key={contact.id}
                    type="button"
                    className={`chat-contact${isActive ? ' is-active' : ''}`}
                    onClick={() => openConversation(contact.id)}
                  >
                    <div className="chat-contact__avatar">
                      {contact.avatar ? (
                        <img src={contact.avatar} alt={contact.name} />
                      ) : (
                        <span>{computeInitials(contact.name)}</span>
                      )}
                      <span className={`presence presence--${contact.status}`} />
                    </div>
                    <div className="chat-contact__meta">
                      <strong>{contact.name}</strong>
                      {contact.role ? <small>{contact.role}</small> : null}
                      <p>{contact.lastMessage}</p>
                    </div>
                    <div className="chat-contact__status">
                      <time>{contact.lastSeen}</time>
                      {contact.unread && contact.unread > 0 ? (
                        <span className="chat-contact__badge">{Math.min(contact.unread, 9)}</span>
                      ) : null}
                      {contact.unread && contact.unread > 0 ? (
                        <span className="chat-contact__notification-count">
                          {contact.unread === 1
                            ? '1 notificación'
                            : `${contact.unread} notificaciones`}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>
        <div className="chat-panel" style={watermarkStyle}>
          {!selectedContact ? (
            <div className="chat-empty-state">
              <h3>Selecciona un contacto</h3>
              <p>Elegí un contacto de la lista para comenzar a chatear.</p>
            </div>
          ) : (
            <>
              <button type="button" className="chat-panel__back" onClick={goBackToList}>
                ← Volver a la lista
              </button>
              <header className="chat-panel__header">
                <div>
                  <strong>{selectedContact.name}</strong>
                  <small>
                    {selectedContact.status === 'online' ? 'En línea' : selectedContact.lastSeen}
                  </small>
                </div>
                <span>{selectedContact.role}</span>
              </header>
              <div
                ref={chatMessagesRef}
                className="chat-messages"
                onScroll={handleMessagesScroll}
              >
                {selectedMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`chat-message chat-message--${message.author}`}
                  >
                    {message.text ? <p>{message.text}</p> : null}
                    {message.imageData ? (
                      <figure className="chat-message__media">
                        <img src={message.imageData} alt={message.imageName ?? 'Imagen enviada'} />
                        <figcaption>
                          {message.imageName ?? 'Archivo adjunto'}
                          <button
                            type="button"
                            className="chat-download"
                            onClick={() => createDownloadLink(message.imageData ?? '', message.imageName ?? 'archivo')}
                          >
                            Descargar
                          </button>
                        </figcaption>
                      </figure>
                    ) : null}
                    <time>{formatMessageTime(message.timestamp)}</time>
                  </div>
                ))}
              </div>
              <footer className="chat-input">
                <div className="chat-input__tools">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleImageChange}
                  />
                  <button
                    type="button"
                    className="chat-tool"
                    aria-label="Adjuntar imagen"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    📎
                  </button>
                  <div className="emoji-picker-wrapper">
                    <button
                      type="button"
                      className="chat-tool"
                      aria-label="Insertar emoji"
                      onClick={() => setShowEmojiPicker((value) => !value)}
                    >
                      😊
                    </button>
                    {showEmojiPicker ? (
                      <div className="emoji-picker">
                        {quickEmojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleEmojiSelect(emoji)}
                            aria-label={`Insertar ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {pendingImage ? (
                    <div className="chat-image-preview">
                      <img src={pendingImage.data} alt={pendingImage.name ?? 'Imagen seleccionada'} />
                      <button
                        type="button"
                        aria-label="Quitar imagen"
                        onClick={handleRemovePendingImage}
                      >
                        ×
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="chat-input__composer">
                  <textarea
                    rows={2}
                    placeholder="Escribí un mensaje..."
                    value={messageInput}
                    onChange={(event) => setMessageInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <button type="button" className="primary-action" onClick={handleSendMessage}>
                    Enviar
                  </button>
                </div>
              </footer>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};
const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingClienteId, setDeletingClienteId] = useState<number | null>(null);
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchClientes = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${apiBaseUrl}/api/clientes`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: Cliente[] };

        if (!payload || !Array.isArray(payload.data)) {
          throw new Error('Formato de respuesta inesperado');
        }

        setClientes(payload.data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }

        setError((err as Error).message ?? 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchClientes();

    return () => controller.abort();
  }, [apiBaseUrl]);

  const filteredClientes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term.length === 0) {
      return clientes;
    }

    return clientes.filter((cliente) => {
      const fields = [
        cliente.codigo,
        cliente.nombre,
        cliente.documento_fiscal,
        cliente.direccion,
        ...cliente.sucursales.flatMap((sucursal) => [sucursal.nombre, sucursal.direccion]),
      ];

      return fields.some((field) => field?.toLowerCase().includes(term));
    });
  }, [clientes, searchTerm]);

  const footerLabel = useMemo(() => {
    if (loading) {
      return 'Cargando clientes...';
    }

    if (error) {
      return 'No se pudieron cargar los clientes';
    }

    if (filteredClientes.length === 0) {
      return 'No hay clientes para mostrar.';
    }

    if (filteredClientes.length === clientes.length) {
      return `Mostrando ${clientes.length} cliente${clientes.length === 1 ? '' : 's'}`;
    }

    return `Mostrando ${filteredClientes.length} de ${clientes.length} clientes`;
  }, [loading, error, filteredClientes.length, clientes.length]);

  const headerContent = (
    <div className="card-header">
      <div className="search-wrapper">
        <input
          type="search"
          placeholder="Buscar"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>
      <button
        className="primary-action"
        type="button"
        onClick={() => navigate('/clientes/nuevo')}
      >
        Registrar cliente
      </button>
    </div>
  );

  const handleDeleteCliente = async (cliente: Cliente) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el cliente "${cliente.nombre ?? cliente.codigo ?? cliente.id}"?`)) {
      return;
    }

    try {
      setDeletingClienteId(cliente.id);
      const response = await fetch(`${apiBaseUrl}/api/clientes/${cliente.id}`, {
        method: 'DELETE',
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

      setClientes((prev) => prev.filter((item) => item.id !== cliente.id));
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo eliminar el cliente.');
    } finally {
      setDeletingClienteId(null);
    }
  };

  return (
    <DashboardLayout title="Gestionar clientes" subtitle="Gestionar clientes" headerContent={headerContent}>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Documento fiscal</th>
              <th>Dirección</th>
              <th>Sucursales</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6}>Cargando clientes...</td>
              </tr>
            )}

            {error && !loading && (
              <tr>
                <td colSpan={6} className="error-cell">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && filteredClientes.length === 0 && (
              <tr>
                <td colSpan={6}>No hay clientes para mostrar.</td>
              </tr>
            )}

            {!loading &&
              !error &&
              filteredClientes.map((cliente) => (
                <tr key={cliente.id}>
                  <td>{cliente.codigo ?? '—'}</td>
                  <td>{cliente.nombre ?? '—'}</td>
                  <td>{cliente.documento_fiscal ?? '—'}</td>
                  <td>{cliente.direccion ?? '—'}</td>
                  <td>
                    <div className="tag-list">
                      {cliente.sucursales.map((sucursal) => {
                        const labelParts = [
                          sucursal.nombre ?? undefined,
                          sucursal.direccion ?? undefined,
                        ].filter(Boolean);

                        return (
                          <span key={`${cliente.id}-${sucursal.id ?? uniqueKey()}`} className="tag">
                            {labelParts.length > 0 ? labelParts.join(' - ') : 'Sin datos'}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        type="button"
                        aria-label={`Editar cliente ${cliente.nombre ?? ''}`}
                        onClick={() => navigate(`/clientes/${cliente.id}/editar`)}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        aria-label={`Eliminar cliente ${cliente.nombre ?? ''}`}
                        onClick={() => handleDeleteCliente(cliente)}
                        disabled={deletingClienteId === cliente.id}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <footer className="table-footer">
        <span>{footerLabel}</span>
        <div className="pagination">
          <button disabled aria-label="Anterior">
            ‹
          </button>
          <button disabled aria-label="Siguiente">
            ›
          </button>
        </div>
      </footer>
    </DashboardLayout>
  );
};

const adaptCliente = (cliente: Cliente) => ({
  form: {
    codigo: cliente.codigo ?? '',
    nombre: cliente.nombre ?? '',
    direccion: cliente.direccion ?? '',
    documento_fiscal: cliente.documento_fiscal ?? '',
  },
  sucursales: (cliente.sucursales ?? []).map<EditableSucursal>((sucursal) => ({
    id: sucursal.id ?? null,
    nombre: sucursal.nombre ?? '',
    direccion: sucursal.direccion ?? '',
    key: sucursal.id ? `existing-${sucursal.id}` : `new-${uniqueKey()}`,
  })),
});

const UnitsPage: React.FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingUnidadId, setDeletingUnidadId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchUnidades = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${apiBaseUrl}/api/unidades`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: Unidad[] };
        if (!payload || !Array.isArray(payload.data)) {
          throw new Error('Formato de respuesta inesperado');
        }

        setUnidades(payload.data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setError((err as Error).message ?? 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchUnidades();

    return () => controller.abort();
  }, [apiBaseUrl]);

  const filteredUnidades = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term.length === 0) {
      return unidades;
    }

    return unidades.filter((unidad) => {
      const fields = [
        unidad.matricula,
        unidad.marca,
        unidad.modelo,
        unidad.anio,
        unidad.observacion,
      ];

      return fields.some((field) => field?.toLowerCase().includes(term));
    });
  }, [unidades, searchTerm]);

  const footerLabel = useMemo(() => {
    if (loading) {
      return 'Cargando unidades...';
    }

    if (error) {
      return 'No se pudieron cargar las unidades';
    }

    if (filteredUnidades.length === 0) {
      return 'No hay unidades para mostrar.';
    }

    if (filteredUnidades.length === unidades.length) {
      return `Mostrando ${unidades.length} unidad${unidades.length === 1 ? '' : 'es'}`;
    }

    return `Mostrando ${filteredUnidades.length} de ${unidades.length} unidades`;
  }, [loading, error, filteredUnidades.length, unidades.length]);

  const headerContent = (
    <div className="card-header">
      <div className="search-wrapper">
        <input
          type="search"
          placeholder="Buscar"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>
      <button
        className="primary-action"
        type="button"
        onClick={() => navigate('/unidades/nuevo')}
      >
        Registrar unidad
      </button>
    </div>
  );

  const handleDeleteUnidad = async (unidad: Unidad) => {
    if (!window.confirm(`¿Seguro que deseas eliminar la unidad "${unidad.matricula ?? unidad.id}"?`)) {
      return;
    }

    try {
      setDeletingUnidadId(unidad.id);
      const response = await fetch(`${apiBaseUrl}/api/unidades/${unidad.id}`, {
        method: 'DELETE',
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

      setUnidades((prev) => prev.filter((item) => item.id !== unidad.id));
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo eliminar la unidad.');
    } finally {
      setDeletingUnidadId(null);
    }
  };

  return (
    <DashboardLayout title="Gestionar unidades" subtitle="Gestionar unidades" headerContent={headerContent}>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Matrícula</th>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Año</th>
              <th>Observación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6}>Cargando unidades...</td>
              </tr>
            )}

            {error && !loading && (
              <tr>
                <td colSpan={6} className="error-cell">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && filteredUnidades.length === 0 && (
              <tr>
                <td colSpan={6}>No hay unidades para mostrar.</td>
              </tr>
            )}

            {!loading &&
              !error &&
              filteredUnidades.map((unidad) => (
                <tr key={unidad.id}>
                  <td>{unidad.matricula ?? '—'}</td>
                  <td>{unidad.marca ?? '—'}</td>
                  <td>{unidad.modelo ?? '—'}</td>
                  <td>{unidad.anio ?? '—'}</td>
                  <td>{unidad.observacion ?? '—'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        type="button"
                        aria-label={`Editar unidad ${unidad.matricula ?? ''}`}
                        onClick={() => navigate(`/unidades/${unidad.id}/editar`)}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        aria-label={`Eliminar unidad ${unidad.matricula ?? ''}`}
                        onClick={() => handleDeleteUnidad(unidad)}
                        disabled={deletingUnidadId === unidad.id}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <footer className="table-footer">
        <span>{footerLabel}</span>
        <div className="pagination">
          <button disabled aria-label="Anterior">
            ‹
          </button>
          <button disabled aria-label="Siguiente">
            ›
          </button>
        </div>
      </footer>
    </DashboardLayout>
  );
};

const ReclamosPage: React.FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [reclamos, setReclamos] = useState<ReclamoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingReclamoId, setDeletingReclamoId] = useState<number | null>(null);
  const [agenteFilter, setAgenteFilter] = useState('');
  const [creatorFilter, setCreatorFilter] = useState('');
  const [transportistaFilter, setTransportistaFilter] = useState('');
  const [clienteFilter, setClienteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const getTransportistaEntries = useCallback((record: ReclamoRecord): ReclamoTransportistaSummary[] => {
    if (Array.isArray(record.transportistas) && record.transportistas.length > 0) {
      return record.transportistas;
    }
    if (record.transportista) {
      return [
        {
          id: record.transportistaId ?? null,
          nombre: record.transportista,
        },
      ];
    }
    return [];
  }, []);

  const getTransportistaNames = useCallback(
    (record: ReclamoRecord): string[] =>
      getTransportistaEntries(record)
        .map((entry) => {
          const base = entry.nombre ?? entry.cliente ?? '';
          return typeof base === 'string' ? base.trim() : '';
        })
        .filter((name) => name.length > 0),
    [getTransportistaEntries]
  );

  const formatTransportistaDisplay = useCallback(
    (record: ReclamoRecord) => {
      const entries = getTransportistaEntries(record);
      const names = getTransportistaNames(record);
      const label =
        names[0] ??
        record.transportista ??
        (entries[0]
          ? entries[0].nombre ??
            entries[0].cliente ??
            `Transportista #${entries[0].id ?? ''}`
          : '—');
      const restCount = entries.length > 1 ? entries.length - 1 : 0;
      const tooltip =
        entries.length > 1
          ? names.length > 0
            ? names.join(', ')
            : entries
                .map((entry, index) => entry.nombre ?? entry.cliente ?? `Transportista #${entry.id ?? index + 1}`)
                .join(', ')
          : names.length === 1
          ? undefined
          : record.transportista ?? undefined;
      return {
        label,
        restCount,
        tooltip,
        names,
      };
    },
    [getTransportistaEntries, getTransportistaNames]
  );

  useEffect(() => {
    const controller = new AbortController();

    const fetchReclamos = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${apiBaseUrl}/api/reclamos`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: ReclamoRecord[] };

        if (!payload || !Array.isArray(payload.data)) {
          throw new Error('Formato de respuesta inesperado');
        }

        let finalData = payload.data;

        try {
          const stored = sessionStorage.getItem('recentReclamo');
          if (stored) {
            const parsed = JSON.parse(stored) as {
              message?: string;
              reclamo?: ReclamoRecord;
            };

            const newReclamo = parsed?.reclamo;
            if (newReclamo) {
              const withoutDuplicate = finalData.filter((reclamo) => reclamo.id !== newReclamo.id);
              finalData = [newReclamo, ...withoutDuplicate];
            }

            if (parsed?.message) {
              setFlashMessage(parsed.message);
            } else if (parsed?.reclamo) {
              setFlashMessage(
                `Reclamo ${parsed.reclamo.codigo ?? `#${parsed.reclamo.id}`} creado correctamente.`
              );
            }

            sessionStorage.removeItem('recentReclamo');
          }
        } catch {
          sessionStorage.removeItem('recentReclamo');
        }

        setReclamos(finalData);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }

        setError((err as Error).message ?? 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchReclamos();

    return () => controller.abort();
  }, [apiBaseUrl]);

  const agenteOptions = useMemo(
    () =>
      Array.from(
        new Set(
          reclamos
            .map((reclamo) => reclamo.agente)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [reclamos]
  );

  const creatorOptions = useMemo(
    () =>
      Array.from(
        new Set(
          reclamos
            .map((reclamo) => reclamo.creator)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [reclamos]
  );

  const clienteOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        reclamos
          .map((reclamo) => reclamo.cliente?.trim())
          .filter((value): value is string => Boolean(value))
      )
    );
    return unique.sort((a, b) => a.localeCompare(b));
  }, [reclamos]);

  const transportistaOptions = useMemo(() => {
    const names = new Set<string>();
    reclamos.forEach((reclamo) => {
      getTransportistaNames(reclamo).forEach((name) => names.add(name));
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [reclamos, getTransportistaNames]);

  const estadoOptions = useMemo(() => {
    const map = new Map<string, string>();
    reclamos.forEach((reclamo) => {
      if (reclamo.status) {
        map.set(reclamo.status, reclamo.statusLabel ?? reclamo.status);
      }
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [reclamos]);

  const tipoOptions = useMemo(
    () =>
      Array.from(
        new Set(
          reclamos
            .map((reclamo) => reclamo.tipo)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [reclamos]
  );

  const filteredReclamos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return reclamos.filter((reclamo) => {
      if (agenteFilter && reclamo.agente !== agenteFilter) {
        return false;
      }

      if (creatorFilter && reclamo.creator !== creatorFilter) {
        return false;
      }

      if (transportistaFilter) {
        const names = getTransportistaNames(reclamo);
        if (!names.includes(transportistaFilter)) {
          return false;
        }
      }

      if (statusFilter && reclamo.status !== statusFilter) {
        return false;
      }

      if (tipoFilter && reclamo.tipo !== tipoFilter) {
        return false;
      }

      const fechaCorta = reclamo.fechaReclamoIso?.slice(0, 10) ?? reclamo.fechaReclamo ?? null;
      if (dateFrom && (!fechaCorta || fechaCorta < dateFrom)) {
        return false;
      }

      if (dateTo && (!fechaCorta || fechaCorta > dateTo)) {
        return false;
      }

      if (clienteFilter && reclamo.cliente !== clienteFilter) {
        return false;
      }

      if (term.length === 0) {
        return true;
      }

      const fields = [
        reclamo.codigo,
        reclamo.detalle,
        reclamo.creator,
        reclamo.agente,
        ...getTransportistaNames(reclamo),
        reclamo.cliente,
        reclamo.tipo,
        reclamo.status,
        reclamo.statusLabel,
      ];

      return fields.some((field) => field?.toLowerCase().includes(term));
    });
  }, [
    reclamos,
    searchTerm,
    agenteFilter,
    creatorFilter,
    transportistaFilter,
    clienteFilter,
    statusFilter,
    tipoFilter,
    dateFrom,
    dateTo,
    getTransportistaNames,
  ]);

  const handleExportReclamos = useCallback(() => {
    const headers = [
      'Fecha reclamo',
      'Código',
      'Detalle',
      'Agente creador',
      'Transportista',
      'Responsable',
      'Cliente',
      'Tipo de reclamo',
      'Estado',
      'Pagado',
      'Importe pagado',
      'Demora',
    ];

    const rows: Array<Array<string>> = [headers];

    if (filteredReclamos.length === 0) {
      rows.push(['Sin datos filtrados']);
    } else {
      filteredReclamos.forEach((reclamo) => {
        const transportistaDisplay = formatTransportistaDisplay(reclamo);
        rows.push([
          reclamo.fechaReclamo ?? '',
          reclamo.codigo ?? `#${reclamo.id}`,
          reclamo.detalle ?? '',
          reclamo.creator ?? '',
          transportistaDisplay.restCount > 0
            ? `${transportistaDisplay.label} (+${transportistaDisplay.restCount})`
            : transportistaDisplay.label ?? '',
          reclamo.agente ?? '',
          reclamo.cliente ?? '',
          reclamo.tipo ?? '',
          reclamo.statusLabel ?? reclamo.status ?? '',
          reclamo.pagado ? 'Sí' : 'No',
          reclamo.pagado
            ? reclamo.importePagadoLabel ?? formatCurrency(reclamo.importePagado)
            : '',
          formatElapsedTime(reclamo.createdAt),
        ]);
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`reclamos-${today}.csv`, rows);
  }, [filteredReclamos, formatTransportistaDisplay]);

  const footerLabel = useMemo(() => {
    if (loading) {
      return 'Cargando reclamos...';
    }

    if (error) {
      return 'No se pudieron cargar los reclamos';
    }

    if (filteredReclamos.length === 0) {
      return 'No hay reclamos para mostrar.';
    }

    if (filteredReclamos.length === reclamos.length) {
      return `Mostrando ${reclamos.length} reclamo${reclamos.length === 1 ? '' : 's'}`;
    }

    return `Mostrando ${filteredReclamos.length} de ${reclamos.length} reclamos`;
  }, [loading, error, filteredReclamos.length, reclamos.length]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setAgenteFilter('');
    setCreatorFilter('');
    setTransportistaFilter('');
    setClienteFilter('');
    setStatusFilter('');
    setTipoFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const headerContent = (
    <>
      <div className="card-header card-header--compact">
        <div className="search-wrapper">
          <input
            type="search"
            placeholder="Buscar"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
      </div>
      <div className="filters-bar filters-bar--reclamos">
        <div className="filters-grid filters-grid--reclamos">
          <label className="filter-field">
            <span>Agente responsable</span>
            <select value={agenteFilter} onChange={(event) => setAgenteFilter(event.target.value)}>
              <option value="">Agente responsable</option>
              {agenteOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Agente creador</span>
            <select value={creatorFilter} onChange={(event) => setCreatorFilter(event.target.value)}>
              <option value="">Agente creador</option>
              {creatorOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Transportista</span>
            <select
              value={transportistaFilter}
              onChange={(event) => setTransportistaFilter(event.target.value)}
            >
              <option value="">Seleccionar transportista</option>
              {transportistaOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Cliente</span>
            <select value={clienteFilter} onChange={(event) => setClienteFilter(event.target.value)}>
              <option value="">Seleccionar cliente</option>
              {clienteOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Estado</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Seleccionar estado</option>
              {estadoOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Fecha desde</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>
          <label className="filter-field">
            <span>Fecha hasta</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <label className="filter-field">
            <span>Tipo de reclamo</span>
            <select value={tipoFilter} onChange={(event) => setTipoFilter(event.target.value)}>
              <option value="">Tipo de reclamo</option>
              {tipoOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="filters-actions">
          <button
            type="button"
            className="secondary-action secondary-action--ghost"
            onClick={handleExportReclamos}
            disabled={loading || filteredReclamos.length === 0}
          >
            Exportar listado
          </button>
          <button type="button" className="secondary-action" onClick={handleResetFilters}>
            Limpiar
          </button>
          <button
            className="primary-action"
            type="button"
            onClick={() => navigate('/reclamos/nuevo')}
          >
            Crear reclamo
          </button>
        </div>
      </div>
    </>
  );

  const handleEditReclamo = (reclamo: ReclamoRecord) => {
    const transportistas = getTransportistaEntries(reclamo);
    navigate(`/reclamos/${reclamo.id}`, {
      state: transportistas.length > 0 ? { transportistas } : undefined,
    });
  };

  const handleDeleteReclamo = async (reclamo: ReclamoRecord) => {
    if (
      !window.confirm(
        `¿Seguro que deseas eliminar el reclamo "${reclamo.codigo ?? `#${reclamo.id}`}"?`
      )
    ) {
      return;
    }

    try {
      setDeletingReclamoId(reclamo.id);
      setFlashMessage(null);

      const response = await fetch(`${apiBaseUrl}/api/reclamos/${reclamo.id}`, {
        method: 'DELETE',
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

      setReclamos((prev) => prev.filter((item) => item.id !== reclamo.id));
      setFlashMessage(
        `Reclamo ${reclamo.codigo ?? `#${reclamo.id}`} eliminado correctamente.`
      );
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo eliminar el reclamo.');
    } finally {
      setDeletingReclamoId(null);
    }
  };

  return (
    <DashboardLayout
      title="Gestión de reclamos"
      subtitle="Gestión de reclamos"
      headerContent={headerContent}
    >
      {flashMessage ? (
        <div className="flash-message" role="alert">
          <span>{flashMessage}</span>
          <button type="button" onClick={() => setFlashMessage(null)} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      ) : null}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Fecha reclamo</th>
              <th>Código</th>
              <th>Descripción</th>
              <th>Agente creador</th>
              <th>Transportista</th>
              <th>Responsable</th>
              <th>Tipo de reclamo</th>
              <th>Estado</th>
              <th>Pagado</th>
              <th>Importe pagado</th>
              <th>Demora</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={12}>Cargando reclamos...</td>
              </tr>
            )}

            {error && !loading && (
              <tr>
                <td colSpan={12} className="error-cell">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && filteredReclamos.length === 0 && (
              <tr>
                <td colSpan={12}>No hay reclamos para mostrar.</td>
              </tr>
            )}

            {!loading &&
              !error &&
              filteredReclamos.map((reclamo) => {
                const transportistaDisplay = formatTransportistaDisplay(reclamo);
                return (
                  <tr key={reclamo.id}>
                  <td>{reclamo.fechaReclamo ?? '—'}</td>
                  <td>{reclamo.codigo ?? `#${reclamo.id}`}</td>
                  <td title={reclamo.detalle ?? undefined}>
                    {truncateText(reclamo.detalle, 80)}
                  </td>
                  <td>{reclamo.creator ?? '—'}</td>
                  <td>
                    <span className="transportista-cell" title={transportistaDisplay.tooltip}>
                      <span>{transportistaDisplay.label ?? '—'}</span>
                      {transportistaDisplay.restCount > 0 ? (
                        <span className="transportista-cell__extra">
                          +{transportistaDisplay.restCount}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td>{reclamo.agente ?? '—'}</td>
                  <td>{reclamo.tipo ?? '—'}</td>
                  <td>
                    <span
                      className={`status-badge status-badge--state status-${(reclamo.status ?? '').toLowerCase()}`}
                    >
                      {reclamo.statusLabel ?? reclamo.status ?? '—'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`status-badge status-badge--payment${reclamo.pagado ? ' is-active' : ' is-inactive'}`}
                    >
                      {reclamo.pagadoLabel ?? (reclamo.pagado ? 'Sí' : 'No')}
                    </span>
                  </td>
                  <td>
                    {reclamo.pagado
                      ? reclamo.importePagadoLabel ?? formatCurrency(reclamo.importePagado)
                      : '—'}
                  </td>
                  <td>{formatElapsedTime(reclamo.createdAt)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        type="button"
                        aria-label={`Editar reclamo ${reclamo.codigo ?? ''}`}
                        onClick={() => handleEditReclamo(reclamo)}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        aria-label={`Eliminar reclamo ${reclamo.codigo ?? ''}`}
                        onClick={() => handleDeleteReclamo(reclamo)}
                        disabled={deletingReclamoId === reclamo.id}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <footer className="table-footer">
        <span>{footerLabel}</span>
        <div className="pagination">
          <button disabled aria-label="Anterior">
            ‹
          </button>
          <button disabled aria-label="Siguiente">
            ›
          </button>
        </div>
      </footer>
    </DashboardLayout>
  );
};

const CreateReclamoPage: React.FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
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
  });
  const authUser = useStoredAuthUser();
  const normalizedRole = useMemo(() => authUser?.role?.toLowerCase().trim() ?? '', [authUser?.role]);
  const isAdmin = useMemo(() => normalizedRole.includes('admin'), [normalizedRole]);
  const isOperator = useMemo(
    () => normalizedRole.includes('operador') || normalizedRole.includes('operator'),
    [normalizedRole]
  );
  const shouldRedirect = Boolean(authUser?.role && !isAdmin && !isOperator);
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
    if (!meta) {
      return;
    }

    setFormValues((prev) => {
      if (prev.status) {
        return prev;
      }

      const preferredStatus =
        meta.estados.find((estado) => estado.value === 'creado')?.value ??
        meta.estados[0]?.value ??
        '';

      if (!preferredStatus) {
        return prev;
      }

      const defaultCreator = prev.creatorId || (meta.creadores[0]?.id ? String(meta.creadores[0].id) : '');

      return { ...prev, status: preferredStatus, creatorId: defaultCreator };
    });
  }, [meta]);

  const transportistaOptions = useMemo(() => {
    if (!meta) {
      return [] as Array<{ id: number; label: string }>;
    }

    const counts = meta.transportistas.reduce<Record<string, number>>((acc, transportista) => {
      const baseName =
        (transportista.nombre ?? `Transportista #${transportista.id}`).trim() ||
        `Transportista #${transportista.id}`;
      acc[baseName] = (acc[baseName] ?? 0) + 1;
      return acc;
    }, {});

    return meta.transportistas.map((transportista) => {
      const baseName =
        (transportista.nombre ?? `Transportista #${transportista.id}`).trim() ||
        `Transportista #${transportista.id}`;
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
    if (!formValues.transportistaId) {
      return;
    }

    const selected = transportistaOptions.find(
      (option) => option.id === Number(formValues.transportistaId)
    );

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

    if (transportistaIds.length === 0 || !formValues.tipoId || !formValues.status) {
      setSubmitError('Completa los campos obligatorios.');
      return;
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

      const response = await fetch(`${apiBaseUrl}/api/reclamos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          detalle: formValues.detalle.trim() || null,
          agenteId: formValues.agenteId ? Number(formValues.agenteId) : null,
          creatorId: formValues.creatorId ? Number(formValues.creatorId) : null,
          transportistaId: transportistaIds[0],
          transportistaIds,
          transportistas: transportistasPayload,
          tipoId: Number(formValues.tipoId),
          status: formValues.status,
          pagado: formValues.pagado === 'true',
          fechaReclamo: formValues.fechaReclamo || null,
        }),
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
          nombre:
            `${item.nombres ?? ''} ${item.apellidos ?? ''}`.trim() ||
            item.cliente ||
            `Transportista #${item.id}`,
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
          const baseMessage =
            'El reclamo se creó correctamente, pero no se pudieron subir los archivos seleccionados.';
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

      const defaultStatus =
        meta?.estados.find((estado) => estado.value === 'creado')?.value ??
        meta?.estados[0]?.value ??
        'creado';

      setFormValues({
        detalle: '',
        agenteId: '',
        creatorId: meta?.creadores[0]?.id ? String(meta.creadores[0].id) : '',
        transportistaId: '',
        tipoId: '',
        status: defaultStatus,
        pagado: 'false',
        fechaReclamo: '',
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

  if (shouldRedirect) {
    return <Navigate to="/clientes" replace />;
  }

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

          {transportistaDetailLoading ? (
            <p className="section-helper">Cargando datos del transportista...</p>
          ) : null}

          {transportistaDetailError ? (
            <p className="form-info form-info--error">{transportistaDetailError}</p>
          ) : null}

          <div className="form-grid">
            <label className="input-control">
              <span>Nombre</span>
              <input
                type="text"
                value={
                  transportistaDetail
                    ? transportistaDetail.nombres ?? '—'
                    : ''
                }
                placeholder="Selecciona un transportista"
                readOnly
                disabled={!transportistaDetail}
              />
            </label>
            <label className="input-control">
              <span>Apellido</span>
              <input
                type="text"
                value={
                  transportistaDetail
                    ? transportistaDetail.apellidos ?? '—'
                    : ''
                }
                placeholder="Selecciona un transportista"
                readOnly
                disabled={!transportistaDetail}
              />
            </label>
            <label className="input-control">
              <span>Cliente</span>
              <input
                type="text"
                value={
                  transportistaDetail
                    ? transportistaDetail.cliente ?? '—'
                    : ''
                }
                placeholder="Selecciona un transportista"
                readOnly
                disabled={!transportistaDetail}
              />
            </label>
            <label className="input-control">
              <span>Sucursal</span>
              <input
                type="text"
                value={
                  transportistaDetail
                    ? transportistaDetail.sucursal ?? '—'
                    : ''
                }
                placeholder="Selecciona un transportista"
                readOnly
                disabled={!transportistaDetail}
              />
            </label>
            <label className="input-control">
              <span>Agente</span>
              <input
                type="text"
                value={
                  transportistaDetail
                    ? transportistaDetail.agente ?? '—'
                    : ''
                }
                placeholder="Selecciona un transportista"
                readOnly
                disabled={!transportistaDetail}
              />
            </label>
            <label className="input-control">
              <span>Unidad</span>
              <input
                type="text"
                value={
                  transportistaDetail
                    ? transportistaDetail.unidadDetalle ?? '—'
                    : ''
                }
                placeholder="Selecciona un transportista"
                readOnly
                disabled={!transportistaDetail}
              />
            </label>
            <label className="input-control">
              <span>Patente</span>
              <input
                type="text"
                value={
                  transportistaDetail
                    ? transportistaDetail.patente ??
                      transportistaDetail.unidad ??
                      '—'
                    : ''
                }
                placeholder="Selecciona un transportista"
                readOnly
                disabled={!transportistaDetail}
              />
            </label>
            <label className="input-control">
              <span>Teléfono</span>
              <input
                type="text"
                value={
                  transportistaDetail
                    ? transportistaDetail.telefono ?? '—'
                    : ''
                }
                placeholder="Selecciona un transportista"
                readOnly
                disabled={!transportistaDetail}
              />
            </label>
            <label className="input-control">
              <span>Fecha de alta</span>
              <input
                type="text"
                value={
                  transportistaDetail
                    ? transportistaDetail.fechaAlta ?? '—'
                    : ''
                }
                placeholder="Selecciona un transportista"
                readOnly
                disabled={!transportistaDetail}
              />
            </label>
          </div>

          <div className="transportista-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={handleAddTransportistaToList}
              disabled={!transportistaDetail}
            >
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

        <div className="reclamo-section">
          <div className="reclamo-section__header">
            <h3>Detalle del reclamo</h3>
          </div>

          <div className="form-grid">
            <label className="input-control">
              <span>Tipo de reclamo</span>
              <select
                value={formValues.tipoId}
                onChange={(event) => setFormValues((prev) => ({ ...prev, tipoId: event.target.value }))}
                required
              >
                <option value="">Seleccionar</option>
                {meta.tipos.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre ?? `Tipo #${tipo.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Agente</span>
              <select
                value={formValues.agenteId}
                onChange={(event) => setFormValues((prev) => ({ ...prev, agenteId: event.target.value }))}
              >
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
              <select
                value={formValues.creatorId}
                onChange={(event) => setFormValues((prev) => ({ ...prev, creatorId: event.target.value }))}
              >
                <option value="">Seleccionar</option>
                {meta.creadores.map((creador) => (
                  <option key={creador.id} value={creador.id}>
                    {creador.nombre ?? `Agente #${creador.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Fecha de alta (opcional)</span>
              <input
                type="date"
                value={formValues.fechaReclamo}
                onChange={(event) => setFormValues((prev) => ({ ...prev, fechaReclamo: event.target.value }))}
              />
            </label>
          </div>

          <label className="input-control">
            <span>Detalle del reclamo</span>
            <textarea
              value={formValues.detalle}
              onChange={(event) => setFormValues((prev) => ({ ...prev, detalle: event.target.value }))}
              placeholder="Describe qué sucedió"
              rows={4}
            />
          </label>
        </div>

        <div className="reclamo-section">
          <div className="reclamo-section__header">
            <h3>Documentación del reclamo</h3>
            <p className="section-helper">Sube tus archivos y los procesaremos</p>
          </div>

          <div className="file-dropzone">
            <div className="file-dropzone__icon" aria-hidden="true">
              📎
            </div>
            <p className="file-dropzone__text">
              Arrastra y suelta tus archivos aquí o haz clic para seleccionarlos desde tu equipo
            </p>
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
              <span className="file-dropzone__hint">
                Formatos soportados: .pdf, .jpg, .jpeg, .png, .docx (máx. 2MB por archivo)
              </span>
            )}
            <button type="button" className="primary-action" onClick={handleFilePicker}>
              Seleccionar archivos
            </button>
            {attachments.length > 0 ? (
              <button
                type="button"
                className="secondary-action secondary-action--ghost"
                onClick={handleClearAttachments}
              >
                Quitar archivos
              </button>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
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

const ReclamoDetailPage: React.FC = () => {
  const { reclamoId } = useParams<{ reclamoId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as
    | { transportistas?: ReclamoTransportistaSummary[] }
    | undefined;
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [detail, setDetail] = useState<ReclamoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ReclamoMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState({
    agenteId: '',
    status: '',
    pagado: 'false',
    fechaReclamo: '',
    detalle: '',
    importePagado: '',
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
  const [documentMessage, setDocumentMessage] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const transportistaInfo = detail?.transportistaDetail;
  const initialTransportistasRef = useRef<ReclamoTransportistaSummary[] | undefined>(
    locationState?.transportistas
  );

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
        initialTransportistasRef.current && initialTransportistasRef.current.length > 0
          ? initialTransportistasRef.current
          : [];
      const cachedTransportistas =
        data.id != null ? loadTransportistasFromCache(data.id) ?? [] : [];

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
      status: fallbackStatus,
      pagado: detail.pagado ? 'true' : 'false',
      fechaReclamo: detail.fechaReclamo ?? '',
      detalle: detail.detalle ?? '',
      importePagado: detail.pagado ? detail.importePagado ?? '' : '',
    });
    shouldRefreshFormRef.current = false;
  }, [detail, meta]);

  const handleResetForm = () => {
    if (!detail) {
      return;
    }

    setFormValues({
      agenteId: detail.agenteId ? String(detail.agenteId) : '',
      status: detail.status ?? '',
      pagado: detail.pagado ? 'true' : 'false',
      fechaReclamo: detail.fechaReclamo ?? '',
      detalle: detail.detalle ?? '',
      importePagado: detail.pagado ? detail.importePagado ?? '' : '',
    });
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!detail || !reclamoId) {
      return;
    }

    const targetStatus = formValues.status || detail.status || meta?.estados[0]?.value || '';

    if (!targetStatus) {
      setSaveError('Selecciona un estado para el reclamo.');
      return;
    }

    let normalizedImporte: number | null = null;
    if (formValues.pagado === 'true') {
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

    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(null);

      const response = await fetch(`${apiBaseUrl}/api/reclamos/${reclamoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          detalle: formValues.detalle.trim() || null,
          agenteId: formValues.agenteId ? Number(formValues.agenteId) : null,
          creatorId: detail.creatorId,
          transportistaId: detail.transportistaId,
          tipoId: detail.tipoId,
          status: targetStatus,
          pagado: formValues.pagado === 'true',
          importePagado: normalizedImporte,
          fechaReclamo: formValues.fechaReclamo || null,
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
          window.open(
            `${apiBaseUrl}/api/reclamos/${reclamoId}/documentos/${doc.id}/descargar`,
            '_blank',
            'noopener'
          );
        } catch {
          // ignore if the fallback cannot be opened
        }
        setDocumentError('No se pudo descargar el documento. Inténtalo nuevamente.');
      }
    },
    [apiBaseUrl, reclamoId, setDocumentError]
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
      ['CUIL', info?.cuil ?? ''],
      ['Cliente', info?.cliente ?? detail.cliente ?? ''],
      ['Sucursal', info?.sucursal ?? ''],
      ['Unidad', info?.unidadDetalle ?? info?.unidad ?? ''],
      ['Patente', info?.patente ?? ''],
      ['Agente del alta', detail.creator ?? info?.agente ?? ''],
      ['Responsable actual', detail.agente ?? ''],
      ['Pagado', detail.pagado ? 'Sí' : 'No'],
      [
        'Importe pagado',
        detail.pagado ? detail.importePagadoLabel ?? formatCurrency(detail.importePagado) : '',
      ],
      ['Fecha del alta', info?.fechaAlta ?? ''],
      ['Fecha del reclamo', detail.fechaReclamo ?? ''],
      ['Teléfono', info?.telefono ?? ''],
      ['Email', info?.email ?? ''],
    ];

    const filename = `transportista-${detail.transportistaId ?? detail.id ?? 'reclamo'}.csv`;
    downloadCsv(filename, rows);
  }, [detail]);

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
    <DashboardLayout
      title="Detalle de reclamo"
      subtitle={detail.codigo ?? `Reclamo #${detail.id}`}
      headerContent={headerContent}
    >
      {metaError ? <p className="form-info form-info--error">{metaError}</p> : null}
      {saveError ? <p className="form-info form-info--error">{saveError}</p> : null}
      {saveSuccess ? <p className="form-info form-info--success">{saveSuccess}</p> : null}

      <div className="reclamo-detail">
        <div className="reclamo-detail-main">
          <section className="reclamo-card">
            <div className="reclamo-card-header">
              <h3>Datos del transportista</h3>
              <button
                type="button"
                className="secondary-action"
                onClick={handleExportTransportista}
                disabled={!detail}
              >
                Descargar datos
              </button>
            </div>
            {Array.isArray(detail.transportistas) && detail.transportistas.length > 1 ? (
              <div className="transportista-associated-list">
                <p className="section-helper">
                  {`Este reclamo incluye ${detail.transportistas.length} transportistas.`}
                </p>
                <ul>
                  {detail.transportistas.map((item, index) => (
                    <li key={item.id ?? `${item.nombre ?? 'transportista'}-${index}`}>
                      <span>{item.nombre ?? `Transportista #${item.id ?? index + 1}`}</span>
                      <small>
                        {item.cliente ?? 'Cliente no registrado'}
                        {item.patente
                          ? ` · ${item.patente}`
                          : item.unidad
                          ? ` · ${item.unidad}`
                          : ''}
                      </small>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="reclamo-card-grid">
              {renderReadOnlyField('Nombre completo', transportistaInfo?.nombreCompleto ?? detail.transportista)}
              {renderReadOnlyField('CUIL', transportistaInfo?.cuil ?? '')}
              {renderReadOnlyField('Cliente', transportistaInfo?.cliente ?? detail.cliente ?? '')}
              {renderReadOnlyField('Sucursal', transportistaInfo?.sucursal ?? '')}
              {renderReadOnlyField('Unidad', transportistaInfo?.unidadDetalle ?? transportistaInfo?.unidad ?? '')}
              {renderReadOnlyField('Patente', transportistaInfo?.patente ?? '')}
              {renderReadOnlyField('Agente del alta', detail.creator ?? transportistaInfo?.agente ?? '')}
              {renderReadOnlyField('Responsable actual', detail.agente ?? '')}
              {renderReadOnlyField('Fecha del alta', transportistaInfo?.fechaAlta ?? '')}
              {renderReadOnlyField('Fecha del reclamo', formValues.fechaReclamo || detail.fechaReclamo || '')}
              {detail.pagado
                ? renderReadOnlyField(
                    'Importe pagado',
                    detail.importePagadoLabel ?? detail.importePagado ?? ''
                  )
                : null}
              {renderReadOnlyField('Teléfono', transportistaInfo?.telefono ?? '')}
              {renderReadOnlyField('Email', transportistaInfo?.email ?? '')}
            </div>
          </section>

          <section className="reclamo-card">
            <h3>Descripción del reclamo</h3>
            <label className="input-control">
              <span>Detalle</span>
              <textarea
                value={formValues.detalle}
                onChange={(event) => setFormValues((prev) => ({ ...prev, detalle: event.target.value }))}
                rows={4}
              />
            </label>
          </section>

          <section className="reclamo-card">
            <div className="reclamo-card-header">
              <h3>Carga de documentos</h3>
          <button
            type="button"
            className="primary-action"
            onClick={handleDocumentButtonClick}
            disabled={documentUploading}
          >
            {documentUploading ? 'Subiendo...' : 'Subir archivos'}
          </button>
          <input
            ref={fileUploadInputRef}
            type="file"
            multiple
            onChange={handleDocumentChange}
            style={{ display: 'none' }}
          />
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
                    {document.downloadUrl ? (
                      <button
                        type="button"
                        className="secondary-action secondary-action--ghost"
                        onClick={() => handleDocumentDownload(document)}
                      >
                        Descargar
                      </button>
                    ) : (
                      <span className="section-helper">Sin enlace</span>
                    )}
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
              {detail.history.length === 0 ? (
                <p className="section-helper">No hay historial disponible.</p>
              ) : (
                detail.history.map((item) => renderHistoryItem(item))
              )}
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

            <label className="input-control">
              <span>Responsable</span>
              <select
                value={formValues.agenteId}
                onChange={(event) => setFormValues((prev) => ({ ...prev, agenteId: event.target.value }))}
                disabled={metaLoading}
              >
                <option value="">Sin asignar</option>
                {(meta?.agentes ?? []).map((agente) => (
                  <option key={agente.id} value={agente.id}>
                    {agente.nombre ?? `Agente #${agente.id}`}
                  </option>
                ))}
              </select>
            </label>
            <p className="section-helper">Al asignar un responsable se notificará el cambio.</p>

            <label className="input-control">
              <span>Estado</span>
              <select
                value={formValues.status}
                onChange={(event) => setFormValues((prev) => ({ ...prev, status: event.target.value }))}
                disabled={metaLoading}
              >
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
              >
                <option value="false">No</option>
                <option value="true">Sí</option>
              </select>
            </label>

            {formValues.pagado === 'true' ? (
              <label className="input-control">
                <span>Importe pagado</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={formValues.importePagado}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, importePagado: event.target.value }))
                  }
                />
              </label>
            ) : null}

            <label className="input-control">
              <span>Fecha del reclamo</span>
              <input
                type="date"
                value={formValues.fechaReclamo}
                onChange={(event) => setFormValues((prev) => ({ ...prev, fechaReclamo: event.target.value }))}
              />
            </label>

            <div className="form-actions">
              <button type="button" className="secondary-action" onClick={handleResetForm} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="primary-action" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </DashboardLayout>
  );
};

const PersonalPage: React.FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [personal, setPersonal] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [clienteFilter, setClienteFilter] = useState('');
  const [sucursalFilter, setSucursalFilter] = useState('');
  const [perfilFilter, setPerfilFilter] = useState('');
  const [agenteFilter, setAgenteFilter] = useState('');
  const [unidadFilter, setUnidadFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [combustibleFilter, setCombustibleFilter] = useState('');
  const [tarifaFilter, setTarifaFilter] = useState('');
  const [deletingPersonalId, setDeletingPersonalId] = useState<number | null>(null);

  const fetchPersonal = useCallback(
    async (options?: { signal?: AbortSignal }) => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${apiBaseUrl}/api/personal?includePending=1`, {
          signal: options?.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: PersonalRecord[] };
        if (!payload || !Array.isArray(payload.data)) {
          throw new Error('Formato de respuesta inesperado');
        }

        setPersonal(payload.data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }

        setError((err as Error).message ?? 'Error desconocido');
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchPersonal({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchPersonal]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ persona?: PersonalRecord }>;
      const persona = customEvent.detail?.persona;

      if (persona && persona.aprobado !== false) {
        setPersonal((prev) => {
          const existingIndex = prev.findIndex((item) => item.id === persona.id);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = persona;
            return updated;
          }

          return [persona, ...prev];
        });
        setError(null);
        setLoading(false);
        return;
      }

      fetchPersonal();
    };

    window.addEventListener('personal:updated', handler as EventListener);
    return () => window.removeEventListener('personal:updated', handler as EventListener);
  }, [fetchPersonal]);

  const perfilNames: Record<number, string> = useMemo(
    () => ({
      1: 'Dueño y chofer',
      2: 'Chofer',
      3: 'Transportista',
    }),
    []
  );

  const filteredPersonal = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return personal.filter((registro) => {
      if (registro.esSolicitud) {
        return false;
      }
      if (clienteFilter && registro.cliente !== clienteFilter) {
        return false;
      }

      if (sucursalFilter && registro.sucursal !== sucursalFilter) {
        return false;
      }

      if (perfilFilter) {
        const nombre = perfilNames[registro.perfilValue ?? 0] ?? registro.perfil;
        if (nombre !== perfilFilter) {
          return false;
        }
      }

      if (agenteFilter && registro.agente !== agenteFilter) {
        return false;
      }

      if (unidadFilter && registro.unidad !== unidadFilter) {
        return false;
      }

      if (estadoFilter && registro.estado !== estadoFilter) {
        return false;
      }

      if (combustibleFilter) {
        const target = combustibleFilter === 'true';
        if (registro.combustibleValue !== target) {
          return false;
        }
      }

      if (tarifaFilter) {
        const target = tarifaFilter === 'true';
        if (registro.tarifaEspecialValue !== target) {
          return false;
        }
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
        registro.unidad,
        registro.unidadDetalle,
        registro.sucursal,
        registro.fechaAlta,
        registro.perfil,
        registro.agente,
        registro.agenteResponsable,
        registro.estado,
        registro.combustible,
        registro.tarifaEspecial,
        registro.pago,
        registro.cbuAlias,
        registro.patente,
        registro.observaciones,
        registro.observacionTarifa,
        registro.duenoNombre,
        registro.duenoCuil,
        registro.duenoCuilCobrador,
        registro.duenoCbuAlias,
        registro.duenoEmail,
        registro.duenoTelefono,
        registro.duenoObservaciones,
      ];

      return fields.some((field) => field?.toLowerCase().includes(term));
    });
  }, [
    personal,
    searchTerm,
    clienteFilter,
    sucursalFilter,
    perfilFilter,
    agenteFilter,
    unidadFilter,
    estadoFilter,
    combustibleFilter,
    tarifaFilter,
    perfilNames,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    clienteFilter,
    sucursalFilter,
    perfilFilter,
    agenteFilter,
    unidadFilter,
    estadoFilter,
    combustibleFilter,
    tarifaFilter,
  ]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredPersonal.length / itemsPerPage));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredPersonal.length, currentPage, itemsPerPage]);

  const totalRecords = filteredPersonal.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const pageRecords = filteredPersonal.slice(startIndex, startIndex + itemsPerPage);
  const endIndex = Math.min(startIndex + pageRecords.length, totalRecords);

  const clienteOptions = useMemo(
    () =>
      Array.from(new Set(personal.map((registro) => registro.cliente).filter((value): value is string => Boolean(value)))).sort(),
    [personal]
  );
  const sucursalOptions = useMemo(
    () =>
      Array.from(new Set(personal.map((registro) => registro.sucursal).filter((value): value is string => Boolean(value)))).sort(),
    [personal]
  );
  const perfilOptions = useMemo(() => {
    const namesFromData = personal
      .map((registro) => perfilNames[registro.perfilValue ?? 0] ?? registro.perfil)
      .filter((value): value is string => Boolean(value));
    const all = [...namesFromData, ...Object.values(perfilNames)];
    return Array.from(new Set(all)).sort();
  }, [personal, perfilNames]);
  const agenteOptions = useMemo(
    () =>
      Array.from(new Set(personal.map((registro) => registro.agente).filter((value): value is string => Boolean(value)))).sort(),
    [personal]
  );
  const unidadOptions = useMemo(
    () =>
      Array.from(new Set(personal.map((registro) => registro.unidad).filter((value): value is string => Boolean(value)))).sort(),
    [personal]
  );
  const estadoOptions = useMemo(
    () =>
      Array.from(new Set(personal.map((registro) => registro.estado).filter((value): value is string => Boolean(value)))).sort(),
    [personal]
  );

  const clearFilters = () => {
    setClienteFilter('');
    setSucursalFilter('');
    setPerfilFilter('');
    setAgenteFilter('');
    setUnidadFilter('');
    setEstadoFilter('');
    setCombustibleFilter('');
    setTarifaFilter('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleDeletePersonal = async (registro: PersonalRecord) => {
    if (deletingPersonalId !== null) {
      return;
    }

    const nombre = registro.nombre ? `"${registro.nombre}"` : `ID ${registro.id}`;
    const confirmed = window.confirm(`¿Seguro que querés eliminar el registro ${nombre}?`);

    if (!confirmed) {
      return;
    }

    try {
      setDeletingPersonalId(registro.id);

      const response = await fetch(`${apiBaseUrl}/api/personal/${registro.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;

        try {
          const payload = await response.json();
          if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
            message = payload.message;
          }
        } catch {
          // Ignored: sin cuerpo de respuesta utilizable.
        }

        throw new Error(message);
      }

      setPersonal((prev) => prev.filter((item) => item.id !== registro.id));
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo eliminar el registro.');
    } finally {
      setDeletingPersonalId(null);
    }
  };

  const handleExportCsv = () => {
    const dataset = filteredPersonal.length > 0 ? filteredPersonal : personal;

    if (dataset.length === 0) {
      window.alert('No hay registros para exportar.');
      return;
    }

    const booleanLabel = (value: boolean | null | undefined) => {
      if (value === true) {
        return 'Sí';
      }

      if (value === false) {
        return 'No';
      }

      return '';
    };

    const columns: Array<{ header: string; resolve: (registro: PersonalRecord) => string | number | null | undefined }> = [
      { header: 'ID', resolve: (registro) => registro.id },
      { header: 'Nombre completo', resolve: (registro) => registro.nombre ?? '' },
      { header: 'Nombres', resolve: (registro) => registro.nombres ?? '' },
      { header: 'Apellidos', resolve: (registro) => registro.apellidos ?? '' },
      { header: 'CUIL', resolve: (registro) => registro.cuil ?? '' },
      { header: 'Teléfono', resolve: (registro) => registro.telefono ?? '' },
      { header: 'Email', resolve: (registro) => registro.email ?? '' },
      { header: 'Perfil', resolve: (registro) => registro.perfil ?? '' },
      { header: 'Perfil ID', resolve: (registro) => registro.perfilValue ?? '' },
      { header: 'Agente', resolve: (registro) => registro.agente ?? '' },
      { header: 'Agente ID', resolve: (registro) => registro.agenteId ?? '' },
      { header: 'Agente responsable', resolve: (registro) => registro.agenteResponsable ?? '' },
      { header: 'Agente responsable ID', resolve: (registro) => registro.agenteResponsableId ?? '' },
      { header: 'Estado', resolve: (registro) => registro.estado ?? '' },
      { header: 'Estado ID', resolve: (registro) => registro.estadoId ?? '' },
      { header: 'Cliente', resolve: (registro) => registro.cliente ?? '' },
      { header: 'Cliente ID', resolve: (registro) => registro.clienteId ?? '' },
      { header: 'Sucursal', resolve: (registro) => registro.sucursal ?? '' },
      { header: 'Sucursal ID', resolve: (registro) => registro.sucursalId ?? '' },
      { header: 'Unidad', resolve: (registro) => registro.unidad ?? '' },
      { header: 'Unidad ID', resolve: (registro) => registro.unidadId ?? '' },
      { header: 'Unidad detalle', resolve: (registro) => registro.unidadDetalle ?? '' },
      { header: 'Fecha alta', resolve: (registro) => registro.fechaAlta ?? '' },
      { header: 'Combustible', resolve: (registro) => booleanLabel(registro.combustibleValue) },
      { header: 'Tarifa especial', resolve: (registro) => booleanLabel(registro.tarifaEspecialValue) },
      { header: 'Pago', resolve: (registro) => registro.pago ?? '' },
      { header: 'CBU alias', resolve: (registro) => registro.cbuAlias ?? '' },
      { header: 'Patente', resolve: (registro) => registro.patente ?? '' },
      { header: 'Observación tarifa', resolve: (registro) => registro.observacionTarifa ?? '' },
      { header: 'Observaciones', resolve: (registro) => registro.observaciones ?? '' },
      { header: 'Aprobado', resolve: (registro) => booleanLabel(registro.aprobado) },
      { header: 'Aprobado el', resolve: (registro) => registro.aprobadoAt ?? '' },
      { header: 'Aprobado por', resolve: (registro) => registro.aprobadoPor ?? '' },
      { header: 'Aprobado por ID', resolve: (registro) => registro.aprobadoPorId ?? '' },
      { header: 'Es solicitud', resolve: (registro) => booleanLabel(registro.esSolicitud) },
      { header: 'Tipo de solicitud', resolve: (registro) => registro.solicitudTipo ?? '' },
      { header: 'Dueño nombre', resolve: (registro) => registro.duenoNombre ?? '' },
      { header: 'Dueño fecha nacimiento', resolve: (registro) => registro.duenoFechaNacimiento ?? '' },
      { header: 'Dueño CUIL', resolve: (registro) => registro.duenoCuil ?? '' },
      { header: 'Dueño CUIL cobrador', resolve: (registro) => registro.duenoCuilCobrador ?? '' },
      { header: 'Dueño CBU alias', resolve: (registro) => registro.duenoCbuAlias ?? '' },
      { header: 'Dueño correo', resolve: (registro) => registro.duenoEmail ?? '' },
      { header: 'Dueño teléfono', resolve: (registro) => registro.duenoTelefono ?? '' },
      { header: 'Dueño observaciones', resolve: (registro) => registro.duenoObservaciones ?? '' },
    ];

    const headerRow = columns.map((column) => column.header);
    const valueRows = dataset.map((registro) =>
      columns.map((column) => {
        const value = column.resolve(registro);
        return value === null || value === undefined ? '' : String(value);
      })
    );

    const csv = [headerRow, ...valueRows]
      .map((row) =>
        row
          .map((cell) => {
            if (cell.includes('"') || cell.includes(',') || cell.includes('\n') || cell.includes('\r')) {
              return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
          })
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `personal-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const footerLabel = useMemo(() => {
    if (loading) {
      return 'Cargando personal...';
    }

    if (error) {
      return 'No se pudo cargar el personal';
    }

    if (totalRecords === 0) {
      return 'No hay registros para mostrar.';
    }

    return `Mostrando ${startIndex + 1} - ${endIndex} de ${totalRecords} registros`;
  }, [loading, error, totalRecords, startIndex, endIndex]);

  const headerContent = (
    <div className="filters-bar">
      <div className="filters-grid">
        <label className="filter-field">
          <span>Cliente</span>
          <select value={clienteFilter} onChange={(event) => setClienteFilter(event.target.value)}>
            <option value="">Cliente</option>
            {clienteOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Sucursal</span>
          <select value={sucursalFilter} onChange={(event) => setSucursalFilter(event.target.value)}>
            <option value="">Sucursal</option>
            {sucursalOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Perfil</span>
          <select value={perfilFilter} onChange={(event) => setPerfilFilter(event.target.value)}>
            <option value="">Perfil</option>
            {perfilOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Agente</span>
          <select value={agenteFilter} onChange={(event) => setAgenteFilter(event.target.value)}>
            <option value="">Agente</option>
            {agenteOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Unidad</span>
          <select value={unidadFilter} onChange={(event) => setUnidadFilter(event.target.value)}>
            <option value="">Unidad</option>
            {unidadOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Estado</span>
          <select value={estadoFilter} onChange={(event) => setEstadoFilter(event.target.value)}>
            <option value="">Estado</option>
            {estadoOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Combustible</span>
          <select value={combustibleFilter} onChange={(event) => setCombustibleFilter(event.target.value)}>
            <option value="">Combustible</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Tarifa especial</span>
          <select value={tarifaFilter} onChange={(event) => setTarifaFilter(event.target.value)}>
            <option value="">Tarifa especial</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </label>
      </div>

      <div className="filters-actions">
        <div className="search-wrapper">
          <input
            type="search"
            placeholder="Buscar"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <button type="button" className="secondary-action" onClick={clearFilters}>
          Limpiar
        </button>
        <button type="button" className="secondary-action" onClick={handleExportCsv}>
          Exportar CSV
        </button>
        <button className="primary-action" type="button" onClick={() => navigate('/personal/nuevo')}>
          Agregar personal
        </button>
      </div>
    </div>
  );

  return (
    <DashboardLayout title="Gestionar personal" subtitle="Gestionar personal" headerContent={headerContent}>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>CUIL</th>
              <th>Teléfono</th>
              <th>Email</th>
              <th>Perfil</th>
              <th>Agente</th>
              <th>Estado</th>
              <th>Combustible</th>
              <th>Tarifa especial</th>
              <th>Cliente</th>
              <th>Unidad</th>
              <th>Sucursal</th>
              <th>Fecha alta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9}>Cargando personal...</td>
              </tr>
            )}

            {error && !loading && (
              <tr>
                <td colSpan={9} className="error-cell">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && filteredPersonal.length === 0 && (
              <tr>
                <td colSpan={9}>No hay registros para mostrar.</td>
              </tr>
            )}

            {!loading &&
              !error &&
              pageRecords.map((registro) => (
                <tr key={registro.id}>
                  <td>{registro.id}</td>
                  <td>{registro.nombre ?? '—'}</td>
                  <td>{registro.cuil ?? '—'}</td>
                  <td>{registro.telefono ?? '—'}</td>
                  <td>{registro.email ?? '—'}</td>
                  <td>{registro.perfil ?? '—'}</td>
                  <td>{registro.agente ?? '—'}</td>
                  <td>{registro.estado ?? '—'}</td>
                  <td>{registro.combustible ?? '—'}</td>
                  <td>{registro.tarifaEspecial ?? '—'}</td>
                  <td>{registro.cliente ?? '—'}</td>
                  <td>{registro.unidad ?? '—'}</td>
                  <td>{registro.sucursal ?? '—'}</td>
                  <td>{registro.fechaAlta ?? '—'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        type="button"
                        aria-label={`Editar personal ${registro.nombre ?? ''}`}
                        onClick={() => navigate(`/personal/${registro.id}/editar`)}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        aria-label={`Eliminar personal ${registro.nombre ?? ''}`}
                        onClick={() => handleDeletePersonal(registro)}
                        disabled={deletingPersonalId === registro.id}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <footer className="table-footer">
        <span>{footerLabel}</span>
        <div className="pagination">
          <button
            aria-label="Anterior"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={safePage <= 1}
          >
            ‹
          </button>
          <button
            aria-label="Siguiente"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={safePage >= totalPages}
          >
            ›
          </button>
        </div>
      </footer>
    </DashboardLayout>
  );
};

const LiquidacionesPage: React.FC = () => {
  const navigate = useNavigate();
  const { personaId: personaIdParam } = useParams<{ personaId?: string }>();
  const personaIdFromRoute = useMemo(() => {
    if (!personaIdParam) {
      return null;
    }
    const parsed = Number(personaIdParam);
    return Number.isNaN(parsed) ? null : parsed;
  }, [personaIdParam]);
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [personal, setPersonal] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [clienteFilter, setClienteFilter] = useState('');
  const [sucursalFilter, setSucursalFilter] = useState('');
  const [perfilFilter, setPerfilFilter] = useState('');
  const [agenteFilter, setAgenteFilter] = useState('');
  const [unidadFilter, setUnidadFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [combustibleFilter, setCombustibleFilter] = useState('');
  const [tarifaFilter, setTarifaFilter] = useState('');
  const [selectedPersonaId, setSelectedPersonaId] = useState<number | null>(personaIdFromRoute);
  const [detail, setDetail] = useState<PersonalDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [pendingUploads, setPendingUploads] = useState<PendingPersonalUpload[]>([]);
  const pendingPreviewUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    pendingPreviewUrlsRef.current = pendingUploads
      .map((upload) => upload.previewUrl)
      .filter((url): url is string => Boolean(url));
  }, [pendingUploads]);

  useEffect(() => {
    return () => {
      pendingPreviewUrlsRef.current.forEach((url) => revokeImagePreviewUrl(url));
    };
  }, []);
  const imagePreviews = useMemo(
    () =>
      pendingUploads.filter(
        (item): item is PendingPersonalUpload & { previewUrl: string } => Boolean(item.previewUrl)
      ),
    [pendingUploads]
  );
  const [previewModalImage, setPreviewModalImage] = useState<{ url: string; label: string } | null>(null);
  const openPreviewModal = useCallback((url: string, label: string) => {
    setPreviewModalImage({ url, label });
  }, []);
  const closePreviewModal = useCallback(() => {
    setPreviewModalImage(null);
  }, []);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePreviewModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closePreviewModal]);
  const resolveDocumentPreviewUrl = useCallback(
    (doc: LiquidacionDocument): string | null => {
      const rawUrl = doc.absoluteDownloadUrl ?? doc.downloadUrl ?? null;
      if (!rawUrl) {
        return null;
      }
      return resolveApiUrl(apiBaseUrl, rawUrl);
    },
    [apiBaseUrl]
  );
  const handlePreviewDocument = useCallback(
    (doc: LiquidacionDocument) => {
      if (!doc.mime?.startsWith('image/')) {
        return;
      }
      const previewUrl = resolveDocumentPreviewUrl(doc);
      if (!previewUrl) {
        return;
      }
      openPreviewModal(previewUrl, doc.nombre ?? `Documento #${doc.id}`);
    },
    [openPreviewModal, resolveDocumentPreviewUrl]
  );
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deletingDocumentIds, setDeletingDocumentIds] = useState<Set<number>>(() => new Set());
  const [documentTypes, setDocumentTypes] = useState<PersonalDocumentType[]>([]);
  const [documentTypesLoading, setDocumentTypesLoading] = useState(true);
  const [documentTypesError, setDocumentTypesError] = useState<string | null>(null);
  const [selectedDocumentTypeId, setSelectedDocumentTypeId] = useState('');
  const [documentExpiry, setDocumentExpiry] = useState('');
  const [liquidacionMonthFilter, setLiquidacionMonthFilter] = useState('');
  const [liquidacionFortnightFilter, setLiquidacionFortnightFilter] = useState('');
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const pasteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    setLiquidacionMonthFilter('');
    setLiquidacionFortnightFilter('');
    setDeletingDocumentIds(new Set<number>());
  }, [selectedPersonaId]);

  useEffect(() => {
    if (showPasteModal) {
      setPasteError(null);
      window.setTimeout(() => {
        pasteTextareaRef.current?.focus();
      }, 0);
    }
  }, [showPasteModal]);

  const selectedDocumentType = useMemo(() => {
    if (!selectedDocumentTypeId) {
      return null;
    }
    const targetId = Number(selectedDocumentTypeId);
    if (Number.isNaN(targetId)) {
      return null;
    }
    return documentTypes.find((tipo) => tipo.id === targetId) ?? null;
  }, [documentTypes, selectedDocumentTypeId]);
  const liquidacionType = useMemo(() => {
    return documentTypes.find((tipo) => (tipo.nombre ?? '').toLowerCase().includes('liquid'));
  }, [documentTypes]);

  useEffect(() => {
    if (personaIdFromRoute !== selectedPersonaId) {
      setSelectedPersonaId(personaIdFromRoute);
    }
  }, [personaIdFromRoute, selectedPersonaId]);

  const formatFileSize = (size: number | null | undefined): string => {
    if (!size || size <= 0) {
      return '—';
    }
    if (size < 1024) {
      return `${size} B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fetchPersonal = useCallback(
    async (options?: { signal?: AbortSignal }) => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${apiBaseUrl}/api/personal?includePending=1`, {
          signal: options?.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: PersonalRecord[] };
        if (!payload || !Array.isArray(payload.data)) {
          throw new Error('Formato de respuesta inesperado');
        }

        setPersonal(payload.data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }

        setError((err as Error).message ?? 'Error desconocido');
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const refreshPersonaDetail = useCallback(
    async (options?: { signal?: AbortSignal; silent?: boolean }) => {
      if (!selectedPersonaId) {
        return;
      }

      try {
        if (!options?.silent) {
          setDetailLoading(true);
          setDetailError(null);
        }

        const response = await fetch(`${apiBaseUrl}/api/personal/${selectedPersonaId}`, {
          signal: options?.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: PersonalDetail };

        if (!payload?.data) {
          throw new Error('Formato de respuesta inesperado');
        }

        setDetail({
          ...payload.data,
          documents: payload.data.documents ?? [],
          documentsDownloadAllUrl: payload.data.documentsDownloadAllUrl ?? null,
          documentsDownloadAllAbsoluteUrl: payload.data.documentsDownloadAllAbsoluteUrl ?? null,
        });
        setDetailError(null);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setDetailError((err as Error).message ?? 'No se pudo cargar la información del personal.');
        if (!options?.silent) {
          setDetail(null);
        }
      } finally {
        if (!options?.silent) {
          setDetailLoading(false);
        }
      }
    },
    [apiBaseUrl, selectedPersonaId]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchPersonal({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchPersonal]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ persona?: PersonalRecord }>;
      const persona = customEvent.detail?.persona;

      if (persona && persona.aprobado !== false) {
        setPersonal((prev) => {
          const existingIndex = prev.findIndex((item) => item.id === persona.id);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = persona;
            return updated;
          }

          return [persona, ...prev];
        });
        if (selectedPersonaId && persona.id === selectedPersonaId) {
          refreshPersonaDetail();
        }
        setError(null);
        setLoading(false);
        return;
      }

      fetchPersonal();
    };

    window.addEventListener('personal:updated', handler as EventListener);
    return () => window.removeEventListener('personal:updated', handler as EventListener);
  }, [fetchPersonal, refreshPersonaDetail, selectedPersonaId]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchDocumentTypes = async () => {
      try {
        setDocumentTypesLoading(true);
        setDocumentTypesError(null);

        const response = await fetch(`${apiBaseUrl}/api/personal/documentos/tipos`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: PersonalDocumentType[] };
        setDocumentTypes(payload?.data ?? []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setDocumentTypesError((err as Error).message ?? 'No se pudieron cargar los tipos de documento.');
      } finally {
        setDocumentTypesLoading(false);
      }
    };

    fetchDocumentTypes();

    return () => controller.abort();
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!selectedPersonaId) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
      return;
    }

    const controller = new AbortController();
    refreshPersonaDetail({ signal: controller.signal });

    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
    }

    autoRefreshRef.current = setInterval(() => {
      refreshPersonaDetail({ silent: true });
    }, 15000);

    return () => {
      controller.abort();
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [refreshPersonaDetail, selectedPersonaId]);

  useEffect(() => {
    if (documentTypes.length === 0) {
      setSelectedDocumentTypeId('');
      return;
    }

    if (liquidacionType) {
      const typeId = String(liquidacionType.id);
      if (typeId !== selectedDocumentTypeId) {
        setSelectedDocumentTypeId(typeId);
      }
      return;
    }

    const alreadySelected = documentTypes.some((tipo) => String(tipo.id) === selectedDocumentTypeId);
    if (!alreadySelected) {
      setSelectedDocumentTypeId(String(documentTypes[0].id));
    }
  }, [documentTypes, liquidacionType, selectedDocumentTypeId]);

  const perfilNames: Record<number, string> = useMemo(
    () => ({
      1: 'Dueño y chofer',
      2: 'Chofer',
      3: 'Transportista',
    }),
    []
  );

  const filteredPersonal = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return personal.filter((registro) => {
      if (clienteFilter && registro.cliente !== clienteFilter) {
        return false;
      }

      if (sucursalFilter && registro.sucursal !== sucursalFilter) {
        return false;
      }

      if (perfilFilter) {
        const nombre = perfilNames[registro.perfilValue ?? 0] ?? registro.perfil;
        if (nombre !== perfilFilter) {
          return false;
        }
      }

      if (agenteFilter && registro.agente !== agenteFilter) {
        return false;
      }

      if (unidadFilter && registro.unidad !== unidadFilter) {
        return false;
      }

      if (estadoFilter && registro.estado !== estadoFilter) {
        return false;
      }

      if (combustibleFilter) {
        const target = combustibleFilter === 'true';
        if (registro.combustibleValue !== target) {
          return false;
        }
      }

      if (tarifaFilter) {
        const target = tarifaFilter === 'true';
        if (registro.tarifaEspecialValue !== target) {
          return false;
        }
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
        registro.unidad,
        registro.unidadDetalle,
        registro.sucursal,
        registro.fechaAlta,
        registro.perfil,
        registro.agente,
        registro.agenteResponsable,
        registro.estado,
        registro.combustible,
        registro.tarifaEspecial,
        registro.pago,
        registro.cbuAlias,
        registro.patente,
        registro.observaciones,
        registro.observacionTarifa,
        registro.duenoNombre,
        registro.duenoCuil,
        registro.duenoCuilCobrador,
        registro.duenoCbuAlias,
        registro.duenoEmail,
        registro.duenoTelefono,
        registro.duenoObservaciones,
      ];

      return fields.some((field) => field?.toLowerCase().includes(term));
    });
  }, [
    personal,
    searchTerm,
    clienteFilter,
    sucursalFilter,
    perfilFilter,
    agenteFilter,
    unidadFilter,
    estadoFilter,
    combustibleFilter,
    tarifaFilter,
    perfilNames,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    clienteFilter,
    sucursalFilter,
    perfilFilter,
    agenteFilter,
    unidadFilter,
    estadoFilter,
    combustibleFilter,
    tarifaFilter,
  ]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredPersonal.length / itemsPerPage));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredPersonal.length, currentPage, itemsPerPage]);

  const totalRecords = filteredPersonal.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const pageRecords = filteredPersonal.slice(startIndex, startIndex + itemsPerPage);

  const clienteOptions = useMemo(
    () =>
      Array.from(new Set(personal.map((registro) => registro.cliente).filter((value): value is string => Boolean(value)))).sort(),
    [personal]
  );
  const sucursalOptions = useMemo(
    () =>
      Array.from(new Set(personal.map((registro) => registro.sucursal).filter((value): value is string => Boolean(value)))).sort(),
    [personal]
  );
  const perfilOptions = useMemo(() => {
    const namesFromData = personal
      .map((registro) => perfilNames[registro.perfilValue ?? 0] ?? registro.perfil)
      .filter((value): value is string => Boolean(value));
    const all = [...namesFromData, ...Object.values(perfilNames)];
    return Array.from(new Set(all)).sort();
  }, [personal, perfilNames]);
  const agenteOptions = useMemo(
    () =>
      Array.from(new Set(personal.map((registro) => registro.agente).filter((value): value is string => Boolean(value)))).sort(),
    [personal]
  );
  const unidadOptions = useMemo(
    () =>
      Array.from(new Set(personal.map((registro) => registro.unidad).filter((value): value is string => Boolean(value)))).sort(),
    [personal]
  );
  const estadoOptions = useMemo(
    () =>
      Array.from(new Set(personal.map((registro) => registro.estado).filter((value): value is string => Boolean(value)))).sort(),
    [personal]
  );

  const clearFilters = () => {
    setClienteFilter('');
    setSucursalFilter('');
    setPerfilFilter('');
    setAgenteFilter('');
    setUnidadFilter('');
    setEstadoFilter('');
    setCombustibleFilter('');
    setTarifaFilter('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const footerLabel = useMemo(() => {
    if (loading) {
      return 'Cargando personal...';
    }

    if (error) {
      return 'No se pudieron cargar los registros.';
    }

    if (filteredPersonal.length === 0) {
      return 'No hay registros para mostrar.';
    }

    if (filteredPersonal.length === personal.length) {
      return `Mostrando ${personal.length} registro${personal.length === 1 ? '' : 's'}`;
    }

    return `Mostrando ${filteredPersonal.length} de ${personal.length} registros`;
  }, [loading, error, filteredPersonal.length, personal.length]);

  const liquidacionDocuments = useMemo(() => {
    if (!detail) {
      return [] as PersonalDetail['documents'];
    }

    const normalised = detail.documents.map((doc) => {
      const rawParent = (doc as PersonalDetail['documents'][number]).parentDocumentId as unknown;
      const numericParent =
        typeof rawParent === 'number'
          ? rawParent
          : rawParent !== null && rawParent !== undefined && rawParent !== ''
            ? Number(rawParent)
            : null;
      const parentDocumentId =
        typeof numericParent === 'number' && !Number.isNaN(numericParent) ? numericParent : null;

      return {
        ...doc,
        parentDocumentId,
        isAttachment: doc.isAttachment ?? (parentDocumentId !== null),
      };
    });

    const matches = normalised.filter((doc) => (doc.tipoNombre ?? '').toLowerCase().includes('liquid'));
    if (matches.length > 0) {
      return matches;
    }
    return normalised;
  }, [detail]);

  const liquidacionGroups = useMemo(() => {
    if (liquidacionDocuments.length === 0) {
      return [] as LiquidacionGroup[];
    }

    const attachmentsByParent = new Map<number, LiquidacionDocument[]>();
    const mainDocuments: LiquidacionDocument[] = [];
    const orphanAttachments: LiquidacionDocument[] = [];

    const toTimestamp = (doc: LiquidacionDocument): number => {
      if (doc.fechaCargaIso) {
        const value = Date.parse(doc.fechaCargaIso);
        if (!Number.isNaN(value)) {
          return value;
        }
      }

      if (doc.fechaCarga) {
        const value = Date.parse(doc.fechaCarga);
        if (!Number.isNaN(value)) {
          return value;
        }
      }

      return 0;
    };

    const sortDocs = (items: LiquidacionDocument[]): LiquidacionDocument[] =>
      [...items].sort((a, b) => {
        const timeA = toTimestamp(a);
        const timeB = toTimestamp(b);

        if (timeA !== timeB) {
          return timeB - timeA;
        }

        return (b.id ?? 0) - (a.id ?? 0);
      });

    liquidacionDocuments.forEach((doc) => {
      const parentId = typeof doc.parentDocumentId === 'number' ? doc.parentDocumentId : null;
      const isAttachment = doc.isAttachment ?? Boolean(parentId);

      if (isAttachment && parentId !== null) {
        const current = attachmentsByParent.get(parentId) ?? [];
        current.push(doc);
        attachmentsByParent.set(parentId, current);
        return;
      }

      if (isAttachment && parentId === null) {
        orphanAttachments.push(doc);
        return;
      }

      mainDocuments.push(doc);
    });

    const groups: LiquidacionGroup[] = [];

    sortDocs(mainDocuments).forEach((mainDoc) => {
      const attachments = sortDocs(attachmentsByParent.get(mainDoc.id) ?? []);
      groups.push({
        main: mainDoc,
        attachments,
      });
    });

    sortDocs(orphanAttachments).forEach((orphan) => {
      groups.push({
        main: orphan,
        attachments: [],
      });
    });

    return groups;
  }, [liquidacionDocuments]);

  const liquidacionFortnightSections = useMemo(() => {
    if (liquidacionGroups.length === 0) {
      return [] as LiquidacionFortnightSection[];
    }

    const monthFormatter = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });
    const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

    const monthMap = new Map<
      string,
      {
        monthKey: string;
        monthLabel: string;
        sections: Map<string, { key: string; label: string; rows: LiquidacionGroup[] }>;
      }
    >();

    const getDateFromGroup = (group: LiquidacionGroup): Date | null => {
      const source = group.main;
      const rawIso =
        source.fechaVencimiento
        ?? source.fechaCargaIso
        ?? source.fechaCarga
        ?? null;

      if (!rawIso) {
        return null;
      }

      const parsed = new Date(rawIso);
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }

      return parsed;
    };

    const monthOrderValue = (key: string): number | null => {
      if (key === 'unknown') {
        return null;
      }
      const [year, month] = key.split('-').map((segment) => Number(segment));
      if (!Number.isFinite(year) || !Number.isFinite(month)) {
        return null;
      }
      return year * 100 + month;
    };

    liquidacionGroups.forEach((group) => {
      const date = getDateFromGroup(group);
      const monthKey = date
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : 'unknown';
      const monthLabel = date ? capitalize(monthFormatter.format(date)) : 'Sin fecha';

      const quincenaKey = date ? (date.getDate() <= 15 ? 'Q1' : 'Q2') : 'NO_DATE';
      const quincenaLabel = date
        ? date.getDate() <= 15
          ? 'Primera quincena (1-15)'
          : 'Segunda quincena (16-fin)'
        : 'Sin fecha definida';

      const monthBucket = monthMap.get(monthKey) ?? {
        monthKey,
        monthLabel,
        sections: new Map<string, { key: string; label: string; rows: LiquidacionGroup[] }>(),
      };

      const sectionBucket = monthBucket.sections.get(quincenaKey) ?? {
        key: quincenaKey,
        label: quincenaLabel,
        rows: [] as LiquidacionGroup[],
      };

      sectionBucket.rows.push(group);
      monthBucket.sections.set(quincenaKey, sectionBucket);
      monthMap.set(monthKey, monthBucket);
    });

    const quincenaOrder = (key: string): number => {
      switch (key) {
        case 'Q1':
          return 0;
        case 'Q2':
          return 1;
        default:
          return 2;
      }
    };

    const months = Array.from(monthMap.values())
      .filter((month) => month.sections.size > 0)
      .sort((a, b) => {
        const aValue = monthOrderValue(a.monthKey);
        const bValue = monthOrderValue(b.monthKey);

        if (aValue === null && bValue === null) {
          return 0;
        }
        if (aValue === null) {
          return 1;
        }
        if (bValue === null) {
          return -1;
        }

        return bValue - aValue;
      });

    return months.map((month) => ({
      monthKey: month.monthKey,
      monthLabel: month.monthLabel,
      sections: Array.from(month.sections.values())
        .filter((section) => section.rows.length > 0)
        .sort((a, b) => quincenaOrder(a.key) - quincenaOrder(b.key)),
    }));
  }, [liquidacionGroups]);

  const liquidacionMonthOptions = useMemo(() => {
    const hasUnknown = liquidacionFortnightSections.some((section) => section.monthKey === 'unknown');
    return MONTH_FILTER_OPTIONS.filter((option) => option.value !== 'unknown' || hasUnknown);
  }, [liquidacionFortnightSections]);

  const liquidacionFortnightOptions = useMemo(() => {
    const hasNoDateSection = liquidacionFortnightSections.some((month) =>
      month.sections.some((section) => section.key === 'NO_DATE')
    );

    return FORTNIGHT_FILTER_OPTIONS.filter((option) => option.value !== 'NO_DATE' || hasNoDateSection);
  }, [liquidacionFortnightSections]);

  const resolveFilteredTargetDate = useCallback((): string | null => {
    if (!liquidacionMonthFilter || liquidacionMonthFilter === 'unknown') {
      return null;
    }

    let year: number | null = null;
    let month: number | null = null;

    const now = new Date();

    if (/^\d{4}-\d{2}$/.test(liquidacionMonthFilter)) {
      year = Number(liquidacionMonthFilter.slice(0, 4));
      month = Number(liquidacionMonthFilter.slice(5));
    } else if (/^\d{2}$/.test(liquidacionMonthFilter)) {
      year = now.getFullYear();
      month = Number(liquidacionMonthFilter);
    }

    if (
      year === null ||
      Number.isNaN(year) ||
      month === null ||
      Number.isNaN(month) ||
      month < 1 ||
      month > 12
    ) {
      return null;
    }

    let day: number;
    if (liquidacionFortnightFilter === 'Q2') {
      day = new Date(year, month, 0).getDate();
    } else if (liquidacionFortnightFilter === 'Q1') {
      day = 15;
    } else {
      day = 1;
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }, [liquidacionMonthFilter, liquidacionFortnightFilter]);

  const filteredLiquidacionSections = useMemo(() => {
    if (liquidacionFortnightSections.length === 0) {
      return [] as LiquidacionFortnightSection[];
    }

    const matchesMonth = (monthSection: LiquidacionFortnightSection): boolean => {
      if (!liquidacionMonthFilter) {
        return true;
      }

      if (liquidacionMonthFilter === 'unknown') {
        return monthSection.monthKey === 'unknown';
      }

      const normalizedFilter = liquidacionMonthFilter.trim();

      if (/^\d{4}-\d{2}$/.test(normalizedFilter)) {
        return monthSection.monthKey === normalizedFilter;
      }

      if (/^\d{2}$/.test(normalizedFilter)) {
        if (monthSection.monthKey === 'unknown') {
          return false;
        }
        const monthPart = monthSection.monthKey.slice(-2);
        return monthPart === normalizedFilter;
      }

      return monthSection.monthKey === normalizedFilter;
    };

    const matchesFortnight = (sectionKey: string): boolean => {
      if (!liquidacionFortnightFilter) {
        return true;
      }
      return sectionKey === liquidacionFortnightFilter;
    };

    return liquidacionFortnightSections
      .filter((monthSection) => matchesMonth(monthSection))
      .map((monthSection) => {
        const filteredSections = monthSection.sections.filter((section) => matchesFortnight(section.key));

        return {
          ...monthSection,
          sections: filteredSections,
        };
      })
      .filter((monthSection) => monthSection.sections.length > 0);
  }, [liquidacionFortnightSections, liquidacionMonthFilter, liquidacionFortnightFilter]);

  const handleSelectPersona = (registro: PersonalRecord) => {
    setSelectedPersonaId(registro.id);
    clearPendingUploads();
    setUploadStatus(null);
    setDocumentExpiry('');
    navigate(`/liquidaciones/${registro.id}`);
  };

  const handleRemovePendingUpload = useCallback((id: string) => {
    setPendingUploads((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        revokeImagePreviewUrl(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const clearPendingUploads = useCallback(() => {
    setPendingUploads((prev) => {
      prev.forEach((item) => revokeImagePreviewUrl(item.previewUrl));
      return [];
    });
    pendingPreviewUrlsRef.current = [];
    closePreviewModal();
  }, [closePreviewModal]);

  const prepareUploadsFromFiles = useCallback(
    (files: File[]): { ok: true; uploads: PendingPersonalUpload[] } | { ok: false; message: string } => {
      if (!files || files.length === 0) {
        return { ok: false, message: 'No se encontraron archivos para cargar.' };
      }

      if (!selectedPersonaId) {
        return { ok: false, message: 'Seleccioná un registro antes de agregar liquidaciones.' };
      }

      if (!selectedDocumentTypeId) {
        return { ok: false, message: 'Seleccioná el tipo de documento antes de agregar liquidaciones.' };
      }

    const tipo = selectedDocumentType;

    const effectiveTypeId = liquidacionType ? liquidacionType.id : Number(selectedDocumentTypeId);
    if (!effectiveTypeId || Number.isNaN(effectiveTypeId)) {
      return { ok: false, message: 'No se pudo determinar el tipo de documento para la liquidación.' };
    }

    const targetDate = resolveFilteredTargetDate();
    if (tipo?.vence && !documentExpiry && !targetDate) {
      return { ok: false, message: 'Este tipo de documento requiere fecha de vencimiento.' };
    }

    const fechaVencimiento = targetDate ?? (tipo?.vence ? documentExpiry || null : null);

    const uploads: PendingPersonalUpload[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      typeId: effectiveTypeId,
      typeName: (liquidacionType ?? tipo)?.nombre ?? null,
      fechaVencimiento,
      previewUrl: createImagePreviewUrl(file),
    }));

    return { ok: true, uploads };
  },
    [
      selectedPersonaId,
      selectedDocumentTypeId,
      selectedDocumentType,
      documentExpiry,
      liquidacionType,
      resolveFilteredTargetDate,
    ]
  );

  const handlePendingFilesSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const result = prepareUploadsFromFiles(Array.from(files));

    if (!result.ok) {
      setUploadStatus({ type: 'error', message: result.message });
      event.target.value = '';
      return;
    }

    setPendingUploads((prev) => [...prev, ...result.uploads]);
    setUploadStatus(null);

    if (!selectedDocumentType?.vence) {
      setDocumentExpiry('');
    }

    event.target.value = '';
  };

  const handleOpenPasteModal = () => {
    if (!selectedPersonaId) {
      setUploadStatus({ type: 'error', message: 'Seleccioná un registro antes de pegar la liquidación.' });
      return;
    }

    if (!selectedDocumentTypeId) {
      setUploadStatus({ type: 'error', message: 'Seleccioná el tipo de documento antes de pegar la liquidación.' });
      return;
    }

    if (selectedDocumentType?.vence && !documentExpiry) {
      setUploadStatus({
        type: 'error',
        message: 'Este tipo de documento requiere fecha de vencimiento antes de adjuntar la liquidación.',
      });
      return;
    }

    setPasteError(null);
    setShowPasteModal(true);
  };

  const handleClosePasteModal = () => {
    setShowPasteModal(false);
    setPasteError(null);
  };

  const handlePasteAreaPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault();

    const clipboardItems = Array.from(event.clipboardData.items ?? []);
    const files: File[] = [];

    clipboardItems.forEach((item) => {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) {
          const extension = blob.type.split('/')[1] ?? 'png';
          const fileName = `liquidacion-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
          const file = new File([blob], fileName, { type: blob.type });
          files.push(file);
        }
      }
    });

    if (files.length === 0) {
      setPasteError('El portapapeles no contiene una imagen. Copiá la captura de la liquidación e inténtalo nuevamente.');
      return;
    }

    const result = prepareUploadsFromFiles(files);

    if (!result.ok) {
      setPasteError(result.message);
      return;
    }

    setPendingUploads((prev) => [...prev, ...result.uploads]);
    setUploadStatus({ type: 'success', message: 'Imagen pegada agregada a la lista de carga.' });

    if (!selectedDocumentType?.vence) {
      setDocumentExpiry('');
    }

    setShowPasteModal(false);
    setPasteError(null);
  };

  const handleUploadDocumentos = async () => {
    if (!selectedPersonaId || pendingUploads.length === 0) {
      return;
    }

    try {
      setUploading(true);
      setUploadStatus(null);

      for (const item of pendingUploads) {
        const formData = new FormData();
        formData.append('archivo', item.file);
        const rawName = item.file.name.trim();
        const hasLiquidKeyword = /liquid/i.test(rawName);
        const friendlyName = hasLiquidKeyword ? rawName : `Liquidación - ${rawName}`;
        formData.append('nombre', friendlyName);
        formData.append('tipoArchivoId', String(item.typeId));
        if (item.fechaVencimiento) {
          formData.append('fechaVencimiento', item.fechaVencimiento);
        }
        formData.append('esLiquidacion', '1');

        const response = await fetch(`${apiBaseUrl}/api/personal/${selectedPersonaId}/documentos`, {
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
              if (Array.isArray(firstError) && typeof firstError[0] === 'string') {
                message = firstError[0];
              }
            }
          } catch {
            // ignore
          }

          throw new Error(message);
        }
      }

      setUploadStatus({ type: 'success', message: 'Liquidaciones cargadas correctamente.' });
      clearPendingUploads();
      setDocumentExpiry('');
      refreshPersonaDetail();
    } catch (err) {
      setUploadStatus({ type: 'error', message: (err as Error).message ?? 'No se pudieron subir los archivos.' });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadDocumento = (documento: PersonalDetail['documents'][number]) => {
    if (!detail) {
      return;
    }

    const fallbackPath = `/api/personal/${detail.id}/documentos/${documento.id}/descargar`;
    const resolvedUrl = resolveApiUrl(apiBaseUrl, documento.downloadUrl ?? fallbackPath);

    if (!resolvedUrl) {
      window.alert('No se pudo determinar la URL de descarga para este documento.');
      return;
    }

    window.open(resolvedUrl, '_blank', 'noopener');
  };

  const handleDeleteDocumento = async (documento: PersonalDetail['documents'][number]) => {
    if (!detail) {
      return;
    }

    const docId = documento.id;
    if (docId === null || docId === undefined) {
      window.alert('No se pudo identificar el documento a eliminar.');
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar "${documento.nombre ?? 'este documento'}"? Esta acción no se puede deshacer.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingDocumentIds((prev) => {
      const next = new Set(prev);
      next.add(docId);
      return next;
    });

    try {
      const response = await fetch(`${apiBaseUrl}/api/personal/${detail.id}/documentos/${docId}`, {
        method: 'DELETE',
      });

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
          // ignore parsing errors
        }

        throw new Error(message);
      }

      setUploadStatus({ type: 'success', message: 'Documento eliminado correctamente.' });
      await refreshPersonaDetail({ silent: true });
    } catch (err) {
      const message = (err as Error).message ?? 'No se pudo eliminar el documento.';
      setUploadStatus({ type: 'error', message });
      window.alert(message);
    } finally {
      setDeletingDocumentIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedPersonaId(null);
    setDetail(null);
    setDetailError(null);
    clearPendingUploads();
    setUploadStatus(null);
    setDocumentExpiry('');
    navigate('/liquidaciones');
  };

  const headerContent = (
    <div className="filters-bar">
      <div className="filters-grid">
        <label className="filter-field">
          <span>Cliente</span>
          <select value={clienteFilter} onChange={(event) => setClienteFilter(event.target.value)}>
            <option value="">Cliente</option>
            {clienteOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Sucursal</span>
          <select value={sucursalFilter} onChange={(event) => setSucursalFilter(event.target.value)}>
            <option value="">Sucursal</option>
            {sucursalOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Perfil</span>
          <select value={perfilFilter} onChange={(event) => setPerfilFilter(event.target.value)}>
            <option value="">Perfil</option>
            {perfilOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Agente</span>
          <select value={agenteFilter} onChange={(event) => setAgenteFilter(event.target.value)}>
            <option value="">Agente</option>
            {agenteOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Unidad</span>
          <select value={unidadFilter} onChange={(event) => setUnidadFilter(event.target.value)}>
            <option value="">Unidad</option>
            {unidadOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Estado</span>
          <select value={estadoFilter} onChange={(event) => setEstadoFilter(event.target.value)}>
            <option value="">Estado</option>
            {estadoOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Combustible</span>
          <select value={combustibleFilter} onChange={(event) => setCombustibleFilter(event.target.value)}>
            <option value="">Combustible</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Tarifa especial</span>
          <select value={tarifaFilter} onChange={(event) => setTarifaFilter(event.target.value)}>
            <option value="">Tarifa especial</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </label>
      </div>

      <div className="filters-actions">
        <div className="search-wrapper">
          <input
            type="search"
            placeholder="Buscar"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <button type="button" className="secondary-action" onClick={clearFilters}>
          Limpiar
        </button>
        <button type="button" className="secondary-action" onClick={() => navigate('/personal')}>
          Ir a personal
        </button>
      </div>
    </div>
  );

  const selectedPersonaLabel = useMemo(() => {
    if (!detail) {
      return '';
    }

    const fullName = [detail.nombres, detail.apellidos].filter(Boolean).join(' ').trim();
    if (fullName.length > 0) {
      return fullName;
    }

    return detail.email ?? `Registro #${detail.id}`;
  }, [detail]);

  const listView = (
    <DashboardLayout title="Liquidaciones" subtitle="Gestión de liquidaciones del personal" headerContent={headerContent}>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>CUIL</th>
              <th>Teléfono</th>
              <th>Email</th>
              <th>Perfil</th>
              <th>Agente</th>
              <th>Estado</th>
              <th>Combustible</th>
              <th>Tarifa especial</th>
              <th>Cliente</th>
              <th>Unidad</th>
              <th>Sucursal</th>
              <th>Fecha alta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={15}>Cargando personal...</td>
              </tr>
            )}

            {error && !loading && (
              <tr>
                <td colSpan={15} className="error-cell">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && filteredPersonal.length === 0 && (
              <tr>
                <td colSpan={15}>No hay registros para mostrar.</td>
              </tr>
            )}

            {!loading &&
              !error &&
              pageRecords.map((registro) => (
                <tr key={registro.id}>
                  <td>{registro.id}</td>
                  <td>{registro.nombre ?? '—'}</td>
                  <td>{registro.cuil ?? '—'}</td>
                  <td>{registro.telefono ?? '—'}</td>
                  <td>{registro.email ?? '—'}</td>
                  <td>{registro.perfil ?? '—'}</td>
                  <td>{registro.agente ?? '—'}</td>
                  <td>{registro.estado ?? '—'}</td>
                  <td>{registro.combustible ?? '—'}</td>
                  <td>{registro.tarifaEspecial ?? '—'}</td>
                  <td>{registro.cliente ?? '—'}</td>
                  <td>{registro.unidad ?? '—'}</td>
                  <td>{registro.sucursal ?? '—'}</td>
                  <td>{registro.fechaAlta ?? '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => handleSelectPersona(registro)}
                    >
                      Gestionar
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <footer className="table-footer">
        <span>{footerLabel}</span>
        <div className="pagination">
          <button
            aria-label="Anterior"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={safePage <= 1}
          >
            ‹
          </button>
          <button
            aria-label="Siguiente"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={safePage >= totalPages}
          >
            ›
          </button>
        </div>
      </footer>
      <p className="form-info">Seleccioná un registro para gestionarlo en una nueva página.</p>
    </DashboardLayout>
  );

  const detailHeaderContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={handleClearSelection}>
        ← Volver a liquidaciones
      </button>
    </div>
  );

  const detailView = (
    <DashboardLayout
      title="Liquidaciones"
      subtitle={selectedPersonaLabel ? `Gestión de ${selectedPersonaLabel}` : 'Gestión de liquidaciones'}
      headerContent={detailHeaderContent}
    >
      <section className="personal-edit-section">
        <div className="card-header card-header--compact">
          <h2>Liquidaciones del personal</h2>
        </div>

        <p className="form-info">
          {detailLoading
            ? 'Cargando información del personal seleccionado...'
            : `Gestioná las liquidaciones de ${selectedPersonaLabel ?? 'este personal'}.`}
        </p>
        {detailError ? <p className="form-info form-info--error">{detailError}</p> : null}

        <div className="quincena-filters">
          <label>
            <span>Mes</span>
            <select value={liquidacionMonthFilter} onChange={(event) => setLiquidacionMonthFilter(event.target.value)}>
              {liquidacionMonthOptions.map((option) => (
                <option key={`month-option-${option.value || 'all'}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Quincena</span>
            <select
              value={liquidacionFortnightFilter}
              onChange={(event) => setLiquidacionFortnightFilter(event.target.value)}
            >
              {liquidacionFortnightOptions.map((option) => (
                <option key={`fortnight-option-${option.value || 'all'}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!detailLoading && !detailError && detail && filteredLiquidacionSections.length === 0 ? (
          <p className="form-info">
            No hay liquidaciones cargadas para este personal. Podés subir nuevas utilizando el formulario inferior.
          </p>
        ) : null}

        {detail && filteredLiquidacionSections.length > 0 ? (
          <div className="table-wrapper liquidaciones-table">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Peso</th>
                  <th style={{ width: '200px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredLiquidacionSections.map((monthSection) => (
                  <React.Fragment key={`month-${monthSection.monthKey}`}>
                    {monthSection.sections.map((section) => (
                      <React.Fragment key={`month-${monthSection.monthKey}-${section.key}`}>
                        <tr className="fortnight-row">
                          <td colSpan={5}>
                            <strong>{monthSection.monthLabel}</strong>
                            <span className="fortnight-row__separator">•</span>
                            <span>{section.label}</span>
                          </td>
                        </tr>
                        {section.rows.map((group) => {
                          const isDeletingMain = deletingDocumentIds.has(group.main.id);
                          return (
                            <React.Fragment key={group.main.id}>
                              <tr>
                                <td>{group.main.nombre ?? `Documento #${group.main.id}`}</td>
                                <td>{group.main.tipoNombre ?? '—'}</td>
                                <td>
                                  {group.main.fechaVencimiento
                                    ? group.main.fechaVencimiento
                                    : group.main.requiereVencimiento
                                      ? 'Requiere fecha'
                                      : group.main.fechaCarga ?? '—'}
                                </td>
                                <td>{formatFileSize(group.main.size)}</td>
                                <td className="table-actions">
                                  <button
                                    type="button"
                                    className="secondary-action"
                                    onClick={() => handleDownloadDocumento(group.main)}
                                    disabled={isDeletingMain}
                                  >
                                    Descargar
                                  </button>
                                  {group.main.mime?.startsWith('image/') ? (
                                    <button
                                      type="button"
                                      className="secondary-action secondary-action--ghost"
                                      onClick={() => handlePreviewDocument(group.main)}
                                    >
                                      Vista previa
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="secondary-action secondary-action--danger"
                                    onClick={() => handleDeleteDocumento(group.main)}
                                    disabled={isDeletingMain}
                                  >
                                    Borrar
                                  </button>
                                </td>
                              </tr>
                              {group.attachments.map((attachment) => {
                                const isDeletingAttachment = deletingDocumentIds.has(attachment.id);
                                return (
                                  <tr
                                    key={`${group.main.id}-attachment-${attachment.id}`}
                                    className="attachment-row"
                                  >
                                    <td>
                                      <div className="attachment-name">
                                        <span className="attachment-chip">Adjunto</span>
                                        <span>{attachment.nombre ?? `Documento #${attachment.id}`}</span>
                                      </div>
                                    </td>
                                    <td>{attachment.tipoNombre ?? group.main.tipoNombre ?? '—'}</td>
                                    <td>
                                      {attachment.fechaVencimiento
                                        ? attachment.fechaVencimiento
                                        : attachment.requiereVencimiento
                                          ? 'Requiere fecha'
                                          : attachment.fechaCarga ?? '—'}
                                    </td>
                                    <td>{formatFileSize(attachment.size)}</td>
                                    <td className="table-actions">
                                      <button
                                        type="button"
                                        className="secondary-action"
                                        onClick={() => handleDownloadDocumento(attachment)}
                                        disabled={isDeletingAttachment}
                                      >
                                        Descargar
                                      </button>
                                      {attachment.mime?.startsWith('image/') ? (
                                        <button
                                          type="button"
                                          className="secondary-action secondary-action--ghost"
                                          onClick={() => handlePreviewDocument(attachment)}
                                        >
                                          Vista previa
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        className="secondary-action secondary-action--danger"
                                        onClick={() => handleDeleteDocumento(attachment)}
                                        disabled={isDeletingAttachment}
                                      >
                                        Borrar
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="form-grid" style={{ marginTop: '1.5rem' }}>
          <label className="input-control">
            <span>Tipo de documento</span>
            <input
              type="text"
              value={
                liquidacionType?.nombre
                  ?? selectedDocumentType?.nombre
                  ?? 'Liquidación'
              }
              readOnly
            />
          </label>
          {selectedDocumentType?.vence ? (
            <label className="input-control">
              <span>Fecha de vencimiento</span>
              <input
                type="date"
                value={documentExpiry}
                onChange={(event) => setDocumentExpiry(event.target.value)}
              />
            </label>
          ) : null}
        </div>

        {documentTypesError ? (
          <p className="form-info form-info--error">{documentTypesError}</p>
        ) : null}

        <div className="upload-dropzone" role="presentation">
          <div className="upload-dropzone__icon">📄</div>
          <p>Arrastra y suelta liquidaciones aquí</p>
          <label className="secondary-action" style={{ cursor: 'pointer' }}>
            Seleccionar archivos
            <input
              type="file"
              multiple
              onChange={handlePendingFilesSelect}
              style={{ display: 'none' }}
            />
          </label>
          <button
            type="button"
            className="secondary-action secondary-action--ghost"
            onClick={handleOpenPasteModal}
          >
            Pegar captura (Ctrl+V)
          </button>
          {imagePreviews.length > 0 ? (
            <div className="pending-upload-previews">
              {imagePreviews.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="pending-upload-previews__item"
                  onClick={() => openPreviewModal(item.previewUrl, item.file.name)}
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
        {pendingUploads.length > 0 ? (
          <ul className="pending-upload-list">
            {pendingUploads.map((item) => (
              <li key={item.id}>
                  <div>
                    <strong>{item.file.name}</strong>
                    <span>{item.typeName ?? 'Sin tipo asignado'}</span>
                    {item.fechaVencimiento ? <span>Vence: {item.fechaVencimiento}</span> : null}
                  </div>
                  <button
                    type="button"
                    className="pending-upload-remove"
                    onClick={() => handleRemovePendingUpload(item.id)}
                    aria-label={`Quitar ${item.file.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {uploadStatus ? (
          <p
            className={
              uploadStatus.type === 'error' ? 'form-info form-info--error' : 'form-info form-info--success'
            }
          >
            {uploadStatus.message}
          </p>
        ) : null}

        {previewModalImage ? (
          <div
            className="preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Vista previa de ${previewModalImage.label}`}
            onClick={closePreviewModal}
          >
            <div className="preview-modal__content" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="preview-modal__close"
                aria-label="Cerrar vista previa"
                onClick={closePreviewModal}
              >
                ×
              </button>
              <img
                src={previewModalImage.url}
                alt={`Vista ampliada de ${previewModalImage.label}`}
                className="preview-modal__image"
              />
              <p className="preview-modal__caption">{previewModalImage.label}</p>
            </div>
          </div>
        ) : null}

        <div className="form-actions">
          <button
            type="button"
            className="secondary-action"
            onClick={clearPendingUploads}
            disabled={pendingUploads.length === 0}
          >
            Limpiar selección
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={handleUploadDocumentos}
            disabled={
              uploading ||
              pendingUploads.length === 0 ||
              documentTypesLoading ||
              !selectedPersonaId ||
              !selectedDocumentTypeId
            }
          >
            {uploading ? 'Subiendo...' : 'Subir liquidaciones'}
          </button>
        </div>

        {showPasteModal ? (
          <div className="paste-overlay" role="dialog" aria-modal="true">
            <div className="paste-modal">
              <h3>Pegar liquidación desde el portapapeles</h3>
              <p className="paste-modal__hint">Hacé clic en el cuadro y presioná Ctrl + V para pegar la imagen.</p>
              <textarea
                ref={pasteTextareaRef}
                onPaste={handlePasteAreaPaste}
                placeholder="Ctrl + V para pegar la captura…"
                spellCheck={false}
              />
              {pasteError ? <p className="form-info form-info--error">{pasteError}</p> : null}
              <div className="paste-modal__actions">
                <button type="button" className="secondary-action" onClick={handleClosePasteModal}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </DashboardLayout>
  );

  return personaIdFromRoute && selectedPersonaId ? detailView : listView;
};

const UsersPage: React.FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingUsuarioId, setDeletingUsuarioId] = useState<number | null>(null);
  const authUser = useStoredAuthUser();
  const isAdmin = useMemo(() => {
    const normalized = authUser?.role?.toLowerCase() ?? '';
    return normalized.includes('admin');
  }, [authUser?.role]);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchUsuarios = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${apiBaseUrl}/api/usuarios`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: Usuario[] };
        if (!payload || !Array.isArray(payload.data)) {
          throw new Error('Formato de respuesta inesperado');
        }

        setUsuarios(payload.data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setError((err as Error).message ?? 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchUsuarios();

    return () => controller.abort();
  }, [apiBaseUrl, isAdmin]);

  const filteredUsuarios = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term.length === 0) {
      return usuarios;
    }

    return usuarios.filter((usuario) => {
      const fields = [
        usuario.name,
        usuario.email,
        usuario.created_at?.toString(),
        formatRoleLabel(usuario.role ?? null),
        usuario.role,
      ];
      return fields.some((field) => field?.toLowerCase().includes(term));
    });
  }, [usuarios, searchTerm]);

  const footerLabel = useMemo(() => {
    if (loading) {
      return 'Cargando usuarios...';
    }

    if (error) {
      return 'No se pudieron cargar los usuarios';
    }

    if (filteredUsuarios.length === 0) {
      return 'No hay usuarios para mostrar.';
    }

    if (filteredUsuarios.length === usuarios.length) {
      return `Mostrando ${usuarios.length} usuario${usuarios.length === 1 ? '' : 's'}`;
    }

    return `Mostrando ${filteredUsuarios.length} de ${usuarios.length} usuarios`;
  }, [loading, error, filteredUsuarios.length, usuarios.length]);

  const handleDeleteUsuario = async (usuario: Usuario) => {
    if (!window.confirm(`¿Seguro que deseas eliminar al usuario "${usuario.name ?? usuario.email ?? usuario.id}"?`)) {
      return;
    }

    try {
      setDeletingUsuarioId(usuario.id);
      const response = await fetch(`${apiBaseUrl}/api/usuarios/${usuario.id}`, {
        method: 'DELETE',
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

      setUsuarios((prev) => prev.filter((item) => item.id !== usuario.id));
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo eliminar el usuario.');
    } finally {
      setDeletingUsuarioId(null);
    }
  };

  const headerContent = (
    <div className="card-header">
      <div className="search-wrapper">
        <input
          type="search"
          placeholder="Buscar"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>
      <button className="primary-action" type="button" onClick={() => navigate('/usuarios/nuevo')}>
        Registrar usuario
      </button>
    </div>
  );

  if (!authUser?.role) {
    return (
      <DashboardLayout title="Gestionar usuarios" subtitle="Gestionar usuarios" headerContent={headerContent}>
        <p className="form-info">Verificando permisos...</p>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/clientes" replace />;
  }

  return (
    <DashboardLayout title="Gestionar usuarios" subtitle="Gestionar usuarios" headerContent={headerContent}>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Creado</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7}>Cargando usuarios...</td>
              </tr>
            )}

            {error && !loading && (
              <tr>
                <td colSpan={7} className="error-cell">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && filteredUsuarios.length === 0 && (
              <tr>
                <td colSpan={7}>No hay usuarios para mostrar.</td>
              </tr>
            )}

            {!loading &&
              !error &&
              filteredUsuarios.map((usuario) => {
                const statusValue = (usuario.status ?? 'activo').toLowerCase();
                const statusLabel = statusValue === 'inactivo' ? 'Inactivo' : 'Activo';
                const userRoleLabel = formatRoleLabel(usuario.role);

                return (
                  <tr key={usuario.id}>
                    <td>{usuario.id}</td>
                    <td>{usuario.name ?? '—'}</td>
                    <td>{usuario.email ?? '—'}</td>
                    <td>{usuario.created_at ?? '—'}</td>
                    <td>{userRoleLabel}</td>
                    <td>
                      <span className={`status-badge${statusValue === 'inactivo' ? ' is-inactive' : ''}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          aria-label={`Editar usuario ${usuario.name ?? ''}`}
                          onClick={() => navigate(`/usuarios/${usuario.id}/editar`)}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          aria-label={`Eliminar usuario ${usuario.name ?? ''}`}
                          onClick={() => handleDeleteUsuario(usuario)}
                          disabled={deletingUsuarioId === usuario.id}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <footer className="table-footer">
        <span>{footerLabel}</span>
        <div className="pagination">
          <button disabled aria-label="Anterior">
            ‹
          </button>
          <button disabled aria-label="Siguiente">
            ›
          </button>
        </div>
      </footer>
    </DashboardLayout>
  );
};

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const authUser = useStoredAuthUser();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const celebrationTriggeredRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!authUser?.id) {
      setLoading(false);
      setError('No se pudo identificar al usuario autenticado.');
      return;
    }

    const controller = new AbortController();

    const fetchNotifications = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${apiBaseUrl}/api/notificaciones?userId=${authUser.id}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: NotificationRecord[] };
        setNotifications(payload.data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setError((err as Error).message ?? 'No se pudieron cargar las notificaciones.');
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    return () => controller.abort();
  }, [apiBaseUrl, authUser?.id, refreshTick]);

  useEffect(() => {
    if (loading || error) {
      return;
    }

    const celebratory = notifications.find((notification) => {
      if (celebrationTriggeredRef.current.has(notification.id)) {
        return false;
      }

      if (notification.readAt) {
        return false;
      }

      if (hasCelebrationBeenDismissed(notification.id)) {
        return false;
      }

      if (notification.metadata?.celebration === true) {
        return true;
      }

      if (notification.message && /¡felicitaciones/i.test(notification.message)) {
        return true;
      }

      return false;
    });

    if (!celebratory) {
      return;
    }

    celebrationTriggeredRef.current.add(celebratory.id);

    const metadata = celebratory.metadata ?? {};
    const metadataTitle =
      typeof metadata.celebration_title === 'string' && metadata.celebration_title.trim().length > 0
        ? metadata.celebration_title.trim()
        : '¡Felicitaciones!';
    const metadataMessage =
      typeof metadata.celebration_message === 'string' && metadata.celebration_message.trim().length > 0
        ? metadata.celebration_message.trim()
        : null;
    const metadataDetail =
      typeof metadata.celebration_detail === 'string' && metadata.celebration_detail.trim().length > 0
        ? metadata.celebration_detail.trim()
        : null;

    const personaLabelFromMetadata =
      typeof metadata.persona_full_name === 'string' && metadata.persona_full_name.trim().length > 0
        ? metadata.persona_full_name.trim()
        : null;
    const personaLabel = personaLabelFromMetadata
      ?? (celebratory.personaNombre && celebratory.personaNombre.trim().length > 0
        ? celebratory.personaNombre.trim()
        : null);

    const fallbackMessage = celebratory.message && celebratory.message.trim().length > 0
      ? celebratory.message.trim()
      : (personaLabel ? `¡Se aprobó la solicitud de ${personaLabel}!` : '¡Solicitud aprobada!');

    const fallbackDetail = personaLabel
      ? `El alta de ${personaLabel} ya está activa.`
      : null;

    window.dispatchEvent(
      new CustomEvent('celebration:trigger', {
        detail: {
          title: metadataTitle,
          message: metadataMessage ?? fallbackMessage,
          detail: metadataDetail ?? fallbackDetail ?? undefined,
          notificationId: celebratory.id,
        },
      })
    );
  }, [error, loading, notifications]);

  const handleMarkAsRead = async (notification: NotificationRecord) => {
    if (!authUser?.id || notification.readAt) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/notificaciones/${notification.id}/leer`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      markCelebrationAsDismissed(notification.id);
      setRefreshTick((value) => value + 1);
      window.dispatchEvent(new CustomEvent('notifications:updated'));
      window.dispatchEvent(new CustomEvent('personal:updated'));
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo marcar la notificación.');
    }
  };

  const headerContent = (
    <div className="card-header card-header--compact">
      <button
        type="button"
        className="secondary-action"
        onClick={() => setRefreshTick((value) => value + 1)}
      >
        Actualizar
      </button>
    </div>
  );

  const renderStatusBadge = (notification: NotificationRecord) => {
    const isRead = Boolean(notification.readAt);
    return (
      <span className={`status-badge${isRead ? ' is-inactive' : ''}`}>
        {isRead ? 'Leída' : 'Sin leer'}
      </span>
    );
  };

  return (
    <DashboardLayout title="Notificaciones" subtitle="Alertas asignadas" headerContent={headerContent}>
      {!authUser?.id ? (
        <p className="form-info form-info--error">
          Debes iniciar sesión para ver tus notificaciones.
        </p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Mensaje</th>
                <th>Relacionado</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5}>Cargando notificaciones...</td>
                </tr>
              )}

              {error && !loading && (
                <tr>
                  <td colSpan={5} className="error-cell">
                    {error}
                  </td>
                </tr>
              )}

              {!loading && !error && notifications.length === 0 && (
                <tr>
                  <td colSpan={5}>No tienes notificaciones por el momento.</td>
                </tr>
              )}

              {!loading &&
                !error &&
                notifications.map((notification) => (
                  <tr key={notification.id}>
                    <td>{notification.createdAtLabel ?? notification.createdAt ?? '—'}</td>
                    <td>{notification.message ?? '—'}</td>
                    <td>
                      {notification.reclamoId ? (
                        <button
                          type="button"
                          className="secondary-action secondary-action--ghost"
                          onClick={() => navigate(`/reclamos/${notification.reclamoId}`)}
                        >
                          {notification.reclamoCodigo ?? `Reclamo #${notification.reclamoId}`}
                        </button>
                      ) : notification.workflowTaskId ? (
                        <button
                          type="button"
                          className="secondary-action secondary-action--ghost"
                          onClick={() => navigate('/flujo-trabajo')}
                        >
                          {notification.workflowTaskLabel ?? 'Tarea asignada'}
                        </button>
                      ) : notification.personaId ? (
                        <button
                          type="button"
                          className="secondary-action secondary-action--ghost"
                          onClick={() => navigate(`/aprobaciones?personaId=${notification.personaId}`)}
                        >
                          {notification.personaNombre?.trim().length
                            ? notification.personaNombre
                            : `Personal #${notification.personaId}`}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{renderStatusBadge(notification)}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(notification)}
                          disabled={Boolean(notification.readAt)}
                          aria-label="Marcar como leída"
                        >
                          ✅
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
};

const AttendanceLogPage: React.FC = () => {
  const authUser = useStoredAuthUser();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const isAdmin = useMemo(() => {
    const normalized = authUser?.role?.toLowerCase() ?? '';
    return normalized.includes('admin');
  }, [authUser?.role]);
  const [log, setLog] = useState<AttendanceRecord[]>(() => readAttendanceLogFromStorage());
  const [remoteLog, setRemoteLog] = useState<AttendanceRecord[] | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(true);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setLog(readAttendanceLogFromStorage());
    window.addEventListener('attendance:updated', handler);
    return () => window.removeEventListener('attendance:updated', handler);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchRemoteLog = async () => {
      try {
        setRemoteLoading(true);
        setRemoteError(null);

        const response = await fetch(`${apiBaseUrl}/api/attendance?limit=500`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data?: RemoteAttendanceApiRecord[] };
        setRemoteLog(payload.data ? mapRemoteAttendance(payload.data) : []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setRemoteError((err as Error).message ?? 'No se pudo cargar el registro remoto de asistencia.');
        setRemoteLog(null);
      } finally {
        setRemoteLoading(false);
      }
    };

    fetchRemoteLog();

    return () => controller.abort();
  }, [apiBaseUrl, refreshTick]);

  const effectiveLog = useMemo(() => {
    if (remoteLog && remoteLog.length > 0) {
      return remoteLog;
    }
    return log;
  }, [log, remoteLog]);

  const durationLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    const chronological = [...effectiveLog].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const lastEntryByUser = new Map<string, AttendanceRecord>();

    chronological.forEach((record) => {
      const userKey = record.userKey ?? buildAttendanceUserKey(record);
      if (record.status === 'entrada') {
        lastEntryByUser.set(userKey, record);
      } else {
        const entry = lastEntryByUser.get(userKey);
        if (entry) {
          lookup.set(record.timestamp, formatElapsedTime(entry.timestamp, record.timestamp));
          lastEntryByUser.delete(userKey);
        } else {
          lookup.set(record.timestamp, '—');
        }
      }
    });

    return lookup;
  }, [effectiveLog]);

  const handleClearLog = () => {
    if (!window.confirm('¿Seguro que deseas limpiar el registro local de marcaciones?')) {
      return;
    }
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ATTENDANCE_LOG_KEY);
      clearAttendanceStore();
    }
    setLog([]);
    window.dispatchEvent(new CustomEvent('attendance:updated', { detail: null }));
  };

  if (!isAdmin) {
    return <Navigate to="/clientes" replace />;
  }

  const sortedLog = [...effectiveLog].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const headerContent = (
    <div className="card-header card-header--compact">
      <button
        type="button"
        className="secondary-action"
        onClick={() => setRefreshTick((value) => value + 1)}
        disabled={remoteLoading}
      >
        {remoteLoading ? 'Actualizando...' : 'Actualizar'}
      </button>
      <button
        type="button"
        className="secondary-action"
        onClick={handleClearLog}
        disabled={sortedLog.length === 0}
      >
        Limpiar registro local
      </button>
    </div>
  );

  return (
    <DashboardLayout title="Control horario" subtitle="Registro de marcaciones" headerContent={headerContent}>
      <div className="table-wrapper">
        {remoteError ? <p className="form-info form-info--error">{remoteError}</p> : null}
        {remoteLoading ? <p className="form-info">Sincronizando registro remoto...</p> : null}
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Operador</th>
              <th>Acción</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Horas trabajadas</th>
            </tr>
          </thead>
          <tbody>
            {sortedLog.length === 0 ? (
              <tr>
                <td colSpan={6}>No hay marcaciones registradas todavía.</td>
              </tr>
            ) : (
              sortedLog.map((item, index) => {
                const date = new Date(item.timestamp);
                const dateLabel = date.toLocaleDateString('es-AR', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                });
                const timeLabel = date.toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false,
                });
                const operatorLabel =
                  item.userName && item.userName.trim().length > 0 ? item.userName.trim() : '—';
                const userKey = item.userKey ?? buildAttendanceUserKey(item);
                const hoursLabel =
                  item.status === 'salida' ? durationLookup.get(item.timestamp) ?? '—' : '—';
                return (
                  <tr key={`${item.timestamp}-${index}`}>
                    <td>{index + 1}</td>
                    <td>
                      {operatorLabel !== '—' ? (
                        <button
                          type="button"
                          className="secondary-action secondary-action--ghost"
                          onClick={() =>
                            navigate(
                              `/control-horario/${encodeURIComponent(userKey)}?nombre=${encodeURIComponent(
                                operatorLabel
                              )}`
                            )
                          }
                        >
                          {operatorLabel}
                        </button>
                      ) : (
                        operatorLabel
                      )}
                    </td>
                    <td>{item.status === 'entrada' ? 'Entrada' : 'Salida'}</td>
                    <td>{dateLabel}</td>
                    <td>{timeLabel}</td>
                    <td>{hoursLabel}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
};

const AttendanceUserDetailPage: React.FC = () => {
  const { userKey: encodedUserKey } = useParams<{ userKey: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [log, setLog] = useState<AttendanceRecord[]>(() => readAttendanceLogFromStorage());
  const [selectedMonth, setSelectedMonth] = useState(() => formatMonthValue(new Date()));
  const [remoteLog, setRemoteLog] = useState<AttendanceRecord[] | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(true);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const handler = () => setLog(readAttendanceLogFromStorage());
    window.addEventListener('attendance:updated', handler);
    return () => window.removeEventListener('attendance:updated', handler);
  }, []);

  const decodedUserKey = useMemo(() => {
    if (!encodedUserKey) {
      return '';
    }
    try {
      return decodeURIComponent(encodedUserKey);
    } catch {
      return encodedUserKey;
    }
  }, [encodedUserKey]);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryName = searchParams.get('nombre');
  const userIdFromKey = useMemo(() => {
    if (decodedUserKey.startsWith('id-')) {
      const numeric = Number(decodedUserKey.replace('id-', ''));
      return Number.isNaN(numeric) ? null : numeric;
    }
    return null;
  }, [decodedUserKey]);

  useEffect(() => {
    if (!userIdFromKey) {
      setRemoteLog(null);
      setRemoteLoading(false);
      setRemoteError(null);
      return;
    }

    const controller = new AbortController();

    const fetchRemote = async () => {
      try {
        setRemoteLoading(true);
        setRemoteError(null);

        const response = await fetch(
          `${apiBaseUrl}/api/attendance?userId=${userIdFromKey}&limit=500`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data?: RemoteAttendanceApiRecord[] };
        setRemoteLog(payload.data ? mapRemoteAttendance(payload.data) : []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setRemoteError((err as Error).message ?? 'No se pudo cargar la asistencia desde el servidor.');
        setRemoteLog(null);
      } finally {
        setRemoteLoading(false);
      }
    };

    fetchRemote();

    return () => controller.abort();
  }, [apiBaseUrl, userIdFromKey, refreshTick]);

  const userLog = useMemo(() => {
    if (!decodedUserKey) {
      return [] as AttendanceRecord[];
    }
    return log.filter((record) => (record.userKey ?? buildAttendanceUserKey(record)) === decodedUserKey);
  }, [log, decodedUserKey]);

  const effectiveUserLog = useMemo(() => {
    if (remoteLog && remoteLog.length > 0) {
      return remoteLog;
    }
    return userLog;
  }, [remoteLog, userLog]);

  const displayName = useMemo(() => {
    const fromQuery = queryName?.trim();
    if (fromQuery && fromQuery.length > 0) {
      return fromQuery;
    }
    const firstRecord = effectiveUserLog.find((item) => item.userName && item.userName.trim().length > 0);
    if (firstRecord?.userName) {
      return firstRecord.userName.trim();
    }
    if (decodedUserKey.startsWith('id-')) {
      return `Usuario #${decodedUserKey.replace('id-', '')}`;
    }
    return 'Operador';
  }, [queryName, effectiveUserLog, decodedUserKey]);

  const monthRange = useMemo(() => {
    if (!selectedMonth || !/^\d{4}-\d{2}$/.test(selectedMonth)) {
      return null;
    }
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (Number.isNaN(year) || Number.isNaN(monthIndex)) {
      return null;
    }
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 1);
    return { start, end };
  }, [selectedMonth]);

  const monthlySessions = useMemo(() => {
    if (!monthRange) {
      return [] as Array<{
        entry: AttendanceRecord | null;
        exit: AttendanceRecord | null;
        durationMs: number;
        effectiveStart: Date;
        effectiveEnd: Date;
      }>;
    }

    const chronological = [...effectiveUserLog].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const sessions: Array<{
      entry: AttendanceRecord | null;
      exit: AttendanceRecord | null;
      durationMs: number;
      effectiveStart: Date;
      effectiveEnd: Date;
    }> = [];
    let pending: AttendanceRecord | null = null;

    chronological.forEach((record) => {
      const recordDate = new Date(record.timestamp);
      if (Number.isNaN(recordDate.getTime())) {
        return;
      }
      if (record.status === 'entrada') {
        pending = record;
        return;
      }

      if (record.status === 'salida') {
        if (!pending) {
          return;
        }

        const entryDate = new Date(pending.timestamp);
        const exitDate = recordDate;
        const effectiveStart =
          monthRange.start > entryDate ? monthRange.start : entryDate;
        const effectiveEnd = monthRange.end < exitDate ? monthRange.end : exitDate;

        if (effectiveEnd > effectiveStart) {
          sessions.push({
            entry: pending,
            exit: record,
            durationMs: effectiveEnd.getTime() - effectiveStart.getTime(),
            effectiveStart,
            effectiveEnd,
          });
        }

        pending = null;
      }
    });

    return sessions;
  }, [effectiveUserLog, monthRange]);

  const totalDurationMs = useMemo(
    () => monthlySessions.reduce((acc, session) => acc + session.durationMs, 0),
    [monthlySessions]
  );

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/control-horario')}>
        ← Volver al registro
      </button>
      <button
        type="button"
        className="secondary-action"
        onClick={() => setRefreshTick((value) => value + 1)}
        disabled={!userIdFromKey || remoteLoading}
      >
        {remoteLoading ? 'Actualizando...' : 'Actualizar'}
      </button>
    </div>
  );

  if (!decodedUserKey) {
    return (
      <DashboardLayout title="Detalle de asistencia" subtitle="Control horario por operador" headerContent={headerContent}>
        <p className="form-info form-info--error">Operador no válido.</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Detalle de asistencia"
      subtitle={`Operador: ${displayName}`}
      headerContent={headerContent}
    >
      <div className="attendance-detail">
        {remoteError ? <p className="form-info form-info--error">{remoteError}</p> : null}
        {remoteLoading ? <p className="form-info">Sincronizando registro remoto...</p> : null}
        <div className="attendance-detail__filters">
          <label className="input-control">
            <span>Mes</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            />
          </label>
          <div className="attendance-detail__summary">
            <strong>Total registrado:</strong> {formatDurationFromMs(totalDurationMs)}
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Horas trabajadas</th>
              </tr>
            </thead>
            <tbody>
              {monthlySessions.length === 0 ? (
                <tr>
                  <td colSpan={5}>No hay marcaciones registradas en este mes para el operador.</td>
                </tr>
              ) : (
                monthlySessions.map((session, index) => {
                  const entryDate = session.entry ? new Date(session.entry.timestamp) : null;
                  const exitDate = session.exit ? new Date(session.exit.timestamp) : null;
                  const dateLabel = entryDate
                    ? entryDate.toLocaleDateString('es-AR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      })
                    : exitDate
                    ? exitDate.toLocaleDateString('es-AR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      })
                    : '—';

                  const formatTime = (date: Date | null) =>
                    date
                      ? date.toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false,
                        })
                      : '—';

                  return (
                    <tr key={`${session.entry?.timestamp ?? session.exit?.timestamp ?? index}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{dateLabel}</td>
                      <td>{formatTime(entryDate)}</td>
                      <td>{formatTime(exitDate)}</td>
                      <td>{formatDurationFromMs(session.durationMs)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

const WorkflowPage: React.FC = () => {
  const authUser = useStoredAuthUser();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [tasks, setTasks] = useState<WorkflowTaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<Array<{ id: number; nombre: string | null; email: string | null }>>([]);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formResponsibleId, setFormResponsibleId] = useState('');
  const [responsableQuery, setResponsableQuery] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const fetchAgents = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/workflow-tasks/users`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: Array<{ id: number; nombre: string | null; email: string | null }> };
        setAgents(payload.data ?? []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        // eslint-disable-next-line no-console
        console.error('No se pudieron cargar los agentes', err);
      }
    };

    fetchAgents();

    return () => controller.abort();
  }, [apiBaseUrl]);

  const currentActorId = useMemo(() => {
    if (authUser?.id != null) {
      return Number(authUser.id);
    }
    const normalizedName = authUser?.name?.trim().toLowerCase();
    const normalizedEmail = authUser?.email?.trim().toLowerCase();
    if (!normalizedName && !normalizedEmail) {
      return null;
    }
    const match = agents.find((agent) => {
      const agentName = (agent.nombre ?? '').trim().toLowerCase();
      const agentEmail = (agent.email ?? '').trim().toLowerCase();
      return (normalizedName && agentName === normalizedName) || (normalizedEmail && agentEmail === normalizedEmail);
    });
    return match?.id ?? null;
  }, [authUser?.id, authUser?.name, authUser?.email, agents]);

  const fetchTasks = useCallback(async () => {
    if (currentActorId == null) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiBaseUrl}/api/workflow-tasks?userId=${currentActorId}`);

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const payload = (await response.json()) as { data: WorkflowTaskRecord[] };
      setTasks(payload.data ?? []);
    } catch (err) {
      setError((err as Error).message ?? 'No se pudieron cargar las tareas.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, currentActorId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks, refreshTick]);

  const agentOptions = useMemo(
    () =>
      agents.map((agent) => ({
        id: agent.id,
        label: agent.nombre?.trim() && agent.nombre.trim().length > 0 ? agent.nombre.trim() : `Agente #${agent.id}`,
      })),
    [agents]
  );

  useEffect(() => {
    if (!formResponsibleId) {
      return;
    }
    const match = agentOptions.find((option) => String(option.id) === String(formResponsibleId));
    if (match && responsableQuery !== match.label) {
      setResponsableQuery(match.label);
    }
  }, [agentOptions, formResponsibleId, responsableQuery]);

  const columns = useMemo(
    () =>
      [
        { status: 'nueva' as WorkflowStatus, title: 'Nueva tarea' },
        { status: 'proceso' as WorkflowStatus, title: 'En proceso' },
        { status: 'finalizado' as WorkflowStatus, title: 'Finalizado' },
      ].map((column) => ({
        ...column,
        tasks: tasks.filter((task) => task.status === column.status),
      })),
    [tasks]
  );

  const handleAddTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (currentActorId == null) {
      window.alert('Debes iniciar sesión para crear tareas.');
      return;
    }
    if (!formResponsibleId) {
      window.alert('Selecciona un responsable para la tarea.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiBaseUrl}/api/workflow-tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          titulo: formTitle.trim(),
          descripcion: formDescription.trim() || null,
          creatorId: currentActorId,
          responsableId: Number(formResponsibleId),
        }),
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

      setFormTitle('');
      setFormDescription('');
      setFormResponsibleId('');
      setResponsableQuery('');
      setRefreshTick((value) => value + 1);
    } catch (err) {
      setError((err as Error).message ?? 'No se pudo crear la tarea.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (currentActorId == null) {
      window.alert('Debes iniciar sesión para exportar las tareas.');
      return;
    }

    try {
      setExporting(true);
      const response = await fetch(`${apiBaseUrl}/api/workflow-tasks/export?userId=${currentActorId}`, {
        headers: { Accept: 'text/csv' },
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `workflow-tasks-${timestamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo exportar la lista de tareas.');
    } finally {
      setExporting(false);
    }
  };

  const handleDrop = async (status: WorkflowStatus, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (currentActorId == null) {
      return;
    }
    const taskId = event.dataTransfer.getData('text/plain');
    if (!taskId) {
      return;
    }
    const numericId = Number(taskId);
    if (Number.isNaN(numericId)) {
      return;
    }
    const targetTask = tasks.find((task) => task.id === numericId);
    if (!targetTask || targetTask.status === status) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/workflow-tasks/${numericId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ status, actorId: currentActorId }),
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

      setRefreshTick((value) => value + 1);
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo actualizar la tarea.');
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDelete = async (taskId: number) => {
    if (currentActorId == null) {
      return;
    }

    if (!window.confirm('¿Eliminar esta tarea del flujo?')) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/workflow-tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ actorId: currentActorId }),
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

      setRefreshTick((value) => value + 1);
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo eliminar la tarea.');
    }
  };

  if (currentActorId == null) {
    return (
      <DashboardLayout title="Flujo de trabajo" subtitle="Organiza tus tareas visualmente">
        <p className="form-info form-info--error">Inicia sesión para gestionar tus tareas.</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Flujo de trabajo" subtitle="Organiza tus tareas visualmente">
      <div className="workflow-actions">
        <button type="button" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Descargando...' : 'Exportar tareas'}
        </button>
      </div>
      <section className="workflow-new-task">
        <form onSubmit={handleAddTask} className="workflow-form">
          <label>
            <span>Título de la tarea</span>
            <input
              type="text"
              value={formTitle}
              onChange={(event) => setFormTitle(event.target.value)}
              placeholder="Ej: Contactar cliente"
              required
            />
          </label>
          <label>
            <span>Descripción (opcional)</span>
            <textarea
              value={formDescription}
              onChange={(event) => setFormDescription(event.target.value)}
              rows={2}
              placeholder="Notas o contexto…"
            />
          </label>
          <label>
            <span>Responsable</span>
            <input
              type="text"
              list="workflow-responsables"
              value={responsableQuery}
              onChange={(event) => {
                const { value } = event.target;
                setResponsableQuery(value);
                const match = agentOptions.find(
                  (option) => option.label.toLowerCase() === value.trim().toLowerCase()
                );
                setFormResponsibleId(match ? String(match.id) : '');
              }}
              placeholder="Busca o selecciona al agente"
              required
            />
            <datalist id="workflow-responsables">
              {agentOptions.map((option) => (
                <option key={option.id} value={option.label} />
              ))}
            </datalist>
          </label>
          <button type="submit" className="primary-action" disabled={loading}>
            {loading ? 'Guardando...' : 'Agregar tarea'}
          </button>
        </form>
        {error ? <p className="form-info form-info--error">{error}</p> : null}
      </section>

      <section className="workflow-board">
        {columns.map((column) => (
          <div
            key={column.status}
            className="workflow-column"
            onDragOver={handleDragOver}
            onDrop={(event) => handleDrop(column.status, event)}
          >
            <header className="workflow-column__header">
              <h3>{column.title}</h3>
              <span>{column.tasks.length}</span>
            </header>
            <div className="workflow-column__body">
              {loading ? (
                <p className="workflow-column__empty">Cargando tareas…</p>
              ) : column.tasks.length === 0 ? (
                <p className="workflow-column__empty">
                  {column.status === 'nueva'
                    ? 'Agrega una tarea para empezar.'
                    : 'Suelta tareas aquí'}
                </p>
              ) : (
                column.tasks.map((task) => (
                  <article
                    key={task.id}
                    className="workflow-card"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', String(task.id));
                    }}
                  >
                    <div className="workflow-card__title">
                      <strong>{task.titulo}</strong>
                      <button
                        type="button"
                        className="workflow-card__delete"
                        onClick={() => handleDelete(task.id)}
                        aria-label="Eliminar tarea"
                      >
                        ×
                      </button>
                    </div>
                    {task.descripcion ? (
                      <p className="workflow-card__description">{task.descripcion}</p>
                    ) : null}
                    <footer className="workflow-card__footer">
                      <span>
                        {task.createdAt
                          ? new Date(task.createdAt).toLocaleDateString('es-AR')
                          : '—'}
                      </span>
                      {task.responsableNombre ? <span>👤 {task.responsableNombre}</span> : null}
                    </footer>
                  </article>
                ))
              )}
            </div>
          </div>
        ))}
      </section>
    </DashboardLayout>
  );
};

const ApprovalsRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const authUser = useStoredAuthUser();
  const [activeTab, setActiveTab] = useState<'list' | 'altas' | 'combustible' | 'aumento_combustible' | 'adelanto' | 'poliza'>('list');
  const [meta, setMeta] = useState<PersonalMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [backendSolicitudes, setBackendSolicitudes] = useState<PersonalRecord[]>([]);
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
        return parsed.filter((item) => typeof item === 'object' && item !== null) as PersonalRecord[];
      }
    } catch {
      // ignore parse errors
    }

    return [];
  });
  const [solicitudesLoading, setSolicitudesLoading] = useState(true);
  const [solicitudesError, setSolicitudesError] = useState<string | null>(null);
  const [solicitudesSearchTerm, setSolicitudesSearchTerm] = useState('');
  const [solicitudesPerfilFilter, setSolicitudesPerfilFilter] = useState('');
  const [solicitudesAgenteFilter, setSolicitudesAgenteFilter] = useState('');
  const [solicitudesEstadoFilter, setSolicitudesEstadoFilter] = useState('');
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const perfilNames: Record<number, string> = useMemo(
    () => ({
      1: 'Dueño y chofer',
      2: 'Chofer',
      3: 'Transportista',
    }),
    []
  );
  const createSyntheticId = () => -Math.floor(Date.now() + Math.random() * 1000);
  const appendLocalSolicitud = (record: PersonalRecord) => {
    setLocalSolicitudes((prev) => [record, ...prev]);
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
  const [reviewEditMode, setReviewEditMode] = useState(false);
  const personaIdFromQuery = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const value = searchParams.get('personaId');
    return value && value.trim().length > 0 ? value : null;
  }, [location.search]);
  const [altaSubmitting, setAltaSubmitting] = useState(false);
  const [combustibleSubmitting, setCombustibleSubmitting] = useState(false);
  const [aumentoSubmitting, setAumentoSubmitting] = useState(false);
  const [adelantoSubmitting, setAdelantoSubmitting] = useState(false);
  const [polizaSubmitting, setPolizaSubmitting] = useState(false);
  const [altaAttachments, setAltaAttachments] = useState<AltaAttachmentItem[]>([]);
  const [altaFilesVersion, setAltaFilesVersion] = useState(0);
  const [altaDocumentType, setAltaDocumentType] = useState('');
  const [altaDocumentExpiry, setAltaDocumentExpiry] = useState('');
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
  const altaAttachmentsForCurrentType = useMemo(() => {
    if (!altaDocumentTypeId) {
      return [];
    }

    return altaAttachments.filter((item) => item.typeId === altaDocumentTypeId);
  }, [altaAttachments, altaDocumentTypeId]);
  const [combustibleAttachments, setCombustibleAttachments] = useState<File[]>([]);
  const [combustibleFilesVersion, setCombustibleFilesVersion] = useState(0);
  const [aumentoAttachments, setAumentoAttachments] = useState<File[]>([]);
  const [aumentoFilesVersion, setAumentoFilesVersion] = useState(0);
  const [adelantoAttachments, setAdelantoAttachments] = useState<File[]>([]);
  const [adelantoFilesVersion, setAdelantoFilesVersion] = useState(0);
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
    combustible: false,
    fechaAlta: '',
    patente: '',
    clienteId: '',
    sucursalId: '',
    agenteId: '',
    agenteResponsableId: '',
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
  }));

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
      return;
    }

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
      return;
    }

    setActiveTab('altas');
    setReviewEditMode(false);
    const controller = new AbortController();

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
        setReviewPersonaDetail({
          ...payload.data,
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

    fetchDetail();

    return () => controller.abort();
  }, [apiBaseUrl, personaIdFromQuery]);

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
        if (payload.perfiles.length > 0) {
          setAltaForm((prev) => ({
            ...prev,
            perfilValue: prev.perfilValue !== 0 ? prev.perfilValue : payload.perfiles[0].value,
          }));
        }
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

  const fetchSolicitudes = useCallback(
    async (options?: { signal?: AbortSignal }) => {
      try {
        setSolicitudesLoading(true);
        setSolicitudesError(null);

        const response = await fetch(`${apiBaseUrl}/api/personal?esSolicitud=1`, {
          signal: options?.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: PersonalRecord[] };
        if (!payload || !Array.isArray(payload.data)) {
          throw new Error('Formato de respuesta inesperado');
        }

        setBackendSolicitudes(payload.data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setSolicitudesError((err as Error).message ?? 'No se pudieron cargar las solicitudes.');
      } finally {
        setSolicitudesLoading(false);
      }
    },
    [apiBaseUrl]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchSolicitudes({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchSolicitudes]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ persona?: PersonalRecord }>;
      const persona = customEvent.detail?.persona;

      if (persona) {
        setBackendSolicitudes((prev) => {
          const withoutPersona = prev.filter((item) => item.id !== persona.id);
          if (persona.esSolicitud) {
            return [persona, ...withoutPersona];
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
    populateAltaFormFromReview();
  }, [populateAltaFormFromReview]);

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/personal')}>
        ← Volver a personal
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
      setAltaForm((prev) => ({
        ...prev,
        [field]: value,
        ...(field === 'clienteId' ? { sucursalId: '' } : {}),
      }));
    };

  const filesFromEvent = (fileList: FileList | null) => (fileList ? Array.from(fileList) : []);

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

    setAltaAttachments((prev) => {
      const currentCount = prev.filter((item) => item.typeId === altaDocumentTypeId).length;

      const newItems = files.map((file, index) => {
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
        } as AltaAttachmentItem;
      });

      return [...prev, ...newItems];
    });

    setFlash((prev) => (prev?.type === 'error' ? null : prev));
    event.target.value = '';
  };

  const handleAltaCheckboxChange = (field: 'tarifaEspecial' | 'combustible') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setAltaForm((prev) => ({ ...prev, [field]: checked }));
  };

  const handleAltaPerfilChange = (perfilValue: number) => {
    setAltaForm((prev) => ({ ...prev, perfilValue }));
  };

  const buildAltaRequestPayload = (form: AltaRequestForm) => ({
    perfilValue: form.perfilValue,
    nombres: form.nombres.trim(),
    apellidos: form.apellidos.trim(),
    telefono: form.telefono.trim() || null,
    email: form.email.trim() || null,
    tarifaEspecial: form.tarifaEspecial,
    observacionTarifa: form.observacionTarifa.trim() || null,
    cuil: form.cuil.trim() || null,
    cbuAlias: form.cbuAlias.trim() || null,
    pago: form.pago ? Number(form.pago) : null,
    combustible: form.combustible,
    fechaAlta: form.fechaAlta || null,
    fechaAltaVinculacion: form.fechaAltaVinculacion || null,
    patente: form.patente.trim() || null,
    clienteId: form.clienteId ? Number(form.clienteId) : null,
    sucursalId: form.sucursalId ? Number(form.sucursalId) : null,
    agenteId: form.agenteId ? Number(form.agenteId) : null,
    agenteResponsableId: form.agenteResponsableId ? Number(form.agenteResponsableId) : null,
    unidadId: form.unidadId ? Number(form.unidadId) : null,
    estadoId: form.estadoId ? Number(form.estadoId) : null,
    observaciones: form.observaciones.trim() || null,
    duenoNombre: form.duenoNombre.trim() || null,
    duenoFechaNacimiento: form.duenoFechaNacimiento || null,
    duenoEmail: form.duenoEmail.trim() || null,
    duenoCuil: form.duenoCuil.trim() || null,
    duenoCuilCobrador: form.duenoCuilCobrador.trim() || null,
    duenoCbuAlias: form.duenoCbuAlias.trim() || null,
    duenoTelefono: form.duenoTelefono.trim() || null,
    duenoObservaciones: form.duenoObservaciones.trim() || null,
  });

  const handleAltaSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setAltaSubmitting(true);
      setFlash(null);

      const requestPayload = buildAltaRequestPayload(altaForm);

      const response = await fetch(`${apiBaseUrl}/api/personal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
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

      const payload = (await response.json()) as { message?: string; data?: { id?: number } };
      const personaId = payload.data?.id ?? null;

      const uploadErrors: string[] = [];
      const completedUploadIds: string[] = [];

      if (personaId && altaAttachments.length > 0) {
        for (const item of altaAttachments) {
          const tipoArchivoId = Number(item.typeId);
          if (Number.isNaN(tipoArchivoId)) {
            uploadErrors.push(`${item.file.name}: el tipo de documento no es válido.`);
            continue;
          }

          const formData = new FormData();
          formData.append('archivo', item.file);
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
            const uploadResponse = await fetch(`${apiBaseUrl}/api/personal/${personaId}/documentos`, {
              method: 'POST',
              body: formData,
            });

            if (!uploadResponse.ok) {
              let uploadMessage = `${item.file.name}: Error ${uploadResponse.status}`;
              try {
                const uploadPayload = await uploadResponse.json();
                if (typeof uploadPayload?.message === 'string') {
                  uploadMessage = `${item.file.name}: ${uploadPayload.message}`;
                } else if (uploadPayload?.errors) {
                  const firstUploadError = Object.values(uploadPayload.errors)[0];
                  if (Array.isArray(firstUploadError) && firstUploadError[0]) {
                    uploadMessage = `${item.file.name}: ${firstUploadError[0]}`;
                  }
                }
              } catch {
                // ignore
              }

              uploadErrors.push(uploadMessage);
              continue;
            }

            completedUploadIds.push(item.id);
          } catch (uploadErr) {
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

      const defaultPerfilValue = meta?.perfiles?.[0]?.value ?? 0;

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
        combustible: false,
        fechaAlta: '',
        patente: '',
        clienteId: '',
        sucursalId: '',
        agenteId: '',
        agenteResponsableId: '',
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

    try {
      setAltaSubmitting(true);
      setFlash(null);

      const requestPayload = buildAltaRequestPayload(altaForm);

      const response = await fetch(`${apiBaseUrl}/api/personal/${reviewPersonaDetail.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
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

      const payload = (await response.json()) as {
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
          formData.append('archivo', item.file);
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
            const uploadResponse = await fetch(`${apiBaseUrl}/api/personal/${personaId}/documentos`, {
              method: 'POST',
              body: formData,
            });

            if (!uploadResponse.ok) {
              let uploadMessage = `${item.file.name}: Error ${uploadResponse.status}`;
              try {
                const uploadPayload = await uploadResponse.json();
                if (typeof uploadPayload?.message === 'string') {
                  uploadMessage = `${item.file.name}: ${uploadPayload.message}`;
                } else if (uploadPayload?.errors) {
                  const firstUploadError = Object.values(uploadPayload.errors)[0];
                  if (Array.isArray(firstUploadError) && firstUploadError[0]) {
                    uploadMessage = `${item.file.name}: ${firstUploadError[0]}`;
                  }
                }
              } catch {
                // ignore
              }

              uploadErrors.push(uploadMessage);
              continue;
            }

            completedUploadIds.push(item.id);
          } catch (uploadErr) {
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

  const handleApproveSolicitud = async () => {
    if (!reviewPersonaDetail) {
      return;
    }

    try {
      setApproveLoading(true);
      setFlash(null);

      const payloadBody: Record<string, unknown> = {
        userId: authUser?.id ?? null,
      };

      if (approvalEstadoId) {
        payloadBody.estadoId = Number(approvalEstadoId);
      }

      const response = await fetch(`${apiBaseUrl}/api/personal/${reviewPersonaDetail.id}/aprobar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadBody),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = await response.json();
          if (typeof payload?.message === 'string') {
            message = payload.message;
          }
        } catch {
          // ignore parsing error
        }

        throw new Error(message);
      }

      const payload = (await response.json()) as {
        message?: string;
        data?: {
          aprobadoAt?: string | null;
          aprobadoPorId?: number | null;
          aprobadoPorNombre?: string | null;
          esSolicitud?: boolean;
          personalRecord?: PersonalRecord;
        };
      };

      setReviewPersonaDetail((prev) => {
        if (!prev) {
          return prev;
        }

        const estadoActualizadoNombre = approvalEstadoId
          ? meta?.estados?.find((estado) => String(estado.id) === approvalEstadoId)?.nombre ?? prev.estado
          : prev.estado;

        const resolvedAprobadoPorId =
          payload.data?.aprobadoPorId ?? prev.aprobadoPorId ?? (authUser?.id ?? null);
        const resolvedAprobadoPorNombre = payload.data?.aprobadoPorNombre
          ?? (resolvedAprobadoPorId === authUser?.id && authUser?.name ? authUser.name : prev.aprobadoPorNombre);

        return {
          ...prev,
          aprobado: true,
          aprobadoAt: payload.data?.aprobadoAt ?? prev.aprobadoAt,
          aprobadoPorId: resolvedAprobadoPorId,
          aprobadoPorNombre: resolvedAprobadoPorNombre,
          estadoId: approvalEstadoId ? Number(approvalEstadoId) : prev.estadoId,
          estado: estadoActualizadoNombre,
          comments: Array.isArray(prev.comments) ? prev.comments : [],
          esSolicitud: false,
        };
      });

      setFlash({
        type: 'success',
        message: payload.message ?? 'Solicitud aprobada correctamente.',
      });

      const personaNombreCompleto = [reviewPersonaDetail.nombres, reviewPersonaDetail.apellidos]
        .filter((part) => part && part.trim().length > 0)
        .join(' ')
        .trim();
      const agenteNombre =
        reviewPersonaDetail.agente && reviewPersonaDetail.agente.trim().length > 0
          ? reviewPersonaDetail.agente.trim()
          : authUser?.name ?? null;

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

      window.dispatchEvent(new CustomEvent('notifications:updated'));

      window.dispatchEvent(
        new CustomEvent('personal:updated', {
          detail: { persona: payload.data?.personalRecord },
        })
      );
    } catch (err) {
      setFlash({
        type: 'error',
        message: (err as Error).message ?? 'No se pudo aprobar la solicitud.',
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
          const payload = await response.json();
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

  const handleAdelantoFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAdelantoAttachments(filesFromEvent(event.target.files));
  };

  const handleAdelantoSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setAdelantoSubmitting(true);
      setFlash(null);

      const formSnapshot = { ...adelantoForm };
      const attachmentNames = adelantoAttachments.map((file) => file.name);
      const clienteNombre =
        formSnapshot.empresaId && meta?.clientes
          ? meta.clientes.find((cliente) => cliente.id === Number(formSnapshot.empresaId))?.nombre ?? null
          : null;
      const sucursalNombre =
        formSnapshot.sucursalId && meta?.sucursales
          ? meta.sucursales.find((sucursal) => sucursal.id === Number(formSnapshot.sucursalId))?.nombre ?? null
          : null;
      const agenteNombre = resolveAgenteNombre(formSnapshot.agenteId);

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
        estado: 'Pendiente',
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
          adjuntos: attachmentNames,
        },
      };

      appendLocalSolicitud(newRecord);

      setFlash({
        type: 'success',
        message: 'Solicitud de adelanto registrada (modo demostración).',
      });

      setAdelantoForm({
        empresaId: '',
        sucursalId: '',
        transportista: '',
        monto: '',
        fechaSolicitud: '',
        motivo: '',
        observaciones: '',
        agenteId: '',
      });
      setAdelantoAttachments([]);
      setAdelantoFilesVersion((value) => value + 1);
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
    () => [...localSolicitudes, ...backendSolicitudes],
    [localSolicitudes, backendSolicitudes]
  );

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

  const filteredSolicitudes = useMemo(() => {
    const term = solicitudesSearchTerm.trim().toLowerCase();

    return combinedSolicitudes.filter((registro) => {
      const perfilLabel = perfilNames[registro.perfilValue ?? 0] ?? registro.perfil ?? '';

      if (solicitudesPerfilFilter && perfilLabel !== solicitudesPerfilFilter) {
        return false;
      }

      if (solicitudesAgenteFilter && registro.agente !== solicitudesAgenteFilter) {
        return false;
      }

      if (solicitudesEstadoFilter && registro.estado !== solicitudesEstadoFilter) {
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
        perfilLabel,
        registro.agente,
        registro.estado,
      ];

      return fields.some((field) => field?.toLowerCase().includes(term));
    });
  }, [
    combinedSolicitudes,
    solicitudesSearchTerm,
    solicitudesPerfilFilter,
    solicitudesAgenteFilter,
    solicitudesEstadoFilter,
    perfilNames,
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
    setSolicitudesPerfilFilter('');
    setSolicitudesAgenteFilter('');
    setSolicitudesEstadoFilter('');
  };

  const handleGoToList = () => {
    setActiveTab('list');
    setReviewPersonaDetail(null);
    setReviewError(null);
    setApprovalEstadoId('');
    setReviewCommentText('');
    setReviewCommentError(null);
    setReviewCommentInfo(null);
    setReviewLoading(false);
    setReviewEditMode(false);
    if (personaIdFromQuery) {
      navigate('/aprobaciones', { replace: true });
    }
  };

  const handleOpenSolicitud = (registro: PersonalRecord) => {
    setReviewPersonaDetail(null);
    setReviewError(null);
    setApprovalEstadoId('');
    setReviewCommentText('');
    setReviewCommentError(null);
    setReviewCommentInfo(null);

    switch (registro.solicitudTipo) {
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
        if (data.form) {
          setAdelantoForm(data.form);
        }
        setAdelantoAttachments([]);
        setAdelantoFilesVersion((value) => value + 1);
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

  const renderSolicitudesList = () => (
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
          <button type="button" className="secondary-action" onClick={handleSolicitudesReset}>
            Limpiar
          </button>
        </div>
      </div>

      <div className="filters-bar filters-bar--reclamos">
        <div className="filters-grid filters-grid--reclamos">
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
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>ID</th>
              <th>Nombre</th>
              <th>Perfil</th>
              <th>Cliente</th>
              <th>Sucursal</th>
              <th>Agente</th>
              <th>Estado</th>
              <th>Fecha alta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {solicitudesLoading ? (
              <tr>
                <td colSpan={10}>Cargando solicitudes...</td>
              </tr>
            ) : solicitudesError ? (
              <tr>
                <td colSpan={10} className="error-cell">
                  {solicitudesError}
                </td>
              </tr>
            ) : filteredSolicitudes.length === 0 ? (
              <tr>
                <td colSpan={10}>No hay solicitudes pendientes.</td>
              </tr>
            ) : (
              filteredSolicitudes.map((registro) => {
                const perfilLabel = perfilNames[registro.perfilValue ?? 0] ?? registro.perfil ?? '—';
                const solicitudTipoLabel = (() => {
                  if (!registro.esSolicitud) {
                    return 'Registro de personal';
                  }
                  switch (registro.solicitudTipo) {
                    case 'alta':
                      return 'Solicitud de alta';
                    case 'combustible':
                      return 'Solicitud de combustible';
                    case 'aumento_combustible':
                      return 'Aumento de combustible';
                    case 'adelanto':
                      return 'Adelanto de pago';
                    case 'poliza':
                      return 'Solicitud de póliza';
                    default:
                      return 'Solicitud registrada';
                  }
                })();
                return (
                  <tr key={registro.id}>
                    <td>{solicitudTipoLabel}</td>
                    <td>{registro.id}</td>
                    <td>{registro.nombre ?? '—'}</td>
                    <td>{perfilLabel}</td>
                    <td>{registro.cliente ?? '—'}</td>
                    <td>{registro.sucursal ?? '—'}</td>
                    <td>{registro.agente ?? '—'}</td>
                  <td>{registro.estado ?? '—'}</td>
                  <td>{registro.fechaAlta ?? '—'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        type="button"
                        aria-label={`Abrir solicitud ${registro.nombre ?? registro.id}`}
                        onClick={() => handleOpenSolicitud(registro)}
                      >
                        {registro.solicitudTipo && registro.solicitudTipo !== 'alta' ? '↗' : '👁️'}
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

  const renderAltaPerfilSection = () => {
    switch (altaForm.perfilValue) {
      case 1:
        return (
          <div className="personal-section">
            <h3>Dueño y chofer</h3>
            <div className="form-grid">
              {renderAltaInput('Nombres', 'nombres', true)}
              {renderAltaInput('Apellidos', 'apellidos', true)}
              {renderAltaInput('Teléfono', 'telefono', false, 'tel')}
              {renderAltaInput('Correo electrónico', 'email', false, 'email')}
              {renderAltaCheckbox('Tarifa especial', 'tarifaEspecial', 'Tiene tarifa especial')}
              {renderAltaInput('Observación tarifa', 'observacionTarifa')}
              {renderAltaInput('CUIL', 'cuil')}
              {renderAltaInput('CBU/Alias', 'cbuAlias')}
              {renderAltaInput('Pago', 'pago', false, 'number')}
              {renderAltaCheckbox('Combustible', 'combustible', 'Cuenta corrientes combustible')}
              {renderAltaInput('Fecha de alta', 'fechaAlta', false, 'date')}
              {renderAltaInput('Patente', 'patente')}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="personal-section personal-section--chofer">
            <h3>Chofer</h3>
            <div className="form-grid form-grid--chofer">
              {renderAltaInput('Nombre completo', 'nombres', true)}
              {renderAltaInput('Correo electrónico', 'email', false, 'email')}
              {renderAltaInput('Teléfono', 'telefono', false, 'tel')}
              {renderAltaCheckbox('Tarifa especial', 'tarifaEspecial', 'Tiene tarifa especial')}
              {renderAltaInput('Observación tarifa', 'observacionTarifa')}
              {renderAltaInput('CUIL', 'cuil')}
              {renderAltaInput('CBU/Alias', 'cbuAlias')}
              {renderAltaCheckbox('Combustible', 'combustible', 'Cuenta corrientes combustible')}
              {renderAltaInput('Pago', 'pago', false, 'number', '0.00')}
              {renderAltaInput('Fecha de alta', 'fechaAlta', false, 'date')}
              {renderAltaInput('Patente', 'patente')}
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
              {renderAltaSelect(
                'Agente responsable',
                'agenteResponsableId',
                (meta?.agentes ?? []).map((agente) => ({
                  value: String(agente.id),
                  label: agente.name ?? `Agente #${agente.id}`,
                }))
              )}
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
              {renderAltaInput('CUIL (Dueño)', 'duenoCuil')}
              {renderAltaInput('CUIL cobrador', 'duenoCuilCobrador')}
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
            <h3>Transportista</h3>
            <div className="form-grid">
              {renderAltaInput('Nombres', 'nombres', true)}
              {renderAltaInput('Apellidos', 'apellidos', true)}
              {renderAltaInput('CUIL', 'cuil')}
              {renderAltaInput('Correo electrónico', 'email', false, 'email')}
              {renderAltaInput('Teléfono', 'telefono', false, 'tel')}
              {renderAltaCheckbox('Combustible', 'combustible', 'Cuenta corrientes combustible')}
              {renderAltaCheckbox('Tarifa especial', 'tarifaEspecial', 'Tiene tarifa especial')}
              {renderAltaInput('Observación tarifa', 'observacionTarifa')}
              {renderAltaInput('Fecha de alta', 'fechaAlta', false, 'date')}
              {renderAltaInput('Patente', 'patente')}
              {renderAltaInput('Pago', 'pago', false, 'number')}
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
              {renderAltaInput('Correo electrónico', 'email', false, 'email')}
              {renderAltaCheckbox('Tarifa especial', 'tarifaEspecial', 'Tiene tarifa especial')}
              {renderAltaInput('Observación tarifa', 'observacionTarifa')}
              {renderAltaInput('CUIL', 'cuil')}
              {renderAltaInput('CBU/Alias', 'cbuAlias')}
              {renderAltaInput('Pago', 'pago', false, 'number')}
              {renderAltaCheckbox('Combustible', 'combustible', 'Cuenta corrientes combustible')}
              {renderAltaInput('Fecha de alta', 'fechaAlta', false, 'date')}
              {renderAltaInput('Patente', 'patente')}
            </div>
          </div>
        );
    }
  };

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
        { label: 'CUIL', value: reviewPersonaDetail.cuil },
        { label: 'Teléfono', value: reviewPersonaDetail.telefono },
        { label: 'Correo electrónico', value: reviewPersonaDetail.email },
        { label: 'Pago', value: reviewPersonaDetail.pago },
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
        { label: 'CUIL (Dueño)', value: reviewPersonaDetail.duenoCuil },
        { label: 'CUIL cobrador', value: reviewPersonaDetail.duenoCuilCobrador },
        { label: 'CBU/Alias (Dueño)', value: reviewPersonaDetail.duenoCbuAlias },
        { label: 'Observaciones (Dueño)', value: reviewPersonaDetail.duenoObservaciones },
      ];

      switch (reviewPersonaDetail.perfilValue) {
        case 1:
          return renderReviewProfileGroup('Datos del titular', commonFields);
        case 2:
          return (
            <>
              {renderReviewProfileGroup('Datos del chofer', commonFields)}
              {renderReviewProfileGroup('Dueño de la unidad', ownerFields)}
            </>
          );
        case 3:
          return renderReviewProfileGroup('Datos del transportista', commonFields);
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

                  return (
                    <>
                      <p><strong>Nombre completo:</strong> {nombreCompleto || '—'}</p>
                      <p><strong>Correo:</strong> {reviewPersonaDetail.email || '—'}</p>
                      <p><strong>Teléfono:</strong> {reviewPersonaDetail.telefono || '—'}</p>
                      <p><strong>Cliente:</strong> {reviewPersonaDetail.cliente || '—'}</p>
                      <p><strong>Sucursal:</strong> {reviewPersonaDetail.sucursal || '—'}</p>
                      <p><strong>Estado actual:</strong> {reviewPersonaDetail.estado || 'Sin estado'}</p>
                      <p><strong>Agente responsable:</strong> {reviewPersonaDetail.agenteResponsable || reviewPersonaDetail.agente || '—'}</p>
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
                              const fallbackPath = reviewPersonaDetail
                                ? `/api/personal/${reviewPersonaDetail.id}/documentos/${documento.id}/descargar`
                                : null;
                              const resolvedDownloadUrl = resolveApiUrl(
                                apiBaseUrl,
                                documento.downloadUrl ?? fallbackPath ?? null
                              );
                              return (
                                <li key={documento.id}>
                                  {resolvedDownloadUrl ? (
                                    <a href={resolvedDownloadUrl} target="_blank" rel="noopener noreferrer">
                                      {label}
                                    </a>
                                  ) : (
                                    label
                                  )}
                                  {documento.fechaVencimiento ? ` · Vence: ${documento.fechaVencimiento}` : ''}
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      );
                    })()
                  : (
                    <p className="form-info">No hay documentos cargados para esta solicitud.</p>
                  )}
              </div>

              <div className="review-comments">
                <h3>Chat interno</h3>
                {Array.isArray(reviewPersonaDetail.comments) && reviewPersonaDetail.comments.length > 0 ? (
                  <ul className="review-comment-list">
                    {reviewPersonaDetail.comments.map((comment) => (
                      <li key={comment.id} className="review-comment-item">
                        <div className="review-comment-header">
                          <span>{comment.userName ?? 'Usuario'}</span>
                          <span>{comment.createdAtLabel ?? '—'}</span>
                        </div>
                        <p>{comment.message ?? ''}</p>
                      </li>
                    ))}
                  </ul>
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
                {!reviewEditMode ? (
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => {
                      populateAltaFormFromReview();
                      setReviewEditMode(true);
                    }}
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
                    {(meta?.estados ?? []).map((estado) => (
                      <option key={estado.id} value={estado.id}>
                        {estado.nombre ?? `Estado #${estado.id}`}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="primary-action"
                  onClick={handleApproveSolicitud}
                  disabled={approveLoading || reviewPersonaDetail.aprobado || reviewEditMode}
                >
                  {reviewPersonaDetail.aprobado
                    ? 'Solicitud aprobada'
                    : approveLoading
                    ? 'Aprobando...'
                    : 'Aprobar solicitud'}
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

  const renderAltaEditorSections = () => (
    <>
      <section className="approvals-section">
        <h2>Datos personales</h2>
        <div className="radio-group">
          <span>Seleccionar perfil</span>
          <div className="radio-options">
            {(meta?.perfiles ?? []).map((perfil) => (
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
                {perfil.label}
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
                <select value={altaForm.agenteResponsableId} onChange={handleAltaFieldChange('agenteResponsableId')}>
                  <option value="">Seleccionar</option>
                  {(meta?.agentes ?? []).map((agente) => (
                    <option key={agente.id} value={agente.id}>
                      {agente.name ?? `Agente #${agente.id}`}
                    </option>
                  ))}
                </select>
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
            <label className="secondary-action secondary-action--ghost">
              Seleccionar archivos
              <input
                key={`alta-files-${altaFilesVersion}`}
                type="file"
                multiple
                onChange={handleAltaFilesChange}
                style={{ display: 'none' }}
              />
            </label>
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
  };

  const renderAltasTab = () => {
    if (isReviewMode) {
      if (reviewEditMode && reviewPersonaDetail) {
        return (
          <form className="approvals-form" onSubmit={handleAltaUpdateSubmit}>
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

      return <div className="approvals-form">{renderReviewSection()}</div>;
    }

    return (
      <form className="approvals-form" onSubmit={handleAltaSubmit}>
        {renderAltaEditorSections()}
        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => navigate('/personal')} disabled={altaSubmitting}>
            Cancelar
          </button>
          <button type="submit" className="primary-action" disabled={altaSubmitting}>
            {altaSubmitting ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </div>
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

  const renderAdelantoTab = () => (
    <form className="approvals-form" onSubmit={handleAdelantoSubmit}>
      <section className="personal-section">
        <h3>Adelanto de pago</h3>
        <div className="form-grid">
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
          <label className="input-control">
            <span>Transportista</span>
            <input
              type="text"
              value={adelantoForm.transportista}
              onChange={handleAdelantoFieldChange('transportista')}
              placeholder="Ingresar"
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
            />
          </label>
          <label className="input-control">
            <span>Fecha de solicitud</span>
            <input
              type="date"
              value={adelantoForm.fechaSolicitud}
              onChange={handleAdelantoFieldChange('fechaSolicitud')}
              placeholder="dd/mm/aaaa"
            />
          </label>
          <label className="input-control">
            <span>Motivo</span>
            <input
              type="text"
              value={adelantoForm.motivo}
              onChange={handleAdelantoFieldChange('motivo')}
              placeholder="Ingresar"
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
          />
        </label>
        <label className="input-control">
          <span>Adjuntar archivos</span>
          <input
            key={`adelanto-files-${adelantoFilesVersion}`}
            type="file"
            multiple
            onChange={handleAdelantoFilesChange}
          />
          {renderAttachmentList(adelantoAttachments)}
        </label>
      </section>
      <div className="form-actions">
        <button
          type="button"
          className="secondary-action"
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
            });
            setAdelantoAttachments([]);
            setAdelantoFilesVersion((value) => value + 1);
          }}
        >
          Limpiar
        </button>
        <button type="submit" className="primary-action" disabled={adelantoSubmitting}>
          {adelantoSubmitting ? 'Enviando...' : 'Enviar solicitud'}
        </button>
      </div>
    </form>
  );

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
      case 'poliza':
        return renderPolizaTab();
      case 'altas':
      default:
        return renderAltasTab();
    }
  };

  if (loadingMeta) {
    return (
      <DashboardLayout
        title="Aprobaciones y solicitudes"
        subtitle="Gestiona las solicitudes pendientes"
        headerContent={headerContent}
      >
        <p className="form-info">Cargando información necesaria...</p>
      </DashboardLayout>
    );
  }

  if (metaError) {
    return (
      <DashboardLayout
        title="Aprobaciones y solicitudes"
        subtitle="Gestiona las solicitudes pendientes"
        headerContent={headerContent}
      >
        <p className="form-info form-info--error">{metaError}</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Aprobaciones y solicitudes"
      subtitle="Gestiona las solicitudes pendientes"
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
      </div>

      <div className="approvals-panel">{renderTabContent()}</div>
    </DashboardLayout>
  );
};

const CreateUserPage: React.FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [formValues, setFormValues] = useState({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    role: 'operator',
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const authUser = useStoredAuthUser();
  const isAdmin = useMemo(() => {
    const normalized = authUser?.role?.toLowerCase() ?? '';
    return normalized.includes('admin');
  }, [authUser?.role]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSubmitError(null);
      setSuccessMessage(null);
      setSaving(true);

      const response = await fetch(`${apiBaseUrl}/api/usuarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formValues.name.trim(),
          email: formValues.email.trim(),
          password: formValues.password,
          password_confirmation: formValues.password_confirmation,
          role: formValues.role || 'operator',
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

      const payload = (await response.json()) as { message?: string };
      setSuccessMessage(payload.message ?? 'Usuario registrado correctamente.');
      setFormValues((prev) => ({
        ...prev,
        password: '',
        password_confirmation: '',
        role: 'operator',
      }));
    } catch (err) {
      setSubmitError((err as Error).message ?? 'No se pudo registrar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/usuarios')}>
        ← Volver a usuarios
      </button>
    </div>
  );

  if (!authUser?.role) {
    return (
      <DashboardLayout title="Crear usuario" subtitle="Registrar un nuevo usuario" headerContent={headerContent}>
        <p className="form-info">Verificando permisos...</p>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/clientes" replace />;
  }

  return (
    <DashboardLayout title="Crear usuario" subtitle="Registrar un nuevo usuario" headerContent={headerContent}>
      <form className="edit-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="input-control">
            <span>Nombre</span>
            <input
              type="text"
              value={formValues.name}
              onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Ingresar"
              required
            />
          </label>
          <label className="input-control">
            <span>Email</span>
            <input
              type="email"
              value={formValues.email}
              onChange={(event) => setFormValues((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="Ingresar"
              required
            />
          </label>
          <label className="input-control">
            <span>Contraseña</span>
            <input
              type="password"
              value={formValues.password}
              onChange={(event) => setFormValues((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Ingresar"
              required
            />
          </label>
          <label className="input-control">
            <span>Confirmar contraseña</span>
            <input
              type="password"
              value={formValues.password_confirmation}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, password_confirmation: event.target.value }))
              }
              placeholder="Ingresar"
              required
            />
          </label>
        </div>

        <label className="input-control">
          <span>Rol</span>
          <select
            value={formValues.role}
            onChange={(event) => setFormValues((prev) => ({ ...prev, role: event.target.value }))}
          >
            <option value="operator">Operador</option>
            <option value="admin">Administrador</option>
          </select>
        </label>

        {submitError ? <p className="form-info form-info--error">{submitError}</p> : null}
        {successMessage ? <p className="form-info form-info--success">{successMessage}</p> : null}

        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => navigate('/usuarios')}>
            Cancelar
          </button>
          <button type="submit" className="primary-action" disabled={saving}>
            {saving ? 'Registrando...' : 'Registrar usuario'}
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
};

const EditUserPage: React.FC = () => {
  const { usuarioId } = useParams<{ usuarioId: string }>();
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [role, setRole] = useState<'admin' | 'operator'>('operator');
  const authUser = useStoredAuthUser();
  const isAdmin = useMemo(() => {
    const normalized = authUser?.role?.toLowerCase() ?? '';
    return normalized.includes('admin');
  }, [authUser?.role]);

  useEffect(() => {
    if (!usuarioId) {
      setLoadError('Identificador de usuario inválido.');
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchUsuario = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const response = await fetch(`${apiBaseUrl}/api/usuarios/${usuarioId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: Usuario };

        if (!payload?.data) {
          throw new Error('Formato de respuesta inesperado');
        }

        setUserName(payload.data.name ?? payload.data.email ?? `Usuario #${usuarioId}`);
        setRole((payload.data.role?.toLowerCase() === 'admin' ? 'admin' : 'operator'));
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }

        setLoadError((err as Error).message ?? 'No se pudo cargar el usuario.');
      } finally {
        setLoading(false);
      }
    };

    fetchUsuario();

    return () => controller.abort();
  }, [usuarioId, apiBaseUrl]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!usuarioId) {
      setSubmitError('Identificador de usuario inválido.');
      return;
    }

    try {
      setSubmitError(null);
      setSuccessMessage(null);
      setSaving(true);

      const payloadBody: Record<string, unknown> = {
        role,
      };
      if (password.trim().length > 0) {
        payloadBody.password = password;
        payloadBody.password_confirmation = passwordConfirmation;
      }

      const response = await fetch(`${apiBaseUrl}/api/usuarios/${usuarioId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadBody),
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

      const payload = (await response.json()) as { message?: string; data?: Usuario };
      const resolvedRoleRaw = payload.data?.role ?? null;
      let normalizedRole: 'admin' | 'operator' = role;
      if (resolvedRoleRaw) {
        normalizedRole = resolvedRoleRaw.trim().toLowerCase() === 'admin' ? 'admin' : 'operator';
      }

      if (payload.data?.name || payload.data?.email) {
        setUserName((prev) => payload.data?.name ?? payload.data?.email ?? prev);
      }

      setRole(normalizedRole);

      const displayRoleLabel = formatRoleLabel(resolvedRoleRaw ?? normalizedRole);
      const defaultSuccessMessage = `Usuario actualizado correctamente. Rol actual: ${displayRoleLabel}.`;
      setSuccessMessage(payload.message ? `${payload.message} Rol actual: ${displayRoleLabel}.` : defaultSuccessMessage);

      if (password.trim().length > 0) {
        setPassword('');
        setPasswordConfirmation('');
      }
    } catch (err) {
      setSubmitError((err as Error).message ?? 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/usuarios')}>
        ← Volver a usuarios
      </button>
    </div>
  );

  if (!authUser?.role) {
    return (
      <DashboardLayout title="Restablecer contraseña" subtitle={`Usuario #${usuarioId ?? ''}`} headerContent={headerContent}>
        <p className="form-info">Verificando permisos...</p>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/clientes" replace />;
  }

  if (loading) {
    return (
      <DashboardLayout title="Restablecer contraseña" subtitle={`Usuario #${usuarioId ?? ''}`} headerContent={headerContent}>
        <p className="form-info">Cargando información del usuario...</p>
      </DashboardLayout>
    );
  }

  if (loadError) {
    return (
      <DashboardLayout title="Restablecer contraseña" subtitle={`Usuario #${usuarioId ?? ''}`} headerContent={headerContent}>
        <p className="form-info form-info--error">{loadError}</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Restablecer contraseña"
      subtitle={userName ? `Usuario: ${userName} · Rol actual: ${formatRoleLabel(role)}` : undefined}
      headerContent={headerContent}
    >
      <form className="edit-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="input-control">
            <span>Nueva contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nueva contraseña"
              required={password.trim().length > 0}
            />
          </label>
          <label className="input-control">
            <span>Confirmar contraseña</span>
            <input
              type="password"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              placeholder="Confirmar contraseña"
              required={password.trim().length > 0}
            />
          </label>
          <label className="input-control">
            <span>Rol</span>
            <select value={role} onChange={(event) => setRole(event.target.value === 'admin' ? 'admin' : 'operator')}>
              <option value="operator">Operador</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
        </div>

        {submitError ? <p className="form-info form-info--error">{submitError}</p> : null}
        {successMessage ? <p className="form-info form-info--success">{successMessage}</p> : null}

        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => navigate('/usuarios')}>
            Cancelar
          </button>
          <button type="submit" className="primary-action" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
};

const PersonalEditPage: React.FC = () => {
  const { personaId } = useParams<{ personaId: string }>();
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [detail, setDetail] = useState<PersonalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState({
    nombres: '',
    apellidos: '',
    cuil: '',
    telefono: '',
    email: '',
    perfilValue: 0,
    agenteId: '',
    agenteResponsableId: '',
    clienteId: '',
    sucursalId: '',
    unidadId: '',
    estadoId: '',
    fechaAlta: '',
    pago: '',
    cbuAlias: '',
    patente: '',
    observacionTarifa: '',
    observaciones: '',
    combustible: false,
    tarifaEspecial: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [pendingUploads, setPendingUploads] = useState<PendingPersonalUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [documentTypes, setDocumentTypes] = useState<PersonalDocumentType[]>([]);
  const [documentTypesLoading, setDocumentTypesLoading] = useState(true);
  const [documentTypesError, setDocumentTypesError] = useState<string | null>(null);
  const [selectedDocumentTypeId, setSelectedDocumentTypeId] = useState('');
  const [documentExpiry, setDocumentExpiry] = useState('');
  const [meta, setMeta] = useState<PersonalMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const selectedDocumentType = useMemo(() => {
    if (!selectedDocumentTypeId) {
      return null;
    }

    const targetId = Number(selectedDocumentTypeId);
    if (Number.isNaN(targetId)) {
      return null;
    }

    return documentTypes.find((tipo) => tipo.id === targetId) ?? null;
  }, [documentTypes, selectedDocumentTypeId]);
  const selectedDocument = useMemo(() => {
    if (!detail || selectedDocumentId === null) {
      return null;
    }

    return detail.documents.find((doc) => doc.id === selectedDocumentId) ?? null;
  }, [detail, selectedDocumentId]);

  const handleRemovePendingUpload = useCallback((id: string) => {
    setPendingUploads((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handlePendingFilesSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    if (!selectedDocumentTypeId) {
      setUploadStatus({ type: 'error', message: 'Seleccioná el tipo de documento antes de agregar archivos.' });
      event.target.value = '';
      return;
    }

    const tipo = selectedDocumentType;

    if (tipo?.vence && !documentExpiry) {
      setUploadStatus({ type: 'error', message: 'Este tipo de documento requiere fecha de vencimiento.' });
      event.target.value = '';
      return;
    }

    const newUploads: PendingPersonalUpload[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      typeId: Number(selectedDocumentTypeId),
      typeName: tipo?.nombre ?? null,
      fechaVencimiento: tipo?.vence ? documentExpiry || null : null,
    }));

    setPendingUploads((prev) => [...prev, ...newUploads]);
    setUploadStatus(null);

    if (!tipo?.vence) {
      setDocumentExpiry('');
    }

    event.target.value = '';
  };

  const fetchDetail = useCallback(async () => {
    if (!personaId) {
      setLoadError('Identificador de personal inválido.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);

      const response = await fetch(`${apiBaseUrl}/api/personal/${personaId}`);

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const payload = (await response.json()) as { data: PersonalDetail };

      if (!payload?.data) {
        throw new Error('Formato de respuesta inesperado');
      }

      setDetail({
        ...payload.data,
        documents: payload.data.documents ?? [],
        documentsDownloadAllUrl: payload.data.documentsDownloadAllUrl ?? null,
        documentsDownloadAllAbsoluteUrl: payload.data.documentsDownloadAllAbsoluteUrl ?? null,
        history: payload.data.history ?? [],
      });
      setFormValues({
        nombres: payload.data.nombres ?? '',
        apellidos: payload.data.apellidos ?? '',
        cuil: payload.data.cuil ?? '',
        telefono: payload.data.telefono ?? '',
        email: payload.data.email ?? '',
        perfilValue: payload.data.perfilValue ?? 0,
        agenteId: payload.data.agenteId ? String(payload.data.agenteId) : '',
        agenteResponsableId: payload.data.agenteResponsableId ? String(payload.data.agenteResponsableId) : '',
        clienteId: payload.data.clienteId ? String(payload.data.clienteId) : '',
        sucursalId: payload.data.sucursalId ? String(payload.data.sucursalId) : '',
        unidadId: payload.data.unidadId ? String(payload.data.unidadId) : '',
        estadoId: payload.data.estadoId ? String(payload.data.estadoId) : '',
        fechaAlta: payload.data.fechaAlta ?? '',
        pago: payload.data.pago ?? '',
        cbuAlias: payload.data.cbuAlias ?? '',
        patente: payload.data.patente ?? '',
        observacionTarifa: payload.data.observacionTarifa ?? '',
        observaciones: payload.data.observaciones ?? '',
        combustible: Boolean(payload.data.combustibleValue),
        tarifaEspecial: Boolean(payload.data.tarifaEspecialValue),
      });
      setSaveSuccess(null);
      setSaveError(null);
      if (payload.data.documents.length > 0) {
        setSelectedDocumentId(payload.data.documents[0].id);
      } else {
        setSelectedDocumentId(null);
      }
    } catch (err) {
      setLoadError((err as Error).message ?? 'No se pudo cargar la información del personal.');
    } finally {
      setLoading(false);
    }
  }, [personaId, apiBaseUrl]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

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

        const payload = (await response.json()) as PersonalMeta;
        setMeta(payload);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setMetaError((err as Error).message ?? 'No se pudieron cargar los datos de referencia.');
      } finally {
        setMetaLoading(false);
      }
    };

    fetchMeta();

    return () => controller.abort();
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!selectedDocumentType?.vence && documentExpiry) {
      setDocumentExpiry('');
    }
  }, [selectedDocumentType, documentExpiry]);

  useEffect(() => {
    if (documentTypesLoading) {
      return;
    }

    if (documentTypes.length === 0) {
      setSelectedDocumentTypeId('');
      return;
    }

    if (!selectedDocumentTypeId) {
      setSelectedDocumentTypeId(String(documentTypes[0].id));
    }
  }, [documentTypesLoading, documentTypes, selectedDocumentTypeId]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchDocumentTypes = async () => {
      try {
        setDocumentTypesLoading(true);
        setDocumentTypesError(null);

        const response = await fetch(`${apiBaseUrl}/api/personal/documentos/tipos`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: PersonalDocumentType[] };
        setDocumentTypes(payload?.data ?? []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setDocumentTypesError((err as Error).message ?? 'No se pudieron cargar los tipos de documento.');
      } finally {
        setDocumentTypesLoading(false);
      }
    };

    fetchDocumentTypes();

    return () => controller.abort();
  }, [apiBaseUrl]);

  const sucursalOptions = useMemo(() => {
    if (!meta) {
      return [] as PersonalMeta['sucursales'];
    }

    if (!formValues.clienteId) {
      return meta.sucursales;
    }

    const clienteId = Number(formValues.clienteId);
    if (Number.isNaN(clienteId)) {
      return meta.sucursales;
    }

    return meta.sucursales.filter((sucursal) => sucursal.cliente_id === clienteId);
  }, [meta, formValues.clienteId]);

  const perfilLabel = useMemo(() => {
    if (!meta) {
      return detail?.perfil ?? '';
    }

    const perfil = meta.perfiles.find((item) => item.value === formValues.perfilValue);
    return perfil?.label ?? (detail?.perfil ?? '');
  }, [meta, formValues.perfilValue, detail?.perfil]);

  const handleDownloadFicha = useCallback((record: PersonalDetail) => {
    const lines = [
      ['Nombre', [record.nombres, record.apellidos].filter(Boolean).join(' ').trim()],
      ['CUIL', record.cuil ?? ''],
      ['Teléfono', record.telefono ?? ''],
      ['Email', record.email ?? ''],
      ['Perfil', record.perfil ?? ''],
      ['Agente', record.agente ?? ''],
      ['Estado', record.estado ?? ''],
      ['Cliente', record.cliente ?? ''],
      ['Sucursal', record.sucursal ?? ''],
      ['Unidad', record.unidadDetalle ?? record.unidad ?? ''],
      ['Patente', record.patente ?? ''],
      ['Fecha alta', record.fechaAlta ?? ''],
      ['Pago pactado', record.pago ?? ''],
      ['CBU / Alias', record.cbuAlias ?? ''],
      ['Combustible', record.combustibleValue ? 'Sí' : 'No'],
      ['Tarifa especial', record.tarifaEspecialValue ? 'Sí' : 'No'],
      ['Observación tarifa', formValues.observacionTarifa],
      ['Observaciones', formValues.observaciones],
    ];

    const content = lines
      .map(([label, value]) => `${label}: ${value ? String(value) : ''}`)
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `personal-${record.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [formValues.observacionTarifa, formValues.observaciones]);

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/personal')}>
        ← Volver a personal
      </button>
      <button
        type="button"
        className="secondary-action"
        onClick={() => detail && handleDownloadFicha(detail)}
        disabled={loading || !!loadError || !detail}
      >
        Descargar ficha
      </button>
    </div>
  );

  const handleSave = async () => {
    if (!personaId) {
      return;
    }

    try {
      setSaveError(null);
      setSaveSuccess(null);
      setSaving(true);

      const response = await fetch(`${apiBaseUrl}/api/personal/${personaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombres: formValues.nombres.trim() || null,
          apellidos: formValues.apellidos.trim() || null,
          cuil: formValues.cuil.trim() || null,
          telefono: formValues.telefono.trim() || null,
          email: formValues.email.trim() || null,
          perfilValue: formValues.perfilValue || null,
          agenteId: formValues.agenteId ? Number(formValues.agenteId) : null,
          agenteResponsableId: formValues.agenteResponsableId ? Number(formValues.agenteResponsableId) : null,
          clienteId: formValues.clienteId ? Number(formValues.clienteId) : null,
          sucursalId: formValues.sucursalId ? Number(formValues.sucursalId) : null,
          unidadId: formValues.unidadId ? Number(formValues.unidadId) : null,
          estadoId: formValues.estadoId ? Number(formValues.estadoId) : null,
          fechaAlta: formValues.fechaAlta || null,
          pago: formValues.pago ? Number(formValues.pago) : null,
          cbuAlias: formValues.cbuAlias.trim() || null,
          patente: formValues.patente.trim() || null,
          observacionTarifa: formValues.observacionTarifa.trim() || null,
          observaciones: formValues.observaciones.trim() || null,
          combustible: formValues.combustible,
          tarifaEspecial: formValues.tarifaEspecial,
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

      const payload = (await response.json()) as { message?: string; data?: PersonalDetail };
      setSaveSuccess(payload.message ?? 'Información actualizada correctamente.');

      if (payload.data) {
        setDetail({
          ...payload.data,
          documents: payload.data.documents ?? [],
          documentsDownloadAllUrl: payload.data.documentsDownloadAllUrl ?? null,
          documentsDownloadAllAbsoluteUrl: payload.data.documentsDownloadAllAbsoluteUrl ?? null,
          history: payload.data.history ?? [],
        });
        setFormValues({
          nombres: payload.data.nombres ?? '',
          apellidos: payload.data.apellidos ?? '',
          cuil: payload.data.cuil ?? '',
          telefono: payload.data.telefono ?? '',
          email: payload.data.email ?? '',
          perfilValue: payload.data.perfilValue ?? 0,
          agenteId: payload.data.agenteId ? String(payload.data.agenteId) : '',
          agenteResponsableId: payload.data.agenteResponsableId ? String(payload.data.agenteResponsableId) : '',
          clienteId: payload.data.clienteId ? String(payload.data.clienteId) : '',
          sucursalId: payload.data.sucursalId ? String(payload.data.sucursalId) : '',
          unidadId: payload.data.unidadId ? String(payload.data.unidadId) : '',
          estadoId: payload.data.estadoId ? String(payload.data.estadoId) : '',
          fechaAlta: payload.data.fechaAlta ?? '',
          pago: payload.data.pago ?? '',
          cbuAlias: payload.data.cbuAlias ?? '',
          patente: payload.data.patente ?? '',
          observacionTarifa: payload.data.observacionTarifa ?? '',
          observaciones: payload.data.observaciones ?? '',
          combustible: Boolean(payload.data.combustibleValue),
          tarifaEspecial: Boolean(payload.data.tarifaEspecialValue),
        });
      }
    } catch (err) {
      setSaveError((err as Error).message ?? 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadDocumento = () => {
    if (!detail || !selectedDocumentId) {
      return;
    }

    const documento = detail.documents.find((doc) => doc.id === selectedDocumentId);
    if (!documento) {
      window.alert('Seleccioná un documento para descargar.');
      return;
    }

    const fallbackPath = `/api/personal/${detail.id}/documentos/${documento.id}/descargar`;
    const resolvedUrl = resolveApiUrl(apiBaseUrl, documento.downloadUrl ?? fallbackPath);

    if (!resolvedUrl) {
      window.alert('No se pudo determinar la URL de descarga para este documento.');
      return;
    }

    window.open(resolvedUrl, '_blank', 'noopener');
  };

  const handleUploadDocumentos = async () => {
    if (!personaId || pendingUploads.length === 0) {
      return;
    }

    try {
      setUploading(true);
      setUploadStatus(null);

      for (const item of pendingUploads) {
        const formData = new FormData();
        formData.append('archivo', item.file);
        formData.append('nombre', item.file.name);
        formData.append('tipoArchivoId', String(item.typeId));
        if (item.fechaVencimiento) {
          formData.append('fechaVencimiento', item.fechaVencimiento);
        }

        const response = await fetch(`${apiBaseUrl}/api/personal/${personaId}/documentos`, {
          method: 'POST',
          body: formData,
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
      }

      setUploadStatus({ type: 'success', message: 'Documentos cargados correctamente.' });
      setPendingUploads([]);
      setDocumentExpiry('');
      fetchDetail();
    } catch (err) {
      setUploadStatus({ type: 'error', message: (err as Error).message ?? 'No se pudieron subir los documentos.' });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Editar personal" subtitle={`Registro #${personaId ?? ''}`} headerContent={headerContent}>
        <p className="form-info">Cargando información del personal...</p>
      </DashboardLayout>
    );
  }
  if (loadError || !detail) {
    return (
      <DashboardLayout title="Editar personal" subtitle={`Registro #${personaId ?? ''}`} headerContent={headerContent}>
        <p className="form-info form-info--error">{loadError ?? 'No se encontraron datos.'}</p>
      </DashboardLayout>
    );
  }

  const fullName = [detail.nombres, detail.apellidos].filter(Boolean).join(' ').trim();
  const historyEntries = detail.history ?? [];

  return (
    <DashboardLayout title="Editar personal" subtitle={fullName || `Registro #${detail.id}`} headerContent={headerContent}>
      {metaError ? <p className="form-info form-info--error">{metaError}</p> : null}
      {metaLoading ? <p className="form-info">Cargando datos de referencia...</p> : null}
      <section className="personal-edit-section">
        <h2>Datos personales</h2>
        <div className="form-grid">
          <label className="input-control">
            <span>Nombre</span>
            <input
              type="text"
              value={formValues.nombres}
              onChange={(event) => setFormValues((prev) => ({ ...prev, nombres: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Apellido</span>
            <input
              type="text"
              value={formValues.apellidos}
              onChange={(event) => setFormValues((prev) => ({ ...prev, apellidos: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>CUIL</span>
            <input
              type="text"
              value={formValues.cuil}
              onChange={(event) => setFormValues((prev) => ({ ...prev, cuil: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Teléfono</span>
            <input
              type="text"
              value={formValues.telefono}
              onChange={(event) => setFormValues((prev) => ({ ...prev, telefono: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Email</span>
            <input
              type="email"
              value={formValues.email}
              onChange={(event) => setFormValues((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Perfil</span>
            <input type="text" value={perfilLabel} readOnly />
          </label>
          <label className="input-control">
            <span>Fecha de alta</span>
            <input
              type="date"
              value={formValues.fechaAlta}
              onChange={(event) => setFormValues((prev) => ({ ...prev, fechaAlta: event.target.value }))}
            />
          </label>
          <label className="input-control">
            <span>Pago pactado</span>
            <input
              type="number"
              value={formValues.pago}
              onChange={(event) => setFormValues((prev) => ({ ...prev, pago: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>CBU / Alias</span>
            <input
              type="text"
              value={formValues.cbuAlias}
              onChange={(event) => setFormValues((prev) => ({ ...prev, cbuAlias: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Patente</span>
            <input
              type="text"
              value={formValues.patente}
              onChange={(event) => setFormValues((prev) => ({ ...prev, patente: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Combustible</span>
            <div className="checkbox-control">
              <input
                type="checkbox"
                checked={formValues.combustible}
                onChange={(event) => setFormValues((prev) => ({ ...prev, combustible: event.target.checked }))}
              />
              Cuenta corrientes combustible
            </div>
          </label>
          <label className="input-control">
            <span>Tarifa especial</span>
            <div className="checkbox-control">
              <input
                type="checkbox"
                checked={formValues.tarifaEspecial}
                onChange={(event) => setFormValues((prev) => ({ ...prev, tarifaEspecial: event.target.checked }))}
              />
              Tiene tarifa especial
            </div>
          </label>
        </div>
        <label className="input-control">
          <span>Observación tarifa</span>
          <textarea
            value={formValues.observacionTarifa}
            onChange={(event) => setFormValues((prev) => ({ ...prev, observacionTarifa: event.target.value }))}
            rows={2}
          />
        </label>
        <label className="input-control">
          <span>Observaciones</span>
          <textarea
            value={formValues.observaciones}
            onChange={(event) => setFormValues((prev) => ({ ...prev, observaciones: event.target.value }))}
            rows={3}
          />
        </label>
        {saveError ? <p className="form-info form-info--error">{saveError}</p> : null}
        {saveSuccess ? <p className="form-info form-info--success">{saveSuccess}</p> : null}
        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => navigate('/personal')}>
            Cancelar
          </button>
          <button type="button" className="primary-action" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </section>

      <section className="personal-edit-section">
        <h2>Datos de vinculación</h2>
        <div className="form-grid">
          <label className="input-control">
            <span>Cliente</span>
            <select
              value={formValues.clienteId}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, clienteId: event.target.value, sucursalId: '' }))
              }
              disabled={metaLoading || !meta}
            >
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
            <select
              value={formValues.sucursalId}
              onChange={(event) => setFormValues((prev) => ({ ...prev, sucursalId: event.target.value }))}
              disabled={metaLoading || !meta}
            >
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
            <select
              value={formValues.agenteId}
              onChange={(event) => setFormValues((prev) => ({ ...prev, agenteId: event.target.value }))}
              disabled={metaLoading || !meta}
            >
              <option value="">Sin asignar</option>
              {(meta?.agentes ?? []).map((agente) => (
                <option key={agente.id} value={agente.id}>
                  {agente.name ?? `Agente #${agente.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="input-control">
            <span>Agente responsable</span>
            <select
              value={formValues.agenteResponsableId}
              onChange={(event) => setFormValues((prev) => ({ ...prev, agenteResponsableId: event.target.value }))}
              disabled={metaLoading || !meta}
            >
              <option value="">Sin asignar</option>
              {(meta?.agentes ?? []).map((agente) => (
                <option key={agente.id} value={agente.id}>
                  {agente.name ?? `Agente #${agente.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="input-control">
            <span>Unidad</span>
            <select
              value={formValues.unidadId}
              onChange={(event) => setFormValues((prev) => ({ ...prev, unidadId: event.target.value }))}
              disabled={metaLoading || !meta}
            >
              <option value="">Sin asignar</option>
              {(meta?.unidades ?? []).map((unidad) => {
                const label = [unidad.matricula, unidad.marca, unidad.modelo].filter(Boolean).join(' · ');
                return (
                  <option key={unidad.id} value={unidad.id}>
                    {label || `Unidad #${unidad.id}`}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="input-control">
            <span>Estado</span>
            <select
              value={formValues.estadoId}
              onChange={(event) => setFormValues((prev) => ({ ...prev, estadoId: event.target.value }))}
              disabled={metaLoading || !meta}
            >
              <option value="">Sin estado</option>
              {(meta?.estados ?? []).map((estado) => (
                <option key={estado.id} value={estado.id}>
                  {estado.nombre ?? `Estado #${estado.id}`}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="personal-edit-section">
        <h2>Historial de cambios</h2>
        <div className="history-list">
          {historyEntries.length === 0 ? (
            <p>No hay historial disponible para este registro.</p>
          ) : (
            historyEntries.map((entry) => (
              <div key={entry.id} className="history-entry">
                <div className="history-entry__header">
                  <span className="history-entry__author">{entry.authorName ?? 'Sistema'}</span>
                  <span className="history-entry__time">{entry.createdAtLabel ?? ''}</span>
                </div>
                {entry.description ? <p className="history-entry__description">{entry.description}</p> : null}
                {entry.changes.length > 0 ? (
                  <ul className="history-entry__changes">
                    {entry.changes.map((change, index) => {
                      const key = change.field ?? `change-${entry.id}-${index}`;
                      return (
                        <li key={key}>
                          <span className="history-entry__change-label">{change.label ?? change.field ?? 'Campo'}</span>
                          <span className="history-entry__change-values">
                            <span className="history-entry__change-old">{change.oldValue ?? '—'}</span>
                            <span className="history-entry__change-arrow">→</span>
                            <span className="history-entry__change-new">{change.newValue ?? '—'}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="personal-edit-section">
        <h2>Documentos</h2>
        {detail.documents.length > 0
          ? (() => {
              const downloadAllUrl = resolveApiUrl(
                apiBaseUrl,
                detail.documentsDownloadAllAbsoluteUrl
                  ?? detail.documentsDownloadAllUrl
                  ?? (detail
                    ? `/api/personal/${detail.id}/documentos/descargar-todos`
                    : null)
              );

              return downloadAllUrl ? (
                <div className="personal-documents-actions">
                  <a className="secondary-action" href={downloadAllUrl} download>
                    Descargar todos
                  </a>
                </div>
              ) : null;
            })()
          : null}
        <div className="form-grid">
          <label className="input-control">
            <span>Documento</span>
            <select
              value={selectedDocumentId ?? ''}
              onChange={(event) => setSelectedDocumentId(event.target.value ? Number(event.target.value) : null)}
              disabled={detail.documents.length === 0}
            >
              <option value="">Seleccionar documento</option>
              {detail.documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.tipoNombre
                    ? `${doc.tipoNombre}${doc.nombre ? ` – ${doc.nombre}` : ''}`
                    : doc.nombre ?? `Documento #${doc.id}`}
                </option>
              ))}
            </select>
          </label>
        </div>
        {selectedDocument ? (
          <div className="document-extra-info">
            <p className="form-info">Tipo: {selectedDocument.tipoNombre ?? 'Sin tipo asignado'}</p>
            {selectedDocument.fechaVencimiento ? (
              <p className="form-info">Vence: {selectedDocument.fechaVencimiento}</p>
            ) : selectedDocument.requiereVencimiento ? (
              <p className="form-info">Este documento requiere fecha de vencimiento, pero no está cargada.</p>
            ) : null}
          </div>
        ) : null}
        {detail.documents.length === 0 ? (
          <p className="form-info">No hay documentos disponibles para este personal.</p>
        ) : null}
        <button
          type="button"
          className="secondary-action"
          onClick={handleDownloadDocumento}
          disabled={!selectedDocumentId}
        >
          Descargar documento
        </button>
      </section>

      <section className="personal-edit-section">
        <h2>Carga de documentos</h2>
        <p className="form-info">Sube archivos relacionados con este personal para centralizar su documentación.</p>
        <div className="form-grid">
          <label className="input-control">
            <span>Tipo de documento</span>
            <select
              value={selectedDocumentTypeId}
              onChange={(event) => setSelectedDocumentTypeId(event.target.value)}
              disabled={documentTypesLoading}
            >
              <option value="">Seleccionar</option>
              {documentTypes.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nombre ?? `Tipo #${tipo.id}`}
                </option>
              ))}
            </select>
          </label>
          {selectedDocumentType?.vence ? (
            <label className="input-control">
              <span>Fecha de vencimiento</span>
              <input
                type="date"
                value={documentExpiry}
                onChange={(event) => setDocumentExpiry(event.target.value)}
              />
            </label>
          ) : null}
        </div>
        {documentTypesError ? (
          <p className="form-info form-info--error">{documentTypesError}</p>
        ) : null}
        {selectedDocumentType?.vence && !documentExpiry ? (
          <p className="form-info">Recordá ingresar la fecha de vencimiento para este tipo de documento.</p>
        ) : null}
        <div className="upload-dropzone" role="presentation">
          <div className="upload-dropzone__icon">📄</div>
          <p>Arrastra y suelta archivos aquí</p>
          <label className="secondary-action" style={{ cursor: 'pointer' }}>
            Seleccionar archivos
            <input
              type="file"
              multiple
              onChange={handlePendingFilesSelect}
              style={{ display: 'none' }}
            />
          </label>
          {pendingUploads.length > 0 ? (
            <ul className="pending-upload-list">
              {pendingUploads.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.file.name}</strong>
                    <span>{item.typeName ?? 'Sin tipo asignado'}</span>
                    {item.fechaVencimiento ? <span>Vence: {item.fechaVencimiento}</span> : null}
                  </div>
                  <button
                    type="button"
                    className="pending-upload-remove"
                    onClick={() => handleRemovePendingUpload(item.id)}
                    aria-label={`Quitar ${item.file.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {uploadStatus ? (
          <p className={uploadStatus.type === 'error' ? 'form-info form-info--error' : 'form-info form-info--success'}>
            {uploadStatus.message}
          </p>
        ) : null}
        <button
          type="button"
          className="primary-action"
          onClick={handleUploadDocumentos}
          disabled={
            uploading ||
            pendingUploads.length === 0 ||
            documentTypesLoading
          }
        >
          {uploading ? 'Subiendo...' : 'Subir documentos'}
        </button>
      </section>
    </DashboardLayout>
  );
};

const PersonalCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const authUser = useStoredAuthUser();
  const [meta, setMeta] = useState<PersonalMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [formValues, setFormValues] = useState({
    perfilValue: 1,
    nombres: '',
    apellidos: '',
    telefono: '',
    email: '',
    cuil: '',
    pago: '',
    cbuAlias: '',
    patente: '',
    clienteId: '',
    sucursalId: '',
    agenteId: '',
    unidadId: '',
    estadoId: '',
    fechaAlta: '',
    observacionTarifa: '',
    observaciones: '',
    combustible: false,
    tarifaEspecial: false,
    duenoNombre: '',
    duenoFechaNacimiento: '',
    duenoEmail: '',
    duenoCuil: '',
    duenoCuilCobrador: '',
    duenoCbuAlias: '',
    duenoTelefono: '',
    duenoObservaciones: '',
  });

  useEffect(() => {
  const fetchMeta = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const response = await fetch(`${apiBaseUrl}/api/personal-meta`);
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as PersonalMeta;
        setMeta(payload);
        if (payload.perfiles.length > 0) {
          setFormValues((prev) => ({ ...prev, perfilValue: payload.perfiles[0].value }));
        }
      } catch (err) {
        setLoadError((err as Error).message ?? 'No se pudo cargar la información.');
      } finally {
        setLoading(false);
      }
    };

    fetchMeta();
  }, [apiBaseUrl]);

  const sucursalOptions = useMemo(() => {
    if (!meta) {
      return [] as PersonalMeta['sucursales'];
    }

    if (!formValues.clienteId) {
      return meta.sucursales;
    }

    const clienteId = Number(formValues.clienteId);
    return meta.sucursales.filter((sucursal) => sucursal.cliente_id === clienteId);
  }, [meta, formValues.clienteId]);

  const handleCheckboxChange = (field: 'combustible' | 'tarifaEspecial') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setFormValues((prev) => ({ ...prev, [field]: checked }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSaveError(null);
      setSaving(true);

      const response = await fetch(`${apiBaseUrl}/api/personal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          perfilValue: formValues.perfilValue,
          nombres: formValues.nombres.trim(),
          apellidos: formValues.apellidos.trim(),
          telefono: formValues.telefono.trim() || null,
          email: formValues.email.trim() || null,
          cuil: formValues.cuil.trim() || null,
          pago: formValues.pago ? Number(formValues.pago) : null,
          cbuAlias: formValues.cbuAlias.trim() || null,
          patente: formValues.patente.trim() || null,
          clienteId: formValues.clienteId ? Number(formValues.clienteId) : null,
          sucursalId: formValues.sucursalId ? Number(formValues.sucursalId) : null,
          agenteId: formValues.agenteId ? Number(formValues.agenteId) : null,
          unidadId: formValues.unidadId ? Number(formValues.unidadId) : null,
          estadoId: formValues.estadoId ? Number(formValues.estadoId) : null,
          fechaAlta: formValues.fechaAlta || null,
          observacionTarifa: formValues.observacionTarifa.trim() || null,
          observaciones: formValues.observaciones.trim() || null,
          combustible: formValues.combustible,
          tarifaEspecial: formValues.tarifaEspecial,
          duenoNombre: formValues.duenoNombre.trim() || null,
          duenoFechaNacimiento: formValues.duenoFechaNacimiento || null,
          duenoEmail: formValues.duenoEmail.trim() || null,
          duenoCuil: formValues.duenoCuil.trim() || null,
          duenoCuilCobrador: formValues.duenoCuilCobrador.trim() || null,
          duenoCbuAlias: formValues.duenoCbuAlias.trim() || null,
          duenoTelefono: formValues.duenoTelefono.trim() || null,
          duenoObservaciones: formValues.duenoObservaciones.trim() || null,
          autoApprove: true,
          autoApproveUserId: authUser?.id ?? null,
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

      const payload = (await response.json()) as { data: { id: number } };
      navigate(`/personal/${payload.data.id}/editar`);
    } catch (err) {
      setSaveError((err as Error).message ?? 'No se pudo registrar el personal.');
    } finally {
      setSaving(false);
    }
  };

  const handlePerfilChange = (value: number) => {
    setFormValues((prev) => ({ ...prev, perfilValue: value }));
  };

  const handleSelectChange = (field: keyof typeof formValues) => (event: React.ChangeEvent<HTMLSelectElement>) => {
    let value: string | boolean = event.target.value;

    setFormValues((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'clienteId' ? { sucursalId: '' } : {}),
    }));
  };

  const renderPerfilSection = () => {
    switch (formValues.perfilValue) {
      case 1:
        return (
          <section className="personal-section">
            <h3>Dueño y chofer</h3>
            <div className="form-grid">
              {renderInput('Nombres', 'nombres', true)}
              {renderInput('Apellidos', 'apellidos', true)}
              {renderInput('Teléfono', 'telefono')}
              {renderInput('Correo electrónico', 'email', false, 'email')}
              {renderCheckbox('Tarifa especial', 'tarifaEspecial', 'Tiene tarifa especial')}
              {renderInput('Observación tarifa', 'observacionTarifa')}
              {renderInput('CUIL', 'cuil')}
              {renderInput('CBU/Alias', 'cbuAlias')}
              {renderInput('Pago', 'pago', false, 'number')}
              {renderCheckbox('Combustible', 'combustible', 'Cuenta corrientes combustible')}
              {renderInput('Fecha de alta', 'fechaAlta', false, 'date')}
              {renderInput('Patente', 'patente')}
            </div>
          </section>
        );
      case 2:
        return (
          <section className="personal-section">
            <h3>Chofer</h3>
            <div className="form-grid">
              {renderInput('Nombre completo', 'nombres', true)}
              {renderInput('Correo electrónico', 'email', false, 'email')}
              {renderInput('Teléfono', 'telefono')}
              {renderCheckbox('Tarifa especial', 'tarifaEspecial', 'Tiene tarifa especial')}
              {renderInput('Observación tarifa', 'observacionTarifa')}
              {renderInput('CUIL', 'cuil')}
              {renderInput('CBU/Alias', 'cbuAlias')}
              {renderCheckbox('Combustible', 'combustible', 'Cuenta corrientes combustible')}
              {renderInput('Pago', 'pago', false, 'number')}
              {renderInput('Fecha de alta', 'fechaAlta', false, 'date')}
              {renderInput('Patente', 'patente')}
            </div>

            <h3>Dueño de la unidad</h3>
            <div className="form-grid">
              {renderInput('Nombre completo (Dueño)', 'duenoNombre')}
              {renderInput('Fecha de nacimiento', 'duenoFechaNacimiento', false, 'date')}
              {renderInput('Correo (Dueño)', 'duenoEmail', false, 'email')}
              {renderInput('CUIL (Dueño)', 'duenoCuil')}
              {renderInput('CUIL cobrador', 'duenoCuilCobrador')}
              {renderInput('CBU/Alias (Dueño)', 'duenoCbuAlias')}
              {renderInput('Teléfono (Dueño)', 'duenoTelefono')}
              <label className="input-control" style={{ gridColumn: '1 / -1' }}>
                <span>Observaciones</span>
                <textarea
                  rows={2}
                  value={formValues.duenoObservaciones}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, duenoObservaciones: event.target.value }))}
                />
              </label>
            </div>
          </section>
        );
      case 3:
        return (
          <section className="personal-section">
            <h3>Transportista</h3>
            <div className="form-grid">
              {renderInput('Nombres', 'nombres', true)}
              {renderInput('Apellidos', 'apellidos', true)}
              {renderInput('CUIL', 'cuil')}
              {renderInput('Correo electrónico', 'email', false, 'email')}
              {renderInput('Teléfono', 'telefono')}
              {renderCheckbox('Combustible', 'combustible', 'Cuenta corrientes combustible')}
              {renderCheckbox('Tarifa especial', 'tarifaEspecial', 'Tiene tarifa especial')}
              {renderInput('Observación tarifa', 'observacionTarifa')}
              {renderInput('Fecha de alta', 'fechaAlta', false, 'date')}
              {renderInput('Patente', 'patente')}
              {renderInput('Pago', 'pago', false, 'number')}
            </div>

            <div className="placeholder-grid">
              {renderDisabledInput('Guía/Remito')}
              {renderDisabledInput('Valor del viaje', 'number')}
              {renderDisabledInput('Origen')}
              {renderDisabledInput('Destino')}
              <label className="input-control" style={{ gridColumn: '1 / -1' }}>
                <span>Observación</span>
                <textarea disabled rows={2} />
              </label>
            </div>
          </section>
        );
      default:
        return null;
    }
  };

  const renderInput = (
    label: string,
    field: keyof typeof formValues,
    required = false,
    type: 'text' | 'email' | 'number' | 'date' = 'text'
  ) => (
    <label className="input-control">
      <span>{label}</span>
      <input
        type={type}
        value={formValues[field] as string}
        onChange={(event) => setFormValues((prev) => ({ ...prev, [field]: event.target.value }))}
        placeholder="Ingresar"
        required={required}
      />
    </label>
  );

  const renderCheckbox = (label: string, field: 'combustible' | 'tarifaEspecial', text: string) => (
    <label className="input-control">
      <span>{label}</span>
      <div className="checkbox-control">
        <input type="checkbox" checked={formValues[field]} onChange={handleCheckboxChange(field)} />
        {text}
      </div>
    </label>
  );

  const renderDisabledInput = (label: string, type: 'text' | 'email' | 'date' | 'number' = 'text') => (
    <label className="input-control">
      <span>{label}</span>
      <input type={type} disabled placeholder="—" />
    </label>
  );

  if (loading) {
    return (
      <DashboardLayout title="Registrar personal" subtitle="Personal" headerContent={null}>
        <p className="form-info">Cargando información necesaria...</p>
      </DashboardLayout>
    );
  }

  if (loadError || !meta) {
    return (
      <DashboardLayout title="Registrar personal" subtitle="Personal" headerContent={null}>
        <p className="form-info form-info--error">{loadError ?? 'No se pudieron cargar los datos necesarios.'}</p>
        <button type="button" className="secondary-action" onClick={() => navigate('/personal')}>
          ← Volver a personal
        </button>
      </DashboardLayout>
    );
  }

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/personal')}>
        ← Volver a personal
      </button>
    </div>
  );

  return (
    <DashboardLayout title="Registrar personal" subtitle="Personal" headerContent={headerContent}>
      <form className="personal-edit-section" onSubmit={handleSubmit}>
        <h2>Datos personales</h2>

        <div className="radio-group">
          <span>Seleccionar perfil</span>
          <div className="radio-options">
            {meta.perfiles.map((perfil) => (
              <label key={perfil.value} className={`radio-option${formValues.perfilValue === perfil.value ? ' is-active' : ''}`}>
                <input
                  type="radio"
                  name="perfil"
                  value={perfil.value}
                  checked={formValues.perfilValue === perfil.value}
                  onChange={() => handlePerfilChange(perfil.value)}
                />
                {perfil.label}
              </label>
            ))}
          </div>
        </div>

        {renderPerfilSection()}

        <h3>Datos de vinculación</h3>
        <div className="form-grid">
          <label className="input-control">
            <span>Cliente</span>
            <select value={formValues.clienteId} onChange={handleSelectChange('clienteId')}>
              <option value="">Seleccionar</option>
              {meta.clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre ?? `Cliente #${cliente.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="input-control">
            <span>Sucursal</span>
            <select value={formValues.sucursalId} onChange={handleSelectChange('sucursalId')} disabled={sucursalOptions.length === 0}>
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
            <select value={formValues.agenteId} onChange={handleSelectChange('agenteId')}>
              <option value="">Seleccionar</option>
              {meta.agentes.map((agente) => (
                <option key={agente.id} value={agente.id}>
                  {agente.name ?? `Agente #${agente.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="input-control">
            <span>Unidad</span>
            <select value={formValues.unidadId} onChange={handleSelectChange('unidadId')}>
              <option value="">Seleccionar</option>
              {meta.unidades.map((unidad) => (
                <option key={unidad.id} value={unidad.id}>
                  {[unidad.matricula, unidad.marca, unidad.modelo].filter(Boolean).join(' - ') || `Unidad #${unidad.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="input-control">
            <span>Estado</span>
            <select value={formValues.estadoId} onChange={handleSelectChange('estadoId')}>
              <option value="">Seleccionar</option>
              {meta.estados.map((estado) => (
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
              value={formValues.fechaAlta}
              onChange={(event) => setFormValues((prev) => ({ ...prev, fechaAlta: event.target.value }))}
            />
          </label>
          <label className="input-control" style={{ gridColumn: '1 / -1' }}>
            <span>Observaciones</span>
            <textarea
              value={formValues.observaciones}
              onChange={(event) => setFormValues((prev) => ({ ...prev, observaciones: event.target.value }))}
              rows={3}
            />
          </label>
        </div>

        {saveError ? <p className="form-info form-info--error">{saveError}</p> : null}

        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => navigate('/personal')}>
            Cancelar
          </button>
          <button type="submit" className="primary-action" disabled={saving}>
            {saving ? 'Registrando...' : 'Siguiente'}
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
};

const DocumentTypesPage: React.FC = () => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const navigate = useNavigate();
  const location = useLocation();
  const [types, setTypes] = useState<PersonalDocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchTypes = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${apiBaseUrl}/api/personal/documentos/tipos`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: PersonalDocumentType[] };
        setTypes(payload?.data ?? []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setError((err as Error).message ?? 'No se pudieron cargar los tipos de documento.');
      } finally {
        setLoading(false);
      }
    };

    fetchTypes();

    return () => controller.abort();
  }, [apiBaseUrl]);

  useEffect(() => {
    const state = location.state as { message?: string } | null;
    if (state?.message) {
      setFlashMessage(state.message);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return types;
    }
    return types.filter((item) => (item.nombre ?? '').toLowerCase().includes(term));
  }, [types, searchTerm]);

  const handleEditType = (tipo: PersonalDocumentType) => {
    navigate(`/documentos/${tipo.id}/editar`);
  };

  const headerContent = (
    <div className="filters-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <div className="search-wrapper" style={{ flex: '1 1 260px' }}>
        <input
          type="search"
          placeholder="Buscar"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>
      <button className="primary-action" type="button" onClick={() => navigate('/documentos/nuevo')}>
        Nuevo tipo
      </button>
    </div>
  );

  return (
    <DashboardLayout title="Documentos" subtitle="Tipos de archivo" headerContent={headerContent}>
      {flashMessage ? (
        <div className="flash-message" role="alert">
          <span>{flashMessage}</span>
          <button type="button" onClick={() => setFlashMessage(null)} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      ) : null}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: '80px' }}>ID</th>
              <th>Nombre</th>
              <th style={{ width: '120px' }}>Vence</th>
              <th style={{ width: '150px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>Cargando tipos de documento...</td>
              </tr>
            ) : null}

            {error && !loading ? (
              <tr>
                <td colSpan={4} className="error-cell">
                  {error}
                </td>
              </tr>
            ) : null}

            {!loading && !error && filtered.length === 0 ? (
              <tr>
                <td colSpan={4}>No hay tipos de documento para mostrar.</td>
              </tr>
            ) : null}

            {!loading && !error
              ? filtered.map((tipo) => (
                  <tr key={tipo.id}>
                    <td>{tipo.id}</td>
                    <td>{tipo.nombre ?? '—'}</td>
                    <td>{tipo.vence ? 'Sí' : 'No'}</td>
                    <td>
                      <div className="action-buttons">
                        <button type="button" aria-label={`Editar tipo ${tipo.nombre ?? ''}`} onClick={() => handleEditType(tipo)}>
                          ✏️
                        </button>
                        <button
                          type="button"
                          aria-label={`Eliminar tipo ${tipo.nombre ?? ''}`}
                          onClick={() => window.alert('Funcionalidad en construcción.')}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
};

const DocumentTypeEditPage: React.FC = () => {
  const { tipoId } = useParams<{ tipoId: string }>();
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [nombre, setNombre] = useState('');
  const [vence, setVence] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!tipoId) {
      setLoadError('Identificador de tipo inválido.');
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchType = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const response = await fetch(`${apiBaseUrl}/api/personal/documentos/tipos/${tipoId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: PersonalDocumentType };
        if (!payload?.data) {
          throw new Error('Formato de respuesta inesperado');
        }

        setNombre(payload.data.nombre ?? '');
        setVence(Boolean(payload.data.vence));
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setLoadError((err as Error).message ?? 'No se pudo cargar el tipo de documento.');
      } finally {
        setLoading(false);
      }
    };

    fetchType();

    return () => controller.abort();
  }, [apiBaseUrl, tipoId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!tipoId) {
      setSubmitError('Identificador de tipo inválido.');
      return;
    }

    const trimmed = nombre.trim();
    if (!trimmed) {
      setSubmitError('Ingresá un nombre para el tipo.');
      return;
    }

    try {
      setSaving(true);
      setSubmitError(null);

      const response = await fetch(`${apiBaseUrl}/api/personal/documentos/tipos/${tipoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nombre: trimmed, vence }),
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

      navigate('/documentos', {
        state: {
          message: 'Tipo de documento actualizado correctamente.',
        },
        replace: true,
      });
    } catch (err) {
      setSubmitError((err as Error).message ?? 'No se pudo actualizar el tipo de documento.');
    } finally {
      setSaving(false);
    }
  };

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/documentos')}>
        ← Volver a documentos
      </button>
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout title="Editar tipo de archivo" subtitle="Editar tipo" headerContent={headerContent}>
        <p className="form-info">Cargando información del tipo...</p>
      </DashboardLayout>
    );
  }

  if (loadError) {
    return (
      <DashboardLayout title="Editar tipo de archivo" subtitle="Editar tipo" headerContent={headerContent}>
        <p className="form-info form-info--error">{loadError}</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Editar tipo de archivo" subtitle="Editar tipo" headerContent={headerContent}>
      <form className="edit-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="input-control" style={{ gridColumn: '1 / -1' }}>
            <span>Nombre</span>
            <input
              type="text"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Ingresar nombre"
              required
            />
          </label>
        </div>

        <div className="radio-group">
          <span>Vence</span>
          <div className="radio-options">
            <label className={`radio-option${vence ? ' is-active' : ''}`}>
              <input
                type="radio"
                name="vence"
                value="true"
                checked={vence === true}
                onChange={() => setVence(true)}
              />
              Sí
            </label>
            <label className={`radio-option${!vence ? ' is-active' : ''}`}>
              <input
                type="radio"
                name="vence"
                value="false"
                checked={vence === false}
                onChange={() => setVence(false)}
              />
              No
            </label>
          </div>
        </div>

        {submitError ? <p className="form-info form-info--error">{submitError}</p> : null}

        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => navigate('/documentos')}>
            Cancelar
          </button>
          <button type="submit" className="primary-action" disabled={saving}>
            {saving ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
};

const DocumentTypeCreatePage: React.FC = () => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [vence, setVence] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = nombre.trim();
    if (!trimmed) {
      setSubmitError('Ingresá un nombre para el tipo.');
      return;
    }

    try {
      setSaving(true);
      setSubmitError(null);

      const response = await fetch(`${apiBaseUrl}/api/personal/documentos/tipos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nombre: trimmed, vence }),
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

      navigate('/documentos', {
        replace: true,
        state: {
          message: 'Tipo de documento creado correctamente.',
        },
      });
    } catch (err) {
      setSubmitError((err as Error).message ?? 'No se pudo crear el tipo de documento.');
    } finally {
      setSaving(false);
    }
  };

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/documentos')}>
        ← Volver a documentos
      </button>
    </div>
  );

  return (
    <DashboardLayout title="Nuevo tipo de archivo" subtitle="Crear tipo" headerContent={headerContent}>
      <form className="edit-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="input-control" style={{ gridColumn: '1 / -1' }}>
            <span>Nombre</span>
            <input
              type="text"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Ingresar nombre"
              required
            />
          </label>
        </div>

        <div className="radio-group">
          <span>Vence</span>
          <div className="radio-options">
            <label className={`radio-option${vence ? ' is-active' : ''}`}>
              <input
                type="radio"
                name="vence"
                value="true"
                checked={vence === true}
                onChange={() => setVence(true)}
              />
              Sí
            </label>
            <label className={`radio-option${!vence ? ' is-active' : ''}`}>
              <input
                type="radio"
                name="vence"
                value="false"
                checked={vence === false}
                onChange={() => setVence(false)}
              />
              No
            </label>
          </div>
        </div>

        {submitError ? <p className="form-info form-info--error">{submitError}</p> : null}

        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => navigate('/documentos')}>
            Cancelar
          </button>
          <button type="submit" className="primary-action" disabled={saving}>
            {saving ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
};

const CreateUnitPage: React.FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [formValues, setFormValues] = useState({
    matricula: '',
    marca: '',
    modelo: '',
    anio: '',
    observacion: '',
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSubmitError(null);
      setSuccessMessage(null);
      setSaving(true);

      const response = await fetch(`${apiBaseUrl}/api/unidades`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matricula: formValues.matricula.trim() || null,
          marca: formValues.marca.trim() || null,
          modelo: formValues.modelo.trim() || null,
          anio: formValues.anio.trim() || null,
          observacion: formValues.observacion.trim() || null,
        }),
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

      const payload = (await response.json()) as {
        message?: string;
        data: Unidad;
      };

      setSuccessMessage(payload.message ?? 'Unidad registrada correctamente.');
      setFormValues({
        matricula: payload.data.matricula ?? '',
        marca: payload.data.marca ?? '',
        modelo: payload.data.modelo ?? '',
        anio: payload.data.anio ?? '',
        observacion: payload.data.observacion ?? '',
      });
    } catch (err) {
      setSubmitError((err as Error).message ?? 'No se pudo registrar la unidad.');
    } finally {
      setSaving(false);
    }
  };

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/unidades')}>
        ← Volver a unidades
      </button>
    </div>
  );

  return (
    <DashboardLayout title="Crear unidad" subtitle="Registrar una nueva unidad" headerContent={headerContent}>
      <form className="edit-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="input-control">
            <span>Matrícula</span>
            <input
              type="text"
              value={formValues.matricula}
              onChange={(event) => setFormValues((prev) => ({ ...prev, matricula: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Marca</span>
            <input
              type="text"
              value={formValues.marca}
              onChange={(event) => setFormValues((prev) => ({ ...prev, marca: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Modelo</span>
            <input
              type="text"
              value={formValues.modelo}
              onChange={(event) => setFormValues((prev) => ({ ...prev, modelo: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Año</span>
            <input
              type="text"
              value={formValues.anio}
              onChange={(event) => setFormValues((prev) => ({ ...prev, anio: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
        </div>

        <label className="input-control">
          <span>Observación</span>
          <input
            type="text"
            value={formValues.observacion}
            onChange={(event) => setFormValues((prev) => ({ ...prev, observacion: event.target.value }))}
            placeholder="Ingresar"
          />
        </label>

        {submitError ? <p className="form-info form-info--error">{submitError}</p> : null}
        {successMessage ? <p className="form-info form-info--success">{successMessage}</p> : null}

        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => navigate('/unidades')}>
            Cancelar
          </button>
          <button type="submit" className="primary-action" disabled={saving}>
            {saving ? 'Registrando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
};

const EditUnitPage: React.FC = () => {
  const { unidadId } = useParams<{ unidadId: string }>();
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [formValues, setFormValues] = useState({
    matricula: '',
    marca: '',
    modelo: '',
    anio: '',
    observacion: '',
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!unidadId) {
      setLoadError('Identificador de unidad inválido.');
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchUnidad = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const response = await fetch(`${apiBaseUrl}/api/unidades/${unidadId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: Unidad };
        if (!payload?.data) {
          throw new Error('Formato de respuesta inesperado');
        }

        setFormValues({
          matricula: payload.data.matricula ?? '',
          marca: payload.data.marca ?? '',
          modelo: payload.data.modelo ?? '',
          anio: payload.data.anio ?? '',
          observacion: payload.data.observacion ?? '',
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }

        setLoadError((err as Error).message ?? 'No se pudo cargar la unidad.');
      } finally {
        setLoading(false);
      }
    };

    fetchUnidad();

    return () => controller.abort();
  }, [unidadId, apiBaseUrl]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!unidadId) {
      setSubmitError('Identificador de unidad inválido.');
      return;
    }

    try {
      setSubmitError(null);
      setSuccessMessage(null);
      setSaving(true);

      const response = await fetch(`${apiBaseUrl}/api/unidades/${unidadId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matricula: formValues.matricula.trim() || null,
          marca: formValues.marca.trim() || null,
          modelo: formValues.modelo.trim() || null,
          anio: formValues.anio.trim() || null,
          observacion: formValues.observacion.trim() || null,
        }),
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

      const payload = (await response.json()) as { message?: string; data: Unidad };

      setSuccessMessage(payload.message ?? 'Unidad actualizada correctamente.');
      setFormValues({
        matricula: payload.data.matricula ?? '',
        marca: payload.data.marca ?? '',
        modelo: payload.data.modelo ?? '',
        anio: payload.data.anio ?? '',
        observacion: payload.data.observacion ?? '',
      });
    } catch (err) {
      setSubmitError((err as Error).message ?? 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/unidades')}>
        ← Volver a unidades
      </button>
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout title="Editar unidad" subtitle={`Unidad #${unidadId ?? ''}`} headerContent={headerContent}>
        <p className="form-info">Cargando información de la unidad...</p>
      </DashboardLayout>
    );
  }

  if (loadError) {
    return (
      <DashboardLayout title="Editar unidad" subtitle={`Unidad #${unidadId ?? ''}`} headerContent={headerContent}>
        <p className="form-info form-info--error">{loadError}</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Editar unidad" subtitle={`Unidad #${unidadId ?? ''}`} headerContent={headerContent}>
      <form className="edit-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="input-control">
            <span>Matrícula</span>
            <input
              type="text"
              value={formValues.matricula}
              onChange={(event) => setFormValues((prev) => ({ ...prev, matricula: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Marca</span>
            <input
              type="text"
              value={formValues.marca}
              onChange={(event) => setFormValues((prev) => ({ ...prev, marca: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Modelo</span>
            <input
              type="text"
              value={formValues.modelo}
              onChange={(event) => setFormValues((prev) => ({ ...prev, modelo: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Año</span>
            <input
              type="text"
              value={formValues.anio}
              onChange={(event) => setFormValues((prev) => ({ ...prev, anio: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
        </div>

        <label className="input-control">
          <span>Observación</span>
          <input
            type="text"
            value={formValues.observacion}
            onChange={(event) => setFormValues((prev) => ({ ...prev, observacion: event.target.value }))}
            placeholder="Ingresar"
          />
        </label>

        {submitError ? <p className="form-info form-info--error">{submitError}</p> : null}
        {successMessage ? <p className="form-info form-info--success">{successMessage}</p> : null}

        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => navigate('/unidades')}>
            Cancelar
          </button>
          <button type="submit" className="primary-action" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
};

const CreateClientPage: React.FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);

  const [formValues, setFormValues] = useState({
    codigo: '',
    nombre: '',
    direccion: '',
    documento_fiscal: '',
  });
  const [sucursales, setSucursales] = useState<EditableSucursal[]>([]);
  const [newSucursalNombre, setNewSucursalNombre] = useState('');
  const [newSucursalDireccion, setNewSucursalDireccion] = useState('');
  const [sucursalFormError, setSucursalFormError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAddSucursal = () => {
    const nombre = newSucursalNombre.trim();
    const direccion = newSucursalDireccion.trim();

    if (!nombre && !direccion) {
      setSucursalFormError('Ingresa al menos el nombre o la dirección para agregar una sucursal.');
      return;
    }

    setSucursales((prev) => [
      ...prev,
      {
        id: null,
        nombre,
        direccion,
        key: `new-${uniqueKey()}`,
      },
    ]);

    setNewSucursalNombre('');
    setNewSucursalDireccion('');
    setSucursalFormError(null);
  };

  const handleRemoveSucursal = (key: string) => {
    setSucursales((prev) => prev.filter((sucursal) => sucursal.key !== key));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSubmitError(null);
      setSuccessMessage(null);
      setSaving(true);

      const response = await fetch(`${apiBaseUrl}/api/clientes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          codigo: formValues.codigo.trim() || null,
          nombre: formValues.nombre.trim() || null,
          direccion: formValues.direccion.trim() || null,
          documento_fiscal: formValues.documento_fiscal.trim() || null,
          sucursales: sucursales.map((sucursal) => ({
            nombre: sucursal.nombre.trim() || null,
            direccion: sucursal.direccion.trim() || null,
          })),
        }),
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

      const payload = (await response.json()) as { message?: string; data: Cliente };

      setSuccessMessage(payload.message ?? 'Cliente registrado correctamente.');
      setFormValues({
        codigo: payload.data.codigo ?? '',
        nombre: payload.data.nombre ?? '',
        direccion: payload.data.direccion ?? '',
        documento_fiscal: payload.data.documento_fiscal ?? '',
      });

      setSucursales(
        (payload.data.sucursales ?? []).map<EditableSucursal>((sucursal) => ({
          id: sucursal.id ?? null,
          nombre: sucursal.nombre ?? '',
          direccion: sucursal.direccion ?? '',
          key: sucursal.id ? `existing-${sucursal.id}` : `new-${uniqueKey()}`,
        }))
      );
      setNewSucursalNombre('');
      setNewSucursalDireccion('');
      setSucursalFormError(null);
    } catch (err) {
      setSubmitError((err as Error).message ?? 'No se pudo registrar el cliente.');
    } finally {
      setSaving(false);
    }
  };

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/clientes')}>
        ← Volver a clientes
      </button>
    </div>
  );

  return (
    <DashboardLayout title="Crear cliente" subtitle="Registrar un nuevo cliente" headerContent={headerContent}>
      <form className="edit-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="input-control">
            <span>Código</span>
            <input
              type="text"
              value={formValues.codigo}
              onChange={(event) => setFormValues((prev) => ({ ...prev, codigo: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Nombre</span>
            <input
              type="text"
              value={formValues.nombre}
              onChange={(event) => setFormValues((prev) => ({ ...prev, nombre: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Dirección</span>
            <input
              type="text"
              value={formValues.direccion}
              onChange={(event) => setFormValues((prev) => ({ ...prev, direccion: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Documento fiscal</span>
            <input
              type="text"
              value={formValues.documento_fiscal}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, documento_fiscal: event.target.value }))
              }
              placeholder="Ingresar"
            />
          </label>
        </div>

        <div className="sucursal-form">
          <label className="input-control">
            <span>Nombre de sucursal</span>
            <input
              type="text"
              value={newSucursalNombre}
              onChange={(event) => setNewSucursalNombre(event.target.value)}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Dirección de sucursal</span>
            <input
              type="text"
              value={newSucursalDireccion}
              onChange={(event) => setNewSucursalDireccion(event.target.value)}
              placeholder="Ingresar"
            />
          </label>
          <button
            type="button"
            className="secondary-action secondary-action--add"
            onClick={handleAddSucursal}
          >
            + Agregar
          </button>
        </div>

        {sucursalFormError ? <p className="form-info form-info--error">{sucursalFormError}</p> : null}

        <div className="chip-list">
          {sucursales.length === 0 ? <p className="form-empty">No hay sucursales registradas.</p> : null}
          {sucursales.map((sucursal) => {
            const labelParts = [sucursal.nombre, sucursal.direccion].filter(Boolean);
            const label = labelParts.length > 0 ? labelParts.join(' - ') : 'Sin datos';

            return (
              <span key={sucursal.key} className="chip">
                <span>{label}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSucursal(sucursal.key)}
                  aria-label={`Eliminar sucursal ${label}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>

        {submitError ? <p className="form-info form-info--error">{submitError}</p> : null}
        {successMessage ? <p className="form-info form-info--success">{successMessage}</p> : null}

        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => navigate('/clientes')}>
            Cancelar
          </button>
          <button type="submit" className="primary-action" disabled={saving}>
            {saving ? 'Registrando...' : 'Registrar cliente'}
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
};

const EditClientPage: React.FC = () => {
  const { clienteId } = useParams<{ clienteId: string }>();
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formValues, setFormValues] = useState({
    codigo: '',
    nombre: '',
    direccion: '',
    documento_fiscal: '',
  });
  const [sucursales, setSucursales] = useState<EditableSucursal[]>([]);
  const [newSucursalNombre, setNewSucursalNombre] = useState('');
  const [newSucursalDireccion, setNewSucursalDireccion] = useState('');
  const [sucursalFormError, setSucursalFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clienteId) {
      setLoadError('Identificador de cliente inválido.');
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchCliente = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const response = await fetch(`${apiBaseUrl}/api/clientes/${clienteId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: Cliente };

        if (!payload || !payload.data) {
          throw new Error('Formato de respuesta inesperado');
        }

        const normalized = adaptCliente(payload.data);
        setFormValues(normalized.form);
        setSucursales(normalized.sucursales);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setLoadError((err as Error).message ?? 'No se pudo cargar el cliente.');
      } finally {
        setLoading(false);
      }
    };

    fetchCliente();

    return () => controller.abort();
  }, [clienteId, apiBaseUrl]);

  const handleAddSucursal = () => {
    const nombre = newSucursalNombre.trim();
    const direccion = newSucursalDireccion.trim();

    if (!nombre && !direccion) {
      setSucursalFormError('Ingresa al menos el nombre o la dirección para agregar una sucursal.');
      return;
    }

    setSucursales((prev) => [
      ...prev,
      {
        id: null,
        nombre,
        direccion,
        key: `new-${uniqueKey()}`,
      },
    ]);

    setNewSucursalNombre('');
    setNewSucursalDireccion('');
    setSucursalFormError(null);
  };

  const handleRemoveSucursal = (key: string) => {
    setSucursales((prev) => prev.filter((sucursal) => sucursal.key !== key));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!clienteId) {
      setSubmitError('Identificador de cliente inválido.');
      return;
    }

    try {
      setSubmitError(null);
      setSuccessMessage(null);
      setSaving(true);

      const response = await fetch(`${apiBaseUrl}/api/clientes/${clienteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          codigo: formValues.codigo.trim() || null,
          nombre: formValues.nombre.trim() || null,
          direccion: formValues.direccion.trim() || null,
          documento_fiscal: formValues.documento_fiscal.trim() || null,
          sucursales: sucursales.map((sucursal) => ({
            id: sucursal.id,
            nombre: sucursal.nombre.trim() || null,
            direccion: sucursal.direccion.trim() || null,
          })),
        }),
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
          // ignore JSON parse errors
        }

        throw new Error(message);
      }

      const payload = (await response.json()) as { message?: string; data: Cliente };
      const normalized = adaptCliente(payload.data);

      setFormValues(normalized.form);
      setSucursales(normalized.sucursales);
      setSuccessMessage(payload.message ?? 'Cliente actualizado correctamente.');
      setSucursalFormError(null);
    } catch (err) {
      setSubmitError((err as Error).message ?? 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/clientes')}>
        ← Volver a clientes
      </button>
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout title="Editar cliente" subtitle={`Cliente #${clienteId ?? ''}`} headerContent={headerContent}>
        <p className="form-info">Cargando información del cliente...</p>
      </DashboardLayout>
    );
  }

  if (loadError) {
    return (
      <DashboardLayout title="Editar cliente" subtitle={`Cliente #${clienteId ?? ''}`} headerContent={headerContent}>
        <p className="form-info form-info--error">{loadError}</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Editar cliente" subtitle={`Cliente #${clienteId ?? ''}`} headerContent={headerContent}>
      <form className="edit-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="input-control">
            <span>Código</span>
            <input
              type="text"
              value={formValues.codigo}
              onChange={(event) => setFormValues((prev) => ({ ...prev, codigo: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Nombre</span>
            <input
              type="text"
              value={formValues.nombre}
              onChange={(event) => setFormValues((prev) => ({ ...prev, nombre: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Dirección</span>
            <input
              type="text"
              value={formValues.direccion}
              onChange={(event) => setFormValues((prev) => ({ ...prev, direccion: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Documento fiscal</span>
            <input
              type="text"
              value={formValues.documento_fiscal}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, documento_fiscal: event.target.value }))
              }
              placeholder="Ingresar"
            />
          </label>
        </div>

        <div className="sucursal-form">
          <label className="input-control">
            <span>Nombre de sucursal</span>
            <input
              type="text"
              value={newSucursalNombre}
              onChange={(event) => setNewSucursalNombre(event.target.value)}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>Dirección de sucursal</span>
            <input
              type="text"
              value={newSucursalDireccion}
              onChange={(event) => setNewSucursalDireccion(event.target.value)}
              placeholder="Ingresar"
            />
          </label>
          <button
            type="button"
            className="secondary-action secondary-action--add"
            onClick={handleAddSucursal}
          >
            + Agregar
          </button>
        </div>

        {sucursalFormError ? <p className="form-info form-info--error">{sucursalFormError}</p> : null}

        <div className="chip-list">
          {sucursales.length === 0 ? <p className="form-empty">No hay sucursales registradas.</p> : null}
          {sucursales.map((sucursal) => {
            const labelParts = [sucursal.nombre, sucursal.direccion].filter(Boolean);
            const label = labelParts.length > 0 ? labelParts.join(' - ') : 'Sin datos';

            return (
              <span key={sucursal.key} className="chip">
                <span>{label}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSucursal(sucursal.key)}
                  aria-label={`Eliminar sucursal ${label}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>

        {submitError ? <p className="form-info form-info--error">{submitError}</p> : null}
        {successMessage ? <p className="form-info form-info--success">{successMessage}</p> : null}

        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => navigate('/clientes')}>
            Cancelar
          </button>
          <button type="submit" className="primary-action" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/dashboard" element={<Navigate to="/clientes" replace />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/chat/:contactId" element={<ChatPage />} />
      <Route path="/informacion-general" element={<GeneralInfoPage />} />
      <Route path="/clientes" element={<DashboardPage />} />
      <Route path="/unidades" element={<UnitsPage />} />
      <Route path="/reclamos" element={<ReclamosPage />} />
      <Route path="/reclamos/nuevo" element={<CreateReclamoPage />} />
      <Route path="/notificaciones" element={<NotificationsPage />} />
      <Route path="/reclamos/:reclamoId" element={<ReclamoDetailPage />} />
      <Route path="/unidades/nuevo" element={<CreateUnitPage />} />
      <Route path="/unidades/:unidadId/editar" element={<EditUnitPage />} />
      <Route path="/personal" element={<PersonalPage />} />
      <Route path="/personal/nuevo" element={<PersonalCreatePage />} />
      <Route path="/personal/:personaId/editar" element={<PersonalEditPage />} />
      <Route path="/liquidaciones" element={<LiquidacionesPage />} />
      <Route path="/liquidaciones/:personaId" element={<LiquidacionesPage />} />
      <Route path="/documentos" element={<DocumentTypesPage />} />
      <Route path="/documentos/nuevo" element={<DocumentTypeCreatePage />} />
      <Route path="/documentos/:tipoId/editar" element={<DocumentTypeEditPage />} />
      <Route path="/usuarios" element={<UsersPage />} />
      <Route path="/usuarios/nuevo" element={<CreateUserPage />} />
      <Route path="/usuarios/:usuarioId/editar" element={<EditUserPage />} />
      <Route path="/control-horario/:userKey" element={<AttendanceUserDetailPage />} />
      <Route path="/control-horario" element={<AttendanceLogPage />} />
      <Route path="/flujo-trabajo" element={<WorkflowPage />} />
      <Route path="/aprobaciones" element={<ApprovalsRequestsPage />} />
      <Route path="/clientes/nuevo" element={<CreateClientPage />} />
      <Route path="/clientes/:clienteId/editar" element={<EditClientPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
