import React from 'react';
import ResponsiveCard from './components/ResponsiveCard.jsx';
import { useIsMobile } from './hooks/useIsMobile.js';
import { useUIStore } from './store/uiStore.js';

function App() {
  const isMobile = useIsMobile();
  const { mobileMenuOpen, toggleMobileMenu, theme } = useUIStore();

  return (
    <div className={`min-h-screen bg-gray-50 text-gray-900 ${theme === 'dark' ? 'dark bg-gray-900 text-gray-100' : ''}`}>
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <span className="font-bold text-lg">PayD</span>
          <button
            onClick={toggleMobileMenu}
            className="sm:hidden p-2 rounded-lg border"
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <nav className="hidden sm:flex gap-6 text-sm">
            <a href="#">Home</a>
            <a href="#">Payments</a>
            <a href="#">Settings</a>
          </nav>
        </div>
        {mobileMenuOpen && isMobile && (
          <div className="sm:hidden border-t bg-white px-4 py-3 space-y-2">
            <a className="block" href="#">Home</a>
            <a className="block" href="#">Payments</a>
            <a className="block" href="#">Settings</a>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <ResponsiveCard title="Welcome to PayD">
          <p className="mb-4">Advanced UI with React 19, Zustand state management, and mobile-first responsiveness.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border p-4">Card 1</div>
            <div className="rounded-xl border p-4">Card 2</div>
            <div className="rounded-xl border p-4">Card 3</div>
          </div>
        </ResponsiveCard>
      </main>
    </div>
  );
}

export default App;
