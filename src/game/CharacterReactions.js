const GENERIC_VOICE = {
  title: '城市投资人',
  gain: ['新的版图，新的机会。', '这笔投资值得期待。'],
  win: ['局势正在向我倾斜。', '不错，计划很顺利。'],
  loss: ['这点损失还拦不住我。', '先记下这笔账。'],
  crisis: ['冷静，资产还有周转空间。', '真正的考验现在才开始。'],
  bankrupt: ['这一局结束了，但故事还没结束。', '我会带着经验重新回来。']
};

export const CHARACTER_VOICES = {
  0: { title: '元气创业家', gain: ['好地点要马上拿下！', '我的商业版图又亮了一块！'], win: ['嘿嘿，今天的运气真不错！', '照这个节奏，冠军就是我啦！'], loss: ['哎呀，钱包在哭了……', '没关系，小满马上追回来！'], crisis: ['先别慌，我还能盘活资产！', '创业哪有不遇到风浪的！'], bankrupt: ['这次创业失败了，下次一定翻盘！', '呜……我会重新攒起第一桶金的！'] },
  1: { title: '地产守望者', gain: ['土地不会辜负认真经营的人。', '又一块好地纳入规划。'], win: ['稳扎稳打，收益自然会来。', '这就是长期经营的回报。'], loss: ['风吹过草原，也会留下痕迹。', '吃一次亏，下一步走得更稳。'], crisis: ['守住根基，就还有转机。', '账要一笔一笔算清楚。'], bankrupt: ['地还在，路也还在，我们再来。', '这一季收成不好，来年再战。'] },
  2: { title: '资本操盘手', gain: ['优质资产，成交。', '价格与价值，我分得很清楚。'], win: ['数字不会说谎。', '市场正在验证我的判断。'], loss: ['波动而已，还没到止损线。', '这笔成本会换来更好的仓位。'], crisis: ['重组资产，现金流优先。', '危机里才有真正的交易机会。'], bankrupt: ['今天市场赢了，下一次轮到我。', '清仓离场，也是策略的一部分。'] },
  3: { title: '能源大亨', gain: ['资本的引擎已经点火。', '很好，这块资产有扩张价值。'], win: ['财富只会流向准备好的人。', '让收益继续滚动起来。'], loss: ['这点消耗，只算运营成本。', '大生意从不怕短期代价。'], crisis: ['调动储备，绝不能停下引擎。', '越是危局，越要强势决策。'], bankrupt: ['帝国会倒下，也会再次崛起。', '记住，我只是暂时离场。'] },
  4: { title: '疾风忍者', gain: ['目标确认，迅速拿下。', '版图扩张得像风一样快。'], win: ['胜负在出手前就决定了。', '太慢了，追不上我的节奏。'], loss: ['切……这次没能避开。', '伤口会让我更专注。'], crisis: ['忍者在绝境中寻找出口。', '屏住呼吸，下一步就是反击。'], bankrupt: ['任务失败，暂时撤退。', '风会再次归来。'] },
  5: { title: '自然旅人', gain: ['这里会长出很棒的未来。', '让这块土地慢慢开花吧。'], win: ['你听，风也在替我庆祝。', '好运像种子一样发芽了。'], loss: ['下雨了也没关系。', '大自然会把失去的带回来。'], crisis: ['深呼吸，总会找到新的路。', '寒冬之后一定是春天。'], bankrupt: ['旅程告一段落，我还会再出发。', '把遗憾埋进土里，下次会开花。'] },
  6: { title: '荒野牛仔', gain: ['看准目标，一口气拿下！', '这片地盘归我了，驾！'], win: ['漂亮！正中红心！', '西部最快的赢家就是我！'], loss: ['嘶……这一枪有点疼。', '别得意，牛仔从不轻易认输。'], crisis: ['勒紧缰绳，冲出包围！', '最后一枚硬币也要用在刀刃上。'], bankrupt: ['这回合我输了，决斗还没结束。', '收起帽子，下个城镇再见！'] },
  7: { title: '热血球手', gain: ['好球！这一垒稳稳拿下！', '继续推进，目标是全垒打！'], win: ['得分！观众席欢呼吧！', '状态火热，谁也挡不住！'], loss: ['界外球而已，再来一次！', '比分落后才更有挑战！'], crisis: ['最后一局也不能放弃！', '握紧球棒，逆转就在这一球！'], bankrupt: ['比赛结束，但训练明天继续！', '这场输了，下一场打回来！'] },
  8: { title: '皇家经营者', gain: ['这项资产配得上皇家名录。', '很好，将它纳入我的领地。'], win: ['应得的收益已经到账。', '秩序与财富都在我这一边。'], loss: ['无礼，这笔损失我记下了。', '小小波折动摇不了王冠。'], crisis: ['皇家储备自有应急章程。', '保持体面，然后解决问题。'], bankrupt: ['王冠暂时蒙尘，并非失去光芒。', '我会以更盛大的姿态归来。'] },
  9: { title: '甜心幸运星', gain: ['哇，这里以后一定很热闹！', '糖糖的梦想小屋又多一间！'], win: ['甜甜的好运来啦！', '今天也要笑着拿第一！'], loss: ['呜，好像有一点点痛……', '没关系，吃颗糖继续走！'], crisis: ['不可以哭，要想想办法！', '大家的鼓励就是我的储备金！'], bankrupt: ['糖糖先休息一下，下次再一起玩！', '输掉金币，也不能输掉笑容！'] },
  10: { title: '冷面剑客', gain: ['判断无误，落子。', '此地已在我的剑围之内。'], win: ['胜机只有一瞬，我抓住了。', '无需多言，结果已定。'], loss: ['这一击，我记住了。', '心不可乱，阵脚不可退。'], crisis: ['斩断犹豫，保留生机。', '绝境之中，更要看清每一步。'], bankrupt: ['此战败北，剑心未折。', '收剑。来日再决胜负。'] },
  11: { title: '商业神童', gain: ['成本漂亮，成长空间更漂亮！', '这块资产的模型已经算好了！'], win: ['看吧，我的公式没有错！', '收益曲线正在加速上扬！'], loss: ['咦？这个变量超出预期了。', '重新计算，下一次不会失误！'], crisis: ['现金流告急，启动应急模型！', '只要数据还在，就能找到解法！'], bankrupt: ['模型需要重做，我很快回来！', '失败样本也很有研究价值！'] }
};

