import fs from 'node:fs/promises';
import * as THREE from 'three-modern';
import { GLTFLoader } from 'three-modern/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three-modern/addons/exporters/GLTFExporter.js';
import { SliceScene } from '../src/shanhai/SliceScene.js';
import { SHANHAI_COAST_MAP } from '../src/shanhai/SliceMap.js';
// Geometry-only QA. This does not instantiate a browser or claim WebGL validation.
globalThis.document={createElement:()=>({width:128,height:128,getContext:()=>({clearRect(){},fillText(){}})})};
globalThis.FileReader=class { readAsArrayBuffer(blob){blob.arrayBuffer().then(buffer=>{this.result=buffer;this.onloadend?.();});} readAsDataURL(blob){blob.arrayBuffer().then(buffer=>{this.result=`data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;this.onloadend?.();});} };
const load=async name=>{const b=await fs.readFile(`public/shanhai/models/${name}`);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const world=Object.create(SliceScene.prototype);Object.assign(world,{scene:new THREE.Scene(),scenery:new THREE.Group(),tiles:SHANHAI_COAST_MAP.tiles.map(t=>structuredClone(t)),selectables:[],propertyGroup:new THREE.Group(),renderer:{shadowMap:{}},addLabel(){return {style:{}};}});world.scene.add(world.scenery);world.makeGround();world.makeRoad();world.makeTransportStops();world.prefabs=(await load('buildings.glb')).scene;world.adoptNeighborhoods((await load('neighborhoods.glb')).scene);world.adoptNeighborhoods((await load('residences.glb')).scene);world.makeVillage();world.syncProperties(null);world.scenery=world.batch(world.scenery);world.scene.add(world.scenery);
for(let i=0;i<2;i++){const model=(await load(i?'character-botanist.glb':'character-courier.glb')).scene;const tile=world.tiles[i];model.scale.setScalar(1.4);model.position.set(tile.position.x,.22,tile.position.z);model.rotation.y=Math.PI*.3;world.scene.add(model);}
const textured=[];world.scene.traverse(o=>{if(o.isMesh&&o.material.map)textured.push(o);});textured.forEach(o=>o.removeFromParent());
world.scene.updateMatrixWorld(true);
let meshCount=0,triangleCount=0,materialIds=new Set(),invalid=[];const bounds=new THREE.Box3();world.scene.traverse(o=>{if(!o.isMesh)return;meshCount++;for(const m of Array.isArray(o.material)?o.material:[o.material])materialIds.add(m.uuid);const p=o.geometry.getAttribute('position');triangleCount+=(o.geometry.index?.count||p.count)/3;for(const n of p.array)if(!Number.isFinite(n)){invalid.push(o.name);break;}bounds.expandByObject(o);});
const contacts=[];for(let i=0;i<24;i++){const a=world.tiles[i],b=world.tiles[(i+1)%24];contacts.push(Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z));}
const report={purpose:'Offline geometry validation only; not a browser, UI or performance acceptance test',meshCount,triangleCount,materialCount:materialIds.size,invalidGeometry:invalid,routeSegmentMin:Math.min(...contacts),routeSegmentMax:Math.max(...contacts),mapNodeCount:24,characterCount:2,sceneBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
if(invalid.length)throw new Error(JSON.stringify(invalid));
await fs.writeFile('qa/shanhai-geometry-report.json',JSON.stringify(report,null,2));
const exportResult=await new GLTFExporter().parseAsync(world.scene,{binary:true,onlyVisible:true});await fs.writeFile('qa/shanhai-integrated-scene.glb',Buffer.from(exportResult));console.log(report);
