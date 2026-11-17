import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { AnalyticsView } from './components/AnalyticsView.tsx';
import { DailyRollCallView } from './components/DailyRollCallView.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { SessionAttendanceView } from './components/SessionAttendanceView.tsx';
import { Sidebar, type ActiveTab } from './components/Sidebar.tsx';
import { StudentRosterView } from './components/StudentRosterView.tsx';
import { SubjectMatrixView } from './components/SubjectMatrixView.tsx';
import { TeacherManagementView } from './components/TeacherManagementView.tsx';
import { TopBar } from './components/TopBar.tsx';
import { createInitialDatabase } from './data/seed10EC01.ts';
import { auth, googleProvider } from './firebase.ts';
import {
  addSubjectToFirestore,
  createTeacherInvite,
  DEFAULT_CLASS_ID,
  deleteSessionFromFirestore,
  deleteStudentFromFirestore,
  deleteTeacherInvite,
  ensureUserProfile,
  importParsedRollCallToFirestore,
  saveDailyRollCallToFirestore,
  saveSingleSessionToFirestore,
  saveStudentToFirestore,
  seedClassFromLocalRollCall,
  subscribeToClassDatabase,
  subscribeToUsersAndInvites,
  updateUserAccess,
} from './services/firestoreService.ts';
import type {
  AttendanceEntry,
  AttendanceSession,
  ClassDatabase,
  TeacherInvite,
  UserApprovalStatus,
  UserProfile,
  UserRole,
} from './types/attendance.ts';
import { exportRollCallBookCsv, exportSummaryCsv } from './utils/csvExport.ts';
import { parseRollCallBookCsv } from './utils/rollCallCsv.ts';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState('');

  const [db, setDb] = useState<ClassDatabase | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [seedingCloud, setSeedingCloud] = useState(false);

  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [invitesList, setInvitesList] = useState<TeacherInvite[]>([]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('daily');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('toan');
  const [matrixSubjectFilter, setMatrixSubjectFilter] = useState<string>('toan');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [sessionToLoad, setSessionToLoad] =
    useState<AttendanceSession | null>(null);

  const refreshProfile = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setUserProfile(null);
      return;
    }
    try {
      const profile = await ensureUserProfile(firebaseUser);
      setUserProfile(profile);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Không thể xác thực tài khoản.'
      );
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUserProfile(null);
        setDb(null);
        setAuthReady(true);
        return;
      }
      void ensureUserProfile(firebaseUser)
        .then((profile) => {
          setUserProfile(profile);
          setAuthError('');
        })
        .catch((err) => {
          setAuthError(
            err instanceof Error
              ? err.message
              : 'Không thể tải hồ sơ giảng viên.'
          );
        })
        .finally(() => {
          setAuthReady(true);
        });
    });
    return () => unsub();
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Đăng nhập Google thất bại. Vui lòng thử lại.'
      );
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut(auth);
    setUserProfile(null);
    setDb(null);
    setUsersList([]);
    setInvitesList([]);
  }, []);

  // Subscribe to Firestore class data ONLY when user is authenticated & approved
  useEffect(() => {
    if (!userProfile || userProfile.status !== 'approved') {
      return;
    }
    setCloudLoading(true);
    setCloudError('');

    let seededOnce = false;
    const unsub = subscribeToClassDatabase(
      DEFAULT_CLASS_ID,
      (cloudDb, existsInCloud) => {
        setDb(cloudDb);
        setCloudLoading(false);
        if (cloudDb.subjects.length > 0) {
          setSelectedSubjectId((curr) =>
            cloudDb.subjects.some((s) => s.id === curr)
              ? curr
              : cloudDb.subjects[0].id
          );
        }

        // If admin logs in and Firestore has not been seeded yet, migrate the 55-day CSV Roll-Call Book into Firestore
        if (
          !seededOnce &&
          userProfile.role === 'admin' &&
          (!existsInCloud || cloudDb.students.length === 0)
        ) {
          seededOnce = true;
          setSeedingCloud(true);
          fetch('/api/data')
            .then((r) => (r.ok ? r.json() : createInitialDatabase()))
            .then((initialData: ClassDatabase) =>
              seedClassFromLocalRollCall(userProfile, initialData)
            )
            .catch((err) => {
              setCloudError(
                err instanceof Error
                  ? err.message
                  : 'Không thể đồng bộ dữ liệu mẫu lên đám mây.'
              );
            })
            .finally(() => {
              setSeedingCloud(false);
            });
        }
      },
      (err) => {
        setCloudError(err.message);
        setCloudLoading(false);
      }
    );

    return () => unsub();
  }, [userProfile]);

  // Admin-only subscription to users & teacherInvites
  useEffect(() => {
    if (!userProfile || userProfile.role !== 'admin' || userProfile.status !== 'approved') {
      return;
    }
    const unsub = subscribeToUsersAndInvites(
      (users) => setUsersList(users),
      (invites) => setInvitesList(invites),
      (err) => setCloudError(err.message)
    );
    return () => unsub();
  }, [userProfile]);

  const handleSaveDailyRollCall = useCallback(
    async (payload: {
      date: string;
      periodSubjects: Record<string, string>;
      recordsByPeriod: Record<string, Record<string, AttendanceEntry>>;
    }) => {
      if (!userProfile || !db) return;
      await saveDailyRollCallToFirestore(userProfile, {
        ...payload,
        existingSessions: db.sessions,
      });
    },
    [userProfile, db]
  );

  const handleImportCsvText = useCallback(
    async (csvText: string) => {
      if (!userProfile) {
        return { importedSessions: 0, importedDays: 0 };
      }
      const parsed = parseRollCallBookCsv(csvText, db ?? createInitialDatabase());
      await importParsedRollCallToFirestore(userProfile, parsed.db, db?.sessions ?? []);
      return {
        importedSessions: parsed.importedSessions,
        importedDays: parsed.importedDays,
      };
    },
    [userProfile, db]
  );

  const handleSaveSession = useCallback(
    async (session: AttendanceSession) => {
      if (!userProfile || !db) return;
      const existing = db.sessions.find(
        (s) =>
          s.id === session.id ||
          (s.subjectId === session.subjectId &&
            s.date === session.date &&
            s.period === session.period)
      );
      await saveSingleSessionToFirestore(userProfile, session, existing);
    },
    [userProfile, db]
  );

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    await deleteSessionFromFirestore(sessionId);
  }, []);

  const handleSaveStudent = useCallback(
    async (payload: {
      id: string;
      fullName: string;
      note?: string;
      originalId?: string;
    }) => {
      if (!db) return;
      await saveStudentToFirestore(payload, db.students);
    },
    [db]
  );

  const handleDeleteStudent = useCallback(async (studentId: string) => {
    await deleteStudentFromFirestore(studentId);
  }, []);

  const handleAddSubject = useCallback(
    async (payload: { name: string; code: string }) => {
      if (!db) return;
      await addSubjectToFirestore(payload, db.subjects);
    },
    [db]
  );

  const handleCreateInvite = useCallback(
    async (invite: {
      email: string;
      displayName: string;
      teacherCode?: string;
      assignedSubjectIds: string[];
    }) => {
      if (!userProfile) return;
      await createTeacherInvite(userProfile.uid, invite);
    },
    [userProfile]
  );

  const handleDeleteInvite = useCallback(async (inviteId: string) => {
    await deleteTeacherInvite(inviteId);
  }, []);

  const handleUpdateUserAccess = useCallback(
    async (
      uid: string,
      updates: {
        role: UserRole;
        status: UserApprovalStatus;
        teacherCode?: string;
        assignedSubjectIds: string[];
      }
    ) => {
      await updateUserAccess(uid, updates);
    },
    []
  );

  const clearInitialSession = useCallback(() => {
    setSessionToLoad(null);
  }, []);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <LoginScreen
        mode="signed-out"
        authError={authError}
        onGoogleSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
        onRefreshStatus={refreshProfile}
      />
    );
  }

  if (userProfile.status === 'pending') {
    return (
      <LoginScreen
        mode="pending"
        userProfile={userProfile}
        onGoogleSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
        onRefreshStatus={refreshProfile}
      />
    );
  }

  if (userProfile.status === 'disabled') {
    return (
      <LoginScreen
        mode="disabled"
        userProfile={userProfile}
        onGoogleSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
        onRefreshStatus={refreshProfile}
      />
    );
  }

  if ((cloudLoading && !db) || seedingCloud) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div className="text-sm font-semibold text-slate-900">
            {seedingCloud
              ? 'Đang khởi tạo dữ liệu Sổ điểm danh 10EC01 lên đám mây...'
              : 'Đang đồng bộ dữ liệu trực tuyến lớp 10EC01...'}
          </div>
          <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-3 w-2/3 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const database = db ?? createInitialDatabase();
  const isAdmin = userProfile.role === 'admin';
  const activeSubject = database.subjects.find(
    (s) => s.id === selectedSubjectId
  );
  const pendingTeacherCount = usersList.filter(
    (u) => u.status === 'pending'
  ).length;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        classNameLabel={database.className}
        academicYear={database.academicYear}
        studentCount={database.students.length}
        subjects={database.subjects}
        sessions={database.sessions}
        activeTab={activeTab}
        selectedSubjectId={selectedSubjectId}
        currentUser={userProfile}
        pendingTeacherCount={pendingTeacherCount}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'matrix' && matrixSubjectFilter !== 'all') {
            setMatrixSubjectFilter(selectedSubjectId);
          }
        }}
        onSelectSubject={(id) => {
          setSelectedSubjectId(id);
          setMatrixSubjectFilter(id);
        }}
        onSignOut={handleSignOut}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          classNameLabel={database.className}
          activeTab={activeTab}
          activeSubjectName={
            activeTab === 'matrix' && matrixSubjectFilter === 'all'
              ? 'Tất cả môn học'
              : activeSubject?.name
          }
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onExportCsv={() => {
            if (activeTab === 'daily') {
              exportRollCallBookCsv(database);
            } else {
              exportSummaryCsv(
                database.className,
                database.students,
                database.subjects,
                database.sessions,
                activeTab === 'matrix' ? matrixSubjectFilter : 'all'
              );
            }
          }}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          {cloudError && (
            <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4 text-sm text-amber-900">
              <span className="break-words">{cloudError}</span>
              <button
                type="button"
                onClick={() => setCloudError('')}
                className="font-medium underline shrink-0"
              >
                Đóng
              </button>
            </div>
          )}

          {!isAdmin && database.students.length === 0 && (
            <div className="mb-6 px-5 py-6 bg-white border border-slate-200 rounded-xl text-sm text-slate-600">
              Lớp 10EC01 đang chờ Quản trị viên / GVCN đồng bộ dữ liệu ban đầu lên hệ thống trực tuyến.
            </div>
          )}

          {activeTab === 'daily' && (
            <DailyRollCallView
              db={database}
              canImportCsv={isAdmin}
              onSaveDailyRollCall={handleSaveDailyRollCall}
              onImportCsvText={handleImportCsvText}
            />
          )}

          {activeTab === 'attendance' && (
            <SessionAttendanceView
              classNameLabel={database.className}
              students={database.students}
              subjects={database.subjects}
              sessions={database.sessions}
              selectedSubjectId={selectedSubjectId}
              canDeleteSession={isAdmin}
              onSelectSubjectId={(id) => setSelectedSubjectId(id)}
              initialSessionToLoad={sessionToLoad}
              onClearInitialSession={clearInitialSession}
              onSaveSession={handleSaveSession}
              onDeleteSession={handleDeleteSession}
            />
          )}

          {activeTab === 'matrix' && (
            <SubjectMatrixView
              classNameLabel={database.className}
              students={database.students}
              subjects={database.subjects}
              sessions={database.sessions}
              selectedSubjectId={matrixSubjectFilter}
              onSelectSubjectFilter={(id) => {
                setMatrixSubjectFilter(id);
                if (id !== 'all') {
                  setSelectedSubjectId(id);
                }
              }}
              onOpenSession={(session) => {
                setSessionToLoad(session);
                setSelectedSubjectId(session.subjectId);
                setActiveTab('attendance');
              }}
              onStartNewSession={() => {
                if (matrixSubjectFilter !== 'all') {
                  setSelectedSubjectId(matrixSubjectFilter);
                }
                setActiveTab('attendance');
              }}
            />
          )}

          {activeTab === 'students' && (
            <StudentRosterView
              classNameLabel={database.className}
              students={database.students}
              subjects={database.subjects}
              sessions={database.sessions}
              canManageRoster={isAdmin}
              onSaveStudent={handleSaveStudent}
              onDeleteStudent={handleDeleteStudent}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              classNameLabel={database.className}
              students={database.students}
              subjects={database.subjects}
              sessions={database.sessions}
              canManageSubjects={isAdmin}
              onStartAttendanceForSubject={(subjectId) => {
                setSelectedSubjectId(subjectId);
                setActiveTab('attendance');
              }}
              onAddSubject={handleAddSubject}
            />
          )}

          {activeTab === 'teachers' && isAdmin && (
            <TeacherManagementView
              currentUser={userProfile}
              users={usersList}
              invites={invitesList}
              subjects={database.subjects}
              onCreateInvite={handleCreateInvite}
              onDeleteInvite={handleDeleteInvite}
              onUpdateUserAccess={handleUpdateUserAccess}
            />
          )}
        </main>
      </div>
    </div>
  );
}
