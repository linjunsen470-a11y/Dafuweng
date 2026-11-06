import {it,expect} from 'vitest';
import * as THREE from 'three-modern';
import {SliceAmbience} from '../src/shanhai/SliceAmbience.js';
it.each(['shanhai-coast','shanhai-highland'])('keeps %s bounded and shadow-free, pauses hidden/off/reduced motion, and disposes',mapId=>{
 const scene=new THREE.Scene(),a=new SliceAmbience(scene,{mapId});let disposed=0;a.group.traverse(o=>{if(o.isMesh){expect(o.castShadow).toBe(false);expect(o.userData.tileId).toBeUndefined();o.geometry.addEventListener('dispose',()=>disposed++);}});
 for(let i=0;i<900;i++)a.update(.08);
 expect(a.lightFactor).toBeGreaterThanOrEqual(.94);expect(a.lightFactor).toBeLessThanOrEqual(1);
 a.group.traverse(o=>{if(o.isInstancedMesh)expect([...o.instanceMatrix.array].every(Number.isFinite)).toBe(true);});
 const time=a.time;for(const opts of [{visible:false},{enabled:false},{reduced:true}]){a.update(1,opts);expect(a.time).toBe(time);expect(a.lightFactor).toBe(1);}
 expect(a.group.visible).toBe(false);a.update(.08);expect(a.time).toBeGreaterThan(time);expect(a.group.visible).toBe(true);const count=a.group.children.length;a.dispose();expect(scene.children).toHaveLength(0);expect(disposed).toBe(count);
});
it('keeps compact mountain effects to two smoke puffs and no leaves or light cycle',()=>{
 const a=new SliceAmbience(new THREE.Scene(),{mapId:'shanhai-highland'});expect(a.group.children).toHaveLength(2);a.update(.08,{compact:true});expect(a.smoke.count).toBe(2);expect(a.leaves.visible).toBe(false);expect(a.lightFactor).toBe(1);a.update(.08);expect(a.smoke.count).toBe(3);expect(a.leaves.visible).toBe(true);a.dispose();
});
it('keeps compact coast effects to one bird and one fountain ripple',()=>{
 const a=new SliceAmbience(new THREE.Scene());a.update(.08,{compact:true});expect(a.waves.visible).toBe(false);expect(a.birds.filter(b=>b.visible)).toHaveLength(1);expect(a.ripples.filter(b=>b.visible)).toHaveLength(1);a.dispose();
});
