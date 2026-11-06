import { rentAbility, costAbilityNote } from './CharacterAbilityFeedback.js';
import { cityPortrait } from './CityPortrait.js';
import { NewsUI } from './NewsUI.js';
import { describeCharacterReactions } from '../game/CharacterReactions.js';
import { getGodRule } from '../game/GodRules.js';
import { EconomicReportUI } from './EconomicReportUI.js';
import { ChanceRevealUI } from './ChanceRevealUI.js';
import { getArrivalBrief, getTurnBrief } from '../game/TurnPresentationRules.js';
import { createCardPresentation } from '../game/CardPresentation.js';
import { cardManager } from '../game/CardManager.js';

const money = value => `$${Math.abs(Number(value) || 0).toLocaleString()}`;

function playerFor(state, playerId) {
  return state.players?.find(player => player.id === playerId)
    || state.getCurrentPlayer?.()
    || null;
}

export function describePresentationEvent(event, state) {
  const current = playerFor(state, event.playerId);
  const tile = event.tileId === undefined ? null : state.getTile?.(event.tileId);
  const cues = [];
  const cash = (playerId, amount, label) => cues.push({ kind: 'cash', playerId, amount, label });
  const toast = (icon, title, detail, tone = 'info', fullDetail = false) => cues.push({ kind: 'toast', icon, title, detail, tone, fullDetail });

  switch (event.type) {
    case 'TURN_CHANGED': {
      const nextPlayer = event.transition?.currentPlayer || state.getCurrentPlayer?.();
      if (nextPlayer && !event.transition?.gameOver) cues.push({ kind: 'turn', playerId: nextPlayer.id, round: state.round });
      break;
    }
    case 'START_BONUS_GRANTED':
      cash(event.playerId, event.amount, '经过起点');
      toast('🚩', '环游奖励', `${current?.name || '玩家'} 获得 ${money(event.amount)}`, 'success');
      break;
    case 'PROPERTY_PURCHASED':
      cash(current?.id, -event.cost, '购入地产');
      toast('🏡', '成功购入地产', [`${current?.name || '玩家'} · ${tile?.name || '新地产'} · ${money(event.cost)}`, costAbilityNote(current, 'BUY', event.cost)].filter(Boolean).join(' · '), 'success', Boolean(costAbilityNote(current, 'BUY', event.cost)));
      break;
    case 'PROPERTY_UPGRADED':
      cash(current?.id, -event.cost, '建筑升级');
      toast('🏗️', `建筑升级至 LV ${event.level}`, `${current?.name || '玩家'} · ${tile?.name || '地产'} · 投资 ${money(event.cost)}`, 'gold', true);
      break;
    case 'RENT_PAID': {
      const owner = playerFor(state, event.ownerId);
      cash(current?.id, -event.amount, '支付过路费');
      cash(owner?.id, event.amount, '收到过路费');
      toast('💸', '过路费结算', [`${current?.name || '玩家'} 向 ${owner?.name || '地主'} 支付 ${money(event.amount)}`, rentAbility(owner).label ? `${rentAbility(owner).label}，已计入本次结算` : ''].filter(Boolean).join(' · '), 'danger', Boolean(rentAbility(owner).label));
      break;
    }
    case 'RENT_WAIVED':
      toast('🛡️', '过路费免除', `${current?.name || '玩家'} 本次免费通行`, 'success');
      break;
    case 'DEBT_REQUIRED':
      toast('⚠️', '现金不足，进入财务清算', `需筹集 ${money(event.amountDue)}`, 'danger');
      break;
    case 'ASSET_LIQUIDATED':
      cash(current?.id, event.value, '资产变现');
      toast('🏦', '资产处置完成', `${event.kind || '资产'} · 回笼 ${money(event.value)}`, 'accent');
      break;
    case 'PROPERTY_MORTGAGED':
      cash(current?.id, event.value, '地产抵押');
      toast('🏠', '地产已抵押', `${tile?.name || '地产'} · 获得 ${money(event.value)}`, 'accent');
      break;
    case 'DEBT_PAID':
      cash(current?.id, -event.amount, '偿还债务');
      toast('✅', '债务清偿完成', `${current?.name || '玩家'} 支付 ${money(event.amount)}`, 'success');
      break;
    case 'CASH_GAINED':
      cash(current?.id, event.amount, event.chance?.title || '现金收入');
      toast('💰', event.chance?.title || '获得现金', `${current?.name || '玩家'} +${money(event.amount)}`, 'success');
      break;
    case 'CASH_LOST':
      cash(current?.id, -event.amount, event.chance?.title || '现金支出');
      toast('💥', event.chance?.title || '损失现金', `${current?.name || '玩家'} -${money(event.amount)}`, 'danger');
      break;
    case 'COUPON_COLLECTED':
    case 'CARD_POINTS':
      toast('🎟️', '获得卡片点数', `+${event.amount} PTS`, 'accent');
      break;
    case 'CARD_GAINED':
      toast('🃏', '获得新卡片', state.getCardById?.(event.cardId)?.name || event.cardId, 'gold');
      break;
    case 'CARD_SHOP_OFFER':
      toast('🏬', event.offer?.tileName || '卡片屋限定货架', `获赠 ${event.amount || 0} PTS · 本轮 ${event.offer?.cardIds?.length || 0} 张卡片 · 到店折扣 ${Math.round((event.offer?.discountRate || 0) * 100)}%`, 'gold');
      break;
    case 'STATUS_APPLIED':
      toast(event.icon || getGodRule(event.status)?.icon || '✨', '运势精灵附体', `${event.statusName || getGodRule(event.status)?.name || event.status} · 持续 ${event.duration} 回合`, event.tone || getGodRule(event.status)?.tone || 'gold');
      break;
    case 'STATUS_CHANGED': {
      const rule = getGodRule(event.status);
      if (rule) toast(rule.icon, '召唤巡游精灵', `${event.statusName || rule.name} · 持续 ${event.duration} 回合`, rule.tone);
      break;
    }
    case 'BOARD_GOD_COLLECTED':
      toast(event.icon || '🧚', '邂逅巡游精灵', `${current?.name || '玩家'} 获得 ${event.godName || getGodRule(event.godType)?.name || event.godType} · ${event.duration} 回合`, event.tone || 'gold');
      break;
    case 'GOD_TRANSFERRED': {
      const from = playerFor(state, event.fromPlayerId);
      const to = playerFor(state, event.toPlayerId);
      const rule = getGodRule(event.godType);
      toast(rule?.icon || '✨', '擦肩转移', `${rule?.name || event.godType} 从 ${from?.name || '玩家'} 转移给 ${to?.name || '玩家'}`, rule?.tone || 'accent');
      break;
    }
    case 'GOD_TURN_EFFECT': {
      const rule = getGodRule(event.godType);
      const detail = event.effect === 'CASH_GAIN' ? `获得 ${money(event.amount)}`
        : event.effect === 'CASH_LOSS' ? `损失 ${money(event.amount)}`
          : event.effect === 'CARD_POINTS' ? `获得 ${event.amount} PTS` : `损失 ${event.amount} PTS`;
      if (event.effect === 'CASH_GAIN') cash(event.playerId, event.amount, rule?.name || '精灵收益');
      if (event.effect === 'CASH_LOSS') cash(event.playerId, -event.amount, rule?.name || '精灵损失');
      toast(rule?.icon || '✨', `${rule?.name || '精灵'}回合效果`, detail, rule?.tone || 'accent');
      break;
    }
    case 'GOD_DEPARTED':
      toast('🌫️', '精灵离场', `${event.name || getGodRule(event.godType)?.name || event.godType} 的效果结束`, 'accent');
      break;
    case 'JAILED':
      toast('🚔', '被送入监狱', `${current?.name || '玩家'} 暂停 ${current?.jailTurns ?? event.duration ?? 2} 次行动，之后从当前格继续`, 'danger', true);
      break;
    case 'HOSPITALIZED':
      toast('🏥', '住院疗养', `${current?.name || '玩家'} 暂停 ${current?.hospitalTurns ?? event.duration ?? 1} 次行动，之后从当前格继续`, 'danger', true);
      break;
    case 'ROAD_ENTITY_CHANGED':
      if (event.entity?.type === 'BARRIER' && !event.removed) {
        const road = state.getTile?.(event.entity.tileId);
        toast('🚧', '路障已设置', `${road?.name || `${event.entity.tileId}号格`} · 首位进入者会被截停，自己也会触发；触发后移除`, 'gold', true);
      }
      break;
    case 'MINE_EXPLODED':
      toast(event.type === 'MINE_EXPLODED' ? '💣' : '🏥', event.type === 'MINE_EXPLODED' ? '地雷爆炸' : '住院疗养', `${current?.name || '玩家'} 暂时无法行动`, 'danger');
      break;
    case 'MONSTER_ATTACK':
      toast('👾', '怪兽发动袭击', `${state.getTile?.(event.targetTileId)?.name || '一处地产'} 的建筑被摧毁`, 'danger');
      break;
    case 'PLAYER_BANKRUPT':
      toast('📉', '玩家破产', `${current?.name || '玩家'} 退出财富竞逐`, 'danger');
      break;
    case 'COMPANY_VISIT': {
      const company = state.companyManager?.get(event.companyId);
      const chairman = event.chairmanId === current?.id;
      if (event.fee > 0) cash(current?.id, -event.fee, '公司服务费');
      toast(company?.icon || '🏢', chairman ? '董事长视察' : '公司服务费',
        `${current?.name || '玩家'} · ${company?.name || '公司'} · ${chairman ? '免服务费' : `支付 ${money(event.fee)}，计入公司营收`}；分红在周期结算`, chairman ? 'gold' : 'accent', true);
      break;
    }
    case 'LOTTERY_BOUGHT':
      toast('🎰', '乐透券购买成功', `${(event.numbers || [event.number]).join('、')} 号 · 奖池 ${money(event.pot)}`, 'accent');
      break;
    case 'BANK_TRANSFERRED':
      toast('🏦', event.direction === 'DEPOSIT' ? '定期存款已入账' : event.direction === 'WITHDRAW' ? '可用现金已到账' : '银行账户已更新', event.projectedInterest === undefined ? `${money(event.amount)} 账户变动` : `${money(event.amount)} · 下期利息 ${money(event.projectedInterest)}`, 'accent');
      break;
    case 'RESEARCH_STARTED':
      toast(event.itemIcon || '🧪', `研发启动 · ${event.itemName || event.task?.itemId}`, `${event.discipline || '科技项目'} · ${event.task?.roundsRemaining || 1} 轮后交付${event.accelerated ? ' · 董事长加速' : ''}`, 'accent');
      break;
    case 'RESEARCH_COMPLETED':
      toast(event.success ? event.itemIcon || '💡' : '⚠️', event.success ? '研发成果已交付' : '研发成果交付失败', event.success ? `${event.itemName || event.itemId} 已进入科技道具栏` : `${event.itemName || event.itemId} 未能交付 · 科技道具栏已满`, event.success ? 'success' : 'danger');
      break;
    case 'MECHANISM_TRIGGERED':
      toast(event.routeIcon || '⚙️', `路网重构 · ${event.routeName || '路线方案'}`, `${event.branchCount || 0} 处岔路已同步 · 覆盖 ${event.nodeCount || 0} 个节点`, 'accent');
      break;
    case 'MINIGAME_COMPLETED':
      toast(event.rankIcon || '🎮', `${event.rankLabel || '小游戏完成'}`, `${event.rank || '挑战'}级 · ${event.score} 分 · 奖励 ${event.reward || 0} 点券`, 'success');
      break;
    case 'CARD_USED': {
      const card = state.getCardById?.(event.cardId) || cardManager.getCardById(event.cardId);
      const name = card?.name || event.cardId;
      let detail = `${current?.name || '玩家'} · ${name}`;
      let hasResult = false;
      if (event.cardId === 'DEMOLISH') {
        const property = state.propertyManager?.getProperty(event.targetId);
        const targetTile = state.getTile?.(event.targetId);
        if (property && targetTile) {
          detail += ` · ${targetTile.name} 已降至 LV ${property.level}`;
          hasResult = true;
        }
      } else if (event.cardId === 'TURN_AROUND') {
        const target = state.players?.find(player => player.id === event.targetId);
        if (target) {
          detail += ` · ${target.name} 改为${target.direction === -1 ? '逆向' : '正向'}行走，下次移动沿新方向前进`;
          hasResult = true;
        }
      } else if (event.cardId === 'TURTLE') {
        const target = state.players?.find(player => player.id === event.targetId);
        if (target) {
          detail += ` · ${target.name}：剩余 ${target.turtleTurns} 回合，每次移动 1 步`;
          hasResult = true;
        }
      }
      toast(card?.icon || '🃏', hasResult ? `${name}已生效` : '策略卡发动', detail, 'gold', hasResult);
      break;
    }
    case 'QUEST_STARTED':
      toast(event.icon || '📜', `接受委托 · ${event.title}`, `${event.issuer || '城市公会'} · ${event.description || `${event.progress}/${event.target}`}`, 'gold');
      break;
    case 'QUEST_EXTENDED':
      toast(event.icon || '📜', `委托延期 · ${event.title}`, `期限延长至第 ${event.expiresRound} 轮`, 'accent');
      break;
    case 'QUEST_PROGRESS':
      toast(event.icon || '📜', `委托进展 · ${event.title}`, `${event.progress}/${event.target}`, 'accent');
      break;
    case 'QUEST_COMPLETED':
      cash(event.playerId, event.reward?.cash || 0, '委托奖励');
      toast('🏆', `委托完成 · ${event.title}`, `获得 ${money(event.reward?.cash)} 与 ${event.reward?.cardPoints || 0} PTS`, 'success');
      break;
    case 'QUEST_FAILED':
      toast('⌛', `委托到期 · ${event.title}`, `扣除 ${event.penaltyPoints || 0} PTS`, 'danger');
      break;
    case 'MAGIC_CAST':
      toast('🔮', `魔法发动 · ${event.effectLabel || event.effectId || event.magicId || '命运改写'}`, event.targetNames?.length ? `${event.targetNames.join('、')} · ${event.outcome || '效果已生效'}` : '命运发生改变', 'accent');
      break;
    case 'COMMERCIAL_FACILITY_VISITED':
      toast(event.icon || '🏙️', event.title || '商业设施服务', event.detail || `${current?.name || '玩家'} 完成设施互动`, event.emotion === 'loss' ? 'danger' : 'gold');
      break;
    default:
      break;
  }
  return cues;
}

