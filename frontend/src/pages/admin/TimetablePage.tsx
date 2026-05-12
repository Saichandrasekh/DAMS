import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function TimetablePage() {
  const qc = useQueryClient();
  const [classId, setClassId] = useState<number | undefined>(undefined);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'timetable', classId],
    queryFn: () => adminApi.timetable(classId),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { class_id: number; day: string; period: number; subject_id: number | null }) => adminApi.updateTimetable(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'timetable'] }),
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  const periods = Array.from({ length: data.periods }, (_, i) => i + 1);

  return (
    <div>
      <PageHeader icon="fa-calendar-alt" title="Timetable" subtitle="Set the weekly schedule for each class" />

      <div className="card" style={{ marginBottom: 16 }}>
        <label className="form-label">Class</label>
        <select
          className="form-control"
          style={{ maxWidth: 320 }}
          value={classId ?? ''}
          onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">— select a class —</option>
          {data.classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
          ))}
        </select>
      </div>

      {!classId ? (
        <div className="card">
          <p className="text-muted" style={{ margin: 0 }}>Select a class above to edit its timetable.</p>
        </div>
      ) : data.subjects.length === 0 ? (
        <div className="card">
          <p className="text-muted" style={{ margin: 0 }}>This class has no subjects yet. Add subjects first.</p>
        </div>
      ) : (
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
                    const key = `${day}-${p}`;
                    const subjectId = data.data[key];
                    return (
                      <td key={p}>
                        <select
                          className="form-control"
                          style={{ minWidth: 140 }}
                          value={subjectId ?? ''}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : null;
                            updateMutation.mutate({ class_id: classId, day, period: p, subject_id: val });
                          }}
                        >
                          <option value="">—</option>
                          {data.subjects.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
