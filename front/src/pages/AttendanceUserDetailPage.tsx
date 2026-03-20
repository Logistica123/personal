import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
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

export const AttendanceUserDetailPage: React.FC<AttendanceUserDetailPageProps> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
}) => {
  const { userKey: encodedUserKey } = useParams<{ userKey: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [selectedMonth, setSelectedMonth] = useState(() => formatMonthValue(new Date()));
  const [remoteLog, setRemoteLog] = useState<AttendanceRecord[] | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(true);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

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
    if (!decodedUserKey) {
      setRemoteLog([]);
      setRemoteLoading(false);
      setRemoteError('Operador no válido.');
      return;
    }

    const controller = new AbortController();

    const fetchRemote = async () => {
      try {
        setRemoteLoading(true);
        setRemoteError(null);

        const url = new URL(`${apiBaseUrl}/api/attendance`);
        url.searchParams.set('limit', '500');
        if (userIdFromKey) {
          url.searchParams.set('userId', String(userIdFromKey));
        }

        const response = await fetch(url.toString(), { signal: controller.signal });

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
  }, [apiBaseUrl, decodedUserKey, userIdFromKey, refreshTick]);

  const effectiveUserLog = useMemo(() => {
    if (!decodedUserKey) {
      return [] as AttendanceRecord[];
    }
    return (remoteLog ?? []).filter(
      (record) => (record.userKey ?? buildAttendanceUserKey(record)) === decodedUserKey
    );
  }, [remoteLog, decodedUserKey]);

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

  const dailyRows = useMemo(() => {
    if (!monthRange) {
      return [] as Array<{
        dayKey: string;
        dateLabel: string;
        weekdayLabel: string;
        dateSortValue: number;
        scheduleLabel: string;
        marksLabel: string;
        marksCount: number;
        firstMark: string;
        lastMark: string;
        workedMs: number;
        workedLabel: string;
        expectedMs: number;
        expectedLabel: string;
        balanceMs: number;
        balanceLabel: string;
        isWorkday: boolean;
      }>;
    }

    const marksByDay = new Map<string, number[]>();
    effectiveUserLog.forEach((record) => {
      const recordDate = new Date(record.timestamp);
      if (Number.isNaN(recordDate.getTime())) {
        return;
      }
      if (recordDate < monthRange.start || recordDate >= monthRange.end) {
        return;
      }
      const dayKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(recordDate.getDate()).padStart(2, '0')}`;

      if (!marksByDay.has(dayKey)) {
        marksByDay.set(dayKey, []);
      }
      marksByDay.get(dayKey)?.push(recordDate.getTime());
    });

    const rows: Array<{
      dayKey: string;
      dateLabel: string;
      weekdayLabel: string;
      dateSortValue: number;
      scheduleLabel: string;
      marksLabel: string;
      marksCount: number;
      firstMark: string;
      lastMark: string;
      workedMs: number;
      workedLabel: string;
      expectedMs: number;
      expectedLabel: string;
      balanceMs: number;
      balanceLabel: string;
      isWorkday: boolean;
    }> = [];

    for (
      const cursor = new Date(monthRange.start.getTime());
      cursor < monthRange.end;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const dayDate = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      const dayKey = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(dayDate.getDate()).padStart(2, '0')}`;
      const marks = [...(marksByDay.get(dayKey) ?? [])].sort((a, b) => a - b);

      let workedMs = 0;
      for (let index = 0; index + 1 < marks.length; index += 2) {
        const segmentMs = marks[index + 1] - marks[index];
        if (segmentMs > 0 && segmentMs <= 18 * 60 * 60 * 1000) {
          workedMs += segmentMs;
        }
      }

      const isWorkday = isAttendanceWorkday(dayDate);
      const expectedMs = isWorkday ? ATTENDANCE_EXPECTED_WORKDAY_MS : 0;
      const balanceMs = workedMs - expectedMs;

      rows.push({
        dayKey,
        dateLabel: formatAttendanceDate(dayDate),
        weekdayLabel: dayDate.toLocaleDateString('es-AR', { weekday: 'short' }),
        dateSortValue: dayDate.getTime(),
        scheduleLabel: isWorkday ? '08:00 - 17:00' : 'No laboral',
        marksLabel: marks.length > 0 ? marks.map((value) => formatAttendanceTime(value)).join(' | ') : '—',
        marksCount: marks.length,
        firstMark: marks.length > 0 ? formatAttendanceTime(marks[0]) : '—',
        lastMark: marks.length > 0 ? formatAttendanceTime(marks[marks.length - 1]) : '—',
        workedMs,
        workedLabel: formatDurationFromMs(workedMs),
        expectedMs,
        expectedLabel: formatAttendanceDayCount(isWorkday ? 1 : 0),
        balanceMs,
        balanceLabel: formatSignedDurationFromMs(balanceMs),
        isWorkday,
      });
    }

    return rows.sort((a, b) => b.dateSortValue - a.dateSortValue);
  }, [effectiveUserLog, monthRange]);

  const monthlySummary = useMemo(() => {
    return dailyRows.reduce(
      (acc, row) => {
        acc.workedMs += row.workedMs;
        acc.expectedMs += row.expectedMs;
        if (row.isWorkday) {
          acc.workdays += 1;
        }
        if (row.marksCount > 0) {
          acc.daysWithMarks += 1;
        }
        return acc;
      },
      {
        workedMs: 0,
        expectedMs: 0,
        workdays: 0,
        daysWithMarks: 0,
      }
    );
  }, [dailyRows]);

  const weeklyRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        weekStartMs: number;
        weekStartLabel: string;
        weekEndLabel: string;
        workedMs: number;
        expectedMs: number;
        daysWithMarks: number;
        workdays: number;
      }
    >();

    dailyRows.forEach((row) => {
      const dayDate = new Date(row.dateSortValue);
      const weekStart = getAttendanceWeekStart(dayDate);
      const weekEnd = new Date(weekStart.getTime());
      weekEnd.setDate(weekEnd.getDate() + 6);
      const key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(weekStart.getDate()).padStart(2, '0')}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          weekStartMs: weekStart.getTime(),
          weekStartLabel: formatAttendanceDate(weekStart),
          weekEndLabel: formatAttendanceDate(weekEnd),
          workedMs: 0,
          expectedMs: 0,
          daysWithMarks: 0,
          workdays: 0,
        });
      }

      const target = grouped.get(key);
      if (!target) {
        return;
      }
      target.workedMs += row.workedMs;
      target.expectedMs += row.expectedMs;
      if (row.marksCount > 0) {
        target.daysWithMarks += 1;
      }
      if (row.isWorkday) {
        target.workdays += 1;
      }
    });

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        workedLabel: formatDurationFromMs(item.workedMs),
        expectedDaysLabel: formatAttendanceDayCount(item.workdays),
        balanceMs: item.workedMs - item.expectedMs,
        balanceLabel: formatSignedDurationFromMs(item.workedMs - item.expectedMs),
      }))
      .sort((a, b) => b.weekStartMs - a.weekStartMs);
  }, [dailyRows]);

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/control-horario')}>
        ← Volver al registro
      </button>
      <button
        type="button"
        className="secondary-action"
        onClick={() => setRefreshTick((value) => value + 1)}
        disabled={!decodedUserKey || remoteLoading}
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
            <strong>Total registrado (mes):</strong> {formatDurationFromMs(monthlySummary.workedMs)}
          </div>
        </div>

        <div className="attendance-metrics-grid">
          <article className="attendance-metric">
            <span>Horas trabajadas (mes)</span>
            <strong>{formatDurationFromMs(monthlySummary.workedMs)}</strong>
          </article>
          <article className="attendance-metric">
            <span>Objetivo (L-V 08:00-17:00)</span>
            <strong>{formatAttendanceDayCount(monthlySummary.workdays)}</strong>
          </article>
          <article className="attendance-metric">
            <span>Saldo mensual</span>
            <strong
              className={
                monthlySummary.workedMs - monthlySummary.expectedMs >= 0
                  ? 'attendance-balance attendance-balance--positive'
                  : 'attendance-balance attendance-balance--negative'
              }
            >
              {formatSignedDurationFromMs(monthlySummary.workedMs - monthlySummary.expectedMs)}
            </strong>
          </article>
          <article className="attendance-metric">
            <span>Días con marcaciones</span>
            <strong>
              {monthlySummary.daysWithMarks} / {dailyRows.length}
            </strong>
          </article>
        </div>

        <div className="table-wrapper">
          <p className="form-info">
            Detalle diario de entrada/salida y balance contra jornada de 9h (lunes a viernes).
          </p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Día</th>
                <th>Jornada</th>
                <th>Marcaciones</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Horas trabajadas</th>
                <th>Objetivo</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.length === 0 ? (
                <tr>
                  <td colSpan={10}>No hay días disponibles en el mes seleccionado.</td>
                </tr>
              ) : (
                dailyRows.map((day, index) => {
                  return (
                    <tr key={`${day.dayKey}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{day.dateLabel}</td>
                      <td>{day.weekdayLabel}</td>
                      <td>{day.scheduleLabel}</td>
                      <td>{day.marksLabel}</td>
                      <td>{day.firstMark}</td>
                      <td>{day.lastMark}</td>
                      <td>{day.workedLabel}</td>
                      <td>{day.expectedLabel}</td>
                      <td
                        className={
                          day.balanceMs >= 0
                            ? 'attendance-balance attendance-balance--positive'
                            : 'attendance-balance attendance-balance--negative'
                        }
                      >
                        {day.balanceLabel}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="table-wrapper">
          <p className="form-info">Resumen semanal (acumulado por semana calendario).</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Semana</th>
                <th>Rango</th>
                <th>Días laborales</th>
                <th>Días con marcas</th>
                <th>Horas trabajadas</th>
                <th>Días objetivo</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {weeklyRows.length === 0 ? (
                <tr>
                  <td colSpan={8}>No hay datos semanales para el mes seleccionado.</td>
                </tr>
              ) : (
                weeklyRows.map((week, index) => (
                  <tr key={`${week.weekStartMs}-${index}`}>
                    <td>{index + 1}</td>
                    <td>Semana {index + 1}</td>
                    <td>
                      {week.weekStartLabel} al {week.weekEndLabel}
                    </td>
                    <td>{week.workdays}</td>
                    <td>{week.daysWithMarks}</td>
                    <td>{week.workedLabel}</td>
                    <td>{week.expectedDaysLabel}</td>
                    <td
                      className={
                        week.balanceMs >= 0
                          ? 'attendance-balance attendance-balance--positive'
                          : 'attendance-balance attendance-balance--negative'
                      }
                    >
                      {week.balanceLabel}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};
