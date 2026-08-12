import { captureNewsMetrics, getNewsPresentation, summarizeNewsImpact } from './NewsRules.js';

/**
 * Random Events & God Attachment Manager
 */

const RAW_NEWS_EVENTS = [
  {
    title: '房地产市场火爆',
    desc: '全城所有商业与住宅地产过路费临时翻倍！',
    effect: (gameState) => {
      gameState.newsEffect = { id: 'DOUBLE_RENT', remainingRounds: 1 };
    }
  },
  {
    title: '中央银行降息利好',
    desc: '所有未破产玩家获得银行发放的 $1,000 补贴！',
    effect: (gameState) => {
      gameState.players.forEach(p => {
        if (!p.isBankrupt) p.cash += 1000;
      });
    }
  },
  {
    title: '股市强劲牛市降临',
    desc: '大盘所有股票大涨 +10%！',
    effect: (gameState) => {
      gameState.stockMarket.stocks.forEach(s => {
        s.price = Math.round(s.price * 1.10);
      });
    }
  },
  {
    title: '暴风雨突袭市中心',
    desc: '全市所有玩家停留地段需支付 $300 房屋维修费！',
    effect: (gameState) => {
      gameState.players.forEach(p => {
        if (!p.isBankrupt && p.cash >= 300) p.cash -= 300;
      });
    }
  },
  {
    title: '城市消费节',
    desc: '每位玩家获得 $600 消费券。',
    effect: (gameState) => gameState.players.filter(p => !p.isBankrupt).forEach(p => p.cash += 600)
  },
  {
    title: '能源价格回落',
    desc: '能源股票下跌 10%。',
    effect: (gameState) => gameState.stockMarket.forceStockSurge('ENERGY', false)
  },
  {
    title: '科技新品发布',
    desc: '科技股票上涨 10%。',
    effect: (gameState) => gameState.stockMarket.forceStockSurge('TECH', true)
  },
  {
    title: '旧城改造计划',
    desc: '地产股票上涨 10%。',
    effect: (gameState) => gameState.stockMarket.forceStockSurge('REALTY', true)
  },
  {
    title: '全民出行周',
    desc: '每位玩家获得 30 卡片积分。',
    effect: (gameState) => gameState.players.filter(p => !p.isBankrupt).forEach(p => p.cardPoints += 30)
  },
  {
    title: '保险理赔到账',
    desc: '现金最少的玩家获得 $1,500。',
    effect: (gameState) => {
      const player = [...gameState.players].filter(p => !p.isBankrupt).sort((a, b) => a.cash - b.cash)[0];
      if (player) player.cash += 1500;
    }
  },
  {
    title: '奢侈品热潮',
    desc: '现金最多的玩家支付 $900 城市发展金。',
    effect: (gameState) => {
      const player = [...gameState.players].filter(p => !p.isBankrupt).sort((a, b) => b.cash - a.cash)[0];
      if (player) player.cash -= Math.min(900, player.cash);
    }
  },
  {
    title: '创业扶持计划',
    desc: '所有玩家获得 50 卡片积分。',
    effect: (gameState) => gameState.players.filter(p => !p.isBankrupt).forEach(p => p.cardPoints += 50)
  },
  {
    title: '城市更新基金', desc: '每位地产持有者获得每处地产 $180 补助。', effect: gameState => {
      gameState.players.forEach(player => {
        const count = [...gameState.propertyManager.properties.values()].filter(property => property.owner === player.id).length;
        player.cash += count * 180;
      });
    }
  },
  {
    title: '道路安全整治', desc: '所有路障与地雷被清除。', effect: gameState => {
      gameState.roadEntities = gameState.roadEntities.filter(entity => !['BARRIER', 'MINE'].includes(entity.type));
      gameState.propertyManager.properties.forEach(property => { property.hasObstacle = false; property.hasMine = false; });
    }
  },
  {
    title: '研发补贴周', desc: '所有研发任务加速一轮。', effect: gameState => gameState.researchTasks.forEach(task => { task.roundsRemaining--; })
  },
  {
    title: '汽车消费热潮', desc: '交通与能源公司股价上涨。', effect: gameState => {
      gameState.stockMarket.forceStockSurge('ENERGY', true);
      gameState.stockMarket.forceStockSurge('HARBOR', true);
    }
  },
  {
    title: '建筑材料紧缺', desc: '材料股上涨，地产租金本轮翻倍。', effect: gameState => {
      gameState.stockMarket.forceStockSurge('MINING', true);
      gameState.newsEffect = { id: 'DOUBLE_RENT', remainingRounds: 1 };
    }
  },
  {
    title: '普惠储蓄奖励', desc: '所有存款账户获得 2% 奖励。', effect: gameState => gameState.players.forEach(player => { player.deposit += Math.round((player.deposit || 0) * 0.02); })
  },
  {
    title: '百货购物季', desc: '极光百货获得 $1,500 营收。', effect: gameState => gameState.companyManager.recordRevenue('AURORA_RETAIL', 1500)
  },
  {
    title: '保险理赔潮', desc: '蓝港保险支出增加。', effect: gameState => {
      const company = gameState.companyManager.get('HARBOR_INSURANCE');
      if (company) company.treasury = Math.max(0, company.treasury - 900);
    }
  },
  {
    title: '公共交通日', desc: '步行玩家获得 60 点券。', effect: gameState => gameState.players.filter(player => player.vehicle === 'WALK').forEach(player => { player.cardPoints += 60; })
  },
  {
    title: '神秘礼箱投放', desc: '地图出现新的道具礼箱。', effect: gameState => {
      const tile = gameState.rng.pick(gameState.mapDefinition.tiles);
      if (tile) gameState.roadEntities.push({ id: `NEWS_GIFT_${gameState.round}`, type: 'GIFT_BOX', tileId: tile.id, ownerId: null, expiresRound: gameState.round + 6 });
    }
  },
  {
    title: '地产税调整', desc: '总资产最高的玩家缴纳 $1,200。', effect: gameState => {
      const player = gameState.getRankings()[0]?.player;
      if (player) player.cash -= Math.min(1200, player.cash);
    }
  },
  {
    title: '创新企业分红', desc: '云端计算获得额外营收。', effect: gameState => gameState.companyManager.recordRevenue('CLOUD_COMPUTE', 1200)
  }
];

