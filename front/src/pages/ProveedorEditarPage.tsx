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

type PendingPersonalUpload = {
  id: string;
  file: File;
  typeId: number;
  typeName: string | null;
  fechaVencimiento: string | null;
  visualClient?: string | null;
  previewUrl?: string | null;
};

type PersonalDetail = {
  id: number;
  documents: any[];
  comments: any[];
  history: any[];
  [key: string]: any;
};

type PersonalHistoryEntry = any;
type AltaRequestForm = any;

const DOCUMENT_ALERT_DAYS = 30;

const stripDiacritics = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const isLiquidacionDocumento = (doc: any): boolean => {
  if (!doc || typeof doc !== 'object') {
    return false;
  }

  if (doc.liquidacionId !== null && doc.liquidacionId !== undefined && String(doc.liquidacionId) !== '') {
    return true;
  }

  const tipoNombre = typeof doc.tipoNombre === 'string' ? stripDiacritics(doc.tipoNombre) : '';
  if (tipoNombre && tipoNombre.includes('liquid')) {
    return true;
  }

  const nombre = typeof doc.nombre === 'string' ? stripDiacritics(doc.nombre) : '';
  if (nombre && nombre.includes('liquid')) {
    return true;
  }

  return false;
};

const AUTH_STORAGE_KEY = 'authUser';
const readAuthTokenFromStorage = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY) ?? window.sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { token?: unknown } | null;
    const token = parsed?.token;
    if (typeof token !== 'string' || token.trim().length === 0) {
      return null;
    }
    return token;
  } catch {
    return null;
  }
};