export function describeImpactEvent(event, state) {
  const current = playerFor(state, event.playerId);
  const tile = event.tileId === undefined ? null : state.getTile?.(event.tileId);
  const card = event.type === 'CARD_USED'
    ? (state.getCardById?.(event.cardId) || cardManager.getCardById(event.cardId))
    : null;
  const cardView = card ? createCardPresentation(card) : null;
  const impacts = {
    PROPERTY_PURCHASED: { tone: 'success', eyebrow: 'CITY EXPANSION', icon: '🏙️', title: '版图扩张', detail: tile?.name || '新地产入手' },
    PROPERTY_UPGRADED: { tone: 'gold', eyebrow: 'PROPERTY LEVEL UP', icon: '🏗️', title: `建筑升至 LV ${event.level}`, detail: tile?.name || '地产完成升级' },
    RENT_PAID: { tone: 'danger', eyebrow: 'TOLL SETTLEMENT', icon: '💸', title: '租金交锋', detail: `${current?.name || '玩家'} 支付 ${money(event.amount)}` },
    CARD_USED: {
      tone: 'accent', eyebrow: `STRATEGY CARD · ${cardView?.rarity.label || '战术'}`,
      icon: cardView?.icon || '🃏', title: cardView?.name || '策略发动',
      detail: `${current?.name || '玩家'} · ${cardView?.category.label || '策略'}效果生效`,
      artClass: cardView?.artClass || 'card-art-support', serial: cardView?.serial || 'FE-00'
    },
    MAGIC_CAST: { tone: 'accent', eyebrow: 'FORTUNE SHIFT', icon: '🔮', title: event.effectLabel || '命运改写', detail: event.targetNames?.length ? `${event.targetNames.join('、')} · ${event.outcome || '效果生效'}` : event.effectId || event.magicId || '魔法效果生效' },
    QUEST_COMPLETED: { tone: 'success', eyebrow: 'MISSION COMPLETE', icon: '🏆', title: '城市委托完成', detail: event.title || '奖励已经到账' },
    MINIGAME_COMPLETED: { tone: 'gold', eyebrow: 'CHALLENGE CLEAR', icon: event.rankIcon || '🎮', title: `${event.rank || ''}级 ${event.rankLabel || '小游戏通关'}`.trim(), detail: `${event.score || 0} 分 · ${event.reward || 0} 点券` },
    PLAYER_BANKRUPT: { tone: 'critical', eyebrow: 'BANKRUPTCY', icon: '📉', title: '玩家破产', detail: `${current?.name || '玩家'} 退出财富竞逐` }
  };
  return impacts[event.type] || null;
}

