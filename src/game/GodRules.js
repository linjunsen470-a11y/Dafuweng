import { GODS } from './ContentRegistry.js';

export const GOD_RULES = Object.freeze(Object.fromEntries(GODS.map(god => [god.id, Object.freeze({
  ...god,
  icon: {
    FORTUNE: '🧧', GREAT_FORTUNE: '💰', LUCK: '🌟', EARTH: '⛰️',
    MISFORTUNE: '👻', BAD: '📉', ANGEL: '👼', DEMON: '😈'
  }[god.id] || '🧚',
  tone: god.tone === 'BAD' ? 'danger' : 'gold'
})])));

export const NEGATIVE_GODS = new Set(['MISFORTUNE', 'BAD', 'DEMON']);

export function getGodRule(godType) {
  return GOD_RULES[godType] || null;
}

export function getGodDuration(player, godType, fallbackTurns = null) {
  const rule = getGodRule(godType);
  let turns = Number(fallbackTurns ?? rule?.turns ?? 4);
  if (player?.skillName === '甜心庇佑' && NEGATIVE_GODS.has(godType)) turns = Math.max(1, Math.ceil(turns / 2));
  if (player?.skillName === '石油大亨' && !NEGATIVE_GODS.has(godType)) turns += 1;
  return turns;
}

export function detachGod(player) {
  const previousGodType = player?.godType || null;
  if (player) {
    player.godType = null;
    player.godTurns = 0;
  }
  return previousGodType;
}

export function attachGod(player, godType, turns = null) {
  const rule = getGodRule(godType);
  if (!player || !rule) return null;
  const previousGodType = player.godType || null;
  player.godType = godType;
  player.godTurns = getGodDuration(player, godType, turns);
  return { previousGodType, godType, duration: player.godTurns, rule };
}

export function tickGodAtTurnStart(state, player) {
  if (!player?.godType) return [];
  const godType = player.godType;
  const rule = getGodRule(godType);
  const events = [];
  if (godType === 'GREAT_FORTUNE') {
    player.cash += 500;
    events.push({ type: 'GOD_TURN_EFFECT', playerId: player.id, godType, amount: 500, effect: 'CASH_GAIN' });
  } else if (godType === 'LUCK') {
    player.cardPoints = (player.cardPoints || 0) + 25;
    events.push({ type: 'GOD_TURN_EFFECT', playerId: player.id, godType, amount: 25, effect: 'CARD_POINTS' });
  } else if (godType === 'MISFORTUNE' && !player.negativeImmuneActiveThisTurn) {
    const amount = Math.max(0, Math.round(player.cash * 0.10));
    const transferTarget = state?.players?.find(item => item.id === player.penaltyTransferTargetId && !item.isBankrupt && item.id !== player.id);
    const recipient = transferTarget || player;
    if (transferTarget) player.penaltyTransferTargetId = null;
    recipient.cash -= amount;
    events.push({ type: 'GOD_TURN_EFFECT', playerId: recipient.id, sourcePlayerId: player.id, godType, amount, effect: 'CASH_LOSS', transferred: Boolean(transferTarget) });
  } else if (godType === 'BAD') {
    const amount = Math.min(player.cardPoints || 0, 20);
    player.cardPoints = Math.max(0, (player.cardPoints || 0) - amount);
    events.push({ type: 'GOD_TURN_EFFECT', playerId: player.id, godType, amount, effect: 'CARD_POINTS_LOSS' });
  }
  player.godTurns--;
  if (player.godTurns <= 0) {
    detachGod(player);
    events.push({ type: 'GOD_DEPARTED', playerId: player.id, godType, name: rule?.name || godType });
  }
  return events;
}
