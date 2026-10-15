import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type UserRole } from '../contexts/AuthContext';
import { isProfileSetupComplete } from '../utils/profileSetup';
import { Layout } from './Layout';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: readonly UserRole[];
  requireAdministrator?: boolean;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  requireAdministrator = false,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5454e9] mx-auto" />
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const roleDenied = allowedRoles && !allowedRoles.includes(user.role);
  const adminDenied = requireAdministrator && !user.isAdministrator;
  if (roleDenied || adminDenied) {
    return <Navigate to="/dashboard" replace />;
  }

  const setupComplete = isProfileSetupComplete(user);
  if (!setupComplete && location.pathname !== '/profile' && location.pathname !== '/edit-profile') {
    return <Navigate to="/profile" replace />;
  }

  return <Layout>{children}</Layout>;
}
