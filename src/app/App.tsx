import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import './shell.css';

const TryOnView = lazy(() => import('../features/tryon/ui/TryOnView'));
const ArView = lazy(() => import('../features/ar/ui/ArView'));

function PageLoader() {
  return (
    <div className="shell-loader-container">
      <div className="shell-loader-spinner" />
      <p>Loading 3D experience...</p>
    </div>
  );
}

function Home() {
  return (
    <main className="shell-home">
      <p className="shell-eyebrow">JU-Hack · Virtual experiences</p>
      <h1>Try something new.<br />See it in your world.</h1>
      <p className="shell-description">
        Explore glasses on your face or preview furniture in your room with real-time spatial computing.
      </p>

      <div className="shell-options">
        <Link className="shell-card" to="/tryon">
          <span className="shell-card-label">01 · Virtual Try-On</span>
          <h2>Find your frame</h2>
          <p>Try 5 realistic glasses styles live using your camera and face tracking.</p>
          <span className="shell-card-action">Open Try-On →</span>
        </Link>

        <Link className="shell-card" to="/ar">
          <span className="shell-card-label">02 · AR Placement</span>
          <h2>Make room for ideas</h2>
          <p>Inspect 3D furniture models or place them at true 1:1 scale in your living space.</p>
          <span className="shell-card-action">Open AR Placement →</span>
        </Link>
      </div>

      <p className="shell-note">
        💡 Virtual Try-On works seamlessly on laptop webcams and phone browsers.
        AR Placement includes an interactive 3D studio on all devices, plus immersive WebXR AR on compatible Android devices.
      </p>
    </main>
  );
}

function NotFound() {
  return (
    <main className="shell-home">
      <h1>Page not found</h1>
      <Link className="shell-home-link" to="/">Return home →</Link>
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
            <Route path="/" element={<Home />} />
            <Route path="/tryon" element={<TryOnView />} />
            <Route path="/ar" element={<ArView />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}
