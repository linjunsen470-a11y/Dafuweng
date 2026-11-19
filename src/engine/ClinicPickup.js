import * as THREE from 'three';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';

// A short board vignette. The rule engine keeps the player's recovery tile and duration.
export function showClinicPickup(scene, pawn, tile) {
  if(!pawn || !tile)return;
  const van=new THREE.Group(), cube=new THREE.BoxGeometry(), wheel=new THREE.CylinderGeometry(.20,.20,.13,12);
  const paints=['#fff2cf','#d05d4d','#365866','#88bec8','#ffbe45'].map(color=>new THREE.MeshStandardMaterial({color}));
  const box=(x,y,z,w,h,d,paint)=>{
    const part=new THREE.Mesh(cube,paints[paint]);part.position.set(x,y,z);part.scale.set(w,h,d);van.add(part);return part;
  };
  box(0,.55,0,2.15,.61,1.01,0);box(.69,.96,0,.66,.44,.93,3);
  box(-.45,.78,0,.97,.14,1,1);
  for(const z of [-.52,.52]){
    box(-.13,.57,z,.37,.09,.025,1);box(-.13,.57,z,.10,.34,.025,1);
    for(const x of [-.68,.68]){
      const tyre=new THREE.Mesh(wheel,paints[2]);tyre.rotation.x=Math.PI/2;tyre.position.set(x,.29,z);van.add(tyre);
    }
  }
  const lamp=box(.66,1.25,0,.22,.14,.27,4);
  const rider=clone(pawn.skin?.figure || pawn.characterMesh);
  rider.scale.setScalar(.45);rider.position.set(-.49,.82,0);rider.visible=false;van.add(rider);
  const start=performance.now();
  van.name = 'clinic-pickup';
  scene.add(van);
  function frame(now) {
    const t=Math.min(1,(now-start)/1550);
    const x=t<.4?-3*(1-t/.4)**2:t>.64?3*((t-.64)/.36)**2:0;
    van.position.copy(tile);van.position.x+=x;van.position.z+=.6;
    van.position.y+=.17+.03*Math.abs(Math.sin(t*24));
    rider.visible=t>=.45;lamp.material.emissive.setHex(Math.sin(t*30)>0?0xff9632:0x431e16);
    if(t<1 && pawn.mesh.parent)requestAnimationFrame(frame);
    else {
      van.removeFromParent();cube.dispose();wheel.dispose();paints.forEach(m=>m.dispose());
      rider.traverse(node=>{if(node.isSkinnedMesh)node.skeleton.dispose();});
    }
  }
  frame(start);
}
