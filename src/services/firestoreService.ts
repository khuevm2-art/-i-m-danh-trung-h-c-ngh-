import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { CLASS_NAME } from '../data/seed10EC01.ts';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import type {
  AttendanceEntry,
  AttendanceSession,
  ClassDatabase,
  DailyScheduleMap,
  Student,
  Subject,
  TeacherInvite,
  UserApprovalStatus,
  UserProfile,
  UserRole,
} from '../types/attendance.ts';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'lithua7@gmail.com';
export const DEFAULT_CLASS_ID = CLASS_NAME;

export function safeEmailKey(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');
}

export function toSafeSessionId(
  subjectId: string,
  date: string,
  period: string
): string {
  const slugPeriod = period
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '');

  const slugSubj = subjectId
    .trim()
    .replace(/[^a-zA-Z0-9_\-]+/g, '_');

  const safeDate = date.trim().replace(/[^0-9\-]/g, '');
  return `${slugSubj}__${safeDate}__${slugPeriod}`.slice(0, 120);
}

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const userPath = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      return {
        uid: data.uid as string,
        email: data.email as string,
        displayName: data.displayName as string,
        teacherCode: (data.teacherCode as string) || undefined,
        role: data.role as UserRole,
        status: data.status as UserApprovalStatus,
        assignedSubjectIds: Array.isArray(data.assignedSubjectIds)
          ? (data.assignedSubjectIds as string[])
          : [],
        createdAt: timestampToIso(data.createdAt),
        updatedAt: timestampToIso(data.updatedAt),
      };
    }

    const email = (user.email ?? '').trim();
    const isAdminEmail =
      email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified;

    let inviteData: {
      teacherCode?: string;
      displayName?: string;
      assignedSubjectIds?: string[];
    } | null = null;

    if (!isAdminEmail && email) {
      const inviteId = safeEmailKey(email);
      try {
        const inviteSnap = await getDoc(doc(db, 'teacherInvites', inviteId));
        if (inviteSnap.exists()) {
          inviteData = inviteSnap.data() as {
            teacherCode?: string;
            displayName?: string;
            assignedSubjectIds?: string[];
          };
        }
      } catch {
        // Ignore if not invited
      }
    }

    const role: UserRole = isAdminEmail ? 'admin' : 'teacher';
    const status: UserApprovalStatus =
      isAdminEmail || inviteData ? 'approved' : 'pending';
    const displayName =
      inviteData?.displayName ||
      user.displayName ||
      email.split('@')[0] ||
      'Giảng viên';

    const payload: Record<string, unknown> = {
      uid: user.uid,
      email,
      displayName: displayName.slice(0, 120),
      role,
      status,
      assignedSubjectIds: inviteData?.assignedSubjectIds ?? [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (inviteData?.teacherCode) {
      payload.teacherCode = inviteData.teacherCode;
    }

    await setDoc(userRef, payload);

    const createdSnap = await getDoc(userRef);
    const d = createdSnap.data()!;
    return {
      uid: d.uid as string,
      email: d.email as string,
      displayName: d.displayName as string,
      teacherCode: (d.teacherCode as string) || undefined,
      role: d.role as UserRole,
      status: d.status as UserApprovalStatus,
      assignedSubjectIds: (d.assignedSubjectIds as string[]) ?? [],
      createdAt: timestampToIso(d.createdAt),
      updatedAt: timestampToIso(d.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function seedClassFromLocalRollCall(
  user: UserProfile,
  initialDb: ClassDatabase
): Promise<void> {
  const classRef = doc(db, 'classes', DEFAULT_CLASS_ID);
  try {
    const classSnap = await getDoc(classRef);
    if (!classSnap.exists()) {
      await setDoc(classRef, {
        className: initialDb.className,
        academicYear: initialDb.academicYear || 'HK I/2026',
        ownerUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Check if students already exist
    const existingStudents = await getDocs(
      collection(db, 'classes', DEFAULT_CLASS_ID, 'students')
    );
    if (existingStudents.size > 0) {
      return;
    }

    // Batch write students, subjects, schedule, and historical sessions (<= 400 ops per batch)
    const ops: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];

    for (const student of initialDb.students) {
      const data: Record<string, unknown> = {
        stt: student.stt,
        id: student.id,
        fullName: student.fullName,
        updatedAt: serverTimestamp(),
      };
      if (student.note) data.note = student.note;
      ops.push({
        ref: doc(db, 'classes', DEFAULT_CLASS_ID, 'students', student.id),
        data,
      });
    }

    for (const subj of initialDb.subjects) {
      const data: Record<string, unknown> = {
        id: subj.id,
        name: subj.name,
        code: subj.code,
        updatedAt: serverTimestamp(),
      };
      if (subj.officialName) data.officialName = subj.officialName;
      if (subj.teacher) data.teacher = subj.teacher;
      ops.push({
        ref: doc(db, 'classes', DEFAULT_CLASS_ID, 'subjects', subj.id),
        data,
      });
    }

    for (const [dateIso, periods] of Object.entries(initialDb.schedule ?? {})) {
      ops.push({
        ref: doc(db, 'classes', DEFAULT_CLASS_ID, 'schedule', dateIso),
        data: {
          date: dateIso,
          periods,
          updatedByUid: user.uid,
          updatedByName: user.displayName,
          updatedAt: serverTimestamp(),
        },
      });
    }

    for (const sess of initialDb.sessions) {
      const safeId = toSafeSessionId(sess.subjectId, sess.date, sess.period);
      ops.push({
        ref: doc(db, 'classes', DEFAULT_CLASS_ID, 'sessions', safeId),
        data: {
          id: safeId,
          className: initialDb.className,
          subjectId: sess.subjectId,
          date: sess.date,
          period: sess.period,
          topic: sess.topic ?? '',
          records: sess.records,
          recordedByUid: user.uid,
          recordedByName: user.displayName,
          recordedByEmail: user.email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    }

    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = ops.slice(i, i + 400);
      for (const item of chunk) {
        batch.set(item.ref, item.data);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `classes/${DEFAULT_CLASS_ID}`);
  }
}

export function subscribeToClassDatabase(
  classId: string,
  onUpdate: (db: ClassDatabase, existsInCloud: boolean) => void,
  onError: (err: Error) => void
): Unsubscribe {
  let classMeta = { className: classId, academicYear: 'HK I/2026' };
  let existsInCloud = false;
  let students: Student[] = [];
  let subjects: Subject[] = [];
  let schedule: DailyScheduleMap = {};
  let sessions: AttendanceSession[] = [];

  let readyClass = false;
  let readyStudents = false;
  let readySubjects = false;
  let readySchedule = false;
  let readySessions = false;

  function emitIfReady() {
    if (
      readyClass &&
      readyStudents &&
      readySubjects &&
      readySchedule &&
      readySessions
    ) {
      onUpdate(
        {
          className: classMeta.className,
          academicYear: classMeta.academicYear,
          students,
          subjects,
          schedule,
          sessions,
        },
        existsInCloud
      );
    }
  }

  const unsubClass = onSnapshot(
    doc(db, 'classes', classId),
    (snap) => {
      readyClass = true;
      if (snap.exists()) {
        existsInCloud = true;
        const d = snap.data();
        classMeta = {
          className: (d.className as string) || classId,
          academicYear: (d.academicYear as string) || 'HK I/2026',
        };
      } else {
        existsInCloud = false;
      }
      emitIfReady();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `classes/${classId}`);
      } catch (e) {
        onError(e as Error);
      }
    }
  );

  const unsubStudents = onSnapshot(
    collection(db, 'classes', classId, 'students'),
    (snap) => {
      readyStudents = true;
      students = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            stt: Number(data.stt),
            id: data.id as string,
            fullName: data.fullName as string,
            note: (data.note as string) || undefined,
          };
        })
        .sort((a, b) => a.stt - b.stt);
      emitIfReady();
    },
    (error) => {
      try {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `classes/${classId}/students`
        );
      } catch (e) {
        onError(e as Error);
      }
    }
  );

  const unsubSubjects = onSnapshot(
    collection(db, 'classes', classId, 'subjects'),
    (snap) => {
      readySubjects = true;
      subjects = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id as string,
          name: data.name as string,
          code: data.code as string,
          officialName: (data.officialName as string) || undefined,
          teacher: (data.teacher as string) || undefined,
        };
      });
      emitIfReady();
    },
    (error) => {
      try {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `classes/${classId}/subjects`
        );
      } catch (e) {
        onError(e as Error);
      }
    }
  );

  const unsubSchedule = onSnapshot(
    collection(db, 'classes', classId, 'schedule'),
    (snap) => {
      readySchedule = true;
      const map: DailyScheduleMap = {};
      for (const d of snap.docs) {
        const data = d.data();
        map[data.date as string] = (data.periods as Record<string, string>) ?? {};
      }
      schedule = map;
      emitIfReady();
    },
    (error) => {
      try {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `classes/${classId}/schedule`
        );
      } catch (e) {
        onError(e as Error);
      }
    }
  );

  const unsubSessions = onSnapshot(
    collection(db, 'classes', classId, 'sessions'),
    (snap) => {
      readySessions = true;
      sessions = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: data.id as string,
            className: data.className as string,
            subjectId: data.subjectId as string,
            date: data.date as string,
            period: data.period as string,
            topic: (data.topic as string) || '',
            records: (data.records as Record<string, AttendanceEntry>) ?? {},
            recordedByUid: data.recordedByUid as string,
            recordedByName: data.recordedByName as string,
            recordedByEmail: data.recordedByEmail as string,
            createdAt: timestampToIso(data.createdAt),
            updatedAt: timestampToIso(data.updatedAt),
          };
        })
        .sort((a, b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          return a.period.localeCompare(b.period);
        });
      emitIfReady();
    },
    (error) => {
      try {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `classes/${classId}/sessions`
        );
      } catch (e) {
        onError(e as Error);
      }
    }
  );

  return () => {
    unsubClass();
    unsubStudents();
    unsubSubjects();
    unsubSchedule();
    unsubSessions();
  };
}

