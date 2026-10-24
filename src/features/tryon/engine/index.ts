import * as THREE from 'three';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Frame, TryOnEngine } from '../../../shared/types';

export interface FaceMeasurements {
  widthCm: number;   // cheek-to-cheek width
  heightCm: number;  // forehead-to-chin height
  jawCm: number;     // jaw width
  shape: 'Oval' | 'Round' | 'Square' | 'Heart' | 'Oblong';
}

export interface TryOnEngineExtended extends TryOnEngine {
  onMetricsUpdate?: (metrics: {
    detected: boolean;
    yaw?: number;
    pitch?: number;
    roll?: number;
    distance?: number;
  }) => void;
  /** Fired once when stable face measurements are ready (after ≥30 consistent frames). */
  onFaceAnalyzed?: (measurements: FaceMeasurements) => void;
  getActiveFrame?: () => Frame | null;
  setScaleOffset?: (scale: number) => void;
  setHeightOffset?: (offsetY: number) => void;
  setDepthOffset?: (offsetZ: number) => void;
  /** Show or hide the glasses overlay (use false during analysis phase). */
  setGlassesVisible?: (visible: boolean) => void;
}

/**
 * Canonical face model coordinates for the nose bridge (Landmark 168 / 6).
 * Source: mediapipe/modules/face_geometry/data/canonical_face_model.obj
 * In the canonical model, the origin is centered in the head:
 * - Landmark 168 (glabella): y = +3.27 cm (+0.0327 m), z = +5.24 cm (+0.0524 m)
 * - Landmark 6 (nose bridge): y = +2.47 cm (+0.0247 m), z = +5.79 cm (+0.0579 m)
 *
 * Eyeglasses rest naturally between LM 168 and LM 6, on the bridge:
 * - y = +0.029 m (2.9 cm above origin, right between the eyes)
 * - z = +0.058 m (5.8 cm forward, resting on the nose bridge surface)
 */
const NOSE_BRIDGE_CANONICAL = new THREE.Vector3(
  0,          // x: centered
  0.029,      // y: +2.9 cm above origin (rests on nose bridge)
  0.058       // z: +5.8 cm forward (rests on bridge surface)
);

/**
 * Creates a procedural stub glasses mesh conforming to the project contract:
 * - Origin at nose-bridge midpoint
 * - +Y up, +Z toward the viewer, -Z toward the temples/ears
 * - 1 unit = 1 meter
 * - Total width ≈ 0.14 m (matching canonical face model scale)
 */
function createStubGlasses(): THREE.Group {
  const glasses = new THREE.Group();
  glasses.name = 'stub-glasses';

  // Dark metallic frame material
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    metalness: 0.88,
    roughness: 0.18,
  });

  // Tinted lens material (photorealistic glass)
  const lensMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x223322,
    transmission: 0.82,
    opacity: 1,
    transparent: false,
    roughness: 0.04,
    metalness: 0.0,
    ior: 1.52,
    thickness: 0.004,
  });

  // Nose bridge — centered at (0, 0, 0)
  const bridgeGeo = new THREE.CylinderGeometry(0.0022, 0.0022, 0.022, 16);
  bridgeGeo.rotateZ(Math.PI / 2);
  const bridge = new THREE.Mesh(bridgeGeo, frameMaterial);
  bridge.position.set(0, 0.002, 0);
  glasses.add(bridge);

  // Nose pads
  const padGeo = new THREE.BoxGeometry(0.002, 0.007, 0.004);
  [-1, 1].forEach((side) => {
    const pad = new THREE.Mesh(padGeo, frameMaterial);
    pad.position.set(side * 0.011, -0.007, -0.004);
    glasses.add(pad);
  });

  // Lens rims — torus, centered at ±0.038 m from bridge
  const rimRadius = 0.026;
  const tubeRadius = 0.0022;
  const rimGeo = new THREE.TorusGeometry(rimRadius, tubeRadius, 16, 40);

  // Lens fill — flat disc inside the rim
  const lensGeo = new THREE.CylinderGeometry(
    rimRadius - 0.001,
    rimRadius - 0.001,
    0.001,
    32
  );
  lensGeo.rotateX(Math.PI / 2);

  [-1, 1].forEach((side) => {
    const rim = new THREE.Mesh(rimGeo, frameMaterial);
    rim.position.set(side * 0.038, 0, 0);

    const lens = new THREE.Mesh(lensGeo, lensMaterial);
    lens.position.set(side * 0.038, 0, 0);

    glasses.add(rim, lens);
  });

  // Temples (arms extending back along -Z)
  const templeLength = 0.115;
  const templeGeo = new THREE.CylinderGeometry(0.0018, 0.0013, templeLength, 12);
  templeGeo.rotateX(Math.PI / 2);

  [-1, 1].forEach((side) => {
    const temple = new THREE.Mesh(templeGeo, frameMaterial);
    temple.position.set(side * 0.065, 0.001, -templeLength / 2);
    glasses.add(temple);
  });

  return glasses;
}

