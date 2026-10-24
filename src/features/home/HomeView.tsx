import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './home.css';
import Collections from './Collections';

type ShowcaseModel = 'glasses' | 'chair';

export default function HomeView() {
  const [activeModel, setActiveModel] = useState<ShowcaseModel>('glasses');
  const [isRotating, setIsRotating] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [isLoadingModel, setIsLoadingModel] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const pointerStateRef = useRef<{
    isDragging: boolean;
    prevX: number;
    prevY: number;
    velX: number;
    velY: number;
  }>({
    isDragging: false,
    prevX: 0,
    prevY: 0,
    velX: 0,
    velY: 0,
  });

  const modelCacheRef = useRef<Map<ShowcaseModel, THREE.Group>>(new Map());

  // 1. Initialize Clean 3D Turntable Scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.clientWidth || 440;
    const height = canvas.clientHeight || 340;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(0, 0.35, 2.1);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    // Clean neutral studio lighting
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0x1e241f, 1.4);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(2, 3, 2);
    const rimLight = new THREE.DirectionalLight(0xd5fa9c, 0.8);
    rimLight.position.set(-2, 1, -1.5);
    scene.add(ambientLight, keyLight, rimLight);

    // Root group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);
    modelGroupRef.current = rootGroup;

    // Subtle ground grid circle
    const gridCircle = new THREE.PolarGridHelper(0.9, 16, 8, 32, 0x3c493a, 0x222b22);
    gridCircle.position.y = -0.32;
    scene.add(gridCircle);

    let running = true;
    const render = () => {
      if (!running) return;

      const pState = pointerStateRef.current;
      if (!pState.isDragging) {
        if (isRotating) {
          rootGroup.rotation.y += 0.007;
        } else {
          rootGroup.rotation.y += pState.velX;
          rootGroup.rotation.x += pState.velY;
          pState.velX *= 0.92;
          pState.velY *= 0.92;
        }
      }

      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(render);
    };
    render();

    const handleResize = () => {
      if (!canvas || !renderer || !camera) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      running = false;
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      scene.clear();
    };
  }, [isRotating]);

  // 2. Load model
  useEffect(() => {
    const root = modelGroupRef.current;
    if (!root) return;

    while (root.children.length > 0) {
      root.remove(root.children[0]);
    }

    const cached = modelCacheRef.current.get(activeModel);
    if (cached) {
      root.add(cached.clone());
      return;
    }

    setIsLoadingModel(true);
    const loader = new GLTFLoader();
    const url = activeModel === 'glasses'
      ? '/assets/frames/frame-01.glb'
      : '/assets/furniture/item-01.glb';

    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        const bbox = new THREE.Box3().setFromObject(model);
        const size = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const targetScale = activeModel === 'glasses' ? 0.95 / maxDim : 0.85 / maxDim;

        model.scale.setScalar(targetScale);
        model.position.x = -center.x * targetScale;
        model.position.y = -center.y * targetScale;
        model.position.z = -center.z * targetScale;

        const group = new THREE.Group();
        group.add(model);
        modelCacheRef.current.set(activeModel, group);

        if (modelGroupRef.current) {
          modelGroupRef.current.add(group.clone());
        }
        setIsLoadingModel(false);
      },
      undefined,
      (err) => {
        console.warn('Failed to load preview GLB:', url, err);
        const geom = activeModel === 'glasses'
          ? new THREE.TorusGeometry(0.35, 0.08, 16, 50)
          : new THREE.BoxGeometry(0.5, 0.45, 0.5);
        const mat = new THREE.MeshStandardMaterial({
          color: 0xd5fa9c,
          roughness: 0.35,
        });
        const fallback = new THREE.Mesh(geom, mat);
        const group = new THREE.Group();
        group.add(fallback);
        modelCacheRef.current.set(activeModel, group);
        if (modelGroupRef.current) modelGroupRef.current.add(group.clone());
        setIsLoadingModel(false);
      }
    );
  }, [activeModel]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerStateRef.current.isDragging = true;
    pointerStateRef.current.prevX = e.clientX;
    pointerStateRef.current.prevY = e.clientY;
    pointerStateRef.current.velX = 0;
    pointerStateRef.current.velY = 0;
    setIsRotating(false);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pState = pointerStateRef.current;
    if (!pState.isDragging || !modelGroupRef.current) return;

    const dx = e.clientX - pState.prevX;
    const dy = e.clientY - pState.prevY;

    modelGroupRef.current.rotation.y += dx * 0.012;
    modelGroupRef.current.rotation.x = Math.max(
      -0.5,
      Math.min(0.5, modelGroupRef.current.rotation.x + dy * 0.008)
    );

    pState.velX = dx * 0.005;
    pState.velY = dy * 0.003;
    pState.prevX = e.clientX;
    pState.prevY = e.clientY;
  };

  const handlePointerUp = () => {
    pointerStateRef.current.isDragging = false;
  };

  return (
    <main className="reality-home">
      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="reality-hero-section">
        <div className="reality-hero-content">
          <span className="reality-section-tag">A NEW WAY TO DISCOVER</span>

          <h1 className="reality-hero-title">
            See yourself.<br />
            <em>See the possibilities.</em>
          </h1>

          <p className="reality-hero-desc">
            Frames that feel like you. Pieces that feel like home. Explore them in your world, before you decide.
          </p>

          <div className="reality-hero-ctas">
            <Link to="/tryon" className="reality-btn-primary">
              Find your frame ↗
            </Link>
            <Link to="/ar" className="reality-btn-secondary">
              Explore your space ↗
            </Link>
          </div>

          <div className="reality-tech-note">
            <span>YOUR CAMERA. YOUR WORLD. NO APP NEEDED.</span>
          </div>
        </div>

        {/* ── 3D MODEL PREVIEW ──────────────────────────────────────────────── */}
        <div className="reality-showcase-container">
          <div className="reality-showcase-card">
            <div className="reality-showcase-header">
              <span className="showcase-label">THE INTERACTIVE EDIT</span>
              <div className="reality-showcase-tabs" role="tablist">
                <button
                  className={`showcase-tab ${activeModel === 'glasses' ? 'active' : ''}`}
                  onClick={() => setActiveModel('glasses')}
                >
                  Glasses
                </button>
                <button
                  className={`showcase-tab ${activeModel === 'chair' ? 'active' : ''}`}
                  onClick={() => setActiveModel('chair')}
                >
                  Furniture
                </button>
              </div>
            </div>

            <div className="reality-canvas-viewport">
              <canvas
                ref={canvasRef}
                className="reality-canvas-3d"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                title="Drag to rotate"
              />

              {isLoadingModel && (
                <div className="reality-canvas-loader">
                  <div className="reality-mini-spinner" />
                  <span>Loading model...</span>
                </div>
              )}

              <div className="reality-canvas-hint">
                <span>Drag to rotate</span>
                <button
                  className="reality-rotate-toggle"
                  onClick={() => setIsRotating(!isRotating)}
                >
                  {isRotating ? 'Pause' : 'Auto-spin'}
                </button>
              </div>
            </div>

            <div className="reality-showcase-footer">
              <div className="showcase-info">
                <strong>{activeModel === 'glasses' ? 'Pilot Sunglasses' : 'Mango Velvet Chair'}</strong>
                <span>{activeModel === 'glasses' ? 'Frame width: 14.0 cm' : 'Dimensions: 0.83m × 0.69m'}</span>
              </div>
              <Link
                to={activeModel === 'glasses' ? '/tryon' : '/ar'}
                className="showcase-quick-link"
              >
                Open in {activeModel === 'glasses' ? 'Try-On' : 'AR'} →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Collections />
      {/* ── EXPERIENCES GRID ─────────────────────────────────────────────────── */}
      <section className="reality-experiences-section" aria-label="Available experiences"><div className="edit-section-heading"><div><span className="shell-eyebrow">BEYOND THE SCREEN</span><h2>A little closer to real.</h2></div><p>Two ways to make it yours.<br />One seamless browser experience.</p></div>
        <div className="reality-cards-grid">
          {/* Card 1: Virtual Try-On */}
          <Link to="/tryon" className="reality-exp-card">
            <div className="exp-card-header">
              <span className="exp-card-badge">01 / MADE FOR YOUR FACE</span>
              <h3>Your next look, live.</h3>
            </div>

            <div className="exp-card-visual">
              <img
                src="/assets/thumbs/frame-01.png"
                alt="Glasses Try-On"
                className="exp-visual-img"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            <p className="exp-card-text">
              Real-time face tracking with automatic face shape detection (Oval, Round, Square, Heart, Oblong) and adaptive temple auto-scaling across 5 glasses frames.
            </p>

            <ul className="exp-card-list">
              <li>Facial geometry & pupil distance measurement</li>
              <li>Nose bridge anchoring & fine-tune fit controls</li>
              <li>Adaptive portrait auto-scaling for mobile cameras</li>
            </ul>

            <span className="exp-card-cta">Start Try-On →</span>
          </Link>

          {/* Card 2: AR Placement */}
          <Link to="/ar" className="reality-exp-card">
            <div className="exp-card-header">
              <span className="exp-card-badge">02 / MADE FOR YOUR SPACE</span>
              <h3>Bring your space to life.</h3>
            </div>

            <div className="exp-card-visual">
              <img
                src="/assets/thumbs/item-01.png"
                alt="Furniture Placement"
                className="exp-visual-img"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            <p className="exp-card-text">
              Inspect furniture models in the 3D studio, or place them in your physical room at 1:1 scale using your phone camera with multi-touch gestures.
            </p>

            <ul className="exp-card-list">
              <li>1.75m human silhouette for scale comparison</li>
              <li>Floor plane raycasting & touch gestures (pan, pinch, twist)</li>
              <li>Elevation controls, upholstery colors, and snapshot photos</li>
            </ul>

            <span className="exp-card-cta">Open AR Placement →</span>
          </Link>
        </div>
      </section>

    </main>
  );
}
