import { TileType } from './BoardData.js';

export const MECHANISM_ROUTE_META = [
  { id: 'MAIN', routeIndex: 0, icon: '🛣️', name: '环城主干道', color: '#38bdf8', description: '锁定较短的主环路径，通行节奏稳定。' },
  { id: 'BRANCH', routeIndex: 1, icon: '🌊', name: '潮汐探索线', color: '#c084fc', description: '开启较长的岛内支线，经过更多特殊设施。' }
];

function trace(definition, start, limit = 40) {
  const tiles = new Map(definition.tiles.map(tile => [tile.id, tile]));
  const path = [];
  let current = start;
  while (Number.isInteger(current) && path.length < limit && !path.includes(current)) {
    path.push(current);
    current = tiles.get(current)?.next?.[0];
  }
  return path;
}

function branchSegments(definition) {
  return definition.tiles.filter(tile => (tile.next || []).length > 1).map(branch => {
    const traces = branch.next.map(nextId => trace(definition, nextId));
    const intersection = traces[0]?.find(id => traces.slice(1).every(route => route.includes(id)));
    const routes = traces.map(route => {
      const end = intersection === undefined ? Math.min(route.length, 14) : route.indexOf(intersection) + 1;
      return route.slice(0, end);
    });
    return { branch, rejoinTileId: intersection ?? routes[0]?.at(-1), routes };
  });
}

export function getMechanismRoutePlans(state, player) {
  const segments = branchSegments(state.mapDefinition);
  const currentLocked = Boolean(state.mechanismState?.locked);
  return MECHANISM_ROUTE_META.map(meta => {
    const segmentViews = segments.map(segment => {
      const route = segment.routes[meta.routeIndex % segment.routes.length] || [];
      return {
        branchTileId: segment.branch.id,
        branchName: segment.branch.name,
        entryTileId: route[0],
        rejoinTileId: segment.rejoinTileId,
        nodeIds: route,
        nodeNames: route.map(id => state.getTile(id)?.name || `${id}`),
        nodeCount: route.length
      };
    });
    const nodeIds = [...new Set(segmentViews.flatMap(segment => segment.nodeIds))];
    const tiles = nodeIds.map(id => state.getTile(id)).filter(Boolean);
    const properties = nodeIds.map(id => ({ id, property: state.propertyManager.getProperty(id), tile: state.getTile(id) }))
      .filter(entry => [TileType.PROPERTY, TileType.BIG_PROPERTY].includes(entry.tile?.type) && entry.property);
    const ownProperties = properties.filter(entry => entry.property.owner === player.id).length;
    const rivalProperties = properties.filter(entry => entry.property.owner !== null && entry.property.owner !== player.id).length;
    const tollExposure = properties.filter(entry => entry.property.owner !== null && entry.property.owner !== player.id)
      .reduce((sum, entry) => sum + state.propertyManager.calculateToll(entry.id, state.newsEffect), 0);
    const ownTollPotential = properties.filter(entry => entry.property.owner === player.id)
      .reduce((sum, entry) => sum + state.propertyManager.calculateToll(entry.id, state.newsEffect), 0);
    const facilities = tiles.filter(tile => ![TileType.PROPERTY, TileType.BIG_PROPERTY, TileType.ROAD, TileType.START].includes(tile.type));
    const playersOnRoute = state.players.filter(candidate => !candidate.isBankrupt && nodeIds.includes(candidate.currentTile));
    return {
      ...meta,
      active: currentLocked && state.mechanismState.activeRoute === meta.routeIndex,
      enabled: !(currentLocked && state.mechanismState.activeRoute === meta.routeIndex),
      reason: currentLocked && state.mechanismState.activeRoute === meta.routeIndex ? '当前方案已在运行' : '',
      segments: segmentViews,
      nodeIds,
      nodeCount: nodeIds.length,
      propertyCount: properties.length,
      facilityCount: facilities.length,
      facilityIcons: facilities.slice(0, 6).map(tile => tile.icon),
      ownProperties,
      rivalProperties,
      tollExposure,
      ownTollPotential,
      playersOnRoute: playersOnRoute.map(candidate => ({ id: candidate.id, name: candidate.name, color: candidate.color, isCaster: candidate.id === player.id }))
    };
  });
}

export function chooseAIMechanismRoute(state, player) {
  return getMechanismRoutePlans(state, player)
    .filter(plan => plan.enabled)
    .sort((a, b) => (b.ownTollPotential * 1.25 - b.tollExposure + b.facilityCount * 90 - b.nodeCount * 4)
      - (a.ownTollPotential * 1.25 - a.tollExposure + a.facilityCount * 90 - a.nodeCount * 4))[0] || null;
}
