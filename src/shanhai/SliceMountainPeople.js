import * as THREE from 'three-modern';
import {mergeGeometries} from 'three-modern/addons/utils/BufferGeometryUtils.js';
import {MOUNTAIN_PEOPLE} from './SliceStory.js';
/** Two original miniature residents, one vertex-colored mesh each, no textures. */
export function makeMountainPeople(scene){
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9}),meshes=[];
 for(const [index,person] of MOUNTAIN_PEOPLE.entries()){
  const parts=[];
  const add=(g,c,x,y,z)=>{g.translate(x,y,z);const color=new THREE.Color(c),colors=[];for(let i=0;i<g.attributes.position.count;i++)colors.push(color.r,color.g,color.b);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));parts.push(g);};
  const box=(w,h,d,c,x,y,z)=>add(new THREE.BoxGeometry(w,h,d),c,x,y,z);
  const ball=(r,c,x,y,z)=>add(new THREE.SphereGeometry(r,10,7),c,x,y,z);
  const cyl=(r,h,c,x,y,z)=>add(new THREE.CylinderGeometry(r,r,h,10),c,x,y,z);
  for(const x of [-.16,.16]){box(.2,.55,.23,'#665443',x,.3,0);box(.24,.13,.35,'#554b3d',x,.07,.06);}
  box(.62,.65,.4,person.color,0,.8,0);ball(.31,'#e2b58d',0,1.35,0);
  for(const x of [-.1,.1])ball(.025,'#3b4337',x,1.38,.29);
  box(.09,.02,.02,'#85624b',0,1.22,.3);
  for(const x of [-.38,.38]){box(.15,.5,.2,person.color,x,.8,0);ball(.09,'#e2b58d',x,.53,0);}
  if(index===0){cyl(.44,.06,'#d0af6b',0,1.6,0);cyl(.27,.16,'#b88f53',0,1.7,0);box(.46,.35,.14,'#d6bd8c',0,.7,.26);cyl(.18,.3,'#b78a58',.42,.5,.2);ball(.14,'#7d914b',.42,.7,.2);}
  else{ball(.26,'#715340',0,1.51,-.04);box(.44,.57,.06,'#e2c59a',0,.73,.23);cyl(.2,.28,'#bc7250',-.42,.57,.24);cyl(.15,.05,'#795039',-.42,.73,.24);}
  const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geometry,material);mesh.position.set(person.x,.22,person.z);mesh.rotation.y=.45;mesh.scale.setScalar(1.25);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.residentId=person.id;scene.add(mesh);meshes.push(mesh);
 }
 return {meshes,dispose(){for(const mesh of meshes){mesh.geometry.dispose();mesh.removeFromParent();}material.dispose();}};
}
