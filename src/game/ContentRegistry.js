// @ts-check

/** Central, data-driven catalogue for all production game content. */

export const GAME_MODES = [
  { id: 'STANDARD', name: '标准局', maxRounds: 40, description: '完整经济与策略规则' },
  { id: 'QUICK', name: '快速局', maxRounds: 24, description: '更高收入与更短轮次' },
  { id: 'TEAM', name: '组队战', maxRounds: 40, teams: true, description: '2 对 2 共享胜利目标' },
  { id: 'CHALLENGE', name: '领主挑战', maxRounds: 40, description: '挑战强化领主' },
  { id: 'HEAT', name: '热斗模式', maxRounds: 30, description: '卡片与道具对抗' }
];

export const BUILDINGS = [
  { id: 'PARK', name: '生态公园', icon: '🌳', maxLevel: 1, rentMultiplier: 0, buildMultiplier: 0.55, description: '不收费，使相邻地产租金提升 20%' },
  { id: 'MALL', name: '潮流商场', icon: '🛍️', maxLevel: 4, rentMultiplier: 1.35, buildMultiplier: 1.15, description: '收取较高消费费用' },
  { id: 'HOTEL', name: '云端旅馆', icon: '🏨', maxLevel: 4, rentMultiplier: 1.05, buildMultiplier: 1.1, description: '收费并令访客停留' },
  { id: 'GAS_STATION', name: '能源驿站', icon: '⛽', maxLevel: 1, rentMultiplier: 0.35, buildMultiplier: 0.7, description: '只向驾驶载具的访客收费' },
  { id: 'LAB', name: '未来研究所', icon: '🧪', maxLevel: 4, rentMultiplier: 0, buildMultiplier: 1.25, description: '研发商店中无法购买的高级道具' }
];

export const ITEMS = [
  { id: 'MOTOR', name: '风驰机车', icon: '🏍️', cost: 80, sellPrice: 40, targetType: 'NONE', description: '将载具升级为机车，最多投掷 2 颗骰子' },
  { id: 'CAR', name: '星际跑车', icon: '🏎️', cost: 150, sellPrice: 75, targetType: 'NONE', description: '将载具升级为汽车，最多投掷 3 颗骰子' },
  { id: 'ROBOT_DOLL', name: '清道机器人', icon: '🤖', cost: 20, sellPrice: 10, targetType: 'TILE', description: '清除前方道路实体' },
  { id: 'BARRIER', name: '折叠路障', icon: '🚧', cost: 30, sellPrice: 15, targetType: 'TILE', description: '放置令经过者停下的路障' },
  { id: 'MINE_ITEM', name: '震荡地雷', icon: '💣', cost: 30, sellPrice: 15, targetType: 'TILE', description: '炸伤经过者并摧毁载具' },
  { id: 'TIME_BOMB', name: '倒计时炸弹', icon: '⏱️', cost: 35, sellPrice: 18, targetType: 'TILE', description: '放置会在经济周期末爆炸的炸弹' },
  { id: 'MISSILE_ITEM', name: '战术飞弹', icon: '🚀', cost: 100, sellPrice: 50, targetType: 'TILE', description: '轰炸小范围建筑与玩家' },
  { id: 'REMOTE_DICE_ITEM', name: '导航骰子', icon: '🎯', cost: 35, sellPrice: 18, targetType: 'VALUE', description: '指定 1 至 6 步移动' },
  { id: 'ROBOT_WORKER', name: '建筑机器人', icon: '🦾', cost: null, sellPrice: 27, targetType: 'PROPERTY', researchLevel: 1, researchRounds: 1, description: '为指定地产免费升级' },
  { id: 'TIME_MACHINE', name: '时序回溯器', icon: '🕰️', cost: null, sellPrice: 36, targetType: 'NONE', researchLevel: 2, researchRounds: 2, description: '恢复自己上回合开始时的状态' },
  { id: 'TELEPORTER', name: '空间传送器', icon: '🌀', cost: null, sellPrice: 85, targetType: 'TILE', researchLevel: 3, researchRounds: 2, description: '传送到地图任意道路' },
  { id: 'ENGINEERING_CAR', name: '工程履带车', icon: '🚜', cost: null, sellPrice: 135, targetType: 'NONE', researchLevel: 4, researchRounds: 3, description: '7 回合内拆除经过的对手建筑' },
  { id: 'NUCLEAR_MISSILE', name: '聚变飞弹', icon: '☢️', cost: null, sellPrice: 225, targetType: 'TILE', researchLevel: 5, researchRounds: 4, description: '摧毁大范围建筑并使玩家住院' }
];

