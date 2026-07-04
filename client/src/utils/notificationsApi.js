// ─── Notifications API helpers ───
import api from './api';

export async function getNotifications(limit = 30) {
  const { data } = await api.get('/notifications', { params: { limit } });
  return data; // { notifications: [...], unread: number }
}

export async function getUnreadCount() {
  const { data } = await api.get('/notifications/unread-count');
  return data.unread; // number
}

export async function markNotificationRead(id) {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.post('/notifications/mark-all-read');
  return data;
}

export async function deleteNotification(id) {
  const { data } = await api.delete(`/notifications/${id}`);
  return data;
}
