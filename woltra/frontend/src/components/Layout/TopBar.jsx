import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Bell, Sun, Moon, Search } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export default function TopBar() {
  const { unread_count }             = useSelector(s => s.notifications);
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate                     = useNavigate();

  return (
    <div style={{
      height: 52, flexShrink: 0,
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '0 1.5rem',
    }}>

      {/* Search */}
      <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
        <Search size={13} style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-3)', pointerEvents: 'none',
        }} />
        <input
          type="text"
          placeholder="Search deliveries, drivers, vehicles…"
          className="input-field"
          style={{ paddingLeft: 32, height: 32, fontSize: '12.5px', borderRadius: 7 }}
        />
      </div>

      <div style={{ flex: 1 }} />

      {/* Notifications bell */}
      <button
        onClick={() => navigate('/notifications')}
        title="Notifications"
        style={{
          position: 'relative',
          width: 34, height: 34,
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-2)',
          transition: 'background 0.13s, color 0.13s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.color = 'var(--text)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; }}
      >
        <Bell size={15} strokeWidth={1.8} />
        {unread_count > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            minWidth: 15, height: 15, borderRadius: 99,
            background: '#EF4444',
            border: '2px solid var(--bg-card)',
            fontSize: '8px', fontWeight: 800, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
          }}>
            {unread_count > 9 ? '9+' : unread_count}
          </span>
        )}
      </button>

      {/* Theme toggle */}
      <button
        onClick={toggleDarkMode}
        title={darkMode ? 'Light mode' : 'Dark mode'}
        style={{
          width: 34, height: 34,
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-2)',
          transition: 'background 0.13s, color 0.13s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.color = 'var(--text)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; }}
      >
        {darkMode ? <Sun size={14} strokeWidth={1.8} /> : <Moon size={14} strokeWidth={1.8} />}
      </button>
    </div>
  );
}