export function createTryOnEngine(): TryOnEngineExtended {
  let mediaStream: MediaStream | null = null;
  let faceLandmarker: FaceLandmarker | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let faceGroup: THREE.Group | null = null;
  let glassesHolder: THREE.Group | null = null;
  let glassesMesh: THREE.Group | null = null;
  let customFrameMesh: THREE.Object3D | null = null;
  let animFrameId: number | null = null;
  let isRunning = false;
  let lastVideoTime = -1;
  let lastDetectTime = 0;
  let lastTimestamp = 0;

  // User-adjustable offsets (accumulated from button presses)
  let userScale = 1.0;
  let userOffsetY = 0.0;
  let userOffsetZ = 0.0;

  const gltfLoader = new GLTFLoader();
  const frameCache = new Map<string, THREE.Group>();
  let activeFrame: Frame | null = null;

  // Pose smoothing
  let hasFirstPose = false;
  const targetMatrix = new THREE.Matrix4();
  const rawMatrix = new THREE.Matrix4();
  const targetPos = new THREE.Vector3();
  const targetQuat = new THREE.Quaternion();
  const targetScale = new THREE.Vector3();

  const currentPos = new THREE.Vector3();
  const currentQuat = new THREE.Quaternion();
  const tempEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  // Face-analysis state — accumulate measurements over stable frames, fire once
  let analysisFrameCount = 0;
  let analysisWidthAcc  = 0;
  let analysisHeightAcc = 0;
  let analysisJawAcc    = 0;
  let analysisFired     = false;
  let glassesVisibleFlag = false; // controlled externally via setGlassesVisible()
  let smoothedAutoScale = 1.0; // dynamically scales glasses to fit face in portrait/mobile view

  const engine: TryOnEngineExtended = {
    async start(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<void> {
      if (isRunning) {
        engine.stop();
      }

      // 1. Start user camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      mediaStream = stream;
      video.srcObject = stream;
      video.muted = true;
      await video.play();

      // Wait for actual video dimensions
      await new Promise<void>((resolve) => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          resolve();
        } else {
          const onReady = () => {
            video.removeEventListener('loadeddata', onReady);
            video.removeEventListener('loadedmetadata', onReady);
            resolve();
          };
          video.addEventListener('loadeddata', onReady);
          video.addEventListener('loadedmetadata', onReady);
          setTimeout(resolve, 2000);
        }
      });

      const videoWidth = video.videoWidth || 1280;
      const videoHeight = video.videoHeight || 720;
      canvas.width = videoWidth;
      canvas.height = videoHeight;

      // 2. Initialize MediaPipe Face Landmarker
      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm'
      );

      const modelPath = '/models/face_landmarker.task';
      let modelUrl = modelPath;
      try {
        const headCheck = await fetch(modelPath, { method: 'HEAD' });
        if (!headCheck.ok) {
          modelUrl = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
        }
      } catch {
        modelUrl = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
      }

      faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: modelUrl,
        },
        runningMode: 'VIDEO',
        outputFacialTransformationMatrixes: true,
        outputFaceBlendshapes: false,
        numFaces: 1,
        minFaceDetectionConfidence: 0.35,
        minFacePresenceConfidence: 0.35,
        minTrackingConfidence: 0.35,
      });

      // 3. Initialize Three.js scene
      scene = new THREE.Scene();

      // Camera FOV ~63° matches MediaPipe canonical pinhole projection.
      // Camera sits at origin looking down -Z (standard OpenGL / Three.js convention).
      camera = new THREE.PerspectiveCamera(63, videoWidth / videoHeight, 0.001, 50);
      camera.position.set(0, 0, 0);

      // Balanced studio lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
      const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.4);
      keyLight.position.set(1.5, 2.5, 3);
      const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.7);
      fillLight.position.set(-1.5, 1.0, 2);
      const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
      rimLight.position.set(0, -1, -2);
      scene.add(ambientLight, keyLight, fillLight, rimLight);

      // Root face group — tracks head pose; uses default matrixAutoUpdate
      faceGroup = new THREE.Group();
      faceGroup.visible = false;
      scene.add(faceGroup);

      // Glasses holder: child of faceGroup positioned at canonical nose bridge
      glassesHolder = new THREE.Group();
      glassesHolder.position.copy(NOSE_BRIDGE_CANONICAL);
      glassesHolder.position.y += userOffsetY;
      glassesHolder.position.z += userOffsetZ;
      faceGroup.add(glassesHolder);

      // Mount frame or stub glasses
      if (activeFrame) {
        await engine.setFrame(activeFrame);
      } else {
        glassesMesh = createStubGlasses();
        glassesHolder.add(glassesMesh);
      }

      // WebGL Renderer
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(videoWidth, videoHeight, false);

      isRunning = true;
      hasFirstPose = false;
      lastVideoTime = -1;
      lastDetectTime = 0;
      lastTimestamp = 0;

      // 4. Main render loop
      const renderFrame = () => {
        if (!isRunning) return;

        if (
          video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          faceLandmarker &&
          renderer &&
          scene &&
          camera &&
          faceGroup &&
          glassesHolder
        ) {
          const now = performance.now();

          // Dynamically adjust canvas and camera projection if video dimensions update (crucial on mobile)
          if (
            video.videoWidth > 0 && video.videoHeight > 0 &&
            (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)
          ) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            camera.aspect = video.videoWidth / video.videoHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(video.videoWidth, video.videoHeight, false);
          }

          if (video.currentTime !== lastVideoTime || now - lastDetectTime >= 30) {
            lastVideoTime = video.currentTime;
            lastDetectTime = now;

            let timestamp = now;
            if (timestamp <= lastTimestamp) {
              timestamp = lastTimestamp + 1;
            }
            lastTimestamp = timestamp;

            try {
              const results = faceLandmarker.detectForVideo(video, timestamp);
              let hasPose = false;
              let autoScale = 1.0;

              // ─────────────────────────────────────────────────────────────────
              // Path A: Use the 4×4 facial transformation matrix from MediaPipe.
              //
              // The matrix is stored COLUMN-MAJOR (WebGL convention).
              // THREE.Matrix4.fromArray() reads column-major arrays natively.
              //
              // MediaPipe's canonical face model is in centimeters.
              // The translation components (column 3: indices 12, 13, 14) are in cm.
              // We scale them by 0.01 to convert to meters.
              //
              // The coordinate system MediaPipe uses is right-handed, Y-up, -Z into
              // the scene — identical to Three.js camera space. No further axis flips
              // are needed for the rotation part.
              //
              // Webcam feeds are MIRRORED horizontally for the user (selfie view).
              // We flip the X translation to keep the 3D glasses in sync.
              // ─────────────────────────────────────────────────────────────────
              if (
                results.facialTransformationMatrixes &&
                results.facialTransformationMatrixes.length > 0
              ) {
                const data = results.facialTransformationMatrixes[0].data;

               // Load MediaPipe 4×4 column-major matrix directly into Three.js.
                // MediaPipe and Three.js share the same coordinate convention:
                // right-handed, Y-up, camera looking down -Z.
                // Translation is in cm — scale by 0.01 to get metres.
                //
                // IMPORTANT: Do NOT apply any mirror-X transform here.
                // Both the <video> and the <canvas> have CSS `scaleX(-1)` applied,
                // so left↔right is already flipped consistently for both.  Any
                // additional 3D mirror causes double-mirroring and misalignment.
                rawMatrix.fromArray(data);

                // Copy matrix then overwrite only the translation column (scaled).
                const re = rawMatrix.elements;
                const te = targetMatrix.elements;
                te[0]=re[0]; te[1]=re[1]; te[2]=re[2];  te[3]=re[3];
                te[4]=re[4]; te[5]=re[5]; te[6]=re[6];  te[7]=re[7];
                te[8]=re[8]; te[9]=re[9]; te[10]=re[10]; te[11]=re[11];
                te[12] = re[12] * 0.01;  // X: cm → m
                te[13] = re[13] * 0.01;  // Y: cm → m
                te[14] = -Math.abs(re[14]) * 0.01; // Z: cm → m (guaranteed negative = in front of camera)
                te[15] = 1.0;

                targetMatrix.decompose(targetPos, targetQuat, targetScale);

                // Face must be in front of camera (Z < 0 in Three.js camera space)
                if (
                  isFinite(targetPos.x) && isFinite(targetPos.y) && isFinite(targetPos.z) &&
                  isFinite(targetQuat.w) &&
                  targetPos.z < -0.05 && targetPos.z > -3.0
                ) {
                  hasPose = true;
                  glassesHolder.position.set(
                    NOSE_BRIDGE_CANONICAL.x,
                    NOSE_BRIDGE_CANONICAL.y + userOffsetY,
                    NOSE_BRIDGE_CANONICAL.z + userOffsetZ
                  );
                }
              }

              // ─────────────────────────────────────────────────────────────────
              // Path B: Direct landmark geometry fallback.
              // Use LM168 (nose bridge) as anchor for position.
              // Compute yaw/pitch/roll from eye and nose landmarks.
              // ─────────────────────────────────────────────────────────────────
              if (!hasPose && results.faceLandmarks && results.faceLandmarks.length > 0) {
                const lm = results.faceLandmarks[0];
                const lm168 = lm[168]; // Nose bridge
                const lm33  = lm[33];  // Left eye outer corner
                const lm263 = lm[263]; // Right eye outer corner
                const lm1   = lm[1];   // Nose tip
                const lm10  = lm[10];  // Forehead top
                const lm152 = lm[152]; // Chin

                if (lm168 && lm33 && lm263) {
                  const aspect = videoWidth / videoHeight;
                  const fovRad = (63 * Math.PI) / 180;
                  const focalY = 0.5 / Math.tan(fovRad / 2);
                  const focalX = focalY / aspect;

                  // Use raw (un-mirrored) landmark x coordinates.
                  // Both <video> and <canvas> have CSS scaleX(-1) so mirroring
                  // is handled consistently at the display level.
                  const eyeDx   = lm263.x - lm33.x;
                  const eyeDy   = lm263.y - lm33.y;
                  const eyeDistNorm = Math.hypot(eyeDx, eyeDy);

                  // Outer eye-to-eye ≈ 0.095 m in adults → estimate depth
                  const depthMeters = Math.max(0.25, Math.min(2.5, (0.095 * focalX) / Math.max(0.01, eyeDistNorm)));
                  const z = -depthMeters;
                  const x = (lm168.x - 0.5) * (depthMeters / focalX);
                  const y = -(lm168.y - 0.5) * (depthMeters / focalY);

                  targetPos.set(x, y, z);

                  // Roll: from the slope of the inter-eye line
                  const roll = Math.atan2(-eyeDy, eyeDx);

                  // Yaw: how much the nose deviates from the eye midpoint
                  const midEyeX  = (lm33.x + lm263.x) / 2;
                  const halfSpan = Math.max(0.01, Math.abs(eyeDx) / 2);
                  const noseOffX = lm1 ? (lm1.x - midEyeX) / halfSpan : 0;
                  const yaw = Math.asin(Math.max(-0.95, Math.min(0.95, noseOffX))) * 1.3;

                  // Pitch: nose position within face height
                  if (lm1 && lm10 && lm152) {
                    const faceH = Math.max(0.01, lm152.y - lm10.y);
                    const noseYRatio = (lm1.y - lm10.y) / faceH;
                    const pitch = (noseYRatio - 0.6) * 1.5;
                    tempEuler.set(pitch, yaw, roll, 'YXZ');
                  } else {
                    tempEuler.set(0, yaw, roll, 'YXZ');
                  }

                  targetQuat.setFromEuler(tempEuler);
                  hasPose = true;

                  // In landmark mode, faceGroup is at LM168 in 3D, so offset is just fine-tuning
                  glassesHolder.position.set(0, userOffsetY, 0.008 + userOffsetZ);
                }
              }

              // ── Adaptive Face Scaling (Crucial for Mobile & Portrait) ──
              // On mobile portrait cameras, aspect ratios and focal length differences
              // cause uncalibrated 3D models to project much smaller than the human face.
              // We measure the face's actual temple-to-temple pixel width on screen, and
              // dynamically scale the glasses so they span naturally across the temples (1.05x).
              if (hasPose && results.faceLandmarks && results.faceLandmarks.length > 0) {
                const lm = results.faceLandmarks[0];
                const lm127 = lm[127]; // left temple
                const lm356 = lm[356]; // right temple
                const lm234 = lm[234]; // left cheekbone
                const lm454 = lm[454]; // right cheekbone
                const lm33  = lm[33];  // left eye outer corner
                const lm263 = lm[263]; // right eye outer corner

                const curVW = video.videoWidth || canvas.width || 1280;
                const curVH = video.videoHeight || canvas.height || 720;

                let facePixelWidth = 0;
                if (lm127 && lm356) {
                  facePixelWidth = Math.hypot(
                    (lm356.x - lm127.x) * curVW,
                    (lm356.y - lm127.y) * curVH
                  );
                } else if (lm234 && lm454) {
                  facePixelWidth = Math.hypot(
                    (lm454.x - lm234.x) * curVW,
                    (lm454.y - lm234.y) * curVH
                  ) * 1.05;
                } else if (lm33 && lm263) {
                  facePixelWidth = Math.hypot(
                    (lm263.x - lm33.x) * curVW,
                    (lm263.y - lm33.y) * curVH
                  ) * 1.74;
                }

                if (facePixelWidth > 15 && camera) {
                  const depthMeters = Math.max(0.15, -targetPos.z);
                  const fovRad = (camera.fov * Math.PI) / 180;
                  // Baseline projected pixel width of 0.14m glasses model at this depth:
                  const modelBasePixelWidth = (0.14 * curVH) / (depthMeters * 2 * Math.tan(fovRad / 2));
                  if (modelBasePixelWidth > 5) {
                    // Frame spans slightly past the temples (1.05x) for natural fit
                    const targetAutoScale = (facePixelWidth * 1.05) / modelBasePixelWidth;
                    const clampedAutoScale = Math.max(0.75, Math.min(3.5, targetAutoScale));
                    smoothedAutoScale = smoothedAutoScale * 0.82 + clampedAutoScale * 0.18;
                  }
                }
              }

              if (hasPose) {
                glassesHolder.scale.setScalar(smoothedAutoScale * userScale);

                // Smooth interpolation
                if (!hasFirstPose) {
                  currentPos.copy(targetPos);
                  currentQuat.copy(targetQuat);
                  hasFirstPose = true;
                } else {
                  currentPos.lerp(targetPos, 0.45);
                  currentQuat.slerp(targetQuat, 0.45);
                }

                // Apply pose to faceGroup
                faceGroup.position.copy(currentPos);
                faceGroup.quaternion.copy(currentQuat);
                faceGroup.scale.set(1, 1, 1);
                // Only render glasses when UI says it’s ready
                faceGroup.visible = glassesVisibleFlag;

                // ── Face analysis accumulation ────────────────────────────────
                // Collect landmark-derived face dimensions for 30 stable frames,
                // then classify face shape and fire onFaceAnalyzed once.
                if (!analysisFired && results.faceLandmarks && results.faceLandmarks.length > 0) {
                  const lm = results.faceLandmarks[0];
                  // Use normalised-coord distances (x/y are 0-1 across video dims).
                  // We just need aspect ratios, so absolute units don’t matter.
                  const lm234  = lm[234];  // left cheekbone
                  const lm454  = lm[454];  // right cheekbone
                  const lm10   = lm[10];   // forehead top
                  const lm152  = lm[152];  // chin bottom
                  const lm172  = lm[172];  // left jaw corner
                  const lm397  = lm[397];  // right jaw corner
                  const lm54   = lm[54];   // left temple / forehead width
                  const lm284  = lm[284];  // right temple

                  if (lm234 && lm454 && lm10 && lm152 && lm172 && lm397) {
                    // Cheek-to-cheek width (normalised)
                    const w = Math.hypot(lm454.x - lm234.x, lm454.y - lm234.y);
                    // Forehead-to-chin height (normalised)
                    const h = Math.hypot(lm152.x - lm10.x,  lm152.y - lm10.y);
                    // Jaw width (normalised)
                    const j = Math.hypot(lm397.x - lm172.x, lm397.y - lm172.y);

                    analysisWidthAcc  += w;
                    analysisHeightAcc += h;
                    analysisJawAcc    += j;
                    analysisFrameCount++;

                    if (analysisFrameCount >= 30) {
                      analysisFired = true;
                      const avgW = analysisWidthAcc  / 30;
                      const avgH = analysisHeightAcc / 30;
                      const avgJ = analysisJawAcc    / 30;

                      // Convert normalised widths to approximate cm.
                      // Average face cheek-width ≈ 14 cm → scale factor:
                      const CM_PER_NORM = 14.0 / avgW;
                      const widthCm  = 14.0;
                      const heightCm = Math.round(avgH * CM_PER_NORM * 10) / 10;
                      const jawCm    = Math.round(avgJ * CM_PER_NORM * 10) / 10;

                      // Face shape classification
                      const ratio = heightCm / widthCm; // height / cheek-width
                      const jawRatio = jawCm / widthCm;
                      let shape: FaceMeasurements['shape'];
                      if (ratio > 1.45) {
                        shape = 'Oblong';
                      } else if (ratio > 1.25) {
                        // Tall: Oval if jaw tapers, Square if jaw ≈ cheeks
                        shape = jawRatio > 0.88 ? 'Square' : 'Oval';
                      } else {
                        // Shorter: Round vs Heart
                        shape = jawRatio < 0.78 ? 'Heart' : 'Round';
                      }

                      if (engine.onFaceAnalyzed) {
                        engine.onFaceAnalyzed({ widthCm, heightCm, jawCm, shape });
                      }
                    }
                  }
                }

                if (engine.onMetricsUpdate) {
                  tempEuler.setFromQuaternion(currentQuat, 'YXZ');
                  engine.onMetricsUpdate({
                    detected: true,
                    yaw:      (tempEuler.y * 180) / Math.PI,
                    pitch:    (tempEuler.x * 180) / Math.PI,
                    roll:     (tempEuler.z * 180) / Math.PI,
                    distance: currentPos.length(),
                  });
                }
              } else {
                faceGroup.visible = false;
                hasFirstPose = false;
                if (engine.onMetricsUpdate) {
                  engine.onMetricsUpdate({ detected: false });
                }
              }
            } catch (err) {
              console.warn('MediaPipe detect warning:', err);
            }
          }

          renderer.render(scene, camera);
        }

        animFrameId = requestAnimationFrame(renderFrame);
      };

      animFrameId = requestAnimationFrame(renderFrame);
    },

    stop(): void {
      isRunning = false;
      hasFirstPose = false;
      analysisFrameCount = 0;
      analysisWidthAcc   = 0;
      analysisHeightAcc  = 0;
      analysisJawAcc     = 0;
      analysisFired      = false;
      glassesVisibleFlag = false;

      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }

      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }

      if (faceLandmarker) {
        faceLandmarker.close();
        faceLandmarker = null;
      }

      if (renderer) {
        renderer.dispose();
        renderer = null;
      }

      if (scene) {
        scene.clear();
        scene = null;
      }

      faceGroup = null;
      glassesHolder = null;
      glassesMesh = null;
      customFrameMesh = null;
      camera = null;
      lastVideoTime = -1;
    },

    async setFrame(frame: Frame): Promise<void> {
      activeFrame = frame;
      if (!glassesHolder) {
        return;
      }

      try {
        let loadedModel: THREE.Group;
        if (frameCache.has(frame.model)) {
          loadedModel = frameCache.get(frame.model)!.clone();
        } else {
          const gltf = await gltfLoader.loadAsync(frame.model);
          frameCache.set(frame.model, gltf.scene);
          loadedModel = gltf.scene.clone();
        }

        // Auto-scale the model so its face width (ear-to-ear, size.x) is 0.14 m (14 cm)
        const bbox = new THREE.Box3().setFromObject(loadedModel);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const frameWidth = Math.max(size.x, 0.001);
        const TARGET_GLASSES_WIDTH = 0.14; // 14 cm adult face width
        const modelScale = TARGET_GLASSES_WIDTH / frameWidth;
        loadedModel.scale.set(modelScale, modelScale, modelScale);

        // Update bbox after scaling
        bbox.setFromObject(loadedModel);
        const centerOffset = new THREE.Vector3();
        bbox.getCenter(centerOffset);

        // Symmetrically center horizontally (X) and vertically (Y)
        loadedModel.position.x = -centerOffset.x;
        loadedModel.position.y = -centerOffset.y;

        // CRITICAL: Do NOT center Z!
        // Glasses models have temple arms extending back to z ≈ -0.14 m, while
        // the front bridge is at z ≈ 0. Centering Z shifts the front bridge forward
        // by ~7 cm into mid-air!
        // Instead, anchor the front bridge to z = 0 (aligned with nose bridge).
        loadedModel.position.z = -bbox.max.z + 0.002;

        // Enhance materials
        loadedModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (mesh.material) {
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              mats.forEach((m) => {
                m.side = THREE.DoubleSide;
                const matName = (m.name || '').toLowerCase();
                const isLens = matName.includes('lens') || matName.includes('glass') ||
                  (m instanceof THREE.MeshStandardMaterial && m.transparent && m.opacity < 0.9);
                if (isLens) {
                  m.transparent = true;
                  m.opacity = 0.5;
                  if (m instanceof THREE.MeshStandardMaterial) {
                    m.roughness = 0.04;
                    m.metalness = 0.0;
                  }
                } else if (m instanceof THREE.MeshStandardMaterial) {
                  m.roughness = Math.min(m.roughness + 0.05, 0.35);
                  m.metalness = Math.max(m.metalness, 0.65);
                  m.envMapIntensity = 1.2;
                }
                m.needsUpdate = true;
              });
            }
          }
        });

        // Swap
        while (glassesHolder.children.length > 0) {
          glassesHolder.remove(glassesHolder.children[0]);
        }

        customFrameMesh = loadedModel;
        glassesHolder.add(customFrameMesh);
      } catch (err) {
        console.warn('Failed to load frame model GLB, using stub glasses:', err);
        if (glassesHolder) {
          while (glassesHolder.children.length > 0) {
            glassesHolder.remove(glassesHolder.children[0]);
          }
          glassesMesh = createStubGlasses();
          glassesHolder.add(glassesMesh);
        }
      }
    },

    getActiveFrame(): Frame | null {
      return activeFrame;
    },

    /**
     * Adjust glasses size. scale=1.0 is auto-detected size.
     * Range: 0.7 – 1.4
     */
    setScaleOffset(scale: number): void {
      userScale = Math.max(0.7, Math.min(1.4, scale));
    },

    /**
     * Shift glasses up/down along the nose bridge.
     * Positive = up, negative = down. Units: meters.
     * Range: -0.03 – +0.03
     */
    setHeightOffset(offsetY: number): void {
      userOffsetY = Math.max(-0.03, Math.min(0.03, offsetY));
      if (glassesHolder) {
        glassesHolder.position.y = NOSE_BRIDGE_CANONICAL.y + userOffsetY;
      }
    },

    /**
     * Push glasses toward/away from face.
     * Positive = forward, negative = deeper.
     * Range: -0.02 – +0.02
     */
    setDepthOffset(offsetZ: number): void {
      userOffsetZ = Math.max(-0.02, Math.min(0.02, offsetZ));
      if (glassesHolder) {
        glassesHolder.position.z = NOSE_BRIDGE_CANONICAL.z + userOffsetZ;
      }
    },

    setGlassesVisible(visible: boolean): void {
      glassesVisibleFlag = visible;
      // Immediately apply if faceGroup already exists
      if (faceGroup) {
        faceGroup.visible = visible && hasFirstPose;
      }
    },
  };

  return engine;
}
