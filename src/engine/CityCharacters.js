import { CITY_CHARACTER_PROFILE_IDS } from './CityCharacterProfiles.js';
import * as THREE from 'three';

// Original unified chibi figures for the supported main-game profiles.
// No profile/rule/save changes. Joint groups are local presentation state only.
export function createCityCharacter(profile){
 if(!CITY_CHARACTER_PROFILE_IDS.includes(profile.id))return null;
 const root=new THREE.Group();root.name=`city-original-${profile.id}`;
 const mat=color=>new THREE.MeshStandardMaterial({color,roughness:.8});
 const coat=mat(profile.color),skin=mat(({0:'#f1c7a7',1:'#dcb18b',2:'#f0c9b2',3:'#b7805d',4:'#e8c3a2',5:'#d69c7f',6:'#d8ae8a',7:'#ecc6a6',8:'#efc8b0',9:'#f1c9b2',10:'#dfb997',11:'#edc7a5',12:'#c69172',13:'#f2cbb4',14:'#e3b793',15:'#edc39b'})[profile.id]),hair=mat(profile.id===2?'#5a3c43':'#343533'),cream=mat('#f4e9d3'),dark=mat('#34464b'),gold=mat('#cfaa62');
 const ink=new THREE.MeshBasicMaterial({color:'#243136'}),white=new THREE.MeshBasicMaterial({color:'#fff7e7'});
 const mesh=(parent,g,m,x,y,z)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;};
 const ball=(p,m,x,y,z,r,sx=1,sy=1,sz=1)=>{const o=mesh(p,new THREE.SphereGeometry(r,12,8),m,x,y,z);o.scale.set(sx,sy,sz);return o;};
 const box=(p,m,x,y,z,w,h,d)=>mesh(p,new THREE.BoxGeometry(w,h,d),m,x,y,z);
 const torso=new THREE.Group();root.add(torso);
 mesh(torso,new THREE.CapsuleGeometry(.28,.29,4,12),coat,0,.98,0);
 box(torso,cream,0,1.26,.24,.39,.13,.09);
 box(torso,dark,0,.7,.025,.52,.12,.43);
 for(const y of [.92,1.08])ball(torso,gold,0,y,.285,.035);
 const legs=[],arms=[];
 for(const side of [-1,1]){
  const leg=new THREE.Group();leg.position.set(side*.16,.62,0);root.add(leg);legs.push(leg);
  mesh(leg,new THREE.CapsuleGeometry(.105,.28,3,8),dark,0,-.20,0);box(leg,dark,0,-.49,.07,.24,.16,.34);
  const arm=new THREE.Group();arm.position.set(side*.36,1.17,0);arm.rotation.z=side*-.12;torso.add(arm);arms.push(arm);
  mesh(arm,new THREE.CapsuleGeometry(.095,.25,3,8),coat,0,-.17,0);ball(arm,skin,0,-.38,.015,.105);
 }
 const head=new THREE.Group();head.position.y=1.55;head.rotation.x=-.10;root.add(head);
 ball(head,skin,0,0,0,.405,1,1.03,.95);
 mesh(head,new THREE.SphereGeometry(.417,16,8,0,Math.PI*2,0,Math.PI*.48),hair,0,.02,0);
 for(const side of [-1,1]){
  ball(head,skin,side*.39,-.01,0,.085);
  ball(head,white,side*.145,.015,.365,.09,1,1.1,.4);
  ball(head,ink,side*.145,.008,.4,.048,.8,1.1,.45);
  box(head,hair,side*.145,.135,.36,.14,.035,.035);
 }
 ball(head,skin,0,-.065,.405,.055,.8,.8,1.15);
 const smile=mesh(head,new THREE.TorusGeometry(.105,.016,4,12,Math.PI),ink,0,-.12,.38);smile.rotation.z=Math.PI;
 if(profile.id===0){
  for(const side of [-1,1]){ball(head,hair,side*.36,.20,-.08,.17);box(head,cream,side*.36,.23,.08,.21,.065,.07);}
  // Short split coat leaves the legs readable, unlike the old solid cone dress.
  box(torso,cream,0,.81,.28,.12,.26,.055);
 }else if(profile.id===1){
  mesh(head,new THREE.CylinderGeometry(.60,.60,.055,20),gold,0,.27,0);
  mesh(head,new THREE.CylinderGeometry(.31,.38,.23,16),gold,0,.40,0);
  mesh(head,new THREE.CylinderGeometry(.385,.385,.055,16),dark,0,.30,0);
  for(const x of [-.16,.16])box(torso,dark,x,1.06,.275,.075,.30,.05);
 }else if(profile.id===2){
  ball(head,hair,-.30,-.10,-.09,.22,.7,1.2,.85);ball(head,hair,.30,-.10,-.09,.22,.7,1.2,.85);
  for(const side of [-1,1]){const rim=mesh(head,new THREE.TorusGeometry(.105,.021,4,12),gold,side*.145,.015,.414);rim.scale.set(1.1,.88,1);}
  box(head,gold,0,.02,.414,.09,.025,.025);
  box(torso,cream,.15,1.15,.28,.12,.22,.06);
 }else if(profile.id===3){
  mesh(head,new THREE.SphereGeometry(.435,16,8,0,Math.PI*2,0,Math.PI*.48),cream,0,.10,0);
  const band=mesh(head,new THREE.TorusGeometry(.40,.035,6,16),gold,0,.22,0);band.rotation.x=Math.PI/2;
  box(head,cream,-.35,-.13,-.15,.13,.42,.14);
  box(torso,gold,0,.73,.25,.13,.11,.06);
 }
 // Preserve the remaining profiles' recognizable accessories on the shared walking rig.
 if(profile.id===4){
  box(head,coat,0,.20,.34,.58,.09,.07);
  box(head,dark,0,-.13,.37,.57,.20,.12);
  box(head,coat,.32,-.16,-.22,.09,.40,.10);
  box(torso,cream,0,.78,.27,.53,.08,.05);
 }else if(profile.id===5){
  const teal=mat('#60b6a1');
  for(const x of [-.16,0,.16]){const feather=mesh(head,new THREE.ConeGeometry(.065,.29,6),teal,x,.37,0);feather.rotation.z=-x;}
  for(const side of [-1,1])ball(head,hair,side*.30,-.17,-.11,.18,.65,1.6,.8);
  box(head,cream,0,.20,.34,.52,.055,.06);
  for(const x of [-.13,0,.13])ball(torso,teal,x,1.19,.29,.045);
 }else if(profile.id===6){
  const leather=mat('#8c593d');
  mesh(head,new THREE.CylinderGeometry(.59,.59,.06,16),leather,0,.27,0);
  mesh(head,new THREE.CylinderGeometry(.28,.37,.23,12),leather,0,.40,0);
  mesh(head,new THREE.CylinderGeometry(.37,.37,.045,12),cream,0,.31,0);
  const scarf=box(torso,cream,0,1.16,.30,.16,.20,.05);scarf.rotation.z=Math.PI/4;
 }else if(profile.id===7){
  mesh(head,new THREE.SphereGeometry(.435,16,8,0,Math.PI*2,0,Math.PI*.48),coat,0,.08,0);
  box(head,cream,0,.18,.40,.45,.055,.32);box(head,cream,0,.29,.31,.10,.12,.04);
  for(const x of [-.16,.16])box(torso,cream,x,1.01,.28,.045,.36,.04);
 }else if(profile.id===8){
  mesh(head,new THREE.CylinderGeometry(.33,.36,.10,8),gold,0,.28,0);
  for(const x of [-.25,0,.25])mesh(head,new THREE.ConeGeometry(.07,.18,4),gold,x,.41,.12);
  for(const side of [-1,1])ball(head,hair,side*.30,-.14,-.13,.20,.7,1.4,.85);
  box(torso,gold,0,.97,.29,.065,.36,.045);
 }else if(profile.id===9){
  const mint=mat('#7ebfac');
  for(const side of [-1,1]){ball(head,hair,side*.37,.14,-.08,.14);const candy=mesh(head,new THREE.TorusGeometry(.10,.04,6,12),mint,side*.37,.14,.09);box(head,cream,side*.37,.14,.13,.16,.035,.03);}
  box(torso,cream,0,1.10,.29,.17,.15,.04);
 }else if(profile.id===10){
  mesh(head,new THREE.CylinderGeometry(.29,.44,.18,6),dark,0,.31,0);
  box(head,cream,0,.22,.37,.25,.05,.04);
  const sheath=box(torso,dark,.35,.97,-.18,.08,.85,.09);sheath.rotation.z=-.20;
  box(torso,cream,.35,1.24,-.17,.20,.05,.12);
  for(const x of [-.17,.17])box(torso,cream,x,1.04,.27,.045,.27,.04);
 }else if(profile.id===11){
  mesh(head,new THREE.TorusGeometry(.12,.035,6,14,Math.PI*1.6),hair,0,.34,.05);
  mesh(torso,new THREE.CircleGeometry(.20,16),cream,0,1.02,.30);
  ball(torso,coat,0,1.02,.33,.075,1,1,.3);
 }
 // Distinct silhouettes for the formerly identical fallback profiles.
 if(profile.id===12){
  const band=mesh(head,new THREE.TorusGeometry(.445,.045,6,16,Math.PI),dark,0,.045,0);
  for(const side of [-1,1]){ball(head,dark,side*.425,.015,0,.14,.65,1.25,1);box(head,coat,side*.49,.015,.015,.055,.19,.17);}
  box(torso,cream,0,1.02,.285,.055,.34,.045);
 }else if(profile.id===13){
  ball(head,hair,0,-.06,-.36,.23,.8,1.3,1);
  for(const side of [-1,1]){mesh(head,new THREE.TorusGeometry(.105,.018,4,12),dark,side*.145,.015,.414);box(torso,cream,side*.17,.99,.28,.19,.49,.065);}
  box(head,dark,0,.02,.414,.09,.025,.025);box(torso,gold,.17,1.09,.32,.08,.10,.02);
 }else if(profile.id===14){
  ball(head,hair,0,.36,-.12,.14);box(head,coat,0,.31,.015,.30,.055,.08);
  box(torso,cream,0,.76,.27,.52,.11,.06);
  const sheath=box(torso,dark,.28,1,-.23,.085,.70,.09);sheath.rotation.z=-.22;
  box(head,coat,-.34,-.10,-.12,.06,.34,.07);
 }else if(profile.id===15){
  mesh(head,new THREE.SphereGeometry(.435,16,8,0,Math.PI*2,0,Math.PI*.48),coat,0,.08,0);
  ball(head,gold,0,.23,.37,.09,1,1,.3);
  const bib=mesh(torso,new THREE.CircleGeometry(.18,16),cream,0,1.03,.30);
  ball(torso,gold,0,1.02,.32,.07,1,1,.3);
 }
 root.cityRig={legs,arms,torso,head};root.userData.originalCityCharacter=true;
 return root;
}
export function poseCityCharacter(model,progress=0,reduced=false){
 const rig=model.cityRig;if(!rig)return;
 const stride=reduced?0:Math.sin(progress*Math.PI*2)*.55;
 rig.legs.forEach((leg,i)=>{leg.rotation.x=(i?-1:1)*stride;});
 rig.arms.forEach((arm,i)=>{arm.rotation.x=(i?1:-1)*stride*.8;});
 rig.torso.rotation.z=stride*.035;
 model.position.y=reduced?0:Math.sin(progress*Math.PI)*.035;
}
export function disposeCityCharacter(model){
 const geometries=new Set(),materials=new Set();model.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
