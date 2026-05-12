import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { Modal } from '@/components/Modal';
import { apiErrorMessage } from '@/lib/api';
import type { ClassRef, SubjectRow, TeacherRef } from '@/types/admin';

interface SubjectFormValues {
  name: string;
  class_id: string;
  teacher_id?: string;
}

export function SubjectsPage() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SubjectRow | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'subjects'],
    queryFn: () => adminApi.listSubjects(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteSubject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      Swal.fire({ icon: 'success', title: 'Subject deleted', timer: 1500, showConfirmButton: false });
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

  const subjects = data?.subjects ?? [];
  const classes = data?.classes ?? [];
  const teachers = data?.teachers ?? [];

  return (
    <div>
      <PageHeader
        icon="fa-book"
        title="Subjects"
        subtitle={`${subjects.length} subject${subjects.length === 1 ? '' : 's'}`}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)} disabled={classes.length === 0}>
            <i className="fas fa-plus" /> Add Subject
          </button>
        }
      />

      <div className="card" style={{ padding: 0 }}>
        {subjects.length === 0 ? (
          <EmptyState icon="fa-book" title="No subjects" description={classes.length === 0 ? 'Create a class first.' : 'Add the first subject to get started.'} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Class</th>
                  <th>Teacher</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.class_name} - {s.section}</td>
                    <td>{s.teacher_name ?? <span className="text-muted">— unassigned —</span>}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(s)}>
                        <i className="fas fa-pen" />
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(s.id, s.name)}
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

      <Modal open={adding} onClose={() => setAdding(false)} title="Add Subject">
        <SubjectForm mode="add" classes={classes} teachers={teachers} onCancel={() => setAdding(false)} onSuccess={() => { qc.invalidateQueries({ queryKey: ['admin'] }); setAdding(false); }} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : ''}>
        {editing && (
          <SubjectForm
            mode="edit"
            initial={editing}
            classes={classes}
            teachers={teachers}
            onCancel={() => setEditing(null)}
            onSuccess={() => { qc.invalidateQueries({ queryKey: ['admin'] }); setEditing(null); }}
          />
        )}
      </Modal>
    </div>
  );
}

function SubjectForm({
  mode,
  initial,
  classes,
  teachers,
  onCancel,
  onSuccess,
}: {
  mode: 'add' | 'edit';
  initial?: SubjectRow;
  classes: ClassRef[];
  teachers: TeacherRef[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<SubjectFormValues>({
    defaultValues: initial
      ? {
          name: initial.name,
          class_id: String(initial.class_id),
          teacher_id: initial.teacher_id ? String(initial.teacher_id) : '',
        }
      : {},
  });

  const mutation = useMutation({
    mutationFn: (data: SubjectFormValues) =>
      mode === 'add' ? adminApi.addSubject(data) : adminApi.updateSubject(initial!.id, data),
    onSuccess: () => {
      Swal.fire({ icon: 'success', title: mode === 'add' ? 'Subject added' : 'Saved', timer: 1500, showConfirmButton: false });
      onSuccess();
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
      <div className="form-group">
        <label className="form-label">Subject name *</label>
        <input className="form-control" placeholder="e.g. Mathematics" {...register('name', { required: 'Required' })} />
        {errors.name && <small style={{ color: 'var(--danger)' }}>{errors.name.message}</small>}
      </div>
      <div className="form-group">
        <label className="form-label">Class *</label>
        <select className="form-control" {...register('class_id', { required: 'Required' })}>
          <option value="">— select class —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
          ))}
        </select>
        {errors.class_id && <small style={{ color: 'var(--danger)' }}>{errors.class_id.message}</small>}
      </div>
      <div className="form-group">
        <label className="form-label">Teacher</label>
        <select className="form-control" {...register('teacher_id')}>
          <option value="">— Unassigned —</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? <><i className="fas fa-spinner fa-spin" /> Saving…</> : mode === 'add' ? 'Add Subject' : 'Save'}
        </button>
      </div>
    </form>
  );
}
