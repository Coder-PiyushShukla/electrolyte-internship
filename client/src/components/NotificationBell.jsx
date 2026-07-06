import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBell, FiCheck } from 'react-icons/fi';
import {
  getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead,
} from '../utils/notificationsApi';
import { typeMeta, timeAgo } from '../utils/notificationMeta';

const POLL_MS = 45000;

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  const refreshCount = useCallback(async () => {
    try {
      setUnread(await getUnreadCount());
    } catch {
      /* silent - badge just won't update this tick */
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications(10);
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll the unread count on an interval (and once on mount).
  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadList();
  };

  const handleItemClick = async (n) => {
    if (!n.is_read) {
      setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, is_read: true } : it)));
      setUnread((u) => Math.max(0, u - 1));
      try { await markNotificationRead(n.id); } catch { /* best-effort */ }
    }
  };

  const handleMarkAll = async () => {
    setItems((prev) => prev.map((it) => ({ ...it, is_read: true })));
    setUnread(0);
    try { await markAllNotificationsRead(); } catch { /* best-effort */ }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative flex items-center justify-center w-9 h-9 text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-all duration-200 cursor-pointer"
      >
        <FiBell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full border border-surface-950">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[70vh] flex flex-col bg-surface-900 border border-surface-700 rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
              <div className="flex items-center gap-2">
                <FiBell className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-semibold text-white">Notifications</span>
                {unread > 0 && (
                  <span className="text-[11px] font-medium text-surface-400">({unread} new)</span>
                )}
              </div>
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300 transition-colors cursor-pointer"
                >
                  <FiCheck className="w-3 h-3" /> Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-surface-600 border-t-brand-400 rounded-full animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <FiBell className="w-8 h-8 text-surface-600 mx-auto mb-2" />
                  <p className="text-sm text-surface-400">No notifications yet</p>
                </div>
              ) : (
                items.map((n) => {
                  const { Icon, color, bg } = typeMeta(n.type);
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleItemClick(n)}
                      className={`w-full text-left flex gap-3 px-4 py-3 border-b border-surface-800/60 hover:bg-surface-800/50 transition-colors cursor-pointer ${
                        n.is_read ? '' : 'bg-brand-500/[0.04]'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate">{n.title}</p>
                          {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />}
                        </div>
                        <p className="text-xs text-surface-400 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-surface-500 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-surface-800 bg-surface-900">
              <button
                onClick={() => { setOpen(false); navigate('/notifications'); }}
                className="w-full text-center text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors cursor-pointer"
              >
                View all notifications
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
