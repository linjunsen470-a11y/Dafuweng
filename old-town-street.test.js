import {it,expect} from 'vitest';import * as THREE from 'three';
import {isOldTownHome,isOldTownView,oldTownOffset} from './src/engine/OldTownStreet.js';
import {GRAND_BAY_MAP} from './src/game/GrandMapData.js';import {HarborStreets} from './src/engine/HarborStreets.js';
it('adapts the existing old-city homes and three mountain-branch plots',()=>{
 const before=JSON.stringify(GRAND_BAY_MAP);
 expect(GRAND_BAY_MAP.tiles.filter(t=>isOldTownHome(GRAND_BAY_MAP,t)).map(t=>t.id)).toEqual([31,33,36,38,41,43,46,48,51,53,56,58,101,103,106]);
 expect(isOldTownHome(GRAND_BAY_MAP,GRAND_BAY_MAP.tiles[31],'CHAIN_STORE')).toBe(false);
 expect(isOldTownHome({id:'shanhai-coast'},GRAND_BAY_MAP.tiles[31])).toBe(false);
 expect(JSON.stringify(GRAND_BAY_MAP)).toBe(before);expect(GRAND_BAY_MAP.tiles[36].next).toEqual([37,96]);
});
it('recolors a cloned old-town residence without altering the source or harbor models',()=>{
 const a=new HarborStreets();a.prefabs=new THREE.Group();const source=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({color:'#d66d50'}));source.name='res_market_1';source.material.name='coral';a.prefabs.add(source);
 const clone=a.residence(1,'market');expect(clone.material.color.getHexString()).toBe('566b65');expect(source.material.color.getHexString()).toBe('d66d50');
 expect(clone.material).not.toBe(source.material);
});
it('orients normal and landing cameras across the old street without changing other views',()=>{
 const offset={x:0,y:9,z:11},p={x:54,z:0};expect(oldTownOffset('grand-bay',p,offset)).toEqual({x:11,y:9,z:0});expect(offset).toEqual({x:0,y:9,z:11});
 for(const p of [{x:-22,z:28},{x:50,z:-16},{x:54,z:-36}])expect(isOldTownView('grand-bay',p)).toBe(false);
 expect(oldTownOffset('other',{x:54,z:0},offset)).toEqual(offset);
});