export const NEWS_EVENTS = RAW_NEWS_EVENTS.map((event, index) => ({
  ...getNewsPresentation(event, index),
  ...event
}));

export const CHANCE_CARDS = [
  { title: '中头彩大奖', desc: '恭喜！买彩票中得一等奖金', amount: 2000, isGain: true },
  { title: '股票红利分配', desc: '持仓企业派发现金股息', amount: 1200, isGain: true },
  { title: '捡到钱包', desc: '在马路边捡到失主充公钱包', amount: 800, isGain: true },
  { title: '超速罚单', desc: '在市区开车超速被交通警察罚款', amount: 500, isGain: false },
  { title: '补缴个人所得税', desc: '税务局通知补缴上季度所得税', amount: 1000, isGain: false },
  { title: '招待贵宾', desc: '在五星级饭店请客吃饭消费', amount: 600, isGain: false }
  ,{ title: '创意比赛获奖', desc: '城市创意赛奖金到账', amount: 1500, isGain: true }
  ,{ title: '旧物拍卖', desc: '收藏品拍出好价钱', amount: 900, isGain: true }
  ,{ title: '社区建设委托', desc: '商业联合会邀请你巡访城市地标', kind: 'QUEST', questId: 'LANDMARK_ROUTE', isGain: true }
  ,{ title: '环城观光委托', desc: '城市观光局邀请你完成一轮环城巡礼', kind: 'QUEST', questId: 'CITY_TOUR', isGain: true }
  ,{ title: '应用分红', desc: '参与投资的应用开始分红', amount: 1800, isGain: true }
  ,{ title: '节能奖励', desc: '获得绿色生活补助', amount: 650, isGain: true }
  ,{ title: '城市建设委托', desc: '城市开发署征集地产建设合伙人', kind: 'QUEST', questId: 'PROPERTY_INVESTOR', isGain: true }
  ,{ title: '保险返还', desc: '年度保险返还到账', amount: 750, isGain: true }
  ,{ title: '设备维修', desc: '随身设备意外损坏', amount: 450, isGain: false }
  ,{ title: '行李超重', desc: '支付额外托运费用', amount: 350, isGain: false }
  ,{ title: '房屋维护', desc: '进行例行房屋检修', amount: 800, isGain: false }
  ,{ title: '停车罚款', desc: '车辆停在了限制区域', amount: 400, isGain: false }
  ,{ title: '订阅续费', desc: '多个年度服务同时续费', amount: 550, isGain: false }
  ,{ title: '健康体检', desc: '支付全面体检费用', amount: 700, isGain: false }
  ,{ title: '公益捐款', desc: '参与城市公益项目', amount: 900, isGain: false }
  ,{ title: '装修超支', desc: '材料价格临时上涨', amount: 1300, isGain: false }
  ,{ title: '幸运返现', desc: '消费活动抽中返现', amount: 1000, isGain: true }
  ,{ title: '策略公会委托', desc: '卡片公会邀请你参加实战策略演习', kind: 'QUEST', questId: 'CARD_TACTIC', isGain: true }
  ,{ title: '点券大奖', desc: '获得卡片与道具消费点券', kind: 'CARD_POINTS', amount: 120, isGain: true }
  ,{ title: '公益积分', desc: '社区服务获得点券', kind: 'CARD_POINTS', amount: 80, isGain: true }
  ,{ title: '积分遗失', desc: '电子钱包故障丢失点券', kind: 'CARD_POINTS', amount: 60, isGain: false }
  ,{ title: '竞赛入场费', desc: '支付活动点券', kind: 'CARD_POINTS', amount: 40, isGain: false }
  ,{ title: '神秘工具箱', desc: '获得一件可购买道具', kind: 'ITEM', amount: 1, isGain: true }
  ,{ title: '研发样机赠送', desc: '获得一件研究道具', kind: 'RESEARCH_ITEM', amount: 1, isGain: true }
  ,{ title: '背包破损', desc: '随机遗失一件道具', kind: 'ITEM_LOSS', amount: 1, isGain: false }
  ,{ title: '策略资料包', desc: '随机获得一张策略卡', kind: 'CARD', amount: 1, isGain: true }
  ,{ title: '共享机车体验', desc: '本轮起驾驶机车', kind: 'VEHICLE', vehicle: 'MOTOR', isGain: true }
  ,{ title: '幸运跑车试驾', desc: '本轮起驾驶汽车', kind: 'VEHICLE', vehicle: 'CAR', isGain: true }
  ,{ title: '载具检修', desc: '载具损坏恢复步行', kind: 'VEHICLE', vehicle: 'WALK', isGain: false }
  ,{ title: '交通事故', desc: '载具损坏并住院', kind: 'HOSPITAL', amount: 2, isGain: false }
  ,{ title: '城市荣誉', desc: '获得三轮负面免疫', kind: 'IMMUNITY', amount: 3, isGain: true }
  ,{ title: '道路施工', desc: '前方道路出现路障', kind: 'ROAD_BARRIER', amount: 1, isGain: false }
  ,{ title: '科技企业利好', desc: '科技股票涨停', kind: 'STOCK', stockId: 'TECH', isGain: true }
  ,{ title: '地产行业调整', desc: '地产股票跌停', kind: 'STOCK', stockId: 'REALTY', isGain: false }
  ,{ title: '百货会员返利', desc: '极光百货发放返利', kind: 'COMPANY', companyId: 'AURORA_RETAIL', amount: 700, isGain: true }
  ,{ title: '保险自付费用', desc: '蓝港保险收取费用', kind: 'COMPANY', companyId: 'HARBOR_INSURANCE', amount: 500, isGain: false }
  ,{ title: '住房翻新券', desc: '随机升级自己的建筑', kind: 'PROPERTY_UP', amount: 1, isGain: true }
  ,{ title: '风暴损坏', desc: '随机建筑降低一级', kind: 'PROPERTY_DOWN', amount: 1, isGain: false }
  ,{ title: '乐透赠票', desc: '随机获得一张乐透券', kind: 'LOTTERY', amount: 1, isGain: true }
  ,{ title: '储蓄奖励', desc: '存款获得额外收益', kind: 'DEPOSIT', amount: 600, isGain: true }
  ,{ title: '账户管理费', desc: '从存款扣除费用', kind: 'DEPOSIT', amount: 400, isGain: false }
  ,{ title: '精灵祝福', desc: '随机获得一位正面精灵', kind: 'GOD', amount: 3, isGain: true }
];

export class EventManager {
  constructor() {
    this.random = Math.random;
  }

  setRandomSource(random) {
    this.random = random || Math.random;
  }

  triggerRandomNews(gameState) {
    if (this.random() < 0.35) {
      const news = NEWS_EVENTS[Math.floor(this.random() * NEWS_EVENTS.length)];
      const before = captureNewsMetrics(gameState);
      news.effect(gameState);
      const after = captureNewsMetrics(gameState);
      return { ...news, impacts: summarizeNewsImpact(before, after) };
    }
    return null;
  }

  drawChanceCard() {
    return CHANCE_CARDS[Math.floor(this.random() * CHANCE_CARDS.length)];
  }
}
