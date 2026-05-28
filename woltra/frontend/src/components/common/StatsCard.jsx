import LoadingSpinner from './LoadingSpinner';

const ICON_STYLES = {
  blue:   { bg: 'rgba(59,130,246,0.1)',  color: '#3B82F6' },
  orange: { bg: 'rgba(240,140,46,0.1)',  color: '#F08C2E' },
  green:  { bg: 'rgba(16,185,129,0.1)',  color: '#10B981' },
  red:    { bg: 'rgba(239,68,68,0.1)',   color: '#EF4444' },
  yellow: { bg: 'rgba(245,158,11,0.1)',  color: '#F59E0B' },
  amber:  { bg: 'rgba(245,158,11,0.1)',  color: '#F59E0B' },
  gray:   { bg: 'rgba(107,114,128,0.1)', color: '#6B7280' },
  purple: { bg: 'rgba(139,92,246,0.1)',  color: '#8B5CF6' },
};

export default function StatsCard({ title, value, icon: Icon, color = 'blue', subtitle, loading, onClick }) {
  const ic = ICON_STYLES[color] || ICON_STYLES.blue;

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '14px 16px',
        boxShadow: 'var(--shadow-card)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s, transform 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{
          fontSize: '10.5px', fontWeight: 700, color: 'var(--text-3)',
          lineHeight: 1.3, textTransform: 'uppercase', letterSpacing: '0.06em',
          flex: 1,
        }}>
          {title}
        </p>
        {Icon && (
          <div style={{
            width: 30, height: 30, borderRadius: 7, flexShrink: 0,
            background: ic.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={14} color={ic.color} />
          </div>
        )}
      </div>

      {loading ? (
        <LoadingSpinner size="sm" />
      ) : (
        <p style={{
          fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-h)',
          lineHeight: 1,
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {value ?? 0}
        </p>
      )}

      {subtitle && (
        <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 5 }}>{subtitle}</p>
      )}
    </div>
  );
}
