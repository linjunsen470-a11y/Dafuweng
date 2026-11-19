import * as THREE from 'three';

// Static fittings are instanced by material; the walk stays behind the numbered lots.
export function createHarborPromenade() {
  const group = new THREE.Group();
  group.name = 'bay-promenade';
  const batches = new Map();
  const stone = '#dfcfa9', rail = '#447e76', timber = '#a76543';
  function place(color,x,y,z,w,h,d) {
    if (!batches.has(color)) batches.set(color,[]);
    batches.get(color).push([x,y,z,w,h,d]);
  }
  for (let x=-48;x<=44;x+=4) {
    place(stone,x,.19,37,3.95,.32,.56);
    place(rail,x,.62,37,.14,.85,.14);
    place(rail,x+2,.87,37,4,.09,.09);
  }
  for (const x of [-42,-29,-17,-5,9,21,33]) {
    for (const dx of [-.54,.54]) place(rail,x+dx,.38,35.9,.13,.38,.42);
    for (const z of [35.72,35.91,36.10]) place(timber,x,.59,z,1.58,.10,.14);
    place(timber,x,.87,36.16,1.58,.33,.10);
    place(rail,x+2,.95,36.45,.11,1.6,.11);
    place(rail,x+2,1.74,36.45,.4,.10,.4);
    place('#ffe3a2',x+2,1.95,36.45,.27,.34,.27);
    place(rail,x+2,2.15,36.45,.46,.1,.46);
    place(stone,x-2,.35,36.15,1.1,.38,.64);
    for (const dx of [-.32,0,.31]) {
      place('#618d57',x-2+dx,.59,36.15,.37,.21,.44);
      place(dx===0?'#f0b957':'#dc826d',x-2+dx,.73,36.16,.17,.13,.17);
    }
  }
  for (const x of [-36,-12,12,36]) {
    for (let i=-2;i<=2;i++) place('#fff0cb',x,.239,28+i*.32,.64,.025,.19);
    for (const edge of [-1,1]) place(stone,x,.30,28+edge*1.73,1.28,.19,.23);
  }
  const stamp = new THREE.Object3D();
  for (const [color,items] of batches) {
    const material = new THREE.MeshStandardMaterial({color,roughness:.83});
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(),material,items.length);
    if (color==='#ffe3a2') {
      material.emissive.set('#ffb450');
      material.emissiveIntensity=.1;
      mesh.userData.isPromenadeLamp=true;
    }
    items.forEach(([x,y,z,w,h,d],index)=>{
      stamp.position.set(x,y,z); stamp.scale.set(w,h,d); stamp.updateMatrix();
      mesh.setMatrixAt(index,stamp.matrix);
    });
    mesh.receiveShadow=true;mesh.castShadow=true;
    group.add(mesh);
  }
  return group;
}

export function createHarborGulls() {
  const geometry=new THREE.BufferGeometry();
  // Two swept wings, with the folded outer feathers slightly below the shoulders.
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([
    0,0,.28, -.33,.19,-.06, -.87,.04,-.2,
    0,0,.28, -.87,.04,-.2, -.28,.07,.08,
    0,0,.28, .87,.04,-.2, .33,.19,-.06,
    0,0,.28, .28,.07,.08, .87,.04,-.2,
  ],3));
  geometry.computeVertexNormals();
  return new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({
    color:'#fff4da',roughness:.9,side:THREE.DoubleSide
  }),5);
}

const birdPose=new THREE.Object3D();
export function updateHarborGulls(flock,time) {
  for(let i=0;i<flock.count;i++){
    const phase=time*.27+i*1.7;
    birdPose.position.set(-35+i*12+Math.cos(phase)*3.5,3.2+i%2+Math.sin(phase*2)*.38,40+Math.sin(phase)*2.6);
    birdPose.rotation.set(0,-phase,Math.sin(phase)*.18);
    birdPose.updateMatrix();
    flock.setMatrixAt(i,birdPose.matrix);
  }
  flock.instanceMatrix.needsUpdate=true;
}
