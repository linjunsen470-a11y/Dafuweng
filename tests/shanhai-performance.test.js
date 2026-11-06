import {it,expect,vi} from 'vitest';
import * as THREE from 'three-modern';
import {SliceScene} from '../src/shanhai/SliceScene.js';
import {SHANHAI_COAST_MAP} from '../src/shanhai/SliceMap.js';
import {characterFeedback} from '../src/shanhai/SlicePerformance.js';
function fixture(reduced=false){
 const root=new THREE.Group(),model=new THREE.Group(),base=new THREE.Group();root.add(model,base);root.position.set(-9.9,.22,7.42);
 const pawn={playerId:0,characterId:'ayu',root,model,actions:{}},scene=Object.assign(Object.create(SliceScene.prototype),{pawns:[pawn],tiles:SHANHAI_COAST_MAP.tiles,scene:new THREE.Scene(),motionPreference:{matches:reduced},setTransportRoute:vi.fn(),highlight:vi.fn(),action:vi.fn()});return {scene,pawn,base};
}
it('boards, sails and alights in order, with stable shore position and released transient meshes',async()=>{
 vi.useFakeTimers();vi.stubGlobal('requestAnimationFrame',cb=>setTimeout(cb,16));
 try{
  const {scene,pawn,base}=fixture(),stages=[],disposed=[];
  const journey=scene.travelByBoat(0,0,9,100,stage=>{stages.push(stage);if(stage==='boarding')scene.activeTrip.boat.traverse(o=>{if(o.isMesh){o.geometry.addEventListener('dispose',()=>disposed.push(o));}});if(stage==='sailing')expect(base.visible).toBe(false);});
  await vi.advanceTimersByTimeAsync(500);await journey;
  expect(stages).toEqual(['boarding','sailing','alighting','arrival']);expect(pawn.root.position.toArray()).toEqual([SHANHAI_COAST_MAP.tiles[9].position.x,.22,SHANHAI_COAST_MAP.tiles[9].position.z]);expect(base.visible).toBe(true);expect(pawn.model.rotation.z).toBe(0);expect(scene.activeTrip).toBeNull();expect(scene.scene.children).toHaveLength(0);expect(disposed).toHaveLength(4);
 }finally{vi.useRealTimers();vi.unstubAllGlobals();}
});
it('cleans up when a stage callback fails, and reduced motion skips the long crossing',async()=>{
 const {scene,pawn,base}=fixture();await expect(scene.travelByBoat(0,0,9,100,()=>{throw Error('interrupted');})).rejects.toThrow('interrupted');expect(scene.scene.children).toHaveLength(0);expect(base.visible).toBe(true);expect(pawn.root.position.y).toBe(.22);
 vi.useFakeTimers();vi.stubGlobal('requestAnimationFrame',cb=>setTimeout(cb,16));
 try{const f=fixture(true),stages=[];const p=f.scene.travelByBoat(0,0,9,1600,s=>stages.push(s));await vi.advanceTimersByTimeAsync(100);await p;expect(stages.at(-1)).toBe('arrival');expect(f.scene.activeTrip).toBeNull();}finally{vi.useRealTimers();vi.unstubAllGlobals();}
});
it('original feedback differentiates roles and distinguishes a diversion from normal arrival',()=>{
 const a={name:'阿屿',characterId:'ayu'},q={name:'青禾',characterId:'qinghe'};
 expect(characterFeedback(a,'boarding').line).not.toBe(characterFeedback(q,'boarding').line);
 expect(characterFeedback(a,'diverted').line).toContain('新的靠岸点');expect(characterFeedback(q,'setback').line).toContain('资金');
});
