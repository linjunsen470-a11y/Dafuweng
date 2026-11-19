import * as THREE from 'three';

// The rules supply the IDs. The scene only translates a visible hit back to an ID.
export class BoardTargetPicker {
  constructor(scene, board, pawns) {
    Object.assign(this, {scene, board, pawns});
  }

  choose(options, playerTargets = false) {
    this.cancel?.();
    const group = new THREE.Group();
    const geometry = new THREE.RingGeometry(playerTargets ? 0.55 : 1.12, playerTargets ? 0.78 : 1.43, 36);
    const material = new THREE.MeshBasicMaterial({color:0xffe036, side:THREE.DoubleSide, depthTest:false});
    const hits = new Map();
    const bar = document.createElement('div');
    bar.className = 'board-target-bar';
    bar.innerHTML = '<label>点选发光目标 <select aria-label="合法目标"><option value="">选择目标…</option></select></label><button type="button">取消</button>';
    const select = bar.querySelector('select');
    for (const option of options) {
      const pawn = playerTargets && this.pawns.pawns[option.id]?.mesh;
      const position = pawn ? pawn.position : this.board.tilePositions[option.id];
      if (!position) continue;
      const marker = new THREE.Mesh(geometry, material);
      marker.position.copy(position);
      marker.position.y += 0.24;
      marker.rotation.x = -Math.PI / 2;
      marker.renderOrder = 26;
      group.add(marker);
      hits.set(marker, option.id);
      const object = pawn || this.board.tileMeshes[option.id];
      if (object) hits.set(object, option.id);
      select.add(new Option(option.label, String(option.id)));
    }
    this.scene.scene.add(group);
    document.body.append(bar);
    const hud = document.getElementById('hud-layer');
    hud.inert = true;
    select.focus();
    const canvas = this.scene.renderer.domElement;
    const events = new AbortController();
    const listen = (node, type, fn) => node.addEventListener(type, fn, {signal:events.signal});
    return new Promise(resolve => {
      const finish = id => {
        events.abort();
        group.removeFromParent();
        geometry.dispose();
        material.dispose();
        bar.remove();
        hud.inert = false;
        this.cancel = null;
        document.getElementById('btn-use-card')?.focus();
        resolve(id);
      };
      this.cancel = () => finish(null);
      listen(bar.querySelector('button'), 'click', this.cancel);
      listen(document, 'keydown', event => {if (event.key === 'Escape') this.cancel();});
      listen(select, 'change', () => {if (select.value !== '') finish(Number(select.value));});
      let down;
      listen(canvas, 'pointerdown', e => {down = e.button === 0 ? [e.clientX,e.clientY] : null;});
      listen(canvas, 'pointercancel', () => {down = null;});
      listen(canvas, 'pointerup', e => {
        if (!down || Math.hypot(e.clientX-down[0],e.clientY-down[1]) > 6) return;
        down = null;
        const rect = canvas.getBoundingClientRect();
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(2*(e.clientX-rect.left)/rect.width-1,1-2*(e.clientY-rect.top)/rect.height),this.scene.camera);
        const hit = ray.intersectObjects([...hits.keys()], true)[0];
        let object = hit?.object;
        while (object && !hits.has(object)) object = object.parent;
        if (object) finish(hits.get(object));
      });
    });
  }
}
