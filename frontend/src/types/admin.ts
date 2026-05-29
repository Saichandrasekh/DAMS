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
  // Optional fields populated only when ?date= is sent to /admin/students
  date_status?: 'present' | 'late' | 'absent' | 'not_marked';
  date_present?: number;
  date_late?: number;
  date_absent?: number;
  date_marked?: number;
}

export interface Teacher {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  is_active: number;
  subjects: string | null;
  class_count?: number;
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
  periods: number;
  timetable: Record<number, string | undefined>;
  buckets: {
    present: { id: number; name: string; roll_no: string | null; phone: string | null; remarks: string | null }[];
    late:    { id: number; name: string; roll_no: string | null; phone: string | null; remarks: string | null }[];
    absent:  { id: number; name: string; roll_no: string | null; phone: string | null; remarks: string | null }[];
    not_marked: { id: number; name: string; roll_no: string | null; phone: string | null; remarks: string | null }[];
  };
  students: {
    id: number;
    name: string;
    roll_no: string | null;
    phone: string | null;
    remarks: string | null;
    overall_status: 'present' | 'late' | 'absent' | 'not_marked';
    present_count: number;
    late_count: number;
    absent_count: number;
    not_marked_count: number;
    periods: {
      period_no: number;
      status: 'present' | 'late' | 'absent' | 'not_marked' | 'leave' | 'excused';
      subject_name: string | null;
      remarks: string | null;
    }[];
  }[];
}

export interface AttendanceStaffDetail {
  date: string;
  staff: {
    staff_id: number;
    staff_name: string;
    role: string;
    phone: string | null;
    status: string | null;
    check_in: string | null;
    check_out: string | null;
    remarks: string | null;
    leave_type: string | null;
  }[];
  totals: {
    total: number;
    present: number;
    late: number;
    absent: number;
    on_leave: number;
    half_day: number;
    not_marked: number;
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

export interface Graduate {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  is_active: number;
  from_class_id: number | null;
  from_class_name: string | null;
  from_section: string | null;
  from_academic_year: string | null;
  old_roll_no: string | null;
  reason: string | null;
  promoted_at: string;
  promoted_by_name: string | null;
}

export interface GraduateGroup {
  academic_year: string | null;
  count: number;
  students: Graduate[];
}

export interface GraduatesResponse {
  groups: GraduateGroup[];
  total: number;
}

export type DiaryScope = 'school' | 'class';

export interface DiaryEntry {
  id: number;
  scope: DiaryScope;
  class_id: number | null;
  subject_id: number | null;
  title: string;
  content: string;
  link: string | null;
  entry_date: string;
  posted_by: number | null;
  created_at: string;
  updated_at: string;
  class_name: string | null;
  section: string | null;
  subject_name: string | null;
  posted_by_name: string | null;
  posted_by_role: string | null;
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

export type FeeCycle = 'annual' | 'monthly';
export type FeeMode = 'cash' | 'upi' | 'cheque' | 'card' | 'bank_transfer' | 'other';

export interface FeeHead {
  id: number;
  class_id: number;
  class_name: string;
  section: string;
  academic_year: string | null;
  name: string;
  amount: number;
  cycle: FeeCycle;
  created_at: string;
}

export interface FeeStudentRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  class_id: number;
  class_name: string;
  section: string;
  roll_no: string | null;
  total: number;
  paid: number;
  due: number;
  status: 'paid' | 'partial' | 'pending' | 'no_dues';
}

export interface FeeMonthRow {
  month: string;
  amount: number;
  paid: number;
  due: number;
  status: 'paid' | 'partial' | 'pending';
}

export interface FeeHeadBreakdown {
  id: number;
  class_id: number;
  academic_year: string | null;
  name: string;
  amount: number;
  cycle: FeeCycle;
  total: number;
  paid: number;
  due: number;
  status: 'paid' | 'partial' | 'pending';
  months: FeeMonthRow[] | null;
}

export interface FeePayment {
  id: number;
  fee_head_id: number;
  head_name: string;
  head_cycle: FeeCycle;
  month: string | null;
  amount: number;
  paid_date: string;
  mode: FeeMode;
  receipt_no: string;
  remarks: string | null;
  collected_by_name: string | null;
  created_at: string;
}

export interface FeeStudentDetail {
  student: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    gender: string | null;
    dob: string | null;
    address: string | null;
    class_id: number | null;
    class_name: string | null;
    section: string | null;
    academic_year: string | null;
    roll_no: string | null;
    school_name: string | null;
    school_address: string | null;
    school_phone: string | null;
    school_logo: string | null;
  };
  heads: FeeHeadBreakdown[];
  payments: FeePayment[];
  class_id: number | null;
  academic_year: string | null;
  totals: { total: number; paid: number; due: number };
}

export interface FeeReports {
  totals: { today: number; this_month: number; this_year: number; all_time: number };
  by_mode: { mode: FeeMode; count: number; total: number }[];
  by_class: { id: number; name: string; section: string; payment_count: number; collected: number }[];
  recent: {
    id: number;
    amount: number;
    paid_date: string;
    mode: FeeMode;
    receipt_no: string;
    student_name: string;
    head_name: string;
    class_name: string | null;
    section: string | null;
  }[];
  defaulters: {
    id: number;
    name: string;
    phone: string | null;
    class_name: string;
    section: string;
    roll_no: string | null;
    total: number;
    paid: number;
    due: number;
  }[];
}
