import { CardRules } from './CardRules.js';
import { SaveManager } from './SaveManager.js';
import { TileType, isPropertyTile } from './BoardData.js';
import { cardManager } from './CardManager.js';
import { MAX_PROPERTY_LEVEL } from './GameRules.js';
import { validateCommand } from './CommandPolicy.js';

/**
 * Rules-facing facade. Presentation code asks this object for legal actions and
 * persistence; UI modules never need to understand serialized state.
 */
export class GameEngine {
  constructor(gameState, { saveManager = new SaveManager() } = {}) {
    this.state = gameState;
    this.cards = new CardRules(gameState);
    this.saves = saveManager;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event) {
    this.listeners.forEach(listener => listener(event, this.state));
  }

  emitAll(events = []) {
    events.forEach(event => this.emit(event));
    return events;
  }

  getNegativeDuration(player, turns) {
    return player?.skillName === '甜心庇佑' ? Math.max(1, Math.ceil(turns / 2)) : turns;
  }

  redirectPenalty(player, label = '不利效果') {
    const targetId = player?.penaltyTransferTargetId;
    const target = this.state.players.find(item => item.id === targetId && !item.isBankrupt && item.id !== player.id);
    if (!target) return player;
    player.penaltyTransferTargetId = null;
    this.state.addLog(`🎭 ${player.name} 的【嫁祸卡】生效，将${label}转嫁给 ${target.name}！`, 'gold');
    return target;
  }

  applyConfinement(player, kind, turns, source = '灾难') {
    const recipient = this.redirectPenalty(player, source);
    if (recipient.skillName === '剑道大师' && this.state.rng.next() < 0.2) {
      this.state.addLog(`⚔️ ${recipient.name} 触发【剑道大师】，闪避了${source}！`, 'gold');
      return { recipient, avoided: true, turns: 0 };
    }
    const duration = this.getNegativeDuration(recipient, turns);
    if (kind === 'JAIL') recipient.jailTurns = Math.max(recipient.jailTurns || 0, duration);
    else recipient.hospitalTurns = Math.max(recipient.hospitalTurns || 0, duration);
    return { recipient, avoided: false, turns: duration };
  }

  getAreaTiles(centerTileId, radius) {
    const visited = new Set([Number(centerTileId)]);
    let frontier = [Number(centerTileId)];
    for (let distance = 0; distance < radius; distance++) {
      const next = [];
      frontier.forEach(tileId => {
        [1, -1].forEach(direction => {
          this.state.mapRuntime.getNextOptions(tileId, direction).forEach(neighbor => {
            if (visited.has(neighbor)) return;
            visited.add(neighbor);
            next.push(neighbor);
          });
        });
      });
      frontier = next;
    }
    return [...visited];
  }

  getLegalActions(playerId = this.state.currentPlayerIndex) {
    const player = this.state.players[playerId];
    if (!player || player.isBankrupt || this.state.phase === 'GAME_OVER') return [];
    if (this.state.phase === 'DEBT_SETTLEMENT' && this.state.pendingDebt?.debtorId === player.id) {
      const actions = [
        { type: 'PAY_DEBT', enabled: player.cash >= this.state.pendingDebt.amountDue },
        { type: 'AUTO_SETTLE_DEBT', enabled: true },
        { type: 'DECLARE_BANKRUPTCY', enabled: true }
      ];
      for (const [stockId, holding] of Object.entries(player.stocks || {})) {
        if (holding.shares > 0) actions.push({ type: 'SELL_STOCK', enabled: true, stockId, shares: holding.shares });
      }
      for (const [tileId, property] of this.state.propertyManager.properties) {
        if (property.owner !== player.id) continue;
        if (property.level > 0) actions.push({ type: 'SELL_BUILDING', enabled: true, tileId });
        if (!property.isMortgaged && property.level === 0) actions.push({ type: 'MORTGAGE_PROPERTY', enabled: true, tileId });
        else actions.push({ type: 'REDEEM_PROPERTY', enabled: player.cash >= property.mortgageValue * 1.1, tileId });
      }
      return actions;
    }
    const isTurn = player.id === this.state.currentPlayerIndex;
    const preRoll = isTurn && this.state.phase === 'PRE_ROLL_ACTION';
    const actions = [
      { type: 'ROLL_DICE', enabled: preRoll },
      { type: 'BUY_STOCK', enabled: preRoll },
      { type: 'SELL_STOCK', enabled: preRoll && Object.keys(player.stocks || {}).length > 0 },
      { type: 'BUY_CARD', enabled: preRoll && player.cardPoints > 0 }
    ];
    for (const cardId of new Set(player.cards || [])) {
      actions.push({ cardId, ...this.getCardAction(player, cardId) });
    }
    return actions;
  }

  execute(command) {
    if (!command?.type) return { success: false, reason: '缺少命令类型', events: [] };
    const player = this.state.players[command.playerId ?? this.state.currentPlayerIndex];
    const payload = command.payload || {};
    if (!player) return { success: false, reason: '玩家不存在', events: [] };
    const rejected = validateCommand(this.state, player, command);
    if (rejected) return { ...rejected, events: [] };

    let result;
    switch (command.type) {
      case 'PURCHASE_PROPERTY':
        result = this.purchaseProperty(player, payload.tileId);
        break;
      case 'UPGRADE_PROPERTY':
        result = this.upgradeProperty(player, payload.tileId);
        break;
      case 'SETTLE_RENT':
        result = this.settleRent(player, payload.tileId);
        break;
      case 'RESOLVE_LANDING':
        result = { success: true, ...this.resolveSpecialLanding(player, payload.tileId) };
        break;
      case 'BANK_TRANSFER':
        result = this.bankTransfer(player, payload.direction, payload.amount);
        break;
      case 'BUY_LOTTERY':
        result = this.buyLottery(player, payload.number);
        break;
      case 'CAST_MAGIC':
        result = this.castMagic(player, payload.magicId);
        break;
      case 'BUY_STOCK':
        result = this.tradeStock(player, 'BUY', payload.stockId, payload.shares);
        break;
      case 'SELL_STOCK':
        result = this.tradeStock(player, 'SELL', payload.stockId, payload.shares);
        break;
      case 'BUY_CARD':
        result = this.buyCard(player, payload.cardId);
        break;
      case 'USE_CARD':
        result = this.useCard(player, payload.cardId, payload.targetId, payload.value);
        break;
      case 'ROLL_DICE':
        result = this.rollDice(player);
        break;
      case 'BEGIN_MOVE':
        result = this.beginMove(player, payload.steps, payload.source);
        break;
      case 'ADVANCE_MOVE':
        result = this.advanceMove(player, payload.nextTileId);
        break;
      case 'TELEPORT_PLAYER':
        result = this.teleportPlayer(player, payload.tileId);
        break;
      case 'SELL_BUILDING':
        result = this.sellBuilding(player, payload.tileId);
        break;
      case 'MORTGAGE_PROPERTY':
        result = this.mortgageProperty(player, payload.tileId);
        break;
      case 'REDEEM_PROPERTY':
        result = this.redeemProperty(player, payload.tileId);
        break;
      case 'PAY_DEBT':
        result = this.payDebt(player);
        break;
      case 'AUTO_SETTLE_DEBT':
        result = this.autoSettleDebt(player);
        break;
      case 'DECLARE_BANKRUPTCY':
        result = this.declareBankruptcy(player);
        break;
      case 'PAUSE_GAME':
        result = this.pauseGame();
        break;
      case 'RESUME_GAME':
        result = this.resumeGame();
        break;
      case 'END_TURN':
        result = this.state.pendingMove || this.state.pendingDebt
          ? { success: false, reason: '仍有待完成操作' }
          : { success: true, type: 'TURN_CHANGED', transition: this.state.nextTurn() };
        break;
      default:
        return { success: false, reason: `未知命令：${command.type}`, events: [] };
    }

    const events = result.events || (result.type ? [{ type: result.type, ...result }] : []);
    this.emitAll(events);
    return { ...result, events };
  }

