import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { Modal } from '@/components/Modal';
import { apiErrorMessage } from '@/lib/api';

const STAFF_STATUS_OPTIONS = ['present', 'late', 'half_day', 'on_leave', 'absent'] as const;

const STAFF_STATUS_BADGE: Record<string, string> = {
  present: 'badge-success',
  late: 'badge-warning',
  absent: 'badge-danger',
  half_day: 'badge-info',
  on_leave: 'badge-neutral',
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

type TabKey = 'students' | 'staff';

export function AttendanceOverviewPage() {
  const [date, setDate] = useState(todayStr);
  const [tab, setTab] = useState<TabKey>('students');
  const [drill, setDrill] = useState<{ id: number; label: string } | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'attendance-overview', date],
    queryFn: () => adminApi.attendanceOverview(date),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  const t = data.totals;
  const pctColor = t.attendance_pct >= 75 ? '#10b981' : t.attendance_pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div>
      <PageHeader
        icon="fa-clipboard-check"
        title="Attendance Today"
        subtitle="Pick any date to see who came, who didn't, and what's not yet marked — for students and staff."
      />

      {/* DATE BAR */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label className="form-label">Date</label>
          <input
            type="date"
            className="form-control"
            style={{ maxWidth: 220 }}
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setDate(todayStr())}>
            Today
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => {
              const d = new Date(date);
              d.setDate(d.getDate() - 1);
              setDate(d.toISOString().slice(0, 10));
            }}
          >
            <i className="fas fa-chevron-left" /> Day
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => {
              const d = new Date(date);
              d.setDate(d.getDate() + 1);
              const next = d.toISOString().slice(0, 10);
              if (next <= todayStr()) setDate(next);
            }}
          >
            Day <i className="fas fa-chevron-right" />
          </button>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => refetch()}>
            <i className="fas fa-rotate-right" /> Refresh
          </button>
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <TabButton active={tab === 'students'} onClick={() => setTab('students')} icon="fa-user-graduate">
          Students
        </TabButton>
        <TabButton active={tab === 'staff'} onClick={() => setTab('staff')} icon="fa-chalkboard-teacher">
          Staff
        </TabButton>
      </div>

      {tab === 'students' ? (
        <>
          {/* Roll-up totals */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 16,
              marginBottom: 16,
            }}
          >
            <StatCard label="Enrolled" value={t.enrolled} icon="fa-users" color="#6366f1" />
            <StatCard label="Present" value={t.present} icon="fa-check" color="#10b981" />
            <StatCard label="Absent" value={t.absent} icon="fa-times" color="#ef4444" />
            <StatCard label="Late" value={t.late} icon="fa-clock" color="#f59e0b" />
            <StatCard label="Not marked yet" value={t.not_marked} icon="fa-circle-question" color="#94a3b8" />
            <StatCard label="Attendance %" value={`${t.attendance_pct}%`} icon="fa-percent" color={pctColor} />
          </div>

          {/* Per-class breakdown */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: 16, borderBottom: '1px solid var(--border-light)' }}>
              <h3 style={{ margin: 0 }}>
                <i className="fas fa-school" style={{ color: 'var(--primary)', marginRight: 8 }} />
                Section-wise — {date}
              </h3>
              <p className="text-sm text-muted" style={{ margin: '4px 0 0 0' }}>
                Click <strong>Details</strong> on any class to see who attended which period.
              </p>
            </div>
            {data.classes.length === 0 ? (
              <EmptyState icon="fa-school" title="No classes yet" />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th style={{ textAlign: 'center' }}>Enrolled</th>
                      <th style={{ textAlign: 'center' }}>Present</th>
                      <th style={{ textAlign: 'center' }}>Absent</th>
                      <th style={{ textAlign: 'center' }}>Late</th>
                      <th style={{ textAlign: 'center' }}>Not marked</th>
                      <th style={{ textAlign: 'center' }}>%</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.classes.map((c) => {
                      const pct = c.enrolled > 0 ? Math.round((c.present / c.enrolled) * 1000) / 10 : 0;
                      const cls = pct >= 75 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-danger';
                      return (
                        <tr key={c.id}>
                          <td>
                            <strong>{c.name}</strong>
                            {c.section && <> - {c.section}</>}
                            {c.academic_year && <div className="text-xs text-muted">{c.academic_year}</div>}
                          </td>
                          <td style={{ textAlign: 'center' }}>{c.enrolled}</td>
                          <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 600 }}>
                            {c.present}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: 600 }}>
                            {c.absent}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--warning)' }}>{c.late}</td>
                          <td
                            style={{
                              textAlign: 'center',
                              color: c.not_marked > 0 ? 'var(--text-muted)' : 'var(--success)',
                            }}
                          >
                            {c.not_marked === 0 && c.enrolled > 0 ? '✓ all done' : c.not_marked}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {c.enrolled > 0 ? (
                              <span className={`badge ${cls}`}>{pct}%</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() =>
                                setDrill({ id: c.id, label: `${c.name}${c.section ? ' - ' + c.section : ''}` })
                              }
                              disabled={c.enrolled === 0}
                            >
                              <i className="fas fa-list" /> Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <StaffSection date={date} />
      )}

      <Modal
        open={!!drill}
        onClose={() => setDrill(null)}
        title={drill ? `${drill.label} · ${date}` : ''}
        width={900}
      >
        {drill && <ClassDrillDown classId={drill.id} date={date} />}
      </Modal>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 16px',
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
        color: active ? 'var(--primary)' : 'var(--text-muted)',
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
        marginBottom: -1,
      }}
    >
      <i className={`fas ${icon}`} style={{ marginRight: 8 }} />
      {children}
    </button>
  );
}

