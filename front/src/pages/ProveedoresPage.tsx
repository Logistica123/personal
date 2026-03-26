import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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

type StoredPersonalFilters = {
  cliente?: string;
  sucursal?: string;
  fechaAltaPreset?: string;
  fechaAltaFrom?: string;
  fechaAltaTo?: string;
  pago?: string;
  legajo?: string;
  [key: string]: string | undefined;
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

const OWNER_COLLECTOR_TAX_ID_LABEL = 'CUIT/CUIL cobrador';

type ProveedoresPageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  getUserRole: (authUser: AuthUser | null | undefined) => string;
  isPersonalEditor: (authUser: AuthUser | null | undefined) => boolean;
  buildActorHeaders: (authUser: AuthUser | null | undefined) => Record<string, string>;
  buildPersonalFiltersStorageKey: (userId: number | null | undefined) => string | null;
  readStoredPersonalFilters: (storageKey: string | null) => StoredPersonalFilters;
  isElevatedRole: (role: string) => boolean;
  PERSON_TAX_ID_LABEL: string;
  getPerfilDisplayLabel: (perfilValue: number | null, perfil?: string) => string;
  getEstadoBadgeClass: (estado: string | null | undefined) => string;
  formatPagoLabel: (value: string | null | undefined) => string;
};

