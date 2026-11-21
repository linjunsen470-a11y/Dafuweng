// @vitest-environment happy-dom
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { addPathFlowGuides, createStreetLinkRibbon } from '../../src/engine/BoardPathVisuals.js';
import { createRichTileMaterial } from '../../src/engine/BoardTileArt.js';
import { createOwnerBasePlatform } from '../../src/engine/PropertyBadges.js';
import { buildRichPropertyStructure, buildRichVacantLot, decorateOriginalBuilding } from '../../src/engine/PropertyBuildings.js';
import { GRAND_BAY_MAP } from '../../src/game/GrandMapData.js';
import { CITY_LOOP_MAP } from '../../src/game/MapData.js';

function stubCanvas2D() {
  const noop = () => {};
  const grad = { addColorStop: vi.fn() };
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, textAlign: '', textBaseline: '', font: '',
    fillRect: noop, strokeRect: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    arc: noop, ellipse: noop, roundRect: noop, rect: noop, fill: noop, stroke: noop, clip: noop,
    save: noop, restore: noop, translate: noop, scale: noop, fillText: noop, strokeText: noop,
    createLinearGradient: () => grad, createRadialGradient: () => grad
  };
  return vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
}

describe('Richman 4 board path, tile art, and property building visuals', () => {
  it('adds forward-pointing chevrons, road edge stripes, and fork rings with +Z tip orientation', () => {
    const group = new THREE.Group();
    addPathFlowGuides(group, GRAND_BAY_MAP, 3.6);
    const stripes = group.getObjectByName('road-edge-stripes');
    const chevrons = group.getObjectByName('road-flow-chevrons');
    const rings = group.getObjectByName('road-fork-rings');

    expect(stripes?.isInstancedMesh).toBe(true);
    expect(chevrons?.isInstancedMesh).toBe(true);
    expect(rings?.isInstancedMesh).toBe(true);

    // Verify chevron tip points along +Z so Math.atan2(dx, dz) aligns it forward along travel direction.
    chevrons.geometry.computeBoundingBox();
    const pos = chevrons.geometry.attributes.position;
    let maxZ = -Infinity;
    let tipX = null;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      if (z > maxZ) { maxZ = z; tipX = pos.getX(i); }
    }
    expect(maxZ).toBeGreaterThan(0.4);
    expect(Math.abs(tipX)).toBeLessThan(0.01);
  });

  it('creates Richman-4 tile materials for vacant, owned (numeric & hex colors), road, and special tiles', () => {
    const spy = stubCanvas2D();
    try {
      const propTile = GRAND_BAY_MAP.tiles.find(t => t.type === 'PROPERTY');
      const roadTile = GRAND_BAY_MAP.tiles.find(t => t.type === 'ROAD');
      const bankTile = GRAND_BAY_MAP.tiles.find(t => t.type === 'BANK');

      const vacantMat = createRichTileMaterial(propTile, GRAND_BAY_MAP);
      const ownedNumMat = createRichTileMaterial(propTile, GRAND_BAY_MAP, { ownerColor: 0xffa502, level: 3 });
      const ownedHexMat = createRichTileMaterial(propTile, GRAND_BAY_MAP, { ownerColor: '#ff4757', level: 5 });
      const roadMat = createRichTileMaterial(roadTile, CITY_LOOP_MAP);
      const bankMat = createRichTileMaterial(bankTile, GRAND_BAY_MAP);

      for (const mat of [vacantMat, ownedNumMat, ownedHexMat, roadMat, bankMat]) {
        expect(mat.map?.isCanvasTexture).toBe(true);
        mat.map.dispose();
        mat.dispose();
      }
    } finally {
      spy.mockRestore();
    }
  });

  it('escalates procedural residential heights from Lv.1 to Lv.5 and supports all commercial types', () => {
    const spy = stubCanvas2D();
    try {
      const heights = [1, 2, 3, 4, 5].map(level => {
        const mesh = buildRichPropertyStructure({ level, ownerColor: '#ff5e7e', buildingType: 'RESIDENTIAL', large: false });
        const box = new THREE.Box3().setFromObject(mesh);
        return box.max.y;
      });
      for (let i = 1; i < heights.length; i++) {
        expect(heights[i]).toBeGreaterThan(heights[i - 1]);
      }

      for (const type of ['MALL', 'HOTEL', 'PARK', 'GAS_STATION', 'LAB', 'CHAIN_STORE']) {
        const comm = buildRichPropertyStructure({ level: 3, ownerColor: 0x38bdf8, buildingType: type, large: type !== 'CHAIN_STORE' });
        let hasBadge = false;
        comm.traverse(node => { if (node.userData?.isPropertyBadge) hasBadge = true; });
        expect(hasBadge).toBe(true);
      }

      const vacant = buildRichVacantLot(GRAND_BAY_MAP.tiles[1], '#18a0ae');
      expect(vacant.children.length).toBeGreaterThan(4);

      const platform = createOwnerBasePlatform('#ff5e7e', false);
      const plinth = platform.children.find(c => c.userData?.isOwnerLight);
      expect(plinth.material.color.getHexString()).not.toBe('0a1a28');

      const ribbon = createStreetLinkRibbon(new THREE.Vector3(0, 0, 0), new THREE.Vector3(6, 0, 0), '#ff5e7e');
      expect(ribbon.children).toHaveLength(2);
    } finally {
      spy.mockRestore();
    }
  });

  it('tints cloned GLB roof materials toward owner color and adds a floating star badge', () => {
    const spy = stubCanvas2D();
    try {
      const group = new THREE.Group();
      const model = new THREE.Group();
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(2, 2, 2),
        new THREE.MeshStandardMaterial({ name: 'coral', color: '#cccccc' })
      );
      roof.position.y = 1;
      model.add(roof);
      group.add(model);

      const beforeColor = roof.material.color.getHex();
      decorateOriginalBuilding(group, model, { level: 3, ownerColor: '#ff2244', buildingType: 'RESIDENTIAL', large: false });
      expect(roof.material.color.getHex()).not.toBe(beforeColor);
      expect(model.scale.y).toBeGreaterThan(1.3);

      let badge = null;
      group.traverse(node => { if (node.userData?.isPropertyBadge) badge = node; });
      expect(badge).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });
});
