import {it,expect} from 'vitest';
import * as THREE from 'three';
import {harborPawnSlot} from './src/engine/HarborPawnLayout.js';
import {BoardBuilder} from './src/engine/BoardBuilder.js';
it('spreads 2–4 occupants in stable screen order for cardinal and oblique views',()=>{
 for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI])for(const count of [2,3,4]){
  const right={x:Math.cos(angle),z:Math.sin(angle)};
  const slots=Array.from({length:count},(_,i)=>harborPawnSlot(i,count,right));
  expect(slots.reduce((a,s)=>a+s.x,0)).toBeCloseTo(0);expect(slots.reduce((a,s)=>a+s.z,0)).toBeCloseTo(0);
  for(let i=1;i<count;i++)expect((slots[i].x-slots[i-1].x)*right.x+(slots[i].z-slots[i-1].z)*right.z).toBeGreaterThanOrEqual(1.09);
  expect(Math.max(...slots.map(s=>Math.hypot(s.x,s.z)))).toBeLessThanOrEqual(1.66);
 }
});
it('fades a blocking tree or old tower but restores it and leaves the neighboring tree solid',()=>{
 const b=Object.create(BoardBuilder.prototype);b.activeMapDefinition={id:'grand-bay'};b.tilePositions=[];b.buildingMeshes=new Map();b.mapEnvironmentGroup=new THREE.Group();
 const camera=new THREE.PerspectiveCamera(50,1,.1,100);camera.position.set(0,2,10);camera.lookAt(0,1,0);camera.updateMatrixWorld();b.scene3D={camera};
 const tree=new THREE.Mesh(new THREE.BoxGeometry(2,4,2),new THREE.MeshBasicMaterial());tree.position.set(0,2,5);tree.userData.harborOccluder='tree';b.mapEnvironmentGroup.add(tree);
 const neighbor=tree.clone();neighbor.material=tree.material.clone();neighbor.position.x=4;b.mapEnvironmentGroup.add(neighbor);
 const mesh=new THREE.Group();b.updateHarborPawnVisibility([{mesh}],0);expect(tree.material.opacity).toBe(.22);expect(neighbor.material.opacity).toBe(1);
 tree.userData.harborOccluder='tower';mesh.position.x=-10;b.updateHarborPawnVisibility([{mesh}],200);expect(tree.material.opacity).toBe(1);expect(tree.material.depthWrite).toBe(true);
});
