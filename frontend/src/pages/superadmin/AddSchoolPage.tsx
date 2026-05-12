import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { superadminApi } from '@/api/superadmin';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import type { AddSchoolInput } from '@/types/superadmin';

export function AddSchoolPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<AddSchoolInput>();

  const createMutation = useMutation({
    mutationFn: (input: AddSchoolInput) => superadminApi.createSchool(input),
    onSuccess: (school) => {
      qc.invalidateQueries({ queryKey: ['superadmin'] });
      Swal.fire({ icon: 'success', title: 'School created', text: school.name, timer: 1500, showConfirmButton: false });
      navigate('/superadmin/schools');
    },
    onError: (err) => {
      Swal.fire({ icon: 'error', title: 'Failed to create school', text: apiErrorMessage(err) });
    },
  });

  const onSubmit = (data: AddSchoolInput) => createMutation.mutate(data);

  return (
    <div>
      <PageHeader
        icon="fa-plus"
        title="Add School"
        subtitle="Create a new school and its first admin user"
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            <i className="fas fa-arrow-left" /> Back
          </button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="card" style={{ maxWidth: 720 }}>
        <h3 style={{ marginTop: 0 }}>School details</h3>

        <div className="form-group">
          <label className="form-label">School name *</label>
          <input className="form-control" {...register('name', { required: 'Required' })} />
          {errors.name && <small style={{ color: 'var(--danger)' }}>{errors.name.message}</small>}
        </div>

        <div className="form-group">
          <label className="form-label">School code *</label>
          <input
            className="form-control"
            placeholder="e.g. SVBK"
            {...register('code', { required: 'Required' })}
            style={{ textTransform: 'uppercase' }}
          />
          {errors.code && <small style={{ color: 'var(--danger)' }}>{errors.code.message}</small>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Contact email</label>
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

        <h3 style={{ marginTop: 24 }}>First admin user</h3>

        <div className="form-group">
          <label className="form-label">Admin name *</label>
          <input className="form-control" {...register('admin_name', { required: 'Required' })} />
          {errors.admin_name && <small style={{ color: 'var(--danger)' }}>{errors.admin_name.message}</small>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Admin email *</label>
            <input type="email" className="form-control" {...register('admin_email', { required: 'Required' })} />
            {errors.admin_email && <small style={{ color: 'var(--danger)' }}>{errors.admin_email.message}</small>}
          </div>
          <div className="form-group">
            <label className="form-label">Admin password *</label>
            <input
              type="text"
              className="form-control"
              {...register('admin_password', { required: 'Required', minLength: { value: 6, message: 'Min 6 chars' } })}
            />
            {errors.admin_password && <small style={{ color: 'var(--danger)' }}>{errors.admin_password.message}</small>}
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <><i className="fas fa-spinner fa-spin" /> Creating…</>
            ) : (
              <><i className="fas fa-check" /> Create school</>
            )}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/superadmin/schools')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
