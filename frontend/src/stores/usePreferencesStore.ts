import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Global preferences store using Zustand
 * Handles user preferences like theme, filters, and UI state
 */

interface PreferencesState {
  // Theme preferences
  theme: 'light' | 'dark' | 'auto';
  
  // Filter preferences
  defaultSeason: number;
  defaultPosition: string;
  defaultMetric: string;
  
  // UI preferences
  sidebarOpen: boolean;
  compactMode: boolean;
  
  // Actions
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  setDefaultSeason: (season: number) => void;
  setDefaultPosition: (position: string) => void;
  setDefaultMetric: (metric: string) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setCompactMode: (compact: boolean) => void;
  resetPreferences: () => void;
}

const initialState = {
  theme: 'auto' as const,
  defaultSeason: 2025,
  defaultPosition: 'ALL',
  defaultMetric: 'fantasy_points_ppr',
  sidebarOpen: false,
  compactMode: false,
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...initialState,
      
      setTheme: (theme) => set({ theme }),
      
      setDefaultSeason: (season) => set({ defaultSeason: season }),
      
      setDefaultPosition: (position) => set({ defaultPosition: position }),
      
      setDefaultMetric: (metric) => set({ defaultMetric: metric }),
      
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      setCompactMode: (compact) => set({ compactMode: compact }),
      
      resetPreferences: () => set(initialState),
    }),
    {
      name: 'nfl-app-preferences',
      storage: createJSONStorage(() => localStorage),
      // Only persist certain preferences
      partialize: (state) => ({
        theme: state.theme,
        defaultSeason: state.defaultSeason,
        defaultPosition: state.defaultPosition,
        defaultMetric: state.defaultMetric,
        compactMode: state.compactMode,
      }),
    }
  )
);

