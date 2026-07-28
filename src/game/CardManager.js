/**
 * Monopoly Item Card System
 */

export const CARDS = [
  {
    id: 'REMOTE_DICE',
    name: '遥控骰子',
    icon: '🎯',
    cardImg: '/assets/card_remote_dice.jpg',
    cost: 45,
    targetType: 'NONE',
    desc: '自由指定本回合前进步数 (1~6 步)'
  },
  {
    id: 'OBSTACLE',
    name: '路障卡',
    icon: '🚧',
    cardImg: '/assets/card_obstacle.jpg',
    cost: 40,
    targetType: 'TILE',
    desc: '在前方任意 10 格内放置路障，经过者强制停下'
  },
  {
    id: 'TURN_AROUND',
    name: '转向卡',
    icon: '🔄',
    cost: 30,
    targetType: 'PLAYER',
    desc: '掉转自己或敌人的行走方向（顺时针/逆时针）'
  },
  {
    id: 'DEMOLISH',
    name: '拆房卡',
    icon: '💣',
    cost: 60,
    targetType: 'PROPERTY',
    desc: '强行拆除敌人指定土地上的房屋 1 层'
  },
  {
    id: 'EQUAL_WEALTH',
    name: '均富卡',
    icon: '⚖️',
    cost: 85,
    targetType: 'NONE',
    desc: '将场上所有未破产玩家的现金汇总后重新均分'
  },
  {
    id: 'STEAL_LAND',
    name: '强占卡',
    icon: '🚩',
    cost: 95,
    targetType: 'PROPERTY',
    desc: '强行抢占你当前停留的他人房屋为己有！'
  },
  {
    id: 'RED_BULL',
    name: '红霸卡',
    icon: '📈',
    cost: 50,
    targetType: 'STOCK',
    desc: '指定某支股票强行拉升涨停 +10%'
  },
  {
    id: 'FORTUNE_GOD',
    name: '福神卡',
    icon: '🌟',
    cost: 75,
    targetType: 'NONE',
    desc: '召唤福神附体 3 回合，建房升级完全免费'
  },
  {
    id: 'TURTLE',
    name: '乌龟卡',
    icon: '🐢',
    cost: 55,
    targetType: 'PLAYER',
    desc: '使用后目标玩家连续 3 回合每轮只能移动 1 步'
  },
  {
    id: 'CAR_CARD',
    name: '汽车卡',
    icon: '🏎️',
    cost: 100,
    targetType: 'NONE',
    desc: '获得豪华赛车载具，投掷骰子上限提升至 3 颗！'
  },
  {
    id: 'CLEANSE',
    name: '净化卡',
    icon: '✨',
    cost: 45,
    targetType: 'NONE',
    desc: '清除自己的迟缓、破财与衰运效果'
  },
  {
    id: 'RENT_SHIELD',
    name: '护租卡',
    icon: '🛡️',
    cost: 55,
    targetType: 'NONE',
    desc: '未来 2 回合免除敌方地产过路费'
  },
  {
    id: 'CASH_TAX',
    name: '消费税卡',
    icon: '🧾',
    cost: 65,
    targetType: 'PLAYER',
    desc: '令目标支付当前现金的 12%，最多 $2,500'
  },
  {
    id: 'TELEPORT',
    name: '跃迁卡',
    icon: '🌀',
    cost: 80,
    targetType: 'TILE',
    desc: '移动到前方 2~10 格中的指定位置并结算落点'
  },
  {
    id: 'CLEAR_ROAD',
    name: '清障卡',
    icon: '🚜',
    cost: 30,
    targetType: 'TILE',
    desc: '移除地图上的一个路障'
  },
  {
    id: 'BEAR_CARD',
    name: '绿熊卡',
    icon: '📉',
    cost: 50,
    targetType: 'STOCK',
    desc: '令指定股票立即下跌 10%'
  },
  {
    id: 'IMMUNITY',
    name: '好运护符',
    icon: '🍀',
    cost: 70,
    targetType: 'NONE',
    desc: '未来 3 回合免疫负面运势与现金惩罚'
  },
  {
    id: 'GIFT_CARD',
    name: '交换礼券',
    icon: '🎁',
    cost: 40,
    targetType: 'PLAYER',
    desc: '与目标各随机交换一张卡片'
  }
];

export class CardManager {
  constructor() {
    this.cardsMap = new Map(CARDS.map(c => [c.id, c]));
  }

  getCardById(cardId) {
    return this.cardsMap.get(cardId);
  }

  getAllCards() {
    return CARDS;
  }
}

export const cardManager = new CardManager();