  rollDice(player) {
    if (player.id !== this.state.currentPlayerIndex || this.state.phase !== 'PRE_ROLL_ACTION') {
      return { success: false, reason: '当前不能掷骰子' };
    }
    const diceCount = player.vehicle === 'CAR' ? 3 : (this.state.mapDefinition.defaultDiceCount || 1);
    const dice = Array.from({ length: diceCount }, () => this.state.rng.int(1, 6));
    if (player.moveLimitThisTurn === 1) dice.splice(0, dice.length, 1);
    let steps = dice.reduce((sum, value) => sum + value, 0);
    if (player.godType === 'BAD') steps = Math.max(1, Math.ceil(steps / 2));
    let bonusSteps = 0;
    if (player.skillName === '牛仔冲锋' && player.moveLimitThisTurn !== 1 && this.state.rng.next() < 0.15) {
      bonusSteps = 2;
      steps += bonusSteps;
      this.state.addLog(`🐎 ${player.name} 触发【牛仔冲锋】，额外前进 ${bonusSteps} 步！`, 'gold');
    }
    this.state.phase = 'ROLLING';
    return { success: true, type: 'DICE_ROLLED', playerId: player.id, dice, steps, bonusSteps };
  }

  beginMove(player, steps, source = 'DICE') {
    const count = Number(steps);
    if (!Number.isInteger(count) || count < 0 || this.state.pendingMove) {
      return { success: false, reason: '移动请求无效' };
    }
    this.state.pendingMove = { playerId: player.id, remainingSteps: count, source, path: [] };
    this.state.phase = 'MOVING';
    return { success: true, type: 'MOVE_STARTED', playerId: player.id, steps: count, source };
  }

  advanceMove(player, nextTileId = null) {
    const pending = this.state.pendingMove;
    if (!pending || pending.playerId !== player.id || pending.remainingSteps <= 0) {
      return { success: false, reason: '没有待执行的移动' };
    }
    const options = this.state.mapRuntime.getNextOptions(player.currentTile, player.direction || 1);
    if (!options.length) {
      this.state.pendingMove = null;
      this.state.phase = 'LANDING_ACTION';
      return { success: true, type: 'MOVEMENT_FINISHED', playerId: player.id, tileId: player.currentTile };
    }
    if (options.length > 1 && nextTileId === null) {
      this.state.phase = 'ROUTE_CHOICE';
      return { success: true, type: 'ROUTE_CHOICE_REQUIRED', playerId: player.id, options, remainingSteps: pending.remainingSteps };
    }
    const selected = nextTileId === null ? options[0] : Number(nextTileId);
    if (!options.includes(selected)) return { success: false, reason: '路线选择无效' };

    this.state.phase = 'MOVING';
    player.currentTile = selected;
    pending.path.push(selected);
    pending.remainingSteps--;
    const events = [{ type: 'PLAYER_STEPPED', playerId: player.id, tileId: selected, remainingSteps: pending.remainingSteps }];

    if (selected === this.state.mapDefinition.spawnTile) {
      const amount = this.state.mapDefinition.passBonus ?? 2000;
      player.cash += amount;
      events.push({ type: 'START_BONUS_GRANTED', playerId: player.id, amount });
    }

    const property = this.state.propertyManager.getProperty(selected);
    if (property?.hasObstacle) {
      const dodged = player.skillName === '疾风忍术' && this.state.rng.next() < 0.3;
      if (dodged) {
        events.push({ type: 'OBSTACLE_DODGED', playerId: player.id, tileId: selected });
      } else {
        property.hasObstacle = false;
        pending.remainingSteps = 0;
        events.push({ type: 'OBSTACLE_CONSUMED', playerId: player.id, tileId: selected });
      }
    }

    if (property?.hasMine) {
      property.hasMine = false;
      pending.remainingSteps = 0;
      if (this.state.gameMode === 'HEAT') {
        player.cash -= 2500;
        this.state.checkBankrupt(player);
      }
      const confinement = this.applyConfinement(player, 'HOSPITAL', 3, '地雷伤害');
      events.push({ type: 'MINE_EXPLODED', playerId: confinement.recipient.id, tileId: selected, avoided: confinement.avoided });
      if (!confinement.avoided) this.state.addLog(`💣 轰！${confinement.recipient.name} 被地雷炸伤，住院 ${confinement.turns} 回合！`, 'danger');
    }

    // 检查经过其他玩家时的神明擦肩转移
    this.state.checkGodCollision(player);
    const boardGod = this.state.checkBoardGodCollision(player);
    if (boardGod) events.push({ type: 'BOARD_GOD_COLLECTED', playerId: player.id, godType: boardGod.type, tileId: selected });

    if (player.godType === 'EARTH' && isPropertyTile(this.state.getTile(selected)) && property.owner === null) {
      property.owner = player.id;
      if (property.level === 0) property.level = 1;
      this.state.assetRevision++;
      events.push({ type: 'PROPERTY_CHANGED', tileId: selected, ownerId: player.id, level: property.level });
    }

    if (player.godType === 'ANGEL' && isPropertyTile(this.state.getTile(selected)) && property.level < 4) {
      property.level++;
      this.state.assetRevision++;
      events.push({ type: 'PROPERTY_CHANGED', tileId: selected, ownerId: property.owner, level: property.level });
      this.state.addLog(`👼 天使降临！${this.state.getTile(selected).name} 房屋免费加盖 1 层！`, 'gold');
    }

    if (player.godType === 'DEMON' && isPropertyTile(this.state.getTile(selected)) && property.level > 0) {
      property.level--;
      this.state.assetRevision++;
      events.push({ type: 'PROPERTY_CHANGED', tileId: selected, ownerId: property.owner, level: property.level });
      this.state.addLog(`👿 恶魔侵袭！${this.state.getTile(selected).name} 房屋遭到拆除 1 层！`, 'danger');
    }

    if (pending.remainingSteps <= 0) {
      this.state.pendingMove = null;
      this.state.phase = 'LANDING_ACTION';
      events.push({ type: 'MOVEMENT_FINISHED', playerId: player.id, tileId: selected });
    }
    return { success: true, type: events.at(-1).type, tileId: selected, remainingSteps: pending.remainingSteps, events };
  }