export class PresentationUI {
  constructor(audioManager = null) {
    this.audioManager = audioManager;
    this.bannerHost = document.getElementById('presentation-banner-host');
    this.diceHost = document.getElementById('presentation-dice-host');
    this.moveHost = document.getElementById('presentation-move-host');
    this.arrivalHost = document.getElementById('presentation-arrival-host');
    this.impactHost = document.getElementById('presentation-impact-host');
    this.toastStack = document.getElementById('presentation-toast-stack');
    this.cashHost = document.getElementById('presentation-cash-host');
    this.reactionHost = document.getElementById('presentation-reaction-host');
    // Feedback must clear the actual dock, including wrapped turn text and phone layouts.
    const dock = document.querySelector('.control-panel');
    const layer = document.getElementById('presentation-layer');
    if (dock && layer && window.ResizeObserver) {
      const updateDockClearance = () => {
        const height = dock.getBoundingClientRect().height;
        const bottom = parseFloat(getComputedStyle(dock).bottom) || 0;
        layer.style.setProperty('--action-dock-clearance', `${Math.ceil(height + bottom + 24)}px`);
      };
      this.dockObserver = new ResizeObserver(updateDockClearance);
      this.dockObserver.observe(dock);
      window.addEventListener('resize', updateDockClearance);
      updateDockClearance();
    }
    this.bannerToken = 0;
    this.impactToken = 0;
    this.turnTimer = null;
    this.reactionQueue = [];
    this.reactionActive = false;
    this.reactionTimer = null;
    this.newsUI = new NewsUI();
    this.economicReportUI = new EconomicReportUI(audioManager);
    this.chanceRevealUI = new ChanceRevealUI(audioManager);
  }

