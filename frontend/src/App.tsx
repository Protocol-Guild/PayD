import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Home from './pages/Home';
import Debugger from './pages/Debugger';
import PayrollScheduler from './pages/PayrollScheduler';
import EmployeeEntry from './pages/EmployeeEntry';
import EmployerLayout from './components/EmployerLayout';
import HelpCenter from './pages/HelpCenter';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorFallback from './components/ErrorFallback';
import Settings from './pages/Settings';
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
            <ErrorBoundary fallback={<ErrorFallback onReset={() => window.location.reload()} />}>
              <Settings />
            </ErrorBoundary>
          }
        />
        <Route
          path="/help"
          element={
            <ErrorBoundary fallback={<ErrorFallback onReset={() => window.location.reload()} />}>
              <HelpCenter />
            </ErrorBoundary>
          }
        />
        <Route
          path="/cross-asset-payment"
          element={
            <ErrorBoundary fallback={<ErrorFallback onReset={() => window.location.reload()} />}>
              <CrossAssetPayment />
            </ErrorBoundary>
          }
        />
        <Route
          path="/transactions"
          element={
            <ErrorBoundary fallback={<ErrorFallback onReset={() => window.location.reload()} />}>
              <TransactionHistory />
            </ErrorBoundary>
          }
        />
        <Route
          path="/forecast"
          element={
            <ErrorBoundary fallback={<ErrorFallback onReset={() => window.location.reload()} />}>
              <Forecasting />
            </ErrorBoundary>
          }
        />
        <Route
          path="/vesting"
          element={
            <ErrorBoundary fallback={<ErrorFallback onReset={() => window.location.reload()} />}>
              <VestingEscrow />
            </ErrorBoundary>
          }
        />
        <Route
          path="/revenue-split"
          element={
            <ErrorBoundary fallback={<ErrorFallback onReset={() => window.location.reload()} />}>
              <RevenueSplitDashboard />
            </ErrorBoundary>
          }
        />
        <Route
          path="/tax-compliance"
          element={
            <ErrorBoundary fallback={<ErrorFallback onReset={() => window.location.reload()} />}>
              <TaxComplianceWizard />
            </ErrorBoundary>
          }
        />
      </Route>
      <Route
        path="/login"
        element={
          <ErrorBoundary
            fallback={
              <ErrorFallback
                onReset={() => window.location.reload()}
              />
            }
          >
            <Login />
          </ErrorBoundary>
        }
      />
      <Route
        path="/auth-callback"
        element={
          <ErrorBoundary
            fallback={
              <ErrorFallback
                onReset={() => window.location.reload()}
              />
            }
          >
            <AuthCallback />
          </ErrorBoundary>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
