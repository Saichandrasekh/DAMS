import { api } from '@/lib/api';
import type {
  AdminDashboardData,
  AttendanceClassDetail,
  AttendanceOverview,
  BatchDetail,
  BatchSummary,
  ClassRef,
  ClassRoster,
  ClassRow,
  PromotionRecord,
  Student,
  StudentDetails,
  SubjectRow,
  Teacher,
  TeacherRef,
} from '@/types/admin';

export const adminApi = {
  async dashboard(): Promise<AdminDashboardData> {
    const res = await api.get<AdminDashboardData>('/admin/dashboard');
    return res.data;
  },

  async listStudents(filters: { class_id?: string; status?: string } = {}): Promise<{ students: Student[]; classes: ClassRef[] }> {
    const params = new URLSearchParams();
    if (filters.class_id) params.append('class_id', filters.class_id);
    if (filters.status) params.append('status', filters.status);
    const qs = params.toString();
    const res = await api.get(`/admin/students${qs ? `?${qs}` : ''}`);
    return res.data as { students: Student[]; classes: ClassRef[] };
  },

  async addStudent(input: object): Promise<void> {
    await api.post('/admin/students', input);
  },

  async getStudent(id: number): Promise<{ student: Student & { original_password?: string }; current_class: { class_id: number; roll_no: string } | null; classes: ClassRef[] }> {
    const res = await api.get(`/admin/students/${id}`);
    return res.data as { student: Student & { original_password?: string }; current_class: { class_id: number; roll_no: string } | null; classes: ClassRef[] };
  },

  async studentDetails(id: number): Promise<StudentDetails> {
    const res = await api.get<StudentDetails>(`/admin/students/${id}/details`);
    return res.data;
  },

  async updateStudent(id: number, input: object): Promise<void> {
    await api.put(`/admin/students/${id}`, input);
  },

  async deleteStudent(id: number): Promise<{ message: string }> {
    const res = await api.delete<{ message: string }>(`/admin/students/${id}`);
    return res.data;
  },

  async listTeachers(): Promise<Teacher[]> {
    const res = await api.get<{ teachers: Teacher[] }>('/admin/teachers');
    return res.data.teachers;
  },

  async addTeacher(input: object): Promise<void> {
    await api.post('/admin/teachers', input);
  },

  async updateTeacher(id: number, input: object): Promise<void> {
    await api.put(`/admin/teachers/${id}`, input);
  },

  async deleteTeacher(id: number): Promise<void> {
    await api.delete(`/admin/teachers/${id}`);
  },

  async listClasses(): Promise<{ classes: ClassRow[]; teachers: TeacherRef[] }> {
    const res = await api.get('/admin/classes');
    return res.data as { classes: ClassRow[]; teachers: TeacherRef[] };
  },

  async addClass(input: object): Promise<void> {
    await api.post('/admin/classes', input);
  },

  async updateClass(id: number, input: object): Promise<void> {
    await api.put(`/admin/classes/${id}`, input);
  },

  async deleteClass(id: number): Promise<void> {
    await api.delete(`/admin/classes/${id}`);
  },

  async classRoster(id: number): Promise<ClassRoster> {
    const res = await api.get<ClassRoster>(`/admin/classes/${id}/roster`);
    return res.data;
  },

  async promote(input: {
    from_class_id: number;
    to_class_id: number | null;
    student_ids?: number[];
    keep_roll_nos?: boolean;
    reason?: string;
  }): Promise<{ promoted: number; graduated: boolean; message: string }> {
    const res = await api.post<{ promoted: number; graduated: boolean; message: string }>(
      '/admin/classes/promote',
      input
    );
    return res.data;
  },

  async studentHistory(id: number): Promise<PromotionRecord[]> {
    const res = await api.get<{ history: PromotionRecord[] }>(`/admin/students/${id}/history`);
    return res.data.history;
  },

  async listBatches(): Promise<BatchSummary[]> {
    const res = await api.get<{ batches: BatchSummary[] }>('/admin/batches');
    return res.data.batches;
  },
  async batchDetail(year: string | null): Promise<BatchDetail> {
    const key = year ?? '(none)';
    const res = await api.get<BatchDetail>(`/admin/batches/${encodeURIComponent(key)}`);
    return res.data;
  },

  async attendanceOverview(date?: string): Promise<AttendanceOverview> {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await api.get<AttendanceOverview>(`/admin/attendance-overview${qs}`);
    return res.data;
  },
  async attendanceClassDetail(classId: number, date?: string): Promise<AttendanceClassDetail> {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await api.get<AttendanceClassDetail>(`/admin/attendance-overview/class/${classId}${qs}`);
    return res.data;
  },

  async listSubjects(): Promise<{ subjects: SubjectRow[]; classes: ClassRef[]; teachers: TeacherRef[] }> {
    const res = await api.get('/admin/subjects');
    return res.data as { subjects: SubjectRow[]; classes: ClassRef[]; teachers: TeacherRef[] };
  },

  async addSubject(input: object): Promise<void> {
    await api.post('/admin/subjects', input);
  },

  async updateSubject(id: number, input: object): Promise<void> {
    await api.put(`/admin/subjects/${id}`, input);
  },

  async deleteSubject(id: number): Promise<void> {
    await api.delete(`/admin/subjects/${id}`);
  },

  async getSettings(): Promise<{ school: Record<string, unknown> }> {
    const res = await api.get('/admin/settings');
    return res.data as { school: Record<string, unknown> };
  },
  async updateSettings(input: object): Promise<void> {
    await api.put('/admin/settings', input);
  },

  async listHolidays(): Promise<{ id: number; date: string; name: string }[]> {
    const res = await api.get<{ holidays: { id: number; date: string; name: string }[] }>('/admin/holidays');
    return res.data.holidays;
  },
  async addHoliday(input: { name: string; date: string }): Promise<void> {
    await api.post('/admin/holidays', input);
  },
  async deleteHoliday(id: number): Promise<void> {
    await api.delete(`/admin/holidays/${id}`);
  },

  async listExams(): Promise<{ id: number; name: string; exam_date: string; academic_year: string; is_published: number; created_at: string }[]> {
    const res = await api.get<{ exams: { id: number; name: string; exam_date: string; academic_year: string; is_published: number; created_at: string }[] }>('/admin/exams');
    return res.data.exams;
  },
  async addExam(input: object): Promise<void> {
    await api.post('/admin/exams', input);
  },
  async updateExam(id: number, input: object): Promise<void> {
    await api.put(`/admin/exams/${id}`, input);
  },
  async toggleExamPublish(id: number): Promise<{ is_published: boolean }> {
    const res = await api.post<{ is_published: boolean }>(`/admin/exams/${id}/toggle-publish`);
    return res.data;
  },
  async deleteExam(id: number): Promise<void> {
    await api.delete(`/admin/exams/${id}`);
  },

  async staffAttendance(date?: string): Promise<{
    records: { staff_id: number; staff_name: string; role: string; status: string; check_in: string | null; check_out: string | null; remarks: string | null }[];
    all_staff: { id: number; name: string; role: string }[];
    date: string;
  }> {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await api.get(`/admin/staff-attendance${qs}`);
    return res.data as {
      records: { staff_id: number; staff_name: string; role: string; status: string; check_in: string | null; check_out: string | null; remarks: string | null }[];
      all_staff: { id: number; name: string; role: string }[];
      date: string;
    };
  },
  async markStaff(input: { staff_id: number; date: string; status: string; check_in?: string; check_out?: string; remarks?: string }): Promise<void> {
    await api.post('/admin/staff-attendance/mark', input);
  },

  async timetable(classId?: number): Promise<{
    classes: { id: number; name: string; section: string }[];
    subjects: { id: number; name: string }[];
    periods: number;
    data: Record<string, number>;
    class_id: number | null;
  }> {
    const qs = classId ? `?class_id=${classId}` : '';
    const res = await api.get(`/admin/timetable${qs}`);
    return res.data as {
      classes: { id: number; name: string; section: string }[];
      subjects: { id: number; name: string }[];
      periods: number;
      data: Record<string, number>;
      class_id: number | null;
    };
  },
  async updateTimetable(input: { class_id: number; day: string; period: number; subject_id: number | null }): Promise<void> {
    await api.post('/admin/timetable/update', input);
  },

  async purgeInactiveStudents(): Promise<{ count: number; message: string }> {
    const res = await api.post<{ count: number; message: string }>('/admin/students/purge-inactive');
    return res.data;
  },

  async importStudents(file: File): Promise<{ success: number; errors: string[]; error_count: number; message: string }> {
    const fd = new FormData();
    fd.append('csv_file', file);
    const res = await api.post<{ success: number; errors: string[]; error_count: number; message: string }>(
      '/admin/students/import',
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data;
  },
};
