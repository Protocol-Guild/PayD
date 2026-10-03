import React from 'react';
import { useResponsive } from '../hooks/useResponsive';
import { useSelector, useDispatch } from 'react-redux';
import { toggleSidebar } from '../store/slices/uiSlice';

const Layout = ({ children }) => {
  const { isMobile } = useResponsive();
  const dispatch = useDispatch();
  const { sidebarOpen } = useSelector(state => state.ui);

  const handleSidebarToggle = () => {
    dispatch(toggleSidebar());
  };

  return (
    <div className={`layout ${isMobile ? 'mobile' : 'desktop'}`}>
      <header className="header">
        <button onClick={handleSidebarToggle} className="menu-toggle">
          ☰
        </button>
        <div className="logo">PayD</div>
      </header>
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <nav>
          {/* Navigation links */}
          <ul>
            <li><a href="/dashboard">Dashboard</a></li>
            <li><a href="/payments">Payments</a></li>
            <li><a href="/settings">Settings</a></li>
          </ul>
        </nav>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
