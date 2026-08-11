import { COLOR_GROUPS, TileType, isPropertyTile } from './BoardData.js';
import { BUILDINGS } from './ContentRegistry.js';

export const BUILDING_LABELS = {
  RESIDENTIAL: '住宅', CHAIN_STORE: '连锁店', MALL: '购物中心', HOTEL: '旅馆',
  PARK: '公园', GAS_STATION: '加油站', LAB: '研究所'
};

export function getPropertyPortfolio(state, playerId) {
  const owned = [...state.propertyManager.properties.entries()]
    .filter(([, property]) => property.owner === playerId)
    .map(([tileId, property]) => {
      const tile = state.getTile(tileId);
      const building = BUILDINGS.find(entry => entry.id === property.buildingType);
      const buildCost = Math.round((tile.buildCost || 0) * (building?.buildMultiplier || 1));
      return {
        tileId, tile, property, buildCost,
        buildingLabel: BUILDING_LABELS[property.buildingType] || property.buildingType,
        rent: state.propertyManager.calculateToll(tileId, state.newsEffect, state.priceIndex),
        value: Math.max(0, (tile.price || 0) + buildCost * (property.level || 0) - (property.isMortgaged ? property.mortgageValue || 0 : 0)),
        monopoly: state.propertyManager.checkGroupMonopoly(playerId, tile.group),
        listed: state.marketOffers?.some(offer => offer.kind === 'PROPERTY' && Number(offer.contentId) === Number(tileId)) || false,
        researchTask: state.researchTasks?.find(task => task.tileId === Number(tileId)) || null
      };
    });
  return owned.sort((a, b) => (a.tile.group || '').localeCompare(b.tile.group || '') || a.tileId - b.tileId);
}

export function getDistrictPortfolio(state, playerId) {
  const groups = new Map();
  state.mapDefinition.tiles.filter(tile => tile.type === TileType.PROPERTY && tile.group).forEach(tile => {
    if (!groups.has(tile.group)) groups.set(tile.group, []);
    groups.get(tile.group).push(tile);
  });
  return [...groups.entries()].map(([groupId, tiles]) => {
    const owned = tiles.filter(tile => state.propertyManager.getProperty(tile.id)?.owner === playerId);
    const owners = [...new Set(tiles.map(tile => state.propertyManager.getProperty(tile.id)?.owner).filter(owner => owner !== null))];
    return {
      groupId,
      name: COLOR_GROUPS[groupId]?.name || groupId,
      color: COLOR_GROUPS[groupId]?.color || '#67e8f9',
      total: tiles.length,
      owned: owned.length,
      complete: owned.length === tiles.length,
      contested: owners.length > 1,
      tileIds: tiles.map(tile => tile.id)
    };
  }).sort((a, b) => b.owned - a.owned || a.name.localeCompare(b.name));
}

export function getBuildingOptions(tile) {
  if (!tile || !isPropertyTile(tile)) return [];
  return tile.type === TileType.BIG_PROPERTY
    ? BUILDINGS.map(building => ({ id: building.id, label: building.name }))
    : [{ id: 'RESIDENTIAL', label: BUILDING_LABELS.RESIDENTIAL }, { id: 'CHAIN_STORE', label: BUILDING_LABELS.CHAIN_STORE }];
}

export function chooseAIPropertyManagement(player, state) {
  const portfolio = getPropertyPortfolio(state, player.id);
  const reserve = { EASY: 5000, NORMAL: 3200, HARD: 2000 }[player.aiDifficulty] || 3200;
  const redeemable = portfolio.filter(entry => entry.property.isMortgaged)
    .map(entry => ({ ...entry, cost: Math.round(entry.property.mortgageValue * 1.1) }))
    .filter(entry => player.cash - entry.cost >= reserve)
    .sort((a, b) => a.cost - b.cost)[0];
  if (redeemable) return { type: 'REDEEM_PROPERTY', tileId: redeemable.tileId };

  const normal = portfolio.filter(entry => entry.tile.type === TileType.PROPERTY && !entry.property.isMortgaged && !entry.listed);
  const chainCount = normal.filter(entry => entry.property.buildingType === 'CHAIN_STORE').length;
  const chainCandidate = normal.find(entry => entry.property.buildingType === 'RESIDENTIAL' && !entry.researchTask);
  if (chainCandidate && normal.length >= 3 && chainCount < Math.ceil(normal.length / 2)
    && ['PROPERTY', 'ECONOMY'].includes(player.aiStrategy)) {
    const cost = Math.round((chainCandidate.tile.buildCost || 0) * 0.25);
    if (player.cash - cost >= reserve) return { type: 'CHOOSE_BUILDING_TYPE', tileId: chainCandidate.tileId, buildingType: 'CHAIN_STORE' };
  }

  if (player.cash < 1800) {
    const mortgage = normal.filter(entry => entry.property.level === 0).sort((a, b) => (b.tile.price || 0) - (a.tile.price || 0))[0];
    if (mortgage) return { type: 'MORTGAGE_PROPERTY', tileId: mortgage.tileId };
    const building = normal.filter(entry => entry.property.level > 0).sort((a, b) => a.rent - b.rent)[0];
    if (building) return { type: 'SELL_BUILDING', tileId: building.tileId };
  }
  return null;
}
