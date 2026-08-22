import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import EmployerLayout from './components/EmployerLayout';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorFallback from './components/ErrorFallback';
import { useTranslation } from 'react-i18next';
import { contractService } from './services/contracts';

// Lazy-loaded page components for route-level code splitting
const Home = lazy(() => import('./pages/Home'));
const Debugger = lazy(() => import('./pages/Debugger'));
const PayrollScheduler = lazy(() => import('./pages/PayrollScheduler'));
const EmployeeEntry = lazy(() => import('./pages/EmployeeEntry'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const Settings = lazy(() => import('./pages/Settings'));
const WebhookSettings = lazy(() => import('./pages/WebhookSettings'));
const CustomReportBuilder = lazy(() => import('./pages/CustomReportBuilder'));
const CrossAssetPayment = lazy(() => import('./pages/CrossAssetPayment'));
const TransactionHistory = lazy(() => import('./pages/TransactionHistory'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const VestingEscrow = lazy(() => import('./pages/VestingEscrow'));
const RevenueSplitDashboard = lazy(() => import('./pages/RevenueSplitDashboard'));
const Forecasting = lazy(() => import('./pages/Forecasting'));
const TaxComplianceWizard = lazy(() => import('./pages/TaxComplianceWizard'));
const EmployeePortal = lazy(() => import('./pages/EmployeePortal'));
const Login = lazy(() => import('./pages/Login'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-sm text-muted">Loading…</p>
      </div>
    </div>
  );
}

function App() {
  const { t } = useTranslation();

  // Initialize contract service on app startup
  useEffect(() => {
    contractService.initialize().catch((error) => {
      console.error('Failed to initialize contract service:', error);
    });
  }, []);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<EmployerLayout />}>
          <Route
            path="/"
            element={
              <ErrorBoundary
                fallback={
                  <ErrorFallback
                    title={t('errorFallback.homeTitle')}
                    description={t('errorFallback.homeDescription')}
                  />
                }
              >
                <Home />
              </ErrorBoundary>
            }
          />
          <Route
            path="/payroll"
            element={
              <ErrorBoundary
                fallback={
                  <ErrorFallback
                    title={t('errorFallback.payrollTitle')}
                    description={t('errorFallback.payrollDescription')}
                  />
                }
              >
                <PayrollScheduler />
              </ErrorBoundary>
            }
          />
          <Route
            path="/employee"
            element={
              <ErrorBoundary
                fallback={
                  <ErrorFallback
                    title={t('errorFallback.employeesTitle')}
                    description={t('errorFallback.employeesDescription')}
                  />
                }
              >
                <EmployeeEntry />
              </ErrorBoundary>
            }
          />
          <Route
            path="/portal"
            element={
              <ErrorBoundary
                fallback={
                  <ErrorFallback
                    title="Employee Portal Error"
                    description="Something went wrong loading your portal."
                  />
                }
              >
                <EmployeePortal />
              </ErrorBoundary>
            }
          />
          <Route
            path="/reports"
            element={
              <ErrorBoundary fallback={<ErrorFallback />}>
                <CustomReportBuilder />
              </ErrorBoundary>
            }
          />
          <Route
            path="/debug"
            element={
              <ErrorBoundary
                fallback={
                  <ErrorFallback
                    title={t('errorFallback.debuggerTitle')}
                    description={t('errorFallback.debuggerDescription')}
                  />
                }
              >
                <Debugger />
              </ErrorBoundary>
            }
          />
          <Route
            path="/debug/:contractName"
            element={
              <ErrorBoundary
                fallback={
                  <ErrorFallback
                    title={t('errorFallback.debuggerTitle')}
                    description={t('errorFallback.debuggerDescription')}
                  />
                }
              >
                <Debugger />
              </ErrorBoundary>
            }
          />
          <Route
            path="/admin"
            element={
              <ErrorBoundary fallback={<ErrorFallback />}>
                <AdminPanel />
              </ErrorBoundary>
            }
          />
          <Route
            path="/settings"
            element={
              <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
                <Settings />
              </ErrorBoundary>
            }
          />
          <Route
            path="/settings/webhooks"
            element={
              <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
                <WebhookSettings />
              </ErrorBoundary>
            }
          />
          <Route
            path="/help"
            element={
              <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
                <HelpCenter />
              </ErrorBoundary>
            }
          />
          <Route
            path="/cross-asset-payment"
            element={
              <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
                <CrossAssetPayment />
              </ErrorBoundary>
            }
          />
          <Route
            path="/transactions"
            element={
              <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
                <TransactionHistory />
              </ErrorBoundary>
            }
          />
          <Route
            path="/forecast"
            element={
              <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
                <Forecasting />
              </ErrorBoundary>
            }
          />
          <Route
            path="/vesting"
            element={
              <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
                <VestingEscrow />
              </ErrorBoundary>
            }
          />
          <Route
            path="/revenue-split"
            element={
              <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
                <RevenueSplitDashboard />
              </ErrorBoundary>
            }
          />
          <Route
            path="/tax-compliance"
            element={
              <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
                <TaxComplianceWizard />
              </ErrorBoundary>
            }
          />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/auth-callback" element={<AuthCallback />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default App;