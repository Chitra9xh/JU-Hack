import { createTryOnEngine, type TryOnEngineExtended } from './index';

const videoEl = document.getElementById('webcam-video') as HTMLVideoElement | null;
const canvasEl = document.getElementById('tracking-canvas') as HTMLCanvasElement | null;
const btnStart = document.getElementById('btn-start') as HTMLButtonElement | null;
const btnStop = document.getElementById('btn-stop') as HTMLButtonElement | null;
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const placeholderOverlay = document.getElementById('placeholder-overlay');

const valTracking = document.getElementById('val-tracking');
const valRotation = document.getElementById('val-rotation');
const valDistance = document.getElementById('val-distance');

let engine: TryOnEngineExtended | null = null;

function setStatus(text: string, state: 'off' | 'waiting' | 'active' | 'error') {
  if (statusText) statusText.textContent = text;
  if (statusDot) {
    statusDot.className = 'status-dot';
    if (state === 'active') statusDot.classList.add('active');
    else if (state === 'waiting') statusDot.classList.add('waiting');
    else if (state === 'error') statusDot.classList.add('error');
  }
}

async function handleStart() {
  if (!videoEl || !canvasEl || !btnStart || !btnStop) return;

  btnStart.disabled = true;
  setStatus('Starting camera & model...', 'waiting');

  try {
    if (!engine) {
      engine = createTryOnEngine();
    }

    engine.onMetricsUpdate = (metrics) => {
      if (metrics.detected) {
        if (valTracking) valTracking.textContent = 'Face Tracked';
        if (valRotation) {
          const yaw = Math.round(metrics.yaw ?? 0);
          const pitch = Math.round(metrics.pitch ?? 0);
          const roll = Math.round(metrics.roll ?? 0);
          valRotation.textContent = `${yaw}° / ${pitch}° / ${roll}°`;
        }
        if (valDistance) {
          const distCm = Math.round((metrics.distance ?? 0) * 100);
          valDistance.textContent = `${distCm} cm`;
        }
      } else {
        if (valTracking) valTracking.textContent = 'Searching...';
      }
    };

    await engine.start(videoEl, canvasEl);

    setStatus('Live & Tracking', 'active');
    btnStop.disabled = false;
    if (placeholderOverlay) {
      placeholderOverlay.classList.add('hidden');
    }
  } catch (err) {
    console.error('Try-On engine start failed:', err);
    setStatus(`Error: ${(err as Error).message}`, 'error');
    btnStart.disabled = false;
  }
}

function handleStop() {
  if (!btnStart || !btnStop) return;

  if (engine) {
    engine.stop();
  }

  btnStart.disabled = false;
  btnStop.disabled = true;
  setStatus('Engine Stopped', 'off');

  if (placeholderOverlay) {
    placeholderOverlay.classList.remove('hidden');
  }
  if (valTracking) valTracking.textContent = 'No Face';
  if (valRotation) valRotation.textContent = '0° / 0° / 0°';
  if (valDistance) valDistance.textContent = '—';
}

if (btnStart) btnStart.addEventListener('click', handleStart);
if (btnStop) btnStop.addEventListener('click', handleStop);

window.addEventListener('beforeunload', () => {
  if (engine) {
    engine.stop();
  }
});
