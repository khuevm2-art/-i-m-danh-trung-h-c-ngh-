import { Download, Menu } from 'lucide-react';
import type { ActiveTab } from './Sidebar.tsx';

interface TopBarProps {
  classNameLabel: string;
  activeTab: ActiveTab;
  activeSubjectName?: string;
  onOpenMobileMenu: () => void;
  onExportCsv: () => void;
}

const TAB_TITLES: Record<ActiveTab, string> = {
  daily: 'Điểm danh theo Ngày (5 Tiết)',
  attendance: 'Điểm danh theo Môn',
  matrix: 'Tổng hợp theo môn',
  students: 'Danh sách học sinh',
  analytics: 'Thống kê chuyên cần',
  teachers: 'Quản lý Giảng viên',
};

export function TopBar({
  classNameLabel,
  activeTab,
  activeSubjectName,
  onOpenMobileMenu,
  onExportCsv,
}: TopBarProps) {
  const showSubjectCrumb =
    (activeTab === 'attendance' || activeTab === 'matrix') && activeSubjectName;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between gap-4 no-print">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Mở menu"
          className="lg:hidden p-2 -ml-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
          <span className="font-semibold text-slate-900 whitespace-nowrap shrink-0">
            Lớp {classNameLabel}
          </span>
          <span className="text-slate-300 shrink-0" aria-hidden="true">
            /
          </span>
          <span className="text-slate-600 truncate">{TAB_TITLES[activeTab]}</span>
          {showSubjectCrumb && (
            <>
              <span className="text-slate-300 shrink-0 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-blue-700 truncate hidden sm:inline">
                {activeSubjectName}
              </span>
            </>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onExportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>Xuất CSV</span>
        </button>
      </div>
    </header>
  );
}
