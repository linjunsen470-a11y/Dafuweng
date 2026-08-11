export const COMPANY_POLICIES = [
  { id: 'EXPANSION', name: '业务扩张', icon: '🚀', cost: 600, description: '提高本周期经营上限，并增加营收转化为分红的比例。' },
  { id: 'DIVIDEND', name: '股东回报', icon: '💰', cost: 500, description: '本周期将更多营收用于股东分红。' },
  { id: 'RESERVE', name: '稳健储备', icon: '🛡️', cost: 350, description: '限制经营亏损，保留更多公司金库。' },
  { id: 'INNOVATION', name: '创新研发', icon: '🧠', cost: 700, description: '结算时为董事长提供点券，并创造额外公司收入。' }
];

export const COMPANY_PERKS = {
  SHOP: { name: '零售渠道', icon: '🛍️', description: '董事长购买卡片和普通道具享受 15% 点券折扣。' },
  INSURANCE: { name: '保险理赔', icon: '🛟', description: '董事长支付地产租金时获得 20% 理赔减免。' },
  TRANSIT: { name: '交通调度', icon: '🚝', description: '董事长每次正常掷骰额外前进 1 步。' },
  BUILD: { name: '营造协同', icon: '🏗️', description: '董事长购买和升级地产享受 15% 现金折扣。' },
  TECH: { name: '技术加速', icon: '💻', description: '董事长研发高级道具所需时间减少 1 轮。' },
  MATERIAL: { name: '材料回收', icon: '⛏️', description: '董事长拆售建筑时回收价值由 50% 提高至 65%。' }
};

export function getChairmanCompany(state, playerId, perk = null) {
  return state.companyManager.companies.find(company => company.chairmanId === playerId && (!perk || company.perk === perk)) || null;
}

export function hasChairmanPerk(state, playerId, perk) {
  return Boolean(getChairmanCompany(state, playerId, perk));
}

export function getCompanyPolicy(company) {
  return COMPANY_POLICIES.find(policy => policy.id === company?.policyId) || null;
}

export function chooseAICompanyPolicy(player, state) {
  const company = state.companyManager.companies
    .filter(entry => entry.chairmanId === player.id && !entry.policyId)
    .sort((a, b) => b.treasury - a.treasury)[0];
  if (!company) return null;
  const preference = {
    ECONOMY: ['DIVIDEND', 'RESERVE', 'EXPANSION'],
    PROPERTY: ['EXPANSION', 'RESERVE', 'DIVIDEND'],
    CARD: ['INNOVATION', 'DIVIDEND', 'RESERVE'],
    ATTACK: ['EXPANSION', 'INNOVATION', 'DIVIDEND']
  }[player.aiStrategy] || ['RESERVE', 'DIVIDEND', 'EXPANSION'];
  const policy = preference.map(id => COMPANY_POLICIES.find(entry => entry.id === id))
    .find(entry => entry && company.treasury >= entry.cost);
  return policy ? { companyId: company.id, policyId: policy.id } : null;
}