export async function saveDailyRollCallToFirestore(
  user: UserProfile,
  payload: {
    date: string;
    periodSubjects: Record<string, string>;
    recordsByPeriod: Record<string, Record<string, AttendanceEntry>>;
    existingSessions: AttendanceSession[];
  }
): Promise<void> {
  const schedPath = `classes/${DEFAULT_CLASS_ID}/schedule/${payload.date}`;
  try {
    const batch = writeBatch(db);
    const cleanPeriods: Record<string, string> = {};
    for (const [period, subjectId] of Object.entries(payload.periodSubjects)) {
      if (subjectId && subjectId.trim()) {
        cleanPeriods[period] = subjectId.trim();
      }
    }

    batch.set(doc(db, 'classes', DEFAULT_CLASS_ID, 'schedule', payload.date), {
      date: payload.date,
      periods: cleanPeriods,
      updatedByUid: user.uid,
      updatedByName: user.displayName,
      updatedAt: serverTimestamp(),
    });

    for (const [period, subjectId] of Object.entries(cleanPeriods)) {
      const periodRecords = payload.recordsByPeriod[period];
      if (!periodRecords || Object.keys(periodRecords).length === 0) continue;

      const safeId = toSafeSessionId(subjectId, payload.date, period);
      const existing = payload.existingSessions.find(
        (s) =>
          s.id === safeId ||
          (s.date === payload.date &&
            s.period === period &&
            s.subjectId === subjectId)
      );

      const sessionRef = doc(
        db,
        'classes',
        DEFAULT_CLASS_ID,
        'sessions',
        existing?.id ?? safeId
      );

      if (existing) {
        batch.update(sessionRef, {
          subjectId,
          topic: existing.topic ?? '',
          records: periodRecords,
          recordedByUid: user.uid,
          recordedByName: user.displayName,
          recordedByEmail: user.email,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(sessionRef, {
          id: safeId,
          className: DEFAULT_CLASS_ID,
          subjectId,
          date: payload.date,
          period,
          topic: '',
          records: periodRecords,
          recordedByUid: user.uid,
          recordedByName: user.displayName,
          recordedByEmail: user.email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, schedPath);
  }
}

export async function saveSingleSessionToFirestore(
  user: UserProfile,
  session: AttendanceSession,
  existingSession?: AttendanceSession
): Promise<void> {
  const safeId =
    existingSession?.id ??
    toSafeSessionId(session.subjectId, session.date, session.period);
  const path = `classes/${DEFAULT_CLASS_ID}/sessions/${safeId}`;

  try {
    const ref = doc(db, 'classes', DEFAULT_CLASS_ID, 'sessions', safeId);
    if (existingSession) {
      await updateDoc(ref, {
        subjectId: session.subjectId,
        topic: (session.topic ?? '').slice(0, 250),
        records: session.records,
        recordedByUid: user.uid,
        recordedByName: user.displayName,
        recordedByEmail: user.email,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: safeId,
        className: DEFAULT_CLASS_ID,
        subjectId: session.subjectId,
        date: session.date,
        period: session.period,
        topic: (session.topic ?? '').slice(0, 250),
        records: session.records,
        recordedByUid: user.uid,
        recordedByName: user.displayName,
        recordedByEmail: user.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteSessionFromFirestore(
  sessionId: string
): Promise<void> {
  const path = `classes/${DEFAULT_CLASS_ID}/sessions/${sessionId}`;
  try {
    await deleteDoc(doc(db, 'classes', DEFAULT_CLASS_ID, 'sessions', sessionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveStudentToFirestore(
  student: { id: string; fullName: string; note?: string; originalId?: string },
  currentStudents: Student[]
): Promise<void> {
  const cleanId = student.id.trim().toUpperCase();
  const path = `classes/${DEFAULT_CLASS_ID}/students/${cleanId}`;
  try {
    const existing = currentStudents.find(
      (s) => s.id === (student.originalId ?? cleanId)
    );
    const nextStt =
      existing?.stt ??
      (currentStudents.length > 0
        ? Math.max(...currentStudents.map((s) => s.stt)) + 1
        : 1);

    const payload: Record<string, unknown> = {
      stt: nextStt,
      id: cleanId,
      fullName: student.fullName.trim().slice(0, 120),
      updatedAt: serverTimestamp(),
    };
    if (student.note && student.note.trim()) {
      payload.note = student.note.trim().slice(0, 300);
    }

    if (student.originalId && student.originalId !== cleanId) {
      await deleteDoc(
        doc(db, 'classes', DEFAULT_CLASS_ID, 'students', student.originalId)
      );
    }
    await setDoc(
      doc(db, 'classes', DEFAULT_CLASS_ID, 'students', cleanId),
      payload
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteStudentFromFirestore(
  studentId: string
): Promise<void> {
  const path = `classes/${DEFAULT_CLASS_ID}/students/${studentId}`;
  try {
    await deleteDoc(doc(db, 'classes', DEFAULT_CLASS_ID, 'students', studentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addSubjectToFirestore(
  payload: { name: string; code: string; teacher?: string },
  existingSubjects: Subject[]
): Promise<void> {
  const cleanName = payload.name.trim();
  const slug =
    cleanName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `mon-${Date.now()}`;

  if (
    existingSubjects.some(
      (s) => s.id === slug || s.name.toLowerCase() === cleanName.toLowerCase()
    )
  ) {
    throw new Error(`Môn học "${cleanName}" đã tồn tại.`);
  }

  const path = `classes/${DEFAULT_CLASS_ID}/subjects/${slug}`;
  try {
    const docData: Record<string, unknown> = {
      id: slug,
      name: cleanName.slice(0, 120),
      code: (payload.code.trim() || slug.slice(0, 6)).toUpperCase().slice(0, 32),
      updatedAt: serverTimestamp(),
    };
    if (payload.teacher?.trim()) {
      docData.teacher = payload.teacher.trim().slice(0, 80);
    }
    await setDoc(doc(db, 'classes', DEFAULT_CLASS_ID, 'subjects', slug), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function importParsedRollCallToFirestore(
  user: UserProfile,
  parsedDb: ClassDatabase,
  existingSessions: AttendanceSession[] = []
): Promise<void> {
  try {
    const existingSessionMap = new Map(existingSessions.map((s) => [s.id, s]));
    const ops: Array<{
      kind: 'set' | 'update';
      ref: ReturnType<typeof doc>;
      data: Record<string, unknown>;
    }> = [];

    for (const [dateIso, periods] of Object.entries(parsedDb.schedule ?? {})) {
      ops.push({
        kind: 'set',
        ref: doc(db, 'classes', DEFAULT_CLASS_ID, 'schedule', dateIso),
        data: {
          date: dateIso,
          periods,
          updatedByUid: user.uid,
          updatedByName: user.displayName,
          updatedAt: serverTimestamp(),
        },
      });
    }

    for (const sess of parsedDb.sessions) {
      const safeId = toSafeSessionId(sess.subjectId, sess.date, sess.period);
      const ref = doc(db, 'classes', DEFAULT_CLASS_ID, 'sessions', safeId);
      if (existingSessionMap.has(safeId)) {
        ops.push({
          kind: 'update',
          ref,
          data: {
            subjectId: sess.subjectId,
            topic: sess.topic ?? '',
            records: sess.records,
            recordedByUid: user.uid,
            recordedByName: user.displayName,
            recordedByEmail: user.email,
            updatedAt: serverTimestamp(),
          },
        });
      } else {
        ops.push({
          kind: 'set',
          ref,
          data: {
            id: safeId,
            className: DEFAULT_CLASS_ID,
            subjectId: sess.subjectId,
            date: sess.date,
            period: sess.period,
            topic: sess.topic ?? '',
            records: sess.records,
            recordedByUid: user.uid,
            recordedByName: user.displayName,
            recordedByEmail: user.email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
      }
    }

    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db);
      for (const item of ops.slice(i, i + 400)) {
        if (item.kind === 'update') {
          batch.update(item.ref, item.data);
        } else {
          batch.set(item.ref, item.data);
        }
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `classes/${DEFAULT_CLASS_ID}/sessions`
    );
  }
}

// --- Admin Teacher Management ---

export function subscribeToUsersAndInvites(
  onUsers: (users: UserProfile[]) => void,
  onInvites: (invites: TeacherInvite[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const unsubUsers = onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const list: UserProfile[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: data.uid as string,
          email: data.email as string,
          displayName: data.displayName as string,
          teacherCode: (data.teacherCode as string) || undefined,
          role: data.role as UserRole,
          status: data.status as UserApprovalStatus,
          assignedSubjectIds: (data.assignedSubjectIds as string[]) ?? [],
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };
      });
      onUsers(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'users');
      } catch (e) {
        onError(e as Error);
      }
    }
  );

  const unsubInvites = onSnapshot(
    collection(db, 'teacherInvites'),
    (snap) => {
      const list: TeacherInvite[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          email: data.email as string,
          displayName: data.displayName as string,
          teacherCode: (data.teacherCode as string) || undefined,
          assignedSubjectIds: (data.assignedSubjectIds as string[]) ?? [],
          createdByUid: data.createdByUid as string,
          createdAt: timestampToIso(data.createdAt),
        };
      });
      onInvites(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'teacherInvites');
      } catch (e) {
        onError(e as Error);
      }
    }
  );

  return () => {
    unsubUsers();
    unsubInvites();
  };
}

export async function updateUserAccess(
  uid: string,
  updates: {
    role: UserRole;
    status: UserApprovalStatus;
    teacherCode?: string;
    assignedSubjectIds: string[];
  }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      role: updates.role,
      status: updates.status,
      teacherCode: (updates.teacherCode ?? '').trim().slice(0, 64),
      assignedSubjectIds: updates.assignedSubjectIds.slice(0, 20),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createTeacherInvite(
  adminUid: string,
  invite: {
    email: string;
    displayName: string;
    teacherCode?: string;
    assignedSubjectIds: string[];
  }
): Promise<void> {
  const cleanEmail = invite.email.trim().toLowerCase();
  const inviteId = safeEmailKey(cleanEmail);
  const path = `teacherInvites/${inviteId}`;
  try {
    const payload: Record<string, unknown> = {
      email: cleanEmail.slice(0, 160),
      displayName: invite.displayName.trim().slice(0, 120),
      assignedSubjectIds: invite.assignedSubjectIds.slice(0, 20),
      createdByUid: adminUid,
      createdAt: serverTimestamp(),
    };
    if (invite.teacherCode?.trim()) {
      payload.teacherCode = invite.teacherCode.trim().slice(0, 64);
    }
    await setDoc(doc(db, 'teacherInvites', inviteId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteTeacherInvite(inviteId: string): Promise<void> {
  const path = `teacherInvites/${inviteId}`;
  try {
    await deleteDoc(doc(db, 'teacherInvites', inviteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
