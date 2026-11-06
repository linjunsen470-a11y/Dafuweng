import * as THREE from 'three';

// A low orchard replaces the isolated background tower beside the existing mountain branch.
export const hillTerraces = [
  { x:31, z:-4, width:9, depth:7, height:.28 },
  { x:31, z:-4, width:7, depth:5, height:.52 },
  { x:31, z:-4, width:5, depth:3, height:.76 }
];
export const hillTrees = [[27.6,-4.4],[30,-3.7],[33,-4.1],[34.3,-6.1]];
export function hillStreets(map) {
  const group = new THREE.Group(); group.name='hill-supply-orchard';
  if(map.id!=='grand-bay')return group;
  const stone=new THREE.MeshStandardMaterial({color:'#b6b59b',roughness:1});
  const grass=new THREE.MeshStandardMaterial({color:'#7eaa72',roughness:1});
  const wood=new THREE.MeshStandardMaterial({color:'#98714e',roughness:1});
  const leaf=new THREE.MeshStandardMaterial({color:'#52846a',roughness:1});
  const fruit=new THREE.MeshStandardMaterial({color:'#e8b15a',roughness:1});
  const box=(x,y,z,w,h,d,material)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.receiveShadow=true;group.add(m);return m;};
  for(const t of hillTerraces){box(t.x,t.height/2,t.z,t.width,t.height,t.depth,stone);box(t.x,t.height+.025,t.z,t.width-.16,.05,t.depth-.16,grass);}
  for(const [x,z] of hillTrees){
    const tree=new THREE.Group();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.2,1.3,6),wood);trunk.position.y=.65;tree.add(trunk);
    for(const [dx,dy,dz,r] of [[-.35,1.45,0,.65],[.35,1.7,.1,.7],[0,1.55,-.4,.6]]){const crown=new THREE.Mesh(new THREE.DodecahedronGeometry(r,0),leaf);crown.position.set(dx,dy,dz);crown.castShadow=true;tree.add(crown);}
    for(const [dx,dy,dz] of [[-.85,1.45,.25],[.75,1.65,.55],[0,1.55,-.95]]){const apple=new THREE.Mesh(new THREE.IcosahedronGeometry(.12,0),fruit);apple.position.set(dx,dy,dz);tree.add(apple);}
    const ground = Math.max(...hillTerraces.filter(t=>Math.abs(x-t.x)<=t.width/2 && Math.abs(z-t.z)<=t.depth/2).map(t=>t.height)) + .05;
    tree.position.set(x,ground,z);group.add(tree);
  }
  // Narrow footpaths remain visually distinct from the numbered playable road.
  const edge=[[36,-13.7],[25.2,-13.7],[19.6,-18.3],[19.6,-29.8]];
  for(let i=1;i<edge.length;i++){const [ax,az]=edge[i-1],[bx,bz]=edge[i];const m=box((ax+bx)/2,.17,(az+bz)/2,.7,.08,Math.hypot(bx-ax,bz-az),stone);m.rotation.y=Math.atan2(bx-ax,bz-az);}
  box(24.3,.17,-10.5,4.4,.08,3.8,stone);
  box(26.6,.17,-8.3,.65,.08,4.7,stone);
  for(const z of [-19,-24]){box(18.7,.35,z,.45,.5,1.8,stone);box(18.3,.65,z,.5,.5,1.5,leaf);}
  box(26.6,.48,-7.2,1.8,.12,.55,wood);
  return group;
}
