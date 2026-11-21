import * as THREE from 'three';
import { renderDeed } from './DeedCard.js';
import { describeMapTile } from './MapTileDetails.js';
import { boardPicker, bindBoardPointing } from './BoardPointing.js';

function positionBesideTile(x, y, width, height, minY, maxY, panels) {
  const gap = 10;
  let best;
  let smallestOverlap = Infinity;
  for (const preferredTop of [y - gap - height, y + gap, y - height / 2]) {
    const top = Math.max(4, Math.min(maxY - height, Math.max(minY, preferredTop)));
    for (const preferredLeft of [x + gap, x - gap - width]) {
      const left = Math.max(4, Math.min(innerWidth - width - 4, preferredLeft));
      const overlap = panels.reduce((area, panel) => area +
        Math.max(0, Math.min(left + width, panel.right) - Math.max(left, panel.left)) *
        Math.max(0, Math.min(top + height, panel.bottom) - Math.max(top, panel.top)), 0);
      if (overlap < smallestOverlap) {
        best = { left, top };
        smallestOverlap = overlap;
      }
      if (overlap === 0) return best;
    }
  }
  return best;
}

export function bindBoardHover(scene, board, pawns, state, engine, isBrowsing) {
  const canvas = scene.renderer.domElement;
  const tip = document.createElement('aside');
  tip.className = 'board-tip';
  tip.setAttribute('aria-label', '地块详情');
  tip.hidden = true;
  document.body.append(tip);
  const pick = boardPicker(scene, board, pawns, state);
  const projected = new THREE.Vector3();
  const dock = document.querySelector('.control-panel');
  const turnBadge = document.getElementById('turn-indicator');
  const header = document.querySelector('.top-bar');
  const sidePanels = document.querySelectorAll('.left-panel, .minimap-panel, .quest-panel, .log-panel');
  let pending, selection, pinned, lastPick = -Infinity, lastQuote = -Infinity, lastModel;
  let lastLayout = -Infinity, screenX = NaN, screenY = NaN;

  function hide() {
    pending = selection = lastModel = null;
    pinned = false;
    tip.hidden = true;
    lastLayout = -Infinity;
  }

  function refresh() {
    const info = describeMapTile(state, engine, selection.id);
    if (!info) { hide(); return; }
    const key = JSON.stringify([info, selection.name]);
    if (key !== lastModel) {
      tip.replaceChildren(renderDeed(info, selection.name));
      lastLayout = -Infinity;
    }
    lastModel = key;
    lastQuote = performance.now();
  }

  function choose(x, y, pin) {
    const hit = pick(x, y);
    if (!hit || (pin && pinned && selection?.id === hit.id)) { hide(); return; }
    const changed = hit.id !== selection?.id || hit.name !== selection?.name;
    selection = hit;
    pinned = pin;
    if (changed) refresh();
  }

  bindBoardPointing(canvas, {
    hover(x, y) { if (!pinned && isBrowsing()) pending = { x, y }; },
    tap(x, y) { if (isBrowsing()) choose(x, y, true); },
    start() { pending = null; },
    leave() { pending = null; if (!pinned) hide(); },
    reset: hide
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  document.addEventListener('pointerdown', event => { if (event.target !== canvas) hide(); });

  scene.addUpdatable({ update() {
    if (!pending && !selection) return;
    if (!isBrowsing()) { hide(); return; }
    const now = performance.now();
    if (pending && now - lastPick >= 90) {
      choose(pending.x, pending.y, false);
      pending = null;
      lastPick = now;
    }
    if (!selection) return;
    if (now - lastQuote >= 400) refresh();
    if (!selection) return;
    projected.copy(selection.point).project(scene.camera);
    if (Math.max(Math.abs(projected.x), Math.abs(projected.y), Math.abs(projected.z)) > 1) {
      tip.hidden = true;
      return;
    }
    // Reproject as the camera moves, but leave a stationary HUD out of the layout loop.
    const moved = Math.abs(projected.x - screenX) + Math.abs(projected.y - screenY) > .001;
    if (!tip.hidden && now - lastLayout < (moved ? 32 : 250)) return;
    screenX = projected.x;
    screenY = projected.y;
    lastLayout = now;
    tip.hidden = false;
    const rect = canvas.getBoundingClientRect();
    const x = rect.left + (1 + projected.x) * rect.width / 2;
    const y = rect.top + (1 - projected.y) * rect.height / 2;
    const minY = (header?.getBoundingClientRect().bottom || 0) + 6;
    const maxY = Math.min(dock?.getBoundingClientRect().top || innerHeight,
      turnBadge?.getBoundingClientRect().top || innerHeight) - 8;
    const panels = Array.from(sidePanels, panel => panel.getBoundingClientRect()).filter(rect => rect.width && rect.height);
    const { left, top } = positionBesideTile(x, y, tip.offsetWidth, tip.offsetHeight, minY, maxY, panels);
    tip.style.setProperty('--pin-x', Math.round(x - left) + 'px');
    tip.style.setProperty('--pin-y', Math.round(y - top) + 'px');
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
  } });
}
