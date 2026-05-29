import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentApi } from '@/api/student';
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

export function StudentFeesPage() {
  const [receipt, setReceipt] = useState<{ payment: FeePayment; student: FeeStudentDetail['student'] } | null>(
    null,
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['student', 'fees'],
    queryFn: () => studentApi.fees(),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={apiErrorMessage(error)} />;
  if (!data) return null;

  const { student, heads, payments, totals } = data;
  const noClass = !data.class_id;

  return (
    <div>
      <PageHeader
        icon="fa-money-check-dollar"
        title="My Fees"
        subtitle={
          student?.class_name
            ? `${student.class_name} ${student.section ?? ''} · ${data.academic_year ?? ''}`
            : ''
        }
      />

      {noClass && (
        <ErrorState message="You are not assigned to a class yet. Please contact the office." />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <StatBox label="Total Demand" value={inr(totals.total)} icon="fa-receipt" />
        <StatBox label="Paid" value={inr(totals.paid)} icon="fa-circle-check" color="var(--success)" />
        <StatBox
          label="Outstanding"
          value={inr(totals.due)}
          icon="fa-circle-exclamation"
          color={totals.due > 0 ? 'var(--danger)' : 'var(--text-muted)'}
        />
      </div>

      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Fee Breakdown</h3>
      <div className="card" style={{ padding: 0, marginBottom: 24 }}>
        {heads.length === 0 ? (
          <EmptyState
            icon="fa-sack-dollar"
            title="No fees set yet"
            description="The school hasn't published your fee structure. Please check back later."
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
                </tr>
              </thead>
              <tbody>
                {heads.map((h) => (
                  <HeadRow key={h.id} head={h} />
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
                  <th style={{ textAlign: 'right' }}>Receipt</th>
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
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setReceipt({ payment: p, student })}
                      >
                        <i className="fas fa-print" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

function HeadRow({ head }: { head: FeeHeadBreakdown }) {
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
          </tr>
        ))}
    </>
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
          .fee-receipt-printable { position: absolute; top: 0; left: 0; width: 100%; padding: 24px; }
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

        <div className="fee-receipt-row"><span>Receipt No</span><strong>{payment.receipt_no}</strong></div>
        <div className="fee-receipt-row"><span>Date</span><strong>{payment.paid_date}</strong></div>
        <div className="fee-receipt-row"><span>Student</span><strong>{student.name}</strong></div>
        <div className="fee-receipt-row">
          <span>Class / Roll</span>
          <strong>{student.class_name} {student.section} / {student.roll_no ?? '—'}</strong>
        </div>
        <div className="fee-receipt-row">
          <span>Fee Head</span>
          <strong>{payment.head_name}{payment.month ? ` (${payment.month})` : ''}</strong>
        </div>
        <div className="fee-receipt-row"><span>Mode</span><strong>{MODE_LABELS[payment.mode]}</strong></div>
        {payment.remarks && (
          <div className="fee-receipt-row"><span>Remarks</span><strong>{payment.remarks}</strong></div>
        )}
        <div
          className="fee-receipt-row"
          style={{ marginTop: 12, fontSize: '1.2em', borderBottom: '2px solid #333', borderTop: '2px solid #333' }}
        >
          <span>Amount Paid</span>
          <strong>{inr(payment.amount)}</strong>
        </div>

        <div style={{ marginTop: 24, fontSize: '0.8em', color: '#666', textAlign: 'center' }}>
          Collected by {payment.collected_by_name ?? '—'}
        </div>
      </div>

      <div
        className="fee-receipt-no-print"
        style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}
      >
        <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <i className="fas fa-print" /> Print
        </button>
      </div>
    </Modal>
  );
}
