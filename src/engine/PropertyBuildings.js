import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createPropertyBadgeSprite, createVacantSignboard } from './PropertyBadges.js';
import { getRichmanTexture } from './RichmanTextures.js';

function mergeParts(parts) {
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged;
}

function addBox(parent, w, h, d, mat, x, y, z, shadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  parent.add(mesh);
  return mesh;
}

function addNightWindows(parent, floors, width, startY, stepY, zFront, mat) {
  const cols = width >= 2.3 ? [-0.72, 0, 0.72] : [-0.48, 0.48];
  const parts = [];
  for (let f = 0; f < floors; f++) {
    const y = startY + f * stepY;
    for (const x of cols) {
      parts.push(
        new THREE.BoxGeometry(0.28, 0.3, 0.05).translate(x, y, zFront),
        new THREE.BoxGeometry(0.28, 0.3, 0.05).translate(x, y, -zFront)
      );
    }
  }
  const mesh = new THREE.Mesh(mergeParts(parts), mat);
  mesh.userData.isWindow = true;
  parent.add(mesh);
}

function addOwnerFlag(parent, ownerColor, x, baseY, z, height = 1.55) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, height, 8),
    new THREE.MeshStandardMaterial({ color: '#fff4d2', metalness: 0.25, roughness: 0.4 })
  );
  pole.position.set(x, baseY + height * 0.5, z);
  pole.userData.isOwnerBeacon = true;
  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 6),
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

// Batched Richman-4 vacant lot with hand-painted meadow/plaza ground, corner pickets, flower bushes, and signboard.
export function buildRichVacantLot(tile, districtColor) {
  const group = new THREE.Group();
  const isBig = Boolean(tile.large);
  const w = isBig ? 4.1 : 3.15;
  const d = isBig ? 3.35 : 3.05;

  const baseMat = new THREE.MeshStandardMaterial({
    map: getRichmanTexture(isBig ? 'plaza' : 'grass', 1.5, 1.5),
    color: isBig ? '#fff6df' : '#dff7c4',
    roughness: 0.84
  });
  const base = addBox(group, w, 0.14, d, baseMat, 0, 0.07, 0, false);
  base.receiveShadow = true;

  const trimParts = [
    new THREE.BoxGeometry(w + 0.14, 0.1, 0.14).translate(0, 0.13, d * 0.5),
    new THREE.BoxGeometry(w + 0.14, 0.1, 0.14).translate(0, 0.13, -d * 0.5),
    new THREE.BoxGeometry(0.14, 0.1, d).translate(w * 0.5, 0.13, 0),
    new THREE.BoxGeometry(0.14, 0.1, d).translate(-w * 0.5, 0.13, 0)
  ];
  group.add(new THREE.Mesh(mergeParts(trimParts), new THREE.MeshStandardMaterial({ color: districtColor || '#e2a13f', roughness: 0.44 })));

  const postParts = [];
  const bushParts = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      postParts.push(new THREE.BoxGeometry(0.12, 0.44, 0.12).translate(sx * (w * 0.43), 0.28, sz * (d * 0.43)));
      bushParts.push(new THREE.DodecahedronGeometry(0.25, 0).translate(sx * (w * 0.34), 0.26, sz * (d * 0.34)));
    }
  }
  group.add(
    new THREE.Mesh(mergeParts(postParts), new THREE.MeshStandardMaterial({ color: '#fff8e8', roughness: 0.56 })),
    new THREE.Mesh(mergeParts(bushParts), new THREE.MeshStandardMaterial({ color: '#45b850', roughness: 0.74 }))
  );

  const sign = createVacantSignboard(tile, districtColor);
  sign.position.set(0, 0.12, 0.12);
  group.add(sign);
  return group;
}

