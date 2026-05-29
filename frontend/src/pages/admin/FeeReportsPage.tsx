import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';
import type { FeeMode } from '@/types/admin';

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

export function FeeReportsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'fees', 'reports'],
    queryFn: () => adminApi.feeReports(),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={apiErrorMessage(error)} />;
  if (!data) return null;

  return (
    <div>
      <PageHeader
        icon="fa-chart-line"
        title="Fee Reports"
        subtitle="Collections and defaulters at a glance"
        actions={
          <Link to="/admin/fees" className="btn btn-secondary">
            <i className="fas fa-arrow-left" /> Back to Fees
          </Link>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <StatBox label="Collected Today" value={inr(data.totals.today)} icon="fa-calendar-day" />
        <StatBox label="This Month" value={inr(data.totals.this_month)} icon="fa-calendar" />
        <StatBox label="This Year" value={inr(data.totals.this_year)} icon="fa-calendar-alt" />
        <StatBox label="All Time" value={inr(data.totals.all_time)} icon="fa-vault" color="var(--primary)" />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="card">
          <h3 style={{ marginTop: 0 }}>By Payment Mode</h3>
          {data.by_mode.length === 0 ? (
            <EmptyState icon="fa-credit-card" title="No payments yet" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Mode</th>
                  <th style={{ textAlign: 'right' }}>Count</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.by_mode.map((m) => (
                  <tr key={m.mode}>
                    <td>{MODE_LABELS[m.mode] ?? m.mode}</td>
                    <td style={{ textAlign: 'right' }}>{m.count}</td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{inr(m.total)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>By Class (Collected)</h3>
          {data.by_class.length === 0 ? (
            <EmptyState icon="fa-school" title="No classes" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Class</th>
                  <th style={{ textAlign: 'right' }}>Payments</th>
                  <th style={{ textAlign: 'right' }}>Collected</th>
                </tr>
              </thead>
              <tbody>
                {data.by_class.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong> <span className="text-muted">{c.section}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{c.payment_count}</td>
                    <td style={{ textAlign: 'right' }}>{inr(c.collected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Recent Payments (last 20)</h3>
      <div className="card" style={{ padding: 0, marginBottom: 24 }}>
        {data.recent.length === 0 ? (
          <EmptyState icon="fa-clock-rotate-left" title="No payments yet" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Head</th>
                  <th>Mode</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <code style={{ fontSize: '0.85em' }}>{p.receipt_no}</code>
                    </td>
                    <td>{p.paid_date}</td>
                    <td>{p.student_name}</td>
                    <td>
                      {p.class_name ?? '—'} {p.section ?? ''}
                    </td>
                    <td>{p.head_name}</td>
                    <td>
                      <span className="badge badge-neutral">{MODE_LABELS[p.mode] ?? p.mode}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{inr(p.amount)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <h3 style={{ marginTop: 0, marginBottom: 12 }}>
        Defaulters ({data.defaulters.length}
        {data.defaulters.length === 100 ? '+' : ''})
      </h3>
      <div className="card" style={{ padding: 0 }}>
        {data.defaulters.length === 0 ? (
          <EmptyState
            icon="fa-circle-check"
            title="All clear"
            description="No outstanding dues."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Phone</th>
                  <th style={{ textAlign: 'right' }}>Demand</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th style={{ textAlign: 'right' }}>Due</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.defaulters.map((d) => (
                  <tr key={d.id}>
                    <td>{d.roll_no ?? '—'}</td>
                    <td>
                      <strong>{d.name}</strong>
                    </td>
                    <td>
                      {d.class_name} {d.section}
                    </td>
                    <td>{d.phone ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>{inr(d.total)}</td>
                    <td style={{ textAlign: 'right' }}>{inr(d.paid)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <strong style={{ color: 'var(--danger)' }}>{inr(d.due)}</strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to={`/admin/fees/student/${d.id}`} className="btn btn-primary btn-sm">
                        <i className="fas fa-rupee-sign" /> Collect
                      </Link>
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
