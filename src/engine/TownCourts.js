import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Each court has a shared paving bed, a passage between buildings and a street-facing shopfront.
const courts={
  'grand-bay':[[-34,-7,1.04,0],[-22,4,1.08,1],[-10,7,.9,2],[-23,-8,.94,2],[-10,-17,.87,0],[3,-26,.86,1]],
  'city-loop':[[5,-11,.65,1],[-4,-11,.65,0]],
  'island-fork':[[4,-4,.88,2]],
  'fortune-crossroads':[[5,-7,.65,0]],
  'taiwan-loop':[[-5,2,.95,2],[5,-5,.80,0]]
};
const schemes=[
  ['#edbd84','#aa4738','#5f7772'],['#e7a885','#376a75','#a66442'],['#f0d197','#628859','#705a4a']
];
export function createTownCourts(map){
  const group=new THREE.Group(), batches=new Map();
  const stamp=new THREE.Object3D();
  for(const [cx,cz,scale,style] of courts[map.id]||[]){
    const [wall,roof,trim]=schemes[style];
    const place=(geometry,color,x,y,z,rotation=0)=>{
      stamp.position.set(cx+x*scale,y*scale,cz+z*scale);
      stamp.scale.setScalar(scale);stamp.rotation.set(0,rotation,0);stamp.updateMatrix();
      geometry.applyMatrix4(stamp.matrix);
      if(geometry.index){const indexed=geometry;geometry=indexed.toNonIndexed();indexed.dispose();}
      if(!batches.has(color))batches.set(color,[]);
      batches.get(color).push(geometry);
    };
    const box=(x,y,z,w,h,d,c)=>place(new THREE.BoxGeometry(w,h,d),c,x,y,z);
    function hall(x,z,w,d,h){
      const cream='#ffe8bf',glass='#35565d',front=z+d/2;
      box(x,h/2+.15,z,w,h,d,wall);
      const cross=new THREE.Shape();cross.moveTo(-w*.56,0);cross.lineTo(-w*.30,.84);
      cross.lineTo(w*.29,.84);cross.lineTo(w*.56,0);cross.closePath();
      place(new THREE.ExtrudeGeometry(cross,{depth:d+.48,bevelEnabled:false}),roof,x,h+.13,z-d/2-.24);
      box(x,h+.13,z,w+.42,.16,d+.46,cream);
      const bays=Math.round(w/1.2);
      for(let i=0;i<bays;i++){
        const xx=x-w/2+(i+.5)*w/bays;
        box(xx,.91,front+.07,w/bays-.16,1.32,.12,glass);
        for(let floor=2.12;floor<h-.12;floor+=1.18){
          box(xx,floor,front+.06,.69,.67,.14,trim);
          box(xx,floor,front+.16,.07,.67,.06,cream);
          box(xx,floor-.39,front+.14,.84,.12,.29,cream);
        }
      }
      box(x,1.69,front+.29,w+.14,.18,.70,roof);
      for(const side of [-1,1])box(x+side*(w/2-.13),.87,front+.48,.14,1.56,.14,cream);
    }
    box(0,.035,0,10,.11,7.5,'#bf9c77');
    box(0,.115,2.65,9.8,.08,1.85,'#e5c59a');
    hall(-2.6,-.23,3.95,3.7,style===1?4.9:3.2);
    hall(2.15,-.6,3.55,3.15,style===2?4.3:2.7);
    if(map.id==='island-fork'){
      // A conical navigation light and its lantern balcony identify the tide harbor.
      const ring=(top,bottom,h,y,color)=>place(new THREE.CylinderGeometry(top,bottom,h,16),color,-3,y,4.7);
      ring(1.4,1.8,.45,.23,'#816e5c');
      ring(.89,1.20,2.4,1.60,'#f7e6bb');ring(.76,.89,1.36,3.48,'#be5642');
      ring(.65,.76,1.12,4.72,'#f7e6bb');ring(1.02,1.04,.18,5.37,'#395b64');
      ring(.66,.68,.92,5.91,'#e6bf6a');ring(.04,1.01,.70,6.70,'#a04a39');
      for(const dx of [-.50,.50])for(const dz of [-.40,.40])box(-3+dx,5.89,4.7+dz,.09,.95,.09,'#395b64');
    }
    if(map.id==='taiwan-loop'){
      // Contoured planted terraces descend from the tea houses into the valley.
      for(let n=0;n<4;n++){
        const geom=new THREE.CylinderGeometry(1,1.05,.27,32);
        geom.scale(3.8-n*.41,1,1.95-n*.23);
        place(geom,n%2?'#809746':'#99ad58',.5+n*.18,.19+n*.21,4.9+n*.13);
      }
    }
    for(const x of [-4,3.8]){
      box(x,.29,2.92,1.17,.32,.77,trim);
      place(new THREE.IcosahedronGeometry(.62,1),'#59844c',x,.72,2.92);
    }
  }
  for(const [color,parts] of batches){
    const material=new THREE.MeshStandardMaterial({color,roughness:.86});
    const mesh=new THREE.Mesh(mergeGeometries(parts,false),material);
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    for(const part of parts)part.dispose();
  }
  return group;
}
