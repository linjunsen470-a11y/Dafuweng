import * as THREE from 'three';

const TEXTURE_FILES = {
  road: 'assets/board/road_boulevard.jpg',
  grass: 'assets/board/grass_meadow.jpg',
  roof: 'assets/board/roof_tiles.jpg',
  plaza: 'assets/board/plaza_stone.jpg',
  cottage: 'assets/board/facade_cottage.jpg',
  tower: 'assets/board/facade_tower.jpg'
};

const cache = new Map();
const variantsByKind = new Map();
let loader = null;

function createFallbackTexture(kind) {
  const colors = {
    road: '#e8cfa5',
    grass: '#68c44d',
    roof: '#fff2d8',
    plaza: '#ecd4b0',
    cottage: '#fde3ba',
    tower: '#67c8f2'
  };
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (canvas?.getContext) {
    canvas.width = canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = colors[kind] || '#f2e2c2';
      ctx.fillRect(0, 0, 16, 16);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.userData.sharedBoardTexture = true;
      return tex;
    }
  }
  const tex = new THREE.DataTexture(new Uint8Array([240, 224, 194, 255]), 1, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.userData.sharedBoardTexture = true;
  tex.needsUpdate = true;
  return tex;
}

// Loads and caches hand-painted Richman-4 board & architecture textures with safe test fallback.
export function getRichmanTexture(kind, repeatX = 1, repeatY = 1) {
  const key = `${kind}|${repeatX}|${repeatY}`;
  if (cache.has(key)) return cache.get(key);

  const path = TEXTURE_FILES[kind];
  const baseKey = `${kind}|base`;
  let base = cache.get(baseKey);
  if (!base) {
    const isTest = Boolean(globalThis.__VITEST__ || globalThis.process?.env?.VITEST);
    const canLoadImage = typeof window !== 'undefined' && typeof Image !== 'undefined' && !isTest;
    if (path && canLoadImage) {
      loader ??= new THREE.TextureLoader();
      const baseUrl = import.meta?.env?.BASE_URL || '/';
      base = loader.load(`${baseUrl}${path}`, loaded => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.needsUpdate = true;
        for (const variant of variantsByKind.get(kind) || []) {
          variant.image = loaded.image;
          variant.needsUpdate = true;
        }
      });
      base.colorSpace = THREE.SRGBColorSpace;
      base.wrapS = base.wrapT = THREE.RepeatWrapping;
      base.anisotropy = 4;
      base.userData.sharedBoardTexture = true;
    } else {
      base = createFallbackTexture(kind);
    }
    cache.set(baseKey, base);
  }

  if (repeatX === 1 && repeatY === 1) {
    cache.set(key, base);
    return base;
  }
  const variant = base.clone();
  variant.wrapS = variant.wrapT = THREE.RepeatWrapping;
  variant.repeat.set(repeatX, repeatY);
  variant.colorSpace = THREE.SRGBColorSpace;
  variant.anisotropy = 4;
  variant.userData.sharedBoardTexture = true;
  if (base.image) {
    variant.image = base.image;
    variant.needsUpdate = true;
  }
  if (!variantsByKind.has(kind)) variantsByKind.set(kind, []);
  variantsByKind.get(kind).push(variant);
  cache.set(key, variant);
  return variant;
}