  teleportPlayer(player, tileId) {
    const target = Number(tileId);
    if (!this.state.getTile(target)) return { success: false, reason: '跃迁目标无效' };
    player.currentTile = target;
    this.state.pendingMove = null;
    this.state.phase = 'LANDING_ACTION';
    return {
      success: true,
      type: 'MOVEMENT_FINISHED',
      tileId: target,
      events: [
        { type: 'PLAYER_STEPPED', playerId: player.id, tileId: target, teleport: true },
        { type: 'MOVEMENT_FINISHED', playerId: player.id, tileId: target, teleport: true }
      ]
    };
  }

  pauseGame() {
    if (['SETUP', 'GAME_OVER', 'PAUSED'].includes(this.state.phase)) return { success: false, reason: '当前不能暂停' };
    this.state.phaseBeforePause = this.state.phase;
    this.state.phase = 'PAUSED';
    return { success: true, type: 'GAME_PAUSED' };
  }

  resumeGame() {
    if (this.state.phase !== 'PAUSED') return { success: false, reason: '游戏未暂停' };
    this.state.phase = this.state.phaseBeforePause || 'PRE_ROLL_ACTION';
    this.state.phaseBeforePause = null;
    return { success: true, type: 'GAME_RESUMED' };
  }

  getCardAction(player, cardId) {
    return this.cards.getLegalAction(player, cardId);
  }

  inspectLanding(player, tileId) {
    const tile = this.state.getTile(tileId);
    const property = this.state.propertyManager.getProperty(tileId);
    if (this.state.gameMode === 'HEAT' && isPropertyTile(tile)) return { kind: 'SPECIAL', tile, property };
    if (!isPropertyTile(tile)) return { kind: 'SPECIAL', tile, property };
    if (property.owner === null) return { kind: 'PURCHASE', tile, property };
    if (property.isMortgaged) return { kind: 'MORTGAGED', tile, property };
    if (property.owner === player.id) {
      return { kind: property.level < MAX_PROPERTY_LEVEL ? 'UPGRADE' : 'OWN_MAX', tile, property };
    }
    const owner = this.state.players[property.owner];
    if (this.state.gameMode === 'TEAM' && owner?.teamId === player.teamId) {
      return { kind: property.level < MAX_PROPERTY_LEVEL ? 'UPGRADE' : 'OWN_MAX', tile, property, owner };
    }
    return { kind: 'RENT', tile, property, owner: this.state.players[property.owner] };
  }

  purchaseProperty(player, tileId) {
    const tile = this.state.getTile(tileId);
    const property = this.state.propertyManager.getProperty(tileId);
    if (!tile || !isPropertyTile(tile) || property.owner !== null) {
      return { success: false, reason: '该地产当前不可购买' };
    }
    if (player.godType === 'BAD') {
      this.state.addLog(`📉 ${player.name} 受到衰运影响，买地失败！`, 'danger');
      return { success: false, reason: '衰运状态禁止买地' };
    }
    let cost = tile.price;
    if (player.godType === 'LUCK') cost = 0;
    else if (player.skillName === '商业奇才') cost = Math.round(cost * 0.85);
    if (player.cash < cost) {
      this.state.addLog(`⚠️ ${player.name} 现金不足，无法购买【${tile.name}】。`, 'danger');
      return { success: false, reason: '现金不足', cost };
    }
    player.cash -= cost;
    this.state.propertyManager.buyProperty(tileId, player.id);
    this.state.addLog(`🏗️ ${player.name} 成功购买【${tile.name}】(花费 $${cost.toLocaleString()})！`, 'success');
    return { success: true, type: 'PROPERTY_PURCHASED', tileId, level: 0, cost };
  }

  upgradeProperty(player, tileId) {
    const tile = this.state.getTile(tileId);
    const property = this.state.propertyManager.getProperty(tileId);
    const owner = this.state.players[property?.owner];
    const canTeamUpgrade = this.state.gameMode === 'TEAM' && owner?.teamId === player.teamId;
    if (!tile || (property.owner !== player.id && !canTeamUpgrade) || property.level >= MAX_PROPERTY_LEVEL || property.isMortgaged) {
      return { success: false, reason: '该地产当前不可升级' };
    }
    if (player.godType === 'BAD') {
      this.state.addLog(`📉 ${player.name} 受到衰运影响，升级失败！`, 'danger');
      return { success: false, reason: '衰运状态禁止升级' };
    }
    let cost = tile.buildCost;
    if (player.godType === 'LUCK') cost = 0;
    else if (player.skillName === '商业奇才') cost = Math.round(cost * 0.85);
    else if (player.skillName === '商业神童') cost = Math.round(cost * 0.75);
    if (player.cash < cost) {
      this.state.addLog(`⚠️ ${player.name} 现金不足，无法升级【${tile.name}】。`, 'danger');
      return { success: false, reason: '现金不足', cost };
    }
    player.cash -= cost;
    this.state.propertyManager.upgradeProperty(tileId);
    this.state.addLog(`✨ ${player.name} 将【${tile.name}】升级至 LV ${property.level}(花费 $${cost.toLocaleString()})！`, 'gold');
    return { success: true, type: 'PROPERTY_UPGRADED', tileId, level: property.level, cost };
  }

  settleRent(player, tileId) {
    const tile = this.state.getTile(tileId);
    const property = this.state.propertyManager.getProperty(tileId);
    const owner = this.state.players[property.owner];
    if (!owner || owner.id === player.id) return { success: false, reason: '没有应付租金' };
    if (player.godType === 'FORTUNE' || player.rentShieldActiveThisTurn) {
      this.state.addLog(`🛡️ ${player.name} 的免租效果抵消了【${tile.name}】过路费！`, 'gold');
      return { success: true, type: 'RENT_WAIVED', amount: 0 };
    }
    if (player.skillName === '股市高手' && this.state.rng.next() < 0.25) {
      this.state.addLog(`💎 ${player.name} 触发商业人脉，免除【${tile.name}】过路费！`, 'gold');
      return { success: true, type: 'RENT_WAIVED', amount: 0 };
    }
    let amount = this.state.propertyManager.calculateToll(tileId, this.state.newsEffect, this.state.priceIndex);
    if (player.godType === 'MISFORTUNE' || player.godType === 'GREAT_POOR' || player.godType === 'SMALL_POOR') amount *= 2;
    if (owner.skillName === '土地公庇护') amount = Math.round(amount * 1.2);
    if (owner.skillName === '皇家威严') amount = Math.round(amount * 1.25);
    if (player.cash < amount) {
      this.state.pendingDebt = {
        debtorId: player.id,
        creditorId: owner.id,
        amountDue: amount,
        source: `RENT:${tileId}`
      };
      this.state.phase = 'DEBT_SETTLEMENT';
      this.state.addLog(`⚠️ ${player.name} 需要筹集 $${amount.toLocaleString()} 支付租金。`, 'danger');
      return { success: true, type: 'DEBT_REQUIRED', amountDue: amount, ownerId: owner.id };
    }
    player.cash -= amount;
    owner.cash += amount;
    this.state.addLog(`💸 ${player.name} 向 ${owner.name} 支付【${tile.name}】过路费 $${amount.toLocaleString()}！`, 'danger');
    return { success: true, type: 'RENT_PAID', amount, amountDue: amount, ownerId: owner.id };
  }

