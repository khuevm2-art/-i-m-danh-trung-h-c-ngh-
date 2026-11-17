import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarPlus, Download } from 'lucide-react';
import {
  ATTENDANCE_STATUS_META,
  type AttendanceSession,
  type Student,
  type Subject,
} from '../types/attendance.ts';
import { exportSummaryCsv, formatDateVi } from '../utils/csvExport.ts';

interface SubjectMatrixViewProps {
  classNameLabel: string;
  students: Student[];
  subjects: Subject[];
  sessions: AttendanceSession[];
  selectedSubjectId: string; // 'all' or subject id
  onSelectSubjectFilter: (id: string) => void;
  onOpenSession: (session: AttendanceSession) => void;
  onStartNewSession: () => void;
}

type MatrixMode = 'overview10' | 'sessions';

export function SubjectMatrixView({
  classNameLabel,
  students,
  subjects,
  sessions,
  selectedSubjectId,
  onSelectSubjectFilter,
  onOpenSession,
  onStartNewSession,
}: SubjectMatrixViewProps) {
  const [viewMode, setViewMode] = useState<MatrixMode>('overview10');
  const [onlyShowAbsent, setOnlyShowAbsent] = useState(false);

  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects]
  );

  // 10-Subject Absence Tracker (matches Roll-Call Book columns 1..13)
  const absenceMatrix = useMemo(() => {
    return students.map((student) => {
      let totalPeriods = 0;
      let totalAbsent = 0;
      let maxAbsentPct = 0;

      const bySubject = subjects.map((subj) => {
        const subjSessions = sessions.filter((s) => s.subjectId === subj.id);
        let marked = 0;
        let absent = 0;
        let late = 0;
        for (const s of subjSessions) {
          const rec = s.records[student.id];
          if (!rec) continue;
          marked++;
          if (rec.status === 'unexcused' || rec.status === 'excused') absent++;
          else if (rec.status === 'late') late++;
        }
        totalPeriods += marked;
        totalAbsent += absent;
        const pct = marked > 0 ? (absent / marked) * 100 : 0;
        if (pct > maxAbsentPct) maxAbsentPct = pct;
        return {
          subjectId: subj.id,
          marked,
          absent,
          late,
          pct,
        };
      });

      const overallPct =
        totalPeriods > 0 ? (totalAbsent / totalPeriods) * 100 : 0;

      return {
        student,
        bySubject,
        totalPeriods,
        totalAbsent,
        overallPct,
        maxAbsentPct,
      };
    });
  }, [students, subjects, sessions]);

  const displayedOverviewRows = useMemo(() => {
    if (!onlyShowAbsent) return absenceMatrix;
    return absenceMatrix.filter((row) => row.totalAbsent > 0);
  }, [absenceMatrix, onlyShowAbsent]);

  const filteredSessions = useMemo(() => {
    const list =
      selectedSubjectId === 'all'
        ? sessions
        : sessions.filter((s) => s.subjectId === selectedSubjectId);
    return [...list].sort((a, b) => a.date.localeCompare(b.date));
  }, [sessions, selectedSubjectId]);

  const activeSubjectName =
    selectedSubjectId === 'all'
      ? 'Tất cả 10 môn học'
      : subjectMap.get(selectedSubjectId)?.name ?? selectedSubjectId;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {viewMode === 'overview10'
              ? `Theo dõi vắng học 10 môn — Lớp ${classNameLabel}`
              : `Chi tiết từng buổi — ${activeSubjectName}`}
          </h1>
          <p className="mt-1 text-sm text-slate-500 tabular-nums">
            {viewMode === 'overview10'
              ? `Đối chiếu % vắng từng môn của ${students.length} học sinh · Lưu ý ≥ 10% · Cảnh báo ≥ 20%`
              : `${filteredSessions.length} tiết học đã ghi nhận · Nhấn vào cột ngày để chỉnh sửa`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Segmented Mode Switch */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('overview10')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'overview10'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Theo dõi vắng 10 môn
            </button>
            <button
              type="button"
              onClick={() => setViewMode('sessions')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'sessions'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ma trận từng tiết
            </button>
          </div>

          {viewMode === 'sessions' && (
            <select
              aria-label="Chọn môn học tổng hợp"
              value={selectedSubjectId}
              onChange={(e) => onSelectSubjectFilter(e.target.value)}
              className="h-9 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">Tất cả môn học ({sessions.length} tiết)</option>
              {subjects.map((subj) => {
                const count = sessions.filter((s) => s.subjectId === subj.id).length;
                return (
                  <option key={subj.id} value={subj.id}>
                    {subj.name} ({count} tiết)
                  </option>
                );
              })}
            </select>
          )}

          <button
            type="button"
            onClick={() =>
              exportSummaryCsv(
                classNameLabel,
                students,
                subjects,
                sessions,
                viewMode === 'overview10' ? 'all' : selectedSubjectId
              )
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

      {viewMode === 'overview10' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4 text-slate-600">
              <span className="font-semibold text-slate-700">Ngưỡng theo dõi:</span>
              <span className="text-emerald-700 font-medium">0% – 9.9%: Đạt</span>
              <span className="text-amber-700 font-medium">10% – 19.9%: Lưu ý</span>
              <span className="text-red-700 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>≥ 20%: Cảnh báo</span>
              </span>
            </div>

            <label className="inline-flex items-center gap-2 text-slate-700 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={onlyShowAbsent}
                onChange={(e) => setOnlyShowAbsent(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span>Chỉ hiện học sinh có buổi vắng</span>
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-3 text-right w-12 sticky left-0 bg-slate-50 z-10">
                    STT
                  </th>
                  <th className="py-3 px-3 w-24 sticky left-12 bg-slate-50 z-10">
                    MSSV
                  </th>
                  <th className="py-3 px-3 min-w-[185px] sticky left-36 bg-slate-50 z-10 border-r border-slate-200">
                    Họ và tên
                  </th>
                  {subjects.map((subj) => (
                    <th
                      key={subj.id}
                      className="py-2.5 px-2.5 text-right min-w-[84px] border-r border-slate-200"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectSubjectFilter(subj.id);
                          setViewMode('sessions');
                        }}
                        className="w-full text-right hover:text-blue-600 transition-colors"
                        title={`Xem chi tiết từng tiết môn ${subj.name}`}
                      >
                        <div className="truncate">{subj.name}</div>
                        <div className="text-[10px] font-mono font-normal text-slate-400">
                          {subj.code}
                        </div>
                      </button>
                    </th>
                  ))}
                  <th className="py-3 px-3 text-right min-w-[90px]">Tổng vắng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {displayedOverviewRows.map((row) => (
                  <tr key={row.student.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500 sticky left-0 bg-white">
                      {row.student.stt}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 sticky left-12 bg-white">
                      {row.student.id}
                    </td>
                    <td className="py-2.5 px-3 text-sm font-medium text-slate-900 sticky left-36 bg-white border-r border-slate-200 whitespace-nowrap">
                      {row.student.fullName}
                    </td>
                    {row.bySubject.map((cell) => {
                      const pctText =
                        cell.marked > 0
                          ? `${cell.pct.toFixed(1).replace('.', ',')}%`
                          : '—';
                      let cellStyle = 'text-slate-400';
                      if (cell.marked > 0) {
                        if (cell.pct >= 20) {
                          cellStyle = 'text-red-700 font-bold bg-red-50/70';
                        } else if (cell.pct >= 10) {
                          cellStyle = 'text-amber-700 font-semibold bg-amber-50/50';
                        } else if (cell.absent > 0) {
                          cellStyle = 'text-slate-800 font-medium';
                        } else {
                          cellStyle = 'text-emerald-700';
                        }
                      }

                      return (
                        <td
                          key={cell.subjectId}
                          title={
                            cell.marked > 0
                              ? `Vắng ${cell.absent}/${cell.marked} tiết (${pctText})`
                              : 'Chưa có tiết điểm danh'
                          }
                          className={`py-2.5 px-2.5 text-right font-mono tabular-nums border-r border-slate-200 ${cellStyle}`}
                        >
                          <div>{pctText}</div>
                          {cell.absent > 0 && (
                            <div className="text-[10px] font-normal opacity-80">
                              {cell.absent}/{cell.marked}t
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                      <span
                        className={
                          row.overallPct >= 20
                            ? 'text-red-700'
                            : row.overallPct >= 10
                            ? 'text-amber-700'
                            : 'text-slate-900'
                        }
                      >
                        {row.totalPeriods > 0
                          ? `${row.overallPct.toFixed(1).replace('.', ',')}%`
                          : '—'}
                      </span>
                      <div className="text-[10px] font-normal text-slate-400">
                        {row.totalAbsent}/{row.totalPeriods}t
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <h2 className="text-base font-semibold text-slate-900">
            Chưa có dữ liệu điểm danh cho {activeSubjectName}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
            Khi bạn lưu buổi điểm danh đầu tiên, bảng đối chiếu từng buổi của cả {students.length} học sinh lớp {classNameLabel} sẽ hiển thị tại đây.
          </p>
          <button
            type="button"
            onClick={onStartNewSession}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>Điểm danh buổi đầu tiên</span>
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Ký hiệu:</span>
            <span className="text-emerald-700 font-medium">✓ Có mặt (P)</span>
            <span className="text-amber-700 font-medium">◷ Đi muộn (M)</span>
            <span className="text-sky-700 font-medium">P* Vắng có phép (CP)</span>
            <span className="text-red-700 font-medium">✕ Vắng không phép (A)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-3 text-right w-12 sticky left-0 bg-slate-50 z-10">
                    STT
                  </th>
                  <th className="py-3 px-3 w-24 sticky left-12 bg-slate-50 z-10">
                    Mã HS
                  </th>
                  <th className="py-3 px-4 min-w-[180px] sticky left-36 bg-slate-50 z-10 border-r border-slate-200">
                    Họ và tên
                  </th>
                  {filteredSessions.map((s) => {
                    const subjCode = subjectMap.get(s.subjectId)?.code ?? s.subjectId;
                    return (
                      <th
                        key={s.id}
                        className="py-2.5 px-3 text-center min-w-[92px] border-r border-slate-200"
                      >
                        <button
                          type="button"
                          onClick={() => onOpenSession(s)}
                          title={`Mở điểm danh ${formatDateVi(s.date)} (${s.period})`}
                          className="w-full text-center hover:text-blue-600 transition-colors"
                        >
                          <div className="font-mono tabular-nums text-slate-900">
                            {formatDateVi(s.date).slice(0, 5)}
                          </div>
                          <div className="text-[11px] font-normal text-slate-500 truncate">
                            {selectedSubjectId === 'all' ? subjCode : s.period}
                          </div>
                        </button>
                      </th>
                    );
                  })}
                  <th className="py-3 px-3 text-right">Có mặt</th>
                  <th className="py-3 px-3 text-right">Muộn</th>
                  <th className="py-3 px-3 text-right">Vắng</th>
                  <th className="py-3 px-4 text-right">Chuyên cần</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {students.map((student) => {
                  let present = 0;
                  let late = 0;
                  let excused = 0;
                  let unexcused = 0;

                  for (const s of filteredSessions) {
                    const rec = s.records[student.id];
                    if (!rec) continue;
                    if (rec.status === 'present') present++;
                    else if (rec.status === 'late') late++;
                    else if (rec.status === 'excused') excused++;
                    else if (rec.status === 'unexcused') unexcused++;
                  }

                  const marked = present + late + excused + unexcused;
                  const rate =
                    marked > 0 ? Math.round(((present + late) / marked) * 100) : 100;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500 sticky left-0 bg-white">
                        {student.stt}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 sticky left-12 bg-white">
                        {student.id}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900 sticky left-36 bg-white border-r border-slate-200 whitespace-nowrap">
                        {student.fullName}
                      </td>
                      {filteredSessions.map((s) => {
                        const rec = s.records[student.id];
                        if (!rec) {
                          return (
                            <td
                              key={s.id}
                              className="py-2.5 px-3 text-center text-slate-300 border-r border-slate-200"
                            >
                              —
                            </td>
                          );
                        }
                        const meta = ATTENDANCE_STATUS_META[rec.status];
                        let colorClass = 'text-emerald-700';
                        if (rec.status === 'late') colorClass = 'text-amber-700';
                        else if (rec.status === 'excused') colorClass = 'text-sky-700';
                        else if (rec.status === 'unexcused') colorClass = 'text-red-700';

                        return (
                          <td
                            key={s.id}
                            title={`${meta.label}${rec.note ? ` — ${rec.note}` : ''}`}
                            className={`py-2.5 px-3 text-center text-xs font-medium border-r border-slate-200 whitespace-nowrap ${colorClass}`}
                          >
                            {meta.symbol} {meta.code}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 font-medium">
                        {present}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-700 font-medium">
                        {late}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-red-700 font-medium">
                        {excused + unexcused}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">
                        <span
                          className={
                            rate < 80
                              ? 'text-red-700'
                              : rate < 90
                              ? 'text-amber-700'
                              : 'text-slate-900'
                          }
                        >
                          {marked > 0 ? `${rate}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
