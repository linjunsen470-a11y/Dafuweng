import {createIslandSurfaceGeometry} from './IslandCoast.js';
import * as THREE from 'three';
import {getTileDistrict} from '../game/BoardVisualRules.js';

// One original, static land-use surface. It never adds road edges, hit targets,
// height changes or map data; numbered road meshes remain above it.
export function createCityGround(map) {
  if (map.id !== 'grand-bay') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 664;
  const ctx = canvas.getContext('2d');
  ctx.scale(canvas.width / 142, canvas.height / 92);
  ctx.translate(71, 49);
  ctx.fillStyle = '#74c655'; ctx.fillRect(-71,-49,142,92);
  const polygon = (points, fill, edge) => {
    ctx.beginPath(); points.forEach(([x,z],i)=>i?ctx.lineTo(x,z):ctx.moveTo(x,z));ctx.closePath();
    ctx.fillStyle=fill;ctx.fill();if(edge){ctx.strokeStyle=edge;ctx.lineWidth=1.2;ctx.lineJoin='round';ctx.stroke();}
  };
  // Large sunlit spring meadows with warm golden clover patches and vibrant emerald depth.
  for(let row=0;row<10;row++)for(let col=0;col<15;col++){
    const x=-71+col*10+Math.sin(row*3+col)*3,z=-49+row*10+Math.cos(row+col*4)*3;
    const glow=ctx.createRadialGradient(x,z,.4,x,z,7.8);
    glow.addColorStop(0,(col+row)%3?'rgba(62,156,56,.48)':'rgba(198,232,102,.55)');
    glow.addColorStop(1,'rgba(116,198,85,0)');ctx.fillStyle=glow;ctx.fillRect(x-8,z-8,16,16);
  }
  // Lush green hillside contours
  polygon([[-50,-32],[-34,-34],[-20,-26],[-18,-9],[-23,7],[-35,14],[-49,8]],'#6db856');
  polygon([[-45,-27],[-33,-29],[-24,-22],[-23,-10],[-28,4],[-38,7],[-45,1]],'#5ca84d');
  polygon([[-39,-23],[-31,-23],[-27,-14],[-30,-3],[-37,1],[-42,-7]],'#4e9943');
  // Curving planted terraces with sunny gold footpaths.
  for (const [x,z,w,d] of [[-20,-20,14,8],[-41,-29,12,6],[-9,-28,11,7],[-32,10,11,6],[-18,16,10,5]]) {
    ctx.save();
    ctx.translate(x,z);
    ctx.rotate(-.16);
    ctx.fillStyle='#ebd59d';
    ctx.beginPath();ctx.ellipse(0,0,w*.52,d*.52,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(0,0,w*.49,d*.47,0,0,Math.PI*2);ctx.clip();
    ctx.fillStyle='#96ca59';ctx.fillRect(-w,-d,2*w,2*d);
    for(let row=-d;row<=d;row+=.95) {
      ctx.beginPath();ctx.moveTo(-w,row);
      ctx.bezierCurveTo(-w*.3,row-2,w*.24,row+1.7,w,row-1);
      ctx.strokeStyle='#5da346';ctx.lineWidth=.58;ctx.stroke();
      ctx.strokeStyle='#c7e67e';ctx.lineWidth=.18;ctx.stroke();
    }
    ctx.restore();
  }
  // Warm Mediterranean market court behind the north street.
  polygon([[27,-31],[50,-31],[50,-24],[28,-24]],'#ecd7b2','#f4e4c4');
  for(const x of [30,39]){ctx.fillStyle='#6db856';ctx.fillRect(x,-24.6,6,.7);}
  // Warm sunlit sandstone civic plaza under central towers.
  const plaza=[[-3,-22],[19,-22],[23,-18],[23,3],[18,8],[0,8],[-4,2]];
  polygon(plaza,'#ebd8b4','#f6e8cb');
  ctx.save();ctx.beginPath();plaza.forEach(([x,z],i)=>i?ctx.lineTo(x,z):ctx.moveTo(x,z));ctx.closePath();ctx.clip();
  ctx.strokeStyle='#d4bc92';ctx.lineWidth=.18;
  for(let x=-4;x<=24;x+=3){ctx.beginPath();ctx.moveTo(x,-24);ctx.lineTo(x,9);ctx.stroke();}
  for(let z=-23;z<=9;z+=3){ctx.beginPath();ctx.moveTo(-5,z);ctx.lineTo(25,z);ctx.stroke();}ctx.restore();
  // Vibrant orchard garden plots.
  for(const [x,z] of [[-16,-4],[-8,-4],[-16,-10],[-8,-10]]){
    ctx.fillStyle='#8fd05e';ctx.fillRect(x-3.1,z-2.3,6.2,4.6);
    ctx.strokeStyle='#63a948';ctx.lineWidth=.22;
    for(let dz=-1.7;dz<2;dz+=.8){ctx.beginPath();ctx.moveTo(x-2.8,z+dz);ctx.lineTo(x+2.8,z+dz);ctx.stroke();}
  }
  // Bright grass blades & tiny spring wildflowers across the open meadows.
  for(let i=0;i<1200;i++){
    const x=-70+((i*79)%1399)/10, z=-48+((i*37)%907)/10;
    ctx.strokeStyle=i%3?'#57ab48':'#a8e270';
    ctx.lineWidth=.14;ctx.beginPath();ctx.moveTo(x-.21,z-.17);
    ctx.lineTo(x,z);ctx.lineTo(x+.17,z-.24);ctx.stroke();
    if(i%19===0){
      ctx.fillStyle=i%38===0?'#fff7a8':'#ffffff';
      ctx.fillRect(x-.14,z-.14,.28,.28);
    }
  }
  // Warm sunlit boulevard aprons following existing roads.
  const tones={HARBOR:'#f0dec0',OLD_TOWN:'#ebd4af',CBD:'#e8dec2',HILLS:'#d4e0a0'};
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const tile of map.tiles)for(const id of tile.next){
    const next=map.tiles.find(t=>t.id===id);if(!next?.position)continue;
    const a=tile.position,b=next.position;
    const gradient=ctx.createLinearGradient(a.x,a.z,b.x,b.z);
    gradient.addColorStop(0,tones[getTileDistrict(map,tile)?.id]||tones.HILLS);
    gradient.addColorStop(1,tones[getTileDistrict(map,next)?.id]||tones.HILLS);
    ctx.strokeStyle=gradient;ctx.lineWidth=7.6;ctx.beginPath();ctx.moveTo(a.x,a.z);ctx.lineTo(b.x,b.z);ctx.stroke();
  }
  // Subtle deterministic grain is baked once, independent of the game's random state.
  let seed=173;
  for(let i=0;i<26500;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=-71+seed/4294967296*142;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const z=-49+seed/4294967296*92;
    ctx.fillStyle=i%2?'rgba(255,250,208,.25)':'rgba(56,85,44,.17)';ctx.fillRect(x,z,.24,.13);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshStandardMaterial({map:texture,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const ground=new THREE.Mesh(createIslandSurfaceGeometry(),material);
  ground.name='city-district-ground';ground.rotation.x=-Math.PI/2;ground.position.set(0,-.095,0);ground.receiveShadow=true;ground.userData.isDistrictGround=true;
  return ground;
}

// Low citrus trees and fruit clusters sit inside the planted terraces.
export function createTerraceOrchards(trees = [[-22,-21],[-19,-21],[-16,-21],[-21,-18],[-18,-18],
  [-45,-29],[-42,-29],[-39,-29],[-10,-26],[-7,-26],[-10,-29],[-7,-29]]) {
  const group = new THREE.Group();
  group.name = 'terrace-orchards';
  const crowns = [], trunks = [], fruit = [];
  for (const [index,[x,z]] of trees.entries()) {
    const h = .7 + (index % 3) * .1;
    trunks.push([x,h/2,z,.15,h,.15]);
    for (const [dx,dy,dz,r] of [[-.32,0,.07,.52],[.30,.11,-.08,.55],[0,.38,.02,.49]]) {
      crowns.push([x+dx,h+dy,z+dz,r, r*.77,r*.83]);
      fruit.push([x+dx+.12,h+dy+.06,z+dz+r*.76,.084,.086,.082]);
    }
  }
  const stamp = new THREE.Object3D();
  function batch(rows, geometry, palette) {
    const mesh = new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({roughness:.92,flatShading:true}),rows.length);
    rows.forEach(([x,y,z,w,h,d],i)=>{
      stamp.position.set(x,y,z);stamp.scale.set(w,h,d);stamp.rotation.y=i*.57;stamp.updateMatrix();
      mesh.setMatrixAt(i,stamp.matrix);mesh.setColorAt(i,new THREE.Color(palette[i%palette.length]));
    });
    mesh.castShadow=true; mesh.receiveShadow=true;group.add(mesh);
  }
  batch(trunks,new THREE.CylinderGeometry(.72,1,1,7),['#885f45']);
  batch(crowns,new THREE.IcosahedronGeometry(1,1),['#699959','#80a95e','#599067']);
  batch(fruit,new THREE.IcosahedronGeometry(1),['#f5ac48','#ffd077']);
  return group;
}
