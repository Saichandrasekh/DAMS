import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { teacherApi } from '@/api/teacher';
import type { StaffStatus } from '@/api/teacher';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { LoadingState, ErrorState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

const STATUS_LABEL: Record<StaffStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  half_day: 'Half day',
  on_leave: 'On leave',
};

const STATUS_BADGE: Record<StaffStatus, string> = {
  present: 'badge-success',
  late: 'badge-warning',
  absent: 'badge-danger',
  half_day: 'badge-info',
  on_leave: 'badge-neutral',
};

export function TeacherDashboardPage() {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['teacher', 'dashboard'],
    queryFn: () => teacherApi.dashboard(),
  });

  const { data: att } = useQuery({
    queryKey: ['teacher', 'attendance-me'],
    queryFn: () => teacherApi.myAttendance(),
  });

  const checkinMutation = useMutation({
    mutationFn: () => teacherApi.checkin(),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['teacher', 'attendance-me'] });
      const isCheckIn = resp.action === 'check_in';
      Swal.fire({
        icon: 'success',
        title: isCheckIn ? 'Checked In' : 'Checked Out',
        text: resp.message,
        timer: 1800,
        showConfirmButton: false,
      });
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  const present = data.today_summary?.present ?? 0;
  const absent = data.today_summary?.absent ?? 0;
  const total = data.today_summary?.total ?? 0;

  const today = att?.today ?? null;
  const checkedIn = !!today?.check_in;
  const checkedOut = !!today?.check_out;
  const nextAction = !checkedIn ? 'check_in' : !checkedOut ? 'check_out' : 'done';
  const buttonLabel =
    nextAction === 'check_in' ? 'Check In' : nextAction === 'check_out' ? 'Check Out' : 'Done for today';

  return (
    <div>
      <PageHeader
        icon="fa-gauge"
        title={`${data.day_name}, ${new Date(data.today).toLocaleDateString()}`}
        subtitle="Your day at a glance"
      />

      {/* CHECK-IN CARD */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <TimeBlock
              label="Check-in"
              time={today?.check_in ?? null}
              icon="fa-arrow-right-to-bracket"
              color="var(--success)"
            />
            <TimeBlock
              label="Check-out"
              time={today?.check_out ?? null}
              icon="fa-arrow-right-from-bracket"
              color="var(--danger)"
            />
            <div>
              <div className="text-muted text-xs">Status</div>
              <div style={{ marginTop: 4 }}>
                {today?.status ? (
                  <span className={`badge ${STATUS_BADGE[today.status]}`}>{STATUS_LABEL[today.status]}</span>
                ) : (
                  <span className="badge badge-neutral">Not checked in</span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            className={`btn ${nextAction === 'check_out' ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => checkinMutation.mutate()}
            disabled={checkinMutation.isPending || nextAction === 'done'}
            style={{ minWidth: 160 }}
          >
            {checkinMutation.isPending ? (
              <>
                <i className="fas fa-spinner fa-spin" /> Saving…
              </>
            ) : nextAction === 'done' ? (
              <>
                <i className="fas fa-check" /> {buttonLabel}
              </>
            ) : (
              <>
                <i className={`fas ${nextAction === 'check_in' ? 'fa-clock' : 'fa-right-from-bracket'}`} />{' '}
                {buttonLabel}
              </>
            )}
          </button>
        </div>

        {att?.month_summary && (
          <div
            style={{
              marginTop: 16,
              paddingTop: 12,
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>
              This month:{' '}
              <strong style={{ color: 'var(--success)' }}>{att.month_summary.present ?? 0} present</strong>
            </span>
            <span>·</span>
            <span>
              <strong style={{ color: 'var(--warning)' }}>{att.month_summary.late ?? 0}</strong> late
            </span>
            <span>·</span>
            <span>
              <strong style={{ color: 'var(--danger)' }}>{att.month_summary.absent ?? 0}</strong> absent
            </span>
            <span>·</span>
            <span>
              <strong>{att.month_summary.on_leave ?? 0}</strong> on leave
            </span>
          </div>
        )}
      </div>

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

      {/* RECENT ATTENDANCE HISTORY */}
      {att && att.history.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>
            <i className="fas fa-clock-rotate-left" style={{ color: 'var(--primary)', marginRight: 8 }} />
            My Recent Attendance
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {att.history.slice(0, 10).map((r) => (
                  <tr key={r.date}>
                    <td>{r.date}</td>
                    <td>{r.check_in ?? '—'}</td>
                    <td>{r.check_out ?? '—'}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

function TimeBlock({
  label,
  time,
  icon,
  color,
}: {
  label: string;
  time: string | null;
  icon: string;
  color: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'var(--background)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: time ? color : 'var(--text-muted)',
          fontSize: '1.1rem',
        }}
      >
        <i className={`fas ${icon}`} />
      </div>
      <div>
        <div className="text-muted text-xs">{label}</div>
        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{time ?? '—'}</div>
      </div>
    </div>
  );
}
