import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parentApi } from '@/api/parent';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { Modal } from '@/components/Modal';
import { apiErrorMessage } from '@/lib/api';

function statusBadge(status: string) {
  const cls = status === 'present' ? 'badge-success' : status === 'absent' ? 'badge-danger' : status === 'late' ? 'badge-warning' : 'badge-neutral';
  return <span className={`badge ${cls}`} style={{ textTransform: 'capitalize' }}>{status}</span>;
}

export function ParentDashboardPage() {
  const [viewing, setViewing] = useState<{ id: number; name: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['parent', 'dashboard'],
    queryFn: () => parentApi.dashboard(),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  return (
    <div>
      <PageHeader icon="fa-gauge" title="Parent Dashboard" subtitle={`${data.children.length} child${data.children.length === 1 ? '' : 'ren'}`} />

      {data.alerts.length > 0 && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--warning-light)', borderLeft: '4px solid var(--warning)' }}>
          <h3 style={{ marginTop: 0, color: 'var(--warning-dark)' }}>
            <i className="fas fa-triangle-exclamation" /> Attendance below 75%
          </h3>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {data.alerts.map((a) => (
              <li key={a.student_id}>
                <strong>{a.student_name}</strong> — <span style={{ color: 'var(--warning-dark)' }}>{a.percentage}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>
          <i className="fas fa-children" style={{ color: 'var(--primary)', marginRight: 8 }} />
          My Children
        </h3>
        {data.children.length === 0 ? (
          <EmptyState icon="fa-children" title="No children linked" description="Ask the school admin to link your child's account." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {data.children.map((c) => (
              <div key={c.id} className="card" style={{ padding: 16 }}>
                <h4 style={{ margin: '0 0 4px 0' }}>{c.name}</h4>
                <div className="text-muted text-sm">{c.class_name} - {c.section}</div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="text-xs text-muted">Attendance</div>
                    <div
                      style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        color: c.percentage >= 75 ? 'var(--success)' : c.percentage >= 50 ? 'var(--warning)' : 'var(--danger)',
                      }}
                    >
                      {c.percentage}%
                    </div>
                    <div className="text-xs text-muted">{c.present}/{c.total} classes</div>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setViewing({ id: c.id, name: c.name })}>
                    <i className="fas fa-eye" /> View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          <i className="fas fa-clock-rotate-left" style={{ color: 'var(--primary)', marginRight: 8 }} />
          Recent Activity
        </h3>
        {data.recent_attendance.length === 0 ? (
          <p className="text-muted">No recent attendance.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Child</th>
                  <th>Subject</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_attendance.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td><strong>{r.student_name}</strong></td>
                    <td>{r.subject_name ?? <span className="text-muted">—</span>}</td>
                    <td>{statusBadge(r.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `${viewing.name}'s Attendance` : ''} width={640}>
        {viewing && <ChildReportContent studentId={viewing.id} />}
      </Modal>
    </div>
  );
}

function ChildReportContent({ studentId }: { studentId: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['parent', 'child', studentId],
    queryFn: () => parentApi.childReport(studentId),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  return (
    <div>
      {data.attendance.length === 0 ? (
        <p className="text-muted">No attendance records yet.</p>
      ) : (
        <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
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
              {data.attendance.map((a, i) => (
                <tr key={i}>
                  <td>{a.date}</td>
                  <td>P{a.period_no}</td>
                  <td>{a.subject_name ?? <span className="text-muted">—</span>}</td>
                  <td>{statusBadge(a.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
