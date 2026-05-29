import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';
import type { Graduate } from '@/types/admin';

type Tab = 'active' | 'graduated';

export function BatchesPage() {
  const [tab, setTab] = useState<Tab>('active');

  return (
    <div>
      <PageHeader
        icon="fa-layer-group"
        title="Batches"
        subtitle="Students grouped by academic-year cohort"
      />

      {/* Help banner */}
      <div
        className="card"
        style={{
          marginBottom: 16,
          background: 'var(--surface)',
          borderLeft: '4px solid var(--primary)',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <i
            className="fas fa-circle-info"
            style={{ color: 'var(--primary)', fontSize: '1.2rem', marginTop: 2 }}
          />
          <div className="text-sm">
            <strong>What is a batch?</strong> A batch is the group of students tagged with the same
            academic year (e.g. all classes marked <code>2025-2026</code>). Use this page to see whole
            year-cohorts at a glance, and to find <strong>graduated students</strong> from prior years.
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <TabButton active={tab === 'active'} onClick={() => setTab('active')} icon="fa-layer-group">
          Active Batches
        </TabButton>
        <TabButton active={tab === 'graduated'} onClick={() => setTab('graduated')} icon="fa-graduation-cap">
          Graduated
        </TabButton>
      </div>

      {tab === 'active' ? <ActiveBatches /> : <GraduatedBatches />}
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

function ActiveBatches() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'batches'],
    queryFn: () => adminApi.listBatches(),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={apiErrorMessage(error)} />;
  const batches = data ?? [];

  if (batches.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon="fa-layer-group"
          title="No batches yet"
          description="Create classes with academic years (e.g. 2025-2026) to see batch summaries here."
        />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
      }}
    >
      {batches.map((b) => {
        const yearKey = b.academic_year ?? '(none)';
        const pctColor =
          b.attendance_pct >= 75
            ? '#10b981'
            : b.attendance_pct >= 50
              ? '#f59e0b'
              : '#ef4444';
        return (
          <Link
            key={yearKey}
            to={`/admin/batches/${encodeURIComponent(yearKey)}`}
            className="card"
            style={{
              textDecoration: 'none',
              color: 'inherit',
              display: 'block',
              borderLeft: `4px solid ${pctColor}`,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>
              <i className="fas fa-calendar-alt" style={{ color: 'var(--primary)', marginRight: 8 }} />
              {b.academic_year ?? 'Unassigned year'}
            </h3>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <div>
                <div className="text-xs text-muted">Classes</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{b.class_count}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Students</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{b.student_count}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Avg attendance</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: pctColor }}>
                  {b.attendance_pct}%
                </div>
              </div>
            </div>
            <div className="text-xs text-muted" style={{ textAlign: 'right' }}>
              {b.attendance_present} of {b.attendance_total} attendance records present
            </div>
            <div
              style={{
                marginTop: 12,
                fontSize: '0.85rem',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              View details <i className="fas fa-arrow-right" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function GraduatedBatches() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'graduates'],
    queryFn: () => adminApi.listGraduates(),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: number) => adminApi.reactivateGraduate(id),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      Swal.fire({
        icon: 'success',
        title: resp.message,
        timer: 2200,
        showConfirmButton: false,
      });
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  const handleReactivate = async (g: Graduate) => {
    const r = await Swal.fire({
      title: `Reactivate ${g.name}?`,
      text: 'Their account will become active again. You still need to assign them to a class from the Students page.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Reactivate',
    });
    if (r.isConfirmed) reactivateMutation.mutate(g.id);
  };

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={apiErrorMessage(error)} />;

  if (data.total === 0) {
    return (
      <div className="card">
        <EmptyState
          icon="fa-graduation-cap"
          title="No graduates yet"
          description="Once you graduate a class, the alumni show up here grouped by their year."
        />
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? data.groups
        .map((g) => ({
          ...g,
          students: g.students.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              s.email.toLowerCase().includes(q) ||
              (s.old_roll_no ?? '').toLowerCase().includes(q),
          ),
        }))
        .filter((g) => g.students.length > 0)
    : data.groups;

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Search graduates</label>
          <input
            className="form-control"
            placeholder="Name, email, or old roll number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-sm text-muted" style={{ marginTop: 8 }}>
          Total graduates: <strong>{data.total}</strong> across {data.groups.length} year(s)
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon="fa-magnifying-glass" title="No matches" />
        </div>
      ) : (
        filtered.map((group) => (
          <div key={group.academic_year ?? '(unknown)'} className="card" style={{ marginBottom: 16, padding: 0 }}>
            <div
              style={{
                padding: 16,
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0 }}>
                <i className="fas fa-graduation-cap" style={{ color: 'var(--primary)', marginRight: 8 }} />
                Batch {group.academic_year ?? 'Unknown year'}
              </h3>
              <span className="badge badge-neutral">{group.count} alumni</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Roll</th>
                    <th>Name</th>
                    <th>From class</th>
                    <th>Phone</th>
                    <th>Graduated on</th>
                    <th>Reason</th>
                    <th>By</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.students.map((s) => (
                    <tr key={s.id}>
                      <td>{s.old_roll_no ?? '—'}</td>
                      <td>
                        <strong>{s.name}</strong>
                        <div className="text-muted text-xs">{s.email}</div>
                        {s.is_active === 1 && (
                          <span className="badge badge-success" style={{ marginTop: 4 }}>
                            Reactivated
                          </span>
                        )}
                      </td>
                      <td>
                        {s.from_class_name ? `${s.from_class_name} ${s.from_section ?? ''}` : '—'}
                      </td>
                      <td className="text-sm">
                        {s.phone ? (
                          <a href={`tel:${s.phone}`}>
                            <i className="fas fa-phone" style={{ marginRight: 4 }} />
                            {s.phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="text-sm">{(s.promoted_at || '').slice(0, 10)}</td>
                      <td className="text-sm text-muted">{s.reason ?? '—'}</td>
                      <td className="text-sm text-muted">{s.promoted_by_name ?? '—'}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <Link to={`/admin/students/${s.id}`} className="btn btn-secondary btn-sm">
                          <i className="fas fa-eye" /> View
                        </Link>{' '}
                        {!s.is_active && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleReactivate(s)}
                            disabled={reactivateMutation.isPending}
                          >
                            <i className="fas fa-rotate-left" /> Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
