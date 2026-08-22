import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function RouteLoader() {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex items-center justify-center p-12">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-sm text-muted">{t('routeLoader.loading', 'Loading…')}</p>
      </div>
    </div>
  );
}