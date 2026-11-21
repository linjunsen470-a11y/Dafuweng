import * as THREE from 'three';
import { createPropertyBadgeSprite, createVacantSignboard } from './PropertyBadges.js';

function addBox(parent, w, h, d, mat, x, y, z, shadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  parent.add(mesh);
  return mesh;
}

function addWindowsGrid(parent, floors, width, startY, stepY, zFront, mat) {
  const cols = width >= 2.3 ? [-0.72, 0, 0.72] : [-0.48, 0.48];
  for (let f = 0; f < floors; f++) {
    const y = startY + f * stepY;
    for (const x of cols) {
      const win = addBox(parent, 0.34, 0.36, 0.06, mat, x, y, zFront, false);
      win.userData.isWindow = true;
      const backWin = addBox(parent, 0.34, 0.36, 0.06, mat, x, y, -zFront, false);
      backWin.userData.isWindow = true;
    }
  }
}

function addOwnerFlag(parent, ownerColor, x, baseY, z, height = 1.55) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, height, 8),
    new THREE.MeshStandardMaterial({ color: '#fff4d2', metalness: 0.25, roughness: 0.4 })
  );
  pole.position.set(x, baseY + height * 0.5, z);
  pole.userData.isOwnerBeacon = true;
  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshStandardMaterial({ color: '#ffd447', metalness: 0.6, roughness: 0.25 })
  );
  finial.position.set(x, baseY + height + 0.04, z);
  finial.userData.isOwnerBeacon = true;

  const pennant = new THREE.Shape();
  pennant.moveTo(0, 0);
  pennant.lineTo(0.88, -0.22);
  pennant.lineTo(0, -0.48);
  pennant.closePath();
  const flag = new THREE.Mesh(
    new THREE.ShapeGeometry(pennant),
    new THREE.MeshBasicMaterial({ color: ownerColor, side: THREE.DoubleSide })
  );
  flag.position.set(x + 0.03, baseY + height - 0.06, z);
  flag.userData.isOwnerBeacon = true;
  parent.add(pole, finial, flag);
}

// Clean, joyful Richman-4 vacant lot with green lawn/plaza, white corner fence, and wooden FOR SALE sign.
export function buildRichVacantLot(tile, districtColor) {
  const group = new THREE.Group();
  const isBig = Boolean(tile.large);
  const w = isBig ? 4.1 : 3.15;
  const d = isBig ? 3.35 : 3.05;

  const baseMat = new THREE.MeshStandardMaterial({
    color: isBig ? '#ebdcb9' : '#96cf6e',
    roughness: 0.85
  });
  const base = addBox(group, w, 0.14, d, baseMat, 0, 0.07, 0, false);
  base.receiveShadow = true;

  // Crisp district-colored lot edging
  const trimMat = new THREE.MeshStandardMaterial({ color: districtColor || '#e2a13f', roughness: 0.48 });
  addBox(group, w + 0.12, 0.09, 0.12, trimMat, 0, 0.13, d * 0.5, false);
  addBox(group, w + 0.12, 0.09, 0.12, trimMat, 0, 0.13, -d * 0.5, false);
  addBox(group, 0.12, 0.09, d, trimMat, w * 0.5, 0.13, 0, false);
  addBox(group, 0.12, 0.09, d, trimMat, -w * 0.5, 0.13, 0, false);

  // Cute white picket corners & corner bushes
  const fenceMat = new THREE.MeshStandardMaterial({ color: '#fff8e8', roughness: 0.6 });
  const bushMat = new THREE.MeshStandardMaterial({ color: '#4caf50', roughness: 0.78 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(group, 0.12, 0.42, 0.12, fenceMat, sx * (w * 0.43), 0.28, sz * (d * 0.43));
      const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), bushMat);
      bush.position.set(sx * (w * 0.34), 0.26, sz * (d * 0.34));
      group.add(bush);
    }
  }

  // Prominent tilted wooden signboard showing district color + price
  const sign = createVacantSignboard(tile, districtColor);
  sign.position.set(0, 0.12, 0.12);
  group.add(sign);
  return group;
}

