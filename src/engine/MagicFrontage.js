import * as THREE from 'three';

// Original east-coast magic house. Entrance faces -X toward the existing tile29.
// Keep within the old roadside plinth's radius; no new gameplay or animation.
export function createMagicFrontage() {
  const group = new THREE.Group();
  group.name = 'east-coast-magic-house';
  group.userData.originalMagic = true;
  group.userData.isStaticFacility = true;
  const wall = new THREE.MeshStandardMaterial({color:'#eadfc9',roughness:.9});
  const roof = new THREE.MeshStandardMaterial({color:'#655a78',roughness:.8});
  const wood = new THREE.MeshStandardMaterial({color:'#8c694c',roughness:.9});
  const glass = new THREE.MeshStandardMaterial({color:'#64a4ab',roughness:.35});
  const brass = new THREE.MeshStandardMaterial({color:'#d7ac56',roughness:.5,metalness:.25});
  const add = (geometry,material,x,y,z) => {const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
  const box=(x,y,z,w,h,d,m)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z);
  box(0,.09,0,2.8,.18,2.4,wall);
  box(.05,.95,0,2.15,1.7,1.95,wall);
  box(.05,1.78,0,2.3,.12,2.1,wood);
  add(new THREE.CylinderGeometry(.8,1.45,.58,8),roof,.05,2.12,0);
  box(-1.05,.75,0,.06,1.22,.6,glass);
  box(-1.35,1.58,0,.85,.12,1.35,roof);
  for(const z of [-.58,.58])box(-1.68,.83,z,.09,1.5,.09,wood);
  box(-1.4,.18,0,.82,.18,1.25,wall);
  for(const z of [-.65,.65])box(-1.04,1.08,z,.06,.5,.3,glass);
  for(const x of [-.58,.62])box(x,1.02,1,.45,.65,.06,glass);
  for(const x of [-.85,.95])box(x,.93,1.01,.1,1.6,.08,wood);
  add(new THREE.CylinderGeometry(.22,.32,.28,8),brass,.05,2.48,0);
  add(new THREE.IcosahedronGeometry(.27,0),glass,.05,2.9,0);
  const ring=add(new THREE.TorusGeometry(.4,.04,4,12),brass,.05,2.9,0);
  ring.rotation.y=Math.PI/2;
  return group;
}
