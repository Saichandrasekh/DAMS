import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { Modal } from '@/components/Modal';
import { apiErrorMessage } from '@/lib/api';

const STATUS_BADGE: Record<string, string> = {
  present: 'badge-success',
  late: 'badge-warning',
  absent: 'badge-danger',
  half_day: 'badge-info',
  on_leave: 'badge-neutral',
};

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TeachersAttendanceReportPage() {
  return (
    <div>
      <PageHeader
        icon="fa-user-check"
        title="Teachers Attendance Report"
        subtitle="Per-teacher attendance over a date range"
      />
      <TeachersAttendanceReport />
    </div>
  );
}

export function TeachersAttendanceReport() {
  const [fromDate, setFromDate] = useState(firstOfMonth());
  const [toDate, setToDate] = useState(todayStr());
  const [selected, setSelected] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'teachers-attendance', fromDate, toDate],
    queryFn: () => adminApi.teachersAttendanceReport({ from_date: fromDate, to_date: toDate }),
  });

  const { data: detail } = useQuery({
    queryKey: ['admin', 'teachers-attendance', 'detail', selected, fromDate, toDate],
    queryFn: () =>
      adminApi.teachersAttendanceReport({ from_date: fromDate, to_date: toDate, teacher_id: selected! }),
    enabled: !!selected,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search) return data.summaries;
    const q = search.toLowerCase();
    return data.summaries.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    );
  }, [data, search]);

  const totals = useMemo(() => {
    if (!data) return null;
    const t = data.summaries.reduce(
      (acc, s) => {
        acc.present += s.present;
        acc.late += s.late;
        acc.absent += s.absent;
        acc.on_leave += s.on_leave;
        acc.pct_sum += s.pct;
        return acc;
      },
      { present: 0, late: 0, absent: 0, on_leave: 0, pct_sum: 0 },
    );
    return {
      ...t,
      avg_pct: data.summaries.length ? Number((t.pct_sum / data.summaries.length).toFixed(1)) : 0,
    };
  }, [data]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={apiErrorMessage(error)} />;
  if (!data) return null;

  return (
    <div>
      <div
        className="text-sm text-muted"
        style={{ marginBottom: 12 }}
      >
        {data.from_date} → {data.to_date} · {data.working_days} working day{data.working_days === 1 ? '' : 's'}{' '}
        (excl. Sundays &amp; holidays)
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">From</label>
            <input
              type="date"
              className="form-control"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">To</label>
            <input
              type="date"
              className="form-control"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search</label>
            <input
              className="form-control"
              placeholder="Name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {totals && data.summaries.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <StatBox label="Teachers" value={String(data.summaries.length)} icon="fa-chalkboard-teacher" />
          <StatBox
            label="Avg attendance"
            value={`${totals.avg_pct}%`}
            icon="fa-percent"
            color={totals.avg_pct >= 75 ? 'var(--success)' : 'var(--danger)'}
          />
          <StatBox label="Total present" value={String(totals.present)} icon="fa-check" color="var(--success)" />
          <StatBox label="Total absent" value={String(totals.absent)} icon="fa-times" color="var(--danger)" />
        </div>
      )}

      <div
        className="text-xs text-muted"
        style={{
          marginBottom: 8,
          padding: 10,
          background: 'var(--background)',
          borderRadius: 8,
          borderLeft: '3px solid var(--primary)',
        }}
      >
        <strong>Attendance %</strong> = (present + late) / days where attendance was recorded.{' '}
        <strong>Not Marked</strong> shows working days nobody marked — flag for action, not a penalty.
      </div>

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <EmptyState icon="fa-chalkboard-teacher" title="No teachers found" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Phone</th>
                  <th style={{ textAlign: 'right' }}>Present</th>
                  <th style={{ textAlign: 'right' }}>Late</th>
                  <th style={{ textAlign: 'right' }}>Absent</th>
                  <th style={{ textAlign: 'right' }}>Leave</th>
                  <th
                    style={{ textAlign: 'right' }}
                    title="Working days in range where no attendance was recorded at all"
                  >
                    Not Marked
                  </th>
                  <th
                    style={{ textAlign: 'right' }}
                    title="(present + late) / days where attendance was actually recorded"
                  >
                    Attendance %
                  </th>
                  <th>Last seen</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.name}</strong>
                      <div className="text-muted text-xs">{t.email}</div>
                    </td>
                    <td>{t.phone ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <strong style={{ color: 'var(--success)' }}>{t.present}</strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>{t.late}</td>
                    <td style={{ textAlign: 'right' }}>
                      <strong style={{ color: t.absent > 0 ? 'var(--danger)' : 'inherit' }}>{t.absent}</strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>{t.on_leave}</td>
                    <td style={{ textAlign: 'right' }}>
                      {t.not_marked > 0 ? (
                        <span className="text-muted">{t.not_marked}</span>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong style={{ color: t.pct >= 75 ? 'var(--success)' : 'var(--danger)' }}>
                        {t.pct}%
                      </strong>
                    </td>
                    <td className="text-sm text-muted">{t.last_date ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelected(t.id)}
                      >
                        <i className="fas fa-eye" /> Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={detail?.detail?.teacher ? `${detail.detail.teacher.name} — Daily History` : 'Loading…'}
        width={640}
      >
        {!detail ? (
          <LoadingState />
        ) : !detail.detail ? (
          <EmptyState icon="fa-calendar-xmark" title="No records" />
        ) : detail.detail.records.length === 0 ? (
          <EmptyState
            icon="fa-calendar-xmark"
            title="No attendance records"
            description={`No entries from ${detail.from_date} to ${detail.to_date}`}
          />
        ) : (
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {detail.detail.records.map((r) => (
                  <tr key={r.date}>
                    <td>{r.date}</td>
                    <td>{r.check_in ?? '—'}</td>
                    <td>{r.check_out ?? '—'}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[r.status] ?? 'badge-neutral'}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="text-sm text-muted">{r.remarks ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatBox({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color?: string;
}) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'var(--background)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: color ?? 'var(--primary)',
            fontSize: '1.2rem',
          }}
        >
          <i className={`fas ${icon}`} />
        </div>
        <div>
          <div className="text-muted text-xs">{label}</div>
          <div style={{ fontWeight: 700, fontSize: '1.15rem', color: color ?? 'var(--text)' }}>{value}</div>
        </div>
      </div>
    </div>
  );
}
