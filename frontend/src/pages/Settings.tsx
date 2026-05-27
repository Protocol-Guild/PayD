import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Moon, Sun, Bell, Shield } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [languageLoading, setLanguageLoading] = useState(false);

  const handleChangeLanguage = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguageLoading(true);
    await i18n.changeLanguage(event.target.value);
    setLanguageLoading(false);
  };

  return (
    <main
      className="flex-1 flex flex-col items-center justify-start p-6 md:p-12 max-w-3xl mx-auto w-full"
      aria-labelledby="settings-heading"
    >
      <div className="w-full mb-8 md:mb-12 flex items-end justify-between border-b border-[var(--border-hi)] pb-6 md:pb-8">
        <div>
          <h1 id="settings-heading" className="text-3xl md:text-4xl font-black mb-2 tracking-tight text-[var(--text)]">
            {t('settings.title')}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Manage your application preferences and account settings
          </p>
        </div>
      </div>

      <div className="w-full flex flex-col gap-6">
        <section
          aria-labelledby="language-section-heading"
          className="card glass noise p-6 md:p-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-[rgba(74,240,184,0.08)] flex items-center justify-center">
              <Globe className="w-5 h-5 text-[var(--accent)]" aria-hidden="true" />
            </div>
            <h2 id="language-section-heading" className="text-lg font-bold text-[var(--text)]">
              {t('settings.languageLabel')}
            </h2>
          </div>
          <p className="text-sm text-[var(--muted)] mb-4">{t('settings.languageDescription')}</p>
          <label htmlFor="language-select" className="sr-only">
            {t('settings.languageLabel')}
          </label>
          <div className="relative max-w-xs">
            <select
              id="language-select"
              value={i18n.language}
              onChange={handleChangeLanguage}
              disabled={languageLoading}
              className="w-full bg-[var(--surface-hi)] border border-[var(--border-hi)] rounded-xl px-4 py-3 text-[var(--text)] text-sm outline-none transition-all focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/20 disabled:opacity-60 disabled:cursor-wait cursor-pointer appearance-none"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%238b949e' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
                backgroundPosition: 'right 0.75rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.25em 1.25em',
                paddingRight: '2.5rem',
              }}
            >
              <option value="en">{t('settings.languageEnglish')}</option>
              <option value="es">{t('settings.languageSpanish')}</option>
            </select>
          </div>
        </section>

        <section
          aria-labelledby="theme-section-heading"
          className="card glass noise p-6 md:p-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-[rgba(124,111,247,0.08)] flex items-center justify-center">
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-[var(--accent2)]" aria-hidden="true" />
              ) : (
                <Sun className="w-5 h-5 text-[var(--accent2)]" aria-hidden="true" />
              )}
            </div>
            <h2 id="theme-section-heading" className="text-lg font-bold text-[var(--text)]">
              Appearance
            </h2>
          </div>
          <p className="text-sm text-[var(--muted)] mb-4">
            Switch between light and dark mode to match your preference.
          </p>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-3 px-5 py-3 rounded-xl border border-[var(--border-hi)] bg-[var(--surface-hi)] text-sm font-medium text-[var(--text)] hover:border-[var(--accent2)]/40 hover:bg-[rgba(124,111,247,0.04)] focus:outline-none focus:ring-2 focus:ring-[var(--accent2)]/40 transition-all active:scale-[0.98]"
            aria-pressed={theme === 'dark'}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span
              className={`w-10 h-6 rounded-full p-0.5 transition-colors flex items-center ${
                theme === 'dark' ? 'bg-[var(--accent2)]' : 'bg-[var(--border-hi)]'
              }`}
              aria-hidden="true"
            >
              <span
                className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </span>
            <span>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
          </button>
        </section>

        <section
          aria-labelledby="notifications-section-heading"
          className="card glass noise p-6 md:p-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-[rgba(74,240,184,0.08)] flex items-center justify-center">
              <Bell className="w-5 h-5 text-[var(--accent)]" aria-hidden="true" />
            </div>
            <h2 id="notifications-section-heading" className="text-lg font-bold text-[var(--text)]">
              Notifications
            </h2>
          </div>
          <p className="text-sm text-[var(--muted)] mb-4">
            Notification preferences are managed through your browser and email settings.
            In-app notifications will appear for payroll events and transaction updates.
          </p>
          <p className="text-xs text-[var(--muted)] font-mono">
            <Shield className="w-3.5 h-3.5 inline mr-1 align-text-bottom" aria-hidden="true" />
            Notification settings are automatically configured based on your role and permissions.
          </p>
        </section>
      </div>
    </main>
  );
}
