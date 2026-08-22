import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { contractService } from './services/contracts';

import { lazyWithRetry } from './utils/lazyWithRetry';
// EmployerLayout renders an <Outlet /> for nested routes; keeping it eagerly
// imported guarantees the layout shell is always resolvable before any lazy
// child page suspends (a suspending layout would bubble past child Suspense
// boundaries to the root with no fallback).
import EmployerLayout from './components/EmployerLayout';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorFallback from './components/ErrorFallback';
import RouteLoader from './components/RouteLoader';

/* ------------------------------------------------------------------ */
/*  Lazy-loaded page components — code split per route                */
/* ------------------------------------------------------------------ */
const Home = lazyWithRetry(() => import('./pages/Home'), 'Home');
const Debugger = lazyWithRetry(() => import('./pages/Debugger'), 'Debugger');
const PayrollScheduler = lazyWithRetry(
  () => import('./pages/PayrollScheduler'),
  'PayrollScheduler',
);
const EmployeeEntry = lazyWithRetry(
  () => import('./pages/EmployeeEntry'),
  'EmployeeEntry',
);
const HelpCenter = lazyWithRetry(() => import('./pages/HelpCenter'), 'HelpCenter');
const Settings = lazyWithRetry(() => import('./pages/Settings'), 'Settings');
const WebhookSettings = lazyWithRetry(
  () => import('./pages/WebhookSettings'),
  'WebhookSettings',
);
const CustomReportBuilder = lazyWithRetry(
  () => import('./pages/CustomReportBuilder'),
  'CustomReportBuilder',
);
const CrossAssetPayment = lazyWithRetry(
  () => import('./pages/CrossAssetPayment'),
  'CrossAssetPayment',
);
const TransactionHistory = lazyWithRetry(
  () => import('./pages/TransactionHistory'),
  'TransactionHistory',
);
const AdminPanel = lazyWithRetry(() => import('./pages/AdminPanel'), 'AdminPanel');
const VestingEscrow = lazyWithRetry(
  () => import('./pages/VestingEscrow'),
  'VestingEscrow',
);
const RevenueSplitDashboard = lazyWithRetry(
  () => import('./pages/RevenueSplitDashboard'),
  'RevenueSplitDashboard',
);
const Forecasting = lazyWithRetry(
  () => import('./pages/Forecasting'),
  'Forecasting',
);
const TaxComplianceWizard = lazyWithRetry(
  () => import('./pages/TaxComplianceWizard'),
  'TaxComplianceWizard',
);
const EmployeePortal = lazyWithRetry(
  () => import('./pages/EmployeePortal'),
  'EmployeePortal',
);
const Login = lazyWithRetry(() => import('./pages/Login'), 'Login');
const AuthCallback = lazyWithRetry(
  () => import('./pages/AuthCallback'),
  'AuthCallback',
);

/* ------------------------------------------------------------------ */
/*  LazyRoute — Suspense + ErrorBoundary wrapper for a lazy page      */
/* ------------------------------------------------------------------ */
function LazyRoute({
  component: Component,
  errorTitle,
  errorDescription,
}: {
  component: React.ComponentType;
  errorTitle?: string;
  errorDescription?: string;
}) {
  return (
    <ErrorBoundary
      fallback={({ onReset }) => (
        <ErrorFallback
          title={errorTitle}
          description={errorDescription}
          onReset={onReset}
        />
      )}
    >
      <Suspense fallback={<RouteLoader />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  );
}

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */
function App() {
  const { t } = useTranslation();

  // Initialize contract service on app startup
  useEffect(() => {
    contractService.initialize().catch((error) => {
      console.error('Failed to initialize contract service:', error);
    });
  }, []);

  return (
    <Routes>
      <Route element={<EmployerLayout />}>
        <Route
          path="/"
          element={
            <LazyRoute
              component={Home}
              errorTitle={t('errorFallback.homeTitle')}
              errorDescription={t('errorFallback.homeDescription')}
            />
          }
        />
        <Route
          path="/payroll"
          element={
            <LazyRoute
              component={PayrollScheduler}
              errorTitle={t('errorFallback.payrollTitle')}
              errorDescription={t('errorFallback.payrollDescription')}
            />
          }
        />
        <Route
          path="/employee"
          element={
            <LazyRoute
              component={EmployeeEntry}
              errorTitle={t('errorFallback.employeesTitle')}
              errorDescription={t('errorFallback.employeesDescription')}
            />
          }
        />
        <Route
          path="/portal"
          element={
            <LazyRoute
              component={EmployeePortal}
              errorTitle="Employee Portal Error"
              errorDescription="Something went wrong loading your portal."
            />
          }
        />
        <Route
          path="/reports"
          element={<LazyRoute component={CustomReportBuilder} />}
        />
        <Route
          path="/debug"
          element={
            <LazyRoute
              component={Debugger}
              errorTitle={t('errorFallback.debuggerTitle')}
              errorDescription={t('errorFallback.debuggerDescription')}
            />
          }
        />
        <Route
          path="/debug/:contractName"
          element={
            <LazyRoute
              component={Debugger}
              errorTitle={t('errorFallback.debuggerTitle')}
              errorDescription={t('errorFallback.debuggerDescription')}
            />
          }
        />
        <Route path="/admin" element={<LazyRoute component={AdminPanel} />} />
        <Route path="/settings" element={<LazyRoute component={Settings} />} />
        <Route
          path="/settings/webhooks"
          element={<LazyRoute component={WebhookSettings} />}
        />
        <Route path="/help" element={<LazyRoute component={HelpCenter} />} />
        <Route
          path="/cross-asset-payment"
          element={<LazyRoute component={CrossAssetPayment} />}
        />
        <Route
          path="/transactions"
          element={<LazyRoute component={TransactionHistory} />}
        />
        <Route path="/forecast" element={<LazyRoute component={Forecasting} />} />
        <Route path="/vesting" element={<LazyRoute component={VestingEscrow} />} />
        <Route
          path="/revenue-split"
          element={<LazyRoute component={RevenueSplitDashboard} />}
        />
        <Route
          path="/tax-compliance"
          element={<LazyRoute component={TaxComplianceWizard} />}
        />
      </Route>
      <Route path="/login" element={<LazyRoute component={Login} />} />
      <Route path="/auth-callback" element={<LazyRoute component={AuthCallback} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;