import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parentApi } from '@/api/parent';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { DiaryEntryCard } from '@/components/DiaryEntryCard';
import { apiErrorMessage } from '@/lib/api';

type Tab = 'all' | 'class' | 'announcements';

export function ParentDiaryPage() {
  const [tab, setTab] = useState<Tab>('all');
  const [classFilter, setClassFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['parent', 'diary'],
    queryFn: () => parentApi.diary(),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.entries.filter((e) => {
      if (tab === 'class' && e.scope !== 'class') return false;
      if (tab === 'announcements' && e.scope !== 'school') return false;
      if (classFilter && e.scope === 'class' && String(e.class_id) !== classFilter) return false;
      if (q && !(
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        (e.posted_by_name ?? '').toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [data, tab, classFilter, search]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={apiErrorMessage(error)} />;
  if (!data) return null;

  const counts = {
    all: data.entries.length,
    class: data.entries.filter((e) => e.scope === 'class').length,
    announcements: data.entries.filter((e) => e.scope === 'school').length,
  };

  return (
    <div>
      <PageHeader
        icon="fa-book-open"
        title="Diary"
        subtitle="Class diary entries and school announcements for your children"
      />

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <TabButton active={tab === 'all'} onClick={() => setTab('all')} icon="fa-list">
          All ({counts.all})
        </TabButton>
        <TabButton active={tab === 'class'} onClick={() => setTab('class')} icon="fa-school">
          Class entries ({counts.class})
        </TabButton>
        <TabButton active={tab === 'announcements'} onClick={() => setTab('announcements')} icon="fa-bullhorn">
          Announcements ({counts.announcements})
        </TabButton>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search</label>
            <input
              className="form-control"
              placeholder="Title, content, author"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {data.children_classes.length > 1 && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Child's class</label>
              <select
                className="form-control"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <option value="">All my children</option>
                {data.children_classes.map((c) => (
                  <option key={c.class_id} value={c.class_id}>
                    {c.class_name} {c.section}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon="fa-book-open" title="No entries" />
        </div>
      ) : (
        <div>
          {filtered.map((e) => (
            <DiaryEntryCard key={e.id} entry={e} />
          ))}
        </div>
      )}
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
