/**
 * Monopoly Item Card System
 */

export const CARDS = [
  {
    id: 'REMOTE_DICE',
    name: '遥控骰子',
    icon: '🎯',
    cardImg: '/assets/card_remote_dice.svg',
    cost: 45,
    targetType: 'NONE',
    desc: '自由指定本回合前进步数 (1~6 步)'
  },
  {
    id: 'OBSTACLE',
    name: '路障卡',
    icon: '🚧',
    cardImg: '/assets/card_obstacle.svg',
    cost: 40,
    targetType: 'TILE',
    desc: '在前方任意 10 格内放置路障，经过者强制停下'
  },
  {
    id: 'TURN_AROUND',
    name: '转向卡',
    icon: '🔄',
    cardImg: '/assets/card_turn_around.svg',
    cost: 30,
    targetType: 'PLAYER',
    desc: '掉转自己或敌人的行走方向（顺时针/逆时针）'
  },
  {
    id: 'DEMOLISH',
    name: '拆房卡',
    icon: '💣',
    cardImg: '/assets/card_demolish.svg',
    cost: 60,
    targetType: 'PROPERTY',
    desc: '强行拆除敌人指定土地上的房屋 1 层'
  },
  {
    id: 'EQUAL_WEALTH',
    name: '均富卡',
    icon: '⚖️',
    cardImg: '/assets/card_equal_wealth.svg',
    cost: 85,
    targetType: 'NONE',
    desc: '将场上所有未破产玩家的现金汇总后重新均分'
  },
  {
    id: 'STEAL_LAND',
    name: '强占卡',
    icon: '🚩',
    cardImg: '/assets/card_steal_land.svg',
    cost: 95,
    targetType: 'PROPERTY',
    desc: '强行抢占你当前停留的他人房屋为己有！'
  },
  {
    id: 'RED_BULL',
    name: '红霸卡',
    icon: '📈',
    cardImg: '/assets/card_red_bull.svg',
    cost: 50,
    targetType: 'STOCK',
    desc: '指定某支股票强行拉升涨停 +10%'
  },
  {
    id: 'FORTUNE_GOD',
    name: '福神卡',
    icon: '🌟',
    cardImg: '/assets/card_fortune_god.svg',
    cost: 75,
    targetType: 'NONE',
    desc: '召唤福神附体 3 回合，建房升级完全免费'
  },
  {
    id: 'TURTLE',
    name: '乌龟卡',
    icon: '🐢',
    cardImg: '/assets/card_turtle.svg',
    cost: 55,
    targetType: 'PLAYER',
    desc: '使用后目标玩家连续 3 回合每轮只能移动 1 步'
  },
  {
    id: 'CAR_CARD',
    name: '汽车卡',
    icon: '🏎️',
    cardImg: '/assets/card_car_card.svg',
    cost: 100,
    targetType: 'NONE',
    desc: '获得豪华赛车载具，投掷骰子上限提升至 3 颗！'
  },
  {
    id: 'CLEANSE',
    name: '净化卡',
    icon: '✨',
    cardImg: '/assets/card_cleanse.svg',
    cost: 45,
    targetType: 'NONE',
    desc: '清除自己的迟缓、破财与衰运效果'
  },
  {
    id: 'RENT_SHIELD',
    name: '护租卡',
    icon: '🛡️',
    cardImg: '/assets/card_rent_shield.svg',
    cost: 55,
    targetType: 'NONE',
    desc: '未来 2 回合免除敌方地产过路费'
  },
  {
    id: 'CASH_TAX',
    name: '消费税卡',
    icon: '🧾',
    cardImg: '/assets/card_cash_tax.svg',
    cost: 65,
    targetType: 'PLAYER',
    desc: '令目标支付当前现金的 12%，最多 $2,500'
  },
  {
    id: 'TELEPORT',
    name: '跃迁卡',
    icon: '🌀',
    cardImg: '/assets/card_teleport.svg',
    cost: 80,
    targetType: 'TILE',
    desc: '移动到前方 2~10 格中的指定位置并结算落点'
  },
  {
    id: 'CLEAR_ROAD',
    name: '清障卡',
    icon: '🚜',
    cardImg: '/assets/card_clear_road.svg',
    cost: 30,
    targetType: 'TILE',
    desc: '移除地图上的一个路障'
  },
  {
    id: 'BEAR_CARD',
    name: '绿熊卡',
    icon: '📉',
    cardImg: '/assets/card_bear_card.svg',
    cost: 50,
    targetType: 'STOCK',
    desc: '令指定股票立即下跌 10%'
  },
  {
    id: 'IMMUNITY',
    name: '好运护符',
    icon: '🍀',
    cardImg: '/assets/card_immunity.svg',
    cost: 70,
    targetType: 'NONE',
    desc: '未来 3 回合免疫负面运势与现金惩罚'
  },
  {
    id: 'GIFT_CARD',
    name: '交换礼券',
    icon: '🎁',
    cardImg: '/assets/card_gift_card.svg',
    cost: 40,
    targetType: 'PLAYER',
    desc: '与目标各随机交换一张卡片'
  },
  {
    id: 'MISSILE',
    name: '飞弹卡',
    icon: '🚀',
    cardImg: '/assets/card_missile.svg',
    cost: 75,
    targetType: 'TILE',
    desc: '轰炸指定格周边 3x3 区域，建筑物降低 1 层，人员炸伤住院 3 天'
  },
  {
    id: 'NUKES',
    name: '核弹卡',
    icon: '☢️',
    cardImg: '/assets/card_nukes.svg',
    cost: 120,
    targetType: 'TILE',
    desc: '毁灭性打击！轰炸指定格周围建筑全变为空地，人员住院 5 天'
  },
  {
    id: 'MINE',
    name: '地雷卡',
    icon: '💣',
    cardImg: '/assets/card_mine.svg',
    cost: 50,
    targetType: 'TILE',
    desc: '在前方任意 10 格放置隐藏地雷，踩中者炸伤住院 3 天'
  },
  {
    id: 'HIBERNATE',
    name: '冬眠卡',
    icon: '❄️',
    cardImg: '/assets/card_hibernate.svg',
    cost: 85,
    targetType: 'NONE',
    desc: '令所有对手集体冬眠陷入沉睡 3 回合无法行动'
  },
  {
    id: 'SLEEPWALK',
    name: '梦游卡',
    icon: '🌙',
    cardImg: '/assets/card_sleepwalk.svg',
    cost: 60,
    targetType: 'PLAYER',
    desc: '令目标陷入梦游 3 回合，期间免付过路费但随机移动'
  },
  {
    id: 'LAND_BUY',
    name: '购地卡',
    icon: '📜',
    cardImg: '/assets/card_land_buy.svg',
    cost: 90,
    targetType: 'PROPERTY',
    desc: '远程直接按基础价格购买地图上任意一块未被占领的空地'
  },
  {
    id: 'SWAP_LAND',
    name: '换地卡',
    icon: '🔀',
    cardImg: '/assets/card_swap_land.svg',
    cost: 80,
    targetType: 'PROPERTY',
    desc: '强行用你当前停留的土地与目标的指定地产进行互换！'
  },
  {
    id: 'TRANSFER_CARD',
    name: '嫁祸卡',
    icon: '🃏',
    cardImg: '/assets/card_transfer_card.svg',
    cost: 50,
    targetType: 'PLAYER',
    desc: '当遭受大额扣款或灾难惩罚时，将惩罚转嫁给指定敌方玩家'
  },
  {
    id: 'IMMUNITY_CARD',
    name: '免罪卡',
    icon: '🏛️',
    cardImg: '/assets/card_immunity_card.svg',
    cost: 65,
    targetType: 'NONE',
    desc: '免除一次入狱、住院或大额罚款，立即恢复自由'
  },
  {
    id: 'SUMMON_GOD',
    name: '请神符',
    icon: '🧧',
    cardImg: '/assets/card_summon_god.svg',
    cost: 70,
    targetType: 'NONE',
    desc: '虔诚祈祷！随机召唤一位吉神（财神/福神/土地公/天使）附体'
  },
  {
    id: 'BANISH_GOD',
    name: '送神符',
    icon: '💨',
    cardImg: '/assets/card_banish_god.svg',
    cost: 40,
    targetType: 'NONE',
    desc: '驱散自己身上附着的穷神、衰神或恶魔负面神仙'
  },
  {
    id: 'AUCTION_CARD',
    name: '竞价令',
    icon: '🔨',
    cardImg: '/assets/card_auction_card.svg',
    cost: 55,
    targetType: 'PROPERTY',
    desc: '将自己的一块地产公开拍卖给其他玩家'
  },
  {id:'BORROW_PASS',name:'借道通行旗',icon:'⚑',cardImg:'/shanhai/icons/borrow-pass.svg',cost:50,targetType:'PLAYER',desc:'掷骰前为自己举旗，仅本回合免付地产租金。仍被围栏拦停，其他费用照常；未遇租金也消耗此卡。'},
  {id:'SWAP_STOPS',name:'换站风筝',icon:'↔',cardImg:'/shanhai/icons/swap-kite.svg',cost:60,targetType:'PLAYER',desc:'与前后六格内一名自由行动对手互换站位；方向不变，不立即结算落点。对方下回合可转向、遥控或换站应对。'}
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
