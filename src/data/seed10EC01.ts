import type { ClassDatabase, Student, Subject } from '../types/attendance.ts';

export const CLASS_NAME = '10EC01';

export const INITIAL_SUBJECTS: Subject[] = [
  {
    id: 'toan',
    name: 'Toán',
    code: 'MAT201',
    officialName: 'Toán 10-1',
    teacher: 'Thoantk29',
  },
  {
    id: 'ngu-van',
    name: 'Ngữ Văn',
    code: 'LIT201',
    officialName: 'Ngữ văn 10-1',
    teacher: 'Trangpt50',
  },
  {
    id: 'tieng-anh',
    name: 'Tiếng Anh',
    code: 'ENG201',
    officialName: 'Tiếng Anh 10-1',
    teacher: 'Linhvtt18',
  },
  {
    id: 'vat-ly',
    name: 'Vật lý',
    code: 'PHY201',
    officialName: 'Vật lý 10-1',
    teacher: 'Minhth15',
  },
  {
    id: 'lich-su',
    name: 'Lịch sử',
    code: 'HIS201',
    officialName: 'Lịch sử 10',
    teacher: 'Datnt260',
  },
  {
    id: 'cong-nghe',
    name: 'Công nghệ',
    code: 'TEC201',
    officialName: 'Công nghệ 10-1',
    teacher: 'Haipn18',
  },
  {
    id: 'gdtc',
    name: 'GDTC',
    code: 'PHE201',
    officialName: 'GDTC 10',
    teacher: 'Tannv18',
  },
  {
    id: 'tin-hoc',
    name: 'Tin học',
    code: 'INF201',
    officialName: 'Tin học 1',
    teacher: 'Quocnb3',
  },
  {
    id: 'ky-nang-mem',
    name: 'Kỹ năng mềm',
    code: 'KNM201',
    officialName: 'Kỹ năng nhận thức bản thân',
    teacher: 'Giangnh42',
  },
  {
    id: 'marketing-can-ban',
    name: 'Marketing căn bản',
    code: 'BAN401',
    officialName: 'Marketing căn bản',
    teacher: 'ViTN',
  },
];

export const INITIAL_STUDENTS: Student[] = [
  { stt: 1, id: 'TD01891', fullName: 'Nguyễn Hải Phong' },
  { stt: 2, id: 'TD01892', fullName: 'Nguyễn Lê Ngọc Băng' },
  { stt: 3, id: 'TD01906', fullName: 'Nguyễn Hoàng Gia Khánh' },
  { stt: 4, id: 'TD01914', fullName: 'Huỳnh Kim Như' },
  { stt: 5, id: 'TD01926', fullName: 'Nguyễn Lưu Quỳnh Thư' },
  { stt: 6, id: 'TD01934', fullName: 'Lê Đức Tuấn' },
  { stt: 7, id: 'TD01936', fullName: 'Nguyễn Thái Hoàng Long' },
  { stt: 8, id: 'TD01944', fullName: 'Vũ Hoàng Gia Huy' },
  { stt: 9, id: 'TD01949', fullName: 'Trần Gia Hưng' },
  { stt: 10, id: 'TD01956', fullName: 'Nguyễn Ngọc Khánh Linh' },
  { stt: 11, id: 'TD01965', fullName: 'Phùng Hồ Thiên Ngân' },
  { stt: 12, id: 'TD01977', fullName: 'Hồ Hữu Hưng' },
  { stt: 13, id: 'TD01986', fullName: 'Lê Nhật Minh Thông' },
  { stt: 14, id: 'TD02008', fullName: 'Vũ Minh Ngọc' },
  { stt: 15, id: 'TD02010', fullName: 'Nguyễn Thị Hoa Hồng' },
];

export function createInitialDatabase(): ClassDatabase {
  return {
    className: CLASS_NAME,
    academicYear: 'HK I/2026',
    students: INITIAL_STUDENTS.map((student) => ({ ...student })),
    subjects: INITIAL_SUBJECTS.map((subject) => ({ ...subject })),
    sessions: [],
    schedule: {},
  };
}
