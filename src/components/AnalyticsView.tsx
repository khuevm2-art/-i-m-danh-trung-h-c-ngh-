import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarPlus, Plus } from 'lucide-react';
import type {
  AttendanceSession,
  Student,
  Subject,
} from '../types/attendance.ts';
import { RecentAttendanceChart } from './RecentAttendanceChart.tsx';

interface AnalyticsViewProps {
  classNameLabel: string;
  students: Student[];
  subjects: Subject[];
  sessions: AttendanceSession[];
  canManageSubjects: boolean;
  onStartAttendanceForSubject: (subjectId: string) => void;
  onAddSubject: (subject: { name: string; code: string }) => Promise<void>;
}

export function AnalyticsView({
  classNameLabel,
  students,
  subjects,
  sessions,
  canManageSubjects,
  onStartAttendanceForSubject,
  onAddSubject,
}: AnalyticsViewProps) {
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [subjectError, setSubjectError] = useState('');
  const [addingSubject, setAddingSubject] = useState(false);

  const overallStats = useMemo(() => {
    let totalMarks = 0;
    let presentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    let unexcusedCount = 0;

    for (const s of sessions) {
      for (const st of students) {
        const rec = s.records[st.id];
        if (!rec) continue;
        totalMarks++;
        if (rec.status === 'present') presentCount++;
        else if (rec.status === 'late') lateCount++;
        else if (rec.status === 'excused') excusedCount++;
        else if (rec.status === 'unexcused') unexcusedCount++;
      }
    }

    const avgRate =
      totalMarks > 0
        ? Math.round(((presentCount + lateCount) / totalMarks) * 100)
        : null;

    return {
      totalSessions: sessions.length,
      totalMarks,
      presentCount,
      lateCount,
      excusedCount,
      unexcusedCount,
      avgRate,
    };
  }, [sessions, students]);

  const subjectBreakdown = useMemo(() => {
    return subjects.map((subj) => {
      const subjSessions = sessions.filter((s) => s.subjectId === subj.id);
      let total = 0;
      let attended = 0;
      let late = 0;
      let unexcused = 0;

      for (const s of subjSessions) {
        for (const st of students) {
          const rec = s.records[st.id];
          if (!rec) continue;
          total++;
          if (rec.status === 'present') attended++;
          else if (rec.status === 'late') {
            attended++;
            late++;
          } else if (rec.status === 'unexcused') {
            unexcused++;
          }
        }
      }

      const rate = total > 0 ? Math.round((attended / total) * 100) : null;
      return {
        subject: subj,
        sessionCount: subjSessions.length,
        late,
        unexcused,
        rate,
      };
    });
  }, [subjects, sessions, students]);

  const studentsAtRisk = useMemo(() => {
    const list: Array<{
      student: Student;
      total: number;
      unexcused: number;
      excused: number;
      late: number;
      rate: number;
      absentPct: number;
    }> = [];

    for (const student of students) {
      let total = 0;
      let present = 0;
      let late = 0;
      let excused = 0;
      let unexcused = 0;

      for (const s of sessions) {
        const rec = s.records[student.id];
        if (!rec) continue;
        total++;
        if (rec.status === 'present') present++;
        else if (rec.status === 'late') late++;
        else if (rec.status === 'excused') excused++;
        else if (rec.status === 'unexcused') unexcused++;
      }

      if (total === 0) continue;
      const rate = Math.round(((present + late) / total) * 100);
      const absentPct = Math.round(((excused + unexcused) / total) * 1000) / 10;
      if (unexcused > 0 || absentPct >= 10 || late >= 3) {
        list.push({ student, total, unexcused, excused, late, rate, absentPct });
      }
    }

    return list.sort((a, b) => b.absentPct - a.absentPct || b.unexcused - a.unexcused);
  }, [students, sessions]);

  async function handleCreateSubject(e: React.FormEvent) {
    e.preventDefault();
    setSubjectError('');
    if (!newSubjectName.trim()) {
      setSubjectError('Vui lòng nhập tên môn học.');
      return;
    }
    setAddingSubject(true);
    try {
      await onAddSubject({
        name: newSubjectName.trim(),
        code: newSubjectCode.trim().toUpperCase(),
      });
      setNewSubjectName('');
      setNewSubjectCode('');
    } catch (err) {
      setSubjectError(
        err instanceof Error ? err.message : 'Không thể thêm môn học.'
      );
    } finally {
      setAddingSubject(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h1 className="text-xl font-bold text-slate-900">
          Thống kê chuyên cần lớp {classNameLabel}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Tổng hợp số liệu điểm danh qua toàn bộ {subjects.length} môn học và {students.length} học sinh
        </p>
      </div>

      {/* 4-column summary strip */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">
            Tổng buổi đã điểm danh
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {overallStats.totalSessions}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">
            Tỷ lệ chuyên cần chung
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {overallStats.avgRate !== null ? `${overallStats.avgRate}%` : '—'}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-amber-700">
            Tổng lượt đi muộn
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {overallStats.lateCount}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-red-700">
            Tổng lượt vắng không phép
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {overallStats.unexcusedCount}
          </div>
        </div>
      </div>

      {/* Pie / Donut Chart for Recent Sessions */}
      <RecentAttendanceChart
        sessions={sessions}
        students={students}
        subjects={subjects}
      />

      {/* Subject Breakdown + Early Warning Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subject Attendance Breakdown (10 subjects) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">
              Tỷ lệ chuyên cần theo từng môn học
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {subjects.length} môn học
            </span>
          </div>

          <div className="divide-y divide-slate-200">
            {subjectBreakdown.map((item) => {
              const barWidth = item.rate !== null ? item.rate : 0;
              return (
                <div
                  key={item.subject.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="sm:w-44 shrink-0">
                    <div className="text-sm font-medium text-slate-900">
                      {item.subject.name}
                    </div>
                    <div className="text-xs text-slate-500 font-mono tabular-nums">
                      {item.sessionCount} buổi
                      {item.unexcused > 0 ? ` · ${item.unexcused} k. phép` : ''}
                    </div>
                  </div>

                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      {item.rate !== null && (
                        <div
                          className={`h-full rounded-full ${
                            item.rate < 80
                              ? 'bg-red-600'
                              : item.rate < 90
                              ? 'bg-amber-500'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                      )}
                    </div>
                    <span className="w-12 text-right text-sm font-mono tabular-nums font-semibold text-slate-900">
                      {item.rate !== null ? `${item.rate}%` : '—'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onStartAttendanceForSubject(item.subject.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    <span>Điểm danh</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: Attention List + Add Subject */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <h2 className="text-base font-semibold text-slate-900">
                Học sinh cần lưu ý
              </h2>
            </div>

            {sessions.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">
                Chưa có buổi điểm danh nào. Danh sách lưu ý (vắng từ 10%, có buổi vắng không phép hoặc đi muộn ≥ 3 lần) sẽ hiển thị khi có dữ liệu.
              </p>
            ) : studentsAtRisk.length === 0 ? (
              <p className="py-6 text-sm text-emerald-700 font-medium">
                Toàn bộ {students.length} học sinh đều đạt chuẩn chuyên cần (vắng &lt; 10% và 0 buổi vắng không phép).
              </p>
            ) : (
              <div className="divide-y divide-slate-200">
                {studentsAtRisk.map((row) => (
                  <div key={row.student.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {row.student.fullName}
                      </span>
                      <span
                        className={`font-mono text-xs font-semibold tabular-nums ${
                          row.absentPct >= 20
                            ? 'text-red-700'
                            : row.absentPct >= 10
                            ? 'text-amber-700'
                            : 'text-slate-700'
                        }`}
                      >
                        Vắng {row.absentPct}% · CC {row.rate}%
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                      {row.student.id} · {row.unexcused} k. phép · {row.excused} có phép · {row.late} muộn
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Custom Subject (Admin only) */}
          {canManageSubjects && (
            <form
              onSubmit={(e) => void handleCreateSubject(e)}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
            >
              <h2 className="text-base font-semibold text-slate-900">
                Thêm môn học mới
              </h2>
              <p className="text-xs text-slate-500">
                Mặc định lớp {classNameLabel} đã có đủ 10 môn. Bạn có thể bổ sung môn học tự chọn nếu cần.
              </p>
              <div>
                <label
                  htmlFor="new-subject-name"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Tên môn học
                </label>
                <input
                  id="new-subject-name"
                  type="text"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="Ví dụ: Hóa học"
                  className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label
                  htmlFor="new-subject-code"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Mã viết tắt (tùy chọn)
                </label>
                <input
                  id="new-subject-code"
                  type="text"
                  value={newSubjectCode}
                  onChange={(e) => setNewSubjectCode(e.target.value)}
                  placeholder="Ví dụ: HOA"
                  className="w-full h-9 px-3 text-sm font-mono uppercase bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              {subjectError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
                  {subjectError}
                </div>
              )}
              <button
                type="submit"
                disabled={addingSubject}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>{addingSubject ? 'Đang thêm...' : 'Thêm môn học'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
