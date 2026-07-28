/**
 * Monopoly Board Tile Types & Configuration
 * 32 Tiles around an 8x8 grid perimeter
 */

export const TileType = {
  START: 'START',
  PROPERTY: 'PROPERTY',
  CARD_SHOP: 'CARD_SHOP',
  BANK: 'BANK',
  HOSPITAL: 'HOSPITAL',
  PRISON: 'PRISON',
  STOCK: 'STOCK',
  CHANCE: 'CHANCE',
  GOD_FORTUNE: 'GOD_FORTUNE',
  GOD_MISFORTUNE: 'GOD_MISFORTUNE',
  GOD_EARTH: 'GOD_EARTH',
  GOD_BAD: 'GOD_BAD'
};

export const COLOR_GROUPS = {
  GREEN: { id: 'GREEN', name: '绿洲新区', color: '#2ed573' },
  BLUE: { id: 'BLUE', name: '海滨风情', color: '#00e5ff' },
  PURPLE: { id: 'PURPLE', name: '紫荆商业圈', color: '#a55eea' },
  GOLD: { id: 'GOLD', name: '帝国金融中心', color: '#ffaa00' }
};

export const BOARD_TILES = [
  // Bottom Row (Indices 0..8) - Right to Left
  { id: 0, type: TileType.START, name: '起点站', icon: '🚩', desc: '经过或停留领取 $2,000 丰厚金币' },
  { id: 1, type: TileType.PROPERTY, name: '绿洲 1号', group: 'GREEN', price: 1000, buildCost: 600, tolls: [150, 450, 1000, 2200] },
  { id: 2, type: TileType.CARD_SHOP, name: '卡片屋', icon: '🃏', desc: '免费获得 50 点卡片积分' },
  { id: 3, type: TileType.PROPERTY, name: '绿洲 2号', group: 'GREEN', price: 1200, buildCost: 700, tolls: [180, 500, 1200, 2500] },
  { id: 4, type: TileType.CHANCE, name: '命运卡', icon: '❓', desc: '随机抽取命运幸运/惩罚事件' },
  { id: 5, type: TileType.PROPERTY, name: '绿洲 3号', group: 'GREEN', price: 1400, buildCost: 800, tolls: [200, 600, 1400, 2800] },
  { id: 6, type: TileType.GOD_FORTUNE, name: '财神送福', icon: '🧙‍♂️', desc: '财神附体 3 回合，免过路费买地送房！' },
  { id: 7, type: TileType.PROPERTY, name: '海滨 1号', group: 'BLUE', price: 1800, buildCost: 1000, tolls: [260, 800, 1800, 3600] },
  
  // Left Column (Indices 8..16) - Bottom to Top
  { id: 8, type: TileType.PRISON, name: '帝国监狱', icon: '🚔', desc: '探监或暂停 2 回合行动' },
  { id: 9, type: TileType.PROPERTY, name: '海滨 2号', group: 'BLUE', price: 2000, buildCost: 1100, tolls: [300, 900, 2000, 4000] },
  { id: 10, type: TileType.STOCK, name: '证券交易所', icon: '📈', desc: '即刻开启股票大盘进行抄底与抛售' },
  { id: 11, type: TileType.PROPERTY, name: '海滨 3号', group: 'BLUE', price: 2200, buildCost: 1200, tolls: [340, 1000, 2200, 4500] },
  { id: 12, type: TileType.BANK, name: '中央银行', icon: '🏦', desc: '结算 10% 利息分红奖金' },
  { id: 13, type: TileType.PROPERTY, name: '紫荆 1号', group: 'PURPLE', price: 2600, buildCost: 1500, tolls: [400, 1200, 2600, 5200] },
  { id: 14, type: TileType.GOD_EARTH, name: '土地公降临', icon: '⛰️', desc: '土地公附体，强行占领所经土地！' },
  { id: 15, type: TileType.PROPERTY, name: '紫荆 2号', group: 'PURPLE', price: 2800, buildCost: 1600, tolls: [450, 1350, 2800, 5800] },

  // Top Row (Indices 16..24) - Left to Right
  { id: 16, type: TileType.HOSPITAL, name: '圣玛丽医院', icon: '🏥', desc: '休养生息 1 回合' },
  { id: 17, type: TileType.PROPERTY, name: '紫荆 3号', group: 'PURPLE', price: 3000, buildCost: 1800, tolls: [500, 1500, 3000, 6500] },
  { id: 18, type: TileType.GOD_MISFORTUNE, name: '穷神降临', icon: '👻', desc: '穷神附体 3 回合，过路费加倍加扣金币！' },
  { id: 19, type: TileType.PROPERTY, name: '金融 1号', group: 'GOLD', price: 3500, buildCost: 2000, tolls: [600, 1800, 3800, 8000] },
  { id: 20, type: TileType.CARD_SHOP, name: '高级卡片屋', icon: '🃏', desc: '免费获得 80 点卡片积分' },
  { id: 21, type: TileType.PROPERTY, name: '金融 2号', group: 'GOLD', price: 4000, buildCost: 2200, tolls: [700, 2100, 4400, 9500] },
  { id: 22, type: TileType.CHANCE, name: '命运卡', icon: '❓', desc: '随机抽取命运幸运/惩罚事件' },
  { id: 23, type: TileType.PROPERTY, name: '金融 3号', group: 'GOLD', price: 4500, buildCost: 2500, tolls: [800, 2500, 5000, 11000] },

  // Right Column (Indices 24..31) - Top to Bottom
  { id: 24, type: TileType.BANK, name: '皇家金库', icon: '💰', desc: '额外奖励 $1,500 风险补助' },
  { id: 25, type: TileType.PROPERTY, name: '帝国中心 1号', group: 'GOLD', price: 5000, buildCost: 2800, tolls: [900, 2800, 6000, 13000] },
  { id: 26, type: TileType.GOD_BAD, name: '衰神缠身', icon: '📉', desc: '衰神附体 3 回合，买地必失败，骰子步数减半！' },
  { id: 27, type: TileType.PROPERTY, name: '帝国中心 2号', group: 'GOLD', price: 5500, buildCost: 3000, tolls: [1000, 3200, 7000, 15000] },
  { id: 28, type: TileType.GOD_FORTUNE, name: '福神降临', icon: '🌟', desc: '福神附体，买地升级建房完全免费！' },
  { id: 29, type: TileType.PROPERTY, name: '帝国中心 3号', group: 'GOLD', price: 6000, buildCost: 3500, tolls: [1200, 3800, 8500, 18000] },
  { id: 30, type: TileType.STOCK, name: '证券交易所', icon: '📈', desc: '即刻开启股票大盘进行抄底与抛售' },
  { id: 31, type: TileType.CARD_SHOP, name: '精品卡卡屋', icon: '🃏', desc: '免费获得 60 点卡片积分' }
];

