import { NewsUI } from './NewsUI.js';
import { describeCharacterReactions } from '../game/CharacterReactions.js';

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
  const toast = (icon, title, detail, tone = 'info') => cues.push({ kind: 'toast', icon, title, detail, tone });

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
      toast('🏡', '成功购入地产', `${current?.name || '玩家'} · ${tile?.name || '新地产'} · ${money(event.cost)}`, 'success');
      break;
    case 'PROPERTY_UPGRADED':
      cash(current?.id, -event.cost, '建筑升级');
      toast('🏗️', `建筑升级至 LV ${event.level}`, `${tile?.name || '地产'} · 投资 ${money(event.cost)}`, 'gold');
      break;
    case 'RENT_PAID': {
      const owner = playerFor(state, event.ownerId);
      cash(current?.id, -event.amount, '支付过路费');
      cash(owner?.id, event.amount, '收到过路费');
      toast('💸', '过路费结算', `${current?.name || '玩家'} 向 ${owner?.name || '地主'} 支付 ${money(event.amount)}`, 'danger');
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
      toast('✨', '运势精灵附体', `${event.status} · 持续 ${event.duration} 回合`, ['BAD', 'MISFORTUNE', 'DEMON'].includes(event.status) ? 'danger' : 'gold');
      break;
    case 'BOARD_GOD_COLLECTED':
      toast('🧚', '邂逅巡游神明', `${current?.name || '玩家'} 获得 ${event.godType}`, 'gold');
      break;
    case 'JAILED':
      toast('🚔', '被送入监狱', `${current?.name || '玩家'} 暂停 ${event.duration} 回合`, 'danger');
      break;
    case 'HOSPITALIZED':
    case 'MINE_EXPLODED':
      toast(event.type === 'MINE_EXPLODED' ? '💣' : '🏥', event.type === 'MINE_EXPLODED' ? '地雷爆炸' : '住院疗养', `${current?.name || '玩家'} 暂时无法行动`, 'danger');
      break;
    case 'MONSTER_ATTACK':
      toast('👾', '怪兽发动袭击', `${state.getTile?.(event.targetTileId)?.name || '一处地产'} 的建筑被摧毁`, 'danger');
      break;
    case 'PLAYER_BANKRUPT':
      toast('📉', '玩家破产', `${current?.name || '玩家'} 退出财富竞逐`, 'danger');
      break;
    case 'LOTTERY_BOUGHT':
      toast('🎰', '乐透券购买成功', `${event.number} 号 · 奖池 ${money(event.pot)}`, 'accent');
      break;
    case 'MINIGAME_COMPLETED':
      cash(current?.id, event.reward, '小游戏奖励');
      toast('🎮', '小游戏完成', `得分 ${event.score} · 奖励 ${money(event.reward)}`, 'success');
      break;
    case 'CARD_USED':
      toast('🃏', '策略卡发动', state.getCardById?.(event.cardId)?.name || event.cardId, 'gold');
      break;
    case 'MAGIC_CAST':
      toast('🔮', '魔法屋效果发动', event.effectId || event.magicId || '命运发生改变', 'accent');
      break;
    case 'COMMERCIAL_FACILITY_VISITED':
      toast(event.icon || '🏙️', event.title || '商业设施服务', event.detail || `${current?.name || '玩家'} 完成设施互动`, event.emotion === 'loss' ? 'danger' : 'gold');
      break;
    default:
      break;
  }
  return cues;
}

export class PresentationUI {
  constructor() {
    this.bannerHost = document.getElementById('presentation-banner-host');
    this.diceHost = document.getElementById('presentation-dice-host');
    this.toastStack = document.getElementById('presentation-toast-stack');
    this.cashHost = document.getElementById('presentation-cash-host');
    this.reactionHost = document.getElementById('presentation-reaction-host');
    this.bannerToken = 0;
    this.turnTimer = null;
    this.reactionQueue = [];
    this.reactionActive = false;
    this.reactionTimer = null;
    this.newsUI = new NewsUI();
  }

  isReducedMotion() {
    return document.documentElement.classList.contains('reduce-motion')
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  portrait(player, className) {
    const portrait = document.createElement('span');
    portrait.className = className;
    portrait.setAttribute('role', 'img');
    portrait.setAttribute('aria-label', player?.name || '玩家');
    if (player?.avatarAtlas) {
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

  async showTurn(player, round = 1) {
    if (!this.bannerHost || !player) return;
    const token = ++this.bannerToken;
    this.bannerHost.replaceChildren();
    const banner = document.createElement('div');
    banner.className = 'presentation-turn-banner';
    banner.style.setProperty('--player-color', player.color || '#67e8f9');
    banner.appendChild(this.portrait(player, 'presentation-turn-portrait'));
    const copy = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.className = 'presentation-eyebrow';
    eyebrow.textContent = `ROUND ${round} · ${player.isAI ? 'COMPUTER' : 'PLAYER'}`;
    const title = document.createElement('strong');
    title.textContent = `${player.name} 的回合`;
    const detail = document.createElement('span');
    detail.textContent = player.skillName ? `⚡ ${player.skillName}` : '准备行动';
    copy.append(eyebrow, title, detail);
    banner.appendChild(copy);
    this.bannerHost.appendChild(banner);
    void banner.offsetWidth;
    banner.classList.add('is-visible');
    const duration = 3000;
    await new Promise(resolve => setTimeout(resolve, duration));
    if (token !== this.bannerToken) return;
    banner.classList.remove('is-visible');
    setTimeout(() => banner.remove(), this.isReducedMotion() ? 0 : 260);
  }

  scheduleTurn(player, round = 1, delay = 160) {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = setTimeout(() => {
      this.turnTimer = null;
      this.showTurn(player, round);
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
    const duration = this.isReducedMotion() ? 900 : Math.max(650, Math.round(1050 / Math.max(0.5, speed)));
    await new Promise(resolve => setTimeout(resolve, duration));
    result.classList.remove('is-visible');
    setTimeout(() => result.remove(), this.isReducedMotion() ? 0 : 220);
  }

  showToast(cue) {
    if (!this.toastStack) return;
    const toast = document.createElement('div');
    toast.className = `presentation-toast tone-${cue.tone || 'info'}`;
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
    const duration = 2600;
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), this.isReducedMotion() ? 0 : 260);
    }, duration);
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
    card.appendChild(this.portrait(player, 'character-reaction-portrait'));
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
      this.newsUI.show(event.news);
      return;
    }
    describePresentationEvent(event, state).forEach(cue => {
      if (cue.kind === 'toast') this.showToast(cue);
      else if (cue.kind === 'cash') this.showCash(cue);
      else if (cue.kind === 'turn') this.scheduleTurn(playerFor(state, cue.playerId), cue.round);
    });
    describeCharacterReactions(event, state).forEach(cue => this.showReaction(cue, state));
  }

  clear() {
    this.bannerToken++;
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    if (this.reactionTimer) clearTimeout(this.reactionTimer);
    this.reactionTimer = null;
    this.reactionQueue = [];
    this.reactionActive = false;
    [this.bannerHost, this.diceHost, this.toastStack, this.cashHost, this.reactionHost].forEach(host => host?.replaceChildren());
    this.newsUI.close();
  }

  showNewsHistory(history) {
    this.newsUI.showHistory(history);
  }
}
