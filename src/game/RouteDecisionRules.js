import { isPropertyTile } from './BoardData.js';

const ROAD_META = {
  BARRIER: { icon: '🚧', label: '路障截停', score: -120, stops: true, tone: 'danger' },
  MINE: { icon: '💥', label: '道路地雷', score: -520, stops: true, tone: 'danger' },
  TIME_BOMB: { icon: '⏱️', label: '定时炸弹附身', score: -240, tone: 'danger' },
  GIFT_BOX: { icon: '🎁', label: '随机道具', score: 150, tone: 'good' },
  COUPON_CHEST: { icon: '🎟️', label: '120 点券', score: 110, tone: 'good' },
  DOG: { icon: '🐕', label: '机械犬', score: -330, walkOnly: true, tone: 'danger' },
  NPC: { icon: '🧑‍🚀', label: '旅人赠礼', score: 90, tone: 'good' }
};

const GOD_VALUES = {
  GREAT_FORTUNE: 170, FORTUNE: 130, LUCK: 115, EARTH: 145, ANGEL: 120,
  MISFORTUNE: -170, GREAT_POOR: -165, SMALL_POOR: -125, BAD: -150, DEMON: -115
};

const FACILITY_VALUES = {
  CARD_SHOP: 48, BANK: 34, LOTTERY: 30, MAGIC_HOUSE: 55, MECHANISM: 42,
  COMPANY: 38, MINIGAME: 44, STOCK: 28, CHANCE: 8, COUPON: 55,
  TREASURE: 65, GOD_FORTUNE: 95, GOD_EARTH: 105, GOD_ANGEL: 85,
  GOD_MISFORTUNE: -100, GOD_BAD: -110, GOD_DEMON: -90, MONSTER: -70,
  HOSPITAL: -18, PRISON: -24
};

const money = value => `$${Math.max(0, Math.round(Number(value) || 0)).toLocaleString()}`;
const ownerFor = (state, ownerId) => state.players.find(candidate => candidate.id === ownerId);

function effectiveToll(state, player, tileId) {
  const property = state.propertyManager.getProperty(tileId);
  const owner = ownerFor(state, property?.owner);
  if (!owner || owner.id === player.id || (state.gameMode === 'TEAM' && owner.teamId === player.teamId)) return 0;
  if (player.godType === 'GREAT_FORTUNE' || player.rentShieldActiveThisTurn) return 0;
  let amount = state.propertyManager.calculateToll(tileId, state.newsEffect, state.priceIndex, player);
  if (['MISFORTUNE', 'GREAT_POOR', 'SMALL_POOR'].includes(player.godType)) amount *= 2;
  if (player.godType === 'FORTUNE') amount *= 0.5;
  if (owner.skillName === '土地公庇护') amount *= 1.2;
  if (owner.skillName === '皇家威严') amount *= 1.25;
  return Math.max(0, Math.round(amount));
}

function stoppingEvent(state, player, tileId) {
  const property = state.propertyManager.getProperty(tileId);
  if (property?.hasMine) return { icon: '💥', label: '埋藏地雷', score: -520, tone: 'danger' };
  if (property?.hasObstacle) return { icon: '🚧', label: '路障截停', score: -120, tone: 'danger' };
  const entity = state.roadEntities?.find(candidate => candidate.tileId === tileId && !candidate.data?.attachedPlayerId);
  const meta = entity && ROAD_META[entity.type];
  if (meta?.stops || (entity?.type === 'DOG' && player.vehicle === 'WALK')) return meta;
  return null;
}

function enumeratePaths(state, player, firstTileId, remainingSteps, maxPaths = 72) {
  const results = [];
  const walk = (path, stepsLeft) => {
    const current = path.at(-1);
    if (results.length >= maxPaths || stepsLeft <= 0 || stoppingEvent(state, player, current)) {
      results.push(path);
      return;
    }
    const options = state.mapRuntime.getNextOptions(current, player.direction || 1);
    if (!options.length) {
      results.push(path);
      return;
    }
    options.forEach(option => walk([...path, option], stepsLeft - 1));
  };
  walk([firstTileId], Math.max(0, Number(remainingSteps) - 1));
  return results.length ? results : [[firstTileId]];
}

