import { TileType } from './BoardData.js';

export const QUEST_DEFINITIONS = Object.freeze({
  CITY_TOUR: Object.freeze({
    id: 'CITY_TOUR', icon: '🚩', title: '环城巡礼', issuer: '城市观光局',
    description: '在期限内经过起点 1 次', target: 1, duration: 4,
    reward: Object.freeze({ cash: 1800, cardPoints: 30 }), penaltyPoints: 25
  }),
  PROPERTY_INVESTOR: Object.freeze({
    id: 'PROPERTY_INVESTOR', icon: '🏗️', title: '建设合伙人', issuer: '城市开发署',
    description: '购买或升级地产累计 2 次', target: 2, duration: 5,
    reward: Object.freeze({ cash: 2200, cardPoints: 50 }), penaltyPoints: 30
  }),
  CARD_TACTIC: Object.freeze({
    id: 'CARD_TACTIC', icon: '🃏', title: '策略演习', issuer: '卡片公会',
    description: '成功使用任意策略卡 2 次', target: 2, duration: 4,
    reward: Object.freeze({ cash: 1200, cardPoints: 100 }), penaltyPoints: 25
  }),
  LANDMARK_ROUTE: Object.freeze({
    id: 'LANDMARK_ROUTE', icon: '🧭', title: '地标巡访', issuer: '商业联合会',
    description: '到访 3 处不同的城市设施', target: 3, duration: 5,
    reward: Object.freeze({ cash: 1600, cardPoints: 80 }), penaltyPoints: 30
  })
});

const LANDMARK_TYPES = new Set([
  TileType.CARD_SHOP, TileType.BANK, TileType.LOTTERY, TileType.MAGIC_HOUSE,
  TileType.COMPANY, TileType.MINIGAME, TileType.STOCK, TileType.TREASURE
]);

function recordQuest(state, quest, status, extra = {}) {
  state.questHistory.unshift({ ...structuredClone(quest), status, resolvedRound: state.round, ...extra });
  state.questHistory = state.questHistory.slice(0, 30);
}

function questEvent(type, quest, extra = {}) {
  return {
    type,
    playerId: quest.playerId,
    questId: quest.id,
    definitionId: quest.definitionId,
    title: quest.title,
    icon: quest.icon,
    progress: quest.progress,
    target: quest.target,
    expiresRound: quest.expiresRound,
    ...extra
  };
}

export function startQuest(state, player, definitionId, source = null) {
  const definition = QUEST_DEFINITIONS[definitionId];
  if (!definition || !player || player.isBankrupt) return { success: false, reason: '委托不可用' };
  state.activeQuests ||= [];
  state.questHistory ||= [];
  state.questSequence ||= 0;

  const existing = state.activeQuests.find(quest => quest.playerId === player.id && quest.definitionId === definitionId);
  if (existing) {
    existing.expiresRound += 1;
    state.addLog?.(`📜 ${player.name} 的「${existing.title}」期限延长至第 ${existing.expiresRound} 轮。`, 'gold');
    return { success: true, ...questEvent('QUEST_EXTENDED', existing), chance: source };
  }

  const quest = {
    id: `quest-${state.round}-${player.id}-${++state.questSequence}`,
    definitionId,
    playerId: player.id,
    title: definition.title,
    issuer: definition.issuer,
    icon: definition.icon,
    description: definition.description,
    progress: 0,
    target: definition.target,
    startedRound: state.round,
    expiresRound: state.round + definition.duration,
    reward: { ...definition.reward },
    penaltyPoints: definition.penaltyPoints,
    uniqueTargets: []
  };
  state.activeQuests.push(quest);
  state.addLog?.(`📜 ${player.name} 接受「${quest.title}」：${quest.description}。`, 'gold');
  return { success: true, ...questEvent('QUEST_STARTED', quest), issuer: quest.issuer, description: quest.description, reward: quest.reward, chance: source };
}

function progressAmount(state, quest, event) {
  switch (quest.definitionId) {
    case 'CITY_TOUR': return event.type === 'START_BONUS_GRANTED' ? 1 : 0;
    case 'PROPERTY_INVESTOR': return ['PROPERTY_PURCHASED', 'PROPERTY_UPGRADED'].includes(event.type) ? 1 : 0;
    case 'CARD_TACTIC': return event.type === 'CARD_USED' ? 1 : 0;
    case 'LANDMARK_ROUTE': {
      if (event.type !== 'PLAYER_STEPPED' || quest.uniqueTargets.includes(event.tileId)) return 0;
      if (!LANDMARK_TYPES.has(state.getTile(event.tileId)?.type)) return 0;
      quest.uniqueTargets.push(event.tileId);
      return 1;
    }
    default: return 0;
  }
}

export function advanceQuestsForEvent(state, event, actingPlayerId = null) {
  if (!event?.type || event.type.startsWith('QUEST_')) return [];
  const playerId = event.playerId ?? actingPlayerId;
  if (playerId === null || playerId === undefined) return [];
  const events = [];
  [...(state.activeQuests || [])].forEach(quest => {
    if (quest.playerId !== playerId) return;
    const amount = progressAmount(state, quest, event);
    if (!amount) return;
    quest.progress = Math.min(quest.target, quest.progress + amount);
    events.push(questEvent('QUEST_PROGRESS', quest));
    if (quest.progress < quest.target) return;

    const player = state.players.find(item => item.id === quest.playerId);
    if (player) {
      player.cash += quest.reward.cash;
      player.cardPoints = (player.cardPoints || 0) + quest.reward.cardPoints;
    }
    state.activeQuests = state.activeQuests.filter(item => item.id !== quest.id);
    recordQuest(state, quest, 'COMPLETED', { reward: { ...quest.reward } });
    state.addLog?.(`🏆 ${player?.name || '玩家'} 完成「${quest.title}」，获得 $${quest.reward.cash.toLocaleString()} 与 ${quest.reward.cardPoints} PTS。`, 'gold');
    events.push(questEvent('QUEST_COMPLETED', quest, { reward: { ...quest.reward } }));
  });
  return events;
}

export function processQuestDeadlines(state) {
  const events = [];
  [...(state.activeQuests || [])].forEach(quest => {
    if (state.round <= quest.expiresRound) return;
    const player = state.players.find(item => item.id === quest.playerId);
    const penalty = Math.min(player?.cardPoints || 0, quest.penaltyPoints || 0);
    if (player) player.cardPoints -= penalty;
    state.activeQuests = state.activeQuests.filter(item => item.id !== quest.id);
    recordQuest(state, quest, 'FAILED', { penaltyPoints: penalty });
    state.addLog?.(`⌛ ${player?.name || '玩家'} 的「${quest.title}」已到期，扣除 ${penalty} PTS。`, 'danger');
    events.push(questEvent('QUEST_FAILED', quest, { penaltyPoints: penalty }));
  });
  return events;
}

