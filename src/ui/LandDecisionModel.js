import { rentAbility, costAbilityNote } from './CharacterAbilityFeedback.js';
import { residentialRent, MAX_PROPERTY_LEVEL } from '../game/GameRules.js';
import { COLOR_GROUPS, isPropertyTile } from '../game/BoardData.js';
import { BUILDINGS } from '../game/ContentRegistry.js';

export function createLandDecisionModel({ tileData, currentLevel = 0, player, state = null, action = 'BUY', quote = null, buildingType = null }) {
  const property = state?.propertyManager?.getProperty(tileData.id);
  const resolvedBuildingType = buildingType || property?.buildingType || (tileData.large ? 'MALL' : 'RESIDENTIAL');
  const building = BUILDINGS.find(item => item.id === resolvedBuildingType);
  const cost = Math.max(0, Number(quote ?? (action === 'UPGRADE' ? tileData.buildCost : tileData.price)) || 0);
  const targetLevel = action === 'UPGRADE' ? Math.min(currentLevel + 1, building?.maxLevel ?? MAX_PROPERTY_LEVEL) : currentLevel;
  const rentMultiplier = building?.rentMultiplier ?? 1;
  const economyMultiplier = (state?.priceIndex || 1) * (state?.newsEffect === 'DOUBLE_RENT' || state?.newsEffect?.id === 'DOUBLE_RENT' ? 2 : 1);
  const districtTiles = state?.mapDefinition?.tiles?.filter(tile => tile.group === tileData.group && isPropertyTile(tile)) || [tileData];
  const ownedBefore = districtTiles.filter(tile => state?.propertyManager?.getProperty(tile.id)?.owner === player?.id).length;
  const alreadyOwned = property?.owner === player?.id;
  const projectedOwned = Math.min(districtTiles.length, ownedBefore + (action === 'BUY' && !alreadyOwned ? 1 : 0));
  const monopolyMultiplier = Math.max(tileData.group && projectedOwned === districtTiles.length ? 2 : 1,
    state?.propertyManager?.streetChain(tileData.id,player?.id).size || 1);
  const chainCount = resolvedBuildingType === 'CHAIN_STORE'
    ? [...(state?.propertyManager?.properties?.values?.() || [])].filter(item => item.owner === player?.id && item.buildingType === 'CHAIN_STORE').length + (action === 'BUY' ? 1 : 0)
    : 0;
  const chainMultiplier = resolvedBuildingType === 'CHAIN_STORE' ? 1 + Math.max(0, chainCount - 1) * 0.25 : 1;
  const rentOwner = action === 'UPGRADE' ? state?.players?.find(p => p.id === property?.owner) || player : player;
  const ability = rentAbility(rentOwner);
  const withOwnerAbility = amount => Math.round(amount * ability.multiplier);
  const projectedRent = level => withOwnerAbility(Math.floor(residentialRent(tileData, level) * rentMultiplier * economyMultiplier * monopolyMultiplier * chainMultiplier));
  const currentToll = property?.owner !== null && property?.owner !== undefined
    ? Math.round(state.propertyManager.calculateToll(tileData.id, state.newsEffect, state.priceIndex) * rentAbility(state.players?.find(p => p.id === property.owner) || player).multiplier)
    : projectedRent(currentLevel);
  const nextToll = projectedRent(targetLevel);
  const cash = Math.max(0, Number(player?.cash) || 0);
  const rentGrowth = Array.from({ length: (building?.maxLevel ?? MAX_PROPERTY_LEVEL) + 1 }, (_, level) => projectedRent(level));
  const maxRent = Math.max(1, ...rentGrowth);
  return {
    action,
    cost,
    affordable: cash >= cost,
    cash,
    cashAfter: Math.max(0, cash - cost),
    currentLevel,
    targetLevel,
    artLevel: targetLevel,
    currentToll,
    nextToll,
    rentIncrease: Math.max(0, nextToll - currentToll),
    yieldRate: cost > 0 ? nextToll / cost * 100 : 100,
    paybackPasses: nextToll > 0 ? Math.ceil(cost / nextToll) : null,
    districtName: COLOR_GROUPS[tileData.group]?.name || (tileData.large ? '城市商业地标' : '独立地块'),
    districtColor: COLOR_GROUPS[tileData.group]?.color || player?.color || '#67e8f9',
    districtOwned: projectedOwned,
    districtTotal: Math.max(1, districtTiles.length),
    completesDistrict: Boolean(tileData.group && projectedOwned === districtTiles.length),
    buildingType: resolvedBuildingType,
    buildingName: building?.name || (resolvedBuildingType === 'CHAIN_STORE' ? '连锁店' : '精品住宅'),
    buildingIcon: building?.icon || (resolvedBuildingType === 'CHAIN_STORE' ? '🏪' : '🏡'),
    abilityNote: [costAbilityNote(player, action, quote), ability.label ? `${ability.label}，已计入预估；访客减免另结算` : ''].filter(Boolean).join('。'),
    buildingDescription: building?.description || (resolvedBuildingType === 'CHAIN_STORE' ? '同类门店越多，连锁租金加成越高。' : '逐级建设可显著提高到访租金。'),
    rentGrowth: rentGrowth.map((value, level) => ({ level, value, share: Math.max(4, value / maxRent * 100) }))
  };
}
