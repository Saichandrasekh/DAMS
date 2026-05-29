import type { DiaryEntry } from '@/types/admin';

interface DiaryEntryCardProps {
  entry: DiaryEntry;
  onEdit?: (entry: DiaryEntry) => void;
  onDelete?: (entry: DiaryEntry) => void;
  showClass?: boolean;
}

export function DiaryEntryCard({ entry, onEdit, onDelete, showClass = true }: DiaryEntryCardProps) {
  const isSchool = entry.scope === 'school';
  return (
    <div
      className="card"
      style={{
        marginBottom: 12,
        borderLeft: `4px solid ${isSchool ? '#7c3aed' : 'var(--primary)'}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          marginBottom: 6,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
            {isSchool ? (
              <span className="badge badge-info" style={{ marginRight: 8 }}>
                <i className="fas fa-bullhorn" /> Announcement
              </span>
            ) : (
              showClass && entry.class_name && (
                <span className="badge badge-primary" style={{ marginRight: 8 }}>
                  <i className="fas fa-school" /> {entry.class_name} {entry.section}
                </span>
              )
            )}
            {entry.title}
          </h3>
          <div className="text-xs text-muted" style={{ marginTop: 4 }}>
            <i className="fas fa-calendar" style={{ marginRight: 4 }} />
            {entry.entry_date}
            {' · '}
            <i className="fas fa-user" style={{ marginRight: 4, marginLeft: 4 }} />
            {entry.posted_by_name ?? 'Unknown'}
            {entry.posted_by_role && (
              <span style={{ textTransform: 'capitalize' }}> ({entry.posted_by_role.replace('_', ' ')})</span>
            )}
            {entry.subject_name && <> · 📘 {entry.subject_name}</>}
          </div>
        </div>
        {(onEdit || onDelete) && (
          <div style={{ display: 'flex', gap: 6 }}>
            {onEdit && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onEdit(entry)}
                title="Edit"
              >
                <i className="fas fa-pen" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => onDelete(entry)}
                title="Delete"
              >
                <i className="fas fa-trash" />
              </button>
            )}
          </div>
        )}
      </div>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{entry.content}</div>
      {entry.link && (
        <div style={{ marginTop: 10 }}>
          <a
            href={entry.link}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-secondary"
          >
            <i className="fas fa-link" /> Open link
          </a>
        </div>
      )}
    </div>
  );
}
