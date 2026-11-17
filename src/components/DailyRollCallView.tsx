import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Save,
  Search,
  Upload,
} from 'lucide-react';
import {
  ATTENDANCE_STATUS_META,
  DAILY_PERIODS,
  type AttendanceEntry,
  type AttendanceSession,
  type AttendanceStatus,
  type ClassDatabase,
  type Student,
  type Subject,
} from '../types/attendance.ts';
import {
  exportRollCallBookCsv,
  formatDateVi,
  getTodayLocalIso,
  getWeekdayVi,
} from '../utils/csvExport.ts';

interface DailyRollCallViewProps {
  db: ClassDatabase;
  canImportCsv: boolean;
  onSaveDailyRollCall: (payload: {
    date: string;
    periodSubjects: Record<string, string>;
    recordsByPeriod: Record<string, Record<string, AttendanceEntry>>;
  }) => Promise<void>;
  onImportCsvText: (csvText: string) => Promise<{
    importedSessions: number;
    importedDays: number;
  }>;
}

export function DailyRollCallView({
  db,
  canImportCsv,
  onSaveDailyRollCall,
  onImportCsvText,
}: DailyRollCallViewProps) {
  const todayIso = getTodayLocalIso();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (db.schedule?.[todayIso]) return todayIso;
    const allDates = Array.from(
      new Set([
        ...Object.keys(db.schedule ?? {}),
        ...db.sessions.map((s) => s.date),
      ])
    ).sort();
    return allDates.includes('2026-11-17')
      ? '2026-11-17'
      : allDates[allDates.length - 1] ?? todayIso;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [periodSubjects, setPeriodSubjects] = useState<Record<string, string>>(
    {}
  );
  const [recordsByPeriod, setRecordsByPeriod] = useState<
    Record<string, Record<string, AttendanceEntry>>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const subjectMap = useMemo(
    () => new Map<string, Subject>(db.subjects.map((s) => [s.id, s])),
    [db.subjects]
  );

  // All sorted dates present in schedule or sessions
  const allKnownDates = useMemo(() => {
    const set = new Set<string>([
      ...Object.keys(db.schedule ?? {}),
      ...db.sessions.map((s) => s.date),
    ]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [db.schedule, db.sessions]);

  // Dates that already have recorded attendance
  const recordedDatesSet = useMemo(() => {
    const set = new Set<string>();
    for (const s of db.sessions) {
      if (Object.keys(s.records).length > 0) {
        set.add(s.date);
      }
    }
    return set;
  }, [db.sessions]);

  // Quick focus strip: last 6 scheduled dates around selectedDate or end of schedule
  const quickDates = useMemo(() => {
    if (allKnownDates.length <= 7) return allKnownDates;
    const idx = allKnownDates.indexOf(selectedDate);
    if (idx < 0) return allKnownDates.slice(-7);
    const start = Math.max(0, Math.min(idx - 3, allKnownDates.length - 7));
    return allKnownDates.slice(start, start + 7);
  }, [allKnownDates, selectedDate]);

  // Hydrate local draft for selectedDate
  useEffect(() => {
    setErrorMessage('');
    const daySched = db.schedule?.[selectedDate] ?? {};
    const daySessions = db.sessions.filter((s) => s.date === selectedDate);
    const now = new Date().toISOString();

    const nextSubjs: Record<string, string> = {};
    const nextRecs: Record<string, Record<string, AttendanceEntry>> = {};

    for (const period of DAILY_PERIODS) {
      const existingSess = daySessions.find((s) => s.period === period);
      const subjId = existingSess?.subjectId ?? daySched[period] ?? '';
      nextSubjs[period] = subjId;

      const periodMap: Record<string, AttendanceEntry> = {};
      if (subjId) {
        for (const student of db.students) {
          const rec = existingSess?.records?.[student.id];
          periodMap[student.id] = rec
            ? { ...rec }
            : { status: 'present', note: '', updatedAt: now };
        }
      }
      nextRecs[period] = periodMap;
    }

    setPeriodSubjects(nextSubjs);
    setRecordsByPeriod(nextRecs);

    if (daySessions.length > 0) {
      const latest = daySessions[0].updatedAt;
      const t = new Date(latest).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const recorders = Array.from(
        new Set(daySessions.map((s) => s.recordedByName).filter(Boolean))
      );
      const recorderSuffix =
        recorders.length > 0 ? ` · GV: ${recorders.join(', ')}` : '';
      setStatusMessage(
        `Đã có dữ liệu điểm danh (${daySessions.length} tiết · cập nhật ${t}${recorderSuffix})`
      );
    } else if (Object.keys(daySched).length > 0) {
      setStatusMessage('Đã tải thời khóa biểu từ Sổ điểm danh — sẵn sàng điểm danh');
    } else {
      setStatusMessage('Ngày chưa có thời khóa biểu — bạn có thể chọn môn cho từng tiết');
    }
  }, [selectedDate, db.schedule, db.sessions, db.students]);

  const activePeriods = useMemo(
    () => DAILY_PERIODS.filter((p) => Boolean(periodSubjects[p])),
    [periodSubjects]
  );

  // Semester-wide stats per student (excluding current draft overrides, or reflecting live)
  const semesterStatsByStudent = useMemo(() => {
    const map = new Map<string, { total: number; absent: number; late: number }>();
    for (const st of db.students) {
      let total = 0;
      let absent = 0;
      let late = 0;
      for (const s of db.sessions) {
        const rec = s.records[st.id];
        if (!rec) continue;
        total++;
        if (rec.status === 'unexcused' || rec.status === 'excused') absent++;
        else if (rec.status === 'late') late++;
      }
      map.set(st.id, { total, absent, late });
    }
    return map;
  }, [db.students, db.sessions]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return db.students;
    return db.students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );
  }, [db.students, searchQuery]);

  // Day-level live summary
  const daySummary = useMemo(() => {
    let totalChecks = 0;
    let present = 0;
    let late = 0;
    let excused = 0;
    let unexcused = 0;
    const absentStudents = new Set<string>();

    for (const period of activePeriods) {
      const pMap = recordsByPeriod[period] ?? {};
      for (const st of db.students) {
        const rec = pMap[st.id];
        if (!rec) continue;
        totalChecks++;
        if (rec.status === 'present') present++;
        else if (rec.status === 'late') late++;
        else if (rec.status === 'excused') {
          excused++;
          absentStudents.add(st.id);
        } else if (rec.status === 'unexcused') {
          unexcused++;
          absentStudents.add(st.id);
        }
      }
    }
    return {
      totalChecks,
      present,
      late,
      excused,
      unexcused,
      absentStudentCount: absentStudents.size,
    };
  }, [activePeriods, recordsByPeriod, db.students]);

  function handleChangePeriodSubject(period: string, nextSubjectId: string) {
    const now = new Date().toISOString();
    setPeriodSubjects((prev) => ({ ...prev, [period]: nextSubjectId }));
    setRecordsByPeriod((prev) => {
      if (!nextSubjectId) {
        return { ...prev, [period]: {} };
      }
      const existing = prev[period] ?? {};
      const hydrated: Record<string, AttendanceEntry> = {};
      for (const st of db.students) {
        hydrated[st.id] = existing[st.id] ?? {
          status: 'present',
          note: '',
          updatedAt: now,
        };
      }
      return { ...prev, [period]: hydrated };
    });
  }

  function handleSetCellStatus(
    period: string,
    studentId: string,
    status: AttendanceStatus
  ) {
    const now = new Date().toISOString();
    setRecordsByPeriod((prev) => {
      const periodMap = prev[period] ?? {};
      const curr = periodMap[studentId] ?? {
        status: 'present',
        note: '',
        updatedAt: now,
      };
      return {
        ...prev,
        [period]: {
          ...periodMap,
          [studentId]: { ...curr, status, updatedAt: now },
        },
      };
    });
  }

  function handleMarkAllPeriodPresent(period: string) {
    const now = new Date().toISOString();
    setRecordsByPeriod((prev) => {
      const periodMap = prev[period] ?? {};
      const nextPeriod: Record<string, AttendanceEntry> = {};
      for (const st of db.students) {
        nextPeriod[st.id] = {
          status: 'present',
          note: periodMap[st.id]?.note ?? '',
          updatedAt: now,
        };
      }
      return { ...prev, [period]: nextPeriod };
    });
  }

  function handleMarkAllDayPresent() {
    const now = new Date().toISOString();
    setRecordsByPeriod((prev) => {
      const next = { ...prev };
      for (const period of activePeriods) {
        const periodMap = prev[period] ?? {};
        const nextPeriod: Record<string, AttendanceEntry> = {};
        for (const st of db.students) {
          nextPeriod[st.id] = {
            status: 'present',
            note: periodMap[st.id]?.note ?? '',
            updatedAt: now,
          };
        }
        next[period] = nextPeriod;
      }
      return next;
    });
  }

  function handleMarkStudentAllDay(studentId: string, status: AttendanceStatus) {
    const now = new Date().toISOString();
    setRecordsByPeriod((prev) => {
      const next = { ...prev };
      for (const period of activePeriods) {
        const periodMap = prev[period] ?? {};
        const curr = periodMap[studentId] ?? {
          status: 'present',
          note: '',
          updatedAt: now,
        };
        next[period] = {
          ...periodMap,
          [studentId]: { ...curr, status, updatedAt: now },
        };
      }
      return next;
    });
  }

  function handleStudentDayNote(studentId: string, note: string) {
    const firstPeriod = activePeriods[0];
    if (!firstPeriod) return;
    const now = new Date().toISOString();
    setRecordsByPeriod((prev) => {
      const periodMap = prev[firstPeriod] ?? {};
      const curr = periodMap[studentId] ?? {
        status: 'present',
        note: '',
        updatedAt: now,
      };
      return {
        ...prev,
        [firstPeriod]: {
          ...periodMap,
          [studentId]: { ...curr, note, updatedAt: now },
        },
      };
    });
  }

  function getStudentDayNote(studentId: string): string {
    for (const p of activePeriods) {
      const note = recordsByPeriod[p]?.[studentId]?.note;
      if (note) return note;
    }
    return '';
  }

  async function handleSaveDay() {
    if (activePeriods.length === 0) {
      setErrorMessage('Vui lòng chọn ít nhất 1 môn học cho các tiết trong ngày.');
      return;
    }
    setIsSaving(true);
    setErrorMessage('');
    try {
      await onSaveDailyRollCall({
        date: selectedDate,
        periodSubjects,
        recordsByPeriod,
      });
      const t = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setStatusMessage(`Đã lưu điểm danh ngày ${formatDateVi(selectedDate)} lúc ${t}`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Không thể lưu điểm danh ngày.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  function navigateDate(delta: number) {
    const idx = allKnownDates.indexOf(selectedDate);
    if (idx >= 0 && idx + delta >= 0 && idx + delta < allKnownDates.length) {
      setSelectedDate(allKnownDates[idx + delta]);
      return;
    }
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d + delta);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(dt.getDate()).padStart(2, '0')}`;
    setSelectedDate(iso);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setErrorMessage('');
    try {
      const text = await file.text();
      const res = await onImportCsvText(text);
      setStatusMessage(
        `Đã nhập CSV thành công (${res.importedDays} ngày · ${res.importedSessions} tiết học)`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Không thể đọc file CSV.'
      );
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const weekdayLabel = getWeekdayVi(selectedDate);
  const isAlreadyRecorded = recordedDatesSet.has(selectedDate);

  return (
    <div className="space-y-6">
      {/* Roll-Call Window Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Cửa sổ Điểm danh Theo Ngày — Lớp {db.className}
            </h1>
            <p className="mt-1 text-sm text-slate-500 flex flex-wrap items-center gap-2 tabular-nums">
              <span className="font-medium text-slate-700">
                {weekdayLabel}, {formatDateVi(selectedDate)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{activePeriods.length} tiết có lịch</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  isAlreadyRecorded
                    ? 'text-emerald-700 font-medium'
                    : 'text-amber-700 font-medium'
                }
              >
                {statusMessage}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 no-print">
            {canImportCsv && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => void handleFileUpload(e)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>{importing ? 'Đang nhập...' : 'Nhập file CSV'}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => exportRollCallBookCsv(db)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Xuất Sổ điểm danh CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>In</span>
            </button>

            <button
              type="button"
              onClick={() => void handleSaveDay()}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu điểm danh ngày'}</span>
            </button>
          </div>
        </div>

        {/* Date Picker & Quick Scheduled Days Strip */}
        <div className="pt-4 border-t border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigateDate(-1)}
              aria-label="Ngày trước"
              className="h-9 px-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                aria-label="Chọn ngày điểm danh"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-9 pl-9 pr-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              type="button"
              onClick={() => navigateDate(1)}
              aria-label="Ngày sau"
              className="h-9 px-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0">
            {quickDates.map((d) => {
              const isSelected = d === selectedDate;
              const hasData = recordedDatesSet.has(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDate(d)}
                  className={`px-3 py-1.5 text-xs font-mono tabular-nums rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                      : hasData
                      ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  {formatDateVi(d).slice(0, 5)}
                  {!hasData ? ' (Chờ)' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {errorMessage && (
          <div className="px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {errorMessage}
          </div>
        )}
      </div>

      {/* 4-Cell Day Metric Strip */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">Sĩ số / Số tiết</div>
          <div className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {db.students.length} HS · {activePeriods.length} tiết
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs font-medium text-emerald-700">Lượt Có mặt (P)</div>
          <div className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {daySummary.present}{' '}
            <span className="text-xs font-normal text-slate-500">
              / {daySummary.totalChecks} lượt
            </span>
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs font-medium text-amber-700">Đi muộn / Có phép</div>
          <div className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {daySummary.late} muộn · {daySummary.excused} phép
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs font-medium text-red-700">Vắng mặt (A)</div>
          <div className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {daySummary.unexcused} lượt{' '}
            <span className="text-xs font-normal text-slate-500">
              ({daySummary.absentStudentCount} HS)
            </span>
          </div>
        </div>
      </div>

      {/* Main 5-Period Roll-Call Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Grid Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm MSSV hoặc họ tên học sinh..."
              className="w-full h-9 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 mr-2">
              P: Có mặt · A: Vắng (Không phép) · M: Muộn · CP: Có phép
            </span>
            <button
              type="button"
              onClick={handleMarkAllDayPresent}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Tất cả P cả ngày</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-700">
                <th className="py-3 px-3 text-right w-12 font-semibold sticky left-0 bg-slate-50 z-10">
                  STT
                </th>
                <th className="py-3 px-3 w-24 font-semibold sticky left-12 bg-slate-50 z-10">
                  MSSV
                </th>
                <th className="py-3 px-3 min-w-[185px] font-semibold sticky left-36 bg-slate-50 z-10 border-r border-slate-200">
                  Họ và tên
                </th>

                {DAILY_PERIODS.map((period) => {
                  const subjId = periodSubjects[period] ?? '';
                  const subj = subjId ? subjectMap.get(subjId) : undefined;
                  return (
                    <th
                      key={period}
                      className="py-2.5 px-2.5 min-w-[144px] border-r border-slate-200 align-top"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-slate-900">{period}</span>
                        {subj && (
                          <button
                            type="button"
                            onClick={() => handleMarkAllPeriodPresent(period)}
                            title={`Đánh dấu tất cả Có mặt (P) cho ${period}`}
                            className="text-[11px] font-medium text-emerald-700 hover:underline whitespace-nowrap"
                          >
                            Tất cả P
                          </button>
                        )}
                      </div>

                      <select
                        aria-label={`Chọn môn cho ${period}`}
                        value={subjId}
                        onChange={(e) =>
                          handleChangePeriodSubject(period, e.target.value)
                        }
                        className="w-full h-7 px-1.5 text-xs font-medium bg-white border border-slate-200 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="">— Trống —</option>
                        {db.subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>

                      {subj && (
                        <div className="mt-1 text-[11px] font-normal text-slate-500 font-mono truncate">
                          {subj.code}
                          {subj.teacher ? ` · ${subj.teacher}` : ''}
                        </div>
                      )}
                    </th>
                  );
                })}

                <th className="py-3 px-3 min-w-[130px] font-semibold border-r border-slate-200">
                  Ghi chú / Cộng điểm
                </th>
                <th className="py-3 px-3 text-right w-24 font-semibold">
                  Vắng HK
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredStudents.map((student: Student) => {
                const sem = semesterStatsByStudent.get(student.id) ?? {
                  total: 0,
                  absent: 0,
                  late: 0,
                };
                const semPct =
                  sem.total > 0
                    ? ((sem.absent / sem.total) * 100).toFixed(1)
                    : '0.0';

                return (
                  <tr key={student.id} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500 sticky left-0 bg-white">
                      {student.stt}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums font-medium text-slate-700 sticky left-12 bg-white">
                      {student.id}
                    </td>
                    <td className="py-2 px-3 sticky left-36 bg-white border-r border-slate-200">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900 whitespace-nowrap">
                          {student.fullName}
                        </span>
                        {activePeriods.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              handleMarkStudentAllDay(student.id, 'present')
                            }
                            title="Đánh dấu P tất cả các tiết trong ngày"
                            className="text-[11px] text-slate-400 hover:text-emerald-700 font-mono shrink-0 no-print"
                          >
                            [P]
                          </button>
                        )}
                      </div>
                    </td>

                    {DAILY_PERIODS.map((period) => {
                      const subjId = periodSubjects[period];
                      if (!subjId) {
                        return (
                          <td
                            key={period}
                            className="py-2 px-2.5 text-center text-slate-300 border-r border-slate-200 bg-slate-50/40"
                          >
                            —
                          </td>
                        );
                      }

                      const entry = recordsByPeriod[period]?.[student.id];
                      const currentStatus: AttendanceStatus =
                        entry?.status ?? 'present';

                      return (
                        <td
                          key={period}
                          className="py-1.5 px-2 border-r border-slate-200"
                        >
                          <div className="grid grid-cols-4 gap-1 bg-slate-100 p-0.5 rounded-md">
                            {(
                              [
                                'present',
                                'unexcused',
                                'late',
                                'excused',
                              ] as AttendanceStatus[]
                            ).map((st) => {
                              const active = currentStatus === st;
                              const meta = ATTENDANCE_STATUS_META[st];
                              let btnClass =
                                'text-slate-500 hover:text-slate-900 hover:bg-white/70';
                              if (active) {
                                if (st === 'present') {
                                  btnClass = 'bg-emerald-600 text-white font-semibold';
                                } else if (st === 'unexcused') {
                                  btnClass = 'bg-red-600 text-white font-semibold';
                                } else if (st === 'late') {
                                  btnClass = 'bg-amber-600 text-white font-semibold';
                                } else {
                                  btnClass = 'bg-sky-700 text-white font-semibold';
                                }
                              }
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  title={`${meta.label} — ${student.fullName} (${period})`}
                                  onClick={() =>
                                    handleSetCellStatus(period, student.id, st)
                                  }
                                  className={`py-1 text-[11px] font-mono rounded transition-colors ${btnClass}`}
                                >
                                  {meta.code}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}

                    <td className="py-1.5 px-2.5 border-r border-slate-200">
                      <input
                        type="text"
                        value={getStudentDayNote(student.id)}
                        onChange={(e) =>
                          handleStudentDayNote(student.id, e.target.value)
                        }
                        placeholder="VD: 1 đ +, ốm..."
                        className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </td>

                    <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">
                      <div
                        className={
                          sem.absent > 5
                            ? 'text-red-700 font-semibold'
                            : 'text-slate-700 font-medium'
                        }
                      >
                        {semPct}%
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {sem.absent}/{sem.total}t
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
