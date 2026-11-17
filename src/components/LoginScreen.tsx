import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Clock,
  FileCheck2,
  LogOut,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import { INITIAL_SUBJECTS } from '../data/seed10EC01.ts';
import type { UserProfile } from '../types/attendance.ts';

interface LoginScreenProps {
  mode: 'signed-out' | 'pending' | 'disabled';
  userProfile?: UserProfile | null;
  authError?: string;
  onGoogleSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onRefreshStatus: () => Promise<void>;
}

const WEEKLY_TIMETABLE = [
  {
    day: 'Thứ Hai',
    periods: [
      'Kỹ năng mềm',
      'Kỹ năng mềm',
      'Vật lý',
      'Vật lý',
      '—',
    ],
  },
  {
    day: 'Thứ Ba',
    periods: ['Ngữ Văn', 'Ngữ Văn', 'Tin học', 'Tin học', '—'],
  },
  {
    day: 'Thứ Tư',
    periods: [
      'Marketing căn bản',
      'Marketing căn bản',
      'Lịch sử',
      'Tiếng Anh',
      'Tiếng Anh',
    ],
  },
  {
    day: 'Thứ Năm',
    periods: ['GDTC', 'GDTC', 'Toán', 'Toán', 'Marketing căn bản'],
  },
  {
    day: 'Thứ Sáu',
    periods: [
      'Marketing căn bản',
      'Lịch sử',
      'Công nghệ',
      'Công nghệ',
      '—',
    ],
  },
];

