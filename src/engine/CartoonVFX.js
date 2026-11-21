import * as THREE from 'three';

const BASE = () => (import.meta.env?.BASE_URL || '/');
const textureCache = new Map();
let loader = null;

export function getVFXTexture(name) {
  if (textureCache.has(name)) return textureCache.get(name);
  // In non-browser unit test environments (happy-dom without WebGL image loader), avoid triggering network errors.
  if (typeof globalThis.Image === 'undefined' || !globalThis.document?.createElement) return null;
  try {
    loader ??= new THREE.TextureLoader();
    const tex = loader.load(`${BASE()}assets/vfx/${name}.png`);
    tex.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(name, tex);
    return tex;
  } catch {
    return null;
  }
}

export function createVFXSprite(name, {
  scale = 1,
  opacity = 1,
  additive = false,
  color = 0xffffff,
  depthWrite = false
} = {}) {
  const map = getVFXTexture(name);
  const material = new THREE.SpriteMaterial({
    map: map || undefined,
    color,
    transparent: true,
    opacity,
    depthWrite,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
  });
  const sprite = new THREE.Sprite(material);
  if (sprite.geometry?.clone) sprite.geometry = sprite.geometry.clone();
  sprite.scale.setScalar(scale);
  return sprite;
}
