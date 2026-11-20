import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// All dimensions are board units. Local +Z faces the pavement.
export function createCardHouse(isPort) {
  const group = new THREE.Group();
  const batches = new Map();
  function piece(geometry, color, x, y, z, roll = 0) {
    geometry.rotateZ(roll);
    geometry.translate(x, y, z);
    if (!batches.has(color)) batches.set(color, []);
    batches.get(color).push(geometry.index ? geometry.toNonIndexed() : geometry);
  }
  function box(color,x,y,z,w,h,d,roll=0) {
    piece(new THREE.BoxGeometry(w,h,d),color,x,y,z,roll);
  }
  function profile(points,depth,color,x,y,z) {
    const outline=new THREE.Shape(points.map(([u,v])=>new THREE.Vector2(u,v)));
    piece(new THREE.ExtrudeGeometry(outline,{depth,bevelEnabled:false}),color,x,y,z);
  }
  const wood='#724436', ivory='#fff1cb', ink='#20545b', red='#b84342';
  if (isPort) {
    box(wood,0,.23,0,3.15,.36,2.4);
    box(ink,0,.89,-.66,2.79,1.05,.94);
    for(const x of [-1.31,1.31]) box(wood,x,1,.82,.17,1.66,.17);
    box('#eead52',0,.92,.78,2.83,.2,.54);
    box(wood,-.57,2.32,-.08,.18,4.28,.18);
    // Two taut canvas wings share a spar; the tall leeward tip marks the stall from behind.
    // Narrow canvas strips sag between the high spar and the lower eaves.
    for (const [edge,color] of [[-1.57,ivory],[1.57,'#299eaa']]) {
      for(let i=0;i<5;i++){
        const section=t=>[-.56+(edge+.56)*t,3.84-1.9*t-.38*Math.sin(t*Math.PI)];
        const [ax,ay]=section(i/5), [bx,by]=section((i+1)/5);
        profile([[ax,ay],[bx,by],[bx,by-.07],[ax,ay-.07]],1.86,color,0,0,-.93);
      }
      for (const z of [-.87,.87]) box(wood,edge,1.04,z,.12,1.94,.12);
    }
    profile([[-.55,4.27],[-.54,4.66],[.27,4.46]],.08,red,0,0,-.1);
  } else {
    box('#ac5941',0,1.07,-.4,2.95,2.05,1.73);
    box(ink,0,1.01,.48,2.14,1.65,.09);
    for(const x of [-1.3,1.3]) {
      box('#cb7149',x,1,.91,.34,1.86,.45);
      box(ivory,x,1.78,.91,.47,.15,.53);
    }
    const roof=[[-1.73,2.35],[-1.34,2.21],[-.55,2.52],[0,2.84],[.55,2.52],[1.34,2.21],[1.73,2.35],[1.49,1.99],[.71,2.12],[0,2.53],[-.71,2.12],[-1.49,1.99]];
    profile(roof,2.68,'#296667',0,0,-1.39);
    profile([[-1.02,2.3],[-1.02,2.84],[-.68,2.84],[-.68,3.13],[-.38,3.13],[0,3.58],[.38,3.13],[.68,3.13],[.68,2.84],[1.02,2.84],[1.02,2.3]],.32,'#c7714d',0,0,.18);
    for(const x of [-1,1]) piece(new THREE.SphereGeometry(.24,8,6), '#eaa443',x,1.59,1.02);
  }
  // Three thick printing blocks with inset diamond pips identify the card trade from either side.
  const height=isPort?1.56:2.98, z=isPort?1.03:.59;
  for(const i of [-1,0,1]){
    const x=i*.31,y=height-Math.abs(i)*.10;
    box(ivory,x,y,z,.45,.68,.12,-i*.26);
    for(const side of [-1,1]) box(red,x,y,z+side*.069,.18,.18,.025,Math.PI/4);
  }
  if(isPort) {
    box(wood,0,1.12,-1.08,2.86,.2,.22);
    for(const i of [-1,0,1]){
      box(ivory,i*.33,1.42-Math.abs(i)*.10,-1.13,.45,.68,.12,-i*.26);
      box(red,i*.33,1.42-Math.abs(i)*.10,-1.21,.2,.2,.025,Math.PI/4);
    }
  }
  for(const [color,parts] of batches){
    const mesh=new THREE.Mesh(mergeGeometries(parts),new THREE.MeshStandardMaterial({color,roughness:.83}));
    mesh.castShadow=mesh.receiveShadow=true;
    group.add(mesh);
    parts.forEach(part=>part.dispose());
  }
  group.name=isPort?'tide-sail-card-market':'old-town-card-printers';
  group.userData.isStaticFacility=true;
  return group;
}

export function addServiceThreshold(group,tile,roadWidth) {
  const p=tile.position, site=tile.serviceFrontage.position;
  const curb=Math.max(1.48,Math.hypot(p.x-site.x,p.z-site.z)-roadWidth/2-.16);
  const bounds=new THREE.Box3().setFromObject(group);
  const base=bounds.min.y;
  for(const child of group.children) child.position.y+=.16-base;
  const stone=new THREE.MeshStandardMaterial({color:'#cfb599',roughness:.96});
  const landing=new THREE.Mesh(new THREE.BoxGeometry(2.55,.18,curb+1.25),stone);
  landing.position.set(0,.06,(curb-1.25)/2);
  landing.receiveShadow=true;
  group.add(landing);
  const tread=new THREE.Mesh(new THREE.BoxGeometry(2.63,.09,.34),stone);
  tread.position.set(0,.045,curb+.03);
  group.add(tread);
  group.userData.isStaticFacility=true;
}
