import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { adminApi } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState';
import { Modal } from '@/components/Modal';
import { DiaryEntryCard } from '@/components/DiaryEntryCard';
import { apiErrorMessage } from '@/lib/api';
import type { DiaryEntry } from '@/types/admin';

type Tab = 'announcements' | 'class_entries';

interface DiaryForm {
  title: string;
  content: string;
  entry_date: string;
  link?: string;
  class_id?: number;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function AdminDiaryPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('announcements');
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [classFilter, setClassFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'diary', tab, classFilter],
    queryFn: () =>
      adminApi.listDiary({
        scope: tab === 'announcements' ? 'school' : 'class',
        class_id: classFilter ? Number(classFilter) : undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteDiary(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'diary'] });
      Swal.fire({ icon: 'success', title: 'Deleted', timer: 1200, showConfirmButton: false });
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  const handleDelete = async (entry: DiaryEntry) => {
    const r = await Swal.fire({
      title: `Delete "${entry.title}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
    });
    if (r.isConfirmed) deleteMutation.mutate(entry.id);
  };

  const entries = data?.entries ?? [];
  const classes = data?.classes ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        (e.posted_by_name ?? '').toLowerCase().includes(q),
    );
  }, [entries, search]);

  return (
    <div>
      <PageHeader
        icon="fa-book-open"
        title="Diary"
        subtitle={
          tab === 'announcements'
            ? 'School-wide notices and announcements'
            : 'All class-level entries posted by teachers'
        }
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setPosting(true)}>
            <i className="fas fa-plus" /> New {tab === 'announcements' ? 'Announcement' : 'Entry'}
          </button>
        }
      />

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <TabButton active={tab === 'announcements'} onClick={() => setTab('announcements')} icon="fa-bullhorn">
          Announcements
        </TabButton>
        <TabButton active={tab === 'class_entries'} onClick={() => setTab('class_entries')} icon="fa-school">
          Class Entries
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
              placeholder="Title, content, or author"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {tab === 'class_entries' && (
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
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={apiErrorMessage(error)} />
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="fa-book-open"
            title="No entries"
            description={
              tab === 'announcements'
                ? 'Post your first school-wide announcement.'
                : 'No class entries yet.'
            }
          />
        </div>
      ) : (
        <div>
          {filtered.map((e) => (
            <DiaryEntryCard
              key={e.id}
              entry={e}
              onEdit={() => setEditing(e)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <Modal
        open={posting}
        onClose={() => setPosting(false)}
        title={tab === 'announcements' ? 'New Announcement' : 'New Class Entry'}
        width={560}
      >
        <DiaryFormInline
          mode="add"
          scope={tab === 'announcements' ? 'school' : 'class'}
          classes={classes}
          onCancel={() => setPosting(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['admin', 'diary'] });
            setPosting(false);
          }}
        />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.title}` : ''}
        width={560}
      >
        {editing && (
          <DiaryFormInline
            mode="edit"
            initial={editing}
            scope={editing.scope}
            classes={classes}
            onCancel={() => setEditing(null)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ['admin', 'diary'] });
              setEditing(null);
            }}
          />
        )}
      </Modal>
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

function DiaryFormInline({
  mode,
  initial,
  scope,
  classes,
  onCancel,
  onSuccess,
}: {
  mode: 'add' | 'edit';
  initial?: DiaryEntry;
  scope: 'school' | 'class';
  classes: { id: number; name: string; section: string }[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DiaryForm>({
    defaultValues: initial
      ? {
          title: initial.title,
          content: initial.content,
          entry_date: initial.entry_date,
          link: initial.link ?? '',
          class_id: initial.class_id ?? undefined,
        }
      : { entry_date: todayStr() },
  });

  const mutation = useMutation({
    mutationFn: (d: DiaryForm) =>
      mode === 'add'
        ? adminApi.addDiary({
            title: d.title,
            content: d.content,
            entry_date: d.entry_date,
            link: d.link || undefined,
            class_id: scope === 'class' ? Number(d.class_id) : undefined,
          })
        : adminApi.updateDiary(initial!.id, {
            title: d.title,
            content: d.content,
            entry_date: d.entry_date,
            link: d.link || undefined,
          }),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: mode === 'add' ? 'Posted' : 'Saved',
        timer: 1200,
        showConfirmButton: false,
      });
      onSuccess();
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
      {scope === 'class' && mode === 'add' && (
        <div className="form-group">
          <label className="form-label">Class *</label>
          <select className="form-control" {...register('class_id', { required: 'Required', valueAsNumber: true })}>
            <option value="">— Select class —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.section}
              </option>
            ))}
          </select>
          {errors.class_id && <small style={{ color: 'var(--danger)' }}>{errors.class_id.message}</small>}
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Title *</label>
        <input
          className="form-control"
          placeholder="e.g. Math homework — chapter 4 exercises"
          {...register('title', { required: 'Required' })}
        />
        {errors.title && <small style={{ color: 'var(--danger)' }}>{errors.title.message}</small>}
      </div>

      <div className="form-group">
        <label className="form-label">Content *</label>
        <textarea
          className="form-control"
          rows={5}
          placeholder="Details, instructions, what was covered today…"
          {...register('content', { required: 'Required' })}
        />
        {errors.content && <small style={{ color: 'var(--danger)' }}>{errors.content.message}</small>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Date *</label>
          <input type="date" className="form-control" {...register('entry_date', { required: true })} />
        </div>
        <div className="form-group">
          <label className="form-label">Link (optional)</label>
          <input
            className="form-control"
            placeholder="https:// (Drive / YouTube / etc)"
            {...register('link')}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <i className="fas fa-spinner fa-spin" /> Posting…
            </>
          ) : mode === 'add' ? (
            <>
              <i className="fas fa-paper-plane" /> Post
            </>
          ) : (
            'Save'
          )}
        </button>
      </div>
    </form>
  );
}