const normalizeNosisDateValue = (value: string | null | undefined): string | null => {
  const raw = (value ?? '').trim();
  if (!raw) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  const compactMatch = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const [, year, month, day] = compactMatch;
    return `${year}-${month}-${day}`;
  }
  const slashMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month}-${day}`;
  }
  return null;
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

const normalizePagoValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  const raw = String(value).trim();
  if (!raw) {
    return '';
  }

  const normalized = raw.toLowerCase();
  if (['1', 'true', 'si', 'sí', 'con', 'factura', 'con factura'].includes(normalized)) {
    return '1';
  }
  if (['0', 'false', 'no', 'sin', 'sin factura', 'sn', 's/n'].includes(normalized)) {
    return '0';
  }

  const numeric = Number(normalized);
  if (!Number.isNaN(numeric)) {
    return numeric !== 0 ? '1' : '0';
  }

  return '';
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

type ProveedorEditarPageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  getUserRole: (authUser: AuthUser | null | undefined) => string;
  isPersonalEditor: (authUser: AuthUser | null | undefined) => boolean;
  buildActorHeaders: (authUser: AuthUser | null | undefined) => Record<string, string>;
  resolveApiUrl: (baseUrl: string, target?: string | null) => string | null;
  readCachedSolicitudData: (id: number | null | undefined) => unknown | null;
  writeCachedSolicitudData: (id: number | null | undefined, data: unknown) => void;
  readPersonalEditCache: (id: number | null | undefined) => unknown | null;
  writePersonalEditCache: (id: number | null | undefined, data: unknown) => void;
  PERSON_TAX_ID_LABEL: string;
  COLLECTOR_TAX_ID_LABEL: string;
  OWNER_TAX_ID_LABEL: string;
  OWNER_COLLECTOR_TAX_ID_LABEL: string;
  PAGO_SELECT_OPTIONS: Array<{ value: string; label: string }>;
  formatPagoLabel: (value: string | number | boolean | null | undefined) => string;
  TaxProfileSection: React.ComponentType<{
    entityType: 'cliente' | 'persona';
    entityId: number | null;
    apiBaseUrl: string;
    actorHeaders?: Record<string, string>;
    readOnly?: boolean;
    title: string;
    subtitle: string;
  }>;
};

export const ProveedorEditarPage: React.FC<ProveedorEditarPageProps> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  getUserRole,
  isPersonalEditor,
  buildActorHeaders,
  resolveApiUrl,
  readCachedSolicitudData,
  writeCachedSolicitudData,
  readPersonalEditCache,
  writePersonalEditCache,
  PERSON_TAX_ID_LABEL,
  COLLECTOR_TAX_ID_LABEL,
  OWNER_TAX_ID_LABEL,
  OWNER_COLLECTOR_TAX_ID_LABEL,
  PAGO_SELECT_OPTIONS,
  formatPagoLabel,
  TaxProfileSection,
}) => {
  const { personaId } = useParams<{ personaId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const authUser = useStoredAuthUser();
  const userRole = useMemo(() => getUserRole(authUser), [authUser]);
  const canManagePersonal = useMemo(() => isPersonalEditor(authUser), [authUser]);
  const actorHeaders = useMemo(() => buildActorHeaders(authUser), [authUser]);
  const isReadOnly = userRole === 'operator' || !canManagePersonal;
  const canEditCbu = userRole === 'admin' || userRole === 'admin2' || userRole === 'encargado';
  const [nosisLookupLoading, setNosisLookupLoading] = useState(false);
  const [nosisLookupError, setNosisLookupError] = useState<string | null>(null);
  const [nosisLookupInfo, setNosisLookupInfo] = useState<string | null>(null);
  const nosisLastLookupRef = useRef<string | null>(null);
  const [detail, setDetail] = useState<PersonalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState({
    nombres: '',
    apellidos: '',
    legajo: '',
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
    combustibleEstado: '',
    fechaBaja: '',
    membresiaDesde: '',
    tarifaEspecial: false,
    esCobrador: true,
    cobradorNombre: '',
    cobradorEmail: '',
    cobradorCuil: '',
    cobradorCbuAlias: '',
    duenoNombre: '',
    duenoFechaNacimiento: '',
    duenoEmail: '',
    duenoTelefono: '',
    duenoCuil: '',
    duenoCuilCobrador: '',
    duenoCbuAlias: '',
    duenoObservaciones: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [assignmentRequestSubmitting, setAssignmentRequestSubmitting] = useState(false);
  const [assignmentRequestError, setAssignmentRequestError] = useState<string | null>(null);
  const [assignmentRequestInfo, setAssignmentRequestInfo] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [pendingUploads, setPendingUploads] = useState<PendingPersonalUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentInfo, setCommentInfo] = useState<string | null>(null);
  const [detailChatOpen, setDetailChatOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [disapproving, setDisapproving] = useState(false);
  const [disapproveError, setDisapproveError] = useState<string | null>(null);
  const [documentFilter, setDocumentFilter] = useState<
    'todos' | 'vencido' | 'por_vencer' | 'vigente' | 'sin_vencimiento'
  >('todos');
  const [showAllDocuments, setShowAllDocuments] = useState(false);
  const [documentPreview, setDocumentPreview] = useState<{
    url: string;
    label: string;
    mime: string | null;
    objectUrl?: boolean;
  } | null>(null);
  const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false);
  const [documentPreviewError, setDocumentPreviewError] = useState<string | null>(null);
  const [deletingDocumentIds, setDeletingDocumentIds] = useState<Set<number>>(() => new Set());
  const [deletingExpiredDocuments, setDeletingExpiredDocuments] = useState(false);
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

    const docs = Array.isArray(detail.documents) ? detail.documents.filter((doc: any) => !isLiquidacionDocumento(doc)) : [];
    return docs.find((doc: any) => doc.id === selectedDocumentId) ?? null;
  }, [detail, selectedDocumentId]);
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

      const razonSocial = persona ? (persona.getElementsByTagName('RazonSocial')[0]?.textContent?.trim() ?? '') : '';
      const documento = persona ? (persona.getElementsByTagName('Documento')[0]?.textContent?.trim() ?? '') : '';
      const fechaNacimiento = persona ? (persona.getElementsByTagName('FechaNacimiento')[0]?.textContent?.trim() ?? '') : '';
      const resultadoNovedad = resultado ? (resultado.getElementsByTagName('Novedad')[0]?.textContent?.trim() ?? '') : '';
      const message = resultadoNovedad || getText('Novedad') || payload;

      return {
        message,
        razonSocial,
        documento,
        fechaNacimiento,
      };
    } catch {
      return null;
    }
  }, []);

  const visibleDocuments = useMemo(() => {
    if (!detail) {
      return [] as any[];
    }

    const base = Array.isArray(detail.documents) ? detail.documents : [];
    return base.filter((doc: any) => !isLiquidacionDocumento(doc));
  }, [detail]);

  useEffect(() => {
    if (selectedDocumentId === null) {
      return;
    }
    if (visibleDocuments.length === 0) {
      setSelectedDocumentId(null);
      return;
    }
    const exists = visibleDocuments.some((doc: any) => doc.id === selectedDocumentId);
    if (!exists) {
      setSelectedDocumentId(visibleDocuments[0].id ?? null);
    }
  }, [selectedDocumentId, visibleDocuments]);

  const documentsWithStatus = useMemo(() => {
    if (!detail) {
      return [] as Array<PersonalDetail['documents'][number] & { status: string; daysLeft: number | null }>;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return visibleDocuments.map((doc: any) => {
      const rawDate = doc.fechaVencimiento;
      if (!rawDate) {
        return { ...doc, status: 'sin_vencimiento', daysLeft: null };
      }
      const parsed = new Date(`${rawDate}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) {
        return { ...doc, status: 'sin_vencimiento', daysLeft: null };
      }
      const diffMs = parsed.getTime() - today.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        return { ...doc, status: 'vencido', daysLeft: diffDays };
      }
      if (diffDays <= DOCUMENT_ALERT_DAYS) {
        return { ...doc, status: 'por_vencer', daysLeft: diffDays };
      }
      return { ...doc, status: 'vigente', daysLeft: diffDays };
    });
  }, [detail, visibleDocuments]);

  const documentStatusCounts = useMemo(() => {
    const counts = {
      total: 0,
      vencidos: 0,
      porVencer: 0,
      vigentes: 0,
      sinVencimiento: 0,
    };
    documentsWithStatus.forEach((doc: any) => {
      counts.total += 1;
      if (doc.status === 'vencido') {
        counts.vencidos += 1;
      } else if (doc.status === 'por_vencer') {
        counts.porVencer += 1;
      } else if (doc.status === 'vigente') {
        counts.vigentes += 1;
      } else {
        counts.sinVencimiento += 1;
      }
    });
    return counts;
  }, [documentsWithStatus]);

  const filteredDocuments = useMemo(() => {
    if (documentFilter === 'todos') {
      return documentsWithStatus;
    }
    return documentsWithStatus.filter((doc: any) => doc.status === documentFilter);
  }, [documentsWithStatus, documentFilter]);

  const resolveDocumentLabel = useCallback((doc: any) => {
    if (!doc) {
      return 'este documento';
    }
    return doc.tipoNombre
      ? `${doc.tipoNombre}${doc.nombre ? ` – ${doc.nombre}` : ''}`
      : doc.nombre ?? `Documento #${doc.id ?? ''}`;
  }, []);

  const removeDocumentoFromDetail = useCallback(
    (docId: number) => {
      setDetail((prev) => {
        if (!prev) {
          return prev;
        }
        const nextDocuments = Array.isArray(prev.documents) ? prev.documents.filter((doc: any) => doc.id !== docId) : [];
        return { ...prev, documents: nextDocuments };
      });
      setSelectedDocumentId((prev) => (prev === docId ? null : prev));
    },
    [setDetail, setSelectedDocumentId]
  );

  const deleteDocumentoById = useCallback(
    async (docId: number, label: string) => {
      if (!detail) {
        return;
      }

      const response = await fetch(`${apiBaseUrl}/api/personal/${detail.id}/documentos/${docId}`, {
        method: 'DELETE',
        headers: {
          ...actorHeaders,
        },
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
        throw new Error(`${message} (${label})`);
      }

      removeDocumentoFromDetail(docId);
    },
    [actorHeaders, apiBaseUrl, detail, removeDocumentoFromDetail]
  );

  const handleDeleteDocumento = useCallback(
    async (doc: any) => {
      if (!detail) {
        return;
      }
      if (isReadOnly) {
        window.alert('Solo los usuarios autorizados pueden eliminar documentos.');
        return;
      }

      const docId = Number(doc?.id);
      if (!docId || Number.isNaN(docId)) {
        window.alert('No se pudo identificar el documento a eliminar.');
        return;
      }

      const label = resolveDocumentLabel(doc);
      const confirmed = window.confirm(`¿Eliminar "${label}"? Esta acción no se puede deshacer.`);
      if (!confirmed) {
        return;
      }

      setDeletingDocumentIds((prev) => {
        const next = new Set(prev);
        next.add(docId);
        return next;
      });

      try {
        await deleteDocumentoById(docId, label);
        setUploadStatus({ type: 'success', message: 'Documento eliminado correctamente.' });
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
    },
    [deleteDocumentoById, detail, isReadOnly, resolveDocumentLabel]
  );

  const handleDeleteExpiredDocuments = useCallback(async () => {
    if (!detail) {
      return;
    }
    if (isReadOnly) {
      window.alert('Solo los usuarios autorizados pueden eliminar documentos.');
      return;
    }
    if (deletingExpiredDocuments) {
      return;
    }

    const expired = documentsWithStatus.filter((doc: any) => doc.status === 'vencido');
    if (expired.length === 0) {
      window.alert('No hay documentos vencidos para eliminar.');
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar ${expired.length} documento(s) vencido(s)? Esta acción no se puede deshacer.`
    );
    if (!confirmed) {
      return;
    }

    setDeletingExpiredDocuments(true);
    setUploadStatus(null);

    let deletedCount = 0;
    const failures: string[] = [];

    for (const doc of expired) {
      const docId = Number(doc?.id);
      if (!docId || Number.isNaN(docId)) {
        continue;
      }
      const label = resolveDocumentLabel(doc);
      try {
        await deleteDocumentoById(docId, label);
        deletedCount += 1;
      } catch (err) {
        failures.push((err as Error).message ?? label);
      }
    }

    if (failures.length > 0) {
      setUploadStatus({
        type: 'error',
        message: `Se eliminaron ${deletedCount} documento(s). Fallaron ${failures.length}.`,
      });
    } else {
      setUploadStatus({ type: 'success', message: `Se eliminaron ${deletedCount} documento(s) vencido(s).` });
    }

    setDeletingExpiredDocuments(false);
  }, [deleteDocumentoById, deletingExpiredDocuments, detail, documentsWithStatus, isReadOnly, resolveDocumentLabel]);

  useEffect(() => {
    setShowAllHistory(false);
  }, [detail?.id]);

  useEffect(() => {
    setShowAllDocuments(false);
  }, [documentFilter]);

  const revokeDocumentPreviewUrl = useCallback((preview: typeof documentPreview) => {
    if (preview?.objectUrl) {
      revokeImagePreviewUrl(preview.url);
    }
  }, []);

  const closeDocumentPreview = useCallback(() => {
    setDocumentPreview((prev) => {
      revokeDocumentPreviewUrl(prev);
      return null;
    });
    setDocumentPreviewError(null);
    setDocumentPreviewLoading(false);
  }, [revokeDocumentPreviewUrl]);

  const openDocumentPreview = useCallback(
    async (resolvedUrl: string, label: string, mime: string | null) => {
      setDocumentPreviewError(null);
      setDocumentPreviewLoading(true);
      setDocumentPreview((prev) => {
        revokeDocumentPreviewUrl(prev);
        return { url: '', label, mime, objectUrl: false };
      });
      const token = readAuthTokenFromStorage();
      let requestUrl = resolvedUrl;
      if (token) {
        try {
          const url = new URL(resolvedUrl, window.location.origin);
          if (url.origin === window.location.origin) {
            url.searchParams.set('api_token', token);
            requestUrl = url.toString();
          }
        } catch {
          requestUrl = resolvedUrl;
        }
      }
      try {
        const response = await fetch(requestUrl, { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`Preview error ${response.status}`);
        }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setDocumentPreview((prev) => {
          revokeDocumentPreviewUrl(prev);
          return { url: blobUrl, label, mime: blob.type || mime, objectUrl: true };
        });
      } catch (error) {
        setDocumentPreviewError('No se pudo cargar la vista previa.');
        setDocumentPreview((prev) => {
          revokeDocumentPreviewUrl(prev);
          return { url: '', label, mime, objectUrl: false };
        });
      } finally {
        setDocumentPreviewLoading(false);
      }
    },
    [revokeDocumentPreviewUrl]
  );

  const withAuthToken = useCallback((url: string | null): string | null => {
    if (!url) {
      return null;
    }
    const token = readAuthTokenFromStorage();
    if (!token) {
      return url;
    }
    try {
      const parsed = new URL(url, window.location.origin);
      const apiOrigin = new URL(apiBaseUrl).origin;
      if (parsed.origin !== apiOrigin) {
        return url;
      }
      parsed.searchParams.set('api_token', token);
      return parsed.toString();
    } catch {
      return url;
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    return () => {
      setDocumentPreview((prev) => {
        revokeDocumentPreviewUrl(prev);
        return prev;
      });
    };
  }, [revokeDocumentPreviewUrl]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDocumentPreview();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeDocumentPreview]);

  const handleRemovePendingUpload = useCallback((id: string) => {
    setPendingUploads((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleCobradorToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setFormValues((prev) => ({
      ...prev,
      esCobrador: checked,
    }));
  };

  const lookupNosisByDocumento = useCallback(
    async (showValidationError = true) => {
      if (nosisLookupLoading) {
        return;
      }

      const documento = formValues.cuil.replace(/\D+/g, '');
      if (!documento) {
        if (showValidationError) {
          setNosisLookupError(`Ingresá un ${PERSON_TAX_ID_LABEL} para consultar en Nosis.`);
        }
        return;
      }
      if (documento.length !== 11) {
        if (showValidationError) {
          setNosisLookupError(`Ingresá un ${PERSON_TAX_ID_LABEL} válido de 11 dígitos.`);
        }
        return;
      }

      if (!showValidationError && nosisLastLookupRef.current === documento) {
        return;
      }

      const url = new URL(`${apiBaseUrl}/api/nosis/consultar-documento`);
      url.searchParams.set('documento', documento);

      try {
        setNosisLookupLoading(true);
        setNosisLookupError(null);
        setNosisLookupInfo(null);

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
        const razonSocial = typeof parsed?.razonSocial === 'string' ? parsed.razonSocial : '';
        const razonSplit = splitRazonSocial(razonSocial);
        const fullName = razonSocial.trim();
        const nombresFromNosis = razonSplit?.nombres ?? '';
        const apellidosFromNosis = razonSplit?.apellidos ?? '';
        const documentoFromNosis = typeof parsed?.documento === 'string' ? parsed.documento.replace(/\D+/g, '') : '';
        const fechaNacimientoFromNosis = normalizeNosisDateValue(
          typeof parsed?.fechaNacimiento === 'string' ? parsed.fechaNacimiento : ''
        ) ?? '';
        const shouldReplaceIdentity = (detail?.cuil ?? '').replace(/\D+/g, '') !== documento;

        setFormValues((prev) => {
          const next = { ...prev };
          const profileIsCobrador = prev.perfilValue === 2;

          if (profileIsCobrador) {
            const fullNameFallback = fullName || [nombresFromNosis, apellidosFromNosis].filter(Boolean).join(' ').trim();
            if ((shouldReplaceIdentity || !prev.nombres.trim()) && fullNameFallback) {
              next.nombres = fullNameFallback;
            }
            if (shouldReplaceIdentity && prev.apellidos.trim()) {
              next.apellidos = '';
            }
          } else {
            if ((shouldReplaceIdentity || !prev.nombres.trim()) && nombresFromNosis) {
              next.nombres = nombresFromNosis;
            }
            if ((shouldReplaceIdentity || !prev.apellidos.trim()) && apellidosFromNosis) {
              next.apellidos = apellidosFromNosis;
            }
          }

          if ((shouldReplaceIdentity || !prev.cuil.trim()) && documentoFromNosis) {
            next.cuil = documentoFromNosis;
          }
          if ((shouldReplaceIdentity || !prev.duenoFechaNacimiento) && fechaNacimientoFromNosis) {
            next.duenoFechaNacimiento = fechaNacimientoFromNosis;
          }

          return next;
        });

        nosisLastLookupRef.current = documento;
        setNosisLookupInfo(
          (typeof parsed?.message === 'string' && parsed.message.trim()) || payload?.message || 'Datos consultados en Nosis.'
        );
      } catch (err) {
        setNosisLookupError((err as Error).message ?? 'No se pudo consultar Nosis.');
      } finally {
        setNosisLookupLoading(false);
      }
    },
    [
      actorHeaders,
      apiBaseUrl,
      detail?.cuil,
      formValues.cuil,
      nosisLookupLoading,
      parseNosisXml,
      splitRazonSocial,
    ]
  );

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

        const response = await fetch(`${apiBaseUrl}/api/personal/${personaId}?includePending=1`);

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const payload = (await response.json()) as { data: PersonalDetail };

      if (!payload?.data) {
        throw new Error('Formato de respuesta inesperado');
      }

      const cachedSolicitudData = payload.data.solicitudData ?? readCachedSolicitudData(payload.data.id);
      const solicitudAltaForm = (cachedSolicitudData as { form?: AltaRequestForm } | null | undefined)?.form;
      const cachedEdit = readPersonalEditCache(payload.data.id);

      const hasCobradorData = Boolean(
        payload.data.cobradorNombre
        || payload.data.cobradorEmail
        || payload.data.cobradorCuil
        || payload.data.cobradorCbuAlias
      );
      const hasDuenoAsCobradorData = Boolean(
        payload.data.duenoNombre
        || payload.data.duenoEmail
        || payload.data.duenoCuilCobrador
        || payload.data.duenoCbuAlias
      );
      const hasSolicitudCobradorData = Boolean(
        solicitudAltaForm?.cobradorNombre
        || solicitudAltaForm?.cobradorEmail
        || solicitudAltaForm?.cobradorCuil
        || solicitudAltaForm?.cobradorCbuAlias
      );
      const hasExplicitCobradorData = Boolean(
        payload.data.cobradorNombre
        || payload.data.cobradorEmail
        || payload.data.cobradorCuil
        || payload.data.cobradorCbuAlias
        || hasSolicitudCobradorData
      );
      const esCobrador = Boolean(
        payload.data.esCobrador
        || payload.data.perfilValue === 2
        || hasCobradorData
        || hasSolicitudCobradorData
        || hasDuenoAsCobradorData
      );
      const cobradorNombreRaw = hasExplicitCobradorData ? (payload.data.cobradorNombre ?? solicitudAltaForm?.cobradorNombre ?? '') : '';
      const cobradorEmailRaw = hasExplicitCobradorData ? (payload.data.cobradorEmail ?? solicitudAltaForm?.cobradorEmail ?? '') : '';
      const cobradorCuilRaw = hasExplicitCobradorData ? (payload.data.cobradorCuil ?? solicitudAltaForm?.cobradorCuil ?? '') : '';
      const cobradorCbuAliasRaw = hasExplicitCobradorData ? (payload.data.cobradorCbuAlias ?? solicitudAltaForm?.cobradorCbuAlias ?? '') : '';
      const fallbackNombre = hasExplicitCobradorData ? cobradorNombreRaw.trim() : '';
      const fallbackEmail = hasExplicitCobradorData ? cobradorEmailRaw.trim() : '';
      const fallbackCuil = hasExplicitCobradorData ? cobradorCuilRaw.trim() : '';
      const fallbackCbuAlias = hasExplicitCobradorData ? cobradorCbuAliasRaw.trim() : '';

      setFormValues({
        nombres: payload.data.nombres ?? solicitudAltaForm?.nombres ?? '',
        apellidos: payload.data.apellidos ?? solicitudAltaForm?.apellidos ?? '',
        legajo: payload.data.legajo ?? '',
        cuil: payload.data.cuil ?? solicitudAltaForm?.cuil ?? '',
        telefono: payload.data.telefono ?? solicitudAltaForm?.telefono ?? '',
        email: fallbackEmail || (payload.data.email ?? solicitudAltaForm?.email ?? ''),
        perfilValue: payload.data.perfilValue ?? 0,
        agenteId: payload.data.agenteId ? String(payload.data.agenteId) : '',
        agenteResponsableId: payload.data.agenteResponsableId ? String(payload.data.agenteResponsableId) : '',
        clienteId: payload.data.clienteId ? String(payload.data.clienteId) : '',
        sucursalId: payload.data.sucursalId ? String(payload.data.sucursalId) : '',
        unidadId: payload.data.unidadId ? String(payload.data.unidadId) : '',
        estadoId: payload.data.estadoId ? String(payload.data.estadoId) : '',
        fechaAlta: payload.data.fechaAlta ?? '',
        pago: normalizePagoValue(payload.data.pago ?? solicitudAltaForm?.pago ?? ''),
        cbuAlias: payload.data.cbuAlias ?? solicitudAltaForm?.cbuAlias ?? '',
        patente: payload.data.patente ?? '',
        observacionTarifa: payload.data.observacionTarifa ?? '',
        observaciones: payload.data.observaciones ?? '',
        esCobrador,
        cobradorNombre: fallbackNombre || solicitudAltaForm?.cobradorNombre || '',
        cobradorEmail: fallbackEmail || solicitudAltaForm?.cobradorEmail || '',
        cobradorCuil: fallbackCuil || solicitudAltaForm?.cobradorCuil || '',
        cobradorCbuAlias: fallbackCbuAlias || solicitudAltaForm?.cobradorCbuAlias || '',
        duenoNombre: payload.data.duenoNombre ?? solicitudAltaForm?.duenoNombre ?? '',
        duenoFechaNacimiento: payload.data.duenoFechaNacimiento ?? '',
        duenoEmail: payload.data.duenoEmail ?? solicitudAltaForm?.duenoEmail ?? '',
        duenoTelefono: payload.data.duenoTelefono ?? solicitudAltaForm?.duenoTelefono ?? '',
        duenoCuil: payload.data.duenoCuil ?? solicitudAltaForm?.duenoCuil ?? '',
        duenoCuilCobrador: payload.data.duenoCuilCobrador ?? solicitudAltaForm?.duenoCuilCobrador ?? '',
        duenoCbuAlias: payload.data.duenoCbuAlias ?? solicitudAltaForm?.duenoCbuAlias ?? '',
        duenoObservaciones: payload.data.duenoObservaciones ?? solicitudAltaForm?.duenoObservaciones ?? '',
        combustible: Boolean(payload.data.combustibleValue),
        combustibleEstado: payload.data.combustibleEstado ?? '',
        fechaBaja: payload.data.fechaBaja ?? '',
        membresiaDesde: payload.data.membresiaDesde ?? '',
        tarifaEspecial: Boolean(payload.data.tarifaEspecialValue),
      });
      const documents = payload.data.documents ?? [];
      setDetail({
        ...payload.data,
        esCobrador,
        solicitudData: cachedSolicitudData ?? payload.data.solicitudData,
        documents,
        documentsDownloadAllUrl: payload.data.documentsDownloadAllUrl ?? null,
        documentsDownloadAllAbsoluteUrl: payload.data.documentsDownloadAllAbsoluteUrl ?? null,
        history: payload.data.history ?? [],
        combustibleEstado: payload.data.combustibleEstado ?? null,
        fechaBaja: payload.data.fechaBaja ?? null,
      });
      setSaveSuccess(null);
      setSaveError(null);
      setAssignmentRequestError(null);
      setAssignmentRequestInfo(null);
      if (documents.length > 0) {
        setSelectedDocumentId(documents[0].id);
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
    const params = new URLSearchParams(location.search);
    const filter = params.get('docFilter');
    const normalized =
      filter === 'vencidos' ? 'vencido' :
      filter === 'vigentes' ? 'vigente' :
      filter;
    if (
      normalized === 'todos' ||
      normalized === 'vencido' ||
      normalized === 'por_vencer' ||
      normalized === 'vigente' ||
      normalized === 'sin_vencimiento'
    ) {
      setDocumentFilter(normalized);
    }
  }, [location.search]);

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

  const cobradorLocked = formValues.perfilValue === 2;

  const isEstadoBaja = useMemo(() => {
    const estadoNombre = (() => {
      if (meta && formValues.estadoId) {
        const targetId = Number(formValues.estadoId);
        const estado = meta.estados.find((item) => item.id === targetId);
        if (estado?.nombre) {
          return estado.nombre;
        }
      }
      return detail?.estado ?? '';
    })();

    return estadoNombre.trim().toLowerCase().includes('baja');
  }, [meta, formValues.estadoId, detail?.estado]);

  const assignmentDraft = useMemo(() => {
    const currentClienteId = detail?.clienteId ?? null;
    const currentSucursalId = detail?.sucursalId ?? null;
    const newClienteId = formValues.clienteId ? Number(formValues.clienteId) : null;
    const newSucursalId = formValues.sucursalId ? Number(formValues.sucursalId) : null;
    const responsableId = formValues.agenteResponsableId
      ? Number(formValues.agenteResponsableId)
      : (detail?.agenteResponsableId ?? null);

    const clientes = meta?.clientes ?? [];
    const sucursales = meta?.sucursales ?? [];
    const agentes = meta?.agentes ?? [];

    const currentClienteNombre =
      detail?.cliente
      ?? clientes.find((cliente) => cliente.id === currentClienteId)?.nombre
      ?? null;
    const currentSucursalNombre =
      detail?.sucursal
      ?? sucursales.find((sucursal) => sucursal.id === currentSucursalId)?.nombre
      ?? null;
    const newClienteNombre =
      clientes.find((cliente) => cliente.id === newClienteId)?.nombre
      ?? null;
    const newSucursalNombre =
      sucursales.find((sucursal) => sucursal.id === newSucursalId)?.nombre
      ?? null;
    const responsableNombre =
      agentes.find((agente) => agente.id === responsableId)?.name
      ?? detail?.agenteResponsable
      ?? null;

    const hasClienteChange = String(currentClienteId ?? '') !== String(newClienteId ?? '');
    const hasSucursalChange = String(currentSucursalId ?? '') !== String(newSucursalId ?? '');

    return {
      currentClienteId,
      currentSucursalId,
      newClienteId,
      newSucursalId,
      responsableId,
      currentClienteNombre,
      currentSucursalNombre,
      newClienteNombre,
      newSucursalNombre,
      responsableNombre,
      hasClienteChange,
      hasSucursalChange,
      hasAssignmentChange: hasClienteChange || hasSucursalChange,
    };
  }, [
    detail?.agenteResponsable,
    detail?.agenteResponsableId,
    detail?.cliente,
    detail?.clienteId,
    detail?.sucursal,
    detail?.sucursalId,
    formValues.agenteResponsableId,
    formValues.clienteId,
    formValues.sucursalId,
    meta?.agentes,
    meta?.clientes,
    meta?.sucursales,
  ]);

  const handleDownloadFicha = useCallback((record: PersonalDetail) => {
    const emailPreferido = (record.cobradorEmail ?? '').trim() || (record.email ?? '') || '';
    const hasCobradorData = Boolean(
      record.esCobrador
      || record.cobradorNombre
      || record.cobradorEmail
      || record.cobradorCuil
      || record.cobradorCbuAlias
    );
    const lines = [
      ['Nombre', [record.nombres, record.apellidos].filter(Boolean).join(' ').trim()],
      ['Legajo', record.legajo ?? ''],
      [PERSON_TAX_ID_LABEL, record.cuil ?? ''],
      ['Teléfono', record.telefono ?? ''],
      ['Email', emailPreferido],
      ['Perfil', record.perfil ?? ''],
      ['Agente', record.agente ?? ''],
      ['Estado', record.estado ?? ''],
      ['Cliente', record.cliente ?? ''],
      ['Sucursal', record.sucursal ?? ''],
      ['Unidad', record.unidadDetalle ?? record.unidad ?? ''],
      ['Patente', record.patente ?? ''],
      ['Fecha alta', record.fechaAlta ?? ''],
      ['Pago pactado', formatPagoLabel(record.pago)],
      ['CBU / Alias', record.cbuAlias ?? ''],
      ['Combustible', record.combustibleValue ? 'Sí' : 'No'],
      ['Tarifa especial', record.tarifaEspecialValue ? 'Sí' : 'No'],
      ['Observación tarifa', formValues.observacionTarifa],
      ['Observaciones', formValues.observaciones],
    ];

    if (hasCobradorData) {
      lines.push(
        ['Cobrador nombre', record.cobradorNombre ?? ''],
        ['Cobrador correo', record.cobradorEmail ?? ''],
        [COLLECTOR_TAX_ID_LABEL, record.cobradorCuil ?? ''],
        ['Cobrador CBU/Alias', record.cobradorCbuAlias ?? '']
      );
    }

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
        onClick={() => navigate(`/personal/${personaId}/membresia`)}
      >
        ★ Membresía
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

  const handleSubmitCambioAsignacion = async () => {
    if (!detail) {
      return;
    }
    if (isReadOnly) {
      setAssignmentRequestError('Solo los usuarios autorizados pueden enviar solicitudes.');
      return;
    }

    setAssignmentRequestError(null);
    setAssignmentRequestInfo(null);
    setSaveError(null);

    if (!assignmentDraft.hasAssignmentChange) {
      setAssignmentRequestError('No hay cambios de cliente o sucursal para solicitar.');
      return;
    }

    if (!assignmentDraft.responsableId || Number.isNaN(assignmentDraft.responsableId)) {
      setAssignmentRequestError('Seleccioná un agente responsable para enviar la solicitud.');
      return;
    }

    if (!assignmentDraft.newClienteId || Number.isNaN(assignmentDraft.newClienteId)) {
      setAssignmentRequestError('Seleccioná el cliente nuevo para continuar.');
      return;
    }

    if (!assignmentDraft.newSucursalId || Number.isNaN(assignmentDraft.newSucursalId)) {
      setAssignmentRequestError('Seleccioná la sucursal nueva para continuar.');
      return;
    }

    const confirmed = window.confirm(
      'Se enviará una solicitud al agente responsable para aprobar el cambio de asignación. ¿Continuar?'
    );
    if (!confirmed) {
      return;
    }

    const documentosSnapshot = (detail.documents ?? []).map((doc: any) => ({
      id: doc.id,
      nombre: doc.nombre ?? null,
      tipoNombre: doc.tipoNombre ?? null,
      fechaVencimiento: doc.fechaVencimiento ?? null,
      mime: doc.mime ?? null,
    }));

    try {
      setAssignmentRequestSubmitting(true);

      const payload = {
        tipo: 'cambio_asignacion',
        estado: 'Pendiente',
        destinatarioIds: [assignmentDraft.responsableId],
        form: {
          personaId: detail.id,
          personaNombre: [detail.nombres, detail.apellidos].filter(Boolean).join(' ').trim() || null,
          personaCuil: detail.cuil ?? null,
          agenteResponsableId: assignmentDraft.responsableId,
          agenteResponsableNombre: assignmentDraft.responsableNombre,
          clienteIdActual: assignmentDraft.currentClienteId,
          clienteNombreActual: assignmentDraft.currentClienteNombre,
          sucursalIdActual: assignmentDraft.currentSucursalId,
          sucursalNombreActual: assignmentDraft.currentSucursalNombre,
          clienteIdNuevo: assignmentDraft.newClienteId,
          clienteNombreNuevo: assignmentDraft.newClienteNombre,
          sucursalIdNueva: assignmentDraft.newSucursalId,
          sucursalNombreNueva: assignmentDraft.newSucursalNombre,
          documentos: documentosSnapshot,
          requestedAt: new Date().toISOString(),
          origin: 'personal-edit',
        },
      };

      const response = await fetch(`${apiBaseUrl}/api/solicitud-personal`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...actorHeaders,
        },
        body: JSON.stringify(payload),
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
              message = String(firstError[0]);
            }
          }
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }

      const responsePayload = (await response.json()) as { message?: string };
      setAssignmentRequestInfo(
        responsePayload?.message
          ?? 'Solicitud de cambio de asignación enviada correctamente.'
      );
      setFormValues((prev) => ({
        ...prev,
        clienteId: assignmentDraft.currentClienteId ? String(assignmentDraft.currentClienteId) : '',
        sucursalId: assignmentDraft.currentSucursalId ? String(assignmentDraft.currentSucursalId) : '',
      }));
    } catch (err) {
      setAssignmentRequestError(
        (err as Error).message ?? 'No se pudo enviar la solicitud de cambio de asignación.'
      );
    } finally {
      setAssignmentRequestSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (isReadOnly) {
      setSaveError(
        canManagePersonal
          ? 'Tu rol actual solo permite visualizar la información.'
          : 'Solo los usuarios autorizados pueden editar personal.'
      );
      return;
    }
    if (!personaId) {
      return;
    }
    if (assignmentDraft.hasAssignmentChange) {
      setSaveError(
        'Para cambiar cliente o sucursal usá el botón "Solicitar cambio de asignación".'
      );
      return;
    }
    if (isEstadoBaja && !formValues.fechaBaja) {
      setSaveError('Seleccioná la fecha de baja.');
      return;
    }

    try {
      setSaveError(null);
      setSaveSuccess(null);

      const cobradorNombre = formValues.cobradorNombre.trim() || null;
      const cobradorEmail = formValues.cobradorEmail.trim() || null;
      const cobradorCuil = formValues.cobradorCuil.trim() || null;
      const cobradorCbuAlias = canEditCbu
        ? (formValues.cobradorCbuAlias.trim() || null)
        : (detail?.cobradorCbuAlias ?? null);
      const hasCobradorFields = Boolean(
        cobradorNombre || cobradorEmail || cobradorCuil || cobradorCbuAlias
      );
      const esCobradorFlag = formValues.esCobrador || hasCobradorFields || formValues.perfilValue === 2;

      if (esCobradorFlag) {
        const missing: string[] = [];
        if (!cobradorNombre) {
          missing.push('nombre del cobrador');
        }
        if (!cobradorEmail) {
          missing.push('correo del cobrador');
        }
        if (!cobradorCuil) {
          missing.push('CUIT/CUIL del cobrador');
        }
        if (!cobradorCbuAlias) {
          missing.push('CBU/Alias del cobrador');
        }

        if (missing.length > 0) {
          setSaveError(`Completá los datos del cobrador para guardar: ${missing.join(', ')}.`);
          return;
        }
      }

      setSaving(true);
      const combustibleEstado = formValues.combustible ? formValues.combustibleEstado || null : null;
      const fechaBaja = formValues.fechaBaja || null;
      const duenoNombre = esCobradorFlag ? cobradorNombre : formValues.duenoNombre.trim() || null;
      const duenoEmail = esCobradorFlag ? cobradorEmail : formValues.duenoEmail.trim() || null;
      const duenoCuilCobrador = esCobradorFlag ? cobradorCuil : formValues.duenoCuilCobrador.trim() || null;
      const duenoCbuAlias = esCobradorFlag
        ? cobradorCbuAlias
        : (canEditCbu ? (formValues.duenoCbuAlias.trim() || null) : (detail?.duenoCbuAlias ?? null));
      const cbuAlias = canEditCbu ? (formValues.cbuAlias.trim() || null) : (detail?.cbuAlias ?? null);

      const requestInit: RequestInit = {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...actorHeaders,
        },
        body: JSON.stringify({
          nombres: formValues.nombres.trim() || null,
          apellidos: formValues.apellidos.trim() || null,
          legajo: formValues.legajo.trim() || null,
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
          fechaBaja,
          pago: serializePagoValue(formValues.pago),
          cbuAlias,
          patente: formValues.patente.trim() || null,
          observacionTarifa: formValues.observacionTarifa.trim() || null,
          observaciones: formValues.observaciones.trim() || null,
          combustible: formValues.combustible,
          combustibleEstado,
          tarifaEspecial: formValues.tarifaEspecial,
          membresiaDesde: formValues.membresiaDesde || null,
          esCobrador: esCobradorFlag,
          cobradorNombre,
          cobradorEmail,
          cobradorCuil,
          cobradorCbuAlias,
          duenoNombre,
          duenoFechaNacimiento: formValues.duenoFechaNacimiento || null,
          duenoEmail,
          duenoTelefono: formValues.duenoTelefono.trim() || null,
          duenoCuil: formValues.duenoCuil.trim() || null,
          duenoCuilCobrador,
          duenoCbuAlias,
          duenoObservaciones: formValues.duenoObservaciones.trim() || null,
        }),
      };

      let response = await fetch(`${apiBaseUrl}/api/personal/${personaId}`, requestInit);
      if (response.status === 405) {
        response = await fetch(`${apiBaseUrl}/api/personal/${personaId}`, {
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

      const payload = (await response.json()) as { message?: string; data?: PersonalDetail };
      setSaveSuccess(payload.message ?? 'Información actualizada correctamente.');

      if (payload.data) {
        const hasCobradorData = Boolean(
          payload.data.cobradorNombre
          || payload.data.cobradorEmail
          || payload.data.cobradorCuil
          || payload.data.cobradorCbuAlias
        );
        const hasExplicitCobradorData = hasCobradorData;
        const hasDuenoAsCobradorData = Boolean(
          payload.data.duenoNombre
          || payload.data.duenoEmail
          || payload.data.duenoCuilCobrador
          || payload.data.duenoCbuAlias
        );
        const esCobrador = Boolean(
          payload.data.esCobrador
          || payload.data.perfilValue === 2
          || hasCobradorData
          || hasDuenoAsCobradorData
        );
        writePersonalEditCache(payload.data.id, {
          esCobrador,
          cobradorNombre: payload.data.cobradorNombre ?? null,
          cobradorEmail: payload.data.cobradorEmail ?? null,
          cobradorCuil: payload.data.cobradorCuil ?? null,
          cobradorCbuAlias: payload.data.cobradorCbuAlias ?? null,
          duenoNombre: payload.data.duenoNombre ?? formValues.duenoNombre ?? null,
          duenoEmail: payload.data.duenoEmail ?? formValues.duenoEmail ?? null,
          duenoCuil: payload.data.duenoCuil ?? formValues.duenoCuil ?? null,
          duenoCuilCobrador: payload.data.duenoCuilCobrador ?? formValues.duenoCuilCobrador ?? null,
          duenoCbuAlias: payload.data.duenoCbuAlias ?? formValues.duenoCbuAlias ?? null,
        });
        const cobradorNombreRaw = esCobrador
          ? (payload.data.cobradorNombre ?? payload.data.duenoNombre ?? '')
          : '';
        const cobradorEmailRaw = esCobrador
          ? (payload.data.cobradorEmail ?? payload.data.duenoEmail ?? '')
          : '';
        const cobradorCuilRaw = esCobrador
          ? (
            payload.data.cobradorCuil
            ?? payload.data.duenoCuilCobrador
            ?? payload.data.duenoCuil
            ?? payload.data.cuil
            ?? ''
          )
          : '';
        const cobradorCbuAliasRaw = esCobrador
          ? (payload.data.cobradorCbuAlias ?? payload.data.duenoCbuAlias ?? '')
          : '';

        const fallbackNombre = hasExplicitCobradorData
          ? (cobradorNombreRaw || payload.data.duenoNombre || formValues.cobradorNombre || '').trim()
          : '';
        const fallbackEmail = hasExplicitCobradorData
          ? (
            cobradorEmailRaw ||
            payload.data.duenoEmail ||
            payload.data.email ||
            formValues.cobradorEmail ||
            ''
          ).trim()
          : '';
        const fallbackCuil = hasExplicitCobradorData
          ? (
            cobradorCuilRaw ||
            payload.data.duenoCuilCobrador ||
            payload.data.duenoCuil ||
            formValues.cobradorCuil ||
            ''
          ).trim()
          : '';
        const fallbackCbuAlias = hasExplicitCobradorData
          ? (
            cobradorCbuAliasRaw ||
            formValues.cobradorCbuAlias ||
            payload.data.cobradorCbuAlias ||
            payload.data.duenoCbuAlias ||
            formValues.duenoCbuAlias ||
            payload.data.cbuAlias ||
            ''
          ).trim()
          : '';

        setDetail({
          ...payload.data,
          esCobrador,
          combustibleEstado: payload.data.combustibleEstado ?? null,
          fechaBaja: payload.data.fechaBaja ?? null,
          cobradorCbuAlias: fallbackCbuAlias || null,
          documents: payload.data.documents ?? [],
          documentsDownloadAllUrl: payload.data.documentsDownloadAllUrl ?? null,
          documentsDownloadAllAbsoluteUrl: payload.data.documentsDownloadAllAbsoluteUrl ?? null,
          history: payload.data.history ?? [],
        });
        setFormValues({
          nombres: payload.data.nombres ?? '',
          apellidos: payload.data.apellidos ?? '',
          legajo: payload.data.legajo ?? '',
          cuil: payload.data.cuil ?? '',
          telefono: payload.data.telefono ?? '',
          email: fallbackEmail || (payload.data.email ?? ''),
          perfilValue: payload.data.perfilValue ?? 0,
          agenteId: payload.data.agenteId ? String(payload.data.agenteId) : '',
          agenteResponsableId: payload.data.agenteResponsableId ? String(payload.data.agenteResponsableId) : '',
          clienteId: payload.data.clienteId ? String(payload.data.clienteId) : '',
          sucursalId: payload.data.sucursalId ? String(payload.data.sucursalId) : '',
          unidadId: payload.data.unidadId ? String(payload.data.unidadId) : '',
          estadoId: payload.data.estadoId ? String(payload.data.estadoId) : '',
          fechaAlta: payload.data.fechaAlta ?? '',
          pago: normalizePagoValue(payload.data.pago ?? ''),
          cbuAlias: payload.data.cbuAlias ?? '',
          patente: payload.data.patente ?? '',
          observacionTarifa: payload.data.observacionTarifa ?? '',
          observaciones: payload.data.observaciones ?? '',
          esCobrador,
          combustibleEstado: payload.data.combustibleEstado ?? '',
          fechaBaja: payload.data.fechaBaja ?? '',
          membresiaDesde: payload.data.membresiaDesde ?? '',
          cobradorNombre: fallbackNombre,
          cobradorEmail: fallbackEmail,
          cobradorCuil: fallbackCuil,
          cobradorCbuAlias: fallbackCbuAlias,
          duenoNombre: payload.data.duenoNombre ?? '',
          duenoFechaNacimiento: payload.data.duenoFechaNacimiento ?? '',
          duenoEmail: payload.data.duenoEmail ?? '',
          duenoTelefono: payload.data.duenoTelefono ?? '',
          duenoCuil: payload.data.duenoCuil ?? '',
          duenoCuilCobrador: payload.data.duenoCuilCobrador ?? '',
          duenoCbuAlias: payload.data.duenoCbuAlias ?? '',
          duenoObservaciones: payload.data.duenoObservaciones ?? '',
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

    const documento = visibleDocuments.find((doc: any) => doc.id === selectedDocumentId);
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

  const handleCommentSubmit = async () => {
    if (!detail) {
      return;
    }
    if (isReadOnly) {
      setCommentError('Solo los usuarios autorizados pueden agregar comentarios.');
      return;
    }

    const trimmed = commentText.trim();
    if (trimmed.length === 0) {
      setCommentError('Escribe un mensaje antes de enviarlo.');
      return;
    }

    try {
      setCommentSaving(true);
      setCommentError(null);
      setCommentInfo(null);

      const response = await fetch(`${apiBaseUrl}/api/personal/${detail.id}/comentarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...actorHeaders,
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

      setDetail((prev) => {
        if (!prev) {
          return prev;
        }
        const existing = Array.isArray(prev.comments) ? prev.comments : [];
        return {
          ...prev,
          comments: [payload.data, ...existing],
        };
      });

      setCommentText('');
      setCommentInfo(payload.message ?? 'Comentario agregado.');
    } catch (err) {
      setCommentError((err as Error).message ?? 'No se pudo enviar el comentario.');
    } finally {
      setCommentSaving(false);
    }
  };

  const handleDisapprove = async () => {
    if (!detail || !detail.aprobado) {
      return;
    }
    if (isReadOnly) {
      setDisapproveError('Solo los usuarios autorizados pueden revertir aprobaciones.');
      return;
    }

    const confirmed = window.confirm('¿Querés revertir la aprobación y volver a la solicitud?');
    if (!confirmed) {
      return;
    }

    try {
      setDisapproving(true);
      setDisapproveError(null);

      const response = await fetch(`${apiBaseUrl}/api/personal/${detail.id}/desaprobar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...actorHeaders,
        },
        body: JSON.stringify({
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
        data?: { personalRecord?: PersonalRecord };
      };

      if (payload.data?.personalRecord) {
        window.dispatchEvent(
          new CustomEvent('personal:updated', {
            detail: { persona: payload.data.personalRecord },
          })
        );
      }

      navigate(`/aprobaciones?personaId=${detail.id}`);
    } catch (err) {
      setDisapproveError((err as Error).message ?? 'No se pudo revertir la aprobación.');
    } finally {
      setDisapproving(false);
    }
  };

  const handleUploadDocumentos = async () => {
    if (isReadOnly) {
      setUploadStatus({
        type: 'error',
        message: canManagePersonal
          ? 'Tu rol actual solo permite visualizar la información.'
          : 'Solo los usuarios autorizados pueden editar personal.',
      });
      return;
    }
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
          headers: {
            ...actorHeaders,
          },
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
      <DashboardLayout title="Editar proveedor" subtitle={`Registro #${personaId ?? ''}`} headerContent={headerContent}>
        <p className="form-info">Cargando información del proveedor...</p>
      </DashboardLayout>
    );
  }
  if (loadError || !detail) {
    return (
      <DashboardLayout title="Editar proveedor" subtitle={`Registro #${personaId ?? ''}`} headerContent={headerContent}>
        <p className="form-info form-info--error">{loadError ?? 'No se encontraron datos.'}</p>
      </DashboardLayout>
    );
  }

  const fullName = [detail.nombres, detail.apellidos].filter(Boolean).join(' ').trim();
  const historyEntries = detail.history ?? [];

  return (
    <DashboardLayout title="Editar proveedor" subtitle={fullName || `Registro #${detail.id}`} headerContent={headerContent}>
      {metaError ? <p className="form-info form-info--error">{metaError}</p> : null}
      {metaLoading ? <p className="form-info">Cargando datos de referencia...</p> : null}
      {isReadOnly ? (
        <p className="form-info">
          Solo los usuarios autorizados pueden editar proveedores. Estás en modo lectura.
        </p>
      ) : null}
      <fieldset disabled={isReadOnly} className="personal-edit-fieldset">
      <section className="personal-edit-section">
        <h2>Datos del proveedor</h2>
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
            <span>Legajo</span>
            <input
              type="text"
              value={formValues.legajo}
              onChange={(event) => setFormValues((prev) => ({ ...prev, legajo: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
          <label className="input-control">
            <span>{PERSON_TAX_ID_LABEL}</span>
            <input
              type="text"
              value={formValues.cuil}
              onChange={(event) => {
                const nextValue = event.target.value.replace(/\D+/g, '').slice(0, 11);
                setFormValues((prev) => ({ ...prev, cuil: nextValue }));
                setNosisLookupError(null);
                setNosisLookupInfo(null);
                nosisLastLookupRef.current = null;
              }}
              placeholder="Ingresar"
              inputMode="numeric"
              maxLength={11}
            />
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                void lookupNosisByDocumento(true);
              }}
              disabled={nosisLookupLoading || isReadOnly}
              style={{ alignSelf: 'flex-start' }}
            >
              {nosisLookupLoading ? 'Consultando...' : 'Autocompletar'}
            </button>
            {nosisLookupError ? <span className="form-info form-info--error">{nosisLookupError}</span> : null}
            {!nosisLookupError && nosisLookupInfo ? <span className="form-info form-info--success">{nosisLookupInfo}</span> : null}
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
            <input type="text" value={perfilLabel} readOnly disabled={isReadOnly} />
          </label>
          <label className="input-control">
            <span>Fecha de alta</span>
            <input
              type="date"
              value={formValues.fechaAlta}
              onChange={(event) => setFormValues((prev) => ({ ...prev, fechaAlta: event.target.value }))}
              disabled={isReadOnly}
            />
          </label>
          <label className="input-control">
            <span>CBU / Alias</span>
            <input
              type="text"
              value={formValues.cbuAlias}
              onChange={(event) => setFormValues((prev) => ({ ...prev, cbuAlias: event.target.value }))}
              placeholder="Ingresar"
              disabled={isReadOnly || !canEditCbu}
            />
          </label>
          <label className="input-control">
            <span>Pago</span>
            <select
              value={formValues.pago}
              onChange={(event) => setFormValues((prev) => ({ ...prev, pago: event.target.value }))}
              disabled={isReadOnly}
            >
              <option value="">S/N factura</option>
              {PAGO_SELECT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    combustible: event.target.checked,
                    combustibleEstado: event.target.checked ? prev.combustibleEstado : '',
                  }))
                }
              />
              Cuenta corrientes combustible
            </div>
            {formValues.combustible ? (
              <select
                value={formValues.combustibleEstado}
                onChange={(event) => setFormValues((prev) => ({ ...prev, combustibleEstado: event.target.value }))}
                disabled={isReadOnly}
                style={{ marginTop: '0.5rem' }}
              >
                <option value="">Seleccionar estado</option>
                <option value="activo">Activo</option>
                <option value="suspendido">Suspendido</option>
              </select>
            ) : null}
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
          <label className="input-control">
            <span>Observación tarifa</span>
            <input
              type="text"
              value={formValues.observacionTarifa}
              onChange={(event) => setFormValues((prev) => ({ ...prev, observacionTarifa: event.target.value }))}
              placeholder="Ingresar"
            />
          </label>
        </div>
      </section>

      <section className="personal-edit-section">
        <h2>Datos de cobrador</h2>
        <div className="form-grid">
          <label className="input-control">
            <span>¿Es cobrador?</span>
            <div className="checkbox-control">
              <input
                type="checkbox"
                checked={cobradorLocked || formValues.esCobrador}
                onChange={cobradorLocked ? undefined : handleCobradorToggle}
                disabled={isReadOnly || cobradorLocked}
              />
              Marcar si los datos pertenecen a un cobrador
            </div>
          </label>
          {cobradorLocked || formValues.esCobrador ? (
            <>
              <label className="input-control">
                <span>Nombre completo del cobrador</span>
                <input
                  type="text"
                  value={formValues.cobradorNombre}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, cobradorNombre: event.target.value }))}
                  placeholder="Ingresar"
                  disabled={isReadOnly}
                />
              </label>
              <label className="input-control">
                <span>Correo del cobrador</span>
                <input
                  type="email"
                  value={formValues.cobradorEmail}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, cobradorEmail: event.target.value }))}
                  placeholder="Ingresar"
                  disabled={isReadOnly}
                />
              </label>
              <label className="input-control">
                <span>{COLLECTOR_TAX_ID_LABEL}</span>
                <input
                  type="text"
                  value={formValues.cobradorCuil}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, cobradorCuil: event.target.value }))}
                  placeholder="Ingresar"
                  disabled={isReadOnly}
                />
              </label>
              <label className="input-control">
                <span>CBU/Alias del cobrador</span>
                <input
                  type="text"
                  value={formValues.cobradorCbuAlias}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, cobradorCbuAlias: event.target.value }))}
                  placeholder="Ingresar"
                  disabled={isReadOnly || !canEditCbu}
                />
              </label>
            </>
          ) : null}
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
          {isEstadoBaja ? (
            <label className="input-control">
              <span>Fecha de baja</span>
              <input
                type="date"
                value={formValues.fechaBaja}
                onChange={(event) => setFormValues((prev) => ({ ...prev, fechaBaja: event.target.value }))}
                disabled={isReadOnly}
                required={isEstadoBaja}
              />
            </label>
          ) : null}
          <label className="input-control">
            <span>Membresía desde</span>
            <input
              type="date"
              value={formValues.membresiaDesde}
              onChange={(event) => setFormValues((prev) => ({ ...prev, membresiaDesde: event.target.value }))}
              disabled={isReadOnly}
            />
          </label>
        </div>
      </section>

      {formValues.perfilValue === 2 ? (
        <section className="personal-edit-section">
          <h2>Dueño de la unidad</h2>
          <div className="form-grid">
            <label className="input-control">
              <span>Nombre completo (Dueño)</span>
              <input
                type="text"
                value={formValues.duenoNombre}
                onChange={(event) => setFormValues((prev) => ({ ...prev, duenoNombre: event.target.value }))}
                placeholder="Ingresar"
              />
            </label>
            <label className="input-control">
              <span>Fecha de nacimiento</span>
              <input
                type="date"
                value={formValues.duenoFechaNacimiento}
                onChange={(event) => setFormValues((prev) => ({ ...prev, duenoFechaNacimiento: event.target.value }))}
              />
            </label>
            <label className="input-control">
              <span>Correo (Dueño)</span>
              <input
                type="email"
                value={formValues.duenoEmail}
                onChange={(event) => setFormValues((prev) => ({ ...prev, duenoEmail: event.target.value }))}
                placeholder="Ingresar"
              />
            </label>
            <label className="input-control">
              <span>{OWNER_TAX_ID_LABEL}</span>
              <input
                type="text"
                value={formValues.duenoCuil}
                onChange={(event) => setFormValues((prev) => ({ ...prev, duenoCuil: event.target.value }))}
                placeholder="Ingresar"
              />
            </label>
            <label className="input-control">
              <span>{OWNER_COLLECTOR_TAX_ID_LABEL}</span>
              <input
                type="text"
                value={formValues.duenoCuilCobrador}
                onChange={(event) => setFormValues((prev) => ({ ...prev, duenoCuilCobrador: event.target.value }))}
                placeholder="Ingresar"
              />
            </label>
            <label className="input-control">
              <span>CBU/Alias (Dueño)</span>
              <input
                type="text"
                value={formValues.duenoCbuAlias}
                onChange={(event) => setFormValues((prev) => ({ ...prev, duenoCbuAlias: event.target.value }))}
                placeholder="Ingresar"
                disabled={isReadOnly || !canEditCbu}
              />
            </label>
            <label className="input-control">
              <span>Teléfono (Dueño)</span>
              <input
                type="text"
                value={formValues.duenoTelefono}
                onChange={(event) => setFormValues((prev) => ({ ...prev, duenoTelefono: event.target.value }))}
                placeholder="Ingresar"
              />
            </label>
          </div>
        </section>
      ) : null}

      <section className="personal-edit-section">
        <h2>Observaciones</h2>
        <label className="input-control">
          <textarea
            value={formValues.observaciones}
          onChange={(event) => setFormValues((prev) => ({ ...prev, observaciones: event.target.value }))}
          rows={3}
          disabled={isReadOnly}
        />
      </label>
      {saveError ? <p className="form-info form-info--error">{saveError}</p> : null}
      {saveSuccess ? <p className="form-info form-info--success">{saveSuccess}</p> : null}
      {assignmentDraft.hasAssignmentChange ? (
        <p className="form-info">
          Detectamos cambios en cliente/sucursal. Enviá solicitud para que la apruebe el agente responsable.
        </p>
      ) : null}
      {assignmentRequestError ? <p className="form-info form-info--error">{assignmentRequestError}</p> : null}
      {assignmentRequestInfo ? <p className="form-info form-info--success">{assignmentRequestInfo}</p> : null}
      {disapproveError ? <p className="form-info form-info--error">{disapproveError}</p> : null}
      <div className="form-actions">
        <button type="button" className="secondary-action" onClick={() => navigate('/personal')}>
          Cancelar
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={handleSubmitCambioAsignacion}
          disabled={assignmentRequestSubmitting || isReadOnly || !assignmentDraft.hasAssignmentChange}
        >
          {assignmentRequestSubmitting ? 'Enviando...' : 'Solicitar cambio de asignación'}
        </button>
        {detail.aprobado ? (
          <button
            type="button"
            className="secondary-action"
            onClick={handleDisapprove}
            disabled={disapproving || isReadOnly}
          >
            {disapproving ? 'Revirtiendo...' : 'Revertir aprobación'}
          </button>
        ) : null}
        <button type="button" className="primary-action" onClick={handleSave} disabled={saving || isReadOnly}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </section>
      </fieldset>
      <section className="personal-edit-section">
        <div className="review-comments__header">
          <h2>Historial de cambios</h2>
          {historyEntries.length > 3 ? (
            <button
              type="button"
              className="secondary-action secondary-action--ghost"
              onClick={() => setShowAllHistory((prev) => !prev)}
            >
              {showAllHistory ? 'Mostrar menos' : 'Mostrar mas'}
            </button>
          ) : null}
        </div>
        <div className="history-list">
          {historyEntries.length === 0 ? (
            <p>No hay historial disponible para este registro.</p>
          ) : (
            (showAllHistory ? historyEntries : historyEntries.slice(0, 3)).map((entry) => (
              <div key={entry.id} className="history-entry">
                <div className="history-entry__header">
                  <span className="history-entry__author">{entry.authorName ?? 'Sistema'}</span>
                  <span className="history-entry__time">{entry.createdAtLabel ?? ''}</span>
                </div>
                {entry.description ? <p className="history-entry__description">{entry.description}</p> : null}
                {entry.changes.length > 0 ? (
                  <ul className="history-entry__changes">
                    {entry.changes.map((change: any, index: number) => {
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
        <div className="review-comments__header">
          <h2>Chat interno</h2>
          {Array.isArray(detail.comments) && detail.comments.length > 3 ? (
            <button
              type="button"
              className="secondary-action secondary-action--ghost"
              onClick={() => setDetailChatOpen((prev) => !prev)}
            >
              {detailChatOpen ? 'Ocultar' : 'Ver todo'}
            </button>
          ) : null}
        </div>
        {Array.isArray(detail.comments) && detail.comments.length > 0 ? (
          <div className={`review-comments__body${detailChatOpen ? ' is-open' : ''}`}>
            <ul className="review-comment-list">
              {(detailChatOpen ? detail.comments : detail.comments.slice(0, 3)).map((comment) => (
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
              value={commentText}
              onChange={(event) => {
                setCommentText(event.target.value);
                if (commentError) {
                  setCommentError(null);
                }
              }}
              placeholder="Escribe un mensaje para tu equipo"
              disabled={commentSaving || isReadOnly}
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
            <button
              type="button"
              className="primary-action"
              onClick={handleCommentSubmit}
              disabled={commentSaving || isReadOnly}
            >
              {commentSaving ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
          {commentError ? <p className="form-info form-info--error">{commentError}</p> : null}
          {commentInfo ? <p className="form-info form-info--success">{commentInfo}</p> : null}
        </div>
      </section>

      <TaxProfileSection
        entityType="persona"
        entityId={detail?.id ?? null}
        apiBaseUrl={apiBaseUrl}
        actorHeaders={actorHeaders}
        readOnly={isReadOnly}
        title="Legajo impositivo"
        subtitle="Datos fiscales y bancarios del proveedor/distribuidor con snapshots persistidos de Nosis."
      />

      <section className="personal-edit-section">
        <h2>Documentos</h2>
        {visibleDocuments.length > 0
          ? (() => {
              const downloadAllUrl = resolveApiUrl(
                apiBaseUrl,
                detail.documentsDownloadAllAbsoluteUrl
                  ?? detail.documentsDownloadAllUrl
                  ?? (detail
                    ? `/api/personal/${detail.id}/documentos/descargar-todos`
                    : null)
              );
              const downloadAllHref = withAuthToken(downloadAllUrl);
              const shouldShowDeleteExpired = documentStatusCounts.vencidos > 0;

              return downloadAllHref || shouldShowDeleteExpired ? (
                <div className="personal-documents-actions">
                  {downloadAllHref ? (
                    <a className="secondary-action" href={downloadAllHref} download>
                      Descargar todos
                    </a>
                  ) : null}
                  {shouldShowDeleteExpired ? (
                    <button
                      type="button"
                      className="secondary-action secondary-action--danger"
                      onClick={handleDeleteExpiredDocuments}
                      disabled={isReadOnly || deletingExpiredDocuments}
                      title={isReadOnly ? 'No tenés permisos para eliminar documentos.' : 'Eliminar documentos vencidos'}
                    >
                      {deletingExpiredDocuments
                        ? 'Eliminando...'
                        : `Eliminar vencidos (${documentStatusCounts.vencidos})`}
                    </button>
                  ) : null}
                </div>
              ) : null;
            })()
          : null}
        <div className="form-actions">
          <button
            type="button"
            className={documentFilter === 'todos' ? 'primary-action' : 'secondary-action'}
            onClick={() => setDocumentFilter('todos')}
          >
            Todos ({documentStatusCounts.total})
          </button>
          <button
            type="button"
            className={documentFilter === 'vencido' ? 'primary-action' : 'secondary-action'}
            onClick={() => setDocumentFilter('vencido')}
          >
            Vencidos ({documentStatusCounts.vencidos})
          </button>
          <button
            type="button"
            className={documentFilter === 'por_vencer' ? 'primary-action' : 'secondary-action'}
            onClick={() => setDocumentFilter('por_vencer')}
          >
            Por vencer ({documentStatusCounts.porVencer})
          </button>
          <button
            type="button"
            className={documentFilter === 'vigente' ? 'primary-action' : 'secondary-action'}
            onClick={() => setDocumentFilter('vigente')}
          >
            Vigentes ({documentStatusCounts.vigentes})
          </button>
          <button
            type="button"
            className={documentFilter === 'sin_vencimiento' ? 'primary-action' : 'secondary-action'}
            onClick={() => setDocumentFilter('sin_vencimiento')}
          >
            Sin vencimiento ({documentStatusCounts.sinVencimiento})
          </button>
        </div>
        {filteredDocuments.length > 0 ? (
          <ul className="document-status-list">
            {(showAllDocuments ? filteredDocuments : filteredDocuments.slice(0, 6)).map((doc: any) => {
              const docId = Number(doc?.id);
              const isDeletingDoc = deletingExpiredDocuments || (Number.isFinite(docId) && deletingDocumentIds.has(docId));
              const fallbackPath = `/api/personal/${detail.id}/documentos/${doc.id}/descargar`;
              const resolvedUrl = resolveApiUrl(apiBaseUrl, doc.absoluteDownloadUrl ?? doc.downloadUrl ?? fallbackPath);
              const resolvedSourceUrl = doc.sourceDownloadUrl
                ? resolveApiUrl(apiBaseUrl, doc.sourceDownloadUrl)
                : null;
              const previewPath = `/api/personal/${detail.id}/documentos/${doc.id}/preview`;
              const previewUrl = resolvedSourceUrl ?? resolveApiUrl(apiBaseUrl, previewPath);
              const downloadHref = withAuthToken(resolvedSourceUrl ?? resolvedUrl);
              const statusLabel = (() => {
                switch (doc.status) {
                  case 'vencido':
                    return { label: 'Vencido', className: 'badge badge--danger' };
                  case 'por_vencer':
                    return { label: 'Por vencer', className: 'badge badge--warning' };
                  case 'vigente':
                    return { label: 'Vigente', className: 'badge badge--success' };
                  default:
                    return { label: 'Sin vencimiento', className: 'badge' };
                }
              })();
              const docLabel = doc.tipoNombre
                ? `${doc.tipoNombre}${doc.nombre ? ` – ${doc.nombre}` : ''}`
                : doc.nombre ?? `Documento #${doc.id}`;
              const isPreviewable = Boolean(doc.mime && (doc.mime.startsWith('image/') || doc.mime.includes('pdf')));
              return (
                <li key={doc.id} className="document-status-item">
                  <div className="document-status-info">
                    <span>{docLabel}</span>
                    {doc.fechaVencimiento ? (
                      <small>Vence: {doc.fechaVencimiento}</small>
                    ) : (
                      <small>Sin vencimiento</small>
                    )}
                  </div>
                  <div className="document-status-actions">
                    <span className={statusLabel.className}>{statusLabel.label}</span>
                    {resolvedUrl ? (
                      <button
                        type="button"
                        className="secondary-action secondary-action--ghost"
                        onClick={() => {
                          if (isPreviewable && previewUrl) {
                            void openDocumentPreview(previewUrl, docLabel, doc.mime);
                          } else {
                            window.open(resolvedUrl, '_blank', 'noopener');
                          }
                        }}
                        title={isPreviewable ? 'Ver documento' : 'Abrir documento'}
                        disabled={documentPreviewLoading}
                      >
                        {documentPreviewLoading ? 'Cargando...' : 'Ver'}
                      </button>
                    ) : null}
                    {downloadHref ? (
                      <a className="secondary-action" href={downloadHref} target="_blank" rel="noopener noreferrer">
                        Descargar
                      </a>
                    ) : null}
                    {doc.status === 'vencido' ? (
                      <button
                        type="button"
                        className="secondary-action secondary-action--danger"
                        onClick={() => void handleDeleteDocumento(doc)}
                        disabled={isReadOnly || isDeletingDoc}
                        title={isReadOnly ? 'No tenés permisos para eliminar documentos.' : 'Eliminar documento'}
                      >
                        {isDeletingDoc ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="form-info">No hay documentos para este filtro.</p>
        )}
        {filteredDocuments.length > 6 ? (
          <button
            type="button"
            className="secondary-action secondary-action--ghost"
            onClick={() => setShowAllDocuments((prev) => !prev)}
          >
            {showAllDocuments ? 'Mostrar menos' : 'Mostrar mas'}
          </button>
        ) : null}
        <div className="form-grid">
          <label className="input-control">
            <span>Documento</span>
            <select
              value={selectedDocumentId ?? ''}
              onChange={(event) => setSelectedDocumentId(event.target.value ? Number(event.target.value) : null)}
              disabled={visibleDocuments.length === 0}
            >
              <option value="">Seleccionar documento</option>
              {visibleDocuments.map((doc: any) => (
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
        {visibleDocuments.length === 0 ? (
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
              disabled={documentTypesLoading || isReadOnly}
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
                disabled={isReadOnly}
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
              disabled={isReadOnly}
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
                    disabled={isReadOnly}
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
            documentTypesLoading ||
            isReadOnly
          }
        >
          {uploading ? 'Subiendo...' : 'Subir documentos'}
        </button>
      </section>
      {documentPreview ? (
        <div
          className="preview-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Vista previa de ${documentPreview.label}`}
          onClick={closeDocumentPreview}
        >
          <div className="preview-modal__content" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="preview-modal__close"
              aria-label="Cerrar vista previa"
              onClick={closeDocumentPreview}
            >
              ×
            </button>
            {documentPreviewLoading ? (
              <p className="form-info">Cargando vista previa...</p>
            ) : documentPreviewError ? (
              <p className="form-info form-info--error">{documentPreviewError}</p>
            ) : documentPreview.mime?.includes('pdf') ? (
              <iframe
                title={`Vista previa de ${documentPreview.label}`}
                src={documentPreview.url}
                className="preview-modal__frame"
              />
            ) : (
              <img
                src={documentPreview.url}
                alt={`Vista previa de ${documentPreview.label}`}
                className="preview-modal__image"
              />
            )}
            <p className="preview-modal__caption">{documentPreview.label}</p>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
};
