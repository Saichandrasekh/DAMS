import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentApi } from '@/api/student';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

function statusBadge(status: string) {
  const cls = status === 'present' ? 'badge-success' : status === 'absent' ? 'badge-danger' : status === 'late' ? 'badge-warning' : 'badge-neutral';
  return <span className={`badge ${cls}`} style={{ textTransform: 'capitalize' }}>{status}</span>;
}

export function StudentAttendancePage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [subjectId, setSubjectId] = useState<number | undefined>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['student', 'attendance', month, subjectId],
    queryFn: () => studentApi.attendance({ month, subject_id: subjectId }),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  const presentCount = data.records.filter((r) => r.status === 'present').length;
  const absentCount = data.records.filter((r) => r.status === 'absent').length;
  const total = data.records.length;
  const pct = total > 0 ? Math.round((presentCount / total) * 1000) / 10 : 0;

  return (
    <div>
      <PageHeader icon="fa-user-check" title="My Attendance" subtitle="Filter by month and subject" />

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label className="form-label">Month</label>
            <input type="month" className="form-control" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Subject</label>
            <select className="form-control" value={subjectId ?? ''} onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">All subjects</option>
              {data.subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {total > 0 && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-around', textAlign: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="text-muted text-sm">Total</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{total}</div>
          </div>
          <div>
            <div className="text-muted text-sm">Present</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{presentCount}</div>
          </div>
          <div>
            <div className="text-muted text-sm">Absent</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>{absentCount}</div>
          </div>
          <div>
            <div className="text-muted text-sm">Percentage</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)' }}>{pct}%</div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {data.records.length === 0 ? (
          <EmptyState icon="fa-clipboard-list" title="No records" description="No attendance recorded for this filter." />
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
                {data.records.map((r, i) => (
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
