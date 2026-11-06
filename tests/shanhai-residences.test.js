import { readFile } from 'node:fs/promises';
import { beforeAll, describe, it, expect } from 'vitest';
import * as THREE from 'three-modern';
import { GLTFLoader } from 'three-modern/addons/loaders/GLTFLoader.js';
import { residenceModel } from '../src/shanhai/SliceScenery.js';
import { SHANHAI_COAST_MAP } from '../src/shanhai/SliceMap.js';
import { SliceAmbience } from '../src/shanhai/SliceAmbience.js';
import { SliceScene } from '../src/shanhai/SliceScene.js';

let pack,manifest;
beforeAll(async()=>{
 const bytes=await readFile('public/shanhai/models/residences.glb');
 pack=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 manifest=JSON.parse(await readFile('public/shanhai/models/residences.manifest.json','utf8'));
});

describe('regional residences and lightweight ambience',()=>{
 it('contains twelve finite, compact house models with increasing height in every region',()=>{
  expect(manifest.prefabs).toHaveLength(12);
  for(const region of ['harbor','market','garden']){
   let height=0;
   for(let level=1;level<=4;level++){
    const name=`res_${region}_${level}`,root=pack.getObjectByName(name),entry=manifest.prefabs.find(p=>p.name===name);
    expect(root).toBeTruthy();let triangles=0;
    root.traverse(o=>{if(o.isMesh){const pos=o.geometry.getAttribute('position');expect([...pos.array].every(Number.isFinite)).toBe(true);triangles+=(o.geometry.index?.count||pos.count)/3;}});
    expect(triangles).toBe(entry.triangles);expect(triangles).toBeLessThan(5500);
    const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());
    expect(size.x).toBeLessThan(2.4);expect(size.z).toBeLessThan(2.4);expect(size.y).toBeGreaterThan(height);height=size.y;
   }
  }
 });
 it('maps existing tile/level data directly and preserves vacant lots and the commercial market',()=>{
  for(const tile of SHANHAI_COAST_MAP.tiles.filter(t=>t.type==='PROPERTY')){
   expect(residenceModel(tile,0)).toBe('property_level0');
   for(let level=1;level<=4;level++)expect(pack.getObjectByName(residenceModel(tile,level))).toBeTruthy();
  }
  for(let level=0;level<=4;level++)expect(residenceModel(SHANHAI_COAST_MAP.tiles[12],level)).toBe('market');
 });
 it('refreshes owner and level badges without accumulating labels, including after a property changes hands',()=>{
  const scene=Object.create(SliceScene.prototype),labels=[];
  Object.assign(scene,{prefabs:{},scene:new THREE.Scene(),propertyGroup:new THREE.Group(),labels:[],renderer:{shadowMap:{}},tiles:[{...SHANHAI_COAST_MAP.tiles[9],visualLot:{x:0,z:0,rotation:0}}],clonePrefab:()=>new THREE.Group(),batch:g=>g,addLabel(text,position){const l={textContent:text,position,style:{},dataset:{},classList:{contains:c=>c==='property-badge',toggle(){}},remove(){this.removed=true;}};labels.push(l);this.labels.push({label:l});return l;}});
  const players=[{name:'阿屿',color:'#f5816c'},{name:'青禾',color:'#42b8a6'}];
  const draw=(owner,level)=>scene.syncProperties({players,propertyManager:{getProperty:()=>({owner,level})}});
  draw(0,1);expect(scene.propertyBadges.get(9).textContent).toBe('阿屿 · L1');expect(scene.propertyVisuals[0].model).toBe('res_market_1');
  draw(1,4);expect(labels[0].removed).toBe(true);expect(scene.labels).toHaveLength(1);expect(scene.propertyBadges.get(9).textContent).toBe('青禾 · L4');
  draw(null,0);expect(scene.propertyBadges.size).toBe(0);expect(scene.labels).toHaveLength(0);
 });
 it('animates only five tiny meshes, freezes offscreen and hides motion when reduced motion is requested',()=>{
  const scene=new THREE.Scene(),ambient=new SliceAmbience(scene);expect(ambient.group.children).toHaveLength(5);
  const before=ambient.birds[0].position.clone();ambient.update(.05);expect(ambient.birds[0].position.equals(before)).toBe(false);
  for(const ring of ambient.ripples)expect(ring.material.forceSinglePass).toBe(true);
  const t=ambient.time;ambient.update(.05,{visible:false});expect(ambient.time).toBe(t);
  ambient.update(.05,{reduced:true});expect(ambient.time).toBe(t);expect(ambient.group.visible).toBe(false);
  ambient.update(.05);expect(ambient.group.visible).toBe(true);expect(ambient.time).toBeGreaterThan(t);
  ambient.group.traverse(o=>{if(o.isMesh)expect(o.castShadow).toBe(false);});ambient.dispose();expect(scene.children).toHaveLength(0);
 });
});