  sellBuilding(player, tileId) {
    if (this.state.pendingDebt?.debtorId !== player.id) return { success: false, reason: '当前无需处置资产' };
    const property = this.state.propertyManager.getProperty(Number(tileId));
    const tile = this.state.getTile(Number(tileId));
    if (!property || property.owner !== player.id || property.level <= 0) return { success: false, reason: '没有可出售建筑' };
    property.level--;
    const value = Math.round((tile.buildCost || 0) * 0.5);
    player.cash += value;
    this.state.assetRevision++;
    return { success: true, type: 'ASSET_LIQUIDATED', kind: 'BUILDING', tileId: Number(tileId), level: property.level, value };
  }

  mortgageProperty(player, tileId) {
    if (this.state.pendingDebt?.debtorId !== player.id) return { success: false, reason: '当前无需抵押' };
    const property = this.state.propertyManager.getProperty(Number(tileId));
    const tile = this.state.getTile(Number(tileId));
    if (!property || property.owner !== player.id || property.isMortgaged || property.level > 0) {
      return { success: false, reason: '需先出售全部建筑才能抵押' };
    }
    const value = Math.round((tile.price || 0) * 0.5);
    property.isMortgaged = true;
    property.mortgageValue = value;
    player.cash += value;
    this.state.assetRevision++;
    return { success: true, type: 'PROPERTY_MORTGAGED', tileId: Number(tileId), value };
  }

  redeemProperty(player, tileId) {
    const property = this.state.propertyManager.getProperty(Number(tileId));
    if (!property || property.owner !== player.id || !property.isMortgaged) return { success: false, reason: '地产未抵押' };
    const cost = Math.round(property.mortgageValue * 1.1);
    if (player.cash < cost) return { success: false, reason: '现金不足', cost };
    player.cash -= cost;
    property.isMortgaged = false;
    property.mortgageValue = 0;
    this.state.assetRevision++;
    return { success: true, type: 'PROPERTY_REDEEMED', tileId: Number(tileId), cost };
  }

  payDebt(player) {
    const debt = this.state.pendingDebt;
    if (!debt || debt.debtorId !== player.id) return { success: false, reason: '没有待支付债务' };
    if (player.cash < debt.amountDue) return { success: false, reason: '现金不足', amountDue: debt.amountDue };
    player.cash -= debt.amountDue;
    const creditor = debt.creditorId === null ? null : this.state.players[debt.creditorId];
    if (creditor) creditor.cash += debt.amountDue;
    const paid = debt.amountDue;
    this.state.pendingDebt = null;
    this.state.phase = 'LANDING_ACTION';
    this.state.addLog(`💸 ${player.name} 完成债务支付 $${paid.toLocaleString()}。`, 'danger');
    return { success: true, type: 'DEBT_PAID', amount: paid, creditorId: creditor?.id ?? null };
  }

  autoSettleDebt(player) {
    const debt = this.state.pendingDebt;
    if (!debt || debt.debtorId !== player.id) return { success: false, reason: '没有待处理债务' };
    const events = [];
    if (player.cash < debt.amountDue && (player.deposit || 0) > 0) {
      const amount = Math.min(player.deposit, debt.amountDue - player.cash);
      player.deposit -= amount;
      player.cash += amount;
      events.push({ type: 'ASSET_LIQUIDATED', kind: 'DEPOSIT', value: amount });
    }
    const stockIds = Object.keys(player.stocks || {}).sort((a, b) => {
      const left = this.state.stockMarket.stocks.find(stock => stock.id === a);
      const right = this.state.stockMarket.stocks.find(stock => stock.id === b);
      return ((left?.price || 0) - (player.stocks[a]?.avgPrice || 0))
        - ((right?.price || 0) - (player.stocks[b]?.avgPrice || 0));
    });
    for (const stockId of stockIds) {
      if (player.cash >= debt.amountDue) break;
      const shares = player.stocks[stockId]?.shares || 0;
      if (shares) {
        const sold = this.tradeStock(player, 'SELL', stockId, shares);
        if (sold.success) events.push({ type: 'ASSET_LIQUIDATED', kind: 'STOCK', stockId, shares, value: sold.revenue });
      }
    }
    const owned = [...this.state.propertyManager.properties.entries()]
      .filter(([, property]) => property.owner === player.id)
      .sort((a, b) => this.state.propertyManager.calculateToll(a[0]) - this.state.propertyManager.calculateToll(b[0]));
    for (const [tileId, property] of owned) {
      while (player.cash < debt.amountDue && property.level > 0) {
        const sold = this.sellBuilding(player, tileId);
        if (sold.success) events.push({ ...sold, type: 'ASSET_LIQUIDATED' });
      }
      if (player.cash >= debt.amountDue) break;
    }
    for (const [tileId, property] of owned) {
      if (player.cash >= debt.amountDue) break;
      if (!property.isMortgaged) {
        const mortgaged = this.mortgageProperty(player, tileId);
        if (mortgaged.success) events.push({ ...mortgaged, type: 'ASSET_LIQUIDATED', kind: 'PROPERTY' });
      }
    }
    if (player.cash >= debt.amountDue) {
      const paid = this.payDebt(player);
      events.push({ type: 'DEBT_PAID', amount: paid.amount, creditorId: paid.creditorId });
      return { success: true, type: 'DEBT_PAID', amount: paid.amount, events };
    }
    const bankrupt = this.declareBankruptcy(player);
    return { ...bankrupt, events: [...events, ...(bankrupt.events || [])] };
  }

