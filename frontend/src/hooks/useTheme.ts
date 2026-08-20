import { useThemeStore } from '../stores/themeStore';

export type Theme = 'light' | 'dark';

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

/**
 * useTheme hook — reads theme state from the zustand store.
 *
 * Components that call this hook will re-render when the theme changes.
 * Theme persistence is handled by the zustand persist middleware.
 */
export const useTheme = () => {
  const theme = useThemeStore((s) => s.theme as Theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return { theme, toggleTheme, setTheme };
};