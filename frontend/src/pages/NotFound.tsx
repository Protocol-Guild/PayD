import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="card glass noise max-w-md w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-warning/10 border border-warning/20">
          <span className="text-3xl font-bold text-warning">404</span>
        </div>
        <h2 className="text-2xl font-bold mb-2">{t('notFound.title')}</h2>
        <p className="text-muted text-sm mb-6">{t('notFound.description')}</p>
        <div className="flex flex-col gap-2 sm:flex-row items-center justify-center sm:gap-3">
          <Link
            to="/"
            className="px-4 py-2 rounded-lg bg-accent text-bg font-semibold text-sm hover:scale-105 transition-transform w-full sm:w-auto"
          >
            {t('notFound.goHome')}
          </Link>
          <Link
            to="/payroll"
            className="px-4 py-2 rounded-lg border border-hi text-sm font-medium text-text hover:bg-white/5 transition-colors w-full sm:w-auto"
          >
            {t('nav.payroll')}
          </Link>
          <Link
            to="/employee"
            className="px-4 py-2 rounded-lg border border-hi text-sm font-medium text-text hover:bg-white/5 transition-colors w-full sm:w-auto"
          >
            {t('employees.titleHighlight')}
          </Link>
          <Link
            to="/help"
            className="px-4 py-2 rounded-lg border border-hi text-sm font-medium text-text hover:bg-white/5 transition-colors w-full sm:w-auto"
          >
            {t('notFound.helpCenter')}
          </Link>
        </div>
      </div>
    </div>
  );
}