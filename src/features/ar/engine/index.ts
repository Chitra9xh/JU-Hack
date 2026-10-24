import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { ArEngine, Furniture } from '../../../shared/types';

export interface ArEngineExtended extends ArEngine {
  clearPlaced?: () => void;
  getPlacedCount?: () => number;
}

export function createArEngine(): ArEngineExtended {
  let session: XRSession | null = null;
  let hitTestSource: XRHitTestSource | null = null;
  let localReferenceSpace: XRReferenceSpace | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let reticle: THREE.Mesh | null = null;
  let hostElement: HTMLElement | null = null;
  let overlayElement: HTMLElement | null = null;
  let animationFrameId: number | null = null;
  let selectedModel: Furniture | null = null;

  const gltfLoader = new GLTFLoader();
  const modelCache = new Map<string, THREE.Group>();
  const placedObjects: THREE.Object3D[] = [];

  const onSelect = () => {
    if (!reticle || !reticle.visible || !scene) return;

    let objectToPlace: THREE.Object3D;
    const cached = selectedModel?.model ? modelCache.get(selectedModel.model) : null;

    if (cached) {
      objectToPlace = cached.clone();
      objectToPlace.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    } else {
      // Fallback box with real dimensions
      const w = selectedModel?.size.w ?? 0.5;
      const h = selectedModel?.size.h ?? 0.5;
      const d = selectedModel?.size.d ?? 0.5;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: 0xd5fa9c,
          roughness: 0.35,
          metalness: 0.1,
          transparent: true,
          opacity: 0.9,
        })
      );
      box.position.y += h / 2;
      box.castShadow = true;
      box.receiveShadow = true;
      objectToPlace = new THREE.Group();
      objectToPlace.add(box);
    }

    objectToPlace.name = selectedModel?.name ?? 'Placed item';
    objectToPlace.position.copy(reticle.position);
    objectToPlace.quaternion.copy(reticle.quaternion);
    placedObjects.push(objectToPlace);
    scene.add(objectToPlace);
  };

  const disposeScene = () => {
    if (!scene) return;

    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    scene.clear();
  };

  const engine: ArEngineExtended = {
    async isSupported(): Promise<boolean> {
      const xr = navigator.xr;
      return Boolean(xr?.isSessionSupported) &&
        await xr!.isSessionSupported('immersive-ar');
    },

    async start(host: HTMLElement, overlay: HTMLElement): Promise<void> {
      if (!await engine.isSupported()) {
        throw new Error('WebXR immersive-ar is not supported on this device.');
      }
      if (session) engine.stop();

      hostElement = host;
      overlayElement = overlay;

      session = await navigator.xr!.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'local-floor'],
        domOverlay: { root: overlay },
      });

      const viewerReferenceSpace = await session.requestReferenceSpace('viewer');
      if (!session.requestHitTestSource) {
        throw new Error('This browser does not support WebXR hit testing.');
      }
      hitTestSource = await session.requestHitTestSource({ space: viewerReferenceSpace }) ?? null;
      try {
        localReferenceSpace = await session.requestReferenceSpace('local-floor');
      } catch {
        localReferenceSpace = await session.requestReferenceSpace('local');
      }

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera();
      camera.matrixAutoUpdate = false;
      scene.add(camera);

      const ambientLight = new THREE.HemisphereLight(0xffffff, 0x334155, 1.4);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
      directionalLight.position.set(1, 2, 1);
      scene.add(ambientLight, directionalLight);

      reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
      );
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      scene.add(reticle);

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(host.clientWidth || window.innerWidth, host.clientHeight || window.innerHeight, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.xr.enabled = true;
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.inset = '0';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      host.appendChild(renderer.domElement);

      await renderer.xr.setSession(session);
      renderer.setAnimationLoop((_time: number, frame?: XRFrame) => {
        if (!frame || !session || !hitTestSource || !localReferenceSpace || !renderer || !scene || !camera || !reticle) {
          renderer?.render(scene!, camera!);
          return;
        }

        const hitTestResults = frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length > 0) {
          const pose = hitTestResults[0].getPose(localReferenceSpace);
          if (pose) {
            reticle.visible = true;
            reticle.matrix.fromArray(pose.transform.matrix as unknown as number[]);
            reticle.matrixWorld.copy(reticle.matrix);
            reticle.matrix.decompose(reticle.position, reticle.quaternion, reticle.scale);
          }
        } else {
          reticle.visible = false;
        }

        renderer.render(scene, renderer.xr.getCamera());
      });

      session.addEventListener('select', onSelect);
      session.addEventListener('end', () => {
        if (session) engine.stop();
      }, { once: true });
    },

    stop(): void {
      if (session) {
        session.removeEventListener('select', onSelect);
      }

      if (hitTestSource) {
        hitTestSource.cancel();
        hitTestSource = null;
      }
      localReferenceSpace = null;

      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      if (renderer) {
        renderer.setAnimationLoop(null);
        renderer.dispose();
        if (renderer.domElement.parentElement) {
          renderer.domElement.parentElement.removeChild(renderer.domElement);
        }
        renderer = null;
      }

      disposeScene();
      scene = null;
      camera = null;
      reticle = null;

      if (session) {
        const activeSession = session;
        session = null;
        if (activeSession) void activeSession.end().catch(() => undefined);
      }

      placedObjects.length = 0;
      hostElement = null;
      overlayElement = null;
      selectedModel = null;
    },

    async setModel(item: Furniture): Promise<void> {
      selectedModel = item;
      if (item.model && !modelCache.has(item.model)) {
        try {
          const gltf = await gltfLoader.loadAsync(item.model);
          const model = gltf.scene;
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          // Center geometry horizontally and ground bottom at y = 0
          const bbox = new THREE.Box3().setFromObject(model);
          const center = bbox.getCenter(new THREE.Vector3());
          model.position.x = -center.x;
          model.position.z = -center.z;
          model.position.y = -bbox.min.y;

          const group = new THREE.Group();
          group.add(model);
          modelCache.set(item.model, group);
        } catch (err) {
          console.warn('Failed to preload furniture GLB:', item.model, err);
        }
      }
    },

    clearPlaced(): void {
      if (!scene) return;
      for (const obj of placedObjects) {
        scene.remove(obj);
      }
      placedObjects.length = 0;
    },

    getPlacedCount(): number {
      return placedObjects.length;
    },
  };

  return engine;
}
