// ─── Notification presentation helpers ───
// Maps a notification `type` to an icon + colour, and formats relative time.
import {
  FiMail, FiSend, FiAlertTriangle, FiUserPlus, FiUserCheck,
  FiUserX, FiTruck, FiInbox, FiBell,
} from 'react-icons/fi';

const META = {
  email_report_sent: { Icon: FiMail, color: 'text-brand-400', bg: 'bg-brand-500/15' },
  email_challan_sent: { Icon: FiSend, color: 'text-brand-400', bg: 'bg-brand-500/15' },
  email_failed: { Icon: FiAlertTriangle, color: 'text-red-400', bg: 'bg-red-500/15' },
  user_registered: { Icon: FiUserPlus, color: 'text-amber-400', bg: 'bg-amber-500/15' },
  user_approved: { Icon: FiUserCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  user_rejected: { Icon: FiUserX, color: 'text-red-400', bg: 'bg-red-500/15' },
  dispatch_created: { Icon: FiTruck, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  inward_recorded: { Icon: FiInbox, color: 'text-brand-400', bg: 'bg-brand-500/15' },
};

export function typeMeta(type) {
  return META[type] || { Icon: FiBell, color: 'text-surface-300', bg: 'bg-surface-700/50' };
}

export function timeAgo(dateStr) {
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatFullDate(dateStr) {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}
