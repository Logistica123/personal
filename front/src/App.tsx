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

type PersonalRecord = {
  id: number;
  nombre: string | null;
  cuil: string | null;
  telefono: string | null;
  email: string | null;
  cliente: string | null;
  unidad: string | null;
  unidadDetalle: string | null;
  sucursal: string | null;
  fechaAlta: string | null;
  perfil: string | null;
  perfilValue: number | null;
  agente: string | null;
  estado: string | null;
  combustible: string | null;
  combustibleValue: boolean;
  tarifaEspecial: string | null;
  tarifaEspecialValue: boolean;
  aprobado: boolean;
  aprobadoAt: string | null;
  aprobadoPor: string | null;
  esSolicitud: boolean;
  solicitudTipo?: 'alta' | 'combustible' | 'aumento_combustible' | 'adelanto' | 'poliza';
  solicitudData?: unknown;
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
  aprobado: boolean;
  aprobadoAt: string | null;
  aprobadoPorId: number | null;
  aprobadoPorNombre: string | null;
  esSolicitud: boolean;
  documents: Array<{
    id: number;
    nombre: string | null;
    downloadUrl: string | null;
    mime: string | null;
    size: number | null;
    fechaVencimiento: string | null;
    tipoId: number | null;
    tipoNombre: string | null;
    requiereVencimiento: boolean;
  }>;
  comments: Array<{
    id: number;
    message: string | null;
    userId: number | null;
    userName: string | null;
    createdAt: string | null;
    createdAtLabel: string | null;
  }>;
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
};

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
  duenoTelefono: string;
  duenoObservaciones: string;
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
  creator: string | null;
  creatorId: number | null;
  agente: string | null;
  agenteId: number | null;
  transportista: string | null;
  transportistaId: number | null;
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

