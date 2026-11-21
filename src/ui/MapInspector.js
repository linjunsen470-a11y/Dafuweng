import * as THREE from 'three';
import { boardPicker, bindBoardPointing } from './BoardPointing.js';
import { renderDeed } from './DeedCard.js';
import { describeMapTile } from './MapTileDetails.js';

export { describeMapTile };

export class MapInspector {
  constructor(scene, board, state, engine, pawns) {
    Object.assign(this, { scene, board, state, engine, isOpen: false, selected: null });
    this.button = document.getElementById('btn-inspect-map');
    this.dock = document.querySelector('.control-panel');
    this.turnBadge = document.getElementById('turn-indicator');
    this.panel = document.createElement('section');
    this.panel.id = 'map-inspector';
    this.panel.className = 'map-inspector hidden';
    this.panel.setAttribute('aria-label', '地图地块详情');
    this.panel.innerHTML = '<header><strong>查地</strong><button id="map-inspector-close" type="button" aria-label="关闭查地">关闭</button></header>' +
      '<label>点选棋盘格或选择地块<select id="map-inspector-select" aria-label="查看地块"></select></label><div class="map-inspector-body"></div>';
    document.getElementById('hud-layer').appendChild(this.panel);
    this.select = this.panel.querySelector('select');
    this.body = this.panel.querySelector('.map-inspector-body');
    this.button.addEventListener('click', event => this.isOpen ? this.close() : this.open(event.detail === 0));
    this.panel.querySelector('button').addEventListener('click', () => this.close(true));
    this.select.addEventListener('change', () => this.choose(Number(this.select.value), true));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.isOpen) {
        event.preventDefault();
        this.close(true);
      }
    });

    const pick = boardPicker(scene, board, pawns, state);
    bindBoardPointing(scene.renderer.domElement, { tap: (x, y) => {
      if (!this.isOpen || !this.canInspect()) return;
      const hit = pick(x, y);
      if (hit) this.choose(hit.id, false);
    } });
    let last = 0;
    scene.addUpdatable({ update: () => {
      if (performance.now() - last < 200) return;
      last = performance.now();
      this.button.disabled = !this.canInspect();
      if (!this.isOpen) return;
      if (this.button.disabled) this.close();
      else this.refresh();
    } });
  }

  canInspect() {
    const player = this.state.getCurrentPlayer();
    return this.state.phase === 'PRE_ROLL_ACTION' && player && !player.isAI;
  }

  open(focusSelect = false) {
    if (this.isOpen || !this.canInspect()) return;
    this.select.replaceChildren(...this.state.mapDefinition.tiles.map(tile => new Option(`${tile.id} · ${tile.name}`, tile.id)));
    this.isOpen = true;
    this.panel.classList.remove('hidden');
    this.button.setAttribute('aria-pressed', 'true');
    this.marker = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.65, 32),
      new THREE.MeshBasicMaterial({color: '#fff1a6', side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: .8}));
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.renderOrder = 25;
    this.scene.scene.add(this.marker);
    this.choose(this.state.getCurrentPlayer().currentTile, false);
    if (focusSelect) this.select.focus({ preventScroll: true });
  }

  close(focus = false) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.panel.classList.add('hidden');
    this.button.setAttribute('aria-pressed', 'false');
    this.marker.removeFromParent();
    this.marker.geometry.dispose();
    this.marker.material.dispose();
    this.marker = null;
    if (focus) this.button.focus();
  }

  choose(id, pan) {
    if (!this.isOpen || !this.state.getTile(id)) return;
    this.selected = id;
    this.body.scrollTop = 0;
    this.select.value = String(id);
    this.lastModel = null;
    const position = this.board.tilePositions[id];
    if (position) {
      this.marker.position.copy(position);
      this.marker.position.y += .12;
      if (pan) this.scene.panToMapPoint(position.x, position.z);
    }
    this.refresh();
  }

  refresh() {
    const dockTop = this.dock?.getBoundingClientRect().top || innerHeight;
    const badgeTop = this.turnBadge?.getBoundingClientRect().top || innerHeight;
    this.panel.style.bottom = Math.max(8, innerHeight - Math.min(dockTop, badgeTop) + 8) + 'px';
    const model = describeMapTile(this.state, this.engine, this.selected);
    if (!model) return;
    const key = JSON.stringify(model);
    if (key === this.lastModel) return;
    this.lastModel = key;
    this.panel.style.setProperty('--inspection-owner', model.color);
    const note = document.createElement('p');
    note.className = 'inspection-path-note';
    note.textContent = `相邻路线 · ${model.direction}`;
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', '相邻路线');
    for (const link of model.links) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `→ ${link.id} · ${link.name}`;
      button.onclick = () => this.choose(link.id, true);
      nav.appendChild(button);
    }
    this.body.replaceChildren(renderDeed(model), note, nav);
  }
}