  declareBankruptcy(player) {
    const debt = this.state.pendingDebt;
    if (!debt || debt.debtorId !== player.id) return { success: false, reason: '没有待处理债务' };
    const creditor = debt.creditorId === null ? null : this.state.players[debt.creditorId];
    const paid = Math.min(player.cash, debt.amountDue);
    player.cash -= paid;
    if (creditor) creditor.cash += paid;
    const events = [];
    this.state.propertyManager.properties.forEach((property, tileId) => {
      if (property.owner !== player.id) return;
      property.owner = null;
      property.level = 0;
      property.isMortgaged = false;
      property.mortgageValue = 0;
      events.push({ type: 'ASSET_LIQUIDATED', kind: 'PROPERTY', playerId: player.id, tileId, value: 0 });
    });
    player.stocks = {};
    player.deposit = 0;
    player.isBankrupt = true;
    this.state.pendingDebt = null;
    this.state.phase = 'LANDING_ACTION';
    this.state.assetRevision++;
    events.push({ type: 'PLAYER_BANKRUPT', playerId: player.id });
    this.state.checkWinCondition();
    return { success: true, type: 'PLAYER_BANKRUPT', amountPaid: paid, events };
  }

  resolveSpecialLanding(player, tileId) {
    const tile = this.state.getTile(tileId);
    const duration = player.skillName === '石油大亨' ? 4 : 3;
    if (this.state.gameMode === 'HEAT' && (isPropertyTile(tile) || tile.type === TileType.ROAD)) {
      const attackCards = ['MISSILE', 'MINE', 'NUKES', 'OBSTACLE', 'TURTLE'];
      const reward = this.state.rng.pick(attackCards);
      player.cards.push(reward);
      player.cardPoints += 25;
      this.state.addLog(`🔥 ${player.name} 从热斗补给格获得攻击卡片与 25 点券！`, 'gold');
      return { type: 'HEAT_SUPPLY', cardId: reward, amount: 25 };
    }
    if (tile.type === TileType.COUPON) {
      const baseAmount = tile.couponAmount || 30;
      const amount = player.skillName === '疾风忍术' ? baseAmount * 2 : baseAmount;
      player.cardPoints += amount;
      this.state.addLog(`🎟️ ${player.name} 拾取 ${amount} 点券！`, 'accent');
      return { type: 'COUPON_COLLECTED', amount };
    }
    if (tile.type === TileType.TREASURE) {
      const rewardType = this.state.rng.int(0, 2);
      if (rewardType === 0) {
        const amount = this.state.rng.int(8, 16) * 100;
        player.cash += amount;
        this.state.addLog(`🎁 ${player.name} 从宝箱中获得 $${amount.toLocaleString()}！`, 'gold');
        return { type: 'CASH_GAINED', amount, source: 'TREASURE' };
      }
      if (rewardType === 1) {
        const amount = this.state.rng.pick([30, 50, 80]);
        player.cardPoints += amount;
        this.state.addLog(`🎁 ${player.name} 从宝箱中获得 ${amount} 点券！`, 'accent');
        return { type: 'COUPON_COLLECTED', amount, source: 'TREASURE' };
      }
      const card = this.state.rng.pick(cardManager.getAllCards());
      player.cards.push(card.id);
      this.state.addLog(`🎁 ${player.name} 从宝箱中获得【${card.name}】！`, 'gold');
      return { type: 'CARD_GAINED', cardId: card.id, source: 'TREASURE' };
    }
    if (tile.type === TileType.MONSTER) {
      if (player.negativeImmuneActiveThisTurn) {
        this.state.addLog(`🍀 ${player.name} 的护佑吓退了怪兽。`, 'gold');
        return { type: 'NEGATIVE_BLOCKED', source: 'MONSTER' };
      }
      const targets = [...this.state.propertyManager.properties.entries()]
        .filter(([, property]) => property.owner !== null && property.owner !== player.id && property.level > 0)
        .sort((a, b) => b[1].level - a[1].level || a[0] - b[0]);
      if (targets.length) {
        const [targetTileId, property] = targets[0];
        const previousLevel = property.level;
        property.level = 0;
        this.state.assetRevision++;
        const targetTile = this.state.getTile(targetTileId);
        this.state.addLog(`👾 怪兽袭击【${targetTile.name}】，建筑从 LV ${previousLevel} 被夷为平地！`, 'danger');
        return {
          type: 'MONSTER_ATTACK',
          targetTileId,
          previousLevel,
          events: [
            { type: 'MONSTER_ATTACK', playerId: player.id, targetTileId, previousLevel },
            { type: 'PROPERTY_CHANGED', tileId: targetTileId }
          ]
        };
      }
      const amount = Math.min(player.cash, 800);
      player.cash -= amount;
      this.state.addLog(`👾 怪兽没有找到建筑，卷走了 ${player.name} 的 $${amount.toLocaleString()}！`, 'danger');
      return { type: 'CASH_LOST', amount, source: 'MONSTER' };
    }
    if (tile.type === TileType.CARD_SHOP) {
      let amount = player.skillName === '疾风忍术' ? 120 : 60;
      if (player.skillName === '棒球活力') amount += 40;
      player.cardPoints += amount;
      this.state.addLog(`🃏 ${player.name} 获得 ${amount} 卡片积分！`, 'accent');
      return { type: 'CARD_POINTS', amount };
    }
    if (tile.type === TileType.BANK) {
      return { type: 'OPEN_BANK', cash: player.cash, deposit: player.deposit || 0 };
    }
    if (tile.type === TileType.LOTTERY) {
      return { type: 'LOTTERY_OFFER', ticketPrice: 200, pot: this.state.lottery.pot };
    }
    if (tile.type === TileType.MAGIC_HOUSE) {
      return {
        type: 'MAGIC_OFFER',
        options: [
          { id: 'CASH_RAIN', label: '财富甘霖', description: '所有未破产玩家获得 $800' },
          { id: 'PROPERTY_BOOM', label: '建筑奇迹', description: '自己所有建筑免费提升 1 级' },
          { id: 'GOD_SHUFFLE', label: '神明乱舞', description: '所有玩家当前神明重新分配' }
        ]
      };
    }
    if (tile.type === TileType.MECHANISM) {
      return this.triggerMapMechanism(player);
    }
    if (tile.type === TileType.PRISON) {
      const confinement = this.applyConfinement(player, 'JAIL', 2, '入狱惩罚');
      if (!confinement.avoided) this.state.addLog(`🚔 ${confinement.recipient.name} 入狱，暂停行动 ${confinement.turns} 回合！`, 'danger');
      return { type: confinement.avoided ? 'NEGATIVE_BLOCKED' : 'JAILED', playerId: confinement.recipient.id, duration: confinement.turns };
    }
    if (tile.type === TileType.HOSPITAL) {
      const confinement = this.applyConfinement(player, 'HOSPITAL', 1, '住院惩罚');
      if (!confinement.avoided) this.state.addLog(`🏥 ${confinement.recipient.name} 入院疗养，暂停行动 ${confinement.turns} 回合！`, 'danger');
      return { type: confinement.avoided ? 'NEGATIVE_BLOCKED' : 'HOSPITALIZED', playerId: confinement.recipient.id, duration: confinement.turns };
    }
    if (tile.type === TileType.CHANCE) {
      const chance = this.state.eventManager.drawChanceCard();
      if (chance.isGain || player.skillName === '自然之福') {
        player.cash += Math.abs(chance.amount);
        this.state.addLog(`❓ 【${chance.title}】获得 $${Math.abs(chance.amount).toLocaleString()}！`, 'gold');
        return { type: 'CASH_GAINED', amount: Math.abs(chance.amount), chance };
      }
      if (player.negativeImmuneActiveThisTurn) {
        this.state.addLog(`🍀 ${player.name} 抵消了【${chance.title}】。`, 'gold');
        return { type: 'NEGATIVE_BLOCKED', chance };
      }
      const recipient = this.redirectPenalty(player, `【${chance.title}】扣款`);
      recipient.cash -= chance.amount;
      this.state.addLog(`❓ ${recipient.name} 因【${chance.title}】损失 $${chance.amount.toLocaleString()}！`, 'danger');
      const settlement = this.state.checkBankrupt(recipient);
      return {
        type: 'CASH_LOST',
        amount: chance.amount,
        chance,
        events: settlement.liquidations.map(item => ({ type: 'ASSET_LIQUIDATED', playerId: recipient.id, ...item }))
      };
    }
    const spiritByType = {
      [TileType.GOD_MISFORTUNE]: 'MISFORTUNE',
      [TileType.GOD_EARTH]: 'EARTH',
      [TileType.GOD_BAD]: 'BAD'
    };
    if (tile.type === TileType.GOD_FORTUNE || spiritByType[tile.type]) {
      player.godType = tile.type === TileType.GOD_FORTUNE
        ? (tile.spirit || (tileId === 28 ? 'LUCK' : 'FORTUNE'))
        : spiritByType[tile.type];
      player.godTurns = player.godType === 'BAD' ? 3 : duration;
      if (['BAD', 'MISFORTUNE', 'DEMON', 'GREAT_POOR', 'SMALL_POOR'].includes(player.godType)) {
        player.godTurns = this.getNegativeDuration(player, player.godTurns);
      }
      const cards = [];
      for (let i = 0; i < (tile.cardReward || 0); i++) {
        const card = this.state.rng.pick(cardManager.getAllCards());
        player.cards.push(card.id);
        cards.push(card.id);
      }
      this.state.addLog(`✨ ${player.name} 获得运势精灵【${player.godType}】${player.godTurns} 回合。`, player.godType === 'BAD' || player.godType === 'MISFORTUNE' ? 'danger' : 'gold');
      if (cards.length) this.state.addLog(`🌟 福星额外赠送 ${cards.length} 张卡片！`, 'gold');
      return { type: 'STATUS_APPLIED', status: player.godType, duration: player.godTurns, cards };
    }
    if (tile.type === TileType.STOCK) {
      this.state.addLog(`📈 ${player.name} 到达【${tile.name}】。`, 'accent');
      return { type: 'OPEN_STOCK' };
    }
    return { type: 'NO_ACTION' };
  }

