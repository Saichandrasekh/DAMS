import { api } from '@/lib/api';
import type { DiaryEntry } from '@/types/admin';

export interface TeacherAssignment {
  class_id: number;
  class_name: string;
  section: string;
  subject_id: number;
  subject_name: string;
}

export interface AttendanceStudent {
  id: number;
  name: string;
  roll_no: string | null;
  status: string;
  remarks: string;
}

export interface MarksStudent {
  id: number;
  name: string;
  roll_no: string | null;
  marks: string;
  remarks: string;
}

export interface TeacherDashboardData {
  my_classes: { id: number; name: string; section: string; subject_id: number; subject_name: string }[];
  today_summary: { present: number; absent: number; total: number } | null;
  my_schedule: { period_no: number; subject_name: string; class_name: string; section: string }[];
  today: string;
  day_name: string;
}

export interface AttendanceReportRow {
  name: string;
  student_id: number;
  is_active: number;
  roll_no: string | null;
  total_classes: number;
  present: number | null;
  absent: number | null;
  late: number | null;
  percentage: number | null;
}

export type StaffStatus = 'present' | 'absent' | 'late' | 'half_day' | 'on_leave';

export interface StaffCheckinResponse {
  action: 'check_in' | 'check_out' | 'already_done';
  message?: string;
  error?: string;
  check_in: string | null;
  check_out: string | null;
  status: StaffStatus;
  date: string;
}

export interface AttendanceRecord {
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: StaffStatus;
  remarks: string | null;
}

export interface TeacherSelfAttendance {
  today: (AttendanceRecord & { id?: number }) | null;
  history: AttendanceRecord[];
  month_summary: {
    total_days?: number;
    present?: number;
    late?: number;
    absent?: number;
    on_leave?: number;
    half_day?: number;
  };
  date: string;
}

export const teacherApi = {
  async dashboard(): Promise<TeacherDashboardData> {
    const res = await api.get<TeacherDashboardData>('/teacher/dashboard');
    return res.data;
  },

  async myClasses(): Promise<{
    classes: { id: number; name: string; section: string; academic_year: string | null; subject_name: string; subject_id: number; student_count: number }[];
  }> {
    const res = await api.get('/teacher/my-classes');
    return res.data as {
      classes: { id: number; name: string; section: string; academic_year: string | null; subject_name: string; subject_id: number; student_count: number }[];
    };
  },

  async assignments(): Promise<{ assignments: TeacherAssignment[]; periods_per_day: number }> {
    const res = await api.get<{ assignments: TeacherAssignment[]; periods_per_day: number }>(
      '/teacher/teaching-assignments'
    );
    return res.data;
  },

  async attendanceStudents(params: { class_id: number; subject_id: number; date: string; period?: number }): Promise<AttendanceStudent[]> {
    const qs = new URLSearchParams({
      class_id: String(params.class_id),
      subject_id: String(params.subject_id),
      date: params.date,
      period: String(params.period ?? 0),
    });
    const res = await api.get<{ students: AttendanceStudent[] }>(`/teacher/attendance/students?${qs}`);
    return res.data.students;
  },

  async markAttendance(input: {
    class_id: number;
    subject_id: number;
    date: string;
    period_no?: number;
    records: { student_id: number; status: string; remarks?: string }[];
  }): Promise<void> {
    await api.post('/teacher/attendance/mark', input);
  },

  async attendanceReport(params: {
    class_id?: number;
    subject_id?: number;
    from_date?: string;
    to_date?: string;
  }): Promise<{
    classes: { id: number; name: string; section: string; subject_id: number; subject_name: string }[];
    report: AttendanceReportRow[];
    filters: { class_id: number | null; subject_id: number | null; from_date: string; to_date: string };
  }> {
    const qs = new URLSearchParams();
    if (params.class_id) qs.append('class_id', String(params.class_id));
    if (params.subject_id) qs.append('subject_id', String(params.subject_id));
    if (params.from_date) qs.append('from_date', params.from_date);
    if (params.to_date) qs.append('to_date', params.to_date);
    const res = await api.get(`/teacher/attendance-report?${qs}`);
    return res.data as {
      classes: { id: number; name: string; section: string; subject_id: number; subject_name: string }[];
      report: AttendanceReportRow[];
      filters: { class_id: number | null; subject_id: number | null; from_date: string; to_date: string };
    };
  },

  async checkin(): Promise<StaffCheckinResponse> {
    const res = await api.post<StaffCheckinResponse>('/teacher/staff-checkin');
    return res.data;
  },

  async myAttendance(): Promise<TeacherSelfAttendance> {
    const res = await api.get<TeacherSelfAttendance>('/teacher/attendance-me');
    return res.data;
  },

  async listDiary(filters: { scope?: 'school' | 'class'; class_id?: number; mine?: boolean } = {}): Promise<{
    entries: DiaryEntry[];
    my_classes: { id: number; name: string; section: string }[];
  }> {
    const qs = new URLSearchParams();
    if (filters.scope) qs.append('scope', filters.scope);
    if (filters.class_id) qs.append('class_id', String(filters.class_id));
    if (filters.mine) qs.append('mine', '1');
    const res = await api.get(`/teacher/diary${qs.toString() ? `?${qs}` : ''}`);
    return res.data as { entries: DiaryEntry[]; my_classes: { id: number; name: string; section: string }[] };
  },
  async addDiary(input: { class_id: number; title: string; content: string; subject_id?: number; entry_date?: string; link?: string }): Promise<void> {
    await api.post('/teacher/diary', input);
  },
  async updateDiary(id: number, input: { title?: string; content?: string; entry_date?: string; link?: string }): Promise<void> {
    await api.put(`/teacher/diary/${id}`, input);
  },
  async deleteDiary(id: number): Promise<void> {
    await api.delete(`/teacher/diary/${id}`);
  },

  async marksExams(): Promise<{ id: number; name: string; exam_date: string; is_published: number }[]> {
    const res = await api.get<{ exams: { id: number; name: string; exam_date: string; is_published: number }[] }>('/teacher/marks/exams');
    return res.data.exams;
  },

  async marksStudents(params: { class_id: number; subject_id: number; exam_id: number }): Promise<MarksStudent[]> {
    const qs = new URLSearchParams({
      class_id: String(params.class_id),
      subject_id: String(params.subject_id),
      exam_id: String(params.exam_id),
    });
    const res = await api.get<{ students: MarksStudent[] }>(`/teacher/marks/students?${qs}`);
    return res.data.students;
  },

  async saveMarks(input: {
    exam_id: number;
    subject_id: number;
    records: { student_id: number; marks: string; remarks?: string }[];
  }): Promise<void> {
    await api.post('/teacher/marks', input);
  },

  async timetable(): Promise<{ periods: number; data: Record<string, { subject_name: string; class_name: string; section: string }> }> {
    const res = await api.get('/teacher/timetable');
    return res.data as { periods: number; data: Record<string, { subject_name: string; class_name: string; section: string }> };
  },
};