export function LoginScreen({
  mode,
  userProfile,
  authError,
  onGoogleSignIn,
  onSignOut,
  onRefreshStatus,
}: LoginScreenProps) {
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setBusy(true);
    try {
      await onGoogleSignIn();
    } finally {
      setBusy(false);
    }
  }

  async function handleRefresh() {
    setBusy(true);
    try {
      await onRefreshStatus();
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'pending' || mode === 'disabled') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-200 pb-5">
            <div className="text-xs font-semibold text-blue-700">
              Sổ Điểm Danh Trực Tuyến · HK I/2026
            </div>
            <h1 className="mt-1.5 text-2xl font-bold text-slate-900">
              Lớp 10EC01
            </h1>
          </div>

          {mode === 'pending' ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900 space-y-1">
                  <div className="font-semibold">Tài khoản đang chờ phê duyệt</div>
                  <p>
                    Email{' '}
                    <span className="font-mono font-medium">
                      {userProfile?.email}
                    </span>{' '}
                    đã đăng ký vào hệ thống. Vui lòng liên hệ Quản trị viên / GVCN lớp 10EC01 để kích hoạt quyền giảng viên.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void handleRefresh()}
                  disabled={busy}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Kiểm tra lại trạng thái</span>
                </button>
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <ShieldAlert className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                <div className="text-sm text-red-900 space-y-1">
                  <div className="font-semibold">Tài khoản đã bị tạm khóa</div>
                  <p>
                    Tài khoản{' '}
                    <span className="font-mono">{userProfile?.email}</span> hiện không có quyền truy cập lớp 10EC01.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void onSignOut()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: [Wordmark] — [4 single-line links] — [1 primary CTA] */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Sổ Điểm Danh 10EC01
          </a>

          <nav
            aria-label="Điều hướng trang chủ"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a
              href="#tieu-chi"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Tiêu chí điểm danh
            </a>
            <a
              href="#mon-hoc"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              10 Môn học
            </a>
            <a
              href="#thoi-khoa-bieu"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Thời khóa biểu
            </a>
            <a
              href="#huong-dan"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Hướng dẫn giảng viên
            </a>
          </nav>

          <button
            type="button"
            onClick={() => void handleSignIn()}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            {busy ? 'Đang kết nối...' : 'Đăng nhập Giảng viên'}
          </button>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
              <div className="text-sm font-medium text-slate-500 flex flex-wrap items-center gap-2 tabular-nums">
                <span>Lớp 10EC01</span>
                <span aria-hidden="true">·</span>
                <span>Học kỳ I / 2026</span>
                <span aria-hidden="true">·</span>
                <span>15 học sinh</span>
                <span aria-hidden="true">·</span>
                <span>10 môn học</span>
              </div>

              <h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-[1.15]"
                style={{ textWrap: 'balance' }}
              >
                Cổng quản lý điểm danh trực tuyến theo tiết học và 10 bộ môn
              </h1>

              <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
                Hệ thống điểm danh thời gian thực cho phép giáo viên chủ nhiệm và 10 giảng viên bộ môn ghi nhận chuyên cần từng tiết (Tiết 1–5), theo dõi tỷ lệ vắng học từng môn và xuất báo cáo chuẩn Excel chỉ trong một thao tác.
              </p>

              {authError && (
                <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg max-w-xl">
                  {authError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={() => void handleSignIn()}
                  disabled={busy}
                  className="inline-flex items-center gap-2.5 px-6 py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  <svg
                    className="w-4 h-4 shrink-0"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fill="currentColor"
                      d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81"
                    />
                  </svg>
                  <span>
                    {busy ? 'Đang đăng nhập...' : 'Đăng nhập bằng Google để điểm danh'}
                  </span>
                </button>

                <a
                  href="#tieu-chi"
                  className="inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors whitespace-nowrap"
                >
                  <span>Xem tiêu chí điểm danh</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Right Panel: Quick Criteria Card */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="pb-3 border-b border-slate-200">
                  <h2 className="text-base font-bold text-slate-900">
                    Quy chuẩn ghi nhận chuyên cần
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Áp dụng thống nhất trên 5 tiết/ngày của lớp 10EC01
                  </p>
                </div>

                <div className="divide-y divide-slate-200 text-sm">
                  <div className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900">
                          P — Có mặt
                        </div>
                        <div className="text-xs text-slate-500">
                          Tham gia đầy đủ tiết học đúng giờ
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-semibold text-emerald-700">
                      100%
                    </span>
                  </div>

                  <div className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900">
                          M — Đi muộn
                        </div>
                        <div className="text-xs text-slate-500">
                          Có mặt sau giờ vào tiết, tính vào chuyên cần
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-semibold text-amber-700">
                      Lưu ý
                    </span>
                  </div>

                  <div className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <FileCheck2 className="w-4 h-4 text-sky-700 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900">
                          CP — Vắng có phép
                        </div>
                        <div className="text-xs text-slate-500">
                          Có đơn/xác nhận phụ huynh hoặc GVCN
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-semibold text-sky-700">
                      Tính vắng
                    </span>
                  </div>

                  <div className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <X className="w-4 h-4 text-red-700 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900">
                          A — Vắng không phép
                        </div>
                        <div className="text-xs text-slate-500">
                          Tăng tỷ lệ vắng môn &amp; kích hoạt cảnh báo sớm
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-semibold text-red-700">
                      Cảnh báo
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500">
                Hỗ trợ ghi chú cộng điểm trực tiếp trên từng tiết (ví dụ: <span className="font-mono text-slate-700 font-medium">1 đ +</span>).
              </div>
            </div>
          </div>
        </section>

        {/* Section 01: Tiêu chí điểm danh & Ngưỡng cảnh báo */}
        <section
          id="tieu-chi"
          className="border-t border-slate-200 bg-white py-12 lg:py-16"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="max-w-2xl">
              <div className="text-xs font-semibold text-blue-700 mb-1.5">
                01. Tiêu chí theo dõi chuyên cần
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                Ba ngưỡng đánh giá tỷ lệ vắng học theo từng môn
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Mỗi môn học tính riêng tổng số tiết đã dạy và số tiết vắng (A, CP) của từng học sinh, đồng bộ trực tiếp với bảng theo dõi 10 môn.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
                <div className="text-xs font-mono font-semibold text-emerald-700">
                  Mức Đạt · Vắng &lt; 10%
                </div>
                <h3 className="mt-2 text-base font-bold text-slate-900">
                  Chuyên cần ổn định
                </h3>
                <p className="mt-1.5 text-sm text-slate-600">
                  Học sinh tham gia đầy đủ ≥ 90% số tiết đã tổ chức của môn học, đủ điều kiện dự thi kết thúc môn.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
                <div className="text-xs font-mono font-semibold text-amber-700">
                  Mức Lưu ý · Vắng 10% – 19.9%
                </div>
                <h3 className="mt-2 text-base font-bold text-slate-900">
                  Nhắc nhở phụ huynh &amp; học sinh
                </h3>
                <p className="mt-1.5 text-sm text-slate-600">
                  Hệ thống đánh dấu màu vàng trong Bảng theo dõi 10 môn để giáo viên bộ môn và GVCN nhắc nhở kịp thời.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
                <div className="text-xs font-mono font-semibold text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Cảnh báo học vụ · Vắng ≥ 20%</span>
                </div>
                <h3 className="mt-2 text-base font-bold text-slate-900">
                  Nguy cơ vượt ngưỡng nghỉ học
                </h3>
                <p className="mt-1.5 text-sm text-slate-600">
                  Hiển thị trong danh sách Học sinh cần lưu ý và tô cảnh báo đỏ theo từng môn học để xử lý học vụ ngay.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 02: 10 Môn học & Giảng viên phụ trách */}
        <section id="mon-hoc" className="border-t border-slate-200 py-12 lg:py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-blue-700 mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>02. Danh mục bộ môn lớp 10EC01</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  10 môn học &amp; giảng viên phụ trách (HK I/2026)
                </h2>
              </div>
              <span className="text-sm text-slate-500 tabular-nums">
                10 mã môn học chính khóa
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4 w-16 text-right">STT</th>
                      <th className="py-3 px-4 w-32">Mã môn</th>
                      <th className="py-3 px-4">Tên môn học</th>
                      <th className="py-3 px-4">Tên học phần</th>
                      <th className="py-3 px-4">Giảng viên</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {INITIAL_SUBJECTS.map((subj, idx) => (
                      <tr key={subj.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-blue-700">
                          {subj.code}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {subj.name}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {subj.officialName ?? subj.name}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {subj.teacher ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Section 03: Thời khóa biểu 5 tiết/ngày */}
        <section
          id="thoi-khoa-bieu"
          className="border-t border-slate-200 bg-white py-12 lg:py-16"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
            <div>
              <div className="text-xs font-semibold text-blue-700 mb-1.5 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                <span>03. Cấu trúc điểm danh 5 tiết / ngày</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                Thời khóa biểu tuần chuẩn lớp 10EC01
              </h2>
              <p className="mt-1.5 text-sm text-slate-600">
                Cửa sổ điểm danh tự động nạp sẵn môn học theo từng ngày từ Thứ Hai đến Thứ Sáu; giảng viên có thể điều chỉnh linh hoạt khi có dạy bù hoặc đổi tiết.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4 w-32">Thứ</th>
                      <th className="py-3 px-4">Tiết 1</th>
                      <th className="py-3 px-4">Tiết 2</th>
                      <th className="py-3 px-4">Tiết 3</th>
                      <th className="py-3 px-4">Tiết 4</th>
                      <th className="py-3 px-4">Tiết 5</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {WEEKLY_TIMETABLE.map((row) => (
                      <tr key={row.day} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          {row.day}
                        </td>
                        {row.periods.map((subj, idx) => (
                          <td
                            key={idx}
                            className={`py-3 px-4 whitespace-nowrap ${
                              subj === '—' ? 'text-slate-300' : 'text-slate-700'
                            }`}
                          >
                            {subj}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Section 04: Hướng dẫn giảng viên sử dụng */}
        <section id="huong-dan" className="border-t border-slate-200 py-12 lg:py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="text-xs font-semibold text-blue-700">
                  04. Dành cho giảng viên bộ môn &amp; GVCN
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Bắt đầu phiên điểm danh trực tuyến
                </h2>
                <div className="text-sm text-slate-600 space-y-1.5">
                  <div>
                    1. Bấm <strong>Đăng nhập Giảng viên</strong> bằng tài khoản Google đã được GVCN cấp quyền hoặc phê duyệt.
                  </div>
                  <div>
                    2. Chọn ngày học tại cửa sổ <strong>Điểm danh theo Ngày (5 Tiết)</strong> và bấm chọn nhanh trạng thái <span className="font-mono font-medium text-slate-800">P / A / M / CP</span>.
                  </div>
                  <div>
                    3. Bấm <strong>Lưu điểm danh ngày</strong> — dữ liệu được đồng bộ ngay lập tức cho toàn bộ giảng viên và cập nhật vào bảng theo dõi vắng 10 môn.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleSignIn()}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                <span>{busy ? 'Đang đăng nhập...' : 'Đăng nhập bằng Google'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div>Sổ Điểm Danh Trực Tuyến · Lớp 10EC01 · HK I/2026</div>
          <div>Dữ liệu học sinh được bảo vệ và chỉ hiển thị sau khi giảng viên đăng nhập.</div>
        </div>
      </footer>
    </div>
  );
}