function analyzePath(state, player, path) {
  const encounters = [];
  let score = 0;
  path.forEach(tileId => {
    const tile = state.getTile(tileId);
    const property = state.propertyManager.getProperty(tileId);
    const stopper = stoppingEvent(state, player, tileId);
    if (stopper) {
      encounters.push({ ...stopper, tileId });
      score += stopper.score;
    }
    const entity = state.roadEntities?.find(candidate => candidate.tileId === tileId && !candidate.data?.attachedPlayerId);
    const road = entity && ROAD_META[entity.type];
    if (road && !stopper) {
      encounters.push({ ...road, tileId });
      score += road.score;
    }
    const boardGod = state.boardGods?.find(god => god.tileId === tileId);
    if (boardGod) {
      const value = GOD_VALUES[boardGod.type] || 0;
      encounters.push({ icon: boardGod.icon || (value >= 0 ? '✨' : '🌑'), label: boardGod.name || '巡游神明', score: value, tone: value >= 0 ? 'good' : 'danger', tileId });
      score += value;
    }
    state.players.filter(candidate => candidate.id !== player.id && !candidate.isBankrupt && candidate.currentTile === tileId).forEach(candidate => {
      const value = !player.godType && candidate.godType ? (GOD_VALUES[candidate.godType] || 0) * 0.55 : 0;
      encounters.push({ icon: '🤝', label: value ? `可能沾染${candidate.name}的神明` : `与${candidate.name}擦肩`, score: value, tone: value < 0 ? 'danger' : 'neutral', tileId });
      score += value;
    });
    if (player.godType === 'EARTH' && isPropertyTile(tile) && property?.owner === null) score += 115;
    if (player.godType === 'ANGEL' && isPropertyTile(tile) && property?.owner === player.id && property.level < 4) score += 45;
    if (player.godType === 'DEMON' && isPropertyTile(tile) && property?.owner !== null) score += property.owner === player.id ? -55 : 55;
    if (player.vehicle === 'ENGINEER' && isPropertyTile(tile) && property?.owner !== null && property.owner !== player.id && property.level > 0) score += 45;
  });

  const destinationId = path.at(-1);
  const destination = state.getTile(destinationId);
  const property = state.propertyManager.getProperty(destinationId);
  const owner = ownerFor(state, property?.owner);
  let toll = 0;
  let purchasePrice = 0;
  let outcome = destination?.desc || '平稳落地';
  let outcomeIcon = destination?.icon || '📍';
  if (isPropertyTile(destination)) {
    if (property?.owner === null) {
      purchasePrice = Number(destination.price || 0);
      const groupOwned = state.mapDefinition.tiles.filter(tile => tile.group === destination.group && state.propertyManager.getProperty(tile.id)?.owner === player.id).length;
      const affordable = player.cash >= purchasePrice;
      score += affordable ? 90 + groupOwned * 28 : 16;
      outcome = affordable ? `可购入 ${money(purchasePrice)}` : `空地 · 资金不足 ${money(purchasePrice)}`;
      outcomeIcon = affordable ? '🏡' : '🏷️';
    } else if (property.owner === player.id) {
      score += 40 + property.level * 8;
      outcome = `自有地产 · LV ${property.level}`;
      outcomeIcon = '🏠';
    } else if (state.gameMode === 'TEAM' && owner?.teamId === player.teamId) {
      score += 25;
      outcome = `${owner.name}的队友地产`;
      outcomeIcon = '🤝';
    } else {
      toll = effectiveToll(state, player, destinationId);
      score -= toll * (player.cash < toll ? 0.32 : 0.18);
      outcome = toll ? `预计租金 ${money(toll)}` : '免租通行';
      outcomeIcon = toll ? '💸' : '🛡️';
    }
  } else {
    score += FACILITY_VALUES[destination?.type] || 0;
    outcome = destination?.desc || destination?.name || '平稳落地';
  }
  score -= path.length * 0.5;
  return {
    pathIds: path,
    tiles: path.map(tileId => { const tile = state.getTile(tileId); return { id: tileId, name: tile?.name || `${tileId}`, icon: tile?.icon || (isPropertyTile(tile) ? '🏠' : '·') }; }),
    destinationId,
    destinationName: destination?.name || `${destinationId}`,
    destinationIcon: outcomeIcon,
    outcome,
    toll,
    purchasePrice,
    encounters,
    stoppedEarly: Boolean(stoppingEvent(state, player, destinationId)) && path.length < Number(path.requestedSteps || Infinity),
    score: Math.round(score)
  };
}

function verdict(score) {
  if (score >= 130) return { label: '高收益', tone: 'excellent' };
  if (score >= 45) return { label: '值得选择', tone: 'good' };
  if (score > -45) return { label: '局势平稳', tone: 'neutral' };
  if (score > -180) return { label: '存在风险', tone: 'warning' };
  return { label: '高度危险', tone: 'danger' };
}

export function getRouteChoicePlans(state, player, options, remainingSteps) {
  const plans = options.map((optionId, optionIndex) => {
    const candidates = enumeratePaths(state, player, optionId, remainingSteps).map(path => analyzePath(state, player, path));
    const best = candidates.sort((a, b) => b.score - a.score || a.destinationId - b.destinationId)[0];
    return { optionId, optionIndex, ...best, stoppedEarly: best.pathIds.length < Number(remainingSteps), alternateCount: Math.max(0, candidates.length - 1), ...verdict(best.score) };
  });
  const ranked = [...plans].sort((a, b) => b.score - a.score || a.optionIndex - b.optionIndex);
  return plans.map(plan => ({ ...plan, recommended: plan.optionId === ranked[0]?.optionId }));
}

export function chooseRouteByPlan(player, options, state, remainingSteps = state.pendingMove?.remainingSteps || 1) {
  return getRouteChoicePlans(state, player, options, remainingSteps).sort((a, b) => b.score - a.score || a.optionIndex - b.optionIndex)[0]?.optionId ?? options[0];
}
