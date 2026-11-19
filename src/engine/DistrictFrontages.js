import * as THREE from 'three';

// Non-interactive backdrops outside the existing roads and property lots.
export function createDistrictFrontages(art) {
  const group = new THREE.Group();
  group.name = 'district-frontages';
  const cube = new THREE.BoxGeometry();
  const batches = new Map();
  const box = (color,x,y,z,w,h,d) => {
    if (!batches.has(color)) batches.set(color,[]);
    batches.get(color).push([x,y,z,w,h,d]);
  };
  const place = (name,x,z,angle=0,scale=1) => {
    const model = art.clone(name);
    if (!model) return;
    const anchor = new THREE.Group();
    anchor.add(model);
    model.traverse(child=>{
      const materials=Array.isArray(child.material)?child.material:[child.material];
      for(const material of materials) if(material?.name==='glass') {
        material.emissive.set('#ffba66');
        material.emissiveIntensity=.10;
        material.userData.districtWindow=true;
      }
    });
    anchor.position.set(x,.23,z);
    anchor.rotation.y=angle;
    anchor.scale.setScalar(scale);
    group.add(anchor);
  };
  // Old town: tiled shop houses open towards a continuous shaded shopping arcade.
  box('#d9c29a',63,.15,-9,5,.2,21);
  for(const [i,z] of [-17,-12,-7,-2].entries()) {
    place('res_market_'+(i%2+1),63.5,z,-Math.PI/2,1.24);
    for (const dz of [-1.3,1.3]) box('#925936',61.5,.91,z+dz,.14,1.45,.14);
    for(let stripe=0;stripe<6;stripe++)
      box(stripe%2?'#f5d9a2':'#ba5946',61.85,1.72,z-1.25+stripe*.5,1.3,.14,.49);
  }
  // Business district: glass winter garden, paired office wings and a sunken plaza.
  box('#b6c8cb',-18,.17,-44,15,.18,4.5);
  place('res_civic_4',-23,-44,0,1.15);
  place('garden_conservatory',-18,-44,0,.9);
  place('res_civic_3',-13,-44,0,1.2);
  for(const x of [-25,-20.5,-15.5,-11]) {
    box('#708f85',x,.37,-42.1,.8,.43,.61);
    box('#75a270',x,.66,-42.1,.72,.28,.52);
  }
  // Mountain town: stepped tea beds beside the orchard and a timber drying shed.
  for(let row=0;row<3;row++) {
    const z=-7.6+row*1.05;
    box('#b39d79',31,.25+row*.09,z,5.6,.38+row*.18,.97);
    for(let i=0;i<8;i++)
      box(i%2?'#759953':'#527e50',28.65+i*.66,.53+row*.18,z,.60,.31,.63);
  }
  place('hill_supply_pavilion',34,-8.5,0,.72);
  const stamp = new THREE.Object3D();
  for(const [color,rows] of batches) {
    const mesh = new THREE.InstancedMesh(cube,new THREE.MeshStandardMaterial({color,roughness:.85}),rows.length);
    rows.forEach(([x,y,z,w,h,d],i)=>{
      stamp.position.set(x,y,z);stamp.scale.set(w,h,d);stamp.updateMatrix();mesh.setMatrixAt(i,stamp.matrix);
    });
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  return group;
}
