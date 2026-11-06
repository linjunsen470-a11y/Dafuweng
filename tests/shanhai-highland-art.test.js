import {it,expect} from 'vitest';
import * as THREE from 'three-modern';
import {makeHighlandPrefabs,highlandPropertyModel,makeHighlandLandscape} from '../src/shanhai/SliceHighlandArt.js';
import {SliceScene} from '../src/shanhai/SliceScene.js';
import {SHANHAI_HIGHLAND_MAP} from '../src/shanhai/SliceMap.js';

it('keeps sixteen original upgrades finite, bounded to their lots, progressively taller and under a small geometry budget',()=>{
 const pack=makeHighlandPrefabs(),palette=new Set();expect(pack.children).toHaveLength(16);
 for(const type of ['tea','kiln','ridge','exchange']){let height=0;for(let level=1;level<=4;level++){
  const model=pack.getObjectByName(`mountain_${type}_${level}`);let tris=0;model.traverse(m=>{if(m.isMesh){expect([...m.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);tris+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;palette.add(m.material.uuid);}});
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());expect(size.x).toBeLessThan(2.4);expect(size.z).toBeLessThan(2.4);expect(size.y).toBeGreaterThan(height);height=size.y;expect(tris).toBeLessThan(900);
 }}expect(palette.size).toBeLessThanOrEqual(11);
});
it('selects mountain architecture from existing property levels, leaving vacant sites and park commerce to the existing renderer',()=>{
 const pack=makeHighlandPrefabs();for(const tile of SHANHAI_HIGHLAND_MAP.tiles.filter(t=>t.type==='PROPERTY')){expect(highlandPropertyModel(tile,0)).toBeNull();for(let n=1;n<=4;n++)expect(pack.getObjectByName(highlandPropertyModel(tile,n))).toBeTruthy();}
 const tile=SHANHAI_HIGHLAND_MAP.tiles[12];expect(highlandPropertyModel(tile,1,'PARK')).toBeNull();expect(highlandPropertyModel(tile,3,'MALL')).toBe('mountain_exchange_3');
});
it('batches additional terrain and plants into bounded static draws and keeps geometry away from the playable road',()=>{
 const scene=Object.create(SliceScene.prototype);Object.assign(scene,{scene:new THREE.Scene(),scenery:new THREE.Group(),clonePrefab(name,x,z,scale){const g=new THREE.Group();g.position.set(x,.22,z);g.scale.setScalar(scale);this.scenery.add(g);return g;}});scene.scene.add(scene.scenery);const detail=makeHighlandLandscape(scene);expect(detail.userData.desktopOnly).toBe(true);detail.traverse(m=>{if(m.isMesh)expect(m.castShadow).toBe(false);});
 const batch=scene.batch(scene.scenery),extra=scene.batch(detail);expect(batch.children.length).toBeLessThanOrEqual(11);expect(extra.children.length).toBeLessThanOrEqual(2);let triangles=0;batch.traverse(m=>{if(m.isMesh){const a=m.geometry.attributes.position;triangles+=a.count/3;for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i);if(y<.15)continue;let min=Infinity;const tiles=SHANHAI_HIGHLAND_MAP.tiles;for(let t=0;t<tiles.length;t++){const a=tiles[t].position,b=tiles[(t+1)%tiles.length].position,dx=b.x-a.x,dz=b.z-a.z,u=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));min=Math.min(min,Math.hypot(x-a.x-u*dx,z-a.z-u*dz));}expect(min).toBeGreaterThan(1.4);}}});expect(triangles).toBeLessThan(2500);
});
