import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

export function BatchDetailPage() {
  const { year } = useParams<{ year: string }>();
  const navigate = useNavigate();
  const yearKey = year ?? '(none)';
  const yearLabel = yearKey === '(none)' ? 'Unassigned year' : yearKey;

  const [classFilter, setClassFilter] = useState<string>(''); // '' = all classes in batch
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'batch-detail', yearKey],
    queryFn: () => adminApi.batchDetail(yearKey === '(none)' ? null : yearKey),
  });

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.students.filter((s) => {
      if (classFilter && String(s.class_id) !== classFilter) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q) && !(s.roll_no ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, classFilter, search]);

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  // Compute batch totals
  const totalStudents = data.students.length;
  const totalMarked = data.students.reduce((s, r) => s + r.total, 0);
  const totalPresent = data.students.reduce((s, r) => s + r.present, 0);
  const totalAbsent = data.students.reduce((s, r) => s + r.absent, 0);
  const avgPct = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 1000) / 10 : 0;
  const pctColor = avgPct >= 75 ? '#10b981' : avgPct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div>
      <PageHeader
        icon="fa-calendar-alt"
        title={`Batch ${yearLabel}`}
        subtitle={`${data.classes.length} class(es) · ${totalStudents} student(s)`}
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/admin/batches')}>
            <i className="fas fa-arrow-left" /> All batches
          </button>
        }
      />

      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <StatCard label="Students" value={totalStudents} icon="fa-user-graduate" color="#6366f1" />
        <StatCard label="Classes" value={data.classes.length} icon="fa-school" color="#06b6d4" />
        <StatCard label="Total records" value={totalMarked} icon="fa-clipboard-list" color="#8b5cf6" />
        <StatCard label="Present" value={totalPresent} icon="fa-check" color="#10b981" />
        <StatCard label="Absent" value={totalAbsent} icon="fa-times" color="#ef4444" />
        <StatCard label="Avg %" value={`${avgPct}%`} icon="fa-percent" color={pctColor} />
      </div>

      {/* Classes summary table */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>
          <i className="fas fa-school" style={{ color: 'var(--primary)', marginRight: 8 }} />
          Classes in this batch
        </h3>
        {data.classes.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>No classes for this year.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Section</th>
                  <th>Class Teacher</th>
                  <th style={{ textAlign: 'center' }}>Students</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.classes.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.section}</td>
                    <td>{c.class_teacher_name ?? <span className="text-muted">—</span>}</td>
                    <td style={{ textAlign: 'center' }}>{c.student_count}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setClassFilter(String(c.id))}
                      >
                        Show students
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Students table with filters */}
      <div className="card" style={{ padding: 0 }}>
        <div
          style={{
            padding: 16,
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0 }}>
            <i className="fas fa-user-graduate" style={{ color: 'var(--primary)', marginRight: 8 }} />
            Students ({filteredStudents.length})
          </h3>
          <span style={{ flex: 1 }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search name, email, roll…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 240 }}
          />
          <select
            className="form-control"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            style={{ maxWidth: 220 }}
          >
            <option value="">All classes</option>
            {data.classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
            ))}
          </select>
        </div>

        {filteredStudents.length === 0 ? (
          <EmptyState
            icon="fa-user-graduate"
            title="No students match the filter"
            description={data.students.length === 0 ? 'This batch has no enrolled students.' : 'Try clearing the search or class filter.'}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Name</th>
                  <th>Class</th>
                  <th>Email</th>
                  <th style={{ textAlign: 'center' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>Present</th>
                  <th style={{ textAlign: 'center' }}>Absent</th>
                  <th style={{ textAlign: 'center' }}>%</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => {
                  const sPct = s.pct;
                  const cls = sPct >= 75 ? 'badge-success' : sPct >= 50 ? 'badge-warning' : 'badge-danger';
                  return (
                    <tr key={s.id}>
                      <td>{s.roll_no ?? '—'}</td>
                      <td>
                        <strong>{s.name}</strong>
                        {!s.is_active && <> <span className="badge badge-danger">Archived</span></>}
                      </td>
                      <td>{s.class_name} - {s.section}</td>
                      <td>{s.email}</td>
                      <td style={{ textAlign: 'center' }}>{s.total}</td>
                      <td style={{ textAlign: 'center', color: 'var(--success)' }}>{s.present}</td>
                      <td style={{ textAlign: 'center', color: 'var(--danger)' }}>{s.absent}</td>
                      <td style={{ textAlign: 'center' }}>
                        {s.total > 0 ? (
                          <span className={`badge ${cls}`}>{s.pct}%</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link to={`/admin/students/${s.id}`} className="btn btn-primary btn-sm">
                          <i className="fas fa-eye" /> View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
