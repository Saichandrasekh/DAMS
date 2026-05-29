import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentApi } from '@/api/student';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { DiaryEntryCard } from '@/components/DiaryEntryCard';
import { apiErrorMessage } from '@/lib/api';

type Tab = 'all' | 'class' | 'announcements';

export function StudentDiaryPage() {
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['student', 'diary'],
    queryFn: () => studentApi.diary(),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.entries.filter((e) => {
      if (tab === 'class' && e.scope !== 'class') return false;
      if (tab === 'announcements' && e.scope !== 'school') return false;
      if (q && !(
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        (e.posted_by_name ?? '').toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [data, tab, search]);

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
        subtitle="Homework, notes, and school announcements"
      />

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <TabButton active={tab === 'all'} onClick={() => setTab('all')} icon="fa-list">
          All ({counts.all})
        </TabButton>
        <TabButton active={tab === 'class'} onClick={() => setTab('class')} icon="fa-school">
          My Class ({counts.class})
        </TabButton>
        <TabButton active={tab === 'announcements'} onClick={() => setTab('announcements')} icon="fa-bullhorn">
          Announcements ({counts.announcements})
        </TabButton>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Search</label>
          <input
            className="form-control"
            placeholder="Title, content, author"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon="fa-book-open" title="No entries" />
        </div>
      ) : (
        <div>
          {filtered.map((e) => (
            <DiaryEntryCard key={e.id} entry={e} showClass={false} />
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
