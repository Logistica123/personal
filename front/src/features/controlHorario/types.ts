export type AttendanceStatus = 'entrada' | 'salida';

export type AttendanceRecord = {
  status: AttendanceStatus;
  timestamp: string;
  userId?: number | null;
  userName?: string | null;
  userKey?: string;
};

export type RemoteAttendanceApiRecord = {
  id: number;
  status: AttendanceStatus;
  userId: number | null;
  userName: string | null;
  recordedAt: string | null;
  recordedAtLabel: string | null;
};

