import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { useForm } from 'react-hook-form';
import { superadminApi } from '@/api/superadmin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';
import type { AdminCredential, UpdateCredentialInput } from '@/types/superadmin';

export function CredentialsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AdminCredential | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['superadmin', 'credentials'],
    queryFn: () => superadminApi.listCredentials(),
  });

  const resetMutation = useMutation({
    mutationFn: async (cred: AdminCredential) => {
      const { value: newPwd } = await Swal.fire({
        title: `Reset password for ${cred.admin_name}?`,
        input: 'text',
        inputLabel: 'New password (min 6 chars)',
        inputAttributes: { autocapitalize: 'off' },
        showCancelButton: true,
        confirmButtonText: 'Reset',
        confirmButtonColor: '#4f46e5',
        inputValidator: (v) => (!v || v.length < 6 ? 'At least 6 characters required' : null),
      });
      if (!newPwd) throw new Error('cancelled');
      await superadminApi.updateCredential(cred.user_id!, {
        name: cred.admin_name ?? '',
        email: cred.admin_email ?? '',
        phone: cred.admin_phone ?? '',
        is_active: cred.is_active === 1,
        new_password: newPwd,
      });
      return newPwd;
    },
    onSuccess: (newPwd) => {
      qc.invalidateQueries({ queryKey: ['superadmin', 'credentials'] });
      Swal.fire({
        icon: 'success',
        title: 'Password reset',
        html: `Share this new password securely:<br/><code style="font-size:1.2rem;font-weight:700">${newPwd}</code>`,
      });
    },
    onError: (err) => {
      if ((err as Error).message === 'cancelled') return;
      Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) });
    },
  });

  const credentials = data ?? [];

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={apiErrorMessage(error)} />;

  return (
    <div>
      <PageHeader
        icon="fa-key"
        title="Admin Credentials"
        subtitle="View admin accounts. Use Reset to issue a new password securely."
      />

      <div
        className="card"
        style={{ marginBottom: 16, background: 'var(--primary-light)', borderLeft: '4px solid var(--primary)' }}
      >
        <p style={{ margin: 0, fontSize: '0.875rem' }}>
          <i className="fas fa-shield-halved" style={{ marginRight: 8, color: 'var(--primary)' }} />
          <strong>Passwords are no longer stored in plaintext.</strong> Use <em>Reset</em> to issue a new one and share it directly with the admin.
        </p>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {credentials.length === 0 ? (
          <EmptyState icon="fa-key" title="No credentials yet" description="Add a school first." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>School</th>
                  <th>Admin</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((c) => (
                  <tr key={`${c.school_id}-${c.user_id ?? 'none'}`}>
                    <td>
                      <strong>{c.school_name}</strong>
                      <div className="text-xs text-muted"><code>{c.school_code}</code></div>
                    </td>
                    <td>{c.admin_name ?? <span className="text-muted">— no admin —</span>}</td>
                    <td>{c.admin_email ?? '—'}</td>
                    <td>{c.admin_phone ?? '—'}</td>
                    <td>
                      {c.user_id ? (
                        c.is_active ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <span className="badge badge-danger">Inactive</span>
                        )
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {c.user_id && (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditing(c)}
                          >
                            <i className="fas fa-pen" /> Edit
                          </button>{' '}
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => resetMutation.mutate(c)}
                            disabled={resetMutation.isPending}
                          >
                            <i className="fas fa-rotate-right" /> Reset
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <EditCredentialModal
          credential={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['superadmin', 'credentials'] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

interface EditCredentialModalProps {
  credential: AdminCredential;
  onClose: () => void;
  onSaved: () => void;
}

function EditCredentialModal({ credential, onClose, onSaved }: EditCredentialModalProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<UpdateCredentialInput>({
    defaultValues: {
      name: credential.admin_name ?? '',
      email: credential.admin_email ?? '',
      phone: credential.admin_phone ?? '',
      is_active: credential.is_active === 1,
    },
  });

  const mutation = useMutation({
    mutationFn: (input: UpdateCredentialInput) =>
      superadminApi.updateCredential(credential.user_id!, input),
    onSuccess: () => {
      Swal.fire({ icon: 'success', title: 'Credentials updated', timer: 1500, showConfirmButton: false });
      onSaved();
    },
    onError: (err) => {
      Swal.fire({ icon: 'error', title: 'Failed to update', text: apiErrorMessage(err) });
    },
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="card"
        style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }}
      >
        <h3 style={{ marginTop: 0 }}>Edit admin — {credential.school_name}</h3>

        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="form-control" {...register('name', { required: 'Required' })} />
          {errors.name && <small style={{ color: 'var(--danger)' }}>{errors.name.message}</small>}
        </div>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input type="email" className="form-control" {...register('email', { required: 'Required' })} />
          {errors.email && <small style={{ color: 'var(--danger)' }}>{errors.email.message}</small>}
        </div>

        <div className="form-group">
          <label className="form-label">Phone</label>
          <input className="form-control" {...register('phone')} />
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" {...register('is_active')} /> Active
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <><i className="fas fa-spinner fa-spin" /> Saving…</> : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