// Builds unmistakable Richman-4 level 0..5 residential & commercial structures.
export function buildRichPropertyStructure({ level, ownerColor, buildingType, large }) {
  const group = new THREE.Group();
  const accent = new THREE.Color(ownerColor ?? '#ffaa00');
  const roofMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.34, metalness: 0.08 });
  const creamWall = new THREE.MeshStandardMaterial({ color: '#fff8ea', roughness: 0.48 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#f3d7a0', roughness: 0.52 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#8f5932', roughness: 0.7 });
  const windowMat = new THREE.MeshStandardMaterial({
    color: '#dff6ff',
    emissive: '#ffd269',
    emissiveIntensity: 0.35,
    roughness: 0.18
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#67d8f7',
    roughness: 0.1,
    metalness: 0.15,
    clearcoat: 0.85,
    emissive: '#0e526b',
    emissiveIntensity: 0.25
  });

  let topHeight = 1.6;

  if (buildingType === 'PARK') {
    const lawn = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.85, 0.22, 24), new THREE.MeshStandardMaterial({ color: '#58c95d', roughness: 0.8 }));
    lawn.position.y = 0.22;
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.34, 20), trimMat);
    basin.position.y = 0.44;
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 20), glassMat);
    water.position.y = 0.62;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.9, 12), roofMat);
    spire.position.y = 1.05;
    group.add(lawn, basin, water, spire);
    const leafMat = new THREE.MeshStandardMaterial({ color: '#2ea44f', roughness: 0.72 });
    for (const [tx, tz] of [[-1.15, -0.75], [1.15, -0.75], [-1.05, 0.82], [1.05, 0.82]]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.72, 8), woodMat);
      trunk.position.set(tx, 0.64, tz);
      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.46, 1), leafMat);
      crown.position.set(tx, 1.18, tz);
      crown.castShadow = true;
      group.add(trunk, crown);
    }
    topHeight = 2.05;
  } else if (buildingType === 'GAS_STATION') {
    addBox(group, 3.6, 0.34, 2.5, roofMat, 0, 2.15, 0);
    addBox(group, 3.74, 0.14, 2.64, trimMat, 0, 2.36, 0);
    for (const x of [-1.45, 1.45]) {
      addBox(group, 0.24, 1.95, 0.24, creamWall, x, 1.1, 0);
    }
    for (const x of [-0.65, 0.65]) {
      addBox(group, 0.48, 1.12, 0.56, creamWall, x, 0.68, 0.18);
      addBox(group, 0.34, 0.32, 0.08, roofMat, x, 0.92, 0.48, false);
    }
    addBox(group, 2.6, 0.65, 0.9, creamWall, 0, 0.48, -0.82);
    topHeight = 2.6;
  } else if (buildingType === 'MALL' || buildingType === 'HOTEL' || buildingType === 'LAB') {
    const height = (buildingType === 'HOTEL' ? 2.4 : buildingType === 'LAB' ? 2.0 : 1.7) + Math.max(1, level) * 0.78;
    const bw = large ? 3.55 : 2.7;
    const bd = large ? 2.65 : 2.3;
    addBox(group, bw, height, bd, creamWall, 0, height * 0.5 + 0.14, 0);
    addBox(group, bw + 0.16, 0.26, bd + 0.16, roofMat, 0, height + 0.24, 0);
    addBox(group, bw * 0.84, Math.max(0.9, height - 0.65), 0.12, glassMat, 0, height * 0.5 + 0.22, bd * 0.5 + 0.03, false);
    // Entrance awning
    addBox(group, 1.45, 0.16, 0.68, roofMat, 0, 0.96, bd * 0.5 + 0.32);
    addBox(group, 0.9, 0.82, 0.08, woodMat, 0, 0.55, bd * 0.5 + 0.03, false);
    if (buildingType === 'HOTEL') {
      const crown = addBox(group, bw * 0.66, 0.72, bd * 0.66, roofMat, 0, height + 0.7, 0);
      crown.castShadow = true;
      topHeight = height + 1.25;
    } else if (buildingType === 'LAB') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.92, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
      dome.position.set(0, height + 0.34, 0);
      const rotor = new THREE.Group();
      rotor.position.set(0, height + 1.35, 0);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8), trimMat);
      const dish = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 8, 18), new THREE.MeshBasicMaterial({ color: '#ffd447' }));
      dish.position.set(0.18, 0.45, 0);
      rotor.add(mast, dish);
      group.add(dome, rotor);
      group.userData.rotor = rotor;
      topHeight = height + 2.0;
    } else {
      addOwnerFlag(group, ownerColor, bw * 0.36, height + 0.34, 0, 1.25);
      topHeight = height + 1.55;
    }
  } else if (buildingType === 'CHAIN_STORE') {
    addBox(group, 2.45, 1.65, 2.2, creamWall, 0, 0.96, 0);
    addBox(group, 2.66, 0.34, 2.4, roofMat, 0, 1.94, 0);
    addBox(group, 2.2, 0.22, 0.58, roofMat, 0, 1.24, 1.24);
    addBox(group, 1.85, 0.85, 0.08, glassMat, 0, 0.65, 1.12, false);
    topHeight = 2.35;
  } else if (level === 0) {
    // Purchased vacant plot: crisp white wooden corral fence + tall waving owner triangle flag
    const fenceMat = new THREE.MeshStandardMaterial({ color: '#fff9ea', roughness: 0.52 });
    for (const side of [-1, 1]) {
      addBox(group, 0.1, 0.1, 2.35, fenceMat, side * 1.22, 0.42, 0, false);
      addBox(group, 2.35, 0.1, 0.1, fenceMat, 0, 0.42, side * 1.22, false);
    }
    addOwnerFlag(group, ownerColor, 0, 0.16, 0, 1.95);
    topHeight = 2.15;
  } else if (level === 1) {
    // Lv.1 Cute cartoon cottage
    addBox(group, 2.15, 1.38, 2.05, creamWall, 0, 0.83, 0);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.05, 4), roofMat);
    roof.position.y = 2.02;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    addBox(group, 0.32, 0.64, 0.32, new THREE.MeshStandardMaterial({ color: '#d9534f', roughness: 0.6 }), 0.58, 2.08, -0.35);
    addBox(group, 0.62, 0.78, 0.08, woodMat, 0, 0.54, 1.04, false);
    addBox(group, 0.92, 0.14, 0.42, roofMat, 0, 1.02, 1.16);
    addWindowsGrid(group, 1, 2.0, 0.92, 0.8, 1.04, windowMat);
    topHeight = 2.65;
  } else if (level === 2) {
    // Lv.2 Two-story garden villa with balcony
    addBox(group, 2.35, 1.32, 2.25, creamWall, 0, 0.8, 0);
    addBox(group, 2.48, 0.14, 2.38, trimMat, 0, 1.5, 0);
    addBox(group, 2.05, 1.22, 1.98, creamWall, 0, 2.16, -0.08);
    addBox(group, 1.55, 0.34, 0.46, trimMat, 0, 1.72, 1.05);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.68, 1.12, 4), roofMat);
    roof.position.set(0, 3.32, -0.08);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    addBox(group, 0.62, 0.82, 0.08, woodMat, 0, 0.56, 1.14, false);
    addWindowsGrid(group, 2, 2.1, 0.92, 1.22, 1.14, windowMat);
    topHeight = 3.95;
  } else if (level === 3) {
    // Lv.3 Three-story boutique townhouse with roof terrace & owner flag
    addBox(group, 2.48, 3.45, 2.38, creamWall, 0, 1.86, 0);
    for (const y of [1.28, 2.42, 3.58]) addBox(group, 2.64, 0.16, 2.54, roofMat, 0, y, 0);
    addBox(group, 1.72, 0.58, 1.65, trimMat, 0, 3.92, 0);
    addBox(group, 1.05, 0.16, 0.54, roofMat, 0, 1.06, 1.34);
    addBox(group, 0.72, 0.88, 0.08, woodMat, 0, 0.58, 1.21, false);
    addWindowsGrid(group, 3, 2.45, 0.88, 1.02, 1.21, windowMat);
    addOwnerFlag(group, ownerColor, 0.65, 4.18, 0, 1.15);
    topHeight = 5.15;
  } else if (level === 4) {
    // Lv.4 High-rise business tower with glass curtain wall & crown
    addBox(group, 2.58, 4.95, 2.48, creamWall, 0, 2.62, 0);
    addBox(group, 2.68, 4.35, 1.92, glassMat, 0, 2.66, 0, false);
    addBox(group, 1.92, 4.35, 2.58, glassMat, 0, 2.66, 0, false);
    addBox(group, 2.74, 0.24, 2.64, roofMat, 0, 5.14, 0);
    addBox(group, 1.88, 0.78, 1.82, roofMat, 0, 5.62, 0);
    addBox(group, 1.4, 0.14, 1.4, new THREE.MeshStandardMaterial({ color: '#ffd447', metalness: 0.6, roughness: 0.2 }), 0, 6.08, 0);
    topHeight = 6.35;
  } else {
    // Lv.5 Grand Richman-4 Landmark Skyscraper with golden stepped crown & spire!
    addBox(group, 2.72, 3.8, 2.64, creamWall, 0, 2.04, 0);
    addBox(group, 2.8, 3.4, 2.05, glassMat, 0, 2.08, 0, false);
    addBox(group, 2.25, 2.35, 2.2, creamWall, 0, 5.08, 0);
    addBox(group, 2.34, 2.0, 1.72, glassMat, 0, 5.1, 0, false);
    addBox(group, 2.42, 0.24, 2.36, roofMat, 0, 6.3, 0);
    const goldMat = new THREE.MeshStandardMaterial({ color: '#ffca28', metalness: 0.72, roughness: 0.22, emissive: '#945a00', emissiveIntensity: 0.25 });
    addBox(group, 1.62, 0.75, 1.62, roofMat, 0, 6.76, 0);
    addBox(group, 1.24, 0.28, 1.24, goldMat, 0, 7.22, 0);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 1.35, 8), goldMat);
    spire.position.y = 7.98;
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), new THREE.MeshBasicMaterial({ color: '#fff3a1' }));
    beacon.position.y = 8.72;
    beacon.userData.isBeacon = true;
    group.add(spire, beacon);
    topHeight = 8.8;
  }

  group.add(createPropertyBadgeSprite(ownerColor, level, buildingType, topHeight));
  return group;
}

