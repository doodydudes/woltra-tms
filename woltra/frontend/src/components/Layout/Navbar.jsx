import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Bell, Sun, Moon } from 'lucide-react';
import { fetchNotifications } from '../../features/notifications/notificationSlice';
import { useTheme } from '../../contexts/ThemeContext';
import { useEffect } from 'react';

export default function Navbar({ isDesktop }) {
  const { user }         = useSelector(s => s.auth);
  const { unread_count } = useSelector(s => s.notifications);
  const dispatch         = useDispatch();
  const navigate         = useNavigate();
  const { darkMode, toggleDarkMode } = useTheme();

  useEffect(() => {
    if (user) {
      dispatch(fetchNotifications());
      const interval = setInterval(() => dispatch(fetchNotifications()), 60000);
      return () => clearInterval(interval);
    }
  }, [dispatch, user]);

  return (
    <header style={{
      height: 52,
      background: 'var(--bg-nav)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 1rem',
      position: 'sticky', top: 0, zIndex: 10,
      flexShrink: 0,
    }}>

      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1 }}>
        <img src="/logo-badge.svg" alt="WOLTRA" style={{ width: 30, height: 30, display: 'block', borderRadius: 7 }} />
        <span style={{
          fontFamily: '"Cabinet Grotesk", sans-serif',
          fontWeight: 800, fontSize: '1rem',
          letterSpacing: '-0.02em',
          color: '#FFFFFF',
        }}>
          WOLTRA
        </span>
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>

        {/* Theme toggle — desktop only */}
        {isDesktop && (
          <button onClick={toggleDarkMode} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.55)', padding: '6px',
            borderRadius: 6, display: 'flex', alignItems: 'center',
            transition: 'color 0.15s ease, background 0.15s ease',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-nav-hover)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
          >
            {darkMode ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        )}

        {/* Notifications — desktop only */}
        {isDesktop && (
          <button onClick={() => navigate('/notifications')} style={{
            position: 'relative', background: 'none', border: 'none',
            cursor: 'pointer', color: 'rgba(255,255,255,0.55)',
            padding: '6px', borderRadius: 6, display: 'flex', alignItems: 'center',
            transition: 'color 0.15s ease, background 0.15s ease',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-nav-hover)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
          >
            <Bell size={17} />
            {unread_count > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                width: 8, height: 8, borderRadius: '50%',
                background: '#F28C28',
                border: '1.5px solid var(--bg-nav)',
              }} />
            )}
          </button>
        )}

        {/* Avatar */}
        <div onClick={() => navigate('/profile')} style={{
          width: 28, height: 28, borderRadius: '50%', marginLeft: 4,
          background: 'var(--blue)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          fontFamily: '"Cabinet Grotesk", sans-serif',
          fontWeight: 700, fontSize: '0.8rem', color: '#fff',
          border: '2px solid rgba(255,255,255,0.15)',
          transition: 'border-color 0.15s ease',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
        >
          {user?.name?.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
