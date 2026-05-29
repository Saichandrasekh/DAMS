import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { Modal } from '@/components/Modal';
import { apiErrorMessage } from '@/lib/api';
import type { FeeCycle, FeeHead } from '@/types/admin';

interface FeeHeadForm {
  class_id: number;
  name: string;
  amount: number;
  cycle: FeeCycle;
  academic_year?: string;
}

function inr(n: number): string {
  return `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function FeeStructurePage() {
  const qc = useQueryClient();
  const [classFilter, setClassFilter] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FeeHead | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'fees', 'heads', classFilter || 'all'],
    queryFn: () => adminApi.listFeeHeads(classFilter ? Number(classFilter) : undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteFeeHead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'fees'] });
      Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, showConfirmButton: false });
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  const handleDelete = async (h: FeeHead) => {
    const r = await Swal.fire({
      title: `Delete "${h.name}"?`,
      text: `Fee head for ${h.class_name} ${h.section}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
    });
    if (r.isConfirmed) deleteMutation.mutate(h.id);
  };

  const heads = data?.heads ?? [];
  const classes = data?.classes ?? [];
  const totalPerYear = useMemo(
    () =>
      heads.reduce(
        (sum, h) => sum + (h.cycle === 'monthly' ? Number(h.amount) * 12 : Number(h.amount)),
        0,
      ),
    [heads],
  );

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={apiErrorMessage(error)} />;

  return (
    <div>
      <PageHeader
        icon="fa-sack-dollar"
        title="Fee Structure"
        subtitle={`${heads.length} fee head${heads.length === 1 ? '' : 's'} · Total per student/year ${inr(totalPerYear)}`}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <i className="fas fa-plus" /> Add Fee Head
          </button>
        }
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Filter by class</label>
          <select
            className="form-control"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.section}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {heads.length === 0 ? (
          <EmptyState
            icon="fa-sack-dollar"
            title="No fee heads yet"
            description="Add fee heads (e.g. Tuition, Transport, Exam Fee) for each class to begin collecting fees."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Fee Head</th>
                  <th>Cycle</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Annualized</th>
                  <th>Year</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {heads.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <strong>{h.class_name}</strong> <span className="text-muted">{h.section}</span>
                    </td>
                    <td>{h.name}</td>
                    <td>
                      {h.cycle === 'monthly' ? (
                        <span className="badge badge-info">Monthly</span>
                      ) : (
                        <span className="badge badge-primary">Annual</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>{inr(h.amount)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {inr(h.cycle === 'monthly' ? Number(h.amount) * 12 : Number(h.amount))}
                    </td>
                    <td>{h.academic_year ?? '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditing(h)}
                      >
                        <i className="fas fa-pen" />
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(h)}
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

      <Modal open={adding} onClose={() => setAdding(false)} title="Add Fee Head">
        <FeeHeadFormInline
          mode="add"
          classes={classes}
          onCancel={() => setAdding(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['admin', 'fees'] });
            setAdding(false);
          }}
        />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : ''}
      >
        {editing && (
          <FeeHeadFormInline
            mode="edit"
            classes={classes}
            initial={editing}
            onCancel={() => setEditing(null)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ['admin', 'fees'] });
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function FeeHeadFormInline({
  mode,
  initial,
  classes,
  onCancel,
  onSuccess,
}: {
  mode: 'add' | 'edit';
  initial?: FeeHead;
  classes: { id: number; name: string; section: string }[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FeeHeadForm>({
    defaultValues: initial
      ? {
          class_id: initial.class_id,
          name: initial.name,
          amount: initial.amount,
          cycle: initial.cycle,
          academic_year: initial.academic_year ?? '',
        }
      : { cycle: 'annual', academic_year: '2025-2026' },
  });

  const mutation = useMutation({
    mutationFn: (data: FeeHeadForm) =>
      mode === 'add'
        ? adminApi.addFeeHead({
            class_id: Number(data.class_id),
            name: data.name,
            amount: Number(data.amount),
            cycle: data.cycle,
            academic_year: data.academic_year,
          })
        : adminApi.updateFeeHead(initial!.id, {
            name: data.name,
            amount: Number(data.amount),
            cycle: data.cycle,
            academic_year: data.academic_year,
          }),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: mode === 'add' ? 'Fee head added' : 'Saved',
        timer: 1500,
        showConfirmButton: false,
      });
      onSuccess();
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
      <div className="form-group">
        <label className="form-label">Class *</label>
        <select
          className="form-control"
          {...register('class_id', { required: 'Required', valueAsNumber: true })}
          disabled={mode === 'edit'}
        >
          <option value="">— Select class —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.section}
            </option>
          ))}
        </select>
        {errors.class_id && <small style={{ color: 'var(--danger)' }}>{errors.class_id.message}</small>}
      </div>

      <div className="form-group">
        <label className="form-label">Fee Head Name *</label>
        <input
          className="form-control"
          placeholder="e.g. Tuition Fee, Transport, Exam Fee"
          {...register('name', { required: 'Required' })}
        />
        {errors.name && <small style={{ color: 'var(--danger)' }}>{errors.name.message}</small>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Cycle *</label>
          <select className="form-control" {...register('cycle', { required: true })}>
            <option value="annual">Annual (once per year)</option>
            <option value="monthly">Monthly (per month × 12)</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Amount (₹) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="form-control"
            placeholder="0.00"
            {...register('amount', { required: 'Required', min: { value: 0, message: '>= 0' } })}
          />
          {errors.amount && <small style={{ color: 'var(--danger)' }}>{errors.amount.message}</small>}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Academic year</label>
        <input className="form-control" placeholder="2025-2026" {...register('academic_year')} />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <i className="fas fa-spinner fa-spin" /> Saving…
            </>
          ) : mode === 'add' ? (
            'Add Fee Head'
          ) : (
            'Save'
          )}
        </button>
      </div>
    </form>
  );
}
