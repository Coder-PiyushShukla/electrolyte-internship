import { useState, useEffect, useMemo } from 'react';
import { Toaster } from 'react-hot-toast';
import { createBrowserRouter, RouterProvider, Navigate, Outlet, useBlocker } from 'react-router-dom';
import { UnsavedChangesProvider, useUnsavedChanges } from './contexts/UnsavedChangesContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import MainPage from './pages/MainPage';
import InwardPage from './pages/InwardPage';
import OutwardPage from './pages/OutwardPage';
import AdminPage from './pages/AdminPage';
import CompanyOnboardingPage from './pages/CompanyOnboardingPage';
import NotificationsPage from './pages/NotificationsPage';
import Navbar from './components/Navbar';

function UnsavedChangesGuard() {
  const { hasUnsavedChanges } = useUnsavedChanges();
  const blocker = useBlocker(({ currentLocation, nextLocation }) => hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const confirmed = window.confirm('You have unsaved changes. Save the challan first or your work will be lost.');
      if (confirmed) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return null;
}

function ProtectedLayout({ user, onLogout }) {
  return (
    <div className="min-h-screen bg-surface-950">
      <UnsavedChangesGuard />
      <Navbar user={user} onLogout={onLogout} />
      <Outlet />
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();

  useEffect(() => {
    const token = localStorage.getItem('pcb_token');
    const savedUser = localStorage.getItem('pcb_user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('pcb_token');
        localStorage.removeItem('pcb_user');
      }
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Save the challan first or your work will be lost.');
      if (!confirmed) return;
    }
    localStorage.removeItem('pcb_token');
    localStorage.removeItem('pcb_user');
    setHasUnsavedChanges(false);
    setUser(null);
  };

  const router = useMemo(() => createBrowserRouter([
    {
      path: '/',
      element: user ? <ProtectedLayout user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />,
      children: [
        { index: true, element: <MainPage user={user} /> },
        { path: 'inward', element: <InwardPage user={user} /> },
        { path: 'outward', element: <OutwardPage user={user} /> },
        { path: 'notifications', element: <NotificationsPage user={user} /> },
        ...(user?.role === 'admin' ? [
          { path: 'company-onboarding', element: <CompanyOnboardingPage /> },
          { path: 'admin', element: <AdminPage /> },
        ] : []),
      ],
    },
    {
      path: '/login',
      element: user ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />,
    },
    {
      path: '/register',
      element: user ? <Navigate to="/" replace /> : <RegisterPage />,
    },
    {
      path: '/forgot-password',
      element: user ? <Navigate to="/" replace /> : <ForgotPasswordPage />,
    },
    {
      path: '*',
      element: <Navigate to={user ? '/' : '/login'} replace />,
    },
  ]), [user, handleLogin, handleLogout]);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          className: '',
          style: {
            background: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#1e293b' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#1e293b' },
          },
        }}
      />

      <RouterProvider router={router} />
    </>
  );
}

export default function AppWithProvider() {
  return (
    <UnsavedChangesProvider>
      <App />
    </UnsavedChangesProvider>
  );
}
