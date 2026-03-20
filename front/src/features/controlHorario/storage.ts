import type { AttendanceRecord } from './types';
import { buildAttendanceUserKey } from './utils';

type AttendanceAuthUser = {
  id?: number | null;
  name?: string | null;
  email?: string | null;
} | null;

const ATTENDANCE_RECORD_KEY = 'attendanceRecord';

export const deriveAttendanceUserKey = (authUser: AttendanceAuthUser): string | null => {
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

        return (status === 'entrada' || status === 'salida') && typeof timestamp === 'string';
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

export const removeAttendanceRecordFromStorage = (userKey: string | null | undefined) => {
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

export const persistAttendanceRecord = (record: AttendanceRecord) => {
  const userKey = record.userKey ?? buildAttendanceUserKey(record);
  const store = readAttendanceStore();
  store[userKey] = {
    ...record,
    userKey,
  };
  writeAttendanceStore(store);
};

export const readAttendanceRecordFromStorage = (expectedUserKey?: string | null): AttendanceRecord | null => {
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