function playerFor(state, playerId) {
  return state.players?.find(player => player.id === playerId)
    || state.getCurrentPlayer?.()
    || null;
}

function lineIndex(event, player, lines) {
  const source = `${event.type}:${player?.profileId ?? player?.id ?? 0}:${event.tileId ?? event.targetId ?? ''}:${event.amount ?? event.cost ?? ''}:${event.round ?? ''}`;
  let hash = 0;
  for (let index = 0; index < source.length; index++) hash = ((hash * 31) + source.charCodeAt(index)) >>> 0;
  return lines.length ? hash % lines.length : 0;
}

function reaction(event, player, category, label) {
  if (!player) return null;
  const voice = CHARACTER_VOICES[player.profileId] || GENERIC_VOICE;
  const lines = voice[category] || GENERIC_VOICE[category] || GENERIC_VOICE.win;
  return {
    kind: 'reaction',
    playerId: player.id,
    emotion: category,
    label,
    title: voice.title || GENERIC_VOICE.title,
    line: lines[lineIndex(event, player, lines)]
  };
}

export function describeCharacterReactions(event, state) {
  const current = playerFor(state, event.playerId);
  const single = (category, label, player = current) => [reaction(event, player, category, label)].filter(Boolean);
  switch (event.type) {
    case 'PROPERTY_PURCHASED': return single('gain', '成功购入地产');
    case 'PROPERTY_UPGRADED': return single('gain', `建筑升级至 LV ${event.level}`);
    case 'PROPERTY_REDEEMED': return single('gain', '赎回抵押地产');
    case 'START_BONUS_GRANTED': return single('win', '领取环游奖励');
    case 'TEAM_START_DIVIDEND': return single('win', '获得队友分红');
    case 'LORD_REINFORCED': return single('win', '领主增援抵达');
    case 'MINIGAME_COMPLETED': return single('win', '小游戏获胜');
    case 'CARD_USED': return single('win', '发动策略卡');
    case 'QUEST_STARTED': return single('gain', `接受委托「${event.title}」`);
    case 'QUEST_COMPLETED': return single('win', `完成委托「${event.title}」`);
    case 'QUEST_FAILED': return single('loss', `委托「${event.title}」到期`);
    case 'CARD_BOUGHT': return single('gain', '兑换策略卡');
    case 'RESEARCH_COMPLETED': return single(event.success === false ? 'loss' : 'win', event.success === false ? '研发成果暂存失败' : '研发项目完成');
    case 'BOARD_GOD_COLLECTED': return single('win', '邂逅巡游神明');
    case 'GOD_TRANSFERRED': return single('gain', '擦肩获得巡游精灵', playerFor(state, event.toPlayerId));
    case 'GOD_TURN_EFFECT': return single(['CASH_LOSS', 'CARD_POINTS_LOSS'].includes(event.effect) ? 'loss' : 'win', '巡游精灵回合效果');
    case 'GOD_DEPARTED': return single('loss', '巡游精灵离场');
    case 'DEBT_PAID': return single('win', '解除财务危机');
    case 'CHAIRMAN_CHANGED':
      return event.chairmanId === null || event.chairmanId === undefined
        ? []
        : single('win', '当选公司董事长', playerFor(state, event.chairmanId));
    case 'MARKET_OFFER_ACCEPTED': {
      const buyer = playerFor(state, event.buyerId);
      const seller = playerFor(state, event.sellerId);
      return [
        reaction(event, buyer, 'gain', '交易大厅成功购入'),
        reaction(event, seller, 'win', '交易大厅成功售出')
      ].filter(Boolean);
    }
    case 'COMMERCIAL_FACILITY_VISITED':
      return single(event.emotion || 'win', event.title || '商业设施互动');
    case 'STATUS_APPLIED':
      return single(['BAD', 'MISFORTUNE', 'DEMON', 'GREAT_POOR', 'SMALL_POOR'].includes(event.status) ? 'loss' : 'win', '运势发生变化');
    case 'CASH_GAINED': return single('win', event.chance?.title || '获得意外收入');
    case 'CASH_LOST': return single('loss', event.chance?.title || '遭遇意外损失');
    case 'RENT_WAIVED': return single('win', '免除过路费');
    case 'RENT_PAID': {
      const owner = playerFor(state, event.ownerId);
      return [
        reaction(event, current, 'loss', `支付 $${Number(event.amount || 0).toLocaleString()} 过路费`),
        reaction(event, owner, 'win', `收到 $${Number(event.amount || 0).toLocaleString()} 租金`)
      ].filter(Boolean);
    }
    case 'HOSPITALIZED': return single('loss', '住院疗养');
    case 'JAILED': return single('loss', '被送入监狱');
    case 'MINE_EXPLODED': return single('loss', '踩中震荡地雷');
    case 'MONSTER_ATTACK': return single('loss', '遭遇怪兽袭击');
    case 'DEBT_REQUIRED': return single('crisis', '现金流危机');
    case 'PLAYER_BANKRUPT': return single('bankrupt', '宣告破产');
    default: return [];
  }
}
