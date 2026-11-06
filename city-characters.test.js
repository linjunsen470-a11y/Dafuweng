import { CITY_CHARACTER_PROFILE_IDS } from './src/engine/CityCharacterProfiles.js';
import {it,expect,vi} from 'vitest';import * as THREE from 'three';
import {createCityCharacter,poseCityCharacter,disposeCityCharacter} from './src/engine/CityCharacters.js';
import {PawnManager} from './src/engine/PawnManager.js';import {PLAYER_PROFILES} from './src/game/BoardData.js';
it('gives sixteen supported profiles independent readable full-body rigs within the crowd footprint',()=>{
 for(const p of PLAYER_PROFILES.filter(p=>CITY_CHARACTER_PROFILE_IDS.includes(p.id))){const model=createCityCharacter(p),bounds=new THREE.Box3().setFromObject(model);expect(model.cityRig.legs.length).toBe(2);expect(model.cityRig.arms.length).toBe(2);expect(bounds.max.x-bounds.min.x).toBeLessThan(1.25);expect(bounds.max.y).toBeLessThan(2.25);expect(bounds.min.y).toBeGreaterThanOrEqual(.03);let triangles=0;model.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});expect(triangles).toBeLessThan(6000);disposeCityCharacter(model);}
 expect(CITY_CHARACTER_PROFILE_IDS).toEqual(PLAYER_PROFILES.map(p=>p.id));
 expect(createCityCharacter({id:99})).toBe(null);
});
it('alternates arms against legs and resets all motion for reduced/idle poses',()=>{
 const m=createCityCharacter(PLAYER_PROFILES[0]);poseCityCharacter(m,.25);expect(m.cityRig.legs[0].rotation.x).toBeGreaterThan(.5);expect(m.cityRig.arms[0].rotation.x).toBeLessThan(0);poseCityCharacter(m,.75);expect(m.cityRig.legs[0].rotation.x).toBeLessThan(-.5);poseCityCharacter(m,.25,true);expect(m.position.y).toBe(0);for(const o of [...m.cityRig.legs,...m.cityRig.arms])expect(o.rotation.x).toBeCloseTo(0);disposeCityCharacter(m);
});
for(const reduced of [false,true])it(`keeps real movement endpoints and duration with reduced=${reduced}`,async()=>{
 vi.useFakeTimers({toFake:['performance','setTimeout','clearTimeout']});vi.stubGlobal('document',{documentElement:{classList:{contains:()=>reduced}}});vi.stubGlobal('window',{matchMedia:()=>({matches:false})});vi.stubGlobal('requestAnimationFrame',cb=>setTimeout(()=>cb(performance.now()),16));
 const model=createCityCharacter(PLAYER_PROFILES[0]),root=new THREE.Group();root.add(model);root.position.set(0,.48,0);const pm=new PawnManager({},{});pm.animateHopDuration=220;let completed=0;
 try{const move=pm.animateHop(root,new THREE.Vector3(4,.48,0)).then(()=>completed++);await vi.advanceTimersByTimeAsync(64);expect(root.position.x).toBeGreaterThan(0);expect(root.position.x).toBeLessThan(4);expect(root.position.y).toBe(.48);expect(model.rotation.y).toBeCloseTo(Math.PI/2);if(reduced)expect(model.cityRig.legs[0].rotation.x).toBeCloseTo(0);else expect(Math.abs(model.cityRig.legs[0].rotation.x)).toBeGreaterThan(.1);expect(completed).toBe(0);await vi.advanceTimersByTimeAsync(180);await move;expect(completed).toBe(1);expect(root.position.toArray()).toEqual([4,.48,0]);expect(root.userData.isMoving).toBe(false);expect(model.cityRig.legs[0].rotation.x).toBe(0);await vi.advanceTimersByTimeAsync(1300);expect(completed).toBe(1);
 }finally{disposeCityCharacter(model);vi.unstubAllGlobals();vi.useRealTimers();}
});
it('disposes only the removed character resources on restore',()=>{
 const a=createCityCharacter(PLAYER_PROFILES[0]),b=createCityCharacter(PLAYER_PROFILES[0]),pm=new PawnManager({scene:new THREE.Scene()},{}),root=new THREE.Group();root.add(a);const materials=new Set();a.traverse(o=>{if(o.material)materials.add(o.material);});const spies=[...materials].map(m=>vi.spyOn(m,'dispose'));const other=vi.spyOn(b.children[0].children[0].material,'dispose');pm.pawns=[{mesh:root,characterMesh:a}];pm.clearPawns();for(const spy of spies)expect(spy).toHaveBeenCalledTimes(1);expect(other).not.toHaveBeenCalled();expect(pm.pawns).toEqual([]);disposeCityCharacter(b);
});
