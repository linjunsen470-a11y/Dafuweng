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
  ctx.fillStyle = '#b7c5a0'; ctx.fillRect(-71,-49,142,92);
  const polygon = (points, fill, edge) => {
    ctx.beginPath(); points.forEach(([x,z],i)=>i?ctx.lineTo(x,z):ctx.moveTo(x,z));ctx.closePath();
    ctx.fillStyle=fill;ctx.fill();if(edge){ctx.strokeStyle=edge;ctx.lineWidth=1.2;ctx.lineJoin='round';ctx.stroke();}
  };
  // Broad green contours connect existing hill models rather than introducing more peaks.
  polygon([[-50,-32],[-34,-34],[-20,-26],[-18,-9],[-23,7],[-35,14],[-49,8]],'#9db28f');
  polygon([[-45,-27],[-33,-29],[-24,-22],[-23,-10],[-28,4],[-38,7],[-45,1]],'#90a889');
  polygon([[-39,-23],[-31,-23],[-27,-14],[-30,-3],[-37,1],[-42,-7]],'#839e83');
  // A shared market court ties the north street's low backdrop to its two sidewalks.
  polygon([[27,-31],[50,-31],[50,-24],[28,-24]],'#c2b99e','#cdbf9f');
  for(const x of [30,39]){ctx.fillStyle='#9caa83';ctx.fillRect(x,-24.6,6,.7);}
  // Civic paving gives the existing central towers a shared urban base.
  const plaza=[[-3,-22],[19,-22],[23,-18],[23,3],[18,8],[0,8],[-4,2]];
  polygon(plaza,'#b6bcaf','#d0d0bb');
  ctx.save();ctx.beginPath();plaza.forEach(([x,z],i)=>i?ctx.lineTo(x,z):ctx.moveTo(x,z));ctx.closePath();ctx.clip();
  ctx.strokeStyle='#aab3a7';ctx.lineWidth=.12;
  for(let x=-4;x<=24;x+=3){ctx.beginPath();ctx.moveTo(x,-24);ctx.lineTo(x,9);ctx.stroke();}
  for(let z=-23;z<=9;z+=3){ctx.beginPath();ctx.moveTo(-5,z);ctx.lineTo(25,z);ctx.stroke();}ctx.restore();
  // Replace four saturated floating field squares with low-contrast planted ground.
  for(const [x,z] of [[-16,-4],[-8,-4],[-16,-10],[-8,-10]]){
    ctx.fillStyle='#acb986';ctx.fillRect(x-3.1,z-2.3,6.2,4.6);
    ctx.strokeStyle='#8fa077';ctx.lineWidth=.22;
    for(let dz=-1.7;dz<2;dz+=.8){ctx.beginPath();ctx.moveTo(x-2.8,z+dz);ctx.lineTo(x+2.8,z+dz);ctx.stroke();}
  }
  // Continuous built frontage follows existing roads; pavement has no arrows or tile markings.
  const tones={HARBOR:'#d7ceb1',OLD_TOWN:'#c9bba2',CBD:'#b8c5bc',HILLS:'#b7c19e'};
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const tile of map.tiles)for(const id of tile.next){
    const next=map.tiles.find(t=>t.id===id);if(!next?.position)continue;
    const a=tile.position,b=next.position;
    const gradient=ctx.createLinearGradient(a.x,a.z,b.x,b.z);
    gradient.addColorStop(0,tones[getTileDistrict(map,tile)?.id]||tones.HILLS);
    gradient.addColorStop(1,tones[getTileDistrict(map,next)?.id]||tones.HILLS);
    ctx.strokeStyle=gradient;ctx.lineWidth=13.5;ctx.beginPath();ctx.moveTo(a.x,a.z);ctx.lineTo(b.x,b.z);ctx.stroke();
  }
  // Subtle deterministic grain is baked once, independent of the game's random state.
  let seed=173;
  for(let i=0;i<4500;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=-71+seed/4294967296*142;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const z=-49+seed/4294967296*92;
    ctx.fillStyle=i%2?'rgba(255,255,235,.035)':'rgba(53,73,52,.025)';ctx.fillRect(x,z,.17,.12);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshStandardMaterial({map:texture,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const ground=new THREE.Mesh(createIslandSurfaceGeometry(),material);
  ground.name='city-district-ground';ground.rotation.x=-Math.PI/2;ground.position.set(0,-.095,0);ground.receiveShadow=true;ground.userData.isDistrictGround=true;
  return ground;
}
