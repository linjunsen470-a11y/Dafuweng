import { renderDeed } from './DeedCard.js';
import * as THREE from 'three';
import {describeMapTile} from './MapInspector.js';
import { pickBoardTarget } from './BoardTarget.js';

// Resolve the frontmost interactive mesh, including nested original GLB parts.
export function bindBoardHover(scene, board, pawns, state, engine, isBrowsing) {
  const canvas = scene.renderer.domElement;
  const tip = document.createElement('aside');
  tip.className = 'board-tip';
  tip.hidden = true;
  document.body.append(tip);
  const ray = new THREE.Raycaster();
  let pointer, pending, selected, anchor, last = 0;
  const hide = () => {tip.hidden = true; selected = anchor = null;};
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse' && !e.buttons) pending = [e.clientX,e.clientY];
    else if(e.buttons) hide();
  });
  canvas.addEventListener('pointerdown', e => {pointer = [e.clientX,e.clientY];pending = null;hide();});
  canvas.addEventListener('pointerup', e => {
    if(pointer && Math.hypot(e.clientX-pointer[0],e.clientY-pointer[1])<6) pending = [e.clientX,e.clientY];
    pointer = null;
  });
  canvas.addEventListener('pointerleave', e => {if(e.pointerType === 'mouse'){pending = null;hide();}});
  canvas.addEventListener('pointercancel', () => {pointer = pending = null;hide();});
  scene.addUpdatable({update() {
    if (!pending && !selected) return;
    if (!isBrowsing()) {pending = null;hide();return;}
    if (performance.now()-last<90) return;
    last = performance.now();
    if (pending) {
      const rect = canvas.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(2*(pending[0]-rect.left)/rect.width-1,1-2*(pending[1]-rect.top)/rect.height),scene.camera);
      pending = null;
      const hit = pickBoardTarget(ray, board, pawns, state);
      if (!hit) {hide();return;}
      selected = hit;
      anchor = hit.point;
      const info = describeMapTile(state,engine,selected.id);
      if(!info) {hide();return;}
      tip.replaceChildren(renderDeed(info,selected.name));
    }
    const projected = anchor.clone().project(scene.camera);
    tip.hidden = Math.abs(projected.x)>1 || Math.abs(projected.y)>1 || Math.abs(projected.z)>1;
    if (!tip.hidden) {
      tip.style.left = Math.max(4,Math.min(innerWidth-tip.offsetWidth-4,(1+projected.x)*innerWidth/2+8))+'px';
      const y=(1-projected.y)*innerHeight/2;
      const above=y-tip.offsetHeight-14;
      const dock=document.querySelector('.control-panel')?.getBoundingClientRect().top || innerHeight;
      tip.style.top=Math.max(4,Math.min(dock-tip.offsetHeight-5,above>=4 ? above : y+14))+'px';
    }
  }});
}
