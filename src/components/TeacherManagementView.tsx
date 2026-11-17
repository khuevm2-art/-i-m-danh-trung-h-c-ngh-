import { useState } from 'react';
import {
  Check,
  Copy,
  MailPlus,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import type {
  Subject,
  TeacherInvite,
  UserApprovalStatus,
  UserProfile,
  UserRole,
} from '../types/attendance.ts';

interface TeacherManagementViewProps {
  currentUser: UserProfile;
  users: UserProfile[];
  invites: TeacherInvite[];
  subjects: Subject[];
  onCreateInvite: (invite: {
    email: string;
    displayName: string;
    teacherCode?: string;
    assignedSubjectIds: string[];
  }) => Promise<void>;
  onDeleteInvite: (inviteId: string) => Promise<void>;
  onUpdateUserAccess: (
    uid: string,
    updates: {
      role: UserRole;
      status: UserApprovalStatus;
      teacherCode?: string;
      assignedSubjectIds: string[];
    }
  ) => Promise<void>;
}

export function TeacherManagementView({
  currentUser,
  users,
  invites,
  subjects,
  onCreateInvite,
  onDeleteInvite,
  onUpdateUserAccess,
}: TeacherManagementViewProps) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteSubjectIds, setInviteSubjectIds] = useState<string[]>([]);
  const [inviteError, setInviteError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const shareUrl = typeof window !== 'undefined' ? window.location.origin : '';

  function toggleInviteSubject(subjectId: string) {
    setInviteSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  }

  async function handleCopyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  }

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInviteError('');
    if (!inviteEmail.trim() || !inviteName.trim()) {
      setInviteError('Vui lòng nhập Email Google và Tên giảng viên.');
      return;
    }
    setSubmitting(true);
    try {
      await onCreateInvite({
        email: inviteEmail.trim().toLowerCase(),
        displayName: inviteName.trim(),
        teacherCode: inviteCode.trim() || undefined,
        assignedSubjectIds: inviteSubjectIds,
      });
      setInviteEmail('');
      setInviteName('');
      setInviteCode('');
      setInviteSubjectIds([]);
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : 'Không thể tạo lời mời giảng viên.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      {/* Header & Share Link */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Quản lý Giảng viên &amp; Phân quyền Online
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Cấp quyền truy cập cho giảng viên bộ môn đăng nhập bằng Google để điểm danh trực tuyến lớp 10EC01.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-700 max-w-[260px] truncate">
            {shareUrl}
          </div>
          <button
            type="button"
            onClick={() => void handleCopyLink()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            {copiedUrl ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Đã sao chép</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Sao chép link</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Invite Form */}
        <form
          onSubmit={(e) => void handleInviteSubmit(e)}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <MailPlus className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Cấp quyền trước theo Email
            </h2>
          </div>

          <p className="text-xs text-slate-500">
            Khi giảng viên đăng nhập Google bằng email đã thêm tại đây, hệ thống tự động kích hoạt quyền điểm danh ngay lập tức.
          </p>

          <div>
            <label
              htmlFor="invite-email"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Email Google của giảng viên
            </label>
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="giangvien@gmail.com"
              className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="invite-name"
                className="block text-xs font-semibold text-slate-600 mb-1"
              >
                Họ tên giảng viên
              </label>
              <input
                id="invite-name"
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Cô Thoa / Thầy Đạt"
                className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label
                htmlFor="invite-code"
                className="block text-xs font-semibold text-slate-600 mb-1"
              >
                Mã GV (tùy chọn)
              </label>
              <input
                id="invite-code"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Thoantk29"
                className="w-full h-9 px-3 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1.5">
              Môn phụ trách (để trống nếu dạy nhiều môn)
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
              {subjects.map((subj) => {
                const checked = inviteSubjectIds.includes(subj.id);
                return (
                  <label
                    key={subj.id}
                    className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer py-1 px-1.5 rounded hover:bg-white"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleInviteSubject(subj.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <span className="truncate">{subj.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {inviteError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {inviteError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {submitting ? 'Đang lưu...' : 'Thêm giảng viên được mời'}
          </button>
        </form>

        {/* Registered Users & Pending Approvals */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-700" />
                <h2 className="text-base font-semibold text-slate-900">
                  Tài khoản giảng viên đã đăng nhập ({users.length})
                </h2>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {users.map((u) => {
                const isSelf = u.uid === currentUser.uid;
                return (
                  <div
                    key={u.uid}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900">
                          {u.displayName}
                        </span>
                        {u.teacherCode && (
                          <span className="font-mono text-xs text-slate-500">
                            · {u.teacherCode}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">·</span>
                        <span
                          className={`text-xs font-medium ${
                            u.role === 'admin' ? 'text-blue-700' : 'text-slate-600'
                          }`}
                        >
                          {u.role === 'admin' ? 'Quản trị viên' : 'Giảng viên'}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span
                          className={`text-xs font-semibold ${
                            u.status === 'approved'
                              ? 'text-emerald-700'
                              : u.status === 'pending'
                              ? 'text-amber-700'
                              : 'text-red-700'
                          }`}
                        >
                          {u.status === 'approved'
                            ? 'Đã kích hoạt'
                            : u.status === 'pending'
                            ? 'Chờ duyệt'
                            : 'Đã khóa'}
                        </span>
                      </div>

                      <div className="text-xs font-mono text-slate-500 mt-0.5 truncate">
                        {u.email}
                      </div>

                      {u.assignedSubjectIds.length > 0 && (
                        <div className="text-xs text-slate-500 mt-1">
                          Môn:{' '}
                          {u.assignedSubjectIds
                            .map((id) => subjectMap.get(id)?.name ?? id)
                            .join(', ')}
                        </div>
                      )}
                    </div>

                    {!isSelf && (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {u.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() =>
                              void onUpdateUserAccess(u.uid, {
                                role: u.role,
                                status: 'approved',
                                teacherCode: u.teacherCode,
                                assignedSubjectIds: u.assignedSubjectIds,
                              })
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 whitespace-nowrap"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Phê duyệt</span>
                          </button>
                        )}

                        {u.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() =>
                              void onUpdateUserAccess(u.uid, {
                                role: u.role === 'admin' ? 'teacher' : 'admin',
                                status: u.status,
                                teacherCode: u.teacherCode,
                                assignedSubjectIds: u.assignedSubjectIds,
                              })
                            }
                            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap"
                          >
                            {u.role === 'admin'
                              ? 'Chuyển thành GV'
                              : 'Cấp quyền Admin'}
                          </button>
                        )}

                        {u.status !== 'disabled' && (
                          <button
                            type="button"
                            onClick={() =>
                              void onUpdateUserAccess(u.uid, {
                                role: u.role,
                                status: 'disabled',
                                teacherCode: u.teacherCode,
                                assignedSubjectIds: u.assignedSubjectIds,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 whitespace-nowrap"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Khóa</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending Email Invites */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Email đã cấp quyền trước ({invites.length})
              </h2>
            </div>

            {invites.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                Chưa có email nào trong danh sách mời trước. Sử dụng biểu mẫu bên trái để thêm email giảng viên bộ môn.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900">
                        {inv.displayName}
                        {inv.teacherCode && (
                          <span className="ml-2 font-mono text-xs text-slate-500">
                            ({inv.teacherCode})
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono text-slate-500 truncate">
                        {inv.email}
                      </div>
                      {inv.assignedSubjectIds.length > 0 && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          Môn:{' '}
                          {inv.assignedSubjectIds
                            .map((id) => subjectMap.get(id)?.name ?? id)
                            .join(', ')}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void onDeleteInvite(inv.id)}
                      aria-label={`Xóa lời mời ${inv.email}`}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
