import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

interface FormValues {
  name: string;
  email: string;
  phone?: string;
  gender?: string;
  dob?: string;
  address?: string;
  is_active: boolean;
  new_password?: string;
  class_id?: string;
  roll_no?: string;
}

export function EditStudentPage() {
  const { id } = useParams<{ id: string }>();
  const studentId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'student', studentId],
    queryFn: () => adminApi.getStudent(studentId),
    enabled: !Number.isNaN(studentId),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>();

  useEffect(() => {
    if (data) {
      reset({
        name: data.student.name,
        email: data.student.email,
        phone: data.student.phone ?? '',
        gender: data.student.gender ?? '',
        dob: data.student.dob ?? '',
        address: data.student.address ?? '',
        is_active: data.student.is_active === 1,
        class_id: data.current_class?.class_id ? String(data.current_class.class_id) : '',
        roll_no: data.current_class?.roll_no ?? '',
        new_password: '',
      });
    }
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: (input: FormValues) => adminApi.updateStudent(studentId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      Swal.fire({ icon: 'success', title: 'Saved', timer: 1500, showConfirmButton: false });
      navigate('/admin/students');
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error, 'Student not found')} />;

  return (
    <div>
      <PageHeader
        icon="fa-pen"
        title={`Edit ${data.student.name}`}
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            <i className="fas fa-arrow-left" /> Back
          </button>
        }
      />

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="card" style={{ maxWidth: 720 }}>
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input className="form-control" {...register('name', { required: 'Required' })} />
          {errors.name && <small style={{ color: 'var(--danger)' }}>{errors.name.message}</small>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input type="email" className="form-control" {...register('email', { required: 'Required' })} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-control" {...register('phone')} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Gender</label>
            <select className="form-control" {...register('gender')}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">DOB</label>
            <input type="date" className="form-control" {...register('dob')} />
          </div>
          <div className="form-group">
            <label className="form-label">Roll No</label>
            <input className="form-control" {...register('roll_no')} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Class</label>
          <select className="form-control" {...register('class_id')}>
            <option value="">— No class —</option>
            {data.classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Address</label>
          <textarea rows={2} className="form-control" {...register('address')} />
        </div>
        <div className="form-group">
          <label className="form-label">New password <span className="text-muted">(blank = keep current)</span></label>
          <input type="text" className="form-control" {...register('new_password')} />
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" {...register('is_active')} /> Active
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <><i className="fas fa-spinner fa-spin" /> Saving…</> : <><i className="fas fa-save" /> Save</>}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/admin/students')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
