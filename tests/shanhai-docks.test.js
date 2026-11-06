import {it,expect} from 'vitest';
import * as THREE from 'three-modern';
import {SliceDocks} from '../src/shanhai/SliceDocks.js';
import {SHANHAI_COAST_MAP} from '../src/shanhai/SliceMap.js';
import {DOCK_NEIGHBORS,canChatAtDock} from '../src/shanhai/SliceDockStories.js';
import {SliceSession} from '../src/shanhai/SliceSession.js';
it('builds three original docks and three waving residents within a small shared geometry budget',()=>{
 const scene=new THREE.Scene(),d=new SliceDocks(scene,SHANHAI_COAST_MAP.tiles);let tris=0;
 expect(d.group.children).toHaveLength(3);expect(d.picks).toHaveLength(9);expect(d.residents).toHaveLength(3);d.group.updateMatrixWorld(true);for(const r of d.residents)expect(r.root.getWorldPosition(new THREE.Vector3()).y).toBeGreaterThan(.3);
 for(const mesh of d.picks){expect([...mesh.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);expect(mesh.material).toBe(d.material);tris+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;expect(DOCK_NEIGHBORS.some(n=>n.id===mesh.userData.dockId)).toBe(true);}
 expect(tris).toBeLessThan(15000);d.greet('harbor');d.update(.08);expect(d.residents[0].hand.rotation.z).toBeLessThan(-.7);
 const time=d.time,pose=d.residents[0].hand.rotation.z;d.update(.08,{visible:false});expect(d.time).toBe(time);expect(d.residents[0].hand.rotation.z).toBe(pose);
 d.update(.08,{reduced:true});expect(d.residents[0].hand.rotation.z).toBe(0);d.dispose();expect(scene.children).toHaveLength(0);
});
it('permits local human conversation only and preserves money, RNG and older save compatibility',()=>{
 const s=new SliceSession({storage:null});s.start({seed:314});const before=s.snapshot();expect(canChatAtDock(DOCK_NEIGHBORS[0],s,{active:true})).toBe(true);expect(canChatAtDock(DOCK_NEIGHBORS[1],s,{active:true})).toBe(false);expect(canChatAtDock(DOCK_NEIGHBORS[0],s,{active:true,busy:true})).toBe(false);
 for(const d of DOCK_NEIGHBORS)expect(d.choices).toHaveLength(2);expect(s.state.rng.state).toBe(before.rngState);expect(s.currentPlayer.cash).toBe(before.players[0].cash);
 s.currentPlayer.isAI=true;expect(canChatAtDock(DOCK_NEIGHBORS[0],s,{active:true})).toBe(false);s.restore(before);expect(canChatAtDock(DOCK_NEIGHBORS[0],s,{active:true})).toBe(true);
});
