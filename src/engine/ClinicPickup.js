import { quietMotion } from './EffectTimeline.js';
import * as THREE from 'three';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';

// Service vehicles may use both directions of the existing road graph.
export function clinicRoute(state, start) {
  const queue = [start];
  const previous = new Map([[start, null]]);
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    if (state.getTile(id)?.type === 'HOSPITAL') {
      const path = [];
      for (let at = id; at !== null; at = previous.get(at)) path.push(at);
      return path.reverse();
    }
    for (const direction of [1, -1]) {
      for (const next of state.mapRuntime.getNextOptions(id, direction)) {
        if (previous.has(next)) continue;
        previous.set(next, id);
        queue.push(next);
      }
    }
  }
  return [];
}

export function showClinicPickup(view, pawn, points, handBack) {
  if (!pawn?.mesh.parent || !points.length) return;
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
  rider.name = 'clinic-passenger';
  rider.scale.setScalar(.62);
  rider.visible = false;
  van.add(rider);
  const ride = pawn.skin?.actions.get('Ride')?.getClip();
  const mixer = ride ? new THREE.AnimationMixer(rider) : null;
  if (mixer) mixer.clipAction(ride).play();
  const seat = new THREE.Vector3(-.49,.81,0);
  const route = new THREE.CurvePath();
  for (let i=1;i<points.length;i++) {
    if (points[i-1].distanceToSquared(points[i])>.001)
      route.add(new THREE.LineCurve3(points[i-1],points[i]));
  }
  const duration = THREE.MathUtils.clamp(route.getLength()*65,1200,4800);
  const tile = points[0];
  const boarding = new THREE.Vector3();
  const start = performance.now();
  const wasVisible = pawn.mesh.visible;
  van.name = 'clinic-pickup';
  van.position.copy(tile);
  view.scene.add(van);
  const cameraStart = view.camera.position.clone();
  const targetStart = view.controls.target.clone();
  const cameraOffset = new THREE.Vector3(4,11,13);
  view.followObject(van,cameraOffset);
  return new Promise(resolve => {
    let raf;
    const timeout = setTimeout(finish,duration+1750);
    function finish() {
        clearTimeout(timeout);
        cancelAnimationFrame(raf);
        const ownsCamera = view.followedObject === van;
        if (ownsCamera) view.stopFollowing({settle:false});
        pawn.mesh.visible=wasVisible;
        van.removeFromParent();
        mixer?.stopAllAction();mixer?.uncacheRoot(rider);
        cube.dispose();wheel.dispose();paints.forEach(material=>material.dispose());
        rider.traverse(node=>{if(node.isSkinnedMesh)node.skeleton.dispose();});
        if (ownsCamera && pawn.mesh.parent) handBack();
        resolve();
    }
    function frame(now) {
      const elapsed=now-start;
      if (!pawn.mesh.parent || quietMotion() || elapsed>=duration+1650) return finish();
      const drive = THREE.MathUtils.clamp((elapsed-920)/duration,0,1);
      van.userData.phase=elapsed<450?'approach':elapsed<920?'board':drive<1?'drive':'arrive';
      if (elapsed<450) {
        van.position.copy(tile);van.position.x-=2.8*(1-elapsed/450);
      } else if (drive>0 && route.curves.length) {
        const tangent=route.getTangent(drive);
        van.position.copy(route.getPoint(drive));
        van.rotation.y=Math.atan2(-tangent.z,tangent.x);
      } else van.position.copy(tile);
      van.position.y+=.08;
      if (view.followedObject === van) {
        // Keep the vehicle in frame even when WebGL delivers only a few frames per second.
        const blend=THREE.MathUtils.smoothstep(elapsed,0,450);
        view.controls.target.copy(targetStart).lerp(van.position,blend);
        view.camera.position.copy(cameraStart).lerp(van.position.clone().add(cameraOffset),blend);
      }
      if (elapsed>=450) {
        if (!rider.visible) {
          pawn.mesh.getWorldPosition(boarding);
          van.worldToLocal(boarding);
          pawn.mesh.visible=false;rider.visible=true;
        }
        const lift=Math.min(1,(elapsed-450)/470);
        rider.position.copy(boarding).lerp(seat,lift);
        rider.position.y+=.36*Math.sin(Math.PI*lift);
        if (drive===1) {
          const leave=Math.min(1,(elapsed-920-duration)/520);
          rider.position.x-=leave;
          rider.position.y-=.65*leave;
        }
        mixer?.setTime(elapsed/1000);
      }
      lamp.material.emissive.setHex(Math.sin(elapsed*.018)>0?0xff9632:0x431e16);
      raf=requestAnimationFrame(frame);
    }
    frame(start);
  });
}
