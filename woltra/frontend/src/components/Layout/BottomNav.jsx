import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  LayoutDashboard, Package, Menu, Truck, Wrench,
  Settings, DollarSign, Plus, AlertTriangle, Bell, X,
} from 'lucide-react';
import DeliveryForm from '../../pages/Deliveries/DeliveryForm';

/* ── Route definitions ─────────────────────────── */
const ownerMain = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Home'  },
  { to: '/deliveries', icon: Package,         label: 'Loads' },
  { to: '/vehicles',   icon: Wrench,          label: 'Fleet' },
];
const ownerMore = [
  { to: '/drivers',       icon: Truck,      label: 'Drivers'       },
  { to: '/salary',        icon: DollarSign, label: 'Salary'        },
  { to: '/notifications', icon: Bell,       label: 'Notifications', badge: true },
  { to: '/profile',       icon: Settings,   label: 'Settings'      },
];
const driverMain = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Home'     },
  { to: '/deliveries', icon: Package,         label: 'Loads'    },
  null, // FAB slot
  { to: '/salary',     icon: DollarSign,      label: 'Earnings' },
  'more',
];
const driverMore = [
  { to: '/vehicle-reports', icon: AlertTriangle, label: 'Truck Reports' },
  { to: '/notifications',   icon: Bell,          label: 'Notifications', badge: true },
  { to: '/profile',         icon: Settings,      label: 'Settings'      },
];

const ICON = 20;

export default function BottomNav() {
  const { user }         = useSelector(s => s.auth);
  const { unread_count } = useSelector(s => s.notifications);
  const [moreOpen, setMoreOpen]                 = useState(false);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const navRef = useRef(null);

  const location    = useLocation();
  const isOwner     = user?.role === 'owner';
  const mainItems   = isOwner ? ownerMain : driverMain;
  const moreItems   = isOwner ? ownerMore : driverMore;
  const isMoreRoute = moreItems.some(item => location.pathname === item.to);

  /* close More when clicking outside */
  useEffect(() => {
    const handler = e => {
      if (navRef.current && !navRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* active tab pill style */
  const tabStyle = isActive => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    padding: '7px 10px', borderRadius: 14, flex: 1,
    textDecoration: 'none', position: 'relative',
    transition: 'color var(--dur-fast), background var(--dur-fast)',
    color: isActive ? 'var(--primary-text)' : 'var(--text-3)',
    background: isActive ? 'var(--primary)' : 'transparent',
    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    WebkitTapHighlightColor: 'transparent',
  });

  /* unread dot badge */
  const UnreadDot = () => (
    <span style={{
      position: 'absolute', top: 5, right: 9,
      width: 6, height: 6, borderRadius: '50%', background: '#EF4444',
    }} />
  );

  /* unread count badge */
  const UnreadCount = () => (
    <span style={{
      background: '#EF4444', color: '#fff',
      fontSize: '9.5px', fontWeight: 800,
      borderRadius: 99, padding: '2px 6px',
      minWidth: 18, textAlign: 'center', lineHeight: 1.4,
    }}>
      {unread_count > 99 ? '99+' : unread_count}
    </span>
  );

  return (
    <>
      <div ref={navRef} style={{
        position: 'fixed',
        bottom: 'max(14px, calc(env(safe-area-inset-bottom) + 6px))',
        left: 12, right: 12,
        zIndex: 40,
      }}>

        {/* ── More popup ── */}
        {moreOpen && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 10px)',
            left: 0, right: 0,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-xl)',
            boxShadow: 'var(--shadow-modal)',
            overflow: 'hidden', padding: 6,
            animation: 'fadeUp 0.15s var(--ease-out)',
          }}>
            {moreItems.map(({ to, icon: Icon, label, badge }) => (
              <NavLink
                key={to} to={to}
                onClick={() => setMoreOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', borderRadius: 'var(--r-md)',
                  textDecoration: 'none', minHeight: 48,
                  fontSize: 13.5, fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--primary-text)' : 'var(--text)',
                  background: isActive ? 'var(--primary)' : 'transparent',
                  transition: 'background var(--dur-fast)',
                  WebkitTapHighlightColor: 'transparent',
                })}
                onMouseEnter={e => {
                  const isActive = e.currentTarget.getAttribute('aria-current') === 'page';
                  if (!isActive) e.currentTarget.style.background = 'var(--bg-card-alt)';
                }}
                onMouseLeave={e => {
                  const isActive = e.currentTarget.getAttribute('aria-current') === 'page';
                  e.currentTarget.style.background = isActive ? 'var(--primary)' : 'transparent';
                }}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={ICON} strokeWidth={isActive ? 2.2 : 1.7} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{label}</span>
                    {badge && unread_count > 0 && <UnreadCount />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}

        {/* ── Floating pill nav ── */}
        <nav style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)',
          padding: '6px 8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
        }}>

          {mainItems.map((item, i) => {
            /* Driver FAB (null slot) */
            if (item === null) return (
              <div key="fab" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 4px' }}>
                <button
                  onClick={() => setShowDeliveryForm(true)}
                  style={{
                    width: 46, height: 46, borderRadius: '50%',
                    background: 'var(--primary)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'var(--shadow-fab)',
                    transition: `transform var(--dur-fast) var(--ease-spring), box-shadow var(--dur-fast)`,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.94)'; }}
                  onMouseUp={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                >
                  <Plus size={22} color="var(--primary-text)" strokeWidth={2.8} />
                </button>
              </div>
            );

            /* Driver More button */
            if (item === 'more') return (
              <button key="more" onClick={() => setMoreOpen(v => !v)}
                style={tabStyle(moreOpen || isMoreRoute)}>
                {moreOpen
                  ? <X size={ICON} strokeWidth={2.2} />
                  : <Menu size={ICON} strokeWidth={1.7} />}
                <span style={{ fontSize: '9.5px', fontWeight: moreOpen || isMoreRoute ? 700 : 500, lineHeight: 1 }}>
                  More
                </span>
                {!moreOpen && unread_count > 0 && <UnreadDot />}
              </button>
            );

            /* Regular nav link */
            const { to, icon: Icon, label } = item;
            return (
              <NavLink
                key={to} to={to}
                onClick={() => setMoreOpen(false)}
                style={({ isActive }) => tabStyle(!moreOpen && isActive)}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={ICON} strokeWidth={isActive ? 2.2 : 1.7} />
                    <span style={{ fontSize: '9.5px', fontWeight: isActive ? 700 : 500, lineHeight: 1 }}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}

          {/* Owner More button (rendered after main items) */}
          {isOwner && (
            <button onClick={() => setMoreOpen(v => !v)}
              style={tabStyle(moreOpen || isMoreRoute)}>
              {moreOpen
                ? <X size={ICON} strokeWidth={2.2} />
                : <Menu size={ICON} strokeWidth={1.7} />}
              <span style={{ fontSize: '9.5px', fontWeight: moreOpen || isMoreRoute ? 700 : 500, lineHeight: 1 }}>
                More
              </span>
              {!moreOpen && unread_count > 0 && <UnreadDot />}
            </button>
          )}
        </nav>
      </div>

      {showDeliveryForm && (
        <DeliveryForm
          onClose={() => setShowDeliveryForm(false)}
          onSuccess={() => {
            setShowDeliveryForm(false);
            window.dispatchEvent(new CustomEvent('woltra:delivery-created'));
          }}
        />
      )}
    </>
  );
}
