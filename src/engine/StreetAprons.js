import * as THREE from 'three';
import {classicStreetRows} from './ClassicFrontages.js';

// Paint one continuous pedestrian surface beneath the tiled roads, gates and arcades.
// Coordinates are in board units; no part of this surface is a selectable road.
export function createStreetAprons(map){
  const span=96,size=1024,canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const c=canvas.getContext('2d');
  c.translate(size/2,size/2);c.scale(size/span,size/span);
  const pier=map.id==='island-fork',stone=map.id==='taiwan-loop'?'#c6a384':'#d0b695';
  c.lineCap='round';c.lineJoin='round';
  const trace=(a,b,width,color)=>{
    c.lineWidth=width;c.strokeStyle=color;c.beginPath();c.moveTo(a.x,a.z);c.lineTo(b.x,b.z);c.stroke();
  };
  let coastPoints,landscape;
  if(pier){
    // Reuse the same shoreline for the land paint and the sloping 3D rock face.
    const shore=new THREE.Shape();shore.moveTo(-35,-7);
    shore.bezierCurveTo(-39,-18,-25,-24,-17,-24);shore.bezierCurveTo(-7,-23,-2,-33,11,-29);
    shore.bezierCurveTo(21,-26,35,-21,36,-11);shore.bezierCurveTo(35,-3,42,4,37,12);
    shore.bezierCurveTo(34,16,28,14,23,17.2);shore.bezierCurveTo(14,23.5,3,25.7,-7,24.3);
    shore.bezierCurveTo(-17,29,-27,22,-30,15);shore.bezierCurveTo(-34,9,-39,1,-35,-7);
    coastPoints=shore.getPoints(12);
    const coast=new Path2D();
    coastPoints.forEach((p,i)=>i?coast.lineTo(p.x,p.y):coast.moveTo(p.x,p.y));coast.closePath();
    c.lineWidth=.32;c.strokeStyle='#ddbb8b';c.stroke(coast);c.fillStyle='#b7c186';c.fill(coast);
    c.save();c.clip(coast);
    for(let i=0;i<120;i++){
      const x=((i*467)%797)/10-40,z=((i*257)%621)/10-31;
      const g=c.createRadialGradient(x,z,0,x,z,3.8);
      g.addColorStop(0,i%3?'rgba(91,138,74,.48)':'rgba(238,206,127,.5)');g.addColorStop(1,'rgba(169,186,123,0)');
      c.fillStyle=g;c.fillRect(x-4,z-4,8,8);
    }
    c.restore();
    landscape=document.createElement('canvas');landscape.width=landscape.height=size;
    landscape.getContext('2d').drawImage(canvas,0,0);c.clearRect(-span/2,-span/2,span,span);
  }
  const outline=new Path2D();
  for(const tile of map.tiles)for(const n of tile.next){
    const b=map.tiles[n].position;outline.moveTo(tile.position.x,tile.position.z);outline.lineTo(b.x,b.z);
  }
  for(const [width,color] of [[12.5,pier?'#a99377':'#b09b78'],[12,stone],[10.8,pier?'#dbbb94':'#dfc8a5']]){
    c.lineWidth=width;c.strokeStyle=color;c.stroke(outline);
  }
  for(const [x,z,scale,,angle] of classicStreetRows(map)){
    const nearest=map.tiles.reduce((best,t)=>Math.hypot(t.position.x-x,t.position.z-z)<Math.hypot(best.position.x-x,best.position.z-z)?t:best,map.tiles[0]);
    const entrance={x:x+Math.sin(angle)*3.2*scale,z:z+Math.cos(angle)*3.2*scale};
    trace(nearest.position,entrance,5.1,stone);
    c.save();c.translate(x,z);c.rotate(-angle);c.fillStyle=stone;
    c.beginPath();c.roundRect(-5.9*scale,-4.4*scale,11.8*scale,9.8*scale,.9);c.fill();c.restore();
  }
  for(const tile of map.tiles){
    const plot=tile.lot||tile.serviceFrontage;if(!plot)continue;
    trace(tile.position,plot.position,2.5,'#edcfaa');
    c.fillStyle=stone;c.beginPath();c.arc(plot.position.x,plot.position.z,2.45,0,2*Math.PI);c.fill();
  }
  // Bonded stone paving continues around corners, including the spaces between individual plots.
  c.globalCompositeOperation='source-atop';c.lineWidth=.07;c.strokeStyle='rgba(107,83,62,.27)';
  c.beginPath();
  for(let row=-46;row<46;row++){
    const z=row*.94;c.moveTo(-44,z);c.lineTo(44,z);
    for(let col=-21;col<21;col++){const x=col*2.2+(row%2)*1.1;c.moveTo(x,z);c.lineTo(x,z+.94);}
  }
  c.stroke();
  if(landscape){
    c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='destination-over';c.drawImage(landscape,0,0);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(span,span),new THREE.MeshStandardMaterial({map:texture,alphaTest:.45,roughness:.98}));
  mesh.name='continuous-street-aprons';mesh.rotation.x=-Math.PI/2;mesh.position.y=.016;mesh.receiveShadow=true;
  if(!pier)return mesh;
  const island=new THREE.Group();island.add(mesh);
  // A shore landing connects the outer reef road to a working jetty at the east bend.
  const timber=new THREE.MeshStandardMaterial({color:'#ae7950',roughness:1});
  const piling=new THREE.MeshStandardMaterial({color:'#72533f',roughness:.95});
  const bollard=new THREE.MeshStandardMaterial({color:'#e8d292'});
  const beam=(x,y,z,w,h,d,material)=>{
    const part=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    part.position.set(x,y,z);part.castShadow=true;part.receiveShadow=true;island.add(part);
  };
  // The little planted splitter sits inside the loop, clear of both playable edges.
  const bed=new THREE.Mesh(new THREE.CylinderGeometry(1,1.08,.24,24),new THREE.MeshStandardMaterial({color:'#c3a37b'}));
  bed.scale.set(1.48,1,2.08);bed.rotation.y=.32;bed.position.set(20.4,.22,-4.1);island.add(bed);
  const planting=new THREE.Mesh(new THREE.CylinderGeometry(.91,.94,.19,24),new THREE.MeshStandardMaterial({color:'#739657'}));
  planting.scale.copy(bed.scale);planting.rotation.y=bed.rotation.y;planting.position.copy(bed.position);planting.position.y=.41;island.add(planting);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.085,.14,2.3,10),piling);
  mast.position.set(20.4,1.64,-4.1);island.add(mast);
  const sail=new THREE.Shape();sail.moveTo(0,0);sail.lineTo(1.13,.16);sail.quadraticCurveTo(.53,1.05,0,1.7);sail.closePath();
  const vane=new THREE.Mesh(new THREE.ExtrudeGeometry(sail,{depth:.10,bevelEnabled:false}),new THREE.MeshStandardMaterial({color:'#fae6ab'}));
  vane.position.set(20.5,.92,-4.1);vane.rotation.y=.35;island.add(vane);
  beam(34.6,.15,-2,13.1,.21,2.05,timber);
  for(let x=28.6;x<41;x+=.63)beam(x,.266,-2,.039,.03,2.04,piling);
  beam(40.45,.15,-2,1.65,.24,6.4,timber);
  for(const x of [30,33.3,36.6,39.9])for(const z of [-3.02,-.98]){
    beam(x,.05,z,.24,1.5,.24,piling);beam(x,.82,z,.29,.13,.29,bollard);
  }
  const hullProfile=new THREE.Shape();
  hullProfile.moveTo(0,2.2);hullProfile.quadraticCurveTo(1.05,1.32,.84,-1.65);
  hullProfile.lineTo(-.84,-1.65);hullProfile.quadraticCurveTo(-1.05,1.32,0,2.2);
  const hullGeometry=new THREE.ExtrudeGeometry(hullProfile,{depth:.42,bevelEnabled:true,bevelSize:.09,bevelThickness:.09,bevelSegments:2});
  hullGeometry.rotateX(-Math.PI/2);
  const hull=new THREE.Mesh(hullGeometry,new THREE.MeshStandardMaterial({color:'#337f87'}));
  hull.position.set(42.4,-.55,-2.5);island.add(hull);
  beam(42.4,.24,-2.15,1.15,.68,1.1,bollard);beam(42.4,.67,-2.15,1.45,.16,1.43,piling);

  const verts=[],colors=[];
  const sand=new THREE.Color('#dbb889'),wet=new THREE.Color('#839b86');
  for(let i=1;i<coastPoints.length;i++){
    const a=coastPoints[i-1],b=coastPoints[i];
    for(const [p,lower] of [[a,false],[b,false],[a,true],[b,false],[b,true],[a,true]]){
      verts.push(p.x*(lower?1.034:1),lower?-.68:.014,p.y*(lower?1.034:1));
      const color=lower?wet:sand;colors.push(color.r,color.g,color.b);
    }
  }
  const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  geom.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geom.computeVertexNormals();
  island.add(new THREE.Mesh(geom,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide})));
  const waterCanvas=document.createElement('canvas');waterCanvas.width=waterCanvas.height=256;
  const water=waterCanvas.getContext('2d');water.fillStyle='#65a9ac';water.fillRect(0,0,256,256);
  for(let i=0;i<54;i++){
    const x=i*127%256,y=i*73%256;
    water.strokeStyle=i%3?'#80b9b6':'#94cac0';water.lineWidth=.9;water.beginPath();water.moveTo(x,y);
    water.quadraticCurveTo(x+3,y+1.6,x+7,y-.4);water.stroke();
  }
  const ripples=new THREE.CanvasTexture(waterCanvas);ripples.colorSpace=THREE.SRGBColorSpace;
  ripples.wrapS=ripples.wrapT=THREE.RepeatWrapping;ripples.repeat.set(18,18);
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(360,360),new THREE.MeshStandardMaterial({map:ripples,roughness:.65}));
  sea.rotation.x=-Math.PI/2;sea.position.y=-.62;island.add(sea);
  return island;
}