  bankTransfer(player, direction, amount) {
    const value = Math.max(0, Math.floor(Number(amount)));
    if (!value) return { success: false, reason: '请输入有效金额' };
    if (direction === 'DEPOSIT') {
      if (player.cash < value) return { success: false, reason: '现金不足' };
      player.cash -= value;
      player.deposit = (player.deposit || 0) + value;
    } else if (direction === 'WITHDRAW') {
      if ((player.deposit || 0) < value) return { success: false, reason: '存款不足' };
      player.deposit -= value;
      player.cash += value;
    } else {
      return { success: false, reason: '银行操作无效' };
    }
    this.state.assetRevision++;
    this.state.addLog(`🏦 ${player.name} ${direction === 'DEPOSIT' ? '存入' : '取出'} $${value.toLocaleString()}。`, 'accent');
    return { success: true, type: 'BANK_TRANSFERRED', direction, amount: value, cash: player.cash, deposit: player.deposit };
  }

  buyLottery(player, number) {
    const selected = Number(number);
    const ticketPrice = 200;
    if (!Number.isInteger(selected) || selected < 1 || selected > 10) return { success: false, reason: '乐透号码无效' };
    if (player.cash < ticketPrice) return { success: false, reason: '现金不足' };
    player.cash -= ticketPrice;
    this.state.lottery.pot += ticketPrice;
    this.state.lottery.tickets.push({ playerId: player.id, number: selected });
    this.state.addLog(`🎰 ${player.name} 购买了 ${selected} 号乐透券，当前奖池 $${this.state.lottery.pot.toLocaleString()}。`, 'accent');
    return { success: true, type: 'LOTTERY_BOUGHT', number: selected, cost: ticketPrice, pot: this.state.lottery.pot };
  }

  castMagic(player, magicId) {
    if (magicId === 'CASH_RAIN') {
      this.state.players.filter(item => !item.isBankrupt).forEach(item => { item.cash += 800; });
    } else if (magicId === 'PROPERTY_BOOM') {
      this.state.propertyManager.properties.forEach(property => {
        if (property.owner === player.id && property.level < MAX_PROPERTY_LEVEL) property.level++;
      });
      this.state.assetRevision++;
    } else if (magicId === 'GOD_SHUFFLE') {
      const active = this.state.players.filter(item => !item.isBankrupt);
      const gods = active.map(item => ({ type: item.godType, turns: item.godTurns }));
      active.forEach((item, index) => {
        const source = gods[(index + 1) % gods.length];
        item.godType = source.type;
        item.godTurns = source.turns;
      });
    } else {
      return { success: false, reason: '未知魔法' };
    }
    this.state.addLog(`🔮 ${player.name} 在魔法屋发动了【${magicId}】！`, 'gold');
    return { success: true, type: 'MAGIC_CAST', magicId };
  }

  triggerMapMechanism(player) {
    const branchTiles = this.state.mapDefinition.tiles.filter(tile => (tile.next || []).length > 1);
    if (!branchTiles.length) return { type: 'NO_ACTION' };
    this.state.mechanismState.activeRoute = (this.state.mechanismState.activeRoute + 1) % 2;
    branchTiles.forEach(tile => {
      const option = tile.next[this.state.mechanismState.activeRoute % tile.next.length];
      this.state.mapRuntime.setNextOptions(tile.id, [option]);
    });
    this.state.addLog(`⚙️ ${player.name} 启动地图机关，全部岔路切换至 ${this.state.mechanismState.activeRoute ? '支线' : '主线'}。`, 'gold');
    return { type: 'MECHANISM_TRIGGERED', activeRoute: this.state.mechanismState.activeRoute };
  }

