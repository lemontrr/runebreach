import { Navigate, Outlet } from 'react-router-dom';
import { authStore } from './store/auth.js';

export function ProtectedRoute() {
  if (!authStore.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export function PublicOnlyRoute() {
  if (authStore.isAuthenticated()) {
    return <Navigate to="/select-class" replace />;
  }
  return <Outlet />;
}
