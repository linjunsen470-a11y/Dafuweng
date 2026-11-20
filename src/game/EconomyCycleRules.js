import { BUILDINGS } from './ContentRegistry.js';
import { hasChairmanPerk } from './CompanyRules.js';

export const DEFAULT_INITIAL_CASH = 15000;
export const CALENDAR_START = '2026-01-01';
const PRICE_STEPS = [1, 1.5, 2.2, 3.2, 4.5, 6];

export function calculatePriceIndex(round, mode) {
  const daysPerStep = mode === 'QUICK' ? 5 : 10;
  const step = Math.floor((Math.max(1, round) - 1) / daysPerStep);
  return PRICE_STEPS[Math.min(step, PRICE_STEPS.length - 1)];
}

export function formatGameDate(round, startDate = CALENDAR_START) {
  const date = new Date(startDate + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + round - 1);
  return date.toISOString().slice(0, 10);
}

export function daysUntilSettlement(round, roundsPerPeriod) {
  return roundsPerPeriod - round % roundsPerPeriod;
}

export function propertyActionCost(state, player, tileId, action = 'BUY') {
  const tile = state.getTile(tileId);
  if (!tile || !player || player.godType === 'LUCK') return 0;
  const type = state.propertyManager.getProperty(tileId)?.buildingType;
  const building = BUILDINGS.find(item => item.id === type);
  const base = action === 'UPGRADE' ? tile.buildCost * (building?.buildMultiplier ?? 1) : tile.price;
  // Only part of inflation passes through to construction, so late development stays viable.
  const costIndex = 1 + (state.priceIndex - 1) * 0.25;
  let cost = Math.round((base || 0) * costIndex * (state.gameMode === 'QUICK' ? 0.9 : 1));
  if (player.skillName === '商业奇才') cost = Math.round(cost * 0.85);
  else if (action === 'UPGRADE' && player.skillName === '商业神童') cost = Math.round(cost * 0.75);
  if (hasChairmanPerk(state, player.id, 'BUILD')) cost = Math.round(cost * 0.85);
  return cost;
}
