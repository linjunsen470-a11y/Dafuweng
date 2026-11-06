export const CARD_CATEGORIES = {
  ALL: { id: 'ALL', label: '全部', icon: '✦' },
  MOVEMENT: { id: 'MOVEMENT', label: '行动', icon: '🧭' },
  PROPERTY: { id: 'PROPERTY', label: '地产', icon: '🏙️' },
  ATTACK: { id: 'ATTACK', label: '干扰', icon: '⚡' },
  DEFENSE: { id: 'DEFENSE', label: '防护', icon: '🛡️' },
  MARKET: { id: 'MARKET', label: '财富', icon: '📊' },
  SUPPORT: { id: 'SUPPORT', label: '奇策', icon: '✨' },
  ITEM: { id: 'ITEM', label: '道具', icon: '🧰' }
};

export const CARD_RARITIES = {
  COMMON: { id: 'COMMON', label: '标准', rank: 1 },
  RARE: { id: 'RARE', label: '稀有', rank: 2 },
  EPIC: { id: 'EPIC', label: '史诗', rank: 3 },
  LEGENDARY: { id: 'LEGENDARY', label: '传奇', rank: 4 }
};

export const CARD_TARGET_LABELS = {
  NONE: '立即生效', PLAYER: '选择玩家', TILE: '选择道路', PROPERTY: '选择地产', STOCK: '选择股票', VALUE: '选择数值'
};

export const CARD_ART_ATLAS = '/assets/strategy-card-category-atlas-v2.png';

export const CARD_ART_SLOTS = Object.freeze({
  MOVEMENT: { className: 'card-art-movement', position: '0% 0%' },
  PROPERTY: { className: 'card-art-property', position: '50% 0%' },
  ATTACK: { className: 'card-art-attack', position: '100% 0%' },
  DEFENSE: { className: 'card-art-defense', position: '0% 100%' },
  MARKET: { className: 'card-art-market', position: '50% 100%' },
  SUPPORT: { className: 'card-art-support', position: '100% 100%' }
});

const CATEGORY_IDS = {
  MOVEMENT: ['SWAP_STOPS', 'REMOTE_DICE', 'TURN_AROUND', 'TELEPORT', 'TURTLE', 'CAR_CARD', 'SLEEPWALK'],
  PROPERTY: ['DEMOLISH', 'STEAL_LAND', 'LAND_BUY', 'SWAP_LAND', 'AUCTION_CARD'],
  ATTACK: ['OBSTACLE', 'MISSILE', 'NUKES', 'MINE', 'HIBERNATE', 'CASH_TAX'],
  DEFENSE: ['CLEANSE', 'RENT_SHIELD', 'IMMUNITY', 'IMMUNITY_CARD', 'TRANSFER_CARD', 'BANISH_GOD'],
  MARKET: ['RED_BULL', 'BEAR_CARD', 'EQUAL_WEALTH'],
  SUPPORT: ['FORTUNE_GOD', 'SUMMON_GOD', 'GIFT_CARD', 'CLEAR_ROAD']
};

const LEGENDARY_IDS = new Set(['NUKES', 'STEAL_LAND', 'CAR_CARD', 'LAND_BUY']);
const EPIC_IDS = new Set(['EQUAL_WEALTH', 'TELEPORT', 'HIBERNATE', 'SWAP_LAND', 'MISSILE', 'FORTUNE_GOD']);
const RARE_IDS = new Set(['DEMOLISH', 'RED_BULL', 'BEAR_CARD', 'TURTLE', 'RENT_SHIELD', 'CASH_TAX', 'IMMUNITY', 'SLEEPWALK', 'IMMUNITY_CARD', 'SUMMON_GOD', 'AUCTION_CARD']);

const TACTICAL_NOTES = {
  REMOTE_DICE: '精确控制落点，适合抢占空地或避开高租金区。',
  STEAL_LAND: '直接改变地产归属，优先争夺成片地段的关键拼图。',
  EQUAL_WEALTH: '落后时价值最高；领先时使用反而会资助对手。',
  RED_BULL: '持仓后再拉升，能把行情变化转化为即时收益。',
  BEAR_CARD: '适合打击对手重仓股，也可在买入前压低价格。',
  NUKES: '终局级区域压制，选择建筑密集区才能发挥最大价值。',
  RENT_SHIELD: '进入对手核心街区前使用，可锁住现金流。',
  AUCTION_CARD: '把低协同资产变现，利用竞价释放流动性。'
};

export function getCardCategory(cardId) {
  const entry = Object.entries(CATEGORY_IDS).find(([, ids]) => ids.includes(cardId));
  return CARD_CATEGORIES[entry?.[0] || 'SUPPORT'];
}

export function getCardRarity(card) {
  if (LEGENDARY_IDS.has(card.id)) return CARD_RARITIES.LEGENDARY;
  if (EPIC_IDS.has(card.id)) return CARD_RARITIES.EPIC;
  if (RARE_IDS.has(card.id) || card.cost >= 65) return CARD_RARITIES.RARE;
  return CARD_RARITIES.COMMON;
}

export function createCardPresentation(card, options = {}) {
  const category = getCardCategory(card.id);
  const rarity = getCardRarity(card);
  const art = CARD_ART_SLOTS[category.id] || CARD_ART_SLOTS.SUPPORT;
  const action = options.action || null;
  const cost = options.cost ?? card.cost;
  const points = options.points ?? Number.POSITIVE_INFINITY;
  const targetCount = action?.targets?.length || 0;
  return {
    ...card,
    cost,
    category,
    rarity,
    artAtlas: CARD_ART_ATLAS,
    artClass: art.className,
    artPosition: art.position,
    serial: `FE-${String(Math.abs([...card.id].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 100).padStart(2, '0')}`,
    rarityStars: '✦'.repeat(rarity.rank),
    targetLabel: CARD_TARGET_LABELS[card.targetType || 'NONE'] || '特殊目标',
    timing: '掷骰前使用',
    tacticalNote: TACTICAL_NOTES[card.id] || `${category.label}型策略卡，留意当前局势与目标范围后再出手。`,
    affordable: points >= cost,
    enabled: action ? Boolean(action.enabled) : true,
    disabledReason: action?.reason || '',
    targetCount,
    sellPrice: Math.round(card.cost * 0.5),
    ownedCount: options.ownedCount || 0
  };
}

export function createItemPresentation(item, options = {}) {
  const action = options.action || null;
  const cost = options.cost ?? item.cost;
  return {
    ...item,
    desc: item.description,
    cost,
    category: CARD_CATEGORIES.ITEM,
    rarity: cost === null || cost >= 100 ? CARD_RARITIES.EPIC : cost >= 50 ? CARD_RARITIES.RARE : CARD_RARITIES.COMMON,
    targetLabel: CARD_TARGET_LABELS[item.targetType || 'NONE'] || '特殊目标',
    timing: '掷骰前使用',
    tacticalNote: item.researchLevel ? `实验室科技道具 · 研究等级 ${item.researchLevel}` : '消耗型战术道具，不占用卡片栏位。',
    affordable: options.points === undefined || options.points >= cost,
    enabled: action ? Boolean(action.enabled) : true,
    disabledReason: action?.reason || '',
    targetCount: action?.targets?.length || 0,
    ownedCount: options.ownedCount || 0
  };
}

export function filterCardPresentations(entries, filterId) {
  if (!filterId || filterId === 'ALL') return entries;
  return entries.filter(entry => entry.category.id === filterId);
}
