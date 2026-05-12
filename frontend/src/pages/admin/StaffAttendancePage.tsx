import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

const STATUS_OPTIONS = ['present', 'absent', 'half_day', 'late', 'on_leave'];

export function StaffAttendancePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'staff-attendance', date],
    queryFn: () => adminApi.staffAttendance(date),
  });

  const markMutation = useMutation({
    mutationFn: (input: { staff_id: number; date: string; status: string }) => adminApi.markStaff(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'staff-attendance'] }),
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  const recordMap = new Map(data.records.map((r) => [r.staff_id, r]));

  return (
    <div>
      <PageHeader icon="fa-user-check" title="Staff Attendance" subtitle={`Mark attendance for ${date}`} />

      <div className="card" style={{ marginBottom: 16 }}>
        <label className="form-label">Date</label>
        <input
          type="date"
          className="form-control"
          style={{ maxWidth: 240 }}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.all_staff.map((s) => {
                const rec = recordMap.get(s.id);
                return (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td style={{ textTransform: 'capitalize' }}>{s.role}</td>
                    <td>
                      <select
                        className="form-control"
                        style={{ maxWidth: 200 }}
                        value={rec?.status ?? ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            markMutation.mutate({ staff_id: s.id, date, status: e.target.value });
                          }
                        }}
                      >
                        <option value="">— mark status —</option>
                        {STATUS_OPTIONS.map((st) => (
                          <option key={st} value={st}>{st.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
