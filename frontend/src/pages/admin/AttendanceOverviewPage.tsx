import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { Modal } from '@/components/Modal';
import { apiErrorMessage } from '@/lib/api';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function AttendanceOverviewPage() {
  const [date, setDate] = useState(todayStr);
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
        title="Attendance Overview"
        subtitle={`Pick any date to see who came, who didn't, and what's not yet marked`}
      />

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
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => {
            const d = new Date(date);
            d.setDate(d.getDate() - 1);
            setDate(d.toISOString().slice(0, 10));
          }}>
            <i className="fas fa-chevron-left" /> Day
          </button>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => {
            const d = new Date(date);
            d.setDate(d.getDate() + 1);
            const next = d.toISOString().slice(0, 10);
            if (next <= todayStr()) setDate(next);
          }}>
            Day <i className="fas fa-chevron-right" />
          </button>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => refetch()}>
            <i className="fas fa-rotate-right" /> Refresh
          </button>
        </div>
      </div>

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
            By class — {date}
          </h3>
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
                  const allMarked = c.not_marked === 0 && c.enrolled > 0;
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        {c.section && <> - {c.section}</>}
                        {c.academic_year && <div className="text-xs text-muted">{c.academic_year}</div>}
                      </td>
                      <td style={{ textAlign: 'center' }}>{c.enrolled}</td>
                      <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 600 }}>{c.present}</td>
                      <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: 600 }}>{c.absent}</td>
                      <td style={{ textAlign: 'center', color: 'var(--warning)' }}>{c.late}</td>
                      <td style={{ textAlign: 'center', color: c.not_marked > 0 ? 'var(--text-muted)' : 'var(--success)' }}>
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
                          onClick={() => setDrill({ id: c.id, label: `${c.name}${c.section ? ' - ' + c.section : ''}` })}
                          disabled={c.enrolled === 0}
                        >
                          <i className="fas fa-list" /> Names
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

      <Modal
        open={!!drill}
        onClose={() => setDrill(null)}
        title={drill ? `${drill.label} · ${date}` : ''}
        width={680}
      >
        {drill && <ClassDetailBuckets classId={drill.id} date={date} />}
      </Modal>
    </div>
  );
}

function ClassDetailBuckets({ classId, date }: { classId: number; date: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'attendance-class', classId, date],
    queryFn: () => adminApi.attendanceClassDetail(classId, date),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  const { buckets } = data;
  const lists: { key: keyof typeof buckets; label: string; color: string; icon: string }[] = [
    { key: 'present',    label: 'Present',    color: 'var(--success)', icon: 'fa-check' },
    { key: 'late',       label: 'Late',       color: 'var(--warning)', icon: 'fa-clock' },
    { key: 'absent',     label: 'Absent',     color: 'var(--danger)',  icon: 'fa-times' },
    { key: 'not_marked', label: 'Not marked', color: 'var(--text-muted)', icon: 'fa-circle-question' },
  ];

  return (
    <div>
      {lists.map((g) => {
        const list = buckets[g.key];
        return (
          <div key={g.key} style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 6, color: g.color }}>
              <i className={`fas ${g.icon}`} /> {g.label} <span className="text-muted text-sm">({list.length})</span>
            </h4>
            {list.length === 0 ? (
              <p className="text-muted text-sm" style={{ margin: 0, paddingLeft: 22 }}>—</p>
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
                        <div className="text-xs text-muted" style={{ marginTop: 2 }}>“{s.remarks}”</div>
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
