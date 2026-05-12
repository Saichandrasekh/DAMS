import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

interface SettingsForm {
  primary_color: string;
  academic_year: string;
  periods_per_day: number;
  min_attendance_pct: number;
  late_cutoff_time: string;
  phone: string;
  email: string;
  address: string;
}

export function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminApi.getSettings(),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SettingsForm>();

  useEffect(() => {
    if (data?.school) {
      const s = data.school as Record<string, unknown>;
      reset({
        primary_color: (s.primary_color as string) ?? '#4f46e5',
        academic_year: (s.academic_year as string) ?? '',
        periods_per_day: (s.periods_per_day as number) ?? 8,
        min_attendance_pct: (s.min_attendance_pct as number) ?? 75,
        late_cutoff_time: (s.late_cutoff_time as string) ?? '09:00',
        phone: (s.phone as string) ?? '',
        email: (s.email as string) ?? '',
        address: (s.address as string) ?? '',
      });
    }
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: (input: SettingsForm) => adminApi.updateSettings(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      Swal.fire({ icon: 'success', title: 'Saved', timer: 1500, showConfirmButton: false });
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  return (
    <div>
      <PageHeader icon="fa-gear" title="School Settings" subtitle="Branding, calendar, and policies" />

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="card" style={{ maxWidth: 720 }}>
        <h3 style={{ marginTop: 0 }}>Contact</h3>
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
          <textarea rows={2} className="form-control" {...register('address')} />
        </div>

        <h3 style={{ marginTop: 24 }}>Calendar & policies</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Primary color</label>
            <input type="color" className="form-control" style={{ height: 42, padding: 4 }} {...register('primary_color')} />
          </div>
          <div className="form-group">
            <label className="form-label">Academic year</label>
            <input className="form-control" {...register('academic_year')} />
          </div>
          <div className="form-group">
            <label className="form-label">Periods/day</label>
            <input type="number" className="form-control" {...register('periods_per_day', { valueAsNumber: true, min: 1, max: 12 })} />
            {errors.periods_per_day && <small style={{ color: 'var(--danger)' }}>1–12</small>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Min attendance %</label>
            <input type="number" className="form-control" {...register('min_attendance_pct', { valueAsNumber: true, min: 0, max: 100 })} />
          </div>
          <div className="form-group">
            <label className="form-label">Late cutoff</label>
            <input type="time" className="form-control" {...register('late_cutoff_time')} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <><i className="fas fa-spinner fa-spin" /> Saving…</> : <><i className="fas fa-save" /> Save</>}
          </button>
        </div>
      </form>
    </div>
  );
}