  tradeStock(player, action, stockId, shares) {
    const canTradeBeforeRoll = player.id === this.state.currentPlayerIndex && this.state.phase === 'PRE_ROLL_ACTION';
    const canSellForDebt = action === 'SELL'
      && this.state.phase === 'DEBT_SETTLEMENT'
      && this.state.pendingDebt?.debtorId === player.id;
    if (!canTradeBeforeRoll && !canSellForDebt) return { success: false, reason: '当前不能交易股票' };
    const quantity = Number(shares);
    if (!Number.isInteger(quantity) || quantity <= 0) return { success: false, reason: '交易数量无效' };
    const result = action === 'BUY'
      ? this.state.stockMarket.buyStock(player, stockId, quantity)
      : this.state.stockMarket.sellStock(player, stockId, quantity);
    if (!result.success) return { ...result, reason: result.msg };
    const type = action === 'BUY' ? 'STOCK_BOUGHT' : 'STOCK_SOLD';
    return { ...result, type, playerId: player.id, stockId, shares: quantity };
  }

  getCardCost(player, card) {
    if (player.skillName === '石油大亨' && ['DEMOLISH', 'STEAL_LAND', 'MISSILE', 'NUKES', 'LAND_BUY', 'SWAP_LAND'].includes(card.id)) {
      return Math.round(card.cost * 0.5);
    }
    if (player.skillName === '商业奇才') return Math.round(card.cost * 0.85);
    if (player.skillName === '棒球活力') return Math.round(card.cost * 0.9);
    return card.cost;
  }

  buyCard(player, cardId) {
    if (player.id !== this.state.currentPlayerIndex || this.state.phase !== 'PRE_ROLL_ACTION') {
      return { success: false, reason: '当前不能购买卡片' };
    }
    const card = cardManager.getCardById(cardId);
    if (!card) return { success: false, reason: '卡片不存在' };
    const cost = this.getCardCost(player, card);
    if (player.cardPoints < cost) return { success: false, reason: '卡片积分不足', cost };
    player.cardPoints -= cost;
    player.cards.push(cardId);
    this.state.addLog(`🛒 ${player.name} 消费 ${cost} 积分兑换了【${card.name}】！`, 'accent');
    return { success: true, type: 'CARD_BOUGHT', playerId: player.id, cardId, cost };
  }

