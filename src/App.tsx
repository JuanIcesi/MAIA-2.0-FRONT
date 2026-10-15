import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import { Toaster } from './components/ui/sonner';
import { WalkthroughProvider } from './tour/WalkthroughProvider';
import { isProfileSetupComplete } from './utils/profileSetup';
import { ProtectedRoute } from './components/ProtectedRoute';

const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const Register = lazy(() => import('./pages/Register').then((module) => ({ default: module.Register })));
const ProfessorDashboard = lazy(() => import('./pages/ProfessorDashboard').then((module) => ({ default: module.ProfessorDashboard })));
const DepartmentDashboard = lazy(() => import('./pages/DepartmentDashboard').then((module) => ({ default: module.DepartmentDashboard })));
const ResourceLibrary = lazy(() => import('./pages/ResourceLibrary').then((module) => ({ default: module.ResourceLibrary })));
const CreateResource = lazy(() => import('./pages/CreateResource').then((module) => ({ default: module.CreateResource })));
const MyResources = lazy(() => import('./pages/MyResources').then((module) => ({ default: module.MyResources })));
const SupportRequest = lazy(() => import('./pages/SupportRequest').then((module) => ({ default: module.SupportRequest })));
const RequestManagement = lazy(() => import('./pages/RequestManagement').then((module) => ({ default: module.RequestManagement })));
const Analytics = lazy(() => import('./pages/Analytics').then((module) => ({ default: module.Analytics })));
const Profile = lazy(() => import('./pages/Profile').then((module) => ({ default: module.Profile })));
const EditProfile = lazy(() => import('./pages/EditProfile').then((module) => ({ default: module.EditProfile })));
const Collections = lazy(() => import('./pages/Collections').then((module) => ({ default: module.Collections })));
const ChatHistory = lazy(() => import('./pages/ChatHistory').then((module) => ({ default: module.ChatHistory })));
const ChatHistoryAdmin = lazy(() => import('./pages/ChatHistoryAdmin').then((module) => ({ default: module.ChatHistoryAdmin })));
const Notifications = lazy(() => import('./pages/Notifications').then((module) => ({ default: module.Notifications })));
const TeacherSurveys = lazy(() => import('./pages/TeacherSurveys').then((module) => ({ default: module.TeacherSurveys })));
const SurveyAdmin = lazy(() => import('./pages/SurveyAdmin').then((module) => ({ default: module.SurveyAdmin })));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" role="status">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5454e9] mx-auto" />
        <p className="mt-4 text-muted-foreground">Cargando...</p>
      </div>
    </div>
  );
}

function getDefaultRoute(user: Parameters<typeof isProfileSetupComplete>[0]): string {
  if (!user) return '/login';
  return isProfileSetupComplete(user) ? '/dashboard' : '/profile';
}

function DashboardRouter() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'professor') {
    return <ProfessorDashboard />;
  }
  if (user.role === 'department_head') {
    return <DepartmentDashboard />;
  }

  return <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={getDefaultRoute(user)} replace /> : <Login />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to={getDefaultRoute(user)} replace /> : <Register />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardRouter />
          </ProtectedRoute>
        }
      />
      <Route
        path="/library"
        element={
          <ProtectedRoute>
            <ResourceLibrary />
          </ProtectedRoute>
        }
      />
      <Route
        path="/library/create"
        element={
          <ProtectedRoute>
            <CreateResource />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-resources"
        element={
          <ProtectedRoute>
            <MyResources />
          </ProtectedRoute>
        }
      />
      <Route
        path="/support"
        element={
          <ProtectedRoute allowedRoles={['professor']}>
            <SupportRequest />
          </ProtectedRoute>
        }
      />
      <Route
        path="/requests"
        element={
          <ProtectedRoute allowedRoles={['department_head']}>
            <RequestManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute allowedRoles={['department_head']}>
            <Analytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/edit-profile"
        element={
          <ProtectedRoute>
            <EditProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/collections"
        element={
          <ProtectedRoute>
            <Collections />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute allowedRoles={['professor']}>
            <Notifications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat-history"
        element={
          <ProtectedRoute allowedRoles={['professor']}>
            <ChatHistory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat-history/admin"
        element={
          <ProtectedRoute allowedRoles={['department_head']}>
            <ChatHistoryAdmin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/surveys"
        element={
          <ProtectedRoute allowedRoles={['professor']}>
            <TeacherSurveys />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/surveys"
        element={
          <ProtectedRoute allowedRoles={['department_head']} requireAdministrator>
            <SurveyAdmin />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to={getDefaultRoute(user)} replace />} />
      <Route path="*" element={<Navigate to={getDefaultRoute(user)} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WalkthroughProvider>
          <ChatProvider>
            <Suspense fallback={<RouteFallback />}>
              <AppRoutes />
            </Suspense>
            <Toaster />
          </ChatProvider>
        </WalkthroughProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
