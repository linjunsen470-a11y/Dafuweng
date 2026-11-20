import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// The near bank stays below pawn height. The working frontage and civic skyline
// occupy the opposite bank. Coordinates follow the original playable street.
export function createMarketDistrict(map) {
  const port=map.id==='island-fork';
  if(!port && map.id!=='taiwan-loop')return null;
  const district=new THREE.Group(), batches=new Map(), placement=new THREE.Object3D();
  const sand='#ebcc9b', brick='#b96547', cream='#ffdfac', wood='#865232', iron='#38545a';
  const teal='#388789', shade='#405e5c', tile='#ae503c', glass='#69999a';
  let originX=0, originZ=0, heading=0;
  function at(x,z,yaw=0){originX=x;originZ=z;heading=yaw;}
  function shape(geometry,color,x,y,z,angle=0){
    placement.position.set(originX+x*Math.cos(heading)+z*Math.sin(heading),y,originZ-x*Math.sin(heading)+z*Math.cos(heading));
    placement.rotation.set(0,heading+angle,0);placement.updateMatrix();geometry.applyMatrix4(placement.matrix);
    if(geometry.index){const indexed=geometry;geometry=indexed.toNonIndexed();indexed.dispose();}
    if(!batches.has(color))batches.set(color,[]);
    batches.get(color).push(geometry);
  }
  function box(x,y,z,w,h,d,color){shape(new THREE.BoxGeometry(w,h,d),color,x,y,z);}
  function profile(points,x,y,z,d,color){
    const outline=new THREE.Shape(points.map(([a,b])=>new THREE.Vector2(a,b)));
    shape(new THREE.ExtrudeGeometry(outline,{depth:d,bevelEnabled:false}),color,x,y,z);
  }
  function disc(x,y,z,r,h,c){shape(new THREE.CylinderGeometry(r,r,h,20),c,x,y,z);}
  // Each bay has an open colonnade, an inhabited upper floor and a roof with depth.
  function bay(w,h,wall,roof,style){
    box(0,.13,.1,w,.24,4.4,sand);
    box(0,h/2,-.45,w-.08,h,2.95,wall);
    box(0,1.32,1.31,w,.22,1.18,cream);
    for(const side of [-1,1])box(side*(w/2-.19),.71,1.77,.23,1.42,.25,port?wood:brick);
    for(let i=0;i<3;i++){
      const xx=w*(i-1)/3;
      box(xx,.77,1.06,w*.27,1.03,.1,shade);
      box(xx,h-.71,1.06,w*.22,.72,.14,glass);
      box(xx,h-.73,1.16,.09,.72,.10,cream);
      box(xx,h-1.14,1.15,w*.26,.10,.29,cream);
    }
    box(0,h,0,w+.15,.18,3.78,cream);
    if(port){
      profile([[-w*.53,0],[-w*.22,1.04],[w*.53,0]],0,h,-2.04,3.91,roof);
      box(-w*.22,h+1.06,-.09,.15,.12,4.03,cream);
      // Glazed clerestories set across the long roof, with a timber lip that casts a shadow.
      if(style%2===0){
        box(.35,h+.60,-.1,.93,.51,1.28,glass);
        box(.35,h+.89,-.1,1.10,.12,1.46,cream);
      }
      for(const dz of [-1.44,-.63,.18,.99]){
        const seam=new THREE.BoxGeometry(w*.79,.047,.055);
        seam.rotateZ(-Math.atan2(1.04,w*.75));
        shape(seam,'#679b91',w*.155,h+.55,dz);
      }
      for(let i=0;i<5;i++) box(w*(i-2)/5,1.54,1.61,w/5,.12,.85,i%2?cream:roof);
    }else{
      profile([[-w*.53,0],[-w*.28,.74],[w*.25,.74],[w*.53,0]],0,h,-2,3.8,roof);
      const cap=style%2?.90:1.28;
      profile([[-w*.49,0],[-w*.49,.36],[-w*.24,.36],[-w*.24,.62],[0,cap],[w*.24,.62],[w*.24,.36],[w*.49,.36],[w*.49,0]],0,h,1.24,.25,wall);
      const medallion=new THREE.CylinderGeometry(.21,.21,.12,12);
      medallion.rotateX(Math.PI/2);shape(medallion,cream,0,h+.42,1.52);
      for(const side of [-1,1]){
        shape(new THREE.SphereGeometry(.18,8,6),'#d6673d',side*w*.33,1.16,1.69);
        box(side*w*.33,.93,1.69,.08,.16,.08,wood);
      }
    }
  }
  if(!port){
    // Ochre arcades frame a fountain forecourt, the gap on its axis stays open to the road.
    at(0,9.4);
    box(0,.075,.6,25,.14,5.55,'#dcb58f');
    for(const [i,x] of [-10.15,-6.2,2.55,6.53,10.54].entries()){
      at(x,9.4);bay(4,2.95+[.55,1.18,0,.74,.34][i],[cream,'#e9a778','#e9b07d'][i%3],i%2?tile:'#60817b',i);
    }
    at(-1.93,10.6);disc(0,.18,0,2.62,.28,'#cc996d');disc(0,.4,0,1.55,.4,cream);
    disc(0,.64,0,1.34,.12,'#52adaa');disc(0,.97,0,.26,.70,brick);disc(0,1.34,0,.76,.16,cream);
    at(-1.93,6.70);
    box(0,2.4,0,2.88,4.8,2.63,'#d99666');box(0,5,0,2.25,1.72,2.12,cream);
    for(const face of [-1,1])box(0,5.05,face*1.08,1.41,1.01,.15,shade);
    shape(new THREE.ConeGeometry(2.19,1.83,4).rotateY(Math.PI/4),'#477578',0,6.68,0);
    // A stone-lined irrigation channel and low market gardens wrap the foreground.
    at(2,27);
    box(0,.09,.2,39,.16,4.4,'#aa997b');box(0,.19,.2,39,.09,3.74,'#73a99b');
    for(const side of [-1,1])box(0,.32,side*2+.2,39,.44,.31,'#d0aa80');
    for(const x of [-13,-4,6,15]){
      box(x,.47,.2,2.05,.29,4.55,wood);
      for(const side of [-1,1])box(x+side*.94,.78,.2,.10,.27,4.39,cream);
    }
    // The channel turns the same corner as the opening route. Short embankment
    // spans overlap on the tangent, leaving a continuous water surface around the bend.
    for(let i=0;i<=9;i++){
      const a=(i+.5)*Math.PI/20;
      at(21.5+6*Math.sin(a),21.2+6*Math.cos(a),a);
      box(0,.19,0,1.43,.071+i*.0004,4.06,'#73a99b');
      for(const side of [-1,1])box(0,.32,side*2,.24+(6+side*2)*Math.PI/20,.44,.31,'#d0aa80');
    }
    at(27.5,14.6,Math.PI/2);
    box(0,.19,0,13.3,.09,4.04,'#73a99b');
    for(const side of [-1,1])box(0,.32,side*2,13.5,.44,.31,'#d0aa80');
    // Gatehouse and hoist span the water, their opening frames the canal itself.
    at(27.5,13.4);
    for(const side of [-1,1]) {
      box(side*2.10,1.17,0,.59,2.3,1.60,brick);
      box(side*2.10,2.36,0,.82,.23,1.86,cream);
    }
    box(0,2.57,0,4.84,.29,1.75,wood);
    box(0,3.0,0,2.42,.64,1.36,cream);
    profile([[-1.74,0],[-.55,.72],[.55,.72],[1.74,0]],0,3.31,-.99,1.98,teal);
    const wheel=new THREE.TorusGeometry(.44,.10,6,12);
    shape(wheel,brick,0,2.99,.77);
    at(2,27);
    for(let i=0;i<16;i++){
      const x=i*2.29-17.1, z=.62*Math.sin(i*4.65);
      box(x,.245,z,.51,.018,.048,'#a3c7ad');
      if(i%3===0)disc(x+.46,.251,z+.3,.21,.022,'#88a162');
    }
    for(let i=0;i<12;i++){
      const x=i*3.1-17.2;box(x,.25,3.65,2.86,.36,1.83,brick);
      for(const row of [-.46,0,.46])box(x,.52,3.65+row,2.64,.35,.29,i%3?'#729455':'#94a958');
    }
  }else{
    // Fish exchange follows the inside bend. A broad covered auction hall terminates the row.
    for(const [i,x] of [-8,-4.2,-.4,3.4,7.16,10.72].entries()){
      const angle=x*.031,z=9.06-.016*x*x;
      at(x,z,angle);bay(3.89,[2.45,2.71,3.15,2.69,2.50,2.27][i],i%2?'#eed39b':'#c68f64',i%3?teal:'#a65a45',i);
    }
    at(-1,4.5);box(0,1.46,0,7.18,2.88,3.70,brick);
    profile([[-4,0],[-1.75,1.7],[1.65,1.7],[4,0]],0,2.9,-2.12,4.24,iron);
    box(0,4.91,0,3.5,.63,2.27,glass);box(0,5.3,0,4,.24,2.68,teal);
    // Outer bank: a continuous boardwalk turns with the original plots, with short landing fingers.
    for(let i=0;i<8;i++){
      const angle=(i-2)*.158, x=Math.sin(angle)*32,z=Math.cos(angle)*24.5;
      at(x,z,angle);box(0,.19,0,5.21,.31,2.48,wood);
      for(let plank=-4;plank<=4;plank++)box(plank*.57,.38,0,.52,.11,2.43,i%2?'#c39762':'#cda373');
      if(i%2===0){
        box(0,.24,2.4,1.85,.25,3.58,'#bc9164');
        for(const side of [-1,1])disc(side*.78,.61,4.03,.18,.90,iron);
      }
    }
  }
  for(const [color,parts] of batches){
    const mesh=new THREE.Mesh(mergeGeometries(parts),new THREE.MeshStandardMaterial({color,roughness:.91}));
    mesh.castShadow=mesh.receiveShadow=true;district.add(mesh);parts.forEach(p=>p.dispose());
  }
  district.name=port?'fish-exchange-quays':'canal-market-quarter';
  return district;
}
