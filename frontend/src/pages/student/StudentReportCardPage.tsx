import { useQuery } from '@tanstack/react-query';
import { studentApi } from '@/api/student';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

export function StudentReportCardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['student', 'report-card'],
    queryFn: () => studentApi.reportCard(),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  const exams = data.exams ?? [];

  return (
    <div>
      <PageHeader icon="fa-file-lines" title="Report Card" subtitle="Published exam results" />

      {exams.length === 0 ? (
        <div className="card">
          <EmptyState icon="fa-file-lines" title="No results yet" description="Your teacher will publish results soon." />
        </div>
      ) : (
        exams.map((exam) => {
          const marks = data.results[exam.id] ?? [];
          const total = marks.reduce((sum, m) => sum + (Number(m.marks_obtained) || 0), 0);
          return (
            <div key={exam.id} className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{exam.name}</h3>
                  <div className="text-xs text-muted">{exam.exam_date} · {exam.academic_year}</div>
                </div>
                {marks.length > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div className="text-muted text-sm">Total</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{total}</div>
                  </div>
                )}
              </div>
              {marks.length === 0 ? (
                <p className="text-muted" style={{ margin: 0 }}>No marks entered for you in this exam.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th style={{ textAlign: 'right' }}>Marks</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marks.map((m, i) => (
                        <tr key={i}>
                          <td><strong>{m.subject_name}</strong></td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{m.marks_obtained ?? '—'}</td>
                          <td>{m.remarks ?? <span className="text-muted">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
