import * as THREE from 'three';

/**
 * Creates an elegant, semi-transparent human figure silhouette (1.75m / 5'9")
 * for instant real-world scale comparison beside furniture.
 */
export function createHumanSilhouette(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'human-silhouette';

  const mat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.45,
    roughness: 0.3,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });

  const wireMat = new THREE.LineBasicMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.8,
  });

  // Head (center at y = 1.63 m)
  const headGeo = new THREE.SphereGeometry(0.11, 24, 24);
  const head = new THREE.Mesh(headGeo, mat);
  head.position.y = 1.63;
  group.add(head);

  // Neck + Torso (y = 0.90 to 1.50 m)
  const torsoGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.65, 24);
  const torso = new THREE.Mesh(torsoGeo, mat);
  torso.position.y = 1.20;
  group.add(torso);

  // Shoulders / upper chest curve
  const shoulderGeo = new THREE.CapsuleGeometry(0.14, 0.18, 8, 16);
  shoulderGeo.rotateZ(Math.PI / 2);
  const shoulders = new THREE.Mesh(shoulderGeo, mat);
  shoulders.position.y = 1.44;
  group.add(shoulders);

  // Left Leg (y = 0 to 0.88 m)
  const legGeo = new THREE.CylinderGeometry(0.065, 0.05, 0.88, 16);
  const leftLeg = new THREE.Mesh(legGeo, mat);
  leftLeg.position.set(-0.11, 0.44, 0);
  group.add(leftLeg);

  // Right Leg
  const rightLeg = new THREE.Mesh(legGeo, mat);
  rightLeg.position.set(0.11, 0.44, 0);
  group.add(rightLeg);

  // Stylized base ring
  const baseRingGeo = new THREE.RingGeometry(0.24, 0.26, 32);
  baseRingGeo.rotateX(-Math.PI / 2);
  const baseRing = new THREE.Mesh(baseRingGeo, wireMat);
  baseRing.position.y = 0.002;
  group.add(baseRing);

  return group;
}

/**
 * Creates dimension wireframe box with corner brackets and measurement guides.
 */
export function createDimensionBox(w: number, h: number, d: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'dimension-box';

  const boxGeo = new THREE.BoxGeometry(w, h, d);
  const edges = new THREE.EdgesGeometry(boxGeo);
  const lineMat = new THREE.LineDashedMaterial({
    color: 0xd5fa9c,
    dashSize: 0.05,
    gapSize: 0.03,
    linewidth: 1,
    transparent: true,
    opacity: 0.75,
  });

  const line = new THREE.LineSegments(edges, lineMat);
  line.computeLineDistances();
  line.position.y = h / 2;
  group.add(line);

  // Corner accent points
  const cornerMat = new THREE.MeshBasicMaterial({ color: 0xd5fa9c });
  const cornerGeo = new THREE.SphereGeometry(0.015, 8, 8);
  const xs = [-w / 2, w / 2];
  const ys = [0, h];
  const zs = [-d / 2, d / 2];

  xs.forEach((x) => {
    ys.forEach((y) => {
      zs.forEach((z) => {
        const dot = new THREE.Mesh(cornerGeo, cornerMat);
        dot.position.set(x, y, z);
        group.add(dot);
      });
    });
  });

  return group;
}

/**
 * Custom upholstery colors for furniture models.
 */
export const UPHOLSTERY_FINISHES = [
  { id: 'original', name: 'Original', hex: null },
  { id: 'mango', name: 'Mango Gold', hex: 0xe59b20 },
  { id: 'navy', name: 'Midnight Navy', hex: 0x1d3557 },
  { id: 'emerald', name: 'Emerald Velvet', hex: 0x1f5438 },
  { id: 'terracotta', name: 'Terracotta', hex: 0xb4533c },
  { id: 'charcoal', name: 'Charcoal Noir', hex: 0x222629 },
];

/**
 * Applies a custom color to the primary fabric/upholstery meshes of a 3D model.
 */
export function applyUpholsteryColor(model: THREE.Object3D, hexColor: number | null): void {
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
            // Save original color on userData if not already saved
            if (mat.userData.origColor === undefined) {
              mat.userData.origColor = mat.color.getHex();
            }

            if (hexColor !== null) {
              // Tint non-metallic, fabric-like meshes (skip chrome legs, glass)
              if (mat.metalness < 0.5) {
                mat.color.setHex(hexColor);
                mat.needsUpdate = true;
              }
            } else if (mat.userData.origColor !== undefined) {
              mat.color.setHex(mat.userData.origColor as number);
              mat.needsUpdate = true;
            }
          }
        });
      }
    }
  });
}
