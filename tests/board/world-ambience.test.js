// @vitest-environment happy-dom
import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { BoardBuilder } from '../../src/engine/BoardBuilder.js';
import { Scene3D } from '../../src/engine/Scene3D.js';
import { WorldAmbience } from '../../src/engine/WorldAmbience.js';
import { surfaceTime } from '../../src/engine/BoardSurfaceArt.js';

function createBoard() {
  const board = Object.assign(Object.create(BoardBuilder.prototype), {
    tileMeshes: [], buildingMeshes: new Map(), specialTileMeshes: new Map(), vacantLotMeshes: new Map(),
    scene3D: { scene: new THREE.Scene(), timeOfDay: 'NIGHT' }, motionPreference: { matches: false },
    mapEnvironmentGroup: new THREE.Group()
  });
  board.scene3D.scene.add(board.mapEnvironmentGroup);
  board.ambience = new WorldAmbience(board);
  board.ambience.clearMap();
  board.ambience.addScenery(board.mapEnvironmentGroup, { id: 'grand-bay', theme: 'GRAND_BAY' });
  return board;
}

afterEach(() => { document.documentElement.className = ''; });

it('clears an active storm flash and holds the rain still when motion is reduced', () => {
  const view = Object.create(Scene3D.prototype);
  view.scene = new THREE.Scene();
  view.setupLighting();
  view.setupWeather();
  view.createPrecipitation('RAIN');
  view.lightningFlash = 1;
  const positions = view.precipitation.geometry.attributes.position;
  const before = positions.array.slice();
  view.updateWeather(true);
  expect(view.lightningFlash).toBe(0);
  expect(view.ambientLight.intensity).toBe(view.baseAmbientIntensity);
  expect(positions.array).toEqual(before);
  view.createPrecipitation('CLEAR');
});

it.each(['media', 'reduce-motion', 'skip-ai-motion'])('freezes and resumes water, spray and lights on a live %s toggle', mode => {
  const board = createBoard(), ambience = board.ambience;
  const lamp = new THREE.MeshStandardMaterial();
  ambience.windows.set(lamp, 1.4);
  const sample = () => [surfaceTime.value, ambience.spray.instanceMatrix.version, ambience.lantern.rotation.y, lamp.emissiveIntensity];
  const start = ambience.last;
  ambience.update(start + 100);
  const playing = sample();
  if (mode === 'media') board.motionPreference.matches = true;
  else document.documentElement.classList.add(mode);
  ambience.update(start + 10000);
  expect(sample()).toEqual(playing);
  board.motionPreference.matches = false;
  document.documentElement.className = '';
  ambience.update(start + 10060);
  expect(sample().every((value, i) => value !== playing[i])).toBe(true);
  expect(ambience.time).toBeCloseTo(.16);
  board.clearDynamicMap();
  lamp.dispose();
});

it('batches the entire fountain and releases scenery buffers and references on a map change', () => {
  const board = createBoard(), ambience = board.ambience;
  const spray = ambience.spray, resources = [];
  let draws = 0;
  board.mapEnvironmentGroup.traverse(object => {
    if (object.isMesh) {
      draws++;
      resources.push(object.geometry, object.material);
    }
    if (object.isInstancedMesh) resources.push(object);
  });
  const dispose = resources.map(resource => vi.spyOn(resource, 'dispose'));
  expect(draws).toBe(5); // Sea, tower, lantern, roof and the entire spray.
  expect(spray.isInstancedMesh).toBe(true);
  expect(spray.count).toBe(24);
  const oldMatrices = spray.instanceMatrix.array.slice();
  ambience.update(ambience.last + 16);
  expect(spray.instanceMatrix.array).toEqual(oldMatrices);
  ambience.update(ambience.last + 24);
  expect(spray.instanceMatrix.array).not.toEqual(oldMatrices);
  board.clearDynamicMap();
  ambience.update(ambience.last + 80);
  expect(board.scene3D.scene.children).toHaveLength(0);
  expect(ambience.spray).toBeNull();
  expect(ambience.lantern).toBeNull();
  expect(ambience.windows.size).toBe(0);
  for (const release of dispose) expect(release).toHaveBeenCalledTimes(1);
});
