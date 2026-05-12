import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { LoadingState, ErrorState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

function statusBadge(status: string) {
  const cls =
    status === 'present' ? 'badge-success' :
    status === 'absent'  ? 'badge-danger' :
    status === 'late'    ? 'badge-warning' : 'badge-neutral';
  return <span className={`badge ${cls}`} style={{ textTransform: 'capitalize' }}>{status}</span>;
}

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const studentId = Number(id);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'student-details', studentId],
    queryFn: () => adminApi.studentDetails(studentId),
    enabled: !Number.isNaN(studentId),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error, 'Student not found')} />;

  const { info, overall, subject_stats, recent, exams, parents } = data;
  const pctColor = overall.percentage >= 75 ? '#10b981' : overall.percentage >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div>
      <PageHeader
        icon="fa-user-graduate"
        title={info.name}
        subtitle={
          info.class_name
            ? `${info.class_name} - ${info.section} · Roll ${info.roll_no ?? '—'}`
            : 'No class assigned'
        }
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
              <i className="fas fa-arrow-left" /> Back
            </button>
            <Link to={`/admin/students/${studentId}/edit`} className="btn btn-primary">
              <i className="fas fa-pen" /> Edit
            </Link>
          </>
        }
      />

      {/* ── 1) Personal / contact info ───────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>
          <i className="fas fa-id-card" style={{ color: 'var(--primary)', marginRight: 8 }} />
          Personal info
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            fontSize: '0.9rem',
          }}
        >
          <Field label="Email" value={info.email} />
          <Field label="Phone" value={info.phone ?? '—'} />
          <Field label="Gender" value={info.gender ? info.gender : '—'} capitalize />
          <Field label="Date of birth" value={info.dob ?? '—'} />
          <Field label="Address" value={info.address ?? '—'} />
          <Field
            label="Status"
            value={info.is_active ? 'Active' : 'Archived'}
            badge={info.is_active ? 'badge-success' : 'badge-danger'}
          />
          <Field label="Academic year" value={info.academic_year ?? '—'} />
          <Field label="Created" value={info.created_at?.slice(0, 10) ?? '—'} />
        </div>

        {parents.length > 0 && (
          <>
            <h4 style={{ marginTop: 20, marginBottom: 10 }}>Linked parents</h4>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {parents.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.email}</td>
                    <td>{p.phone ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* ── 2) Overall attendance summary ─────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <StatCard label="Overall %" value={`${overall.percentage}%`} icon="fa-percent" color={pctColor} />
        <StatCard label="Total" value={overall.total} icon="fa-clipboard-list" color="#6366f1" />
        <StatCard label="Present" value={overall.present} icon="fa-check" color="#10b981" />
        <StatCard label="Absent" value={overall.absent} icon="fa-times" color="#ef4444" />
        <StatCard label="Late" value={overall.late} icon="fa-clock" color="#f59e0b" />
      </div>

      {/* ── 3) Attendance by subject ──────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>
          <i className="fas fa-book" style={{ color: 'var(--primary)', marginRight: 8 }} />
          Attendance by subject
        </h3>
        {subject_stats.length === 0 ? (
          <p className="text-muted">No subjects in this student's class yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th style={{ textAlign: 'center' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>Present</th>
                  <th style={{ textAlign: 'center' }}>Absent</th>
                  <th style={{ textAlign: 'center' }}>Late</th>
                  <th style={{ textAlign: 'center' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {subject_stats.map((s, i) => (
                  <tr key={i}>
                    <td><strong>{s.subject_name}</strong></td>
                    <td style={{ textAlign: 'center' }}>{s.total}</td>
                    <td style={{ textAlign: 'center', color: 'var(--success)' }}>{s.present ?? 0}</td>
                    <td style={{ textAlign: 'center', color: 'var(--danger)' }}>{s.absent ?? 0}</td>
                    <td style={{ textAlign: 'center', color: 'var(--warning)' }}>{s.late ?? 0}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={`badge ${
                          (s.pct ?? 0) >= 75 ? 'badge-success' :
                          (s.pct ?? 0) >= 50 ? 'badge-warning' : 'badge-danger'
                        }`}
                      >
                        {s.pct ?? 0}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 4) Recent attendance (50 most recent) ─────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>
          <i className="fas fa-clock-rotate-left" style={{ color: 'var(--primary)', marginRight: 8 }} />
          Recent attendance ({recent.length})
        </h3>
        {recent.length === 0 ? (
          <p className="text-muted">No attendance records yet.</p>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 400 }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Period</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td>P{r.period_no}</td>
                    <td>{r.subject_name ?? <span className="text-muted">—</span>}</td>
                    <td>{statusBadge(r.status)}</td>
                    <td>{r.remarks ?? <span className="text-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 5) Class history ──────────────────────────────────────────── */}
      <ClassHistorySection studentId={studentId} />

      {/* ── 6) Exam marks history ─────────────────────────────────────── */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          <i className="fas fa-file-lines" style={{ color: 'var(--primary)', marginRight: 8 }} />
          Exam marks
        </h3>
        {exams.length === 0 ? (
          <p className="text-muted">No marks recorded for this student yet.</p>
        ) : (
          exams.map((ex) => {
            const total = ex.subjects.reduce(
              (sum, s) => sum + (Number(s.marks_obtained) || 0),
              0
            );
            return (
              <div
                key={ex.exam_id}
                style={{
                  border: '1px solid var(--border-light)',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div>
                    <strong>{ex.exam_name}</strong>{' '}
                    <span className="text-xs text-muted">· {ex.exam_date}</span>{' '}
                    {ex.is_published ? (
                      <span className="badge badge-success">Published</span>
                    ) : (
                      <span className="badge badge-neutral">Draft</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted text-sm">Total: </span>
                    <strong style={{ color: 'var(--primary)' }}>{total}</strong>
                  </div>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th style={{ textAlign: 'right' }}>Marks</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ex.subjects.map((s, i) => (
                      <tr key={i}>
                        <td>{s.subject_name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{s.marks_obtained ?? '—'}</td>
                        <td>{s.remarks ?? <span className="text-muted">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ClassHistorySection({ studentId }: { studentId: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'student-history', studentId],
    queryFn: () => adminApi.studentHistory(studentId),
  });

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>
        <i className="fas fa-route" style={{ color: 'var(--primary)', marginRight: 8 }} />
        Class history
      </h3>
      {isLoading ? (
        <p className="text-muted" style={{ margin: 0 }}>Loading…</p>
      ) : error ? (
        <p style={{ color: 'var(--danger)', margin: 0 }}>{apiErrorMessage(error)}</p>
      ) : !data || data.length === 0 ? (
        <p className="text-muted" style={{ margin: 0 }}>No promotion or class-change records yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>From</th>
                <th>To</th>
                <th>Year</th>
                <th>Roll</th>
                <th>By</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.map((h) => (
                <tr key={h.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{h.promoted_at.slice(0, 10)}</td>
                  <td>
                    {h.from_class_name ? (
                      <>{h.from_class_name}-{h.from_section}</>
                    ) : (
                      <span className="text-muted">— initial —</span>
                    )}
                  </td>
                  <td>
                    {h.to_class_name ? (
                      <>{h.to_class_name}-{h.to_section}</>
                    ) : (
                      <span className="badge badge-warning">Graduated</span>
                    )}
                  </td>
                  <td>
                    {h.from_academic_year && h.to_academic_year ? (
                      <span>{h.from_academic_year} → {h.to_academic_year}</span>
                    ) : (
                      <span className="text-muted">{h.to_academic_year ?? h.from_academic_year ?? '—'}</span>
                    )}
                  </td>
                  <td>
                    {h.old_roll_no && h.new_roll_no && h.old_roll_no !== h.new_roll_no
                      ? `${h.old_roll_no} → ${h.new_roll_no}`
                      : (h.new_roll_no ?? h.old_roll_no ?? '—')}
                  </td>
                  <td>{h.promoted_by_name ?? <span className="text-muted">system</span>}</td>
                  <td>{h.reason ?? <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  badge,
  capitalize,
}: {
  label: string;
  value: string;
  badge?: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted" style={{ marginBottom: 2 }}>{label}</div>
      {badge ? (
        <span className={`badge ${badge}`}>{value}</span>
      ) : (
        <div style={{ fontWeight: 500, textTransform: capitalize ? 'capitalize' : 'none' }}>
          {value}
        </div>
      )}
    </div>
  );
}
