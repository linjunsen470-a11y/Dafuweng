import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getBoardThemeProfile, getTileVisualSpec } from '../game/BoardVisualRules.js';
import { surfaceTexture } from './BoardSurfaceArt.js';
import { hasClassicFrontages } from './ClassicFrontages.js';
import { harborForkDirections } from './HarborBoardStyle.js';

const BLOCK_SIZE = 24;

function roadLayers(map, width) {
  const profile = getBoardThemeProfile(map.theme);
  const layers = [{
    name: 'road-surface', width, height: .16, overlap: .22, elevation: .12, uvSpan: 4,
    material: new THREE.MeshStandardMaterial({ map: surfaceTexture(map.id, 'road'), roughness: .88, metalness: .03 })
  }, {
    name: 'road-shoulder', width: width + .7, height: .12, overlap: .35, elevation: .035,
    material: new THREE.MeshStandardMaterial({ color: profile.shoulder, roughness: .74, metalness: .06 })
  }];
  if (hasClassicFrontages(map)) layers.push({
    name: 'road-pavement', width: width + 4.4, height: .2, overlap: .45, elevation: -.035, uvSpan: 4.6,
    material: new THREE.MeshStandardMaterial({ map: surfaceTexture(map.id, 'pave'), roughness: .96 })
  });
  return layers;
}

function roadSlab(layer, length, transform) {
  const geometry = new THREE.BoxGeometry(layer.width, layer.height, length + layer.overlap);
  geometry.applyMatrix4(transform);
  if (layer.uvSpan) {
    // The pattern carries continuously across angled junctions and block boundaries.
    const { position, uv } = geometry.attributes;
    for (let i = 0; i < position.count; i++) {
      uv.setXY(i, position.getX(i) / layer.uvSpan, position.getZ(i) / layer.uvSpan);
    }
  }
  return geometry;
}

function forkArrow(direction) {
  const { x, z, dx, dz } = direction;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    x + dx * .35, .255, z + dz * .35,
    x - dx * .25 + dz * .24, .255, z - dz * .25 - dx * .24,
    x - dx * .25 - dz * .24, .255, z - dz * .25 + dx * .24
  ], 3));
  const arrow = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#fff2be', side: THREE.DoubleSide }));
  arrow.userData.forkDirection = direction;
  return arrow;
}

export function createRoadNetwork(map) {
  const width = map.roadWidth || Math.max(2.8, (map.tileSize || 4.4) * .82);
  const group = new THREE.Group();
  group.name = 'roads-' + map.id;
  const tiles = new Map(map.tiles.map(tile => [tile.id, tile]));
  const seen = new Set(), blocks = new Map(), laneMaterials = new Map();
  const layers = roadLayers(map, width);
  const transform = new THREE.Matrix4();
  let count = 0;
  for (const tile of map.tiles) {
    for (const nextId of tile.next || []) {
      const edge = Math.min(tile.id, nextId) + ':' + Math.max(tile.id, nextId);
      const next = tiles.get(nextId);
      if (seen.has(edge) || !tile.position || !next?.position) continue;
      seen.add(edge);
      const dx = next.position.x - tile.position.x, dz = next.position.z - tile.position.z;
      const length = Math.hypot(dx, dz), angle = Math.atan2(dx, dz);
      const x = tile.position.x + dx / 2, z = tile.position.z + dz / 2;
      const key = Math.floor(x / BLOCK_SIZE) + ',' + Math.floor(z / BLOCK_SIZE);
      if (!blocks.has(key)) blocks.set(key, layers.map(() => []));
      const batches = blocks.get(key);
      transform.makeRotationY(angle);
      layers.forEach((layer, index) => {
        transform.setPosition(x, layer.elevation, z);
        batches[index].push(roadSlab(layer, length, transform));
      });

      // Keep translucent markings separate so Three can sort them at the original depth.
      const visual = getTileVisualSpec(map, tile);
      if (!laneMaterials.has(visual.lane)) laneMaterials.set(visual.lane, new THREE.MeshBasicMaterial({
        color: visual.lane, transparent: true, opacity: .72, depthWrite: false
      }));
      const lane = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(.07, width * .035), .035, Math.max(.3, length * .6)),
        laneMaterials.get(visual.lane)
      );
      lane.position.set(x, .222, z);
      lane.rotation.y = angle;
      lane.userData.isDistrictLane = true;
      lane.userData.districtId = visual.districtId;
      group.add(lane);
      count++;
    }
  }
  for (const batches of blocks.values()) {
    batches.forEach((parts, index) => {
      const layer = layers[index];
      const geometry = mergeGeometries(parts);
      for (const part of parts) part.dispose();
      const mesh = new THREE.Mesh(geometry, layer.material);
      mesh.name = layer.name;
      mesh.receiveShadow = true;
      group.add(mesh);
    });
  }
  if (!count) for (const layer of layers) layer.material.dispose();
  for (const direction of harborForkDirections(map)) group.add(forkArrow(direction));
  group.userData.segmentCount = group.userData.detailCount = count;
  return group;
}
