/**
 * Random Events & God Attachment Manager
 */

export const NEWS_EVENTS = [
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
  }
];

export const CHANCE_CARDS = [
  { title: '中头彩大奖', desc: '恭喜！买彩票中得一等奖金', amount: 2000, isGain: true },
  { title: '股票红利分配', desc: '持仓企业派发现金股息', amount: 1200, isGain: true },
  { title: '捡到钱包', desc: '在马路边捡到失主充公钱包', amount: 800, isGain: true },
  { title: '超速罚单', desc: '在市区开车超速被交通警察罚款', amount: 500, isGain: false },
  { title: '补缴个人所得税', desc: '税务局通知补缴上季度所得税', amount: 1000, isGain: false },
  { title: '招待贵宾', desc: '在五星级饭店请客吃饭消费', amount: 600, isGain: false }
  ,{ title: '创意比赛获奖', desc: '城市创意赛奖金到账', amount: 1500, isGain: true }
  ,{ title: '旧物拍卖', desc: '收藏品拍出好价钱', amount: 900, isGain: true }
  ,{ title: '社区贡献奖', desc: '获得社区建设奖励', amount: 700, isGain: true }
  ,{ title: '旅行退款', desc: '延误补偿款到账', amount: 500, isGain: true }
  ,{ title: '应用分红', desc: '参与投资的应用开始分红', amount: 1800, isGain: true }
  ,{ title: '节能奖励', desc: '获得绿色生活补助', amount: 650, isGain: true }
  ,{ title: '临时顾问', desc: '完成商业咨询项目', amount: 1100, isGain: true }
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
  ,{ title: '技能培训', desc: '报名城市高级研修班', amount: 1000, isGain: false }
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
      news.effect(gameState);
      return news;
    }
    return null;
  }

  drawChanceCard() {
    return CHANCE_CARDS[Math.floor(this.random() * CHANCE_CARDS.length)];
  }
}
