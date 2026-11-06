import { CARD_CAPACITY, ITEM_CAPACITY } from './InventoryManager.js';
import { MAX_PROPERTY_LEVEL } from './GameRules.js';

export const MAGIC_CONDITION_META = {
  SELF: { icon: '🪞', label: '自己', category: '个人', description: '只影响施法者本人' },
  RICH_CASH: { icon: '💰', label: '现金最多的人', category: '财富', description: '锁定当前手持现金最高者' },
  POOR_CASH: { icon: '🪙', label: '现金最少的人', category: '财富', description: '锁定当前手持现金最低者' },
  RICH_ASSET: { icon: '👑', label: '总资产最多的人', category: '资产', description: '锁定综合净资产最高者' },
  MOST_LAND: { icon: '🏙️', label: '地产最多的人', category: '地产', description: '锁定名下地块数量最多者' },
  MOST_DEPOSIT: { icon: '🏦', label: '存款最多的人', category: '银行', description: '锁定银行存款最高者' },
  HAS_VEHICLE: { icon: '🏎️', label: '驾驶载具的人', category: '状态', description: '影响所有机车与汽车驾驶者' },
  ON_FOOT: { icon: '👟', label: '步行的人', category: '状态', description: '影响所有当前徒步玩家' },
  HAS_GOD: { icon: '✨', label: '被精灵附身的人', category: '状态', description: '影响所有携带巡游精灵的玩家' },
  ALL_OPPONENTS: { icon: '⚔️', label: '所有对手', category: '群体', description: '影响除施法者外的全部存活玩家' }
};

export const MAGIC_EFFECT_META = {
  CASH_RAIN: { icon: '🌧️', label: '现金雨', tone: 'BENEFIT', power: 2, description: '每名目标立即获得 $800 现金' },
  PROPERTY_BOOM: { icon: '🏗️', label: '建筑繁荣', tone: 'BENEFIT', power: 4, description: '目标名下可升级建筑全部提升一级' },
  GOD_SHUFFLE: { icon: '🌀', label: '精灵轮转', tone: 'CHAOS', power: 3, description: '目标之间循环交换附身精灵与剩余回合' },
  DEPOSIT_ALL: { icon: '🏦', label: '现金封存', tone: 'CONTROL', power: 3, description: '将目标全部现金强制转入银行存款' },
  GAIN_CARD: { icon: '🃏', label: '策略馈赠', tone: 'BENEFIT', power: 2, description: '每名目标随机获得一张策略卡' },
  GAIN_ITEM: { icon: '🎁', label: '道具馈赠', tone: 'BENEFIT', power: 2, description: '每名目标随机获得一件科技道具' },
  STOP_ONE: { icon: '⏸️', label: '时间停滞', tone: 'HARM', power: 3, description: '目标下一回合无法行动' },
  HOSPITAL: { icon: '🏥', label: '强制体检', tone: 'HARM', power: 5, description: '目标住院三回合并暂停行动' },
  DEMOLISH_ONE: { icon: '💥', label: '建筑崩解', tone: 'HARM', power: 4, description: '随机拆除目标一栋建筑的一级' },
  TURN_AROUND: { icon: '↩️', label: '方向逆转', tone: 'CONTROL', power: 2, description: '立即反转目标当前行走方向' }
};

function activePlayers(state) {
  return state.players.filter(player => !player.isBankrupt);
}

function propertyEntries(state, ownerId) {
  return [...state.propertyManager.properties.entries()].filter(([, property]) => property.owner === ownerId);
}

