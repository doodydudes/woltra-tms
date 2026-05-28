import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, Trash2, Package, Wrench, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { fetchNotifications } from '../../features/notifications/notificationSlice';
import Pagination from '../../components/common/Pagination';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

const TYPE_ICON = {
  delivery:    Package,
  maintenance: Wrench,
  warning:     AlertTriangle,
  info:        Info,
  success:     CheckCircle,
  error:       AlertTriangle,
};

const TYPE_COLOR = {
  delivery:    { color: 'var(--blue)',   bg: 'rgba(59,130,246,0.1)'  },
  maintenance: { color: 'var(--orange)', bg: 'rgba(240,140,46,0.1)'  },
  warning:     { color: '#F59E0B',       bg: 'rgba(245,158,11,0.1)'  },
  info:        { color: 'var(--blue)',   bg: 'rgba(59,130,246,0.1)'  },
  success:     { color: '#10B981',       bg: 'rgba(16,185,129,0.1)'  },
  error:       { color: 'var(--red)',    bg: 'rgba(239,68,68,0.1)'   },
};

function getNotifRoute(n, userRole) {
  switch (n.related_type) {
    case 'vehicle_report': return userRole === 'driver' ? '/vehicle-reports' : '/vehicles?tab=reports';
    case 'vehicle':        return '/vehicles';
    case 'delivery':       return n.related_id ? `/deliveries/${n.related_id}` : '/deliveries';
    case 'driver':         return n.related_id ? `/drivers/${n.related_id}` : '/drivers';
    default: return null;
  }
}

export default function Notifications() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector(s => s.auth);
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination]       = useState(null);
  const [loading, setLoading]             = useState(true);
  const [page, setPage]                   = useState(1);
  const [unreadOnly, setUnreadOnly]       = useState(false);
  const [markingAll, setMarkingAll]       = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/notifications?page=${page}&limit=15${unreadOnly ? '&unread_only=true' : ''}`);
      setNotifications(res.data.data);
      setPagination(res.data.pagination);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page, unreadOnly]);

  const handleMarkRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      dispatch(fetchNotifications());
    } catch {}
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.put('/notifications/mark-all-read');
      toast.success('All marked as read');
      fetchData();
      dispatch(fetchNotifications());
    } catch { toast.error('Failed to mark all as read'); }
    finally { setMarkingAll(false); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      dispatch(fetchNotifications());
    } catch { toast.error('Failed to delete'); }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-4 fade-in" style={{ maxWidth: 680, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-h)' }}>Notifications</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={unreadOnly} onChange={e => { setUnreadOnly(e.target.checked); setPage(1); }}
              style={{ accentColor: 'var(--blue)', width: 14, height: 14 }} />
            Unread only
          </label>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} disabled={markingAll} className="btn-secondary" style={{ fontSize: '12px' }}>
              <CheckCheck size={13} />
              {markingAll ? 'Marking...' : 'Mark all read'}
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
          <LoadingSpinner size="lg" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="notifications"
            title="No notifications"
            message={unreadOnly ? 'No unread notifications.' : "You're all caught up!"}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notifications.map(n => {
            const Icon = TYPE_ICON[n.type] || Info;
            const tc = TYPE_COLOR[n.type] || TYPE_COLOR.info;
            const route = getNotifRoute(n, user?.role);
            return (
              <div
                key={n.id}
                onClick={async () => {
                  if (!n.is_read) await handleMarkRead(n.id);
                  if (route) navigate(route);
                }}
                style={{
                  background: n.is_read ? 'var(--bg-card)' : 'rgba(59,130,246,0.04)',
                  border: n.is_read ? '1px solid var(--border)' : '1px solid rgba(59,130,246,0.2)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  cursor: route ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={e => { if (route) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: tc.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={16} color={tc.color} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                    <p style={{ fontSize: '13.5px', fontWeight: n.is_read ? 500 : 700, color: 'var(--text-h)', lineHeight: 1.3 }}>
                      {n.title}
                    </p>
                    {!n.is_read && (
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0, marginTop: 5 }} />
                    )}
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-3)', marginBottom: 4, lineHeight: 1.45 }}>{n.message}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: '"JetBrains Mono", monospace' }}>
                    {format(new Date(n.created_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>

                <button
                  onClick={e => { e.stopPropagation(); handleDelete(n.id); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-3)', padding: 4, borderRadius: 6, flexShrink: 0,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Pagination pagination={pagination} onPageChange={setPage} />
    </div>
  );
}
