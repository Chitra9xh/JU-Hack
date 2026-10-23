import * as THREE from 'three';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import type { Frame, TryOnEngine } from '../../../shared/types';

export interface TryOnEngineExtended extends TryOnEngine {
  onMetricsUpdate?: (metrics: {
    detected: boolean;
    yaw?: number;
    pitch?: number;
    roll?: number;
    distance?: number;
  }) => void;
}

/**
 * Creates a procedural stub glasses mesh conforming to the project contract:
 * - Origin at nose-bridge midpoint
 * - +Y up, +Z toward the viewer, -Z toward the temples/ears
 * - 1 unit = 1 meter
 * - Real width = ~0.14 m
 */
function createStubGlasses(): THREE.Group {
  const glasses = new THREE.Group();
  glasses.name = 'stub-glasses';

  // Dark metallic frame material
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    metalness: 0.85,
    roughness: 0.25,
  });

  // Transparent lens material
  const lensMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 0.9,
    opacity: 1,
    transparent: true,
    roughness: 0.08,
    ior: 1.52,
  });

  // 1. Nose bridge connecting the two rims
  // Centered at (0, 0, 0), length = 0.024m
  const bridgeGeo = new THREE.CylinderGeometry(0.002, 0.002, 0.024, 16);
  bridgeGeo.rotateZ(Math.PI / 2);
  const bridge = new THREE.Mesh(bridgeGeo, frameMaterial);
  bridge.position.set(0, 0.001, 0);
  glasses.add(bridge);

  // Nose pads
  const padGeo = new THREE.BoxGeometry(0.002, 0.007, 0.004);
  const leftPad = new THREE.Mesh(padGeo, frameMaterial);
  leftPad.position.set(-0.011, -0.006, -0.005);
  const rightPad = new THREE.Mesh(padGeo, frameMaterial);
  rightPad.position.set(0.011, -0.006, -0.005);
  glasses.add(leftPad, rightPad);

  // 2. Left & Right rims and lenses
  // Rim radius: 0.025m (diameter 0.05m), tube: 0.0022m
  // Centers at x = -0.038m and x = +0.038m
  // Total width: ~0.136m - 0.14m
  const rimRadius = 0.025;
  const tubeRadius = 0.0022;
  const rimGeo = new THREE.TorusGeometry(rimRadius, tubeRadius, 16, 36);

  const lensGeo = new THREE.CylinderGeometry(rimRadius - 0.0006, rimRadius - 0.0006, 0.001, 32);
  lensGeo.rotateX(Math.PI / 2);

  // Left Rim & Lens
  const leftRim = new THREE.Mesh(rimGeo, frameMaterial);
  leftRim.position.set(-0.038, 0, 0);
  const leftLens = new THREE.Mesh(lensGeo, lensMaterial);
  leftLens.position.set(-0.038, 0, 0);
  glasses.add(leftRim, leftLens);

  // Right Rim & Lens
  const rightRim = new THREE.Mesh(rimGeo, frameMaterial);
  rightRim.position.set(0.038, 0, 0);
  const rightLens = new THREE.Mesh(lensGeo, lensMaterial);
  rightLens.position.set(0.038, 0, 0);
  glasses.add(rightRim, rightLens);

  // 3. Temples / Arms (extend back along -Z toward the ears)
  const templeLength = 0.11;
  const templeGeo = new THREE.CylinderGeometry(0.0018, 0.0014, templeLength, 12);
  templeGeo.rotateX(Math.PI / 2);

  const leftTemple = new THREE.Mesh(templeGeo, frameMaterial);
  leftTemple.position.set(-0.064, 0.002, -templeLength / 2);
  const rightTemple = new THREE.Mesh(templeGeo, frameMaterial);
  rightTemple.position.set(0.064, 0.002, -templeLength / 2);
  glasses.add(leftTemple, rightTemple);

  return glasses;
}

/**
 * Converts MediaPipe 4x4 facial transformation matrix to Three.js camera coordinate frame.
 *
 * MediaPipe camera space: X right, Y down, Z away from camera (OpenCV convention).
 * Three.js camera space: X right, Y up, Z towards viewer (OpenGL convention).
 * Change of basis: C = diag(1, -1, -1) applied to MediaPipe coordinates.
 * R_three = C * R, T_three = C * T.
 */
function parseMediaPipeMatrix(data: number[], outMatrix: THREE.Matrix4): void {
  // Determine if matrix data is stored in row-major or column-major layout:
  // In a 4x4 affine transform, row 3 is [0, 0, 0, 1].
  // If row-major: data[12..14] are 0, translation is data[3, 7, 11].
  // If column-major: data[3, 7, 11] are 0, translation is data[12..14].
  let m00: number, m01: number, m02: number, tx: number;
  let m10: number, m11: number, m12: number, ty: number;
  let m20: number, m21: number, m22: number, tz: number;

  const isRowMajor =
    Math.abs(data[12]) < 1e-4 &&
    Math.abs(data[13]) < 1e-4 &&
    Math.abs(data[14]) < 1e-4 &&
    (Math.abs(data[3]) > 1e-4 || Math.abs(data[7]) > 1e-4 || Math.abs(data[11]) > 1e-4);

  if (isRowMajor) {
    m00 = data[0]; m01 = data[1]; m02 = data[2]; tx = data[3];
    m10 = data[4]; m11 = data[5]; m12 = data[6]; ty = data[7];
    m20 = data[8]; m21 = data[9]; m22 = data[10]; tz = data[11];
  } else {
    m00 = data[0]; m01 = data[4]; m02 = data[8];  tx = data[12];
    m10 = data[1]; m11 = data[5]; m12 = data[9];  ty = data[13];
    m20 = data[2]; m21 = data[6]; m22 = data[10]; tz = data[14];
  }

  // MediaPipe coordinates are natively in centimeters.
  // Convert translation to meters for Three.js:
  const dist = Math.sqrt(tx * tx + ty * ty + tz * tz);
  let scale = 0.01; // cm -> meters
  if (dist > 200) {
    scale = 0.001; // mm -> meters
  } else if (dist < 3) {
    scale = 1.0; // already in meters
  }

  // Construct Three.js column-major matrix with basis change C = diag(1, -1, -1):
  const e = outMatrix.elements;

  // Column 0
  e[0] = m00;
  e[1] = -m10;
  e[2] = -m20;
  e[3] = 0;

  // Column 1
  e[4] = m01;
  e[5] = -m11;
  e[6] = -m21;
  e[7] = 0;

  // Column 2
  e[8] = m02;
  e[9] = -m12;
  e[10] = -m22;
  e[11] = 0;

  // Column 3 (Translation in meters)
  e[12] = tx * scale;
  e[13] = -ty * scale;
  e[14] = -tz * scale;
  e[15] = 1;
}