// Builds hand-painted Richman-4 Lv.0..Lv.5 residential & 6 commercial landmarks.
export function buildRichPropertyStructure({ level, ownerColor, buildingType, large }) {
  const group = new THREE.Group();
  const accent = new THREE.Color(ownerColor ?? '#ffaa00');
  const brightRoofColor = accent.clone().lerp(new THREE.Color('#ffffff'), 0.12);
  const roofMat = new THREE.MeshStandardMaterial({ map: getRichmanTexture('roof', 2, 1.5), color: brightRoofColor, roughness: 0.32, metalness: 0.08 });
  const cottageWall = new THREE.MeshStandardMaterial({ map: getRichmanTexture('cottage', 1, 1), color: '#fffbf2', roughness: 0.52 });
  const cottageTall = new THREE.MeshStandardMaterial({ map: getRichmanTexture('cottage', 1, 1.5), color: '#fffbf2', roughness: 0.52 });
  const towerWall = new THREE.MeshStandardMaterial({ map: getRichmanTexture('tower', 1, 1.15), color: '#f5fcff', roughness: 0.22, metalness: 0.16 });
  const towerTall = new THREE.MeshStandardMaterial({ map: getRichmanTexture('tower', 1, 1.65), color: '#f5fcff', roughness: 0.22, metalness: 0.16 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#fff2d2', roughness: 0.48 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#8f552b', roughness: 0.68 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#ffca28', metalness: 0.72, roughness: 0.22, emissive: '#945a00', emissiveIntensity: 0.25 });
  const windowMat = new THREE.MeshStandardMaterial({ color: '#e6f9ff', emissive: '#ffd269', emissiveIntensity: 0.35, roughness: 0.18 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#6dd8fa', roughness: 0.1, metalness: 0.16, clearcoat: 0.88, emissive: '#125a75', emissiveIntensity: 0.22 });

  let topHeight = 1.6;
  if (buildingType === 'PARK') {
    const lawn = new THREE.Mesh(
      new THREE.CylinderGeometry(1.78, 1.88, 0.22, 20),
      new THREE.MeshStandardMaterial({ map: getRichmanTexture('grass', 1.4, 1.4), color: '#d8f5b8', roughness: 0.8 })
    );
    lawn.position.y = 0.22;
    const walk = new THREE.Mesh(
      new THREE.CylinderGeometry(1.06, 1.12, 0.26, 16),
      new THREE.MeshStandardMaterial({ map: getRichmanTexture('plaza', 1.2, 1.2), color: '#fff3d6', roughness: 0.7 })
    );
    walk.position.y = 0.24;
    const pillarParts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      pillarParts.push(new THREE.CylinderGeometry(0.06, 0.07, 1.1, 8).translate(Math.cos(a) * 0.76, 0.9, Math.sin(a) * 0.76));
    }
    const gazeboCols = new THREE.Mesh(mergeParts(pillarParts), trimMat);
    const dome = new THREE.Mesh(new THREE.ConeGeometry(1.12, 0.82, 8), roofMat);
    dome.position.y = 1.84;
    dome.castShadow = true;
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), goldMat);
    finial.position.y = 2.28;
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.28, 14), glassMat);
    water.position.y = 0.46;
    const spots = [[-1.22, -0.78], [1.22, -0.78], [-1.12, 0.86], [1.12, 0.86]];
    const trunks = new THREE.Mesh(mergeParts(spots.map(([x, z]) => new THREE.CylinderGeometry(0.09, 0.12, 0.74, 8).translate(x, 0.65, z))), woodMat);
    const crowns = new THREE.Mesh(mergeParts(spots.map(([x, z]) => new THREE.DodecahedronGeometry(0.48, 1).translate(x, 1.2, z))), new THREE.MeshStandardMaterial({ color: '#39b54a', roughness: 0.7 }));
    crowns.castShadow = true;
    group.add(lawn, walk, gazeboCols, dome, finial, water, trunks, crowns);
    topHeight = 2.45;
  } else if (buildingType === 'GAS_STATION') {
    addBox(group, 3.68, 0.36, 2.58, roofMat, 0, 2.2, 0);
    addBox(group, 3.82, 0.15, 2.72, goldMat, 0, 2.44, 0);
    for (const x of [-1.48, 1.48]) addBox(group, 0.26, 2.0, 0.26, trimMat, x, 1.12, 0);
    for (const x of [-0.66, 0.66]) {
      addBox(group, 0.48, 1.12, 0.56, trimMat, x, 0.68, 0.2);
      addBox(group, 0.36, 0.36, 0.08, roofMat, x, 0.94, 0.5, false);
    }
    addBox(group, 2.65, 1.05, 0.96, cottageWall, 0, 0.66, -0.82);
    topHeight = 2.72;
  } else if (buildingType === 'MALL' || buildingType === 'HOTEL' || buildingType === 'LAB') {
    const height = (buildingType === 'HOTEL' ? 2.6 : buildingType === 'LAB' ? 2.15 : 1.95) + Math.max(1, level) * 0.78;
    const bw = large ? 3.58 : 2.74;
    const bd = large ? 2.68 : 2.34;
    const mainMat = buildingType === 'HOTEL' ? cottageTall : towerWall;
    addBox(group, bw, height, bd, mainMat, 0, height * 0.5 + 0.14, 0);
    addBox(group, bw + 0.22, 0.28, bd + 0.22, roofMat, 0, height + 0.26, 0);
    addBox(group, bw * 0.72, Math.max(0.95, height - 0.75), 0.14, glassMat, 0, height * 0.5 + 0.22, bd * 0.5 + 0.03, false);
    addBox(group, 1.56, 0.2, 0.74, roofMat, 0, 1.02, bd * 0.5 + 0.34);
    addBox(group, 0.94, 0.86, 0.08, woodMat, 0, 0.56, bd * 0.5 + 0.04, false);
    if (buildingType === 'HOTEL') {
      addBox(group, bw * 0.68, 0.78, bd * 0.68, roofMat, 0, height + 0.76, 0);
      addBox(group, bw * 0.44, 0.24, bd * 0.44, goldMat, 0, height + 1.26, 0);
      topHeight = height + 1.55;
    } else if (buildingType === 'LAB') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.96, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
      dome.position.set(0, height + 0.36, 0);
      const rotor = new THREE.Group();
      rotor.position.set(0, height + 1.38, 0);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8), trimMat);
      const dish = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.065, 8, 18), goldMat);
      dish.position.set(0.18, 0.46, 0);
      rotor.add(mast, dish);
      group.add(dome, rotor);
      group.userData.rotor = rotor;
      topHeight = height + 2.08;
    } else {
      const skylight = new THREE.Mesh(new THREE.CylinderGeometry(bw * 0.32, bw * 0.38, 0.5, 16), glassMat);
      skylight.position.set(0, height + 0.62, 0);
      group.add(skylight);
      addOwnerFlag(group, ownerColor, bw * 0.36, height + 0.38, 0, 1.35);
      topHeight = height + 1.7;
    }
  } else if (buildingType === 'CHAIN_STORE') {
    addBox(group, 2.52, 1.72, 2.26, cottageWall, 0, 0.98, 0);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.05, 0.88, 4), roofMat);
    roof.position.y = 2.26;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    addBox(group, 2.28, 0.24, 0.66, roofMat, 0, 1.24, 1.26);
    addBox(group, 1.88, 0.86, 0.08, glassMat, 0, 0.65, 1.15, false);
    topHeight = 2.78;
  } else if (level === 0) {
    // Purchased vacant plot: crisp white wooden corral fence + tall waving owner triangle flag
    const fenceParts = [];
    for (const side of [-1, 1]) {
      fenceParts.push(
        new THREE.BoxGeometry(0.1, 0.12, 2.4).translate(side * 1.22, 0.44, 0),
        new THREE.BoxGeometry(2.4, 0.12, 0.1).translate(0, 0.44, side * 1.22)
      );
    }
    group.add(new THREE.Mesh(mergeParts(fenceParts), trimMat));
    addOwnerFlag(group, ownerColor, 0, 0.16, 0, 2.05);
    topHeight = 2.25;
  } else if (level === 1) {
    // Lv.1 Hand-painted storybook cottage with overhanging ceramic tile roof & flower-box awning
    addBox(group, 2.22, 1.46, 2.12, cottageWall, 0, 0.87, 0);
    addBox(group, 2.38, 0.14, 2.28, trimMat, 0, 1.62, 0);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.94, 1.12, 4), roofMat);
    roof.position.y = 2.2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    addBox(group, 0.34, 0.72, 0.34, new THREE.MeshStandardMaterial({ color: '#d95b43', roughness: 0.62 }), 0.62, 2.22, -0.38);
    addBox(group, 0.64, 0.84, 0.09, woodMat, 0, 0.56, 1.08, false);
    addBox(group, 1.04, 0.18, 0.48, roofMat, 0, 1.08, 1.22);
    addNightWindows(group, 1, 2.05, 0.96, 0.8, 1.08, windowMat);
    topHeight = 2.86;
  } else if (level === 2) {
    // Lv.2 Two-story sunny garden villa with balcony railing, dormer & scalloped roof
    addBox(group, 2.42, 1.4, 2.3, cottageWall, 0, 0.84, 0);
    addBox(group, 2.58, 0.16, 2.46, trimMat, 0, 1.58, 0);
    addBox(group, 2.12, 1.32, 2.02, cottageWall, 0, 2.28, -0.08);
    addBox(group, 1.64, 0.36, 0.52, trimMat, 0, 1.8, 1.06);
    addBox(group, 1.08, 0.18, 0.5, roofMat, 0, 1.08, 1.28);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.82, 1.2, 4), roofMat);
    roof.position.set(0, 3.5, -0.08);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    addBox(group, 0.64, 0.86, 0.09, woodMat, 0, 0.57, 1.17, false);
    addNightWindows(group, 2, 2.15, 0.94, 1.26, 1.17, windowMat);
    topHeight = 4.18;
  } else if (level === 3) {
    // Lv.3 Three-story boutique townhouse with corner pilasters, tiered awnings & ceramic mansard roof
    addBox(group, 2.54, 3.6, 2.42, cottageTall, 0, 1.94, 0);
    for (const y of [1.34, 2.52, 3.74]) addBox(group, 2.74, 0.18, 2.62, roofMat, 0, y, 0);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.96, 1.02, 4), roofMat);
    roof.position.y = 4.32;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    addBox(group, 1.2, 0.18, 0.58, roofMat, 0, 1.08, 1.38);
    addBox(group, 0.76, 0.9, 0.09, woodMat, 0, 0.59, 1.23, false);
    addNightWindows(group, 3, 2.48, 0.92, 1.06, 1.23, windowMat);
    addOwnerFlag(group, ownerColor, 0.72, 4.46, 0, 1.18);
    topHeight = 5.42;
  } else if (level === 4) {
    // Lv.4 High-rise sparkling glass skyscraper with stone podium & owner crown
    addBox(group, 2.74, 1.25, 2.64, trimMat, 0, 0.76, 0);
    addBox(group, 2.52, 4.1, 2.42, towerWall, 0, 3.38, 0);
    addBox(group, 2.78, 0.26, 2.68, roofMat, 0, 5.52, 0);
    addBox(group, 1.92, 0.84, 1.86, roofMat, 0, 6.02, 0);
    addBox(group, 1.48, 0.2, 1.48, goldMat, 0, 6.52, 0);
    addBox(group, 1.32, 0.22, 0.64, roofMat, 0, 1.04, 1.5);
    addNightWindows(group, 3, 2.4, 2.1, 1.08, 1.24, windowMat);
    topHeight = 6.82;
  } else {
    // Lv.5 Grand Richman-4 Landmark Skyscraper with wedding-cake tiers & golden star spire!
    addBox(group, 2.86, 1.32, 2.78, trimMat, 0, 0.8, 0);
    addBox(group, 2.68, 3.25, 2.6, towerWall, 0, 3.04, 0);
    addBox(group, 2.86, 0.24, 2.78, roofMat, 0, 4.74, 0);
    addBox(group, 2.18, 2.25, 2.12, towerTall, 0, 5.96, 0);
    addBox(group, 2.38, 0.26, 2.32, roofMat, 0, 7.16, 0);
    addBox(group, 1.56, 0.74, 1.56, roofMat, 0, 7.62, 0);
    addBox(group, 1.22, 0.28, 1.22, goldMat, 0, 8.08, 0);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.13, 1.35, 8), goldMat);
    spire.position.y = 8.84;
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), new THREE.MeshBasicMaterial({ color: '#fff3a1' }));
    beacon.position.y = 9.58;
    beacon.userData.isBeacon = true;
    group.add(spire, beacon);
    topHeight = 9.65;
  }

  group.add(createPropertyBadgeSprite(ownerColor, level, buildingType, topHeight));
  return group;
}

export function decorateOriginalBuilding(group, model, { level, ownerColor, buildingType, large }) {
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
