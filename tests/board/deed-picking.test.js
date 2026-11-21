// @vitest-environment happy-dom
import { it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { bindBoardPointing } from '../../src/ui/BoardPointing.js';
import { pickBoardTarget } from '../../src/ui/BoardTarget.js';

it('resolves a visible nested building even when an invisible lot and model part are nearer', () => {
  const group = () => {
    const root = new THREE.Group();
    const detail = new THREE.Group();
    detail.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
    root.add(detail);
    return root;
  };
  const hiddenLot = group();
  hiddenLot.visible = false;
  const building = group();
  building.position.z = -2;
  const hiddenDetail = group();
  hiddenDetail.children[0].visible = false;
  hiddenDetail.add(building);
  hiddenLot.updateMatrixWorld();
  hiddenDetail.updateMatrixWorld();
  const board = { vacantLotMeshes: new Map([[1, hiddenLot]]), buildingMeshes: new Map([[2, hiddenDetail], [3, building]]) };
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 3), new THREE.Vector3(0, 0, -1));
  expect(pickBoardTarget(ray, board, null, { players: [] })?.id).toBe(3);
});

it('accepts a single left click or tap, and rejects pinches, cancelled taps and return drags', () => {
  const canvas = document.createElement('canvas');
  const tap = vi.fn();
  const dispose = bindBoardPointing(canvas, { tap });
  const pointer = (type, x, options = {}) => canvas.dispatchEvent(new PointerEvent('pointer' + type, {
    pointerId: 1, isPrimary: true, pointerType: 'touch', button: 0, clientX: x, clientY: 24, ...options
  }));
  pointer('down', 10);
  pointer('move', 24);
  pointer('up', 10);
  pointer('down', 10);
  pointer('down', 35, { pointerId: 2, isPrimary: false });
  pointer('up', 35, { pointerId: 2, isPrimary: false });
  pointer('up', 10);
  pointer('down', 10);
  pointer('cancel', 10);
  pointer('up', 10);
  pointer('down', 10, { pointerType: 'mouse', button: 2 });
  pointer('up', 10);
  expect(tap).not.toHaveBeenCalled();
  pointer('down', 10);
  pointer('up', 12);
  expect(tap).toHaveBeenCalledExactlyOnceWith(12, 24);
  dispose();
});
