import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBell, FiCheck, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import {
  getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification,
} from '../utils/notificationsApi';
import { typeMeta, timeAgo, formatFullDate } from '../utils/notificationMeta';

export default function NotificationsPage({ user }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications(100);
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      toast.error('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleClick = async (n) => {
    if (n.is_read) return;
    setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, is_read: true } : it)));
    setUnread((u) => Math.max(0, u - 1));
    try { await markNotificationRead(n.id); } catch { /* best-effort */ }
  };

  const handleMarkAll = async () => {
    if (unread === 0) return;
    setItems((prev) => prev.map((it) => ({ ...it, is_read: true })));
    setUnread(0);
    try {
      await markAllNotificationsRead();
      toast.success('All marked as read.');
    } catch {
      toast.error('Failed to mark all as read.');
    }
  };

  const handleDelete = async (id) => {
    const prev = items;
    setItems((p) => p.filter((it) => it.id !== id));
    try {
      await deleteNotification(id);
      toast.success('Notification deleted.');
    } catch (err) {
      setItems(prev);
      toast.error(err.response?.data?.error || 'Failed to delete.');
    }
  };

  const visible = items.filter((n) => (filter === 'unread' ? !n.is_read : true));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-3 mb-6 flex-wrap"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30">
            <FiBell className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            <p className="text-sm text-surface-400">Activity log: emails, dispatches, and access changes</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-all duration-200 cursor-pointer"
        >
          <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </motion.div>

      {/* Filters + Mark all */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {[
            { key: 'all', label: 'All', count: items.length },
            { key: 'unread', label: 'Unread', count: unread },
          ].map((f) => (
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
        {unread > 0 && (
          <button
            onClick={handleMarkAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-brand-500/15 text-brand-400 border border-brand-500/30 rounded-lg hover:bg-brand-500/25 transition-all duration-200 cursor-pointer"
          >
            <FiCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-surface-600 border-t-brand-400 rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16">
          <FiBell className="w-12 h-12 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400 text-lg">Nothing here</p>
          <p className="text-surface-500 text-sm mt-1">
            {filter === 'unread' ? "You're all caught up" : 'No activity has been recorded yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence mode="popLayout">
            {visible.map((n, index) => {
              const { Icon, color, bg } = typeMeta(n.type);
              return (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  onClick={() => handleClick(n)}
                  className={`group relative flex gap-3.5 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                    n.is_read
                      ? 'bg-surface-800/40 border-surface-700/50 hover:border-surface-600/60'
                      : 'bg-brand-500/[0.06] border-brand-500/25 hover:border-brand-500/40'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                    <Icon className={`w-4.5 h-4.5 ${color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white">{n.title}</p>
                      {!n.is_read && (
                        <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold bg-brand-500/15 text-brand-400 rounded-full">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-surface-300 mt-1 break-words">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-surface-500">
                      {n.actor && <span>by {n.actor}</span>}
                      {n.actor && <span>·</span>}
                      <span title={formatFullDate(n.created_at)}>{timeAgo(n.created_at)}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                      title="Delete record"
                      className="shrink-0 self-start p-1.5 text-surface-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