type NotificationRecord = {
  id: number;
  message: string | null;
  reclamoId: number | null;
  reclamoCodigo: string | null;
  reclamoEstado: string | null;
  personaId: number | null;
  personaNombre: string | null;
  readAt: string | null;
  createdAt: string | null;
  createdAtLabel?: string | null;
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
  const [notificationsVersion, setNotificationsVersion] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [attendanceRecord, setAttendanceRecord] = useState<AttendanceRecord | null>(() => {
    const storedUser = readAuthUserFromStorage();
    return readAttendanceRecordFromStorage(deriveAttendanceUserKey(storedUser));
  });
  const currentUserKey = useMemo(() => deriveAttendanceUserKey(authUser), [authUser]);
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
    const interval = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(interval);
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
  const entryButtonClassName = isWorking ? 'time-button time-button--active-in' : 'time-button time-button--in';
  const exitButtonClassName = isWorking ? 'time-button time-button--active-out' : 'time-button';

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
    const handler = () => setNotificationsVersion((value) => value + 1);
    window.addEventListener('notifications:updated', handler);
    return () => window.removeEventListener('notifications:updated', handler);
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
      return;
    }

    const controller = new AbortController();

    const fetchUnread = async () => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/notificaciones?userId=${authUser.id}&onlyUnread=1`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(response.statusText);
        }

        const payload = (await response.json()) as { data: NotificationRecord[] };
        setUnreadCount(payload.data.length);
      } catch {
        // ignore errors on header badge
      }
    };

    fetchUnread();

    return () => controller.abort();
  }, [apiBaseUrl, authUser?.id, notificationsVersion]);

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

  const handleMarkAttendance = (status: AttendanceRecord['status']) => {
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
  };

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="sidebar-logo">
          <img src="/logo-empresa.png" alt="Logo de la empresa" className="brand-logo" />
        </div>

        <nav className="sidebar-nav">
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
          <NavLink to="/aprobaciones" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
            Aprobaciones/solicitudes
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

      <main className="dashboard-content">
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
                <button
                  type="button"
                  className={entryButtonClassName}
                  onClick={() => handleMarkAttendance('entrada')}
                >
                  Entrada
                </button>
                <button type="button" className={exitButtonClassName} onClick={() => handleMarkAttendance('salida')}>
                  Salida
                </button>
              </div>
            </div>
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
  const [statusFilter, setStatusFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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

  const transportistaOptions = useMemo(
    () =>
      Array.from(
        new Set(
          reclamos
            .map((reclamo) => reclamo.transportista)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [reclamos]
  );

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

      if (transportistaFilter && reclamo.transportista !== transportistaFilter) {
        return false;
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

      if (term.length === 0) {
        return true;
      }

      const fields = [
        reclamo.codigo,
        reclamo.detalle,
        reclamo.creator,
        reclamo.agente,
        reclamo.transportista,
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
    statusFilter,
    tipoFilter,
    dateFrom,
    dateTo,
  ]);

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
    navigate(`/reclamos/${reclamo.id}`);
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
              <th>Demora</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10}>Cargando reclamos...</td>
              </tr>
            )}

            {error && !loading && (
              <tr>
                <td colSpan={10} className="error-cell">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && filteredReclamos.length === 0 && (
              <tr>
                <td colSpan={10}>No hay reclamos para mostrar.</td>
              </tr>
            )}

            {!loading &&
              !error &&
              filteredReclamos.map((reclamo) => (
                <tr key={reclamo.id}>
                  <td>{reclamo.fechaReclamo ?? '—'}</td>
                  <td>{reclamo.codigo ?? `#${reclamo.id}`}</td>
                  <td title={reclamo.detalle ?? undefined}>
                    {truncateText(reclamo.detalle, 80)}
                  </td>
                  <td>{reclamo.creator ?? '—'}</td>
                  <td>{reclamo.transportista ?? '—'}</td>
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
  const [attachmentName, setAttachmentName] = useState<string | null>(null);

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
    const file = event.target.files?.[0];
    if (file) {
      setAttachmentName(file.name);
    } else {
      setAttachmentName(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formValues.transportistaId || !formValues.tipoId || !formValues.status) {
      setSubmitError('Completa los campos obligatorios.');
      return;
    }

    try {
      setSubmitError(null);
      setSuccessMessage(null);
      setSaving(true);

      const response = await fetch(`${apiBaseUrl}/api/reclamos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          detalle: formValues.detalle.trim() || null,
          agenteId: formValues.agenteId ? Number(formValues.agenteId) : null,
          creatorId: formValues.creatorId ? Number(formValues.creatorId) : null,
          transportistaId: Number(formValues.transportistaId),
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

      const successText = payload.message ?? 'Reclamo creado correctamente.';
      const flashPayload = {
        message: `${successText} Responsable: ${payload.data.agente ?? 'Sin asignar'}. Creador: ${
          payload.data.creator ?? 'Sin asignar'
        }.`,
        reclamo: payload.data,
      };

      try {
        sessionStorage.setItem('recentReclamo', JSON.stringify(flashPayload));
      } catch {
        // ignore storage failures
      }

      setSuccessMessage(successText);

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
      setAttachmentName(null);
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
              Arrastra y suelta tu archivo aquí o haz clic para seleccionar un archivo
            </p>
            {attachmentName ? (
              <span className="file-dropzone__filename">{attachmentName}</span>
            ) : (
              <span className="file-dropzone__hint">
                Formatos soportados: .pdf, .jpg, .jpeg, .png, .docx (máx. 2MB)
              </span>
            )}
            <button type="button" className="primary-action" onClick={handleFilePicker}>
              Seleccionar archivo
            </button>
            <input
              ref={fileInputRef}
              type="file"
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

  const shouldRefreshFormRef = useRef(true);

  const applyDetail = useCallback((data: ReclamoDetail, options?: { refreshForm?: boolean }) => {
    if (options && Object.prototype.hasOwnProperty.call(options, 'refreshForm')) {
      shouldRefreshFormRef.current = !!options.refreshForm;
    } else {
      shouldRefreshFormRef.current = true;
    }
    setDetail({
      ...data,
      documents: data.documents ?? [],
    });
  }, []);

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

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setDocumentUploading(true);
      setDocumentError(null);
      setDocumentMessage(null);

      const formData = new FormData();
      formData.append('archivo', file);
      formData.append('nombre', file.name);
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
      setDocumentMessage(payload.message ?? 'Documento cargado correctamente.');
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

  const transportistaInfo = detail.transportistaDetail;

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
            <h3>Datos del transportista</h3>
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
                {documentUploading ? 'Subiendo...' : 'Subir archivo'}
              </button>
              <input
                ref={fileUploadInputRef}
                type="file"
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
                onChange={(event) => setFormValues((prev) => ({ ...prev, pagado: event.target.value }))}
              >
                <option value="false">No</option>
                <option value="true">Sí</option>
              </select>
            </label>

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
        registro.estado,
        registro.combustible,
        registro.tarifaEspecial,
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
    const rows = [
      [
        'ID',
        'Nombre',
        'CUIL',
        'Teléfono',
        'Email',
        'Perfil',
        'Agente',
        'Estado',
        'Combustible',
        'Tarifa especial',
        'Unidad',
        'Cliente',
        'Sucursal',
        'Fecha alta',
      ],
      ...filteredPersonal.map((registro) => [
        registro.id,
        registro.nombre ?? '',
        registro.cuil ?? '',
        registro.telefono ?? '',
        registro.email ?? '',
        registro.perfil ?? '',
        registro.agente ?? '',
        registro.estado ?? '',
        registro.combustible ?? '',
        registro.tarifaEspecial ?? '',
        registro.unidadDetalle ?? registro.unidad ?? '',
        registro.cliente ?? '',
        registro.sucursal ?? '',
        registro.fechaAlta ?? '',
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? '');
            if (value.includes('"') || value.includes(',') || value.includes('\n')) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
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

        const response = await fetch(
          `${apiBaseUrl}/api/notificaciones?userId=${authUser.id}`,
          {
            signal: controller.signal,
          }
        );

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
  const isAdmin = useMemo(() => {
    const normalized = authUser?.role?.toLowerCase() ?? '';
    return normalized.includes('admin');
  }, [authUser?.role]);
  const [log, setLog] = useState<AttendanceRecord[]>(() => readAttendanceLogFromStorage());
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setLog(readAttendanceLogFromStorage());
    window.addEventListener('attendance:updated', handler);
    return () => window.removeEventListener('attendance:updated', handler);
  }, []);

  const durationLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    const chronological = [...log].sort(
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
  }, [log]);

  const handleClearLog = () => {
    if (!window.confirm('¿Seguro que deseas limpiar el registro de marcaciones?')) {
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

  const sortedLog = [...log].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const headerContent = (
    <div className="card-header card-header--compact">
      <button
        type="button"
        className="secondary-action"
        onClick={handleClearLog}
        disabled={sortedLog.length === 0}
      >
        Limpiar registro
      </button>
    </div>
  );

  return (
    <DashboardLayout title="Control horario" subtitle="Registro de marcaciones" headerContent={headerContent}>
      <div className="table-wrapper">
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
  const [log, setLog] = useState<AttendanceRecord[]>(() => readAttendanceLogFromStorage());
  const [selectedMonth, setSelectedMonth] = useState(() => formatMonthValue(new Date()));

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

  const userLog = useMemo(() => {
    if (!decodedUserKey) {
      return [] as AttendanceRecord[];
    }
    return log.filter((record) => (record.userKey ?? buildAttendanceUserKey(record)) === decodedUserKey);
  }, [log, decodedUserKey]);

  const displayName = useMemo(() => {
    const fromQuery = queryName?.trim();
    if (fromQuery && fromQuery.length > 0) {
      return fromQuery;
    }
    const firstRecord = userLog.find((item) => item.userName && item.userName.trim().length > 0);
    if (firstRecord?.userName) {
      return firstRecord.userName.trim();
    }
    if (decodedUserKey.startsWith('id-')) {
      return `Usuario #${decodedUserKey.replace('id-', '')}`;
    }
    return 'Operador';
  }, [queryName, userLog, decodedUserKey]);

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

    const chronological = [...userLog].sort(
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
  }, [userLog, monthRange]);

  const totalDurationMs = useMemo(
    () => monthlySessions.reduce((acc, session) => acc + session.durationMs, 0),
    [monthlySessions]
  );

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/control-horario')}>
        ← Volver al registro
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
      return;
    }

    setActiveTab('altas');
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
        });
        setApprovalEstadoId(payload.data.estadoId ? String(payload.data.estadoId) : '');
        setReviewCommentText('');
        setReviewCommentError(null);
        setReviewCommentInfo(null);
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

  const handleAltaSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setAltaSubmitting(true);
      setFlash(null);

      const requestPayload = {
        perfilValue: altaForm.perfilValue,
        nombres: altaForm.nombres.trim(),
        apellidos: altaForm.apellidos.trim(),
        telefono: altaForm.telefono.trim() || null,
        email: altaForm.email.trim() || null,
        tarifaEspecial: altaForm.tarifaEspecial,
        observacionTarifa: altaForm.observacionTarifa.trim() || null,
        cuil: altaForm.cuil.trim() || null,
        cbuAlias: altaForm.cbuAlias.trim() || null,
        pago: altaForm.pago ? Number(altaForm.pago) : null,
        combustible: altaForm.combustible,
        fechaAlta: altaForm.fechaAlta || null,
        patente: altaForm.patente.trim() || null,
        clienteId: altaForm.clienteId ? Number(altaForm.clienteId) : null,
        sucursalId: altaForm.sucursalId ? Number(altaForm.sucursalId) : null,
        agenteId: altaForm.agenteId ? Number(altaForm.agenteId) : null,
        agenteResponsableId: altaForm.agenteResponsableId ? Number(altaForm.agenteResponsableId) : null,
        unidadId: altaForm.unidadId ? Number(altaForm.unidadId) : null,
        estadoId: altaForm.estadoId ? Number(altaForm.estadoId) : null,
        observaciones: altaForm.observaciones.trim() || null,
        duenoNombre: altaForm.duenoNombre.trim() || null,
        duenoFechaNacimiento: altaForm.duenoFechaNacimiento || null,
        duenoEmail: altaForm.duenoEmail.trim() || null,
        duenoCuil: altaForm.duenoCuil.trim() || null,
        duenoCuilCobrador: altaForm.duenoCuilCobrador.trim() || null,
        duenoTelefono: altaForm.duenoTelefono.trim() || null,
        duenoObservaciones: altaForm.duenoObservaciones.trim() || null,
      };

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

      setAltaForm((prev) => ({
        ...prev,
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
        duenoTelefono: '',
        duenoObservaciones: '',
      }));
      setAltaAttachments([]);
      setAltaFilesVersion((value) => value + 1);
      setAltaDocumentType('');
      setAltaDocumentExpiry('');
      window.dispatchEvent(new CustomEvent('personal:updated'));
      handleGoToList();
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

  const handleReviewCommentSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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
                <td colSpan={9}>Cargando solicitudes...</td>
              </tr>
            ) : solicitudesError ? (
              <tr>
                <td colSpan={9} className="error-cell">
                  {solicitudesError}
                </td>
              </tr>
            ) : filteredSolicitudes.length === 0 ? (
              <tr>
                <td colSpan={9}>No hay solicitudes pendientes.</td>
              </tr>
            ) : (
              filteredSolicitudes.map((registro) => {
                const perfilLabel = perfilNames[registro.perfilValue ?? 0] ?? registro.perfil ?? '—';
                return (
                  <tr key={registro.id}>
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
          <div className="personal-section">
            <h3>Chofer</h3>
            <div className="form-grid">
              {renderAltaInput('Nombre completo', 'nombres', true)}
              {renderAltaInput('Correo electrónico', 'email', false, 'email')}
              {renderAltaInput('Teléfono', 'telefono', false, 'tel')}
              {renderAltaCheckbox('Tarifa especial', 'tarifaEspecial', 'Tiene tarifa especial')}
              {renderAltaInput('Observación tarifa', 'observacionTarifa')}
              {renderAltaInput('CUIL', 'cuil')}
              {renderAltaInput('CBU/Alias', 'cbuAlias')}
              {renderAltaCheckbox('Combustible', 'combustible', 'Cuenta corrientes combustible')}
              {renderAltaInput('Pago', 'pago', false, 'number')}
              {renderAltaInput('Fecha de alta', 'fechaAlta', false, 'date')}
              {renderAltaInput('Patente', 'patente')}
            </div>

            <h3>Dueño de la unidad</h3>
            <div className="form-grid">
              {renderAltaInput('Nombre completo (Dueño)', 'duenoNombre')}
              {renderAltaInput('Fecha de nacimiento', 'duenoFechaNacimiento', false, 'date')}
              {renderAltaInput('Correo (Dueño)', 'duenoEmail', false, 'email')}
              {renderAltaInput('CUIL (Dueño)', 'duenoCuil')}
              {renderAltaInput('CUIL cobrador', 'duenoCuilCobrador')}
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
                {reviewPersonaDetail.documents.length > 0 ? (
                  <ul className="file-list">
                    {reviewPersonaDetail.documents.map((documento) => {
                      const labelParts = [documento.tipoNombre ?? `Documento #${documento.id}`];
                      if (documento.nombre && documento.nombre !== labelParts[0]) {
                        labelParts.push(documento.nombre);
                      }
                      const label = labelParts.join(' – ');
                      return (
                        <li key={documento.id}>
                          {documento.downloadUrl ? (
                            <a href={documento.downloadUrl} target="_blank" rel="noopener noreferrer">
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
                ) : (
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

                <form className="review-comment-form" onSubmit={handleReviewCommentSubmit}>
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
                    <button type="submit" className="primary-action" disabled={reviewCommentSaving}>
                      {reviewCommentSaving ? 'Enviando...' : 'Enviar'}
                    </button>
                  </div>
                  {reviewCommentError ? (
                    <p className="form-info form-info--error">{reviewCommentError}</p>
                  ) : null}
                  {reviewCommentInfo ? (
                    <p className="form-info form-info--success">{reviewCommentInfo}</p>
                  ) : null}
                </form>
              </div>

              <div className="review-actions">
                <label className="input-control">
                  <span>Actualizar estado</span>
                  <select
                    value={approvalEstadoId}
                    onChange={(event) => setApprovalEstadoId(event.target.value)}
                    disabled={reviewPersonaDetail.aprobado || (meta?.estados?.length ?? 0) === 0}
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
                  disabled={approveLoading || reviewPersonaDetail.aprobado}
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

  const renderAltasTab = () => (
    <form className="approvals-form" onSubmit={handleAltaSubmit}>
      {renderReviewSection()}
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

      <div className="form-actions">
        <button type="button" className="secondary-action" onClick={() => navigate('/personal')}>
          Cancelar
        </button>
        <button type="submit" className="primary-action" disabled={altaSubmitting}>
          {altaSubmitting ? 'Enviando...' : 'Enviar solicitud'}
        </button>
      </div>
    </form>
  );

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

      setDetail(payload.data);
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
        setDetail(payload.data);
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
    if (!documento?.downloadUrl) {
      window.alert('Este documento no tiene una URL de descarga disponible.');
      return;
    }

    window.open(documento.downloadUrl, '_blank', 'noopener');
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
          <p>No hay historial disponible para este registro.</p>
        </div>
      </section>

      <section className="personal-edit-section">
        <h2>Documentos</h2>
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
      <Route path="/documentos" element={<DocumentTypesPage />} />
      <Route path="/documentos/nuevo" element={<DocumentTypeCreatePage />} />
      <Route path="/documentos/:tipoId/editar" element={<DocumentTypeEditPage />} />
      <Route path="/usuarios" element={<UsersPage />} />
      <Route path="/usuarios/nuevo" element={<CreateUserPage />} />
      <Route path="/usuarios/:usuarioId/editar" element={<EditUserPage />} />
      <Route path="/control-horario/:userKey" element={<AttendanceUserDetailPage />} />
      <Route path="/control-horario" element={<AttendanceLogPage />} />
      <Route path="/aprobaciones" element={<ApprovalsRequestsPage />} />
      <Route path="/clientes/nuevo" element={<CreateClientPage />} />
      <Route path="/clientes/:clienteId/editar" element={<EditClientPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
