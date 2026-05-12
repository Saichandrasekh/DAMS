import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { Modal } from '@/components/Modal';
import { apiErrorMessage } from '@/lib/api';

interface AddHolidayForm {
  name: string;
  date: string;
}

export function HolidaysPage() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'holidays'],
    queryFn: () => adminApi.listHolidays(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteHoliday(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'holidays'] });
      Swal.fire({ icon: 'success', title: 'Removed', timer: 1500, showConfirmButton: false });
    },
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={apiErrorMessage(error)} />;
  const holidays = data ?? [];

  return (
    <div>
      <PageHeader
        icon="fa-umbrella-beach"
        title="Holidays"
        subtitle={`${holidays.length} holiday${holidays.length === 1 ? '' : 's'}`}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <i className="fas fa-plus" /> Add Holiday
          </button>
        }
      />

      <div className="card" style={{ padding: 0 }}>
        {holidays.length === 0 ? (
          <EmptyState icon="fa-umbrella-beach" title="No holidays" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id}>
                    <td>{h.date}</td>
                    <td><strong>{h.name}</strong></td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteMutation.mutate(h.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <i className="fas fa-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add Holiday">
        <AddHolidayFormInline onCancel={() => setAdding(false)} onSuccess={() => { qc.invalidateQueries({ queryKey: ['admin', 'holidays'] }); setAdding(false); }} />
      </Modal>
    </div>
  );
}

function AddHolidayFormInline({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<AddHolidayForm>();
  const mutation = useMutation({
    mutationFn: (data: AddHolidayForm) => adminApi.addHoliday(data),
    onSuccess: () => {
      Swal.fire({ icon: 'success', title: 'Holiday added', timer: 1500, showConfirmButton: false });
      onSuccess();
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });
  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
      <div className="form-group">
        <label className="form-label">Name *</label>
        <input className="form-control" placeholder="e.g. Republic Day" {...register('name', { required: 'Required' })} />
        {errors.name && <small style={{ color: 'var(--danger)' }}>{errors.name.message}</small>}
      </div>
      <div className="form-group">
        <label className="form-label">Date *</label>
        <input type="date" className="form-control" {...register('date', { required: 'Required' })} />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? <><i className="fas fa-spinner fa-spin" /> Adding…</> : 'Add'}
        </button>
      </div>
    </form>
  );
}
