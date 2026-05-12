import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { teacherApi } from '@/api/teacher';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

export function MyClassesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['teacher', 'my-classes'],
    queryFn: () => teacherApi.myClasses(),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={apiErrorMessage(error)} />;
  const classes = data?.classes ?? [];

  return (
    <div>
      <PageHeader icon="fa-chalkboard" title="My Classes" subtitle={`${classes.length} subject assignment${classes.length === 1 ? '' : 's'}`} />

      <div className="card" style={{ padding: 0 }}>
        {classes.length === 0 ? (
          <EmptyState icon="fa-chalkboard" title="No classes" description="You don't have any classes assigned yet. Ask your admin." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Section</th>
                  <th>Subject</th>
                  <th>Year</th>
                  <th style={{ textAlign: 'center' }}>Students</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={`${c.id}-${c.subject_id}`}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.section}</td>
                    <td>{c.subject_name}</td>
                    <td>{c.academic_year ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{c.student_count}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Link to={`/teacher/mark-attendance?class_id=${c.id}&subject_id=${c.subject_id}`} className="btn btn-primary btn-sm">
                        <i className="fas fa-user-check" /> Mark
                      </Link>
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
