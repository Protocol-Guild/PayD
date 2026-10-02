import { ThemeProvider } from './context/ThemeContext';
import ThemeToggle from './components/ThemeToggle';

function App() {
  return (
    <ThemeProvider>
      <div className="app">
        <header className="app-header">
          <h1>PayD</h1>
          <ThemeToggle />
        </header>
        <main className="app-main">
          {/* Existing app content */}
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
