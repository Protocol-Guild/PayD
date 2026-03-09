import { useTranslation } from 'react-i18next';
import { useOrganizationOnboarding } from '../hooks/useOrganizationOnboarding';
import { useNotification } from '../hooks/useNotification';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { resetOnboarding, isCompleted } = useOrganizationOnboarding();
  const { notifySuccess, notifyError } = useNotification();

  const handleChangeLanguage = (event: React.ChangeEvent<HTMLSelectElement>) => {
    void i18n.changeLanguage(event.target.value);
  };

  const handleResetOnboarding = () => {
    try {
      resetOnboarding();
      notifySuccess('Onboarding reset successfully! The wizard will appear on your next visit.');
    } catch (error) {
      notifyError('Failed to reset onboarding');
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-3xl mx-auto w-full">
      <div className="w-full mb-12 flex items-end justify-between border-b border-hi pb-8">
        <div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">{t('settings.title')}</h1>
        </div>
      </div>

      <div className="w-full card glass noise p-8">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <label className="block text-xs font-bold uppercase tracking-widest text-muted">
              {t('settings.languageLabel')}
            </label>
            <p className="text-sm text-muted">{t('settings.languageDescription')}</p>
            <select
              value={i18n.language}
              onChange={handleChangeLanguage}
              className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all"
            >
              <option value="en">{t('settings.languageEnglish')}</option>
              <option value="es">{t('settings.languageSpanish')}</option>
            </select>
          </div>

          {isCompleted && (
            <div className="flex flex-col gap-3 border-t border-hi pt-8">
              <label className="block text-xs font-bold uppercase tracking-widest text-muted">
                Organization Setup
              </label>
              <p className="text-sm text-muted">
                Reset the organization onboarding wizard to reconfigure your payroll setup.
              </p>
              <button
                onClick={handleResetOnboarding}
                className="px-4 py-2 bg-accent/10 border border-accent/20 text-accent rounded-lg font-medium hover:bg-accent/20 transition-colors"
              >
                Reset Organization Setup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
