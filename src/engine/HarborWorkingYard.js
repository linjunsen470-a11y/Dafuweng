import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Original working harbor behind the existing13–24 frontage. Boat/sheds are
// scenery, not new shops, transport options, purchasable lots or graph edges.
export function createHarborWorkingYard(map){
 const group=new THREE.Group();group.name='harbor-working-yard';if(map?.id!=='grand-bay')return group;
 const colors={paving:'#d3c3a1',wall:'#eadcc1',timber:'#9b7250',sea:'#497f7d',glass:'#6b9b9f'};
 const batches=Object.fromEntries(Object.keys(colors).map(k=>[k,[]])),solids=[];
 const add=(g,m,x,y,z,solid=false)=>{if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}g.translate(x,y,z);batches[m].push(g);if(solid){g.computeBoundingBox();solids.push({min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()});}};
 const box=(x,y,z,w,h,d,m,solid=false)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z,solid);
 box(22,.14,22,21,.08,5.2,'paving');box(24,.14,25.3,28,.08,.9,'paving');
 for(const x of [12,32])box(x,.14,24.7,.8,.08,1.2,'paving');
 // Numberless shore access links meet the existing waterfront walk between lots.
 for(const x of [6,26,38])box(x,.18,32.9,.75,.08,5.6,'paving');
 box(22,.25,19.3,21,.22,.16,'wall');
 // One low boatwright's shed, with a broad working doorway and windows on both sides.
 box(13.5,1.15,21.1,4.5,2.3,3,'wall',true);
 box(13.5,.85,22.63,2.3,1.7,.06,'sea',true);
 for(const x of [11.65,15.35])box(x,1.35,22.64,.55,.65,.06,'glass',true);
 for(const x of [12.1,14.9])box(x,1.35,19.56,.8,.65,.06,'glass',true);
 const roofPoints=[[-2.45,2.3,-1.65],[2.45,2.3,-1.65],[2.45,2.3,1.65],[-2.45,2.3,1.65],[-2.45,2.8,0],[2.45,2.8,0]];
 const vertices=[0,4,5,0,5,1,3,2,5,3,5,4,0,3,4,1,5,2].flatMap(i=>roofPoints[i]);const roof=new THREE.BufferGeometry();roof.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));roof.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));roof.computeVertexNormals();add(roof,'sea',13.5,0,21.1,true);
 // A recognizable boat on dry cradles is the district landmark, clear of the road.
 const outline=new THREE.Shape([new THREE.Vector2(-2.4,-.7),new THREE.Vector2(1.6,-.8),new THREE.Vector2(2.65,0),new THREE.Vector2(1.6,.8),new THREE.Vector2(-2.4,.7)]);
 const hull=new THREE.ExtrudeGeometry(outline,{depth:.65,bevelEnabled:false});hull.rotateX(-Math.PI/2);add(hull,'sea',22,.55,21.1,true);
 const deck=new THREE.ShapeGeometry(outline);deck.rotateX(-Math.PI/2);deck.scale(.92,1,.85);add(deck,'wall',22,1.21,21.1,true);
 for(const x of [20.4,23.2])box(x,.38,21.1,.22,.65,2,'timber',true);
 for(const x of [20.6,21.5,22.4,23.3])box(x,1.25,21.1,.18,.08,1.1,'timber',true);
 // Open-sided net/work canopy shares the same apron; no opaque wall across the view.
 for(const x of [27.3,30.7])for(const z of [19.9,22.3])box(x,1.1,z,.13,2.2,.13,'timber',true);
 box(29,2.26,21.1,3.8,.14,2.8,'sea',true);
 box(29,.75,20.1,2.7,.14,.65,'timber',true);
 for(const x of [27.9,30.1])box(x,.4,20.1,.14,.7,.55,'timber',true);
 for(const [kind,geometries] of Object.entries(batches)){
  const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:colors[kind],roughness:kind==='glass'?.45:.9}));mesh.receiveShadow=true;mesh.castShadow=kind!=='paving';group.add(mesh);
 }
 group.userData.solidFootprints=solids;return group;
}