export const ProveedoresPage: React.FC<ProveedoresPageProps> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  getUserRole,
  isPersonalEditor,
  buildActorHeaders,
  buildPersonalFiltersStorageKey,
  readStoredPersonalFilters,
  isElevatedRole,
  PERSON_TAX_ID_LABEL,
  getPerfilDisplayLabel,
  getEstadoBadgeClass,
  formatPagoLabel,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const authUser = useStoredAuthUser();
  const userRole = useMemo(() => getUserRole(authUser), [authUser]);
  const canManagePersonal = useMemo(() => isPersonalEditor(authUser), [authUser]);
  const actorHeaders = useMemo(() => buildActorHeaders(authUser), [authUser]);
  const personalFiltersStorageKey = useMemo(
    () => buildPersonalFiltersStorageKey(authUser?.id ?? null),
    [authUser?.id]
  );
  const resolveStoredFilters = useCallback(() => readStoredPersonalFilters(personalFiltersStorageKey), [personalFiltersStorageKey]);
  const [personal, setPersonal] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [clienteFilter, setClienteFilter] = useState(() => resolveStoredFilters().cliente ?? '');
  const [sucursalFilter, setSucursalFilter] = useState(() => resolveStoredFilters().sucursal ?? '');
  const [altaDatePreset, setAltaDatePreset] = useState(() => resolveStoredFilters().fechaAltaPreset ?? '');
  const [altaDateFrom, setAltaDateFrom] = useState(() => resolveStoredFilters().fechaAltaFrom ?? '');
  const [altaDateTo, setAltaDateTo] = useState(() => resolveStoredFilters().fechaAltaTo ?? '');
  const [perfilFilter, setPerfilFilter] = useState('');
  const [agenteFilter, setAgenteFilter] = useState('');
  const [unidadFilter, setUnidadFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [combustibleFilter, setCombustibleFilter] = useState('');
  const [tarifaFilter, setTarifaFilter] = useState('');
  const [pagoFilter, setPagoFilter] = useState(() => resolveStoredFilters().pago ?? '');
  const [patenteFilter, setPatenteFilter] = useState('');
  const [legajoFilter, setLegajoFilter] = useState(() => resolveStoredFilters().legajo ?? '');
  const [docStatusFilter, setDocStatusFilter] = useState<'vencido' | 'por_vencer' | 'vigente' | ''>('');
  const [membresiaFilter, setMembresiaFilter] = useState(false);
  const [docsSortActive, setDocsSortActive] = useState(false);
  const sinEstadoFilterValue = 'sin_estado';
  const noCitadoFilterValue = 'no_citado';
  const isNoCitadoEstado = useCallback((estado: string | null | undefined): boolean => {
    const normalized = (estado ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return normalized.includes('no citado') || normalized.includes('no sitado');
  }, []);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const personalColumnsStorageKey = 'personal.visibleColumns';
  const personalColumnOptions = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'nombre', label: 'Nombre' },
      { key: 'legajo', label: 'Legajo' },
      { key: 'cuil', label: PERSON_TAX_ID_LABEL },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'email', label: 'Email' },
      { key: 'perfil', label: 'Perfil' },
      { key: 'agente', label: 'Agente' },
      { key: 'estado', label: 'Estado' },
      { key: 'combustible', label: 'Combustible' },
      { key: 'combustibleEstado', label: 'Estado combustible' },
      { key: 'tarifaEspecial', label: 'Tarifa especial' },
      { key: 'pago', label: 'Pago' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'unidad', label: 'Unidad' },
      { key: 'patente', label: 'Patente' },
      { key: 'sucursal', label: 'Sucursal' },
      { key: 'fechaAlta', label: 'Fecha alta' },
      { key: 'fechaBaja', label: 'Fecha baja' },
      { key: 'fechaNacimientoProveedor', label: 'Fecha nacimiento' },
      { key: 'docs', label: 'Docs' },
      { key: 'qrIngresos', label: 'Ingresos QR' },
      { key: 'qrUltimoIngreso', label: 'Último ingreso' },
      { key: 'acciones', label: 'Acciones', locked: true },
    ],
    []
  );
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    let stored: Record<string, boolean> | null = null;
    try {
      const raw = localStorage.getItem(personalColumnsStorageKey);
      stored = raw ? (JSON.parse(raw) as Record<string, boolean>) : null;
    } catch (error) {
      stored = null;
    }
    personalColumnOptions.forEach((column) => {
      initial[column.key] = stored?.[column.key] ?? true;
    });
    return initial;
  });
  useEffect(() => {
    try {
      localStorage.setItem(personalColumnsStorageKey, JSON.stringify(visibleColumns));
    } catch (error) {
      // ignore storage failures (private mode, quota, etc)
    }
  }, [personalColumnsStorageKey, visibleColumns]);

  const resolveProveedorEmail = useCallback((registro: PersonalRecord): string | null => {
    const cobradorEmail = (registro.cobradorEmail ?? '').trim();
    if (cobradorEmail) {
      return cobradorEmail;
    }

    const email = (registro.email ?? '').trim();
    return email || null;
  }, []);
  const mapEstadoParamToFilter = useCallback(
    (value: string | null): string => {
      if (!value) {
        return '';
      }
      const normalized = value.trim().toLowerCase();
      if (normalized === 'todos') {
        return '';
      }
      if (normalized === sinEstadoFilterValue || normalized === 'sin estado') {
        return sinEstadoFilterValue;
      }
      if (normalized === noCitadoFilterValue || normalized === 'no citado' || normalized === 'no sitado') {
        return noCitadoFilterValue;
      }
      if (
        normalized === 'pre_activo' ||
        normalized === 'pre activo' ||
        normalized === 'pre-activo' ||
        normalized === 'preactivo'
      ) {
        return 'Pre activo';
      }
      if (normalized === 'activo') {
        return 'Activo';
      }
      if (normalized === 'baja') {
        return 'Baja';
      }
      if (normalized === 'suspendido') {
        return 'Suspendido';
      }
      if (normalized === 'cancelado') {
        return 'Cancelado';
      }
      return normalized;
    },
    [noCitadoFilterValue, sinEstadoFilterValue]
  );
  const updateEstadoQuery = useCallback(
    (value: string) => {
      if (location.pathname !== '/personal') {
        return;
      }
      const params = new URLSearchParams(location.search);
      const normalized =
        value === ''
          ? 'todos'
          : value === sinEstadoFilterValue
          ? sinEstadoFilterValue
          : value === noCitadoFilterValue
          ? noCitadoFilterValue
          : value.toLowerCase();
      params.set('estado', normalized);
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    },
    [location.pathname, location.search, navigate, noCitadoFilterValue, sinEstadoFilterValue]
  );
  const isColumnVisible = useCallback(
    (key: string) => visibleColumns[key] !== false,
    [visibleColumns]
  );
  const visibleColumnCount = useMemo(
    () => personalColumnOptions.filter((column) => visibleColumns[column.key] !== false).length,
    [personalColumnOptions, visibleColumns]
  );
  const [deletingPersonalId, setDeletingPersonalId] = useState<number | null>(null);
  const [revealedContacts, setRevealedContacts] = useState<Record<number, { phone: boolean; email: boolean }>>({});
  const bypassContactGuard = useMemo(
    () => (authUser?.email ?? '').trim().toLowerCase() === 'xmaldonado@logisticaargentinasrl.com.ar',
    [authUser?.email]
  );
  const canCopyProtectedContacts = isElevatedRole(userRole);

  const fetchPersonal = useCallback(
    async (options?: { signal?: AbortSignal; silent?: boolean }) => {
      const silent = options?.silent === true;
      try {
        if (!silent) {
          setLoading(true);
        }
        setError(null);

        const response = await fetch(`${apiBaseUrl}/api/personal?includePending=1&_=${Date.now()}`, {
          signal: options?.signal,
          cache: 'no-store',
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
        if (!silent) {
          setLoading(false);
        }
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
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchPersonal({ silent: true });
      }
    }, 45000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchPersonal]);

  useEffect(() => {
    const stored = resolveStoredFilters();
    setClienteFilter(stored.cliente ?? '');
    setSucursalFilter(stored.sucursal ?? '');
    setAltaDatePreset(stored.fechaAltaPreset ?? '');
    setAltaDateFrom(stored.fechaAltaFrom ?? '');
    setAltaDateTo(stored.fechaAltaTo ?? '');
    setPatenteFilter(stored.patente ?? '');
    setLegajoFilter(stored.legajo ?? '');
    setPagoFilter(stored.pago ?? '');
  }, [resolveStoredFilters]);

  useEffect(() => {
    if (!personalFiltersStorageKey || typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(
        personalFiltersStorageKey,
        JSON.stringify({
          cliente: clienteFilter,
          sucursal: sucursalFilter,
          fechaAltaPreset: altaDatePreset,
          fechaAltaFrom: altaDateFrom,
          fechaAltaTo: altaDateTo,
          patente: patenteFilter,
          legajo: legajoFilter,
          pago: pagoFilter,
        })
      );
    } catch {
      // ignore write errors (storage full, etc.)
    }
  }, [personalFiltersStorageKey, clienteFilter, sucursalFilter, altaDatePreset, altaDateFrom, altaDateTo, patenteFilter, legajoFilter, pagoFilter]);

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
      1: getPerfilDisplayLabel(1),
      2: getPerfilDisplayLabel(2),
      3: getPerfilDisplayLabel(3),
    }),
    []
  );

  const baseFilteredPersonal = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const resolvePerfilLabel = (registro: PersonalRecord) =>
      getPerfilDisplayLabel(registro.perfilValue ?? null, registro.perfil ?? '');
    const parseDateOnlyUtc = (value: string | null | undefined): number | null => {
      if (!value) {
        return null;
      }
      const normalized = value.trim();
      if (!normalized) {
        return null;
      }
      const [datePart] = normalized.split('T');
      const [yearStr, monthStr, dayStr] = datePart.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      const day = Number(dayStr);

      if ([year, month, day].every((part) => Number.isFinite(part))) {
        return Date.UTC(year, month - 1, day);
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
    const matchesAltaDate = (fechaAlta: string | null | undefined): boolean => {
      const target = parseDateOnlyUtc(fechaAlta);
      const presetMatches = (() => {
        if (!altaDatePreset) {
          return true;
        }
        if (target === null) {
          return false;
        }
        switch (altaDatePreset) {
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

      const rangeMatches = (() => {
        const fromUtc = parseDateOnlyUtc(altaDateFrom);
        const toUtc = parseDateOnlyUtc(altaDateTo);
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

      return presetMatches && rangeMatches;
    };

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
        const nombre = perfilNames[registro.perfilValue ?? 0] ?? resolvePerfilLabel(registro);
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

      if (patenteFilter) {
        const normalizedPatente = (registro.patente ?? '').trim().toLowerCase();
        if (!normalizedPatente.includes(patenteFilter.trim().toLowerCase())) {
          return false;
        }
      }

      if (legajoFilter.trim()) {
        const normalizedLegajo = (registro.legajo ?? '').trim().toLowerCase();
        if (!normalizedLegajo.includes(legajoFilter.trim().toLowerCase())) {
          return false;
        }
      }

      if (estadoFilter && registro.estado !== estadoFilter) {
        if (estadoFilter === sinEstadoFilterValue) {
          if (registro.estado) {
            return false;
          }
        } else if (estadoFilter === noCitadoFilterValue) {
          if (!isNoCitadoEstado(registro.estado)) {
            return false;
          }
        } else {
          return false;
        }
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

      if (pagoFilter) {
        const target = pagoFilter === 'true';
        const pagoValue = parsePagoFlag(registro.pago);
        if (pagoValue === null || pagoValue !== target) {
          return false;
        }
      }

      if (!matchesAltaDate(registro.fechaAlta)) {
        return false;
      }

      if (term.length === 0) {
        return true;
      }

      const fields = [
        registro.nombre,
        registro.cuil,
        registro.telefono,
        resolveProveedorEmail(registro),
        registro.cliente,
        registro.unidad,
        registro.unidadDetalle,
        registro.sucursal,
        registro.fechaAlta,
        resolvePerfilLabel(registro),
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
    altaDatePreset,
    altaDateFrom,
    altaDateTo,
    perfilNames,
    legajoFilter,
    pagoFilter,
    noCitadoFilterValue,
    sinEstadoFilterValue,
    isNoCitadoEstado,
    resolveProveedorEmail,
  ]);

  const filteredPersonal = useMemo(() => {
    let list = baseFilteredPersonal;

    if (docStatusFilter) {
      list = list.filter((registro) => (registro.documentacionStatus ?? null) === docStatusFilter);
    }

    if (membresiaFilter) {
      list = list.filter((registro) => Boolean(registro.membresiaDesde));
    }

    if (!docsSortActive) {
      return list;
    }

    const statusRank = (status: PersonalRecord['documentacionStatus']): number => {
      switch (status) {
        case 'vencido':
          return 0;
        case 'por_vencer':
          return 1;
        case 'vigente':
          return 2;
        case 'sin_documentos':
          return 3;
        default:
          return 4;
      }
    };

    return [...list].sort((a, b) => {
      const rankDiff = statusRank(a.documentacionStatus ?? null) - statusRank(b.documentacionStatus ?? null);
      if (rankDiff !== 0) {
        return rankDiff;
      }

      const vencidosDiff = (b.documentacionVencidos ?? 0) - (a.documentacionVencidos ?? 0);
      if (vencidosDiff !== 0) {
        return vencidosDiff;
      }

      const porVencerDiff = (b.documentacionPorVencer ?? 0) - (a.documentacionPorVencer ?? 0);
      if (porVencerDiff !== 0) {
        return porVencerDiff;
      }

      const totalDiff = (b.documentacionTotal ?? 0) - (a.documentacionTotal ?? 0);
      if (totalDiff !== 0) {
        return totalDiff;
      }

      return (a.nombre ?? '').localeCompare(b.nombre ?? '');
    });
  }, [baseFilteredPersonal, docStatusFilter, membresiaFilter, docsSortActive]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    clienteFilter,
    sucursalFilter,
    perfilFilter,
    agenteFilter,
    unidadFilter,
    patenteFilter,
    legajoFilter,
    estadoFilter,
    combustibleFilter,
    tarifaFilter,
    altaDatePreset,
    altaDateFrom,
    altaDateTo,
    pagoFilter,
    docsSortActive,
    docStatusFilter,
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
  const patenteOptions = useMemo(
    () =>
      Array.from(new Set(personal.map((registro) => registro.patente).filter((value): value is string => Boolean(value)))).sort(),
    [personal]
  );
  const estadoOptions = useMemo(
    () =>
      Array.from(new Set(personal.map((registro) => registro.estado).filter((value): value is string => Boolean(value)))).sort(),
    [personal]
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const estadoParam = params.get('estado');
    if (!estadoParam) {
      return;
    }
    const mapped = mapEstadoParamToFilter(estadoParam);
    if (!mapped && estadoFilter) {
      setEstadoFilter('');
      return;
    }
    if (mapped === sinEstadoFilterValue || mapped === noCitadoFilterValue) {
      if (estadoFilter !== mapped) {
        setEstadoFilter(mapped);
      }
      return;
    }
    const match = estadoOptions.find((option) => option.toLowerCase() === mapped.toLowerCase());
    if (match && match !== estadoFilter) {
      setEstadoFilter(match);
      return;
    }
    if (!match && mapped && mapped !== estadoFilter) {
      setEstadoFilter(mapped);
    }
  }, [estadoFilter, estadoOptions, location.search, mapEstadoParamToFilter, noCitadoFilterValue, sinEstadoFilterValue]);


  const clearFilters = () => {
    setClienteFilter('');
    setSucursalFilter('');
    setPerfilFilter('');
    setAgenteFilter('');
    setUnidadFilter('');
    setPatenteFilter('');
    setLegajoFilter('');
    setEstadoFilter('');
    updateEstadoQuery('');
    setCombustibleFilter('');
    setTarifaFilter('');
    setPagoFilter('');
    setDocStatusFilter('');
    setMembresiaFilter(false);
    setAltaDatePreset('');
    setAltaDateFrom('');
    setAltaDateTo('');
    setSearchTerm('');
    setCurrentPage(1);
    if (personalFiltersStorageKey && typeof window !== 'undefined') {
      window.localStorage.removeItem(personalFiltersStorageKey);
    }
  };

  const handleOpenTransportistaQr = async (registro: PersonalRecord) => {
    const landingUrl = registro.transportistaQrLandingUrl?.trim() ?? '';
    const redirectUrl = registro.transportistaQrRedirectUrl?.trim() ?? '';
    // Priorizamos redirect para registrar ingresos en backend.
    const qrTargetUrl = redirectUrl || landingUrl;
    const imageUrl =
      registro.transportistaQrImageUrl?.trim() ??
      `https://api.qrserver.com/v1/create-qr-code/?size=320x320&format=png&data=${encodeURIComponent(qrTargetUrl)}`;

    if (!qrTargetUrl) {
      window.alert('No se pudo generar el enlace QR para este transportista.');
      return;
    }

    const target = imageUrl;
    window.open(target, '_blank', 'noopener');

    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(qrTargetUrl);
      } catch {
        // Ignorado: algunos navegadores bloquean el portapapeles.
      }
    }
  };

  const handleDeletePersonal = async (registro: PersonalRecord) => {
    if (!canManagePersonal) {
      window.alert('Solo los usuarios autorizados pueden eliminar proveedores.');
      return;
    }
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
        headers: {
          ...actorHeaders,
        },
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
            { header: 'Legajo', resolve: (registro) => registro.legajo ?? '' },
            { header: PERSON_TAX_ID_LABEL, resolve: (registro) => registro.cuil ?? '' },
            { header: 'Teléfono', resolve: (registro) => registro.telefono ?? '' },
            { header: 'Email', resolve: (registro) => resolveProveedorEmail(registro) ?? '' },
            { header: 'Perfil', resolve: (registro) => getPerfilDisplayLabel(registro.perfilValue ?? null, registro.perfil ?? '') },
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
            { header: 'Fecha baja', resolve: (registro) => registro.fechaBaja ?? '' },
            { header: 'Combustible', resolve: (registro) => booleanLabel(registro.combustibleValue) },
            { header: 'Estado combustible', resolve: (registro) => registro.combustibleEstado ?? '' },
            { header: 'Tarifa especial', resolve: (registro) => booleanLabel(registro.tarifaEspecialValue) },
            { header: 'Pago', resolve: (registro) => formatPagoLabel(registro.pago) },
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
            { header: 'Fecha nacimiento proveedor', resolve: (registro) => registro.duenoFechaNacimiento ?? '' },
            { header: `Dueño ${PERSON_TAX_ID_LABEL}`, resolve: (registro) => registro.duenoCuil ?? '' },
            { header: `Dueño ${OWNER_COLLECTOR_TAX_ID_LABEL}`, resolve: (registro) => registro.duenoCuilCobrador ?? '' },
            { header: 'Dueño CBU alias', resolve: (registro) => registro.duenoCbuAlias ?? '' },
            { header: 'Dueño correo', resolve: (registro) => registro.duenoEmail ?? '' },
            { header: 'Dueño teléfono', resolve: (registro) => registro.duenoTelefono ?? '' },
            { header: 'Dueño observaciones', resolve: (registro) => registro.duenoObservaciones ?? '' },
            { header: 'Ingresos QR', resolve: (registro) => registro.transportistaQrScansCount ?? 0 },
            { header: 'Último ingreso QR', resolve: (registro) => registro.transportistaQrLastScanAtLabel ?? '' },
    ];

    const sanitizeCell = (raw: string): string => {
      const cleaned = raw.replace(/[\t\r\n]+/g, ' ').trim();
      if (/^\d+$/.test(cleaned) && (cleaned.length >= 10 || cleaned.startsWith('0'))) {
        // Prefijo invisible (word joiner) para que Excel lo trate como texto sin mostrar comillas ni signo igual
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

    const tsv = [headerRow, ...rows]
      .map((row) => row.join('\t'))
      .join('\n');

    const BOM = '\ufeff';
    const blob = new Blob([BOM + tsv], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `personal-${Date.now()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const footerLabel = useMemo(() => {
    if (loading) {
      return 'Cargando proveedores...';
    }

    if (error) {
      return 'No se pudo cargar los proveedores';
    }

    if (totalRecords === 0) {
      return 'No hay registros para mostrar.';
    }

    return `Mostrando ${startIndex + 1} - ${endIndex} de ${totalRecords} registros`;
  }, [loading, error, totalRecords, startIndex, endIndex]);

  const resolveDocumentacionBadge = (registro: PersonalRecord) => {
    const status = registro.documentacionStatus ?? null;
    const vencidos = registro.documentacionVencidos ?? 0;
    const porVencer = registro.documentacionPorVencer ?? 0;
    const total = registro.documentacionTotal ?? 0;

    switch (status) {
      case 'vencido':
        return {
          label: `Vencido (${vencidos})`,
          className: 'badge badge--danger',
          filter: 'vencido',
        };
      case 'por_vencer':
        return {
          label: `Por vencer (${porVencer})`,
          className: 'badge badge--warning',
          filter: 'por_vencer',
        };
      case 'vigente':
        return {
          label: total > 0 ? `OK (${total})` : 'OK',
          className: 'badge badge--success',
          filter: 'vigente',
        };
      case 'sin_documentos':
        return {
          label: 'Sin docs',
          className: 'badge',
          filter: 'sin_vencimiento',
        };
      default:
        return {
          label: '—',
          className: 'badge',
          filter: 'todos',
        };
    }
  };

  const logContactReveal = useCallback(
    async (personaId: number, field: 'phone' | 'email') => {
      try {
        await fetch(`${apiBaseUrl}/api/personal/${personaId}/contact-reveal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...actorHeaders,
          },
          body: JSON.stringify({
            campo: field === 'phone' ? 'telefono' : 'email',
            actorId: authUser?.id ?? null,
            actorName: authUser?.name ?? null,
          }),
        });
      } catch (err) {
        console.warn('No se pudo registrar la visualización de contacto', err);
      }
    },
    [actorHeaders, apiBaseUrl, authUser?.id, authUser?.name]
  );

  const toggleContactVisibility = (registroId: number, field: 'phone' | 'email') => {
    const isCurrentlyRevealed =
      revealedContacts[registroId]?.[field === 'phone' ? 'phone' : 'email'] ?? false;
    setRevealedContacts(() => {
      if (isCurrentlyRevealed) {
        return {};
      }
      return {
        [registroId]: {
          phone: field === 'phone',
          email: field === 'email',
        },
      };
    });
    if (!isCurrentlyRevealed) {
      logContactReveal(registroId, field);
    }
  };

  const handleProtectedCopy = useCallback(
    (event: React.ClipboardEvent) => {
      if (!canCopyProtectedContacts) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [canCopyProtectedContacts]
  );

  const renderProtectedValue = (registroId: number, field: 'phone' | 'email', value?: string | null) => {
    const hasValue = Boolean(value);
    const isRevealed = revealedContacts[registroId]?.[field === 'phone' ? 'phone' : 'email'] ?? false;
    const displayValue = hasValue ? (isRevealed ? value : '••••••••') : '—';

    if (bypassContactGuard) {
      return (
        <div
          className="protected-cell"
          onCopy={handleProtectedCopy}
          style={{ userSelect: canCopyProtectedContacts ? 'text' : 'none' }}
        >
          <span>{hasValue ? value : '—'}</span>
        </div>
      );
    }

    return (
      <div
        className="protected-cell"
        onCopy={handleProtectedCopy}
        style={{ userSelect: canCopyProtectedContacts ? 'text' : 'none' }}
      >
        <span>{displayValue}</span>
        {hasValue ? (
          <button
            type="button"
            className="secondary-action secondary-action--ghost"
            style={{ marginLeft: '0.5rem', padding: '2px 8px', fontSize: '0.85rem' }}
            onClick={() => toggleContactVisibility(registroId, field)}
            title={isRevealed ? 'Ocultar' : 'Ver'}
          >
            {isRevealed ? 'Ocultar' : 'Ver'}
          </button>
        ) : null}
      </div>
    );
  };

  const documentSummary = useMemo(() => {
    const counts = {
      vencidos: 0,
      porVencer: 0,
      vigentes: 0,
      total: 0,
      sinDocs: 0,
    };

    baseFilteredPersonal.forEach((registro) => {
      const status = registro.documentacionStatus ?? null;
      if (status === 'vencido') {
        counts.vencidos += 1;
      } else if (status === 'por_vencer') {
        counts.porVencer += 1;
      } else if (status === 'vigente') {
        counts.vigentes += 1;
      } else if (status === 'sin_documentos') {
        counts.sinDocs += 1;
      }
    });

    counts.total = baseFilteredPersonal.length;

    return counts;
  }, [baseFilteredPersonal]);

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
          <span>Patente</span>
          <input
            type="text"
            list="patente-options"
            placeholder="Patente"
            value={patenteFilter}
            onChange={(event) => setPatenteFilter(event.target.value)}
          />
          <datalist id="patente-options">
            {patenteOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
        <label className="filter-field">
          <span>Legajo</span>
          <input
            type="text"
            placeholder="Legajo"
            value={legajoFilter}
            onChange={(event) => setLegajoFilter(event.target.value)}
          />
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
          <span>Pago</span>
          <select value={pagoFilter} onChange={(event) => setPagoFilter(event.target.value)}>
            <option value="">S/N factura</option>
            <option value="true">Con factura</option>
            <option value="false">Sin factura</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Fecha alta</span>
          <select value={altaDatePreset} onChange={(event) => setAltaDatePreset(event.target.value)}>
            <option value="">Todas</option>
            <option value="today">Hoy</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mes</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Fecha alta desde</span>
          <input
            type="date"
            value={altaDateFrom}
            onChange={(event) => setAltaDateFrom(event.target.value)}
          />
        </label>
        <label className="filter-field">
          <span>Fecha alta hasta</span>
          <input
            type="date"
            value={altaDateTo}
            onChange={(event) => setAltaDateTo(event.target.value)}
          />
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
        <div className="column-picker">
          <button
            type="button"
            className="secondary-action"
            onClick={() => setShowColumnPicker((prev) => !prev)}
          >
            Columnas
          </button>
          {showColumnPicker ? (
            <div className="column-picker__menu">
              {personalColumnOptions.map((column) => (
                <label key={column.key} className="column-picker__option">
                  <input
                    type="checkbox"
                    checked={visibleColumns[column.key] !== false}
                    disabled={Boolean(column.locked)}
                    onChange={() =>
                      setVisibleColumns((prev) => ({
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
        <button type="button" className="secondary-action" onClick={clearFilters}>
          Limpiar
        </button>
        <button type="button" className="secondary-action" onClick={() => void fetchPersonal()} disabled={loading}>
          Actualizar
        </button>
        <button type="button" className="secondary-action" onClick={handleExportCsv}>
          Exportar Excel
        </button>
        <button
          className="primary-action"
          type="button"
          onClick={() => navigate('/personal/nuevo')}
          disabled={!canManagePersonal}
          title={
            canManagePersonal
              ? undefined
              : 'Solo los usuarios autorizados pueden cargar proveedores.'
          }
        >
          Agregar proveedor
        </button>
      </div>
      <div className="summary-cards">
        <button
          type="button"
          className={`summary-card summary-card--danger summary-card--button${docStatusFilter === 'vencido' ? ' is-active' : ''}`}
          onClick={() => setDocStatusFilter((prev) => (prev === 'vencido' ? '' : 'vencido'))}
          title="Filtrar por proveedores con docs vencidos"
        >
          <span className="summary-card__label">Proveedores con docs vencidos</span>
          <strong className="summary-card__value">{documentSummary.vencidos}</strong>
        </button>
        <button
          type="button"
          className={`summary-card summary-card--warning summary-card--button${docStatusFilter === 'por_vencer' ? ' is-active' : ''}`}
          onClick={() => setDocStatusFilter((prev) => (prev === 'por_vencer' ? '' : 'por_vencer'))}
          title="Filtrar por proveedores con docs por vencer"
        >
          <span className="summary-card__label">Proveedores con docs por vencer</span>
          <strong className="summary-card__value">{documentSummary.porVencer}</strong>
        </button>
        <button
          type="button"
          className={`summary-card summary-card--accent summary-card--button${docStatusFilter === 'vigente' ? ' is-active' : ''}`}
          onClick={() => setDocStatusFilter((prev) => (prev === 'vigente' ? '' : 'vigente'))}
          title="Filtrar por proveedores con docs vigentes"
        >
          <span className="summary-card__label">Proveedores con docs vigentes</span>
          <strong className="summary-card__value">{documentSummary.vigentes}</strong>
        </button>
        <div className="summary-card summary-card--muted">
          <span className="summary-card__label">Total proveedores</span>
          <strong className="summary-card__value">{documentSummary.total}</strong>
        </div>
        {documentSummary.sinDocs > 0 ? (
          <div className="summary-card summary-card--neutral">
            <span className="summary-card__label">Personas sin docs</span>
            <strong className="summary-card__value">{documentSummary.sinDocs}</strong>
          </div>
        ) : null}
        <button
          type="button"
          className={`summary-card summary-card--button${membresiaFilter ? ' is-active' : ''}`}
          style={{ borderColor: membresiaFilter ? '#f5c518' : undefined, background: membresiaFilter ? '#fffbea' : undefined }}
          onClick={() => setMembresiaFilter((prev) => !prev)}
          title="Filtrar solo miembros"
        >
          <span className="summary-card__label">★ Miembros</span>
          <strong className="summary-card__value">
            {personal.filter((r) => !r.esSolicitud && Boolean(r.membresiaDesde)).length}
          </strong>
        </button>
      </div>
    </div>
  );

  return (
    <DashboardLayout title="Gestionar proveedores" subtitle="Gestionar proveedores" headerContent={headerContent}>
      {!canManagePersonal ? (
        <p className="form-info">
          Solo los usuarios autorizados pueden crear o editar proveedores. Estás en modo lectura.
        </p>
      ) : null}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {isColumnVisible('id') ? <th>ID</th> : null}
              {isColumnVisible('nombre') ? <th>Nombre</th> : null}
              {isColumnVisible('legajo') ? <th>Legajo</th> : null}
              {isColumnVisible('cuil') ? <th>{PERSON_TAX_ID_LABEL}</th> : null}
              {isColumnVisible('telefono') ? <th>Teléfono</th> : null}
              {isColumnVisible('email') ? <th>Email</th> : null}
              {isColumnVisible('perfil') ? <th>Perfil</th> : null}
              {isColumnVisible('agente') ? <th>Agente</th> : null}
              {isColumnVisible('estado') ? <th>Estado</th> : null}
              {isColumnVisible('combustible') ? <th>Combustible</th> : null}
              {isColumnVisible('combustibleEstado') ? <th>Estado combustible</th> : null}
              {isColumnVisible('tarifaEspecial') ? <th>Tarifa especial</th> : null}
              {isColumnVisible('pago') ? <th>Pago</th> : null}
              {isColumnVisible('cliente') ? <th>Cliente</th> : null}
              {isColumnVisible('unidad') ? <th>Unidad</th> : null}
              {isColumnVisible('patente') ? <th>Patente</th> : null}
              {isColumnVisible('sucursal') ? <th>Sucursal</th> : null}
              {isColumnVisible('fechaAlta') ? <th>Fecha alta</th> : null}
              {isColumnVisible('fechaBaja') ? <th>Fecha baja</th> : null}
              {isColumnVisible('fechaNacimientoProveedor') ? <th>Fecha nacimiento</th> : null}
              {isColumnVisible('docs') ? (
                <th>
                  <button
                    type="button"
                    className="secondary-action secondary-action--ghost"
                    onClick={() => setDocsSortActive((prev: boolean) => !prev)}
                    title="Ordenar por vencidos, por vencer y vigentes"
                  >
                    Docs{docsSortActive ? ' (orden)' : ''}
                  </button>
                </th>
              ) : null}
              {isColumnVisible('qrIngresos') ? <th>Ingresos QR</th> : null}
              {isColumnVisible('qrUltimoIngreso') ? <th>Último ingreso</th> : null}
              {isColumnVisible('acciones') ? <th>Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={visibleColumnCount}>Cargando proveedores...</td>
              </tr>
            )}

            {error && !loading && (
              <tr>
                <td colSpan={visibleColumnCount} className="error-cell">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && filteredPersonal.length === 0 && (
              <tr>
                <td colSpan={visibleColumnCount}>No hay registros para mostrar.</td>
              </tr>
            )}

            {!loading &&
              !error &&
              pageRecords.map((registro) => (
                <tr key={registro.rowId ?? registro.id}>
                  {isColumnVisible('id') ? <td>{registro.id}</td> : null}
                  {isColumnVisible('nombre') ? (
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
                      {registro.membresiaDesde ? (
                        <span
                          style={{ marginLeft: '0.35rem', fontSize: '0.75rem', color: '#888', whiteSpace: 'nowrap' }}
                        >
                          {(() => {
                            const desde = new Date(registro.membresiaDesde);
                            const hoy = new Date();
                            let meses = (hoy.getFullYear() - desde.getFullYear()) * 12 + (hoy.getMonth() - desde.getMonth());
                            if (meses < 0) meses = 0;
                            const anios = Math.floor(meses / 12);
                            const mesesRest = meses % 12;
                            if (anios > 0 && mesesRest > 0) return `${anios}a ${mesesRest}m`;
                            if (anios > 0) return `${anios}a`;
                            return `${meses}m`;
                          })()}
                        </span>
                      ) : null}
                    </td>
                  ) : null}
                  {isColumnVisible('legajo') ? <td>{registro.legajo ?? '—'}</td> : null}
                  {isColumnVisible('cuil') ? <td>{registro.cuil ?? '—'}</td> : null}
                  {isColumnVisible('telefono') ? (
                    <td>{renderProtectedValue(registro.id, 'phone', registro.telefono)}</td>
                  ) : null}
                  {isColumnVisible('email') ? (
                    <td>{renderProtectedValue(registro.id, 'email', resolveProveedorEmail(registro))}</td>
                  ) : null}
                  {isColumnVisible('perfil') ? (
                    <td>{getPerfilDisplayLabel(registro.perfilValue ?? null, registro.perfil ?? '—') || '—'}</td>
                  ) : null}
                  {isColumnVisible('agente') ? <td>{registro.agente ?? '—'}</td> : null}
                  {isColumnVisible('estado') ? (
                    <td>
                      {registro.estado ? (
                        <span className={`estado-badge ${getEstadoBadgeClass(registro.estado)}`}>
                          {registro.estado}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  ) : null}
                  {isColumnVisible('combustible') ? (
                    <td>
                      {registro.combustibleValue ? (
                        <span className="badge badge--success">Sí</span>
                      ) : (
                        <span className="badge badge--danger">No</span>
                      )}
                    </td>
                  ) : null}
                  {isColumnVisible('combustibleEstado') ? (
                    <td>
                      {registro.combustibleValue && registro.combustibleEstado ? (
                        <span
                          className={
                            registro.combustibleEstado === 'suspendido' ? 'badge badge--warning' : 'badge badge--success'
                          }
                        >
                          {registro.combustibleEstado === 'suspendido' ? 'Suspendido' : 'Activo'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  ) : null}
                  {isColumnVisible('tarifaEspecial') ? <td>{registro.tarifaEspecial ?? '—'}</td> : null}
                  {isColumnVisible('pago') ? <td>{formatPagoLabel(registro.pago) || '—'}</td> : null}
                  {isColumnVisible('cliente') ? <td>{registro.cliente ?? '—'}</td> : null}
                  {isColumnVisible('unidad') ? <td>{registro.unidad ?? '—'}</td> : null}
                  {isColumnVisible('patente') ? <td>{registro.patente ?? '—'}</td> : null}
                  {isColumnVisible('sucursal') ? <td>{registro.sucursal ?? '—'}</td> : null}
                  {isColumnVisible('fechaAlta') ? <td>{registro.fechaAlta ?? '—'}</td> : null}
                  {isColumnVisible('fechaBaja') ? <td>{registro.fechaBaja ?? '—'}</td> : null}
                  {isColumnVisible('fechaNacimientoProveedor') ? <td>{registro.duenoFechaNacimiento ?? '—'}</td> : null}
                  {isColumnVisible('docs') ? (
                    <td>
                      {(() => {
                        const badge = resolveDocumentacionBadge(registro);
                        if (badge.label === '—') {
                          return '—';
                        }
                        return (
                          <button
                            type="button"
                            className={badge.className}
                            onClick={() => navigate(`/personal/${registro.id}/editar?docFilter=${badge.filter}`)}
                          >
                            {badge.label}
                          </button>
                        );
                      })()}
                    </td>
                  ) : null}
                  {isColumnVisible('qrIngresos') ? <td>{registro.transportistaQrScansCount ?? 0}</td> : null}
                  {isColumnVisible('qrUltimoIngreso') ? (
                    <td>{registro.transportistaQrLastScanAtLabel ?? '—'}</td>
                  ) : null}
                  {isColumnVisible('acciones') ? (
                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          aria-label={`QR de ${registro.nombre ?? 'transportista'}`}
                          title={
                            registro.transportistaQrScansCount
                              ? `Ingresos QR: ${registro.transportistaQrScansCount}${
                                  registro.transportistaQrLastScanAtLabel
                                    ? ` · Último: ${registro.transportistaQrLastScanAtLabel}`
                                    : ''
                                }`
                              : 'Abrir QR único del transportista'
                          }
                          onClick={() => void handleOpenTransportistaQr(registro)}
	                        >
	                          {`QR${(registro.transportistaQrScansCount ?? 0) > 0 ? ` (${registro.transportistaQrScansCount})` : ''}`}
	                        </button>
	                        {canManagePersonal ? (
	                          <Link
	                            to={`/personal/${registro.id}/editar`}
	                            aria-label={`Editar proveedor ${registro.nombre ?? ''}`}
	                            title="Editar (clic derecho para abrir en nueva pestaña)"
	                          >
	                            ✏️
	                          </Link>
	                        ) : (
	                          <button type="button" aria-label={`Editar proveedor ${registro.nombre ?? ''}`} disabled>
	                            ✏️
	                          </button>
	                        )}
	                        <button
	                          type="button"
	                          aria-label={`Eliminar proveedor ${registro.nombre ?? ''}`}
	                          onClick={() => handleDeletePersonal(registro)}
	                          disabled={!canManagePersonal || deletingPersonalId === registro.id}
	                        >
                          🗑️
                        </button>
                      </div>
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
    </DashboardLayout>
  );
};
