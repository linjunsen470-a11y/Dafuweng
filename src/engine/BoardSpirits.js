import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

const colors={FORTUNE:0xf5bc43,GREAT_FORTUNE:0xff8144,LUCK:0xff8cab,EARTH:0x82bb62,MISFORTUNE:0x8babc4,BAD:0x925cc5,ANGEL:0xffe7ae,DEMON:0xe55e82};
const aliases={SMALL_FORTUNE:'FORTUNE',GREAT_POOR:'MISFORTUNE',SMALL_POOR:'MISFORTUNE'};
let silhouettes;
export function spiritColor(type){return colors[aliases[type] || type] ?? 0xffc660;}

export function createSpirit(type,phase=0,attached=false) {
  const kind=aliases[type] || type;
  const group=new THREE.Group();
  Object.assign(group.userData,{type,phase});
  // A small cut gemstone remains a visible hit target during the first GLB request.
  const marker=new THREE.Mesh(new THREE.OctahedronGeometry(.28), new THREE.MeshStandardMaterial({color:spiritColor(type)}));
  marker.position.y=.45;
  group.add(marker);
  if (attached) {
    const dark = ['MISFORTUNE','BAD','DEMON'].includes(kind);
    const ornament = new THREE.Group();
    const geometry = dark ? new THREE.IcosahedronGeometry(.29,1) : new THREE.OctahedronGeometry(.14);
    const material = new THREE.MeshBasicMaterial({color:dark ? '#886095' : '#ffd150'});
    for (let i=0;i<4;i++) {
      const part = new THREE.Mesh(geometry,material);
      if (dark) part.position.set((i-1.5)*.2,.98+.1*Math.sin(i),0);
      else part.position.set(.64*Math.cos(i*Math.PI/2),.6,.64*Math.sin(i*Math.PI/2));
      if (!dark) part.scale.y=1.6;
      ornament.add(part);
    }
    if (dark) {
      const bolt = new THREE.Mesh(new THREE.ConeGeometry(.12,.42,3),new THREE.MeshBasicMaterial({color:'#ffdc68'}));
      bolt.rotation.z=2.8; bolt.position.y=.65; ornament.add(bolt);
    }
    group.add(ornament);
    group.userData.ornament=ornament;
  }
  silhouettes ??= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/models/board-spirits.glb`).catch(()=>{silhouettes=null;return null;});
  silhouettes.then(pack=>{
    if(!group.parent) return;
    const template=pack?.scene.getObjectByName(kind);
    if(!template) return;
    const figure=template.clone(true);
    group.remove(marker);marker.geometry.dispose();marker.material.dispose();
    group.add(figure);group.userData.ready=true;
  });
  return group;
}
export function releaseSpirit(group) {
  if(!group.userData.ready){
    const marker=group.children[0];
    marker?.geometry?.dispose();marker?.material?.dispose();
  }
  const ornaments = group.userData.ornament?.children || [];
  new Set(ornaments.flatMap(part => [part.geometry,part.material])).forEach(resource => resource.dispose());
  group.removeFromParent();
}
export function animateSpirits(manager,time,reduced){
  for(const group of manager.boardGodMeshes.values()){
    const t=reduced?0:time*.55+group.userData.phase;
    const goal=group.userData.tilePosition;
    if(goal){group.position.lerp(goal,reduced?1:.18);group.position.y=goal.y+.50+(reduced?0:.15*Math.sin(t));}
    group.rotation.y=(manager.harborFacing || 0)+.18*Math.sin(t);
  }
  for(const group of manager.godAuraMeshes.values()){
    const t=reduced?0:time*.38+group.userData.phase;
    if (group.userData.ornament) group.userData.ornament.rotation.y=t;
    const a=(manager.harborFacing || 0)+.45*Math.sin(t);
    group.position.set(.86*Math.cos(a)-.26*Math.sin(a),1.75+.12*Math.sin(t),-.86*Math.sin(a)-.26*Math.cos(a));
    group.rotation.y=(manager.harborFacing || 0)-.12;
  }
}
