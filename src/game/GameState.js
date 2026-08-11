import { BOARD_TILES, TileType, PLAYER_PROFILES } from './BoardData.js';
import { PropertyManager } from './PropertyManager.js';
import { StockMarket } from './StockMarket.js';
import { EventManager } from './EventManager.js';
import { SeededRandom } from './SeededRandom.js';
import { getMapDefinition } from './MapData.js';
import { MapRuntime } from './MapRuntime.js';
import { CompanyManager } from './CompanyManager.js';
import { InventoryManager } from './InventoryManager.js';
import { GODS, ITEMS } from './ContentRegistry.js';

export const GamePhase = {
  SETUP: 'SETUP',
  TURN_START: 'TURN_START',
  PRE_ROLL_ACTION: 'PRE_ROLL_ACTION',
  WAITING_FOR_ROLL: 'PRE_ROLL_ACTION',
  ROLLING: 'ROLLING',
  MOVING: 'MOVING',
  LANDING_ACTION: 'LANDING_ACTION',
  ACTION_MODAL: 'LANDING_ACTION',
  ROUTE_CHOICE: 'ROUTE_CHOICE',
  DEBT_SETTLEMENT: 'DEBT_SETTLEMENT',
  AUCTION: 'AUCTION',
  MINIGAME: 'MINIGAME',
  PAUSED: 'PAUSED',
  TURN_END: 'TURN_END',
  GAME_OVER: 'GAME_OVER'
};

export class GameState {
  constructor({ seed = Date.now(), maxRounds = 40 } = {}) {
    this.phase = GamePhase.SETUP;
    this.round = 1;
    this.maxRounds = maxRounds;
    this.currentPlayerIndex = 0;
    this.players = [];
    this.propertyManager = new PropertyManager();
    this.stockMarket = new StockMarket();
    this.eventManager = new EventManager();
    this.companyManager = new CompanyManager();
    this.inventoryManager = new InventoryManager();
    this.rng = new SeededRandom(seed);
    this.stockMarket.setRandomSource(() => this.rng.next());
    this.eventManager.setRandomSource(() => this.rng.next());
    this.newsEffect = null; // { id, remainingRounds }
    this.newsHistory = [];
    this.logHistory = [];
    this.winner = null;
    this.winReason = null;
    this.assetRevision = 0;
    this.pendingMove = null;
    this.pendingDebt = null;
    this.phaseBeforePause = null;
    this.gameMode = 'STANDARD';
    this.lottery = { pot: 2000, tickets: [], lastNumber: null };
    this.boardGods = [];
    this.mechanismState = { activeRoute: 0 };
    this.roadEntities = [];
    this.auction = null;
    this.bankruptcyAuctionQueue = [];
    this.marketOffers = [];
    this.researchTasks = [];
    this.economicCycle = { period: 1, roundsPerPeriod: 5, lastSettlementRound: 0 };
    this.minigameState = null;
    this.turnCheckpoint = null;
    this.pendingDomainEvents = [];
    this.setMap('city-loop');
  }

  setMap(mapId) {
    this.mapId = getMapDefinition(mapId).id;
    this.mapDefinition = getMapDefinition(this.mapId);
    this.mapRuntime = new MapRuntime(this.mapDefinition);
    if (this.propertyManager) {
      this.propertyManager.init(this.mapDefinition.tiles);
    }
  }

  getTile(tileId) {
    return this.mapRuntime.getTile(tileId);
  }

