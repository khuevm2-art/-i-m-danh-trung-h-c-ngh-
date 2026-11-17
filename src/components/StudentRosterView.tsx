import { useMemo, useState } from 'react';
import {
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  ATTENDANCE_STATUS_META,
  type AttendanceSession,
  type Student,
  type Subject,
} from '../types/attendance.ts';
import { formatDateVi } from '../utils/csvExport.ts';

interface StudentRosterViewProps {
  classNameLabel: string;
  students: Student[];
  subjects: Subject[];
  sessions: AttendanceSession[];
  canManageRoster: boolean;
  onSaveStudent: (student: {
    id: string;
    fullName: string;
    note?: string;
    originalId?: string;
  }) => Promise<void>;
  onDeleteStudent: (studentId: string) => Promise<void>;
}

export function StudentRosterView({
  classNameLabel,
  students,
  subjects,
  sessions,
  canManageRoster,
  onSaveStudent,
  onDeleteStudent,
}: StudentRosterViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingOriginalId, setEditingOriginalId] = useState<string | undefined>(
    undefined
  );
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s.name])),
    [subjects]
  );

  const studentStats = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number;
        present: number;
        late: number;
        excused: number;
        unexcused: number;
        rate: number;
        history: Array<{
          session: AttendanceSession;
          subjectName: string;
          status: 'present' | 'late' | 'excused' | 'unexcused';
          note: string;
        }>;
      }
    >();

    for (const student of students) {
      let present = 0;
      let late = 0;
      let excused = 0;
      let unexcused = 0;
      const history: Array<{
        session: AttendanceSession;
        subjectName: string;
        status: 'present' | 'late' | 'excused' | 'unexcused';
        note: string;
      }> = [];

      for (const session of sessions) {
        const rec = session.records[student.id];
        if (!rec) continue;
        if (rec.status === 'present') present++;
        else if (rec.status === 'late') late++;
        else if (rec.status === 'excused') excused++;
        else if (rec.status === 'unexcused') unexcused++;

        history.push({
          session,
          subjectName: subjectMap.get(session.subjectId) ?? session.subjectId,
          status: rec.status,
          note: rec.note,
        });
      }

      history.sort((a, b) => b.session.date.localeCompare(a.session.date));
      const total = present + late + excused + unexcused;
      const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
      map.set(student.id, {
        total,
        present,
        late,
        excused,
        unexcused,
        rate,
        history,
      });
    }
    return map;
  }, [students, sessions, subjectMap]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const activeDetailStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) ?? null,
    [students, selectedStudentId]
  );

  function openAddForm() {
    setEditingOriginalId(undefined);
    setFormId('');
    setFormName('');
    setFormNote('');
    setFormError('');
    setFormOpen(true);
  }

  function openEditForm(student: Student) {
    setEditingOriginalId(student.id);
    setFormId(student.id);
    setFormName(student.fullName);
    setFormNote(student.note ?? '');
    setFormError('');
    setFormOpen(true);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!formId.trim() || !formName.trim()) {
      setFormError('Vui lòng nhập đầy đủ Mã học sinh và Họ và tên.');
      return;
    }
    setSubmitting(true);
    try {
      await onSaveStudent({
        id: formId.trim().toUpperCase(),
        fullName: formName.trim(),
        note: formNote.trim() || undefined,
        originalId: editingOriginalId,
      });
      setFormOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Không thể lưu thông tin học sinh.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Danh sách học sinh lớp {classNameLabel}
          </h1>
          <p className="mt-1 text-sm text-slate-500 tabular-nums">
            Sĩ số hiện tại: {students.length} học sinh · Theo dõi tỷ lệ chuyên cần từng cá nhân
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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

          {canManageRoster && (
            <button
              type="button"
              onClick={openAddForm}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm học sinh</span>
            </button>
          )}
        </div>
      </div>

      {/* Add / Edit Inline Form */}
      {formOpen && (
        <form
          onSubmit={(e) => void handleFormSubmit(e)}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              {editingOriginalId
                ? `Chỉnh sửa thông tin học sinh (${editingOriginalId})`
                : `Thêm học sinh mới vào lớp ${classNameLabel}`}
            </h2>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
              aria-label="Đóng biểu mẫu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="student-id-input"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                Mã học sinh
              </label>
              <input
                id="student-id-input"
                type="text"
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                placeholder="Ví dụ: TD02015"
                className="w-full h-10 px-3 text-sm font-mono uppercase bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="student-name-input"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                Họ và tên
              </label>
              <input
                id="student-name-input"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nhập họ và tên đầy đủ"
                className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="student-note-input"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                Ghi chú hồ sơ (tùy chọn)
              </label>
              <input
                id="student-note-input"
                type="text"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="Ví dụ: Lớp trưởng, SĐT phụ huynh..."
                className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {formError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {formError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </div>
        </form>
      )}

      {/* Split Table + Detail Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div
          className={`bg-white border border-slate-200 rounded-xl overflow-hidden ${
            activeDetailStudent ? 'xl:col-span-2' : 'xl:col-span-3'
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 w-14 text-right">STT</th>
                  <th className="py-3 px-4 w-28">Mã HS</th>
                  <th className="py-3 px-4 min-w-[200px]">Họ và tên</th>
                  <th className="py-3 px-4 text-right">Số buổi</th>
                  <th className="py-3 px-4 text-right">Có mặt</th>
                  <th className="py-3 px-4 text-right">Muộn</th>
                  <th className="py-3 px-4 text-right">Có phép</th>
                  <th className="py-3 px-4 text-right">K. phép</th>
                  <th className="py-3 px-4 text-right">Chuyên cần</th>
                  <th className="py-3 px-4 text-right w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredStudents.map((student) => {
                  const st = studentStats.get(student.id) ?? {
                    total: 0,
                    present: 0,
                    late: 0,
                    excused: 0,
                    unexcused: 0,
                    rate: 100,
                    history: [],
                  };
                  const isSelected = selectedStudentId === student.id;

                  return (
                    <tr
                      key={student.id}
                      onClick={() => setSelectedStudentId(student.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                        {student.stt}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums font-medium text-slate-700">
                        {student.id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">
                          {student.fullName}
                        </div>
                        {student.note && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {student.note}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                        {st.total}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">
                        {st.present}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700">
                        {st.late}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-sky-700">
                        {st.excused}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-red-700 font-medium">
                        {st.unexcused}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                        {st.total > 0 ? (
                          <span
                            className={
                              st.rate < 80
                                ? 'text-red-700'
                                : st.rate < 90
                                ? 'text-amber-700'
                                : 'text-slate-900'
                            }
                          >
                            {st.rate}%
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>
                      <td
                        className="py-3 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          {canManageRoster && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditForm(student)}
                                aria-label={`Sửa ${student.fullName}`}
                                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              {confirmDeleteId === student.id ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void onDeleteStudent(student.id);
                                    setConfirmDeleteId(null);
                                    if (selectedStudentId === student.id) {
                                      setSelectedStudentId(null);
                                    }
                                  }}
                                  className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                                >
                                  Xóa
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(student.id)}
                                  aria-label={`Xóa ${student.fullName}`}
                                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedStudentId(student.id)}
                            aria-label={`Xem chi tiết ${student.fullName}`}
                            className="p-1.5 text-slate-400 hover:text-slate-900 rounded-md hover:bg-slate-100"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Individual Student Detail Panel */}
        {activeDetailStudent && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <div className="font-mono text-xs font-medium text-slate-500">
                  {activeDetailStudent.id} · STT {activeDetailStudent.stt}
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                  {activeDetailStudent.fullName}
                </h2>
                {activeDetailStudent.note && (
                  <p className="text-xs text-slate-500 mt-1">
                    {activeDetailStudent.note}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentId(null)}
                aria-label="Đóng chi tiết"
                className="p-1 text-slate-400 hover:text-slate-800 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const detail = studentStats.get(activeDetailStudent.id);
              if (!detail || detail.history.length === 0) {
                return (
                  <p className="text-sm text-slate-500 py-4">
                    Học sinh này chưa có lịch sử điểm danh nào được lưu.
                  </p>
                );
              }
              return (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-500">
                    Lịch sử điểm danh gần đây ({detail.history.length} buổi)
                  </div>
                  <div className="divide-y divide-slate-200 max-h-[420px] overflow-y-auto">
                    {detail.history.map((item) => {
                      const meta = ATTENDANCE_STATUS_META[item.status];
                      let colorClass = 'text-emerald-700';
                      if (item.status === 'late') colorClass = 'text-amber-700';
                      else if (item.status === 'excused')
                        colorClass = 'text-sky-700';
                      else if (item.status === 'unexcused')
                        colorClass = 'text-red-700';

                      return (
                        <div
                          key={item.session.id}
                          className="py-2.5 flex items-start justify-between gap-3 text-sm"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 truncate">
                              {item.subjectName}
                            </div>
                            <div className="text-xs text-slate-500 font-mono tabular-nums">
                              {formatDateVi(item.session.date)} ·{' '}
                              {item.session.period}
                            </div>
                            {item.note && (
                              <div className="text-xs text-slate-600 mt-0.5">
                                Ghi chú: {item.note}
                              </div>
                            )}
                          </div>
                          <span
                            className={`text-xs font-medium whitespace-nowrap shrink-0 ${colorClass}`}
                          >
                            {meta.symbol} {meta.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
