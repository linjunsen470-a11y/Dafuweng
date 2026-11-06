import {it,expect} from 'vitest';
import * as THREE from 'three';
import {createMagicFrontage} from './src/engine/MagicFrontage.js';
import {GRAND_BAY_MAP as map} from './src/game/GrandMapData.js';

it('keeps the replacement within the old roadside footprint and below the label',()=>{
 const model=createMagicFrontage();model.updateMatrixWorld(true);let triangles=0;
 model.traverse(mesh=>{if(!mesh.isMesh)return;triangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);expect(Math.hypot(v.x,v.z)).toBeLessThan(1.93);}});
 expect(triangles).toBeLessThan(500);expect(new THREE.Box3().setFromObject(model).max.y).toBeLessThan(3.5);expect(model.userData.isStaticFacility).toBe(true);
});
it('leaves the existing east-coast road and adjacent lots clear',()=>{
 const model=createMagicFrontage();model.position.set(57.7,.22,12);model.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(model);
 for(const tile of map.tiles){const {x,z}=tile.position;const dx=Math.max(b.min.x-x,0,x-b.max.x),dz=Math.max(b.min.z-z,0,z-b.max.z);expect(Math.hypot(dx,dz),`tile ${tile.id}`).toBeGreaterThan(1.5);
  if(tile.lot){const p=tile.lot.position;expect(p.x+1.75<b.min.x||p.x-1.75>b.max.x||p.z+1.75<b.min.z||p.z-1.75>b.max.z,`lot ${tile.id}`).toBe(true);}
 }
});
