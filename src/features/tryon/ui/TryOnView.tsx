import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { loadFrames } from '../../../shared/catalog';
import { createTryOnEngine, type TryOnEngineExtended, type FaceMeasurements } from '../engine';
import type { Frame } from '../../../shared/types';
import './tryon.css';

type AppPhase = 'idle' | 'starting' | 'scanning' | 'analyzing' | 'active';

const FACE_SHAPE_TIPS: Record<FaceMeasurements['shape'], { frames: string; icon: string }> = {
  Oval:    { frames: 'Aviator, Wayfarer, Round', icon: '🥚' },
  Round:   { frames: 'Square, Rectangular, Angular', icon: '⭕' },
  Square:  { frames: 'Round, Oval, Cat-Eye', icon: '⬜' },
  Heart:   { frames: 'Bottom-heavy, Round, Light frames', icon: '♥' },
  Oblong:  { frames: 'Oversized, Wayfarer, Wraparound', icon: '📏' },
};

export default function TryOnView() {
  const [frames, setFrames]               = useState<Frame[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
  const [phase, setPhase]                 = useState<AppPhase>('idle');
  const [errorMessage, setErrorMessage]   = useState<string | null>(null);
  const [faceDetected, setFaceDetected]   = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0); // 0-100
  const [analysis, setAnalysis]           = useState<FaceMeasurements | null>(null);
  const [toastMessage, setToastMessage]   = useState<string | null>(null);

  // Fit controls
  const [fitScale,   setFitScale]   = useState(1.0);
  const [fitOffsetY, setFitOffsetY] = useState(0.0);
  const [fitOffsetZ, setFitOffsetZ] = useState(0.0);

  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<TryOnEngineExtended | null>(null);
  const analysisTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisTickRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load catalog on mount
  useEffect(() => {
    loadFrames()
      .then((data) => {
        setFrames(data);
        if (data.length > 0) setSelectedFrame(data[0]);
      })
      .catch(() => setErrorMessage('Unable to load frames catalog.'));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  // ── Start camera ──────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setPhase('starting');
    setErrorMessage(null);
    setAnalysis(null);
    setAnalysisProgress(0);

    try {
      if (!engineRef.current) {
        engineRef.current = createTryOnEngine();
      }
      const engine = engineRef.current;

      // Keep glasses hidden until analysis completes
      engine.setGlassesVisible?.(false);

      engine.onMetricsUpdate = (data) => {
        setFaceDetected(data.detected);

        // When face is first detected → enter 'scanning' → then 'analyzing'
        if (data.detected) {
          setPhase((prev) => {
            if (prev === 'scanning' || prev === 'starting') {
              // Kick off analysis countdown (2.5 s)
              startAnalysisCountdown();
              return 'analyzing';
            }
            return prev;
          });
        } else {
          setPhase((prev) => (prev === 'analyzing' ? 'analyzing' : prev === 'active' ? 'active' : 'scanning'));
        }
      };

      engine.onFaceAnalyzed = (measurements) => {
        setAnalysis(measurements);
      };

      if (selectedFrame) {
        await engine.setFrame(selectedFrame);
      }

      await engine.start(videoRef.current, canvasRef.current);
      engine.setScaleOffset?.(fitScale);
      engine.setHeightOffset?.(fitOffsetY);
      engine.setDepthOffset?.(fitOffsetZ);

      setPhase('scanning');
    } catch (err: unknown) {
      setPhase('idle');
      const msg = err instanceof Error ? err.message : 'Unknown camera error';
      if (msg.includes('Permission') || msg.includes('NotAllowedError')) {
        setErrorMessage('Camera access denied. Allow camera in browser settings.');
      } else if (msg.includes('NotFound') || msg.includes('DevicesNotFoundError')) {
        setErrorMessage('No camera detected. Attach a webcam.');
      } else {
        setErrorMessage(`Camera error: ${msg}`);
      }
    }
  };

  // ── Analysis countdown (2.5 s) ────────────────────────────────────────────
  const startAnalysisCountdown = useCallback(() => {
    // Guard: only run once
    if (analysisTimerRef.current) return;

    const DURATION = 2500;
    const startTime = Date.now();

    analysisTickRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / DURATION) * 100));
      setAnalysisProgress(pct);
    }, 50);

    analysisTimerRef.current = setTimeout(() => {
      if (analysisTickRef.current) clearInterval(analysisTickRef.current);
      setAnalysisProgress(100);
      // Reveal glasses
      engineRef.current?.setGlassesVisible?.(true);
      setPhase('active');
    }, DURATION);
  }, []);

  // ── Stop camera ───────────────────────────────────────────────────────────
  const handleStop = () => {
    if (analysisTimerRef.current) { clearTimeout(analysisTimerRef.current); analysisTimerRef.current = null; }
    if (analysisTickRef.current)  { clearInterval(analysisTickRef.current); analysisTickRef.current  = null; }
    engineRef.current?.stop();
    setPhase('idle');
    setFaceDetected(false);
    setAnalysisProgress(0);
  };

  useEffect(() => {
    return () => {
      if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
      if (analysisTickRef.current)  clearInterval(analysisTickRef.current);
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, []);

  // ── Frame selection ───────────────────────────────────────────────────────
  const handleSelectFrame = async (frame: Frame) => {
    setSelectedFrame(frame);
    if (engineRef.current) {
      await engineRef.current.setFrame(frame);
      showToast(`Switched to ${frame.name}`);
    }
  };

  // ── Fit adjustments ───────────────────────────────────────────────────────
  const adjustScale = (delta: number) => {
    const next = Math.max(0.70, Math.min(1.40, Math.round((fitScale + delta) * 100) / 100));
    setFitScale(next);
    engineRef.current?.setScaleOffset?.(next);
  };
  const adjustHeight = (delta: number) => {
    const next = Math.max(-0.030, Math.min(0.030, Math.round((fitOffsetY + delta) * 1000) / 1000));
    setFitOffsetY(next);
    engineRef.current?.setHeightOffset?.(next);
  };
  const adjustDepth = (delta: number) => {
    const next = Math.max(-0.020, Math.min(0.020, Math.round((fitOffsetZ + delta) * 1000) / 1000));
    setFitOffsetZ(next);
    engineRef.current?.setDepthOffset?.(next);
  };
  const resetFit = () => {
    setFitScale(1.0); setFitOffsetY(0.0); setFitOffsetZ(0.0);
    engineRef.current?.setScaleOffset?.(1.0);
    engineRef.current?.setHeightOffset?.(0.0);
    engineRef.current?.setDepthOffset?.(0.0);
    showToast('Fit reset to auto');
  };

  // ── Snapshot ──────────────────────────────────────────────────────────────
  const handleSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas3D = canvasRef.current;
    const snap = document.createElement('canvas');
    snap.width = video.videoWidth || 1280;
    snap.height = video.videoHeight || 720;
    const ctx = snap.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.translate(snap.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, snap.width, snap.height);
    ctx.drawImage(canvas3D, 0, 0, snap.width, snap.height);
    ctx.restore();
    const a = document.createElement('a');
    a.download = `tryon-${selectedFrame?.id || 'glasses'}.png`;
    a.href = snap.toDataURL('image/png');
    a.click();
    showToast('📸 Snapshot saved!');
  };

  const isStreaming = phase !== 'idle' && phase !== 'starting';

  return (
    <div className="tryon-container">
      {/* Top Bar */}
      <div className="tryon-top-bar">
        <div className="tryon-title-group">
          <Link to="/" className="tryon-nav-back">← Reality Lab Home</Link>
          <h1>Virtual Try-On</h1>
        </div>

        <div className="tryon-status-badge">
          <span className={`tryon-status-dot ${
            phase === 'active' ? 'active' :
            phase === 'analyzing' ? 'waiting' :
            phase === 'scanning' ? 'waiting' : ''
          }`} />
          <span>
            {phase === 'idle'      ? 'Camera Off' :
             phase === 'starting'  ? 'Starting...' :
             phase === 'scanning'  ? 'Scanning Face' :
             phase === 'analyzing' ? 'Analysing...' :
                                     'Try-On Active'}
          </span>
        </div>
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="tryon-error-banner" role="alert">
          <div><strong>Notice:</strong> {errorMessage}</div>
          <button className="btn-secondary-action" onClick={handleStart} style={{ padding: '6px 14px', fontSize: '12px' }}>Retry</button>
        </div>
      )}

      {/* ── Camera Stage ─────────────────────────────────────────────────── */}
      <div className="tryon-stage-card">
        <video ref={videoRef} className="tryon-video-feed" playsInline autoPlay muted />
        <canvas ref={canvasRef} className="tryon-tracking-canvas" />

        {/* ── PHASE: idle / starting ── */}
        {(phase === 'idle' || phase === 'starting') && (
          <div className="tryon-standby-overlay">
            <div className="tryon-standby-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </div>
            <h2>AI Face Analysis + Try-On</h2>
            <p>The camera scans your face geometry, classifies your face shape, then places glasses that match your features in real time.</p>
            <button className="btn-primary-action" onClick={handleStart} disabled={phase === 'starting'}>
              {phase === 'starting' ? 'Starting Camera...' : '▶ Start Camera'}
            </button>
          </div>
        )}

        {/* ── PHASE: scanning (face not yet in frame) ── */}
        {phase === 'scanning' && (
          <div className="tryon-scan-overlay">
            <div className="tryon-scan-frame">
              <span className="scan-corner tl" /><span className="scan-corner tr" />
              <span className="scan-corner bl" /><span className="scan-corner br" />
              <div className="scan-line" />
            </div>
            <div className="tryon-scan-label">
              <span className="scan-dot-anim">●</span>
              Position your face in the frame
            </div>
          </div>
        )}

        {/* ── PHASE: analyzing ── */}
        {phase === 'analyzing' && (
          <div className="tryon-analysis-overlay">
            <div className="tryon-analysis-frame">
              <span className="scan-corner tl active" /><span className="scan-corner tr active" />
              <span className="scan-corner bl active" /><span className="scan-corner br active" />
              <div className="analysis-scan-line" />
              {/* Landmark grid visualisation dots */}
              <div className="landmark-dots">
                {Array.from({ length: 18 }).map((_, i) => (
                  <span key={i} className="landmark-dot" style={{
                    left: `${15 + Math.random() * 70}%`,
                    top:  `${10 + Math.random() * 80}%`,
                    animationDelay: `${i * 0.08}s`,
                  }} />
                ))}
              </div>
            </div>

            <div className="tryon-analysis-hud">
              <div className="analysis-title">Analysing Face Geometry</div>
              <div className="analysis-metrics">
                <span>Facial landmarks: <strong>478</strong></span>
                <span>Depth: <strong>3D metric</strong></span>
                <span>Frames: <strong>{Math.round(analysisProgress * 0.3)}/30</strong></span>
              </div>
              <div className="analysis-progress-bar">
                <div className="analysis-progress-fill" style={{ width: `${analysisProgress}%` }} />
              </div>
              <div className="analysis-progress-label">{analysisProgress < 100 ? 'Computing face shape...' : 'Complete!'}</div>
            </div>
          </div>
        )}

        {/* ── PHASE: active HUD ── */}
        {phase === 'active' && (
          <div className="tryon-hud">
            <div className="tryon-telemetry-pill">
              <div className="tryon-telemetry-item">
                {faceDetected ? '🟢 Tracking' : '🟡 Searching'}
              </div>
              {analysis && (
                <div className="tryon-telemetry-item">
                  {FACE_SHAPE_TIPS[analysis.shape].icon} <strong>{analysis.shape}</strong>
                </div>
              )}
            </div>
            {selectedFrame && <div className="tryon-active-badge">{selectedFrame.name}</div>}
          </div>
        )}

        {/* ── Active stage buttons ── */}
        {phase === 'active' && (
          <div className="tryon-stage-actions">
            <button className="btn-secondary-action" onClick={handleSnapshot} title="Save snapshot">📸 Snap</button>
            <button className="btn-danger-action" onClick={handleStop} title="Stop camera">⏹ Stop</button>
          </div>
        )}
      </div>

      {/* ── Analysis Result Card (shows after active) ────────────────────── */}
      {phase === 'active' && analysis && (
        <div className="tryon-analysis-result-card">
          <div className="analysis-result-icon">{FACE_SHAPE_TIPS[analysis.shape].icon}</div>
          <div className="analysis-result-body">
            <div className="analysis-result-shape">{analysis.shape} Face</div>
            <div className="analysis-result-dims">
              Width {analysis.widthCm} cm · Height {analysis.heightCm} cm · Jaw {analysis.jawCm} cm
            </div>
            <div className="analysis-result-tip">
              ✓ Best frames: <strong>{FACE_SHAPE_TIPS[analysis.shape].frames}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ── Fit Panel (active only) ──────────────────────────────────────── */}
      {phase === 'active' && (
        <div className="tryon-fit-panel">
          <div className="tryon-fit-panel-title">
            <span className="tryon-fit-panel-icon">⚙</span>
            Fit Adjustment
          </div>
          <div className="tryon-fit-controls">
            <div className="tryon-fit-row">
              <span className="tryon-fit-label">Size</span>
              <div className="tryon-fit-stepper">
                <button className="tryon-fit-btn" onClick={() => adjustScale(-0.05)} aria-label="Smaller">−</button>
                <span className="tryon-fit-value">{Math.round(fitScale * 100)}%</span>
                <button className="tryon-fit-btn" onClick={() => adjustScale(0.05)} aria-label="Larger">+</button>
              </div>
            </div>
            <div className="tryon-fit-row">
              <span className="tryon-fit-label">Bridge</span>
              <div className="tryon-fit-stepper">
                <button className="tryon-fit-btn" onClick={() => adjustHeight(-0.003)} aria-label="Lower">↓</button>
                <span className="tryon-fit-value">{fitOffsetY >= 0 ? '+' : ''}{Math.round(fitOffsetY * 1000)} mm</span>
                <button className="tryon-fit-btn" onClick={() => adjustHeight(0.003)} aria-label="Higher">↑</button>
              </div>
            </div>
            <div className="tryon-fit-row">
              <span className="tryon-fit-label">Depth</span>
              <div className="tryon-fit-stepper">
                <button className="tryon-fit-btn" onClick={() => adjustDepth(-0.003)} aria-label="Back">←</button>
                <span className="tryon-fit-value">{fitOffsetZ >= 0 ? '+' : ''}{Math.round(fitOffsetZ * 1000)} mm</span>
                <button className="tryon-fit-btn" onClick={() => adjustDepth(0.003)} aria-label="Forward">→</button>
              </div>
            </div>
            <button className="tryon-fit-reset" onClick={resetFit}>↺ Reset</button>
          </div>
        </div>
      )}

      {/* ── Frame Catalog ─────────────────────────────────────────────────── */}
      <section className="tryon-catalog-section" aria-label="Frames catalog">
        <div className="tryon-catalog-header">
          <div>
            <h3>Frame Collection</h3>
            <span>5 styles · click to switch while live</span>
          </div>
          {selectedFrame && <span style={{ color: 'var(--teal)', fontWeight: 600 }}>Current: {selectedFrame.name}</span>}
        </div>
        <div className="tryon-frames-grid">
          {frames.map((frame) => {
            const isSelected = selectedFrame?.id === frame.id;
            return (
              <div
                key={frame.id}
                className={`tryon-frame-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelectFrame(frame)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectFrame(frame); }}
                aria-pressed={isSelected}
              >
                {isSelected && <div className="tryon-selected-indicator">✓</div>}
                <div className="tryon-frame-thumb-box">
                  <img src={frame.thumb} alt={frame.name} loading="lazy" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                </div>
                <div className="tryon-frame-name">{frame.name}</div>
                <div className="tryon-frame-id">{frame.id}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Toast */}
      {toastMessage && <div className="tryon-flash-toast">{toastMessage}</div>}
    </div>
  );
}
