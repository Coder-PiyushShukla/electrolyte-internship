import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUsers, FiCheckCircle, FiXCircle, FiShield, FiClock, FiUser, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'approved'
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/auth/users');
      setUsers(data.users);
    } catch (err) {
      toast.error('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApprove = async (id, username) => {
    setActionLoading(id);
    try {
      await api.patch(`/auth/approve/${id}`);
      toast.success(`${username} approved!`);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_approved: true } : u));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve user.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id, username) => {
    setActionLoading(id);
    try {
      await api.delete(`/auth/users/${id}`);
      toast.success(`${username} removed.`);
      setUsers(prev => prev.filter(u => u.id !== id));
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject user.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(u => {
    if (filter === 'pending') return !u.is_approved;
    if (filter === 'approved') return u.is_approved;
    return true;
  });

  const pendingCount = users.filter(u => !u.is_approved).length;
  const approvedCount = users.filter(u => u.is_approved).length;

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30">
            <FiShield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">User Management</h1>
            <p className="text-sm text-surface-400">Approve or reject access requests</p>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"
      >
        <div className="bg-surface-800/60 backdrop-blur-sm border border-surface-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-500/15 flex items-center justify-center">
              <FiUsers className="w-4.5 h-4.5 text-brand-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{users.length}</p>
              <p className="text-xs text-surface-400">Total Users</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-800/60 backdrop-blur-sm border border-surface-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <FiClock className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
              <p className="text-xs text-surface-400">Pending Approval</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-800/60 backdrop-blur-sm border border-surface-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <FiCheckCircle className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-400">{approvedCount}</p>
              <p className="text-xs text-surface-400">Approved</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Filters + Refresh */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-between mb-5 flex-wrap gap-3"
      >
        <div className="flex items-center gap-2">
          {[
            { key: 'all', label: 'All', count: users.length },
            { key: 'pending', label: 'Pending', count: pendingCount },
            { key: 'approved', label: 'Approved', count: approvedCount },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer ${
                filter === f.key
                  ? 'bg-surface-700 text-white border border-surface-600'
                  : 'text-surface-400 hover:text-white hover:bg-surface-800/60 border border-transparent'
              }`}
            >
              {f.label}
              <span className={`ml-1.5 text-xs ${filter === f.key ? 'text-surface-300' : 'text-surface-500'}`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-all duration-200 cursor-pointer"
        >
          <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </motion.div>

      {/* Users List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-surface-600 border-t-brand-400 rounded-full animate-spin" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <FiUsers className="w-12 h-12 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400 text-lg">No users found</p>
          <p className="text-surface-500 text-sm mt-1">
            {filter === 'pending' ? 'No pending requests' : 'No users match this filter'}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredUsers.map((user, index) => (
              <motion.div
                key={user.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                transition={{ delay: index * 0.04 }}
                className={`relative bg-surface-800/50 backdrop-blur-sm border rounded-xl p-4 sm:p-5 transition-all duration-300 ${
                  !user.is_approved
                    ? 'border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.06)]'
                    : 'border-surface-700/50'
                }`}
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  {/* User Info */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      user.role === 'admin'
                        ? 'bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/40'
                        : user.is_approved
                          ? 'bg-emerald-500/10 border border-emerald-500/30'
                          : 'bg-surface-700/50 border border-surface-600/50'
                    }`}>
                      {user.role === 'admin' ? (
                        <FiShield className="w-4.5 h-4.5 text-amber-400" />
                      ) : (
                        <FiUser className="w-4.5 h-4.5 text-surface-300" />
                      )}
                    </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-semibold text-sm truncate">{user.username}</p>
                          {user.role === 'admin' && (
                            <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full">
                              Admin
                            </span>
                          )}
                          {!user.is_approved && (
                            <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-amber-500/10 text-amber-500 rounded-full flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Pending
                            </span>
                          )}
                          {user.is_approved && user.role !== 'admin' && (
                            <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-emerald-500/10 text-emerald-400 rounded-full">
                              Approved
                            </span>
                          )}
                        </div>
                        {user.email && (
                          <p className="text-xs text-surface-400 truncate mt-0.5">{user.email}</p>
                        )}
                        <p className="text-xs text-surface-500 mt-0.5">
                          Registered {formatDate(user.created_at)}
                        </p>
                      </div>
                  </div>

                  {/* Actions */}
                  {user.role !== 'admin' && (
                    <div className="flex items-center gap-2 shrink-0">
                      {!user.is_approved && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleApprove(user.id, user.username)}
                          disabled={actionLoading === user.id}
                          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/25 transition-all duration-200 disabled:opacity-50 cursor-pointer"
                        >
                          {actionLoading === user.id ? (
                            <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                          ) : (
                            <FiCheckCircle className="w-4 h-4" />
                          )}
                          Approve
                        </motion.button>
                      )}

                      {confirmDelete === user.id ? (
                        <div className="flex items-center gap-2">
                          <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleReject(user.id, user.username)}
                            disabled={actionLoading === user.id}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/40 rounded-lg hover:bg-red-500/30 transition-all duration-200 disabled:opacity-50 cursor-pointer"
                          >
                            {actionLoading === user.id ? (
                              <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                            ) : (
                              <FiAlertTriangle className="w-4 h-4" />
                            )}
                            Confirm
                          </motion.button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-2.5 py-2 text-sm text-surface-400 hover:text-white rounded-lg hover:bg-surface-700 transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setConfirmDelete(user.id)}
                          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-red-400/70 border border-surface-700/50 rounded-lg hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all duration-200 cursor-pointer"
                        >
                          <FiXCircle className="w-4 h-4" />
                          Reject
                        </motion.button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
