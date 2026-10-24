import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import './shell.css';

const HomeView = lazy(() => import('../features/home/HomeView'));
const TryOnView = lazy(() => import('../features/tryon/ui/TryOnView'));
const ArView = lazy(() => import('../features/ar/ui/ArView'));

function PageLoader() {
  return (
    <div className="shell-loader-container">
      <div className="shell-loader-spinner" />
      <p>Initializing Spatial Experience...</p>
    </div>
  );
}

function NotFound() {
  return (
    <main className="reality-home" style={{ textAlign: 'center', padding: '100px 20px' }}>
      <h1 style={{ fontSize: '3rem', margin: '0 0 16px' }}>404 · Page Not Found</h1>
      <p style={{ color: '#94a3b8', marginBottom: '24px' }}>The spatial coordinate you requested does not exist.</p>
      <Link className="reality-btn-primary" to="/" style={{ display: 'inline-flex' }}>Return to Reality Lab →</Link>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="shell">
        <header className="shell-header">
          <Link className="shell-brand" to="/" aria-label="JU-Hack home">
            JU-Hack<span> / Reality Lab</span>
          </Link>
          <nav className="shell-nav" aria-label="Main Navigation">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `shell-nav-link ${isActive ? 'active' : ''}`}
            >
              Home
            </NavLink>
            <NavLink
              to="/tryon"
              className={({ isActive }) => `shell-nav-link ${isActive ? 'active' : ''}`}
            >
              Try-On
            </NavLink>
            <NavLink
              to="/ar"
              className={({ isActive }) => `shell-nav-link ${isActive ? 'active' : ''}`}
            >
              AR Studio
            </NavLink>
          </nav>
        </header>

        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/tryon" element={<TryOnView />} />
            <Route path="/ar" element={<ArView />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}
