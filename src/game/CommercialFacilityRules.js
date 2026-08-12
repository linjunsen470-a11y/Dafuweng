export const COMMERCIAL_FACILITY_SERVICES = {
  PARK: { icon: '🌳', name: '生态公园休憩', description: '访客获得点券，并在下一回合免疫一次负面落地效果。' },
  MALL: { icon: '🛍️', name: '商场会员回馈', description: '完成消费后按设施等级获得卡片点券。' },
  HOTEL: { icon: '🏨', name: '旅馆入住', description: '访客入住一至三回合，使用独立于住院的停留状态。' },
  GAS_STATION: { icon: '⛽', name: '能源性能调校', description: '驾驶载具的访客在后续两次掷骰中额外前进一格。' },
  LAB: { icon: '🧪', name: '研究所开放日', description: '访客获得技术点券，业主同步获得专利授权收益。' }
};

export function applyCommercialFacilityVisit(state, { visitor, owner, tileId, property, paidAmount = 0 }) {
  const buildingType = property?.buildingType;
  const definition = COMMERCIAL_FACILITY_SERVICES[buildingType];
  if (!definition || !visitor || !owner) return null;
  const level = Math.max(0, Number(property.level || 0));
  const base = {
    type: 'COMMERCIAL_FACILITY_VISITED',
    playerId: visitor.id,
    ownerId: owner.id,
    tileId: Number(tileId),
    buildingType,
    level,
    icon: definition.icon,
    title: definition.name
  };

  if (buildingType === 'PARK') {
    const amount = 20 + level * 10;
    visitor.cardPoints += amount;
    visitor.negativeImmuneTurns = Math.max(visitor.negativeImmuneTurns || 0, 1);
    state.addLog(`🌳 ${visitor.name} 在生态公园休憩，获得 ${amount} 点券与一次负面免疫。`, 'gold');
    return { ...base, benefitKind: 'PARK_REST', amount, duration: 1, emotion: 'win', detail: `+${amount} PTS · 下回合负面免疫` };
  }

  if (buildingType === 'MALL') {
    if (paidAmount <= 0) return null;
    const amount = 15 + level * 10;
    visitor.cardPoints += amount;
    state.addLog(`🛍️ ${visitor.name} 获得商场会员回馈 ${amount} 点券。`, 'accent');
    return { ...base, benefitKind: 'MALL_REBATE', amount, emotion: 'gain', detail: `消费回馈 +${amount} PTS` };
  }

  if (buildingType === 'HOTEL') {
    const duration = Math.max(1, Math.min(3, Math.ceil((level + 1) / 2)));
    visitor.hotelTurns = Math.max(visitor.hotelTurns || 0, duration);
    state.addLog(`🏨 ${visitor.name} 入住旅馆 ${duration} 回合。`, 'accent');
    return { ...base, benefitKind: 'HOTEL_STAY', duration, emotion: 'loss', detail: `入住 ${duration} 回合` };
  }

  if (buildingType === 'GAS_STATION') {
    if (visitor.vehicle === 'WALK') return null;
    const duration = 2;
    visitor.fuelBoostTurns = Math.max(visitor.fuelBoostTurns || 0, duration);
    state.addLog(`⛽ ${visitor.name} 完成载具调校，后续 ${duration} 次移动额外前进 1 格。`, 'gold');
    return { ...base, benefitKind: 'FUEL_BOOST', duration, emotion: 'win', detail: `后续 ${duration} 次掷骰 +1 步` };
  }

  if (buildingType === 'LAB') {
    const amount = 25 + level * 10;
    const ownerAmount = 10 + level * 5;
    visitor.cardPoints += amount;
    owner.cardPoints += ownerAmount;
    state.addLog(`🧪 ${visitor.name} 参加研究所开放日获得 ${amount} 点券，${owner.name} 获得 ${ownerAmount} 点专利收益。`, 'gold');
    return { ...base, benefitKind: 'LAB_OPEN_DAY', amount, ownerAmount, emotion: 'win', detail: `技术点券 +${amount} · 业主 +${ownerAmount}` };
  }
  return null;
}
