import * as THREE from 'three';
import {createTerraceOrchards} from './CityGround.js';

// The island's two inner clearings share a pedestrian walk below the playable road.
export function createCrossroadsGarden(map, boardRadius) {
  const group=new THREE.Group();
  group.name='crossroads-garden';
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=1024;
  const ctx=canvas.getContext('2d');
  ctx.translate(512,512);ctx.scale(1024/44,1024/44);
  ctx.fillStyle='#a5c982';ctx.fillRect(-22,-22,44,44);
  function oval(x,z,w,d,color,angle=0) {
    ctx.beginPath();ctx.ellipse(x,z,w,d,angle,0,2*Math.PI);
    ctx.fillStyle=color;ctx.fill();
  }
  // Contours and paths are painted once, before the curbs and playable roads.
  oval(-3,-1,12,9,'#8fb977',-.25);
  oval(-4,0,8.8,6.8,'#9ac77b',-.35);
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const [width,color] of [[1.5,'#bfaa77'],[1.22,'#f1d6a2']]) {
    ctx.beginPath();ctx.moveTo(-12,5);
    ctx.bezierCurveTo(-7,9,-1,7,1,2);
    ctx.bezierCurveTo(3,-1,5,-2,7,-7);
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
  for(const [x,z] of [[-5,-3],[-5,2],[.2,-4]]){
    oval(x,z,2.7,1.6,'#c9b783',-.28);
    oval(x,z,2.55,1.45,'#839c5c',-.28);
    for(let i=-1;i<=1;i++) oval(x,z+i*.57,1.9,.18,'#b1bb74',-.28);
  }
  for(const [w,d,c] of [[4.2,2.9,'#e2c994'],[3.8,2.5,'#7abf9e'],[3.35,2.05,'#58afab'],[2.3,1.3,'#4b9ea3']]) oval(5,1,w,d,c,-.54);
  for(let i=0;i<19;i++) oval(5+Math.sin(i*7.3)*2.4,1+Math.cos(i*4.7)*1.28,.11+i%3*.08,.035,'#b2ded0');
  for(const tile of map.tiles)for(const n of tile.next){
    const {x,z}=tile.position,b=map.tiles[n].position;
    ctx.beginPath();ctx.moveTo(x,z);ctx.lineTo(b.x,b.z);
    ctx.strokeStyle='#d6c9a8';ctx.lineWidth=5.15;ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const ground=new THREE.Mesh(new THREE.CircleGeometry(22,96),new THREE.MeshStandardMaterial({map:texture,roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.63;ground.receiveShadow=true;group.add(ground);
  const trees=createTerraceOrchards([[-6,-3.2],[-4,-2.8],[-6,1.7],[-4,2.1],[-.8,-4.15],[1,-3.85]]);
  trees.position.y=ground.position.y;group.add(trees);
  const wood=new THREE.MeshStandardMaterial({color:'#b77f52'});
  const green=new THREE.MeshStandardMaterial({color:'#427f70'});
  const deck=new THREE.Group();deck.position.set(3.4,-.51,1.4);deck.rotation.y=-.46;
  const block=(x,y,z,w,h,d,material)=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;deck.add(m);
  };
  for(let i=-5;i<=5;i++) block(0,.23+.16*Math.cos(i*.28),i*.43,1.72,.14,.41,wood);
  for(const x of [-.85,.85]) {
    for(const z of [-2,0,2])block(x,.42,z,.12,1.15,.12,green);
    block(x,.94,0,.12,.12,4.4,green);
  }
  group.add(deck);
  // A thin curb and dashed lane follow the existing peripheral traffic ring.
  const curb=new THREE.Mesh(new THREE.RingGeometry(boardRadius*1.445,boardRadius*1.462,96),
    new THREE.MeshStandardMaterial({color:'#dbc799',roughness:.9}));
  curb.rotation.x=-Math.PI/2;curb.position.y=-.53;group.add(curb);
  const count=64, radius=boardRadius*1.30;
  const stripes=new THREE.InstancedMesh(new THREE.BoxGeometry(1.05,.015,.10),
    new THREE.MeshBasicMaterial({color:'#e7dbb8'}),count);
  const stamp=new THREE.Object3D();
  for(let i=0;i<count;i++){
    const angle=i*Math.PI*2/count;
    stamp.position.set(radius*Math.cos(angle),-.53,radius*Math.sin(angle));
    stamp.rotation.y=-angle-Math.PI/2;stamp.updateMatrix();stripes.setMatrixAt(i,stamp.matrix);
  }
  group.add(stripes);
  return group;
}
