import {it,expect} from 'vitest';import {readFileSync} from 'node:fs';import * as THREE from 'three';import {GRAND_BAY_MAP as map} from './src/game/GrandMapData.js';import {isCivicHome} from './src/engine/CivicStreet.js';import {harborFacility} from './src/engine/HarborFacilities.js';
it('uses the existing original bank model inside the new roadside footprint',()=>{
 const m=JSON.parse(readFileSync('public/shanhai/models/civic-street.manifest.json')).models.find(m=>m.prefab==='civic_bank'),spec=harborFacility(map,map.tiles[112]);const [w,d,h]=m.size_xyz_blender;expect(spec.model).toBe(m.prefab);expect(w).toBeLessThanOrEqual(spec.width+.001);expect(d).toBeLessThanOrEqual(spec.depth+.001);expect(h).toBeLessThan(spec.height);
});
it('keeps the adapted homes clear of every road including corrected return-bend lots',()=>{
 const models=JSON.parse(readFileSync('public/shanhai/models/civic-street.manifest.json')).models.filter(m=>m.prefab.startsWith('res_civic_'));const radius=Math.max(...models.map(m=>Math.hypot(...m.size_xyz_blender.slice(0,2))/2));
 for(const id of [108,111,113,116,118]){expect(isCivicHome(map,map.tiles[id])).toBe(true);const t=map.tiles[id],c=new THREE.Vector3(t.lot.position.x,0,t.lot.position.z);for(const a of map.tiles)for(const next of a.next){const b=map.tiles[next],edge=new THREE.Line3(new THREE.Vector3(a.position.x,0,a.position.z),new THREE.Vector3(b.position.x,0,b.position.z));expect(c.distanceTo(edge.closestPointToPoint(c,true,new THREE.Vector3())),`${id} near ${a.id}→${next}`).toBeGreaterThan(radius+map.roadWidth/2);}}
 expect(map.tiles[119].next).toEqual([72]);
});
