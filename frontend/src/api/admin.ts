import { api } from '@/lib/api';
import type {
  AdminDashboardData,
  AttendanceClassDetail,
  AttendanceOverview,
  AttendanceStaffDetail,
  BatchDetail,
  BatchSummary,
  ClassRef,
  ClassRoster,
  ClassRow,
  FeeHead,
  FeeMode,
  FeePayment,
  FeeReports,
  FeeStudentDetail,
  FeeStudentRow,
  DiaryEntry,
  GraduatesResponse,
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

  async listStudents(filters: { class_id?: string; status?: string; date?: string } = {}): Promise<{ students: Student[]; classes: ClassRef[]; date: string | null }> {
    const params = new URLSearchParams();
    if (filters.class_id) params.append('class_id', filters.class_id);
    if (filters.status) params.append('status', filters.status);
    if (filters.date) params.append('date', filters.date);
    const qs = params.toString();
    const res = await api.get(`/admin/students${qs ? `?${qs}` : ''}`);
    return res.data as { students: Student[]; classes: ClassRef[]; date: string | null };
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

  async studentDayDetail(id: number, date: string): Promise<{
    student: { id: number; name: string; roll_no: string | null; class_id: number | null; class_name: string | null; section: string | null };
    date: string;
    day_name: string;
    periods: number;
    period_list: {
      period_no: number;
      status: 'present' | 'late' | 'absent' | 'not_marked' | 'leave' | 'excused';
      subject_name: string | null;
      teacher_name: string | null;
      remarks: string | null;
      marked_by_name: string | null;
    }[];
    counts: { present: number; late: number; absent: number; not_marked: number };
  }> {
    const res = await api.get(`/admin/students/${id}/day?date=${encodeURIComponent(date)}`);
    return res.data as never;
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
  async listGraduates(): Promise<GraduatesResponse> {
    const res = await api.get<GraduatesResponse>('/admin/graduates');
    return res.data;
  },
  async reactivateGraduate(id: number): Promise<{ message: string }> {
    const res = await api.post<{ message: string }>(`/admin/graduates/${id}/reactivate`);
    return res.data;
  },

  async listDiary(filters: { scope?: 'school' | 'class'; class_id?: number; from_date?: string; to_date?: string } = {}): Promise<{
    entries: DiaryEntry[];
    classes: ClassRef[];
  }> {
    const qs = new URLSearchParams();
    if (filters.scope) qs.append('scope', filters.scope);
    if (filters.class_id) qs.append('class_id', String(filters.class_id));
    if (filters.from_date) qs.append('from_date', filters.from_date);
    if (filters.to_date) qs.append('to_date', filters.to_date);
    const res = await api.get(`/admin/diary${qs.toString() ? `?${qs}` : ''}`);
    return res.data as { entries: DiaryEntry[]; classes: ClassRef[] };
  },
  async addDiary(input: { title: string; content: string; class_id?: number; subject_id?: number; entry_date?: string; link?: string }): Promise<void> {
    await api.post('/admin/diary', input);
  },
  async updateDiary(id: number, input: { title?: string; content?: string; entry_date?: string; link?: string }): Promise<void> {
    await api.put(`/admin/diary/${id}`, input);
  },
  async deleteDiary(id: number): Promise<void> {
    await api.delete(`/admin/diary/${id}`);
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
  async attendanceStaff(date?: string): Promise<AttendanceStaffDetail> {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await api.get<AttendanceStaffDetail>(`/admin/attendance-overview/staff${qs}`);
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

  // ─── FEES ───────────────────────────────────────────────────────────────
  async listFeeHeads(classId?: number): Promise<{ heads: FeeHead[]; classes: ClassRef[] }> {
    const qs = classId ? `?class_id=${classId}` : '';
    const res = await api.get(`/admin/fees/heads${qs}`);
    return res.data as { heads: FeeHead[]; classes: ClassRef[] };
  },
  async addFeeHead(input: { class_id: number; name: string; amount: number; cycle: 'annual' | 'monthly'; academic_year?: string }): Promise<void> {
    await api.post('/admin/fees/heads', input);
  },
  async updateFeeHead(id: number, input: { name?: string; amount?: number; cycle?: 'annual' | 'monthly'; academic_year?: string }): Promise<void> {
    await api.put(`/admin/fees/heads/${id}`, input);
  },
  async deleteFeeHead(id: number): Promise<void> {
    await api.delete(`/admin/fees/heads/${id}`);
  },

  async listFeeStudents(classId?: number): Promise<{ students: FeeStudentRow[]; classes: ClassRef[] }> {
    const qs = classId ? `?class_id=${classId}` : '';
    const res = await api.get(`/admin/fees/students${qs}`);
    return res.data as { students: FeeStudentRow[]; classes: ClassRef[] };
  },
  async feeStudentDetail(studentId: number): Promise<FeeStudentDetail> {
    const res = await api.get<FeeStudentDetail>(`/admin/fees/students/${studentId}`);
    return res.data;
  },

  async addFeePayment(input: {
    student_id: number;
    fee_head_id: number;
    amount: number;
    paid_date: string;
    mode: FeeMode;
    month?: string;
    remarks?: string;
  }): Promise<{ payment: FeePayment; message: string }> {
    const res = await api.post<{ payment: FeePayment; message: string }>('/admin/fees/payments', input);
    return res.data;
  },
  async deleteFeePayment(id: number): Promise<void> {
    await api.delete(`/admin/fees/payments/${id}`);
  },

  async feeReports(): Promise<FeeReports> {
    const res = await api.get<FeeReports>('/admin/fees/reports');
    return res.data;
  },

  async teachersAttendanceReport(params: { from_date?: string; to_date?: string; teacher_id?: number } = {}): Promise<{
    from_date: string;
    to_date: string;
    working_days: number;
    summaries: {
      id: number;
      name: string;
      email: string;
      phone: string | null;
      marked: number;
      present: number;
      late: number;
      absent: number;
      on_leave: number;
      half_day: number;
      not_marked: number;
      pct: number;
      coverage: number;
      last_date: string | null;
    }[];
    detail: {
      teacher: { id: number; name: string; email: string; phone: string | null };
      records: { date: string; check_in: string | null; check_out: string | null; status: string; remarks: string | null }[];
    } | null;
  }> {
    const qs = new URLSearchParams();
    if (params.from_date) qs.append('from_date', params.from_date);
    if (params.to_date) qs.append('to_date', params.to_date);
    if (params.teacher_id) qs.append('teacher_id', String(params.teacher_id));
    const res = await api.get(`/admin/teachers-attendance-report${qs.toString() ? `?${qs}` : ''}`);
    return res.data as never;
  },
};
