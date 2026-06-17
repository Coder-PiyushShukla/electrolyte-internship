import { useState } from 'react';
import { FiUser, FiLock, FiLogIn, FiUserPlus, FiZap } from 'react-icons/fi';
import { motion } from 'framer-motion';
import Tilt from 'react-parallax-tilt';
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
        await api.post('/auth/register', { username, password });
        toast.success('Account created! Signing you in...');
        const { data } = await api.post('/auth/login', { username, password });
        localStorage.setItem('pcb_token', data.token);
        localStorage.setItem('pcb_user', JSON.stringify(data.user));
        onLogin(data.user);
      } else {
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
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-brand-600/20 rounded-full blur-[140px] pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-brand-500/15 rounded-full blur-[160px] pointer-events-none"
      />

      <Tilt
        tiltMaxAngleX={5}
        tiltMaxAngleY={5}
        perspective={1000}
        scale={1.02}
        transitionSpeed={2000}
        gyroscope={true}
        className="w-full max-w-md mx-4 z-10"
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
        >
          <div className="text-center mb-8">
            <motion.div 
              whileHover={{ rotate: 180, scale: 1.1 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 shadow-[0_0_40px_rgba(58,134,255,0.4)] mb-4"
            >
              <FiZap className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-surface-400 tracking-tight">
              PCB Tracker
            </h1>
            <p className="text-surface-400 mt-2 tracking-wide text-sm uppercase">
              Electrolyte Inventory Management
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-surface-900/60 backdrop-blur-2xl border border-surface-700/50 rounded-3xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            <h2 className="text-xl font-semibold text-white mb-6">
              {isSignUp ? 'Initialize Profile' : 'Authenticate Session'}
            </h2>

            <div className="mb-5 relative group">
              <label className="block text-xs uppercase tracking-wider font-semibold text-surface-400 mb-2">
                Username
              </label>
              <div className="relative">
                <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500 group-focus-within:text-brand-400 transition-colors" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter identifier"
                  className="w-full pl-12 pr-4 py-3.5 bg-surface-950/50 border border-surface-700/50 rounded-xl text-white placeholder:text-surface-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all duration-300"
                />
              </div>
            </div>

            <div className={isSignUp ? 'mb-5 relative group' : 'mb-8 relative group'}>
              <label className="block text-xs uppercase tracking-wider font-semibold text-surface-400 mb-2">
                Security Key
              </label>
              <div className="relative">
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500 group-focus-within:text-brand-400 transition-colors" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignUp ? 'Min 6 characters' : 'Enter security key'}
                  className="w-full pl-12 pr-4 py-3.5 bg-surface-950/50 border border-surface-700/50 rounded-xl text-white placeholder:text-surface-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all duration-300"
                />
              </div>
            </div>

            {isSignUp && (
              <div className="mb-8 relative group">
                <label className="block text-xs uppercase tracking-wider font-semibold text-surface-400 mb-2">
                  Verify Key
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500 group-focus-within:text-brand-400 transition-colors" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm security key"
                    className="w-full pl-12 pr-4 py-3.5 bg-surface-950/50 border border-surface-700/50 rounded-xl text-white placeholder:text-surface-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all duration-300"
                  />
                </div>
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-brand-500 to-brand-700 hover:from-brand-400 hover:to-brand-600 text-white font-medium rounded-xl shadow-[0_0_20px_rgba(58,134,255,0.3)] transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 border border-white/10"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isSignUp ? (
                <>
                  <FiUserPlus className="w-5 h-5" />
                  Initialize
                </>
              ) : (
                <>
                  <FiLogIn className="w-5 h-5" />
                  Access System
                </>
              )}
            </motion.button>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={toggleMode}
                className="text-sm text-surface-400 hover:text-white transition-colors duration-200"
              >
                {isSignUp ? 'Already authenticated? Return' : 'Request system access'}
              </button>
            </div>
          </form>
        </motion.div>
      </Tilt>
    </div>
  );
}