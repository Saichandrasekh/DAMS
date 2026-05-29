import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

function inr(n: number): string {
  return `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function FeesPage() {
  const [classFilter, setClassFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'fees', 'students', classFilter || 'all'],
    queryFn: () => adminApi.listFeeStudents(classFilter ? Number(classFilter) : undefined),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={apiErrorMessage(error)} />;

  const all = data?.students ?? [];
  const classes = data?.classes ?? [];
  const filtered = all.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !s.name.toLowerCase().includes(q) &&
        !(s.roll_no ?? '').toLowerCase().includes(q) &&
        !s.email.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const totals = filtered.reduce(
    (acc, s) => {
      acc.total += s.total;
      acc.paid += s.paid;
      acc.due += s.due;
      return acc;
    },
    { total: 0, paid: 0, due: 0 },
  );

  return (
    <div>
      <PageHeader
        icon="fa-money-check-dollar"
        title="Fee Collection"
        subtitle={`${filtered.length} student${filtered.length === 1 ? '' : 's'} · Demand ${inr(totals.total)} · Collected ${inr(totals.paid)} · Due ${inr(totals.due)}`}
        actions={
          <>
            <Link to="/admin/fees/structure" className="btn btn-secondary">
              <i className="fas fa-sack-dollar" /> Fee Structure
            </Link>
            <Link to="/admin/fees/reports" className="btn btn-secondary">
              <i className="fas fa-chart-line" /> Reports
            </Link>
          </>
        }
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Class</label>
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
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Status</label>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="pending">Pending (nothing paid)</option>
              <option value="partial">Partial</option>
              <option value="paid">Fully paid</option>
              <option value="no_dues">No dues set</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search</label>
            <input
              className="form-control"
              placeholder="Name, roll, email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="fa-money-check-dollar"
            title="No students match"
            description="Try changing filters or adding fee heads from the Fee Structure page."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Student</th>
                  <th>Class</th>
                  <th style={{ textAlign: 'right' }}>Demand</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th style={{ textAlign: 'right' }}>Due</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>{s.roll_no ?? '—'}</td>
                    <td>
                      <strong>{s.name}</strong>
                      <div className="text-muted text-xs">{s.email}</div>
                    </td>
                    <td>
                      {s.class_name} {s.section}
                    </td>
                    <td style={{ textAlign: 'right' }}>{inr(s.total)}</td>
                    <td style={{ textAlign: 'right' }}>{inr(s.paid)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <strong style={{ color: s.due > 0 ? 'var(--danger)' : 'var(--text)' }}>
                        {inr(s.due)}
                      </strong>
                    </td>
                    <td>
                      {s.status === 'paid' && <span className="badge badge-success">Paid</span>}
                      {s.status === 'partial' && <span className="badge badge-warning">Partial</span>}
                      {s.status === 'pending' && <span className="badge badge-danger">Pending</span>}
                      {s.status === 'no_dues' && <span className="badge badge-neutral">No dues</span>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Link to={`/admin/fees/student/${s.id}`} className="btn btn-primary btn-sm">
                        <i className="fas fa-eye" /> View / Collect
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
