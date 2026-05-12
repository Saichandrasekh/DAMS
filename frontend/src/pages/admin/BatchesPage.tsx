import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

export function BatchesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'batches'],
    queryFn: () => adminApi.listBatches(),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={apiErrorMessage(error)} />;
  const batches = data ?? [];

  return (
    <div>
      <PageHeader
        icon="fa-layer-group"
        title="Batches"
        subtitle="Students grouped by academic-year cohort"
      />

      {batches.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="fa-layer-group"
            title="No batches yet"
            description="Create classes with academic years to see batch summaries."
          />
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {batches.map((b) => {
            const yearKey = b.academic_year ?? '(none)';
            const pctColor =
              b.attendance_pct >= 75 ? '#10b981' :
              b.attendance_pct >= 50 ? '#f59e0b' : '#ef4444';
            return (
              <Link
                key={yearKey}
                to={`/admin/batches/${encodeURIComponent(yearKey)}`}
                className="card"
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'block',
                  borderLeft: `4px solid ${pctColor}`,
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>
                  <i className="fas fa-calendar-alt" style={{ color: 'var(--primary)', marginRight: 8 }} />
                  {b.academic_year ?? 'Unassigned year'}
                </h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div className="text-xs text-muted">Classes</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{b.class_count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Students</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{b.student_count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Avg attendance</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: pctColor }}>
                      {b.attendance_pct}%
                    </div>
                  </div>
                </div>
                <div
                  className="text-xs text-muted"
                  style={{ textAlign: 'right' }}
                >
                  {b.attendance_present} of {b.attendance_total} attendance records present
                </div>
                <div
                  style={{
                    marginTop: 12,
                    fontSize: '0.85rem',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  View details <i className="fas fa-arrow-right" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
