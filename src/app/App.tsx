import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import './shell.css';
const HomeView = lazy(() => import('../features/home/HomeView'));
const TryOnView = lazy(() => import('../features/tryon/ui/TryOnView'));
const ArView = lazy(() => import('../features/ar/ui/ArView'));
function Navigation() {
  const [open, setOpen] = useState(false);
  return <>
    <div className="shell-announcement">A new perspective on the things you love. <Link to="/tryon">Experience virtual try-on <span aria-hidden="true">↗</span></Link></div>
    <header className="shell-header">
      <Link className="shell-brand" to="/" aria-label="Slow and Curious home" onClick={() => setOpen(false)}><span className="shell-brand-symbol" aria-hidden="true">s.</span><span>Slow and Curious<small className="shell-team-credit">Chitransh Gupta - Aryan Anand - Krishiv Purohit - Reeti Keshari</small></span></Link>
      <button className="shell-menu-toggle" type="button" aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(!open)}>{open ? 'Close ×' : 'Menu ☰'}</button>
      <nav id="main-navigation" className={'shell-nav ' + (open ? 'is-open' : '')} aria-label="Main navigation">
        {[['/', 'Discover'], ['/tryon', 'Eyewear & Try-On'], ['/ar', 'Furniture & AR']].map(([to,label]) => <NavLink key={to} to={to} end={to === '/'} className={({isActive}) => 'shell-nav-link ' + (isActive ? 'active' : '')} onClick={() => setOpen(false)}>{label}</NavLink>)}
      </nav>
      <Link className="shell-header-cta" to="/tryon">Find your frame <span aria-hidden="true">↗</span></Link>
    </header>
  </>;
}
function PageLoader() { return <div className="shell-loader-container" role="status"><div className="shell-loader-spinner" /><p>Preparing your experience…</p></div>; }
function NotFound() { return <main className="shell-not-found"><span className="shell-eyebrow">A little off the beaten path</span><h1>Let’s find your way back.</h1><p>This page could not be found.</p><Link className="reality-btn-primary" to="/">Back to discover →</Link></main>; }
export default function App() { return <BrowserRouter><div className="shell"><a className="shell-skip" href="#main-content">Skip to content</a><Navigation /><div id="main-content" tabIndex={-1}><Suspense fallback={<PageLoader />}><Routes><Route path="/" element={<HomeView />} /><Route path="/tryon" element={<TryOnView />} /><Route path="/ar" element={<ArView />} /><Route path="*" element={<NotFound />} /></Routes></Suspense></div><footer className="shell-footer"><Link className="shell-footer-brand" to="/">Slow and Curious <span>Chitransh Gupta - Aryan Anand - Krishiv Purohit - Reeti Keshari</span></Link><p>Discover a different way to see.</p><nav aria-label="Footer"><Link to="/tryon">Virtual Try-On ↗</Link><Link to="/ar">Room AR ↗</Link></nav><small>Made for a new perspective. Powered by your browser.</small></footer></div></BrowserRouter>; }
