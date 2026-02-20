import { Routes, Route, Outlet, NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import ConnectAccount from "./components/ConnectAccount.tsx";
import Home from "./pages/Home";
import Debugger from "./pages/Debugger.tsx";
import PayrollScheduler from "./pages/PayrollScheduler";
import EmployeeEntry from "./pages/EmployeeEntry";

// ── Icon components ────────────────────────────────────────────────────────────

const PayrollIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);

const EmployeesIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const DebugIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

// ── Page wrapper ───────────────────────────────────────────────────────────────

const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="page-fade" style={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</div>
);

// ── AppLayout ──────────────────────────────────────────────────────────────────

const AppLayout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="app-shell">
      {/* ── Header ── */}
      <header className="app-header noise">
        {/* Logo */}
        <NavLink to="/" className="logo-lockup" style={{ textDecoration: "none" }}>
          <div className="logo-mark">P</div>
          <span className="logo-name">Pay<span>D</span></span>
          <span className="logo-tag">BETA</span>
        </NavLink>

        {/* Nav */}
        <nav className="app-nav">
          <NavLink
            to="/payroll"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <span className="nav-icon"><PayrollIcon /></span>
            Payroll
          </NavLink>

          <NavLink
            to="/employee"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <span className="nav-icon"><EmployeesIcon /></span>
            Employees
          </NavLink>

          <div className="nav-sep" />

          <NavLink
            to="/debug"
            className={({ isActive }) => `nav-link debug-link${isActive ? " active" : ""}`}
          >
            <span className="nav-icon"><DebugIcon /></span>
            debugger
          </NavLink>
        </nav>

        {/* Connect account */}
        <div className="header-right">
          <ConnectAccount />
        </div>
      </header>

      {/* ── Content ── */}
      <main className="app-content" key={location.pathname}>
        <PageWrapper>
          <Outlet />
        </PageWrapper>
      </main>

      {/* ── Footer ── */}
      <footer className="app-footer">
        <span className="footer-copy">
          © {new Date().getFullYear()} PayD — Licensed under the{" "}
          <a href="http://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer">
            Apache License 2.0
          </a>
        </span>
        <div className="footer-status">
          <div className="status-dot" />
          STELLAR NETWORK · MAINNET
        </div>
      </footer>
    </div>
  );
};

// ── App ────────────────────────────────────────────────────────────────────────

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/payroll" element={<PayrollScheduler />} />
        <Route path="/employee" element={<EmployeeEntry />} />
        <Route path="/debug" element={<Debugger />} />
        <Route path="/debug/:contractName" element={<Debugger />} />
      </Route>
    </Routes>
  );
}

export default App;