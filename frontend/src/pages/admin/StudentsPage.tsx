import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { Modal } from '@/components/Modal';
import { apiErrorMessage } from '@/lib/api';
import type { Student } from '@/types/admin';

const STATUS_BADGE: Record<string, string> = {
  present: 'badge-success',
  late: 'badge-warning',
  absent: 'badge-danger',
  not_marked: 'badge-neutral',
};

const STATUS_LABEL: Record<string, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  not_marked: 'Not marked',
};

function AttendanceCell({ student }: { student: Student }) {
  const status = student.date_status ?? 'not_marked';
  const periodCount = student.date_marked ?? 0;
  return (
    <div>
      <span className={`badge ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>
      {periodCount > 0 && (
        <div className="text-xs text-muted" style={{ marginTop: 4 }}>
          <span style={{ color: 'var(--success)' }}>{student.date_present ?? 0}P</span>{' / '}
          <span style={{ color: 'var(--warning)' }}>{student.date_late ?? 0}L</span>{' / '}
          <span style={{ color: 'var(--danger)' }}>{student.date_absent ?? 0}A</span>
          <span style={{ marginLeft: 4 }}>across {periodCount} period(s)</span>
        </div>
      )}
    </div>
  );
}

interface AddStudentForm {
  name: string;
  email: string;
  password: string;
  phone?: string;
  gender?: string;
  dob?: string;
  address?: string;
  class_id?: string;
  roll_no?: string;
}

export function StudentsPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<{ class_id: string; status: string; date: string }>({
    class_id: '',
    status: 'active',
    date: '',
  });
  const [absenteesOnly, setAbsenteesOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'students', filters],
    queryFn: () => adminApi.listStudents(filters),
  });

  const purgeMutation = useMutation({
    mutationFn: () => adminApi.purgeInactiveStudents(),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      Swal.fire({ icon: 'success', title: resp.message, timer: 2000, showConfirmButton: false });
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  const handlePurge = async () => {
    const r = await Swal.fire({
      title: 'Permanently delete all archived students?',
      text: 'This removes ALL inactive students from the database. Cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Purge',
    });
    if (r.isConfirmed) purgeMutation.mutate();
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteStudent(id),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      Swal.fire({ icon: 'success', title: resp.message, timer: 1500, showConfirmButton: false });
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  const handleDelete = async (id: number, name: string, isActive: number) => {
    const action = isActive ? 'archive' : 'permanently delete';
    const result = await Swal.fire({
      title: `${isActive ? 'Archive' : 'Permanently delete'} "${name}"?`,
      text: isActive ? 'You can reactivate later.' : 'This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: action,
    });
    if (result.isConfirmed) deleteMutation.mutate(id);
  };

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={apiErrorMessage(error)} />;

  const allStudents = data?.students ?? [];
  const classes = data?.classes ?? [];
  const dateOn = filters.date;
  const q = search.trim().toLowerCase();
  const students = allStudents
    .filter((s) =>
      absenteesOnly && dateOn
        ? s.date_status === 'absent' || s.date_status === 'not_marked'
        : true,
    )
    .filter((s) =>
      q
        ? s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.roll_no ?? '').toLowerCase().includes(q) ||
          (s.phone ?? '').toLowerCase().includes(q)
        : true,
    );

  // Summary counts for the date filter
  const dateSummary = dateOn
    ? allStudents.reduce(
        (acc, s) => {
          const st = s.date_status ?? 'not_marked';
          acc[st] = (acc[st] ?? 0) + 1;
          return acc;
        },
        { present: 0, late: 0, absent: 0, not_marked: 0 } as Record<string, number>,
      )
    : null;

  return (
    <div>
      <PageHeader
        icon="fa-user-graduate"
        title="Students"
        subtitle={
          search || absenteesOnly
            ? `${students.length} match${students.length === 1 ? '' : 'es'} of ${allStudents.length}`
            : `${allStudents.length} student${allStudents.length === 1 ? '' : 's'}`
        }
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setImporting(true)}>
              <i className="fas fa-file-csv" /> Import CSV
            </button>
            {filters.status === 'inactive' && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handlePurge}
                disabled={purgeMutation.isPending || students.length === 0}
              >
                <i className="fas fa-fire" /> Purge Inactive
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              <i className="fas fa-plus" /> Add Student
            </button>
          </>
        }
      />

      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label className="form-label">Search</label>
            <div style={{ position: 'relative' }}>
              <i
                className="fas fa-magnifying-glass"
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                }}
              />
              <input
                className="form-control"
                placeholder="Name, roll, email, phone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 32, paddingRight: search ? 30 : 12 }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                  aria-label="Clear search"
                >
                  <i className="fas fa-times" />
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="form-label">Class</label>
            <select className="form-control" value={filters.class_id} onChange={(e) => setFilters((f) => ({ ...f, class_id: e.target.value }))}>
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select className="form-control" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive (archived)</option>
            </select>
          </div>
          <div>
            <label className="form-label">Attendance on date</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="date"
                className="form-control"
                value={filters.date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
              />
              {filters.date && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setFilters((f) => ({ ...f, date: '' }));
                    setAbsenteesOnly(false);
                  }}
                  title="Clear date"
                >
                  <i className="fas fa-times" />
                </button>
              )}
            </div>
          </div>
        </div>

        {dateOn && dateSummary && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 8,
              background: 'var(--background)',
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'center',
              fontSize: '0.9rem',
            }}
          >
            <strong>On {dateOn}:</strong>
            <span>
              <span className="badge badge-success">{dateSummary.present} present</span>
            </span>
            <span>
              <span className="badge badge-warning">{dateSummary.late} late</span>
            </span>
            <span>
              <span className="badge badge-danger">{dateSummary.absent} absent</span>
            </span>
            <span>
              <span className="badge badge-neutral">{dateSummary.not_marked} not marked</span>
            </span>
            <span style={{ flex: 1 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={absenteesOnly}
                onChange={(e) => setAbsenteesOnly(e.target.checked)}
              />
              Show only absentees & not-marked
            </label>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {students.length === 0 ? (
          <EmptyState icon="fa-user-graduate" title="No students" description="Add the first student to get started." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Class</th>
                  <th>Roll</th>
                  <th>Phone</th>
                  <th>Status</th>
                  {dateOn && <th>Attendance on {dateOn}</th>}
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.email}</td>
                    <td>{s.class_name ? `${s.class_name} - ${s.section}` : <span className="text-muted">—</span>}</td>
                    <td>{s.roll_no ?? '—'}</td>
                    <td>{s.phone ?? '—'}</td>
                    <td>
                      {s.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Archived</span>}
                    </td>
                    {dateOn && (
                      <td>
                        <AttendanceCell student={s} />
                      </td>
                    )}
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Link to={`/admin/students/${s.id}`} className="btn btn-primary btn-sm" title="View full profile">
                        <i className="fas fa-eye" />
                      </Link>{' '}
                      <Link to={`/admin/students/${s.id}/edit`} className="btn btn-secondary btn-sm" title="Edit">
                        <i className="fas fa-pen" />
                      </Link>{' '}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(s.id, s.name, s.is_active)}
                        disabled={deleteMutation.isPending}
                        title="Archive / delete"
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

      <Modal open={adding} onClose={() => setAdding(false)} title="Add Student" width={560}>
        <AddStudentForm
          classes={classes}
          onCancel={() => setAdding(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['admin'] });
            setAdding(false);
          }}
        />
      </Modal>

      <Modal open={importing} onClose={() => setImporting(false)} title="Import Students from CSV" width={560}>
        <ImportCsvForm
          fileInputRef={fileInputRef}
          onCancel={() => setImporting(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['admin'] });
            setImporting(false);
          }}
        />
      </Modal>
    </div>
  );
}

function ImportCsvForm({
  fileInputRef,
  onCancel,
  onSuccess,
}: {
  fileInputRef: React.RefObject<HTMLInputElement>;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [result, setResult] = useState<{ success: number; errors: string[]; error_count: number } | null>(null);

  const mutation = useMutation({
    mutationFn: (file: File) => adminApi.importStudents(file),
    onSuccess: (resp) => {
      setResult(resp);
      if (resp.error_count === 0) {
        Swal.fire({ icon: 'success', title: resp.message, timer: 2000, showConfirmButton: false });
        onSuccess();
      }
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Import failed', text: apiErrorMessage(err) }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      Swal.fire({ icon: 'warning', title: 'Choose a CSV file first' });
      return;
    }
    mutation.mutate(file);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">CSV file *</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="form-control"
          required
        />
      </div>

      <div style={{ background: 'var(--border-light)', padding: 12, borderRadius: 8, fontSize: '0.85rem', marginBottom: 12 }}>
        <strong>Expected columns:</strong> <code>name, email, password, phone, gender, class, roll_no</code>
        <br />
        <span className="text-muted">
          Class can be a name like "7th" or "7th - A". Existing students (matched by email) will be updated.
        </span>
      </div>

      {result && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
            background: result.error_count === 0 ? 'var(--success-light)' : 'var(--warning-light)',
            color: result.error_count === 0 ? 'var(--success-dark)' : 'var(--warning-dark)',
          }}
        >
          <strong>✅ {result.success} imported</strong>
          {result.error_count > 0 && (
            <>
              {' '}— ❌ {result.error_count} errors:
              <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                {result.errors.map((e, i) => <li key={i} style={{ fontSize: '0.8rem' }}>{e}</li>)}
              </ul>
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Close</button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? <><i className="fas fa-spinner fa-spin" /> Importing…</> : <><i className="fas fa-upload" /> Upload</>}
        </button>
      </div>
    </form>
  );
}

function AddStudentForm({
  classes,
  onCancel,
  onSuccess,
}: {
  classes: { id: number; name: string; section: string }[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<AddStudentForm>();
  const mutation = useMutation({
    mutationFn: (data: AddStudentForm) => adminApi.addStudent(data),
    onSuccess: () => {
      Swal.fire({ icon: 'success', title: 'Student added', timer: 1500, showConfirmButton: false });
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
        <div className="form-group">
          <label className="form-label">Password *</label>
          <input type="text" className="form-control" {...register('password', { required: 'Required', minLength: { value: 4, message: 'Min 4 chars' } })} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
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
        <div className="form-group">
          <label className="form-label">DOB</label>
          <input type="date" className="form-control" {...register('dob')} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Class</label>
          <select className="form-control" {...register('class_id')}>
            <option value="">— No class —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Roll No</label>
          <input className="form-control" {...register('roll_no')} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Address</label>
        <textarea rows={2} className="form-control" {...register('address')} />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? <><i className="fas fa-spinner fa-spin" /> Adding…</> : 'Add Student'}
        </button>
      </div>
    </form>
  );
}
