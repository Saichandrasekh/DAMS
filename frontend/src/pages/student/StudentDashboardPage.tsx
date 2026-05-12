import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { studentApi } from '@/api/student';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { LoadingState, ErrorState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

function statusBadge(status: string) {
  const cls = status === 'present' ? 'badge-success' : status === 'absent' ? 'badge-danger' : status === 'late' ? 'badge-warning' : 'badge-neutral';
  return <span className={`badge ${cls}`} style={{ textTransform: 'capitalize' }}>{status}</span>;
}

export function StudentDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['student', 'dashboard'],
    queryFn: () => studentApi.dashboard(),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  const info = data.info;

  return (
    <div>
      <PageHeader
        icon="fa-gauge"
        title={info ? `Hi, ${info.name}` : 'Hi!'}
        subtitle={info?.class_name ? `${info.class_name} - ${info.section} · Roll ${info.roll_no ?? '—'}` : 'Welcome'}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard
          label="Overall attendance"
          value={`${data.overall_pct}%`}
          icon="fa-percent"
          color={data.overall_pct >= 75 ? '#10b981' : data.overall_pct >= 50 ? '#f59e0b' : '#ef4444'}
        />
        <StatCard label="Today" value={data.day_name} icon="fa-calendar-day" color="#6366f1" />
        <StatCard label="Subjects" value={data.subject_stats.length} icon="fa-book" color="#06b6d4" />
        <StatCard label="Records" value={data.recent.length} icon="fa-clipboard-list" color="#8b5cf6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>
              <i className="fas fa-book" style={{ color: 'var(--primary)', marginRight: 8 }} />
              By Subject
            </h3>
            <Link to="/student/attendance" className="btn btn-secondary btn-sm">View full</Link>
          </div>
          {data.subject_stats.length === 0 ? (
            <p className="text-muted">No subjects yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.subject_stats.map((s, i) => (
                <li key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{s.subject_name}</strong>
                    <div className="text-xs text-muted">{s.present ?? 0}/{s.total} classes</div>
                  </div>
                  <span className={`badge ${(s.pct ?? 0) >= 75 ? 'badge-success' : (s.pct ?? 0) >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                    {s.pct ?? 0}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            <i className="fas fa-calendar-day" style={{ color: 'var(--primary)', marginRight: 8 }} />
            Today's Classes
          </h3>
          {data.schedule.length === 0 ? (
            <p className="text-muted">No classes scheduled today.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.schedule.map((s, i) => (
                <li key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>Period {s.period_no}</strong> · {s.subject_name}</span>
                  <span className="text-muted">{s.teacher_name ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          <i className="fas fa-clock-rotate-left" style={{ color: 'var(--primary)', marginRight: 8 }} />
          Recent attendance
        </h3>
        {data.recent.length === 0 ? (
          <p className="text-muted">No records yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Period</th>
                  <th>Subject</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td>P{r.period_no}</td>
                    <td>{r.subject_name ?? <span className="text-muted">—</span>}</td>
                    <td>{statusBadge(r.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
