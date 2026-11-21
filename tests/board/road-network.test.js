import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { BoardBuilder } from '../../src/engine/BoardBuilder.js';
import { createRoadNetwork } from '../../src/engine/RoadNetwork.js';
import { harborForkDirections } from '../../src/engine/HarborBoardStyle.js';
import { CITY_LOOP_MAP } from '../../src/game/MapData.js';
import { GRAND_BAY_MAP } from '../../src/game/GrandMapData.js';
import { getTileVisualSpec } from '../../src/game/BoardVisualRules.js';
import { pickBoardTarget } from '../../src/ui/BoardTarget.js';

vi.mock('../../src/engine/BoardSurfaceArt.js', async original => ({
  ...await original(),
  surfaceTexture() {
    const texture = new THREE.CanvasTexture({});
    texture.userData.sharedBoardTexture = true;
    return texture;
  }
}));

function roadEdges(map) {
  const seen = new Set();
  const edges = [];
  for (const from of map.tiles) {
    for (const id of from.next) {
      const key = [from.id, id].sort((a, b) => a - b).join(':');
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([from, map.tiles.find(tile => tile.id === id)]);
    }
  }
  return edges;
}

it.each([CITY_LOOP_MAP, GRAND_BAY_MAP])('batches the opaque road layers of $id and preserves world-space paving', map => {
  const before = JSON.stringify(map);
  const road = createRoadNetwork(map);
  road.updateMatrixWorld();
  const count = roadEdges(map).length;
  const surfaces = map === CITY_LOOP_MAP
    ? [['road-surface', 4], ['road-shoulder', null], ['road-pavement', 4.6]]
    : [['road-surface', 4], ['road-shoulder', null]];
  for (const [name, span] of surfaces) {
    const meshes = road.children.filter(mesh => mesh.name.startsWith(name));
    expect(meshes.length).toBeGreaterThan(1); // Distant areas still cull independently.
    expect(meshes.length).toBeLessThan(count);
    let indexCount = 0;
    let maxUvError = 0;
    const point = new THREE.Vector3();
    for (const mesh of meshes) {
      expect(mesh.material.transparent).toBe(false);
      expect(mesh.geometry.index).toBeTruthy();
      indexCount += mesh.geometry.index.count;
      if (span == null) continue;
      const { position, uv } = mesh.geometry.attributes;
      for (let i = 0; i < position.count; i++) {
        mesh.localToWorld(point.fromBufferAttribute(position, i));
        maxUvError = Math.max(maxUvError, Math.abs(uv.getX(i) - point.x / span), Math.abs(uv.getY(i) - point.z / span));
      }
    }
    expect(indexCount).toBe(36 * count); // Six rectangular faces per street segment.
    expect(maxUvError).toBeLessThan(.00001);
  }
  expect(road.userData).toMatchObject({ segmentCount: count, detailCount: count });
  expect(JSON.stringify(map)).toBe(before);
});

it('leaves district stripes and true fork arrows independently renderable and parcel hits on their tile', () => {
  const map = GRAND_BAY_MAP;
  const scene = new THREE.Scene();
  const board = Object.assign(Object.create(BoardBuilder.prototype), {
    scene3D: { scene }, activeMapDefinition: map,
    tileMeshes: [], tilePositions: [], applyTileTextures() {}
  });
  board.createTiles(map.tiles, map.tileSize || 4.4);
  const pickTargets = [...board.tileMeshes];
  board.createRoadNetwork(map);
  const road = board.roadGroup;
  const edges = roadEdges(map);
  const lanes = road.children.filter(mesh => mesh.userData.isDistrictLane);
  expect(lanes).toHaveLength(edges.length);
  edges.forEach(([from, to], i) => {
    const lane = lanes[i];
    expect(lane.position.x).toBeCloseTo((from.position.x + to.position.x) / 2);
    expect(lane.position.z).toBeCloseTo((from.position.z + to.position.z) / 2);
    expect(lane.material).toMatchObject({ transparent: true, depthWrite: false });
    expect(lane.userData.districtId).toBe(getTileVisualSpec(map, from).districtId);
  });
  expect(road.children.filter(mesh => mesh.userData.forkDirection).map(mesh => mesh.userData.forkDirection))
    .toEqual(harborForkDirections(map));

  expect(board.tileMeshes.every((target, id) => target === pickTargets[id])).toBe(true);
  const tile = map.tiles[1];
  scene.updateMatrixWorld();
  const origin = board.tilePositions[tile.id].clone().add(new THREE.Vector3(0, 5, 0));
  const ray = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0));
  expect(pickBoardTarget(ray, board, null, { players: [] })?.id).toBe(tile.id);
});

it('releases merged vertex/index buffers and materials on map clear, retaining shared textures', () => {
  const roadGroup = createRoadNetwork(CITY_LOOP_MAP);
  const scene = new THREE.Scene();
  scene.add(roadGroup);
  const live = new Set(), retained = new Set();
  roadGroup.traverse(mesh => {
    if (!mesh.isMesh) return;
    live.add(mesh.geometry);
    live.add(mesh.material);
    if (mesh.material.map) retained.add(mesh.material.map);
  });
  for (const item of live) item.addEventListener('dispose', () => {
    expect(live.delete(item)).toBe(true); // A batch material can belong to many blocks.
  });
  const releasedTextures = vi.fn();
  for (const texture of retained) texture.addEventListener('dispose', releasedTextures);
  const board = Object.assign(Object.create(BoardBuilder.prototype), {
    scene3D: { scene }, roadGroup, tileMeshes: [], vacantLotMeshes: new Map()
  });
  board.clearDynamicMap();
  expect(board.roadGroup).toBeNull();
  expect(roadGroup.parent).toBeNull();
  expect(live.size).toBe(0);
  expect(retained.size).toBeGreaterThan(0);
  expect(releasedTextures).not.toHaveBeenCalled();
});
