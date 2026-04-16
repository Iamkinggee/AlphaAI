/**
 * AlphaAI — Notification Store (Zustand)
 * Phase 5: Wired to /api/notifications.
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
  markRead: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

const MOCK_NOTIFICATIONS: AppNotification[] = [
  { id: 'n_001', type: 'approaching', priority: 'critical', title: 'BTC/USDT Approaching Zone', body: '0.8% away from 4H OB Demand — Score: 84', pair: 'BTC/USDT', signalId: 'sig_001', read: false, createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString() },
  { id: 'n_002', type: 'approaching', priority: 'high', title: 'ETH/USDT Approaching Zone', body: '1.2% away from 1H OB + FVG — Score: 76', pair: 'ETH/USDT', signalId: 'sig_002', read: false, createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString() },
  { id: 'n_003', type: 'active', priority: 'critical', title: 'SOL/USDT — Trade Active!', body: 'Price entered demand zone. Entry: $98.40 · SL: $96.30', pair: 'SOL/USDT', signalId: 'sig_003', read: false, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: 'n_004', type: 'tp_hit', priority: 'high', title: 'DOGE/USDT — TP1 Hit ✅', body: '+2.1% secured. Position partially closed at $0.1420.', pair: 'DOGE/USDT', signalId: 'sig_004', read: true, createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
  { id: 'n_005', type: 'system', priority: 'standard', title: 'Signal Scan Complete', body: '24 pairs scanned · 2 approaching · 1 new signal detected', read: true, createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
];

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
      const notifications = res.data ?? MOCK_NOTIFICATIONS;
      const unreadCount = res.unreadCount ?? notifications.filter((n) => !n.read).length;
      set({ notifications, unreadCount, isLoading: false });
    } catch {
      console.warn('[NotificationStore] Backend unavailable — using mock notifications');
      const unread = MOCK_NOTIFICATIONS.filter((n) => !n.read).length;
      set({ notifications: MOCK_NOTIFICATIONS, unreadCount: unread, isLoading: false });
    }
  },

  markRead: (id) => {
    const notifications = get().notifications.map((n) => n.id === id ? { ...n, read: true } : n);
    set({ notifications, unreadCount: notifications.filter((n) => !n.read).length });
    apiClient.patch(API.NOTIFICATIONS.MARK_READ(id), {}).catch(() => {});
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
