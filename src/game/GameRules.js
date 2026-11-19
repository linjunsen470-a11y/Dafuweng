import { BUILDINGS } from './ContentRegistry.js';

export const MAX_PROPERTY_LEVEL = 5;

export function propertyLimit(type, mapId = null) {
  return BUILDINGS.find(building => building.id === type)?.maxLevel ?? (mapId?.startsWith('shanhai-') ? 4 : MAX_PROPERTY_LEVEL);
}

export function residentialRent(tile, level) {
  const rents = tile.tolls || [];
  if (level === 5 && rents[5] === undefined) return Math.round((rents[4] || 0) * 1.5);
  return rents[level] ?? 0;
}