  useCard(player, cardId, targetId = null, value = null) {
    const action = this.getCardAction(player, cardId);
    if (!action.enabled) return { success: false, reason: action.reason };
    if (action.targets?.length && !action.targets.some(target => String(target.id) === String(targetId))) {
      return { success: false, reason: '卡片目标无效' };
    }

    const card = cardManager.getCardById(cardId);
    const events = [];
    let followUp = null;
    const targetPlayer = this.state.players[Number(targetId)];
    const targetTile = Number(targetId);

    switch (cardId) {
      case 'REMOTE_DICE': {
        const steps = Number(value);
        if (!Number.isInteger(steps) || steps < 1 || steps > 6) return { success: false, reason: '骰子点数无效' };
        this.state.phase = 'ROLLING';
        followUp = { type: 'MOVE_REQUESTED', mode: 'ROLL', steps };
        break;
      }
      case 'OBSTACLE':
        this.state.propertyManager.getProperty(targetTile).hasObstacle = true;
        events.push({ type: 'OBSTACLE_CHANGED', tileId: targetTile, active: true });
        break;
      case 'TURN_AROUND':
        targetPlayer.direction = (targetPlayer.direction || 1) * -1;
        break;
      case 'DEMOLISH': {
        const property = this.state.propertyManager.getProperty(targetTile);
        property.level--;
        events.push({ type: 'PROPERTY_CHANGED', tileId: targetTile, ownerId: property.owner, level: property.level });
        break;
      }
      case 'EQUAL_WEALTH': {
        const active = this.state.players.filter(item => !item.isBankrupt);
        const average = Math.round(active.reduce((sum, item) => sum + item.cash, 0) / active.length);
        active.forEach(item => { item.cash = average; });
        break;
      }
      case 'STEAL_LAND': {
        const property = this.state.propertyManager.getProperty(targetTile);
        property.owner = player.id;
        if (property.level === 0) property.level = 1;
        events.push({ type: 'PROPERTY_CHANGED', tileId: targetTile, ownerId: player.id, level: property.level });
        break;
      }
      case 'RED_BULL':
        this.state.stockMarket.forceStockSurge(String(targetId), true);
        break;
      case 'FORTUNE_GOD':
        player.godType = 'LUCK';
        player.godTurns = 3;
        events.push({ type: 'STATUS_CHANGED', playerId: player.id, status: 'LUCK' });
        break;
      case 'TURTLE':
        targetPlayer.turtleTurns = this.getNegativeDuration(targetPlayer, 3);
        break;
      case 'CAR_CARD':
        player.vehicle = 'CAR';
        break;
      case 'CLEANSE':
        player.turtleTurns = 0;
        player.hibernateTurns = 0;
        player.sleepwalkTurns = 0;
        player.isSleepwalkingThisTurn = false;
        if (player.godType === 'MISFORTUNE' || player.godType === 'BAD') {
          player.godType = null;
          player.godTurns = 0;
          events.push({ type: 'STATUS_CHANGED', playerId: player.id, status: null });
        }
        break;
      case 'RENT_SHIELD':
        player.rentShieldTurns = 2;
        break;
      case 'CASH_TAX': {
        const recipient = targetPlayer.negativeImmuneActiveThisTurn
          ? targetPlayer
          : this.redirectPenalty(targetPlayer, '消费税扣款');
        const amount = targetPlayer.negativeImmuneActiveThisTurn
          ? 0
          : Math.min(2500, Math.max(0, Math.round(recipient.cash * 0.12)));
        recipient.cash -= amount;
        player.cash += amount;
        const settlement = this.state.checkBankrupt(recipient);
        events.push(...settlement.liquidations.map(item => ({ type: 'ASSET_LIQUIDATED', playerId: recipient.id, ...item })));
        break;
      }
      case 'TELEPORT': {
        const path = this.state.mapRuntime.projectPath(player.currentTile, 10, player.direction || 1);
        const steps = path.indexOf(targetTile) + 1;
        if (steps < 2) return { success: false, reason: '跃迁位置无效' };
        followUp = { type: 'MOVE_REQUESTED', mode: 'TELEPORT', steps, tileId: targetTile };
        break;
      }
      case 'CLEAR_ROAD':
        this.state.propertyManager.getProperty(targetTile).hasObstacle = false;
        events.push({ type: 'OBSTACLE_CHANGED', tileId: targetTile, active: false });
        break;
      case 'BEAR_CARD':
        this.state.stockMarket.forceStockSurge(String(targetId), false);
        break;
      case 'IMMUNITY':
        player.negativeImmuneTurns = 3;
        break;
      case 'GIFT_CARD': {
        const own = player.cards.find(id => id !== cardId);
        const other = this.state.rng.pick(targetPlayer.cards);
        if (own && other) {
          player.cards[player.cards.indexOf(own)] = other;
          targetPlayer.cards[targetPlayer.cards.indexOf(other)] = own;
        }
        break;
      }
      case 'MISSILE': {
        const center = targetTile;
        const targetTiles = this.getAreaTiles(center, 1);
        targetTiles.forEach(tId => {
          const prop = this.state.propertyManager.getProperty(tId);
          if (prop && prop.level > 0) {
            prop.level--;
            events.push({ type: 'PROPERTY_CHANGED', tileId: tId, ownerId: prop.owner, level: prop.level });
          }
          this.state.players.filter(p => !p.isBankrupt && p.currentTile === tId).forEach(p => {
            if (this.state.gameMode === 'HEAT' && p.id !== player.id) {
              p.cash -= 1800;
              this.state.checkBankrupt(p);
            }
            const confinement = this.applyConfinement(p, 'HOSPITAL', 3, '飞弹伤害');
            if (!confinement.avoided) this.state.addLog(`🚀 飞弹轰炸！${confinement.recipient.name} 被炸伤住院 ${confinement.turns} 回合！`, 'danger');
          });
        });
        this.state.addLog(`🚀 飞弹对【${this.state.getTile(center).name}】区域造成了范围轰炸！`, 'danger');
        break;
      }
      case 'NUKES': {
        const center = targetTile;
        const radiusTiles = this.getAreaTiles(center, 2);
        radiusTiles.forEach(tId => {
          const prop = this.state.propertyManager.getProperty(tId);
          if (prop) {
            prop.level = 0;
            events.push({ type: 'PROPERTY_CHANGED', tileId: tId, ownerId: prop.owner, level: 0 });
          }
          this.state.players.filter(p => !p.isBankrupt && p.currentTile === tId).forEach(p => {
            if (this.state.gameMode === 'HEAT' && p.id !== player.id) {
              p.cash -= 4000;
              this.state.checkBankrupt(p);
            }
            const confinement = this.applyConfinement(p, 'HOSPITAL', 5, '核弹伤害');
            if (!confinement.avoided) this.state.addLog(`☢️ 核弹毁灭打击！${confinement.recipient.name} 受到重创住院 ${confinement.turns} 回合！`, 'danger');
          });
        });
        this.state.addLog(`☢️ 核弹爆发！【${this.state.getTile(center).name}】周围建筑化为平地！`, 'danger');
        break;
      }
      case 'MINE': {
        const prop = this.state.propertyManager.getProperty(targetTile);
        if (prop) {
          prop.hasMine = true;
          events.push({ type: 'MINE_PLACED', tileId: targetTile });
          this.state.addLog(`💣 成功在【${this.state.getTile(targetTile).name}】安放了隐蔽地雷！`, 'accent');
        }
        break;
      }
      case 'HIBERNATE': {
        this.state.players.filter(p => !p.isBankrupt && p.id !== player.id).forEach(p => {
          p.hibernateTurns = this.getNegativeDuration(p, 3);
          this.state.addLog(`❄️ ${p.name} 陷入了沉睡冬眠状态！`, 'danger');
        });
        break;
      }
      case 'SLEEPWALK': {
        targetPlayer.sleepwalkTurns = this.getNegativeDuration(targetPlayer, 3);
        this.state.addLog(`🌙 ${targetPlayer.name} 进入梦游状态，将自动随机行动并免付过路费！`, 'accent');
        break;
      }
      case 'LAND_BUY': {
        const prop = this.state.propertyManager.getProperty(targetTile);
        const tile = this.state.getTile(targetTile);
        if (prop && prop.owner === null) {
          const cost = tile.price || 1000;
          if (player.cash >= cost) {
            player.cash -= cost;
            prop.owner = player.id;
            prop.level = 0;
            events.push({ type: 'PROPERTY_CHANGED', tileId: targetTile, ownerId: player.id, level: 0 });
            this.state.addLog(`📜 ${player.name} 使用购地卡成功买下【${tile.name}】！`, 'gold');
          }
        }
        break;
      }
      case 'SWAP_LAND': {
        const myTile = player.currentTile;
        const myProp = this.state.propertyManager.getProperty(myTile);
        const targetProp = this.state.propertyManager.getProperty(targetTile);
        if (myProp && targetProp && myProp.owner === player.id) {
          const tempOwner = myProp.owner;
          myProp.owner = targetProp.owner;
          targetProp.owner = tempOwner;
          events.push({ type: 'PROPERTY_CHANGED', tileId: myTile, ownerId: myProp.owner, level: myProp.level });
          events.push({ type: 'PROPERTY_CHANGED', tileId: targetTile, ownerId: targetProp.owner, level: targetProp.level });
          this.state.addLog(`🔀 成功与对手交换了【${this.state.getTile(targetTile).name}】的产权！`, 'gold');
        }
        break;
      }
      case 'TRANSFER_CARD': {
        player.penaltyTransferTargetId = targetPlayer.id;
        this.state.addLog(`🃏 ${player.name} 布置【嫁祸卡】：下一次扣款、入狱或灾难将转嫁给 ${targetPlayer.name}！`, 'accent');
        break;
      }
      case 'IMMUNITY_CARD': {
        player.jailTurns = 0;
        player.hospitalTurns = 0;
        player.hibernateTurns = 0;
        player.sleepwalkTurns = 0;
        player.isSleepwalkingThisTurn = false;
        player.negativeImmuneTurns = 3;
        this.state.addLog(`🏛️ ${player.name} 使用【免罪卡】恢复自由并获得免疫保护！`, 'gold');
        break;
      }
      case 'SUMMON_GOD': {
        const gods = ['FORTUNE', 'LUCK', 'EARTH', 'ANGEL'];
        const chosen = this.state.rng.pick(gods);
        player.godType = chosen;
        player.godTurns = player.skillName === '石油大亨' ? 5 : 4;
        this.state.addLog(`🧧 虔诚祈祷！${player.name} 成功召唤【${chosen}】吉神附体 ${player.godTurns} 回合！`, 'gold');
        events.push({ type: 'STATUS_CHANGED', playerId: player.id, status: chosen });
        break;
      }
      case 'BANISH_GOD': {
        player.godType = null;
        player.godTurns = 0;
        this.state.addLog(`💨 ${player.name} 使用【送神符】驱散了身上的负面神仙！`, 'accent');
        events.push({ type: 'STATUS_CHANGED', playerId: player.id, status: null });
        break;
      }
      default:
        return { success: false, reason: '该卡片效果尚未注册' };
    }

    player.cards.splice(player.cards.indexOf(cardId), 1);
    this.state.addLog(`🃏 ${player.name} 使用了【${card.name}】。`, 'accent');
    events.unshift({ type: 'CARD_USED', playerId: player.id, cardId, targetId });
    return { success: true, type: 'CARD_USED', playerId: player.id, cardId, followUp, events };
  }

  autoSave() {
    return this.saves.saveAuto(this.state.createSnapshot());
  }

  saveManual(name) {
    return this.saves.saveManual(this.state.createSnapshot(), name);
  }

  restore(snapshot) {
    this.state.restoreSnapshot(snapshot);
    this.emit({ type: 'GAME_RESTORED' });
  }
}
