import {quayRoutes} from '../game/QuayRoutes.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const quayLot = id => [1,3,6,8,11,13,15,16].includes(id);
// The shops on the inland side are permanent frontage. The opposite parcels
// remain empty until purchased and built through the normal property rules.
export function createQuayStreet(map) {
  const group=new THREE.Group(), batches=new Map();
  group.name='quay-market-quarter';
  function add(geometry,color,x,y,z,angle=0) {
    geometry.rotateY(angle);geometry.translate(x,y,z);
    if(geometry.index){const indexed=geometry;geometry=indexed.toNonIndexed();indexed.dispose();}
    if(!batches.has(color)) batches.set(color,[]);
    batches.get(color).push(geometry);
  }
  const box=(x,y,z,w,h,d,c,angle=0)=>add(new THREE.BoxGeometry(w,h,d),c,x,y,z,angle);
  const cylinder=(x,y,z,top,bottom,height,c,n=20)=>add(new THREE.CylinderGeometry(top,bottom,height,n),c,x,y,z);
  const cream='#ffe6bd', glass='#365e65', stone='#e4cda7', iron='#427b78';
  function roof(x,z,w,d,h,base,color) {
    const outline=new THREE.Shape();
    outline.moveTo(-w/2,0);outline.lineTo(w/2,0);outline.lineTo(0,h);outline.closePath();
    const g=new THREE.ExtrudeGeometry(outline,{depth:d,bevelEnabled:false});
    add(g,color,x,base,z-d/2);
  }
  // Each arched shopfront is real recessed geometry with a shaded display behind it.
  function arch(x,y,z,w,h) {
    const profile=new THREE.Shape(),r=w*.39;
    profile.moveTo(-w/2,0);profile.lineTo(-r,0);profile.lineTo(-r,h-r-.13);
    profile.absarc(0,h-r-.13,r,Math.PI,0,true);profile.lineTo(r,0);profile.lineTo(w/2,0);
    profile.lineTo(w/2,h);profile.lineTo(-w/2,h);profile.closePath();
    add(new THREE.ExtrudeGeometry(profile,{depth:.27,bevelEnabled:false,curveSegments:8}),cream,x,y,z);
  }
  function shop(x,z,w,d,h,wall,trim,style) {
    const f=z+d/2;
    box(x,h/2+.20,z,w,h,d,wall);
    box(x,.32,f+.45,w+.25,.28,1.15,stone);
    const bays=Math.max(2,Math.round(w/1.55)),bw=w/bays;
    for(let i=0;i<bays;i++){
      const px=x-w/2+bw*(i+.5);
      box(px,1.10,f+.03,bw-.18,1.56,.08,glass);
      box(px,1.02,f+.11,.075,1.52,.09,cream);
      arch(px,.43,f+.30,bw,1.62);
      for(let y=2.67;y<h-.22;y+=1.28){
        box(px,y,f+.05,bw*.63,.81,.12,glass);
        box(px,y,f+.14,.07,.83,.07,cream);
        box(px,y-.46,f+.12,bw*.82,.13,.24,cream);
      }
    }
    box(x,2.17,f+.40,w+.15,.17,.64,trim);
    box(x,h+.16,z,w+.25,.20,d+.25,cream);
    if(style===0)roof(x,z,w+.30,d+.32,1.03,h+.22,trim);
    else if(style===1){
      box(x,h+.40,z,w*.84,.36,d*.81,trim);
      for(const side of [-1,1])box(x+side*w*.38,h+.67,z,.20,.42,d*.85,cream);
    }else{
      roof(x,z,w+.20,d+.25,.69,h+.22,trim);
      box(x+w*.25,h+.80,z-.38,.42,.98,.48,wall);
    }
  }
  box(-18,.12,24.95,68,.17,2.15,stone);
  box(-18,.12,30.65,68,.17,1.55,stone);
  // Broken curb at lot gates, tactile brick strip connecting all doors.
  for(const id of [1,3,6,8,11,13,15,16]){
    const {x,z}=map.tiles[id].position;
    box(x,.20,z+2.90,1.36,.10,2.05,'#f7dc9c');
    for(const side of [-1,1])box(x+side*.85,.23,z+2.85,.13,.15,1.65,'#bf6d49');
  }
  for(let x=-51;x<16;x+=2)box(x,.226,25.85,1.87,.07,.15,cream);
  const styles=[
    [-43.8,21.9,4.3,4,4.6,'#eeb38a','#ae5c47',0],[-39.1,21.8,4.65,4.2,5.7,'#f3cf92','#608f89',1],
    [-33.9,21.7,5.2,4.3,3.6,'#efa687','#a75948',2],[-28.9,21.8,4.45,4.2,4.9,'#bbd6be','#367d7e',0],
    [-18.2,21.95,3.2,3.5,3.8,'#ffe0a0','#b67042',1],[-10.2,21.8,3.6,3.8,4.8,'#a9d4c3','#558585',2]
  ];
  for(const args of styles)shop(...args);
  // A second, staggered row encloses the walking lane behind the arcades.
  box(-28,.10,17.75,31,.14,1.55,'#d6bda4');
  for(const [x,w,h,wall,trim] of [[-41,5.0,5.4,'#e7cba4','#617d86'],[-34.8,5.7,6.2,'#e5a99a','#9d6159'],[-27.8,5.5,4.7,'#efcc8e','#957356'],[-20.7,4.5,5.9,'#abccc1','#498786']])
    shop(x,14.85,w,3.65,h,wall,trim,1);
  // The bank court opens toward the junction, with a terraced tide gauge and basin.
  box(-3.8,.14,22.60,8.3,.18,5.55,'#d5b994');
  box(-3.8,.235,23.06,7.65,.06,4.5,'#f3dcad');
  for(let i=0;i<3;i++)box(-3,.24+i*.095,24.8-i*.31,3.60-i*.17,.12,.42,cream);
  cylinder(-6, .41,23.7,1.03,1.13,.31,cream);
  cylinder(-6,.58,23.7,.87,.87,.06,'#4bbcbc');
  cylinder(-6,1.01,23.7,.12,.22,.86,iron);
  cylinder(-6,1.5,23.7,.55,.23,.24,'#66c9c5');
  // A clock lantern gives the low bank a silhouette above the shops.
  box(-3,2.8,19.1,2.15,5.45,1.90,'#78a59c');
  box(-3,5.48,19.1,2.48,.24,2.15,cream);
  for(const side of [-1,1])box(-3+side*.78,4.5,20.09,.17,1.85,.17,cream);
  const clock=new THREE.CylinderGeometry(.55,.55,.12,24);clock.rotateX(Math.PI/2);
  add(clock,'#fff0c2',-3,4.9,20.12);
  box(-3,5.05,20.20,.065,.31,.05,glass);box(-2.87,4.90,20.20,.27,.07,.05,glass);
  cylinder(-3,6.06,19.1,.12,1.62,1.04,iron,4);
  cylinder(-3,6.85,19.1,.035,.09,.72,'#d19d46');
  // The computing exchange opens onto tile 89, between the two developable parcels.
  // A stepped office and a vaulted trading hall flank the existing company entrance.
  box(22,.15,0,17.5,.22,10.6,'#abc0b0');
  box(22,.26,3.55,4.8,.12,6.2,'#eee0b3');
  const blue='#396c7e',pane='#80b7b8', brass='#d1a356';
  function officeTier(x,z,w,d,base,floors){
    const height=floors*.91;
    box(x,base+height/2,z,w,height,d,pane);
    for(let i=0;i<=floors;i++)box(x,base+i*.91,z,w+.24,.14,d+.24,blue);
    for(const side of [-1,1])box(x+side*(w/2-.24),base+height/2,z,.28,height,d+.28,cream);
  }
  officeTier(18,-2.35,5.8,4.4,.25,4);
  officeTier(17.6,-2.6,4.45,3.55,3.96,3);
  officeTier(17.3,-2.8,2.75,2.55,6.76,2);
  cylinder(17.3,9.23,-2.8,.05,.13,1.40,brass);
  box(26.8,1.24,.1,5.45,2.15,5.7,blue);
  // A longitudinal half-barrel roof and brass ribs mark the public gallery.
  for(let i=0;i<7;i++){
    const theta=(i+.5)*Math.PI/7;
    const panel=new THREE.BoxGeometry(1.31,.16,5.95);
    panel.rotateZ(Math.PI/2-theta);
    add(panel,i%2?pane:'#acd4c9',26.8-2.74*Math.cos(theta),2.27+2.74*Math.sin(theta),.1);
  }
  for(const x of [24.65,25.7,26.8,27.9,28.95]){
    box(x,1.37,3.01,.78,1.55,.12,pane);box(x,.48,3.09,.93,.15,.29,brass);
  }
  // A public demonstration court opens across the street from the exchange.
  // Leave the eastern approach clear for the gate of parcel 91.
  box(21,.12,15.15,8.4,.18,8.35,'#d7b895');
  box(21,.23,14.35,6.75,.09,6.35,'#f1d6a9');
  box(21,.23,10.85,2.35,.08,1.75,'#f1d6a9');
  for(let i=0;i<3;i++){
    const z=16.75+i*.66,w=5.1+i*.96;
    box(21,.32+i*.15,z,w,.22+i*.30,.70,'#b67858');
    box(21,.46+i*.30,z,w+.16,.12,.8,cream);
  }
  // The observatory's stone compass brings the shape of the instrument into its forecourt.
  cylinder(21,.294,13.8,2.21,2.21,.025,blue,32);
  cylinder(21,.312,13.8,2.08,2.08,.025,cream,32);
  for(let i=0;i<12;i++){
    const theta=i*Math.PI/6;
    box(21+Math.sin(theta)*1.71,.332,13.8+Math.cos(theta)*1.71,
      i%3?.065:.14,.025,i%3?.32:.61,brass,theta);
  }
  for(const x of [17.75,24.25]){
    box(x,.38,14.45,.89,.3,3.15,'#af8967');
    for(let i=0;i<5;i++){
      const g=new THREE.IcosahedronGeometry(1,1);
      g.scale(.43,.37+(i%2)*.11,.50);
      add(g,i%2?'#4f866c':'#79985a',x,.69,13.23+i*.61,i*.8);
    }
  }
  cylinder(21,.55,13.8,.68,.91,.72,blue);
  const dish=new THREE.LatheGeometry([
    new THREE.Vector2(0,.00),new THREE.Vector2(.48,.12),new THREE.Vector2(1.06,.42),
    new THREE.Vector2(1.10,.52),new THREE.Vector2(.48,.22),new THREE.Vector2(0,.10)
  ],24);
  dish.rotateZ(-.5);add(dish,brass,21,1.02,13.8);
  // The outer route arrives along the quay; the inland route arrives from the north.
  for(const [x,z] of [[44.25,26.2],[47.8,29.8]]){
    cylinder(x,.65,z,.29,.48,1.25,blue,8);cylinder(x,1.56,z,.42,.32,.60,brass,8);
  }
  // The seaward fish market has a striped canopy, distinct from the neighboring arcade.
  for(let i=0;i<9;i++){
    const awning=new THREE.BoxGeometry(.57,.14,1.24);awning.rotateX(.19);
    add(awning,i%2?cream:'#a94a38',-36.18+i*.57,2.08,24.24);
  }
  for(const x of [-36.1,-31.8])box(x,1.05,24.79,.12,1.9,.12,iron);
  // Street edges follow the actual routes and stay clear of tile numbers.
  for(const {ids,color} of Object.values(quayRoutes)){
    for(let i=1;i<ids.length;i++){
      const a=map.tiles[ids[i-1]].position,b=map.tiles[ids[i]].position;
      const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
      box((a.x+b.x)/2-dz/len*1.77,.238,(a.z+b.z)/2+dx/len*1.77,.18,.045,len,color,Math.atan2(dx,dz));
    }
  }
  for(const [color,parts] of batches){
    const mesh=new THREE.Mesh(mergeGeometries(parts,false),new THREE.MeshStandardMaterial({color,roughness:.83}));
    for(const g of parts)g.dispose();
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  return group;
}
