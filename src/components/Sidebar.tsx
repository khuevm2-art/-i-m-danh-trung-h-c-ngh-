import {
  BarChart3,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  Grid2x2,
  LogOut,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  AttendanceSession,
  Subject,
  UserProfile,
} from '../types/attendance.ts';

export type ActiveTab =
  | 'daily'
  | 'attendance'
  | 'matrix'
  | 'students'
  | 'analytics'
  | 'teachers';

interface SidebarProps {
  classNameLabel: string;
  academicYear: string;
  studentCount: number;
  subjects: Subject[];
  sessions: AttendanceSession[];
  activeTab: ActiveTab;
  selectedSubjectId: string;
  currentUser: UserProfile;
  pendingTeacherCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectTab: (tab: ActiveTab) => void;
  onSelectSubject: (subjectId: string) => void;
  onSignOut: () => Promise<void>;
}

const BASE_NAV_ITEMS: Array<{
  id: ActiveTab;
  label: string;
  icon: typeof CalendarCheck2;
}> = [
  { id: 'daily', label: 'Điểm danh theo Ngày', icon: CalendarDays },
  { id: 'attendance', label: 'Điểm danh theo Môn', icon: CalendarCheck2 },
  { id: 'matrix', label: 'Tổng hợp theo môn', icon: Grid2x2 },
  { id: 'students', label: 'Danh sách học sinh', icon: Users },
  { id: 'analytics', label: 'Thống kê chuyên cần', icon: BarChart3 },
];

export function Sidebar({
  classNameLabel,
  academicYear,
  studentCount,
  subjects,
  sessions,
  activeTab,
  selectedSubjectId,
  currentUser,
  pendingTeacherCount,
  mobileOpen,
  onCloseMobile,
  onSelectTab,
  onSelectSubject,
  onSignOut,
}: SidebarProps) {
  const sessionCounts = new Map<string, number>();
  for (const s of sessions) {
    sessionCounts.set(s.subjectId, (sessionCounts.get(s.subjectId) ?? 0) + 1);
  }

  const navItems =
    currentUser.role === 'admin'
      ? [
          ...BASE_NAV_ITEMS,
          {
            id: 'teachers' as ActiveTab,
            label:
              pendingTeacherCount > 0
                ? `Giảng viên (${pendingTeacherCount} chờ)`
                : 'Quản lý Giảng viên',
            icon: ShieldCheck,
          },
        ]
      : BASE_NAV_ITEMS;

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      {/* Class Wordmark */}
      <div className="flex items-start justify-between px-5 py-5 border-b border-slate-200">
        <div>
          <div className="text-lg font-bold tracking-tight text-slate-900">
            Lớp {classNameLabel}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
            <span>{studentCount} học sinh</span>
            <span aria-hidden="true">·</span>
            <span>{subjects.length} môn</span>
            <span aria-hidden="true">·</span>
            <span>{academicYear}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Đóng menu"
          className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Navigation */}
      <nav
        className="px-3 py-4 space-y-1 border-b border-slate-200"
        aria-label="Điều hướng chính"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-blue-600' : 'text-slate-400'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Quick Subject Selector */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="px-3 pb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            Môn học ({subjects.length})
          </span>
          <span className="font-mono tabular-nums text-slate-400">
            {sessions.length} tiết
          </span>
        </div>
        <ul className="space-y-0.5">
          {subjects.map((subj) => {
            const count = sessionCounts.get(subj.id) ?? 0;
            const isSelected =
              (activeTab === 'attendance' || activeTab === 'matrix') &&
              selectedSubjectId === subj.id;
            return (
              <li key={subj.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectSubject(subj.id);
                    if (activeTab !== 'attendance' && activeTab !== 'matrix') {
                      onSelectTab('matrix');
                    }
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                    isSelected
                      ? 'bg-slate-900 text-white font-medium'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="min-w-0 text-left">
                    <div className="truncate">{subj.name}</div>
                    {subj.teacher && (
                      <div
                        className={`text-[11px] font-mono truncate ${
                          isSelected ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {subj.code} · {subj.teacher}
                      </div>
                    )}
                  </div>
                  <span
                    className={`font-mono text-xs tabular-nums shrink-0 ${
                      isSelected ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {count > 0 ? `${count}t` : '—'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Signed-in Lecturer Footer */}
      <div className="px-4 py-3.5 border-t border-slate-200 bg-slate-50/70">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-900 truncate">
              {currentUser.displayName}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {currentUser.role === 'admin' ? 'Quản trị viên' : 'Giảng viên'}
              {currentUser.teacherCode ? ` · ${currentUser.teacherCode}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void onSignOut()}
            title="Đăng xuất"
            aria-label="Đăng xuất"
            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0 no-print">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