export function getMagicTargets(state, caster, conditionId) {
  const active = activePlayers(state);
  const sortAssets = list => [...list].sort((a, b) => state.calculateNetWorth(b) - state.calculateNetWorth(a));
  const sortLand = list => [...list].sort((a, b) => propertyEntries(state, b.id).length - propertyEntries(state, a.id).length);
  const targets = {
    SELF: [caster],
    RICH_CASH: [...active].sort((a, b) => b.cash - a.cash).slice(0, 1),
    POOR_CASH: [...active].sort((a, b) => a.cash - b.cash).slice(0, 1),
    RICH_ASSET: sortAssets(active).slice(0, 1),
    MOST_LAND: sortLand(active).slice(0, 1),
    MOST_DEPOSIT: [...active].sort((a, b) => (b.deposit || 0) - (a.deposit || 0)).slice(0, 1),
    HAS_VEHICLE: active.filter(player => player.vehicle !== 'WALK'),
    ON_FOOT: active.filter(player => player.vehicle === 'WALK'),
    HAS_GOD: active.filter(player => player.godType),
    ALL_OPPONENTS: active.filter(player => player.id !== caster.id)
  }[conditionId];
  return targets || [];
}

function getEffectCapacity(state, target, effectId) {
  if (effectId === 'PROPERTY_BOOM') return propertyEntries(state, target.id).filter(([, property]) => property.level < MAX_PROPERTY_LEVEL).length;
  if (effectId === 'DEMOLISH_ONE') return propertyEntries(state, target.id).filter(([, property]) => property.level > 0).length;
  if (effectId === 'GAIN_CARD') return Math.max(0, CARD_CAPACITY - (target.cards?.length || 0));
  if (effectId === 'GAIN_ITEM') return Math.max(0, ITEM_CAPACITY - (target.items?.length || 0));
  return 1;
}

export function getMagicPreview(state, caster, conditionId, effectId) {
  const condition = MAGIC_CONDITION_META[conditionId];
  const effect = MAGIC_EFFECT_META[effectId];
  const targets = condition && effect ? getMagicTargets(state, caster, conditionId) : [];
  const targetDetails = targets.map(target => ({
    playerId: target.id,
    name: target.name,
    color: target.color,
    avatar: target.avatar,
    avatarAtlas: target.avatarAtlas,
    avatarPosition: target.avatarPosition,
    cash: target.cash,
    deposit: target.deposit || 0,
    properties: propertyEntries(state, target.id).length,
    effectCapacity: getEffectCapacity(state, target, effectId),
    isCaster: target.id === caster.id
  }));
  let enabled = Boolean(condition && effect && targets.length);
  let reason = enabled ? '' : '当前没有符合条件的目标';
  const actionableCount = targetDetails.filter(target => target.effectCapacity > 0).length;
  if (enabled && ['PROPERTY_BOOM', 'DEMOLISH_ONE', 'GAIN_CARD', 'GAIN_ITEM'].includes(effectId) && !actionableCount) {
    enabled = false;
    reason = effectId === 'PROPERTY_BOOM' ? '目标没有可继续升级的建筑'
      : effectId === 'DEMOLISH_ONE' ? '目标没有可拆除的建筑'
        : '目标背包已满';
  }
  if (enabled && effectId === 'GOD_SHUFFLE' && (targets.length < 2 || targets.filter(target => target.godType).length < 1)) {
    enabled = false;
    reason = '至少需要两名目标，且其中一人已被精灵附身';
  }
  const selfRisk = targetDetails.some(target => target.isCaster) && ['HARM', 'CONTROL'].includes(effect?.tone);
  const affectedAssets = effectId === 'PROPERTY_BOOM' || effectId === 'DEMOLISH_ONE'
    ? targetDetails.reduce((sum, target) => sum + target.effectCapacity, 0) : 0;
  const outcome = effectId === 'CASH_RAIN' ? `预计发放 $${(targets.length * 800).toLocaleString()}`
    : effectId === 'PROPERTY_BOOM' ? `最多升级 ${affectedAssets} 栋建筑`
      : effectId === 'DEMOLISH_ONE' ? `${actionableCount} 名目标拥有可拆建筑`
        : effectId === 'DEPOSIT_ALL' ? `预计封存现金 $${targets.reduce((sum, target) => sum + target.cash, 0).toLocaleString()}`
          : `预计影响 ${targets.length} 名玩家`;
  return { conditionId, effectId, condition, effect, targets: targetDetails, enabled, reason, selfRisk, actionableCount, affectedAssets, outcome };
}
