import type { AttendanceRecord, RemoteAttendanceApiRecord } from './types';

export const buildAttendanceUserKey = (record: AttendanceRecord): string => {
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

export const cleanAttendanceUserName = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const cleaned = value
    .replace(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ\s.'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.length > 0 ? cleaned : null;
};

export const mapRemoteAttendance = (items: RemoteAttendanceApiRecord[]): AttendanceRecord[] => {
  return items
    .filter((item) => typeof item.recordedAt === 'string' && item.recordedAt.length > 0)
    .map((item) => ({
      status: item.status,
      timestamp: item.recordedAt as string,
      userId: item.userId ?? null,
      userName: cleanAttendanceUserName(item.userName ?? null),
      userKey: item.userId != null ? `id-${item.userId}` : undefined,
    }));
};

export const formatMonthValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const formatDurationFromMs = (ms: number): string => {
  if (ms <= 0) {
    return '0m';
  }
  const diffMinutes = Math.floor(ms / 60000);
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

export const formatAttendanceDayCount = (days: number): string => {
  const safeDays = Math.max(0, Math.round(days));
  return `${safeDays} ${safeDays === 1 ? 'día' : 'días'}`;
};

export const ATTENDANCE_EXPECTED_WORKDAY_MS = 9 * 60 * 60 * 1000; // L-V 08:00 a 17:00

export const isAttendanceWorkday = (date: Date): boolean => {
  const day = date.getDay();
  return day >= 1 && day <= 5;
};

export const formatAttendanceDate = (date: Date): string =>
  date.toLocaleDateString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

export const formatAttendanceTime = (value: number | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

export const formatSignedDurationFromMs = (ms: number): string => {
  if (ms === 0) {
    return '0m';
  }
  return `${ms > 0 ? '+' : '-'}${formatDurationFromMs(Math.abs(ms))}`;
};

export const getAttendanceWeekStart = (date: Date): Date => {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff);
};

