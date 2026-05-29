import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { Modal } from '@/components/Modal';
import { apiErrorMessage } from '@/lib/api';
import type { FeeHeadBreakdown, FeeMode, FeePayment, FeeStudentDetail } from '@/types/admin';

function inr(n: number): string {
  return `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

const MODE_LABELS: Record<FeeMode, string> = {
  cash: 'Cash',
  upi: 'UPI',
  cheque: 'Cheque',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  other: 'Other',
};

interface PayForm {
  amount: number;
  paid_date: string;
  mode: FeeMode;
  month?: string;
  remarks?: string;
}

export function FeeStudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const studentId = Number(id);
  const qc = useQueryClient();
  const [payTarget, setPayTarget] = useState<{ head: FeeHeadBreakdown; month?: string } | null>(null);
  const [receipt, setReceipt] = useState<{ payment: FeePayment; student: FeeStudentDetail['student'] } | null>(
    null,
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'fees', 'student', studentId],
    queryFn: () => adminApi.feeStudentDetail(studentId),
    enabled: !Number.isNaN(studentId),
  });

  const deletePayment = useMutation({
    mutationFn: (pid: number) => adminApi.deleteFeePayment(pid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'fees'] });
      Swal.fire({ icon: 'success', title: 'Payment reversed', timer: 1500, showConfirmButton: false });
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  const handleReversePayment = async (p: FeePayment) => {
    const r = await Swal.fire({
      title: 'Reverse this payment?',
      html: `Receipt <strong>${p.receipt_no}</strong> for ${inr(p.amount)}<br/><span class="text-muted">This will permanently remove the entry.</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
    });
    if (r.isConfirmed) deletePayment.mutate(p.id);
  };

  if (Number.isNaN(studentId)) return <ErrorState message="Invalid student id" />;
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={apiErrorMessage(error)} />;
  if (!data) return <ErrorState message="Not found" />;

  const { student, heads, payments, totals } = data;

  return (
    <div>
      <PageHeader
        icon="fa-user-tag"
        title={student.name}
        subtitle={`${student.class_name ?? '—'} ${student.section ?? ''} · Roll ${student.roll_no ?? '—'} · ${student.academic_year ?? ''}`}
        actions={
          <Link to="/admin/fees" className="btn btn-secondary">
            <i className="fas fa-arrow-left" /> Back
          </Link>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <StatBox label="Total Demand" value={inr(totals.total)} icon="fa-receipt" />
        <StatBox label="Collected" value={inr(totals.paid)} icon="fa-circle-check" color="var(--success)" />
        <StatBox
          label="Outstanding"
          value={inr(totals.due)}
          icon="fa-circle-exclamation"
          color={totals.due > 0 ? 'var(--danger)' : 'var(--text-muted)'}
        />
      </div>

      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Fee Heads</h3>
      <div className="card" style={{ padding: 0, marginBottom: 24 }}>
        {heads.length === 0 ? (
          <EmptyState
            icon="fa-sack-dollar"
            title="No fee heads"
            description="Add fee heads for this class in the Fee Structure page first."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Head</th>
                  <th>Cycle</th>
                  <th style={{ textAlign: 'right' }}>Demand</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th style={{ textAlign: 'right' }}>Due</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {heads.map((h) => (
                  <HeadRow
                    key={h.id}
                    head={h}
                    onCollect={(month) => setPayTarget({ head: h, month })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Payment History ({payments.length})</h3>
      <div className="card" style={{ padding: 0 }}>
        {payments.length === 0 ? (
          <EmptyState icon="fa-clock-rotate-left" title="No payments yet" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Date</th>
                  <th>Head</th>
                  <th>Month</th>
                  <th>Mode</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Collected by</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <code style={{ fontSize: '0.85em' }}>{p.receipt_no}</code>
                    </td>
                    <td>{p.paid_date}</td>
                    <td>{p.head_name}</td>
                    <td>{p.month ?? '—'}</td>
                    <td>
                      <span className="badge badge-neutral">{MODE_LABELS[p.mode]}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{inr(p.amount)}</strong>
                    </td>
                    <td className="text-muted text-sm">{p.collected_by_name ?? '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setReceipt({ payment: p, student })}
                      >
                        <i className="fas fa-print" /> Receipt
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleReversePayment(p)}
                        disabled={deletePayment.isPending}
                      >
                        <i className="fas fa-undo" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        title={payTarget ? `Collect — ${payTarget.head.name}${payTarget.month ? ` (${payTarget.month})` : ''}` : ''}
      >
        {payTarget && (
          <CollectForm
            studentId={studentId}
            head={payTarget.head}
            month={payTarget.month}
            onCancel={() => setPayTarget(null)}
            onSuccess={(payment) => {
              qc.invalidateQueries({ queryKey: ['admin', 'fees'] });
              setPayTarget(null);
              setReceipt({ payment, student });
            }}
          />
        )}
      </Modal>

      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

function StatBox({ label, value, icon, color }: { label: string; value: string; icon: string; color?: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'var(--background)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: color ?? 'var(--primary)',
            fontSize: '1.2rem',
          }}
        >
          <i className={`fas ${icon}`} />
        </div>
        <div>
          <div className="text-muted text-xs">{label}</div>
          <div style={{ fontWeight: 700, fontSize: '1.15rem', color: color ?? 'var(--text)' }}>{value}</div>
        </div>
      </div>
    </div>
  );
}

function HeadRow({
  head,
  onCollect,
}: {
  head: FeeHeadBreakdown;
  onCollect: (month?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isMonthly = head.cycle === 'monthly';

  return (
    <>
      <tr>
        <td>
          {isMonthly && (
            <button
              type="button"
              style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: 4 }}
              onClick={() => setExpanded((v) => !v)}
              aria-label="Toggle months"
            >
              <i className={`fas fa-chevron-${expanded ? 'down' : 'right'}`} />
            </button>
          )}
          <strong>{head.name}</strong>
        </td>
        <td>
          {isMonthly ? (
            <span className="badge badge-info">Monthly</span>
          ) : (
            <span className="badge badge-primary">Annual</span>
          )}
        </td>
        <td style={{ textAlign: 'right' }}>{inr(head.total)}</td>
        <td style={{ textAlign: 'right' }}>{inr(head.paid)}</td>
        <td style={{ textAlign: 'right' }}>
          <strong style={{ color: head.due > 0 ? 'var(--danger)' : 'var(--text)' }}>{inr(head.due)}</strong>
        </td>
        <td>
          {head.status === 'paid' && <span className="badge badge-success">Paid</span>}
          {head.status === 'partial' && <span className="badge badge-warning">Partial</span>}
          {head.status === 'pending' && <span className="badge badge-danger">Pending</span>}
        </td>
        <td style={{ textAlign: 'right' }}>
          {!isMonthly && head.due > 0 && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onCollect()}>
              <i className="fas fa-rupee-sign" /> Collect
            </button>
          )}
          {isMonthly && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Hide months' : 'Show months'}
            </button>
          )}
        </td>
      </tr>
      {isMonthly &&
        expanded &&
        (head.months ?? []).map((m) => (
          <tr key={m.month} style={{ background: 'var(--background)' }}>
            <td style={{ paddingLeft: 40 }}>
              <i className="fas fa-calendar" style={{ marginRight: 6, color: 'var(--text-muted)' }} />
              {m.month}
            </td>
            <td className="text-muted text-xs">monthly</td>
            <td style={{ textAlign: 'right' }}>{inr(m.amount)}</td>
            <td style={{ textAlign: 'right' }}>{inr(m.paid)}</td>
            <td style={{ textAlign: 'right' }}>{inr(m.due)}</td>
            <td>
              {m.status === 'paid' && <span className="badge badge-success">Paid</span>}
              {m.status === 'partial' && <span className="badge badge-warning">Partial</span>}
              {m.status === 'pending' && <span className="badge badge-danger">Pending</span>}
            </td>
            <td style={{ textAlign: 'right' }}>
              {m.due > 0 && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onCollect(m.month)}
                >
                  <i className="fas fa-rupee-sign" /> Collect
                </button>
              )}
            </td>
          </tr>
        ))}
    </>
  );
}

function CollectForm({
  studentId,
  head,
  month,
  onCancel,
  onSuccess,
}: {
  studentId: number;
  head: FeeHeadBreakdown;
  month?: string;
  onCancel: () => void;
  onSuccess: (payment: FeePayment) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const monthDue =
    head.cycle === 'monthly' && month
      ? head.months?.find((m) => m.month === month)?.due ?? head.amount
      : head.due;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PayForm>({
    defaultValues: { amount: monthDue, paid_date: today, mode: 'cash', month: month ?? '', remarks: '' },
  });

  const mutation = useMutation({
    mutationFn: (data: PayForm) =>
      adminApi.addFeePayment({
        student_id: studentId,
        fee_head_id: head.id,
        amount: Number(data.amount),
        paid_date: data.paid_date,
        mode: data.mode,
        month: head.cycle === 'monthly' ? month : undefined,
        remarks: data.remarks || undefined,
      }),
    onSuccess: (res) => {
      Swal.fire({ icon: 'success', title: 'Payment recorded', timer: 1500, showConfirmButton: false });
      onSuccess(res.payment);
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
      <div
        className="card"
        style={{ background: 'var(--background)', marginBottom: 12, padding: 12 }}
      >
        <div className="text-sm">
          <div>
            <strong>{head.name}</strong>{' '}
            <span className="text-muted">({head.cycle === 'monthly' ? 'Monthly' : 'Annual'})</span>
          </div>
          {month && (
            <div>
              For month: <strong>{month}</strong>
            </div>
          )}
          <div>
            Outstanding: <strong style={{ color: 'var(--danger)' }}>{inr(monthDue)}</strong>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Amount (₹) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className="form-control"
            {...register('amount', { required: 'Required', min: { value: 0.01, message: '> 0' } })}
          />
          {errors.amount && <small style={{ color: 'var(--danger)' }}>{errors.amount.message}</small>}
        </div>
        <div className="form-group">
          <label className="form-label">Date *</label>
          <input
            type="date"
            className="form-control"
            {...register('paid_date', { required: 'Required' })}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Mode *</label>
        <select className="form-control" {...register('mode', { required: true })}>
          {Object.entries(MODE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Remarks</label>
        <input
          className="form-control"
          placeholder="Cheque no, reference, etc."
          {...register('remarks')}
        />
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
          ) : (
            <>
              <i className="fas fa-rupee-sign" /> Record Payment
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: { payment: FeePayment; student: FeeStudentDetail['student'] } | null;
  onClose: () => void;
}) {
  if (!receipt) return null;
  const { payment, student } = receipt;

  return (
    <Modal open={!!receipt} onClose={onClose} title="Fee Receipt" width={560}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .fee-receipt-printable, .fee-receipt-printable * { visibility: visible; }
          .fee-receipt-printable {
            position: absolute; top: 0; left: 0; width: 100%; padding: 24px;
          }
          .fee-receipt-no-print { display: none !important; }
        }
        .fee-receipt-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #ddd; }
      `}</style>

      <div className="fee-receipt-printable" style={{ fontFamily: 'sans-serif', padding: 8 }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #333', paddingBottom: 12, marginBottom: 12 }}>
          {student.school_logo && (
            <img
              src={student.school_logo}
              alt="logo"
              style={{ width: 60, height: 60, objectFit: 'contain', marginBottom: 8 }}
            />
          )}
          <h2 style={{ margin: 0 }}>{student.school_name ?? 'School'}</h2>
          {student.school_address && (
            <div style={{ fontSize: '0.85em', color: '#555' }}>{student.school_address}</div>
          )}
          {student.school_phone && (
            <div style={{ fontSize: '0.85em', color: '#555' }}>Phone: {student.school_phone}</div>
          )}
          <div style={{ marginTop: 8, fontWeight: 700, fontSize: '1.1em' }}>FEE RECEIPT</div>
        </div>

        <div className="fee-receipt-row">
          <span>Receipt No</span>
          <strong>{payment.receipt_no}</strong>
        </div>
        <div className="fee-receipt-row">
          <span>Date</span>
          <strong>{payment.paid_date}</strong>
        </div>
        <div className="fee-receipt-row">
          <span>Student</span>
          <strong>{student.name}</strong>
        </div>
        <div className="fee-receipt-row">
          <span>Class / Roll</span>
          <strong>
            {student.class_name} {student.section} / {student.roll_no ?? '—'}
          </strong>
        </div>
        <div className="fee-receipt-row">
          <span>Fee Head</span>
          <strong>
            {payment.head_name}
            {payment.month ? ` (${payment.month})` : ''}
          </strong>
        </div>
        <div className="fee-receipt-row">
          <span>Mode</span>
          <strong>{MODE_LABELS[payment.mode]}</strong>
        </div>
        {payment.remarks && (
          <div className="fee-receipt-row">
            <span>Remarks</span>
            <strong>{payment.remarks}</strong>
          </div>
        )}
        <div
          className="fee-receipt-row"
          style={{ marginTop: 12, fontSize: '1.2em', borderBottom: '2px solid #333', borderTop: '2px solid #333' }}
        >
          <span>Amount Paid</span>
          <strong>{inr(payment.amount)}</strong>
        </div>

        <div style={{ marginTop: 24, fontSize: '0.8em', color: '#666', textAlign: 'center' }}>
          Thank you. Collected by {payment.collected_by_name ?? '—'}.
        </div>
      </div>

      <div
        className="fee-receipt-no-print"
        style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}
      >
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <i className="fas fa-print" /> Print
        </button>
      </div>
    </Modal>
  );
}
