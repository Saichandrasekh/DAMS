import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { Modal } from '@/components/Modal';
import { apiErrorMessage } from '@/lib/api';
import type { Teacher } from '@/types/admin';
import { TeachersAttendanceReport } from './TeachersAttendanceReportPage';

type Tab = 'roster' | 'report';

interface TeacherFormValues {
  name: string;
  email: string;
  password?: string;
  new_password?: string;
  phone?: string;
  gender?: string;
  is_active?: boolean;
}

export function TeachersPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('roster');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'teachers'],
    queryFn: () => adminApi.listTeachers(),
    enabled: tab === 'roster',
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteTeacher(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      Swal.fire({ icon: 'success', title: 'Teacher deactivated', timer: 1500, showConfirmButton: false });
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  const handleDelete = async (id: number, name: string) => {
    const r = await Swal.fire({
      title: `Deactivate ${name}?`,
      text: 'They will no longer be able to log in.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Deactivate',
    });
    if (r.isConfirmed) deleteMutation.mutate(id);
  };

  const teachers = data ?? [];

  return (
    <div>
      <PageHeader
        icon="fa-chalkboard-teacher"
        title="Teachers"
        subtitle={
          tab === 'roster'
            ? `${teachers.length} teacher${teachers.length === 1 ? '' : 's'}`
            : 'Per-teacher attendance over a date range'
        }
        actions={
          tab === 'roster' ? (
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              <i className="fas fa-plus" /> Add Teacher
            </button>
          ) : null
        }
      />

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <TabButton active={tab === 'roster'} onClick={() => setTab('roster')} icon="fa-list-ul">
          Roster
        </TabButton>
        <TabButton active={tab === 'report'} onClick={() => setTab('report')} icon="fa-chart-pie">
          Attendance Report
        </TabButton>
      </div>

      {tab === 'report' ? (
        <TeachersAttendanceReport />
      ) : (
        <RosterTab
          isLoading={isLoading}
          error={error}
          teachers={teachers}
          onEdit={(t) => setEditing(t)}
          onDelete={handleDelete}
          deleteIsPending={deleteMutation.isPending}
        />
      )}
      {/* Modals stay outside the tab content */}
      <Modal open={adding} onClose={() => setAdding(false)} title="Add Teacher">
        <TeacherForm
          mode="add"
          onCancel={() => setAdding(false)}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ['admin'] }); setAdding(false); }}
        />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.name ?? ''}`}>
        {editing && (
          <TeacherForm
            mode="edit"
            initial={editing}
            onCancel={() => setEditing(null)}
            onSuccess={() => { qc.invalidateQueries({ queryKey: ['admin'] }); setEditing(null); }}
          />
        )}
      </Modal>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 16px',
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
        color: active ? 'var(--primary)' : 'var(--text-muted)',
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
        marginBottom: -1,
      }}
    >
      <i className={`fas ${icon}`} style={{ marginRight: 8 }} />
      {children}
    </button>
  );
}

function RosterTab({
  isLoading,
  error,
  teachers,
  onEdit,
  onDelete,
  deleteIsPending,
}: {
  isLoading: boolean;
  error: unknown;
  teachers: Teacher[];
  onEdit: (t: Teacher) => void;
  onDelete: (id: number, name: string) => void;
  deleteIsPending: boolean;
}) {
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={apiErrorMessage(error)} />;

  return (
    <div>
      <div className="card" style={{ padding: 0 }}>
        {teachers.length === 0 ? (
          <EmptyState icon="fa-chalkboard-teacher" title="No teachers" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Subjects</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.name}</strong></td>
                    <td>{t.email}</td>
                    <td>{t.phone ?? '—'}</td>
                    <td>
                      {t.subjects ?? <span className="text-muted">—</span>}
                      {t.class_count && t.class_count > 0 && (
                        <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                          across {t.class_count} class{t.class_count === 1 ? '' : 'es'}
                        </div>
                      )}
                    </td>
                    <td>{t.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Inactive</span>}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEdit(t)}>
                        <i className="fas fa-pen" />
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => onDelete(t.id, t.name)}
                        disabled={!t.is_active || deleteIsPending}
                      >
                        <i className="fas fa-user-slash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function TeacherForm({
  mode,
  initial,
  onCancel,
  onSuccess,
}: {
  mode: 'add' | 'edit';
  initial?: Teacher;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<TeacherFormValues>({
    defaultValues: initial
      ? {
          name: initial.name,
          email: initial.email,
          phone: initial.phone ?? '',
          gender: initial.gender ?? '',
          is_active: initial.is_active === 1,
          new_password: '',
        }
      : {},
  });

  const mutation = useMutation({
    mutationFn: (data: TeacherFormValues) =>
      mode === 'add' ? adminApi.addTeacher(data) : adminApi.updateTeacher(initial!.id, data),
    onSuccess: () => {
      Swal.fire({ icon: 'success', title: mode === 'add' ? 'Teacher added' : 'Saved', timer: 1500, showConfirmButton: false });
      onSuccess();
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
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
        {mode === 'add' ? (
          <div className="form-group">
            <label className="form-label">Password *</label>
            <input type="text" className="form-control" {...register('password', { required: 'Required' })} />
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">New password <span className="text-muted">(blank = keep)</span></label>
            <input type="text" className="form-control" {...register('new_password')} />
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input className="form-control" {...register('phone')} />
        </div>
        <div className="form-group">
          <label className="form-label">Gender</label>
          <select className="form-control" {...register('gender')}>
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      {mode === 'edit' && (
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" {...register('is_active')} /> Active
          </label>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? <><i className="fas fa-spinner fa-spin" /> Saving…</> : mode === 'add' ? 'Add Teacher' : 'Save'}
        </button>
      </div>
    </form>
  );
}
