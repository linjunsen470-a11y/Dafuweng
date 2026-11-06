import * as THREE from 'three-modern';
import {mergeGeometries} from 'three-modern/addons/utils/BufferGeometryUtils.js';
import {DOCK_NEIGHBORS} from './SliceDockStories.js';
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
// Above the island on shore, descending only beyond the beach edge.
export const dockDeckHeight=t=>t<.15?t/.15*.12:t<=.65?.12:.12-1.24*(t-.65)/.35;
/** Original vertex-colored miniature docks: nine draw calls, no textures or RNG. */
export class SliceDocks{
 constructor(scene,tiles){
  this.group=new THREE.Group();this.group.name='regional-docks';scene.add(this.group);this.picks=[];this.residents=[];this.time=0;
  this.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88});
  for(const [i,dock] of DOCK_NEIGHBORS.entries()){
   const tile=tiles.find(t=>t.id===dock.tileId),angle=Math.atan2(tile.position.z/17,tile.position.x/22),end=v(22*Math.cos(angle),-.9,17*Math.sin(angle)),origin=v(tile.position.x,.22,tile.position.z),delta=end.clone().sub(origin),length=Math.hypot(delta.x,delta.z);
   const root=new THREE.Group();root.name=dock.id;root.position.copy(origin);root.rotation.y=Math.atan2(delta.x,delta.z);this.group.add(root);
   const parts=[],body=[],arm=[],wood='#bc9875',cream='#fff0d3',dark='#4f635b',skin='#e7b58d',ink='#334c49',y=z=>dockDeckHeight(z/length);
   const add=(list,g,color,pos,rot=[0,0,0])=>{g.rotateX(rot[0]);g.rotateY(rot[1]);g.rotateZ(rot[2]);g.translate(...pos);const c=new THREE.Color(color),a=[];for(let k=0;k<g.attributes.position.count;k++)a.push(c.r,c.g,c.b);g.setAttribute('color',new THREE.Float32BufferAttribute(a,3));list.push(g);};
   const box=(list,x,yy,z,w,h,d,c,rot)=>add(list,new THREE.BoxGeometry(w,h,d),c,[x,yy,z],rot);
   const ball=(list,x,yy,z,r,c,s=[1,1,1])=>{const g=new THREE.SphereGeometry(r,10,7);g.scale(...s);add(list,g,c,[x,yy,z]);};
   const cyl=(list,x,yy,z,r,h,c)=>add(list,new THREE.CylinderGeometry(r,r,h,10),c,[x,yy,z]);
   // Sloped planks line up with the transport departure path and stop before the road.
   for(let z=1.25;z<length;z+=.43)box(parts,0,y(z)-.09,z,1.55,.16,.39,wood,[z/length>.65?Math.atan2(1.24,length*.35):0,0,0]);
   box(parts,0,y(3)-.12,3,3.3,.18,3.2,wood);
   for(const z of [2.1,4])for(const x of [-1.5,1.5]){cyl(parts,x,y(3)-.65,z,.085,1.4,dark);ball(parts,x,y(3)+.08,z,.12,cream);}
   const floor=y(3),roof=floor+1.7;
   // Shelter sits to the side, leaving the central boarding lane clear.
   for(const z of [2.2,3.8])cyl(parts,-1.25,floor+.8,z,.05,1.6,dark);
   if(i===0){
    box(parts,-1.15,roof,3,1.0,.17,2.15,dock.color,[0,0,.12]);
    for(let k=0;k<3;k++)box(parts,.9,floor+.2+k*.27,3.6,.5,.28,.55,k===1?cream:wood);
    for(let k=0;k<3;k++){const g=new THREE.TorusGeometry(.21+k*.03,.035,5,12);g.rotateX(Math.PI/2);add(parts,g,cream,[-.85,floor+.1+k*.065,2.45]);}
   }else if(i===1){
    box(parts,-1.15,roof,3,1.0,.15,2.15,dock.color);
    for(const z of [2.3,3.1,3.8]){cyl(parts,-1.15,roof-.28,z,.035,.4,dark);ball(parts,-1.15,roof-.5,z,.16,'#e5b36e',[.85,1.2,.85]);}
    box(parts,.95,floor+.45,3.4,.65,.12,1.1,cream);cyl(parts,.95,floor+.2,3.4,.08,.4,dark);for(const z of [3.15,3.65])cyl(parts,.95,floor+.58,z,.09,.16,dock.color);
   }else{
    for(const z of [2.15,2.6,3.05,3.5,3.9])box(parts,-1.15,roof,z,1.0,.12,.12,dock.color);
    box(parts,-1.3,roof-.08,3,.12,.14,2.1,dark);
    for(const z of [2.3,3,3.7]){cyl(parts,1.15,floor+.18,z,.19,.3,'#bd8871');for(const x of [-.1,.1])ball(parts,1.15+x,floor+.5,z,.17,dock.color,[.75,1.5,.7]);ball(parts,1.15,floor+.7,z,.1,'#f2c485');}
   }
   // Each neighbor has an original silhouette and a single pivoting wave arm.
   const resident=new THREE.Group();resident.position.set(-.95,y(1.65)+.02,1.65);resident.rotation.y=Math.PI;root.add(resident);
   for(const x of [-.13,.13]){box(body,x,.2,0,.18,.35,.2,dark);box(body,x,.06,.07,.23,.12,.32,dark);}
   ball(body,0,.62,0,.29,dock.color,[.9,1.25,.7]);ball(body,0,1.1,0,.28,skin);
   for(const x of [-.1,.1])ball(body,x,1.12,.254,.022,ink);box(body,0,.99,.275,.07,.015,.015,ink);
   if(i===0){cyl(body,0,1.34,0,.29,.10,dock.color);box(body,0,1.30,.22,.45,.04,.25,cream);box(body,0,.62,.2,.25,.12,.07,cream);}
   if(i===1){for(const x of [-.2,0,.2])ball(body,x,1.34,-.05,.14,'#72533f');box(body,0,.55,.19,.31,.38,.04,cream);box(body,.25,.52,.07,.18,.28,.12,dock.color);}
   if(i===2){cyl(body,0,1.32,0,.38,.06,cream);cyl(body,0,1.4,0,.23,.15,wood);box(body,0,.58,.2,.3,.3,.04,cream);ball(body,.23,.55,.12,.13,dock.color);}
   box(body,.28,.65,0,.13,.34,.17,dock.color);ball(body,.28,.45,0,.08,skin);
   const hand=new THREE.Group();hand.position.set(-.25,.83,0);resident.add(hand);box(arm,-.06,-.14,0,.14,.3,.16,dock.color);ball(arm,-.08,-.32,0,.085,skin);
   const mesh=(list,parent)=>{const g=mergeGeometries(list,false);list.forEach(g=>g.dispose());const m=new THREE.Mesh(g,this.material);m.userData.dockId=dock.id;parent.add(m);this.picks.push(m);return m;};
   mesh(parts,root);mesh(body,resident);mesh(arm,hand);this.residents.push({id:dock.id,root:resident,hand,phase:i*1.7,wave:0});
  }
 }
 greet(id){const r=this.residents.find(r=>r.id===id);if(r)r.wave=1.6;}
 update(dt,{visible=true,reduced=false}={}){
  if(reduced){for(const r of this.residents){r.hand.rotation.z=0;r.root.rotation.z=0;r.wave=0;}return;}
  if(!visible)return;const step=Math.min(Math.max(dt,0),.08);this.time+=step;
  for(const r of this.residents){r.wave=Math.max(0,r.wave-step);r.root.rotation.z=Math.sin(this.time*.8+r.phase)*.018;r.hand.rotation.z=r.wave>0?-.95+Math.sin(this.time*9)*.18:Math.sin(this.time+r.phase)*.04;}
 }
 dispose(){this.group.traverse(o=>{if(o.isMesh)o.geometry.dispose();});this.material.dispose();this.group.removeFromParent();}
}
