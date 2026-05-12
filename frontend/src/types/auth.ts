export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'principal'
  | 'teacher'
  | 'student'
  | 'parent';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  school_id: number | null;
  school_name: string | null;
  school_color: string;
  school_logo: string | null;
}

export interface LoginResponse extends AuthUser {
  token: string;
}
