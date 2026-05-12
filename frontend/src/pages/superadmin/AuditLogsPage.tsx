import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { superadminApi } from '@/api/superadmin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

interface Filters {
  school_id: string;
  action: string;
  start_date: string;
  end_date: string;
}

const ACTION_TYPES = ['all', 'LOGIN', 'LOGOUT', 'ADD', 'UPDATE', 'DELETE', 'MARK_ATTENDANCE'];

export function AuditLogsPage() {
  const [filters, setFilters] = useState<Filters>({
    school_id: '',
    action: 'all',
    start_date: '',
    end_date: '',
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['superadmin', 'audit-logs', filters],
    queryFn: () =>
      superadminApi.listAuditLogs({
        school_id: filters.school_id,
        action: filters.action,
        start_date: filters.start_date,
        end_date: filters.end_date,
      }),
  });

  const logs = data?.logs ?? [];
  const schools = data?.schools ?? [];

  return (
    <div>
      <PageHeader
        icon="fa-clipboard-list"
        title="Audit Logs"
        subtitle={`${logs.length} record${logs.length === 1 ? '' : 's'} (most recent 1000)`}
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label className="form-label">School</label>
            <select
              className="form-control"
              value={filters.school_id}
              onChange={(e) => setFilters((f) => ({ ...f, school_id: e.target.value }))}
            >
              <option value="">All schools</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Action</label>
            <select
              className="form-control"
              value={filters.action}
              onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
            >
              {ACTION_TYPES.map((a) => (
                <option key={a} value={a}>{a === 'all' ? 'All actions' : a}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">From date</label>
            <input
              type="date"
              className="form-control"
              value={filters.start_date}
              onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value }))}
            />
          </div>

          <div>
            <label className="form-label">To date</label>
            <input
              type="date"
              className="form-control"
              value={filters.end_date}
              onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={apiErrorMessage(error)} />
        ) : logs.length === 0 ? (
          <EmptyState icon="fa-clipboard-list" title="No audit logs" description="Try adjusting filters." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>User</th>
                  <th>School</th>
                  <th>Details</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                    <td><strong>{log.action}</strong></td>
                    <td>{log.user_name ?? <span className="text-muted">system</span>}</td>
                    <td>{log.school_name ?? <span className="text-muted">—</span>}</td>
                    <td>{log.details ?? <span className="text-muted">—</span>}</td>
                    <td><code style={{ fontSize: '0.75rem' }}>{log.ip_address ?? '—'}</code></td>
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
