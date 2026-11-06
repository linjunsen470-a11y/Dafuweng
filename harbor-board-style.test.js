import {it,expect} from 'vitest';
import {harborTileStyle,harborForkDirections} from './src/engine/HarborBoardStyle.js';
import {GRAND_BAY_MAP} from './src/game/GrandMapData.js';
import {PawnManager} from './src/engine/PawnManager.js';
it('keeps facility identity on fork tiles and labels every existing tile',()=>{
 const before=JSON.stringify(GRAND_BAY_MAP);
 expect(harborTileStyle(GRAND_BAY_MAP.tiles[12])).toMatchObject({label:'银行',fork:true});
 for(const t of GRAND_BAY_MAP.tiles)expect(harborTileStyle(t).label.length).toBeGreaterThan(0);
 expect(JSON.stringify(GRAND_BAY_MAP)).toBe(before);
});
it('draws exactly the real outgoing fork directions with normalized vectors',()=>{
 const arrows=harborForkDirections(GRAND_BAY_MAP);
 const edges=GRAND_BAY_MAP.tiles.filter(t=>t.next?.length>1).flatMap(t=>t.next.map(to=>[t.id,to]));
 expect(arrows.map(a=>[a.from,a.to])).toEqual(edges);
 for(const a of arrows)expect(Math.hypot(a.dx,a.dz)).toBeCloseTo(1);
 expect(harborForkDirections({id:'other',tiles:GRAND_BAY_MAP.tiles})).toEqual([]);
});
it('keeps original pawn X/Z offsets but raises harbor feet and rings above tile surfaces',()=>{
 const p=Object.create(PawnManager.prototype);p.boardBuilder={activeMapDefinition:{id:'grand-bay'}};
 const harbor=Array.from({length:4},(_,i)=>p.getPawnOffset(i));p.boardBuilder.activeMapDefinition.id='other';
 harbor.forEach((a,i)=>{const b=p.getPawnOffset(i);expect(a.x).toBe(b.x);expect(a.z).toBe(b.z);expect(a.y).toBe(.2);expect(b.y).toBe(0);});
});

it('fades only an obstructing original residence and restores it when the pawn moves clear',async()=>{
 const THREE=await import('three');const {BoardBuilder}=await import('./src/engine/BoardBuilder.js');
 const b=Object.create(BoardBuilder.prototype);b.activeMapDefinition={id:'grand-bay'};b.tilePositions=[];const camera=new THREE.PerspectiveCamera(50,1,.1,100);camera.position.set(0,2,10);camera.lookAt(0,1,0);camera.updateMatrixWorld();b.scene3D={camera};
 const house=new THREE.Group();house.userData.originalModel='res_harbor_4';
 const model=new THREE.Mesh(new THREE.BoxGeometry(2,4,2),new THREE.MeshStandardMaterial());model.name='res_harbor_4';model.position.set(0,2,5);house.add(model);
 const owner=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());house.add(owner);b.buildingMeshes=new Map([[11,house]]);
 const mesh=new THREE.Group();b.updateHarborPawnVisibility([{mesh}],0);expect(model.material.opacity).toBe(.22);expect(owner.material.opacity).toBe(1);
 mesh.position.x=10;b.updateHarborPawnVisibility([{mesh}],200);expect(model.material.opacity).toBe(1);expect(model.material.transparent).toBe(false);expect(model.material.depthWrite).toBe(true);
});
