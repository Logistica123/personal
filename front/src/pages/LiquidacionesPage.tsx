import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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

type PendingPersonalUpload = {
  id: string;
  file: File;
  typeId: number;
  typeName: string | null;
  fechaVencimiento: string | null;
  visualClient?: string | null;
  previewUrl?: string | null;
};

type PersonalDocumentType = {
  id: number;
  nombre: string | null;
  vence: boolean;
};

type PersonalDocument = {
  id: number;
  nombre: string | null;
  downloadUrl?: string | null;
  absoluteDownloadUrl?: string | null;
  mime?: string | null;
  size?: number | null;
  fechaCarga?: string | null;
  fechaCargaIso?: string | null;
  fechaVencimiento: string | null;
  tipoId?: number | null;
  tipoNombre?: string | null;
  requiereVencimiento?: boolean;
  parentDocumentId?: number | null;
  isAttachment?: boolean;
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
};

type PersonalDetail = {
  documents: PersonalDocument[];
  history?: any[];
  comments?: any[];
} & Record<string, any>;

type LiquidacionDocument = PersonalDocument;

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
  { value: '', label: 'Mes completo' },
  { value: 'MONTHLY', label: 'Liquidación mensual' },
  { value: 'Q1', label: 'Primera quincena' },
  { value: 'Q2', label: 'Segunda quincena' },
  { value: 'NO_DATE', label: 'Sin quincena' },
];

const LIQUIDACIONES_PERIOD_SELECTION_STORAGE_KEY = 'liquidaciones.periodSelection';
const LIQUIDACIONES_VISUAL_CLIENT_STORAGE_KEY = 'liquidaciones.visualClientByDocument';

type LiquidacionesPeriodSelection = { month: string; fortnight: string };

const resolveCurrentMonthSelection = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const resolveCurrentFortnightSelection = (): 'Q1' | 'Q2' => {
  const now = new Date();
  return now.getDate() <= 15 ? 'Q1' : 'Q2';
};

const readStoredLiquidacionesPeriodSelection = (): LiquidacionesPeriodSelection => {
  const fallback: LiquidacionesPeriodSelection = {
    month: resolveCurrentMonthSelection(),
    fortnight: resolveCurrentFortnightSelection(),
  };

  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(LIQUIDACIONES_PERIOD_SELECTION_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as { month?: unknown; fortnight?: unknown };
    const month = typeof parsed.month === 'string' && /^\d{4}-\d{2}$/.test(parsed.month) ? parsed.month : fallback.month;
    const fortnight =
      typeof parsed.fortnight === 'string' && ['Q1', 'Q2', 'MONTHLY'].includes(parsed.fortnight)
        ? parsed.fortnight
        : fallback.fortnight;

    return { month, fortnight };
  } catch {
    return fallback;
  }
};

const readStoredLiquidacionesVisualClient = (): Record<number, string> => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(LIQUIDACIONES_VISUAL_CLIENT_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<number, string> = {};
    Object.entries(parsed ?? {}).forEach(([key, value]) => {
      const numericKey = Number(key);
      const label = typeof value === 'string' ? value.trim() : '';
      if (!Number.isInteger(numericKey) || numericKey <= 0 || !label) {
        return;
      }
      next[numericKey] = label;
    });
    return next;
  } catch {
    return {};
  }
};

const writeStoredLiquidacionesVisualClient = (value: Record<number, string>) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const payload: Record<string, string> = {};
    Object.entries(value).forEach(([key, label]) => {
      const normalizedLabel = typeof label === 'string' ? label.trim() : '';
      if (!normalizedLabel) {
        return;
      }
      payload[String(key)] = normalizedLabel;
    });
    window.localStorage.setItem(LIQUIDACIONES_VISUAL_CLIENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
};

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

const getFuelStatusLabel = (status?: string | null, discounted?: boolean | null): string => {
  if (discounted || status === 'DISCOUNTED') {
    return 'Descontado';
  }
  if (!status) {
    return 'Pendiente';
  }
  if (status === 'PENDING') {
    return 'Pendiente';
  }
  if (status === 'PAID') {
    return 'Pagado';
  }
  if (status === 'OBSERVED') {
    return 'Observado';
  }
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

type LiquidacionesPageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  buildActorHeaders: (user: AuthUser | null) => Record<string, string> | null | undefined;
  resolveApiUrl: (baseUrl: string, target?: string | null) => string | null;
  parseJsonSafe: (response: Response) => Promise<any>;
  formatCurrency: (value: number | null | undefined) => string;
  formatPagoLabel: (value?: string | null) => string;
  getPerfilDisplayLabel: (value?: number | null, fallback?: string | null) => string;
  createImagePreviewUrl: (file: File) => string | null;
  revokeImagePreviewUrl: (url?: string | null) => void;
  readAuthTokenFromStorage: () => string | null;
  withAuthToken: (url: string | null) => string | null;
  PERSON_TAX_ID_LABEL: string;
  COLLECTOR_TAX_ID_LABEL: string;
  formatDateTime: (value?: string | null) => string;
};

