import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { superadminApi } from '@/api/superadmin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

export function SchoolsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['superadmin', 'schools'],
    queryFn: () => superadminApi.listSchools(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => superadminApi.deleteSchool(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin'] });
      Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, showConfirmButton: false });
    },
    onError: (err) => {
      Swal.fire({ icon: 'error', title: 'Failed to delete', text: apiErrorMessage(err) });
    },
  });

  const handleDelete = async (id: number, name: string) => {
    const result = await Swal.fire({
      title: `Delete "${name}"?`,
      text: 'This permanently removes the school and all its data. This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    });
    if (result.isConfirmed) deleteMutation.mutate(id);
  };

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={apiErrorMessage(error)} />;

  const schools = data ?? [];

  return (
    <div>
      <PageHeader
        icon="fa-building"
        title="Schools"
        subtitle={`${schools.length} school${schools.length === 1 ? '' : 's'} on the platform`}
        actions={
          <Link to="/superadmin/schools/new" className="btn btn-primary">
            <i className="fas fa-plus" /> Add School
          </Link>
        }
      />

      <div className="card" style={{ padding: 0 }}>
        {schools.length === 0 ? (
          <EmptyState icon="fa-building" title="No schools yet" description="Create your first school to get started." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th style={{ textAlign: 'center' }}>Admins</th>
                  <th style={{ textAlign: 'center' }}>Teachers</th>
                  <th style={{ textAlign: 'center' }}>Students</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td><code>{s.code}</code></td>
                    <td>{s.email ?? <span className="text-muted">—</span>}</td>
                    <td>{s.phone ?? <span className="text-muted">—</span>}</td>
                    <td style={{ textAlign: 'center' }}>{s.admin_count ?? 0}</td>
                    <td style={{ textAlign: 'center' }}>{s.teacher_count ?? 0}</td>
                    <td style={{ textAlign: 'center' }}>{s.student_count ?? 0}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Link to={`/superadmin/schools/${s.id}/edit`} className="btn btn-secondary btn-sm">
                        <i className="fas fa-pen" />
                      </Link>{' '}
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
    </div>
  );
}
