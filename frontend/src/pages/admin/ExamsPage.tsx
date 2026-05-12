import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { Modal } from '@/components/Modal';
import { apiErrorMessage } from '@/lib/api';

interface ExamRow {
  id: number;
  name: string;
  exam_date: string;
  academic_year: string;
  is_published: number;
  created_at: string;
}

interface ExamFormValues {
  name: string;
  exam_date: string;
  academic_year?: string;
}

export function ExamsPage() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ExamRow | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'exams'],
    queryFn: () => adminApi.listExams(),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => adminApi.toggleExamPublish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'exams'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteExam(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'exams'] });
      Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, showConfirmButton: false });
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  const handleDelete = async (id: number, name: string) => {
    const r = await Swal.fire({
      title: `Delete "${name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
    });
    if (r.isConfirmed) deleteMutation.mutate(id);
  };

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={apiErrorMessage(error)} />;
  const exams = (data ?? []) as ExamRow[];

  return (
    <div>
      <PageHeader
        icon="fa-file-alt"
        title="Exams"
        subtitle={`${exams.length} exam${exams.length === 1 ? '' : 's'}`}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <i className="fas fa-plus" /> Add Exam
          </button>
        }
      />

      <div className="card" style={{ padding: 0 }}>
        {exams.length === 0 ? (
          <EmptyState icon="fa-file-alt" title="No exams yet" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Date</th>
                  <th>Year</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((e) => (
                  <tr key={e.id}>
                    <td><strong>{e.name}</strong></td>
                    <td>{e.exam_date}</td>
                    <td>{e.academic_year}</td>
                    <td>
                      {e.is_published ? <span className="badge badge-success">Published</span> : <span className="badge badge-neutral">Draft</span>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => toggleMutation.mutate(e.id)}
                        disabled={toggleMutation.isPending}
                        title={e.is_published ? 'Unpublish' : 'Publish'}
                      >
                        <i className={`fas ${e.is_published ? 'fa-eye-slash' : 'fa-eye'}`} />
                      </button>{' '}
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(e)}>
                        <i className="fas fa-pen" />
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(e.id, e.name)}
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

      <Modal open={adding} onClose={() => setAdding(false)} title="Add Exam">
        <ExamForm mode="add" onCancel={() => setAdding(false)} onSuccess={() => { qc.invalidateQueries({ queryKey: ['admin', 'exams'] }); setAdding(false); }} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : ''}>
        {editing && (
          <ExamForm
            mode="edit"
            initial={editing}
            onCancel={() => setEditing(null)}
            onSuccess={() => { qc.invalidateQueries({ queryKey: ['admin', 'exams'] }); setEditing(null); }}
          />
        )}
      </Modal>
    </div>
  );
}

function ExamForm({
  mode,
  initial,
  onCancel,
  onSuccess,
}: {
  mode: 'add' | 'edit';
  initial?: ExamRow;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<ExamFormValues>({
    defaultValues: initial
      ? { name: initial.name, exam_date: initial.exam_date, academic_year: initial.academic_year }
      : { academic_year: '2025-2026' },
  });
  const mutation = useMutation({
    mutationFn: (data: ExamFormValues) =>
      mode === 'add' ? adminApi.addExam(data) : adminApi.updateExam(initial!.id, data),
    onSuccess: () => {
      Swal.fire({ icon: 'success', title: mode === 'add' ? 'Exam created' : 'Saved', timer: 1500, showConfirmButton: false });
      onSuccess();
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });
  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
      <div className="form-group">
        <label className="form-label">Name *</label>
        <input className="form-control" placeholder="e.g. Mid-Term Exam 2025" {...register('name', { required: 'Required' })} />
        {errors.name && <small style={{ color: 'var(--danger)' }}>{errors.name.message}</small>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Date *</label>
          <input type="date" className="form-control" {...register('exam_date', { required: 'Required' })} />
        </div>
        <div className="form-group">
          <label className="form-label">Academic year</label>
          <input className="form-control" {...register('academic_year')} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? <><i className="fas fa-spinner fa-spin" /> Saving…</> : mode === 'add' ? 'Create Exam' : 'Save'}
        </button>
      </div>
    </form>
  );
}
