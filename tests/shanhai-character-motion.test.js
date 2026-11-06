import {it,expect,vi} from 'vitest';
import * as THREE from 'three-modern';
import {SliceScene} from '../src/shanhai/SliceScene.js';
import {SHANHAI_COAST_MAP} from '../src/shanhai/SliceMap.js';
function fixture(reduced=false){
 const model=new THREE.Group(),root=new THREE.Group(),mixer=new THREE.AnimationMixer(model),actions={};root.add(model);
 for(const name of ['idle','walk','ability','notice'])actions[name]=mixer.clipAction(new THREE.AnimationClip(name,1.2,[]));
 const pawn={playerId:0,root,model,mixer,actions,label:{textContent:''},labelName:'阿屿',currentAction:'idle'};
 const scene=Object.assign(Object.create(SliceScene.prototype),{pawns:[pawn],tiles:SHANHAI_COAST_MAP.tiles,motionPreference:{matches:reduced},highlight:vi.fn()});
 return {scene,pawn,actions};
}
it('one-shot reactions cannot reset a newer walk, and reduced motion resolves promptly',async()=>{
 vi.useFakeTimers();
 try{
  const {scene,pawn,actions}=fixture();
  const reaction=scene.react(0,'ability');expect(actions.ability.loop).toBe(THREE.LoopOnce);
  scene.action(0,'walk');await vi.advanceTimersByTimeAsync(1200);await reaction;expect(pawn.currentAction).toBe('walk');expect(actions.walk.loop).toBe(THREE.LoopRepeat);
  scene.motionPreference.matches=true;const reduced=scene.react(0,'notice');await vi.advanceTimersByTimeAsync(30);await reduced;expect(pawn.currentAction).toBe('idle');
 }finally{vi.useRealTimers();}
});
it('keeps walk phase across intermediate tiles and returns to idle only at the final stop',async()=>{
 vi.useFakeTimers();vi.stubGlobal('requestAnimationFrame',cb=>setTimeout(cb,16));
 try{
  const {scene,pawn,actions}=fixture(),reset=vi.spyOn(actions.walk,'reset');
  const first=scene.move(0,1,100,true);await vi.advanceTimersByTimeAsync(120);await first;
  actions.walk.time=.42;expect(pawn.currentAction).toBe('walk');
  const second=scene.move(0,2,100,true);expect(actions.walk.time).toBe(.42);await vi.advanceTimersByTimeAsync(120);await second;
  const last=scene.move(0,3,100,false);await vi.advanceTimersByTimeAsync(120);await last;
  expect(reset).toHaveBeenCalledTimes(1);expect(pawn.currentAction).toBe('idle');expect(scene.highlight).toHaveBeenLastCalledWith(3);
  expect(pawn.root.position.x).toBeCloseTo(SHANHAI_COAST_MAP.tiles[3].position.x);
 }finally{vi.useRealTimers();vi.unstubAllGlobals();}
});
it('a repeated event restarts its own clip and gets the full reaction duration',async()=>{
 vi.useFakeTimers();try{
  const {scene,pawn,actions}=fixture(),reset=vi.spyOn(actions.notice,'reset');
  const first=scene.react(0,'notice');await vi.advanceTimersByTimeAsync(700);const second=scene.react(0,'notice');
  await vi.advanceTimersByTimeAsync(500);await first;expect(pawn.currentAction).toBe('notice');expect(reset).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(700);await second;expect(pawn.currentAction).toBe('idle');
 }finally{vi.useRealTimers();}
});
it('an old selection reaction cannot stop a replacement pawn with the same seat id',async()=>{
 vi.useFakeTimers();try{
  const {scene}=fixture();const old=scene.react(0,'notice');const replacement=fixture();scene.pawns=[replacement.pawn];scene.action(0,'walk');
  await vi.advanceTimersByTimeAsync(1200);await old;expect(replacement.pawn.currentAction).toBe('walk');
 }finally{vi.useRealTimers();}
});
it('preview isolates the existing pawn and restores visibility and normal camera bounds',()=>{
 const {scene,pawn}=fixture();const world=new THREE.Scene(),scenery=new THREE.Group(),hidden=new THREE.Group(),light=new THREE.HemisphereLight();hidden.visible=false;world.add(scenery,hidden,light,pawn.root);
 Object.assign(scene,{scene:world,camera:new THREE.OrthographicCamera(),controls:{target:new THREE.Vector3(),update:vi.fn(),minZoom:.75,maxZoom:2}});
 const objects=[...world.children];scene.previewCharacter(0);expect(world.children).toEqual(objects);expect(pawn.root.visible).toBe(true);expect(light.visible).toBe(true);expect(scenery.visible).toBe(false);expect(scene.camera.zoom).toBe(6);
 scene.previewCharacter(0);scene.overview();expect(scenery.visible).toBe(true);expect(hidden.visible).toBe(false);expect(scene.characterPreview).toBeNull();expect(scene.controls.maxZoom).toBe(2);expect(scene.controls.minZoom).toBe(.75);expect(scene.camera.zoom).toBe(1);
});

it('changing cast releases seat marker resources while preserving shared character meshes',()=>{
 const {scene,pawn}=fixture();scene.scene=new THREE.Scene();scene.scene.add(pawn.root);scene.labels=[];scene.mixers=[pawn.mixer];pawn.label.remove=vi.fn();
 const shared=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()),ring=new THREE.Mesh(new THREE.RingGeometry(),new THREE.MeshBasicMaterial());pawn.model.add(shared);pawn.root.add(ring);
 const sharedDispose=vi.spyOn(shared.geometry,'dispose'),ringDispose=vi.spyOn(ring.geometry,'dispose'),materialDispose=vi.spyOn(ring.material,'dispose');
 scene.createPawns([]);expect(ringDispose).toHaveBeenCalledOnce();expect(materialDispose).toHaveBeenCalledOnce();expect(sharedDispose).not.toHaveBeenCalled();expect(scene.pawns).toEqual([]);expect(scene.mixers).toEqual([]);
});