export function decorateOriginalBuilding(group, model, { level, ownerColor, buildingType, large }) {
  // Progressive skyline escalation so Lv.1 < Lv.2 < Lv.3 < Lv.4 < Lv.5 reads clearly at a glance.
  const levels = [[1, 1], [0.98, 1], [1.04, 1.08], [1.12, 1.38], [1.18, 1.48], [1.24, 1.62]];
  const [sx, sy] = buildingType && buildingType !== 'RESIDENTIAL'
    ? [large ? 1.14 : 1.06, large ? 1.18 : 1.08]
    : (levels[Math.min(5, Math.max(0, level))] || [1, 1]);
  model.scale.set(model.scale.x * sx, model.scale.y * sy, model.scale.z * sx);

  if (ownerColor != null) {
    const ownerTint = new THREE.Color(ownerColor);
    const roofMaterials = new Set(['roof', 'coral', 'brick', 'teal', 'sea', 'terracotta', 'awning', 'trim', 'accent']);
    model.traverse(mesh => {
      if (!mesh.isMesh) return;
      for (const mat of [].concat(mesh.material)) {
        if (!mat?.color) continue;
        const name = (mat.name || '').toLowerCase();
        if (roofMaterials.has(name) || /roof|tile|awning/.test(name)) mat.color.lerp(ownerTint, 0.58);
      }
    });
  }

  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const topY = Number.isFinite(box.max.y) ? Math.max(2.1, box.max.y) : 2.6 + level * 0.9;
  if (ownerColor != null) {
    addOwnerFlag(group, ownerColor, large ? 1.2 : 0.82, topY - 0.12, 0, level >= 4 ? 1.25 : 0.96);
    group.add(createPropertyBadgeSprite(ownerColor, level, buildingType, topY + (level >= 4 ? 0.85 : 0.55)));
  }
}
