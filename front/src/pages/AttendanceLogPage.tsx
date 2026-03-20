import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { AttendanceRecord, RemoteAttendanceApiRecord } from '../features/controlHorario/types';
import {
  ATTENDANCE_EXPECTED_WORKDAY_MS,
  buildAttendanceUserKey,
  cleanAttendanceUserName,
  formatAttendanceDate,
  formatAttendanceDayCount,
  formatAttendanceTime,
  formatDurationFromMs,
  formatMonthValue,
  formatSignedDurationFromMs,
  getAttendanceWeekStart,
  isAttendanceWorkday,
  mapRemoteAttendance,
} from '../features/controlHorario/utils';

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

const parseJsonSafe = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const text = await response.text();
    const normalized = text.replace(/\s+/g, ' ').trim();
    const isHtmlLike =
      contentType.toLowerCase().includes('text/html') ||
      /^<!doctype html/i.test(normalized) ||
      /<html[\s>]/i.test(normalized);
    return {
      message: isHtmlLike ? 'Respuesta HTML inesperada.' : normalized,
    };
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
};

export type AttendanceLogPageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
};

export type AttendanceUserDetailPageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
};

export const AttendanceLogPage: React.FC<AttendanceLogPageProps> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
}) => {
  const authUser = useStoredAuthUser();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const isAdmin = useMemo(() => {
    const normalized = authUser?.role?.toLowerCase() ?? '';
    return normalized.includes('admin');
  }, [authUser?.role]);
  const [remoteLog, setRemoteLog] = useState<AttendanceRecord[] | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(true);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [clearingRemote, setClearingRemote] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

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

  const effectiveLog = useMemo(() => remoteLog ?? [], [remoteLog]);

  const handleClearRemoteLog = async () => {
    if (!window.confirm('¿Seguro que querés eliminar todo el registro de asistencia del servidor?')) {
      return;
    }

    try {
      setClearingRemote(true);
      setImportError(null);
      setImportFeedback(null);

      const response = await fetch(`${apiBaseUrl}/api/attendance`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
        },
      });

      const payload = (await parseJsonSafe(response)) as {
        message?: string;
        data?: { deletedCount?: number };
      };

      if (!response.ok) {
        throw new Error(payload.message ?? `Error ${response.status}: ${response.statusText}`);
      }

      const deletedCount = Number(payload.data?.deletedCount ?? 0);
      setImportFeedback(`Registro servidor limpiado. Marcaciones eliminadas: ${deletedCount}.`);
      setRefreshTick((value) => value + 1);
    } catch (err) {
      setImportError((err as Error).message ?? 'No se pudo limpiar el registro del servidor.');
    } finally {
      setClearingRemote(false);
    }
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    const replaceExisting = window.confirm(
      '¿Querés limpiar el registro actual del servidor y reemplazarlo con este archivo?\n\nAceptar = limpiar y reemplazar.\nCancelar = importar sin limpiar.'
    );

    try {
      setImporting(true);
      setImportError(null);
      setImportFeedback(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('replaceExisting', replaceExisting ? '1' : '0');

      const response = await fetch(`${apiBaseUrl}/api/attendance/import`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      });

      const payload = (await parseJsonSafe(response)) as {
        message?: string;
        data?: {
          processed?: number;
          imported?: number;
          skipped?: number;
          inferredStatus?: number;
          replaceExisting?: boolean;
          deletedCount?: number;
          errors?: string[];
        };
      };

      if (!response.ok) {
        const rawErrors = payload.data?.errors;
        const errors: string[] = Array.isArray(rawErrors) ? rawErrors : [];
        const detail = errors.length > 0 ? ` Detalle: ${errors[0]}` : '';
        throw new Error((payload.message ?? `Error ${response.status}: ${response.statusText}`) + detail);
      }

      const processed = Number(payload.data?.processed ?? 0);
      const imported = Number(payload.data?.imported ?? 0);
      const skipped = Number(payload.data?.skipped ?? 0);
      const inferredStatus = Number(payload.data?.inferredStatus ?? 0);
      const didReplace = Boolean(payload.data?.replaceExisting);
      const deletedCount = Number(payload.data?.deletedCount ?? 0);
      const rawErrors = payload.data?.errors;
      const errors: string[] = Array.isArray(rawErrors) ? rawErrors : [];
      const warningSummary =
        errors.length > 0
          ? imported > 0
            ? ` Filas ignoradas: ${errors.length}.`
            : ` Primer detalle: ${errors[0]}`
          : '';
      const replaceSummary = didReplace ? ` Registros previos eliminados: ${deletedCount}.` : '';

      setImportFeedback(
        `Importación C26 completa. Procesadas: ${processed}. Nuevas: ${imported}. Omitidas: ${skipped}. Estado inferido: ${inferredStatus}.${replaceSummary}${warningSummary}`
      );
      setRefreshTick((value) => value + 1);
    } catch (err) {
      setImportError((err as Error).message ?? 'No se pudo importar el archivo del reloj.');
    } finally {
      setImporting(false);
    }
  };

  const sortedLog = [...effectiveLog].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const summaryRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        userKey: string;
        operatorLabel: string;
        marksByDay: Map<string, number[]>;
        firstDaySortValue: number;
        lastDaySortValue: number;
        lastMarkSortValue: number;
      }
    >();

    sortedLog.forEach((record) => {
      const date = new Date(record.timestamp);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate()
      ).padStart(2, '0')}`;
      const userKey = record.userKey ?? buildAttendanceUserKey(record);
      const operatorLabel = cleanAttendanceUserName(record.userName) ?? '—';
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const markTime = date.getTime();

      if (!grouped.has(userKey)) {
        grouped.set(userKey, {
          userKey,
          operatorLabel,
          marksByDay: new Map<string, number[]>(),
          firstDaySortValue: dayStart,
          lastDaySortValue: dayStart,
          lastMarkSortValue: markTime,
        });
      }

      const target = grouped.get(userKey);
      if (!target) {
        return;
      }

      if (!target.marksByDay.has(dayKey)) {
        target.marksByDay.set(dayKey, []);
      }
      target.marksByDay.get(dayKey)?.push(markTime);
      target.firstDaySortValue = Math.min(target.firstDaySortValue, dayStart);
      target.lastDaySortValue = Math.max(target.lastDaySortValue, dayStart);
      target.lastMarkSortValue = Math.max(target.lastMarkSortValue, markTime);
    });

    return Array.from(grouped.values())
      .map((group) => {
        let marksCount = 0;
        let totalMs = 0;
        group.marksByDay.forEach((dayMarks) => {
          const marks = [...dayMarks].sort((a, b) => a - b);
          marksCount += marks.length;
          for (let i = 0; i + 1 < marks.length; i += 2) {
            const diff = marks[i + 1] - marks[i];
            if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
              totalMs += diff;
            }
          }
        });

        return {
          ...group,
          daysCount: group.marksByDay.size,
          firstDateLabel: formatAttendanceDate(new Date(group.firstDaySortValue)),
          lastDateLabel: formatAttendanceDate(new Date(group.lastDaySortValue)),
          lastMarkLabel: formatAttendanceTime(new Date(group.lastMarkSortValue)),
          marksCount,
          totalWorkedLabel: formatDurationFromMs(totalMs),
        };
      })
      .sort((a, b) => {
        if (b.lastDaySortValue !== a.lastDaySortValue) {
          return b.lastDaySortValue - a.lastDaySortValue;
        }
        return a.operatorLabel.localeCompare(b.operatorLabel, 'es');
      });
  }, [sortedLog]);

  if (!isAdmin) {
    return <Navigate to="/clientes" replace />;
  }

  const headerContent = (
    <div className="card-header card-header--compact">
      <input
        ref={importInputRef}
        type="file"
        accept=".csv,.txt,.dat,.log,text/csv,text/plain,application/csv,application/vnd.ms-excel"
        style={{ display: 'none' }}
        onChange={handleImportFileChange}
      />
      <button
        type="button"
        className="secondary-action"
        onClick={handleImportClick}
        disabled={importing}
      >
        {importing ? 'Importando C26...' : 'Importar C26'}
      </button>
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
        onClick={handleClearRemoteLog}
        disabled={clearingRemote}
      >
        {clearingRemote ? 'Limpiando servidor...' : 'Limpiar registro servidor'}
      </button>
      <button
        type="button"
        className="secondary-action"
        disabled
      >
        Solo datos de servidor
      </button>
    </div>
  );

  return (
    <DashboardLayout title="Control horario" subtitle="Registro de marcaciones" headerContent={headerContent}>
      <div className="table-wrapper">
        <p className="form-info">Exportá las marcaciones del C26 (Pro-Soft) en CSV/TXT y cargalas aquí.</p>
        {importError ? <p className="form-info form-info--error">{importError}</p> : null}
        {importFeedback ? <p className="form-info">{importFeedback}</p> : null}
        {remoteError ? <p className="form-info form-info--error">{remoteError}</p> : null}
        {remoteLoading ? <p className="form-info">Sincronizando registro remoto...</p> : null}
        <p className="form-info">Mostrando un resumen por operador. Click en el nombre para ver fechas y detalle.</p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Operador</th>
              <th>Días con marcas</th>
              <th>Primera fecha</th>
              <th>Última fecha</th>
              <th>Última marca</th>
              <th>Cant. marcas</th>
              <th>Horas totales</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.length === 0 ? (
              <tr>
                <td colSpan={8}>No hay marcaciones registradas todavía.</td>
              </tr>
            ) : (
              summaryRows.map((item, index) => {
                return (
                  <tr key={`${item.userKey}-${index}`}>
                    <td>{index + 1}</td>
                    <td>
                      {item.operatorLabel !== '—' ? (
                        <button
                          type="button"
                          className="secondary-action secondary-action--ghost"
                          onClick={() =>
                            navigate(
                              `/control-horario/${encodeURIComponent(item.userKey)}?nombre=${encodeURIComponent(
                                item.operatorLabel
                              )}`
                            )
                          }
                        >
                          {item.operatorLabel}
                        </button>
                      ) : (
                        item.operatorLabel
                      )}
                    </td>
                    <td>{item.daysCount}</td>
                    <td>{item.firstDateLabel}</td>
                    <td>{item.lastDateLabel}</td>
                    <td>{item.lastMarkLabel}</td>
                    <td>{item.marksCount}</td>
                    <td>{item.totalWorkedLabel}</td>
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
