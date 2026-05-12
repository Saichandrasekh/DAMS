import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { superadminApi } from '@/api/superadmin';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { LoadingState, ErrorState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

export function SuperadminDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['superadmin', 'dashboard'],
    queryFn: () => superadminApi.dashboard(),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  return (
    <div>
      <PageHeader
        icon="fa-gauge"
        title="Platform Overview"
        subtitle="System-wide metrics across all schools"
        actions={
          <Link to="/superadmin/schools/new" className="btn btn-primary">
            <i className="fas fa-plus" /> Add School
          </Link>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard label="Schools" value={data.totals.schools} icon="fa-building" color="#6366f1" />
        <StatCard label="Total Users" value={data.totals.users} icon="fa-users" color="#10b981" />
        <StatCard label="Teachers" value={data.totals.teachers} icon="fa-chalkboard-teacher" color="#f59e0b" />
        <StatCard label="Students" value={data.totals.students} icon="fa-user-graduate" color="#06b6d4" />
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>
            <i className="fas fa-school" style={{ color: 'var(--primary)', marginRight: 8 }} />
            Schools
          </h3>
          <Link to="/superadmin/schools" className="btn btn-secondary btn-sm">View all</Link>
        </div>
        {data.schools.length === 0 ? (
          <p className="text-muted">No schools yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Students</th>
                  <th>Teachers</th>
                </tr>
              </thead>
              <tbody>
                {data.schools.slice(0, 5).map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td><code>{s.code}</code></td>
                    <td>{s.student_count ?? 0}</td>
                    <td>{s.teacher_count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 16px 0' }}>
          <i className="fas fa-clipboard-list" style={{ color: 'var(--primary)', marginRight: 8 }} />
          Recent Activity
        </h3>
        {data.recent_logs.length === 0 ? (
          <p className="text-muted">No activity yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {data.recent_logs.map((log) => (
              <li
                key={log.id}
                style={{
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border-light)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div>
                  <strong>{log.action}</strong>
                  {log.details && <span className="text-muted"> — {log.details}</span>}
                  <div className="text-xs text-muted">
                    {log.user_name ?? 'system'}
                    {log.school_name ? ` · ${log.school_name}` : ''}
                  </div>
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
