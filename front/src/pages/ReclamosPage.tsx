import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { downloadCsv } from '../lib/csv';
import type { ReclamoMeta, ReclamoRecord, ReclamoTransportistaSummary } from '../features/reclamos/types';
import {
  formatCurrency,
  formatElapsedTime,
  formatReclamoTipoLabel,
  isReclamoAdelantoTypeName,
  normalizeReclamosTipoQueryParam,
  truncateText,
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

type ReclamosPageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  getUserRole: (authUser: AuthUser | null | undefined) => string;
  buildActorHeaders: (authUser: AuthUser | null | undefined) => Record<string, string>;
  isElevatedRole: (role: string | null | undefined) => boolean;
};

export const ReclamosPage: React.FC<ReclamosPageProps> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  getUserRole,
  buildActorHeaders,
  isElevatedRole,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const authUser = useStoredAuthUser();
  const userRole = useMemo(() => getUserRole(authUser), [authUser, getUserRole]);
  const actorHeaders = useMemo(() => buildActorHeaders(authUser), [authUser, buildActorHeaders]);
  const canViewReclamoImportes = useMemo(
    () => isElevatedRole(userRole) && userRole !== 'asesor',
    [isElevatedRole, userRole]
  );
  const reclamosColumnCount = canViewReclamoImportes ? 16 : 14;
  const [reclamos, setReclamos] = useState<ReclamoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingReclamoId, setDeletingReclamoId] = useState<number | null>(null);
  const [agentesCatalog, setAgentesCatalog] = useState<string[]>([]);
  const [agenteFilter, setAgenteFilter] = useState<string[]>([]);
  const [creatorFilter, setCreatorFilter] = useState<string[]>([]);
  const [transportistaFilter, setTransportistaFilter] = useState('');
  const [clienteFilter, setClienteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [creationWeekFilter, setCreationWeekFilter] = useState<'all' | 'current' | 'previous'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<'fecha' | 'codigo'>('fecha');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [revisionUpdatingId, setRevisionUpdatingId] = useState<number | null>(null);
  const reclamosTipoParam = useMemo(
    () => normalizeReclamosTipoQueryParam(location.search),
    [location.search]
  );
  const isAdelantoListMode = reclamosTipoParam === 'adelanto' || reclamosTipoParam === 'reclamos-y-adelantos';
  const reclamosPageTitle = isAdelantoListMode ? 'Gestión de reclamos y adelantos' : 'Gestión de reclamos';

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
    (record: ReclamoRecord): string[] => {
      const names = getTransportistaEntries(record)
        .map((entry) => {
          const base = entry.nombre ?? entry.cliente ?? '';
          return typeof base === 'string' ? base.trim() : '';
        })
        .filter((name) => name.length > 0);

      if (names.length > 0) {
        return names;
      }

      const fallbackNames = [record.emisorFactura, record.distribuidorNombre]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0);

      return fallbackNames;
    },
    [getTransportistaEntries]
  );

  const getTransportistaSearchValues = useCallback(
    (record: ReclamoRecord): string[] =>
      getTransportistaEntries(record)
        .flatMap((entry) => [
          entry.nombre,
          entry.cliente,
          entry.patente,
          entry.unidad,
          entry.id != null ? String(entry.id) : null,
        ])
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0),
    [getTransportistaEntries]
  );

  const formatTransportistaDisplay = useCallback(
    (record: ReclamoRecord) => {
      const entries = getTransportistaEntries(record);
      const names = getTransportistaNames(record);
      const label =
        names[0] ??
        record.transportista ??
        record.emisorFactura ??
        record.distribuidorNombre ??
        (entries[0] ? entries[0].nombre ?? entries[0].cliente ?? `Transportista #${entries[0].id ?? ''}` : '—');
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

  const scopedReclamos = useMemo(
    () =>
      reclamos.filter((reclamo) =>
        isAdelantoListMode ? isReclamoAdelantoTypeName(reclamo.tipo) : !isReclamoAdelantoTypeName(reclamo.tipo)
      ),
    [reclamos, isAdelantoListMode]
  );

  const resolveReclamoDemora = useCallback((reclamo: ReclamoRecord) => {
    const status = (reclamo.status ?? '').trim().toLowerCase();
    const endIso = status === 'finalizado' ? reclamo.updatedAt ?? reclamo.createdAt ?? undefined : undefined;
    return formatElapsedTime(reclamo.createdAt, endIso);
  }, []);

  const resolveReclamoDescripcion = useCallback((reclamo: ReclamoRecord): string | null => reclamo.detalle ?? reclamo.concepto ?? null, []);

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
            const parsed = JSON.parse(stored) as { message?: string; reclamo?: ReclamoRecord };

            const newReclamo = parsed?.reclamo;
            if (newReclamo) {
              const withoutDuplicate = finalData.filter((reclamo) => reclamo.id !== newReclamo.id);
              finalData = [newReclamo, ...withoutDuplicate];
            }

            if (parsed?.message) {
              setFlashMessage(parsed.message);
            } else if (parsed?.reclamo) {
              setFlashMessage(`Reclamo ${parsed.reclamo.codigo ?? `#${parsed.reclamo.id}`} creado correctamente.`);
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

  useEffect(() => {
    const controller = new AbortController();

    const fetchAgentesCatalog = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/reclamos/meta`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data?: ReclamoMeta };
        const agentes = payload?.data?.agentes ?? [];
        const names = Array.from(
          new Set(agentes.map((agente) => agente.nombre?.trim()).filter((value): value is string => Boolean(value)))
        ).sort((a, b) => a.localeCompare(b));

        setAgentesCatalog(names);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
      }
    };

    fetchAgentesCatalog();

    return () => controller.abort();
  }, [apiBaseUrl]);

  const agenteOptions = useMemo(() => {
    const fromReclamos = scopedReclamos
      .map((reclamo) => {
        const agente = (reclamo.agente ?? '').trim();
        if (agente) {
          return agente;
        }
        const cliente = (reclamo.clienteNombre ?? '').trim();
        return cliente || null;
      })
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set([...agentesCatalog, ...fromReclamos])).sort((a, b) => a.localeCompare(b));
  }, [agentesCatalog, scopedReclamos]);

  const creatorOptions = useMemo(
    () =>
      Array.from(new Set(scopedReclamos.map((reclamo) => reclamo.creator).filter((value): value is string => Boolean(value)))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [scopedReclamos]
  );

  const clienteOptions = useMemo(() => {
    const unique = Array.from(
      new Set(scopedReclamos.map((reclamo) => reclamo.cliente?.trim()).filter((value): value is string => Boolean(value)))
    );
    return unique.sort((a, b) => a.localeCompare(b));
  }, [scopedReclamos]);

  const transportistaOptions = useMemo(() => {
    const names = new Set<string>();
    scopedReclamos.forEach((reclamo) => {
      getTransportistaNames(reclamo).forEach((name) => names.add(name));
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [scopedReclamos, getTransportistaNames]);

  const resolveReclamoResponsable = useCallback((reclamo: ReclamoRecord): string | null => {
    const agente = (reclamo.agente ?? '').trim();
    if (agente) {
      return agente;
    }

    const cliente = (reclamo.clienteNombre ?? '').trim();
    if (cliente) {
      return cliente;
    }

    return null;
  }, []);

  const estadoOptions = useMemo(() => {
    const map = new Map<string, string>();
    scopedReclamos.forEach((reclamo) => {
      if (reclamo.status) {
        map.set(reclamo.status, reclamo.statusLabel ?? reclamo.status);
      }
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [scopedReclamos]);

  const tipoOptions = useMemo(
    () =>
      Array.from(new Set(scopedReclamos.map((reclamo) => reclamo.tipo).filter((value): value is string => Boolean(value)))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [scopedReclamos]
  );

  useEffect(() => {
    if (isAdelantoListMode) {
      const adelantoTipo = tipoOptions.find((option) => isReclamoAdelantoTypeName(option));
      if (!adelantoTipo) {
        return;
      }

      setTipoFilter((prev) => (prev === adelantoTipo ? prev : adelantoTipo));
      return;
    }

    setTipoFilter((prev) => (isReclamoAdelantoTypeName(prev) ? '' : prev));
  }, [isAdelantoListMode, tipoOptions]);

  const filteredReclamos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const now = new Date();
    const currentCutoffStart = (() => {
      const boundary = new Date(now);
      boundary.setHours(11, 0, 0, 0);
      const diffToThursday = (boundary.getDay() - 4 + 7) % 7;
      boundary.setDate(boundary.getDate() - diffToThursday);
      if (now.getTime() < boundary.getTime()) {
        boundary.setDate(boundary.getDate() - 7);
      }
      return boundary;
    })();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const currentCutoffStartMs = currentCutoffStart.getTime();
    const creationFilterFromMs =
      creationWeekFilter === 'current'
        ? currentCutoffStartMs
        : creationWeekFilter === 'previous'
        ? currentCutoffStartMs - oneWeekMs
        : null;
    const creationFilterToMs =
      creationWeekFilter === 'current'
        ? currentCutoffStartMs + oneWeekMs
        : creationWeekFilter === 'previous'
        ? currentCutoffStartMs
        : null;

    return scopedReclamos.filter((reclamo) => {
      const responsable = resolveReclamoResponsable(reclamo) ?? '';

      if (agenteFilter.length > 0 && !agenteFilter.includes(responsable)) {
        return false;
      }

      if (creatorFilter.length > 0 && !creatorFilter.includes(reclamo.creator ?? '')) {
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

      if (creationFilterFromMs !== null && creationFilterToMs !== null) {
        const createdMs = Date.parse(reclamo.createdAt ?? '');
        if (!Number.isFinite(createdMs) || createdMs < creationFilterFromMs || createdMs >= creationFilterToMs) {
          return false;
        }
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

      const transportistaSearchValues = getTransportistaSearchValues(reclamo);
      const fields = [
        reclamo.codigo,
        reclamo.detalle,
        reclamo.creator,
        responsable,
        reclamo.agente,
        reclamo.clienteNombre,
        reclamo.transportista,
        reclamo.transportistaId != null ? String(reclamo.transportistaId) : null,
        reclamo.patente,
        ...getTransportistaNames(reclamo),
        ...transportistaSearchValues,
        reclamo.cliente,
        reclamo.tipo,
        reclamo.status,
        reclamo.statusLabel,
      ];

      return fields.some((field) => field?.toLowerCase().includes(term));
    });
  }, [
    scopedReclamos,
    searchTerm,
    agenteFilter,
    creatorFilter,
    transportistaFilter,
    clienteFilter,
    statusFilter,
    tipoFilter,
    creationWeekFilter,
    dateFrom,
    dateTo,
    getTransportistaNames,
    getTransportistaSearchValues,
    resolveReclamoResponsable,
  ]);

  const resolveFechaMs = useCallback((reclamo: ReclamoRecord) => {
    const raw = reclamo.fechaReclamoIso ?? reclamo.fechaReclamo ?? reclamo.createdAt ?? '';
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }, []);

  const sortedReclamos = useMemo(() => {
    const data = [...filteredReclamos];
    data.sort((a, b) => {
      if (sortField === 'fecha') {
        const diff = resolveFechaMs(a) - resolveFechaMs(b);
        if (diff !== 0) {
          return sortDir === 'asc' ? diff : -diff;
        }
        const cmp = (a.codigo ?? '').localeCompare(b.codigo ?? '');
        if (cmp !== 0) {
          return sortDir === 'asc' ? cmp : -cmp;
        }
        return sortDir === 'asc' ? a.id - b.id : b.id - a.id;
      }
      const cmp = (a.codigo ?? '').localeCompare(b.codigo ?? '');
      if (cmp !== 0) {
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const diff = resolveFechaMs(a) - resolveFechaMs(b);
      if (diff !== 0) {
        return sortDir === 'asc' ? diff : -diff;
      }
      return sortDir === 'asc' ? a.id - b.id : b.id - a.id;
    });
    return data;
  }, [filteredReclamos, sortField, sortDir, resolveFechaMs]);

  const toggleSort = (field: 'fecha' | 'codigo') => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

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
      'Fecha compromiso pago',
      'Aprobación',
      'Motivo aprobación',
      ...(canViewReclamoImportes ? ['Pagado', 'Importe pagado', 'Importe facturado'] : ['Pagado']),
      'Demora',
    ];

    const rows: Array<Array<string>> = [headers];

    if (sortedReclamos.length === 0) {
      rows.push(['Sin datos filtrados']);
    } else {
      sortedReclamos.forEach((reclamo) => {
        const transportistaDisplay = formatTransportistaDisplay(reclamo);
        const canSeeFacturado = canViewReclamoImportes && (reclamo.status ?? '').trim().toLowerCase() === 'finalizado';
        const responsable = resolveReclamoResponsable(reclamo);
        rows.push([
          reclamo.fechaReclamo ?? '',
          reclamo.codigo ?? `#${reclamo.id}`,
          resolveReclamoDescripcion(reclamo) ?? '',
          reclamo.creator ?? '',
          transportistaDisplay.restCount > 0 ? `${transportistaDisplay.label} (+${transportistaDisplay.restCount})` : transportistaDisplay.label ?? '',
          responsable ?? '',
          reclamo.cliente ?? '',
          formatReclamoTipoLabel(reclamo.tipo),
          reclamo.statusLabel ?? reclamo.status ?? '',
          reclamo.fechaCompromisoPago ?? '',
          reclamo.aprobacionEstadoLabel ?? '',
          reclamo.aprobacionMotivo ?? '',
          reclamo.pagado ? 'Sí' : 'No',
          ...(canViewReclamoImportes
            ? [
                reclamo.pagado ? reclamo.importePagadoLabel ?? formatCurrency(reclamo.importePagado) : '',
                canSeeFacturado
                  ? reclamo.importeFacturadoLabel ?? (reclamo.importeFacturado ? formatCurrency(reclamo.importeFacturado) : '')
                  : '',
              ]
            : []),
          resolveReclamoDemora(reclamo),
        ]);
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`${isAdelantoListMode ? 'reclamos-y-adelantos' : 'reclamos'}-${today}.csv`, rows);
  }, [
    canViewReclamoImportes,
    isAdelantoListMode,
    sortedReclamos,
    formatTransportistaDisplay,
    resolveReclamoDemora,
    resolveReclamoDescripcion,
    resolveReclamoResponsable,
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

    if (filteredReclamos.length === scopedReclamos.length) {
      return `Mostrando ${scopedReclamos.length} reclamo${scopedReclamos.length === 1 ? '' : 's'}`;
    }

    return `Mostrando ${filteredReclamos.length} de ${scopedReclamos.length} reclamos`;
  }, [loading, error, filteredReclamos.length, scopedReclamos.length]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setAgenteFilter([]);
    setCreatorFilter([]);
    setTransportistaFilter('');
    setClienteFilter('');
    setStatusFilter('');
    setTipoFilter(isAdelantoListMode ? tipoOptions.find((option) => isReclamoAdelantoTypeName(option)) ?? '' : '');
    setCreationWeekFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const applyReclamoListUpdate = useCallback((updatedReclamo: ReclamoRecord) => {
    setReclamos((prev) =>
      prev.map((item) =>
        item.id === updatedReclamo.id
          ? {
              ...item,
              ...updatedReclamo,
              transportistas: updatedReclamo.transportistas ?? item.transportistas,
            }
          : item
      )
    );
  }, []);

  const handleInlineAdelantoStatusChange = useCallback(
    async (reclamo: ReclamoRecord, nextStatus: 'aceptado' | 'rechazado' | 'a_revisar') => {
      try {
        setStatusUpdatingId(reclamo.id);

        const response = await fetch(`${apiBaseUrl}/api/reclamos/${reclamo.id}/adelanto-status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...actorHeaders,
          },
          body: JSON.stringify({ status: nextStatus }),
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

        const payload = (await response.json()) as { data?: ReclamoRecord };
        if (payload?.data) {
          applyReclamoListUpdate(payload.data);
        }
      } catch (err) {
        window.alert((err as Error).message ?? 'No se pudo actualizar el estado.');
      } finally {
        setStatusUpdatingId(null);
      }
    },
    [actorHeaders, apiBaseUrl, applyReclamoListUpdate]
  );

  const handleRevisionToggle = useCallback(
    async (reclamo: ReclamoRecord, nextValue: boolean) => {
      try {
        setRevisionUpdatingId(reclamo.id);

        const response = await fetch(`${apiBaseUrl}/api/reclamos/${reclamo.id}/revision`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...actorHeaders,
          },
          body: JSON.stringify({ enRevision: nextValue }),
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

        const payload = (await response.json()) as { data?: ReclamoRecord };
        if (payload?.data) {
          applyReclamoListUpdate(payload.data);
        }
      } catch (err) {
        window.alert((err as Error).message ?? 'No se pudo actualizar el checklist.');
      } finally {
        setRevisionUpdatingId(null);
      }
    },
    [actorHeaders, apiBaseUrl, applyReclamoListUpdate]
  );

  const headerContent = (
    <>
      <div className="card-header card-header--compact">
        <div className="approvals-tabs">
          <button
            type="button"
            className={`approvals-tab${!isAdelantoListMode ? ' is-active' : ''}`}
            onClick={() => navigate('/reclamos')}
          >
            Reclamos
          </button>
          <button
            type="button"
            className={`approvals-tab${isAdelantoListMode ? ' is-active' : ''}`}
            onClick={() => navigate('/reclamos?tipo=adelanto')}
          >
            Reclamos y adelantos
          </button>
        </div>
      </div>
      <div className="card-header card-header--compact">
        <div className="search-wrapper">
          <input type="search" placeholder="Buscar" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
        </div>
      </div>
      <div className="filters-bar filters-bar--reclamos">
        <div className="filters-grid filters-grid--reclamos">
          <label className="filter-field">
            <span>Responsable</span>
            <select
              className="reclamos-multi-select"
              multiple
              value={agenteFilter}
              onChange={(event) => setAgenteFilter(Array.from(event.target.selectedOptions).map((option) => option.value))}
            >
              {agenteOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <small className="filter-field__hint">Podés elegir varios (Ctrl/Cmd + clic).</small>
          </label>
          <label className="filter-field">
            <span>Agente creador</span>
            <select
              className="reclamos-multi-select"
              multiple
              value={creatorFilter}
              onChange={(event) => setCreatorFilter(Array.from(event.target.selectedOptions).map((option) => option.value))}
            >
              {creatorOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <small className="filter-field__hint">Podés elegir varios (Ctrl/Cmd + clic).</small>
          </label>
          <label className="filter-field">
            <span>Transportista</span>
            <select value={transportistaFilter} onChange={(event) => setTransportistaFilter(event.target.value)}>
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
            <span>Fecha creación (corte jueves 11:00)</span>
            <select value={creationWeekFilter} onChange={(event) => setCreationWeekFilter(event.target.value as 'all' | 'current' | 'previous')}>
              <option value="all">Todas</option>
              <option value="current">Semana actual</option>
              <option value="previous">Semana anterior</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Fecha desde</span>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="filter-field">
            <span>Fecha hasta</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <label className="filter-field">
            <span>Tipo de reclamo</span>
            <select value={tipoFilter} onChange={(event) => setTipoFilter(event.target.value)} disabled={isAdelantoListMode}>
              <option value="">Tipo de reclamo</option>
              {tipoOptions.map((option) => (
                <option key={option} value={option}>
                  {formatReclamoTipoLabel(option)}
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
          <button className="primary-action" type="button" onClick={() => navigate(isAdelantoListMode ? '/reclamos/nuevo?tipo=adelanto' : '/reclamos/nuevo')}>
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
    if (reclamo.enRevision) {
      window.alert('No podés eliminar un reclamo mientras el checklist esté activo.');
      return;
    }

    if (!window.confirm(`¿Seguro que deseas eliminar el reclamo "${reclamo.codigo ?? `#${reclamo.id}`}"?`)) {
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
      setFlashMessage(`Reclamo ${reclamo.codigo ?? `#${reclamo.id}`} eliminado correctamente.`);
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo eliminar el reclamo.');
    } finally {
      setDeletingReclamoId(null);
    }
  };

  return (
    <DashboardLayout title={reclamosPageTitle} subtitle={reclamosPageTitle} headerContent={headerContent}>
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
              <th>
                <button
                  type="button"
                  className="table-sort-button"
                  onClick={() => toggleSort('fecha')}
                  aria-label="Ordenar por fecha de reclamo"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 600 }}
                >
                  Fecha reclamo {sortField === 'fecha' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="table-sort-button"
                  onClick={() => toggleSort('codigo')}
                  aria-label="Ordenar por código"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 600 }}
                >
                  Código {sortField === 'codigo' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                </button>
              </th>
              <th>Descripción</th>
              <th>Agente creador</th>
              <th>Transportista</th>
              <th>Responsable</th>
              <th>Tipo de reclamo</th>
              <th>Estado</th>
              <th>Fecha compromiso</th>
              <th>Aprobación</th>
              <th>Motivo</th>
              <th>Pagado</th>
              {canViewReclamoImportes ? (
                <>
                  <th>Importe pagado</th>
                  <th>Importe facturado</th>
                </>
              ) : null}
              <th>Demora</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={reclamosColumnCount}>Cargando reclamos...</td>
              </tr>
            )}

            {error && !loading && (
              <tr>
                <td colSpan={reclamosColumnCount} className="error-cell">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && sortedReclamos.length === 0 && (
              <tr>
                <td colSpan={reclamosColumnCount}>No hay reclamos para mostrar.</td>
              </tr>
            )}

            {!loading &&
              !error &&
              sortedReclamos.map((reclamo) => {
                const transportistaDisplay = formatTransportistaDisplay(reclamo);
                const canSeeFacturado = canViewReclamoImportes && (reclamo.status ?? '').trim().toLowerCase() === 'finalizado';
                const responsable = resolveReclamoResponsable(reclamo);
                const isRevisionActive = Boolean(reclamo.enRevision);
                const isStatusUpdating = statusUpdatingId === reclamo.id;
                const isRevisionUpdating = revisionUpdatingId === reclamo.id;
                const canInlineEditAdelanto = isAdelantoListMode && !isRevisionActive && !isRevisionUpdating;
                const normalizedInlineStatus = (reclamo.status ?? '').trim().toLowerCase();
                const currentInlineStatus =
                  normalizedInlineStatus === 'aceptado' || normalizedInlineStatus === 'rechazado' || normalizedInlineStatus === 'a_revisar'
                    ? (normalizedInlineStatus as 'aceptado' | 'rechazado' | 'a_revisar')
                    : '';
                return (
                  <tr key={reclamo.id}>
                    <td>{reclamo.fechaReclamo ?? '—'}</td>
                    <td>{reclamo.codigo ?? `#${reclamo.id}`}</td>
                    <td title={resolveReclamoDescripcion(reclamo) ?? undefined}>{truncateText(resolveReclamoDescripcion(reclamo), 80)}</td>
                    <td>{reclamo.creator ?? '—'}</td>
                    <td>
                      <span className="transportista-cell" title={transportistaDisplay.tooltip}>
                        <span>{transportistaDisplay.label ?? '—'}</span>
                        {transportistaDisplay.restCount > 0 ? <span className="transportista-cell__extra">+{transportistaDisplay.restCount}</span> : null}
                      </span>
                    </td>
                    <td>{responsable ?? '—'}</td>
                    <td>{formatReclamoTipoLabel(reclamo.tipo) || '—'}</td>
                    <td>
                      {isAdelantoListMode ? (
                        <select
                          className="reclamo-inline-select"
                          value={currentInlineStatus}
                          onChange={(event) => {
                            if (!event.target.value) {
                              return;
                            }
                            handleInlineAdelantoStatusChange(reclamo, event.target.value as 'aceptado' | 'rechazado' | 'a_revisar');
                          }}
                          disabled={!canInlineEditAdelanto || isStatusUpdating}
                        >
                          <option value="">Seleccionar</option>
                          <option value="a_revisar">A revisar</option>
                          <option value="aceptado">Aceptado</option>
                          <option value="rechazado">Rechazado</option>
                        </select>
                      ) : (
                        <span className={`status-badge status-badge--state status-${(reclamo.status ?? '').toLowerCase()}`}>
                          {reclamo.statusLabel ?? reclamo.status ?? '—'}
                        </span>
                      )}
                    </td>
                    <td>{reclamo.fechaCompromisoPago ?? '—'}</td>
                    <td title={reclamo.aprobacionMotivo ?? undefined}>{reclamo.aprobacionEstadoLabel ?? '—'}</td>
                    <td title={reclamo.aprobacionMotivo ?? undefined}>{truncateText(reclamo.aprobacionMotivo ?? null, 60) || '—'}</td>
                    <td>
                      <span className={`status-badge status-badge--payment${reclamo.pagado ? ' is-active' : ' is-inactive'}`}>
                        {reclamo.pagadoLabel ?? (reclamo.pagado ? 'Sí' : 'No')}
                      </span>
                    </td>
                    {canViewReclamoImportes ? (
                      <>
                        <td>{reclamo.pagado ? reclamo.importePagadoLabel ?? formatCurrency(reclamo.importePagado) : '—'}</td>
                        <td>
                          {canSeeFacturado
                            ? reclamo.importeFacturadoLabel ?? (reclamo.importeFacturado ? formatCurrency(reclamo.importeFacturado) : '—')
                            : '—'}
                        </td>
                      </>
                    ) : null}
                    <td>{resolveReclamoDemora(reclamo)}</td>
                    <td>
                      <div className="action-buttons action-buttons--reclamos">
                        {isAdelantoListMode ? (
                          <label
                            className={`reclamo-action-lock${isRevisionActive ? ' is-active' : ''}`}
                            title={
                              isRevisionActive
                                ? 'Checklist activo. Desmarcalo para volver a editar.'
                                : 'Marcar checklist para bloquear edición.'
                            }
                          >
                            <input
                              type="checkbox"
                              checked={isRevisionActive}
                              onChange={(event) => handleRevisionToggle(reclamo, event.target.checked)}
                              disabled={isRevisionUpdating || isStatusUpdating}
                            />
                          </label>
                        ) : null}
                        <button
                          type="button"
                          aria-label={`Editar reclamo ${reclamo.codigo ?? ''}`}
                          onClick={() => handleEditReclamo(reclamo)}
                          disabled={isRevisionActive || isRevisionUpdating || isStatusUpdating}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          aria-label={`Eliminar reclamo ${reclamo.codigo ?? ''}`}
                          onClick={() => handleDeleteReclamo(reclamo)}
                          disabled={Boolean(reclamo.enRevision) || deletingReclamoId === reclamo.id}
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

