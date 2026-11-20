import { playEffect, quietMotion } from './EffectTimeline.js';
import * as THREE from 'three';

// Effects belong to the lot instance so replacing a building also removes its scaffolding.
export function animateBuildingChange(group, previousLevel, level, scene) {
  if (quietMotion()) return;
  const demolition = level < previousLevel;
  const effect = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({color: demolition ? '#b9744d' : '#edb251'});
  const geometry = new THREE.BoxGeometry(1,1,1);
  const add = (x,y,z,w,h,d) => {
    const part = new THREE.Mesh(geometry,material);
    part.position.set(x,y,z);
    part.scale.set(w,h,d);
    effect.add(part);
    return part;
  };
  if (demolition) {
    for (let i=0;i<10;i++) {
      const a=i*Math.PI/5;
      const part=add(Math.cos(a),1.5,Math.sin(a),.22,.27,.33);
      part.userData.direction = a;
    }
    scene.shakeCamera(.15,230);
  } else if (level>0) {
    for (const x of [-1.42,1.42]) for (const z of [-1.32,1.32]) add(x,1.05,z,.07,2.1,.07);
    for (const y of [.64,1.65]) for (const z of [-1.32,1.32]) add(0,y,z,2.9,.10,.12);
  }
  group.add(effect);
  scene.createSparkles(group.position,demolition ? 0xcd9b7c : 0xffc644,16);
  const base = group.scale.clone();
  playEffect(740,t => {
    group.scale.x = base.x * (1+.19*Math.sin(Math.PI*t*2)*(1-t));
    group.scale.z = base.z * (1+.19*Math.sin(Math.PI*t*2)*(1-t));
    group.scale.y=base.y +(demolition ? .22 : -.65)*Math.exp(-5*t)*Math.cos(t*9);
    if (demolition) for (const part of effect.children) {
      const a=part.userData.direction;
      part.position.set(Math.cos(a)*(1+1.8*t),.12+1.4*(1-t)+2*t*(1-t),Math.sin(a)*(1+1.8*t));
      part.rotation.set(t*4,a,t*2);
    }
  }, () => {
      group.scale.copy(base);
      group.remove(effect);
      geometry.dispose();
      material.dispose();
  }, () => quietMotion() || !group.parent);
}

// Carry the owner's colours from the occupied square to the purchased frontage.
export function markPurchase(scene, road, lot, ownerColor) {
  if (quietMotion()) return;
  const seal = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(.49,.49,.10,12),
    new THREE.MeshStandardMaterial({color:'#ffda80'}));
  const face = new THREE.Mesh(new THREE.CylinderGeometry(.39,.39,.13,12),
    new THREE.MeshStandardMaterial({color:ownerColor}));
  seal.add(rim,face);
  scene.add(seal);
  const origin = new THREE.Vector3(road.x,road.y+1.2,road.z);
  const end = lot.position.clone();
  end.y += .45;
  playEffect(730,t => {
    seal.position.lerpVectors(origin,end,t);
    seal.position.y += Math.sin(Math.PI*t)*1.4;
    seal.rotation.x = (1-t)*Math.PI*1.6;
  }, () => {
      scene.remove(seal);
      for (const mesh of seal.children) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
  }, () => quietMotion() || !lot.parent);
}
