import { create } from 'zustand';

export const useUIStore = create((set) => ({
  mobileMenuOpen: false,
  sidebarOpen: false,
  theme: 'light',
  toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setTheme: (theme) => set({ theme }),
}));
