import * as THREE from 'three';

// Original low-rise clinic; entrance faces +X toward hospital tile72.
// Fits inside the old 1.92-unit facility footprint; no new map or gameplay data.
export function createHospitalClinic() {
  const group = new THREE.Group();
  group.name = 'sunshine-clinic';
  group.userData.originalHospital = true;
  group.userData.isStaticFacility = true;
  const stone = new THREE.MeshStandardMaterial({color:'#f1e5ce',roughness:.9});
  const roof = new THREE.MeshStandardMaterial({color:'#487e77',roughness:.8});
  const glass = new THREE.MeshStandardMaterial({color:'#72b6bc',roughness:.35});
  const timber = new THREE.MeshStandardMaterial({color:'#b98458',roughness:.9});
  const box = (x,y,z,w,h,d,material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  };
  box(0,.1,0,2.9,.2,2.5,stone);
  box(-.3,.95,0,1.9,1.7,2.2,stone);
  box(-.3,1.85,0,2.05,.14,2.35,roof);
  box(-.65,2.2,-.48,1.1,.65,1.15,stone);
  box(-.65,2.56,-.48,1.25,.12,1.3,roof);
  box(.68,.72,0,.08,1.12,.7,glass);
  box(1.02,1.55,0,.95,.14,1.45,roof);
  for(const z of [-.62,.62])box(1.35,.83,z,.09,1.5,.09,timber);
  box(1.1,.23,0,.65,.12,1.25,stone);
  for(const z of [-.83,.83])box(.68,1.1,z,.06,.55,.35,glass);
  for(const x of [-.85,.05])box(x,1.05,1.12,.5,.6,.06,glass);
  // A framed sun disc is the clinic's original emblem, distinct from nearby homes.
  const sun = new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.07,12),new THREE.MeshStandardMaterial({color:'#f1bc58',roughness:.7}));
  sun.rotation.z=Math.PI/2;sun.position.set(-.07,2.24,-.48);group.add(sun);
  return group;
}
