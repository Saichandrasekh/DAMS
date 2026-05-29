import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types/auth';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  super_admin: [
    { to: '/dashboard', label: 'Dashboard', icon: 'fa-gauge' },
    { to: '/superadmin/schools', label: 'Schools', icon: 'fa-building' },
    { to: '/superadmin/credentials', label: 'Credentials', icon: 'fa-key' },
    { to: '/superadmin/audit-logs', label: 'Audit Logs', icon: 'fa-clipboard-list' },
  ],
  admin: [
    { to: '/dashboard', label: 'Dashboard', icon: 'fa-gauge' },
    { to: '/admin/attendance-overview', label: 'Attendance Today', icon: 'fa-clipboard-check' },
    { to: '/admin/students', label: 'Students', icon: 'fa-user-graduate' },
    { to: '/admin/teachers', label: 'Teachers', icon: 'fa-chalkboard-teacher' },
    { to: '/admin/classes', label: 'Classes', icon: 'fa-school' },
    { to: '/admin/batches', label: 'Batches', icon: 'fa-layer-group' },
    { to: '/admin/subjects', label: 'Subjects', icon: 'fa-book' },
    { to: '/admin/exams', label: 'Exams', icon: 'fa-file-alt' },
    { to: '/admin/timetable', label: 'Timetable', icon: 'fa-calendar-alt' },
    { to: '/admin/fees', label: 'Fees', icon: 'fa-money-check-dollar' },
    { to: '/admin/diary', label: 'Diary', icon: 'fa-book-open' },
    { to: '/admin/holidays', label: 'Holidays', icon: 'fa-umbrella-beach' },
    { to: '/admin/settings', label: 'Settings', icon: 'fa-gear' },
  ],
  principal: [
    { to: '/dashboard', label: 'Dashboard', icon: 'fa-gauge' },
    { to: '/admin/attendance-overview', label: 'Attendance Today', icon: 'fa-clipboard-check' },
    { to: '/admin/students', label: 'Students', icon: 'fa-user-graduate' },
    { to: '/admin/teachers', label: 'Teachers', icon: 'fa-chalkboard-teacher' },
    { to: '/admin/batches', label: 'Batches', icon: 'fa-layer-group' },
    { to: '/admin/fees', label: 'Fees', icon: 'fa-money-check-dollar' },
    { to: '/admin/diary', label: 'Diary', icon: 'fa-book-open' },
  ],
  teacher: [
    { to: '/dashboard', label: 'Dashboard', icon: 'fa-gauge' },
    { to: '/teacher/my-classes', label: 'My Classes', icon: 'fa-chalkboard' },
    { to: '/teacher/mark-attendance', label: 'Mark Attendance', icon: 'fa-user-check' },
    { to: '/teacher/marks-entry', label: 'Marks Entry', icon: 'fa-pen-to-square' },
    { to: '/teacher/attendance-report', label: 'Reports', icon: 'fa-chart-line' },
    { to: '/teacher/timetable', label: 'Timetable', icon: 'fa-calendar-alt' },
    { to: '/teacher/diary', label: 'Diary', icon: 'fa-book-open' },
  ],
  student: [
    { to: '/dashboard', label: 'Dashboard', icon: 'fa-gauge' },
    { to: '/student/attendance', label: 'Attendance', icon: 'fa-user-check' },
    { to: '/student/timetable', label: 'Timetable', icon: 'fa-calendar-alt' },
    { to: '/student/report-card', label: 'Report Card', icon: 'fa-file-lines' },
    { to: '/student/fees', label: 'My Fees', icon: 'fa-money-check-dollar' },
    { to: '/student/diary', label: 'Diary', icon: 'fa-book-open' },
  ],
  parent: [
    { to: '/dashboard', label: 'Dashboard', icon: 'fa-gauge' },
    { to: '/parent/diary', label: 'Diary', icon: 'fa-book-open' },
  ],
};

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close on ESC key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!user) return null;
  const navItems = NAV_BY_ROLE[user.role] ?? [];

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-container">
      {/* Mobile dark overlay behind sidebar */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {user.school_logo ? (
              <img
                src={user.school_logo}
                alt="logo"
                style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${user.school_color}, #764ba2)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  flexShrink: 0,
                }}
              >
                <i className="fas fa-graduation-cap" />
              </div>
            )}
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.school_name ?? 'DAMS'}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  textTransform: 'capitalize',
                }}
              >
                {user.role.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav" style={{ padding: '16px 12px', flex: 1 }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <i className={`fas ${item.icon}`} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
          <button type="button" className="btn btn-secondary w-full" onClick={handleLogout}>
            <i className="fas fa-sign-out-alt" /> Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-nav">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              <i className={`fas ${sidebarOpen ? 'fa-xmark' : 'fa-bars'}`} />
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Welcome, {user.name}
              </div>
              <div
                className="text-muted text-xs"
                style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {user.email}
              </div>
            </div>
          </div>
        </header>
        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
