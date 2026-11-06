const money = value => Math.round(Number(value) || 0);

export const WIN_REASON_LABELS = {
  LAST_PLAYER: '其他对手均已破产', NET_WORTH: '达到轮次上限，按总资产决胜',
  LAST_TEAM: '其他队伍均已退出竞争', TEAM_NET_WORTH: '达到轮次上限，按队伍总资产决胜',
  LORD_DEFEATED: '领主破产，挑战者联盟获胜', LORD_VICTORY: '领主击败全部挑战者'
};

function compareRows(a, b) {
  return Number(a.player.isBankrupt) - Number(b.player.isBankrupt)
    || b.assets.total - a.assets.total || b.assets.cash - a.assets.cash
    || (b.statistics.rentIncome - b.statistics.rentExpense) - (a.statistics.rentIncome - a.statistics.rentExpense)
    || (a.statistics.bankruptRound ?? Infinity) - (b.statistics.bankruptRound ?? Infinity)
    || a.player.id - b.player.id;
}

function award(id, title, icon, rows, score) {
  const ranked = [...rows].sort((a, b) => score(b) - score(a) || compareRows(a, b));
  const value = money(score(ranked[0]));
  const tied = ranked.filter(row => money(score(row)) === value).sort(compareRows);
  return {
    id, title, icon, value,
    playerId: tied[0].player.id,
    playerName: tied[0].player.name,
    tiedPlayerIds: tied.map(row => row.player.id),
    tieBroken: tied.length > 1
  };
}

function buildHighlights(state, rows) {
  const highlights = (state.matchStatistics?.highlights || []).map(item => {
    const name = state.players.find(player => player.id === item.playerId)?.name || '玩家';
    if (item.type === 'PLAYER_BANKRUPT') return { icon: '💥', round: item.round, text: `${name} 宣告破产` };
    if (item.type === 'QUEST_COMPLETED') return { icon: '🎯', round: item.round, text: `${name} 完成连续委托` };
    return { icon: '🎮', round: item.round, text: `${name} 在小游戏中赢得 $${money(item.amount).toLocaleString()}` };
  });
  const bestRent = [...rows].sort((a, b) => (b.statistics.rentIncome || 0) - (a.statistics.rentIncome || 0) || compareRows(a, b))[0];
  if (bestRent && bestRent.statistics.rentIncome > 0) highlights.push({ icon: '🏠', round: null, text: `${bestRent.player.name} 累计收取 $${money(bestRent.statistics.rentIncome).toLocaleString()} 租金` });
  if (!highlights.length && rows[0]) highlights.push({ icon: '🏆', round: null, text: `${rows[0].player.name} 以 $${rows[0].assets.total.toLocaleString()} 总资产完成本局` });
  return highlights.slice(-12);
}

export function createMatchReport(state) {
  const stats = new Map((state.matchStatistics?.players || []).map(row => [row.playerId, row]));
  const teamMode = ['TEAM', 'CHALLENGE'].includes(state.gameMode);
  const rows = state.players.map(player => ({
    player, assets: state.calculateAssetBreakdown(player),
    statistics: stats.get(player.id) || {}, teamId: player.teamId
  })).sort((a, b) => {
    const aWon = teamMode ? a.teamId === state.winningTeamId : a.player.id === state.winner?.id;
    const bWon = teamMode ? b.teamId === state.winningTeamId : b.player.id === state.winner?.id;
    return Number(bWon) - Number(aWon) || compareRows(a, b);
  }).map((row, index) => ({ ...row, rank: index + 1 }));
  const teams = teamMode ? [...new Set(rows.map(row => row.teamId))].map(id => {
    const members = rows.filter(row => row.teamId === id);
    return { id, members, total: members.reduce((sum, row) => sum + row.assets.total, 0), active: members.filter(row => !row.player.isBankrupt).length };
  }).sort((a, b) => Number(b.id === state.winningTeamId) - Number(a.id === state.winningTeamId) || b.total - a.total || String(a.id).localeCompare(String(b.id))) : [];
  const awards = rows.length ? [
    award('PROPERTY_KING', '地产王', '🏙️', rows, row => row.assets.landValue + row.assets.buildingValue),
    award('CASH_KING', '现金王', '💰', rows, row => row.assets.cash + row.assets.deposit),
    award('CARD_MASTER', '卡片大师', '🃏', rows, row => row.statistics.cardsUsed || 0),
    award('INVESTOR', '投资高手', '📈', rows, row => row.assets.stockValue + (row.statistics.investmentTrades || 0)),
    award('BUSINESS_TYCOON', '商业巨擘', '🏢', rows, row => row.assets.commercialValue || 0)
  ] : [];
  const leader = rows[0];
  const runnerUp = rows[1];
  const margin = leader ? Math.max(0, leader.assets.total - (runnerUp?.assets.total || 0)) : 0;
  const totals = rows.reduce((sum, row) => ({
    cashFlow: sum.cashFlow + (row.statistics.cashIn || 0) + (row.statistics.cashOut || 0),
    properties: sum.properties + (row.statistics.propertiesBought || 0),
    cards: sum.cards + (row.statistics.cardsUsed || 0),
    trades: sum.trades + (row.statistics.investmentTrades || 0)
  }), { cashFlow: 0, properties: 0, cards: 0, trades: 0 });
  return {
    mode: state.gameMode, round: state.round, maxRounds: state.maxRounds,
    winnerId: state.winner?.id ?? leader?.player.id, winningTeamId: state.winningTeamId ?? null,
    reason: state.winReason, reasonLabel: WIN_REASON_LABELS[state.winReason] || '财富竞逐完成',
    rankings: rows, teams, awards, highlights: buildHighlights(state, rows), totals, margin
  };
}
