export const STAT_FIELDS = [
  'turns', 'cashIn', 'cashOut', 'rentIncome', 'rentExpense', 'propertiesBought',
  'propertiesUpgraded', 'cardsUsed', 'itemsUsed', 'investmentTrades',
  'minigamesPlayed', 'minigamesWon', 'minigameEarnings', 'questsCompleted'
];

export function createPlayerStatistics(playerId) {
  return Object.fromEntries([['playerId', playerId], ...STAT_FIELDS.map(key => [key, 0]), ['bankruptRound', null]]);
}

export function normalizeMatchStatistics(value, players = []) {
  const saved = new Map((value?.players || []).map(row => [row.playerId, row]));
  return {
    startedAtRound: Number(value?.startedAtRound) || 1,
    players: players.map(player => {
      const source = saved.get(player.id) || {};
      const row = createPlayerStatistics(player.id);
      STAT_FIELDS.forEach(key => { row[key] = Math.max(0, Number(source[key]) || 0); });
      row.bankruptRound = source.bankruptRound === null || source.bankruptRound === undefined
        ? null : Math.max(1, Number(source.bankruptRound) || 1);
      return row;
    }),
    highlights: Array.isArray(value?.highlights)
      ? structuredClone(value.highlights).filter(item => item && typeof item.type === 'string').slice(-24)
      : []
  };
}

export function recordMatchCommand(statistics, { playerId, commandType, result, cashBefore, cashAfter, round }) {
  if (!result?.success) return statistics;
  const row = statistics.players.find(item => item.playerId === playerId);
  if (!row) return statistics;
  const delta = Math.round((Number(cashAfter) || 0) - (Number(cashBefore) || 0));
  if (delta > 0) row.cashIn += delta;
  if (delta < 0) row.cashOut += -delta;
  if (commandType === 'END_TURN') row.turns++;
  if (commandType === 'PURCHASE_PROPERTY') row.propertiesBought++;
  if (commandType === 'UPGRADE_PROPERTY') row.propertiesUpgraded++;
  if (commandType === 'USE_CARD') row.cardsUsed++;
  if (commandType === 'USE_ITEM' || commandType === 'PLACE_ROAD_ENTITY') row.itemsUsed++;
  if (['BUY_STOCK', 'SELL_STOCK', 'CREATE_MARKET_OFFER', 'ACCEPT_MARKET_OFFER'].includes(commandType)) row.investmentTrades++;
  if (commandType === 'SUBMIT_MINIGAME_RESULT') {
    row.minigamesPlayed++;
    row.minigameEarnings += Math.max(0, Number(result.reward) || 0);
    if ((Number(result.reward) || 0) > 0) row.minigamesWon++;
  }
  if (result.type === 'RENT_PAID') {
    row.rentExpense += Number(result.amount) || 0;
    const owner = statistics.players.find(item => item.playerId === result.ownerId);
    if (owner) {
      owner.rentIncome += Number(result.amount) || 0;
      owner.cashIn += Number(result.amount) || 0;
    }
  }
  if (result.type === 'PLAYER_BANKRUPT' && row.bankruptRound === null) row.bankruptRound = round;
  return statistics;
}

export function recordMatchEvents(statistics, events, round) {
  events.forEach(event => {
    const row = statistics.players.find(item => item.playerId === event.playerId);
    if (event.type === 'QUEST_COMPLETED' && row) row.questsCompleted++;
    if (event.type === 'PLAYER_BANKRUPT' && row && row.bankruptRound === null) row.bankruptRound = round;
    if (['PLAYER_BANKRUPT', 'QUEST_COMPLETED', 'MINIGAME_COMPLETED'].includes(event.type)) {
      statistics.highlights.push({ type: event.type, playerId: event.playerId, round, amount: event.reward || event.amount || 0 });
    }
  });
  statistics.highlights = statistics.highlights.slice(-24);
  return statistics;
}
