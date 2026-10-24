import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadFurniture } from '../../../shared/catalog';
import { createArEngine, type ArEngineExtended } from '../engine';
import type { Furniture } from '../../../shared/types';
import {
  createHumanSilhouette,
  createDimensionBox,
  UPHOLSTERY_FINISHES,
  applyUpholsteryColor,
} from './arHelpers';
import './ar.css';

type ViewMode = 'studio' | 'camera-ar';
type LightingPreset = 'neutral' | 'warm' | 'daylight';

interface PlacedRoomItem {
  id: string;
  item: Furniture;
  object: THREE.Group;
  rotationY: number;
  scale: number;
  elevation: number;
}

export default function ArView() {
  const [items, setItems] = useState<Furniture[]>([]);
  const [selectedItem, setSelectedItem] = useState<Furniture | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'furniture' | 'decor'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('studio');

  // Studio visual features
  const [isAutoRotate, setIsAutoRotate] = useState(true);
  const [showHumanScale, setShowHumanScale] = useState(false);
  const [showDimensions, setShowDimensions] = useState(false);
  const [activeFinish, setActiveFinish] = useState<string>('original');
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('neutral');

  // Camera Room AR state
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [roomScanPhase, setRoomScanPhase] = useState<'scanning' | 'locked'>('scanning');
  const [placedItems, setPlacedItems] = useState<PlacedRoomItem[]>([]);
  const [selectedPlacedId, setSelectedPlacedId] = useState<string | null>(null);

  // WebXR support state
  const [isArSupported, setIsArSupported] = useState<boolean | null>(null);
  const [isWebXrActive, setIsWebXrActive] = useState(false);

  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 3D Studio Refs
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const studioSceneRef = useRef<THREE.Scene | null>(null);
  const studioRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const studioControlsRef = useRef<OrbitControls | null>(null);
  const currentModelGroupRef = useRef<THREE.Group | null>(null);
  const humanSilhouetteRef = useRef<THREE.Group | null>(null);
  const dimensionBoxRef = useRef<THREE.Group | null>(null);
  const studioAnimFrameRef = useRef<number | null>(null);

  // Camera Room AR Refs
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraSceneRef = useRef<THREE.Scene | null>(null);
  const cameraRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraReticleRef = useRef<THREE.Mesh | null>(null);
  const cameraFloorPlaneRef = useRef<THREE.Mesh | null>(null);
  const cameraRaycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const cameraPointerRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const cameraAnimFrameRef = useRef<number | null>(null);

  // Native WebXR AR Engine Refs
  const arEngineRef = useRef<ArEngineExtended | null>(null);
  const arHostRef = useRef<HTMLDivElement | null>(null);
  const arOverlayRef = useRef<HTMLDivElement | null>(null);

  // Shared GLTF cache
  const gltfCacheRef = useRef<Map<string, THREE.Group>>(new Map());

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  // 1. Initial Load: Catalog & WebXR Check
  useEffect(() => {
    let mounted = true;
    const engine = createArEngine();
    arEngineRef.current = engine;

    engine.isSupported()
      .then((supported) => {
        if (mounted) setIsArSupported(supported);
      })
      .catch(() => {
        if (mounted) setIsArSupported(false);
      });

    loadFurniture()
      .then((data) => {
        if (!mounted) return;
        setItems(data);
        if (data.length > 0) setSelectedItem(data[0]);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('Failed to load furniture catalog:', err);
        setErrorMessage('Failed to load furniture items.');
      });

    return () => {
      mounted = false;
      stopCameraRoomAr();
    };
  }, []);

  // 2. Setup 3D Studio Scene
  useEffect(() => {
    if (viewMode !== 'studio') return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    studioSceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.05, 50);
    camera.position.set(1.6, 1.2, 2.0);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    studioRendererRef.current = renderer;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.05;
    controls.minDistance = 0.4;
    controls.maxDistance = 6.0;
    studioControlsRef.current = controls;

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, lightingPreset === 'warm' ? 1.0 : 1.3);
    ambientLight.name = 'ambient';

    const keyLight = new THREE.DirectionalLight(
      lightingPreset === 'warm' ? 0xffe8d6 : 0xfff8ee,
      lightingPreset === 'daylight' ? 2.2 : 1.8
    );
    keyLight.name = 'keyLight';
    keyLight.position.set(3, 4, 2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0001;

    const fillLight = new THREE.DirectionalLight(
      lightingPreset === 'warm' ? 0xfec89a : 0xbad7f2,
      0.8
    );
    fillLight.name = 'fillLight';
    fillLight.position.set(-3, 2, -2);

    scene.add(ambientLight, keyLight, fillLight);

    // Studio Pedestal / Ground
    const groundGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.02, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x18201a,
      roughness: 0.8,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(3.2, 16, 0x3c493a, 0x273429);
    grid.position.y = 0.001;
    scene.add(grid);

    const handleResize = () => {
      if (!canvas || !renderer) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);

    let running = true;
    const animate = () => {
      if (!running) return;
      controls.update();

      if (isAutoRotate && currentModelGroupRef.current) {
        currentModelGroupRef.current.rotation.y += 0.005;
      }

      renderer.render(scene, camera);
      studioAnimFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      running = false;
      if (studioAnimFrameRef.current !== null) cancelAnimationFrame(studioAnimFrameRef.current);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.clear();
      studioSceneRef.current = null;
      studioRendererRef.current = null;
      studioControlsRef.current = null;
      currentModelGroupRef.current = null;
      humanSilhouetteRef.current = null;
      dimensionBoxRef.current = null;
    };
  }, [viewMode, isAutoRotate, lightingPreset]);

  // 3. Load or Update 3D Model in Studio Preview
  useEffect(() => {
    if (viewMode !== 'studio' || !selectedItem || !studioSceneRef.current) return;

    let active = true;
    setIsLoadingModel(true);
    const scene = studioSceneRef.current;
    const loader = new GLTFLoader();

    // Inform WebXR engine of current model
    if (arEngineRef.current) {
      void arEngineRef.current.setModel(selectedItem);
    }

    const processModel = (rawModel: THREE.Group) => {
      if (!active) return;

      // Remove previous model & visual helpers
      if (currentModelGroupRef.current) {
        scene.remove(currentModelGroupRef.current);
        currentModelGroupRef.current = null;
      }
      if (humanSilhouetteRef.current) {
        scene.remove(humanSilhouetteRef.current);
        humanSilhouetteRef.current = null;
      }
      if (dimensionBoxRef.current) {
        scene.remove(dimensionBoxRef.current);
        dimensionBoxRef.current = null;
      }

      const model = rawModel.clone();
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Ground model so base is at y = 0
      const bbox = new THREE.Box3().setFromObject(model);
      const center = bbox.getCenter(new THREE.Vector3());
      model.position.x = -center.x;
      model.position.z = -center.z;
      model.position.y = -bbox.min.y;

      const group = new THREE.Group();
      group.add(model);
      scene.add(group);
      currentModelGroupRef.current = group;

      // Apply chosen upholstery color
      const finish = UPHOLSTERY_FINISHES.find((f) => f.id === activeFinish);
      if (finish) {
        applyUpholsteryColor(group, finish.hex);
      }

      // Add Human Silhouette if toggled
      if (showHumanScale) {
        const sil = createHumanSilhouette();
        sil.position.set(bbox.max.x + 0.35, 0, 0);
        scene.add(sil);
        humanSilhouetteRef.current = sil;
      }

      // Add Dimension Box if toggled
      if (showDimensions) {
        const { w, h, d } = selectedItem.size;
        const dBox = createDimensionBox(w, h, d);
        scene.add(dBox);
        dimensionBoxRef.current = dBox;
      }

      // Focus camera on model center
      if (studioControlsRef.current) {
        studioControlsRef.current.target.set(0, selectedItem.size.h * 0.45, 0);
        studioControlsRef.current.update();
      }

      setIsLoadingModel(false);
    };

    if (gltfCacheRef.current.has(selectedItem.model)) {
      processModel(gltfCacheRef.current.get(selectedItem.model)!);
    } else {
      loader.loadAsync(selectedItem.model)
        .then((gltf) => {
          gltfCacheRef.current.set(selectedItem.model, gltf.scene);
          processModel(gltf.scene);
        })
        .catch((err) => {
          if (!active) return;
          console.warn('GLB load failed, creating fallback geometry:', err);
          setIsLoadingModel(false);

          if (currentModelGroupRef.current) scene.remove(currentModelGroupRef.current);
          const { w, h, d } = selectedItem.size;
          const box = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshStandardMaterial({ color: 0xd5fa9c, roughness: 0.35 })
          );
          box.position.y = h / 2;
          box.castShadow = true;
          const group = new THREE.Group();
          group.add(box);
          scene.add(group);
          currentModelGroupRef.current = group;
        });
    }

    return () => {
      active = false;
    };
  }, [selectedItem, viewMode, showHumanScale, showDimensions, activeFinish]);

  // 4. Live Camera Room AR Engine Setup
  const startCameraRoomAr = async () => {
    setViewMode('camera-ar');
    setIsCameraStarting(true);
    setRoomScanPhase('scanning');
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      cameraStreamRef.current = stream;

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play();
      }

      initCamera3DScene();
      setIsCameraStarting(false);

      // Radar scanning effect unlocks after 1.4s
      setTimeout(() => {
        setRoomScanPhase('locked');
        showToast('🎯 Floor locked! Click or tap to place furniture');
      }, 1400);
    } catch (err: unknown) {
      console.error('Camera AR access failed:', err);
      setIsCameraStarting(false);
      setViewMode('studio');
      const msg = err instanceof Error ? err.message : 'Camera error';
      setErrorMessage(`Camera access denied: ${msg}. You can continue inspecting in 3D Studio mode.`);
    }
  };

  const stopCameraRoomAr = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (cameraAnimFrameRef.current !== null) {
      cancelAnimationFrame(cameraAnimFrameRef.current);
      cameraAnimFrameRef.current = null;
    }
    if (cameraRendererRef.current) {
      cameraRendererRef.current.dispose();
      cameraRendererRef.current = null;
    }
    if (cameraSceneRef.current) {
      cameraSceneRef.current.clear();
      cameraSceneRef.current = null;
    }
    cameraReticleRef.current = null;
    cameraFloorPlaneRef.current = null;
    setPlacedItems([]);
    setSelectedPlacedId(null);
    setViewMode('studio');
  };

  const initCamera3DScene = () => {
    const canvas = cameraCanvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    cameraSceneRef.current = scene;

    // Camera elevated at 1.4m looking slightly down at floor (-25 deg)
    const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 50);
    camera.position.set(0, 1.4, 2.5);
    camera.lookAt(0, 0, 0);
    cameraCameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    cameraRendererRef.current = renderer;

    // Realistic Lighting for Room Passthrough
    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    const sunLight = new THREE.DirectionalLight(0xfff5ea, 1.6);
    sunLight.position.set(2, 4, 3);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(ambient, sunLight);

    // Floor Shadow Receiver (Invisible, catches soft shadows)
    const shadowPlaneGeo = new THREE.PlaneGeometry(12, 12);
    shadowPlaneGeo.rotateX(-Math.PI / 2);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.position.y = 0.001;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Raycast target floor
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshBasicMaterial({ visible: false });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = 0;
    scene.add(floor);
    cameraFloorPlaneRef.current = floor;

    // Floor Grid Helper (Subtle perspective guide)
    const roomGrid = new THREE.GridHelper(8, 16, 0xd5fa9c, 0x3c493a);
    (roomGrid.material as THREE.Material).transparent = true;
    (roomGrid.material as THREE.Material).opacity = 0.35;
    roomGrid.position.y = 0.002;
    scene.add(roomGrid);

    // Animated Placement Reticle
    const reticleGroup = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.18, 0.22, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xd5fa9c,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    reticleGroup.add(ring);

    // Inner pulsed dot
    const dotGeo = new THREE.CircleGeometry(0.04, 16);
    dotGeo.rotateX(-Math.PI / 2);
    const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    reticleGroup.add(dot);

    reticleGroup.position.set(0, 0.005, 0);
    scene.add(reticleGroup);
    cameraReticleRef.current = ring;

    // Render loop
    let running = true;
    const animate = () => {
      if (!running) return;
      reticleGroup.rotation.y += 0.015;
      renderer.render(scene, camera);
      cameraAnimFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    // Canvas Resize listener
    const handleResize = () => {
      if (!canvas || !renderer) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', handleResize);
  };

  // Pointer move on Camera AR canvas: updates reticle position
  const handleCameraPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = cameraCanvasRef.current;
    const camera = cameraCameraRef.current;
    const floor = cameraFloorPlaneRef.current;
    const reticle = cameraReticleRef.current;
    if (!canvas || !camera || !floor || !reticle) return;

    const rect = canvas.getBoundingClientRect();
    cameraPointerRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    cameraPointerRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    cameraRaycasterRef.current.setFromCamera(cameraPointerRef.current, camera);
    const intersects = cameraRaycasterRef.current.intersectObject(floor);
    if (intersects.length > 0) {
      const hit = intersects[0].point;
      reticle.parent?.position.set(hit.x, 0.005, hit.z);
    }
  };

  // Click on Camera AR Canvas: places or selects furniture item
  const handleCameraCanvasClick = () => {
    const scene = cameraSceneRef.current;
    const reticle = cameraReticleRef.current;
    if (!scene || !reticle || !selectedItem || roomScanPhase !== 'locked') return;

    const spawnPos = reticle.parent?.position.clone() || new THREE.Vector3(0, 0, 0);

    // Get cached model or fallback
    let modelInstance: THREE.Group;
    const cached = gltfCacheRef.current.get(selectedItem.model);
    if (cached) {
      modelInstance = cached.clone();
      modelInstance.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      const finish = UPHOLSTERY_FINISHES.find((f) => f.id === activeFinish);
      if (finish) applyUpholsteryColor(modelInstance, finish.hex);
    } else {
      const { w, h, d } = selectedItem.size;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: 0xd5fa9c, roughness: 0.35 })
      );
      box.position.y = h / 2;
      box.castShadow = true;
      modelInstance = new THREE.Group();
      modelInstance.add(box);
    }

    const itemWrapper = new THREE.Group();
    itemWrapper.position.set(spawnPos.x, 0, spawnPos.z);
    itemWrapper.add(modelInstance);
    scene.add(itemWrapper);

    const newItemId = `placed-${Date.now()}`;
    const newPlacedItem: PlacedRoomItem = {
      id: newItemId,
      item: selectedItem,
      object: itemWrapper,
      rotationY: 0,
      scale: 1.0,
      elevation: 0,
    };

    setPlacedItems((prev) => [...prev, newPlacedItem]);
    setSelectedPlacedId(newItemId);
    showToast(`Placed ${selectedItem.name} in room!`);
  };

  // Manipulation Controls for active placed item in Camera AR
  const rotateActiveItem = (angleDeg: number) => {
    if (!selectedPlacedId) return;
    setPlacedItems((prev) =>
      prev.map((pi) => {
        if (pi.id === selectedPlacedId) {
          const nextRot = pi.rotationY + (angleDeg * Math.PI) / 180;
          pi.object.rotation.y = nextRot;
          return { ...pi, rotationY: nextRot };
        }
        return pi;
      })
    );
  };

  const scaleActiveItem = (factorDelta: number) => {
    if (!selectedPlacedId) return;
    setPlacedItems((prev) =>
      prev.map((pi) => {
        if (pi.id === selectedPlacedId) {
          const nextScale = Math.max(0.6, Math.min(1.5, Math.round((pi.scale + factorDelta) * 100) / 100));
          pi.object.scale.setScalar(nextScale);
          return { ...pi, scale: nextScale };
        }
        return pi;
      })
    );
  };

  const setItemElevation = (elevationMeters: number) => {
    if (!selectedPlacedId) return;
    setPlacedItems((prev) =>
      prev.map((pi) => {
        if (pi.id === selectedPlacedId) {
          pi.object.position.y = elevationMeters;
          return { ...pi, elevation: elevationMeters };
        }
        return pi;
      })
    );
    showToast(`Elevation: ${elevationMeters > 0 ? `+${elevationMeters}m` : 'Floor'}`);
  };

  const deleteActiveItem = () => {
    if (!selectedPlacedId || !cameraSceneRef.current) return;
    const target = placedItems.find((pi) => pi.id === selectedPlacedId);
    if (target) {
      cameraSceneRef.current.remove(target.object);
      setPlacedItems((prev) => prev.filter((pi) => pi.id !== selectedPlacedId));
      setSelectedPlacedId(null);
      showToast('Item removed');
    }
  };

  const clearAllPlacedItems = () => {
    if (!cameraSceneRef.current) return;
    placedItems.forEach((pi) => cameraSceneRef.current?.remove(pi.object));
    setPlacedItems([]);
    setSelectedPlacedId(null);
    showToast('Cleared all placed furniture');
  };

  // Snapshot composite photo (Video feed + 3D furniture)
  const handleCaptureArPhoto = () => {
    if (!cameraVideoRef.current || !cameraCanvasRef.current) return;
    const video = cameraVideoRef.current;
    const canvas3D = cameraCanvasRef.current;

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = video.videoWidth || 1920;
    snapCanvas.height = video.videoHeight || 1080;
    const ctx = snapCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
    ctx.drawImage(canvas3D, 0, 0, snapCanvas.width, snapCanvas.height);

    const a = document.createElement('a');
    a.download = `ar-room-${selectedItem?.id || 'placement'}.png`;
    a.href = snapCanvas.toDataURL('image/png');
    a.click();
    showToast('📸 AR Photo saved!');
  };

  // Launch Native WebXR AR Session
  const handleStartWebXr = async () => {
    if (!arHostRef.current || !arOverlayRef.current || !arEngineRef.current) return;

    try {
      setErrorMessage(null);
      if (selectedItem) await arEngineRef.current.setModel(selectedItem);
      await arEngineRef.current.start(arHostRef.current, arOverlayRef.current);
      setIsWebXrActive(true);
      showToast('WebXR Active! Slowly scan room floor and tap to position');
    } catch (err: unknown) {
      console.error('Failed to launch WebXR AR session:', err);
      const msg = err instanceof Error ? err.message : 'WebXR failed';
      setErrorMessage(`WebXR Session: ${msg}`);
      setIsWebXrActive(false);
    }
  };

  const handleStopWebXr = () => {
    if (arEngineRef.current) arEngineRef.current.stop();
    setIsWebXrActive(false);
  };

  const handleCopyLanLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url)
      .then(() => showToast('Mobile link copied!'))
      .catch(() => showToast(url));
  };

  const filteredItems = items.filter((item) => {
    if (categoryFilter === 'all') return true;
    return item.category === categoryFilter;
  });

  return (
    <div className="ar-container">
      {/* Top Bar with Mode Switcher & Status */}
      <div className="ar-top-bar">
        <div className="ar-title-group">
          <Link to="/" className="ar-nav-back">← Reality Lab Home</Link>
          <h1>AR Spatial Placement</h1>
        </div>

        {/* View Mode Tabs */}
        <div className="ar-view-mode-tabs" role="tablist">
          <button
            className={`ar-view-mode-tab ${viewMode === 'studio' ? 'active' : ''}`}
            onClick={() => {
              if (viewMode === 'camera-ar') stopCameraRoomAr();
              setViewMode('studio');
            }}
          >
            🏢 3D Studio
          </button>
          <button
            className={`ar-view-mode-tab ${viewMode === 'camera-ar' ? 'active' : ''}`}
            onClick={startCameraRoomAr}
          >
            📷 Live Room AR
          </button>
        </div>

        {/* Status Dot */}
        <div className="ar-mode-badge">
          <span className="ar-mode-dot" style={{
            background: viewMode === 'camera-ar' ? '#22c55e' : '#38bdf8',
            boxShadow: `0 0 8px ${viewMode === 'camera-ar' ? '#22c55e' : '#38bdf8'}`
          }} />
          <span>
            {viewMode === 'camera-ar'
              ? 'Room AR Active'
              : isArSupported
              ? 'ARCore Available'
              : 'Studio Preview'}
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="tryon-error-banner" role="alert">
          <div><strong>Notice:</strong> {errorMessage}</div>
          <button
            className="btn-secondary-action"
            onClick={() => setErrorMessage(null)}
            style={{ padding: '6px 14px', fontSize: '12px' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── STAGE 1: 3D STUDIO PREVIEW ────────────────────────────────────────── */}
      {viewMode === 'studio' && (
        <div className="ar-stage-card">
          <canvas ref={previewCanvasRef} className="ar-canvas-3d" />

          {/* Studio HUD */}
          {selectedItem && (
            <div className="ar-studio-hud">
              <div className="ar-item-details-pill">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="ar-item-name">{selectedItem.name}</span>
                  <span className="ar-category-tag">{selectedItem.category}</span>
                </div>
                <div className="ar-item-dimensions">
                  Real Dimensions:{' '}
                  <strong>
                    {selectedItem.size.w.toFixed(2)}m (W) × {selectedItem.size.h.toFixed(2)}m (H) × {selectedItem.size.d.toFixed(2)}m (D)
                  </strong>
                </div>
              </div>

              {/* Studio Visual Tools */}
              <div className="ar-studio-controls">
                <button
                  className={`ar-ctrl-btn ${showHumanScale ? 'active' : ''}`}
                  onClick={() => setShowHumanScale(!showHumanScale)}
                  title="Show 1.75m human silhouette for instant size comparison"
                >
                  🧍 {showHumanScale ? 'Human Scale (1.75m)' : 'Scale Guide'}
                </button>
                <button
                  className={`ar-ctrl-btn ${showDimensions ? 'active' : ''}`}
                  onClick={() => setShowDimensions(!showDimensions)}
                  title="Toggle dimension measurement lines"
                >
                  📐 {showDimensions ? 'Hide BBox' : 'Dimensions'}
                </button>
                <button
                  className={`ar-ctrl-btn ${isAutoRotate ? 'active' : ''}`}
                  onClick={() => setIsAutoRotate(!isAutoRotate)}
                  title="Toggle turntable rotation"
                >
                  🔄 {isAutoRotate ? 'Rotating' : 'Paused'}
                </button>
                <button
                  className="ar-ctrl-btn"
                  onClick={() => {
                    const next = lightingPreset === 'neutral' ? 'warm' : lightingPreset === 'warm' ? 'daylight' : 'neutral';
                    setLightingPreset(next);
                  }}
                  title="Cycle studio lighting atmosphere"
                >
                  💡 {lightingPreset.toUpperCase()}
                </button>
              </div>
            </div>
          )}

          {/* Color / Fabric Swatches Picker */}
          {selectedItem?.category === 'furniture' && (
            <div className="ar-swatches-card">
              <span className="ar-swatches-title">Finish:</span>
              <div className="ar-swatch-list">
                {UPHOLSTERY_FINISHES.map((finish) => (
                  <button
                    key={finish.id}
                    className={`ar-swatch-btn ${activeFinish === finish.id ? 'active' : ''}`}
                    style={{
                      background: finish.hex !== null ? `#${finish.hex.toString(16).padStart(6, '0')}` : 'linear-gradient(135deg, #aebaaa 50%, #475569 50%)',
                    }}
                    onClick={() => setActiveFinish(finish.id)}
                    title={finish.name}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Launch AR Action Bar inside Studio Preview */}
          <div className="ar-stage-launch-bar">
            <button
              className="btn-primary-action"
              onClick={startCameraRoomAr}
              disabled={isLoadingModel}
            >
              📷 Launch Live Room AR
            </button>
            {isArSupported && (
              <button
                className="btn-secondary-action"
                onClick={handleStartWebXr}
                title="Launch WebXR immersive session"
              >
                📱 Native WebXR
              </button>
            )}
            {!isArSupported && (
              <button
                className="btn-secondary-action"
                onClick={handleCopyLanLink}
                title="Copy link to open on phone"
              >
                📲 Copy Mobile Link
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── STAGE 2: LIVE CAMERA ROOM AR ────────────────────────────────────── */}
      {viewMode === 'camera-ar' && (
        <div className="ar-camera-stage">
          <video
            ref={cameraVideoRef}
            className="ar-camera-feed"
            playsInline
            autoPlay
            muted
          />
          <canvas
            ref={cameraCanvasRef}
            className="ar-camera-3d-canvas"
            onPointerMove={handleCameraPointerMove}
            onClick={handleCameraCanvasClick}
          />

          {/* Radar Scanning Overlay during plane estimation */}
          {roomScanPhase === 'scanning' && (
            <div className="ar-scan-radar-overlay">
              <div className="ar-scan-radar-box">
                <div className="ar-scan-radar-sweep" />
              </div>
              <div className="ar-scan-radar-text">
                <span>📡 Scanning Room Floor & Surfaces...</span>
              </div>
            </div>
          )}

          {/* Top In-Room HUD */}
          <div className="ar-room-hud-top">
            <div className="ar-room-instructions">
              <span>{placedItems.length === 0 ? '👆 Tap room floor to place item' : `🛋️ Placed: ${placedItems.length} items`}</span>
              {selectedItem && <strong>({selectedItem.name})</strong>}
            </div>
            <div className="ar-room-top-actions">
              <button
                className="btn-secondary-action"
                onClick={handleCaptureArPhoto}
                title="Capture composite photo"
              >
                📸 Snap Photo
              </button>
              <button
                className="btn-danger-action"
                onClick={stopCameraRoomAr}
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                ✕ Exit AR
              </button>
            </div>
          </div>

          {/* In-Room Bottom Manipulation Toolbar */}
          <div className="ar-room-toolbar">
            <div className="ar-toolbar-group">
              <button className="ar-tool-btn" onClick={() => rotateActiveItem(-45)} title="Rotate Left">
                ↺ -45°
              </button>
              <button className="ar-tool-btn" onClick={() => rotateActiveItem(45)} title="Rotate Right">
                ↻ +45°
              </button>
            </div>

            <div className="ar-toolbar-divider" />

            <div className="ar-toolbar-group">
              <button className="ar-tool-btn" onClick={() => scaleActiveItem(-0.1)} title="Scale Down">
                - Size
              </button>
              <button className="ar-tool-btn" onClick={() => scaleActiveItem(0.1)} title="Scale Up">
                + Size
              </button>
            </div>

            <div className="ar-toolbar-divider" />

            <div className="ar-toolbar-group">
              <button className="ar-tool-btn" onClick={() => setItemElevation(0)} title="Snap to Floor">
                Floor
              </button>
              <button className="ar-tool-btn" onClick={() => setItemElevation(0.45)} title="Elevate to Coffee Table">
                +0.45m
              </button>
            </div>

            <div className="ar-toolbar-divider" />

            <div className="ar-toolbar-group">
              {selectedPlacedId && (
                <button className="ar-tool-btn" onClick={deleteActiveItem} title="Delete selected item" style={{ color: '#ef4444' }}>
                  🗑️ Delete
                </button>
              )}
              {placedItems.length > 0 && (
                <button className="ar-tool-btn" onClick={clearAllPlacedItems} title="Clear room">
                  🧹 Clear All
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Device Info & Tips Banner */}
      <div className="ar-webxr-info-card">
        <div className="ar-webxr-info-text">
          <h4>
            {viewMode === 'camera-ar'
              ? '✨ Live Room AR Activated'
              : isArSupported
              ? '✨ WebXR AR Ready on this Device'
              : '💡 True 1:1 Scale Spatial Placement'}
          </h4>
          <p>
            {viewMode === 'camera-ar'
              ? 'Tap any point on your floor to spawn your selected furniture item. Use the in-room toolbar below to rotate, adjust size, raise onto coffee tables, and capture photo snapshots.'
              : 'Inspect furniture with 360° turntable, human scale visualizer (1.75m comparison), and dimensions. Switch to "Live Room AR" to place items in your actual living space using your camera.'}
          </p>
        </div>
        {viewMode !== 'camera-ar' && (
          <button className="btn-secondary-action" onClick={startCameraRoomAr}>
            📷 Start Camera AR
          </button>
        )}
      </div>

      {/* Furniture Catalog Section */}
      <section className="ar-catalog-section" aria-label="Furniture catalog">
        <div className="ar-catalog-header">
          <div>
            <h3>Furniture & Decor Catalog</h3>
            <span style={{ fontSize: '13px', color: '#aebaaa' }}>
              Select an item to inspect in 3D and place in your room
            </span>
          </div>

          <div className="ar-filter-tabs">
            <button
              className={`ar-filter-tab ${categoryFilter === 'all' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('all')}
            >
              All (5)
            </button>
            <button
              className={`ar-filter-tab ${categoryFilter === 'furniture' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('furniture')}
            >
              Furniture (3)
            </button>
            <button
              className={`ar-filter-tab ${categoryFilter === 'decor' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('decor')}
            >
              Decor (2)
            </button>
          </div>
        </div>

        <div className="ar-furniture-grid">
          {filteredItems.map((item) => {
            const isSelected = selectedItem?.id === item.id;
            return (
              <div
                key={item.id}
                className={`ar-furniture-card ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedItem(item);
                  showToast(`Selected: ${item.name}`);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedItem(item);
                  }
                }}
                aria-pressed={isSelected}
              >
                <div className="ar-furniture-thumb-box">
                  <img
                    src={item.thumb}
                    alt={item.name}
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <div className="ar-card-header">
                  <div className="ar-card-name">{item.name}</div>
                  <span className="ar-category-tag">{item.category}</span>
                </div>
                <div className="ar-card-meta">
                  <span>{item.id}</span>
                  <span>{item.size.w.toFixed(2)}m × {item.size.h.toFixed(2)}m</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Native WebXR AR Overlay Container */}
      <div
        ref={arHostRef}
        className="ar-native-host"
        style={{ display: isWebXrActive ? 'block' : 'none' }}
      >
        <div ref={arOverlayRef} className="ar-native-overlay">
          <div className="ar-overlay-top">
            <span>AR Mode: Tap ring to place {selectedItem?.name}</span>
            <button
              className="btn-danger-action"
              onClick={handleStopWebXr}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              ✕ Exit AR
            </button>
          </div>

          <div className="ar-overlay-bottom">
            <div className="ar-overlay-actions">
              <button
                className="btn-secondary-action"
                onClick={() => {
                  arEngineRef.current?.clearPlaced?.();
                  showToast('Cleared placed items');
                }}
              >
                🗑 Clear Placed
              </button>
              <button className="btn-danger-action" onClick={handleStopWebXr}>
                Done
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="tryon-flash-toast">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
