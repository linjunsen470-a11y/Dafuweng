import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Public garden between the existing bank, north street and city center.
// No new facilities, plot markers or route edges. Keep the60→108 branch open.
export function createBankCivicCourt(map){
 const group=new THREE.Group();group.name='bank-civic-court';if(map?.id!=='grand-bay')return group;
 const colors={stone:'#c5c2aa',edge:'#e0d4b9',grass:'#849c7c',wood:'#967351',leaf:'#607f68'};
 const batches=Object.fromEntries(Object.keys(colors).map(k=>[k,[]]));const solids=[];
 const add=(g,m,x,y,z,solid=false)=>{if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}g.translate(x,y,z);batches[m].push(g);if(solid){g.computeBoundingBox();solids.push({min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()});}};
 const box=(x,y,z,w,h,d,m,solid=false)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z,solid);
 // Street edge links market paving through the bank frontage, stopping before the fork.
 box(-7,.14,-33.6,22,.08,1,'stone');box(-7,.22,-34.16,22,.16,.12,'edge');
 box(-10,.14,-28.1,6,.08,1.4,'stone');
 box(-7,.14,-25.1,18,.08,5,'stone');
 // Broad low garden terraces give the foreground a horizontal silhouette.
 box(-7,.27,-23.25,17,.38,1.7,'edge',true);box(-7,.48,-23.25,16.7,.04,1.4,'grass',true);
 box(-13.9,.27,-26,1.4,.38,3.7,'edge',true);box(-13.9,.48,-26,1.1,.04,3.4,'grass',true);
 // Two open pergolas face the shared court; low slatted roofs leave sightlines open.
 for(const x of [-11,-3]){
  for(const dx of [-1.25,1.25])for(const z of [-26.6,-24.6])box(x+dx,1.13,z,.13,2,.13,'wood',true);
  for(const z of [-26.6,-24.6])box(x,2.12,z,2.8,.16,.18,'wood',true);
  for(const dx of [-1.2,-.6,0,.6,1.2])box(x+dx,2.23,-25.6,.13,.12,2.45,'wood',true);
  box(x,.54,-24.9,2.2,.14,.5,'wood',true);
 }
 // Planting frames the court; it never sits on bank/plot entry paths.
 for(const [x,z] of [[-13.9,-26.7],[-12.7,-23.25],[-5.8,-23.25],[.2,-23.25]]){
  add(new THREE.CylinderGeometry(.1,.16,1,6),'wood',x,.99,z,true);add(new THREE.IcosahedronGeometry(.65,0),'leaf',x,1.8,z,true);
 }
 // Connect the prior market rear green belt behind, not through, the real lots.
 box(-7,.1,-44,22,.12,1.5,'grass');box(-7,.18,-43.2,22,.16,.14,'edge');
 for(const t of map.tiles.filter(t=>[55,56,58].includes(t.id)))for(const dx of [-1.92,1.92])box(t.lot.position.x+dx,.18,t.lot.position.z,.12,.16,3.7,'edge');
 for(const [kind,geometries] of Object.entries(batches)){
  const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());const m=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:colors[kind],roughness:.95}));m.receiveShadow=true;m.castShadow=['wood','leaf'].includes(kind);group.add(m);
 }
 group.userData.solidFootprints=solids;return group;
}
