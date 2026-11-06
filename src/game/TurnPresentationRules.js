import { isPropertyTile } from './BoardData.js';

const money = value => `$${Math.max(0, Math.round(Number(value) || 0)).toLocaleString()}`;

export function getTurnBrief(state, player) {
  const rankings = (state.getRankings?.() || [...(state.players || [])]
    .filter(candidate => !candidate.isBankrupt)
    .sort((a, b) => (state.calculateNetWorth?.(b) || b.cash || 0) - (state.calculateNetWorth?.(a) || a.cash || 0)))
    .map(entry => entry.player || entry)
    .filter(candidate => !candidate.isBankrupt);
  const rank = Math.max(1, rankings.findIndex(candidate => candidate.id === player.id) + 1);
  const assets = state.calculateAssetBreakdown?.(player) || { total: player.cash || 0, propertyCount: 0 };
  const statuses = [];
  if (player.godType) statuses.push({ icon: '✨', label: `${player.godType} · ${player.godTurns || 0}回合`, tone: 'god' });
  if (player.vehicle && player.vehicle !== 'WALK') statuses.push({ icon: '🏎️', label: player.vehicle, tone: 'vehicle' });
  if (player.rentShieldTurns > 0) statuses.push({ icon: '🛡️', label: `免租 ${player.rentShieldTurns}`, tone: 'good' });
  if (player.negativeImmuneTurns > 0) statuses.push({ icon: '🍀', label: `护佑 ${player.negativeImmuneTurns}`, tone: 'good' });
  if (player.jailTurns > 0) statuses.push({ icon: '🚔', label: `监禁 ${player.jailTurns}`, tone: 'danger' });
  if (player.hospitalTurns > 0) statuses.push({ icon: '🏥', label: `住院 ${player.hospitalTurns}`, tone: 'danger' });
  return {
    rank,
    activeCount: rankings.length,
    netWorth: assets.total,
    netWorthLabel: money(assets.total),
    cashLabel: money(player.cash),
    propertyCount: assets.propertyCount || 0,
    statuses: statuses.slice(0, 3),
    objective: rank === 1 ? '守住财富领先优势' : rank === 2 ? '寻找反超窗口' : '积累现金并扩张版图'
  };
}

export function getArrivalBrief(state, player, tileId, landing = null) {
  const tile = state.getTile(tileId);
  const property = state.propertyManager?.getProperty(tileId);
  const kind = landing?.kind || (isPropertyTile(tile) ? 'PROPERTY' : 'SPECIAL');
  const base = {
    tileId,
    tileName: tile?.name || `地块 ${tileId}`,
    icon: tile?.icon || (isPropertyTile(tile) ? '🏙️' : '📍'),
    eyebrow: 'DESTINATION REACHED',
    title: '抵达目的地',
    detail: tile?.desc || '本次移动已经完成',
    tone: 'neutral',
    badge: tile?.type || 'ROAD'
  };
  if (kind === 'PURCHASE') return { ...base, icon: '🏡', title: '发现可投资地产', detail: `${money(tile?.price)} · ${tile?.group || '城市地块'} · 等待投资决策`, tone: 'opportunity', badge: 'LAND FOR SALE' };
  if (kind === 'UPGRADE') return { ...base, icon: '🏗️', title: '返回自有地产', detail: `${base.tileName} · 当前 LV ${property?.level || 0} · 可继续升级`, tone: 'owned', badge: 'YOUR PROPERTY' };
  if (kind === 'OWN_MAX') return { ...base, icon: '🏙️', title: '视察顶级资产', detail: `${base.tileName} · 建筑已达最高等级`, tone: 'owned', badge: 'MAX LEVEL' };
  if (kind === 'LAB') return { ...base, icon: '🧪', title: '抵达未来研究所', detail: '选择一项科技道具展开研发', tone: 'special', badge: 'RESEARCH LAB' };
  if (kind === 'MORTGAGED') return { ...base, icon: '🏦', title: '抵达抵押地产', detail: '该地产本次停止收取租金', tone: 'neutral', badge: 'MORTGAGED' };
  if (kind === 'RENT') {
    const owner = landing?.owner || state.players?.find(candidate => candidate.id === property?.owner);
    const toll = state.propertyManager.calculateToll(tileId, state.newsEffect, state.priceIndex, player);
    const teammate = state.gameMode === 'TEAM' && owner?.teamId === player.teamId;
    return { ...base, icon: teammate ? '🤝' : '💸', title: teammate ? '抵达队友地产' : '进入对手收费区', detail: `${owner?.name || '地主'} · 基础租金 ${money(teammate ? 0 : toll)}`, tone: teammate ? 'owned' : 'danger', badge: teammate ? 'TEAM PROPERTY' : 'TOLL ZONE' };
  }
  const special = {
    CARD_SHOP: ['🃏', '卡片商店', '补充策略卡与道具', 'special'], BANK: ['🏦', '中央银行', '管理现金、存款与风险准备金', 'special'],
    LOTTERY: ['🎰', '幸运乐透中心', '选择号码挑战本期奖池', 'opportunity'], MAGIC_HOUSE: ['🔮', '命运魔法屋', '用魔法重新书写全场局势', 'special'],
    MECHANISM: ['⚙️', '交通控制塔', '重构全岛岔路通行方案', 'special'], MINIGAME: ['🎮', '街机挑战场', '技巧挑战即将开始', 'opportunity'],
    STOCK: ['📈', '证券交易所', '查看行情并调整投资组合', 'special'], CHANCE: ['🎴', '命运事件', '未知事件即将揭晓', 'opportunity'],
    TREASURE: ['🎁', '发现城市宝藏', '随机奖励即将开启', 'opportunity'], MONSTER: ['👾', '怪兽出没区域', '危险事件正在逼近', 'danger'],
    PRISON: ['🚔', '抵达监狱', '通常暂停2次行动，之后从当前格继续；角色与卡片可能改变结果', 'danger'], HOSPITAL: ['🏥', '抵达医院', '通常暂停1次行动，之后从当前格继续；角色与卡片可能改变结果', 'danger'],
    COUPON: ['🎟️', '点券补给站', '卡片点券即将到账', 'opportunity'], COMPANY: ['🏢', '企业总部', '落地支付服务费，董事长免服务费；分红在周期结算', 'special']
  }[tile?.type];
  return special ? { ...base, icon: special[0], title: special[1], detail: special[2], tone: special[3], badge: tile.type } : base;
}
