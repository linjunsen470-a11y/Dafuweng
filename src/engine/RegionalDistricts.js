import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Fixed landscape in the two openings. Build once and batch by material.
export function regionalDistrict(mapId) {
  if (!['city-loop','fortune-crossroads'].includes(mapId)) return null;
  const group=new THREE.Group(), parts=new Map();
  const steel='#47636b', pearl='#f1dfb3', copper='#af6744', teal='#34888b';
  function add(geometry,color,x,y,z,roll=0) {
    geometry.rotateZ(roll);geometry.translate(x,y,z);
    if(geometry.index){const source=geometry;geometry=source.toNonIndexed();source.dispose();}
    if(!parts.has(color))parts.set(color,[]);parts.get(color).push(geometry);
  }
  function box(x,y,z,w,h,d,c,roll=0){add(new THREE.BoxGeometry(w,h,d),c,x,y,z,roll);}
  function drum(x,y,z,r,b,h,c,sides=16){add(new THREE.CylinderGeometry(r,b,h,sides),c,x,y,z);}
  function finishSection(name, canObstruct=false){
    const section=new THREE.Group();section.name=name;
    section.userData.streetOccluder=canObstruct;
    for(const [color,geometries] of parts){
      const mesh=new THREE.Mesh(mergeGeometries(geometries),new THREE.MeshStandardMaterial({color,roughness:.89}));
      mesh.castShadow=mesh.receiveShadow=true;section.add(mesh);geometries.forEach(g=>g.dispose());
    }
    parts.clear();group.add(section);
  }
  if(mapId==='city-loop'){
    // A sunken station court faces the route; trains run parallel behind the peristyle.
    box(.3,.15,9.6,25,.27,6.7,'#afaaa1');
    for(const z of [7.5,8.5]){
      box(0,.39,z,24,.16,.13,steel);
    }
    for(let x=-11;x<=11;x++)box(x,.26,8,.28,.12,1.8,'#807b71');
    for(const x of [-8,-3.6,.8,5.2]){
      box(x,1.06,8,4.18,1.22,1.64,teal);
      box(x,1.57,8,4.05,.43,1.74,steel);
      for(let k=-1;k<=1;k++)box(x+k*1.2,1.55,8.88,.94,.37,.06,'#95d3cf');
      box(x,1.85,8,4.16,.16,1.73,pearl);
    }
    box(.2,.42,10.9,24,.5,2.42,'#c9aa77');
    for(let x=-10;x<=10;x+=4){
      box(x,1.66,10.53,.25,2.2,.3,steel);
      for(const s of [-1,1])box(x+s*.49,2.56,10.53,1.28,.15,.3,pearl,s*.52);
    }
    box(.15,2.9,10.45,23.4,.23,1.65,teal);
    finishSection('station-platform',true);
    for(const [x,h,w] of [[-8,4.5,5],[-2.5,6.4,4.5],[3.1,5.1,5.2],[9.1,3.8,4.3]]){
      box(x,h/2,4.62,w,h,3.52,'#c69c77');
      for(let floor=.96;floor<h-.24;floor+=1.21){
        box(x,floor,6.40,w-.58,.54,.13,steel);
        box(x,floor-.36,6.51,w-.32,.12,.28,pearl);
      }
      box(x,h+.10,4.62,w+.2,.24,3.76,pearl);
      box(x,h+.55,4.42,w*.52,.73,2.1,teal);
      finishSection('station-office',true);
    }
    // Short forecourt stairs descend toward the low entrance beside the play route.
    for(let n=0;n<3;n++)box(3.62,.09+n*.075,13.08-n*.35,4.7,.14+n*.10,.38,pearl);
  }else{
    // The field terraces trace the outside of the valley branch, away from its playable lots.
    for(const [x,z,w,d] of [[-26,7,6.3,13],[-25,-3,6.7,7.4],[-14,24,14,5],[-3,24,7,4]]){
      for(let n=0;n<3;n++){
        const bed=new THREE.CylinderGeometry(1,1.04,.38,20);bed.scale(w/2-n*.55,1,d/2-n*.42);
        add(bed,n%2?'#9da956':'#b6ba69',x,.19+n*.34,z);
      }
      for(let lane=-1;lane<=1;lane++)box(x,1.10,z+lane*.60,w*.52,.16,.24,'#708947');
    }
    // A red-roofed windmill identifies the uphill branch. Blades have solid timber spars and canvas.
    finishSection('valley-field-terraces');
    const x=-14.55,z=6.8;
    drum(x,1.68,z,1.12,1.70,3.34,'#ddc39a');
    drum(x,3.69,z,1.06,1.15,.78,pearl);
    drum(x,4.55,z,.08,1.55,1.02,copper);
    drum(x,2.61,z,1.60,1.6,.21,steel);
    for(let i=0;i<4;i++){
      const a=.42+i*Math.PI/2;
      box(x-Math.sin(a)*1.16,3.62+Math.cos(a)*1.16,z+1.30,.13,2.36,.12,steel,a);
      box(x-Math.sin(a)*1.68,3.62+Math.cos(a)*1.68,z+1.36,.43,1.28,.09,pearl,a);
    }
    finishSection('valley-mill',true);
    for(const [hx,hz,w] of [[-23.8,18,3.62],[-19.8,20.1,3.32],[-7.5,24.5,4.3]]){
      box(hx,.95,hz,w,1.85,2.56,'#cba577');
      for(const s of [-1,1])box(hx+s*w*.25,2.31,hz,w*.63,.19,3.21,copper,-s*.46);
      box(hx,.88,hz+1.31,.87,1.52,.12,steel);
      box(hx+1,.99,hz+1.31,.54,.67,.12,teal);
      finishSection('valley-barn',true);
    }
  }
  if(parts.size)finishSection('platform-steps');
  return group;
}
