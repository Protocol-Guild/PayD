import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle dark/light mode"
      className="theme-toggle"
      type="button"
    >
      <span className="theme-icon" aria-hidden="true">
        {theme === 'dark' ? '☀️' : '🌙'}
      </span>
      <span className="theme-label">
        {theme === 'dark' ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}