  isReducedMotion() {
    return document.documentElement.classList.contains('reduce-motion')
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  portrait(player, className, mapId) {
    const portrait = document.createElement('span');
    portrait.className = className;
    portrait.setAttribute('role', 'img');
    portrait.setAttribute('aria-label', player?.name || '玩家');
    const cityImage = cityPortrait(player, mapId);
    if (cityImage) {
      portrait.style.backgroundImage = `url('${cityImage}')`;
      portrait.style.backgroundPosition = 'center';
      portrait.style.backgroundSize = 'cover';
    } else if (player?.avatarAtlas) {
      portrait.style.backgroundImage = `url('${player.avatarAtlas}')`;
      portrait.style.backgroundPosition = player.avatarPosition || '0% 0%';
    } else if (player?.avatarImg) {
      portrait.style.backgroundImage = `url('${player.avatarImg}')`;
      portrait.style.backgroundPosition = 'center';
      portrait.style.backgroundSize = 'cover';
    } else {
      portrait.textContent = player?.avatar || '🎩';
    }
    return portrait;
  }

  async showTurn(player, round = 1, state = null) {
    if (!this.bannerHost || !player) return;
    const token = ++this.bannerToken;
    this.bannerHost.replaceChildren();
    const banner = document.createElement('div');
    banner.className = 'presentation-turn-banner';
    banner.style.setProperty('--player-color', player.color || '#67e8f9');
    banner.appendChild(this.portrait(player, 'presentation-turn-portrait', state?.mapId));
    const copy = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.className = 'presentation-eyebrow';
    eyebrow.textContent = `ROUND ${round} · ${player.isAI ? 'COMPUTER' : 'PLAYER'}`;
    const title = document.createElement('strong');
    title.textContent = `${player.name} 的回合`;
    const detail = document.createElement('span');
    detail.textContent = player.skillName ? `⚡ ${player.skillName}` : '准备行动';
    copy.append(eyebrow, title, detail);
    if (state) {
      const brief = getTurnBrief(state, player);
      const metrics = document.createElement('div');
      metrics.className = 'presentation-turn-metrics';
      metrics.innerHTML = `<span><small>排名</small><b>${brief.rank}<em>/${brief.activeCount}</em></b></span><span><small>总资产</small><b>${brief.netWorthLabel}</b></span><span><small>地产</small><b>${brief.propertyCount}<em>处</em></b></span>`;
      const objective = document.createElement('div');
      objective.className = 'presentation-turn-objective';
      objective.innerHTML = `<small>本轮建议</small><strong>${brief.objective}</strong>${brief.statuses.map(status => `<i class="${status.tone}">${status.icon} ${status.label}</i>`).join('')}`;
      copy.append(metrics, objective);
    }
    banner.appendChild(copy);
    this.bannerHost.appendChild(banner);
    void banner.offsetWidth;
    banner.classList.add('is-visible');
    // Let the first painted frame survive a slow WebGL initialization before
    // starting the reading interval. Hidden tabs resume with a readable banner.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (token !== this.bannerToken || !banner.isConnected) return;
    const duration = 3000;
    await new Promise(resolve => setTimeout(resolve, duration));
    if (token !== this.bannerToken) return;
    banner.classList.remove('is-visible');
    setTimeout(() => banner.remove(), this.isReducedMotion() ? 0 : 260);
  }

  scheduleTurn(player, round = 1, delay = 160, state = null) {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = setTimeout(() => {
      this.turnTimer = null;
      this.showTurn(player, round, state);
    }, delay);
  }

  async showDice({ player, dice = [], steps = 0, bonusSteps = 0, speed = 1 }) {
    if (!this.diceHost) return;
    this.bannerToken++;
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    this.bannerHost?.replaceChildren();
    this.diceHost.replaceChildren();
    const result = document.createElement('div');
    result.className = 'presentation-dice-result';
    result.style.setProperty('--player-color', player?.color || '#ffd166');
    const diceRow = document.createElement('div');
    diceRow.className = 'presentation-dice-row';
    dice.forEach(value => {
      const die = document.createElement('span');
      die.className = 'presentation-die';
      die.textContent = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][Math.max(0, Math.min(5, value - 1))];
      diceRow.appendChild(die);
    });
    const total = document.createElement('div');
    total.className = 'presentation-dice-total';
    total.innerHTML = `<span>前进</span><strong>${steps}</strong><span>步${bonusSteps ? ` · 奖励 +${bonusSteps}` : ''}</span>`;
    result.append(diceRow, total);
    this.diceHost.appendChild(result);
    void result.offsetWidth;
    result.classList.add('is-visible');
    // Slow WebGL frames can otherwise consume the entire result interval while
    // the CSS transition is still at opacity zero.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (!result.isConnected) return;
    const duration = this.isReducedMotion() ? 900 : Math.max(650, Math.round(1050 / Math.max(0.5, speed)));
    await new Promise(resolve => setTimeout(resolve, duration));
    result.classList.remove('is-visible');
    setTimeout(() => result.remove(), this.isReducedMotion() ? 0 : 220);
  }

