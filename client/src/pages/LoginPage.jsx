import { useState } from 'react';
import { FiUser, FiLock, FiLogIn, FiUserPlus, FiZap } from 'react-icons/fi';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function LoginPage({ onLogin }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please fill in all fields.');
      return;
    }

    if (isSignUp) {
      if (password.length < 6) {
        toast.error('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignUp) {
        // Register
        await api.post('/auth/register', { username, password });
        toast.success('Account created! Signing you in...');
        // Auto-login after register
        const { data } = await api.post('/auth/login', { username, password });
        localStorage.setItem('pcb_token', data.token);
        localStorage.setItem('pcb_user', JSON.stringify(data.user));
        onLogin(data.user);
      } else {
        // Login
        const { data } = await api.post('/auth/login', { username, password });
        localStorage.setItem('pcb_token', data.token);
        localStorage.setItem('pcb_user', JSON.stringify(data.user));
        toast.success('Welcome back!');
        onLogin(data.user);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isSignUp ? 'Sign up failed.' : 'Login failed.'));
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    resetForm();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-[-200px] left-[-200px] w-[500px] h-[500px] bg-brand-600/10 rounded-full blur-[120px] animate-[pulseSoft_4s_ease-in-out_infinite]" />
      <div className="absolute bottom-[-200px] right-[-200px] w-[600px] h-[600px] bg-brand-500/8 rounded-full blur-[150px] animate-[pulseSoft_5s_ease-in-out_infinite_1s]" />

      <div className="animate-scale-in w-full max-w-md mx-4">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-500/25 mb-4">
            <FiZap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            PCB Tracker
          </h1>
          <p className="text-surface-400 mt-2">
            Electrolyte Inventory Management
          </p>
        </div>

        {/* Auth Card */}
        <form
          onSubmit={handleSubmit}
          id={isSignUp ? 'signup-form' : 'login-form'}
          className="bg-surface-900/80 backdrop-blur-xl border border-surface-800 rounded-2xl p-8 shadow-2xl"
        >
          <h2 className="text-xl font-semibold text-white mb-6">
            {isSignUp ? 'Create a new account' : 'Sign in to your account'}
          </h2>

          {/* Username */}
          <div className="mb-5">
            <label htmlFor="auth-username" className="block text-sm font-medium text-surface-300 mb-2">
              Username
            </label>
            <div className="relative">
              <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-surface-500" />
              <input
                id="auth-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full pl-11 pr-4 py-3 bg-surface-800/60 border border-surface-700 rounded-xl text-white placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>

          {/* Password */}
          <div className={isSignUp ? 'mb-5' : 'mb-6'}>
            <label htmlFor="auth-password" className="block text-sm font-medium text-surface-300 mb-2">
              Password
            </label>
            <div className="relative">
              <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-surface-500" />
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignUp ? 'Min 6 characters' : 'Enter your password'}
                className="w-full pl-11 pr-4 py-3 bg-surface-800/60 border border-surface-700 rounded-xl text-white placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>

          {/* Confirm Password (Sign Up only) */}
          {isSignUp && (
            <div className="mb-6">
              <label htmlFor="auth-confirm-password" className="block text-sm font-medium text-surface-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-surface-500" />
                <input
                  id="auth-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="w-full pl-11 pr-4 py-3 bg-surface-800/60 border border-surface-700 rounded-xl text-white placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            id={isSignUp ? 'signup-submit' : 'login-submit'}
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold rounded-xl shadow-lg shadow-brand-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isSignUp ? (
              <>
                <FiUserPlus className="w-4.5 h-4.5" />
                Create Account
              </>
            ) : (
              <>
                <FiLogIn className="w-4.5 h-4.5" />
                Sign In
              </>
            )}
          </button>

          {/* Toggle Login/Signup */}
          <div className="mt-5 text-center">
            <p className="text-sm text-surface-400">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                id="toggle-auth-mode"
                onClick={toggleMode}
                className="text-brand-400 hover:text-brand-300 font-semibold transition-colors cursor-pointer"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>

          {/* Default credentials hint (only on login) */}
          {!isSignUp && (
            <div className="mt-4 p-3 bg-brand-500/10 border border-brand-500/20 rounded-lg">
              <p className="text-xs text-brand-300 text-center">
                Default credentials: <span className="font-mono font-semibold">admin</span> / <span className="font-mono font-semibold">admin123</span>
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
