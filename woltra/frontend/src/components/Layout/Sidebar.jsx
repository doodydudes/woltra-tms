import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  LayoutDashboard, Package, Truck, Wrench,
  DollarSign, AlertTriangle, Bell, Settings,
  Sun, Moon, LogOut,
} from 'lucide-react';
import { logout } from '../../features/auth/authSlice';
import { useTheme } from '../../contexts/ThemeContext';

const NAV = {
  owner: [
    { to: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/deliveries',      icon: Package,         label: 'Deliveries' },
    { to: '/drivers',         icon: Truck,           label: 'Drivers' },
    { to: '/vehicles',        icon: Wrench,          label: 'Fleet' },
    { to: '/salary',          icon: DollarSign,      label: 'Salary' },
    null,
    { to: '/notifications',   icon: Bell,            label: 'Notifications', badge: true },
    { to: '/profile',         icon: Settings,        label: 'Settings' },
  ],
  driver: [
    { to: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/deliveries',      icon: Package,         label: 'Deliveries' },
    { to: '/salary',          icon: DollarSign,      label: 'Earnings' },
    { to: '/vehicle-reports', icon: AlertTriangle,   label: 'Truck Reports' },
    null,
    { to: '/notifications',   icon: Bell,            label: 'Notifications', badge: true },
    { to: '/profile',         icon: Settings,        label: 'Settings' },
  ],
};

const RAIL = 64;
const FULL = 224;
const ICON = 20;

export default function Sidebar() {
  const { user }         = useSelector(s => s.auth);
  const { unread_count } = useSelector(s => s.notifications);
  const dispatch         = useDispatch();
  const navigate         = useNavigate();
  const { darkMode, toggleDarkMode } = useTheme();
  const [open, setOpen]  = useState(false);

  const role    = user?.role || 'driver';
  const items   = NAV[role] || NAV.driver;
  const initial = (user?.name?.charAt(0) || '?').toUpperCase();

  /* shared style for any sidebar row at 40px height */
  const rowBase = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: 40,
    borderRadius: 'var(--r-sm)',
    border: 'none',
    cursor: 'pointer',
    transition: `background var(--dur-fast), color var(--dur-fast)`,
    fontFamily: 'inherit',
    fontSize: 13.5,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    position: 'relative',
    flexShrink: 0,
  };

  const rowCollapsed = { justifyContent: 'center', padding: '0', gap: 0 };
  const rowExpanded  = { justifyContent: 'flex-start', padding: '0 12px', gap: 11 };

  return (
    <aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        position: 'fixed', top: 0, left: 0, height: '100%',
        width: open ? FULL : RAIL,
        background: 'var(--bg-sidebar)',
        display: 'flex', flexDirection: 'column',
        zIndex: 40,
        transition: 'width 0.18s ease',
        overflow: 'hidden',
        borderRight: '1px solid rgba(255,255,255,0.04)',
        boxShadow: open ? '6px 0 28px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      {/* ── Logo row ── */}
      <div style={{
        height: 56, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: open ? '0 16px' : '0',
        justifyContent: open ? 'flex-start' : 'center',
        gap: 10,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        transition: 'padding 0.18s ease, justify-content 0.18s ease',
      }}>
        <img src="/logo-badge.svg" alt="WOLTRA"
          style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0 }} />
        {open && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{
              fontFamily: '"Cabinet Grotesk", sans-serif',
              fontWeight: 800, fontSize: '1rem',
              color: '#fff', letterSpacing: '-0.01em', whiteSpace: 'nowrap',
            }}>WOLTRA</span>
            <span style={{
              fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em',
              color: 'rgba(250,204,21,0.55)', textTransform: 'uppercase',
            }}>TMS</span>
          </div>
        )}
      </div>

      {/* ── Nav items ── */}
      <nav style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: '8px 8px',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {items.map((item, i) => {
          if (item === null) return (
            <div key={`sep-${i}`} style={{
              height: 1, background: 'rgba(255,255,255,0.06)',
              margin: '5px 4px',
            }} />
          );

          const { to, icon: Icon, label, badge } = item;
          return (
            <NavLink
              key={to}
              to={to}
              title={!open ? label : undefined}
              style={({ isActive }) => ({
                ...rowBase,
                ...(open ? rowExpanded : rowCollapsed),
                background: isActive ? 'var(--bg-sidebar-active)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-sidebar-2)',
                fontWeight: isActive ? 600 : 400,
              })}
              onMouseEnter={e => {
                if (!e.currentTarget.classList.contains('active')) {
                  e.currentTarget.style.background = 'var(--bg-sidebar-hover)';
                  e.currentTarget.style.color = 'var(--text-sidebar)';
                }
              }}
              onMouseLeave={e => {
                const isActive = e.currentTarget.getAttribute('aria-current') === 'page';
                e.currentTarget.style.background = isActive ? 'var(--bg-sidebar-active)' : 'transparent';
                e.currentTarget.style.color = isActive ? 'var(--primary)' : 'var(--text-sidebar-2)';
              }}
            >
              {({ isActive }) => (
                <>
                  {/* Active rail indicator */}
                  {isActive && (
                    <span style={{
                      position: 'absolute',
                      left: 0, top: '18%', bottom: '18%',
                      width: 3, borderRadius: 99,
                      background: 'var(--primary)',
                    }} />
                  )}

                  <Icon
                    size={ICON}
                    strokeWidth={isActive ? 2.2 : 1.7}
                    style={{ flexShrink: 0 }}
                  />

                  {open && (
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {label}
                    </span>
                  )}

                  {/* Badge — text when expanded, dot when collapsed */}
                  {badge && unread_count > 0 && (
                    open ? (
                      <span style={{
                        background: '#EF4444', color: '#fff',
                        fontSize: '9px', fontWeight: 800,
                        borderRadius: 99, padding: '2px 6px',
                        minWidth: 18, textAlign: 'center',
                      }}>
                        {unread_count > 99 ? '99+' : unread_count}
                      </span>
                    ) : (
                      <span style={{
                        position: 'absolute', top: 7, right: 10,
                        width: 7, height: 7, borderRadius: '50%',
                        background: '#EF4444',
                        border: '1.5px solid var(--bg-sidebar)',
                      }} />
                    )
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Bottom: theme + user ── */}
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '8px 8px',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {/* Theme toggle */}
        <button
          onClick={toggleDarkMode}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            ...rowBase,
            ...(open ? rowExpanded : rowCollapsed),
            background: 'transparent',
            color: 'var(--text-sidebar-2)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--bg-sidebar-hover)';
            e.currentTarget.style.color = 'var(--text-sidebar)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-sidebar-2)';
          }}
        >
          {darkMode
            ? <Sun size={ICON} strokeWidth={1.7} style={{ flexShrink: 0 }} />
            : <Moon size={ICON} strokeWidth={1.7} style={{ flexShrink: 0 }} />}
          {open && <span>{ darkMode ? 'Light mode' : 'Dark mode' }</span>}
        </button>

        {/* User avatar chip */}
        <div
          onClick={() => navigate('/profile')}
          title={!open ? user?.name : undefined}
          style={{
            ...rowBase,
            ...(open ? { ...rowExpanded, height: 48 } : rowCollapsed),
            cursor: 'pointer',
            color: 'var(--text-sidebar)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          {/* Avatar circle */}
          <div style={{
            width: 32, height: 32, borderRadius: 'var(--r-sm)', flexShrink: 0,
            background: role === 'owner'
              ? 'rgba(245,184,0,0.15)'
              : 'rgba(59,130,246,0.15)',
            border: `1.5px solid ${role === 'owner' ? 'rgba(245,184,0,0.35)' : 'rgba(59,130,246,0.35)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800,
            color: role === 'owner' ? 'var(--primary)' : 'var(--blue)',
            letterSpacing: '-0.01em',
          }}>
            {initial}
          </div>

          {open && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 12.5, fontWeight: 600,
                color: 'var(--text-sidebar)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                lineHeight: 1.3, margin: 0,
              }}>
                {user?.name}
              </p>
              <p style={{
                fontSize: 10.5, color: 'var(--text-sidebar-2)',
                marginTop: 1, lineHeight: 1,
              }}>
                {role === 'owner' ? 'Fleet Owner' : 'Driver'}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
