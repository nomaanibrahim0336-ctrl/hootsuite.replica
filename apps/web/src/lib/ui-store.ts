'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  // Transient (not persisted) overlay state:
  composerOpen: boolean;
  paletteOpen: boolean;
  mobileNavOpen: boolean;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  openComposer: () => void;
  closeComposer: () => void;
  setPalette: (open: boolean) => void;
  setMobileNav: (open: boolean) => void;
}

function applyTheme(theme: 'light' | 'dark') {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      sidebarCollapsed: false,
      composerOpen: false,
      paletteOpen: false,
      mobileNavOpen: false,
      toggleTheme: () => {
        const theme = get().theme === 'light' ? 'dark' : 'light';
        applyTheme(theme);
        set({ theme });
      },
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      openComposer: () => set({ composerOpen: true }),
      closeComposer: () => set({ composerOpen: false }),
      setPalette: (paletteOpen) => set({ paletteOpen }),
      setMobileNav: (mobileNavOpen) => set({ mobileNavOpen }),
    }),
    {
      name: 'socialhub-ui',
      // Only persist durable prefs; overlays always start closed.
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    }
  )
);