export const COMPANIES = [
  { id: 'AURORA_RETAIL', name: '极光百货', stockId: 'BEVERAGE', icon: '🏬', baseFee: 360, perk: 'SHOP' },
  { id: 'HARBOR_INSURANCE', name: '蓝港保险', stockId: 'HARBOR', icon: '🛟', baseFee: 300, perk: 'INSURANCE' },
  { id: 'SKY_TRANSIT', name: '天际交通', stockId: 'ENERGY', icon: '🚝', baseFee: 420, perk: 'TRANSIT' },
  { id: 'NOVA_BUILD', name: '新星营造', stockId: 'REALTY', icon: '🏗️', baseFee: 440, perk: 'BUILD' },
  { id: 'CLOUD_COMPUTE', name: '云端计算', stockId: 'TECH', icon: '💻', baseFee: 390, perk: 'TECH' },
  { id: 'SUMMIT_MATERIAL', name: '峰岳材料', stockId: 'MINING', icon: '⛏️', baseFee: 410, perk: 'MATERIAL' }
];

export const GODS = [
  { id: 'FORTUNE', name: '金运精灵', tone: 'GOOD', turns: 5, description: '减免一半租金并放大事件收入' },
  { id: 'GREAT_FORTUNE', name: '曜金精灵', tone: 'GOOD', turns: 5, description: '免除租金并获得现金' },
  { id: 'LUCK', name: '筑梦精灵', tone: 'GOOD', turns: 5, description: '购买与升级获得额外建设' },
  { id: 'EARTH', name: '拓土精灵', tone: 'GOOD', turns: 4, description: '占领经过的无主地产' },
  { id: 'MISFORTUNE', name: '漏财精灵', tone: 'BAD', turns: 5, description: '周期扣款并增加租金' },
  { id: 'BAD', name: '失意精灵', tone: 'BAD', turns: 5, description: '投资可能失败且移动减半' },
  { id: 'ANGEL', name: '繁荣精灵', tone: 'GOOD', turns: 5, description: '升级经过的建筑' },
  { id: 'DEMON', name: '荒芜精灵', tone: 'BAD', turns: 5, description: '拆除经过的建筑' }
];

export const MAGIC_CONDITIONS = [
  ['SELF', '自己'], ['RICH_CASH', '现金最多的人'], ['POOR_CASH', '现金最少的人'],
  ['RICH_ASSET', '总资产最多的人'], ['MOST_LAND', '地产最多的人'], ['MOST_DEPOSIT', '存款最多的人'],
  ['HAS_VEHICLE', '驾驶载具的人'], ['ON_FOOT', '步行的人'], ['HAS_GOD', '被精灵附身的人'], ['ALL_OPPONENTS', '所有对手']
].map(([id, name]) => ({ id, name }));

export const MAGIC_EFFECTS = [
  ['CASH_RAIN', '每人获得现金'], ['PROPERTY_BOOM', '自己的建筑升级'], ['GOD_SHUFFLE', '交换精灵'],
  ['DEPOSIT_ALL', '存入全部现金'], ['GAIN_CARD', '获得策略卡'], ['GAIN_ITEM', '获得道具'],
  ['STOP_ONE', '停留一回合'], ['HOSPITAL', '住院检查'], ['DEMOLISH_ONE', '拆除建筑'], ['TURN_AROUND', '改变方向']
].map(([id, name]) => ({ id, name }));

export const MINIGAMES = [
  { id: 'HARBOR_SORT', name: '港湾分拣', icon: '📦', maxScore: 100, rewardPerPoint: 2 },
  { id: 'SKY_COINS', name: '云端金币', icon: '🪙', maxScore: 100, rewardPerPoint: 2 },
  { id: 'ROUTE_MEMORY', name: '航线记忆', icon: '🧭', maxScore: 100, rewardPerPoint: 2 }
];

class ContentRegistry {
  constructor() {
    /** @type {Map<string, Array<{ id: string, [key: string]: any }>>} */
    this.catalogues = new Map();
  }

  /** @param {string} name @param {Array<{ id: string, [key: string]: any }>} values */
  register(name, values) {
    this.catalogues.set(name, values);
    return this;
  }

  /** @param {string} name */
  getAll(name) {
    return this.catalogues.get(name) || [];
  }

  /** @param {string} name @param {string} id */
  get(name, id) {
    return this.getAll(name).find(value => value.id === id) || null;
  }
}

export const contentRegistry = new ContentRegistry()
  .register('modes', GAME_MODES)
  .register('buildings', BUILDINGS)
  .register('items', ITEMS)
  .register('companies', COMPANIES)
  .register('gods', GODS)
  .register('magicConditions', MAGIC_CONDITIONS)
  .register('magicEffects', MAGIC_EFFECTS)
  .register('minigames', MINIGAMES);
