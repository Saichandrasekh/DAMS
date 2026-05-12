interface StatCardProps {
  label: string;
  value: number | string;
  icon: string;
  color?: string;
}

export function StatCard({ label, value, icon, color = 'var(--primary)' }: StatCardProps) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: `${color}15`,
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
          }}
        >
          <i className={`fas ${icon}`} />
        </div>
        <div>
          <div className="text-muted text-sm">{label}</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{value}</div>
        </div>
      </div>
    </div>
  );
}