export const PLAYER_PROFILES = [
  {
    id: 0,
    name: '林小满',
    avatarImg: null,
    avatarAtlas: '/assets/characters-original-atlas.webp',
    avatarPosition: '0% 0%',
    avatar: '🎀',
    color: '#ff4757',
    colorHex: 0xff4757,
    skillName: '商业奇才',
    skillDesc: '买地/建房升级享受 15% 价格折扣，卡片商店购买打折。'
  },
  {
    id: 1,
    name: '顾田野',
    avatarImg: null,
    avatarAtlas: '/assets/characters-original-atlas.webp',
    avatarPosition: '50% 0%',
    avatar: '🤠',
    color: '#ffa502',
    colorHex: 0xffa502,
    skillName: '土地公庇护',
    skillDesc: '所有房产过路费多收 20%，开局额外获得 $3,000 补贴金。'
  },
  {
    id: 2,
    name: '洛晶晶',
    avatarImg: null,
    avatarAtlas: '/assets/characters-original-atlas.webp',
    avatarPosition: '100% 0%',
    avatar: '💎',
    color: '#a55eea',
    colorHex: 0xa55eea,
    skillName: '股市高手',
    skillDesc: '股票交易收益额外加成 15%，踩中敌方地产有 25% 概率免单。'
  },
  {
    id: 3,
    name: '巴洛克',
    avatarImg: null,
    avatarAtlas: '/assets/characters-original-atlas.webp',
    avatarPosition: '0% 100%',
    avatar: '👳‍♂️',
    color: '#2ed573',
    colorHex: 0x2ed573,
    skillName: '石油大亨',
    skillDesc: '使用强占/拆房等大卡片点数减半，神仙附体持续回合数+1。'
  },
  {
    id: 4,
    name: '风间岚',
    avatarImg: null,
    avatarAtlas: '/assets/characters-original-atlas.webp',
    avatarPosition: '50% 100%',
    avatar: '🥷',
    color: '#1e90ff',
    colorHex: 0x1e90ff,
    skillName: '疾风忍术',
    skillDesc: '内置 30% 概率无视前方路障拦截，卡片屋积分获取双倍。'
  },
  {
    id: 5,
    name: '米娅',
    avatarImg: null,
    avatarAtlas: '/assets/characters-original-atlas.webp',
    avatarPosition: '100% 100%',
    avatar: '🌴',
    color: '#ff7f50',
    colorHex: 0xff7f50,
    skillName: '自然之福',
    skillDesc: '踩中命运卡与随机事件时必定触发正面奖励事件。'
  }
];