// ─── CLASS DRILLDOWN: buckets + per-period grid ─────────────────────────────
function ClassDrillDown({ classId, date }: { classId: number; date: string }) {
  const [view, setView] = useState<'summary' | 'period'>('period');
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'attendance-class', classId, date],
    queryFn: () => adminApi.attendanceClassDetail(classId, date),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <TabButton active={view === 'period'} onClick={() => setView('period')} icon="fa-table-list">
          Period grid
        </TabButton>
        <TabButton active={view === 'summary'} onClick={() => setView('summary')} icon="fa-users">
          Summary buckets
        </TabButton>
      </div>

      {view === 'period' ? <PeriodGrid data={data} /> : <BucketsView data={data} />}
    </div>
  );
}

function PeriodGrid({
  data,
}: {
  data: ReturnType<typeof adminApi.attendanceClassDetail> extends Promise<infer T> ? T : never;
}) {
  const periods = Array.from({ length: data.periods }, (_, i) => i + 1);

  if (data.students.length === 0) {
    return <EmptyState icon="fa-user-slash" title="No students enrolled" />;
  }

  const ROLL_W = 110;
  const STUDENT_W = 200;
  const stickyShadow = '2px 0 4px -2px rgba(15, 23, 42, 0.12)';

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ marginBottom: 8, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.8rem' }}>
        <LegendDot color="var(--success)" label="Present" />
        <LegendDot color="var(--warning)" label="Late" />
        <LegendDot color="var(--danger)" label="Absent" />
        <LegendDot color="#cbd5e1" label="Not marked" />
      </div>
      <table style={{ minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            <th
              style={{
                position: 'sticky',
                left: 0,
                background: 'var(--surface)',
                zIndex: 3,
                width: ROLL_W,
                minWidth: ROLL_W,
              }}
            >
              Roll
            </th>
            <th
              style={{
                position: 'sticky',
                left: ROLL_W,
                background: 'var(--surface)',
                zIndex: 3,
                width: STUDENT_W,
                minWidth: STUDENT_W,
                boxShadow: stickyShadow,
              }}
            >
              Student
            </th>
            {periods.map((p) => (
              <th key={p} style={{ textAlign: 'center', minWidth: 80, background: 'var(--surface)' }}>
                P{p}
                {data.timetable[p] && (
                  <div className="text-muted text-xs" style={{ fontWeight: 400 }}>
                    {data.timetable[p]}
                  </div>
                )}
              </th>
            ))}
            <th style={{ textAlign: 'center', background: 'var(--surface)' }}>P / L / A</th>
          </tr>
        </thead>
        <tbody>
          {data.students.map((s) => (
            <tr key={s.id}>
              <td
                style={{
                  position: 'sticky',
                  left: 0,
                  background: 'var(--surface)',
                  zIndex: 2,
                  width: ROLL_W,
                  minWidth: ROLL_W,
                  fontSize: '0.85rem',
                }}
              >
                {s.roll_no ?? '—'}
              </td>
              <td
                style={{
                  position: 'sticky',
                  left: ROLL_W,
                  background: 'var(--surface)',
                  zIndex: 2,
                  width: STUDENT_W,
                  minWidth: STUDENT_W,
                  whiteSpace: 'nowrap',
                  boxShadow: stickyShadow,
                }}
              >
                <strong>{s.name}</strong>
                {s.phone && (
                  <div className="text-muted text-xs">
                    <i className="fas fa-phone" /> {s.phone}
                  </div>
                )}
              </td>
              {s.periods.map((p) => (
                <PeriodCell key={p.period_no} status={p.status} subject={p.subject_name} remarks={p.remarks} />
              ))}
              <td style={{ textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--success)' }}>{s.present_count}</span>
                {' / '}
                <span style={{ color: 'var(--warning)' }}>{s.late_count}</span>
                {' / '}
                <span style={{ color: 'var(--danger)' }}>{s.absent_count}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeriodCell({
  status,
  subject,
  remarks,
}: {
  status: string;
  subject: string | null;
  remarks: string | null;
}) {
  const colorMap: Record<string, string> = {
    present: 'var(--success)',
    late: 'var(--warning)',
    absent: 'var(--danger)',
    not_marked: '#cbd5e1',
    leave: '#94a3b8',
    excused: '#94a3b8',
  };
  const letter = status === 'not_marked' ? '·' : status[0].toUpperCase();
  const title = [
    status.replace('_', ' '),
    subject ? `(${subject})` : null,
    remarks ? `— ${remarks}` : null,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <td style={{ textAlign: 'center', padding: 4 }}>
      <div
        title={title}
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: colorMap[status] ?? '#cbd5e1',
          color: status === 'not_marked' ? '#64748b' : 'white',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.85rem',
        }}
      >
        {letter}
      </div>
    </td>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span
        style={{ width: 12, height: 12, borderRadius: 3, background: color, display: 'inline-block' }}
      />
      {label}
    </span>
  );
}

function BucketsView({
  data,
}: {
  data: ReturnType<typeof adminApi.attendanceClassDetail> extends Promise<infer T> ? T : never;
}) {
  const { buckets } = data;
  const lists: { key: keyof typeof buckets; label: string; color: string; icon: string }[] = [
    { key: 'present', label: 'Present', color: 'var(--success)', icon: 'fa-check' },
    { key: 'late', label: 'Late', color: 'var(--warning)', icon: 'fa-clock' },
    { key: 'absent', label: 'Absent', color: 'var(--danger)', icon: 'fa-times' },
    { key: 'not_marked', label: 'Not marked', color: 'var(--text-muted)', icon: 'fa-circle-question' },
  ];

  return (
    <div>
      {lists.map((g) => {
        const list = buckets[g.key];
        return (
          <div key={g.key} style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 6, color: g.color }}>
              <i className={`fas ${g.icon}`} /> {g.label}{' '}
              <span className="text-muted text-sm">({list.length})</span>
            </h4>
            {list.length === 0 ? (
              <p className="text-muted text-sm" style={{ margin: 0, paddingLeft: 22 }}>
                —
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {list.map((s) => (
                  <li
                    key={s.id}
                    style={{
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--border-light)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontSize: '0.9rem',
                    }}
                  >
                    <div>
                      <strong>{s.name}</strong>
                      {s.roll_no && <span className="text-muted"> · Roll {s.roll_no}</span>}
                      {s.remarks && (
                        <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                          "{s.remarks}"
                        </div>
                      )}
                    </div>
                    {s.phone && (
                      <a
                        href={`tel:${s.phone}`}
                        className="text-muted text-xs"
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        <i className="fas fa-phone" style={{ marginRight: 4 }} />
                        {s.phone}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── STAFF SECTION (inline replacement for the dedicated Staff Attendance page) ──
function StaffSection({ date }: { date: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'attendance-staff', date],
    queryFn: () => adminApi.attendanceStaff(date),
  });

  const markMutation = useMutation({
    mutationFn: (input: { staff_id: number; date: string; status: string }) =>
      adminApi.markStaff(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'attendance-staff'] }),
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.staff.filter((s) => {
      if (roleFilter && s.role !== roleFilter) return false;
      if (search && !s.staff_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data, search, roleFilter]);

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  const t = data.totals;
  const pct = t.total ? Math.round((100 * (t.present + t.late)) / t.total * 10) / 10 : 0;

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <StatCard label="Total staff" value={t.total} icon="fa-users" color="#6366f1" />
        <StatCard label="Present" value={t.present} icon="fa-check" color="#10b981" />
        <StatCard label="Late" value={t.late} icon="fa-clock" color="#f59e0b" />
        <StatCard label="Absent" value={t.absent} icon="fa-times" color="#ef4444" />
        <StatCard label="On leave" value={t.on_leave} icon="fa-suitcase" color="#94a3b8" />
        <StatCard label="Not marked" value={t.not_marked} icon="fa-circle-question" color="#cbd5e1" />
        <StatCard
          label="Attendance %"
          value={`${pct}%`}
          icon="fa-percent"
          color={pct >= 75 ? '#10b981' : '#ef4444'}
        />
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search</label>
            <input
              className="form-control"
              placeholder="Name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Role</label>
            <select
              className="form-control"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="teacher">Teachers</option>
              <option value="admin">Admins</option>
              <option value="principal">Principal</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <EmptyState icon="fa-chalkboard-teacher" title="No staff" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Status</th>
                  <th>Set</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.staff_id}>
                    <td>
                      <strong>{s.staff_name}</strong>
                      {s.phone && <div className="text-muted text-xs">{s.phone}</div>}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{s.role}</td>
                    <td>{s.check_in ?? '—'}</td>
                    <td>{s.check_out ?? '—'}</td>
                    <td>
                      {s.status ? (
                        <span className={`badge ${STAFF_STATUS_BADGE[s.status] ?? 'badge-neutral'}`}>
                          {s.status.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="badge badge-neutral">Not marked</span>
                      )}
                    </td>
                    <td>
                      <select
                        className="form-control"
                        style={{ maxWidth: 160 }}
                        value={s.status ?? ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            markMutation.mutate({
                              staff_id: s.staff_id,
                              date,
                              status: e.target.value,
                            });
                          }
                        }}
                      >
                        <option value="">— mark —</option>
                        {STAFF_STATUS_OPTIONS.map((st) => (
                          <option key={st} value={st}>
                            {st.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
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
