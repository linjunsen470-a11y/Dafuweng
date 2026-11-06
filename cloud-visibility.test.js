import {it,expect} from 'vitest';import * as THREE from 'three';
import {projectedBox,overlapsBoard} from './src/engine/CloudVisibility.js';
import {Scene3D} from './src/engine/Scene3D.js';
const board=new THREE.Box3(new THREE.Vector3(-63,0,-48),new THREE.Vector3(65,10,40));
for(const aspect of [360/640,1280/800])it(`protects the board through ordinary camera orientations at aspect${aspect}`,()=>{
 const c=new THREE.PerspectiveCamera(45,aspect,.1,1000),target=new THREE.Vector3(30,0,-36),local=new THREE.Box3(new THREE.Vector3(-2,-1,-2),new THREE.Vector3(2,1,2));
 for(const offset of [[5,28,32],[-32,28,5],[5,28,-32],[60,120,80]]){
 c.position.copy(target).add(new THREE.Vector3(...offset));c.lookAt(target);c.updateMatrixWorld();const m=new THREE.Matrix4().makeTranslation(...target.clone().lerp(c.position,.55).toArray());expect(overlapsBoard(projectedBox(local,c,m),projectedBox(board,c))).toBe(true);
 }
});
it('keeps clouds outside the protected overview visible, and honors clear daylight',()=>{
 const s=Object.create(Scene3D.prototype);s.camera=new THREE.PerspectiveCamera(45,1.6,.1,1000);s.camera.position.set(60,120,80);s.camera.lookAt(0,0,0);s.camera.updateMatrixWorld();s.clouds=new THREE.Group();s.cloudBoardBounds=board;s.weather='RAIN';s.timeOfDay='DAY';
 const cloud=new THREE.Group();cloud.userData.cloudBounds=new THREE.Box3(new THREE.Vector3(-2,-1,-2),new THREE.Vector3(2,1,2));cloud.position.set(30,60,40);s.clouds.add(cloud);s.updateCloudVisibility();expect(cloud.visible).toBe(false);
 cloud.position.set(200,20,-50);s.updateCloudVisibility();expect(cloud.visible).toBe(true);s.weather='CLEAR';s.updateCloudVisibility();expect(cloud.visible).toBe(false);
 s.weather='RAIN';s.cloudBoardBounds=null;cloud.position.set(30,60,40);s.updateCloudVisibility();expect(cloud.visible).toBe(true);
});
it('conservatively protects near-plane intersections rather than projecting inverted bounds',()=>{
 const c=new THREE.PerspectiveCamera(45,1,.1,1000);c.updateMatrixWorld();expect(projectedBox(new THREE.Box3(new THREE.Vector3(-1,-1,-1),new THREE.Vector3(1,1,1)),c)).toEqual({left:-1,right:1,bottom:-1,top:1});
});
