import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FileCheck2, PieChart, XCircle } from 'lucide-react';
import type {
  AttendanceSession,
  Student,
  Subject,
} from '../types/attendance.ts';
import { formatDateVi } from '../utils/csvExport.ts';

type WindowFilter = '10_sessions' | '25_sessions' | '5_days' | 'all';
type ChartMode = 'binary' | 'detailed';

interface RecentAttendanceChartProps {
  sessions: AttendanceSession[];
  students: Student[];
  subjects: Subject[];
}

interface SliceItem {
  key: string;
  label: string;
  sublabel: string;
  count: number;
  pct: number;
  color: string;
  textColorClass: string;
  dotColorClass: string;
  icon: typeof CheckCircle2;
}

function getPeriodOrder(period: string): number {
  const match = period.match(/\d+/);
  return match ? Number(match[0]) : 99;
}

export function RecentAttendanceChart({
  sessions,
  students,
  subjects,
}: RecentAttendanceChartProps) {
  const [windowFilter, setWindowFilter] = useState<WindowFilter>('10_sessions');
  const [chartMode, setChartMode] = useState<ChartMode>('binary');
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects]
  );

  const sortedSessionsDesc = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return getPeriodOrder(b.period) - getPeriodOrder(a.period);
    });
  }, [sessions]);

  const recentSessions = useMemo(() => {
    if (sortedSessionsDesc.length === 0) return [];
    if (windowFilter === '10_sessions') return sortedSessionsDesc.slice(0, 10);
    if (windowFilter === '25_sessions') return sortedSessionsDesc.slice(0, 25);
    if (windowFilter === '5_days') {
      const recentDates = new Set<string>();
      for (const s of sortedSessionsDesc) {
        recentDates.add(s.date);
        if (recentDates.size >= 5) break;
      }
      return sortedSessionsDesc.filter((s) => recentDates.has(s.date));
    }
    return sortedSessionsDesc;
  }, [sortedSessionsDesc, windowFilter]);

  const stats = useMemo(() => {
    let present = 0;
    let late = 0;
    let excused = 0;
    let unexcused = 0;

    for (const s of recentSessions) {
      for (const st of students) {
        const rec = s.records[st.id];
        if (!rec) continue;
        if (rec.status === 'present') present++;
        else if (rec.status === 'late') late++;
        else if (rec.status === 'excused') excused++;
        else if (rec.status === 'unexcused') unexcused++;
      }
    }

    const totalMarks = present + late + excused + unexcused;
    const attendedTotal = present + late;
    const absentTotal = excused + unexcused;

    const pct = (val: number) =>
      totalMarks > 0 ? Math.round((val / totalMarks) * 1000) / 10 : 0;

    const binarySlices: SliceItem[] = [
      {
        key: 'attended',
        label: 'Có mặt (gồm đi muộn)',
        sublabel: `${present} đúng giờ · ${late} đi muộn`,
        count: attendedTotal,
        pct: pct(attendedTotal),
        color: '#16a34a',
        textColorClass: 'text-emerald-700',
        dotColorClass: 'bg-emerald-600',
        icon: CheckCircle2,
      },
      {
        key: 'absent',
        label: 'Vắng mặt (có phép & không phép)',
        sublabel: `${excused} có phép · ${unexcused} không phép`,
        count: absentTotal,
        pct: pct(absentTotal),
        color: '#dc2626',
        textColorClass: 'text-red-700',
        dotColorClass: 'bg-red-600',
        icon: XCircle,
      },
    ];

    const detailedSlices: SliceItem[] = [
      {
        key: 'present',
        label: 'Có mặt đúng giờ (P)',
        sublabel: 'Tham gia đầy đủ tiết học',
        count: present,
        pct: pct(present),
        color: '#16a34a',
        textColorClass: 'text-emerald-700',
        dotColorClass: 'bg-emerald-600',
        icon: CheckCircle2,
      },
      {
        key: 'late',
        label: 'Đi muộn (M)',
        sublabel: 'Tính chuyên cần có nhắc nhở',
        count: late,
        pct: pct(late),
        color: '#d97706',
        textColorClass: 'text-amber-700',
        dotColorClass: 'bg-amber-600',
        icon: Clock3,
      },
      {
        key: 'excused',
        label: 'Vắng có phép (CP)',
        sublabel: 'Có đơn/xác nhận nghỉ học',
        count: excused,
        pct: pct(excused),
        color: '#475569',
        textColorClass: 'text-slate-700',
        dotColorClass: 'bg-slate-600',
        icon: FileCheck2,
      },
      {
        key: 'unexcused',
        label: 'Vắng không phép (A)',
        sublabel: 'Vắng mặt không lý do',
        count: unexcused,
        pct: pct(unexcused),
        color: '#dc2626',
        textColorClass: 'text-red-700',
        dotColorClass: 'bg-red-600',
        icon: XCircle,
      },
    ];

    const newestDate = recentSessions[0]?.date ?? '';
    const oldestDate = recentSessions[recentSessions.length - 1]?.date ?? '';

    return {
      totalMarks,
      attendedPct: pct(attendedTotal),
      absentPct: pct(absentTotal),
      binarySlices,
      detailedSlices,
      newestDate,
      oldestDate,
    };
  }, [recentSessions, students]);

  const activeSlices =
    chartMode === 'binary' ? stats.binarySlices : stats.detailedSlices;

  const highlightedSlice = useMemo(() => {
    if (!activeKey) return null;
    return activeSlices.find((s) => s.key === activeKey) ?? null;
  }, [activeKey, activeSlices]);

  const ringGeometry = useMemo(() => {
    const radius = 64;
    const circumference = 2 * Math.PI * radius;
    const nonZeroCount = activeSlices.filter((s) => s.count > 0).length;
    const gap = nonZeroCount > 1 ? 3 : 0;

    let accumulatedOffset = 0;
    return activeSlices.map((slice) => {
      if (stats.totalMarks === 0 || slice.count === 0) {
        return {
          ...slice,
          dashLength: 0,
          dashOffset: 0,
          radius,
          circumference,
        };
      }
      const rawLength = (slice.count / stats.totalMarks) * circumference;
      const dashLength = Math.max(0, rawLength - gap);
      const dashOffset = -accumulatedOffset;
      accumulatedOffset += rawLength;
      return {
        ...slice,
        dashLength,
        dashOffset,
        radius,
        circumference,
      };
    });
  }, [activeSlices, stats.totalMarks]);

  const recentSessionSnapshots = useMemo(() => {
    return recentSessions.slice(0, 5).map((s) => {
      let present = 0;
      let absent = 0;
      let total = 0;
      for (const st of students) {
        const rec = s.records[st.id];
        if (!rec) continue;
        total++;
        if (rec.status === 'present' || rec.status === 'late') present++;
        else absent++;
      }
      const presentPct = total > 0 ? Math.round((present / total) * 100) : 0;
      return {
        id: s.id,
        dateLabel: formatDateVi(s.date),
        period: s.period,
        subjectName: subjectMap.get(s.subjectId)?.name ?? s.subjectId,
        present,
        absent,
        total,
        presentPct,
      };
    });
  }, [recentSessions, students, subjectMap]);

  const dateRangeText =
    stats.oldestDate && stats.newestDate
      ? stats.oldestDate === stats.newestDate
        ? formatDateVi(stats.newestDate)
        : `${formatDateVi(stats.oldestDate)} – ${formatDateVi(stats.newestDate)}`
      : 'Chưa có dữ liệu';

  return (
    <section
      aria-label="Biểu đồ tỷ lệ có mặt và vắng mặt gần đây"
      className="bg-white border border-slate-200 rounded-xl p-5"
    >
      {/* Header + Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-blue-700 shrink-0" />
            <h2 className="text-base font-semibold text-slate-900">
              Tỷ lệ có mặt / vắng mặt các buổi học gần đây
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {recentSessions.length} tiết học gần nhất · {dateRangeText} · {stats.totalMarks} lượt điểm danh
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Phạm vi buổi học gần đây"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {(
              [
                { id: '10_sessions', label: '10 tiết gần nhất' },
                { id: '25_sessions', label: '25 tiết gần nhất' },
                { id: '5_days', label: '5 ngày gần nhất' },
                { id: 'all', label: 'Toàn bộ' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setWindowFilter(opt.id);
                  setActiveKey(null);
                }}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  windowFilter === opt.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="Chế độ hiển thị biểu đồ"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              onClick={() => {
                setChartMode('binary');
                setActiveKey(null);
              }}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                chartMode === 'binary'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Có mặt / Vắng
            </button>
            <button
              type="button"
              onClick={() => {
                setChartMode('detailed');
                setActiveKey(null);
              }}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                chartMode === 'detailed'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chi tiết 4 mã
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {stats.totalMarks === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">
          Chưa có dữ liệu điểm danh trong khoảng thời gian đã chọn. Khi giảng viên lưu các buổi học gần đây, biểu đồ tỷ lệ sẽ hiển thị tại đây.
        </div>
      ) : (
        <div className="pt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Pie / Donut SVG */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center">
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg
                viewBox="0 0 180 180"
                className="w-48 h-48 -rotate-90"
                role="img"
                aria-label={`Biểu đồ hình tròn tỷ lệ có mặt ${stats.attendedPct}% và vắng mặt ${stats.absentPct}%`}
              >
                <circle
                  cx="90"
                  cy="90"
                  r="64"
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="28"
                />
                {ringGeometry.map((seg) => {
                  if (seg.dashLength <= 0) return null;
                  const isDimmed =
                    activeKey !== null && activeKey !== seg.key;
                  const isActive = activeKey === seg.key;
                  return (
                    <circle
                      key={seg.key}
                      cx="90"
                      cy="90"
                      r={seg.radius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={isActive ? 32 : 28}
                      strokeDasharray={`${seg.dashLength} ${seg.circumference}`}
                      strokeDashoffset={seg.dashOffset}
                      className="cursor-pointer transition-opacity duration-150"
                      style={{
                        opacity: isDimmed ? 0.3 : 1,
                      }}
                      onMouseEnter={() => setActiveKey(seg.key)}
                      onMouseLeave={() => setActiveKey(null)}
                      onClick={() =>
                        setActiveKey((prev) =>
                          prev === seg.key ? null : seg.key
                        )
                      }
                    />
                  );
                })}
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-6">
                {highlightedSlice ? (
                  <>
                    <span
                      className={`text-2xl font-bold font-mono tabular-nums ${highlightedSlice.textColorClass}`}
                    >
                      {highlightedSlice.pct}%
                    </span>
                    <span className="mt-0.5 text-[11px] font-medium text-slate-700 leading-tight line-clamp-2">
                      {highlightedSlice.label}
                    </span>
                    <span className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-500">
                      {highlightedSlice.count}/{stats.totalMarks} lượt
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
                      {stats.attendedPct}%
                    </span>
                    <span className="mt-0.5 text-xs font-medium text-slate-600">
                      Có mặt
                    </span>
                    <span className="mt-0.5 text-[11px] font-mono tabular-nums text-red-700">
                      Vắng {stats.absentPct}%
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Legend Breakdown */}
          <div className="lg:col-span-4 divide-y divide-slate-200">
            {activeSlices.map((slice) => {
              const Icon = slice.icon;
              const isSelected = activeKey === slice.key;
              return (
                <button
                  key={slice.key}
                  type="button"
                  onMouseEnter={() => setActiveKey(slice.key)}
                  onMouseLeave={() => setActiveKey(null)}
                  onFocus={() => setActiveKey(slice.key)}
                  onBlur={() => setActiveKey(null)}
                  onClick={() =>
                    setActiveKey((prev) =>
                      prev === slice.key ? null : slice.key
                    )
                  }
                  className={`w-full py-3 px-2.5 flex items-center justify-between gap-3 text-left rounded-lg transition-colors ${
                    isSelected ? 'bg-slate-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 mt-0.5 shrink-0 ${slice.textColorClass}`}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {slice.label}
                      </div>
                      <div className="text-xs text-slate-500 font-mono tabular-nums">
                        {slice.sublabel}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm font-bold font-mono tabular-nums ${slice.textColorClass}`}
                    >
                      {slice.pct}%
                    </div>
                    <div className="text-xs text-slate-500 font-mono tabular-nums">
                      {slice.count} lượt
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Recent 5 Sessions Snapshot */}
          <div className="lg:col-span-4 lg:border-l lg:border-slate-200 lg:pl-6">
            <div className="text-xs font-semibold text-slate-700 pb-2 border-b border-slate-200">
              5 tiết điểm danh gần nhất
            </div>
            <div className="divide-y divide-slate-100">
              {recentSessionSnapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-900 truncate">
                      {snap.subjectName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                      {snap.dateLabel} · {snap.period}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs font-semibold font-mono tabular-nums ${
                        snap.presentPct >= 90
                          ? 'text-emerald-700'
                          : snap.presentPct >= 80
                          ? 'text-amber-700'
                          : 'text-red-700'
                      }`}
                    >
                      {snap.presentPct}% có mặt
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                      {snap.present}/{snap.total} HS · {snap.absent} vắng
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
