import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {GRAND_BAY_MAP} from './src/game/GrandMapData.js';
import {harborFacility,facilityFacing} from './src/engine/HarborFacilities.js';
import {HarborStreets} from './src/engine/HarborStreets.js';
import {BoardBuilder} from './src/engine/BoardBuilder.js';

describe('existing harbor services remain distinct from their road graph',()=>{
 it('places all adapted building footprints outside every road shoulder',()=>{
  for(const tile of GRAND_BAY_MAP.tiles){
   const spec=harborFacility(GRAND_BAY_MAP,tile);if(!spec)continue;
   const center=new THREE.Vector3(spec.x,0,spec.z);
   const radius=Math.hypot(spec.width,spec.depth)/2;
   for(const a of GRAND_BAY_MAP.tiles)for(const next of a.next||[]){
    const b=GRAND_BAY_MAP.tiles.find(t=>t.id===next);
    const edge=new THREE.Line3(new THREE.Vector3(a.position.x,0,a.position.z),new THREE.Vector3(b.position.x,0,b.position.z));
    const distance=center.distanceTo(edge.closestPointToPoint(center,true,new THREE.Vector3()));
    expect(distance,`${tile.id} facility versus ${a.id} → ${next}`).toBeGreaterThan(radius+1.75);
   }
   const front=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),facilityFacing(tile,spec));
   expect(front.dot(new THREE.Vector3(tile.position.x-spec.x,0,tile.position.z-spec.z).normalize())).toBeCloseTo(1);
  }
 });
 it('limits the adapter to exact existing services and leaves graph/economy data untouched',()=>{
  const before=JSON.stringify(GRAND_BAY_MAP);const art=new HarborStreets();
  const streets=art.streets(GRAND_BAY_MAP);
  expect(streets.children.filter(c=>c.userData.serviceTile!==undefined).map(c=>c.userData.serviceTile)).toEqual([7,9,12,32,47,57,65,79,82,89,99,102,109,112]);
  expect(harborFacility({id:'shanhai-coast'},GRAND_BAY_MAP.tiles[7])).toBeUndefined();
  expect(harborFacility(GRAND_BAY_MAP,{id:12,type:'ROAD'})).toBeUndefined();
  expect(JSON.stringify(GRAND_BAY_MAP)).toBe(before);
  expect(GRAND_BAY_MAP.tiles).toHaveLength(120);expect(GRAND_BAY_MAP.tiles[12].next).toEqual([13,84]);
 });
 it('renders bank identity before fork decoration, including before models are available',()=>{
  const board=Object.create(BoardBuilder.prototype);board.scene3D={scene:new THREE.Scene()};
  board.specialTileMeshes=new Map();board.vacantLotMeshes=new Map();board.tilePositions=[];
  const tile=GRAND_BAY_MAP.tiles[12];board.tilePositions[12]=new THREE.Vector3(tile.position.x,0,tile.position.z);
  board.createHarborFacility=(t,s)=>{const g=new THREE.Group();g.userData.serviceTile=t.id;return g;};
  board.createForkLandmark=()=>{throw new Error('Bank hidden behind fork marker');};
  board.rebuildMapLandmarks({id:'grand-bay',tiles:[tile]});
  const bank=board.specialTileMeshes.get(12);expect(bank.userData.serviceTile).toBe(12);expect(bank.position.x).toBe(-3);expect(bank.position.z).toBe(21.6);
  board.rebuildMapLandmarks({id:'grand-bay',tiles:[tile]});expect(board.scene3D.scene.children).toHaveLength(1);
 });
});
