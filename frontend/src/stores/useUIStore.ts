import { create } from 'zustand';

/**
 * UI state store for modals, notifications, and temporary UI state
 * This state is not persisted (cleared on refresh)
 */

interface UIState {
  // Modals
  activeModal: string | null;
  
  // Notifications
  notifications: Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    timestamp: number;
  }>;
  
  // Loading states
  globalLoading: boolean;
  loadingMessage: string | null;
  
  // Actions
  openModal: (modalId: string) => void;
  closeModal: () => void;
  addNotification: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  removeNotification: (id: string) => void;
  setGlobalLoading: (loading: boolean, message?: string | null) => void;
  clearNotifications: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeModal: null,
  notifications: [],
  globalLoading: false,
  loadingMessage: null,
  
  openModal: (modalId) => set({ activeModal: modalId }),
  
  closeModal: () => set({ activeModal: null }),
  
  addNotification: (message, type = 'info') => {
    const notification = {
      id: `${Date.now()}-${Math.random()}`,
      message,
      type,
      timestamp: Date.now(),
    };
    set((state) => ({
      notifications: [...state.notifications, notification],
    }));
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== notification.id),
      }));
    }, 5000);
  },
  
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  
  setGlobalLoading: (loading, message = null) =>
    set({ globalLoading: loading, loadingMessage: message ?? null }),
  
  clearNotifications: () => set({ notifications: [] }),
}));

