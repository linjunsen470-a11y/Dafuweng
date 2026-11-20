import * as THREE from 'three';
import { pickBoardTarget } from './BoardTarget.js';

export function boardPicker(scene, board, pawns, state) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  return (x, y) => {
    const rect = scene.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height || x < rect.left || y < rect.top || x > rect.right || y > rect.bottom) return null;
    ndc.set(2 * (x - rect.left) / rect.width - 1, 1 - 2 * (y - rect.top) / rect.height);
    ray.setFromCamera(ndc, scene.camera);
    return pickBoardTarget(ray, board, pawns, state);
  };
}

// Leave pointer capture and gestures to OrbitControls. A drag that returns to
// its start, or a pinch that ends with one finger, must never select a parcel.
export function bindBoardPointing(canvas, { tap, hover, reset, leave, start }) {
  const events = new AbortController();
  const on = (type, listener) => canvas.addEventListener(type, listener, { signal: events.signal });
  let down = null;
  const cancel = () => { down = null; reset?.(); };
  on('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || down) { cancel(); return; }
    down = { id: event.pointerId, x: event.clientX, y: event.clientY };
    start?.();
  });
  const isTap = event => down?.id === event.pointerId &&
    Math.hypot(event.clientX - down.x, event.clientY - down.y) <= 6;
  on('pointermove', event => {
    if (down && !isTap(event)) cancel();
    if (!down && !event.buttons && event.pointerType === 'mouse') hover?.(event.clientX, event.clientY);
  });
  on('pointerup', event => {
    const clicked = isTap(event);
    down = null;
    if (clicked) tap(event.clientX, event.clientY);
  });
  on('pointercancel', cancel);
  on('wheel', cancel);
  on('pointerleave', event => {
    if (event.pointerType !== 'mouse') return;
    down = null;
    leave?.();
  });
  return () => events.abort();
}
