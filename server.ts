import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createInitialDatabase } from './src/data/seed10EC01.ts';
import type {
  AttendanceEntry,
  AttendanceSession,
  ClassDatabase,
  Student,
  Subject,
} from './src/types/attendance.ts';
import { parseRollCallBookCsv } from './src/utils/rollCallCsv.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'attendance-db.json');
const SEED_CSV_FILE = path.resolve(
  __dirname,
  'public/assets/aistudio/S___i_m_danh_-_Trung_h_c_ngh__-_Fall_2026_ea2736ea'
);

function buildSeededDatabase(): ClassDatabase {
  const initial = createInitialDatabase();
  if (fs.existsSync(SEED_CSV_FILE)) {
    try {
      const csvRaw = fs.readFileSync(SEED_CSV_FILE, 'utf-8');
      const parsed = parseRollCallBookCsv(csvRaw, initial);
      return parsed.db;
    } catch (err) {
      console.error('Could not parse seed CSV, falling back to blank seed:', err);
    }
  }
  return initial;
}

function ensureDb(): ClassDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const seeded = buildSeededDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2), 'utf-8');
    return seeded;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as ClassDatabase;
    if (!parsed || !Array.isArray(parsed.students) || !Array.isArray(parsed.subjects)) {
      const seeded = buildSeededDatabase();
      fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2), 'utf-8');
      return seeded;
    }
    // Auto-hydrate from attached Roll-Call CSV if DB was created empty before CSV attachment
    if (
      parsed.sessions.length === 0 &&
      (!parsed.schedule || Object.keys(parsed.schedule).length === 0) &&
      fs.existsSync(SEED_CSV_FILE)
    ) {
      const csvRaw = fs.readFileSync(SEED_CSV_FILE, 'utf-8');
      const hydrated = parseRollCallBookCsv(csvRaw, parsed).db;
      fs.writeFileSync(DB_FILE, JSON.stringify(hydrated, null, 2), 'utf-8');
      return hydrated;
    }
    if (!parsed.schedule) {
      parsed.schedule = {};
    }
    return parsed;
  } catch {
    const seeded = buildSeededDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2), 'utf-8');
    return seeded;
  }
}

