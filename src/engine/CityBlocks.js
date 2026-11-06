import * as THREE from 'three';

// Original background architecture. These seven existing sites are scenery,
// not purchasable property, and have no ownership rings or interactive signs.
export const CITY_BLOCK_SITES = [
  {x:8,z:-7,height:4.8}, {x:14,z:-7,height:5.4},
  {x:8,z:-14,height:5.6}, {x:14,z:-14,height:6.4},
  {x:2,z:-13,height:4.0}, {x:17,z:0,height:3.8}, {x:3,z:0,height:3.4}
];
export function createCityBlock(height, variant=0) {
  const group=new THREE.Group();group.name=`civic-background-${variant}`;
  group.userData.harborOccluder='tower';group.userData.isOriginalCityBlock=true;
  const stone=new THREE.MeshStandardMaterial({color:'#e4d8c1',roughness:.88});
  const trim=new THREE.MeshStandardMaterial({color:'#526f69',roughness:.78});
  const glass=new THREE.MeshStandardMaterial({color:'#456f78',emissive:'#e6be76',emissiveIntensity:0,roughness:.4});
  const base=new THREE.MeshStandardMaterial({color:'#a4ada2',roughness:.95});
  const box=(x,y,z,w,h,d,material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
  const w=variant%2?3.4:3.1,d=3.0;
  box(0,.12,0,w+.3,.24,d+.3,base);
  // The lower street front opens into a shallow arcade; the upper storey steps back.
  const upperHeight=1.1,lowerHeight=height-upperHeight;
  box(0,.24+lowerHeight/2,0,w,lowerHeight,d,stone);
  const floors=Math.max(2,Math.round(lowerHeight/1.25));
  for(let i=0;i<floors;i++){
    const y=.85+i*(lowerHeight-.6)/floors;
    const ribbon=box(0,y,0,w+.04,.38,d+.04,glass);
    ribbon.userData.isOriginalCityWindow=true;
    box(0,y-.28,0,w+.16,.1,d+.16,stone);
  }
  // Four piers break the glass ribbons into a legible framed silhouette.
  for(const x of [-w/2,w/2])for(const z of [-d/2,d/2])box(x,.24+lowerHeight/2,z,.16,lowerHeight,.16,stone);
  box(0,.24+lowerHeight,0,w+.24,.16,d+.24,trim);
  const offset=variant%2?.3:-.3;
  box(offset,.24+lowerHeight+upperHeight/2,-.22,w*.62,upperHeight,d*.58,stone);
  const upperWindow=box(offset,.24+lowerHeight+.55,-.22,w*.63,.42,d*.59,glass);upperWindow.userData.isOriginalCityWindow=true;
  box(offset,.24+height,-.22,w*.68,.16,d*.64,trim);
  box(0,.72,d/2+.05,.58,.96,.08,glass);
  box(0,1.3,d/2+.23,1.4,.14,.55,trim);
  return group;
}
