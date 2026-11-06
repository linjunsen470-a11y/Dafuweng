import {it,expect} from 'vitest';import {readFileSync} from 'node:fs';import * as THREE from 'three';
import {GRAND_BAY_MAP as map} from './src/game/GrandMapData.js';import {harborFacility} from './src/engine/HarborFacilities.js';
it('keeps the original company hall inside the service clearance specification',()=>{
 const model=JSON.parse(readFileSync('public/shanhai/models/company-court.manifest.json')).models[0],spec=harborFacility(map,map.tiles[89]);
 expect(model.prefab).toBe(spec.model);const [w,d,h]=model.size_xyz_blender;expect(w).toBeLessThanOrEqual(spec.width+.001);expect(d).toBeLessThanOrEqual(spec.depth+.001);expect(h).toBeLessThan(spec.height);
});
it('keeps all four adapted branch homes clear of every existing road segment',()=>{
 const models=JSON.parse(readFileSync('public/shanhai/models/civic-street.manifest.json')).models.filter(m=>m.prefab.startsWith('res_civic_'));
 const radius=Math.max(...models.map(m=>Math.hypot(...m.size_xyz_blender.slice(0,2))/2));
 for(const id of [86,88,91,93]){const t=map.tiles[id],c=new THREE.Vector3(t.lot.position.x,0,t.lot.position.z);for(const a of map.tiles)for(const next of a.next){const b=map.tiles[next];const edge=new THREE.Line3(new THREE.Vector3(a.position.x,0,a.position.z),new THREE.Vector3(b.position.x,0,b.position.z));expect(c.distanceTo(edge.closestPointToPoint(c,true,new THREE.Vector3())),`${id} near ${a.id}→${next}`).toBeGreaterThan(radius+map.roadWidth/2);}}
});
