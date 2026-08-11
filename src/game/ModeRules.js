import { CARD_CAPACITY } from './InventoryManager.js';

export const MODE_PROFILES = {
  STANDARD: { id: 'STANDARD', name: '标准局', icon: '🏙️', summary: '完整财富经营对局', rules: ['40 轮标准赛程', '地产、股票、公司与市场全部开放', '最后存活或总资产最高者获胜'] },
  QUICK: { id: 'QUICK', name: '快速局', icon: '⚡', summary: '高周转短赛程竞速', rules: ['24 轮决胜', '经过起点收入提高 50%', '购地与建造费用降低 10%', '每 4 轮进行经济结算'] },
  TEAM: { id: 'TEAM', name: '组队战', icon: '🤝', summary: '2 对 2 协作经营', rules: ['队友地产免租并可协助升级', '经过起点时队友获得 25% 团队分红', '按队伍总资产和存活情况决胜'] },
  CHALLENGE: { id: 'CHALLENGE', name: '领主挑战', icon: '👑', summary: '三名挑战者对抗强化领主', rules: ['领主拥有强化资金与卡片', '领主经过起点额外获得 25%', '每个经济周期领主获得增援', '击败领主或比较双方总资产'] },
  HEAT: { id: 'HEAT', name: '热斗模式', icon: '🔥', summary: '攻击卡主导的淘汰赛', rules: ['地产格改为攻击补给', '飞弹、核弹和地雷造成现金伤害', '禁止存款且起点收入减半', '淘汰对手或在 30 轮时资产领先'] }
};

export function getModeProfile(mode) {
  return MODE_PROFILES[mode] || MODE_PROFILES.STANDARD;
}

export function getModeCycleRounds(mode) {
  return mode === 'QUICK' ? 4 : 5;
}

export function getModeStartBonus(state, player, baseAmount) {
  if (state.gameMode === 'QUICK') return Math.round(baseAmount * 1.5);
  if (state.gameMode === 'HEAT') return Math.round(baseAmount * 0.5);
  if (state.gameMode === 'CHALLENGE' && player.isLord) return Math.round(baseAmount * 1.25);
  return baseAmount;
}

export function getModePropertyCostMultiplier(mode) {
  return mode === 'QUICK' ? 0.9 : 1;
}

export function applyModeCycleEffects(state) {
  const events = [];
  if (state.gameMode === 'CHALLENGE') {
    const lord = state.players.find(player => player.isLord && !player.isBankrupt);
    if (lord) {
      const cash = 1500 + state.economicCycle.period * 250;
      lord.cash += cash;
      lord.cardPoints += 40;
      const cardId = state.rng.pick(['MISSILE', 'MINE', 'OBSTACLE', 'RENT_SHIELD']);
      const grantedCard = lord.cards.length < CARD_CAPACITY;
      if (grantedCard) lord.cards.push(cardId);
      events.push({ type: 'LORD_REINFORCED', playerId: lord.id, cash, cardPoints: 40, cardId: grantedCard ? cardId : null });
      state.addLog(`👑 领主增援抵达：${lord.name} 获得 $${cash.toLocaleString()}、40 点券${grantedCard ? `与 ${cardId}` : ''}。`, 'danger');
    }
  }
  return events;
}

export function getModeOverview(state) {
  const profile = getModeProfile(state.gameMode);
  let standings;
  if (state.gameMode === 'TEAM') {
    const teams = new Map();
    state.players.forEach(player => {
      const current = teams.get(player.teamId) || { id: player.teamId, name: `队伍 ${Number(player.teamId) + 1}`, assets: 0, active: 0, members: [] };
      current.assets += state.calculateNetWorth(player);
      current.active += player.isBankrupt ? 0 : 1;
      current.members.push(player.name);
      teams.set(player.teamId, current);
    });
    standings = [...teams.values()].sort((a, b) => b.assets - a.assets);
  } else if (state.gameMode === 'CHALLENGE') {
    const lord = state.players.find(player => player.isLord);
    const challengers = state.players.filter(player => !player.isLord);
    standings = [
      { id: 'LORD', name: lord?.name || '领主', assets: lord ? state.calculateNetWorth(lord) : 0, active: lord?.isBankrupt ? 0 : 1, members: [lord?.name].filter(Boolean) },
      { id: 'CHALLENGERS', name: '挑战者联盟', assets: challengers.reduce((sum, player) => sum + state.calculateNetWorth(player), 0), active: challengers.filter(player => !player.isBankrupt).length, members: challengers.map(player => player.name) }
    ].sort((a, b) => b.assets - a.assets);
  } else {
    standings = state.getRankings().map(({ player, assets }) => ({ id: player.id, name: player.name, assets: assets.total, active: player.isBankrupt ? 0 : 1, members: [player.name] }));
  }
  return { profile, standings, round: state.round, maxRounds: state.maxRounds,
    roundProgress: Math.min(1, Math.max(0, state.round / state.maxRounds)) };
}
