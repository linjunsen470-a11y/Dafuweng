import * as THREE from 'three';

// The rules supply the IDs. The scene only translates a visible hit back to an ID.
export class BoardTargetPicker {
  constructor(scene, board, pawns) {
    Object.assign(this, {scene, board, pawns});
  }

  choose(options, playerTargets = false, origin = null) {
    this.cancel?.();
    const group = new THREE.Group();
    const geometry = new THREE.RingGeometry(playerTargets ? 0.55 : 1.12, playerTargets ? 0.78 : 1.43, 36);
    const material = new THREE.MeshBasicMaterial({color:0xffe036, side:THREE.DoubleSide, depthTest:false});
    const hits = new Map();
    let arrow;
    if(origin) {
      const shape=new THREE.Shape();
      shape.moveTo(0,1.42);shape.lineTo(.84,.16);shape.lineTo(.31,.16);shape.lineTo(.31,-1);
      shape.lineTo(-.31,-1);shape.lineTo(-.31,.16);shape.lineTo(-.84,.16);shape.closePath();
      arrow=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false});
      arrow.rotateX(-Math.PI/2);
    }
    const bar = document.createElement('div');
    bar.className = 'board-target-bar';
    bar.innerHTML = '<label>点选发光目标 <select aria-label="合法目标"><option value="">选择目标…</option></select></label><button type="button">取消</button>';
    if(origin) {
      bar.classList.add('route-target-bar');
      bar.querySelector('label').firstChild.textContent='选择前进方向 ';
      bar.querySelector('button').hidden=true;
    }
    const choices = [];
    const select = bar.querySelector('select');
    for (const option of options) {
      const pawn = playerTargets && this.pawns.pawns[option.id]?.mesh;
      const position = pawn ? pawn.position : this.board.tilePositions[option.id];
      if (!position) continue;
      const tint = option.color ? material.clone() : material;
      if(option.color)tint.color.set(option.color);
      const marker = new THREE.Mesh(arrow || geometry, tint);
      marker.position.copy(position);
      marker.position.y += 0.24;
      if(origin) marker.rotation.y=Math.atan2(origin.x-position.x,origin.z-position.z);
      else marker.rotation.x = -Math.PI / 2;
      marker.renderOrder = 26;
      group.add(marker);
      hits.set(marker, option.id);
      const object = pawn || this.board.tileMeshes[option.id];
      if (object) hits.set(object, option.id);
      select.add(new Option(option.label, String(option.id)));
      if (option.detail) {
        const button=document.createElement('button');
        button.type='button';button.className='quay-route-choice';
        button.style.setProperty('--street-color',option.color);
        const name=document.createElement('strong'), detail=document.createElement('span');
        name.textContent=option.label;detail.textContent=option.detail;
        button.append(name,detail);bar.append(button);choices.push([button,option.id]);
      }
    }
    this.scene.scene.add(group);
    document.body.append(bar);
    const hud = document.getElementById('hud-layer');
    hud.inert = true;
    if(choices.length) bar.querySelector('label').hidden=true;
    (choices[0]?.[0] || select).focus({preventScroll:true});
    const canvas = this.scene.renderer.domElement;
    const events = new AbortController();
    const listen = (node, type, fn) => node.addEventListener(type, fn, {signal:events.signal});
    return new Promise(resolve => {
      const finish = id => {
        events.abort();
        group.removeFromParent();
        geometry.dispose();
        arrow?.dispose();
        for(const marker of group.children)if(marker.material!==material)marker.material.dispose();
        material.dispose();
        bar.remove();
        hud.inert = false;
        this.cancel = null;
        document.getElementById('btn-use-card')?.focus();
        resolve(id);
      };
      this.cancel = () => finish(null);
      listen(bar.querySelector('button'), 'click', this.cancel);
      listen(document, 'keydown', event => {if (!origin && event.key === 'Escape') this.cancel();});
      for(const [button,id] of choices)listen(button,'click',()=>finish(id));
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
