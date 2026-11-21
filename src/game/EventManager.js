import { captureNewsMetrics, getNewsPresentation, summarizeNewsImpact } from './NewsRules.js';

/**
 * Random Events & God Attachment Manager
 */

const RAW_NEWS_EVENTS = [
  {
    title: '全城房价疯涨，房东笑出猪叫！',
    desc: '本轮全城商业与住宅地产过路费临时翻倍，路过豪宅请自备速效救心丸！',
    effect: (gameState) => {
      gameState.newsEffect = { id: 'DOUBLE_RENT', remainingRounds: 1 };
    }
  },
  {
    title: '中央银行降息利好',
    desc: '银行行长今天喜得贵子心情大好，给每位未破产玩家狂发 $1,000 现金红包！',
    effect: (gameState) => {
      gameState.players.forEach(p => {
        if (!p.isBankrupt) p.cash += 1000;
      });
    }
  },
  {
    title: '股神喝醉按错键，大盘全线暴涨！',
    desc: '交易所锣鼓喧天，全场所有股票齐刷刷拉升 +10%，股民集体欢呼！',
    effect: (gameState) => {
      gameState.stockMarket.stocks.forEach(s => {
        s.price = Math.round(s.price * 1.10);
      });
    }
  },
  {
    title: '大台风突袭市中心，吹飞半条街屋顶！',
    desc: '全员紧急修房补瓦，每人自掏腰包支付 $300 房屋维修费！',
    effect: (gameState) => {
      gameState.players.forEach(p => {
        if (!p.isBankrupt && p.cash >= 300) p.cash -= 300;
      });
    }
  },
  {
    title: '街头夜市大狂欢，市长请客发补贴！',
    desc: '每位玩家喜提 $600 夜市消费现金，买串烧还是买地随你挑！',
    effect: (gameState) => gameState.players.filter(p => !p.isBankrupt).forEach(p => p.cash += 600)
  },
  {
    title: '油田漏勺闹乌龙，能源股大跳水！',
    desc: '能源股票应声下跌 10%，抄底还是逃命全凭直觉！',
    effect: (gameState) => gameState.stockMarket.forceStockSurge('ENERGY', false)
  },
  {
    title: '黑科技发布会刷屏，科技股一飞冲天！',
    desc: '新款折叠火箭手机卖断货，科技股票劲涨 10%！',
    effect: (gameState) => gameState.stockMarket.forceStockSurge('TECH', true)
  },
  {
    title: '老街爆改网红打卡点，地产股暴走！',
    desc: '游客挤爆整条商业街，地产股票应声上涨 10%！',
    effect: (gameState) => gameState.stockMarket.forceStockSurge('REALTY', true)
  },
  {
    title: '绿色出行大抽奖，人手领点券！',
    desc: '公交车长沿街发福利，每位玩家免费获赠 30 卡片点券！',
    effect: (gameState) => gameState.players.filter(p => !p.isBankrupt).forEach(p => p.cardPoints += 30)
  },
  {
    title: '天降精准扶贫，最穷玩家喜提救济金！',
    desc: '热心市民打赏街头最落魄的富翁，现金最少者喜获 $1,500 救命钱！',
    effect: (gameState) => {
      const player = [...gameState.players].filter(p => !p.isBankrupt).sort((a, b) => a.cash - b.cash)[0];
      if (player) player.cash += 1500;
    }
  },
  {
    title: '税务局盯上首富！突击征收奢侈税！',
    desc: '现金最多的土豪被请去喝茶，乖乖缴纳 $900 城市发展金！',
    effect: (gameState) => {
      const player = [...gameState.players].filter(p => !p.isBankrupt).sort((a, b) => b.cash - a.cash)[0];
      if (player) player.cash -= Math.min(900, player.cash);
    }
  },
  {
    title: '卡片屋周年庆，点券像雪花一样飘！',
    desc: '全城所有玩家直接白嫖 50 卡片点券，赶紧去抢飞弹卡吧！',
    effect: (gameState) => gameState.players.filter(p => !p.isBankrupt).forEach(p => p.cardPoints += 50)
  },
  {
    title: '地主老爷大丰收，每块地都有红包！',
    desc: '城市翻新发奖金，按名下地产数量每处发放 $180 补贴！',
    effect: gameState => {
      gameState.players.forEach(player => {
        const count = [...gameState.propertyManager.properties.values()].filter(property => property.owner === player.id).length;
        player.cash += count * 180;
      });
    }
  },
  {
    title: '城管大队连夜扫街，路障地雷全清零！',
    desc: '谁埋的陷阱白费功夫啦！全图所有路障与地雷被一扫而空！',
    effect: gameState => {
      gameState.roadEntities = gameState.roadEntities.filter(entity => !['BARRIER', 'MINE'].includes(entity.type));
      gameState.propertyManager.properties.forEach(property => { property.hasObstacle = false; property.hasMine = false; });
    }
  },
  {
    title: '科学家喝完十杯咖啡，研发集体提速！',
    desc: '研究所通宵达旦，全场所有研发任务进度白白加速 1 轮！',
    effect: gameState => gameState.researchTasks.forEach(task => { task.roundsRemaining--; })
  },
  {
    title: '全民抢购敞篷跑车，交通能源齐飞！',
    desc: '马路上豪车堵成停车场，能源与港口股双双暴涨！',
    effect: gameState => {
      gameState.stockMarket.forceStockSurge('ENERGY', true);
      gameState.stockMarket.forceStockSurge('HARBOR', true);
    }
  },
  {
    title: '水泥砖头一夜断货，房租跟着翻倍涨！',
    desc: '材料股猛涨，全城地产过路费本轮临时翻倍，地主乐开花！',
    effect: gameState => {
      gameState.stockMarket.forceStockSurge('MINING', true);
      gameState.newsEffect = { id: 'DOUBLE_RENT', remainingRounds: 1 };
    }
  },
  {
    title: '银行存款加码送礼，存钱党躺赢！',
    desc: '银行感恩回馈，所有玩家定期存款立刻多拿 2% 额外利息！',
    effect: gameState => gameState.players.forEach(player => { player.deposit += Math.round((player.deposit || 0) * 0.02); })
  },
  {
    title: '大妈抢购团横扫极光百货！',
    desc: '货架瞬间被抢空，极光百货喜提 $1,500 爆单营收！',
    effect: gameState => gameState.companyManager.recordRevenue('AURORA_RETAIL', 1500)
  },
  {
    title: '连环追尾理赔潮，保险公司哭晕在厕所！',
    desc: '蓝港保险紧急赔付，公司金库无奈大出血 $900！',
    effect: gameState => {
      const company = gameState.companyManager.get('HARBOR_INSURANCE');
      if (company) company.treasury = Math.max(0, company.treasury - 900);
    }
  },
  {
    title: '环保步行嘉年华，走路党喜提福利！',
    desc: '没买车的步行玩家不用羡慕豪车，每人奖励 60 卡片点券！',
    effect: gameState => gameState.players.filter(player => player.vehicle === 'WALK').forEach(player => { player.cardPoints += 60; })
  },
  {
    title: '快递飞艇手滑掉包！神秘礼箱空降街头！',
    desc: '地图某处掉下一个闪闪发光的神秘道具礼箱，先踩先得！',
    effect: gameState => {
      const tile = gameState.rng.pick(gameState.mapDefinition.tiles);
      if (tile) gameState.roadEntities.push({ id: `NEWS_GIFT_${gameState.round}`, type: 'GIFT_BOX', tileId: tile.id, ownerId: null, expiresRound: gameState.round + 6 });
    }
  },
  {
    title: '地产大王被查税！榜一大佬惨遭放血！',
    desc: '总资产排名第一的头号富豪被重点关照，现场缴纳 $1,200 豪富税！',
    effect: gameState => {
      const player = gameState.getRankings()[0]?.player;
      if (player) player.cash -= Math.min(1200, player.cash);
    }
  },
  {
    title: '爆款小游戏出圈，云端计算赚翻天！',
    desc: '服务器挤爆顺便大赚一笔，云端计算入账 $1,200 营收！',
    effect: gameState => gameState.companyManager.recordRevenue('CLOUD_COMPUTE', 1200)
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
