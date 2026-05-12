import { useQuery } from '@tanstack/react-query';
import { teacherApi } from '@/api/teacher';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function TeacherTimetablePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['teacher', 'timetable'],
    queryFn: () => teacherApi.timetable(),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  const periods = Array.from({ length: data.periods }, (_, i) => i + 1);

  return (
    <div>
      <PageHeader icon="fa-calendar-alt" title="My Timetable" subtitle="Your weekly teaching schedule" />

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Day / Period</th>
              {periods.map((p) => <th key={p}>Period {p}</th>)}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => (
              <tr key={day}>
                <td><strong>{day}</strong></td>
                {periods.map((p) => {
                  const cell = data.data[`${day}-${p}`];
                  return (
                    <td key={p}>
                      {cell ? (
                        <div>
                          <strong>{cell.subject_name}</strong>
                          <div className="text-xs text-muted">{cell.class_name}-{cell.section}</div>
                        </div>
                      ) : <span className="text-muted">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
