import { api } from '@/lib/api';
import type { DiaryEntry, FeeStudentDetail } from '@/types/admin';

export interface StudentInfo {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  dob: string | null;
  class_name: string | null;
  section: string | null;
  roll_no: string | null;
  class_id: number | null;
  school_name: string | null;
  school_logo: string | null;
}

export interface SubjectStat {
  subject_name: string;
  total: number;
  present: number | null;
  pct: number | null;
}

export interface AttendanceRecord {
  date: string;
  status: string;
  period_no: number;
  subject_name: string | null;
}

export interface StudentDashboardData {
  info: StudentInfo | null;
  subject_stats: SubjectStat[];
  recent: AttendanceRecord[];
  overall_pct: number;
  schedule: { period_no: number; subject_name: string; teacher_name: string | null }[];
  day_name: string;
  today: string;
}

export interface ExamMark {
  marks_obtained: number | string | null;
  remarks: string | null;
  subject_name: string;
}

export interface Exam {
  id: number;
  name: string;
  exam_date: string;
  academic_year: string;
}

export const studentApi = {
  async dashboard(): Promise<StudentDashboardData> {
    const res = await api.get<StudentDashboardData>('/student/dashboard');
    return res.data;
  },

  async attendance(params: { month?: string; subject_id?: number }): Promise<{
    records: AttendanceRecord[];
    subjects: { id: number; name: string }[];
    month: string;
    subject_id: number | null;
  }> {
    const qs = new URLSearchParams();
    if (params.month) qs.append('month', params.month);
    if (params.subject_id) qs.append('subject_id', String(params.subject_id));
    const res = await api.get(`/student/attendance${qs.toString() ? `?${qs}` : ''}`);
    return res.data as {
      records: AttendanceRecord[];
      subjects: { id: number; name: string }[];
      month: string;
      subject_id: number | null;
    };
  },

  async reportCard(): Promise<{ exams: Exam[]; results: Record<number, ExamMark[]> }> {
    const res = await api.get('/student/report-card');
    return res.data as { exams: Exam[]; results: Record<number, ExamMark[]> };
  },

  async timetable(): Promise<{
    info: { class_id: number; class_name: string; section: string };
    periods: number;
    data: Record<string, { subject_name: string; teacher_name: string | null }>;
  }> {
    const res = await api.get('/student/timetable');
    return res.data as {
      info: { class_id: number; class_name: string; section: string };
      periods: number;
      data: Record<string, { subject_name: string; teacher_name: string | null }>;
    };
  },

  async fees(): Promise<FeeStudentDetail> {
    const res = await api.get<FeeStudentDetail>('/student/fees');
    return res.data;
  },

  async diary(): Promise<{ entries: DiaryEntry[] }> {
    const res = await api.get<{ entries: DiaryEntry[] }>('/student/diary');
    return res.data;
  },
};
