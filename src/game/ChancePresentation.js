const CATEGORY_META = {
  CASH: { icon: '💰', label: '财富机遇', accent: '#facc15' },
  QUEST: { icon: '📜', label: '城市委托', accent: '#c084fc' },
  INVENTORY: { icon: '🎁', label: '策略补给', accent: '#38bdf8' },
  MOBILITY: { icon: '🏎️', label: '旅途变数', accent: '#fb7185' },
  PROPERTY: { icon: '🏙️', label: '地产风云', accent: '#4ade80' },
  MARKET: { icon: '📈', label: '商业脉动', accent: '#2dd4bf' },
  FORTUNE: { icon: '✨', label: '奇迹际遇', accent: '#e879f9' }
};

export const CHANCE_RARITIES = {
  LEGENDARY: { id: 'LEGENDARY', label: '传奇', stars: 5 },
  EPIC: { id: 'EPIC', label: '史诗', stars: 4 },
  RARE: { id: 'RARE', label: '稀有', stars: 3 },
  STANDARD: { id: 'STANDARD', label: '标准', stars: 2 }
};

function categoryFor(chance) {
  if (!chance.kind) return 'CASH';
  if (chance.kind === 'QUEST') return 'QUEST';
  if (['CARD_POINTS', 'ITEM', 'RESEARCH_ITEM', 'ITEM_LOSS', 'CARD'].includes(chance.kind)) return 'INVENTORY';
  if (['VEHICLE', 'HOSPITAL', 'ROAD_BARRIER'].includes(chance.kind)) return 'MOBILITY';
  if (['PROPERTY_UP', 'PROPERTY_DOWN'].includes(chance.kind)) return 'PROPERTY';
  if (['STOCK', 'COMPANY', 'DEPOSIT', 'LOTTERY'].includes(chance.kind)) return 'MARKET';
  return 'FORTUNE';
}

function rarityFor(chance) {
  const amount = Math.abs(Number(chance.amount) || 0);
  if (['QUEST', 'GOD', 'IMMUNITY', 'RESEARCH_ITEM'].includes(chance.kind) || amount >= 1800) return CHANCE_RARITIES.LEGENDARY;
  if (['PROPERTY_UP', 'PROPERTY_DOWN', 'STOCK', 'HOSPITAL'].includes(chance.kind) || chance.vehicle === 'CAR' || amount >= 1300) return CHANCE_RARITIES.EPIC;
  if (chance.kind || amount >= 800) return CHANCE_RARITIES.RARE;
  return CHANCE_RARITIES.STANDARD;
}

function outcomeFor(chance, event) {
  const money = value => `$${Math.abs(Number(value) || 0).toLocaleString()}`;
  if (event.type === 'NEGATIVE_BLOCKED') return '护佑生效 · 本次负面事件已抵消';
  if (event.type === 'CASH_GAINED') return `现金增加 ${money(event.amount)}`;
  if (event.type === 'CASH_LOST') return `现金减少 ${money(event.amount)}`;
  if (event.type === 'QUEST_STARTED') return `接受委托 · ${event.target || 0} 个目标 · 第 ${event.expiresRound} 轮前完成`;
  if (event.type === 'QUEST_EXTENDED') return `委托期限延长至第 ${event.expiresRound} 轮`;
  if (event.type === 'INVENTORY_CHANGED') {
    if (event.full) return '背包已满，本次补给未能装入';
    if (event.removed) return '随机遗失一件随身道具';
    if (event.inventory === 'CARD_POINTS') return `${event.amount >= 0 ? '获得' : '失去'} ${Math.abs(event.amount)} PTS`;
    return event.cardId ? `获得策略卡 · ${event.cardId}` : event.itemId ? `获得科技道具 · ${event.itemId}` : chance.desc;
  }
  if (event.type === 'HOSPITALIZED') return `住院疗养 ${event.duration} 回合`;
  if (event.type === 'STATUS_CHANGED') return chance.isGain ? `获得状态 · ${event.status}` : `状态变为 · ${event.status}`;
  if (event.type === 'STATUS_APPLIED') return `${event.statusName || '运势精灵'}附身 ${event.duration} 回合`;
  if (event.type === 'ROAD_ENTITY_CHANGED') return '前方道路出现折叠路障';
  if (event.type === 'STOCK_CHANGED') return `${chance.isGain ? '利好' : '利空'}冲击 · ${event.stockId} 股票`;
  if (event.type === 'COMPANY_SETTLED') return `${chance.isGain ? '获得' : '支付'} ${money(Math.abs(event.amount))}`;
  if (event.type === 'PROPERTY_CHANGED') return event.level ? `建筑调整至 LV ${event.level}` : '当前没有可调整的建筑';
  if (event.type === 'LOTTERY_BOUGHT') return `获得免费乐透券 · ${event.number} 号`;
  if (event.type === 'BANK_TRANSFERRED') return `${chance.isGain ? '存款增加' : '存款减少'} ${money(event.amount)}`;
  return chance.desc;
}

export function getChancePresentation(chance, event = {}) {
  if (!chance) return null;
  const categoryId = categoryFor(chance);
  const category = CATEGORY_META[categoryId];
  const rarity = rarityFor(chance);
  const tone = event.type === 'NEGATIVE_BLOCKED' ? 'blocked' : chance.isGain ? 'gain' : 'loss';
  return {
    title: chance.title,
    description: chance.desc,
    categoryId,
    category,
    rarity,
    tone,
    icon: category.icon,
    outcome: outcomeFor(chance, event),
    stars: '◆'.repeat(rarity.stars)
  };
}