  showToast(cue) {
    if (!this.toastStack) return;
    const toast = document.createElement('div');
    toast.className = `presentation-toast tone-${cue.tone || 'info'}${cue.fullDetail ? ' has-full-detail' : ''}`;
    const icon = document.createElement('span');
    icon.className = 'presentation-toast-icon';
    icon.textContent = cue.icon || '◆';
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = cue.title || '事件';
    const detail = document.createElement('span');
    detail.textContent = cue.detail || '';
    copy.append(title, detail);
    toast.append(icon, copy);
    this.toastStack.prepend(toast);
    void toast.offsetWidth;
    toast.classList.add('is-visible');
    while (this.toastStack.children.length > 4) this.toastStack.lastElementChild?.remove();
    const duration = cue.fullDetail ? 4200 : 2600;
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), this.isReducedMotion() ? 0 : 260);
    }, duration);
  }

  showMoveProgress({ player, current, total, tile }) {
    if (!this.moveHost || !player) return;
    let panel = this.moveHost.querySelector('.presentation-move-progress');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'presentation-move-progress';
      panel.innerHTML = '<span class="move-progress-label">MOVE</span><strong></strong><div class="move-progress-track"><i></i></div><small></small>';
      this.moveHost.replaceChildren(panel);
      void panel.offsetWidth;
      panel.classList.add('is-visible');
    }
    panel.style.setProperty('--player-color', player.color || '#67e8f9');
    panel.querySelector('strong').textContent = `${current} / ${total}`;
    panel.querySelector('i').style.width = `${Math.min(100, Math.max(0, current / Math.max(1, total) * 100))}%`;
    panel.querySelector('small').textContent = tile?.name ? `途经 · ${tile.name}` : `${player.name} 正在移动`;
  }

  endMove() {
    const panel = this.moveHost?.querySelector('.presentation-move-progress');
    if (!panel) return;
    panel.classList.add('is-complete');
    setTimeout(() => {
      panel.classList.remove('is-visible');
      setTimeout(() => panel.remove(), this.isReducedMotion() ? 0 : 220);
    }, this.isReducedMotion() ? 80 : 420);
  }

  async showArrival({ state, player, tileId, landing, speed = 1 }) {
    if (!this.arrivalHost || !state || !player) return;
    this.arrivalHost.replaceChildren();
    const cue = getArrivalBrief(state, player, tileId, landing);
    const card = document.createElement('article');
    card.className = `presentation-arrival tone-${cue.tone}`;
    card.style.setProperty('--player-color', player.color || '#67e8f9');
    card.innerHTML = `<div class="presentation-arrival-scan"></div><span class="presentation-arrival-icon">${cue.icon}</span><div class="presentation-arrival-copy"><small>${cue.eyebrow}</small><strong>${cue.title}</strong><span>${cue.tileName} · ${cue.detail}</span></div><b>${cue.badge}</b>`;
    this.arrivalHost.appendChild(card);
    void card.offsetWidth;
    card.classList.add('is-visible');
    this.audioManager?.playSFX?.(cue.tone === 'danger' ? 'danger' : cue.tone === 'opportunity' ? 'confirm' : 'turn');
    const duration = this.isReducedMotion() ? 360 : Math.max(560, Math.round(900 / Math.max(.65, speed)));
    await new Promise(resolve => setTimeout(resolve, duration));
    card.classList.remove('is-visible');
    await new Promise(resolve => setTimeout(resolve, this.isReducedMotion() ? 0 : 190));
    card.remove();
  }

  async showImpact(cue) {
    if (!this.impactHost || !cue) return;
    const token = ++this.impactToken;
    this.impactHost.replaceChildren();
    const impact = document.createElement('div');
    impact.className = `presentation-impact tone-${cue.tone || 'accent'} ${cue.artClass || ''}`;
    impact.innerHTML = `${cue.artClass ? `<div class="presentation-impact-card"><span>${cue.icon || '🃏'}</span><i>${cue.serial || 'FE-00'}</i></div>` : ''}<div class="presentation-impact-lines"></div><span class="presentation-impact-eyebrow"></span><div class="presentation-impact-title"><b></b><strong></strong></div><small></small>`;
    impact.querySelector('.presentation-impact-eyebrow').textContent = cue.eyebrow || 'CITY EVENT';
    impact.querySelector('.presentation-impact-title b').textContent = cue.icon || '◆';
    impact.querySelector('.presentation-impact-title strong').textContent = cue.title || '关键事件';
    impact.querySelector('small').textContent = cue.detail || '';
    this.impactHost.appendChild(impact);
    void impact.offsetWidth;
    impact.classList.add('is-visible');
    await new Promise(resolve => setTimeout(resolve, this.isReducedMotion() ? 500 : cue.artClass ? 2300 : 1050));
    if (token !== this.impactToken) return;
    impact.classList.remove('is-visible');
    setTimeout(() => impact.remove(), this.isReducedMotion() ? 0 : 260);
  }

  showCash(cue) {
    if (!this.cashHost || cue.playerId === undefined || !cue.amount) return;
    const playerCard = document.querySelector(`.player-card[data-player-id="${cue.playerId}"]`);
    const rect = playerCard?.getBoundingClientRect();
    const burst = document.createElement('div');
    burst.className = `presentation-cash-burst ${cue.amount > 0 ? 'is-gain' : 'is-loss'}`;
    burst.style.left = `${rect ? rect.left + rect.width * 0.56 : window.innerWidth / 2}px`;
    burst.style.top = `${rect ? rect.top + rect.height * 0.52 : window.innerHeight / 2}px`;
    const value = document.createElement('strong');
    value.textContent = `${cue.amount > 0 ? '+' : '−'}${money(cue.amount)}`;
    const label = document.createElement('span');
    label.textContent = cue.label || (cue.amount > 0 ? '收入' : '支出');
    burst.append(value, label);
    this.cashHost.appendChild(burst);
    setTimeout(() => burst.remove(), 1500);
  }

  showReaction(cue, state) {
    if (!this.reactionHost) return;
    this.reactionQueue.push({ cue, state });
    if (!this.reactionActive) this.playNextReaction();
  }

  playNextReaction() {
    const queued = this.reactionQueue.shift();
    if (!queued || !this.reactionHost) {
      this.reactionActive = false;
      return;
    }
    this.reactionActive = true;
    const { cue, state } = queued;
    const player = playerFor(state, cue.playerId);
    if (!player) return this.playNextReaction();
    this.reactionHost.replaceChildren();
    const card = document.createElement('article');
    card.className = `character-reaction emotion-${cue.emotion || 'win'}`;
    card.style.setProperty('--player-color', player.color || '#67e8f9');
    card.appendChild(this.portrait(player, 'character-reaction-portrait', state?.mapId));
    const copy = document.createElement('div');
    const meta = document.createElement('span');
    meta.className = 'character-reaction-meta';
    meta.textContent = `${cue.label || '即时反应'} · ${cue.title || player.skillName || '城市投资人'}`;
    const line = document.createElement('strong');
    line.textContent = `“${cue.line}”`;
    const name = document.createElement('span');
    name.className = 'character-reaction-name';
    name.textContent = player.name;
    copy.append(meta, line, name);
    card.appendChild(copy);
    this.reactionHost.appendChild(card);
    void card.offsetWidth;
    card.classList.add('is-visible');
    const duration = this.isReducedMotion() ? 1250 : 2300;
    this.reactionTimer = setTimeout(() => {
      card.classList.remove('is-visible');
      this.reactionTimer = setTimeout(() => {
        card.remove();
        this.playNextReaction();
      }, this.isReducedMotion() ? 0 : 260);
    }, duration);
  }

  presentDomainEvent(event, state) {
    if (event.type === 'NEWS_FLASH') {
      if (!this.economicReportUI.appendNews(event.news)) this.newsUI.show(event.news);
      return;
    }
    if (event.type === 'ECONOMIC_CYCLE_ENDED' && event.report) {
      this.economicReportUI.show(event.report);
    }
    if (event.chance) this.chanceRevealUI.show({ event, player: playerFor(state, event.playerId) });
    describePresentationEvent(event, state).forEach(cue => {
      if (cue.kind === 'toast') this.showToast(cue);
      else if (cue.kind === 'cash') this.showCash(cue);
      else if (cue.kind === 'turn') this.scheduleTurn(playerFor(state, cue.playerId), cue.round, 160, state);
    });
    const impact = describeImpactEvent(event, state);
    if (impact) void this.showImpact(impact);
    describeCharacterReactions(event, state).forEach(cue => this.showReaction(cue, state));
  }

  clear() {
    this.bannerToken++;
    this.impactToken++;
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    if (this.reactionTimer) clearTimeout(this.reactionTimer);
    this.reactionTimer = null;
    this.reactionQueue = [];
    this.reactionActive = false;
    [this.bannerHost, this.diceHost, this.moveHost, this.arrivalHost, this.impactHost, this.toastStack, this.cashHost, this.reactionHost].forEach(host => host?.replaceChildren());
    this.newsUI.close();
    this.economicReportUI.close();
    this.chanceRevealUI.close();
  }

  showNewsHistory(history) {
    this.newsUI.showHistory(history);
  }

  showEconomicReport(report, newsHistory = []) {
    this.economicReportUI.show(report, newsHistory);
  }
}
