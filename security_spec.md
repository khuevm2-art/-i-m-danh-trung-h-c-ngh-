# Security Specification & Payload-First TDD (`10EC01` Online Attendance)

## 1. Data Invariants
1. **Default-Deny Safety Net**: All unspecified paths under `/databases/{database}/documents` are denied.
2. **Verified Identity**: Every read/write requires `request.auth != null` and `request.auth.token.email_verified == true`.
3. **PII Isolation (`users/{userId}`)**:
   - Only the profile owner (`userId == request.auth.uid`) or an `admin` may `get` a `users/{userId}` document.
   - Only `admin` may `list` `/users`.
   - Self-registration (`create`) by non-admins MUST lock `role == 'teacher'` and may ONLY set `status == 'approved'` if a matching `teacherInvites` document exists for `request.auth.token.email`; otherwise `status` MUST be `'pending'`.
   - Users updating their own profile cannot modify `role`, `status`, `uid`, `email`, or `createdAt`.
4. **Master Gate & Role Enforcement (`classes/{classId}/...`)**:
   - Subcollections (`students`, `subjects`, `schedule`, `sessions`) verify the parent `classes/{classId}` document exists (`exists(...)`) on writes.
   - Only `isAdmin()` may create/delete `classes`, `students`, `subjects`, and `teacherInvites`.
   - Only `isApprovedTeacher()` or `isAdmin()` may read `students`, `subjects`, `schedule`, `sessions` and write `schedule` or `sessions`.
5. **Temporal Integrity & Immutability**:
   - `createdAt` and `updatedAt` MUST equal `request.time`.
   - `createdAt` and `uid`/`ownerUid` are immutable on update.
6. **Strict Schema & ID Poisoning Guards**:
   - Every document ID path variable is validated with `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, length `<= 128`).
   - Every string checks `.size()` bounds; arrays check `.size() <= 20`.
   - `keys().hasAll(...) && keys().hasOnly(...)` on `create`, and `affectedKeys().hasOnly(...)` on `update`.

## 2. "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Self-Promotion on Sign-Up**: Non-admin user creates `/users/{uid}` with `role: "admin", status: "approved"`.
2. **Self-Approval Without Invite**: Non-invited user creates `/users/{uid}` with `role: "teacher", status: "approved"`.
3. **Privilege Escalation via Update**: Approved teacher updates `/users/{uid}` changing `role` to `"admin"` or `status` to `"approved"`.
4. **Shadow Field Injection**: Approved teacher creates `/classes/10EC01/sessions/{id}` with extra field `isAdminOverride: true`.
5. **Identity Spoofing on Session**: Teacher A creates `/classes/10EC01/sessions/{id}` with `recordedByUid: "teacher-b-uid"`.
6. **Unverified Email Bypass**: User with `email: "lithua7@gmail.com"` and `email_verified: false` attempts admin write.
7. **PII Scraping**: Teacher A attempts `list` on `/users` or `get` on `/users/{teacherB_uid}`.
8. **Pending Teacher Attendance Tampering**: User with `status: "pending"` attempts to write `/classes/10EC01/sessions/{id}`.
9. **ID Poisoning**: User attempts to write `/classes/10EC01/sessions/` with a 500-character document ID or invalid characters (`../etc`).
10. **Client Timestamp Forgery**: User submits `updatedAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
11. **Roster Tampering by Non-Admin**: Approved teacher attempts to delete `/classes/10EC01/students/TD01891`.
12. **Orphaned Session Creation**: User attempts to create `/classes/NON_EXISTENT/sessions/s1` when parent class doc does not exist.
