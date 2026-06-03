import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchNotifications } from '../../features/notifications/notificationSlice';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';

export default function Layout() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  const dispatch = useDispatch();
  const { user } = useSelector(s => s.auth);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!user) return;
    dispatch(fetchNotifications());
    const interval = setInterval(() => dispatch(fetchNotifications()), 60000);
    return () => clearInterval(interval);
  }, [dispatch, user]);

  const sidebarWidth = isDesktop ? 58 : 0;

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      {isDesktop && <Sidebar />}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
        marginLeft: sidebarWidth,
      }}>
        <main style={{
          flex: 1, overflowY: 'auto',
          padding: isDesktop ? '1.5rem 2rem' : '1rem',
          paddingBottom: isDesktop ? '1.5rem' : 'calc(90px + env(safe-area-inset-bottom))',
        }}>
          <div style={{ maxWidth: 1100, width: '100%', margin: '0 auto', minWidth: 0 }}>
            <Outlet />
          </div>
        </main>
      </div>
      {!isDesktop && <BottomNav />}
    </div>
  );
}
