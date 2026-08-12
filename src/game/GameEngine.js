import { CardRules } from './CardRules.js';
import { SaveManager } from './SaveManager.js';
import { TileType, isPropertyTile } from './BoardData.js';
import { cardManager } from './CardManager.js';
import { MAX_PROPERTY_LEVEL } from './GameRules.js';
import { validateCommand } from './CommandPolicy.js';
import { BUILDINGS, COMPANIES, ITEMS, MAGIC_CONDITIONS, MAGIC_EFFECTS, MINIGAMES } from './ContentRegistry.js';
import { CARD_CAPACITY, ITEM_CAPACITY } from './InventoryManager.js';
import { clampMinigameScore } from './MinigameRules.js';
import { createAuctionState, getMinimumAuctionBid, normalizeAuctionState } from './AuctionRules.js';
import { estimateStockSaleRevenue, getSuggestedStockShares } from './DebtRules.js';
import { MARKET_MAX_RATE, MARKET_MIN_RATE, MARKET_OFFER_DURATION, MARKET_OFFER_LIMIT, canReceiveMarketAsset, getMarketAsset, normalizeMarketOffer, recordMarketHistory, validateMarketOffer } from './MarketRules.js';
import { hasChairmanPerk } from './CompanyRules.js';
import { getModePropertyCostMultiplier, getModeStartBonus } from './ModeRules.js';
import { getCardShopOffer, isOfferedAtShop } from './ShopRules.js';
import { applyCommercialFacilityVisit } from './CommercialFacilityRules.js';

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
      const gap = Math.max(0, this.state.pendingDebt.amountDue - player.cash);
      if ((player.deposit || 0) > 0) actions.push({ type: 'LIQUIDATE_DEPOSIT', enabled: true, amount: Math.min(player.deposit, gap) });
      for (const [stockId, holding] of Object.entries(player.stocks || {})) {
        const stock = this.state.stockMarket.stocks.find(item => item.id === stockId);
        const shares = getSuggestedStockShares(player, stock, holding, gap);
        if (shares > 0) actions.push({ type: 'SELL_STOCK', enabled: true, stockId, shares, estimatedRevenue: estimateStockSaleRevenue(player, stock, shares) });
      }
      for (const [tileId, property] of this.state.propertyManager.properties) {
        if (property.owner !== player.id) continue;
        if (property.level > 0) actions.push({ type: 'SELL_BUILDING', enabled: true, tileId });
        if (!property.isMortgaged && property.level === 0) actions.push({ type: 'MORTGAGE_PROPERTY', enabled: true, tileId });
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
    actions.push(
      { type: 'SELECT_DICE_COUNT', enabled: preRoll },
      { type: 'BUY_ITEM', enabled: preRoll && player.cardPoints > 0 },
      { type: 'USE_ITEM', enabled: preRoll && (player.items?.length || 0) > 0 },
      { type: 'CREATE_MARKET_OFFER', enabled: preRoll },
      { type: 'ACCEPT_MARKET_OFFER', enabled: preRoll && this.state.marketOffers.some(offer => offer.sellerId !== player.id) },
      { type: 'CANCEL_MARKET_OFFER', enabled: preRoll && this.state.marketOffers.some(offer => offer.sellerId === player.id) }
    );
    const ownedProperties = [...this.state.propertyManager.properties.values()].filter(property => property.owner === player.id);
    actions.push(
      { type: 'SELL_BUILDING', enabled: preRoll && ownedProperties.some(property => property.level > 0) },
      { type: 'MORTGAGE_PROPERTY', enabled: preRoll && ownedProperties.some(property => !property.isMortgaged && property.level === 0) },
      { type: 'REDEEM_PROPERTY', enabled: preRoll && ownedProperties.some(property => property.isMortgaged) },
      { type: 'CHOOSE_BUILDING_TYPE', enabled: preRoll && ownedProperties.some(property => !property.isMortgaged) },
      { type: 'SET_COMPANY_POLICY', enabled: preRoll && this.state.companyManager.companies.some(company => company.chairmanId === player.id && !company.policyId) }
    );
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
        result = this.purchaseProperty(player, payload.tileId, payload.buildingType);
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
      case 'RESOLVE_MAGIC':
        result = this.resolveMagic(player, payload.conditionId, payload.effectId);
        break;
      case 'BUY_STOCK':
        result = this.tradeStock(player, 'BUY', payload.stockId, payload.shares);
        break;
      case 'SELL_STOCK':
        result = this.tradeStock(player, 'SELL', payload.stockId, payload.shares);
        break;
      case 'BUY_CARD':
        result = this.buyCard(player, payload.cardId, payload.tileId);
        break;
      case 'SELECT_DICE_COUNT':
        result = this.selectDiceCount(player, payload.count);
        break;
      case 'BUY_ITEM':
        result = this.buyItem(player, payload.itemId, payload.tileId);
        break;
      case 'SELL_INVENTORY':
        result = this.sellInventory(player, payload.kind, payload.contentId);
        break;
      case 'USE_ITEM':
        result = this.useItem(player, payload.itemId, payload.targetId, payload.value);
        break;
      case 'PLACE_ROAD_ENTITY':
        result = this.useItem(player, ({ BARRIER: 'BARRIER', MINE: 'MINE_ITEM', TIME_BOMB: 'TIME_BOMB' })[payload.entityType], payload.tileId);
        break;
      case 'CHOOSE_BUILDING_TYPE':
        result = this.chooseBuildingType(player, payload.tileId, payload.buildingType);
        break;
      case 'START_RESEARCH':
        result = this.startResearch(player, payload.tileId, payload.itemId);
        break;
      case 'START_AUCTION':
        result = this.startAuction(player, payload.tileId, payload.minimumBid);
        break;
      case 'PLACE_BID':
        result = this.placeBid(player, payload.amount);
        break;
      case 'CREATE_MARKET_OFFER':
        result = this.createMarketOffer(player, payload);
        break;
      case 'ACCEPT_MARKET_OFFER':
        result = this.acceptMarketOffer(player, payload.offerId);
        break;
      case 'CANCEL_MARKET_OFFER':
        result = this.cancelMarketOffer(player, payload.offerId);
        break;
      case 'SET_COMPANY_POLICY':
        result = this.setCompanyPolicy(player, payload.companyId, payload.policyId);
        break;
      case 'SUBMIT_MINIGAME_RESULT':
        result = this.submitMinigameResult(player, payload.gameId, payload.score);
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
      case 'LIQUIDATE_DEPOSIT':
        result = this.liquidateDeposit(player, payload.amount);
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
        if (this.state.pendingMove || this.state.pendingDebt) result = { success: false, reason: '仍有待完成操作' };
        else {
          const transition = this.state.nextTurn();
          const domainEvents = this.state.pendingDomainEvents.splice(0);
          result = { success: true, type: 'TURN_CHANGED', transition, events: [{ type: 'TURN_CHANGED', transition }, ...domainEvents] };
        }
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
    const vehicleLimit = player.vehicle === 'MOTOR' ? 2 : ['CAR', 'ENGINEER'].includes(player.vehicle) ? 3 : 1;
    const diceCount = Math.max(1, Math.min(vehicleLimit, Number(player.selectedDiceCount || vehicleLimit)));
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
    if (hasChairmanPerk(this.state, player.id, 'TRANSIT') && player.moveLimitThisTurn !== 1) {
      bonusSteps += 1;
      steps += 1;
      this.state.addLog(`🚝 ${player.name} 调用天际交通董事长专线，额外前进 1 步。`, 'gold');
    }
    if ((player.fuelBoostTurns || 0) > 0 && player.vehicle !== 'WALK' && player.moveLimitThisTurn !== 1) {
      bonusSteps += 1;
      steps += 1;
      player.fuelBoostTurns--;
      this.state.addLog(`⛽ ${player.name} 的能源调校生效，额外前进 1 步（剩余 ${player.fuelBoostTurns} 次）。`, 'gold');
    }
    this.state.phase = 'ROLLING';
    return { success: true, type: 'DICE_ROLLED', playerId: player.id, dice, steps, bonusSteps };
  }

  selectDiceCount(player, count) {
    const vehicleLimit = player.vehicle === 'MOTOR' ? 2 : ['CAR', 'ENGINEER'].includes(player.vehicle) ? 3 : 1;
    const selected = Number(count);
    if (!Number.isInteger(selected) || selected < 1 || selected > vehicleLimit) {
      return { success: false, reason: `当前载具最多使用 ${vehicleLimit} 颗骰子` };
    }
    player.selectedDiceCount = selected;
    return { success: true, type: 'DICE_COUNT_SELECTED', count: selected, vehicleLimit };
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
    this.state.roadEntities.filter(entity => entity.type === 'TIME_BOMB' && entity.data?.attachedPlayerId === player.id)
      .forEach(entity => { entity.tileId = selected; });
    pending.path.push(selected);
    pending.remainingSteps--;
    const events = [{ type: 'PLAYER_STEPPED', playerId: player.id, tileId: selected, remainingSteps: pending.remainingSteps }];

    if (selected === this.state.mapDefinition.spawnTile) {
      const amount = getModeStartBonus(this.state, player, this.state.mapDefinition.passBonus ?? 2000);
      player.cash += amount;
      events.push({ type: 'START_BONUS_GRANTED', playerId: player.id, amount });
      if (this.state.gameMode === 'TEAM') {
        this.state.players.filter(teammate => teammate.id !== player.id && teammate.teamId === player.teamId && !teammate.isBankrupt).forEach(teammate => {
          const teamBonus = Math.round(amount * 0.25);
          teammate.cash += teamBonus;
          events.push({ type: 'TEAM_START_DIVIDEND', playerId: teammate.id, sourcePlayerId: player.id, amount: teamBonus });
          this.state.addLog(`🤝 ${teammate.name} 获得 ${player.name} 的起点团队分红 $${teamBonus.toLocaleString()}。`, 'gold');
        });
      }
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
      confinement.recipient.vehicle = 'WALK';
      confinement.recipient.fuelBoostTurns = 0;
      confinement.recipient.selectedDiceCount = 1;
      events.push({ type: 'MINE_EXPLODED', playerId: confinement.recipient.id, tileId: selected, avoided: confinement.avoided });
      if (!confinement.avoided) this.state.addLog(`💣 轰！${confinement.recipient.name} 被地雷炸伤，住院 ${confinement.turns} 回合！`, 'danger');
    }

    const roadEntity = this.state.roadEntities.find(entity => entity.tileId === selected && !entity.data?.attachedPlayerId);
    if (roadEntity) {
      const roadEvents = this.resolveRoadEntity(player, roadEntity, pending);
      events.push(...roadEvents);
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

    if (player.vehicle === 'ENGINEER' && isPropertyTile(this.state.getTile(selected))
      && property.owner !== null && property.owner !== player.id && property.level > 0) {
      property.level--;
      this.state.assetRevision++;
      events.push({ type: 'PROPERTY_CHANGED', tileId: selected, ownerId: property.owner, level: property.level });
      this.state.addLog(`🚜 工程履带车拆除了【${this.state.getTile(selected).name}】1 层建筑。`, 'danger');
    }

    if (pending.remainingSteps <= 0) {
      this.state.pendingMove = null;
      this.state.phase = 'LANDING_ACTION';
      events.push({ type: 'MOVEMENT_FINISHED', playerId: player.id, tileId: selected });
    }
    return { success: true, type: events.at(-1).type, tileId: selected, remainingSteps: pending.remainingSteps, events };
  }

  resolveRoadEntity(player, entity, pending) {
    const events = [];
    const remove = () => {
      this.state.roadEntities = this.state.roadEntities.filter(item => item.id !== entity.id);
      events.push({ type: 'ROAD_ENTITY_CHANGED', entityId: entity.id, tileId: entity.tileId, removed: true });
    };
    if (entity.type === 'BARRIER') {
      pending.remainingSteps = 0;
      remove();
    } else if (entity.type === 'MINE') {
      pending.remainingSteps = 0;
      player.vehicle = 'WALK';
      player.fuelBoostTurns = 0;
      player.selectedDiceCount = 1;
      const confinement = this.applyConfinement(player, 'HOSPITAL', 3, '道路地雷');
      events.push({ type: 'MINE_EXPLODED', playerId: confinement.recipient.id, tileId: entity.tileId });
      remove();
    } else if (entity.type === 'TIME_BOMB') {
      entity.data = { ...(entity.data || {}), attachedPlayerId: player.id };
      entity.expiresRound = this.state.round + 3;
      events.push({ type: 'ROAD_ENTITY_CHANGED', entityId: entity.id, tileId: entity.tileId, attachedPlayerId: player.id });
    } else if (entity.type === 'GIFT_BOX') {
      const item = this.state.rng.pick(ITEMS.filter(definition => definition.cost !== null));
      if (item) this.state.inventoryManager.addItem(player, item.id);
      remove();
    } else if (entity.type === 'COUPON_CHEST') {
      player.cardPoints += 120;
      remove();
    } else if (entity.type === 'DOG') {
      if (player.vehicle === 'WALK') {
        pending.remainingSteps = 0;
        this.applyConfinement(player, 'HOSPITAL', 3, '流浪机械犬');
      }
      remove();
    } else if (entity.type === 'NPC') {
      player.cash += Number(entity.data?.cash || 600);
      remove();
    }
    return events;
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

  getItemAction(player, itemId) {
    const item = this.state.inventoryManager.getDefinition(itemId);
    if (!item || !player.items?.includes(itemId)) return { type: 'USE_ITEM', enabled: false, reason: '背包中没有该道具', targets: [] };
    if (player.id !== this.state.currentPlayerIndex || this.state.phase !== 'PRE_ROLL_ACTION') {
      return { type: 'USE_ITEM', enabled: false, reason: '只能在掷骰前使用道具', targets: [] };
    }
    let targets = [];
    if (['BARRIER', 'MINE_ITEM', 'TIME_BOMB'].includes(itemId)) {
      targets = this.state.mapRuntime.getReachable(player.currentTile, 10, [1, -1])
        .filter(({ id }) => !this.state.roadEntities.some(entity => entity.tileId === id && !entity.data?.attachedPlayerId))
        .map(({ id, distance }) => ({ id, label: this.state.getTile(id).name, description: `距离 ${distance} 格` }));
    } else if (itemId === 'ROBOT_DOLL') {
      targets = this.state.roadEntities.filter(entity => !entity.data?.attachedPlayerId)
        .map(entity => ({ id: entity.tileId, label: this.state.getTile(entity.tileId)?.name || `${entity.tileId}`, description: entity.type }));
    } else if (itemId === 'ROBOT_WORKER') {
      targets = [...this.state.propertyManager.properties.entries()]
        .filter(([, property]) => property.owner === player.id && property.level < MAX_PROPERTY_LEVEL)
        .map(([id, property]) => ({ id, label: this.state.getTile(id).name, description: `LV ${property.level}` }));
    } else if (['MISSILE_ITEM', 'NUCLEAR_MISSILE', 'TELEPORTER'].includes(itemId)) {
      targets = this.state.mapDefinition.tiles.map(tile => ({ id: tile.id, label: tile.name, description: tile.type }));
    }
    if (!['NONE', 'VALUE'].includes(item.targetType) && !targets.length) return { type: 'USE_ITEM', enabled: false, reason: '当前没有合法目标', targets };
    return { type: 'USE_ITEM', enabled: true, targets };
  }

  inspectLanding(player, tileId) {
    const tile = this.state.getTile(tileId);
    const property = this.state.propertyManager.getProperty(tileId);
    if (this.state.gameMode === 'HEAT' && isPropertyTile(tile)) return { kind: 'SPECIAL', tile, property };
    if (!isPropertyTile(tile)) return { kind: 'SPECIAL', tile, property };
    if (property.owner === null) return { kind: 'PURCHASE', tile, property };
    if (property.isMortgaged) return { kind: 'MORTGAGED', tile, property };
    const building = BUILDINGS.find(definition => definition.id === property.buildingType);
    const maxLevel = building?.maxLevel ?? MAX_PROPERTY_LEVEL;
    if (property.owner === player.id) {
      if (property.buildingType === 'LAB') return { kind: 'LAB', tile, property, researchOptions: this.getResearchOptions(property.level) };
      return { kind: property.level < maxLevel ? 'UPGRADE' : 'OWN_MAX', tile, property };
    }
    const owner = this.state.players[property.owner];
    if (this.state.gameMode === 'TEAM' && owner?.teamId === player.teamId) {
      return { kind: property.level < maxLevel ? 'UPGRADE' : 'OWN_MAX', tile, property, owner };
    }
    return { kind: 'RENT', tile, property, owner: this.state.players[property.owner] };
  }

  purchaseProperty(player, tileId, buildingType = null) {
    const tile = this.state.getTile(tileId);
    const property = this.state.propertyManager.getProperty(tileId);
    if (!tile || !isPropertyTile(tile) || property.owner !== null) {
      return { success: false, reason: '该地产当前不可购买' };
    }
    if (player.godType === 'BAD') {
      this.state.addLog(`📉 ${player.name} 受到衰运影响，买地失败！`, 'danger');
      return { success: false, reason: '衰运状态禁止买地' };
    }
    let cost = Math.round(tile.price * getModePropertyCostMultiplier(this.state.gameMode));
    if (player.godType === 'LUCK') cost = 0;
    else {
      if (player.skillName === '商业奇才') cost = Math.round(cost * 0.85);
      if (hasChairmanPerk(this.state, player.id, 'BUILD')) cost = Math.round(cost * 0.85);
    }
    if (player.cash < cost) {
      this.state.addLog(`⚠️ ${player.name} 现金不足，无法购买【${tile.name}】。`, 'danger');
      return { success: false, reason: '现金不足', cost };
    }
    if (tile.type === TileType.BIG_PROPERTY && buildingType && !BUILDINGS.some(building => building.id === buildingType)) {
      return { success: false, reason: '商业建筑类型无效' };
    }
    player.cash -= cost;
    this.state.propertyManager.buyProperty(tileId, player.id, buildingType);
    this.state.assetRevision++;
    this.state.addLog(`🏗️ ${player.name} 成功购买【${tile.name}】(花费 $${cost.toLocaleString()})！`, 'success');
    return { success: true, type: 'PROPERTY_PURCHASED', tileId, level: 0, cost, buildingType: this.state.propertyManager.getProperty(tileId).buildingType };
  }

  upgradeProperty(player, tileId) {
    const tile = this.state.getTile(tileId);
    const property = this.state.propertyManager.getProperty(tileId);
    const owner = this.state.players[property?.owner];
    const canTeamUpgrade = this.state.gameMode === 'TEAM' && owner?.teamId === player.teamId;
    const building = BUILDINGS.find(definition => definition.id === property?.buildingType);
    const maxLevel = building?.maxLevel ?? MAX_PROPERTY_LEVEL;
    if (!tile || (property.owner !== player.id && !canTeamUpgrade) || property.level >= maxLevel || property.isMortgaged) {
      return { success: false, reason: '该地产当前不可升级' };
    }
    if (player.godType === 'BAD') {
      this.state.addLog(`📉 ${player.name} 受到衰运影响，升级失败！`, 'danger');
      return { success: false, reason: '衰运状态禁止升级' };
    }
    let cost = Math.round(tile.buildCost * (building?.buildMultiplier || 1) * getModePropertyCostMultiplier(this.state.gameMode));
    if (player.godType === 'LUCK') cost = 0;
    else {
      if (player.skillName === '商业奇才') cost = Math.round(cost * 0.85);
      else if (player.skillName === '商业神童') cost = Math.round(cost * 0.75);
      if (hasChairmanPerk(this.state, player.id, 'BUILD')) cost = Math.round(cost * 0.85);
    }
    if (player.cash < cost) {
      this.state.addLog(`⚠️ ${player.name} 现金不足，无法升级【${tile.name}】。`, 'danger');
      return { success: false, reason: '现金不足', cost };
    }
    player.cash -= cost;
    this.state.propertyManager.upgradeProperty(tileId);
    this.state.assetRevision++;
    this.state.addLog(`✨ ${player.name} 将【${tile.name}】升级至 LV ${property.level}(花费 $${cost.toLocaleString()})！`, 'gold');
    return { success: true, type: 'PROPERTY_UPGRADED', tileId, level: property.level, cost };
  }

  settleRent(player, tileId) {
    const tile = this.state.getTile(tileId);
    const property = this.state.propertyManager.getProperty(tileId);
    const owner = this.state.players[property.owner];
    if (!owner || owner.id === player.id) return { success: false, reason: '没有应付租金' };
    const withFacility = (result, paidAmount = 0) => {
      const facility = applyCommercialFacilityVisit(this.state, { visitor: player, owner, tileId, property, paidAmount });
      return facility ? { ...result, events: [{ ...result }, facility] } : result;
    };
    if (player.godType === 'FORTUNE' || player.rentShieldActiveThisTurn) {
      this.state.addLog(`🛡️ ${player.name} 的免租效果抵消了【${tile.name}】过路费！`, 'gold');
      return withFacility({ success: true, type: 'RENT_WAIVED', amount: 0 });
    }
    if (player.skillName === '股市高手' && this.state.rng.next() < 0.25) {
      this.state.addLog(`💎 ${player.name} 触发商业人脉，免除【${tile.name}】过路费！`, 'gold');
      return withFacility({ success: true, type: 'RENT_WAIVED', amount: 0 });
    }
    let amount = this.state.propertyManager.calculateToll(tileId, this.state.newsEffect, this.state.priceIndex, player);
    if (amount <= 0) {
      this.state.addLog(`🌿 ${player.name} 免费参观了【${tile.name}】。`, 'accent');
      return withFacility({ success: true, type: 'RENT_WAIVED', amount: 0 });
    }
    if (player.godType === 'MISFORTUNE' || player.godType === 'GREAT_POOR' || player.godType === 'SMALL_POOR') amount *= 2;
    if (owner.skillName === '土地公庇护') amount = Math.round(amount * 1.2);
    if (owner.skillName === '皇家威严') amount = Math.round(amount * 1.25);
    if (hasChairmanPerk(this.state, player.id, 'INSURANCE')) {
      const original = amount;
      amount = Math.max(1, Math.round(amount * 0.8));
      this.state.addLog(`🛟 蓝港保险为 ${player.name} 理赔 $${(original - amount).toLocaleString()} 租金。`, 'gold');
    }
    if (player.cash < amount) {
      this.cancelPlayerMarketOffers(player, 'DEBT_SETTLEMENT');
      this.state.pendingDebt = {
        debtorId: player.id,
        creditorId: owner.id,
        amountDue: amount,
        source: `RENT:${tileId}`,
        facilityVisit: BUILDINGS.some(building => building.id === property.buildingType)
          ? { tileId: Number(tileId), buildingType: property.buildingType }
          : null
      };
      this.state.phase = 'DEBT_SETTLEMENT';
      this.state.addLog(`⚠️ ${player.name} 需要筹集 $${amount.toLocaleString()} 支付租金。`, 'danger');
      return { success: true, type: 'DEBT_REQUIRED', amountDue: amount, ownerId: owner.id };
    }
    player.cash -= amount;
    owner.cash += amount;
    this.state.addLog(`💸 ${player.name} 向 ${owner.name} 支付【${tile.name}】过路费 $${amount.toLocaleString()}！`, 'danger');
    return withFacility({ success: true, type: 'RENT_PAID', amount, amountDue: amount, ownerId: owner.id }, amount);
  }

  sellBuilding(player, tileId) {
    const canManage = this.state.phase === 'PRE_ROLL_ACTION' && this.state.currentPlayerIndex === player.id;
    if (this.state.pendingDebt?.debtorId !== player.id && !canManage) return { success: false, reason: '当前不能处置资产' };
    const property = this.state.propertyManager.getProperty(Number(tileId));
    const tile = this.state.getTile(Number(tileId));
    if (!property || property.owner !== player.id || property.level <= 0) return { success: false, reason: '没有可出售建筑' };
    if (this.isPropertyListed(tileId)) return { success: false, reason: '地产挂牌中，请先撤销挂牌' };
    if (this.state.researchTasks.some(task => task.tileId === Number(tileId))) return { success: false, reason: '研究所仍有研发任务' };
    property.level--;
    const building = BUILDINGS.find(definition => definition.id === property.buildingType);
    const recoveryRate = hasChairmanPerk(this.state, player.id, 'MATERIAL') ? 0.65 : 0.5;
    const value = Math.round((tile.buildCost || 0) * (building?.buildMultiplier || 1) * recoveryRate);
    player.cash += value;
    this.state.assetRevision++;
    this.state.addLog(`🏗️ ${player.name} 出售【${tile.name}】一层建筑，回笼 $${value.toLocaleString()}。`, 'accent');
    return { success: true, type: 'ASSET_LIQUIDATED', kind: 'BUILDING', tileId: Number(tileId), level: property.level, value };
  }

  mortgageProperty(player, tileId) {
    const canManage = this.state.phase === 'PRE_ROLL_ACTION' && this.state.currentPlayerIndex === player.id;
    if (this.state.pendingDebt?.debtorId !== player.id && !canManage) return { success: false, reason: '当前不能抵押' };
    const property = this.state.propertyManager.getProperty(Number(tileId));
    const tile = this.state.getTile(Number(tileId));
    if (!property || property.owner !== player.id || property.isMortgaged || property.level > 0) {
      return { success: false, reason: '需先出售全部建筑才能抵押' };
    }
    if (this.isPropertyListed(tileId)) return { success: false, reason: '地产挂牌中，请先撤销挂牌' };
    if (this.state.researchTasks.some(task => task.tileId === Number(tileId))) return { success: false, reason: '研究所仍有研发任务' };
    const value = Math.round((tile.price || 0) * 0.5);
    property.isMortgaged = true;
    property.mortgageValue = value;
    player.cash += value;
    this.state.assetRevision++;
    this.state.addLog(`🏦 ${player.name} 抵押【${tile.name}】，获得 $${value.toLocaleString()}。`, 'accent');
    return { success: true, type: 'PROPERTY_MORTGAGED', tileId: Number(tileId), value };
  }

  liquidateDeposit(player, amount = null) {
    const debt = this.state.pendingDebt;
    if (!debt || debt.debtorId !== player.id) return { success: false, reason: '当前无需动用存款' };
    const gap = Math.max(0, debt.amountDue - player.cash);
    const value = Math.min(player.deposit || 0, gap, Math.max(0, Number(amount ?? gap)));
    if (!value) return { success: false, reason: '没有可提取的存款' };
    player.deposit -= value;
    player.cash += value;
    this.state.addLog(`🏦 ${player.name} 提取存款 $${value.toLocaleString()} 用于偿债。`, 'accent');
    return { success: true, type: 'ASSET_LIQUIDATED', kind: 'DEPOSIT', value };
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
    this.state.addLog(`🔓 ${player.name} 支付 $${cost.toLocaleString()} 赎回【${this.state.getTile(Number(tileId))?.name}】。`, 'gold');
    return { success: true, type: 'PROPERTY_REDEEMED', tileId: Number(tileId), cost };
  }

  isPropertyListed(tileId) {
    return this.state.marketOffers.some(offer => offer.kind === 'PROPERTY' && Number(offer.contentId) === Number(tileId));
  }

  cancelPlayerMarketOffers(player, reason = 'CANCELLED') {
    const cancelled = this.state.marketOffers.filter(offer => offer.sellerId === player.id);
    if (!cancelled.length) return [];
    this.state.marketOffers = this.state.marketOffers.filter(offer => offer.sellerId !== player.id);
    cancelled.forEach(offer => recordMarketHistory(this.state, { type: 'CANCELLED', ...offer, round: this.state.round, reason }));
    this.state.addLog(`↩️ ${player.name} 的 ${cancelled.length} 笔挂牌因资产处置而撤销。`, 'accent');
    this.state.assetRevision++;
    return cancelled;
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
    const result = { success: true, type: 'DEBT_PAID', amount: paid, creditorId: creditor?.id ?? null };
    const facilityTileId = debt.facilityVisit?.tileId;
    const property = facilityTileId === undefined ? null : this.state.propertyManager.getProperty(facilityTileId);
    const owner = property ? this.state.players[property.owner] : null;
    const facility = property?.buildingType === debt.facilityVisit?.buildingType && owner
      ? applyCommercialFacilityVisit(this.state, { visitor: player, owner, tileId: facilityTileId, property, paidAmount: paid })
      : null;
    return facility ? { ...result, events: [{ ...result }, facility] } : result;
  }

  autoSettleDebt(player) {
    const debt = this.state.pendingDebt;
    if (!debt || debt.debtorId !== player.id) return { success: false, reason: '没有待处理债务' };
    const events = [];
    if (player.cash < debt.amountDue && (player.deposit || 0) > 0) {
      const withdrawn = this.liquidateDeposit(player);
      if (withdrawn.success) events.push(withdrawn);
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
        const stock = this.state.stockMarket.stocks.find(item => item.id === stockId);
        const quantity = getSuggestedStockShares(player, stock, player.stocks[stockId], debt.amountDue - player.cash);
        const sold = this.tradeStock(player, 'SELL', stockId, quantity);
        if (sold.success) events.push(...(sold.events || []));
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
      events.push(...(paid.events || [{ type: 'DEBT_PAID', amount: paid.amount, creditorId: paid.creditorId }]));
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
      this.state.bankruptcyAuctionQueue.push({
        tileId,
        level: property.level,
        buildingType: property.buildingType,
        creditorId: creditor?.id ?? null
      });
      property.owner = null;
      property.isMortgaged = false;
      property.mortgageValue = 0;
      events.push({ type: 'ASSET_LIQUIDATED', kind: 'PROPERTY_AUCTION', playerId: player.id, tileId, value: 0 });
    });
    player.stocks = {};
    player.deposit = 0;
    player.cards = [];
    player.items = [];
    player.cardPoints = 0;
    player.vehicle = 'WALK';
    player.hotelTurns = 0;
    player.fuelBoostTurns = 0;
    player.isBankrupt = true;
    this.state.pendingDebt = null;
    this.state.phase = 'LANDING_ACTION';
    this.state.assetRevision++;
    events.push({ type: 'PLAYER_BANKRUPT', playerId: player.id });
    this.state.checkWinCondition();
    if (this.state.phase !== 'GAME_OVER') this.startNextBankruptcyAuction();
    return { success: true, type: 'PLAYER_BANKRUPT', amountPaid: paid, events, auction: structuredClone(this.state.auction) };
  }

  startNextBankruptcyAuction() {
    const lot = this.state.bankruptcyAuctionQueue.shift();
    if (!lot) return null;
    const bidders = this.state.players.filter(player => !player.isBankrupt).map(player => player.id);
    const tile = this.state.getTile(lot.tileId);
    if (!bidders.length || !tile) {
      const property = this.state.propertyManager.getProperty(lot.tileId);
      if (property) { property.level = 0; property.buildingType = tile?.type === TileType.BIG_PROPERTY ? null : 'RESIDENTIAL'; }
      return this.startNextBankruptcyAuction();
    }
    this.state.phaseBeforeAuction = 'LANDING_ACTION';
    this.state.phase = 'AUCTION';
    this.state.auction = createAuctionState({
      id: `BANKRUPTCY_${this.state.round}_${lot.tileId}`,
      sellerId: null,
      beneficiaryId: lot.creditorId,
      bankruptcy: true,
      tileId: lot.tileId,
      minimumBid: Math.ceil(Math.max(100, (tile.price + (tile.buildCost || 0) * lot.level) * 0.45) / 100) * 100,
      bidderOrder: bidders,
    });
    return this.state.auction;
  }

  resolveSpecialLanding(player, tileId) {
    const tile = this.state.getTile(tileId);
    const duration = player.skillName === '石油大亨' ? 4 : 3;
    if (this.state.gameMode === 'HEAT' && (isPropertyTile(tile) || tile.type === TileType.ROAD)) {
      const attackCards = ['MISSILE', 'MINE', 'NUKES', 'OBSTACLE', 'TURTLE'];
      const reward = this.state.rng.pick(attackCards);
      if (player.cards.length < CARD_CAPACITY) player.cards.push(reward);
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
      if (player.cards.length < CARD_CAPACITY) player.cards.push(card.id);
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
      const offer = getCardShopOffer(this.state, tileId);
      let amount = player.skillName === '疾风忍术' ? 120 : 60;
      if (player.skillName === '棒球活力') amount += 40;
      player.cardPoints += amount;
      offer.bonusPoints = amount;
      this.state.addLog(`🏬 ${player.name} 到访【${offer.tileName}】，领取 ${amount} 点券并开启本轮限定货架。`, 'accent');
      return { type: 'CARD_SHOP_OFFER', amount, offer };
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
        conditions: MAGIC_CONDITIONS.map(condition => ({ id: condition.id, label: condition.name })),
        effects: MAGIC_EFFECTS.map(effect => ({ id: effect.id, label: effect.name })),
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
    if (tile.type === TileType.COMPANY) {
      const company = this.state.companyManager.get(tile.companyId);
      if (!company) return { type: 'NO_ACTION' };
      const isChairman = company.chairmanId === player.id;
      const fee = isChairman ? 0 : Math.min(player.cash, Math.round(company.baseFee * this.state.priceIndex));
      player.cash -= fee;
      this.state.companyManager.recordRevenue(company.id, fee);
      if (isChairman && company.perk === 'SHOP') {
        const gift = this.state.rng.pick(ITEMS.filter(item => item.cost !== null));
        if (gift) this.state.inventoryManager.addItem(player, gift.id);
      }
      this.state.addLog(isChairman
        ? `🏢 ${player.name} 以董事长身份视察【${company.name}】。`
        : `🏢 ${player.name} 在【${company.name}】消费 $${fee.toLocaleString()}。`, isChairman ? 'gold' : 'accent');
      return { type: 'COMPANY_VISIT', companyId: company.id, fee, chairmanId: company.chairmanId };
    }
    if (tile.type === TileType.MINIGAME) {
      this.state.minigameState = { playerId: player.id, gameId: tile.minigameId, tileId, status: 'OPEN' };
      return { type: 'MINIGAME_OFFER', gameId: tile.minigameId };
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
      const specialChance = this.resolveChanceEffect(player, chance);
      if (specialChance) return specialChance;
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
        if (player.cards.length < CARD_CAPACITY) {
          player.cards.push(card.id);
          cards.push(card.id);
        }
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

  resolveChanceEffect(player, chance) {
    if (!chance.kind) return null;
    const signed = chance.isGain ? Math.abs(chance.amount || 0) : -Math.abs(chance.amount || 0);
    if (!chance.isGain && player.negativeImmuneActiveThisTurn) {
      return { type: 'NEGATIVE_BLOCKED', chance };
    }
    switch (chance.kind) {
      case 'CARD_POINTS':
        player.cardPoints = Math.max(0, (player.cardPoints || 0) + signed);
        return { type: 'INVENTORY_CHANGED', inventory: 'CARD_POINTS', amount: signed, chance };
      case 'ITEM':
      case 'RESEARCH_ITEM': { // Research items can also enter the normal item inventory as prototypes.
        const pool = Object.values(ITEMS).filter(item => chance.kind === 'RESEARCH_ITEM' ? item.researchLevel : item.buyable);
        const item = this.state.rng.pick(pool);
        const added = item ? this.state.inventoryManager.addItem(player, item.id) : { success: false };
        return { type: 'INVENTORY_CHANGED', inventory: 'ITEM', itemId: added.success ? item.id : null, full: !added.success, chance };
      }
      case 'ITEM_LOSS': {
        const itemId = this.state.rng.pick(player.items || []);
        if (itemId) this.state.inventoryManager.removeItem(player, itemId);
        return { type: 'INVENTORY_CHANGED', inventory: 'ITEM', itemId, removed: Boolean(itemId), chance };
      }
      case 'CARD': {
        const card = this.state.rng.pick(cardManager.getAllCards());
        const added = Boolean(card && player.cards.length < CARD_CAPACITY);
        if (added) player.cards.push(card.id);
        return { type: 'INVENTORY_CHANGED', inventory: 'CARD', cardId: added ? card.id : null, full: !added, chance };
      }
      case 'VEHICLE':
        player.vehicle = chance.vehicle || 'WALK';
        player.fuelBoostTurns = 0;
        player.selectedDiceCount = Math.min(player.selectedDiceCount || 1, player.vehicle === 'CAR' ? 3 : player.vehicle === 'MOTOR' ? 2 : 1);
        return { type: 'STATUS_CHANGED', playerId: player.id, status: player.vehicle, chance };
      case 'HOSPITAL': {
        player.vehicle = 'WALK';
        player.fuelBoostTurns = 0;
        player.selectedDiceCount = 1;
        const confinement = this.applyConfinement(player, 'HOSPITAL', chance.amount || 2, chance.title);
        return { type: confinement.avoided ? 'NEGATIVE_BLOCKED' : 'HOSPITALIZED', playerId: confinement.recipient.id, duration: confinement.turns, chance };
      }
      case 'IMMUNITY':
        player.negativeImmuneTurns = Math.max(player.negativeImmuneTurns || 0, chance.amount || 3);
        return { type: 'STATUS_CHANGED', playerId: player.id, status: 'IMMUNITY', duration: player.negativeImmuneTurns, chance };
      case 'ROAD_BARRIER': {
        const target = this.state.mapRuntime.projectPath(player.currentTile, 1, player.direction || 1)[0];
        if (Number.isInteger(target) && !this.state.roadEntities.some(entity => entity.tileId === target && !entity.data?.attachedPlayerId)) {
          this.state.roadEntities.push({ id: `road-${this.state.rng.int(1, 1_000_000_000)}`, type: 'BARRIER', tileId: target, ownerId: null, expiresRound: this.state.round + 4, data: { source: 'CHANCE' } });
        }
        return { type: 'ROAD_ENTITY_CHANGED', tileId: target, entityType: 'BARRIER', chance };
      }
      case 'STOCK':
        this.state.stockMarket.forceStockSurge(chance.stockId, Boolean(chance.isGain));
        return { type: 'STOCK_CHANGED', stockId: chance.stockId, chance };
      case 'COMPANY': {
        const company = this.state.companyManager.get(chance.companyId);
        const amount = Math.abs(chance.amount || 0);
        if (chance.isGain) {
          player.cash += amount;
          if (company) company.treasury = Math.max(0, company.treasury - amount);
        } else {
          const paid = Math.min(player.cash, amount);
          player.cash -= paid;
          if (company) company.treasury += paid;
        }
        return { type: 'COMPANY_SETTLED', companyId: chance.companyId, amount: signed, chance };
      }
      case 'PROPERTY_UP':
      case 'PROPERTY_DOWN': {
        const owned = [...this.state.propertyManager.properties.values()].filter(property => property.owner === player.id && property.level > 0);
        const property = this.state.rng.pick(owned);
        const building = BUILDINGS.find(definition => definition.id === property?.buildingType);
        if (property) property.level = Math.max(1, Math.min(building?.maxLevel || 4, property.level + (chance.kind === 'PROPERTY_UP' ? 1 : -1)));
        return { type: 'PROPERTY_CHANGED', tileId: property?.tileId ?? null, ownerId: player.id, level: property?.level ?? null, chance };
      }
      case 'LOTTERY': {
        const number = this.state.rng.int(1, 10);
        this.state.lottery.tickets.push({ playerId: player.id, number });
        return { type: 'LOTTERY_BOUGHT', number, cost: 0, pot: this.state.lottery.pot, chance };
      }
      case 'DEPOSIT':
        player.deposit = Math.max(0, (player.deposit || 0) + signed);
        return { type: 'BANK_TRANSFERRED', direction: chance.isGain ? 'DEPOSIT_REWARD' : 'DEPOSIT_FEE', amount: Math.abs(signed), chance };
      case 'GOD': {
        const god = this.state.rng.pick(['LUCK', 'FORTUNE', 'EARTH', 'ANGEL', 'BUILD']);
        player.godType = god;
        player.godTurns = chance.amount || 3;
        return { type: 'STATUS_APPLIED', status: god, duration: player.godTurns, chance };
      }
      default:
        return null;
    }
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

  resolveMagic(player, conditionId, effectId) {
    if (!MAGIC_CONDITIONS.some(condition => condition.id === conditionId)
      || !MAGIC_EFFECTS.some(effect => effect.id === effectId)) {
      return { success: false, reason: '魔法条件或效果无效' };
    }
    const active = this.state.players.filter(item => !item.isBankrupt);
    const byAssets = list => [...list].sort((a, b) => this.state.calculateNetWorth(b) - this.state.calculateNetWorth(a));
    const byLand = list => [...list].sort((a, b) => {
      const count = ownerId => [...this.state.propertyManager.properties.values()].filter(property => property.owner === ownerId).length;
      return count(b.id) - count(a.id);
    });
    const targetsByCondition = {
      SELF: [player],
      RICH_CASH: [...active].sort((a, b) => b.cash - a.cash).slice(0, 1),
      POOR_CASH: [...active].sort((a, b) => a.cash - b.cash).slice(0, 1),
      RICH_ASSET: byAssets(active).slice(0, 1),
      MOST_LAND: byLand(active).slice(0, 1),
      MOST_DEPOSIT: [...active].sort((a, b) => (b.deposit || 0) - (a.deposit || 0)).slice(0, 1),
      HAS_VEHICLE: active.filter(item => item.vehicle !== 'WALK'),
      ON_FOOT: active.filter(item => item.vehicle === 'WALK'),
      HAS_GOD: active.filter(item => item.godType),
      ALL_OPPONENTS: active.filter(item => item.id !== player.id)
    };
    const targets = targetsByCondition[conditionId] || [];
    targets.forEach(target => {
      if (effectId === 'CASH_RAIN') target.cash += 800;
      else if (effectId === 'DEPOSIT_ALL') { target.deposit += target.cash; target.cash = 0; }
      else if (effectId === 'GAIN_CARD' && target.cards.length < CARD_CAPACITY) target.cards.push(this.state.rng.pick(cardManager.getAllCards()).id);
      else if (effectId === 'GAIN_ITEM') this.state.inventoryManager.addItem(target, this.state.rng.pick(ITEMS).id);
      else if (effectId === 'STOP_ONE') target.hibernateTurns = Math.max(target.hibernateTurns, 1);
      else if (effectId === 'HOSPITAL') this.applyConfinement(target, 'HOSPITAL', 3, '魔法屋');
      else if (effectId === 'TURN_AROUND') target.direction *= -1;
      else if (effectId === 'PROPERTY_BOOM') {
        this.state.propertyManager.properties.forEach((property, tileId) => {
          if (property.owner === target.id) this.state.propertyManager.upgradeProperty(tileId);
        });
      } else if (effectId === 'DEMOLISH_ONE') {
        const owned = [...this.state.propertyManager.properties.entries()].filter(([, property]) => property.owner === target.id && property.level > 0);
        const selected = this.state.rng.pick(owned);
        if (selected) selected[1].level--;
      }
    });
    if (effectId === 'GOD_SHUFFLE' && targets.length) {
      const gods = targets.map(target => ({ godType: target.godType, godTurns: target.godTurns }));
      targets.forEach((target, index) => Object.assign(target, gods[(index + 1) % gods.length]));
    }
    this.state.assetRevision++;
    this.state.addLog(`🔮 ${player.name} 对“${MAGIC_CONDITIONS.find(item => item.id === conditionId).name}”发动“${MAGIC_EFFECTS.find(item => item.id === effectId).name}”。`, 'gold');
    return { success: true, type: 'MAGIC_CAST', conditionId, effectId, targetIds: targets.map(target => target.id) };
  }

  getResearchOptions(level) {
    return ITEMS.filter(item => item.researchLevel && item.researchLevel <= level + 1);
  }

  chooseBuildingType(player, tileId, buildingType) {
    const property = this.state.propertyManager.getProperty(Number(tileId));
    if (!property || property.owner !== player.id) return { success: false, reason: '只能改建自己的地产' };
    if (property.isMortgaged) return { success: false, reason: '抵押地产不能改建' };
    if (this.isPropertyListed(tileId)) return { success: false, reason: '地产挂牌中，请先撤销挂牌' };
    if (this.state.researchTasks.some(task => task.tileId === Number(tileId)) && property.buildingType !== buildingType) {
      return { success: false, reason: '研究所仍有研发任务' };
    }
    const previous = property.buildingType;
    const previousLevel = property.level;
    const changed = this.state.propertyManager.setBuildingType(Number(tileId), String(buildingType));
    if (!changed) return { success: false, reason: '建筑类型不适用于该地产' };
    const cost = previous && previous !== property.buildingType ? Math.round((this.state.getTile(Number(tileId)).buildCost || 0) * 0.25) : 0;
    if (player.cash < cost) {
      property.buildingType = previous;
      property.level = previousLevel;
      return { success: false, reason: '现金不足', cost };
    }
    player.cash -= cost;
    this.state.assetRevision++;
    this.state.addLog(`🏗️ ${player.name} 将【${this.state.getTile(Number(tileId))?.name}】改建为 ${BUILDINGS.find(item => item.id === property.buildingType)?.name || (property.buildingType === 'CHAIN_STORE' ? '连锁店' : '住宅')}。`, 'gold');
    return { success: true, type: 'PROPERTY_CHANGED', tileId: Number(tileId), buildingType: property.buildingType, cost };
  }

  startResearch(player, tileId, itemId) {
    const property = this.state.propertyManager.getProperty(Number(tileId));
    const item = ITEMS.find(definition => definition.id === itemId);
    if (!property || property.owner !== player.id || property.buildingType !== 'LAB') return { success: false, reason: '必须在自己的研究所研发' };
    if (!item?.researchLevel || item.researchLevel > property.level + 1) return { success: false, reason: '研究所等级不足' };
    if (this.state.researchTasks.some(task => task.playerId === player.id && task.tileId === Number(tileId))) return { success: false, reason: '研究所已有任务' };
    const task = {
      id: `RESEARCH_${this.state.round}_${player.id}_${itemId}`,
      playerId: player.id,
      tileId: Number(tileId),
      itemId,
      roundsRemaining: Math.max(1, (item.researchRounds || 1) - (hasChairmanPerk(this.state, player.id, 'TECH') ? 1 : 0))
    };
    this.state.researchTasks.push(task);
    this.state.addLog(`🧪 ${player.name} 开始研发【${item.name}】，需要 ${task.roundsRemaining} 轮。`, 'accent');
    return { success: true, type: 'RESEARCH_STARTED', task };
  }

  buyItem(player, itemId, tileId = null) {
    const item = this.state.inventoryManager.getDefinition(itemId);
    if (!item || item.cost === null) return { success: false, reason: '该道具只能通过研究获得' };
    const shopVisit = this.getShopVisit(player, tileId);
    if (player.id !== this.state.currentPlayerIndex || (this.state.phase !== 'PRE_ROLL_ACTION' && !shopVisit)) {
      return { success: false, reason: '当前不能购买道具' };
    }
    if (shopVisit && !isOfferedAtShop(shopVisit, 'ITEM', itemId)) return { success: false, reason: '本轮货架没有该道具' };
    const cost = this.getItemCost(player, item, tileId);
    if (player.cardPoints < cost) return { success: false, reason: '点券不足', cost };
    const result = this.state.inventoryManager.addItem(player, itemId);
    if (result.success) {
      player.cardPoints -= cost;
      Object.assign(result, { type: 'INVENTORY_CHANGED', cost, itemId, shopTileId: shopVisit?.tileId ?? null });
    }
    if (result.success) this.state.addLog(`🧰 ${player.name} 购买了【${ITEMS.find(item => item.id === itemId)?.name}】。`, 'accent');
    return result;
  }

  getItemCost(player, item, tileId = null) {
    let cost = item.cost;
    if (hasChairmanPerk(this.state, player.id, 'SHOP')) cost *= 0.85;
    const offer = this.getShopVisit(player, tileId);
    if (offer) cost *= 1 - offer.discountRate;
    return Math.max(1, Math.round(cost));
  }

  sellInventory(player, kind, contentId) {
    if (kind === 'ITEM') return this.state.inventoryManager.sell(player, contentId);
    if (kind === 'CARD') {
      const index = player.cards.indexOf(contentId);
      const card = cardManager.getCardById(contentId);
      if (index < 0 || !card) return { success: false, reason: '没有该卡片' };
      player.cards.splice(index, 1);
      const revenue = Math.max(1, Math.round(card.cost * 0.5));
      player.cardPoints += revenue;
      return { success: true, type: 'INVENTORY_CHANGED', kind, contentId, revenue };
    }
    return { success: false, reason: '库存类型无效' };
  }

  placeRoadEntity(player, entityType, tileId) {
    const target = Number(tileId);
    if (!this.state.getTile(target)) return { success: false, reason: '道路目标无效' };
    if (this.state.roadEntities.some(entity => entity.tileId === target && !entity.data?.attachedPlayerId)) return { success: false, reason: '目标道路已有实体' };
    const entity = {
      id: `ENTITY_${this.state.round}_${player.id}_${this.state.rng.int(1000, 9999)}`,
      type: entityType,
      tileId: target,
      ownerId: player.id,
      data: {},
      expiresRound: entityType === 'TIME_BOMB' ? this.state.round + 3 : null
    };
    this.state.roadEntities.push(entity);
    return { success: true, type: 'ROAD_ENTITY_CHANGED', entity };
  }

  useItem(player, itemId, targetId = null, value = null) {
    const item = this.state.inventoryManager.getDefinition(itemId);
    if (!item || !player.items?.includes(itemId)) return { success: false, reason: '道具不存在' };
    let result = { success: true, type: 'ITEM_USED', itemId };
    if (itemId === 'MOTOR' || itemId === 'CAR') {
      player.vehicle = itemId;
      player.selectedDiceCount = itemId === 'CAR' ? 3 : 2;
    } else if (itemId === 'ENGINEERING_CAR') {
      player.vehicle = 'ENGINEER';
      player.selectedDiceCount = 3;
      player.engineeringTurns = 7;
    } else if (itemId === 'BARRIER' || itemId === 'MINE_ITEM' || itemId === 'TIME_BOMB') {
      const entityType = itemId === 'BARRIER' ? 'BARRIER' : itemId === 'MINE_ITEM' ? 'MINE' : 'TIME_BOMB';
      result = this.placeRoadEntity(player, entityType, targetId);
    } else if (itemId === 'ROBOT_DOLL') {
      const target = Number(targetId);
      const before = this.state.roadEntities.length;
      this.state.roadEntities = this.state.roadEntities.filter(entity => entity.tileId !== target || entity.data?.attachedPlayerId);
      result = before === this.state.roadEntities.length ? { success: false, reason: '目标没有可清除实体' } : { success: true, type: 'ROAD_ENTITY_CHANGED', tileId: target, removed: true };
    } else if (itemId === 'ROBOT_WORKER') {
      const property = this.state.propertyManager.getProperty(Number(targetId));
      if (!property || property.owner !== player.id || !this.state.propertyManager.upgradeProperty(Number(targetId))) result = { success: false, reason: '目标地产不可升级' };
      else result = { success: true, type: 'PROPERTY_CHANGED', tileId: Number(targetId), level: property.level };
    } else if (itemId === 'REMOTE_DICE_ITEM') {
      const steps = Number(value);
      if (!Number.isInteger(steps) || steps < 1 || steps > 6) return { success: false, reason: '指定步数无效' };
      this.state.phase = 'ROLLING';
      result = { success: true, type: 'ITEM_USED', itemId, followUp: { type: 'MOVE_REQUESTED', mode: 'ROLL', steps } };
    } else if (itemId === 'TELEPORTER') {
      if (!this.state.getTile(Number(targetId))) return { success: false, reason: '传送目标无效' };
      result = { success: true, type: 'ITEM_USED', itemId, followUp: { type: 'MOVE_REQUESTED', mode: 'TELEPORT', tileId: Number(targetId) } };
    } else if (itemId === 'MISSILE_ITEM' || itemId === 'NUCLEAR_MISSILE') {
      result = this.blastArea(player, Number(targetId), itemId === 'NUCLEAR_MISSILE' ? 2 : 1, itemId === 'NUCLEAR_MISSILE');
    } else if (itemId === 'TIME_MACHINE') {
      const checkpoint = this.state.turnCheckpoint;
      if (!checkpoint || checkpoint.playerId !== player.id) return { success: false, reason: '没有可回溯的回合记录' };
      Object.assign(player, {
        currentTile: checkpoint.currentTile,
        cash: checkpoint.cash,
        deposit: checkpoint.deposit,
        cards: structuredClone(checkpoint.cards),
        stocks: structuredClone(checkpoint.stocks),
        ...checkpoint.statuses
      });
    }
    if (!result.success) return result;
    this.state.inventoryManager.removeItem(player, itemId);
    this.state.assetRevision++;
    return { ...result, events: [{ type: 'INVENTORY_CHANGED', playerId: player.id, itemId }, ...(result.events || [])] };
  }

  blastArea(player, centerTileId, radius, destructive) {
    if (!this.state.getTile(centerTileId)) return { success: false, reason: '轰炸目标无效' };
    const events = [];
    this.getAreaTiles(centerTileId, radius).forEach(tileId => {
      const property = this.state.propertyManager.getProperty(tileId);
      if (property?.level > 0) {
        property.level = destructive ? 0 : property.level - 1;
        events.push({ type: 'PROPERTY_CHANGED', tileId, level: property.level });
      }
      this.state.players.filter(target => !target.isBankrupt && target.currentTile === tileId).forEach(target => {
        target.vehicle = 'WALK';
        target.fuelBoostTurns = 0;
        target.selectedDiceCount = 1;
        this.applyConfinement(target, 'HOSPITAL', destructive ? 5 : 3, destructive ? '聚变飞弹' : '战术飞弹');
      });
      this.state.roadEntities = this.state.roadEntities.filter(entity => entity.tileId !== tileId);
    });
    return { success: true, type: 'BLAST_RESOLVED', centerTileId, radius, destructive, events };
  }

  startAuction(player, tileId, minimumBid = null) {
    const property = this.state.propertyManager.getProperty(Number(tileId));
    const tile = this.state.getTile(Number(tileId));
    if (!property || property.owner !== player.id || !tile) return { success: false, reason: '只能拍卖自己的地产' };
    const bidders = this.state.players.filter(item => !item.isBankrupt && item.id !== player.id).map(item => item.id);
    if (!bidders.length) return { success: false, reason: '没有可参与竞拍的玩家' };
    this.state.phaseBeforeAuction = this.state.phase;
    this.state.phase = 'AUCTION';
    this.state.auction = createAuctionState({
      id: `AUCTION_${this.state.round}_${tileId}`,
      sellerId: player.id,
      tileId: Number(tileId),
      minimumBid: Math.ceil(Math.max(100, Number(minimumBid) || tile.price * 0.5) / 100) * 100,
      bidderOrder: bidders,
    });
    return { success: true, type: 'AUCTION_UPDATED', auction: structuredClone(this.state.auction) };
  }

  placeBid(player, amount) {
    const auction = normalizeAuctionState(this.state.auction);
    if (!auction || auction.status !== 'OPEN') return { success: false, reason: '当前没有拍卖' };
    this.state.auction = auction;
    if (auction.bidderOrder[auction.bidderIndex] !== player.id) return { success: false, reason: '尚未轮到该玩家出价' };
    const value = Number(amount) || 0;
    const minimum = getMinimumAuctionBid(auction);
    if (value > 0 && (value < minimum || value % 100 !== 0 || player.cash < value)) return { success: false, reason: '出价无效或现金不足', minimum };
    if (value >= minimum) {
      auction.highestBid = value;
      auction.highestBidderId = player.id;
      auction.bidHistory.push({ playerId: player.id, amount: value, action: 'BID', round: auction.biddingRound });
    } else {
      if (!auction.passedBidderIds.includes(player.id)) auction.passedBidderIds.push(player.id);
      auction.bidHistory.push({ playerId: player.id, amount: 0, action: 'PASS', round: auction.biddingRound });
    }

    const nextMinimum = getMinimumAuctionBid(auction);
    auction.bidderOrder.forEach(bidderId => {
      if (bidderId === auction.highestBidderId || auction.passedBidderIds.includes(bidderId)) return;
      const bidder = this.state.players[bidderId];
      if (!bidder || bidder.isBankrupt || bidder.cash < nextMinimum) {
        auction.passedBidderIds.push(bidderId);
        auction.bidHistory.push({ playerId: bidderId, amount: 0, action: 'AUTO_PASS', round: auction.biddingRound });
      }
    });
    auction.activeBidderIds = auction.bidderOrder.filter(bidderId => !auction.passedBidderIds.includes(bidderId));

    const challengers = auction.bidderOrder.filter(bidderId => bidderId !== auction.highestBidderId && !auction.passedBidderIds.includes(bidderId));
    const remaining = auction.bidderOrder.filter(bidderId => !auction.passedBidderIds.includes(bidderId));
    if ((auction.highestBidderId !== null && challengers.length === 0)
      || (auction.highestBidderId === null && remaining.length === 0)) {
      return this.finalizeAuction(auction);
    }

    const currentIndex = auction.bidderIndex;
    let nextIndex = -1;
    for (let offset = 1; offset <= auction.bidderOrder.length; offset++) {
      const candidateIndex = (currentIndex + offset) % auction.bidderOrder.length;
      const candidateId = auction.bidderOrder[candidateIndex];
      if (candidateId !== auction.highestBidderId && !auction.passedBidderIds.includes(candidateId)) {
        nextIndex = candidateIndex;
        if (candidateIndex <= currentIndex) auction.biddingRound++;
        break;
      }
    }
    if (nextIndex < 0) return this.finalizeAuction(auction);
    auction.bidderIndex = nextIndex;
    return { success: true, type: 'AUCTION_UPDATED', auction: structuredClone(auction) };
  }

  finalizeAuction(auction) {
    const seller = auction.sellerId === null ? null : this.state.players[auction.sellerId];
    const winner = this.state.players[auction.highestBidderId];
    if (winner) {
      winner.cash -= auction.highestBid;
      const beneficiary = seller || this.state.players[auction.beneficiaryId];
      if (beneficiary && !beneficiary.isBankrupt) beneficiary.cash += auction.highestBid;
      this.state.propertyManager.getProperty(auction.tileId).owner = winner.id;
      auction.status = 'RESOLVED';
      this.state.addLog(`🔨 ${winner.name} 以 $${auction.highestBid.toLocaleString()} 竞得【${this.state.getTile(auction.tileId)?.name || '地产'}】。`, 'gold');
    } else {
      const property = this.state.propertyManager.getProperty(auction.tileId);
      if (auction.bankruptcy && property) {
        property.level = 0;
        property.buildingType = this.state.getTile(auction.tileId)?.type === TileType.BIG_PROPERTY ? null : 'RESIDENTIAL';
      }
      auction.status = 'CANCELLED';
      this.state.addLog(`🔨 【${this.state.getTile(auction.tileId)?.name || '地产'}】流拍，无人出价。`, 'accent');
    }
    this.state.phase = this.state.phaseBeforeAuction || 'PRE_ROLL_ACTION';
    this.state.phaseBeforeAuction = null;
    const completed = structuredClone(auction);
    this.state.auction = null;
    if (completed.bankruptcy && this.state.bankruptcyAuctionQueue.length) this.startNextBankruptcyAuction();
    this.state.assetRevision++;
    return { success: true, type: 'AUCTION_UPDATED', auction: completed, completed: true };
  }

  createMarketOffer(player, payload) {
    const kind = payload.kind;
    const contentId = payload.contentId;
    const price = Math.max(1, Math.floor(Number(payload.price)));
    if (!['PROPERTY', 'ITEM', 'CARD'].includes(kind) || !price) return { success: false, reason: '挂牌内容无效' };
    const asset = getMarketAsset(this.state, kind, contentId);
    if (!asset) return { success: false, reason: '挂牌资产不存在' };
    if (kind === 'PROPERTY' && asset.ownerId !== player.id) return { success: false, reason: '没有该地产' };
    if (kind === 'PROPERTY' && !asset.transferable) return { success: false, reason: '抵押中的地产不能挂牌' };
    if (kind === 'ITEM' && !player.items.includes(contentId)) return { success: false, reason: '没有该道具' };
    if (kind === 'CARD' && !player.cards.includes(contentId)) return { success: false, reason: '没有该卡片' };
    if (this.state.marketOffers.some(item => item.sellerId === player.id && item.kind === kind && String(item.contentId) === String(contentId))) {
      return { success: false, reason: '该资产已经挂牌' };
    }
    if (price < asset.referenceValue * MARKET_MIN_RATE || price > asset.referenceValue * MARKET_MAX_RATE) {
      return { success: false, reason: `挂牌价需在参考价的 ${MARKET_MIN_RATE * 100}%～${MARKET_MAX_RATE * 100}% 之间` };
    }
    const offer = { id: `OFFER_${this.state.round}_${player.id}_${this.state.rng.int(100, 999)}`,
      sellerId: player.id, kind, contentId: asset.contentId, price, referenceValue: asset.referenceValue,
      createdRound: this.state.round, expiresRound: this.state.round + MARKET_OFFER_DURATION };
    this.state.marketOffers = [...this.state.marketOffers, offer].slice(-MARKET_OFFER_LIMIT);
    recordMarketHistory(this.state, { type: 'LISTED', ...offer, round: this.state.round });
    this.state.addLog(`📣 ${player.name} 挂牌出售「${asset.name}」，报价 $${price.toLocaleString()}。`, 'accent');
    this.state.assetRevision++;
    return { success: true, type: 'MARKET_OFFER_CREATED', offer };
  }

  acceptMarketOffer(player, offerId) {
    const original = this.state.marketOffers.find(item => item.id === offerId);
    const offer = original && normalizeMarketOffer(this.state, original);
    const seller = offer && this.state.players[offer.sellerId];
    if (!offer || !seller || seller.isBankrupt || seller.id === player.id) return { success: false, reason: '交易报价无效' };
    if (!validateMarketOffer(this.state, offer)) {
      this.state.marketOffers = this.state.marketOffers.filter(item => item.id !== offerId);
      return { success: false, reason: '挂牌已经失效' };
    }
    if (player.cash < offer.price) return { success: false, reason: '现金不足' };
    if (!canReceiveMarketAsset(player, offer.kind)) return { success: false, reason: offer.kind === 'CARD' ? '卡片栏已满' : '道具栏已满' };
    if (offer.kind === 'PROPERTY') {
      const property = this.state.propertyManager.getProperty(Number(offer.contentId));
      if (property?.owner !== seller.id) return { success: false, reason: '地产已不属于卖家' };
      property.owner = player.id;
    } else {
      const source = offer.kind === 'ITEM' ? seller.items : seller.cards;
      const target = offer.kind === 'ITEM' ? player.items : player.cards;
      const capacity = offer.kind === 'ITEM' ? ITEM_CAPACITY : CARD_CAPACITY;
      const index = source.indexOf(offer.contentId);
      if (index < 0 || target.length >= capacity) return { success: false, reason: index < 0 ? '物品已不存在' : '背包已满' };
      source.splice(index, 1);
      target.push(offer.contentId);
    }
    player.cash -= offer.price;
    seller.cash += offer.price;
    this.state.marketOffers = this.state.marketOffers.filter(item => item.id !== offer.id
      && !(item.sellerId === seller.id && item.kind === offer.kind && String(item.contentId) === String(offer.contentId)));
    const asset = getMarketAsset(this.state, offer.kind, offer.contentId);
    recordMarketHistory(this.state, { type: 'SOLD', ...offer, buyerId: player.id, round: this.state.round });
    this.state.addLog(`🤝 ${player.name} 以 $${offer.price.toLocaleString()} 买下 ${seller.name} 的「${asset?.name || offer.contentId}」。`, 'gold');
    this.state.assetRevision++;
    return { success: true, type: 'MARKET_OFFER_ACCEPTED', offerId, buyerId: player.id, sellerId: seller.id, price: offer.price };
  }

  cancelMarketOffer(player, offerId) {
    const offer = this.state.marketOffers.find(item => item.id === offerId && item.sellerId === player.id);
    if (!offer) return { success: false, reason: '只能撤销自己的有效挂牌' };
    this.state.marketOffers = this.state.marketOffers.filter(item => item.id !== offerId);
    recordMarketHistory(this.state, { type: 'CANCELLED', ...offer, round: this.state.round });
    this.state.addLog(`↩️ ${player.name} 撤销了一笔市场挂牌。`, 'accent');
    this.state.assetRevision++;
    return { success: true, type: 'MARKET_OFFER_CANCELLED', offerId };
  }

  setCompanyPolicy(player, companyId, policyId) {
    const result = this.state.companyManager.startPolicy(String(companyId), player.id, String(policyId), this.state.round);
    if (!result.success) return result;
    const company = this.state.companyManager.get(String(companyId));
    this.state.addLog(`🏢 ${player.name} 在【${company.name}】董事会通过了新的经营政策。`, 'gold');
    return { ...result, type: 'COMPANY_POLICY_SET', playerId: player.id };
  }

  submitMinigameResult(player, gameId, score) {
    const definition = MINIGAMES.find(game => game.id === gameId);
    const active = this.state.minigameState;
    const value = clampMinigameScore(score, definition?.maxScore || 0);
    if (!definition || !active || active.playerId !== player.id || active.gameId !== gameId) return { success: false, reason: '小游戏状态无效' };
    const reward = value * definition.rewardPerPoint;
    player.cardPoints += reward;
    this.state.minigameState = null;
    this.state.addLog(`🎮 ${player.name} 在【${definition.name}】获得 ${value} 分与 ${reward} 点券。`, 'gold');
    return { success: true, type: 'MINIGAME_COMPLETED', gameId, score: value, reward };
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
    const chairmanChanges = this.state.companyManager.updateChairmen(this.state.players);
    const type = action === 'BUY' ? 'STOCK_BOUGHT' : 'STOCK_SOLD';
    const transactionEvent = canSellForDebt
      ? { type: 'ASSET_LIQUIDATED', playerId: player.id, kind: 'STOCK', stockId, shares: quantity, value: result.revenue }
      : { type, playerId: player.id, stockId, shares: quantity, cost: result.cost, revenue: result.revenue };
    if (canSellForDebt) this.state.addLog(`📉 ${player.name} 卖出 ${quantity} 股用于偿债，回笼 $${result.revenue.toLocaleString()}。`, 'accent');
    return {
      ...result,
      type,
      playerId: player.id,
      stockId,
      shares: quantity,
      events: [transactionEvent, ...chairmanChanges.map(change => ({ type: 'CHAIRMAN_CHANGED', ...change }))]
    };
  }

  getShopVisit(player, tileId = null) {
    const target = Number(tileId);
    if (tileId === null || tileId === undefined
      || this.state.phase !== 'LANDING_ACTION'
      || player.currentTile !== target
      || this.state.getTile(target)?.type !== TileType.CARD_SHOP) return null;
    return getCardShopOffer(this.state, target);
  }

  getCardCost(player, card, tileId = null) {
    let cost = card.cost;
    if (player.skillName === '石油大亨' && ['DEMOLISH', 'STEAL_LAND', 'MISSILE', 'NUKES', 'LAND_BUY', 'SWAP_LAND'].includes(card.id)) cost *= 0.5;
    else if (player.skillName === '商业奇才') cost *= 0.85;
    else if (player.skillName === '棒球活力') cost *= 0.9;
    if (hasChairmanPerk(this.state, player.id, 'SHOP')) cost *= 0.85;
    const offer = this.getShopVisit(player, tileId);
    if (offer) cost *= 1 - offer.discountRate;
    return Math.max(1, Math.round(cost));
  }

  buyCard(player, cardId, tileId = null) {
    const shopVisit = this.getShopVisit(player, tileId);
    if (player.id !== this.state.currentPlayerIndex || (this.state.phase !== 'PRE_ROLL_ACTION' && !shopVisit)) {
      return { success: false, reason: '当前不能购买卡片' };
    }
    const card = cardManager.getCardById(cardId);
    if (!card) return { success: false, reason: '卡片不存在' };
    if (shopVisit && !isOfferedAtShop(shopVisit, 'CARD', cardId)) return { success: false, reason: '本轮货架没有该卡片' };
    if ((player.cards?.length || 0) >= CARD_CAPACITY) return { success: false, reason: '卡片栏已满' };
    const cost = this.getCardCost(player, card, tileId);
    if (player.cardPoints < cost) return { success: false, reason: '卡片积分不足', cost };
    player.cardPoints -= cost;
    player.cards.push(cardId);
    this.state.addLog(`🛒 ${player.name} 消费 ${cost} 积分兑换了【${card.name}】！`, 'accent');
    return { success: true, type: 'CARD_BOUGHT', playerId: player.id, cardId, cost, shopTileId: shopVisit?.tileId ?? null };
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
      case 'AUCTION_CARD': {
        const auction = this.startAuction(player, targetTile);
        if (!auction.success) return auction;
        followUp = { type: 'AUCTION_REQUESTED', auction: auction.auction };
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
    if (snapshot.version < 5) this.saves.saveAuto(this.state.createSnapshot());
    this.emit({ type: 'GAME_RESTORED' });
  }
}
