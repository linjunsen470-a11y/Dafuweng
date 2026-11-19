import * as THREE from 'three';
import {describeMapTile} from './MapInspector.js';
import {getGodRule} from '../game/GodRules.js';

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
      const entries = new Map();
      for(const [id,mesh] of board.tileMeshes.entries()) if(mesh) entries.set(mesh,{id});
      for(const meshes of [board.buildingMeshes,board.specialTileMeshes,board.vacantLotMeshes,board.obstacleMeshes,board.mineMeshes,board.roadEntityMeshes])
        for(const [id,mesh] of meshes || []) entries.set(mesh,{id});
      for(const player of state.players) {
        const mesh = pawns.getPawnMesh(player.id);
        if(mesh) entries.set(mesh,{id:player.currentTile,name:player.name});
      }
      for(const god of state.boardGods) {
        const mesh = pawns.boardGodMeshes.get(god.id);
        if(mesh) entries.set(mesh,{id:god.tileId,name:getGodRule(god.type)?.name});
      }
      const hit = ray.intersectObjects([...entries.keys()],true)[0];
      let object = hit?.object;
      while(object && !entries.has(object)) object = object.parent;
      if(!object) {hide();return;}
      selected = entries.get(object);
      anchor = hit.point.clone();
      const info = describeMapTile(state,engine,selected.id);
      if(!info) {hide();return;}
      tip.textContent = [selected.name,info.title,...info.lines.filter((line,index)=>index<2 || /垄断|连锁店|路障|地雷|炸弹/.test(line))].filter(Boolean).join(' · ');
    }
    const projected = anchor.clone().project(scene.camera);
    tip.hidden = Math.abs(projected.x)>1 || Math.abs(projected.y)>1 || Math.abs(projected.z)>1;
    if (!tip.hidden) {
      tip.style.left = Math.max(4,Math.min(innerWidth-tip.offsetWidth-4,(1+projected.x)*innerWidth/2+8))+'px';
      tip.style.top = Math.max(4,Math.min(innerHeight-tip.offsetHeight-4,(1-projected.y)*innerHeight/2-tip.offsetHeight-8))+'px';
    }
  }});
}
