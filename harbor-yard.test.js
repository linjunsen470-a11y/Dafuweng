import {it,expect} from 'vitest';
import * as THREE from 'three';
import {createHarborWorkingYard} from './src/engine/HarborWorkingYard.js';
import {GRAND_BAY_MAP as map} from './src/game/GrandMapData.js';

function crosses(a,b,box,margin=0){
 let low=0,high=1;for(const [key,i] of [['x',0],['z',2]]){const d=b[key]-a[key],min=box.min[i]-margin,max=box.max[i]+margin;if(Math.abs(d)<1e-8){if(a[key]<min||a[key]>max)return false;}else{let l=(min-a[key])/d,h=(max-a[key])/d;if(l>h)[l,h]=[h,l];low=Math.max(low,l);high=Math.min(high,h);if(low>high)return false;}}return true;
}
it('keeps every solid backdrop and tree clear of all original roads and property plots',()=>{
 const g=createHarborWorkingYard(map);
 for(const bounds of g.userData.solidFootprints){for(const a of map.tiles){for(const id of a.next)expect(crosses(a.position,map.tiles[id].position,bounds,1.55),`road ${a.id}→${id}`).toBe(false);
 if(a.lot){const p=a.lot.position;expect(p.x+1.75<bounds.min[0]||p.x-1.75>bounds.max[0]||p.z+1.75<bounds.min[2]||p.z-1.75>bounds.max[2],`plot ${a.id}`).toBe(true);}}}
});
it('batches static street scenery and leaves topology and state-independent geometry intact',()=>{
 const before=JSON.stringify(map),g=createHarborWorkingYard(map),again=createHarborWorkingYard(map);expect(g.children.length).toBeLessThanOrEqual(5);
 let triangles=0;for(const [i,m] of g.children.entries()){triangles+=m.geometry.attributes.position.count/3;expect(Array.from(m.geometry.attributes.position.array)).toEqual(Array.from(again.children[i].geometry.attributes.position.array));}
 expect(triangles).toBeLessThan(1000);expect(new THREE.Box3().setFromObject(g).max.y).toBeLessThan(3);expect(JSON.stringify(map)).toBe(before);expect(createHarborWorkingYard({id:'other'}).children.length).toBe(0);
});
