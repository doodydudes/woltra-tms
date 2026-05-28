export default function KPITile({ label, value, icon: Icon, accent = '#FACC15', loading, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderTop: `3px solid ${accent}`,
        borderRadius: 'var(--r-lg)',
        padding: '14px 16px',
        boxShadow: 'var(--shadow-card)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={onClick ? e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.13)'; } : undefined}
      onMouseLeave={onClick ? e => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="kpi-label">{label}</span>
        {Icon && <Icon size={14} color={accent} strokeWidth={2} />}
      </div>
      {loading
        ? <div className="skeleton" style={{ height: 28, width: 52, borderRadius: 4 }} />
        : <span className="kpi-value">{value ?? '—'}</span>
      }
    </div>
  );
}
