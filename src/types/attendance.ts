export type AttendanceStatus = 'present' | 'late' | 'excused' | 'unexcused';

export type UserRole = 'admin' | 'teacher';
export type UserApprovalStatus = 'pending' | 'approved' | 'disabled';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  teacherCode?: string;
  role: UserRole;
  status: UserApprovalStatus;
  assignedSubjectIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TeacherInvite {
  id: string;
  email: string;
  displayName: string;
  teacherCode?: string;
  assignedSubjectIds: string[];
  createdByUid: string;
  createdAt: string;
}

export interface Student {
  stt: number;
  id: string;
  fullName: string;
  note?: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  teacher?: string;
  officialName?: string;
}

export interface AttendanceEntry {
  status: AttendanceStatus;
  note: string;
  updatedAt: string;
}

export interface AttendanceSession {
  id: string;
  className: string;
  subjectId: string;
  date: string; // YYYY-MM-DD
  period: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
  recordedByUid?: string;
  recordedByName?: string;
  recordedByEmail?: string;
  records: Record<string, AttendanceEntry>;
}

/** Map of YYYY-MM-DD -> { 'Tiết 1': subjectId, 'Tiết 2': subjectId, ... } */
export type DailyScheduleMap = Record<string, Record<string, string>>;

export interface ClassDatabase {
  className: string;
  academicYear: string;
  students: Student[];
  subjects: Subject[];
  sessions: AttendanceSession[];
  schedule: DailyScheduleMap;
}

export const ATTENDANCE_STATUS_META: Record<
  AttendanceStatus,
  {
    label: string;
    shortLabel: string;
    code: string;
    symbol: string;
  }
> = {
  present: {
    label: 'Có mặt (P)',
    shortLabel: 'Có mặt',
    code: 'P',
    symbol: '✓',
  },
  late: {
    label: 'Đi muộn',
    shortLabel: 'Muộn',
    code: 'M',
    symbol: '◷',
  },
  excused: {
    label: 'Vắng có phép',
    shortLabel: 'Có phép',
    code: 'CP',
    symbol: 'P*',
  },
  unexcused: {
    label: 'Vắng mặt (A)',
    shortLabel: 'Vắng (A)',
    code: 'A',
    symbol: '✕',
  },
};

export const DAILY_PERIODS = [
  'Tiết 1',
  'Tiết 2',
  'Tiết 3',
  'Tiết 4',
  'Tiết 5',
] as const;

export const CLASS_PERIODS = [
  'Tiết 1',
  'Tiết 2',
  'Tiết 3',
  'Tiết 4',
  'Tiết 5',
  'Tiết 1–2 (Sáng)',
  'Tiết 3–4 (Sáng)',
  'Tiết 1–2 (Chiều)',
  'Tiết 3–4 (Chiều)',
  'Buổi tự học / Phụ đạo',
] as const;
