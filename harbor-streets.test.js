import {Scene3D} from './src/engine/Scene3D.js';
import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {HarborStreets,isHarborHome,facingRoad} from './src/engine/HarborStreets.js';
import {GRAND_BAY_MAP} from './src/game/GrandMapData.js';

describe('harbor artwork on existing main-game lots',()=>{
 it('only adapts harbor residential lots, preserving commercial/chain and other maps',()=>{
  const tile=GRAND_BAY_MAP.tiles[1];
  expect(isHarborHome(GRAND_BAY_MAP,tile,'RESIDENTIAL')).toBe(true);
  expect(isHarborHome(GRAND_BAY_MAP,tile,'CHAIN_STORE')).toBe(false);
  expect(isHarborHome(GRAND_BAY_MAP,GRAND_BAY_MAP.tiles[15],'MALL')).toBe(false);
  expect(isHarborHome({id:'shanhai-coast'},tile)).toBe(false);
  expect(isHarborHome(GRAND_BAY_MAP,GRAND_BAY_MAP.tiles[31])).toBe(false);
 });
 it('front doors face their road tile on both sides of the coast corner',()=>{
  for(const tile of GRAND_BAY_MAP.tiles.filter(t=>isHarborHome(GRAND_BAY_MAP,t))){
   const front=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),facingRoad(tile));
   const toward=new THREE.Vector3(tile.position.x-tile.lot.position.x,0,tile.position.z-tile.lot.position.z).normalize();
   expect(front.dot(toward)).toBeCloseTo(1);
  }
 });
 it('isolates instance disposal from the prefab and other occupied plots',()=>{
  const art=new HarborStreets();art.prefabs=new THREE.Group();
  const source=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());source.name='res_harbor_1';art.prefabs.add(source);
  const first=art.residence(1),second=art.residence(1);
  expect(first.geometry).not.toBe(source.geometry);expect(first.material).not.toBe(second.material);
  first.geometry.dispose();first.material.dispose();expect(second.geometry).not.toBe(first.geometry);
  expect(art.residence(4)).toBe(null);
 });
 it('frontage paths do not mutate graph or create playable branches',()=>{
  const before=JSON.stringify(GRAND_BAY_MAP);const art=new HarborStreets();
  const streets=art.streets(GRAND_BAY_MAP);
  expect(streets.children.filter(c=>c.userData.frontageTile!==undefined)).toHaveLength(42);
  expect(JSON.stringify(GRAND_BAY_MAP)).toBe(before);
  expect(GRAND_BAY_MAP.tiles[12].next).toEqual([13,84]);
 });
});

it('keeps initial daylight finite before any weather/time control is used',()=>{
 const view=Object.create(Scene3D.prototype);view.scene=new THREE.Scene();view.setupLighting();view.setupWeather();
 for(let i=0;i<3;i++)view.updateWeather();
 expect(view.ambientLight.intensity).toBe(.85);expect(Number.isFinite(view.ambientLight.intensity)).toBe(true);
});
