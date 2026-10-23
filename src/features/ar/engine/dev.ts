import { createArEngine } from './index';

const host = document.getElementById('ar-host') as HTMLElement;
const overlay = document.getElementById('overlay') as HTMLElement;
const startButton = document.getElementById('start') as HTMLButtonElement;
const stopButton = document.getElementById('stop') as HTMLButtonElement;
const status = document.getElementById('status') as HTMLSpanElement;

const engine = createArEngine();

async function start(): Promise<void> {
  startButton.disabled = true;
  status.textContent = 'Checking support...';

  try {
    if (!await engine.isSupported()) {
      status.textContent = 'WebXR immersive-ar is unavailable';
      startButton.disabled = false;
      return;
    }

    await engine.start(host, overlay);
    status.textContent = 'AR active - tap to place';
    stopButton.disabled = false;
  } catch (error) {
    console.error(error);
    status.textContent = error instanceof Error ? error.message : 'Could not start AR';
    startButton.disabled = false;
  }
}

function stop(): void {
  engine.stop();
  stopButton.disabled = true;
  startButton.disabled = false;
  status.textContent = 'Stopped';
}

startButton.addEventListener('click', () => void start());
stopButton.addEventListener('click', stop);
window.addEventListener('beforeunload', stop);
