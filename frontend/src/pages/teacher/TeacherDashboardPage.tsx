import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { teacherApi } from '@/api/teacher';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { LoadingState, ErrorState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

export function TeacherDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['teacher', 'dashboard'],
    queryFn: () => teacherApi.dashboard(),
  });

  const checkinMutation = useMutation({
    mutationFn: () => teacherApi.checkin(),
    onSuccess: (resp) => Swal.fire({ icon: 'success', title: resp.message, text: resp.time, timer: 1800, showConfirmButton: false }),
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  const present = data.today_summary?.present ?? 0;
  const absent = data.today_summary?.absent ?? 0;
  const total = data.today_summary?.total ?? 0;

  return (
    <div>
      <PageHeader
        icon="fa-gauge"
        title={`${data.day_name}, ${new Date(data.today).toLocaleDateString()}`}
        subtitle="Your day at a glance"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => checkinMutation.mutate()} disabled={checkinMutation.isPending}>
            <i className="fas fa-clock" /> Check in/out
          </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="My classes" value={data.my_classes.length} icon="fa-chalkboard" color="#6366f1" />
        <StatCard label="Marked today" value={total} icon="fa-list-check" color="#06b6d4" />
        <StatCard label="Present today" value={present} icon="fa-check" color="#10b981" />
        <StatCard label="Absent today" value={absent} icon="fa-times" color="#ef4444" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>
              <i className="fas fa-chalkboard" style={{ color: 'var(--primary)', marginRight: 8 }} />
              My Classes
            </h3>
            <Link to="/teacher/my-classes" className="btn btn-secondary btn-sm">View all</Link>
          </div>
          {data.my_classes.length === 0 ? (
            <p className="text-muted">No classes assigned.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.my_classes.slice(0, 6).map((c) => (
                <li key={`${c.id}-${c.subject_id}`} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <strong>{c.name} - {c.section}</strong>
                  <span className="text-muted"> · {c.subject_name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            <i className="fas fa-calendar-day" style={{ color: 'var(--primary)', marginRight: 8 }} />
            Today's Schedule
          </h3>
          {data.my_schedule.length === 0 ? (
            <p className="text-muted">No classes scheduled today.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.my_schedule.map((s, i) => (
                <li key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>Period {s.period_no}</strong> · {s.class_name}-{s.section}</span>
                  <span className="text-muted">{s.subject_name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Quick actions</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/teacher/mark-attendance" className="btn btn-primary">
            <i className="fas fa-user-check" /> Mark Attendance
          </Link>
          <Link to="/teacher/marks-entry" className="btn btn-secondary">
            <i className="fas fa-pen-to-square" /> Enter Marks
          </Link>
          <Link to="/teacher/attendance-report" className="btn btn-secondary">
            <i className="fas fa-chart-line" /> View Reports
          </Link>
          <Link to="/teacher/timetable" className="btn btn-secondary">
            <i className="fas fa-calendar-alt" /> My Timetable
          </Link>
        </div>
      </div>
    </div>
  );
}
