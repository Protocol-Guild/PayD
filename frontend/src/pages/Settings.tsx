import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useState } from 'react';
import { getOrgProfile, updateOrgProfile, type OrgProfile } from '../services/orgApi';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export default function Settings() {
  const { t, i18n } = useTranslation();

  const handleChangeLanguage = (event: React.ChangeEvent<HTMLSelectElement>) => {
    void i18n.changeLanguage(event.target.value);
  };

  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [form, setForm] = useState({ name: '', contactEmail: '', contactPhone: '' });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const org = await getOrgProfile();
      setProfile(org);
      setForm({
        name: org.name ?? '',
        contactEmail: org.contactEmail ?? '',
        contactPhone: org.contactPhone ?? '',
      });
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleFieldChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setValidationError(null);
    if (saveStatus === 'success' || saveStatus === 'error') {
      setSaveStatus('idle');
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setValidationError(t('settings.orgNameRequired'));
      return;
    }

    setSaveStatus('saving');
    setValidationError(null);
    try {
      const updated = await updateOrgProfile({
        name: form.name.trim(),
        contactEmail: form.contactEmail.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
      });
      setProfile(updated);
      setSaveStatus('success');
    } catch {
      setSaveStatus('error');
    }
  };

  const inputClassName =
    'w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all';

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-3xl mx-auto w-full">
      <div className="w-full mb-12 flex items-end justify-between border-b border-hi pb-8">
        <div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">{t('settings.title')}</h1>
        </div>
      </div>

      <div className="w-full card glass noise p-8 mb-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight mb-1">
            {t('settings.organizationSectionTitle')}
          </h2>
          <p className="text-sm text-muted">{t('settings.organizationSectionDescription')}</p>
        </div>

        {loading ? (
          <p className="text-sm text-muted">{t('settings.loading')}</p>
        ) : loadError ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-red-400">{t('settings.loadError')}</p>
            <button
              onClick={() => void loadProfile()}
              className="self-start px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl border border-hi text-text hover:border-accent/50 hover:bg-accent/5 transition-all"
            >
              {t('settings.retry')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {profile && (
              <p className="text-xs font-mono text-muted">
                {t('settings.organizationIdLabel')}: {profile.id}
              </p>
            )}

            <div className="flex flex-col gap-3">
              <label className="block text-xs font-bold uppercase tracking-widest text-muted">
                {t('settings.orgNameLabel')}
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(event) => handleFieldChange('name', event.target.value)}
                className={inputClassName}
              />
            </div>

            <div className="flex flex-col gap-3">
              <label className="block text-xs font-bold uppercase tracking-widest text-muted">
                {t('settings.orgContactEmailLabel')}
              </label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(event) => handleFieldChange('contactEmail', event.target.value)}
                placeholder="admin@example.com"
                className={inputClassName}
              />
            </div>

            <div className="flex flex-col gap-3">
              <label className="block text-xs font-bold uppercase tracking-widest text-muted">
                {t('settings.orgContactPhoneLabel')}
              </label>
              <input
                type="tel"
                value={form.contactPhone}
                onChange={(event) => handleFieldChange('contactPhone', event.target.value)}
                placeholder="+1 555 000 0000"
                className={inputClassName}
              />
            </div>

            {validationError && <p className="text-sm text-red-400">{validationError}</p>}
            {saveStatus === 'success' && (
              <p className="text-sm text-emerald-400">{t('settings.saveSuccess')}</p>
            )}
            {saveStatus === 'error' && (
              <p className="text-sm text-red-400">{t('settings.saveError')}</p>
            )}

            <button
              onClick={() => void handleSave()}
              disabled={saveStatus === 'saving'}
              className="self-start px-6 py-3 bg-accent text-black font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saveStatus === 'saving' ? t('settings.saving') : t('settings.save')}
            </button>
          </div>
        )}
      </div>

      <div className="w-full card glass noise p-8">
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
      </div>

      <Link
        to="/settings/two-factor"
        className="w-full card glass noise p-8 mt-8 flex items-center justify-between gap-4 hover:border-hi transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl grid place-items-center bg-accent/10 text-accent">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold">{t('settings.twoFactorLabel')}</p>
            <p className="text-sm text-muted">{t('settings.twoFactorDescription')}</p>
          </div>
        </div>
      </Link>

      <Link
        to="/settings/webhooks"
        className="w-full card glass noise p-8 mt-8 flex items-center justify-between gap-4 hover:border-hi transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl grid place-items-center bg-accent/10 text-accent">
            <Webhook className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold">{t('settings.webhooksLabel')}</p>
            <p className="text-sm text-muted">{t('settings.webhooksDescription')}</p>
          </div>
        </div>
      </Link>
    </div>
  );
}
