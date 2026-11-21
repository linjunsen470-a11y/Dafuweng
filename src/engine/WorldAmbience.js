import * as THREE from 'three';
import { surfaceTime } from './BoardSurfaceArt.js';
import { COAST_WATER_Y } from './IslandCoast.js';
import { updateHarborGulls } from './HarborPromenade.js';
import { createFountainSpray, createHarborSea, createLighthouse, updateFountainSpray } from './WaterfrontScenery.js';
import { quietMotion } from './EffectTimeline.js';

// A single board update drives the scenery. All map-specific meshes belong to the
// environment group so replacing the map releases them through the normal board teardown.
export class WorldAmbience {
  constructor(board) {
    this.board = board;
    this.time = 0;
    this.last = performance.now();
    this.windows = new Map();
  }

  clearMap() {
    this.windows.clear();
    this.spray = this.lantern = this.islandWater = null;
    this.board.harborFerries = [];
    this.board.harborGulls = null;
  }

  addScenery(group, map) {
    if (map.theme === 'GRAND_BAY') {
      const tower = createLighthouse();
      this.lantern = tower.getObjectByName('lighthouse-lantern');
      group.add(tower, createHarborSea());
    }
    this.islandWater = group.getObjectByName('island-fork-sea')?.material.map;
    // Each spray starts at the nozzle and lands inside the existing basin.
    const basins = {
      'grand-bay': [-6, .61, 23.7, .81, .98],
      'taiwan-loop': [-1.93, .71, 10.6, 1.23, .76],
      'city-loop': [0, .82, 0, 3.42, 1.85]
    };
    const basin = basins[map.id];
    if (basin) {
      const [x, y, z, radius, height] = basin;
      this.spray = createFountainSpray();
      this.spray.name = map.theme === 'GRAND_BAY' ? 'quay-fountain-spray' : 'park-fountain-spray';
      this.spray.position.set(x, y, z);
      this.spray.scale.set(radius, height, radius);
      group.add(this.spray);
      this.lastSprayTime = this.time;
    }
  }

  update(now = performance.now()) {
    // Clamp long frames so restoring a background tab does not teleport the scenery.
    const dt = Math.min(.16, (now - this.last) / 1000);
    this.last = now;
    const board = this.board;
    if (quietMotion(board.motionPreference)) return false;
    this.time += dt;
    const t = this.time;
    surfaceTime.value = t;
    if (this.spray && t - this.lastSprayTime >= 1 / 30) {
      updateFountainSpray(this.spray, t);
      this.lastSprayTime = t;
    }
    if (this.lantern) this.lantern.rotation.y = t * .72;
    if (this.islandWater) this.islandWater.offset.set(t * .012, t * .006);
    board.harborFerries?.forEach((boat, i) => {
      const speed = boat.userData.speed;
      boat.position.x = ((boat.userData.originX + speed * t * 2.5 + 78) % 156 + 156) % 156 - 78;
      boat.position.y = COAST_WATER_Y - .22 + .08 * Math.sin(t * 1.8 + i);
      boat.rotation.set(.035 * Math.sin(t + i), speed < 0 ? Math.PI : 0, .035 * Math.sin(t * 1.4));
    });
    if (board.harborGulls) updateHarborGulls(board.harborGulls, t * 1.8);
    if (board.centralDecorationGroup?.visible) {
      board.windmillBlades.rotation.z = t * .8;
      board.centerCoinsGroup.rotation.y = t * .72;
    }
    for (const car of board.cars || []) {
      if (!car.mesh.visible) continue;
      car.angle += dt * .48;
      car.mesh.position.set(Math.cos(car.angle) * car.radius, -.4, Math.sin(car.angle) * car.radius);
      car.mesh.rotation.y = -car.angle + Math.PI / 2;
    }
    for (const group of board.buildingMeshes.values()) {
      if (group.userData.rotor) group.userData.rotor.rotation.y = t * .9;
    }
    for (const group of board.specialTileMeshes.values()) {
      if (group.userData.arcadeRotor) group.userData.arcadeRotor.rotation.z = t * .8;
    }
    if (board.scene3D.timeOfDay !== 'DAY') {
      const glow = .94 + .06 * Math.sin(t * 1.15);
      for (const [material, brightness] of this.windows) material.emissiveIntensity = brightness * glow;
      board.streetLights?.forEach(({ light, bulb }, i) => {
        if (!bulb.visible) return;
        const warmth = .94 + .06 * Math.sin(t * 1.3 + i * 1.6);
        bulb.material.opacity = warmth;
        light.intensity = 2.4 * warmth;
      });
    }
    return true;
  }
}

// The arcade's rooftop pinwheel uses one mesh and its existing lot's disposal path.
export function arcadePinwheel(group, height) {
  const shape=new THREE.Shape();
  shape.moveTo(0,0);
  for (let i=0;i<5;i++) {
    const a=i*2*Math.PI/5;
    shape.lineTo(.49*Math.cos(a),.49*Math.sin(a));
    shape.lineTo(.33*Math.cos(a+.7),.33*Math.sin(a+.7));
    shape.lineTo(0,0);
  }
  const rotor=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:'#f28a51',side:THREE.DoubleSide}));
  rotor.position.set(0,height+.32,0);
  group.add(rotor);group.userData.arcadeRotor=rotor;
}
