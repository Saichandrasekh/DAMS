export interface AdminStats {
  students: number;
  teachers: number;
  classes: number;
  today_present: number;
  today_absent: number;
}

export interface AdminDashboardData {
  stats: AdminStats;
  recent_logs: { id: number; action: string; details: string | null; created_at: string; user_name: string | null }[];
  school: { id: number; name: string; code: string } | null;
}

export interface ClassRef {
  id: number;
  name: string;
  section: string;
}

export interface TeacherRef {
  id: number;
  name: string;
}

export interface Student {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  dob: string | null;
  address: string | null;
  is_active: number;
  class_id: number | null;
  class_name: string | null;
  section: string | null;
  roll_no: string | null;
}

export interface Teacher {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  is_active: number;
  subjects: string | null;
}

export interface ClassRow {
  id: number;
  name: string;
  section: string;
  academic_year: string | null;
  class_teacher_id: number | null;
  class_teacher_name: string | null;
  student_count: number;
  subject_count: number;
}

export interface StudentDetailInfo {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  dob: string | null;
  address: string | null;
  is_active: number;
  created_at: string;
  class_id: number | null;
  class_name: string | null;
  section: string | null;
  academic_year: string | null;
  roll_no: string | null;
}

export interface StudentDetailSubject {
  subject_name: string;
  total: number;
  present: number | null;
  absent: number | null;
  late: number | null;
  pct: number | null;
}

export interface StudentDetailRecent {
  date: string;
  status: string;
  period_no: number;
  remarks: string | null;
  subject_name: string | null;
}

export interface StudentDetailExam {
  exam_id: number;
  exam_name: string;
  exam_date: string;
  is_published: number;
  subjects: {
    subject_name: string;
    marks_obtained: number | string | null;
    remarks: string | null;
  }[];
}

export interface StudentDetailParent {
  id: number;
  name: string;
  email: string;
  phone: string | null;
}

export interface StudentDetails {
  info: StudentDetailInfo;
  overall: { total: number; present: number; absent: number; late: number; percentage: number };
  subject_stats: StudentDetailSubject[];
  recent: StudentDetailRecent[];
  exams: StudentDetailExam[];
  parents: StudentDetailParent[];
}

export interface AttendanceOverview {
  date: string;
  totals: {
    enrolled: number;
    present: number;
    late: number;
    absent: number;
    not_marked: number;
    marked: number;
    attendance_pct: number;
  };
  classes: {
    id: number;
    name: string;
    section: string;
    academic_year: string | null;
    enrolled: number;
    present: number;
    late: number;
    absent: number;
    not_marked: number;
  }[];
}

export interface AttendanceClassDetail {
  class: { id: number; name: string; section: string };
  date: string;
  buckets: {
    present: { id: number; name: string; roll_no: string | null; phone: string | null; remarks: string | null }[];
    late:    { id: number; name: string; roll_no: string | null; phone: string | null; remarks: string | null }[];
    absent:  { id: number; name: string; roll_no: string | null; phone: string | null; remarks: string | null }[];
    not_marked: { id: number; name: string; roll_no: string | null; phone: string | null; remarks: string | null }[];
  };
}

export interface BatchSummary {
  academic_year: string | null;
  class_count: number;
  student_count: number;
  attendance_total: number;
  attendance_present: number;
  attendance_pct: number;
}

export interface BatchDetail {
  academic_year: string | null;
  classes: {
    id: number;
    name: string;
    section: string;
    academic_year: string | null;
    class_teacher_id: number | null;
    class_teacher_name: string | null;
    student_count: number;
  }[];
  students: {
    id: number;
    name: string;
    email: string;
    is_active: number;
    class_id: number;
    class_name: string;
    section: string;
    roll_no: string | null;
    total: number;
    present: number;
    absent: number;
    late: number;
    pct: number;
  }[];
}

export interface ClassRoster {
  class: { id: number; name: string; section: string; academic_year: string | null };
  students: { id: number; name: string; email: string; is_active: number; roll_no: string | null }[];
}

export interface PromotionRecord {
  id: number;
  student_id: number;
  from_class_id: number | null;
  to_class_id: number | null;
  from_class_name: string | null;
  from_section: string | null;
  to_class_name: string | null;
  to_section: string | null;
  from_academic_year: string | null;
  to_academic_year: string | null;
  old_roll_no: string | null;
  new_roll_no: string | null;
  reason: string | null;
  promoted_at: string;
  promoted_by_name: string | null;
}

export interface SubjectRow {
  id: number;
  name: string;
  class_id: number;
  class_name: string;
  section: string;
  teacher_id: number | null;
  teacher_name: string | null;
}
