import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teacherApi } from '@/api/teacher';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

export function AttendanceReportPage() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [classId, setClassId] = useState<number | undefined>();
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [fromDate, setFromDate] = useState(thirtyAgo);
  const [toDate, setToDate] = useState(today);

  const { data, isLoading, error } = useQuery({
    queryKey: ['teacher', 'attendance-report', classId, subjectId, fromDate, toDate],
    queryFn: () => teacherApi.attendanceReport({ class_id: classId, subject_id: subjectId, from_date: fromDate, to_date: toDate }),
  });

  const uniqueClasses = useMemo(() => {
    if (!data) return [];
    const seen = new Set<number>();
    return data.classes.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [data]);

  const subjectsForClass = useMemo(() => {
    if (!classId || !data) return [];
    return data.classes.filter((c) => c.id === classId);
  }, [data, classId]);

  if (isLoading && !data) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  return (
    <div>
      <PageHeader icon="fa-chart-line" title="Attendance Report" subtitle="Per-student attendance summary" />

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label className="form-label">Class</label>
            <select
              className="form-control"
              value={classId ?? ''}
              onChange={(e) => { setClassId(e.target.value ? Number(e.target.value) : undefined); setSubjectId(undefined); }}
            >
              <option value="">— select class —</option>
              {uniqueClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Subject</label>
            <select
              className="form-control"
              value={subjectId ?? ''}
              onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : undefined)}
              disabled={!classId}
            >
              <option value="">— select subject —</option>
              {subjectsForClass.map((s) => (
                <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">From</label>
            <input
              type="date"
              className="form-control"
              value={fromDate}
              max={toDate || today}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">To</label>
            <input
              type="date"
              className="form-control"
              value={toDate}
              min={fromDate}
              max={today}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {!classId || !subjectId ? (
          <EmptyState icon="fa-chart-line" title="Pick class + subject" description="Choose filters above to load the report." />
        ) : data.report.length === 0 ? (
          <EmptyState icon="fa-chart-line" title="No data" description="No attendance records in this range." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Name</th>
                  <th style={{ textAlign: 'center' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>Present</th>
                  <th style={{ textAlign: 'center' }}>Absent</th>
                  <th style={{ textAlign: 'center' }}>Late</th>
                  <th style={{ textAlign: 'center' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {data.report.map((r) => (
                  <tr key={r.student_id}>
                    <td>{r.roll_no ?? '—'}</td>
                    <td><strong>{r.name}</strong></td>
                    <td style={{ textAlign: 'center' }}>{r.total_classes}</td>
                    <td style={{ textAlign: 'center', color: 'var(--success)' }}>{r.present ?? 0}</td>
                    <td style={{ textAlign: 'center', color: 'var(--danger)' }}>{r.absent ?? 0}</td>
                    <td style={{ textAlign: 'center', color: 'var(--warning)' }}>{r.late ?? 0}</td>
                    <td style={{ textAlign: 'center' }}>
                      {r.percentage != null ? (
                        <span
                          className={`badge ${r.percentage >= 75 ? 'badge-success' : r.percentage >= 50 ? 'badge-warning' : 'badge-danger'}`}
                        >
                          {r.percentage}%
                        </span>
                      ) : <span className="text-muted">—</span>}
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
