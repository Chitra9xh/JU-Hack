import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import TryOnView from '../features/tryon/ui/TryOnView';
import ArView from '../features/ar/ui/ArView';
import './shell.css';

function Home() {
  return (
    <main className="shell-home">
      <p className="shell-eyebrow">JU-Hack · Virtual experiences</p>
      <h1>Try something new.<br />See it in your world.</h1>
      <p className="shell-description">
        Explore glasses on your face or preview furniture in your room.
      </p>

      <div className="shell-options">
        <Link className="shell-card" to="/tryon">
          <span className="shell-card-label">01 · Virtual Try-On</span>
          <h2>Find your frame</h2>
          <p>Try glasses using your camera.</p>
          <span className="shell-card-action">Open Try-On →</span>
        </Link>

        <Link className="shell-card" to="/ar">
          <span className="shell-card-label">02 · AR Placement</span>
          <h2>Make room for ideas</h2>
          <p>Preview furniture and decor in your space.</p>
          <span className="shell-card-action">Open AR Placement →</span>
        </Link>
      </div>

      <p className="shell-note">
        Try-On supports laptop webcams and Android Chrome.
        AR Placement requires an ARCore-compatible Android phone.
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
          <Link className="shell-home-link" to="/">Home</Link>
        </header>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tryon" element={<TryOnView />} />
          <Route path="/ar" element={<ArView />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
