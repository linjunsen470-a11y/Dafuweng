import {it,expect,vi} from 'vitest';import * as THREE from 'three';
import {Scene3D} from './src/engine/Scene3D.js';
function view(){const v=Object.create(Scene3D.prototype);v.activeMapId='grand-bay';v.container={clientWidth:1440};v.camera={position:new THREE.Vector3(-50,22,40)};v.controls={target:new THREE.Vector3(-50,0,28),update:vi.fn()};v.followedObject={position:new THREE.Vector3(-50,0,28)};return v;}
it('hands camera focus back from a distant AI without snapping normal-speed view',()=>{
 const v=view(),position=new THREE.Vector3(54,0,0),before=v.camera.position.clone();v.showStreetView(position,true);
 expect(v.followedObject).toBe(null);expect(v.camera.position.equals(before)).toBe(true);expect(v.targetLookAt.toArray()).toEqual([53,0,-3]);expect(v.targetCameraPos.toArray()).toEqual([81,22,2]);expect(position.toArray()).toEqual([54,0,0]);
});
it('uses the compact street framing immediately for reduced-motion/fast handoffs',()=>{
 const v=view();v.container.clientWidth=390;v.targetLookAt=new THREE.Vector3();v.showStreetView(new THREE.Vector3(34,0,-36));
 expect(v.followedObject).toBe(null);expect(v.targetLookAt).toBe(null);expect(v.targetCameraPos).toBe(null);expect(v.controls.target.toArray()).toEqual([38,0,-33]);expect(v.camera.position.toArray()).toEqual([43,28,-1]);expect(v.controls.update).toHaveBeenCalledOnce();
});
