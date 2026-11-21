import { quietMotion } from './EffectTimeline.js';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createVFXSprite } from './CartoonVFX.js';

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
  const van = new THREE.Group(), cube = new THREE.BoxGeometry(), wheel = new THREE.CylinderGeometry(0.22, 0.22, 0.14, 14);
  const paints = ['#fff6dc', '#e14b3c', '#2c3e50', '#8cd4e8', '#ff5252'].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.35 }));
  const box = (x, y, z, w, h, d, paint) => {
    const part = new THREE.Mesh(cube, paints[paint]); part.position.set(x, y, z); part.scale.set(w, h, d); van.add(part); return part;
  };
  box(0, 0.56, 0, 2.2, 0.64, 1.06, 0); box(0.7, 0.98, 0, 0.68, 0.46, 0.96, 3);
  box(-0.44, 0.82, 0, 1.04, 0.18, 1.04, 1);
  for (const z of [-0.54, 0.54]) {
    box(-0.14, 0.58, z, 0.38, 0.10, 0.03, 1); box(-0.14, 0.58, z, 0.11, 0.36, 0.03, 1);
    for (const x of [-0.68, 0.68]) {
      const tyre = new THREE.Mesh(wheel, paints[2]); tyre.rotation.x = Math.PI / 2; tyre.position.set(x, 0.29, z); van.add(tyre);
    }
  }
  const lamp = box(0.66, 1.28, 0, 0.24, 0.16, 0.30, 4);
  const sirenGlow = createVFXSprite('siren', { scale: 1.05, additive: true, opacity: 0.9 });
  sirenGlow.position.set(0.66, 1.48, 0);
  van.add(sirenGlow);
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
        pawn.mesh.visible = pawn.mesh.userData.isConfined ? false : wasVisible;
        van.removeFromParent();
        mixer?.stopAllAction();mixer?.uncacheRoot(rider);
        cube.dispose(); wheel.dispose(); paints.forEach(material => material.dispose());
        sirenGlow.geometry.dispose();
        sirenGlow.material.dispose();
        rider.traverse(node => { if (node.isSkinnedMesh) node.skeleton.dispose(); });
        if (ownsCamera && pawn.mesh.parent) handBack();
        resolve();
    }
    function frame(now) {
      const elapsed = now - start;
      if (!pawn.mesh.parent || quietMotion() || elapsed >= duration + 1650) return finish();
      const drive = THREE.MathUtils.clamp((elapsed - 920) / duration, 0, 1);
      van.userData.phase = elapsed < 450 ? 'approach' : elapsed < 920 ? 'board' : drive < 1 ? 'drive' : 'arrive';
      if (elapsed < 450) {
        van.position.copy(tile); van.position.x -= 2.8 * (1 - elapsed / 450);
      } else if (drive > 0 && route.curves.length) {
        const tangent = route.getTangent(drive);
        van.position.copy(route.getPoint(drive));
        van.rotation.y = Math.atan2(-tangent.z, tangent.x);
      } else van.position.copy(tile);
      van.position.y += 0.08;
      if (view.followedObject === van) {
        // Keep the vehicle in frame even when WebGL delivers only a few frames per second.
        const blend = THREE.MathUtils.smoothstep(elapsed, 0, 450);
        view.controls.target.copy(targetStart).lerp(van.position, blend);
        view.camera.position.copy(cameraStart).lerp(van.position.clone().add(cameraOffset), blend);
      }
      if (elapsed >= 450) {
        if (!rider.visible) {
          pawn.mesh.getWorldPosition(boarding);
          van.worldToLocal(boarding);
          pawn.mesh.visible = false; rider.visible = true;
        }
        const lift = Math.min(1, (elapsed - 450) / 470);
        rider.position.copy(boarding).lerp(seat, lift);
        rider.position.y += 0.36 * Math.sin(Math.PI * lift);
        if (drive === 1) {
          const leave = Math.min(1, (elapsed - 920 - duration) / 520);
          rider.position.x -= leave;
          rider.position.y -= 0.65 * leave;
        }
        mixer?.setTime(elapsed / 1000);
      }
      const flash = Math.sin(elapsed * 0.022) > 0;
      lamp.material.emissive.setHex(flash ? 0xff4433 : 0x3399ff);
      sirenGlow.scale.setScalar(flash ? 1.25 : 0.82);
      sirenGlow.material.opacity = flash ? 0.96 : 0.55;
      raf = requestAnimationFrame(frame);
    }
    frame(start);
  });
}
