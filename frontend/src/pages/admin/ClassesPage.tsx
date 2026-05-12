import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { Modal } from '@/components/Modal';
import { apiErrorMessage } from '@/lib/api';
import type { ClassRow, TeacherRef } from '@/types/admin';
import { PromoteClassModal } from './PromoteClassModal';

interface ClassFormValues {
  name: string;
  section: string;
  academic_year?: string;
  class_teacher_id?: string;
}

export function ClassesPage() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [promoting, setPromoting] = useState<ClassRow | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'classes'],
    queryFn: () => adminApi.listClasses(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteClass(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      Swal.fire({ icon: 'success', title: 'Class deleted', timer: 1500, showConfirmButton: false });
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  const handleDelete = async (id: number, name: string) => {
    const r = await Swal.fire({
      title: `Delete class ${name}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
    });
    if (r.isConfirmed) deleteMutation.mutate(id);
  };

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={apiErrorMessage(error)} />;

  const classes = data?.classes ?? [];
  const teachers = data?.teachers ?? [];

  return (
    <div>
      <PageHeader
        icon="fa-school"
        title="Classes"
        subtitle={`${classes.length} class${classes.length === 1 ? '' : 'es'}`}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <i className="fas fa-plus" /> Add Class
          </button>
        }
      />

      <div className="card" style={{ padding: 0 }}>
        {classes.length === 0 ? (
          <EmptyState icon="fa-school" title="No classes yet" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Section</th>
                  <th>Year</th>
                  <th>Class Teacher</th>
                  <th style={{ textAlign: 'center' }}>Students</th>
                  <th style={{ textAlign: 'center' }}>Subjects</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.section}</td>
                    <td>{c.academic_year ?? '—'}</td>
                    <td>{c.class_teacher_name ?? <span className="text-muted">—</span>}</td>
                    <td style={{ textAlign: 'center' }}>{c.student_count}</td>
                    <td style={{ textAlign: 'center' }}>{c.subject_count}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setPromoting(c)}
                        disabled={c.student_count === 0}
                        title={c.student_count === 0 ? 'No students to promote' : 'Promote / graduate students'}
                      >
                        <i className="fas fa-graduation-cap" />
                      </button>{' '}
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(c)} title="Edit">
                        <i className="fas fa-pen" />
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(c.id, `${c.name} - ${c.section}`)}
                        disabled={deleteMutation.isPending || c.student_count > 0}
                        title={c.student_count > 0 ? 'Cannot delete: has students' : 'Delete'}
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

      <Modal open={adding} onClose={() => setAdding(false)} title="Add Class">
        <ClassForm mode="add" teachers={teachers} onCancel={() => setAdding(false)} onSuccess={() => { qc.invalidateQueries({ queryKey: ['admin'] }); setAdding(false); }} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name} - ${editing.section}` : ''}>
        {editing && (
          <ClassForm
            mode="edit"
            initial={editing}
            teachers={teachers}
            onCancel={() => setEditing(null)}
            onSuccess={() => { qc.invalidateQueries({ queryKey: ['admin'] }); setEditing(null); }}
          />
        )}
      </Modal>

      <PromoteClassModal
        open={!!promoting}
        sourceClass={promoting}
        allClasses={classes}
        onClose={() => setPromoting(null)}
      />
    </div>
  );
}

function ClassForm({
  mode,
  initial,
  teachers,
  onCancel,
  onSuccess,
}: {
  mode: 'add' | 'edit';
  initial?: ClassRow;
  teachers: TeacherRef[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<ClassFormValues>({
    defaultValues: initial
      ? {
          name: initial.name,
          section: initial.section,
          academic_year: initial.academic_year ?? '',
          class_teacher_id: initial.class_teacher_id ? String(initial.class_teacher_id) : '',
        }
      : {},
  });

  const mutation = useMutation({
    mutationFn: (data: ClassFormValues) =>
      mode === 'add' ? adminApi.addClass(data) : adminApi.updateClass(initial!.id, data),
    onSuccess: () => {
      Swal.fire({ icon: 'success', title: mode === 'add' ? 'Class added' : 'Saved', timer: 1500, showConfirmButton: false });
      onSuccess();
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Class name *</label>
          <input className="form-control" placeholder="e.g. 7th" {...register('name', { required: 'Required' })} />
          {errors.name && <small style={{ color: 'var(--danger)' }}>{errors.name.message}</small>}
        </div>
        <div className="form-group">
          <label className="form-label">Section *</label>
          <input className="form-control" placeholder="A" {...register('section', { required: 'Required' })} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Academic year</label>
        <input className="form-control" placeholder="2025-2026" {...register('academic_year')} />
      </div>
      <div className="form-group">
        <label className="form-label">Class teacher</label>
        <select className="form-control" {...register('class_teacher_id')}>
          <option value="">— None —</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? <><i className="fas fa-spinner fa-spin" /> Saving…</> : mode === 'add' ? 'Add Class' : 'Save'}
        </button>
      </div>
    </form>
  );
}
