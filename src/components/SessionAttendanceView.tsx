import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  FileText,
  Printer,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  ATTENDANCE_STATUS_META,
  CLASS_PERIODS,
  type AttendanceEntry,
  type AttendanceSession,
  type AttendanceStatus,
  type Student,
  type Subject,
} from '../types/attendance.ts';
import { exportSessionCsv, formatDateVi, getTodayLocalIso } from '../utils/csvExport.ts';

interface SessionAttendanceViewProps {
  classNameLabel: string;
  students: Student[];
  subjects: Subject[];
  sessions: AttendanceSession[];
  selectedSubjectId: string;
  canDeleteSession: boolean;
  onSelectSubjectId: (id: string) => void;
  initialSessionToLoad?: AttendanceSession | null;
  onClearInitialSession?: () => void;
  onSaveSession: (session: AttendanceSession) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
}

type StatusFilter = 'all' | AttendanceStatus | 'absent';

export function SessionAttendanceView({
  classNameLabel,
  students,
  subjects,
  sessions,
  selectedSubjectId,
  canDeleteSession,
  onSelectSubjectId,
  initialSessionToLoad,
  onClearInitialSession,
  onSaveSession,
  onDeleteSession,
}: SessionAttendanceViewProps) {
  const [date, setDate] = useState<string>(getTodayLocalIso);
  const [period, setPeriod] = useState<string>(CLASS_PERIODS[0]);
  const [topic, setTopic] = useState<string>('');
  const [records, setRecords] = useState<Record<string, AttendanceEntry>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedText, setLastSavedText] = useState<string>('');
  const [saveError, setSaveError] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const currentSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) ?? subjects[0],
    [subjects, selectedSubjectId]
  );

  // If jumped from Matrix view to a specific session
  useEffect(() => {
    if (initialSessionToLoad) {
      onSelectSubjectId(initialSessionToLoad.subjectId);
      setDate(initialSessionToLoad.date);
      setPeriod(initialSessionToLoad.period);
      setTopic(initialSessionToLoad.topic);
      setRecords(initialSessionToLoad.records);
      onClearInitialSession?.();
    }
  }, [initialSessionToLoad, onSelectSubjectId, onClearInitialSession]);

  // Match existing saved session for (subjectId, date, period)
  const matchedSavedSession = useMemo(() => {
    return sessions.find(
      (s) =>
        s.subjectId === selectedSubjectId &&
        s.date === date &&
        s.period === period
    );
  }, [sessions, selectedSubjectId, date, period]);

  // Sync local draft state whenever (subject, date, period) changes
  useEffect(() => {
    setSaveError('');
    if (matchedSavedSession) {
      setTopic(matchedSavedSession.topic ?? '');
      const hydrated: Record<string, AttendanceEntry> = {};
      for (const student of students) {
        const existing = matchedSavedSession.records[student.id];
        hydrated[student.id] = existing
          ? { ...existing }
          : {
              status: 'present',
              note: '',
              updatedAt: matchedSavedSession.updatedAt,
            };
      }
      setRecords(hydrated);
      const timeStr = new Date(matchedSavedSession.updatedAt).toLocaleTimeString(
        'vi-VN',
        { hour: '2-digit', minute: '2-digit', second: '2-digit' }
      );
      setLastSavedText(`Đã lưu lúc ${timeStr}`);
    } else {
      setTopic('');
      const fresh: Record<string, AttendanceEntry> = {};
      const now = new Date().toISOString();
      for (const student of students) {
        fresh[student.id] = {
          status: 'present',
          note: '',
          updatedAt: now,
        };
      }
      setRecords(fresh);
      setLastSavedText('Chưa lưu buổi này');
    }
  }, [matchedSavedSession, students, selectedSubjectId, date, period]);

  const subjectSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.subjectId === selectedSubjectId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [sessions, selectedSubjectId]
  );

  // Summary counts
  const counts = useMemo(() => {
    let present = 0;
    let late = 0;
    let excused = 0;
    let unexcused = 0;
    for (const student of students) {
      const status = records[student.id]?.status ?? 'present';
      if (status === 'present') present++;
      else if (status === 'late') late++;
      else if (status === 'excused') excused++;
      else if (status === 'unexcused') unexcused++;
    }
    return {
      total: students.length,
      present,
      late,
      excused,
      unexcused,
      absentTotal: excused + unexcused,
    };
  }, [students, records]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((student) => {
      const status = records[student.id]?.status ?? 'present';
      if (statusFilter === 'absent') {
        if (status !== 'excused' && status !== 'unexcused') return false;
      } else if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        student.fullName.toLowerCase().includes(q) ||
        student.id.toLowerCase().includes(q)
      );
    });
  }, [students, records, searchQuery, statusFilter]);

  async function persistSession(
    nextRecords: Record<string, AttendanceEntry>,
    nextTopic: string
  ) {
    setIsSaving(true);
    setSaveError('');
    try {
      const now = new Date().toISOString();
      const sessionObj: AttendanceSession = {
        id:
          matchedSavedSession?.id ??
          `${selectedSubjectId}__${date}__${period}`,
        className: classNameLabel,
        subjectId: selectedSubjectId,
        date,
        period,
        topic: nextTopic,
        createdAt: matchedSavedSession?.createdAt ?? now,
        updatedAt: now,
        records: nextRecords,
      };
      await onSaveSession(sessionObj);
      const timeStr = new Date(now).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastSavedText(`Đã lưu lúc ${timeStr}`);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Không thể lưu điểm danh.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleStatusChange(studentId: string, nextStatus: AttendanceStatus) {
    const now = new Date().toISOString();
    const prev = records[studentId] ?? { status: 'present', note: '', updatedAt: now };
    const nextRecords = {
      ...records,
      [studentId]: {
        ...prev,
        status: nextStatus,
        updatedAt: now,
      },
    };
    setRecords(nextRecords);
    void persistSession(nextRecords, topic);
  }

  function handleNoteChange(studentId: string, note: string) {
    const now = new Date().toISOString();
    const prev = records[studentId] ?? { status: 'present', note: '', updatedAt: now };
    setRecords((curr) => ({
      ...curr,
      [studentId]: {
        ...prev,
        note,
        updatedAt: now,
      },
    }));
  }

  function handleNoteBlur() {
    void persistSession(records, topic);
  }

  function handleMarkAllPresent() {
    const now = new Date().toISOString();
    const nextRecords: Record<string, AttendanceEntry> = {};
    for (const student of students) {
      nextRecords[student.id] = {
        status: 'present',
        note: records[student.id]?.note ?? '',
        updatedAt: now,
      };
    }
    setRecords(nextRecords);
    void persistSession(nextRecords, topic);
  }

  function handleExportCurrentSession() {
    const now = new Date().toISOString();
    const currentSession: AttendanceSession = {
      id: matchedSavedSession?.id ?? `${selectedSubjectId}__${date}__${period}`,
      className: classNameLabel,
      subjectId: selectedSubjectId,
      date,
      period,
      topic,
      createdAt: matchedSavedSession?.createdAt ?? now,
      updatedAt: now,
      records,
    };
    exportSessionCsv(classNameLabel, currentSubject, currentSession, students);
  }

  const attendanceRate =
    counts.total > 0
      ? Math.round(((counts.present + counts.late) / counts.total) * 100)
      : 100;

  return (
    <div className="space-y-6">
      {/* Page Title & Session Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Điểm danh môn {currentSubject?.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500 flex flex-wrap items-center gap-2 tabular-nums">
              <span>Lớp {classNameLabel}</span>
              <span aria-hidden="true">·</span>
              <span>Ngày {formatDateVi(date)}</span>
              <span aria-hidden="true">·</span>
              <span>{period}</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  matchedSavedSession
                    ? 'text-emerald-700 font-medium'
                    : 'text-amber-700 font-medium'
                }
              >
                {isSaving ? 'Đang lưu...' : lastSavedText}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 no-print">
            <button
              type="button"
              onClick={() => void persistSession(records, topic)}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>Lưu điểm danh</span>
            </button>

            <button
              type="button"
              onClick={handleExportCurrentSession}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <FileText className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Xuất buổi này</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4 text-slate-500 shrink-0" />
              <span>In phiếu</span>
            </button>
          </div>
        </div>

        {/* Session Configuration Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5 no-print">
          <div>
            <label
              htmlFor="session-subject"
              className="block text-xs font-semibold text-slate-600 mb-1.5"
            >
              Môn học
            </label>
            <select
              id="session-subject"
              value={selectedSubjectId}
              onChange={(e) => onSelectSubjectId(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {subjects.map((subj) => (
                <option key={subj.id} value={subj.id}>
                  {subj.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="session-date"
              className="block text-xs font-semibold text-slate-600 mb-1.5"
            >
              Ngày học
            </label>
            <input
              id="session-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="session-period"
              className="block text-xs font-semibold text-slate-600 mb-1.5"
            >
              Tiết / Ca học
            </label>
            <select
              id="session-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {CLASS_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="session-topic"
              className="block text-xs font-semibold text-slate-600 mb-1.5"
            >
              Nội dung bài học
            </label>
            <input
              id="session-topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onBlur={() => {
                if (matchedSavedSession || topic.trim().length > 0) {
                  void persistSession(records, topic);
                }
              }}
              placeholder="Ví dụ: Chương 2 - Hàm số bậc nhất"
              className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {saveError && (
          <div className="mt-4 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {saveError}
          </div>
        )}
      </div>

      {/* 4-Cell Metric Strip (Single flat surface divided by hairlines) */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">Sĩ số lớp 10EC01</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {counts.total}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              Chuyên cần {attendanceRate}%
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>Có mặt</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {counts.present}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              / {counts.total} học sinh
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Đi muộn</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {counts.late}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">học sinh</span>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="text-xs font-medium text-red-700 flex items-center gap-1.5">
            <X className="w-3.5 h-3.5" />
            <span>Vắng mặt</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {counts.absentTotal}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              {counts.excused} có phép · {counts.unexcused} k. phép
            </span>
          </div>
        </div>
      </div>

      {/* Attendance Roster Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm mã HS hoặc họ tên..."
                className="w-full h-9 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {/* Segmented Filter Control */}
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg overflow-x-auto">
              {(
                [
                  { id: 'all', label: `Tất cả (${counts.total})` },
                  { id: 'present', label: `Có mặt (${counts.present})` },
                  { id: 'late', label: `Muộn (${counts.late})` },
                  { id: 'absent', label: `Vắng (${counts.absentTotal})` },
                ] as Array<{ id: StatusFilter; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleMarkAllPresent}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
          >
            <CheckCheck className="w-4 h-4 shrink-0" />
            <span>Tất cả Có mặt</span>
          </button>
        </div>

        {/* High-Density Data Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 w-14 text-right">STT</th>
                <th className="py-3 px-4 w-28">Mã HS</th>
                <th className="py-3 px-4 min-w-[200px]">Họ và tên</th>
                <th className="py-3 px-4 min-w-[340px]">Trạng thái điểm danh</th>
                <th className="py-3 px-4 min-w-[200px]">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 px-4 text-center text-slate-500">
                    <p>Không tìm thấy học sinh phù hợp với bộ lọc hiện tại.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('all');
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Xóa bộ lọc</span>
                    </button>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const entry = records[student.id] ?? {
                    status: 'present' as AttendanceStatus,
                    note: '',
                    updatedAt: '',
                  };
                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500">
                        {student.stt}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums font-medium text-slate-700">
                        {student.id}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {student.fullName}
                      </td>
                      <td className="py-2.5 px-4">
                        {/* Interactive Segmented Status Selector (Dual-coded: Icon + Text + Color) */}
                        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg gap-1">
                          {(
                            [
                              'present',
                              'late',
                              'excused',
                              'unexcused',
                            ] as AttendanceStatus[]
                          ).map((st) => {
                            const active = entry.status === st;
                            const meta = ATTENDANCE_STATUS_META[st];
                            let activeClasses = '';
                            if (active) {
                              if (st === 'present') {
                                activeClasses =
                                  'bg-emerald-600 text-white shadow-xs';
                              } else if (st === 'late') {
                                activeClasses =
                                  'bg-amber-600 text-white shadow-xs';
                              } else if (st === 'excused') {
                                activeClasses =
                                  'bg-sky-700 text-white shadow-xs';
                              } else {
                                activeClasses =
                                  'bg-red-600 text-white shadow-xs';
                              }
                            } else {
                              activeClasses =
                                'text-slate-600 hover:text-slate-900 hover:bg-white/70';
                            }

                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() => handleStatusChange(student.id, st)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${activeClasses}`}
                              >
                                <span aria-hidden="true">{meta.symbol}</span>
                                <span>{meta.shortLabel}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="text"
                          value={entry.note}
                          onChange={(e) =>
                            handleNoteChange(student.id, e.target.value)
                          }
                          onBlur={handleNoteBlur}
                          placeholder="Lý do / ghi chú..."
                          className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recorded Sessions History for This Subject */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 no-print">
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Lịch sử các buổi đã điểm danh — {currentSubject?.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {subjectSessions.length} buổi học đã lưu
            </p>
          </div>
        </div>

        {subjectSessions.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Chưa có buổi điểm danh nào được lưu cho môn {currentSubject?.name}. Hãy
            chọn trạng thái phía trên và nhấn &ldquo;Lưu điểm danh&rdquo;.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {subjectSessions.map((s) => {
              let p = 0;
              let l = 0;
              let a = 0;
              for (const st of students) {
                const status = s.records[st.id]?.status;
                if (status === 'present') p++;
                else if (status === 'late') l++;
                else if (status === 'excused' || status === 'unexcused') a++;
              }
              const isCurrent =
                s.date === date &&
                s.period === period &&
                s.subjectId === selectedSubjectId;

              return (
                <div
                  key={s.id}
                  className={`py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCurrent ? 'bg-blue-50/50 -mx-5 px-5' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900 tabular-nums">
                      <span className="font-mono">{formatDateVi(s.date)}</span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span>{s.period}</span>
                      {s.topic && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="text-slate-600 font-normal truncate">
                            {s.topic}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                      <span className="text-emerald-700 font-medium">
                        {p} có mặt
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-700 font-medium">{l} muộn</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-red-700 font-medium">{a} vắng</span>
                      {s.recordedByName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>GV: {s.recordedByName}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setDate(s.date);
                        setPeriod(s.period);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                        isCurrent
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {isCurrent ? 'Đang mở' : 'Mở buổi này'}
                    </button>

                    {canDeleteSession &&
                      (confirmDeleteId === s.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              void onDeleteSession(s.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2.5 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 whitespace-nowrap"
                          >
                            Xác nhận xóa
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(s.id)}
                          aria-label="Xóa buổi điểm danh"
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
