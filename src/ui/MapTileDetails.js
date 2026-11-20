import { COLOR_GROUPS, isPropertyTile } from '../game/BoardData.js';
import { BUILDINGS } from '../game/ContentRegistry.js';
import { propertyLimit } from '../game/GameRules.js';
import { rentAbility } from './CharacterAbilityFeedback.js';
import { cityPortrait } from './CityPortrait.js';

export const formatDeedMoney = value => '$' + value.toLocaleString();

function describeProperty(state, engine, tile, visitor, property, owner) {
  const manager = state.propertyManager;
  const district = COLOR_GROUPS[tile.group];
  const level = property?.level ?? 0;
  const type = property?.buildingType || (tile.large ? 'MALL' : 'RESIDENTIAL');
  const building = BUILDINGS.find(item => item.id === type);
  const cityImage = cityPortrait(owner, state.mapId);
  const deed = {
    district: district?.name || (tile.large ? '城市商业地标' : '独立地块'),
    color: district?.color || '#dfa44c',
    icon: building?.icon || (type === 'CHAIN_STORE' ? '🏪' : '🏡'),
    level, owner: owner?.name, avatar: owner?.avatar,
    portrait: cityImage || owner?.avatarAtlas || owner?.avatarImg,
    atlasPosition: !cityImage && owner?.avatarAtlas ? owner.avatarPosition || '0% 0%' : null,
    rent: null, rentLabel: '当前租金', next: null, price: null,
    chainLabel: '无连片加成', multiplier: 1
  };
  const lines = [owner ? `${owner.name} · LV ${level}` : '无主地产'];
  const notes = [];
  if (state.gameMode === 'HEAT') {
    deed.rentLabel = '热斗补给';
    deed.chainLabel = '不计租';
    lines.push('热斗模式：此格按补给规则结算，不使用标准购租报价');
  } else if (property?.isMortgaged) {
    deed.rentLabel = '抵押停租';
    deed.rent = 0;
    lines.push('已抵押 · 暂不收租');
  } else if (state.gameMode === 'TEAM' && owner && owner.id !== visitor.id && owner.teamId === visitor.teamId) {
    deed.rentLabel = '队友免租';
    deed.rent = 0;
    deed.chainLabel = '本次免租';
    lines.push('队友地产 · 停留不付租金');
  } else if (!owner) {
    deed.rent = 0;
    deed.price = engine.getPropertyActionCost(visitor, tile.id, 'BUY');
    lines.push('未售出 · 当前不收租', '当前默认购价 ' + formatDeedMoney(deed.price));
  } else {
    const quote = previewLevel => Math.round(manager.calculateToll(tile.id, state.newsEffect, state.priceIndex,
      visitor, previewLevel) * rentAbility(owner).multiplier);
    deed.rentLabel = '租金牌价';
    deed.rent = quote(level);
    if (level < propertyLimit(type, state.mapId)) deed.next = quote(level + 1);
    lines.push(`当前租金牌价 ${formatDeedMoney(deed.rent)}（非最终实收）`);

    const size = manager.streetChain(tile.id).size;
    const monopoly = manager.checkGroupMonopoly(owner.id, tile.group);
    deed.multiplier = Math.max(size, monopoly ? 2 : 1);
    if (size > 1 || monopoly) {
      deed.chainLabel = [size > 1 && `${size} 块连片`, monopoly && '同色垄断'].filter(Boolean).join(' · ');
      lines.push(`${deed.chainLabel} · 租金 ×${deed.multiplier}`);
    }

    if (type === 'CHAIN_STORE') {
      const count = [...manager.properties.values()].filter(p => p.owner === owner.id && p.buildingType === type).length;
      notes.push(`连锁店 ${count} 家 · 加成 ${25 * Math.max(0, count - 1)}%`);
    }
    if (type === 'GAS_STATION' && visitor.vehicle === 'WALK') notes.push('步行到访免费');
    if (owner.id === visitor.id) notes.push('自己停留不付租金');
    else if (visitor.godType === 'GREAT_FORTUNE' || visitor.rentShieldActiveThisTurn) notes.push('当前有免租效果，落地时仍有效则免租。');
    else if (visitor.godType) notes.push('神明附身可能改变实付租金');
  }
  return { deed, lines: [...lines, ...notes], notes };
}

export function describeMapTile(state, engine, id) {
  const tile = state.getTile(id);
  const visitor = state.getCurrentPlayer();
  if (!tile || !visitor) return null;
  const property = state.propertyManager.getProperty(id);
  const owner = state.players.find(p => p.id === property?.owner);
  const info = isPropertyTile(tile)
    ? describeProperty(state, engine, tile, visitor, property, owner)
    : { lines: [tile.desc || tile.name], notes: [tile.desc || tile.name] };

  const road = state.roadEntities?.find(e => e.tileId === id && e.data?.attachedPlayerId == null);
  const hazards = [];
  if (property?.hasObstacle || road?.type === 'BARRIER') hazards.push('🚧 路障：进入即截停，自己也会触发');
  if (property?.hasMine || road?.type === 'MINE') hazards.push('💥 地雷：进入有住院风险');
  if (road?.type === 'TIME_BOMB') {
    const remaining = Number.isFinite(road.expiresRound) ? ` · 剩余 ${Math.max(0, road.expiresRound - state.round)} 轮` : '';
    hazards.push('⏱️ 定时炸弹：进入会附身' + remaining);
  }
  const links = state.mapRuntime.getNextOptions(id, visitor.direction || 1)
    .map(next => ({ id: next, name: state.getTile(next)?.name || `${next}号格` }));
  return {
    ...info, id, name: tile.name, title: `${id} · ${tile.name}`, lines: [...info.lines, ...hazards],
    notes: [...info.notes, ...hazards], links, direction: visitor.direction === -1 ? '逆向' : '正向',
    color: owner?.color || '#ce9955'
  };
}
