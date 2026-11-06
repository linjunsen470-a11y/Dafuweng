import {it,expect,vi} from 'vitest';import * as THREE from 'three-modern';
import {SliceScene} from '../src/shanhai/SliceScene.js';import {pawnPlacement} from '../src/shanhai/SlicePawnLayout.js';
function fixture(){
 const scene=Object.assign(Object.create(SliceScene.prototype),{scene:new THREE.Scene(),camera:new THREE.OrthographicCamera(-20,20,20,-20,.1,180),controls:{target:new THREE.Vector3(),update:vi.fn()},container:{parentElement:{classList:{toggle:vi.fn()}}},labels:[],tiles:[{id:9,type:'PROPERTY',position:{x:14,z:0},visualLot:{x:16.3,z:0,rotation:Math.PI/2}},{id:10,type:'CHANCE',position:{x:13,z:-3}}]});scene.makeSelection();scene.highlight(9);return scene;
}
it('clear view raises the camera and marks the selected lot without reallocating geometry',()=>{
 const s=fixture();s.pawns=[{ring:new THREE.Mesh(new THREE.RingGeometry(),new THREE.MeshBasicMaterial())}];const geometry=s.plotOutline.geometry,attributes=s.plotOutline.geometry.attributes.position,distances=s.plotOutline.geometry.attributes.lineDistance;
 expect(s.setClearView(true)).toBe(true);expect(s.camera.position.y).toBe(58);expect(s.controls.maxPolarAngle).toBe(.48);expect(s.selection.material.depthTest).toBe(false);expect(s.plotOutline.visible).toBe(true);expect(s.pawns[0].ring.material.depthTest).toBe(false);expect(s.pawns[0].ring.material.depthWrite).toBe(false);expect(attributes.count).toBe(10);expect(Array.from(attributes.array).every(Number.isFinite)).toBe(true);
 s.highlight(10);expect(s.plotOutline.visible).toBe(false);s.highlight(9);expect(s.plotOutline.geometry).toBe(geometry);expect(s.plotOutline.geometry.attributes.position).toBe(attributes);expect(s.plotOutline.geometry.attributes.lineDistance).toBe(distances);
 s.setClearView(false);expect(s.camera.position.toArray()).toEqual([26,34,35]);expect(s.controls.maxPolarAngle).toBe(1.12);expect(s.selection.material.depthTest).toBe(true);expect(s.plotOutline.visible).toBe(false);expect(s.pawns[0].ring.material.depthTest).toBe(true);
});
it('does not replace the character studio or tactic targeting camera',()=>{
 const s=fixture();s.characterPreview={};expect(s.setClearView(true)).toBe(false);s.characterPreview=null;s.tacticMode=true;expect(s.setClearView(true)).toBe(false);expect(s.clearView).toBeUndefined();s.tacticMode=false;s.setClearView(true);const pawn={playerId:0,root:new THREE.Group()};s.pawns=[pawn];s.scene.add(pawn.root);s.previewCharacter(0);expect(s.controls.maxPolarAngle).toBe(1.12);s.overview();expect(s.controls.maxPolarAngle).toBe(.48);expect(s.camera.position.y).toBe(58);
});
it('in clear view a four-person group follows the road tangent, away from the outside building lot',()=>{
 const tile={id:9,position:{x:14,z:0}},pawns=[0,1,2,3].map(playerId=>({playerId,tileId:9}));
 for(const p of pawns){const pos=pawnPlacement(tile,pawns,p.playerId,{x:12,z:16},{x:0,z:0},true);expect(pos.x).toBe(14);expect(Math.abs(pos.z)).toBeLessThanOrEqual(1.875);}
});
it('reduced-motion standing layout applies the new arrangement in one frame',()=>{
 const s=fixture();s.clearView=true;s.motionPreference={matches:true};s.pawns=[0,1].map(playerId=>({playerId,tileId:9,root:new THREE.Group(),model:new THREE.Group()}));s.layoutPawns(1/60);
 for(const p of s.pawns)expect(p.root.position.distanceTo(s.pawnDestination(9,p.playerId))).toBe(0);
});
