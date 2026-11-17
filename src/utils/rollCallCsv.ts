import { createInitialDatabase } from '../data/seed10EC01.ts';
import type {
  AttendanceEntry,
  AttendanceSession,
  AttendanceStatus,
  ClassDatabase,
  DailyScheduleMap,
  Student,
  Subject,
} from '../types/attendance.ts';

export function parseCsvMatrix(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    if (inQuotes) {
      if (ch === '"' && cleanText[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\r' && cleanText[i + 1] === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
        i++;
      } else if (ch === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function viDateToIso(viDate: string): string | null {
  const match = viDate.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

export function parseRollCallBookCsv(
  csvText: string,
  baseDb?: ClassDatabase
): { db: ClassDatabase; importedSessions: number; importedDays: number } {
  const db: ClassDatabase = baseDb
    ? {
        ...baseDb,
        students: [...baseDb.students],
        subjects: [...baseDb.subjects],
        sessions: [...baseDb.sessions],
        schedule: { ...(baseDb.schedule ?? {}) },
      }
    : createInitialDatabase();

  const rows = parseCsvMatrix(csvText);
  if (rows.length < 10) {
    throw new Error('File CSV không đúng định dạng Sổ điểm danh.');
  }

  // Locate header rows
  const dateRowIdx = rows.findIndex((r) =>
    r.some((c) => /^\d{2}\/\d{2}\/\d{4}$/.test(c.trim()))
  );
  const periodRowIdx = rows.findIndex(
    (r) => r[0]?.trim().toUpperCase() === 'STT'
  );
  if (dateRowIdx < 0 || periodRowIdx < 0 || periodRowIdx + 1 >= rows.length) {
    throw new Error('Không tìm thấy hàng Ngày học hoặc hàng STT/Tiết học trong CSV.');
  }

  const dateRow = rows[dateRowIdx];
  const periodRow = rows[periodRowIdx];
  const subjectRow = rows[periodRowIdx + 1];

  // Extract subject legend at bottom (Mã môn, Môn học, Giáo viên) if present
  const legendIdx = rows.findIndex((r) =>
    r.some((c) => c.trim().toLowerCase() === 'mã môn')
  );
  if (legendIdx >= 0) {
    const codeCol = rows[legendIdx].findIndex(
      (c) => c.trim().toLowerCase() === 'mã môn'
    );
    for (let r = legendIdx + 1; r < rows.length; r++) {
      const code = (rows[r][codeCol] ?? '').trim();
      const officialName = (rows[r][codeCol + 1] ?? '').trim();
      const teacher = (rows[r][codeCol + 4] ?? rows[r][codeCol + 3] ?? rows[r][codeCol + 2] ?? '').trim();
      if (!code || !officialName) continue;

      const matched = db.subjects.find(
        (s) =>
          s.code.toUpperCase() === code.toUpperCase() ||
          normalizeText(s.name) === normalizeText(officialName.replace(/\s*10(-1)?|\s*1$/i, ''))
      );
      if (matched) {
        matched.code = code;
        matched.officialName = officialName;
        if (teacher) matched.teacher = teacher;
      }
    }
  }

  // Build subject name lookup
  const subjectByNormalizedName = new Map<string, Subject>();
  for (const subj of db.subjects) {
    subjectByNormalizedName.set(normalizeText(subj.name), subj);
    if (subj.officialName) {
      subjectByNormalizedName.set(normalizeText(subj.officialName), subj);
    }
  }

  function resolveSubjectId(rawName: string): string {
    const clean = rawName.trim();
    const norm = normalizeText(clean);
    const found = subjectByNormalizedName.get(norm);
    if (found) return found.id;

    // Fallback: create a new subject entry if unknown
    const newId =
      norm.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') ||
      `mon-${db.subjects.length + 1}`;
    const existing = db.subjects.find((s) => s.id === newId);
    if (existing) return existing.id;

    const created: Subject = {
      id: newId,
      name: clean,
      code: newId.slice(0, 6).toUpperCase(),
    };
    db.subjects.push(created);
    subjectByNormalizedName.set(norm, created);
    return created.id;
  }

  // Find first period column index (typically col 13)
  const firstPeriodCol = periodRow.findIndex(
    (c, idx) => idx >= 3 && /^Tiết\s*\d+/i.test(c.trim())
  );
  if (firstPeriodCol < 0) {
    throw new Error('Không tìm thấy các cột Tiết 1..Tiết 5 trong file CSV.');
  }

  // Map column index -> { isoDate, period, subjectId }
  interface ColumnMeta {
    col: number;
    isoDate: string;
    period: string;
    subjectId: string;
  }

  const colMetas: ColumnMeta[] = [];
  const schedule: DailyScheduleMap = { ...db.schedule };
  let activeIsoDate: string | null = null;
  const importedDatesSet = new Set<string>();

  for (let c = firstPeriodCol; c < Math.max(periodRow.length, subjectRow.length); c++) {
    const rawDate = (dateRow[c] ?? '').trim();
    if (rawDate) {
      const parsedIso = viDateToIso(rawDate);
      if (parsedIso) {
        activeIsoDate = parsedIso;
        importedDatesSet.add(parsedIso);
      }
    }
    const rawPeriod = (periodRow[c] ?? '').trim();
    const rawSubject = (subjectRow[c] ?? '').trim();
    if (!activeIsoDate || !rawPeriod || !rawSubject) continue;

    const subjectId = resolveSubjectId(rawSubject);
    if (!schedule[activeIsoDate]) {
      schedule[activeIsoDate] = {};
    }
    schedule[activeIsoDate][rawPeriod] = subjectId;

    colMetas.push({
      col: c,
      isoDate: activeIsoDate,
      period: rawPeriod,
      subjectId,
    });
  }

  // Parse student rows (start after subjectRowIdx until blank STT)
  const parsedStudents: Student[] = [];
  const studentRowsMap = new Map<string, string[]>();

  for (let r = periodRowIdx + 2; r < rows.length; r++) {
    const row = rows[r];
    const sttNum = Number((row[0] ?? '').trim());
    const studentId = (row[1] ?? '').trim().toUpperCase();
    const fullName = (row[2] ?? '').trim();
    if (!sttNum || !studentId || !fullName) {
      if (parsedStudents.length > 0) break;
      continue;
    }
    parsedStudents.push({ stt: sttNum, id: studentId, fullName });
    studentRowsMap.set(studentId, row);
  }

  if (parsedStudents.length > 0) {
    // Merge/preserve existing notes
    const prevNotes = new Map(db.students.map((s) => [s.id, s.note]));
    db.students = parsedStudents.map((s) => ({
      ...s,
      note: prevNotes.get(s.id),
    }));
  }

  // Build AttendanceSessions for each column that has at least one non-empty cell
  const now = new Date().toISOString();
  const sessionMap = new Map<string, AttendanceSession>(
    db.sessions.map((s) => [`${s.subjectId}__${s.date}__${s.period}`, s])
  );
  let importedSessions = 0;

  for (const meta of colMetas) {
    let hasAnyValue = false;
    const records: Record<string, AttendanceEntry> = {};

    for (const student of db.students) {
      const row = studentRowsMap.get(student.id);
      const rawCell = (row?.[meta.col] ?? '').trim();
      if (!rawCell) continue;

      hasAnyValue = true;
      const upper = rawCell.toUpperCase();
      let status: AttendanceStatus = 'present';
      let note = '';

      if (upper === 'A') {
        status = 'unexcused';
      } else if (upper === 'P') {
        status = 'present';
      } else if (upper === 'CP') {
        status = 'excused';
      } else if (upper === 'M') {
        status = 'late';
      } else {
        // E.g. "1 đ +"
        status = 'present';
        note = rawCell;
      }

      records[student.id] = {
        status,
        note,
        updatedAt: now,
      };
    }

    if (hasAnyValue) {
      const key = `${meta.subjectId}__${meta.isoDate}__${meta.period}`;
      const existing = sessionMap.get(key);
      sessionMap.set(key, {
        id: existing?.id ?? key,
        className: db.className,
        subjectId: meta.subjectId,
        date: meta.isoDate,
        period: meta.period,
        topic: existing?.topic ?? '',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        records,
      });
      importedSessions++;
    }
  }

  db.schedule = schedule;
  db.sessions = Array.from(sessionMap.values()).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.period.localeCompare(b.period);
  });

  return {
    db,
    importedSessions,
    importedDays: importedDatesSet.size,
  };
}
