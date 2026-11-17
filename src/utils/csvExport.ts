import {
  ATTENDANCE_STATUS_META,
  DAILY_PERIODS,
  type AttendanceSession,
  type ClassDatabase,
  type Student,
  type Subject,
} from '../types/attendance.ts';

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerCsvDownload(filename: string, rows: Array<Array<string | number>>) {
  const csvBody = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csvBody], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatDateVi(isoDate: string): string {
  if (!isoDate || !isoDate.includes('-')) return isoDate;
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export function getWeekdayVi(isoDate: string): string {
  if (!isoDate || !isoDate.includes('-')) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const days = [
    'Chủ nhật',
    'Thứ Hai',
    'Thứ Ba',
    'Thứ Tư',
    'Thứ Năm',
    'Thứ Sáu',
    'Thứ Bảy',
  ];
  return days[dt.getDay()] ?? '';
}

export function getTodayLocalIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function exportSessionCsv(
  className: string,
  subject: Subject | undefined,
  session: AttendanceSession,
  students: Student[]
) {
  const subjectName = subject?.name ?? session.subjectId;
  const rows: Array<Array<string | number>> = [
    [
      'Lớp',
      className,
      'Môn học',
      subjectName,
      'Ngày học',
      formatDateVi(session.date),
      'Tiết',
      session.period,
    ],
    ['Nội dung bài học', session.topic || '(Chưa nhập)'],
    [],
    ['STT', 'Mã học sinh', 'Họ và tên', 'Trạng thái', 'Ghi chú'],
  ];

  for (const student of students) {
    const entry = session.records[student.id];
    const statusLabel = entry
      ? ATTENDANCE_STATUS_META[entry.status].label
      : 'Chưa điểm danh';
    rows.push([
      student.stt,
      student.id,
      student.fullName,
      statusLabel,
      entry?.note ?? '',
    ]);
  }

  const safeSubject = subject?.code?.toLowerCase() || session.subjectId;
  triggerCsvDownload(
    `diem-danh-${className.toLowerCase()}-${safeSubject}-${session.date}.csv`,
    rows
  );
}

export function exportRollCallBookCsv(db: ClassDatabase) {
  const subjectMap = new Map(db.subjects.map((s) => [s.id, s]));
  const allDatesSet = new Set<string>([
    ...Object.keys(db.schedule ?? {}),
    ...db.sessions.map((s) => s.date),
  ]);
  const sortedDates = Array.from(allDatesSet).sort((a, b) => a.localeCompare(b));

  const sessionByKey = new Map<string, AttendanceSession>();
  for (const s of db.sessions) {
    sessionByKey.set(`${s.date}__${s.period}`, s);
  }

  const headerDates: Array<string | number> = ['', '', '', ...db.subjects.map(() => '')];
  const headerPeriods: Array<string | number> = [
    'STT',
    'MSSV / Roll No',
    'Họ tên / Full Name',
    ...db.subjects.map((s) => `${s.name} (% vắng)`),
  ];
  const headerSubjects: Array<string | number> = [
    '',
    '',
    '',
    ...db.subjects.map((s) => s.code),
  ];

  const colSpecs: Array<{ date: string; period: string; subjectId: string }> = [];

  for (const date of sortedDates) {
    const daySched = db.schedule?.[date] ?? {};
    DAILY_PERIODS.forEach((period, idx) => {
      headerDates.push(idx === 0 ? formatDateVi(date) : '');
      headerPeriods.push(period);
      const sess = sessionByKey.get(`${date}__${period}`);
      const subjId = sess?.subjectId ?? daySched[period] ?? '';
      headerSubjects.push(subjId ? subjectMap.get(subjId)?.name ?? subjId : '');
      colSpecs.push({ date, period, subjectId: subjId });
    });
  }

  const rows: Array<Array<string | number>> = [
    ['', '', '', `SỔ ĐIỂM DANH LỚP ${db.className} - ${db.academicYear}`],
    headerDates,
    headerPeriods,
    headerSubjects,
  ];

  for (const student of db.students) {
    const subjPcts = db.subjects.map((subj) => {
      const subjSessions = db.sessions.filter((s) => s.subjectId === subj.id);
      let marked = 0;
      let absent = 0;
      for (const s of subjSessions) {
        const rec = s.records[student.id];
        if (!rec) continue;
        marked++;
        if (rec.status === 'unexcused' || rec.status === 'excused') absent++;
      }
      if (marked === 0) return '0,0%';
      return `${((absent / marked) * 100).toFixed(1).replace('.', ',')}%`;
    });

    const periodCells = colSpecs.map((spec) => {
      const sess = sessionByKey.get(`${spec.date}__${spec.period}`);
      if (!sess) return '';
      const rec = sess.records[student.id];
      if (!rec) return '';
      if (rec.note) return rec.note;
      if (rec.status === 'present') return 'P';
      if (rec.status === 'unexcused') return 'A';
      if (rec.status === 'late') return 'M';
      return 'CP';
    });

    rows.push([student.stt, student.id, student.fullName, ...subjPcts, ...periodCells]);
  }

  triggerCsvDownload(`so-diem-danh-${db.className.toLowerCase()}.csv`, rows);
}

export function exportSummaryCsv(
  className: string,
  students: Student[],
  subjects: Subject[],
  sessions: AttendanceSession[],
  subjectFilterId: string
) {
  const filteredSessions =
    subjectFilterId === 'all'
      ? sessions
      : sessions.filter((s) => s.subjectId === subjectFilterId);

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const scopeLabel =
    subjectFilterId === 'all'
      ? 'Tất cả môn học'
      : subjectMap.get(subjectFilterId)?.name ?? subjectFilterId;

  const sortedSessions = [...filteredSessions].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const header: Array<string | number> = [
    'STT',
    'Mã học sinh',
    'Họ và tên',
    'Tổng tiết',
    'Có mặt (P)',
    'Đi muộn',
    'Vắng có phép',
    'Vắng không phép (A)',
    'Tỷ lệ chuyên cần (%)',
    ...sortedSessions.map((s) => {
      const sName = subjectMap.get(s.subjectId)?.code ?? s.subjectId;
      return `${formatDateVi(s.date)} (${sName} - ${s.period})`;
    }),
  ];

  const rows: Array<Array<string | number>> = [
    ['BÁO CÁO CHUYÊN CẦN', `Lớp ${className}`, 'Phạm vi', scopeLabel],
    [],
    header,
  ];

  for (const student of students) {
    let present = 0;
    let late = 0;
    let excused = 0;
    let unexcused = 0;
    const sessionCols: string[] = [];

    for (const s of sortedSessions) {
      const rec = s.records[student.id];
      if (!rec) {
        sessionCols.push('—');
        continue;
      }
      if (rec.status === 'present') present++;
      else if (rec.status === 'late') late++;
      else if (rec.status === 'excused') excused++;
      else if (rec.status === 'unexcused') unexcused++;

      const meta = ATTENDANCE_STATUS_META[rec.status];
      sessionCols.push(rec.note ? `${meta.code} (${rec.note})` : meta.code);
    }

    const totalMarked = present + late + excused + unexcused;
    const rate =
      totalMarked > 0 ? Math.round(((present + late) / totalMarked) * 100) : 100;

    rows.push([
      student.stt,
      student.id,
      student.fullName,
      totalMarked,
      present,
      late,
      excused,
      unexcused,
      totalMarked > 0 ? `${rate}%` : '—',
      ...sessionCols,
    ]);
  }

  const fileSuffix = subjectFilterId === 'all' ? 'tong-hop' : subjectFilterId;
  triggerCsvDownload(
    `bao-cao-chuyen-can-${className.toLowerCase()}-${fileSuffix}.csv`,
    rows
  );
}