  setupGame(playerConfigs, initialCash = 20000, options = {}) {
    this.round = 1;
    this.maxRounds = options.maxRounds || this.maxRounds || 40;
    this.currentPlayerIndex = 0;
    this.phase = GamePhase.PRE_ROLL_ACTION;
    this.setMap(options.mapId || this.mapId || 'city-loop');
    this.propertyManager.init(this.mapDefinition.tiles);
    this.stockMarket.reset();
    this.companyManager.reset();
    this.newsEffect = null;
    this.newsHistory = [];
    this.winner = null;
    this.winReason = null;
    this.assetRevision = 0;
    this.pendingMove = null;
    this.pendingDebt = null;
    this.phaseBeforePause = null;
    this.gameMode = options.mode || 'STANDARD';
    this.lottery = { pot: 2000, tickets: [], lastNumber: null };
    this.mechanismState = { activeRoute: 0 };
    this.roadEntities = [];
    this.auction = null;
    this.bankruptcyAuctionQueue = [];
    this.marketOffers = [];
    this.researchTasks = [];
    this.economicCycle = { period: 1, roundsPerPeriod: 5, lastSettlementRound: 0 };
    this.minigameState = null;
    this.pendingDomainEvents = [];

    this.players = playerConfigs.map((cfg, idx) => {
      const profile = PLAYER_PROFILES[cfg.profileIndex !== undefined ? cfg.profileIndex : (idx % PLAYER_PROFILES.length)];
      let cash = initialCash;
      if (profile.skillName === '土地公庇护') {
        cash += 3000;
      }
      if (profile.skillName === '牛仔冲锋') {
        cash += 2000;
      }
      if (profile.skillName === '石油大亨') {
        cash += 3000;
      }

      let cardPoints = 120;
      if (profile.skillName === '商业神童') {
        cardPoints += 80;
      }
      if (profile.skillName === '石油大亨') {
        cardPoints += 80;
      }
      const startingCards = ['REMOTE_DICE', 'OBSTACLE', 'TURN_AROUND'];
      if (profile.skillName === '石油大亨') startingCards.push('LAND_BUY');

      return {
        id: idx,
        profileId: profile.id,
        name: cfg.name || profile.name,
        isAI: cfg.isAI,
        aiDifficulty: cfg.aiDifficulty || 'NORMAL',
        aiStrategy: cfg.aiStrategy || ['ECONOMY', 'PROPERTY', 'CARD', 'ATTACK'][idx % 4],
        avatarImg: profile.avatarImg,
        avatarAtlas: profile.avatarAtlas,
        avatarPosition: profile.avatarPosition,
        avatar: profile.avatar,
        color: profile.color,
        colorHex: profile.colorHex,
        skillName: profile.skillName,
        skillDesc: profile.skillDesc,
        cash: cash,
        deposit: Math.max(0, Number(options.initialDeposit ?? 0)),
        cardPoints,
        cards: startingCards.slice(0, 8),
        items: ['REMOTE_DICE_ITEM', 'BARRIER', 'ROBOT_DOLL', 'MINE_ITEM'],
        selectedDiceCount: 1,
        engineeringTurns: 0,
        stocks: {},
        currentTile: 0,
        direction: 1,
        vehicle: 'WALK', // 'WALK', 'MOTOR', 'CAR'
        jailTurns: 0,
        hospitalTurns: 0,
        turtleTurns: 0,
        hibernateTurns: 0,
        sleepwalkTurns: 0,
        isSleepwalkingThisTurn: false,
        penaltyTransferTargetId: null,
        teamId: options.teams ? (cfg.teamId ?? idx % 2) : idx,
        isLord: this.gameMode === 'CHALLENGE' && idx === playerConfigs.length - 1,
        godType: null, // 'FORTUNE', 'LUCK', 'MISFORTUNE', 'BAD', 'EARTH'
        godTurns: 0,
        rentShieldTurns: 0,
        negativeImmuneTurns: 0,
        isBankrupt: false
      };
    });

    if (this.gameMode === 'CHALLENGE' && this.players.length > 1) {
      const lord = this.players[this.players.length - 1];
      lord.isAI = true;
      lord.cash = Math.round(lord.cash * 1.6);
      lord.deposit = Math.round(lord.deposit * 1.5);
      lord.cards.push('IMMUNITY', 'MISSILE', 'RENT_SHIELD');
      lord.teamId = 'LORD';
      this.players.slice(0, -1).forEach(player => { player.teamId = 'CHALLENGERS'; });
    }
    if (this.gameMode === 'HEAT') {
      this.players.forEach(player => {
        player.deposit = 0;
        player.cards = ['MISSILE', 'MINE', 'OBSTACLE', 'REMOTE_DICE'];
        player.cardPoints = Math.max(player.cardPoints, 180);
      });
    }
    this.initializeBoardGods();
    this.captureTurnCheckpoint();

    this.addLog(`🎮 《富翁帝国》原创对局开启！基础初始资金 $${initialCash.toLocaleString()}，祝大家日进斗金！`, 'gold');
    this.players.forEach(p => {
      if (p.skillName === '土地公庇护') {
        this.addLog(`🤠 ${p.name} 触发【土地公庇护】技能：获得额外 $3,000 开局创业金补贴！`, 'accent');
      }
      if (p.skillName === '牛仔冲锋') {
        this.addLog(`🐎 ${p.name} 触发【牛仔冲锋】：获得额外 $2,000 开局资金。`, 'accent');
      }
      if (p.skillName === '商业神童') {
        this.addLog(`👶 ${p.name} 触发【商业神童】：获得额外 80 点卡片积分。`, 'accent');
      }
      if (p.skillName === '石油大亨') {
        this.addLog(`🛢️ ${p.name} 获得能源资本：额外 $3,000、80 点券与购地卡。`, 'accent');
      }
    });
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  initializeBoardGods() {
    const tileCount = this.mapDefinition.tiles.length;
    const types = GODS.map(god => god.id);
    this.boardGods = types.map((type, index) => ({
      id: `BOARD_GOD_${index}`,
      type,
      tileId: this.mapDefinition.tiles[Math.floor((index + 1) * tileCount / (types.length + 1))]?.id ?? 0,
      direction: index % 2 ? -1 : 1
    }));
  }

  moveBoardGods() {
    this.boardGods.forEach(god => {
      const steps = this.rng.int(1, 3);
      const path = this.mapRuntime.projectPath(god.tileId, steps, god.direction, options => this.rng.pick(options));
      if (path.length) god.tileId = path[path.length - 1];
      if (this.rng.next() < 0.12) god.direction *= -1;
    });
  }

  checkBoardGodCollision(player) {
    const god = this.boardGods.find(item => item.tileId === player.currentTile);
    if (!god) return null;
    player.godType = god.type;
    const negative = ['MISFORTUNE', 'DEMON'].includes(god.type);
    const baseTurns = 4;
    player.godTurns = negative && player.skillName === '甜心庇佑' ? 2 : baseTurns;
    const relocation = this.rng.pick(this.mapDefinition.tiles)?.id ?? this.mapDefinition.spawnTile;
    god.tileId = relocation;
    this.addLog(`🧚 ${player.name} 遇到巡游神明【${god.type}】，附身 ${player.godTurns} 回合！`, negative ? 'danger' : 'gold');
    return god;
  }

  drawLottery() {
    const number = this.rng.int(1, 10);
    this.lottery.lastNumber = number;
    const winners = this.lottery.tickets.filter(ticket => ticket.number === number)
      .map(ticket => this.players[ticket.playerId])
      .filter(player => player && !player.isBankrupt);
    if (winners.length) {
      const prize = Math.floor(this.lottery.pot / winners.length);
      winners.forEach(player => { player.cash += prize; });
      this.addLog(`🎰 乐透开奖 ${number} 号！${winners.map(player => player.name).join('、')} 各获得 $${prize.toLocaleString()}。`, 'gold');
      this.lottery.pot = 2000;
    } else {
      this.addLog(`🎰 乐透开奖 ${number} 号无人命中，奖池累积至 $${this.lottery.pot.toLocaleString()}。`, 'accent');
    }
    this.lottery.tickets = [];
  }

  nextTurn() {
    this.phase = GamePhase.TURN_END;
    let attempts = 0;
    // A simultaneous hospital/hibernate wave is not a victory condition. Allow
    // enough full table rotations for the longest production status to expire.
    while (attempts < this.players.length * 12) {
      const previous = this.currentPlayerIndex;
      let nextIdx = (previous + 1) % this.players.length;
      while (this.players[nextIdx].isBankrupt && nextIdx !== previous) {
        nextIdx = (nextIdx + 1) % this.players.length;
      }
      if (nextIdx <= previous) {
        if (this.round >= this.maxRounds) {
          this.checkWinCondition(true);
          return { gameOver: true, skipped: [] };
        }
        this.round++;
        this.onRoundEnd();
      }
      this.currentPlayerIndex = nextIdx;
      if (this.checkWinCondition()) return { gameOver: true, skipped: [] };

      const cur = this.getCurrentPlayer();
      this.tickPlayerStatuses(cur);

      if (cur.jailTurns > 0) {
        cur.jailTurns--;
        this.addLog(`🚔 ${cur.name} 在监狱服刑，剩余 ${cur.jailTurns} 回合，本回合跳过。`, 'danger');
        attempts++;
        continue;
      }
      if (cur.hospitalTurns > 0) {
        cur.hospitalTurns--;
        this.addLog(`🏥 ${cur.name} 在医院疗养，剩余 ${cur.hospitalTurns} 回合，本回合跳过。`, 'danger');
        attempts++;
        continue;
      }
      if (cur.hibernateTurns > 0) {
        cur.hibernateTurns--;
        this.addLog(`❄️ ${cur.name} 仍在冬眠，剩余 ${cur.hibernateTurns} 回合，本回合跳过。`, 'danger');
        attempts++;
        continue;
      }
      this.phase = GamePhase.PRE_ROLL_ACTION;
      this.captureTurnCheckpoint();
      return { gameOver: false, currentPlayer: cur };
    }
    this.checkWinCondition(true);
    return { gameOver: this.phase === GamePhase.GAME_OVER };
  }

  tickPlayerStatuses(cur) {
    cur.isSleepwalkingThisTurn = false;
    if (cur.godType) {
      cur.godTurns--;
      if (cur.godTurns <= 0) {
        this.addLog(`✨ ${cur.name} 的运势精灵效果结束。`, 'accent');
        cur.godType = null;
        cur.godTurns = 0;
      }
    }
    if (cur.engineeringTurns > 0) {
      cur.engineeringTurns--;
      if (cur.engineeringTurns <= 0 && cur.vehicle === 'ENGINEER') cur.vehicle = 'WALK';
    }
    if (cur.turtleTurns > 0) {
      this.addLog(`🐢 ${cur.name} 受到迟缓效果，本回合只能移动 1 步。`, 'danger');
      cur.moveLimitThisTurn = 1;
      cur.turtleTurns--;
    } else {
      cur.moveLimitThisTurn = null;
    }
    if (cur.sleepwalkTurns > 0) {
      cur.isSleepwalkingThisTurn = true;
      cur.sleepwalkTurns--;
      this.addLog(`🌙 ${cur.name} 正在梦游：本回合自动行动并免付租金。`, 'accent');
    }
    cur.rentShieldActiveThisTurn = cur.rentShieldTurns > 0 || cur.isSleepwalkingThisTurn;
    if (cur.rentShieldActiveThisTurn) cur.rentShieldTurns--;
    cur.negativeImmuneActiveThisTurn = cur.negativeImmuneTurns > 0;
    if (cur.negativeImmuneActiveThisTurn) cur.negativeImmuneTurns--;
    if (cur.godType === 'MISFORTUNE' && !cur.negativeImmuneActiveThisTurn) {
      const penalty = Math.max(0, Math.round(cur.cash * 0.10));
      const transferTarget = this.players.find(player => player.id === cur.penaltyTransferTargetId && !player.isBankrupt && player.id !== cur.id);
      const recipient = transferTarget || cur;
      if (transferTarget) {
        cur.penaltyTransferTargetId = null;
        this.addLog(`🎭 ${cur.name} 将破财惩罚转嫁给了 ${recipient.name}！`, 'gold');
      }
      recipient.cash -= penalty;
      this.addLog(`👻 破财精灵收取 ${recipient.name} $${penalty.toLocaleString()}。`, 'danger');
      this.checkBankrupt(recipient);
    }
  }

  get priceIndex() {
    return Number((1.0 + Math.floor((this.round - 1) / 5) * 0.2).toFixed(1));
  }

  onRoundEnd() {
    if (this.newsEffect) {
      this.newsEffect.remainingRounds--;
      if (this.newsEffect.remainingRounds <= 0) this.newsEffect = null;
    }
    this.stockMarket.updateMarket();
    this.moveBoardGods();
    const chairmanChanges = this.companyManager.updateChairmen(this.players);
    chairmanChanges.forEach(change => {
      const company = this.companyManager.get(change.companyId);
      const chairman = this.players[change.chairmanId];
      this.addLog(`🏢 ${chairman ? `${chairman.name} 成为` : '暂无'}【${company.name}】董事长。`, 'accent');
      this.pendingDomainEvents.push({ type: 'CHAIRMAN_CHANGED', ...change });
    });
    this.processResearch();
    this.processRoadEntities();
    if (this.round % this.economicCycle.roundsPerPeriod === 0) {
      this.drawLottery();
      this.players.filter(player => !player.isBankrupt && player.deposit > 0).forEach(player => {
        const interest = Math.round(player.deposit * 0.05);
        player.deposit += interest;
        this.addLog(`🏦 ${player.name} 获得五轮定期利息 $${interest.toLocaleString()}。`, 'gold');
      });
      const settlements = this.companyManager.settle(this.players, this.rng);
      settlements.forEach(settlement => {
        const company = this.companyManager.get(settlement.companyId);
        this.addLog(`🏢 【${company.name}】周期结算：分红 $${settlement.dividendPool.toLocaleString()}。`, settlement.dividendPool > 0 ? 'gold' : 'accent');
        this.pendingDomainEvents.push({ type: 'COMPANY_SETTLED', ...settlement });
      });
      this.economicCycle.period++;
      this.economicCycle.lastSettlementRound = this.round;
      this.pendingDomainEvents.push({ type: 'ECONOMIC_CYCLE_ENDED', round: this.round, period: this.economicCycle.period - 1 });
    }
    this.addLog(`📈 第 ${this.round} 轮开始！【当前物价指数: ${this.priceIndex.toFixed(1)}x】股市大盘已刷新！`, 'accent');

    const news = this.eventManager.triggerRandomNews(this);
    if (news) {
      this.addLog(`⚡ 新闻大事件：【${news.title}】 - ${news.desc}`, 'gold');
      const entry = {
        id: news.id,
        title: news.title,
        desc: news.desc,
        category: news.category,
        icon: news.icon,
        tone: news.tone,
        round: this.round,
        impacts: structuredClone(news.impacts || [])
      };
      this.newsHistory.unshift(entry);
      this.newsHistory = this.newsHistory.slice(0, 20);
      this.pendingDomainEvents.push({ type: 'NEWS_FLASH', news: structuredClone(entry) });
    }
  }

  captureTurnCheckpoint() {
    const player = this.getCurrentPlayer();
    if (!player) return;
    this.turnCheckpoint = {
      playerId: player.id,
      currentTile: player.currentTile,
      cash: player.cash,
      deposit: player.deposit,
      cards: structuredClone(player.cards || []),
      items: structuredClone(player.items || []),
      stocks: structuredClone(player.stocks || {}),
      statuses: {
        vehicle: player.vehicle,
        jailTurns: player.jailTurns,
        hospitalTurns: player.hospitalTurns,
        godType: player.godType,
        godTurns: player.godTurns
      }
    };
  }

  processResearch() {
    this.researchTasks.forEach(task => { task.roundsRemaining--; });
    const completed = this.researchTasks.filter(task => task.roundsRemaining <= 0);
    completed.forEach(task => {
      const player = this.players[task.playerId];
      if (!player || player.isBankrupt) return;
      const added = this.inventoryManager.addItem(player, task.itemId);
      const item = ITEMS.find(definition => definition.id === task.itemId);
      this.addLog(added.success
        ? `🧪 ${player.name} 完成【${item?.name || task.itemId}】研发。`
        : `🧪 ${player.name} 的研发已完成，但道具栏已满。`, added.success ? 'gold' : 'danger');
      this.pendingDomainEvents.push({ type: 'RESEARCH_COMPLETED', playerId: player.id, itemId: task.itemId, success: added.success });
    });
    this.researchTasks = this.researchTasks.filter(task => task.roundsRemaining > 0);
  }

  processRoadEntities() {
    const expiredBombs = this.roadEntities.filter(entity => entity.type === 'TIME_BOMB'
      && entity.expiresRound !== null && entity.expiresRound !== undefined && entity.expiresRound <= this.round);
    expiredBombs.forEach(entity => {
      this.players.filter(player => !player.isBankrupt && Math.abs(player.currentTile - entity.tileId) <= 1).forEach(player => {
        player.vehicle = 'WALK';
        player.hospitalTurns = Math.max(player.hospitalTurns, 3);
      });
      this.addLog(`💥 【${this.getTile(entity.tileId)?.name || entity.tileId}】的倒计时炸弹爆炸！`, 'danger');
    });
    const expiredIds = new Set(expiredBombs.map(entity => entity.id));
    this.roadEntities = this.roadEntities.filter(entity => !expiredIds.has(entity.id));
    expiredBombs.forEach(entity => this.pendingDomainEvents.push({ type: 'ROAD_ENTITY_CHANGED', tileId: entity.tileId, entityId: entity.id, removed: true }));

    if (this.roadEntities.filter(entity => ['GIFT_BOX', 'COUPON_CHEST', 'DOG'].includes(entity.type)).length < 3) {
      const type = this.rng.pick(['GIFT_BOX', 'COUPON_CHEST', 'DOG']);
      const tile = this.rng.pick(this.mapDefinition.tiles);
      if (tile) {
        const entity = {
        id: `ROAD_${this.round}_${this.rng.int(1000, 9999)}`,
        type,
        tileId: tile.id,
        ownerId: null,
        expiresRound: this.round + 8
        };
        this.roadEntities.push(entity);
        this.pendingDomainEvents.push({ type: 'ROAD_ENTITY_CHANGED', tileId: tile.id, entity });
      }
    }
    this.roadEntities = this.roadEntities.filter(entity => !entity.expiresRound || entity.expiresRound > this.round || entity.type === 'TIME_BOMB');
  }

  // 检查玩家撞击/经过他人时的神明碰撞转移
  checkGodCollision(movingPlayer) {
    if (!movingPlayer || movingPlayer.isBankrupt) return;
    const sameTilePlayers = this.players.filter(p => !p.isBankrupt && p.id !== movingPlayer.id && p.currentTile === movingPlayer.currentTile);
    sameTilePlayers.forEach(other => {
      if (movingPlayer.godType && !other.godType) {
        other.godType = movingPlayer.godType;
        other.godTurns = movingPlayer.godTurns;
        this.addLog(`✨ 擦肩而过！${movingPlayer.name} 的【${movingPlayer.godType}】转移到了 ${other.name} 身上！`, 'accent');
        movingPlayer.godType = null;
        movingPlayer.godTurns = 0;
      } else if (!movingPlayer.godType && other.godType) {
        movingPlayer.godType = other.godType;
        movingPlayer.godTurns = other.godTurns;
        this.addLog(`✨ 擦肩而过！${movingPlayer.name} 从 ${other.name} 身上染上了【${movingPlayer.godType}】！`, 'accent');
        other.godType = null;
        other.godTurns = 0;
      }
    });
  }

  checkBankrupt(player) {
    if (player.cash >= 0 || player.isBankrupt) {
      return { bankrupt: player.isBankrupt, liquidations: [] };
    }

    const liquidations = [];
    if ((player.deposit || 0) > 0) {
      const value = Math.min(player.deposit, Math.abs(player.cash));
      player.deposit -= value;
      player.cash += value;
      liquidations.push({ kind: 'DEPOSIT', value });
      if (player.cash >= 0) return { bankrupt: false, liquidations };
    }
    for (const stockId of Object.keys(player.stocks || {})) {
      const holding = player.stocks[stockId];
      if (!holding?.shares) continue;
      const shares = holding.shares;
      const result = this.stockMarket.sellStock(player, stockId, shares);
      if (result.success) liquidations.push({ kind: 'STOCK', stockId, shares, value: result.revenue });
      if (player.cash >= 0) break;
    }

    const owned = [...this.propertyManager.properties.entries()]
      .filter(([, property]) => property.owner === player.id)
      .sort((a, b) => b[1].level - a[1].level);

    for (const [tileId, property] of owned) {
      const tile = this.getTile(tileId) || BOARD_TILES[tileId];
      while (player.cash < 0 && property.level > 0) {
        property.level--;
        const value = Math.round((tile.buildCost || 0) * 0.5);
        player.cash += value;
        liquidations.push({ kind: 'BUILDING', tileId, level: property.level, value });
      }
      if (player.cash >= 0) break;
    }

    for (const [tileId, property] of owned) {
      if (player.cash >= 0) break;
      if (property.owner !== player.id) continue;
      const tile = this.getTile(tileId) || BOARD_TILES[tileId];
      const value = Math.round((tile.price || 0) * 0.5);
      property.owner = null;
      property.level = 0;
      property.isMortgaged = false;
      property.mortgageValue = 0;
      property.buildingType = this.getTile(tileId)?.type === TileType.BIG_PROPERTY ? null : 'RESIDENTIAL';
      player.cash += value;
      liquidations.push({ kind: 'PROPERTY', tileId, level: 0, value });
    }

    if (liquidations.length) {
      this.assetRevision++;
      const recovered = liquidations.reduce((sum, item) => sum + item.value, 0);
      this.addLog(`⚠️ ${player.name} 自动清算资产，回笼 $${recovered.toLocaleString()}。`, 'danger');
    }

    if (player.cash < 0) {
      player.isBankrupt = true;
      player.cash = 0;
      this.propertyManager.properties.forEach((property, tileId) => {
        if (property.owner !== player.id) return;
        property.owner = null;
        property.level = 0;
        property.isMortgaged = false;
        property.mortgageValue = 0;
        liquidations.push({ kind: 'PROPERTY', tileId, level: 0, value: 0 });
      });
      this.addLog(`💥 破产公告：${player.name} 宣告破产退场！`, 'danger');
      this.checkWinCondition();
    }

    return { bankrupt: player.isBankrupt, liquidations };
  }

  calculateNetWorth(player) {
    return this.calculateAssetBreakdown(player).total;
  }

  calculateAssetBreakdown(player) {
    let stockValue = 0;
    Object.entries(player.stocks || {}).forEach(([stockId, holding]) => {
      const stock = this.stockMarket.stocks.find(s => s.id === stockId);
      if (stock) stockValue += holding.shares * stock.price;
    });
    let landValue = 0;
    let buildingValue = 0;
    let propertyCount = 0;
    this.propertyManager.properties.forEach((prop, tileIndex) => {
      if (prop.owner !== player.id) return;
      const tile = this.getTile(tileIndex) || BOARD_TILES[tileIndex];
      propertyCount++;
      landValue += Math.max(0, (tile.price || 0) - (prop.isMortgaged ? (prop.mortgageValue || 0) : 0));
      buildingValue += (tile.buildCost || 0) * prop.level;
    });
    const deposit = Math.round(player.deposit || 0);
    const total = Math.round(player.cash + deposit + stockValue + landValue + buildingValue);
    return {
      cash: Math.round(player.cash),
      deposit,
      stockValue: Math.round(stockValue),
      landValue: Math.round(landValue),
      buildingValue: Math.round(buildingValue),
      propertyCount,
      cardCount: player.cards?.length || 0,
      total
    };
  }

  getRankings() {
    return this.players
      .map(player => ({ player, assets: this.calculateAssetBreakdown(player) }))
      .sort((a, b) => b.assets.total - a.assets.total);
  }

  checkWinCondition(force = false) {
    const activePlayers = this.players.filter(p => !p.isBankrupt);
    if (this.gameMode === 'CHALLENGE') {
      const lord = this.players.find(player => player.isLord);
      const challengers = this.players.filter(player => !player.isLord && !player.isBankrupt);
      if (lord?.isBankrupt || challengers.length === 0 || force || this.round > this.maxRounds) {
        this.phase = GamePhase.GAME_OVER;
        if (lord?.isBankrupt) {
          this.winner = challengers.sort((a, b) => this.calculateNetWorth(b) - this.calculateNetWorth(a))[0] || null;
          this.winReason = 'LORD_DEFEATED';
          this.winningTeamId = 'CHALLENGERS';
        } else if (challengers.length === 0) {
          this.winner = lord;
          this.winReason = 'LORD_VICTORY';
          this.winningTeamId = 'LORD';
        } else {
          const challengerAssets = challengers.reduce((sum, player) => sum + this.calculateNetWorth(player), 0);
          this.winner = challengerAssets > this.calculateNetWorth(lord)
            ? challengers.sort((a, b) => this.calculateNetWorth(b) - this.calculateNetWorth(a))[0]
            : lord;
          this.winningTeamId = this.winner?.isLord ? 'LORD' : 'CHALLENGERS';
          this.winReason = 'TEAM_NET_WORTH';
        }
        return true;
      }
      return false;
    }

    const teamMode = this.gameMode === 'TEAM';
    if (teamMode) {
      const activeTeams = new Set(activePlayers.map(player => player.teamId));
      if (activeTeams.size === 1 || force || this.round > this.maxRounds) {
        this.phase = GamePhase.GAME_OVER;
        const teamAssets = new Map();
        activePlayers.forEach(player => teamAssets.set(player.teamId, (teamAssets.get(player.teamId) || 0) + this.calculateNetWorth(player)));
        this.winningTeamId = [...teamAssets.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        this.winner = activePlayers.filter(player => player.teamId === this.winningTeamId)
          .sort((a, b) => this.calculateNetWorth(b) - this.calculateNetWorth(a))[0] || null;
        this.winReason = activeTeams.size === 1 ? 'LAST_TEAM' : 'TEAM_NET_WORTH';
        if (this.winner) this.addLog(`👑 队伍 ${this.winningTeamId} 获胜，代表玩家 ${this.winner.name}！`, 'gold');
        return true;
      }
      return false;
    }
    if (activePlayers.length === 1 || force || this.round > this.maxRounds) {
      this.phase = GamePhase.GAME_OVER;
      this.winner = [...activePlayers].sort((a, b) => this.calculateNetWorth(b) - this.calculateNetWorth(a))[0];
      this.winReason = activePlayers.length === 1 ? 'LAST_PLAYER' : 'NET_WORTH';
      this.addLog(`👑 ${this.winner.name} 以总资产 $${this.calculateNetWorth(this.winner).toLocaleString()} 获得胜利！`, 'gold');
      return true;
    }
    return false;
  }

  createSnapshot() {
    const random = this.rng.exportState();
    return {
      version: 6,
      contentVersion: '2026.4',
      savedAt: new Date().toISOString(),
      seed: random.seed,
      rngState: random.state,
      phase: this.phase,
      round: this.round,
      maxRounds: this.maxRounds,
      gameMode: this.gameMode,
      mapId: this.mapId,
      currentPlayerIndex: this.currentPlayerIndex,
      players: structuredClone(this.players),
      properties: structuredClone([...this.propertyManager.properties.entries()]),
      stocks: structuredClone(this.stockMarket.stocks),
      newsEffect: structuredClone(this.newsEffect),
      newsHistory: structuredClone(this.newsHistory),
      logHistory: structuredClone(this.logHistory),
      winnerId: this.winner?.id ?? null,
      winReason: this.winReason,
      pendingMove: structuredClone(this.pendingMove),
      pendingDebt: structuredClone(this.pendingDebt),
      phaseBeforePause: this.phaseBeforePause,
      lottery: structuredClone(this.lottery),
      boardGods: structuredClone(this.boardGods),
      mechanismState: structuredClone(this.mechanismState),
      winningTeamId: this.winningTeamId ?? null,
      roadEntities: structuredClone(this.roadEntities),
      companies: structuredClone(this.companyManager.companies),
      auction: structuredClone(this.auction),
      bankruptcyAuctionQueue: structuredClone(this.bankruptcyAuctionQueue),
      marketOffers: structuredClone(this.marketOffers),
      researchTasks: structuredClone(this.researchTasks),
      economicCycle: structuredClone(this.economicCycle),
      minigameState: structuredClone(this.minigameState),
      turnCheckpoint: structuredClone(this.turnCheckpoint)
    };
  }

  restoreSnapshot(snapshot) {
    if (!snapshot || ![1, 2, 3, 4, 5, 6].includes(snapshot.version)) throw new Error('不兼容的存档版本');
    this.pendingDomainEvents = [];
    this.phase = snapshot.phase;
    this.round = snapshot.round;
    this.maxRounds = snapshot.maxRounds;
    this.gameMode = snapshot.gameMode || 'STANDARD';
    this.setMap(snapshot.mapId || 'city-loop');
    this.currentPlayerIndex = snapshot.currentPlayerIndex;
    this.players = structuredClone(snapshot.players).map(player => ({
      hibernateTurns: 0,
      sleepwalkTurns: 0,
      isSleepwalkingThisTurn: false,
      penaltyTransferTargetId: null,
      deposit: 0,
      teamId: player.id,
      isLord: false,
      items: [],
      selectedDiceCount: 1,
      engineeringTurns: 0,
      ...player
    }));
    this.propertyManager.properties = new Map(structuredClone(snapshot.properties).map(([tileId, property]) => [
      tileId,
      {
        owner: null,
        level: 0,
        hasObstacle: false,
        isMortgaged: false,
        mortgageValue: 0,
        buildingType: this.getTile(tileId)?.type === TileType.BIG_PROPERTY ? 'MALL' : 'RESIDENTIAL',
        ...property
      }
    ]));
    this.stockMarket.stocks = structuredClone(snapshot.stocks);
    this.newsEffect = structuredClone(snapshot.newsEffect);
    this.newsHistory = structuredClone(snapshot.newsHistory || []);
    this.logHistory = structuredClone(snapshot.logHistory || []);
    this.rng.importState({ seed: snapshot.seed, state: snapshot.rngState });
    this.winner = snapshot.winnerId === null || snapshot.winnerId === undefined
      ? null
      : this.players.find(player => player.id === snapshot.winnerId) || null;
    this.winReason = snapshot.winReason || null;
    this.pendingMove = structuredClone(snapshot.pendingMove || null);
    this.pendingDebt = structuredClone(snapshot.pendingDebt || null);
    this.phaseBeforePause = snapshot.phaseBeforePause || null;
    this.lottery = structuredClone(snapshot.lottery || { pot: 2000, tickets: [], lastNumber: null });
    this.boardGods = structuredClone(snapshot.boardGods || []);
    if (!this.boardGods.length) this.initializeBoardGods();
    this.mechanismState = structuredClone(snapshot.mechanismState || { activeRoute: 0 });
    this.winningTeamId = snapshot.winningTeamId ?? null;
    this.roadEntities = structuredClone(snapshot.roadEntities || []);
    this.companyManager.companies = structuredClone(snapshot.companies || this.companyManager.companies);
    this.auction = structuredClone(snapshot.auction || null);
    this.bankruptcyAuctionQueue = structuredClone(snapshot.bankruptcyAuctionQueue || []);
    this.marketOffers = structuredClone(snapshot.marketOffers || []);
    this.researchTasks = structuredClone(snapshot.researchTasks || []);
    this.economicCycle = structuredClone(snapshot.economicCycle || { period: Math.floor(this.round / 5) + 1, roundsPerPeriod: 5, lastSettlementRound: 0 });
    this.minigameState = structuredClone(snapshot.minigameState || null);
    this.turnCheckpoint = structuredClone(snapshot.turnCheckpoint || null);
    if (this.mechanismState.activeRoute) {
      this.mapDefinition.tiles.filter(tile => (tile.next || []).length > 1).forEach(tile => {
        this.mapRuntime.setNextOptions(tile.id, [tile.next[this.mechanismState.activeRoute % tile.next.length]]);
      });
    }
  }

  addLog(msg, type = 'normal') {
    this.logHistory.push({ msg, type, time: new Date().toLocaleTimeString() });
    if (this.logHistory.length > 50) this.logHistory.shift();
  }
}
