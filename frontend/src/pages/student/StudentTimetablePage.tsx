import { useQuery } from '@tanstack/react-query';
import { studentApi } from '@/api/student';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function StudentTimetablePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['student', 'timetable'],
    queryFn: () => studentApi.timetable(),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error, 'No class assigned yet')} />;

  const periods = Array.from({ length: data.periods }, (_, i) => i + 1);

  return (
    <div>
      <PageHeader
        icon="fa-calendar-alt"
        title="My Timetable"
        subtitle={data.info ? `${data.info.class_name} - ${data.info.section}` : ''}
      />

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
                          <div className="text-xs text-muted">{cell.teacher_name ?? '—'}</div>
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
