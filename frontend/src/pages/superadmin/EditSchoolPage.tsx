import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { superadminApi } from '@/api/superadmin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';
import type { UpdateSchoolInput } from '@/types/superadmin';

export function EditSchoolPage() {
  const { id } = useParams<{ id: string }>();
  const schoolId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['superadmin', 'school', schoolId],
    queryFn: () => superadminApi.getSchool(schoolId),
    enabled: !Number.isNaN(schoolId),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UpdateSchoolInput>();

  useEffect(() => {
    if (data?.school) {
      reset({
        name: data.school.name,
        email: data.school.email ?? '',
        phone: data.school.phone ?? '',
        address: data.school.address ?? '',
        primary_color: data.school.primary_color ?? '#4f46e5',
        academic_year: data.school.academic_year ?? '',
        periods_per_day: data.school.periods_per_day ?? 8,
        min_attendance_pct: data.school.min_attendance_pct ?? 75,
        late_cutoff_time: data.school.late_cutoff_time ?? '09:00',
      });
    }
  }, [data, reset]);

  const updateMutation = useMutation({
    mutationFn: (input: UpdateSchoolInput) => superadminApi.updateSchool(schoolId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin'] });
      Swal.fire({ icon: 'success', title: 'School updated', timer: 1500, showConfirmButton: false });
      navigate('/superadmin/schools');
    },
    onError: (err) => {
      Swal.fire({ icon: 'error', title: 'Failed to update', text: apiErrorMessage(err) });
    },
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error, 'School not found')} />;

  return (
    <div>
      <PageHeader
        icon="fa-pen"
        title={`Edit ${data.school.name}`}
        subtitle={`Code: ${data.school.code}`}
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            <i className="fas fa-arrow-left" /> Back
          </button>
        }
      />

      <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="card" style={{ maxWidth: 720 }}>
        <h3 style={{ marginTop: 0 }}>Details</h3>

        <div className="form-group">
          <label className="form-label">School name *</label>
          <input className="form-control" {...register('name', { required: 'Required' })} />
          {errors.name && <small style={{ color: 'var(--danger)' }}>{errors.name.message}</small>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" {...register('email')} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-control" {...register('phone')} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Address</label>
          <textarea className="form-control" rows={2} {...register('address')} />
        </div>

        <h3 style={{ marginTop: 24 }}>Branding & policies</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Primary color</label>
            <input type="color" className="form-control" style={{ height: 42, padding: 4 }} {...register('primary_color')} />
          </div>
          <div className="form-group">
            <label className="form-label">Academic year</label>
            <input className="form-control" placeholder="2025-2026" {...register('academic_year')} />
          </div>
          <div className="form-group">
            <label className="form-label">Periods/day</label>
            <input
              type="number"
              className="form-control"
              {...register('periods_per_day', { valueAsNumber: true, min: 1, max: 12 })}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Min attendance %</label>
            <input
              type="number"
              className="form-control"
              {...register('min_attendance_pct', { valueAsNumber: true, min: 0, max: 100 })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Late cutoff time</label>
            <input type="time" className="form-control" {...register('late_cutoff_time')} />
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <><i className="fas fa-spinner fa-spin" /> Saving…</>
            ) : (
              <><i className="fas fa-save" /> Save changes</>
            )}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/superadmin/schools')}>
            Cancel
          </button>
        </div>
      </form>

      {data.admins.length > 0 && (
        <div className="card" style={{ marginTop: 16, maxWidth: 720 }}>
          <h3 style={{ marginTop: 0 }}>School admins</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {data.admins.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
