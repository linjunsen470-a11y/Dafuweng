import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three-modern';
import { GLTFLoader } from 'three-modern/addons/loaders/GLTFLoader.js';
import { SliceScene } from '../src/shanhai/SliceScene.js';
import { SHANHAI_COAST_MAP } from '../src/shanhai/SliceMap.js';
import { REGIONAL_SCENERY } from '../src/shanhai/SliceScenery.js';

let buildings,kit,manifest;
const load=async file=>{const b=await readFile(`public/shanhai/models/${file}`);return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;};
beforeAll(async()=>{
  [buildings,kit]=await Promise.all([load('buildings.glb'),load('neighborhoods.glb')]);
  manifest=JSON.parse(await readFile('public/shanhai/models/neighborhoods.manifest.json','utf8'));
});

describe('original regional scenery assets',()=>{
  it('loads seven complete original prefabs with finite geometry and a small triangle budget',()=>{
    let total=0;expect(manifest.prefabs).toHaveLength(7);
    for(const asset of manifest.prefabs){
      const root=kit.getObjectByName(asset.name);expect(root,asset.name).toBeTruthy();let triangles=0;
      root.traverse(o=>{if(o.isMesh){const pos=o.geometry.getAttribute('position');expect([...pos.array].every(Number.isFinite)).toBe(true);triangles+=(o.geometry.index?.count||pos.count)/3;}});
      expect(triangles).toBe(asset.triangles);total+=triangles;
    }
    expect(total).toBeLessThan(10000);
  });

  it('keeps all twelve scenery footprints away from numbered road tiles',()=>{
    expect(REGIONAL_SCENERY).toHaveLength(12);
    for(const item of REGIONAL_SCENERY){
      const clone=kit.getObjectByName(item.model).clone(true);
      clone.position.set(item.x,.22,item.z);clone.rotation.y=item.rotation;clone.scale.setScalar(item.scale);clone.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(clone);
      for(const tile of SHANHAI_COAST_MAP.tiles){
        const p=tile.position,dx=Math.max(bounds.min.x-p.x,0,p.x-bounds.max.x),dz=Math.max(bounds.min.z-p.z,0,p.z-bounds.max.z);
        expect(Math.hypot(dx,dz),`${item.model} overlaps road ${tile.id}`).toBeGreaterThan(.65);
      }
    }
  });

  it('shares the existing palette and caches regional materials without recoloring source assets',()=>{
    const scene=Object.create(SliceScene.prototype);scene.prefabs=buildings;scene.scenery=new THREE.Group();
    const baseMaterials=new Set();buildings.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])baseMaterials.add(m);});
    const roof=[...baseMaterials].find(m=>m.name==='coral'),original=roof.color.getHexString();
    scene.adoptNeighborhoods(kit);
    for(const item of REGIONAL_SCENERY)scene.prefabs.getObjectByName(item.model).traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])expect(baseMaterials.has(m)).toBe(true);});
    expect(scene.regionalMaterial(roof,'MARKET').color.getHexString()).toBe('527e94');
    expect(scene.regionalMaterial(roof,'GARDEN').color.getHexString()).toBe('719166');
    expect(scene.regionalMaterial(roof,'MARKET')).toBe(scene.regionalMaterial(roof,'MARKET'));
    expect(scene.regionalMaterial(roof,'HARBOR')).toBe(roof);expect(roof.color.getHexString()).toBe(original);
    for(const region of ['HARBOR','MARKET','GARDEN'])for(let level=0;level<=4;level++)expect(scene.clonePrefab(`property_level${level}`,0,0,1,0,scene.scenery,region)).toBeTruthy();
  });
});
