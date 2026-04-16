import { useNotificationStore } from '@/src/store/useNotificationStore';

/**
 * AlphaAI — useNotifications Hook
 * Push notification history and alert management.
 */
export function useNotifications() {
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    clearAll,
  } = useNotificationStore();

  return {
    notifications,
    unreadCount,
    isLoading,
    refresh: fetchNotifications,
    markAsRead,
    clearAll,
  };
}
