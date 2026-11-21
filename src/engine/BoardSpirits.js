import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createVFXSprite } from './CartoonVFX.js';

const colors = { FORTUNE: 0xf5bc43, GREAT_FORTUNE: 0xff8144, LUCK: 0xff8cab, EARTH: 0x82bb62, MISFORTUNE: 0x8babc4, BAD: 0x925cc5, ANGEL: 0xffe7ae, DEMON: 0xe55e82 };
const aliases = { SMALL_FORTUNE: 'FORTUNE', GREAT_POOR: 'MISFORTUNE', SMALL_POOR: 'MISFORTUNE' };
let silhouettes;
export function spiritColor(type) { return colors[aliases[type] || type] ?? 0xffc660; }

export function createSpirit(type, phase = 0, attached = false) {
  const kind = aliases[type] || type;
  const group = new THREE.Group();
  Object.assign(group.userData, { type, phase });
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshStandardMaterial({ color: spiritColor(type) }));
  marker.position.y = 0.45;
  group.add(marker);

  if (attached) {
    const dark = ['MISFORTUNE', 'BAD', 'DEMON'].includes(kind);
    const ornament = new THREE.Group();
    if (dark) {
      // Adorable grumpy purple storm-cloud with yellow lightning bolts
      const cloud = createVFXSprite('storm_cloud', { scale: 1.55, opacity: 0.96 });
      cloud.position.set(0, 1.35, 0);
      const glow = createVFXSprite('aura', { scale: 1.4, additive: true, opacity: 0.42, color: 0xa46ef5 });
      glow.position.set(0, 0.75, 0);
      ornament.add(cloud, glow);
    } else {
      // Radiant golden wings + twinkling fortune halo
      const wings = createVFXSprite('angel_wings', { scale: 1.45, opacity: 0.95 });
      wings.position.set(0, 1.25, 0);
      const stars = createVFXSprite('star', { scale: 1.35, additive: true, opacity: 0.85, color: 0xffe578 });
      stars.position.set(0, 0.78, 0);
      ornament.add(wings, stars);
    }
    group.add(ornament);
    group.userData.ornament = ornament;
  }

  silhouettes ??= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/models/board-spirits.glb`).catch(() => { silhouettes = null; return null; });
  silhouettes.then(pack => {
    if (!group.parent) return;
    const template = pack?.scene.getObjectByName(kind);
    if (!template) return;
    const figure = template.clone(true);
    group.remove(marker); marker.geometry.dispose(); marker.material.dispose();
    group.add(figure); group.userData.ready = true;
  });
  return group;
}

export function releaseSpirit(group) {
  if (!group.userData.ready) {
    const marker = group.children[0];
    marker?.geometry?.dispose(); marker?.material?.dispose();
  }
  const ornaments = group.userData.ornament?.children || [];
  new Set(ornaments.flatMap(part => [part.geometry, part.material].filter(Boolean))).forEach(resource => resource.dispose());
  group.removeFromParent();
}

export function animateSpirits(manager, time, reduced) {
  for (const group of manager.boardGodMeshes.values()) {
    const t = reduced ? 0 : time * 0.55 + group.userData.phase;
    const goal = group.userData.tilePosition;
    if (goal) { group.position.lerp(goal, reduced ? 1 : 0.18); group.position.y = goal.y + 0.50 + (reduced ? 0 : 0.15 * Math.sin(t)); }
    group.rotation.y = (manager.harborFacing || 0) + 0.18 * Math.sin(t);
  }
  for (const group of manager.godAuraMeshes.values()) {
    const t = reduced ? 0 : time * 0.45 + group.userData.phase;
    const ornament = group.userData.ornament;
    if (ornament) {
      ornament.position.y = reduced ? 0 : 0.14 * Math.sin(t * 2.2);
      const pulse = reduced ? 1 : 0.94 + 0.1 * Math.sin(t * 3.1);
      ornament.scale.setScalar(pulse);
    }
    const a = (manager.harborFacing || 0) + 0.45 * Math.sin(t);
    group.position.set(0.86 * Math.cos(a) - 0.26 * Math.sin(a), 1.75 + 0.14 * Math.sin(t), -0.86 * Math.sin(a) - 0.26 * Math.cos(a));
    group.rotation.y = (manager.harborFacing || 0) - 0.12;
  }
}
