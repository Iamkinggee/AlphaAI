/**
 * AlphaAI — Notification Store (Zustand)
 * Manages in-app notification state.
 * Supports both backend-fetched and real-time WebSocket notifications.
 *
 * Deduplication:
 *  - Server-fetched notifications are stored by their real backend ID.
 *  - Realtime notifications are keyed by `type:signalId` so a WS
 *    reconnect never creates a second copy of the same event.
 *  - Backend IDs are recorded in a Set; addRealtimeNotification skips
 *    any event whose signalId+type is already present in the list.
 */
import { create } from 'zustand';
import { apiClient } from '@/src/services/apiClient';
import { API } from '@/src/constants/api';

export type NotificationPriority = 'critical' | 'high' | 'standard';
export type NotificationType =
  | 'approaching'
  | 'active'
  | 'tp_hit'
  | 'stopped'
  | 'expired'
  | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  pair?: string;
  signalId?: string;
  read: boolean;
  createdAt: string;
}

interface NotificationStore {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;

  fetchNotifications: () => Promise<void>;
  addRealtimeNotification: (notif: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => void;
  markRead: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

/**
 * Build a stable dedup key for an in-app notification entry.
 * Matches the key scheme used by notificationGuard so both layers stay in sync.
 */
function inAppKey(type: string, signalId?: string | null): string {
  if (signalId) return `${type}:${signalId}`;
  return `${type}:system`;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get<{ success: boolean; data: AppNotification[]; unreadCount: number }>(
        API.NOTIFICATIONS.LIST
      );
      const fetched = res.data ?? [];
      const unreadCount = res.unreadCount ?? fetched.filter((n) => !n.read).length;

      // Merge: keep any unread realtime notifications that the backend
      // doesn't know about yet (rt_ prefix), drop duplicates by signalId+type.
      const serverIds = new Set(fetched.map((n) => n.id));
      const existingRealtime = get().notifications.filter(
        (n) => n.id.startsWith('rt_') && !serverIds.has(n.id)
      );

      // Build a dedup set of type:signalId keys already covered by server data
      const serverKeys = new Set(fetched.map((n) => inAppKey(n.type, n.signalId)));

      // Only keep realtime entries not already in server data
      const filteredRealtime = existingRealtime.filter(
        (n) => !serverKeys.has(inAppKey(n.type, n.signalId))
      );

      const merged = [...filteredRealtime, ...fetched];
      const totalUnread = merged.filter((n) => !n.read).length;

      set({ notifications: merged, unreadCount: totalUnread, isLoading: false });
    } catch {
      console.warn('[NotificationStore] Backend unavailable — keeping current state');
      set({ isLoading: false });
    }
  },

  /**
   * Add a notification from a real-time WebSocket event.
   * Skips if a notification with the same type+signalId already exists,
   * so WS reconnects never create duplicate entries.
   */
  addRealtimeNotification: (notif) => {
    const key = inAppKey(notif.type, notif.signalId);
    const existing = get().notifications;

    // Deduplicate: skip if same type+signalId already in list
    const alreadyExists = existing.some(
      (n) => inAppKey(n.type, n.signalId) === key
    );
    if (alreadyExists) {
      console.log(`[NotificationStore] Suppressed duplicate in-app notification: ${key}`);
      return;
    }

    const newNotif: AppNotification = {
      ...notif,
      id: `rt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      notifications: [newNotif, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  markRead: (id) => {
    const notifications = get().notifications.map((n) => n.id === id ? { ...n, read: true } : n);
    set({ notifications, unreadCount: notifications.filter((n) => !n.read).length });
    // Only send to backend for server-generated IDs (not rt_ prefixed)
    if (!id.startsWith('rt_')) {
      apiClient.patch(API.NOTIFICATIONS.MARK_READ(id), {}).catch(() => {});
    }
  },

  markAsRead: (id) => get().markRead(id),

  markAllRead: () => {
    const notifications = get().notifications.map((n) => ({ ...n, read: true }));
    set({ notifications, unreadCount: 0 });
    apiClient.post('/notifications/read-all', {}).catch(() => {});
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
    apiClient.delete(API.NOTIFICATIONS.LIST).catch(() => {});
  },
}));
