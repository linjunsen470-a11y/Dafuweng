import * as THREE from 'three';

// Original civic station at the north-east corner. Entry faces +Z toward tile42.
// Low street frontage and rear custody wing replace the old glowing plinth.
export function createCivicStation() {
  const group = new THREE.Group();
  group.name = 'north-corner-civic-station';
  group.userData.originalStation = true;
  group.userData.isStaticFacility = true;
  const material = color => new THREE.MeshStandardMaterial({color,roughness:.85});
  const stone=material('#e6ddca'),roof=material('#405e70'),glass=material('#76a6ac'),trim=material('#637b85'),brass=material('#d8b36c');
  const add=(geometry,m,x,y,z)=>{const mesh=new THREE.Mesh(geometry,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
  const box=(x,y,z,w,h,d,m)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z);
  box(0,.1,0,2.8,.2,2.5,stone);
  box(0,.95,-.18,2.45,1.7,1.95,stone);
  box(0,1.84,-.18,2.6,.16,2.1,roof);
  box(-.72,2.18,-.42,.85,.58,.95,stone);
  box(-.72,2.51,-.42,1,.12,1.1,roof);
  // Rear elevation is visible from the default camera, so it needs the same civic identity.
  box(0,.56,-1.17,2.45,.14,.06,trim);
  for(const x of [-.72,.72])box(x,1.12,-1.18,.52,.6,.06,glass);
  // Public-facing recessed door and protective portico; no extra animated props.
  box(0,.78,.81,.58,1.22,.08,glass);
  box(0,1.55,1.03,1.35,.15,.8,roof);
  for(const x of [-.57,.57])box(x,.84,1.32,.12,1.48,.12,stone);
  box(0,.23,1.22,1.25,.1,.72,stone);
  for(const x of [-.88,.88])box(x,1.08,.81,.4,.55,.08,glass);
  // Custody windows on the wing: recognisable grille, not a fortress wall blocking the board.
  for(const z of [-.65,.2]){
    box(1.25,1.05,z,.06,.6,.48,glass);
    for(const dz of [-.14,.14])box(1.29,1.05,z+dz,.04,.62,.04,trim);
  }
  const shield=new THREE.Shape();shield.moveTo(-.22,.25);shield.lineTo(.22,.25);shield.lineTo(.18,-.08);shield.lineTo(0,-.25);shield.lineTo(-.18,-.08);shield.closePath();
  add(new THREE.ShapeGeometry(shield),brass,-.72,2.18,.065);
  return group;
}
