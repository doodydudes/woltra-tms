import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loadUser } from './features/auth/authSlice';

import Layout from './components/Layout/Layout';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import AuthCallback from './pages/Auth/AuthCallback';
import Dashboard from './pages/Dashboard/Dashboard';
import Deliveries from './pages/Deliveries/Deliveries';
import DeliveryDetail from './pages/Deliveries/DeliveryDetail';
import Drivers from './pages/Drivers/Drivers';
import DriverProfile from './pages/Drivers/DriverProfile';
import Vehicles from './pages/Vehicles/Vehicles';
import Notifications from './pages/Notifications/Notifications';
import Profile from './pages/Profile/Profile';
import Salary from './pages/Salary/Salary';
import VehicleReports from './pages/VehicleReports/VehicleReports';
import LoadingSpinner from './components/common/LoadingSpinner';

const PrivateRoute = ({ children, roles }) => {
  const { user, token } = useSelector(s => s.auth);
  if (!token) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

export default function App() {
  const dispatch = useDispatch();
  const { token, initialized } = useSelector(s => s.auth);

  useEffect(() => {
    if (token) dispatch(loadUser());
  }, [dispatch, token]);

  if (token && !initialized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/auth-callback" element={<AuthCallback />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="deliveries" element={<Deliveries />} />
        <Route path="deliveries/:id" element={<DeliveryDetail />} />
        <Route path="drivers" element={<Drivers />} />
        <Route path="drivers/:id" element={<DriverProfile />} />
        <Route path="vehicles" element={<Vehicles />} />
        <Route path="salary" element={<Salary />} />
        <Route path="vehicle-reports" element={<VehicleReports />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
