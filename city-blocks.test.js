import {it,expect} from 'vitest';
import * as THREE from 'three';
import {CITY_BLOCK_SITES,createCityBlock} from './src/engine/CityBlocks.js';
import {GRAND_BAY_MAP as map} from './src/game/GrandMapData.js';
import {BoardBuilder} from './src/engine/BoardBuilder.js';
it('keeps seven existing sites clear of all road segments with lower silhouettes',()=>{
 expect(CITY_BLOCK_SITES.map(s=>[s.x,s.z])).toEqual([[8,-7],[14,-7],[8,-14],[14,-14],[2,-13],[17,0],[3,0]]);
 let totalMeshes=0;
 for(const [i,s] of CITY_BLOCK_SITES.entries()){
  const g=createCityBlock(s.height,i);g.position.set(s.x,0,s.z);g.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(g);
  expect(bounds.min.y).toBeCloseTo(0);expect(bounds.max.y).toBeLessThan(7);g.traverse(n=>{if(n.isMesh)totalMeshes++;});
  const radius=Math.hypot(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z)/2,center=new THREE.Vector3(s.x,0,s.z);
  for(const a of map.tiles)for(const id of a.next){const b=map.tiles[id],line=new THREE.Line3(new THREE.Vector3(a.position.x,0,a.position.z),new THREE.Vector3(b.position.x,0,b.position.z));expect(center.distanceTo(line.closestPointToPoint(center,true,new THREE.Vector3()))).toBeGreaterThan(radius+1.75);}
 }
 expect(totalMeshes).toBeLessThan(150);
});
it('retains night feedback without replacing the daytime palette',()=>{
 const b=Object.create(BoardBuilder.prototype);b.buildingMeshes=new Map();b.mapEnvironmentGroup=createCityBlock(5.4,1);
 const windows=[];b.mapEnvironmentGroup.traverse(n=>{if(n.userData.isOriginalCityWindow)windows.push(n);});const colors=windows.map(n=>n.material.color.getHex());
 b.setNightMode(true);windows.forEach(n=>expect(n.material.emissiveIntensity).toBe(.5));b.setNightMode(false);expect(windows.map(n=>n.material.color.getHex())).toEqual(colors);windows.forEach(n=>expect(n.material.emissiveIntensity).toBe(0));
});
it('fades the actual new block without affecting its neighbor and restores opacity',()=>{
 const b=Object.create(BoardBuilder.prototype);b.activeMapDefinition={id:'grand-bay'};b.tilePositions=[];b.buildingMeshes=new Map();b.mapEnvironmentGroup=new THREE.Group();
 const camera=new THREE.PerspectiveCamera(50,1,.1,100);camera.position.set(0,2,10);camera.lookAt(0,1,0);camera.updateMatrixWorld();b.scene3D={camera};
 const block=createCityBlock(4.8),other=createCityBlock(4.8);block.position.z=5;other.position.set(10,0,5);b.mapEnvironmentGroup.add(block,other);const mesh=new THREE.Group();b.updateHarborPawnVisibility([{mesh}],0);
 expect(block.children[0].material.opacity).toBe(.22);expect(other.children[0].material.opacity).toBe(1);mesh.position.x=-10;b.updateHarborPawnVisibility([{mesh}],200);expect(block.children[0].material.opacity).toBe(1);
});