export const LiquidacionesPage: React.FC<LiquidacionesPageProps> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  buildActorHeaders,
  resolveApiUrl,
  parseJsonSafe,
  formatCurrency,
  formatPagoLabel,
  getPerfilDisplayLabel,
  createImagePreviewUrl,
  revokeImagePreviewUrl,
  readAuthTokenFromStorage,
  withAuthToken,
  PERSON_TAX_ID_LABEL,
  COLLECTOR_TAX_ID_LABEL,
  formatDateTime,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { personaId: personaIdParam } = useParams<{ personaId?: string }>();
  const personaIdFromRoute = useMemo(() => {
    if (!personaIdParam) {
      return null;
    }
    const parsed = Number(personaIdParam);
    return Number.isNaN(parsed) ? null : parsed;
  }, [personaIdParam]);
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const authUser = useStoredAuthUser();
  const actorHeaders = useMemo(() => buildActorHeaders(authUser), [authUser]);
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
  const [liquidacionMonthFilter, setLiquidacionMonthFilter] = useState('');
  const [liquidacionFortnightFilter, setLiquidacionFortnightFilter] = useState('');
  const [liquidacionYearFilter, setLiquidacionYearFilter] = useState('');
  const [liquidacionImporteManual, setLiquidacionImporteManual] = useState('');
  const [liquidacionFortnightSelection, setLiquidacionFortnightSelection] = useState(
    () => readStoredLiquidacionesPeriodSelection().fortnight
  );
  const [liquidacionMonthSelection, setLiquidacionMonthSelection] = useState(
    () => readStoredLiquidacionesPeriodSelection().month
  );
  const [selectedPagadoIds, setSelectedPagadoIds] = useState<Set<number>>(() => new Set());
  const [selectedListPagadoIds, setSelectedListPagadoIds] = useState<Set<number>>(() => new Set());
  const [listImporteDrafts, setListImporteDrafts] = useState<Record<number, string>>({});
  const [listImporteSavingIds, setListImporteSavingIds] = useState<Set<number>>(() => new Set());
  const [selectedPersonaId, setSelectedPersonaId] = useState<number | null>(personaIdFromRoute);
  const [selectedLiquidacionPersonaIds, setSelectedLiquidacionPersonaIds] = useState<Set<number>>(() => new Set());
  const [liquidacionVisualClientInput, setLiquidacionVisualClientInput] = useState('');
  const [liquidacionVisualClientByDocId, setLiquidacionVisualClientByDocId] = useState<Record<number, string>>(
    () => readStoredLiquidacionesVisualClient()
  );
  const [liquidacionRecipientType, setLiquidacionRecipientType] = useState<'proveedor' | 'cobrador' | 'ambos'>('proveedor');
  const [detail, setDetail] = useState<PersonalDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [pendingUploads, setPendingUploads] = useState<PendingPersonalUpload[]>([]);
  const [fuelInvoiceUpload, setFuelInvoiceUpload] = useState<PendingPersonalUpload | null>(null);
  const [fuelUploading, setFuelUploading] = useState(false);
  const [showFuelPasteModal, setShowFuelPasteModal] = useState(false);
  const [fuelPasteError, setFuelPasteError] = useState<string | null>(null);
  const [fuelParentDocumentId, setFuelParentDocumentId] = useState<string>('');
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
  const [pagadoUpdating, setPagadoUpdating] = useState(false);
  const [listPagadoUpdating, setListPagadoUpdating] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [validationStatus, setValidationStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [fuelPreviewLoading, setFuelPreviewLoading] = useState(false);
  const [fuelPreviewError, setFuelPreviewError] = useState<string | null>(null);
  const [fuelPreviewApplying, setFuelPreviewApplying] = useState(false);
  const [fuelPreviewMessage, setFuelPreviewMessage] = useState<string | null>(null);
  const [fuelAdjustmentsApplying, setFuelAdjustmentsApplying] = useState(false);
  const [fuelAdjustmentsMessage, setFuelAdjustmentsMessage] = useState<string | null>(null);
  const [fuelPreview, setFuelPreview] = useState<{
    domain: string;
    dateFrom: string;
    dateTo: string;
    totalAmount: number;
    totalToBill: number;
    reportId: number | null;
    items: Array<{
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
    }>;
  } | null>(null);
  const [fuelSelection, setFuelSelection] = useState<Set<number>>(() => new Set());
  const [fuelAdjustmentType, setFuelAdjustmentType] = useState<
    'ajuste_favor' | 'cuota_combustible' | 'pendiente' | 'adelantos_prestamos' | 'credito' | 'debito' | 'poliza'
  >('ajuste_favor');
  const [fuelAdjustmentAmount, setFuelAdjustmentAmount] = useState('');
  const [fuelAdjustmentNote, setFuelAdjustmentNote] = useState('');
  const [fuelSelectionAdjustments, setFuelSelectionAdjustments] = useState<
    Array<{ id: string; type: string; amount: number; note: string }>
  >([]);
  const [fuelAdjustmentError, setFuelAdjustmentError] = useState<string | null>(null);
  const fuelAdjustmentTypeLabels: Record<string, string> = {
    ajuste_favor: 'Ajuste a favor',
    cuota_combustible: 'Cuota combustible',
    pendiente: 'Pendiente',
    adelantos_prestamos: 'Adelantos/Préstamos',
    credito: 'Crédito',
    debito: 'Débito',
    poliza: 'Póliza',
  };
  const fuelSelectedItems = useMemo(() => {
    if (!fuelPreview) {
      return [];
    }
    return fuelPreview.items.filter((item) => fuelSelection.has(item.id));
  }, [fuelPreview, fuelSelection]);
  const fuelSelectableIds = useMemo(() => {
    if (!fuelPreview) {
      return [];
    }
    return fuelPreview.items
      .filter((item) => {
        const isObserved = (item.status ?? '').toLowerCase().includes('observ');
        const isDiscounted = Boolean(item.discounted) || item.status === 'DISCOUNTED';
        return !isObserved && !isDiscounted;
      })
      .map((item) => item.id);
  }, [fuelPreview]);
  const fuelSelectableSelectedCount = useMemo(() => {
    if (!fuelSelectableIds.length) {
      return 0;
    }
    let count = 0;
    fuelSelectableIds.forEach((id) => {
      if (fuelSelection.has(id)) {
        count += 1;
      }
    });
    return count;
  }, [fuelSelectableIds, fuelSelection]);
  const fuelAllSelected = fuelSelectableIds.length > 0 && fuelSelectableSelectedCount === fuelSelectableIds.length;
  const fuelSomeSelected = fuelSelectableSelectedCount > 0 && !fuelAllSelected;
  useEffect(() => {
    if (!fuelSelectAllRef.current) {
      return;
    }
    fuelSelectAllRef.current.indeterminate = fuelSomeSelected;
  }, [fuelSomeSelected]);
  const fuelSelectedTotal = useMemo(
    () => fuelSelectedItems.reduce((sum, item) => sum + (item.amount ?? 0), 0),
    [fuelSelectedItems]
  );
  const fuelSelectionAdjustmentsTotal = useMemo(() => {
    if (!fuelSelectionAdjustments.length) {
      return 0;
    }
    const negativeTypes = new Set(['pendiente', 'cuota_combustible', 'adelantos_prestamos', 'debito', 'poliza']);
    return fuelSelectionAdjustments.reduce((sum, adj) => {
      if (!Number.isFinite(adj.amount)) {
        return sum;
      }
      return sum + (negativeTypes.has(adj.type) ? -adj.amount : adj.amount);
    }, 0);
  }, [fuelSelectionAdjustments]);
  const fuelSelectedTotalWithAdjustments = useMemo(
    () => fuelSelectedTotal + fuelSelectionAdjustmentsTotal,
    [fuelSelectedTotal, fuelSelectionAdjustmentsTotal]
  );
  const fuelSelectedCount = fuelSelectedItems.length;
  const [deletingDocumentIds, setDeletingDocumentIds] = useState<Set<number>>(() => new Set());
  const [documentTypes, setDocumentTypes] = useState<PersonalDocumentType[]>([]);
  const [documentTypesLoading, setDocumentTypesLoading] = useState(true);
  const [documentTypesError, setDocumentTypesError] = useState<string | null>(null);
  const [selectedDocumentTypeId, setSelectedDocumentTypeId] = useState('');
  const [documentExpiry, setDocumentExpiry] = useState('');
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const pasteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fuelPreviewDocIdRef = useRef<string | null>(null);
  const fuelSelectAllRef = useRef<HTMLInputElement | null>(null);
  const isPagosView = useMemo(() => location.pathname.startsWith('/pagos'), [location.pathname]);
  const [showPagosColumnPicker, setShowPagosColumnPicker] = useState(false);
  const [showLiquidacionesColumnPicker, setShowLiquidacionesColumnPicker] = useState(false);
  const pagosColumnsStorageKey = 'pagos.visibleColumns';
  const liquidacionesColumnsStorageKey = 'liquidaciones.visibleColumns';
  const liquidacionesSortModeStorageKey = 'liquidaciones.sortMode';
  const pagosColumnOptions = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'nombre', label: 'Nombre' },
      { key: 'cuil', label: PERSON_TAX_ID_LABEL },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'email', label: 'Email' },
      { key: 'cbuAlias', label: 'CBU' },
      { key: 'cobradorCbuAlias', label: 'CBU cobrador' },
      { key: 'cobradorCuil', label: COLLECTOR_TAX_ID_LABEL },
      { key: 'perfil', label: 'Perfil' },
      { key: 'agente', label: 'Agente' },
      { key: 'estado', label: 'Estado' },
      { key: 'combustible', label: 'Combustible' },
      { key: 'tarifaEspecial', label: 'Tarifa especial' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'unidad', label: 'Unidad' },
      { key: 'sucursal', label: 'Sucursal' },
      { key: 'fechaAlta', label: 'Fecha alta' },
      { key: 'importeFacturar', label: 'Importe a facturar' },
      { key: 'enviada', label: 'Enviada' },
      { key: 'facturado', label: 'Facturado' },
      { key: 'pagado', label: 'Pagado' },
      { key: 'acciones', label: 'Acciones', locked: true },
    ],
    []
  );
  const liquidacionesColumnOptions = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'nombre', label: 'Nombre' },
      { key: 'cuil', label: PERSON_TAX_ID_LABEL },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'email', label: 'Email' },
      { key: 'cbuAlias', label: 'CBU' },
      { key: 'cobradorCbuAlias', label: 'CBU cobrador' },
      { key: 'cobradorCuil', label: COLLECTOR_TAX_ID_LABEL },
      { key: 'perfil', label: 'Perfil' },
      { key: 'agente', label: 'Agente' },
      { key: 'estado', label: 'Estado' },
      { key: 'combustible', label: 'Combustible' },
      { key: 'tarifaEspecial', label: 'Tarifa especial' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'unidad', label: 'Unidad' },
      { key: 'sucursal', label: 'Sucursal' },
      { key: 'fechaAlta', label: 'Fecha alta' },
      { key: 'importeFacturar', label: 'Importe a facturar' },
      { key: 'importeFacturarConDescuento', label: 'Importe a facturar con descuento' },
      { key: 'combustibleResumen', label: 'Resumen combustible' },
      { key: 'enviada', label: 'Enviada' },
      { key: 'facturado', label: 'Facturado' },
      { key: 'pagado', label: 'Pagado' },
      { key: 'acciones', label: 'Acciones', locked: true },
    ],
    []
  );
  const [visiblePagosColumns, setVisiblePagosColumns] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    let stored: Record<string, boolean> | null = null;
    try {
      const raw = localStorage.getItem(pagosColumnsStorageKey);
      stored = raw ? (JSON.parse(raw) as Record<string, boolean>) : null;
    } catch (error) {
      stored = null;
    }
    pagosColumnOptions.forEach((column) => {
      initial[column.key] = stored?.[column.key] ?? true;
    });
    return initial;
  });
  const [visibleLiquidacionesColumns, setVisibleLiquidacionesColumns] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    let stored: Record<string, boolean> | null = null;
    try {
      const raw = localStorage.getItem(liquidacionesColumnsStorageKey);
      stored = raw ? (JSON.parse(raw) as Record<string, boolean>) : null;
    } catch (error) {
      stored = null;
    }
    liquidacionesColumnOptions.forEach((column) => {
      initial[column.key] = stored?.[column.key] ?? true;
    });
    return initial;
  });
  const [liquidacionesSortMode, setLiquidacionesSortMode] = useState<'importe-first' | 'default'>(() => {
    try {
      const stored = localStorage.getItem(liquidacionesSortModeStorageKey);
      return stored === 'default' ? 'default' : 'importe-first';
    } catch (error) {
      return 'importe-first';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(pagosColumnsStorageKey, JSON.stringify(visiblePagosColumns));
    } catch (error) {
      // ignore storage failures (private mode, quota, etc)
    }
  }, [pagosColumnsStorageKey, visiblePagosColumns]);
  useEffect(() => {
    try {
      localStorage.setItem(liquidacionesColumnsStorageKey, JSON.stringify(visibleLiquidacionesColumns));
    } catch (error) {
      // ignore storage failures (private mode, quota, etc)
    }
  }, [liquidacionesColumnsStorageKey, visibleLiquidacionesColumns]);
  useEffect(() => {
    try {
      localStorage.setItem(liquidacionesSortModeStorageKey, liquidacionesSortMode);
    } catch (error) {
      // ignore storage failures (private mode, quota, etc)
    }
  }, [liquidacionesSortMode, liquidacionesSortModeStorageKey]);
  const isPagosColumnVisible = useCallback(
    (key: string) => (isPagosView ? visiblePagosColumns[key] !== false : true),
    [isPagosView, visiblePagosColumns]
  );
  const listVisibleColumnCount = useMemo(() => {
    if (!isPagosView) {
      return liquidacionesColumnOptions.filter((column) => visibleLiquidacionesColumns[column.key] !== false).length;
    }
    return pagosColumnOptions.filter((column) => visiblePagosColumns[column.key] !== false).length;
  }, [
    isPagosView,
    liquidacionesColumnOptions,
    visibleLiquidacionesColumns,
    pagosColumnOptions,
    visiblePagosColumns,
  ]);
  const listTableColumnCount = listVisibleColumnCount + (isPagosView ? 0 : 1);
  const isListColumnVisible = useCallback(
    (key: string) =>
      isPagosView ? visiblePagosColumns[key] !== false : visibleLiquidacionesColumns[key] !== false,
    [isPagosView, visiblePagosColumns, visibleLiquidacionesColumns]
  );
  useEffect(() => {
    setLiquidacionMonthFilter('');
    setLiquidacionFortnightFilter('');
    setLiquidacionYearFilter('');
    setDeletingDocumentIds(new Set<number>());
    setSelectedPagadoIds(new Set<number>());
  }, [selectedPersonaId]);

  useEffect(() => {
    setLiquidacionRecipientType('ambos');
  }, [selectedPersonaId]);

  useEffect(() => {
    setSelectedLiquidacionPersonaIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }

      const validIds = new Set(personal.map((registro) => registro.id));
      const next = new Set<number>();
      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        }
      });
      return next.size === prev.size ? prev : next;
    });
  }, [personal]);

  useEffect(() => {
    if (showPasteModal) {
      setPasteError(null);
      window.setTimeout(() => {
        pasteTextareaRef.current?.focus();
      }, 0);
    }
  }, [showPasteModal]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        LIQUIDACIONES_PERIOD_SELECTION_STORAGE_KEY,
        JSON.stringify({
          month: liquidacionMonthSelection,
          fortnight: liquidacionFortnightSelection,
        })
      );
    } catch {
      // ignore storage failures (private mode, quota, etc)
    }
  }, [liquidacionMonthSelection, liquidacionFortnightSelection]);

  useEffect(() => {
    writeStoredLiquidacionesVisualClient(liquidacionVisualClientByDocId);
  }, [liquidacionVisualClientByDocId]);

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
  const liquidacionTypeOptions = useMemo(() => {
    return documentTypes.filter((tipo) => (tipo.nombre ?? '').toLowerCase().includes('liquid'));
  }, [documentTypes]);
  const defaultLiquidacionType = useMemo(() => {
    if (liquidacionTypeOptions.length === 0) {
      return null;
    }

    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[_\s]+/g, ' ')
        .trim()
        .toLowerCase();

    const exact = liquidacionTypeOptions.find((tipo) => normalize(tipo.nombre ?? '') === 'liquidacion');
    return exact ?? liquidacionTypeOptions[0];
  }, [liquidacionTypeOptions]);
  const liquidacionType = useMemo(() => {
    return defaultLiquidacionType ?? null;
  }, [defaultLiquidacionType]);
  const fuelInvoiceType = useMemo(() => {
    return documentTypes.find((tipo) => (tipo.nombre ?? '').toLowerCase().includes('combustible')) ?? null;
  }, [documentTypes]);
  const isFuelDocument = useCallback((doc: PersonalDetail['documents'][number]) => {
    const typeName = (doc.tipoNombre ?? doc.nombre ?? '').toLowerCase();
    return typeName.includes('combust');
  }, []);
  const isLiquidacionDocument = useCallback((doc: PersonalDetail['documents'][number]) => {
    const typeName = (doc.tipoNombre ?? doc.nombre ?? '').toLowerCase();
    return typeName.includes('liquid');
  }, []);
  const requiresFuelInvoice = useMemo(() => {
    if (detail && typeof detail.combustibleValue === 'boolean') {
      return detail.combustibleValue;
    }
    const label = detail?.combustible ?? '';
    return label.toLowerCase() === 'si';
  }, [detail]);
  const hasUnlinkedFuelInvoice = useMemo(() => {
    if (!detail?.documents) {
      return false;
    }

    return detail.documents.some((doc) => {
      const looksFuel = isFuelDocument(doc);
      const isAttachment = doc.isAttachment ?? (doc.parentDocumentId !== null && doc.parentDocumentId !== undefined);
      return looksFuel && !isAttachment;
    });
  }, [detail, isFuelDocument]);
  const hasStoredFuelInvoice = useMemo(() => {
    if (!detail?.documents) {
      return false;
    }
    return detail.documents.some((doc) => isFuelDocument(doc));
  }, [detail, isFuelDocument]);
  const hasPendingStoredDocuments = useMemo(() => {
    if (!detail?.documents) {
      return false;
    }
    return detail.documents.some(
      (doc) => (doc.pendiente ?? false) && (isLiquidacionDocument(doc) || isFuelDocument(doc))
    );
  }, [detail, isFuelDocument, isLiquidacionDocument]);
  const canPublishPending = hasPendingStoredDocuments;
  const canSubmitUploads = pendingUploads.length > 0;
  const hasAnyUploadTarget = canSubmitUploads || canPublishPending;
  const hasFuelDataForSubmit =
    hasStoredFuelInvoice ||
    (fuelInvoiceUpload && (fuelParentDocumentId.trim() !== '' || canSubmitUploads));
  const isPdfFile = useCallback((file: File) => {
    if (file.type === 'application/pdf') {
      return true;
    }
    return file.name.toLowerCase().endsWith('.pdf');
  }, []);

  const buildValidationStatus = useCallback(
    (
      payload: {
        data?: {
          estado?: string;
          decision_mensaje?: string | null;
          validaciones?: Array<{ regla?: string; resultado?: boolean; mensaje?: string | null }>;
        };
      },
      okMessage: string
    ): { type: 'success' | 'error'; message: string } => {
      const estado = payload?.data?.estado ?? 'rechazada';
      const decisionMessage = payload?.data?.decision_mensaje ?? null;
      const validations = Array.isArray(payload?.data?.validaciones) ? payload?.data?.validaciones ?? [] : [];
      const failedMessages = validations
        .filter((validation) => validation?.resultado === false && validation?.mensaje)
        .map((validation) => validation?.mensaje)
        .filter((message): message is string => Boolean(message));

      if (estado === 'aprobada') {
        if (failedMessages.length > 0) {
          return {
            type: 'error',
            message: `Validación automática: ${failedMessages.join(' | ')}.`,
          };
        }
        return { type: 'success', message: okMessage };
      }

      return {
        type: 'error',
        message: decisionMessage ?? 'La validación automática fue rechazada.',
      };
    },
    []
  );

  const shouldSuppressLiquidacionValidationError = useCallback((message?: string | null): boolean => {
    const normalized = (message ?? '').trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    return [
      'patente asociada',
      'cuil',
      'cbu',
      'importe facturado es incorrecto',
      'tesseract',
      'tessdata',
      'traineddata',
      'pixreadstream',
      'failed loading language',
      'error opening data file',
    ].some((token) => normalized.includes(token));
  }, []);

  const resolveValidationFeedback = useCallback(
    (
      status: { type: 'success' | 'error'; message: string } | null,
      fallbackSuccessMessage: string
    ): {
      visibleValidation: { type: 'success' | 'error'; message: string } | null;
      uploadFeedback: { type: 'success' | 'error'; message: string };
    } => {
      if (!status) {
        return {
          visibleValidation: null,
          uploadFeedback: { type: 'success', message: fallbackSuccessMessage },
        };
      }

      if (status.type === 'error' && shouldSuppressLiquidacionValidationError(status.message)) {
        return {
          visibleValidation: null,
          uploadFeedback: { type: 'success', message: fallbackSuccessMessage },
        };
      }

      return {
        visibleValidation: status,
        uploadFeedback: status,
      };
    },
    [shouldSuppressLiquidacionValidationError]
  );

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

  const normalizeRecipientEmail = useCallback((value?: string | null): string | null => {
    const normalized = (value ?? '').trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }, []);

  const normalizeDomainValue = useCallback((value?: string | null): string => {
    if (!value) {
      return '';
    }
    return value
      .toUpperCase()
      .replace(/[\s\.\-]+/g, '')
      .trim();
  }, []);

  const getLiquidacionNetTotal = useCallback((group: LiquidacionGroup) => {
    const rawBase = group.main.importeFacturar ?? null;
    if (rawBase == null) {
      return null;
    }
    const parseAmount = (value: string | number | null | undefined) => {
      if (value === null || value === undefined || value === '') {
        return null;
      }
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
      }
      const cleaned = String(value)
        .replace(/[^0-9,\-\.]/g, '')
        .replace(/\.(?=\d{3}\b)/g, '')
        .replace(',', '.');
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const base = parseAmount(rawBase);
    if (Number.isNaN(base)) {
      return null;
    }
    if (base == null) {
      return null;
    }
    const adjustmentTotal = group.attachments.reduce((sum, doc) => {
      const parsed = parseAmount(doc.importeFacturar);
      return sum + (parsed ?? 0);
    }, 0);
    return base + adjustmentTotal;
  }, []);

  const resolveFuelRange = useCallback(
    (monthKey?: string | null, fortnightKey?: string | null) => {
      if (!monthKey || monthKey === 'unknown') {
        return null;
      }
      const [yearPart, monthPart] = monthKey.split('-');
      const year = Number(yearPart);
      const monthIndex = Number(monthPart) - 1;
      if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
        return null;
      }
      const firstDay = new Date(year, monthIndex, 1);
      const lastDay = new Date(year, monthIndex + 1, 0);
      const toIso = (date: Date) => date.toISOString().slice(0, 10);
      const key = fortnightKey ?? '';
      if (key === 'Q1') {
        return { from: toIso(firstDay), to: toIso(new Date(year, monthIndex, 15)) };
      }
      if (key === 'Q2') {
        return { from: toIso(new Date(year, monthIndex, 16)), to: toIso(lastDay) };
      }
      return { from: toIso(firstDay), to: toIso(lastDay) };
    },
    []
  );

  const handlePreviewFuelDiscount = useCallback(
    (doc: LiquidacionDocument) => {
      const domain = normalizeDomainValue(detail?.patente ?? null);
      if (!domain) {
        setFuelPreview(null);
        setFuelSelection(new Set());
        setFuelPreviewError(null);
        setFuelPreviewMessage(null);
        return;
      }
      const selectedRange = resolveFuelRange(liquidacionMonthSelection, liquidacionFortnightSelection);
      const documentRange = resolveFuelRange(doc.monthKey, doc.fortnightKey);
      const labelRange = selectedRange ?? documentRange;
      const requestDocId = String(doc.id ?? '');
      setFuelPreviewLoading(true);
      setFuelPreviewError(null);
      setFuelPreviewMessage(null);
      setFuelPreview(null);
      setFuelSelectionAdjustments([]);
      setFuelAdjustmentError(null);
      const fetchAllPages = async () => {
        const items: Array<{
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
        }> = [];

        let page = 1;
        let hasNextPage = true;
        let totalPages: number | null = null;

        while (hasNextPage) {
          const url = new URL(`${apiBaseUrl}/api/combustible/consumos`);
          url.searchParams.set('domain', domain);
          url.searchParams.set('only_pending', '1');
          url.searchParams.set('per_page', '500');
          url.searchParams.set('page', String(page));

          const response = await fetch(url.toString(), { credentials: 'include' });
          if (!response.ok) {
            const payload = await parseJsonSafe(response).catch(() => null);
            throw new Error(payload?.message ?? `No se pudo cargar el consumo (${response.status}).`);
          }

          const payload = await parseJsonSafe(response);
          const pageItems = Array.isArray(payload?.data) ? payload.data : [];
          items.push(...pageItems);

          const pagination = payload?.pagination ?? null;
          hasNextPage = Boolean(pagination?.has_next_page);
          totalPages =
            typeof pagination?.total_pages === 'number' ? (pagination.total_pages as number) : totalPages;

          page += 1;
          if (totalPages !== null && page > totalPages) {
            break;
          }
          if (page > 50) {
            break;
          }
        }

        return items;
      };

      fetchAllPages()
        .then((mergedItems) => {
          if (fuelPreviewDocIdRef.current !== requestDocId) {
            return;
          }
          const totalAmount = mergedItems.reduce((sum: number, item) => sum + (item.amount ?? 0), 0);
          const selectedIds = mergedItems
            .filter((item) => item.status !== 'OBSERVED')
            .filter((item) => {
              if (!labelRange) {
                return true;
              }
              const dateValue = item.occurred_at ? item.occurred_at.slice(0, 10) : null;
              if (!dateValue) {
                return false;
              }
              return dateValue >= labelRange.from && dateValue <= labelRange.to;
            })
            .map((item) => item.id);
          setFuelSelection(new Set(selectedIds));
          const dateValues = mergedItems
            .map((item) => item.occurred_at)
            .filter((value): value is string => Boolean(value))
            .map((value) => value.slice(0, 10))
            .sort();
          const dateFrom = labelRange?.from ?? dateValues[0] ?? '—';
          const dateTo = labelRange?.to ?? dateValues[dateValues.length - 1] ?? '—';
          setFuelPreview({
            domain,
            dateFrom,
            dateTo,
            totalAmount,
            totalToBill: totalAmount,
            reportId: null,
            items: mergedItems,
          });
        })
        .catch((err) => {
          if (fuelPreviewDocIdRef.current !== requestDocId) {
            return;
          }
          setFuelPreviewError(err instanceof Error ? err.message : 'No se pudo calcular el descuento.');
          setFuelPreview(null);
        })
        .finally(() => {
          if (fuelPreviewDocIdRef.current !== requestDocId) {
            return;
          }
          setFuelPreviewLoading(false);
        });
    },
    [
      detail?.patente,
      apiBaseUrl,
      liquidacionMonthSelection,
      liquidacionFortnightSelection,
      normalizeDomainValue,
      resolveFuelRange,
    ]
  );

  const handleAddFuelSelectionAdjustment = useCallback(() => {
    setFuelAdjustmentError(null);
    const parsed = Number(
      fuelAdjustmentAmount
        .toString()
        .replace(/[^0-9,\-\.]/g, '')
        .replace(/\.(?=\d{3}\b)/g, '')
        .replace(',', '.')
    );
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setFuelAdjustmentError('Ingresá un importe válido.');
      return;
    }
    setFuelSelectionAdjustments((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: fuelAdjustmentType,
        amount: parsed,
        note: fuelAdjustmentNote.trim(),
      },
    ]);
    setFuelAdjustmentAmount('');
    setFuelAdjustmentNote('');
  }, [fuelAdjustmentAmount, fuelAdjustmentNote, fuelAdjustmentType]);

  const handleRemoveFuelSelectionAdjustment = useCallback((id: string) => {
    setFuelSelectionAdjustments((prev) => prev.filter((adj) => adj.id !== id));
  }, []);

  const renderLiquidacionStatus = (value?: boolean | null) => {
    if (value === null || value === undefined) {
      return <span className="status-badge status-badge--liquidacion is-unknown">—</span>;
    }
    return (
      <span className={`status-badge status-badge--liquidacion ${value ? 'is-yes' : 'is-no'}`}>
        {value ? 'Sí' : 'No'}
      </span>
    );
  };

  const renderAiValidationStatus = (documento: LiquidacionDocument) => {
    const estado = (documento.validacionIaEstado ?? '').toLowerCase();
    if (!estado) {
      return <span className="status-badge status-badge--liquidacion is-unknown">—</span>;
    }

    const message = documento.validacionIaMensaje ?? documento.validacionIaMotivo ?? '';
    const label = estado === 'aprobada' ? 'Aprobada' : 'Rechazada';
    const className = estado === 'aprobada' ? 'is-yes' : 'is-no';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <span className={`status-badge status-badge--liquidacion ${className}`} title={message}>
          {label}
        </span>
        {message ? (
          <span style={{ fontSize: '0.75rem', color: '#5c667a' }}>{message}</span>
        ) : null}
      </div>
    );
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

        const response = await fetch(`${apiBaseUrl}/api/personal/${selectedPersonaId}?includePending=1`, {
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

  const handleApplyFuelSelectionAdjustments = useCallback(async () => {
    setFuelAdjustmentError(null);
    setFuelAdjustmentsMessage(null);
    if (!fuelParentDocumentId) {
      setFuelAdjustmentError('Seleccioná la liquidación destino.');
      return;
    }
    if (fuelSelectionAdjustments.length === 0) {
      setFuelAdjustmentError('Agregá al menos un ajuste.');
      return;
    }
    const personaId = selectedPersonaId ? Number(selectedPersonaId) : null;
    if (!personaId) {
      setFuelAdjustmentError('No se pudo determinar el personal.');
      return;
    }
    setFuelAdjustmentsApplying(true);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/personal/${personaId}/liquidaciones/${fuelParentDocumentId}/ajustes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            adjustments: fuelSelectionAdjustments.map((adj) => ({
              type: adj.type,
              amount: adj.amount,
              note: adj.note || null,
            })),
          }),
        }
      );
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? 'No se pudieron guardar los ajustes.');
      }
      setFuelAdjustmentsMessage('Ajustes guardados correctamente.');
      setFuelSelectionAdjustments([]);
      setFuelAdjustmentAmount('');
      setFuelAdjustmentNote('');
      refreshPersonaDetail({ silent: true });
    } catch (err) {
      setFuelAdjustmentError(err instanceof Error ? err.message : 'No se pudieron guardar los ajustes.');
    } finally {
      setFuelAdjustmentsApplying(false);
    }
  }, [
    apiBaseUrl,
    fuelParentDocumentId,
    fuelSelectionAdjustments,
    refreshPersonaDetail,
    selectedPersonaId,
  ]);

  const handleApplyFuelPreview = useCallback(async () => {
    if (!fuelPreview) {
      setFuelPreviewError('Primero calculá el descuento de combustible.');
      return;
    }
    if (fuelSelection.size === 0) {
      setFuelPreviewError('Seleccioná al menos un consumo para descontar.');
      return;
    }
    if (!fuelParentDocumentId) {
      setFuelPreviewError('Seleccioná la liquidación destino.');
      return;
    }
    if (fuelSelectedTotalWithAdjustments <= 0) {
      setFuelPreviewError('El total a facturar debe ser mayor a cero.');
      return;
    }
    setFuelPreviewApplying(true);
    setFuelPreviewError(null);
    setFuelPreviewMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/combustible/reportes/seleccion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      body: JSON.stringify({
        movement_ids: Array.from(fuelSelection),
        liquidacion_id: Number(fuelParentDocumentId),
      }),
    });
      if (!response.ok) {
        const payload = await parseJsonSafe(response).catch(() => null);
        throw new Error(payload?.message ?? 'No se pudo aplicar el descuento.');
      }
      setFuelPreviewMessage('Descuento aplicado correctamente.');
      setFuelPreview((prev) => {
        if (!prev) {
          return prev;
        }
        const selectedIds = new Set(fuelSelection);
        return {
          ...prev,
          items: prev.items.map((item) =>
            selectedIds.has(item.id)
              ? {
                  ...item,
                  status: 'DISCOUNTED',
                  discounted: true,
                }
              : item
          ),
        };
      });
      setFuelSelection(new Set());
      setFuelSelectionAdjustments([]);
      setFuelAdjustmentNote('');
      setFuelAdjustmentAmount('');
      refreshPersonaDetail({ silent: true });
    } catch (err) {
      setFuelPreviewError(err instanceof Error ? err.message : 'No se pudo aplicar el descuento.');
    } finally {
      setFuelPreviewApplying(false);
    }
  }, [
    apiBaseUrl,
    fuelPreview,
    fuelSelection,
    fuelParentDocumentId,
    fuelSelectedTotalWithAdjustments,
    fuelSelectionAdjustments,
    refreshPersonaDetail,
  ]);

  const toggleFuelSelectAll = useCallback(() => {
    setFuelSelection((prev) => {
      const next = new Set(prev);
      if (fuelSelectableIds.length === 0) {
        return next;
      }
      const allSelected = fuelSelectableIds.every((id) => next.has(id));
      if (allSelected) {
        fuelSelectableIds.forEach((id) => next.delete(id));
      } else {
        fuelSelectableIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [fuelSelectableIds]);

  const listRecords = useMemo(() => {
    if (!isPagosView) {
      return personal;
    }

    return personal.flatMap((registro) => {
      const liquidaciones = registro.liquidaciones ?? [];
      if (liquidaciones.length === 0) {
        return [];
      }

      return liquidaciones.map((liquidacion) => ({
        ...registro,
        rowId: `${registro.id}-${liquidacion.id}`,
        liquidacionIdLatest: liquidacion.id,
        liquidacionEnviada: liquidacion.enviada ?? null,
        liquidacionRecibido: liquidacion.recibido ?? null,
        liquidacionPagado: liquidacion.pagado ?? null,
        liquidacionImporteFacturar: liquidacion.importeFacturar ?? null,
        liquidacionPeriods:
          liquidacion.monthKey && liquidacion.fortnightKey
            ? [{ monthKey: liquidacion.monthKey, fortnightKey: liquidacion.fortnightKey }]
            : [],
      }));
    });
  }, [isPagosView, personal]);

  useEffect(() => {
    setListImporteDrafts((prev) => {
      if (Object.keys(prev).length === 0) {
        return prev;
      }
      const validIds = new Set(
        listRecords
          .map((registro) => (typeof registro.liquidacionIdLatest === 'number' ? registro.liquidacionIdLatest : null))
          .filter((id): id is number => typeof id === 'number')
      );
      let changed = false;
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([rawId, value]) => {
        const id = Number(rawId);
        if (validIds.has(id)) {
          next[id] = value;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [listRecords]);

  const normalizeListImporteDraft = useCallback((rawValue: string): { valid: boolean; value: number | null } => {
    const trimmed = rawValue.trim();
    if (trimmed === '') {
      return { valid: true, value: null };
    }
    const normalized = trimmed
      .replace(/\s+/g, '')
      .replace(/[^0-9,\-\.]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { valid: false, value: null };
    }
    return { valid: true, value: parsed };
  }, []);

  const getListImporteInputValue = useCallback(
    (registro: PersonalRecord): string => {
      const liquidacionId = registro.liquidacionIdLatest;
      if (typeof liquidacionId !== 'number') {
        return '';
      }
      const draft = listImporteDrafts[liquidacionId];
      if (typeof draft === 'string') {
        return draft;
      }
      if (registro.liquidacionImporteFacturar == null) {
        return '';
      }
      return String(registro.liquidacionImporteFacturar);
    },
    [listImporteDrafts]
  );

  const handleListImporteDraftChange = useCallback((liquidacionId: number, value: string) => {
    setListImporteDrafts((prev) => {
      if (prev[liquidacionId] === value) {
        return prev;
      }
      return { ...prev, [liquidacionId]: value };
    });
  }, []);

  const updateListImporteLocalState = useCallback((personaId: number, liquidacionId: number, importe: number | null) => {
    setPersonal((prev) =>
      prev.map((registro) => {
        if (registro.id !== personaId) {
          return registro;
        }
        const updatedLiquidaciones = registro.liquidaciones
          ? registro.liquidaciones.map((liquidacion) =>
              liquidacion.id === liquidacionId ? { ...liquidacion, importeFacturar: importe } : liquidacion
            )
          : registro.liquidaciones;

        return {
          ...registro,
          liquidacionImporteFacturar:
            registro.liquidacionIdLatest === liquidacionId ? importe : registro.liquidacionImporteFacturar,
          liquidaciones: updatedLiquidaciones,
        };
      })
    );
  }, []);

  const handleSaveListImporte = useCallback(
    async (registro: PersonalRecord) => {
      if (isPagosView) {
        return;
      }
      const liquidacionId = registro.liquidacionIdLatest;
      if (typeof liquidacionId !== 'number') {
        return;
      }
      const draftValue = listImporteDrafts[liquidacionId];
      if (draftValue === undefined) {
        return;
      }

      const normalized = normalizeListImporteDraft(draftValue);
      if (!normalized.valid) {
        setUploadStatus({ type: 'error', message: 'Ingresá un importe válido (mayor o igual a 0).' });
        return;
      }

      const currentValue = registro.liquidacionImporteFacturar ?? null;
      const nextValue = normalized.value;
      const unchanged =
        (currentValue == null && nextValue == null) ||
        (currentValue != null && nextValue != null && Math.abs(currentValue - nextValue) < 0.000001);

      if (unchanged) {
        setListImporteDrafts((prev) => {
          if (!(liquidacionId in prev)) {
            return prev;
          }
          const next = { ...prev };
          delete next[liquidacionId];
          return next;
        });
        return;
      }

      try {
        setListImporteSavingIds((prev) => {
          const next = new Set(prev);
          next.add(liquidacionId);
          return next;
        });
        setUploadStatus(null);

        const token = readAuthTokenFromStorage();
        const headers: Record<string, string> = {
          ...actorHeaders,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${apiBaseUrl}/api/personal/${registro.id}/documentos/${liquidacionId}`, {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify({ importeFacturar: nextValue }),
        });

        if (!response.ok) {
          let message = `Error ${response.status}: ${response.statusText}`;
          try {
            const payload = await parseJsonSafe(response);
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

        updateListImporteLocalState(registro.id, liquidacionId, nextValue);
        setListImporteDrafts((prev) => {
          if (!(liquidacionId in prev)) {
            return prev;
          }
          const next = { ...prev };
          delete next[liquidacionId];
          return next;
        });
        setUploadStatus({ type: 'success', message: 'Importe a facturar actualizado correctamente.' });
      } catch (err) {
        setUploadStatus({
          type: 'error',
          message: (err as Error).message ?? 'No se pudo actualizar el importe a facturar.',
        });
      } finally {
        setListImporteSavingIds((prev) => {
          const next = new Set(prev);
          next.delete(liquidacionId);
          return next;
        });
      }
    },
    [actorHeaders, apiBaseUrl, isPagosView, listImporteDrafts, normalizeListImporteDraft, updateListImporteLocalState]
  );

  const handleListImporteKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>, registro: PersonalRecord) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.currentTarget.blur();
        return;
      }
      if (event.key === 'Escape') {
        const liquidacionId = registro.liquidacionIdLatest;
        if (typeof liquidacionId === 'number') {
          setListImporteDrafts((prev) => {
            if (!(liquidacionId in prev)) {
              return prev;
            }
            const next = { ...prev };
            delete next[liquidacionId];
            return next;
          });
        }
        event.currentTarget.blur();
      }
    },
    []
  );

  const selectedPersonalRecord = useMemo(
    () => personal.find((registro) => registro.id === selectedPersonaId) ?? null,
    [personal, selectedPersonaId]
  );

  const importeFacturarBase = useMemo(() => {
    if (liquidacionImporteManual.trim() !== '') {
      const parsed = Number(liquidacionImporteManual.replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return selectedPersonalRecord?.liquidacionImporteFacturar ?? null;
  }, [liquidacionImporteManual, selectedPersonalRecord]);

  const pagosMonthChips = useMemo(() => {
    if (!isPagosView) {
      return [] as Array<{ key: string; label: string; count: number }>;
    }

    const counts = new Map<string, number>();
    listRecords.forEach((registro) => {
      const periods = registro.liquidacionPeriods ?? [];
      periods.forEach((period) => {
        const monthKey = period.monthKey;
        if (!monthKey || monthKey === 'unknown') {
          return;
        }
        counts.set(monthKey, (counts.get(monthKey) ?? 0) + 1);
      });
    });

    const formatter = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });
    const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

    return Array.from(counts.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, count]) => {
        const parsed = new Date(`${key}-01T00:00:00`);
        const label = Number.isNaN(parsed.getTime()) ? key : capitalize(formatter.format(parsed));
        return { key, label, count };
      });
  }, [isPagosView, listRecords]);

  const updateListPagadoStatus = useCallback(
    async (pagado: boolean) => {
      if (selectedListPagadoIds.size === 0) {
        return;
      }

      try {
        setListPagadoUpdating(true);
        setUploadStatus(null);

        const token = readAuthTokenFromStorage();
        const baseHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        };
        if (token) {
          baseHeaders.Authorization = `Bearer ${token}`;
        }

        const targets = Array.from(selectedListPagadoIds)
          .map((docId) => {
            const record = listRecords.find((item) => item.liquidacionIdLatest === docId);
            return record ? { personaId: record.id, documentId: docId } : null;
          })
          .filter((item): item is { personaId: number; documentId: number } => item !== null);

        if (targets.length === 0) {
          throw new Error('No se pudieron resolver las liquidaciones seleccionadas.');
        }

        for (const target of targets) {
          const response = await fetch(`${apiBaseUrl}/api/personal/${target.personaId}/documentos/pagado`, {
            method: 'POST',
            headers: baseHeaders,
            credentials: 'include',
            body: JSON.stringify({ documentIds: [target.documentId], pagado }),
          });

          if (!response.ok) {
            let message = `Error ${response.status}: ${response.statusText}`;
            try {
              const payload = await parseJsonSafe(response);
              if (typeof payload?.message === 'string') {
                message = payload.message;
              }
            } catch {
              // ignore
            }
            throw new Error(message);
          }
        }

        setUploadStatus({
          type: 'success',
          message: pagado ? 'Pagos marcados correctamente.' : 'Pagos desmarcados correctamente.',
        });
        setSelectedListPagadoIds(new Set());
        await fetchPersonal();
      } catch (err) {
        setUploadStatus({
          type: 'error',
          message: (err as Error).message ?? 'No se pudo actualizar el estado de pago.',
        });
      } finally {
        setListPagadoUpdating(false);
      }
    },
    [apiBaseUrl, actorHeaders, fetchPersonal, listRecords, selectedListPagadoIds]
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

    if (!fuelPreview) {
      autoRefreshRef.current = setInterval(() => {
        refreshPersonaDetail({ silent: true });
      }, 15000);
    }

    return () => {
      controller.abort();
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [refreshPersonaDetail, selectedPersonaId, fuelPreview]);

  useEffect(() => {
    if (documentTypes.length === 0) {
      setSelectedDocumentTypeId('');
      return;
    }

    if (defaultLiquidacionType) {
      const isSelectedLiquidacionType = liquidacionTypeOptions.some(
        (tipo) => String(tipo.id) === selectedDocumentTypeId
      );
      if (!isSelectedLiquidacionType) {
        setSelectedDocumentTypeId(String(defaultLiquidacionType.id));
      }
      return;
    }

    const alreadySelected = documentTypes.some((tipo) => String(tipo.id) === selectedDocumentTypeId);
    if (!alreadySelected) {
      setSelectedDocumentTypeId(String(documentTypes[0].id));
    }
  }, [defaultLiquidacionType, documentTypes, liquidacionTypeOptions, selectedDocumentTypeId]);

  const perfilNames: Record<number, string> = useMemo(
    () => ({
      1: getPerfilDisplayLabel(1),
      2: getPerfilDisplayLabel(2),
      3: getPerfilDisplayLabel(3),
    }),
    []
  );


  const filteredPersonal = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const monthMatches = (monthKey: string): boolean => {
      if (!liquidacionMonthFilter) {
        return true;
      }

      if (liquidacionMonthFilter === 'unknown') {
        return monthKey === 'unknown';
      }

      const normalizedFilter = liquidacionMonthFilter.trim();

      if (/^\d{4}-\d{2}$/.test(normalizedFilter)) {
        return monthKey === normalizedFilter;
      }

      if (/^\d{2}$/.test(normalizedFilter)) {
        if (monthKey === 'unknown') {
          return false;
        }
        const monthPart = monthKey.slice(-2);
        return monthPart === normalizedFilter;
      }

      return monthKey === normalizedFilter;
    };

    const fortnightMatches = (fortnightKey: string): boolean => {
      if (!liquidacionFortnightFilter) {
        return true;
      }
      return fortnightKey === liquidacionFortnightFilter;
    };

    const filtered = listRecords.filter((registro) => {
      if (isPagosView) {
        const pagoValue = parsePagoFlag(registro.pago);
        const pagoFlag =
          pagoValue === true ||
          registro.liquidacionPagado === true ||
          registro.liquidacionRecibido === true ||
          registro.liquidacionEnviada === true;
        if (!pagoFlag) {
          return false;
        }
      }
      const liquidacionId = typeof registro.liquidacionIdLatest === 'number' ? registro.liquidacionIdLatest : null;
      const visualClient = liquidacionId ? liquidacionVisualClientByDocId[liquidacionId] : null;
      const effectiveClientLabel =
        (typeof visualClient === 'string' && visualClient.trim().length > 0 ? visualClient.trim() : null)
        ?? registro.cliente;
      if (clienteFilter && effectiveClientLabel !== clienteFilter) {
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

      if (liquidacionMonthFilter || liquidacionFortnightFilter) {
        const periods = registro.liquidacionPeriods ?? [];
        const matchesPeriod = periods.some((period) => monthMatches(period.monthKey) && fortnightMatches(period.fortnightKey));
        if (!matchesPeriod) {
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
        effectiveClientLabel,
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
        formatPagoLabel(registro.pago),
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

    if (isPagosView || liquidacionesSortMode === 'default') {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      const aHasImporte = a.liquidacionImporteFacturar !== null && a.liquidacionImporteFacturar !== undefined;
      const bHasImporte = b.liquidacionImporteFacturar !== null && b.liquidacionImporteFacturar !== undefined;
      if (aHasImporte === bHasImporte) {
        return 0;
      }
      return aHasImporte ? -1 : 1;
    });
  }, [
    listRecords,
    searchTerm,
    isPagosView,
    clienteFilter,
    sucursalFilter,
    perfilFilter,
    agenteFilter,
    unidadFilter,
    estadoFilter,
    combustibleFilter,
    tarifaFilter,
    liquidacionMonthFilter,
    liquidacionFortnightFilter,
    liquidacionesSortMode,
    perfilNames,
    liquidacionVisualClientByDocId,
  ]);

  const handleExportPagos = useCallback(() => {
    const dataset = filteredPersonal.length > 0 ? filteredPersonal : listRecords;

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
      { header: PERSON_TAX_ID_LABEL, resolve: (registro) => registro.cuil ?? '' },
      { header: 'Teléfono', resolve: (registro) => registro.telefono ?? '' },
      { header: 'Email', resolve: (registro) => registro.email ?? '' },
      { header: 'Perfil', resolve: (registro) => getPerfilDisplayLabel(registro.perfilValue ?? null, registro.perfil ?? '') },
      { header: 'Agente', resolve: (registro) => registro.agente ?? '' },
      { header: 'Estado', resolve: (registro) => registro.estado ?? '' },
      {
        header: 'Cliente',
        resolve: (registro) => {
          const liquidacionId = typeof registro.liquidacionIdLatest === 'number' ? registro.liquidacionIdLatest : null;
          const visualClient = liquidacionId ? liquidacionVisualClientByDocId[liquidacionId] : null;
          return (typeof visualClient === 'string' && visualClient.trim().length > 0 ? visualClient.trim() : null)
            ?? registro.cliente
            ?? '';
        },
      },
      { header: 'Unidad', resolve: (registro) => registro.unidad ?? '' },
      { header: 'Sucursal', resolve: (registro) => registro.sucursal ?? '' },
      { header: 'Fecha alta', resolve: (registro) => registro.fechaAlta ?? '' },
      { header: 'Enviada', resolve: (registro) => booleanLabel(registro.liquidacionEnviada ?? null) },
      { header: 'Facturado', resolve: (registro) => booleanLabel(registro.liquidacionRecibido ?? null) },
      { header: 'Pagado', resolve: (registro) => booleanLabel(registro.liquidacionPagado ?? null) },
      { header: 'Liquidación ID', resolve: (registro) => registro.liquidacionIdLatest ?? '' },
    ];

    const sanitizeCell = (raw: string): string => {
      const cleaned = raw.replace(/[\t\r\n]+/g, ' ').trim();
      if (/^\d+$/.test(cleaned) && (cleaned.length >= 10 || cleaned.startsWith('0'))) {
        return `\u2060${cleaned}`;
      }
      return cleaned;
    };

    const rows = dataset.map((registro) =>
      columns.map((column) => {
        const value = column.resolve(registro);
        const text = value === null || value === undefined ? '' : String(value);
        return sanitizeCell(text);
      })
    );

    const headerRow = columns.map((column) => column.header);
    const tsv = [headerRow, ...rows].map((row) => row.join('\t')).join('\n');

    const BOM = '\ufeff';
    const blob = new Blob([BOM + tsv], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pagos-${Date.now()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredPersonal, liquidacionVisualClientByDocId, listRecords]);

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

  const visibleListPagadoIds = useMemo(
    () =>
      pageRecords
        .map((registro) => (typeof registro.liquidacionIdLatest === 'number' ? registro.liquidacionIdLatest : null))
        .filter((id): id is number => typeof id === 'number'),
    [pageRecords]
  );

  useEffect(() => {
    setSelectedListPagadoIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      const visibleSet = new Set(visibleListPagadoIds);
      const next = new Set<number>();
      prev.forEach((id) => {
        if (visibleSet.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [visibleListPagadoIds]);

  const toggleListPagadoSelection = useCallback((id: number) => {
    setSelectedListPagadoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleListPagadoSelectAll = useCallback(() => {
    setSelectedListPagadoIds((prev) => {
      if (visibleListPagadoIds.length === 0) {
        return prev;
      }
      const next = new Set(prev);
      const allSelected = visibleListPagadoIds.every((id) => next.has(id));
      if (allSelected) {
        visibleListPagadoIds.forEach((id) => next.delete(id));
        return next;
      }
      visibleListPagadoIds.forEach((id) => next.add(id));
      return next;
    });
  }, [visibleListPagadoIds]);

  const allListPagadoSelected =
    visibleListPagadoIds.length > 0 && visibleListPagadoIds.every((id) => selectedListPagadoIds.has(id));

  const visibleLiquidacionPersonaIds = useMemo(() => {
    if (isPagosView) {
      return [] as number[];
    }

    const ids: number[] = [];
    const seen = new Set<number>();
    pageRecords.forEach((registro) => {
      if (!seen.has(registro.id)) {
        seen.add(registro.id);
        ids.push(registro.id);
      }
    });
    return ids;
  }, [isPagosView, pageRecords]);

  const allVisibleLiquidacionSelected =
    visibleLiquidacionPersonaIds.length > 0 &&
    visibleLiquidacionPersonaIds.every((id) => selectedLiquidacionPersonaIds.has(id));

  const selectedLiquidacionQueueIds = useMemo(() => {
    if (selectedLiquidacionPersonaIds.size === 0 || isPagosView) {
      return [] as number[];
    }

    const selected = selectedLiquidacionPersonaIds;
    const ordered = filteredPersonal
      .map((registro) => registro.id)
      .filter((id, index, source) => source.indexOf(id) === index)
      .filter((id) => selected.has(id));

    if (ordered.length === selected.size) {
      return ordered;
    }

    const missing = Array.from(selected).filter((id) => !ordered.includes(id));
    return [...ordered, ...missing];
  }, [filteredPersonal, isPagosView, selectedLiquidacionPersonaIds]);

  const selectedLiquidacionQueueRecords = useMemo(() => {
    if (selectedLiquidacionQueueIds.length === 0) {
      return [] as PersonalRecord[];
    }

    const byId = new Map<number, PersonalRecord>();
    listRecords.forEach((registro) => {
      if (!byId.has(registro.id)) {
        byId.set(registro.id, registro);
      }
    });
    personal.forEach((registro) => {
      if (!byId.has(registro.id)) {
        byId.set(registro.id, registro);
      }
    });

    return selectedLiquidacionQueueIds
      .map((id) => byId.get(id) ?? null)
      .filter((registro): registro is PersonalRecord => Boolean(registro));
  }, [listRecords, personal, selectedLiquidacionQueueIds]);

  const selectedLiquidacionQueuePreview = useMemo(() => {
    const names = selectedLiquidacionQueueRecords
      .map((registro) => registro.nombre ?? `ID ${registro.id}`)
      .filter((value) => value.trim().length > 0);

    if (names.length === 0) {
      return {
        compact: '',
        full: '',
      };
    }

    if (names.length <= 2) {
      const label = `Lista: ${names.join(' · ')}`;
      return {
        compact: label,
        full: label,
      };
    }

    return {
      compact: `Lista: ${names[0]} · ${names[1]} +${names.length - 2} más`,
      full: `Lista: ${names.join(' · ')}`,
    };
  }, [selectedLiquidacionQueueRecords]);

  const currentLiquidacionQueueIndex = useMemo(() => {
    if (!selectedPersonaId || selectedLiquidacionQueueIds.length === 0) {
      return -1;
    }
    return selectedLiquidacionQueueIds.indexOf(selectedPersonaId);
  }, [selectedLiquidacionQueueIds, selectedPersonaId]);

  const nextLiquidacionQueuePersonaId =
    currentLiquidacionQueueIndex >= 0
      ? selectedLiquidacionQueueIds[currentLiquidacionQueueIndex + 1] ?? null
      : null;

  const toggleLiquidacionPersonaSelection = useCallback((personaId: number) => {
    setSelectedLiquidacionPersonaIds((prev) => {
      const next = new Set(prev);
      if (next.has(personaId)) {
        next.delete(personaId);
      } else {
        next.add(personaId);
      }
      return next;
    });
  }, []);

  const toggleVisibleLiquidacionSelection = useCallback(() => {
    if (visibleLiquidacionPersonaIds.length === 0) {
      return;
    }

    setSelectedLiquidacionPersonaIds((prev) => {
      const next = new Set(prev);
      const allSelected = visibleLiquidacionPersonaIds.every((id) => next.has(id));
      if (allSelected) {
        visibleLiquidacionPersonaIds.forEach((id) => next.delete(id));
      } else {
        visibleLiquidacionPersonaIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [visibleLiquidacionPersonaIds]);

  const clearLiquidacionQueueSelection = useCallback(() => {
    setSelectedLiquidacionPersonaIds(new Set());
  }, []);

  const normalizeVisualClientLabel = useCallback((value?: string | null): string | null => {
    const normalized = (value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }, []);

  const resolveRecordVisualClient = useCallback(
    (registro: PersonalRecord): string | null => {
      const liquidacionId = typeof registro.liquidacionIdLatest === 'number' ? registro.liquidacionIdLatest : null;
      if (!liquidacionId) {
        return null;
      }
      const mapped = liquidacionVisualClientByDocId[liquidacionId];
      return typeof mapped === 'string' && mapped.trim().length > 0 ? mapped.trim() : null;
    },
    [liquidacionVisualClientByDocId]
  );

  const applyVisualClientToDocument = useCallback(
    (documentId: number | null | undefined, label?: string | null) => {
      const normalizedLabel = normalizeVisualClientLabel(label);
      if (!documentId || !Number.isInteger(documentId)) {
        return;
      }

      setLiquidacionVisualClientByDocId((prev) => {
        const currentValue = prev[documentId];
        if (!normalizedLabel) {
          if (!currentValue) {
            return prev;
          }
          const next = { ...prev };
          delete next[documentId];
          return next;
        }

        if (currentValue === normalizedLabel) {
          return prev;
        }
        return {
          ...prev,
          [documentId]: normalizedLabel,
        };
      });
    },
    [normalizeVisualClientLabel]
  );

  const clienteOptions = useMemo(() => {
    const baseClients = personal
      .map((registro) => registro.cliente)
      .filter((value): value is string => Boolean(value));
    const visualClients = listRecords
      .map((registro) => resolveRecordVisualClient(registro))
      .filter((value): value is string => Boolean(value));

    return Array.from(new Set([...baseClients, ...visualClients])).sort();
  }, [listRecords, personal, resolveRecordVisualClient]);
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

    if (filteredPersonal.length === listRecords.length) {
      return `Mostrando ${listRecords.length} registro${listRecords.length === 1 ? '' : 's'}`;
    }

    return `Mostrando ${filteredPersonal.length} de ${listRecords.length} registros`;
  }, [loading, error, filteredPersonal.length, listRecords.length]);

  const allLiquidacionDocuments = useMemo(() => {
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

    const isRelevant = (doc: PersonalDetail['documents'][number]) =>
      isLiquidacionDocument(doc) || isFuelDocument(doc);

    const mainIds = new Set(
      normalised
        .filter((doc) => isRelevant(doc) && !doc.isAttachment)
        .map((doc) => doc.id)
    );

    return normalised.filter((doc) => {
      if (isRelevant(doc)) {
        return true;
      }
      return doc.isAttachment && doc.parentDocumentId !== null && mainIds.has(doc.parentDocumentId);
    });
  }, [detail, isFuelDocument, isLiquidacionDocument]);

  const visibleLiquidacionDocuments = useMemo(
    () => allLiquidacionDocuments.filter((doc) => !(doc.pendiente ?? false)),
    [allLiquidacionDocuments]
  );

  const buildLiquidacionGroups = useCallback((documents: LiquidacionDocument[]) => {
    if (documents.length === 0) {
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

    documents.forEach((doc) => {
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
  }, []);

  const liquidacionGroups = useMemo(
    () => buildLiquidacionGroups(visibleLiquidacionDocuments),
    [buildLiquidacionGroups, visibleLiquidacionDocuments]
  );

  const liquidacionGroupsForSelect = useMemo(
    () => buildLiquidacionGroups(allLiquidacionDocuments),
    [buildLiquidacionGroups, allLiquidacionDocuments]
  );

  const getDefaultLiquidacionGroup = useCallback((groups: LiquidacionGroup[]) => {
    if (groups.length === 0) {
      return null;
    }
    const liquidacion = groups.find((group) =>
      (group.main.tipoNombre ?? '').toLowerCase().includes('liquidación')
    );
    return liquidacion ?? groups.find((group) => !group.main.isAttachment) ?? groups[0];
  }, []);

  const selectedLiquidacionGroup = useMemo(() => {
    if (fuelParentDocumentId) {
      return (
        liquidacionGroupsForSelect.find(
          (group) => String(group.main.id ?? '') === String(fuelParentDocumentId)
        ) ?? null
      );
    }
    return getDefaultLiquidacionGroup(liquidacionGroupsForSelect);
  }, [fuelParentDocumentId, getDefaultLiquidacionGroup, liquidacionGroupsForSelect]);

  const importeFacturarConDescuento = useMemo(() => {
    if (selectedLiquidacionGroup) {
      const netTotal = getLiquidacionNetTotal(selectedLiquidacionGroup);
      if (netTotal != null) {
        return netTotal;
      }
    }
    if (importeFacturarBase == null) {
      return null;
    }
    const descuento = selectedPersonalRecord?.combustibleResumen?.totalToBill ?? null;
    if (descuento == null) {
      return null;
    }
    return importeFacturarBase - descuento;
  }, [getLiquidacionNetTotal, importeFacturarBase, selectedLiquidacionGroup, selectedPersonalRecord]);

  const liquidacionFortnightSections = useMemo(() => {
    if (liquidacionGroups.length === 0) {
      return [] as LiquidacionFortnightSection[];
    }

    const monthFormatter = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });
    const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
    const normalizeMonthKey = (raw?: string | null): string | null => {
      if (!raw || raw === 'unknown') {
        return null;
      }
      return /^\d{4}-\d{2}$/.test(raw) ? raw : null;
    };
    const normalizeFortnightKey = (raw?: string | null): 'Q1' | 'Q2' | 'MONTHLY' | 'NO_DATE' | null => {
      if (raw === 'Q1' || raw === 'Q2' || raw === 'MONTHLY' || raw === 'NO_DATE') {
        return raw;
      }
      return null;
    };
    const parseCalendarDate = (raw?: string | null): { year: number; month: number; day: number } | null => {
      if (!raw) {
        return null;
      }

      const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        if (
          Number.isFinite(year) &&
          Number.isFinite(month) &&
          Number.isFinite(day) &&
          month >= 1 &&
          month <= 12 &&
          day >= 1 &&
          day <= 31
        ) {
          return { year, month, day };
        }
      }

      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }
      return {
        year: parsed.getFullYear(),
        month: parsed.getMonth() + 1,
        day: parsed.getDate(),
      };
    };
    const monthLabelFromKey = (monthKey: string): string => {
      const [yearPart, monthPart] = monthKey.split('-');
      const year = Number(yearPart);
      const month = Number(monthPart);
      if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        return 'Sin fecha';
      }
      return capitalize(monthFormatter.format(new Date(year, month - 1, 1)));
    };
    const fortnightLabelFromKey = (key: 'Q1' | 'Q2' | 'MONTHLY' | 'NO_DATE'): string => {
      switch (key) {
        case 'MONTHLY':
          return 'Liquidación mensual';
        case 'Q1':
          return 'Primera quincena (1-15)';
        case 'Q2':
          return 'Segunda quincena (16-fin)';
        case 'NO_DATE':
        default:
          return 'Sin fecha definida';
      }
    };

    const monthMap = new Map<
      string,
      {
        monthKey: string;
        monthLabel: string;
        sections: Map<string, { key: string; label: string; rows: LiquidacionGroup[] }>;
      }
    >();

    const getDateFromGroup = (group: LiquidacionGroup): { year: number; month: number; day: number } | null => {
      const source = group.main;
      return (
        parseCalendarDate(source.fechaVencimiento)
        ?? parseCalendarDate(source.fechaCargaIso)
        ?? parseCalendarDate(source.fechaCarga)
      );
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
      const explicitMonthKey = normalizeMonthKey(group.main.monthKey);
      const monthKey = explicitMonthKey ?? (date ? `${date.year}-${String(date.month).padStart(2, '0')}` : 'unknown');
      const monthLabel = monthKey === 'unknown' ? 'Sin fecha' : monthLabelFromKey(monthKey);

      const normalizedTypeName = (
        (group.main.tipoNombre ?? '') + (group.main.nombre ?? '')
      ).toLowerCase();
      const isMonthlyDocument = normalizedTypeName.includes('mensual');
      const explicitFortnightKey = normalizeFortnightKey(group.main.fortnightKey);

      const quincenaKey = explicitFortnightKey
        ?? (isMonthlyDocument
          ? 'MONTHLY'
          : date
            ? date.day <= 15
              ? 'Q1'
              : 'Q2'
            : 'NO_DATE');
      const quincenaLabel = fortnightLabelFromKey(quincenaKey);

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
        case 'MONTHLY':
          return 0;
        case 'Q1':
          return 1;
        case 'Q2':
          return 2;
        case 'NO_DATE':
          return 3;
        default:
          return 4;
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

  useEffect(() => {
    if (fuelParentDocumentId && fuelParentDocumentId !== '') {
      return;
    }
    const defaultGroup = getDefaultLiquidacionGroup(liquidacionGroupsForSelect);
    const firstMain = defaultGroup?.main?.id ?? null;
    if (firstMain) {
      setFuelParentDocumentId(String(firstMain));
    }
  }, [fuelParentDocumentId, getDefaultLiquidacionGroup, liquidacionGroupsForSelect]);

  const selectedFuelDocument = useMemo(() => {
    if (fuelParentDocumentId) {
      return (
        liquidacionGroupsForSelect.find(
          (group) => String(group.main.id ?? '') === String(fuelParentDocumentId)
        )?.main ?? null
      );
    }
    return getDefaultLiquidacionGroup(liquidacionGroupsForSelect)?.main ?? null;
  }, [fuelParentDocumentId, getDefaultLiquidacionGroup, liquidacionGroupsForSelect]);

  useEffect(() => {
    if (!selectedFuelDocument) {
      setFuelPreview(null);
      fuelPreviewDocIdRef.current = null;
      return;
    }
    const nextDocId = String(selectedFuelDocument.id ?? '');
    if (fuelPreview && fuelPreviewDocIdRef.current === nextDocId) {
      return;
    }
    fuelPreviewDocIdRef.current = nextDocId;
    handlePreviewFuelDiscount(selectedFuelDocument);
  }, [selectedFuelDocument, handlePreviewFuelDiscount, fuelPreview]);

  const liquidacionYearOptions = useMemo(() => {
    const years = new Set<string>();
    let hasUnknown = false;

    liquidacionFortnightSections.forEach((section) => {
      if (section.monthKey === 'unknown') {
        hasUnknown = true;
        return;
      }
      const [year] = section.monthKey.split('-');
      if (year) {
        years.add(year);
      }
    });

    const sortedYears = Array.from(years).sort((a, b) => b.localeCompare(a));
    const options = [
      { value: '', label: 'Todos los años' },
      ...sortedYears.map((year) => ({ value: year, label: year })),
    ];
    if (hasUnknown) {
      options.push({ value: 'unknown', label: 'Sin fecha' });
    }

    return options;
  }, [liquidacionFortnightSections]);

  const liquidacionFortnightOptions = useMemo(() => {
    const hasNoDateSection = liquidacionFortnightSections.some((month) =>
      month.sections.some((section) => section.key === 'NO_DATE')
    );

    const hasMonthlySection = liquidacionFortnightSections.some((month) =>
      month.sections.some((section) => section.key === 'MONTHLY')
    );

    return FORTNIGHT_FILTER_OPTIONS.filter((option) => {
      if (option.value === 'NO_DATE') {
        return hasNoDateSection;
      }
      if (option.value === 'MONTHLY') {
        return hasMonthlySection;
      }
      return true;
    });
  }, [liquidacionFortnightSections]);

  const importeFacturarFinal = useMemo(() => {
    if (importeFacturarConDescuento != null) {
      return importeFacturarConDescuento;
    }
    if (liquidacionImporteManual.trim() !== '') {
      const parsed = Number(liquidacionImporteManual.replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }, [importeFacturarConDescuento, liquidacionImporteManual]);

  const resolveFilteredTargetDate = useCallback((): string | null => {
    if (!liquidacionMonthFilter || liquidacionMonthFilter === 'unknown') {
      return null;
    }

    let year: number | null = null;
    let month: number | null = null;

    if (/^\d{4}-\d{2}$/.test(liquidacionMonthFilter)) {
      year = Number(liquidacionMonthFilter.slice(0, 4));
      month = Number(liquidacionMonthFilter.slice(5));
    } else if (/^\d{2}$/.test(liquidacionMonthFilter)) {
      month = Number(liquidacionMonthFilter);
    }

    if (!month || Number.isNaN(month)) {
      return null;
    }

    if (year === null && liquidacionYearFilter) {
      if (liquidacionYearFilter === 'unknown') {
        return null;
      }
      const parsedYear = Number(liquidacionYearFilter);
      if (!Number.isNaN(parsedYear)) {
        year = parsedYear;
      }
    }

    if (year === null) {
      year = new Date().getFullYear();
    }

    if (Number.isNaN(year) || month < 1 || month > 12) {
      return null;
    }

    let day: number;
    if (liquidacionFortnightFilter === 'Q2' || liquidacionFortnightFilter === 'MONTHLY') {
      day = new Date(year, month, 0).getDate();
    } else if (liquidacionFortnightFilter === 'Q1') {
      day = 15;
    } else {
      day = 1;
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }, [liquidacionFortnightFilter, liquidacionMonthFilter, liquidacionYearFilter]);

  const filteredLiquidacionSections = useMemo(() => {
    if (liquidacionFortnightSections.length === 0) {
      return [] as LiquidacionFortnightSection[];
    }

    const matchesYear = (monthSection: LiquidacionFortnightSection): boolean => {
      if (!liquidacionYearFilter) {
        return true;
      }

      if (liquidacionYearFilter === 'unknown') {
        return monthSection.monthKey === 'unknown';
      }

      if (monthSection.monthKey === 'unknown') {
        return false;
      }

      const yearPart = monthSection.monthKey.slice(0, 4);
      return /^\d{4}$/.test(yearPart) && yearPart === liquidacionYearFilter;
    };

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
      .filter((monthSection) => matchesYear(monthSection) && matchesMonth(monthSection))
      .map((monthSection) => {
        const filteredSections = monthSection.sections.filter((section) => matchesFortnight(section.key));

        return {
          ...monthSection,
          sections: filteredSections,
        };
      })
      .filter((monthSection) => monthSection.sections.length > 0);
  }, [liquidacionFortnightSections, liquidacionMonthFilter, liquidacionFortnightFilter, liquidacionYearFilter]);

  const visibleMainLiquidacionIds = useMemo(() => {
    const ids: number[] = [];
    filteredLiquidacionSections.forEach((section) => {
      section.sections.forEach((subsection) => {
        subsection.rows.forEach((group) => {
          if (typeof group.main.id === 'number') {
            ids.push(group.main.id);
          }
        });
      });
    });
    return ids;
  }, [filteredLiquidacionSections]);

  useEffect(() => {
    setSelectedPagadoIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      const visibleSet = new Set(visibleMainLiquidacionIds);
      const next = new Set<number>();
      prev.forEach((id) => {
        if (visibleSet.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [visibleMainLiquidacionIds]);

  const togglePagadoSelection = useCallback((id: number) => {
    setSelectedPagadoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const togglePagadoSelectAll = useCallback(() => {
    setSelectedPagadoIds((prev) => {
      if (visibleMainLiquidacionIds.length === 0) {
        return prev;
      }
      const next = new Set(prev);
      const allSelected = visibleMainLiquidacionIds.every((id) => next.has(id));
      if (allSelected) {
        visibleMainLiquidacionIds.forEach((id) => next.delete(id));
        return next;
      }
      visibleMainLiquidacionIds.forEach((id) => next.add(id));
      return next;
    });
  }, [visibleMainLiquidacionIds]);

  const updatePagadoStatus = useCallback(
    async (pagado: boolean) => {
      if (!selectedPersonaId || selectedPagadoIds.size === 0) {
        return;
      }

      try {
        setPagadoUpdating(true);
        setUploadStatus(null);

        const response = await fetch(`${apiBaseUrl}/api/personal/${selectedPersonaId}/documentos/pagado`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            documentIds: Array.from(selectedPagadoIds),
            pagado,
          }),
        });

        if (!response.ok) {
          let message = `Error ${response.status}: ${response.statusText}`;
          try {
            const payload = await parseJsonSafe(response);
            if (typeof payload?.message === 'string') {
              message = payload.message;
            }
          } catch {
            // ignore
          }
          throw new Error(message);
        }

        setUploadStatus({
          type: 'success',
          message: pagado ? 'Liquidaciones marcadas como pagadas.' : 'Pagos desmarcados correctamente.',
        });
        setSelectedPagadoIds(new Set());
        refreshPersonaDetail({ silent: true });
      } catch (err) {
        setUploadStatus({
          type: 'error',
          message: (err as Error).message ?? 'No se pudo actualizar el estado de pago.',
        });
      } finally {
        setPagadoUpdating(false);
      }
    },
    [apiBaseUrl, refreshPersonaDetail, selectedPagadoIds, selectedPersonaId]
  );

  const allPagadoSelected =
    visibleMainLiquidacionIds.length > 0 &&
    visibleMainLiquidacionIds.every((id) => selectedPagadoIds.has(id));

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
    setFuelInvoiceUpload((prev) => {
      if (prev?.previewUrl) {
        revokeImagePreviewUrl(prev.previewUrl);
      }
      return null;
    });
    pendingPreviewUrlsRef.current = [];
    closePreviewModal();
    setLiquidacionVisualClientInput('');
  }, [closePreviewModal]);

  const openQueuedPersona = useCallback(
    (personaId: number) => {
      setSelectedPersonaId(personaId);
      clearPendingUploads();
      setUploadStatus(null);
      setDocumentExpiry('');
      navigate(`/liquidaciones/${personaId}`);
    },
    [clearPendingUploads, navigate]
  );

  const advanceToNextQueuedPersona = useCallback(
    (actionLabel: 'guardada' | 'subida') => {
      if (isPagosView || !selectedPersonaId || selectedLiquidacionQueueIds.length === 0) {
        return false;
      }

      const currentIndex = selectedLiquidacionQueueIds.indexOf(selectedPersonaId);
      if (currentIndex === -1) {
        return false;
      }

      const nextId = selectedLiquidacionQueueIds[currentIndex + 1] ?? null;
      const nextRecord = nextId != null
        ? selectedLiquidacionQueueRecords.find((record) => record.id === nextId) ?? null
        : null;

      setSelectedLiquidacionPersonaIds((prev) => {
        if (!prev.has(selectedPersonaId)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(selectedPersonaId);
        return next;
      });

      if (nextId != null) {
        openQueuedPersona(nextId);
        setUploadStatus({
          type: 'success',
          message: `Liquidación ${actionLabel} correctamente. Se abrió el siguiente marcado: ${nextRecord?.nombre ?? `ID ${nextId}`}.`,
        });
      } else {
        setSelectedPersonaId(null);
        setDetail(null);
        setDetailError(null);
        clearPendingUploads();
        setDocumentExpiry('');
        navigate('/liquidaciones');
        setUploadStatus({
          type: 'success',
          message: `Liquidación ${actionLabel} correctamente. Lote completado.`,
        });
      }

      return true;
    },
    [
      clearPendingUploads,
      isPagosView,
      navigate,
      openQueuedPersona,
      selectedLiquidacionQueueIds,
      selectedLiquidacionQueueRecords,
      selectedPersonaId,
    ]
  );

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
    const effectiveTypeId = Number(selectedDocumentTypeId);
    if (!effectiveTypeId || Number.isNaN(effectiveTypeId)) {
      return { ok: false, message: 'No se pudo determinar el tipo de documento para la liquidación.' };
    }

    const targetDate = resolveFilteredTargetDate();
    if (tipo?.vence && !documentExpiry && !targetDate) {
      return { ok: false, message: 'Este tipo de documento requiere fecha de vencimiento.' };
    }

    const fechaVencimiento = targetDate ?? (tipo?.vence ? documentExpiry || null : null);
    const visualClient = normalizeVisualClientLabel(liquidacionVisualClientInput);

    const uploads: PendingPersonalUpload[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      typeId: effectiveTypeId,
      typeName: tipo?.nombre ?? null,
      fechaVencimiento,
      visualClient,
      previewUrl: createImagePreviewUrl(file),
    }));

    return { ok: true, uploads };
  },
    [
      selectedPersonaId,
      selectedDocumentTypeId,
      selectedDocumentType,
      documentExpiry,
      liquidacionVisualClientInput,
      normalizeVisualClientLabel,
      resolveFilteredTargetDate,
    ]
  );

  const prepareFuelInvoiceFromFiles = useCallback(
    (files: File[]): { ok: true; upload: PendingPersonalUpload } | { ok: false; message: string } => {
      if (!files || files.length === 0) {
        return { ok: false, message: 'Seleccioná la factura de combustible.' };
      }

      if (!selectedPersonaId) {
        return { ok: false, message: 'Seleccioná un registro antes de agregar la factura de combustible.' };
      }

      const file = files[0];
      const typeId =
        fuelInvoiceType?.id ??
        liquidacionType?.id ??
        (Number.isFinite(Number(selectedDocumentTypeId)) ? Number(selectedDocumentTypeId) : null);

      if (!typeId) {
        return { ok: false, message: 'No se pudo determinar el tipo de documento para la factura de combustible.' };
      }

      const targetDate = resolveFilteredTargetDate();
      const fechaVencimiento = targetDate ?? (selectedDocumentType?.vence ? documentExpiry || null : null);

      return {
        ok: true,
        upload: {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          typeId,
          typeName: fuelInvoiceType?.nombre ?? 'Factura combustible',
          fechaVencimiento,
          previewUrl: createImagePreviewUrl(file),
        },
      };
    },
    [
      selectedPersonaId,
      fuelInvoiceType,
      liquidacionType,
      selectedDocumentTypeId,
      resolveFilteredTargetDate,
      selectedDocumentType?.vence,
      documentExpiry,
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

  const handlePendingFilesDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handlePendingFilesDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length === 0) {
        return;
      }

      const result = prepareUploadsFromFiles(files);
      if (!result.ok) {
        setUploadStatus({ type: 'error', message: result.message });
        return;
      }

      setPendingUploads((prev) => [...prev, ...result.uploads]);
      setUploadStatus(null);

      if (!selectedDocumentType?.vence) {
        setDocumentExpiry('');
      }
    },
    [prepareUploadsFromFiles, selectedDocumentType?.vence]
  );

  const handleFuelFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const result = prepareFuelInvoiceFromFiles(Array.from(files));

    if (!result.ok) {
      setUploadStatus({ type: 'error', message: result.message });
      event.target.value = '';
      return;
    }

    setFuelInvoiceUpload((prev) => {
      if (prev?.previewUrl) {
        revokeImagePreviewUrl(prev.previewUrl);
      }
      return result.upload;
    });
    setUploadStatus(null);
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

    const handleOpenFuelPasteModal = () => {
      if (!selectedPersonaId) {
        setUploadStatus({ type: 'error', message: 'Seleccioná un registro antes de pegar la factura de combustible.' });
        return;
      }
    setFuelPasteError(null);
    setShowFuelPasteModal(true);
  };

  const handleCloseFuelPasteModal = () => {
    setShowFuelPasteModal(false);
    setFuelPasteError(null);
  };

  const handleFuelPasteAreaPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault();

    const clipboardItems = Array.from(event.clipboardData.items ?? []);
    const files: File[] = [];

    clipboardItems.forEach((item) => {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) {
          const extension = blob.type.split('/')[1] ?? 'png';
          const fileName = `factura-combustible-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
          const file = new File([blob], fileName, { type: blob.type });
          files.push(file);
        }
      }
    });

    if (files.length === 0) {
      setFuelPasteError('El portapapeles no contiene una imagen. Copiá la factura de combustible e inténtalo nuevamente.');
      return;
    }

    const result = prepareFuelInvoiceFromFiles(files);

    if (!result.ok) {
      setFuelPasteError(result.message);
      return;
    }

    setFuelInvoiceUpload((prev) => {
      if (prev?.previewUrl) {
        revokeImagePreviewUrl(prev.previewUrl);
      }
      return result.upload;
    });
    setUploadStatus({ type: 'success', message: 'Factura de combustible agregada desde el portapapeles.' });

    setShowFuelPasteModal(false);
    setFuelPasteError(null);
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

  const uploadFuelInvoiceOnly = useCallback(
    async (options?: { silent?: boolean; pending?: boolean }) => {
      const actionLabel = options?.pending ? 'guardar' : 'subir';
      if (!selectedPersonaId) {
        setUploadStatus({
          type: 'error',
          message: `Seleccioná un registro antes de ${actionLabel} la factura de combustible.`,
        });
        return false;
      }

      if (!fuelInvoiceUpload) {
        setUploadStatus({ type: 'error', message: 'Seleccioná la factura de combustible.' });
        return false;
      }

      if (!fuelParentDocumentId || fuelParentDocumentId.trim() === '') {
        setUploadStatus({
          type: 'error',
          message: 'Seleccioná la liquidación destino para la factura de combustible.',
        });
        return false;
      }

      try {
      setFuelUploading(true);
      if (!options?.silent) {
        setUploadStatus(null);
      }
      setValidationStatus(null);

        const formData = new FormData();
        formData.append('archivo', fuelInvoiceUpload.file);
        formData.append('nombre', fuelInvoiceUpload.file.name.trim());
        formData.append('tipoArchivoId', String(fuelInvoiceUpload.typeId));
        if (options?.pending) {
          formData.append('pendiente', '1');
        }
        if (fuelParentDocumentId) {
          formData.append('liquidacionId', fuelParentDocumentId);
        }
        if (fuelInvoiceUpload.fechaVencimiento) {
          formData.append('fechaVencimiento', fuelInvoiceUpload.fechaVencimiento);
        }
        formData.append('esFacturaCombustible', '1');
        formData.append('skipAutoValidacion', '1');
        if (fuelParentDocumentId) {
          formData.append('parentDocumentId', fuelParentDocumentId);
        }

        const response = await fetch(`${apiBaseUrl}/api/personal/${selectedPersonaId}/documentos`, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: formData,
        });

        if (!response.ok) {
          let message = `Error ${response.status}: ${response.statusText}`;
          try {
            const payload = await parseJsonSafe(response);
            if (typeof payload?.message === 'string') {
              message = payload.message;
            } else if (payload?.errors) {
              const firstError = Object.values(payload.errors)[0];
              if (Array.isArray(firstError) && typeof firstError[0] === 'string') {
                message = firstError[0];
              }
            }
          } catch (parseErr) {
            const fallback = (parseErr as Error).message;
            if (fallback) {
              message = fallback;
            }
          }

          throw new Error(message);
        }

        let validationStatus: { type: 'success' | 'error'; message: string } | null = null;
        const shouldValidateFactura =
          !options?.pending &&
          isPdfFile(fuelInvoiceUpload.file) &&
          fuelParentDocumentId &&
          fuelParentDocumentId.trim() !== '';

        if (shouldValidateFactura) {
          try {
            const token = readAuthTokenFromStorage();
            const headers: Record<string, string> = { Accept: 'application/json' };
            if (token) {
              headers.Authorization = `Bearer ${token}`;
            }

            const validationData = new FormData();
            validationData.append('archivo', fuelInvoiceUpload.file);
            validationData.append('liquidacionId', fuelParentDocumentId.trim());
            if (!isPdfFile(fuelInvoiceUpload.file)) {
              validationData.append('skipCuil', '1');
            }

            const validationResponse = await fetch(`${apiBaseUrl}/api/facturas/validar`, {
              method: 'POST',
              headers,
              body: validationData,
            });

            if (validationResponse.ok) {
              const payload = (await parseJsonSafe(validationResponse)) as {
                data?: {
                  estado?: string;
                  decision_mensaje?: string | null;
                  validaciones?: Array<{ regla?: string; resultado?: boolean; mensaje?: string | null }>;
                };
              };
              validationStatus = buildValidationStatus(payload, 'Factura validada correctamente.');
            } else {
              let message = `Error ${validationResponse.status}: ${validationResponse.statusText}`;
              try {
                const payload = await parseJsonSafe(validationResponse);
                if (typeof payload?.message === 'string') {
                  message = payload.message;
                }
              } catch {
                // ignore
              }
              validationStatus = {
                type: 'error',
                message: `Factura cargada, pero no se pudo validar automáticamente. ${message}`,
              };
            }
          } catch (validationErr) {
            validationStatus = {
              type: 'error',
              message:
                (validationErr as Error).message ??
                'Factura cargada, pero no se pudo validar automáticamente.',
            };
          }
        }

        if (!options?.silent) {
          const fallbackSuccessMessage = options?.pending
            ? 'Factura de combustible guardada. Se publicará al subir las liquidaciones.'
            : 'Factura de combustible cargada correctamente.';
          const feedback = resolveValidationFeedback(validationStatus, fallbackSuccessMessage);
          setValidationStatus(feedback.visibleValidation);
          setUploadStatus(feedback.uploadFeedback);
        }

        if (fuelInvoiceUpload.previewUrl) {
          revokeImagePreviewUrl(fuelInvoiceUpload.previewUrl);
        }
        setFuelInvoiceUpload(null);
        refreshPersonaDetail();
        return true;
      } catch (err) {
        setUploadStatus({
          type: 'error',
          message: (err as Error).message ?? `No se pudo ${actionLabel} la factura de combustible.`,
        });
        return false;
      } finally {
        setFuelUploading(false);
      }
    },
    [
      apiBaseUrl,
      buildValidationStatus,
      fuelInvoiceUpload,
      fuelParentDocumentId,
      isPdfFile,
      refreshPersonaDetail,
      resolveValidationFeedback,
      selectedPersonaId,
    ]
  );

  const publishPendingDocuments = useCallback(async () => {
    if (!selectedPersonaId) {
      return false;
    }

    const formData = new FormData();
    if (importeFacturarFinal != null) {
      formData.append('importeFacturar', String(importeFacturarFinal));
    }
    formData.append('destinatarioTipo', liquidacionRecipientType);

    const response = await fetch(`${apiBaseUrl}/api/personal/${selectedPersonaId}/documentos/publicar`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData,
    });

    if (!response.ok) {
      let message = `Error ${response.status}: ${response.statusText}`;
      try {
        const payload = await parseJsonSafe(response);
        if (typeof payload?.message === 'string') {
          message = payload.message;
        }
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    return true;
  }, [apiBaseUrl, selectedPersonaId, importeFacturarFinal, liquidacionRecipientType]);

  const handleUploadDocumentos = async () => {
    if (!selectedPersonaId) {
      return;
    }

    const hasLocalUploads = pendingUploads.length > 0;
    const hasPublishablePending = hasPendingStoredDocuments;
    if (!hasLocalUploads && !hasPublishablePending) {
      return;
    }

    const needsFuelInvoice = false;
    const shouldAttachFuelInvoices = false;

    if (!hasLocalUploads && hasPublishablePending) {
      try {
        setUploading(true);
        setUploadStatus(null);
        await publishPendingDocuments();
        setUploadStatus({ type: 'success', message: 'Liquidaciones publicadas correctamente.' });
        refreshPersonaDetail();
        advanceToNextQueuedPersona('subida');
      } catch (err) {
        setUploadStatus({ type: 'error', message: (err as Error).message ?? 'No se pudieron publicar las liquidaciones.' });
      } finally {
        setUploading(false);
      }
      return;
    }

    if (pendingUploads.length > 0 && !liquidacionFortnightSelection) {
      setUploadStatus({ type: 'error', message: 'Seleccioná quincena o mes completo.' });
      return;
    }

    // Si tenemos factura de combustible seleccionada, la subimos primero.
    if (needsFuelInvoice && fuelInvoiceUpload && fuelParentDocumentId.trim() !== '') {
      const uploaded = await uploadFuelInvoiceOnly({ silent: true });
      if (!uploaded) {
        return;
      }
    }

    try {
      setUploading(true);
      setUploadStatus(null);
      setValidationStatus(null);
      let parentDocumentId: number | null = null;
      let validationStatus: { type: 'success' | 'error'; message: string } | null = null;

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
        if (liquidacionFortnightSelection) {
          formData.append('fortnightKey', liquidacionFortnightSelection);
        }
        if (liquidacionMonthSelection) {
          formData.append('monthKey', liquidacionMonthSelection);
        }
        if (importeFacturarFinal != null) {
          formData.append('importeFacturar', String(importeFacturarFinal));
        }
        formData.append('destinatarioTipo', liquidacionRecipientType);
        formData.append('esLiquidacion', '1');
        formData.append('skipAutoValidacion', '1');
        if (shouldAttachFuelInvoices) {
          formData.append('attachFuelInvoices', '1');
        }

        const response = await fetch(`${apiBaseUrl}/api/personal/${selectedPersonaId}/documentos`, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: formData,
        });

        if (!response.ok) {
          let message = `Error ${response.status}: ${response.statusText}`;
          try {
            const payload = await parseJsonSafe(response);
            if (typeof payload?.message === 'string') {
              message = payload.message;
            } else if (payload?.errors) {
              const firstError = Object.values(payload.errors)[0];
              if (Array.isArray(firstError) && typeof firstError[0] === 'string') {
                message = firstError[0];
              }
            }
          } catch (parseErr) {
            const fallback = (parseErr as Error).message;
            if (fallback) {
              message = fallback;
            }
          }

          throw new Error(message);
        }

        const payload = (await response.json()) as { data?: { id?: number } };
        if (parentDocumentId === null && payload?.data?.id) {
          parentDocumentId = payload.data.id;
        }
        applyVisualClientToDocument(payload?.data?.id ?? null, item.visualClient ?? null);

        if (payload?.data?.id && isPdfFile(item.file)) {
          try {
            const token = readAuthTokenFromStorage();
            const headers: Record<string, string> = { Accept: 'application/json' };
            if (token) {
              headers.Authorization = `Bearer ${token}`;
            }

            const validationData = new FormData();
            validationData.append('archivo', item.file);
            validationData.append('liquidacionId', String(payload.data.id));
            if (!isPdfFile(item.file)) {
              validationData.append('skipCuil', '1');
            }

            const validationResponse = await fetch(`${apiBaseUrl}/api/facturas/validar`, {
              method: 'POST',
              headers,
              body: validationData,
            });

            if (validationResponse.ok) {
              const validationPayload = (await parseJsonSafe(validationResponse)) as {
                data?: {
                  estado?: string;
                  decision_mensaje?: string | null;
                  validaciones?: Array<{ regla?: string; resultado?: boolean; mensaje?: string | null }>;
                };
              };
              validationStatus = buildValidationStatus(validationPayload, 'Liquidación validada correctamente.');
            } else {
              let message = `Error ${validationResponse.status}: ${validationResponse.statusText}`;
              try {
                const validationPayload = await parseJsonSafe(validationResponse);
                if (typeof validationPayload?.message === 'string') {
                  message = validationPayload.message;
                }
              } catch {
                // ignore
              }
              validationStatus = {
                type: 'error',
                message: `Liquidación cargada, pero no se pudo validar automáticamente. ${message}`,
              };
            }
          } catch (validationErr) {
            validationStatus = {
              type: 'error',
              message:
                (validationErr as Error).message ??
                'Liquidación cargada, pero no se pudo validar automáticamente.',
            };
          }
        }
      }

      if (needsFuelInvoice && fuelInvoiceUpload) {
        if (parentDocumentId === null) {
          throw new Error('No se pudo vincular la factura de combustible a la liquidación principal.');
        }

        const formData = new FormData();
        formData.append('archivo', fuelInvoiceUpload.file);
        formData.append('nombre', fuelInvoiceUpload.file.name.trim());
        formData.append('tipoArchivoId', String(fuelInvoiceUpload.typeId));
        if (fuelInvoiceUpload.fechaVencimiento) {
          formData.append('fechaVencimiento', fuelInvoiceUpload.fechaVencimiento);
        }
        formData.append('parentDocumentId', String(parentDocumentId));
        formData.append('liquidacionId', String(parentDocumentId));
        formData.append('esFacturaCombustible', '1');

        const response = await fetch(`${apiBaseUrl}/api/personal/${selectedPersonaId}/documentos`, {
          method: 'POST',
          headers: { Accept: 'application/json' },
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

        if (fuelInvoiceUpload.previewUrl) {
          revokeImagePreviewUrl(fuelInvoiceUpload.previewUrl);
        }
        setFuelInvoiceUpload(null);
      }

      if (hasPublishablePending) {
        await publishPendingDocuments();
      }

      const uploadFeedback = resolveValidationFeedback(validationStatus, 'Liquidaciones cargadas correctamente.');
      setValidationStatus(uploadFeedback.visibleValidation);
      setUploadStatus(uploadFeedback.uploadFeedback);
      clearPendingUploads();
      setDocumentExpiry('');
      refreshPersonaDetail();
      advanceToNextQueuedPersona('subida');
    } catch (err) {
      setUploadStatus({ type: 'error', message: (err as Error).message ?? 'No se pudieron subir los archivos.' });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveLiquidacionesSolo = async () => {
    if (!selectedPersonaId || pendingUploads.length === 0) {
      setUploadStatus({ type: 'error', message: 'Agregá al menos una liquidación antes de guardar.' });
      return;
    }

    if (!liquidacionFortnightSelection) {
      setUploadStatus({ type: 'error', message: 'Seleccioná quincena o mes completo.' });
      return;
    }

    try {
      setUploading(true);
      setUploadStatus(null);
      setValidationStatus(null);
      let lastSavedId: number | null = null;
      let validationStatus: { type: 'success' | 'error'; message: string } | null = null;

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
        if (liquidacionFortnightSelection) {
          formData.append('fortnightKey', liquidacionFortnightSelection);
        }
        if (liquidacionMonthSelection) {
          formData.append('monthKey', liquidacionMonthSelection);
        }
        if (importeFacturarFinal != null) {
          formData.append('importeFacturar', String(importeFacturarFinal));
        }
        formData.append('destinatarioTipo', liquidacionRecipientType);
        formData.append('esLiquidacion', '1');
        formData.append('pendiente', '1');
        formData.append('skipAutoValidacion', '1');

        const response = await fetch(`${apiBaseUrl}/api/personal/${selectedPersonaId}/documentos`, {
          method: 'POST',
          headers: { Accept: 'application/json' },
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

        try {
          const payload = (await response.json()) as { data?: { id?: number } };
          applyVisualClientToDocument(payload?.data?.id ?? null, item.visualClient ?? null);
          if (payload?.data?.id) {
            lastSavedId = payload.data.id;
            if (isPdfFile(item.file)) {
              try {
                const token = readAuthTokenFromStorage();
                const headers: Record<string, string> = { Accept: 'application/json' };
                if (token) {
                  headers.Authorization = `Bearer ${token}`;
                }

                const validationData = new FormData();
                validationData.append('archivo', item.file);
                validationData.append('liquidacionId', String(payload.data.id));
                if (!isPdfFile(item.file)) {
                  validationData.append('skipCuil', '1');
                }

                const validationResponse = await fetch(`${apiBaseUrl}/api/facturas/validar`, {
                  method: 'POST',
                  headers,
                  body: validationData,
                });

                if (validationResponse.ok) {
                  const validationPayload = (await parseJsonSafe(validationResponse)) as {
                    data?: {
                      estado?: string;
                      decision_mensaje?: string | null;
                      validaciones?: Array<{ regla?: string; resultado?: boolean; mensaje?: string | null }>;
                    };
                  };
                  validationStatus = buildValidationStatus(validationPayload, 'Liquidación validada correctamente.');
                } else {
                  let message = `Error ${validationResponse.status}: ${validationResponse.statusText}`;
                  try {
                    const validationPayload = await parseJsonSafe(validationResponse);
                    if (typeof validationPayload?.message === 'string') {
                      message = validationPayload.message;
                    }
                  } catch {
                    // ignore
                  }
                  validationStatus = {
                    type: 'error',
                    message: `Liquidación guardada, pero no se pudo validar automáticamente. ${message}`,
                  };
                }
              } catch (validationErr) {
                validationStatus = {
                  type: 'error',
                  message:
                    (validationErr as Error).message ??
                    'Liquidación guardada, pero no se pudo validar automáticamente.',
                };
              }
            }
          }
        } catch {
          // ignore
        }
      }

      const uploadFeedback = resolveValidationFeedback(
        validationStatus,
        'Liquidaciones guardadas. Se publicarán al subir las liquidaciones.'
      );
      setValidationStatus(uploadFeedback.visibleValidation);
      setUploadStatus(uploadFeedback.uploadFeedback);
      if (lastSavedId) {
        setFuelParentDocumentId(String(lastSavedId));
      }
      clearPendingUploads();
      setDocumentExpiry('');
      refreshPersonaDetail();
      advanceToNextQueuedPersona('guardada');
    } catch (err) {
      setUploadStatus({ type: 'error', message: (err as Error).message ?? 'No se pudieron guardar las liquidaciones.' });
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
    const downloadUrl = withAuthToken(resolvedUrl);

    if (!downloadUrl) {
      window.alert('No se pudo determinar la URL de descarga para este documento.');
      return;
    }

    window.open(downloadUrl, '_blank', 'noopener');
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
      setLiquidacionVisualClientByDocId((prev) => {
        if (!prev[docId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[docId];
        return next;
      });
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
        <label className="filter-field">
          <span>Mes</span>
          <select value={liquidacionMonthFilter} onChange={(event) => setLiquidacionMonthFilter(event.target.value)}>
            {MONTH_FILTER_OPTIONS.map((option) => (
              <option key={`list-month-option-${option.value || 'all'}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Quincena</span>
          <select
            value={liquidacionFortnightFilter}
            onChange={(event) => setLiquidacionFortnightFilter(event.target.value)}
          >
            {FORTNIGHT_FILTER_OPTIONS.map((option) => (
              <option key={`list-fortnight-option-${option.value || 'all'}`} value={option.value}>
                {option.label}
              </option>
            ))}
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
        {!isPagosView ? (
          <button
            type="button"
            className="secondary-action"
            onClick={toggleVisibleLiquidacionSelection}
            disabled={visibleLiquidacionPersonaIds.length === 0}
          >
            {allVisibleLiquidacionSelected ? 'Desmarcar página' : 'Marcar página'}
          </button>
        ) : null}
        {!isPagosView ? (
          <button
            type="button"
            className="secondary-action secondary-action--ghost"
            onClick={clearLiquidacionQueueSelection}
            disabled={selectedLiquidacionPersonaIds.size === 0}
          >
            Limpiar lote
          </button>
        ) : null}
        {!isPagosView && selectedLiquidacionPersonaIds.size > 0 ? (
          <span className="form-info">{`Lote: ${selectedLiquidacionPersonaIds.size} marcado${selectedLiquidacionPersonaIds.size === 1 ? '' : 's'}`}</span>
        ) : null}
        {!isPagosView && selectedLiquidacionQueueRecords.length > 0 ? (
          <span className="form-info" title={selectedLiquidacionQueuePreview.full}>
            {selectedLiquidacionQueuePreview.compact}
          </span>
        ) : null}
        {isPagosView ? (
          <div className="column-picker">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setShowPagosColumnPicker((prev) => !prev)}
            >
              Columnas
            </button>
            {showPagosColumnPicker ? (
              <div className="column-picker__menu">
                {pagosColumnOptions.map((column) => (
                  <label key={column.key} className="column-picker__option">
                    <input
                      type="checkbox"
                      checked={visiblePagosColumns[column.key] !== false}
                      disabled={Boolean(column.locked)}
                      onChange={() =>
                        setVisiblePagosColumns((prev) => ({
                          ...prev,
                          [column.key]: column.locked ? true : !prev[column.key],
                        }))
                      }
                    />
                    <span>{column.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {!isPagosView ? (
          <div className="column-picker">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setShowLiquidacionesColumnPicker((prev) => !prev)}
            >
              Columnas
            </button>
            {showLiquidacionesColumnPicker ? (
              <div className="column-picker__menu">
                {liquidacionesColumnOptions.map((column) => (
                  <label key={column.key} className="column-picker__option">
                    <input
                      type="checkbox"
                      checked={visibleLiquidacionesColumns[column.key] !== false}
                      disabled={Boolean(column.locked)}
                      onChange={() =>
                        setVisibleLiquidacionesColumns((prev) => ({
                          ...prev,
                          [column.key]: column.locked ? true : !prev[column.key],
                        }))
                      }
                    />
                    <span>{column.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {!isPagosView ? (
          <button
            type="button"
            className={liquidacionesSortMode === 'importe-first' ? 'primary-action' : 'secondary-action'}
            onClick={() =>
              setLiquidacionesSortMode((prev) => (prev === 'importe-first' ? 'default' : 'importe-first'))
            }
          >
            {liquidacionesSortMode === 'importe-first' ? 'Orden: con importe primero' : 'Orden: normal'}
          </button>
        ) : null}
        {isPagosView ? (
          <button type="button" className="secondary-action" onClick={handleExportPagos}>
            Exportar Excel
          </button>
        ) : null}
        <button type="button" className="secondary-action" onClick={() => navigate('/personal')}>
          Ir a personal
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={() => updateListPagadoStatus(true)}
          disabled={selectedListPagadoIds.size === 0 || listPagadoUpdating}
        >
          Marcar pagado
        </button>
        <button
          type="button"
          className="secondary-action secondary-action--ghost"
          onClick={() => updateListPagadoStatus(false)}
          disabled={selectedListPagadoIds.size === 0 || listPagadoUpdating}
        >
          Desmarcar pagado
        </button>
        {selectedListPagadoIds.size > 0 ? (
          <span className="form-info">{`${selectedListPagadoIds.size} seleccionada${selectedListPagadoIds.size === 1 ? '' : 's'}`}</span>
        ) : null}
      </div>
      {isPagosView && pagosMonthChips.length > 0 ? (
        <div className="filters-actions" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className="form-info">Mes:</span>
          <button
            type="button"
            className={liquidacionMonthFilter === '' ? 'primary-action' : 'secondary-action'}
            onClick={() => setLiquidacionMonthFilter('')}
          >
            Todos
          </button>
          {pagosMonthChips.map((month) => (
            <button
              key={`pagos-month-${month.key}`}
              type="button"
              className={liquidacionMonthFilter === month.key ? 'primary-action' : 'secondary-action'}
              onClick={() => setLiquidacionMonthFilter(month.key)}
            >
              {month.label} ({month.count})
            </button>
          ))}
          <span className="form-info" style={{ marginLeft: '0.5rem' }}>
            Quincena:
          </span>
          <button
            type="button"
            className={liquidacionFortnightFilter === '' ? 'primary-action' : 'secondary-action'}
            onClick={() => setLiquidacionFortnightFilter('')}
          >
            Mes completo
          </button>
          <button
            type="button"
            className={liquidacionFortnightFilter === 'Q1' ? 'primary-action' : 'secondary-action'}
            onClick={() => setLiquidacionFortnightFilter('Q1')}
          >
            Primera quincena
          </button>
          <button
            type="button"
            className={liquidacionFortnightFilter === 'Q2' ? 'primary-action' : 'secondary-action'}
            onClick={() => setLiquidacionFortnightFilter('Q2')}
          >
            Segunda quincena
          </button>
        </div>
      ) : null}
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

  const liquidacionRecipientOptions = useMemo(() => {
    if (!detail) {
      return [] as Array<{
        value: 'proveedor' | 'cobrador' | 'ambos';
        label: string;
        emails: string[];
        identities: string[];
      }>;
    }

    const providerName = [detail.nombres, detail.apellidos].filter(Boolean).join(' ').trim() || 'Proveedor';
    const providerCuil = (detail.cuil ?? '').trim();
    const providerCbu = (detail.cbuAlias ?? '').trim();
    const providerEmail = normalizeRecipientEmail(detail.email);
    const collectorName = (detail.cobradorNombre ?? detail.duenoNombre ?? '').trim() || 'Cobrador';
    const collectorCuil = (detail.cobradorCuil ?? detail.duenoCuilCobrador ?? detail.duenoCuil ?? '').trim();
    const collectorCbu = (detail.cobradorCbuAlias ?? detail.duenoCbuAlias ?? '').trim();
    const collectorEmail = normalizeRecipientEmail(detail.cobradorEmail ?? detail.duenoEmail);

    const providerIdentityParts = [providerName];
    if (providerCuil) {
      providerIdentityParts.push(`${PERSON_TAX_ID_LABEL} ${providerCuil}`);
    }
    if (providerCbu) {
      providerIdentityParts.push(`CBU ${providerCbu}`);
    }

    const collectorIdentityParts = [collectorName];
    if (collectorCuil) {
      collectorIdentityParts.push(`${COLLECTOR_TAX_ID_LABEL} ${collectorCuil}`);
    }
    if (collectorCbu) {
      collectorIdentityParts.push(`CBU ${collectorCbu}`);
    }

    const providerIdentity = providerIdentityParts.join(' · ');
    const collectorIdentity = collectorIdentityParts.join(' · ');

    const options: Array<{
      value: 'proveedor' | 'cobrador' | 'ambos';
      label: string;
      emails: string[];
      identities: string[];
    }> = [];

    if (providerEmail) {
      options.push({
        value: 'proveedor',
        label: `Proveedor (${providerName})`,
        emails: [providerEmail],
        identities: [providerIdentity],
      });
    }

    if (collectorEmail) {
      options.push({
        value: 'cobrador',
        label: `Cobrador (${collectorName})`,
        emails: [collectorEmail],
        identities: [collectorIdentity],
      });
    }

    if (providerEmail && collectorEmail) {
      options.push({
        value: 'ambos',
        label: 'Proveedor y cobrador',
        emails: Array.from(new Set([providerEmail, collectorEmail])),
        identities: [providerIdentity, collectorIdentity],
      });
    }

    return options;
  }, [detail, normalizeRecipientEmail]);

  const selectedLiquidacionRecipient = useMemo(
    () => liquidacionRecipientOptions.find((option) => option.value === liquidacionRecipientType) ?? null,
    [liquidacionRecipientOptions, liquidacionRecipientType]
  );

  useEffect(() => {
    if (liquidacionRecipientOptions.length === 0) {
      return;
    }

    const isCurrentValid = liquidacionRecipientOptions.some((option) => option.value === liquidacionRecipientType);
    if (isCurrentValid) {
      return;
    }

    if (liquidacionRecipientOptions.some((option) => option.value === 'ambos')) {
      setLiquidacionRecipientType('ambos');
      return;
    }

    setLiquidacionRecipientType(liquidacionRecipientOptions[0].value);
  }, [liquidacionRecipientOptions, liquidacionRecipientType]);

  const listTitle = isPagosView ? 'Pagos' : 'Liquidaciones';
  const listSubtitle = isPagosView ? 'Gestión de pagos del personal' : 'Gestión de liquidaciones del personal';

  const listView = (
    <DashboardLayout title={listTitle} subtitle={listSubtitle} headerContent={headerContent}>
      {uploadStatus ? (
        <p className={`form-info${uploadStatus.type === 'error' ? ' form-info--error' : ''}`}>
          {uploadStatus.message}
        </p>
      ) : null}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {!isPagosView ? (
                <th>
                  <input
                    type="checkbox"
                    aria-label="Seleccionar distribuidores de la página"
                    checked={allVisibleLiquidacionSelected}
                    onChange={toggleVisibleLiquidacionSelection}
                    disabled={visibleLiquidacionPersonaIds.length === 0}
                  />
                </th>
              ) : null}
              {isListColumnVisible('id') ? <th>ID</th> : null}
              {isListColumnVisible('nombre') ? <th>Nombre</th> : null}
              {isListColumnVisible('cuil') ? <th>{PERSON_TAX_ID_LABEL}</th> : null}
              {isListColumnVisible('telefono') ? <th>Teléfono</th> : null}
              {isListColumnVisible('email') ? <th>Email</th> : null}
              {isListColumnVisible('cbuAlias') ? <th>CBU</th> : null}
              {isListColumnVisible('cobradorCbuAlias') ? <th>CBU cobrador</th> : null}
              {isListColumnVisible('cobradorCuil') ? <th>{COLLECTOR_TAX_ID_LABEL}</th> : null}
              {isListColumnVisible('perfil') ? <th>Perfil</th> : null}
              {isListColumnVisible('agente') ? <th>Agente</th> : null}
              {isListColumnVisible('estado') ? <th>Estado</th> : null}
              {isListColumnVisible('combustible') ? <th>Combustible</th> : null}
              {isListColumnVisible('tarifaEspecial') ? <th>Tarifa especial</th> : null}
              {isListColumnVisible('cliente') ? <th>Cliente</th> : null}
              {isListColumnVisible('unidad') ? <th>Unidad</th> : null}
              {isListColumnVisible('sucursal') ? <th>Sucursal</th> : null}
              {isListColumnVisible('fechaAlta') ? <th>Fecha alta</th> : null}
              {isListColumnVisible('importeFacturar') ? <th>Importe a facturar</th> : null}
              {isListColumnVisible('importeFacturarConDescuento') ? <th>Importe a facturar con descuento</th> : null}
              {isListColumnVisible('combustibleResumen') ? <th>Resumen combustible</th> : null}
              {isListColumnVisible('enviada') ? <th>Enviada</th> : null}
              {isListColumnVisible('facturado') ? <th>Facturado</th> : null}
              {isListColumnVisible('pagado') ? <th>Pagado</th> : null}
              {isListColumnVisible('acciones') ? <th>Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={listTableColumnCount}>Cargando personal...</td>
              </tr>
            )}

            {error && !loading && (
              <tr>
                <td colSpan={listTableColumnCount} className="error-cell">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && filteredPersonal.length === 0 && (
              <tr>
                <td colSpan={listTableColumnCount}>No hay registros para mostrar.</td>
              </tr>
            )}

            {!loading &&
              !error &&
              pageRecords.map((registro) => (
                <tr key={registro.rowId ?? registro.id}>
                  {!isPagosView ? (
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Agregar ${registro.nombre ?? `ID ${registro.id}`} al lote`}
                        checked={selectedLiquidacionPersonaIds.has(registro.id)}
                        onChange={() => toggleLiquidacionPersonaSelection(registro.id)}
                      />
                    </td>
                  ) : null}
                  {isListColumnVisible('id') ? <td>{registro.id}</td> : null}
                  {isListColumnVisible('nombre') ? (
                    <td>
                      {registro.nombre ?? '—'}
                      {registro.membresiaDesde ? (
                        <span
                          title={`Miembro desde ${registro.membresiaDesde}`}
                          style={{ marginLeft: '0.35rem', color: '#f5c518', fontSize: '0.9rem' }}
                        >
                          ★
                        </span>
                      ) : null}
                    </td>
                  ) : null}
                  {isListColumnVisible('cuil') ? <td>{registro.cuil ?? '—'}</td> : null}
                  {isListColumnVisible('telefono') ? <td>{registro.telefono ?? '—'}</td> : null}
                  {isListColumnVisible('email') ? <td>{registro.email ?? '—'}</td> : null}
                  {isListColumnVisible('cbuAlias') ? <td>{registro.cbuAlias ?? '—'}</td> : null}
                  {isListColumnVisible('cobradorCbuAlias') ? (
                    <td>{registro.cobradorCbuAlias ?? '—'}</td>
                  ) : null}
                  {isListColumnVisible('cobradorCuil') ? (
                    <td>{registro.cobradorCuil ?? '—'}</td>
                  ) : null}
                  {isListColumnVisible('perfil') ? <td>{registro.perfil ?? '—'}</td> : null}
                  {isListColumnVisible('agente') ? <td>{registro.agente ?? '—'}</td> : null}
                  {isListColumnVisible('estado') ? <td>{registro.estado ?? '—'}</td> : null}
                  {isListColumnVisible('combustible') ? <td>{registro.combustible ?? '—'}</td> : null}
                  {isListColumnVisible('tarifaEspecial') ? <td>{registro.tarifaEspecial ?? '—'}</td> : null}
                  {isListColumnVisible('cliente') ? (
                    <td>
                      {(() => {
                        const visualClient = resolveRecordVisualClient(registro);
                        const defaultClient = registro.cliente ?? null;
                        const effectiveClient = visualClient ?? defaultClient;

                        if (!effectiveClient) {
                          return '—';
                        }

                        return visualClient && visualClient !== defaultClient
                          ? `${effectiveClient} (visual)`
                          : effectiveClient;
                      })()}
                    </td>
                  ) : null}
                  {isListColumnVisible('unidad') ? <td>{registro.unidad ?? '—'}</td> : null}
                  {isListColumnVisible('sucursal') ? <td>{registro.sucursal ?? '—'}</td> : null}
                  {isListColumnVisible('fechaAlta') ? <td>{registro.fechaAlta ?? '—'}</td> : null}
                  {isListColumnVisible('importeFacturar') ? (
                    <td>
                      {!isPagosView && typeof registro.liquidacionIdLatest === 'number' ? (
                        <div className="liquidaciones-importe-cell">
                          <input
                            type="text"
                            inputMode="decimal"
                            className="liquidaciones-importe-input"
                            placeholder="0,00"
                            value={getListImporteInputValue(registro)}
                            onChange={(event) =>
                              handleListImporteDraftChange(registro.liquidacionIdLatest!, event.target.value)
                            }
                            onBlur={() => void handleSaveListImporte(registro)}
                            onKeyDown={(event) => handleListImporteKeyDown(event, registro)}
                            disabled={listImporteSavingIds.has(registro.liquidacionIdLatest)}
                          />
                          {listImporteSavingIds.has(registro.liquidacionIdLatest) ? (
                            <span className="liquidaciones-importe-saving">Guardando...</span>
                          ) : null}
                        </div>
                      ) : registro.liquidacionImporteFacturar != null ? (
                        formatCurrency(registro.liquidacionImporteFacturar)
                      ) : (
                        '—'
                      )}
                    </td>
                  ) : null}
                  {isListColumnVisible('importeFacturarConDescuento') ? (
                    <td>
                      {registro.liquidacionImporteFacturar != null && registro.combustibleResumen
                        ? formatCurrency(registro.liquidacionImporteFacturar - registro.combustibleResumen.totalToBill)
                        : '—'}
                    </td>
                  ) : null}
                  {isListColumnVisible('combustibleResumen') ? (
                    <td>
                      {registro.combustibleResumen ? (
                        <div className="liquidacion-resumen">
                          <span>Combustible: {formatCurrency(registro.combustibleResumen.totalAmount)}</span>
                          <span>Ajustes: {formatCurrency(registro.combustibleResumen.adjustmentsTotal)}</span>
                          <strong>
                            Total a facturar:{' '}
                            {formatCurrency(
                              (registro.liquidacionImporteFacturar ?? 0) - registro.combustibleResumen.totalToBill
                            )}
                          </strong>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  ) : null}
                  {isListColumnVisible('enviada') ? (
                    <td>{renderLiquidacionStatus(registro.liquidacionEnviada)}</td>
                  ) : null}
                  {isListColumnVisible('facturado') ? (
                    <td>{renderLiquidacionStatus(registro.liquidacionRecibido)}</td>
                  ) : null}
                  {isListColumnVisible('pagado') ? (
                    <td>
                      {typeof registro.liquidacionIdLatest === 'number' ? (
                        <div className="liquidaciones-pagado-cell">
                          {renderLiquidacionStatus(registro.liquidacionPagado)}
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar pago de ${registro.nombre ?? `ID ${registro.id}`}`}
                            checked={selectedListPagadoIds.has(registro.liquidacionIdLatest)}
                            onChange={() => toggleListPagadoSelection(registro.liquidacionIdLatest!)}
                          />
                        </div>
                      ) : (
                        renderLiquidacionStatus(registro.liquidacionPagado)
                      )}
                    </td>
                  ) : null}
                  {isListColumnVisible('acciones') ? (
                    <td>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => handleSelectPersona(registro)}
                      >
                        Gestionar
                      </button>
                    </td>
                  ) : null}
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
      <p className="form-info">
        {!isPagosView
          ? 'Marcá distribuidores para armar un lote masivo. Al guardar o subir una liquidación, se abrirá el siguiente marcado.'
          : 'Seleccioná un registro para gestionarlo en una nueva página.'}
      </p>
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
        {!isPagosView && selectedLiquidacionQueueIds.length > 0 ? (
          <div className="filters-actions" style={{ marginBottom: '0.75rem' }}>
            <span className="form-info">
              {currentLiquidacionQueueIndex >= 0
                ? `Lote activo: ${currentLiquidacionQueueIndex + 1}/${selectedLiquidacionQueueIds.length}`
                : `Lote activo: ${selectedLiquidacionQueueIds.length} marcado${selectedLiquidacionQueueIds.length === 1 ? '' : 's'}`}
            </span>
            {nextLiquidacionQueuePersonaId != null ? (
              <button
                type="button"
                className="secondary-action"
                onClick={() => openQueuedPersona(nextLiquidacionQueuePersonaId)}
              >
                Ir al siguiente marcado
              </button>
            ) : null}
          </div>
        ) : null}

        {detail && liquidacionRecipientOptions.length > 0 ? (
          <>
            <div className="liquidacion-recipient-selector">
              <span className="liquidacion-recipient-selector__label">Enviar liquidación a</span>
              <div className="liquidacion-recipient-picker" role="radiogroup" aria-label="Enviar liquidación a">
                {liquidacionRecipientOptions.map((option) => {
                  const isActive = liquidacionRecipientType === option.value;

                  return (
                    <button
                      key={`destinatario-liquidacion-${option.value}`}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      className={`liquidacion-recipient-card${isActive ? ' is-active' : ''}`}
                      onClick={() => setLiquidacionRecipientType(option.value)}
                    >
                      <span className="liquidacion-recipient-card__title">{option.label}</span>
                      <span className="liquidacion-recipient-card__identity">{option.identities.join(' / ')}</span>
                      <span className="liquidacion-recipient-card__meta">{option.emails.join(', ')}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {selectedLiquidacionRecipient ? (
              <p className="form-info">
                Se enviará a: {selectedLiquidacionRecipient.emails.join(', ')}
                {` · `}
                Destino: {selectedLiquidacionRecipient.identities.join(' / ')}
              </p>
            ) : null}
          </>
        ) : null}

        {detail && !detailLoading && liquidacionRecipientOptions.length === 0 ? (
          <p className="form-info form-info--error">
            No hay email configurado en proveedor ni cobrador para enviar la liquidación.
          </p>
        ) : null}

        <div className="quincena-filters">
          <label>
            <span>Año</span>
            <select value={liquidacionYearFilter} onChange={(event) => setLiquidacionYearFilter(event.target.value)}>
              {liquidacionYearOptions.map((option) => (
                <option key={`year-option-${option.value || 'all'}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
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

        <div className="liquidaciones-actions">
          <button
            type="button"
            className="secondary-action"
            onClick={() => updatePagadoStatus(true)}
            disabled={selectedPagadoIds.size === 0 || pagadoUpdating}
          >
            Marcar pagado
          </button>
          <button
            type="button"
            className="secondary-action secondary-action--ghost"
            onClick={() => updatePagadoStatus(false)}
            disabled={selectedPagadoIds.size === 0 || pagadoUpdating}
          >
            Desmarcar pagado
          </button>
          {selectedPagadoIds.size > 0 ? (
            <span className="form-info">{`${selectedPagadoIds.size} seleccionada${selectedPagadoIds.size === 1 ? '' : 's'}`}</span>
          ) : null}
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
                  <th>Importe a facturar</th>
                  <th>Enviada</th>
                  <th>Facturado</th>
                  <th>Validación IA</th>
                  <th>
                    <div className="liquidaciones-pagado-header">
                      <span>Pagado</span>
                      <input
                        type="checkbox"
                        aria-label="Seleccionar todas las liquidaciones"
                        checked={allPagadoSelected}
                        onChange={togglePagadoSelectAll}
                        disabled={visibleMainLiquidacionIds.length === 0}
                      />
                    </div>
                  </th>
                  <th style={{ width: '200px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredLiquidacionSections.map((monthSection) => (
                  <React.Fragment key={`month-${monthSection.monthKey}`}>
                    {monthSection.sections.map((section) => (
                      <React.Fragment key={`month-${monthSection.monthKey}-${section.key}`}>
                        <tr className="fortnight-row">
                          <td colSpan={10}>
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
                                <td>
                                  <div style={{ fontSize: '0.85rem', color: '#6b7a90' }}>{`ID ${group.main.id}`}</div>
                                  <div>{group.main.nombre ?? `Documento #${group.main.id}`}</div>
                                  {liquidacionVisualClientByDocId[group.main.id] ? (
                                    <div style={{ fontSize: '0.8rem', color: '#4f5d75' }}>
                                      Cliente visual: {liquidacionVisualClientByDocId[group.main.id]}
                                    </div>
                                  ) : null}
                                </td>
                                <td>{group.main.tipoNombre ?? '—'}</td>
                                <td>
                                  {group.main.fechaVencimiento
                                    ? group.main.fechaVencimiento
                                    : group.main.requiereVencimiento
                                      ? 'Requiere fecha'
                                      : group.main.fechaCarga ?? '—'}
                                </td>
                                <td>{formatFileSize(group.main.size)}</td>
                                <td>
                                  {group.main.importeFacturar != null
                                    ? formatCurrency(group.main.importeFacturar)
                                    : '—'}
                                </td>
                                <td>{renderLiquidacionStatus(group.main.enviada)}</td>
                                <td>{renderLiquidacionStatus(group.main.recibido)}</td>
                                <td>{renderAiValidationStatus(group.main)}</td>
                                <td>
                                  <div className="liquidaciones-pagado-cell">
                                    {renderLiquidacionStatus(group.main.pagado)}
                                    <input
                                      type="checkbox"
                                      aria-label={`Seleccionar liquidación ${group.main.id}`}
                                      checked={selectedPagadoIds.has(group.main.id)}
                                      onChange={() => togglePagadoSelection(group.main.id)}
                                    />
                                  </div>
                                </td>
                                <td className="table-actions">
                                  <button
                                    type="button"
                                    className="secondary-action"
                                    onClick={() => handleDownloadDocumento(group.main)}
                                    disabled={isDeletingMain}
                                  >
                                    Descargar
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary-action secondary-action--ghost"
                                    onClick={() => handlePreviewFuelDiscount(group.main)}
                                    title="Muestra el descuento de combustible para la quincena o mes seleccionado."
                                  >
                                    Descontar combustible
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
                                  <td>
                                    {attachment.importeFacturar != null
                                      ? formatCurrency(attachment.importeFacturar)
                                      : '—'}
                                  </td>
                                  <td>{renderAiValidationStatus(attachment)}</td>
                                  <td>—</td>
                                  <td>—</td>
                                  <td>—</td>
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
                              {(() => {
                                const netTotal = getLiquidacionNetTotal(group);
                                if (netTotal == null) {
                                  return null;
                                }
                                return (
                                  <tr className="attachment-row">
                                    <td colSpan={listVisibleColumnCount}>
                                      <div className="liquidacion-net-total">
                                        <span>Importe a facturar (con descuento)</span>
                                        <strong>{formatCurrency(netTotal)}</strong>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })()}
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
            {liquidacionTypeOptions.length > 1 ? (
              <select
                value={selectedDocumentTypeId}
                onChange={(event) => setSelectedDocumentTypeId(event.target.value)}
              >
                {liquidacionTypeOptions.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre ?? `Tipo #${tipo.id}`}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={
                  liquidacionType?.nombre ?? selectedDocumentType?.nombre ?? 'Liquidación'
                }
                readOnly
              />
            )}
          </label>
          <label className="input-control">
            <span>Cliente visual (solo filtro liquidaciones)</span>
            <input
              value={liquidacionVisualClientInput}
              onChange={(event) => setLiquidacionVisualClientInput(event.target.value)}
              list="liquidaciones-cliente-visual-options"
              placeholder="Opcional. No cambia Proveedores."
            />
            <datalist id="liquidaciones-cliente-visual-options">
              {clienteOptions.map((option) => (
                <option key={`cliente-visual-option-${option}`} value={option} />
              ))}
            </datalist>
          </label>
          <label className="input-control">
            <span>Importe a facturar</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={liquidacionImporteManual}
              onChange={(event) => setLiquidacionImporteManual(event.target.value)}
            />
          </label>
          <label className="input-control">
            <span>Importe a facturar con descuento</span>
            <input
              type="text"
              readOnly
              value={
                importeFacturarConDescuento != null
                  ? formatCurrency(importeFacturarConDescuento)
                  : '—'
              }
            />
          </label>
          <label className="input-control">
            <span>Mes de liquidación</span>
            <input
              type="month"
              value={liquidacionMonthSelection}
              onChange={(event) => setLiquidacionMonthSelection(event.target.value)}
            />
          </label>
          <label className="input-control">
            <span>Quincena</span>
            <select
              value={liquidacionFortnightSelection}
              onChange={(event) => setLiquidacionFortnightSelection(event.target.value)}
            >
              <option value="">Seleccionar</option>
              <option value="MONTHLY">Mes completo</option>
              <option value="Q1">Primera quincena</option>
              <option value="Q2">Segunda quincena</option>
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

        <div
          className="upload-dropzone"
          role="presentation"
          onDragOver={handlePendingFilesDragOver}
          onDrop={handlePendingFilesDrop}
        >
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
                    {item.visualClient ? <span>Cliente visual: {item.visualClient}</span> : null}
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

        <section className="dashboard-card" style={{ marginTop: '1.5rem' }}>
          <header className="card-header">
            <h3>Ajustes manuales</h3>
          </header>
          <div className="card-body">
            <p className="form-info">
              Sumá o restá importes antes de aplicar el descuento. Pendiente, Cuota combustible, Adelantos/Préstamos y Póliza restan.
            </p>
            <div className="form-grid">
              <label className="input-control">
                <span>Tipo</span>
                <select value={fuelAdjustmentType} onChange={(event) => setFuelAdjustmentType(event.target.value as typeof fuelAdjustmentType)}>
                  {Object.entries(fuelAdjustmentTypeLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-control">
                <span>Importe</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={fuelAdjustmentAmount}
                  onChange={(event) => setFuelAdjustmentAmount(event.target.value)}
                />
              </label>
              <label className="input-control">
                <span>Nota</span>
                <input value={fuelAdjustmentNote} onChange={(event) => setFuelAdjustmentNote(event.target.value)} />
              </label>
            </div>
            <div className="liquidaciones-actions" style={{ marginTop: '0.75rem' }}>
              <button type="button" className="secondary-action" onClick={handleAddFuelSelectionAdjustment}>
                Agregar ajuste
              </button>
              <button
                type="button"
                className="secondary-action secondary-action--ghost"
                onClick={handleApplyFuelSelectionAdjustments}
                disabled={fuelSelectionAdjustments.length === 0 || fuelAdjustmentsApplying}
              >
                {fuelAdjustmentsApplying ? 'Aplicando...' : 'Aplicar ajustes'}
              </button>
              {fuelAdjustmentsMessage ? <span className="form-info form-info--success">{fuelAdjustmentsMessage}</span> : null}
            </div>
            {fuelAdjustmentError ? <p className="form-info form-info--error">{fuelAdjustmentError}</p> : null}
            {fuelSelectionAdjustments.length > 0 ? (
              <div className="table-wrapper" style={{ marginTop: '0.75rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Importe</th>
                      <th>Nota</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fuelSelectionAdjustments.map((adj) => (
                      <tr key={adj.id}>
                        <td>{fuelAdjustmentTypeLabels[adj.type] ?? adj.type}</td>
                        <td>{formatCurrency(adj.amount)}</td>
                        <td>{adj.note || '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="secondary-action secondary-action--ghost"
                            onClick={() => handleRemoveFuelSelectionAdjustment(adj.id)}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </section>

        <section className="dashboard-card" style={{ marginTop: '1.5rem' }}>
          <header className="card-header">
            <h3>Descontar combustible</h3>
          </header>
          <div className="card-body">
            <p className="form-info">
              Seleccioná la liquidación destino. Se muestran todos los consumos históricos pendientes (no incluye los ya descontados) para que elijas qué descontar.
            </p>
            <label className="input-control">
              <span>Liquidación destino</span>
              <select value={fuelParentDocumentId} onChange={(event) => setFuelParentDocumentId(event.target.value)}>
                <option value="">Seleccioná la liquidación</option>
                {liquidacionGroupsForSelect.map((group) => (
                  <option key={`fuel-liq-${group.main.id}`} value={group.main.id}>
                    {group.main.nombre ?? `Liquidación #${group.main.id}`} {group.main.fechaCarga ?? ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="summary-cards" style={{ marginTop: '0.75rem' }}>
              <div className="summary-card">
                <span className="summary-card__label">Dominio</span>
                <strong className="summary-card__value">{fuelPreview?.domain ?? '—'}</strong>
              </div>
              <div className="summary-card">
                <span className="summary-card__label">Período</span>
                <strong className="summary-card__value">
                  {fuelPreview?.dateFrom && fuelPreview?.dateTo ? `${fuelPreview.dateFrom} → ${fuelPreview.dateTo}` : '—'}
                </strong>
              </div>
              <div className="summary-card">
                <span className="summary-card__label">Movimientos seleccionados</span>
                <strong className="summary-card__value">{fuelSelectedCount}</strong>
              </div>
              <div className="summary-card">
                <span className="summary-card__label">Total combustible (selección)</span>
                <strong className="summary-card__value">{formatCurrency(fuelSelectedTotal)}</strong>
              </div>
              <div className="summary-card">
                <span className="summary-card__label">Ajustes</span>
                <strong className="summary-card__value">{formatCurrency(fuelSelectionAdjustmentsTotal)}</strong>
              </div>
              <div className="summary-card">
                <span className="summary-card__label">Total a facturar</span>
                <strong className="summary-card__value">{formatCurrency(fuelSelectedTotalWithAdjustments)}</strong>
              </div>
            </div>
            <div className="table-wrapper" style={{ marginTop: '0.75rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        ref={fuelSelectAllRef}
                        type="checkbox"
                        checked={fuelAllSelected}
                        onChange={toggleFuelSelectAll}
                        disabled={fuelSelectableIds.length === 0}
                        aria-label="Seleccionar todo"
                        title="Seleccionar todo"
                      />
                    </th>
                    <th>Fecha</th>
                    <th>Estación</th>
                    <th>Producto</th>
                    <th>Litros</th>
                    <th>Importe</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {fuelPreviewLoading ? (
                    <tr>
                      <td colSpan={7}>Cargando consumos...</td>
                    </tr>
                  ) : null}
                  {!fuelPreviewLoading && fuelPreviewError ? (
                    <tr>
                      <td colSpan={7} className="error-cell">
                        {fuelPreviewError}
                      </td>
                    </tr>
                  ) : null}
                  {!fuelPreviewLoading && !fuelPreviewError && (!fuelPreview || fuelPreview.items.length === 0) ? (
                    <tr>
                      <td colSpan={7}>No hay consumos para mostrar.</td>
                    </tr>
                  ) : null}
                  {!fuelPreviewLoading &&
                    !fuelPreviewError &&
                    fuelPreview?.items.map((row) => {
                      const isObserved = (row.status ?? '').toLowerCase().includes('observ');
                      const isDiscounted = Boolean(row.discounted) || row.status === 'DISCOUNTED';
                      return (
                        <tr key={row.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={fuelSelection.has(row.id)}
                              disabled={isObserved || isDiscounted}
                              onChange={() =>
                                setFuelSelection((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(row.id)) {
                                    next.delete(row.id);
                                  } else {
                                    next.add(row.id);
                                  }
                                  return next;
                                })
                              }
                            />
                          </td>
                          <td>{formatDateTime(row.occurred_at)}</td>
                          <td>{row.station ?? '—'}</td>
                          <td>{row.product ?? '—'}</td>
                          <td>{formatNumber(row.liters)}</td>
                          <td>{formatCurrency(row.amount ?? 0)}</td>
                          <td>{renderFuelStatusBadge(row.status, row.discounted)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div className="liquidaciones-actions" style={{ marginTop: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="primary-action"
                onClick={handleApplyFuelPreview}
                disabled={fuelPreviewApplying || fuelSelection.size === 0 || !fuelPreview || !fuelParentDocumentId}
              >
                {fuelPreviewApplying ? 'Aplicando...' : 'Aplicar descuento'}
              </button>
            </div>
            {fuelPreviewMessage ? <p className="form-info form-info--success">{fuelPreviewMessage}</p> : null}
          </div>
        </section>

        {/* Factura de combustible removida: se gestiona desde Descontar combustible */}

        {uploadStatus ? (
          <p
            className={
              uploadStatus.type === 'error' ? 'form-info form-info--error' : 'form-info form-info--success'
            }
          >
            {uploadStatus.message}
          </p>
        ) : null}
        {validationStatus ? (
          <p
            className={
              validationStatus.type === 'error'
                ? 'form-info form-info--error'
                : 'form-info form-info--success'
            }
          >
            {validationStatus.message}
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

        {showFuelPasteModal ? (
          <div className="paste-overlay" role="dialog" aria-modal="true">
            <div className="paste-modal">
              <h3>Pegar factura de combustible desde el portapapeles</h3>
              <p className="paste-modal__hint">Hacé clic en el cuadro y presioná Ctrl + V para pegar la imagen.</p>
              <textarea
                onPaste={handleFuelPasteAreaPaste}
                placeholder="Ctrl + V para pegar la captura…"
                spellCheck={false}
              />
              {fuelPasteError ? <p className="form-info form-info--error">{fuelPasteError}</p> : null}
              <div className="paste-modal__actions">
                <button type="button" className="secondary-action" onClick={handleCloseFuelPasteModal}>
                  Cancelar
                </button>
              </div>
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
            className="secondary-action secondary-action--ghost"
            onClick={handleSaveLiquidacionesSolo}
            disabled={uploading || pendingUploads.length === 0 || !selectedPersonaId || !selectedDocumentTypeId}
            title="Guarda las liquidaciones sin requerir factura de combustible todavía."
          >
            {uploading ? 'Guardando...' : 'Guardar liquidaciones'}
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={handleUploadDocumentos}
            disabled={
              uploading ||
              documentTypesLoading ||
              !selectedPersonaId ||
              !hasAnyUploadTarget ||
              (canSubmitUploads && !selectedDocumentTypeId)
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
