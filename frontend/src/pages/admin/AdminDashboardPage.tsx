import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { LoadingState, ErrorState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

export function AdminDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => adminApi.dashboard(),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  return (
    <div>
      <PageHeader
        icon="fa-gauge"
        title={data.school?.name ? `${data.school.name} — Overview` : 'Overview'}
        subtitle="Today's attendance & school totals"
        actions={
          <Link to="/admin/students" className="btn btn-primary">
            <i className="fas fa-user-graduate" /> Manage Students
          </Link>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Students" value={data.stats.students} icon="fa-user-graduate" color="#6366f1" />
        <StatCard label="Teachers" value={data.stats.teachers} icon="fa-chalkboard-teacher" color="#f59e0b" />
        <StatCard label="Classes" value={data.stats.classes} icon="fa-school" color="#06b6d4" />
        <StatCard label="Present today" value={data.stats.today_present} icon="fa-check" color="#10b981" />
        <StatCard label="Absent today" value={data.stats.today_absent} icon="fa-times" color="#ef4444" />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          <i className="fas fa-clipboard-list" style={{ color: 'var(--primary)', marginRight: 8 }} />
          Recent Activity
        </h3>
        {data.recent_logs.length === 0 ? (
          <p className="text-muted">No activity yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {data.recent_logs.map((log) => (
              <li key={log.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <strong>{log.action}</strong>
                  {log.details && <span className="text-muted"> — {log.details}</span>}
                  <div className="text-xs text-muted">{log.user_name ?? 'system'}</div>
                </div>
                <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