export function createTryOnEngine(): TryOnEngineExtended {
  let mediaStream: MediaStream | null = null;
  let faceLandmarker: FaceLandmarker | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let faceGroup: THREE.Group | null = null;
  let glassesMesh: THREE.Group | null = null;
  let animFrameId: number | null = null;
  let isRunning = false;
  let lastVideoTime = -1;

  // Pose smoothing vectors
  let hasFirstPose = false;
  const targetMatrix = new THREE.Matrix4();
  const targetPos = new THREE.Vector3();
  const targetQuat = new THREE.Quaternion();
  const targetScale = new THREE.Vector3();

  const currentPos = new THREE.Vector3();
  const currentQuat = new THREE.Quaternion();
  const tempEuler = new THREE.Euler(0, 0, 0, 'YXZ');

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
      await video.play();

      // Wait until video has loaded actual dimensions
      await new Promise<void>((resolve) => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          resolve();
        } else {
          video.onloadeddata = () => resolve();
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
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      // 3. Initialize Three.js scene and perspective camera
      scene = new THREE.Scene();

      // Camera FOV ~63° matches MediaPipe canonical pinhole projection
      camera = new THREE.PerspectiveCamera(63, videoWidth / videoHeight, 0.01, 50);
      camera.position.set(0, 0, 0);

      // Natural studio lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
      keyLight.position.set(0, 1.5, 2);
      const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.7);
      fillLight.position.set(-1.5, -0.5, 1);
      scene.add(ambientLight, keyLight, fillLight);

      // Root face group (tracks head pose in camera space)
      faceGroup = new THREE.Group();
      faceGroup.visible = false;

      // Procedural stub glasses
      glassesMesh = createStubGlasses();
      // Landmark 168 (nose bridge midpoint) in MediaPipe canonical face model:
      // X = 0, Y = +3.27 cm (+0.0327m), Z = +5.24 cm (+0.0524m)
      glassesMesh.position.set(0, 0.0327, 0.0524);
      faceGroup.add(glassesMesh);
      scene.add(faceGroup);

      // WebGL Renderer
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(videoWidth, videoHeight, false);

      isRunning = true;
      hasFirstPose = false;

      // 4. Video & tracking loop
      const renderFrame = () => {
        if (!isRunning) return;

        if (
          video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          video.currentTime !== lastVideoTime &&
          faceLandmarker &&
          renderer &&
          scene &&
          camera &&
          faceGroup
        ) {
          lastVideoTime = video.currentTime;
          const timestamp = performance.now();
          const results = faceLandmarker.detectForVideo(video, timestamp);

          if (
            results.facialTransformationMatrixes &&
            results.facialTransformationMatrixes.length > 0
          ) {
            const rawMatrix = results.facialTransformationMatrixes[0].data;
            parseMediaPipeMatrix(rawMatrix, targetMatrix);
            targetMatrix.decompose(targetPos, targetQuat, targetScale);

            // Smooth tracking across frames (lerp/slerp)
            if (!hasFirstPose) {
              currentPos.copy(targetPos);
              currentQuat.copy(targetQuat);
              hasFirstPose = true;
            } else {
              currentPos.lerp(targetPos, 0.6);
              currentQuat.slerp(targetQuat, 0.6);
            }

            faceGroup.position.copy(currentPos);
            faceGroup.quaternion.copy(currentQuat);
            faceGroup.visible = true;

            // Optional metrics reporting for dev harness
            if (engine.onMetricsUpdate) {
              tempEuler.setFromQuaternion(currentQuat, 'YXZ');
              engine.onMetricsUpdate({
                detected: true,
                yaw: (tempEuler.y * 180) / Math.PI,
                pitch: (tempEuler.x * 180) / Math.PI,
                roll: (tempEuler.z * 180) / Math.PI,
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

          renderer.render(scene, camera);
        }

        animFrameId = requestAnimationFrame(renderFrame);
      };

      animFrameId = requestAnimationFrame(renderFrame);
    },

    stop(): void {
      isRunning = false;
      hasFirstPose = false;

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
      glassesMesh = null;
      camera = null;
      lastVideoTime = -1;
    },

    async setFrame(_frame: Frame): Promise<void> {
      // Step 1: procedural stub frame only. Real GLB loading is deferred to Step 2 (#6/Issue roadmap).
    },
  };

  return engine;
}
