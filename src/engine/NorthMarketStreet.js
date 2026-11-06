import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// An original continuous setting for existing tiles42–54. Scenery has no lot
// markers, interactive signs or new routes. Keep the106/107 return bend open.
export function createNorthMarketStreet(map) {
  const group=new THREE.Group();group.name='north-market-neighborhood';
  if(map?.id!=='grand-bay')return group;
  const colors={paving:'#c7baa0',edge:'#e1d2b3',wall:'#d8c7a6',roof:'#8e6b55',glass:'#547d7c',wood:'#88664a',green:'#718b66'};
  const batches=Object.fromEntries(Object.keys(colors).map(k=>[k,[]]));
  const footprints=[];
  const add=(geometry,kind,x,y,z,solid=false)=>{
    if(geometry.index){const original=geometry;geometry=geometry.toNonIndexed();original.dispose();}
    geometry.translate(x,y,z);batches[kind].push(geometry);
    if(solid){geometry.computeBoundingBox();const b=geometry.boundingBox;footprints.push({min:b.min.toArray(),max:b.max.toArray()});}
  };
  const box=(x,y,z,w,h,d,kind,solid=false)=>add(new THREE.BoxGeometry(w,h,d),kind,x,y,z,solid);
  // Inner sidewalks connect the civic corner and the shopping frontage.
  // The central gap deliberately leaves the real return branch and lotto clear.
  for(const [x,z,w,d] of [[38,-33.6,20,1.05],[11,-33.6,14,1.05],[38,-29.7,23,1.1],[38,-27.7,23,4.1],[29,-31.5,1,3.8],[48.5,-31.5,1,3.8]])box(x,.14,z,w,.08,d,'paving');
  for(const [x,w] of [[38,20],[11,14]])box(x,.22,-34.16,w,.16,.12,'edge');
  // A continuous planted rear edge joins the purchasable plots without filling them.
  box(27,.10,-44,46,.12,1.5,'green');
  box(27,.18,-43.2,46,.16,.14,'edge');
  // Plots retain their own markers/ownership colors. Short side kerbs frame their boundaries.
  for(const tile of map.tiles.filter(t=>t.id>=43&&t.id<=53&&t.lot)){
    const {x,z}=tile.lot.position;
    for(const dx of [-1.92,1.92])box(x+dx,.18,z,.12,.16,3.7,'edge');
  }
  // Three low connected street houses form one urban backdrop, not purchasable buildings.
  for(const [x,h] of [[32,2.45],[38,2.85],[44,2.25]]){
    box(x,h/2,-27.2,4.7,h,3,'wall',true);
    const roofPoints=[[-2.5,h,-1.7],[2.5,h,-1.7],[2.5,h,1.7],[-2.5,h,1.7],[-2.5,h+.38,0],[2.5,h+.38,0]];
    const vertices=[0,4,5,0,5,1,3,2,5,3,5,4,0,3,4,1,5,2].flatMap(i=>roofPoints[i]);
    const pitched=new THREE.BufferGeometry();pitched.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));pitched.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));pitched.computeVertexNormals();
    add(pitched,'roof',x,0,-27.2,true);
    box(x,1.05,-28.73,3.7,.9,.06,'glass',true);
    box(x,1.65,-29,4.8,.14,.65,'roof',true);
    for(const dx of [-2.12,2.12])box(x+dx,.85,-29.23,.12,1.7,.12,'wood',true);
    box(x,.6,-28.8,.58,1.2,.08,'wood',true);
    for(const dx of [-1.5,0,1.5]){
      box(x+dx,h-.55,-28.73,.72,.6,.07,'glass',true);
      box(x+dx,h-.55,-25.67,.72,.6,.07,'glass',true);
    }
    box(x,.55,-25.65,4.7,.14,.08,'roof',true);
    box(x,.7,-25.64,.65,1.4,.08,'wood',true);
    box(x,1.5,-25.4,1.7,.12,.7,'roof',true);
    for(const dx of [-1.5,1.5])box(x+dx,.75,-25.64,.72,.75,.07,'glass',true);
  }
  // Small street trees occupy the shared rear green belt, not the numbered road or lots.
  for(const x of [10,18,40,49]){
    add(new THREE.CylinderGeometry(.12,.18,1.1,6),'wood',x,.65,-44,true);
    add(new THREE.IcosahedronGeometry(.68,0),'green',x,1.5,-44,true);
  }
  for(const [kind,geometries] of Object.entries(batches)){
    if(!geometries.length)continue;
    const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:colors[kind],roughness:kind==='glass'?.45:.95}));
    mesh.name=`north-market-${kind}`;mesh.receiveShadow=true;mesh.castShadow=!['paving','edge'].includes(kind);group.add(mesh);
  }
  group.userData.solidFootprints=footprints;
  return group;
}
