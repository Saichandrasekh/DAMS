export interface School {
  id: number;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  primary_color: string | null;
  academic_year: string | null;
  periods_per_day: number | null;
  min_attendance_pct: number | null;
  late_cutoff_time: string | null;
  logo: string | null;
  created_at: string;
  student_count?: number;
  teacher_count?: number;
  admin_count?: number;
}

export interface AdminCredential {
  school_id: number;
  school_name: string;
  school_code: string;
  user_id: number | null;
  admin_name: string | null;
  admin_email: string | null;
  admin_phone: string | null;
  is_active: number | null;
}

export interface AuditLog {
  id: number;
  school_id: number | null;
  user_id: number | null;
  action: string;
  details: string | null;
  ip_address: string | null;
  created_at: string;
  user_name: string | null;
  school_name: string | null;
}

export interface SuperadminDashboardData {
  schools: School[];
  totals: {
    users: number;
    schools: number;
    teachers: number;
    students: number;
  };
  recent_logs: AuditLog[];
}

export interface AddSchoolInput {
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: string;
  admin_name: string;
  admin_email: string;
  admin_password: string;
}

export interface UpdateSchoolInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  primary_color?: string;
  academic_year?: string;
  periods_per_day?: number;
  min_attendance_pct?: number;
  late_cutoff_time?: string;
}

export interface UpdateCredentialInput {
  name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  new_password?: string;
}
