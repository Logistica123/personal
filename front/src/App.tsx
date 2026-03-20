import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Routes,
  Route,
  NavLink,
  useNavigate,
  useParams,
  useLocation,
  Navigate,
  Outlet,
} from 'react-router-dom';
import './App.css';
import type { Cliente } from './features/clientes/types';
import type { ReclamoRecord } from './features/reclamos/types';
import { PersonalRadarPanel } from './features/personal/PersonalRadarPanel';
import { PersonalTeamsPanel } from './features/personal/PersonalTeamsPanel';
import type { AttendanceRecord, RemoteAttendanceApiRecord } from './features/controlHorario/types';
import {
  deriveAttendanceUserKey,
  persistAttendanceRecord,
  readAttendanceRecordFromStorage,
  removeAttendanceRecordFromStorage,
} from './features/controlHorario/storage';
import { mapRemoteAttendance } from './features/controlHorario/utils';
import type { PersonalRecord } from './features/personal/types';
import type { Usuario } from './features/usuarios/types';
import { markCelebrationAsDismissed, resetCelebrationDismissedCache } from './features/notificaciones/celebrations';
import type { NotificationRecord } from './features/notificaciones/types';
import { ClientesPage } from './pages/ClientesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ReclamoDetallePage } from './pages/ReclamoDetallePage';
import { ReclamoNuevoPage } from './pages/ReclamoNuevoPage';
import { ReclamosPage } from './pages/ReclamosPage';
import { ResumenPage } from './pages/ResumenPage';
import { TicketeraPage } from './pages/TicketeraPage';
import { UnidadEditarPage } from './pages/UnidadEditarPage';
import { UnidadNuevaPage } from './pages/UnidadNuevaPage';
import { UnidadesPage } from './pages/UnidadesPage';
import { UsuarioEditarPage } from './pages/UsuarioEditarPage';
import { UsuarioNuevoPage } from './pages/UsuarioNuevoPage';
import { UsuariosPage } from './pages/UsuariosPage';
import { RrhhPage } from './pages/RrhhPage';
import { ProveedoresPage } from './pages/ProveedoresPage';
import { ProveedorEditarPage } from './pages/ProveedorEditarPage';
import { ProveedorNuevoPage } from './pages/ProveedorNuevoPage';
import { WebRtcCallsPage } from './pages/WebRtcCallsPage';
import { AttendanceLogPage } from './pages/AttendanceLogPage';
import { AttendanceUserDetailPage } from './pages/AttendanceUserDetailPage';
import { AuditPage } from './pages/AuditPage';
import { WorkflowPage } from './pages/WorkflowPage';
import { ApprovalsRequestsPage } from './pages/ApprovalsRequestsPage';
import { LiquidacionesClientePage } from './pages/LiquidacionesClientePage';
import { LiquidacionesPage } from './pages/LiquidacionesPage';
import { RecibosPage } from './pages/RecibosPage';
import { DocumentTypesPage } from './pages/DocumentTypesPage';
import { DocumentTypeCreatePage } from './pages/DocumentTypeCreatePage';
import { DocumentTypeEditPage } from './pages/DocumentTypeEditPage';
import { TaxProfileSection } from './features/legajoImpositivo/TaxProfileSection';
import { createFacturacionPages } from './pages/facturacion/facturacionPages';

const AUTH_STORAGE_KEY = 'authUser';

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

const withAuthToken = (url: string | null): string | null => {
  if (!url) {
    return null;
  }
  const token = readAuthTokenFromStorage();
  if (!token) {
    return url;
  }
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('api_token', token);
    return parsed.toString();
  } catch {
    return url;
  }
};

const parseJsonSafe = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const text = await response.text();
    const normalized = text.replace(/\s+/g, ' ').trim();
    const isHtmlLike =
      contentType.toLowerCase().includes('text/html') ||
      /^<!doctype html/i.test(normalized) ||
      /<html[\s>]/i.test(normalized);

    if (isHtmlLike) {
      throw new Error(
        'El servidor respondió HTML en vez de JSON. Verificá que la API esté activa y que REACT_APP_API_BASE apunte al backend.'
      );
    }

    const plainPreview = normalized.replace(/<[^>]*>/g, '').trim().slice(0, 200);
    throw new Error(plainPreview || 'Respuesta no es JSON');
  }
  return response.json();
};

const solicitudCacheKey = (id: number | null | undefined) =>
  (id != null ? `personal:solicitudData:${id}` : '');

const readCachedSolicitudData = (id: number | null | undefined): unknown | null => {
  const key = solicitudCacheKey(id);
  if (!key || typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeCachedSolicitudData = (id: number | null | undefined, data: unknown) => {
  const key = solicitudCacheKey(id);
  if (!key || typeof window === 'undefined' || data == null) {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore write errors
  }
};

const personalEditCacheKey = (id: number | null | undefined) =>
  (id != null ? `personal:editCache:${id}` : '');

const readPersonalEditCache = (id: number | null | undefined): Partial<PersonalDetail> | null => {
  const key = personalEditCacheKey(id);
  if (!key || typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<PersonalDetail>) : null;
  } catch {
    return null;
  }
};

const writePersonalEditCache = (id: number | null | undefined, data: Partial<PersonalDetail>) => {
  const key = personalEditCacheKey(id);
  if (!key || typeof window === 'undefined' || !data) {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore
  }
};

type ActivoAsesorComercialRecord = {
  id: number;
  encargado: string | null;
  lider: string | null;
  asesorComercial: string | null;
  rol: string | null;
  modalidadTrabajo?: string | null;
  transportistaActivo: string | null;
  numero: string | null;
  comentarios?: string | null;
  cliente?: string | null;
  asesorPostventa?: string | null;
  sucursal?: string | null;
  vehiculo?: string | null;
  fechaUltimaAsignacion?: string | null;
  rowOrder?: number | null;
  updatedAt?: string | null;
};
type TarifaImagenItem = {
  id: number;
  clienteId: number | null;
  sucursalId: number | null;
  mes: number | null;
  anio: number | null;
  tipo?: string | null;
  nombreOriginal: string | null;
  url: string | null;
  relativeUrl?: string | null;
  dataUrl?: string | null;
  templateData?: TarifaTemplate | null;
  clienteNombre?: string | null;
  sucursalNombre?: string | null;
  updatedAt?: string | null;
};
type TarifaTemplateRow = {
  label: string;
  values: string[];
};
type TarifaTemplate = {
  title: string;
  subtitle: string;
  tableTitle: string;
  columns: string[];
  rows: TarifaTemplateRow[];
  observations: string;
};

const normalizeTarifaTemplate = (template: TarifaTemplate): TarifaTemplate => {
  let columns = [...template.columns];
  const observations = template.observations ?? '';
  if (columns.length === 0) {
    columns.push('Columna 1');
  }
  const observationsIndex = columns.findIndex((col) => col.trim().toLowerCase() === 'observaciones');
  if (observationsIndex !== -1) {
    columns = columns.filter((_, index) => index !== observationsIndex);
  }
  const normalizedRows = template.rows.map((row, index) => {
    const values = [...row.values];
    while (values.length < columns.length) {
      values.push('');
    }
    if (values.length > columns.length) {
      values.length = columns.length;
    }
    return {
      label: row.label || `Zona ${index + 1}`,
      values,
    };
  });
  return {
    ...template,
    columns,
    rows: normalizedRows,
    observations,
  };
};
type UserRole = 'admin' | 'admin2' | 'encargado' | 'operator' | 'asesor';
type AccessSection =
  | 'distriapp'
  | 'clientes'
  | 'panel-general'
  | 'resumen'
  | 'unidades'
  | 'usuarios'
  | 'rrhh'
  | 'personal'
  | 'reclamos'
  | 'ticketera'
  | 'notificaciones'
  | 'control-horario'
  | 'liquidaciones'
  | 'pagos'
  | 'facturacion'
  | 'combustible'
  | 'auditoria'
  | 'tarifas'
  | 'flujo-trabajo'
  | 'aprobaciones'
  | 'solicitud-personal'
  | 'bases'
  | 'bdd-activos-asesores'
  | 'documentos'
  | 'configuracion';

const DEFAULT_TARIFA_TEMPLATE: TarifaTemplate = {
  title: 'Tarifa resistencia',
  subtitle: 'Camioneta chica',
  tableTitle: 'Tipo de paquetería',
  columns: ['Chico', 'Grande', 'Valorado', 'Farmacia', 'Bolson', 'Fijo'],
  rows: [
    { label: 'Zona 1', values: ['', '', '', '', '', ''] },
    { label: 'Zona 3', values: ['', '', '', '', '', ''] },
    { label: 'Zona 4', values: ['', '', '', '', '', ''] },
    { label: 'Zona 5', values: ['', '', '', '', '', ''] },
    { label: 'Zona 6', values: ['', '', '', '', '', ''] },
    { label: 'Zona 7', values: ['', '', '', '', '', ''] },
    { label: 'Zona 10', values: ['', '', '', '', '', ''] },
  ],
  observations: '',
};
const TARIFA_MONTH_OPTIONS = [
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];
const TARIFA_PORTE_OPTIONS = [
  { value: 'chico', label: 'Porte chico' },
  { value: 'mediano', label: 'Porte mediano' },
  { value: 'grande', label: 'Porte grande' },
  { value: 'urbano_chico', label: 'Urbano - Porte chico' },
  { value: 'urbano_grande', label: 'Urbano - Porte grande' },
  { value: 'meli_urbano_chico', label: 'Tarifa Meli - Urbano - Porte chico' },
  { value: 'meli_urbano_grande', label: 'Tarifa Meli - Urbano - Porte grande' },
];

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

type PersonalDetail = {
  id: number;
  nombres: string | null;
  apellidos: string | null;
  legajo: string | null;
  cuil: string | null;
  telefono: string | null;
  email: string | null;
  perfil: string | null;
  perfilValue: number | null;
  agente: string | null;
  agenteId: number | null;
  agenteResponsable: string | null;
  agenteResponsableId: number | null;
  agentesResponsables?: string[] | null;
  agentesResponsablesIds?: number[] | null;
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
  combustible?: string | null;
  combustibleValue: boolean;
  combustibleEstado?: string | null;
  fechaBaja?: string | null;
  tarifaEspecial?: string | null;
  tarifaEspecialValue: boolean;
  pago: string | null;
  cbuAlias: string | null;
  observacionTarifa: string | null;
  observaciones: string | null;
  esCobrador: boolean;
  cobradorNombre: string | null;
  cobradorEmail: string | null;
  cobradorCuil: string | null;
  cobradorCbuAlias: string | null;
  fechaAlta: string | null;
  fechaAltaVinculacion: string | null;
  aprobado: boolean;
  aprobadoAt: string | null;
  aprobadoPorId: number | null;
  aprobadoPorNombre: string | null;
  esSolicitud: boolean;
  solicitudData?: unknown;
  transportistaQrCode?: string | null;
  transportistaQrRedirectUrl?: string | null;
  transportistaQrLandingUrl?: string | null;
  transportistaQrImageUrl?: string | null;
  transportistaQrScansCount?: number | null;
  transportistaQrLastScanAt?: string | null;
  transportistaQrLastScanAtLabel?: string | null;
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
    sourceDownloadUrl?: string | null;
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
    importeCombustible?: number | null;
    importeFacturar?: number | null;
    monthKey?: string | null;
    fortnightKey?: string | null;
    pendiente?: boolean;
    liquidacionId?: number | null;
    enviada?: boolean;
    recibido?: boolean;
    pagado?: boolean;
    validacionIaEstado?: string | null;
    validacionIaMotivo?: string | null;
    validacionIaMensaje?: string | null;
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

const PERSON_TAX_ID_LABEL = 'CUIT/CUIL';
const COLLECTOR_TAX_ID_LABEL = 'CUIT/CUIL del cobrador';
const OWNER_TAX_ID_LABEL = 'CUIT/CUIL (Dueño)';
const OWNER_COLLECTOR_TAX_ID_LABEL = 'CUIT/CUIL cobrador';

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

const PERFIL_DISPLAY_LABELS: Record<number, string> = {
  1: 'Transportista',
  2: 'Cobrador',
  3: 'Servicios',
};

const getPerfilDisplayLabel = (value?: number | null, fallback?: string | null): string => {
  if (value != null && PERFIL_DISPLAY_LABELS[value]) {
    return PERFIL_DISPLAY_LABELS[value];
  }
  return fallback ?? '';
};

type AltaSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

const PAGO_SELECT_OPTIONS: AltaSelectOption[] = [
  { value: '1', label: 'Con factura' },
  { value: '0', label: 'Sin factura' },
];

const parsePagoFlag = (value: string | number | boolean | null | undefined): boolean | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (['1', 'true', 'si', 'sí', 'con', 'factura', 'con factura'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'sin', 'sin factura', 'sn', 's/n'].includes(normalized)) {
    return false;
  }

  const numeric = Number(normalized);
  if (!Number.isNaN(numeric)) {
    return numeric !== 0;
  }

  return null;
};

const formatPagoLabel = (value: string | number | boolean | null | undefined): string => {
  const flag = parsePagoFlag(value);
  if (flag === true) {
    return 'Con factura';
  }
  if (flag === false) {
    return 'Sin factura';
  }
  return '';
};

const serializePagoValue = (value: string | number | boolean | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  if (normalized.toLowerCase() === 'true') {
    return 1;
  }
  if (normalized.toLowerCase() === 'false') {
    return 0;
  }

  const numeric = Number(normalized);
  if (Number.isNaN(numeric)) {
    return null;
  }

  return numeric;
};

const formatRoleLabel = (role: string | null | undefined): string => {
  const normalized = role?.trim().toLowerCase();
  if (normalized === 'admin' || normalized === 'administrador') {
    return 'Administrador';
  }
  if (normalized === 'admin2' || normalized === 'administrador2' || normalized === 'administrador 2') {
    return 'Administrador 2';
  }
  if (normalized === 'asesor' || normalized === 'asesores') {
    return 'Asesor';
  }
  if (normalized === 'encargado' || normalized === 'encargados') {
    return 'Encargado';
  }
  if (normalized === 'operator' || normalized === 'operador') {
    return 'Operador';
  }
  return 'Usuario';
};

const normalizeUserRole = (role: string | null | undefined): UserRole => {
  const normalized = role?.trim().toLowerCase() ?? '';

  if (normalized.includes('admin')) {
    return normalized.includes('2') ? 'admin2' : 'admin';
  }

  if (normalized.includes('encarg')) {
    return 'encargado';
  }

  if (normalized.includes('oper')) {
    return 'operator';
  }

  if (normalized.includes('asesor')) {
    return 'asesor';
  }

  // Fallback: si no hay rol definido lo tratamos como asesor para no bloquear reclamos.
  return 'asesor';
};

const getUserRole = (authUser: AuthUser | null | undefined): UserRole => normalizeUserRole(authUser?.role);

const isElevatedRole = (role: UserRole): boolean => role === 'admin' || role === 'admin2' || role === 'asesor';

const USER_ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'operator', label: 'Operador' },
  { value: 'asesor', label: 'Asesor' },
  { value: 'encargado', label: 'Encargado' },
  { value: 'admin2', label: 'Administrador 2' },
  { value: 'admin', label: 'Administrador' },
];

const USER_PERMISSION_OPTIONS: Array<{ value: AccessSection; label: string }> = [
  { value: 'distriapp', label: 'Distriapp' },
  { value: 'panel-general', label: 'Panel general' },
  { value: 'resumen', label: 'Resumen' },
  { value: 'clientes', label: 'Gestión de clientes' },
  { value: 'unidades', label: 'Gestión de unidades' },
  { value: 'usuarios', label: 'Gestión de usuarios' },
  { value: 'rrhh', label: 'RRHH' },
  { value: 'personal', label: 'Proveedores' },
  { value: 'reclamos', label: 'Reclamos' },
  { value: 'ticketera', label: 'Ticketera' },
  { value: 'notificaciones', label: 'Notificaciones' },
  { value: 'control-horario', label: 'Control horario' },
  { value: 'auditoria', label: 'Auditoría' },
  { value: 'flujo-trabajo', label: 'Flujo de trabajo' },
  { value: 'aprobaciones', label: 'Aprobaciones/solicitudes' },
  { value: 'solicitud-personal', label: 'Solicitud personal' },
  { value: 'liquidaciones', label: 'Liquidaciones' },
  { value: 'pagos', label: 'Pago' },
  { value: 'facturacion', label: 'Facturación' },
  { value: 'combustible', label: 'Combustible' },
  { value: 'tarifas', label: 'Tarifas' },
  { value: 'bases', label: 'Bases de distribución' },
  { value: 'bdd-activos-asesores', label: 'BDD Activos x Asesores Comerciales' },
  { value: 'documentos', label: 'Documentos' },
  { value: 'configuracion', label: 'Configuración' },
];

const RRHH_DOCUMENT_CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'FICHA_MEDICA', label: 'Ficha médica' },
  { value: 'CONTRATO', label: 'Contrato' },
  { value: 'DNI', label: 'DNI' },
  { value: 'CV', label: 'CV' },
  { value: 'RECIBO_SUELDO', label: 'Recibo de sueldo' },
  { value: 'APTO_MEDICO', label: 'Apto médico' },
  { value: 'OTRO', label: 'Otro' },
];

const canAccessSection = (
  role: UserRole,
  section: AccessSection,
  permissions?: string[] | null
): boolean => {
  if (role === 'admin' || role === 'admin2') {
    return true;
  }

  if (Array.isArray(permissions)) {
    if (permissions.includes(section)) {
      return true;
    }

    if (section === 'bdd-activos-asesores') {
      return role === 'asesor';
    }

    return false;
  }

  switch (section) {
    case 'distriapp':
      return role !== 'operator' && role !== 'asesor';
    case 'usuarios':
    case 'rrhh':
    case 'control-horario':
    case 'liquidaciones':
    case 'pagos':
    case 'facturacion':
    case 'combustible':
    case 'auditoria':
    case 'configuracion':
      return false;
    case 'clientes':
    case 'panel-general':
    case 'resumen':
    case 'unidades':
      return role !== 'operator' && role !== 'asesor';
    case 'reclamos':
      return true; // Todos los roles pueden crear/ver reclamos (incluido asesor)
    case 'personal':
      return role === 'asesor' || role === 'encargado';
    case 'tarifas':
      return true;
    case 'ticketera':
    case 'notificaciones':
    case 'flujo-trabajo':
    case 'aprobaciones':
    case 'solicitud-personal':
    case 'bases':
    case 'documentos':
      return true;
    case 'bdd-activos-asesores':
      return role === 'asesor';
    default:
      return true;
  }
};

type AuthUser = {
  id: number;
  name: string | null;
  email: string | null;
  role?: string | null;
  token?: string | null;
  permissions?: string[] | null;
};

const PERSONAL_EDITOR_EMAILS = [
  'dgimenez@logisticaargentinasrl.com.ar',
  'msanchez@logisticaargentinasrl.com.ar',
  'morellfrancisco@gmail.com',
  'xmaldonado@logisticaargentinasrl.com.ar',
  'monica@logisticaargentinasrl.com.ar',
];

const normalizeEmail = (email: string | null | undefined): string | null => {
  const normalized = email?.trim().toLowerCase() ?? '';
  return normalized.length > 0 ? normalized : null;
};

const isPersonalEditor = (authUser: AuthUser | null | undefined): boolean => {
  // Permitir que cualquier usuario edite/gestione personal
  return true;
};

const buildActorHeaders = (authUser: AuthUser | null | undefined): Record<string, string> => {
  const email = normalizeEmail(authUser?.email);
  return email ? { 'X-Actor-Email': email } : {};
};

// --- Branding (logos configurables) ---
const DEFAULT_LOGO_SRC = `${process.env.PUBLIC_URL ?? ''}/logo-empresa.png`;
const BRAND_LOGO_KEY = 'branding.brandLogo';
const PROMO_LOGO_KEY = 'branding.promoLogo';

type BrandingContextValue = {
  brandLogoSrc: string | null;
  promoLogoSrc: string | null;
  setBrandLogo: (src: string | null) => void;
  setPromoLogo: (src: string | null) => void;
  resetBranding: () => void;
};

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

type ThemeMode = 'light' | 'dark';
type ThemeContextValue = {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
};

const THEME_STORAGE_KEY = 'app.theme';
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const resolveStoredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'light';
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  return 'light';
};

const safeReadStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [brandLogoSrc, setBrandLogoSrc] = useState<string | null>(() => {
    const stored = safeReadStorage(BRAND_LOGO_KEY);
    return stored !== null ? stored : DEFAULT_LOGO_SRC;
  });
  const [promoLogoSrc, setPromoLogoSrc] = useState<string | null>(() => {
    const stored = safeReadStorage(PROMO_LOGO_KEY);
    return stored !== null ? stored : DEFAULT_LOGO_SRC;
  });

  const persistLogo = useCallback((key: string, setter: (value: string | null) => void) => {
    return (value: string | null) => {
      const nextValue = value ?? DEFAULT_LOGO_SRC;
      try {
        if (value === null) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(key, value);
        }
      } catch {
        // Ignorar errores de almacenamiento (modo incógnito, etc).
      }
      setter(nextValue);
    };
  }, []);

  const setBrandLogo = useMemo(() => persistLogo(BRAND_LOGO_KEY, setBrandLogoSrc), [persistLogo]);
  const setPromoLogo = useMemo(() => persistLogo(PROMO_LOGO_KEY, setPromoLogoSrc), [persistLogo]);

  useEffect(() => {
    // Asegurar que el watermark del chat use el logo configurado
    if (promoLogoSrc) {
      document.documentElement.style.setProperty('--chat-watermark', `url(${promoLogoSrc})`);
    } else {
      document.documentElement.style.removeProperty('--chat-watermark');
    }
  }, [promoLogoSrc]);

  const resetBranding = useCallback(() => {
    setBrandLogo(null);
    setPromoLogo(null);
  }, [setBrandLogo, setPromoLogo]);

  const value = useMemo(
    () => ({
      brandLogoSrc,
      promoLogoSrc,
      setBrandLogo,
      setPromoLogo,
      resetBranding,
    }),
    [brandLogoSrc, promoLogoSrc, setBrandLogo, setPromoLogo, resetBranding]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
};

const useBranding = (): BrandingContextValue => {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    return {
      brandLogoSrc: DEFAULT_LOGO_SRC,
      promoLogoSrc: DEFAULT_LOGO_SRC,
      setBrandLogo: () => undefined,
      setPromoLogo: () => undefined,
      resetBranding: () => undefined,
    };
  }
  return ctx;
};

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => resolveStoredTheme());

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.setAttribute('data-theme', mode);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  const toggleTheme = useCallback(() => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const setTheme = useCallback((value: ThemeMode) => setMode(value), []);

  const value = useMemo(() => ({ mode, toggleTheme, setTheme }), [mode, toggleTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      mode: 'light',
      toggleTheme: () => undefined,
      setTheme: () => undefined,
    };
  }
  return ctx;
};

type TeamGroupMember = {
  id: number;
  userId?: number | null;
  name: string;
  email: string | null;
};

type TeamGroup = {
  id: number;
  name: string;
  color: string | null;
  members: TeamGroupMember[];
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
  matchSnippet?: string | null;
  matchTimestamp?: string | null;
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

type ChatToastPayload = {
  message: string;
  senderId: number | null;
  createdAt: string | null;
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

type GeneralInfoEntryApi = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  author_id?: number | null;
  author_name?: string | null;
  author_role?: string | null;
  image_data?: string | null;
  image_alt?: string | null;
};

const mapGeneralInfoApiEntry = (entry: GeneralInfoEntryApi): GeneralInfoEntry => ({
  id: entry.id,
  title: entry.title,
  body: entry.body,
  createdAt: entry.created_at,
  authorId: entry.author_id ?? null,
  authorName: entry.author_name ?? null,
  authorRole: entry.author_role ?? null,
  imageData: entry.image_data ?? null,
  imageAlt: entry.image_alt ?? null,
});

type EditableSucursal = {
  id: number | null;
  nombre: string;
  direccion: string;
  encargado_deposito?: string;
  key: string;
};

const resolveApiBaseUrl = (): string => {
  const remoteFallback = 'https://apibasepersonal.distriapp.com.ar';
  const hasWindow = typeof window !== 'undefined' && Boolean(window.location?.origin);
  const sameOriginFallback = hasWindow ? window.location.origin : remoteFallback;
  const hostname = hasWindow ? (window.location.hostname ?? '').toLowerCase() : '';
  const isDistriappProductionHost =
    hostname === 'distriapp.com.ar' || hostname.endsWith('.distriapp.com.ar');
  const raw = (process.env.REACT_APP_API_BASE ?? process.env.REACT_APP_API_BASE_URL ?? '').trim();
  const candidate = raw.length > 0
    ? raw
    : (isDistriappProductionHost ? remoteFallback : sameOriginFallback);

  try {
    const parsed = new URL(candidate, sameOriginFallback);
    const pathname = parsed.pathname.replace(/\/+$/, '');
    const looksLikeUiRoute =
      pathname.toLowerCase().startsWith('/aprobaciones') ||
      pathname.toLowerCase().startsWith('/solicitud-personal') ||
      /^\/\d+$/.test(pathname);
    const normalizedPath = looksLikeUiRoute
      ? ''
      : pathname.replace(/\/api$/i, '');

    return `${parsed.origin}${normalizedPath}`;
  } catch {
    const fallback = isDistriappProductionHost ? remoteFallback : sameOriginFallback;
    return fallback.replace(/\/+$/, '').replace(/\/api$/i, '');
  }
};

const resolveDistriappLegacyAdminUrl = (): string | null => {
  const raw = (process.env.REACT_APP_DISTRIAPP_LEGACY_ADMIN_URL ?? '').trim();
  const productionFallback = 'https://admin.distriapp.com.ar/';

  const base =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost';

  const isProductionHost =
    typeof window !== 'undefined' &&
    Boolean(window.location?.hostname?.includes('distriapp.com.ar'));

  const candidate = raw.length > 0 ? raw : (isProductionHost ? productionFallback : '');
  if (candidate.length === 0) {
    return null;
  }

  try {
    return new URL(candidate, base).toString();
  } catch {
    return null;
  }
};

const getEstadoBadgeClass = (estado?: string | null) => {
  switch ((estado ?? '').trim().toLowerCase()) {
    case 'baja':
      return 'estado-badge--baja';
    case 'activo':
      return 'estado-badge--activo';
    case 'pre activo':
    case 'preactivo':
    case 'pre-activo':
      return 'estado-badge--pre-activo';
    case 'suspendido':
      return 'estado-badge--suspendido';
    default:
      return 'estado-badge--default';
  }
};

const uniqueKey = () => Math.random().toString(36).slice(2);

const readAuthUserFromStorage = (): AuthUser | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw =
    window.localStorage.getItem(AUTH_STORAGE_KEY) ??
    window.sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

const readAuthTokenFromStorage = (): string | null => {
  const authUser = readAuthUserFromStorage();
  const token = authUser?.token ?? null;

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return null;
  }

  return token;
};

const installAuthFetchInterceptor = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const globalScope = window as Window & { __authFetchPatched?: boolean };
  if (globalScope.__authFetchPatched) {
    return;
  }

  const originalFetch = window.fetch.bind(window);
  globalScope.__authFetchPatched = true;

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const token = readAuthTokenFromStorage();
    const normalizedInit: RequestInit = { ...(init ?? {}) };
    const headers = new Headers(init?.headers ?? {});

    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    normalizedInit.headers = headers;

    if (!normalizedInit.credentials) {
      normalizedInit.credentials = 'same-origin';
    }

    let normalizedInput: RequestInfo | URL = input;
    try {
      const rawInputUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;
      const parsed = new URL(rawInputUrl, window.location.origin);
      const requestMethod = (normalizedInit.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

      if (
        ['PUT', 'PATCH', 'DELETE'].includes(requestMethod) &&
        parsed.origin === window.location.origin &&
        !parsed.pathname.startsWith('/api/')
      ) {
        const isApprovalsPath =
          parsed.pathname.startsWith('/aprobaciones') || parsed.pathname.startsWith('/solicitud-personal');
        if (isApprovalsPath) {
          const personaId = parsed.searchParams.get('personaId') ?? parsed.searchParams.get('personalId');
          if (personaId && /^\d+$/.test(personaId)) {
            parsed.pathname = `/api/personal/${personaId}`;
            parsed.search = '';
            normalizedInput = parsed.toString();
          } else {
            parsed.pathname = `/api${parsed.pathname}`;
            normalizedInput = parsed.toString();
          }
        }
      }
    } catch {
      // ignore malformed URL
    }

    return originalFetch(normalizedInput, normalizedInit);
  };
};

installAuthFetchInterceptor();

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

const GENERAL_INFO_STORAGE_KEY = 'generalInfo:entries';
const GENERAL_INFO_UPDATED_EVENT = 'general-info:updated';
const CHAT_LOG_STORAGE_KEY = 'dashboard-chat:log';
const CHAT_BADGE_STORAGE_KEY = 'dashboard-chat:badge';
const CHAT_BADGE_UPDATED_EVENT = 'dashboard-chat:badge-updated';
const CHAT_LAST_READ_STORAGE_KEY = 'dashboard-chat:last-read';
const CHAT_LAST_READ_UPDATED_EVENT = 'dashboard-chat:last-read-updated';
const TEAM_SHOUT_STORAGE_KEY = 'personal:teamShout';
const TEAM_SHOUT_UPDATED_EVENT = 'personal:teamShoutUpdated';
const PANEL_MESSAGE_MARKER = '<!--panel-message-->';
const PANEL_MESSAGE_PREFIX = '[PANEL] ';

const buildPersonalFiltersStorageKey = (userId: number | null | undefined): string | null => {
  if (userId == null) {
    return null;
  }
  return `personal:filters:${userId}`;
};

type StoredPersonalFilters = {
  cliente?: string;
  sucursal?: string;
  fechaAltaPreset?: string;
  fechaAltaFrom?: string;
  fechaAltaTo?: string;
  patente?: string;
  legajo?: string;
  pago?: string;
};

const readStoredPersonalFilters = (storageKey: string | null): StoredPersonalFilters => {
  if (!storageKey || typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return {
      cliente: typeof parsed.cliente === 'string' ? parsed.cliente : '',
      sucursal: typeof parsed.sucursal === 'string' ? parsed.sucursal : '',
      fechaAltaPreset: typeof parsed.fechaAltaPreset === 'string' ? parsed.fechaAltaPreset : '',
      fechaAltaFrom: typeof parsed.fechaAltaFrom === 'string' ? parsed.fechaAltaFrom : '',
      fechaAltaTo: typeof parsed.fechaAltaTo === 'string' ? parsed.fechaAltaTo : '',
      patente: typeof parsed.patente === 'string' ? parsed.patente : '',
      legajo: typeof parsed.legajo === 'string' ? parsed.legajo : '',
      pago: typeof parsed.pago === 'string' ? parsed.pago : '',
    };
  } catch {
    return {};
  }
};

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

const readTeamShoutMessage = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    return window.localStorage.getItem(TEAM_SHOUT_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatTeamShout = (message: string): string => {
  // Soporte básico: saltos de línea, **negrita**, {color:#00aaff|texto}, {size:32px|texto}
  let html = escapeHtml(message);

  html = html.replace(/\{size:(\d{1,3})(px|em|rem)?\|([^}]*)\}/g, (match, size, unit, text) => {
    const numericSize = Number(size);
    const safeUnit = unit || 'px';
    if (!Number.isFinite(numericSize) || numericSize <= 0 || numericSize > 120) {
      return match;
    }
    return `<span style="font-size: ${numericSize}${safeUnit}">${text}</span>`;
  });

  html = html.replace(/\{color:([#a-zA-Z0-9]+)\|([^}]*)\}/g, (match, color, text) => {
    const colorValid = /^#[0-9a-fA-F]{3,8}$/.test(color) || /^[a-zA-Z]+$/.test(color);
    if (!colorValid) {
      return match;
    }
    return `<span style="color: ${color}">${text}</span>`;
  });

  html = html.replace(/\*\*(.+?)\*\*/g, (_match, text) => `<strong>${text}</strong>`);

  html = html.replace(/\n/g, '<br />');
  return html;
};

const convertHtmlToShoutSyntax = (html: string): string => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html.replace(PANEL_MESSAGE_MARKER, ''), 'text/html');

    const mapFontSize = (value: string | null) => {
      if (!value) {
        return null;
      }
      const num = Number(value);
      if (Number.isFinite(num) && num >= 1 && num <= 7) {
        const map: Record<number, number> = {
          1: 8,
          2: 10,
          3: 12,
          4: 14,
          5: 18,
          6: 24,
          7: 32,
        };
        return `${map[num] ?? 12}px`;
      }
      if (/^\d+px$/i.test(value) || /^\d+(\.\d+)?(em|rem)$/i.test(value)) {
        return value.toLowerCase();
      }
      return null;
    };

    const traverse = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return (node.textContent ?? '');
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const childrenText = Array.from(el.childNodes).map(traverse).join('');

      if (tag === 'br') {
        return '\n';
      }

      if (tag === 'p') {
        return `${childrenText}\n`;
      }

      const style = el.getAttribute('style') ?? '';
      const colorMatchRaw =
        style.match(/color:\s*([^;]+);?/i) ||
        (el.hasAttribute('color') ? [null, el.getAttribute('color')] : null);
      const sizeMatchRaw =
      style.match(/font-size:\s*([\d.]+)(px|em|rem)?/i) ||
      (el.hasAttribute('size') ? [null, mapFontSize(el.getAttribute('size')), ''] : null);
    const colorValue = colorMatchRaw?.[1]?.trim() ?? '';
    const sizeValue = sizeMatchRaw?.[1]?.trim() ?? '';
    const sizeUnit = sizeMatchRaw?.[2]?.trim() ?? '';

      if (tag === 'strong' || tag === 'b') {
        return `**${childrenText}**`;
      }

      if (colorValue || sizeValue) {
        let text = childrenText;
        if (colorValue) {
          text = `{color:${colorValue}|${text}}`;
        }
        if (sizeValue) {
          const token = sizeUnit ? `${sizeValue}${sizeUnit}` : sizeValue;
          text = `{size:${token}|${text}}`;
        }
        return text;
      }

      return childrenText;
    };

    const body = doc.body;
    const result = Array.from(body.childNodes).map(traverse).join('');
    return result.trim();
  } catch {
    return '';
  }
};

const writeTeamShoutMessage = (message: string): void => {
  if (typeof window === 'undefined') {
    return;
  }
  const trimmed = message.trim();
  if (!trimmed) {
    window.localStorage.removeItem(TEAM_SHOUT_STORAGE_KEY);
  } else {
    window.localStorage.setItem(TEAM_SHOUT_STORAGE_KEY, trimmed);
  }
  window.dispatchEvent(new Event(TEAM_SHOUT_UPDATED_EVENT));
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

const normalizeServerMessage = (message: {
  id?: number | string;
  senderId?: number | null;
  recipientId?: number | null;
  text?: string | null;
  imageData?: string | null;
  imageName?: string | null;
  createdAt?: string | null;
}): StoredChatMessage => ({
  id: message.id != null ? String(message.id) : uniqueKey(),
  senderId: message.senderId ?? null,
  recipientId: message.recipientId ?? null,
  text: message.text ?? '',
  timestamp: message.createdAt ?? new Date().toISOString(),
  imageData: message.imageData ?? null,
  imageName: message.imageName ?? null,
});

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

const htmlToPlainText = (html: string): string => {
  if (!html) {
    return '';
  }
  return html
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

const numberFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatNumber = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (Number.isNaN(numeric)) {
    return '—';
  }
  return numberFormatter.format(numeric);
};

const parseDateTimeValue = (value: string): Date | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const dayFirstMatch = trimmed.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (dayFirstMatch) {
    const day = Number(dayFirstMatch[1]);
    const month = Number(dayFirstMatch[2]);
    const yearRaw = Number(dayFirstMatch[3]);
    const hour = Number(dayFirstMatch[4] ?? '0');
    const minute = Number(dayFirstMatch[5] ?? '0');
    const second = Number(dayFirstMatch[6] ?? '0');
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const parsed = new Date(year, month - 1, day, hour, minute, second);
    if (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day &&
      parsed.getHours() === hour &&
      parsed.getMinutes() === minute &&
      parsed.getSeconds() === second
    ) {
      return parsed;
    }
  }

  const normalized = trimmed.replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return '—';
  }
  const parsed = parseDateTimeValue(value);
  if (!parsed) {
    return value;
  }
  return parsed.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }) + ' ' + parsed.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatDateOnly = (value: string | null | undefined): string => {
  if (!value) {
    return '—';
  }
  const parsed = parseDateTimeValue(value);
  if (!parsed) {
    return value;
  }
  return parsed.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [requireTotp, setRequireTotp] = useState(false);
  const { brandLogoSrc, promoLogoSrc } = useBranding();

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
          totpCode: totpCode.trim() || undefined,
        }),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = await response.json();
          if (typeof payload?.message === 'string') {
            message = payload.message;
          }
          if (payload?.requireTotp) {
            setRequireTotp(true);
            message = 'Ingresa el código de tu app autenticadora.';
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
          permissions?: string[] | null;
          token?: string | null;
          totpEnabled?: boolean;
        };
      };

      const storage = rememberMe ? window.localStorage : window.sessionStorage;
      const otherStorage = rememberMe ? window.sessionStorage : window.localStorage;
      const authPayload: AuthUser = {
        id: payload.data.id,
        name: payload.data.name ?? null,
        email: payload.data.email ?? null,
        role: payload.data.role ?? null,
        permissions: payload.data.permissions ?? null,
        token: payload.data.token ?? null,
      };
      storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authPayload));
      otherStorage.removeItem(AUTH_STORAGE_KEY);
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
          {brandLogoSrc ? (
            <img src={brandLogoSrc} alt="Logo de la empresa" className="brand-logo" />
          ) : (
            <div className="brand-placeholder">Tu marca</div>
          )}
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

            <label className="field password-field">
              <span className="field-label">Contraseña</span>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
                required
                disabled={loading}
              />
              <button
                type="button"
            className="password-toggle"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            disabled={loading}
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </label>

            {requireTotp ? (
              <label className="field">
                <span className="field-label">Código 2FA</span>
                <input
                  type="text"
                  name="totpCode"
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value)}
                  placeholder="Ingresa el código de 6 dígitos"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  disabled={loading}
                />
              </label>
            ) : null}

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
          {promoLogoSrc ? (
            <img src={promoLogoSrc} alt="Logo de la empresa" className="promo-logo" />
          ) : (
            <div className="brand-placeholder">Sin logo</div>
          )}
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
  layoutVariant?: 'default' | 'panel';
  monitorView?: boolean;
}> = ({ title, subtitle, headerContent, children, layoutVariant = 'default', monitorView = false }) => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => readAuthUserFromStorage());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatBadgeCount, setChatBadgeCount] = useState(() => readStoredChatBadge(authUser?.id ?? null));
  const [chatToast, setChatToast] = useState<ChatToastPayload | null>(null);
  const [notificationsVersion, setNotificationsVersion] = useState(0);
  const [notificationToast, setNotificationToast] = useState<{ id: number; message: string; detail?: string | null } | null>(null);
  const notificationToastTimeoutRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastToastIdRef = useRef<number | null>(null);
  const { brandLogoSrc } = useBranding();
  const userRole = useMemo(() => getUserRole(authUser), [authUser]);
  const distriappLegacyAdminUrl = useMemo(() => resolveDistriappLegacyAdminUrl(), []);
  const unreadInitializedRef = useRef(false);
  const previousUnreadCountRef = useRef(0);
  const previousLatestNotificationIdRef = useRef<number | null>(null);
  const previousLatestNotificationTimestampRef = useRef<number | null>(null);
  const [celebration, setCelebration] = useState<{ title: string; message: string; detail?: string | null; notificationId?: number } | null>(null);
  const [fireworks, setFireworks] = useState<Array<{ id: number; left: number; top: number; delay: number; duration: number; color: string }>>([]);
  const celebrationTimeoutRef = useRef<number | null>(null);
  const chatToastTimeoutRef = useRef<number | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [attendanceRecord, setAttendanceRecord] = useState<AttendanceRecord | null>(() => {
    const storedUser = readAuthUserFromStorage();
    return readAttendanceRecordFromStorage(deriveAttendanceUserKey(storedUser));
  });
  const currentUserKey = useMemo(() => deriveAttendanceUserKey(authUser), [authUser]);
  const lastIncomingChatMessageIdRef = useRef<number | null>(null);
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [personalSubmenuOpen, setPersonalSubmenuOpen] = useState(false);
  const [reclamosSubmenuOpen, setReclamosSubmenuOpen] = useState(false);
  const [liquidacionesSubmenuOpen, setLiquidacionesSubmenuOpen] = useState(false);
  const [facturacionSubmenuOpen, setFacturacionSubmenuOpen] = useState(false);
  const isPersonalListRoute = location.pathname === '/personal';
  const isReclamosRoute = location.pathname.startsWith('/reclamos');
  const isReclamosListRoute = location.pathname === '/reclamos';
  const isReclamosNuevoRoute = location.pathname === '/reclamos/nuevo';
  const reclamosTipoParam = useMemo(() => {
    if (!isReclamosRoute) {
      return '';
    }
    const params = new URLSearchParams(location.search);
    return (params.get('tipo') ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_\s]+/g, '-');
  }, [isReclamosRoute, location.search]);
  const isReclamosAdelantoListRoute =
    isReclamosListRoute &&
    (reclamosTipoParam === 'adelanto' || reclamosTipoParam === 'reclamos-y-adelantos');
  const isReclamosAdelantoNuevoRoute =
    isReclamosNuevoRoute &&
    (reclamosTipoParam === 'adelanto' || reclamosTipoParam === 'reclamos-y-adelantos');
  const isLiquidacionesGroupRoute =
    location.pathname.startsWith('/liquidaciones') ||
    location.pathname.startsWith('/pagos') ||
    location.pathname.startsWith('/combustible');
  const isLiquidacionesExtractosRoute = location.pathname.startsWith('/liquidaciones/extractos');
  const isRecibosRoute = location.pathname.startsWith('/liquidaciones/recibos');
  const isLiquidacionesClienteRoute = location.pathname.startsWith('/liquidaciones/cliente');
  const isLiquidacionesRoute =
    (location.pathname === '/liquidaciones' || /^\/liquidaciones\/\d+$/.test(location.pathname)) &&
    !isLiquidacionesExtractosRoute &&
    !isRecibosRoute &&
    !isLiquidacionesClienteRoute;
  const isCombustibleRoute = location.pathname.startsWith('/combustible');
  const isPagosRoute = location.pathname.startsWith('/pagos');
  const isFacturacionRoute = location.pathname.startsWith('/facturacion');
  const isFacturacionListRoute = location.pathname === '/facturacion/facturas';
  const isFacturacionNuevaRoute = location.pathname === '/facturacion/nueva';
  const isFacturacionClientesRoute = location.pathname.startsWith('/facturacion/clientes');
  const isFacturacionConfigRoute = location.pathname === '/facturacion/configuracion-arca';
  const personalEstadoParam = useMemo(() => {
    if (!isPersonalListRoute) {
      return 'todos';
    }
    const params = new URLSearchParams(location.search);
    const raw = (params.get('estado') ?? 'todos').toLowerCase();
    if (raw === 'sin estado') {
      return 'sin_estado';
    }
    if (raw === 'pre activo' || raw === 'preactivo' || raw === 'pre-activo') {
      return 'pre_activo';
    }
    if (raw === 'no citado' || raw === 'no sitado') {
      return 'no_citado';
    }
    return raw;
  }, [isPersonalListRoute, location.search]);
  const canAccessLiquidacionesGroup = useMemo(
    () =>
      canAccessSection(userRole, 'liquidaciones', authUser?.permissions) ||
      canAccessSection(userRole, 'pagos', authUser?.permissions) ||
      canAccessSection(userRole, 'combustible', authUser?.permissions),
    [userRole, authUser?.permissions]
  );
  const canAccessLiquidacionesExtractos = useMemo(
    () =>
      canAccessSection(userRole, 'liquidaciones', authUser?.permissions) ||
      canAccessSection(userRole, 'combustible', authUser?.permissions),
    [userRole, authUser?.permissions]
  );
  const hasDistriappAccess = canAccessSection(userRole, 'distriapp', authUser?.permissions);
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
    if (location.pathname !== '/personal') {
      setPersonalSubmenuOpen(false);
    }
  }, [location.pathname]);
  useEffect(() => {
    if (!isReclamosRoute) {
      setReclamosSubmenuOpen(false);
    }
  }, [isReclamosRoute]);
  useEffect(() => {
    if (!isLiquidacionesGroupRoute) {
      setLiquidacionesSubmenuOpen(false);
    }
  }, [isLiquidacionesGroupRoute]);
  useEffect(() => {
    if (!isFacturacionRoute) {
      setFacturacionSubmenuOpen(false);
    }
  }, [isFacturacionRoute]);
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
  const currentUserId = currentActorId;

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
  const formattedDate = useMemo(
    () =>
      currentTime.toLocaleDateString('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    [currentTime]
  );

  const attendanceModeMessage = 'Marcación manual deshabilitada. Usar importación C26/Excel.';

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

  const avatarInitials = useMemo(
    () => computeInitials(authUser?.name ?? authUser?.email),
    [authUser?.name, authUser?.email]
  );
  const { mode: themeMode, toggleTheme } = useTheme();

  const dismissChatToast = useCallback(() => {
    if (chatToastTimeoutRef.current) {
      window.clearTimeout(chatToastTimeoutRef.current);
      chatToastTimeoutRef.current = null;
    }
    setChatToast(null);
  }, []);

  const openChatFromToast = useCallback(() => {
    dismissChatToast();
    navigate('/chat');
  }, [dismissChatToast, navigate]);

  const fetchRecentChatMessages = useCallback(async () => {
    if (currentUserId == null) {
      return;
    }

    const url = new URL(`${apiBaseUrl}/api/chat/messages`);
    url.searchParams.set('userId', currentUserId.toString());
    url.searchParams.set('limit', '5');
    const isInitialFetch = lastIncomingChatMessageIdRef.current == null;
    const afterId = lastIncomingChatMessageIdRef.current ?? 0;
    if (afterId > 0) {
      url.searchParams.set('afterId', afterId.toString());
    }

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`No se pudieron recuperar los mensajes (${response.status})`);
      }
      const payload = (await response.json()) as { data?: Array<Record<string, unknown>> };
      const entries = Array.isArray(payload?.data) ? payload.data.map(normalizeServerMessage) : [];
      const incomingMessages = entries.filter(
        (entry) => Number(entry.id) > (lastIncomingChatMessageIdRef.current ?? 0)
      );
      if (incomingMessages.length === 0) {
        return;
      }
      lastIncomingChatMessageIdRef.current = incomingMessages.reduce(
        (max, entry) => Math.max(max, Number(entry.id)),
        lastIncomingChatMessageIdRef.current ?? 0
      );
      incomingMessages.forEach((entry) => {
        appendStoredChatMessage(entry, currentUserId);
      });
      const onlyFromOthers = incomingMessages.filter(
        (entry) => entry.senderId != null && entry.senderId !== currentUserId
      );
      if (!isInitialFetch && onlyFromOthers.length > 0) {
        const latest = onlyFromOthers[onlyFromOthers.length - 1];
        setChatToast({
          message: latest.text?.trim().slice(0, 80) ?? 'Nuevo mensaje',
          senderId: latest.senderId,
          createdAt: latest.timestamp,
        });
      }
    } catch (error) {
      console.error('fetchRecentChatMessages failed', error);
    }
  }, [apiBaseUrl, currentUserId]);

  useEffect(() => {
    if (chatToast == null) {
      return undefined;
    }
    if (chatToastTimeoutRef.current) {
      window.clearTimeout(chatToastTimeoutRef.current);
    }
    chatToastTimeoutRef.current = window.setTimeout(() => {
      chatToastTimeoutRef.current = null;
      setChatToast(null);
    }, 6000);
    return () => {
      if (chatToastTimeoutRef.current) {
        window.clearTimeout(chatToastTimeoutRef.current);
        chatToastTimeoutRef.current = null;
      }
    };
  }, [chatToast]);

  useEffect(() => {
    if (currentUserId == null) {
      lastIncomingChatMessageIdRef.current = null;
      return undefined;
    }
    fetchRecentChatMessages();
    const interval = window.setInterval(() => {
      fetchRecentChatMessages();
    }, 8000);
    return () => window.clearInterval(interval);
  }, [currentUserId, fetchRecentChatMessages]);

  useEffect(() => {
    lastIncomingChatMessageIdRef.current = null;
  }, [currentUserId]);

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
    if (!authUser?.id || (authUser?.role && authUser.permissions !== undefined)) {
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
          data?: {
            role?: string | null;
            name?: string | null;
            email?: string | null;
            permissions?: string[] | null;
          };
        };
        if (payload?.data?.role || payload?.data?.permissions) {
          const updated: AuthUser = {
            id: authUser.id,
            name: payload.data.name ?? authUser.name ?? null,
            email: payload.data.email ?? authUser.email ?? null,
            role: payload.data.role,
            permissions: payload.data.permissions ?? authUser.permissions ?? null,
            token: authUser.token ?? null,
          };
          setAuthUser(updated);
          try {
            const serialized = JSON.stringify(updated);
            const hasLocal = Boolean(window.localStorage.getItem(AUTH_STORAGE_KEY));
            const hasSession = Boolean(window.sessionStorage.getItem(AUTH_STORAGE_KEY));
            if (hasLocal) {
              window.localStorage.setItem(AUTH_STORAGE_KEY, serialized);
            }
            if (hasSession || (!hasLocal && !hasSession)) {
              window.sessionStorage.setItem(AUTH_STORAGE_KEY, serialized);
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
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }
    removeAttendanceRecordFromStorage(currentUserKey);
    setAttendanceRecord(null);
    setAuthUser(null);
    window.dispatchEvent(new CustomEvent('attendance:updated', { detail: null }));
    window.dispatchEvent(new CustomEvent('notifications:updated'));
    window.dispatchEvent(new CustomEvent('auth:updated'));
    window.location.href = '/';
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

      <div
        className={`dashboard-shell${isSidebarOpen ? ' is-sidebar-open' : ''}${
          layoutVariant !== 'default' ? ` dashboard-shell--${layoutVariant}` : ''
        }${monitorView ? ' dashboard-shell--monitor' : ''}`}
      >
        <aside className="dashboard-sidebar">
          <button
            type="button"
            className="sidebar-close"
            aria-label="Cerrar menú"
            onClick={closeSidebar}
          >
            ×
          </button>
          <NavLink to="/dashboard" className="sidebar-logo" onClick={closeSidebar}>
            {brandLogoSrc ? (
              <img src={brandLogoSrc} alt="Logo de la empresa" className="brand-logo" />
            ) : (
              <div className="brand-placeholder">Tu marca</div>
            )}
          </NavLink>
          {hasDistriappAccess ? (
            distriappLegacyAdminUrl ? (
              <a
                href={distriappLegacyAdminUrl}
                className="sidebar-distriapp-link"
                onClick={closeSidebar}
                aria-label="Abrir panel de Distriapp"
                title="Abrir panel de Distriapp"
              >
                <img src="/distriapp-logo-v6.png" alt="Distriapp" className="sidebar-distriapp-logo" />
              </a>
            ) : (
              <NavLink
                to="/distriapp"
                className="sidebar-distriapp-link"
                onClick={closeSidebar}
                aria-label="Abrir panel de Distriapp"
                title="Abrir panel de Distriapp"
              >
                <img src="/distriapp-logo-v6.png" alt="Distriapp" className="sidebar-distriapp-logo" />
              </NavLink>
            )
          ) : null}

        <NavLink
          to="/informacion-general"
          className={({ isActive }) => `sidebar-info-card${isActive ? ' is-active' : ''}`}
        >
          <span className="sidebar-info-card__title">Información general</span>
        </NavLink>
        {canAccessSection(userRole, 'panel-general', authUser?.permissions) ? (
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `sidebar-info-card${isActive ? ' is-active' : ''}`}
          >
            <span className="sidebar-info-card__title">Panel general</span>
          </NavLink>
        ) : null}
        {canAccessSection(userRole, 'resumen', authUser?.permissions) ? (
          <NavLink
            to="/resumen"
            className={({ isActive }) => `sidebar-info-card${isActive ? ' is-active' : ''}`}
          >
            <span className="sidebar-info-card__title">Resumen</span>
          </NavLink>
        ) : null}

        <nav className="sidebar-nav" onClick={closeSidebar}>
          <span className="sidebar-title">Acciones</span>
          <NavLink to="/llamadas" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
            Llamadas WebRTC
          </NavLink>
          {canAccessSection(userRole, 'clientes', authUser?.permissions) ? (
            <NavLink to="/clientes" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
              Gestión de clientes
            </NavLink>
          ) : null}
          {canAccessSection(userRole, 'unidades', authUser?.permissions) ? (
            <NavLink to="/unidades" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
              Gestión de unidades
            </NavLink>
          ) : null}
          {canAccessSection(userRole, 'usuarios', authUser?.permissions) ? (
            <NavLink to="/usuarios" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
              Gestión de usuarios
            </NavLink>
          ) : null}
          {canAccessSection(userRole, 'rrhh', authUser?.permissions) ? (
            <NavLink to="/rrhh" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
              RRHH
            </NavLink>
          ) : null}
          {canAccessSection(userRole, 'personal', authUser?.permissions) ? (
            <>
              <NavLink
                to="/personal"
                className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}
                onClick={(event) => {
                  if (location.pathname === '/personal') {
                    event.preventDefault();
                    setPersonalSubmenuOpen((prev) => !prev);
                  } else {
                    setPersonalSubmenuOpen(true);
                  }
                }}
              >
                Proveedores
              </NavLink>
              {isPersonalListRoute && personalSubmenuOpen ? (
                <div className="sidebar-submenu">
                  {[
                    { value: 'todos', label: 'Todos' },
                    { value: 'activo', label: 'Activos' },
                    { value: 'pre_activo', label: 'Pre activos' },
                    { value: 'baja', label: 'Baja' },
                    { value: 'suspendido', label: 'Suspendido' },
                    { value: 'cancelado', label: 'Cancelado' },
                    { value: 'no_citado', label: 'No citado' },
                    { value: 'sin_estado', label: 'Sin estado' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`sidebar-sublink${personalEstadoParam === item.value ? ' is-active' : ''}`}
                      onClick={() => {
                        const params = new URLSearchParams(location.search);
                        params.set('estado', item.value);
                        navigate({ pathname: '/personal', search: params.toString() });
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
          {canAccessSection(userRole, 'reclamos', authUser?.permissions) ? (
            <>
              <button
                type="button"
                className={`sidebar-link${isReclamosRoute ? ' is-active' : ''}`}
                onClick={() => {
                  setReclamosSubmenuOpen((prev) => !prev);
                  if (!isReclamosRoute) {
                    navigate('/reclamos');
                  }
                }}
              >
                Reclamos
              </button>
              {reclamosSubmenuOpen ? (
                <div className="sidebar-submenu">
                  <button
                    type="button"
                    className={`sidebar-sublink${isReclamosListRoute ? ' is-active' : ''}`}
                    onClick={() => navigate('/reclamos')}
                  >
                    Listado reclamos
                  </button>
                  <button
                    type="button"
                    className={`sidebar-sublink${isReclamosAdelantoListRoute ? ' is-active' : ''}`}
                    onClick={() => navigate('/reclamos?tipo=adelanto')}
                  >
                    Reclamos de adelanto
                  </button>
                  <button
                    type="button"
                    className={`sidebar-sublink${isReclamosAdelantoNuevoRoute ? ' is-active' : ''}`}
                    onClick={() => navigate('/reclamos/nuevo?tipo=adelanto')}
                  >
                    Nuevo reclamo de adelanto
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
          {canAccessSection(userRole, 'ticketera', authUser?.permissions) ? (
            <NavLink to="/ticketera" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
              Ticketera
            </NavLink>
          ) : null}
          {canAccessSection(userRole, 'notificaciones', authUser?.permissions) ? (
            <NavLink to="/notificaciones" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
              Notificaciones
            </NavLink>
          ) : null}
          {canAccessSection(userRole, 'control-horario', authUser?.permissions) ? (
            <NavLink to="/control-horario" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
              Control horario
            </NavLink>
          ) : null}
          {canAccessSection(userRole, 'auditoria', authUser?.permissions) ? (
            <NavLink to="/auditoria" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
              Auditoría
            </NavLink>
          ) : null}
          {canAccessSection(userRole, 'flujo-trabajo', authUser?.permissions) ? (
            <NavLink to="/flujo-trabajo" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
              Flujo de trabajo
            </NavLink>
          ) : null}
          {canAccessSection(userRole, 'aprobaciones', authUser?.permissions) ? (
            <NavLink to="/aprobaciones" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
              Aprobaciones/solicitudes
            </NavLink>
          ) : null}
          {canAccessLiquidacionesGroup ? (
            <>
              <button
                type="button"
                className={`sidebar-link${isLiquidacionesGroupRoute ? ' is-active' : ''}`}
                onClick={() => {
                  setLiquidacionesSubmenuOpen((prev) => !prev);
                  if (!isLiquidacionesGroupRoute) {
                    navigate('/liquidaciones');
                  }
                }}
              >
                Liquidaciones/Pagos
              </button>
              {liquidacionesSubmenuOpen ? (
                <div className="sidebar-submenu">
                  {canAccessSection(userRole, 'liquidaciones', authUser?.permissions) ? (
                    <button
                      type="button"
                      className={`sidebar-sublink${isLiquidacionesRoute ? ' is-active' : ''}`}
                      onClick={() => navigate('/liquidaciones')}
                    >
                      Liquidaciones
                    </button>
                  ) : null}
                  {canAccessSection(userRole, 'liquidaciones', authUser?.permissions) ? (
                    <button
                      type="button"
                      className={`sidebar-sublink${isRecibosRoute ? ' is-active' : ''}`}
                      onClick={() => navigate('/liquidaciones/recibos')}
                    >
                      Recibos
                    </button>
                  ) : null}
                  {canAccessSection(userRole, 'liquidaciones', authUser?.permissions) ? (
                    <button
                      type="button"
                      className={`sidebar-sublink${isLiquidacionesClienteRoute ? ' is-active' : ''}`}
                      onClick={() => navigate('/liquidaciones/cliente')}
                    >
                      Cliente
                    </button>
                  ) : null}
                  {canAccessSection(userRole, 'pagos', authUser?.permissions) ? (
                    <button
                      type="button"
                      className={`sidebar-sublink${isPagosRoute ? ' is-active' : ''}`}
                      onClick={() => navigate('/pagos')}
                    >
                      Pagos
                    </button>
                  ) : null}
                  {canAccessSection(userRole, 'combustible', authUser?.permissions) ? (
                    <button
                      type="button"
                      className={`sidebar-sublink${isCombustibleRoute ? ' is-active' : ''}`}
                      onClick={() => navigate('/combustible')}
                    >
                      Combustible
                    </button>
                  ) : null}
                  {canAccessLiquidacionesExtractos ? (
                    <button
                      type="button"
                      className={`sidebar-sublink${isLiquidacionesExtractosRoute ? ' is-active' : ''}`}
                      onClick={() => navigate('/liquidaciones/extractos')}
                    >
                      Extractos BI/ERP
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
          {canAccessSection(userRole, 'facturacion', authUser?.permissions) ? (
            <>
              <button
                type="button"
                className={`sidebar-link${isFacturacionRoute ? ' is-active' : ''}`}
                onClick={() => {
                  setFacturacionSubmenuOpen((prev) => !prev);
                  if (!isFacturacionRoute) {
                    navigate('/facturacion/facturas');
                  }
                }}
              >
                Facturación
              </button>
              {facturacionSubmenuOpen ? (
                <div className="sidebar-submenu">
                  <button
                    type="button"
                    className={`sidebar-sublink${isFacturacionListRoute ? ' is-active' : ''}`}
                    onClick={() => navigate('/facturacion/facturas')}
                  >
                    Listado
                  </button>
                  <button
                    type="button"
                    className={`sidebar-sublink${isFacturacionNuevaRoute ? ' is-active' : ''}`}
                    onClick={() => navigate('/facturacion/nueva')}
                  >
                    Nueva factura
                  </button>
                  <button
                    type="button"
                    className={`sidebar-sublink${isFacturacionClientesRoute ? ' is-active' : ''}`}
                    onClick={() => navigate('/facturacion/clientes')}
                  >
                    Clientes
                  </button>
                  <button
                    type="button"
                    className={`sidebar-sublink${isFacturacionConfigRoute ? ' is-active' : ''}`}
                    onClick={() => navigate('/facturacion/configuracion-arca')}
                  >
                    Configuración ARCA
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
          {canAccessSection(userRole, 'solicitud-personal', authUser?.permissions) ? (
            <NavLink
              to="/solicitud-personal"
              className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}
            >
              Solicitud personal
            </NavLink>
          ) : null}
          {canAccessSection(userRole, 'tarifas', authUser?.permissions) ? (
            <NavLink to="/tarifas" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
              Tarifas
            </NavLink>
          ) : null}
          {canAccessSection(userRole, 'bases', authUser?.permissions) ? (
            <NavLink
              to="/bases-distribucion"
              className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}
            >
              Bases de Distribución
            </NavLink>
          ) : null}
          {canAccessSection(userRole, 'bdd-activos-asesores', authUser?.permissions) ? (
            <NavLink
              to="/bdd-activos-asesores-comerciales"
              className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}
            >
              BDD Activos x Asesores Comerciales
            </NavLink>
          ) : null}

          <span className="sidebar-title">Sistema</span>
          {canAccessSection(userRole, 'documentos', authUser?.permissions) ? (
            <NavLink to="/documentos" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
              Documentos
            </NavLink>
          ) : null}
          {canAccessSection(userRole, 'configuracion', authUser?.permissions) ? (
            <NavLink to="/configuracion" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
              Configuración
            </NavLink>
          ) : null}
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
                <div className="time-tracker__stamp">
                  <span className="time-tracker__clock">{formattedClock}</span>
                  <small className="time-tracker__date">{formattedDate}</small>
                </div>
                <small className="time-tracker__last">{attendanceModeMessage}</small>
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
              {chatToast ? (
                <div className="chat-toast" role="status" aria-live="polite">
                  <div className="chat-toast__content">
                    <strong>Nuevo mensaje</strong>
                    <p>{chatToast.message}</p>
                    {chatToast.senderId ? (
                      <small className="chat-toast__detail">Usuario #{chatToast.senderId}</small>
                    ) : null}
                  </div>
                  <div className="chat-toast__actions">
                    <button type="button" onClick={openChatFromToast}>
                      Abrir chat
                    </button>
                    <button type="button" className="notification-toast__close" onClick={dismissChatToast} aria-label="Cerrar">
                      ×
                    </button>
                  </div>
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
              className="topbar-button theme-toggle"
              onClick={toggleTheme}
              aria-label="Cambiar tema"
            >
              {themeMode === 'dark' ? '☀️ Claro' : '🌙 Oscuro'}
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
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
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

  const fetchGeneralInfoEntriesFromServer = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/general-info/posts`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`No se pudieron cargar las publicaciones (${response.status})`);
      }
      const payload = (await response.json()) as { data?: GeneralInfoEntryApi[] };
      const remoteEntries = Array.isArray(payload?.data)
        ? payload.data.map(mapGeneralInfoApiEntry)
        : [];
      setEntries(remoteEntries);
      persistGeneralInfoEntriesToStorage(remoteEntries);
    } catch (error) {
      console.error('fetchGeneralInfoEntriesFromServer failed', error);
    }
  }, [apiBaseUrl]);

  const userRole = useMemo(() => getUserRole(authUser), [authUser]);
  const canEditGeneralInfo = useMemo(() => isElevatedRole(userRole), [userRole]);
  const isAdmin = canEditGeneralInfo;

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

  useEffect(() => {
    void fetchGeneralInfoEntriesFromServer();
  }, [fetchGeneralInfoEntriesFromServer]);

  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [entries]
  );

  const helperText = canEditGeneralInfo
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

  const handlePublish = async (event: React.FormEvent<HTMLFormElement>) => {
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
    const authorName =
      authUser?.name && authUser.name.trim().length > 0
        ? authUser.name.trim()
        : authUser?.email ?? 'Administrador';
    const authorRole = authUser?.role ?? 'Administrador';

    const newEntry: GeneralInfoEntry = {
      id: uniqueKey(),
      title: trimmedTitle,
      body: normalizedBody,
      createdAt: new Date().toISOString(),
      authorId: authUser?.id ?? null,
      authorName,
      authorRole,
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
    setFormSuccess(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/general-info/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: trimmedTitle,
          body: normalizedBody,
          authorId: authUser?.id ?? null,
          authorName,
          authorRole,
          imageData,
          imageAlt: imageName ?? trimmedTitle,
        }),
      });

      if (!response.ok) {
        throw new Error(`No se pudo subir la publicación (${response.status}).`);
      }

      await fetchGeneralInfoEntriesFromServer();
      setFormSuccess('Publicación creada correctamente.');
    } catch (error) {
      console.error('handlePublish failed', error);
      setFormError('No pudimos sincronizar la publicación con el servidor. Se guardó localmente.');
      setFormSuccess(null);
    }
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

  const handleSendToPanel = async () => {
  if (!isAdmin) {
    setFormError('Solo los administradores pueden mostrar mensajes en el panel.');
    setFormSuccess(null);
    return;
    }

    const trimmedTitle = title.trim();
    const editorHtml = ensureHtmlContent(editorRef.current?.innerHTML ?? body);
    const editorText =
      editorRef.current?.innerText?.replace(/\u200B/g, '').trim() ??
      editorHtml.replace(/<[^>]*>/g, '').trim();

    if (!trimmedTitle || !editorText) {
      setFormError('Completá el título y la descripción para mostrar en el panel.');
      setFormSuccess(null);
      return;
  }

    const prefixedTitle = trimmedTitle.startsWith(PANEL_MESSAGE_PREFIX)
      ? trimmedTitle
      : `${PANEL_MESSAGE_PREFIX}${trimmedTitle}`;
    const normalizedBody = `${PANEL_MESSAGE_MARKER}${ensureHtmlContent(editorHtml)}`;
    const authorName =
      authUser?.name && authUser.name.trim().length > 0
        ? authUser.name.trim()
        : authUser?.email ?? 'Administrador';
    const authorRole = authUser?.role ?? 'Administrador';

    const newEntry: GeneralInfoEntry = {
      id: uniqueKey(),
      title: prefixedTitle,
      body: normalizedBody,
      createdAt: new Date().toISOString(),
      authorId: authUser?.id ?? null,
      authorName,
      authorRole,
      imageData,
      imageAlt: imageName ?? trimmedTitle,
    };

    const nextEntries = [newEntry, ...entries];
    setEntries(nextEntries);
    persistGeneralInfoEntriesToStorage(nextEntries);
    setFormError(null);
    setFormSuccess('Mensaje mostrado en el panel y monitores.');

    try {
      const response = await fetch(`${apiBaseUrl}/api/general-info/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: prefixedTitle,
          body: normalizedBody,
          authorId: authUser?.id ?? null,
          authorName,
          authorRole,
          imageData,
          imageAlt: imageName ?? trimmedTitle,
        }),
      });

      if (!response.ok) {
        throw new Error(`No se pudo subir la publicación (${response.status}).`);
      }

      await fetchGeneralInfoEntriesFromServer();
    } catch {
      setFormError('No pudimos sincronizar el mensaje con el servidor. Se guardó localmente.');
      setFormSuccess(null);
    }
  };

  const handleDeleteEntry = async (entry: GeneralInfoEntry) => {
    if (!isAdmin) {
      return;
    }
    if (!window.confirm(`¿Eliminar la publicación "${entry.title}"?`)) {
      return;
    }
    const nextEntries = entries.filter((item) => item.id !== entry.id);
    setEntries(nextEntries);
    persistGeneralInfoEntriesToStorage(nextEntries);
    setFormError(null);
    setFormSuccess(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/general-info/posts/${entry.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`No se pudo eliminar la publicación (${response.status}).`);
      }
      await fetchGeneralInfoEntriesFromServer();
      setFormSuccess('Publicación eliminada correctamente.');
    } catch (error) {
      console.error('handleDeleteEntry failed', error);
      setFormError('No pudimos eliminar la publicación del servidor.');
      setFormSuccess(null);
      await fetchGeneralInfoEntriesFromServer();
    }
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
            <div className="general-info-actions">
              <button type="submit" className="primary-action" disabled={!isAdmin}>
                Publicar
              </button>
              <button type="button" className="secondary-action" onClick={handleSendToPanel} disabled={!isAdmin}>
                Mostrar en panel
              </button>
            </div>
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


  const fetchMessagesFromServer = useCallback(
    async (seedContacts?: ChatContact[]) => {
      if (currentUserId == null) {
        return;
      }
      const url = new URL(`${apiBaseUrl}/api/chat/messages`);
      url.searchParams.set('userId', currentUserId.toString());
      url.searchParams.set('limit', '200');

    try {
      console.debug('fetchMessagesFromServer url', url.toString());
      const response = await fetch(url.toString());
      if (!response.ok) {
        console.error('chat fetch failed', response.status, response.statusText);
        throw new Error('No se pudieron recuperar los mensajes.');
      }
      const payload = (await response.json()) as { data?: Array<Record<string, unknown>> };
      console.debug('chat fetch response', payload);
      const entries = Array.isArray(payload?.data)
        ? payload.data.map((item) => normalizeServerMessage(item))
        : [];
      persistStoredChatMessages(entries, currentUserId);
      persistStoredChatBadge(entries, currentUserId);
      mergeMessagesIntoState(entries, seedContacts);
    } catch (error) {
      console.error('chat fetch error', error);
      mergeMessagesIntoState(readStoredChatMessages(currentUserId), seedContacts);
    }
    },
    [apiBaseUrl, currentUserId, mergeMessagesIntoState]
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

  const buildMessageSnippet = useCallback((text: string, term: string) => {
    const normalized = text.toLowerCase();
    const idx = normalized.indexOf(term);
    if (idx === -1) {
      return text.length > 60 ? `${text.slice(0, 57)}…` : text;
    }
    const start = Math.max(0, idx - 20);
    const end = Math.min(text.length, idx + term.length + 20);
    const snippet = text.slice(start, end);
    return `${start > 0 ? '…' : ''}${snippet}${end < text.length ? '…' : ''}`;
  }, []);

  const findMessageMatchForContact = useCallback(
    (contactId: number, normalizedTerm: string) => {
      if (!normalizedTerm) {
        return null;
      }
      const conversation = messagesByContact[contactId] ?? [];
      for (let i = conversation.length - 1; i >= 0; i -= 1) {
        const message = conversation[i];
        const text = message.text?.trim() ?? '';
        if (text.toLowerCase().includes(normalizedTerm)) {
          return {
            snippet: buildMessageSnippet(text, normalizedTerm),
            timestamp: message.timestamp,
          };
        }
      }
      return null;
    },
    [buildMessageSnippet, messagesByContact]
  );

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contacts
      .map((contact) => {
        const match = term ? findMessageMatchForContact(contact.id, term) : null;
        return {
          ...contact,
          matchSnippet: match?.snippet ?? null,
          matchTimestamp: match?.timestamp ?? null,
        };
      })
      .filter((contact) => {
        if (term.length === 0) {
          return true;
        }
        const matchesContact =
          contact.name.toLowerCase().includes(term) ||
          contact.role.toLowerCase().includes(term) ||
          (contact.client?.toLowerCase().includes(term) ?? false);
        const matchesConversation = Boolean(contact.matchSnippet);
        return matchesContact || matchesConversation;
      });
  }, [contacts, search, findMessageMatchForContact]);

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

  const normalizeMultilineText = (value: string): string => {
    if (!value) {
      return '';
    }
    // Normaliza saltos de línea que pudieron quedar como \r\n, \r o \n.
    return value.replace(/\r\n?/g, '\n');
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
    const normalizedText = normalizeMultilineText(messageInput);
    const trimmed = normalizedText.trim();
    const hasImage = Boolean(pendingImage?.data);
    if (trimmed.length === 0 && !hasImage) {
      return;
    }

    const timestamp = new Date().toISOString();
    const newMessage: ChatMessage = {
      id: uniqueKey(),
      author: 'self',
      text: normalizedText,
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
                  ? normalizedText
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
      text: normalizedText,
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
          text: normalizedText,
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

  const { promoLogoSrc } = useBranding();

  const watermarkStyle = useMemo(() => {
    if (!promoLogoSrc) {
      return {} as React.CSSProperties;
    }
    return {
      '--chat-watermark': `url(${promoLogoSrc})`,
    } as React.CSSProperties;
  }, [promoLogoSrc]);

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
                const hasSearch = search.trim().length > 0;
                const previewText =
                  hasSearch && contact.matchSnippet
                    ? `Coincidencia: ${contact.matchSnippet}`
                    : contact.lastMessage;
                const timeLabel =
                  hasSearch && contact.matchTimestamp
                    ? formatMessageTime(contact.matchTimestamp)
                    : contact.lastSeen;
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
                      <p>{previewText}</p>
                    </div>
                    <div className="chat-contact__status">
                      <time>{timeLabel}</time>
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
                    {message.text ? (
                      <p>
                        {message.text.split('\n').map((line, index, array) => (
                          <React.Fragment key={index}>
                            {line}
                            {index < array.length - 1 ? <br /> : null}
                          </React.Fragment>
                        ))}
                      </p>
                    ) : null}
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
const DashboardPage: React.FC<{
  showPersonalPanel?: boolean;
  pageTitle?: string;
  pageSubtitle?: string;
  viewMode?: 'clientes' | 'tarifas' | 'bases';
}> = ({ showPersonalPanel = false, pageTitle, pageSubtitle, viewMode = 'clientes' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const authUser = useStoredAuthUser();
  const userRole = useMemo(() => getUserRole(authUser), [authUser]);
  const { brandLogoSrc } = useBranding();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingClienteId, setDeletingClienteId] = useState<number | null>(null);
  const [personalStatsData, setPersonalStatsData] = useState<PersonalRecord[]>([]);
  const [personalStats, setPersonalStats] = useState<{
    preActivo: number;
    activo: number;
    baja: number;
    suspendido: number;
    noCitado: number;
    otros: number;
    total: number;
  }>({
    preActivo: 0,
    activo: 0,
    baja: 0,
    suspendido: 0,
    noCitado: 0,
    otros: 0,
    total: 0,
  });
  const [statsLoading, setStatsLoading] = useState(showPersonalPanel);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsClienteFilter, setStatsClienteFilter] = useState('');
  const [statsEstadoFilter, setStatsEstadoFilter] = useState('');
  const [statsAgenteFilter, setStatsAgenteFilter] = useState('');
  const [teamGroups, setTeamGroups] = useState<TeamGroup[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamInfo, setTeamInfo] = useState<string | null>(null);
  const [usersOptions, setUsersOptions] = useState<Usuario[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  const [editingTeamColor, setEditingTeamColor] = useState<string | null>(null);
  const [editingMembers, setEditingMembers] = useState<Array<{ id?: number; userId?: number | null; name: string; email: string }>>([]);
  const [savingTeam, setSavingTeam] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState(false);
  const [teamShout, setTeamShout] = useState<string>('');
  const [teamShoutDraft, setTeamShoutDraft] = useState<string>('');
  const [teamShoutSaving, setTeamShoutSaving] = useState(false);
  const [teamShoutError, setTeamShoutError] = useState<string | null>(null);
  const [showTeamShoutPopup, setShowTeamShoutPopup] = useState(false);
  const [tarifasClienteFilter, setTarifasClienteFilter] = useState('');
  const [tarifasSucursalFilter, setTarifasSucursalFilter] = useState('');
  const [tarifasMonthFilter, setTarifasMonthFilter] = useState('');
  const [tarifasYearFilter, setTarifasYearFilter] = useState('');
  const [tarifasPorteFilter, setTarifasPorteFilter] = useState('');
  const [tarifaUploadName, setTarifaUploadName] = useState<string | null>(null);
  const [tarifaUploadPreviewUrl, setTarifaUploadPreviewUrl] = useState<string | null>(null);
  const [tarifaUploadFile, setTarifaUploadFile] = useState<File | null>(null);
  const [tarifaSaveState, setTarifaSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [tarifaSaveError, setTarifaSaveError] = useState<string | null>(null);
  const [tarifaImageLoading, setTarifaImageLoading] = useState(false);
  const [tarifaImageError, setTarifaImageError] = useState<string | null>(null);
  const [tarifaView, setTarifaView] = useState<'list' | 'form'>('list');
  const [tarifaList, setTarifaList] = useState<TarifaImagenItem[]>([]);
  const [tarifaListLoading, setTarifaListLoading] = useState(false);
  const [tarifaListError, setTarifaListError] = useState<string | null>(null);
  const [tarifaListRefreshToken, setTarifaListRefreshToken] = useState(0);
  const [tarifaModalUrl, setTarifaModalUrl] = useState<string | null>(null);
  const [tarifaModalTitle, setTarifaModalTitle] = useState<string | null>(null);
  const [tarifaTemplate, setTarifaTemplate] = useState<TarifaTemplate>(normalizeTarifaTemplate(DEFAULT_TARIFA_TEMPLATE));
  const [tarifaTemplateDirty, setTarifaTemplateDirty] = useState(false);
  const [tarifaDeleteId, setTarifaDeleteId] = useState<number | null>(null);
  const tarifaUploadInputRef = useRef<HTMLInputElement | null>(null);
  const tarifaPreviewUrlRef = useRef<string | null>(null);
  const tarifaPreviewIsObjectRef = useRef(false);
  const lastTeamShoutRef = useRef<string>('');
  const monitorMode = useMemo(() => {
    if (!showPersonalPanel) {
      return false;
    }
    const params = new URLSearchParams(location.search);
    return params.get('monitor') === '1';
  }, [location.search, showPersonalPanel]);
  const monitorTeamId = useMemo(() => {
    if (!showPersonalPanel) {
      return null;
    }
    const params = new URLSearchParams(location.search);
    const raw = params.get('team');
    if (!raw) {
      return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [location.search, showPersonalPanel]);
  const monitorRefreshIntervalMs = 45000;
  const monitorHasSummarySlide = monitorMode && monitorTeamId == null;
  const monitorCycleIntervalMs = 30000;
  const [lastStatsRefreshAt, setLastStatsRefreshAt] = useState<Date | null>(null);
  const [silentRefreshCount, setSilentRefreshCount] = useState(0);
  const isSilentRefreshing = silentRefreshCount > 0;
  const [copyMonitorState, setCopyMonitorState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [currentCycleIndex, setCurrentCycleIndex] = useState(0);
  const [cycleCountdown, setCycleCountdown] = useState<number | null>(null);
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const isTarifasView = viewMode === 'tarifas';
  const isBasesView = viewMode === 'bases';
  const canEditTarifas = useMemo(() => userRole !== 'operator', [userRole]);
  const [showRecentAltaPanel, setShowRecentAltaPanel] = useState(false);
  const [reclamoStats, setReclamoStats] = useState({ total: 0, resueltos: 0, rechazados: 0 });
  const [reclamoStatsLoading, setReclamoStatsLoading] = useState(false);
  const [reclamoStatsError, setReclamoStatsError] = useState<string | null>(null);
  const normalizeEstadoForStats = useCallback((estado: string | null | undefined): string => {
    return (estado ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const isNoCitadoEstadoForStats = useCallback(
    (estado: string | null | undefined): boolean => {
      const normalized = normalizeEstadoForStats(estado);
      return normalized.includes('no citado') || normalized.includes('no sitado');
    },
    [normalizeEstadoForStats]
  );
  const isPreActivoEstadoForStats = useCallback(
    (estado: string | null | undefined): boolean => {
      const normalized = normalizeEstadoForStats(estado);
      return normalized === 'pre activo' || normalized === 'preactivo';
    },
    [normalizeEstadoForStats]
  );
  const isActivoEstadoForStats = useCallback(
    (estado: string | null | undefined): boolean => normalizeEstadoForStats(estado) === 'activo',
    [normalizeEstadoForStats]
  );

  const filterPersonalRecords = useCallback(
    (data: PersonalRecord[], clienteFilter: string, estadoFilter: string, agenteFilter: string) =>
      data.filter((registro) => {
        if (registro.esSolicitud) {
          return false;
        }
        if (clienteFilter && registro.cliente !== clienteFilter) {
          return false;
        }
        if (estadoFilter) {
          const normalizedFilter = normalizeEstadoForStats(estadoFilter);
          const estado = normalizeEstadoForStats(registro.estado);
          const filterNoCitado =
            normalizedFilter === 'no_citado' ||
            normalizedFilter === 'no citado' ||
            normalizedFilter === 'no sitado';
          if (filterNoCitado) {
            if (!isNoCitadoEstadoForStats(registro.estado)) {
              return false;
            }
          } else if (estado !== normalizedFilter) {
            return false;
          }
        }
        if (agenteFilter && registro.agente !== agenteFilter) {
          return false;
        }
        return true;
      }),
    [isNoCitadoEstadoForStats, normalizeEstadoForStats]
  );

  const computePersonalStats = useCallback((data: PersonalRecord[]) => {
    const stats = data.reduce(
      (acc, registro) => {
        const estado = normalizeEstadoForStats(registro.estado);
        if (isNoCitadoEstadoForStats(registro.estado)) {
          acc.noCitado += 1;
        } else if (isPreActivoEstadoForStats(registro.estado)) {
          acc.preActivo += 1;
        } else if (isActivoEstadoForStats(registro.estado)) {
          acc.activo += 1;
        } else if (estado.includes('baja')) {
          acc.baja += 1;
        } else if (estado.includes('suspend')) {
          acc.suspendido += 1;
        } else {
          acc.otros += 1;
        }
        return acc;
      },
      { preActivo: 0, activo: 0, baja: 0, suspendido: 0, noCitado: 0, otros: 0, total: 0 }
    );
    stats.total = stats.preActivo + stats.activo + stats.baja + stats.suspendido + stats.noCitado + stats.otros;
    return stats;
  }, [isActivoEstadoForStats, isNoCitadoEstadoForStats, isPreActivoEstadoForStats, normalizeEstadoForStats]);

  const fetchPersonalStats = useCallback(
    async ({ signal, silent }: { signal?: AbortSignal; silent?: boolean } = {}) => {
      if (!showPersonalPanel) {
        return;
      }

      const isSilent = Boolean(silent);
      if (isSilent) {
        setSilentRefreshCount((value) => value + 1);
      } else {
        setStatsLoading(true);
      }
      setStatsError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/personal?includePending=1`, {
          signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: PersonalRecord[] };
        if (!payload || !Array.isArray(payload.data)) {
          throw new Error('Formato de respuesta inesperado');
        }

        if (signal?.aborted) {
          return;
        }

        setPersonalStatsData(payload.data);
        setLastStatsRefreshAt(new Date());
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setStatsError((err as Error).message ?? 'No se pudieron cargar los datos de personal.');
      } finally {
        if (isSilent) {
          setSilentRefreshCount((value) => Math.max(0, value - 1));
        } else {
          setStatsLoading(false);
        }
      }
    },
    [apiBaseUrl, showPersonalPanel]
  );

  const fetchTeams = useCallback(
    async ({ signal, silent }: { signal?: AbortSignal; silent?: boolean } = {}) => {
      if (!showPersonalPanel) {
        return;
      }
      if (!silent) {
        setTeamLoading(true);
      }
      setTeamError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/api/team-groups`, { signal });
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const payload = (await response.json()) as { data?: TeamGroup[] };
        if (signal?.aborted) {
          return;
        }
        setTeamGroups(Array.isArray(payload?.data) ? payload.data : []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setTeamError((err as Error).message ?? 'No se pudieron cargar los equipos.');
      } finally {
        if (!silent) {
          setTeamLoading(false);
        }
      }
    },
    [apiBaseUrl, showPersonalPanel]
  );

  useEffect(() => {
    if (!showPersonalPanel) {
      return;
    }
    const params = new URLSearchParams(location.search);
    setStatsClienteFilter(params.get('cliente') ?? '');
    setStatsEstadoFilter(params.get('estado') ?? '');
    setStatsAgenteFilter(params.get('agente') ?? '');
  }, [location.search, showPersonalPanel]);

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

  useEffect(() => {
    setTarifasSucursalFilter('');
  }, [tarifasClienteFilter]);

  const setTarifaPreview = useCallback((url: string | null, isObjectUrl: boolean) => {
    if (tarifaPreviewUrlRef.current && tarifaPreviewIsObjectRef.current) {
      URL.revokeObjectURL(tarifaPreviewUrlRef.current);
    }
    tarifaPreviewUrlRef.current = url;
    tarifaPreviewIsObjectRef.current = isObjectUrl;
    setTarifaUploadPreviewUrl(url);
  }, []);

  const resolveTarifaImageUrl = useCallback(
    (url: string | null): string | null => {
      if (!url) {
        return null;
      }
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      if (url.startsWith('/')) {
        return `${apiBaseUrl}${url}`;
      }
      return `${apiBaseUrl}/${url}`;
    },
    [apiBaseUrl]
  );

  const resolveTarifaDisplayUrl = useCallback(
    (item: TarifaImagenItem): string | null =>
      item.dataUrl ?? resolveTarifaImageUrl(item.relativeUrl ?? item.url ?? null),
    [resolveTarifaImageUrl]
  );

  const monthLabelLookup = useMemo(() => {
    const map = new Map<string, string>();
    TARIFA_MONTH_OPTIONS.forEach((option) => map.set(option.value, option.label));
    return map;
  }, []);
  const porteLabelLookup = useMemo(() => {
    const map = new Map<string, string>();
    TARIFA_PORTE_OPTIONS.forEach((option) => map.set(option.value, option.label));
    return map;
  }, []);

  const buildTarifaCanvas = useCallback(async (template: TarifaTemplate, logoSrc?: string | null) => {
    const canvas = document.createElement('canvas');
    const width = 1200;
    const height = 800;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return canvas;
    }

    ctx.fillStyle = '#fdf6f6';
    ctx.fillRect(0, 0, width, height);

    const rightPanelWidth = 300;
    const rightPanelX = width - rightPanelWidth;
    ctx.fillStyle = '#d3e4ea';
    ctx.fillRect(rightPanelX, 0, rightPanelWidth, height);

    if (logoSrc) {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      try {
        const logo = await loadImage(logoSrc);
        const logoWidth = 230;
        const ratio = logo.width ? logoWidth / logo.width : 1;
        const logoHeight = Math.max(40, Math.round(logo.height * ratio));
        const logoX = rightPanelX - logoWidth - 20;
        const logoY = -40;
        ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
      } catch {
        // ignore logo errors
      }
    }

    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 52px "Arial", sans-serif';
    ctx.fillText(template.title || 'Tarifa', 40, 70);

    ctx.fillStyle = '#2f3e4d';
    ctx.font = 'bold 28px "Arial", sans-serif';
    ctx.fillText(template.subtitle || '', 40, 110);

    const tableTop = 150;
    const tableLeft = 40;
    const tableWidth = width - tableLeft * 2 - rightPanelWidth + 20;
    const headerHeight = 42;
    const rowHeight = 40;
    const firstColWidth = 180;
    const otherCols = template.columns.length;
    const otherColWidth = otherCols > 0 ? (tableWidth - firstColWidth) / otherCols : tableWidth - firstColWidth;

    ctx.fillStyle = '#f04343';
    ctx.fillRect(tableLeft, tableTop - 34, tableWidth, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Arial", sans-serif';
    ctx.fillText(template.tableTitle || 'Tipo de paquetería', tableLeft + 12, tableTop - 14);

    ctx.fillStyle = '#f0f4ff';
    ctx.fillRect(tableLeft, tableTop, tableWidth, headerHeight);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    ctx.strokeRect(tableLeft, tableTop, tableWidth, headerHeight);

    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 16px "Arial", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('Zona', tableLeft + 12, tableTop + headerHeight / 2);

    template.columns.forEach((col, index) => {
      const x = tableLeft + firstColWidth + otherColWidth * index;
      ctx.strokeRect(x, tableTop, otherColWidth, headerHeight);
      ctx.fillText(col, x + 8, tableTop + headerHeight / 2);
    });

    template.rows.forEach((row, rowIndex) => {
      const y = tableTop + headerHeight + rowHeight * rowIndex;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tableLeft, y, tableWidth, rowHeight);
      ctx.strokeStyle = '#1f2937';
      ctx.strokeRect(tableLeft, y, tableWidth, rowHeight);

      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 14px "Arial", sans-serif';
      ctx.fillText(row.label, tableLeft + 12, y + rowHeight / 2);

      row.values.forEach((value, colIndex) => {
        const x = tableLeft + firstColWidth + otherColWidth * colIndex;
        ctx.strokeRect(x, y, otherColWidth, rowHeight);
        ctx.fillStyle = '#1f2937';
        ctx.font = '14px "Arial", sans-serif';
        ctx.fillText(value, x + 8, y + rowHeight / 2);
      });
    });

    const drawWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
      const words = text.split(/\s+/);
      let line = '';
      let offsetY = y;
      ctx.fillStyle = '#1f2937';
      ctx.font = '16px "Arial", sans-serif';
      words.forEach((word, index) => {
        const testLine = `${line}${word} `;
        const { width: lineWidth } = ctx.measureText(testLine);
        if (lineWidth > maxWidth && index > 0) {
          ctx.fillText(line.trim(), x, offsetY);
          line = `${word} `;
          offsetY += lineHeight;
        } else {
          line = testLine;
        }
      });
      if (line.trim()) {
        ctx.fillText(line.trim(), x, offsetY);
      }
    };

    if (template.observations?.trim()) {
      drawWrappedText(template.observations.trim(), rightPanelX + 16, 120, rightPanelWidth - 32, 20);
    }

    return canvas;
  }, []);

  const buildTarifaImageFile = useCallback(
    async (template: TarifaTemplate): Promise<File> =>
      new Promise((resolve, reject) => {
        void (async () => {
          try {
            const canvas = await buildTarifaCanvas(template, brandLogoSrc);
            canvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error('No se pudo generar la imagen.'));
                return;
              }
              const safeTitle = (template.title || 'tarifa').toLowerCase().replace(/\s+/g, '-');
              resolve(new File([blob], `${safeTitle}.png`, { type: 'image/png' }));
            }, 'image/png');
          } catch (err) {
            reject(err as Error);
          }
        })();
      }),
    [brandLogoSrc, buildTarifaCanvas]
  );

  useEffect(() => {
    return () => {
      if (tarifaPreviewUrlRef.current && tarifaPreviewIsObjectRef.current) {
        URL.revokeObjectURL(tarifaPreviewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isTarifasView || tarifaView !== 'form') {
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams();
    if (tarifasClienteFilter) {
      params.set('clienteId', tarifasClienteFilter);
    }
    if (tarifasSucursalFilter) {
      params.set('sucursalId', tarifasSucursalFilter);
    }
    if (tarifasMonthFilter) {
      params.set('mes', tarifasMonthFilter);
    }
    if (tarifasYearFilter) {
      params.set('anio', tarifasYearFilter);
    }
    if (tarifasPorteFilter) {
      params.set('tipo', tarifasPorteFilter);
    }

    const fetchTarifaImage = async () => {
      try {
        setTarifaImageLoading(true);
        setTarifaImageError(null);
        setTarifaSaveState('idle');
        setTarifaSaveError(null);
        setTarifaUploadFile(null);
        setTarifaUploadName(null);

        const response = await fetch(`${apiBaseUrl}/api/tarifas/imagen?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as {
          data?: {
            url?: string | null;
            relativeUrl?: string | null;
            dataUrl?: string | null;
            nombreOriginal?: string | null;
            templateData?: TarifaTemplate | null;
          } | null;
        };
        const dataUrl = payload?.data?.dataUrl ?? null;
        const url = resolveTarifaImageUrl(payload?.data?.relativeUrl ?? payload?.data?.url ?? null);
        setTarifaPreview(dataUrl ?? url, Boolean(dataUrl));
        setTarifaUploadName(payload?.data?.nombreOriginal ?? null);
        setTarifaTemplate(normalizeTarifaTemplate(payload?.data?.templateData ?? DEFAULT_TARIFA_TEMPLATE));
        setTarifaTemplateDirty(false);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setTarifaImageError((err as Error).message ?? 'No se pudo cargar la imagen.');
        setTarifaPreview(null, false);
      } finally {
        setTarifaImageLoading(false);
      }
    };

    fetchTarifaImage();
    return () => controller.abort();
  }, [
    apiBaseUrl,
    isTarifasView,
    tarifaView,
    tarifasClienteFilter,
    tarifasSucursalFilter,
    tarifasMonthFilter,
    tarifasYearFilter,
    tarifasPorteFilter,
    setTarifaPreview,
  ]);

  useEffect(() => {
    if (!isTarifasView || tarifaView !== 'list') {
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams();
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim());
    }
    if (tarifasClienteFilter) {
      params.set('clienteId', tarifasClienteFilter);
    }
    if (tarifasSucursalFilter) {
      params.set('sucursalId', tarifasSucursalFilter);
    }
    if (tarifasMonthFilter) {
      params.set('mes', tarifasMonthFilter);
    }
    if (tarifasYearFilter) {
      params.set('anio', tarifasYearFilter);
    }
    if (tarifasPorteFilter) {
      params.set('tipo', tarifasPorteFilter);
    }

    const fetchTarifaList = async () => {
      try {
        setTarifaListLoading(true);
        setTarifaListError(null);
        const response = await fetch(`${apiBaseUrl}/api/tarifas/imagenes?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const payload = (await response.json()) as { data?: TarifaImagenItem[] };
        setTarifaList(Array.isArray(payload?.data) ? payload.data : []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setTarifaListError((err as Error).message ?? 'No se pudieron cargar las tarifas.');
      } finally {
        setTarifaListLoading(false);
      }
    };

    fetchTarifaList();
    return () => controller.abort();
  }, [
    apiBaseUrl,
    isTarifasView,
    tarifaView,
    searchTerm,
    tarifasClienteFilter,
    tarifasSucursalFilter,
    tarifasMonthFilter,
    tarifasYearFilter,
    tarifasPorteFilter,
    tarifaListRefreshToken,
  ]);

  useEffect(() => {
    if (!isTarifasView || tarifaView !== 'form') {
      return;
    }
    if (!canEditTarifas) {
      setTarifaView('list');
      return;
    }
    if (tarifaUploadFile) {
      return;
    }
    let alive = true;
    const run = async () => {
      const canvas = await buildTarifaCanvas(tarifaTemplate, brandLogoSrc);
      if (!alive) {
        return;
      }
      const dataUrl = canvas.toDataURL('image/png');
      setTarifaPreview(dataUrl, true);
    };
    void run();
    return () => {
      alive = false;
    };
  }, [brandLogoSrc, buildTarifaCanvas, canEditTarifas, isTarifasView, tarifaTemplate, tarifaUploadFile, tarifaView, setTarifaPreview]);

  useEffect(() => {
    if (!showPersonalPanel) {
      return;
    }

    const controller = new AbortController();
    fetchPersonalStats({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchPersonalStats, showPersonalPanel]);

  useEffect(() => {
    if (!showPersonalPanel) {
      return;
    }
    const controller = new AbortController();
    fetchTeams({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchTeams, showPersonalPanel]);

  useEffect(() => {
    if (!showPersonalPanel) {
      return;
    }
    const controller = new AbortController();
    const fetchUsers = async () => {
      try {
        setUsersLoading(true);
        setUsersError(null);
        const response = await fetch(`${apiBaseUrl}/api/usuarios`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const payload = (await response.json()) as { data?: Usuario[] };
        setUsersOptions(Array.isArray(payload?.data) ? payload.data : []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setUsersError((err as Error).message ?? 'No se pudieron cargar los usuarios.');
      } finally {
        setUsersLoading(false);
      }
    };
    fetchUsers();
    return () => controller.abort();
  }, [apiBaseUrl, showPersonalPanel]);

  const syncShout = useCallback(async () => {
    if (!showPersonalPanel) {
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/general-info/posts`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }
      const payload = (await response.json()) as { data?: GeneralInfoEntryApi[] };
      const entries = Array.isArray(payload?.data) ? payload.data.map(mapGeneralInfoApiEntry) : [];
      const panelEntries = entries.filter(
        (entry) =>
          (entry.title && entry.title.startsWith(PANEL_MESSAGE_PREFIX)) ||
          entry.body?.includes(PANEL_MESSAGE_MARKER)
      );
      if (panelEntries.length === 0) {
        setTeamShout('');
        setTeamShoutDraft('');
        setShowTeamShoutPopup(false);
        lastTeamShoutRef.current = '';
        return;
      }
      const latest = [...panelEntries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      const cleanTitle =
        latest.title && latest.title.startsWith(PANEL_MESSAGE_PREFIX)
          ? latest.title.replace(PANEL_MESSAGE_PREFIX, '').trim()
          : latest.title?.trim() ?? '';

      const message = [
        cleanTitle ? `**${cleanTitle}**` : '',
        convertHtmlToShoutSyntax((latest.body ?? '').replace(PANEL_MESSAGE_MARKER, '')),
      ]
        .filter(Boolean)
        .join('\n')
        .trim();

      setTeamShout(message);
      setTeamShoutDraft(message);
      if (message) {
        setShowTeamShoutPopup(true);
        lastTeamShoutRef.current = message;
      } else {
        setShowTeamShoutPopup(false);
        lastTeamShoutRef.current = '';
      }
    } catch (err) {
      console.warn('No se pudo sincronizar el mensaje de panel', err);
    }
  }, [apiBaseUrl, showPersonalPanel]);

  useEffect(() => {
    if (!showPersonalPanel) {
      return;
    }

    const run = () => {
      void syncShout();
    };

    run();

    const intervalId = window.setInterval(run, 3000);
    const handleVisibility = () => {
      if (!document.hidden) {
        run();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(intervalId);
    };
  }, [showPersonalPanel, syncShout]);

  useEffect(() => {
    if (!showTeamShoutPopup) {
      return;
    }
    const timeoutId = window.setTimeout(() => setShowTeamShoutPopup(false), 60000);
    return () => window.clearTimeout(timeoutId);
  }, [showTeamShoutPopup]);

  useEffect(() => {
    if (!showPersonalPanel || !monitorMode) {
      return undefined;
    }

    let controller: AbortController | null = null;

    const runRefresh = () => {
      if (controller) {
        controller.abort();
      }
      controller = new AbortController();
      void fetchPersonalStats({ silent: true, signal: controller.signal });
      void fetchTeams({ silent: true, signal: controller.signal });
    };

    runRefresh();
    const intervalId = window.setInterval(runRefresh, monitorRefreshIntervalMs);
    return () => {
      if (controller) {
        controller.abort();
      }
      window.clearInterval(intervalId);
    };
  }, [fetchPersonalStats, fetchTeams, monitorMode, monitorRefreshIntervalMs, showPersonalPanel]);

  useEffect(() => {
    if (!showPersonalPanel) {
      return;
    }
    const filtered = filterPersonalRecords(personalStatsData, statsClienteFilter, statsEstadoFilter, statsAgenteFilter);
    setPersonalStats(computePersonalStats(filtered));
  }, [
    showPersonalPanel,
    personalStatsData,
    statsClienteFilter,
    statsEstadoFilter,
    statsAgenteFilter,
    filterPersonalRecords,
    computePersonalStats,
  ]);

  useEffect(() => {
    if (!showPersonalPanel) {
      return;
    }
    const controller = new AbortController();
    const fetchReclamoStats = async () => {
      try {
        setReclamoStatsLoading(true);
        setReclamoStatsError(null);
        const response = await fetch(`${apiBaseUrl}/api/reclamos`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const payload = (await response.json()) as { data: ReclamoRecord[] };
        if (!payload || !Array.isArray(payload.data)) {
          throw new Error('Formato de respuesta inesperado');
        }
        const counts = payload.data.reduce(
          (acc, reclamo) => {
            acc.total += 1;
            const status = (reclamo.status ?? '').toLowerCase();
            if (status.includes('resuelto') || status.includes('finalizado') || status.includes('cerrado')) {
              acc.resueltos += 1;
            } else if (status.includes('rechaz')) {
              acc.rechazados += 1;
            }
            return acc;
          },
          { total: 0, resueltos: 0, rechazados: 0 }
        );
        setReclamoStats(counts);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setReclamoStatsError((err as Error).message ?? 'No se pudieron cargar los reclamos.');
      } finally {
        setReclamoStatsLoading(false);
      }
    };
    fetchReclamoStats();
    return () => controller.abort();
  }, [apiBaseUrl, showPersonalPanel]);

  const resetTeamForm = useCallback(() => {
    setEditingTeamId(null);
    setEditingTeamName('');
    setEditingTeamColor(null);
    setEditingMembers([]);
    setTeamInfo(null);
    setTeamError(null);
  }, []);

  const populateTeamForm = useCallback(
    (team: TeamGroup | null) => {
      if (!team) {
        resetTeamForm();
        return;
      }
      setEditingTeamId(team.id);
      setEditingTeamName(team.name);
      setEditingTeamColor(team.color ?? null);
      setEditingMembers(
        (team.members ?? []).map((member) => ({
          id: member.id,
          userId: member.userId ?? null,
          name: member.name,
          email: member.email ?? '',
        }))
      );
      setTeamInfo(null);
      setTeamError(null);
    },
    [resetTeamForm]
  );

  const addEmptyMember = () => {
    setEditingMembers((prev) => [...prev, { name: '', email: '', userId: null }]);
  };

  const updateMemberField = (index: number, field: 'name' | 'email', value: string) => {
    setEditingMembers((prev) =>
      prev.map((member, idx) => (idx === index ? { ...member, [field]: value } : member))
    );
  };

  const handleMemberSelect = (index: number, userId: string) => {
    const selected = usersOptions.find((user) => String(user.id) === userId);
    if (!selected) {
      return;
    }
    setEditingMembers((prev) =>
      prev.map((member, idx) =>
        idx === index
          ? {
              ...member,
              userId: selected.id,
              name: selected.name ?? member.name,
              email: selected.email ?? member.email,
            }
          : member
      )
    );
  };

  const removeMember = (index: number) => {
    setEditingMembers((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveTeamShout = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = teamShoutDraft.trim();
      if (!trimmed) {
        setTeamShoutError('Ingresá un mensaje.');
        return;
      }
      setTeamShoutSaving(true);
      try {
        writeTeamShoutMessage(trimmed);
        setTeamShout(trimmed);
        setTeamShoutError(null);
      } catch {
        setTeamShoutError('No se pudo guardar el mensaje.');
      } finally {
        setTeamShoutSaving(false);
      }
    },
    [teamShoutDraft]
  );

  const handleClearTeamShout = useCallback(() => {
    setTeamShoutDraft('');
    setTeamShout('');
    writeTeamShoutMessage('');
    setShowTeamShoutPopup(false);
    lastTeamShoutRef.current = '';
  }, []);

  const handleInsertShoutSnippet = useCallback((snippet: string) => {
    setTeamShoutDraft((prev) => `${prev || ''}${snippet}`);
    setTeamShoutError(null);
  }, []);

  const handleSaveTeam = async () => {
    const trimmedName = editingTeamName.trim();
    if (!trimmedName) {
      setTeamError('Ingresá un nombre de equipo.');
      return;
    }
    const membersPayload = editingMembers
      .map((member) => ({
        id: member.id,
        userId: member.userId ?? null,
        name: member.name.trim(),
        email: member.email.trim(),
      }))
      .filter((member) => member.name.length > 0);

    try {
      setSavingTeam(true);
      setTeamError(null);
      setTeamInfo(null);

      const payload = {
        name: trimmedName,
        color: editingTeamColor?.trim() || null,
        members: membersPayload,
      };

      const endpoint =
        editingTeamId === null
          ? `${apiBaseUrl}/api/team-groups`
          : `${apiBaseUrl}/api/team-groups/${editingTeamId}`;
      const method = editingTeamId === null ? 'POST' : 'PUT';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let msg = `Error ${response.status}`;
        try {
          const errorPayload = await response.json();
          if (typeof errorPayload?.message === 'string') {
            msg = errorPayload.message;
          }
        } catch {
          // ignore parse errors
        }
        throw new Error(msg);
      }

      const result = (await response.json()) as { data?: TeamGroup };
      if (result?.data) {
        setTeamGroups((prev) => {
          const exists = prev.some((group) => group.id === result.data!.id);
          if (exists) {
            return prev.map((group) => (group.id === result.data!.id ? result.data! : group)).sort((a, b) =>
              a.name.localeCompare(b.name)
            );
          }
          return [...prev, result.data!].sort((a, b) => a.name.localeCompare(b.name));
        });
        populateTeamForm(result.data);
        setTeamInfo('Equipo guardado correctamente.');
      }
    } catch (err) {
      setTeamError((err as Error).message ?? 'No se pudo guardar el equipo.');
    } finally {
      setSavingTeam(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (editingTeamId === null) {
      resetTeamForm();
      return;
    }
    if (!window.confirm('¿Eliminar este equipo? Esta acción quitará también sus miembros.')) {
      return;
    }
    try {
      setDeletingTeam(true);
      setTeamError(null);
      setTeamInfo(null);
      const response = await fetch(`${apiBaseUrl}/api/team-groups/${editingTeamId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      setTeamGroups((prev) => prev.filter((group) => group.id !== editingTeamId));
      resetTeamForm();
      setTeamInfo('Equipo eliminado.');
    } catch (err) {
      setTeamError((err as Error).message ?? 'No se pudo eliminar el equipo.');
    } finally {
      setDeletingTeam(false);
    }
  };

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
        ...cliente.sucursales.flatMap((sucursal) => [
          sucursal.nombre,
          sucursal.direccion,
          sucursal.encargado_deposito ?? null,
        ]),
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

  const tarifasClienteOptions = useMemo(
    () =>
      clientes
        .map((cliente) => ({
          value: String(cliente.id),
          label: cliente.nombre ?? `Cliente #${cliente.id}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [clientes]
  );

  const tarifasSucursalOptions = useMemo(() => {
    const sourceClientes = tarifasClienteFilter
      ? clientes.filter((cliente) => String(cliente.id) === tarifasClienteFilter)
      : clientes;
    const options = new Map<number, string>();
    sourceClientes.forEach((cliente) => {
      cliente.sucursales.forEach((sucursal) => {
        if (sucursal.id == null) {
          return;
        }
        const labelParts = [
          sucursal.nombre ?? undefined,
          sucursal.direccion ?? undefined,
        ].filter(Boolean);
        const label = labelParts.length > 0 ? labelParts.join(' - ') : 'Sin datos';
        options.set(sucursal.id, label);
      });
    });
    return Array.from(options.entries())
      .map(([id, label]) => ({ value: String(id), label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [clientes, tarifasClienteFilter]);

  const tarifasYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, index) => String(currentYear - 3 + index));
  }, []);

  const clienteTableColCount = isTarifasView ? 2 : 6;
  const handleSaveTarifaImage = async () => {
    let fileToUpload = tarifaUploadFile;
    if (!fileToUpload) {
      try {
        fileToUpload = await buildTarifaImageFile(tarifaTemplate);
      } catch (err) {
        setTarifaSaveState('error');
        setTarifaSaveError((err as Error).message ?? 'No se pudo generar la imagen.');
        return;
      }
    }

    try {
      setTarifaSaveState('saving');
      setTarifaSaveError(null);
      const formData = new FormData();
      formData.append('archivo', fileToUpload);
      if (tarifasClienteFilter) {
        formData.append('clienteId', tarifasClienteFilter);
      }
      if (tarifasSucursalFilter) {
        formData.append('sucursalId', tarifasSucursalFilter);
      }
      if (tarifasMonthFilter) {
        formData.append('mes', tarifasMonthFilter);
      }
      if (tarifasYearFilter) {
        formData.append('anio', tarifasYearFilter);
      }
      if (tarifasPorteFilter) {
        formData.append('tipo', tarifasPorteFilter);
      }
      formData.append('templateData', JSON.stringify(tarifaTemplate));

      const response = await fetch(`${apiBaseUrl}/api/tarifas/imagen`, {
        method: 'POST',
        body: formData,
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
        data?: {
          url?: string | null;
          relativeUrl?: string | null;
          dataUrl?: string | null;
          nombreOriginal?: string | null;
        };
      };
      setTarifaSaveState('saved');
      setTarifaUploadFile(null);
      setTarifaTemplateDirty(false);
      const dataUrl = payload?.data?.dataUrl ?? null;
      const resolvedUrl = resolveTarifaImageUrl(payload?.data?.relativeUrl ?? payload?.data?.url ?? null);
      if (dataUrl || resolvedUrl) {
        setTarifaPreview(dataUrl ?? resolvedUrl, Boolean(dataUrl));
      }
      setTarifaUploadName(payload?.data?.nombreOriginal ?? tarifaUploadName);
      setTarifaListRefreshToken((prev) => prev + 1);
    } catch (err) {
      setTarifaSaveState('error');
      setTarifaSaveError((err as Error).message ?? 'No se pudo guardar la imagen.');
    }
  };

  const headerContent = showPersonalPanel
    ? null
    : (
      <div className="card-header">
        {!isTarifasView ? (
          <div className="search-wrapper">
            <input
              type="search"
              placeholder="Buscar"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        ) : null}
        {!isTarifasView && !isBasesView ? (
          <button
            className="primary-action"
            type="button"
            onClick={() => navigate('/clientes/nuevo')}
          >
            Registrar cliente
          </button>
        ) : null}
        {isBasesView ? (
          <div className="card-header__buttons">
            <button className="secondary-action" type="button" onClick={() => navigate('/clientes')}>
              Ver listado
            </button>
            <button className="primary-action" type="button" onClick={() => navigate('/clientes/nuevo')}>
              Registrar cliente
            </button>
          </div>
        ) : null}
        {isTarifasView && tarifaView === 'list' ? (
          <div className="filters-bar">
            <div className="filters-actions">
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
                onClick={() => setTarifaView('form')}
                disabled={!canEditTarifas}
                title={canEditTarifas ? undefined : 'Solo lectura para operadores.'}
              >
                Agregar tarifa
              </button>
            </div>
            <div className="filters-grid filters-grid--tarifas-list">
              <label className="filter-field">
                <span>Cliente</span>
                <select
                  value={tarifasClienteFilter}
                  onChange={(event) => setTarifasClienteFilter(event.target.value)}
                >
                  <option value="">Todos los clientes</option>
                  {tarifasClienteOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-field">
                <span>Sucursal</span>
                <select
                  value={tarifasSucursalFilter}
                  onChange={(event) => setTarifasSucursalFilter(event.target.value)}
                  disabled={tarifasSucursalOptions.length === 0}
                >
                  <option value="">Todas las sucursales</option>
                  {tarifasSucursalOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-field">
                <span>Mes</span>
                <select
                  value={tarifasMonthFilter}
                  onChange={(event) => setTarifasMonthFilter(event.target.value)}
                >
                  <option value="">Todos los meses</option>
                  {TARIFA_MONTH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
                  <label className="filter-field">
                    <span>Año</span>
                    <select
                      value={tarifasYearFilter}
                      onChange={(event) => setTarifasYearFilter(event.target.value)}
                    >
                      <option value="">Todos los años</option>
                      {tarifasYearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="filter-field">
                    <span>Porte</span>
                    <select
                      value={tarifasPorteFilter}
                      onChange={(event) => setTarifasPorteFilter(event.target.value)}
                    >
                      <option value="">Todos los portes</option>
                      {TARIFA_PORTE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
          </div>
        ) : null}
        {isTarifasView && tarifaView === 'form' ? (
          <div className="filters-bar filters-bar--tarifas" style={{ marginTop: '0.75rem' }}>
            <div className="tarifas-filters">
              <div className="tarifas-filters__left">
                <div className="search-wrapper">
                  <input
                    type="search"
                    placeholder="Buscar"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
                <div className="filters-grid">
                  <label className="filter-field">
                    <span>Cliente</span>
                    <select
                      value={tarifasClienteFilter}
                      onChange={(event) => setTarifasClienteFilter(event.target.value)}
                    >
                      <option value="">Todos los clientes</option>
                      {tarifasClienteOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="filter-field">
                    <span>Sucursal</span>
                    <select
                      value={tarifasSucursalFilter}
                      onChange={(event) => setTarifasSucursalFilter(event.target.value)}
                      disabled={tarifasSucursalOptions.length === 0}
                    >
                      <option value="">Todas las sucursales</option>
                      {tarifasSucursalOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="filter-field">
                    <span>Mes</span>
                    <select
                      value={tarifasMonthFilter}
                      onChange={(event) => setTarifasMonthFilter(event.target.value)}
                    >
                      <option value="">Todos los meses</option>
                      {TARIFA_MONTH_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="filter-field">
                    <span>Año</span>
                    <select
                      value={tarifasYearFilter}
                      onChange={(event) => setTarifasYearFilter(event.target.value)}
                    >
                      <option value="">Todos los años</option>
                      {tarifasYearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="filter-field">
                    <span>Porte</span>
                    <select
                      value={tarifasPorteFilter}
                      onChange={(event) => setTarifasPorteFilter(event.target.value)}
                    >
                      <option value="">Todos los portes</option>
                      {TARIFA_PORTE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="filters-actions">
                  <input
                    ref={tarifaUploadInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setTarifaUploadFile(file);
                      setTarifaUploadName(file ? file.name : null);
                      setTarifaSaveState('idle');
                      setTarifaSaveError(null);
                      setTarifaPreview(file ? URL.createObjectURL(file) : null, Boolean(file));
                    }}
                    hidden
                  />
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => tarifaUploadInputRef.current?.click()}
                    disabled={!canEditTarifas}
                    title={canEditTarifas ? undefined : 'Solo lectura para operadores.'}
                  >
                    Subir imagen
                  </button>
                  <button
                    type="button"
                    className="primary-action"
                    onClick={handleSaveTarifaImage}
                    disabled={tarifaSaveState === 'saving' || !canEditTarifas}
                    title={canEditTarifas ? undefined : 'Solo lectura para operadores.'}
                  >
                    {tarifaSaveState === 'saving' ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => setTarifaView('list')}
                  >
                    Volver
                  </button>
                  {tarifaUploadName ? (
                    <span className="form-info">Archivo: {tarifaUploadName}</span>
                  ) : null}
                  {tarifaSaveState === 'saved' ? (
                    <span className="form-info">Imagen guardada.</span>
                  ) : null}
                  {tarifaSaveState === 'error' && tarifaSaveError ? (
                    <span className="form-info form-info--error">{tarifaSaveError}</span>
                  ) : null}
                </div>
                <div className="tarifa-template">
                  <div className="tarifa-template__header">
                    <h4>Plantilla</h4>
                    {tarifaTemplateDirty ? <span className="form-info">Cambios sin guardar</span> : null}
                  </div>
                  <div className="tarifa-template__actions">
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => {
                        setTarifaTemplate((prev) => ({
                          ...prev,
                          columns: [...prev.columns, `Columna ${prev.columns.length + 1}`],
                          rows: prev.rows.map((row) => ({
                            ...row,
                            values: [...row.values, ''],
                          })),
                        }));
                        setTarifaTemplateDirty(true);
                      }}
                    >
                      Agregar columna
                    </button>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => {
                        setTarifaTemplate((prev) => {
                          if (prev.columns.length <= 1) {
                            return prev;
                          }
                          const nextColumns = prev.columns.slice(0, -1);
                          const nextRows = prev.rows.map((row) => ({
                            ...row,
                            values: row.values.slice(0, -1),
                          }));
                          return { ...prev, columns: nextColumns, rows: nextRows };
                        });
                        setTarifaTemplateDirty(true);
                      }}
                      disabled={tarifaTemplate.columns.length <= 1}
                    >
                      Quitar columna
                    </button>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => {
                        setTarifaTemplate((prev) => ({
                          ...prev,
                          rows: [
                            ...prev.rows,
                            { label: `Zona ${prev.rows.length + 1}`, values: prev.columns.map(() => '') },
                          ],
                        }));
                        setTarifaTemplateDirty(true);
                      }}
                    >
                      Agregar fila
                    </button>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => {
                        setTarifaTemplate((prev) => {
                          if (prev.rows.length <= 1) {
                            return prev;
                          }
                          return { ...prev, rows: prev.rows.slice(0, -1) };
                        });
                        setTarifaTemplateDirty(true);
                      }}
                      disabled={tarifaTemplate.rows.length <= 1}
                    >
                      Quitar fila
                    </button>
                  </div>
                  <div className="tarifa-template__fields">
                    <label className="filter-field">
                      <span>Título</span>
                      <input
                        type="text"
                        value={tarifaTemplate.title}
                        onChange={(event) => {
                          const value = event.target.value;
                          setTarifaTemplate((prev) => ({ ...prev, title: value }));
                          setTarifaTemplateDirty(true);
                        }}
                      />
                    </label>
                    <label className="filter-field">
                      <span>Subtítulo</span>
                      <input
                        type="text"
                        value={tarifaTemplate.subtitle}
                        onChange={(event) => {
                          const value = event.target.value;
                          setTarifaTemplate((prev) => ({ ...prev, subtitle: value }));
                          setTarifaTemplateDirty(true);
                        }}
                      />
                    </label>
                    <label className="filter-field">
                      <span>Título tabla</span>
                      <input
                        type="text"
                        value={tarifaTemplate.tableTitle}
                        onChange={(event) => {
                          const value = event.target.value;
                          setTarifaTemplate((prev) => ({ ...prev, tableTitle: value }));
                          setTarifaTemplateDirty(true);
                        }}
                      />
                    </label>
                    <label className="filter-field" style={{ gridColumn: '1 / -1' }}>
                      <span>Observaciones</span>
                      <textarea
                        rows={4}
                        value={tarifaTemplate.observations}
                        onChange={(event) => {
                          const value = event.target.value;
                          setTarifaTemplate((prev) => ({ ...prev, observations: value }));
                          setTarifaTemplateDirty(true);
                        }}
                      />
                    </label>
                  </div>
                  <div className="tarifa-template__table">
                    <table>
                      <thead>
                        <tr>
                          <th>Zona</th>
                          {tarifaTemplate.columns.map((col, colIndex) => (
                            <th key={`col-${colIndex}`}>
                              <input
                                type="text"
                                value={col}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setTarifaTemplate((prev) => {
                                    const next = [...prev.columns];
                                    next[colIndex] = value;
                                    return { ...prev, columns: next };
                                  });
                                  setTarifaTemplateDirty(true);
                                }}
                              />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tarifaTemplate.rows.map((row, rowIndex) => (
                          <tr key={`row-${rowIndex}`}>
                            <td>
                              <input
                                type="text"
                                value={row.label}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setTarifaTemplate((prev) => {
                                    const nextRows = prev.rows.map((item, idx) =>
                                      idx === rowIndex ? { ...item, label: value } : item
                                    );
                                    return { ...prev, rows: nextRows };
                                  });
                                  setTarifaTemplateDirty(true);
                                }}
                              />
                            </td>
                            {row.values.map((cell, colIndex) => (
                              <td key={`cell-${rowIndex}-${colIndex}`}>
                                <input
                                  type="text"
                                  value={cell}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setTarifaTemplate((prev) => {
                                      const nextRows = prev.rows.map((item, idx) => {
                                        if (idx !== rowIndex) return item;
                                        const nextValues = [...item.values];
                                        nextValues[colIndex] = value;
                                        return { ...item, values: nextValues };
                                      });
                                      return { ...prev, rows: nextRows };
                                    });
                                    setTarifaTemplateDirty(true);
                                  }}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="tarifas-filters__preview">
                {tarifaImageLoading ? (
                  <div className="tarifas-preview__placeholder">Cargando imagen...</div>
                ) : tarifaImageError ? (
                  <div className="tarifas-preview__placeholder">{tarifaImageError}</div>
                ) : tarifaUploadPreviewUrl ? (
                  <a href={tarifaUploadPreviewUrl} target="_blank" rel="noreferrer">
                    <img
                      src={tarifaUploadPreviewUrl}
                      alt="Vista previa de tarifa"
                      onError={() => setTarifaPreview(null, false)}
                    />
                  </a>
                ) : (
                  <div className="tarifas-preview__placeholder">Vista previa</div>
                )}
              </div>
            </div>
          </div>
        ) : null}
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

      setClientes((prev) => prev.filter((item) => item.id !== cliente.id));
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo eliminar el cliente.');
    } finally {
      setDeletingClienteId(null);
    }
  };

  const clienteStatsOptions = useMemo(
    () =>
      Array.from(
        new Set(
          personalStatsData
            .map((registro) => registro.cliente)
            .filter((value): value is string => Boolean(value))
        )
      ).sort(),
    [personalStatsData]
  );

  const estadoStatsOptions = useMemo(
    () =>
      Array.from(
        new Set(
          personalStatsData
            .map((registro) => registro.estado)
            .filter((value): value is string => Boolean(value))
        )
      ).sort(),
    [personalStatsData]
  );
  const agenteStatsOptions = useMemo(
    () =>
      Array.from(
        new Set(
          personalStatsData
            .map((registro) => registro.agente)
            .filter((value): value is string => Boolean(value))
        )
      ).sort(),
    [personalStatsData]
  );

  const buildMonitorUrl = useCallback(
    (teamId?: number | null) => {
      if (typeof window === 'undefined' || !showPersonalPanel) {
        return '';
      }
      const params = new URLSearchParams();
      params.set('monitor', '1');
      if (statsClienteFilter) {
        params.set('cliente', statsClienteFilter);
      }
      if (statsEstadoFilter) {
        params.set('estado', statsEstadoFilter);
      }
      if (statsAgenteFilter) {
        params.set('agente', statsAgenteFilter);
      }
      if (teamId != null) {
        params.set('team', String(teamId));
      }
      return `${window.location.origin}${location.pathname}?${params.toString()}`;
    },
    [location.pathname, showPersonalPanel, statsAgenteFilter, statsClienteFilter, statsEstadoFilter]
  );

  const monitorUrl = useMemo(() => buildMonitorUrl(monitorTeamId), [buildMonitorUrl, monitorTeamId]);

  const handleCopyMonitorLink = useCallback(async () => {
    if (!monitorUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(monitorUrl);
      setCopyMonitorState('copied');
      window.setTimeout(() => setCopyMonitorState('idle'), 2000);
    } catch {
      setCopyMonitorState('error');
      window.setTimeout(() => setCopyMonitorState('idle'), 2500);
    }
  }, [monitorUrl]);

  const handleOpenMonitorWindow = useCallback(
    (targetUrl?: string) => {
      const url = targetUrl ?? monitorUrl;
      if (!url) {
        return;
      }
      if (authUser) {
        try {
          const serialized = JSON.stringify(authUser);
          window.localStorage.setItem(AUTH_STORAGE_KEY, serialized);
          window.sessionStorage.setItem(AUTH_STORAGE_KEY, serialized);
        } catch {
          // ignore storage errors
        }
      }
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) {
        window.location.href = url;
      }
    },
    [authUser, monitorUrl]
  );

  const monitorStatusLabel = useMemo(() => {
    if (!lastStatsRefreshAt) {
      return 'Sin actualizar aún';
    }
    return `Última actualización ${lastStatsRefreshAt.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })}`;
  }, [lastStatsRefreshAt]);

  const activeMonitorTeamName = useMemo(() => {
    if (!monitorTeamId) {
      return null;
    }
    const found = teamGroups.find((team) => team.id === monitorTeamId);
    return found?.name ?? null;
  }, [monitorTeamId, teamGroups]);

  const resolvedTitle = showPersonalPanel ? 'Panel general' : (pageTitle ?? 'Gestionar clientes');
  const resolvedSubtitle = showPersonalPanel ? 'Resumen de personal y clientes' : (pageSubtitle ?? 'Gestionar clientes');

  const baseFilteredPersonal = useMemo(
    () =>
      filterPersonalRecords(
        personalStatsData,
        statsClienteFilter,
        statsEstadoFilter,
        statsAgenteFilter
      ),
    [personalStatsData, statsClienteFilter, statsEstadoFilter, statsAgenteFilter, filterPersonalRecords]
  );

  const recentAltaCounts = useMemo(() => {
    const msInDay = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const parseDateMs = (value: string | null | undefined): number | null => {
      if (!value) return null;
      const parsed = new Date(value);
      const time = parsed.getTime();
      return Number.isNaN(time) ? null : time;
    };
    return baseFilteredPersonal.reduce(
      (acc, registro) => {
        const dateMs = parseDateMs(registro.fechaAlta ?? null);
        if (dateMs === null) {
          return acc;
        }
        if (dateMs >= now - msInDay) {
          acc.day += 1;
        }
        if (dateMs >= now - msInDay * 7) {
          acc.week += 1;
        }
        if (dateMs >= now - msInDay * 30) {
          acc.month += 1;
        }
        if (dateMs >= now - msInDay * 365) {
          acc.year += 1;
        }
        return acc;
      },
      { day: 0, week: 0, month: 0, year: 0 }
    );
  }, [baseFilteredPersonal]);

  const matchesTeamMember = useCallback(
    (registro: PersonalRecord, member: TeamGroupMember) => {
      const agentId = registro.agenteId != null ? Number(registro.agenteId) : null;
      if (member.userId && agentId !== null && agentId === member.userId) {
        return true;
      }

      const targetName = (member.name ?? '').trim().toLowerCase();
      const targetEmail = (member.email ?? '').trim().toLowerCase();
      if (!targetName && !targetEmail) {
        return false;
      }

      const candidateName = (registro.agente ?? '').trim().toLowerCase();

      const nameMatches = targetName ? candidateName === targetName : false;

      // Actualmente no tenemos email del agente en el registro, pero mantenemos la comparación futura.
      const emailMatches = targetEmail ? false : false;

      return nameMatches || emailMatches;
    },
    []
  );

  const computeClientGroups = useCallback(
    (records: PersonalRecord[]) => {
      const grouped = records.reduce<Record<string, PersonalRecord[]>>((acc, registro) => {
        const key = registro.cliente ?? 'Sin cliente';
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(registro);
        return acc;
      }, {});

      return Object.entries(grouped).map(([clienteNombre, registros]) => ({
        clienteNombre,
        stats: computePersonalStats(registros),
      }));
    },
    [computePersonalStats]
  );

  const teamSections = useMemo(() => {
    if (!teamGroups || teamGroups.length === 0) {
      return [];
    }

    return teamGroups.map((team) => {
      const members = team.members ?? [];
      const teamRecords = baseFilteredPersonal.filter((registro) =>
        members.some((member) => matchesTeamMember(registro, member))
      );
      const groupStats = computePersonalStats(teamRecords);
      const clientGroups = computeClientGroups(teamRecords);
      const memberStats = members.map((member) => {
        const memberRecords = baseFilteredPersonal.filter((registro) =>
          matchesTeamMember(registro, member)
        );
        return {
          member,
          stats: computePersonalStats(memberRecords),
          clients: computeClientGroups(memberRecords),
        };
      });

      return {
        team,
        groupStats,
        clientGroups,
        memberStats,
      };
    });
  }, [teamGroups, baseFilteredPersonal, matchesTeamMember, computePersonalStats, computeClientGroups]);

  const monitorTotalSlots = monitorHasSummarySlide ? teamSections.length + 1 : teamSections.length;
  const monitorSummaryActive =
    monitorMode && monitorHasSummarySlide && monitorTotalSlots > 0 && currentCycleIndex % monitorTotalSlots === 0;

  useEffect(() => {
    if (!monitorMode || monitorTeamId || !showPersonalPanel) {
      setCycleCountdown(null);
      return undefined;
    }
    if (monitorTotalSlots === 0) {
      setCycleCountdown(null);
      return undefined;
    }
    const resetCountdown = () => setCycleCountdown(Math.round(monitorCycleIntervalMs / 1000));
    resetCountdown();
    const cycleIntervalId = window.setInterval(() => {
      setCurrentCycleIndex((prev) => {
        const next = monitorTotalSlots > 0 ? (prev + 1) % monitorTotalSlots : 0;
        return next;
      });
      resetCountdown();
    }, monitorCycleIntervalMs);
    const countdownIntervalId = window.setInterval(() => {
      setCycleCountdown((prev) => {
        if (prev == null) {
          return prev;
        }
        if (prev <= 1) {
          return Math.round(monitorCycleIntervalMs / 1000);
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(cycleIntervalId);
      window.clearInterval(countdownIntervalId);
    };
  }, [monitorMode, monitorTeamId, monitorTotalSlots, monitorCycleIntervalMs, showPersonalPanel]);

  useEffect(() => {
    if (monitorTotalSlots === 0) {
      return;
    }
    if (currentCycleIndex >= monitorTotalSlots) {
      setCurrentCycleIndex(0);
    }
  }, [monitorTotalSlots, currentCycleIndex]);

  const displayedTeamSections = useMemo(() => {
    if (monitorTeamId) {
      return teamSections.filter((section) => section.team.id === monitorTeamId);
    }
    if (monitorMode) {
      if (monitorSummaryActive) {
        return [];
      }
      if (teamSections.length === 0) {
        return [];
      }
      const baseIndex = monitorHasSummarySlide ? currentCycleIndex - 1 : currentCycleIndex;
      const index = ((baseIndex % teamSections.length) + teamSections.length) % teamSections.length;
      return [teamSections[index]];
    }
    return teamSections;
  }, [currentCycleIndex, monitorMode, monitorSummaryActive, monitorHasSummarySlide, monitorTeamId, teamSections]);

  return (
    <DashboardLayout
      title={resolvedTitle}
      subtitle={resolvedSubtitle}
      headerContent={headerContent}
      layoutVariant={showPersonalPanel ? 'panel' : 'default'}
      monitorView={monitorMode}
      >
        {showPersonalPanel ? (
          <>
          {teamShout && showTeamShoutPopup ? (
            <div className="shout-popup-overlay" role="alert">
              <div className="shout-fireworks">
                {Array.from({ length: 30 }).map((_, idx) => (
                  <span key={`fw-${idx}`} />
                ))}
              </div>
              <div className="shout-popup">
                <div className="shout-popup__confetti">
                  {Array.from({ length: 14 }).map((_, idx) => (
                    <span key={idx} />
                  ))}
                </div>
                <div className="shout-popup__content">
                  <p dangerouslySetInnerHTML={{ __html: formatTeamShout(teamShout) }} />
                </div>
                <button type="button" className="shout-popup__close" aria-label="Cerrar" onClick={() => setShowTeamShoutPopup(false)}>
                  ×
                </button>
              </div>
            </div>
          ) : null}

          {!monitorMode ? (
            <div className={`monitor-banner${monitorMode ? ' monitor-banner--active' : ''}`}>
              <div className="monitor-banner__info">
                <h3>Modo monitores</h3>
                <p>
                  Usá este link para duplicar el panel en otras pantallas. Se actualiza automáticamente cada{' '}
                  {Math.round(monitorRefreshIntervalMs / 1000)} segundos.
                </p>
                <div className="monitor-banner__meta">
                  <span>{monitorStatusLabel}</span>
                  {isSilentRefreshing ? <span className="monitor-pill">Actualizando...</span> : null}
                  {monitorMode ? <span className="monitor-pill monitor-pill--live">Monitor en vivo</span> : null}
                  {activeMonitorTeamName ? (
                    <span className="monitor-pill">Equipo: {activeMonitorTeamName}</span>
                  ) : null}
                  {monitorMode && !monitorTeamId && teamSections.length > 1 ? (
                    <span className="monitor-pill">
                      Rotando cada {Math.round(monitorCycleIntervalMs / 1000)}s
                      {cycleCountdown != null ? ` · siguiente en ${cycleCountdown}s` : ''}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="monitor-banner__actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => handleOpenMonitorWindow()}
                  disabled={!monitorUrl}
                >
                  Abrir en otra ventana
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={handleCopyMonitorLink}
                  disabled={!monitorUrl}
                >
                  {copyMonitorState === 'copied'
                    ? 'Link copiado'
                    : copyMonitorState === 'error'
                      ? 'No se pudo copiar'
                      : 'Copiar link'}
                </button>
                <small className="monitor-banner__hint">
                  Compartí el enlace en cada monitor para mostrar este panel sin menús ni edición.
                </small>
              </div>
            </div>
          ) : null}

          <PersonalRadarPanel
            monitorMode={monitorMode}
            monitorSummaryActive={monitorSummaryActive}
            statsLoading={statsLoading}
            statsError={statsError}
            personalStats={personalStats}
            statsClienteFilter={statsClienteFilter}
            statsEstadoFilter={statsEstadoFilter}
            statsAgenteFilter={statsAgenteFilter}
            setStatsClienteFilter={setStatsClienteFilter}
            setStatsEstadoFilter={setStatsEstadoFilter}
            setStatsAgenteFilter={setStatsAgenteFilter}
            clienteStatsOptions={clienteStatsOptions}
            estadoStatsOptions={estadoStatsOptions}
            agenteStatsOptions={agenteStatsOptions}
            baseFilteredPersonal={baseFilteredPersonal}
            computePersonalStats={computePersonalStats}
          />

          <PersonalTeamsPanel
            monitorMode={monitorMode}
            statsLoading={statsLoading}
            personalStats={personalStats}
            showRecentAltaPanel={showRecentAltaPanel}
            setShowRecentAltaPanel={setShowRecentAltaPanel}
            recentAltaCounts={recentAltaCounts}
            reclamoStats={reclamoStats}
            reclamoStatsLoading={reclamoStatsLoading}
            reclamoStatsError={reclamoStatsError}
            teamLoading={teamLoading}
            teamError={teamError}
            teamInfo={teamInfo}
            teamGroups={teamGroups}
            usersOptions={usersOptions}
            usersLoading={usersLoading}
            usersError={usersError}
            editingTeamId={editingTeamId}
            editingTeamName={editingTeamName}
            setEditingTeamName={setEditingTeamName}
            editingTeamColor={editingTeamColor}
            setEditingTeamColor={setEditingTeamColor}
            editingMembers={editingMembers}
            resetTeamForm={resetTeamForm}
            populateTeamForm={populateTeamForm}
            addEmptyMember={addEmptyMember}
            updateMemberField={updateMemberField}
            handleMemberSelect={handleMemberSelect}
            removeMember={removeMember}
            handleSaveTeam={handleSaveTeam}
            handleDeleteTeam={handleDeleteTeam}
            savingTeam={savingTeam}
            deletingTeam={deletingTeam}
            teamSectionsCount={teamSections.length}
            displayedTeamSections={displayedTeamSections}
            buildMonitorUrl={buildMonitorUrl}
            handleOpenMonitorWindow={handleOpenMonitorWindow}
          />
        </>
      ) : null}

      {!showPersonalPanel && isTarifasView && tarifaView === 'list' ? (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Sucursal</th>
                  <th>Mes</th>
                  <th>Año</th>
                  <th>Porte</th>
                  <th>Archivo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tarifaListLoading && (
                  <tr>
                    <td colSpan={7}>Cargando tarifas...</td>
                  </tr>
                )}
                {tarifaListError && !tarifaListLoading && (
                  <tr>
                    <td colSpan={7} className="error-cell">
                      {tarifaListError}
                    </td>
                  </tr>
                )}
                {!tarifaListLoading && !tarifaListError && tarifaList.length === 0 && (
                  <tr>
                    <td colSpan={7}>No hay tarifas para mostrar.</td>
                  </tr>
                )}
                {!tarifaListLoading &&
                  !tarifaListError &&
                  tarifaList.map((item) => {
                    const displayUrl = resolveTarifaDisplayUrl(item);
                    const monthLabel = item.mes ? monthLabelLookup.get(String(item.mes)) ?? String(item.mes) : '—';
                    const porteLabel = item.tipo ? porteLabelLookup.get(item.tipo) ?? item.tipo : '—';
                    return (
                      <tr key={item.id}>
                        <td>{item.clienteNombre ?? '—'}</td>
                        <td>{item.sucursalNombre ?? '—'}</td>
                        <td>{monthLabel}</td>
                        <td>{item.anio ?? '—'}</td>
                        <td>{porteLabel}</td>
                        <td>{item.nombreOriginal ?? '—'}</td>
                        <td>
                          <div className="action-buttons">
                            <button
                              type="button"
                              aria-label="Ver tarifa"
                              onClick={() => {
                                if (displayUrl) {
                                  setTarifaModalUrl(displayUrl);
                                  setTarifaModalTitle(item.nombreOriginal ?? 'Tarifa');
                                }
                              }}
                              disabled={!displayUrl}
                            >
                              👁️
                            </button>
                            <button
                              type="button"
                              aria-label="Descargar tarifa"
                              onClick={() => {
                                if (!displayUrl) {
                                  return;
                                }
                                const link = document.createElement('a');
                                link.href = displayUrl;
                                link.download = item.nombreOriginal ?? `tarifa-${item.id}`;
                                link.rel = 'noopener';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              disabled={!displayUrl}
                            >
                              ⬇️
                            </button>
                            <button
                              type="button"
                              aria-label="Eliminar tarifa"
                              onClick={async () => {
                                if (!window.confirm('¿Eliminar esta tarifa?')) {
                                  return;
                                }
                                try {
                                  setTarifaDeleteId(item.id);
                                  const response = await fetch(`${apiBaseUrl}/api/tarifas/imagen/${item.id}`, {
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
                                  setTarifaList((prev) => prev.filter((row) => row.id !== item.id));
                                } catch (err) {
                                  window.alert((err as Error).message ?? 'No se pudo eliminar la tarifa.');
                                } finally {
                                  setTarifaDeleteId(null);
                                }
                              }}
                              disabled={tarifaDeleteId === item.id}
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
            <span>
              {tarifaListLoading
                ? 'Cargando tarifas...'
                : `Mostrando ${tarifaList.length} tarifa${tarifaList.length === 1 ? '' : 's'}`}
            </span>
            <div className="pagination">
              <button disabled aria-label="Anterior">
                ‹
              </button>
              <button disabled aria-label="Siguiente">
                ›
              </button>
            </div>
          </footer>
          {tarifaModalUrl ? (
            <div className="tarifa-modal" role="dialog" aria-modal="true">
              <div className="tarifa-modal__backdrop" onClick={() => setTarifaModalUrl(null)} />
              <div className="tarifa-modal__content">
                <div className="tarifa-modal__header">
                  <h3>{tarifaModalTitle ?? 'Tarifa'}</h3>
                  <button type="button" onClick={() => setTarifaModalUrl(null)} aria-label="Cerrar">
                    ✕
                  </button>
                </div>
                <div className="tarifa-modal__body">
                  <img src={tarifaModalUrl} alt={tarifaModalTitle ?? 'Tarifa'} />
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {!showPersonalPanel && isBasesView ? (
        <>
          {loading ? <p className="form-info">Cargando clientes...</p> : null}
          {error ? <p className="form-info form-info--error">{error}</p> : null}
          {!loading && !error && filteredClientes.length === 0 ? (
            <p className="form-info">No hay clientes para mostrar.</p>
          ) : null}
          {!loading && !error && filteredClientes.length > 0 ? (
            <div className="client-cards client-cards--bases">
              {filteredClientes.map((cliente) => {
                return (
                  <button
                    key={cliente.id}
                    type="button"
                    className="client-card client-card--base client-card--link"
                    onClick={() => navigate(`/bases-distribucion/${cliente.id}`)}
                    aria-label={`Ver sucursales de ${cliente.nombre ?? `Cliente ${cliente.id}`}`}
                  >
                    <h4>{cliente.nombre ?? `Cliente #${cliente.id}`}</h4>
                  </button>
                );
              })}
            </div>
          ) : null}
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
        </>
      ) : null}

      {!showPersonalPanel && !isTarifasView && !isBasesView ? (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {isTarifasView ? (
                    <>
                      <th>Nombre</th>
                      <th>Acciones</th>
                    </>
                  ) : (
                    <>
                      <th>Código</th>
                      <th>Nombre</th>
                      <th>CUIT</th>
                      <th>Dirección</th>
                      <th>Sucursales</th>
                      <th>Acciones</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={clienteTableColCount}>Cargando clientes...</td>
                  </tr>
                )}

                {error && !loading && (
                  <tr>
                    <td colSpan={clienteTableColCount} className="error-cell">
                      {error}
                    </td>
                  </tr>
                )}

                {!loading && !error && filteredClientes.length === 0 && (
                  <tr>
                    <td colSpan={clienteTableColCount}>No hay clientes para mostrar.</td>
                  </tr>
                )}

                {!loading &&
                  !error &&
                  filteredClientes.map((cliente) => (
                    <tr key={cliente.id}>
                      {isTarifasView ? (
                        <>
                          <td>{cliente.nombre ?? '—'}</td>
                          <td>
                            <div className="action-buttons">
                              <button
                                type="button"
                                aria-label={`Editar cliente ${cliente.nombre ?? ''}`}
                                onClick={() => navigate(`/clientes/${cliente.id}/editar`)}
                              >
                                ✏️
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{cliente.codigo ?? '—'}</td>
                          <td>{cliente.nombre ?? '—'}</td>
                          <td>{cliente.documento_fiscal ?? '—'}</td>
                          <td>{cliente.direccion ?? '—'}</td>
                          <td>
                            {cliente.sucursales.length > 0 ? (
                              <div className="tag-list">
                                {cliente.sucursales.map((sucursal) => (
                                  <span key={`${cliente.id}-${sucursal.id ?? uniqueKey()}`} className="tag">
                                    {sucursal.nombre ?? 'Sucursal'} -{' '}
                                    {sucursal.direccion ?? 'Sin direccion'}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              '—'
                            )}
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
                        </>
                      )}
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
        </>
      ) : null}
    </DashboardLayout>
  );
};

type DistriappResumen = {
  clientesTotal: number;
  unidadesTotal: number;
  proveedoresTotal: number;
  proveedoresActivos: number;
  reclamosAbiertos: number;
  combustibleReportesPendientes: number;
  updatedAt?: string | null;
};

type DistriappMobileModule = {
  key: string;
  title: string;
  status: 'connected' | 'error' | 'not_configured';
  count: number | null;
  error?: string | null;
};

type DistriappLiveTrackingItem = {
  driverName: string;
  unitPatent: string;
  lat: number;
  lng: number;
  recordedAt?: string | null;
};

type DistriappRankingItem = {
  position: number;
  driverName: string;
  score: number;
  trips: number;
};

type DistriappMobileOverview = {
  configured: boolean;
  message?: string | null;
  month: number;
  year: number;
  modules: DistriappMobileModule[];
  liveTracking: {
    available: boolean;
    count: number;
    items: DistriappLiveTrackingItem[];
    error?: string | null;
    sourceEndpoint?: string | null;
  };
  rankingPreview: DistriappRankingItem[];
  updatedAt?: string | null;
};

type DistriappAdminOrderItem = {
  id?: number | string | null;
  driverName: string;
  receiver: string;
  phone: string;
  locationName: string;
  status: string;
  createdAt?: string | null;
  deliveredAt?: string | null;
};

type DistriappAdminDriverLocationItem = {
  driverId?: number | string | null;
  driverName: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  recordedAt?: string | null;
};

type DistriappModuleData<T> = {
  configured: boolean;
  module: string;
  count: number;
  items: T[];
  message?: string | null;
  updatedAt?: string | null;
  month?: number;
  year?: number;
  from?: string | null;
  to?: string | null;
};

const formatDistriappTimestamp = (value?: string | null): string => {
  if (!value) {
    return 'Sin sincronización reciente';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Sin sincronización reciente';
  }

  return date.toLocaleString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const formatDistriappOptionalTimestamp = (value?: string | null): string => {
  if (!value) {
    return '—';
  }
  return formatDistriappTimestamp(value);
};

const parseMonthInput = (monthInput: string): { year: number; month: number } | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(monthInput);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
};

const currentMonthInput = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const currentDateInput = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const firstDateOfCurrentMonthInput = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

const toIsoBoundary = (dateValue: string, endOfDay = false): string | null => {
  if (!dateValue) {
    return null;
  }
  const date = new Date(`${dateValue}T${endOfDay ? '23:59:59' : '00:00:00'}`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};

const getDistriappModuleStatusLabel = (status: DistriappMobileModule['status']): string => {
  switch (status) {
    case 'connected':
      return 'Conectado';
    case 'error':
      return 'Con error';
    case 'not_configured':
    default:
      return 'Sin configurar';
  }
};

const getDistriappModuleStatusClass = (status: DistriappMobileModule['status']): string => {
  switch (status) {
    case 'connected':
      return 'is-connected';
    case 'error':
      return 'is-error';
    case 'not_configured':
    default:
      return 'is-pending';
  }
};

const DistriappHubPage: React.FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const legacyAdminUrl = useMemo(() => resolveDistriappLegacyAdminUrl(), []);
  const authUser = useStoredAuthUser();
  const userRole = useMemo(() => getUserRole(authUser), [authUser]);
  const [resumen, setResumen] = useState<DistriappResumen | null>(null);
  const [mobileOverview, setMobileOverview] = useState<DistriappMobileOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchHub = async () => {
      try {
        setLoading(true);
        setError(null);

        const [resumenResponse, mobileResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/distriapp/resumen`, { signal: controller.signal }),
          fetch(`${apiBaseUrl}/api/distriapp/mobile/overview`, { signal: controller.signal }),
        ]);

        if (!resumenResponse.ok) {
          throw new Error(`Error ${resumenResponse.status}: ${resumenResponse.statusText}`);
        }

        const resumenPayload = (await parseJsonSafe(resumenResponse)) as {
          data?: Partial<DistriappResumen>;
        };

        setResumen({
          clientesTotal: Number(resumenPayload?.data?.clientesTotal ?? 0),
          unidadesTotal: Number(resumenPayload?.data?.unidadesTotal ?? 0),
          proveedoresTotal: Number(resumenPayload?.data?.proveedoresTotal ?? 0),
          proveedoresActivos: Number(resumenPayload?.data?.proveedoresActivos ?? 0),
          reclamosAbiertos: Number(resumenPayload?.data?.reclamosAbiertos ?? 0),
          combustibleReportesPendientes: Number(resumenPayload?.data?.combustibleReportesPendientes ?? 0),
          updatedAt: resumenPayload?.data?.updatedAt ?? null,
        });

        if (mobileResponse.ok) {
          const mobilePayload = (await parseJsonSafe(mobileResponse)) as {
            data?: Partial<DistriappMobileOverview>;
          };

          setMobileOverview({
            configured: Boolean(mobilePayload?.data?.configured),
            message: mobilePayload?.data?.message ?? null,
            month: Number(mobilePayload?.data?.month ?? new Date().getMonth() + 1),
            year: Number(mobilePayload?.data?.year ?? new Date().getFullYear()),
            modules: Array.isArray(mobilePayload?.data?.modules)
              ? (mobilePayload?.data?.modules as DistriappMobileModule[])
              : [],
            liveTracking: {
              available: Boolean(mobilePayload?.data?.liveTracking?.available),
              count: Number(mobilePayload?.data?.liveTracking?.count ?? 0),
              items: Array.isArray(mobilePayload?.data?.liveTracking?.items)
                ? (mobilePayload?.data?.liveTracking?.items as DistriappLiveTrackingItem[])
                : [],
              error: mobilePayload?.data?.liveTracking?.error ?? null,
              sourceEndpoint: mobilePayload?.data?.liveTracking?.sourceEndpoint ?? null,
            },
            rankingPreview: Array.isArray(mobilePayload?.data?.rankingPreview)
              ? (mobilePayload?.data?.rankingPreview as DistriappRankingItem[])
              : [],
            updatedAt: mobilePayload?.data?.updatedAt ?? null,
          });
        } else {
          setMobileOverview({
            configured: false,
            message: `No se pudo consultar la integración mobile (${mobileResponse.status}).`,
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            modules: [],
            liveTracking: {
              available: false,
              count: 0,
              items: [],
              error: 'Sin conexión',
              sourceEndpoint: null,
            },
            rankingPreview: [],
            updatedAt: null,
          });
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setError((err as Error).message ?? 'No se pudo cargar el resumen de Distriapp.');
        setMobileOverview({
          configured: false,
          message: 'No se pudo consultar la integración de la app móvil.',
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
          modules: [],
          liveTracking: {
            available: false,
            count: 0,
            items: [],
            error: 'Sin conexión',
            sourceEndpoint: null,
          },
          rankingPreview: [],
          updatedAt: null,
        });
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void fetchHub();
    return () => controller.abort();
  }, [apiBaseUrl]);

  const shortcuts = useMemo(
    () =>
      [
        {
          key: 'monitoreo-live',
          title: 'Ruteo en tiempo real',
          description: 'Posición y último reporte de cada transportista.',
          path: '/distriapp/monitoreo',
          section: 'distriapp' as AccessSection,
        },
        {
          key: 'urban-distribution',
          title: 'Distribución urbana',
          description: 'Órdenes del mes por conductor, estado y entrega.',
          path: '/distriapp/distribucion-urbana',
          section: 'distriapp' as AccessSection,
        },
        {
          key: 'journeys-admin',
          title: 'Viajes',
          description: 'Listado de viajes con filtros por rango de fecha.',
          path: '/distriapp/viajes',
          section: 'distriapp' as AccessSection,
        },
        {
          key: 'driver-locations-admin',
          title: 'Ubic. repartidores',
          description: 'Última ubicación reportada por cada conductor.',
          path: '/distriapp/ubic-repartidores',
          section: 'distriapp' as AccessSection,
        },
        {
          key: 'proveedores',
          title: 'Proveedores',
          description: 'Alta, edición, documentación y estado.',
          path: '/personal',
          section: 'personal' as AccessSection,
        },
        {
          key: 'unidades',
          title: 'Unidades',
          description: 'Gestión de flota, dominio y datos técnicos.',
          path: '/unidades',
          section: 'unidades' as AccessSection,
        },
        {
          key: 'reclamos',
          title: 'Reclamos',
          description: 'Seguimiento y resolución de casos.',
          path: '/reclamos',
          section: 'reclamos' as AccessSection,
        },
        {
          key: 'liquidaciones',
          title: 'Liquidaciones',
          description: 'Control de estados, envío y validación.',
          path: '/liquidaciones',
          section: 'liquidaciones' as AccessSection,
        },
        {
          key: 'combustible',
          title: 'Combustible',
          description: 'Reportes, pendientes y cierres mensuales.',
          path: '/combustible',
          section: 'combustible' as AccessSection,
        },
        {
          key: 'auditoria',
          title: 'Auditoría',
          description: 'Trazabilidad de acciones por usuario.',
          path: '/auditoria',
          section: 'auditoria' as AccessSection,
        },
      ] as Array<{ key: string; title: string; description: string; path: string; section: AccessSection }>,
    []
  );

  const visibleShortcuts = useMemo(
    () => shortcuts.filter((item) => canAccessSection(userRole, item.section, authUser?.permissions)),
    [shortcuts, userRole, authUser?.permissions]
  );

  const updatedAtLabel = useMemo(() => formatDistriappTimestamp(resumen?.updatedAt), [resumen?.updatedAt]);
  const mobileUpdatedAtLabel = useMemo(
    () => formatDistriappTimestamp(mobileOverview?.updatedAt),
    [mobileOverview?.updatedAt]
  );
  const mobileModules = mobileOverview?.modules ?? [];
  const mobileConfigured = Boolean(mobileOverview?.configured);

  useEffect(() => {
    if (!legacyAdminUrl) {
      return;
    }
    window.location.href = legacyAdminUrl;
  }, [legacyAdminUrl]);

  if (legacyAdminUrl) {
    return (
      <DashboardLayout title="Distriapp Admin" subtitle="Abriendo admin legacy de Distriapp">
        <section className="dashboard-card">
          <p className="form-info">Redirigiendo al admin legacy...</p>
          <a href={legacyAdminUrl}>Abrir manualmente</a>
        </section>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Distriapp Admin"
      subtitle="Menú operativo para administrar módulos de la aplicación Distriapp"
    >
      <section className="dashboard-card">
        <header className="card-header">
          <div>
            <h3>Resumen operativo</h3>
            <p className="form-info">Última actualización: {updatedAtLabel}</p>
          </div>
          <button type="button" className="secondary-action" onClick={() => navigate('/dashboard')}>
            Ver panel general
          </button>
        </header>

        {loading ? <p className="form-info">Cargando métricas de Distriapp...</p> : null}
        {error ? <p className="form-info form-info--error">{error}</p> : null}

        {!loading && !error ? (
          <div className="distriapp-kpi-grid">
            <article className="distriapp-kpi">
              <span className="distriapp-kpi__label">Clientes</span>
              <strong className="distriapp-kpi__value">{resumen?.clientesTotal ?? 0}</strong>
            </article>
            <article className="distriapp-kpi">
              <span className="distriapp-kpi__label">Unidades</span>
              <strong className="distriapp-kpi__value">{resumen?.unidadesTotal ?? 0}</strong>
            </article>
            <article className="distriapp-kpi">
              <span className="distriapp-kpi__label">Proveedores</span>
              <strong className="distriapp-kpi__value">{resumen?.proveedoresTotal ?? 0}</strong>
            </article>
            <article className="distriapp-kpi">
              <span className="distriapp-kpi__label">Proveedores activos</span>
              <strong className="distriapp-kpi__value">{resumen?.proveedoresActivos ?? 0}</strong>
            </article>
            <article className="distriapp-kpi">
              <span className="distriapp-kpi__label">Reclamos abiertos</span>
              <strong className="distriapp-kpi__value">{resumen?.reclamosAbiertos ?? 0}</strong>
            </article>
            <article className="distriapp-kpi">
              <span className="distriapp-kpi__label">Reportes combustible pendientes</span>
              <strong className="distriapp-kpi__value">{resumen?.combustibleReportesPendientes ?? 0}</strong>
            </article>
          </div>
        ) : null}
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <div>
            <h3>Integración app móvil</h3>
            <p className="form-info">Última sincronización mobile: {mobileUpdatedAtLabel}</p>
          </div>
          <button type="button" className="secondary-action" onClick={() => navigate('/distriapp/monitoreo')}>
            Ver ruteo en vivo
          </button>
        </header>

        {!mobileConfigured ? (
          <p className="form-info form-info--error">
            {mobileOverview?.message ?? 'Sin integración activa con la API móvil.'}
          </p>
        ) : null}

        <div className="distriapp-mobile-modules">
          {mobileModules.length === 0 ? (
            <p className="form-info">No hay módulos mobile disponibles para mostrar.</p>
          ) : (
            mobileModules.map((module) => (
              <article key={module.key} className="distriapp-mobile-module">
                <div className="distriapp-mobile-module__header">
                  <strong>{module.title}</strong>
                  <span
                    className={`distriapp-status-pill ${getDistriappModuleStatusClass(module.status)}`}
                  >
                    {getDistriappModuleStatusLabel(module.status)}
                  </span>
                </div>
                <p className="distriapp-mobile-module__count">
                  {module.count == null ? 'Sin dato' : `${module.count} registros`}
                </p>
                {module.error ? <p className="form-info form-info--error">{module.error}</p> : null}
              </article>
            ))
          )}
        </div>

        <div className="distriapp-inline-metrics">
          <span>
            Tracking activo: <strong>{mobileOverview?.liveTracking?.available ? 'Sí' : 'No'}</strong>
          </span>
          <span>
            Unidades con señal: <strong>{mobileOverview?.liveTracking?.count ?? 0}</strong>
          </span>
        </div>
        {mobileOverview?.liveTracking?.error ? (
          <p className="form-info form-info--error">{mobileOverview.liveTracking.error}</p>
        ) : null}
      </section>

      {mobileOverview?.rankingPreview?.length ? (
        <section className="dashboard-card">
          <header className="card-header">
            <h3>Ranking (preview)</h3>
          </header>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Puesto</th>
                  <th>Conductor</th>
                  <th>Puntaje</th>
                  <th>Viajes</th>
                </tr>
              </thead>
              <tbody>
                {mobileOverview.rankingPreview.map((item) => (
                  <tr key={`${item.position}-${item.driverName}`}>
                    <td>{item.position}</td>
                    <td>{item.driverName}</td>
                    <td>{item.score}</td>
                    <td>{item.trips}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="dashboard-card">
        <header className="card-header">
          <h3>Módulos Distriapp</h3>
        </header>
        {visibleShortcuts.length === 0 ? (
          <p className="form-info">No tenés módulos de Distriapp habilitados.</p>
        ) : (
          <div className="distriapp-shortcuts-grid">
            {visibleShortcuts.map((item) => (
              <button
                key={item.key}
                type="button"
                className="distriapp-shortcut"
                onClick={() => navigate(item.path)}
              >
                <span className="distriapp-shortcut__title">{item.title}</span>
                <span className="distriapp-shortcut__description">{item.description}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </DashboardLayout>
  );
};

const DistriappLiveTrackingPage: React.FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [overview, setOverview] = useState<DistriappMobileOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(
    async (options?: { signal?: AbortSignal; silent?: boolean }) => {
      const signal = options?.signal;
      const silent = options?.silent ?? false;

      try {
        if (!silent) {
          setRefreshing(true);
        }
        setError(null);

        const response = await fetch(`${apiBaseUrl}/api/distriapp/mobile/overview`, { signal });
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await parseJsonSafe(response)) as {
          data?: Partial<DistriappMobileOverview>;
        };

        setOverview({
          configured: Boolean(payload?.data?.configured),
          message: payload?.data?.message ?? null,
          month: Number(payload?.data?.month ?? new Date().getMonth() + 1),
          year: Number(payload?.data?.year ?? new Date().getFullYear()),
          modules: Array.isArray(payload?.data?.modules) ? (payload?.data?.modules as DistriappMobileModule[]) : [],
          liveTracking: {
            available: Boolean(payload?.data?.liveTracking?.available),
            count: Number(payload?.data?.liveTracking?.count ?? 0),
            items: Array.isArray(payload?.data?.liveTracking?.items)
              ? (payload?.data?.liveTracking?.items as DistriappLiveTrackingItem[])
              : [],
            error: payload?.data?.liveTracking?.error ?? null,
            sourceEndpoint: payload?.data?.liveTracking?.sourceEndpoint ?? null,
          },
          rankingPreview: Array.isArray(payload?.data?.rankingPreview)
            ? (payload?.data?.rankingPreview as DistriappRankingItem[])
            : [],
          updatedAt: payload?.data?.updatedAt ?? null,
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setError((err as Error).message ?? 'No se pudo cargar el monitoreo en vivo.');
      } finally {
        setLoading(false);
        if (!silent) {
          setRefreshing(false);
        }
      }
    },
    [apiBaseUrl]
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void fetchOverview({ signal: controller.signal, silent: true });

    const intervalId = window.setInterval(() => {
      void fetchOverview({ silent: true });
    }, 45000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [fetchOverview]);

  const liveItems = overview?.liveTracking?.items ?? [];
  const updatedAtLabel = formatDistriappTimestamp(overview?.updatedAt);

  return (
    <DashboardLayout
      title="Ruteo En Vivo"
      subtitle="Seguimiento operativo de transportistas desde el admin Distriapp"
    >
      <section className="dashboard-card">
        <header className="card-header">
          <div>
            <h3>Monitoreo en tiempo real</h3>
            <p className="form-info">Última sincronización: {updatedAtLabel}</p>
          </div>
          <div className="distriapp-live-actions">
            <button type="button" className="secondary-action" onClick={() => navigate('/distriapp')}>
              Volver al centro
            </button>
            <button type="button" className="secondary-action" onClick={() => void fetchOverview()} disabled={refreshing}>
              {refreshing ? 'Actualizando...' : 'Actualizar ahora'}
            </button>
          </div>
        </header>

        {loading ? <p className="form-info">Cargando posiciones...</p> : null}
        {error ? <p className="form-info form-info--error">{error}</p> : null}

        {!overview?.configured ? (
          <p className="form-info form-info--error">
            {overview?.message ?? 'Configurá DISTRIAPP_MOBILE_API_URL y DISTRIAPP_MOBILE_API_TOKEN para activar tracking.'}
          </p>
        ) : null}

        <div className="distriapp-inline-metrics">
          <span>
            Tracking disponible: <strong>{overview?.liveTracking?.available ? 'Sí' : 'No'}</strong>
          </span>
          <span>
            Transportistas con señal: <strong>{overview?.liveTracking?.count ?? 0}</strong>
          </span>
          {overview?.liveTracking?.sourceEndpoint ? (
            <span>
              Endpoint: <code>{overview.liveTracking.sourceEndpoint}</code>
            </span>
          ) : null}
        </div>
        {overview?.liveTracking?.error ? <p className="form-info form-info--error">{overview.liveTracking.error}</p> : null}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Conductor</th>
                <th>Unidad</th>
                <th>Lat</th>
                <th>Lng</th>
                <th>Última señal</th>
                <th>Mapa</th>
              </tr>
            </thead>
            <tbody>
              {liveItems.length === 0 ? (
                <tr>
                  <td colSpan={6}>No hay posiciones activas disponibles.</td>
                </tr>
              ) : (
                liveItems.map((item, index) => {
                  const mapUrl = `https://www.google.com/maps?q=${item.lat},${item.lng}`;
                  return (
                    <tr key={`${item.driverName}-${item.unitPatent}-${index}`}>
                      <td>{item.driverName}</td>
                      <td>{item.unitPatent}</td>
                      <td>{item.lat.toFixed(6)}</td>
                      <td>{item.lng.toFixed(6)}</td>
                      <td>{formatDistriappTimestamp(item.recordedAt)}</td>
                      <td>
                        <a href={mapUrl} target="_blank" rel="noreferrer">
                          Ver
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
};

const fetchDistriappModule = async <T,>(
  apiBaseUrl: string,
  module: 'urban-distribution' | 'journeys' | 'driver-locations',
  params?: Record<string, string | number | null | undefined>,
  signal?: AbortSignal
): Promise<DistriappModuleData<T>> => {
  const searchParams = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || `${value}`.trim().length === 0) {
      return;
    }
    searchParams.set(key, `${value}`);
  });
  const qs = searchParams.toString();
  const url = `${apiBaseUrl}/api/distriapp/mobile/module/${module}${qs ? `?${qs}` : ''}`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }

  const payload = (await parseJsonSafe(response)) as {
    data?: Partial<DistriappModuleData<T>>;
  };

  return {
    configured: Boolean(payload?.data?.configured),
    module: payload?.data?.module ?? module,
    count: Number(payload?.data?.count ?? 0),
    items: Array.isArray(payload?.data?.items) ? (payload?.data?.items as T[]) : [],
    message: payload?.data?.message ?? null,
    updatedAt: payload?.data?.updatedAt ?? null,
    month: payload?.data?.month != null ? Number(payload?.data?.month) : undefined,
    year: payload?.data?.year != null ? Number(payload?.data?.year) : undefined,
    from: payload?.data?.from ?? null,
    to: payload?.data?.to ?? null,
  };
};

const DistriappUrbanDistributionPage: React.FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [monthInput, setMonthInput] = useState(currentMonthInput);
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<DistriappAdminOrderItem[]>([]);
  const [configured, setConfigured] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(
    async (options?: { signal?: AbortSignal; silent?: boolean }) => {
      const silent = options?.silent ?? false;
      const parsed = parseMonthInput(monthInput);
      if (!parsed) {
        setError('Mes inválido. Usá formato YYYY-MM.');
        return;
      }

      try {
        if (!silent) {
          setRefreshing(true);
        }
        setError(null);
        const data = await fetchDistriappModule<DistriappAdminOrderItem>(
          apiBaseUrl,
          'urban-distribution',
          { month: parsed.month, year: parsed.year },
          options?.signal
        );
        setConfigured(data.configured);
        setMessage(data.message ?? null);
        setItems(data.items);
        setUpdatedAt(data.updatedAt ?? null);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setError((err as Error).message ?? 'No se pudo cargar Distribución urbana.');
      } finally {
        setLoading(false);
        if (!silent) {
          setRefreshing(false);
        }
      }
    },
    [apiBaseUrl, monthInput]
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void loadData({ signal: controller.signal, silent: true });
    return () => controller.abort();
  }, [loadData]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return items;
    }
    return items.filter((item) =>
      [item.driverName, item.receiver, item.phone, item.locationName, item.status]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [items, searchTerm]);

  return (
    <DashboardLayout
      title="Distribución Urbana"
      subtitle="Módulo legacy Distriapp integrado en el admin de apppersonal"
    >
      <section className="dashboard-card">
        <header className="card-header">
          <div>
            <h3>Órdenes del mes</h3>
            <p className="form-info">Última actualización: {formatDistriappTimestamp(updatedAt)}</p>
          </div>
          <div className="distriapp-live-actions">
            <button type="button" className="secondary-action" onClick={() => navigate('/distriapp')}>
              Volver al centro
            </button>
            <button type="button" className="secondary-action" onClick={() => void loadData()} disabled={refreshing}>
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </header>

        <div className="distriapp-filters-row">
          <label className="input-control">
            <span>Mes</span>
            <input type="month" value={monthInput} onChange={(event) => setMonthInput(event.target.value)} />
          </label>
          <label className="input-control">
            <span>Buscar</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Conductor, receptor, estado..."
            />
          </label>
        </div>

        {!configured ? <p className="form-info form-info--error">{message ?? 'Integración no configurada.'}</p> : null}
        {loading ? <p className="form-info">Cargando distribución urbana...</p> : null}
        {error ? <p className="form-info form-info--error">{error}</p> : null}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Conductor</th>
                <th>Receptor</th>
                <th>Teléfono</th>
                <th>Dirección</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Entrega</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7}>No hay órdenes para los filtros seleccionados.</td>
                </tr>
              ) : (
                filteredItems.map((item, index) => (
                  <tr key={`${item.id ?? 'order'}-${index}`}>
                    <td>{item.driverName || 'S/D'}</td>
                    <td>{item.receiver || 'S/D'}</td>
                    <td>{item.phone || 'S/D'}</td>
                    <td>{item.locationName || 'S/D'}</td>
                    <td>{item.status || 'S/D'}</td>
                    <td>{formatDistriappOptionalTimestamp(item.createdAt)}</td>
                    <td>{formatDistriappOptionalTimestamp(item.deliveredAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
};

const DistriappJourneysPage: React.FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [fromDate, setFromDate] = useState(firstDateOfCurrentMonthInput);
  const [toDate, setToDate] = useState(currentDateInput);
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<DistriappAdminOrderItem[]>([]);
  const [configured, setConfigured] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(
    async (options?: { signal?: AbortSignal; silent?: boolean }) => {
      const silent = options?.silent ?? false;
      const fromIso = toIsoBoundary(fromDate, false);
      const toIso = toIsoBoundary(toDate, true);

      try {
        if (!silent) {
          setRefreshing(true);
        }
        setError(null);
        const data = await fetchDistriappModule<DistriappAdminOrderItem>(
          apiBaseUrl,
          'journeys',
          { from: fromIso, to: toIso },
          options?.signal
        );
        setConfigured(data.configured);
        setMessage(data.message ?? null);
        setItems(data.items);
        setUpdatedAt(data.updatedAt ?? null);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setError((err as Error).message ?? 'No se pudo cargar Viajes.');
      } finally {
        setLoading(false);
        if (!silent) {
          setRefreshing(false);
        }
      }
    },
    [apiBaseUrl, fromDate, toDate]
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void loadData({ signal: controller.signal, silent: true });
    return () => controller.abort();
  }, [loadData]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return items;
    }
    return items.filter((item) =>
      [item.driverName, item.locationName, item.status, item.receiver].join(' ').toLowerCase().includes(term)
    );
  }, [items, searchTerm]);

  return (
    <DashboardLayout title="Viajes" subtitle="Vista admin conectada al módulo legacy de viajes">
      <section className="dashboard-card">
        <header className="card-header">
          <div>
            <h3>Listado de viajes</h3>
            <p className="form-info">Última actualización: {formatDistriappTimestamp(updatedAt)}</p>
          </div>
          <div className="distriapp-live-actions">
            <button type="button" className="secondary-action" onClick={() => navigate('/distriapp')}>
              Volver al centro
            </button>
            <button type="button" className="secondary-action" onClick={() => void loadData()} disabled={refreshing}>
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </header>

        <div className="distriapp-filters-row">
          <label className="input-control">
            <span>Desde</span>
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label className="input-control">
            <span>Hasta</span>
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
          <label className="input-control">
            <span>Buscar</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Conductor, dirección, estado..."
            />
          </label>
        </div>

        {!configured ? <p className="form-info form-info--error">{message ?? 'Integración no configurada.'}</p> : null}
        {loading ? <p className="form-info">Cargando viajes...</p> : null}
        {error ? <p className="form-info form-info--error">{error}</p> : null}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Conductor</th>
                <th>Destino</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Entrega</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5}>No hay viajes para los filtros seleccionados.</td>
                </tr>
              ) : (
                filteredItems.map((item, index) => (
                  <tr key={`${item.id ?? 'journey'}-${index}`}>
                    <td>{item.driverName || 'S/D'}</td>
                    <td>{item.locationName || 'S/D'}</td>
                    <td>{item.status || 'S/D'}</td>
                    <td>{formatDistriappOptionalTimestamp(item.createdAt)}</td>
                    <td>{formatDistriappOptionalTimestamp(item.deliveredAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
};

const DistriappDriversLocationPage: React.FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<DistriappAdminDriverLocationItem[]>([]);
  const [configured, setConfigured] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(
    async (options?: { signal?: AbortSignal; silent?: boolean }) => {
      const silent = options?.silent ?? false;

      try {
        if (!silent) {
          setRefreshing(true);
        }
        setError(null);
        const data = await fetchDistriappModule<DistriappAdminDriverLocationItem>(
          apiBaseUrl,
          'driver-locations',
          undefined,
          options?.signal
        );
        setConfigured(data.configured);
        setMessage(data.message ?? null);
        setItems(data.items);
        setUpdatedAt(data.updatedAt ?? null);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setError((err as Error).message ?? 'No se pudieron cargar las ubicaciones.');
      } finally {
        setLoading(false);
        if (!silent) {
          setRefreshing(false);
        }
      }
    },
    [apiBaseUrl]
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void loadData({ signal: controller.signal, silent: true });

    const intervalId = window.setInterval(() => {
      void loadData({ silent: true });
    }, 45000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [loadData]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return items;
    }
    return items.filter((item) => item.driverName.toLowerCase().includes(term));
  }, [items, searchTerm]);

  return (
    <DashboardLayout title="Ubic. Repartidores" subtitle="Última geoposición reportada por conductor">
      <section className="dashboard-card">
        <header className="card-header">
          <div>
            <h3>Ubicaciones en vivo</h3>
            <p className="form-info">Última actualización: {formatDistriappTimestamp(updatedAt)}</p>
          </div>
          <div className="distriapp-live-actions">
            <button type="button" className="secondary-action" onClick={() => navigate('/distriapp')}>
              Volver al centro
            </button>
            <button type="button" className="secondary-action" onClick={() => void loadData()} disabled={refreshing}>
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </header>

        <div className="distriapp-filters-row">
          <label className="input-control">
            <span>Buscar conductor</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Nombre del conductor..."
            />
          </label>
        </div>

        {!configured ? <p className="form-info form-info--error">{message ?? 'Integración no configurada.'}</p> : null}
        {loading ? <p className="form-info">Cargando ubicaciones...</p> : null}
        {error ? <p className="form-info form-info--error">{error}</p> : null}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Conductor</th>
                <th>Lat</th>
                <th>Lng</th>
                <th>Precisión</th>
                <th>Fecha</th>
                <th>Mapa</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6}>No hay ubicaciones activas para mostrar.</td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const mapUrl = `https://www.google.com/maps?q=${item.lat},${item.lng}`;
                  return (
                    <tr key={`${item.driverId ?? item.driverName}-${index}`}>
                      <td>{item.driverName}</td>
                      <td>{item.lat.toFixed(6)}</td>
                      <td>{item.lng.toFixed(6)}</td>
                      <td>{item.accuracy != null ? `${item.accuracy} m` : 'S/D'}</td>
                      <td>{formatDistriappOptionalTimestamp(item.recordedAt)}</td>
                      <td>
                        <a href={mapUrl} target="_blank" rel="noreferrer">
                          Ver
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
};

const adaptCliente = (cliente: Cliente) => ({
  form: {
    codigo: cliente.codigo ?? '',
    nombre: cliente.nombre ?? '',
    direccion: cliente.direccion ?? '',
    documento_fiscal: cliente.documento_fiscal ?? '',
    logo_url: cliente.logo_url ?? '',
  },
  sucursales: (cliente.sucursales ?? []).map<EditableSucursal>((sucursal) => ({
    id: sucursal.id ?? null,
    nombre: sucursal.nombre ?? '',
    direccion: sucursal.direccion ?? '',
    encargado_deposito: sucursal.encargado_deposito ?? '',
    key: sucursal.id ? `existing-${sucursal.id}` : `new-${uniqueKey()}`,
  })),
});

const FUEL_STATUS_LABELS: Record<string, string> = {
  IMPORTED: 'Importado',
  VALIDATED: 'Validado',
  IMPUTED: 'Imputado',
  PENDING_MATCH: 'Pendiente',
  OBSERVED: 'Observado',
  DISCOUNTED: 'Descontado',
  CANCELED: 'Cancelado',
  DUPLICATE: 'Duplicado',
};

const FUEL_STATUS_VARIANTS: Record<string, string> = {
  IMPORTED: 'neutral',
  VALIDATED: 'info',
  IMPUTED: 'info',
  PENDING_MATCH: 'warning',
  OBSERVED: 'danger',
  DISCOUNTED: 'success',
  CANCELED: 'muted',
  DUPLICATE: 'muted',
};

const getFuelStatusLabel = (status?: string | null, discounted?: boolean | null): string => {
  if (discounted) {
    return 'Pagado';
  }
  if (!status) {
    return '—';
  }
  if (status === 'OBSERVED') {
    return 'Observado';
  }
  // Para el flujo de descuento, todo lo no descontado se considera por pagar
  return 'Por pagar';
};

const getFuelStatusVariant = (status?: string | null, discounted?: boolean | null): string => {
  if (discounted || status === 'DISCOUNTED') {
    return 'success';
  }
  if (!status) {
    return 'neutral';
  }
  if (status === 'OBSERVED') {
    return 'warning';
  }
  return 'neutral';
};

const renderFuelStatusBadge = (status?: string | null, discounted?: boolean | null) => {
  const label = getFuelStatusLabel(status, discounted);
  const variant = getFuelStatusVariant(status, discounted);
  return <span className={`fuel-badge fuel-badge--${variant}`}>{label}</span>;
};

const CombustibleTabs: React.FC = () => (
  <div className="card-header">
    <div className="approvals-tabs">
      <NavLink to="/combustible" end className={({ isActive }) => `approvals-tab${isActive ? ' is-active' : ''}`}>
        Carga de extracto
      </NavLink>
      <NavLink
        to="/combustible/pendientes"
        className={({ isActive }) => `approvals-tab${isActive ? ' is-active' : ''}`}
      >
        Pendientes
      </NavLink>
      <NavLink
        to="/combustible/distribuidor"
        className={({ isActive }) => `approvals-tab${isActive ? ' is-active' : ''}`}
      >
        Distribuidor
      </NavLink>
      <NavLink
        to="/combustible/informe"
        className={({ isActive }) => `approvals-tab${isActive ? ' is-active' : ''}`}
      >
        Informe
      </NavLink>
      <NavLink
        to="/combustible/tardias"
        className={({ isActive }) => `approvals-tab${isActive ? ' is-active' : ''}`}
      >
        Tardías
      </NavLink>
      <NavLink
        to="/combustible/consumos"
        className={({ isActive }) => `approvals-tab${isActive ? ' is-active' : ''}`}
      >
        Consumos
      </NavLink>
      <NavLink
        to="/combustible/reportes"
        className={({ isActive }) => `approvals-tab${isActive ? ' is-active' : ''}`}
      >
        Reportes
      </NavLink>
    </div>
  </div>
);

const CombustibleCargaPage: React.FC = () => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fuelExtractDropDepthRef = useRef(0);
  const [isFuelExtractDropActive, setIsFuelExtractDropActive] = useState(false);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Array<string[]>>([]);
  const [previewMeta, setPreviewMeta] = useState<{ rowCount: number; previewCount: number } | null>(null);
  const [previewUnmappedColumns, setPreviewUnmappedColumns] = useState<string[]>([]);
  const [previewMapped, setPreviewMapped] = useState(false);
  const [previewStats, setPreviewStats] = useState<{
    previewTotal: number;
    valid: number;
    observed: number;
    duplicates: number;
  } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [processLoading, setProcessLoading] = useState(false);
  const [processMessage, setProcessMessage] = useState<string | null>(null);
  const [closeYear, setCloseYear] = useState(() => new Date().getFullYear());
  const [closeMonth, setCloseMonth] = useState(() => new Date().getMonth() + 1);
  const [closePeriod, setClosePeriod] = useState<'Q1' | 'Q2' | 'MONTH'>('Q1');
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeMessage, setCloseMessage] = useState<string | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [provider, setProvider] = useState('');
  const [format, setFormat] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [autoAssignConductor, setAutoAssignConductor] = useState(true);
  const [duplicateRows, setDuplicateRows] = useState<
    Array<{
      id: number;
      occurred_at: string | null;
      station: string | null;
      domain_norm: string | null;
      product: string | null;
      liters: number | null;
      amount: number | null;
      price_per_liter: number | null;
      status: string | null;
      observations?: string | null;
      source_file?: string | null;
      source_row?: number | null;
    }>
  >([]);
  const [duplicateTotals, setDuplicateTotals] = useState<{ movements: number; liters: number; amount: number } | null>(null);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const resetFuelExtractMessages = () => {
    setPreviewColumns([]);
    setPreviewRows([]);
    setPreviewMeta(null);
    setPreviewUnmappedColumns([]);
    setPreviewMapped(false);
    setPreviewStats(null);
    setPreviewError(null);
    setProcessMessage(null);
    setProcessError(null);
    setDuplicateRows([]);
    setDuplicateTotals(null);
    setDuplicateError(null);
  };

  const setFuelExtractFile = (file: File | null) => {
    setSelectedFile(file);
    resetFuelExtractMessages();
  };

  const isSupportedFuelExtractFile = (file: File) => /\.(xlsx|csv)$/i.test(file.name);

  const handleFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file && !isSupportedFuelExtractFile(file)) {
      setFuelExtractFile(null);
      setPreviewError('Formato no soportado. Usa .xlsx o .csv.');
      return;
    }
    setFuelExtractFile(file);
  };

  const handleFuelExtractDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    fuelExtractDropDepthRef.current += 1;
    setIsFuelExtractDropActive(true);
  };

  const handleFuelExtractDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setIsFuelExtractDropActive(true);
  };

  const handleFuelExtractDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    fuelExtractDropDepthRef.current = Math.max(0, fuelExtractDropDepthRef.current - 1);
    if (fuelExtractDropDepthRef.current === 0) {
      setIsFuelExtractDropActive(false);
    }
  };

  const handleFuelExtractDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    fuelExtractDropDepthRef.current = 0;
    setIsFuelExtractDropActive(false);

    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    if (droppedFiles.length === 0) {
      return;
    }

    const nextFile = droppedFiles.find((file) => isSupportedFuelExtractFile(file)) ?? null;
    if (!nextFile) {
      setFuelExtractFile(null);
      setPreviewError('Formato no soportado. Usa .xlsx o .csv.');
      return;
    }

    setFuelExtractFile(nextFile);
  };

  const handleClearFile = () => {
    setFuelExtractFile(null);
    fuelExtractDropDepthRef.current = 0;
    setIsFuelExtractDropActive(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      setPreviewError('Selecciona un archivo para validar.');
      return;
    }

    const endpoint = withAuthToken(`${apiBaseUrl}/api/combustible/extractos/preview?debug=1`);
    if (!endpoint) {
      setPreviewError('No se pudo resolver el endpoint.');
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewColumns([]);
    setPreviewRows([]);
    setPreviewMeta(null);
    setPreviewUnmappedColumns([]);
    setPreviewMapped(false);
    setPreviewStats(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('provider', provider);
      formData.append('format', format);
      formData.append('date_from', dateFrom);
      formData.append('date_to', dateTo);
      formData.append('auto_assign_conductor', autoAssignConductor ? '1' : '0');

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        const message =
          (payload && typeof payload.message === 'string' && payload.message) ||
          `Error al validar (${response.status}).`;
        throw new Error(message);
      }

      const payload = await parseJsonSafe(response);
      setPreviewColumns(Array.isArray(payload.columns) ? payload.columns : []);
      setPreviewRows(Array.isArray(payload.rows) ? payload.rows : []);
      if (typeof payload.rowCount === 'number' && typeof payload.previewCount === 'number') {
        setPreviewMeta({ rowCount: payload.rowCount, previewCount: payload.previewCount });
      }
      setPreviewUnmappedColumns(Array.isArray(payload.unmappedColumns) ? payload.unmappedColumns : []);
      setPreviewMapped(Boolean(payload.mapped));
      if (payload.stats && typeof payload.stats === 'object') {
        setPreviewStats({
          previewTotal: Number(payload.stats.previewTotal) || 0,
          valid: Number(payload.stats.valid) || 0,
          observed: Number(payload.stats.observed) || 0,
          duplicates: Number(payload.stats.duplicates) || 0,
        });
      }
      if (payload.mapped === false) {
        const headerRow = Array.isArray(payload?.debug?.headerRow) ? payload.debug.headerRow : null;
        const sample = Array.isArray(payload?.debug?.sampleRows) ? payload.debug.sampleRows[0] : null;
        const sheetInfo = Array.isArray(payload?.debug?.sheets) ? payload.debug.sheets : null;
        const sheetHint = sheetInfo
          ? `Sheets: ${sheetInfo
              .map((sheet: { sheet: string; name?: string; headerScore: number; maxColumns: number }) =>
                `${sheet.name ?? sheet.sheet} (${sheet.sheet}, score ${sheet.headerScore}, cols ${sheet.maxColumns})`
              )
              .join(' | ')}`
          : '';
        const hint = headerRow
          ? `Encabezados detectados: ${headerRow.filter(Boolean).slice(0, 8).join(' | ')}`
          : sample
            ? `Primera fila detectada: ${sample.filter(Boolean).slice(0, 8).join(' | ')}`
            : '';
        setPreviewError(['No se pudieron mapear columnas al formato general.', hint, sheetHint].filter(Boolean).join(' '));
      }
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'No se pudo validar el archivo.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) {
      setProcessError('Selecciona un archivo para procesar.');
      return;
    }

    const endpoint = withAuthToken(`${apiBaseUrl}/api/combustible/extractos/process`);
    if (!endpoint) {
      setProcessError('No se pudo resolver el endpoint.');
      return;
    }

    setProcessLoading(true);
    setProcessError(null);
    setProcessMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('provider', provider);
      formData.append('format', format);
      formData.append('date_from', dateFrom);
      formData.append('date_to', dateTo);

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        const message =
          (payload && typeof payload.message === 'string' && payload.message) ||
          `Error al procesar (${response.status}).`;
        throw new Error(message);
      }

      const payload = await parseJsonSafe(response);
      const summary = [
        typeof payload.inserted === 'number' ? `Insertadas: ${payload.inserted}` : null,
        typeof payload.observed === 'number' ? `Observadas: ${payload.observed}` : null,
        typeof payload.duplicates === 'number' ? `Duplicadas: ${payload.duplicates}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      setProcessMessage(summary || 'Extracto procesado.');
    } catch (error) {
      setProcessError(error instanceof Error ? error.message : 'No se pudo procesar el archivo.');
    } finally {
      setProcessLoading(false);
    }
  };

  const handleDeleteSourceFile = async () => {
    if (!selectedFile) {
      setProcessError('Selecciona un archivo para limpiar.');
      return;
    }

    const endpoint = withAuthToken(`${apiBaseUrl}/api/combustible/movimientos`);
    if (!endpoint) {
      setProcessError('No se pudo resolver el endpoint.');
      return;
    }

    setDeleteLoading(true);
    setProcessError(null);
    setProcessMessage(null);

    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ source_file: selectedFile.name }),
      });
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? 'No se pudo limpiar el archivo.');
      }
      const payload = await parseJsonSafe(response);
      setProcessMessage(`Movimientos eliminados: ${payload.deleted ?? 0}.`);
    } catch (error) {
      setProcessError(error instanceof Error ? error.message : 'No se pudo limpiar el archivo.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleLoadDuplicates = async () => {
    if (!selectedFile) {
      setDuplicateError('Selecciona un archivo para ver duplicadas.');
      return;
    }
    setDuplicateLoading(true);
    setDuplicateError(null);
    try {
      const url = new URL(`${apiBaseUrl}/api/combustible/consumos`);
      url.searchParams.set('include_duplicates', '1');
      url.searchParams.set('status', 'DUPLICATE');
      url.searchParams.set('source_file', selectedFile.name);
      const response = await fetch(url.toString(), { credentials: 'include' });
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? `No se pudieron cargar las duplicadas (${response.status}).`);
      }
      const payload = await parseJsonSafe(response);
      setDuplicateRows(Array.isArray(payload.data) ? payload.data : []);
      if (payload.totals && typeof payload.totals === 'object') {
        setDuplicateTotals({
          movements: Number(payload.totals.movements) || 0,
          liters: Number(payload.totals.liters) || 0,
          amount: Number(payload.totals.amount) || 0,
        });
      } else {
        setDuplicateTotals(null);
      }
    } catch (err) {
      setDuplicateError(err instanceof Error ? err.message : 'No se pudieron cargar las duplicadas.');
      setDuplicateRows([]);
      setDuplicateTotals(null);
    } finally {
      setDuplicateLoading(false);
    }
  };

  const handleClosePeriod = async () => {
    setCloseLoading(true);
    setCloseMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/combustible/cierre`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          year: Number(closeYear),
          month: Number(closeMonth),
          period: closePeriod,
        }),
      });
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? 'No se pudo cerrar el período.');
      }
      const payload = await parseJsonSafe(response);
      setCloseMessage(
        `Generados: ${payload?.created?.length ?? 0} · Omitidos: ${payload?.skipped?.length ?? 0}`
      );
    } catch (error) {
      setCloseMessage(error instanceof Error ? error.message : 'No se pudo cerrar el período.');
    } finally {
      setCloseLoading(false);
    }
  };

  return (
    <DashboardLayout title="Combustible" subtitle="Carga de extracto" headerContent={<CombustibleTabs />}>
      <section className="dashboard-card">
        <header className="card-header">
          <div>
            <h3>Carga de extracto (Excel)</h3>
            <p className="section-helper">Importa el archivo, valida los datos y genera el log de resultados.</p>
          </div>
        </header>
        <div className="card-body">
          <div className="form-grid">
            <label className="input-control">
              <span>Proveedor / Red</span>
              <select value={provider} onChange={(event) => setProvider(event.target.value)}>
                <option value="">Seleccionar</option>
                <option value="ypf">YPF</option>
                <option value="axion">Axion</option>
                <option value="shell">Shell</option>
                <option value="puma">Puma</option>
              </select>
            </label>
            <label className="input-control">
              <span>Formato de archivo</span>
              <select value={format} onChange={(event) => setFormat(event.target.value)}>
                <option value="">Seleccionar</option>
                <option value="default">Formato general</option>
                <option value="custom">Formato personalizado</option>
              </select>
            </label>
            <label className="input-control">
              <span>Período desde</span>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label className="input-control">
              <span>Período hasta</span>
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>
          </div>
          <label className="checkbox-control">
            <input
              type="checkbox"
              checked={autoAssignConductor}
              onChange={(event) => setAutoAssignConductor(event.target.checked)}
            />
            Auto-asignar por conductor
          </label>

          <div
            className={`file-dropzone${isFuelExtractDropActive ? ' is-dragover' : ''}`}
            role="presentation"
            onDragEnter={handleFuelExtractDragEnter}
            onDragOver={handleFuelExtractDragOver}
            onDragLeave={handleFuelExtractDragLeave}
            onDrop={handleFuelExtractDrop}
          >
            <span className="file-dropzone__icon" aria-hidden="true">
              ⛽
            </span>
            <p className="file-dropzone__text">Arrastra y suelta el Excel aquí o selecciona desde tu equipo.</p>
            {selectedFile ? (
              <span className="file-dropzone__filename">{selectedFile.name}</span>
            ) : (
              <span className="file-dropzone__hint">Formatos soportados: .xlsx, .csv</span>
            )}
            <div className="file-dropzone__actions">
              <button type="button" className="primary-action" onClick={handleFilePicker}>
                Seleccionar archivo
              </button>
              {selectedFile ? (
                <button type="button" className="secondary-action secondary-action--ghost" onClick={handleClearFile}>
                  Quitar archivo
                </button>
              ) : null}
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.csv" onChange={handleFileChange} hidden />
          </div>

          <div className="transportista-actions">
            <button type="button" className="secondary-action" onClick={handlePreview} disabled={previewLoading}>
              {previewLoading ? 'Validando...' : 'Validar'}
            </button>
            <button
              type="button"
              className="primary-action"
              disabled={!previewRows.length || processLoading}
              onClick={handleProcess}
            >
              {processLoading ? 'Procesando...' : 'Procesar'}
            </button>
            <button
              type="button"
              className="secondary-action secondary-action--ghost"
              onClick={handleDeleteSourceFile}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Limpiando...' : 'Limpiar archivo'}
            </button>
            <button
              type="button"
              className="secondary-action secondary-action--ghost"
              onClick={handleLoadDuplicates}
              disabled={duplicateLoading || !selectedFile}
            >
              {duplicateLoading ? 'Cargando duplicadas...' : 'Ver duplicadas'}
            </button>
            <button type="button" className="secondary-action secondary-action--ghost">
              Descargar log
            </button>
            <small>Vista previa: se mostrarán hasta 20 filas.</small>
          </div>
          {previewError ? <p className="form-info form-info--error">{previewError}</p> : null}
          {processError ? <p className="form-info form-info--error">{processError}</p> : null}
          {processMessage ? <p className="form-info form-info--success">{processMessage}</p> : null}
          {duplicateError ? <p className="form-info form-info--error">{duplicateError}</p> : null}
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <div>
            <h3>Cierre de período</h3>
            <p className="section-helper">Genera informes sugeridos para la quincena o mes.</p>
          </div>
        </header>
        <div className="card-body">
          <div className="form-grid">
            <label className="input-control">
              <span>Año</span>
              <input
                type="number"
                value={closeYear}
                onChange={(event) => setCloseYear(Number(event.target.value))}
              />
            </label>
            <label className="input-control">
              <span>Mes</span>
              <input
                type="number"
                min={1}
                max={12}
                value={closeMonth}
                onChange={(event) => setCloseMonth(Number(event.target.value))}
              />
            </label>
            <label className="input-control">
              <span>Período</span>
              <select value={closePeriod} onChange={(event) => setClosePeriod(event.target.value as 'Q1' | 'Q2' | 'MONTH')}>
                <option value="Q1">Primera quincena</option>
                <option value="Q2">Segunda quincena</option>
                <option value="MONTH">Mes completo</option>
              </select>
            </label>
          </div>
          <div className="filters-actions">
            <button type="button" className="secondary-action" onClick={handleClosePeriod} disabled={closeLoading}>
              {closeLoading ? 'Procesando…' : 'Cerrar período'}
            </button>
            {closeMessage ? <span className="helper-text">{closeMessage}</span> : null}
          </div>
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <div>
            <h3>Preview del extracto</h3>
            {previewMeta ? (
              <p className="section-helper">
                Filas detectadas: {previewMeta.rowCount} · Mostradas: {previewMeta.previewCount}
              </p>
            ) : null}
            {previewStats ? (
              <p className="section-helper">
                Válidas: {previewStats.valid} · Observadas: {previewStats.observed} · Duplicadas: {previewStats.duplicates}
              </p>
            ) : null}
            {previewMapped && previewUnmappedColumns.length > 0 ? (
              <p className="section-helper">Columnas sin mapear: {previewUnmappedColumns.join(', ')}</p>
            ) : null}
          </div>
        </header>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {previewColumns.length > 0 ? (
                  previewColumns.map((column, index) => <th key={`${column}-${index}`}>{column || `Columna ${index + 1}`}</th>)
                ) : (
                  <>
                    <th>Fecha</th>
                    <th>Estación</th>
                    <th>Dominio</th>
                    <th>Producto</th>
                    <th>Litros</th>
                    <th>Importe</th>
                    <th>Estado</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {previewRows.length > 0 ? (
                previewRows.map((row, rowIndex) => (
                  <tr key={`preview-row-${rowIndex}`}>
                    {row.map((value, cellIndex) => (
                      <td key={`preview-cell-${rowIndex}-${cellIndex}`}>{value || '—'}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={previewColumns.length > 0 ? previewColumns.length : 7}>Sin datos para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <div>
            <h3>Duplicadas del archivo</h3>
            {duplicateTotals ? (
              <p className="section-helper">
                Movimientos: {duplicateTotals.movements} · Litros: {formatNumber(duplicateTotals.liters)} · Importe:{' '}
                {formatCurrency(duplicateTotals.amount)}
              </p>
            ) : null}
          </div>
        </header>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estación</th>
                <th>Dominio</th>
                <th>Producto</th>
                <th>Litros</th>
                <th>Importe</th>
                <th>Observaciones</th>
                <th>Fila</th>
              </tr>
            </thead>
            <tbody>
              {duplicateLoading && (
                <tr>
                  <td colSpan={8}>Cargando duplicadas...</td>
                </tr>
              )}
              {!duplicateLoading && duplicateRows.length === 0 && (
                <tr>
                  <td colSpan={8}>No hay duplicadas para el archivo seleccionado.</td>
                </tr>
              )}
              {!duplicateLoading &&
                duplicateRows.map((row) => (
                  <tr key={`dup-${row.id}`}>
                    <td>{formatDateTime(row.occurred_at)}</td>
                    <td>{row.station ?? '—'}</td>
                    <td>{row.domain_norm ?? '—'}</td>
                    <td>{row.product ?? '—'}</td>
                    <td>{formatNumber(row.liters)}</td>
                    <td>{formatCurrency(row.amount ?? 0)}</td>
                    <td>{row.observations ?? 'Duplicado'}</td>
                    <td>{row.source_row ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
};

const CombustiblePendientesPage: React.FC = () => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [searchTerm, setSearchTerm] = useState('');
  const [rows, setRows] = useState<
    Array<{
      domain_norm: string;
      movements: number;
      amount: number;
      first_date: string | null;
      last_date: string | null;
      days_pending: number | null;
    }>
  >([]);
  const [totals, setTotals] = useState<{ domains: number; movements: number; amount: number } | null>(null);
  const [rowsByDistributor, setRowsByDistributor] = useState<
    Array<{
      distributor_id: number;
      distributor_name: string | null;
      distributor_code: string | null;
      movements: number;
      amount: number;
      last_date: string | null;
    }>
  >([]);
  const [totalsByDistributor, setTotalsByDistributor] = useState<{
    distributors: number;
    movements: number;
    amount: number;
  } | null>(null);
  const [distributors, setDistributors] = useState<Array<{ id: number; name: string; code?: string | null }>>([]);
  const [selectedDistributor, setSelectedDistributor] = useState<Record<string, string>>({});
  const [bulkDistributorId, setBulkDistributorId] = useState('');
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [newDistributorName, setNewDistributorName] = useState('');
  const [newDistributorCode, setNewDistributorCode] = useState('');

  const fetchPendientes = useCallback(
    async (query?: string) => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL(`${apiBaseUrl}/api/combustible/pendientes`);
        if (query) {
          url.searchParams.set('search', query);
        }
        const response = await fetch(url.toString(), { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`No se pudieron cargar los pendientes (${response.status}).`);
        }
        const payload = await parseJsonSafe(response);
        setRows(Array.isArray(payload.data) ? payload.data : []);
        if (payload.totals && typeof payload.totals === 'object') {
          setTotals({
            domains: Number(payload.totals.domains) || 0,
            movements: Number(payload.totals.movements) || 0,
            amount: Number(payload.totals.amount) || 0,
          });
        } else {
          setTotals(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los pendientes.');
        setRows([]);
        setTotals(null);
        setSelectedDomains(new Set());
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const fetchPendientesDistribuidor = useCallback(
    async (query?: string) => {
      try {
        const url = new URL(`${apiBaseUrl}/api/combustible/pendientes-distribuidor`);
        if (query) {
          url.searchParams.set('search', query);
        }
        const response = await fetch(url.toString(), { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`No se pudieron cargar pendientes por distribuidor (${response.status}).`);
        }
        const payload = await parseJsonSafe(response);
        setRowsByDistributor(Array.isArray(payload.data) ? payload.data : []);
        if (payload.totals && typeof payload.totals === 'object') {
          setTotalsByDistributor({
            distributors: Number(payload.totals.distributors) || 0,
            movements: Number(payload.totals.movements) || 0,
            amount: Number(payload.totals.amount) || 0,
          });
        } else {
          setTotalsByDistributor(null);
        }
      } catch {
        setRowsByDistributor([]);
        setTotalsByDistributor(null);
      }
    },
    [apiBaseUrl]
  );

  useEffect(() => {
    fetchPendientes('');
    fetchPendientesDistribuidor('');
  }, [fetchPendientes, fetchPendientesDistribuidor]);

  useEffect(() => {
    const loadDistributors = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/combustible/distribuidores`, { credentials: 'include' });
        if (!response.ok) {
          throw new Error('No se pudieron cargar los distribuidores.');
        }
        const payload = await parseJsonSafe(response);
        setDistributors(Array.isArray(payload.data) ? payload.data : []);
      } catch {
        setDistributors([]);
      }
    };
    loadDistributors();
  }, [apiBaseUrl]);

  const handleCreateDistributor = async () => {
    if (!newDistributorName.trim()) {
      setError('Ingresa el nombre del distribuidor.');
      return;
    }
    setError(null);
    setActionMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/combustible/distribuidores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newDistributorName.trim(),
          code: newDistributorCode.trim() || null,
        }),
      });
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? 'No se pudo crear el distribuidor.');
      }
      setNewDistributorName('');
      setNewDistributorCode('');
      const payload = await parseJsonSafe(response);
      setDistributors((prev) => [...prev, payload.data].filter(Boolean));
      setActionMessage('Distribuidor creado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el distribuidor.');
    }
  };

  const handleLink = async (domainNorm: string) => {
    const distributorId = selectedDistributor[domainNorm];
    if (!distributorId) {
      setError('Selecciona un distribuidor para vincular.');
      return;
    }
    setError(null);
    setActionMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/combustible/pendientes/vincular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ domain_norm: domainNorm, distributor_id: Number(distributorId) }),
      });
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? 'No se pudo vincular la patente.');
      }
      setActionMessage(`Dominio ${domainNorm} vinculado.`);
      fetchPendientes(searchTerm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo vincular la patente.');
    }
  };

  const handleInvalidate = async (domainNorm: string) => {
    setError(null);
    setActionMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/combustible/pendientes/invalidar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ domain_norm: domainNorm, reason: 'Patente inválida' }),
      });
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? 'No se pudo invalidar la patente.');
      }
      setActionMessage(`Dominio ${domainNorm} marcado como inválido.`);
      fetchPendientes(searchTerm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo invalidar la patente.');
    }
  };

  const toggleDomainSelection = (domainNorm: string) => {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domainNorm)) {
        next.delete(domainNorm);
      } else {
        next.add(domainNorm);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedDomains((prev) => {
      const visible = rows.map((row) => row.domain_norm);
      const allSelected = visible.length > 0 && visible.every((domain) => prev.has(domain));
      if (allSelected) {
        const next = new Set(prev);
        visible.forEach((domain) => next.delete(domain));
        return next;
      }
      return new Set([...Array.from(prev), ...visible]);
    });
  };

  const handleBulkLink = async () => {
    if (!bulkDistributorId) {
      setError('Selecciona un distribuidor para la vinculación masiva.');
      return;
    }
    if (selectedDomains.size === 0) {
      setError('Selecciona al menos un dominio.');
      return;
    }
    setError(null);
    setActionMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/combustible/pendientes/vincular-masivo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          domains: Array.from(selectedDomains),
          distributor_id: Number(bulkDistributorId),
        }),
      });
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? 'No se pudo vincular de forma masiva.');
      }
      setActionMessage('Dominios vinculados.');
      setSelectedDomains(new Set());
      fetchPendientes(searchTerm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo vincular de forma masiva.');
    }
  };

  const handleBulkInvalidate = async () => {
    if (selectedDomains.size === 0) {
      setError('Selecciona al menos un dominio.');
      return;
    }
    setError(null);
    setActionMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/combustible/pendientes/invalidar-masivo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          domains: Array.from(selectedDomains),
          reason: 'Patente inválida',
        }),
      });
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? 'No se pudo invalidar en forma masiva.');
      }
      setActionMessage('Dominios invalidados.');
      setSelectedDomains(new Set());
      fetchPendientes(searchTerm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo invalidar en forma masiva.');
    }
  };

  return (
    <DashboardLayout title="Combustible" subtitle="Bandeja de pendientes" headerContent={<CombustibleTabs />}>
      <section className="dashboard-card">
        <header className="card-header">
          <h3>Crear distribuidor</h3>
        </header>
        <div className="card-body">
          <div className="form-grid">
            <label className="input-control">
              <span>Nombre</span>
              <input
                value={newDistributorName}
                onChange={(event) => setNewDistributorName(event.target.value)}
                placeholder="Distribuidor Norte"
              />
            </label>
            <label className="input-control">
              <span>Código (opcional)</span>
              <input
                value={newDistributorCode}
                onChange={(event) => setNewDistributorCode(event.target.value)}
                placeholder="DN-001"
              />
            </label>
          </div>
          <div className="filters-actions">
            <button type="button" className="secondary-action" onClick={handleCreateDistributor}>
              Crear distribuidor
            </button>
          </div>
        </div>
      </section>

      <div className="filters-actions" style={{ gap: '1rem' }}>
        <div className="search-wrapper">
          <input
            type="search"
            placeholder="Buscar dominio"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <button type="button" className="secondary-action" onClick={() => fetchPendientes(searchTerm)}>
          Buscar
        </button>
      </div>

      <div className="filters-actions" style={{ gap: '1rem' }}>
        <label className="input-control" style={{ maxWidth: '280px' }}>
          <span>Distribuidor (masivo)</span>
          <select value={bulkDistributorId} onChange={(event) => setBulkDistributorId(event.target.value)}>
            <option value="">Seleccionar</option>
            {distributors.map((distributor) => (
              <option key={`bulk-dist-${distributor.id}`} value={distributor.id}>
                {distributor.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="secondary-action" onClick={handleBulkLink}>
          Vincular seleccionados
        </button>
        <button type="button" className="secondary-action secondary-action--ghost" onClick={handleBulkInvalidate}>
          Invalidar seleccionados
        </button>
        <small>Seleccionados: {selectedDomains.size}</small>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <span className="summary-card__label">Dominios pendientes</span>
          <strong className="summary-card__value">{totals?.domains ?? 0}</strong>
        </div>
        <div className="summary-card">
          <span className="summary-card__label">Movimientos</span>
          <strong className="summary-card__value">{totals?.movements ?? 0}</strong>
        </div>
        <div className="summary-card">
          <span className="summary-card__label">Importe total</span>
          <strong className="summary-card__value">{formatCurrency(totals?.amount ?? 0)}</strong>
        </div>
      </div>

      <section className="dashboard-card" style={{ marginTop: '1rem' }}>
        <header className="card-header">
          <h3>Pendientes por distribuidor</h3>
        </header>
        <div className="card-body">
          <div className="summary-cards">
            <div className="summary-card">
              <span className="summary-card__label">Distribuidores</span>
              <strong className="summary-card__value">{totalsByDistributor?.distributors ?? 0}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-card__label">Movimientos</span>
              <strong className="summary-card__value">{totalsByDistributor?.movements ?? 0}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-card__label">Importe total</span>
              <strong className="summary-card__value">{formatCurrency(totalsByDistributor?.amount ?? 0)}</strong>
            </div>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Distribuidor</th>
                <th>Movimientos</th>
                <th>Importe</th>
                <th>Última fecha</th>
              </tr>
            </thead>
            <tbody>
              {rowsByDistributor.length === 0 ? (
                <tr>
                  <td colSpan={4}>No hay pendientes imputados.</td>
                </tr>
              ) : (
                rowsByDistributor.map((row) => (
                  <tr key={`dist-pend-${row.distributor_id}`}>
                    <td>
                      {row.distributor_name ?? '—'}{' '}
                      {row.distributor_code ? <span className="muted">({row.distributor_code})</span> : null}
                    </td>
                    <td>{row.movements}</td>
                    <td>{formatCurrency(row.amount)}</td>
                    <td>{row.last_date ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={rows.length > 0 && rows.every((row) => selectedDomains.has(row.domain_norm))}
                  onChange={toggleSelectAll}
                  aria-label="Seleccionar todos"
                />
              </th>
              <th>Dominio</th>
              <th>Movimientos</th>
              <th>Importe</th>
              <th>Desde</th>
              <th>Última fecha</th>
              <th>Días pendientes</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8}>Cargando pendientes...</td>
              </tr>
            )}
            {error && !loading && (
              <tr>
                <td colSpan={8} className="error-cell">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={8}>No hay pendientes.</td>
              </tr>
            )}
            {!loading &&
              !error &&
              rows.map((row) => (
                <tr key={row.domain_norm}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedDomains.has(row.domain_norm)}
                      onChange={() => toggleDomainSelection(row.domain_norm)}
                      aria-label={`Seleccionar ${row.domain_norm}`}
                    />
                  </td>
                  <td>{row.domain_norm || '—'}</td>
                  <td>{row.movements}</td>
                  <td>{formatCurrency(row.amount)}</td>
                  <td>{row.first_date ?? '—'}</td>
                  <td>{row.last_date ?? '—'}</td>
                  <td>{row.days_pending != null ? row.days_pending : '—'}</td>
                  <td>
                    <div className="action-buttons">
                      <select
                        value={selectedDistributor[row.domain_norm] ?? ''}
                        onChange={(event) =>
                          setSelectedDistributor((prev) => ({ ...prev, [row.domain_norm]: event.target.value }))
                        }
                      >
                        <option value="">Distribuidor</option>
                        {distributors.map((distributor) => (
                          <option key={`dist-${distributor.id}`} value={distributor.id}>
                            {distributor.name}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="secondary-action" onClick={() => handleLink(row.domain_norm)}>
                        Vincular
                      </button>
                      <button
                        type="button"
                        className="secondary-action secondary-action--ghost"
                        onClick={() => handleInvalidate(row.domain_norm)}
                      >
                        Marcar inválida
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {actionMessage ? <p className="form-info form-info--success">{actionMessage}</p> : null}
      {error ? <p className="form-info form-info--error">{error}</p> : null}
    </DashboardLayout>
  );
};

const CombustibleDistribuidorPage: React.FC = () => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const CONSUMOS_PER_PAGE = 500;
  const [distributors, setDistributors] = useState<Array<{ id: number; name: string; code?: string | null }>>([]);
  const [distributorId, setDistributorId] = useState('');
  const [manualDistributorName, setManualDistributorName] = useState('');
  const [newDistributorName, setNewDistributorName] = useState('');
  const [newDistributorCode, setNewDistributorCode] = useState('');
  const [domain, setDomain] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [sourceFile, setSourceFile] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [periodPreset, setPeriodPreset] = useState<'Q1' | 'Q2' | 'MONTH' | ''>('');
  const [rows, setRows] = useState<
    Array<{
      id: number;
      occurred_at: string | null;
      station: string | null;
      domain_norm: string | null;
      product: string | null;
      invoice_number?: string | null;
      liters: number | null;
      amount: number | null;
      price_per_liter: number | null;
      status: string | null;
      discounted?: boolean | null;
    }>
  >([]);
  const [totals, setTotals] = useState<{
    movements: number;
    liters: number;
    amount: number;
    returned?: number;
    limit?: number;
    discount_counts?: { taken: number; not_taken: number };
    status_counts?: Record<string, number>;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<{
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next_page: boolean;
    has_prev_page: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedMovementIds, setSelectedMovementIds] = useState<Set<number>>(() => new Set());
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const applyPeriodPreset = useCallback(
    (preset: 'Q1' | 'Q2' | 'MONTH', baseDate?: string) => {
      const normalizedBase = baseDate && baseDate.trim() !== '' ? baseDate : new Date().toISOString().slice(0, 10);
      const parsed = new Date(`${normalizedBase}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) {
        return;
      }
      const year = parsed.getFullYear();
      const month = parsed.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const toIso = (date: Date) => date.toISOString().slice(0, 10);
      if (preset === 'Q1') {
        setDateFrom(toIso(firstDay));
        setDateTo(toIso(new Date(year, month, 15)));
      } else if (preset === 'Q2') {
        setDateFrom(toIso(new Date(year, month, 16)));
        setDateTo(toIso(lastDay));
      } else {
        setDateFrom(toIso(firstDay));
        setDateTo(toIso(lastDay));
      }
    },
    []
  );

  const normalizeDistributorSearch = useCallback((value?: string | null) => {
    return (value ?? '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }, []);

  useEffect(() => {
    const loadDistributors = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/combustible/distribuidores`, { credentials: 'include' });
        if (!response.ok) {
          throw new Error('No se pudieron cargar los distribuidores.');
        }
        const payload = await parseJsonSafe(response);
        setDistributors(Array.isArray(payload.data) ? payload.data : []);
      } catch {
        setDistributors([]);
      }
    };
    loadDistributors();
  }, [apiBaseUrl]);

  const handleCreateDistributor = async () => {
    if (!newDistributorName.trim()) {
      setError('Ingresa el nombre del distribuidor.');
      return;
    }
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/combustible/distribuidores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newDistributorName.trim(),
          code: newDistributorCode.trim() || null,
        }),
      });
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? 'No se pudo crear el distribuidor.');
      }
      const payload = await parseJsonSafe(response);
      setDistributors((prev) => [...prev, payload.data].filter(Boolean));
      setNewDistributorName('');
      setNewDistributorCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el distribuidor.');
    }
  };

  const fetchConsumos = useCallback(
    async (requestedPage?: number) => {
      const nextPage = Math.max(1, Math.trunc(requestedPage ?? currentPage) || 1);
      setLoading(true);
      setError(null);
      try {
        const url = new URL(`${apiBaseUrl}/api/combustible/consumos`);
        let resolvedDistributorId = distributorId.trim();

        if (!resolvedDistributorId && manualDistributorName.trim()) {
          const term = normalizeDistributorSearch(manualDistributorName);
          const exactMatches = distributors.filter((item) => {
            const byName = normalizeDistributorSearch(item.name) === term;
            const byCode = normalizeDistributorSearch(item.code ?? '') === term;
            return byName || byCode;
          });
          const partialMatches = distributors.filter((item) => {
            const byName = normalizeDistributorSearch(item.name).includes(term);
            const byCode = normalizeDistributorSearch(item.code ?? '').includes(term);
            return byName || byCode;
          });
          const matches = exactMatches.length > 0 ? exactMatches : partialMatches;
          if (matches.length === 0) {
            throw new Error('No se encontró distribuidor con ese nombre/código.');
          }
          if (matches.length > 1) {
            throw new Error('Hay más de un distribuidor con ese texto. Especificá un poco más.');
          }
          resolvedDistributorId = String(matches[0].id);
          setDistributorId(resolvedDistributorId);
          setManualDistributorName(matches[0].name ?? manualDistributorName);
        }

        if (resolvedDistributorId) {
          url.searchParams.set('distributor_id', resolvedDistributorId);
        }

        if (domain.trim()) {
          url.searchParams.set('domain', domain.trim());
        }
        if (invoiceNumber.trim()) {
          url.searchParams.set('invoice_number', invoiceNumber.trim());
        }
        if (sourceFile.trim()) {
          url.searchParams.set('source_file', sourceFile.trim());
        }
        if (dateFrom) {
          url.searchParams.set('date_from', dateFrom);
        }
        if (dateTo) {
          url.searchParams.set('date_to', dateTo);
        }
        url.searchParams.set('only_pending', '1');
        url.searchParams.set('only_imputed', '1');
        url.searchParams.set('page', String(nextPage));
        url.searchParams.set('per_page', String(CONSUMOS_PER_PAGE));
        const response = await fetch(url.toString(), { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`No se pudieron cargar los consumos (${response.status}).`);
        }
        const payload = await parseJsonSafe(response);
        setRows(Array.isArray(payload.data) ? payload.data : []);
        if (payload.totals && typeof payload.totals === 'object') {
          setTotals({
            movements: Number(payload.totals.movements) || 0,
            liters: Number(payload.totals.liters) || 0,
            amount: Number(payload.totals.amount) || 0,
            returned: Number(payload.totals.returned) || 0,
            limit: Number(payload.totals.limit) || 0,
            discount_counts: payload.totals.discount_counts ?? undefined,
            status_counts: payload.totals.status_counts ?? undefined,
          });
        } else {
          setTotals(null);
        }
        if (payload.pagination && typeof payload.pagination === 'object') {
          const parsedPage = Math.max(1, Math.trunc(Number(payload.pagination.page) || 1));
          const parsedPerPage = Math.max(1, Math.trunc(Number(payload.pagination.per_page) || CONSUMOS_PER_PAGE));
          const parsedTotal = Math.max(0, Math.trunc(Number(payload.pagination.total) || 0));
          const parsedTotalPages = Math.max(1, Math.trunc(Number(payload.pagination.total_pages) || 1));
          const hasPrevPage = Boolean(payload.pagination.has_prev_page) || parsedPage > 1;
          const hasNextPage = Boolean(payload.pagination.has_next_page) || parsedPage < parsedTotalPages;
          setPagination({
            page: parsedPage,
            per_page: parsedPerPage,
            total: parsedTotal,
            total_pages: parsedTotalPages,
            has_next_page: hasNextPage,
            has_prev_page: hasPrevPage,
          });
          setCurrentPage(parsedPage);
        } else {
          const total = Number(payload?.totals?.movements) || (Array.isArray(payload.data) ? payload.data.length : 0);
          const totalPages = Math.max(1, Math.ceil(total / CONSUMOS_PER_PAGE));
          const safePage = Math.min(nextPage, totalPages);
          setPagination({
            page: safePage,
            per_page: CONSUMOS_PER_PAGE,
            total,
            total_pages: totalPages,
            has_next_page: safePage < totalPages,
            has_prev_page: safePage > 1,
          });
          setCurrentPage(safePage);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los consumos.');
        setRows([]);
        setTotals(null);
        setPagination(null);
      } finally {
        setLoading(false);
      }
    },
    [
      CONSUMOS_PER_PAGE,
      apiBaseUrl,
      currentPage,
      distributorId,
      manualDistributorName,
      distributors,
      normalizeDistributorSearch,
      domain,
      invoiceNumber,
      sourceFile,
      dateFrom,
      dateTo,
    ]
  );

  useEffect(() => {
    setSelectedMovementIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      const visibleIds = new Set(rows.map((row) => row.id));
      const next = new Set<number>();
      prev.forEach((id) => {
        if (visibleIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [rows]);

  const visibleMovementIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const allVisibleSelected =
    visibleMovementIds.length > 0 && visibleMovementIds.every((id) => selectedMovementIds.has(id));
  const someVisibleSelected = visibleMovementIds.some((id) => selectedMovementIds.has(id)) && !allVisibleSelected;

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }
    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  const toggleSelectAllMovements = useCallback(() => {
    setSelectedMovementIds((prev) => {
      if (visibleMovementIds.length === 0) {
        return prev;
      }
      const next = new Set(prev);
      const shouldUnselectAll = visibleMovementIds.every((id) => next.has(id));
      if (shouldUnselectAll) {
        visibleMovementIds.forEach((id) => next.delete(id));
      } else {
        visibleMovementIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [visibleMovementIds]);

  const toggleSelectMovement = useCallback((movementId: number) => {
    setSelectedMovementIds((prev) => {
      const next = new Set(prev);
      if (next.has(movementId)) {
        next.delete(movementId);
      } else {
        next.add(movementId);
      }
      return next;
    });
  }, []);

  const handleDeleteSelectedMovements = useCallback(async () => {
    if (selectedMovementIds.size === 0) {
      return;
    }
    const confirmed = window.confirm(
      `Se van a eliminar ${selectedMovementIds.size} consumo(s) seleccionados. Esta acción no se puede deshacer.`
    );
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/combustible/movimientos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          movement_ids: Array.from(selectedMovementIds),
        }),
      });
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? `No se pudieron eliminar los consumos (${response.status}).`);
      }
      const payload = await parseJsonSafe(response);
      const deleted = Number(payload?.deleted ?? 0);
      setActionMessage(`Consumos eliminados: ${deleted}.`);
      setSelectedMovementIds(new Set());
      await fetchConsumos(currentPage);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudieron eliminar los consumos seleccionados.');
    } finally {
      setDeleting(false);
    }
  }, [apiBaseUrl, currentPage, fetchConsumos, selectedMovementIds]);

  const selectedDistributor = distributors.find((item) => String(item.id) === distributorId);
  const periodLabel = `${dateFrom || '—'} - ${dateTo || '—'}`;
  const activePage = pagination?.page ?? currentPage;
  const inferredTotalPages = Math.max(1, Math.ceil((totals?.movements ?? rows.length) / CONSUMOS_PER_PAGE));
  const totalPages = pagination?.total_pages ?? inferredTotalPages;
  const hasPrevPage = pagination ? pagination.has_prev_page : activePage > 1;
  const hasNextPage = pagination ? pagination.has_next_page : activePage < totalPages;

  const exportConsumosExcel = () => {
    if (rows.length === 0) {
      window.alert('No hay datos para exportar.');
      return;
    }

    const sanitizeCell = (raw: string): string => {
      const cleaned = raw.replace(/[\t\r\n]+/g, ' ').trim();
      if (/^\d+$/.test(cleaned) && (cleaned.length >= 10 || cleaned.startsWith('0'))) {
        return `\u2060${cleaned}`;
      }
      return cleaned;
    };

    const summaryRows = [
      ['Distribuidor', selectedDistributor?.name ?? '—'],
      ['Dominio', domain.trim() || '—'],
      ['Nro. factura', invoiceNumber.trim() || '—'],
      ['Período', periodLabel],
      [],
      ['Movimientos', String(totals?.movements ?? 0)],
      ['Litros', formatNumber(totals?.liters ?? 0)],
      ['Importe', formatCurrency(totals?.amount ?? 0)],
      [],
    ];

    const headerRow = ['Fecha', 'Estación', 'Dominio', 'Producto', 'Nro. factura', 'Litros', 'Precio/Litro', 'Importe', 'Estado'];
    const dataRows = rows.map((row) => [
      formatDateTime(row.occurred_at),
      row.station ?? '',
      row.domain_norm ?? '',
      row.product ?? '',
      row.invoice_number ?? '',
      formatNumber(row.liters),
      formatNumber(row.price_per_liter),
      formatCurrency(row.amount ?? 0),
      getFuelStatusLabel(row.status, row.discounted),
    ]);

    const tsv = [...summaryRows, headerRow, ...dataRows]
      .map((row) => row.map((value) => sanitizeCell(String(value ?? ''))).join('\t'))
      .join('\n');

    const BOM = '\ufeff';
    const blob = new Blob([BOM + tsv], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `combustible-distribuidor-${Date.now()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportConsumosPdf = () => {
    if (rows.length === 0) {
      window.alert('No hay datos para exportar.');
      return;
    }

    const html = `
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Combustible por distribuidor</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1f2a44; margin: 24px; }
          h1 { font-size: 20px; margin: 0 0 4px; }
          .meta { font-size: 12px; color: #55627a; margin-bottom: 12px; }
          .summary { margin-bottom: 12px; font-size: 12px; }
          .summary span { display: inline-block; margin-right: 16px; }
          table.data { width: 100%; border-collapse: collapse; font-size: 12px; }
          table.data th { text-align: left; background: #eef3fb; padding: 8px; border: 1px solid #e1e8f5; }
          table.data td { padding: 8px; border: 1px solid #e1e8f5; }
        </style>
      </head>
      <body>
        <h1>Consumo de combustible</h1>
        <div class="meta">
          Distribuidor: ${selectedDistributor?.name ?? '—'} · Dominio: ${domain.trim() || '—'} · Nro. factura: ${
            invoiceNumber.trim() || '—'
          } · Período: ${periodLabel}
        </div>
        <div class="summary">
          <span>Movimientos: ${totals?.movements ?? 0}</span>
          <span>Litros: ${formatNumber(totals?.liters ?? 0)}</span>
          <span>Importe: ${formatCurrency(totals?.amount ?? 0)}</span>
        </div>
        <table class="data">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Estación</th>
              <th>Dominio</th>
              <th>Producto</th>
              <th>Nro. factura</th>
              <th>Litros</th>
              <th>Precio/Litro</th>
              <th>Importe</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
              <tr>
                <td>${formatDateTime(row.occurred_at)}</td>
                <td>${row.station ?? ''}</td>
                <td>${row.domain_norm ?? ''}</td>
                <td>${row.product ?? ''}</td>
                <td>${row.invoice_number ?? ''}</td>
                <td>${formatNumber(row.liters)}</td>
                <td>${formatNumber(row.price_per_liter)}</td>
                <td>${formatCurrency(row.amount ?? 0)}</td>
                <td>${getFuelStatusLabel(row.status, row.discounted)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (!win) {
      window.alert('No se pudo abrir la vista de impresión.');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <DashboardLayout title="Combustible" subtitle="Vista por distribuidor" headerContent={<CombustibleTabs />}>
      <section className="dashboard-card">
        <header className="card-header">
          <h3>Crear distribuidor</h3>
        </header>
        <div className="card-body">
          <div className="form-grid">
            <label className="input-control">
              <span>Nombre</span>
              <input
                value={newDistributorName}
                onChange={(event) => setNewDistributorName(event.target.value)}
                placeholder="Distribuidor Norte"
              />
            </label>
            <label className="input-control">
              <span>Código (opcional)</span>
              <input
                value={newDistributorCode}
                onChange={(event) => setNewDistributorCode(event.target.value)}
                placeholder="DN-001"
              />
            </label>
          </div>
          <div className="filters-actions">
            <button type="button" className="secondary-action" onClick={handleCreateDistributor}>
              Crear distribuidor
            </button>
          </div>
        </div>
      </section>

      <div className="form-grid">
        <label className="input-control">
          <span>Distribuidor</span>
          <select
            value={distributorId}
            onChange={(event) => {
              const value = event.target.value;
              setDistributorId(value);
              const selected = distributors.find((item) => String(item.id) === value);
              setManualDistributorName(selected?.name ?? '');
            }}
          >
            <option value="">Seleccionar</option>
            {distributors.map((distributor) => (
              <option key={`dist-${distributor.id}`} value={distributor.id}>
                {distributor.name}
              </option>
            ))}
          </select>
        </label>
        <label className="input-control">
          <span>Distribuidor manual</span>
          <input
            list="combustible-distribuidores-manual"
            value={manualDistributorName}
            onChange={(event) => {
              setManualDistributorName(event.target.value);
              if (event.target.value.trim() !== '' && distributorId) {
                setDistributorId('');
              }
            }}
            placeholder="Nombre o código"
          />
          <datalist id="combustible-distribuidores-manual">
            {distributors.map((distributor) => (
              <option
                key={`dist-manual-${distributor.id}`}
                value={distributor.name}
                label={distributor.code ? `${distributor.name} (${distributor.code})` : distributor.name}
              />
            ))}
          </datalist>
        </label>
        <label className="input-control">
          <span>Dominio</span>
          <input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="ABC123" />
        </label>
        <label className="input-control">
          <span>Nro. factura</span>
          <input
            value={invoiceNumber}
            onChange={(event) => setInvoiceNumber(event.target.value)}
            placeholder="Ej: 001-00012345"
          />
        </label>
        <label className="input-control">
          <span>Período</span>
          <select
            value={periodPreset}
            onChange={(event) => {
              const value = event.target.value as 'Q1' | 'Q2' | 'MONTH' | '';
              setPeriodPreset(value);
              if (value) {
                const baseDate = dateFrom || dateTo || new Date().toISOString().slice(0, 10);
                applyPeriodPreset(value, baseDate);
              }
            }}
          >
            <option value="">Personalizado</option>
            <option value="Q1">Primera quincena</option>
            <option value="Q2">Segunda quincena</option>
            <option value="MONTH">Mes completo</option>
          </select>
        </label>
        <label className="input-control">
          <span>Desde</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPeriodPreset('');
            }}
          />
        </label>
        <label className="input-control">
          <span>Hasta</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPeriodPreset('');
            }}
          />
        </label>
      </div>
      <div className="filters-actions">
        <button
          type="button"
          className="primary-action"
          onClick={() => {
            setCurrentPage(1);
            fetchConsumos(1);
          }}
          disabled={loading || deleting}
        >
          Buscar
        </button>
        <button
          type="button"
          className="secondary-action secondary-action--ghost"
          onClick={exportConsumosExcel}
          disabled={!rows.length || loading || deleting}
        >
          Exportar Excel
        </button>
        <button
          type="button"
          className="secondary-action secondary-action--ghost"
          onClick={exportConsumosPdf}
          disabled={!rows.length || loading || deleting}
        >
          Exportar PDF
        </button>
        <button
          type="button"
          className="secondary-action secondary-action--danger"
          onClick={handleDeleteSelectedMovements}
          disabled={selectedMovementIds.size === 0 || loading || deleting}
        >
          {deleting ? 'Eliminando...' : 'Desaparecer seleccionados'}
        </button>
        {selectedMovementIds.size > 0 ? (
          <span className="form-info">
            {`${selectedMovementIds.size} seleccionado${selectedMovementIds.size === 1 ? '' : 's'}`}
          </span>
        ) : null}
      </div>
      {actionMessage ? <p className="form-info form-info--success">{actionMessage}</p> : null}
      {actionError ? <p className="form-info form-info--error">{actionError}</p> : null}

      <div className="summary-cards">
        <div className="summary-card">
          <span className="summary-card__label">Movimientos</span>
          <strong className="summary-card__value">{totals?.movements ?? 0}</strong>
        </div>
        <div className="summary-card">
          <span className="summary-card__label">Litros</span>
          <strong className="summary-card__value">{formatNumber(totals?.liters ?? 0)}</strong>
        </div>
        <div className="summary-card">
          <span className="summary-card__label">Importe</span>
          <strong className="summary-card__value">{formatCurrency(totals?.amount ?? 0)}</strong>
        </div>
        <div className="summary-card">
          <span className="summary-card__label">Tomados</span>
          <strong className="summary-card__value">
            {totals?.discount_counts?.taken ?? rows.filter((row) => Boolean(row.discounted)).length}
          </strong>
        </div>
        <div className="summary-card">
          <span className="summary-card__label">No tomados</span>
          <strong className="summary-card__value">
            {totals?.discount_counts?.not_taken ??
              rows.filter((row) => !row.discounted && row.status !== 'DISCOUNTED').length}
          </strong>
        </div>
      </div>
      {(totals?.movements ?? rows.length) > rows.length ? (
        <p className="helper-text">
          Mostrando {rows.length} de {totals?.movements ?? rows.length} movimientos (página {activePage} de{' '}
          {Math.max(1, pagination?.total_pages ?? totalPages)}).
        </p>
      ) : null}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  aria-label="Seleccionar todos los consumos visibles"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllMovements}
                  disabled={!rows.length || loading || deleting}
                />
              </th>
              <th>Fecha</th>
              <th>Estación</th>
              <th>Dominio</th>
              <th>Producto</th>
              <th>Nro. factura</th>
              <th>Litros</th>
              <th>Precio/Litro</th>
              <th>Importe</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10}>Cargando consumos...</td>
              </tr>
            )}
            {error && !loading && (
              <tr>
                <td colSpan={10} className="error-cell">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={10}>No hay consumos para mostrar.</td>
              </tr>
            )}
            {!loading &&
              !error &&
              rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar consumo ${row.id}`}
                      checked={selectedMovementIds.has(row.id)}
                      onChange={() => toggleSelectMovement(row.id)}
                      disabled={deleting}
                    />
                  </td>
                  <td>{formatDateTime(row.occurred_at)}</td>
                  <td>{row.station ?? '—'}</td>
                  <td>{row.domain_norm ?? '—'}</td>
                  <td>{row.product ?? '—'}</td>
                  <td>{row.invoice_number ?? '—'}</td>
                  <td>{formatNumber(row.liters)}</td>
                  <td>{formatNumber(row.price_per_liter)}</td>
                  <td>{formatCurrency(row.amount ?? 0)}</td>
                  <td>{renderFuelStatusBadge(row.status, row.discounted)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <footer className="table-footer">
        <span>
          {loading
            ? 'Cargando consumos...'
            : `Página ${activePage} de ${totalPages} · ${totals?.movements ?? rows.length} movimiento${
                (totals?.movements ?? rows.length) === 1 ? '' : 's'
              }`}
        </span>
        <div className="pagination">
          <button
            type="button"
            aria-label="Página anterior"
            onClick={() => fetchConsumos(activePage - 1)}
            disabled={loading || deleting || !hasPrevPage}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Página siguiente"
            onClick={() => fetchConsumos(activePage + 1)}
            disabled={loading || deleting || !hasNextPage}
          >
            ›
          </button>
        </div>
      </footer>
    </DashboardLayout>
  );
};

const CombustibleInformePage: React.FC = () => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const location = useLocation();
  const [distributors, setDistributors] = useState<Array<{ id: number; name: string; code?: string | null }>>([]);
  const [distributorId, setDistributorId] = useState('');
  const [liquidaciones, setLiquidaciones] = useState<
    Array<{
      id: number;
      persona_id: number | null;
      persona_nombre?: string | null;
      persona_legajo?: string | null;
      nombre_original: string | null;
      importe_facturar: number | null;
      created_at: string | null;
    }>
  >([]);
  const [liquidacionId, setLiquidacionId] = useState('');
  const [newDistributorName, setNewDistributorName] = useState('');
  const [newDistributorCode, setNewDistributorCode] = useState('');
  const [domain, setDomain] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [periodPreset, setPeriodPreset] = useState<'Q1' | 'Q2' | 'MONTH' | ''>('');
  const [reportId, setReportId] = useState<number | null>(null);
  const [reportTotals, setReportTotals] = useState<{ total: number; ajustes: number; totalFacturar: number } | null>(
    null
  );
  const [reportStatus, setReportStatus] = useState<'DRAFT' | 'READY' | 'APPLIED' | null>(null);
  const [suggestedDistributors, setSuggestedDistributors] = useState<Array<{ id: number; name: string; code?: string | null }>>([]);
  const [closeYear, setCloseYear] = useState(() => new Date().getFullYear());
  const [closeMonth, setCloseMonth] = useState(() => new Date().getMonth() + 1);
  const [closePeriod, setClosePeriod] = useState<'Q1' | 'Q2' | 'MONTH'>('Q1');
  const [closeDistributorId, setCloseDistributorId] = useState('');
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeMessage, setCloseMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<
    Array<{
      id: number;
      occurred_at: string | null;
      station: string | null;
      domain_norm: string | null;
      product: string | null;
      liters: number | null;
      price_per_liter: number | null;
      amount: number | null;
      status?: string | null;
      discounted?: boolean | null;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<
    Array<{
      id: number;
      type:
        | 'ajuste_favor'
        | 'cuota_combustible'
        | 'pendiente'
        | 'adelantos_prestamos'
        | 'credito'
        | 'debito';
      amount: string;
      note: string;
    }>
  >([]);
  const [adjustmentType, setAdjustmentType] = useState<
    'ajuste_favor' | 'cuota_combustible' | 'pendiente' | 'adelantos_prestamos' | 'credito' | 'debito'
  >('ajuste_favor');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const autoGenerateRef = useRef(false);
  const autoApplyRef = useRef(false);
  const prefillRef = useRef(false);
  const adjustmentTypeLabels: Record<string, string> = {
    ajuste_favor: 'Ajuste a favor',
    cuota_combustible: 'Cuota combustible',
    pendiente: 'Pendiente',
    adelantos_prestamos: 'Adelantos/Préstamos',
    credito: 'Crédito',
    debito: 'Débito',
  };

  const adjustmentsByType = useMemo(() => {
    if (!adjustments.length) {
      return [];
    }
    const signedValueForType = (type: string, value: number) => {
      if (type === 'debito') {
        return -value;
      }
      return value;
    };
    const totals = new Map<string, number>();
    adjustments.forEach((adj) => {
      const parsed = Number(String(adj.amount).replace(',', '.'));
      const value = Number.isFinite(parsed) ? parsed : 0;
      totals.set(adj.type, (totals.get(adj.type) ?? 0) + signedValueForType(adj.type, value));
    });
    return Array.from(totals.entries()).map(([type, total]) => ({
      type,
      label: adjustmentTypeLabels[type] ?? type,
      total,
    }));
  }, [adjustments, adjustmentTypeLabels]);
  const normalizeMatchValue = useCallback((value?: string | null) => {
    if (!value) {
      return '';
    }
    return value
      .toUpperCase()
      .replace(/[\s\.\-_,]+/g, '')
      .trim();
  }, []);

  const applyPeriodPreset = useCallback(
    (preset: 'Q1' | 'Q2' | 'MONTH', baseDate?: string) => {
      const normalizedBase = baseDate && baseDate.trim() !== '' ? baseDate : new Date().toISOString().slice(0, 10);
      const parsed = new Date(`${normalizedBase}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) {
        return;
      }
      const year = parsed.getFullYear();
      const month = parsed.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const toIso = (date: Date) => date.toISOString().slice(0, 10);
      if (preset === 'Q1') {
        setDateFrom(toIso(firstDay));
        setDateTo(toIso(new Date(year, month, 15)));
      } else if (preset === 'Q2') {
        setDateFrom(toIso(new Date(year, month, 16)));
        setDateTo(toIso(lastDay));
      } else {
        setDateFrom(toIso(firstDay));
        setDateTo(toIso(lastDay));
      }
    },
    []
  );

  const autoApplyEnabled = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('auto_apply') === '1';
  }, [location.search]);

  useEffect(() => {
    if (prefillRef.current) {
      return;
    }
    const params = new URLSearchParams(location.search);
    const liquidacionParam = params.get('liquidacion_id');
    const domainParam = params.get('domain');
    const dateFromParam = params.get('date_from');
    const dateToParam = params.get('date_to');
    const distributorParam = params.get('distributor_id');
    if (liquidacionParam) {
      setLiquidacionId(liquidacionParam);
    }
    if (domainParam) {
      setDomain(domainParam);
    }
    if (dateFromParam) {
      setDateFrom(dateFromParam);
    }
    if (dateToParam) {
      setDateTo(dateToParam);
    }
    if (distributorParam) {
      setDistributorId(distributorParam);
    }
    if (domainParam || dateFromParam || dateToParam || liquidacionParam || distributorParam) {
      prefillRef.current = true;
    }
  }, [location.search]);

  useEffect(() => {
    const loadDistributors = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/combustible/distribuidores`, { credentials: 'include' });
        if (!response.ok) {
          throw new Error('No se pudieron cargar los distribuidores.');
        }
        const payload = await parseJsonSafe(response);
        setDistributors(Array.isArray(payload.data) ? payload.data : []);
      } catch {
        setDistributors([]);
      }
    };
    loadDistributors();
  }, [apiBaseUrl]);

  useEffect(() => {
    const loadLiquidaciones = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/combustible/liquidaciones`, { credentials: 'include' });
        if (!response.ok) {
          throw new Error('No se pudieron cargar las liquidaciones.');
        }
        const payload = await parseJsonSafe(response);
        setLiquidaciones(Array.isArray(payload.data) ? payload.data : []);
      } catch {
        setLiquidaciones([]);
      }
    };
    loadLiquidaciones();
  }, [apiBaseUrl]);


  const handleCreateDistributor = async () => {
    if (!newDistributorName.trim()) {
      setError('Ingresa el nombre del distribuidor.');
      return;
    }
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/combustible/distribuidores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newDistributorName.trim(),
          code: newDistributorCode.trim() || null,
        }),
      });
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? 'No se pudo crear el distribuidor.');
      }
      const payload = await parseJsonSafe(response);
      setDistributors((prev) => [...prev, payload.data].filter(Boolean));
      setNewDistributorName('');
      setNewDistributorCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el distribuidor.');
    }
  };

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!distributorId && !domain.trim()) {
        throw new Error('Ingresá un dominio o seleccioná un distribuidor.');
      }

      const response = await fetch(`${apiBaseUrl}/api/combustible/reportes/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          distributor_id: distributorId ? Number(distributorId) : null,
          domain_norm: domain.trim() || null,
          date_from: dateFrom || null,
          date_to: dateTo || null,
        }),
      });
      if (response.status === 409) {
        const payload = await parseJsonSafe(response).catch(() => null);
        setDistributorId('');
        setSuggestedDistributors(Array.isArray(payload?.options) ? payload.options : []);
        throw new Error(payload?.message ?? 'Seleccioná un distribuidor para continuar.');
      }
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? `No se pudo generar el informe (${response.status}).`);
      }
      const payload = await parseJsonSafe(response);
      setSuggestedDistributors([]);
      const baseItems = Array.isArray(payload.items) ? payload.items : [];
      const extraItems = Array.isArray(payload.extras) ? payload.extras : [];
      const mergedItems = [...baseItems, ...extraItems].sort((a, b) => {
        const dateA = a?.occurred_at ? new Date(a.occurred_at).getTime() : 0;
        const dateB = b?.occurred_at ? new Date(b.occurred_at).getTime() : 0;
        return dateA - dateB;
      });
      setRows(mergedItems);
      const selectedDistributor = distributors.find((item) => String(item.id) === distributorId);
      if (selectedDistributor) {
        const distributorCode = normalizeMatchValue(selectedDistributor.code ?? null);
        const distributorName = normalizeMatchValue(selectedDistributor.name ?? null);
        const matchedLiquidacion = liquidaciones.find((liquidacion) => {
          const personaLegajo = normalizeMatchValue(liquidacion.persona_legajo ?? null);
          const personaNombre = normalizeMatchValue(liquidacion.persona_nombre ?? null);
          const nombreOriginal = normalizeMatchValue(liquidacion.nombre_original ?? null);
          if (distributorCode && personaLegajo && distributorCode === personaLegajo) {
            return true;
          }
          if (distributorName && personaNombre && distributorName === personaNombre) {
            return true;
          }
          if (distributorName && nombreOriginal && nombreOriginal.includes(distributorName)) {
            return true;
          }
          return false;
        });
        if (matchedLiquidacion) {
          setLiquidacionId(String(matchedLiquidacion.id));
        }
      }
      setAdjustments(
        Array.isArray(payload.adjustments)
          ? payload.adjustments.map((adjustment: { id: number; type: string; amount: number; note: string }) => ({
              id: adjustment.id,
              type: adjustment.type || 'ajuste_favor',
              amount: String(adjustment.amount ?? ''),
              note: adjustment.note ?? '',
            }))
          : []
      );
      if (payload.report) {
        setReportId(payload.report.id);
        setReportStatus(payload.report.status ?? null);
        setReportTotals({
          total: Number(payload.report.total_amount) || 0,
          ajustes: Number(payload.report.adjustments_total) || 0,
          totalFacturar: Number(payload.report.total_to_bill) || 0,
        });
      } else {
        setReportId(null);
        setReportStatus(null);
        setReportTotals(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los movimientos.');
      setRows([]);
      setReportId(null);
      setReportTotals(null);
    } finally {
      setLoading(false);
    }
  }, [
    apiBaseUrl,
    distributorId,
    domain,
    dateFrom,
    dateTo,
    distributors,
    liquidaciones,
    normalizeMatchValue,
  ]);

  useEffect(() => {
    if (!distributorId) {
      return;
    }
    fetchMovements();
  }, [distributorId, fetchMovements]);

  const handleAddAdjustment = async () => {
    const amountValue = Number(adjustmentAmount.replace(',', '.'));
    if (!Number.isFinite(amountValue) || amountValue === 0) {
      setError('El ajuste debe tener un importe válido.');
      return;
    }

    if (!reportId) {
      setError('Primero generá el borrador del informe.');
      return;
    }

    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/combustible/reportes/${reportId}/ajustes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: adjustmentType,
          amount: amountValue,
          note: adjustmentNote,
        }),
      });
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? 'No se pudo agregar el ajuste.');
      }
      const payload = await parseJsonSafe(response);
      setAdjustments((prev) => [
        ...prev,
        {
          id: payload.data?.id ?? Date.now(),
          type: adjustmentType,
          amount: adjustmentAmount,
          note: adjustmentNote,
        },
      ]);
      if (payload.report) {
        setReportTotals({
          total: Number(payload.report.total_amount) || 0,
          ajustes: Number(payload.report.adjustments_total) || 0,
          totalFacturar: Number(payload.report.total_to_bill) || 0,
        });
        setReportStatus(payload.report.status ?? reportStatus);
      }
      setAdjustmentAmount('');
      setAdjustmentNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar el ajuste.');
    }
  };

  const handleApplyReport = async () => {
    if (!reportId) {
      setError('Primero generá el borrador del informe.');
      return;
    }
    if (totalFacturar <= 0) {
      setError('El total a facturar debe ser mayor a cero.');
      return;
    }
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/combustible/reportes/${reportId}/aplicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          liquidacion_id: liquidacionId ? Number(liquidacionId) : null,
        }),
      });
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? 'No se pudo aplicar el informe.');
      }
      const payload = await parseJsonSafe(response);
      setReportStatus(payload.data?.status ?? 'APPLIED');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aplicar el informe.');
    }
  };

  // auto-generate + auto-apply are defined after totals are available

  const handleSaveDraft = async () => {
    if (!reportId) {
      setError('Primero generá el borrador del informe.');
      return;
    }
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/combustible/reportes/${reportId}/guardar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? 'No se pudo guardar el borrador.');
      }
      const payload = await parseJsonSafe(response);
      setReportStatus(payload.data?.status ?? 'DRAFT');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el borrador.');
    }
  };

  const handleMarkReady = async () => {
    if (!reportId) {
      setError('Primero generá el borrador del informe.');
      return;
    }
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/combustible/reportes/${reportId}/listo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? 'No se pudo marcar listo.');
      }
      const payload = await parseJsonSafe(response);
      setReportStatus(payload.data?.status ?? 'READY');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo marcar listo.');
    }
  };

  const handleClosePeriod = async () => {
    setCloseLoading(true);
    setCloseMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/combustible/cierre`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          year: Number(closeYear),
          month: Number(closeMonth),
          period: closePeriod,
          distributor_id: closeDistributorId ? Number(closeDistributorId) : null,
        }),
      });
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? 'No se pudo cerrar el período.');
      }
      const payload = await parseJsonSafe(response);
      setCloseMessage(
        `Generados: ${payload?.created?.length ?? 0} · Omitidos: ${payload?.skipped?.length ?? 0}`
      );
    } catch (err) {
      setCloseMessage(err instanceof Error ? err.message : 'No se pudo cerrar el período.');
    } finally {
      setCloseLoading(false);
    }
  };

  const totalCombustible = reportTotals?.total ?? rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const totalAjustes = reportTotals?.ajustes ?? 0;
  const descuentoCombustible = reportTotals?.totalFacturar ?? totalCombustible + totalAjustes;
  const selectedLiquidacion = liquidaciones.find((liquidacion) => String(liquidacion.id) === liquidacionId);
  const importeDetalle = selectedLiquidacion?.importe_facturar ?? 0;
  const totalFacturar = importeDetalle - descuentoCombustible;
  const selectedDistributor = distributors.find((item) => String(item.id) === distributorId);

  useEffect(() => {
    if (!autoApplyEnabled || autoGenerateRef.current) {
      return;
    }
    if (!domain.trim() && !distributorId) {
      return;
    }
    if (!dateFrom || !dateTo) {
      return;
    }
    autoGenerateRef.current = true;
    fetchMovements();
  }, [autoApplyEnabled, domain, distributorId, dateFrom, dateTo, fetchMovements]);

  useEffect(() => {
    if (!autoApplyEnabled || autoApplyRef.current) {
      return;
    }
    if (!reportId || !liquidacionId) {
      return;
    }
    if (reportStatus === 'APPLIED') {
      return;
    }
    if (totalFacturar <= 0) {
      return;
    }
    autoApplyRef.current = true;
    handleApplyReport();
  }, [autoApplyEnabled, reportId, liquidacionId, reportStatus, totalFacturar]);

  const exportReportExcel = () => {
    if (rows.length === 0) {
      window.alert('No hay datos para exportar.');
      return;
    }

    const sanitizeCell = (raw: string): string => {
      const cleaned = raw.replace(/[\t\r\n]+/g, ' ').trim();
      if (/^\d+$/.test(cleaned) && (cleaned.length >= 10 || cleaned.startsWith('0'))) {
        return `\u2060${cleaned}`;
      }
      return cleaned;
    };

    const summaryRows = [
      ['Distribuidor', selectedDistributor?.name ?? '—'],
      ['Dominio', domain.trim() || '—'],
      ['Período', `${dateFrom || '—'} - ${dateTo || '—'}`],
      [],
      ['Importe detalle', formatCurrency(importeDetalle)],
      ['Total combustible', formatCurrency(totalCombustible)],
      ['Ajustes', formatCurrency(totalAjustes)],
      ['Total a facturar', formatCurrency(totalFacturar)],
      [],
    ];

    const headerRow = ['Fecha', 'Estación', 'Dominio', 'Producto', 'Litros', 'Precio/Litro', 'Importe', 'Estado'];
    const dataRows = rows.map((row) => [
      formatDateTime(row.occurred_at),
      row.station ?? '',
      row.domain_norm ?? '',
      row.product ?? '',
      formatNumber(row.liters),
      formatNumber(row.price_per_liter),
      formatCurrency(row.amount ?? 0),
      getFuelStatusLabel(row.status, row.discounted),
    ]);

    const tsv = [...summaryRows, headerRow, ...dataRows]
      .map((row) => row.map((value) => sanitizeCell(String(value ?? ''))).join('\t'))
      .join('\n');

    const BOM = '\ufeff';
    const blob = new Blob([BOM + tsv], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `informe-combustible-${reportId ?? Date.now()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportReportPdf = () => {
    if (rows.length === 0) {
      window.alert('No hay datos para exportar.');
      return;
    }

    const html = `
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Informe combustible</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1f2a44; margin: 24px; }
          h1 { font-size: 20px; margin: 0 0 4px; }
          .meta { font-size: 12px; color: #55627a; margin-bottom: 12px; }
          .layout { display: flex; gap: 24px; align-items: flex-start; }
          .summary { min-width: 240px; border: 1px solid #d9e2f2; border-radius: 8px; padding: 12px; }
          .summary table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .summary td { padding: 6px 0; border-bottom: 1px solid #eef2f8; }
          .summary td:last-child { text-align: right; font-weight: 600; }
          table.data { width: 100%; border-collapse: collapse; font-size: 12px; }
          table.data th { text-align: left; background: #eef3fb; padding: 8px; border: 1px solid #e1e8f5; }
          table.data td { padding: 8px; border: 1px solid #e1e8f5; }
        </style>
      </head>
      <body>
        <h1>Informe de consumo de combustible</h1>
        <div class="meta">
          Distribuidor: ${selectedDistributor?.name ?? '—'} · Dominio: ${domain.trim() || '—'} · Período: ${
      dateFrom || '—'
    } - ${dateTo || '—'}
        </div>
        <div class="layout">
          <div style="flex:1">
            <table class="data">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Estación</th>
                  <th>Dominio</th>
                  <th>Producto</th>
                  <th>Litros</th>
                  <th>Precio/Litro</th>
                  <th>Importe</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map(
                    (row) => `
                  <tr>
                    <td>${formatDateTime(row.occurred_at)}</td>
                    <td>${row.station ?? ''}</td>
                    <td>${row.domain_norm ?? ''}</td>
                    <td>${row.product ?? ''}</td>
                    <td>${formatNumber(row.liters)}</td>
                    <td>${formatNumber(row.price_per_liter)}</td>
                    <td>${formatCurrency(row.amount ?? 0)}</td>
                    <td>${getFuelStatusLabel(row.status, row.discounted)}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          <div class="summary">
            <table>
              <tr><td>Importe detalle</td><td>${formatCurrency(importeDetalle)}</td></tr>
              <tr><td>Total combustible</td><td>${formatCurrency(totalCombustible)}</td></tr>
              <tr><td>Ajustes</td><td>${formatCurrency(totalAjustes)}</td></tr>
              <tr><td>Total a facturar</td><td>${formatCurrency(totalFacturar)}</td></tr>
            </table>
          </div>
        </div>
      </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (!win) {
      window.alert('No se pudo abrir la vista de impresión.');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <DashboardLayout title="Combustible" subtitle="Informe" headerContent={<CombustibleTabs />}>
      <section className="dashboard-card">
        <header className="card-header">
          <h3>Crear distribuidor</h3>
        </header>
        <div className="card-body">
          <div className="form-grid">
            <label className="input-control">
              <span>Nombre</span>
              <input
                value={newDistributorName}
                onChange={(event) => setNewDistributorName(event.target.value)}
                placeholder="Distribuidor Norte"
              />
            </label>
            <label className="input-control">
              <span>Código (opcional)</span>
              <input
                value={newDistributorCode}
                onChange={(event) => setNewDistributorCode(event.target.value)}
                placeholder="DN-001"
              />
            </label>
          </div>
          <div className="filters-actions">
            <button type="button" className="secondary-action" onClick={handleCreateDistributor}>
              Crear distribuidor
            </button>
          </div>
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <h3>Cerrar período</h3>
          <p>Genera informes sugeridos por distribuidor para el período seleccionado.</p>
        </header>
        <div className="card-body">
          <div className="form-grid">
            <label className="input-control">
              <span>Año</span>
              <input
                type="number"
                value={closeYear}
                onChange={(event) => setCloseYear(Number(event.target.value))}
              />
            </label>
            <label className="input-control">
              <span>Mes</span>
              <input
                type="number"
                min={1}
                max={12}
                value={closeMonth}
                onChange={(event) => setCloseMonth(Number(event.target.value))}
              />
            </label>
            <label className="input-control">
              <span>Período</span>
              <select value={closePeriod} onChange={(event) => setClosePeriod(event.target.value as 'Q1' | 'Q2' | 'MONTH')}>
                <option value="Q1">Primera quincena</option>
                <option value="Q2">Segunda quincena</option>
                <option value="MONTH">Mes completo</option>
              </select>
            </label>
            <label className="input-control">
              <span>Distribuidor (opcional)</span>
              <select value={closeDistributorId} onChange={(event) => setCloseDistributorId(event.target.value)}>
                <option value="">Todos</option>
                {distributors.map((dist) => (
                  <option key={`close-${dist.id}`} value={dist.id}>
                    {dist.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="filters-actions">
            <button type="button" className="secondary-action" onClick={handleClosePeriod} disabled={closeLoading}>
              {closeLoading ? 'Procesando…' : 'Cerrar período'}
            </button>
            {closeMessage ? <span className="helper-text">{closeMessage}</span> : null}
          </div>
        </div>
      </section>

      <section className="dashboard-card informe-card">
        <header className="card-header informe-header">
          <div>
            <h3>Descontar Consumo de Combustible</h3>
            <p>Seleccioná el distribuidor y el rango para generar el informe.</p>
          </div>
          <div className="informe-header__actions">
            <button type="button" className="secondary-action secondary-action--ghost" onClick={exportReportExcel} disabled={!rows.length}>
              Exportar Excel
            </button>
            <button type="button" className="secondary-action secondary-action--ghost" onClick={exportReportPdf} disabled={!rows.length}>
              Exportar PDF
            </button>
            <button type="button" className="primary-action" onClick={fetchMovements}>
              Generar informe
            </button>
          </div>
        </header>
        <div className="card-body">
          <div className="form-grid">
            {suggestedDistributors.length > 0 ? (
              <label className="input-control">
                <span>Distribuidor</span>
                <select value={distributorId} onChange={(event) => setDistributorId(event.target.value)}>
                  <option value="">Seleccionar</option>
                  {suggestedDistributors.map((distributor) => (
                    <option key={`dist-${distributor.id}`} value={distributor.id}>
                      {distributor.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="input-control">
              <span>Dominio</span>
              <input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="ABC123" />
            </label>
            <label className="input-control">
              <span>Período</span>
              <select
                value={periodPreset}
                onChange={(event) => {
                  const value = event.target.value as 'Q1' | 'Q2' | 'MONTH' | '';
                  setPeriodPreset(value);
                  if (value) {
                    const baseDate = dateFrom || dateTo || new Date().toISOString().slice(0, 10);
                    applyPeriodPreset(value, baseDate);
                  }
                }}
              >
                <option value="">Personalizado</option>
                <option value="Q1">Primera quincena</option>
                <option value="Q2">Segunda quincena</option>
                <option value="MONTH">Mes completo</option>
              </select>
            </label>
            <label className="input-control">
              <span>Desde</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setPeriodPreset('');
                }}
              />
            </label>
            <label className="input-control">
              <span>Hasta</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setPeriodPreset('');
                }}
              />
            </label>
          </div>
        </div>
      </section>

      <div className="informe-layout">
        <div className="informe-main">
          <section className="dashboard-card">
            <header className="card-header">
              <h3>Detalle de movimientos</h3>
            </header>
            <div className="table-wrapper">
              <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estación</th>
                <th>Dominio</th>
                <th>Producto</th>
                <th>Litros</th>
                <th>Precio/Litro</th>
                <th>Importe</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8}>Cargando movimientos...</td>
                </tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={8}>No hay movimientos.</td>
                </tr>
              )}
              {!loading &&
                !error &&
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.occurred_at)}</td>
                    <td>{row.station ?? '—'}</td>
                    <td>{row.domain_norm ?? '—'}</td>
                    <td>{row.product ?? '—'}</td>
                    <td>{formatNumber(row.liters)}</td>
                    <td>{formatNumber(row.price_per_liter)}</td>
                    <td>{formatCurrency(row.amount ?? 0)}</td>
                    <td>{renderFuelStatusBadge(row.status, row.discounted)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
            </div>
          </section>

          <section className="dashboard-card">
            <header className="card-header">
              <h3>Ajustes manuales</h3>
            </header>
            <div className="card-body">
              <div className="form-grid">
                <label className="input-control">
                  <span>Tipo</span>
                  <select
                    value={adjustmentType}
                    onChange={(event) =>
                      setAdjustmentType(
                        event.target.value as
                          | 'ajuste_favor'
                          | 'cuota_combustible'
                          | 'pendiente'
                          | 'adelantos_prestamos'
                          | 'credito'
                          | 'debito'
                      )
                    }
                  >
                    <option value="ajuste_favor">Ajuste a favor</option>
                    <option value="cuota_combustible">Cuota combustible</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="adelantos_prestamos">Adelantos/Préstamos</option>
                  </select>
                </label>
                <label className="input-control">
                  <span>Importe</span>
                  <input value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} />
                </label>
                <label className="input-control">
                  <span>Nota</span>
                  <input value={adjustmentNote} onChange={(event) => setAdjustmentNote(event.target.value)} />
                </label>
              </div>
              <div className="filters-actions">
                <button type="button" className="secondary-action" onClick={handleAddAdjustment}>
                  Agregar ajuste
                </button>
              </div>
              {adjustments.length === 0 ? (
                <p className="form-info">No hay ajustes cargados.</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Importe</th>
                        <th>Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjustments.map((adj) => (
                        <tr key={adj.id}>
                          <td>{adjustmentTypeLabels[adj.type] ?? adj.type}</td>
                          <td>{formatCurrency(adj.amount)}</td>
                          <td>{adj.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="summary-panel informe-summary">
          <div className="summary-panel__header">
            <div>
              <h3>Resumen del informe</h3>
              <p>Totales calculados para el período.</p>
            </div>
            <span className="summary-panel__status">{reportStatus ?? '—'}</span>
          </div>
          <div className="summary-panel__grid">
            <div className="summary-panel__row">
              <span>Importe detalle</span>
              <strong>{formatCurrency(importeDetalle)}</strong>
            </div>
            <div className="summary-panel__row">
              <span>Total combustible</span>
              <strong>{formatCurrency(totalCombustible)}</strong>
            </div>
            <div className="summary-panel__row">
              <span>Ajustes</span>
              <strong>{formatCurrency(totalAjustes)}</strong>
            </div>
            {adjustmentsByType.length > 0 ? (
              <div className="summary-panel__breakdown">
                {adjustmentsByType.map((item) => (
                  <div key={`adj-${item.type}`} className="summary-panel__breakdown-row">
                    <span>{item.label}</span>
                    <strong>{formatCurrency(item.total)}</strong>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="summary-panel__row summary-panel__row--total">
              <span>Total a facturar</span>
              <strong>{formatCurrency(totalFacturar)}</strong>
            </div>
          </div>
          <div className="summary-panel__divider" />
          <label className="input-control summary-panel__input">
            <span>Liquidación</span>
            <select value={liquidacionId} onChange={(event) => setLiquidacionId(event.target.value)}>
              <option value="">Seleccionar</option>
              {liquidaciones.map((liquidacion) => (
                <option key={`liq-${liquidacion.id}`} value={liquidacion.id}>
                  #{liquidacion.id} {liquidacion.persona_nombre ?? ''}{' '}
                  {liquidacion.persona_legajo ? `(${liquidacion.persona_legajo})` : ''} {liquidacion.nombre_original ?? ''}{' '}
                  {liquidacion.created_at ?? ''}
                </option>
              ))}
            </select>
          </label>
          <div className="summary-panel__actions">
            <button type="button" className="secondary-action" onClick={handleSaveDraft} disabled={!reportId}>
              Guardar borrador
            </button>
            <button type="button" className="secondary-action secondary-action--ghost" onClick={handleMarkReady} disabled={!reportId}>
              Marcar listo
            </button>
            <button
              type="button"
              className="secondary-action secondary-action--ghost"
              onClick={handleApplyReport}
              disabled={!reportId || totalFacturar <= 0 || reportStatus === 'APPLIED'}
            >
              Aplicar descuento
            </button>
          </div>
          {error ? <p className="form-info form-info--error">{error}</p> : null}
        </aside>
      </div>
    </DashboardLayout>
  );
};

const CombustibleTardiasPage: React.FC = () => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<
    Array<{
      id: number;
      occurred_at: string | null;
      station: string | null;
      domain_norm: string | null;
      product: string | null;
      liters: number | null;
      price_per_liter: number | null;
      amount: number | null;
      late_report_id: number | null;
      manual_adjustment_required: boolean;
      manual_adjustment_amount?: number | null;
      manual_adjustment_note?: string | null;
      observations: string | null;
    }>
  >([]);
  const [totals, setTotals] = useState<{ movements: number; liters: number; amount: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjustModalRow, setAdjustModalRow] = useState<{
    id: number;
    domain_norm: string | null;
    amount: number | null;
    note: string;
  } | null>(null);
  const [adjustModalSaving, setAdjustModalSaving] = useState(false);

  const loadTardias = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`${apiBaseUrl}/api/combustible/tardias`);
      if (search.trim()) {
        url.searchParams.set('search', search.trim());
      }
      const response = await fetch(url.toString(), { credentials: 'include' });
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? 'No se pudieron cargar las cargas tardías.');
      }
      const payload = await parseJsonSafe(response);
      setRows(Array.isArray(payload.data) ? payload.data : []);
      setTotals(payload.totals ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las cargas tardías.');
      setRows([]);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, search]);

  useEffect(() => {
    loadTardias();
  }, [loadTardias]);

  return (
    <DashboardLayout title="Combustible" subtitle="Cargas tardías" headerContent={<CombustibleTabs />}>
      <section className="dashboard-card">
        <header className="card-header">
          <h3>Cargas tardías</h3>
        </header>
        <div className="card-body">
          <div className="filters-actions">
            <input
              className="input-control"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar dominio"
            />
            <button type="button" className="secondary-action" onClick={loadTardias} disabled={loading}>
              Buscar
            </button>
          </div>
          <div className="summary-cards">
            <div className="summary-card">
              <span className="summary-card__label">Movimientos</span>
              <strong className="summary-card__value">{totals?.movements ?? 0}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-card__label">Litros</span>
              <strong className="summary-card__value">{formatNumber(totals?.liters ?? 0)}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-card__label">Importe</span>
              <strong className="summary-card__value">{formatCurrency(totals?.amount ?? 0)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <h3>Detalle</h3>
        </header>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estación</th>
                <th>Dominio</th>
                <th>Producto</th>
                <th>Litros</th>
                <th>Precio/Litro</th>
                <th>Importe</th>
                <th>Informe</th>
                <th>Observaciones</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10}>Cargando...</td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={10} className="error-cell">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={10}>No hay cargas tardías.</td>
                </tr>
              )}
              {!loading &&
                !error &&
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.occurred_at)}</td>
                    <td>{row.station ?? '—'}</td>
                    <td>{row.domain_norm ?? '—'}</td>
                    <td>{row.product ?? '—'}</td>
                    <td>{formatNumber(row.liters)}</td>
                    <td>{formatNumber(row.price_per_liter)}</td>
                    <td>{formatCurrency(row.amount ?? 0)}</td>
                    <td>{row.late_report_id ?? '—'}</td>
                    <td>{row.observations ?? '—'}</td>
                    <td>
                      {row.manual_adjustment_required ? (
                        <span className="status-badge status-badge--liquidacion is-no">Requiere ajuste</span>
                      ) : (
                        <button
                          type="button"
                          className="secondary-action secondary-action--ghost"
                          onClick={async () => {
                            setAdjustModalRow({
                              id: row.id,
                              domain_norm: row.domain_norm,
                              amount: row.manual_adjustment_amount ?? null,
                              note: row.manual_adjustment_note ?? '',
                            });
                          }}
                        >
                          Requiere ajuste manual
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      {adjustModalRow ? (
        <div className="paste-overlay" role="dialog" aria-modal="true">
          <div className="paste-modal">
            <h3>Requiere ajuste manual</h3>
            <p className="paste-modal__hint">
              Dominio: <strong>{adjustModalRow.domain_norm ?? '—'}</strong>
            </p>
            <div className="form-grid">
              <label className="input-control">
                <span>Importe</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={adjustModalRow.amount ?? ''}
                  onChange={(event) =>
                    setAdjustModalRow((prev) =>
                      prev ? { ...prev, amount: event.target.value === '' ? null : Number(event.target.value) } : prev
                    )
                  }
                />
              </label>
              <label className="input-control">
                <span>Nota</span>
                <input
                  value={adjustModalRow.note}
                  onChange={(event) =>
                    setAdjustModalRow((prev) => (prev ? { ...prev, note: event.target.value } : prev))
                  }
                />
              </label>
            </div>
            <div className="paste-modal__actions">
              <button
                type="button"
                className="secondary-action"
                onClick={() => setAdjustModalRow(null)}
                disabled={adjustModalSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-action"
                disabled={adjustModalSaving}
                onClick={async () => {
                  if (!adjustModalRow) {
                    return;
                  }
                  try {
                    setAdjustModalSaving(true);
                    const response = await fetch(
                      `${apiBaseUrl}/api/combustible/tardias/${adjustModalRow.id}/requiere-ajuste`,
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                          amount: adjustModalRow.amount,
                          note: adjustModalRow.note,
                        }),
                      }
                    );
                    if (!response.ok) {
                      const payload = await parseJsonSafe(response).catch(() => null);
                      throw new Error(payload?.message ?? 'No se pudo marcar el ajuste.');
                    }
                    const payload = await parseJsonSafe(response);
                    setRows((prev) =>
                      prev.map((item) =>
                        item.id === adjustModalRow.id
                          ? {
                              ...item,
                              manual_adjustment_required: true,
                              manual_adjustment_amount: payload?.data?.manual_adjustment_amount ?? item.manual_adjustment_amount,
                              manual_adjustment_note: payload?.data?.manual_adjustment_note ?? item.manual_adjustment_note,
                              observations: payload?.data?.observations ?? item.observations,
                            }
                          : item
                      )
                    );
                    setAdjustModalRow(null);
                  } catch (err) {
                    window.alert(err instanceof Error ? err.message : 'No se pudo marcar el ajuste.');
                  } finally {
                    setAdjustModalSaving(false);
                  }
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
};

const CombustibleConsumosPage: React.FC = () => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const CONSUMOS_PER_PAGE = 500;
  const [distributors, setDistributors] = useState<Array<{ id: number; name: string; code?: string | null }>>([]);
  const [distributorId, setDistributorId] = useState('');
  const [domain, setDomain] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [sourceFile, setSourceFile] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [periodPreset, setPeriodPreset] = useState<'Q1' | 'Q2' | 'MONTH' | ''>('');
  const [onlyPending, setOnlyPending] = useState(false);
  const [onlyImputed, setOnlyImputed] = useState(false);
  const [rows, setRows] = useState<
    Array<{
      id: number;
      occurred_at: string | null;
      station: string | null;
      domain_norm: string | null;
      product: string | null;
      invoice_number?: string | null;
      liters: number | null;
      amount: number | null;
      price_per_liter: number | null;
      status: string | null;
      discounted?: boolean | null;
    }>
  >([]);
  const [totals, setTotals] = useState<{
    movements: number;
    liters: number;
    amount: number;
    returned?: number;
    limit?: number;
    discount_counts?: { taken: number; not_taken: number };
    status_counts?: Record<string, number>;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<{
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next_page: boolean;
    has_prev_page: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPeriodPreset = useCallback(
    (preset: 'Q1' | 'Q2' | 'MONTH', baseDate?: string) => {
      const normalizedBase = baseDate && baseDate.trim() !== '' ? baseDate : new Date().toISOString().slice(0, 10);
      const parsed = new Date(`${normalizedBase}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) {
        return;
      }
      const year = parsed.getFullYear();
      const month = parsed.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const toIso = (date: Date) => date.toISOString().slice(0, 10);
      if (preset === 'Q1') {
        setDateFrom(toIso(firstDay));
        setDateTo(toIso(new Date(year, month, 15)));
      } else if (preset === 'Q2') {
        setDateFrom(toIso(new Date(year, month, 16)));
        setDateTo(toIso(lastDay));
      } else {
        setDateFrom(toIso(firstDay));
        setDateTo(toIso(lastDay));
      }
    },
    []
  );

  useEffect(() => {
    const loadDistributors = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/combustible/distribuidores`, { credentials: 'include' });
        if (!response.ok) {
          return;
        }
        const payload = await parseJsonSafe(response);
        setDistributors(Array.isArray(payload.data) ? payload.data : []);
      } catch {
        // noop
      }
    };
    loadDistributors();
  }, [apiBaseUrl]);

  const fetchConsumos = useCallback(
    async (requestedPage?: number) => {
      const nextPage = Math.max(1, Math.trunc(requestedPage ?? currentPage) || 1);
      setLoading(true);
      setError(null);
      try {
        const url = new URL(`${apiBaseUrl}/api/combustible/consumos`);
        if (distributorId) {
          url.searchParams.set('distributor_id', distributorId);
        }
        if (domain.trim()) {
          url.searchParams.set('domain', domain.trim());
        }
        if (invoiceNumber.trim()) {
          url.searchParams.set('invoice_number', invoiceNumber.trim());
        }
        if (sourceFile.trim()) {
          url.searchParams.set('source_file', sourceFile.trim());
        }
        if (dateFrom) {
          url.searchParams.set('date_from', dateFrom);
        }
        if (dateTo) {
          url.searchParams.set('date_to', dateTo);
        }
        if (onlyPending) {
          url.searchParams.set('only_pending', '1');
        }
        if (onlyImputed) {
          url.searchParams.set('only_imputed', '1');
        }
        url.searchParams.set('page', String(nextPage));
        url.searchParams.set('per_page', String(CONSUMOS_PER_PAGE));
        const response = await fetch(url.toString(), { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`No se pudieron cargar los consumos (${response.status}).`);
        }
        const payload = await parseJsonSafe(response);
        setRows(Array.isArray(payload.data) ? payload.data : []);
        if (payload.totals && typeof payload.totals === 'object') {
          setTotals({
            movements: Number(payload.totals.movements) || 0,
            liters: Number(payload.totals.liters) || 0,
            amount: Number(payload.totals.amount) || 0,
            returned: Number(payload.totals.returned) || 0,
            limit: Number(payload.totals.limit) || 0,
            discount_counts: payload.totals.discount_counts ?? undefined,
            status_counts: payload.totals.status_counts ?? undefined,
          });
        } else {
          setTotals(null);
        }
        if (payload.pagination && typeof payload.pagination === 'object') {
          const parsedPage = Math.max(1, Math.trunc(Number(payload.pagination.page) || 1));
          const parsedPerPage = Math.max(1, Math.trunc(Number(payload.pagination.per_page) || CONSUMOS_PER_PAGE));
          const parsedTotal = Math.max(0, Math.trunc(Number(payload.pagination.total) || 0));
          const parsedTotalPages = Math.max(1, Math.trunc(Number(payload.pagination.total_pages) || 1));
          const hasPrevPage = Boolean(payload.pagination.has_prev_page) || parsedPage > 1;
          const hasNextPage = Boolean(payload.pagination.has_next_page) || parsedPage < parsedTotalPages;
          setPagination({
            page: parsedPage,
            per_page: parsedPerPage,
            total: parsedTotal,
            total_pages: parsedTotalPages,
            has_next_page: hasNextPage,
            has_prev_page: hasPrevPage,
          });
          setCurrentPage(parsedPage);
        } else {
          const total = Number(payload?.totals?.movements) || (Array.isArray(payload.data) ? payload.data.length : 0);
          const totalPages = Math.max(1, Math.ceil(total / CONSUMOS_PER_PAGE));
          const safePage = Math.min(nextPage, totalPages);
          setPagination({
            page: safePage,
            per_page: CONSUMOS_PER_PAGE,
            total,
            total_pages: totalPages,
            has_next_page: safePage < totalPages,
            has_prev_page: safePage > 1,
          });
          setCurrentPage(safePage);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los consumos.');
        setRows([]);
        setTotals(null);
        setPagination(null);
      } finally {
        setLoading(false);
      }
    },
    [
      CONSUMOS_PER_PAGE,
      apiBaseUrl,
      currentPage,
      distributorId,
      domain,
      invoiceNumber,
      sourceFile,
      dateFrom,
      dateTo,
      onlyPending,
      onlyImputed,
    ]
  );

  useEffect(() => {
    fetchConsumos();
  }, [fetchConsumos]);

  const selectedDistributor = distributors.find((item) => String(item.id) === distributorId);
  const takenCount = totals?.discount_counts?.taken ?? rows.filter((row) => Boolean(row.discounted)).length;
  const notTakenCount =
    totals?.discount_counts?.not_taken ?? rows.filter((row) => !row.discounted && row.status !== 'DISCOUNTED').length;
  const statusEntries = Object.entries(totals?.status_counts ?? {}).sort((a, b) => b[1] - a[1]);
  const latestOccurredAt = rows.length > 0 ? rows[0]?.occurred_at ?? null : null;
  const activePage = pagination?.page ?? currentPage;
  const inferredTotalPages = Math.max(1, Math.ceil((totals?.movements ?? rows.length) / CONSUMOS_PER_PAGE));
  const totalPages = pagination?.total_pages ?? inferredTotalPages;
  const hasPrevPage = pagination ? pagination.has_prev_page : activePage > 1;
  const hasNextPage = pagination ? pagination.has_next_page : activePage < totalPages;

  return (
    <DashboardLayout title="Combustible" subtitle="Consumos registrados" headerContent={<CombustibleTabs />}>
      <section className="dashboard-card">
        <header className="card-header">
          <h3>Filtros</h3>
        </header>
        <div className="card-body">
          <div className="form-grid">
            <label className="input-control">
              <span>Distribuidor</span>
              <select
                value={distributorId}
                onChange={(event) => {
                  setDistributorId(event.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">Todos</option>
                {distributors.map((distributor) => (
                  <option key={`consumos-dist-${distributor.id}`} value={distributor.id}>
                    {distributor.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Dominio</span>
              <input
                value={domain}
                onChange={(event) => {
                  setDomain(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="ABC123"
              />
            </label>
            <label className="input-control">
              <span>Nro. factura</span>
              <input
                value={invoiceNumber}
                onChange={(event) => {
                  setInvoiceNumber(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Ej: 001-00012345"
              />
            </label>
            <label className="input-control">
              <span>Archivo</span>
              <input
                value={sourceFile}
                onChange={(event) => {
                  setSourceFile(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="ReporteConsumos-2026-01-22T094110.xlsx"
              />
            </label>
            <label className="input-control">
              <span>Período</span>
              <select
                value={periodPreset}
                onChange={(event) => {
                  const value = event.target.value as 'Q1' | 'Q2' | 'MONTH' | '';
                  setPeriodPreset(value);
                  setCurrentPage(1);
                  if (value) {
                    const baseDate = dateFrom || dateTo || new Date().toISOString().slice(0, 10);
                    applyPeriodPreset(value, baseDate);
                  }
                }}
              >
                <option value="">Personalizado</option>
                <option value="Q1">Primera quincena</option>
                <option value="Q2">Segunda quincena</option>
                <option value="MONTH">Mes completo</option>
              </select>
            </label>
            <label className="input-control">
              <span>Desde</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setPeriodPreset('');
                  setCurrentPage(1);
                }}
              />
            </label>
            <label className="input-control">
              <span>Hasta</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setPeriodPreset('');
                  setCurrentPage(1);
                }}
              />
            </label>
          </div>
          <div className="filters-actions">
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={onlyPending}
                onChange={(event) => {
                  setOnlyPending(event.target.checked);
                  setCurrentPage(1);
                }}
              />
              <span>Solo no descontados</span>
            </label>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={onlyImputed}
                onChange={(event) => {
                  setOnlyImputed(event.target.checked);
                  setCurrentPage(1);
                }}
              />
              <span>Solo imputados</span>
            </label>
            <button
              type="button"
              className="primary-action"
              onClick={() => {
                setCurrentPage(1);
                fetchConsumos(1);
              }}
              disabled={loading}
            >
              {loading ? 'Cargando…' : 'Buscar'}
            </button>
            {error ? <span className="helper-text">{error}</span> : null}
          </div>
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <h3>Tomados vs. no tomados</h3>
        </header>
        <div className="card-body">
          <div className="summary-cards">
            <div className="summary-card">
              <span>Tomados</span>
              <strong>{takenCount}</strong>
            </div>
            <div className="summary-card">
              <span>No tomados</span>
              <strong>{notTakenCount}</strong>
            </div>
            <div className="summary-card">
              <span>Movimientos</span>
              <strong>{totals?.movements ?? rows.length}</strong>
            </div>
            <div className="summary-card">
              <span>Litros</span>
              <strong>{formatNumber(totals?.liters ?? rows.reduce((sum, row) => sum + (row.liters ?? 0), 0))}</strong>
            </div>
            <div className="summary-card">
              <span>Importe</span>
              <strong>
                {formatCurrency(totals?.amount ?? rows.reduce((sum, row) => sum + (row.amount ?? 0), 0))}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <h3>Estados</h3>
        </header>
        <div className="card-body">
          {statusEntries.length === 0 ? (
            <p className="helper-text">No hay estados para el filtro actual.</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {statusEntries.map(([status, count]) => (
                    <tr key={`status-${status}`}>
                      <td>{renderFuelStatusBadge(status, status === 'DISCOUNTED')}</td>
                      <td>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <h3>Detalle</h3>
          <p className="helper-text">
            Distribuidor: {selectedDistributor?.name ?? 'Todos'} · Dominio: {domain.trim() || '—'} · Archivo:{' '}
            {sourceFile.trim() || '—'} · Nro. factura: {invoiceNumber.trim() || '—'}
          </p>
          <p className="helper-text">
            Última fecha cargada: {latestOccurredAt ? formatDateTime(latestOccurredAt) : '—'}
          </p>
          {(totals?.movements ?? rows.length) > rows.length ? (
            <p className="helper-text">
              Mostrando {rows.length} de {totals?.movements ?? rows.length} movimientos (página {activePage} de{' '}
              {Math.max(1, pagination?.total_pages ?? totalPages)}).
            </p>
          ) : null}
        </header>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estación</th>
                <th>Dominio</th>
                <th>Producto</th>
                <th>Nro. factura</th>
                <th>Litros</th>
                <th>Precio/Litro</th>
                <th>Importe</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9}>Cargando movimientos...</td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9}>No hay movimientos para el filtro actual.</td>
                </tr>
              )}
              {!loading &&
                rows.map((row) => (
                  <tr key={`consumo-${row.id}`}>
                    <td>{formatDateTime(row.occurred_at)}</td>
                    <td>{row.station ?? '—'}</td>
                    <td>{row.domain_norm ?? '—'}</td>
                    <td>{row.product ?? '—'}</td>
                    <td>{row.invoice_number ?? '—'}</td>
                    <td>{formatNumber(row.liters)}</td>
                    <td>{formatNumber(row.price_per_liter)}</td>
                    <td>{formatCurrency(row.amount ?? 0)}</td>
                    <td>{renderFuelStatusBadge(row.status, row.discounted)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <footer className="table-footer">
          <span>
            {loading
              ? 'Cargando movimientos...'
              : `Página ${activePage} de ${totalPages} · ${totals?.movements ?? rows.length} movimiento${
                  (totals?.movements ?? rows.length) === 1 ? '' : 's'
                }`}
          </span>
          <div className="pagination">
            <button
              type="button"
              aria-label="Página anterior"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={loading || !hasPrevPage}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Página siguiente"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={loading || !hasNextPage}
            >
              ›
            </button>
          </div>
        </footer>
      </section>
    </DashboardLayout>
  );
};

const CombustibleReportesPage: React.FC = () => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    by_distributor: Array<{
      distributor_id: number;
      distributor_name: string | null;
      period: string;
      total_amount: number;
      total_liters: number;
      movements: number;
    }>;
    top_stations: Array<{ station: string | null; total_amount: number; movements: number }>;
    by_product: Array<{ product: string | null; total_amount: number; total_liters: number; movements: number }>;
    pending_match: number;
    observed: number;
  }>({
    by_distributor: [],
    top_stations: [],
    by_product: [],
    pending_match: 0,
    observed: 0,
  });

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const response = await fetch(`${apiBaseUrl}/api/combustible/reportes-globales?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('No se pudieron cargar los reportes globales.');
      }
      const payload = await parseJsonSafe(response);
      setData({
        by_distributor: Array.isArray(payload.by_distributor) ? payload.by_distributor : [],
        top_stations: Array.isArray(payload.top_stations) ? payload.top_stations : [],
        by_product: Array.isArray(payload.by_product) ? payload.by_product : [],
        pending_match: Number(payload.pending_match) || 0,
        observed: Number(payload.observed) || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los reportes.');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, dateFrom, dateTo]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const exportGlobalExcel = () => {
    const summaryRows = [
      ['Pendientes sin vinculación', String(data.pending_match)],
      ['Movimientos observados', String(data.observed)],
      [],
    ];

    const distributorHeader = ['Periodo', 'Distribuidor', 'Movimientos', 'Litros', 'Importe'];
    const distributorRows = data.by_distributor.map((row) => [
      row.period,
      row.distributor_name ?? String(row.distributor_id),
      String(row.movements),
      formatNumber(row.total_liters),
      formatCurrency(row.total_amount),
    ]);

    const stationHeader = ['Estación', 'Movimientos', 'Importe'];
    const stationRows = data.top_stations.map((row) => [
      row.station ?? '—',
      String(row.movements),
      formatCurrency(row.total_amount),
    ]);

    const productHeader = ['Producto', 'Movimientos', 'Litros', 'Importe'];
    const productRows = data.by_product.map((row) => [
      row.product ?? '—',
      String(row.movements),
      formatNumber(row.total_liters),
      formatCurrency(row.total_amount),
    ]);

    const sections = [
      ['RESUMEN', ...summaryRows],
      [],
      ['CONSUMO POR DISTRIBUIDOR', distributorHeader, ...distributorRows],
      [],
      ['TOP ESTACIONES', stationHeader, ...stationRows],
      [],
      ['CONSUMO POR PRODUCTO', productHeader, ...productRows],
    ];

    const tsv = sections
      .map((section) => (Array.isArray(section[0]) ? section : [section]))
      .flat()
      .map((row) => (Array.isArray(row) ? row : [row]).join('\t'))
      .join('\n');

    const BOM = '\ufeff';
    const blob = new Blob([BOM + tsv], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reportes-combustible-${Date.now()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportGlobalPdf = () => {
    const html = `
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Reportes globales combustible</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1f2a44; margin: 24px; }
          h1 { font-size: 20px; margin-bottom: 8px; }
          h2 { font-size: 14px; margin-top: 18px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
          th { text-align: left; background: #eef3fb; padding: 6px; border: 1px solid #e1e8f5; }
          td { padding: 6px; border: 1px solid #e1e8f5; }
        </style>
      </head>
      <body>
        <h1>Reportes globales de combustible</h1>
        <p>Pendientes sin vinculación: ${data.pending_match} · Observados: ${data.observed}</p>
        <h2>Consumo por distribuidor</h2>
        <table>
          <thead><tr><th>Periodo</th><th>Distribuidor</th><th>Movimientos</th><th>Litros</th><th>Importe</th></tr></thead>
          <tbody>
            ${data.by_distributor.map((row) => `
              <tr>
                <td>${row.period}</td>
                <td>${row.distributor_name ?? row.distributor_id}</td>
                <td>${row.movements}</td>
                <td>${formatNumber(row.total_liters)}</td>
                <td>${formatCurrency(row.total_amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <h2>Top estaciones</h2>
        <table>
          <thead><tr><th>Estación</th><th>Movimientos</th><th>Importe</th></tr></thead>
          <tbody>
            ${data.top_stations.map((row) => `
              <tr>
                <td>${row.station ?? '—'}</td>
                <td>${row.movements}</td>
                <td>${formatCurrency(row.total_amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <h2>Consumo por producto</h2>
        <table>
          <thead><tr><th>Producto</th><th>Movimientos</th><th>Litros</th><th>Importe</th></tr></thead>
          <tbody>
            ${data.by_product.map((row) => `
              <tr>
                <td>${row.product ?? '—'}</td>
                <td>${row.movements}</td>
                <td>${formatNumber(row.total_liters)}</td>
                <td>${formatCurrency(row.total_amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    const win = window.open('', '_blank');
    if (!win) {
      window.alert('No se pudo abrir la vista de impresión.');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <DashboardLayout title="Combustible" subtitle="Reportes globales" headerContent={<CombustibleTabs />}>
      <section className="dashboard-card">
        <header className="card-header">
          <h3>Filtros</h3>
        </header>
        <div className="card-body">
          <div className="form-grid">
            <label className="input-control">
              <span>Desde</span>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label className="input-control">
              <span>Hasta</span>
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>
          </div>
          <div className="filters-actions">
            <button type="button" className="secondary-action" onClick={loadReports} disabled={loading}>
              {loading ? 'Cargando…' : 'Actualizar'}
            </button>
            <button type="button" className="secondary-action secondary-action--ghost" onClick={exportGlobalExcel}>
              Exportar Excel
            </button>
            <button type="button" className="secondary-action secondary-action--ghost" onClick={exportGlobalPdf}>
              Exportar PDF
            </button>
            {error ? <span className="helper-text">{error}</span> : null}
          </div>
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <h3>Alertas</h3>
        </header>
        <div className="card-body">
          <div className="summary-cards">
            <div className="summary-card">
              <span>Pendientes sin vinculación</span>
              <strong>{data.pending_match}</strong>
            </div>
            <div className="summary-card">
              <span>Movimientos observados</span>
              <strong>{data.observed}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <h3>Consumo mensual por distribuidor</h3>
        </header>
        <div className="card-body">
          <table className="data-table">
            <thead>
              <tr>
                <th>Periodo</th>
                <th>Distribuidor</th>
                <th>Movimientos</th>
                <th>Litros</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {data.by_distributor.map((row) => (
                <tr key={`${row.distributor_id}-${row.period}`}>
                  <td>{row.period}</td>
                  <td>{row.distributor_name ?? row.distributor_id}</td>
                  <td>{row.movements}</td>
                  <td>{formatNumber(row.total_liters)}</td>
                  <td>{formatCurrency(row.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <h3>Top estaciones</h3>
        </header>
        <div className="card-body">
          <table className="data-table">
            <thead>
              <tr>
                <th>Estación</th>
                <th>Movimientos</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {data.top_stations.map((row, index) => (
                <tr key={`${row.station ?? 'station'}-${index}`}>
                  <td>{row.station ?? '—'}</td>
                  <td>{row.movements}</td>
                  <td>{formatCurrency(row.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <h3>Consumo por producto</h3>
        </header>
        <div className="card-body">
          <table className="data-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Movimientos</th>
                <th>Litros</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {data.by_product.map((row, index) => (
                <tr key={`${row.product ?? 'producto'}-${index}`}>
                  <td>{row.product ?? '—'}</td>
                  <td>{row.movements}</td>
                  <td>{formatNumber(row.total_liters)}</td>
                  <td>{formatCurrency(row.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
};

const CombustibleRunsPage: React.FC = () => {
  type LiquidacionRunRecord = {
    id: number;
    sourceSystem: string | null;
    clientCode: string | null;
    periodFrom: string | null;
    periodTo: string | null;
    sourceFileName: string | null;
    sourceFileUrl: string | null;
    sourceFileHash: string | null;
    status: string | null;
    rowsTotal: number;
    rowsOk: number;
    rowsError: number;
    rowsAlert: number;
    rowsDiff: number;
    metadata: Record<string, unknown> | null;
    approvedAt: string | null;
    publishedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };

  type LiquidacionRunSummary = {
    staging_rows_count: number;
    validation_results_count: number;
    publish_jobs_count: number;
    observations_count: number;
    observations_by_status?: Record<string, number>;
  };

  type LiquidacionPublishJob = {
    id: number;
    runId: number;
    status: string;
    erpRequestId?: string | null;
    erpBatchId?: string | null;
    sentAt?: string | null;
    confirmedAt?: string | null;
    errorMessage?: string | null;
  };

  type RunsListResponse = {
    data?: LiquidacionRunRecord[];
    meta?: {
      current_page?: number;
      last_page?: number;
      per_page?: number;
      total?: number;
    };
    summary?: {
      status_counts?: Record<string, number>;
    };
    message?: string;
  };

  type RunShowResponse = {
    data?: LiquidacionRunRecord;
    summary?: LiquidacionRunSummary;
    latest_publish_job?: LiquidacionPublishJob | null;
    message?: string;
  };

  type ImportacionPreviewDistribuidor = {
    liquidacion_distribuidor_id: number;
    proveedor_id: number | null;
    patente: string | null;
    categoria: string | null;
    subtotal_calculado: number;
    subtotal_final: number;
    gastos_admin_default: number;
    gastos_admin_override: number | null;
    gastos_admin_final: number;
    total_final: number;
    tiene_overrides: boolean;
    alertas: string[];
  };

  type ImportacionMatchCandidate = {
    id: number;
    nombre: string;
    cuil?: string | null;
    patente?: string | null;
    score?: number;
  };

  type ImportacionPendingMatchItem = {
    row_id: number;
    row_number: number;
    patente_norm: string | null;
    nombre_excel_raw: string | null;
    nombre_excel_norm: string | null;
    match_status: string | null;
    candidatos: ImportacionMatchCandidate[];
  };

  type ImportacionPreviewResponse = {
    importacion?: {
      id: number;
      cliente_id: string | number | null;
      anio?: number | null;
      mes?: number | null;
      tipo_periodo?: string | null;
      quincena?: string | null;
      sucursal_id?: number | null;
      version?: number | null;
      estado?: string | null;
    };
    resumen?: {
      filas_total?: number;
      distribuidores_total?: number;
      criticos?: number;
      alertas?: number;
      pendientes_match?: number;
      total_distribuidores_calculado?: number;
      total_distribuidores_final?: number;
    };
    distribuidores?: ImportacionPreviewDistribuidor[];
    pendientes_match?: ImportacionPendingMatchItem[];
    message?: string;
  };

  type MatchAssignDraft = {
    proveedorId: string;
    searchTerm: string;
    manualCandidates: ImportacionMatchCandidate[];
    searching: boolean;
    searchError: string | null;
    actualizarPatente: boolean;
    sobreescribirPatente: boolean;
    motivo: string;
    saving: boolean;
    error: string | null;
  };

  type ProviderSearchResponse = {
    query?: string;
    data?: ImportacionMatchCandidate[];
    message?: string;
  };

  type DistribuidorLineaRecord = {
    linea_id: number;
    staging_linea_id: number | null;
    fecha: string | null;
    id_ruta: string | null;
    svc: string | null;
    turno_norm: string | null;
    factor_jornada: number;
    tarifa_dist_calculada: number;
    plus_calculado: number;
    importe_calculado: number;
    importe_override: number | null;
    importe_final: number;
    alertas: string[];
  };

  type DistribuidorDetailResponse = {
    liquidacion_distribuidor_id: number;
    proveedor_id: number | null;
    patente: string | null;
    gastos_admin_default: number;
    gastos_admin_override: number | null;
    lineas: DistribuidorLineaRecord[];
    message?: string;
  };

  type LineaEditDraft = {
    importeOverride: string;
    plusOverride: string;
    tarifaOverride: string;
    motivo: string;
    saving: boolean;
    error: string | null;
  };

  type ClientRulesPayload = {
    clientCode?: string;
    exists?: boolean;
    active?: boolean;
    rules?: Record<string, unknown> | null;
    resolvedRules?: Record<string, unknown> | null;
    source?: string;
    matchedClientCode?: string | null;
    updatedAt?: string | null;
  };

  type ClientRulesResponse = {
    data?: ClientRulesPayload;
    message?: string;
  };

  type LiquidacionesClientOption = {
    code: string;
    label: string;
  };

  type ClientTariffRuleEditor = {
    id: string;
    product: string;
    pricePerLiter: string;
    tolerancePercent: string;
    toleranceAmount: string;
    effectiveFrom: string;
    effectiveTo: string;
  };

  type IntermedioTariffMatrixRowEditor = {
    key: string;
    label: string;
    original: string;
    liquidacion: string;
    special?: boolean;
  };

  type EpsaTariffRangeEditor = {
    id: string;
    kmDesde: string;
    kmHasta: string;
    laJornada: string;
  };

  type ClientRulesEditorState = {
    duplicateRowBlocking: boolean;
    outsidePeriodBlocking: boolean;
    tariffMismatchBlocking: boolean;
    tolerancePercent: string;
    toleranceAmount: string;
    tariffs: ClientTariffRuleEditor[];
    intermedioSelectedZone: string;
    intermedioMatrix: Record<string, IntermedioTariffMatrixRowEditor[]>;
    epsaTarifario: EpsaTariffRangeEditor[];
  };

  type ExtractUploadPreviewResponse = {
    mapped?: boolean;
    rowCount?: number;
    previewCount?: number;
    sheet?: string | null;
    detectedColumns?: string[];
    mappedColumns?: string[];
    unmappedColumns?: string[];
    productColumn?: string | null;
    productColumnMessage?: string | null;
    rowsByStatus?: {
      ok?: number;
      error?: number;
      alert?: number;
      diff?: number;
    };
    rules?: {
      source?: string;
      blockingRules?: Record<string, boolean>;
      tolerances?: Record<string, number>;
      tariffsCount?: number;
    };
    sampleRows?: Array<{
      fecha?: string;
      estacion?: string;
      dominio?: string;
      producto?: string;
      litros?: string;
      importe?: string;
    }>;
    message?: string;
  };

  const createTariffRuleEditorRow = (seed?: Partial<ClientTariffRuleEditor>): ClientTariffRuleEditor => ({
    id: seed?.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    product: seed?.product ?? '',
    pricePerLiter: seed?.pricePerLiter ?? '',
    tolerancePercent: seed?.tolerancePercent ?? '',
    toleranceAmount: seed?.toleranceAmount ?? '',
    effectiveFrom: seed?.effectiveFrom ?? '',
    effectiveTo: seed?.effectiveTo ?? '',
  });

  const RULE_TARIFF_PRODUCT_OPTIONS = [
    'DIESEL',
    'NAFTA',
    'GNC',
    'CAMIONETAS',
    'UT_CHICO',
    'CORTO AM',
    'CORTO PM',
    'ESCOBAR PM',
    'MEDIANO',
    'LARGO',
    'LARGO +2018',
    'CHASIS',
  ];

  const EPSA_TARIFF_DEFAULTS: Array<{ kmDesde: number; kmHasta: number; laJornada: number }> = [
    { kmDesde: 0, kmHasta: 90, laJornada: 92636.7 },
    { kmDesde: 90.00001, kmHasta: 120, laJornada: 104216.29 },
    { kmDesde: 120.00001, kmHasta: 150, laJornada: 115795.88 },
    { kmDesde: 150.00001, kmHasta: 170, laJornada: 127375.47 },
    { kmDesde: 170.00001, kmHasta: 200, laJornada: 127375.47 },
  ];

  const createEpsaTariffRangeRow = (seed?: Partial<EpsaTariffRangeEditor>): EpsaTariffRangeEditor => ({
    id: seed?.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kmDesde: seed?.kmDesde ?? '',
    kmHasta: seed?.kmHasta ?? '',
    laJornada: seed?.laJornada ?? '',
  });

  const createDefaultEpsaTarifario = (): EpsaTariffRangeEditor[] =>
    EPSA_TARIFF_DEFAULTS.map((row, index) =>
      createEpsaTariffRangeRow({
        id: `epsa-${index}`,
        kmDesde: String(row.kmDesde),
        kmHasta: String(row.kmHasta),
        laJornada: String(row.laJornada),
      })
    );

  const INTERMEDIO_ZONES = ['AMBA', 'MDQ', 'ROSARIO', 'SANTA_FE', 'NEUQUEN', 'BARILOCHE'] as const;
  const INTERMEDIO_ROW_TEMPLATES: Array<{ key: string; label: string; special?: boolean }> = [
    { key: 'CORTO_AM', label: 'Ut. Corto AM' },
    { key: 'CORTO_PM', label: 'Ut. Corto PM' },
    { key: 'CORTO_PM_SC21', label: 'Ut. Corto PM SC21 / Escobar PM' },
    { key: 'CORTO', label: 'Ut. Corto' },
    { key: 'MEDIANO', label: 'Ut. Mediano', special: true },
    { key: 'LARGO', label: 'Ut. Largo (2015/2017)', special: true },
    { key: 'LARGO_2018', label: 'Ut. Largo NEW (2018)', special: true },
    { key: 'CHASIS', label: 'Chasis' },
  ];

  const INTERMEDIO_ZONE_DEFAULTS: Record<string, Record<string, { original: number; liquidacion: number; special?: boolean }>> = {
    AMBA: {
      CORTO_AM: { original: 114000, liquidacion: 96900 },
      CORTO_PM: { original: 85000, liquidacion: 72250 },
      CORTO_PM_SC21: { original: 90000, liquidacion: 76250 },
      MEDIANO: { original: 193000, liquidacion: 170000, special: true },
      LARGO: { original: 228000, liquidacion: 200000, special: true },
      LARGO_2018: { original: 250000, liquidacion: 220000, special: true },
      CHASIS: { original: 296000, liquidacion: 296000 },
    },
    MDQ: {
      CORTO: { original: 118000, liquidacion: 118000 },
      LARGO: { original: 210000, liquidacion: 210000 },
    },
    ROSARIO: {
      CORTO: { original: 101000, liquidacion: 101000 },
      MEDIANO: { original: 156000, liquidacion: 156000 },
      LARGO: { original: 228000, liquidacion: 228000 },
      CHASIS: { original: 265000, liquidacion: 265000 },
    },
    SANTA_FE: {
      CORTO: { original: 90000, liquidacion: 90000 },
      LARGO: { original: 205000, liquidacion: 205000 },
    },
    NEUQUEN: {
      CORTO_AM: { original: 117000, liquidacion: 117000 },
      CORTO_PM: { original: 98000, liquidacion: 98000 },
      LARGO: { original: 210000, liquidacion: 210000 },
    },
    BARILOCHE: {
      CORTO: { original: 105000, liquidacion: 105000 },
      LARGO: { original: 220000, liquidacion: 220000 },
    },
  };

  const normalizeIntermedioTariffKey = (value: string): string => {
    const normalized = value
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (normalized.includes('SC21') || normalized.includes('ESCOBAR')) {
      return 'CORTO_PM_SC21';
    }
    if (normalized.includes('LARGO') && (normalized.includes('2018') || normalized.includes('NEW'))) {
      return 'LARGO_2018';
    }
    if (normalized.includes('CORTO') && normalized.includes('AM')) {
      return 'CORTO_AM';
    }
    if (normalized.includes('CORTO') && normalized.includes('PM')) {
      return 'CORTO_PM';
    }
    if (normalized.includes('CORTO')) {
      return 'CORTO';
    }
    if (normalized.includes('MEDIANO')) {
      return 'MEDIANO';
    }
    if (normalized.includes('LARGO')) {
      return 'LARGO';
    }
    if (normalized.includes('CHASIS')) {
      return 'CHASIS';
    }
    return normalized || value.trim().toUpperCase();
  };

  const createIntermedioMatrixRows = (
    zone: string,
    source?: Record<string, { original?: number; liquidacion?: number; special?: boolean }>
  ): IntermedioTariffMatrixRowEditor[] =>
    INTERMEDIO_ROW_TEMPLATES.map((template) => {
      const record = source?.[template.key];
      return {
        key: template.key,
        label: template.label,
        original: record?.original != null ? String(record.original) : '',
        liquidacion: record?.liquidacion != null ? String(record.liquidacion) : '',
        special: Boolean(record?.special ?? template.special ?? false),
      };
    });

  const createDefaultIntermedioMatrixState = (): Record<string, IntermedioTariffMatrixRowEditor[]> => {
    const state: Record<string, IntermedioTariffMatrixRowEditor[]> = {};
    INTERMEDIO_ZONES.forEach((zone) => {
      state[zone] = createIntermedioMatrixRows(zone, INTERMEDIO_ZONE_DEFAULTS[zone]);
    });
    return state;
  };

  const toNumberString = (value: unknown): string => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed;
    }
    return '';
  };

  const normalizeDateInput = (value: unknown): string => {
    if (typeof value !== 'string') {
      return '';
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  };

  const parseOptionalNumber = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const normalized = trimmed.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const createMatchAssignDraft = useCallback((seed?: Partial<MatchAssignDraft>): MatchAssignDraft => ({
    proveedorId: seed?.proveedorId ?? '',
    searchTerm: seed?.searchTerm ?? '',
    manualCandidates: Array.isArray(seed?.manualCandidates) ? [...(seed?.manualCandidates ?? [])] : [],
    searching: seed?.searching ?? false,
    searchError: seed?.searchError ?? null,
    actualizarPatente: seed?.actualizarPatente ?? false,
    sobreescribirPatente: seed?.sobreescribirPatente ?? false,
    motivo: seed?.motivo ?? '',
    saving: seed?.saving ?? false,
    error: seed?.error ?? null,
  }), []);

  const rulesObjectToEditorState = (rules: Record<string, unknown> | null | undefined): ClientRulesEditorState => {
    const blocking = (rules?.blocking_rules && typeof rules.blocking_rules === 'object'
      ? (rules.blocking_rules as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    const tolerances = (rules?.tolerances && typeof rules.tolerances === 'object'
      ? (rules.tolerances as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    const tariffsRaw = Array.isArray(rules?.tariffs) ? (rules?.tariffs as Array<Record<string, unknown>>) : [];
    const matrixRaw =
      rules?.tariff_matrix && typeof rules.tariff_matrix === 'object'
        ? (rules.tariff_matrix as Record<string, unknown>)
        : null;
    const epsaRaw =
      rules?.epsa && typeof rules.epsa === 'object'
        ? (rules.epsa as Record<string, unknown>)
        : null;
    const epsaTarifarioRaw = Array.isArray(epsaRaw?.tarifario_ut_chico)
      ? (epsaRaw?.tarifario_ut_chico as Array<Record<string, unknown>>)
      : [];
    const matrixZonesRaw =
      matrixRaw?.zones && typeof matrixRaw.zones === 'object'
        ? (matrixRaw.zones as Record<string, unknown>)
        : {};
    const matrixState = createDefaultIntermedioMatrixState();
    const epsaTarifario =
      epsaTarifarioRaw.length > 0
        ? epsaTarifarioRaw.map((row, index) =>
            createEpsaTariffRangeRow({
              id: `epsa-loaded-${index}`,
              kmDesde: toNumberString(row.km_desde),
              kmHasta: toNumberString(row.km_hasta),
              laJornada: toNumberString(row.la_jornada),
            })
          )
        : createDefaultEpsaTarifario();

    Object.entries(matrixZonesRaw).forEach(([zoneName, zoneValue]) => {
      if (!zoneValue || typeof zoneValue !== 'object') {
        return;
      }
      const zoneKey = String(zoneName).trim().toUpperCase();
      const zoneEntries = zoneValue as Record<string, unknown>;
      const existingRows = matrixState[zoneKey] ? [...matrixState[zoneKey]] : createIntermedioMatrixRows(zoneKey);
      const rowsByKey = new Map(existingRows.map((row) => [row.key, { ...row }]));

      Object.entries(zoneEntries).forEach(([entryKey, entryValue]) => {
        if (!entryValue || typeof entryValue !== 'object') {
          return;
        }
        const entry = entryValue as Record<string, unknown>;
        const normalizedKey = normalizeIntermedioTariffKey(entryKey);
        const found = rowsByKey.get(normalizedKey) ?? {
          key: normalizedKey,
          label: String(entry.label ?? entryKey),
          original: '',
          liquidacion: '',
          special: false,
        };
        rowsByKey.set(normalizedKey, {
          ...found,
          label: typeof entry.label === 'string' && entry.label.trim() ? entry.label : found.label,
          original: toNumberString(entry.original ?? entry.tarifa_original ?? found.original),
          liquidacion: toNumberString(entry.liquidacion ?? entry.tarifa_liquidacion ?? entry.price_per_liter ?? found.liquidacion),
          special: Boolean(entry.special ?? found.special ?? false),
        });
      });

      matrixState[zoneKey] = Array.from(rowsByKey.values());
    });

    if ((!matrixRaw || Object.keys(matrixZonesRaw).length === 0) && tariffsRaw.length > 0) {
      const rowsByKey = new Map((matrixState.AMBA ?? createIntermedioMatrixRows('AMBA')).map((row) => [row.key, { ...row }]));
      tariffsRaw.forEach((tariff) => {
        const key = normalizeIntermedioTariffKey(String(tariff.product ?? ''));
        if (!key) {
          return;
        }
        const found = rowsByKey.get(key) ?? {
          key,
          label: String(tariff.product ?? key),
          original: '',
          liquidacion: '',
          special: false,
        };
        const tariffValue = toNumberString(tariff.price_per_liter);
        rowsByKey.set(key, {
          ...found,
          liquidacion: tariffValue || found.liquidacion,
        });
      });
      matrixState.AMBA = Array.from(rowsByKey.values());
    }

    const selectedZoneRaw = typeof matrixRaw?.default_zone === 'string' ? matrixRaw.default_zone : 'AMBA';
    const selectedZone = selectedZoneRaw.trim().toUpperCase() || 'AMBA';

    return {
      duplicateRowBlocking: Boolean(blocking.duplicate_row ?? false),
      outsidePeriodBlocking: Boolean(blocking.outside_period ?? true),
      tariffMismatchBlocking: Boolean(blocking.tariff_mismatch ?? false),
      tolerancePercent: toNumberString(tolerances.price_per_liter_percent ?? 3),
      toleranceAmount: toNumberString(tolerances.price_per_liter_amount ?? 0),
      tariffs: tariffsRaw.map((row, index) =>
        createTariffRuleEditorRow({
          id: `${Date.now()}-${index}`,
          product: typeof row.product === 'string' ? row.product : '',
          pricePerLiter: toNumberString(row.price_per_liter),
          tolerancePercent: toNumberString(row.tolerance_percent),
          toleranceAmount: toNumberString(row.tolerance_amount),
          effectiveFrom: normalizeDateInput(row.effective_from),
          effectiveTo: normalizeDateInput(row.effective_to),
        })
      ),
      intermedioSelectedZone: selectedZone,
      intermedioMatrix: matrixState,
      epsaTarifario,
    };
  };

  const editorStateToRulesObject = (editor: ClientRulesEditorState, clientCodeRaw = ''): Record<string, unknown> => {
    const normalizedClientCode = clientCodeRaw.trim().toUpperCase();
    const isIntermedioClient = normalizedClientCode.includes('INTERMEDIO') || /^INT\d*$/.test(normalizedClientCode);
    const isEpsaClient = normalizedClientCode.includes('EPSA');
    const tolerancePercent = parseOptionalNumber(editor.tolerancePercent);
    const toleranceAmount = parseOptionalNumber(editor.toleranceAmount);

    const tariffs = editor.tariffs
      .map((row) => {
        const product = row.product.trim();
        const pricePerLiter = parseOptionalNumber(row.pricePerLiter);
        const rowTolerancePercent = parseOptionalNumber(row.tolerancePercent);
        const rowToleranceAmount = parseOptionalNumber(row.toleranceAmount);
        const effectiveFrom = row.effectiveFrom.trim();
        const effectiveTo = row.effectiveTo.trim();

        if (!product || pricePerLiter === null || pricePerLiter <= 0) {
          return null;
        }

        const tariff: Record<string, unknown> = {
          product,
          price_per_liter: pricePerLiter,
        };
        if (rowTolerancePercent !== null) {
          tariff.tolerance_percent = rowTolerancePercent;
        }
        if (rowToleranceAmount !== null) {
          tariff.tolerance_amount = rowToleranceAmount;
        }
        if (effectiveFrom) {
          tariff.effective_from = effectiveFrom;
        }
        if (effectiveTo) {
          tariff.effective_to = effectiveTo;
        }

        return tariff;
      })
      .filter((row): row is Record<string, unknown> => row !== null);

    const matrixZonesPayload: Record<string, Record<string, Record<string, unknown>>> = {};
    Object.entries(editor.intermedioMatrix ?? {}).forEach(([zoneName, rows]) => {
      if (!Array.isArray(rows)) {
        return;
      }
      const zonePayload: Record<string, Record<string, unknown>> = {};
      rows.forEach((row) => {
        const original = parseOptionalNumber(row.original);
        const liquidacion = parseOptionalNumber(row.liquidacion);
        if (original === null && liquidacion === null) {
          return;
        }

        zonePayload[row.key] = {
          label: row.label,
          original: original ?? 0,
          liquidacion: liquidacion ?? original ?? 0,
          special: Boolean(row.special ?? false),
        };
      });
      if (Object.keys(zonePayload).length > 0) {
        matrixZonesPayload[zoneName.trim().toUpperCase()] = zonePayload;
      }
    });

    const selectedZoneKey = (editor.intermedioSelectedZone || 'AMBA').trim().toUpperCase() || 'AMBA';
    const selectedZoneRows = editor.intermedioMatrix?.[selectedZoneKey] ?? editor.intermedioMatrix?.AMBA ?? [];
    const intermedioTariffs = selectedZoneRows
      .map((row) => {
        const liquid = parseOptionalNumber(row.liquidacion);
        if (liquid === null || liquid <= 0) {
          return null;
        }
        return {
          product: row.label,
          price_per_liter: liquid,
        };
      })
      .filter((row): row is { product: string; price_per_liter: number } => row !== null);

    const epsaTarifario = (editor.epsaTarifario ?? [])
      .map((row) => {
        const kmDesde = parseOptionalNumber(row.kmDesde);
        const kmHasta = parseOptionalNumber(row.kmHasta);
        const laJornada = parseOptionalNumber(row.laJornada);
        if (kmDesde === null || kmHasta === null || laJornada === null) {
          return null;
        }
        if (kmHasta < kmDesde || laJornada <= 0) {
          return null;
        }
        return {
          km_desde: kmDesde,
          km_hasta: kmHasta,
          la_jornada: laJornada,
        };
      })
      .filter((row): row is { km_desde: number; km_hasta: number; la_jornada: number } => row !== null);

    const payload: Record<string, unknown> = {
      blocking_rules: {
        duplicate_row: editor.duplicateRowBlocking,
        outside_period: editor.outsidePeriodBlocking,
        tariff_mismatch: editor.tariffMismatchBlocking,
      },
      tolerances: {
        price_per_liter_percent: tolerancePercent ?? 0,
        price_per_liter_amount: toleranceAmount ?? 0,
      },
      tariffs: isIntermedioClient
        ? intermedioTariffs
        : tariffs,
    };

    if (isIntermedioClient && Object.keys(matrixZonesPayload).length > 0) {
      payload.tariff_matrix = {
        default_zone: selectedZoneKey,
        zones: matrixZonesPayload,
      };
    }

    if (isEpsaClient) {
      payload.epsa = {
        sheet_name: 'Table',
        tipo_unidad: 'UT_CHICO',
        match_alias_type: 'DISTRIBUIDOR',
        tarifario_ut_chico: epsaTarifario.length > 0
          ? epsaTarifario
          : EPSA_TARIFF_DEFAULTS.map((row) => ({
              km_desde: row.kmDesde,
              km_hasta: row.kmHasta,
              la_jornada: row.laJornada,
            })),
      };
    }

    return payload;
  };

  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const location = useLocation();
  const isStandaloneExtractosRoute = location.pathname.startsWith('/liquidaciones/extractos');
  const createFileRef = useRef<HTMLInputElement | null>(null);
  const [runs, setRuns] = useState<LiquidacionRunRecord[]>([]);
  const [meta, setMeta] = useState<{ total: number; currentPage: number; lastPage: number; perPage: number }>({
    total: 0,
    currentPage: 1,
    lastPage: 1,
    perPage: 50,
  });
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState('');
  const [clientCodeFilter, setClientCodeFilter] = useState('');
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);

  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedRun, setSelectedRun] = useState<LiquidacionRunRecord | null>(null);
  const [runSummary, setRunSummary] = useState<LiquidacionRunSummary | null>(null);
  const [latestPublishJob, setLatestPublishJob] = useState<LiquidacionPublishJob | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [approveForce, setApproveForce] = useState(false);
  const [approveNote, setApproveNote] = useState('');
  const [approveLoading, setApproveLoading] = useState(false);

  const [publishForce, setPublishForce] = useState(false);
  const [publishDistributorCode, setPublishDistributorCode] = useState('');
  const [publishLiquidacionId, setPublishLiquidacionId] = useState('');
  const [publishLoading, setPublishLoading] = useState(false);
  const [syncPersonalLoading, setSyncPersonalLoading] = useState(false);

  const [createClientCode, setCreateClientCode] = useState('');
  const [createPeriodMonth, setCreatePeriodMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [createPeriodType, setCreatePeriodType] = useState<'QUINCENAL' | 'MENSUAL'>('QUINCENAL');
  const [createPeriodFortnight, setCreatePeriodFortnight] = useState<'1Q' | '2Q'>('1Q');
  const [createSourceFileName, setCreateSourceFileName] = useState('');
  const [createExtractFile, setCreateExtractFile] = useState<File | null>(null);
  const [createExtractPreview, setCreateExtractPreview] = useState<ExtractUploadPreviewResponse | null>(null);
  const [createPreviewLoading, setCreatePreviewLoading] = useState(false);
  const [createPreviewError, setCreatePreviewError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [liquidacionesClients, setLiquidacionesClients] = useState<LiquidacionesClientOption[]>([]);
  const [deletingRunIds, setDeletingRunIds] = useState<Set<number>>(new Set());

  const [rulesClientCode, setRulesClientCode] = useState('');
  const [rulesActive, setRulesActive] = useState(true);
  const [rulesEditor, setRulesEditor] = useState<ClientRulesEditorState>(() =>
    rulesObjectToEditorState({
      blocking_rules: {
        duplicate_row: false,
        outside_period: true,
        tariff_mismatch: false,
      },
      tolerances: {
        price_per_liter_percent: 3,
        price_per_liter_amount: 0,
      },
      tariffs: [],
    })
  );
  const [rulesShowJson, setRulesShowJson] = useState(false);
  const [rulesSourceLabel, setRulesSourceLabel] = useState<string | null>(null);
  const [rulesUpdatedAt, setRulesUpdatedAt] = useState<string | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rulesMessage, setRulesMessage] = useState<string | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [importacionPreview, setImportacionPreview] = useState<ImportacionPreviewResponse | null>(null);
  const [importacionPreviewLoading, setImportacionPreviewLoading] = useState(false);
  const [importacionPreviewError, setImportacionPreviewError] = useState<string | null>(null);
  const [selectedDistribuidorId, setSelectedDistribuidorId] = useState<number | null>(null);
  const [selectedDistribuidorDetail, setSelectedDistribuidorDetail] = useState<DistribuidorDetailResponse | null>(null);
  const [distribuidorDetailLoading, setDistribuidorDetailLoading] = useState(false);
  const [distribuidorDetailError, setDistribuidorDetailError] = useState<string | null>(null);
  const [lineaDrafts, setLineaDrafts] = useState<Record<number, LineaEditDraft>>({});
  const [distribuidorDraft, setDistribuidorDraft] = useState<{
    gastosAdminOverride: string;
    ajusteManual: string;
    motivo: string;
    saving: boolean;
  }>({
    gastosAdminOverride: '',
    ajusteManual: '',
    motivo: '',
    saving: false,
  });
  const [detalleActionMessage, setDetalleActionMessage] = useState<string | null>(null);
  const [detalleActionError, setDetalleActionError] = useState<string | null>(null);
  const [matchAssignDrafts, setMatchAssignDrafts] = useState<Record<string, MatchAssignDraft>>({});
  const rulesClientContextText = useMemo(() => {
    const normalizedCode = rulesClientCode.trim().toUpperCase();
    if (!normalizedCode) {
      return '';
    }
    const matchedClient = liquidacionesClients.find(
      (item) => item.code.trim().toUpperCase() === normalizedCode
    );
    const matchedRun = runs.find(
      (run) => String(run.clientCode ?? '').trim().toUpperCase() === normalizedCode
    );
    const fallbackLabel = matchedRun ? String(matchedRun.clientCode ?? '').trim() : '';
    const label = String(matchedClient?.label ?? fallbackLabel).trim().toUpperCase();
    return `${normalizedCode} ${label}`.trim();
  }, [liquidacionesClients, rulesClientCode, runs]);
  const isIntermedioRulesClient = useMemo(() => {
    if (!rulesClientContextText) {
      return false;
    }
    return rulesClientContextText.includes('INTERMEDIO') || /\bINT\d*\b/.test(rulesClientContextText);
  }, [rulesClientContextText]);
  const isEpsaRulesClient = useMemo(() => {
    if (!rulesClientContextText) {
      return false;
    }
    return rulesClientContextText.includes('EPSA');
  }, [rulesClientContextText]);
  const intermedioRulesZone = (() => {
    const normalized = (rulesEditor.intermedioSelectedZone || 'AMBA').trim().toUpperCase() || 'AMBA';
    return INTERMEDIO_ZONES.includes(normalized as (typeof INTERMEDIO_ZONES)[number]) ? normalized : 'AMBA';
  })();
  const intermedioRulesZoneRows = (() => {
    const rows = rulesEditor.intermedioMatrix?.[intermedioRulesZone];
    if (Array.isArray(rows) && rows.length > 0) {
      return rows;
    }
    return createIntermedioMatrixRows(intermedioRulesZone, INTERMEDIO_ZONE_DEFAULTS[intermedioRulesZone]);
  })();
  const epsaRulesRows = Array.isArray(rulesEditor.epsaTarifario) && rulesEditor.epsaTarifario.length > 0
    ? rulesEditor.epsaTarifario
    : createDefaultEpsaTarifario();
  const rulesJsonText = JSON.stringify(editorStateToRulesObject(rulesEditor, rulesClientCode), null, 2);
  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();

    liquidacionesClients.forEach((item) => {
      const code = item.code.trim().toUpperCase();
      if (!code) {
        return;
      }
      map.set(code, item.label || code);
    });

    runs.forEach((run) => {
      const code = String(run.clientCode ?? '').trim().toUpperCase();
      if (!code || map.has(code)) {
        return;
      }
      map.set(code, code);
    });

    [createClientCode, rulesClientCode, clientCodeFilter].forEach((value) => {
      const code = value.trim().toUpperCase();
      if (!code || map.has(code)) {
        return;
      }
      map.set(code, code);
    });

    return Array.from(map.entries())
      .map(([code, label]) => ({ code, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
  }, [clientCodeFilter, createClientCode, liquidacionesClients, rulesClientCode, runs]);

  const createPeriodRange = useMemo(() => {
    const match = /^(\d{4})-(\d{2})$/.exec(createPeriodMonth);
    if (!match) {
      return {
        from: '',
        to: '',
        year: null as number | null,
        month: null as number | null,
      };
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return {
        from: '',
        to: '',
        year: null as number | null,
        month: null as number | null,
      };
    }

    const pad = (value: number) => String(value).padStart(2, '0');
    const monthStart = `${year}-${pad(month)}-01`;
    const monthEnd = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;

    if (createPeriodType === 'MENSUAL') {
      return {
        from: monthStart,
        to: monthEnd,
        year,
        month,
      };
    }

    if (createPeriodFortnight === '2Q') {
      return {
        from: `${year}-${pad(month)}-16`,
        to: monthEnd,
        year,
        month,
      };
    }

    return {
      from: monthStart,
      to: `${year}-${pad(month)}-15`,
      year,
      month,
    };
  }, [createPeriodFortnight, createPeriodMonth, createPeriodType]);

  const formatDateCell = useCallback((value?: string | null) => {
    if (!value) {
      return '—';
    }
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return value;
      }
      return date.toLocaleString('es-AR');
    } catch {
      return value;
    }
  }, []);

  const loadRuns = useCallback(async () => {
    setLoadingRuns(true);
    setRunsError(null);
    try {
      const params = new URLSearchParams();
      params.set('per_page', '50');
      if (statusFilter) {
        params.set('status', statusFilter);
      }
      if (clientCodeFilter.trim()) {
        params.set('client_code', clientCodeFilter.trim());
      }

      const response = await fetch(`${apiBaseUrl}/api/liquidaciones/runs?${params.toString()}`, {
        credentials: 'include',
      });

      const payload = (await parseJsonSafe(response)) as RunsListResponse;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudieron cargar los runs.');
      }

      const fetchedRuns = Array.isArray(payload.data) ? payload.data : [];
      setRuns(fetchedRuns);
      setMeta({
        total: Number(payload.meta?.total) || 0,
        currentPage: Number(payload.meta?.current_page) || 1,
        lastPage: Number(payload.meta?.last_page) || 1,
        perPage: Number(payload.meta?.per_page) || 50,
      });

      const nextStatusCounts: Record<string, number> = {};
      if (payload.summary?.status_counts && typeof payload.summary.status_counts === 'object') {
        Object.entries(payload.summary.status_counts).forEach(([status, total]) => {
          const parsed = Number(total);
          if (Number.isFinite(parsed)) {
            nextStatusCounts[status] = parsed;
          }
        });
      }
      setStatusCounts(nextStatusCounts);

      setSelectedRunId((prev) => {
        if (fetchedRuns.length === 0) {
          return null;
        }

        if (prev == null) {
          return Number(fetchedRuns[0].id);
        }

        const stillExists = fetchedRuns.some((run) => Number(run.id) === prev);
        return stillExists ? prev : Number(fetchedRuns[0].id);
      });
    } catch (err) {
      setRunsError(err instanceof Error ? err.message : 'No se pudieron cargar los runs.');
      setRuns([]);
      setMeta({ total: 0, currentPage: 1, lastPage: 1, perPage: 50 });
      setStatusCounts({});
      setSelectedRunId(null);
    } finally {
      setLoadingRuns(false);
    }
  }, [apiBaseUrl, clientCodeFilter, statusFilter]);

  const loadRunDetail = useCallback(
    async (runId: number) => {
      setLoadingDetail(true);
      setDetailError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/api/liquidaciones/runs/${runId}`, {
          credentials: 'include',
        });

        const payload = (await parseJsonSafe(response)) as RunShowResponse;
        if (!response.ok) {
          throw new Error(payload?.message ?? 'No se pudo cargar el detalle del run.');
        }

        setSelectedRun(payload.data ?? null);
        setRunSummary(payload.summary ?? null);
        setLatestPublishJob(payload.latest_publish_job ?? null);
      } catch (err) {
        setDetailError(err instanceof Error ? err.message : 'No se pudo cargar el detalle del run.');
        setSelectedRun(null);
        setRunSummary(null);
        setLatestPublishJob(null);
      } finally {
        setLoadingDetail(false);
      }
    },
    [apiBaseUrl]
  );

  const loadImportacionPreview = useCallback(
    async (runId: number) => {
      setImportacionPreviewLoading(true);
      setImportacionPreviewError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/api/liquidaciones/importaciones/${runId}/preview`, {
          credentials: 'include',
        });
        const payload = (await parseJsonSafe(response)) as ImportacionPreviewResponse;
        if (!response.ok) {
          throw new Error(payload?.message ?? 'No se pudo cargar la preliquidación del run.');
        }

        const distribs = Array.isArray(payload.distribuidores) ? payload.distribuidores : [];
        setImportacionPreview(payload ?? null);
        setSelectedDistribuidorId((current) => {
          if (distribs.length === 0) {
            return null;
          }
          if (current != null && distribs.some((item) => Number(item.liquidacion_distribuidor_id) === current)) {
            return current;
          }
          return Number(distribs[0].liquidacion_distribuidor_id);
        });
      } catch (err) {
        setImportacionPreview(null);
        setSelectedDistribuidorId(null);
        setImportacionPreviewError(err instanceof Error ? err.message : 'No se pudo cargar la preliquidación del run.');
      } finally {
        setImportacionPreviewLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const loadDistribuidorDetail = useCallback(
    async (distribuidorId: number) => {
      setDistribuidorDetailLoading(true);
      setDistribuidorDetailError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/api/liquidaciones/distribuidores/${distribuidorId}`, {
          credentials: 'include',
        });
        const payload = (await parseJsonSafe(response)) as DistribuidorDetailResponse;
        if (!response.ok) {
          throw new Error(payload?.message ?? 'No se pudo cargar el detalle del distribuidor.');
        }

        setSelectedDistribuidorDetail(payload);
        setDistribuidorDraft((current) => ({
          ...current,
          gastosAdminOverride: payload.gastos_admin_override == null ? '' : toNumberString(payload.gastos_admin_override),
          ajusteManual: '',
          saving: false,
        }));
        setLineaDrafts((current) => {
          const next: Record<number, LineaEditDraft> = {};
          (payload.lineas ?? []).forEach((linea) => {
            const previous = current[linea.linea_id];
            next[linea.linea_id] = {
              importeOverride: linea.importe_override == null ? '' : toNumberString(linea.importe_override),
              plusOverride: previous?.plusOverride ?? '',
              tarifaOverride: previous?.tarifaOverride ?? '',
              motivo: previous?.motivo ?? '',
              saving: false,
              error: null,
            };
          });
          return next;
        });
      } catch (err) {
        setSelectedDistribuidorDetail(null);
        setLineaDrafts({});
        setDistribuidorDetailError(err instanceof Error ? err.message : 'No se pudo cargar el detalle del distribuidor.');
      } finally {
        setDistribuidorDetailLoading(false);
      }
    },
    [apiBaseUrl]
  );

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    let cancelled = false;

    const loadClientOptions = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/clientes`, {
          credentials: 'include',
        });
        const payload = (await parseJsonSafe(response)) as { data?: Array<{ codigo?: string | null; nombre?: string | null; id?: number }> };
        if (!response.ok) {
          return;
        }
        const options = Array.isArray(payload.data)
          ? payload.data
              .map((cliente) => {
                const code = String(cliente?.codigo ?? '').trim().toUpperCase();
                if (!code) {
                  return null;
                }
                const name = String(cliente?.nombre ?? '').trim();
                return {
                  code,
                  label: name ? `${code} - ${name}` : code,
                } as LiquidacionesClientOption;
              })
              .filter((item): item is LiquidacionesClientOption => item !== null)
          : [];

        if (!cancelled) {
          setLiquidacionesClients(options);
        }
      } catch {
        if (!cancelled) {
          setLiquidacionesClients([]);
        }
      }
    };

    loadClientOptions();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (selectedRunId == null) {
      setSelectedRun(null);
      setRunSummary(null);
      setLatestPublishJob(null);
      setDetailError(null);
      setImportacionPreview(null);
      setImportacionPreviewLoading(false);
      setImportacionPreviewError(null);
      setSelectedDistribuidorId(null);
      setSelectedDistribuidorDetail(null);
      setDistribuidorDetailLoading(false);
      setDistribuidorDetailError(null);
      setLineaDrafts({});
      setMatchAssignDrafts({});
      setDetalleActionMessage(null);
      setDetalleActionError(null);
      return;
    }

    loadRunDetail(selectedRunId);
    loadImportacionPreview(selectedRunId);
  }, [loadImportacionPreview, loadRunDetail, selectedRunId]);

  useEffect(() => {
    if (selectedDistribuidorId == null) {
      setSelectedDistribuidorDetail(null);
      setDistribuidorDetailError(null);
      setLineaDrafts({});
      return;
    }

    loadDistribuidorDetail(selectedDistribuidorId);
  }, [loadDistribuidorDetail, selectedDistribuidorId]);

  useEffect(() => {
    let cancelled = false;

    const loadExtractPreview = async () => {
      if (!createExtractFile) {
        setCreateExtractPreview(null);
        setCreatePreviewError(null);
        setCreatePreviewLoading(false);
        return;
      }

      setCreatePreviewLoading(true);
      setCreatePreviewError(null);
      setCreateExtractPreview(null);

      try {
        const formData = new FormData();
        formData.append('extract_file', createExtractFile);
        formData.append('format', 'custom');
        if (createClientCode.trim()) {
          formData.append('client_code', createClientCode.trim());
        }
        if (createPeriodRange.from) {
          formData.append('period_from', createPeriodRange.from);
        }
        if (createPeriodRange.to) {
          formData.append('period_to', createPeriodRange.to);
        }
        if (createPeriodType) {
          formData.append('tipo_periodo', createPeriodType);
        }
        if (createPeriodType === 'QUINCENAL' && createPeriodFortnight) {
          formData.append('quincena', createPeriodFortnight);
        }
        if (createPeriodRange.year != null) {
          formData.append('anio', String(createPeriodRange.year));
        }
        if (createPeriodRange.month != null) {
          formData.append('mes', String(createPeriodRange.month));
        }

        const response = await fetch(`${apiBaseUrl}/api/liquidaciones/runs/upload-preview`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        const payload = (await parseJsonSafe(response)) as ExtractUploadPreviewResponse;
        if (!response.ok) {
          throw new Error(payload?.message ?? 'No se pudo generar la vista previa del extracto.');
        }

        if (!cancelled) {
          setCreateExtractPreview(payload ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setCreatePreviewError(err instanceof Error ? err.message : 'No se pudo generar la vista previa del extracto.');
          setCreateExtractPreview(null);
        }
      } finally {
        if (!cancelled) {
          setCreatePreviewLoading(false);
        }
      }
    };

    loadExtractPreview();
    return () => {
      cancelled = true;
    };
  }, [
    apiBaseUrl,
    createClientCode,
    createExtractFile,
    createPeriodFortnight,
    createPeriodRange.from,
    createPeriodRange.month,
    createPeriodRange.to,
    createPeriodRange.year,
    createPeriodType,
  ]);

  useEffect(() => {
    if (rulesClientCode.trim()) {
      return;
    }
    if (createClientCode.trim()) {
      setRulesClientCode(createClientCode.trim());
    }
  }, [createClientCode, rulesClientCode]);

  const loadClientRulesByCode = async (clientCodeRaw: string) => {
    const clientCode = clientCodeRaw.trim();
    if (!clientCode) {
      setRulesError('Ingresá un cliente para cargar reglas.');
      return;
    }

    setRulesLoading(true);
    setRulesError(null);
    setRulesMessage(null);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/liquidaciones/reglas-cliente/${encodeURIComponent(clientCode)}`,
        {
          credentials: 'include',
        }
      );
      const payload = (await parseJsonSafe(response)) as ClientRulesResponse;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudieron cargar las reglas del cliente.');
      }

      const data = payload?.data;
      const rules = (data?.resolvedRules ?? data?.rules ?? {}) as Record<string, unknown>;
      setRulesEditor(rulesObjectToEditorState(rules));
      setRulesActive(Boolean(data?.active ?? true));
      setRulesSourceLabel(data?.source ?? (data?.exists ? 'client' : 'default'));
      setRulesUpdatedAt(data?.updatedAt ?? null);

      const source = String(data?.source ?? '').trim().toLowerCase();
      if (source === 'client_fallback') {
        const matchedCode = String(data?.matchedClientCode ?? '').trim().toUpperCase();
        setRulesMessage(
          matchedCode
            ? `Reglas cargadas por fallback desde ${matchedCode}.`
            : 'Reglas cargadas por fallback de la familia del cliente.'
        );
      } else if (data?.exists) {
        setRulesMessage('Reglas del cliente cargadas.');
      } else {
        setRulesMessage('No había reglas guardadas: se cargó configuración base.');
      }
    } catch (err) {
      setRulesError(err instanceof Error ? err.message : 'No se pudieron cargar las reglas del cliente.');
    } finally {
      setRulesLoading(false);
    }
  };

  const handleLoadClientRules = async () => {
    await loadClientRulesByCode(rulesClientCode);
  };

  const handleRulesClientChange = (nextClientCode: string) => {
    const normalizedInput = nextClientCode.toUpperCase();
    const normalizedClientCode = normalizedInput.trim();
    const canAutoLoad = normalizedClientCode
      ? clientOptions.some((option) => option.code === normalizedClientCode)
      : false;

    setRulesClientCode(normalizedInput);
    setRulesError(null);
    setRulesMessage(null);
    if (canAutoLoad) {
      void loadClientRulesByCode(normalizedClientCode);
    }
  };

  const handleSaveClientRules = async () => {
    const clientCode = rulesClientCode.trim();
    if (!clientCode) {
      setRulesError('Ingresá un cliente para guardar reglas.');
      return;
    }

    const parsedRules = editorStateToRulesObject(rulesEditor, clientCode);

    setRulesSaving(true);
    setRulesError(null);
    setRulesMessage(null);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/liquidaciones/reglas-cliente/${encodeURIComponent(clientCode)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            active: rulesActive,
            rules: parsedRules,
          }),
        }
      );

      const payload = (await parseJsonSafe(response)) as ClientRulesResponse;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudieron guardar las reglas del cliente.');
      }

      const data = payload?.data;
      const rules = (data?.resolvedRules ?? data?.rules ?? parsedRules) as Record<string, unknown>;
      setRulesEditor(rulesObjectToEditorState(rules));
      setRulesSourceLabel(data?.source ?? 'client');
      setRulesUpdatedAt(data?.updatedAt ?? null);
      setRulesMessage('Reglas del cliente guardadas correctamente.');
    } catch (err) {
      setRulesError(err instanceof Error ? err.message : 'No se pudieron guardar las reglas del cliente.');
    } finally {
      setRulesSaving(false);
    }
  };

  const handleLoadRulesTemplate = async () => {
    const clientCode = rulesClientCode.trim().toUpperCase();
    const isIntermedioClient = clientCode.includes('INTERMEDIO') || /^INT\d*$/.test(clientCode);
    const isEpsaClient = clientCode.includes('EPSA');
    if (isIntermedioClient) {
      const matrixZones = INTERMEDIO_ZONES.reduce<Record<string, Record<string, Record<string, unknown>>>>(
        (acc, zone) => {
          const rows = createIntermedioMatrixRows(zone, INTERMEDIO_ZONE_DEFAULTS[zone]);
          const zonePayload: Record<string, Record<string, unknown>> = {};
          rows.forEach((row) => {
            const original = parseOptionalNumber(row.original);
            const liquidacion = parseOptionalNumber(row.liquidacion);
            if (original === null && liquidacion === null) {
              return;
            }
            zonePayload[row.key] = {
              key: row.key,
              label: row.label,
              original: original ?? 0,
              liquidacion: liquidacion ?? original ?? 0,
              special: Boolean(row.special ?? false),
            };
          });
          acc[zone] = zonePayload;
          return acc;
        },
        {}
      );

      const intermedioTemplate: Record<string, unknown> = {
        blocking_rules: {
          duplicate_row: false,
          outside_period: true,
          tariff_mismatch: false,
        },
        tolerances: {
          price_per_liter_percent: 3,
          price_per_liter_amount: 0,
        },
        tariff_matrix: {
          default_zone: 'AMBA',
          zones: matrixZones,
        },
      };
      setRulesEditor(rulesObjectToEditorState(intermedioTemplate));
      setRulesActive(true);
      setRulesSourceLabel('template_intermedio');
      setRulesUpdatedAt(null);
      setRulesMessage('Plantilla INTERMEDIO cargada.');
      setRulesError(null);
      return;
    }
    if (isEpsaClient) {
      const epsaTemplate: Record<string, unknown> = {
        blocking_rules: {
          duplicate_row: true,
          outside_period: false,
          tariff_mismatch: false,
        },
        tolerances: {
          price_per_liter_percent: 3,
          price_per_liter_amount: 0,
        },
        epsa: {
          sheet_name: 'Table',
          tipo_unidad: 'UT_CHICO',
          match_alias_type: 'DISTRIBUIDOR',
          tarifario_ut_chico: EPSA_TARIFF_DEFAULTS.map((row) => ({
            km_desde: row.kmDesde,
            km_hasta: row.kmHasta,
            la_jornada: row.laJornada,
          })),
        },
      };
      setRulesEditor(rulesObjectToEditorState(epsaTemplate));
      setRulesActive(true);
      setRulesSourceLabel('template_epsa');
      setRulesUpdatedAt(null);
      setRulesMessage('Plantilla EPSA cargada.');
      setRulesError(null);
      return;
    }

    setRulesLoading(true);
    setRulesError(null);
    setRulesMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/liquidaciones/reglas-template`, {
        credentials: 'include',
      });
      const payload = (await parseJsonSafe(response)) as Record<string, unknown> & { message?: string };
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo cargar la plantilla base de reglas.');
      }
      setRulesEditor(rulesObjectToEditorState(payload as Record<string, unknown>));
      setRulesActive(true);
      setRulesSourceLabel('template');
      setRulesUpdatedAt(null);
      setRulesMessage('Plantilla base cargada en el editor.');
    } catch (err) {
      setRulesError(err instanceof Error ? err.message : 'No se pudo cargar la plantilla base de reglas.');
    } finally {
      setRulesLoading(false);
    }
  };

  const handleIntermedioZoneChange = (zoneRaw: string) => {
    const zone = zoneRaw.trim().toUpperCase() || 'AMBA';
    setRulesEditor((current) => {
      const existingRows = current.intermedioMatrix?.[zone];
      return {
        ...current,
        intermedioSelectedZone: zone,
        intermedioMatrix: {
          ...current.intermedioMatrix,
          [zone]:
            Array.isArray(existingRows) && existingRows.length > 0
              ? existingRows
              : createIntermedioMatrixRows(zone, INTERMEDIO_ZONE_DEFAULTS[zone]),
        },
      };
    });
  };

  const handleIntermedioMatrixValueChange = (
    zone: string,
    rowId: string,
    field: 'original' | 'liquidacion',
    value: string
  ) => {
    setRulesEditor((current) => {
      const zoneRows = current.intermedioMatrix?.[zone] ?? createIntermedioMatrixRows(zone, INTERMEDIO_ZONE_DEFAULTS[zone]);
      return {
        ...current,
        intermedioMatrix: {
          ...current.intermedioMatrix,
          [zone]: zoneRows.map((row) =>
            row.key === rowId
              ? {
                  ...row,
                  [field]: value,
                }
              : row
          ),
        },
      };
    });
  };

  const handleEpsaTarifarioValueChange = (
    rowId: string,
    field: 'kmDesde' | 'kmHasta' | 'laJornada',
    value: string
  ) => {
    setRulesEditor((current) => ({
      ...current,
      epsaTarifario: (current.epsaTarifario ?? []).map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]: value,
            }
          : row
      ),
    }));
  };

  const handleCreateRun = async () => {
    setActionMessage(null);
    setActionError(null);

    if (!createClientCode.trim()) {
      setActionError('Ingresá el código de cliente para crear el run.');
      return;
    }
    if (!createPeriodRange.from || !createPeriodRange.to || createPeriodRange.year == null || createPeriodRange.month == null) {
      setActionError('Seleccioná mes y período para crear el run.');
      return;
    }
    if (createPeriodType === 'QUINCENAL' && !createPeriodFortnight) {
      setActionError('Seleccioná primera o segunda quincena.');
      return;
    }

    const periodFrom = createPeriodRange.from;
    const periodTo = createPeriodRange.to;
    const periodYear = createPeriodRange.year;
    const periodMonth = createPeriodRange.month;
    const periodType = createPeriodType;
    const periodFortnight = createPeriodType === 'QUINCENAL' ? createPeriodFortnight : null;

    setCreateLoading(true);
    try {
      let response: Response;
      if (createExtractFile) {
        const formData = new FormData();
        formData.append('source_system', 'powerbi');
        formData.append('client_code', createClientCode.trim());
        formData.append('period_from', periodFrom);
        formData.append('period_to', periodTo);
        formData.append('anio', String(periodYear));
        formData.append('mes', String(periodMonth));
        formData.append('tipo_periodo', periodType);
        if (periodFortnight) {
          formData.append('quincena', periodFortnight);
        }
        formData.append('status', 'CARGADA');
        formData.append('extract_file', createExtractFile);

        response = await fetch(`${apiBaseUrl}/api/liquidaciones/runs/upload`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
      } else {
        response = await fetch(`${apiBaseUrl}/api/liquidaciones/runs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
              source_system: 'powerbi',
              client_code: createClientCode.trim(),
              period_from: periodFrom,
              period_to: periodTo,
              anio: periodYear,
              mes: periodMonth,
              tipo_periodo: periodType,
              quincena: periodFortnight,
              source_file_name: createSourceFileName.trim() || null,
              status: 'CARGADA',
            }),
        });
      }

      const payload = (await parseJsonSafe(response)) as { data?: LiquidacionRunRecord; message?: string };
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo crear el run.');
      }

      const createdRunId = Number(payload?.data?.id);
      setActionMessage(`Run #${createdRunId} creado correctamente.`);
      setCreateSourceFileName('');
      setCreateExtractFile(null);
      if (createFileRef.current) {
        createFileRef.current.value = '';
      }
      await loadRuns();
      if (Number.isFinite(createdRunId) && createdRunId > 0) {
        setSelectedRunId(createdRunId);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo crear el run.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteRun = async (run: LiquidacionRunRecord) => {
    const runId = Number(run.id);
    if (!Number.isInteger(runId) || runId <= 0) {
      setActionError('No se pudo identificar el run a eliminar.');
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar el run #${runId}${run.clientCode ? ` (${run.clientCode})` : ''}? Esta acción no se puede deshacer.`
    );
    if (!confirmed) {
      return;
    }

    setActionMessage(null);
    setActionError(null);
    setDeletingRunIds((prev) => {
      const next = new Set(prev);
      next.add(runId);
      return next;
    });

    try {
      const response = await fetch(`${apiBaseUrl}/api/liquidaciones/runs/${runId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const payload = (await parseJsonSafe(response)) as { message?: string };
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo eliminar el run.');
      }

      if (selectedRunId === runId) {
        setSelectedRunId(null);
        setSelectedRun(null);
        setRunSummary(null);
        setLatestPublishJob(null);
        setImportacionPreview(null);
        setSelectedDistribuidorId(null);
        setSelectedDistribuidorDetail(null);
      }

      setActionMessage(payload?.message ?? `Run #${runId} eliminado correctamente.`);
      await loadRuns();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo eliminar el run.');
    } finally {
      setDeletingRunIds((prev) => {
        if (!prev.has(runId)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(runId);
        return next;
      });
    }
  };

  const handleApproveRun = async () => {
    if (!selectedRunId) {
      setActionError('Seleccioná un run para aprobar.');
      return;
    }

    setApproveLoading(true);
    setActionMessage(null);
    setActionError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/liquidaciones/runs/${selectedRunId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          force: approveForce,
          note: approveNote.trim() || null,
        }),
      });

      const payload = (await parseJsonSafe(response)) as { message?: string };
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo aprobar el run.');
      }

      setActionMessage(payload?.message ?? 'Run aprobado correctamente.');
      await loadRuns();
      await loadRunDetail(selectedRunId);
      await loadImportacionPreview(selectedRunId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo aprobar el run.');
    } finally {
      setApproveLoading(false);
    }
  };

  const handlePublishRun = async (dryRun: boolean) => {
    if (!selectedRunId) {
      setActionError('Seleccioná un run para publicar.');
      return;
    }

    const payloadBody: Record<string, unknown> = {
      dry_run: dryRun,
      force: publishForce,
    };

    const distributorCode = publishDistributorCode.trim();
    if (distributorCode) {
      payloadBody.only_distributor_code = distributorCode;
    }

    const liquidacionIdRaw = publishLiquidacionId.trim();
    if (liquidacionIdRaw) {
      const parsed = Number(liquidacionIdRaw);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        setActionError('El ID de liquidación debe ser un número entero positivo.');
        return;
      }
      payloadBody.liquidacion_id = parsed;
    }

    setPublishLoading(true);
    setActionMessage(null);
    setActionError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/liquidaciones/runs/${selectedRunId}/publicar-erp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payloadBody),
      });

      const payload = (await parseJsonSafe(response)) as { message?: string; data?: { status?: string } };
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo publicar el run.');
      }

      const statusLabel = payload?.data?.status ? ` (${payload.data.status})` : '';
      setActionMessage(dryRun ? `Dry run ERP ejecutado${statusLabel}.` : `Publicación ERP ejecutada${statusLabel}.`);
      await loadRuns();
      await loadRunDetail(selectedRunId);
      await loadImportacionPreview(selectedRunId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo publicar el run.');
    } finally {
      setPublishLoading(false);
    }
  };

  const handleSyncRunToPersonal = async () => {
    if (!selectedRunId) {
      setActionError('Seleccioná un run para sincronizar.');
      return;
    }

    setSyncPersonalLoading(true);
    setActionMessage(null);
    setActionError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/liquidaciones/runs/${selectedRunId}/sync-personal`, {
        method: 'POST',
        credentials: 'include',
      });

      const payload = (await parseJsonSafe(response)) as { message?: string };
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo sincronizar a liquidaciones del personal.');
      }

      setActionMessage(payload?.message ?? 'Sincronización a liquidaciones del personal completada.');
      await loadRuns();
      await loadRunDetail(selectedRunId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo sincronizar a liquidaciones del personal.');
    } finally {
      setSyncPersonalLoading(false);
    }
  };

  const handleLineaDraftChange = (lineaId: number, field: keyof Omit<LineaEditDraft, 'saving' | 'error'>, value: string) => {
    setLineaDrafts((current) => ({
      ...current,
      [lineaId]: {
        ...(current[lineaId] ?? {
          importeOverride: '',
          plusOverride: '',
          tarifaOverride: '',
          motivo: '',
          saving: false,
          error: null,
        }),
        [field]: value,
        error: null,
      },
    }));
  };

  const handleSaveLinea = async (lineaId: number) => {
    if (!selectedRunId || !selectedDistribuidorId) {
      setDetalleActionError('Seleccioná un run y un distribuidor.');
      return;
    }

    const draft = lineaDrafts[lineaId];
    if (!draft) {
      setDetalleActionError('No se encontró el borrador de la línea.');
      return;
    }

    const reason = draft.motivo.trim();
    if (!reason) {
      setLineaDrafts((current) => ({
        ...current,
        [lineaId]: {
          ...draft,
          error: 'Ingresá un motivo para guardar el override.',
        },
      }));
      return;
    }

    setDetalleActionMessage(null);
    setDetalleActionError(null);
    setLineaDrafts((current) => ({
      ...current,
      [lineaId]: {
        ...draft,
        saving: true,
        error: null,
      },
    }));

    try {
      const response = await fetch(`${apiBaseUrl}/api/liquidaciones/lineas/${lineaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          importe_override: parseOptionalNumber(draft.importeOverride),
          plus_override: parseOptionalNumber(draft.plusOverride),
          tarifa_override: parseOptionalNumber(draft.tarifaOverride),
          motivo: reason,
        }),
      });

      const payload = (await parseJsonSafe(response)) as { message?: string };
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo guardar la línea.');
      }

      setDetalleActionMessage(`Línea #${lineaId} actualizada.`);
      await Promise.all([
        loadRunDetail(selectedRunId),
        loadImportacionPreview(selectedRunId),
        loadDistribuidorDetail(selectedDistribuidorId),
      ]);
    } catch (err) {
      setLineaDrafts((current) => ({
        ...current,
        [lineaId]: {
          ...(current[lineaId] ?? draft),
          saving: false,
          error: err instanceof Error ? err.message : 'No se pudo guardar la línea.',
        },
      }));
      return;
    }

    setLineaDrafts((current) => ({
      ...current,
      [lineaId]: {
        ...(current[lineaId] ?? draft),
        saving: false,
        error: null,
      },
    }));
  };

  const handleSaveDistribuidor = async () => {
    if (!selectedRunId || !selectedDistribuidorId) {
      setDetalleActionError('Seleccioná un run y un distribuidor.');
      return;
    }

    const reason = distribuidorDraft.motivo.trim();
    if (!reason) {
      setDetalleActionError('Ingresá motivo para guardar gastos administrativos.');
      return;
    }

    setDetalleActionMessage(null);
    setDetalleActionError(null);
    setDistribuidorDraft((current) => ({
      ...current,
      saving: true,
    }));

    try {
      const response = await fetch(`${apiBaseUrl}/api/liquidaciones/distribuidores/${selectedDistribuidorId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          gastos_admin_override: parseOptionalNumber(distribuidorDraft.gastosAdminOverride),
          ajuste_manual: parseOptionalNumber(distribuidorDraft.ajusteManual),
          motivo: reason,
        }),
      });

      const payload = (await parseJsonSafe(response)) as { message?: string };
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo guardar gastos administrativos.');
      }

      setDetalleActionMessage(`Distribuidor #${selectedDistribuidorId} actualizado.`);
      await Promise.all([
        loadRunDetail(selectedRunId),
        loadImportacionPreview(selectedRunId),
        loadDistribuidorDetail(selectedDistribuidorId),
      ]);
    } catch (err) {
      setDetalleActionError(err instanceof Error ? err.message : 'No se pudo guardar gastos administrativos.');
    } finally {
      setDistribuidorDraft((current) => ({
        ...current,
        saving: false,
      }));
    }
  };

  const buildMatchDraftKey = useCallback((item: ImportacionPendingMatchItem) => {
    return `${item.patente_norm ?? ''}|${item.nombre_excel_norm ?? ''}|${item.row_id}`;
  }, []);

  const pendingMatchItems = useMemo(
    () =>
      Array.isArray(importacionPreview?.pendientes_match)
        ? (importacionPreview?.pendientes_match ?? [])
        : [],
    [importacionPreview?.pendientes_match]
  );

  useEffect(() => {
    setMatchAssignDrafts((current) => {
      const next: Record<string, MatchAssignDraft> = {};

      pendingMatchItems.forEach((item) => {
        const key = buildMatchDraftKey(item);
        const previous = current[key];
        const defaultProviderId =
          previous?.proveedorId && previous.proveedorId.trim()
            ? previous.proveedorId.trim()
            : item.candidatos?.[0]?.id != null
            ? String(item.candidatos[0].id)
            : '';
        const selectedCandidate = item.candidatos?.find((candidate) => String(candidate.id) === defaultProviderId);
        const defaultActualizarPatente = selectedCandidate ? !(selectedCandidate.patente && selectedCandidate.patente.trim()) : false;

        next[key] = createMatchAssignDraft({
          proveedorId: defaultProviderId,
          searchTerm: previous?.searchTerm ?? item.nombre_excel_raw ?? item.patente_norm ?? '',
          manualCandidates: previous?.manualCandidates ?? [],
          actualizarPatente: previous?.actualizarPatente ?? defaultActualizarPatente,
          sobreescribirPatente: previous?.sobreescribirPatente ?? false,
          motivo: previous?.motivo ?? '',
          saving: false,
          error: null,
          searching: false,
          searchError: null,
        });
      });

      return next;
    });
  }, [buildMatchDraftKey, createMatchAssignDraft, pendingMatchItems]);

  const handleMatchDraftChange = (
    key: string,
    field: 'proveedorId' | 'searchTerm' | 'actualizarPatente' | 'sobreescribirPatente' | 'motivo',
    value: string | boolean
  ) => {
    setMatchAssignDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? createMatchAssignDraft()),
        [field]: value,
        error: null,
        ...(field === 'searchTerm' ? { searchError: null } : {}),
      },
    }));
  };

  const handleSearchProvidersForMatch = async (item: ImportacionPendingMatchItem) => {
    const key = buildMatchDraftKey(item);
    const draft = matchAssignDrafts[key] ?? createMatchAssignDraft();
    const term = draft.searchTerm.trim();
    if (!term || term.length < 2) {
      setMatchAssignDrafts((current) => ({
        ...current,
        [key]: {
          ...(current[key] ?? draft),
          searchError: 'Ingresá al menos 2 caracteres para buscar.',
        },
      }));
      return;
    }

    setMatchAssignDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? draft),
        searching: true,
        searchError: null,
      },
    }));

    try {
      const params = new URLSearchParams();
      params.set('q', term);
      params.set('limit', '10');
      const response = await fetch(`${apiBaseUrl}/api/liquidaciones/proveedores/buscar?${params.toString()}`, {
        credentials: 'include',
      });
      const payload = (await parseJsonSafe(response)) as ProviderSearchResponse;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo buscar proveedores.');
      }

      const searched = Array.isArray(payload?.data) ? payload.data : [];
      setMatchAssignDrafts((current) => {
        const currentDraft = current[key] ?? draft;
        const fallbackProviderId = currentDraft.proveedorId.trim();
        const autoProviderId = fallbackProviderId
          || (searched[0]?.id != null ? String(searched[0].id) : '');
        const selectedCandidate = searched.find((candidate) => String(candidate.id) === autoProviderId);
        const candidateHasPatente = Boolean(
          selectedCandidate && typeof selectedCandidate.patente === 'string' && selectedCandidate.patente.trim()
        );

        return {
          ...current,
          [key]: {
            ...currentDraft,
            searching: false,
            manualCandidates: searched,
            proveedorId: autoProviderId,
            actualizarPatente:
              currentDraft.actualizarPatente
              || (selectedCandidate ? !candidateHasPatente : currentDraft.actualizarPatente),
            searchError: searched.length === 0 ? 'Sin resultados para esa búsqueda.' : null,
          },
        };
      });
    } catch (err) {
      setMatchAssignDrafts((current) => ({
        ...current,
        [key]: {
          ...(current[key] ?? draft),
          searching: false,
          searchError: err instanceof Error ? err.message : 'No se pudo buscar proveedores.',
        },
      }));
    }
  };

  const handleAssignProvider = async (item: ImportacionPendingMatchItem) => {
    if (!selectedRunId) {
      setActionError('Seleccioná un run para asignar proveedor.');
      return;
    }

    const key = buildMatchDraftKey(item);
    const draft = matchAssignDrafts[key] ?? createMatchAssignDraft();
    const providerId = Number(draft.proveedorId);
    if (!Number.isInteger(providerId) || providerId <= 0) {
      setMatchAssignDrafts((current) => ({
        ...current,
        [key]: {
          ...draft,
          error: 'Seleccioná un proveedor válido.',
        },
      }));
      return;
    }

    if (draft.actualizarPatente && draft.sobreescribirPatente && !draft.motivo.trim()) {
      setMatchAssignDrafts((current) => ({
        ...current,
        [key]: {
          ...draft,
          error: 'Ingresá motivo para sobreescribir patente existente.',
        },
      }));
      return;
    }

    setActionMessage(null);
    setActionError(null);
    setMatchAssignDrafts((current) => ({
      ...current,
      [key]: {
        ...draft,
        saving: true,
        error: null,
      },
    }));

    try {
      const response = await fetch(`${apiBaseUrl}/api/liquidaciones/importaciones/${selectedRunId}/asignar-proveedor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          patente_norm: item.patente_norm,
          nombre_excel_norm: item.nombre_excel_norm,
          proveedor_id: providerId,
          actualizar_patente_en_proveedor: draft.actualizarPatente,
          sobreescribir_patente_existente: draft.sobreescribirPatente,
          motivo: draft.motivo.trim() || null,
        }),
      });

      const payload = (await parseJsonSafe(response)) as { message?: string };
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo asignar el proveedor.');
      }

      setActionMessage(payload?.message ?? `Proveedor #${providerId} asignado para patente ${item.patente_norm ?? '—'}.`);
      const refreshTasks: Array<Promise<unknown>> = [loadRunDetail(selectedRunId), loadImportacionPreview(selectedRunId)];
      if (selectedDistribuidorId != null) {
        refreshTasks.push(loadDistribuidorDetail(selectedDistribuidorId));
      }
      await Promise.all(refreshTasks);
    } catch (err) {
      setMatchAssignDrafts((current) => ({
        ...current,
        [key]: {
          ...(current[key] ?? draft),
          saving: false,
          error: err instanceof Error ? err.message : 'No se pudo asignar el proveedor.',
        },
      }));
      return;
    }

    setMatchAssignDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? draft),
        saving: false,
        error: null,
      },
    }));
  };

  const getPendingMatchStatusLabel = useCallback((statusRaw?: string | null) => {
    const status = (statusRaw ?? '').trim().toUpperCase();
    if (status === 'SIN_MATCH') {
      return 'Sin match';
    }
    if (status === 'PENDIENTE_ASIGNACION') {
      return 'Pendiente asignación';
    }
    if (status === 'MANUAL_CONFIRMED') {
      return 'Asignado manual';
    }
    return status || '—';
  }, []);

  const getPendingMatchStatusBadgeClass = useCallback((statusRaw?: string | null) => {
    const status = (statusRaw ?? '').trim().toUpperCase();
    if (status === 'SIN_MATCH') {
      return 'fuel-badge fuel-badge--danger';
    }
    if (status === 'PENDIENTE_ASIGNACION') {
      return 'fuel-badge fuel-badge--warning';
    }
    if (status === 'MANUAL_CONFIRMED') {
      return 'fuel-badge fuel-badge--success';
    }
    return 'fuel-badge fuel-badge--muted';
  }, []);

  const canEditSelectedRun = ['PRELIQUIDACION', 'CARGADA'].includes((selectedRun?.status ?? '').toUpperCase());
  const previewDistribuidores = Array.isArray(importacionPreview?.distribuidores) ? (importacionPreview?.distribuidores ?? []) : [];

  return (
    <DashboardLayout
      title={isStandaloneExtractosRoute ? 'Liquidaciones' : 'Combustible'}
      subtitle={isStandaloneExtractosRoute ? 'Extractos BI/ERP' : 'Runs BI/ERP'}
      headerContent={isStandaloneExtractosRoute ? undefined : <CombustibleTabs />}
    >
      <section className="dashboard-card">
        <header className="card-header">
          <h3>Panel de control</h3>
        </header>
        <div className="card-body">
          <div className="form-grid">
            <label className="input-control">
              <span>Estado</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Todos</option>
                <option value="CARGADA">CARGADA</option>
                <option value="PROCESADA">PROCESADA</option>
                <option value="PRELIQUIDACION">PRELIQUIDACION</option>
                <option value="APROBADA">APROBADA</option>
                <option value="PUBLICADA">PUBLICADA</option>
                <option value="RECEIVED">RECEIVED (legacy)</option>
                <option value="VALIDATED">VALIDATED (legacy)</option>
                <option value="APPROVED">APPROVED (legacy)</option>
                <option value="PUBLISHED">PUBLISHED (legacy)</option>
                <option value="PARTIAL">PARTIAL</option>
                <option value="FAILED">FAILED</option>
              </select>
            </label>
            <label className="input-control">
              <span>Cliente</span>
              <select
                value={clientCodeFilter}
                onChange={(event) => setClientCodeFilter(event.target.value)}
              >
                <option value="">Todos</option>
                {clientOptions.map((option) => (
                  <option key={`filter-client-${option.code}`} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="filters-actions">
            <button type="button" className="secondary-action" onClick={loadRuns} disabled={loadingRuns}>
              {loadingRuns ? 'Actualizando...' : 'Actualizar runs'}
            </button>
            <span className="helper-text">
              {`Total: ${meta.total} · Página ${meta.currentPage}/${Math.max(1, meta.lastPage)} · ${meta.perPage} por página`}
            </span>
          </div>
          <div className="summary-cards">
            {Object.keys(statusCounts).length === 0 ? (
              <div className="summary-card">
                <span className="summary-card__label">Estados</span>
                <strong className="summary-card__value">—</strong>
              </div>
            ) : (
              Object.entries(statusCounts).map(([status, total]) => (
                <div className="summary-card" key={`run-status-${status}`}>
                  <span className="summary-card__label">{status}</span>
                  <strong className="summary-card__value">{total}</strong>
                </div>
              ))
            )}
          </div>
          {runsError ? <p className="form-info form-info--error">{runsError}</p> : null}
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <h3>{isStandaloneExtractosRoute ? 'Subir liquidación y crear run' : 'Crear run manual'}</h3>
        </header>
        <div className="card-body">
          <div className="form-grid">
            <label className="input-control">
              <span>Cliente</span>
              <input
                value={createClientCode}
                onChange={(event) => setCreateClientCode(event.target.value)}
                onBlur={(event) => setCreateClientCode(event.target.value.trim().toUpperCase())}
                list="create-run-client-options"
                placeholder="Seleccionar o escribir cliente"
              />
              <datalist id="create-run-client-options">
                {clientOptions.map((option) => (
                  <option key={`create-client-${option.code}`} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </datalist>
              <small className="helper-text">Podés elegir de la lista o escribir un cliente nuevo.</small>
            </label>
            <label className="input-control">
              <span>Mes liquidación</span>
              <input type="month" value={createPeriodMonth} onChange={(event) => setCreatePeriodMonth(event.target.value)} />
            </label>
            <label className="input-control">
              <span>Tipo período</span>
              <select
                value={createPeriodType}
                onChange={(event) => setCreatePeriodType(event.target.value as 'QUINCENAL' | 'MENSUAL')}
              >
                <option value="QUINCENAL">Quincenal</option>
                <option value="MENSUAL">Mes completo</option>
              </select>
            </label>
            <label className="input-control">
              <span>Quincena</span>
              <select
                value={createPeriodType === 'QUINCENAL' ? createPeriodFortnight : ''}
                onChange={(event) => setCreatePeriodFortnight(event.target.value as '1Q' | '2Q')}
                disabled={createPeriodType !== 'QUINCENAL'}
              >
                <option value="1Q">Primera quincena</option>
                <option value="2Q">Segunda quincena</option>
              </select>
            </label>
            <label className="input-control">
              <span>Período desde</span>
              <input type="date" value={createPeriodRange.from} readOnly />
            </label>
            <label className="input-control">
              <span>Período hasta</span>
              <input type="date" value={createPeriodRange.to} readOnly />
            </label>
            <label className="input-control">
              <span>Archivo origen</span>
              <input
                value={createSourceFileName}
                onChange={(event) => setCreateSourceFileName(event.target.value)}
                placeholder="liquidacion-cliente.xlsx"
              />
            </label>
            <label className="input-control">
              <span>Archivo liquidación (.xlsx/.xls/.csv)</span>
              <input
                ref={createFileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setCreateExtractFile(file);
                  if (file) {
                    setCreateSourceFileName(file.name);
                  } else {
                    setCreateSourceFileName('');
                  }
                }}
              />
            </label>
          </div>
          {createExtractFile ? (
            <div style={{ marginTop: 12 }}>
              {createPreviewLoading ? <p className="helper-text">Analizando extracto...</p> : null}
              {createPreviewError ? <p className="form-info form-info--error">{createPreviewError}</p> : null}
              {createExtractPreview && !createPreviewLoading ? (
                <>
                  <div className="summary-cards">
                    <div className="summary-card">
                      <span className="summary-card__label">Filas detectadas</span>
                      <strong className="summary-card__value">{Number(createExtractPreview.rowCount) || 0}</strong>
                    </div>
                    <div className="summary-card">
                      <span className="summary-card__label">OK</span>
                      <strong className="summary-card__value">{Number(createExtractPreview.rowsByStatus?.ok) || 0}</strong>
                    </div>
                    <div className="summary-card">
                      <span className="summary-card__label">Errores</span>
                      <strong className="summary-card__value">{Number(createExtractPreview.rowsByStatus?.error) || 0}</strong>
                    </div>
                    <div className="summary-card">
                      <span className="summary-card__label">Diferencias</span>
                      <strong className="summary-card__value">{Number(createExtractPreview.rowsByStatus?.diff) || 0}</strong>
                    </div>
                  </div>

                  {createExtractPreview.mapped === false ? (
                    <p className="form-info form-info--error">No se pudieron mapear columnas al formato esperado.</p>
                  ) : (
                    <p className="helper-text">
                      {createExtractPreview.productColumnMessage ??
                        `Concepto tomado desde ${createExtractPreview.productColumn ? `columna ${createExtractPreview.productColumn}` : 'encabezado detectado'}.`}
                    </p>
                  )}
                  {createExtractPreview.rules ? (
                    <p className="helper-text">
                      Reglas aplicadas: {createExtractPreview.rules.source === 'client' ? 'cliente' : 'default'} ·
                      Tarifas configuradas: {Number(createExtractPreview.rules.tariffsCount) || 0}
                    </p>
                  ) : null}

                  {Array.isArray(createExtractPreview.detectedColumns) && createExtractPreview.detectedColumns.length > 0 ? (
                    <p className="helper-text">
                      <strong>Columnas detectadas:</strong> {createExtractPreview.detectedColumns.join(', ')}
                    </p>
                  ) : null}

                  {Array.isArray(createExtractPreview.sampleRows) && createExtractPreview.sampleRows.length > 0 ? (
                    <div className="table-wrapper" style={{ marginTop: 8 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Dominio</th>
                            <th>Concepto</th>
                            <th>Litros</th>
                            <th>Importe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {createExtractPreview.sampleRows.map((row, index) => (
                            <tr key={`preview-row-${index}`}>
                              <td>{row.fecha || '—'}</td>
                              <td>{row.dominio || '—'}</td>
                              <td>{row.producto || '—'}</td>
                              <td>{row.litros || '—'}</td>
                              <td>{row.importe || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
          <div className="filters-actions">
            <button
              type="button"
              className="primary-action"
              onClick={handleCreateRun}
              disabled={createLoading || (Boolean(createExtractFile) && createPreviewLoading)}
            >
              {createLoading ? 'Creando...' : createExtractFile ? 'Subir y crear run' : 'Crear run'}
            </button>
          </div>
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <h3>Reglas por cliente</h3>
        </header>
        <div className="card-body">
          <div className="form-grid">
            <label className="input-control">
              <span>Cliente</span>
              <input
                value={rulesClientCode}
                onChange={(event) => handleRulesClientChange(event.target.value)}
                onBlur={(event) => setRulesClientCode(event.target.value.trim().toUpperCase())}
                list="rules-client-options"
                placeholder="INT / INTERMEDIO / código manual"
              />
              <datalist id="rules-client-options">
                {clientOptions.map((option) => (
                  <option key={`rules-client-${option.code}`} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </datalist>
            </label>
            <label className="checkbox-control" style={{ alignSelf: 'end' }}>
              <input
                type="checkbox"
                checked={rulesActive}
                onChange={(event) => setRulesActive(event.target.checked)}
              />
              <span>Reglas activas</span>
            </label>
            <div className="helper-text" style={{ alignSelf: 'end' }}>
              Fuente: {rulesSourceLabel ?? '—'} · Última actualización: {formatDateCell(rulesUpdatedAt)}
            </div>
          </div>

          <div className="form-grid" style={{ marginTop: 8 }}>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={rulesEditor.duplicateRowBlocking}
                onChange={(event) =>
                  setRulesEditor((current) => ({
                    ...current,
                    duplicateRowBlocking: event.target.checked,
                  }))
                }
              />
              <span>Bloquear duplicados</span>
            </label>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={rulesEditor.outsidePeriodBlocking}
                onChange={(event) =>
                  setRulesEditor((current) => ({
                    ...current,
                    outsidePeriodBlocking: event.target.checked,
                  }))
                }
              />
              <span>Bloquear fuera de período</span>
            </label>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={rulesEditor.tariffMismatchBlocking}
                onChange={(event) =>
                  setRulesEditor((current) => ({
                    ...current,
                    tariffMismatchBlocking: event.target.checked,
                  }))
                }
              />
              <span>Bloquear diferencias de tarifa</span>
            </label>
          </div>

          <div className="form-grid" style={{ marginTop: 8 }}>
            <label className="input-control">
              <span>Tolerancia % precio/litro</span>
              <input
                value={rulesEditor.tolerancePercent}
                onChange={(event) =>
                  setRulesEditor((current) => ({
                    ...current,
                    tolerancePercent: event.target.value,
                  }))
                }
                placeholder="3"
              />
            </label>
            <label className="input-control">
              <span>Tolerancia monto precio/litro</span>
              <input
                value={rulesEditor.toleranceAmount}
                onChange={(event) =>
                  setRulesEditor((current) => ({
                    ...current,
                    toleranceAmount: event.target.value,
                  }))
                }
                placeholder="0"
              />
            </label>
          </div>

          {isIntermedioRulesClient ? (
            <>
              <div className="form-grid" style={{ marginTop: 8 }}>
                <label className="input-control">
                  <span>Zona tarifaria</span>
                  <select
                    value={intermedioRulesZone}
                    onChange={(event) => handleIntermedioZoneChange(event.target.value)}
                  >
                    {INTERMEDIO_ZONES.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="helper-text" style={{ alignSelf: 'end' }}>
                  Matriz INTERMEDIO: valor original del cliente y valor de liquidación aplicado.
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Servicio</th>
                      <th>Original</th>
                      <th>Liquidación</th>
                      <th>Especial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intermedioRulesZoneRows.map((row) => (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        <td>
                          <input
                            value={row.original}
                            onChange={(event) =>
                              handleIntermedioMatrixValueChange(
                                intermedioRulesZone,
                                row.key,
                                'original',
                                event.target.value
                              )
                            }
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <input
                            value={row.liquidacion}
                            onChange={(event) =>
                              handleIntermedioMatrixValueChange(
                                intermedioRulesZone,
                                row.key,
                                'liquidacion',
                                event.target.value
                              )
                            }
                            placeholder="0"
                          />
                        </td>
                        <td>{row.special ? 'Sí' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : isEpsaRulesClient ? (
            <>
              <div className="form-grid" style={{ marginTop: 8 }}>
                <div className="helper-text">
                  Tarifario EPSA (UT.Chico/Camionetas) por rango de km. Hoja oficial: <strong>Table</strong>.
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>KM desde</th>
                      <th>KM hasta</th>
                      <th>LA jornada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {epsaRulesRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <input
                            value={row.kmDesde}
                            onChange={(event) => handleEpsaTarifarioValueChange(row.id, 'kmDesde', event.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <input
                            value={row.kmHasta}
                            onChange={(event) => handleEpsaTarifarioValueChange(row.id, 'kmHasta', event.target.value)}
                            placeholder="90"
                          />
                        </td>
                        <td>
                          <input
                            value={row.laJornada}
                            onChange={(event) => handleEpsaTarifarioValueChange(row.id, 'laJornada', event.target.value)}
                            placeholder="92636.70"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="filters-actions" style={{ marginTop: 8 }}>
                <span className="helper-text">Tarifas operativas ({rulesEditor.tariffs.length})</span>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() =>
                    setRulesEditor((current) => ({
                      ...current,
                      tariffs: [...current.tariffs, createTariffRuleEditorRow()],
                    }))
                  }
                >
                  Agregar tarifa
                </button>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Tarifa</th>
                      <th>Tolerancia %</th>
                      <th>Tolerancia monto</th>
                      <th>Vigencia desde</th>
                      <th>Vigencia hasta</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rulesEditor.tariffs.length === 0 ? (
                      <tr>
                        <td colSpan={7}>Sin tarifas cargadas.</td>
                      </tr>
                    ) : (
                      rulesEditor.tariffs.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <select
                              value={row.product}
                              onChange={(event) =>
                                setRulesEditor((current) => ({
                                  ...current,
                                  tariffs: current.tariffs.map((tariffRow) =>
                                    tariffRow.id === row.id
                                      ? {
                                          ...tariffRow,
                                          product: event.target.value,
                                        }
                                      : tariffRow
                                  ),
                                }))
                              }
                            >
                              <option value="">Seleccionar tarifa</option>
                              {RULE_TARIFF_PRODUCT_OPTIONS.map((option) => (
                                <option key={`tariff-product-${row.id}-${option}`} value={option}>
                                  {option}
                                </option>
                              ))}
                              {row.product && !RULE_TARIFF_PRODUCT_OPTIONS.includes(row.product) ? (
                                <option value={row.product}>{row.product}</option>
                              ) : null}
                            </select>
                          </td>
                          <td>
                            <input
                              value={row.pricePerLiter}
                              onChange={(event) =>
                                setRulesEditor((current) => ({
                                  ...current,
                                  tariffs: current.tariffs.map((tariffRow) =>
                                    tariffRow.id === row.id
                                      ? {
                                          ...tariffRow,
                                          pricePerLiter: event.target.value,
                                        }
                                      : tariffRow
                                  ),
                                }))
                              }
                              placeholder="1250.50"
                            />
                          </td>
                          <td>
                            <input
                              value={row.tolerancePercent}
                              onChange={(event) =>
                                setRulesEditor((current) => ({
                                  ...current,
                                  tariffs: current.tariffs.map((tariffRow) =>
                                    tariffRow.id === row.id
                                      ? {
                                          ...tariffRow,
                                          tolerancePercent: event.target.value,
                                        }
                                      : tariffRow
                                  ),
                                }))
                              }
                              placeholder="3"
                            />
                          </td>
                          <td>
                            <input
                              value={row.toleranceAmount}
                              onChange={(event) =>
                                setRulesEditor((current) => ({
                                  ...current,
                                  tariffs: current.tariffs.map((tariffRow) =>
                                    tariffRow.id === row.id
                                      ? {
                                          ...tariffRow,
                                          toleranceAmount: event.target.value,
                                        }
                                      : tariffRow
                                  ),
                                }))
                              }
                              placeholder="0"
                            />
                          </td>
                          <td>
                            <input
                              type="date"
                              value={row.effectiveFrom}
                              onChange={(event) =>
                                setRulesEditor((current) => ({
                                  ...current,
                                  tariffs: current.tariffs.map((tariffRow) =>
                                    tariffRow.id === row.id
                                      ? {
                                          ...tariffRow,
                                          effectiveFrom: event.target.value,
                                        }
                                      : tariffRow
                                  ),
                                }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="date"
                              value={row.effectiveTo}
                              onChange={(event) =>
                                setRulesEditor((current) => ({
                                  ...current,
                                  tariffs: current.tariffs.map((tariffRow) =>
                                    tariffRow.id === row.id
                                      ? {
                                          ...tariffRow,
                                          effectiveTo: event.target.value,
                                        }
                                      : tariffRow
                                  ),
                                }))
                              }
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="secondary-action secondary-action--ghost"
                              onClick={() =>
                                setRulesEditor((current) => ({
                                  ...current,
                                  tariffs: current.tariffs.filter((tariffRow) => tariffRow.id !== row.id),
                                }))
                              }
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
            </>
          )}

          <div className="filters-actions" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="secondary-action secondary-action--ghost"
              onClick={() => setRulesShowJson((current) => !current)}
            >
              {rulesShowJson ? 'Ocultar JSON técnico' : 'Ver JSON técnico'}
            </button>
          </div>

          {rulesShowJson ? (
            <label className="input-control" style={{ marginTop: 8 }}>
              <span>JSON generado (solo lectura)</span>
              <textarea value={rulesJsonText} rows={14} readOnly style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace' }} />
            </label>
          ) : null}

          <div className="filters-actions">
            <button type="button" className="secondary-action" onClick={handleLoadRulesTemplate} disabled={rulesLoading || rulesSaving}>
              {rulesLoading ? 'Cargando...' : 'Cargar plantilla'}
            </button>
            <button type="button" className="secondary-action" onClick={handleLoadClientRules} disabled={rulesLoading || rulesSaving}>
              {rulesLoading ? 'Cargando...' : 'Cargar reglas cliente'}
            </button>
            <button type="button" className="primary-action" onClick={handleSaveClientRules} disabled={rulesLoading || rulesSaving}>
              {rulesSaving ? 'Guardando...' : 'Guardar reglas'}
            </button>
          </div>

          {rulesMessage ? <p className="form-info form-info--success">{rulesMessage}</p> : null}
          {rulesError ? <p className="form-info form-info--error">{rulesError}</p> : null}
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <h3>Listado de runs</h3>
        </header>
        <div className="card-body">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Período</th>
                  <th>Estado</th>
                  <th>Filas</th>
                  <th>OK</th>
                  <th>Errores</th>
                  <th>Alertas</th>
                  <th>Diferencias</th>
                  <th>Creado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loadingRuns ? (
                  <tr>
                    <td colSpan={11}>Cargando runs...</td>
                  </tr>
                ) : runs.length === 0 ? (
                  <tr>
                    <td colSpan={11}>No hay runs para mostrar.</td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr
                      key={`run-${run.id}`}
                      onClick={() => setSelectedRunId(run.id)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: selectedRunId === run.id ? 'rgba(66, 133, 244, 0.08)' : undefined,
                      }}
                    >
                      <td>{run.id}</td>
                      <td>{run.clientCode ?? '—'}</td>
                      <td>{`${run.periodFrom ?? '—'} / ${run.periodTo ?? '—'}`}</td>
                      <td>{run.status ?? '—'}</td>
                      <td>{run.rowsTotal ?? 0}</td>
                      <td>{run.rowsOk ?? 0}</td>
                      <td>{run.rowsError ?? 0}</td>
                      <td>{run.rowsAlert ?? 0}</td>
                      <td>{run.rowsDiff ?? 0}</td>
                      <td>{formatDateCell(run.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary-action secondary-action--danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDeleteRun(run);
                          }}
                          disabled={deletingRunIds.has(run.id)}
                        >
                          {deletingRunIds.has(run.id) ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <h3>Preliquidación editable</h3>
        </header>
        <div className="card-body">
          {selectedRunId == null ? (
            <p className="helper-text">Seleccioná un run para revisar distribuidores y líneas.</p>
          ) : importacionPreviewLoading ? (
            <p className="helper-text">Cargando preliquidación...</p>
          ) : importacionPreviewError ? (
            <p className="form-info form-info--error">{importacionPreviewError}</p>
          ) : (
            <>
              <div className="summary-cards">
                <div className="summary-card">
                  <span className="summary-card__label">Filas total</span>
                  <strong className="summary-card__value">{Number(importacionPreview?.resumen?.filas_total) || 0}</strong>
                </div>
                <div className="summary-card">
                  <span className="summary-card__label">Distribuidores</span>
                  <strong className="summary-card__value">{Number(importacionPreview?.resumen?.distribuidores_total) || 0}</strong>
                </div>
                <div className="summary-card">
                  <span className="summary-card__label">Críticos</span>
                  <strong className="summary-card__value">{Number(importacionPreview?.resumen?.criticos) || 0}</strong>
                </div>
                <div className="summary-card">
                  <span className="summary-card__label">Alertas</span>
                  <strong className="summary-card__value">{Number(importacionPreview?.resumen?.alertas) || 0}</strong>
                </div>
                <div className="summary-card">
                  <span className="summary-card__label">Pendientes match</span>
                  <strong className="summary-card__value">{Number(importacionPreview?.resumen?.pendientes_match) || pendingMatchItems.length}</strong>
                </div>
              </div>

              <section className="pending-match-section" style={{ marginTop: 12 }}>
                <header className="card-header">
                  <h4>Pendientes de match</h4>
                  <span className="form-info">Asigná proveedor por candidato, búsqueda o ID manual.</span>
                </header>
                {pendingMatchItems.length === 0 ? (
                  <p className="helper-text">No hay pendientes de asignación de proveedor.</p>
                ) : (
                  <>
                  <div className="table-wrapper pending-match-table-wrapper">
                    <table className="pending-match-table">
                      <thead>
                        <tr>
                          <th>Fila</th>
                          <th>Patente</th>
                          <th>Nombre Excel</th>
                          <th>Estado</th>
                          <th>Candidatos</th>
                          <th>Proveedor a asignar</th>
                          <th>Actualizar patente</th>
                          <th>Sobrescribir patente</th>
                          <th>Motivo</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingMatchItems.map((item) => {
                          const key = buildMatchDraftKey(item);
                          const draft = matchAssignDrafts[key] ?? createMatchAssignDraft();
                          const candidateOptions = [
                            ...(Array.isArray(item.candidatos) ? item.candidatos : []),
                            ...(Array.isArray(draft.manualCandidates) ? draft.manualCandidates : []),
                          ].reduce<ImportacionMatchCandidate[]>((acc, candidate) => {
                            if (!candidate || typeof candidate.id !== 'number') {
                              return acc;
                            }
                            if (acc.some((existing) => existing.id === candidate.id)) {
                              return acc;
                            }
                            acc.push(candidate);
                            return acc;
                          }, []);

                          return (
                            <React.Fragment key={`pending-match-${key}`}>
                              <tr>
                                <td>{item.row_number ?? item.row_id}</td>
                                <td>{item.patente_norm ?? '—'}</td>
                                <td>{item.nombre_excel_raw ?? item.nombre_excel_norm ?? '—'}</td>
                                <td>
                                  <span className={getPendingMatchStatusBadgeClass(item.match_status)}>
                                    {getPendingMatchStatusLabel(item.match_status)}
                                  </span>
                                </td>
                                <td>
                                  {Array.isArray(item.candidatos) && item.candidatos.length > 0 ? (
                                    <ul className="pending-match-candidate-list">
                                      {item.candidatos.slice(0, 4).map((candidate) => (
                                        <li key={`cand-${key}-${candidate.id}`}>
                                          <button
                                            type="button"
                                            className="pending-match-candidate-btn"
                                            onClick={() => {
                                              handleMatchDraftChange(key, 'proveedorId', String(candidate.id));
                                              const candidateHasPatente =
                                                typeof candidate.patente === 'string' && candidate.patente.trim() !== '';
                                              handleMatchDraftChange(key, 'actualizarPatente', !candidateHasPatente);
                                            }}
                                          >
                                            <strong>#{candidate.id}</strong> {candidate.nombre}
                                            <span>{candidate.score ?? 0}</span>
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <span className="pending-match-empty-candidates">Sin candidatos</span>
                                  )}
                                </td>
                                <td>
                                  <div className="pending-match-provider-grid">
                                    <span className="pending-match-provider-hint">Buscá por nombre, CUIT/CUIL o patente.</span>
                                    <div className="pending-match-search-row">
                                      <input
                                        value={draft.searchTerm}
                                        onChange={(event) => handleMatchDraftChange(key, 'searchTerm', event.target.value)}
                                        placeholder="Buscar por nombre/cuit-cuil/patente"
                                      />
                                      <button
                                        type="button"
                                        className="secondary-action secondary-action--ghost"
                                        onClick={() => handleSearchProvidersForMatch(item)}
                                        disabled={draft.searching}
                                      >
                                        {draft.searching ? 'Buscando...' : 'Buscar'}
                                      </button>
                                    </div>
                                    <select
                                      value={
                                        candidateOptions.some((candidate) => String(candidate.id) === draft.proveedorId)
                                          ? draft.proveedorId
                                          : ''
                                      }
                                      onChange={(event) => {
                                        const nextProviderId = event.target.value;
                                        const selectedCandidate = candidateOptions.find(
                                          (candidate) => String(candidate.id) === nextProviderId
                                        );
                                        handleMatchDraftChange(key, 'proveedorId', nextProviderId);
                                        if (selectedCandidate) {
                                          const candidateHasPatente =
                                            typeof selectedCandidate.patente === 'string' && selectedCandidate.patente.trim() !== '';
                                          handleMatchDraftChange(key, 'actualizarPatente', !candidateHasPatente);
                                        }
                                      }}
                                    >
                                      <option value="">Seleccionar candidato</option>
                                      {candidateOptions.map((candidate) => (
                                        <option value={String(candidate.id)} key={`candidate-option-${key}-${candidate.id}`}>
                                          {`#${candidate.id} - ${candidate.nombre}${candidate.cuil ? ` - ${candidate.cuil}` : ''}`}
                                        </option>
                                      ))}
                                    </select>
                                    <label className="pending-match-manual-id">
                                      <span>ID manual</span>
                                      <input
                                        value={draft.proveedorId}
                                        onChange={(event) =>
                                          handleMatchDraftChange(
                                            key,
                                            'proveedorId',
                                            event.target.value.replace(/[^\d]/g, '')
                                          )
                                        }
                                        placeholder="Ej: 389"
                                        inputMode="numeric"
                                        className="pending-match-provider-manual-input"
                                      />
                                    </label>
                                    {draft.searchError ? (
                                      <span className="form-info form-info--error pending-match-inline-error">
                                        {draft.searchError}
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td>
                                  <label className="checkbox-control">
                                    <input
                                      type="checkbox"
                                      checked={draft.actualizarPatente}
                                      onChange={(event) => handleMatchDraftChange(key, 'actualizarPatente', event.target.checked)}
                                    />
                                    <span>Sí</span>
                                  </label>
                                </td>
                                <td>
                                  <label className="checkbox-control">
                                    <input
                                      type="checkbox"
                                      checked={draft.sobreescribirPatente}
                                      onChange={(event) => handleMatchDraftChange(key, 'sobreescribirPatente', event.target.checked)}
                                      disabled={!draft.actualizarPatente}
                                    />
                                    <span>Sí</span>
                                  </label>
                                </td>
                                <td>
                                  <input
                                    value={draft.motivo}
                                    onChange={(event) => handleMatchDraftChange(key, 'motivo', event.target.value)}
                                    placeholder="Motivo (si sobreescribe)"
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="primary-action pending-match-assign-btn"
                                    onClick={() => handleAssignProvider(item)}
                                    disabled={draft.saving || !canEditSelectedRun}
                                  >
                                    {draft.saving ? 'Asignando...' : 'Asignar'}
                                  </button>
                                </td>
                              </tr>
                              {draft.error ? (
                                <tr>
                                  <td colSpan={10} className="form-info form-info--error">
                                    {draft.error}
                                  </td>
                                </tr>
                              ) : null}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="pending-match-cards">
                    {pendingMatchItems.map((item) => {
                      const key = buildMatchDraftKey(item);
                      const draft = matchAssignDrafts[key] ?? createMatchAssignDraft();
                      const candidateOptions = [
                        ...(Array.isArray(item.candidatos) ? item.candidatos : []),
                        ...(Array.isArray(draft.manualCandidates) ? draft.manualCandidates : []),
                      ].reduce<ImportacionMatchCandidate[]>((acc, candidate) => {
                        if (!candidate || typeof candidate.id !== 'number') {
                          return acc;
                        }
                        if (acc.some((existing) => existing.id === candidate.id)) {
                          return acc;
                        }
                        acc.push(candidate);
                        return acc;
                      }, []);

                      return (
                        <article className="pending-match-card" key={`pending-match-card-${key}`}>
                          <header className="pending-match-card__header">
                            <div>
                              <p className="pending-match-card__label">Fila #{item.row_number ?? item.row_id}</p>
                              <strong>{item.patente_norm ?? '—'}</strong>
                            </div>
                            <span className={getPendingMatchStatusBadgeClass(item.match_status)}>
                              {getPendingMatchStatusLabel(item.match_status)}
                            </span>
                          </header>

                          <div className="pending-match-card__body">
                            <div className="pending-match-card__field">
                              <span className="pending-match-card__label">Nombre Excel</span>
                              <strong>{item.nombre_excel_raw ?? item.nombre_excel_norm ?? '—'}</strong>
                            </div>

                            <div className="pending-match-card__field">
                              <span className="pending-match-card__label">Candidatos</span>
                              {Array.isArray(item.candidatos) && item.candidatos.length > 0 ? (
                                <ul className="pending-match-candidate-list">
                                  {item.candidatos.slice(0, 4).map((candidate) => (
                                    <li key={`cand-card-${key}-${candidate.id}`}>
                                      <button
                                        type="button"
                                        className="pending-match-candidate-btn"
                                        onClick={() => {
                                          handleMatchDraftChange(key, 'proveedorId', String(candidate.id));
                                          const candidateHasPatente =
                                            typeof candidate.patente === 'string' && candidate.patente.trim() !== '';
                                          handleMatchDraftChange(key, 'actualizarPatente', !candidateHasPatente);
                                        }}
                                      >
                                        <strong>#{candidate.id}</strong> {candidate.nombre}
                                        <span>{candidate.score ?? 0}</span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="pending-match-empty-candidates">Sin candidatos</span>
                              )}
                            </div>

                            <div className="pending-match-card__field">
                              <span className="pending-match-card__label">Proveedor a asignar</span>
                              <div className="pending-match-provider-grid">
                                <span className="pending-match-provider-hint">Buscá por nombre, CUIT/CUIL o patente.</span>
                                <div className="pending-match-search-row">
                                  <input
                                    value={draft.searchTerm}
                                    onChange={(event) => handleMatchDraftChange(key, 'searchTerm', event.target.value)}
                                    placeholder="Buscar por nombre/cuit-cuil/patente"
                                  />
                                  <button
                                    type="button"
                                    className="secondary-action secondary-action--ghost"
                                    onClick={() => handleSearchProvidersForMatch(item)}
                                    disabled={draft.searching}
                                  >
                                    {draft.searching ? 'Buscando...' : 'Buscar'}
                                  </button>
                                </div>
                                <select
                                  value={
                                    candidateOptions.some((candidate) => String(candidate.id) === draft.proveedorId)
                                      ? draft.proveedorId
                                      : ''
                                  }
                                  onChange={(event) => {
                                    const nextProviderId = event.target.value;
                                    const selectedCandidate = candidateOptions.find(
                                      (candidate) => String(candidate.id) === nextProviderId
                                    );
                                    handleMatchDraftChange(key, 'proveedorId', nextProviderId);
                                    if (selectedCandidate) {
                                      const candidateHasPatente =
                                        typeof selectedCandidate.patente === 'string' && selectedCandidate.patente.trim() !== '';
                                      handleMatchDraftChange(key, 'actualizarPatente', !candidateHasPatente);
                                    }
                                  }}
                                >
                                  <option value="">Seleccionar candidato</option>
                                  {candidateOptions.map((candidate) => (
                                    <option value={String(candidate.id)} key={`candidate-card-option-${key}-${candidate.id}`}>
                                      {`#${candidate.id} - ${candidate.nombre}${candidate.cuil ? ` - ${candidate.cuil}` : ''}`}
                                    </option>
                                  ))}
                                </select>
                                <label className="pending-match-manual-id">
                                  <span>ID manual</span>
                                  <input
                                    value={draft.proveedorId}
                                    onChange={(event) =>
                                      handleMatchDraftChange(
                                        key,
                                        'proveedorId',
                                        event.target.value.replace(/[^\d]/g, '')
                                      )
                                    }
                                    placeholder="Ej: 389"
                                    inputMode="numeric"
                                    className="pending-match-provider-manual-input"
                                  />
                                </label>
                                {draft.searchError ? (
                                  <span className="form-info form-info--error pending-match-inline-error">
                                    {draft.searchError}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="pending-match-card__actions">
                              <label className="checkbox-control">
                                <input
                                  type="checkbox"
                                  checked={draft.actualizarPatente}
                                  onChange={(event) => handleMatchDraftChange(key, 'actualizarPatente', event.target.checked)}
                                />
                                <span>Actualizar patente</span>
                              </label>
                              <label className="checkbox-control">
                                <input
                                  type="checkbox"
                                  checked={draft.sobreescribirPatente}
                                  onChange={(event) => handleMatchDraftChange(key, 'sobreescribirPatente', event.target.checked)}
                                  disabled={!draft.actualizarPatente}
                                />
                                <span>Sobrescribir patente</span>
                              </label>
                              <input
                                value={draft.motivo}
                                onChange={(event) => handleMatchDraftChange(key, 'motivo', event.target.value)}
                                placeholder="Motivo (si sobreescribe)"
                              />
                              <button
                                type="button"
                                className="primary-action pending-match-assign-btn"
                                onClick={() => handleAssignProvider(item)}
                                disabled={draft.saving || !canEditSelectedRun}
                              >
                                {draft.saving ? 'Asignando...' : 'Asignar'}
                              </button>
                            </div>
                            {draft.error ? (
                              <p className="form-info form-info--error pending-match-inline-error">{draft.error}</p>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  </>
                )}
              </section>

              <div className="table-wrapper" style={{ marginTop: 8 }}>
                <table>
                  <thead>
                    <tr>
                      <th>ID dist.</th>
                      <th>Patente</th>
                      <th>Categoría</th>
                      <th>Subtotal calc.</th>
                      <th>Subtotal final</th>
                      <th>Gastos admin final</th>
                      <th>Total final</th>
                      <th>Overrides</th>
                      <th>Alertas</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewDistribuidores.length === 0 ? (
                      <tr>
                        <td colSpan={10}>No hay distribuidores para este run.</td>
                      </tr>
                    ) : (
                      previewDistribuidores.map((dist) => (
                        <tr
                          key={`dist-${dist.liquidacion_distribuidor_id}`}
                          style={{
                            backgroundColor:
                              selectedDistribuidorId === Number(dist.liquidacion_distribuidor_id)
                                ? 'rgba(66, 133, 244, 0.08)'
                                : undefined,
                          }}
                        >
                          <td>{dist.liquidacion_distribuidor_id}</td>
                          <td>{dist.patente ?? '—'}</td>
                          <td>{dist.categoria ?? '—'}</td>
                          <td>{formatCurrency(Number(dist.subtotal_calculado) || 0)}</td>
                          <td>{formatCurrency(Number(dist.subtotal_final) || 0)}</td>
                          <td>{formatCurrency(Number(dist.gastos_admin_final) || 0)}</td>
                          <td>{formatCurrency(Number(dist.total_final) || 0)}</td>
                          <td>{dist.tiene_overrides ? 'Sí' : 'No'}</td>
                          <td>{Array.isArray(dist.alertas) ? dist.alertas.length : 0}</td>
                          <td>
                            <button
                              type="button"
                              className="secondary-action"
                              onClick={() => setSelectedDistribuidorId(Number(dist.liquidacion_distribuidor_id))}
                            >
                              Ver detalle
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {selectedDistribuidorId == null ? (
                <p className="helper-text" style={{ marginTop: 8 }}>
                  Seleccioná un distribuidor para editar detalle.
                </p>
              ) : distribuidorDetailLoading ? (
                <p className="helper-text" style={{ marginTop: 8 }}>
                  Cargando detalle del distribuidor...
                </p>
              ) : distribuidorDetailError ? (
                <p className="form-info form-info--error" style={{ marginTop: 8 }}>
                  {distribuidorDetailError}
                </p>
              ) : selectedDistribuidorDetail ? (
                <div style={{ marginTop: 12 }}>
                  <div className="summary-cards">
                    <div className="summary-card">
                      <span className="summary-card__label">Distribuidor</span>
                      <strong className="summary-card__value">#{selectedDistribuidorDetail.liquidacion_distribuidor_id}</strong>
                    </div>
                    <div className="summary-card">
                      <span className="summary-card__label">Patente</span>
                      <strong className="summary-card__value">{selectedDistribuidorDetail.patente ?? '—'}</strong>
                    </div>
                    <div className="summary-card">
                      <span className="summary-card__label">Gasto admin default</span>
                      <strong className="summary-card__value">{formatCurrency(selectedDistribuidorDetail.gastos_admin_default ?? 0)}</strong>
                    </div>
                    <div className="summary-card">
                      <span className="summary-card__label">Líneas</span>
                      <strong className="summary-card__value">{selectedDistribuidorDetail.lineas?.length ?? 0}</strong>
                    </div>
                  </div>

                  <div className="form-grid" style={{ marginTop: 8 }}>
                    <label className="input-control">
                      <span>Gastos admin override</span>
                      <input
                        value={distribuidorDraft.gastosAdminOverride}
                        onChange={(event) =>
                          setDistribuidorDraft((current) => ({
                            ...current,
                            gastosAdminOverride: event.target.value,
                          }))
                        }
                        placeholder="Vacío = usa default"
                      />
                    </label>
                    <label className="input-control">
                      <span>Ajuste manual</span>
                      <input
                        value={distribuidorDraft.ajusteManual}
                        onChange={(event) =>
                          setDistribuidorDraft((current) => ({
                            ...current,
                            ajusteManual: event.target.value,
                          }))
                        }
                        placeholder="0"
                      />
                    </label>
                    <label className="input-control">
                      <span>Motivo (obligatorio)</span>
                      <input
                        value={distribuidorDraft.motivo}
                        onChange={(event) =>
                          setDistribuidorDraft((current) => ({
                            ...current,
                            motivo: event.target.value,
                          }))
                        }
                        placeholder="Ej: Bonificación de gastos"
                      />
                    </label>
                  </div>

                  <div className="filters-actions">
                    <button
                      type="button"
                      className="primary-action"
                      onClick={handleSaveDistribuidor}
                      disabled={distribuidorDraft.saving || !canEditSelectedRun}
                    >
                      {distribuidorDraft.saving ? 'Guardando...' : 'Guardar gastos admin'}
                    </button>
                    {!canEditSelectedRun ? (
                      <span className="helper-text">Edición bloqueada: el run no está en PRELIQUIDACION.</span>
                    ) : null}
                  </div>

                  <div className="table-wrapper" style={{ marginTop: 8 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Línea</th>
                          <th>Fecha</th>
                          <th>Ruta</th>
                          <th>SVC</th>
                          <th>Turno</th>
                          <th>Factor</th>
                          <th>Tarifa calc.</th>
                          <th>Plus calc.</th>
                          <th>Importe calc.</th>
                          <th>Importe override</th>
                          <th>Plus override</th>
                          <th>Tarifa override</th>
                          <th>Motivo</th>
                          <th>Importe final</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDistribuidorDetail.lineas?.length ? (
                          selectedDistribuidorDetail.lineas.map((linea) => {
                            const draft = lineaDrafts[linea.linea_id] ?? {
                              importeOverride: linea.importe_override == null ? '' : toNumberString(linea.importe_override),
                              plusOverride: '',
                              tarifaOverride: '',
                              motivo: '',
                              saving: false,
                              error: null,
                            };
                            return (
                              <React.Fragment key={`linea-${linea.linea_id}`}>
                                <tr>
                                  <td>{linea.linea_id}</td>
                                  <td>{linea.fecha ?? '—'}</td>
                                  <td>{linea.id_ruta ?? '—'}</td>
                                  <td>{linea.svc ?? '—'}</td>
                                  <td>{linea.turno_norm ?? '—'}</td>
                                  <td>{linea.factor_jornada ?? 1}</td>
                                  <td>{formatCurrency(linea.tarifa_dist_calculada ?? 0)}</td>
                                  <td>{formatCurrency(linea.plus_calculado ?? 0)}</td>
                                  <td>{formatCurrency(linea.importe_calculado ?? 0)}</td>
                                  <td>
                                    <input
                                      value={draft.importeOverride}
                                      onChange={(event) => handleLineaDraftChange(linea.linea_id, 'importeOverride', event.target.value)}
                                      placeholder="Vacío = calculado"
                                    />
                                  </td>
                                  <td>
                                    <input
                                      value={draft.plusOverride}
                                      onChange={(event) => handleLineaDraftChange(linea.linea_id, 'plusOverride', event.target.value)}
                                      placeholder="Opcional"
                                    />
                                  </td>
                                  <td>
                                    <input
                                      value={draft.tarifaOverride}
                                      onChange={(event) => handleLineaDraftChange(linea.linea_id, 'tarifaOverride', event.target.value)}
                                      placeholder="Opcional"
                                    />
                                  </td>
                                  <td>
                                    <input
                                      value={draft.motivo}
                                      onChange={(event) => handleLineaDraftChange(linea.linea_id, 'motivo', event.target.value)}
                                      placeholder="Motivo obligatorio"
                                    />
                                  </td>
                                  <td>{formatCurrency(linea.importe_final ?? 0)}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="secondary-action"
                                      onClick={() => handleSaveLinea(linea.linea_id)}
                                      disabled={draft.saving || !canEditSelectedRun}
                                    >
                                      {draft.saving ? 'Guardando...' : 'Guardar'}
                                    </button>
                                  </td>
                                </tr>
                                {draft.error ? (
                                  <tr>
                                    <td colSpan={15} className="form-info form-info--error">
                                      {draft.error}
                                    </td>
                                  </tr>
                                ) : null}
                              </React.Fragment>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={15}>Sin líneas para mostrar.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {detalleActionMessage ? <p className="form-info form-info--success">{detalleActionMessage}</p> : null}
              {detalleActionError ? <p className="form-info form-info--error">{detalleActionError}</p> : null}
            </>
          )}
        </div>
      </section>

      <section className="dashboard-card">
        <header className="card-header">
          <h3>Detalle del run</h3>
        </header>
        <div className="card-body">
          {selectedRunId == null ? (
            <p className="helper-text">Seleccioná un run para ver detalle y operar aprobación/publicación.</p>
          ) : loadingDetail ? (
            <p className="helper-text">Cargando detalle...</p>
          ) : detailError ? (
            <p className="form-info form-info--error">{detailError}</p>
          ) : selectedRun ? (
            <>
              <div className="summary-cards">
                <div className="summary-card">
                  <span className="summary-card__label">Run</span>
                  <strong className="summary-card__value">#{selectedRun.id}</strong>
                </div>
                <div className="summary-card">
                  <span className="summary-card__label">Estado</span>
                  <strong className="summary-card__value">{selectedRun.status ?? '—'}</strong>
                </div>
                <div className="summary-card">
                  <span className="summary-card__label">Aprobado</span>
                  <strong className="summary-card__value">{formatDateCell(selectedRun.approvedAt)}</strong>
                </div>
                <div className="summary-card">
                  <span className="summary-card__label">Publicado</span>
                  <strong className="summary-card__value">{formatDateCell(selectedRun.publishedAt)}</strong>
                </div>
              </div>

              <div className="summary-cards">
                <div className="summary-card">
                  <span className="summary-card__label">Staging rows</span>
                  <strong className="summary-card__value">{runSummary?.staging_rows_count ?? 0}</strong>
                </div>
                <div className="summary-card">
                  <span className="summary-card__label">Validaciones</span>
                  <strong className="summary-card__value">{runSummary?.validation_results_count ?? 0}</strong>
                </div>
                <div className="summary-card">
                  <span className="summary-card__label">Observaciones</span>
                  <strong className="summary-card__value">{runSummary?.observations_count ?? 0}</strong>
                </div>
                <div className="summary-card">
                  <span className="summary-card__label">Publicaciones</span>
                  <strong className="summary-card__value">{runSummary?.publish_jobs_count ?? 0}</strong>
                </div>
              </div>

              <div className="form-grid">
                <label className="input-control">
                  <span>Nota de aprobación</span>
                  <input
                    value={approveNote}
                    onChange={(event) => setApproveNote(event.target.value)}
                    placeholder="Opcional"
                  />
                </label>
                <label className="input-control">
                  <span>Filtro distribuidor</span>
                  <input
                    value={publishDistributorCode}
                    onChange={(event) => setPublishDistributorCode(event.target.value)}
                    placeholder="Solo un distribuidor"
                  />
                </label>
                <label className="input-control">
                  <span>Liquidación ID (ERP ref)</span>
                  <input
                    value={publishLiquidacionId}
                    onChange={(event) => setPublishLiquidacionId(event.target.value)}
                    placeholder="Opcional"
                  />
                </label>
              </div>

              <div className="filters-actions">
                <label className="checkbox-control">
                  <input
                    type="checkbox"
                    checked={approveForce}
                    onChange={(event) => setApproveForce(event.target.checked)}
                  />
                  <span>Force aprobación</span>
                </label>
                <button type="button" className="primary-action" onClick={handleApproveRun} disabled={approveLoading}>
                  {approveLoading ? 'Aprobando...' : 'Aprobar run'}
                </button>
              </div>

              <div className="filters-actions">
                <label className="checkbox-control">
                  <input
                    type="checkbox"
                    checked={publishForce}
                    onChange={(event) => setPublishForce(event.target.checked)}
                  />
                  <span>Force publicación</span>
                </label>
                <button
                  type="button"
                  className="secondary-action secondary-action--ghost"
                  onClick={() => handlePublishRun(true)}
                  disabled={publishLoading}
                >
                  {publishLoading ? 'Procesando...' : 'Dry run ERP'}
                </button>
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => handlePublishRun(false)}
                  disabled={publishLoading}
                >
                  {publishLoading ? 'Publicando...' : 'Publicar ERP'}
                </button>
              </div>

              <div className="filters-actions">
                <button
                  type="button"
                  className="primary-action"
                  onClick={handleSyncRunToPersonal}
                  disabled={syncPersonalLoading}
                >
                  {syncPersonalLoading ? 'Sincronizando...' : 'Sincronizar a Liquidaciones'}
                </button>
              </div>

              <div className="helper-text">
                Último job ERP:{' '}
                {latestPublishJob
                  ? `#${latestPublishJob.id} · ${latestPublishJob.status} · ${formatDateCell(latestPublishJob.sentAt ?? null)}`
                  : 'sin publicaciones todavía'}
              </div>

              {actionMessage ? <p className="form-info form-info--success">{actionMessage}</p> : null}
              {actionError ? <p className="form-info form-info--error">{actionError}</p> : null}
            </>
          ) : (
            <p className="helper-text">No se pudo resolver el detalle del run seleccionado.</p>
          )}
        </div>
      </section>
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
    logo_url: '',
  });
  const [sucursales, setSucursales] = useState<EditableSucursal[]>([]);
  const [newSucursalNombre, setNewSucursalNombre] = useState('');
  const [newSucursalDireccion, setNewSucursalDireccion] = useState('');
  const [newSucursalEncargado, setNewSucursalEncargado] = useState('');
  const [sucursalFormError, setSucursalFormError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAddSucursal = () => {
    const nombre = newSucursalNombre.trim();
    const direccion = newSucursalDireccion.trim();
    const encargado = newSucursalEncargado.trim();

    if (!nombre && !direccion && !encargado) {
      setSucursalFormError('Ingresa al menos el nombre, la dirección o el encargado para agregar una sucursal.');
      return;
    }

    setSucursales((prev) => [
      ...prev,
      {
        id: null,
        nombre,
        direccion,
        encargado_deposito: encargado,
        key: `new-${uniqueKey()}`,
      },
    ]);

    setNewSucursalNombre('');
    setNewSucursalDireccion('');
    setNewSucursalEncargado('');
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
          logo_url: formValues.logo_url.trim() || null,
          sucursales: sucursales.map((sucursal) => ({
            nombre: sucursal.nombre.trim() || null,
            direccion: sucursal.direccion.trim() || null,
            encargado_deposito: sucursal.encargado_deposito?.trim() || null,
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
        logo_url: payload.data.logo_url ?? '',
      });

      setSucursales(
        (payload.data.sucursales ?? []).map<EditableSucursal>((sucursal) => ({
          id: sucursal.id ?? null,
          nombre: sucursal.nombre ?? '',
          direccion: sucursal.direccion ?? '',
          encargado_deposito: sucursal.encargado_deposito ?? '',
          key: sucursal.id ? `existing-${sucursal.id}` : `new-${uniqueKey()}`,
        }))
      );
      setNewSucursalNombre('');
      setNewSucursalDireccion('');
      setNewSucursalEncargado('');
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
            <span>CUIT</span>
            <input
              type="text"
              value={formValues.documento_fiscal}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, documento_fiscal: event.target.value }))
              }
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control" style={{ gridColumn: 'span 2' }}>
            <span>Logo (URL)</span>
            <input
              type="text"
              value={formValues.logo_url}
              onChange={(event) => setFormValues((prev) => ({ ...prev, logo_url: event.target.value }))}
              placeholder="https://... o /logos/cliente.png"
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
          <label className="input-control">
            <span>Encargado del depósito</span>
            <input
              type="text"
              value={newSucursalEncargado}
              onChange={(event) => setNewSucursalEncargado(event.target.value)}
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
            if (sucursal.encargado_deposito) {
              labelParts.push(`Encargado: ${sucursal.encargado_deposito}`);
            }
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
  const authUser = useStoredAuthUser();
  const actorHeaders = useMemo(() => buildActorHeaders(authUser), [authUser]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formValues, setFormValues] = useState({
    codigo: '',
    nombre: '',
    direccion: '',
    documento_fiscal: '',
    logo_url: '',
  });
  const [sucursales, setSucursales] = useState<EditableSucursal[]>([]);
  const [newSucursalNombre, setNewSucursalNombre] = useState('');
  const [newSucursalDireccion, setNewSucursalDireccion] = useState('');
  const [newSucursalEncargado, setNewSucursalEncargado] = useState('');
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
    const encargado = newSucursalEncargado.trim();

    if (!nombre && !direccion && !encargado) {
      setSucursalFormError('Ingresa al menos el nombre, la dirección o el encargado para agregar una sucursal.');
      return;
    }

    setSucursales((prev) => [
      ...prev,
      {
        id: null,
        nombre,
        direccion,
        encargado_deposito: encargado,
        key: `new-${uniqueKey()}`,
      },
    ]);

    setNewSucursalNombre('');
    setNewSucursalDireccion('');
    setNewSucursalEncargado('');
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
          logo_url: formValues.logo_url.trim() || null,
          sucursales: sucursales.map((sucursal) => ({
            id: sucursal.id,
            nombre: sucursal.nombre.trim() || null,
            direccion: sucursal.direccion.trim() || null,
            encargado_deposito: sucursal.encargado_deposito?.trim() || null,
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
            <span>CUIT</span>
            <input
              type="text"
              value={formValues.documento_fiscal}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, documento_fiscal: event.target.value }))
              }
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control" style={{ gridColumn: 'span 2' }}>
            <span>Logo (URL)</span>
            <input
              type="text"
              value={formValues.logo_url}
              onChange={(event) => setFormValues((prev) => ({ ...prev, logo_url: event.target.value }))}
              placeholder="https://... o /logos/cliente.png"
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
          <label className="input-control">
            <span>Encargado del depósito</span>
            <input
              type="text"
              value={newSucursalEncargado}
              onChange={(event) => setNewSucursalEncargado(event.target.value)}
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
            if (sucursal.encargado_deposito) {
              labelParts.push(`Encargado: ${sucursal.encargado_deposito}`);
            }
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
      <TaxProfileSection
        entityType="cliente"
        entityId={clienteId ? Number(clienteId) : null}
        apiBaseUrl={apiBaseUrl}
        actorHeaders={actorHeaders}
        title="Legajo impositivo"
        subtitle="Base mínima para CUIT, estados impositivos, exclusiones, exenciones y snapshots de Nosis."
      />
    </DashboardLayout>
  );
};

const BaseDistribucionDetailPage: React.FC = () => {
  const { clienteId } = useParams<{ clienteId: string }>();
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [sucursales, setSucursales] = useState<EditableSucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        if (!payload?.data) {
          throw new Error('Formato de respuesta inesperado');
        }

        const normalized = adaptCliente(payload.data);
        setCliente(payload.data);
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
  }, [apiBaseUrl, clienteId]);

  const handleEncargadoChange = (key: string, value: string) => {
    setSucursales((prev) =>
      prev.map((sucursal) =>
        sucursal.key === key ? { ...sucursal, encargado_deposito: value } : sucursal
      )
    );
  };

  const handleSave = async () => {
    if (!clienteId || !cliente) {
      setSubmitError('Identificador de cliente inválido.');
      return;
    }

    try {
      setSaving(true);
      setSubmitError(null);
      setSuccessMessage(null);

      const response = await fetch(`${apiBaseUrl}/api/clientes/${clienteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: cliente.codigo ?? null,
          nombre: cliente.nombre ?? null,
          direccion: cliente.direccion ?? null,
          documento_fiscal: cliente.documento_fiscal ?? null,
          logo_url: cliente.logo_url ?? null,
          sucursales: sucursales.map((sucursal) => ({
            id: sucursal.id,
            nombre: sucursal.nombre.trim() || null,
            direccion: sucursal.direccion.trim() || null,
            encargado_deposito: sucursal.encargado_deposito?.trim() || null,
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
      const normalized = adaptCliente(payload.data);
      setCliente(payload.data);
      setSucursales(normalized.sucursales);
      setSuccessMessage(payload.message ?? 'Encargados guardados correctamente.');
    } catch (err) {
      setSubmitError((err as Error).message ?? 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/bases-distribucion')}>
        ← Volver a bases
      </button>
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout title="Bases de distribución" subtitle="Cargando cliente..." headerContent={headerContent}>
        <p className="form-info">Cargando sucursales...</p>
      </DashboardLayout>
    );
  }

  if (loadError) {
    return (
      <DashboardLayout title="Bases de distribución" subtitle="Error" headerContent={headerContent}>
        <p className="form-info form-info--error">{loadError}</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Bases de distribución"
      subtitle={cliente?.nombre ?? `Cliente #${clienteId ?? ''}`}
      headerContent={headerContent}
    >
      <div className="base-detail">
        <div className="base-detail__header">
          <div>
            <h3>{cliente?.nombre ?? `Cliente #${clienteId ?? ''}`}</h3>
            <p>Gestiona encargados de depósito por sucursal.</p>
          </div>
          <button type="button" className="primary-action" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>

        {sucursales.length === 0 ? <p className="form-info">No hay sucursales registradas.</p> : null}
        {sucursales.length > 0 ? (
          <div className="base-sucursal-list">
            {sucursales.map((sucursal) => (
              <div key={sucursal.key} className="base-sucursal-card">
                <div className="base-sucursal-card__info">
                  <h4>{sucursal.nombre || 'Sucursal'}</h4>
                </div>
                <label className="input-control">
                  <span>Dirección</span>
                  <input
                    type="text"
                    value={sucursal.direccion ?? ''}
                    onChange={(event) =>
                      setSucursales((prev) =>
                        prev.map((item) =>
                          item.key === sucursal.key ? { ...item, direccion: event.target.value } : item
                        )
                      )
                    }
                    placeholder="Ingresar"
                  />
                </label>
                <label className="input-control">
                  <span>Encargado del depósito</span>
                  <input
                    type="text"
                    value={sucursal.encargado_deposito ?? ''}
                    onChange={(event) => handleEncargadoChange(sucursal.key, event.target.value)}
                    placeholder="Ingresar"
                  />
                </label>
              </div>
            ))}
          </div>
        ) : null}

        {submitError ? <p className="form-info form-info--error">{submitError}</p> : null}
        {successMessage ? <p className="form-info form-info--success">{successMessage}</p> : null}
      </div>
    </DashboardLayout>
  );
};

const ActivosAsesoresPage: React.FC = () => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const authUser = useStoredAuthUser();
  const canEditComentarios = useMemo(() => {
    const allowed = ['luis', 'david', 'joel', 'dario', 'luciano'];
    const normalize = (value: string | null | undefined) =>
      (value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const firstName = normalize(authUser?.name).split(/\s+/).filter(Boolean)[0] ?? '';
    if (firstName && allowed.includes(firstName)) {
      return true;
    }

    const emailName = normalize(authUser?.email).split('@')[0] ?? '';
    return emailName && allowed.includes(emailName);
  }, [authUser?.email, authUser?.name]);
  const [records, setRecords] = useState<ActivoAsesorComercialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ActivoAsesorComercialRecord | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
	  const [formValues, setFormValues] = useState({
	    encargado: '',
	    lider: '',
	    asesorComercial: '',
	    rol: '',
	    modalidadTrabajo: 'Presencial',
	    transportistaActivo: '',
	    numero: '',
	    comentarios: '',
	    cliente: '',
	    asesorPostventa: '',
	    sucursal: '',
	    vehiculo: '',
	  });
	  const FILTER_CONFIG = [
	    { key: 'encargado', label: 'Encargado', getValue: (record: ActivoAsesorComercialRecord) => record.encargado },
	    { key: 'lider', label: 'Líder', getValue: (record: ActivoAsesorComercialRecord) => record.lider },
	    {
	      key: 'asesorComercial',
	      label: 'Asesor comercial',
	      getValue: (record: ActivoAsesorComercialRecord) => record.asesorComercial,
	    },
	    { key: 'rol', label: 'Rol', getValue: (record: ActivoAsesorComercialRecord) => record.rol },
	    {
	      key: 'modalidadTrabajo',
	      label: 'Modalidad de trabajo',
	      getValue: (record: ActivoAsesorComercialRecord) => record.modalidadTrabajo ?? null,
	    },
	    {
	      key: 'transportistaActivo',
	      label: 'Transportista (Activo)',
	      getValue: (record: ActivoAsesorComercialRecord) => record.transportistaActivo,
	    },
	    { key: 'numero', label: 'Número', getValue: (record: ActivoAsesorComercialRecord) => record.numero },
	    {
	      key: 'comentarios',
	      label: 'Comentarios',
	      getValue: (record: ActivoAsesorComercialRecord) => record.comentarios ?? null,
	    },
	    { key: 'cliente', label: 'Cliente', getValue: (record: ActivoAsesorComercialRecord) => record.cliente ?? null },
	    {
	      key: 'asesorPostventa',
	      label: 'Asesor de Postventa',
	      getValue: (record: ActivoAsesorComercialRecord) => record.asesorPostventa ?? null,
	    },
	    { key: 'sucursal', label: 'Sucursal', getValue: (record: ActivoAsesorComercialRecord) => record.sucursal ?? null },
	    { key: 'vehiculo', label: 'Vehículo', getValue: (record: ActivoAsesorComercialRecord) => record.vehiculo ?? null },
	  ] as const;

	  type FilterKey = (typeof FILTER_CONFIG)[number]['key'];
	  type FiltersState = Record<FilterKey, string[]>;

	  const buildEmptyFilters = (): FiltersState => ({
	    encargado: [],
	    lider: [],
	    asesorComercial: [],
	    rol: [],
	    modalidadTrabajo: [],
	    transportistaActivo: [],
	    numero: [],
	    comentarios: [],
	    cliente: [],
	    asesorPostventa: [],
	    sucursal: [],
	    vehiculo: [],
	  });

	  const [filters, setFilters] = useState<FiltersState>(() => buildEmptyFilters());
	  const [activeFilterKey, setActiveFilterKey] = useState<FilterKey | null>(null);
	  const [filterQuery, setFilterQuery] = useState('');

	  const normalizeText = (value: string | null | undefined): string =>
	    (value ?? '')
	      .trim()
	      .toLowerCase()
	      .normalize('NFD')
	      .replace(/[\u0300-\u036f]/g, '');

	  const openFilter = (key: FilterKey) => {
	    setActiveFilterKey(key);
	    setFilterQuery('');
	  };

	  const closeFilter = () => {
	    setActiveFilterKey(null);
	    setFilterQuery('');
	  };

	  const toggleFilterOption = (key: FilterKey, option: string) => {
	    setFilters((prev) => {
	      const current = prev[key] ?? [];
	      const exists = current.includes(option);
	      const next = exists ? current.filter((value) => value !== option) : [...current, option];
	      return { ...prev, [key]: next };
	    });
	  };

	  const clearFilterColumn = (key: FilterKey) => {
	    setFilters((prev) => ({ ...prev, [key]: [] }));
	  };

	  const clearAllFilters = () => {
	    setFilters(buildEmptyFilters());
	  };

	  const filteredRecords = useMemo(() => {
	    const matches = (value: string | null | undefined, selected: string[]) => {
	      if (!Array.isArray(selected) || selected.length === 0) {
	        return true;
	      }

	      const normalizedValue = normalizeText(value);
	      return selected.some((item) => normalizeText(item) === normalizedValue);
	    };

	    return records.filter((record) => {
	      if (!matches(record.encargado, filters.encargado)) return false;
	      if (!matches(record.lider, filters.lider)) return false;
	      if (!matches(record.asesorComercial, filters.asesorComercial)) return false;
	      if (!matches(record.rol, filters.rol)) return false;
	      if (!matches(record.modalidadTrabajo ?? null, filters.modalidadTrabajo)) return false;
	      if (!matches(record.transportistaActivo, filters.transportistaActivo)) return false;
	      if (!matches(record.numero, filters.numero)) return false;
	      if (!matches(record.comentarios ?? null, filters.comentarios)) return false;
	      if (!matches(record.cliente ?? null, filters.cliente)) return false;
	      if (!matches(record.asesorPostventa ?? null, filters.asesorPostventa)) return false;
	      if (!matches(record.sucursal ?? null, filters.sucursal)) return false;
	      if (!matches(record.vehiculo ?? null, filters.vehiculo)) return false;
	      return true;
	    });
	  }, [filters, records]);

	  const asesorSummary = useMemo(() => {
    type BaseItem = { asesor: string; qActivo: number };
    type Item = BaseItem & { cuartil: 'Q1' | 'Q2' | 'Q3' | 'Q4' };

    const byAsesor = new Map<string, BaseItem>();

    filteredRecords.forEach((record) => {
      const asesor = (record.asesorComercial ?? '').trim() || 'Sin asesor';
      const current = byAsesor.get(asesor) ?? { asesor, qActivo: 0 };
      byAsesor.set(asesor, { ...current, qActivo: current.qActivo + 1 });
    });

    const items = Array.from(byAsesor.values()).sort(
      (a, b) => b.qActivo - a.qActivo || a.asesor.localeCompare(b.asesor, 'es', { sensitivity: 'base' })
    );

    const total = items.length;
    const withCuartil: Item[] = items.map((item, index) => {
      const quartile = total === 0 ? 4 : Math.floor((index * 4) / total) + 1;
      const cuartil = `Q${Math.min(4, Math.max(1, quartile))}` as 'Q1' | 'Q2' | 'Q3' | 'Q4';
      return { ...item, cuartil };
    });

    const totals = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    withCuartil.forEach((item) => {
      totals[item.cuartil] += item.qActivo;
    });

	    return { items: withCuartil, totals };
	  }, [filteredRecords]);

	  const filterOptions = useMemo(() => {
	    const sets = FILTER_CONFIG.reduce((acc, item) => {
	      acc[item.key] = new Set<string>();
	      return acc;
	    }, {} as Record<FilterKey, Set<string>>);

	    records.forEach((record) => {
	      FILTER_CONFIG.forEach((item) => {
	        const raw = item.getValue(record);
	        const value = (raw ?? '').toString().trim();
	        if (value) {
	          sets[item.key].add(value);
	        }
	      });
	    });

	    return FILTER_CONFIG.reduce((acc, item) => {
	      acc[item.key] = Array.from(sets[item.key]).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
	      return acc;
	    }, {} as Record<FilterKey, string[]>);
	  }, [records]);

	  const renderFilterCell = (key: FilterKey) => {
	    const selected = filters[key] ?? [];
	    if (selected.length === 0) {
	      return (
	        <button type="button" className="bdd-activos-filter-placeholder" onClick={() => openFilter(key)}>
	          Seleccionar
	        </button>
	      );
	    }

	    return (
	      <div className="bdd-activos-table__selected-filters">
	        {selected.map((value) => (
	          <button
	            key={value}
	            type="button"
	            className="bdd-activos-filter-chip"
	            onClick={() => toggleFilterOption(key, value)}
	            title="Quitar"
	          >
	            {value} <span aria-hidden="true">×</span>
	          </button>
	        ))}
	        <button type="button" className="bdd-activos-filter-add" onClick={() => openFilter(key)} aria-label="Agregar filtro">
	          +
	        </button>
	      </div>
	    );
	  };

	  const activeFilterConfig = activeFilterKey ? FILTER_CONFIG.find((item) => item.key === activeFilterKey) ?? null : null;
	  const activeFilterOptions = activeFilterKey ? filterOptions[activeFilterKey] ?? [] : [];
	  const activeFilterSelected = activeFilterKey ? filters[activeFilterKey] ?? [] : [];
	  const activeFilterVisibleOptions = activeFilterOptions.filter((option) =>
	    normalizeText(option).includes(normalizeText(filterQuery))
	  );

	  const selectAllFilterColumn = (key: FilterKey) => {
	    setFilters((prev) => ({ ...prev, [key]: filterOptions[key] ?? [] }));
	  };

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);

      const response = await fetch(`${apiBaseUrl}/api/bdd-activos-asesores`);
      const payload = (await parseJsonSafe(response).catch(() => null)) as {
        data?: ActivoAsesorComercialRecord[];
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo cargar la base de activos.');
      }

      const payloadData = payload?.data;
      const loadedRecords = Array.isArray(payloadData) ? payloadData : [];
      setRecords(loadedRecords);
    } catch (err) {
      setLoadError((err as Error).message ?? 'No se pudo cargar la base de activos.');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const resetForm = useCallback(() => {
    setEditingRecord(null);
    setModalError(null);
    setFormValues({
      encargado: '',
      lider: '',
      asesorComercial: '',
      rol: '',
      modalidadTrabajo: 'Presencial',
      transportistaActivo: '',
      numero: '',
      comentarios: '',
      cliente: '',
      asesorPostventa: '',
      sucursal: '',
      vehiculo: '',
    });
  }, []);

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (record: ActivoAsesorComercialRecord) => {
    setEditingRecord(record);
    setModalError(null);
    setFormValues({
      encargado: record.encargado ?? '',
      lider: record.lider ?? '',
      asesorComercial: record.asesorComercial ?? '',
      rol: record.rol ?? '',
      modalidadTrabajo: record.modalidadTrabajo ?? 'Presencial',
      transportistaActivo: record.transportistaActivo ?? '',
      numero: record.numero ?? '',
      comentarios: record.comentarios ?? '',
      cliente: record.cliente ?? '',
      asesorPostventa: record.asesorPostventa ?? '',
      sucursal: record.sucursal ?? '',
      vehiculo: record.vehiculo ?? '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payloadBody = {
      encargado: formValues.encargado.trim() || null,
      lider: formValues.lider.trim() || null,
      asesorComercial: formValues.asesorComercial.trim() || null,
      rol: formValues.rol.trim() || null,
      modalidadTrabajo: formValues.modalidadTrabajo.trim() || null,
      transportistaActivo: formValues.transportistaActivo.trim() || null,
      numero: formValues.numero.trim() || null,
      comentarios: canEditComentarios ? formValues.comentarios.trim() || null : null,
      cliente: formValues.cliente.trim() || null,
      asesorPostventa: formValues.asesorPostventa.trim() || null,
      sucursal: formValues.sucursal.trim() || null,
      vehiculo: formValues.vehiculo.trim() || null,
    };

    const hasAnyValue = Object.entries(payloadBody).some(([key, value]) => key !== 'modalidadTrabajo' && value !== null);
    if (!hasAnyValue) {
      setModalError('Ingresá al menos un campo para guardar el registro.');
      return;
    }

    try {
      setSaving(true);
      setModalError(null);
      setActionError(null);
      setActionInfo(null);

      const isEditing = Boolean(editingRecord?.id);
      const url = isEditing
        ? `${apiBaseUrl}/api/bdd-activos-asesores/${editingRecord?.id}`
        : `${apiBaseUrl}/api/bdd-activos-asesores`;
      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadBody),
      });
      const payload = (await parseJsonSafe(response).catch(() => null)) as {
        data?: ActivoAsesorComercialRecord;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo guardar el registro.');
      }

      const savedRecord = payload?.data ?? null;
      if (savedRecord) {
        setRecords((prev) => {
          if (isEditing) {
            return prev.map((item) => (item.id === savedRecord.id ? savedRecord : item));
          }

          return [...prev, savedRecord];
        });
      }

      setActionInfo(payload?.message ?? (isEditing ? 'Activo actualizado correctamente.' : 'Activo agregado correctamente.'));
      closeModal();
    } catch (err) {
      setModalError((err as Error).message ?? 'No se pudo guardar el registro.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: ActivoAsesorComercialRecord) => {
    const label = record.transportistaActivo?.trim() || record.asesorComercial?.trim() || `ID ${record.id}`;
    const confirmed = window.confirm(`¿Seguro que querés eliminar el registro "${label}"?`);
    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(record.id);
      setActionError(null);
      setActionInfo(null);

      const response = await fetch(`${apiBaseUrl}/api/bdd-activos-asesores/${record.id}`, {
        method: 'DELETE',
      });
      const payload = (await parseJsonSafe(response).catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo eliminar el registro.');
      }

      setRecords((prev) => prev.filter((item) => item.id !== record.id));
      setActionInfo(payload?.message ?? 'Activo eliminado correctamente.');
    } catch (err) {
      setActionError((err as Error).message ?? 'No se pudo eliminar el registro.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setActionError('Seleccioná un archivo Excel o CSV para importar.');
      return;
    }

    try {
      setImporting(true);
      setActionError(null);
      setActionInfo(null);

      const formData = new FormData();
      formData.append('file', selectedFile, selectedFile.name);

      const response = await fetch(`${apiBaseUrl}/api/bdd-activos-asesores/import`, {
        method: 'POST',
        body: formData,
      });
      const payload = (await parseJsonSafe(response).catch(() => null)) as {
        data?: ActivoAsesorComercialRecord[];
        message?: string;
        meta?: { imported?: number; fileName?: string | null };
      } | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo importar la base.');
      }

      const payloadData = payload?.data;
      const importedRecords = Array.isArray(payloadData) ? payloadData : [];
      setRecords(importedRecords);
      setSelectedFile(null);
      setActionInfo(
        payload?.message
          ? `${payload.message} ${payload?.meta?.imported ? `Registros importados: ${payload.meta.imported}.` : ''}`.trim()
          : 'Base importada correctamente.'
      );
    } catch (err) {
      setActionError((err as Error).message ?? 'No se pudo importar la base.');
    } finally {
      setImporting(false);
    }
  };

  const headerContent = (
    <div className="card-header">
      <div className="filters-actions" style={{ flex: 1 }}>
        <p className="form-info" style={{ margin: 0 }}>
          Cargá la base desde Excel y gestioná los activos asignados a asesores comerciales.
        </p>
      </div>
      <button type="button" className="primary-action" onClick={openCreateModal}>
        Agregar activo
      </button>
    </div>
  );

  return (
    <DashboardLayout
      title="BDD Activos x Asesores Comerciales"
      subtitle={`Mostrando ${filteredRecords.length} de ${records.length} registros`}
      headerContent={headerContent}
    >
      <section className="personal-edit-section bdd-activos-summary">
        <h2>Resumen (subtotales según filtros)</h2>
        {asesorSummary.items.length === 0 ? (
          <p className="form-info">No hay registros para calcular subtotales.</p>
        ) : (
          <div className="bdd-activos-summary__grid">
	            <div className="bdd-activos-summary__totals">
	              <h3>Totales por cuartil</h3>
	              <table className="bdd-activos-summary__totals-table">
	                <thead>
	                  <tr>
	                    <th>Cuartil</th>
	                    <th>Total</th>
	                  </tr>
	                </thead>
	                <tbody>
	                  <tr>
	                    <td>Q4</td>
	                    <td>{asesorSummary.totals.Q4}</td>
	                  </tr>
	                  <tr>
	                    <td>Q3</td>
	                    <td>{asesorSummary.totals.Q3}</td>
	                  </tr>
	                  <tr>
	                    <td>Q2</td>
	                    <td>{asesorSummary.totals.Q2}</td>
	                  </tr>
	                  <tr>
	                    <td>Q1</td>
	                    <td>{asesorSummary.totals.Q1}</td>
	                  </tr>
	                </tbody>
	              </table>
	            </div>
            <div className="bdd-activos-summary__table">
	              <table className="bdd-activos-summary__detail-table">
	                <thead>
	                  <tr>
	                    <th>Asesor comercial</th>
	                    <th>Q Activo</th>
	                    <th>Cuartil</th>
	                  </tr>
	                </thead>
	                <tbody>
	                  {asesorSummary.items.map((item) => (
	                    <tr key={item.asesor}>
	                      <td>{item.asesor}</td>
	                      <td>{item.qActivo}</td>
	                      <td>{item.cuartil}</td>
	                    </tr>
	                  ))}
	                </tbody>
	              </table>
            </div>
          </div>
        )}
      </section>

      <section className="personal-edit-section">
        <h2>Importar Excel</h2>
        <form className="edit-form" onSubmit={handleImport}>
          <div className="form-grid">
            <label className="input-control">
              <span>Archivo</span>
              <input
                type="file"
                accept=".xlsx,.csv,.txt"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <p className="form-info">La importación reemplaza la base actual y luego la muestra en pantalla.</p>
          <div className="form-actions">
            <button type="submit" className="primary-action" disabled={importing}>
              {importing ? 'Importando...' : 'Subir Excel'}
            </button>
          </div>
        </form>
      </section>

      {actionError ? <p className="form-info form-info--error">{actionError}</p> : null}
      {actionInfo ? <p className="form-info form-info--success">{actionInfo}</p> : null}

      <section className="personal-edit-section">
        <h2>Base cargada</h2>
        {loading ? <p className="form-info">Cargando registros...</p> : null}
        {loadError ? <p className="form-info form-info--error">{loadError}</p> : null}
        {!loading && !loadError ? (
	          <div className="table-wrapper bdd-activos-table-wrapper">
	            <table className="bdd-activos-table">
	              <thead>
	                <tr>
	                  <th>
	                    <span className="bdd-activos-table__header">
	                      Encargado
	                      <button
	                        type="button"
	                        className="bdd-activos-table__filter-button"
	                        aria-label="Filtrar Encargado"
	                        onClick={() => openFilter('encargado')}
	                      >
	                        ⏷
	                      </button>
	                    </span>
	                  </th>
	                  <th>
	                    <span className="bdd-activos-table__header">
	                      Líder
	                      <button
	                        type="button"
	                        className="bdd-activos-table__filter-button"
	                        aria-label="Filtrar Líder"
	                        onClick={() => openFilter('lider')}
	                      >
	                        ⏷
	                      </button>
	                    </span>
	                  </th>
	                  <th>
	                    <span className="bdd-activos-table__header">
	                      Asesor comercial
	                      <button
	                        type="button"
	                        className="bdd-activos-table__filter-button"
	                        aria-label="Filtrar Asesor comercial"
	                        onClick={() => openFilter('asesorComercial')}
	                      >
	                        ⏷
	                      </button>
	                    </span>
	                  </th>
	                  <th>
	                    <span className="bdd-activos-table__header">
	                      Rol
	                      <button
	                        type="button"
	                        className="bdd-activos-table__filter-button"
	                        aria-label="Filtrar Rol"
	                        onClick={() => openFilter('rol')}
	                      >
	                        ⏷
	                      </button>
	                    </span>
	                  </th>
	                  <th>
	                    <span className="bdd-activos-table__header">
	                      Modalidad de trabajo
	                      <button
	                        type="button"
	                        className="bdd-activos-table__filter-button"
	                        aria-label="Filtrar Modalidad de trabajo"
	                        onClick={() => openFilter('modalidadTrabajo')}
	                      >
	                        ⏷
	                      </button>
	                    </span>
	                  </th>
	                  <th>
	                    <span className="bdd-activos-table__header">
	                      Transportista (Activo)
	                      <button
	                        type="button"
	                        className="bdd-activos-table__filter-button"
	                        aria-label="Filtrar Transportista (Activo)"
	                        onClick={() => openFilter('transportistaActivo')}
	                      >
	                        ⏷
	                      </button>
	                    </span>
	                  </th>
	                  <th>
	                    <span className="bdd-activos-table__header">
	                      Número
	                      <button
	                        type="button"
	                        className="bdd-activos-table__filter-button"
	                        aria-label="Filtrar Número"
	                        onClick={() => openFilter('numero')}
	                      >
	                        ⏷
	                      </button>
	                    </span>
	                  </th>
	                  <th>
	                    <span className="bdd-activos-table__header">
	                      Comentarios
	                      <button
	                        type="button"
	                        className="bdd-activos-table__filter-button"
	                        aria-label="Filtrar Comentarios"
	                        onClick={() => openFilter('comentarios')}
	                      >
	                        ⏷
	                      </button>
	                    </span>
	                  </th>
	                  <th>
	                    <span className="bdd-activos-table__header">
	                      Cliente
	                      <button
	                        type="button"
	                        className="bdd-activos-table__filter-button"
	                        aria-label="Filtrar Cliente"
	                        onClick={() => openFilter('cliente')}
	                      >
	                        ⏷
	                      </button>
	                    </span>
	                  </th>
	                  <th>
	                    <span className="bdd-activos-table__header">
	                      Asesor de Postventa
	                      <button
	                        type="button"
	                        className="bdd-activos-table__filter-button"
	                        aria-label="Filtrar Asesor de Postventa"
	                        onClick={() => openFilter('asesorPostventa')}
	                      >
	                        ⏷
	                      </button>
	                    </span>
	                  </th>
	                  <th>
	                    <span className="bdd-activos-table__header">
	                      Sucursal
	                      <button
	                        type="button"
	                        className="bdd-activos-table__filter-button"
	                        aria-label="Filtrar Sucursal"
	                        onClick={() => openFilter('sucursal')}
	                      >
	                        ⏷
	                      </button>
	                    </span>
	                  </th>
	                  <th>
	                    <span className="bdd-activos-table__header">
	                      Vehículo
	                      <button
	                        type="button"
	                        className="bdd-activos-table__filter-button"
	                        aria-label="Filtrar Vehículo"
	                        onClick={() => openFilter('vehiculo')}
	                      >
	                        ⏷
	                      </button>
	                    </span>
	                  </th>
	                  <th>Acciones</th>
	                </tr>
		                <tr className="bdd-activos-table__filters">
		                  <th>{renderFilterCell('encargado')}</th>
		                  <th>{renderFilterCell('lider')}</th>
		                  <th>{renderFilterCell('asesorComercial')}</th>
		                  <th>{renderFilterCell('rol')}</th>
		                  <th>{renderFilterCell('modalidadTrabajo')}</th>
		                  <th>{renderFilterCell('transportistaActivo')}</th>
		                  <th>{renderFilterCell('numero')}</th>
		                  <th>{renderFilterCell('comentarios')}</th>
		                  <th>{renderFilterCell('cliente')}</th>
		                  <th>{renderFilterCell('asesorPostventa')}</th>
		                  <th>{renderFilterCell('sucursal')}</th>
		                  <th>{renderFilterCell('vehiculo')}</th>
		                  <th className="bdd-activos-table__filter-actions">
		                    <button
		                      type="button"
		                      className="secondary-action secondary-action--ghost bdd-activos-table__clear"
		                      onClick={clearAllFilters}
		                    >
		                      Limpiar
		                    </button>
		                  </th>
		                </tr>
              </thead>
	              <tbody>
	                {filteredRecords.length === 0 ? (
	                  <tr>
	                    <td colSpan={13}>
	                      {records.length === 0 ? 'No hay registros cargados.' : 'No hay resultados para los filtros actuales.'}
	                    </td>
	                  </tr>
	                ) : (
	                  filteredRecords.map((record) => (
	                    <tr key={record.id}>
	                      <td>{record.encargado ?? '—'}</td>
	                      <td>{record.lider ?? '—'}</td>
	                      <td>{record.asesorComercial ?? '—'}</td>
	                      <td>{record.rol ?? '—'}</td>
	                      <td>{record.modalidadTrabajo ?? '—'}</td>
	                      <td>{record.transportistaActivo ?? '—'}</td>
	                      <td>{record.numero ?? '—'}</td>
	                      <td>{record.comentarios ?? '—'}</td>
	                      <td>{record.cliente ?? '—'}</td>
	                      <td>{record.asesorPostventa ?? '—'}</td>
	                      <td>{record.sucursal ?? '—'}</td>
	                      <td>{record.vehiculo ?? '—'}</td>
	                      <td>
	                        <div className="action-buttons">
	                          <button type="button" aria-label="Editar registro" onClick={() => openEditModal(record)}>
	                            ✏️
	                          </button>
                          <button
                            type="button"
                            aria-label="Eliminar registro"
                            onClick={() => handleDelete(record)}
                            disabled={deletingId === record.id}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
	      </section>

	      {activeFilterKey ? (
	        <div className="permissions-modal" role="dialog" aria-modal="true">
	          <div className="permissions-modal__backdrop" onClick={closeFilter} />
	          <div className="permissions-modal__content">
	            <div className="permissions-modal__header">
	              <div>
	                <h3>Filtrar {activeFilterConfig?.label ?? 'columna'}</h3>
	                <p>Seleccioná uno o más valores (se pueden combinar varios filtros).</p>
	              </div>
	              <button type="button" onClick={closeFilter} aria-label="Cerrar">
	                ×
	              </button>
	            </div>
	            <div style={{ padding: '1rem' }}>
	              <label className="input-control">
	                <span>Buscar</span>
	                <input
	                  type="search"
	                  value={filterQuery}
	                  onChange={(event) => setFilterQuery(event.target.value)}
	                  placeholder="Buscar valores"
	                />
	              </label>

	              <div className="bdd-activos-filter-options">
	                {activeFilterVisibleOptions.length === 0 ? (
	                  <p className="form-info">No hay opciones para mostrar.</p>
	                ) : (
	                  activeFilterVisibleOptions.map((option) => {
	                    const selected = activeFilterSelected.includes(option);
	                    return (
	                      <button
	                        key={option}
	                        type="button"
	                        className={`bdd-activos-filter-option${selected ? ' is-selected' : ''}`}
	                        onClick={() => toggleFilterOption(activeFilterKey, option)}
	                      >
	                        {selected ? '✓ ' : ''}
	                        {option}
	                      </button>
	                    );
	                  })
	                )}
	              </div>

	              <div className="form-actions">
	                <button type="button" className="secondary-action" onClick={() => clearFilterColumn(activeFilterKey)}>
	                  Limpiar columna
	                </button>
	                <button type="button" className="secondary-action" onClick={() => selectAllFilterColumn(activeFilterKey)}>
	                  Seleccionar todo
	                </button>
	                <button type="button" className="primary-action" onClick={closeFilter}>
	                  Listo
	                </button>
	              </div>
	            </div>
	          </div>
	        </div>
	      ) : null}

	      {modalOpen ? (
	        <div className="permissions-modal" role="dialog" aria-modal="true">
	          <div className="permissions-modal__backdrop" onClick={closeModal} />
	          <div className="permissions-modal__content">
            <div className="permissions-modal__header">
              <div>
                <h3>{editingRecord ? 'Editar activo' : 'Agregar activo'}</h3>
                <p>Podés modificar cualquier campo manualmente.</p>
              </div>
              <button type="button" onClick={closeModal} aria-label="Cerrar">
                ×
              </button>
            </div>
            <form className="edit-form" onSubmit={handleSave} style={{ padding: '1rem' }}>
              <div className="form-grid">
                <label className="input-control">
                  <span>Encargado</span>
                  <input
                    type="text"
                    value={formValues.encargado}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, encargado: event.target.value }))}
                    placeholder="Ingresar"
                  />
                </label>
                <label className="input-control">
                  <span>Líder</span>
                  <input
                    type="text"
                    value={formValues.lider}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, lider: event.target.value }))}
                    placeholder="Ingresar"
                  />
                </label>
                <label className="input-control">
                  <span>Asesor comercial</span>
                  <input
                    type="text"
                    value={formValues.asesorComercial}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, asesorComercial: event.target.value }))}
                    placeholder="Ingresar"
                  />
                </label>
	                <label className="input-control">
	                  <span>Rol</span>
	                  <input
	                    type="text"
	                    value={formValues.rol}
	                    onChange={(event) => setFormValues((prev) => ({ ...prev, rol: event.target.value }))}
	                    placeholder="Ingresar"
	                  />
	                </label>
	                <label className="input-control">
	                  <span>Modalidad de trabajo</span>
	                  <select
	                    value={formValues.modalidadTrabajo}
	                    onChange={(event) => setFormValues((prev) => ({ ...prev, modalidadTrabajo: event.target.value }))}
	                  >
	                    <option value="Presencial">Presencial</option>
	                    <option value="Remoto">Remoto</option>
	                  </select>
	                </label>
	                <label className="input-control">
	                  <span>Transportista (Activo)</span>
	                  <input
	                    type="text"
	                    value={formValues.transportistaActivo}
                    onChange={(event) =>
                      setFormValues((prev) => ({ ...prev, transportistaActivo: event.target.value }))
                    }
                    placeholder="Ingresar"
                  />
                </label>
	                <label className="input-control">
	                  <span>Número</span>
	                  <input
	                    type="text"
	                    value={formValues.numero}
	                    onChange={(event) => setFormValues((prev) => ({ ...prev, numero: event.target.value }))}
	                    placeholder="Ingresar"
	                  />
	                </label>
	                <label className="input-control">
	                  <span>Comentarios</span>
	                  <textarea
	                    value={formValues.comentarios}
	                    onChange={(event) => setFormValues((prev) => ({ ...prev, comentarios: event.target.value }))}
	                    placeholder={canEditComentarios ? 'Ingresar' : 'Solo Luis/David/Joel/Dario/Luciano pueden editar'}
	                    disabled={!canEditComentarios}
	                    rows={3}
	                  />
	                </label>
	                <label className="input-control">
	                  <span>Cliente</span>
	                  <input
	                    type="text"
	                    value={formValues.cliente}
	                    onChange={(event) => setFormValues((prev) => ({ ...prev, cliente: event.target.value }))}
	                    placeholder="Ingresar"
	                  />
	                </label>
	                <label className="input-control">
	                  <span>Asesor de Postventa</span>
	                  <input
	                    type="text"
	                    value={formValues.asesorPostventa}
	                    onChange={(event) => setFormValues((prev) => ({ ...prev, asesorPostventa: event.target.value }))}
	                    placeholder="Ingresar"
	                  />
	                </label>
	                <label className="input-control">
	                  <span>Sucursal</span>
	                  <input
	                    type="text"
	                    value={formValues.sucursal}
	                    onChange={(event) => setFormValues((prev) => ({ ...prev, sucursal: event.target.value }))}
	                    placeholder="Ingresar"
	                  />
	                </label>
	                <label className="input-control">
	                  <span>Vehículo</span>
	                  <input
	                    type="text"
	                    value={formValues.vehiculo}
	                    onChange={(event) => setFormValues((prev) => ({ ...prev, vehiculo: event.target.value }))}
	                    placeholder="Ingresar"
	                  />
	                </label>
	              </div>
              {modalError ? <p className="form-info form-info--error">{modalError}</p> : null}
              <div className="form-actions">
                <button type="button" className="secondary-action" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="primary-action" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
};

const ConfigurationPage: React.FC = () => {
  const authUser = useStoredAuthUser();
  const userRole = useMemo(() => getUserRole(authUser), [authUser]);
  const { brandLogoSrc, promoLogoSrc, setBrandLogo, setPromoLogo, resetBranding } = useBranding();
  const [brandPreview, setBrandPreview] = useState<string | null>(brandLogoSrc);
  const [promoPreview, setPromoPreview] = useState<string | null>(promoLogoSrc);
  const [savingMessage, setSavingMessage] = useState<string | null>(null);
  const [tfEmail, setTfEmail] = useState(authUser?.email ?? '');
  const [tfPassword, setTfPassword] = useState('');
  const [tfSecret, setTfSecret] = useState<string | null>(null);
  const [tfOtpAuthUrl, setTfOtpAuthUrl] = useState<string | null>(null);
  const [tfCode, setTfCode] = useState('');
  const [tfInfo, setTfInfo] = useState<string | null>(null);
  const [tfError, setTfError] = useState<string | null>(null);

  useEffect(() => {
    setBrandPreview(brandLogoSrc);
  }, [brandLogoSrc]);

  useEffect(() => {
    setPromoPreview(promoLogoSrc);
  }, [promoLogoSrc]);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleUpload =
    (setter: (value: string | null) => void, previewSetter: (value: string | null) => void) =>
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setter(dataUrl);
        previewSetter(dataUrl);
        setSavingMessage('Logo actualizado localmente.');
      } catch (err) {
        window.alert((err as Error).message ?? 'No se pudo leer el archivo.');
      } finally {
        event.target.value = '';
      }
    };

  const handleReset = () => {
    resetBranding();
    setBrandPreview(DEFAULT_LOGO_SRC);
    setPromoPreview(DEFAULT_LOGO_SRC);
    setSavingMessage('Se restauraron los logos por defecto.');
  };

  const handleClearBranding = () => {
    setBrandLogo('');
    setPromoLogo('');
    setBrandPreview(null);
    setPromoPreview(null);
    setSavingMessage('Logos eliminados: la app se mostrará sin marca.');
  };

  const isAdmin = userRole === 'admin';

  return (
    <DashboardLayout title="Configuración" subtitle="Actualiza los logos visibles en la app" layoutVariant="panel">
      {!isAdmin ? (
        <p className="form-info form-info--error">Solo los administradores pueden modificar los logos.</p>
      ) : (
        <>
          <div className="card-grid">
            <div className="card card--padded">
              <h3>Logo principal (sidebar / login)</h3>
              <p className="form-info">Usá imágenes en PNG o SVG. Tamaño recomendado 220x60.</p>
              <div
                className="logo-preview"
                style={{ border: '1px dashed #d6d9e0', padding: '12px', borderRadius: '10px', background: '#f9fbff' }}
              >
                {brandPreview ? (
                  <img src={brandPreview} alt="Logo principal" className="brand-logo" />
                ) : (
                  <div className="brand-placeholder">Sin logo</div>
                )}
              </div>
              <label className="input-control">
                <span>Subir nuevo logo</span>
                <input type="file" accept="image/*" onChange={handleUpload(setBrandLogo, setBrandPreview)} />
              </label>
            </div>

            <div className="card card--padded">
              <h3>Logo secundario (watermark / promo)</h3>
              <p className="form-info">Se usa en el panel de login y watermark del chat.</p>
              <div
                className="logo-preview"
                style={{ border: '1px dashed #d6d9e0', padding: '12px', borderRadius: '10px', background: '#f9fbff' }}
              >
                {promoPreview ? (
                  <img src={promoPreview} alt="Logo secundario" className="promo-logo" />
                ) : (
                  <div className="brand-placeholder">Sin logo</div>
                )}
              </div>
              <label className="input-control">
                <span>Subir logo secundario</span>
                <input type="file" accept="image/*" onChange={handleUpload(setPromoLogo, setPromoPreview)} />
              </label>
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="secondary-action" onClick={handleReset}>
              Restaurar logos por defecto
            </button>
            <button type="button" className="secondary-action" onClick={handleClearBranding}>
              Eliminar logos
            </button>
            {savingMessage ? <p className="form-info">{savingMessage}</p> : null}
          </div>

          <div className="card card--padded" style={{ marginTop: '1.5rem' }}>
            <h3>Activar 2FA (TOTP)</h3>
            <p className="form-info">
              Genera un secreto, agrégalo en Google Authenticator u otra app TOTP y confirma con un código de 6 dígitos.
            </p>
            <div className="form-grid">
              <label className="input-control">
                <span>Email</span>
                <input
                  type="email"
                  value={tfEmail}
                  onChange={(e) => setTfEmail(e.target.value)}
                  placeholder="Email"
                />
              </label>
              <label className="input-control">
                <span>Contraseña</span>
                <input
                  type="password"
                  value={tfPassword}
                  onChange={(e) => setTfPassword(e.target.value)}
                  placeholder="Tu contraseña actual"
                />
              </label>
              <div className="input-control">
                <span>Secreto</span>
                <div className="input-with-action">
                  <input type="text" readOnly value={tfSecret ?? ''} placeholder="Genera un secreto" />
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={async () => {
                      try {
                        setTfError(null);
                        setTfInfo(null);
                        const response = await fetch(`${resolveApiBaseUrl()}/api/twofactor/setup`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: tfEmail.trim(), password: tfPassword }),
                        });
                        if (!response.ok) {
                          let msg = `Error ${response.status}`;
                          try {
                            const payload = await response.json();
                            if (payload?.message) msg = payload.message;
                          } catch {
                            // ignore
                          }
                          throw new Error(msg);
                        }
                        const payload = await response.json();
                        setTfSecret(payload?.data?.secret ?? null);
                        setTfOtpAuthUrl(payload?.data?.otpauth_url ?? null);
                        setTfInfo('Secreto generado. Cópialo a tu app y luego ingresa el código para confirmarlo.');
                      } catch (err) {
                        setTfError((err as Error).message ?? 'No se pudo generar el secreto.');
                      }
                    }}
                  >
                    Generar secreto
                  </button>
                </div>
              </div>
              <label className="input-control">
                <span>Código 2FA</span>
                <input
                  type="text"
                  value={tfCode}
                  onChange={(e) => setTfCode(e.target.value)}
                  placeholder="Código de 6 dígitos"
                  inputMode="numeric"
                />
              </label>
            </div>
            {tfOtpAuthUrl ? (
              <p className="form-info">
                URL otpauth: <code>{tfOtpAuthUrl}</code>
              </p>
            ) : null}
            {tfInfo ? <p className="form-info">{tfInfo}</p> : null}
            {tfError ? <p className="form-info form-info--error">{tfError}</p> : null}
            <div className="form-actions">
              <button
                type="button"
                className="primary-action"
                onClick={async () => {
                  try {
                    setTfError(null);
                    setTfInfo(null);
                    const response = await fetch(`${resolveApiBaseUrl()}/api/twofactor/enable`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        email: tfEmail.trim(),
                        password: tfPassword,
                        secret: tfSecret,
                        code: tfCode,
                      }),
                    });
                    if (!response.ok) {
                      let msg = `Error ${response.status}`;
                      try {
                        const payload = await response.json();
                        if (payload?.message) msg = payload.message;
                      } catch {
                        // ignore
                      }
                      throw new Error(msg);
                    }
                    setTfInfo('2FA activado correctamente.');
                  } catch (err) {
                    setTfError((err as Error).message ?? 'No se pudo activar 2FA.');
                  }
                }}
                disabled={!tfSecret || !tfCode || !tfPassword || !tfEmail}
              >
                Confirmar 2FA
              </button>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
};

const RequireAccess: React.FC<{ section: AccessSection; children: React.ReactElement }> = ({
  section,
  children,
}) => {
  const authUser = useStoredAuthUser();
  const userRole = useMemo(() => getUserRole(authUser), [authUser]);

  if (!authUser?.role) {
    return <Navigate to="/" replace />;
  }

  if (!canAccessSection(userRole, section, authUser?.permissions)) {
    return <Navigate to="/informacion-general" replace />;
  }

  return children;
};

const RequireAuth: React.FC = () => {
  const authUser = useStoredAuthUser();

  if (!authUser?.role) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

const AppRoutes: React.FC = () => {
  const facturacionPages = useMemo(
    () =>
      createFacturacionPages({
        DashboardLayout,
        resolveApiBaseUrl,
        useStoredAuthUser,
        buildActorHeaders,
        resolveApiUrl,
        withAuthToken,
        parseJsonSafe,
        formatCurrency,
        formatDateTime,
      }),
    [
      DashboardLayout,
      resolveApiBaseUrl,
      useStoredAuthUser,
      buildActorHeaders,
      resolveApiUrl,
      withAuthToken,
      parseJsonSafe,
      formatCurrency,
      formatDateTime,
    ]
  );

  const {
    FacturacionPage,
    FacturacionListadoPage,
    FacturacionCreatePage,
    FacturacionDetailPage,
    FacturacionClientesPage,
    FacturacionClientesGrupoPage,
    FacturacionConfigArcaPage,
  } = facturacionPages;

  return (
    <Routes>
    <Route path="/" element={<LoginPage />} />
    <Route element={<RequireAuth />}>
      <Route
        path="/dashboard"
        element={
          <RequireAccess section="panel-general">
            <DashboardPage showPersonalPanel />
          </RequireAccess>
        }
      />
      <Route
        path="/distriapp"
        element={
          <RequireAccess section="distriapp">
            <DistriappHubPage />
          </RequireAccess>
        }
      />
      <Route
        path="/distriapp/monitoreo"
        element={
          <RequireAccess section="distriapp">
            <DistriappLiveTrackingPage />
          </RequireAccess>
        }
      />
      <Route
        path="/distriapp/distribucion-urbana"
        element={
          <RequireAccess section="distriapp">
            <DistriappUrbanDistributionPage />
          </RequireAccess>
        }
      />
      <Route
        path="/distriapp/viajes"
        element={
          <RequireAccess section="distriapp">
            <DistriappJourneysPage />
          </RequireAccess>
        }
      />
      <Route
        path="/distriapp/ubic-repartidores"
        element={
          <RequireAccess section="distriapp">
            <DistriappDriversLocationPage />
          </RequireAccess>
        }
      />
      <Route
        path="/resumen"
        element={
          <RequireAccess section="resumen">
            <ResumenPage DashboardLayout={DashboardLayout} resolveApiBaseUrl={resolveApiBaseUrl} />
          </RequireAccess>
        }
      />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/chat/:contactId" element={<ChatPage />} />
      <Route
        path="/llamadas"
        element={
          <WebRtcCallsPage
            DashboardLayout={DashboardLayout}
            resolveApiBaseUrl={resolveApiBaseUrl}
            useStoredAuthUser={useStoredAuthUser}
            parseJsonSafe={parseJsonSafe}
          />
        }
      />
      <Route path="/informacion-general" element={<GeneralInfoPage />} />
      <Route
        path="/clientes"
        element={
          <RequireAccess section="clientes">
            <ClientesPage DashboardLayout={DashboardLayout} resolveApiBaseUrl={resolveApiBaseUrl} parseJsonSafe={parseJsonSafe} />
          </RequireAccess>
        }
      />
      <Route
        path="/tarifas"
        element={
          <RequireAccess section="tarifas">
            <DashboardPage pageTitle="Tarifas" pageSubtitle="Listado de clientes" viewMode="tarifas" />
          </RequireAccess>
        }
      />
      <Route
        path="/bases-distribucion"
        element={
          <RequireAccess section="bases">
            <DashboardPage
              pageTitle="Bases de distribución"
              pageSubtitle="Clientes y sucursales"
              viewMode="bases"
            />
          </RequireAccess>
        }
      />
      <Route
        path="/bases-distribucion/:clienteId"
        element={
          <RequireAccess section="bases">
            <BaseDistribucionDetailPage />
          </RequireAccess>
        }
      />
      <Route
        path="/bdd-activos-asesores-comerciales"
        element={
          <RequireAccess section="bdd-activos-asesores">
            <ActivosAsesoresPage />
          </RequireAccess>
        }
      />
      <Route
        path="/unidades"
        element={
          <RequireAccess section="unidades">
            <UnidadesPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              parseJsonSafe={parseJsonSafe}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/reclamos"
        element={
          <RequireAccess section="reclamos">
            <ReclamosPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              getUserRole={getUserRole}
              buildActorHeaders={buildActorHeaders}
              isElevatedRole={(role) => isElevatedRole(role as UserRole)}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/reclamos/nuevo"
        element={
          <RequireAccess section="reclamos">
            <ReclamoNuevoPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/notificaciones"
        element={
          <RequireAccess section="notificaciones">
            <NotificationsPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/ticketera"
        element={
          <RequireAccess section="ticketera">
            <TicketeraPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              getUserRole={getUserRole}
              buildActorHeaders={buildActorHeaders}
              isElevatedRole={(role) => isElevatedRole(role as UserRole)}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/reclamos/:reclamoId"
        element={
          <RequireAccess section="reclamos">
            <ReclamoDetallePage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              buildActorHeaders={buildActorHeaders}
              PERSON_TAX_ID_LABEL={PERSON_TAX_ID_LABEL}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/unidades/nuevo"
        element={
          <RequireAccess section="unidades">
            <UnidadNuevaPage DashboardLayout={DashboardLayout} resolveApiBaseUrl={resolveApiBaseUrl} />
          </RequireAccess>
        }
      />
      <Route
        path="/unidades/:unidadId/editar"
        element={
          <RequireAccess section="unidades">
            <UnidadEditarPage DashboardLayout={DashboardLayout} resolveApiBaseUrl={resolveApiBaseUrl} />
          </RequireAccess>
        }
      />
      <Route
        path="/personal"
        element={
          <RequireAccess section="personal">
            <ProveedoresPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              getUserRole={getUserRole}
              isPersonalEditor={isPersonalEditor}
              buildActorHeaders={buildActorHeaders}
              buildPersonalFiltersStorageKey={buildPersonalFiltersStorageKey}
              readStoredPersonalFilters={readStoredPersonalFilters}
              isElevatedRole={(role) => isElevatedRole(role as UserRole)}
              PERSON_TAX_ID_LABEL={PERSON_TAX_ID_LABEL}
              getPerfilDisplayLabel={getPerfilDisplayLabel}
              getEstadoBadgeClass={getEstadoBadgeClass}
              formatPagoLabel={formatPagoLabel}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/personal/nuevo"
        element={
          <RequireAccess section="personal">
            <ProveedorNuevoPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              isPersonalEditor={isPersonalEditor}
              buildActorHeaders={buildActorHeaders}
              PERSON_TAX_ID_LABEL={PERSON_TAX_ID_LABEL}
              COLLECTOR_TAX_ID_LABEL={COLLECTOR_TAX_ID_LABEL}
              OWNER_TAX_ID_LABEL={OWNER_TAX_ID_LABEL}
              OWNER_COLLECTOR_TAX_ID_LABEL={OWNER_COLLECTOR_TAX_ID_LABEL}
              PAGO_SELECT_OPTIONS={PAGO_SELECT_OPTIONS}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/personal/:personaId/editar"
        element={
          <RequireAccess section="personal">
            <ProveedorEditarPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              getUserRole={getUserRole}
              isPersonalEditor={isPersonalEditor}
              buildActorHeaders={buildActorHeaders}
              resolveApiUrl={resolveApiUrl}
              readCachedSolicitudData={readCachedSolicitudData}
              writeCachedSolicitudData={writeCachedSolicitudData}
              readPersonalEditCache={readPersonalEditCache}
              writePersonalEditCache={(id, data) => writePersonalEditCache(id, data as Partial<PersonalDetail>)}
              PERSON_TAX_ID_LABEL={PERSON_TAX_ID_LABEL}
              COLLECTOR_TAX_ID_LABEL={COLLECTOR_TAX_ID_LABEL}
              OWNER_TAX_ID_LABEL={OWNER_TAX_ID_LABEL}
              OWNER_COLLECTOR_TAX_ID_LABEL={OWNER_COLLECTOR_TAX_ID_LABEL}
              PAGO_SELECT_OPTIONS={PAGO_SELECT_OPTIONS}
              formatPagoLabel={formatPagoLabel}
              TaxProfileSection={TaxProfileSection}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/liquidaciones"
        element={
          <RequireAccess section="liquidaciones">
            <LiquidacionesPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              buildActorHeaders={buildActorHeaders}
              resolveApiUrl={resolveApiUrl}
              parseJsonSafe={parseJsonSafe}
              formatCurrency={formatCurrency}
              formatPagoLabel={formatPagoLabel}
              getPerfilDisplayLabel={getPerfilDisplayLabel}
              createImagePreviewUrl={createImagePreviewUrl}
              revokeImagePreviewUrl={revokeImagePreviewUrl}
              readAuthTokenFromStorage={readAuthTokenFromStorage}
              withAuthToken={withAuthToken}
              PERSON_TAX_ID_LABEL={PERSON_TAX_ID_LABEL}
              COLLECTOR_TAX_ID_LABEL={COLLECTOR_TAX_ID_LABEL}
              formatDateTime={formatDateTime}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/liquidaciones/cliente"
        element={
          <RequireAccess section="liquidaciones">
            <LiquidacionesClientePage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              buildActorHeaders={buildActorHeaders}
              resolveApiUrl={resolveApiUrl}
              parseJsonSafe={parseJsonSafe}
              formatCurrency={formatCurrency}
              formatDateOnly={formatDateOnly}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/liquidaciones/:personaId"
        element={
          <RequireAccess section="liquidaciones">
            <LiquidacionesPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              buildActorHeaders={buildActorHeaders}
              resolveApiUrl={resolveApiUrl}
              parseJsonSafe={parseJsonSafe}
              formatCurrency={formatCurrency}
              formatPagoLabel={formatPagoLabel}
              getPerfilDisplayLabel={getPerfilDisplayLabel}
              createImagePreviewUrl={createImagePreviewUrl}
              revokeImagePreviewUrl={revokeImagePreviewUrl}
              readAuthTokenFromStorage={readAuthTokenFromStorage}
              withAuthToken={withAuthToken}
              PERSON_TAX_ID_LABEL={PERSON_TAX_ID_LABEL}
              COLLECTOR_TAX_ID_LABEL={COLLECTOR_TAX_ID_LABEL}
              formatDateTime={formatDateTime}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/liquidaciones/recibos"
        element={
          <RequireAccess section="liquidaciones">
            <RecibosPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              buildActorHeaders={buildActorHeaders}
              parseJsonSafe={parseJsonSafe}
              formatDateTime={formatDateTime}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/liquidaciones/extractos"
        element={
          <RequireAccess section="liquidaciones">
            <CombustibleRunsPage />
          </RequireAccess>
        }
      />
      <Route
        path="/pagos"
        element={
          <RequireAccess section="pagos">
            <LiquidacionesPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              buildActorHeaders={buildActorHeaders}
              resolveApiUrl={resolveApiUrl}
              parseJsonSafe={parseJsonSafe}
              formatCurrency={formatCurrency}
              formatPagoLabel={formatPagoLabel}
              getPerfilDisplayLabel={getPerfilDisplayLabel}
              createImagePreviewUrl={createImagePreviewUrl}
              revokeImagePreviewUrl={revokeImagePreviewUrl}
              readAuthTokenFromStorage={readAuthTokenFromStorage}
              withAuthToken={withAuthToken}
              PERSON_TAX_ID_LABEL={PERSON_TAX_ID_LABEL}
              COLLECTOR_TAX_ID_LABEL={COLLECTOR_TAX_ID_LABEL}
              formatDateTime={formatDateTime}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/pagos/:personaId"
        element={
          <RequireAccess section="pagos">
            <LiquidacionesPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              buildActorHeaders={buildActorHeaders}
              resolveApiUrl={resolveApiUrl}
              parseJsonSafe={parseJsonSafe}
              formatCurrency={formatCurrency}
              formatPagoLabel={formatPagoLabel}
              getPerfilDisplayLabel={getPerfilDisplayLabel}
              createImagePreviewUrl={createImagePreviewUrl}
              revokeImagePreviewUrl={revokeImagePreviewUrl}
              readAuthTokenFromStorage={readAuthTokenFromStorage}
              withAuthToken={withAuthToken}
              PERSON_TAX_ID_LABEL={PERSON_TAX_ID_LABEL}
              COLLECTOR_TAX_ID_LABEL={COLLECTOR_TAX_ID_LABEL}
              formatDateTime={formatDateTime}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/facturacion"
        element={
          <RequireAccess section="facturacion">
            <FacturacionPage />
          </RequireAccess>
        }
      />
      <Route
        path="/facturacion/facturas"
        element={
          <RequireAccess section="facturacion">
            <FacturacionListadoPage />
          </RequireAccess>
        }
      />
      <Route
        path="/facturacion/nueva"
        element={
          <RequireAccess section="facturacion">
            <FacturacionCreatePage />
          </RequireAccess>
        }
      />
      <Route
        path="/facturacion/facturas/:facturaId"
        element={
          <RequireAccess section="facturacion">
            <FacturacionDetailPage />
          </RequireAccess>
        }
      />
      <Route
        path="/facturacion/clientes"
        element={
          <RequireAccess section="facturacion">
            <FacturacionClientesPage />
          </RequireAccess>
        }
      />
      <Route
        path="/facturacion/clientes/grupo/:grupoId"
        element={
          <RequireAccess section="facturacion">
            <FacturacionClientesGrupoPage />
          </RequireAccess>
        }
      />
      <Route
        path="/facturacion/configuracion-arca"
        element={
          <RequireAccess section="facturacion">
            <FacturacionConfigArcaPage />
          </RequireAccess>
        }
      />
      <Route
        path="/combustible"
        element={
          <RequireAccess section="combustible">
            <CombustibleCargaPage />
          </RequireAccess>
        }
      />
      <Route
        path="/combustible/pendientes"
        element={
          <RequireAccess section="combustible">
            <CombustiblePendientesPage />
          </RequireAccess>
        }
      />
      <Route
        path="/combustible/distribuidor"
        element={
          <RequireAccess section="combustible">
            <CombustibleDistribuidorPage />
          </RequireAccess>
        }
      />
      <Route
        path="/combustible/informe"
        element={
          <RequireAccess section="combustible">
            <CombustibleInformePage />
          </RequireAccess>
        }
      />
      <Route
        path="/combustible/tardias"
        element={
          <RequireAccess section="combustible">
            <CombustibleTardiasPage />
          </RequireAccess>
        }
      />
      <Route
        path="/combustible/consumos"
        element={
          <RequireAccess section="combustible">
            <CombustibleConsumosPage />
          </RequireAccess>
        }
      />
      <Route
        path="/combustible/reportes"
        element={
          <RequireAccess section="combustible">
            <CombustibleReportesPage />
          </RequireAccess>
        }
      />
      <Route
        path="/combustible/runs"
        element={<Navigate to="/liquidaciones/extractos" replace />}
      />
      <Route
        path="/documentos"
        element={
          <RequireAccess section="documentos">
            <DocumentTypesPage DashboardLayout={DashboardLayout} resolveApiBaseUrl={resolveApiBaseUrl} />
          </RequireAccess>
        }
      />
      <Route
        path="/documentos/nuevo"
        element={
          <RequireAccess section="documentos">
            <DocumentTypeCreatePage DashboardLayout={DashboardLayout} resolveApiBaseUrl={resolveApiBaseUrl} />
          </RequireAccess>
        }
      />
      <Route
        path="/documentos/:tipoId/editar"
        element={
          <RequireAccess section="documentos">
            <DocumentTypeEditPage DashboardLayout={DashboardLayout} resolveApiBaseUrl={resolveApiBaseUrl} />
          </RequireAccess>
        }
      />
      <Route
        path="/rrhh"
        element={
          <RequireAccess section="rrhh">
            <RrhhPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              buildActorHeaders={buildActorHeaders}
              parseJsonSafe={parseJsonSafe}
              resolveApiUrl={resolveApiUrl}
              withAuthToken={withAuthToken}
              RRHH_DOCUMENT_CATEGORY_OPTIONS={RRHH_DOCUMENT_CATEGORY_OPTIONS}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/usuarios"
        element={
          <RequireAccess section="usuarios">
            <UsuariosPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              normalizeUserRole={normalizeUserRole}
              formatRoleLabel={formatRoleLabel}
              USER_ROLE_OPTIONS={USER_ROLE_OPTIONS}
              USER_PERMISSION_OPTIONS={USER_PERMISSION_OPTIONS}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/usuarios/nuevo"
        element={
          <RequireAccess section="usuarios">
            <UsuarioNuevoPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              USER_ROLE_OPTIONS={USER_ROLE_OPTIONS}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/usuarios/:usuarioId/editar"
        element={
          <RequireAccess section="usuarios">
            <UsuarioEditarPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              normalizeUserRole={normalizeUserRole}
              formatRoleLabel={formatRoleLabel}
              USER_ROLE_OPTIONS={USER_ROLE_OPTIONS}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/control-horario/:userKey"
        element={
          <RequireAccess section="control-horario">
            <AttendanceUserDetailPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/control-horario"
        element={
          <RequireAccess section="control-horario">
            <AttendanceLogPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/flujo-trabajo"
        element={
          <RequireAccess section="flujo-trabajo">
            <WorkflowPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              getUserRole={getUserRole}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/solicitud-personal"
        element={
          <RequireAccess section="solicitud-personal">
            <ApprovalsRequestsPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              buildActorHeaders={buildActorHeaders}
              parseJsonSafe={parseJsonSafe}
              resolveApiUrl={resolveApiUrl}
              getUserRole={getUserRole}
              isPersonalEditor={isPersonalEditor}
              getPerfilDisplayLabel={getPerfilDisplayLabel}
              formatPagoLabel={formatPagoLabel}
              serializePagoValue={serializePagoValue}
              formatCurrency={formatCurrency}
              createImagePreviewUrl={createImagePreviewUrl}
              revokeImagePreviewUrl={revokeImagePreviewUrl}
              writeCachedSolicitudData={writeCachedSolicitudData}
              PAGO_SELECT_OPTIONS={PAGO_SELECT_OPTIONS}
              PERSON_TAX_ID_LABEL={PERSON_TAX_ID_LABEL}
              COLLECTOR_TAX_ID_LABEL={COLLECTOR_TAX_ID_LABEL}
              OWNER_TAX_ID_LABEL={OWNER_TAX_ID_LABEL}
              OWNER_COLLECTOR_TAX_ID_LABEL={OWNER_COLLECTOR_TAX_ID_LABEL}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/aprobaciones"
        element={
          <RequireAccess section="aprobaciones">
            <ApprovalsRequestsPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              buildActorHeaders={buildActorHeaders}
              parseJsonSafe={parseJsonSafe}
              resolveApiUrl={resolveApiUrl}
              getUserRole={getUserRole}
              isPersonalEditor={isPersonalEditor}
              getPerfilDisplayLabel={getPerfilDisplayLabel}
              formatPagoLabel={formatPagoLabel}
              serializePagoValue={serializePagoValue}
              formatCurrency={formatCurrency}
              createImagePreviewUrl={createImagePreviewUrl}
              revokeImagePreviewUrl={revokeImagePreviewUrl}
              writeCachedSolicitudData={writeCachedSolicitudData}
              PAGO_SELECT_OPTIONS={PAGO_SELECT_OPTIONS}
              PERSON_TAX_ID_LABEL={PERSON_TAX_ID_LABEL}
              COLLECTOR_TAX_ID_LABEL={COLLECTOR_TAX_ID_LABEL}
              OWNER_TAX_ID_LABEL={OWNER_TAX_ID_LABEL}
              OWNER_COLLECTOR_TAX_ID_LABEL={OWNER_COLLECTOR_TAX_ID_LABEL}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/clientes/nuevo"
        element={
          <RequireAccess section="clientes">
            <CreateClientPage />
          </RequireAccess>
        }
      />
      <Route
        path="/clientes/:clienteId/editar"
        element={
          <RequireAccess section="clientes">
            <EditClientPage />
          </RequireAccess>
        }
      />
      <Route
        path="/auditoria"
        element={
          <RequireAccess section="auditoria">
            <AuditPage
              DashboardLayout={DashboardLayout}
              resolveApiBaseUrl={resolveApiBaseUrl}
              useStoredAuthUser={useStoredAuthUser}
              getUserRole={getUserRole}
              formatCurrency={formatCurrency}
              formatDateTime={formatDateTime}
            />
          </RequireAccess>
        }
      />
      <Route
        path="/configuracion"
        element={
          <RequireAccess section="configuracion">
            <ConfigurationPage />
          </RequireAccess>
        }
      />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrandingProvider>
        <AppRoutes />
      </BrandingProvider>
    </ThemeProvider>
  );
  
};

export default App;
