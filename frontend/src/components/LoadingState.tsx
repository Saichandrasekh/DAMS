interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading…' }: LoadingStateProps) {
  return (
    <div
      style={{
        padding: 48,
        textAlign: 'center',
        color: 'var(--text-muted)',
      }}
    >
      <i className="fas fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: 12 }} />
      <div>{message}</div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: 24,
        textAlign: 'center',
        background: 'var(--danger-light)',
        color: 'var(--danger-dark)',
        borderRadius: 'var(--radius)',
      }}
    >
      <i className="fas fa-circle-exclamation" style={{ marginRight: 8 }} />
      {message}
    </div>
  );
}

export function EmptyState({ icon = 'fa-inbox', title, description }: { icon?: string; title: string; description?: string }) {
  return (
    <div
      style={{
        padding: 48,
        textAlign: 'center',
        color: 'var(--text-muted)',
      }}
    >
      <i className={`fas ${icon}`} style={{ fontSize: '2.5rem', marginBottom: 12, opacity: 0.5 }} />
      <h3 style={{ margin: '0 0 4px 0', color: 'var(--text)' }}>{title}</h3>
      {description && <p style={{ margin: 0 }}>{description}</p>}
    </div>
  );
}