function saveDb(db: ClassDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '5mb' }));

  // Initialize DB file on boot
  ensureDb();

  // Get full class database
  app.get('/api/data', (_req, res) => {
    const db = ensureDb();
    res.json(db);
  });

  // Save a whole day's roll-call across Tiết 1..Tiết 5
  app.post('/api/daily-rollcall', (req, res) => {
    const body = req.body as {
      date?: string;
      periodSubjects?: Record<string, string>; // period -> subjectId
      recordsByPeriod?: Record<string, Record<string, AttendanceEntry>>; // period -> studentId -> entry
      topicsByPeriod?: Record<string, string>;
    };

    if (!body.date || !body.periodSubjects || !body.recordsByPeriod) {
      res.status(400).json({ error: 'Thiếu dữ liệu điểm danh ngày.' });
      return;
    }

    const db = ensureDb();
    const date = body.date;
    const now = new Date().toISOString();

    // Update schedule for this date
    const daySchedule: Record<string, string> = {};
    for (const [period, subjectId] of Object.entries(body.periodSubjects)) {
      if (subjectId && subjectId.trim()) {
        daySchedule[period] = subjectId.trim();
      }
    }
    db.schedule[date] = daySchedule;

    // Update/create sessions for active periods of this date
    for (const [period, subjectId] of Object.entries(daySchedule)) {
      const periodRecords = body.recordsByPeriod[period];
      if (!periodRecords || Object.keys(periodRecords).length === 0) continue;

      const existingIndex = db.sessions.findIndex(
        (s) =>
          s.date === date &&
          s.period === period &&
          s.subjectId === subjectId
      );

      // Remove any stale session on the same date+period if subject was switched
      db.sessions = db.sessions.filter(
        (s) => !(s.date === date && s.period === period && s.subjectId !== subjectId)
      );

      const sessionId = `${subjectId}__${date}__${period}`;
      const prevSession = db.sessions.find((s) => s.id === sessionId);

      const sessionObj: AttendanceSession = {
        id: sessionId,
        className: db.className,
        subjectId,
        date,
        period,
        topic: (body.topicsByPeriod?.[period] ?? prevSession?.topic ?? '').trim(),
        createdAt: prevSession?.createdAt ?? now,
        updatedAt: now,
        records: periodRecords,
      };

      const idx = db.sessions.findIndex((s) => s.id === sessionId);
      if (idx >= 0 || existingIndex >= 0) {
        if (idx >= 0) db.sessions[idx] = sessionObj;
        else db.sessions.push(sessionObj);
      } else {
        db.sessions.push(sessionObj);
      }
    }

    db.sessions.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return a.period.localeCompare(b.period);
    });

    saveDb(db);
    res.json({ db, updatedAt: now });
  });

  // Import/Merge Roll-Call CSV uploaded from user
  app.post('/api/import-csv', (req, res) => {
    const body = req.body as { csvText?: string };
    if (!body.csvText || !body.csvText.trim()) {
      res.status(400).json({ error: 'Nội dung file CSV trống.' });
      return;
    }
    try {
      const currentDb = ensureDb();
      const result = parseRollCallBookCsv(body.csvText, currentDb);
      saveDb(result.db);
      res.json({
        db: result.db,
        importedSessions: result.importedSessions,
        importedDays: result.importedDays,
      });
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể phân tích file CSV Sổ điểm danh.',
      });
    }
  });

  // Upsert a single attendance session
  app.post('/api/sessions', (req, res) => {
    const payload = req.body as Partial<AttendanceSession>;
    if (!payload.subjectId || !payload.date || !payload.period || !payload.records) {
      res.status(400).json({ error: 'Thiếu thông tin buổi học (môn học, ngày, tiết học).' });
      return;
    }

    const db = ensureDb();
    const now = new Date().toISOString();
    const sessionId =
      payload.id && payload.id.trim().length > 0
        ? payload.id.trim()
        : `${payload.subjectId}__${payload.date}__${payload.period}`;

    const existingIndex = db.sessions.findIndex(
      (s) =>
        s.id === sessionId ||
        (s.subjectId === payload.subjectId &&
          s.date === payload.date &&
          s.period === payload.period)
    );

    const session: AttendanceSession = {
      id: existingIndex >= 0 ? db.sessions[existingIndex].id : sessionId,
      className: db.className,
      subjectId: payload.subjectId,
      date: payload.date,
      period: payload.period,
      topic: (payload.topic ?? '').trim(),
      createdAt: existingIndex >= 0 ? db.sessions[existingIndex].createdAt : now,
      updatedAt: now,
      records: payload.records,
    };

    if (existingIndex >= 0) {
      db.sessions[existingIndex] = session;
    } else {
      db.sessions.push(session);
    }

    // Keep schedule synced for single-period sessions
    if (/^Tiết\s*[1-5]$/i.test(payload.period)) {
      if (!db.schedule[payload.date]) db.schedule[payload.date] = {};
      db.schedule[payload.date][payload.period] = payload.subjectId;
    }

    db.sessions.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return a.period.localeCompare(b.period);
    });

    saveDb(db);
    res.json({ session, updatedAt: now });
  });

  // Delete an attendance session
  app.delete('/api/sessions/:id', (req, res) => {
    const id = decodeURIComponent(req.params.id);
    const db = ensureDb();
    const before = db.sessions.length;
    db.sessions = db.sessions.filter((s) => s.id !== id);
    if (db.sessions.length === before) {
      res.status(404).json({ error: 'Không tìm thấy buổi điểm danh.' });
      return;
    }
    saveDb(db);
    res.json({ deleted: id });
  });

  // Add or update a student
  app.post('/api/students', (req, res) => {
    const payload = req.body as Partial<Student> & { originalId?: string };
    const cleanId = (payload.id ?? '').trim().toUpperCase();
    const cleanName = (payload.fullName ?? '').trim();

    if (!cleanId || !cleanName) {
      res.status(400).json({ error: 'Mã học sinh và Họ và tên không được để trống.' });
      return;
    }

    const db = ensureDb();
    const targetId = payload.originalId ? payload.originalId.trim().toUpperCase() : cleanId;
    const existingIdx = db.students.findIndex((s) => s.id === targetId);

    if (existingIdx >= 0) {
      if (cleanId !== targetId && db.students.some((s) => s.id === cleanId)) {
        res.status(409).json({ error: `Mã học sinh ${cleanId} đã tồn tại.` });
        return;
      }
      db.students[existingIdx] = {
        ...db.students[existingIdx],
        id: cleanId,
        fullName: cleanName,
        note: (payload.note ?? '').trim() || undefined,
      };
      if (cleanId !== targetId) {
        for (const session of db.sessions) {
          if (session.records[targetId]) {
            session.records[cleanId] = session.records[targetId];
            delete session.records[targetId];
          }
        }
      }
    } else {
      if (db.students.some((s) => s.id === cleanId)) {
        res.status(409).json({ error: `Mã học sinh ${cleanId} đã tồn tại.` });
        return;
      }
      const nextStt =
        db.students.length > 0
          ? Math.max(...db.students.map((s) => s.stt)) + 1
          : 1;
      db.students.push({
        stt: nextStt,
        id: cleanId,
        fullName: cleanName,
        note: (payload.note ?? '').trim() || undefined,
      });
    }

    saveDb(db);
    res.json({ students: db.students });
  });

  // Delete a student
  app.delete('/api/students/:id', (req, res) => {
    const targetId = decodeURIComponent(req.params.id).trim().toUpperCase();
    const db = ensureDb();
    db.students = db.students
      .filter((s) => s.id !== targetId)
      .map((s, idx) => ({ ...s, stt: idx + 1 }));
    saveDb(db);
    res.json({ students: db.students });
  });

  // Add a subject
  app.post('/api/subjects', (req, res) => {
    const payload = req.body as Partial<Subject>;
    const cleanName = (payload.name ?? '').trim();
    const cleanCode = (payload.code ?? '').trim().toUpperCase();
    if (!cleanName) {
      res.status(400).json({ error: 'Tên môn học không được để trống.' });
      return;
    }

    const db = ensureDb();
    const slug = cleanName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    if (db.subjects.some((s) => s.id === slug || s.name.toLowerCase() === cleanName.toLowerCase())) {
      res.status(409).json({ error: `Môn học "${cleanName}" đã tồn tại.` });
      return;
    }

    const newSubject: Subject = {
      id: slug || `mon-${Date.now()}`,
      name: cleanName,
      code: cleanCode || slug.slice(0, 6).toUpperCase(),
      teacher: payload.teacher?.trim() || undefined,
    };
    db.subjects.push(newSubject);
    saveDb(db);
    res.json({ subject: newSubject, subjects: db.subjects });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
