import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import MainPage from './pages/MainPage';
import InwardPage from './pages/InwardPage';
import OutwardPage from './pages/OutwardPage';
import AdminPage from './pages/AdminPage';
import Navbar from './components/Navbar';

function App() {
  const [user, setUser] = useState(null);

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
    localStorage.removeItem('pcb_token');
    localStorage.removeItem('pcb_user');
    setUser(null);
  };

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

      <BrowserRouter>
        {user ? (
          <div className="min-h-screen bg-surface-950">
            <Navbar user={user} onLogout={handleLogout} />
            <Routes>
              <Route path="/" element={<MainPage user={user} />} />
              <Route path="/inward" element={<InwardPage user={user} />} />
              <Route path="/outward" element={<OutwardPage user={user} />} />
              {user?.role === 'admin' && (
                <Route path="/admin" element={<AdminPage />} />
              )}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        )}
      </BrowserRouter>
    </>
  );
}

export default App;