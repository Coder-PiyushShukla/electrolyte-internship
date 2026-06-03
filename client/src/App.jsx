import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import Navbar from './components/Navbar';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check for existing session
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

      {user ? (
        <div className="min-h-screen bg-surface-950">
          <Navbar user={user} onLogout={handleLogout} />
          <Dashboard user={user} />
        </div>
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </>
  );
}

export default App;
