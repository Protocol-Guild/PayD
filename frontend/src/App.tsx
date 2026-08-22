import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import Home from './pages/Home';
import Debugger from './pages/Debugger';
import PayrollScheduler from './pages/PayrollScheduler';
import EmployeeEntry from './pages/EmployeeEntry';
import EmployerLayout from './components/EmployerLayout';
import HelpCenter from './pages/HelpCenter';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorFallback from './components/ErrorFallback';
import Settings from './pages/Settings';
import WebhookSettings from './pages/WebhookSettings';
import CustomReportBuilder from './pages/CustomReportBuilder';
import CrossAssetPayment from './pages/CrossAssetPayment';
import TransactionHistory from './pages/TransactionHistory';
import AdminPanel from './pages/AdminPanel';
import VestingEscrow from './pages/VestingEscrow';
import RevenueSplitDashboard from './pages/RevenueSplitDashboard';
import Forecasting from './pages/Forecasting';
import TaxComplianceWizard from './pages/TaxComplianceWizard';

import EmployeePortal from './pages/EmployeePortal';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import { useTranslation } from 'react-i18next';
import { contractService } from './services/contracts';

/**
 * Wraps a route element in an ErrorBoundary that auto-resets when the user
 * navigates to a different route path. This ensures a crash on one route
 * doesn't permanently break navigation to another route.
 */
function RouteBoundary({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname} fallback={fallback ?? <ErrorFallback />}>
      {children}
    </ErrorBoundary>
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
    <Routes>
      <Route element={<EmployerLayout />}>
        <Route
          path="/"
          element={
            <RouteBoundary
              fallback={
                <ErrorFallback
                  title={t('errorFallback.homeTitle')}
                  description={t('errorFallback.homeDescription')}
                />
              }
            >
              <Home />
            </RouteBoundary>
          }
        />
        <Route
          path="/payroll"
          element={
            <RouteBoundary
              fallback={
                <ErrorFallback
                  title={t('errorFallback.payrollTitle')}
                  description={t('errorFallback.payrollDescription')}
                />
              }
            >
              <PayrollScheduler />
            </RouteBoundary>
          }
        />
        <Route
          path="/employee"
          element={
            <RouteBoundary
              fallback={
                <ErrorFallback
                  title={t('errorFallback.employeesTitle')}
                  description={t('errorFallback.employeesDescription')}
                />
              }
            >
              <EmployeeEntry />
            </RouteBoundary>
          }
        />
        <Route
          path="/portal"
          element={
            <RouteBoundary
              fallback={<ErrorFallback title="Employee Portal Error" description="Something went wrong loading your portal." />}
            >
              <EmployeePortal />
            </RouteBoundary>
          }
        />
        <Route
          path="/reports"
          element={
            <RouteBoundary>
              <CustomReportBuilder />
            </RouteBoundary>
          }
        />
        <Route
          path="/debug"
          element={
            <RouteBoundary
              fallback={
                <ErrorFallback
                  title={t('errorFallback.debuggerTitle')}
                  description={t('errorFallback.debuggerDescription')}
                />
              }
            >
              <Debugger />
            </RouteBoundary>
          }
        />
        <Route
          path="/debug/:contractName"
          element={
            <RouteBoundary
              fallback={
                <ErrorFallback
                  title={t('errorFallback.debuggerTitle')}
                  description={t('errorFallback.debuggerDescription')}
                />
              }
            >
              <Debugger />
            </RouteBoundary>
          }
        />
        <Route
          path="/admin"
          element={
            <RouteBoundary>
              <AdminPanel />
            </RouteBoundary>
          }
        />
        <Route
          path="/settings"
          element={
            <RouteBoundary>
              <Settings />
            </RouteBoundary>
          }
        />
        <Route
          path="/settings/webhooks"
          element={
            <RouteBoundary>
              <WebhookSettings />
            </RouteBoundary>
          }
        />
        <Route
          path="/help"
          element={
            <RouteBoundary>
              <HelpCenter />
            </RouteBoundary>
          }
        />
        <Route
          path="/cross-asset-payment"
          element={
            <RouteBoundary>
              <CrossAssetPayment />
            </RouteBoundary>
          }
        />
        <Route
          path="/transactions"
          element={
            <RouteBoundary>
              <TransactionHistory />
            </RouteBoundary>
          }
        />
        <Route
          path="/forecast"
          element={
            <RouteBoundary>
              <Forecasting />
            </RouteBoundary>
          }
        />
        <Route
          path="/vesting"
          element={
            <RouteBoundary>
              <VestingEscrow />
            </RouteBoundary>
          }
        />
        <Route
          path="/revenue-split"
          element={
            <RouteBoundary>
              <RevenueSplitDashboard />
            </RouteBoundary>
          }
        />
        <Route
          path="/tax-compliance"
          element={
            <RouteBoundary>
              <TaxComplianceWizard />
            </RouteBoundary>
          }
        />
      </Route>
      <Route
        path="/login"
        element={
          <RouteBoundary>
            <Login />
          </RouteBoundary>
        }
      />
      <Route
        path="/auth-callback"
        element={
          <RouteBoundary>
            <AuthCallback />
          </RouteBoundary>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;