import { api } from '@/lib/api';

export interface ParentChild {
  id: number;
  name: string;
  class_name: string;
  section: string;
  total: number;
  present: number;
  percentage: number;
}

export interface ParentDashboardData {
  children: ParentChild[];
  recent_attendance: { date: string; status: string; student_name: string; subject_name: string | null }[];
  alerts: { student_id: number; student_name: string; percentage: number }[];
}

export interface ChildAttendance {
  date: string;
  status: string;
  subject_name: string | null;
  period_no: number;
}

export const parentApi = {
  async dashboard(): Promise<ParentDashboardData> {
    const res = await api.get<ParentDashboardData>('/parent/dashboard');
    return res.data;
  },
  async childReport(studentId: number): Promise<{ child: { id: number; name: string } | null; attendance: ChildAttendance[] }> {
    const res = await api.get(`/parent/child/${studentId}`);
    return res.data as { child: { id: number; name: string } | null; attendance: ChildAttendance[] };
  },
};
