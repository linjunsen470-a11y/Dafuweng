import {it,expect} from 'vitest';import * as THREE from 'three';
import {ISLAND_OUTLINE as ring,COAST_WATER_Y,createIslandSurfaceGeometry,createIslandCoast} from './src/engine/IslandCoast.js';
import {GRAND_BAY_MAP as map} from './src/game/GrandMapData.js';import {harborFacility} from './src/engine/HarborFacilities.js';
const inside=(x,z)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
const circle=(x,z,r,label)=>{for(let i=0;i<32;i++){const a=i*Math.PI/16;expect(inside(x+Math.cos(a)*r,z+Math.sin(a)*r),label).toBe(true);}};
it('keeps every existing road shoulder, lot and facility on dry land',()=>{
 for(const tile of map.tiles){circle(tile.position.x,tile.position.z,2.4,`tile ${tile.id}`);if(tile.lot)circle(tile.lot.position.x,tile.lot.position.z,2.6,`lot ${tile.id}`);const f=harborFacility(map,tile);if(f)circle(f.x,f.z,Math.hypot(f.width,f.depth)/2+.25,`service ${tile.id}`);
  for(const next of tile.next){const b=map.tiles[next].position;for(let t=0;t<=1;t+=.1)circle(tile.position.x+(b.x-tile.position.x)*t,tile.position.z+(b.z-tile.position.z)*t,2.1,`edge ${tile.id}→${next}`);}
 }
 circle(-59,-16,1.92,'hospital72');circle(60,37,1.2,'lighthouse');for(let x=-52;x<=52;x++)expect(inside(x,36.35),'harbor promenade').toBe(true);
});
it('clips the original texture without moving its world-space coordinates',()=>{
 const g=createIslandSurfaceGeometry(),p=g.attributes.position,uv=g.attributes.uv;expect(g.index.count/3).toBe(ring.length-2);
 for(let i=0;i<p.count;i++){expect(uv.getX(i)).toBeCloseTo((p.getX(i)+71)/142,6);expect(uv.getY(i)).toBeCloseTo((p.getY(i)+43)/92,6);}
});
it('uses a bounded low-poly slope below the board and a lower sea level',()=>{
 const coast=createIslandCoast();coast.updateMatrixWorld(true);const slope=coast.getObjectByName('island-coast-slope'),core=coast.getObjectByName('city-island-core');const bound=new THREE.Box3().setFromObject(coast);
 expect(new THREE.Box3().setFromObject(core).max.y).toBeCloseTo(-.105);expect(bound.max.y).toBeLessThan(0);expect(COAST_WATER_Y).toBeLessThan(-.105);expect(COAST_WATER_Y).toBeGreaterThan(-.72);expect(slope.geometry.attributes.position.count/3).toBe(ring.length*2);
 let tris=0;coast.traverse(n=>{if(n.isMesh)tris+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;});expect(tris).toBeLessThan(400);
 const normals=slope.geometry.attributes.normal;for(let i=0;i<normals.count;i++)expect(normals.getY(i)).toBeGreaterThan(0);
});
