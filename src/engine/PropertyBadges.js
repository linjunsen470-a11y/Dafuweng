import * as THREE from 'three';

const badgeTextureCache = new Map();
const signTextureCache = new Map();

const COMMERCIAL_LABELS = {
  MALL: '🏬 商场',
  HOTEL: '🏨 旅馆',
  PARK: '🌳 公园',
  GAS_STATION: '⛽ 油站',
  LAB: '🔬 科研',
  CHAIN_STORE: '🏪 连锁'
};

function getBadgeTexture(ownerColor, level, buildingType) {
  const colorStr = new THREE.Color(ownerColor ?? '#ffaa00').getStyle();
  const key = `${colorStr}|${level}|${buildingType || 'RESIDENTIAL'}`;
  if (badgeTextureCache.has(key)) return badgeTextureCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  const isMax = level >= 5;
  const commLabel = COMMERCIAL_LABELS[buildingType];
  const stars = level > 0 ? '★'.repeat(Math.min(5, level)) : '';
  const text = commLabel
    ? (level > 1 && buildingType !== 'PARK' && buildingType !== 'GAS_STATION' ? `${commLabel} ${stars}` : commLabel)
    : (level === 0 ? '⚑ 空地' : stars);

  // Soft drop shadow
  ctx.beginPath();
  ctx.roundRect(12, 16, 232, 68, 34);
  ctx.fillStyle = 'rgba(34, 18, 6, 0.42)';
  ctx.fill();

  // Warm cream/gold thick pill border
  ctx.beginPath();
  ctx.roundRect(10, 10, 236, 68, 34);
  ctx.fillStyle = isMax ? '#ffe066' : '#fff7df';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#5c3310';
  ctx.stroke();

  // Owner color inner capsule
  ctx.beginPath();
  ctx.roundRect(18, 18, 220, 52, 26);
  ctx.fillStyle = colorStr;
  ctx.fill();

  // Glossy upper highlight
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(18, 18, 220, 52, 26);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(18, 18, 220, 20);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = commLabel
    ? '900 28px "Noto Sans SC", sans-serif'
    : (level >= 4 ? '900 32px sans-serif' : '900 34px "Noto Sans SC", sans-serif');
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(44, 22, 6, 0.85)';
  ctx.strokeText(text, 128, 46);
  ctx.fillStyle = level > 0 && !commLabel ? '#ffe761' : '#ffffff';
  ctx.fillText(text, 128, 46);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.sharedBoardTexture = true;
  badgeTextureCache.set(key, texture);
  return texture;
}

// Floating compact Richman-4 roof badge showing owner color + building type/stars.
export function createPropertyBadgeSprite(ownerColor, level, buildingType, topHeight) {
  const texture = getBadgeTexture(ownerColor, level, buildingType);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  const wide = Boolean(COMMERCIAL_LABELS[buildingType]) || level >= 4;
  sprite.scale.set(wide ? 2.15 : 1.72, 0.66, 1);
  sprite.position.set(0, topHeight + 0.62, 0);
  sprite.renderOrder = 12;
  sprite.userData.isOwnerBeacon = true;
  sprite.userData.isPropertyBadge = true;
  return sprite;
}

function getVacantSignTexture(districtColor, price, isBig) {
  const key = `${districtColor}|${price || 0}|${isBig ? 1 : 0}`;
  if (signTextureCache.has(key)) return signTextureCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');

  // Wooden cartoon signboard
  ctx.fillStyle = '#fff6dc';
  ctx.beginPath();
  ctx.roundRect(6, 6, 244, 132, 20);
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#7c4d21';
  ctx.stroke();

  // District color top strip
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(11, 11, 234, 122, 14);
  ctx.clip();
  ctx.fillStyle = districtColor || '#e69b38';
  ctx.fillRect(11, 11, 234, 52);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 32px "Noto Sans SC", sans-serif';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(54, 30, 10, 0.72)';
  const tag = isBig ? '★ 商业空地' : '待售空地';
  ctx.strokeText(tag, 128, 38);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(tag, 128, 38);

  ctx.font = '900 40px "Outfit", sans-serif';
  ctx.fillStyle = '#5c310d';
  ctx.fillText(price ? `$${price.toLocaleString()}` : 'FOR SALE', 128, 98);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.sharedBoardTexture = true;
  signTextureCache.set(key, texture);
  return texture;
}

export function createVacantSignboard(tile, districtColor) {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: '#8f592c', roughness: 0.76 });
  for (const x of [-0.52, 0.52]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 1.02, 8), woodMat);
    post.position.set(x, 0.51, 0);
    post.castShadow = true;
    group.add(post);
  }
  const boardTex = getVacantSignTexture(districtColor, tile.price, tile.large);
  const boardFace = new THREE.MeshBasicMaterial({ map: boardTex });
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.72, 0.96, 0.12),
    [woodMat, woodMat, woodMat, woodMat, boardFace, boardFace]
  );
  board.position.set(0, 1.06, 0);
  board.castShadow = true;
  group.add(board);
  return group;
}

// Warm cartoon stone plinth + crisp owner-colored territory border (zero dark cyber blue!).
export function createOwnerBasePlatform(ownerColor, large = false) {
  const group = new THREE.Group();
  const accent = new THREE.Color(ownerColor ?? '#ffaa00');
  const sizeX = large ? 4.3 : 3.2;
  const sizeZ = large ? 3.55 : 3.2;

  // Warm cream cobblestone foundation pad
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(sizeX, 0.14, sizeZ),
    new THREE.MeshStandardMaterial({
      color: '#f5e7c4',
      roughness: 0.62,
      metalness: 0.04,
      emissive: accent,
      emissiveIntensity: 0.14
    })
  );
  plinth.position.y = 0.07;
  plinth.receiveShadow = true;
  plinth.userData.isOwnerLight = true;
  group.add(plinth);

  // Crisp saturated owner-color border bars around all four sides
  const borderMat = new THREE.MeshStandardMaterial({
    color: accent,
    roughness: 0.36,
    metalness: 0.08,
    emissive: accent,
    emissiveIntensity: 0.28
  });
  const t = 0.18;
  const bars = [
    [0, sizeZ * 0.5 - t * 0.5, sizeX, t],
    [0, -sizeZ * 0.5 + t * 0.5, sizeX, t],
    [sizeX * 0.5 - t * 0.5, 0, t, sizeZ - t * 2],
    [-sizeX * 0.5 + t * 0.5, 0, t, sizeZ - t * 2]
  ];
  for (const [x, z, w, d] of bars) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, d), borderMat);
    bar.position.set(x, 0.11, z);
    bar.userData.isOwnerBeacon = true;
    group.add(bar);
  }

  // Four charming lantern bollards at the corners with owner-colored caps
  const postMat = new THREE.MeshStandardMaterial({ color: '#fff8e7', roughness: 0.5 });
  const capMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.92 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = sx * (sizeX * 0.45);
      const pz = sz * (sizeZ * 0.45);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.48, 8), postMat);
      post.position.set(px, 0.32, pz);
      post.userData.isOwnerBeacon = true;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), capMat);
      cap.position.set(px, 0.58, pz);
      cap.userData.isOwnerBeacon = true;
      group.add(post, cap);
    }
  }
  return group;
}
