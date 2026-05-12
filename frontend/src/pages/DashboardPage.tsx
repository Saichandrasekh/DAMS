import { useAuth } from '@/contexts/AuthContext';
import { SuperadminDashboardPage } from '@/pages/superadmin/SuperadminDashboardPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { TeacherDashboardPage } from '@/pages/teacher/TeacherDashboardPage';
import { StudentDashboardPage } from '@/pages/student/StudentDashboardPage';
import { ParentDashboardPage } from '@/pages/parent/ParentDashboardPage';

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === 'super_admin') return <SuperadminDashboardPage />;
  if (user.role === 'admin' || user.role === 'principal') return <AdminDashboardPage />;
  if (user.role === 'teacher') return <TeacherDashboardPage />;
  if (user.role === 'student') return <StudentDashboardPage />;
  if (user.role === 'parent') return <ParentDashboardPage />;

  return (
    <div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Hi, {user.name}</h2>
        <p className="text-muted">Logged in as <b style={{ textTransform: 'capitalize' }}>{user.role}</b>.</p>
      </div>
    </div>
  );
}
