import { Icon } from '@stellar/design-system';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './Home.module.css';

/**
 * Home
 *
 * Landing page with responsive dashboard grid layout.
 * Uses design tokens for consistent spacing, typography, and breakpoints.
 *
 * This component demonstrates:
 * - Responsive grid layout that adapts from 1 to 3 columns
 * - Consistent spacing using design tokens
 * - Mobile-first approach with progressive enhancement
 * - Accessibility considerations (reduced motion support)
 */

export default function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className={`page-fade ${styles.page}`}>
      <div id="tour-welcome" className={`${styles.heroIcon} glass glow-mint rounded-full relative`}>
        <Icon.Rocket01 size="xl" className="text-accent relative z-20" />
        <div className={styles.heroGlow} />
      </div>

      <h1 className={styles.heroTitle}>
        {t('home.titleLine1Prefix')}{' '}
        <span className={styles.heroAccent}>{t('home.titleLine1Highlight')}</span>
        <br />
        {t('home.titleLine2Prefix')}{' '}
        <span className={styles.heroAccent2}>{t('home.titleLine2Highlight')}</span>
        {t('home.titleLine2Suffix')}
      </h1>

      <p className={styles.heroTagline}>{t('home.tagline')}</p>

      <div className={styles.ctaGroup}>
        <button
          className={styles.ctaPrimary}
          onClick={() => {
            void navigate('/payroll');
          }}
        >
          {t('home.ctaManagePayroll')}
        </button>
        <button
          className={styles.ctaSecondary}
          onClick={() => {
            void navigate('/employee');
          }}
        >
          {t('home.ctaViewEmployees')}
        </button>
      </div>

      <div className={styles.featureGrid}>
        <div className={`${styles.featureCard} glass noise`}>
          <div className={`${styles.featureIcon} ${styles.featureIconAccent}`}>
            <Icon.CreditCard01 size="lg" className="text-accent" />
          </div>
          <h3 className={styles.featureTitle}>{t('home.card1Title')}</h3>
          <p className={styles.featureDescription}>{t('home.card1Body')}</p>
        </div>

        <div className={`${styles.featureCard} glass noise`}>
          <div className={`${styles.featureIcon} ${styles.featureIconAccent2}`}>
            <Icon.Users01 size="lg" className="text-accent2" />
          </div>
          <h3 className={styles.featureTitle}>{t('home.card2Title')}</h3>
          <p className={styles.featureDescription}>{t('home.card2Body')}</p>
        </div>

        <div className={`${styles.featureCard} glass noise`}>
          <div className={`${styles.featureIcon} ${styles.featureIconDanger}`}>
            <Icon.ShieldTick size="lg" className="text-danger" />
          </div>
          <h3 className={styles.featureTitle}>{t('home.card3Title')}</h3>
          <p className={styles.featureDescription}>{t('home.card3Body')}</p>
        </div>
      </div>
    </div>
  );
}
