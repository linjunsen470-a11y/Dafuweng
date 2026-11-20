import { getGodRule } from '../game/GodRules.js';

// Resolve a hit on a nested GLB part to the same tile in both inspection modes.
export function pickBoardTarget(ray, board, pawns, state) {
  const entries = new Map();
  const layers = [board.tileMeshes, board.buildingMeshes, board.specialTileMeshes,
    board.vacantLotMeshes, board.obstacleMeshes, board.mineMeshes, board.roadEntityMeshes];
  for (const layer of layers) {
    for (const [id, mesh] of layer?.entries() || []) {
      if (mesh?.visible) entries.set(mesh, { id });
    }
  }
  for (const player of state.players) {
    const mesh = pawns?.getPawnMesh(player.id);
    if (mesh) entries.set(mesh, { id: player.currentTile, name: player.name });
  }
  for (const god of state.boardGods || []) {
    const mesh = pawns?.boardGodMeshes.get(god.id);
    if (mesh) entries.set(mesh, { id: god.tileId, name: getGodRule(god.type)?.name });
  }
  for (const hit of ray.intersectObjects([...entries.keys()], true)) {
    const material = Array.isArray(hit.object.material) ? hit.object.material[hit.face?.materialIndex] : hit.object.material;
    if (material?.visible === false) continue;
    let target;
    let object = hit.object;
    while (object && object.visible) {
      target ??= entries.get(object);
      object = object.parent;
    }
    if (!object && target) return { ...target, point: hit.point };
  }
  return null;
}
